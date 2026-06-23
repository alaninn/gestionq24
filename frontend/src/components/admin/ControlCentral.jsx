import { useState, useEffect } from 'react';
import api from '../../api/axios';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const fmt = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const hoyISO = () => {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const COLORES_METODO = {
  efectivo: '#10b981', transferencia: '#f59e0b', mercadopago: '#8b5cf6',
  tarjeta: '#3b82f6', cuenta_corriente: '#ef4444',
};
const NOMBRE_METODO = {
  efectivo: '💵 Efectivo', transferencia: '🏦 Transferencia', mercadopago: '📱 Mercado Pago',
  tarjeta: '💳 Tarjeta', cuenta_corriente: '📋 Cuenta corriente',
};

export default function ControlCentral() {
  const [periodo, setPeriodo] = useState('hoy'); // hoy | dia | mes | rango
  const [dia, setDia] = useState(hoyISO());
  const [mes, setMes] = useState(hoyISO().slice(0, 7));
  const [rangoDesde, setRangoDesde] = useState(hoyISO());
  const [rangoHasta, setRangoHasta] = useState(hoyISO());
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  // Gastos fijos
  const [gastosFijos, setGastosFijos] = useState([]);
  const [mostrarGastos, setMostrarGastos] = useState(false);

  // Dinero disponible (capital rotativo, en tiempo real, independiente del período)
  const [disponible, setDisponible] = useState(null);
  const [mostrarSaldoInicial, setMostrarSaldoInicial] = useState(false);

  const calcularFechas = () => {
    if (periodo === 'hoy') { const h = hoyISO(); return { desde: h, hasta: h }; }
    if (periodo === 'dia') return { desde: dia, hasta: dia };
    if (periodo === 'mes') {
      const [a, m] = mes.split('-');
      const ultimo = new Date(a, m, 0).getDate();
      return { desde: `${a}-${m}-01`, hasta: `${a}-${m}-${String(ultimo).padStart(2, '0')}` };
    }
    return { desde: rangoDesde, hasta: rangoHasta };
  };

  const cargar = async () => {
    setCargando(true);
    setError(false);
    try {
      const { desde, hasta } = calcularFechas();
      const res = await api.get(`/api/reportes/centro-control?fecha_desde=${desde}&fecha_hasta=${hasta}`);
      setDatos(res.data);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  const cargarGastosFijos = async () => {
    try { const r = await api.get('/api/gastos-fijos'); setGastosFijos(r.data); } catch { /* */ }
  };

  // El disponible es un total a HOY (no depende del período seleccionado)
  const cargarDisponible = async () => {
    try { const r = await api.get('/api/reportes/disponible'); setDisponible(r.data); } catch { /* */ }
  };

  useEffect(() => { cargar(); cargarDisponible(); /* eslint-disable-next-line */ }, [periodo, dia, mes, rangoDesde, rangoHasta]);
  useEffect(() => { cargarGastosFijos(); cargarDisponible(); }, []);

  const d = datos;
  const datosPie = d ? Object.entries(d.porMetodo || {})
    .filter(([, v]) => v > 0)
    .map(([metodo, value]) => ({ metodo, name: NOMBRE_METODO[metodo] || metodo, value })) : [];

  const datosBarras = d ? [
    { name: 'Ganancia efectivo', valor: Math.round(d.efectivo?.ganancia || 0), color: '#10b981' },
    { name: 'Ganancia virtual', valor: Math.round(d.virtual?.ganancia || 0), color: '#8b5cf6' },
    { name: 'Gastos caja', valor: -Math.round(d.gastos_variables || 0), color: '#ef4444' },
    { name: 'Fijos (estim.)', valor: -Math.round(d.gastos_operativos || 0), color: '#f59e0b' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
            🎯 Centro de Control
          </h2>
          <p className="text-gray-500 text-sm">Ganancia real del negocio, descontando costos, IVA y gastos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setMostrarGastos(true)}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
            ⚙️ Gastos fijos del local
          </button>
        </div>
      </div>

      {/* DINERO DISPONIBLE AHORA (capital rotativo, tiempo real) */}
      <div className="rounded-3xl p-6 sm:p-7 text-white shadow-2xl relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #0e7490 100%)' }}>
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-blue-200 text-sm font-medium uppercase tracking-wider">💰 Dinero disponible ahora</p>
              <p className="text-4xl sm:text-5xl font-bold mt-1">{fmt(disponible?.total)}</p>
              <p className="text-blue-100/70 text-xs mt-2">
                Plata real para comprar o retirar. Se acumula hasta gastarse.
                {disponible?.desde ? ` Desde ${new Date(disponible.desde).toLocaleString('es-AR')}.` : ' Configurá el saldo inicial →'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMostrarSaldoInicial(true)}
                className="bg-white/15 hover:bg-white/25 border border-white/20 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors">
                ⚙️ Saldo inicial
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 max-w-md">
            <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3">
              <p className="text-blue-100/80 text-xs">💵 Caja del local (efectivo)</p>
              <p className="text-xl font-bold mt-0.5">{fmt(disponible?.efectivo)}</p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3">
              <p className="text-blue-100/80 text-xs">📲 MP del local (virtual)</p>
              <p className="text-xl font-bold mt-0.5">{fmt(disponible?.virtual)}</p>
            </div>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-blue-400/10 blur-3xl" />
      </div>

      {/* Filtro de período */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-2">
        {[['hoy', 'Hoy'], ['dia', 'Un día'], ['mes', 'Mes'], ['rango', 'Rango']].map(([id, label]) => (
          <button key={id} onClick={() => setPeriodo(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${periodo === id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
        {periodo === 'dia' && (
          <input type="date" value={dia} onChange={e => setDia(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        )}
        {periodo === 'mes' && (
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        )}
        {periodo === 'rango' && (
          <div className="flex items-center gap-2">
            <input type="date" value={rangoDesde} onChange={e => setRangoDesde(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            <span className="text-gray-400">→</span>
            <input type="date" value={rangoHasta} onChange={e => setRangoHasta(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
        )}
        <button onClick={() => { cargar(); cargarDisponible(); }} className="ml-auto bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">🔄 Actualizar</button>
      </div>

      {cargando && <div className="text-center text-gray-400 py-10">Calculando…</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">No se pudo cargar el informe.</div>}

      {d && !cargando && (
        <>
          {/* Facturación total del período (para entender el número real) */}
          <div className="rounded-2xl p-5 bg-white border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">Facturación total</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{fmt(d.totalVendido)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Todo lo vendido en el período ({d.diasPeriodo} día/s)</p>
            </div>
            <span className="text-4xl">🧾</span>
          </div>

          {/* GANANCIA NETA REAL — destacada */}
          <div className="rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #064e3b 0%, #0f766e 60%, #155e75 100%)' }}>
            <div className="relative z-10">
              <p className="text-emerald-200 text-sm font-medium uppercase tracking-wider">Ganancia neta real del período</p>
              <p className={`text-4xl sm:text-5xl font-bold mt-2 ${d.ganancia_neta < 0 ? 'text-red-300' : 'text-white'}`}>{fmt(d.ganancia_neta)}</p>
              <p className="text-emerald-100/70 text-xs mt-2">
                {d.diasPeriodo} día(s) · Vendido {fmt(d.totalVendido_sin_cigarrillos ?? d.totalVendido)} (sin cigarrillos) · menos costo, IVA y gastos de la caja del turno (lo pagado con dinero/MP del local no cuenta)
              </p>
              {/* Estimación: descuenta los gastos fijos prorrateados (especulación) */}
              <div className="mt-3 inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                <span className="text-emerald-100/80 text-xs">💡 Estimada (menos gastos fijos {fmt(d.gastos_operativos)}):</span>
                <span className={`text-sm font-bold ${d.ganancia_neta_estimada < 0 ? 'text-red-300' : 'text-white'}`}>{fmt(d.ganancia_neta_estimada)}</span>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-emerald-400/10 blur-3xl" />
          </div>

          {/* Totales por método */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <CardChica titulo="💵 Venta efectivo" valor={fmt(d.porMetodo?.efectivo)} color="from-emerald-500 to-green-600" />
            <CardChica titulo="🏦 Venta transferencia" valor={fmt(d.porMetodo?.transferencia)} color="from-amber-500 to-orange-600" />
            <CardChica titulo="📱 Venta Mercado Pago" valor={fmt(d.porMetodo?.mercadopago)} color="from-violet-500 to-purple-600" />
            <CardChica titulo="💳 Venta tarjeta" valor={fmt(d.porMetodo?.tarjeta)} color="from-blue-500 to-indigo-600" />
          </div>

          {/* Ganancia por tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-1">💵 Ganancia en efectivo</h3>
              <p className="text-xs text-gray-400 mb-3">Venta − costo de lo vendido (sin IVA) · sin cigarrillos</p>
              <p className="text-3xl font-bold text-emerald-600">{fmt(d.efectivo?.ganancia)}</p>
              <div className="mt-3 text-sm text-gray-500 space-y-1">
                <Linea label="Venta efectivo" valor={fmt(d.efectivo?.venta)} />
                <Linea label="Costo productos" valor={'− ' + fmt(d.efectivo?.costo)} />
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-1">🧾 Ganancia virtual (facturado)</h3>
              <p className="text-xs text-gray-400 mb-3">Venta − costo − IVA 21% (transferencia, MP, tarjeta) · sin cigarrillos</p>
              <p className="text-3xl font-bold text-violet-600">{fmt(d.virtual?.ganancia)}</p>
              <div className="mt-3 text-sm text-gray-500 space-y-1">
                <Linea label="Venta virtual" valor={fmt(d.virtual?.venta)} />
                <Linea label="Costo productos" valor={'− ' + fmt(d.virtual?.costo)} />
                <Linea label="IVA (21%)" valor={'− ' + fmt(d.virtual?.iva)} />
              </div>
            </div>
          </div>

          {/* Cigarrillos (aparte: margen muy distinto). Foco: cuánto reponer. */}
          {d.cigarrillos && (d.cigarrillos.venta_efectivo > 0 || d.cigarrillos.venta_virtual > 0 || d.cigarrillos.costo > 0) && (
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-amber-200">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <h3 className="font-bold text-gray-800">🚬 Cigarrillos (aparte)</h3>
                <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  No entran en la ganancia de arriba; su plata sí está en el disponible
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-3">Sirve para saber cuánto reponer (sin descuento; el virtual lleva +10%).</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl p-4 bg-amber-50 border border-amber-200">
                  <p className="text-amber-700 text-xs font-semibold">📦 Costo a reponer</p>
                  <p className="text-2xl font-bold text-amber-800 mt-0.5">{fmt(d.cigarrillos.costo)}</p>
                </div>
                <div className="rounded-xl p-4 bg-gray-50 border border-gray-200">
                  <p className="text-gray-500 text-xs font-semibold">💵 Venta efectivo</p>
                  <p className="text-xl font-bold text-gray-800 mt-0.5">{fmt(d.cigarrillos.venta_efectivo)}</p>
                </div>
                <div className="rounded-xl p-4 bg-gray-50 border border-gray-200">
                  <p className="text-gray-500 text-xs font-semibold">📲 Venta virtual (+10%)</p>
                  <p className="text-xl font-bold text-gray-800 mt-0.5">{fmt(d.cigarrillos.venta_virtual)}</p>
                </div>
                <div className="rounded-xl p-4 bg-emerald-50 border border-emerald-200">
                  <p className="text-emerald-700 text-xs font-semibold">📈 Ganancia cigarrillos</p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">{fmt(d.cigarrillos.ganancia)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Gastos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <CardChica titulo="🧾 IVA facturado" valor={fmt(d.iva_virtual)} color="from-rose-500 to-pink-600" />
            <CardChica titulo="💸 Gastos de caja (turno)" valor={fmt(d.gastos_variables)} color="from-orange-500 to-red-600"
              sub="pagados con la caja del turno (restan de la ganancia)" />
            <CardChica titulo="🏠 Gastos fijos (mes)" valor={fmt(d.fijos_mensual)} color="from-slate-500 to-gray-700"
              sub={`${fmt(d.gasto_operativo_diario)}/día · referencia, no se descuenta · tocá para ver`} onClick={() => setMostrarGastos(true)} />
            <CardChica titulo="🏦 Pagado con dinero/MP del local" valor={fmt(d.gastos_capital)} color="from-slate-400 to-slate-600"
              sub="capital acumulado (reposición/compras) · NO afecta la ganancia, sale del disponible" />
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-3 text-center">Ventas por método</h3>
              {datosPie.length === 0 ? <p className="text-center text-gray-400 py-10">Sin ventas en el período</p> : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={datosPie} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                      {datosPie.map((e, i) => <Cell key={i} fill={COLORES_METODO[e.metodo] || '#94a3b8'} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-3 text-center">Ganancias y gastos</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={datosBarras}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={50} />
                  <YAxis tickFormatter={(v) => '$' + (v / 1000) + 'k'} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {datosBarras.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {mostrarGastos && (
        <ModalGastosFijos
          gastos={gastosFijos}
          onClose={() => setMostrarGastos(false)}
          onCambio={() => { cargarGastosFijos(); cargar(); }}
        />
      )}

      {mostrarSaldoInicial && (
        <ModalSaldoInicial
          onClose={() => setMostrarSaldoInicial(false)}
          onGuardado={() => { setMostrarSaldoInicial(false); cargarDisponible(); }}
        />
      )}

    </div>
  );
}

function CardChica({ titulo, valor, color, sub, onClick }) {
  return (
    <div onClick={onClick}
      className={`bg-gradient-to-br ${color} rounded-2xl p-4 sm:p-5 text-white shadow-lg ${onClick ? 'cursor-pointer hover:scale-[1.03] active:scale-95 transition-transform' : ''}`}>
      <p className="text-white/80 text-xs font-medium">{titulo}</p>
      <p className="text-xl sm:text-2xl font-bold mt-1">{valor}</p>
      {sub && <p className="text-white/70 text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}

function Linea({ label, valor }) {
  return (
    <div className="flex justify-between"><span>{label}</span><span className="font-medium text-gray-700">{valor}</span></div>
  );
}

function ModalGastosFijos({ gastos, onClose, onCambio }) {
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);

  const totalMensual = gastos.filter(g => g.activo).reduce((a, g) => a + (parseFloat(g.monto_mensual) || 0), 0);

  const agregar = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      await api.post('/api/gastos-fijos', { nombre, monto_mensual: parseFloat(monto) || 0 });
      setNombre(''); setMonto(''); onCambio();
    } catch (e) { alert(e.response?.data?.error || 'Error al crear'); } finally { setGuardando(false); }
  };
  const editarMonto = async (g, nuevoMonto) => {
    try { await api.put(`/api/gastos-fijos/${g.id}`, { monto_mensual: parseFloat(nuevoMonto) || 0 }); onCambio(); } catch { /* */ }
  };
  const eliminar = async (g) => {
    if (!window.confirm(`¿Eliminar "${g.nombre}"?`)) return;
    try { await api.delete(`/api/gastos-fijos/${g.id}`); onCambio(); } catch { /* */ }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b bg-gray-800 text-white">
          <div>
            <h3 className="text-lg font-bold">🏠 Gastos fijos del local</h3>
            <p className="text-gray-300 text-xs">Luz, alquiler, impuestos… (valor mensual). Se prorratean por día.</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Alta */}
          <div className="flex gap-2">
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Alquiler"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <div className="relative w-32">
              <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
              <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0"
                className="w-full border border-gray-200 rounded-lg pl-6 pr-2 py-2 text-sm" />
            </div>
            <button onClick={agregar} disabled={guardando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-50">+</button>
          </div>

          {/* Lista */}
          {gastos.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">Sin gastos fijos cargados.</p>
          ) : (
            <div className="space-y-2">
              {gastos.map(g => (
                <div key={g.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                  <span className="flex-1 text-sm text-gray-700">{g.nombre}</span>
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1.5 text-gray-400 text-xs">$</span>
                    <input type="number" defaultValue={g.monto_mensual}
                      onBlur={e => editarMonto(g, e.target.value)}
                      className="w-full border border-gray-200 rounded-lg pl-5 pr-2 py-1 text-sm text-right" />
                  </div>
                  <button onClick={() => eliminar(g)} className="text-red-400 hover:text-red-600 text-lg px-1">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
            <span className="text-sm font-medium text-emerald-800">Total mensual</span>
            <div className="text-right">
              <p className="font-bold text-emerald-700">{fmt(totalMensual)}</p>
              <p className="text-[11px] text-emerald-600">≈ {fmt(totalMensual / 30)}/día</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Saldo inicial del dinero disponible (punto de arranque del capital rotativo)
function ModalSaldoInicial({ onClose, onGuardado }) {
  const [efectivo, setEfectivo] = useState('');
  const [virtual, setVirtual] = useState('');
  const [ultimoReset, setUltimoReset] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/api/reportes/disponible-config');
        const c = r.data || {};
        setUltimoReset(c.fecha_inicio || null);
        setEfectivo(c.inicial_efectivo != null ? String(c.inicial_efectivo) : '');
        setVirtual(c.inicial_virtual != null ? String(c.inicial_virtual) : '');
      } catch { /* */ }
    })();
  }, []);

  const guardar = async () => {
    if (!window.confirm('Esto reinicia el dinero disponible con estos montos y arranca a acumular DESDE AHORA. ¿Confirmás?')) return;
    setGuardando(true);
    try {
      await api.put('/api/reportes/disponible-config', {
        inicial_efectivo: parseFloat(efectivo) || 0,
        inicial_virtual: parseFloat(virtual) || 0,
      });
      onGuardado();
    } catch (e) { alert(e.response?.data?.error || 'Error al guardar'); } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b bg-blue-700 text-white rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold">⚙️ Saldo inicial del disponible</h3>
            <p className="text-blue-200 text-xs">Cuánta plata hay disponible hoy. De acá el sistema acumula.</p>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
            Contá la plata real que tenés ahora y cargala acá. El disponible se <b>reinicia</b> con
            estos montos y empieza a acumular <b>desde este momento</b> (lo de antes no se cuenta).
            {ultimoReset && (
              <p className="text-blue-500 mt-1">Último reset: {new Date(ultimoReset).toLocaleString('es-AR')}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">💵 Efectivo inicial</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                <input type="number" value={efectivo} onChange={e => setEfectivo(e.target.value)} placeholder="0"
                  className="w-full border border-gray-200 rounded-lg pl-6 pr-2 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📲 Virtual inicial</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                <input type="number" value={virtual} onChange={e => setVirtual(e.target.value)} placeholder="0"
                  className="w-full border border-gray-200 rounded-lg pl-6 pr-2 py-2 text-sm" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm hover:bg-gray-50">Cancelar</button>
            <button onClick={guardar} disabled={guardando}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {guardando ? 'Guardando…' : '🔄 Reiniciar disponible'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

