// =============================================
// ARCHIVO: routes/salud.js
// FUNCIÓN: Endpoints para obtener salud del negocio
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/salud (del negocio actual del usuario)
router.get('/', async (req, res) => {
    try {
        const negocio_id = req.user.negocio_id;
        
        if (!negocio_id) {
            return res.status(403).json({ error: 'No tienes negocio asignado' });
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
            AND DATE(created_at) = CURRENT_DATE
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
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener salud del negocio' });
    }
});

module.exports = router;
