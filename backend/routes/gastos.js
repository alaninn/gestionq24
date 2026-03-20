const express = require('express');
const { verificarPermiso } = require('../middleware/auth');
const router = express.Router();
const db = require('../config/database');

router.get('/', verificarPermiso('gastos', 'ver'), async (req, res) => {
    try {
    const negocio_id = req.negocio_id || req.usuario.negocio_id || 1;
        const { fecha_desde, fecha_hasta, tipo } = req.query;

        let consulta = 'SELECT * FROM gastos WHERE negocio_id = $1';
        let valores = [negocio_id];
        let contador = 2;

        if (fecha_desde) { consulta += ` AND fecha >= $${contador}`; valores.push(fecha_desde); contador++; }
        if (fecha_hasta) { consulta += ` AND fecha <= $${contador}`; valores.push(fecha_hasta + ' 23:59:59'); contador++; }
        if (tipo && tipo !== 'todos') { consulta += ` AND tipo = $${contador}`; valores.push(tipo); contador++; }

        consulta += ' ORDER BY fecha DESC';
        const resultado = await db.query(consulta, valores);
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener gastos' });
    }
});

router.post('/', verificarPermiso('gastos', 'crear'), async (req, res) => {
    try {
      const negocio_id = req.negocio_id || req.usuario.negocio_id || 1;
        const { descripcion, monto, categoria, turno_id, tipo, metodo_pago } = req.body;

        if (!monto) return res.status(400).json({ error: 'El monto es obligatorio' });

        const resultado = await db.query(`
            INSERT INTO gastos (descripcion, monto, categoria, turno_id, tipo, metodo_pago, negocio_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
        `, [descripcion || '', monto, categoria || null, turno_id || null, tipo || 'variable', metodo_pago || 'efectivo', negocio_id]);

        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear gasto' });
    }
});

router.delete('/:id', verificarPermiso('gastos', 'eliminar'), async (req, res) => {
    try {
       const negocio_id = req.negocio_id || req.usuario.negocio_id || 1;
        await db.query('DELETE FROM gastos WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        res.json({ mensaje: 'Gasto eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar gasto' });
    }
});

module.exports = router;