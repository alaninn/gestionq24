const express = require('express');
const router = express.Router();
const db = require('../config/database');

// =============================================
// CAJAS FIJAS del local (Mañana, Tarde, Trasnoche...)
// Se administran desde Control de Cajas; cualquier usuario las ve al abrir.
// =============================================

// GET cajas fijas (con estado: si tienen un turno abierto ahora)
router.get('/cajas-fijas', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const resultado = await db.query(`
            SELECT cd.id, cd.nombre, cd.orden,
                   t.id AS turno_abierto_id,
                   t.fecha_apertura AS turno_abierto_desde
            FROM cajas_definidas cd
            LEFT JOIN turnos t ON t.caja_definida_id = cd.id
                AND t.estado = 'abierto' AND t.negocio_id = cd.negocio_id
            WHERE cd.negocio_id = $1 AND cd.activa = TRUE
            ORDER BY cd.orden ASC, cd.id ASC
        `, [negocio_id]);

        res.json(resultado.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener cajas fijas' });
    }
});

// POST crear caja fija (solo admin, desde Control de Cajas)
router.post('/cajas-fijas', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        if (!['admin', 'superadmin'].includes(req.usuario?.rol)) {
            return res.status(403).json({ error: 'Solo el administrador puede crear cajas fijas' });
        }
        const nombre = (req.body.nombre || '').trim();
        if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

        const existe = await db.query(
            'SELECT id FROM cajas_definidas WHERE negocio_id = $1 AND activa = TRUE AND LOWER(nombre) = LOWER($2)',
            [negocio_id, nombre]
        );
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: `Ya existe una caja fija llamada "${nombre}"` });
        }

        const maxOrden = await db.query(
            'SELECT COALESCE(MAX(orden), 0) AS max FROM cajas_definidas WHERE negocio_id = $1',
            [negocio_id]
        );
        const resultado = await db.query(
            'INSERT INTO cajas_definidas (negocio_id, nombre, orden) VALUES ($1, $2, $3) RETURNING *',
            [negocio_id, nombre, parseInt(maxOrden.rows[0].max) + 1]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al crear la caja fija' });
    }
});

// DELETE desactivar caja fija (solo admin) — no borra historial de turnos
router.delete('/cajas-fijas/:id', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        if (!['admin', 'superadmin'].includes(req.usuario?.rol)) {
            return res.status(403).json({ error: 'Solo el administrador puede eliminar cajas fijas' });
        }
        const r = await db.query(
            'UPDATE cajas_definidas SET activa = FALSE WHERE id = $1 AND negocio_id = $2 RETURNING id',
            [req.params.id, negocio_id]
        );
        if (r.rows.length === 0) return res.status(404).json({ error: 'Caja fija no encontrada' });
        res.json({ mensaje: 'Caja fija eliminada' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar la caja fija' });
    }
});

// GET turno actual del usuario
router.get('/actual', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
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
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

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
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
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
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const usuario_id = req.usuario.id;
        const { inicio_caja, nombre, caja_definida_id } = req.body;

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

        // Si abre una caja FIJA: usar su nombre y evitar que se abra dos veces
        let nombreFinal = nombre || 'Caja Principal';
        let cajaDefinidaId = null;
        if (caja_definida_id) {
            const cf = await db.query(
                'SELECT * FROM cajas_definidas WHERE id = $1 AND negocio_id = $2 AND activa = TRUE',
                [caja_definida_id, negocio_id]
            );
            if (cf.rows.length === 0) {
                return res.status(404).json({ error: 'La caja fija no existe' });
            }
            const abierta = await db.query(
                "SELECT id FROM turnos WHERE caja_definida_id = $1 AND estado = 'abierto' AND negocio_id = $2",
                [caja_definida_id, negocio_id]
            );
            if (abierta.rows.length > 0) {
                return res.status(400).json({
                    error: `La caja "${cf.rows[0].nombre}" ya está abierta. Unite a ella en vez de abrirla de nuevo.`
                });
            }
            nombreFinal = cf.rows[0].nombre;
            cajaDefinidaId = cf.rows[0].id;
        }

        // Creamos la nueva caja
        const turno = await db.query(`
            INSERT INTO turnos (inicio_caja, estado, negocio_id, nombre, usuario_id, caja_definida_id)
            VALUES ($1, 'abierto', $2, $3, $4, $5)
            RETURNING *
        `, [inicio_caja || 0, negocio_id, nombreFinal, usuario_id, cajaDefinidaId]);

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
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
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

// POST salir de una caja SIN cerrarla (cambio de caja):
// el usuario deja de estar asociado pero la caja sigue abierta para los demás.
router.post('/:id/salir', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const usuario_id = req.usuario.id;

        const turno = await db.query(
            "SELECT id, nombre FROM turnos WHERE id = $1 AND negocio_id = $2 AND estado = 'abierto'",
            [req.params.id, negocio_id]
        );
        if (turno.rows.length === 0) {
            return res.status(404).json({ error: 'Caja no encontrada o ya cerrada' });
        }

        await db.query(
            'DELETE FROM turno_usuarios WHERE turno_id = $1 AND usuario_id = $2',
            [req.params.id, usuario_id]
        );

        res.json({ mensaje: `Saliste de la caja "${turno.rows[0].nombre}". La caja sigue abierta.` });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al salir de la caja' });
    }
});

// PUT cerrar caja
router.put('/:id/cerrar', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
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
                comentarios = $6,
                usuario_cierre_id = $9
            WHERE id = $7 AND negocio_id = $8
            RETURNING *
        `, [
            efectivo_retirado || 0,
            dinero_siguiente || 0,
            total_tarjetas || 0,
            total_mercadopago || 0,
            total_transferencias || 0,
            comentarios || '',
            id, negocio_id,
            req.usuario?.id || null
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