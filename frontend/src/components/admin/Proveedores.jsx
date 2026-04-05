import { useState, useEffect } from 'react';
import api from '../../api/axios';

function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [tabActivo, setTabActivo] = useState('activos');
  const [ordenamiento, setOrdenamiento] = useState('nombre');
  const [tipoPagoContext, setTipoPagoContext] = useState('pago_a_cuenta');
  const [boletaPreview, setBoletaPreview] = useState('');
  const [filtrosHistorial, setFiltrosHistorial] = useState({
    periodo: 'todos',
    fechaDesde: '',
    fechaHasta: ''
  });
  const [mostrarEditarGasto, setMostrarEditarGasto] = useState(false);
  const [gastoSeleccionado, setGastoSeleccionado] = useState(null);
  const [mostrarInfoProveedor, setMostrarInfoProveedor] = useState(false);
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(false);
  const [mostrarDetalleUltimoGasto, setMostrarDetalleUltimoGasto] = useState(false);
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');

  const [formulario, setFormulario] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    notas: '',
  });

  const [formPago, setFormPago] = useState({
    monto: '',
    metodo_pago: 'efectivo',
    tipo_pago: 'pago_deuda',
    descripcion: '',
    recibo_url: '',
  });

  const estadisticasMes = proveedorSeleccionado?.estadisticas_por_mes ?? [];
  const maxGastoMes = estadisticasMes.length > 0 ? Math.max(...estadisticasMes.map(m => Number(m.total) || 0)) : 1;

  // ---- CARGAR PROVEEDORES ----
  useEffect(() => {
    cargarProveedores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActivo, ordenamiento]);

  useEffect(() => {
    const timeout = setTimeout(() => cargarProveedores(), 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const cargarProveedores = async () => {
    try {
      setCargando(true);
      const activoParam = tabActivo === 'archivados' ? 'false' : 'true';
      const res = await api.get(`/api/proveedores?activo=${activoParam}&buscar=${busqueda}`);
      let data = res.data || [];

      if (ordenamiento === 'deuda') {
        data = data.sort((a, b) => (b.saldo_deuda || 0) - (a.saldo_deuda || 0));
      } else if (ordenamiento === 'favorecido') {
        data = data.sort((a, b) => (b.saldo_a_favor || 0) - (a.saldo_a_favor || 0));
      } else {
        data = data.sort((a, b) => a.nombre.localeCompare(b.nombre));
      }

      setProveedores(data);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar proveedores');
    } finally {
      setCargando(false);
    }
  };

  // ---- CREAR/EDITAR ----
  const guardarProveedor = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (!formulario.nombre.trim()) {
        setError('El nombre es obligatorio');
        return;
      }

      if (proveedorSeleccionado?.id) {
        // Editar
        await api.put(`/api/proveedores/${proveedorSeleccionado.id}`, formulario);
        setExito('Proveedor actualizado');
      } else {
        // Crear
        await api.post('/api/proveedores', formulario);
        setExito('Proveedor creado');
      }

      setMostrarModal(false);
      setFormulario({ nombre: '', telefono: '', email: '', direccion: '', notas: '' });
      setProveedorSeleccionado(null);
      cargarProveedores();

      setTimeout(() => setExito(''), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar proveedor');
    }
  };

  // ---- ABRIR MODAL CREAR ----
  const abrirModalCrear = () => {
    setProveedorSeleccionado(null);
    setFormulario({ nombre: '', telefono: '', email: '', direccion: '', notas: '' });
    setMostrarModal(true);
  };

  // ---- ABRIR MODAL EDITAR ----
  const abrirModalEditar = (proveedor) => {
    setProveedorSeleccionado(proveedor);
    setFormulario({
      nombre: proveedor.nombre,
      telefono: proveedor.telefono || '',
      email: proveedor.email || '',
      direccion: proveedor.direccion || '',
      notas: proveedor.notas || '',
    });
    setMostrarModal(true);
  };

  // ---- VER DETALLE ----
  const verDetalle = async (proveedor, filtros = null) => {
    try {
      const filtrosActuales = filtros || filtrosHistorial;
      const params = new URLSearchParams();
      if (filtrosActuales.periodo !== 'todos') params.append('periodo', filtrosActuales.periodo);
      if (filtrosActuales.fechaDesde) params.append('fecha_desde', filtrosActuales.fechaDesde);
      if (filtrosActuales.fechaHasta) params.append('fecha_hasta', filtrosActuales.fechaHasta);

      const url = `/api/proveedores/${proveedor.id}${params.toString() ? '?' + params.toString() : ''}`;
      const res = await api.get(url);
      setProveedorSeleccionado(res.data);
      setMostrarDetalle(true);
    } catch (err) {
      console.error('Error al cargar detalle del proveedor:', err);
      setError('Error al cargar detalle');
    }
  };

  // ---- EDITAR GASTO ----
  const editarGasto = (gasto) => {
    setGastoSeleccionado(gasto);
    setMostrarEditarGasto(true);
  };

  const guardarEdicionGasto = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Asegurarse de que la fecha esté en formato correcto (YYYY-MM-DD)
      let fechaFormato = gastoSeleccionado.fecha;
      if (typeof fechaFormato === 'string' && fechaFormato.includes('T')) {
        fechaFormato = fechaFormato.split('T')[0];
      } else if (typeof fechaFormato === 'string' && !fechaFormato.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Si no está en formato YYYY-MM-DD, intentar parsearlo
        const date = new Date(fechaFormato);
        fechaFormato = date.toISOString().split('T')[0];
      }

      const datosActualizacion = {
        descripcion: gastoSeleccionado.descripcion || '',
        monto: parseFloat(gastoSeleccionado.monto),
        metodo_pago: gastoSeleccionado.metodo_pago || 'efectivo',
        tipo: gastoSeleccionado.tipo || 'variable',
        fecha: fechaFormato,
        categoria: gastoSeleccionado.categoria || null,
        turno_id: gastoSeleccionado.turno_id || null,
        proveedor_id: proveedorSeleccionado.id,
        recibo_url: gastoSeleccionado.recibo_url || null
      };

      console.log('Enviando datos de actualización:', datosActualizacion);
      await api.put(`/api/gastos/${gastoSeleccionado.id}`, datosActualizacion);
      setExito('Gasto actualizado');
      setMostrarEditarGasto(false);
      setGastoSeleccionado(null);
      // Recargar detalle
      await verDetalle(proveedorSeleccionado);
      setTimeout(() => setExito(''), 2000);
    } catch (err) {
      console.error('Error completo:', err);
      const mensajeError = err.response?.data?.error || err.message || 'Error desconocido';
      setError('Error al actualizar gasto: ' + mensajeError);
    }
  };

  const eliminarGasto = async (gastoId) => {
    if (!window.confirm('¿Eliminar este gasto?')) return;
    try {
      await api.delete(`/api/gastos/${gastoId}`);
      setExito('Gasto eliminado');
      await verDetalle(proveedorSeleccionado);
      setTimeout(() => setExito(''), 2000);
    } catch (err) {
      setError('Error al eliminar gasto');
    }
  };

  const manejarArchivoBoleta = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFormPago(p => ({ ...p, recibo_url: reader.result }));
      setBoletaPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // ---- REGISTRAR PAGO ----
  const registrarPago = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (!formPago.monto || formPago.monto <= 0) {
        setError('El monto debe ser mayor a 0');
        return;
      }

      const tipoPago = tipoPagoContext === 'pago_a_cuenta' ? 'pago_deuda' : tipoPagoContext === 'cobro_deuda' ? 'cobro_deuda' : 'ajuste_credito';
      const descripcionPago = formPago.descripcion || (tipoPago === 'pago_deuda' ? 'Pago a cuenta de deuda' : tipoPago === 'cobro_deuda' ? 'Cobro de deuda' : 'Pago nuevo / crédito');

      await api.post(`/api/proveedores/${proveedorSeleccionado.id}/pago`, {
        monto: parseFloat(formPago.monto),
        metodo_pago: formPago.metodo_pago,
        tipo_pago: tipoPago,
        descripcion: descripcionPago,
        recibo_url: formPago.recibo_url || null,
      });

      setExito('Pago registrado');
      setMostrarModalPago(false);
      setFormPago({ monto: '', metodo_pago: 'efectivo', tipo_pago: 'pago_deuda', descripcion: '', recibo_url: '' });
      setBoletaPreview('');
      setTipoPagoContext('pago_a_cuenta');
      
      // Recargar detalle
      const res = await api.get(`/api/proveedores/${proveedorSeleccionado.id}`);
      setProveedorSeleccionado(res.data);
      
      cargarProveedores();
      setTimeout(() => setExito(''), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar pago');
    }
  };

 // ---- ARCHIVAR ----
  const archivarProveedor = async (id, nombre) => {
    if (!window.confirm(`¿Archivar "${nombre}"? Podrás reactivarlo después desde la pestaña Archivados.`)) return;
    try {
      await api.delete(`/api/proveedores/${id}`);
      setExito('Proveedor archivado');
      setMostrarDetalle(false);
      cargarProveedores();
      setTimeout(() => setExito(''), 2000);
    } catch (err) {
      setError('Error al archivar proveedor');
    }
  };

  // ---- REACTIVAR ----
  const reactivarProveedor = async (id, nombre) => {
    if (!window.confirm(`¿Reactivar "${nombre}"?`)) return;
    try {
      await api.patch(`/api/proveedores/${id}/reactivar`);
      setExito('Proveedor reactivado');
      setMostrarDetalle(false);
      cargarProveedores();
      setTimeout(() => setExito(''), 2000);
    } catch (err) {
      setError('Error al reactivar proveedor');
    }
  };

  // ---- ELIMINAR DEFINITIVO ----
  const eliminarProveedor = async (id, nombre) => {
    if (!window.confirm(`⚠️ ¿Eliminar DEFINITIVAMENTE "${nombre}"? Esta acción no se puede deshacer y borrará todos sus datos.`)) return;
    if (!window.confirm(`Segunda confirmación: ¿Seguro que querés eliminar "${nombre}" para siempre?`)) return;
    try {
      await api.delete(`/api/proveedores/${id}/definitivo`);
      setExito('Proveedor eliminado definitivamente');
      setMostrarDetalle(false);
      cargarProveedores();
      setTimeout(() => setExito(''), 2000);
    } catch (err) {
      setError('Error al eliminar proveedor');
    }
  };

  const formatearPeso = (n) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0
  }).format(n || 0);

  // ---- ABRIR PAGO DESDE LISTADO (click en saldo) ----
  const abrirPagoDesdeListado = async (prov, tipoPago) => {
    try {
      const res = await api.get(`/api/proveedores/${prov.id}`);
      setProveedorSeleccionado(res.data);
      setTipoPagoContext(tipoPago);
      setMostrarModalPago(true);
      setFormPago({ monto: '', metodo_pago: 'efectivo', tipo_pago: 'pago_deuda', descripcion: '', recibo_url: '' });
      setBoletaPreview('');
    } catch (err) {
      setError('Error al cargar datos del proveedor');
    }
  };

  const calcularTotales = () => {
    const total = proveedores.length;
    const deuda = proveedores.reduce((sum, p) => sum + (p.saldo_deuda || 0), 0);
    const favor = proveedores.reduce((sum, p) => sum + (p.saldo_a_favor || 0), 0);
    const cuentaNeta = favor - deuda;
    return { total, deuda, favor, cuentaNeta };
  };

  const { total, deuda, favor, cuentaNeta } = calcularTotales();

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const descargarBoleta = (url, id) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `boleta_pago_${id}.${url.includes('data:image') ? 'png' : 'pdf'}`;
    link.target = '_blank';
    link.click();
  };

  const esImagen = (url) => url && url.includes('data:image');
  const esPDF = (url) => url && url.includes('data:application/pdf');

  return (
    <div className="space-y-4">
      <style>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">📦 Proveedores</h2>
          <p className="text-gray-500">Gestión de proveedores y cuentas</p>
        </div>
        <button
          onClick={abrirModalCrear}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-bold shadow-lg transition-colors"
        >
          + Nuevo Proveedor
        </button>
      </div>

      {/* Filtros secundario */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-col md:flex-row items-start md:items-center gap-3 justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTabActivo('activos')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${tabActivo === 'activos' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >Activos</button>
          <button
            onClick={() => setTabActivo('archivados')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${tabActivo === 'archivados' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >Archivados</button>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-sm text-gray-600">Ordenar por:</span>
          <select
            value={ordenamiento}
            onChange={(e) => setOrdenamiento(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="nombre">Alfabético</option>
            <option value="deuda">Mayor deuda</option>
            <option value="favorecido">Mayor saldo a favor</option>
          </select>
        </div>
      </div>

      {/* Tarjetas estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow border-l-4 border-indigo-500">
          <p className="text-xs uppercase tracking-wider text-gray-500">Proveedores</p>
          <p className="text-3xl font-bold text-gray-800">{total}</p>
          <p className="text-sm text-gray-500 mt-1">activos en vista</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow border-l-4 border-red-500">
          <p className="text-xs uppercase tracking-wider text-gray-500">Deuda total</p>
          <p className="text-3xl font-bold text-red-600">{formatearPeso(deuda)}</p>
          <p className="text-sm text-gray-500 mt-1">monto pendiente</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow border-l-4 border-blue-500">
          <p className="text-xs uppercase tracking-wider text-gray-500">A favor</p>
          <p className="text-3xl font-bold text-blue-600">{formatearPeso(favor)}</p>
          <p className="text-sm text-gray-500 mt-1">saldo a favor</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow border-l-4 border-emerald-500">
          <p className="text-xs uppercase tracking-wider text-gray-500">Saldo Neto</p>
          <p className={`text-3xl font-bold ${cuentaNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatearPeso(cuentaNeta)}</p>
          <p className="text-sm text-gray-500 mt-1">(favor - deuda)</p>
        </div>
      </div>

      {exito && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
          ✅ {exito}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          ❌ {error}
        </div>
      )}

      {/* Búsqueda */}
      <div className="bg-white rounded-xl shadow p-4">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre, teléfono o email..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyUp={cargarProveedores}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      {/* LISTADO DE PROVEEDORES EN TARJETAS */}
      {cargando ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : proveedores.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No hay proveedores</p>
          <p className="text-sm">Crea uno desde el botón "+ Nuevo Proveedor"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proveedores.map((prov) => (
            <div key={prov.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden border-l-4 border-green-500">
              <div className="p-4">
                {/* Nombre y estado */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-800">{prov.nombre}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    prov.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {prov.activo ? '✓ Activo' : '⊘ Inactivo'}
                  </span>
                </div>

                {/* Datos de contacto */}
                {prov.telefono && <p className="text-sm text-gray-600">📱 {prov.telefono}</p>}
                {prov.email && <p className="text-sm text-gray-600">📧 {prov.email}</p>}
                {prov.direccion && <p className="text-sm text-gray-600">📍 {prov.direccion}</p>}

                {/* SALDOS */}
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    {prov.created_at && <span>Alta: {formatearFecha(prov.created_at)}</span>}
                    {prov.updated_at && <span>Últ. mov: {formatearFecha(prov.updated_at)}</span>}
                  </div>

                  {Number(prov.saldo_deuda) > 0 ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); verDetalle(prov).then(() => { setTipoPagoContext('cobro_deuda'); setMostrarModalPago(true); setFormPago(p => ({ ...p, monto: '', metodo_pago: 'efectivo', descripcion: '', recibo_url: '' })); setBoletaPreview(''); }); }}
                      className="w-full flex justify-between items-center px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 transition-colors cursor-pointer"
                    >
                      <span className="text-sm text-gray-600">✅ Nos debe a nosotros</span>
                      <span className="font-bold text-green-600 flex items-center gap-1">{formatearPeso(prov.saldo_deuda)} <span className="text-xs">→</span></span>
                    </button>
                  ) : (
                    <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-gray-50">
                      <span className="text-sm text-gray-600">✅ Nos debe a nosotros:</span>
                      <span className="font-bold text-gray-700">{formatearPeso(prov.saldo_deuda)}</span>
                    </div>
                  )}

                  {Number(prov.saldo_a_favor) > 0 ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); verDetalle(prov).then(() => { setTipoPagoContext('pago_a_cuenta'); setMostrarModalPago(true); setFormPago(p => ({ ...p, monto: '', metodo_pago: 'efectivo', descripcion: '', recibo_url: '' })); setBoletaPreview(''); }); }}
                      className="w-full flex justify-between items-center px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                    >
                      <span className="text-sm text-gray-600">⚠️ Nosotros le debemos</span>
                      <span className="font-bold text-red-600 flex items-center gap-1">{formatearPeso(prov.saldo_a_favor)} <span className="text-xs">→</span></span>
                    </button>
                  ) : (
                    <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-gray-50">
                      <span className="text-sm text-gray-600">⚠️ Nosotros le debemos:</span>
                      <span className="font-bold text-gray-700">{formatearPeso(prov.saldo_a_favor)}</span>
                    </div>
                  )}
                </div>

                {/* BOTONES */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => verDetalle(prov)}
                    className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Ver Detalle
                  </button>
                  <button
                    onClick={() => abrirModalEditar(prov)}
                    className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREAR/EDITAR */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-gray-800">
                {proveedorSeleccionado?.id ? '✏️ Editar Proveedor' : '➕ Nuevo Proveedor'}
              </h3>
              <button
                onClick={() => setMostrarModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={guardarProveedor} className="p-5 space-y-4">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
                  ❌ {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formulario.nombre}
                  onChange={(e) => setFormulario(p => ({ ...p, nombre: e.target.value }))}
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="Ej: Distribuidor ABC"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={formulario.telefono}
                  onChange={(e) => setFormulario(p => ({ ...p, telefono: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="+54 11 1234-5678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formulario.email}
                  onChange={(e) => setFormulario(p => ({ ...p, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="contacto@proveedor.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={formulario.direccion}
                  onChange={(e) => setFormulario(p => ({ ...p, direccion: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="Calle 123, Piso 4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formulario.notas}
                  onChange={(e) => setFormulario(p => ({ ...p, notas: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  placeholder="Información adicional..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  ✅ Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE */}
      {mostrarDetalle && proveedorSeleccionado && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-xl shadow-[0_15px_40px_rgba(30,41,59,0.35)] w-full max-w-6xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">📋 Detalle - {proveedorSeleccionado.nombre}</h3>
                <p className="text-sm text-gray-500">Historial, saldos y estadísticas de gastos</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMostrarInfoProveedor(!mostrarInfoProveedor)}
                  className="text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  title="Ver datos del proveedor"
                >
                  {mostrarInfoProveedor ? 'Ocultar info' : 'Info proveedor'}
                </button>
                <button
                  onClick={() => setMostrarDetalle(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 flex flex-col flex-1 overflow-y-auto">
              {/* Información del proveedor compacta (condicional) */}
              {mostrarInfoProveedor && (
                <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm text-sm">
                  <div className="grid grid-cols-3 gap-2 text-gray-700">
                    <div>
                      <p className="text-gray-500 uppercase tracking-wide text-xs">Teléfono</p>
                      <p className="font-semibold">{proveedorSeleccionado.telefono || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 uppercase tracking-wide text-xs">Email</p>
                      <p className="font-semibold">{proveedorSeleccionado.email || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 uppercase tracking-wide text-xs">Dirección</p>
                      <p className="font-semibold">{proveedorSeleccionado.direccion || '-'}</p>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">Notas</p>
                  <p className="text-gray-700 truncate">{proveedorSeleccionado.notas || '-'}</p>
                </div>
              )}

            {/* Estadísticas mejoradas */}
              {proveedorSeleccionado.estadisticas && (
                <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-3 border border-blue-100">
                  <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm">
                    📊 Estadísticas de Gastos
                  </h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 shadow text-center">
                      <p className="text-[10px] text-blue-100 uppercase font-semibold mb-1">Cant. Pagos</p>
                      <p className="text-xl font-bold text-white">{proveedorSeleccionado.estadisticas.total_gastos}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 shadow text-center">
                      <p className="text-[10px] text-green-100 uppercase font-semibold mb-1">Monto Total</p>
                      <p className="text-sm font-bold text-white">{formatearPeso(proveedorSeleccionado.estadisticas.total_monto)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 shadow text-center">
                      <p className="text-[10px] text-purple-100 uppercase font-semibold mb-1">Promedio</p>
                      <p className="text-sm font-bold text-white">{formatearPeso(proveedorSeleccionado.estadisticas.promedio_gasto)}</p>
                    </div>
                    <div
                      onClick={() => setMostrarDetalleUltimoGasto(true)}
                      className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-3 shadow cursor-pointer text-center hover:brightness-110 transition-all"
                    >
                      <p className="text-[10px] text-orange-100 uppercase font-semibold mb-1">Último Pago</p>
                      <p className="text-[11px] font-bold text-white">{proveedorSeleccionado.movimientos?.[0] ? formatearFecha(proveedorSeleccionado.movimientos[0].fecha) : '-'}</p>
                      <p className="text-[10px] text-white/80 mt-0.5">ver detalle</p>
                    </div>
                  </div>

                  {/* Gastos por mes compacto */}
                  {proveedorSeleccionado.estadisticas_por_mes && proveedorSeleccionado.estadisticas_por_mes.length > 0 && (
                    <div className="border-t border-blue-200 pt-2">
                      <h5 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">📈 Gastos por mes</h5>
                      <div className="h-16 flex items-end gap-2 px-4">
                        {estadisticasMes.slice(0, 6).reverse().map((mes, index) => {
                          const totalMes = Number(mes.total) || 0;
                          const porcentaje = maxGastoMes > 0 ? (totalMes / maxGastoMes) * 100 : 0;
                          return (
                            <div key={index} className="flex flex-col items-center justify-end h-full" style={{ width: '40px', minWidth: '40px' }} title={`${new Date(mes.mes).toLocaleDateString('es-ES', { month: 'short' })}: ${formatearPeso(mes.total)}`}>
                              <div className="w-full bg-blue-200 rounded-t overflow-hidden" style={{ height: `${Math.max(10, porcentaje)}%` }}>
                                <div className="h-full bg-gradient-to-t from-blue-600 to-blue-400"></div>
                              </div>
                              <p className="text-[9px] text-gray-500 mt-0.5 whitespace-nowrap">
                                {new Date(mes.mes).toLocaleDateString('es-ES', { month: 'short' })}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {mostrarDetalleUltimoGasto && proveedorSeleccionado.movimientos && proveedorSeleccionado.movimientos.length > 0 && (
                <div className="bg-white rounded-xl p-3 mb-3 border border-amber-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-amber-700">Detalle del último pago</p>
                    <button
                      onClick={() => setMostrarDetalleUltimoGasto(false)}
                      className="text-xs text-amber-700 hover:text-amber-900"
                    >
                      Cerrar
                    </button>
                  </div>
                  <p className="text-sm"><strong>Descripción:</strong> {proveedorSeleccionado.movimientos[0].descripcion || '-'}</p>
                  <p className="text-sm"><strong>Monto:</strong> {formatearPeso(proveedorSeleccionado.movimientos[0].monto)}</p>
                  <p className="text-sm"><strong>Fecha:</strong> {formatearFecha(proveedorSeleccionado.movimientos[0].fecha)}</p>
                  <p className="text-sm"><strong>Método:</strong> {proveedorSeleccionado.movimientos[0].metodo_pago}</p>
                </div>
              )}
               

              {/* Botón dedicado para abrir modal de historial */}
              <div className="border-t pt-2">
                <button
                  onClick={() => setMostrarModalHistorial(true)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  🧾 Abrir Historial de Gastos
                </button>
              </div>

              {/* Saldos Actuales */}
              <div className="border-t pt-3">
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm">
                  💰 Saldos Actuales
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setTipoPagoContext('cobro_deuda'); setMostrarModalPago(true); setFormPago(p => ({ ...p, monto: Number(proveedorSeleccionado.saldo_deuda) > 0 ? proveedorSeleccionado.saldo_deuda : '', metodo_pago: 'efectivo', descripcion: '', recibo_url: '' })); setBoletaPreview(''); }}
                    className={`p-2 rounded-lg border transition-all duration-200 text-left ${Number(proveedorSeleccionado.saldo_deuda) > 0 ? 'bg-green-50 border-green-300 hover:bg-green-100 cursor-pointer shadow-sm' : 'bg-gray-50 border-gray-200 cursor-default'}`}
                  >
                    <p className="text-[10px] text-gray-500 uppercase font-semibold mb-0.5">✅ Nos debe</p>
                    <p className={`text-base font-bold ${Number(proveedorSeleccionado.saldo_deuda) > 0 ? 'text-green-600' : 'text-gray-700'}`}>
                      {formatearPeso(proveedorSeleccionado.saldo_deuda)}
                    </p>
                    {Number(proveedorSeleccionado.saldo_deuda) > 0 && <p className="text-[10px] text-green-500 mt-0.5">→ Registrar cobro</p>}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTipoPagoContext('pago_a_cuenta'); setMostrarModalPago(true); setFormPago(p => ({ ...p, monto: Number(proveedorSeleccionado.saldo_a_favor) > 0 ? proveedorSeleccionado.saldo_a_favor : '', metodo_pago: 'efectivo', descripcion: '', recibo_url: '' })); setBoletaPreview(''); }}
                    className={`p-2 rounded-lg border transition-all duration-200 text-left ${Number(proveedorSeleccionado.saldo_a_favor) > 0 ? 'bg-red-50 border-red-300 hover:bg-red-100 cursor-pointer shadow-sm' : 'bg-gray-50 border-gray-200 cursor-default'}`}
                  >
                    <p className="text-[10px] text-gray-500 uppercase font-semibold mb-0.5">⚠️ Les debemos</p>
                    <p className={`text-base font-bold ${Number(proveedorSeleccionado.saldo_a_favor) > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatearPeso(proveedorSeleccionado.saldo_a_favor)}
                    </p>
                    {Number(proveedorSeleccionado.saldo_a_favor) > 0 && <p className="text-[10px] text-red-500 mt-0.5">→ Registrar pago</p>}
                  </button>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="border-t pt-2 flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setMostrarDetalle(false); abrirModalEditar(proveedorSeleccionado); }}
                    className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => { setMostrarModalPago(true); setTipoPagoContext('pago_a_cuenta'); setBoletaPreview(''); setFormPago(p => ({ ...p, monto: '', metodo_pago: 'efectivo', descripcion: '', recibo_url: '' })); }}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    💳 Registrar Pago
                  </button>
                </div>
                <div className="flex gap-2">
                  {proveedorSeleccionado.activo ? (
                    <button
                      onClick={() => archivarProveedor(proveedorSeleccionado.id, proveedorSeleccionado.nombre)}
                      className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                      📦 Archivar
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivarProveedor(proveedorSeleccionado.id, proveedorSeleccionado.nombre)}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                      ♻️ Reactivar
                    </button>
                  )}
                  <button
                    onClick={() => eliminarProveedor(proveedorSeleccionado.id, proveedorSeleccionado.nombre)}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    🗑️ Eliminar definitivo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DE GASTOS */}
      {mostrarModalHistorial && proveedorSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">📜 Historial de Gastos - {proveedorSeleccionado.nombre}</h3>
                <p className="text-xs text-gray-500">Filtra y revisa transacciones completas</p>
              </div>
              <button
                onClick={() => setMostrarModalHistorial(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                aria-label="Cerrar historial"
              >
                ×
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4 flex-1 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-3 border border-gray-200">
                <div className="flex flex-wrap gap-2 items-center text-sm">
                  <span className="font-semibold text-gray-700">Filtrar por período:</span>

                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'todos', label: 'Todos', icon: '📅' },
                      { key: 'hoy', label: 'Hoy', icon: '📆' },
                      { key: 'semana', label: 'Esta Semana', icon: '📊' },
                      { key: 'mes', label: 'Este Mes', icon: '🗓️' }
                    ].map(({ key, label, icon }) => (
                      <button
                        key={key}
                        onClick={() => {
                          const nuevosFiltros = { ...filtrosHistorial, periodo: key, fechaDesde: '', fechaHasta: '' };
                          setFiltrosHistorial(nuevosFiltros);
                          verDetalle(proveedorSeleccionado, nuevosFiltros);
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1 ${
                          filtrosHistorial.periodo === key
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 items-center ml-auto">
                    <input
                      type="date"
                      value={filtrosHistorial.fechaDesde}
                      onChange={(e) => setFiltrosHistorial(p => ({ ...p, fechaDesde: e.target.value, periodo: 'personalizado' }))}
                      className="border rounded-lg px-2 py-1 text-xs"
                      placeholder="Desde"
                    />
                    <span className="text-gray-400 text-xs">→</span>
                    <input
                      type="date"
                      value={filtrosHistorial.fechaHasta}
                      onChange={(e) => setFiltrosHistorial(p => ({ ...p, fechaHasta: e.target.value, periodo: 'personalizado' }))}
                      className="border rounded-lg px-2 py-1 text-xs"
                      placeholder="Hasta"
                    />
                    <button
                      onClick={() => verDetalle(proveedorSeleccionado)}
                      className="bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600 transition-colors font-medium"
                    >
                      🔍 Aplicar
                    </button>
                  </div>
                </div>
              </div>

              <div>
                {Array.isArray(proveedorSeleccionado.movimientos) && proveedorSeleccionado.movimientos.length > 0 ? (
                  proveedorSeleccionado.movimientos.map((mov) => (
                    <div key={mov.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200 group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-800 text-sm">{mov.descripcion}</p>
                          {(() => {
                            // Logica inteligente para tipo de movimiento
                            if ((mov.tipo === 'pago_proveedor' || mov.es_compra) && mov.registrar_nueva_factura) {
                              const monto = Number(mov.monto);
                              const totalFactura = Number(mov.total_factura);
                              
                              if (monto >= totalFactura) {
                                return <span className="text-[10px] px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">✅ PAGO TOTAL FACTURA</span>
                              }
                              if (monto < totalFactura && monto > 0) {
                                return <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">⚠️ PAGO PARCIAL FACTURA</span>
                              }
                              if (monto === 0) {
                                return <span className="text-[10px] px-2 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-200">🧾 NUEVA FACTURA (DEUDA)</span>
                              }
                            }
                            if (mov.tipo === 'pago_proveedor' && !mov.total_factura && !mov.registrar_nueva_factura) {
                              return <span className="text-[10px] px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">💸 PAGO A CUENTA DEUDA</span>
                            }
                            if (mov.es_compra) {
                              if (mov.tipo_comprobante === 'factura_a' || mov.tipo_comprobante === 'factura_b' || mov.tipo_comprobante === 'factura_c') {
                                return <span className="text-[10px] px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">🧾 COMPRA CON FACTURA</span>
                              }
                              return <span className="text-[10px] px-2 py-1 rounded-full bg-teal-100 text-teal-700 border border-teal-200">🛒 COMPRA SIN FACTURA</span>
                            }
                            return <span className={`text-[10px] px-2 py-1 rounded-full ${mov.tipo === 'pago_proveedor' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                              {mov.tipo === 'pago_proveedor' ? '💰 Pago Proveedor' : '📄 Gasto General'}
                            </span>
                          })()}
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1">📅 {formatearFecha(mov.fecha)}</p>
                        {mov.total_factura && Number(mov.total_factura) > 0 && (
                          <p className="text-[10px] text-gray-400 mt-1">
                            Factura total: {formatearPeso(mov.total_factura)} | Pagado: {formatearPeso(mov.monto)} | Deuda restante: {formatearPeso(Number(mov.total_factura) - Number(mov.monto))}
                          </p>
                        )}
                      </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-gray-800 text-lg">{formatearPeso(mov.monto)}</p>
                            <p className="text-[11px] text-gray-500 capitalize">💳 {mov.metodo_pago}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {mov.recibo_url && (
                              <>
                                <button
                                  onClick={() => descargarBoleta(mov.recibo_url, mov.id)}
                                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-2 rounded hover:bg-indigo-50"
                                  title="Descargar boleta"
                                >
                                  💾
                                </button>
                                <a
                                  href={mov.recibo_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-2 rounded hover:bg-blue-50"
                                  title="Ver boleta"
                                >
                                  👁️
                                </a>
                              </>
                            )}
                            <button
                              onClick={() => {
                                setMostrarModalHistorial(false);
                                editarGasto(mov);
                              }}
                              className="text-sm text-orange-600 hover:text-orange-800 font-medium px-3 py-2 rounded hover:bg-orange-50"
                              title="Editar gasto"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => eliminarGasto(mov.id)}
                              className="text-sm text-red-600 hover:text-red-800 font-medium px-3 py-2 rounded hover:bg-red-50"
                              title="Eliminar gasto"
                            >
                              🗑️
                            </button>
                          </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-3xl mb-2">📭</div>
                    <p className="text-base font-medium">No hay movimientos en este período</p>
                    <p className="text-sm">Prueba cambiando filtros de fecha</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PAGO */}
      {mostrarModalPago && proveedorSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className={`flex items-center justify-between p-5 border-b ${tipoPagoContext === 'cobro_deuda' ? 'bg-green-50' : 'bg-red-50'}`}>
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {tipoPagoContext === 'cobro_deuda' ? '📥 Registrar Cobro' : '💳 Registrar Pago'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {tipoPagoContext === 'cobro_deuda'
                    ? `${proveedorSeleccionado?.nombre} nos debe ${formatearPeso(proveedorSeleccionado?.saldo_deuda)}`
                    : `Le debemos ${formatearPeso(proveedorSeleccionado?.saldo_a_favor)} a ${proveedorSeleccionado?.nombre}`
                  }
                </p>
              </div>
              <button
                onClick={() => setMostrarModalPago(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={registrarPago} className="p-5 space-y-4">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
                  ❌ {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de pago *</label>
                <select
                  value={tipoPagoContext}
                  onChange={(e) => setTipoPagoContext(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="pago_a_cuenta">Pago a cuenta (nosotros pagamos deuda)</option>
                  <option value="cobro_deuda">Cobro de deuda (ellos nos pagaron)</option>
                  <option value="pago_nuevo">Pago nuevo / anticipo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documento / boleta (opcional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={manejarArchivoBoleta}
                  className="w-full text-sm text-gray-600"
                />
                {boletaPreview && (
                  <div className="mt-2 border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{esImagen(boletaPreview) ? '🖼️' : '📄'}</span>
                        <span className="text-sm text-gray-600">
                          Archivo cargado: {esImagen(boletaPreview) ? 'Imagen' : 'PDF'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={boletaPreview}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          👁️ Ver
                        </a>
                        <button
                          onClick={() => {
                            setBoletaPreview('');
                            setFormPago(p => ({ ...p, recibo_url: '' }));
                            // Limpiar el input file
                            const input = document.querySelector('input[type="file"]');
                            if (input) input.value = '';
                          }}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          ❌ Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Monto *</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormPago(p => ({ ...p, monto: tipoPagoContext === 'cobro_deuda' ? proveedorSeleccionado?.saldo_deuda : proveedorSeleccionado?.saldo_a_favor }))}
                      className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium transition-colors"
                    >
                      💯 Pago total
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPago(p => ({ ...p, monto: '' }))}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded font-medium transition-colors"
                    >
                      ✏️ Parcial
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formPago.monto}
                    onChange={(e) => setFormPago(p => ({ ...p, monto: e.target.value }))}
                    required
                    min="0"
                    step="0.01"
                    autoFocus
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                <select
                  value={formPago.metodo_pago}
                  onChange={(e) => setFormPago(p => ({ ...p, metodo_pago: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                  <option value="transferencia">🏦 Transferencia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  value={formPago.descripcion}
                  onChange={(e) => setFormPago(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Ej: Factura #001, Pago parcial..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalPago(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  ✅ Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR GASTO */}
      {mostrarEditarGasto && gastoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-gray-800">✏️ Editar Gasto</h3>
              <button
                onClick={() => {
                  setMostrarEditarGasto(false);
                  setGastoSeleccionado(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={guardarEdicionGasto} className="p-5 space-y-4">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
                  ❌ {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                <input
                  type="text"
                  value={gastoSeleccionado.descripcion || ''}
                  onChange={(e) => setGastoSeleccionado(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                <input
                  type="number"
                  step="0.01"
                  value={gastoSeleccionado.monto || ''}
                  onChange={(e) => setGastoSeleccionado(p => ({ ...p, monto: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                <input
                  type="date"
                  value={gastoSeleccionado.fecha ? gastoSeleccionado.fecha.split('T')[0] : ''}
                  onChange={(e) => setGastoSeleccionado(p => ({ ...p, fecha: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
                <select
                  value={gastoSeleccionado.metodo_pago || 'efectivo'}
                  onChange={(e) => setGastoSeleccionado(p => ({ ...p, metodo_pago: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="debito">Débito</option>
                  <option value="credito">Crédito</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarEditarGasto(false);
                    setGastoSeleccionado(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                >
                  💾 Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Proveedores;
