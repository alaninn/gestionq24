// =============================================
// HOOK: useCerrarConAtras
// Hace que el botón "atrás" del celular cierre el modal en vez de salir de la
// página. Robusto ante varios modales abiertos/encadenados (abrir uno mientras se
// cierra otro), que antes desincronizaba el historial y podía navegar la página.
//
// Diseño: un ÚNICO listener global de popstate + una pila (stack) de modales
// abiertos + UNA sola entrada de historial "modal" mientras haya al menos un modal.
//   - "Atrás" del usuario  → cierra el modal de más arriba; si quedan, re-arma.
//   - Cierre por código (✕/Cancelar/cambio de modal) → consume su entrada solo si
//     era el último modal; los cierres "de consumo" se cuentan (contador, no flag)
//     para tolerar cierres/aperturas solapados.
//
// Uso:  useCerrarConAtras(mostrarModal, () => setMostrarModal(false));
// =============================================

import { useEffect, useRef } from 'react';

const stack = [];       // [{ cerrar }]  — el último es el de más arriba
let armado = false;     // ¿hay una entrada de historial "modal" puesta?
let ignorar = 0;        // popstates "de consumo" pendientes de ignorar (cierres por código)
let listenerPuesto = false;

function armar() {
  if (!armado) {
    window.history.pushState({ modalAbierto: true }, '');
    armado = true;
  }
}

function alVolver() {
  // Popstate "de consumo" (generado por un history.back() de un cierre por código).
  if (ignorar > 0) { ignorar--; return; }
  // "Atrás" real del usuario: el navegador ya consumió nuestra entrada.
  armado = false;
  const top = stack[stack.length - 1];
  if (!top) return;
  // Si quedan más modales debajo, re-armamos la entrada para seguir capturando.
  if (stack.length > 1) armar();
  top.cerrar();
}

export default function useCerrarConAtras(abierto, onCerrar) {
  // Ref para usar siempre la última versión del callback sin re-suscribir.
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    if (!abierto) return;
    if (!listenerPuesto) { window.addEventListener('popstate', alVolver); listenerPuesto = true; }

    let cerradoPorAtras = false;
    const entry = { cerrar: () => { cerradoPorAtras = true; cerrarRef.current(); } };
    stack.push(entry);
    armar();

    return () => {
      const idx = stack.indexOf(entry);
      if (idx >= 0) stack.splice(idx, 1);
      if (cerradoPorAtras) return; // ya lo manejó alVolver (atrás real)
      // Cierre por código: solo consumimos la entrada si era el último modal.
      if (stack.length === 0 && armado) {
        armado = false;
        // PROTECCION: solo volvemos atras si la entrada ACTUAL del historial es la
        // nuestra (marca modalAbierto). Asi, ante cualquier desincronizacion, es
        // imposible navegar la pagina real (ese era el sintoma: caia en /login o /admin).
        if (window.history.state && window.history.state.modalAbierto) {
          ignorar++;
          window.history.back();
        }
      }
      // Si quedan modales abiertos, la entrada sigue armada: no tocamos el historial.
    };
  }, [abierto]);
}
