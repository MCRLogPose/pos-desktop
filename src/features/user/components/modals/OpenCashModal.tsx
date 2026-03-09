import React, { useState } from 'react';
import { Wallet, AlertCircle } from 'lucide-react';
import { useCash } from '@/context/CashContext';

interface OpenCashModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const OpenCashModal: React.FC<OpenCashModalProps> = ({ isOpen, onClose }) => {
    const { openSession, lastClosedSession } = useCash();
    const [cash, setCash] = useState(lastClosedSession?.real_closing_cash || 0);
    const [virtual, setVirtual] = useState(lastClosedSession?.real_closing_virtual || 0);
    const [justification, setJustification] = useState('');

    if (!isOpen) return null;

    const needsJustification = lastClosedSession && (
        cash !== lastClosedSession.real_closing_cash || 
        virtual !== lastClosedSession.real_closing_virtual
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await openSession(cash, virtual);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-green-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-xl text-green-600">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Apertura de Caja</h2>
                            <p className="text-xs text-gray-500">Inicia el turno con el saldo inicial</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {lastClosedSession && (
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-blue-700">
                                <p className="font-semibold mb-1">Último cierre:</p>
                                <p>Efectivo: S/ {lastClosedSession.real_closing_cash?.toFixed(2)}</p>
                                <p>Virtual: S/ {lastClosedSession.real_closing_virtual?.toFixed(2)}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Efectivo Inicial</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">S/</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={cash}
                                    onChange={(e) => setCash(parseFloat(e.target.value) || 0)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all font-semibold"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Virtual Inicial</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">S/</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={virtual}
                                    onChange={(e) => setVirtual(parseFloat(e.target.value) || 0)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all font-semibold"
                                />
                            </div>
                        </div>
                    </div>

                    {needsJustification && (
                        <div className="space-y-1.5 animate-in slide-in-from-top duration-300">
                            <label className="text-sm font-medium text-red-600 flex items-center gap-1.5">
                                <AlertCircle className="w-4 h-4" />
                                Justificación del Cambio
                            </label>
                            <textarea
                                required
                                value={justification}
                                onChange={(e) => setJustification(e.target.value)}
                                placeholder="Explica por qué el saldo inicial es diferente al cierre anterior..."
                                className="w-full p-3 bg-red-50/30 border border-red-100 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all text-sm min-h-[80px]"
                            />
                        </div>
                    )}

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
                            className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-green-600/20 active:scale-[0.98]"
                        >
                            Abrir Caja
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OpenCashModal;
