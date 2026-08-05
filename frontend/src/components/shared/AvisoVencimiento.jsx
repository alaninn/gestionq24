// =============================================
// AVISO DE VENCIMIENTO DE SUSCRIPCION (para el usuario del negocio)
// - Faltando 5 dias o menos: banner de aviso arriba (se puede cerrar por el dia).
// - Faltando 24 hs o menos: alerta FIJA en la esquina, con cuenta regresiva, no se cierra.
// En ambos casos, al tocar se abre WhatsApp con el administrador para renovar.
// El superadmin no ve estos avisos.
// =============================================

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { linkRenovarWhatsApp } from '../../utils/contacto';

// Clave de "oculto por hoy" para el banner (reaparece al día siguiente).
function claveOcultoHoy() {
  const hoy = new Date().toLocaleDateString('es-AR');
  return `aviso_venc_oculto_${hoy}`;
}

// Formatea milisegundos restantes como HH:MM:SS.
function fmtCuentaRegresiva(ms) {
  if (ms < 0) ms = 0;
  const totalSeg = Math.floor(ms / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

export default function AvisoVencimiento() {
  const { usuario } = useAuth();
  const [ocultoBanner, setOcultoBanner] = useState(
    () => localStorage.getItem(claveOcultoHoy()) === '1'
  );
  // Reloj que actualiza la cuenta regresiva cada segundo.
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // El superadmin no ve avisos; tampoco si no hay fecha de vencimiento.
  if (!usuario || usuario.rol === 'superadmin' || !usuario.fecha_vencimiento) return null;

  // El negocio puede usar el sistema durante TODO el día de vencimiento; el corte
  // real es a las 00:00 del día siguiente. La cuenta regresiva apunta a ese instante.
  const v = new Date(usuario.fecha_vencimiento);
  const instanteCorte = new Date(v.getFullYear(), v.getMonth(), v.getDate() + 1).getTime();
  const msRestantes = instanteCorte - ahora;
  const dias = Math.max(0, Math.ceil(msRestantes / 86400000));
  // Fuera de rango (ya venció -> el backend lo bloquea; o falta más de 5 días).
  if (dias <= 0 || dias > 5) return null;

  const critico = dias <= 1;
  const url = linkRenovarWhatsApp({
    negocio: usuario.negocio_nombre,
    estado: critico ? '24h' : dias,
  });

  // -------- Alerta fija en la esquina (24 hs o menos), con cuenta regresiva --------
  if (critico) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-4 right-4 z-[9999] flex items-center gap-3 max-w-xs
                   bg-red-600 text-white rounded-2xl shadow-2xl px-4 py-3
                   ring-2 ring-red-300 hover:bg-red-700 transition-colors cursor-pointer"
        title="Tocá para renovar por WhatsApp"
      >
        <span className="text-2xl leading-none animate-pulse">⏰</span>
        <span className="text-sm leading-tight">
          <strong className="block">Tu suscripción vence en</strong>
          <span className="block font-mono text-lg font-bold tabular-nums tracking-wide">
            {fmtCuentaRegresiva(msRestantes)}
          </span>
          <span className="opacity-90 text-xs">Tocá acá para renovar por WhatsApp</span>
        </span>
      </a>
    );
  }

  // -------- Banner de aviso (5 días o menos), se puede cerrar por hoy --------
  if (ocultoBanner) return null;

  const cerrarPorHoy = () => {
    localStorage.setItem(claveOcultoHoy(), '1');
    setOcultoBanner(true);
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[9998] flex justify-center px-3 pt-2 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 max-w-2xl w-full
                      bg-orange-50 border border-orange-300 text-orange-900
                      rounded-xl shadow-lg px-4 py-2.5">
        <span className="text-xl leading-none">⚠️</span>
        <p className="text-sm flex-1 leading-tight">
          Tu suscripción vence en <strong>{dias} {dias === 1 ? 'día' : 'días'}</strong>.
          Renovala para no perder el servicio.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold
                     rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
        >
          Renovar por WhatsApp
        </a>
        <button
          onClick={cerrarPorHoy}
          className="flex-shrink-0 text-orange-500 hover:text-orange-800 text-lg leading-none px-1"
          title="Ocultar por hoy"
          aria-label="Ocultar por hoy"
        >
          ×
        </button>
      </div>
    </div>
  );
}
