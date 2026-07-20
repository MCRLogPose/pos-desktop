import { 
    LayoutDashboard, 
    ShoppingCart, 
    Package, 
    DollarSign, 
    BarChart3, 
    Settings, 
    Store, 
    ClipboardList,
    Receipt 
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
    { icon: Package, label: 'Inventario', path: '/inventory' },
    { icon: Receipt, label: 'Gastos', path: '/expenses' },
    { icon: DollarSign, label: 'Finanzas', path: '/finance' },
    { icon: BarChart3, label: 'Reportes', path: '/reports' },
    { icon: Store, label: 'Tiendas', path: '/stores' },
    { icon: Settings, label: 'Configuración', path: '/settings' },
];

// Primary: Dashboard, Ventas, Inventario, Gastos, Reportes, Tiendas (read-only), Configuración
// Replica: Punto de Venta, Ventas, Inventario, Finanzas, Tiendas, Configuración
// Hybrid: Todo
const MODE_VISIBILITY: Record<OperatingMode, string[]> = {
    primary: [
        '/dashboard', '/sales', '/inventory', '/expenses',
        '/reports', '/stores', '/settings',
    ],
    replica: [
        '/pos', '/sales', '/inventory', '/finance',
        '/stores', '/settings',
    ],
    hybrid: ALL_NAV_ITEMS.map((item) => item.path),
};

export function getNavItems(mode: OperatingMode): NavItem[] {
    const allowed = MODE_VISIBILITY[mode];
    return ALL_NAV_ITEMS.filter((item) => allowed.includes(item.path));
}
