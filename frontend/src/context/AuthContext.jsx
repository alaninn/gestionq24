  import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { MODULOS_NUCLEO } from '../constants/modulos';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [planInfo, setPlanInfo] = useState(() => {
    // Restaurar del caché: así, en una recarga, las funciones por plan (Tienda
    // Online, etc.) están al instante y no aparecen un segundo deshabilitadas.
    try { const c = localStorage.getItem('plan_info'); return c ? JSON.parse(c) : null; } catch { return null; }
  });
  const [cargando, setCargando] = useState(true);
  // Negocio "fijado" en esta PC (Paso 1: Acceso del negocio). Mientras exista,
  // el login de usuarios queda atado a este negocio.
  const [negocioFijado, setNegocioFijado] = useState(() => {
    try {
      const raw = localStorage.getItem('device_negocio');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  useEffect(() => {
    verificarSesion();
  }, []);

  // Mantener el caché del plan al día (para la restauración inmediata en recargas).
  useEffect(() => {
    try {
      if (planInfo) localStorage.setItem('plan_info', JSON.stringify(planInfo));
    } catch { /* storage lleno o bloqueado: se ignora */ }
  }, [planInfo]);

  const verificarSesion = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setCargando(false);
        return;
      }
      const res = await api.get('/api/auth/me');
      
      // Verificar plan solo para usuarios de negocio (no superadmin)
      // El backend (/api/auth/me) ya bloquea negocios bloqueados/vencidos con 403.
      if (res.data.rol !== 'superadmin') {
        const validPlans = ['estandar', 'premium'];
        if (!validPlans.includes(res.data.plan)) {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          setCargando(false);
          return;
        }
      }

      setUsuario(res.data);
      // Mantener el caché del usuario fresco (se usa para restaurar la sesión offline)
      localStorage.setItem('usuario', JSON.stringify(res.data));

      // Cargar informacion del plan para usuarios de negocio, y tambien cuando el
      // superadmin esta operando un negocio (impersonando): asi las funciones por
      // plan (ej. multinegocio) se ven segun ese negocio y no quedan ocultas.
      const impersonando = !!localStorage.getItem('acceso_superadmin_negocio');
      if (res.data.rol !== 'superadmin' || impersonando) {
        try {
          const planRes = await api.get('/api/usuarios/plan-info');
          setPlanInfo(planRes.data);
        } catch (planErr) {
          console.error('Error cargando informacion del plan:', planErr);
        }
      }

    } catch (err) {
      // 401 = token vencido/ inválido → cerrar sesión.
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
      } else if (!err.response) {
        // Sin respuesta = error de RED (offline). No deslogueamos: restauramos la
        // sesión desde el caché para que una recarga sin internet mantenga la caja
        // abierta. Al volver internet, el próximo request revalida el token.
        try {
          const cache = localStorage.getItem('usuario');
          if (cache) setUsuario(JSON.parse(cache));
        } catch { /* caché inválido: queda como estaba */ }
      } else {
        console.error('Error verificando sesión:', err);
      }
    } finally {
      setCargando(false);
    }
  };

const login = async (username, password) => {
    // Limpiar caché del negocio anterior antes de loguear
    localStorage.removeItem('config_negocio');
    //localStorage.removeItem('color_primario');

    // El header x-device-token (si el equipo está fijado a un negocio) lo agrega
    // el interceptor de axios, así el backend scopea el login a ese negocio.
    const res = await api.post('/api/auth/login', { username, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('usuario', JSON.stringify(res.data.usuario));
    setUsuario(res.data.usuario);

    // Cargar la info del plan ANTES de devolver, así las funciones por plan
    // (Tienda Online, Predicción, Multinegocio, etc.) quedan disponibles apenas
    // entra, sin tener que refrescar la página. Si falla, no bloquea el login.
    const impersonando = !!localStorage.getItem('acceso_superadmin_negocio');
    if (res.data.usuario.rol !== 'superadmin' || impersonando) {
      try {
        const planRes = await api.get('/api/usuarios/plan-info');
        setPlanInfo(planRes.data);
      } catch (planErr) {
        console.error('Error cargando información del plan tras login:', planErr);
      }
    }
    return res.data.usuario;
  };

  // Paso 1: el dueño/admin fija el negocio en esta PC con su mail + contraseña.
  const accederNegocio = async (email, password) => {
    // Si el equipo entró por un enlace de marca blanca (/r/<slug>), scopeamos el
    // acceso a los negocios de ese revendedor. Sin slug, comportamiento actual.
    const slug = localStorage.getItem('revendedor_slug') || undefined;
    const res = await api.post('/api/auth/acceso-negocio', { email, password, slug });
    localStorage.setItem('device_token', res.data.deviceToken);
    localStorage.setItem('device_negocio', JSON.stringify(res.data.negocio));
    setNegocioFijado(res.data.negocio);
    return res.data.negocio;
  };

  // Salir del negocio: desvincula esta PC (vuelve al Paso 1). Borra también la sesión.
  const salirNegocio = () => {
    localStorage.removeItem('device_token');
    localStorage.removeItem('device_negocio');
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('config_negocio');
    localStorage.removeItem('plan_info');
    localStorage.removeItem('pos_turno');
    setNegocioFijado(null);
    setUsuario(null);
    window.location.href = '/login';
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
    localStorage.removeItem('plan_info');
    localStorage.removeItem('pos_pestanas');
    localStorage.removeItem('pos_pestana_activa');
    localStorage.removeItem('pos_contador_ventas');
    localStorage.removeItem('pos_turno');

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

  const esPremium = () => {
    if (!usuario) return false;
    if (usuario.rol === 'superadmin') return true;
    return usuario.plan === 'premium';
  };

  const puedeUsarFuncion = (funcion) => {
    if (!usuario || !planInfo) return false;
    if (usuario.rol === 'superadmin') return true;
    return planInfo.caracteristicas[funcion] === true;
  };

  // ¿El plan del negocio habilita este módulo del menú admin?
  // El superadmin ve todo. Los módulos núcleo (dashboard/config/usuarios) siempre.
  // Si el plan no tiene lista de módulos configurada (null) = todos habilitados.
  const moduloPermitidoPlan = (modulo) => {
    if (!usuario) return false;
    if (usuario.rol === 'superadmin') return true;
    if (MODULOS_NUCLEO.includes(modulo)) return true;
    const permitidos = planInfo?.caracteristicas?.modulos;
    if (!Array.isArray(permitidos)) return true;
    return permitidos.includes(modulo);
  };

 return (
     <AuthContext.Provider value={{
      usuario,
      cargando,
      login,
      logout,
      tienePermiso,
      refrescarUsuario,
      planInfo,
      esPremium,
      puedeUsarFuncion,
      moduloPermitidoPlan,
      negocioFijado,
      accederNegocio,
      salirNegocio
    }}>
       {children}
     </AuthContext.Provider>
   );
}