import React from 'react';
import { Menu, User, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavbarProps {
    toggleSidebar: () => void;
    isSidebarOpen: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ toggleSidebar, isSidebarOpen }) => {

    const { user } = useAuth();

    return (
        <nav className="h-16 bg-slate-200 border-b border-slate-200 flex items-center justify-between px-6 z-10 shadow-sm">
            <div className="flex items-center gap-4">
                <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-lg hover:bg-gray-300 text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                >
                    <Menu className="w-6 h-6" />
                </button>
                {/* You can add breadcrumbs or page title here if needed */}
            </div>

            <div className="flex items-center gap-4">
                {/* Right side icons / User profile */}
                <button className="p-2 rounded-full cursor-pointer hover:bg-gray-300 text-blue-600 transition-colors relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-gray-700">{user?.name || 'User'}</p>
                        <p className="text-xs text-gray-500 capitalize">{user?.role || 'Role'}</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shadow-sm">
                        {user?.name?.charAt(0).toUpperCase() || <User className="w-5 h-5" />}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
