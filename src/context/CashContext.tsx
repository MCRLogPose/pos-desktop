import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';

interface CashSession {
    id: number;
    opened_by: number;
    opened_at: string;
    closed_by?: number;
    closed_at?: string;
    opening_cash: number;
    opening_virtual: number;
    expected_closing_cash: number;
    expected_closing_virtual: number;
    real_closing_cash?: number;
    real_closing_virtual?: number;
    difference?: number;
    justification?: string;
    status: 'open' | 'closed';
}

interface CashContextType {
    activeSession: CashSession | null;
    isLoading: boolean;
    refreshSession: () => Promise<void>;
    openSession: (opening_cash: number, opening_virtual: number) => Promise<void>;
    closeSession: (real_closing_cash: number, real_closing_virtual: number, justification?: string) => Promise<void>;
    lastClosedSession: CashSession | null;
}

const CashContext = createContext<CashContextType | undefined>(undefined);

export const CashProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeSession, setActiveSession] = useState<CashSession | null>(null);
    const [lastClosedSession, setLastClosedSession] = useState<CashSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { showNotification } = useNotification();
    const { user, activeStoreId } = useAuth();

    const refreshSession = async () => {
        if (!activeStoreId) return;
        setIsLoading(true);
        try {
            const session = await invoke<CashSession | null>('get_active_cash_session', { storeId: activeStoreId });
            setActiveSession(session);
            
            if (!session) {
                const last = await invoke<CashSession | null>('get_last_closed_cash_session', { storeId: activeStoreId });
                setLastClosedSession(last);
            }
        } catch (error) {
            console.error('Failed to get cash session:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user && activeStoreId) {
            refreshSession();
        } else {
            setActiveSession(null);
            setIsLoading(false);
        }
    }, [user, activeStoreId]);

    const openSession = async (opening_cash: number, opening_virtual: number) => {
        if (!user || !activeStoreId) return;
        try {
            await invoke('open_cash_session', {
                payload: {
                    opened_by: user.id,
                    opening_cash,
                    opening_virtual,
                    store_id: activeStoreId,
                }
            });
            showNotification('success', 'Caja abierta', 'La sesión de caja ha sido iniciada correctamente');
            await refreshSession();
        } catch (error) {
            showNotification('error', 'Error', String(error));
        }
    };

    const closeSession = async (real_closing_cash: number, real_closing_virtual: number, justification?: string) => {
        if (!activeSession || !user) return;
        try {
            await invoke('close_cash_session', {
                sessionId: activeSession.id,
                payload: {
                    closed_by: user.id,
                    real_closing_cash,
                    real_closing_virtual,
                    justification,
                }
            });
            showNotification('success', 'Caja cerrada', 'El corte de caja se ha realizado con éxito');
            await refreshSession();
        } catch (error) {
            showNotification('error', 'Error', String(error));
        }
    };

    return (
        <CashContext.Provider value={{ activeSession, isLoading, refreshSession, openSession, closeSession, lastClosedSession }}>
            {children}
        </CashContext.Provider>
    );
};

export const useCash = () => {
    const context = useContext(CashContext);
    if (!context) {
        throw new Error('useCash must be used within a CashProvider');
    }
    return context;
};
