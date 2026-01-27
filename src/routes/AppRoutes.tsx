import { Routes, Route } from "react-router-dom";
import LoginPage from "@/features/auth/pages/LoginPage.tsx";
import HomePage from "@/features/user/pages/HomePage.tsx";

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/home" element={<HomePage />} />
        </Routes>
    );
};

export default AppRoutes;