import { useState, useEffect } from 'react';
import { Building2, UserPlus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import StoreModal from '../components/StoreModal';
import UserModal from '../components/UserModal';
import UserCard from '../components/UserCard';
import StoreCard from '../components/StoreCard';
import StoreDetailModal from '../components/StoreDetailModal';
import { invoke } from '@tauri-apps/api/core';
import { userService, type User } from '@/services/userService';

interface Store {
    id: number;
    name: string;
    code?: string;
    address?: string;
    is_active: boolean;
    created_at?: string;
}

export default function StoresPage() {
    const [stores, setStores] = useState<Store[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<Store | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [selectedStore, setSelectedStore] = useState<Store | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadStores();
        loadUsers();
    }, []);

    const loadStores = async () => {
        try {
            const data = await invoke<Store[]>('get_stores');
            setStores(data);
        } catch (error) {
            toast.error('Error al cargar las sedes');
            console.error(error);
        }
    };

    const loadUsers = async () => {
        try {
            const data = await userService.getAllUsers();
            setUsers(data);
        } catch (error) {
            toast.error('Error al cargar los usuarios');
            console.error(error);
        }
    };

    const handleCreateStore = async (name: string, address: string, code: string) => {
        setIsSubmitting(true);
        try {
            await invoke('create_store', { name, address, code });
            toast.success('Sede creada exitosamente');
            setIsStoreModalOpen(false);
            loadStores();
        } catch (error) {
            toast.error('Error al crear la sede');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateStore = async (name: string, address: string, code: string) => {
        if (!editingStore) return;
        setIsSubmitting(true);
        try {
            await invoke('update_store', { id: editingStore.id, name, address, code });
            toast.success('Sede actualizada exitosamente');
            setIsStoreModalOpen(false);
            setEditingStore(null);
            loadStores();
        } catch (error) {
            toast.error('Error al actualizar la sede');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteStore = async (id: number) => {
        try {
            await invoke('delete_store', { id });
            toast.success('Sede eliminada exitosamente');
            loadStores();
        } catch (error) {
            toast.error('Error al eliminar la sede');
            console.error(error);
        }
    };

    const handleCreateUser = async (
        username: string,
        password: string,
        cargo: string,
        email: string,
        storeId: number | null,
        role: string
    ) => {
        setIsSubmitting(true);
        try {
            await userService.createUser(
                username,
                password,
                cargo || null,
                email || null,
                storeId,
                role
            );
            toast.success('Usuario creado exitosamente');
            setIsUserModalOpen(false);
            loadUsers();
        } catch (error: any) {
            toast.error(error || 'Error al crear el usuario');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateUser = async (
        _username: string,
        _password: string,
        cargo: string,
        email: string,
        storeId: number | null,
        _role: string
    ) => {
        if (!editingUser) return;
        setIsSubmitting(true);
        try {
            await userService.updateUser(
                editingUser.id,
                cargo || null,
                email || null,
                storeId
            );
            toast.success('Usuario actualizado exitosamente');
            setIsUserModalOpen(false);
            setEditingUser(null);
            loadUsers();
        } catch (error) {
            toast.error('Error al actualizar el usuario');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        try {
            await userService.deleteUser(userId);
            toast.success('Usuario eliminado exitosamente');
            loadUsers();
        } catch (error) {
            toast.error('Error al eliminar el usuario');
            console.error(error);
        }
    };

    const handleUserStoreChange = async (userId: number, storeId: number | null) => {
        try {
            const user = users.find(u => u.id === userId);
            if (!user) return;

            await userService.updateUser(
                userId,
                user.cargo || null,
                user.email || null,
                storeId
            );
            toast.success('Sede asignada exitosamente');
            loadUsers();
        } catch (error) {
            toast.error('Error al asignar la sede');
            console.error(error);
        }
    };

    const handleUnassignUser = async (userId: number) => {
        try {
            const user = users.find(u => u.id === userId);
            if (!user) return;

            await userService.updateUser(
                userId,
                user.cargo || null,
                user.email || null,
                null
            );
            toast.success('Usuario desvinculado exitosamente');
            loadUsers();
        } catch (error) {
            toast.error('Error al desvincular el usuario');
            console.error(error);
        }
    };

    const openEditStore = (store: Store) => {
        setEditingStore(store);
        setIsStoreModalOpen(true);
    };

    const openEditUser = (user: User) => {
        setEditingUser(user);
        setIsUserModalOpen(true);
    };

    const openStoreDetail = (store: Store) => {
        setSelectedStore(store);
        setIsDetailModalOpen(true);
    };

    const closeStoreModal = () => {
        setIsStoreModalOpen(false);
        setEditingStore(null);
    };

    const closeUserModal = () => {
        setIsUserModalOpen(false);
        setEditingUser(null);
    };

    const closeDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedStore(null);
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-gray-50/50">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Users Section (1 Column) */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-linear-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                                <UserPlus className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Personal</h2>
                                <p className="text-xs text-gray-500">Usuarios disponibles</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsUserModalOpen(true)}
                            className="bg-white hover:bg-gray-50 text-green-600 p-2 rounded-lg border border-gray-100 shadow-sm transition-all active:scale-95"
                            title="Crear Usuario"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {users.filter(u => !u.store_id).length > 0 ? (
                            users.filter(u => !u.store_id).map((user) => (
                                <UserCard
                                    key={user.id}
                                    user={user}
                                    stores={stores}
                                    onEdit={openEditUser}
                                    onDelete={handleDeleteUser}
                                    onStoreChange={handleUserStoreChange}
                                />
                            ))
                        ) : (
                            <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-gray-200">
                                <p className="text-sm text-gray-400">No hay personal sin asignar</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stores Section (2 Columns) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <Building2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Sedes</h1>
                                <p className="text-sm text-gray-500">Gestión de puntos de venta</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsStoreModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva Sede
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {stores.map((store) => (
                            <StoreCard
                                key={store.id}
                                store={store}
                                assignedUsers={users.filter(u => u.store_id === store.id)}
                                onEdit={openEditStore}
                                onDelete={handleDeleteStore}
                                onDoubleClick={openStoreDetail}
                            />
                        ))}
                    </div>

                    {stores.length === 0 && (
                        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                            <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-gray-900 mb-1">No hay sedes aún</h3>
                            <p className="text-gray-500 max-w-xs mx-auto text-sm">Comienza creando tu primera sede para asignar personal y gestionar ventas.</p>
                        </div>
                    )}
                </div>
            </div>

            <StoreModal
                isOpen={isStoreModalOpen}
                onClose={closeStoreModal}
                onSubmit={editingStore ? handleUpdateStore : handleCreateStore}
                initialData={editingStore ? {
                    name: editingStore.name,
                    address: editingStore.address || '',
                    code: editingStore.code || ''
                } : null}
                isSubmitting={isSubmitting}
            />

            <UserModal
                isOpen={isUserModalOpen}
                onClose={closeUserModal}
                onSubmit={editingUser ? handleUpdateUser : handleCreateUser}
                initialData={editingUser ? {
                    id: editingUser.id,
                    username: editingUser.username,
                    cargo: editingUser.cargo || '',
                    email: editingUser.email || '',
                    store_id: editingUser.store_id || null
                } : null}
                stores={stores}
                isSubmitting={isSubmitting}
            />

            <StoreDetailModal
                isOpen={isDetailModalOpen}
                onClose={closeDetailModal}
                store={selectedStore}
                assignedUsers={selectedStore ? users.filter(u => u.store_id === selectedStore.id) : []}
                onUnassignUser={handleUnassignUser}
            />
        </div>
    );
}
