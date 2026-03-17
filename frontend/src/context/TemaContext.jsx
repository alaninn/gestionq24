import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const TemaContext = createContext(null);
export const useTema = () => useContext(TemaContext);

export function TemaProvider({ children }) {
  const [colorPrimario, setColorPrimario] = useState('#f97316');

  useEffect(() => {
    cargarTema();
  }, []);

  const cargarTema = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return; // Si no hay token no cargamos el tema
      const res = await api.get('/api/configuracion');
      if (res.data?.color_primario) {
        aplicarColor(res.data.color_primario);
      }
    } catch {}
  };

  const aplicarColor = (color) => {
    setColorPrimario(color);
    // Aplicamos el color como variable CSS global
    document.documentElement.style.setProperty('--color-primario', color);
    // Generamos variantes más oscuras y claras
    document.documentElement.style.setProperty('--color-primario-hover', ajustarBrillo(color, -20));
    document.documentElement.style.setProperty('--color-primario-light', color + '20');
  };

  const cambiarColor = async (color) => {
    aplicarColor(color);
    try {
      await api.put('/api/configuracion', { color_primario: color });
    } catch {}
  };

  return (
    <TemaContext.Provider value={{ colorPrimario, cambiarColor, aplicarColor }}>
      {children}
    </TemaContext.Provider>
  );
}

// Función para oscurecer/aclarar un color hex
function ajustarBrillo(hex, cantidad) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + cantidad));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + cantidad));
  const b = Math.min(255, Math.max(0, (num & 0xff) + cantidad));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}