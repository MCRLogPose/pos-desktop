import { useState, useEffect, useMemo } from "react";
import { BarChart3, TrendingUp, PieChart, Download, Package } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { clsx } from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { useNotification } from "@/context/NotificationContext";

// ─── Types ────────────────────────────────────────────────────
interface Sale {
  id: number;
  total: number;
  created_at: string;
}

interface Product {
  id: number;
  name: string;
  category_name?: string;
  stock: number;
  price: number;
}

interface Expense {
  amount: number;
  created_at: string;
}

interface OtherIncome {
  amount: number;
  created_at: string;
}

type Period = "this_month" | "last_month" | "last_3_months" | "this_year";

const ReportsPage = () => {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<"sales" | "profit" | "products">("sales");
  const [period, setPeriod] = useState<Period>("this_month");
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [otherIncome, setOtherIncome] = useState<OtherIncome[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [s, p, e, i] = await Promise.all([
        invoke<Sale[]>("get_sales"),
        invoke<Product[]>("get_products"),
        invoke<Expense[]>("get_all_expenses"),
        invoke<OtherIncome[]>("get_all_other_income"),
      ]);
      setSales(s);
      setProducts(p);
      setExpenses(e);
      setOtherIncome(i);
    } catch (err) {
      console.error(err);
      showNotification("error", "Error", "No se pudieron cargar los datos de reportes");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Filtering Logic ────────────────────────────────────────
  const filteredData = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (period === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "last_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === "last_3_months") {
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else if (period === "this_year") {
      start = new Date(now.getFullYear(), 0, 1);
    }

    const filterFn = (item: { created_at: string }) => {
      const d = new Date(item.created_at);
      return d >= start && d <= end;
    };

    return {
      sales: sales.filter(filterFn),
      expenses: expenses.filter(filterFn),
      otherIncome: otherIncome.filter(filterFn),
    };
  }, [sales, expenses, otherIncome, period]);

  // ─── Chart Aggregation ──────────────────────────────────────
  const salesChartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredData.sales.forEach(s => {
      const date = s.created_at.split("T")[0];
      map[date] = (map[date] || 0) + s.total;
    });
    return Object.entries(map)
      .map(([name, ventas]) => ({ name, ventas }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData.sales]);

  const profitChartData = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    
    filteredData.sales.forEach(s => {
      const date = s.created_at.split(" ")[0]; // Check date format
      const d = date.includes("T") ? date.split("T")[0] : date;
      if (!map[d]) map[d] = { income: 0, expense: 0 };
      map[d].income += s.total;
    });

    filteredData.otherIncome.forEach(i => {
      const d = i.created_at.split(" ")[0];
      if (!map[d]) map[d] = { income: 0, expense: 0 };
      map[d].income += i.amount;
    });

    filteredData.expenses.forEach(e => {
      const d = e.created_at.split(" ")[0];
      if (!map[d]) map[d] = { income: 0, expense: 0 };
      map[d].expense += e.amount;
    });

    return Object.entries(map)
      .map(([name, data]) => ({ name, utilidad: data.income - data.expense }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      const cat = p.category_name || "Sin Categoría";
      map[cat] = (map[cat] || 0) + p.stock;
    });
    return Object.entries(map).map(([name, valor]) => ({ name, valor }));
  }, [products]);

  // ─── KPI Calculations ───────────────────────────────────────
  const kpis = useMemo(() => {
    const totalSales = filteredData.sales.reduce((sum, s) => sum + s.total, 0);
    const totalOtherIncome = filteredData.otherIncome.reduce((sum, i) => sum + i.amount, 0);
    const totalExpenses = filteredData.expenses.reduce((sum, e) => sum + e.amount, 0);
    
    return {
      totalSales,
      avgTicket: filteredData.sales.length > 0 ? totalSales / filteredData.sales.length : 0,
      netProfit: (totalSales + totalOtherIncome) - totalExpenses
    };
  }, [filteredData]);

  const handlePrint = () => {
    window.print();
    showNotification("success", "PDF", "Preparando reporte para impresión");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Cargando reportes...</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Print-only Header */}
      <div className="hidden print:block mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Reporte de Negocio</h1>
        <p className="text-gray-500">Periodo: {
          period === "this_month" ? "Este Mes" : 
          period === "last_month" ? "Mes Pasado" : 
          period === "last_3_months" ? "Últimos 3 Meses" : "Este Año"
        }</p>
        <p className="text-sm text-gray-400 mt-2">Generado el: {new Date().toLocaleString()}</p>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500">Análisis detallado de tu negocio</p>
        </div>
        <div className="flex gap-3">
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="this_month">Este Mes</option>
            <option value="last_month">Mes Pasado</option>
            <option value="last_3_months">Últimos 3 Meses</option>
            <option value="this_year">Este Año</option>
          </select>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h4 className="text-gray-500 text-sm font-medium mb-1">Ventas Totales</h4>
          <p className="text-3xl font-bold text-gray-900">S/ {kpis.totalSales.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <h4 className="text-gray-500 text-sm font-medium mb-1">Ticket Promedio</h4>
          <p className="text-3xl font-bold text-gray-900">S/ {kpis.avgTicket.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
        </div>

        <div className={clsx(
          "p-6 rounded-2xl text-white shadow-lg transition-all hover:scale-[1.02]",
          kpis.netProfit >= 0 ? "bg-green-600 shadow-green-600/30" : "bg-red-600 shadow-red-600/30"
        )}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
          <h4 className="text-white/80 text-sm font-medium mb-1">Utilidad Neta</h4>
          <p className="text-3xl font-bold">S/ {kpis.netProfit.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="flex space-x-1 rounded-xl bg-gray-100/50 p-1 w-fit print:hidden">
        <button
          onClick={() => setActiveTab("sales")}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            activeTab === "sales" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Ventas
        </button>
        <button
          onClick={() => setActiveTab("profit")}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            activeTab === "profit" ? "bg-white text-green-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
          )}
        >
          <TrendingUp className="w-4 h-4" />
          Utilidad
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            activeTab === "products" ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
          )}
        >
          <PieChart className="w-4 h-4" />
          Productos
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm min-h-[400px]">
          <h3 className="text-lg font-bold text-gray-900 mb-6">
            {activeTab === "sales" && "Evolución de Ventas"}
            {activeTab === "profit" && "Flujo de Utilidad"}
            {activeTab === "products" && "Stock por Categoría"}
          </h3>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === "sales" ? (
                <AreaChart data={salesChartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <Tooltip />
                  <Area type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              ) : activeTab === "profit" ? (
                <BarChart data={profitChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <Tooltip />
                  <Bar dataKey="utilidad" radius={[4, 4, 0, 0]}>
                    {profitChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.utilidad >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} />
                  <Tooltip />
                  <Bar dataKey="valor" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Panel showing top products for period */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
           <h3 className="text-lg font-bold text-gray-900 mb-6">Resumen de Inventario</h3>
           <div className="space-y-4">
             <div className="flex justify-between items-center py-3 border-b border-gray-50">
               <span className="text-gray-500">Valor Total Estimado</span>
               <span className="font-bold">S/ {products.reduce((sum, p) => sum + (p.stock * p.price), 0).toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center py-3 border-b border-gray-50">
               <span className="text-gray-500">Items en Stock</span>
               <span className="font-bold">{products.reduce((sum, p) => sum + p.stock, 0)}</span>
             </div>
             <div className="flex justify-between items-center py-3 border-b border-gray-50">
               <span className="text-gray-500">Categorías Activas</span>
               <span className="font-bold">{new Set(products.map(p => p.category_name)).size}</span>
             </div>
           </div>
           
           <div className="mt-8">
             <h4 className="text-sm font-semibold text-gray-900 mb-4">Recomendación</h4>
             <div className="p-4 bg-amber-50 rounded-xl flex gap-3">
               <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                 <Package className="w-4 h-4 text-amber-600" />
               </div>
               <p className="text-xs text-amber-800 leading-relaxed">
                 {products.some(p => p.stock < 5) 
                   ? "Atención: Tienes productos con bajo stock. Considera reponer inventario pronto." 
                   : "El nivel de inventario es saludable para las ventas proyectadas."}
               </p>
             </div>
           </div>
        </div>
      </div>
      
      {/* Print-only content */}
      <div className="hidden print:block space-y-8">
        {/* KPI Summary Row */}
        <div className="grid grid-cols-3 gap-4 pb-6 border-b">
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Ventas Totales</p>
            <p className="text-xl font-bold text-gray-900">S/ {kpis.totalSales.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Ticket Promedio</p>
            <p className="text-xl font-bold text-gray-900">S/ {kpis.avgTicket.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Utilidad Neta</p>
            <p className="text-xl font-bold text-green-600">S/ {kpis.netProfit.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-2 gap-8">
          <div className="h-[280px] border p-4 rounded-xl">
            <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Evolución de Ventas
            </h4>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData}>
                <XAxis dataKey="name" tick={{fontSize: 10}} />
                <YAxis tick={{fontSize: 10}} />
                <Area 
                  type="monotone" 
                  dataKey="ventas" 
                  stroke="#3b82f6" 
                  fill="#3b82f644" 
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="h-[280px] border p-4 rounded-xl">
            <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Flujo de Utilidad
            </h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitChartData}>
                <XAxis dataKey="name" tick={{fontSize: 10}} />
                <YAxis tick={{fontSize: 10}} />
                <Bar dataKey="utilidad" isAnimationActive={false}>
                  {profitChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.utilidad >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="h-[280px] border p-4 rounded-xl col-span-2">
            <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-600" />
              Distribución de Inventario por Categoría
            </h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{fontSize: 10}} width={100} />
                <Bar 
                  dataKey="valor" 
                  fill="#8b5cf6" 
                  radius={[0, 4, 4, 0]} 
                  barSize={20}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pt-10 border-t">
          <p className="text-center text-gray-400 text-[10px]">
            Este documento es un reporte generado automáticamente por el sistema POS. 
            © {new Date().getFullYear()} Reportes de Negocio.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;