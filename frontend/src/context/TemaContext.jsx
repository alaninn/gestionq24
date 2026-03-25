import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const TemaContext = createContext(null);
export const useTema = () => useContext(TemaContext);

export function TemaProvider({ children }) {
  const [colorPrimario, setColorPrimario] = useState(() => {
    return localStorage.getItem('color_primario') || '#f97316';
  });
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    const colorGuardado = localStorage.getItem('color_primario') || '#f97316';
    aplicarColor(colorGuardado);
    cargarTema();
  }, []);

  const cargarTema = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setCargado(true);
        return;
      }

      const res = await api.get('/api/configuracion');
      if (!res.data) {
        setCargado(true);
        return;
      }

      const color = res.data.color_primario || '#f97316';
      const modoOscuro = res.data.modo_oscuro ?? true;

      localStorage.setItem('config_negocio', JSON.stringify(res.data));
      localStorage.setItem('color_primario', color);
      aplicarColor(color);

      if (modoOscuro) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

    } catch (err) {
      if (err.response?.status !== 401) {
        console.error('Error cargando tema:', err);
      }
    } finally {
      setCargado(true);
    }
  };

  const aplicarColor = (color) => {
    setColorPrimario(color);
    document.documentElement.style.setProperty('--color-primario', color);
    document.documentElement.style.setProperty('--color-primario-hover', ajustarBrillo(color, -20));
    document.documentElement.style.setProperty('--color-primario-light', color + '20');
  };

  const cambiarColor = async (color) => {
    aplicarColor(color);
    localStorage.setItem('color_primario', color);
    try {
      await api.put('/api/configuracion', { color_primario: color });
    } catch (err) {
      console.error('Error guardando color:', err);
    }
  };

  return (
    <TemaContext.Provider value={{ colorPrimario, cambiarColor, aplicarColor, cargarTema, cargado }}>
      {children}
    </TemaContext.Provider>
  );
}

function ajustarBrillo(hex, cantidad) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + cantidad));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + cantidad));
  const b = Math.min(255, Math.max(0, (num & 0xff) + cantidad));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}