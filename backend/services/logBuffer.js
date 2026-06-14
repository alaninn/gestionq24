// =============================================
// SERVICIO: Buffer de logs en memoria
// Captura los console.log/warn/error del servidor en un buffer circular
// chico (~400 líneas ≈ 100KB) para poder verlos desde el panel SuperAdmin
// sin depender de archivos ni consumir memoria significativa.
// =============================================

const MAX_LINEAS = 400;
const buffer = [];
let contador = 0;

function formatear(args) {
    try {
        return args.map(a => {
            if (typeof a === 'string') return a;
            if (a instanceof Error) return a.stack || a.message;
            try { return JSON.stringify(a); } catch { return String(a); }
        }).join(' ').slice(0, 600);
    } catch {
        return '[no se pudo formatear el log]';
    }
}

function registrar(nivel, args) {
    buffer.push({
        id: ++contador,
        fecha: new Date().toISOString(),
        nivel,
        mensaje: formatear(args),
    });
    if (buffer.length > MAX_LINEAS) buffer.shift();
}

/** Intercepta console.* para alimentar el buffer (la salida original no cambia) */
function instalar() {
    const log = console.log.bind(console);
    const warn = console.warn.bind(console);
    const error = console.error.bind(console);

    console.log = (...a) => { registrar('info', a); log(...a); };
    console.warn = (...a) => { registrar('warn', a); warn(...a); };
    console.error = (...a) => { registrar('error', a); error(...a); };
}

/** Devuelve las líneas posteriores a un id (para polling incremental) */
function obtenerDesde(desdeId = 0) {
    const lineas = buffer.filter(l => l.id > desdeId);
    return {
        lineas,
        ultimoId: buffer.length > 0 ? buffer[buffer.length - 1].id : desdeId,
    };
}

/** Vacía el buffer en memoria (p. ej. después de subir el reporte de errores) */
function limpiar() {
    buffer.length = 0;
}

module.exports = { instalar, obtenerDesde, limpiar };
