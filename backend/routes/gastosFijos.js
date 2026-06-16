// =============================================
// RUTA: Gastos fijos / operativos mensuales del local
// (luz, alquiler, impuestos, etc.) Se usan en el Centro de Control para
// prorratearlos por día y calcular la ganancia neta real.
// =============================================
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarToken, verificarPermiso } = require('../middleware/auth');

router.use(verificarToken);

// Listar gastos fijos del negocio
router.get('/', verificarPermiso('centro_control', 'ver'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const r = await db.query(
            'SELECT * FROM gastos_fijos WHERE negocio_id = $1 ORDER BY nombre ASC',
            [negocio_id]
        );
        res.json(r.rows);
    } catch (error) {
        console.error('Error listando gastos fijos:', error);
        res.status(500).json({ error: 'Error al obtener los gastos fijos' });
    }
});

// Crear gasto fijo
router.post('/', verificarPermiso('centro_control', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { nombre, monto_mensual } = req.body;
        if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
        const r = await db.query(
            'INSERT INTO gastos_fijos (negocio_id, nombre, monto_mensual) VALUES ($1, $2, $3) RETURNING *',
            [negocio_id, nombre.trim(), parseFloat(monto_mensual) || 0]
        );
        res.json(r.rows[0]);
    } catch (error) {
        console.error('Error creando gasto fijo:', error);
        res.status(500).json({ error: 'Error al crear el gasto fijo' });
    }
});

// Editar gasto fijo (nombre, monto, activo)
router.put('/:id', verificarPermiso('centro_control', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { nombre, monto_mensual, activo } = req.body;
        const r = await db.query(`
            UPDATE gastos_fijos
            SET nombre = COALESCE($1, nombre),
                monto_mensual = COALESCE($2, monto_mensual),
                activo = COALESCE($3, activo),
                updated_at = NOW()
            WHERE id = $4 AND negocio_id = $5 RETURNING *
        `, [
            nombre?.trim() || null,
            (monto_mensual === undefined || monto_mensual === null || monto_mensual === '') ? null : parseFloat(monto_mensual),
            (typeof activo === 'boolean') ? activo : null,
            req.params.id, negocio_id
        ]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'Gasto fijo no encontrado' });
        res.json(r.rows[0]);
    } catch (error) {
        console.error('Error editando gasto fijo:', error);
        res.status(500).json({ error: 'Error al editar el gasto fijo' });
    }
});

// Eliminar gasto fijo
router.delete('/:id', verificarPermiso('centro_control', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        await db.query('DELETE FROM gastos_fijos WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        res.json({ mensaje: 'Gasto fijo eliminado' });
    } catch (error) {
        console.error('Error eliminando gasto fijo:', error);
        res.status(500).json({ error: 'Error al eliminar el gasto fijo' });
    }
});

module.exports = router;
