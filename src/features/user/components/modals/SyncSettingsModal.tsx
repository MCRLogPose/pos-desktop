import { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Copy,
    Eye,
    EyeOff,
    Loader2,
    RefreshCw,
    Server,
    X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { useNotification } from '@/context/NotificationContext';
import {
    copyToClipboard,
    syncService,
    type SyncInfo,
    type SyncTestResult,
} from '@/services/syncService';

interface SyncSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MODE_ACCENT = {
    primary: {
        chip: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: Server,
        title: 'Token de esta máquina Primary',
        subtitle: 'Cópialo y pégalo en cada máquina Replica para que puedan sincronizar.',
    },
    replica: {
        chip: 'bg-green-100 text-green-700 border-green-200',
        icon: RefreshCw,
        title: 'Conectar con la máquina Primary',
        subtitle: 'Pega el token y la IP que te entregó el administrador de la Primary.',
    },
    hybrid: {
        chip: 'bg-purple-100 text-purple-700 border-purple-200',
        icon: AlertTriangle,
        title: 'Sincronización desactivada',
        subtitle: 'El modo Hybrid opera de forma independiente y no envía datos a ninguna otra máquina.',
    },
} as const;

function CopyButton({ value, label }: { value: string; label: string }) {
    const { showNotification } = useNotification();
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const ok = await copyToClipboard(value);
        if (ok) {
            setCopied(true);
            showNotification('success', 'Copiado', label);
            setTimeout(() => setCopied(false), 2000);
        } else {
            showNotification('error', 'No se pudo copiar', 'Selecciona el texto y cópialo manualmente');
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={`Copiar ${label}`}
            className={clsx(
                'shrink-0 p-2.5 rounded-xl border transition-colors',
                copied
                    ? 'bg-green-50 border-green-200 text-green-600'
                    : 'bg-white border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300'
            )}
        >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
    );
}

export default function SyncSettingsModal({ isOpen, onClose }: SyncSettingsModalProps) {
    const { showNotification } = useNotification();
    const [info, setInfo] = useState<SyncInfo | null>(null);
    const [token, setToken] = useState<string>('');
    const [primaryUrlInput, setPrimaryUrlInput] = useState('');
    const [storeCodeInput, setStoreCodeInput] = useState('');
    const [portInput, setPortInput] = useState('');
    const [showToken, setShowToken] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<SyncTestResult | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [loadedInfo, loadedToken] = await Promise.all([
                syncService.getInfo(),
                syncService.getToken(),
            ]);
            setInfo(loadedInfo);
            setToken(loadedToken || '');
            setPrimaryUrlInput(loadedInfo.primaryUrl || '');
            setStoreCodeInput(loadedInfo.storeCode || '');
            setPortInput(String(loadedInfo.syncPort));
            setTestResult(null);
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'No se pudo leer la configuración de sincronización');
        } finally {
            setLoading(false);
        }
    }, [showNotification]);

    useEffect(() => {
        if (isOpen) {
            setShowToken(false);
            load();
        }
    }, [isOpen, load]);

    const mode = info?.operatingMode || 'hybrid';
    const accent = MODE_ACCENT[mode];
    const ModeIcon = accent.icon;

    const handleSave = async () => {
        if (!info) return;
        setSaving(true);
        try {
            const settings: Parameters<typeof syncService.saveSettings>[0] = {};
            if (mode === 'primary') {
                const port = Number(portInput);
                if (!Number.isInteger(port) || port <= 0 || port > 65535) {
                    showNotification('warning', 'Puerto inválido', 'Ingresa un número entre 1 y 65535');
                    return;
                }
                settings.syncPort = port;
            } else if (mode === 'replica') {
                settings.primaryUrl = primaryUrlInput;
                settings.syncToken = token;
                settings.storeCode = storeCodeInput;
            }

            const result = await syncService.saveSettings(settings);
            showNotification('success', 'Configuración guardada', result.message);
            await load();
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', (error as string) || 'No se pudo guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const result = await syncService.testConnection();
            setTestResult(result);
            if (result.ok) {
                showNotification('success', 'Conexión correcta', result.message);
            } else {
                showNotification('error', 'Sin conexión', result.message);
            }
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', (error as string) || 'No se pudo probar la conexión');
        } finally {
            setTesting(false);
        }
    };

    const handleSyncNow = async () => {
        setTesting(true);
        try {
            const summary = await syncService.forceSyncNow();
            showNotification('success', 'Sincronización ejecutada', summary);
            await load();
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error de sincronización', (error as string) || 'No se pudo sincronizar');
        } finally {
            setTesting(false);
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
                        className="fixed inset-0 bg-black/40 backdrop-blur-md z-60"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-70 p-4 pointer-events-none"
                    >
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex items-center justify-between p-5 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className={clsx('p-2 rounded-xl border', accent.chip)}>
                                        <ModeIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">Sincronización</h2>
                                        <p className="text-xs text-gray-500">{accent.subtitle}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-5">
                                {loading && (
                                    <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Cargando configuración...
                                    </div>
                                )}

                                {!loading && info && mode === 'primary' && (
                                    <>
                                        <div
                                            className={clsx(
                                                'flex items-center gap-2 rounded-2xl border p-3 text-sm',
                                                info.serverRunning
                                                    ? 'bg-green-50 border-green-100 text-green-800'
                                                    : 'bg-amber-50 border-amber-100 text-amber-800'
                                            )}
                                        >
                                            {info.serverRunning ? (
                                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                            ) : (
                                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                            )}
                                            <span>
                                                {info.serverRunning
                                                    ? `Servidor activo escuchando en el puerto ${info.syncPort}. Las réplicas ya pueden conectarse.`
                                                    : 'El servidor no está escuchando. Cierra y vuelve a abrir la aplicación para activarlo (y abre el puerto en el Firewall de Windows).'}
                                            </span>
                                        </div>

                                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    {accent.title}
                                                </span>
                                                <button
                                                    onClick={() => setShowToken(!showToken)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                                                    title={showToken ? 'Ocultar' : 'Mostrar'}
                                                >
                                                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    readOnly
                                                    type="text"
                                                    value={token}
                                                    placeholder="Sin token generado"
                                                    className="flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono text-gray-800 focus:outline-none"
                                                    onFocus={e => e.currentTarget.select()}
                                                />
                                                <CopyButton value={token} label="Token de sincronización" />
                                            </div>
                                            <p className="text-xs text-blue-800/80">
                                                En la máquina Replica ve a <strong>Configuración → Sincronización</strong> y
                                                pega este token junto con la IP de esta máquina.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                IP de esta máquina
                                                <span className="block text-xs font-normal text-gray-400">
                                                    Usa la de Tailscale si ambas máquinas están en la misma red.
                                                </span>
                                            </label>
                                            {info.localIps.length === 0 ? (
                                                <p className="text-sm text-gray-500">
                                                    No se detectaron direcciones IP en esta máquina.
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {info.localIps.map(ip => (
                                                        <div
                                                            key={ip}
                                                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl"
                                                        >
                                                            <span className="flex-1 font-mono text-sm text-gray-800 truncate">
                                                                {ip}
                                                            </span>
                                                            <CopyButton value={ip} label={`IP ${ip}`} />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Puerto del servidor de sincronización
                                            </label>
                                            <input
                                                type="number"
                                                value={portInput}
                                                onChange={e => setPortInput(e.target.value)}
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                            <p className="text-xs text-gray-400">
                                                Si cambias el puerto, reinicia la aplicación y abre el puerto en el Firewall
                                                de Windows.
                                            </p>
                                        </div>

                                        {info.deviceId && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider shrink-0">
                                                    ID equipo
                                                </span>
                                                <span className="flex-1 font-mono text-xs text-gray-500 truncate">
                                                    {info.deviceId}
                                                </span>
                                                <CopyButton value={info.deviceId} label="ID del equipo" />
                                            </div>
                                        )}
                                    </>
                                )}

                                {!loading && info && mode === 'replica' && (
                                    <>
                                        {!info.primaryUrl || !info.hasToken ? (
                                            <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                                <span>
                                                    Completa la IP y el token de la Primary y pulsa <strong>Guardar</strong>.
                                                    Mientras no estén, esta terminal guarda sus datos pero no los envía.
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 p-3 text-sm text-green-800">
                                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                                <span className="break-words">
                                                    Configurado para enviar datos a {info.primaryUrl}
                                                </span>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                IP o dirección de la Primary
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={primaryUrlInput}
                                                    onChange={e => setPrimaryUrlInput(e.target.value)}
                                                    placeholder="100.100.162.18"
                                                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                Puedes escribir solo la IP: el sistema agrega <code>http://</code> y el
                                                puerto por su cuenta.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Token de sincronización
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type={showToken ? 'text' : 'password'}
                                                    value={token}
                                                    onChange={e => setToken(e.target.value)}
                                                    placeholder="Pega aquí el token de la Primary"
                                                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                                                />
                                                <button
                                                    onClick={() => setShowToken(!showToken)}
                                                    className="shrink-0 p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-blue-600 transition-colors"
                                                    title={showToken ? 'Ocultar' : 'Mostrar'}
                                                >
                                                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                                <CopyButton value={token} label="Token de sincronización" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Nombre de esta tienda en la Primary
                                                <span className="block text-xs font-normal text-gray-400">
                                                    Referencial: con qué nombre se verá tu sede en la Primary. No
                                                    afecta la identidad técnica, que se deriva del ID de este equipo.
                                                </span>
                                            </label>
                                            <input
                                                type="text"
                                                value={storeCodeInput}
                                                onChange={e => setStoreCodeInput(e.target.value)}
                                                placeholder="Ej: GAMARRA"
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                            <p className="text-xs text-gray-400">
                                                Si lo dejas vacío, la Primary usará un nombre genérico con tu ID de equipo.
                                            </p>
                                        </div>

                                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600">Cambios por enviar</span>
                                                <span className="font-bold text-gray-900">
                                                    {info.pendingCount}
                                                </span>
                                            </div>
                                            {testResult && (
                                                <div
                                                    className={clsx(
                                                        'flex items-start gap-2 text-xs rounded-xl p-3',
                                                        testResult.ok
                                                            ? 'bg-green-50 text-green-700'
                                                            : 'bg-red-50 text-red-700'
                                                    )}
                                                >
                                                    {testResult.ok ? (
                                                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                                    ) : (
                                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                                    )}
                                                    <span className="break-words">{testResult.message}</span>
                                                </div>
                                            )}
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <button
                                                    onClick={handleTest}
                                                    disabled={testing}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-white transition-colors disabled:opacity-60"
                                                >
                                                    {testing ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Server className="w-4 h-4" />
                                                    )}
                                                    Probar conexión
                                                </button>
                                                <button
                                                    onClick={handleSyncNow}
                                                    disabled={testing || info.pendingCount === 0}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                    Sincronizar ahora
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {!loading && info && mode === 'hybrid' && (
                                    <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 text-sm text-purple-900 space-y-2">
                                        <p className="font-semibold">Esta máquina no sincroniza datos.</p>
                                        <p className="leading-relaxed">
                                            En modo Hybrid toda la información se mantiene local. Para recibir datos de otras
                                            terminales, la app debe instalarse en modo Primary, y esta terminal en modo
                                            Replica.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
                                <p className="text-xs text-gray-400">
                                    {mode === 'replica' && !info?.primaryUrl ? (
                                        <span className="text-amber-600 font-medium">Falta configurar la Primary</span>
                                    ) : (
                                        'Solo ADMIN puede ver y editar esta configuración'
                                    )}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={onClose}
                                        className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || loading || mode === 'hybrid'}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
