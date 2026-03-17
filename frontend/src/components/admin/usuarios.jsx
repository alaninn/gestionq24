// =============================================
// ARCHIVO: src/components/admin/Usuarios.jsx
// =============================================

import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const ROLES = [
  { id: 'admin', label: 'Admin', desc: 'Acceso total al negocio', color: 'bg-purple-100 text-purple-700' },
  { id: 'encargado', label: 'Encargado', desc: 'Gestión de ventas, productos y reportes', color: 'bg-blue-100 text-blue-700' },
  { id: 'cajero', label: 'Cajero', desc: 'Solo puede realizar ventas', color: 'bg-green-100 text-green-700' },
];

const PERMISOS_DISPONIBLES = [
  { modulo: 'productos', accion: 'ver', label: '👀 Ver productos' },
  { modulo: 'productos', accion: 'crear', label: '➕ Crear productos' },
  { modulo: 'productos', accion: 'editar', label: '✏️ Editar productos' },
  { modulo: 'productos', accion: 'eliminar', label: '🗑️ Eliminar productos' },
  { modulo: 'ventas', accion: 'ver', label: '👀 Ver ventas' },
  { modulo: 'ventas', accion: 'crear', label: '🛒 Crear ventas' },
  { modulo: 'ventas', accion: 'anular', label: '❌ Anular ventas' },
  { modulo: 'gastos', accion: 'ver', label: '👀 Ver gastos' },
  { modulo: 'gastos', accion: 'crear', label: '➕ Crear gastos' },
  { modulo: 'gastos', accion: 'eliminar', label: '🗑️ Eliminar gastos' },
  { modulo: 'reportes', accion: 'ver', label: '📊 Ver reportes' },
  { modulo: 'clientes', accion: 'ver', label: '👀 Ver clientes' },
  { modulo: 'clientes', accion: 'crear', label: '➕ Crear clientes' },
  { modulo: 'caja', accion: 'abrir', label: '🔓 Abrir caja' },
  { modulo: 'caja', accion: 'cerrar', label: '🔒 Cerrar caja' },
];

const PERMISOS_DEFAULT = {
  admin: {
    productos: ['ver', 'crear', 'editar', 'eliminar'],
    ventas: ['ver', 'crear', 'anular'],
    gastos: ['ver', 'crear', 'eliminar'],
    reportes: ['ver'],
    clientes: ['ver', 'crear'],
    caja: ['abrir', 'cerrar'],
  },
  encargado: {
    productos: ['ver', 'crear', 'editar'],
    ventas: ['ver', 'crear'],
    gastos: ['ver', 'crear'],
    reportes: ['ver'],
    clientes: ['ver', 'crear'],
    caja: ['abrir', 'cerrar'],
  },
  cajero: {
    ventas: ['crear'],
    gastos: ['crear'],
    clientes: ['ver'],
    caja: ['abrir', 'cerrar'],
  },
};

