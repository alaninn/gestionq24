import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { imprimirRemito } from '../ticket';
import { diasRestantes, fmtFecha, colorVencimiento } from '../../utils/vencimiento';

// Etiqueta + color por estado de un movimiento.
const ESTADO_INFO = {
  en_proceso: { txt: '⏳ En proceso', cls: 'bg-amber-100 text-amber-700' },
  recibido: { txt: '✅ Recibido', cls: 'bg-emerald-100 text-emerald-700' },
  recibido_parcial: { txt: '⚠️ Recibido parcial', cls: 'bg-orange-100 text-orange-700' },
  rechazado: { txt: '⛔ Rechazado', cls: 'bg-red-100 text-red-700' },
  confirmado: { txt: '✅ Recibido', cls: 'bg-emerald-100 text-emerald-700' },
  anulado: { txt: '🚫 Anulado', cls: 'bg-gray-200 text-gray-500 line-through' },
};
const estadoInfo = (e) => ESTADO_INFO[e] || { txt: e || '-', cls: 'bg-gray-100 text-gray-600' };

const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0,
}).format(Number(n) || 0);

// Fecha YYYY-MM-DD en hora Argentina.
const hoyAR = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const primerDiaMesAR = () => hoyAR().slice(0, 8) + '01';
// Cantidad legible (evita "40.000" cuando es entero).
const cant = (n) => { const v = Number(n) || 0; return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, ''); };
const fmtFechaHora = (f) => f ? new Date(f).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

