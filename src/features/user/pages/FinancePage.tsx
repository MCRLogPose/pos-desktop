import { useState } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, Plus, FileText, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useNotification } from '@/context/NotificationContext';

const INITIAL_TRANSACTIONS = [
    { id: 1, type: 'income', category: 'Venta', amount: 45.00, description: 'Venta #1023', date: '10:30 AM' },
    { id: 2, type: 'income', category: 'Venta', amount: 120.50, description: 'Venta #1024', date: '11:15 AM' },
    { id: 3, type: 'expense', category: 'Proveedor', amount: 350.00, description: 'Compra de Leche', date: '12:00 PM' },
    { id: 4, type: 'income', category: 'Venta', amount: 25.00, description: 'Venta #1025', date: '12:45 PM' },
    { id: 5, type: 'expense', category: 'Servicios', amount: 80.00, description: 'Pago de Internet', date: '01:30 PM' },
];

const WEEKLY_DATA = [
    { day: 'Lun', ingresos: 4500, egresos: 3200 },
    { day: 'Mar', ingresos: 5200, egresos: 2800 },
    { day: 'Mie', ingresos: 4800, egresos: 4100 },
    { day: 'Jue', ingresos: 6100, egresos: 3500 },
    { day: 'Vie', ingresos: 7500, egresos: 4200 },
    { day: 'Sab', ingresos: 8200, egresos: 3800 },
    { day: 'Dom', ingresos: 6900, egresos: 3100 },
];

const FinancePage = () => {
    const [cashStatus, setCashStatus] = useState<'open' | 'closed'>('open');
    const [transactions] = useState(INITIAL_TRANSACTIONS);
    const { showNotification } = useNotification();

    const handleOpenCash = () => {
        showNotification('success', 'Caja Abierta', 'Caja abierta correctamente con S/ 500.00');
        setCashStatus('open');
    };

    const handleCloseCash = () => {
        showNotification('info', 'Corte Realizado', 'Corte de caja realizado. Reporte generado.');
        setCashStatus('closed');
    };

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
                    <p className="text-gray-500">Control de caja y movimientos</p>
                </div>
                <div className="flex gap-3">
                    {cashStatus === 'closed' ? (
                        <button
                            onClick={handleOpenCash}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-green-600/20"
                        >
                            <Wallet className="w-5 h-5" />
                            Abrir Caja
                        </button>
                    ) : (
                        <button
                            onClick={handleCloseCash}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-slate-900/20"
                        >
                            <FileText className="w-5 h-5" />
                            Corte de Caja
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Overview Cards */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-4 opacity-5">
                            <DollarSign className="w-24 h-24" />
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Saldo en Caja</p>
                        <h3 className="text-3xl font-bold text-gray-900">S/ 1,245.50</h3>
                        <div className="mt-4 flex items-center gap-2 text-sm text-green-600 bg-green-50 w-fit px-2 py-1 rounded-lg">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Caja Abierta
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-green-100 rounded-lg text-green-600">
                                <ArrowUpRight className="w-5 h-5" />
                            </div>
                            <p className="text-gray-500 text-sm font-medium">Ingresos (Hoy)</p>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">S/ {totalIncome.toFixed(2)}</h3>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-red-100 rounded-lg text-red-600">
                                <ArrowDownRight className="w-5 h-5" />
                            </div>
                            <p className="text-gray-500 text-sm font-medium">Gastos (Hoy)</p>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">S/ {totalExpenses.toFixed(2)}</h3>
                    </div>

                    {/* Chart */}
                    <div className="md:col-span-3 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-6">Flujo de Caja Semanal</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={WEEKLY_DATA}>
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Recent Transactions List */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900">Movimientos Recientes</h3>
                        <button className="text-blue-600 text-sm font-medium hover:underline">Ver Todo</button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {transactions.map(t => (
                            <div key={t.id} className="p-3 hover:bg-gray-50 rounded-xl transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className={clsx(
                                        "w-10 h-10 rounded-full flex items-center justify-center border",
                                        t.type === 'income'
                                            ? "bg-green-50 border-green-100 text-green-600"
                                            : "bg-red-50 border-red-100 text-red-600"
                                    )}>
                                        {t.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">{t.description}</p>
                                        <p className="text-xs text-gray-500">{t.date} • {t.category}</p>
                                    </div>
                                </div>
                                <span className={clsx(
                                    "font-bold text-sm",
                                    t.type === 'income' ? "text-green-600" : "text-gray-900"
                                )}>
                                    {t.type === 'income' ? '+' : '-'} S/ {t.amount.toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t border-gray-100 bg-gray-50">
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => showNotification('success', 'Ingreso Registrado', 'Se ha registrado el ingreso correctamente.')}
                                className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-blue-500 hover:text-blue-600 text-gray-600 py-2.5 rounded-xl text-sm font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Ingreso
                            </button>
                            <button
                                onClick={() => showNotification('warning', 'Gasto Registrado', 'Se ha registrado el gasto correctamente.')}
                                className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-red-500 hover:text-red-600 text-gray-600 py-2.5 rounded-xl text-sm font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Gasto
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FinancePage;