function Usuarios() {
  const { usuario: usuarioActual } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    nombre: '', email: '', password: '', rol: 'cajero',
    activo: true, permisos: PERMISOS_DEFAULT.cajero,
  });

  useEffect(() => { cargarUsuarios(); }, []);

  const cargarUsuarios = async () => {
    try {
      setCargando(true);
      const res = await api.get('/api/usuarios');
      setUsuarios(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  const abrirNuevo = () => {
    setForm({ nombre: '', email: '', password: '', rol: 'cajero', activo: true, permisos: PERMISOS_DEFAULT.cajero });
    setUsuarioEditando(null);
    setError('');
    setMostrarModal(true);
  };

  const abrirEditar = (usuario) => {
    setForm({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      rol: usuario.rol,
      activo: usuario.activo,
      permisos: usuario.permisos || PERMISOS_DEFAULT[usuario.rol] || {},
    });
    setUsuarioEditando(usuario.id);
    setError('');
    setMostrarModal(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const datos = { ...form };
      if (!datos.password) delete datos.password;

      if (usuarioEditando) {
        await api.put(`/api/usuarios/${usuarioEditando}`, datos);
        setExito('Usuario actualizado correctamente');
      } else {
        await api.post('/api/usuarios', datos);
        setExito('Usuario creado correctamente');
      }
      setMostrarModal(false);
      cargarUsuarios();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar usuario');
    }
  };

  const desactivar = async (id, nombre) => {
    if (!window.confirm(`¿Desactivar al usuario "${nombre}"?`)) return;
    try {
      await api.delete(`/api/usuarios/${id}`);
      setExito('Usuario desactivado');
      cargarUsuarios();
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al desactivar usuario');
    }
  };

  const togglePermiso = (modulo, accion) => {
    setForm(prev => {
      const permisos = { ...prev.permisos };
      if (!permisos[modulo]) permisos[modulo] = [];
      if (permisos[modulo].includes(accion)) {
        permisos[modulo] = permisos[modulo].filter(a => a !== accion);
      } else {
        permisos[modulo] = [...permisos[modulo], accion];
      }
      return { ...prev, permisos };
    });
  };

  const tienePermiso = (modulo, accion) => {
    return form.permisos[modulo]?.includes(accion) || false;
  };

  const cambiarRol = (rol) => {
    setForm(prev => ({ ...prev, rol, permisos: PERMISOS_DEFAULT[rol] || {} }));
  };

  const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }) : 'Nunca';

  return (
    <div className="space-y-4">

      {/* Título */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h2>
          <p className="text-gray-500">Administrá los accesos de tu equipo</p>
        </div>
        <button onClick={abrirNuevo}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          + Nuevo Usuario
        </button>
      </div>

      {exito && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">✅ {exito}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">❌ {error}</div>}

      {/* Tarjetas de roles */}
      <div className="grid grid-cols-3 gap-4">
        {ROLES.map(rol => {
          const cant = usuarios.filter(u => u.rol === rol.id).length;
          return (
            <div key={rol.id} className="bg-white rounded-xl p-4 shadow border-l-4 border-gray-200">
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${rol.color}`}>{rol.label}</span>
                <span className="text-2xl font-bold text-gray-700">{cant}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">{rol.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Usuario</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium text-sm">Email</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Rol</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Estado</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Último acceso</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium text-sm">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr><td colSpan="6" className="text-center py-8 text-gray-400">Cargando...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-8 text-gray-400">No hay usuarios</td></tr>
            ) : (
              usuarios.map(u => {
                const rol = ROLES.find(r => r.id === u.rol);
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{u.nombre}</p>
                          {u.id === usuarioActual?.id && (
                            <span className="text-xs text-green-500">● Vos</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{u.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${rol?.color || 'bg-gray-100 text-gray-600'}`}>
                        {rol?.label || u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.activo ? '● Activo' : '● Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-400">
                      {fmtFecha(u.ultimo_acceso)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => abrirEditar(u)}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-sm transition-colors">
                          Editar
                        </button>
                        {u.id !== usuarioActual?.id && (
                          <button onClick={() => desactivar(u.id, u.nombre)}
                            className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-sm transition-colors">
                            Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-gray-800">
                {usuarioEditando ? '✏️ Editar Usuario' : '👤 Nuevo Usuario'}
              </h3>
              <button onClick={() => setMostrarModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <form onSubmit={guardar} className="p-5 space-y-4">
              {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">❌ {error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input type="text" value={form.nombre}
                    onChange={(e) => setForm(p => ({ ...p, nombre: e.target.value }))}
                    required autoFocus
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="usuario@email.com" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña {usuarioEditando ? '(dejar vacío para no cambiar)' : '*'}
                </label>
                <input type="password" value={form.password}
                  onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                  required={!usuarioEditando}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="••••••••" />
              </div>

              {/* Rol */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rol</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map(rol => (
                    <button key={rol.id} type="button"
                      onClick={() => cambiarRol(rol.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        form.rol === rol.id
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <p className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-1 ${rol.color}`}>
                        {rol.label}
                      </p>
                      <p className="text-xs text-gray-400">{rol.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Permisos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Permisos</label>
                  <span className="text-xs text-gray-400">Personalizá el acceso del usuario</span>
                </div>
                <div className="border border-gray-200 rounded-xl p-3 max-h-52 overflow-y-auto bg-gray-50">
                  <div className="grid grid-cols-2 gap-2">
                    {PERMISOS_DISPONIBLES.map(p => (
                      <label key={`${p.modulo}_${p.accion}`}
                        className="flex items-center gap-2 cursor-pointer hover:bg-white rounded-lg p-1.5 transition-colors">
                        <input type="checkbox"
                          checked={tienePermiso(p.modulo, p.accion)}
                          onChange={() => togglePermiso(p.modulo, p.accion)}
                          className="w-4 h-4 text-green-600 rounded" />
                        <span className="text-xs text-gray-600">{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Estado — solo al editar */}
              {usuarioEditando && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">Usuario activo</span>
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, activo: !p.activo }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.activo ? 'bg-green-600' : 'bg-gray-200'
                    }`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.activo ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMostrarModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors">
                  {usuarioEditando ? '💾 Guardar Cambios' : '✅ Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Usuarios;