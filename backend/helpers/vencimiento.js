// Un negocio queda vencido recién cuando el día de vencimiento YA PASÓ: puede usar
// el sistema durante TODO el día de la fecha de vencimiento y el corte ocurre al
// comenzar el día siguiente. La fecha_vencimiento es un DATE (sin hora).
// El proceso corre en hora Argentina, así que los métodos locales de Date son AR.
function diaVencido(fechaVencimiento) {
    if (!fechaVencimiento) return false;
    const v = new Date(fechaVencimiento);
    // 00:00 (hora local/AR) del día siguiente al vencimiento = instante de corte.
    const corte = new Date(v.getFullYear(), v.getMonth(), v.getDate() + 1).getTime();
    return Date.now() >= corte;
}

module.exports = { diaVencido };
