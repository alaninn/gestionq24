const express = require('express');
const { verificarPermiso } = require('../middleware/auth');
const router = express.Router();
const db = require('../config/database');

router.get('/', verificarPermiso('ventas', 'ver'), async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const { fecha_desde, fecha_hasta, turno_id } = req.query;

        let consulta = `
            SELECT v.*, c.nombre AS cliente_nombre,
                COUNT(vi.id) AS cantidad_items
            FROM ventas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN venta_items vi ON v.id = vi.venta_id
            WHERE v.negocio_id = $1
        `;
        let valores = [negocio_id];
        let contador = 2;

        if (fecha_desde) { consulta += ` AND v.fecha >= $${contador}`; valores.push(fecha_desde); contador++; }
        if (fecha_hasta) { consulta += ` AND v.fecha <= $${contador}`; valores.push(fecha_hasta + ' 23:59:59'); contador++; }
        if (turno_id) { consulta += ` AND v.turno_id = $${contador}`; valores.push(turno_id); contador++; }

        consulta += ' GROUP BY v.id, c.nombre ORDER BY v.fecha DESC';
        const resultado = await db.query(consulta, valores);
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener ventas' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const venta = await db.query(
            'SELECT v.*, c.nombre AS cliente_nombre FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id WHERE v.id = $1 AND v.negocio_id = $2',
            [req.params.id, negocio_id]
        );
        if (venta.rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });

        const items = await db.query('SELECT * FROM venta_items WHERE venta_id = $1', [req.params.id]);
        res.json({ ...venta.rows[0], items: items.rows });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener venta' });
    }
});

router.post('/', verificarPermiso('ventas', 'crear'), async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const { turno_id, cliente_id, items, metodo_pago, descuento, recargo, es_fiado, total } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'La venta debe tener al menos un producto' });
        }

        await db.query('BEGIN');

        const ventaResult = await db.query(`
            INSERT INTO ventas (turno_id, cliente_id, total, descuento, recargo, metodo_pago, es_fiado, negocio_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [turno_id || null, cliente_id || null, total, descuento || 0, recargo || 0, metodo_pago || 'efectivo', es_fiado || false, negocio_id]);

        const ventaId = ventaResult.rows[0].id;

        for (const item of items) {
            if (!item.producto_id) continue;
            await db.query(`
                INSERT INTO venta_items (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal, negocio_id)
                VALUES ($1,$2,$3,$4,$5,$6,$7)
            `, [ventaId, item.producto_id, item.nombre_producto, item.cantidad, item.precio_unitario, item.subtotal, negocio_id]);

            await db.query(
                'UPDATE productos SET stock = stock - $1 WHERE id = $2 AND negocio_id = $3',
                [item.cantidad, item.producto_id, negocio_id]
            );
        }

        if (es_fiado && cliente_id) {
            await db.query(
                'UPDATE clientes SET saldo_deuda = saldo_deuda + $1 WHERE id = $2 AND negocio_id = $3',
                [total, cliente_id, negocio_id]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ ...ventaResult.rows[0], mensaje: 'Venta registrada correctamente' });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al registrar venta' });
    }
});

module.exports = router;