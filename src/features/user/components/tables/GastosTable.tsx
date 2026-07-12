import { Edit, Trash2, Receipt, User } from 'lucide-react';
import { clsx } from 'clsx';

interface Expense {
  id: number;
  uuid: string;
  cash_session_id: number | null;
  description: string;
  amount: number;
  payment_method: string;
  category: string | null;
  supplier: string | null;
  store_id: number | null;
  created_at: string;
}

interface GastosTableProps {
  expenses: Expense[];
  isLoading: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: number) => void;
}

const paymentMethodLabel = (method: string) => {
  switch (method) {
    case 'cash': return 'Efectivo';
    case 'virtual': return 'Virtual';
    default: return method;
  }
};

const paymentMethodColor = (method: string) => {
  switch (method) {
    case 'cash': return 'bg-green-100 text-green-700';
    case 'virtual': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const categoryColor = (category: string | null) => {
  switch (category) {
    case 'Mercadería': return 'bg-orange-100 text-orange-700';
    case 'Servicios': return 'bg-purple-100 text-purple-700';
    case 'Alquiler': return 'bg-yellow-100 text-yellow-700';
    case 'Transporte': return 'bg-cyan-100 text-cyan-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
};

const GastosTable = ({ expenses, isLoading, onEdit, onDelete }: GastosTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50/50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Proveedor</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoría</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Método</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {isLoading ? (
            <tr>
              <td colSpan={7} className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm">Cargando gastos...</p>
                </div>
              </td>
            </tr>
          ) : expenses.length > 0 ? (
            expenses.map(expense => (
              <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{formatDate(expense.created_at)}</div>
                  <div className="text-xs text-gray-400">{formatTime(expense.created_at)}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4 text-red-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{expense.description}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {expense.supplier ? (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm text-gray-700">{expense.supplier}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {expense.category ? (
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      categoryColor(expense.category)
                    )}>
                      {expense.category}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={clsx(
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                    paymentMethodColor(expense.payment_method)
                  )}>
                    {paymentMethodLabel(expense.payment_method)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="font-bold text-red-600">S/ {expense.amount.toFixed(2)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit(expense)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(expense.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <Receipt className="w-12 h-12 opacity-20" />
                  <p className="font-medium">No se encontraron gastos</p>
                  <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default GastosTable;
export type { Expense };
