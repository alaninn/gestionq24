import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';

const ConectividadContext = createContext(null);
export const useConectividad = () => useContext(ConectividadContext);

const CLAVE_CATALOGO = 'catalogo_offline';
const CLAVE_CATALOGO_FECHA = 'catalogo_offline_fecha';
const CLAVE_FALLIDAS = 'ventas_offline_fallidas';

// Cada cuánto se chequea la conexión (ping a /api/health) estando OK.
const INTERVALO_OK_MS = 15000;
// Escalera de reintento cuando la conexión está caída.
const BACKOFF_MS = [5000, 10000, 20000, 30000];
const PING_TIMEOUT_MS = 3000;
// El catálogo offline se refresca si tiene más de estas horas.
const CATALOGO_TTL_HORAS = 4;
// Reintentos máximos de una venta encolada antes de moverla a "fallidas".
const MAX_INTENTOS_VENTA = 5;

function catalogoVencido(fechaISO) {
  if (!fechaISO) return true;
  const guardada = new Date(fechaISO);
  if (isNaN(guardada.getTime())) return true;
  return (Date.now() - guardada.getTime()) > CATALOGO_TTL_HORAS * 3600 * 1000;
}

function nuevoOfflineId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `off_${crypto.randomUUID()}`;
  } catch { /* noop */ }
  return `off_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function ConectividadProvider({ children }) {
  // online = "el backend está realmente alcanzable". No alcanza navigator.onLine:
  // un corte de WAN con la LAN viva lo deja en true.
  const [online, setOnline] = useState(navigator.onLine);
  const [verificandoConexion, setVerificandoConexion] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [pendientes, setPendientes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ventas_offline') || '[]'); }
    catch { return []; }
  });
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState(null);
  const [errorSync, setErrorSync] = useState(null);

  const sincronizandoRef = useRef(false);
  const onlineRef = useRef(online);
  const pendientesRef = useRef(pendientes);
  const timerRef = useRef(null);
  const fallosSeguidosRef = useRef(0);

  useEffect(() => { onlineRef.current = online; }, [online]);
  useEffect(() => { pendientesRef.current = pendientes; }, [pendientes]);

  // Guardar pendientes en localStorage cada vez que cambian
  useEffect(() => {
    localStorage.setItem('ventas_offline', JSON.stringify(pendientes));
  }, [pendientes]);

  // ============================================================
  // DETECCIÓN REAL DE CONEXIÓN (ping a /api/health con backoff)
  // ============================================================
  const pingSalud = useCallback(async () => {
    // Si el navegador dice que no hay red, es seguro: estamos offline.
    if (!navigator.onLine) return false;
    try {
      const r = await api.get('/api/health', { timeout: PING_TIMEOUT_MS });
      return r?.data?.ok === true || r?.status === 200;
    } catch {
      return false;
    }
  }, []);

  const aplicarEstado = useCallback((ok) => {
    const prev = onlineRef.current;
    if (prev !== ok) {
      onlineRef.current = ok;
      setOnline(ok);
      if (ok) {
        // Volvió la conexión: refrescar catálogo y drenar la cola.
        fallosSeguidosRef.current = 0;
        cachearCatalogo(true);
        setTimeout(() => sincronizarPendientes(), 500);
      }
    }
    return ok;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const revalidarConexion = useCallback(async () => {
    setVerificandoConexion(true);
    const ok = await pingSalud();
    setVerificandoConexion(false);
    return aplicarEstado(ok);
  }, [pingSalud, aplicarEstado]);

  // Loop de chequeo con intervalo adaptativo.
  useEffect(() => {
    let cancelado = false;

    const agendar = (ms) => {
      if (cancelado) return;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(tick, ms);
    };

    const tick = async () => {
      const ok = await pingSalud();
      if (cancelado) return;
      aplicarEstado(ok);
      if (ok) {
        fallosSeguidosRef.current = 0;
        agendar(INTERVALO_OK_MS);
      } else {
        const i = Math.min(fallosSeguidosRef.current, BACKOFF_MS.length - 1);
        fallosSeguidosRef.current += 1;
        agendar(BACKOFF_MS[i]);
      }
    };

    // Primer chequeo apenas monta.
    tick();

    const alVolver = () => { revalidarConexion(); };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') revalidarConexion();
    };
    window.addEventListener('online', alVolver);
    window.addEventListener('offline', () => aplicarEstado(false));
    document.addEventListener('visibilitychange', alCambiarVisibilidad);

    return () => {
      cancelado = true;
      clearTimeout(timerRef.current);
      window.removeEventListener('online', alVolver);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [pingSalud, aplicarEstado, revalidarConexion]);

  // Drenar la cola periódicamente mientras haya pendientes y conexión.
  useEffect(() => {
    const id = setInterval(() => {
      if (onlineRef.current && pendientesRef.current.length > 0) {
        sincronizarPendientes();
      }
    }, 60000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // CATÁLOGO OFFLINE
  // ============================================================
  const cachearCatalogo = async (forzar = false) => {
    // Sin sesión no se cachea (evita 401 → redirect a /login → loop).
    if (!localStorage.getItem('token')) return;
    if (!navigator.onLine) return;
    try {
      const tieneCache = !!localStorage.getItem(CLAVE_CATALOGO);
      const fecha = localStorage.getItem(CLAVE_CATALOGO_FECHA);
      if (!forzar && tieneCache && !catalogoVencido(fecha)) return;
      const res = await api.get('/api/productos/catalogo', { timeout: 8000 });
      localStorage.setItem(CLAVE_CATALOGO, JSON.stringify(res.data?.productos || []));
      localStorage.setItem(CLAVE_CATALOGO_FECHA, new Date().toISOString());
    } catch {
      /* si falla, se sigue usando lo último cacheado */
    }
  };

  const leerCatalogo = () => {
    try { return JSON.parse(localStorage.getItem(CLAVE_CATALOGO) || '[]'); } catch { return []; }
  };

  const buscarEnCatalogo = (termino) => {
    const t = (termino || '').trim().toLowerCase();
    if (!t) return [];
    const palabras = t.split(/\s+/).filter(Boolean);
    return leerCatalogo().filter(p => {
      const texto = `${p.nombre || ''} ${p.codigo || ''} ${(p.codigos || []).join(' ')}`.toLowerCase();
      return palabras.every(w => texto.includes(w));
    }).slice(0, 50);
  };

  const buscarCodigoEnCatalogo = (codigo) => {
    const c = (codigo || '').trim();
    if (!c) return null;
    return leerCatalogo().find(p => p.codigo === c || (p.codigos || []).includes(c)) || null;
  };

  useEffect(() => { cachearCatalogo(); }, []);

  // ============================================================
  // COLA DE VENTAS OFFLINE
  // ============================================================
  const agregarVentaOffline = (venta) => {
    const ventaConId = {
      ...venta,
      _offline_id: nuevoOfflineId(),
      _timestamp: new Date().toISOString(),
      _intentos: 0,
    };
    setPendientes(prev => [...prev, ventaConId]);
    return ventaConId._offline_id;
  };

  const sincronizarPendientes = async () => {
    if (sincronizandoRef.current) return;

    const pendientesActuales = JSON.parse(localStorage.getItem('ventas_offline') || '[]');
    if (pendientesActuales.length === 0) return;

    sincronizandoRef.current = true;
    setSincronizando(true);
    setErrorSync(null);

    const fallidos = [];
    const descartadas = [];
    let facturasFallidas = 0;

    for (const venta of pendientesActuales) {
      try {
        const { _offline_id, _timestamp, _intentos, facturacion, ...ventaLimpia } = venta;
        const resVenta = await api.post('/api/ventas', { ...ventaLimpia, offline_uuid: _offline_id });
        const ventaId = resVenta.data?.id;

        if (ventaId && facturacion) {
          try {
            await api.post('/api/arca/emitir', { ...facturacion, venta_id: ventaId }, { timeout: 90000 });
          } catch {
            facturasFallidas++; // la venta quedó registrada; la factura se reintenta a mano
          }
        }
      } catch (err) {
        if (err.response?.status === 400) {
          console.warn('Venta offline descartada:', err.response?.data?.error);
          descartadas.push({ ...venta, _error: err.response?.data?.error || 'inválida' });
        } else {
          const intentos = (venta._intentos || 0) + 1;
          if (intentos >= MAX_INTENTOS_VENTA) {
            descartadas.push({ ...venta, _intentos: intentos, _error: 'no se pudo sincronizar tras varios intentos' });
          } else {
            fallidos.push({ ...venta, _intentos: intentos });
          }
        }
      }
    }

    setPendientes(fallidos);
    setUltimaSincronizacion(new Date());

    if (descartadas.length > 0) {
      try {
        const previas = JSON.parse(localStorage.getItem(CLAVE_FALLIDAS) || '[]');
        localStorage.setItem(CLAVE_FALLIDAS, JSON.stringify([...previas, ...descartadas]));
      } catch { /* noop */ }
    }

    const partes = [];
    if (facturasFallidas > 0) partes.push(`${facturasFallidas} factura(s) no se pudieron emitir`);
    if (descartadas.length > 0) partes.push(`${descartadas.length} venta(s) no se pudieron sincronizar (quedaron guardadas para revisar)`);
    setErrorSync(partes.length ? partes.join('. ') + '.' : null);

    setSincronizando(false);
    sincronizandoRef.current = false;

    return { fallidos: fallidos.length, descartadas: descartadas.length };
  };

  const ventasFallidas = () => {
    try { return JSON.parse(localStorage.getItem(CLAVE_FALLIDAS) || '[]'); } catch { return []; }
  };
  const limpiarVentasFallidas = () => localStorage.removeItem(CLAVE_FALLIDAS);

  return (
    <ConectividadContext.Provider value={{
      online,
      verificandoConexion,
      revalidarConexion,
      sincronizando,
      pendientes,
      ultimaSincronizacion,
      errorSync,
      agregarVentaOffline,
      sincronizarPendientes,
      cachearCatalogo,
      buscarEnCatalogo,
      buscarCodigoEnCatalogo,
      ventasFallidas,
      limpiarVentasFallidas,
    }}>
      {children}
    </ConectividadContext.Provider>
  );
}
