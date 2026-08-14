// =============================================
// ARCHIVO: routes/auth.js
// FUNCIÓN: Login, logout y verificación de sesión
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const { diaVencido } = require('../helpers/vencimiento');

// Lee el token de dispositivo (header x-device-token). Ese token se emite en el
// Paso 1 (acceso del negocio) y deja el equipo fijado a un negocio. Devuelve el
// negocio_id si es válido, o null si no vino o no es válido.
function negocioDelDispositivo(req) {
    const t = req.headers['x-device-token'];
    if (!t) return null;
    try {
        const dec = jwt.verify(t, process.env.JWT_SECRET);
        if (dec && dec.tipo === 'dispositivo' && dec.negocio_id) return dec.negocio_id;
    } catch (e) { /* token inválido o vencido → se ignora */ }
    return null;
}

// Cache simple para rate limiting de login
// ADVERTENCIA: loginAttempts vive en memoria. Si el servidor se reinicia,
// todos los contadores se resetean. En producción reemplazar por Redis:
// const redis = require("redis"); const client = redis.createClient();
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos

// Función para limpiar intentos expirados
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of loginAttempts.entries()) {
        if (now - data.lastAttempt > LOGIN_LOCKOUT_TIME) {
            loginAttempts.delete(key);
        }
    }
}, 60000); // Limpiar cada minuto

// -----------------------------------------------
// RUTA: POST /api/auth/login
// FUNCIÓN: Iniciar sesión con rate limiting
// -----------------------------------------------
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;
        const attemptKey = `${clientIP}-${username}`;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
        }

        // Verificar rate limiting
        const now = Date.now();
        const attempts = loginAttempts.get(attemptKey);
        
        if (attempts) {
            if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
                const timeLeft = Math.ceil((LOGIN_LOCKOUT_TIME - (now - attempts.lastAttempt)) / 1000 / 60);
                return res.status(429).json({ 
                    error: `Demasiados intentos fallidos. Intentá de nuevo en ${timeLeft} minutos.` 
                });
            }
        }

        // Si el equipo está fijado a un negocio (Paso 1), scopeamos el login a ese
        // negocio: así dos negocios pueden tener el mismo "caja1" sin pisarse. Si no
        // hay token de dispositivo, se mantiene el login global (compatibilidad).
        const negocioFijado = negocioDelDispositivo(req);
        const valores = [username, password];
        let filtroNegocio = '';
        if (negocioFijado) {
            valores.push(negocioFijado);
            // El superadmin entra siempre, aunque el equipo esté fijado a un negocio.
            filtroNegocio = " AND (u.negocio_id = $3 OR u.rol = 'superadmin')";
        }

        const resultado = await db.query(`
            SELECT
                u.*,
                n.nombre AS negocio_nombre,
                n.estado AS negocio_estado,
                n.fecha_vencimiento,
                n.plan
            FROM usuarios u
            LEFT JOIN negocios n ON u.negocio_id = n.id
            WHERE u.username = $1
              AND u.activo = TRUE
              AND u.password_hash = crypt($2, u.password_hash)
              ${filtroNegocio}
        `, valores);

        if (resultado.rows.length === 0) {
            // Registrar intento fallido
            const attempts = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: now };
            attempts.count++;
            attempts.lastAttempt = now;
            loginAttempts.set(attemptKey, attempts);
            
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const usuario = resultado.rows[0];

