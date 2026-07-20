import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useConfig } from '@/context/ConfigContext';
import { useNotification } from '@/context/NotificationContext';
import ModeSelector from '../components/ModeSelector';

export default function SetupPage() {
    const navigate = useNavigate();
    const { setMode } = useConfig();
    const { showNotification } = useNotification();
    const [step, setStep] = useState(1);
    const [selectedMode, setSelectedMode] = useState<'primary' | 'replica' | 'hybrid' | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleComplete = async () => {
        if (!selectedMode) return;

        setIsSaving(true);
        try {
            await setMode(selectedMode);
            showNotification('success', 'Configuración guardada', `Modo ${selectedMode.toUpperCase()} activado`);
            navigate('/');
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'Error al guardar la configuración');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
                        <Settings className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración Inicial</h1>
                    <p className="text-gray-500">Selecciona el modo de operación para VESTIKPOS</p>
                </div>

                {/* Progress */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            {step > 1 ? <Check className="w-4 h-4" /> : '1'}
                        </div>
                        <span className="text-sm font-medium hidden sm:block">Seleccionar Modo</span>
                    </div>
                    <div className={`w-12 h-0.5 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            2
                        </div>
                        <span className="text-sm font-medium hidden sm:block">Confirmar</span>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {step === 1 && (
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">¿Cómo usarás VESTIKPOS?</h2>
                            <p className="text-gray-500 mb-6">Elige el modo que mejor se adapte a tu negocio</p>
                            <ModeSelector selected={selectedMode} onSelect={setSelectedMode} />
                        </div>
                    )}

                    {step === 2 && selectedMode && (
                        <div className="text-center">
                            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 ${
                                selectedMode === 'primary' ? 'bg-blue-100' :
                                selectedMode === 'replica' ? 'bg-green-100' : 'bg-purple-100'
                            }`}>
                                {selectedMode === 'primary' && <span className="text-3xl">🖥️</span>}
                                {selectedMode === 'replica' && <span className="text-3xl">💻</span>}
                                {selectedMode === 'hybrid' && <span className="text-3xl">🏪</span>}
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">
                                Modo {selectedMode === 'primary' ? 'Primary' : selectedMode === 'replica' ? 'Replica' : 'Hybrid'} seleccionado
                            </h2>
                            <p className="text-gray-500 mb-8 max-w-md mx-auto">
                                {selectedMode === 'primary' && 'Tu computadora funcionará como servidor central. Recibirá datos de las terminales de venta.'}
                                {selectedMode === 'replica' && 'Tu computadora funcionará como terminal de venta. Enviará datos diariamente a la Primary.'}
                                {selectedMode === 'hybrid' && 'Tu computadora funcionará de forma independiente. Toda la información se mantendrá local.'}
                            </p>

                            <div className="bg-gray-50 rounded-xl p-4 mb-8 text-left max-w-md mx-auto">
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">Nota:</span> El modo no se puede cambiar después de la instalación. Si necesitas otro modo, deberás reinstalar la aplicación.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between mt-8">
                        {step > 1 ? (
                            <button
                                type="button"
                                onClick={() => setStep(step - 1)}
                                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Atrás
                            </button>
                        ) : (
                            <div />
                        )}

                        {step < 2 ? (
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                disabled={!selectedMode}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continuar
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleComplete}
                                disabled={isSaving}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-green-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                Iniciar VESTIKPOS
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
