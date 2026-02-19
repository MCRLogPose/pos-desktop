import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from '@/context/NotificationContext';

interface Category {
    id: number;
    name: string;
}

interface CategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCategoryChange: () => void;
}

export default function CategoryModal({ isOpen, onClose, onCategoryChange }: CategoryModalProps) {
    const { showNotification } = useNotification();
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadCategories();
        }
    }, [isOpen]);

    const loadCategories = async () => {
        try {
            const data = await invoke<Category[]>('get_categories');
            setCategories(data);
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'Error al cargar categorías');
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;

        setIsLoading(true);
        try {
            await invoke('create_category', { name: newCategoryName });
            showNotification('success', 'Éxito', 'Categoría creada');
            setNewCategoryName('');
            loadCategories();
            onCategoryChange();
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'Error al crear categoría');
        } finally {
            setIsLoading(false);
        }
    };

    const startEdit = (category: Category) => {
        setEditingId(category.id);
        setEditName(category.name);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleUpdate = async () => {
        if (!editName.trim() || editingId === null) return;

        try {
            await invoke('update_category', { id: editingId, name: editName });
            showNotification('success', 'Éxito', 'Categoría actualizada');
            setEditingId(null);
            setEditName('');
            loadCategories();
            onCategoryChange();
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'Error al actualizar categoría');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar esta categoría?')) return;
        try {
            await invoke('delete_category', { id });
            showNotification('success', 'Éxito', 'Categoría eliminada');
            loadCategories();
            onCategoryChange();
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'Error al eliminar categoría');
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
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                    >
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md pointer-events-auto flex flex-col max-h-[80vh]">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                                <h3 className="text-lg font-bold text-gray-900">Gestionar Categorías</h3>
                                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                                {/* Create Form */}
                                <form onSubmit={handleCreate} className="flex gap-2 mb-6">
                                    <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="Nueva categoría..."
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLoading || !newCategoryName.trim()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </form>

                                {/* List */}
                                <div className="space-y-2">
                                    {categories.map((category) => (
                                        <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100">
                                            {editingId === category.id ? (
                                                <div className="flex-1 flex gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        className="flex-1 px-2 py-1 border border-blue-200 rounded focus:outline-none focus:border-blue-500 bg-white"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={handleUpdate}
                                                        className="p-1 text-green-600 hover:bg-green-100 rounded"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="p-1 text-gray-400 hover:bg-gray-200 rounded"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="font-medium text-gray-700">{category.name}</span>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => startEdit(category)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(category.id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}

                                    {categories.length === 0 && (
                                        <div className="text-center py-8 text-gray-400 text-sm">
                                            No hay categorías registradas
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
