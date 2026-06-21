// =============================================
// RUTA: Retiros de dinero del local (tomar ganancia / sacar plata)
// Bajan el "dinero disponible" del Centro de Control, pero NO son gastos del
// negocio (no afectan la ganancia). tipo: 'efectivo' | 'virtual'.
// =============================================
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarPermiso } = require('../middleware/auth');

// Listar retiros (opcionalmente por rango de fechas)
router.get('/', verificarPermiso('centro_control', 'ver'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { fecha_desde, fecha_hasta } = req.query;
        let where = 'WHERE negocio_id = $1';
        const valores = [negocio_id];
        let i = 2;
        if (fecha_desde && /^\d{4}-\d{2}-\d{2}$/.test(fecha_desde)) { where += ` AND fecha::date >= $${i}`; valores.push(fecha_desde); i++; }
        if (fecha_hasta && /^\d{4}-\d{2}-\d{2}$/.test(fecha_hasta)) { where += ` AND fecha::date <= $${i}`; valores.push(fecha_hasta); i++; }
        const r = await db.query(`SELECT * FROM retiros ${where} ORDER BY fecha DESC LIMIT 200`, valores);
        res.json(r.rows);
    } catch (error) {
        console.error('Error listando retiros:', error);
        res.status(500).json({ error: 'Error al obtener los retiros' });
    }
});

// Registrar un retiro
router.post('/', verificarPermiso('centro_control', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { monto, tipo, nota } = req.body;
        const montoNum = Number(monto);
        if (!montoNum || isNaN(montoNum) || montoNum <= 0) {
            return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
        }
        const tipoFinal = tipo === 'virtual' ? 'virtual' : 'efectivo';
        const r = await db.query(
            'INSERT INTO retiros (negocio_id, monto, tipo, nota, usuario_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [negocio_id, montoNum, tipoFinal, (nota || '').trim() || null, req.usuario?.id || null]
        );
        res.json(r.rows[0]);
    } catch (error) {
        console.error('Error creando retiro:', error);
        res.status(500).json({ error: 'Error al registrar el retiro' });
    }
});

// Eliminar un retiro
router.delete('/:id', verificarPermiso('centro_control', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        await db.query('DELETE FROM retiros WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        res.json({ mensaje: 'Retiro eliminado' });
    } catch (error) {
        console.error('Error eliminando retiro:', error);
        res.status(500).json({ error: 'Error al eliminar el retiro' });
    }
});

module.exports = router;
