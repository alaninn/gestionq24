// =============================================
// ARCHIVO: src/pages/Superadmin.jsx
// FUNCIÓN: Panel de control global - solo superadmin
// =============================================

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

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
  const [mostrarModalEditar, setMostrarModalEditar] = useState(null);
  const [mostrarModalHistorial, setMostrarModalHistorial] = useState(null);
  const [mostrarModalRenovar, setMostrarModalRenovar] = useState(null);
  const [mostrarModalDias, setMostrarModalDias] = useState(null);
  const [mostrarModalSalud, setMostrarModalSalud] = useState(null);
  const [mostrarModalGestionTickets, setMostrarModalGestionTickets] = useState(null);
 const [mostrarModalDetalleNegocio, setMostrarModalDetalleNegocio] = useState(null);
  const [negocioDetalleGuardado, setNegocioDetalleGuardado] = useState(null); // para volver al modal
  const [mostrarModalMiCuenta, setMostrarModalMiCuenta] = useState(false);
  const [mostrarModalAdminNegocio, setMostrarModalAdminNegocio] = useState(null);
  const [formMiCuenta, setFormMiCuenta] = useState({ nombre: '', email: '', password: '', confirmarPassword: '' });
  const [formAdminNegocio, setFormAdminNegocio] = useState({ nombre: '', email: '', password: '' });
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

  const [formNuevo, setFormNuevo] = useState({
    nombre: '', email: '', telefono: '', direccion: '',
    plan: 'mensual', dias_uso: '30', password_admin: '', username_admin: ''
  });

  const [formRenovar, setFormRenovar] = useState({
    dias: '30', monto: '', metodo_pago: 'manual', observaciones: ''
  });

  const [formDias, setFormDias] = useState({
    dias: '30'
  });

  useEffect(() => {
    cargarDatos();
    // Cargar alertas sin bloquear la UI
    cargarAlertas();
    // Recargar alertas cada 30 segundos
    const interval = setInterval(cargarAlertas, 30000);
    return () => clearInterval(interval);
  }, []);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      // Cargar stats y negocios en paralelo
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
      setFormNuevo({ nombre: '', email: '', telefono: '', direccion: '', plan: 'mensual', dias_uso: '30', password_admin: '' });
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

  

  // Abre un sub-modal guardando el negocio actual para poder volver al detalle
  const abrirSubModal = (abrirFn) => {
    setNegocioDetalleGuardado(mostrarModalDetalleNegocio);
    setMostrarModalDetalleNegocio(null);
    abrirFn();
  };

  // Cierra el sub-modal y vuelve al detalle del negocio
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
      // Buscar el admin principal del negocio
      const res = await api.get(`/api/superadmin/negocios/${negocio.id}/admin`);
      setFormAdminNegocio({
        nombre: res.data.nombre || '',
        email: res.data.email || '',
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
        email: formAdminNegocio.email,
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
        // Guardar que estamos accediendo como superadmin a otro negocio
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

  const cargarTickets = async () => {
    try {
      setCargandoTickets(true);
      const res = await api.get('/api/superadmin/tickets?estado=abierto');
      setTickets(res.data || []);
    } catch (err) {
      console.error('Error:', err);
      setTickets([]);
    } finally {
      setCargandoTickets(false);
    }
  };

  const responderTicket = async (ticketId, respuesta) => {
    try {
      await api.put(`/api/superadmin/tickets/${ticketId}`, {
        estado: 'resuelto',
        respuesta: respuesta
      });
      setExito('Ticket respondido correctamente');
      setRespuestaTicket('');
      cargarTickets();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al responder ticket');
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

  if (cargando) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-white text-lg">Cargando panel...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">

      {/* Barra superior mejorada */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 text-white px-8 py-6 flex items-center justify-between sticky top-0 z-40 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
            <span className="text-xl">👑</span>
          </div>
          <div>
            <h1 className="font-bold text-2xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Centro de Control SuperAdmin</h1>
            <p className="text-slate-400 text-sm mt-0.5">Gestión Global de Negocios • {usuario?.nombre}</p>
          </div>
        </div>
        <button onClick={() => {
          setFormMiCuenta({ nombre: usuario?.nombre || '', email: usuario?.email || '', password: '' });
          setMostrarModalMiCuenta(true);
        }}
          className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
          👤 Mi Cuenta
        </button>

        <button onClick={logout}
          className="bg-red-600 hover:bg-red-700 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
          🚪 Cerrar Sesión
        </button>
      </div>

      <div className="p-8 space-y-8 max-w-7xl mx-auto">

        {/* Mensajes mejorados */}
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

        {/* Widget Alertas Mejorado */}
        {alertas.length > 0 && (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-3 text-lg">
                <span className="text-3xl animate-pulse">🚨</span> 
                <span>ALERTAS CRÍTICAS <span className="bg-red-500 text-white px-2.5 py-0.5 rounded-full text-sm ml-2">{alertas.length}</span></span>
              </h3>
              <button onClick={cargarAlertas}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl">
                🔄 Actualizar
              </button>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {alertas.slice(0, 10).map(alerta => (
                <div key={alerta.id} className={`p-4 rounded-xl flex items-start justify-between gap-3 backdrop-blur-sm border transition-all duration-200 ${
                  alerta.severidad === 'crítica' ? 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30' :
                  alerta.severidad === 'alta' ? 'bg-orange-500/20 border-orange-500/50 hover:bg-orange-500/30' :
                  'bg-yellow-500/20 border-yellow-500/50 hover:bg-yellow-500/30'
                }`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{alerta.titulo}</p>
                    <p className="text-xs text-slate-300 mt-1">{alerta.negocio_nombre}</p>
                    <p className="text-xs text-slate-400 mt-1.5">{alerta.descripcion}</p>
                  </div>
                  <button onClick={() => resolverAlerta(alerta.id)}
                    className="text-xs bg-white/20 hover:bg-white/40 text-white px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200 font-medium backdrop-blur-sm">
                    ✓ Resolver
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tarjetas de stats mejoradas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Negocios */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-700 hover:border-slate-600 transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🏢</span>
                </div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</span>
              </div>
              <p className="text-slate-400 text-sm font-medium mb-1">Negocios</p>
              <p className="text-4xl font-bold text-white">{stats.total_negocios}</p>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500">Registrados en el sistema</p>
              </div>
            </div>

            {/* Activos */}
            <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 rounded-2xl p-6 shadow-2xl border border-green-500/30 hover:border-green-500/50 transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-500/30 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Activos</span>
              </div>
              <p className="text-green-300 text-sm font-medium mb-1">En Operación</p>
              <p className="text-4xl font-bold text-green-400">{stats.negocios_activos}</p>
              <div className="mt-4 pt-4 border-t border-green-500/20">
                <p className="text-xs text-green-300/70">{Math.round((stats.negocios_activos / stats.total_negocios) * 100)}% del total</p>
              </div>
            </div>

            {/* Bloqueados */}
            <div className="bg-gradient-to-br from-red-900/40 to-pink-900/40 rounded-2xl p-6 shadow-2xl border border-red-500/30 hover:border-red-500/50 transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-red-500/30 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🚫</span>
                </div>
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Bloqueados</span>
              </div>
              <p className="text-red-300 text-sm font-medium mb-1">Suspendidos</p>
              <p className="text-4xl font-bold text-red-400">{stats.negocios_bloqueados}</p>
              <div className="mt-4 pt-4 border-t border-red-500/20">
                <p className="text-xs text-red-300/70">Requieren atención</p>
              </div>
            </div>

            {/* Facturación */}
            <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-2xl p-6 shadow-2xl border border-purple-500/30 hover:border-purple-500/50 transition-all duration-300 transform hover:scale-105">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-500/30 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Ingresos</span>
              </div>
              <p className="text-purple-300 text-sm font-medium mb-1">Facturación Global</p>
              <p className="text-3xl font-bold text-purple-400">{fmt(stats.total_facturado_global)}</p>
              <div className="mt-4 pt-4 border-t border-purple-500/20">
                <p className="text-xs text-purple-300/70">Todas las transacciones</p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de negocios mejorada */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div>
              <h2 className="text-xl font-bold text-gray-800">📊 Gestión de Negocios</h2>
              <p className="text-sm text-gray-500 mt-1">{negocios.length} negocios registrados en el sistema</p>
            </div>
            <button onClick={() => setMostrarModalNuevo(true)}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2">
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
                        onClick={() => setMostrarModalDetalleNegocio(negocio)}
                        className="hover:bg-purple-50/50 transition-all duration-200 cursor-pointer group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                            {negocio.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 group-hover:text-purple-700 transition-colors">{negocio.nombre}</p>
                            <p className="text-xs text-gray-500">{negocio.total_usuarios} usuarios • {negocio.total_productos} productos</p>
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
                        <p className="text-sm font-semibold text-gray-700">{fmtFecha(negocio.fecha_vencimiento)}</p>
                        <p className={`text-xs font-medium mt-1 ${dias <= 5 ? 'text-red-600' : dias <= 10 ? 'text-orange-600' : 'text-green-600'}`}>
                          {dias > 0 ? `${dias} días` : '⚠️ Vencido'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-semibold text-gray-800">{negocio.total_ventas}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-green-600 text-lg">{fmt(negocio.total_facturado)}</p>
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

        {/* Top negocios mejorado */}
        {stats?.top_negocios?.length > 0 && (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl p-6 border border-slate-700">
            <h3 className="font-bold text-white mb-6 text-lg flex items-center gap-2">
              <span className="text-2xl">🏆</span> Top Negocios por Facturación
            </h3>
            <div className="space-y-4">
              {stats.top_negocios.map((n, i) => {
                const maxFact = stats.top_negocios[0]?.total_facturado || 1;
                const pct = (n.total_facturado / maxFact) * 100;
                const medallas = ['🥇', '🥈', '🥉'];
                return (
                  <div key={i} className="flex items-center gap-4">
                    <span className="text-2xl w-8 text-center">{medallas[i] || '📍'}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-white">{n.nombre}</span>
                        <span className="text-sm font-bold text-green-400">{fmt(n.total_facturado)}</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{n.total_ventas} ventas</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal nuevo negocio */}
      {mostrarModalNuevo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b bg-green-50">
              <h3 className="text-lg font-bold text-gray-800">🏪 Nuevo Negocio</h3>
              <button onClick={() => setMostrarModalNuevo(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={crearNegocio} className="p-5 space-y-4">
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">❌ {error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio *</label>
                  <input type="text" value={formNuevo.nombre}
                    onChange={(e) => setFormNuevo(p => ({ ...p, nombre: e.target.value }))}
                    required autoFocus
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ej: Kiosco López" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email admin *</label>
                  <input type="email" value={formNuevo.email}
                    onChange={(e) => setFormNuevo(p => ({ ...p, email: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="admin@negocio.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="text" value={formNuevo.telefono}
                    onChange={(e) => setFormNuevo(p => ({ ...p, telefono: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                  <select value={formNuevo.plan}
                    onChange={(e) => setFormNuevo(p => ({ ...p, plan: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="mensual">Mensual</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="anual">Anual</option>
                    <option value="prueba">Prueba</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Días de uso *</label>
                  <input type="number" value={formNuevo.dias_uso}
                    onChange={(e) => setFormNuevo(p => ({ ...p, dias_uso: e.target.value }))}
                    required min="1"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario admin *</label>
                  <input type="text" value={formNuevo.username_admin}
                    onChange={(e) => setFormNuevo(p => ({ ...p, username_admin: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ej: adminpanaderia" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña admin *</label>
                  <input type="password" value={formNuevo.password_admin}
                    onChange={(e) => setFormNuevo(p => ({ ...p, password_admin: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Contraseña inicial" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input type="text" value={formNuevo.direccion}
                  onChange={(e) => setFormNuevo(p => ({ ...p, direccion: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
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

      {/* Modal renovar suscripción */}
      {mostrarModalRenovar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b bg-blue-50">
              <h3 className="text-lg font-bold text-gray-800">🔄 Renovar Suscripción</h3>
              <button onClick={() => cerrarSubModal(setMostrarModalRenovar)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={renovarSuscripcion} className="p-5 space-y-4">
              <div className="bg-blue-100 p-3 rounded-lg text-sm text-blue-700">
                📌 <strong>{mostrarModalRenovar?.nombre}</strong> - Renovarás la suscripción
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Días a Renovar *</label>
                <input type="number" value={formRenovar.dias}
                  onChange={(e) => setFormRenovar(p => ({ ...p, dias: e.target.value }))}
                  required min="1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (opcional)</label>
                <input type="number" value={formRenovar.monto}
                  onChange={(e) => setFormRenovar(p => ({ ...p, monto: e.target.value }))}
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: 5000" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                <select value={formRenovar.metodo_pago}
                  onChange={(e) => setFormRenovar(p => ({ ...p, metodo_pago: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="manual">Manual</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="mercadopago">Mercado Pago</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea value={formRenovar.observaciones}
                  onChange={(e) => setFormRenovar(p => ({ ...p, observaciones: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="Notas sobre la renovación..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => cerrarSubModal(setMostrarModalRenovar)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors">
                  ✅ Renovar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar días de uso */}
      {mostrarModalDias && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b bg-orange-50">
              <h3 className="text-lg font-bold text-gray-800">📅 Editar Días de Uso</h3>
              <button onClick={() => cerrarSubModal(setMostrarModalDias)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={actualizarDiasUso} className="p-5 space-y-4">
              <div className="bg-orange-100 p-3 rounded-lg text-sm text-orange-700">
                📌 <strong>{mostrarModalDias?.nombre}</strong> - Días actuales: <strong>{mostrarModalDias?.dias_uso || 30}</strong>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nuevos Días *</label>
                <input type="number" value={formDias.dias}
                  onChange={(e) => setFormDias({ dias: e.target.value })}
                  required min="1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus />
              </div>

              <div className="bg-gray-100 p-3 rounded-lg text-sm text-gray-600">
                💡 El vencimiento se actualizará a: <strong>{new Date(new Date().getTime() + parseInt(formDias.dias) * 24 * 60 * 60 * 1000).toLocaleDateString('es-AR')}</strong>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => cerrarSubModal(setMostrarModalDias)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold transition-colors">
                  ✅ Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal historial de pagos */}
      {mostrarModalHistorial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b bg-cyan-50">
              <h3 className="text-lg font-bold text-gray-800">📊 Historial de Pagos</h3>
              <button onClick={() => cerrarSubModal(setMostrarModalHistorial)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            
            <div className="p-5 bg-cyan-100 text-sm text-cyan-700">
              📌 <strong>{mostrarModalHistorial?.nombre}</strong>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cargandoHistorial ? (
                <div className="text-center py-8 text-gray-400">Cargando historial...</div>
              ) : historialPagos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">📭</p>
                  <p>No hay registros de pagos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historialPagos.map((pago) => (
                    <div key={pago.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">
                            {pago.tipo === 'pago' ? '💰' : '🔄'} {pago.tipo === 'pago' ? 'Pago' : 'Renovación'}
                          </p>
                          <p className="text-xs text-gray-500">{new Date(pago.fecha).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-800">{pago.dias} días</p>
                          {pago.monto > 0 && <p className="text-sm text-green-600">${fmt(pago.monto)}</p>}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        {pago.metodo_pago && <p>💳 Método: <span className="font-medium capitalize">{pago.metodo_pago}</span></p>}
                        {pago.observaciones && <p>📝 Notas: {pago.observaciones}</p>}
                      </div>
                      <div className="mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          pago.pagado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {pago.pagado ? '✅ Pagado' : '⏳ Pendiente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t bg-gray-50">
              <button onClick={() => cerrarSubModal(setMostrarModalHistorial)}
                className="w-full py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Salud del Negocio */}
      {mostrarModalSalud && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b bg-green-50">
              <h3 className="text-lg font-bold text-gray-800">❤️ Salud del Negocio</h3>
              <button onClick={() => cerrarSubModal(setMostrarModalSalud)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cargandoSalud ? (
                <div className="text-center py-8 text-gray-400">Cargando...</div>
              ) : saludNegocio ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800">{saludNegocio.negocio.nombre}</h4>
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                        saludNegocio.estado === 'activo' ? 'bg-green-100 text-green-700' :
                        saludNegocio.estado === 'inactivo' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {saludNegocio.estado === 'activo' ? '✅ Operativo' : 
                         saludNegocio.estado === 'inactivo' ? '⚠️ Inactivo' :
                         '❌ Nunca usado'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-white p-3 rounded-lg border border-green-100">
                        <p className="text-gray-500 text-xs">Última Actividad</p>
                        <p className="font-semibold text-gray-800">{saludNegocio.negocio.ultima_actividad ? new Date(saludNegocio.negocio.ultima_actividad).toLocaleDateString('es-AR') : 'Nunca'}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-green-100">
                        <p className="text-gray-500 text-xs">Días sin Actividad</p>
                        <p className="font-semibold text-gray-800">{saludNegocio.negocio.dias_sin_actividad !== null ? saludNegocio.negocio.dias_sin_actividad + ' días' : '∞'}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-green-100">
                        <p className="text-gray-500 text-xs">Transacciones Hoy</p>
                        <p className="font-semibold text-gray-800">{saludNegocio.transacciones_hoy}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-green-100">
                        <p className="text-gray-500 text-xs">Usuarios Activos Hoy</p>
                        <p className="font-semibold text-gray-800">{saludNegocio.usuarios_activos_hoy}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-red-100">
                        <p className="text-gray-500 text-xs">Errores (24h)</p>
                        <p className="font-semibold text-red-600">{saludNegocio.negocio.errores_24h}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-blue-100">
                        <p className="text-gray-500 text-xs">Almacenamiento</p>
                        <p className="font-semibold text-gray-800">{saludNegocio.almacenamiento?.total_size || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {saludNegocio.negocio.errores_24h > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="font-semibold text-red-700 text-sm mb-2">⚠️ Errores Detectados</p>
                      <p className="text-sm text-red-600">Se han registrado {saludNegocio.negocio.errores_24h} errores en las últimas 24 horas. Revisa los logs.</p>
                    </div>
                  )}

                  {saludNegocio.negocio.dias_sin_actividad > 7 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="font-semibold text-yellow-700 text-sm mb-2">💾 Sin Actividad</p>
                      <p className="text-sm text-yellow-600">Este negocio lleva {saludNegocio.negocio.dias_sin_actividad} días sin actividad. Posible abandono o error técnico.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">Error al cargar datos</div>
              )}
            </div>

            <div className="p-5 border-t bg-gray-50">
              <button onClick={() => cerrarSubModal(setMostrarModalSalud)}
                className="w-full py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gestionar Tickets */}
      {mostrarModalGestionTickets && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b bg-indigo-50">
              <h3 className="text-lg font-bold text-gray-800">🎫 Gestionar Tickets - {mostrarModalGestionTickets?.nombre}</h3>
              <button onClick={() => cerrarSubModal(setMostrarModalGestionTickets)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {tickets.filter(t => t.negocio_id === mostrarModalGestionTickets.id).length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🎫</div>
                  <h4 className="text-lg font-medium text-gray-800 mb-2">No hay tickets para este negocio</h4>
                  <p className="text-gray-500">Los clientes pueden crear tickets desde su panel de soporte.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.filter(t => t.negocio_id === mostrarModalGestionTickets.id).map(ticket => (
                    <div key={ticket.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">
                              {ticket.categoria === 'bug' ? '🐛' :
                               ticket.categoria === 'pregunta' ? '❓' :
                               ticket.categoria === 'lentitud' ? '⏱️' :
                               ticket.categoria === 'acceso' ? '🔐' : '❓'}
                            </span>
                            <h4 className="font-medium text-gray-800">{ticket.titulo}</h4>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              ticket.estado === 'abierto' ? 'bg-red-100 text-red-700' :
                              ticket.estado === 'en_progreso' ? 'bg-yellow-100 text-yellow-700' :
                              ticket.estado === 'resuelto' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {ticket.estado.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mb-2">{ticket.descripcion}</p>
                          <div className="text-xs text-gray-500">
                            Por: {ticket.usuario_nombre} • {new Date(ticket.fecha_creacion).toLocaleDateString('es-AR')}
                          </div>
                        </div>
                      </div>

                      {ticket.respuesta && (
                        <div className="mt-3 p-3 bg-green-50 border-l-4 border-green-500 rounded">
                          <p className="text-sm text-green-800">
                            <strong>Tu respuesta:</strong> {ticket.respuesta}
                          </p>
                        </div>
                      )}

                      {ticket.estado !== 'resuelto' && ticket.estado !== 'cerrado' && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            responderTicket(ticket.id, respuestaTicket);
                          }} className="space-y-3">
                            <textarea
                              value={respuestaTicket}
                              onChange={(e) => setRespuestaTicket(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              rows="3"
                              placeholder="Escribe tu respuesta al ticket..."
                              required
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await api.put(`/api/superadmin/tickets/${ticket.id}`, { estado: 'en_progreso' });
                                    cargarTickets();
                                  } catch (err) {
                                    setError('Error al cambiar estado');
                                  }
                                }}
                                className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded text-sm font-medium transition-colors"
                              >
                                En Progreso
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
                              >
                                Responder y Resolver
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => cerrarSubModal(setMostrarModalGestionTickets)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle del Negocio - NUEVO DISEÑO */}
      {mostrarModalDetalleNegocio && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            {/* Header del Modal */}
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
              
              {/* Estado Badge */}
              <div className="mt-4 flex items-center gap-3">
                <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                  mostrarModalDetalleNegocio.estado === 'activo' ? 'bg-green-500 text-white' :
                  mostrarModalDetalleNegocio.estado === 'bloqueado' ? 'bg-red-500 text-white' :
                  'bg-yellow-500 text-white'
                }`}>
                  {mostrarModalDetalleNegocio.estado === 'activo' ? '✅ Activo' : 
                   mostrarModalDetalleNegocio.estado === 'bloqueado' ? '🚫 Bloqueado' : '⏳ Vencido'}
                </span>
                <span className="text-white/70 text-sm">
                  📅 Vence: {fmtFecha(mostrarModalDetalleNegocio.fecha_vencimiento)} 
                  ({diasRestantes(mostrarModalDetalleNegocio.fecha_vencimiento)} días)
                </span>
              </div>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Estadísticas Principales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{mostrarModalDetalleNegocio.total_ventas}</p>
                  <p className="text-xs text-blue-600/70 mt-1">Ventas Totales</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{fmt(mostrarModalDetalleNegocio.total_facturado)}</p>
                  <p className="text-xs text-green-600/70 mt-1">Facturación</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-purple-600">{mostrarModalDetalleNegocio.total_usuarios}</p>
                  <p className="text-xs text-purple-600/70 mt-1">Usuarios</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-orange-600">{mostrarModalDetalleNegocio.total_productos}</p>
                  <p className="text-xs text-orange-600/70 mt-1">Productos</p>
                </div>
              </div>

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
                    <p className="text-gray-500">Plan</p>
                    <p className="font-medium text-gray-800 capitalize">{mostrarModalDetalleNegocio.plan || 'Mensual'}</p>
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
                <button onClick={() => abrirSubModal(() => cargarAdminNegocio(negocioDetalleGuardado || mostrarModalDetalleNegocio))}
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
                <button onClick={() => abrirSubModal(() => {
                  setMostrarModalRenovar(negocioDetalleGuardado || mostrarModalDetalleNegocio);
                  setFormRenovar({ dias: '30', monto: '', metodo_pago: 'manual', observaciones: '' });
                })}
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
                <button onClick={() => abrirSubModal(() => {
                  setMostrarModalDias(negocioDetalleGuardado || mostrarModalDetalleNegocio);
                  setFormDias({ dias: (negocioDetalleGuardado || mostrarModalDetalleNegocio).dias_uso?.toString() || '30' });
                })}
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
                <button onClick={() => abrirSubModal(() => {
                  const neg = negocioDetalleGuardado || mostrarModalDetalleNegocio;
                  setMostrarModalHistorial(neg);
                  cargarHistorialPagos(neg.id);
                })}
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
               <button onClick={() => abrirSubModal(() => {
                  const neg = negocioDetalleGuardado || mostrarModalDetalleNegocio;
                  setMostrarModalSalud(neg);
                  cargarSaludNegocio(neg.id);
                })}
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
                <button onClick={() => abrirSubModal(() => {
                  const neg = negocioDetalleGuardado || mostrarModalDetalleNegocio;
                  setMostrarModalGestionTickets(neg);
                  cargarTickets();
                })}
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
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50">
              <button onClick={() => setMostrarModalDetalleNegocio(null)}
                className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

   {/* Modal: Mi Cuenta (superadmin) */}
      {mostrarModalMiCuenta && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold text-gray-800">👑 Mi Cuenta</h3>
              <button onClick={() => setMostrarModalMiCuenta(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={guardarMiCuenta} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={formMiCuenta.nombre}
                  onChange={e => setFormMiCuenta(p => ({ ...p, nombre: e.target.value }))}
                  required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={formMiCuenta.email}
                  onChange={e => setFormMiCuenta(p => ({ ...p, email: e.target.value }))}
                  required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span></label>
                <input type="password" value={formMiCuenta.password}
                  onChange={e => setFormMiCuenta(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              {formMiCuenta.password && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nueva contraseña *</label>
                  <input type="password" value={formMiCuenta.confirmarPassword}
                    onChange={e => setFormMiCuenta(p => ({ ...p, confirmarPassword: e.target.value }))}
                    placeholder="••••••••"
                    className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      formMiCuenta.confirmarPassword && formMiCuenta.password !== formMiCuenta.confirmarPassword
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-300'
                    }`} />
                  {formMiCuenta.confirmarPassword && formMiCuenta.password !== formMiCuenta.confirmarPassword && (
                    <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMostrarModalMiCuenta(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={guardandoCuenta}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold disabled:opacity-50">
                  {guardandoCuenta ? 'Guardando...' : '💾 Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Admin del Negocio */}
      {mostrarModalAdminNegocio && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">👤 Editar Administrador</h3>
                <p className="text-sm text-gray-500">{mostrarModalAdminNegocio.nombre}</p>
              </div>
              <button onClick={() => cerrarSubModal(setMostrarModalAdminNegocio)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={guardarAdminNegocio} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={formAdminNegocio.nombre}
                  onChange={e => setFormAdminNegocio(p => ({ ...p, nombre: e.target.value }))}
                  required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={formAdminNegocio.email}
                  onChange={e => setFormAdminNegocio(p => ({ ...p, email: e.target.value }))}
                  required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span></label>
                <input type="password" value={formAdminNegocio.password}
                  onChange={e => setFormAdminNegocio(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">⚠️ Estás modificando las credenciales del administrador de <strong>{mostrarModalAdminNegocio.nombre}</strong>. Avisale el cambio si es necesario.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => cerrarSubModal(setMostrarModalAdminNegocio)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold">
                  💾 Guardar Cambios
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