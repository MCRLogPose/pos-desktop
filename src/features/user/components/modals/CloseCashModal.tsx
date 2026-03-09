import React, { useState } from 'react';
import { FileText, X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useCash } from '@/context/CashContext';
import { useAuth } from '@/context/AuthContext';
import { clsx } from 'clsx';

interface CloseCashModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CloseCashModal: React.FC<CloseCashModalProps> = ({ isOpen, onClose }) => {
    const { activeSession, closeSession } = useCash();
    const { logout } = useAuth();
    const [realCash, setRealCash] = useState(0);
    const [realVirtual, setRealVirtual] = useState(0);
    const [justification, setJustification] = useState('');

    React.useEffect(() => {
        if (isOpen && activeSession) {
            setRealVirtual(parseFloat(activeSession.expected_closing_virtual.toFixed(2)));
            setRealCash(0);
            setJustification('');
        }
    }, [isOpen, activeSession]);

    if (!isOpen || !activeSession) return null;

    const totalExpected = activeSession.expected_closing_cash + activeSession.expected_closing_virtual;
    const totalReal = realCash + realVirtual;
    const difference = totalReal - totalExpected;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await closeSession(realCash, realVirtual, justification);
            onClose();
            logout();
        } catch (error) {
            console.error('Failed to close session:', error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 rounded-xl text-white">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Corte de Caja</h2>
                            <p className="text-xs text-gray-500">Resume y cierra el turno actual</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-0 flex flex-col md:flex-row">
                    {/* Summary Section */}
                    <div className="flex-1 p-6 bg-gray-50/50 border-r border-gray-100">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Resumen del Sistema</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                <span className="text-sm text-gray-600">Efectivo Apertura</span>
                                <span className="font-semibold text-gray-900">S/ {activeSession.opening_cash.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                <span className="text-sm text-gray-600">Ventas y Otros (Efectivo)</span>
                                <span className="font-semibold text-green-600">+ S/ {(activeSession.expected_closing_cash - activeSession.opening_cash).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                <span className="text-sm text-gray-600">Total Esperado (Efectivo)</span>
                                <span className="font-bold text-gray-900 text-lg">S/ {activeSession.expected_closing_cash.toFixed(2)}</span>
                            </div>
                            <hr className="border-dashed" />
                            <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100">
                                <span className="text-sm text-gray-600">Total Esperado (Virtual)</span>
                                <span className="font-bold text-gray-900 text-lg">S/ {activeSession.expected_closing_virtual.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-slate-900 rounded-2xl text-white shadow-xl">
                            <p className="text-xs text-slate-400 mb-1">Total General Esperado</p>
                            <h4 className="text-2xl font-bold">S/ {totalExpected.toFixed(2)}</h4>
                        </div>
                    </div>

                    {/* Input Section */}
                    <div className="flex-1 p-6 space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Validación Física</h3>
                        
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Efectivo Real en Caja</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">S/</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={realCash || ''}
                                    placeholder="0.00"
                                    onChange={(e) => setRealCash(parseFloat(e.target.value) || 0)}
                                    className="w-full pl-10 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none transition-all text-2xl font-black text-slate-900"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-500 uppercase tracking-tight ml-1">Virtual Real (Bancos/App)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">S/</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={realVirtual || ''}
                                    placeholder="0.00"
                                    onChange={(e) => setRealVirtual(parseFloat(e.target.value) || 0)}
                                    className="w-full pl-10 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none transition-all text-2xl font-black text-slate-900"
                                />
                            </div>
                        </div>

                        <div className={clsx(
                            "p-4 rounded-2xl flex items-center justify-between",
                            difference === 0 ? "bg-green-50 text-green-700 border border-green-100" :
                            difference > 0 ? "bg-blue-50 text-blue-700 border border-blue-100" :
                            "bg-red-50 text-red-700 border border-red-100"
                        )}>
                            <div className="flex items-center gap-2">
                                {difference === 0 ? <Minus /> : difference > 0 ? <TrendingUp /> : <TrendingDown />}
                                <span className="text-sm font-bold">Diferencia</span>
                            </div>
                            <span className="text-lg font-black">S/ {difference.toFixed(2)}</span>
                        </div>

                        {difference !== 0 && (
                            <div className="space-y-1.5 animate-in slide-in-from-top duration-300">
                                <label className="text-sm font-medium text-slate-900">Justificación</label>
                                <textarea
                                    required
                                    value={justification}
                                    onChange={(e) => setJustification(e.target.value)}
                                    placeholder="Explica la diferencia detectada..."
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition-all text-sm min-h-[80px]"
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full py-4 mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                        >
                            Finalizar Turno y Cerrar Caja
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CloseCashModal;
