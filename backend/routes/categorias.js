const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || 1;
        const resultado = await db.query(
            'SELECT * FROM categorias WHERE negocio_id = $1 ORDER BY nombre ASC',
            [negocio_id]
        );
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

router.post('/', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || 1;
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

        const resultado = await db.query(
            'INSERT INTO categorias (nombre, negocio_id) VALUES ($1, $2) RETURNING *',
            [nombre, negocio_id]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear categoría' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || 1;
        await db.query(
            'DELETE FROM categorias WHERE id = $1 AND negocio_id = $2',
            [req.params.id, negocio_id]
        );
        res.json({ mensaje: 'Categoría eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar categoría' });
    }
});

module.exports = router;