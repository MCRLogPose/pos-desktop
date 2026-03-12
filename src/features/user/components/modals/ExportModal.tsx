import { useState } from 'react';
import { Download, X, Check } from 'lucide-react';
import { clsx } from 'clsx';

export type ExportFormat = 'items_csv' | 'orders_csv' | 'pdf';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (format: ExportFormat) => void;
}

const ExportModal = ({ isOpen, onClose, onConfirm }: ExportModalProps) => {
  const [selected, setSelected] = useState<ExportFormat>('items_csv');

  if (!isOpen) return null;

  const options: { value: ExportFormat; label: string; desc: string; color: string; badge: string }[] = [
    {
      value: 'items_csv',
      label: 'Detalle de Prendas',
      desc: 'Una fila por prenda vendida con datos de la orden',
      color: 'border-green-500 bg-green-50',
      badge: 'CSV',
    },
    {
      value: 'orders_csv',
      label: 'Resumen de Órdenes',
      desc: 'Una fila por venta con totales (tabla actual)',
      color: 'border-blue-500 bg-blue-50',
      badge: 'CSV',
    },
    {
      value: 'pdf',
      label: 'Archivo PDF',
      desc: 'Listo para imprimir o compartir (próximamente)',
      color: 'border-red-400 bg-red-50',
      badge: 'PDF',
    },
  ];

  const activeColor = selected === 'items_csv'
    ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20'
    : selected === 'orders_csv'
    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
    : 'bg-red-600 hover:bg-red-700 shadow-red-600/20';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Exportar Ventas</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="p-5 space-y-2.5">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Selecciona el formato</p>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={clsx(
                'w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left',
                selected === opt.value ? opt.color : 'border-gray-200 hover:border-gray-300 bg-white'
              )}
            >
              <div className={clsx(
                'w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors',
                selected === opt.value
                  ? opt.value === 'items_csv' ? 'bg-green-600 text-white'
                    : opt.value === 'orders_csv' ? 'bg-blue-600 text-white'
                    : 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-500'
              )}>
                {opt.badge}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{opt.label}</p>
                <p className="text-xs text-gray-500 leading-snug">{opt.desc}</p>
              </div>
              <div className={clsx(
                'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                selected === opt.value
                  ? opt.value === 'items_csv' ? 'border-green-600 bg-green-600'
                    : opt.value === 'orders_csv' ? 'border-blue-600 bg-blue-600'
                    : 'border-red-500 bg-red-500'
                  : 'border-gray-300'
              )}>
                {selected === opt.value && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className={clsx('flex-1 py-2.5 rounded-xl text-white font-medium transition-colors shadow-lg', activeColor)}
          >
            Exportar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
