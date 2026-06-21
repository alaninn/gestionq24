// =============================================
// ARCHIVO: src/components/admin/Gastos.jsx
// FUNCIÓN: Registrar y consultar gastos
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// =============================================
// COMPONENTE MODAL DE GASTO
// Se exporta para poder usarlo también en el POS
// =============================================
export function ModalGasto({ onCerrar, onGuardado, modoCompra = false, turno = null, gastoExistente = null }) {

  // Modo edición: si llega un gasto existente, el modal abre completo y
  // precargado (mismos campos que al crear) y al guardar hace PUT en vez de POST.
  const esEdicion = !!gastoExistente;
  const fechaHoy = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
  const fechaExistente = gastoExistente?.fecha
    ? String(gastoExistente.fecha).split('T')[0]
    : fechaHoy;

  const [tabActiva, setTabActiva] = useState(
    gastoExistente?.tipo === 'pago_proveedor' ? 'proveedor' : 'gasto'
  ); // 'gasto' | 'proveedor'
  const [formulario, setFormulario] = useState({
    descripcion: gastoExistente?.descripcion || '',
    monto: gastoExistente?.monto != null ? String(gastoExistente.monto) : '',
    metodo_pago: gastoExistente?.metodo_pago || 'efectivo',
    // De dónde sale el dinero: 'caja' descuenta del cierre del turno;
    // 'local' (plata del negocio) y 'otro' no afectan la caja.
    origen_dinero: gastoExistente?.origen_dinero || (turno ? 'caja' : 'local'),
    proveedor_id: gastoExistente?.proveedor_id ? String(gastoExistente.proveedor_id) : '',
    tipo_pago_proveedor: gastoExistente?.tipo_pago_proveedor || 'a_cuenta',
    recibo_url: gastoExistente?.recibo_url || '',
    // Dato fiscal: '' = gasto X (sin comprobante fiscal); 'factura_a' = en
    // blanco con Factura A → suma IVA crédito al Resumen Fiscal.
    tipo_comprobante: gastoExistente?.tipo_comprobante === 'factura_a' ? 'factura_a' : '',
    registrar_factura: false,
    total_factura: gastoExistente?.total_factura || '',
    fecha: fechaExistente,
  });
  const [proveedores, setProveedores] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Alta rápida de proveedor sin salir del modal
  const [mostrarNuevoProveedor, setMostrarNuevoProveedor] = useState(false);
  const [nuevoProveedor, setNuevoProveedor] = useState({ nombre: '', telefono: '' });
  const [creandoProveedor, setCreandoProveedor] = useState(false);

  const crearProveedorRapido = async () => {
    if (!nuevoProveedor.nombre.trim()) return;
    try {
      setCreandoProveedor(true);
      const res = await api.post('/api/proveedores', {
        nombre: nuevoProveedor.nombre.trim(),
        telefono: nuevoProveedor.telefono.trim() || null,
      });
      await cargarProveedores();
      setFormulario(p => ({ ...p, proveedor_id: String(res.data.id) }));
      setNuevoProveedor({ nombre: '', telefono: '' });
      setMostrarNuevoProveedor(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el proveedor');
    } finally {
      setCreandoProveedor(false);
    }
  };

  // Cargar proveedores cuando se abre el modal
  useEffect(() => {
    cargarProveedores();
  }, []);

  const proveedorSeleccionado = proveedores.find(p => String(p.id) === String(formulario.proveedor_id));

  const cargarProveedores = async () => {
    try {
      const res = await api.get('/api/proveedores');
      setProveedores(res.data);
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    }
  };

  // IVA contenido cuando es Factura A (precio con IVA incluido)
  const esFacturaA = formulario.tipo_comprobante === 'factura_a';
  const ivaContenido = esFacturaA
    ? Number(((Number(formulario.monto) || 0) * 21 / 121).toFixed(2))
    : 0;

  const convertirArchivoADataURL = async (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const guardar = async (e) => {
    e.preventDefault();
    setError('');

    const esPagoProveedor = tabActiva === 'proveedor';
    const monto = Number(formulario.monto || 0);

    // Validaciones
    if (esPagoProveedor) {
      if (!formulario.proveedor_id) { setError('Elegí el proveedor'); return; }
      if (monto <= 0 && !(formulario.registrar_factura && Number(formulario.total_factura) > 0)) {
        setError('Cargá el monto a pagar (o registrá la factura recibida)');
        return;
      }
    } else {
      if (monto <= 0) { setError('El monto debe ser mayor a 0'); return; }
      if (!formulario.descripcion.trim()) { setError('Contá brevemente qué se pagó en la descripción'); return; }
    }

    setGuardando(true);
    try {
      const datosEnvio = {
        descripcion: formulario.descripcion,
        monto: formulario.monto || 0,
        categoria: esPagoProveedor ? 'Proveedores' : null,
        tipo: esPagoProveedor ? 'pago_proveedor' : 'variable',
        metodo_pago: formulario.metodo_pago,
        turno_id: turno?.id || null,
        origen_dinero: formulario.origen_dinero,
        proveedor_id: esPagoProveedor ? formulario.proveedor_id : null,
        tipo_pago_proveedor: esPagoProveedor ? formulario.tipo_pago_proveedor : null,
        recibo_url: formulario.recibo_url,
        // Fecha elegida por el usuario (puede ser un día anterior). El backend
        // usa NOW() si coincide con hoy y respeta la fecha si se eligió otro día.
        fecha: formulario.fecha || null,
        // Dato fiscal: Factura A "en blanco" suma IVA crédito al Resumen Fiscal
        tipo_comprobante: esFacturaA ? 'factura_a' : null,
        tipo_documento: esFacturaA ? 'factura' : 'sin_boleta',
        iva_incluido: esFacturaA,
        porcentaje_iva: esFacturaA ? 21 : 0,
        registrar_nueva_factura: esPagoProveedor && formulario.registrar_factura && Number(formulario.total_factura) > 0,
        total_factura: esPagoProveedor && formulario.registrar_factura ? (formulario.total_factura || null) : null,
      };

      // Descripción por defecto para pagos a proveedor
      if (esPagoProveedor && !datosEnvio.descripcion) {
        const totalFactura = Number(formulario.total_factura || 0);
        if (formulario.registrar_factura && totalFactura > 0) {
          datosEnvio.descripcion = monto >= totalFactura ? 'Pago total de factura'
            : monto > 0 ? 'Pago parcial de factura' : 'Registro de factura (sin pago)';
        } else {
          datosEnvio.descripcion = 'Pago a cuenta de deuda';
        }
      }

      if (esEdicion) {
        // En edición conservamos lo que no se toca en el formulario (turno,
        // productos de una compra, etc.) y pisamos lo editado.
        await api.put(`/api/gastos/${gastoExistente.id}`, {
          ...gastoExistente,
          ...datosEnvio,
          turno_id: gastoExistente.turno_id || null,
          productos_json: gastoExistente.productos_json || null,
        });
      } else {
        await api.post('/api/gastos', datosEnvio);
      }
      if (onGuardado) onGuardado();
      onCerrar();
    } catch (err) {
      setError(err.response?.data?.error || (esEdicion ? 'Error al actualizar el gasto' : 'Error al registrar el gasto'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[95vh] overflow-y-auto">

        {/* Encabezado */}
        <div className="flex items-center justify-between p-3 sm:p-5 border-b">
          <h3 className="text-base sm:text-lg font-bold text-gray-800">{esEdicion ? '✏️ Editar Gasto' : 'Nuevo Gasto'}</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        {/* Pestañas (al editar se ocultan: no se cambia el tipo de un gasto existente) */}
        <div className={`flex border-b ${esEdicion ? 'hidden' : ''}`}>
          <button 
            type="button"
            onClick={() => setTabActiva('gasto')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tabActiva === 'gasto' 
              ? 'bg-white text-gray-800 border-b-2 border-gray-800' 
              : 'bg-gray-50 text-gray-500'}`}
          >
            💸 Gasto
          </button>
          <button 
            type="button"
            onClick={() => setTabActiva('proveedor')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tabActiva === 'proveedor' 
              ? 'bg-white text-blue-700 border-b-2 border-blue-600' 
              : 'bg-gray-50 text-gray-500'}`}
          >
            🧾 Pago a Proveedor
          </button>
        </div>

        <form onSubmit={guardar} className="p-3 sm:p-5 space-y-3 sm:space-y-4">

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
              ❌ {error}
            </div>
          )}

          {tabActiva === 'gasto' && (
            <>
              {/* Monto + fecha */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MONTO *</label>
                  <input
                    type="number"
                    value={formulario.monto}
                    onChange={(e) => setFormulario(p => ({ ...p, monto: e.target.value }))}
                    required min="0" step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 text-lg"
                    placeholder="$0,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">FECHA</label>
                  <input
                    type="date"
                    value={formulario.fecha}
                    onChange={(e) => setFormulario(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
              </div>

              {/* Descripción: acá el usuario aclara qué se pagó */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DESCRIPCIÓN *</label>
                <textarea
                  value={formulario.descripcion}
                  onChange={(e) => setFormulario(p => ({ ...p, descripcion: e.target.value }))}
                  rows={2} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  placeholder="¿Qué se pagó? Ej: hielo, sodas, flete, luz..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MÉTODO DE PAGO</label>
                <select
                  value={formulario.metodo_pago}
                  onChange={(e) => setFormulario(p => ({ ...p, metodo_pago: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                  <option value="transferencia">🏦 Transferencia</option>
                  <option value="mercadopago">📱 Mercado Pago</option>
                </select>
              </div>

              {/* ¿De dónde sale el dinero? — clave para que el cierre de caja cierre bien */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">¿DE DÓNDE SALE EL DINERO?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'caja', label: '🧰 Caja del turno', desc: 'Descuenta del cierre', soloConTurno: true },
                    { id: 'local', label: '🏪 Dinero del local', desc: 'Baja el dinero disponible' },
                    { id: 'otro', label: '📱 MP del local', desc: 'Baja el dinero disponible' },
                  ].map(o => {
                    const deshabilitado = o.soloConTurno && !turno;
                    return (
                      <button key={o.id} type="button" disabled={deshabilitado}
                        onClick={() => setFormulario(p => ({ ...p, origen_dinero: o.id }))}
                        title={deshabilitado ? 'Necesitás una caja abierta (se elige desde el POS)' : o.desc}
                        className={`p-2 rounded-lg border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          formulario.origen_dinero === o.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <p className="text-xs font-semibold text-gray-800 leading-tight">{o.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{o.desc}</p>
                      </button>
                    );
                  })}
                </div>
                {formulario.origen_dinero === 'caja' && turno && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Este gasto se descuenta del efectivo esperado al cerrar la caja "{turno.nombre || 'actual'}".
                  </p>
                )}
              </div>

              {/* Dato fiscal: gasto X o en blanco con Factura A (suma IVA crédito) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DATO FISCAL</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={() => setFormulario(p => ({ ...p, tipo_comprobante: '' }))}
                    className={`p-2 sm:p-3 rounded-xl border-2 text-left transition-all ${!esFacturaA ? 'border-slate-700 bg-slate-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className="text-sm font-bold text-gray-800">Gasto X</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Sin comprobante fiscal</p>
                  </button>
                  <button type="button"
                    onClick={() => setFormulario(p => ({ ...p, tipo_comprobante: 'factura_a' }))}
                    className={`p-2 sm:p-3 rounded-xl border-2 text-left transition-all ${esFacturaA ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className="text-sm font-bold text-gray-800">🧾 Factura A</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">En blanco · suma IVA crédito</p>
                  </button>
                </div>
                {esFacturaA && (
                  <p className="text-xs text-blue-700 mt-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    El monto se toma con IVA incluido. IVA contenido: <b>${ivaContenido.toLocaleString('es-AR')}</b> — va al Resumen Fiscal como crédito.
                  </p>
                )}
              </div>
            </>
          )}

          {tabActiva === 'proveedor' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">🧾 PROVEEDOR *</label>
                  <button type="button"
                    onClick={() => { setMostrarNuevoProveedor(v => !v); setError(''); }}
                    className="text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors">
                    {mostrarNuevoProveedor ? '← Elegir existente' : '➕ Nuevo proveedor'}
                  </button>
                </div>

                {!mostrarNuevoProveedor ? (
                  <select
                    value={formulario.proveedor_id}
                    onChange={(e) => setFormulario(p => ({ ...p, proveedor_id: e.target.value, monto: '' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50"
                  >
                    <option value="">Buscar proveedor...</option>
                    {proveedores.map(prov => (
                      <option key={prov.id} value={prov.id}>
                        {prov.nombre} {prov.saldo_a_favor > 0 ? `(nosotros le debemos: $${prov.saldo_a_favor})` : prov.saldo_deuda > 0 ? `(nos debe a nosotros: $${prov.saldo_deuda})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  /* Alta rápida: nombre y teléfono alcanzan */
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                    <input type="text" value={nuevoProveedor.nombre}
                      onChange={(e) => setNuevoProveedor(p => ({ ...p, nombre: e.target.value }))}
                      autoFocus
                      className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Nombre del proveedor *" />
                    <input type="tel" value={nuevoProveedor.telefono}
                      onChange={(e) => setNuevoProveedor(p => ({ ...p, telefono: e.target.value }))}
                      className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Teléfono (opcional)" />
                    <button type="button" disabled={!nuevoProveedor.nombre.trim() || creandoProveedor}
                      onClick={crearProveedorRapido}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors">
                      {creandoProveedor ? 'Creando...' : '✅ Crear y seleccionar'}
                    </button>
                  </div>
                )}
              </div>

              {/* Estado de deuda del proveedor */}
              {proveedorSeleccionado && (
                <div className={`p-3 rounded-lg border ${Number(proveedorSeleccionado.saldo_a_favor) > 0
                  ? 'bg-yellow-50 border-yellow-300' 
                  : 'bg-green-50 border-green-300'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      {Number(proveedorSeleccionado.saldo_a_favor) > 0 ? (
                        <>
                          <p className="text-sm font-medium text-yellow-800">Nosotros le debemos: ${proveedorSeleccionado.saldo_a_favor}</p>
                          <p className="text-xs text-yellow-600">Compra(s) pendiente(s)</p>
                        </>
                      ) : (
                        <p className="text-sm font-medium text-green-800">✅ Sin deuda pendiente registrada</p>
                      )}
                    </div>
                    {Number(proveedorSeleccionado.saldo_a_favor) > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormulario(p => ({ ...p, monto: Number(proveedorSeleccionado.saldo_a_favor)}))}
                        className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium"
                      >
                        Usar total →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Toggle registrar nueva factura */}
              <div
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  formulario.registrar_factura
                    ? 'bg-purple-50 border-purple-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
                onClick={() => setFormulario(p => ({
                  ...p,
                  registrar_factura: !p.registrar_factura
                }))}
              >
                <div>
                    <p className="text-sm font-medium text-gray-700">📦 Registrar nueva factura</p>
                    <p className="text-xs text-gray-500">Agrega el total de la factura recibida</p>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${
                  formulario.registrar_factura ? 'bg-purple-500' : 'bg-gray-300'
                }`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    formulario.registrar_factura ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </div>
              </div>

              {formulario.registrar_factura && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <label className="block text-sm font-medium text-purple-700 mb-1">TOTAL DE LA FACTURA *</label>
                  <input
                    type="number"
                    value={formulario.total_factura}
                    onChange={(e) => setFormulario(p => ({ ...p, total_factura: e.target.value }))}
                    className="w-full border border-purple-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    placeholder="$0,00"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PAGÁS AHORA *</label>
                  <input
                    type="number"
                    value={formulario.monto}
                    onChange={(e) => setFormulario(p => ({ ...p, monto: e.target.value }))}
                    min="0" step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 text-lg"
                    placeholder="$0,00 (puede ser $0)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">FECHA</label>
                  <input
                    type="date"
                    value={formulario.fecha}
                    onChange={(e) => setFormulario(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />

                  <div className="mt-2">
                    <select
                      value={formulario.metodo_pago}
                      onChange={(e) => setFormulario(p => ({ ...p, metodo_pago: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="tarjeta">💳 Tarjeta</option>
                      <option value="transferencia">🏦 Transferencia</option>
                      <option value="mercadopago">📱 Mercado Pago</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* De dónde sale el dinero (igual que en gasto común) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">¿DE DÓNDE SALE EL DINERO?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'caja', label: '🧰 Caja del turno', desc: 'Descuenta del cierre', soloConTurno: true },
                    { id: 'local', label: '🏪 Dinero del local', desc: 'Baja el dinero disponible' },
                    { id: 'otro', label: '📱 MP del local', desc: 'Baja el dinero disponible' },
                  ].map(o => {
                    const deshabilitado = o.soloConTurno && !turno;
                    return (
                      <button key={o.id} type="button" disabled={deshabilitado}
                        onClick={() => setFormulario(p => ({ ...p, origen_dinero: o.id }))}
                        className={`p-2 rounded-lg border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          formulario.origen_dinero === o.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <p className="text-xs font-semibold text-gray-800 leading-tight">{o.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{o.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NOTA (OPC.)</label>
                <textarea
                  value={formulario.descripcion}
                  onChange={(e) => setFormulario(p => ({ ...p, descripcion: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  placeholder="Ej: pago parcial compra #001..."
                />
              </div>

              {/* Dato fiscal del pago: X o en blanco con Factura A (suma IVA crédito) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DATO FISCAL</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={() => setFormulario(p => ({ ...p, tipo_comprobante: '' }))}
                    className={`p-2 sm:p-3 rounded-xl border-2 text-left transition-all ${!esFacturaA ? 'border-slate-700 bg-slate-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className="text-sm font-bold text-gray-800">Gasto X</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Sin comprobante fiscal</p>
                  </button>
                  <button type="button"
                    onClick={() => setFormulario(p => ({ ...p, tipo_comprobante: 'factura_a' }))}
                    className={`p-2 sm:p-3 rounded-xl border-2 text-left transition-all ${esFacturaA ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className="text-sm font-bold text-gray-800">🧾 Factura A</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">En blanco · suma IVA crédito</p>
                  </button>
                </div>
                {esFacturaA && (
                  <p className="text-xs text-blue-700 mt-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    El monto pagado se toma con IVA incluido. IVA contenido: <b>${ivaContenido.toLocaleString('es-AR')}</b> — va al Resumen Fiscal como crédito.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2 border-t mt-4 pt-4">
            <button type="button" onClick={onCerrar}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
              {guardando ? 'Guardando...' : (esEdicion ? '💾 Guardar cambios' : 'Registrar gasto')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// =============================================
// COMPONENTE PRINCIPAL DE GASTOS
// =============================================
function Gastos() {

  const [gastos, setGastos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState('gastos'); // 'gastos' o 'compra'
  const [mostrarModal, setMostrarModal] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [exito, setExito] = useState('');

  // Edición de un gasto existente: abre el modal completo precargado.
  const [gastoEditando, setGastoEditando] = useState(null);

  const [compra, setCompra] = useState({
    proveedor_id: '',
    fecha: new Date().toISOString().split('T')[0],
    tipo_comprobante: 'sin_factura',
    numero_boleta: '',
    condicion_iva_proveedor: 'responsable_inscripto',
    metodo_pago: 'efectivo',
    estado_pago: 'pagado',
    monto_extra: 0,
    nota: '',
    recibo_url: '',
  });

  useEffect(() => {
    // No need for iva_incluido anymore
  }, [compra.tipo_comprobante]);

  const etiquetaComprobante = {
    sin_factura: 'Sin factura',
    factura_a: 'Factura A (IVA incluido)',
    factura_b: 'Factura B',
    factura_c: 'Factura C',
  };

  const etiquetaCondicion = {
    responsable_inscripto: 'Responsable Inscripto',
    monotributista: 'Monotributista',
    exento: 'Exento',
  };

  const [compraProductos, setCompraProductos] = useState([]);
  const [productoConsulta, setProductoConsulta] = useState('');
  const [sugerenciasProductos, setSugerenciasProductos] = useState([]);
  const [errorCompra, setErrorCompra] = useState('');

  const [libroVentas, setLibroVentas] = useState([]);
  const [libroCompras, setLibroCompras] = useState([]);
  const [cargandoLibro, setCargandoLibro] = useState(false);
  const [fechaDesdeLibro, setFechaDesdeLibro] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [fechaHastaLibro, setFechaHastaLibro] = useState(new Date().toISOString().split('T')[0]);

  // ---- FILTROS (como el Dashboard: hoy / por día / por mes / rango / todo) ----
  const [periodoFiltro, setPeriodoFiltro] = useState('hoy');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  // Filtro por origen del dinero (lo activan las tarjetas): 'todos'|'caja'|'local'|'otro'
  const [filtroOrigen, setFiltroOrigen] = useState('todos');
  const hoyISO = () => {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset() * 60000;
    return new Date(hoy - offset).toISOString().split('T')[0];
  };
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoyISO());
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rangoDesde, setRangoDesde] = useState(hoyISO());
  const [rangoHasta, setRangoHasta] = useState(hoyISO());

  // Calculamos las fechas según el período seleccionado (null = sin límite)
  const calcularFechas = () => {
    const hoyStr = hoyISO();
    if (periodoFiltro === 'hoy') return { desde: hoyStr, hasta: hoyStr };
    if (periodoFiltro === 'dia') return { desde: diaSeleccionado, hasta: diaSeleccionado };
    if (periodoFiltro === 'mes') {
      const [anio, mes] = mesSeleccionado.split('-');
      const ultimoDia = new Date(anio, mes, 0).getDate();
      return { desde: `${anio}-${mes}-01`, hasta: `${anio}-${mes}-${ultimoDia}` };
    }
    if (periodoFiltro === 'rango') return { desde: rangoDesde, hasta: rangoHasta };
    return { desde: null, hasta: null }; // 'todo'
  };

  useEffect(() => {
    cargarGastos();
  }, [periodoFiltro, tipoFiltro, mesSeleccionado, diaSeleccionado, rangoDesde, rangoHasta]);

  useEffect(() => {
    if (modo === 'libro_iva') {
      cargarLibroIVA();
    }
  }, [modo, fechaDesdeLibro, fechaHastaLibro]);

  useEffect(() => {
    const cargarProveedores = async () => {
      try {
        const response = await api.get('/api/proveedores');
        setProveedores(response.data || []);
      } catch (err) {
        console.error('Error al cargar proveedores:', err);
      }
    };

    cargarProveedores();
  }, []);

  useEffect(() => {
    if (!productoConsulta.trim()) {
      setSugerenciasProductos([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const resp = await api.get(`/api/productos?buscar=${encodeURIComponent(productoConsulta.trim())}`);
        setSugerenciasProductos(resp.data || []);
      } catch (err) {
        setSugerenciasProductos([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productoConsulta]);

  const cargarLibroIVA = async () => {
    try {
      setCargandoLibro(true);
      const ventasResp = await api.get(`/api/reportes/historial?fecha_desde=${fechaDesdeLibro}&fecha_hasta=${fechaHastaLibro}`);
      const ventas = Array.isArray(ventasResp.data.ventas) ? ventasResp.data.ventas : [];
      const ventasArca = ventas.filter(v => v.tipo_facturacion === 'electronica' || v.comprobante_electronico_id != null);

      const comprasResp = await api.get(`/api/gastos?con_factura=1&fecha_desde=${fechaDesdeLibro}&fecha_hasta=${fechaHastaLibro}`);
      const compras = Array.isArray(comprasResp.data) ? comprasResp.data : [];
      const comprasBlanco = compras.filter(c => c.tipo_comprobante === 'factura_a' || c.tipo_comprobante === 'factura_b' || c.tipo_comprobante === 'factura_c');

      setLibroVentas(ventasArca);
      setLibroCompras(comprasBlanco);
    } catch (err) {
      console.error('Error al cargar libro de IVA:', err);
    } finally {
      setCargandoLibro(false);
    }
  };

  const exportarLibroAExcel = () => {
    const workbook = XLSX.utils.book_new();

    const ventasHoja = libroVentas.map(v => {
      const { neto, iva } = calcularIvaIncluido(Number(v.total || 0), 21);
      return {
        Fecha: new Date(v.fecha).toLocaleDateString('es-AR'),
        Cliente: v.cliente_nombre || 'Consumidor Final',
        Total: Number(v.total || 0),
        Neto: neto,
        IVA: iva,
        TipoFactura: v.tipo_facturacion || ''
      };
    });
    const comprasHoja = libroCompras.map(c => {
      const { neto, iva } = calcularIvaIncluido(Number(c.monto || 0), Number(c.porcentaje_iva || 21));
      return {
        Fecha: new Date(c.fecha).toLocaleDateString('es-AR'),
        Proveedor: c.proveedor_nombre || '',
        Total: Number(c.monto || 0),
        Neto: neto,
        IVA: iva,
        TipoComprobante: c.tipo_comprobante
      };
    });

    const wsVentas = XLSX.utils.json_to_sheet(ventasHoja);
    const wsCompras = XLSX.utils.json_to_sheet(comprasHoja);

    XLSX.utils.book_append_sheet(workbook, wsVentas, 'Ventas_Arca');
    XLSX.utils.book_append_sheet(workbook, wsCompras, 'Compras_Blanco');

    XLSX.writeFile(workbook, `libro_iva_${fechaDesdeLibro}_${fechaHastaLibro}.xlsx`);
  };

  const cargarGastos = async () => {
    try {
      setCargando(true);
      const { desde, hasta } = calcularFechas();
      const params = new URLSearchParams();
      if (desde) params.append('fecha_desde', desde);
      if (hasta) params.append('fecha_hasta', hasta);
      if (tipoFiltro !== 'todos') params.append('tipo', tipoFiltro);
      const res = await api.get(`/api/gastos?${params.toString()}`);
      setGastos(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  const eliminarGasto = async (id, descripcion) => {
    if (!window.confirm(`¿Eliminar este gasto?`)) return;
    try {
      await api.delete(`/api/gastos/${id}`);
      setExito('Gasto eliminado');
      cargarGastos();
      setTimeout(() => setExito(''), 2000);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  // ---- Editar un gasto existente ----
  // Abre el modal completo (ModalGasto) precargado con este gasto.
  const abrirEditarGasto = (gasto) => {
    setGastoEditando(gasto);
  };

  const guardarCompra = async () => {
    setErrorCompra('');
    if (!compraProductos.length) {
      setErrorCompra('Debe agregar al menos un producto a la compra');
      return;
    }

    try {
      const datos = {
        descripcion: compra.nota || 'Compra de productos',
        monto: totalCompra,
        categoria: 'Compras',
        tipo: 'compra',
        fecha: compra.fecha || null,
        metodo_pago: compra.metodo_pago,
        proveedor_id: compra.proveedor_id || null,
        es_compra: true,
        tipo_documento: compra.tipo_comprobante,
        tipo_comprobante: compra.tipo_comprobante,
        condicion_iva_proveedor: compra.condicion_iva_proveedor,
        numero_boleta: compra.numero_boleta || null,
        estado_pago: compra.estado_pago || 'pagado',
        iva_incluido: compra.tipo_comprobante === 'factura_a',
        // Solo la Factura A genera IVA crédito; el resto no debe calcular IVA
        porcentaje_iva: compra.tipo_comprobante === 'factura_a' ? 21 : 0,
        productos_json: compraProductos.map(item => ({
          id: item.id,
          codigo: item.codigo,
          nombre: item.nombre,
          categoria: item.categoria || 'Otro',
          cantidad: Number(item.cantidad),
          costo: Number(item.costo),
          precio_final: Number(item.precio_final || 0),
          ganancia_pct: calcularGananciaPct(item),
          subtotal: Number(item.subtotal),
        })),
        recibo_url: compra.recibo_url || null,
      };

      // Calcular monto a registrar segun estado de pago
      let montoFinal = totalCompra;
      let montoPagado = totalCompra;
      
      if (compra.estado_pago === 'parcial') {
        montoPagado = compra.monto_pagado || 0;
      } else if (compra.estado_pago === 'deuda') {
        montoPagado = 0;
      }

      datos.monto = montoPagado;
      datos.total_factura = totalCompra;
      datos.registrar_nueva_factura = true;
      
      await api.post('/api/gastos', datos);
      // Recargar proveedores para actualizar deudas
      const resProv = await api.get('/api/proveedores');
      setProveedores(resProv.data || []);
      setExito('Compra registrada correctamente');

      // Actualizar precios de productos si cambiaron
      for (const item of compraProductos) {
        if (item.producto_original && item.producto_original.precio !== item.precio_final) {
          try {
            await api.put(`/api/productos/${item.id}`, {
              precio_venta: item.precio_final,
              precio_costo: item.costo, // También actualizar costo si cambió
            });
          } catch (err) {
            console.error(`Error actualizando precio de ${item.nombre}:`, err);
          }
        }
      }

      setModo('gastos');
      setCompra({
        proveedor_id: '',
        fecha: new Date().toISOString().split('T')[0],
        tipo_documento: 'sin_boleta',
        tipo_comprobante: 'sin_factura',
        condicion_iva_proveedor: 'responsable_inscripto',
        numero_boleta: '',
        iva_incluido: false,
        porcentaje_iva: '21',
        metodo_pago: 'efectivo',
        nota: '',
        recibo_url: '',
      });
      setCompraProductos([]);
      setProductoConsulta('');
      setSugerenciasProductos([]);
      cargarGastos();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setErrorCompra(err.response?.data?.error || 'Error al registrar compra');
    }
  };

  const categoriasProducto = ['Insumos','Alimentos','Bebidas','Limpieza','Higiene','Otro'];

  const calcularGananciaPct = (item) => {
    const costo = Number(item.costo || 0);
    const precioFinal = Number(item.precio_final || 0);
    if (costo <= 0) return 0;
    return Number((((precioFinal - costo) / costo) * 100).toFixed(2));
  };

  const agregarProductoSugerido = (producto) => {
    setCompraProductos(prev => {
      const index = prev.findIndex(p => p.id === producto.id);
      if (index !== -1) {
        const copia = [...prev];
        copia[index].cantidad = Number(copia[index].cantidad) + 1;
        copia[index].subtotal = Number(copia[index].cantidad) * Number(copia[index].costo);
        return copia;
      }
      return [...prev, {
        id: producto.id,
        codigo: producto.codigo || '',
        nombre: producto.nombre || '',
        categoria: producto.categoria || 'Otro',
        cantidad: 1,
        costo: Number(producto.precio_costo || producto.precio_venta || producto.precio || 0),
        precio_final: Number(producto.precio_venta || producto.precio || 0),
        alicuota: Number(producto.alicuota_iva || producto.porcentaje_iva || compra.porcentaje_iva || 21),
        subtotal: Number(producto.precio_costo || producto.precio_venta || producto.precio || 0),
        producto_original: producto, // Guardar el producto original para comparar precios
      }];
    });
    setProductoConsulta('');
    setSugerenciasProductos([]);
  };

  const agregarProductoManual = () => {
    setCompraProductos(prev => [...prev, {
      id: null,
      codigo: '',
      nombre: '',
      categoria: 'Otro',
      cantidad: 1,
      costo: 0,
      precio_final: 0,
      alicuota: Number(compra.porcentaje_iva || 21),
      subtotal: 0,
      producto_original: null, // Producto manual, no hay original
    }]);
  };

  const actualizarProducto = (index, campo, valor) => {
    setCompraProductos(prev => {
      const copia = [...prev];
      copia[index] = { ...copia[index], [campo]: valor };
      const cantidad = Number(copia[index].cantidad) || 0;
      const costo = Number(copia[index].costo) || 0;
      copia[index].subtotal = Number((cantidad * costo).toFixed(2));
      return copia;
    });
  };

  const quitarProducto = (index) => {
    setCompraProductos(prev => prev.filter((_, i) => i !== index));
  };

  const calcularNetoIvaItem = (item) => {
    const cantidad = Number(item.cantidad || 0);
    const precioUnit = Number(item.costo || 0); // Usar costo como precio de compra
    const alicuota = Number(item.alicuota || compra.porcentaje_iva || 0);

    // El precio cargado SIEMPRE es lo que se paga (IVA incluido si lo hay).
    // Solo la Factura A discrimina el IVA para el crédito fiscal; el resto
    // no agrega nada encima del precio.
    let netoUnit = precioUnit;
    let ivaUnit = 0;

    if (compra.tipo_comprobante === 'factura_a') {
      netoUnit = alicuota > 0 ? precioUnit / (1 + alicuota / 100) : precioUnit;
      ivaUnit = precioUnit - netoUnit;
    }

    const totalNeto = netoUnit * cantidad;
    const totalIva = ivaUnit * cantidad;
    const total = precioUnit * cantidad;

    return {
      netoUnit: Number(netoUnit.toFixed(2)),
      ivaUnit: Number(ivaUnit.toFixed(2)),
      totalNeto: Number(totalNeto.toFixed(2)),
      totalIva: Number(totalIva.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  };

  const totalCompraBase = compraProductos.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const totalNetoProductos = compraProductos.reduce((sum, item) => sum + calcularNetoIvaItem(item).totalNeto, 0);
  const totalIvaProductos = compraProductos.reduce((sum, item) => sum + calcularNetoIvaItem(item).totalIva, 0);
  const totalConIvaProductos = Number((totalNetoProductos + totalIvaProductos).toFixed(2));
  const montoExtra = Number(compra.monto_extra || 0);
  const totalCompra = Number((totalConIvaProductos + montoExtra).toFixed(2));

  // ---- CÁLCULOS ----
  const totalGastos = gastos.reduce((acc, g) => acc + parseFloat(g.monto), 0);
  // "Gastos" = todo lo que no es compra ni pago a proveedor (incluye fijos viejos)
  const esGastoComun = (g) => g.tipo !== 'compra' && g.tipo !== 'pago_proveedor' && !g.es_compra;
  const totalVariables = gastos.filter(esGastoComun).reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const cantidadVariables = gastos.filter(esGastoComun).length;
  const totalCompras = gastos.filter(g => g.es_compra || g.tipo === 'compra').reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const cantidadCompras = gastos.filter(g => g.es_compra || g.tipo === 'compra').length;
  const totalPagosProveedores = gastos.filter(g => g.tipo === 'pago_proveedor').reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const cantidadPagosProveedores = gastos.filter(g => g.tipo === 'pago_proveedor').length;

  // Desglose por ORIGEN del dinero (de dónde salió la plata)
  const origenDe = (g) => g.origen_dinero || 'caja';
  const totalCaja = gastos.filter(g => origenDe(g) === 'caja').reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const cantidadCaja = gastos.filter(g => origenDe(g) === 'caja').length;
  const totalLocal = gastos.filter(g => origenDe(g) === 'local').reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const cantidadLocal = gastos.filter(g => origenDe(g) === 'local').length;
  const totalMp = gastos.filter(g => origenDe(g) === 'otro').reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const cantidadMp = gastos.filter(g => origenDe(g) === 'otro').length;

  // Listado visible: aplica el filtro por origen si está activo
  const gastosVisibles = filtroOrigen === 'todos' ? gastos : gastos.filter(g => origenDe(g) === filtroOrigen);

  const totalVentasLibro = libroVentas.reduce((acc, v) => acc + parseFloat(v.total || 0), 0);
  const totalIvaVentasLibro = libroVentas.reduce((acc, v) => {
    const { iva } = calcularIvaIncluido(parseFloat(v.total || 0), 21);
    return acc + iva;
  }, 0);
  const totalComprasLibro = libroCompras.reduce((acc, c) => acc + parseFloat(c.monto || 0), 0);
  const totalIvaComprasLibro = libroCompras.reduce((acc, c) => {
    const { iva } = calcularIvaIncluido(parseFloat(c.monto || 0), Number(c.porcentaje_iva || 21));
    return acc + iva;
  }, 0);
  const deudaIvaLibro = totalIvaVentasLibro - totalIvaComprasLibro;

  const formatearPeso = (n) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0
  }).format(n);

  const formatearFecha = (fecha) => new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const calcularIvaIncluido = (monto, porcentaje = 21) => {
    const neto = porcentaje > 0 ? Number((monto / (1 + porcentaje / 100)).toFixed(2)) : monto;
    const iva = Number((monto - neto).toFixed(2));
    return { neto, iva };
  };

  const iconoMetodo = (metodo) => {
    if (metodo === 'tarjeta') return '💳';
    if (metodo === 'transferencia') return '🏦';
    if (metodo === 'mercadopago') return '📱';
    return '💵';
  };

  // Helpers de presentación del libro diario
  const etiquetaTipoGasto = (g) => {
    if (g.es_compra || g.tipo === 'compra') return { emoji: '🛒', label: 'Compra', clase: 'bg-teal-100 text-teal-700' };
    if (g.tipo === 'pago_proveedor') return { emoji: '🧾', label: 'Pago proveedor', clase: 'bg-emerald-100 text-emerald-700' };
    return { emoji: '💸', label: 'Gasto', clase: 'bg-orange-100 text-orange-700' };
  };
  const etiquetaOrigen = (origen) => {
    if (origen === 'local') return '🏪 Local';
    if (origen === 'otro') return '📱 MP local';
    return '🧰 Caja';
  };
  const esEnBlanco = (g) => ['factura_a', 'factura_b', 'factura_c'].includes(g.tipo_comprobante);

  return (
    <div className="space-y-4">

      {/* Título y botón */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gastos Operativos</h2>
          <p className="text-gray-500">Control de gastos del negocio</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarModal(true)}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + Nuevo Gasto
          </button>
          <button
            onClick={() => setModo('compra')}
            title="Cargar una boleta completa a mano: productos, precios, IVA y proveedor"
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            📑 Gasto avanzado
          </button>
        </div>
      </div>

      {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">✅ {exito}</div>}

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setModo('gastos')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${modo === 'gastos' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Gastos
        </button>
        <button
          onClick={() => setModo('compra')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${modo === 'compra' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Gasto Avanzado
        </button>
      </div>

      {modo === 'compra' && (
        <div className="bg-white rounded-xl shadow p-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Nueva Compra</h3>
            <button
              onClick={() => setModo('gastos')}
              className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg"
            >
              Volver a Gastos
            </button>
          </div>

          {errorCompra && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg mt-3">❌ {errorCompra}</div>
          )}

          <div className="mt-4 border border-blue-200 bg-blue-50 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">Datos fiscales de la compra</p>
                <p className="text-xs text-blue-700 mt-1">{etiquetaComprobante[compra.tipo_comprobante] || 'Tipo de comprobante'}</p>
              </div>
              <div className="text-xs text-gray-600">
                <p>Condición IVA: {etiquetaCondicion[compra.condicion_iva_proveedor] || 'Sin condición'}</p>
              </div>
            </div>
            {compra.tipo_comprobante === 'factura_a' && (
              <div className="mt-3 p-3 rounded-lg border border-blue-300 bg-white text-blue-700 text-sm">
                <strong>Crédito Fiscal (IVA deducible)</strong><br />
                Los precios cargados se interpretan como <strong>precio con IVA incluido</strong>. El sistema calcula automáticamente el neto e IVA por producto. Podés cambiar la alícuota por producto en la tabla.
              </div>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="bg-white border border-blue-200 px-3 py-2 rounded-lg">
                <p className="text-gray-500">Neto</p>
                <p className="font-bold text-blue-800">AR$ {totalNetoProductos.toFixed(2)}</p>
              </div>
              <div className="bg-white border border-blue-200 px-3 py-2 rounded-lg">
                <p className="text-gray-500">IVA</p>
                <p className="font-bold text-blue-800">AR$ {totalIvaProductos.toFixed(2)}</p>
              </div>
              <div className="bg-white border border-blue-200 px-3 py-2 rounded-lg">
                <p className="text-gray-500">Total</p>
                <p className="font-bold text-blue-800">AR$ {totalConIvaProductos.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <select
                value={compra.proveedor_id}
                onChange={(e) => setCompra(prev => ({ ...prev, proveedor_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Sin proveedor</option>
                {proveedores.map(prov => (
                  <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={compra.fecha}
                onChange={(e) => setCompra(prev => ({ ...prev, fecha: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de comprobante</label>
              <select
                value={compra.tipo_comprobante}
                onChange={(e) => setCompra(prev => ({ ...prev, tipo_comprobante: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="sin_factura">Sin factura</option>
                <option value="factura_a">Factura A (IVA incluido)</option>
                <option value="factura_b">Factura B</option>
                <option value="factura_c">Factura C</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condición IVA del proveedor</label>
              <select
                value={compra.condicion_iva_proveedor}
                onChange={(e) => setCompra(prev => ({ ...prev, condicion_iva_proveedor: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="responsable_inscripto">Responsable Inscripto</option>
                <option value="monotributista">Monotributista</option>
                <option value="exento">Exento</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de boleta</label>
              <input
                type="text"
                value={compra.numero_boleta}
                onChange={(e) => setCompra(prev => ({ ...prev, numero_boleta: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="N° de boleta o factura"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
              <select
                value={compra.metodo_pago}
                onChange={(e) => setCompra(prev => ({ ...prev, metodo_pago: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado de pago</label>
                  <select
                    value={compra.estado_pago}
                    onChange={(e) => setCompra(prev => ({ 
                      ...prev, 
                      estado_pago: e.target.value,
                      monto_pagado: e.target.value === 'pagado' ? totalCompra : ''
                    }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="pagado">✅ Pago TOTAL</option>
                    <option value="parcial">⚠️ Pago PARCIAL</option>
                    <option value="deuda">❌ Sin pagar (DEUDA)</option>
                  </select>
                </div>
                
                {compra.estado_pago === 'parcial' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto que PAGAS AHORA *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={compra.monto_pagado || ''}
                      onChange={(e) => setCompra(prev => ({ ...prev, monto_pagado: Number(e.target.value || 0) }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
              
              {compra.estado_pago === 'parcial' && compra.monto_pagado >= 0 && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <p className="text-gray-500">Total compra</p>
                      <p className="font-bold text-gray-800">{formatearPeso(totalCompra)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Pagas ahora</p>
                      <p className="font-bold text-green-700">{formatearPeso(compra.monto_pagado || 0)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Deuda restante</p>
                      <p className="font-bold text-red-600">{formatearPeso(totalCompra - (compra.monto_pagado || 0))}</p>
                    </div>
                  </div>
                </div>
              )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costo extra</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={compra.monto_extra || ''}
                onChange={(e) => setCompra(prev => ({ ...prev, monto_extra: Number(e.target.value || 0) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="0.00"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nota</label>
              <textarea
                value={compra.nota}
                onChange={(e) => setCompra(prev => ({ ...prev, nota: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                rows={2}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Adjuntar recibo (opcional)</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setCompra(prev => ({ ...prev, recibo_url: reader.result }));
                  reader.readAsDataURL(file);
                }}
                className="w-full text-sm text-gray-600"
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-700">Buscar producto</label>
              <button
                onClick={agregarProductoManual}
                className="ml-auto px-3 py-1 rounded-lg bg-blue-500 text-white text-xs hover:bg-blue-600"
                type="button"
              >
                + Agregar producto manual
              </button>
            </div>
            <input
              type="text"
              value={productoConsulta}
              onChange={(e) => setProductoConsulta(e.target.value)}
              placeholder="Ingrese nombre o código de producto"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 mt-2"
            />
            {sugerenciasProductos.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg mt-2 max-h-44 overflow-y-auto">
                {sugerenciasProductos.map((producto) => (
                  <button
                    key={producto.id}
                    onClick={() => agregarProductoSugerido(producto)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                    type="button"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        {producto.codigo && <span className="font-bold mr-2">{producto.codigo}</span>}
                        <span className="text-gray-800">{producto.nombre}</span>
                      </div>
                      <div className="text-right text-sm text-gray-600">
                        <div>Costo: ${Number(producto.precio_costo || 0).toFixed(2)}</div>
                        <div>Venta: ${Number(producto.precio || 0).toFixed(2)}</div>
                        <div className="text-green-600">Margen: {producto.margen_ganancia || 0}%</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-xs text-gray-500">Código</th>
                  <th className="px-2 py-2 text-xs text-gray-500">Nombre</th>
                  <th className="px-2 py-2 text-xs text-gray-500">Categoría</th>
                  <th className="px-2 py-2 text-xs text-gray-500">Cantidad</th>
                  <th className="px-2 py-2 text-xs text-gray-500">Costo</th>
                  <th className="px-2 py-2 text-xs text-gray-500">Precio final</th>
                  <th className="px-2 py-2 text-xs text-gray-500">Alicuota %</th>
                  <th className="px-2 py-2 text-xs text-gray-500">Neto</th>
                  <th className="px-2 py-2 text-xs text-gray-500">IVA</th>
                  <th className="px-2 py-2 text-xs text-gray-500">Ganancia %</th>
                  <th className="px-2 py-2 text-xs text-gray-500">Acción</th>
                </tr>
              </thead>
              <tbody>
                {compraProductos.map((item, index) => (
                  <tr key={`${item.id || index}-${item.codigo}-${item.nombre}`} className="border-t border-gray-100">
                    <td className="px-2 py-2">
                      <input
                        value={item.codigo}
                        onChange={(e) => actualizarProducto(index, 'codigo', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={item.nombre}
                        onChange={(e) => actualizarProducto(index, 'nombre', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={item.categoria || 'Otro'}
                        onChange={(e) => actualizarProducto(index, 'categoria', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        {categoriasProducto.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 w-24">
                      <input
                        type="number"
                        min="0"
                        value={item.cantidad}
                        onChange={(e) => actualizarProducto(index, 'cantidad', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-2 py-2 w-28">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.costo}
                        onChange={(e) => actualizarProducto(index, 'costo', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-2 py-2 w-28">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.precio_final || 0}
                        onChange={(e) => actualizarProducto(index, 'precio_final', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-2 py-2 w-24">
                      <select
                        value={item.alicuota || compra.porcentaje_iva}
                        onChange={(e) => actualizarProducto(index, 'alicuota', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        {[0, 10.5, 21].map(a => <option key={a} value={a}>{a}%</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right">{calcularNetoIvaItem(item).totalNeto.toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{calcularNetoIvaItem(item).totalIva.toFixed(2)}</td>
                    <td className="px-2 py-2">{calcularGananciaPct(item)}%</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => quitarProducto(index)}
                        type="button"
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <div className="bg-white border border-gray-200 rounded-xl p-3 w-full max-w-md mx-auto">
              <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                <span>Subtotal</span>
                <span>AR$ {totalConIvaProductos.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                <span>Costo extra</span>
                <span>AR$ {montoExtra.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 mt-2 pt-2 flex items-center justify-between font-semibold text-lg">
                <span>Total</span>
                <span className="text-green-600">AR$ {totalCompra.toFixed(2)}</span>
              </div>
              <div className="mt-2 text-sm text-gray-600 grid grid-cols-2 gap-2">
                <div className="flex justify-between"><span>Neto</span><span>AR$ {totalNetoProductos.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>IVA (crédito fiscal)</span><span>AR$ {totalIvaProductos.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModo('gastos')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarCompra}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
            >
              Guardar compra
            </button>
          </div>
        </div>
      )}

      {modo === 'gastos' && (
        <>
          {/* ---- TARJETAS DE RESUMEN ---- */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 shadow border-l-4 border-slate-700">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide">Total del período</p>
              <p className="text-2xl font-bold text-gray-800 mt-0.5 tabular-nums">{formatearPeso(totalGastos)}</p>
              <p className="text-gray-400 text-xs mt-0.5">{gastos.length} movimiento(s)</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow border-l-4 border-red-400">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide">💸 Gastos</p>
              <p className="text-xl font-bold text-red-600 mt-0.5 tabular-nums">{formatearPeso(totalVariables)}</p>
              <p className="text-gray-400 text-xs mt-0.5">{cantidadVariables} gasto(s)</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow border-l-4 border-blue-400">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide">🛒 Compras</p>
              <p className="text-xl font-bold text-blue-600 mt-0.5 tabular-nums">{formatearPeso(totalCompras)}</p>
              <p className="text-gray-400 text-xs mt-0.5">{cantidadCompras} compra(s)</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow border-l-4 border-emerald-400">
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide">🧾 Pagos a proveedores</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5 tabular-nums">{formatearPeso(totalPagosProveedores)}</p>
              <p className="text-gray-400 text-xs mt-0.5">{cantidadPagosProveedores} pago(s)</p>
            </div>
          </div>

          {/* ---- TARJETAS POR ORIGEN DEL DINERO (clickeables) ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'caja', label: '🧰 Gastos de caja', desc: 'Salieron de la caja del turno', total: totalCaja, cant: cantidadCaja, color: 'amber' },
              { id: 'local', label: '🏪 Gastos del local', desc: 'Plata del local (otra caja)', total: totalLocal, cant: cantidadLocal, color: 'sky' },
              { id: 'otro', label: '📱 Gastos de MP', desc: 'Mercado Pago del local', total: totalMp, cant: cantidadMp, color: 'violet' },
            ].map(o => {
              const activo = filtroOrigen === o.id;
              const colores = {
                amber: activo ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300' : 'border-amber-200 hover:border-amber-400',
                sky: activo ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-300' : 'border-sky-200 hover:border-sky-400',
                violet: activo ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-300' : 'border-violet-200 hover:border-violet-400',
              }[o.color];
              return (
                <button key={o.id} type="button"
                  onClick={() => setFiltroOrigen(activo ? 'todos' : o.id)}
                  className={`text-left bg-white rounded-xl p-4 shadow border-2 transition-all ${colores}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">{o.label}</p>
                    {activo && <span className="text-[10px] bg-gray-800 text-white px-1.5 py-0.5 rounded-full">filtrando ✕</span>}
                  </div>
                  <p className="text-xl font-bold text-gray-800 mt-1 tabular-nums">{formatearPeso(o.total)}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{o.desc} · {o.cant} mov.</p>
                </button>
              );
            })}
          </div>
          {filtroOrigen !== 'todos' && (
            <p className="text-xs text-gray-500 -mt-1">
              Mostrando solo gastos de <b>{filtroOrigen === 'caja' ? 'la caja' : filtroOrigen === 'local' ? 'el local' : 'Mercado Pago'}</b>.
              <button onClick={() => setFiltroOrigen('todos')} className="text-blue-600 hover:underline ml-1">Ver todos</button>
            </p>
          )}

      {/* ---- FILTROS (como el Dashboard) ---- */}
      <div className="bg-white rounded-xl p-4 shadow flex gap-3 flex-wrap items-center">

        {/* Período */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { id: 'hoy', label: 'Hoy' },
            { id: 'dia', label: 'Por día' },
            { id: 'mes', label: 'Por mes' },
            { id: 'rango', label: 'Rango' },
            { id: 'todo', label: 'Todo' },
          ].map(f => (
            <button key={f.id}
              onClick={() => setPeriodoFiltro(f.id)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                periodoFiltro === f.id
                  ? 'bg-slate-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Selector según período */}
        {periodoFiltro === 'dia' && (
          <input type="date" value={diaSeleccionado}
            onChange={(e) => setDiaSeleccionado(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
        )}
        {periodoFiltro === 'mes' && (
          <input type="month" value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
        )}
        {periodoFiltro === 'rango' && (
          <div className="flex gap-2 items-center flex-wrap">
            <input type="date" value={rangoDesde}
              onChange={(e) => setRangoDesde(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
            <span className="text-gray-400 text-sm">hasta</span>
            <input type="date" value={rangoHasta}
              onChange={(e) => setRangoHasta(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
          </div>
        )}

        <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block" />

        {/* Tipo de movimiento */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'variable', label: '💸 Gastos' },
            { id: 'compra', label: '🛒 Compras' },
            { id: 'pago_proveedor', label: '🧾 Pagos prov.' },
          ].map(t => (
            <button key={t.id}
              onClick={() => setTipoFiltro(t.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                tipoFiltro === t.id
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

      </div>

      {/* ---- LIBRO DIARIO DE GASTOS ---- */}
      <div className="bg-white rounded-xl shadow overflow-hidden">

        {/* Vista móvil: tarjetas */}
        <div className="sm:hidden divide-y divide-gray-100">
          {cargando ? (
            <p className="text-center py-8 text-gray-400">Cargando gastos...</p>
          ) : gastosVisibles.length === 0 ? (
            <p className="text-center py-10 text-gray-400">💸 No hay movimientos en este período</p>
          ) : (
            gastosVisibles.map(gasto => (
              <div key={gasto.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 leading-snug">
                      {etiquetaTipoGasto(gasto).emoji} {gasto.descripcion || etiquetaTipoGasto(gasto).label}
                      {gasto.recibo_url && ' 📎'}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatearFecha(gasto.fecha)}
                      {gasto.proveedor_nombre ? ` · ${gasto.proveedor_nombre}` : ''}
                      {' · '}{gasto.usuario_nombre || 'Admin'}
                    </p>
                  </div>
                  <p className="font-bold text-red-600 tabular-nums flex-shrink-0">{formatearPeso(gasto.monto)}</p>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex gap-1.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{iconoMetodo(gasto.metodo_pago)} {gasto.metodo_pago}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{etiquetaOrigen(gasto.origen_dinero)}</span>
                    {esEnBlanco(gasto) && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">🧾 Factura A</span>}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => abrirEditarGasto(gasto)} className="text-xs bg-blue-100 active:bg-blue-200 text-blue-700 px-2 py-1 rounded">✏️</button>
                    <button onClick={() => eliminarGasto(gasto.id)} className="text-xs bg-red-100 active:bg-red-200 text-red-700 px-2 py-1 rounded">🗑️</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Vista escritorio: tabla */}
        <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Fecha</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Descripción</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Tipo</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Proveedor</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Fiscal</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Pago</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Usuario</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Monto</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr><td colSpan="9" className="text-center py-8 text-gray-400">Cargando gastos...</td></tr>
            ) : gastosVisibles.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-2">💸</p>
                  <p>No hay movimientos en este período</p>
                </td>
              </tr>
            ) : (
              gastosVisibles.map(gasto => (
                <tr key={gasto.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                    {formatearFecha(gasto.fecha)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-sm max-w-[260px]">
                    <span className="block truncate">{gasto.descripcion || <span className="text-gray-400">-</span>}</span>
                    {gasto.recibo_url && (
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = gasto.recibo_url;
                          link.download = `boleta_${gasto.id}.${gasto.recibo_url.includes('data:image') ? 'png' : 'pdf'}`;
                          link.target = '_blank';
                          link.click();
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800"
                        title="Descargar adjunto">
                        📎 ver adjunto
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${etiquetaTipoGasto(gasto).clase}`}>
                      {etiquetaTipoGasto(gasto).emoji} {etiquetaTipoGasto(gasto).label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-sm">
                    {gasto.proveedor_nombre || <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {esEnBlanco(gasto) ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold whitespace-nowrap" title="En blanco: suma IVA crédito al Resumen Fiscal">🧾 Fact. A</span>
                    ) : (
                      <span className="text-xs text-gray-400">X</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">
                    <div>{iconoMetodo(gasto.metodo_pago)} {gasto.metodo_pago}</div>
                    <span className="text-[10px] text-gray-400">{etiquetaOrigen(gasto.origen_dinero)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">
                    {gasto.usuario_nombre || 'Admin'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-600 tabular-nums whitespace-nowrap">
                    {formatearPeso(gasto.monto)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => abrirEditarGasto(gasto)}
                        className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-sm transition-colors">
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarGasto(gasto.id)}
                        className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm transition-colors">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
      </>
      )}

      {/* Modal */}
      {mostrarModal && (
        <ModalGasto
          onCerrar={() => setMostrarModal(false)}
          onGuardado={() => {
            cargarGastos();
            setExito('Gasto registrado correctamente');
            setTimeout(() => setExito(''), 3000);
          }}
        />
      )}

      {/* Modal Editar Gasto: ahora abre el MISMO modal completo que "Nuevo Gasto",
          precargado, para poder editar todos los campos (incluida la fecha). */}
      {gastoEditando && (
        <ModalGasto
          gastoExistente={gastoEditando}
          onCerrar={() => setGastoEditando(null)}
          onGuardado={() => {
            cargarGastos();
            setExito('Gasto actualizado');
            setTimeout(() => setExito(''), 2500);
          }}
        />
      )}
    </div>
  );
}

export default Gastos;