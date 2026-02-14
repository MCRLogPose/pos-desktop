import { useState, useEffect } from 'react';
import { Store as StoreIcon, User as UserIcon, MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import StoreModal from '../../stores/components/StoreModal';
import PasswordConfirmationModal from '../../auth/components/PasswordConfirmationModal';

interface Store {
    id: number;
    name: string;
    address: string | null;
    code: string | null;
    is_active: boolean;
}

interface User {
    id: number;
    username: string;
    // role: string; // Backend User struct doesn't have role directly on it yet in get_users, maybe need to join? 
    // For now get_users returns User struct which has id, username, email, is_active.
    // We might need to fetch roles separately or update get_users to return DTO.
    // Prompt said "listar los usuarios disponibles". simpler is fine.
}

const StoresPage = () => {
    const [stores, setStores] = useState<Store[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modals
    const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<Store | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);

    const fetchData = async () => {
        try {
            const [storesData, usersData] = await Promise.all([
                invoke<Store[]>('get_stores'),
                invoke<User[]>('get_users')
            ]);
            setStores(storesData);
            setUsers(usersData);
        } catch (error) {
            console.error("Failed to fetch data", error);
            toast.error("Error al cargar datos");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateStore = async (name: string, address: string, code: string) => {
        try {
            await invoke('create_store', { name, address: address || null, code: code || null });
            toast.success("Tienda creada exitosamente");
            setIsStoreModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Error al crear tienda");
        }
    };

    const handleUpdateStore = async (name: string, address: string, code: string) => {
        if (!editingStore) return;
        try {
            await invoke('update_store', {
                id: editingStore.id,
                name,
                address: address || null,
                code: code || null
            });
            toast.success("Tienda actualizada exitosamente");
            setIsStoreModalOpen(false);
            setEditingStore(null);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Error al actualizar tienda");
        }
    };

    const handleDeleteClick = (store: Store) => {
        setStoreToDelete(store);
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteStore = async () => {
        if (!storeToDelete) return;
        try {
            await invoke('delete_store', { id: storeToDelete.id });
            toast.success("Tienda eliminada"); // Soft delete
            setIsDeleteModalOpen(false);
            setStoreToDelete(null);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar tienda");
        }
    };

    const openCreateModal = () => {
        setEditingStore(null);
        setIsStoreModalOpen(true);
    };

    const openEditModal = (store: Store) => {
        setEditingStore(store);
        setIsStoreModalOpen(true);
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Cargando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Tiendas y Usuarios</h1>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-slate-900/20"
                >
                    <Plus className="w-5 h-5" />
                    Nueva Tienda
                </button>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Users List */}
                <div className="xl:col-span-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-[calc(100vh-12rem)] flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-gray-500" />
                        Personal Disponible
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {users.map(user => (
                            <div key={user.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl group hover:border-blue-300 transition-all">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-semibold text-gray-900">{user.username}</h4>
                                        <p className="text-xs text-gray-500">ID: {user.id}</p>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
                                        Activo
                                    </span>
                                </div>
                            </div>
                        ))}
                        {users.length === 0 && (
                            <div className="text-center py-10 text-gray-400 text-sm">No hay usuarios registrados</div>
                        )}
                    </div>
                </div>

                {/* Stores Visualization */}
                <div className="xl:col-span-2 space-y-6 overflow-y-auto h-[calc(100vh-12rem)] pr-2 custom-scrollbar">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 sticky top-0 bg-gray-50/50 backdrop-blur-sm py-2 z-10">
                        <StoreIcon className="w-5 h-5 text-gray-500" />
                        Vista General de Sedes
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stores.map(store => (
                            <div key={store.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEditModal(store)}
                                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(store)}
                                        className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                            <StoreIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">{store.name}</h4>
                                            {store.code && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{store.code}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="text-sm text-gray-500 flex items-center gap-2">
                                        <MapPin className="w-4 h-4" />
                                        {store.address || "Sin dirección"}
                                    </div>

                                    <div className="flex justify-between text-sm py-2 border-t border-gray-50 mt-2 pt-2">
                                        <span className="text-gray-400 text-xs">ID: {store.id}</span>
                                        <span className={clsx(
                                            "text-xs px-2 py-0.5 rounded-full font-medium",
                                            store.is_active ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                                        )}>
                                            {store.is_active ? 'Operativa' : 'Inactiva'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {stores.length === 0 && (
                            <div className="col-span-full text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">
                                No hay sedes registradas. Crea una nueva sede para comenzar.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <StoreModal
                isOpen={isStoreModalOpen}
                onClose={() => setIsStoreModalOpen(false)}
                onSubmit={editingStore ? handleUpdateStore : handleCreateStore}
                initialData={editingStore ? { name: editingStore.name, address: editingStore.address || '', code: editingStore.code || '' } : null}
            />

            <PasswordConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={async () => {
                    await confirmDeleteStore();
                    // Close happens in confirmDeleteStore but also need to ensure modal closes if error? 
                    // Actually best to handle it there.
                    return Promise.resolve();
                }}
                title="Eliminar Sede"
                description={`¿Estás seguro que deseas eliminar la sede "${storeToDelete?.name}"? Esta acción requiere confirmación de administrador.`}
            />
        </div>
    );
};

export default StoresPage;
