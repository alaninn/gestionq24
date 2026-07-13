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

// Día comercial (YYYY-MM-DD, hora Argentina) al que pertenece una apertura.
// corteHora = 0: día calendario (cambia a la medianoche). corteHora 1..23: las
// aperturas a partir de esa hora cuentan para el día siguiente (turno noche).
export const diaComercial = (fecha, corteHora = 0) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(new Date(fecha));
  const val = (t) => partes.find(p => p.type === t)?.value;
  let y = Number(val('year')), m = Number(val('month')), d = Number(val('day'));
  let h = Number(val('hour'));
  if (h === 24) h = 0;
  if (corteHora > 0 && h >= corteHora) {
    const sig = new Date(Date.UTC(y, m - 1, d + 1));
    y = sig.getUTCFullYear(); m = sig.getUTCMonth() + 1; d = sig.getUTCDate();
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

// Momento (Date) en que termina el día comercial de una apertura. AR es UTC-3
// fija: AR HH:00 = UTC (HH+3):00.
export const finDiaComercial = (fecha, corteHora = 0) => {
  const D = diaComercial(fecha, corteHora);
  let [y, m, d] = D.split('-').map(Number);
  let horaFin;
  if (corteHora > 0) {
    horaFin = corteHora;
  } else {
    const sig = new Date(Date.UTC(y, m - 1, d + 1));
    y = sig.getUTCFullYear(); m = sig.getUTCMonth() + 1; d = sig.getUTCDate();
    horaFin = 0;
  }
  return new Date(Date.UTC(y, m - 1, d, horaFin + 3, 0, 0));
};