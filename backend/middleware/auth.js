const jwt = require('jsonwebtoken');
const db = require('../config/database');

// -----------------------------------------------
// Estado del negocio (bloqueado / vencido) con cache corto.
// Se consulta en cada request autenticado para que el corte por vencimiento sea
// en tiempo (casi) real y no quede la ventana de gracia del token de 24 hs.
// El cache (30 s) evita pegarle a la BD en cada request. Ante error de BD se
// devuelve null (fail-open): nada debe bloquear el trabajo por un problema de red.
// -----------------------------------------------
const cacheNegocio = new Map(); // negocio_id -> { estado, venc, ts }
const TTL_MS = 30000;

async function estadoNegocio(negocioId) {
    if (!negocioId) return null;
    try {
        const ahora = Date.now();
        const cache = cacheNegocio.get(negocioId);
        if (cache && ahora - cache.ts < TTL_MS) return cache;

        const r = await db.query(
            'SELECT estado, fecha_vencimiento FROM negocios WHERE id = $1',
            [negocioId]
        );
        const fila = r.rows[0] || {};
        const dato = { estado: fila.estado || null, venc: fila.fecha_vencimiento || null, ts: ahora };
        cacheNegocio.set(negocioId, dato);
        return dato;
    } catch (e) {
        return null; // fail-open ante error de BD
    }
}

// Para invalidar el cache al renovar/bloquear/desbloquear desde el superadmin,
// así el cambio aplica al instante (sin esperar el TTL).
function invalidarCacheNegocio(negocioId) {
    if (negocioId != null) cacheNegocio.delete(parseInt(negocioId));
}

const verificarToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Acceso denegado. No hay token.' });
    }
    const token = authHeader.split(' ')[1];

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    req.usuario = decoded;

    // Si es superadmin accediendo a otro negocio, usar ese negocio_id
    const negocioIdHeader = req.headers['x-negocio-id'];
    if (decoded.rol === 'superadmin' && negocioIdHeader) {
        req.negocio_id = parseInt(negocioIdHeader);
    } else {
        req.negocio_id = decoded.negocio_id;
    }

    // Verificaciones de negocio (excepto superadmin)
    if (decoded.rol !== 'superadmin') {
        const validPlans = ['estandar', 'premium'];
        if (!validPlans.includes(decoded.plan)) {
            return res.status(403).json({
                error: 'El plan de tu negocio no es válido. Contactá al administrador.'
            });
        }

        // Corte por bloqueo / vencimiento en (casi) tiempo real.
        const est = await estadoNegocio(req.negocio_id);
        if (est) {
            if (est.estado === 'bloqueado') {
                return res.status(403).json({ error: 'Tu cuenta está bloqueada. Contactá al administrador.' });
            }
            if (est.estado === 'vencido' || (est.venc && new Date(est.venc) < new Date())) {
                return res.status(403).json({ error: 'Tu suscripción ha vencido. Contactá al administrador.' });
            }
        }
    }

    next();
};

const soloSuperadmin = (req, res, next) => {
    if (req.usuario.rol !== 'superadmin') {
        return res.status(403).json({ error: 'Acceso denegado. Solo superadmin.' });
    }
    next();
};

const soloAdmin = (req, res, next) => {
    if (!['superadmin', 'admin'].includes(req.usuario.rol)) {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere rol admin.' });
    }
    next();
};

// ---- MIDDLEWARE PRINCIPAL DE PERMISOS ----
// Uso: verificarPermiso('productos', 'crear')
const verificarPermiso = (modulo, accion) => {
    return (req, res, next) => {
        const { rol, permisos } = req.usuario;

        // Superadmin y admin tienen acceso total
        if (rol === 'superadmin' || rol === 'admin') return next();

        // Verificamos en los permisos del usuario
        const permisosUsuario = typeof permisos === 'string'
            ? JSON.parse(permisos)
            : (permisos || {});

        if (permisosUsuario[modulo]?.includes(accion)) return next();

        return res.status(403).json({
            error: `No tenés permiso para ${accion} en ${modulo}`
        });
    };
};

module.exports = { verificarToken, soloSuperadmin, soloAdmin, verificarPermiso, invalidarCacheNegocio };