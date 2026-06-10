const express = require('express');
const { verificarPermiso } = require('../middleware/auth');
const { validarLimitePlan, LIMITES_PLANES } = require('../middleware/planLimites');
const router = express.Router();
const db = require('../config/database');


router.get('/', async (req, res) => {
    try {
        const { buscar, categoria, pagina, limite = 50 } = req.query;
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

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
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
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
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
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

router.post('/', verificarPermiso('productos', 'crear'), validarLimitePlan, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const {
            codigo, nombre, categoria_id, precio_costo,
            precio_venta, precio_mayorista, stock,
            stock_minimo, unidad, alicuota_iva, margen_ganancia
        } = req.body;

        if (!nombre || !precio_venta) {
            return res.status(400).json({ error: 'Nombre y precio de venta son obligatorios' });
        }

        // Verificar límite de productos según plan
        const plan = req.usuario?.plan || 'estandar';
        const limites = LIMITES_PLANES[plan] || LIMITES_PLANES.estandar;
        const countRes = await db.query(
            'SELECT COUNT(*) FROM productos WHERE negocio_id = $1 AND activo = TRUE',
            [negocio_id]
        );
        const totalActual = parseInt(countRes.rows[0].count);
        if (totalActual >= limites.max_productos) {
            return res.status(403).json({
                error: `Límite de ${limites.max_productos} productos alcanzado para el plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}. Para cargar más productos necesitás el Plan Premium.`,
                limitePlan: true,
                limite: limites.max_productos,
                plan
            });
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

// -----------------------------------------------
// RUTA: POST /api/productos/importar
// FUNCIÓN: Importación masiva con upsert (crea o actualiza por código)
//          Crea categorías que no existan. Reactiva productos desactivados.
// -----------------------------------------------
router.post('/importar', verificarPermiso('productos', 'crear'), async (req, res) => {
    const negocio_id = req.negocio_id || req.usuario?.negocio_id;
    if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

    const { productos } = req.body;
    if (!Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({ error: 'No se enviaron productos para importar' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Plan del negocio desde la BD (no del token, así funciona también para superadmin)
        const negRes = await client.query('SELECT plan FROM negocios WHERE id = $1', [negocio_id]);
        const plan = negRes.rows[0]?.plan || 'estandar';
        const limites = LIMITES_PLANES[plan] || LIMITES_PLANES.estandar;

        // Mapa de categorías existentes (nombre normalizado -> id)
        const catRes = await client.query('SELECT id, nombre FROM categorias WHERE negocio_id = $1', [negocio_id]);
        const catMap = new Map(catRes.rows.map(c => [c.nombre.trim().toLowerCase(), c.id]));

        // Cantidad de productos activos actuales (para el límite del plan)
        const countRes = await client.query('SELECT COUNT(*) FROM productos WHERE negocio_id = $1 AND activo = TRUE', [negocio_id]);
        let activosActuales = parseInt(countRes.rows[0].count);

        let creados = 0, actualizados = 0;
        const errores = [];

        // Genera un código interno único dentro del negocio
        const generarCodigoUnico = async () => {
            for (let intento = 0; intento < 8; intento++) {
                const cand = `INT-${Math.floor(Math.random() * 900000 + 100000)}`;
                const ex = await client.query('SELECT 1 FROM productos WHERE codigo = $1 AND negocio_id = $2', [cand, negocio_id]);
                if (ex.rows.length === 0) return cand;
            }
            return `INT-${Date.now()}`;
        };

        for (let i = 0; i < productos.length; i++) {
            const p = productos[i] || {};
            const nombre = (p.nombre ?? '').toString().trim();
            const precio_venta = parseFloat(p.precio_venta);
            if (!nombre || isNaN(precio_venta)) {
                errores.push(`Fila ${i + 2}: falta nombre o precio de venta válido`);
                continue;
            }

            // Resolver categoría (crear si no existe)
            let categoria_id = null;
            const catNombre = (p.categoria ?? '').toString().trim();
            if (catNombre) {
                const key = catNombre.toLowerCase();
                if (catMap.has(key)) {
                    categoria_id = catMap.get(key);
                } else {
                    const nuevaCat = await client.query(
                        'INSERT INTO categorias (nombre, negocio_id) VALUES ($1, $2) RETURNING id',
                        [catNombre, negocio_id]
                    );
                    categoria_id = nuevaCat.rows[0].id;
                    catMap.set(key, categoria_id);
                }
            }

            const codigo = (p.codigo ?? '').toString().trim();
            const precio_costo = parseFloat(p.precio_costo) || 0;
            const stock = parseInt(p.stock) || 0;
            const stock_minimo = parseInt(p.stock_minimo) || 0;
            const unidad = (p.unidad ?? 'Uni').toString().trim() || 'Uni';
            const ivaParsed = parseFloat(p.alicuota_iva);
            const alicuota_iva = isNaN(ivaParsed) ? 21 : ivaParsed;
            const margen = parseFloat(p.margen_ganancia) || 0;

            // ¿Ya existe un producto con ese código en este negocio?
            let existente = null;
            if (codigo) {
                const ex = await client.query(
                    'SELECT id FROM productos WHERE codigo = $1 AND negocio_id = $2',
                    [codigo, negocio_id]
                );
                existente = ex.rows[0] || null;
            }

            if (existente) {
                // Actualizar y reactivar el producto existente
                await client.query(`
                    UPDATE productos SET
                        nombre = $1, categoria_id = $2, precio_costo = $3, precio_venta = $4,
                        stock = $5, stock_minimo = $6, unidad = $7, alicuota_iva = $8,
                        margen_ganancia = $9, activo = TRUE, updated_at = NOW()
                    WHERE id = $10 AND negocio_id = $11
                `, [nombre, categoria_id, precio_costo, precio_venta, stock, stock_minimo, unidad, alicuota_iva, margen, existente.id, negocio_id]);
                actualizados++;
            } else {
                // Producto nuevo → validar límite del plan
                if (activosActuales >= limites.max_productos) {
                    errores.push(`Fila ${i + 2}: límite de ${limites.max_productos} productos del plan ${plan} alcanzado`);
                    continue;
                }
                const codigoFinal = codigo || await generarCodigoUnico();
                await client.query(`
                    INSERT INTO productos (codigo, nombre, categoria_id, precio_costo, precio_venta, stock, stock_minimo, unidad, alicuota_iva, margen_ganancia, negocio_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                `, [codigoFinal, nombre, categoria_id, precio_costo, precio_venta, stock, stock_minimo, unidad, alicuota_iva, margen, negocio_id]);
                creados++;
                activosActuales++;
            }
        }

        await client.query('COMMIT');
        res.json({ creados, actualizados, errores, total: productos.length });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error importando productos:', error);
        res.status(500).json({ error: 'Error al importar productos' });
    } finally {
        client.release();
    }
});

// -----------------------------------------------
// RUTA: POST /api/productos/eliminar-masivo
// FUNCIÓN: Desactiva varios productos a la vez (o todos)
//          Soft delete para no romper el historial de ventas (venta_items)
// -----------------------------------------------
router.post('/eliminar-masivo', verificarPermiso('productos', 'eliminar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const { ids, todos } = req.body;

        if (todos === true) {
            const r = await db.query(
                'UPDATE productos SET activo = FALSE WHERE negocio_id = $1 AND activo = TRUE',
                [negocio_id]
            );
            return res.json({ eliminados: r.rowCount });
        }

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No se seleccionaron productos para eliminar' });
        }

        const idsNum = ids.map(x => parseInt(x)).filter(x => !isNaN(x));
        const r = await db.query(
            'UPDATE productos SET activo = FALSE WHERE negocio_id = $1 AND id = ANY($2::int[])',
            [negocio_id, idsNum]
        );
        res.json({ eliminados: r.rowCount });
    } catch (error) {
        console.error('Error eliminación masiva:', error);
        res.status(500).json({ error: 'Error al eliminar productos' });
    }
});

router.put('/:id', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
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
      const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        await db.query(
            'UPDATE productos SET activo = FALSE WHERE id = $1 AND negocio_id = $2',
            [req.params.id, negocio_id]
        );
        res.json({ mensaje: 'Producto desactivado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

// =============================================
// Ajustar stock y registrar historial
// =============================================
router.put('/:id/stock', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const { stock } = req.body;
        const nuevoStock = parseInt(stock, 10);
        if (isNaN(nuevoStock) || nuevoStock < 0) {
            return res.status(400).json({ error: 'Stock inválido' });
        }

        const productoRes = await db.query('SELECT stock FROM productos WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        if (productoRes.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

        const stockAnterior = parseInt(productoRes.rows[0].stock || 0, 10);

        await db.query('UPDATE productos SET stock = $1 WHERE id = $2 AND negocio_id = $3', [nuevoStock, req.params.id, negocio_id]);

        await db.query(
            'INSERT INTO historial_stock (negocio_id, producto_id, stock_anterior, stock_nuevo) VALUES ($1, $2, $3, $4)',
            [negocio_id, req.params.id, stockAnterior, nuevoStock]
        );

        const productoActualizado = await db.query('SELECT * FROM productos WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        res.json(productoActualizado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar stock' });
    }
});

router.get('/:id/historial-stock', verificarPermiso('productos', 'ver'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const historial = await db.query(
            `SELECT hs.*, p.nombre AS producto_nombre
             FROM historial_stock hs
             LEFT JOIN productos p ON hs.producto_id = p.id
             WHERE hs.producto_id = $1 AND hs.negocio_id = $2
             ORDER BY hs.fecha DESC`,
            [req.params.id, negocio_id]
        );

        res.json(historial.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener historial de stock' });
    }
});


// -----------------------------------------------
// RUTA: POST /api/productos/:id/codigos
// FUNCIÓN: Agregar código alternativo
// -----------------------------------------------
router.post('/:id/codigos', async (req, res) => {
    try {
       const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
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
       const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        await db.query(
            'DELETE FROM producto_codigos WHERE id = $1 AND negocio_id = $2',
            [req.params.codigoId, negocio_id]
        );
        res.json({ mensaje: 'Código eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar código' });
    }
});

// GET /api/productos/buscar-codigo/:codigo
// Búsqueda exacta por código principal o alternativo — optimizada para scanner
router.get('/buscar-codigo/:codigo', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { codigo } = req.params;

        // Buscar primero por código principal exacto
        const porCodigoPrincipal = await db.query(`
            SELECT p.*, c.nombre AS categoria_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.activo = TRUE 
              AND p.negocio_id = $1
              AND LOWER(p.codigo) = LOWER($2)
            LIMIT 1
        `, [negocio_id, codigo]);

        if (porCodigoPrincipal.rows.length > 0) {
            return res.json({ encontrado: true, producto: porCodigoPrincipal.rows[0] });
        }

        // Si no encontró, buscar en códigos alternativos
        const porCodigoAlternativo = await db.query(`
            SELECT p.*, c.nombre AS categoria_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            INNER JOIN producto_codigos pc ON pc.producto_id = p.id
            WHERE p.activo = TRUE
              AND p.negocio_id = $1
              AND LOWER(pc.codigo) = LOWER($2)
            LIMIT 1
        `, [negocio_id, codigo]);

        if (porCodigoAlternativo.rows.length > 0) {
            return res.json({ encontrado: true, producto: porCodigoAlternativo.rows[0] });
        }

        res.json({ encontrado: false, producto: null });
    } catch (error) {
        console.error('Error búsqueda scanner:', error);
        res.status(500).json({ error: 'Error al buscar producto' });
    }
});

module.exports = router;
