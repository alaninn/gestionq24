// =============================================
// RUTAS: Secciones de Stock (stock_categorias)
// Categorías propias de la pantalla de Stock, independientes de las
// categorías de productos. Representan el orden físico del local
// (góndolas, heladeras, depósito) para hacer inventario más rápido.
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarPermiso } = require('../middleware/auth');

// GET /api/stock-categorias — listar secciones del negocio (con cantidad de productos)
router.get('/', verificarPermiso('productos', 'ver'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const r = await db.query(`
            SELECT sc.*,
                   (SELECT COUNT(*) FROM productos p WHERE p.stock_categoria_id = sc.id AND p.activo = TRUE) AS total_productos
            FROM stock_categorias sc
            WHERE sc.negocio_id = $1
            ORDER BY sc.orden ASC, sc.id ASC
        `, [negocio_id]);
        res.json(r.rows);
    } catch (error) {
        console.error('Error listando secciones de stock:', error);
        res.status(500).json({ error: 'Error al obtener las secciones' });
    }
});

// POST /api/stock-categorias — crear sección
router.post('/', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const nombre = String(req.body?.nombre || '').trim();
        if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

        const max = await db.query(
            'SELECT COALESCE(MAX(orden), 0) AS max FROM stock_categorias WHERE negocio_id = $1',
            [negocio_id]
        );
        const r = await db.query(
            'INSERT INTO stock_categorias (negocio_id, nombre, orden) VALUES ($1, $2, $3) RETURNING *',
            [negocio_id, nombre, parseInt(max.rows[0].max) + 1]
        );
        res.status(201).json(r.rows[0]);
    } catch (error) {
        console.error('Error creando sección de stock:', error);
        res.status(500).json({ error: 'Error al crear la sección' });
    }
});

// PUT /api/stock-categorias/reordenar — guarda el orden según la posición en el array
// (debe ir ANTES de /:id para que Express no lo confunda)
router.put('/reordenar', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const ids = (req.body?.ids || []).map(x => parseInt(x)).filter(x => !isNaN(x));
        if (ids.length === 0) return res.status(400).json({ error: 'Sin secciones para ordenar' });

        for (let i = 0; i < ids.length; i++) {
            await db.query(
                'UPDATE stock_categorias SET orden = $1 WHERE id = $2 AND negocio_id = $3',
                [i + 1, ids[i], negocio_id]
            );
        }
        res.json({ ok: true });
    } catch (error) {
        console.error('Error reordenando secciones:', error);
        res.status(500).json({ error: 'Error al reordenar las secciones' });
    }
});

// PUT /api/stock-categorias/:id — renombrar
router.put('/:id', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const nombre = String(req.body?.nombre || '').trim();
        if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

        const r = await db.query(
            'UPDATE stock_categorias SET nombre = $1 WHERE id = $2 AND negocio_id = $3 RETURNING *',
            [nombre, req.params.id, negocio_id]
        );
        if (r.rows.length === 0) return res.status(404).json({ error: 'Sección no encontrada' });
        res.json(r.rows[0]);
    } catch (error) {
        console.error('Error renombrando sección:', error);
        res.status(500).json({ error: 'Error al renombrar la sección' });
    }
});

// DELETE /api/stock-categorias/:id — eliminar (los productos quedan "sin ubicación")
router.delete('/:id', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        await db.query(
            'DELETE FROM stock_categorias WHERE id = $1 AND negocio_id = $2',
            [req.params.id, negocio_id]
        );
        res.json({ ok: true });
    } catch (error) {
        console.error('Error eliminando sección:', error);
        res.status(500).json({ error: 'Error al eliminar la sección' });
    }
});

module.exports = router;
