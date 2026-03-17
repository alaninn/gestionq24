const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Acceso denegado. No hay token.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded;
        req.negocio_id = decoded.negocio_id;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
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

module.exports = { verificarToken, soloSuperadmin, soloAdmin, verificarPermiso };