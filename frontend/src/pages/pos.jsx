import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import useCerrarConAtras from '../hooks/useCerrarConAtras';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useConectividad } from '../context/ConectividadContext';
import { ModalGasto } from '../components/admin/Gastos';
import ModalDetalleVenta from '../components/admin/DetalleVenta';
import { imprimirTicket } from '../components/ticket';
import ComprobanteElectronico from '../components/ComprobanteElectronico';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import VentaProductoModal from '../components/admin/VentaProductoModal';
import { finDiaComercial } from '../utils/fecha';

/**
 * Formatea un número como moneda argentina (ARS)
 * @param {number} n - Número a formatear
 * @returns {string} Número formateado como moneda
 */
const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0
}).format(n || 0);


// =============================================
// MODAL: SELECCIÓN/APERTURA DE CAJA
// =============================================
function ModalSeleccionCaja({ cajasAbiertas, cajasFijas, onAbrir, onAbrirFija, onAbrirProvisoria, onUnirse, sugerenciaInicio = 0 }) {
  // Selección: { tipo: 'fija-cerrada'|'fija-abierta'|'abierta'|'provisoria', id }
  const [seleccion, setSeleccion] = useState(null);
  const [vistaEventual, setVistaEventual] = useState(false);
  const [nombre, setNombre] = useState('');
  // Precargamos el efectivo con lo que dejó la caja anterior (arrastre).
  const [inicioCaja, setInicioCaja] = useState(sugerenciaInicio ? String(sugerenciaInicio) : '');

  // Cajas abiertas que NO son cajas fijas (eventuales abiertas por alguien)
  const idsTurnosFijas = cajasFijas.filter(c => c.turno_abierto_id).map(c => c.turno_abierto_id);
  const abiertasEventuales = cajasAbiertas.filter(c => !idsTurnosFijas.includes(c.id));
  const datosAbierta = (turnoId) => cajasAbiertas.find(c => c.id === turnoId);

  // Todas las cajas fijas ya se usaron hoy o están abiertas → no queda ninguna
  // fija "fresca" para abrir; se ofrece una caja provisoria.
  const todasFijasUsadas = cajasFijas.length > 0 && cajasFijas.every(c => c.usada_hoy || c.turno_abierto_id);
  const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

  const confirmar = () => {
    if (!seleccion) return;
    if (seleccion.tipo === 'fija-cerrada') {
      // Si la caja fija ya se usó hoy (en el día comercial actual), avisamos antes
      // de abrirla de nuevo.
      const caja = cajasFijas.find(c => c.id === seleccion.id);
      if (caja?.usada_hoy && !window.confirm(`La caja "${caja.nombre}" ya se usó hoy.\n\n¿Querés abrirla otra vez?`)) return;
      onAbrirFija(seleccion.id, parseFloat(inicioCaja) || 0);
    } else if (seleccion.tipo === 'provisoria') {
      onAbrirProvisoria(parseFloat(inicioCaja) || 0);
    } else {
      onUnirse(seleccion.id); // fija-abierta y abierta usan el turno_id
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-5 border-b text-white" style={{ backgroundColor: 'var(--color-primario)' }}>
          <h3 className="text-xl font-bold">🏦 Apertura de Caja</h3>
          <p className="text-white text-opacity-80 text-sm mt-1">Elegí la caja de tu turno</p>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {!vistaEventual ? (
            <>
              {/* Cajas FIJAS del local */}
              {cajasFijas.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🏪 Cajas del local</p>
                  {cajasFijas.map(cf => {
                    const abierta = !!cf.turno_abierto_id;
                    const info = abierta ? datosAbierta(cf.turno_abierto_id) : null;
                    const activa = seleccion && ((abierta && seleccion.id === cf.turno_abierto_id) || (!abierta && seleccion.tipo === 'fija-cerrada' && seleccion.id === cf.id));
                    return (
                      <button key={cf.id} type="button"
                        onClick={() => setSeleccion(abierta ? { tipo: 'fija-abierta', id: cf.turno_abierto_id } : { tipo: 'fija-cerrada', id: cf.id })}
                        className={`w-full p-3.5 rounded-xl border-2 text-left transition-all ${activa ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-800">{cf.nombre}</p>
                              {!abierta && cf.usada_hoy && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">ya se usó hoy</span>
                              )}
                            </div>
                            {abierta ? (
                              <p className="text-xs text-green-600 mt-0.5">🔓 Abierta · {info?.total_usuarios || 1} usuario(s) · {info?.total_ventas || 0} ventas</p>
                            ) : cf.usada_hoy ? (
                              <p className="text-xs text-gray-400 mt-0.5">🔒 Cerrada — tocá para volver a abrirla</p>
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5">🔒 Cerrada — tocá para abrirla</p>
                            )}
                          </div>
                          {abierta && info && (
                            <p className="font-bold text-orange-500 flex-shrink-0">{fmt(info.total_facturado)}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Caja provisoria: cuando ya se usaron todas las cajas fijas del día */}
              {todasFijasUsadas && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  <button type="button" onClick={() => setSeleccion({ tipo: 'provisoria' })}
                    className={`w-full p-3.5 rounded-xl border-2 text-left transition-all ${seleccion?.tipo === 'provisoria' ? 'border-orange-500 bg-orange-50' : 'border-dashed border-gray-300 hover:border-gray-400'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-gray-800">➕ Caja provisoria</p>
                        <p className="text-xs text-gray-500 mt-0.5">Ya se usaron las cajas del local · {horaActual} → fin del día</p>
                      </div>
                    </div>
                  </button>
                </>
              )}

              {/* Cajas eventuales abiertas */}
              {abiertasEventuales.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">📋 Otras cajas abiertas</p>
                  {abiertasEventuales.map(caja => (
                    <button key={caja.id} type="button" onClick={() => setSeleccion({ tipo: 'abierta', id: caja.id })}
                      className={`w-full p-3.5 rounded-xl border-2 text-left transition-all ${seleccion?.tipo === 'abierta' && seleccion.id === caja.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-800">{caja.nombre}</p>
                          <p className="text-xs text-green-600 mt-0.5">🔓 {caja.total_usuarios} usuario(s) · {caja.total_ventas} ventas</p>
                        </div>
                        <p className="font-bold text-orange-500">{fmt(caja.total_facturado)}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {cajasFijas.length === 0 && abiertasEventuales.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No hay cajas definidas todavía.<br />El administrador puede crearlas en <b>Control de Cajas</b>, o abrí una caja eventual.
                </p>
              )}

              {/* Efectivo inicial: al abrir una caja fija cerrada o una provisoria */}
              {(seleccion?.tipo === 'fija-cerrada' || seleccion?.tipo === 'provisoria') && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 animate-aparecer">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Efectivo inicial en caja</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <input type="number" value={inicioCaja} onChange={(e) => setInicioCaja(e.target.value)} autoFocus
                      className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="0" min="0" />
                  </div>
                  {sugerenciaInicio > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Precargado con el efectivo que dejó la caja anterior ({fmt(sugerenciaInicio)}).</p>
                  )}
                </div>
              )}

              <button onClick={confirmar} disabled={!seleccion}
                style={{ backgroundColor: seleccion ? 'var(--color-primario)' : '' }}
                className="w-full py-3 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold transition-colors">
                {!seleccion ? 'Seleccioná una caja'
                  : seleccion.tipo === 'fija-cerrada' ? '🔓 Abrir caja'
                  : seleccion.tipo === 'provisoria' ? '🔓 Abrir caja provisoria'
                  : '✅ Unirme a esta caja'}
              </button>

              <button onClick={() => { setVistaEventual(true); setSeleccion(null); }}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                ➕ Necesito una caja eventual (caso particular)
              </button>
            </>
          ) : (
            <>
              {/* Caja eventual: nombre libre */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">➕ Caja eventual</p>
              <p className="text-xs text-gray-400">Para un caso particular (evento, delivery, prueba). Las cajas de todos los días se crean fijas desde Control de Cajas.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la caja *</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Ej: Evento, Delivery..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Efectivo inicial en caja</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input type="number" value={inicioCaja} onChange={(e) => setInicioCaja(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="0" min="0" />
                </div>
              </div>
              <button onClick={() => nombre.trim() && onAbrir(nombre.trim(), parseFloat(inicioCaja) || 0)} disabled={!nombre.trim()}
                style={{ backgroundColor: nombre.trim() ? 'var(--color-primario)' : '' }}
                className="w-full py-3 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold transition-colors">
                🔓 Abrir Caja "{nombre || '...'}"
              </button>
              <button onClick={() => setVistaEventual(false)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                ← Volver a las cajas del local
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================
// MODAL: VENTA RÁPIDA
// =============================================
function ModalVentaRapida({ onAgregar, onCerrar }) {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [cantidad, setCantidad] = useState('1');

  const agregar = (e) => {
    e.preventDefault();
    if (!nombre || !precio) return;
    onAgregar({
      producto_id: `rapida-${Date.now()}`,
      nombre_producto: nombre,
      precio_unitario: parseFloat(precio),
      cantidad: parseFloat(cantidad) || 1,
      subtotal: parseFloat(precio) * (parseFloat(cantidad) || 1),
      esRapida: true,
    });
    onCerrar();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b bg-purple-600 text-white">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <div>
              <h3 className="text-lg font-bold">Venta Rápida</h3>
              <p className="text-purple-200 text-xs">F1 · Sin inventario</p>
            </div>
          </div>
          <button onClick={onCerrar} className="text-purple-200 hover:text-white text-2xl">×</button>
        </div>
        <form onSubmit={agregar} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">¿Qué vendiste? *</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="Ej: Caramelos, Propina, Bolsa..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} required min="0"
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
              <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} min="1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors">
              ➕ Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================
// MODAL: ALTA RÁPIDA DE PRODUCTO (queda por revisar)
// =============================================
function ModalProductoRapido({ onCerrar, onCreado }) {
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [precio, setPrecio] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setError('');
    setGuardando(true);
    try {
      const res = await api.post('/api/productos/rapido', {
        nombre: nombre.trim(),
        codigo: codigo.trim() || null,
        precio_venta: precio ? parseFloat(precio) : 0,
      });
      if (onCreado) onCreado(res.data);
      onCerrar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al dar de alta el producto');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onCerrar}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b bg-teal-600 text-white">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏷️</span>
            <div>
              <h3 className="text-lg font-bold">Alta rápida de producto</h3>
              <p className="text-teal-100 text-xs">F7 · Para productos sin precio</p>
            </div>
          </div>
          <button onClick={onCerrar} className="text-teal-200 hover:text-white text-2xl">×</button>
        </div>
        <form onSubmit={guardar} className="p-5 space-y-4">
          {error && <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg text-sm">❌ {error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del producto *</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Ej: Galletitas surtidas" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código de barras <span className="text-gray-400">(opcional)</span></label>
            <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Escaneá o escribí el código" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio final <span className="text-gray-400">(opcional)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} min="0" step="0.01"
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder="0,00" />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            ⚠️ Queda marcado <b>"por revisar"</b> para que un administrador complete sus datos (costo, categoría, stock).
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={guardando || !nombre.trim()}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-lg font-bold transition-colors">
              {guardando ? 'Guardando...' : '✅ Dar de alta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================
// MODAL: HISTORIAL DE VENTAS DEL TURNO
// =============================================
function ModalHistorial({ turno, onCerrar, config }) {
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [detalleVenta, setDetalleVenta] = useState(null);
const [comprobanteReimprimir, setComprobanteReimprimir] = useState(null);

  // Función para cargar ventas del turno actual
  const cargarVentas = async () => {
    try {
      setCargando(true);
      const res = await api.get(`/api/reportes/historial?turno_id=${turno.id}`);
      setVentas(res.data.ventas || []);
    } catch (err) {
      console.error('Error al cargar ventas:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarVentas();
    
    // Actualizar cada 5 segundos mientras el modal esté abierto
    const interval = setInterval(cargarVentas, 5000);
    return () => clearInterval(interval);
  }, []);

  // Función para cargar el detalle de una venta
  const cargarDetalleVenta = async (ventaId) => {
    try {
      const res = await api.get(`/api/ventas/${ventaId}`);
      setDetalleVenta(res.data);
      setVentaSeleccionada(ventaId);
    } catch (err) {
      console.error('Error al cargar detalle de venta:', err);
      alert('Error al cargar el detalle de la venta');
    }
  };

  // Función para eliminar venta
  const eliminarVenta = async (id, total) => {
    if (!window.confirm(`¿Eliminar esta venta de ${fmt(total)}?`)) return;
    try {
      setActualizando(true);
      await api.delete(`/api/ventas/${id}`);
      cargarVentas(); // Refrescar lista
      if (ventaSeleccionada === id) {
        setDetalleVenta(null);
        setVentaSeleccionada(null);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar venta');
    } finally {
      setActualizando(false);
    }
  };

  // Función para reimprimir ticket
const reimprimirTicket = async (venta) => {
    try {
      setActualizando(true);
      const res = await api.get(`/api/ventas/${venta.id}`);
      
      // Si tiene comprobante electrónico, mostrarlo en lugar del ticket común
      if (res.data.comprobante_electronico_id) {
        try {
          const resComp = await api.get(`/api/arca/comprobantes?venta_id=${venta.id}`);
          if (resComp.data?.length > 0) {
            setComprobanteReimprimir(resComp.data[0]);
            return;
          }
        } catch { }
      }
      
      imprimirTicket({
        venta: res.data,
        items: res.data.items || [],
        config,
      });
    } catch (err) {
      console.error('Error reimprimiendo ticket:', err.response?.data || err.message || err);
      alert(`Error al reimprimir ticket: ${err.response?.data?.error || err.message || 'desconocido'}`);
    } finally {
      setActualizando(false);
    }
  };

  const totalDelTurno = ventas.reduce((acc, v) => acc + parseFloat(v.total || 0), 0);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b bg-gray-800 text-white">
            <div>
              <h3 className="text-lg font-bold">📋 Historial del Turno</h3>
              <p className="text-gray-400 text-xs mt-0.5">F5 · {turno?.nombre} · Actualiza cada 5s</p>
            </div>
            <button onClick={onCerrar} className="text-gray-400 hover:text-white text-2xl">×</button>
          </div>
          <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Total del turno</p>
              <p className="text-2xl font-bold text-gray-800">{fmt(totalDelTurno)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Ventas</p>
              <p className="text-2xl font-bold text-gray-800">{ventas.length}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cargando ? (
              <p className="text-center text-gray-400 py-8">Cargando...</p>
            ) : ventas.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">🛒</p>
                <p>No hay ventas en este turno</p>
              </div>
            ) : (
              ventas.map(venta => (
                <div key={venta.id} 
                  className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                    venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id
                      ? 'border-green-200 bg-gradient-to-r from-green-50 to-white hover:border-green-300' 
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                  onClick={() => cargarDetalleVenta(venta.id)}>
                  <div className="flex items-center justify-between">
                    {/* Izquierda: ID + Tipo + Método de pago */}
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md ${
                        venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white' 
                          : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                      }`}>
                        #{venta.id}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-800">
                            {venta.metodo_pago === 'efectivo' ? '💵' : venta.metodo_pago === 'tarjeta' ? '💳' : venta.metodo_pago === 'mercadopago' ? '📱' : '🏦'} {venta.metodo_pago}
                          </p>
                          {(venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id) && (
                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">
                              🧾 Electrónica
                            </span>
                          )}
                          {venta.tipo_facturacion === 'x' && !venta.comprobante_electronico_id && (
                            <span className="bg-gray-400 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                              📄 Factura X
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(venta.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          {venta.es_fiado && <span className="ml-2 bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-xs font-medium">Fiado</span>}
                        </p>
                      </div>
                    </div>

                    {/* Derecha: Total + Acciones */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`text-xl font-bold ${
                          venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id
                            ? 'text-green-700' 
                            : 'text-gray-800'
                        }`}>
                          {fmt(venta.total)}
                        </p>
                        <p className="text-xs text-gray-400">Total</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={(e) => {
                          e.stopPropagation();
                          reimprimirTicket(venta);
                        }}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            venta.tipo_facturacion === 'electronica' || venta.comprobante_electronico_id
                              ? 'bg-green-100 text-green-700 hover:bg-green-200 hover:shadow-md' 
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 hover:shadow-md'
                          }`}
                          title="Reimprimir">
                          🖨️
                        </button>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          eliminarVenta(venta.id, venta.total);
                        }}
                          className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 hover:shadow-md transition-all duration-200"
                          title="Eliminar">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {actualizando && (
            <div className="p-3 bg-gray-50 border-t flex items-center justify-center">
              <p className="text-sm text-gray-500">Procesando...</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalle de Venta */}
      {comprobanteReimprimir && (
        <ComprobanteElectronico
          comprobante={comprobanteReimprimir}
          config={config}
          onClose={() => setComprobanteReimprimir(null)}
        />
      )}

      {detalleVenta && (
        <ModalDetalleVenta
          venta={detalleVenta}
          onClose={() => {
            setDetalleVenta(null);
            setVentaSeleccionada(null);
          }}
          onReimprimir={reimprimirTicket}
          onEliminar={eliminarVenta}
        />
      )}
    </>
  );
}

// =============================================
// MODAL: CONFIRMAR VENTA
// =============================================
const ModalConfirmarVenta = forwardRef(function ModalConfirmarVenta({
  carrito,
  total,
  descuentoCarrito = 0,
  recargoCarrito = 0,
  config,
  turno,
  facturacionElectronica,
  setFacturacionElectronica,
  tipoComprobante,
  setTipoComprobante,
  tipoDocumento,
  setTipoDocumento,
  numeroDocumento,
  setNumeroDocumento,
  denominacionComprador,
  setDenominacionComprador,
  condicionIvaReceptor,
  setCondicionIvaReceptor,
  tiposComprobante,
  setTiposComprobante,
  onConfirmar,
  onCerrar
}, ref) {
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [efectivoEntregado, setEfectivoEntregado] = useState('');
  // Pago dividido: parte efectivo + parte por un medio virtual
  const [montoEfectivoDiv, setMontoEfectivoDiv] = useState('');
  const [montoVirtualDiv, setMontoVirtualDiv] = useState('');
  const [metodoVirtualDiv, setMetodoVirtualDiv] = useState('transferencia');
  const [facturarTodo, setFacturarTodo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [buscarCliente, setBuscarCliente] = useState('');
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [mostrarFormNuevoCliente, setMostrarFormNuevoCliente] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('');
  const [nuevoClienteTel, setNuevoClienteTel] = useState('');
  
  // Exponer la función confirmar al padre
  useImperativeHandle(ref, () => ({
    confirmar
  }));

  // Cargar tipos de comprobante según régimen fiscal
  useEffect(() => {
    if (config?.facturacion_electronica_activa && config?.regimen_fiscal) {
      api.get(`/api/arca/tipos-comprobante/${config.regimen_fiscal}`)
        .then(res => {
          setTiposComprobante(res.data);
          if (res.data.length > 0) {
            // Por defecto SIEMPRE Factura B (código 6, consumidor final) si existe.
            // La Factura A es solo para ventas a otros Responsables Inscriptos
            // y requiere CUIT del comprador: el cajero la elige a mano.
            const porDefecto = res.data.find(t => t.codigo === 6) || res.data[0];
            setTipoComprobante(porDefecto.codigo);
          }
        })
        .catch(() => {});
    }
  }, [config?.facturacion_electronica_activa, config?.regimen_fiscal]);

  // El descuento, recargo general y redondeo ahora se aplican desde el carrito
  // y llegan ya calculados en `total`, `descuentoCarrito` y `recargoCarrito`.
  const metodosActivos = typeof config?.metodos_pago_activos === 'string'
    ? JSON.parse(config.metodos_pago_activos)
    : (config?.metodos_pago_activos || ['efectivo']);

  const metodos = [
    { id: 'efectivo', label: '💵 Efectivo' },
    { id: 'tarjeta', label: '💳 Tarjeta' },
    { id: 'mercadopago', label: '📱 Mercado Pago' },
    { id: 'transferencia', label: '🏦 Transferencia' },
    { id: 'cuenta_corriente', label: '📋 Cuenta Corriente' },
    { id: 'dividido', label: '🔀 Pago dividido' },
  ].filter(m => m.id === 'cuenta_corriente' || m.id === 'dividido' || metodosActivos.includes(m.id));

  // Opciones para la parte virtual del pago dividido (las que estén activas)
  const mediosVirtuales = [
    { id: 'transferencia', label: '🏦 Transferencia' },
    { id: 'mercadopago', label: '📱 Mercado Pago' },
    { id: 'tarjeta', label: '💳 Tarjeta' },
  ].filter(m => metodosActivos.includes(m.id));

  useEffect(() => {
    if (buscarCliente.trim().length > 1) {
      api.get(`/api/clientes?buscar=${buscarCliente}`).then(res => setClientes(res.data)).catch(() => {});
    } else {
      setClientes([]);
    }
  }, [buscarCliente]);

  // Recargo por pago con tarjeta (se aplica sobre el total ya ajustado del carrito)
  const recargoTarjeta = (metodoPago === 'tarjeta' && config?.recargo_tarjeta > 0)
    ? Math.round(total * config.recargo_tarjeta / 100) : 0;
  const totalFinal = total + recargoTarjeta;
  const vuelto = metodoPago === 'efectivo' ? (parseFloat(efectivoEntregado) || 0) - totalFinal : 0;

  // Pago dividido: partes y límite de aviso por monto virtual alto
  const efDiv = parseFloat(montoEfectivoDiv) || 0;
  const viDiv = parseFloat(montoVirtualDiv) || 0;
  const sumaDiv = efDiv + viDiv;
  const limiteVirtual = parseFloat(config?.limite_aviso_pago_virtual) || 100000;

  // Al escribir un casillero, completar el otro para que sumen el total (ayuda memoria)
  const setEfectivoDividido = (val) => {
    setMontoEfectivoDiv(val);
    const n = parseFloat(val);
    if (!isNaN(n)) setMontoVirtualDiv(String(Math.max(0, Math.round((totalFinal - n) * 100) / 100)));
  };
  const setVirtualDividido = (val) => {
    setMontoVirtualDiv(val);
    const n = parseFloat(val);
    if (!isNaN(n)) setMontoEfectivoDiv(String(Math.max(0, Math.round((totalFinal - n) * 100) / 100)));
  };

  const confirmar = async () => {
    if (metodoPago === 'cuenta_corriente' && !clienteSeleccionado) {
      alert('Seleccioná un cliente para la cuenta corriente');
      return;
    }
    // Validar monto en efectivo si está activado
    if (metodoPago === 'efectivo' && config?.validar_monto_efectivo) {
      const entregado = parseFloat(efectivoEntregado) || 0;
      if (entregado < totalFinal) {
        alert(`❌ El monto entregado (${fmt(entregado)}) es menor al total (${fmt(totalFinal)})`);
        return;
      }
    }

    // Pago dividido: las partes deben sumar el total
    if (metodoPago === 'dividido') {
      if (efDiv <= 0 || viDiv <= 0) {
        alert('Cargá el monto en efectivo y el monto virtual.');
        return;
      }
      if (Math.abs(sumaDiv - totalFinal) > 1) {
        alert(`Las partes deben sumar el total (${fmt(totalFinal)}). Ahora suman ${fmt(sumaDiv)}.`);
        return;
      }
    }

    // Aviso por monto virtual alto (evita errores de tipeo)
    const montoVirtualACobrar = metodoPago === 'dividido' ? viDiv
      : (['transferencia', 'mercadopago', 'tarjeta'].includes(metodoPago) ? totalFinal : 0);
    if (montoVirtualACobrar > limiteVirtual) {
      if (!window.confirm(`⚠️ Vas a cobrar ${fmt(montoVirtualACobrar)} por un medio virtual.\nEs un monto alto. ¿Confirmás que es correcto?`)) return;
    }

    setCargando(true);
    try {
      await onConfirmar({
        metodoPago,
        descuento: descuentoCarrito,
        recargo: recargoCarrito + recargoTarjeta,
        totalFinal,
        clienteId: clienteSeleccionado?.id || null,
        esFiado: metodoPago === 'cuenta_corriente',
        montoEfectivo: metodoPago === 'dividido' ? efDiv : null,
        montoVirtual: metodoPago === 'dividido' ? viDiv : null,
        metodoVirtual: metodoPago === 'dividido' ? metodoVirtualDiv : null,
        facturarTodo,
      });
    } finally { setCargando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
       <div className="flex items-center justify-between p-6 border-b bg-gray-800 text-white flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold">💳 Confirmar Venta</h3>
            <p className="text-gray-400 text-sm">F8 para confirmar · Esc para cancelar</p>
          </div>
          <button onClick={onCerrar} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="bg-gray-50 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{carrito.length} productos</p>
              <p className="text-3xl font-bold text-gray-800">{fmt(total)}</p>
            </div>
            <div className="text-5xl">🛒</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Método de pago</label>
            <div className="grid grid-cols-2 gap-3">
              {metodos.map(m => (
                <button key={m.id} type="button" onClick={() => setMetodoPago(m.id)}
                  style={metodoPago === m.id ? { backgroundColor: 'var(--color-primario)', borderColor: 'var(--color-primario)' } : {}}
                  className={`py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all ${metodoPago === m.id ? 'text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
      

          {/* Recargo por tarjeta (automático según método de pago) */}
          {recargoTarjeta > 0 && (
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 text-sm">
              <span className="text-gray-500">Recargo tarjeta ({config.recargo_tarjeta}%)</span>
              <span className="font-semibold text-gray-800">+ {fmt(recargoTarjeta)}</span>
            </div>
          )}

          {metodoPago === 'cuenta_corriente' && (
            <div className="space-y-4">
              {!clienteSeleccionado ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Buscar cliente</label>
                  <input type="text" value={buscarCliente} onChange={(e) => setBuscarCliente(e.target.value)} autoFocus
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="Nombre o teléfono..." />
                  {clientes.length > 0 && (
                    <div className="border border-gray-200 rounded-xl mt-2 max-h-48 overflow-y-auto">
                      {clientes.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setClienteSeleccionado(c); setBuscarCliente(''); setClientes([]); }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0 transition-colors">
                          <p className="font-medium text-gray-800 text-sm">{c.nombre}</p>
                          <p className="text-xs text-red-500">Deuda: {fmt(c.saldo_deuda)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {!mostrarFormNuevoCliente ? (
                    <button type="button" onClick={() => setMostrarFormNuevoCliente(true)}
                      className="mt-3 text-orange-500 hover:text-orange-600 text-sm font-medium">
                      + Crear nuevo cliente
                    </button>
                  ) : (
                    <div className="mt-3 space-y-3 p-4 bg-gray-50 rounded-xl">
                      <input type="text" value={nuevoClienteNombre} onChange={(e) => setNuevoClienteNombre(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="Nombre *" autoFocus />
                      <input type="text" value={nuevoClienteTel} onChange={(e) => setNuevoClienteTel(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="Teléfono (opcional)" />
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setMostrarFormNuevoCliente(false)}
                          className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 text-sm hover:bg-gray-100">Cancelar</button>
                        <button type="button"
                          onClick={async () => {
                            if (!nuevoClienteNombre) return;
                            const res = await api.post('/api/clientes', { nombre: nuevoClienteNombre, telefono: nuevoClienteTel });
                            setClienteSeleccionado(res.data);
                            setMostrarFormNuevoCliente(false);
                          }}
                          className="flex-1 py-2 text-white rounded-lg text-sm font-medium"
                          style={{ backgroundColor: 'var(--color-primario)' }}>Crear</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{clienteSeleccionado.nombre}</p>
                    <p className="text-sm text-gray-500">{clienteSeleccionado.telefono || 'Sin teléfono'}</p>
                  </div>
                  <button type="button" onClick={() => setClienteSeleccionado(null)}
                    className="text-gray-400 hover:text-red-500 text-sm">Cambiar</button>
                </div>
              )}
            </div>
          )}

          {metodoPago === 'efectivo' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Efectivo entregado</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                <input type="number" value={efectivoEntregado} onChange={(e) => setEfectivoEntregado(e.target.value)}
                  autoFocus min="0"
                  className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-xl focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="0" />
              </div>
            </div>
          )}

          {/* Pago dividido */}
          {metodoPago === 'dividido' && (
            <div className="space-y-3 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
              <p className="text-xs text-indigo-700">
                💡 Cargá cuánto paga en efectivo y cuánto por medio virtual. Al completar uno, se autocompleta el otro para que sumen el total.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">💵 Efectivo</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                    <input type="number" min="0" value={montoEfectivoDiv}
                      onChange={(e) => setEfectivoDividido(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">🔀 Virtual</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                    <input type="number" min="0" value={montoVirtualDiv}
                      onChange={(e) => setVirtualDividido(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="0" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Medio de la parte virtual</label>
                <select value={metodoVirtualDiv} onChange={(e) => setMetodoVirtualDiv(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  {(mediosVirtuales.length ? mediosVirtuales : [{ id: 'transferencia', label: '🏦 Transferencia' }]).map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              {/* Ayuda memoria del estado de la suma */}
              <div className={`text-sm font-medium rounded-lg px-3 py-2 ${
                Math.abs(sumaDiv - totalFinal) <= 1 && sumaDiv > 0
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {sumaDiv === 0
                  ? `Total a repartir: ${fmt(totalFinal)}`
                  : Math.abs(sumaDiv - totalFinal) <= 1
                    ? `✅ Suma correcta: ${fmt(sumaDiv)}`
                    : sumaDiv < totalFinal
                      ? `Faltan ${fmt(totalFinal - sumaDiv)} para llegar al total (${fmt(totalFinal)})`
                      : `Te pasaste ${fmt(sumaDiv - totalFinal)} del total (${fmt(totalFinal)})`}
              </div>
            </div>
          )}

          {/* Facturación Electrónica */}
          {config?.facturacion_electronica_activa && (
            <div className="space-y-3">
              {/* Botón principal de facturación */}
              <button type="button"
                onClick={() => setFacturacionElectronica(!facturacionElectronica)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  facturacionElectronica 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 bg-white hover:border-orange-300'
                }`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧾</span>
                  <div>
                    <p className="font-medium text-gray-700 text-sm">Facturación Electrónica</p>
                    <p className="text-xs text-gray-500">
                      {facturacionElectronica ? 'Comprobante válido ante ARCA' : 'Factura X (sin valor fiscal)'}
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  facturacionElectronica ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {facturacionElectronica ? 'ACTIVADO' : 'DESACTIVADO'}
                </div>
              </button>

              {/* Campos de facturación electrónica */}
              {facturacionElectronica && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  {/* En pago dividido, por defecto se factura solo la parte virtual */}
                  {metodoPago === 'dividido' && (
                    <div className="space-y-2">
                      <label className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-gray-200 cursor-pointer">
                        <span className="text-sm text-gray-700">Facturar todo (efectivo + virtual)</span>
                        <input type="checkbox" checked={facturarTodo}
                          onChange={(e) => setFacturarTodo(e.target.checked)}
                          className="w-5 h-5 accent-green-600" />
                      </label>
                      <p className="text-xs text-gray-500">
                        {facturarTodo
                          ? `Se factura el total: ${fmt(totalFinal)}`
                          : `Se factura solo la parte virtual: ${fmt(viDiv)} (la parte en efectivo no se factura)`}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Comprobante</label>
                    <select
                      value={tipoComprobante}
                      onChange={(e) => setTipoComprobante(parseInt(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      {tiposComprobante.map(t => (
                        <option key={t.codigo} value={t.codigo}>{t.emoji} {t.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Documento</label>
                    <select
                      value={tipoDocumento}
                      onChange={(e) => setTipoDocumento(parseInt(e.target.value))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value={99}>Consumidor Final</option>
                      <option value={96}>DNI</option>
                      <option value={80}>CUIT</option>
                    </select>
                  </div>

                  {tipoDocumento !== 99 && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Número de Documento</label>
                        <input
                          type="text"
                          value={numeroDocumento}
                          onChange={(e) => setNumeroDocumento(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          placeholder="Ej: 12345678"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Denominación Comprador</label>
                        <input
                          type="text"
                          value={denominacionComprador}
                          onChange={(e) => setDenominacionComprador(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          placeholder="Ej: Juan Pérez"
                        />
                      </div>
                      {tipoDocumento === 80 && ![1, 2, 3].includes(tipoComprobante) && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Condición IVA del comprador</label>
                          <select
                            value={condicionIvaReceptor || 6}
                            onChange={(e) => setCondicionIvaReceptor(parseInt(e.target.value))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          >
                            <option value={6}>Responsable Monotributo</option>
                            <option value={4}>IVA Exento</option>
                            <option value={15}>IVA No Alcanzado</option>
                            <option value={13}>Monotributista Social</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl p-5 text-white" style={{ backgroundColor: 'var(--color-primario)' }}>
            <div className="flex justify-between items-center">
              <span className="font-medium text-white text-opacity-90">Total a cobrar</span>
              <span className="text-3xl font-bold">{fmt(totalFinal)}</span>
            </div>
            {metodoPago === 'efectivo' && efectivoEntregado && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-white border-opacity-20">
                <span className="text-sm text-white text-opacity-80">Vuelto</span>
                <span className={`text-xl font-bold ${vuelto >= 0 ? 'text-white' : 'text-red-300'}`}>{fmt(vuelto)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-4 p-6 pt-0 flex-shrink-0">
          <button onClick={onCerrar} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={cargando}
            style={{ backgroundColor: 'var(--color-primario)' }}
            className="flex-grow py-3 text-white rounded-xl font-bold text-lg transition-colors disabled:opacity-50">
            {cargando
  ? (facturacionElectronica ? '🧾 Emitiendo comprobante ARCA...' : 'Procesando...')
  : (<>✅ Confirmar Venta <span className="hidden lg:inline">[F8]</span></>)}
          </button>
        </div>
      </div>
    </div>
  );
});

const ModalVentaExitosa = ({ total, onSeguirVendiendo, onImprimir, config, tieneComprobanteElectronico }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b bg-green-600 text-white">
          <div>
            <h3 className="text-xl font-bold">✅ Venta Exitosa</h3>
            <p className="text-green-100 text-sm">Total: {fmt(total)}</p>
          </div>
          <button onClick={onSeguirVendiendo} className="text-green-100 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎉</span>
            </div>
            <p className="text-lg font-semibold text-gray-800">¡Venta registrada con éxito!</p>
            <p className="text-sm text-gray-500 mt-1">¿Qué deseas hacer a continuación?</p>
          </div>
          
          <div className="space-y-3">
            <button onClick={onSeguirVendiendo}
              className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
              🛒 Seguir vendiendo
              <span className="hidden sm:inline text-xs font-mono bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">F8</span>
            </button>
            <button onClick={onImprimir}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors">
              {tieneComprobanteElectronico ? '🧾 Ver Comprobante Electrónico' : '🖨️ Imprimir ticket'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// MODAL: CIERRE DE CAJA
// =============================================
// MODAL: CONTAR BILLETES (REDISEÑADO)
// =============================================
function ModalContarBilletes({ onCerrar, onConfirmar }) {
  const BILLETES = [100, 200, 500, 1000, 2000, 10000, 20000];
  const [cantidades, setCantidades] = useState({});

  const total = BILLETES.reduce((acc, b) => acc + (parseInt(cantidades[b] || 0) * b), 0);

  const handleCantidadChange = (billete, valor) => {
    const cantidad = Math.max(0, parseInt(valor) || 0);
    setCantidades(prev => ({ ...prev, [billete]: cantidad.toString() }));
  };

  const limpiarTodo = () => {
    setCantidades({});
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-emerald-600 to-green-500 text-white rounded-t-3xl flex-shrink-0">
          <div>
            <h3 className="text-2xl font-bold">💵 Contar Billetes</h3>
            <p className="text-emerald-100 text-sm">F12 · Desglose de efectivo por denominaciones</p>
          </div>
          <button onClick={onCerrar} className="text-white/80 hover:text-white text-3xl leading-none">×</button>
        </div>

        <div className="flex flex-col flex-1 min-h-0">
          {/* Sección de Conteo */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                🧮 Conteo por Denominación
                <button
                  onClick={limpiarTodo}
                  className="ml-auto text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Limpiar todo
                </button>
              </h4>

              <div className="grid gap-3">
                {BILLETES.map(b => {
                  const cantidad = parseInt(cantidades[b] || 0);
                  const subtotal = cantidad * b;
                  const tieneValor = cantidad > 0;

                  return (
                    <div key={b} className={`bg-gradient-to-r from-gray-50 to-white rounded-2xl p-4 border-2 transition-all duration-200 hover:shadow-md ${
                      tieneValor ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50' : 'border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Denominación */}
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-lg ${
                              tieneValor ? 'bg-emerald-500' : 'bg-gray-400'
                            }`}>
                              {b >= 1000 ? (b / 1000) + 'k' : b}
                            </div>
                            <div>
                              <p className="text-lg font-bold text-gray-800">
                                ${b >= 1000 ? (b / 1000) + 'k' : b.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">Denominación</p>
                            </div>
                          </div>

                          {/* Multiplicador */}
                          <span className="text-gray-400 text-xl">×</span>

                          {/* Input de cantidad */}
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              value={cantidades[b] || ''}
                              onChange={(e) => handleCantidadChange(b, e.target.value)}
                              className="w-20 h-12 border-2 border-gray-300 rounded-xl px-3 py-2 text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* Subtotal */}
                        <div className="text-right">
                          <p className={`text-xl font-bold ${tieneValor ? 'text-emerald-600' : 'text-gray-600'}`}>
                            {fmt(subtotal)}
                          </p>
                          <p className="text-xs text-gray-500">Subtotal</p>
                        </div>
                      </div>

                      {/* Barra de progreso visual */}
                      {tieneValor && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{cantidad} billete{cantidad !== 1 ? 's' : ''}</span>
                            <span>{fmt(subtotal)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-emerald-400 to-green-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, (subtotal / total) * 100) || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer con Total y Botones */}
          <div className="border-t bg-gradient-to-r from-gray-50 to-white p-6">
            {/* Total General */}
            <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl p-5 mb-4 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Total Contado</p>
                  <p className="text-3xl font-bold">{fmt(total)}</p>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">💰</span>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCerrar}
                className="flex-1 py-4 border-2 border-gray-200 rounded-2xl text-gray-700 hover:bg-gray-50 transition-all duration-200 font-semibold text-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => onConfirmar(total)}
                disabled={total === 0}
                className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-green-500 text-white rounded-2xl font-bold text-lg transition-all duration-200 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                ✅ Usar {fmt(total)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalCierreCaja({ turno, onCerrar, onCerrado }) {
  const { usuario, logout } = useAuth();
  const [datos, setDatos] = useState({
    efectivo_retirado: '', dinero_siguiente: '',
    total_tarjetas: '', total_mercadopago: '',
    total_transferencias: '', comentarios: '',
  });
  const [cargando, setCargando] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [config, setConfig] = useState(null);
  const [pinIngresado, setPinIngresado] = useState('');
  const [infoRevelada, setInfoRevelada] = useState(false);
  const [errorPin, setErrorPin] = useState('');
  const [mostrarPinModal, setMostrarPinModal] = useState(false);
  const [mostrarContarBilletes, setMostrarContarBilletes] = useState(false);
  const [resultadoCierre, setResultadoCierre] = useState(null);
  const [ingresosExpandido, setIngresosExpandido] = useState(false);

  useEffect(() => {
    cargarResumen();
    cargarConfig();
  }, []);

  const cargarResumen = async () => {
    try {
      // ✅ AHORA TRAE SOLO LAS VENTAS DE ESTE TURNO EXACTO, NO TODO EL DIA
      const res = await api.get(`/api/reportes/historial?turno_id=${turno.id}`);
      setResumen(res.data);
    } catch (err) { console.error('Error:', err); }
  };

  const cargarConfig = async () => {
    try {
      const res = await api.get('/api/configuracion');
      setConfig(res.data);
      if (!res.data?.pin_cierre) setInfoRevelada(true);
    } catch { }
  };

  const revelarInfo = (pin = pinIngresado) => {
    const pinConfig = config?.pin_cierre;
    if (!pinConfig || pin === String(pinConfig)) {
      setInfoRevelada(true);
      setErrorPin('');
    } else {
      setErrorPin('PIN incorrecto');
      setTimeout(() => setErrorPin(''), 2000);
    }
  };

  const imprimirCierre = () => {
    // Construye e imprime un ticket de cierre de caja con resumen y diferencias.
    const fechaApertura = new Date(turno.fecha_apertura);
    const fechaCierre = new Date();
    const efectivoInicio = parseFloat(turno.inicio_caja || 0);
    const efectivoRetirado = parseFloat(datos.efectivo_retirado || 0);
    const efectivoSiguiente = parseFloat(datos.dinero_siguiente || 0);
    const efectivoDeclarado = efectivoRetirado + efectivoSiguiente;
    const tarjetas = parseFloat(datos.total_tarjetas || 0);
    const mercadopago = parseFloat(datos.total_mercadopago || 0);
    const transferencias = parseFloat(datos.total_transferencias || 0);
    const totalDeclarado = efectivoDeclarado + tarjetas + mercadopago + transferencias;
    // Los gastos pagados con dinero de la caja reducen lo que debe haber al cierre
    const gastosCaja = parseFloat(resumen?.gastosCaja || 0);
    const totalSistema = (resumen?.totalVendido || 0) + efectivoInicio - gastosCaja;
    const diferencia = totalDeclarado - totalSistema;

    const nombreNegocio = config?.nombre_negocio || 'Mi Negocio';
    const direccion = config?.direccion || '';
    const telefono = config?.telefono || '';
    const cuit = config?.cuit || '';
    const usuarioCierre = usuario?.nombre || usuario?.email || 'Usuario';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Cierre de Caja</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: bold; width: 80mm; max-width: 80mm; padding: 3mm; color: #000; background: #fff; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: 900; }
          .grande { font-size: 18px; font-weight: 900; }
          .small { font-size: 12px; }
          .separador { border-top: 1px dashed #000; margin: 4px 0; }
          .separador-doble { border-top: 2px solid #000; margin: 4px 0; }
          .fila { display: flex; justify-content: space-between; margin: 4px 0; }
          .fila-small { display: flex; justify-content: space-between; margin: 2px 0; font-size: 12px; }
          @media print {
            body { width: 80mm; }
            @page { size: 80mm auto; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="center bold grande">${nombreNegocio}</div>
        ${direccion ? `<div class="center small">${direccion}</div>` : ''}
        ${telefono ? `<div class="center small">Tel: ${telefono}</div>` : ''}
        ${cuit ? `<div class="center small">CUIT: ${cuit}</div>` : ''}
        <div class="separador-doble"></div>
        <div class="center bold">CIERRE DE CAJA</div>
        <div class="fila-small"><span>Turno:</span><span>${turno.nombre || ''}</span></div>
        <div class="fila-small"><span>Usuario:</span><span>${usuarioCierre}</span></div>
        <div class="fila-small"><span>Apertura:</span><span>${fechaApertura.toLocaleString('es-AR')}</span></div>
        <div class="fila-small"><span>Cierre:</span><span>${fechaCierre.toLocaleString('es-AR')}</span></div>
        <div class="separador"></div>
        <div class="fila"><span>Inicio de caja</span><span>${fmt(efectivoInicio)}</span></div>
        <div class="fila"><span>Efectivo declarado</span><span>${fmt(efectivoDeclarado)}</span></div>
        <div class="fila"><span>Retirado</span><span>${fmt(efectivoRetirado)}</span></div>
        <div class="fila"><span>Para siguiente turno</span><span>${fmt(efectivoSiguiente)}</span></div>
        <div class="separador"></div>
        <div class="fila"><span>Total ventas</span><span>${fmt(resumen?.totalVendido || 0)}</span></div>
        ${gastosCaja > 0 ? `<div class="fila"><span>Gastos de caja</span><span>-${fmt(gastosCaja)}</span></div>` : ''}
        <div class="fila"><span>Total esperado</span><span>${fmt(totalSistema)}</span></div>
        <div class="fila"><span>Total declarado</span><span>${fmt(totalDeclarado)}</span></div>
        <div class="fila"><span>Diferencia</span><span>${fmt(diferencia)}</span></div>
        <div class="separador"></div>
        <div class="fila"><span>Tarjetas</span><span>${fmt(tarjetas)}</span></div>
        <div class="fila"><span>Mercado Pago</span><span>${fmt(mercadopago)}</span></div>
        <div class="fila"><span>Transferencias</span><span>${fmt(transferencias)}</span></div>
        ${datos.comentarios ? `<div class="separador"></div><div class="small"><strong>Notas:</strong> ${datos.comentarios}</div>` : ''}
        <div class="separador-doble"></div>
        <div class="center small">¡Gracias por usar el sistema!</div>
        <div style="margin-top: 6px;"></div>
      </body>
      </html>
    `;

    const ventana = window.open('', '_blank', 'width=400,height=600');
    ventana.document.write(html);
    ventana.document.close();
    ventana.onload = () => {
      ventana.focus();
      ventana.print();
      ventana.onafterprint = () => ventana.close();
    };
  };

  const camposCompletos = () => {
    return datos.efectivo_retirado !== '' &&
      datos.dinero_siguiente !== '' &&
      datos.total_tarjetas !== '' &&
      datos.total_mercadopago !== '' &&
      datos.total_transferencias !== '';
  };

  const cerrar = async (e) => {
    e.preventDefault();
    if (!camposCompletos()) return;
    setCargando(true);
    try {
      await api.put(`/api/turnos/${turno.id}/cerrar`, datos);

      // Calcular diferencias
      if (resumen) {
        // Gastos pagados con dinero de la caja: reducen el efectivo esperado
        const gastosCaja = parseFloat(resumen.gastosCaja || 0);
        const efectivoDeclaro = parseFloat(datos.efectivo_retirado || 0) + parseFloat(datos.dinero_siguiente || 0);
        // El efectivo declarado incluye el inicio de caja, por eso el esperado
        // es: inicio + ventas en efectivo − gastos de caja
        const efectivoSistema = (resumen.porMetodo?.efectivo || 0) + parseFloat(turno.inicio_caja || 0) - gastosCaja;
        const tarjetasDeclaro = parseFloat(datos.total_tarjetas || 0);
        const tarjetasSistema = (resumen.porMetodo?.tarjeta || 0);
        const mpDeclaro = parseFloat(datos.total_mercadopago || 0);
        const mpSistema = (resumen.porMetodo?.mercadopago || 0);
        const transfDeclaro = parseFloat(datos.total_transferencias || 0);
        const transfSistema = (resumen.porMetodo?.transferencia || 0);

        const totalDeclaro = efectivoDeclaro + tarjetasDeclaro + mpDeclaro + transfDeclaro;
        const totalSistema = (resumen.totalVendido || 0) + parseFloat(turno.inicio_caja || 0) - gastosCaja;
        const diferencia = totalDeclaro - totalSistema;

        setResultadoCierre({
          totalDeclaro,
          totalSistema,
          diferencia,
          efectivo: { declaro: efectivoDeclaro, sistema: efectivoSistema, diff: efectivoDeclaro - efectivoSistema },
          tarjetas: { declaro: tarjetasDeclaro, sistema: tarjetasSistema, diff: tarjetasDeclaro - tarjetasSistema },
          mp: { declaro: mpDeclaro, sistema: mpSistema, diff: mpDeclaro - mpSistema },
          transf: { declaro: transfDeclaro, sistema: transfSistema, diff: transfDeclaro - transfSistema },
        });
      } else {
        onCerrado();
      }
    } catch (err) {
      alert('Error al cerrar caja');
    } finally { setCargando(false); }
  };

  // Datos para el gráfico de torta
  const datosGrafico = resumen ? [
    { name: 'Efectivo', value: resumen.porMetodo?.efectivo || 0, color: '#10B981' },
    { name: 'Tarjeta', value: resumen.porMetodo?.tarjeta || 0, color: '#3B82F6' },
    { name: 'Mercado Pago', value: resumen.porMetodo?.mercadopago || 0, color: '#8B5CF6' },
    { name: 'Transferencias', value: resumen.porMetodo?.transferencia || 0, color: '#F59E0B' }
  ].filter(item => item.value > 0) : [];

  // Pantalla de resultado
  if (resultadoCierre) {
    const ok = Math.abs(resultadoCierre.diferencia) < 1;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <div className="flex flex-col flex-1 min-h-0">
            <div className={`p-6 text-white text-center flex-shrink-0 ${ok ? 'bg-green-600' : 'bg-red-500'} rounded-t-3xl`}>
              <p className="text-5xl mb-3">{ok ? '✅' : '⚠️'}</p>
              <h3 className="text-2xl font-bold">{ok ? '¡Cierre perfecto!' : 'Hay diferencias'}</h3>
              <p className="text-white/80 mt-1 text-base">
                {ok ? 'Los valores coinciden exactamente' : 'Los valores no coinciden con el sistema'}
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-200">
                  <p className="text-sm text-gray-500 font-medium">Vos declaraste</p>
                  <p className="text-2xl font-bold text-gray-800 mt-2">{fmt(resultadoCierre.totalDeclaro)}</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-200">
                  <p className="text-sm text-gray-500 font-medium">Sistema registró</p>
                  <p className="text-2xl font-bold text-gray-800 mt-2">{fmt(resultadoCierre.totalSistema)}</p>
                </div>
              </div>

              {!ok && (
                <>
                  <div className={`rounded-2xl p-4 text-center border-2 ${resultadoCierre.diferencia > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-lg font-medium text-gray-600">Diferencia</p>
                    <p className={`text-3xl font-bold mt-2 ${resultadoCierre.diferencia > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {resultadoCierre.diferencia > 0 ? '+' : ''}{fmt(resultadoCierre.diferencia)}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      {resultadoCierre.diferencia > 0 ? '📈 Sobrante en caja' : '📉 Faltante en caja'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      ['💵 Efectivo', resultadoCierre.efectivo],
                      ['💳 Tarjetas', resultadoCierre.tarjetas],
                      ['📱 Mercado Pago', resultadoCierre.mp],
                      ['🏦 Transferencias', resultadoCierre.transf],
                    ].filter(([, vals]) => vals.diff !== 0).map(([label, vals]) => (
                      <div key={label} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                        <span className="text-gray-700 font-medium">{label}</span>
                        <div className="text-right">
                          <span className="text-gray-500 text-xs block">{fmt(vals.declaro)} declarado vs {fmt(vals.sistema)} sistema</span>
                          <span className={`text-lg font-bold ${vals.diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {vals.diff > 0 ? '+' : ''}{fmt(vals.diff)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 sm:p-6 bg-white border-t border-gray-200 flex-shrink-0">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <button
                  onClick={imprimirCierre}
                  className="w-full md:w-auto py-3 px-4 border border-gray-300 rounded-2xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  🖨️ Imprimir Cierre
                </button>
                <button onClick={onCerrado}
                  className={`w-full md:flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-lg transition-colors`}
                >
                  Finalizar Turno y Salir
                </button>
                <p className="text-xs text-gray-400 text-center md:hidden">Se cerrará tu sesión para que ingrese el próximo turno</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Modal Principal */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-red-600 to-red-500 text-white rounded-t-3xl flex-shrink-0">
            <div>
              <h3 className="text-2xl font-bold">🔒 Cierre de Caja</h3>
              <p className="text-red-100 text-sm">F12 · Finalizar turno y cuadrar caja</p>
            </div>
            <button onClick={onCerrar} className="text-white/80 hover:text-white text-3xl leading-none">×</button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto md:flex md:overflow-hidden">
            {/* Panel Izquierdo: Resumen del Turno */}
            <div className="w-full md:w-1/2 p-4 sm:p-6 md:border-r bg-gradient-to-br from-gray-50 to-white md:overflow-y-auto min-h-0">
              <div className="flex flex-col md:h-full">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  📊 Resumen del Turno
                  {infoRevelada && (
                    <button
                      onClick={() => setIngresosExpandido(!ingresosExpandido)}
                      className="text-sm text-gray-500 hover:text-gray-700 ml-auto"
                    >
                      {ingresosExpandido ? '▼' : '▶'} Detalles
                    </button>
                  )}
                </h4>

                {!infoRevelada ? (
                  <div className="md:flex-1 flex items-center justify-center md:py-0">
                    <div className="text-center w-full">
                      <div className="hidden md:block text-6xl mb-4">🔐</div>
                      <p className="hidden md:block text-gray-600 mb-4">Información protegida por PIN</p>
                      <button
                        onClick={() => setMostrarPinModal(true)}
                        className="w-full md:w-auto px-6 py-2.5 md:py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
                      >
                        🔓 Revelar Información
                      </button>
                    </div>
                  </div>
                ) : resumen ? (
                  <div className="flex-1 space-y-4">
                    {/* Totales principales */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <p className="text-sm text-gray-500">Total Ventas</p>
                        <p className="text-2xl font-bold text-green-600">{fmt(resumen.totalVendido)}</p>
                        <p className="text-xs text-gray-400">{resumen.totalVentas} transacciones</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <p className="text-sm text-gray-500">Total Ingresos</p>
                        <p className="text-2xl font-bold text-blue-600">{fmt(resumen.totalVendido)}</p>
                        <p className="text-xs text-gray-400">Dinero en caja</p>
                      </div>
                    </div>

                    {/* Gastos pagados con la caja: bajan el efectivo esperado */}
                    {parseFloat(resumen.gastosCaja || 0) > 0 && (
                      <div className="bg-red-50 rounded-xl p-3 border border-red-200 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-red-700">💸 Gastos pagados con la caja</p>
                          <p className="text-xs text-red-400">Se descuentan del efectivo esperado</p>
                        </div>
                        <p className="text-xl font-bold text-red-600">−{fmt(resumen.gastosCaja)}</p>
                      </div>
                    )}

                    {/* Detalles expandibles de ingresos */}
                    {ingresosExpandido && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <h5 className="font-medium text-gray-700 mb-3">💰 Desglose por Método de Pago</h5>
                        <div className="space-y-2">
                          {datosGrafico.map(item => (
                            <div key={item.name} className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">{item.name}</span>
                              <span className="font-medium">{fmt(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Gráfico de torta. Las etiquetas van en una leyenda DEBAJO
                        (no encima del gráfico) para que no se superpongan entre sí. */}
                    {datosGrafico.length > 0 && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200 flex-1">
                        <h5 className="font-medium text-gray-700 mb-3 text-center">📈 Distribución de Pagos</h5>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={datosGrafico}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={75}
                                dataKey="value"
                              >
                                {datosGrafico.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => fmt(value)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Leyenda en texto, debajo del gráfico */}
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {datosGrafico.map(item => {
                            const totalG = datosGrafico.reduce((a, x) => a + x.value, 0) || 1;
                            const pct = Math.round((item.value / totalG) * 100);
                            return (
                              <div key={item.name} className="flex items-center justify-between gap-2 min-w-0">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }}></span>
                                  <span className="text-xs text-gray-600 truncate">{item.name}</span>
                                </span>
                                <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="md:flex-1 flex items-center justify-center py-10 md:py-0">
                    <div className="text-center text-gray-500">
                      <div className="animate-spin text-4xl mb-2">⏳</div>
                      <p>Cargando resumen...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Derecho: Comprobantes y Validación */}
            <div className="w-full md:w-1/2 p-4 sm:p-6 flex flex-col md:overflow-y-auto min-h-0 border-t md:border-t-0">
              <h4 className="text-lg font-bold text-gray-800 mb-4">📄 Comprobantes Virtuales</h4>

              <div className="flex-1 space-y-4">
                {/* Arqueo de efectivo */}
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-gray-700">💵 Arqueo de Efectivo</h5>
                    <button
                      type="button"
                      onClick={() => setMostrarContarBilletes(true)}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Contar Billetes
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Efectivo a retirar *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                        <input
                          type="number"
                          value={datos.efectivo_retirado}
                          onChange={(e) => setDatos(p => ({ ...p, efectivo_retirado: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                          placeholder="0"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Para siguiente turno *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                        <input
                          type="number"
                          value={datos.dinero_siguiente}
                          onChange={(e) => setDatos(p => ({ ...p, dinero_siguiente: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                          placeholder="0"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comprobantes virtuales */}
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <h5 className="font-medium text-gray-700 mb-3">🧾 Comprobantes Virtuales *</h5>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-blue-700">💡 Ingresá los comprobantes de ventas/cobros recibidos por métodos virtuales</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['total_tarjetas', '💳 Tarjetas'],
                      ['total_mercadopago', '📱 Mercado Pago'],
                      ['total_transferencias', '🏦 Transferencias']
                    ].map(([key, label]) => (
                      <div key={key}>
                        <label className="block text-sm text-gray-600 mb-1">{label} *</label>
                        <div className="relative">
                          <span className="absolute left-2 top-2.5 text-gray-500">$</span>
                          <input
                            type="number"
                            value={datos[key]}
                            onChange={(e) => setDatos(p => ({ ...p, [key]: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg pl-6 pr-2 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                            placeholder="0"
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comentarios */}
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                  <h5 className="font-medium text-gray-700 mb-3">📝 Comentarios</h5>
                  <textarea
                    value={datos.comentarios}
                    onChange={(e) => setDatos(p => ({ ...p, comentarios: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder="Notas sobre el cierre (opcional)..."
                  />
                </div>

                {/* Validación y botones */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  {!camposCompletos() && (
                    <p className="text-sm text-amber-600 mb-3 text-center">
                      ⚠️ Completá todos los campos obligatorios para cerrar
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={onCerrar}
                      className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={cerrar}
                      disabled={cargando || !camposCompletos()}
                      className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cargando ? '🔄 Cerrando...' : '🔒 Confirmar Cierre'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de PIN */}
      {mostrarPinModal && (
        <ModalPinCierre
          onCerrar={() => setMostrarPinModal(false)}
          onConfirmar={(pin) => {
            setPinIngresado(pin);
            setMostrarPinModal(false);
            revelarInfo(pin);
          }}
          config={config}
        />
      )}

      {/* Modal de Contar Billetes */}
      {mostrarContarBilletes && (
        <ModalContarBilletes
          onCerrar={() => setMostrarContarBilletes(false)}
          onConfirmar={(total) => {
            setDatos(p => ({ ...p, efectivo_retirado: total.toString() }));
            setMostrarContarBilletes(false);
          }}
        />
      )}
    </>
  );
}
// =============================================
// MODAL: PIN PARA CIERRE
// =============================================
function ModalPinCierre({ onCerrar, onConfirmar, config }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [mostrarPin, setMostrarPin] = useState(false);

  const confirmar = () => {
    if (!pin.trim()) {
      setError('Ingresa el PIN');
      return;
    }

    if (config?.pin_cierre && pin !== String(config.pin_cierre)) {
      setError('PIN incorrecto');
      setTimeout(() => setError(''), 2000);
      return;
    }

    onConfirmar(pin);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      confirmar();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-red-600 to-red-500 text-white rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold">🔐 PIN de Cierre</h3>
            <p className="text-red-100 text-sm">Revelar información del sistema</p>
          </div>
          <button onClick={onCerrar} className="text-white/80 hover:text-white text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔓</span>
            </div>
            <p className="text-gray-600 text-sm mb-4">
              Ingresa el PIN configurado para ver el resumen del turno
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <p className="text-red-600 text-sm font-medium">❌ {error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
              PIN de Cierre
            </label>
            <div className="relative">
              <input
                type={mostrarPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-red-400"
                placeholder="••••"
                maxLength={6}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setMostrarPin(!mostrarPin)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {mostrarPin ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// =============================================
// MODAL: FIADOS
// =============================================
function ModalFiados({ onCerrar }) {
  const [modo, setModo] = useState('cobrar'); // 'cobrar' | 'deuda'
  const [buscar, setBuscar] = useState('');
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [formPago, setFormPago] = useState({ monto: '', metodo_pago: 'efectivo', nota: '' });
  const [cargando, setCargando] = useState(true);
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');

  const fmtLocal = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);

  useEffect(() => { cargarClientes(); /* eslint-disable-next-line */ }, [buscar, modo]);

  const cargarClientes = async () => {
    try {
      setCargando(true);
      const res = await api.get(`/api/clientes${buscar ? `?buscar=${buscar}` : ''}`);
      // Cobrar: solo los que tienen deuda. Agregar deuda: cualquier cliente.
      setClientes(modo === 'deuda' ? res.data : res.data.filter(c => parseFloat(c.saldo_deuda) > 0));
    } catch { } finally { setCargando(false); }
  };

  const cambiarModo = (m) => {
    setModo(m); setClienteSeleccionado(null); setError('');
    setFormPago({ monto: '', metodo_pago: 'efectivo', nota: '' });
  };

  const registrarPago = async (e) => {
    e.preventDefault();
    setError('');
    if (parseFloat(formPago.monto) > parseFloat(clienteSeleccionado.saldo_deuda)) {
      setError(`El monto no puede superar la deuda de ${fmtLocal(clienteSeleccionado.saldo_deuda)}`);
      return;
    }
    try {
      await api.post(`/api/clientes/${clienteSeleccionado.id}/pago`, formPago);
      setExito(`✅ Pago de ${fmtLocal(formPago.monto)} registrado para ${clienteSeleccionado.nombre}`);
      setClienteSeleccionado(null);
      setFormPago({ monto: '', metodo_pago: 'efectivo', nota: '' });
      cargarClientes();
      setTimeout(() => setExito(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Error al registrar pago'); }
  };

  const registrarDeuda = async (e) => {
    e.preventDefault();
    setError('');
    if (!(parseFloat(formPago.monto) > 0)) { setError('El monto debe ser mayor a 0'); return; }
    try {
      await api.post(`/api/clientes/${clienteSeleccionado.id}/deuda`, { monto: formPago.monto, nota: formPago.nota });
      setExito(`✅ Deuda de ${fmtLocal(formPago.monto)} cargada a ${clienteSeleccionado.nombre}`);
      setClienteSeleccionado(null);
      setFormPago({ monto: '', metodo_pago: 'efectivo', nota: '' });
      cargarClientes();
      setTimeout(() => setExito(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Error al cargar la deuda'); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b text-white rounded-t-2xl" style={{ backgroundColor: 'var(--color-primario)' }}>
          <div>
            <h3 className="text-lg font-bold">👥 Fiados</h3>
            <p className="text-white text-opacity-80 text-sm">F3 · {modo === 'deuda' ? 'Agregar deuda a un cliente' : 'Cobrar deudas'}</p>
          </div>
          <button onClick={onCerrar} className="text-white text-opacity-80 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl text-sm">{exito}</div>}
          {!clienteSeleccionado && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => cambiarModo('cobrar')}
                style={modo === 'cobrar' ? { backgroundColor: 'var(--color-primario)', borderColor: 'var(--color-primario)' } : {}}
                className={`py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${modo === 'cobrar' ? 'text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                💵 Cobrar deuda
              </button>
              <button type="button" onClick={() => cambiarModo('deuda')}
                style={modo === 'deuda' ? { backgroundColor: 'var(--color-primario)', borderColor: 'var(--color-primario)' } : {}}
                className={`py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${modo === 'deuda' ? 'text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                ➕ Agregar deuda
              </button>
            </div>
          )}
          {!clienteSeleccionado ? (
            <>
              <input type="text" value={buscar} onChange={(e) => setBuscar(e.target.value)} autoFocus
                onFocus={() => { scannerBuffer.current = ''; }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="🔍 Buscar por nombre o teléfono..." />
              {cargando ? (
                <p className="text-center text-gray-400 py-4">Cargando...</p>
              ) : clientes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-4xl mb-2">{modo === 'deuda' ? '🔍' : '✅'}</p>
                  <p className="font-medium">{modo === 'deuda' ? 'No se encontraron clientes' : 'No hay deudas pendientes'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clientes.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => { setClienteSeleccionado(c); setFormPago({ monto: '', metodo_pago: 'efectivo', nota: '' }); setError(''); }}
                      className="w-full bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-xl p-4 text-left transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: 'var(--color-primario)' }}>
                            {(c.nombre || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{c.nombre}</p>
                            <p className="text-xs text-gray-500">{c.telefono || 'Sin teléfono'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {parseFloat(c.saldo_deuda) > 0 ? (
                            <>
                              <p className="text-xs text-gray-400">DEBE</p>
                              <p className="font-bold text-red-500">{fmtLocal(c.saldo_deuda)}</p>
                            </>
                          ) : (
                            <p className="text-xs font-medium text-green-500">Sin deuda</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={modo === 'deuda' ? registrarDeuda : registrarPago} className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-primario)' }}>
                    {(clienteSeleccionado.nombre || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{clienteSeleccionado.nombre}</p>
                    <p className="text-sm text-red-500 font-medium">Debe: {fmtLocal(clienteSeleccionado.saldo_deuda)}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setClienteSeleccionado(null)}
                  className="text-gray-400 hover:text-gray-600 text-sm">← Volver</button>
              </div>
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm">❌ {error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{modo === 'deuda' ? 'Monto de la deuda *' : 'Monto a pagar *'}</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input type="number" value={formPago.monto} onChange={(e) => setFormPago(p => ({ ...p, monto: e.target.value }))}
                    required autoFocus min="0"
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-lg focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="0" />
                </div>
                {modo === 'cobrar' && parseFloat(clienteSeleccionado.saldo_deuda) > 0 && (
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => setFormPago(p => ({ ...p, monto: (parseFloat(clienteSeleccionado.saldo_deuda) / 2).toFixed(0) }))}
                      className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-colors">50% de la deuda</button>
                    <button type="button" onClick={() => setFormPago(p => ({ ...p, monto: clienteSeleccionado.saldo_deuda }))}
                      className="flex-1 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors">Pago Total</button>
                  </div>
                )}
              </div>
              {modo === 'cobrar' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ id: 'efectivo', label: '💵 Efectivo' }, { id: 'transferencia', label: '🏦 Transferencia' }, { id: 'mercadopago', label: '📱 Mercado Pago' }, { id: 'tarjeta', label: '💳 Tarjeta' }].map(m => (
                      <button key={m.id} type="button" onClick={() => setFormPago(p => ({ ...p, metodo_pago: m.id }))}
                        style={formPago.metodo_pago === m.id ? { backgroundColor: 'var(--color-primario)', borderColor: 'var(--color-primario)' } : {}}
                        className={`py-2 rounded-xl text-sm font-medium border-2 transition-colors ${formPago.metodo_pago === m.id ? 'text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{modo === 'deuda' ? 'Concepto / nota' : 'Nota (opcional)'}</label>
                <input type="text" value={formPago.nota} onChange={(e) => setFormPago(p => ({ ...p, nota: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder={modo === 'deuda' ? 'Ej: préstamo, artículo fuera de stock...' : 'Ej: Pago parcial...'} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setClienteSeleccionado(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit"
                  style={{ backgroundColor: 'var(--color-primario)' }}
                  className="flex-1 py-2.5 text-white rounded-xl font-bold transition-colors">{modo === 'deuda' ? '➕ Agregar deuda' : '✅ Confirmar Pago'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================
// COMPONENTE PRINCIPAL: POS
// =============================================
function SincronizacionExitosa({ ultimaSincronizacion }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [ultimaSincronizacion]);

  if (!visible) return null;

  return (
    <div className="bg-green-600 text-white px-4 py-2 flex items-center gap-2 text-sm flex-shrink-0">
      <span>✅</span>
      <span className="font-semibold">Ventas sincronizadas correctamente</span>
      <span className="text-green-200">
        a las {ultimaSincronizacion.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

function POS() {
  const navigate = useNavigate();
  const { logout, usuario } = useAuth();
  const { online, sincronizando, pendientes, ultimaSincronizacion, agregarVentaOffline, buscarEnCatalogo, buscarCodigoEnCatalogo } = useConectividad();
  const modalVentaRef = useRef(null);
  const [turno, setTurno] = useState(null);
  const [cajasAbiertas, setCajasAbiertas] = useState([]);
  const [cajasFijas, setCajasFijas] = useState([]);
  const [cargandoTurno, setCargandoTurno] = useState(true);
  const [config, setConfig] = useState(null);
  // Reloj para chequear el fin del día comercial (alerta / cierre forzado).
  const [ahora, setAhora] = useState(() => Date.now());
  // Efectivo que dejó la última caja cerrada del día, para precargar la próxima.
  const [sugerenciaInicio, setSugerenciaInicio] = useState(0);
  const [productos, setProductos] = useState([]);
  const [buscar, setBuscar] = useState('');
  // 'relevancia' respeta el orden del servidor: lo que EMPIEZA con lo buscado primero
  const [ordenar, setOrdenar] = useState('relevancia');
  const [mostrarModalGasto, setMostrarModalGasto] = useState(false);
  const [menuMobilAbierto, setMenuMobilAbierto] = useState(false);
  const [mostrarModalFiados, setMostrarModalFiados] = useState(false);
  const [mostrarModalVenta, setMostrarModalVenta] = useState(false);
  const [mostrarModalCierre, setMostrarModalCierre] = useState(false);
  const [mostrarModalRapida, setMostrarModalRapida] = useState(false);
  const [mostrarModalProductoRapido, setMostrarModalProductoRapido] = useState(false);
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
  const [ventaExitosa, setVentaExitosa] = useState(false);
  const [mensajeScanner, setMensajeScanner] = useState(null);
  const [ultimaVenta, setUltimaVenta] = useState(null);
  const [mostrarModalVentaProducto, setMostrarModalVentaProducto] = useState(null);
  const [totalUltimaVenta, setTotalUltimaVenta] = useState(0);
  const [editandoCantidad, setEditandoCantidad] = useState(null);
  // En celular se alterna entre el buscador de productos y el carrito
  const [vistaMobil, setVistaMobil] = useState('productos');
  // Preferencia local de modo oscuro/claro para el POS (por dispositivo, no pisa la config del negocio)
  const [modoOscuroLocal, setModoOscuroLocal] = useState(() => {
    const v = localStorage.getItem('pos_modo_oscuro');
    return v === null ? null : v === 'true';
  });
  // Los ajustes de precio del carrito (descuento, recargo, redondeo) se guardan
  // DENTRO de cada pestaña, para que cada venta en espera tenga los suyos y no se
  // pisen al cambiar de pestaña. Los getters/setters están más abajo (necesitan
  // `pestanas` y `pestanaActiva` ya declarados).
  // Producto del carrito que tiene abierto su panelcito de ajustes (descuento /
  // recargo / redondeo por producto individual). null = ninguno abierto.
  const [ajusteItemAbierto, setAjusteItemAbierto] = useState(null);

  // Estados para facturación electrónica (se resetean por venta)
  const [facturacionElectronica, setFacturacionElectronica] = useState(false);
  const [tipoComprobante, setTipoComprobante] = useState(0);
  const [tipoDocumento, setTipoDocumento] = useState(99);
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [denominacionComprador, setDenominacionComprador] = useState('');
  // Condición IVA del receptor (RG 5616): 0 = automático según tipo de doc/comprobante
  const [condicionIvaReceptor, setCondicionIvaReceptor] = useState(0);
 const [tiposComprobante, setTiposComprobante] = useState([]);
  const [ultimoComprobante, setUltimoComprobante] = useState(null);
  const [mostrarComprobanteElectronico, setMostrarComprobanteElectronico] = useState(false);

  const [pestanas, setPestanas] = useState(() => {
    // Carga las pestañas guardadas VALIDANDO su estructura. Datos viejos o
    // corruptos en localStorage eran causa de pantalla en blanco en el POS.
    const porDefecto = [{ id: 1, nombre: 'Venta 1', carrito: [] }];
    try {
      const g = localStorage.getItem('pos_pestanas');
      if (!g) return porDefecto;
      const parseado = JSON.parse(g);
      if (!Array.isArray(parseado) || parseado.length === 0) return porDefecto;

      const sanas = parseado
        .filter(p => p && typeof p === 'object' && p.id != null)
        .map(p => ({
          id: p.id,
          nombre: typeof p.nombre === 'string' ? p.nombre : 'Venta',
          carrito: Array.isArray(p.carrito)
            ? p.carrito.filter(item =>
                item && typeof item === 'object' &&
                typeof item.nombre_producto === 'string' &&
                !isNaN(parseFloat(item.precio_unitario)) &&
                !isNaN(parseFloat(item.cantidad)) &&
                !isNaN(parseFloat(item.subtotal))
              )
            : [],
          // Conservar los ajustes de precio propios de la venta (por pestaña)
          descuentoActivo: !!p.descuentoActivo,
          recargoActivo: !!p.recargoActivo,
          redondeoVenta: parseFloat(p.redondeoVenta) || 0,
          descuentoPctManual: typeof p.descuentoPctManual === 'string' ? p.descuentoPctManual : '',
        }));

      return sanas.length > 0 ? sanas : porDefecto;
    } catch {
      return porDefecto;
    }
  });
  const [pestanaActiva, setPestanaActiva] = useState(() => {
    try { const a = localStorage.getItem('pos_pestana_activa'); return a ? parseInt(a) : 1; }
    catch { return 1; }
  });
  const [contadorVentas, setContadorVentas] = useState(() => {
    try { const c = localStorage.getItem('pos_contador_ventas'); return c ? parseInt(c) : 1; }
    catch { return 1; }
  });

  const inputBuscarRef = useRef(null);
  const scannerBuffer = useRef('');
  const scannerTimer = useRef(null);
  // Mientras se confirma/registra una venta, bloqueamos el auto-agregar del buscador
  // y del escáner para que un resultado tardío no "reviva" el carrito recién vaciado.
  const ventaEnCursoRef = useRef(false);
  const pestanaActivaObj = pestanas.find(p => p.id === pestanaActiva);
  const carritoActivo = pestanaActivaObj?.carrito || [];

  // Ajustes de precio de la pestaña activa (descuento / recargo / redondeo). Se
  // leen de la pestaña, así cada venta en espera conserva los suyos. Los setters
  // aceptan un valor o una función (v => ...) como los de useState.
  const descuentoActivo = !!pestanaActivaObj?.descuentoActivo;
  const recargoActivo = !!pestanaActivaObj?.recargoActivo;
  const redondeoVenta = pestanaActivaObj?.redondeoVenta || 0;
  const descuentoPctManual = pestanaActivaObj?.descuentoPctManual ?? '';
  const setCampoPestanaActiva = (campo, valorOrFn, porDefecto) => {
    setPestanas(prev => prev.map(p => {
      if (p.id !== pestanaActiva) return p;
      const actual = p[campo] ?? porDefecto;
      const nuevo = typeof valorOrFn === 'function' ? valorOrFn(actual) : valorOrFn;
      return { ...p, [campo]: nuevo };
    }));
  };
  const setDescuentoActivo = (v) => setCampoPestanaActiva('descuentoActivo', v, false);
  const setRecargoActivo = (v) => setCampoPestanaActiva('recargoActivo', v, false);
  const setRedondeoVenta = (v) => setCampoPestanaActiva('redondeoVenta', v, 0);
  const setDescuentoPctManual = (v) => setCampoPestanaActiva('descuentoPctManual', v, '');

  // Función para resetear estados de facturación electrónica
  // El botón "atrás" del celular cierra el modal abierto en vez de salir del POS
  useCerrarConAtras(mostrarModalVenta, () => { setMostrarModalVenta(false); resetearFacturacion(false); });
  useCerrarConAtras(mostrarModalGasto, () => setMostrarModalGasto(false));
  useCerrarConAtras(mostrarModalCierre, () => setMostrarModalCierre(false));
  useCerrarConAtras(mostrarModalRapida, () => setMostrarModalRapida(false));
  useCerrarConAtras(mostrarModalProductoRapido, () => setMostrarModalProductoRapido(false));
  useCerrarConAtras(mostrarModalFiados, () => setMostrarModalFiados(false));
  useCerrarConAtras(mostrarModalHistorial, () => setMostrarModalHistorial(false));
  useCerrarConAtras(!!mostrarModalVentaProducto, () => setMostrarModalVentaProducto(null));
  // OJO: el modal de "Venta Exitosa" NO usa useCerrarConAtras a propósito. Al confirmar,
  // el modal de cobro se cierra y su cleanup hace history.back(), que dispara un popstate;
  // si el modal de éxito tuviera su listener recién montado, ese popstate lo cerraría al
  // instante (no llegaba a verse). Se cierra con "Seguir vendiendo" / ✕ / imprimir.

  const resetearFacturacion = (mantenerComprobante = false) => {
    setFacturacionElectronica(false);
    setTipoComprobante('');
    setTipoDocumento(99);
    setNumeroDocumento('');
    setDenominacionComprador('');
    setCondicionIvaReceptor(0);
    setTiposComprobante([]);
    if (!mantenerComprobante) setUltimoComprobante(null);
  };

  useEffect(() => { verificarTurno(); cargarConfig(); }, []);

  // Reloj: se refresca cada 30s para evaluar el fin del día comercial.
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Cachear el turno en localStorage para sobrevivir recargas SIN internet (así la
  // caja no se "cierra" sola al refrescar offline). Se limpia cuando no hay turno.
  useEffect(() => {
    if (turno) localStorage.setItem('pos_turno', JSON.stringify(turno));
    else localStorage.removeItem('pos_turno');
  }, [turno]);
  // Guardar pestañas con throttle — máximo una vez cada 2 segundos
  // para no trabar el POS con localStorage en cada keystroke
 // Guardar pestañas con throttle — máximo una vez cada 2 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('pos_pestanas', JSON.stringify(pestanas));
    }, 2000);
    return () => clearTimeout(timer);
  }, [pestanas]);

  useEffect(() => {
    localStorage.setItem('pos_pestana_activa', pestanaActiva.toString());
  }, [pestanaActiva]);

  // Los ajustes de precio (descuento / recargo / redondeo) se guardan DENTRO de
  // cada pestaña, así que al cambiar de venta se muestran los de esa venta y NO
  // hay que resetear nada al cambiar de pestaña.

  useEffect(() => {
    localStorage.setItem('pos_contador_ventas', contadorVentas.toString());
  }, [contadorVentas]);

useEffect(() => {
    if (buscar.trim().length === 0) {
      setProductos([]);
      return;
    }

    const terminoBuscado = buscar.trim();

    const timer = setTimeout(async () => {
      // Solo auto-agregamos si el término sigue vigente Y no hay una venta en curso/
      // recién confirmada (si no, un resultado tardío "revive" el carrito ya vaciado).
      const puedeAutoAgregar = (n) => n === 1 && !ventaEnCursoRef.current;
      // Sin internet: buscar en el catálogo cacheado localmente
      if (!online) {
        const resultados = buscarEnCatalogo(terminoBuscado);
        if (terminoBuscado === buscar.trim()) {
          setProductos(resultados);
          if (puedeAutoAgregar(resultados.length)) agregarAlCarrito(resultados[0]);
        }
        return;
      }
      try {
        const res = await api.get(`/api/productos?buscar=${encodeURIComponent(terminoBuscado)}&rapida=1`);
        // Solo actualizar si el término no cambió mientras esperábamos la respuesta
        if (terminoBuscado === buscar.trim()) {
          const resultados = res.data;
          setProductos(resultados);
          if (puedeAutoAgregar(resultados.length)) agregarAlCarrito(resultados[0]);
        }
      } catch { }
    }, 400);

    return () => clearTimeout(timer);
  }, [buscar]);

  // Mantener el flag "venta en curso" mientras está abierto el modal de confirmar
  // venta o el de "venta exitosa". Al cerrarse ambos (cancelar / seguir vendiendo),
  // se libera el auto-agregar del buscador.
  useEffect(() => {
    ventaEnCursoRef.current = mostrarModalVenta || ventaExitosa;
  }, [mostrarModalVenta, ventaExitosa]);

    

  // ---- ATAJOS DE TECLADO ----
  useEffect(() => {
    const hayModalAbierto = mostrarModalVenta || mostrarModalGasto || mostrarModalCierre || mostrarModalRapida || mostrarModalFiados || mostrarModalHistorial;

    const manejarTeclado = (e) => {
      // Teclas F - siempre activas aunque haya modal
      if (e.key === 'F1') {
        e.preventDefault();
        if (config?.permite_venta_rapida !== false) setMostrarModalRapida(true);
        else alert('🔒 Función desactivada por el administrador.\n\nLa venta rápida se puede activar desde Configuración.');
        return;
      }
      if (e.key === 'F2') { e.preventDefault(); inputBuscarRef.current?.focus(); return; }
      if (e.key === 'F3') { e.preventDefault(); setMostrarModalFiados(true); return; }
      if (e.key === 'F4') { e.preventDefault(); setMostrarModalCierre(true); return; }
      if (e.key === 'F5') { e.preventDefault(); setMostrarModalHistorial(true); return; }
      if (e.key === 'F7') { e.preventDefault(); setMostrarModalProductoRapido(true); return; }
      if (e.key === 'F8') {
        e.preventDefault();
        if (ventaExitosa) {
          // Cierra el modal de "Venta Exitosa" con F8 (= "Seguir vendiendo"),
          // así el usuario no necesita el mouse para arrancar la próxima venta.
          setVentaExitosa(false);
        } else if (mostrarModalVenta && modalVentaRef.current) {
          modalVentaRef.current.confirmar();
        } else if (carritoActivo.length > 0) {
          abrirConfirmarVenta();
        }
        return;
      }
      if (e.key === 'F9') { e.preventDefault(); if (window.confirm('¿Limpiar carrito?')) limpiarCarrito(); return; }
      if (e.key === 'F10') { e.preventDefault(); setMostrarModalGasto(true); return; }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (mostrarModalVenta) setMostrarModalVenta(false);
        else if (mostrarModalGasto) setMostrarModalGasto(false);
        else if (mostrarModalCierre) setMostrarModalCierre(false);
        else if (mostrarModalRapida) setMostrarModalRapida(false);
        else if (mostrarModalFiados) setMostrarModalFiados(false);
        else if (mostrarModalHistorial) setMostrarModalHistorial(false);
        return;
      }

      // Scanner - solo si no hay modal
      if (hayModalAbierto) return;
      if (document.activeElement === inputBuscarRef.current) return;
      if (e.key === 'Enter') {
        const codigo = scannerBuffer.current.trim();
        scannerBuffer.current = '';
        if (scannerTimer.current) clearTimeout(scannerTimer.current);
        if (codigo.length > 2) buscarPorCodigoScanner(codigo);
      } else if (e.key.length === 1) {
        scannerBuffer.current += e.key;
        if (scannerTimer.current) clearTimeout(scannerTimer.current);
        scannerTimer.current = setTimeout(() => { scannerBuffer.current = ''; }, 100);
      }
    };

    window.addEventListener('keydown', manejarTeclado);
    return () => window.removeEventListener('keydown', manejarTeclado);
  }, [mostrarModalVenta, mostrarModalGasto, mostrarModalCierre, mostrarModalRapida, mostrarModalFiados, mostrarModalHistorial, ventaExitosa, pestanaActiva, pestanas, carritoActivo, config]);

 const buscarPorCodigoScanner = async (codigo) => {
    // Sin internet: buscar el código en el catálogo cacheado
    if (!online) {
      const prod = buscarCodigoEnCatalogo(codigo);
      if (!prod) {
        setMensajeScanner({ tipo: 'error', texto: `❌ No encontrado: ${codigo}` });
        setTimeout(() => setMensajeScanner(null), 2500);
        inputBuscarRef.current?.focus();
        return;
      }
      agregarAlCarrito(prod);
      setMensajeScanner({ tipo: 'ok', texto: `✅ ${prod.nombre}` });
      setBuscar('');
      setProductos([]);
      setTimeout(() => setMensajeScanner(null), 2000);
      inputBuscarRef.current?.focus();
      return;
    }
    try {
      const res = await api.get(`/api/productos/buscar-codigo/${encodeURIComponent(codigo)}`);

      if (!res.data.encontrado || !res.data.producto) {
        setMensajeScanner({ tipo: 'error', texto: `❌ No encontrado: ${codigo}` });
        setTimeout(() => setMensajeScanner(null), 2500);
        inputBuscarRef.current?.focus();
        return;
      }

      agregarAlCarrito(res.data.producto);
      setMensajeScanner({ tipo: 'ok', texto: `✅ ${res.data.producto.nombre}` });
      setBuscar('');
      setProductos([]);
      setTimeout(() => setMensajeScanner(null), 2000);
      inputBuscarRef.current?.focus();
    } catch {
      setMensajeScanner({ tipo: 'error', texto: '❌ Error al buscar' });
      setTimeout(() => setMensajeScanner(null), 2500);
    }
  };

  const verificarTurno = async () => {
    try {
      const res = await api.get('/api/turnos/actual');
      setTurno(res.data);
      if (!res.data) {
        const [resCajas, resFijas, resUltimo] = await Promise.all([
          api.get('/api/turnos/abiertas'),
          api.get('/api/turnos/cajas-fijas').catch(() => ({ data: [] })),
          api.get('/api/turnos/ultimo-cierre').catch(() => ({ data: { dinero_siguiente: 0 } })),
        ]);
        setCajasAbiertas(resCajas.data);
        setCajasFijas(resFijas.data);
        setSugerenciaInicio(parseFloat(resUltimo.data?.dinero_siguiente) || 0);
      }
    } catch (err) {
      // Sin internet (error de red, sin response): restauramos el turno cacheado para
      // que una recarga offline NO cierre la caja. Online con error real: se ignora.
      if (!err?.response) {
        try {
          const cache = localStorage.getItem('pos_turno');
          if (cache) setTurno(JSON.parse(cache));
        } catch { /* caché inválido */ }
      }
    } finally { setCargandoTurno(false); }
  };

  const cargarConfig = async () => {
    try { const res = await api.get('/api/configuracion'); setConfig(res.data); } catch { }
  };

  const cargarProductos = async () => {
    try { const res = await api.get(`/api/productos?buscar=${encodeURIComponent(buscar)}&rapida=1`); setProductos(res.data); } catch { }
  };

  const productosOrdenados = ordenar === 'relevancia'
    ? productos // orden del servidor: prefijo primero ("leche" → "Leche..." antes que "...dulce de leche")
    : [...productos].sort((a, b) => {
        if (ordenar === 'precio_asc') return a.precio_venta - b.precio_venta;
        if (ordenar === 'precio_desc') return b.precio_venta - a.precio_venta;
        return a.nombre.localeCompare(b.nombre, 'es');
      });

  const agregarPestana = () => {
    const nuevaId = Date.now();
    setPestanas(prev => [...prev, { id: nuevaId, nombre: 'Nueva venta', carrito: [] }]);
    setPestanaActiva(nuevaId);
    setTimeout(() => inputBuscarRef.current?.focus(), 50);
  };

  const cerrarPestana = (id, e) => {
    e.stopPropagation();
    if (pestanas.length === 1) return;
    const nuevas = pestanas.filter(p => p.id !== id);
    setPestanas(nuevas);
    if (pestanaActiva === id) setPestanaActiva(nuevas[nuevas.length - 1].id);
    setTimeout(() => inputBuscarRef.current?.focus(), 50);
  };

  const actualizarCarritoPestana = (nuevoCarrito) => {
    setPestanas(prev => prev.map(p => p.id === pestanaActiva ? { ...p, carrito: nuevoCarrito } : p));
  };

  /**
   * Agrega un producto al carrito de la pestaña activa
   * Si el producto ya existe, incrementa la cantidad
   * Si el producto no es de unidad (Kg, Lt, Mt), abre el modal para vender por peso/cantidad
   * @param {Object} producto - Producto a agregar
   */
  // Devuelve el precio unitario según la cantidad: aplica precio mayorista si está
  // habilitado en Configuración y la cantidad alcanza el mínimo configurado.
  const precioSegunCantidad = (precioBase, precioMayorista, cantidad) => {
    const minimo = parseInt(config?.cantidad_minima_mayorista) || 5;
    if (config?.permite_precio_mayorista && precioMayorista > 0 && cantidad >= minimo) {
      return precioMayorista;
    }
    return precioBase;
  };

  // Recalcula el ajuste de precio de un producto del carrito a partir de su base
  // (cantidad × precio) y de sus dos ajustes independientes:
  //   - pctTipo: 'descuento' | 'recargo' | null  (porcentaje configurado)
  //   - redondeoDir: 'arriba' | 'abajo' | null   (redondeo, se apila ENCIMA)
  // Devuelve el item con `ajuste` (monto con signo) y `subtotal` ya calculados.
  // Al recalcularlo cada vez que cambia la cantidad, los ajustes siguen el precio.
  const recomputarAjusteItem = (item) => {
    const base = item.cantidad * item.precio_unitario;
    let ajuste = 0;
    if (item.pctTipo === 'descuento') {
      ajuste += -Math.round(base * (parseFloat(config?.descuento_maximo) || 0) / 100);
    } else if (item.pctTipo === 'recargo') {
      ajuste += Math.round(base * (parseFloat(config?.recargo_general) || 0) / 100);
    }
    if (item.redondeoDir) {
      const mult = parseInt(config?.redondeo_precios) || 0;
      if (mult > 0) {
        const previo = base + ajuste; // redondea sobre el subtotal ya con descuento/recargo
        const objetivo = item.redondeoDir === 'arriba'
          ? Math.ceil(previo / mult) * mult
          : Math.floor(previo / mult) * mult;
        ajuste += objetivo - previo;
      }
    }
    return { ...item, ajuste, subtotal: base + ajuste };
  };

  const agregarAlCarrito = useCallback((producto) => {
    // Verificar si el producto no es de unidad (es decir, tiene unidad kg, lt, mt)
    const unidadesNoUnitarias = ['kg', 'lt', 'mt'];
    const esUnidadNoUnitaria = unidadesNoUnitarias.includes((producto.unidad || '').toLowerCase());

    if (esUnidadNoUnitaria) {
      // Abrir el modal para vender por peso/cantidad
      setMostrarModalVentaProducto(producto);
      return;
    }

    // Lógica normal para productos de unidad
    setPestanas(prev => prev.map(p => {
      if (p.id !== pestanaActiva) return p;
      const precioBase = parseFloat(producto.precio_venta);
      const precioMayorista = parseFloat(producto.precio_mayorista) || 0;
      const existe = p.carrito.find(item => item.producto_id === producto.id);

      if (existe) {
        // Incrementar cantidad del producto existente (recalculando precio por mayorista si aplica)
        return {
          ...p,
          carrito: p.carrito.map(item => {
            if (item.producto_id !== producto.id) return item;
            const nuevaCant = item.cantidad + 1;
            const precio = precioSegunCantidad(item.precio_base ?? item.precio_unitario, item.precio_mayorista_prod ?? precioMayorista, nuevaCant);
            return recomputarAjusteItem({ ...item, cantidad: nuevaCant, precio_unitario: precio });
          })
        };
      }

      // Agregar nuevo producto al carrito
      const precioInicial = precioSegunCantidad(precioBase, precioMayorista, 1);
      return {
        ...p,
        carrito: [
          ...p.carrito,
          {
            producto_id: producto.id,
            nombre_producto: producto.nombre,
            precio_base: precioBase,
            precio_mayorista_prod: precioMayorista,
            precio_unitario: precioInicial,
            cantidad: 1,
            subtotal: precioInicial,
            ajuste: 0,
            pctTipo: null,
            redondeoDir: null
          }
        ]
      };
    }));

    // Limpiar búsqueda y enfocar input
    setBuscar('');
    setProductos([]);
    setTimeout(() => inputBuscarRef.current?.focus(), 50);
  }, [pestanaActiva, config]);

  const agregarVentaRapida = (item) => {
    setPestanas(prev => prev.map(p => p.id === pestanaActiva ? { ...p, carrito: [...p.carrito, item] } : p));
  };

  /**
   * Cambia la cantidad de un producto en el carrito
   * Si la cantidad es 0 o menor, elimina el producto del carrito
   * @param {string|number} productoId - ID del producto
   * @param {number} nuevaCantidad - Nueva cantidad del producto
   */
  const cambiarCantidad = (productoId, nuevaCantidad) => {
    // Update FUNCIONAL: calculamos desde `prev` (no desde el snapshot del render) para
    // no pisar estado nuevo con uno viejo si dos cambios ocurren casi a la vez.
    setPestanas(prev => prev.map(p => {
      if (p.id !== pestanaActiva) return p;
      if (nuevaCantidad <= 0) {
        return { ...p, carrito: p.carrito.filter(item => item.producto_id !== productoId) };
      }
      return {
        ...p,
        carrito: p.carrito.map(item => {
          if (item.producto_id !== productoId) return item;
          const precio = precioSegunCantidad(item.precio_base ?? item.precio_unitario, item.precio_mayorista_prod ?? 0, nuevaCantidad);
          // Recalculamos el ajuste manual del producto (descuento/recargo/redondeo)
          // con la nueva cantidad, para que siga el precio actual.
          return recomputarAjusteItem({ ...item, cantidad: nuevaCantidad, precio_unitario: precio });
        })
      };
    }));
  };

  /**
   * Elimina un producto del carrito
   * @param {string|number} productoId - ID del producto a eliminar
   */
  const eliminarDelCarrito = (productoId) => {
    setPestanas(prev => prev.map(p => p.id === pestanaActiva
      ? { ...p, carrito: p.carrito.filter(item => item.producto_id !== productoId) }
      : p));
  };

  /**
   * Aplica un ajuste de precio a UN producto del carrito (no a toda la venta).
   * El ajuste es un monto (con signo) que se guarda en el item y se suma a su
   * subtotal; así se refleja solo, sin tocar el backend.
   * @param {string|number} productoId
   * @param {'descuento'|'recargo'|'redondeo'|'quitar'} tipo
   * @param {'arriba'|'abajo'} [direccion] solo para redondeo
   */
  const aplicarAjusteItem = (productoId, tipo, direccion) => {
    setPestanas(prev => prev.map(p => {
      if (p.id !== pestanaActiva) return p;
      return {
        ...p,
        carrito: p.carrito.map(item => {
          if (item.producto_id !== productoId) return item;
          let nuevo = { ...item };
          if (tipo === 'quitar') {
            nuevo.pctTipo = null;
            nuevo.redondeoDir = null;
          } else if (tipo === 'descuento' || tipo === 'recargo') {
            // Descuento y recargo son excluyentes entre sí. Volver a tocar el
            // mismo lo saca (toggle). El redondeo se mantiene, se apila encima.
            nuevo.pctTipo = item.pctTipo === tipo ? null : tipo;
          } else if (tipo === 'redondeo') {
            // Tocar la misma dirección de redondeo la saca (toggle).
            nuevo.redondeoDir = item.redondeoDir === direccion ? null : direccion;
          }
          return recomputarAjusteItem(nuevo);
        }),
      };
    }));
  };

  /**
   * Limpia completamente el carrito de la pestaña activa
   */
  // Resetea los ajustes de precio (al limpiar, confirmar o vaciar el carrito)
  const resetearAjustes = () => {
    setDescuentoActivo(false);
    setRecargoActivo(false);
    setDescuentoPctManual('');
    setRedondeoVenta(0);
    setAjusteItemAbierto(null);
  };

  const limpiarCarrito = () => {
    actualizarCarritoPestana([]);
    resetearAjustes();
  };

  // Abre el modal de confirmar venta cortando cualquier búsqueda/escaneo pendiente,
  // para que un resultado tardío no agregue productos al carrito durante/después de la venta.
  const abrirConfirmarVenta = () => {
    if (carritoActivo.length === 0) return;
    ventaEnCursoRef.current = true;
    setBuscar('');
    setProductos([]);
    if (scannerTimer.current) clearTimeout(scannerTimer.current);
    scannerBuffer.current = '';
    setMostrarModalVenta(true);
  };

  // ---- CÁLCULO DEL TOTAL CON AJUSTES (descuento / recargo / redondeo) ----
  const totalBruto = carritoActivo.reduce((acc, item) => acc + item.subtotal, 0);
  const pctDescuento = parseFloat(config?.descuento_maximo) || 0;
  const pctRecargo = parseFloat(config?.recargo_general) || 0;
  const multiploRedondeo = parseInt(config?.redondeo_precios) || 0;

  // Modo del descuento manual: "editable" deja que el cajero tipee el % (con tope =
  // descuento_maximo); "fijo" aplica directo ese %.
  const descEditable = config?.descuento_modo === 'editable';
  const pctDescManual = Math.min(Math.max(parseFloat(descuentoPctManual) || 0, 0), pctDescuento);
  const pctDescAplicado = descEditable ? pctDescManual : pctDescuento;
  const descAplicado = descEditable ? pctDescManual > 0 : descuentoActivo;

  const montoDescuento = descAplicado ? Math.round(totalBruto * pctDescAplicado / 100) : 0;
  const montoRecargo = recargoActivo ? Math.round(totalBruto * pctRecargo / 100) : 0;
  const totalSinRedondeo = totalBruto - montoDescuento + montoRecargo;
  const total = totalSinRedondeo + redondeoVenta;

  const aplicarRedondeoVenta = (direccion) => {
    if (!multiploRedondeo) return;
    const base = totalSinRedondeo;
    const ajuste = direccion === 'arriba'
      ? Math.ceil(base / multiploRedondeo) * multiploRedondeo - base
      : Math.floor(base / multiploRedondeo) * multiploRedondeo - base;
    setRedondeoVenta(ajuste);
  };

  const confirmarVenta = async ({ metodoPago, descuento, recargo, totalFinal, clienteId, esFiado, montoEfectivo, montoVirtual, metodoVirtual, facturarTodo }) => {
    // Crear una sola venta unificada con todos los items (rápidos + stock)
    const todosLosItems = carritoActivo.map(item => ({
      producto_id: item.esRapida ? null : item.producto_id,
      nombre_producto: item.nombre_producto,
      cantidad: parseFloat(item.cantidad),
      precio_unitario: parseFloat(item.precio_unitario),
      subtotal: parseFloat(item.subtotal)
    }));

    if (todosLosItems.length === 0) return;

    const ventaPayload = {
      turno_id: turno?.id,
      items: todosLosItems,
      metodo_pago: metodoPago,
      descuento: parseFloat(descuento) || 0,
      recargo: parseFloat(recargo) || 0,
      total: parseFloat(totalFinal),
      cliente_id: clienteId || null,
      es_fiado: esFiado || false,
      tipo_facturacion: facturacionElectronica ? 'electronica' : 'x',
      monto_efectivo: metodoPago === 'dividido' ? (parseFloat(montoEfectivo) || 0) : null,
      monto_virtual: metodoPago === 'dividido' ? (parseFloat(montoVirtual) || 0) : null,
      metodo_virtual: metodoPago === 'dividido' ? (metodoVirtual || 'transferencia') : null,
    };

    // En pago dividido se factura solo la parte virtual (salvo "Facturar todo")
    const importeFactura = (metodoPago === 'dividido' && !facturarTodo)
      ? (parseFloat(montoVirtual) || 0)
      : parseFloat(totalFinal);

    // Datos de la factura electrónica (sin venta_id). Se reutilizan online y, si
    // la venta se hace offline, se guardan para emitir el comprobante al reconectar.
    const datosFactura = facturacionElectronica ? {
      tipo_comprobante: tipoComprobante,
      punto_venta: config?.punto_venta_arca || 1,
      tipo_documento: tipoDocumento,
      numero_documento: numeroDocumento || null,
      denominacion_comprador: denominacionComprador || null,
      // Condición IVA receptor (RG 5616): A → RI; CUIT → lo elegido (def. monotributo); resto → consumidor final
      condicion_iva_receptor: [1, 2, 3].includes(tipoComprobante) ? 1
        : (tipoDocumento === 80 ? (condicionIvaReceptor || 6) : 5),
      importe_total: importeFactura,
      // Factura C (monotributista): IVA = 0, neto = total · Factura A/B (RI): IVA 21%
      importe_neto: (tipoComprobante === 11 || tipoComprobante === 13 || tipoComprobante === 12)
        ? importeFactura
        : parseFloat((importeFactura / 1.21).toFixed(2)),
      importe_iva: (tipoComprobante === 11 || tipoComprobante === 13 || tipoComprobante === 12)
        ? 0
        : parseFloat((importeFactura - importeFactura / 1.21).toFixed(2)),
    } : null;

    // ---- MODO OFFLINE ----
    if (!online) {
      agregarVentaOffline({ ...ventaPayload, facturacion: datosFactura });

      // Limpiar carrito y mostrar éxito igual que online
      const nuevoNumero = contadorVentas + 1;
      setContadorVentas(nuevoNumero);
      setPestanas(prev => prev.map(p =>
        p.id === pestanaActiva ? { ...p, nombre: `Venta ${nuevoNumero}`, carrito: [] } : p
      ));
      setMostrarModalVenta(false);
      setTotalUltimaVenta(totalFinal);
      setUltimaVenta(null); // No hay ID real todavía, el ticket no se puede reimprimir
      setVentaExitosa(true);
      resetearAjustes();
      inputBuscarRef.current?.focus();
      return;
    }

    // ---- MODO ONLINE (comportamiento normal) ----
    try {
      const resVenta = await api.post('/api/ventas', ventaPayload);

      // Vaciar el carrito YA, apenas la venta quedó registrada, sin esperar a la
      // facturación/ticket (que pueden tardar varios segundos). El modal de confirmar
      // sigue abierto hasta el final, así el flag de "venta en curso" mantiene
      // bloqueado el auto-agregar y el carrito no se "revive".
      const nuevoNumero = contadorVentas + 1;
      setContadorVentas(nuevoNumero);
      setPestanas(prev => prev.map(p =>
        p.id === pestanaActiva ? { ...p, nombre: `Venta ${nuevoNumero}`, carrito: [] } : p
      ));
      resetearAjustes();

      // Si es facturación electrónica, emitir comprobante
      if (facturacionElectronica && resVenta?.data?.id) {
        try {
          const comprobanteData = { ...datosFactura, venta_id: resVenta.data.id };

          // AFIP puede tardar (sobre todo de madrugada): damos margen amplio para no
          // cortar antes que el backend (que espera hasta ~30-60s a AFIP).
          const resComprobante = await api.post('/api/arca/emitir', comprobanteData, { timeout: 90000 });

          if (resComprobante.data.exito) {
            console.log('✅ Comprobante electrónico emitido:', resComprobante.data.comprobante.cae);
            setUltimoComprobante(resComprobante.data.comprobante);
          } else {
            alert(`⚠️ La venta se registró, pero NO se pudo emitir la factura electrónica:\n${resComprobante.data.error || 'Error desconocido'}\n\nPodés reintentarla desde Configuración → Facturación.`);
          }
        } catch (errArca) {
          console.error('⚠️ Error al emitir comprobante ARCA:', errArca);
          // La venta ya se registró: avisamos fuerte que la factura NO salió
          const msg = errArca.response?.data?.error || errArca.message || 'Error de conexión';
          alert(`⚠️ La venta se registró, pero NO se pudo emitir la factura electrónica:\n${msg}\n\nPodés reintentarla desde Configuración → Facturación.`);
        }
      }

      // Obtener items completos para el ticket
      if (resVenta?.data?.id) {
        try {
          const ventaCompleta = await api.get(`/api/ventas/${resVenta.data.id}`);
          setUltimaVenta(ventaCompleta.data);
          // Impresión automática: si está configurada, imprime sin que el usuario toque nada
          // (las ventas con comprobante electrónico muestran su propio comprobante)
          if (config?.impresion_tickets_automatica && !facturacionElectronica) {
            imprimirTicket({
              venta: ventaCompleta.data,
              items: ventaCompleta.data.items || [],
              config,
              modo: 'automatico'
            });
          }
        } catch { setUltimaVenta(null); }
      }

      setMostrarModalVenta(false);
      setTotalUltimaVenta(totalFinal);
      setVentaExitosa(true);
      resetearFacturacion(true); // mantener comprobante para mostrarlo
      cargarProductos();
      inputBuscarRef.current?.focus();
    } catch (err) {
      // Si falla por error de red, guardar offline automáticamente
      if (!err.response) {
        agregarVentaOffline(ventaPayload);
        const nuevoNumero = contadorVentas + 1;
        setContadorVentas(nuevoNumero);
        setPestanas(prev => prev.map(p =>
          p.id === pestanaActiva ? { ...p, nombre: `Venta ${nuevoNumero}`, carrito: [] } : p
        ));
        setMostrarModalVenta(false);
        setTotalUltimaVenta(totalFinal);
        setUltimaVenta(null);
        setVentaExitosa(true);
      resetearAjustes();
        inputBuscarRef.current?.focus();
      } else {
        alert(err.response?.data?.error || 'Error al registrar la venta');
      }
    }
  };

  // Función para imprimir ticket desde el modal de venta exitosa
const imprimirTicketDesdeModal = () => {
    // Si fue una venta con facturación electrónica y hay comprobante, mostrar ese
    if (ultimoComprobante) {
      setVentaExitosa(false);
      setTimeout(() => setMostrarComprobanteElectronico(true), 150);
      return;
    }
    if (!ultimaVenta) {
      if (!online) {
        alert('⚠️ Ticket no disponible en modo offline.\nCuando vuelva el internet la venta se sincroniza y podrás reimprimir desde el historial.');
      } else {
        alert('No hay una venta para imprimir');
      }
      return;
    }
    if (config?.impresion_tickets_automatica) {
      imprimirTicket({
        venta: ultimaVenta,
        items: ultimaVenta.items || [],
        config,
        modo: 'automatico'
      });
    } else if (config?.impresion_tickets) {
      imprimirTicket({
        venta: ultimaVenta,
        items: ultimaVenta.items || [],
        config,
        modo: 'vista_previa'
      });
    } else {
      alert('Configurá la impresión en Configuración > Impresión');
    }
  };

  // Si hay preferencia local la usamos; si no, la del negocio
  const oscuro = modoOscuroLocal !== null ? modoOscuroLocal : (config?.modo_oscuro !== false);

  const toggleModoOscuro = () => {
    const nuevo = !oscuro;
    setModoOscuroLocal(nuevo);
    localStorage.setItem('pos_modo_oscuro', String(nuevo));
  };

  const estilos = {
    panelBusqueda: oscuro 
      ? { background: '#111827', borderRight: '0.5px solid rgba(255,255,255,0.08)' } 
      : { background: '#f8fafc', borderRight: '1px solid #e2e8f0' },
    inputBuscar: oscuro 
      ? { background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' } 
      : { background: '#ffffff', border: '1px solid #d1d5db', color: '#1f2937', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
    textoProducto: oscuro 
      ? { color: 'rgba(255,255,255,0.9)' } 
      : { color: '#1f2937' },
    textoSecundario: oscuro 
      ? { color: 'rgba(255,255,255,0.35)' } 
      : { color: '#6b7280' },
    fondoCarrito: oscuro 
      ? 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f1a2e 100%)' 
      : 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 50%, #e5e7eb 100%)',
    fondoFooter: oscuro ? '#0f0f1a' : '#ffffff',
    borderFooter: oscuro ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
    textoTotal: oscuro ? 'rgba(255,255,255,0.5)' : '#6b7280',
    textoTotalMonto: oscuro ? '#ffffff' : '#111827',
    fondoPestanas: oscuro ? '#1a1a2e' : '#f3f4f6',
    itemCarrito: oscuro 
      ? { background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)', border: '0.5px solid rgba(255,255,255,0.12)' } 
      : { background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    textoItemCarrito: oscuro 
      ? { color: 'rgba(255,255,255,0.9)' } 
      : { color: '#111827' },
    textoItemSecundario: oscuro 
      ? { color: 'rgba(255,255,255,0.4)' } 
      : { color: '#9ca3af' },
    botonCantidad: oscuro 
      ? { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' } 
      : { background: '#e5e7eb', color: '#374151' },
    botonBasura: oscuro 
      ? { background: 'rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.7)' } 
      : { background: '#fef2f2', color: '#dc2626' },
    botonLimpiar: oscuro 
      ? { background: 'rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.7)' } 
      : { background: '#fef2f2', color: '#dc2626' },
    textoVacio: oscuro 
      ? { color: 'rgba(255,255,255,0.3)' } 
      : { color: '#9ca3af' },
    productoItem: oscuro
      ? { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.06)' }
      : { background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
    productoItemHover: oscuro
      ? { background: 'rgba(249,115,22,0.1)', border: '0.5px solid rgba(249,115,22,0.3)' }
      : { background: '#fff7ed', border: '1px solid #fed7aa', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  };


  // --- Fin del día: alerta y política de cierre. El día siempre va de 00 a 00. ---
  const alertaCierreActiva = !!config?.alerta_cierre_activa;
  const minutosAvisoCierre = parseInt(config?.alerta_cierre_minutos) || 30;
  const politicaCierre = config?.cierre_politica === 'forzar' ? 'forzar' : 'seguir';
  const finDia = turno?.fecha_apertura ? finDiaComercial(turno.fecha_apertura, 0) : null;
  const msParaFinDia = finDia ? finDia.getTime() - ahora : null;
  const pasadoFinDia = finDia ? ahora >= finDia.getTime() : false;
  const minutosRestantes = msParaFinDia != null ? Math.max(0, Math.ceil(msParaFinDia / 60000)) : 0;
  const enVentanaAvisoCierre = alertaCierreActiva && msParaFinDia != null && msParaFinDia > 0 && msParaFinDia <= minutosAvisoCierre * 60000;
  const cierreForzadoActivo = !!turno && alertaCierreActiva && politicaCierre === 'forzar' && pasadoFinDia;
  const avisoFueraHora = !!turno && alertaCierreActiva && politicaCierre === 'seguir' && pasadoFinDia;

  if (cargandoTurno) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse" style={{ backgroundColor: 'var(--color-primario)' }}>
            <span className="text-white text-xl">🛒</span>
          </div>
          <p className="text-white text-lg font-medium">Cargando POS...</p>
        </div>
      </div>
    );
  }

  if (!turno) {
    const abrirCaja = async (payload) => {
      try {
        const res = await api.post('/api/turnos/abrir', payload);
        // ✅ RESET COMPLETO DEL ESTADO SOLO AL ABRIR NUEVA CAJA
        setTurno(res.data);
            setPestanas([{ id: 1, nombre: 'Venta 1', carrito: [] }]);
            setPestanaActiva(1);
            setContadorVentas(1);
            setBuscar('');
            setUltimaVenta(null);
            setTotalUltimaVenta(0);
            setMensajeScanner(null);
            setMostrarModalGasto(false);
            setMostrarModalFiados(false);
            setMostrarModalVenta(false);
            setMostrarModalCierre(false);
            setMostrarModalRapida(false);
            setMostrarModalHistorial(false);
            setVentaExitosa(false);
            setEditandoCantidad(null);
            setFacturacionElectronica(false);
            setTipoComprobante(0);
            setTipoDocumento(99);
            setNumeroDocumento('');
            setDenominacionComprador('');
            setTiposComprobante([]);
            setUltimoComprobante(null);
            setMostrarComprobanteElectronico(false);
            // Limpiar localStorage
            localStorage.removeItem('pos_pestanas');
            localStorage.removeItem('pos_pestana_activa');
            localStorage.removeItem('pos_contador_ventas');
      } catch (err) {
        alert(err.response?.data?.error || 'Error al abrir caja');
        verificarTurno(); // refrescar estados (p. ej. otro usuario la abrió recién)
      }
    };
    return (
      <ModalSeleccionCaja cajasAbiertas={cajasAbiertas} cajasFijas={cajasFijas}
        sugerenciaInicio={sugerenciaInicio}
        onAbrir={(nombre, inicioCaja) => abrirCaja({ nombre, inicio_caja: inicioCaja })}
        onAbrirFija={(cajaDefinidaId, inicioCaja) => abrirCaja({ caja_definida_id: cajaDefinidaId, inicio_caja: inicioCaja })}
        onAbrirProvisoria={(inicioCaja) => abrirCaja({ es_provisoria: true, inicio_caja: inicioCaja })}
        onUnirse={async (turnoId) => {
          try { const res = await api.post(`/api/turnos/${turnoId}/unirse`); setTurno(res.data); }
          catch (err) { alert(err.response?.data?.error || 'Error al unirse a la caja'); verificarTurno(); }
        }}
      />
    );
  }

  // Cierre forzado: pasó el fin del día y la política es forzar. Se bloquea SOLO
  // esta caja hasta cerrarla. El usuario puede cerrar sesión para que otro entre
  // y siga en otra caja.
  if (cierreForzadoActivo) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">El día cerró</h2>
          <p className="text-gray-600 text-sm mb-1">
            La caja <b>{turno.nombre}</b> se pasó del horario del día y no puede seguir vendiendo.
          </p>
          <p className="text-gray-500 text-sm mb-5">
            Cerrá la caja para hacer el arqueo. Si otro usuario tiene que seguir vendiendo, puede
            cerrar sesión e ingresar en otra caja.
          </p>
          <div className="space-y-2">
            <button onClick={() => setMostrarModalCierre(true)}
              className="w-full py-3 text-white rounded-xl font-bold transition-colors"
              style={{ backgroundColor: 'var(--color-primario)' }}>
              🔒 Cerrar caja ahora
            </button>
            <button onClick={() => { localStorage.removeItem('pos_pestanas'); localStorage.removeItem('pos_pestana_activa'); localStorage.removeItem('pos_contador_ventas'); logout(); }}
              className="w-full py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors">
              Cerrar sesión (que entre otro usuario)
            </button>
          </div>
        </div>
        {mostrarModalCierre && (
          <ModalCierreCaja turno={turno}
            onCerrar={() => setMostrarModalCierre(false)}
            onCerrado={() => {
              localStorage.removeItem('pos_pestanas');
              localStorage.removeItem('pos_pestana_activa');
              localStorage.removeItem('pos_contador_ventas');
              logout();
            }} />
        )}
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: oscuro ? '#0f0f1a' : '#f1f5f9' }}>

      {/* ---- BANNER FIN DE DÍA (avisar antes) ---- */}
      {enVentanaAvisoCierre && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-2 text-sm flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="animate-pulse">⏰</span>
            <span className="font-semibold truncate">
              Falta{minutosRestantes !== 1 ? 'n' : ''} {minutosRestantes} min para el fin del día. Cerrá la caja a tiempo.
            </span>
          </div>
          <button onClick={() => setMostrarModalCierre(true)}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors">
            Cerrar caja
          </button>
        </div>
      )}

      {/* ---- BANNER FUERA DE HORA (política seguir) ---- */}
      {avisoFueraHora && (
        <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-2 text-sm flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span>⚠️</span>
            <span className="font-semibold truncate">Esta caja se pasó del horario del día. Conviene cerrarla.</span>
          </div>
          <button onClick={() => setMostrarModalCierre(true)}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors">
            Cerrar caja
          </button>
        </div>
      )}

      {/* ---- BANNER OFFLINE ---- */}
      {!online && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between text-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">🔴</span>
            <span className="font-semibold">SIN INTERNET — Modo Offline</span>
            <span className="text-red-200">Las ventas se guardan localmente y se sincronizarán cuando vuelva la conexión</span>
          </div>
          {pendientes.length > 0 && (
            <span className="bg-red-700 px-2 py-0.5 rounded-full text-xs font-bold">
              {pendientes.length} venta{pendientes.length > 1 ? 's' : ''} pendiente{pendientes.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ---- BANNER SINCRONIZANDO ---- */}
      {online && sincronizando && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center gap-2 text-sm flex-shrink-0">
          <span className="animate-spin">⏳</span>
          <span className="font-semibold">Sincronizando ventas offline...</span>
        </div>
      )}

      {/* ---- BANNER SINCRONIZACIÓN EXITOSA ---- */}
      {online && !sincronizando && pendientes.length === 0 && ultimaSincronizacion && (
        <SincronizacionExitosa ultimaSincronizacion={ultimaSincronizacion} />
      )}

      {/* ---- BARRA SUPERIOR MODERNA ---- */}
      <div className="bg-gray-900 text-white flex-shrink-0 border-b border-gray-700 px-2 sm:px-4 py-2 sm:py-3">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">

        {/* Logo/Brand */}
        <div className="flex items-center gap-2.5 mr-2 sm:mr-4 flex-shrink-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-extrabold shadow-lg ring-1 ring-white/10"
              style={{ background: 'linear-gradient(135deg, var(--color-primario) 0%, rgba(0,0,0,0.35) 130%)' }}>
              {(config?.nombre_negocio || 'Q').charAt(0).toUpperCase()}
            </div>
            {/* Indicador de caja activa */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900 shadow"></span>
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-bold text-white truncate max-w-[160px]">{config?.nombre_negocio || 'Mi Negocio'}</p>
            <p className="text-[11px] font-medium tracking-wider uppercase" style={{ color: 'var(--color-primario)' }}>Punto de Venta</p>
            {usuario && (
              <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 truncate max-w-[160px]" title="Usuario en sesión">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block flex-shrink-0 animate-pulse"></span>
                {usuario.nombre || usuario.email}
              </p>
            )}
          </div>
        </div>

        <div className="w-px h-7 bg-gray-700 mr-1 sm:mr-2 hidden sm:block flex-shrink-0" />

        {/* Menú de acciones — solo en celular/tablet (declutter de la barra) */}
        <div className="lg:hidden relative flex-shrink-0">
          <button onClick={() => setMenuMobilAbierto(v => !v)} title="Menú de acciones"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-lg">
            ☰
          </button>
          {menuMobilAbierto && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuMobilAbierto(false)} />
              <div className="absolute left-0 top-12 z-50 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl py-2">
                {config?.permite_venta_rapida !== false && (
                  <button onClick={() => { setMenuMobilAbierto(false); setMostrarModalRapida(true); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">⚡ Venta rápida</button>
                )}
                <button onClick={() => { setMenuMobilAbierto(false); setMostrarModalProductoRapido(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">🏷️ Alta rápida</button>
                <button onClick={() => { setMenuMobilAbierto(false); setMostrarModalFiados(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">👥 Fiados</button>
                <button onClick={() => { setMenuMobilAbierto(false); setMostrarModalHistorial(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">📋 Historial</button>
                <button onClick={() => { setMenuMobilAbierto(false); setMostrarModalGasto(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">💸 Gastos</button>
                <button onClick={() => { setMenuMobilAbierto(false); setMostrarModalCierre(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">🔒 Cierre de caja</button>
                <button onClick={() => { setMenuMobilAbierto(false); navigate('/admin'); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">⚙️ Admin</button>
                <button onClick={async () => { setMenuMobilAbierto(false); try { if (window.caches) { const claves = await caches.keys(); await Promise.all(claves.map(k => caches.delete(k))); } } catch {} window.location.reload(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">🔄 Actualizar app</button>
              </div>
            </>
          )}
        </div>

        {/* Botones principales (escritorio) */}
        <div className="hidden lg:flex items-center gap-1.5 sm:gap-2">
        {config?.permite_venta_rapida !== false && (
          <button onClick={() => setMostrarModalRapida(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm flex-shrink-0">
            ⚡ <span className="hidden sm:inline">Rápida</span>
            <span className="text-purple-300 text-xs hidden lg:inline">[F1]</span>
          </button>
        )}

        <button onClick={() => setMostrarModalProductoRapido(true)}
          title="Dar de alta un producto al toque (útil para productos sin precio)"
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm flex-shrink-0">
          🏷️ <span className="hidden sm:inline">Alta rápida</span>
          <span className="text-teal-200 text-xs hidden lg:inline">[F7]</span>
        </button>

        <button onClick={() => setMostrarModalFiados(true)}
          style={{ backgroundColor: 'var(--color-primario)' }}
          className="flex items-center gap-2 hover:opacity-80 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm flex-shrink-0">
          👥 <span className="hidden sm:inline">Fiados</span>
          <span className="text-white text-opacity-60 text-xs hidden lg:inline">[F3]</span>
        </button>

        <button onClick={() => setMostrarModalHistorial(true)}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm flex-shrink-0">
          📋 <span className="hidden sm:inline">Historial</span>
          <span className="text-gray-400 text-xs hidden lg:inline">[F5]</span>
        </button>

        <button onClick={() => setMostrarModalGasto(true)}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm flex-shrink-0">
          💸 <span className="hidden sm:inline">Gastos</span>
          <span className="text-amber-200 text-xs hidden lg:inline">[F10]</span>
        </button>

        <button onClick={() => setMostrarModalCierre(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-600 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm flex-shrink-0">
          🔒 <span className="hidden sm:inline">Cierre</span>
          <span className="text-red-300 text-xs hidden lg:inline">[F4]</span>
        </button>

        <button onClick={() => navigate('/admin')}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm flex-shrink-0">
          ⚙️ <span className="hidden sm:inline">Admin</span>
        </button>
        </div>

        {/* Status derecha */}
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          {mensajeScanner && (
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${mensajeScanner.tipo === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>
              {mensajeScanner.texto}
            </span>
          )}
          {ventaExitosa && !mensajeScanner && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-green-600">✅ Venta registrada</span>
          )}

          {/* Resumen del turno */}
          {carritoActivo.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ background: oscuro ? 'rgba(255,255,255,0.06)' : '#e2e8f0', border: oscuro ? '0.5px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-primario)' }}>
                {carritoActivo.length} prod
              </span>
              <span className={oscuro ? 'text-gray-600' : 'text-gray-400'}>·</span>
              <span className={`text-xs font-bold ${oscuro ? 'text-white' : 'text-gray-800'}`}>{fmt(total)}</span>
            </div>
          )}

          {/* Caja actual: click → cambiar de caja (sin cerrarla) */}
          <button
            onClick={async () => {
              const tieneCarrito = pestanas.some(p => p.carrito.length > 0);
              const aviso = `Estás trabajando en la caja "${turno?.nombre || 'Caja'}".\n\n¿Querés cambiar de caja?\nLa caja NO se cierra: queda abierta para los demás usuarios.` +
                (tieneCarrito ? '\n\n⚠️ Tenés productos sin cobrar en el carrito.' : '');
              if (!window.confirm(aviso)) return;
              try {
                await api.post(`/api/turnos/${turno.id}/salir`);
                setTurno(null);
                setCargandoTurno(true);
                verificarTurno(); // recarga cajas fijas y abiertas → aparece el selector
              } catch (err) {
                alert(err.response?.data?.error || 'Error al salir de la caja');
              }
            }}
            title="Estás en esta caja — tocá para cambiar de caja (no se cierra)"
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-3 py-2 transition-colors">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-gray-300">{turno?.nombre || 'Caja'}</span>
            <span className="text-[10px] text-gray-500">⇄</span>
          </button>

          {/* Modo claro/oscuro rápido — preferencia local */}
          <button
            onClick={toggleModoOscuro}
            title={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white transition-all flex-shrink-0">
            {oscuro ? '☀️' : '🌙'}
          </button>

          {/* Actualizar la app (equivale a Ctrl+Shift+R) por si algo quedó trabado */}
          <button
            onClick={async () => {
              try {
                if (window.caches) {
                  const claves = await caches.keys();
                  await Promise.all(claves.map(k => caches.delete(k)));
                }
              } catch { }
              window.location.reload();
            }}
            title="Actualizar la pantalla (recarga forzada)"
            className="hidden lg:flex items-center justify-center w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white transition-all flex-shrink-0">
            🔄
          </button>

          {/* Cambiar usuario (cambio de turno) — discreto, en la esquina */}
          <button
            onClick={() => { if (window.confirm('¿Cambiar de usuario?\n\nSe cerrará la sesión actual para que ingrese otro usuario (cambio de turno).')) logout(); }}
            title="Cambiar usuario (cambio de turno)"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white transition-all flex-shrink-0">
            👤
          </button>
        </div>
      </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ---- PANEL IZQUIERDO: BÚSQUEDA ---- */}
       <div className={`${vistaMobil === 'carrito' ? 'hidden' : 'flex'} lg:flex w-full lg:w-[28rem] xl:w-[32rem] flex-col flex-shrink-0`} style={estilos.panelBusqueda}>

          {/* Buscador */}
          <div className="p-3" style={{ borderBottom: oscuro ? '0.5px solid rgba(255,255,255,0.08)' : '1px solid #d1d5db' }}>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm" style={{ color: oscuro ? 'rgba(255,255,255,0.3)' : '#64748b' }}>🔍</span>
              <input ref={inputBuscarRef} type="text" value={buscar}
                onChange={(e) => setBuscar(e.target.value)} autoFocus
                placeholder="Buscar por nombre o código... [F2]"
                className="w-full rounded-xl pl-8 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                style={estilos.inputBuscar} />
              {buscar && (
                <button onClick={() => { setBuscar(''); setProductos([]); inputBuscarRef.current?.focus(); }}
                  className="absolute right-3 top-2.5 text-sm transition-opacity hover:opacity-100"
                  style={{ color: oscuro ? 'rgba(255,255,255,0.4)' : '#64748b' }}>✕</button>
              )}
            </div>
          </div>

          {/* Barra de ordenar / contador */}
         {productos.length > 0 && (
            <div className="px-3 py-2 flex gap-1.5 items-center justify-between" style={{ borderBottom: oscuro ? '0.5px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1' }}>
              <div className="flex gap-1.5 items-center">
                <span className="text-xs" style={{ color: oscuro ? 'rgba(255,255,255,0.3)' : '#64748b' }}>Orden:</span>
                {[{ id: 'relevancia', label: '🎯' }, { id: 'nombre', label: 'A-Z' }, { id: 'precio_asc', label: '$ ↑' }, { id: 'precio_desc', label: '$ ↓' }].map(o => (
                  <button key={o.id} onClick={() => setOrdenar(o.id)}
                    style={ordenar === o.id ? { backgroundColor: 'var(--color-primario)' } : {}}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${ordenar === o.id ? 'text-white' : oscuro ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: oscuro ? 'rgba(255,255,255,0.07)' : '#e2e8f0', color: oscuro ? 'rgba(255,255,255,0.4)' : '#64748b' }}>
                {productos.length} resultado{productos.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Lista productos */}
          <div className="flex-1 overflow-y-auto p-2">
            {buscar.trim() === '' ? (
              <div className="flex flex-col items-center justify-center h-full py-8 px-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: oscuro ? 'rgba(255,255,255,0.06)' : '#e2e8f0', border: oscuro ? '0.5px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1' }}>
                  <span className="text-3xl opacity-60">🔍</span>
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: oscuro ? 'rgba(255,255,255,0.5)' : '#475569' }}>Buscá un producto</p>
                <p className="text-xs text-center mb-6" style={{ color: oscuro ? 'rgba(255,255,255,0.2)' : '#94a3b8' }}>por nombre, o escaneá el código de barras</p>
                <div className="w-full space-y-1.5 hidden lg:block">
                  <p className="text-xs mb-2 uppercase tracking-widest" style={{ color: oscuro ? 'rgba(255,255,255,0.2)' : '#94a3b8' }}>Atajos de teclado</p>
                  {[
                    ...(config?.permite_venta_rapida !== false ? [{ key: 'F1', label: 'Venta Rápida', color: '#7c3aed', bg: 'rgba(124,58,237,0.15)' }] : []),
                    { key: 'F3', label: 'Fiados', color: 'var(--color-primario)', bg: 'rgba(249,115,22,0.1)' },
                    { key: 'F8', label: 'Confirmar Venta', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
                    { key: 'F9', label: 'Limpiar carrito', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
                  ].map(({ key, label, color, bg }) => (
                    <div key={key} className="flex items-center justify-between rounded-xl px-3 py-2"
                      style={{ background: bg, border: `0.5px solid ${color}30` }}>
                      <span className="text-xs font-medium" style={estilos.textoSecundario}>{label}</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg"
                        style={{ background: `${color}25`, color }}>{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : productos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: oscuro ? 'rgba(255,255,255,0.05)' : '#e2e8f0', border: oscuro ? '0.5px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1' }}>
                  <span className="text-3xl opacity-50">📦</span>
                </div>
                <p className="text-sm font-medium" style={{ color: oscuro ? 'rgba(255,255,255,0.4)' : '#64748b' }}>Sin resultados</p>
                <p className="text-xs mt-1" style={{ color: oscuro ? 'rgba(255,255,255,0.2)' : '#94a3b8' }}>Probá con otro nombre o código</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {productosOrdenados.map(producto => {
                  const sinStock = producto.stock <= 0;
                  const stockBajo = !sinStock && producto.stock <= producto.stock_minimo;
                  const stockOk = !sinStock && !stockBajo;
                  const stockColor = sinStock ? '#ef4444' : stockBajo ? '#f59e0b' : '#22c55e';
                  const stockBg = sinStock ? 'rgba(239,68,68,0.12)' : stockBajo ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.1)';

                  return (
                    <button key={producto.id} onClick={() => agregarAlCarrito(producto)}
                      className="w-full rounded-xl p-3 text-left transition-all flex items-center gap-3 group"
                      style={estilos.productoItem}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = oscuro ? 'rgba(249,115,22,0.1)' : '#fff7ed';
                        e.currentTarget.style.border = oscuro ? '0.5px solid rgba(249,115,22,0.3)' : '1px solid #fed7aa';
                        e.currentTarget.style.transform = 'translateX(2px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = estilos.productoItem.background;
                        e.currentTarget.style.border = estilos.productoItem.border;
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 text-white"
                        style={{ backgroundColor: 'var(--color-primario)' }}>
                        {(producto.nombre || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight break-words"
                          style={{
                            color: oscuro ? 'rgba(255,255,255,0.9)' : '#111827',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>
                          {producto.nombre}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: oscuro ? 'rgba(255,255,255,0.3)' : '#9ca3af' }}>{producto.categoria_nombre || 'Sin categoría'}</p>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <p className="font-bold text-sm" style={{ color: 'var(--color-primario)' }}>{fmt(producto.precio_venta)}</p>
                        {config?.mostrar_stock_pos !== false && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: stockColor, background: stockBg }}>
                            {sinStock ? 'Sin stock' : `${producto.stock} ${producto.unidad}`}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ---- PANEL DERECHO: CARRITO ---- */}
       <div className={`${vistaMobil === 'productos' ? 'hidden' : 'flex'} lg:flex flex-1 flex-col overflow-hidden`} style={{ background: estilos.fondoFooter }}>

          {/* Pestañas */}
          <div className="flex items-center overflow-x-auto flex-shrink-0" style={{ background: estilos.fondoPestanas, borderBottom: `0.5px solid ${estilos.borderFooter}` }}>
            {pestanas.map(p => (
              <div key={p.id} onClick={() => setPestanaActiva(p.id)}
              className={`flex items-center gap-2 px-4 py-3 cursor-pointer flex-shrink-0 transition-all ${
                  pestanaActiva === p.id ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300'
                }`}
               style={{ 
                  borderRight: oscuro ? '0.5px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
                  ...(pestanaActiva === p.id ? { borderBottom: '2px solid var(--color-primario)' } : {})
                }}>
                <span className="text-sm font-medium">{p.nombre}</span>
                {p.carrito.length > 0 && (
                  <span className="text-xs rounded-full px-1.5 py-0.5 text-white" style={{ backgroundColor: 'var(--color-primario)' }}>{p.carrito.length}</span>
                )}
                {pestanas.length > 1 && (
                  <button onClick={(e) => cerrarPestana(p.id, e)} className={`text-xs ml-1 transition-colors ${oscuro ? 'text-gray-300 hover:text-red-500' : 'text-gray-400 hover:text-red-500'}`}>✕</button>
                )}
              </div>
            ))}
            <button onClick={agregarPestana}
              className="px-3 py-3 transition-colors flex-shrink-0 text-xl font-light"
            style={{ color: oscuro ? 'rgba(255,255,255,0.3)' : '#94a3b8' }}
              title="Nueva venta">+</button>
          </div>

          {/* Items del carrito */}
          <div className="flex-1 overflow-y-auto p-3" style={{ background: estilos.fondoCarrito }}>
              {carritoActivo.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 opacity-20"
                  style={{ background: oscuro ? 'rgba(255,255,255,0.08)' : '#e2e8f0', border: oscuro ? '0.5px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1' }}>
                  <span className="text-4xl">🛒</span>
                </div>
                <p className="text-base font-semibold mb-1" style={estilos.textoVacio}>Carrito vacío</p>
                <p className="text-sm mt-1" style={{ ...estilos.textoVacio, opacity: 0.6 }}>Buscá o escaneá productos</p>
                <div className="mt-5 hidden lg:flex gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-lg font-mono" style={estilos.textoSecundario}>F8 confirmar</span>
                  <span className="text-xs px-2.5 py-1 rounded-lg font-mono" style={estilos.textoSecundario}>F9 limpiar</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-w-2xl mx-auto">
                {carritoActivo.map((item, idx) => {
                  const ajuste = item.ajuste || 0;
                  const panelAbierto = ajusteItemAbierto === item.producto_id;
                  const hayAjustesConfig = pctDescuento > 0 || pctRecargo > 0 || multiploRedondeo > 0;
                  const estBtnAjuste = {
                    background: oscuro ? 'rgba(255,255,255,0.06)' : '#ffffff',
                    border: `1px solid ${oscuro ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`,
                    color: oscuro ? 'rgba(255,255,255,0.8)' : '#475569',
                  };
                  return (
               <div key={item.producto_id}
                  className="rounded-2xl transition-all select-none overflow-hidden"
                  style={{ ...estilos.itemCarrito, animationDelay: `${idx * 30}ms` }}>
                  <div
                    onClick={() => cambiarCantidad(item.producto_id, item.cantidad + 1)}
                    title="Tocá la tarjeta para sumar 1"
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer active:scale-[0.99]">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${item.esRapida ? 'bg-purple-500 bg-opacity-20 text-purple-300' : 'text-white'}`}
                      style={!item.esRapida ? { backgroundColor: 'var(--color-primario)' } : {}}>
                      {item.esRapida ? '⚡' : (item.nombre_producto || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-sm leading-tight" style={estilos.textoItemCarrito}>{item.nombre_producto}</p>
                      <p className="text-xs mt-0.5" style={estilos.textoItemSecundario}>{fmt(item.precio_unitario)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); cambiarCantidad(item.producto_id, item.cantidad - 1); }}
                        className="w-7 h-7 rounded-lg font-bold text-sm transition-all hover:scale-105 active:scale-95"
                        style={estilos.botonCantidad}>−</button>
                      {editandoCantidad === item.producto_id ? (
                        <input
                          type="number" min="1" autoFocus
                          defaultValue={item.cantidad}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.target.select()}
                          className="w-10 h-7 text-center font-bold text-sm rounded-lg outline-none border-0 bg-white text-gray-900"
                          onBlur={(e) => {
                            const v = parseFloat(e.target.value);
                            if (v > 0) cambiarCantidad(item.producto_id, v);
                            setEditandoCantidad(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.target.blur();
                            if (e.key === 'Escape') setEditandoCantidad(null);
                          }}
                        />
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditandoCantidad(item.producto_id); }}
                          className="w-10 h-7 rounded-lg font-bold text-sm transition-all hover:bg-white hover:bg-opacity-10"
                          style={estilos.textoItemCarrito}
                          title="Click para editar cantidad">
                          {item.cantidad}
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); cambiarCantidad(item.producto_id, item.cantidad + 1); }}
                        className="w-7 h-7 rounded-lg font-bold text-sm transition-all hover:scale-105 active:scale-95"
                        style={estilos.botonCantidad}>+</button>
                    </div>
                      <div className="text-right flex-shrink-0 w-20">
                      <p className="font-bold text-sm" style={estilos.textoItemCarrito}>{fmt(item.subtotal)}</p>
                      {ajuste !== 0 && (
                        <p className="text-[10px] font-bold leading-none mt-0.5" style={{ color: ajuste < 0 ? '#22c55e' : '#3b82f6' }}>
                          {ajuste > 0 ? '+' : ''}{fmt(ajuste)}
                        </p>
                      )}
                    </div>
                    {hayAjustesConfig && (
                      <button onClick={(e) => { e.stopPropagation(); setAjusteItemAbierto(panelAbierto ? null : item.producto_id); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0 text-xs font-bold hover:scale-110"
                        style={(item.pctTipo || item.redondeoDir) ? { background: '#3b82f6', border: '1px solid #3b82f6', color: '#fff' } : estBtnAjuste}
                        title="Descuento, recargo o redondeo de este producto">
                        %
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); eliminarDelCarrito(item.producto_id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0 text-xs hover:scale-110"
                      style={estilos.botonBasura}
                      title="Quitar del carrito">
                      ✕
                    </button>
                  </div>
                  {panelAbierto && hayAjustesConfig && (() => {
                    const estActivoVerde = { background: '#22c55e', border: '1px solid #22c55e', color: '#fff' };
                    const estActivoAzul = { background: '#3b82f6', border: '1px solid #3b82f6', color: '#fff' };
                    const tieneAjuste = !!item.pctTipo || !!item.redondeoDir;
                    return (
                    <div className="px-4 pb-3 -mt-0.5 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {pctDescuento > 0 && (
                        <button onClick={() => aplicarAjusteItem(item.producto_id, 'descuento')}
                          className="px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                          style={item.pctTipo === 'descuento' ? estActivoVerde : estBtnAjuste}>− Desc {pctDescuento}%</button>
                      )}
                      {pctRecargo > 0 && (
                        <button onClick={() => aplicarAjusteItem(item.producto_id, 'recargo')}
                          className="px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                          style={item.pctTipo === 'recargo' ? estActivoAzul : estBtnAjuste}>+ Rec {pctRecargo}%</button>
                      )}
                      {multiploRedondeo > 0 && (
                        <>
                          <button onClick={() => aplicarAjusteItem(item.producto_id, 'redondeo', 'abajo')}
                            className="px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                            style={item.redondeoDir === 'abajo' ? estActivoAzul : estBtnAjuste} title={`Redondear hacia abajo (múltiplos de ${multiploRedondeo})`}>↓ Redondear</button>
                          <button onClick={() => aplicarAjusteItem(item.producto_id, 'redondeo', 'arriba')}
                            className="px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                            style={item.redondeoDir === 'arriba' ? estActivoAzul : estBtnAjuste} title={`Redondear hacia arriba (múltiplos de ${multiploRedondeo})`}>↑ Redondear</button>
                        </>
                      )}
                      {tieneAjuste && (
                        <button onClick={() => aplicarAjusteItem(item.producto_id, 'quitar')}
                          className="px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                          style={{ ...estBtnAjuste, color: '#ef4444' }}>Quitar ✕</button>
                      )}
                    </div>
                    );
                  })()}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ---- FOOTER DEL CARRITO ---- */}
          <div className="flex-shrink-0" style={{ background: estilos.fondoFooter, borderTop: oscuro ? '0.5px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0' }}>
            <div className="max-w-2xl mx-auto px-4 pt-3 pb-4">

              {/* Resumen items + limpiar */}
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: oscuro ? 'rgba(255,255,255,0.08)' : '#e2e8f0', color: oscuro ? 'rgba(255,255,255,0.5)' : '#475569' }}>
                    {carritoActivo.length} {carritoActivo.length === 1 ? 'producto' : 'productos'}
                  </span>
                  <span className="text-xs" style={{ color: oscuro ? 'rgba(255,255,255,0.25)' : '#94a3b8' }}>
                    · {carritoActivo.reduce((acc, i) => acc + i.cantidad, 0)} uds
                  </span>
                </div>
                {carritoActivo.length > 0 && (
                  <button onClick={limpiarCarrito}
                    className="text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                    style={estilos.botonLimpiar}>
                    ✕ Limpiar
                  </button>
                )}
              </div>

              {/* Ajustes de precio: descuento / recargo / redondeo (se configuran en Admin → Configuración) */}
              {carritoActivo.length > 0 && (pctDescuento > 0 || pctRecargo > 0 || multiploRedondeo > 0) && (() => {
                const estiloInactivo = {
                  background: oscuro ? 'rgba(255,255,255,0.06)' : '#ffffff',
                  border: `1px solid ${oscuro ? 'rgba(255,255,255,0.15)' : '#e2e8f0'}`,
                  color: oscuro ? 'rgba(255,255,255,0.75)' : '#475569',
                };
                return (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {pctDescuento > 0 && (
                      descEditable ? (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold" style={estiloInactivo}>
                          <span>− Desc</span>
                          <input
                            type="number" inputMode="decimal" min="0" max={pctDescuento} step="0.5"
                            value={descuentoPctManual}
                            onChange={(e) => { setDescuentoPctManual(e.target.value); setRedondeoVenta(0); }}
                            placeholder="0"
                            className="w-12 text-center rounded-md px-1 py-0.5 outline-none"
                            style={{ background: oscuro ? 'rgba(255,255,255,0.12)' : '#f1f5f9', color: 'inherit', border: '1px solid transparent' }} />
                          <span>% (máx {pctDescuento}%)</span>
                          {montoDescuento > 0 && <span className="opacity-90 text-green-500">({fmt(montoDescuento)})</span>}
                        </div>
                      ) : (
                        <button onClick={() => { setDescuentoActivo(v => !v); setRedondeoVenta(0); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={descuentoActivo ? { background: '#22c55e', border: '1px solid #22c55e', color: '#fff' } : estiloInactivo}>
                          − Desc {pctDescuento}%
                          {descuentoActivo && <span className="opacity-90">({fmt(montoDescuento)})</span>}
                        </button>
                      )
                    )}
                    {pctRecargo > 0 && (
                      <button onClick={() => { setRecargoActivo(v => !v); setRedondeoVenta(0); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={recargoActivo ? { background: '#3b82f6', border: '1px solid #3b82f6', color: '#fff' } : estiloInactivo}>
                        + Rec {pctRecargo}%
                        {recargoActivo && <span className="opacity-90">({fmt(montoRecargo)})</span>}
                      </button>
                    )}
                    {multiploRedondeo > 0 && (
                      <>
                        <button onClick={() => aplicarRedondeoVenta('abajo')}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all" style={estiloInactivo}>↓ Bajar</button>
                        <button onClick={() => aplicarRedondeoVenta('arriba')}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all" style={estiloInactivo}>↑ Subir</button>
                        {redondeoVenta !== 0 && (
                          <button onClick={() => setRedondeoVenta(0)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}
                            title="Quitar redondeo">
                            {redondeoVenta > 0 ? '+' : ''}{fmt(redondeoVenta)} ✕
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Total con animación visual */}
              <div className="flex justify-between items-end mb-3">
                <span className="text-sm font-medium" style={{ color: estilos.textoTotal }}>Total a cobrar</span>
                <span className={`font-bold transition-all ${carritoActivo.length > 0 ? 'text-4xl' : 'text-2xl opacity-40'}`}
                  style={{ color: carritoActivo.length > 0 ? estilos.textoTotalMonto : estilos.textoTotal }}>
                  {fmt(total)}
                </span>
              </div>

              {/* Botón confirmar */}
              <button onClick={abrirConfirmarVenta} disabled={carritoActivo.length === 0}
                style={carritoActivo.length > 0 ? { backgroundColor: 'var(--color-primario)' } : {}}
                className="w-full disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-lg disabled:shadow-none hover:opacity-90 active:scale-98">
                {carritoActivo.length > 0 ? (<>✅ Confirmar Venta <span className="hidden lg:inline">[F8]</span></>) : 'Agregá productos para vender'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- BARRA INFERIOR MÓVIL (alternar productos / carrito) ---- */}
      <div className="lg:hidden flex-shrink-0 flex border-t border-gray-700 bg-gray-900">
        <button onClick={() => setVistaMobil('productos')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-semibold transition-colors ${vistaMobil === 'productos' ? 'text-white' : 'text-gray-400'}`}
          style={vistaMobil === 'productos' ? { borderTop: '2px solid var(--color-primario)', background: 'rgba(255,255,255,0.05)' } : {}}>
          <span className="text-lg">🔍</span>
          <span>Productos</span>
        </button>
        <button onClick={() => setVistaMobil('carrito')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-semibold transition-colors relative ${vistaMobil === 'carrito' ? 'text-white' : 'text-gray-400'}`}
          style={vistaMobil === 'carrito' ? { borderTop: '2px solid var(--color-primario)', background: 'rgba(255,255,255,0.05)' } : {}}>
          <span className="text-lg">🛒</span>
          <span>{carritoActivo.length > 0 ? `Carrito · ${fmt(total)}` : 'Carrito'}</span>
          {carritoActivo.length > 0 && (
            <span className="absolute top-1 right-1/4 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
              style={{ backgroundColor: 'var(--color-primario)' }}>
              {carritoActivo.length}
            </span>
          )}
        </button>
      </div>

      {/* ---- MODALES ---- */}
      {mostrarModalGasto && (
        <ModalGasto turno={turno}
          onCerrar={() => { setMostrarModalGasto(false); inputBuscarRef.current?.focus(); }}
          onGuardado={() => setMostrarModalGasto(false)} />
      )}
      {mostrarModalVenta && (
        <ModalConfirmarVenta
          ref={modalVentaRef}
          carrito={carritoActivo}
          total={total}
          descuentoCarrito={montoDescuento}
          recargoCarrito={montoRecargo + redondeoVenta}
          config={config}
          turno={turno}
          facturacionElectronica={facturacionElectronica}
          setFacturacionElectronica={setFacturacionElectronica}
          tipoComprobante={tipoComprobante}
          setTipoComprobante={setTipoComprobante}
          tipoDocumento={tipoDocumento}
          setTipoDocumento={setTipoDocumento}
          numeroDocumento={numeroDocumento}
          setNumeroDocumento={setNumeroDocumento}
          denominacionComprador={denominacionComprador}
          setDenominacionComprador={setDenominacionComprador}
          condicionIvaReceptor={condicionIvaReceptor}
          setCondicionIvaReceptor={setCondicionIvaReceptor}
          tiposComprobante={tiposComprobante}
          setTiposComprobante={setTiposComprobante}
          onConfirmar={confirmarVenta}
          onCerrar={() => { 
            setMostrarModalVenta(false); 
            resetearFacturacion(false);
            inputBuscarRef.current?.focus(); 
          }}
        />
      )}
      {mostrarModalCierre && (
        <ModalCierreCaja turno={turno}
          onCerrar={() => { setMostrarModalCierre(false); inputBuscarRef.current?.focus(); }}
          onCerrado={() => {
            // Caja cerrada → se cierra la sesión para que ingrese el usuario
            // del turno siguiente y abra (o elija) su caja.
            localStorage.removeItem('pos_pestanas');
            localStorage.removeItem('pos_pestana_activa');
            localStorage.removeItem('pos_contador_ventas');
            logout();
          }} />
      )}
      {mostrarModalRapida && (
        <ModalVentaRapida onAgregar={agregarVentaRapida}
          onCerrar={() => { setMostrarModalRapida(false); inputBuscarRef.current?.focus(); }} />
      )}
      {mostrarModalProductoRapido && (
        <ModalProductoRapido
          onCerrar={() => { setMostrarModalProductoRapido(false); inputBuscarRef.current?.focus(); }}
          onCreado={(prod) => {
            setMensajeScanner({ tipo: 'exito', texto: `🏷️ "${prod.nombre}" dado de alta${Number(prod.precio_venta) > 0 ? '' : ' (sin precio, queda por revisar)'}` });
            setTimeout(() => setMensajeScanner(null), 3000);
          }} />
      )}
      {mostrarModalFiados && (
        <ModalFiados onCerrar={() => { setMostrarModalFiados(false); inputBuscarRef.current?.focus(); }} />
      )}
      {mostrarModalHistorial && turno && (
        <ModalHistorial
          turno={turno}
          config={config}
          onCerrar={() => { setMostrarModalHistorial(false); inputBuscarRef.current?.focus(); }}
        />
      )}

{mostrarComprobanteElectronico && ultimoComprobante && (
        <ComprobanteElectronico
        comprobante={ultimoComprobante}
        config={config}
       onClose={() => { setMostrarComprobanteElectronico(false); setUltimoComprobante(null); }}
        />
      )}

      {ventaExitosa && (
        <ModalVentaExitosa
          total={totalUltimaVenta}
          onSeguirVendiendo={() => setVentaExitosa(false)}
          onImprimir={imprimirTicketDesdeModal}
          config={config}
          tieneComprobanteElectronico={!!ultimoComprobante}
        />
      )}
      {mostrarModalVentaProducto && (
        <VentaProductoModal
          producto={mostrarModalVentaProducto}
          permiteStockNegativo={config?.permite_stock_negativo === true}
          onClose={() => setMostrarModalVentaProducto(null)}
          onAgregar={(item) => {
            // Agregar el item al carrito de la pestaña activa
            setPestanas(prev => prev.map(p => p.id === pestanaActiva ? { ...p, carrito: [...p.carrito, item] } : p));
            setMostrarModalVentaProducto(null);
            // Enfocar el input de búsqueda
            setTimeout(() => inputBuscarRef.current?.focus(), 50);
          }}
        />
      )}
    </div>
  );
}

export default POS;