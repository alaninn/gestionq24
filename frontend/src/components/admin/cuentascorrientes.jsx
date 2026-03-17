// =============================================
// ARCHIVO: src/components/admin/CuentasCorrientes.jsx
// FUNCIÓN: Gestión de clientes deudores
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';

const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0
}).format(n || 0);

const fmtFecha = (f) => new Date(f).toLocaleDateString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

function CuentasCorrientes() {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [detalleCliente, setDetalleCliente] = useState(null);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');

  // Estado formulario nuevo cliente
  const [formCliente, setFormCliente] = useState({
    nombre: '', telefono: '', email: '', direccion: ''
  });

  // Estado formulario pago
  const [formPago, setFormPago] = useState({
    monto: '', metodo_pago: 'efectivo', nota: ''
  });

  useEffect(() => {
    cargarClientes();
  }, [buscar]);

  const cargarClientes = async () => {
    try {
      setCargando(true);
      const res = await api.get(`/api/clientes${buscar ? `?buscar=${buscar}` : ''}`);
      setClientes(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  const verDetalle = async (cliente) => {
    try {
      setClienteSeleccionado(cliente);
      const res = await api.get(`/api/clientes/${cliente.id}`);
      setDetalleCliente(res.data);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const crearCliente = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/clientes', formCliente);
      setExito('Cliente creado correctamente');
      setMostrarModalNuevo(false);
      setFormCliente({ nombre: '', telefono: '', email: '', direccion: '' });
      cargarClientes();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear cliente');
    }
  };

  

const registrarPago = async (e) => {
    e.preventDefault();
    setError('');

    // Validamos que el cliente tenga deuda
    if (parseFloat(clienteSeleccionado.saldo_deuda) <= 0) {
      setError('Este cliente no tiene deuda pendiente');
      return;
    }

    // Validamos que el monto no supere la deuda
    if (parseFloat(formPago.monto) > parseFloat(clienteSeleccionado.saldo_deuda)) {
      setError(`El monto no puede superar la deuda actual de ${fmt(clienteSeleccionado.saldo_deuda)}`);
      return;
    }

    try {
      await api.post(`/api/clientes/${clienteSeleccionado.id}/pago`, formPago);
      setExito('Pago registrado correctamente');
      setMostrarModalPago(false);
      setFormPago({ monto: '', metodo_pago: 'efectivo', nota: '' });

      // Actualizamos el detalle del cliente
      const res = await api.get(`/api/clientes/${clienteSeleccionado.id}`);
      setDetalleCliente(res.data);

      // Actualizamos también el cliente seleccionado con la nueva deuda
      setClienteSeleccionado(res.data);

      // Recargamos la lista
      cargarClientes();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar pago');
    }
  };
  


  const eliminarCliente = async (id, nombre) => {
    if (!window.confirm(`¿Desactivar al cliente "${nombre}"?`)) return;
    try {
      await api.delete(`/api/clientes/${id}`);
      setExito('Cliente desactivado');
      setClienteSeleccionado(null);
      setDetalleCliente(null);
      cargarClientes();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al eliminar cliente');
    }
  };

  // Totales
  const deudaTotal = clientes.reduce((a, c) => a + parseFloat(c.saldo_deuda || 0), 0);
  const clientesActivos = clientes.filter(c => c.saldo_deuda > 0).length;

  return (
    <div className="space-y-4">

      {/* Título */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Cuentas Corrientes</h2>
          <p className="text-gray-500">Control de deudas y pagos de clientes</p>
        </div>
        <button onClick={() => setMostrarModalNuevo(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          + Nuevo Cliente
        </button>
      </div>

      {/* Mensajes */}
      {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">✅ {exito}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">❌ {error}</div>}

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-500 text-white rounded-xl p-5 shadow">
          <p className="text-red-100 text-sm">DEUDA TOTAL</p>
          <p className="text-3xl font-bold mt-1">{fmt(deudaTotal)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow border-l-4 border-orange-400">
          <p className="text-gray-500 text-sm">CON DEUDA</p>
          <p className="text-3xl font-bold text-orange-500 mt-1">{clientesActivos}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow border-l-4 border-blue-400">
          <p className="text-gray-500 text-sm">TOTAL CLIENTES</p>
          <p className="text-3xl font-bold text-blue-500 mt-1">{clientes.length}</p>
        </div>
      </div>

      <div className="flex gap-4">

        {/* Lista de clientes */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="p-4 border-b flex gap-3">
              <input type="text" placeholder="Buscar por nombre o teléfono..."
                value={buscar} onChange={(e) => setBuscar(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Cliente</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Teléfono</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Deuda</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cargando ? (
                  <tr><td colSpan="4" className="text-center py-8 text-gray-400">Cargando...</td></tr>
                ) : clientes.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-8 text-gray-400">No hay clientes</td></tr>
                ) : (
                  clientes.map(cliente => (
                    <tr key={cliente.id}
                      onClick={() => verDetalle(cliente)}
                      className={`hover:bg-gray-50 cursor-pointer ${clienteSeleccionado?.id === cliente.id ? 'bg-green-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-sm">
                            {cliente.nombre.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800">{cliente.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{cliente.telefono || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${parseFloat(cliente.saldo_deuda) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {fmt(cliente.saldo_deuda)}
                        </span>
                      </td>
                  <td className="px-4 py-3 text-center">
                        {parseFloat(cliente.saldo_deuda) > 0 ? (
                          <button onClick={(e) => { e.stopPropagation(); verDetalle(cliente); setMostrarModalPago(true); }}
                            className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded text-sm transition-colors">
                            💵 Cobrar
                          </button>
                        ) : (
                          <span className="text-green-500 text-xs font-medium">✅ Sin deuda</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel de detalle */}
        {detalleCliente && (
          <div className="w-80 bg-white rounded-xl shadow overflow-hidden flex-shrink-0">
            <div className="p-4 bg-green-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">{detalleCliente.nombre}</h3>
                  <p className="text-green-100 text-sm">{detalleCliente.telefono || 'Sin teléfono'}</p>
                </div>
                <button onClick={() => { setClienteSeleccionado(null); setDetalleCliente(null); }}
                  className="text-green-200 hover:text-white text-xl">×</button>
              </div>
              <div className="mt-3 bg-green-700 rounded-lg p-3">
                <p className="text-green-100 text-xs">DEUDA ACTUAL</p>
                <p className="text-2xl font-bold">{fmt(detalleCliente.saldo_deuda)}</p>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="p-3 border-b flex gap-2">
              <button onClick={() => setMostrarModalPago(true)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                💵 Registrar Pago
              </button>
              <button onClick={() => eliminarCliente(detalleCliente.id, detalleCliente.nombre)}
                className="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-2 rounded-lg text-sm transition-colors">
                🗑️
              </button>
            </div>

            {/* Historial */}
            <div className="overflow-y-auto max-h-96 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Historial</p>

              {/* Pagos */}
              {detalleCliente.pagos?.map(pago => (
                <div key={`pago-${pago.id}`} className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-green-700 font-medium">✅ Pago</p>
                      <p className="text-xs text-gray-500">{pago.metodo_pago}</p>
                      {pago.nota && <p className="text-xs text-gray-400">{pago.nota}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{fmt(pago.monto)}</p>
                      <p className="text-xs text-gray-400">{fmtFecha(pago.fecha)}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Ventas fiadas */}
              {detalleCliente.ventas?.map(venta => (
                <div key={`venta-${venta.id}`} className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-red-700 font-medium">💳 Fiado</p>
                      <p className="text-xs text-gray-500">{venta.items} productos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{fmt(venta.total)}</p>
                      <p className="text-xs text-gray-400">{fmtFecha(venta.fecha)}</p>
                    </div>
                  </div>
                </div>
              ))}

              {!detalleCliente.pagos?.length && !detalleCliente.ventas?.length && (
                <p className="text-center text-gray-400 text-sm py-4">Sin historial</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal nuevo cliente */}
      {mostrarModalNuevo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-gray-800">👤 Nuevo Cliente</h3>
              <button onClick={() => setMostrarModalNuevo(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={crearCliente} className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={formCliente.nombre}
                  onChange={(e) => setFormCliente(p => ({ ...p, nombre: e.target.value }))}
                  required autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Nombre completo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="text" value={formCliente.telefono}
                    onChange={(e) => setFormCliente(p => ({ ...p, telefono: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="11 1234-5678" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={formCliente.email}
                    onChange={(e) => setFormCliente(p => ({ ...p, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="opcional" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input type="text" value={formCliente.direccion}
                  onChange={(e) => setFormCliente(p => ({ ...p, direccion: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="opcional" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMostrarModalNuevo(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                  ✅ Crear Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal registrar pago */}
      {mostrarModalPago && clienteSeleccionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b bg-green-600 text-white rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">💵 Registrar Pago</h3>
                  <p className="text-green-100 text-sm">Cliente: {clienteSeleccionado.nombre}</p>
                </div>
                <button onClick={() => setMostrarModalPago(false)} className="text-green-200 hover:text-white text-2xl">×</button>
              </div>
            </div>
            <form onSubmit={registrarPago} className="p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex justify-between">
                <span className="text-gray-600">Deuda actual</span>
                <span className="font-bold text-red-600">{fmt(clienteSeleccionado.saldo_deuda)}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto a pagar *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input type="number" value={formPago.monto}
                    onChange={(e) => setFormPago(p => ({ ...p, monto: e.target.value }))}
                    required autoFocus min="0"
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0" />
                </div>
                {/* Botones rápidos */}
                <div className="flex gap-2 mt-2">
                  <button type="button"
                    onClick={() => setFormPago(p => ({ ...p, monto: (parseFloat(clienteSeleccionado.saldo_deuda) / 2).toFixed(0) }))}
                    className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-colors">
                    50% de la deuda
                  </button>
                  <button type="button"
                    onClick={() => setFormPago(p => ({ ...p, monto: clienteSeleccionado.saldo_deuda }))}
                    className="flex-1 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors">
                    Pago Total
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'efectivo', label: '💵 Efectivo' },
                    { id: 'transferencia', label: '🏦 Transferencia' },
                    { id: 'mercadopago', label: '📱 Mercado Pago' },
                    { id: 'tarjeta', label: '💳 Tarjeta' },
                  ].map(m => (
                    <button key={m.id} type="button"
                      onClick={() => setFormPago(p => ({ ...p, metodo_pago: m.id }))}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                        formPago.metodo_pago === m.id
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
                <input type="text" value={formPago.nota}
                  onChange={(e) => setFormPago(p => ({ ...p, nota: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej: Pago parcial de deuda de marzo" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setMostrarModalPago(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors">
                  ✅ Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default CuentasCorrientes;