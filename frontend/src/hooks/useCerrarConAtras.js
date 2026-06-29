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

// Cuando un modal se cierra "por código" (✕ / Cancelar / pasar a otro modal),
// consume su entrada de historial con history.back(). Ese back() genera un
// popstate; si en el mismo momento se abrió OTRO modal, su listener capturaría
// ese popstate por error y lo cerraría de inmediato (caso: cerrar "detalle" y
// abrir "renovar/días/historial" a la vez). Este flag global marca ese popstate
// "de consumo" para que se ignore una sola vez.
let consumiendoEntrada = false;

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
      // Si este popstate vino de "consumir" la entrada de otro modal que se
      // cerró por código, lo ignoramos (no es un "atrás" real del usuario).
      if (consumiendoEntrada) {
        consumiendoEntrada = false;
        return;
      }
      cerradoPorAtras.current = true;
      cerrarRef.current();
    };

    window.addEventListener('popstate', alVolver);
    return () => {
      window.removeEventListener('popstate', alVolver);
      // Si el modal se cerró con ✕ / Cancelar / guardar (no con "atrás"),
      // consumimos la entrada extra para no ensuciar el historial.
      if (!cerradoPorAtras.current) {
        consumiendoEntrada = true;
        window.history.back();
        // Failsafe: si por algún motivo no llega el popstate, reseteamos el flag
        // para no swallowear un "atrás" real posterior.
        setTimeout(() => { consumiendoEntrada = false; }, 100);
      }
    };
  }, [abierto]);
}
