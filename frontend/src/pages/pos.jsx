import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
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
function ModalSeleccionCaja({ cajasAbiertas, onAbrir, onUnirse }) {
  const [vista, setVista] = useState(cajasAbiertas.length > 0 ? 'seleccionar' : 'nueva');
  const [nombre, setNombre] = useState('');
  const [inicioCaja, setInicioCaja] = useState('');
  const [cajaSeleccionada, setCajaSeleccionada] = useState(null);
  const NOMBRES_SUGERIDOS = ['Mañana', 'Tarde', 'Noche', 'Principal', 'Online'];


  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b text-white rounded-t-2xl" style={{ backgroundColor: 'var(--color-primario)' }}>
          <h3 className="text-xl font-bold">🏦 Gestión de Caja</h3>
          <p className="text-white text-opacity-80 text-sm mt-1">Seleccioná cómo querés trabajar hoy</p>
        </div>
        <div className="flex border-b">
          {cajasAbiertas.length > 0 && (
            <button onClick={() => setVista('seleccionar')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${vista === 'seleccionar' ? 'border-b-2 text-orange-500 border-orange-500' : 'text-gray-500 hover:text-gray-700'}`}>
              📋 Cajas Abiertas ({cajasAbiertas.length})
            </button>
          )}
          <button onClick={() => setVista('nueva')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${vista === 'nueva' ? 'border-b-2 text-orange-500 border-orange-500' : 'text-gray-500 hover:text-gray-700'}`}>
            ➕ Nueva Caja
          </button>
        </div>
        <div className="p-6">
          {vista === 'seleccionar' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-3">Seleccioná una caja para unirte:</p>
              {cajasAbiertas.map(caja => (
                <button key={caja.id} type="button" onClick={() => setCajaSeleccionada(caja.id)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${cajaSeleccionada === caja.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800">{caja.nombre}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{caja.total_usuarios} usuario(s) · {caja.total_ventas} ventas</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-orange-500">{fmt(caja.total_facturado)}</p>
                      <p className="text-xs text-gray-400">facturado</p>
                    </div>
                  </div>
                </button>
              ))}
              <button onClick={() => cajaSeleccionada && onUnirse(cajaSeleccionada)} disabled={!cajaSeleccionada}
                style={{ backgroundColor: cajaSeleccionada ? 'var(--color-primario)' : '' }}
                className="w-full py-3 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold transition-colors mt-2">
                ✅ Unirme a esta caja
              </button>
            </div>
          )}
          {vista === 'nueva' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre de la caja *</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {NOMBRES_SUGERIDOS.map(n => (
                    <button key={n} type="button" onClick={() => setNombre(n)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${nombre === n ? 'text-white border-orange-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                      style={nombre === n ? { backgroundColor: 'var(--color-primario)' } : {}}>
                      {n}
                    </button>
                  ))}
                </div>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="O escribí un nombre personalizado..." />
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
            </div>
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
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
      alert('Error al eliminar venta');
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
  tiposComprobante,
  setTiposComprobante,
  onConfirmar, 
  onCerrar 
}, ref) {
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [recargo, setRecargo] = useState('');
  const [redondeo, setRedondeo] = useState(0);
  const [efectivoEntregado, setEfectivoEntregado] = useState('');
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
          if (res.data.length > 0) setTipoComprobante(res.data[0].codigo);
        })
        .catch(() => {});
    }
  }, [config?.facturacion_electronica_activa, config?.regimen_fiscal]);

  // Descuento fijo: empieza DESACTIVADO, el cajero lo activa si quiere
  const tieneDescuentoFijo = config?.descuento_modo === 'fijo' && config?.descuento_maximo > 0;
  const [descuentoActivo, setDescuentoActivo] = useState(false);
  const montoDescuento = descuentoActivo ? Math.round(total * config.descuento_maximo / 100) : 0;

  // Redondeo
  const multiplo = parseInt(config?.redondeo_precios) || 0;

  const metodosActivos = typeof config?.metodos_pago_activos === 'string'
    ? JSON.parse(config.metodos_pago_activos)
    : (config?.metodos_pago_activos || ['efectivo']);

  const metodos = [
    { id: 'efectivo', label: '💵 Efectivo' },
    { id: 'tarjeta', label: '💳 Tarjeta' },
    { id: 'mercadopago', label: '📱 Mercado Pago' },
    { id: 'transferencia', label: '🏦 Transferencia' },
    { id: 'cuenta_corriente', label: '📋 Cuenta Corriente' },
  ].filter(m => m.id === 'cuenta_corriente' || metodosActivos.includes(m.id));

  useEffect(() => {
    if (metodoPago === 'tarjeta' && config?.recargo_tarjeta > 0) {
      setRecargo((total * config.recargo_tarjeta / 100).toFixed(0));
    } else {
      setRecargo('');
    }
    setRedondeo(0);
  }, [metodoPago]);

  useEffect(() => {
    if (buscarCliente.trim().length > 1) {
      api.get(`/api/clientes?buscar=${buscarCliente}`).then(res => setClientes(res.data)).catch(() => {});
    } else {
      setClientes([]);
    }
  }, [buscarCliente]);

  const totalSinRedondeo = total - montoDescuento + (parseFloat(recargo) || 0);
  const totalFinal = totalSinRedondeo + redondeo;
  const vuelto = metodoPago === 'efectivo' ? (parseFloat(efectivoEntregado) || 0) - totalFinal : 0;

  const aplicarRedondeo = (direccion) => {
    if (!multiplo) return;
    const ajuste = direccion === 'arriba'
      ? Math.ceil(totalSinRedondeo / multiplo) * multiplo - totalSinRedondeo
      : Math.floor(totalSinRedondeo / multiplo) * multiplo - totalSinRedondeo;
    setRedondeo(ajuste);
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
    setCargando(true);
    try {
      await onConfirmar({
        metodoPago,
        descuento: montoDescuento,
        recargo: (parseFloat(recargo) || 0) + redondeo,
        totalFinal,
        clienteId: clienteSeleccionado?.id || null,
        esFiado: metodoPago === 'cuenta_corriente',
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
      

         {/* Descuento + Redondeo en una sola línea */}
          {(tieneDescuentoFijo || multiplo > 0) && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">

              {/* Botón descuento */}
              {tieneDescuentoFijo && (
                <button type="button"
                  onClick={() => { setDescuentoActivo(!descuentoActivo); setRedondeo(0); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${descuentoActivo ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                  Descuento % {config.descuento_maximo}
                  {descuentoActivo && <span className="text-green-100 text-xs">− {fmt(montoDescuento)}</span>}
                </button>
              )}

              {/* Separador */}
              {tieneDescuentoFijo && multiplo > 0 && <div className="w-px h-6 bg-gray-300" />}

              {/* Botones redondeo */}
              {multiplo > 0 && (
                <>
                  <button type="button" onClick={() => aplicarRedondeo('abajo')}
                    className="px-3 py-2 bg-white border border-gray-200 hover:border-gray-400 rounded-lg text-sm font-medium text-gray-700 transition-all">
                    ↓ Bajar
                  </button>
                  <button type="button" onClick={() => aplicarRedondeo('arriba')}
                    className="px-3 py-2 bg-white border border-gray-200 hover:border-gray-400 rounded-lg text-sm font-medium text-gray-700 transition-all">
                    ↑ Subir
                  </button>
                  {redondeo !== 0 && (
                    <button type="button" onClick={() => setRedondeo(0)}
                      className="text-gray-400 hover:text-red-500 text-xl leading-none transition-colors">×</button>
                  )}
                  {redondeo !== 0 && (
                    <span className={`text-sm font-semibold ml-1 ${redondeo > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                      {redondeo > 0 ? '+' : ''}{fmt(redondeo)}
                    </span>
                  )}
                </>
              )}

            </div>
          )}

          {/* Recargo manual (solo si no es tarjeta con recargo automático) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              <p className="text-xs text-gray-400 mb-0.5">Subtotal productos</p>
              <p className="text-lg font-bold text-gray-800">{fmt(total)}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Recargo $</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                <input type="number" value={recargo} onChange={(e) => setRecargo(e.target.value)} min="0"
                  className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="0" />
              </div>
            </div>
          </div>

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
  : '✅ Confirmar Venta [F8]'}
          </button>
        </div>
      </div>
    </div>
  );
});

const ModalVentaExitosa = ({ total, onSeguirVendiendo, onImprimir, config, tieneComprobanteElectronico }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
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
              className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors">
              🛒 Seguir vendiendo
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-emerald-600 to-green-500 text-white rounded-t-3xl">
          <div>
            <h3 className="text-2xl font-bold">💵 Contar Billetes</h3>
            <p className="text-emerald-100 text-sm">F12 · Desglose de efectivo por denominaciones</p>
          </div>
          <button onClick={onCerrar} className="text-white/80 hover:text-white text-3xl leading-none">×</button>
        </div>

        <div className="flex flex-col h-[70vh]">
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
      const fechaApertura = new Date(turno.fecha_apertura);
      const offset = fechaApertura.getTimezoneOffset() * 60000;
      const local = new Date(fechaApertura - offset);
      const desde = local.toISOString().split('T')[0];
      const hasta = desde;
      const res = await api.get(`/api/reportes/historial?fecha_desde=${desde}&fecha_hasta=${hasta}`);
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
    const totalSistema = resumen?.totalVendido || 0;
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
          body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 80mm; max-width: 80mm; padding: 4mm; color: #000; background: #fff; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .grande { font-size: 16px; }
          .small { font-size: 10px; }
          .separador { border-top: 1px dashed #000; margin: 4px 0; }
          .separador-doble { border-top: 2px solid #000; margin: 4px 0; }
          .fila { display: flex; justify-content: space-between; margin: 4px 0; }
          .fila-small { display: flex; justify-content: space-between; margin: 2px 0; font-size: 10px; }
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
        const efectivoDeclaro = parseFloat(datos.efectivo_retirado || 0) + parseFloat(datos.dinero_siguiente || 0);
        const efectivoSistema = resumen.porMetodo?.efectivo || 0;
        const tarjetasDeclaro = parseFloat(datos.total_tarjetas || 0);
        const tarjetasSistema = (resumen.porMetodo?.tarjeta || 0);
        const mpDeclaro = parseFloat(datos.total_mercadopago || 0);
        const mpSistema = (resumen.porMetodo?.mercadopago || 0);
        const transfDeclaro = parseFloat(datos.total_transferencias || 0);
        const transfSistema = (resumen.porMetodo?.transferencia || 0);

        const totalDeclaro = efectivoDeclaro + tarjetasDeclaro + mpDeclaro + transfDeclaro;
        const totalSistema = resumen.totalVendido || 0;
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
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
          <div className="flex flex-col h-full">
            <div className={`p-6 text-white text-center ${ok ? 'bg-green-600' : 'bg-red-500'} rounded-t-3xl`}>
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

            <div className="p-6 pt-0 bg-white border-t border-gray-200 sticky bottom-0">
              <div className="flex flex-col gap-3 md:flex-row">
                <button
                  onClick={imprimirCierre}
                  className="w-full md:w-auto py-3 px-4 border border-gray-300 rounded-2xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  🖨️ Imprimir Cierre
                </button>
                <button onClick={onCerrado}
                  className={`w-full md:flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-lg transition-colors`}
                >
                  Finalizar Turno
                </button>
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
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-red-600 to-red-500 text-white rounded-t-3xl">
            <div>
              <h3 className="text-2xl font-bold">🔒 Cierre de Caja</h3>
              <p className="text-red-100 text-sm">F12 · Finalizar turno y cuadrar caja</p>
            </div>
            <button onClick={onCerrar} className="text-white/80 hover:text-white text-3xl leading-none">×</button>
          </div>

          <div className="flex max-h-[84vh] overflow-hidden">
            {/* Panel Izquierdo: Resumen del Turno */}
            <div className="w-1/2 p-6 border-r bg-gradient-to-br from-gray-50 to-white overflow-y-auto min-h-0">
              <div className="h-full flex flex-col">
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
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🔐</div>
                      <p className="text-gray-600 mb-4">Información protegida por PIN</p>
                      <button
                        onClick={() => setMostrarPinModal(true)}
                        className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
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

                    {/* Gráfico de torta */}
                    {datosGrafico.length > 0 && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200 flex-1">
                        <h5 className="font-medium text-gray-700 mb-3 text-center">📈 Distribución de Pagos</h5>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={datosGrafico}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={80}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {datosGrafico.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => fmt(value)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <div className="animate-spin text-4xl mb-2">⏳</div>
                      <p>Cargando resumen...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Derecho: Comprobantes y Validación */}
            <div className="w-1/2 p-6 flex flex-col overflow-y-auto min-h-0">
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
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
  const [buscar, setBuscar] = useState('');
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [formPago, setFormPago] = useState({ monto: '', metodo_pago: 'efectivo', nota: '' });
  const [cargando, setCargando] = useState(true);
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');

  const fmtLocal = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);

  useEffect(() => { cargarClientes(); }, [buscar]);

  const cargarClientes = async () => {
    try {
      setCargando(true);
      const res = await api.get(`/api/clientes${buscar ? `?buscar=${buscar}` : ''}`);
      setClientes(res.data.filter(c => parseFloat(c.saldo_deuda) > 0));
    } catch { } finally { setCargando(false); }
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b text-white rounded-t-2xl" style={{ backgroundColor: 'var(--color-primario)' }}>
          <div>
            <h3 className="text-lg font-bold">👥 Fiados</h3>
            <p className="text-white text-opacity-80 text-sm">F3 · Cobrar deudas</p>
          </div>
          <button onClick={onCerrar} className="text-white text-opacity-80 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl text-sm">{exito}</div>}
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
                  <p className="text-4xl mb-2">✅</p>
                  <p className="font-medium">No hay deudas pendientes</p>
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
                            {c.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{c.nombre}</p>
                            <p className="text-xs text-gray-500">{c.telefono || 'Sin teléfono'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">DEBE</p>
                          <p className="font-bold text-red-500">{fmtLocal(c.saldo_deuda)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={registrarPago} className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: 'var(--color-primario)' }}>
                    {clienteSeleccionado.nombre.charAt(0).toUpperCase()}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto a pagar *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input type="number" value={formPago.monto} onChange={(e) => setFormPago(p => ({ ...p, monto: e.target.value }))}
                    required autoFocus min="0"
                    className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-lg focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="0" />
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setFormPago(p => ({ ...p, monto: (parseFloat(clienteSeleccionado.saldo_deuda) / 2).toFixed(0) }))}
                    className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-colors">50% de la deuda</button>
                  <button type="button" onClick={() => setFormPago(p => ({ ...p, monto: clienteSeleccionado.saldo_deuda }))}
                    className="flex-1 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors">Pago Total</button>
                </div>
              </div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
                <input type="text" value={formPago.nota} onChange={(e) => setFormPago(p => ({ ...p, nota: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Ej: Pago parcial..." />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setClienteSeleccionado(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit"
                  style={{ backgroundColor: 'var(--color-primario)' }}
                  className="flex-1 py-2.5 text-white rounded-xl font-bold transition-colors">✅ Confirmar Pago</button>
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
  const { logout } = useAuth();
  const { online, sincronizando, pendientes, ultimaSincronizacion, agregarVentaOffline } = useConectividad();
  const modalVentaRef = useRef(null);
  const [turno, setTurno] = useState(null);
  const [cajasAbiertas, setCajasAbiertas] = useState([]);
  const [cargandoTurno, setCargandoTurno] = useState(true);
  const [config, setConfig] = useState(null);
  const [productos, setProductos] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [ordenar, setOrdenar] = useState('nombre');
  const [mostrarModalGasto, setMostrarModalGasto] = useState(false);
  const [mostrarModalFiados, setMostrarModalFiados] = useState(false);
  const [mostrarModalVenta, setMostrarModalVenta] = useState(false);
  const [mostrarModalCierre, setMostrarModalCierre] = useState(false);
  const [mostrarModalRapida, setMostrarModalRapida] = useState(false);
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
  const [ventaExitosa, setVentaExitosa] = useState(false);
  const [mensajeScanner, setMensajeScanner] = useState(null);
  const [ultimaVenta, setUltimaVenta] = useState(null);
  const [mostrarModalVentaProducto, setMostrarModalVentaProducto] = useState(null);
  const [totalUltimaVenta, setTotalUltimaVenta] = useState(0);
  const [editandoCantidad, setEditandoCantidad] = useState(null);

  // Estados para facturación electrónica (se resetean por venta)
  const [facturacionElectronica, setFacturacionElectronica] = useState(false);
  const [tipoComprobante, setTipoComprobante] = useState(0);
  const [tipoDocumento, setTipoDocumento] = useState(99);
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [denominacionComprador, setDenominacionComprador] = useState('');
 const [tiposComprobante, setTiposComprobante] = useState([]);
  const [ultimoComprobante, setUltimoComprobante] = useState(null);
  const [mostrarComprobanteElectronico, setMostrarComprobanteElectronico] = useState(false);

  const [pestanas, setPestanas] = useState(() => {
    try { const g = localStorage.getItem('pos_pestanas'); return g ? JSON.parse(g) : [{ id: 1, nombre: 'Venta 1', carrito: [] }]; }
    catch { return [{ id: 1, nombre: 'Venta 1', carrito: [] }]; }
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
  const carritoActivo = pestanas.find(p => p.id === pestanaActiva)?.carrito || [];

  // Función para resetear estados de facturación electrónica
  const resetearFacturacion = (mantenerComprobante = false) => {
    setFacturacionElectronica(false);
    setTipoComprobante('');
    setTipoDocumento(99);
    setNumeroDocumento('');
    setDenominacionComprador('');
    setTiposComprobante([]);
    if (!mantenerComprobante) setUltimoComprobante(null);
  };

  useEffect(() => { verificarTurno(); cargarConfig(); }, []);
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
      try {
        const res = await api.get(`/api/productos?buscar=${terminoBuscado}`);
        // Solo actualizar si el término no cambió mientras esperábamos la respuesta
        if (terminoBuscado === buscar.trim()) {
          const resultados = res.data;
          setProductos(resultados);
          if (resultados.length === 1) agregarAlCarrito(resultados[0]);
        }
      } catch { }
    }, 400);

    return () => clearTimeout(timer);
  }, [buscar]);

    

  // ---- ATAJOS DE TECLADO ----
  useEffect(() => {
    const hayModalAbierto = mostrarModalVenta || mostrarModalGasto || mostrarModalCierre || mostrarModalRapida || mostrarModalFiados || mostrarModalHistorial;

    const manejarTeclado = (e) => {
      // Teclas F - siempre activas aunque haya modal
      if (e.key === 'F1') { e.preventDefault(); setMostrarModalRapida(true); return; }
      if (e.key === 'F2') { e.preventDefault(); inputBuscarRef.current?.focus(); return; }
      if (e.key === 'F3') { e.preventDefault(); setMostrarModalFiados(true); return; }
      if (e.key === 'F4') { e.preventDefault(); setMostrarModalCierre(true); return; }
      if (e.key === 'F5') { e.preventDefault(); setMostrarModalHistorial(true); return; }
      if (e.key === 'F8') { 
        e.preventDefault(); 
        if (mostrarModalVenta && modalVentaRef.current) {
          modalVentaRef.current.confirmar();
        } else if (carritoActivo.length > 0) {
          setMostrarModalVenta(true);
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
  }, [mostrarModalVenta, mostrarModalGasto, mostrarModalCierre, mostrarModalRapida, mostrarModalFiados, mostrarModalHistorial, pestanaActiva, pestanas, carritoActivo]);

 const buscarPorCodigoScanner = async (codigo) => {
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
        const resCajas = await api.get('/api/turnos/abiertas');
        setCajasAbiertas(resCajas.data);
      }
    } catch { } finally { setCargandoTurno(false); }
  };

  const cargarConfig = async () => {
    try { const res = await api.get('/api/configuracion'); setConfig(res.data); } catch { }
  };

  const cargarProductos = async () => {
    try { const res = await api.get(`/api/productos?buscar=${buscar}`); setProductos(res.data); } catch { }
  };

  const productosOrdenados = [...productos].sort((a, b) => {
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
  const agregarAlCarrito = useCallback((producto) => {
    // Verificar si el producto no es de unidad (es decir, tiene unidad kg, lt, mt)
    const unidadesNoUnitarias = ['kg', 'lt', 'mt'];
    const esUnidadNoUnitaria = unidadesNoUnitarias.includes(producto.unidad.toLowerCase());
    
    if (esUnidadNoUnitaria) {
      // Abrir el modal para vender por peso/cantidad
      setMostrarModalVentaProducto(producto);
      return;
    }
    
    // Lógica normal para productos de unidad
    setPestanas(prev => prev.map(p => {
      if (p.id !== pestanaActiva) return p;
      const precioUnitario = parseFloat(producto.precio_venta);
      const existe = p.carrito.find(item => item.producto_id === producto.id);
      
      if (existe) {
        // Incrementar cantidad del producto existente
        return {
          ...p,
          carrito: p.carrito.map(item =>
            item.producto_id === producto.id
              ? {
                  ...item,
                  cantidad: item.cantidad + 1,
                  subtotal: (item.cantidad + 1) * precioUnitario
                }
              : item
          )
        };
      }
      
      // Agregar nuevo producto al carrito
      return {
        ...p,
        carrito: [
          ...p.carrito,
          {
            producto_id: producto.id,
            nombre_producto: producto.nombre,
            precio_unitario: precioUnitario,
            cantidad: 1,
            subtotal: precioUnitario
          }
        ]
      };
    }));
    
    // Limpiar búsqueda y enfocar input
    setBuscar('');
    setProductos([]);
    setTimeout(() => inputBuscarRef.current?.focus(), 50);
  }, [pestanaActiva]);

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
    if (nuevaCantidad <= 0) {
      // Eliminar producto si la cantidad es 0 o menor
      actualizarCarritoPestana(carritoActivo.filter(item => item.producto_id !== productoId));
      return;
    }
    
    // Actualizar cantidad y subtotal del producto
    actualizarCarritoPestana(carritoActivo.map(item =>
      item.producto_id === productoId 
        ? { 
            ...item, 
            cantidad: nuevaCantidad, 
            subtotal: nuevaCantidad * item.precio_unitario 
          } 
        : item
    ));
  };

  /**
   * Elimina un producto del carrito
   * @param {string|number} productoId - ID del producto a eliminar
   */
  const eliminarDelCarrito = (productoId) => {
    actualizarCarritoPestana(carritoActivo.filter(item => item.producto_id !== productoId));
  };

  /**
   * Limpia completamente el carrito de la pestaña activa
   */
  const limpiarCarrito = () => {
    actualizarCarritoPestana([]);
  };

  /**
   * Calcula el total del carrito activo
   * @returns {number} Total del carrito
   */
  const total = carritoActivo.reduce((acc, item) => acc + item.subtotal, 0);

  const confirmarVenta = async ({ metodoPago, descuento, recargo, totalFinal, clienteId, esFiado }) => {
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
    };

    // ---- MODO OFFLINE ----
    if (!online) {
      agregarVentaOffline(ventaPayload);

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
      inputBuscarRef.current?.focus();
      return;
    }

    // ---- MODO ONLINE (comportamiento normal) ----
    try {
      const resVenta = await api.post('/api/ventas', ventaPayload);

      // Si es facturación electrónica, emitir comprobante
      if (facturacionElectronica && resVenta?.data?.id) {
        try {
          const comprobanteData = {
            venta_id: resVenta.data.id,
            tipo_comprobante: tipoComprobante,
            punto_venta: config?.punto_venta_arca || 1,
            tipo_documento: tipoDocumento,
            numero_documento: numeroDocumento || null,
            denominacion_comprador: denominacionComprador || null,
            importe_total: parseFloat(totalFinal),
// Factura C (monotributista): IVA = 0, neto = total
// Factura A/B (responsable inscripto): IVA = 21%
importe_neto: (tipoComprobante === 11 || tipoComprobante === 13 || tipoComprobante === 12)
    ? parseFloat(totalFinal)                           // Factura C: neto = total (sin IVA)
    : parseFloat((totalFinal / 1.21).toFixed(2)),      // Factura A/B: neto = total / 1.21
importe_iva: (tipoComprobante === 11 || tipoComprobante === 13 || tipoComprobante === 12)
    ? 0                                                // Factura C: sin IVA
    : parseFloat((totalFinal - totalFinal / 1.21).toFixed(2)), // Factura A/B: IVA = total - neto
          };

          const resComprobante = await api.post('/api/arca/emitir', comprobanteData);
          
          if (resComprobante.data.exito) {
            console.log('✅ Comprobante electrónico emitido:', resComprobante.data.comprobante.cae);
            setUltimoComprobante(resComprobante.data.comprobante);
          }
        } catch (errArca) {
          console.error('⚠️ Error al emitir comprobante ARCA:', errArca);
          // No detener el flujo, la venta ya se registró
        }
      }

      // Obtener items completos para el ticket
      if (resVenta?.data?.id) {
        try {
          const ventaCompleta = await api.get(`/api/ventas/${resVenta.data.id}`);
          setUltimaVenta(ventaCompleta.data);
        } catch { setUltimaVenta(null); }
      }

      const nuevoNumero = contadorVentas + 1;
      setContadorVentas(nuevoNumero);
      setPestanas(prev => prev.map(p =>
        p.id === pestanaActiva ? { ...p, nombre: `Venta ${nuevoNumero}`, carrito: [] } : p
      ));
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

  const oscuro = config?.modo_oscuro !== false;

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
    return (
      <ModalSeleccionCaja cajasAbiertas={cajasAbiertas}
        onAbrir={async (nombre, inicioCaja) => {
          try { const res = await api.post('/api/turnos/abrir', { nombre, inicio_caja: inicioCaja }); setTurno(res.data); }
          catch (err) { alert(err.response?.data?.error || 'Error al abrir caja'); }
        }}
        onUnirse={async (turnoId) => {
          try { const res = await api.post(`/api/turnos/${turnoId}/unirse`); setTurno(res.data); }
          catch (err) { alert(err.response?.data?.error || 'Error al unirse a la caja'); }
        }}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: oscuro ? '#0f0f1a' : '#f1f5f9' }}>

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
      <div className="bg-gray-900 text-white flex-shrink-0 border-b border-gray-700 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-2">

        {/* Logo/Brand */}
        <div className="flex items-center gap-2 mr-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg"
            style={{ backgroundColor: 'var(--color-primario)' }}>S</div>
          <span className="text-sm font-semibold text-gray-300 hidden lg:block">POS</span>
        </div>

        <div className="w-px h-7 bg-gray-700 mr-2" />

        {/* Botones principales */}
        <button onClick={() => setMostrarModalRapida(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm">
          ⚡ Rápida
          <span className="text-purple-300 text-xs hidden lg:inline">[F1]</span>
        </button>

        <button onClick={() => setMostrarModalFiados(true)}
          style={{ backgroundColor: 'var(--color-primario)' }}
          className="flex items-center gap-2 hover:opacity-80 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm">
          👥 Fiados
          <span className="text-white text-opacity-60 text-xs hidden lg:inline">[F3]</span>
        </button>

        <button onClick={() => setMostrarModalHistorial(true)}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm">
          📋 Historial
          <span className="text-gray-400 text-xs hidden lg:inline">[F5]</span>
        </button>

        <button onClick={() => setMostrarModalGasto(true)}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm">
          💸 Gastos
          <span className="text-amber-200 text-xs hidden lg:inline">[F10]</span>
        </button>

        <button onClick={() => setMostrarModalCierre(true)}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm">
          🔒 Cierre
          <span className="text-red-300 text-xs hidden lg:inline">[F4]</span>
        </button>

        <button onClick={() => navigate('/admin')}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm">
          ⚙️ Admin
        </button>

        <button onClick={logout}
          className="flex items-center gap-2 bg-gray-800 hover:bg-red-800 border border-gray-600 hover:border-red-600 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm">
          🚪 Salir
        </button>

        {/* Status derecha */}
        <div className="ml-auto flex items-center gap-3">
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

          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-gray-300">{turno?.nombre || 'Caja'}</span>
          </div>
        </div>
      </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ---- PANEL IZQUIERDO: BÚSQUEDA ---- */}
       <div className="w-80 lg:w-96 flex flex-col flex-shrink-0" style={estilos.panelBusqueda}>

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
                {[{ id: 'nombre', label: 'A-Z' }, { id: 'precio_asc', label: '$ ↑' }, { id: 'precio_desc', label: '$ ↓' }].map(o => (
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
                <div className="w-full space-y-1.5">
                  <p className="text-xs mb-2 uppercase tracking-widest" style={{ color: oscuro ? 'rgba(255,255,255,0.2)' : '#94a3b8' }}>Atajos de teclado</p>
                  {[
                    { key: 'F1', label: 'Venta Rápida', color: '#7c3aed', bg: 'rgba(124,58,237,0.15)' },
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
                        {producto.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight" style={{ color: oscuro ? 'rgba(255,255,255,0.9)' : '#111827' }}>
                          {producto.nombre}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: oscuro ? 'rgba(255,255,255,0.3)' : '#9ca3af' }}>{producto.categoria_nombre || 'Sin categoría'}</p>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <p className="font-bold text-sm" style={{ color: 'var(--color-primario)' }}>{fmt(producto.precio_venta)}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: stockColor, background: stockBg }}>
                          {sinStock ? 'Sin stock' : `${producto.stock} ${producto.unidad}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ---- PANEL DERECHO: CARRITO ---- */}
       <div className="flex-1 flex flex-col overflow-hidden" style={{ background: estilos.fondoFooter }}>

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
                <div className="mt-5 flex gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-lg font-mono" style={estilos.textoSecundario}>F8 confirmar</span>
                  <span className="text-xs px-2.5 py-1 rounded-lg font-mono" style={estilos.textoSecundario}>F9 limpiar</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-w-2xl mx-auto">
                {carritoActivo.map((item, idx) => (
               <div key={item.producto_id}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
                  style={{ ...estilos.itemCarrito, animationDelay: `${idx * 30}ms` }}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${item.esRapida ? 'bg-purple-500 bg-opacity-20 text-purple-300' : 'text-white'}`}
                      style={!item.esRapida ? { backgroundColor: 'var(--color-primario)' } : {}}>
                      {item.esRapida ? '⚡' : item.nombre_producto.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-sm leading-tight" style={estilos.textoItemCarrito}>{item.nombre_producto}</p>
                      <p className="text-xs mt-0.5" style={estilos.textoItemSecundario}>{fmt(item.precio_unitario)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => cambiarCantidad(item.producto_id, item.cantidad - 1)}
                        className="w-7 h-7 rounded-lg font-bold text-sm transition-all hover:scale-105 active:scale-95"
                        style={estilos.botonCantidad}>−</button>
                      {editandoCantidad === item.producto_id ? (
                        <input
                          type="number" min="1" autoFocus
                          defaultValue={item.cantidad}
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
                          onClick={() => setEditandoCantidad(item.producto_id)}
                          className="w-10 h-7 rounded-lg font-bold text-sm transition-all hover:bg-white hover:bg-opacity-10"
                          style={estilos.textoItemCarrito}
                          title="Click para editar cantidad">
                          {item.cantidad}
                        </button>
                      )}
                      <button onClick={() => cambiarCantidad(item.producto_id, item.cantidad + 1)}
                        className="w-7 h-7 rounded-lg font-bold text-sm transition-all hover:scale-105 active:scale-95"
                        style={estilos.botonCantidad}>+</button>
                    </div>
                      <div className="text-right flex-shrink-0 w-20">
                      <p className="font-bold text-sm" style={estilos.textoItemCarrito}>{fmt(item.subtotal)}</p>
                    </div>
                    <button onClick={() => eliminarDelCarrito(item.producto_id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0 text-xs hover:scale-110"
                      style={estilos.botonBasura}
                      title="Quitar del carrito">
                      ✕
                    </button>
                  </div>
                ))}
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

              {/* Total con animación visual */}
              <div className="flex justify-between items-end mb-3">
                <span className="text-sm font-medium" style={{ color: estilos.textoTotal }}>Total a cobrar</span>
                <span className={`font-bold transition-all ${carritoActivo.length > 0 ? 'text-4xl' : 'text-2xl opacity-40'}`}
                  style={{ color: carritoActivo.length > 0 ? estilos.textoTotalMonto : estilos.textoTotal }}>
                  {fmt(total)}
                </span>
              </div>

              {/* Botón confirmar */}
              <button onClick={() => setMostrarModalVenta(true)} disabled={carritoActivo.length === 0}
                style={carritoActivo.length > 0 ? { backgroundColor: 'var(--color-primario)' } : {}}
                className="w-full disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40 text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-lg disabled:shadow-none hover:opacity-90 active:scale-98">
                {carritoActivo.length > 0 ? '✅ Confirmar Venta [F8]' : 'Agregá productos para vender'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- MODALES ---- */}
      {mostrarModalGasto && (
        <ModalGasto onCerrar={() => { setMostrarModalGasto(false); inputBuscarRef.current?.focus(); }}
          onGuardado={() => setMostrarModalGasto(false)} />
      )}
      {mostrarModalVenta && (
        <ModalConfirmarVenta 
          ref={modalVentaRef}
          carrito={carritoActivo} 
          total={total} 
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
            setTurno(null);
            setPestanas([{ id: 1, nombre: 'Venta 1', carrito: [] }]);
            setPestanaActiva(1); setContadorVentas(1);
            localStorage.removeItem('pos_pestanas');
            localStorage.removeItem('pos_pestana_activa');
            localStorage.removeItem('pos_contador_ventas');
            setMostrarModalCierre(false);
            api.get('/api/turnos/abiertas').then(res => { setCajasAbiertas(res.data); });
          }} />
      )}
      {mostrarModalRapida && (
        <ModalVentaRapida onAgregar={agregarVentaRapida}
          onCerrar={() => { setMostrarModalRapida(false); inputBuscarRef.current?.focus(); }} />
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