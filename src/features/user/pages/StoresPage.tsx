import { useState } from 'react';
import { Store, User, MapPin, Plus, Building2 } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { toast } from 'sonner';

// Mock Data
const INITIAL_STORES = [
    { id: '1', name: 'Sede Central', address: 'Av. Principal 123' },
    { id: '2', name: 'Sucursal Norte', address: 'Av. Norte 456' },
    { id: '3', name: 'Sucursal Sur', address: 'Av. Sur 789' },
];

const INITIAL_USERS = [
    { id: '1', name: 'Juan Pérez', role: 'Vendedor', storeId: '1' },
    { id: '2', name: 'Maria Lopez', role: 'Gerente', storeId: '1' },
    { id: '3', name: 'Carlos Ruiz', role: 'Vendedor', storeId: '2' },
    { id: '4', name: 'Ana Gomez', role: 'Cajero', storeId: '3' },
    { id: '5', name: 'Pedro Dias', role: 'Vendedor', storeId: null }, // Unassigned
];

const StoresPage = () => {
    const [stores, setStores] = useState(INITIAL_STORES);
    const [users, setUsers] = useState(INITIAL_USERS);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Form State
    const [newStoreName, setNewStoreName] = useState('');
    const [newStoreAddress, setNewStoreAddress] = useState('');

    const handleCreateStore = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStoreName || !newStoreAddress) {
            toast.error("Por favor complete todos los campos");
            return;
        }

        const newStore = {
            id: Math.random().toString(36).substr(2, 9),
            name: newStoreName,
            address: newStoreAddress
        };

        setStores([...stores, newStore]);
        setNewStoreName('');
        setNewStoreAddress('');
        setIsCreateModalOpen(false);
        toast.success("Tienda creada exitosamente");
    };

    const handleAssignUser = (userId: string, storeId: string | null) => {
        setUsers(users.map(u => u.id === userId ? { ...u, storeId } : u));
        toast.success("Usuario reasignado correctamente");
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Gestión de Tiendas y Usuarios</h1>
                <button
                    onClick={() => setIsCreateModalOpen(!isCreateModalOpen)}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-slate-900/20"
                >
                    <Plus className="w-5 h-5" />
                    Nueva Tienda
                </button>
            </div>

            {/* Create Store Section (Collapsible) */}
            <motion.div
                initial={false}
                animate={{ height: isCreateModalOpen ? 'auto' : 0, opacity: isCreateModalOpen ? 1 : 0 }}
                className="overflow-hidden"
            >
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Registrar Nueva Sede</h3>
                    <form onSubmit={handleCreateStore} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Nombre de la Sede</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    value={newStoreName}
                                    onChange={(e) => setNewStoreName(e.target.value)}
                                    placeholder="Ej. Sede Miraflores"
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Dirección</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    value={newStoreAddress}
                                    onChange={(e) => setNewStoreAddress(e.target.value)}
                                    placeholder="Ej. Av. Larco 101"
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-md shadow-blue-600/20">
                            Guardar Sede
                        </button>
                    </form>
                </div>
            </motion.div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Users List (Draggable conceptually - simpler UI first) */}
                <div className="xl:col-span-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-[calc(100vh-12rem)] flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-500" />
                        Personal Disponible
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {users.map(user => (
                            <div key={user.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl group hover:border-blue-300 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-semibold text-gray-900">{user.name}</h4>
                                        <p className="text-xs text-gray-500">{user.role}</p>
                                    </div>
                                    <span className={clsx(
                                        "text-xs px-2 py-1 rounded-full font-medium",
                                        user.storeId ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                    )}>
                                        {user.storeId ? 'Asignado' : 'Sin Asignar'}
                                    </span>
                                </div>

                                <div className="pt-2 border-t border-gray-200 mt-2">
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Asignar a Tienda:</label>
                                    <select
                                        value={user.storeId || ''}
                                        onChange={(e) => handleAssignUser(user.id, e.target.value || null)}
                                        className="w-full text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-500 outline-none"
                                    >
                                        <option value="">-- Sin Asignar --</option>
                                        {stores.map(store => (
                                            <option key={store.id} value={store.id}>{store.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stores Visualization */}
                <div className="xl:col-span-2 space-y-6 overflow-y-auto h-[calc(100vh-12rem)] pr-2 custom-scrollbar">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 sticky top-0 bg-gray-50/50 backdrop-blur-sm py-2">
                        <Store className="w-5 h-5 text-gray-500" />
                        Vista General de Sedes
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stores.map(store => {
                            const storeEmployees = users.filter(u => u.storeId === store.id);

                            return (
                                <div key={store.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                <Store className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900">{store.name}</h4>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {store.address}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                                            <span className="text-gray-500">Personal Asignado</span>
                                            <span className="font-bold text-gray-900">{storeEmployees.length}</span>
                                        </div>

                                        <div className="space-y-2">
                                            {storeEmployees.length > 0 ? (
                                                storeEmployees.map(emp => (
                                                    <div key={emp.id} className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg">
                                                        <span className="text-gray-700">{emp.name}</span>
                                                        <span className="text-xs text-gray-400">{emp.role}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-4 text-gray-400 text-sm italic bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                    Sin personal asignado
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoresPage;