// Si no es superadmin, verificamos que el negocio esté activo y tenga plan válido
        if (usuario.rol !== 'superadmin') {
            // Validar tipo de plan
            const validPlans = ['estandar', 'premium'];
            if (!validPlans.includes(usuario.plan)) {
                return res.status(403).json({ 
                    error: 'El plan de tu negocio no es válido. Contactá al administrador.' 
                });
            }

            // Verificar estado del negocio (aplica a todos los planes)
            if (usuario.negocio_estado === 'bloqueado') {
                return res.status(403).json({ 
                    error: 'Tu cuenta está bloqueada. Contactá al administrador.' 
                });
            }
            if (usuario.negocio_estado === 'vencido' ||
                diaVencido(usuario.fecha_vencimiento)) {
                return res.status(403).json({ 
                    error: 'Tu suscripción ha vencido. Contactá al administrador.' 
                });
            }
        }

        // Actualizamos último acceso
        await db.query(
            'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1',
            [usuario.id]
        );

        // Generamos el token JWT
        // El token contiene la info del usuario y dura 24 horas
        const token = jwt.sign(
            {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                rol: usuario.rol,
                negocio_id: usuario.negocio_id,
                negocio_nombre: usuario.negocio_nombre,
                permisos: usuario.permisos,
                plan: usuario.plan || null,
                estado: usuario.negocio_estado || null,
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Login exitoso - limpiar intentos fallidos
        loginAttempts.delete(attemptKey);

        // Enviamos el token y los datos del usuario
        res.json({
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol,
                negocio_id: usuario.negocio_id,
                negocio_nombre: usuario.negocio_nombre,
                permisos: usuario.permisos,
                plan: usuario.plan || null,
                negocio_estado: usuario.negocio_estado || null,
                fecha_vencimiento: usuario.fecha_vencimiento || null,
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// -----------------------------------------------
// RUTA: POST /api/auth/acceso-negocio  (Paso 1)
// FUNCIÓN: El dueño/admin ingresa con su mail + contraseña para "fijar" el negocio
//          en esta PC. Devuelve los datos del negocio y un token de dispositivo que
//          el equipo guarda; con ese token, el Paso 2 (login de usuarios) queda
//          scopeado a este negocio.
// -----------------------------------------------
router.post('/acceso-negocio', async (req, res) => {
    try {
        const { email, password, slug } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;
        const attemptKey = `negocio-${clientIP}-${(email || '').toLowerCase()}`;

        if (!email || !password) {
            return res.status(400).json({ error: 'Mail y contraseña son obligatorios' });
        }

        // Rate limiting (mismo esquema que el login)
        const now = Date.now();
        const attempts = loginAttempts.get(attemptKey);
        if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS) {
            const timeLeft = Math.ceil((LOGIN_LOCKOUT_TIME - (now - attempts.lastAttempt)) / 1000 / 60);
            return res.status(429).json({ error: `Demasiados intentos. Probá de nuevo en ${timeLeft} minutos.` });
        }

        // Aislamiento marca blanca: si llega un slug de revendedor (acceso por
        // /r/<slug>), la busqueda del negocio se limita a los negocios de ESE
        // revendedor. Sin slug, se limita a los negocios directos del maestro
        // (revendedor_id IS NULL), que es exactamente el comportamiento actual
        // (hoy todos los negocios son directos). Asi no hay ambiguedad de email
        // entre distintos revendedores.
        const valores = [email, password];
        let filtroDueno = ' AND n.revendedor_id IS NULL';
        if (slug) {
            const rev = await db.query(
                'SELECT id FROM revendedores WHERE slug = $1 AND activo = TRUE',
                [slug]
            ).catch(() => ({ rows: [] }));
            if (!rev.rows[0]) {
                return res.status(401).json({ error: 'Mail o contraseña incorrectos' });
            }
            valores.push(rev.rows[0].id);
            filtroDueno = ' AND n.revendedor_id = $3';
        }

        // El acceso del negocio se abre con el mail del negocio y la contraseña del
        // portal (la conocen todos los usuarios). Esa contraseña es distinta de la
        // del administrador. Traemos el negocio por el mail del admin y verificamos
        // la contraseña del portal; si el negocio todavia no configuro una contraseña
        // de portal, se acepta la del admin (compatibilidad, para no bloquear el acceso).
        const r = await db.query(`
            SELECT u.negocio_id, u.rol,
                   n.nombre AS negocio_nombre, n.estado AS negocio_estado,
                   n.fecha_vencimiento, n.plan, n.color_primario,
                   (n.password_portal_hash IS NOT NULL) AS tiene_portal,
                   (n.password_portal_hash IS NOT NULL
                        AND n.password_portal_hash = crypt($2, n.password_portal_hash)) AS portal_ok,
                   (u.password_hash = crypt($2, u.password_hash)) AS admin_ok
            FROM usuarios u
            JOIN negocios n ON u.negocio_id = n.id
            WHERE LOWER(u.email) = LOWER($1)
              AND u.activo = TRUE
              AND u.rol = 'admin'
              ${filtroDueno}
            LIMIT 1
        `, valores);

        const fila = r.rows[0];
        // Contraseña válida: la del portal si está configurada; si no, la del admin.
        const passwordValida = fila && (fila.portal_ok || (!fila.tiene_portal && fila.admin_ok));

        if (!passwordValida) {
            const a = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: now };
            a.count++; a.lastAttempt = now;
            loginAttempts.set(attemptKey, a);
            return res.status(401).json({ error: 'Mail o contraseña incorrectos' });
        }

        const neg = fila;

        // Estado del negocio (mismo criterio que el login)
        if (!['estandar', 'premium'].includes(neg.plan)) {
            return res.status(403).json({ error: 'El plan del negocio no es válido. Contactá al administrador.' });
        }
        if (neg.negocio_estado === 'bloqueado') {
            return res.status(403).json({ error: 'El negocio está bloqueado. Contactá al administrador.' });
        }
        if (neg.negocio_estado === 'vencido' ||
            diaVencido(neg.fecha_vencimiento)) {
            return res.status(403).json({ error: 'La suscripción del negocio venció. Contactá al administrador.' });
        }

        loginAttempts.delete(attemptKey);

        // Token de dispositivo: deja el equipo fijado a este negocio (no es una sesión
        // de usuario). Dura bastante para que la PC quede "fija".
        const deviceToken = jwt.sign(
            { tipo: 'dispositivo', negocio_id: neg.negocio_id },
            process.env.JWT_SECRET,
            { expiresIn: '180d' }
        );

        res.json({
            deviceToken,
            negocio: {
                id: neg.negocio_id,
                nombre: neg.negocio_nombre,
                color_primario: neg.color_primario || '#f97316',
            }
        });
    } catch (error) {
        console.error('Error en acceso-negocio:', error);
        res.status(500).json({ error: 'Error al acceder al negocio' });
    }
});

// -----------------------------------------------
// RUTA: POST /api/auth/login-revendedor
// FUNCIÓN: Login de la capa de revendedores (marca blanca). Separado del login
//          de negocios para no tocar ese flujo. Solo funciona si la capa de
//          revendedores está habilitada en la config global (modo apagado por
//          defecto). Emite un JWT con rol 'revendedor'.
// -----------------------------------------------
router.post('/login-revendedor', async (req, res) => {
    try {
        const { email, password } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;
        const attemptKey = `rev-${clientIP}-${(email || '').toLowerCase()}`;

        if (!email || !password) {
            return res.status(400).json({ error: 'Mail y contraseña son obligatorios' });
        }

        // Interruptor global: si la capa está apagada, no existe el login.
        const { revendedoresHabilitado } = require('../helpers/configSistema');
        if (!(await revendedoresHabilitado())) {
            return res.status(404).json({ error: 'No disponible' });
        }

        const now = Date.now();
        const attempts = loginAttempts.get(attemptKey);
        if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS) {
            const timeLeft = Math.ceil((LOGIN_LOCKOUT_TIME - (now - attempts.lastAttempt)) / 1000 / 60);
            return res.status(429).json({ error: `Demasiados intentos. Probá de nuevo en ${timeLeft} minutos.` });
        }

        const r = await db.query(`
            SELECT id, nombre, email, activo,
                   marca_nombre, marca_color, slug,
                   (password_hash = crypt($2, password_hash)) AS pass_ok
            FROM revendedores
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
        `, [email, password]);

        const rev = r.rows[0];
        if (!rev || !rev.pass_ok) {
            const a = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: now };
            a.count++; a.lastAttempt = now;
            loginAttempts.set(attemptKey, a);
            return res.status(401).json({ error: 'Mail o contraseña incorrectos' });
        }

        if (!rev.activo) {
            return res.status(403).json({ error: 'Tu cuenta de revendedor está desactivada. Contactá al administrador.' });
        }

        loginAttempts.delete(attemptKey);

        const token = jwt.sign(
            {
                tipo: 'revendedor',
                revendedor_id: rev.id,
                rol: 'revendedor',
                nombre: rev.nombre,
                email: rev.email,
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            revendedor: {
                id: rev.id,
                nombre: rev.nombre,
                email: rev.email,
                marca_nombre: rev.marca_nombre || null,
                marca_color: rev.marca_color || '#f97316',
                slug: rev.slug || null,
            }
        });
    } catch (error) {
        console.error('Error en login-revendedor:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// Función auxiliar para registrar intento fallido (se usa internamente)
const registrarIntentoFallido = (req) => {
    const { username } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    const attemptKey = `${clientIP}-${username}`;
    const now = Date.now();
    
    const attempts = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: now };
    attempts.count++;
    attempts.lastAttempt = now;
    loginAttempts.set(attemptKey, attempts);
};

// registrarIntentoFallido no se exporta — la lógica ya está inline en el endpoint

// -----------------------------------------------
// RUTA: GET /api/auth/me
// FUNCIÓN: Verificar token y traer datos del usuario
// -----------------------------------------------
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No hay token' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Capa de revendedores: el token no pertenece a un usuario de negocio.
        if (decoded.rol === 'revendedor') {
            const negocioIdHeader = req.headers['x-negocio-id'];
            if (!negocioIdHeader) {
                // Sin impersonar: identidad del propio revendedor.
                return res.json({
                    rol: 'revendedor',
                    revendedor_id: decoded.revendedor_id,
                    nombre: decoded.nombre || null,
                    email: decoded.email || null,
                });
            }
            // Impersonando un negocio: validamos pertenencia y devolvemos una
            // identidad tipo admin de ESE negocio, para reutilizar el panel admin.
            const ng = await db.query(`
                SELECT id, nombre, estado, fecha_vencimiento, plan
                FROM negocios WHERE id = $1 AND revendedor_id = $2
            `, [parseInt(negocioIdHeader), decoded.revendedor_id]);
            if (!ng.rows[0]) {
                return res.status(403).json({ error: 'No tenés acceso a ese negocio.' });
            }
            const neg = ng.rows[0];
            return res.json({
                id: null,
                rol: 'admin',
                nombre: decoded.nombre || 'Revendedor',
                email: decoded.email || null,
                negocio_id: neg.id,
                negocio_nombre: neg.nombre,
                permisos: {},
                plan: neg.plan,
                fecha_vencimiento: neg.fecha_vencimiento,
                impersonado_por_revendedor: true,
            });
        }

        // Traemos los datos actualizados del usuario incluyendo estado del negocio
        const resultado = await db.query(`
            SELECT 
                u.id, u.nombre, u.email, u.rol,
                u.negocio_id, u.permisos, u.activo,
                n.nombre AS negocio_nombre,
                n.estado AS negocio_estado,
                n.fecha_vencimiento,
                n.plan
            FROM usuarios u
            LEFT JOIN negocios n ON u.negocio_id = n.id
            WHERE u.id = $1 AND u.activo = TRUE
        `, [decoded.id]);

        if (resultado.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
        }

        const usuario = resultado.rows[0];

        // Verificar que el negocio siga activo (excepto superadmin)
        if (usuario.rol !== 'superadmin') {
            if (usuario.negocio_estado === 'bloqueado') {
                return res.status(403).json({ error: 'Tu cuenta está bloqueada.' });
            }
            if (usuario.negocio_estado === 'vencido' ||
                diaVencido(usuario.fecha_vencimiento)) {
                return res.status(403).json({ error: 'Tu suscripción ha vencido.' });
            }
        }

        res.json({
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            negocio_id: usuario.negocio_id,
            negocio_nombre: usuario.negocio_nombre,
            permisos: usuario.permisos,
            fecha_vencimiento: usuario.fecha_vencimiento,
            plan: usuario.plan,
        });

    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
});

module.exports = router;