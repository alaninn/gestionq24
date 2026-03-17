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

// Endpoint para editar una venta
router.put('/:id/editar', verificarPermiso('ventas', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { items, metodo_pago, descuento, recargo, total, cliente_id, es_fiado } = req.body;
    
    // Validar que el turno esté abierto
    const venta = await db.query('SELECT turno_id FROM ventas WHERE id = $1 AND negocio_id = $2', [id, req.usuario.negocio_id || 1]);
    if (venta.rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    
    // Validar que el turno esté abierto
    const turno = await db.query('SELECT estado FROM turnos WHERE id = $1 AND negocio_id = $2', [venta.rows[0].turno_id, req.usuario.negocio_id || 1]);
    if (turno.rows.length === 0 || turno.rows[0].estado !== 'abierto') {
      return res.status(400).json({ error: 'No se puede editar una venta de un turno cerrado' });
    }
    
    // Actualizar venta
    await db.query('UPDATE ventas SET items = $1, metodo_pago = $2, descuento = $3, recargo = $4, total = $5, cliente_id = $6, es_fiado = $7 WHERE id = $8 AND negocio_id = $9',
      [items, metodo_pago, descuento, recargo, total, cliente_id, es_fiado, id, req.usuario.negocio_id || 1]);
    
    res.json({ mensaje: 'Venta actualizada correctamente' });
  } catch (error) {
    console.error('Error al editar venta:', error);
    res.status(500).json({ error: 'Error al editar venta' });
  }
});

// Endpoint para eliminar una venta
router.delete('/:id', verificarPermiso('ventas', 'eliminar'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validar que el turno esté abierto y la venta pertenezca al turno actual
    const venta = await db.query('SELECT turno_id FROM ventas WHERE id = $1 AND negocio_id = $2', [id, req.usuario.negocio_id || 1]);
    if (venta.rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    
    // Validar que el turno esté abierto
    const turno = await db.query('SELECT estado FROM turnos WHERE id = $1 AND negocio_id = $2', [venta.rows[0].turno_id, req.usuario.negocio_id || 1]);
    if (turno.rows.length === 0 || turno.rows[0].estado !== 'abierto') {
      return res.status(400).json({ error: 'No se puede eliminar una venta de un turno cerrado' });
    }
    
    // Eliminar venta
    await db.query('DELETE FROM ventas WHERE id = $1 AND negocio_id = $2', [id, req.usuario.negocio_id || 1]);
    res.json({ mensaje: 'Venta eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar venta:', error);
    res.status(500).json({ error: 'Error al eliminar venta' });
  }
});

// Endpoint para obtener datos de ticket para reimprimir
router.get('/:id/ticket', async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await db.query('SELECT * FROM ventas WHERE id = $1 AND negocio_id = $2', [id, req.usuario.negocio_id || 1]);
    if (venta.rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    
    // Devolver datos para imprimir ticket
    res.json(venta.rows[0]);
  } catch (error) {
    console.error('Error al obtener datos del ticket:', error);
    res.status(500).json({ error: 'Error al obtener datos del ticket' });
  }
});

module.exports = router;
