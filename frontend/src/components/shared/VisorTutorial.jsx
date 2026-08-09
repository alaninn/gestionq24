// =============================================
// VISOR DE TUTORIAL (modal)
// Muestra el instructivo de un módulo: para qué sirve, beneficios, pasos (con
// imagen opcional clickeable para ver en grande), tips y errores comunes.
// Molde tomado de VersionChangelog.jsx.
// =============================================

import { useState } from 'react';
import { createPortal } from 'react-dom';
import useCerrarConAtras from '../../hooks/useCerrarConAtras';

// Imagen del paso: se oculta sola si el archivo no existe, y se puede tocar para
// verla en grande (avisa al padre con onAmpliar).
function ImagenPaso({ src, alt, onAmpliar }) {
  const [error, setError] = useState(false);
  if (!src || error) return null;
  return (
    <figure className="mt-3">
      <img
        src={src}
        alt={alt || ''}
        loading="lazy"
        onError={() => setError(true)}
        onClick={() => onAmpliar(src)}
        className="w-full max-w-full rounded-xl border border-gray-200 shadow-md cursor-zoom-in hover:opacity-95 transition-opacity"
      />
      <figcaption className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
        🔍 Tocá la imagen para verla en grande
      </figcaption>
    </figure>
  );
}

export default function VisorTutorial({ tutorial, onCerrar }) {
  const [zoom, setZoom] = useState(null); // src de la imagen ampliada

  // Botón "atrás": cierra primero el zoom; si no hay zoom, cierra el visor.
  useCerrarConAtras(!!tutorial && !zoom, onCerrar);
  useCerrarConAtras(!!zoom, () => setZoom(null));

  if (!tutorial) return null;

  const {
    icono, titulo, color = 'from-emerald-500 to-green-600', pro,
    intro, beneficios = [], pasos = [], funciones = [], tips = [], erroresComunes = [],
  } = tutorial;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110] p-4"
        onClick={onCerrar}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
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
                  <p className="text-white/80 text-sm">Guía fácil, paso a paso</p>
                </div>
              </div>
              <button onClick={onCerrar} className="text-white/80 hover:text-white text-2xl leading-none flex-shrink-0">×</button>
            </div>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {intro && (
              <p className="text-[15px] text-gray-700 leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-4">
                {intro}
              </p>
            )}

            {/* Beneficios / para qué te sirve */}
            {beneficios.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="font-bold text-emerald-900 text-sm mb-2">✅ Para qué te sirve</p>
                <ul className="space-y-1.5">
                  {beneficios.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-emerald-900 leading-relaxed">
                      <span className="mt-0.5 text-emerald-500">✔</span><span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pasos numerados */}
            {pasos.length > 0 && (
              <div>
                <p className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">👉 Cómo se usa (paso a paso)</p>
                <div className="space-y-5">
                  {pasos.map((p, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full text-white text-base font-bold flex items-center justify-center shadow"
                        style={{ backgroundColor: 'var(--color-primario)' }}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        {p.titulo && <p className="font-semibold text-gray-800 text-[15px]">{p.titulo}</p>}
                        {p.texto && <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{p.texto}</p>}
                        <ImagenPaso src={p.imagen} alt={p.titulo} onAmpliar={setZoom} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Todos los botones y opciones (detalle exhaustivo) */}
            {funciones.length > 0 && (
              <div>
                <p className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">🧩 Todos los botones y opciones (uno por uno)</p>
                <div className="space-y-2">
                  {funciones.map((f, i) => (
                    typeof f === 'string' ? (
                      <p key={i} className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2">{f}</p>
                    ) : (
                      <div key={i} className="border border-gray-200 rounded-lg p-3">
                        <p className="font-semibold text-gray-800 text-sm">{f.titulo}</p>
                        <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{f.texto}</p>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            {tips.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-bold text-amber-900 text-sm mb-1.5">💡 Tips que te van a servir</p>
                <ul className="space-y-1.5">
                  {tips.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-800 leading-relaxed">
                      <span className="mt-0.5">•</span><span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Errores comunes */}
            {erroresComunes.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="font-bold text-red-900 text-sm mb-1.5">⚠️ Si algo no sale, revisá esto</p>
                <ul className="space-y-1.5">
                  {erroresComunes.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-800 leading-relaxed">
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
              ¡Entendido!
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox: imagen ampliada a pantalla grande */}
      {zoom && (
        <div className="fixed inset-0 bg-black/90 z-[120] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-w-full max-h-full rounded-lg shadow-2xl" />
          <button
            onClick={(e) => { e.stopPropagation(); setZoom(null); }}
            className="absolute top-4 right-5 text-white/90 hover:text-white text-4xl leading-none">×</button>
        </div>
      )}
    </>,
    document.body
  );
}
