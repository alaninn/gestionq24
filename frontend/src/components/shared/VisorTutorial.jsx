// =============================================
// VISOR DE TUTORIAL (modal)
// Muestra el instructivo paso a paso de un módulo: para qué sirve, pasos (con
// imagen opcional), tips y errores comunes. Molde tomado de VersionChangelog.jsx.
// =============================================

import { useState } from 'react';
import { createPortal } from 'react-dom';
import useCerrarConAtras from '../../hooks/useCerrarConAtras';

// Imagen que se oculta sola si el archivo no existe todavía.
function ImagenPaso({ src, alt }) {
  const [error, setError] = useState(false);
  if (!src || error) return null;
  return (
    <img
      src={src}
      alt={alt || ''}
      loading="lazy"
      onError={() => setError(true)}
      className="mt-2 w-full max-w-full rounded-lg border border-gray-200 shadow-sm"
    />
  );
}

export default function VisorTutorial({ tutorial, onCerrar }) {
  // El botón "atrás" del celular cierra el visor.
  useCerrarConAtras(!!tutorial, onCerrar);
  if (!tutorial) return null;

  const { icono, titulo, color = 'from-emerald-500 to-green-600', pro, intro, pasos = [], tips = [], erroresComunes = [] } = tutorial;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110] p-4"
      onClick={onCerrar}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* Encabezado */}
        <div className={`p-5 border-b bg-gradient-to-r ${color} text-white`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-3xl leading-none flex-shrink-0">{icono}</span>
              <div className="min-w-0">
                <h3 className="text-lg font-bold leading-tight flex items-center gap-2">
                  {titulo}
                  {pro && <span className="text-[10px] font-bold bg-white/25 px-1.5 py-0.5 rounded-full">★ PRO</span>}
                </h3>
                <p className="text-white/80 text-sm">Guía paso a paso</p>
              </div>
            </div>
            <button onClick={onCerrar} className="text-white/80 hover:text-white text-2xl leading-none flex-shrink-0">×</button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {intro && (
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-3">
              {intro}
            </p>
          )}

          {/* Pasos numerados */}
          {pasos.length > 0 && (
            <div className="space-y-5">
              {pasos.map((p, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center shadow"
                    style={{ backgroundColor: 'var(--color-primario)' }}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    {p.titulo && <p className="font-semibold text-gray-800 text-sm">{p.titulo}</p>}
                    {p.texto && <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{p.texto}</p>}
                    <ImagenPaso src={p.imagen} alt={p.titulo} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tips */}
          {tips.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="font-semibold text-amber-900 text-sm mb-1.5">💡 Tips útiles</p>
              <ul className="space-y-1">
                {tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-amber-800 leading-relaxed">
                    <span className="mt-0.5">•</span><span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Errores comunes */}
          {erroresComunes.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="font-semibold text-red-900 text-sm mb-1.5">⚠️ Si algo no sale</p>
              <ul className="space-y-1">
                {erroresComunes.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-red-800 leading-relaxed">
                    <span className="mt-0.5">•</span><span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="p-4 border-t bg-gray-50">
          <button onClick={onCerrar}
            className="w-full py-2.5 text-white rounded-lg font-semibold transition-colors"
            style={{ backgroundColor: 'var(--color-primario)' }}>
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
