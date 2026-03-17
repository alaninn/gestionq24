// Obtiene la fecha local de Argentina como string YYYY-MM-DD
export const hoyArgentina = () => {
  const ahora = new Date();
  return new Date(ahora - ahora.getTimezoneOffset() * 60000)
    .toISOString().split('T')[0];
};

// Convierte cualquier fecha a string YYYY-MM-DD en hora argentina
export const fechaArgentina = (fecha) => {
  const d = new Date(fecha);
  return new Date(d - d.getTimezoneOffset() * 60000)
    .toISOString().split('T')[0];
};

// Formatea una fecha para mostrar en pantalla
export const formatearFecha = (fecha) => {
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  });
};