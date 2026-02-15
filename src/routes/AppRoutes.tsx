import { Routes, Route } from "react-router-dom";
import LoginPage from "@/features/auth/pages/LoginPage.tsx";
import HomePage from "@/features/user/pages/HomePage.tsx";
import MainLayout from "@/features/user/layouts/MainLayout.tsx";
import DashboardPage from "@/features/user/pages/DashboardPage.tsx";
import POSPage from "@/features/user/pages/POSPage.tsx";
import InventoryPage from "@/features/user/pages/InventoryPage.tsx";
import FinancePage from "@/features/user/pages/FinancePage.tsx";
import ReportsPage from "@/features/user/pages/ReportsPage.tsx";
import SettingsPage from "@/features/user/pages/SettingsPage.tsx";
import StoresPage from "@/features/stores/pages/StoresPage.tsx";

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route element={<MainLayout />}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/pos" element={<POSPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/stores" element={<StoresPage />} />
                <Route path="/settings" element={<SettingsPage />} />
            </Route>
        </Routes>
    );
};

export default AppRoutes;