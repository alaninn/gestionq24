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
    plan: 'mensual', dias_uso: '30', password_admin: ''
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
    // Recargar alertas cada 30 segundos
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
      console.error('Error:', err);
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
    <div className="min-h-screen bg-gray-100">

      {/* Barra superior */}
      <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
            <span>👑</span>
          </div>
          <div>
            <h1 className="font-bold text-lg">Centro de Control SuperAdmin</h1>
            <p className="text-gray-400 text-xs">Gestión de Negocios — {usuario?.nombre}</p>
          </div>
        </div>
        <button onClick={logout}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition-colors">
          Cerrar Sesión
        </button>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Mensajes */}
        {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">✅ {exito}</div>}
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">❌ {error}</div>}

        {/* Widget Alertas */}
        {alertas.length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-xl p-5 shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">🚨</span> 
                ALERTAS ({alertas.length})
              </h3>
              <button onClick={cargarAlertas}
                className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg transition-colors">
                🔄 Actualizar
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alertas.slice(0, 10).map(alerta => (
                <div key={alerta.id} className={`p-3 rounded-lg flex items-start justify-between gap-3 ${
                  alerta.severidad === 'crítica' ? 'bg-red-100 border-l-4 border-red-500' :
                  alerta.severidad === 'alta' ? 'bg-orange-100 border-l-4 border-orange-500' :
                  'bg-yellow-100 border-l-4 border-yellow-500'
                }`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{alerta.titulo}</p>
                    <p className="text-xs text-gray-600">{alerta.negocio_nombre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{alerta.descripcion}</p>
                  </div>
                  <button onClick={() => resolverAlerta(alerta.id)}
                    className="text-xs bg-white hover:bg-gray-100 text-gray-700 px-2 py-1 rounded whitespace-nowrap transition-colors">
                    ✓ Resolver
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tarjetas de stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 shadow">
              <p className="text-gray-500 text-sm">Total Negocios</p>
              <p className="text-3xl font-bold text-gray-800">{stats.total_negocios}</p>
            </div>
            <div className="bg-green-500 text-white rounded-xl p-5 shadow">
              <p className="text-green-100 text-sm">Activos</p>
              <p className="text-3xl font-bold">{stats.negocios_activos}</p>
            </div>
            <div className="bg-red-500 text-white rounded-xl p-5 shadow">
              <p className="text-red-100 text-sm">Bloqueados</p>
              <p className="text-3xl font-bold">{stats.negocios_bloqueados}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow">
              <p className="text-gray-500 text-sm">Facturación Global</p>
              <p className="text-2xl font-bold text-green-600">{fmt(stats.total_facturado_global)}</p>
            </div>
          </div>
        )}

        {/* Lista de negocios */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">
              Negocios ({negocios.length})
            </h2>
            <button onClick={() => setMostrarModalNuevo(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
              + Nuevo Negocio
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Negocio</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Email</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Estado</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Vencimiento</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Ventas</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-medium text-sm">Facturado</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {negocios.map(negocio => {
                  const dias = diasRestantes(negocio.fecha_vencimiento);
                  return (
                    <tr key={negocio.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{negocio.nombre}</p>
                        <p className="text-xs text-gray-400">{negocio.total_usuarios} usuarios · {negocio.total_productos} productos</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{negocio.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          negocio.estado === 'activo' ? 'bg-green-100 text-green-700' :
                          negocio.estado === 'bloqueado' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {negocio.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="text-sm font-medium text-gray-700">{fmtFecha(negocio.fecha_vencimiento)}</p>
                        <p className={`text-xs ${dias <= 5 ? 'text-red-500 font-medium' : dias <= 10 ? 'text-orange-500' : 'text-gray-400'}`}>
                          {dias > 0 ? `${dias} días` : '⚠️ Vencido'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{negocio.total_ventas}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">{fmt(negocio.total_facturado)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1 flex-wrap">
                          {/* Acceder panel */}
                          <button onClick={() => accederNegocio(negocio.id)}
                            className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded text-xs font-medium transition-colors"
                            title="Acceder al panel de administración">
                            🔓 Acceder
                          </button>
                          
                          {/* Renovar */}
                          <button onClick={() => {
                            setMostrarModalRenovar(negocio);
                            setFormRenovar({ dias: '30', monto: '', metodo_pago: 'manual', observaciones: '' });
                          }}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded text-xs font-medium transition-colors"
                            title="Renovar suscripción">
                            🔄 Renovar
                          </button>

                          {/* Editar días */}
                          <button onClick={() => {
                            setMostrarModalDias(negocio);
                            setFormDias({ dias: negocio.dias_uso?.toString() || '30' });
                          }}
                            className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-1 rounded text-xs font-medium transition-colors"
                            title="Editar días de uso">
                            📅 Días
                          </button>

                          {/* Historial */}
                          <button onClick={() => {
                            setMostrarModalHistorial(negocio);
                            cargarHistorialPagos(negocio.id);
                          }}
                            className="bg-cyan-100 hover:bg-cyan-200 text-cyan-700 px-2 py-1 rounded text-xs font-medium transition-colors"
                            title="Ver historial de pagos">
                            📊 Historial
                          </button>

                          {/* Salud */}
                          <button onClick={() => {
                            setMostrarModalSalud(negocio);
                            cargarSaludNegocio(negocio.id);
                          }}
                            className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-xs font-medium transition-colors"
                            title="Ver estado de salud">
                            ❤️ Salud
                          </button>

                          {/* Tickets */}
                          <button onClick={() => {
                            setMostrarModalGestionTickets(negocio);
                            cargarTickets();
                          }}
                            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded text-xs font-medium transition-colors"
                            title="Gestionar tickets de soporte">
                            🎫 Tickets
                          </button>

                          {/* Bloquear/Activar */}
                          {negocio.estado === 'activo' ? (
                            <button onClick={() => cambiarEstado(negocio.id, 'bloqueado')}
                              className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-medium transition-colors">
                              🚫 Bloquear
                            </button>
                          ) : (
                            <button onClick={() => cambiarEstado(negocio.id, 'activo')}
                              className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-xs font-medium transition-colors">
                              ✅ Activar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top negocios */}
        {stats?.top_negocios?.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-gray-700 mb-4">🏆 Top Negocios por Facturación</h3>
            <div className="space-y-2">
              {stats.top_negocios.map((n, i) => {
                const maxFact = stats.top_negocios[0]?.total_facturado || 1;
                const pct = (n.total_facturado / maxFact) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400 w-6">#{i + 1}</span>
                    <span className="text-sm font-medium text-gray-700 w-40 truncate">{n.nombre}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div className="bg-green-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${pct}%` }}>
                        <span className="text-white text-xs font-medium">{fmt(n.total_facturado)}</span>
                      </div>
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
              <button onClick={() => setMostrarModalRenovar(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
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
                <button type="button" onClick={() => setMostrarModalRenovar(null)}
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
              <button onClick={() => setMostrarModalDias(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
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
                <button type="button" onClick={() => setMostrarModalDias(null)}
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
              <button onClick={() => setMostrarModalHistorial(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
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
              <button onClick={() => setMostrarModalHistorial(null)}
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
              <button onClick={() => setMostrarModalSalud(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
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
              <button onClick={() => setMostrarModalSalud(null)}
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
              <button onClick={() => setMostrarModalGestionTickets(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
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
                onClick={() => setMostrarModalGestionTickets(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Superadmin;