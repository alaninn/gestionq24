// =============================================
// ARCHIVO: src/components/admin/Dashboard.jsx
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import SaludNegocio from './SaludNegocio';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0
}).format(n || 0);

const fmtCorto = (n) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
};

const COLORES_METODO = {
  efectivo: '#10b981',
  tarjeta: '#3b82f6',
  mercadopago: '#8b5cf6',
  transferencia: '#f59e0b',
  cuenta_corriente: '#ef4444',
};

const COLORES_PIE = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

function Dashboard() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [periodo, setPeriodo] = useState('mes');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const res = await api.get('/api/reportes/dashboard');
      setDatos(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  if (cargando) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Cargando dashboard...</p>
      </div>
    </div>
  );

  if (!datos) return null;

  const { stats, ventasPorDia, ventasPorMetodo, topProductos, comparacion } = datos;

  // Formateamos fechas para el gráfico
  const datosGrafico = ventasPorDia.map(d => ({
    dia: new Date(d.dia).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    total: parseFloat(d.total),
    ventas: parseInt(d.cantidad),
  }));

  // Datos para el pie chart de métodos de pago
  const datosPie = ventasPorMetodo.map(m => ({
    name: m.metodo_pago.charAt(0).toUpperCase() + m.metodo_pago.slice(1).replace('_', ' '),
    value: parseFloat(m.total),
    metodo: m.metodo_pago,
  }));

  // Comparación hoy vs ayer
  const varPct = comparacion.ayer > 0
    ? ((comparacion.hoy - comparacion.ayer) / comparacion.ayer * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">

      {/* Título */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
          <p className="text-gray-500">Resumen del negocio — {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={cargarDatos}
          className="bg-white border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm text-gray-600 transition-colors shadow-sm">
          🔄 Actualizar
        </button>
      </div>

      {/* Widget de Salud del Negocio */}
      <SaludNegocio />

      {/* Tarjetas de stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl p-5 shadow-lg">
          <p className="text-green-100 text-sm font-medium">VENTAS DEL MES</p>
          <p className="text-3xl font-bold mt-2">{fmt(stats.facturado_mes)}</p>
          <p className="text-green-100 text-sm mt-1">{stats.ventas_mes} ventas realizadas</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow border-l-4 border-red-400">
          <p className="text-gray-500 text-sm font-medium">GASTOS DEL MES</p>
          <p className="text-3xl font-bold text-red-500 mt-2">{fmt(stats.gastos_mes)}</p>
          <p className="text-gray-400 text-sm mt-1">Egresos operativos</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow border-l-4 border-blue-400">
          <p className="text-gray-500 text-sm font-medium">GANANCIA NETA</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {fmt(parseFloat(stats.facturado_mes) - parseFloat(stats.gastos_mes))}
          </p>
          <p className="text-gray-400 text-sm mt-1">Ventas - Gastos</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow border-l-4 border-purple-400">
          <p className="text-gray-500 text-sm font-medium">DEUDAS TOTALES</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{fmt(stats.total_deudas)}</p>
          <p className="text-gray-400 text-sm mt-1">Cuentas corrientes</p>
        </div>
      </div>

      {/* Hoy vs Ayer */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow">
          <p className="text-gray-500 text-xs uppercase font-medium">HOY</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(comparacion.hoy)}</p>
          <div className={`flex items-center gap-1 mt-1 text-sm ${parseFloat(varPct) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            <span>{parseFloat(varPct) >= 0 ? '↑' : '↓'}</span>
            <span>{Math.abs(varPct)}% vs ayer</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow">
          <p className="text-gray-500 text-xs uppercase font-medium">AYER</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(comparacion.ayer)}</p>
          <p className="text-gray-400 text-sm mt-1">{comparacion.ventas_ayer} ventas</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow">
          <p className="text-gray-500 text-xs uppercase font-medium">PRODUCTOS</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total_productos}</p>
          <p className="text-gray-400 text-sm mt-1">activos en stock</p>
        </div>
        <div className={`rounded-xl p-4 shadow ${parseInt(stats.stock_bajo) > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-white'}`}>
          <p className="text-gray-500 text-xs uppercase font-medium">STOCK BAJO</p>
          <p className={`text-2xl font-bold mt-1 ${parseInt(stats.stock_bajo) > 0 ? 'text-orange-500' : 'text-gray-800'}`}>
            {stats.stock_bajo}
          </p>
          <p className="text-gray-400 text-sm mt-1">productos a reponer</p>
        </div>
      </div>

      {/* Gráfico de ventas por día */}
      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Ventas últimos 30 días</h3>
            <p className="text-gray-400 text-sm">Evolución diaria de facturación</p>
          </div>
        </div>
        {datosGrafico.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <div className="text-center">
              <p className="text-4xl mb-2">📊</p>
              <p>Sin datos de ventas todavía</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={datosGrafico} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} />
              <YAxis tickFormatter={fmtCorto} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value) => [fmt(value), 'Facturación']}
                labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2.5}
                fill="url(#colorVentas)" dot={false} activeDot={{ r: 5, fill: '#10b981' }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top productos */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🏆 Top Productos del Mes</h3>
          {topProductos.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <p>Sin ventas este mes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topProductos.map((p, i) => {
                const maxCant = topProductos[0]?.cantidad_vendida || 1;
                const pct = (p.cantidad_vendida / maxCant) * 100;
                const colores = ['bg-yellow-400', 'bg-gray-300', 'bg-orange-400', 'bg-green-400', 'bg-blue-400'];
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full ${colores[i]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-medium text-gray-700 truncate">{p.nombre_producto}</p>
                        <p className="text-sm font-bold text-gray-800 ml-2 flex-shrink-0">{p.cantidad_vendida} u.</p>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`${colores[i]} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{fmt(p.total_facturado)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Métodos de pago */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">💳 Métodos de Pago del Mes</h3>
          {datosPie.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <p>Sin ventas este mes</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={datosPie} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    paddingAngle={3} dataKey="value">
                    {datosPie.map((entry, index) => (
                      <Cell key={index}
                        fill={COLORES_METODO[entry.metodo] || COLORES_PIE[index % COLORES_PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(value)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {datosPie.map((m, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORES_METODO[m.metodo] || COLORES_PIE[i % COLORES_PIE.length] }}></div>
                      <span className="text-sm text-gray-600 capitalize">{m.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-800">{fmt(m.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico de barras top productos */}
      {topProductos.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">📦 Facturación por Producto</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topProductos.map(p => ({
              name: p.nombre_producto.length > 15 ? p.nombre_producto.substring(0, 15) + '...' : p.nombre_producto,
              total: parseFloat(p.total_facturado),
            }))} margin={{ top: 5, right: 10, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false}
                angle={-20} textAnchor="end" />
              <YAxis tickFormatter={fmtCorto} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => [fmt(value), 'Facturado']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]}>
                {topProductos.map((_, index) => (
                  <Cell key={index} fill={COLORES_PIE[index % COLORES_PIE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}

export default Dashboard;