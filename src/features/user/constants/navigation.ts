import { 
    LayoutDashboard, 
    ShoppingCart, 
    Package, 
    DollarSign, 
    BarChart3, 
    Settings, 
    Store, 
    ClipboardList,
    Receipt,
    XCircle
} from 'lucide-react';

type OperatingMode = 'primary' | 'replica' | 'hybrid';

interface NavItem {
    icon: typeof LayoutDashboard;
    label: string;
    path: string;
}

const ALL_NAV_ITEMS: NavItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: ShoppingCart, label: 'Punta de Venta', path: '/pos' },
    { icon: ClipboardList, label: 'Ventas', path: '/sales' },
    { icon: XCircle, label: 'Anulados', path: '/anulados' },
    { icon: Package, label: 'Inventario', path: '/inventory' },
    { icon: Receipt, label: 'Gastos', path: '/expenses' },
    { icon: DollarSign, label: 'Finanzas', path: '/finance' },
    { icon: BarChart3, label: 'Reportes', path: '/reports' },
    { icon: Store, label: 'Tiendas', path: '/stores' },
    { icon: Settings, label: 'Configuración', path: '/settings' },
];

// Políticas de visibilidad por modo (la edición se restringe además por página y backend):
// Primary: Dashboard, Ventas, Inventario (read-only), Gastos (propios), Finanzas (read-only),
//          Reportes, Tiendas/Usuarios (read-only), Configuración. Sin Punto de Venta.
// Replica: Punto de Venta, Ventas, Inventario, Finanzas, Tiendas, Configuración.
//          Sin Gastos ni Reportes.
// Hybrid: Todo (modo de pruebas local).
const MODE_VISIBILITY: Record<OperatingMode, string[]> = {
    primary: [
        '/dashboard', '/sales', '/anulados', '/inventory', '/expenses', '/finance',
        '/reports', '/stores', '/settings',
    ],
    replica: [
        '/dashboard', '/pos', '/sales', '/anulados', '/inventory', '/finance',
        '/stores', '/settings',
    ],
    hybrid: ALL_NAV_ITEMS.map((item) => item.path),
};

export function getNavItems(mode: OperatingMode): NavItem[] {
    const allowed = MODE_VISIBILITY[mode];
    return ALL_NAV_ITEMS.filter((item) => allowed.includes(item.path));
}
