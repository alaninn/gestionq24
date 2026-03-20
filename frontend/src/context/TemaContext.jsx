import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const TemaContext = createContext(null);
export const useTema = () => useContext(TemaContext);

export function TemaProvider({ children }) {
  const [colorPrimario, setColorPrimario] = useState(() => {
    // Cargar color del localStorage al inicializar
    return localStorage.getItem('color_primario') || '#f97316';
  });
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    // Aplicar color inmediatamente desde localStorage
    const colorGuardado = localStorage.getItem('color_primario') || '#f97316';
    aplicarColor(colorGuardado);
    
    // Luego cargar de la BD para sincronizar
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
      const color = res.data?.color_primario || '#f97316';
      
      // Si el color en BD es diferente al del localStorage, actualizamos
      if (color !== localStorage.getItem('color_primario')) {
        localStorage.setItem('color_primario', color);
        aplicarColor(color);
      }
    } catch (err) {
      console.error('Error cargando tema:', err);
    } finally {
      setCargado(true);
    }
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
    // Aplicar inmediatamente en la UI
    aplicarColor(color);
    
    // Guardar en localStorage
    localStorage.setItem('color_primario', color);
    
    // Guardar en la BD
    try {
      await api.put('/api/configuracion', { color_primario: color });
    } catch (err) {
      console.error('Error guardando color:', err);
    }
  };

  return (
    <TemaContext.Provider value={{ colorPrimario, cambiarColor, aplicarColor, cargado }}>
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