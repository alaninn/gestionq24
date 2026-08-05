// =============================================
// AVISO DE VENCIMIENTO DE SUSCRIPCION (para el usuario del negocio)
// - Faltando 5 dias o menos: banner de aviso arriba (se puede cerrar por el dia).
// - Faltando 24 hs o menos: alerta FIJA en la esquina, no se puede cerrar.
// En ambos casos, al tocar se abre WhatsApp con el administrador para renovar.
// El superadmin no ve estos avisos.
// =============================================

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { diasRestantes } from '../../utils/vencimiento';

// Contacto del administrador del sistema (para renovaciones), formato wa.me.
const WHATSAPP_ADMIN = '5491162684353';

function armarLinkWhatsApp(usuario, dias) {
  const negocio = usuario?.negocio_nombre || 'mi negocio';
  const cuando = dias <= 1 ? 'en menos de 24 hs' : `en ${dias} días`;
  const texto =
    `Hola! Te escribo desde "${negocio}". Mi suscripción de GestionQ24 vence ${cuando}. ` +
    `Quiero renovarla, ¿me pasás cómo abonar?`;
  return `https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent(texto)}`;
}

// Clave de "oculto por hoy" para el banner (reaparece al día siguiente).
function claveOcultoHoy() {
  const hoy = new Date().toLocaleDateString('es-AR');
  return `aviso_venc_oculto_${hoy}`;
}

export default function AvisoVencimiento() {
  const { usuario } = useAuth();
  const [ocultoBanner, setOcultoBanner] = useState(
    () => localStorage.getItem(claveOcultoHoy()) === '1'
  );

  // El superadmin no ve avisos; tampoco si no hay fecha de vencimiento.
  if (!usuario || usuario.rol === 'superadmin' || !usuario.fecha_vencimiento) return null;

  const dias = diasRestantes(usuario.fecha_vencimiento);
  // Fuera de rango (ya venció -> el backend lo bloquea; o falta más de 5 días).
  if (dias <= 0 || dias > 5) return null;

  const url = armarLinkWhatsApp(usuario, dias);
  const critico = dias <= 1;

  // -------- Alerta fija en la esquina (24 hs o menos), no se cierra --------
  if (critico) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-4 right-4 z-[9999] flex items-center gap-3 max-w-xs
                   bg-red-600 text-white rounded-2xl shadow-2xl px-4 py-3
                   ring-2 ring-red-300 animate-pulse hover:animate-none
                   hover:bg-red-700 transition-colors cursor-pointer"
        title="Tocá para renovar por WhatsApp"
      >
        <span className="text-2xl leading-none">⏰</span>
        <span className="text-sm leading-tight">
          <strong className="block">Tu suscripción vence en menos de 24 hs</strong>
          <span className="opacity-90">Tocá acá para renovar por WhatsApp</span>
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
