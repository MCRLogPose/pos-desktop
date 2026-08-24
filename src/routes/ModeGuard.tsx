import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useConfig } from "@/context/ConfigContext";
import { getNavItems } from "@/features/user/constants/navigation";

/**
 * Restringe el acceso por URL a rutas no permitidas segun el modo de operacion.
 * La fuente de verdad es la misma visibilidad de navegacion (getNavItems).
 */
export function ModeGuard() {
    const { operatingMode, loading } = useConfig();
    const location = useLocation();

    if (loading) return null;

    const allowed = getNavItems(operatingMode).some(
        (item) => item.path === location.pathname,
    );

    if (!allowed) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}
