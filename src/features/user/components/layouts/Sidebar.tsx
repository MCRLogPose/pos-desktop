import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, DollarSign, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight, Store } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { clsx } from 'clsx';
import { motion } from 'motion/react';

interface SidebarProps {
    isCollapsed: boolean;
    toggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse }) => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: ShoppingCart, label: 'Punta de Venta', path: '/pos' },
        { icon: Package, label: 'Inventario', path: '/inventory' },
        { icon: DollarSign, label: 'Finanzas', path: '/finance' },
        { icon: BarChart3, label: 'Reportes', path: '/reports' },
        { icon: Store, label: 'Tiendas', path: '/stores' },
        { icon: Settings, label: 'Configuración', path: '/settings' },
    ];

    return (
        <motion.aside
            initial={false}
            animate={{ width: isCollapsed ? 80 : 256 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex flex-col bg-slate-50 text-black border-r border-slate-200 shadow-xl z-20 h-screen"
        >
            {/* Logo Section: press to go to home */}
            <div onClick={() => navigate('/home')} className={clsx(
                "flex items-center h-20 border-b border-slate-200 cursor-pointer",
                isCollapsed ? "justify-center px-0" : "px-6 gap-3"
            )}>
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 flex-shrink-2">
                    <Store className="w-6 h-6 text-white" />
                </div>
                {!isCollapsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="overflow-hidden whitespace-nowrap"
                    >
                        <h2 className="text-xl font-bold tracking-tight">VestikPOS</h2>
                    </motion.div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => clsx(
                            "flex items-center rounded-xl transition-all duration-200 group relative",
                            isCollapsed ? "justify-center p-3" : "px-4 py-3 gap-3",
                            isActive
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                                : "text-blue-600 hover:bg-blue-600 hover:text-white"
                        )}
                        title={isCollapsed ? item.label : undefined}
                    >
                        <item.icon className={clsx("flex-shrink-2", isCollapsed ? "w-6 h-6" : "w-5 h-5")} />
                        {!isCollapsed && (
                            <span className="font-medium whitespace-nowrap overflow-hidden">
                                {item.label}
                            </span>
                        )}
                        {/* Tooltip-ish for collapsed state could be added here if needed, but 'title' attribute works for basic needs */}
                    </NavLink>
                ))}
            </nav>

            {/* Footer / Toggle & Logout */}
            <div className="p-3 border-t border-slate-200 space-y-2">

                {/* Toggle Button */}
                <button
                    onClick={toggleCollapse}
                    className={clsx(
                        "flex items-center justify-center w-full p-2 rounded-lg text-white transition-colors",
                        !isCollapsed && "bg-blue-600"
                    )}
                >
                    {isCollapsed ? <ChevronRight size={25} className="cursor-pointer text-blue-600" /> : (
                        <div className="flex items-center gap-2">
                            <ChevronLeft size={25} />
                            <span className="text-xs font-semibold uppercase tracking-wider">Colapsar</span>
                        </div>
                    )}
                </button>

                <div className="w-full h-px bg-slate-200 my-1" />

                <button
                    onClick={handleLogout}
                    className={clsx(
                        "flex items-center justify-center rounded-lg text-red-500 hover:text-red-400 hover:bg-red-400/10 transition-colors",
                        isCollapsed ? "justify-center p-3" : "px-4 py-2 gap-3 w-full"
                    )}
                    title="Cerrar Sesión"
                >
                    <LogOut className={clsx("flex-shrink-2", isCollapsed ? "w-5 h-5" : "w-4 h-4")} />
                    {!isCollapsed && (
                        <span className="text-sm font-medium">Cerrar Sesión</span>
                    )}
                </button>
            </div>
        </motion.aside>
    );
};

export default Sidebar;
