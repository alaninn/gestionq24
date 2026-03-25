import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api/axios';

const ConectividadContext = createContext(null);
export const useConectividad = () => useContext(ConectividadContext);

export function ConectividadProvider({ children }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [sincronizando, setSincronizando] = useState(false);
  const [pendientes, setPendientes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ventas_offline') || '[]');
    } catch { return []; }
  });
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState(null);
  const sincronizandoRef = useRef(false);

  useEffect(() => {
    const volverOnline = () => {
      setOnline(true);
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

  const agregarVentaOffline = (venta) => {
    const ventaConId = {
      ...venta,
      _offline_id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      _timestamp: new Date().toISOString(),
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

    const exitosos = [];
    const fallidos = [];

    for (const venta of pendientesActuales) {
      try {
        // Limpiar campos internos antes de enviar
        const { _offline_id, _timestamp, ...ventaLimpia } = venta;
        await api.post('/api/ventas', ventaLimpia);
        exitosos.push(_offline_id);
      } catch (err) {
        // Si el error es de validación (400), descartamos la venta
        // Si es de servidor (500) o red, la reintentamos después
        if (err.response?.status === 400) {
          exitosos.push(venta._offline_id); // la descartamos igual
          console.warn('Venta offline descartada:', err.response.data.error);
        } else {
          fallidos.push(venta);
        }
      }
    }

    // Actualizar lista — solo quedan los que fallaron por error de servidor
    setPendientes(fallidos);
    setUltimaSincronizacion(new Date());
    setSincronizando(false);
    sincronizandoRef.current = false;

    return { exitosos: exitosos.length, fallidos: fallidos.length };
  };

  return (
    <ConectividadContext.Provider value={{
      online,
      sincronizando,
      pendientes,
      ultimaSincronizacion,
      agregarVentaOffline,
      sincronizarPendientes,
    }}>
      {children}
    </ConectividadContext.Provider>
  );
}