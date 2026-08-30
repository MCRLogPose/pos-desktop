import { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Sale } from './SaleDetailModal';

interface AnularVentaModalProps {
  sale: Sale | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

const AnularVentaModal = ({ sale, onClose, onConfirm }: AnularVentaModalProps) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!sale) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Debes indicar el motivo de la anulación.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-red-100 bg-red-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Anular venta #{sale.id}</h2>
              <p className="text-xs text-gray-500">
                Total: S/ {sale.total.toFixed(2)} · {new Date(sale.created_at).toLocaleString('es-PE')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="text-sm text-gray-600 leading-relaxed">
            Esta acción <span className="font-semibold text-gray-900">eliminará la venta de forma permanente</span> y
            devolverá el stock de los productos vendidos. Solo podrás anularla si aún no fue sincronizada a la Primary.
            El registro quedará en el historial de anulaciones con el motivo que indiques.
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Motivo de anulación <span className="text-red-500">*</span>
            </span>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); setError(''); }}
              rows={3}
              autoFocus
              placeholder="Ej: el cliente se retractó / error en la venta..."
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
            Anular venta
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnularVentaModal;
