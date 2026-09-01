import React, { useState, useEffect } from 'react';
import { FileText, X, ShoppingBag, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useCash } from '@/context/CashContext';
import { useAuth } from '@/context/AuthContext';
import { invoke } from '@tauri-apps/api/core';
import SummaryCard from '../finance/SummaryCard';

interface Transaction {
    id: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
    description: string;
    created_at: string;
    payment_method: string;
}

interface CloseCashModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CloseCashModal: React.FC<CloseCashModalProps> = ({ isOpen, onClose }) => {
    const { activeSession, closeSession } = useCash();
    const { logout } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [paymentTotals, setPaymentTotals] = useState({ cash: 0, yape: 0, card: 0 });

    const loadData = async () => {
        if (!activeSession) return;
        try {
            const [txData, payData] = await Promise.all([
                invoke<Transaction[]>('get_cash_session_transactions', { sessionId: activeSession.id }),
                invoke<{ payment_method: string; amount: number }[]>('get_session_payment_summary', { sessionId: activeSession.id }),
            ]);
            setTransactions(txData);
            const totals = { cash: 0, yape: 0, card: 0 };
            payData.forEach(d => {
                if (d.payment_method === 'cash') totals.cash = d.amount;
                else if (d.payment_method === 'yape') totals.yape = d.amount;
                else totals.card += d.amount;
            });
            setPaymentTotals(totals);
        } catch (error) {
            console.error('Failed to load close cash data:', error);
        }
    };

    useEffect(() => {
        if (isOpen && activeSession) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, activeSession]);

    if (!isOpen || !activeSession) return null;

    const ventasEfectivo = paymentTotals.cash;
    const ventasVirtual = paymentTotals.yape + paymentTotals.card;
    const totalVentas = ventasEfectivo + ventasVirtual;

    const ingresosEfectivo = transactions.filter(t => t.type === 'income' && t.payment_method === 'cash').reduce((acc, c) => acc + c.amount, 0);
    const ingresosVirtual = transactions.filter(t => t.type === 'income' && (t.payment_method === 'virtual' || t.payment_method === 'yape' || t.payment_method === 'card')).reduce((acc, c) => acc + c.amount, 0);
    const totalIngresos = ingresosEfectivo + ingresosVirtual;

    const salidasEfectivo = transactions.filter(t => t.type === 'expense' && t.payment_method === 'cash').reduce((acc, c) => acc + c.amount, 0);
    const salidasVirtual = transactions.filter(t => t.type === 'expense' && (t.payment_method === 'virtual' || t.payment_method === 'yape' || t.payment_method === 'card')).reduce((acc, c) => acc + c.amount, 0);
    const totalSalidas = salidasEfectivo + salidasVirtual;

    const totalEsperado = activeSession.expected_closing_cash + activeSession.expected_closing_virtual;

    const handleCloseCash = async () => {
        try {
            await closeSession(activeSession.expected_closing_cash, activeSession.expected_closing_virtual);
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
                            <p className="text-xs text-gray-500">Información para el cuadre físico del turno</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
                    <SummaryCard
                        title="Ventas del Turno"
                        icon={<ShoppingBag className="w-5 h-5" />}
                        accentClass="bg-blue-50 text-blue-600"
                        rows={[
                            { label: 'Efectivo', value: `S/ ${ventasEfectivo.toFixed(2)}` },
                            { label: 'Yape', value: `S/ ${paymentTotals.yape.toFixed(2)}` },
                            { label: 'Tarjeta', value: `S/ ${paymentTotals.card.toFixed(2)}` },
                        ]}
                        footer={{ label: 'Total Ventas', value: `S/ ${totalVentas.toFixed(2)}`, valueClass: 'text-blue-600' }}
                    />

                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <SummaryCard
                                title="Otros Ingresos"
                                icon={<ArrowUpRight className="w-5 h-5" />}
                                accentClass="bg-green-50 text-green-600"
                                rows={[
                                    { label: 'Efectivo', value: `S/ ${ingresosEfectivo.toFixed(2)}` },
                                    { label: 'Virtual', value: `S/ ${ingresosVirtual.toFixed(2)}` },
                                ]}
                                footer={{ label: 'Total Ingresos', value: `S/ ${totalIngresos.toFixed(2)}`, valueClass: 'text-green-600' }}
                            />
                        </div>
                        <div className="flex-1">
                            <SummaryCard
                                title="Salidas / Gastos"
                                icon={<ArrowDownRight className="w-5 h-5" />}
                                accentClass="bg-red-50 text-red-600"
                                rows={[
                                    { label: 'Efectivo', value: `S/ ${salidasEfectivo.toFixed(2)}` },
                                    { label: 'Virtual', value: `S/ ${salidasVirtual.toFixed(2)}` },
                                ]}
                                footer={{ label: 'Total Salidas', value: `S/ ${totalSalidas.toFixed(2)}`, valueClass: 'text-red-500' }}
                            />
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-2xl text-white p-5 shadow-xl">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3">Cuadre Esperado</p>
                        <div className="space-y-2.5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-300">Apertura Efectivo</span>
                                <span className="font-semibold tabular-nums">S/ {activeSession.opening_cash.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-300">Apertura Virtual</span>
                                <span className="font-semibold tabular-nums">S/ {activeSession.opening_virtual.toFixed(2)}</span>
                            </div>
                            <hr className="border-slate-700" />
                            <div className="flex justify-between">
                                <span className="text-slate-300">Esperado Efectivo</span>
                                <span className="font-bold text-green-400 tabular-nums">S/ {activeSession.expected_closing_cash.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-300">Esperado Virtual</span>
                                <span className="font-bold text-blue-400 tabular-nums">S/ {activeSession.expected_closing_virtual.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total General Esperado</span>
                            <span className="text-2xl font-black tabular-nums">S/ {totalEsperado.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 bg-slate-50/70">
                    <button
                        onClick={handleCloseCash}
                        className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                    >
                        Cerrar Caja y Finalizar Turno
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloseCashModal;