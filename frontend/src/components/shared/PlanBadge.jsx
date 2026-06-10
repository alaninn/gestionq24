import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

// Se muestra una sola vez por sesión y se oculta solo a los pocos segundos.
const STORAGE_KEY = 'plan_badge_visto';
const SEGUNDOS_VISIBLE = 5000;

export default function PlanBadge() {
  const { usuario, esPremium, planInfo } = useAuth();
  const [visible, setVisible] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    if (!usuario || usuario.rol === 'superadmin') return;
    // Si ya se mostró en esta sesión, no volver a mostrarlo
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    setMontado(true);
    // Pequeño delay para la animación de entrada
    const t1 = setTimeout(() => setVisible(true), 100);
    // Auto-ocultar
    const t2 = setTimeout(() => ocultar(), SEGUNDOS_VISIBLE);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [usuario]);

  const ocultar = () => {
    setVisible(false);
    sessionStorage.setItem(STORAGE_KEY, '1');
    // Desmontar después de la transición
    setTimeout(() => setMontado(false), 400);
  };

  if (!usuario || usuario.rol === 'superadmin' || !montado) return null;

  const isPremium = esPremium();

  return (
    <div
      className={`fixed top-3 right-3 z-50 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
    >
      <div className="flex flex-col items-end">
        {isPremium ? (
          <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black px-3 py-1 rounded-full shadow-md flex items-center gap-1.5 font-bold text-xs">
            <span>✨</span>
            <span>PLAN PREMIUM</span>
            <button onClick={ocultar} className="ml-1 text-black/50 hover:text-black text-sm leading-none">×</button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white px-3 py-1 rounded-full shadow-md flex items-center gap-1.5 text-xs">
            <span>📦</span>
            <span>PLAN ESTÁNDAR</span>
            <button
              className="ml-1 bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-xs transition-all"
              onClick={() => window.open('https://qrban.com.ar/planes', '_blank')}
            >
              Actualizar
            </button>
            <button onClick={ocultar} className="text-white/50 hover:text-white text-sm leading-none">×</button>
          </div>
        )}

        {planInfo && (
          <div className="mt-1.5 text-[11px] text-right opacity-60 bg-black/40 text-white rounded-lg px-2 py-1">
            <div>Productos: {planInfo.uso_actual.productos} / {planInfo.limites.max_productos}</div>
            <div>Usuarios: {planInfo.uso_actual.usuarios} / {planInfo.limites.max_usuarios}</div>
          </div>
        )}
      </div>
    </div>
  );
}
