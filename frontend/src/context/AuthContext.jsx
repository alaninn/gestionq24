import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    verificarSesion();
  }, []);

  const verificarSesion = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setCargando(false);
        return;
      }
      const res = await api.get('/api/auth/me');
      setUsuario(res.data);
    } catch (err) {
      console.error('Error verificando sesión:', err);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
      }
    } finally {
      setCargando(false);
    }
  };

const login = async (username, password) => {
    // Limpiar caché del negocio anterior antes de loguear
    localStorage.removeItem('config_negocio');
    //localStorage.removeItem('color_primario');

    const res = await api.post('/api/auth/login', { username, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('usuario', JSON.stringify(res.data.usuario));
   setUsuario(res.data.usuario);
    return res.data.usuario;
  };

  // Refresca los datos del usuario desde la BD (útil para permisos actualizados)
  const refrescarUsuario = async () => {
    try {
      const res = await api.get('/api/auth/me');
      setUsuario(res.data);
      localStorage.setItem('usuario', JSON.stringify(res.data));
    } catch (err) {
      console.error('Error refrescando usuario:', err);
    }
  };

const logout = () => {
    // Al desloguear limpiamos TODO el caché del negocio
    // No guardamos el color porque el próximo usuario puede ser de otro negocio
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('config_negocio');
    localStorage.removeItem('pos_pestanas');
    localStorage.removeItem('pos_pestana_activa');
    localStorage.removeItem('pos_contador_ventas');

    setUsuario(null);
    window.location.href = '/login';
  };

  const tienePermiso = (modulo, accion) => {
    if (!usuario) return false;
    if (usuario.rol === 'superadmin' || usuario.rol === 'admin') return true;
    const permisos = typeof usuario.permisos === 'string'
      ? JSON.parse(usuario.permisos)
      : (usuario.permisos || {});
    return permisos[modulo]?.includes(accion) || false;
  };

return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout, tienePermiso, refrescarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}