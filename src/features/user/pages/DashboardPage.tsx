import { useState, useEffect, useMemo } from 'react';
import { DollarSign, ShoppingBag, Box, CreditCard, Calendar, Package } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────
interface Product {
  id: i64;
  code: string | null;
  name: string;
  stock: number;
}

interface Sale {
  id: i64;
  total: number;
  created_at: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  subtotal: number;
  product_id?: i64;
}


type i64 = number;

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
    <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
  </div>
);

const DashboardPage = () => {
  const { showNotification } = useNotification();
  const { activeStoreId } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [expenses, setExpenses] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeStoreId) {
      loadDashboardData();
    }
  }, [activeStoreId]);

  const loadDashboardData = async () => {
    if (!activeStoreId) return;
    setIsLoading(true);
    try {
      const [salesData, productsData, itemsData] = await Promise.all([
        invoke<Sale[]>('get_sales', { storeId: activeStoreId }),
        invoke<Product[]>('get_products', { storeId: activeStoreId }),
        invoke<OrderItem[]>('get_all_order_items', { storeId: activeStoreId }),
      ]);

      setSales(salesData);
      setProducts(productsData);
      setOrderItems(itemsData);

      // Fetch active session expenses if any
      const activeSession = await invoke<any>('get_active_cash_session', { storeId: activeStoreId });
      if (activeSession) {
        const transactions = await invoke<any[]>('get_cash_session_transactions', { sessionId: activeSession.id });
        const totalExpenses = transactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + (t.amount as number), 0);
        setExpenses(totalExpenses);
      }
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'Error al cargar datos del dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Stats Aggregation ──────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.created_at.startsWith(today));
    
    return {
      totalSales: todaySales.reduce((sum, s) => sum + s.total, 0),
      ordersCount: todaySales.length,
      inventoryCount: products.reduce((sum, p) => sum + p.stock, 0),
      todayExpenses: expenses
    };
  }, [sales, products, expenses]);

  // ─── Chart Data ─────────────────────────────────────────────
  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const daysMap = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

    return last7Days.map(date => {
      const daySales = sales.filter(s => s.created_at.startsWith(date));
      const total = daySales.reduce((sum, s) => sum + s.total, 0);
      const d = new Date(date + 'T00:00:00');
      return {
        name: daysMap[d.getDay()],
        ventas: total
      };
    });
  }, [sales]);

  // ─── Top Products ───────────────────────────────────────────
  const topProducts = useMemo(() => {
    const aggregated: Record<string, { quantity: number; name: string; code: string | null }> = {};
    
    orderItems.forEach(item => {
      if (!aggregated[item.product_name]) {
        // Find product to get code
        const prod = products.find(p => p.name === item.product_name);
        aggregated[item.product_name] = { 
          quantity: 0, 
          name: item.product_name,
          code: prod?.code || null
        };
      }
      aggregated[item.product_name].quantity += item.quantity;
    });

    return Object.values(aggregated)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 4);
  }, [orderItems, products]);

  const handleExportCSV = () => {
    if (orderItems.length === 0) return;
    
    const headers = ['ID Orden', 'Fecha', 'Cliente', 'Doc', 'Metodo', 'Producto', 'P. Unit', 'Cant', 'Subtotal'];
    const rows = orderItems.map((item: any) => [
      item.order_id,
      item.created_at,
      item.client_name || '',
      item.client_document || '',
      item.payment_method,
      item.product_name,
      item.unit_price,
      item.quantity,
      item.subtotal
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_completo_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('success', 'Éxito', 'Reporte descargado correctamente');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-medium">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Resumen de actividad del día</p>
        </div>
        <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Calendar className="w-4 h-4" />
              Hoy: {new Date().toLocaleDateString('es-PE')}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Ventas Totales (Hoy)" 
          value={`S/ ${stats.totalSales.toFixed(2)}`} 
          icon={DollarSign} 
          color="bg-green-500 text-green-600" 
        />
        <StatCard 
          title="Ordenes (Hoy)" 
          value={stats.ordersCount} 
          icon={ShoppingBag} 
          color="bg-blue-500 text-blue-600" 
        />
        <StatCard 
          title="Stock Total" 
          value={stats.inventoryCount} 
          icon={Package} 
          color="bg-purple-500 text-purple-600" 
        />
        <StatCard 
          title="Gastos (Hoy)" 
          value={`S/ ${stats.todayExpenses.toFixed(2)}`} 
          icon={CreditCard} 
          color="bg-orange-500 text-orange-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Resumen de Ingresos (Últimos 7 días)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(value) => `S/${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1e293b' }}
                  formatter={(value) => [`S/ ${value}`, 'Monto']}
                />
                <Area type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorVentas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Productos Más Vendidos</h3>
          <div className="space-y-6">
            {topProducts.length > 0 ? topProducts.map((product, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-0.5">
                    <span className="font-medium text-gray-900 line-clamp-1">{product.name}</span>
                    <span className="text-sm text-gray-500 shrink-0">{product.quantity} und.</span>
                  </div>
                  {product.code && (
                    <div className="text-[10px] text-gray-400 font-mono mb-1 uppercase">SKU: {product.code}</div>
                  )}
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full" 
                      style={{ width: `${Math.min((product.quantity / (topProducts[0].quantity || 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 italic">
                <Box className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">No hay ventas registradas</p>
              </div>
            )}
          </div>
          <button 
            onClick={handleExportCSV}
            className="w-full mt-8 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center justify-center gap-2 border border-blue-100"
          >
            Ver Reporte Completo (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;