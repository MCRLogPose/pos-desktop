import { invoke } from '@tauri-apps/api/core';

export interface SyncInfo {
    operatingMode: 'primary' | 'replica' | 'hybrid';
    deviceId: string | null;
    syncPort: number;
    primaryUrl: string | null;
    storeCode: string | null;
    hasToken: boolean;
    pendingCount: number;
    localIps: string[];
    serverRunning: boolean;
}

export interface SyncSettingsInput {
    primaryUrl?: string;
    syncToken?: string;
    storeCode?: string;
    syncPort?: number;
}

export interface SyncSaveResult {
    restartRequired: boolean;
    message: string;
}

export interface SyncTestResult {
    ok: boolean;
    message: string;
}

export interface FullSyncResult {
    categories: number;
    products: number;
    stockMovements: number;
    summary: string;
}

export const syncService = {
    async getInfo(): Promise<SyncInfo> {
        return await invoke('get_sync_info');
    },

    async getToken(): Promise<string | null> {
        return await invoke<string | null>('get_sync_token');
    },

    async saveSettings(settings: SyncSettingsInput): Promise<SyncSaveResult> {
        return await invoke('save_sync_settings', { settings });
    },

    async testConnection(): Promise<SyncTestResult> {
        return await invoke('test_sync_connection');
    },

    async forceSyncNow(): Promise<string> {
        return await invoke('force_sync_now');
    },

    /**
     * Reencola todo el catalogo (categorias, productos y stock) y sincroniza.
     *
     * La outbox es un log de cambios, no una copia: lo que nunca se encolo no
     * llega a la Primary por mas que se pulse "Sincronizar ahora". Esta
     * reconciliacion es idempotente y solo manda la diferencia de stock.
     */
    async forceFullInventorySync(): Promise<FullSyncResult> {
        return await invoke('force_full_inventory_sync');
    },
};

export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const area = document.createElement('textarea');
            area.value = text;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            const copied = document.execCommand('copy');
            document.body.removeChild(area);
            return copied;
        } catch {
            return false;
        }
    }
}
