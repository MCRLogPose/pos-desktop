import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { X, Banknote, CreditCard, Smartphone, User, Phone } from 'lucide-react';

type PaymentMethod = 'cash' | 'card' | 'yape';

interface CheckoutModalProps {
    isOpen: boolean;
    isProcessing: boolean;
    total: number;
    base: number;
    igv: number;
    itemCount: number;
    paymentMethod: PaymentMethod;
    clientDocument: string;
    clientPhone: string;
    clientName: string;
    onClose: () => void;
    onConfirm: () => void;
    onPaymentMethodChange: (method: PaymentMethod) => void;
    onClientDocumentChange: (value: string) => void;
    onClientPhoneChange: (value: string) => void;
    onClientNameChange: (value: string) => void;
}

const inputBase = "w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow";

const CheckoutModal = ({
    isOpen,
    isProcessing,
    total,
    base,
    igv,
    itemCount,
    paymentMethod,
    clientDocument,
    clientPhone,
    clientName,
    onClose,
    onConfirm,
    onPaymentMethodChange,
    onClientDocumentChange,
    onClientPhoneChange,
    onClientNameChange,
}: CheckoutModalProps) => {
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
                                <p className="text-sm font-semibold text-gray-700 mb-2">Método de Pago</p>
                                <div className="grid grid-cols-3 gap-3">
                                    {([
                                        { id: 'cash', label: 'Efectivo', Icon: Banknote, activeClass: 'border-blue-500 bg-blue-50 text-blue-700' },
                                        { id: 'card', label: 'Tarjeta', Icon: CreditCard, activeClass: 'border-blue-500 bg-blue-50 text-blue-700' },
                                        { id: 'yape', label: 'Yape', Icon: Smartphone, activeClass: 'border-purple-500 bg-purple-50 text-purple-700' },
                                    ] as const).map(({ id, label, Icon, activeClass }) => (
                                        <button
                                            key={id}
                                            onClick={() => onPaymentMethodChange(id)}
                                            className={clsx(
                                                'flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all',
                                                paymentMethod === id ? activeClass : 'border-gray-100 hover:border-gray-200 text-gray-600'
                                            )}
                                        >
                                            <Icon className="w-7 h-7" />
                                            <span className="font-medium text-sm">{label}</span>
                                        </button>
                                    ))}
                                </div>
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
                                onClick={onConfirm}
                                disabled={isProcessing}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-green-600/20 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                            >
                                {isProcessing ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Procesando...
                                    </span>
                                ) : (
                                    `Confirmar Pago · S/ ${total.toFixed(2)}`
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CheckoutModal;
