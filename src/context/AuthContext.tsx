import React, { useState, useEffect, createContext, useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';

// Auth Context
interface User {
    id: number;
    username: string;
    email?: string;
    is_active: boolean;
    cargo?: string;
    store_id: number | null;
}

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    activeStoreId: number | null;
    setActiveStoreId: (id: number | null) => void;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [activeStoreId, setActiveStoreIdState] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check local storage
        const storedUser = localStorage.getItem('pos_user');
        const storedStoreId = localStorage.getItem('active_store_id');
        
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                setUser(parsed);
                setIsAuthenticated(true);
                
                if (storedStoreId) {
                    setActiveStoreIdState(parseInt(storedStoreId));
                } else if (parsed.store_id) {
                    setActiveStoreIdState(parsed.store_id);
                    localStorage.setItem('active_store_id', parsed.store_id.toString());
                }
            } catch (e) {
                localStorage.removeItem('pos_user');
                localStorage.removeItem('active_store_id');
            }
        }
        setIsLoading(false);
    }, []);

    const setActiveStoreId = (id: number | null) => {
        setActiveStoreIdState(id);
        if (id) {
            localStorage.setItem('active_store_id', id.toString());
        } else {
            localStorage.removeItem('active_store_id');
        }
    };

    const login = async (username: string, password: string) => {
        setError(null);
        try {
            const user = await invoke<User>('login', { username, password });
            setUser(user);
            setIsAuthenticated(true);
            localStorage.setItem('pos_user', JSON.stringify(user));
            
            // If user has a store assigned, set it as active
            if (user.store_id) {
                setActiveStoreId(user.store_id);
            } else if (user.cargo === 'ADMIN') {
                // Admin might not have a store assigned initially, will need to select one
                setActiveStoreId(null);
            }
        } catch (err) {
            console.error("Login failed", err);
            setError(typeof err === 'string' ? err : "Error al iniciar sesión");
            throw err;
        }
    };

    const logout = () => {
        setUser(null);
        setIsAuthenticated(false);
        setActiveStoreId(null);
        localStorage.removeItem('pos_user');
        localStorage.removeItem('active_store_id');
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-white">Cargando...</div>;

    return (
        <AuthContext.Provider value={{ 
            isAuthenticated, 
            user, 
            activeStoreId, 
            setActiveStoreId, 
            login, 
            logout, 
            error 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
