import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function PlanBadge() {
  const { usuario, esPremium, planInfo } = useAuth();

  if (!usuario || usuario.rol === 'superadmin') return null;

  const isPremium = esPremium();

  return (
    <div className="fixed top-4 right-4 z-50">
      {isPremium ? (
        <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black px-4 py-1.5 rounded-full shadow-lg shadow-amber-500/30 flex items-center gap-2 font-bold text-sm animate-pulse">
          <span>✨</span>
          <span>PLAN PREMIUM</span>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-sm">
          <span>📦</span>
          <span>PLAN ESTANDAR</span>
          <button 
            className="ml-2 bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-xs transition-all"
            onClick={() => window.open('https://qrban.com.ar/planes', '_blank')}
          >
            Actualizar
          </button>
        </div>
      )}

      {planInfo && (
        <div className="mt-2 text-xs text-right opacity-70">
          <div>Productos: {planInfo.uso_actual.productos} / {planInfo.limites.max_productos}</div>
          <div>Usuarios: {planInfo.uso_actual.usuarios} / {planInfo.limites.max_usuarios}</div>
        </div>
      )}
    </div>
  );
}