import { FileText, X } from 'lucide-react';
import { clsx } from 'clsx';

interface SaleItem {
  id: number;
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

interface Sale {
  id: number;
  user_id: number;
  user_name?: string | null;
  client_document?: string | null;
  client_phone?: string | null;
  client_name?: string | null;
  payment_method: string;
  subtotal: number;
  igv: number;
  total: number;
  created_at: string;
  items?: SaleItem[];
}

interface SaleDetailModalProps {
  sale: Sale | null;
  onClose: () => void;
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

const SaleDetailModal = ({ sale, onClose }: SaleDetailModalProps) => {
  if (!sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Venta #{sale.id}</h2>
              <p className="text-xs text-gray-500">{formatDateTime(sale.created_at)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Client & Payment Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</p>
              <p className="font-medium text-gray-900">{sale.client_name || 'Sin nombre'}</p>
              {sale.client_document && (
                <p className="text-sm text-gray-500">Doc: {sale.client_document}</p>
              )}
              {sale.client_phone && (
                <p className="text-sm text-gray-500">Tel: {sale.client_phone}</p>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pago</p>
              <span className={clsx(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                paymentMethodColor(sale.payment_method)
              )}>
                {paymentMethodLabel(sale.payment_method)}
              </span>
              {sale.user_name && (
                <p className="text-sm text-gray-500">Vendedor: {sale.user_name}</p>
              )}
            </div>
          </div>

          {/* Items Table */}
          {sale.items && sale.items.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Productos</p>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Producto</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Cant.</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">P. Unit.</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sale.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-gray-900">{item.product_name}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-600">S/ {item.unit_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">S/ {item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal (sin IGV)</span>
              <span>S/ {sale.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>IGV (18%)</span>
              <span>S/ {sale.igv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-blue-600">S/ {sale.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaleDetailModal;
export type { Sale, SaleItem };
