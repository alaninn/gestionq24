// =============================================
// ARCHIVO: src/pages/Superadmin.jsx
// FUNCIÓN: Panel de control global - solo superadmin
// =============================================

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import VersionChangelog from '../components/shared/VersionChangelog';

const fmt = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0
}).format(n || 0);

const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-AR') : '-';

function Superadmin() {
  const { usuario, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [negocios, setNegocios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(null);
  const [mostrarModalRenovar, setMostrarModalRenovar] = useState(null);
  const [mostrarModalDias, setMostrarModalDias] = useState(null);
  const [mostrarModalSalud, setMostrarModalSalud] = useState(null);
  const [mostrarModalGestionTickets, setMostrarModalGestionTickets] = useState(null);
  const [mostrarModalDetalleNegocio, setMostrarModalDetalleNegocio] = useState(null);
  const [negocioDetalleGuardado, setNegocioDetalleGuardado] = useState(null);
  const [mostrarModalMiCuenta, setMostrarModalMiCuenta] = useState(false);
  const [mostrarModalAdminNegocio, setMostrarModalAdminNegocio] = useState(null);
  const [formMiCuenta, setFormMiCuenta] = useState({ nombre: '', email: '', password: '', confirmarPassword: '' });
  const [formAdminNegocio, setFormAdminNegocio] = useState({ nombre: '', username: '', password: '' });
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');
  const [historialPagos, setHistorialPagos] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [alertas, setAlertas] = useState([]);
  const [cargandoAlertas, setCargandoAlertas] = useState(false);
  const [saludNegocio, setSaludNegocio] = useState(null);
  const [cargandoSalud, setCargandoSalud] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [cargandoTickets, setCargandoTickets] = useState(false);
  const [respuestaTicket, setRespuestaTicket] = useState('');

  // Visor de logs (bajo demanda: solo consume mientras está iniciado)
  const [mostrarModalLogs, setMostrarModalLogs] = useState(false);
  const [logsContenido, setLogsContenido] = useState([]);
  const [logsActivo, setLogsActivo] = useState(false);
  const [logsCargando, setLogsCargando] = useState(false);
  const logsIntervalRef = useRef(null);
  const logsUltimoIdRef = useRef(0);
  const logsPreRef = useRef(null);

  const [formNuevo, setFormNuevo] = useState({
    nombre: '', email: '', telefono: '', direccion: '',
    plan: 'estandar', dias_uso: '30', password_admin: '', username_admin: ''
  });

  const [formRenovar, setFormRenovar] = useState({
    dias: '30', monto: '', metodo_pago: 'manual', observaciones: ''
  });

  const [formDias, setFormDias] = useState({
    dias: '30'
  });

  useEffect(() => {
    cargarDatos();
    cargarAlertas();
    const interval = setInterval(cargarAlertas, 30000);
    return () => clearInterval(interval);
  }, []);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [resStats, resNegocios] = await Promise.all([
        api.get('/api/superadmin/stats'),
        api.get('/api/superadmin/negocios'),
      ]);
      setStats(resStats.data);
      setNegocios(resNegocios.data);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setStats(null);
      setNegocios([]);
    } finally {
      setCargando(false);
    }
  };

  const crearNegocio = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/api/superadmin/negocios', formNuevo);
      setExito('Negocio creado correctamente');
      setMostrarModalNuevo(false);
      setFormNuevo({ nombre: '', email: '', telefono: '', direccion: '', plan: 'estandar', dias_uso: '30', password_admin: '', username_admin: '' });
      cargarDatos();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear negocio');
    }
  };

  const cambiarEstado = async (id, estado) => {
    try {
      await api.put(`/api/superadmin/negocios/${id}`, { estado });
      cargarDatos();
      setExito(`Negocio ${estado === 'activo' ? 'activado' : 'bloqueado'} correctamente`);
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al cambiar estado');
    }
  };

  const eliminarNegocio = async (id) => {
    if (!window.confirm('⚠️ ESTAS SEGURO QUE QUIERES ELIMINAR ESTE NEGOCIO PERMANENTEMENTE?')) return;
    try {
      await api.delete(`/api/superadmin/negocios/${id}`);
      cargarDatos();
      setMostrarModalDetalleNegocio(null);
      setExito('✅ Negocio eliminado correctamente');
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al eliminar negocio');
    }
  };

  const cambiarPlanNegocio = async (negocioId, nuevoPlan) => {
    try {
      await api.put(`/api/superadmin/negocios/${negocioId}`, { plan: nuevoPlan });
      cargarDatos();
      setExito(`Plan cambiado a ${nuevoPlan.toUpperCase()} correctamente`);
    } catch (err) {
      setError('Error al cambiar el plan');
    }
  };

  const renovarSuscripcion = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/superadmin/negocios/${mostrarModalRenovar.id}/renovar`, formRenovar);
      setExito(`Suscripción renovada por ${formRenovar.dias} días`);
      setMostrarModalRenovar(null);
      setFormRenovar({ dias: '30', monto: '', metodo_pago: 'manual', observaciones: '' });
      cargarDatos();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al renovar suscripción');
    }
  };

  const actualizarDiasUso = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/api/superadmin/negocios/${mostrarModalDias.id}/dias-uso`, { dias: formDias.dias });
      setExito(`Días de uso actualizado a ${formDias.dias} días`);
      setMostrarModalDias(null);
      setFormDias({ dias: '30' });
      cargarDatos();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar días');
    }
  };

  const cargarHistorialPagos = async (negocioId) => {
    try {
      setCargandoHistorial(true);
      const res = await api.get(`/api/superadmin/negocios/${negocioId}/historial-pagos`);
      setHistorialPagos(res.data || []);
    } catch (err) {
      console.error('Error:', err);
      setHistorialPagos([]);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const abrirSubModal = (abrirFn) => {
    setNegocioDetalleGuardado(mostrarModalDetalleNegocio);
    setMostrarModalDetalleNegocio(null);
    abrirFn();
  };

  const cerrarSubModal = (cerrarFn) => {
    cerrarFn(null);
    if (negocioDetalleGuardado) {
      setMostrarModalDetalleNegocio(negocioDetalleGuardado);
      setNegocioDetalleGuardado(null);
    }
  };

  const guardarMiCuenta = async (e) => {
    e.preventDefault();
    setGuardandoCuenta(true);
    setError('');

    if (formMiCuenta.password && formMiCuenta.password !== formMiCuenta.confirmarPassword) {
      setGuardandoCuenta(false);
      return setError('Las contraseñas no coinciden');
    }

    try {
      await api.put('/api/superadmin/mi-cuenta', {
        nombre: formMiCuenta.nombre,
        email: formMiCuenta.email,
        ...(formMiCuenta.password ? { password: formMiCuenta.password } : {})
      });
      setExito('✅ Tu cuenta fue actualizada correctamente');
      setMostrarModalMiCuenta(false);
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar cuenta');
    } finally {
      setGuardandoCuenta(false);
    }
  };

  const cargarAdminNegocio = async (negocio) => {
    try {
      const res = await api.get(`/api/superadmin/negocios/${negocio.id}/admin`);
      setFormAdminNegocio({
        nombre: res.data.nombre || '',
        username: res.data.username || '',
        password: '',
        usuario_id: res.data.id
      });
      setMostrarModalAdminNegocio(negocio);
    } catch (err) {
      setError('Error al cargar datos del administrador');
    }
  };

  const guardarAdminNegocio = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/api/superadmin/negocios/${mostrarModalAdminNegocio.id}/admin`, {
        nombre: formAdminNegocio.nombre,
        username: formAdminNegocio.username,
        ...(formAdminNegocio.password ? { password: formAdminNegocio.password } : {})
      });
      setExito('✅ Administrador actualizado correctamente');
      setMostrarModalAdminNegocio(null);
      cargarDatos();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar administrador');
    }
  };

  const accederNegocio = async (negocioId) => {
    try {
      const res = await api.get(`/api/superadmin/negocios/${negocioId}/acceso`);
      if (res.data.acceso_permitido) {
        localStorage.setItem('acceso_superadmin_negocio', negocioId);
        window.location.href = `/admin`;
      }
    } catch (err) {
      setError('No se puede acceder a este negocio');
    }
  };

  const cargarAlertas = async () => {
    try {
      const res = await api.get('/api/superadmin/alertas');
      setAlertas(res.data || []);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const cargarSaludNegocio = async (negocioId) => {
    try {
      setCargandoSalud(true);
      const res = await api.get(`/api/superadmin/salud/${negocioId}`);
      setSaludNegocio(res.data);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar salud del negocio');
    } finally {
      setCargandoSalud(false);
    }
  };

  const cargarTickets = async (negocioId = null) => {
    try {
      setCargandoTickets(true);
      const url = negocioId
        ? `/api/superadmin/tickets?negocio_id=${negocioId}`
        : '/api/superadmin/tickets?estado=abierto';
      const res = await api.get(url);
      setTickets(res.data || []);
    } catch (err) {
      console.error('Error:', err);
      setTickets([]);
    } finally {
      setCargandoTickets(false);
    }
  };

  const responderTicket = async (ticketId, respuesta) => {
    if (!respuesta || !respuesta.trim()) {
      setError('Escribí una respuesta antes de enviar');
      setTimeout(() => setError(''), 3000);
      return;
    }
    try {
      await api.put(`/api/superadmin/tickets/${ticketId}`, {
        estado: 'resuelto',
        respuesta: respuesta
      });
      setExito('Ticket respondido correctamente');
      setRespuestaTicket('');
      // Recargar los tickets del negocio que se está gestionando
      cargarTickets(mostrarModalGestionTickets?.id || null);
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al responder ticket');
    }
  };

  const cambiarEstadoTicket = async (ticketId, estado) => {
    try {
      await api.put(`/api/superadmin/tickets/${ticketId}`, { estado });
      setExito(`Ticket marcado como ${estado}`);
      cargarTickets(mostrarModalGestionTickets?.id || null);
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al cambiar estado del ticket');
    }
  };

  const resolverAlerta = async (alertaId) => {
    try {
      await api.put(`/api/superadmin/alertas/${alertaId}/resolver`);
      cargarAlertas();
      setExito('Alerta resuelta');
      setTimeout(() => setExito(''), 2000);
    } catch (err) {
      setError('Error al resolver alerta');
    }
  };

  const diasRestantes = (fecha) => {
    if (!fecha) return 0;
    const diff = new Date(fecha) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // ---- VISOR DE LOGS ----
  const detenerLogs = () => {
    if (logsIntervalRef.current) {
      clearInterval(logsIntervalRef.current);
      logsIntervalRef.current = null;
    }
    setLogsActivo(false);
  };

  const tickLogs = async () => {
    try {
      const res = await api.get(`/api/superadmin/logs/en-vivo?desde=${logsUltimoIdRef.current}`);
      logsUltimoIdRef.current = res.data.ultimoId || logsUltimoIdRef.current;
      if (res.data.lineas?.length > 0) {
        const nuevas = res.data.lineas.map(l =>
          `[${(l.fecha || '').slice(11, 19)}] ${(l.nivel || 'info').toUpperCase().padEnd(5)} ${l.mensaje}`
        );
        setLogsContenido(prev => [...prev, ...nuevas].slice(-500));
      }
    } catch { /* si falla un tick, el próximo reintenta */ }
  };

  const iniciarLogsEnVivo = () => {
    detenerLogs();
    setLogsContenido([`— Conectado. Mostrando logs del servidor en tiempo real (se actualiza cada 3 segundos) —`]);
    logsUltimoIdRef.current = 0;
    setLogsActivo(true);
    tickLogs();
    logsIntervalRef.current = setInterval(tickLogs, 3000);
  };

  const cargarLogArchivo = async (tipo) => {
    detenerLogs();
    setLogsCargando(true);
    try {
      const res = await api.get(`/api/superadmin/logs/archivo?tipo=${tipo}`);
      if (!res.data.disponible) {
        setLogsContenido([res.data.mensaje || 'Archivo de log no disponible']);
      } else {
        setLogsContenido(res.data.contenido.split('\n').slice(-500));
      }
    } catch {
      setLogsContenido(['❌ Error al cargar el archivo de log']);
    } finally {
      setLogsCargando(false);
    }
  };

  const cerrarModalLogs = () => {
    detenerLogs();
    setMostrarModalLogs(false);
    setLogsContenido([]);
    logsUltimoIdRef.current = 0;
  };

  // Auto-scroll al final cuando llegan líneas nuevas
  useEffect(() => {
    if (logsPreRef.current) logsPreRef.current.scrollTop = logsPreRef.current.scrollHeight;
  }, [logsContenido]);

  // Cortar el polling si se desmonta la página
  useEffect(() => () => detenerLogs(), []);

  if (cargando) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-white text-lg">Cargando panel...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">

      {/* Barra superior */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 text-white px-4 sm:px-8 py-4 sm:py-6 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40 shadow-2xl">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform flex-shrink-0">
            <span className="text-lg sm:text-xl">👑</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg sm:text-2xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent truncate">Centro de Control SuperAdmin</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 truncate">Gestión Global • {usuario?.nombre}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block mr-1">
            <VersionChangelog variant="superadmin" />
          </div>
          <button onClick={() => setMostrarModalLogs(true)}
            className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            title="Ver logs del servidor">
            📜 <span className="hidden sm:inline">Logs</span>
          </button>
          <button onClick={() => {
            setFormMiCuenta({ nombre: usuario?.nombre || '', email: usuario?.email || '', password: '' });
            setMostrarModalMiCuenta(true);
          }}
            className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
            👤 <span className="hidden sm:inline">Mi Cuenta</span>
          </button>

          <button onClick={logout}
            className="bg-red-600 hover:bg-red-700 px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg whitespace-nowrap">
            🚪 <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">

        {/* Mensajes */}
        {exito && (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 text-green-400 px-6 py-4 rounded-xl backdrop-blur-sm shadow-lg flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <span className="font-medium">{exito}</span>
          </div>
        )}
        {error && (
          <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 text-red-400 px-6 py-4 rounded-xl backdrop-blur-sm shadow-lg flex items-center gap-3">
            <span className="text-2xl">❌</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Tarjetas de estadísticas globales */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30 rounded-2xl p-4">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide">Negocios</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.total_negocios}</p>
              <p className="text-xs text-slate-400 mt-1">
                <span className="text-green-400">{stats.negocios_activos} activos</span>
                {parseInt(stats.negocios_vencidos) > 0 && <> · <span className="text-yellow-400">{stats.negocios_vencidos} vencidos</span></>}
                {parseInt(stats.negocios_bloqueados) > 0 && <> · <span className="text-red-400">{stats.negocios_bloqueados} bloqueados</span></>}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-2xl p-4">
              <p className="text-purple-300 text-xs font-semibold uppercase tracking-wide">Usuarios</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.total_usuarios}</p>
              <p className="text-xs text-slate-400 mt-1">en todos los negocios</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 rounded-2xl p-4">
              <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wide">Ventas totales</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.total_ventas_global}</p>
              <p className="text-xs text-slate-400 mt-1">operaciones registradas</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/10 border border-amber-500/30 rounded-2xl p-4">
              <p className="text-amber-300 text-xs font-semibold uppercase tracking-wide">Facturado global</p>
              <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{fmt(stats.total_facturado_global)}</p>
              <p className="text-xs text-slate-400 mt-1">histórico de todos los negocios</p>
            </div>
          </div>
        )}

        {/* Alertas pendientes */}
        {alertas.filter(a => !a.resuelta).length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
            <p className="text-yellow-300 font-bold text-sm mb-3">
              ⚠️ {alertas.filter(a => !a.resuelta).length} alerta(s) pendiente(s)
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alertas.filter(a => !a.resuelta).slice(0, 10).map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 bg-black/20 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{a.titulo}</p>
                    <p className="text-xs text-slate-400 truncate">{a.descripcion}</p>
                  </div>
                  <button onClick={() => resolverAlerta(a.id)}
                    className="text-xs bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-200 px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors">
                    Resolver
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de negocios */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800">📊 Gestión de Negocios</h2>
              <p className="text-sm text-gray-500 mt-1">{negocios.length} negocios registrados en el sistema</p>
            </div>
            <button onClick={() => setMostrarModalNuevo(true)}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg flex items-center justify-center gap-2 w-full sm:w-auto">
              ➕ Nuevo Negocio
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold text-sm">Negocio</th>
                  <th className="text-left px-6 py-4 text-gray-700 font-semibold text-sm">Email</th>
                  <th className="text-center px-6 py-4 text-gray-700 font-semibold text-sm">Estado</th>
                  <th className="text-center px-6 py-4 text-gray-700 font-semibold text-sm">Plan</th>
                  <th className="text-center px-6 py-4 text-gray-700 font-semibold text-sm">Vencimiento</th>
                  <th className="text-right px-6 py-4 text-gray-700 font-semibold text-sm">Ventas</th>
                  <th className="text-right px-6 py-4 text-gray-700 font-semibold text-sm">Facturado</th>
                  <th className="text-center px-6 py-4 text-gray-700 font-semibold text-sm"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {negocios.map(negocio => {
                  const dias = diasRestantes(negocio.fecha_vencimiento);
                  return (
                    <tr key={negocio.id} 
                        onClick={(e) => {
                          if (!e.target.closest('button')) {
                            setMostrarModalDetalleNegocio(negocio);
                          }
                        }}
                        className="hover:bg-purple-50/50 transition-all duration-200 cursor-pointer group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                            {negocio.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 group-hover:text-purple-700 transition-colors">{negocio.nombre}</p>
                            <p className="text-xs text-gray-500">{negocio.total_usuarios} usuarios • {negocio.total_productos} productos • cliente desde {fmtFecha(negocio.created_at)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{negocio.email}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                          negocio.estado === 'activo' ? 'bg-green-100 text-green-700' :
                          negocio.estado === 'bloqueado' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {negocio.estado === 'activo' ? '✅ Activo' : negocio.estado === 'bloqueado' ? '🚫 Bloqueado' : '⏳ Vencido'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                          negocio.plan === 'premium' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {(negocio.plan || 'estandar').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className="text-sm font-semibold text-gray-700">{fmtFecha(negocio.fecha_vencimiento)}</p>
                        <p className={`text-xs font-medium mt-1 ${dias <= 5 ? 'text-red-600' : dias <= 10 ? 'text-orange-600' : 'text-green-600'}`}>
                          {dias > 0 ? `${dias} días` : '⚠️ Vencido'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-semibold text-gray-800">{negocio.total_ventas}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {negocio.ultima_venta
                            ? `últ: ${fmtFecha(negocio.ultima_venta)}`
                            : 'sin ventas'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-green-600 text-lg">{fmt(negocio.total_facturado)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          30d: <span className="font-semibold text-gray-600">{fmt(negocio.facturado_30d)}</span> ({negocio.ventas_30d || 0} vtas)
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-purple-500 text-sm font-medium group-hover:text-purple-700">
                          Ver detalles →
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modal Detalle del Negocio */}
      {mostrarModalDetalleNegocio && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-bold backdrop-blur-sm">
                    {mostrarModalDetalleNegocio.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{mostrarModalDetalleNegocio.nombre}</h2>
                    <p className="text-white/80 text-sm mt-1">{mostrarModalDetalleNegocio.email}</p>
                  </div>
                </div>
                <button onClick={() => setMostrarModalDetalleNegocio(null)} 
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-2xl transition-all">
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Información del Negocio */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-lg">📋</span> Información del Negocio
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Teléfono</p>
                    <p className="font-medium text-gray-800">{mostrarModalDetalleNegocio.telefono || 'No especificado'}</p>
                  </div>
                   <div>
                     <p className="text-gray-500 mb-1">Plan Actual</p>
                     <select
                       value={mostrarModalDetalleNegocio.plan || 'estandar'}
                       onChange={async (e) => {
                         await cambiarPlanNegocio(mostrarModalDetalleNegocio.id, e.target.value);
                         setMostrarModalDetalleNegocio(null);
                       }}
                       className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                     >
                       <option value="estandar">📦 PLAN ESTANDAR</option>
                       <option value="premium">⭐ PLAN PREMIUM</option>
                     </select>
                   </div>
                  <div>
                    <p className="text-gray-500">Días de Uso</p>
                    <p className="font-medium text-gray-800">{mostrarModalDetalleNegocio.dias_uso || 30} días</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Dirección</p>
                    <p className="font-medium text-gray-800">{mostrarModalDetalleNegocio.direccion || 'No especificada'}</p>
                  </div>
                </div>
              </div>

              {/* Botones de Acción Grandes */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-lg">⚡</span> Acciones Disponibles
                </h3>
                
                {/* Editar Admin del Negocio */}
                 <button onClick={() => {
                    const neg = negocioDetalleGuardado || mostrarModalDetalleNegocio;
                    setNegocioDetalleGuardado(neg);
                    setMostrarModalDetalleNegocio(null);
                    cargarAdminNegocio(neg);
                 }}
                  className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white p-4 rounded-xl flex items-center gap-4 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">👤</div>
                  <div className="text-left">
                    <p className="font-bold text-lg">Editar Administrador</p>
                    <p className="text-white/80 text-sm">Cambiar nombre, email o contraseña del admin del negocio</p>
                  </div>
                </button>

                {/* Acceder al Panel */}
                <button onClick={() => {
                  accederNegocio(mostrarModalDetalleNegocio.id);
                  setMostrarModalDetalleNegocio(null);
                }}
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white p-4 rounded-xl flex items-center gap-4 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                    🔓
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">Acceder al Panel</p>
                    <p className="text-white/80 text-sm">Entrar al panel de administración de este negocio</p>
                  </div>
                </button>

                {/* Renovar Suscripción */}
                 <button onClick={() => {
                   const neg = negocioDetalleGuardado || mostrarModalDetalleNegocio;
                   setNegocioDetalleGuardado(neg);
                   setMostrarModalDetalleNegocio(null);
                   setMostrarModalRenovar(neg);
                   setFormRenovar({ dias: '30', monto: '', metodo_pago: 'manual', observaciones: '' });
                 }}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-4 rounded-xl flex items-center gap-4 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                    🔄
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">Renovar Suscripción</p>
                    <p className="text-white/80 text-sm">Extender el período de uso del negocio</p>
                  </div>
                </button>

                 {/* Editar Días de Uso */}
                  <button onClick={() => {
                    const neg = negocioDetalleGuardado || mostrarModalDetalleNegocio;
                    setNegocioDetalleGuardado(neg);
                    setMostrarModalDetalleNegocio(null);
                    setMostrarModalDias(neg);
                    setFormDias({ dias: neg.dias_uso?.toString() || '30' });
                  }}
                   className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white p-4 rounded-xl flex items-center gap-4 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                   <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                     📅
                   </div>
                   <div className="text-left">
                     <p className="font-bold text-lg">Editar Días de Uso</p>
                     <p className="text-white/80 text-sm">Modificar la cantidad de días disponibles</p>
                   </div>
                 </button>

                {/* Ver Historial de Pagos */}
                 <button onClick={() => {
                   const neg = negocioDetalleGuardado || mostrarModalDetalleNegocio;
                   setNegocioDetalleGuardado(neg);
                   setMostrarModalDetalleNegocio(null);
                   setMostrarModalHistorial(neg);
                   cargarHistorialPagos(neg.id);
                 }}
                  className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white p-4 rounded-xl flex items-center gap-4 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                    📊
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">Ver Historial de Pagos</p>
                    <p className="text-white/80 text-sm">Consultar todos los pagos y renovaciones realizadas</p>
                  </div>
                </button>

                {/* Ver Salud del Negocio */}
               <button onClick={() => {
                   const neg = negocioDetalleGuardado || mostrarModalDetalleNegocio;
                   setNegocioDetalleGuardado(neg);
                   setMostrarModalDetalleNegocio(null);
                   setMostrarModalSalud(neg);
                   cargarSaludNegocio(neg.id);
                 }}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-4 rounded-xl flex items-center gap-4 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                    ❤️
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">Ver Salud del Negocio</p>
                    <p className="text-white/80 text-sm">Analizar actividad, errores y estado general</p>
                  </div>
                </button>

                {/* Gestionar Tickets */}
                 <button onClick={() => {
                   const neg = negocioDetalleGuardado || mostrarModalDetalleNegocio;
                   setNegocioDetalleGuardado(neg);
                   setMostrarModalDetalleNegocio(null);
                   setMostrarModalGestionTickets(neg);
                   cargarTickets(neg.id);
                 }}
                  className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white p-4 rounded-xl flex items-center gap-4 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                    🎫
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">Gestionar Tickets</p>
                    <p className="text-white/80 text-sm">Responder solicitudes de soporte del cliente</p>
                  </div>
                </button>

                {/* Bloquear/Activar */}
                {mostrarModalDetalleNegocio.estado === 'activo' ? (
                  <button onClick={() => {
                    cambiarEstado(mostrarModalDetalleNegocio.id, 'bloqueado');
                    setMostrarModalDetalleNegocio(null);
                  }}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white p-4 rounded-xl flex items-center gap-4 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                      🚫
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-lg">Bloquear Negocio</p>
                      <p className="text-white/80 text-sm">Suspender el acceso a este negocio</p>
                    </div>
                  </button>
                ) : (
                  <button onClick={() => {
                    cambiarEstado(mostrarModalDetalleNegocio.id, 'activo');
                    setMostrarModalDetalleNegocio(null);
                  }}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-4 rounded-xl flex items-center gap-4 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                      ✅
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-lg">Activar Negocio</p>
                      <p className="text-white/80 text-sm">Restaurar el acceso a este negocio</p>
                    </div>
                  </button>
                )}

                {/* ELIMINAR NEGOCIO */}
                <button onClick={() => eliminarNegocio(mostrarModalDetalleNegocio.id)}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white p-4 rounded-xl flex items-center gap-4 transition-all duration-200 shadow-lg hover:shadow-xl">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🗑️</div>
                  <div className="text-left">
                    <p className="font-bold text-lg">ELIMINAR NEGOCIO PERMANENTEMENTE</p>
                    <p className="text-white/80 text-sm">⚠️ Esta accion no se puede deshacer</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button onClick={() => setMostrarModalDetalleNegocio(null)}
                className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Renovar Suscripción */}
      {mostrarModalRenovar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">🔄 Renovar Suscripción</h3>
              <p className="text-sm text-gray-500 mt-1">{mostrarModalRenovar.nombre}</p>
            </div>

            <form onSubmit={renovarSuscripcion} className="p-6 space-y-4">
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Días a Agregar</label>
                <input
                  type="number"
                  value={formRenovar.dias}
                  onChange={(e) => setFormRenovar(p => ({ ...p, dias: e.target.value }))}
                  required
                  min="1"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Monto (opcional)</label>
                <input
                  type="number"
                  value={formRenovar.monto}
                  onChange={(e) => setFormRenovar(p => ({ ...p, monto: e.target.value }))}
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
                <select
                  value={formRenovar.metodo_pago}
                  onChange={(e) => setFormRenovar(p => ({ ...p, metodo_pago: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="manual">Manual</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="mercadopago">MercadoPago</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones (opcional)</label>
                <textarea
                  value={formRenovar.observaciones}
                  onChange={(e) => setFormRenovar(p => ({ ...p, observaciones: e.target.value }))}
                  rows="3"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Notas adicionales..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModalRenovar(null);
                    if (negocioDetalleGuardado) {
                      setMostrarModalDetalleNegocio(negocioDetalleGuardado);
                      setNegocioDetalleGuardado(null);
                    }
                  }}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors"
                >
                  Renovar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Días de Uso */}
      {mostrarModalDias && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">📅 Editar Días de Uso</h3>
              <p className="text-sm text-gray-500 mt-1">{mostrarModalDias.nombre}</p>
            </div>

            <form onSubmit={actualizarDiasUso} className="p-6 space-y-4">
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Días de Uso</label>
                <input
                  type="number"
                  value={formDias.dias}
                  onChange={(e) => setFormDias({ dias: e.target.value })}
                  required
                  min="1"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="30"
                />
                <p className="text-xs text-gray-500 mt-2">
                  ⚠️ Esto establecerá la fecha de vencimiento a HOY + {formDias.dias} días
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Nueva fecha de vencimiento:</strong><br />
                  {new Date(Date.now() + parseInt(formDias.dias || 0) * 24 * 60 * 60 * 1000).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModalDias(null);
                    if (negocioDetalleGuardado) {
                      setMostrarModalDetalleNegocio(negocioDetalleGuardado);
                      setNegocioDetalleGuardado(null);
                    }
                  }}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-colors"
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Administrador */}
      {mostrarModalAdminNegocio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">👤 Editar Administrador</h3>
              <p className="text-sm text-gray-500 mt-1">{mostrarModalAdminNegocio.nombre}</p>
            </div>

            <form onSubmit={guardarAdminNegocio} className="p-6 space-y-4">
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Completo</label>
                <input
                  type="text"
                  value={formAdminNegocio.nombre}
                  onChange={(e) => setFormAdminNegocio(p => ({ ...p, nombre: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="Admin Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Usuario (para iniciar sesión)</label>
                <input
                  type="text"
                  value={formAdminNegocio.username}
                  onChange={(e) => setFormAdminNegocio(p => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="adminnegocio"
                />
                <p className="text-xs text-gray-500 mt-1">Sin espacios. Es el usuario con el que inicia sesión.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nueva Contraseña (opcional)</label>
                <input
                  type="password"
                  value={formAdminNegocio.password}
                  onChange={(e) => setFormAdminNegocio(p => ({ ...p, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="Dejar vacío para no cambiar"
                />
                <p className="text-xs text-gray-500 mt-1">Solo completar si querés cambiar la contraseña</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarModalAdminNegocio(null);
                    if (negocioDetalleGuardado) {
                      setMostrarModalDetalleNegocio(negocioDetalleGuardado);
                      setNegocioDetalleGuardado(null);
                    }
                  }}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Historial de Pagos */}
      {mostrarModalHistorial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">📊 Historial de Pagos</h3>
              <p className="text-sm text-gray-500 mt-1">{mostrarModalHistorial.nombre}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {cargandoHistorial ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Cargando...</p>
                </div>
              ) : historialPagos.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No hay pagos registrados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historialPagos.map((pago, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-800">
                          {pago.tipo === 'renovacion' ? '🔄 Renovación' : '💰 Pago'}
                        </span>
                        <span className="text-sm text-gray-500">{fmtFecha(pago.fecha)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Días:</span>{' '}
                          <span className="font-medium">{pago.dias} días</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Monto:</span>{' '}
                          <span className="font-medium">{fmt(pago.monto)}</span>
                        </div>
                        {pago.metodo_pago && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Método:</span>{' '}
                            <span className="font-medium capitalize">{pago.metodo_pago}</span>
                          </div>
                        )}
                        {pago.observaciones && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Obs:</span>{' '}
                            <span className="text-gray-700">{pago.observaciones}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setMostrarModalHistorial(null);
                  if (negocioDetalleGuardado) {
                    setMostrarModalDetalleNegocio(negocioDetalleGuardado);
                    setNegocioDetalleGuardado(null);
                  }
                }}
                className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Salud del Negocio */}
      {mostrarModalSalud && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">❤️ Salud del Negocio</h3>
              <p className="text-sm text-gray-500 mt-1">{mostrarModalSalud.nombre}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {cargandoSalud ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Cargando...</p>
                </div>
              ) : saludNegocio ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600 font-medium">Última Actividad</p>
                      <p className="text-lg font-bold text-blue-900">{fmtFecha(saludNegocio.ultima_actividad)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-600 font-medium">Días sin Actividad</p>
                      <p className="text-lg font-bold text-green-900">{saludNegocio.sin_actividad_dias || 0} días</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-sm text-yellow-600 font-medium">Errores (24h)</p>
                      <p className="text-lg font-bold text-yellow-900">{saludNegocio.errores_24h || 0}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-purple-600 font-medium">Estado</p>
                      <p className="text-lg font-bold text-purple-900 capitalize">{saludNegocio.estado || 'activo'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No hay datos de salud disponibles</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setMostrarModalSalud(null);
                  setSaludNegocio(null);
                  if (negocioDetalleGuardado) {
                    setMostrarModalDetalleNegocio(negocioDetalleGuardado);
                    setNegocioDetalleGuardado(null);
                  }
                }}
                className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gestión de Tickets */}
      {mostrarModalGestionTickets && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800">🎫 Gestión de Tickets</h3>
                <p className="text-sm text-gray-500 mt-1">{mostrarModalGestionTickets.nombre}</p>
              </div>
              <button
                onClick={() => cargarTickets(mostrarModalGestionTickets.id)}
                className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                🔄 Actualizar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {cargandoTickets ? (
                <div className="text-center py-8"><p className="text-gray-500">Cargando tickets...</p></div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-gray-500">Este negocio no tiene tickets de soporte</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.map(ticket => {
                    const estadoColor = {
                      abierto: 'bg-yellow-100 text-yellow-700',
                      en_progreso: 'bg-blue-100 text-blue-700',
                      resuelto: 'bg-green-100 text-green-700',
                      cerrado: 'bg-gray-100 text-gray-600',
                    }[ticket.estado] || 'bg-gray-100 text-gray-600';
                    const prioridadColor = {
                      baja: 'text-gray-500', media: 'text-blue-600',
                      alta: 'text-orange-600', urgente: 'text-red-600',
                    }[ticket.prioridad] || 'text-gray-500';
                    return (
                      <div key={ticket.id} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor}`}>
                                {ticket.estado}
                              </span>
                              {ticket.categoria && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                  {ticket.categoria}
                                </span>
                              )}
                              <span className={`text-xs font-semibold ${prioridadColor}`}>
                                ● {ticket.prioridad || 'media'}
                              </span>
                            </div>
                            <h4 className="font-bold text-gray-800 mt-2">{ticket.titulo}</h4>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{fmtFecha(ticket.fecha_creacion)}</span>
                        </div>

                        <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">{ticket.descripcion}</p>
                        {ticket.usuario_nombre && (
                          <p className="text-xs text-gray-400 mb-2">Reportado por: {ticket.usuario_nombre}</p>
                        )}

                        {ticket.respuesta && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                            <p className="text-xs font-semibold text-green-700 mb-1">✅ Respuesta:</p>
                            <p className="text-sm text-green-800 whitespace-pre-wrap">{ticket.respuesta}</p>
                          </div>
                        )}

                        {ticket.estado !== 'resuelto' && ticket.estado !== 'cerrado' ? (
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={respuestaTicket}
                              onChange={(e) => setRespuestaTicket(e.target.value)}
                              rows="2"
                              placeholder="Escribí una respuesta para resolver el ticket..."
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => responderTicket(ticket.id, respuestaTicket)}
                                className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg font-medium transition-colors">
                                Responder y resolver
                              </button>
                              <button
                                onClick={() => cambiarEstadoTicket(ticket.id, 'en_progreso')}
                                className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-1.5 rounded-lg font-medium transition-colors">
                                Marcar en progreso
                              </button>
                              <button
                                onClick={() => cambiarEstadoTicket(ticket.id, 'cerrado')}
                                className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-1.5 rounded-lg font-medium transition-colors">
                                Cerrar
                              </button>
                            </div>
                          </div>
                        ) : (
                          ticket.estado === 'resuelto' && (
                            <button
                              onClick={() => cambiarEstadoTicket(ticket.id, 'cerrado')}
                              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg font-medium transition-colors mt-1">
                              Cerrar ticket
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setMostrarModalGestionTickets(null);
                  setRespuestaTicket('');
                  if (negocioDetalleGuardado) {
                    setMostrarModalDetalleNegocio(negocioDetalleGuardado);
                    setNegocioDetalleGuardado(null);
                  }
                }}
                className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Negocio */}
      {mostrarModalNuevo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800">➕ Nuevo Negocio</h3>
                <p className="text-xs text-gray-500">Se crea el negocio junto con su usuario administrador</p>
              </div>
              <button onClick={() => setMostrarModalNuevo(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <form onSubmit={crearNegocio} className="p-5 space-y-4">
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio *</label>
                <input type="text" value={formNuevo.nombre} required
                  onChange={(e) => setFormNuevo(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej: Almacén Don Pedro" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={formNuevo.email} required
                    onChange={(e) => setFormNuevo(p => ({ ...p, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="dueño@negocio.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="text" value={formNuevo.telefono}
                    onChange={(e) => setFormNuevo(p => ({ ...p, telefono: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Opcional" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input type="text" value={formNuevo.direccion}
                  onChange={(e) => setFormNuevo(p => ({ ...p, direccion: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Opcional" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                  <div className="flex gap-2">
                    {[{ id: 'estandar', label: '📦 Estándar' }, { id: 'premium', label: '✨ Premium' }].map(pl => (
                      <button key={pl.id} type="button"
                        onClick={() => setFormNuevo(p => ({ ...p, plan: pl.id }))}
                        className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium border-2 transition-all ${formNuevo.plan === pl.id ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}>
                        {pl.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Días de uso</label>
                  <input type="number" value={formNuevo.dias_uso} min="1"
                    onChange={(e) => setFormNuevo(p => ({ ...p, dias_uso: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">👤 Usuario administrador del negocio</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Usuario *</label>
                    <input type="text" value={formNuevo.username_admin} required
                      onChange={(e) => setFormNuevo(p => ({ ...p, username_admin: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Ej: donpedro" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                    <input type="text" value={formNuevo.password_admin} required
                      onChange={(e) => setFormNuevo(p => ({ ...p, password_admin: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Contraseña inicial" />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Con estas credenciales el dueño inicia sesión por primera vez.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMostrarModalNuevo(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors">
                  ✅ Crear Negocio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visor de Logs */}
      {mostrarModalLogs && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-gray-700">

            {/* Encabezado + controles */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-white">📜 Logs del Servidor</h3>
                <p className="text-xs text-gray-400">
                  Solo consume recursos mientras está iniciado. Al cerrar, se corta solo.
                </p>
              </div>
              <button onClick={cerrarModalLogs} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-2 flex-wrap">
              {!logsActivo ? (
                <button onClick={iniciarLogsEnVivo}
                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                  ▶️ Iniciar en vivo
                </button>
              ) : (
                <button onClick={detenerLogs}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                  ⏸ Detener
                </button>
              )}
              <div className="w-px h-6 bg-gray-700" />
              <button onClick={() => cargarLogArchivo('out')} disabled={logsCargando}
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                📄 Archivo (salida)
              </button>
              <button onClick={() => cargarLogArchivo('error')} disabled={logsCargando}
                className="bg-gray-700 hover:bg-gray-600 text-red-300 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                ❌ Archivo (errores)
              </button>
              {logsActivo && (
                <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> En vivo
                </span>
              )}
            </div>

            {/* Contenido */}
            <pre ref={logsPreRef}
              className="flex-1 overflow-y-auto p-4 text-xs font-mono text-green-300 whitespace-pre-wrap break-all bg-black/40">
              {logsCargando
                ? 'Cargando...'
                : logsContenido.length === 0
                  ? 'Apretá "▶️ Iniciar en vivo" para ver los logs en tiempo real,\no cargá un archivo guardado con los botones de arriba.'
                  : logsContenido.join('\n')}
            </pre>
          </div>
        </div>
      )}

      {/* Modal Mi Cuenta */}
      {mostrarModalMiCuenta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">👤 Mi Cuenta SuperAdmin</h3>
            </div>

            <form onSubmit={guardarMiCuenta} className="p-6 space-y-4">
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
                <input
                  type="text"
                  value={formMiCuenta.nombre}
                  onChange={(e) => setFormMiCuenta(p => ({ ...p, nombre: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formMiCuenta.email}
                  onChange={(e) => setFormMiCuenta(p => ({ ...p, email: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nueva Contraseña (opcional)</label>
                <input
                  type="password"
                  value={formMiCuenta.password}
                  onChange={(e) => setFormMiCuenta(p => ({ ...p, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar Contraseña</label>
                <input
                  type="password"
                  value={formMiCuenta.confirmarPassword}
                  onChange={(e) => setFormMiCuenta(p => ({ ...p, confirmarPassword: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMostrarModalMiCuenta(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCuenta}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {guardandoCuenta ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Superadmin;
