import { useState, useEffect } from 'react';
import { X, Receipt, DollarSign, Tag, User, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from '@/context/NotificationContext';

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

interface GastoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  initialData?: Expense | null;
  storeId?: number | null;
}

const CATEGORIES = [
  'Mercadería',
  'Servicios',
  'Alquiler',
  'Transporte',
  'Sueldos',
  'Mantenimiento',
  'Impuestos',
  'Otros',
];

export default function GastoModal({ isOpen, onClose, onSubmit, initialData, storeId }: GastoModalProps) {
  const { showNotification } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [category, setCategory] = useState('Mercadería');
  const [supplier, setSupplier] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDescription(initialData.description);
        setAmount(initialData.amount.toString());
        setPaymentMethod(initialData.payment_method);
        setCategory(initialData.category || 'Mercadería');
        setSupplier(initialData.supplier || '');
      } else {
        setDescription('');
        setAmount('');
        setPaymentMethod('cash');
        setCategory('Mercadería');
        setSupplier('');
      }
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      showNotification('warning', 'Faltan datos', 'La descripción es obligatoria');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showNotification('warning', 'Faltan datos', 'El monto debe ser mayor a 0');
      return;
    }

    setIsSubmitting(true);
    try {
      if (initialData) {
        await invoke('update_expense', {
          payload: {
            id: initialData.id,
            description: description.trim(),
            amount: parsedAmount,
            paymentMethod,
            category,
            supplier: supplier.trim() || null,
          },
        });
        showNotification('success', 'Éxito', 'Gasto actualizado correctamente');
      } else {
        if (!storeId) {
          showNotification('error', 'Error', 'No hay tienda seleccionada');
          return;
        }
        await invoke('add_expense_standalone', {
          description: description.trim(),
          amount: parsedAmount,
          paymentMethod,
          category,
          supplier: supplier.trim() || null,
          storeId,
        });
        showNotification('success', 'Éxito', 'Gasto registrado correctamente');
      }
      onSubmit();
      onClose();
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', initialData ? 'Error al actualizar el gasto' : 'Error al registrar el gasto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg pointer-events-auto overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-xl">
                    <Receipt className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {initialData ? 'Editar Gasto' : 'Nuevo Gasto'}
                  </h3>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Descripción */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Descripción *</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ej. Compra de mercadería"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Monto */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Monto (S/) *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-red-600"
                    />
                  </div>
                </div>

                {/* Método de pago y Categoría */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Método de Pago</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm"
                      >
                        <option value="cash">Efectivo</option>
                        <option value="virtual">Virtual</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Categoría</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Proveedor */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Proveedor (Opcional)</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Nombre del proveedor"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {initialData ? 'Actualizar' : 'Registrar Gasto'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
