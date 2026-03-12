import { useState, useEffect, useMemo } from 'react';
import {
  Search, Filter, ArrowUpDown, Download,
  ShoppingBag, FileText, X, Calendar, ChevronDown, Check
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from '@/context/NotificationContext';
import { clsx } from 'clsx';
import ExportModal, { type ExportFormat } from '../components/modals/ExportModal';
import SaleDetailModal, { type Sale } from '../components/modals/SaleDetailModal';
import SalesTable from '../components/tables/SalesTable';

// ─── Types ────────────────────────────────────────────────────
interface OrderItemExport {
  order_id: number;
  created_at: string;
  client_name?: string | null;
  client_document?: string | null;
  payment_method: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

type SortField = 'id' | 'total' | 'created_at' | 'payment_method';
type SortDir = 'asc' | 'desc';

// ─── Helpers ──────────────────────────────────────────────────
const paymentMethodLabel = (method: string) => {
  switch (method) {
    case 'cash': return 'Efectivo';
    case 'card': return 'Tarjeta';
    case 'yape': return 'Yape';
    default: return method;
  }
};

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// ─── Main Component ───────────────────────────────────────────
const SalesPage = () => {
  const { showNotification } = useNotification();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const data = await invoke<Sale[]>('get_sales');
      setSales(data);
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'No se pudieron cargar las ventas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetail = async (sale: Sale) => {
    try {
      const detailed = await invoke<Sale>('get_sale_detail', { saleId: sale.id });
      setSelectedSale(detailed);
    } catch {
      // Fallback: show sale without items detail
      setSelectedSale(sale);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setShowSortMenu(false);
  };

  const handleExport = (format: ExportFormat) => {
    setIsExportOpen(false);
    if (format === 'items_csv') {
      exportItemsCSV();
    } else if (format === 'orders_csv') {
      exportOrdersCSV();
    } else {
      showNotification('info', 'Exportar PDF', 'La exportación a PDF estará disponible próximamente.');
    }
  };

  const exportItemsCSV = async () => {
    try {
      const items = await invoke<OrderItemExport[]>('get_all_order_items');
      // Apply the same date filters as the current view
      const filtered = items.filter(item => {
        const d = new Date(item.created_at);
        const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
        const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
        return (!from || d >= from) && (!to || d <= to);
      });
      const headers = ['N° Orden', 'Fecha', 'Cliente', 'Documento', 'Método de Pago', 'Prenda', 'Precio Unit.', 'Cantidad', 'Subtotal'];
      const rows = filtered.map(item => [
        item.order_id,
        formatDateTime(item.created_at),
        item.client_name || '',
        item.client_document || '',
        paymentMethodLabel(item.payment_method),
        item.product_name,
        item.unit_price.toFixed(2),
        item.quantity,
        item.subtotal.toFixed(2),
      ]);
      const csv = [headers, ...rows]
        .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `detalle_prendas_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showNotification('success', 'Exportación exitosa', `${filtered.length} prendas exportadas correctamente.`);
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'No se pudo exportar el detalle de prendas.');
    }
  };

  const exportOrdersCSV = () => {
    try {
      const headers = ['ID', 'Fecha', 'Cliente', 'Documento', 'Teléfono', 'Método de Pago', 'Subtotal', 'IGV', 'Total'];
      const rows = filteredSales.map(s => [
        s.id,
        formatDateTime(s.created_at),
        s.client_name || '',
        s.client_document || '',
        s.client_phone || '',
        paymentMethodLabel(s.payment_method),
        s.subtotal.toFixed(2),
        s.igv.toFixed(2),
        s.total.toFixed(2),
      ]);
    const csv = [headers, ...rows]
        .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ventas_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showNotification('success', 'Exportación exitosa', 'El archivo CSV ha sido descargado correctamente.');
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'No se pudo exportar el archivo CSV.');
    }
  };

  // ─── Filter & Sort Logic ──────────────────────────────────
  const filteredSales = useMemo(() => {
    let result = sales.filter(s => {
      const searchLower = search.toLowerCase();
      const matchSearch = !search
        || String(s.id).includes(searchLower)
        || (s.client_name?.toLowerCase().includes(searchLower))
        || (s.client_document?.toLowerCase().includes(searchLower))
        || (s.client_phone?.toLowerCase().includes(searchLower));

      const matchPayment = filterPayment === 'all' || s.payment_method === filterPayment;

      const saleDate = new Date(s.created_at);
      const matchDateFrom = !dateFrom || saleDate >= new Date(dateFrom + 'T00:00:00');
      const matchDateTo = !dateTo || saleDate <= new Date(dateTo + 'T23:59:59');

      return matchSearch && matchPayment && matchDateFrom && matchDateTo;
    });

    // Sort
    result = result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'id') cmp = a.id - b.id;
      else if (sortField === 'total') cmp = a.total - b.total;
      else if (sortField === 'payment_method') cmp = a.payment_method.localeCompare(b.payment_method);
      else if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [sales, search, filterPayment, dateFrom, dateTo, sortField, sortDir]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const sortOptions: { label: string; field: SortField }[] = [
    { label: 'Fecha', field: 'created_at' },
    { label: 'Total', field: 'total' },
    { label: 'N° Venta', field: 'id' },
    { label: 'Método de Pago', field: 'payment_method' },
  ];

  const totalVentasFiltradas = filteredSales.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas Realizadas</h1>
          <p className="text-gray-500">Historial y registro de todas las ventas</p>
        </div>
        <button
          onClick={() => setIsExportOpen(true)}
          className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all active:scale-95"
        >
          <Download className="w-5 h-5" />
          Exportar
        </button>
      </div>

      {/* Summary card */}
      {filteredSales.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Ventas</p>
              <p className="text-xl font-bold text-gray-900">{filteredSales.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ingresos Totales</p>
              <p className="text-xl font-bold text-gray-900">S/ {totalVentasFiltradas.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ticket Promedio</p>
              <p className="text-xl font-bold text-gray-900">
                S/ {filteredSales.length > 0 ? (totalVentasFiltradas / filteredSales.length).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Filters bar */}
        <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por N°, cliente, documento..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 w-full md:w-auto flex-wrap">
              {/* Filter dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setShowFilterMenu(prev => !prev); setShowSortMenu(false); }}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2.5 border rounded-xl font-medium text-sm transition-colors',
                    (filterPayment !== 'all') ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Filter className="w-4 h-4" />
                  Filtros
                  {filterPayment !== 'all' && (
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showFilterMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-xl z-30 p-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase px-3 py-2 tracking-wider">Método de pago</p>
                    {[
                      { value: 'all', label: 'Todos' },
                      { value: 'cash', label: 'Efectivo' },
                      { value: 'card', label: 'Tarjeta' },
                      { value: 'yape', label: 'Yape' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setFilterPayment(opt.value); setCurrentPage(1); setShowFilterMenu(false); }}
                        className={clsx(
                          'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between',
                          filterPayment === opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        {opt.label}
                        {filterPayment === opt.value && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setShowSortMenu(prev => !prev); setShowFilterMenu(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  Ordenar
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-xl z-30 p-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase px-3 py-2 tracking-wider">Ordenar por</p>
                    {sortOptions.map(opt => (
                      <button
                        key={opt.field}
                        onClick={() => handleSort(opt.field)}
                        className={clsx(
                          'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between',
                          sortField === opt.field ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <span>{opt.label}</span>
                        {sortField === opt.field && (
                          <span className="text-xs text-blue-500">{sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Date range filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <span className="text-sm text-gray-500 font-medium flex items-center gap-2 shrink-0">
              <Calendar className="w-4 h-4" />
              Rango de fechas:
            </span>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  className="pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                  placeholder="Desde"
                />
              </div>
              <span className="text-gray-400 self-center text-sm hidden sm:block">—</span>
              <div className="relative">
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
                  className="pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                  placeholder="Hasta"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-red-200"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <SalesTable
          sales={paginatedSales}
          isLoading={isLoading}
          onViewDetail={handleViewDetail}
        />

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <span>Mostrando {paginatedSales.length} de {filteredSales.length} ventas</span>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
              Anterior
            </button>
            <span className="flex items-center px-2">
              Página {currentPage} de {totalPages || 1}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onConfirm={handleExport}
      />

      <SaleDetailModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
      />
    </div>
  );
};

export default SalesPage;
