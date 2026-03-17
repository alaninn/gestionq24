const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET turno actual del usuario
router.get('/actual', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const usuario_id = req.usuario.id;

        // Buscamos si el usuario está en alguna caja abierta
        const resultado = await db.query(`
            SELECT t.* FROM turnos t
            INNER JOIN turno_usuarios tu ON tu.turno_id = t.id
            WHERE t.estado = 'abierto' 
              AND t.negocio_id = $1
              AND tu.usuario_id = $2
            ORDER BY t.fecha_apertura DESC
            LIMIT 1
        `, [negocio_id, usuario_id]);

        res.json(resultado.rows[0] || null);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener turno actual' });
    }
});

// GET todas las cajas abiertas del negocio
router.get('/abiertas', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;

        const resultado = await db.query(`
            SELECT 
                t.*,
                COUNT(DISTINCT tu.usuario_id) AS total_usuarios,
                COUNT(DISTINCT v.id) AS total_ventas,
                COALESCE(SUM(v.total), 0) AS total_facturado
            FROM turnos t
            LEFT JOIN turno_usuarios tu ON tu.turno_id = t.id
            LEFT JOIN ventas v ON v.turno_id = t.id
            WHERE t.estado = 'abierto' AND t.negocio_id = $1
            GROUP BY t.id
            ORDER BY t.fecha_apertura ASC
        `, [negocio_id]);

        res.json(resultado.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener cajas abiertas' });
    }
});

// GET todos los turnos
router.get('/', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const resultado = await db.query(
            'SELECT * FROM turnos WHERE negocio_id = $1 ORDER BY fecha_apertura DESC',
            [negocio_id]
        );
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener turnos' });
    }
});

// POST abrir nueva caja
router.post('/abrir', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const usuario_id = req.usuario.id;
        const { inicio_caja, nombre } = req.body;

        // Verificamos que el usuario no esté ya en una caja abierta
        const yaEnCaja = await db.query(`
            SELECT t.id, t.nombre FROM turnos t
            INNER JOIN turno_usuarios tu ON tu.turno_id = t.id
            WHERE t.estado = 'abierto' AND t.negocio_id = $1 AND tu.usuario_id = $2
        `, [negocio_id, usuario_id]);

        if (yaEnCaja.rows.length > 0) {
            return res.status(400).json({ 
                error: `Ya estás en la caja "${yaEnCaja.rows[0].nombre}"` 
            });
        }

        // Creamos la nueva caja
        const turno = await db.query(`
            INSERT INTO turnos (inicio_caja, estado, negocio_id, nombre, usuario_id)
            VALUES ($1, 'abierto', $2, $3, $4)
            RETURNING *
        `, [inicio_caja || 0, negocio_id, nombre || 'Caja Principal', usuario_id]);

        // Agregamos al usuario a la caja
        await db.query(`
            INSERT INTO turno_usuarios (turno_id, usuario_id, negocio_id)
            VALUES ($1, $2, $3)
        `, [turno.rows[0].id, usuario_id, negocio_id]);

        res.status(201).json(turno.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al abrir caja' });
    }
});

// POST unirse a una caja existente
router.post('/:id/unirse', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const usuario_id = req.usuario.id;
        const { id } = req.params;

        // Verificamos que la caja existe y está abierta
        const turno = await db.query(
            'SELECT * FROM turnos WHERE id = $1 AND estado = $2 AND negocio_id = $3',
            [id, 'abierto', negocio_id]
        );
        if (turno.rows.length === 0) {
            return res.status(404).json({ error: 'Caja no encontrada o cerrada' });
        }

        // Verificamos que no esté ya en esa caja
        const yaEnCaja = await db.query(
            'SELECT id FROM turno_usuarios WHERE turno_id = $1 AND usuario_id = $2',
            [id, usuario_id]
        );
        if (yaEnCaja.rows.length > 0) {
            return res.json(turno.rows[0]); // Ya está, devolvemos el turno
        }

        // Lo agregamos a la caja
        await db.query(`
            INSERT INTO turno_usuarios (turno_id, usuario_id, negocio_id)
            VALUES ($1, $2, $3)
        `, [id, usuario_id, negocio_id]);

        res.json(turno.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al unirse a la caja' });
    }
});

// PUT cerrar caja
router.put('/:id/cerrar', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const { id } = req.params;
        const { 
            efectivo_retirado, dinero_siguiente, 
            total_tarjetas, total_mercadopago, 
            total_transferencias, comentarios 
        } = req.body;

        const resultado = await db.query(`
            UPDATE turnos SET
                estado = 'cerrado',
                fecha_cierre = NOW(),
                efectivo_retirado = $1,
                dinero_siguiente = $2,
                total_tarjetas = $3,
                total_mercadopago = $4,
                total_transferencias = $5,
                comentarios = $6
            WHERE id = $7 AND negocio_id = $8
            RETURNING *
        `, [
            efectivo_retirado || 0,
            dinero_siguiente || 0,
            total_tarjetas || 0,
            total_mercadopago || 0,
            total_transferencias || 0,
            comentarios || '',
            id, negocio_id
        ]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Caja no encontrada' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al cerrar caja' });
    }
});

module.exports = router;