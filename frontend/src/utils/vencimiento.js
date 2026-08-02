// Helpers de vencimiento de suscripción, compartidos entre el panel superadmin
// y el panel "Mis negocios" del usuario multinegocio.

// Días restantes hasta la fecha de vencimiento (0 si ya venció o no hay fecha).
export function diasRestantes(fecha) {
  if (!fecha) return 0;
  const diff = new Date(fecha) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// Fecha formateada es-AR (o '-' si no hay).
export function fmtFecha(f) {
  return f ? new Date(f).toLocaleDateString('es-AR') : '-';
}

// Clase de color Tailwind según los días restantes (rojo <=5, naranja <=10, verde).
export function colorVencimiento(dias) {
  if (dias <= 0) return 'text-red-600';
  if (dias <= 5) return 'text-red-600';
  if (dias <= 10) return 'text-orange-600';
  return 'text-green-600';
}
