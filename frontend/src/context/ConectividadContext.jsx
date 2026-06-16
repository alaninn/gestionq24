import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api/axios';

const ConectividadContext = createContext(null);
export const useConectividad = () => useContext(ConectividadContext);

const CLAVE_CATALOGO = 'catalogo_offline';
const CLAVE_CATALOGO_FECHA = 'catalogo_offline_fecha';

// ¿La fecha guardada del catálogo es anterior a las 3 AM de hoy? → conviene recachear.
// Los productos casi no cambian, así que alcanza con cachear una vez y refrescar a diario.
function catalogoVencido(fechaISO) {
  if (!fechaISO) return true;
  const guardada = new Date(fechaISO);
  if (isNaN(guardada.getTime())) return true;
  const corte = new Date();
  corte.setHours(3, 0, 0, 0);                 // 3 AM de hoy
  if (new Date() < corte) corte.setDate(corte.getDate() - 1); // si aún no son las 3, el corte es el de ayer
  return guardada < corte;
}

export function ConectividadProvider({ children }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [sincronizando, setSincronizando] = useState(false);
  const [pendientes, setPendientes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ventas_offline') || '[]');
    } catch { return []; }
  });
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState(null);
  const [errorSync, setErrorSync] = useState(null);
  const sincronizandoRef = useRef(false);

  useEffect(() => {
    const volverOnline = () => {
      setOnline(true);
      cachearCatalogo();
      // Esperar 2 segundos para asegurarse que la conexión es estable
      setTimeout(() => sincronizarPendientes(), 2000);
    };
    const irOffline = () => setOnline(false);

    window.addEventListener('online', volverOnline);
    window.addEventListener('offline', irOffline);
    return () => {
      window.removeEventListener('online', volverOnline);
      window.removeEventListener('offline', irOffline);
    };
  }, []);

  // Guardar pendientes en localStorage cada vez que cambian
  useEffect(() => {
    localStorage.setItem('ventas_offline', JSON.stringify(pendientes));
  }, [pendientes]);

  // ============================================================
  // CATÁLOGO OFFLINE: cachear una vez y refrescar a diario (tras las 3 AM)
  // ============================================================
  const cachearCatalogo = async (forzar = false) => {
    if (!navigator.onLine) return;
    try {
      const tieneCache = !!localStorage.getItem(CLAVE_CATALOGO);
      const fecha = localStorage.getItem(CLAVE_CATALOGO_FECHA);
      if (!forzar && tieneCache && !catalogoVencido(fecha)) return; // ya está fresco
      const res = await api.get('/api/productos/catalogo');
      localStorage.setItem(CLAVE_CATALOGO, JSON.stringify(res.data?.productos || []));
      localStorage.setItem(CLAVE_CATALOGO_FECHA, new Date().toISOString());
    } catch {
      /* si falla, se sigue usando lo último cacheado */
    }
  };

  const leerCatalogo = () => {
    try { return JSON.parse(localStorage.getItem(CLAVE_CATALOGO) || '[]'); } catch { return []; }
  };

  // Búsqueda offline por nombre/código (multi-palabra, como el server)
  const buscarEnCatalogo = (termino) => {
    const t = (termino || '').trim().toLowerCase();
    if (!t) return [];
    const palabras = t.split(/\s+/).filter(Boolean);
    return leerCatalogo().filter(p => {
      const texto = `${p.nombre || ''} ${p.codigo || ''} ${(p.codigos || []).join(' ')}`.toLowerCase();
      return palabras.every(w => texto.includes(w));
    }).slice(0, 50);
  };

  // Escaneo offline: match exacto por código de barra
  const buscarCodigoEnCatalogo = (codigo) => {
    const c = (codigo || '').trim();
    if (!c) return null;
    return leerCatalogo().find(p => p.codigo === c || (p.codigos || []).includes(c)) || null;
  };

  // Cachear al montar (si hay internet): primera vez o refresco diario tras las 3 AM
  useEffect(() => { cachearCatalogo(); }, []);

  // ============================================================
  // COLA DE VENTAS OFFLINE
  // ============================================================
  const agregarVentaOffline = (venta) => {
    const ventaConId = {
      ...venta,
      _offline_id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      _timestamp: new Date().toISOString(),
    };
    setPendientes(prev => [...prev, ventaConId]);
    return ventaConId._offline_id;
  };

  // Sincroniza cada venta: 1) crea la venta (con offline_uuid para no duplicar);
  // 2) si pedía factura electrónica, la emite ahora (fecha del día que vuelve).
  const sincronizarPendientes = async () => {
    if (sincronizandoRef.current) return;

    const pendientesActuales = JSON.parse(localStorage.getItem('ventas_offline') || '[]');
    if (pendientesActuales.length === 0) return;

    sincronizandoRef.current = true;
    setSincronizando(true);
    setErrorSync(null);

    const fallidos = [];
    let facturasFallidas = 0;

    for (const venta of pendientesActuales) {
      try {
        // Separar campos internos y los datos de facturación de la venta
        const { _offline_id, _timestamp, facturacion, ...ventaLimpia } = venta;
        const resVenta = await api.post('/api/ventas', { ...ventaLimpia, offline_uuid: _offline_id });
        const ventaId = resVenta.data?.id;

        // Si la venta pedía factura electrónica, emitirla ahora
        if (ventaId && facturacion) {
          try {
            await api.post('/api/arca/emitir', { ...facturacion, venta_id: ventaId }, { timeout: 90000 });
          } catch {
            facturasFallidas++; // la venta quedó registrada; la factura se reintenta a mano
          }
        }
      } catch (err) {
        // Validación (400): la venta no es válida → se descarta. Red/servidor (5xx): se reintenta.
        if (err.response?.status === 400) {
          console.warn('Venta offline descartada:', err.response?.data?.error);
        } else {
          fallidos.push(venta);
        }
      }
    }

    setPendientes(fallidos);
    setUltimaSincronizacion(new Date());
    if (facturasFallidas > 0) {
      setErrorSync(`${facturasFallidas} factura(s) no se pudieron emitir. Reintentá desde Configuración → Facturación.`);
    }
    setSincronizando(false);
    sincronizandoRef.current = false;

    return { fallidos: fallidos.length };
  };

  return (
    <ConectividadContext.Provider value={{
      online,
      sincronizando,
      pendientes,
      ultimaSincronizacion,
      errorSync,
      agregarVentaOffline,
      sincronizarPendientes,
      cachearCatalogo,
      buscarEnCatalogo,
      buscarCodigoEnCatalogo,
    }}>
      {children}
    </ConectividadContext.Provider>
  );
}
