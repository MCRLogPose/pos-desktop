import { Eye, ShoppingBag } from 'lucide-react';
import { clsx } from 'clsx';
import type { Sale } from '../modals/SaleDetailModal';

interface SalesTableProps {
  sales: Sale[];
  isLoading: boolean;
  onViewDetail: (sale: Sale) => void;
}

const paymentMethodLabel = (method: string) => {
  switch (method) {
    case 'cash': return 'Efectivo';
    case 'card': return 'Tarjeta';
    case 'yape': return 'Yape';
    default: return method;
  }
};

const paymentMethodColor = (method: string) => {
  switch (method) {
    case 'cash': return 'bg-green-100 text-green-700';
    case 'card': return 'bg-blue-100 text-blue-700';
    case 'yape': return 'bg-purple-100 text-purple-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const SalesTable = ({ sales, isLoading, onViewDetail }: SalesTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50/50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Venta</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Método</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {isLoading ? (
            <tr>
              <td colSpan={6} className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm">Cargando ventas...</p>
                </div>
              </td>
            </tr>
          ) : sales.length > 0 ? (
            sales.map(sale => (
              <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4 text-indigo-600" />
                    </div>
                    <span className="font-semibold text-gray-900">#{sale.id}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{formatDate(sale.created_at)}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(sale.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{sale.client_name || 'Cliente general'}</div>
                  {sale.client_document && (
                    <div className="text-xs text-gray-400">Doc: {sale.client_document}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={clsx(
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                    paymentMethodColor(sale.payment_method)
                  )}>
                    {paymentMethodLabel(sale.payment_method)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="font-bold text-gray-900">S/ {sale.total.toFixed(2)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={() => onViewDetail(sale)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Detalles
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <ShoppingBag className="w-12 h-12 opacity-20" />
                  <p className="font-medium">No se encontraron ventas</p>
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

export default SalesTable;
