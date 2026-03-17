import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ModalGasto } from '../components/admin/Gastos';
import ModalDetalleVenta from '../components/admin/DetalleVenta';
import { imprimirTicket } from '../components/ticket';

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
function ModalHistorial({ turno, onCerrar }) {
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [detalleVenta, setDetalleVenta] = useState(null);

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
      const res = await api.get(`/api/ventas/${venta.id}/ticket`);
      imprimirTicket({
        venta: res.data,
        items: res.data.items,
        config,
      });
    } catch (err) {
      alert('Error al reimprimir ticket');
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
                <div key={venta.id} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => cargarDetalleVenta(venta.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-100 text-green-700 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">
                      #{venta.id}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {venta.metodo_pago === 'efectivo' ? '💵' : venta.metodo_pago === 'tarjeta' ? '💳' : venta.metodo_pago === 'mercadopago' ? '📱' : '🏦'} {venta.metodo_pago}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(venta.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        {venta.es_fiado && <span className="ml-2 bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-xs">Fiado</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={(e) => {
                      e.stopPropagation();
                      reimprimirTicket(venta);
                    }}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors">
                      🖨️ Reimprimir
                    </button>
                    <button onClick={(e) => {
                      e.stopPropagation();
                      eliminarVenta(venta.id, venta.total);
                    }}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors">
                      🗑️ Eliminar
                    </button>
                  </div>
                  <p className="font-bold text-gray-800">{fmt(venta.total)}</p>
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
function ModalConfirmarVenta({ carrito, total, config, turno, onConfirmar, onCerrar }) {
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [descuento, setDescuento] = useState('');
  const [recargo, setRecargo] = useState('');
  const [efectivoEntregado, setEfectivoEntregado] = useState('');
  const [cargando, setCargando] = useState(false);
  const [buscarCliente, setBuscarCliente] = useState('');
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [mostrarFormNuevoCliente, setMostrarFormNuevoCliente] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('');
  const [nuevoClienteTel, setNuevoClienteTel] = useState('');

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
  }, [metodoPago]);

  useEffect(() => {
    if (buscarCliente.trim().length > 1) {
      api.get(`/api/clientes?buscar=${buscarCliente}`).then(res => setClientes(res.data)).catch(() => {});
    } else {
      setClientes([]);
    }
  }, [buscarCliente]);

  const totalFinal = total - (parseFloat(descuento) || 0) + (parseFloat(recargo) || 0);
  const vuelto = metodoPago === 'efectivo' ? (parseFloat(efectivoEntregado) || 0) - totalFinal : 0;

  const confirmar = async () => {
    if (metodoPago === 'cuenta_corriente' && !clienteSeleccionado) {
      alert('Seleccioná un cliente para la cuenta corriente');
      return;
    }
    setCargando(true);
    try {
      await onConfirmar({
        metodoPago, descuento: parseFloat(descuento) || 0,
        recargo: parseFloat(recargo) || 0, totalFinal,
        clienteId: clienteSeleccionado?.id || null,
        esFiado: metodoPago === 'cuenta_corriente',
      });
    } finally { setCargando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b bg-gray-800 text-white">
          <div>
            <h3 className="text-xl font-bold">💳 Confirmar Venta</h3>
            <p className="text-gray-400 text-sm">F8 para confirmar · Esc para cancelar</p>
          </div>
          <button onClick={onCerrar} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-6 space-y-5">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descuento $</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                <input type="number" value={descuento} onChange={(e) => setDescuento(e.target.value)} min="0"
                  className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recargo $</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
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
        <div className="flex gap-4 p-6 pt-0">
          <button onClick={onCerrar} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={cargando}
            style={{ backgroundColor: 'var(--color-primario)' }}
            className="flex-grow py-3 text-white rounded-xl font-bold text-lg transition-colors disabled:opacity-50">
            {cargando ? 'Procesando...' : '✅ Confirmar [F8]'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// MODAL: CIERRE DE CAJA
// =============================================
function ModalContarBilletes({ onCerrar, onConfirmar }) {
  const BILLETES = [100, 200, 500, 1000, 2000, 10000, 20000];
  const [cantidades, setCantidades] = useState({});

  const total = BILLETES.reduce((acc, b) => acc + (parseInt(cantidades[b] || 0) * b), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💵</span>
              </div>
              <div>
                <h3 className="text-lg font-bold">Contar Billetes</h3>
                <p className="text-gray-200 text-sm">Ingresá la cantidad de cada billete</p>
              </div>
            </div>
          </div>
          <button onClick={onCerrar} className="text-gray-300 hover:text-white text-2xl transition-colors">×</button>
        </div>
        
        <div className="p-6">
          <div className="space-y-3">
            {BILLETES.map(b => (
              <div key={b} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-800">
                      ${b >= 1000 ? (b / 1000) + '.000' : b}
                    </span>
                    <span className="text-gray-500 text-sm">×</span>
                    <input type="number" min="0"
                      value={cantidades[b] || ''}
                      onChange={(e) => setCantidades(p => ({ ...p, [b]: e.target.value }))}
                      className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 text-center font-medium"
                      placeholder="0" />
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-800">{fmt((parseInt(cantidades[b] || 0) * b))}</p>
                    <p className="text-xs text-gray-500">Subtotal</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-800">Total contado</span>
              <span className="text-2xl font-bold text-gray-900">{fmt(total)}</span>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-gray-50 border-t">
          <div className="flex gap-3">
            <button onClick={onCerrar}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors font-semibold">
              Cancelar
            </button>
            <button onClick={() => onConfirmar(total)}
              className="flex-1 py-3 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl font-semibold hover:from-gray-900 hover:to-black transition-all shadow-lg">
              ✅ Usar {fmt(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalCierreCaja({ turno, onCerrar, onCerrado }) {
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
  const [mostrarContarBilletes, setMostrarContarBilletes] = useState(false);
  const [resultadoCierre, setResultadoCierre] = useState(null);
  const [mostrarPin, setMostrarPin] = useState(false);

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

  const revelarInfo = () => {
    const pinConfig = config?.pin_cierre;
    if (!pinConfig || pinIngresado === String(pinConfig)) {
      setInfoRevelada(true);
      setErrorPin('');
    } else {
      setErrorPin('PIN incorrecto');
      setTimeout(() => setErrorPin(''), 2000);
    }
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

  // Pantalla de resultado
  if (resultadoCierre) {
    const ok = Math.abs(resultadoCierre.diferencia) < 1;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className={`p-6 text-white text-center ${ok ? 'bg-green-600' : 'bg-red-500'}`}>
            <p className="text-5xl mb-3">{ok ? '✅' : '⚠️'}</p>
            <h3 className="text-2xl font-bold">{ok ? '¡Cierre perfecto!' : 'Hay diferencias'}</h3>
            <p className="text-white text-opacity-80 mt-1 text-sm">
              {ok ? 'Los valores coinciden exactamente' : 'Los valores no coinciden con el sistema'}
            </p>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Vos declaraste</p>
                <p className="text-xl font-bold text-gray-800">{fmt(resultadoCierre.totalDeclaro)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Sistema registró</p>
                <p className="text-xl font-bold text-gray-800">{fmt(resultadoCierre.totalSistema)}</p>
              </div>
            </div>

            {!ok && (
              <>
                <div className={`rounded-xl p-4 text-center ${resultadoCierre.diferencia > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className="text-sm font-medium text-gray-600">Diferencia</p>
                  <p className={`text-3xl font-bold ${resultadoCierre.diferencia > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {resultadoCierre.diferencia > 0 ? '+' : ''}{fmt(resultadoCierre.diferencia)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {resultadoCierre.diferencia > 0 ? '📈 Sobrante en caja' : '📉 Faltante en caja'}
                  </p>
                </div>

                <div className="space-y-2">
                  {[
                    ['💵 Efectivo', resultadoCierre.efectivo],
                    ['💳 Tarjetas', resultadoCierre.tarjetas],
                    ['📱 Mercado Pago', resultadoCierre.mp],
                    ['🏦 Transferencias', resultadoCierre.transf],
                  ].map(([label, vals]) => vals.diff !== 0 && (
                    <div key={label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                      <span className="text-gray-600">{label}</span>
                      <div className="text-right">
                        <span className="text-gray-400 text-xs">{fmt(vals.declaro)} declarado vs {fmt(vals.sistema)} sistema</span>
                        <span className={`ml-2 font-bold ${vals.diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {vals.diff > 0 ? '+' : ''}{fmt(vals.diff)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="p-5 pt-0">
            <button onClick={onCerrado}
              className={`w-full py-3 text-white rounded-xl font-bold transition-colors ${ok ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-800 hover:bg-gray-900'}`}>
              Finalizar Turno
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-900 to-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform transition-all duration-500 hover:scale-105">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-gradient-to-r from-gray-800 to-gray-900 text-white z-10 rounded-t-[28px]">
          <div>
            <h3 className="text-xl font-bold">🔒 Cierre de Caja</h3>
            {turno?.nombre && <p className="text-sm text-gray-200 mt-1">Caja: {turno.nombre} · F4</p>}
          </div>
          <button onClick={onCerrar} className="text-gray-300 hover:text-white text-3xl transition-all duration-200 hover:scale-110">×</button>
        </div>

        <form onSubmit={cerrar} className="p-5 space-y-6">

          {/* Arqueo de efectivo */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">💵 Arqueo de Efectivo</h4>
              <button type="button" onClick={() => setMostrarContarBilletes(true)}
                className="text-xs bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-white px-3 py-1.5 rounded-lg transition-all duration-200 transform hover:scale-105 font-medium shadow-lg">
                🧮 Contar Billetes
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="group">
                <label className="block text-xs font-medium text-gray-300 mb-2">Efectivo a retirar *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                  <input type="number" value={datos.efectivo_retirado}
                    onChange={(e) => setDatos(p => ({ ...p, efectivo_retirado: e.target.value }))}
                    className="w-full bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 rounded-xl pl-7 pr-3 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 group-hover:border-gray-500"
                    placeholder="0" />
                </div>
              </div>
              <div className="group">
                <label className="block text-xs font-medium text-gray-300 mb-2">Para siguiente turno *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                  <input type="number" value={datos.dinero_siguiente}
                    onChange={(e) => setDatos(p => ({ ...p, dinero_siguiente: e.target.value }))}
                    className="w-full bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 rounded-xl pl-7 pr-3 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 group-hover:border-gray-500"
                    placeholder="0" />
                </div>
              </div>
            </div>
          </div>

          {/* Comprobantes virtuales */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 border border-gray-700">
            <h4 className="text-sm font-semibold text-gray-200 uppercase mb-3 tracking-wide">🧾 Comprobantes Virtuales *</h4>
            <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-800/40 rounded-xl p-3 mb-4">
              <p className="text-xs text-blue-200">💡 Ingresá los comprobantes de ventas/cobros recibidos por métodos virtuales</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[['total_tarjetas', '💳 Tarjetas'], ['total_mercadopago', '📱 Mercado Pago'], ['total_transferencias', '🏦 Transferencias']].map(([key, label]) => (
                <div key={key} className="group">
                  <label className="block text-xs font-medium text-gray-300 mb-2">{label} *</label>
                  <div className="relative">
                    <span className="absolute left-2 top-2.5 text-gray-400 text-sm">$</span>
                    <input type="number" value={datos[key]}
                      onChange={(e) => setDatos(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 rounded-xl pl-6 pr-2 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all duration-200 group-hover:border-gray-500"
                      placeholder="0" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PIN para revelar info — solo si está configurado */}
          {config?.pin_cierre && !infoRevelada && (
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 border border-gray-700 text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-gray-700 to-gray-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🔐</span>
              </div>
              <p className="text-white font-bold text-base mb-1">Información Protegida</p>
              <p className="text-gray-300 text-sm mb-4">Completá el arqueo sin ver los datos del sistema</p>
              <div className="flex gap-3 max-w-xs mx-auto">
                <div className="relative flex-1">
                  <input
                    type={mostrarPin ? 'text' : 'password'}
                    value={pinIngresado}
                    onChange={(e) => setPinIngresado(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && revelarInfo()}
                    className="w-full bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="••••"
                    maxLength={6} />
                  <button type="button" onClick={() => setMostrarPin(!mostrarPin)}
                    className="absolute right-2 top-2 text-gray-400 text-sm">
                    {mostrarPin ? '🙈' : '👁️'}
                  </button>
                </div>
                <button type="button" onClick={revelarInfo}
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl font-medium text-sm transition-all transform hover:scale-105 shadow-lg">
                  Ver
                </button>
              </div>
              {errorPin && <p className="text-red-400 text-xs mt-2">{errorPin}</p>}
            </div>
          )}

          {/* Resumen del sistema — solo si se reveló */}
          {infoRevelada && resumen && (
            <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-800/40 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-600">🔓</span>
                <h4 className="text-sm font-semibold text-green-700 uppercase tracking-wide">Resumen del Sistema</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[['Total Ventas', fmt(resumen.totalVendido), 'text-green-700'], ['Cantidad', resumen.totalVentas, 'text-gray-800'], ['Efectivo', fmt(resumen.porMetodo?.efectivo || 0), 'text-gray-700'], ['Tarjeta + MP', fmt((resumen.porMetodo?.tarjeta || 0) + (resumen.porMetodo?.mercadopago || 0)), 'text-gray-700']].map(([label, valor, color]) => (
                  <div key={label} className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-3 text-center border border-green-100 shadow-sm">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{valor}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comentarios */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios (opcional)</label>
            <textarea value={datos.comentarios}
              onChange={(e) => setDatos(p => ({ ...p, comentarios: e.target.value }))}
              rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
              placeholder="Notas sobre el cierre..." />
          </div>

          {!camposCompletos() && (
            <p className="text-xs text-gray-400 text-center">* Completá todos los campos obligatorios para cerrar</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onCerrar}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={cargando || !camposCompletos()}
              className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {cargando ? 'Cerrando...' : '🔒 Confirmar Cierre'}
            </button>
          </div>
        </form>
      </div>

      {mostrarContarBilletes && (
        <ModalContarBilletes
          onCerrar={() => setMostrarContarBilletes(false)}
          onConfirmar={(total) => {
            setDatos(p => ({ ...p, efectivo_retirado: total.toString() }));
            setMostrarContarBilletes(false);
          }}
        />
      )}
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
function POS() {
  const navigate = useNavigate();
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

  useEffect(() => { verificarTurno(); cargarConfig(); }, []);
  useEffect(() => { localStorage.setItem('pos_pestanas', JSON.stringify(pestanas)); }, [pestanas]);
  useEffect(() => { localStorage.setItem('pos_pestana_activa', pestanaActiva.toString()); }, [pestanaActiva]);
  useEffect(() => { localStorage.setItem('pos_contador_ventas', contadorVentas.toString()); }, [contadorVentas]);

  useEffect(() => {
    if (buscar.trim().length > 0) {
      const timer = setTimeout(async () => {
        try {
          const res = await api.get(`/api/productos?buscar=${buscar}`);
          const resultados = res.data;
          setProductos(resultados);
          if (resultados.length === 1) agregarAlCarrito(resultados[0]);
        } catch { }
      }, 400);
      return () => clearTimeout(timer);
    } else { setProductos([]); }
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
      if (e.key === 'F8') { e.preventDefault(); if (carritoActivo.length > 0) setMostrarModalVenta(true); return; }
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
      const res = await api.get(`/api/productos?buscar=${codigo}`);
      const prods = res.data;
      if (prods.length === 0) {
        setMensajeScanner({ tipo: 'error', texto: `❌ No encontrado: ${codigo}` });
        setTimeout(() => setMensajeScanner(null), 2500);
        return;
      }
      let producto = prods.find(p => p.codigo?.toLowerCase() === codigo.toLowerCase());
      if (!producto) {
        for (const p of prods) {
          try {
            const resCodigos = await api.get(`/api/productos/${p.id}/codigos`);
            if (resCodigos.data.some(c => c.codigo?.toLowerCase() === codigo.toLowerCase())) { producto = p; break; }
          } catch { continue; }
        }
      }
      if (!producto && prods.length === 1) producto = prods[0];
      if (producto) {
        agregarAlCarrito(producto);
        setMensajeScanner({ tipo: 'ok', texto: `✅ ${producto.nombre}` });
      } else {
        setMensajeScanner({ tipo: 'error', texto: `❌ No encontrado: ${codigo}` });
      }
      setBuscar(''); setProductos([]);
      setTimeout(() => setMensajeScanner(null), 2000);
      inputBuscarRef.current?.focus();
    } catch { }
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

  const agregarAlCarrito = useCallback((producto) => {
    setPestanas(prev => prev.map(p => {
      if (p.id !== pestanaActiva) return p;
      const existe = p.carrito.find(item => item.producto_id === producto.id);
      if (existe) {
        return { ...p, carrito: p.carrito.map(item => item.producto_id === producto.id ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio_unitario } : item) };
      }
      return { ...p, carrito: [...p.carrito, { producto_id: producto.id, nombre_producto: producto.nombre, precio_unitario: parseFloat(producto.precio_venta), cantidad: 1, subtotal: parseFloat(producto.precio_venta) }] };
    }));
    setBuscar(''); setProductos([]);
    setTimeout(() => inputBuscarRef.current?.focus(), 50);
  }, [pestanaActiva]);

  const agregarVentaRapida = (item) => {
    setPestanas(prev => prev.map(p => p.id === pestanaActiva ? { ...p, carrito: [...p.carrito, item] } : p));
  };

  const cambiarCantidad = (productoId, nuevaCantidad) => {
    if (nuevaCantidad <= 0) { actualizarCarritoPestana(carritoActivo.filter(item => item.producto_id !== productoId)); return; }
    actualizarCarritoPestana(carritoActivo.map(item =>
      item.producto_id === productoId ? { ...item, cantidad: nuevaCantidad, subtotal: nuevaCantidad * item.precio_unitario } : item
    ));
  };

  const eliminarDelCarrito = (productoId) => {
    actualizarCarritoPestana(carritoActivo.filter(item => item.producto_id !== productoId));
  };

  const limpiarCarrito = () => actualizarCarritoPestana([]);
  const total = carritoActivo.reduce((acc, item) => acc + item.subtotal, 0);

  const confirmarVenta = async ({ metodoPago, descuento, recargo, totalFinal, clienteId, esFiado }) => {
    try {
      const itemsReales = carritoActivo.filter(item => !item.esRapida);
      const itemsRapidos = carritoActivo.filter(item => item.esRapida);
      
      let resVenta;
      
      if (itemsReales.length > 0) {
        // Si hay productos regulares, crear la venta con ellos
        resVenta = await api.post('/api/ventas', {
          turno_id: turno?.id,
          items: itemsReales.map(item => ({ producto_id: item.producto_id, nombre_producto: item.nombre_producto, cantidad: item.cantidad, precio_unitario: item.precio_unitario, subtotal: item.subtotal })),
          metodo_pago: metodoPago, descuento, recargo, total: totalFinal,
          cliente_id: clienteId || null, es_fiado: esFiado || false,
        });
        
        // Si también hay productos rápidos, crear una segunda venta para ellos
        if (itemsRapidos.length > 0) {
          await api.post('/api/ventas', {
            turno_id: turno?.id,
            items: itemsRapidos.map(i => ({ producto_id: null, nombre_producto: i.nombre_producto, cantidad: i.cantidad, precio_unitario: i.precio_unitario, subtotal: i.subtotal })),
            metodo_pago: metodoPago, descuento: 0, recargo: 0,
            total: itemsRapidos.reduce((acc, i) => acc + i.subtotal, 0),
            cliente_id: null, es_fiado: false,
          });
        }
      } else if (itemsRapidos.length > 0) {
        // Si solo hay productos rápidos, crear la venta directamente con ellos
        resVenta = await api.post('/api/ventas', {
          turno_id: turno?.id,
          items: itemsRapidos.map(i => ({ producto_id: null, nombre_producto: i.nombre_producto, cantidad: i.cantidad, precio_unitario: i.precio_unitario, subtotal: i.subtotal })),
          metodo_pago: metodoPago, descuento: 0, recargo: 0,
          total: itemsRapidos.reduce((acc, i) => acc + i.subtotal, 0),
          cliente_id: null, es_fiado: false,
        });
      }
      
      const nuevoNumero = contadorVentas + 1;
      setContadorVentas(nuevoNumero);
      setPestanas(prev => prev.map(p => p.id === pestanaActiva ? { ...p, nombre: `Venta ${nuevoNumero}`, carrito: [] } : p));
      setMostrarModalVenta(false);
      if (config?.impresion_tickets !== false) {
        imprimirTicket({
          venta: { id: resVenta.data.id, total: totalFinal, descuento: descuento || 0, recargo: recargo || 0, metodo_pago: metodoPago, es_fiado: esFiado || false, cliente_nombre: null, fecha: new Date() },
          items: [...itemsReales, ...itemsRapidos].map(item => ({ nombre_producto: item.nombre_producto, cantidad: item.cantidad, precio_unitario: item.precio_unitario, subtotal: item.subtotal })),
          config,
        });
      }
      setVentaExitosa(true);
      setTimeout(() => setVentaExitosa(false), 2000);
      cargarProductos();
      inputBuscarRef.current?.focus();
    } catch (err) { alert(err.response?.data?.error || 'Error al registrar la venta'); }
  };

  const oscuro = config?.modo_oscuro !== false;

  const estilos = {
    panelBusqueda: oscuro ? { background: '#111827', borderRight: '0.5px solid rgba(255,255,255,0.08)' } : { background: '#fff', borderRight: '0.5px solid #e5e7eb' },
    inputBuscar: oscuro ? { background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' } : { background: '#f9fafb', border: '1px solid #e5e7eb', color: '#111827' },
    textoProducto: oscuro ? { color: 'rgba(255,255,255,0.9)' } : { color: '#111827' },
    textoSecundario: oscuro ? { color: 'rgba(255,255,255,0.35)' } : { color: '#6b7280' },
    fondoCarrito: oscuro ? 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f1a2e 100%)' : '#f9fafb',
    fondoFooter: oscuro ? '#0f0f1a' : '#fff',
    borderFooter: oscuro ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
    textoTotal: oscuro ? 'rgba(255,255,255,0.5)' : '#6b7280',
    textoTotalMonto: oscuro ? '#ffffff' : '#111827',
    fondoPestanas: oscuro ? '#1a1a2e' : '#fff',
    itemCarrito: oscuro ? { background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)', border: '0.5px solid rgba(255,255,255,0.12)' } : { background: '#fff', border: '1px solid #f3f4f6' },
    textoItemCarrito: oscuro ? { color: 'rgba(255,255,255,0.9)' } : { color: '#111827' },
    textoItemSecundario: oscuro ? { color: 'rgba(255,255,255,0.4)' } : { color: '#6b7280' },
    botonCantidad: oscuro ? { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' } : { background: '#f3f4f6', color: '#374151' },
    botonBasura: oscuro ? { background: 'rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.7)' } : { background: '#fee2e2', color: '#ef4444' },
    botonLimpiar: oscuro ? { background: 'rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.7)' } : { background: '#fee2e2', color: '#ef4444' },
    textoVacio: oscuro ? { color: 'rgba(255,255,255,0.3)' } : { color: '#9ca3af' },
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
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">

      {/* ---- BARRA SUPERIOR MODERNA ---- */}
      <div className="bg-gray-900 text-white flex items-center gap-1.5 px-3 py-2 flex-shrink-0 border-b border-gray-700">

        {/* Logo/Brand */}
        <div className="flex items-center gap-2 mr-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: 'var(--color-primario)' }}>S</div>
          <span className="text-sm font-semibold text-gray-300 hidden lg:block">POS</span>
        </div>

        <div className="w-px h-6 bg-gray-700 mr-1.5" />

        {/* Botones principales */}
        <button onClick={() => setMostrarModalRapida(true)}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg text-xs font-medium transition-all">
          ⚡ <span className="hidden sm:inline">Rápida</span>
          <span className="text-purple-300 text-xs hidden lg:inline">[F1]</span>
        </button>

        <button onClick={() => setMostrarModalFiados(true)}
          style={{ backgroundColor: 'var(--color-primario)' }}
          className="flex items-center gap-1.5 hover:opacity-80 px-3 py-1.5 rounded-lg text-xs font-medium transition-all">
          👥 <span className="hidden sm:inline">Fiados</span>
          <span className="text-white text-opacity-60 text-xs hidden lg:inline">[F3]</span>
        </button>

        <button onClick={() => setMostrarModalHistorial(true)}
          className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-all">
          📋 <span className="hidden sm:inline">Historial</span>
          <span className="text-gray-400 text-xs hidden lg:inline">[F5]</span>
        </button>

        <button onClick={() => setMostrarModalGasto(true)}
          className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-all">
          💸 <span className="hidden sm:inline">Gastos</span>
          <span className="text-gray-400 text-xs hidden lg:inline">[F10]</span>
        </button>

        <button onClick={() => setMostrarModalCierre(true)}
          className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-all">
          🔒 <span className="hidden sm:inline">Cierre</span>
          <span className="text-red-300 text-xs hidden lg:inline">[F4]</span>
        </button>

        <button onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-all">
          ⚙️ <span className="hidden sm:inline">Admin</span>
        </button>

        {/* Status derecha */}
        <div className="ml-auto flex items-center gap-3">
          {mensajeScanner && (
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${mensajeScanner.tipo === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>
              {mensajeScanner.texto}
            </span>
          )}
          {ventaExitosa && !mensajeScanner && (
            <span className="text-xs font-medium px-2 py-1 rounded-lg bg-green-600">✅ Venta registrada</span>
          )}
          <div className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-2.5 py-1.5">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-xs text-gray-300">{turno?.nombre || 'Caja'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ---- PANEL IZQUIERDO: BÚSQUEDA ---- */}
       <div className="w-80 lg:w-96 flex flex-col flex-shrink-0" style={estilos.panelBusqueda}>

          {/* Buscador */}
          <div className="p-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>🔍</span>
              <input ref={inputBuscarRef} type="text" value={buscar}
                onChange={(e) => setBuscar(e.target.value)} autoFocus
                placeholder="Buscar por nombre o código... [F2]"
                className="w-full rounded-xl pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                style={estilos.inputBuscar} />
            </div>
          </div>

          {/* Ordenar */}
         {productos.length > 0 && (
            <div className="px-3 py-2 flex gap-1.5 items-center" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Orden:</span>
              {[{ id: 'nombre', label: 'A-Z' }, { id: 'precio_asc', label: '$ ↑' }, { id: 'precio_desc', label: '$ ↓' }].map(o => (
                <button key={o.id} onClick={() => setOrdenar(o.id)}
                  style={ordenar === o.id ? { backgroundColor: 'var(--color-primario)' } : {}}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${ordenar === o.id ? 'text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* Lista productos */}
          <div className="flex-1 overflow-y-auto p-2">
            {buscar.trim() === '' ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 py-12">
                <p className="text-5xl mb-3">🔍</p>
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Buscá un producto</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>por nombre o escaneá el código</p>
                <div className="mt-6 space-y-1.5 w-full px-4">
                  {[['F1', 'Venta Rápida', 'purple'], ['F3', 'Fiados', 'orange'], ['F8', 'Confirmar Venta', 'green'], ['F9', 'Limpiar carrito', 'red']].map(([key, label, color]) => (
                    <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className={`text-xs font-mono font-bold bg-${color}-100 text-${color}-600 px-2 py-0.5 rounded`}>{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : productos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 py-12">
                <p className="text-5xl mb-3">📦</p>
                <p className="text-sm text-gray-400">No se encontraron productos</p>
              </div>
            ) : (
              <div className="space-y-1">
                {productosOrdenados.map(producto => (
                 <button key={producto.id} onClick={() => agregarAlCarrito(producto)}
                    className="w-full rounded-xl p-3 text-left transition-all flex items-center gap-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.06)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 text-white"
                      style={{ backgroundColor: 'var(--color-primario)' }}>
                      {producto.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{producto.nombre}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{producto.categoria_nombre || 'Sin categoría'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm" style={{ color: 'var(--color-primario)' }}>{fmt(producto.precio_venta)}</p>
                      <p className={`text-xs ${producto.stock <= 0 ? 'text-red-500' : producto.stock <= producto.stock_minimo ? 'text-yellow-500' : 'text-gray-400'}`}>
                        {producto.stock} {producto.unidad}
                      </p>
                    </div>
                  </button>
                ))}
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
                  borderRight: '0.5px solid rgba(255,255,255,0.06)',
                  ...(pestanaActiva === p.id ? { borderBottom: '2px solid var(--color-primario)' } : {})
                }}>
                <span className="text-sm font-medium">{p.nombre}</span>
                {p.carrito.length > 0 && (
                  <span className="text-xs rounded-full px-1.5 py-0.5 text-white" style={{ backgroundColor: 'var(--color-primario)' }}>{p.carrito.length}</span>
                )}
                {pestanas.length > 1 && (
                  <button onClick={(e) => cerrarPestana(p.id, e)} className="text-gray-300 hover:text-red-500 text-xs ml-1 transition-colors">✕</button>
                )}
              </div>
            ))}
            <button onClick={agregarPestana}
              className="px-3 py-3 transition-colors flex-shrink-0 text-xl font-light"
            style={{ color: 'rgba(255,255,255,0.3)' }}
              title="Nueva venta">+</button>
          </div>

          {/* Items del carrito */}
          <div className="flex-1 overflow-y-auto p-4" style={{ background: estilos.fondoCarrito }}>
              {carritoActivo.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <p className="text-7xl mb-4 opacity-30">🛒</p>
                <p className="text-base font-medium" style={estilos.textoVacio}>Carrito vacío</p>
                <p className="text-sm mt-1" style={estilos.textoVacio}>Buscá o escaneá productos</p>
                <p className="text-xs mt-4 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>F8 confirmar · F9 limpiar</p>
              </div>
            ) : (
              <div className="space-y-2 max-w-2xl mx-auto">
                {carritoActivo.map(item => (
               <div key={item.producto_id} className="flex items-center gap-3 p-4 rounded-2xl transition-all" style={estilos.itemCarrito}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${item.esRapida ? 'bg-purple-100 text-purple-700' : 'text-white'}`}
                      style={!item.esRapida ? { backgroundColor: 'var(--color-primario)' } : {}}>
                      {item.esRapida ? '⚡' : item.nombre_producto.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-sm" style={estilos.textoItemCarrito}>{item.nombre_producto}</p>
                      <p className="text-xs" style={estilos.textoItemSecundario}>{fmt(item.precio_unitario)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => cambiarCantidad(item.producto_id, item.cantidad - 1)}
                        className="w-7 h-7 rounded-lg font-bold text-sm transition-all"
                        style={estilos.botonCantidad}>−</button>
                      <span className="w-8 text-center font-bold text-sm" style={estilos.textoItemCarrito}>{item.cantidad}</span>
                      <button onClick={() => cambiarCantidad(item.producto_id, item.cantidad + 1)}
                        className="w-7 h-7 rounded-lg font-bold text-sm transition-all"
                        style={estilos.botonCantidad}>+</button>
                    </div>
                    <div className="text-right flex-shrink-0 w-20">
                      <p className="font-bold text-sm" style={{ color: 'rgba(255,255,255,0.9)' }}>{fmt(item.subtotal)}</p>
                    </div>
                    <button onClick={() => eliminarDelCarrito(item.producto_id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0 text-sm"
                      style={estilos.botonBasura}>
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- FOOTER DEL CARRITO ---- */}
          <div className="border-t p-4 flex-shrink-0" style={{ background: estilos.fondoFooter, borderColor: estilos.borderFooter }}>
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-3">
              <div className="text-sm" style={{ color: estilos.textoTotal }}>
                  <span>{carritoActivo.length} productos</span>
                  <span className="mx-2">·</span>
                  <span>{carritoActivo.reduce((acc, i) => acc + i.cantidad, 0)} unidades</span>
                </div>
                {carritoActivo.length > 0 && (
                  <button onClick={limpiarCarrito}
                    className="text-xs px-2.5 py-1 rounded-lg transition-all"
                    style={estilos.botonLimpiar}>
                    🗑️ Limpiar [F9]
                  </button>
                )}
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xl font-semibold" style={{ color: estilos.textoTotal }}>Total</span>
                <span className="text-4xl font-bold" style={{ color: estilos.textoTotalMonto }}>{fmt(total)}</span>
              </div>
              <button onClick={() => setMostrarModalVenta(true)} disabled={carritoActivo.length === 0}
                style={carritoActivo.length > 0 ? { backgroundColor: 'var(--color-primario)' } : {}}
                className="w-full disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold text-lg transition-all shadow-lg disabled:shadow-none hover:opacity-90">
                ✅ Confirmar Venta [F8]
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
        <ModalConfirmarVenta carrito={carritoActivo} total={total} config={config} turno={turno}
          onConfirmar={confirmarVenta}
          onCerrar={() => { setMostrarModalVenta(false); inputBuscarRef.current?.focus(); }} />
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
        <ModalHistorial turno={turno}
          onCerrar={() => { setMostrarModalHistorial(false); inputBuscarRef.current?.focus(); }} />
      )}
    </div>
  );
}

export default POS;