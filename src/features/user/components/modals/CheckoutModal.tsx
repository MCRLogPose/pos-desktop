import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { X, Banknote, CreditCard, Smartphone, User, Phone, Check } from 'lucide-react';

export type PaymentMethod = 'cash' | 'card' | 'yape';

export interface PaymentAllocation {
    method: PaymentMethod;
    amount: number;
}

interface CheckoutModalProps {
    isOpen: boolean;
    isProcessing: boolean;
    total: number;
    base: number;
    igv: number;
    itemCount: number;
    payments: PaymentAllocation[];
    clientDocument: string;
    clientPhone: string;
    clientName: string;
    onClose: () => void;
    onConfirm: (payments: PaymentAllocation[]) => void;
    onPaymentsChange: (payments: PaymentAllocation[]) => void;
    onClientDocumentChange: (value: string) => void;
    onClientPhoneChange: (value: string) => void;
    onClientNameChange: (value: string) => void;
}

const inputBase = "w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow";

const methods = [
    { id: 'cash' as const, label: 'Efectivo', Icon: Banknote, activeClass: 'border-blue-500 bg-blue-50' },
    { id: 'card' as const, label: 'Tarjeta', Icon: CreditCard, activeClass: 'border-blue-500 bg-blue-50' },
    { id: 'yape' as const, label: 'Yape', Icon: Smartphone, activeClass: 'border-purple-500 bg-purple-50' },
];

// Redondeo a 2 decimales para evitar errores de punto flotante.
const round2 = (n: number) => Math.round(n * 100) / 100;

