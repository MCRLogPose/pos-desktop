import { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight, ArrowDownRight, Plus, FileText, Wallet, Clock, CreditCard, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { useCash, type CashSession } from '@/context/CashContext';
import { invoke } from '@tauri-apps/api/core';
import OpenCashModal from '../components/modals/OpenCashModal';
import CloseCashModal from '../components/modals/CloseCashModal';
import TransactionModal from '../components/modals/TransactionModal';
import { useAuth } from '@/context/AuthContext';

interface Transaction {
    id: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
    description: string;
    created_at: string;
    payment_method: 'cash' | 'virtual';
}

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
        return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

const formatTime = (dateStr: string) => {
    try {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return dateStr;
    }
};

const FinancePage = () => {
    const { activeStoreId } = useAuth();
    const { activeSession } = useCash();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [sessions, setSessions] = useState<CashSession[]>([]);
    const [viewIndex, setViewIndex] = useState(0);

    const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [transactionModal, setTransactionModal] = useState<{isOpen: boolean, type: 'income' | 'expense'}>({
        isOpen: false,
        type: 'income'
    });

    // Historial de cajas: indice 0 = mas reciente (caja actual si hay una abierta)
    const loadSessions = useCallback(async () => {
        if (!activeStoreId) return;
        try {
            const data = await invoke<CashSession[]>('get_cash_sessions', { storeId: activeStoreId });
            setSessions(data);
            setViewIndex(0);
        } catch (error) {
            console.error('Failed to fetch cash sessions:', error);
        }
    }, [activeStoreId]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions, activeSession]);

    const viewedSession = sessions.length > 0 ? sessions[Math.min(viewIndex, sessions.length - 1)] : null;
    const isViewingActive = !!viewedSession && viewedSession.id === activeSession?.id;

    const fetchTransactions = async () => {
        if (!viewedSession) {
            setTransactions([]);
            return;
        }
        try {
            const data = await invoke<Transaction[]>('get_cash_session_transactions', { sessionId: viewedSession.id });
            setTransactions(data);
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [viewedSession?.id]);

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);

    const totalIncomeCash = transactions.filter(t => t.type === 'income' && t.payment_method === 'cash').reduce((acc, curr) => acc + curr.amount, 0);
    const totalIncomeVirtual = transactions.filter(t => t.type === 'income' && (t.payment_method as string === 'virtual' || t.payment_method as string === 'yape' || t.payment_method as string === 'card')).reduce((acc, curr) => acc + curr.amount, 0);
    
    const totalExpensesCash = transactions.filter(t => t.type === 'expense' && t.payment_method === 'cash').reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpensesVirtual = transactions.filter(t => t.type === 'expense' && (t.payment_method as string === 'virtual' || t.payment_method as string === 'yape' || t.payment_method as string === 'card')).reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
                    <p className="text-gray-500">Control de caja y movimientos</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Navegacion entre cajas: < anterior | volver a actual | > siguiente */}
                    <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <button
                            onClick={() => setViewIndex(i => Math.min(i + 1, sessions.length - 1))}
                            disabled={sessions.length === 0 || viewIndex >= sessions.length - 1}
                            title="Caja anterior"
                            className="p-2.5 text-gray-500 hover:bg-gray-100 hover:text-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewIndex(0)}
                            disabled={viewIndex === 0 || sessions.length === 0}
                            title={activeSession ? 'Volver a la caja actual' : 'Volver a la caja más reciente'}
                            className="p-2.5 text-blue-600 hover:bg-blue-50 transition-colors border-x border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed relative"
                        >
                            <RotateCcw className="w-4 h-4" />
                            {isViewingActive && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                        </button>
                        <button
                            onClick={() => setViewIndex(i => Math.max(i - 1, 0))}
                            disabled={viewIndex === 0}
                            title="Caja siguiente"
                            className="p-2.5 text-gray-500 hover:bg-gray-100 hover:text-slate-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                    {!activeSession ? (
                        <button
                            onClick={() => setIsOpenModalOpen(true)}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-green-600/20 active:scale-95 transition-all"
                        >
                            <Wallet className="w-5 h-5" />
                            Abrir Caja
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsCloseModalOpen(true)}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-slate-900/20 active:scale-95 transition-all"
                        >
                            <FileText className="w-5 h-5" />
                            Corte de Caja
                        </button>
                    )}
                </div>
            </div>

            {/* Indicador de la caja en pantalla */}
            {viewedSession && (
                <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className={clsx(
                            "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                            isViewingActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        )}>
                            {isViewingActive ? 'Turno Actual' : 'Turno Cerrado'}
                        </span>
                        <span className="text-sm font-semibold text-gray-700">
                            Apertura: {formatDate(viewedSession.opened_at)} • {formatTime(viewedSession.opened_at)}
                        </span>
                        {viewedSession.closed_at && (
                            <span className="text-sm text-gray-400">
                                — Cierre: {formatDate(viewedSession.closed_at)} • {formatTime(viewedSession.closed_at)}
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                        Caja #{viewedSession.id} • {viewIndex + 1} de {sessions.length}
                    </span>
                </div>
            )}

            {/* Resumen del cierre (visible al revisar turnos cerrados) */}
            {viewedSession?.status === 'closed' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Cerró Efectivo</p>
                        <p className="text-xl font-black text-slate-800">S/ {(viewedSession.real_closing_cash ?? 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Cerró Virtual</p>
                        <p className="text-xl font-black text-slate-800">S/ {(viewedSession.real_closing_virtual ?? 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Diferencia</p>
                        <p className={clsx(
                            "text-xl font-black",
                            (viewedSession.difference ?? 0) === 0 ? "text-slate-800" : (viewedSession.difference ?? 0) > 0 ? "text-green-600" : "text-red-600"
                        )}>
                            S/ {(viewedSession.difference ?? 0).toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Justificación</p>
                        <p className="text-sm font-semibold text-slate-700 truncate" title={viewedSession.justification ?? ''}>
                            {viewedSession.justification || '—'}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 content-start">
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group min-h-[160px] flex flex-col justify-center">
                        <div className="absolute right-0 top-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                            <Wallet className="w-32 h-32" />
                        </div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Efectivo en Caja</p>
                                <h3 className="text-4xl font-black text-slate-900">
                                    S/ {viewedSession ? viewedSession.expected_closing_cash.toFixed(2) : '0.00'}
                                </h3>
                            </div>
                            <div className={clsx(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5",
                                viewedSession ? (isViewingActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500") : "bg-red-100 text-red-700"
                            )}>
                                <span className={clsx("w-2 h-2 rounded-full", isViewingActive ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
                                {isViewingActive ? 'Caja Abierta' : 'Caja Cerrada'}
                            </div>
                        </div>
                        <div className="flex gap-6 text-[10px] uppercase font-bold tracking-wider">
                            <div className="text-gray-400">
                                <span className="opacity-60 mr-1">Apertura:</span>
                                <span className="text-slate-600">S/ {viewedSession?.opening_cash.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="text-gray-400">
                                <span className="opacity-60 mr-1">Cambio:</span>
                                <span className={clsx(
                                    (viewedSession?.expected_closing_cash || 0) >= (viewedSession?.opening_cash || 0) ? "text-green-600" : "text-red-600"
                                )}>
                                    S/ {((viewedSession?.expected_closing_cash || 0) - (viewedSession?.opening_cash || 0)).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group min-h-[160px] flex flex-col justify-center">
                        <div className="absolute right-0 top-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                            <CreditCard className="w-32 h-32" />
                        </div>
                        <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Dinero Virtual / Banco</p>
                        <h3 className="text-4xl font-black text-slate-900">
                            S/ {viewedSession ? viewedSession.expected_closing_virtual.toFixed(2) : '0.00'}
                        </h3>
                        <div className="mt-4 flex gap-4 text-[10px] uppercase font-bold tracking-wider text-gray-400">
                            <div>
                                <span className="opacity-60 mr-1">Apertura: </span>
                                <span className="text-slate-600">S/ {viewedSession?.opening_virtual.toFixed(2) || '0.00'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-6 min-h-[160px] justify-center">
                        <div className="flex items-center gap-5">
                            <div className="p-5 bg-green-50 rounded-2xl text-green-600 shadow-sm">
                                <ArrowUpRight className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-gray-400 text-xs font-black uppercase tracking-widest">Ingresos Totales (Turno)</p>
                                <h3 className="text-4xl font-black text-green-600">S/ {totalIncome.toFixed(2)}</h3>
                            </div>
                        </div>
                        <div className="flex gap-8 pt-4 border-t border-gray-50">
                            <div className="flex-1">
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Efectivo</p>
                                <p className="text-xl font-black text-slate-700">S/ {totalIncomeCash.toFixed(2)}</p>
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Virtual</p>
                                <p className="text-xl font-black text-slate-700">S/ {totalIncomeVirtual.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-6 min-h-[160px] justify-center">
                        <div className="flex items-center gap-5">
                            <div className="p-5 bg-red-50 rounded-2xl text-red-600 shadow-sm">
                                <ArrowDownRight className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-gray-400 text-xs font-black uppercase tracking-widest">Gastos Totales (Turno)</p>
                                <h3 className="text-4xl font-black text-red-600">S/ {totalExpenses.toFixed(2)}</h3>
                            </div>
                        </div>
                        <div className="flex gap-8 pt-4 border-t border-gray-50">
                            <div className="flex-1">
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Efectivo</p>
                                <p className="text-xl font-black text-slate-700">S/ {totalExpensesCash.toFixed(2)}</p>
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-1">Virtual</p>
                                <p className="text-xl font-black text-slate-700">S/ {totalExpensesVirtual.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 shadow-md flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-slate-400" />
                            <h3 className="font-bold text-gray-900">Movimientos del Turno</h3>
                        </div>
                        <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            {transactions.length} regs
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 min-h-[400px]">
                        {!viewedSession ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-40">
                                <Wallet className="w-12 h-12" />
                                <p className="font-bold">Aún no hay cajas registradas</p>
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-30">
                                <p className="font-medium italic">Sin movimientos en este turno</p>
                            </div>
                        ) : (
                            transactions.map(t => (
                                <div key={t.id} className="p-3 hover:bg-gray-50 rounded-2xl transition-all flex items-center justify-between group border border-transparent hover:border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-110",
                                            t.type === 'income'
                                                ? "bg-green-50 border-green-100 text-green-600"
                                                : "bg-red-50 border-red-100 text-red-600"
                                        )}>
                                            {t.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm">{t.description}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-gray-400 font-medium">{formatTime(t.created_at)} • {t.category}</span>
                                                <span className={clsx(
                                                    "text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1",
                                                    t.payment_method === 'cash' 
                                                        ? "bg-amber-100 text-amber-700" 
                                                        : "bg-indigo-100 text-indigo-700"
                                                )}>
                                                    {t.payment_method === 'cash' ? <Wallet className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                                                    {t.payment_method === 'cash' ? 'Efectivo' : 'Virtual'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={clsx(
                                        "font-black text-sm",
                                        t.type === 'income' ? "text-green-600" : "text-red-500"
                                    )}>
                                        {t.type === 'income' ? '+' : '-'} S/ {t.amount.toFixed(2)}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                disabled={!isViewingActive}
                                onClick={() => setTransactionModal({ isOpen: true, type: 'income' })}
                                title={isViewingActive ? '' : 'Solo disponible en la caja abierta'}
                                className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-green-500 hover:text-green-600 text-gray-600 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" /> Ingreso
                            </button>
                            <button
                                disabled={!isViewingActive}
                                onClick={() => setTransactionModal({ isOpen: true, type: 'expense' })}
                                title={isViewingActive ? '' : 'Solo disponible en la caja abierta'}
                                className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-red-500 hover:text-red-600 text-gray-600 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" /> Gasto
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <OpenCashModal 
                isOpen={isOpenModalOpen} 
                onClose={() => setIsOpenModalOpen(false)} 
            />
            <CloseCashModal 
                isOpen={isCloseModalOpen} 
                onClose={() => setIsCloseModalOpen(false)} 
            />
            <TransactionModal 
                isOpen={transactionModal.isOpen}
                type={transactionModal.type}
                onClose={() => setTransactionModal({ ...transactionModal, isOpen: false })}
                storeId={activeStoreId}
            />
        </div>
    );
}

export default FinancePage;