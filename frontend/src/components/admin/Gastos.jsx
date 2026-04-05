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
export function ModalGasto({ onCerrar, onGuardado, modoCompra = false }) {

  const [tabActiva, setTabActiva] = useState('gasto'); // 'gasto' | 'proveedor'
  const [formulario, setFormulario] = useState({
    descripcion: '',
    monto: '',
    categoria: '',
    tipo: 'variable',
    metodo_pago: 'efectivo',
    proveedor_id: '',
    tipo_pago_proveedor: 'a_cuenta',
    recibo_url: '',
    es_compra: false,
    tipo_documento: 'sin_boleta',
    iva_incluido: false,
    porcentaje_iva: '0',
    productos_texto: '',
    registrar_factura: false,
    total_factura: '',
    pago_independiente: false,
    fecha: new Date().toISOString().split('T')[0]
  });
  const [proveedores, setProveedores] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const categorias = [
    'Insumos',
    'Servicios',
    'Limpieza',
    'Sueldos',
    'Alquiler',
    'Mantenimiento',
    'Transporte',
    'Impuestos',
    'Otro',
  ];

  // Cargar proveedores cuando se abre el modal
  useEffect(() => {
    cargarProveedores();
  }, []);

  useEffect(() => {
    if (modoCompra) {
      setFormulario(p => ({ ...p, es_compra: true, tipo: 'compra', categoria: 'Compras' }));
    }
  }, [modoCompra]);

  const proveedorSeleccionado = proveedores.find(p => String(p.id) === String(formulario.proveedor_id));
  
  // Debug: mostrar datos del proveedor seleccionado
  useEffect(() => {
    if (proveedorSeleccionado) {
      console.log('🔍 Proveedor seleccionado:', {
        id: proveedorSeleccionado.id,
        nombre: proveedorSeleccionado.nombre,
        saldo_deuda: proveedorSeleccionado.saldo_deuda,
        saldo_a_favor: proveedorSeleccionado.saldo_a_favor,
        proveedor_id_formulario: formulario.proveedor_id
      });
    }
  }, [proveedorSeleccionado, formulario.proveedor_id]);
  
  const cargarProveedores = async () => {
    try {
      const res = await api.get('/api/proveedores');
      console.log('📥 Proveedores cargados:', res.data);
      setProveedores(res.data);
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    }
  };

  const convertirArchivoADataURL = async (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);

    try {
      const ivaPct = Number(formulario.porcentaje_iva || 0);
      const esCompra = formulario.es_compra;
      const incluyeIva = formulario.iva_incluido;
      const monto = Number(formulario.monto || 0);
      let montoIva = 0;
      if (ivaPct > 0) {
        if (incluyeIva) {
          montoIva = Number((monto * ivaPct / (100 + ivaPct)).toFixed(2));
        } else {
          montoIva = Number((monto * ivaPct / 100).toFixed(2));
        }
      }

      const esPagoProveedor = tabActiva === 'proveedor';
      
      const datosEnvio = {
        descripcion: formulario.descripcion,
        monto: formulario.monto,
        categoria: esPagoProveedor ? 'Proveedores' : (esCompra ? 'Compras' : formulario.categoria),
        tipo: esCompra ? 'compra' : (esPagoProveedor ? 'pago_proveedor' : formulario.tipo),
        metodo_pago: formulario.metodo_pago,
        proveedor_id: formulario.proveedor_id || null,
        tipo_pago_proveedor: formulario.tipo_pago_proveedor,
        es_compra: esCompra,
        tipo_documento: formulario.tipo_documento,
        iva_incluido: incluyeIva,
        porcentaje_iva: ivaPct,
        monto_iva: montoIva,
        productos_json: formulario.productos_texto ? formulario.productos_texto.split('\n').map(item => item.trim()).filter(Boolean) : null,
        recibo_url: formulario.recibo_url,
        registrar_nueva_factura: formulario.registrar_factura || false,
        total_factura: formulario.total_factura || null,
        pago_independiente: formulario.pago_independiente
      };

      if (esPagoProveedor && formulario.proveedor_id) {
        datosEnvio.tipo = 'pago_proveedor';
        datosEnvio.proveedor_id = formulario.proveedor_id;
        
        // Logica para registrar nueva factura
        if (formulario.registrar_factura && formulario.total_factura) {
          // Si es factura nueva, primero sumamos el total a la deuda y luego restamos lo que se paga
          datosEnvio.registrar_nueva_factura = true;
          datosEnvio.total_factura = formulario.total_factura;
          console.log('✅ Toggle activado - registrar_nueva_factura:', datosEnvio.registrar_nueva_factura, 'total_factura:', datosEnvio.total_factura);
        } else {
          console.log('❌ Toggle NO activado - registrar_factura:', formulario.registrar_factura, 'total_factura:', formulario.total_factura);
        }
        
        // Si es pago independiente no modificamos la deuda
        if (formulario.pago_independiente) {
          datosEnvio.tipo = 'variable';
          datosEnvio.descripcion = formulario.descripcion || 'Pago independiente';
        } else {
          // Determinar descripción basada en el monto pagado vs total de factura
          const montoPago = Number(formulario.monto || 0);
          const totalFactura = Number(formulario.total_factura || 0);
          
          console.log('📊 Calculando descripción - montoPago:', montoPago, 'totalFactura:', totalFactura, 'registrar_factura:', formulario.registrar_factura);
          
          if (formulario.registrar_factura && totalFactura > 0) {
            // Hay una nueva factura registrada
            if (montoPago >= totalFactura) {
              datosEnvio.descripcion = formulario.descripcion || 'Pago total de factura';
              console.log('✅ PAGO TOTAL - descripción:', datosEnvio.descripcion);
            } else if (montoPago > 0) {
              datosEnvio.descripcion = formulario.descripcion || 'Pago parcial de factura';
              console.log('⚠️ PAGO PARCIAL - descripción:', datosEnvio.descripcion);
            } else {
              datosEnvio.descripcion = formulario.descripcion || 'Registro de factura (sin pago)';
              console.log('📝 SIN PAGO - descripción:', datosEnvio.descripcion);
            }
          } else {
            // Pago sin nueva factura
            if (formulario.tipo_pago_proveedor === 'a_cuenta') {
              datosEnvio.descripcion = formulario.descripcion || 'Pago a cuenta de deuda';
              console.log('💸 PAGO A CUENTA - descripción:', datosEnvio.descripcion);
            } else {
              datosEnvio.descripcion = formulario.descripcion || 'Pago nuevo/anticipo';
              console.log('💰 PAGO NUEVO - descripción:', datosEnvio.descripcion);
            }
          }
        }
      }

      await api.post('/api/gastos', datosEnvio);
      // Recargar proveedores para actualizar deudas
      await cargarProveedores();
      if (onGuardado) onGuardado();
      onCerrar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el gasto');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">

        {/* Encabezado */}
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-bold text-gray-800">Nuevo Gasto</h3>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
        </div>

        {/* Pestañas */}
        <div className="flex border-b">
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

        <form onSubmit={guardar} className="p-5 space-y-4">

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
              ❌ {error}
            </div>
          )}

          {tabActiva === 'gasto' && (
            <>
              {/* Monto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MONTO *</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formulario.monto}
                      onChange={(e) => setFormulario(p => ({ ...p, monto: e.target.value }))}
                      required min="0" step="0.01"
                      autoFocus
                      className="w-full border border-gray-300 rounded-lg pl-3 pr-3 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 text-lg"
                      placeholder="$0,00"
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 border-blue-200">
                    <div>
                      <p className="text-sm font-medium text-blue-700">Gasto fijo</p>
                      <p className="text-xs text-blue-500">Se repite mensualmente</p>
                    </div>
                    <div 
                      className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer ${
                        formulario.tipo === 'fijo' ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                      onClick={() => setFormulario(p => ({
                        ...p,
                        tipo: p.tipo === 'fijo' ? 'variable' : 'fijo'
                      }))}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        formulario.tipo === 'fijo' ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CATEGORÍA *</label>
                  <select
                    value={formulario.categoria}
                    onChange={(e) => setFormulario(p => ({ ...p, categoria: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">FECHA</label>
                  <input
                    type="date"
                    value={formulario.fecha}
                    onChange={(e) => setFormulario(p => ({ ...p, fecha: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
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
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DESCRIPCIÓN</label>
                <textarea
                  value={formulario.descripcion}
                  onChange={(e) => setFormulario(p => ({ ...p, descripcion: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  placeholder="Detalles opcionales..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-700 mb-1">📋 Datos fiscales</p>
                <select
                  value={formulario.tipo_documento}
                  onChange={(e) => setFormulario(p => ({ ...p, tipo_documento: e.target.value }))}
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 mt-2"
                >
                  <option value="sin_boleta">Sin comprobante</option>
                  <option value="boleta">Boleta</option>
                  <option value="factura">Factura</option>
                </select>
              </div>
            </>
          )}

          {tabActiva === 'proveedor' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">🧾 PROVEEDOR *</label>
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

              <div className="grid grid-cols-2 gap-4">
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
                    </select>
                  </div>
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

              {/* Toggle pago independiente - TEMPORALMENTE COMENTADO
              <div
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  formulario.pago_independiente
                    ? 'bg-gray-50 border-gray-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
                onClick={() => setFormulario(p => ({
                  ...p,
                  pago_independiente: !p.pago_independiente
                }))}
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">Pago independiente</p>
                  <p className="text-xs text-gray-500">No cancela compras ni afecta la deuda del proveedor</p>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${
                  formulario.pago_independiente ? 'bg-gray-500' : 'bg-gray-300'
                }`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    formulario.pago_independiente ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </div>
              </div>
              */}
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
              {guardando ? 'Guardando...' : 'Registrar gasto'}
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

  // ---- FILTROS ----
  // periodoFiltro: 'hoy', 'mes', 'personalizado'
  const [periodoFiltro, setPeriodoFiltro] = useState('hoy');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  });

  // Calculamos las fechas según el período seleccionado
  const calcularFechas = () => {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset() * 60000;
      const local = new Date(hoy - offset);
      const hoyStr = local.toISOString().split('T')[0];

    if (periodoFiltro === 'hoy') {
      // Solo el día de hoy
      return { desde: hoyStr, hasta: hoyStr };
    }

    if (periodoFiltro === 'mes') {
      // Mes actual completo
      const primerDia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
      return { desde: primerDia, hasta: hoyStr };
    }

    if (periodoFiltro === 'personalizado') {
      // Mes elegido por el usuario
      const [anio, mes] = mesSeleccionado.split('-');
      const primerDia = `${anio}-${mes}-01`;
      const ultimoDia = new Date(anio, mes, 0).getDate();
      const ultimoDiaStr = `${anio}-${mes}-${ultimoDia}`;
      return { desde: primerDia, hasta: ultimoDiaStr };
    }
  };

  useEffect(() => {
    cargarGastos();
  }, [periodoFiltro, tipoFiltro, mesSeleccionado]);

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

      const comprasResp = await api.get(`/api/gastos?es_compra=1&fecha_desde=${fechaDesdeLibro}&fecha_hasta=${fechaHastaLibro}`);
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
      const res = await api.get(
        `/api/gastos?fecha_desde=${desde}&fecha_hasta=${hasta}&tipo=${tipoFiltro}`
      );
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
        metodo_pago: compra.metodo_pago,
        proveedor_id: compra.proveedor_id || null,
        es_compra: true,
        tipo_documento: compra.tipo_comprobante,
        tipo_comprobante: compra.tipo_comprobante,
        condicion_iva_proveedor: compra.condicion_iva_proveedor,
        numero_boleta: compra.numero_boleta || null,
        estado_pago: compra.estado_pago || 'pagado',
        iva_incluido: compra.tipo_comprobante === 'factura_a',
        porcentaje_iva: 21,
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

    let netoUnit = precioUnit;
    let ivaUnit = 0;

    if (compra.tipo_comprobante === 'factura_a') {
      netoUnit = alicuota > 0 ? precioUnit / (1 + alicuota / 100) : precioUnit;
      ivaUnit = precioUnit - netoUnit;
    } else {
      ivaUnit = netoUnit * (alicuota / 100);
    }

    const totalNeto = netoUnit * cantidad;
    const totalIva = ivaUnit * cantidad;
    const total = (compra.tipo_comprobante === 'factura_a'
      ? precioUnit : precioUnit + ivaUnit) * cantidad;

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
  const totalFijos = gastos.filter(g => g.tipo === 'fijo').reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const totalVariables = gastos.filter(g => g.tipo === 'variable').reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const totalPagosProveedores = gastos.filter(g => g.tipo === 'pago_proveedor').reduce((acc, g) => acc + parseFloat(g.monto), 0);
  const cantidadFijos = gastos.filter(g => g.tipo === 'fijo').length;
  const cantidadVariables = gastos.filter(g => g.tipo === 'variable').length;
  const cantidadPagosProveedores = gastos.filter(g => g.tipo === 'pago_proveedor').length;

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
    return '💵';
  };

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
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + Nuevo Gasto AVANZADO
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* Total */}
        <div className="bg-red-500 text-white rounded-xl p-5 shadow">
          <p className="text-red-100 text-sm font-medium uppercase">TOTAL</p>
          <p className="text-3xl font-bold mt-1">{formatearPeso(totalGastos)}</p>
          <p className="text-red-100 text-sm mt-1">{gastos.length} gastos</p>
        </div>

        {/* Fijos */}
        <div className="bg-white rounded-xl p-5 shadow border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm font-medium uppercase">FIJOS</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatearPeso(totalFijos)}</p>
          <p className="text-gray-400 text-sm mt-1">{cantidadFijos} gastos</p>
        </div>

        {/* Variables */}
        <div className="bg-white rounded-xl p-5 shadow border-l-4 border-orange-500">
          <p className="text-gray-500 text-sm font-medium uppercase">VARIABLES</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{formatearPeso(totalVariables)}</p>
          <p className="text-gray-400 text-sm mt-1">{cantidadVariables} gastos</p>
        </div>

        {/* Pagos a proveedores */}
        <div className="bg-white rounded-xl p-5 shadow border-l-4 border-green-500">
          <p className="text-gray-500 text-sm font-medium uppercase">PAGOS PROVEEDORES</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatearPeso(totalPagosProveedores)}</p>
          <p className="text-gray-400 text-sm mt-1">{cantidadPagosProveedores} pagos</p>
        </div>

      </div>

      {/* ---- FILTROS ---- */}
      <div className="bg-white rounded-xl p-4 shadow flex gap-3 flex-wrap items-center">

        {/* Filtros de período */}
        <div className="flex gap-2">
          {/* Botón HOY */}
          <button
            onClick={() => setPeriodoFiltro('hoy')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              periodoFiltro === 'hoy'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Hoy
          </button>

          {/* Botón ESTE MES */}
          <button
            onClick={() => setPeriodoFiltro('mes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              periodoFiltro === 'mes'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Este mes
          </button>

          {/* Botón PERSONALIZADO */}
          <button
            onClick={() => setPeriodoFiltro('personalizado')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              periodoFiltro === 'personalizado'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Otro mes
          </button>
        </div>

        {/* Selector de mes (solo visible cuando eligió personalizado) */}
        {periodoFiltro === 'personalizado' && (
          <input
            type="month"
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        )}

        {/* Separador */}
        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Filtro por tipo */}
        <div className="flex gap-2">
          {['todos', 'fijo', 'variable'].map(tipo => (
            <button
              key={tipo}
              onClick={() => setTipoFiltro(tipo)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                tipoFiltro === tipo
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tipo === 'todos' ? 'Todos' : tipo === 'fijo' ? 'Fijos' : 'Variables'}
            </button>
          ))}
        </div>

      </div>

      {/* ---- TABLA DE GASTOS ---- */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Fecha</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Proveedor</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Categoría</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Tipo Gasto</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Comprobante</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Método Pago</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Usuario</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Descripción</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium">Adjunto</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Monto</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr><td colSpan="11" className="text-center py-8 text-gray-400">Cargando gastos...</td></tr>
            ) : gastos.length === 0 ? (
              <tr>
                <td colSpan="11" className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-2">💸</p>
                  <p>No hay gastos en este período</p>
                </td>
              </tr>
            ) : (
gastos.map(gasto => (
                <tr key={gasto.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                    {formatearFecha(gasto.fecha)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-sm">
                    {gasto.proveedor_nombre ? (
                      <span className="font-medium text-gray-800">{gasto.proveedor_nombre}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {gasto.categoria || <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      gasto.tipo === 'fijo'
                        ? 'bg-blue-100 text-blue-700'
                        : gasto.tipo === 'pago_proveedor'
                          ? 'bg-green-100 text-green-700'
                          : gasto.tipo === 'compra'
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-orange-100 text-orange-700'
                    }`}>
                      {gasto.tipo === 'fijo' ? '📌 Fijo' : gasto.tipo === 'pago_proveedor' ? '🧾 Pago Proveedor' : gasto.tipo === 'compra' ? '🛒 Compra' : '📄 Variable'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-sm">
                    {gasto.tipo_documento ? gasto.tipo_documento.replace('_', ' ').toUpperCase() : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {iconoMetodo(gasto.metodo_pago)} {gasto.metodo_pago}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(gasto.usuario_nombre || 'A').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-600 text-sm">{gasto.usuario_nombre || 'Admin'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {gasto.descripcion || <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {gasto.recibo_url ? (
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = gasto.recibo_url;
                          link.download = `boleta_${gasto.id}.${gasto.recibo_url.includes('data:image') ? 'png' : 'pdf'}`;
                          link.target = '_blank';
                          link.click();
                        }}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                        title="Descargar boleta"
                      >
                        📎 {gasto.recibo_url.includes('data:image') ? '🖼️' : '📄'}
                      </button>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">
                    {formatearPeso(gasto.monto)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => eliminarGasto(gasto.id)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm transition-colors">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
    </div>
  );
}

export default Gastos;