const CheckoutModal = ({
    isOpen,
    isProcessing,
    total,
    base,
    igv,
    itemCount,
    payments,
    clientDocument,
    clientPhone,
    clientName,
    onClose,
    onConfirm,
    onPaymentsChange,
    onClientDocumentChange,
    onClientPhoneChange,
    onClientNameChange,
}: CheckoutModalProps) => {
    const selectedSum = round2(payments.reduce((acc, p) => acc + (isNaN(p.amount) ? 0 : p.amount), 0));
    const remaining = round2(total - selectedSum);
    const isComplete = payments.length > 0 && remaining <= 0.001;
    const canConfirm = payments.length > 0 && remaining <= 0.001 && !isProcessing;

    const togglePayment = (method: PaymentMethod, currentEntry?: PaymentAllocation) => {
        if (currentEntry) {
            // Al deseleccionar, si queda un solo metodo su monto vuelve al total.
            const rest = payments.filter(p => p.method !== method);
            if (rest.length === 1) {
                onPaymentsChange([{ method: rest[0].method, amount: round2(total) }]);
            } else if (rest.length === 0) {
                onPaymentsChange([]);
            } else {
                onPaymentsChange(rest);
            }
            return;
        }

        // Al seleccionar, el nuevo metodo recibe automáticamente lo que falta.
        const already = payments.some(p => p.method === method);
        if (already) return;
        if (payments.length === 0) {
            onPaymentsChange([{ method, amount: round2(total) }]);
            return;
        }
        if (remaining <= 0.001) return; // total cubierto
        onPaymentsChange([...payments, { method, amount: remaining }]);
    };

    const updateAmount = (method: PaymentMethod, value: string) => {
        const parsed = parseFloat(value);
        const amount = isNaN(parsed) || parsed < 0 ? 0 : round2(parsed);

        const othersSum = round2(
            payments
                .filter(p => p.method !== method)
                .reduce((acc, p) => acc + (isNaN(p.amount) ? 0 : p.amount), 0)
        );
        // Ningun monto individual puede superar el total ni dejar que la suma exceda el total.
        const maxForMethod = round2(Math.max(0, total - othersSum));
        const clamped = Math.min(amount, maxForMethod);

        onPaymentsChange(
            payments.map(p =>
                p.method === method ? { ...p, amount: clamped } : p
            )
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => !isProcessing && onClose()}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-bold text-gray-900">Procesar Pago</h3>
                            <button
                                onClick={() => !isProcessing && onClose()}
                                disabled={isProcessing}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-10rem)]">

                            {/* Total display */}
                            <div className="text-center bg-gray-50 rounded-2xl py-5">
                                <p className="text-sm text-gray-500 mb-1">Total a Pagar</p>
                                <p className="text-5xl font-bold text-gray-900 tabular-nums">S/ {total.toFixed(2)}</p>
                                <p className="text-xs text-gray-400 mt-2">
                                    {itemCount} producto{itemCount !== 1 ? 's' : ''}
                                    &nbsp;·&nbsp;Subtotal S/ {base.toFixed(2)}
                                    &nbsp;·&nbsp;IGV S/ {igv.toFixed(2)}
                                </p>
                            </div>

                            {/* Payment methods */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-semibold text-gray-700">Método de Pago</p>
                                    <span className="text-xs font-semibold text-gray-400">puedes dividir el pago</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {methods.map(({ id, label, Icon, activeClass }) => {
                                        const entry = payments.find(p => p.method === id);
                                        const isSelected = !!entry;
                                        const maxForMethod = round2(Math.max(0, total - (selectedSum - (entry?.amount || 0))));
                                        return (
                                            <div
                                                key={id}
                                                className={clsx(
                                                    'flex flex-col rounded-xl border-2 transition-all overflow-hidden',
                                                    isSelected
                                                        ? activeClass
                                                        : 'border-gray-100 hover:border-gray-200'
                                                )}
                                            >
                                                <button
                                                    onClick={() => togglePayment(id, entry)}
                                                    disabled={!isSelected && isComplete}
                                                    className={clsx(
                                                        'flex flex-col items-center justify-center gap-2 p-4 transition-all flex-1',
                                                        isSelected ? 'text-blue-700' : 'text-gray-600',
                                                        !isSelected && isComplete && 'opacity-40 cursor-not-allowed'
                                                    )}
                                                    title={!isSelected && isComplete ? 'El total ya está cubierto' : undefined}
                                                >
                                                    <Icon className="w-7 h-7" />
                                                    <span className="font-medium text-sm">{label}</span>
                                                    {isSelected && (
                                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                                            <Check className="w-3.5 h-3.5" /> Seleccionado
                                                        </span>
                                                    )}
                                                </button>

                                                {isSelected && (
                                                    <div className="px-2.5 pb-3">
                                                        <div className="flex items-center gap-1.5 bg-white rounded-lg border border-gray-200 px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-400">
                                                            <span className="text-xs font-bold text-gray-400 shrink-0">S/</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={maxForMethod.toFixed(2)}
                                                                step="0.01"
                                                                value={entry.amount || ''}
                                                                placeholder="0.00"
                                                                onChange={e => updateAmount(id, e.target.value)}
                                                                className="w-full text-sm font-semibold tabular-nums focus:outline-none bg-transparent"
                                                                disabled={isProcessing}
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 mt-1 text-center">
                                                            {maxForMethod <= 0.001 ? 'Sin saldo disponible' : `Máx. S/ ${maxForMethod.toFixed(2)}`}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Progress del total asignado */}
                                {payments.length > 0 && (
                                    <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-1.5">
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span className="font-semibold uppercase tracking-wider text-gray-400">Total asignado</span>
                                            <span className="font-semibold tabular-nums text-gray-700">S/ {selectedSum.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            {isComplete ? (
                                                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                                                    <Check className="w-4 h-4" /> Pago completo
                                                </span>
                                            ) : (
                                                <>
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Falta</span>
                                                    <span className="font-bold tabular-nums text-amber-600">S/ {remaining.toFixed(2)}</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={clsx('h-full rounded-full transition-all', isComplete ? 'bg-emerald-500' : 'bg-amber-400')}
                                                style={{ width: `${total > 0 ? Math.min(100, (selectedSum / total) * 100) : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Client info section */}
                            <div className="space-y-3">
                                <p className="text-sm font-semibold text-gray-700">
                                    Datos del Cliente
                                    <span className="text-xs font-normal text-gray-400 ml-2">(opcionales)</span>
                                </p>

                                {/* Name */}
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Nombre del cliente"
                                        value={clientName}
                                        onChange={e => onClientNameChange(e.target.value)}
                                        className={inputBase}
                                    />
                                </div>

                                {/* Document */}
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">ID</span>
                                    <input
                                        type="text"
                                        placeholder="DNI o RUC"
                                        value={clientDocument}
                                        onChange={e => onClientDocumentChange(e.target.value)}
                                        className={inputBase}
                                        maxLength={11}
                                    />
                                </div>

                                {/* Phone */}
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="tel"
                                        placeholder="Número de celular (para comprobante)"
                                        value={clientPhone}
                                        onChange={e => onClientPhoneChange(e.target.value)}
                                        className={inputBase}
                                        maxLength={15}
                                    />
                                </div>

                                <p className="text-xs text-gray-400 leading-relaxed">
                                    El DNI/RUC es requerido para factura electrónica (SUNAT).
                                    El celular permitirá enviar el comprobante al cliente.
                                </p>
                            </div>

                            {/* Confirm button */}
                            <button
                                onClick={() => onConfirm(payments)}
                                disabled={!canConfirm}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-green-600/20 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                            >
                                {isProcessing ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Procesando...
                                    </span>
                                ) : isComplete ? (
                                    `Confirmar Pago · S/ ${total.toFixed(2)}`
                                ) : (
                                    'Falta saldar el total'
                                )}
                            </button>
                            {!isComplete && payments.length > 0 && (
                                <p className="text-xs text-center text-gray-400 -mt-3">
                                    La suma de los métodos debe igualar al total.
                                </p>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CheckoutModal;