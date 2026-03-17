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
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');

  const [formNuevo, setFormNuevo] = useState({
    nombre: '', email: '', telefono: '', direccion: '',
    plan: 'mensual', dias_uso: '30', password_admin: ''
  });

  useEffect(() => {
    cargarDatos();
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

  const renovar = async (id, dias) => {
    try {
      await api.post(`/api/superadmin/negocios/${id}/renovar`, { dias });
      cargarDatos();
      setExito(`Suscripción renovada por ${dias} días`);
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError('Error al renovar');
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
            <h1 className="font-bold text-lg">Centro de Control</h1>
            <p className="text-gray-400 text-xs">SuperAdmin — {usuario?.nombre}</p>
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
                          {/* Renovar */}
                          <button onClick={() => renovar(negocio.id, 30)}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded text-xs transition-colors">
                            +30 días
                          </button>
                          {/* Bloquear/Activar */}
                          {negocio.estado === 'activo' ? (
                            <button onClick={() => cambiarEstado(negocio.id, 'bloqueado')}
                              className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs transition-colors">
                              Bloquear
                            </button>
                          ) : (
                            <button onClick={() => cambiarEstado(negocio.id, 'activo')}
                              className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-xs transition-colors">
                              Activar
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
            <div className="flex items-center justify-between p-5 border-b">
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

    </div>
  );
}

export default Superadmin;