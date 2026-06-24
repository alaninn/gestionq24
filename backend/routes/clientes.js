const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { buscar } = req.query;
        let consulta = 'SELECT * FROM clientes WHERE activo = TRUE AND negocio_id = $1';
        let valores = [negocio_id];
        if (buscar) { consulta += ' AND (nombre ILIKE $2 OR telefono ILIKE $2)'; valores.push(`%${buscar}%`); }
        consulta += ' ORDER BY nombre ASC';
        const resultado = await db.query(consulta, valores);
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const cliente = await db.query('SELECT * FROM clientes WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        if (cliente.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

        const ventas = await db.query('SELECT v.*, COUNT(vi.id) as items FROM ventas v LEFT JOIN venta_items vi ON v.id = vi.venta_id WHERE v.cliente_id = $1 AND v.es_fiado = TRUE AND v.negocio_id = $2 GROUP BY v.id ORDER BY v.fecha DESC', [req.params.id, negocio_id]);
        const pagos = await db.query('SELECT * FROM pagos_deuda WHERE cliente_id = $1 ORDER BY fecha DESC', [req.params.id]);

        res.json({ ...cliente.rows[0], ventas: ventas.rows, pagos: pagos.rows });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
});

// Historial COMPLETO de compras del cliente + estadísticas de interés.
// ?mes=YYYY-MM filtra la lista de compras a ese mes (las stats son siempre globales).
router.get('/:id/historial', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const cliente_id = req.params.id;
        const { mes } = req.query;

        // Estadísticas globales del cliente
        const stats = await db.query(`
            SELECT
                COUNT(*) AS total_compras,
                COALESCE(SUM(total), 0) AS total_gastado,
                COALESCE(AVG(total), 0) AS ticket_promedio,
                MIN(fecha) AS primera_compra,
                MAX(fecha) AS ultima_compra,
                COALESCE(SUM(CASE WHEN es_fiado THEN total END), 0) AS total_fiado,
                COUNT(CASE WHEN es_fiado THEN 1 END) AS compras_fiadas
            FROM ventas
            WHERE cliente_id = $1 AND negocio_id = $2
        `, [cliente_id, negocio_id]);

        // Gastado por mes (últimos 12 meses con movimiento)
        const porMes = await db.query(`
            SELECT TO_CHAR(fecha, 'YYYY-MM') AS mes,
                   COUNT(*) AS compras,
                   COALESCE(SUM(total), 0) AS total
            FROM ventas
            WHERE cliente_id = $1 AND negocio_id = $2
            GROUP BY TO_CHAR(fecha, 'YYYY-MM')
            ORDER BY mes DESC
            LIMIT 12
        `, [cliente_id, negocio_id]);

        // Qué productos compra más este cliente
        const topProductos = await db.query(`
            SELECT vi.nombre_producto,
                   SUM(vi.cantidad) AS cantidad,
                   SUM(vi.subtotal) AS total
            FROM venta_items vi
            JOIN ventas v ON v.id = vi.venta_id
            WHERE v.cliente_id = $1 AND v.negocio_id = $2
            GROUP BY vi.nombre_producto
            ORDER BY cantidad DESC
            LIMIT 5
        `, [cliente_id, negocio_id]);

        // Total pagado de deudas (solo movimientos de tipo 'pago', no las deudas
        // cargadas a mano que también viven en pagos_deuda con tipo 'deuda').
        const pagos = await db.query(
            "SELECT COALESCE(SUM(monto), 0) AS total_pagado, COUNT(*) AS cantidad FROM pagos_deuda WHERE cliente_id = $1 AND COALESCE(tipo, 'pago') = 'pago'",
            [cliente_id]
        );

        // Lista de compras (todas, no solo fiadas), opcionalmente de un mes
        let consultaVentas = `
            SELECT v.id, v.fecha, v.total, v.metodo_pago, v.es_fiado, v.tipo_facturacion,
                   COUNT(vi.id) AS items
            FROM ventas v
            LEFT JOIN venta_items vi ON vi.venta_id = v.id
            WHERE v.cliente_id = $1 AND v.negocio_id = $2
        `;
        const valores = [cliente_id, negocio_id];
        if (mes) {
            consultaVentas += ` AND TO_CHAR(v.fecha, 'YYYY-MM') = $3`;
            valores.push(mes);
        }
        consultaVentas += ' GROUP BY v.id ORDER BY v.fecha DESC LIMIT 200';
        const ventas = await db.query(consultaVentas, valores);

        res.json({
            stats: stats.rows[0],
            porMes: porMes.rows,
            topProductos: topProductos.rows,
            pagos: pagos.rows[0],
            ventas: ventas.rows,
        });
    } catch (error) {
        console.error('Error historial cliente:', error);
        res.status(500).json({ error: 'Error al obtener el historial del cliente' });
    }
});

router.post('/', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { nombre, telefono, email, direccion } = req.body;
        if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

        const resultado = await db.query(
            'INSERT INTO clientes (nombre, telefono, email, direccion, negocio_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
            [nombre, telefono || null, email || null, direccion || null, negocio_id]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear cliente' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { nombre, telefono, email, direccion } = req.body;
        const resultado = await db.query(
            'UPDATE clientes SET nombre=$1, telefono=$2, email=$3, direccion=$4 WHERE id=$5 AND negocio_id=$6 RETURNING *',
            [nombre, telefono, email, direccion, req.params.id, negocio_id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al editar cliente' });
    }
});

router.post('/:id/pago', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { monto, metodo_pago, nota } = req.body;
        if (!monto || monto <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

        await db.query('INSERT INTO pagos_deuda (cliente_id, monto, metodo_pago, nota, negocio_id) VALUES ($1,$2,$3,$4,$5)',
            [req.params.id, monto, metodo_pago || 'efectivo', nota || null, negocio_id]);

        const resultado = await db.query(
            'UPDATE clientes SET saldo_deuda = GREATEST(saldo_deuda - $1, 0) WHERE id = $2 AND negocio_id = $3 RETURNING *',
            [monto, req.params.id, negocio_id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al registrar pago' });
    }
});

// Cargar deuda a mano a un cliente (préstamo, artículo fuera de stock, etc.).
// Sube saldo_deuda y queda registrado en pagos_deuda con tipo 'deuda'.
router.post('/:id/deuda', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const monto = Number(req.body.monto);
        const { nota } = req.body;
        if (!monto || isNaN(monto) || monto <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

        // Verificar que el cliente exista en este negocio
        const cli = await db.query('SELECT id FROM clientes WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        if (cli.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

        await db.query(
            "INSERT INTO pagos_deuda (cliente_id, monto, metodo_pago, nota, negocio_id, tipo) VALUES ($1, $2, '-', $3, $4, 'deuda')",
            [req.params.id, monto, nota || null, negocio_id]
        );
        const resultado = await db.query(
            'UPDATE clientes SET saldo_deuda = COALESCE(saldo_deuda, 0) + $1 WHERE id = $2 AND negocio_id = $3 RETURNING *',
            [monto, req.params.id, negocio_id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error al cargar deuda:', error);
        res.status(500).json({ error: 'Error al cargar la deuda' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        await db.query('UPDATE clientes SET activo = FALSE WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        res.json({ mensaje: 'Cliente desactivado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar cliente' });
    }
});

module.exports = router;