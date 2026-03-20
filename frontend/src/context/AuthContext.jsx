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

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('usuario', JSON.stringify(res.data.usuario));
    setUsuario(res.data.usuario);
    return res.data.usuario;
  };

  const logout = () => {
    // Guardamos el color antes de limpiar localStorage
    const colorGuardado = localStorage.getItem('color_primario');
    
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('pos_pestanas');
    localStorage.removeItem('pos_pestana_activa');
    localStorage.removeItem('pos_contador_ventas');
    
    // Restauramos el color después de limpiar
    if (colorGuardado) {
      localStorage.setItem('color_primario', colorGuardado);
    }
    
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
    <AuthContext.Provider value={{ usuario, cargando, login, logout, tienePermiso }}>
      {children}
    </AuthContext.Provider>
  );
}