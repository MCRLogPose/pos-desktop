import React, { useState } from 'react';
import { Plus, Wallet, CreditCard, ReceiptText } from 'lucide-react';
import { useCash } from '@/context/CashContext';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from '@/context/NotificationContext';
import { clsx } from 'clsx';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'income' | 'expense';
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, type }) => {
    const { activeSession, refreshSession } = useCash();
    const { showNotification } = useNotification();
    const [amount, setAmount] = useState(0);
    const [description, setDescription] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'virtual'>('cash');
    const [isLoading, setIsLoading] = useState(false);

    // Reset state when modal is opened/closed
    React.useEffect(() => {
        if (!isOpen) {
            setAmount(0);
            setDescription('');
            setPaymentMethod('cash');
        }
    }, [isOpen]);

    if (!isOpen || !activeSession) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) return;
        
        setIsLoading(true);
        try {
            const command = type === 'income' ? 'add_cash_other_income' : 'add_cash_expense';
            await invoke(command, {
                sessionId: activeSession.id,
                description,
                amount,
                paymentMethod,
            });
            
            showNotification(
                type === 'income' ? 'success' : 'warning', 
                type === 'income' ? 'Ingreso Registrado' : 'Gasto Registrado', 
                `Se ha registrado el ${type === 'income' ? 'ingreso' : 'gasto'} de S/ ${amount.toFixed(2)}`
            );
            
            await refreshSession();
            onClose();
        } catch (error) {
            showNotification('error', 'Error', String(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className={clsx(
                    "p-6 border-b border-gray-100 flex justify-between items-center",
                    type === 'income' ? "bg-green-50/50 text-green-700" : "bg-red-50/50 text-red-700"
                )}>
                    <div className="flex items-center gap-3">
                        <div className={clsx(
                            "p-2 rounded-xl",
                            type === 'income' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                        )}>
                            <Plus className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{type === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto'}</h2>
                            <p className="text-xs opacity-70">Afecta el saldo de la caja actual</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Monto</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1-2 text-gray-400 font-medium">S/</span>
                            <input
                                type="number"
                                step="0.01"
                                required
                                autoFocus
                                value={amount || ''}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all font-bold text-lg"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Descripción / Concepto</label>
                        <div className="relative">
                            <ReceiptText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                            <textarea
                                required
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ej: Pago de luz, Venta de chatarra, etc."
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-sm min-h-[80px]"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Método de Pago</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('cash')}
                                className={clsx(
                                    "flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-medium",
                                    paymentMethod === 'cash' 
                                        ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10" 
                                        : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"
                                )}
                            >
                                <Wallet className="w-4 h-4" />
                                Efectivo
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentMethod('virtual')}
                                className={clsx(
                                    "flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all font-medium",
                                    paymentMethod === 'virtual' 
                                        ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10" 
                                        : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"
                                )}
                            >
                                <CreditCard className="w-4 h-4" />
                                Virtual
                            </button>
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 text-gray-600 font-semibold hover:bg-gray-100 rounded-2xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={clsx(
                                "flex-1 py-3 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50",
                                type === 'income' ? "bg-green-600 hover:bg-green-700 shadow-green-600/20" : "bg-red-600 hover:bg-red-700 shadow-red-600/20"
                            )}
                        >
                            {isLoading ? 'Registrando...' : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TransactionModal;
