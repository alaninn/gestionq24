// =============================================
// ARCHIVO: src/components/shared/VersionChangelog.jsx
// Muestra la versión del programa (clickeable) + modal con el historial de cambios.
// Avisa con un punto cuando hay una versión nueva sin leer.
// =============================================

import { useState, useEffect } from 'react';
import { VERSION_ACTUAL, CHANGELOG } from '../../changelog';

const STORAGE_KEY = 'version_vista';

export default function VersionChangelog({ variant = 'sidebar' }) {
  const [abierto, setAbierto] = useState(false);
  const [hayNovedades, setHayNovedades] = useState(false);

  useEffect(() => {
    const vista = localStorage.getItem(STORAGE_KEY);
    if (vista !== VERSION_ACTUAL) {
      setHayNovedades(true);
      // Si la última versión trae cambios destacados, abrimos el modal una vez
      if (CHANGELOG[0]?.destacados?.length) setAbierto(true);
    }
  }, []);

  const cerrar = () => {
    setAbierto(false);
    localStorage.setItem(STORAGE_KEY, VERSION_ACTUAL);
    setHayNovedades(false);
  };

  // Estilo del botón según dónde se use
  const triggerClase = variant === 'superadmin'
    ? 'flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors'
    : 'flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors';

  return (
    <>
      <button onClick={() => setAbierto(true)} className={triggerClase} title="Ver novedades">
        <span className="relative flex items-center">
          <span>v{VERSION_ACTUAL}</span>
          {hayNovedades && (
            <span className="absolute -top-1 -right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          )}
        </span>
        <span className="opacity-60">📋</span>
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4"
          onClick={cerrar}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}>

            {/* Encabezado */}
            <div className="p-5 border-b bg-gradient-to-r from-green-600 to-emerald-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">🎉 Novedades</h3>
                  <p className="text-white/80 text-sm">Versión actual: v{VERSION_ACTUAL}</p>
                </div>
                <button onClick={cerrar} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
              </div>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {CHANGELOG.map((entrada, idx) => (
                <div key={entrada.version}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${idx === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      v{entrada.version}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{entrada.titulo}</span>
                    <span className="text-xs text-gray-400 ml-auto">{entrada.fecha}</span>
                  </div>

                  {/* Destacados (cambios importantes con explicación) */}
                  {entrada.destacados?.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {entrada.destacados.map((d, i) => (
                        <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                          <p className="font-semibold text-amber-900 text-sm">{d.titulo}</p>
                          <p className="text-amber-800 text-xs mt-1 leading-relaxed">{d.detalle}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lista de cambios */}
                  <ul className="space-y-1.5">
                    {entrada.cambios.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>

                  {idx < CHANGELOG.length - 1 && <div className="border-t border-gray-100 mt-4" />}
                </div>
              ))}
            </div>

            {/* Pie */}
            <div className="p-4 border-t bg-gray-50">
              <button onClick={cerrar}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors">
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
