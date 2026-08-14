// =============================================
// Config global del sistema (fila unica id=1 en config_sistema).
// Guarda el interruptor de la capa de revendedores y los defaults de tokens.
// Cacheado 60 s para no pegarle a la BD en cada request. Ante error de BD o
// tabla inexistente devuelve valores por defecto con revendedores APAGADO, asi
// nada del flujo actual se rompe si la migracion todavia no corrio.
// =============================================

const db = require('../config/database');

const DEFAULTS = {
    revendedores_habilitado: false,
    precio_token: 20000,
    dias_por_token: 30,
};

let cache = null;
let cacheTs = 0;
const TTL_MS = 60000;

async function getConfigSistema() {
    const ahora = Date.now();
    if (cache && ahora - cacheTs < TTL_MS) return cache;
    try {
        const r = await db.query(
            'SELECT revendedores_habilitado, precio_token, dias_por_token FROM config_sistema WHERE id = 1'
        );
        cache = r.rows[0] ? { ...DEFAULTS, ...r.rows[0] } : { ...DEFAULTS };
    } catch (e) {
        // Tabla inexistente / error de BD: revendedores queda apagado (seguro).
        cache = { ...DEFAULTS };
    }
    cacheTs = ahora;
    return cache;
}

async function revendedoresHabilitado() {
    const c = await getConfigSistema();
    return c.revendedores_habilitado === true;
}

// Para aplicar cambios al instante cuando el maestro toca la config.
function invalidarCacheConfigSistema() {
    cache = null;
    cacheTs = 0;
}

module.exports = { getConfigSistema, revendedoresHabilitado, invalidarCacheConfigSistema };
