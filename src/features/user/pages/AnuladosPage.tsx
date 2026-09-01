import { useState, useEffect, useMemo } from 'react';
import {
  Search, Download, XCircle, Calendar, ArrowUpDown, ChevronDown, Check, X
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { clsx } from 'clsx';
import ExportModal, { type ExportFormat } from '../components/modals/ExportModal';
import AnuladosTable, { type VentaAnulada } from '../components/tables/AnuladosTable';

interface ItemAnuladoExport {
  anulacion_id: number;
  cancelled_at: string;
  reason: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

type SortField = 'id' | 'total' | 'cancelled_at' | 'payment_method';
type SortDir = 'asc' | 'desc';

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

const todayStr = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const AnuladosPage = () => {
  const { showNotification } = useNotification();
  const { activeStoreId } = useAuth();
  const [anulaciones, setAnulaciones] = useState<VentaAnulada[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('cancelled_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Export
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    if (activeStoreId) {
      loadAnulaciones();
    }
  }, [activeStoreId]);

  const loadAnulaciones = async () => {
    if (!activeStoreId) return;
    setIsLoading(true);
    try {
      const data = await invoke<VentaAnulada[]>('get_anulaciones', { storeId: activeStoreId });
      setAnulaciones(data);
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'No se pudieron cargar las anulaciones');
    } finally {
      setIsLoading(false);
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
      exportAnulacionesCSV();
    } else {
      showNotification('info', 'Exportar PDF', 'La exportación a PDF estará disponible próximamente.');
    }
  };

  const exportAnulacionesCSV = () => {
    try {
      const headers = ['ID', 'Fecha', 'Motivo', 'Método de Pago', 'Subtotal', 'IGV', 'Total', 'Anulado por'];
      const rows = filteredAnulaciones.map(a => [
        a.id,
        formatDateTime(a.cancelled_at),
        a.reason,
        paymentMethodLabel(a.payment_method),
        a.subtotal.toFixed(2),
        a.igv.toFixed(2),
        a.total.toFixed(2),
        a.cancelled_by || '',
      ]);
      downloadCSV(headers, rows, `anulaciones_${new Date().toISOString().slice(0, 10)}.csv`);
      showNotification('success', 'Exportación exitosa', 'El archivo CSV ha sido descargado correctamente.');
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'No se pudo exportar el archivo CSV.');
    }
  };

  const exportItemsCSV = async () => {
    if (!activeStoreId) return;
    try {
      const items = await invoke<ItemAnuladoExport[]>('get_all_items_anulados', { storeId: activeStoreId });
      const filtered = items.filter(item => {
        const d = new Date(item.cancelled_at);
        const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
        const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
        return (!from || d >= from) && (!to || d <= to);
      });
      const headers = ['N° Anulación', 'Fecha', 'Motivo', 'Producto', 'Precio Unit.', 'Cantidad', 'Subtotal'];
      const rows = filtered.map(item => [
        item.anulacion_id,
        formatDateTime(item.cancelled_at),
        item.reason,
        item.product_name,
        item.unit_price.toFixed(2),
        item.quantity,
        item.subtotal.toFixed(2),
      ]);
      downloadCSV(headers, rows, `detalle_anulados_${new Date().toISOString().slice(0, 10)}.csv`);
      showNotification('success', 'Exportación exitosa', `${filtered.length} items anulados exportados correctamente.`);
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'No se pudo exportar el detalle de anulados.');
    }
  };

  const downloadCSV = (headers: string[], rows: (string | number)[][], filename: string) => {
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter & sort logic
  const filteredAnulaciones = useMemo(() => {
    let result = anulaciones.filter(a => {
      const searchLower = search.toLowerCase();
      const matchSearch = !search
        || String(a.id).includes(searchLower)
        || a.reason.toLowerCase().includes(searchLower)
        || (a.cancelled_by?.toLowerCase().includes(searchLower) ?? false);

      const matchPayment = filterPayment === 'all' || a.payment_method === filterPayment;

      const date = new Date(a.cancelled_at);
      const matchDateFrom = !dateFrom || date >= new Date(dateFrom + 'T00:00:00');
      const matchDateTo = !dateTo || date <= new Date(dateTo + 'T23:59:59');

      return matchSearch && matchPayment && matchDateFrom && matchDateTo;
    });

    result = result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'id') cmp = a.id - b.id;
      else if (sortField === 'total') cmp = a.total - b.total;
      else if (sortField === 'payment_method') cmp = a.payment_method.localeCompare(b.payment_method);
      else if (sortField === 'cancelled_at') cmp = new Date(a.cancelled_at).getTime() - new Date(b.cancelled_at).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [anulaciones, search, filterPayment, dateFrom, dateTo, sortField, sortDir]);

  const totalPages = Math.ceil(filteredAnulaciones.length / itemsPerPage);
  const paginated = filteredAnulaciones.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const sortOptions: { label: string; field: SortField }[] = [
    { label: 'Fecha', field: 'cancelled_at' },
    { label: 'Total', field: 'total' },
    { label: 'N° Anulación', field: 'id' },
    { label: 'Método de Pago', field: 'payment_method' },
  ];

  const totalAnulado = filteredAnulaciones.reduce((sum, a) => sum + a.total, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas Anuladas</h1>
          <p className="text-gray-500">Historial y registro de ventas anuladas</p>
        </div>
        <button
          onClick={() => setIsExportOpen(true)}
          disabled={anulaciones.length === 0}
          className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          Exportar
        </button>
      </div>

      {/* Summary card */}
      {filteredAnulaciones.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-xl">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ventas Anuladas</p>
              <p className="text-xl font-bold text-gray-900">{filteredAnulaciones.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-xl">
              <XCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monto Anulado Total</p>
              <p className="text-xl font-bold text-gray-900">S/ {totalAnulado.toFixed(2)}</p>
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
                placeholder="Buscar por N°, motivo, quién anuló..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 w-full md:w-auto flex-wrap">
              <div className="relative">
                <button
                  onClick={() => { setShowFilterMenu(prev => !prev); setShowSortMenu(false); }}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2.5 border rounded-xl font-medium text-sm transition-colors',
                    (filterPayment !== 'all') ? 'border-red-500 text-red-600 bg-red-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  Filtros
                  {filterPayment !== 'all' && <span className="w-2 h-2 rounded-full bg-red-600" />}
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
                          filterPayment === opt.value ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
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
                          sortField === opt.field ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        <span>{opt.label}</span>
                        {sortField === opt.field && (
                          <span className="text-xs text-red-500">{sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}</span>
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
                  className="pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700"
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
                  className="pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700"
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
        <AnuladosTable anulaciones={paginated} isLoading={isLoading} />

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <span>Mostrando {paginated.length} de {filteredAnulaciones.length} anulaciones</span>
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
    </div>
  );
};

export default AnuladosPage;
