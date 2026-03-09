import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layouts/Sidebar';
import Navbar from '../components/layouts/Navbar';
import { useCash } from '@/context/CashContext';
import OpenCashModal from '../components/modals/OpenCashModal';
import SessionSummaryModal from '../components/modals/SessionSummaryModal';

const MainLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showSummary, setShowSummary] = useState(true);
    const { activeSession, isLoading, lastClosedSession } = useCash();

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const toggleCollapse = () => setIsSidebarCollapsed(!isSidebarCollapsed);

    return (
        <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
            {isSidebarOpen && (
                <Sidebar
                    isCollapsed={isSidebarCollapsed}
                    toggleCollapse={toggleCollapse}
                />
            )}

            <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-gray-50/50">
                <Navbar toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
                <main className="flex-1 overflow-y-auto p-4">
                    <Outlet />
                </main>
            </div>

            <SessionSummaryModal
                session={!activeSession && !isLoading && showSummary ? lastClosedSession : null}
                onClose={() => setShowSummary(false)}
            />

            <OpenCashModal 
                isOpen={!activeSession && !isLoading && (!lastClosedSession || !showSummary)} 
                onClose={() => {}} // Cannot close without opening if we want to force it
            />
        </div>
    );
};

export default MainLayout;