import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Filter, ArrowUpDown, Download,
  Receipt, DollarSign, FileText, Calendar, X, ChevronDown, Check, Plus
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from '@/context/NotificationContext';
import { clsx } from 'clsx';
import { useAuth } from '@/context/AuthContext';
import GastosTable from '../components/tables/GastosTable';
import GastoModal from '../components/modals/GastoModal';
import type { Expense } from '../components/tables/GastosTable';

type SortField = 'created_at' | 'amount' | 'description';
type SortDir = 'asc' | 'desc';

const GastosPage = () => {
  const { showNotification } = useNotification();
  const { activeStoreId } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
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

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const loadExpenses = useCallback(async () => {
    if (!activeStoreId) return;
    setIsLoading(true);
    try {
      const data = await invoke<Expense[]>('get_all_expenses', { storeId: activeStoreId });
      setExpenses(data);
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'No se pudieron cargar los gastos');
    } finally {
      setIsLoading(false);
    }
  }, [activeStoreId, showNotification]);

  useEffect(() => {
    if (activeStoreId) {
      loadExpenses();
    }
  }, [activeStoreId, loadExpenses]);

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
    try {
      await invoke('delete_expense', { id });
      showNotification('success', 'Éxito', 'Gasto eliminado correctamente');
      loadExpenses();
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'Error al eliminar el gasto');
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const openNewExpense = () => {
    setEditingExpense(null);
    setIsModalOpen(true);
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

  const handleExport = () => {
    try {
      const headers = ['Fecha', 'Descripción', 'Proveedor', 'Categoría', 'Método de Pago', 'Monto'];
      const rows = filteredExpenses.map(e => [
        new Date(e.created_at).toLocaleDateString('es-PE'),
        e.description,
        e.supplier || '',
        e.category || '',
        e.payment_method === 'cash' ? 'Efectivo' : 'Virtual',
        e.amount.toFixed(2),
      ]);
      const csv = [headers, ...rows]
        .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gastos_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showNotification('success', 'Exportación exitosa', 'El archivo CSV ha sido descargado correctamente.');
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'No se pudo exportar el archivo CSV.');
    }
  };

  // ─── Filter & Sort Logic ──────────────────────────────────
  const filteredExpenses = useMemo(() => {
    let result = expenses.filter(e => {
      const searchLower = search.toLowerCase();
      const matchSearch = !search
        || e.description.toLowerCase().includes(searchLower)
        || (e.supplier?.toLowerCase().includes(searchLower))
        || (e.category?.toLowerCase().includes(searchLower));

      const matchCategory = filterCategory === 'all' || e.category === filterCategory;

      const expenseDate = new Date(e.created_at);
      const matchDateFrom = !dateFrom || expenseDate >= new Date(dateFrom + 'T00:00:00');
      const matchDateTo = !dateTo || expenseDate <= new Date(dateTo + 'T23:59:59');

      return matchSearch && matchCategory && matchDateFrom && matchDateTo;
    });

    result = result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'amount') cmp = a.amount - b.amount;
      else if (sortField === 'description') cmp = a.description.localeCompare(b.description);
      else if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [expenses, search, filterCategory, dateFrom, dateTo, sortField, sortDir]);

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const sortOptions: { label: string; field: SortField }[] = [
    { label: 'Fecha', field: 'created_at' },
    { label: 'Monto', field: 'amount' },
    { label: 'Descripción', field: 'description' },
  ];

  const totalGastosFiltrados = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const categories = ['Mercadería', 'Servicios', 'Alquiler', 'Transporte', 'Sueldos', 'Mantenimiento', 'Impuestos', 'Otros'];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos por Mercadería</h1>
          <p className="text-gray-500">Registro y control de todos los gastos</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all active:scale-95"
          >
            <Download className="w-5 h-5" />
            Exportar
          </button>
          <button
            onClick={openNewExpense}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nuevo Gasto
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {filteredExpenses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-xl">
              <Receipt className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Gastos</p>
              <p className="text-xl font-bold text-gray-900">{filteredExpenses.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-xl">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monto Total</p>
              <p className="text-xl font-bold text-gray-900">S/ {totalGastosFiltrados.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Promedio por Gasto</p>
              <p className="text-xl font-bold text-gray-900">
                S/ {filteredExpenses.length > 0 ? (totalGastosFiltrados / filteredExpenses.length).toFixed(2) : '0.00'}
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
                placeholder="Buscar por descripción, proveedor..."
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
                    (filterCategory !== 'all') ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Filter className="w-4 h-4" />
                  Filtros
                  {filterCategory !== 'all' && (
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showFilterMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-xl z-30 p-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase px-3 py-2 tracking-wider">Categoría</p>
                    {[
                      { value: 'all', label: 'Todas' },
                      ...categories.map(c => ({ value: c, label: c })),
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setFilterCategory(opt.value); setCurrentPage(1); setShowFilterMenu(false); }}
                        className={clsx(
                          'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between',
                          filterCategory === opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        {opt.label}
                        {filterCategory === opt.value && <Check className="w-4 h-4" />}
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
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
                className="pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              />
              <span className="text-gray-400 self-center text-sm hidden sm:block">—</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
                className="pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              />
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
        <GastosTable
          expenses={paginatedExpenses}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <span>Mostrando {paginatedExpenses.length} de {filteredExpenses.length} gastos</span>
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

      <GastoModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={loadExpenses}
        initialData={editingExpense}
        storeId={activeStoreId}
      />
    </div>
  );
};

export default GastosPage;
