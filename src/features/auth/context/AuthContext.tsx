import React, { useState, useEffect, createContext, useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// Mock Auth Context
interface AuthContextType {
    isAuthenticated: boolean;
    user: { name: string; role: string } | null;
    login: (username: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<{ name: string; role: string } | null>(null);

    useEffect(() => {
        // Check local storage for session simulation
        const storedUser = localStorage.getItem('pos_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
        }
    }, []);

    const login = (username: string) => {
        const mockUser = { name: username, role: 'admin' };
        setUser(mockUser);
        setIsAuthenticated(true);
        localStorage.setItem('pos_user', JSON.stringify(mockUser));
    };

    const logout = () => {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('pos_user');
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
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
