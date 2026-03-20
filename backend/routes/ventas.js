const express = require('express');
const { verificarPermiso } = require('../middleware/auth');
const router = express.Router();
const db = require('../config/database');

router.get('/', verificarPermiso('ventas', 'ver'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario.negocio_id || 1;
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
       const negocio_id = req.negocio_id || req.usuario.negocio_id || 1;
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
       const negocio_id = req.negocio_id || req.usuario.negocio_id || 1;
        const { turno_id, cliente_id, items, metodo_pago, descuento, recargo, es_fiado, total } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'La venta debe tener al menos un producto' });
        }

        // Obtener configuración del negocio para verificar si permite stock negativo
        let configResult = await db.query(
            'SELECT permite_stock_negativo FROM configuracion WHERE negocio_id = $1',
            [negocio_id]
        );
        
        // Si no existe configuración, crear una por defecto
        if (configResult.rows.length === 0) {
            await db.query(
                'INSERT INTO configuracion (negocio_id, permite_stock_negativo) VALUES ($1, false) ON CONFLICT DO NOTHING',
                [negocio_id]
            );
            configResult = await db.query(
                'SELECT permite_stock_negativo FROM configuracion WHERE negocio_id = $1',
                [negocio_id]
            );
        }
        
        const permiteStockNegativo = configResult.rows[0]?.permite_stock_negativo || false;

        await db.query('BEGIN');

        // Validar y calcular precios para cada item
        const itemsProcesados = [];
        let totalCalculado = 0;

        for (const item of items) {
            if (!item.producto_id) {
                // Producto rápido (sin inventario)
                const subtotal = parseFloat(item.subtotal || 0);
                itemsProcesados.push({
                    ...item,
                    subtotal: subtotal
                });
                totalCalculado += subtotal;
                continue;
            }

            // Obtener información del producto
            const productoResult = await db.query(
                'SELECT nombre, precio_venta, stock, unidad FROM productos WHERE id = $1 AND negocio_id = $2',
                [item.producto_id, negocio_id]
            );

            if (productoResult.rows.length === 0) {
                throw new Error(`Producto con ID ${item.producto_id} no encontrado`);
            }

            const producto = productoResult.rows[0];
            const cantidad = parseFloat(item.cantidad);
            const precioUnitario = parseFloat(item.precio_unitario);
            const subtotal = parseFloat(item.subtotal);

            // Validar que los valores sean numéricos
            if (isNaN(cantidad) || isNaN(precioUnitario) || isNaN(subtotal)) {
                throw new Error(`Valores numéricos inválidos para ${producto.nombre}`);
            }

            // Validar unidades de medida
            const unidadesNoUnitarias = ['kg', 'lt', 'mt'];
            const esUnidadNoUnitaria = unidadesNoUnitarias.includes(producto.unidad.toLowerCase());

            if (!esUnidadNoUnitaria && !Number.isInteger(cantidad)) {
                throw new Error(`La cantidad para ${producto.nombre} debe ser un número entero`);
            }

            // Validar stock solo si no permite stock negativo
            if (!permiteStockNegativo && producto.stock < cantidad) {
                throw new Error(`Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}, solicitado: ${cantidad}`);
            }

            itemsProcesados.push({
                ...item,
                nombre_producto: producto.nombre,
                precio_unitario: precioUnitario,
                cantidad: cantidad,
                subtotal: subtotal
            });

            totalCalculado += subtotal;
        }

        // Validar que el total enviado coincida con el cálculo
        const totalEsperado = totalCalculado - (parseFloat(descuento) || 0) + (parseFloat(recargo) || 0);
        if (Math.abs(total - totalEsperado) > 100) {
            throw new Error(`Total incorrecto. Calculado: ${totalEsperado.toFixed(2)}, enviado: ${total.toFixed(2)}`);
        }

        const ventaResult = await db.query(`
            INSERT INTO ventas (turno_id, cliente_id, total, descuento, recargo, metodo_pago, es_fiado, negocio_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [turno_id || null, cliente_id || null, total, descuento || 0, recargo || 0, metodo_pago || 'efectivo', es_fiado || false, negocio_id]);

        const ventaId = ventaResult.rows[0].id;

       // Insertar items y actualizar stock
        for (const item of itemsProcesados) {
            if (!item.producto_id) {
                // Producto rápido: guardar el ítem igual, pero sin actualizar stock
                await db.query(`
                    INSERT INTO venta_items (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal, negocio_id)
                    VALUES ($1, NULL, $2, $3::numeric, $4::numeric, $5::numeric, $6)
                `, [ventaId, item.nombre_producto || 'Producto rápido', parseFloat(item.cantidad) || 1, parseFloat(item.precio_unitario) || 0, parseFloat(item.subtotal) || 0, negocio_id]);
                continue;
            }

            await db.query(`
                INSERT INTO venta_items (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal, negocio_id)
                VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6::numeric, $7)
            `, [ventaId, item.producto_id, item.nombre_producto, parseFloat(item.cantidad), parseFloat(item.precio_unitario), parseFloat(item.subtotal), negocio_id]);

            // Actualizar stock solo para productos con inventario
            await db.query(
                'UPDATE productos SET stock = stock - $1::numeric WHERE id = $2 AND negocio_id = $3',
                [parseFloat(item.cantidad), item.producto_id, negocio_id]
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
        console.error('Error al registrar venta:', error.message);
        res.status(400).json({ error: error.message || 'Error al registrar venta' });
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
      const negocio_id = req.negocio_id || req.usuario.negocio_id || 1;

        // Actualizar datos principales de la venta
        await db.query(
            'UPDATE ventas SET metodo_pago = $1, descuento = $2, recargo = $3, total = $4, cliente_id = $5, es_fiado = $6 WHERE id = $7 AND negocio_id = $8',
            [metodo_pago, descuento, recargo, total, cliente_id, es_fiado, id, negocio_id]
        );

        // Si vinieron items nuevos, actualizar venta_items y stock
        if (items && items.length > 0) {
            // Primero restaurar el stock de los items anteriores
            const itemsAnteriores = await db.query(
                'SELECT producto_id, cantidad FROM venta_items WHERE venta_id = $1 AND producto_id IS NOT NULL',
                [id]
            );
            for (const item of itemsAnteriores.rows) {
                await db.query(
                    'UPDATE productos SET stock = stock + $1 WHERE id = $2 AND negocio_id = $3',
                    [item.cantidad, item.producto_id, negocio_id]
                );
            }

            // Borrar items anteriores
            await db.query('DELETE FROM venta_items WHERE venta_id = $1', [id]);

            // Insertar items nuevos y descontar stock
            for (const item of items) {
                await db.query(`
                    INSERT INTO venta_items (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal, negocio_id)
                    VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6::numeric, $7)
                `, [id, item.producto_id || null, item.nombre_producto, item.cantidad, item.precio_unitario, item.subtotal, negocio_id]);

                if (item.producto_id) {
                    await db.query(
                        'UPDATE productos SET stock = stock - $1 WHERE id = $2 AND negocio_id = $3',
                        [item.cantidad, item.producto_id, negocio_id]
                    );
                }
            }
        }

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
        
      // Restaurar stock de los productos antes de eliminar
        const itemsVenta = await db.query(
            'SELECT producto_id, cantidad FROM venta_items WHERE venta_id = $1 AND producto_id IS NOT NULL',
            [id]
        );
        for (const item of itemsVenta.rows) {
            await db.query(
                'UPDATE productos SET stock = stock + $1 WHERE id = $2 AND negocio_id = $3',
                [item.cantidad, item.producto_id, req.usuario.negocio_id || 1]
            );
        }

        // Restaurar saldo de deuda si era venta fiada
        const ventaInfo = await db.query(
            'SELECT cliente_id, total, es_fiado FROM ventas WHERE id = $1 AND negocio_id = $2',
            [id, req.usuario.negocio_id || 1]
        );
        if (ventaInfo.rows[0]?.es_fiado && ventaInfo.rows[0]?.cliente_id) {
            await db.query(
                'UPDATE clientes SET saldo_deuda = GREATEST(saldo_deuda - $1, 0) WHERE id = $2',
                [ventaInfo.rows[0].total, ventaInfo.rows[0].cliente_id]
            );
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
        const venta = await db.query(
            'SELECT v.*, c.nombre AS cliente_nombre FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id WHERE v.id = $1 AND v.negocio_id = $2',
            [id, req.usuario.negocio_id || 1]
        );
        if (venta.rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });

        const items = await db.query('SELECT * FROM venta_items WHERE venta_id = $1', [id]);

        // Devolver datos para imprimir ticket
        res.json({ ...venta.rows[0], items: items.rows });
    } catch (error) {
        console.error('Error al obtener datos del ticket:', error);
        res.status(500).json({ error: 'Error al obtener datos del ticket', details: error.message });
    }
});

module.exports = router;