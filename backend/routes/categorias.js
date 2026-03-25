const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
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
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
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

// Endpoint para obtener o crear la categoría por defecto
router.post('/default', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        // Buscar si ya existe "General"
        const existe = await db.query(
            'SELECT * FROM categorias WHERE negocio_id = $1 AND nombre ILIKE $2',
            [negocio_id, 'General']
        );

        if (existe.rows.length > 0) {
            return res.json(existe.rows[0]);
        }

        // Crear "General" si no existe
        const nueva = await db.query(
            'INSERT INTO categorias (nombre, negocio_id) VALUES ($1, $2) RETURNING *',
            ['General', negocio_id]
        );
        res.status(201).json(nueva.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener categoría por defecto' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        // Verificar si hay productos usando esta categoría
        const productos = await db.query(
            'SELECT COUNT(*) FROM productos WHERE categoria_id = $1 AND negocio_id = $2 AND activo = TRUE',
            [req.params.id, negocio_id]
        );

        if (parseInt(productos.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: `No podés eliminar esta categoría porque tiene ${productos.rows[0].count} producto(s) asociado(s). Primero reasigná o eliminá esos productos.`
            });
        }

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