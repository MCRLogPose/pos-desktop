import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

type OperatingMode = 'primary' | 'replica' | 'hybrid';

interface ConfigContextType {
    operatingMode: OperatingMode;
    isPrimary: boolean;
    isReplica: boolean;
    isHybrid: boolean;
    isConfigured: boolean;
    loading: boolean;
    setMode: (mode: OperatingMode) => Promise<void>;
    refreshConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
    const [operatingMode, setOperatingMode] = useState<OperatingMode>('hybrid');
    const [isConfigured, setIsConfigured] = useState(false);
    const [loading, setLoading] = useState(true);

    const refreshConfig = async () => {
        try {
            const configured = await invoke<boolean>('has_app_config');
            console.log('[ConfigContext] ¿Config existe en DB?:', configured);
            setIsConfigured(configured);

            if (configured) {
                const mode = await invoke<string>('get_operating_mode');
                console.log('[ConfigContext] Modo cargado desde DB:', mode);
                setOperatingMode(mode as OperatingMode);
            } else {
                console.log('[ConfigContext] Sin configuración, redirigiendo a setup');
                setOperatingMode('hybrid');
            }
        } catch (error) {
            console.error('[ConfigContext] Error cargando config:', error);
            setOperatingMode('hybrid');
            setIsConfigured(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('[ConfigContext] Inicializando...');
        refreshConfig();
    }, []);

    const setMode = async (mode: OperatingMode) => {
        console.log('[ConfigContext] Cambiando modo a:', mode);
        await invoke('set_operating_mode', { mode });
        setOperatingMode(mode);
        setIsConfigured(true);
    };

    const value: ConfigContextType = {
        operatingMode,
        isPrimary: operatingMode === 'primary',
        isReplica: operatingMode === 'replica',
        isHybrid: operatingMode === 'hybrid',
        isConfigured,
        loading,
        setMode,
        refreshConfig,
    };

    return (
        <ConfigContext.Provider value={value}>
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfig() {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
}
