const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        // Incluye la cantidad de productos activos de cada categoría
        const resultado = await db.query(`
            SELECT c.*, COUNT(p.id) FILTER (WHERE p.activo = TRUE) AS total_productos
            FROM categorias c
            LEFT JOIN productos p ON p.categoria_id = c.id AND p.negocio_id = c.negocio_id
            WHERE c.negocio_id = $1
            GROUP BY c.id
            ORDER BY c.nombre ASC
        `, [negocio_id]);
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

// Renombrar una categoría
router.put('/:id', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const nombre = (req.body.nombre || '').trim();
        if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
        const r = await db.query(
            'UPDATE categorias SET nombre = $1 WHERE id = $2 AND negocio_id = $3 RETURNING *',
            [nombre, req.params.id, negocio_id]
        );
        if (r.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
        res.json(r.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al renombrar la categoría' });
    }
});

// Unir categorías: mueve todos los productos de 'origen' a 'destino' y borra 'origen'.
// Sirve para juntar categorías repetidas (ej: "Cigarrillos" y "cigarrillos").
router.post('/unir', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const origen_id = parseInt(req.body.origen_id, 10);
        const destino_id = parseInt(req.body.destino_id, 10);
        if (!origen_id || !destino_id) return res.status(400).json({ error: 'Elegí las dos categorías' });
        if (origen_id === destino_id) return res.status(400).json({ error: 'Tienen que ser categorías distintas' });

        // Ambas deben ser del negocio
        const cats = await db.query(
            'SELECT id FROM categorias WHERE id = ANY($1) AND negocio_id = $2',
            [[origen_id, destino_id], negocio_id]
        );
        if (cats.rows.length !== 2) return res.status(404).json({ error: 'Categoría no encontrada' });

        // Mover los productos de origen a destino
        const upd = await db.query(
            'UPDATE productos SET categoria_id = $1 WHERE categoria_id = $2 AND negocio_id = $3',
            [destino_id, origen_id, negocio_id]
        );
        // Borrar la categoría origen (ya quedó vacía)
        await db.query('DELETE FROM categorias WHERE id = $1 AND negocio_id = $2', [origen_id, negocio_id]);

        res.json({ mensaje: 'Categorías unidas', productos_movidos: upd.rowCount });
    } catch (error) {
        console.error('Error al unir categorías:', error);
        res.status(500).json({ error: 'Error al unir las categorías' });
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