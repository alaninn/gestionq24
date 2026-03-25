// =============================================
// ARCHIVO: src/pages/Login.jsx
// FUNCIÓN: Pantalla de inicio de sesión
// =============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTema } from '../context/TemaContext';

function Login() {
 const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { login } = useAuth();
  const { cargarTema } = useTema();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const usuario = await login(username, password);
      await cargarTema();

  
// Redirigimos según rol y permisos reales
      if (usuario.rol === 'superadmin') {
        navigate('/superadmin');
      } else {
        // Verificar si tiene permisos para el panel admin
        const permisos = typeof usuario.permisos === 'string'
          ? JSON.parse(usuario.permisos || '{}')
          : (usuario.permisos || {});
        const tienePermisoAdmin = ['admin'].includes(usuario.rol) ||
          Object.values(permisos).some(lista => Array.isArray(lista) && lista.length > 0);
        navigate(tienePermisoAdmin ? '/admin' : '/pos');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo / Título */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🏪</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Sistema de Gestión</h1>
          <p className="text-gray-400 mt-2">Ingresá con tu cuenta</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
                placeholder="Ej: cajerojuan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-bold text-lg transition-colors"
            >
              {cargando ? 'Ingresando...' : 'Ingresar'}
            </button>

          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Sistema de gestión de inventario
        </p>
      </div>
    </div>
  );
}

export default Login;