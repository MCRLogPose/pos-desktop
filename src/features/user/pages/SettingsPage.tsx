import { useState } from 'react';
import { Save, Pencil, User, Mail, Briefcase, Lock, Server, Monitor, Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useConfig } from '@/context/ConfigContext';
import { useNotification } from '@/context/NotificationContext';
import { userService } from '@/services/userService';

const MODE_CONFIG = {
    primary: {
        label: 'Primary',
        description: 'Servidor central — recibe datos de terminales',
        icon: Server,
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
    },
    replica: {
        label: 'Replica',
        description: 'Terminal de venta — envía datos a Primary',
        icon: Monitor,
        color: 'bg-green-100 text-green-700 border-green-200',
        dot: 'bg-green-500',
    },
    hybrid: {
        label: 'Hybrid',
        description: 'Independiente — todo opera de forma local',
        icon: Store,
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        dot: 'bg-purple-500',
    },
};

const SettingsPage = () => {
    const { user } = useAuth();
    const { operatingMode } = useConfig();
    const { showNotification } = useNotification();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [email, setEmail] = useState(user?.email || '');
    const [cargo, setCargo] = useState(user?.cargo || '');

    const modeConfig = MODE_CONFIG[operatingMode];
    const ModeIcon = modeConfig.icon;

    // Password states
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await userService.updateUser(user.id, cargo || null, email || null, user.store_id || null);
            showNotification('success', 'Éxito', 'Perfil actualizado correctamente');
            setIsEditing(false);
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'Error al actualizar el perfil');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!user) return;

        if (!currentPassword || !newPassword || !confirmPassword) {
            showNotification('warning', 'Campos requeridos', 'Completa todos los campos de contraseña');
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotification('warning', 'Contraseñas no coinciden', 'La nueva contraseña y la confirmación deben ser iguales');
            return;
        }

        if (newPassword.length < 4) {
            showNotification('warning', 'Contraseña muy corta', 'La contraseña debe tener al menos 4 caracteres');
            return;
        }

        setIsChangingPassword(true);
        try {
            await userService.changePassword(user.id, currentPassword, newPassword);
            showNotification('success', 'Éxito', 'Contraseña actualizada correctamente');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', error as string || 'Error al cambiar la contraseña');
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <div className="space-y-6 w-full">
            <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>

            {/* Modo de Operación */}
            <div className={`flex items-center gap-4 p-4 rounded-xl border ${modeConfig.color}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${modeConfig.dot}`} />
                    <ModeIcon className="w-5 h-5" />
                </div>
                <div>
                    <p className="font-semibold">Modo: {modeConfig.label}</p>
                    <p className="text-sm opacity-75">{modeConfig.description}</p>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6">
                {/* Left Column: Business & Billing */}
                <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6 h-fit">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Perfil del Negocio</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Nombre del Negocio</label>
                                <input type="text" defaultValue="Vestik Store" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">RUC / NIT</label>
                                <input type="text" defaultValue="20123456789" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-gray-700">Dirección</label>
                                <input type="text" defaultValue="Jr. Aguistin Gamarra 939, La Victoria, Lima, Perú" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Configuración de Facturación (SUNAT)</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <div>
                                    <p className="font-medium text-gray-900">Conexión API SUNAT</p>
                                    <p className="text-sm text-gray-500">Estado: Desconectado (Modo Demo)</p>
                                </div>
                                <button className="text-blue-600 font-medium text-sm hover:underline">Configurar</button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Certificado Digital (.p12)</label>
                                <input type="file" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    <div className="flex justify-end">
                        <button className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium transition-all">
                            <Save className="w-4 h-4" />
                            Guardar Configuración General
                        </button>
                    </div>
                </div>

                {/* Right Column: User Profile */}
                <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6 h-fit">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Perfil de Usuario</h3>
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                title={isEditing ? 'Cancelar edición' : 'Editar perfil'}
                            >
                                <Pencil className={`w-5 h-5 transition-colors ${isEditing ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Username - Read only */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-400" />
                                    Nombre de Usuario
                                </label>
                                <input
                                    type="text"
                                    value={user?.username || ''}
                                    disabled
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                />
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={!isEditing}
                                    placeholder="correo@ejemplo.com"
                                    className={`w-full px-4 py-2 border border-gray-200 rounded-lg outline-none transition-colors ${isEditing ? 'focus:ring-2 focus:ring-blue-500' : 'bg-gray-50 text-gray-500 cursor-not-allowed'}`}
                                />
                            </div>

                            {/* Cargo / Rol */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-gray-400" />
                                    Cargo
                                </label>
                                <input
                                    type="text"
                                    value={cargo}
                                    onChange={(e) => setCargo(e.target.value)}
                                    disabled={!isEditing}
                                    placeholder="Ej. Administrador"
                                    className={`w-full px-4 py-2 border border-gray-200 rounded-lg outline-none transition-colors ${isEditing ? 'focus:ring-2 focus:ring-blue-500' : 'bg-gray-50 text-gray-500 cursor-not-allowed'}`}
                                />
                            </div>
                        </div>

                        {/* Save button - only visible when editing */}
                        {isEditing && (
                            <div className="mt-6">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isSaving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Actualizar Perfil
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Password Section */}
                <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6 h-fit">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Cambiar Contraseña</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-gray-400" />
                                    Contraseña Actual
                                </label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-gray-400" />
                                    Nueva Contraseña
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-gray-400" />
                                    Confirmar Nueva Contraseña
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="mt-6">
                            <button
                                onClick={handleChangePassword}
                                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl font-medium transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isChangingPassword ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Lock className="w-4 h-4" />
                                )}
                                Cambiar Contraseña
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SettingsPage;