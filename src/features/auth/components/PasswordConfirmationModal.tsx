import { useState } from 'react';
import { Lock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface PasswordConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    title?: string;
    description?: string;
    confirmButtonColor?: string;
}

export default function PasswordConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirmar Acción",
    description = "Por seguridad, ingresa tu contraseña para continuar.",
    confirmButtonColor = "bg-red-600 hover:bg-red-700"
}: PasswordConfirmationModalProps) {
    const [password, setPassword] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        setError(null);

        try {
            const isValid = await invoke<boolean>('verify_password', { password });
            if (isValid) {
                await onConfirm();
                setPassword('');
                onClose();
            } else {
                setError('Contraseña incorrecta');
                toast.error('Contraseña incorrecta');
            }
        } catch (err) {
            console.error("Verification error:", err);
            setError('Error verificando contraseña');
        } finally {
            setIsVerifying(false);
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
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                    >
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm pointer-events-auto overflow-hidden border border-red-100">
                            <div className="p-6 text-center">
                                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                                <p className="text-sm text-gray-500 mb-6">{description}</p>

                                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-gray-600 ml-1 uppercase">Contraseña de Admin</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="••••••••"
                                                required
                                                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm"
                                            />
                                        </div>
                                        {error && <p className="text-xs text-red-500 ml-1">{error}</p>}
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isVerifying}
                                            className={`flex-1 ${confirmButtonColor} text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md shadow-red-600/20 disabled:opacity-70 flex items-center justify-center gap-2`}
                                        >
                                            {isVerifying ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirmar'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
