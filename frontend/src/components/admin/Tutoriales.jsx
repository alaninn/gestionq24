// =============================================
// TUTORIALES — menú de guías del sistema
// Grilla de tarjetas clickeables (una por módulo). Al tocar una se abre el visor
// con el instructivo paso a paso. Las tarjetas se muestran según lo que el usuario
// puede ver (mismo criterio que el menú lateral).
// =============================================

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TUTORIALES } from '../../tutoriales';
import VisorTutorial from '../shared/VisorTutorial';

export default function Tutoriales() {
  const { usuario, tienePermiso, moduloPermitidoPlan, puedeUsarFuncion } = useAuth();
  const [seleccionado, setSeleccionado] = useState(null);

  // Mismo criterio de visibilidad que el menú lateral (admin.jsx).
  const puedeVer = (modulo) => tienePermiso(modulo, 'ver') && moduloPermitidoPlan(modulo);
  const esAdmin = ['admin', 'superadmin'].includes(usuario?.rol);

  const visible = (t) => {
    const g = t.gating || {};
    if (g.siempre) return true;
    if (g.rolAdmin) return esAdmin;
    if (g.funcion) return puedeUsarFuncion(g.funcion);
    if (g.permiso) return puedeVer(g.permiso);
    return true;
  };

  const lista = TUTORIALES.filter(visible);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
          📚 Tutoriales
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Elegí una sección para ver cómo se usa, paso a paso. Pensado para que lo entienda cualquiera.
        </p>
      </div>

      {/* Grilla de tarjetas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {lista.map((t) => (
          <button
            key={t.id}
            onClick={() => setSeleccionado(t)}
            className={`text-left bg-gradient-to-br ${t.color || 'from-emerald-500 to-green-600'} rounded-2xl p-4 sm:p-5 text-white shadow-lg cursor-pointer hover:scale-[1.03] active:scale-95 transition-transform`}
          >
            <div className="flex items-start justify-between">
              <span className="text-3xl leading-none">{t.icono}</span>
              {t.pro && (
                <span className="text-[10px] font-bold bg-white/25 px-1.5 py-0.5 rounded-full">★ PRO</span>
              )}
            </div>
            <p className="font-bold mt-3 leading-tight">{t.titulo}</p>
            <p className="text-white/80 text-xs mt-1 leading-snug">{t.resumen}</p>
            <span className="inline-block mt-3 text-xs font-semibold bg-white/20 px-2 py-1 rounded-lg">
              Ver tutorial →
            </span>
          </button>
        ))}
      </div>

      {lista.length === 0 && (
        <p className="text-gray-500 text-sm">No hay tutoriales disponibles para tu usuario.</p>
      )}

      {/* Visor del tutorial seleccionado */}
      <VisorTutorial tutorial={seleccionado} onCerrar={() => setSeleccionado(null)} />
    </div>
  );
}
