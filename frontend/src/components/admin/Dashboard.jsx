// =============================================
// ARCHIVO: src/components/admin/Dashboard.jsx
// Dashboard Interactivo y Moderno
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
  const [error, setError] = useState(false);
  const [periodo, setPeriodo] = useState('30d');
  const [tipoGrafico, setTipoGrafico] = useState('area');
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [mostrarStockBajo, setMostrarStockBajo] = useState(false);
  const [productosStockBajo, setProductosStockBajo] = useState([]);
  const [cargandoStock, setCargandoStock] = useState(false);
  const [datosFiltrados, setDatosFiltrados] = useState(null);

  useEffect(() => {
    cargarDatos();
    // Auto-actualizar cada 5 minutos
    const intervalo = setInterval(cargarDatos, 5 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (datos?.ventasPorDia) {
      filtrarDatosPorPeriodo();
    }
  }, [periodo, datos]);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(false);
      const res = await api.get('/api/reportes/dashboard');
      setDatos(res.data);
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error('Error:', err);
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  const filtrarDatosPorPeriodo = () => {
    if (!datos?.ventasPorDia) return;
    
    const diasAtras = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '180d': 180,
      '365d': 365
    }[periodo] || 30;

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasAtras);

    const filtrados = datos.ventasPorDia.filter(d => {
      const fechaVenta = new Date(d.dia);
      return fechaVenta >= fechaLimite;
    });

    setDatosFiltrados(filtrados);
  };

  const verStockBajo = async () => {
    setMostrarStockBajo(true);
    if (productosStockBajo.length > 0) return;
    try {
      setCargandoStock(true);
      const res = await api.get('/api/productos/stock-bajo');
      setProductosStockBajo(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargandoStock(false);
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

if (error) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <p className="text-5xl mb-4">⚠️</p>
        <p className="text-gray-700 font-semibold mb-2">No se pudo cargar el dashboard</p>
        <p className="text-gray-400 text-sm mb-4">Verificá la conexión con el servidor</p>
        <button onClick={cargarDatos}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          🔄 Reintentar
        </button>
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
    <div className="space-y-6 animate-fadeIn">

      {/* Título con gradiente */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
            📊 Dashboard
          </h2>
          <p className="text-gray-500 mt-1">
            Resumen del negocio — {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="text-right">
          {ultimaActualizacion && (
            <p className="text-xs text-gray-400 mb-1">
              ✅ Actualizado a las {ultimaActualizacion.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          <button onClick={cargarDatos} disabled={cargando}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:transform-none">
            {cargando ? '⏳ Actualizando...' : '🔄 Actualizar'}
          </button>
        </div>
      </div>

      {/* Widget de Salud del Negocio */}
      <SaludNegocio />

      {/* Tarjetas de stats animadas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 text-white rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 cursor-pointer group">
          <div className="flex items-center justify-between">
            <p className="text-green-100 text-sm font-medium">VENTAS DEL MES</p>
            <span className="text-2xl group-hover:scale-125 transition-transform duration-300">💰</span>
          </div>
          <p className="text-4xl font-bold mt-3 drop-shadow-lg">{fmt(stats.facturado_mes)}</p>
          <p className="text-green-100 text-sm mt-2 flex items-center gap-1">
            <span className="bg-green-400/30 px-2 py-0.5 rounded-full">{stats.ventas_mes}</span> ventas realizadas
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 cursor-pointer border-l-4 border-red-500 group">
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-sm font-medium">GASTOS DEL MES</p>
            <span className="text-2xl group-hover:scale-125 transition-transform duration-300">📉</span>
          </div>
          <p className="text-4xl font-bold text-red-500 mt-3">{fmt(stats.gastos_mes)}</p>
          <p className="text-gray-400 text-sm mt-2">Egresos operativos</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 cursor-pointer group">
          <div className="flex items-center justify-between">
            <p className="text-blue-100 text-sm font-medium">GANANCIA NETA</p>
            <span className="text-2xl group-hover:scale-125 transition-transform duration-300">📈</span>
          </div>
          <p className="text-4xl font-bold mt-3 drop-shadow-lg">
            {fmt(parseFloat(stats.facturado_mes) - parseFloat(stats.gastos_mes))}
          </p>
          <p className="text-blue-100 text-sm mt-2">Ventas - Gastos</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 cursor-pointer border-l-4 border-purple-500 group">
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-sm font-medium">DEUDAS TOTALES</p>
            <span className="text-2xl group-hover:scale-125 transition-transform duration-300">💳</span>
          </div>
          <p className="text-4xl font-bold text-purple-600 mt-3">{fmt(stats.total_deudas)}</p>
          <p className="text-gray-400 text-sm mt-2">Cuentas corrientes</p>
        </div>
      </div>

      {/* Comparación de rendimiento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer group">
          <div className="flex items-center justify-between">
            <p className="text-amber-100 text-sm font-medium">HOY</p>
            <span className="text-2xl group-hover:rotate-12 transition-transform duration-300">⚡</span>
          </div>
          <p className="text-3xl font-bold mt-2">{fmt(comparacion.hoy)}</p>
          <div className={`flex items-center gap-1 mt-2 text-sm font-semibold ${parseFloat(varPct) >= 0 ? 'bg-green-400/30' : 'bg-red-400/30'} px-2 py-1 rounded-full`}>
            <span>{parseFloat(varPct) >= 0 ? '↑' : '↓'}</span>
            <span>{Math.abs(varPct)}% vs ayer</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer group">
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-sm font-medium">AYER</p>
            <span className="text-2xl group-hover:scale-125 transition-transform duration-300">📅</span>
          </div>
          <p className="text-3xl font-bold text-gray-800 mt-2">{fmt(comparacion.ayer)}</p>
          <p className="text-gray-400 text-sm mt-2">{comparacion.ventas_ayer} ventas</p>
        </div>

        <div className="bg-gradient-to-br from-cyan-400 to-blue-500 text-white rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer group">
          <div className="flex items-center justify-between">
            <p className="text-cyan-100 text-sm font-medium">PRODUCTOS</p>
            <span className="text-2xl group-hover:rotate-12 transition-transform duration-300">📦</span>
          </div>
          <p className="text-3xl font-bold mt-2">{stats.total_productos}</p>
          <p className="text-cyan-100 text-sm mt-2">activos en stock</p>
        </div>

        <div className="bg-gradient-to-br from-orange-400 to-red-500 text-white rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer group"
          onClick={verStockBajo}>
          <div className="flex items-center justify-between">
            <p className="text-orange-100 text-sm font-medium">STOCK BAJO</p>
            <span className="text-2xl group-hover:scale-125 transition-transform duration-300">⚠️</span>
          </div>
          <p className="text-4xl font-bold mt-2">{stats.stock_bajo}</p>
          <p className="text-orange-100 text-sm mt-2">
            {stats.stock_bajo > 0 ? '👆 Click para ver' : '✅ Todo bien'}
          </p>
        </div>
      </div>

      {/* Gráfico principal de ventas con controles */}
      <div className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              📈 Análisis de Ventas
            </h3>
            <p className="text-gray-400 text-sm mt-1">Evolución de facturación por período</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Selector de período */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              {[
                { id: '7d', label: '7D' },
                { id: '30d', label: '30D' },
                { id: '90d', label: '3M' },
                { id: '180d', label: '6M' },
                { id: '365d', label: '1A' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriodo(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    periodo === p.id
                      ? 'bg-white text-green-600 shadow-md'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Selector de tipo de gráfico */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              {[
                { id: 'area', icon: '📊', label: 'Área' },
                { id: 'bar', icon: '📈', label: 'Barras' },
                { id: 'line', icon: '📉', label: 'Línea' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTipoGrafico(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                    tipoGrafico === t.id
                      ? 'bg-white text-blue-600 shadow-md'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {datosGrafico.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
            <div className="text-center">
              <p className="text-5xl mb-3 animate-bounce">📊</p>
              <p className="font-medium">Sin datos de ventas todavía</p>
              <p className="text-sm text-gray-400 mt-1">Las ventas aparecerán aquí</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            {tipoGrafico === 'area' ? (
              <AreaChart data={datosGrafico} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="50%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis tickFormatter={fmtCorto} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => [fmt(value), '💰 Facturación']}
                  labelFormatter={(label) => `📅 ${label}`}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)'
                  }}
                />
                <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3}
                  fill="url(#colorVentas)" dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }} 
                  activeDot={{ r: 8, fill: '#059669', stroke: '#10b981', strokeWidth: 3 }} />
              </AreaChart>
            ) : tipoGrafico === 'bar' ? (
              <BarChart data={datosGrafico} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis tickFormatter={fmtCorto} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => [fmt(value), '💰 Facturación']}
                  labelFormatter={(label) => `📅 ${label}`}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)'
                  }}
                />
                <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={datosGrafico} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis tickFormatter={fmtCorto} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => [fmt(value), '💰 Facturación']}
                  labelFormatter={(label) => `📅 ${label}`}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)'
                  }}
                />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2}
                  fill="none" dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }} 
                  activeDot={{ r: 6, fill: '#2563eb', stroke: '#3b82f6', strokeWidth: 2 }} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top productos mejorado */}
        <div className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow duration-300">
          <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
            🏆 Top Productos del Mes
          </h3>
          {topProductos.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
              <div className="text-center">
                <p className="text-4xl mb-2">📦</p>
                <p>Sin ventas este mes</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {topProductos.map((p, i) => {
                const maxCant = topProductos[0]?.cantidad_vendida || 1;
                const pct = (p.cantidad_vendida / maxCant) * 100;
                const colores = [
                  'from-yellow-400 to-amber-500',
                  'from-gray-300 to-gray-400',
                  'from-orange-400 to-orange-500',
                  'from-green-400 to-green-500',
                  'from-blue-400 to-blue-500'
                ];
                const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all duration-300 cursor-pointer group">
                    <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colores[i]} flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      {emojis[i]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-semibold text-gray-700 truncate">{p.nombre_producto}</p>
                        <p className="text-sm font-bold text-gray-800 ml-2 flex-shrink-0 bg-gray-100 px-2 py-0.5 rounded-full">{p.cantidad_vendida} u.</p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`bg-gradient-to-r ${colores[i]} h-2.5 rounded-full transition-all duration-1000 ease-out`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 font-medium">{fmt(p.total_facturado)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Métodos de pago mejorado */}
        <div className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow duration-300">
          <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
            💳 Métodos de Pago del Mes
          </h3>
          {datosPie.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
              <div className="text-center">
                <p className="text-4xl mb-2">💳</p>
                <p>Sin ventas este mes</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="45%" height={200}>
                <PieChart>
                  <Pie data={datosPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={4} dataKey="value" animationBegin={0} animationDuration={1500}>
                    {datosPie.map((entry, index) => (
                      <Cell key={index}
                        fill={COLORES_METODO[entry.metodo] || COLORES_PIE[index % COLORES_PIE.length]}
                        stroke="#fff"
                        strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [fmt(value), '💰 Total']}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {datosPie.map((m, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all duration-300 cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-md group-hover:scale-125 transition-transform duration-300"
                        style={{ backgroundColor: COLORES_METODO[m.metodo] || COLORES_PIE[i % COLORES_PIE.length] }}></div>
                      <span className="text-sm font-medium text-gray-700 capitalize">{m.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded-full">{fmt(m.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico de barras mejorado */}
      {topProductos.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow duration-300">
          <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
            📦 Facturación por Producto
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topProductos.map(p => ({
              name: p.nombre_producto.length > 12 ? p.nombre_producto.substring(0, 12) + '...' : p.nombre_producto,
              total: parseFloat(p.total_facturado),
            }))} margin={{ top: 5, right: 10, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false}
                angle={-15} textAnchor="end" axisLine={{ stroke: '#e5e7eb' }} />
              <YAxis tickFormatter={fmtCorto} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <Tooltip 
                formatter={(value) => [fmt(value), '💰 Facturado']}
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: 'none', 
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)'
                }}
              />
              <Bar dataKey="total" radius={[8, 8, 0, 0]} animationDuration={1500}>
                {topProductos.map((_, index) => (
                  <Cell key={index} fill={COLORES_PIE[index % COLORES_PIE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Modal Stock Bajo mejorado */}
      {mostrarStockBajo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-orange-500 to-red-500">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">⚠️ Productos con Stock Bajo</h3>
                <p className="text-orange-100 text-sm mt-1">Productos que necesitan reposición</p>
              </div>
              <button onClick={() => setMostrarStockBajo(false)}
                className="text-white/80 hover:text-white text-3xl hover:rotate-90 transition-transform duration-300">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {cargandoStock ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500">Cargando productos...</p>
                </div>
              ) : productosStockBajo.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-5xl mb-3">✅</p>
                  <p className="text-gray-600 font-semibold">¡Excelente!</p>
                  <p className="text-gray-500">Todos los productos tienen stock suficiente</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Producto</th>
                      <th className="text-left px-4 py-3 text-gray-700 font-semibold">Categoría</th>
                      <th className="text-center px-4 py-3 text-gray-700 font-semibold">Stock actual</th>
                      <th className="text-center px-4 py-3 text-gray-700 font-semibold">Stock mínimo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {productosStockBajo.map(p => (
                      <tr key={p.id} className="hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-colors duration-200">
                        <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                        <td className="px-4 py-3 text-gray-500">{p.categoria_nombre || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold px-3 py-1 rounded-full ${p.stock <= 0 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                            {p.stock} {p.unidad}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">{p.stock_minimo} {p.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button onClick={() => setMostrarStockBajo(false)}
                className="w-full py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;