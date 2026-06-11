// =============================================
// ARCHIVO: routes/salud.js
// FUNCIÓN: Endpoints para obtener salud del negocio
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const { verificarToken } = require('../middleware/auth');

// -----------------------------------------------
// POST /api/salud/error-frontend
// Recibe errores de pantalla reportados automáticamente por el ErrorBoundary.
// SIN token obligatorio (el error puede ocurrir antes del login); si hay token
// se usa para asociar negocio/usuario. Protegido por el rate limit global.
// -----------------------------------------------
router.post('/error-frontend', async (req, res) => {
    try {
        const { mensaje, stack, url } = req.body || {};
        if (!mensaje) return res.status(400).json({ ok: false });

        // Identificar usuario/negocio si viene token (opcional)
        let negocio_id = null, usuario_id = null;
        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
                negocio_id = decoded.negocio_id || null;
                usuario_id = decoded.id || null;
            } catch {}
        }

        await db.query(`
            INSERT INTO errores_frontend (negocio_id, usuario_id, mensaje, stack, url, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            negocio_id,
            usuario_id,
            String(mensaje).slice(0, 1000),
            String(stack || '').slice(0, 4000),
            String(url || '').slice(0, 500),
            String(req.headers['user-agent'] || '').slice(0, 300),
        ]);

        console.error(`💥 Error frontend reportado [negocio ${negocio_id ?? '-'}]: ${String(mensaje).slice(0, 200)}`);
        res.json({ ok: true });
    } catch (error) {
        // Nunca romper por el propio reporte de errores
        res.json({ ok: false });
    }
});

router.use(verificarToken);

// GET /api/salud (del negocio actual del usuario)
router.get('/', async (req, res) => {
    try {
        const negocio_id = req.usuario?.negocio_id;

        // Si no existe un negocio asociado (por ejemplo superadmin), devolvemos datos vacíos
        if (!negocio_id) {
            return res.json({
                negocio: null,
                transacciones_hoy: 0,
                usuarios_activos_hoy: 0,
                estado: 'sin_negocio',
                almacenamiento: {}
            });
        }

        // Obtener datos de salud
        const negocio = await db.query(`
            SELECT id, nombre, ultima_actividad, errores_24h FROM negocios WHERE id = $1
        `, [negocio_id]);

        if (!negocio.rows[0]) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        const n = negocio.rows[0];

        // Calcular días sin actividad
        const ultimaActividad = n.ultima_actividad ? new Date(n.ultima_actividad) : null;
        const diasSinActividad = ultimaActividad 
            ? Math.floor((new Date() - ultimaActividad) / (1000 * 60 * 60 * 24))
            : null;

        // Contar transacciones de hoy
        const ventas = await db.query(`
            SELECT COUNT(*) as total FROM ventas 
            WHERE negocio_id = $1 
            AND DATE(fecha) = CURRENT_DATE
        `, [negocio_id]);

        // Usuarios activos hoy
        const usuarios = await db.query(`
            SELECT COUNT(DISTINCT usuario_id) as total FROM salud_negocio
            WHERE negocio_id = $1 
            AND tipo_evento IN ('venta', 'login')
            AND DATE(fecha) = CURRENT_DATE
        `, [negocio_id]);

        // Almacenamiento usado (agrupado por tabla del negocio)
        const almacenamiento = await db.query(`
            SELECT 
                pg_size_pretty(pg_total_relation_size('ventas')) as ventas_size,
                pg_size_pretty(pg_total_relation_size('productos')) as productos_size,
                pg_size_pretty(pg_total_relation_size('gastos')) as gastos_size
        `);

        res.json({
            negocio: {
                id: n.id,
                nombre: n.nombre,
                ultima_actividad: n.ultima_actividad,
                dias_sin_actividad: diasSinActividad,
                errores_24h: n.errores_24h || 0
            },
            transacciones_hoy: parseInt(ventas.rows[0]?.total) || 0,
            usuarios_activos_hoy: parseInt(usuarios.rows[0]?.total) || 0,
            estado: diasSinActividad === null ? 'nunca_usado' : diasSinActividad > 7 ? 'inactivo' : 'activo',
            almacenamiento: almacenamiento.rows[0]
        });
    } catch (error) {
        console.error('Error al obtener salud del negocio:', error);
        res.status(500).json({ error: error.message || 'Error al obtener salud del negocio' });
    }
});

module.exports = router;
