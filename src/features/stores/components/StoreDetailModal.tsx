import { X, Building2, User as UserIcon, Briefcase, UserMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { User } from '@/services/userService';

interface Store {
    id: number;
    name: string;
    code?: string;
    address?: string;
    is_active: boolean;
    created_at?: string;
}

interface StoreDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    store: Store | null;
    assignedUsers: User[];
    onUnassignUser: (userId: number) => Promise<void>;
}

export default function StoreDetailModal({ isOpen, onClose, store, assignedUsers, onUnassignUser }: StoreDetailModalProps) {
    if (!store) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-md z-60"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-70 p-4 pointer-events-none"
                    >
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl pointer-events-auto overflow-hidden flex flex-col max-h-[85vh]">
                            {/* Header */}
                            <div className="relative h-48 bg-linear-to-br from-blue-600 to-indigo-700 p-8 flex flex-col justify-end">
                                <button
                                    onClick={onClose}
                                    className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors backdrop-blur-sm"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="flex items-center gap-4 text-white">
                                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30">
                                        <Building2 className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold">{store.name}</h2>
                                        <p className="opacity-80">{store.code || 'Sin código'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                {/* Store Info Section */}
                                <section className="space-y-4">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Información de la Sede</h3>
                                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                                        <p className="text-gray-700 leading-relaxed font-medium">
                                            {store.address || 'No hay dirección registrada para esta sede.'}
                                        </p>
                                    </div>
                                </section>

                                {/* Assigned Users Section */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Personal Asignado ({assignedUsers.length})</h3>
                                    </div>

                                    {assignedUsers.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {assignedUsers.map((user) => (
                                                <div key={user.id} className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:border-blue-200 transition-colors group relative">
                                                    <div className="w-12 h-12 bg-linear-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white transition-all duration-300">
                                                        <UserIcon className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-8">
                                                        <p className="font-bold text-gray-900 truncate">{user.username}</p>
                                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                                            <Briefcase className="w-3 h-3" />
                                                            <span className="truncate">{user.cargo || 'Sin cargo'}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => onUnassignUser(user.id)}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-red-100 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Desvincular de la sede"
                                                    >
                                                        <UserMinus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                            <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                            <p className="text-gray-500 font-medium">No hay usuarios asignados a esta sede.</p>
                                        </div>
                                    )}
                                </section>
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={onClose}
                                    className="px-8 py-3 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-gray-200"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
