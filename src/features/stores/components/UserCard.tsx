import { useState } from 'react';
import { User as UserIcon, Mail, Briefcase, Building2, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { User } from '@/services/userService';

interface Store {
    id: number;
    name: string;
}

interface UserCardProps {
    user: User;
    stores: Store[];
    onEdit: (user: User) => void;
    onDelete: (userId: number) => void;
    onStoreChange: (userId: number, storeId: number | null) => void;
}

export default function UserCard({ user, stores, onEdit, onDelete, onStoreChange }: UserCardProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStoreId = e.target.value ? parseInt(e.target.value) : null;
        onStoreChange(user.id, newStoreId);
    };

    const handleDelete = () => {
        onDelete(user.id);
        setShowDeleteConfirm(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">{user.username}</h3>
                        <p className="text-sm text-gray-500">{user.cargo}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => onEdit(user)}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        title="Editar usuario"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                        title="Eliminar usuario"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-2 mb-4">
                {user.cargo && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Briefcase className="w-4 h-4 text-gray-400" />
                        <span>{user.cargo}</span>
                    </div>
                )}
                {user.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span>{user.email}</span>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Sede Asignada</label>
                <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <select
                        value={user.store_id || ''}
                        onChange={handleStoreChange}
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm appearance-none bg-white"
                    >
                        <option value="">Sin asignar</option>
                        {stores.map((store) => (
                            <option key={store.id} value={store.id}>
                                {store.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {showDeleteConfirm && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                    <p className="text-sm text-red-800 mb-3">¿Estás seguro de eliminar este usuario?</p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDelete}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                            Eliminar
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="flex-1 bg-white hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
