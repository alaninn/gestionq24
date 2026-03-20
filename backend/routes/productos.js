const express = require('express');
const { verificarPermiso } = require('../middleware/auth');
const router = express.Router();
const db = require('../config/database');


router.get('/', async (req, res) => {
    try {
        const { buscar, categoria, pagina, limite = 50 } = req.query;
        const negocio_id = req.usuario.negocio_id || 1;

        let whereClause = 'WHERE p.activo = TRUE AND p.negocio_id = $1';
        let valores = [negocio_id];
        let contador = 2;

        if (buscar) {
            const palabras = buscar.trim().split(/\s+/).filter(p => p.length > 0);
            for (const palabra of palabras) {
                whereClause += ` AND (
                    p.nombre ILIKE $${contador}
                    OR p.codigo ILIKE $${contador}
                    OR EXISTS (
                        SELECT 1 FROM producto_codigos pc
                        WHERE pc.producto_id = p.id AND pc.codigo ILIKE $${contador}
                    )
                )`;
                valores.push(`%${palabra}%`);
                contador++;
            }
        }

        if (categoria) {
            whereClause += ` AND p.categoria_id = $${contador}`;
            valores.push(categoria);
            contador++;
        }

        // Sin paginación → devuelve array directo (para el POS)
        if (!pagina) {
            const resultado = await db.query(`
                SELECT p.*, c.nombre AS categoria_nombre
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                ${whereClause}
                ORDER BY p.nombre ASC
                
            `, valores);
            return res.json(resultado.rows);
        }

        // Con paginación → devuelve objeto (para admin)
        const paginaNum = parseInt(pagina) || 1;
        const limiteNum = parseInt(limite) || 50;
        const offset = (paginaNum - 1) * limiteNum;

        const totalRes = await db.query(`
            SELECT COUNT(*) FROM productos p ${whereClause}
        `, valores);
        const total = parseInt(totalRes.rows[0].count);

        const resultado = await db.query(`
            SELECT p.*, c.nombre AS categoria_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ${whereClause}
            ORDER BY p.nombre ASC
            LIMIT $${contador} OFFSET $${contador + 1}
        `, [...valores, limiteNum, offset]);

        res.json({
            productos: resultado.rows,
            total,
            pagina: paginaNum,
            limite: limiteNum,
            totalPaginas: Math.ceil(total / limiteNum),
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

router.get('/stock-bajo', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const resultado = await db.query(`
            SELECT p.*, c.nombre AS categoria_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.activo = TRUE AND p.negocio_id = $1
              AND p.stock <= p.stock_minimo
            ORDER BY p.stock ASC
        `, [negocio_id]);
        res.json(resultado.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener stock bajo' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const resultado = await db.query(`
            SELECT p.*, c.nombre AS categoria_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.id = $1 AND p.negocio_id = $2
        `, [req.params.id, negocio_id]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener producto' });
    }
});

router.post('/', verificarPermiso('productos', 'crear'), async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const {
            codigo, nombre, categoria_id, precio_costo,
            precio_venta, precio_mayorista, stock,
            stock_minimo, unidad, alicuota_iva, margen_ganancia
        } = req.body;

        if (!nombre || !precio_venta) {
            return res.status(400).json({ error: 'Nombre y precio de venta son obligatorios' });
        }

        let codigoFinal = codigo;
        if (!codigo || codigo.trim() === '') {
            let intentos = 0;
            let codigoUnico = false;
            while (!codigoUnico && intentos < 5) {
                const aleatorio = Math.floor(Math.random() * 900000 + 100000);
                codigoFinal = `INT-${aleatorio}`;
                const existe = await db.query(
                    'SELECT id FROM productos WHERE codigo = $1 AND negocio_id = $2',
                    [codigoFinal, negocio_id]
                );
                if (existe.rows.length === 0) codigoUnico = true;
                intentos++;
            }
        }

        const resultado = await db.query(`
            INSERT INTO productos (
                codigo, nombre, categoria_id, precio_costo,
                precio_venta, precio_mayorista, stock,
                stock_minimo, unidad, alicuota_iva, margen_ganancia, negocio_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING *
        `, [
            codigoFinal, nombre, categoria_id || null,
            precio_costo || 0, precio_venta,
            precio_mayorista || null, stock || 0,
            stock_minimo || 0, unidad || 'Uni',
            alicuota_iva || 21, margen_ganancia || 0, negocio_id
        ]);

        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe un producto con ese código' });
        }
        res.status(500).json({ error: 'Error al crear producto' });
    }
});

router.put('/:id', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const { id } = req.params;
        const {
            codigo, nombre, categoria_id, precio_costo,
            precio_venta, precio_mayorista, stock,
            stock_minimo, unidad, alicuota_iva, margen_ganancia
        } = req.body;

        let codigoFinal = codigo;
        if (!codigo || codigo.trim() === '') {
            let intentos = 0;
            let codigoUnico = false;
            while (!codigoUnico && intentos < 5) {
                const aleatorio = Math.floor(Math.random() * 900000 + 100000);
                codigoFinal = `INT-${aleatorio}`;
                const existe = await db.query(
                    'SELECT id FROM productos WHERE codigo = $1 AND id != $2 AND negocio_id = $3',
                    [codigoFinal, id, negocio_id]
                );
                if (existe.rows.length === 0) codigoUnico = true;
                intentos++;
            }
        }

        const resultado = await db.query(`
            UPDATE productos SET
                codigo = $1, nombre = $2, categoria_id = $3,
                precio_costo = $4, precio_venta = $5,
                precio_mayorista = $6, stock = $7,
                stock_minimo = $8, unidad = $9,
                alicuota_iva = $10, margen_ganancia = $11,
                updated_at = NOW()
            WHERE id = $12 AND negocio_id = $13
            RETURNING *
        `, [
            codigoFinal, nombre, categoria_id,
            precio_costo, precio_venta, precio_mayorista,
            stock, stock_minimo, unidad,
            alicuota_iva, margen_ganancia || 0, id, negocio_id
        ]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al editar producto' });
    }
});

router.delete('/:id', verificarPermiso('productos', 'eliminar'), async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        await db.query(
            'UPDATE productos SET activo = FALSE WHERE id = $1 AND negocio_id = $2',
            [req.params.id, negocio_id]
        );
        res.json({ mensaje: 'Producto desactivado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});


// -----------------------------------------------
// RUTA: POST /api/productos/:id/codigos
// FUNCIÓN: Agregar código alternativo
// -----------------------------------------------
router.post('/:id/codigos', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const { codigo } = req.body;

        console.log('Agregando código:', codigo, 'producto:', req.params.id, 'negocio:', negocio_id);

        if (!codigo) return res.status(400).json({ error: 'El código es obligatorio' });

        const existe = await db.query(
            'SELECT id FROM producto_codigos WHERE codigo = $1 AND negocio_id = $2',
            [codigo, negocio_id]
        );
        if (existe.rows.length > 0) {
            return res.status(400).json({ error: 'Ese código ya existe' });
        }

        const resultado = await db.query(
            'INSERT INTO producto_codigos (producto_id, codigo, negocio_id) VALUES ($1, $2, $3) RETURNING *',
            [req.params.id, codigo, negocio_id]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        console.error('Error completo codigos:', error.message);
        res.status(500).json({ error: 'Error al agregar código' });
    }
});
// -----------------------------------------------
// RUTA: DELETE /api/productos/codigos/:codigoId
// FUNCIÓN: Eliminar código alternativo
// -----------------------------------------------
router.delete('/codigos/:codigoId', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        await db.query(
            'DELETE FROM producto_codigos WHERE id = $1 AND negocio_id = $2',
            [req.params.codigoId, negocio_id]
        );
        res.json({ mensaje: 'Código eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar código' });
    }
});

module.exports = router;