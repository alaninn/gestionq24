// =============================================
// HOOK: useCerrarConAtras
// Hace que el botón "atrás" del celular cierre el modal en vez de salir
// de la página. Al abrir el modal se agrega una entrada al historial del
// navegador; "atrás" consume esa entrada y cierra el modal. Si el usuario
// cierra con la ✕ o Cancelar, la entrada extra se limpia sola.
//
// Uso:  useCerrarConAtras(mostrarModal, () => setMostrarModal(false));
// =============================================

import { useEffect, useRef } from 'react';

export default function useCerrarConAtras(abierto, onCerrar) {
  // Ref para usar siempre la última versión del callback sin re-suscribir
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  const cerradoPorAtras = useRef(false);

  useEffect(() => {
    if (!abierto) return;

    cerradoPorAtras.current = false;
    window.history.pushState({ modalAbierto: true }, '');

    const alVolver = () => {
      cerradoPorAtras.current = true;
      cerrarRef.current();
    };

    window.addEventListener('popstate', alVolver);
    return () => {
      window.removeEventListener('popstate', alVolver);
      // Si el modal se cerró con ✕ / Cancelar / guardar (no con "atrás"),
      // consumimos la entrada extra para no ensuciar el historial.
      if (!cerradoPorAtras.current) {
        window.history.back();
      }
    };
  }, [abierto]);
}
