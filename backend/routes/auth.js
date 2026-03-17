// =============================================
// ARCHIVO: routes/auth.js
// FUNCIÓN: Login, logout y verificación de sesión
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');

// -----------------------------------------------
// RUTA: POST /api/auth/login
// FUNCIÓN: Iniciar sesión
// -----------------------------------------------
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
        }

        // Buscamos el usuario y verificamos la contraseña con pgcrypto
        const resultado = await db.query(`
            SELECT 
                u.*,
                n.nombre AS negocio_nombre,
                n.estado AS negocio_estado,
                n.fecha_vencimiento,
                n.plan
            FROM usuarios u
            LEFT JOIN negocios n ON u.negocio_id = n.id
            WHERE u.email = $1 
              AND u.activo = TRUE
              AND u.password_hash = crypt($2, u.password_hash)
        `, [email, password]);

        if (resultado.rows.length === 0) {
            return res.status(401).json({ error: 'Email o contraseña incorrectos' });
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
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

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

        // Traemos los datos actualizados del usuario
        const resultado = await db.query(`
            SELECT 
                u.*,
                n.nombre AS negocio_nombre,
                n.estado AS negocio_estado,
                n.fecha_vencimiento
            FROM usuarios u
            LEFT JOIN negocios n ON u.negocio_id = n.id
            WHERE u.id = $1 AND u.activo = TRUE
        `, [decoded.id]);

        if (resultado.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const usuario = resultado.rows[0];
        res.json({
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            negocio_id: usuario.negocio_id,
            negocio_nombre: usuario.negocio_nombre,
            permisos: usuario.permisos,
        });

    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
});

module.exports = router;