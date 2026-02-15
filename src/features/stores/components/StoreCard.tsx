import { Edit2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { User } from '@/services/userService';

interface Store {
    id: number;
    name: string;
    code?: string;
    address?: string;
    is_active: boolean;
    created_at?: string;
}

interface StoreCardProps {
    store: Store;
    assignedUsers: User[];
    onEdit: (store: Store) => void;
    onDelete: (storeId: number) => void;
    onDoubleClick: (store: Store) => void;
}

export default function StoreCard({ store, assignedUsers, onEdit, onDelete, onDoubleClick }: StoreCardProps) {
    const maxAvatars = 3;
    const remainingCount = assignedUsers.length > maxAvatars ? assignedUsers.length : 0;
    const visibleUsers = assignedUsers.slice(0, maxAvatars);

    const getInitials = (username: string) => {
        return username.substring(0, 2).toUpperCase();
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -4 }}
            onDoubleClick={() => onDoubleClick(store)}
            className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
        >
            {/* Top Right: User Avatar Stack */}
            <div className="absolute top-4 right-4 flex -space-x-3 pointer-events-none">
                {visibleUsers.map((user, index) => (
                    <motion.div
                        key={user.id}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                        style={{ zIndex: 10 - index }}
                    >
                        {getInitials(user.username)}
                    </motion.div>
                ))}
                {remainingCount > maxAvatars && (
                    <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-600 shadow-lg z-0">
                        +{remainingCount}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {store.name}
                    </h3>
                    {store.code && (
                        <span className="inline-block px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase tracking-wider mt-1">
                            {store.code}
                        </span>
                    )}
                </div>

                {store.address && (
                    <p className="text-sm text-gray-500 line-clamp-2 min-h-10">
                        {store.address}
                    </p>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="flex -space-x-1">
                        {/* Placeholder for future status or tags */}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(store);
                            }}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-all active:scale-95"
                            title="Editar sede"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(store.id);
                            }}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-all active:scale-95"
                            title="Eliminar sede"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