// Panel del usuario multinegocio (premium): ve sus negocios con vencimiento +
// estadísticas y puede acceder a cada uno (cambia de sesión) o vincular otro
// poniendo sus claves de acceso.
function MisNegocios() {
  const { esPremium } = useAuth();
  const [negocios, setNegocios] = useState([]);
  const [actualId, setActualId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [accediendo, setAccediendo] = useState(null);
  const [vista, setVista] = useState('negocios'); // negocios | reportes

  const [mostrarVincular, setMostrarVincular] = useState(false);

  const cargar = async () => {
    try {
      setCargando(true);
      setError('');
      const res = await api.get('/api/multinegocio/mis-negocios');
      setNegocios(res.data.negocios || []);
      setActualId(res.data.negocio_actual_id);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudieron cargar tus negocios');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const acceder = async (neg) => {
    if (neg.es_actual) return;
    try {
      setAccediendo(neg.id);
      const res = await api.post(`/api/multinegocio/acceder/${neg.id}`);
      // Cambiar de sesión al otro negocio y recargar el panel.
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('usuario', JSON.stringify(res.data.usuario));
      localStorage.removeItem('config_negocio');
      localStorage.removeItem('pos_turno');
      window.location.href = '/admin';
    } catch (e) {
      alert(e.response?.data?.error || 'No se pudo acceder al negocio');
      setAccediendo(null);
    }
  };

  const desvincular = async (neg) => {
    if (!window.confirm(`¿Desvincular "${neg.nombre}" de tu grupo de negocios?\n\nNo se borra nada del negocio, solo deja de aparecer acá.`)) return;
    try {
      await api.delete(`/api/multinegocio/vincular/${neg.id}`);
      cargar();
    } catch (e) {
      alert(e.response?.data?.error || 'No se pudo desvincular');
    }
  };

  const vinculados = negocios.filter(n => !n.es_actual);
  const facturadoGrupo = negocios.reduce((a, n) => a + (Number(n.facturado_30d) || 0), 0);

  if (!esPremium()) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-5xl mb-3">🏢</p>
        <h2 className="text-xl font-bold text-gray-700">Función Premium</h2>
        <p className="text-gray-500 mt-2">Administrar varios negocios está disponible en el Plan Premium.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
            🏢 Mis negocios
          </h2>
          <p className="text-gray-500 text-sm">Todos tus negocios en un solo lugar: vencimiento, actividad y movimientos de mercadería.</p>
        </div>
        {vista === 'negocios' && (
          <button onClick={() => setMostrarVincular(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
            + Vincular negocio
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[['negocios', '🏢 Negocios'], ['reportes', '📊 Reportes de movimientos']].map(([id, label]) => (
          <button key={id} onClick={() => setVista(id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${vista === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {vista === 'reportes' && <ReportesMovimientos />}

      {vista === 'negocios' && (<>
      {/* Resumen del grupo */}
      {negocios.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Negocios</p>
            <p className="text-2xl font-bold text-gray-800">{negocios.length}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Facturado (30 días, total)</p>
            <p className="text-2xl font-bold text-gray-800">{fmt(facturadoGrupo)}</p>
          </div>
        </div>
      )}

      {cargando && <div className="text-center text-gray-400 py-10">Cargando…</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{error}</div>}

      {!cargando && !error && vinculados.length === 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center">
          <p className="text-3xl mb-2">🔗</p>
          <p className="font-semibold text-indigo-900">Todavía no vinculaste otros negocios</p>
          <p className="text-indigo-700/80 text-sm mt-1">
            Vinculá un negocio tuyo poniendo sus claves de acceso (el mail y la contraseña con la que
            entrás a ese negocio). Después vas a poder ver su estado y entrar desde acá.
          </p>
          <button onClick={() => setMostrarVincular(true)}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
            + Vincular mi primer negocio
          </button>
        </div>
      )}

      {/* Tarjetas */}
      {!cargando && !error && negocios.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {negocios.map(neg => {
            const dias = diasRestantes(neg.fecha_vencimiento);
            const vencido = neg.estado === 'vencido' || (neg.fecha_vencimiento && dias <= 0);
            return (
              <div key={neg.id}
                className={`bg-white rounded-2xl shadow-sm border p-5 ${neg.es_actual ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                        style={{ backgroundColor: neg.color_primario || '#6366f1' }}>
                        {(neg.nombre || '?').charAt(0).toUpperCase()}
                      </span>
                      <p className="font-bold text-gray-800 truncate">{neg.nombre}</p>
                      {neg.es_actual && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">ACTUAL</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${neg.plan === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {neg.plan === 'premium' ? 'Premium' : 'Estándar'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vencimiento */}
                <div className="mt-4 flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-[11px] text-gray-500">Vencimiento</p>
                    <p className="text-sm font-semibold text-gray-700">{fmtFecha(neg.fecha_vencimiento)}</p>
                  </div>
                  <p className={`text-sm font-bold ${colorVencimiento(dias)}`}>
                    {vencido ? '⚠️ Vencido' : `${dias} días`}
                  </p>
                </div>

                {/* Stats */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-xl py-2">
                    <p className="text-[11px] text-gray-500">Facturado 30d</p>
                    <p className="text-sm font-bold text-gray-800">{fmt(neg.facturado_30d)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl py-2">
                    <p className="text-[11px] text-gray-500">Ventas 30d</p>
                    <p className="text-sm font-bold text-gray-800">{neg.ventas_30d}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl py-2">
                    <p className="text-[11px] text-gray-500">Productos</p>
                    <p className="text-sm font-bold text-gray-800">{neg.total_productos}</p>
                  </div>
                </div>

                {/* Acciones */}
                <div className="mt-4 flex items-center gap-2">
                  {neg.es_actual ? (
                    <span className="flex-1 text-center text-sm text-gray-400 py-2">Estás en este negocio</span>
                  ) : (
                    <>
                      <button onClick={() => acceder(neg)} disabled={accediendo === neg.id}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2 rounded-xl text-sm font-semibold transition-colors">
                        {accediendo === neg.id ? 'Entrando…' : '→ Acceder'}
                      </button>
                      <button onClick={() => desvincular(neg)}
                        className="px-3 py-2 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-xl text-sm transition-colors"
                        title="Desvincular de mi grupo">
                        Desvincular
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)}

      {mostrarVincular && (
        <ModalVincular onClose={() => setMostrarVincular(false)} onVinculado={() => { setMostrarVincular(false); cargar(); }} />
      )}
    </div>
  );
}

// Reportes de movimientos de mercadería entre los negocios del grupo.
// Historial con filtros + reporte agregado de productos, exportables a Excel.
// Carga su propia lista de negocios del grupo (endpoint liviano /grupo, accesible
// al usuario común) para el filtro. NO requiere info sensible de los negocios.
export function ReportesMovimientos() {
  const [grupoNegocios, setGrupoNegocios] = useState([]);
  const [desde, setDesde] = useState(primerDiaMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [tipo, setTipo] = useState('todos');   // todos | enviado | recibido
  const [negocio, setNegocio] = useState('');  // filtrar por el otro negocio
  const [estadoFiltro, setEstadoFiltro] = useState(''); // '' | en_proceso | recibido | recibido_parcial | anulado
  const [buscarProd, setBuscarProd] = useState('');     // buscar por producto
  const [subvista, setSubvista] = useState('historial'); // historial | productos

  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [balance, setBalance] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [expandido, setExpandido] = useState(null);
  const [detalles, setDetalles] = useState({}); // id -> {movimiento, items}
  const [recepcion, setRecepcion] = useState(null); // movimiento a recepcionar
  const [editando, setEditando] = useState(null);   // envío en proceso a editar

  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin' || usuario?.rol === 'superadmin';
  const otros = grupoNegocios.filter(n => !n.es_actual);

  useEffect(() => {
    api.get('/api/multinegocio/grupo').then(r => setGrupoNegocios(r.data.negocios || [])).catch(() => {});
  }, []);

  const qs = () => {
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    if (tipo !== 'todos') p.set('tipo', tipo);
    if (negocio) p.set('negocio', negocio);
    if (estadoFiltro) p.set('estado', estadoFiltro);
    if (buscarProd.trim()) p.set('buscar', buscarProd.trim());
    return p.toString();
  };

  const cargar = async () => {
    try {
      setCargando(true); setError('');
      const [mov, prod] = await Promise.all([
        api.get('/api/multinegocio/movimientos?' + qs()),
        api.get('/api/multinegocio/movimientos/reporte-productos?' + qs()),
      ]);
      setMovimientos(mov.data.movimientos || []);
      setResumen(mov.data.resumen || null);
      setBalance(mov.data.balance || []);
      setProductos(prod.data || []);
    } catch {
      setError('No se pudieron cargar los reportes');
    } finally {
      setCargando(false);
    }
  };

  // Recarga inmediata para filtros "duros"; la búsqueda por producto va con debounce.
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [desde, hasta, tipo, negocio, estadoFiltro]);
  useEffect(() => {
    const t = setTimeout(() => cargar(), 350);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [buscarProd]);

  const cargarDetalle = async (id) => {
    const r = await api.get(`/api/multinegocio/movimientos/${id}`);
    setDetalles(prev => ({ ...prev, [id]: r.data }));
    return r.data;
  };

  const toggleDetalle = async (id) => {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    if (!detalles[id]) { try { await cargarDetalle(id); } catch { /* noop */ } }
  };

  const reimprimir = async (id) => {
    try {
      const d = detalles[id] || await cargarDetalle(id);
      const m = d.movimiento;
      imprimirRemito({
        movimiento: {
          id: m.id, fecha: m.fecha, total_costo: m.total_costo, estado: m.estado,
          comentario_envio: m.comentario_envio, negocio_origen: m.origen_nombre, negocio_destino: m.destino_nombre,
        },
        items: d.items, config: {},
      });
    } catch { alert('No se pudo generar el remito'); }
  };

  const anular = async (id) => {
    if (!window.confirm('¿Anular este movimiento? Si ya se había recibido, se revierte el stock en ambos negocios.')) return;
    try {
      await api.post(`/api/multinegocio/movimientos/${id}/anular`);
      setDetalles(prev => { const c = { ...prev }; delete c[id]; return c; });
      cargar();
    } catch (e) { alert(e.response?.data?.error || 'No se pudo anular'); }
  };

  // Tendencia: valor movido por día en el período (excluye anulados).
  const tendencia = (() => {
    const mapa = {};
    for (const m of movimientos) {
      if (m.estado === 'anulado') continue;
      const dia = fmtFecha(m.fecha);
      mapa[dia] = (mapa[dia] || 0) + (Number(m.total_costo) || 0);
    }
    return Object.entries(mapa).map(([dia, valor]) => ({ dia, valor })).slice(-30);
  })();

  const exportarHistorial = () => {
    const filas = movimientos.map(m => ({
      Fecha: fmtFechaHora(m.fecha), Tipo: m.enviado ? 'Enviado' : 'Recibido',
      Origen: m.origen_nombre, Destino: m.destino_nombre,
      Estado: estadoInfo(m.estado).txt.replace(/^[^ ]+ /, ''),
      Items: m.cantidad_items, 'Valor costo': Number(m.total_costo) || 0,
      'Enviado por': m.usuario_nombre || '',
      'Recibido por': m.usuario_recepcion_nombre || '',
      'Fecha recepción': m.fecha_recepcion ? fmtFechaHora(m.fecha_recepcion) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `Movimientos ${desde}_a_${hasta}.xlsx`);
  };

  const exportarProductos = () => {
    const filas = productos.map(p => ({
      Producto: p.nombre_producto, Código: p.codigo || '',
      'Cant. total': Number(p.total_cantidad) || 0,
      'Cant. enviada': Number(p.cant_enviada) || 0,
      'Cant. recibida': Number(p.cant_recibida) || 0,
      Envíos: Number(p.envios) || 0, 'Valor costo': Number(p.total_costo) || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos movidos');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `Productos movidos ${desde}_a_${hasta}.xlsx`);
  };

  const exportarHistorialPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text('Movimientos de mercadería', 14, 15);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`Período: ${desde} a ${hasta}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [['Fecha', 'Tipo', 'Origen → Destino', 'Estado', 'Ítems', 'Valor costo']],
      body: movimientos.map(m => [
        fmtFechaHora(m.fecha), m.enviado ? 'Enviado' : 'Recibido',
        `${m.origen_nombre} → ${m.destino_nombre}`, estadoInfo(m.estado).txt.replace(/^[^ ]+ /, ''),
        String(m.cantidad_items), fmt(m.total_costo),
      ]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save(`Movimientos ${desde}_a_${hasta}.pdf`);
  };

  const exportarProductosPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14); doc.text('Productos movidos', 14, 15);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`Período: ${desde} a ${hasta}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [['Producto', 'Total', 'Enviado', 'Recibido', 'Envíos', 'Valor costo']],
      body: productos.map(p => [
        p.nombre_producto, cant(p.total_cantidad), cant(p.cant_enviada || 0),
        cant(p.cant_recibida || 0), String(p.envios), fmt(p.total_costo),
      ]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save(`Productos movidos ${desde}_a_${hasta}.pdf`);
  };

  const ymdAR = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const setRango = (dd, hh) => { setDesde(dd); setHasta(hh); };
  const esteMes = () => setRango(primerDiaMesAR(), hoyAR());
  const hoy = () => setRango(hoyAR(), hoyAR());
  const ultimos7 = () => setRango(ymdAR(new Date(Date.now() - 6 * 86400000)), hoyAR());
  const mesPasado = () => {
    const [y, mo] = hoyAR().split('-').map(Number);
    const first = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(y, mo - 1, 0)).toISOString().slice(0, 10);
    setRango(first, last);
  };
  const limpiarFiltros = () => { setTipo('todos'); setNegocio(''); setEstadoFiltro(''); setBuscarProd(''); esteMes(); };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        {/* Búsqueda por producto */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input type="text" value={buscarProd} onChange={e => setBuscarProd(e.target.value)}
            placeholder="Buscar por producto (nombre o código)…"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {buscarProd && (
            <button onClick={() => setBuscarProd('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Desde</label>
            <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Hasta</label>
            <input type="date" value={hasta} min={desde} max={hoyAR()} onChange={e => setHasta(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="todos">Todos</option>
              <option value="enviado">Enviados</option>
              <option value="recibido">Recibidos</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Estado</label>
            <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value="en_proceso">⏳ En proceso</option>
              <option value="recibido">✅ Recibido</option>
              <option value="recibido_parcial">⚠️ Recibido parcial</option>
              <option value="rechazado">⛔ Rechazado</option>
              <option value="anulado">🚫 Anulado</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Negocio</label>
            <select value={negocio} onChange={e => setNegocio(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todos</option>
              {otros.map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-gray-400">Rápido:</span>
          <button onClick={hoy} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Hoy</button>
          <button onClick={ultimos7} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">7 días</button>
          <button onClick={esteMes} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Este mes</button>
          <button onClick={mesPasado} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Mes pasado</button>
          <span className="flex-1" />
          <button onClick={limpiarFiltros} className="px-3 py-1.5 text-gray-500 hover:text-gray-700 rounded-lg text-sm">Limpiar filtros</button>
        </div>
      </div>

      {/* Aviso de recepciones pendientes */}
      {resumen && Number(resumen.pend_recibir) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">📥</span>
          <p className="text-sm text-amber-800 flex-1">
            Tenés <b>{resumen.pend_recibir}</b> envío(s) <b>en proceso</b> esperando que confirmes la recepción.
            Abrí el que corresponda en el historial y tocá <b>“Confirmar recepción”</b>.
          </p>
        </div>
      )}

      {/* Tarjetas resumen */}
      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Movimientos</p>
            <p className="text-2xl font-bold text-gray-800">{resumen.movimientos}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">📤 Enviado (valor)</p>
            <p className="text-xl font-bold text-indigo-700">{fmt(resumen.valor_enviado)}</p>
            <p className="text-[11px] text-gray-400">{resumen.enviados} envíos</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">📥 Recibido (valor)</p>
            <p className="text-xl font-bold text-emerald-700">{fmt(resumen.valor_recibido)}</p>
            <p className="text-[11px] text-gray-400">{resumen.recibidos} recepciones</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Ítems movidos</p>
            <p className="text-2xl font-bold text-gray-800">{resumen.total_items}</p>
          </div>
        </div>
      )}

      {/* Balance por negocio + tendencia */}
      {(balance.length > 0 || tendencia.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {balance.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">⚖️ Balance por negocio</p>
              <div className="space-y-1.5">
                {balance.map(b => (
                  <div key={b.negocio_id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate">{b.nombre}</span>
                    <span className="flex-shrink-0 flex gap-3">
                      <span className="text-indigo-600" title="Le enviaste">↗ {fmt(b.enviado)}</span>
                      <span className="text-emerald-600" title="Recibiste de él">↙ {fmt(b.recibido)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tendencia.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">📈 Valor movido por día</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={tendencia} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} interval="preserveEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={40} tickFormatter={(v) => v >= 1000 ? (v / 1000) + 'k' : v} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="valor" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Subvista */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          {[['historial', '📋 Historial'], ['productos', '📦 Productos movidos']].map(([id, label]) => (
            <button key={id} onClick={() => setSubvista(id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${subvista === id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {subvista === 'historial' ? (movimientos.length > 0 && (<>
            <button onClick={exportarHistorial} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-semibold">📤 Excel</button>
            <button onClick={exportarHistorialPDF} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-semibold">📄 PDF</button>
          </>)) : (productos.length > 0 && (<>
            <button onClick={exportarProductos} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-semibold">📤 Excel</button>
            <button onClick={exportarProductosPDF} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-semibold">📄 PDF</button>
          </>))}
        </div>
      </div>

      {cargando ? (
        <div className="text-center text-gray-400 py-10">Cargando…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{error}</div>
      ) : subvista === 'historial' ? (
        movimientos.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-2">📭</p><p>No hay movimientos en el período</p></div>
        ) : (
          <div className="space-y-2">
            {movimientos.map(m => {
              const est = estadoInfo(m.estado);
              const det = detalles[m.id];
              const puedeRecibir = !m.enviado && m.estado === 'en_proceso';
              const puedeEditar = m.enviado && m.estado === 'en_proceso' && esAdmin;
              return (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => toggleDetalle(m.id)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${m.enviado ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {m.enviado ? '📤 Enviado' : '📥 Recibido'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${est.cls}`}>{est.txt}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{m.origen_nombre} → {m.destino_nombre}</p>
                    <p className="text-[11px] text-gray-400">{fmtFechaHora(m.fecha)} · {m.cantidad_items} ítem(s){m.usuario_nombre ? ` · ${m.usuario_nombre}` : ''}</p>
                  </div>
                  {puedeRecibir && <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full flex-shrink-0 animate-pulse">recibir</span>}
                  <span className="text-sm font-bold text-gray-700 flex-shrink-0">{fmt(m.total_costo)}</span>
                  <span className={`text-gray-400 transition-transform ${expandido === m.id ? 'rotate-90' : ''}`}>▶</span>
                </button>
                {expandido === m.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                    {!det ? (
                      <p className="text-xs text-gray-400 py-2">Cargando detalle…</p>
                    ) : (<>
                      <table className="w-full text-sm">
                        <thead><tr className="text-[11px] text-gray-400 text-left"><th className="py-1">Producto</th><th className="text-right">Cant.</th><th className="text-right">Costo u.</th><th className="text-right">Subtotal</th><th className="text-right">Estado</th></tr></thead>
                        <tbody>
                          {det.items.map((it, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="py-1.5 pr-2">{it.nombre_producto}</td>
                              <td className="text-right">{cant(it.cantidad)}</td>
                              <td className="text-right text-gray-500">{fmt(it.costo_unitario)}</td>
                              <td className="text-right font-medium">{fmt(it.subtotal_costo)}</td>
                              <td className="text-right text-xs">{it.recibido === true ? '✅' : it.recibido === false ? '❌ faltó' : '⏳'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {/* Quién envió y quién recibió (info completa) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                          <p className="text-indigo-700 font-semibold">📤 Envío</p>
                          <p className="text-gray-600">Por: <b>{det.movimiento.usuario_nombre || '—'}</b></p>
                          <p className="text-gray-400">{fmtFechaHora(det.movimiento.fecha)}</p>
                        </div>
                        <div className={`rounded-lg px-3 py-2 border ${det.movimiento.fecha_recepcion ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-200'}`}>
                          <p className={`font-semibold ${det.movimiento.fecha_recepcion ? 'text-emerald-700' : 'text-gray-500'}`}>📥 Recepción</p>
                          {det.movimiento.fecha_recepcion ? (<>
                            <p className="text-gray-600">Por: <b>{det.movimiento.usuario_recepcion_nombre || '—'}</b></p>
                            <p className="text-gray-400">{fmtFechaHora(det.movimiento.fecha_recepcion)}</p>
                          </>) : (
                            <p className="text-gray-400">Pendiente de confirmación</p>
                          )}
                        </div>
                      </div>
                      {(det.movimiento.comentario_envio || det.movimiento.comentario_recepcion) && (
                        <div className="text-xs space-y-1">
                          {det.movimiento.comentario_envio && <p className="text-gray-600">📝 <b>Nota del envío:</b> {det.movimiento.comentario_envio}</p>}
                          {det.movimiento.comentario_recepcion && <p className="text-gray-600">📩 <b>Nota de la recepción:</b> {det.movimiento.comentario_recepcion}</p>}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {puedeRecibir && (
                          <button onClick={() => setRecepcion(det)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold">
                            ✅ Confirmar recepción
                          </button>
                        )}
                        {puedeEditar && (
                          <button onClick={() => setEditando(det)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold">
                            ✏️ Editar envío
                          </button>
                        )}
                        <button onClick={() => reimprimir(m.id)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">🖨️ Remito</button>
                        {esAdmin && m.estado !== 'anulado' && (
                          <button onClick={() => anular(m.id)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium">
                            {m.estado === 'en_proceso' ? (m.enviado ? '🚫 Cancelar envío' : '🚫 Rechazar') : '🚫 Anular'}
                          </button>
                        )}
                      </div>
                    </>)}
                  </div>
                )}
              </div>
            );})}
          </div>
        )
      ) : (
        productos.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-2">📦</p><p>No hay productos movidos en el período</p></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Producto</th>
                  <th className="text-right px-3">Total</th>
                  <th className="text-right px-3">Enviado</th>
                  <th className="text-right px-3">Recibido</th>
                  <th className="text-right px-3">Envíos</th>
                  <th className="text-right px-4">Valor costo</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-800">{p.nombre_producto}</td>
                    <td className="text-right px-3 font-semibold">{cant(p.total_cantidad)}</td>
                    <td className="text-right px-3 text-indigo-600">{cant(p.cant_enviada || 0)}</td>
                    <td className="text-right px-3 text-emerald-600">{cant(p.cant_recibida || 0)}</td>
                    <td className="text-right px-3 text-gray-500">{p.envios}</td>
                    <td className="text-right px-4 font-medium">{fmt(p.total_costo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {recepcion && (
        <ModalRecepcion detalle={recepcion}
          onClose={() => setRecepcion(null)}
          onConfirmado={() => { setRecepcion(null); setDetalles(prev => { const c = { ...prev }; delete c[recepcion.movimiento.id]; return c; }); setExpandido(null); cargar(); }} />
      )}
      {editando && (
        <ModalEditarEnvio detalle={editando}
          onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); setDetalles(prev => { const c = { ...prev }; delete c[editando.movimiento.id]; return c; }); setExpandido(null); cargar(); }} />
      )}
    </div>
  );
}

// Modal de recepción: el destino tilda qué productos llegaron y deja una nota.
// Lo tildado mueve stock; lo no tildado se marca como faltante y no mueve stock.
function ModalRecepcion({ detalle, onClose, onConfirmado }) {
  const mov = detalle.movimiento;
  const [marcas, setMarcas] = useState(() => {
    const m = {}; for (const it of detalle.items) m[it.item_id] = true; return m; // todos llegaron por defecto
  });
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id) => setMarcas(prev => ({ ...prev, [id]: !prev[id] }));
  const todos = () => setMarcas(() => { const m = {}; for (const it of detalle.items) m[it.item_id] = true; return m; });
  const ninguno = () => setMarcas(() => { const m = {}; for (const it of detalle.items) m[it.item_id] = false; return m; });
  const faltan = detalle.items.filter(it => !marcas[it.item_id]).length;

  const confirmar = async () => {
    try {
      setEnviando(true); setError('');
      await api.post(`/api/multinegocio/movimientos/${mov.id}/recibir`, {
        items: detalle.items.map(it => ({ item_id: it.item_id, recibido: !!marcas[it.item_id] })),
        comentario: comentario.trim() || null,
      });
      onConfirmado();
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo confirmar la recepción');
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b bg-emerald-600 text-white flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold">📥 Confirmar recepción</h3>
            <p className="text-emerald-100 text-xs">De {mov.origen_nombre} · Remito N° {String(mov.id).padStart(6, '0')}</p>
          </div>
          <button onClick={onClose} className="text-emerald-200 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-4 border-b flex-shrink-0 flex items-center justify-between gap-2">
          <p className="text-sm text-gray-600">Tildá lo que <b>llegó físicamente</b>. Lo que no tildes se marca como faltante y no suma stock.</p>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={todos} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">Todos</button>
            <button onClick={ninguno} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">Ninguno</button>
          </div>
        </div>

        {mov.comentario_envio && (
          <div className="px-4 pt-3 flex-shrink-0"><p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">📝 Nota del envío: {mov.comentario_envio}</p></div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {detalle.items.map(it => (
            <label key={it.item_id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer ${marcas[it.item_id] ? 'border-emerald-300 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <input type="checkbox" checked={!!marcas[it.item_id]} onChange={() => toggle(it.item_id)} className="w-5 h-5 accent-emerald-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{it.nombre_producto}</p>
                <p className="text-[11px] text-gray-400">{marcas[it.item_id] ? 'Llegó' : 'Faltó (no suma stock)'}</p>
              </div>
              <span className="text-sm font-semibold text-gray-700">{cant(it.cantidad)}</span>
            </label>
          ))}
        </div>

        <div className="p-4 border-t flex-shrink-0 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {faltan > 0 && <p className="text-xs text-orange-600">⚠️ {faltan} producto(s) sin tildar quedarán como faltantes.</p>}
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2}
            placeholder="Comentario de la recepción (opcional): ej. 'llegó todo salvo 2 gaseosas rotas'"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 text-sm font-medium">Cancelar</button>
            <button onClick={confirmar} disabled={enviando}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold">
              {enviando ? 'Confirmando…' : '✅ Confirmar recepción'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal para EDITAR un envío en proceso (lado origen): cambiar cantidades, quitar
// o agregar productos, antes de que el destino lo confirme.
const UNIDADES_DECIMAL_ME = ['kg', 'lt', 'mt'];
function ModalEditarEnvio({ detalle, onClose, onGuardado }) {
  const mov = detalle.movimiento;
  const destinoId = mov.negocio_destino_id;
  const [carrito, setCarrito] = useState(() => (detalle.items || []).map(it => ({
    producto_id: it.producto_origen_id, nombre: it.nombre_producto, codigo: it.codigo,
    precio_costo: Number(it.costo_unitario) || 0, unidad: 'Uni', cantidad: Number(it.cantidad) || 0,
  })));
  const [comentario, setComentario] = useState(mov.comentario_envio || '');
  const [buscar, setBuscar] = useState('');
  const [resultados, setResultados] = useState([]);
  const [matches, setMatches] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Buscador de productos del origen.
  useEffect(() => {
    if (buscar.trim().length === 0) { setResultados([]); return; }
    const termino = buscar.trim();
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/api/productos?buscar=${encodeURIComponent(termino)}&rapida=1`);
        if (termino === buscar.trim()) setResultados(res.data || []);
      } catch { /* noop */ }
    }, 350);
    return () => clearTimeout(t);
  }, [buscar]);

  // Revalidar match en destino cuando cambia el carrito.
  useEffect(() => {
    if (carrito.length === 0) { setMatches({}); return; }
    let vig = true;
    api.post('/api/multinegocio/movimiento/validar', { destino_id: Number(destinoId), items: carrito.map(it => ({ producto_id: it.producto_id })) })
      .then(res => { if (vig) { const m = {}; for (const r of (res.data.items || [])) m[r.producto_id] = r; setMatches(m); } })
      .catch(() => { if (vig) setMatches({}); });
    return () => { vig = false; };
  }, [carrito, destinoId]);

  const agregar = (prod) => {
    setBuscar(''); setResultados([]);
    setCarrito(prev => {
      const ex = prev.find(x => x.producto_id === prod.id);
      if (ex) return prev.map(x => x.producto_id === prod.id ? { ...x, cantidad: (Number(x.cantidad) || 0) + 1 } : x);
      return [...prev, { producto_id: prod.id, nombre: prod.nombre, codigo: prod.codigo, precio_costo: parseFloat(prod.precio_costo) || 0, unidad: prod.unidad || 'Uni', cantidad: 1 }];
    });
  };
  const cambiarCant = (id, v) => { const n = parseFloat(v); setCarrito(prev => prev.map(x => x.producto_id === id ? { ...x, cantidad: isNaN(n) ? '' : n } : x)); };
  const quitar = (id) => setCarrito(prev => prev.filter(x => x.producto_id !== id));

  const totalCosto = carrito.reduce((a, it) => a + (Number(it.precio_costo) || 0) * (Number(it.cantidad) || 0), 0);
  const hayBloqueados = carrito.some(it => matches[it.producto_id] && matches[it.producto_id].destino_producto_id == null);
  const hayCantInvalida = carrito.some(it => !(Number(it.cantidad) > 0));
  const puedeGuardar = carrito.length > 0 && !hayBloqueados && !hayCantInvalida && !guardando;

  const guardar = async () => {
    if (!puedeGuardar) return;
    try {
      setGuardando(true); setError('');
      await api.post(`/api/multinegocio/movimientos/${mov.id}/editar`, {
        items: carrito.map(it => ({ producto_origen_id: it.producto_id, cantidad: Number(it.cantidad) })),
        comentario: comentario.trim() || null,
      });
      onGuardado();
    } catch (e) {
      if (e.response?.data?.faltantes) setError(`${e.response.data.error}\n• ${e.response.data.faltantes.join('\n• ')}`);
      else setError(e.response?.data?.error || 'No se pudo guardar');
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b bg-indigo-600 text-white flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold">✏️ Editar envío</h3>
            <p className="text-indigo-200 text-xs">A {mov.destino_nombre} · Remito N° {String(mov.id).padStart(6, '0')} (en proceso)</p>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-4 border-b flex-shrink-0 relative">
          <input type="text" value={buscar} onChange={e => setBuscar(e.target.value)}
            placeholder="Agregar un producto (nombre o código)…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {resultados.length > 0 && (
            <div className="absolute z-10 left-4 right-4 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {resultados.map(p => (
                <button key={p.id} onClick={() => agregar(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center justify-between gap-3">
                  <span className="truncate">{p.nombre}</span>
                  <span className="text-gray-400 text-xs flex-shrink-0">costo {fmt(p.precio_costo)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {carrito.length === 0 ? (
            <div className="text-center text-gray-400 py-10"><p className="text-4xl mb-2">📦</p><p>Agregá productos al envío</p></div>
          ) : (
            <div className="space-y-2">
              {carrito.map(it => {
                const m = matches[it.producto_id];
                const sinMatch = m && m.destino_producto_id == null;
                const esDec = UNIDADES_DECIMAL_ME.includes((it.unidad || '').toLowerCase());
                return (
                  <div key={it.producto_id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${sinMatch ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{it.nombre}</p>
                      {sinMatch ? <p className="text-[11px] text-red-600">No existe en {mov.destino_nombre} — quitalo o creálo allá</p>
                        : <p className="text-[11px] text-gray-500">costo {fmt(it.precio_costo)} c/u</p>}
                    </div>
                    <input type="number" min={esDec ? '0' : '1'} step={esDec ? '0.001' : '1'} value={it.cantidad}
                      onChange={e => cambiarCant(it.producto_id, e.target.value)}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <span className="text-sm font-semibold text-gray-700 w-24 text-right">{fmt((Number(it.precio_costo) || 0) * (Number(it.cantidad) || 0))}</span>
                    <button onClick={() => quitar(it.producto_id)} className="text-gray-400 hover:text-red-500 text-lg">×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex-shrink-0 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-line">{error}</p>}
          {hayBloqueados && !error && <p className="text-xs text-red-600">Hay productos que no existen en el destino. Quitalos para poder guardar.</p>}
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={2}
            placeholder="Comentario del envío (opcional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Valor de costo del envío</span>
            <span className="text-xl font-bold text-gray-800">{fmt(totalCosto)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 text-sm font-medium">Cancelar</button>
            <button onClick={guardar} disabled={!puedeGuardar}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold">
              {guardando ? 'Guardando…' : '💾 Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal para vincular un negocio con sus claves de acceso.
function ModalVincular({ onClose, onVinculado }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Completá mail y contraseña'); return; }
    try {
      setEnviando(true);
      setError('');
      const res = await api.post('/api/multinegocio/vincular', { email: email.trim(), password });
      if (res.data.ya_vinculado) {
        alert('Ese negocio ya estaba vinculado.');
      }
      onVinculado();
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo vincular el negocio');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b bg-indigo-600 text-white">
          <h3 className="text-lg font-bold">🔗 Vincular negocio</h3>
          <button onClick={onClose} className="text-indigo-200 hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={enviar} className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Ingresá las <b>claves de acceso</b> del otro negocio (el mail y la contraseña con la que
            entrás a ese negocio). Así confirmamos que es tuyo.
          </p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mail del negocio</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="negocio@mail.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contraseña de acceso</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Cancelar</button>
            <button type="submit" disabled={enviando}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold">
              {enviando ? 'Vinculando…' : 'Vincular'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MisNegocios;
