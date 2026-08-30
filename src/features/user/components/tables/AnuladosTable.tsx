import { XCircle } from 'lucide-react';
import { clsx } from 'clsx';

export interface VentaAnulada {
  id: number;
  order_id?: number | null;
  store_id: number;
  reason: string;
  payment_method: string;
  subtotal: number;
  igv: number;
  total: number;
  cancelled_by?: string | null;
  cancelled_at: string;
}

interface AnuladosTableProps {
  anulaciones: VentaAnulada[];
  isLoading: boolean;
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

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const AnuladosTable = ({ anulaciones, isLoading }: AnuladosTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50/50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Anulación</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Motivo</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Método</th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Anulado por</th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {isLoading ? (
            <tr>
              <td colSpan={6} className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm">Cargando anulaciones...</p>
                </div>
              </td>
            </tr>
          ) : anulaciones.length > 0 ? (
            anulaciones.map(a => (
              <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <XCircle className="w-4 h-4 text-red-500" />
                    </div>
                    <span className="font-semibold text-gray-900">#{a.id}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{formatDateTime(a.cancelled_at)}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-700 max-w-[260px] truncate" title={a.reason}>{a.reason}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={clsx(
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                    paymentMethodColor(a.payment_method)
                  )}>
                    {paymentMethodLabel(a.payment_method)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-700">{a.cancelled_by || '—'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="font-bold text-gray-900">S/ {a.total.toFixed(2)}</span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="px-6 py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <XCircle className="w-12 h-12 opacity-20" />
                  <p className="font-medium">No hay anulaciones registradas</p>
                  <p className="text-sm">Las ventas que se anulen aparecerán aquí</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AnuladosTable;
