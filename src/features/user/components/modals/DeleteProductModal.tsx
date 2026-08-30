import { useState } from 'react';
import { AlertTriangle, X, Loader2, Package, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface DeleteProduct {
  id: number;
  name: string;
  code: string | null;
  category_name: string | null;
  price: number;
  stock: number;
  unit: string | null;
}

interface DeleteProductModalProps {
  product: DeleteProduct | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const DeleteProductModal = ({ product, onClose, onConfirm }: DeleteProductModalProps) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!product) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Debes indicar el motivo de la eliminación.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-red-100 bg-red-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Eliminar producto</h2>
              <p className="text-xs text-gray-500">
                Esta acción no se puede deshacer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Product info card */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="p-2 bg-white rounded-lg border border-gray-100 text-blue-600 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 truncate">{product.name}</div>
              <div className="text-xs text-gray-500 flex flex-wrap gap-x-3">
                {product.code && <span>{product.code}</span>}
                {product.category_name && <span>{product.category_name}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono font-bold text-gray-900">S/ {product.price.toFixed(2)}</div>
              <div className="text-xs text-gray-500">Stock: {product.stock} {product.unit || 'Ud'}</div>
            </div>
          </div>

          <div className="text-sm text-gray-600 leading-relaxed">
            Al eliminar este producto se ocultará del inventario y dejará de estar disponible
            en el punto de venta. Los productos vendidos previamente no se verán afectados.
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Solo los <span className="font-semibold">administradores</span> pueden eliminar productos del inventario.
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Motivo de eliminación <span className="text-red-500">*</span>
            </span>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); setError(''); }}
              rows={3}
              autoFocus
              placeholder="Ej: producto en mal estado / se dejó de vender..."
              className="mt-1.5 w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-sm resize-none"
            />
          </label>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-medium transition-colors shadow-lg',
              'bg-red-600 hover:bg-red-700 disabled:opacity-60'
            )}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Eliminar producto
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteProductModal;