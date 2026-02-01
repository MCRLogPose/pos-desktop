import { useState } from "react";
import { BarChart3, TrendingUp, PieChart, Download } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar} from "recharts";
import { clsx } from "clsx";

const SALES_DATA = [
  { name: "Ene", ventas: 12000, utilidad: 4000 },
  { name: "Feb", ventas: 14000, utilidad: 4800 },
  { name: "Mar", ventas: 11000, utilidad: 3500 },
  { name: "Abr", ventas: 16000, utilidad: 6000 },
  { name: "May", ventas: 15000, utilidad: 5200 },
  { name: "Jun", ventas: 18000, utilidad: 7000 },
];

const CATEGORY_DATA = [
  { name: "Café", valor: 4500 },
  { name: "Pastelería", valor: 3200 },
  { name: "Comida", valor: 5800 },
  { name: "Bebidas", valor: 2100 },
];

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState<
    "sales" | "profit" | "products"
  >("sales");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Reportes
          </h1>
          <p className="text-gray-500">
            Análisis detallado de tu negocio
          </p>
        </div>
        <div className="flex gap-3">
          <select className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>Este Mes</option>
            <option>Mes Pasado</option>
            <option>Últimos 3 Meses</option>
            <option>Este Año</option>
          </select>
          <button className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl font-medium transition-colors">
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 rounded-xl bg-gray-100/50 p-1 w-fit">
        <button
          onClick={() => setActiveTab("sales")}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            activeTab === "sales"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-500 hover:text-gray-900",
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Ventas
        </button>
        <button
          onClick={() => setActiveTab("profit")}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            activeTab === "profit"
              ? "bg-white text-green-600 shadow-sm"
              : "text-gray-500 hover:text-gray-900",
          )}
        >
          <TrendingUp className="w-4 h-4" />
          Utilidad
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            activeTab === "products"
              ? "bg-white text-purple-600 shadow-sm"
              : "text-gray-500 hover:text-gray-900",
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
            {activeTab === "profit" && "Margen de Utilidad"}
            {activeTab === "products" && "Ventas por Categoría"}
          </h3>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === "sales" ? (
                <AreaChart data={SALES_DATA}>
                  <defs>
                    <linearGradient
                      id="colorSales"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#3b82f6"
                        stopOpacity={0.1}
                      />
                      <stop
                        offset="95%"
                        stopColor="#3b82f6"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b" }}
                  />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                </AreaChart>
              ) : activeTab === "profit" ? (
                <BarChart data={SALES_DATA}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b" }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="utilidad"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              ) : (
                <BarChart
                  data={CATEGORY_DATA}
                  layout="vertical"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="valor"
                    fill="#8b5cf6"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* KPIs Side Panel */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="text-gray-500 text-sm font-medium mb-1">
              Total Ventas (Anual)
            </h4>
            <p className="text-3xl font-bold text-gray-900">
              S/ 185,400
            </p>
            <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              +15% vs año anterior
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="text-gray-500 text-sm font-medium mb-1">
              Ticket Promedio
            </h4>
            <p className="text-3xl font-bold text-gray-900">
              S/ 42.50
            </p>
            <div className="mt-2 text-sm text-gray-500">
              Promedio por cliente
            </div>
          </div>

          <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-lg shadow-blue-600/30">
            <h4 className="text-blue-100 text-sm font-medium mb-1">
              Utilidad Neta Estimada
            </h4>
            <p className="text-3xl font-bold">S/ 62,500</p>
            <div className="w-full bg-blue-500/50 rounded-full h-1.5 mt-4">
              <div className="bg-white h-full rounded-full w-[75%]" />
            </div>
            <p className="text-xs text-blue-200 mt-2">
              75% del objetivo anual
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;