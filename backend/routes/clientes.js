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