import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { X, Wand2, Check } from 'lucide-react';
import {
    PAYMENT_METHODS,
    allocWaterfall,
    allocationBalance,
    round2,
} from './paymentAllocation';
import type {
    PaymentFraction,
    AllocationLineItem,
    ItemAllocation,
} from './paymentAllocation';

interface PaymentAllocationModalProps {
    isOpen: boolean;
    total: number;
    items: AllocationLineItem[];
    payments: PaymentFraction[];
    initial: ItemAllocation[] | null;
    onClose: () => void;
    onConfirm: (alloc: ItemAllocation[]) => void;
}

const inputBase =
    'w-full text-center text-sm font-semibold tabular-nums bg-white border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors';

const PaymentAllocationModal = ({
    isOpen,
    total,
    items,
    payments,
    initial,
    onClose,
    onConfirm,
}: PaymentAllocationModalProps) => {
    const [alloc, setAlloc] = useState<ItemAllocation[]>([]);

    const activeMethods = PAYMENT_METHODS.filter(m =>
        round2(payments.find(p => p.method === m.id)?.amount ?? 0) > 0
    );

    // Al abrir, si ya existe un ajuste previo valido se conserva; si no, se
    // genera la asignacion automatica waterfall/FIFO.
    useEffect(() => {
        if (!isOpen) return;
        const isValid =
            !!initial &&
            initial.length === items.length &&
            initial.every((row, i) => row.itemId === items[i]?.id);
        setAlloc(
            isValid && initial
                ? initial.map(row => ({ ...row, amounts: { ...row.amounts } }))
                : allocWaterfall(items, payments, total)
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, total]);

    const balance = allocationBalance(alloc, payments);
    const orderTotals: Record<string, number> = {};
    payments.forEach(p => { orderTotals[p.method] = round2(p.amount); });

    const updateCell = (itemId: string, method: string, value: string) => {
        const parsed = parseFloat(value);
        const amount = isNaN(parsed) || parsed < 0 ? 0 : round2(parsed);

        setAlloc(prev =>
            prev.map(row => {
                if (row.itemId !== itemId) return row;
                const others = round2(
                    (method !== 'cash' ? row.amounts.cash : 0) +
                        (method !== 'card' ? row.amounts.card : 0) +
                        (method !== 'yape' ? row.amounts.yape : 0)
                );
                const maxForCell = round2(Math.max(0, round2(row.target) - others));
                const clamped = Math.min(amount, maxForCell);
                return { ...row, amounts: { ...row.amounts, [method]: clamped } };
            })
        );
    };

    const applyAuto = () => setAlloc(allocWaterfall(items, payments, total));

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl relative z-10 overflow-hidden"
                    >
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Ajustar pago por prenda</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Reparte manualmente cada método de pago sobre las prendas de esta venta.
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto max-h-[calc(100vh-12rem)]">
                            {/* Red de prendas × métodos */}
                            <div
                                className="grid gap-2"
                                style={{
                                    gridTemplateColumns: `minmax(150px,1.4fr) repeat(${activeMethods.length}, minmax(96px,1fr)) 92px`,
                                }}
                            >
                                {/* Header */}
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">Prenda</div>
                                {activeMethods.map(({ id, label }) => (
                                    <div key={id} className="text-center">
                                        <p className={clsx('text-xs font-bold uppercase tracking-wider', id === 'yape' ? 'text-purple-500' : 'text-blue-600')}>
                                            {label}
                                        </p>
                                        <p className="text-[10px] text-gray-400 tabular-nums">Target S/ {(orderTotals[id] ?? 0).toFixed(2)}</p>
                                    </div>
                                ))}
                                <div className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 self-end">Total prenda</div>

                                {/* Body */}
                                {alloc.map(row => {
                                    const rowSum = round2(row.amounts.cash + row.amounts.card + row.amounts.yape);
                                    const rowOk = Math.abs(rowSum - round2(row.target)) <= 0.005;
                                    const rowBalance = balance.rows.find(r => r.itemId === row.itemId);
                                    const remaining = round2(Math.max(0, round2(row.target) - rowSum));
                                    return (
                                        <div key={row.itemId} className="contents">
                                            <div className="px-2 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{row.name}</p>
                                                <p className="text-xs text-gray-400 tabular-nums">Subtotal S/ {row.subtotal.toFixed(2)}</p>
                                            </div>

                                            {activeMethods.map(({ id: method }) => {
                                                const others = round2(
                                                    (method !== 'cash' ? row.amounts.cash : 0) +
                                                        (method !== 'card' ? row.amounts.card : 0) +
                                                        (method !== 'yape' ? row.amounts.yape : 0)
                                                );
                                                const maxForCell = round2(Math.max(0, round2(row.target) - others));
                                                const disabled = maxForCell <= 0.005;
                                                return (
                                                    <div key={method} className={clsx('flex flex-col gap-1', disabled && 'opacity-45')}>
                                                        <div className="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-200 px-1.5 py-1 focus-within:ring-2 focus-within:ring-blue-400">
                                                            <span className="text-xs font-bold text-gray-400 shrink-0">S/</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={maxForCell.toFixed(2)}
                                                                step="0.01"
                                                                value={row.amounts[method as keyof typeof row.amounts] || ''}
                                                                placeholder="0.00"
                                                                onChange={e => updateCell(row.itemId, method, e.target.value)}
                                                                disabled={disabled}
                                                                className={clsx(inputBase, 'border-0 bg-transparent focus:ring-0')}
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-center text-gray-400 tabular-nums">
                                                            {disabled ? 'cubierto' : `disp. ${maxForCell.toFixed(2)}`}
                                                        </p>
                                                    </div>
                                                );
                                            })}

                                            <div className={clsx('flex flex-col items-end justify-center px-2 rounded-lg', rowOk ? 'bg-emerald-50' : 'bg-amber-50')}>
                                                <p className={clsx('text-sm font-bold tabular-nums', rowOk ? 'text-emerald-700' : 'text-amber-600')}>
                                                    S/ {rowSum.toFixed(2)}
                                                </p>
                                                <p className="text-[10px] text-gray-400 tabular-nums">
                                                    {rowOk
                                                        ? `= ${round2(row.target).toFixed(2)} ✓`
                                                        : `falta ${remaining.toFixed(2)} · ${rowBalance?.target.toFixed(2)}`}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Resumen de invariantes */}
                            <div className="mt-5 rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span className="font-semibold uppercase tracking-wider text-gray-400">Total venta</span>
                                    <span className="font-bold tabular-nums text-gray-700">S/ {total.toFixed(2)}</span>
                                </div>
                                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${activeMethods.length}, 1fr)` }}>
                                    {balance.columns.map((col, idx) => {
                                        const label = activeMethods[idx]?.label ?? col.method;
                                        return (
                                            <div key={col.method} className={clsx('rounded-lg px-3 py-2 text-center', col.ok ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100')}>
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                                                <p className={clsx('text-sm font-bold tabular-nums', col.ok ? 'text-emerald-700' : 'text-amber-600')}>
                                                    S/ {col.sum.toFixed(2)} <span className="text-[10px] font-medium text-gray-400">/ {col.target.toFixed(2)}</span>
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                                {!balance.isBalanced && (
                                    <p className="text-xs text-amber-600">
                                        La suma de cada prenda y de cada método debe cuadrar con el total para poder guardar.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3">
                            <button
                                onClick={applyAuto}
                                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
                            >
                                <Wand2 className="w-4 h-4" />
                                Repartir automático
                            </button>
                            <div className="flex-1" />
                            <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={() => onConfirm(alloc)}
                                disabled={!balance.isBalanced}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all disabled:bg-gray-300 disabled:cursor-not-allowed bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
                            >
                                <Check className="w-4 h-4" />
                                Guardar distribución
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default PaymentAllocationModal;