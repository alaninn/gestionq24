// =============================================
// AVISO DE VENCIMIENTO DE SUSCRIPCION (para el usuario del negocio)
// - Faltando 5 dias: banner de aviso arriba (se puede cerrar por el dia).
// - Faltando 4 dias o menos: alerta FIJA en la esquina, con cuenta regresiva,
//   no se cierra (asi no llega a ultimo momento sin enterarse).
// El admin puede PAGAR directo por Mercado Pago (autopago); el resto de los
// usuarios ven la opcion de renovar por WhatsApp. El superadmin no ve avisos.
// =============================================

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { linkRenovarWhatsApp } from '../../utils/contacto';
import { estadoAutopago, iniciarPagoMembresia } from '../../utils/autopago';

// Clave de "oculto por hoy" para el banner (reaparece al día siguiente).
function claveOcultoHoy() {
  const hoy = new Date().toLocaleDateString('es-AR');
  return `aviso_venc_oculto_${hoy}`;
}

// Formatea milisegundos restantes como HH:MM:SS (o "Nd HH:MM:SS" si falta más de un día).
function fmtCuentaRegresiva(ms) {
  if (ms < 0) ms = 0;
  const totalSeg = Math.floor(ms / 1000);
  const d = Math.floor(totalSeg / 86400);
  const h = Math.floor((totalSeg % 86400) / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `${d > 0 ? d + 'd ' : ''}${p(h)}:${p(m)}:${p(s)}`;
}

const fmtP = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR');

export default function AvisoVencimiento() {
  const { usuario, refrescarUsuario } = useAuth();
  const [ocultoBanner, setOcultoBanner] = useState(
    () => localStorage.getItem(claveOcultoHoy()) === '1'
  );
  const [ahora, setAhora] = useState(Date.now());
  const [autopago, setAutopago] = useState(null); // { disponible, precio } | null
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Mientras el aviso puede estar visible (faltan <= 5 días), refrescamos la fecha
  // de vencimiento desde el servidor cada 45s. Así, si se renueva la suscripción,
  // el cartel desaparece solo, sin recargar la página.
  useEffect(() => {
    if (!usuario || usuario.rol === 'superadmin' || !usuario.fecha_vencimiento) return;
    const v = new Date(usuario.fecha_vencimiento);
    const corte = new Date(v.getFullYear(), v.getMonth(), v.getDate() + 1).getTime();
    const diasAprox = Math.ceil((corte - Date.now()) / 86400000);
    if (diasAprox > 5) return; // fuera de la ventana de aviso: no hace falta refrescar
    const id = setInterval(() => { refrescarUsuario && refrescarUsuario(); }, 45000);
    return () => clearInterval(id);
  }, [usuario?.fecha_vencimiento, usuario?.rol, refrescarUsuario]);

  // Autopago: solo el admin, y solo dentro de la ventana de aviso, consulta si
  // puede pagar por Mercado Pago y a qué precio.
  useEffect(() => {
    if (!usuario || usuario.rol !== 'admin' || !usuario.fecha_vencimiento || !usuario.negocio_id) return;
    const v = new Date(usuario.fecha_vencimiento);
    const corte = new Date(v.getFullYear(), v.getMonth(), v.getDate() + 1).getTime();
    const diasAprox = Math.ceil((corte - Date.now()) / 86400000);
    if (diasAprox > 5) return;
    let vivo = true;
    estadoAutopago(usuario.negocio_id).then(d => { if (vivo) setAutopago(d); });
    return () => { vivo = false; };
  }, [usuario?.fecha_vencimiento, usuario?.rol, usuario?.negocio_id]);

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

  // Alerta fija (no se cierra) durante los últimos 4 días.
  const critico = dias <= 4;
  const url = linkRenovarWhatsApp({
    negocio: usuario.negocio_nombre,
    estado: dias <= 1 ? '24h' : dias,
  });
  const puedePagar = autopago?.disponible === true && usuario.rol === 'admin';
  const pagar = async () => {
    const ok = await iniciarPagoMembresia(usuario.negocio_id);
    if (!ok) window.open(url, '_blank'); // si Mercado Pago falla, cae a WhatsApp
  };

  // -------- Alerta fija en la esquina (24 hs o menos), con cuenta regresiva --------
  if (critico) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-xs
                      bg-red-600 text-white rounded-2xl shadow-2xl px-4 py-3 ring-2 ring-red-300">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none animate-pulse">⏰</span>
          <span className="text-sm leading-tight">
            <strong className="block">Tu suscripción vence en</strong>
            <span className="block font-mono text-lg font-bold tabular-nums tracking-wide">
              {fmtCuentaRegresiva(msRestantes)}
            </span>
          </span>
        </div>
        {puedePagar ? (
          <>
            <button onClick={pagar}
              className="w-full bg-white text-red-700 hover:bg-gray-100 font-bold rounded-lg px-3 py-2 text-sm transition-colors">
              💳 Pagar {autopago.precio ? fmtP(autopago.precio) : ''} y reactivar
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="text-center text-xs text-white/90 underline">
              o renovar por WhatsApp
            </a>
          </>
        ) : (
          <a href={url} target="_blank" rel="noreferrer"
            className="w-full bg-white text-red-700 hover:bg-gray-100 font-bold rounded-lg px-3 py-2 text-sm text-center transition-colors"
            title="Tocá para renovar por WhatsApp">
            💬 Renovar por WhatsApp
          </a>
        )}
      </div>
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
        {puedePagar && (
          <button onClick={pagar}
            className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold
                       rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap">
            💳 Pagar {autopago.precio ? fmtP(autopago.precio) : 'ahora'}
          </button>
        )}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={`flex-shrink-0 whitespace-nowrap ${puedePagar
            ? 'text-green-700 hover:text-green-900 underline text-sm'
            : 'bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg px-3 py-1.5 transition-colors'}`}
        >
          {puedePagar ? 'WhatsApp' : 'Renovar por WhatsApp'}
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
