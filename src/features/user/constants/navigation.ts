import { 
    LayoutDashboard, 
    ShoppingCart, 
    Package, 
    DollarSign, 
    BarChart3, 
    Settings, 
    Store, 
    ClipboardList 
} from 'lucide-react';

export const NAV_ITEMS = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: ShoppingCart, label: 'Punta de Venta', path: '/pos' },
    { icon: ClipboardList, label: 'Ventas', path: '/sales' },
    { icon: Package, label: 'Inventario', path: '/inventory' },
    { icon: DollarSign, label: 'Finanzas', path: '/finance' },
    { icon: BarChart3, label: 'Reportes', path: '/reports' },
    { icon: Store, label: 'Tiendas', path: '/stores' },
    { icon: Settings, label: 'Configuración', path: '/settings' },
];
