import { useState, useEffect } from 'react';
import api from '../../api/axios';
import useCerrarConAtras from '../../hooks/useCerrarConAtras';

function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  // Vista del listado: 'tarjetas' o 'lista' (se recuerda por dispositivo)
  const [vista, setVista] = useState(() => localStorage.getItem('proveedores_vista') || 'tarjetas');
  const cambiarVista = (v) => { setVista(v); localStorage.setItem('proveedores_vista', v); };
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

  // El botón "atrás" del celular cierra los modales en vez de salir
  useCerrarConAtras(mostrarModal, () => setMostrarModal(false));
  useCerrarConAtras(mostrarDetalle, () => setMostrarDetalle(false));
  useCerrarConAtras(mostrarModalPago, () => setMostrarModalPago(false));
  useCerrarConAtras(mostrarEditarGasto, () => setMostrarEditarGasto(false));
  useCerrarConAtras(mostrarModalHistorial, () => setMostrarModalHistorial(false));

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
    if (!window.confirm('¿Eliminar este movimiento?\n\nSi era una compra a crédito o un pago, los saldos del proveedor se ajustan automáticamente.')) return;
    try {
      await api.delete(`/api/gastos/${gastoId}`);
      setExito('Movimiento eliminado y saldos ajustados');
      await verDetalle(proveedorSeleccionado);
      cargarProveedores(); // refrescar saldos en el listado
      setTimeout(() => setExito(''), 2500);
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
      const monto = parseFloat(formPago.monto);
      if (!monto || monto <= 0) {
        setError('El monto debe ser mayor a 0');
        return;
      }

      // Validar contra el saldo correspondiente para no descuadrar cuentas
      const tipoPago = tipoPagoContext === 'cobro_deuda' ? 'cobro_deuda' : 'pago_deuda';
      const saldoCorrespondiente = tipoPago === 'cobro_deuda'
        ? Number(proveedorSeleccionado.saldo_deuda || 0)
        : Number(proveedorSeleccionado.saldo_a_favor || 0);
      if (saldoCorrespondiente <= 0) {
        setError(tipoPago === 'cobro_deuda'
          ? 'Este proveedor no nos debe nada para cobrar'
          : 'No le debemos nada a este proveedor. Las deudas se generan registrando compras a crédito desde Gastos.');
        return;
      }
      if (monto > saldoCorrespondiente) {
        setError(`El monto no puede superar el saldo de ${formatearPeso(saldoCorrespondiente)}`);
        return;
      }

      const descripcionPago = formPago.descripcion || (tipoPago === 'pago_deuda' ? 'Pago de deuda al proveedor' : 'Cobro de deuda del proveedor');

      await api.post(`/api/proveedores/${proveedorSeleccionado.id}/pago`, {
        monto: parseFloat(formPago.monto),
        metodo_pago: formPago.metodo_pago,
        tipo_pago: tipoPago,
        descripcion: descripcionPago,
        recibo_url: formPago.recibo_url || null,
        // Fecha elegida (puede ser otro día); el backend usa hoy si coincide.
        fecha: formPago.fecha || null,
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
    // Los saldos llegan de Postgres como string ("1500.00"); hay que pasarlos a
    // Number antes de sumar, si no JS los concatena y el total da NaN.
    const deuda = proveedores.reduce((sum, p) => sum + (Number(p.saldo_deuda) || 0), 0);
    const favor = proveedores.reduce((sum, p) => sum + (Number(p.saldo_a_favor) || 0), 0);
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
          {/* Toggle de vista: tarjetas / lista */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => cambiarVista('tarjetas')}
              title="Ver como tarjetas"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${vista === 'tarjetas' ? 'bg-white text-green-700 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
              🗂️ Tarjetas
            </button>
            <button onClick={() => cambiarVista('lista')}
              title="Ver como listado"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${vista === 'lista' ? 'bg-white text-green-700 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
              📋 Lista
            </button>
          </div>
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

      {/* Indicadores */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3.5 shadow border-l-4 border-slate-700">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Proveedores</p>
          <p className="text-xl font-bold text-gray-800 tabular-nums">{total}</p>
        </div>
        <div className="bg-white rounded-xl p-3.5 shadow border-l-4 border-red-400">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Les debemos</p>
          <p className="text-xl font-bold text-red-600 tabular-nums">{formatearPeso(favor)}</p>
        </div>
        <div className="bg-white rounded-xl p-3.5 shadow border-l-4 border-emerald-400">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Nos deben</p>
          <p className="text-xl font-bold text-emerald-600 tabular-nums">{formatearPeso(deuda)}</p>
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
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      {/* LISTADO DE PROVEEDORES */}
      {cargando ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : proveedores.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No hay proveedores</p>
          <p className="text-sm">Crea uno desde el botón "+ Nuevo Proveedor"</p>
        </div>
      ) : vista === 'lista' ? (
        /* ---- VISTA LISTA ---- */
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Proveedor</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Contacto</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Nos debe</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Le debemos</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Últ. movimiento</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proveedores.map(prov => (
                  <tr key={prov.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => verDetalle(prov)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {prov.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{prov.nombre}</p>
                          {prov.notas && <p className="text-xs text-gray-400 truncate max-w-[200px]">{prov.notas}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {prov.telefono || '-'}
                      {prov.email && <span className="block text-xs text-gray-400">{prov.email}</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${Number(prov.saldo_deuda) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatearPeso(prov.saldo_deuda)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${Number(prov.saldo_a_favor) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {formatearPeso(prov.saldo_a_favor)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {prov.updated_at ? formatearFecha(prov.updated_at) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => verDetalle(prov)}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-2.5 py-1 rounded text-sm transition-colors">
                          Ver
                        </button>
                        <button onClick={() => abrirModalEditar(prov)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded text-sm transition-colors">
                          Editar
                        </button>
                        {(Number(prov.saldo_deuda) > 0 || Number(prov.saldo_a_favor) > 0) && (
                          <button onClick={() => abrirPagoDesdeListado(prov, Number(prov.saldo_a_favor) > 0 ? 'pago_a_cuenta' : 'cobro_deuda')}
                            title="Registrar pago/cobro"
                            className="bg-green-100 hover:bg-green-200 text-green-700 px-2.5 py-1 rounded text-sm transition-colors">
                            💵
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ---- VISTA TARJETAS (compactas) ---- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {proveedores.map((prov) => {
            const leDebemos = Number(prov.saldo_a_favor) > 0;
            const nosDebe = Number(prov.saldo_deuda) > 0;
            return (
              <div key={prov.id} onClick={() => verDetalle(prov)}
                className="bg-gradient-to-b from-slate-50 via-white to-slate-100 rounded-xl border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.10)] hover:shadow-[0_8px_22px_rgba(15,23,42,0.16)] hover:border-slate-400 hover:-translate-y-0.5 transition-all cursor-pointer p-3.5 ring-1 ring-slate-900/5">
                {/* Nombre + estado */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-slate-800 text-white rounded-lg flex items-center justify-center font-bold flex-shrink-0 shadow">
                    {prov.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 truncate">{prov.nombre}</p>
                    <p className="text-[11px] text-gray-400 truncate">{prov.telefono || 'Sin teléfono'}</p>
                  </div>
                  {!prov.activo && (
                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full flex-shrink-0">Archivado</span>
                  )}
                </div>

                {/* Saldos en una línea */}
                <div className="flex gap-2 mt-3">
                  <div className={`flex-1 rounded-lg px-2.5 py-1.5 border ${leDebemos ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Le debemos</p>
                    <p className={`text-sm font-bold tabular-nums ${leDebemos ? 'text-red-600' : 'text-gray-300'}`}>{formatearPeso(prov.saldo_a_favor)}</p>
                  </div>
                  <div className={`flex-1 rounded-lg px-2.5 py-1.5 border ${nosDebe ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Nos debe</p>
                    <p className={`text-sm font-bold tabular-nums ${nosDebe ? 'text-emerald-600' : 'text-gray-300'}`}>{formatearPeso(prov.saldo_deuda)}</p>
                  </div>
                </div>

                {/* Acciones discretas */}
                <div className="flex gap-1.5 mt-2.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => verDetalle(prov)}
                    className="flex-1 py-1.5 text-xs font-semibold text-slate-700 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
                    Ver ficha
                  </button>
                  <button onClick={() => abrirModalEditar(prov)}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
                    ✏️
                  </button>
                  {(leDebemos || nosDebe) && (
                    <button onClick={() => abrirPagoDesdeListado(prov, leDebemos ? 'pago_a_cuenta' : 'cobro_deuda')}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                      💵
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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

      {/* MODAL DETALLE — ficha profesional del proveedor */}
      {mostrarDetalle && proveedorSeleccionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3"
          onClick={() => setMostrarDetalle(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>

            {/* Encabezado sobrio */}
            <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 bg-white/10 border border-white/15 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {proveedorSeleccionado.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold truncate">{proveedorSeleccionado.nombre}</h3>
                    {!proveedorSeleccionado.activo && (
                      <span className="text-[10px] bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 px-2 py-0.5 rounded-full flex-shrink-0">Archivado</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs truncate">
                    {[proveedorSeleccionado.telefono, proveedorSeleccionado.email, proveedorSeleccionado.direccion].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                  </p>
                </div>
              </div>
              <button onClick={() => setMostrarDetalle(false)}
                className="text-slate-400 hover:text-white text-3xl leading-none flex-shrink-0 ml-3">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Saldos: lo más importante, arriba */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-gray-200 rounded-xl p-3.5">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">Nos debe</p>
                  <p className={`text-2xl font-bold tabular-nums mt-0.5 ${Number(proveedorSeleccionado.saldo_deuda) > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                    {formatearPeso(proveedorSeleccionado.saldo_deuda)}
                  </p>
                  {Number(proveedorSeleccionado.saldo_deuda) > 0 && (
                    <button
                      onClick={() => { setTipoPagoContext('cobro_deuda'); setMostrarModalPago(true); setFormPago(p => ({ ...p, monto: proveedorSeleccionado.saldo_deuda, metodo_pago: 'efectivo', descripcion: '', recibo_url: '' })); setBoletaPreview(''); }}
                      className="mt-2 text-xs font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors">
                      Registrar cobro
                    </button>
                  )}
                </div>
                <div className="border border-gray-200 rounded-xl p-3.5">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">Le debemos</p>
                  <p className={`text-2xl font-bold tabular-nums mt-0.5 ${Number(proveedorSeleccionado.saldo_a_favor) > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                    {formatearPeso(proveedorSeleccionado.saldo_a_favor)}
                  </p>
                  {Number(proveedorSeleccionado.saldo_a_favor) > 0 && (
                    <button
                      onClick={() => { setTipoPagoContext('pago_a_cuenta'); setMostrarModalPago(true); setFormPago(p => ({ ...p, monto: proveedorSeleccionado.saldo_a_favor, metodo_pago: 'efectivo', descripcion: '', recibo_url: '' })); setBoletaPreview(''); }}
                      className="mt-2 text-xs font-semibold text-red-700 border border-red-300 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                      Registrar pago
                    </button>
                  )}
                </div>
              </div>

              {/* Indicadores */}
              {proveedorSeleccionado.estadisticas && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Movimientos</p>
                    <p className="text-lg font-bold text-gray-800 tabular-nums">{proveedorSeleccionado.estadisticas.total_gastos}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Total histórico</p>
                    <p className="text-lg font-bold text-gray-800 tabular-nums">{formatearPeso(proveedorSeleccionado.estadisticas.total_monto)}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Promedio</p>
                    <p className="text-lg font-bold text-gray-800 tabular-nums">{formatearPeso(proveedorSeleccionado.estadisticas.promedio_gasto)}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Último mov.</p>
                    <p className="text-sm font-bold text-gray-800">
                      {proveedorSeleccionado.movimientos?.[0] ? formatearFecha(proveedorSeleccionado.movimientos[0].fecha).split(',')[0] : '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* Gastos por mes (sobrio) */}
              {estadisticasMes.length > 0 && (
                <div className="border border-gray-200 rounded-xl p-3.5">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mb-2">Gastos por mes</p>
                  <div className="h-20 flex items-end gap-2">
                    {estadisticasMes.slice(0, 8).reverse().map((mes, index) => {
                      const totalMes = Number(mes.total) || 0;
                      const porcentaje = maxGastoMes > 0 ? (totalMes / maxGastoMes) * 100 : 0;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center justify-end h-full"
                          title={`${new Date(mes.mes).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })}: ${formatearPeso(mes.total)}`}>
                          <div className="w-full max-w-[42px] bg-slate-700 hover:bg-slate-600 rounded-t transition-colors"
                            style={{ height: `${Math.max(8, porcentaje)}%` }}></div>
                          <p className="text-[9px] text-gray-400 mt-1 whitespace-nowrap capitalize">
                            {new Date(mes.mes).toLocaleDateString('es-AR', { month: 'short' })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Movimientos recientes (compras, gastos y pagos asignados) */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-3.5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">Movimientos recientes</p>
                  <button onClick={() => setMostrarModalHistorial(true)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-gray-300 hover:border-gray-400 px-3 py-1 rounded-lg transition-colors">
                    Ver historial completo →
                  </button>
                </div>
                {(proveedorSeleccionado.movimientos || []).length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-6">
                    Sin movimientos todavía. Las compras y gastos asignados a este proveedor aparecen acá.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {proveedorSeleccionado.movimientos.slice(0, 5).map(mov => (
                      <div key={mov.id} className="flex items-center gap-3 px-3.5 py-2.5">
                        <span className="text-base flex-shrink-0">
                          {mov.tipo === 'pago_proveedor' ? '💸' : mov.es_compra ? '🛒' : '📄'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{mov.descripcion || (mov.es_compra ? 'Compra' : 'Gasto')}</p>
                          <p className="text-[11px] text-gray-400">
                            {formatearFecha(mov.fecha)} · {(mov.metodo_pago || '').replace('_', ' ')}
                            {mov.es_compra ? ' · compra' : mov.tipo === 'pago_proveedor' ? ' · pago' : ''}
                          </p>
                        </div>
                        <span className="font-semibold text-gray-800 text-sm tabular-nums flex-shrink-0">{formatearPeso(mov.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notas (solo si hay) */}
              {proveedorSeleccionado.notas && (
                <div className="border border-gray-200 rounded-xl p-3.5">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Notas</p>
                  <p className="text-sm text-gray-700">{proveedorSeleccionado.notas}</p>
                </div>
              )}
            </div>

            {/* Barra de acciones: primarias a la derecha, destructivas discretas a la izquierda */}
            <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between gap-2 flex-wrap flex-shrink-0">
              <div className="flex items-center gap-1">
                {proveedorSeleccionado.activo ? (
                  <button onClick={() => archivarProveedor(proveedorSeleccionado.id, proveedorSeleccionado.nombre)}
                    className="text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors">
                    📦 Archivar
                  </button>
                ) : (
                  <button onClick={() => reactivarProveedor(proveedorSeleccionado.id, proveedorSeleccionado.nombre)}
                    className="text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-3 py-2 rounded-lg transition-colors">
                    ♻️ Reactivar
                  </button>
                )}
                <button onClick={() => eliminarProveedor(proveedorSeleccionado.id, proveedorSeleccionado.nombre)}
                  className="text-xs text-red-400 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
                  🗑️ Eliminar
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setMostrarDetalle(false); abrirModalEditar(proveedorSeleccionado); }}
                  className="text-sm font-semibold text-slate-700 border border-gray-300 hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors">
                  ✏️ Editar
                </button>
                <button onClick={() => { setMostrarModalPago(true); setTipoPagoContext('pago_a_cuenta'); setBoletaPreview(''); setFormPago(p => ({ ...p, monto: '', metodo_pago: 'efectivo', descripcion: '', recibo_url: '' })); }}
                  className="text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl transition-colors">
                  💵 Registrar pago
                </button>
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

            <div className="p-4 flex flex-col gap-3 flex-1 overflow-hidden">
              {/* Filtros */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex-shrink-0">
                <div className="flex flex-wrap gap-2 items-center text-sm">
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { key: 'todos', label: 'Todos' },
                      { key: 'hoy', label: 'Hoy' },
                      { key: 'semana', label: 'Semana' },
                      { key: 'mes', label: 'Mes' }
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => {
                          const nuevosFiltros = { ...filtrosHistorial, periodo: key, fechaDesde: '', fechaHasta: '' };
                          setFiltrosHistorial(nuevosFiltros);
                          verDetalle(proveedorSeleccionado, nuevosFiltros);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                          filtrosHistorial.periodo === key
                            ? 'bg-slate-800 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 items-center ml-auto flex-wrap">
                    <input
                      type="date"
                      value={filtrosHistorial.fechaDesde}
                      onChange={(e) => setFiltrosHistorial(p => ({ ...p, fechaDesde: e.target.value, periodo: 'personalizado' }))}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                    />
                    <span className="text-gray-400 text-xs">→</span>
                    <input
                      type="date"
                      value={filtrosHistorial.fechaHasta}
                      onChange={(e) => setFiltrosHistorial(p => ({ ...p, fechaHasta: e.target.value, periodo: 'personalizado' }))}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                    />
                    <button
                      onClick={() => verDetalle(proveedorSeleccionado)}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>

              {/* Total del período visible */}
              {Array.isArray(proveedorSeleccionado.movimientos) && proveedorSeleccionado.movimientos.length > 0 && (
                <div className="flex items-center justify-between px-1 flex-shrink-0">
                  <span className="text-xs text-gray-500">{proveedorSeleccionado.movimientos.length} movimiento(s) en el período</span>
                  <span className="text-sm font-bold text-gray-800 tabular-nums">
                    Total: {formatearPeso(proveedorSeleccionado.movimientos.reduce((a, m) => a + Number(m.monto || 0), 0))}
                  </span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {Array.isArray(proveedorSeleccionado.movimientos) && proveedorSeleccionado.movimientos.length > 0 ? (
                  proveedorSeleccionado.movimientos.map((mov) => {
                    // Etiqueta del tipo de movimiento (sobria)
                    let etiqueta = '📄 Gasto';
                    if (mov.es_compra) {
                      const deudaRestante = Number(mov.total_factura || 0) - Number(mov.monto || 0);
                      etiqueta = deudaRestante > 0 ? '🛒 Compra a crédito' : '🛒 Compra';
                    } else if (mov.tipo === 'pago_proveedor') {
                      etiqueta = '💸 Pago/Cobro';
                    }
                    return (
                    <div key={mov.id} className="bg-white rounded-xl border border-gray-200 px-3.5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-800 text-sm truncate">{mov.descripcion || 'Sin descripción'}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">{etiqueta}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatearFecha(mov.fecha)} · {(mov.metodo_pago || '').replace('_', ' ')}
                          </p>
                          {Number(mov.total_factura) > 0 && Number(mov.total_factura) > Number(mov.monto) && (
                            <p className="text-[11px] text-amber-700 mt-1">
                              Total {formatearPeso(mov.total_factura)} · pagado {formatearPeso(mov.monto)} · resta {formatearPeso(Number(mov.total_factura) - Number(mov.monto))}
                            </p>
                          )}
                        </div>
                        <p className="font-bold text-gray-800 tabular-nums flex-shrink-0">{formatearPeso(mov.monto)}</p>
                      </div>
                      {/* Acciones siempre visibles (en celular no hay hover) */}
                      <div className="flex gap-1.5 mt-2 justify-end">
                        {mov.recibo_url && (
                          <a href={mov.recibo_url} target="_blank" rel="noreferrer" title="Ver boleta"
                            className="text-xs text-slate-600 border border-gray-200 hover:bg-gray-100 px-2.5 py-1 rounded-lg transition-colors">
                            👁️ Boleta
                          </a>
                        )}
                        <button onClick={() => editarGasto(mov)} title="Editar"
                          className="text-xs text-slate-600 border border-gray-200 hover:bg-gray-100 px-2.5 py-1 rounded-lg transition-colors">
                          ✏️ Editar
                        </button>
                        <button onClick={() => eliminarGasto(mov.id)} title="Eliminar"
                          className="text-xs text-red-500 border border-red-100 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors">
                          🗑️
                        </button>
                      </div>
                    </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-3xl mb-2">📭</div>
                    <p className="text-base font-medium">No hay movimientos en este período</p>
                    <p className="text-sm">Las compras y gastos asignados a este proveedor aparecen acá</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PAGO / COBRO */}
      {mostrarModalPago && proveedorSeleccionado && (() => {
        const esCobro = tipoPagoContext === 'cobro_deuda';
        const saldoActual = esCobro
          ? Number(proveedorSeleccionado.saldo_deuda || 0)
          : Number(proveedorSeleccionado.saldo_a_favor || 0);
        const montoNum = parseFloat(formPago.monto) || 0;
        const montoValido = montoNum > 0 && montoNum <= saldoActual;
        return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setMostrarModalPago(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{esCobro ? '📥 Registrar cobro' : '💵 Registrar pago'}</h3>
                <p className="text-slate-400 text-xs mt-0.5">{proveedorSeleccionado.nombre}</p>
              </div>
              <button onClick={() => setMostrarModalPago(false)}
                className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>

            <form onSubmit={registrarPago} className="p-5 space-y-4">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">❌ {error}</div>
              )}

              {/* Tipo de operación: dos opciones claras */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  onClick={() => { setTipoPagoContext('pago_a_cuenta'); setFormPago(p => ({ ...p, monto: '' })); setError(''); }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${!esCobro ? 'border-slate-700 bg-slate-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="text-sm font-bold text-gray-800">Le pagamos</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Saldamos deuda nuestra</p>
                  <p className={`text-sm font-bold tabular-nums mt-1 ${Number(proveedorSeleccionado.saldo_a_favor) > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                    {formatearPeso(proveedorSeleccionado.saldo_a_favor)}
                  </p>
                </button>
                <button type="button"
                  onClick={() => { setTipoPagoContext('cobro_deuda'); setFormPago(p => ({ ...p, monto: '' })); setError(''); }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${esCobro ? 'border-slate-700 bg-slate-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="text-sm font-bold text-gray-800">Nos paga</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Cobramos lo que nos debe</p>
                  <p className={`text-sm font-bold tabular-nums mt-1 ${Number(proveedorSeleccionado.saldo_deuda) > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                    {formatearPeso(proveedorSeleccionado.saldo_deuda)}
                  </p>
                </button>
              </div>

              {saldoActual <= 0 ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm">
                  {esCobro
                    ? 'Este proveedor no nos debe nada por cobrar.'
                    : 'No le debemos nada. Las deudas se generan registrando compras a crédito desde Gastos → Compra a proveedor.'}
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">Monto *</label>
                      <div className="flex gap-1.5">
                        <button type="button"
                          onClick={() => setFormPago(p => ({ ...p, monto: String(saldoActual) }))}
                          className="text-xs px-2.5 py-1 border border-gray-300 hover:bg-gray-100 text-gray-600 rounded-lg font-medium transition-colors">
                          Total ({formatearPeso(saldoActual)})
                        </button>
                        <button type="button"
                          onClick={() => setFormPago(p => ({ ...p, monto: (saldoActual / 2).toFixed(0) }))}
                          className="text-xs px-2.5 py-1 border border-gray-300 hover:bg-gray-100 text-gray-600 rounded-lg font-medium transition-colors">
                          50%
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <input type="number" value={formPago.monto}
                        onChange={(e) => setFormPago(p => ({ ...p, monto: e.target.value }))}
                        required min="0" step="0.01" autoFocus
                        className={`w-full border rounded-lg pl-7 pr-3 py-2.5 text-lg focus:outline-none focus:ring-2 ${montoNum > saldoActual ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-slate-500'}`}
                        placeholder="0" />
                    </div>
                    {montoNum > saldoActual && (
                      <p className="text-xs text-red-600 mt-1">No puede superar el saldo de {formatearPeso(saldoActual)}</p>
                    )}
                    {montoValido && montoNum < saldoActual && (
                      <p className="text-xs text-gray-400 mt-1">Quedará un saldo de {formatearPeso(saldoActual - montoNum)}</p>
                    )}
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
                              ? 'bg-slate-800 border-slate-800 text-white'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del pago</label>
                    <input type="date"
                      value={formPago.fecha || new Date().toLocaleDateString('en-CA')}
                      onChange={(e) => setFormPago(p => ({ ...p, fecha: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500" />
                    <p className="text-[11px] text-gray-400 mt-1">Por defecto es hoy. Cambiala si registrás un pago de otro día.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
                    <input type="text" value={formPago.descripcion}
                      onChange={(e) => setFormPago(p => ({ ...p, descripcion: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                      placeholder="Ej: Factura #001, pago parcial..." />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comprobante / boleta (opcional)</label>
                    <input type="file" accept="image/*,.pdf" onChange={manejarArchivoBoleta}
                      className="w-full text-sm text-gray-600" />
                    {boletaPreview && (
                      <div className="mt-2 border rounded-lg px-3 py-2 bg-gray-50 flex items-center justify-between">
                        <span className="text-sm text-gray-600 flex items-center gap-2">
                          {esImagen(boletaPreview) ? '🖼️' : '📄'} Archivo cargado
                        </span>
                        <div className="flex gap-3">
                          <a href={boletaPreview} target="_blank" rel="noreferrer"
                            className="text-xs text-slate-600 hover:text-slate-900 font-medium">Ver</a>
                          <button type="button"
                            onClick={() => {
                              setBoletaPreview('');
                              setFormPago(p => ({ ...p, recibo_url: '' }));
                              const input = document.querySelector('input[type="file"]');
                              if (input) input.value = '';
                            }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium">Quitar</button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setMostrarModalPago(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={!montoValido}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors">
                  {esCobro ? '📥 Confirmar cobro' : '💵 Confirmar pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* MODAL EDITAR GASTO (se abre ENCIMA del historial) */}
      {mostrarEditarGasto && gastoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
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
