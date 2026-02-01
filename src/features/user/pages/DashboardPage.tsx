import { DollarSign, ShoppingBag, Users, TrendingUp, CreditCard, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const salesData = [
  { name: 'Lun', ventas: 4000, costo: 2400 },
  { name: 'Mar', ventas: 3000, costo: 1398 },
  { name: 'Mie', ventas: 2000, costo: 9800 },
  { name: 'Jue', ventas: 2780, costo: 3908 },
  { name: 'Vie', ventas: 1890, costo: 4800 },
  { name: 'Sab', ventas: 2390, costo: 3800 },
  { name: 'Dom', ventas: 3490, costo: 4300 },
];

const topProducts = [
  { name: 'Café Americano', sales: 120 },
  { name: 'Capuchino', sales: 98 },
  { name: 'Tarta de Queso', sales: 86 },
  { name: 'Sandwich Mixto', sales: 75 },
];

const StatCard = ({ title, value, trend, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div className={`flex items-center gap-1 text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {trend >= 0 ? '+' : ''}{trend}%
        <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
      </div>
    </div>
    <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
  </div>
);

const DashboardPage = () => {
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
          title="Ventas Totales" 
          value="S/ 12,450.00" 
          trend={12.5} 
          icon={DollarSign} 
          color="bg-green-500 text-green-600" 
        />
        <StatCard 
          title="Ordenes" 
          value="145" 
          trend={5.2} 
          icon={ShoppingBag} 
          color="bg-blue-500 text-blue-600" 
        />
        <StatCard 
          title="Clientes Nuevos" 
          value="32" 
          trend={-2.4} 
          icon={Users} 
          color="bg-purple-500 text-purple-600" 
        />
        <StatCard 
          title="Gastos" 
          value="S/ 3,200.00" 
          trend={8.1} 
          icon={CreditCard} 
          color="bg-orange-500 text-orange-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Resumen de Ingresos</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
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
            {topProducts.map((product, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-gray-900">{product.name}</span>
                    <span className="text-sm text-gray-500">{product.sales} und.</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full" 
                      style={{ width: `${(product.sales / 150) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
            Ver Reporte Completo
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;