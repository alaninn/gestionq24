// =============================================
// ARCHIVO: routes/auth.js
// FUNCIÓN: Login, logout y verificación de sesión
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');

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

      // Buscamos solo por username
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
        `, [username, password]);

        if (resultado.rows.length === 0) {
            // Registrar intento fallido
            const attempts = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: now };
            attempts.count++;
            attempts.lastAttempt = now;
            loginAttempts.set(attemptKey, attempts);
            
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        const usuario = resultado.rows[0];

        // Si no es superadmin, verificamos que el negocio esté activo
        if (usuario.rol !== 'superadmin') {
            if (usuario.negocio_estado === 'bloqueado') {
                return res.status(403).json({ 
                    error: 'Tu cuenta está bloqueada. Contactá al administrador.' 
                });
            }
            if (usuario.negocio_estado === 'vencido' || 
                (usuario.fecha_vencimiento && new Date(usuario.fecha_vencimiento) < new Date())) {
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
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
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
                (usuario.fecha_vencimiento && new Date(usuario.fecha_vencimiento) < new Date())) {
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