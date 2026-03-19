// =============================================
// ARCHIVO: routes/soporte.js
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/soporte/tickets - Obtener tickets del negocio actual
router.get('/tickets', async (req, res) => {
    try {
        const negocio_id = req.usuario?.negocio_id;

        const resultado = await db.query(`
            SELECT t.*, u.nombre as usuario_nombre
            FROM tickets_soporte t
            LEFT JOIN usuarios u ON u.id = t.usuario_id
            WHERE t.negocio_id = $1
            ORDER BY t.fecha_creacion DESC
        `, [negocio_id]);

        res.json(resultado.rows);
    } catch (error) {
        console.error('Error al obtener tickets:', error);
        res.status(500).json({
            error: error.message || 'Error al obtener tickets',
            code: error.code || null,
            detail: error.detail || null,
        });
    }
});

// POST /api/soporte/tickets - Crear nuevo ticket
router.post('/tickets', async (req, res) => {
    try {
        const { titulo, descripcion, categoria } = req.body;
        const negocio_id = req.usuario?.negocio_id;
        const usuario_id = req.usuario?.id;

        if (!titulo || !descripcion) {
            return res.status(400).json({ error: 'Título y descripción son obligatorios' });
        }

        const resultado = await db.query(`
            INSERT INTO tickets_soporte (negocio_id, usuario_id, titulo, descripcion, categoria)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [negocio_id, usuario_id, titulo, descripcion, categoria || 'otro']);

        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al crear ticket:', error);
        res.status(500).json({
            error: error.message || 'Error al crear ticket',
            code: error.code || null,
            detail: error.detail || null,
        });
    }
});

module.exports = router;