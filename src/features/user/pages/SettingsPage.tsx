import { Save } from 'lucide-react';

const SettingsPage = () => {
    return (
        <div className="space-y-6 w-full">
            <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>

            <div className="flex flex-col xl:flex-row gap-6">
                {/* Left Column: Business & Billing */}
                <div className="flex-1 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6 h-fit">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Perfil del Negocio</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Nombre del Negocio</label>
                                <input type="text" defaultValue="Mi Cafetería" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">RUC / NIT</label>
                                <input type="text" defaultValue="20123456789" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-gray-700">Dirección</label>
                                <input type="text" defaultValue="Av. Principal 123, Lima" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
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
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Perfil de Usuario</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Nombre de Usuario</label>
                                <input type="text" placeholder="jdoe" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Nueva Contraseña</label>
                                <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Confirmar Contraseña</label>
                                <input type="password" placeholder="••••••••" className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>

                        <div className="mt-6">
                            <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20">
                                <Save className="w-4 h-4" />
                                Actualizar Perfil
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SettingsPage;