const express = require('express');
const { verificarPermiso } = require('../middleware/auth');
const { validarLimitePlan, LIMITES_PLANES } = require('../middleware/planLimites');
const router = express.Router();
const db = require('../config/database');

// Para productos COMBINADOS el stock no es propio: es lo que alcanza del
// componente más escaso = MIN(FLOOR(stock_componente / cantidad_en_combo)).
// Se calcula al vuelo y sobrescribe el `stock` que viene de p.* (node-pg toma
// la última columna con el mismo nombre).
const SELECT_STOCK_COMBO = `CASE WHEN p.es_combinado THEN COALESCE((
        SELECT MIN(FLOOR(comp.stock / NULLIF(cc.cantidad, 0)))
        FROM producto_combo cc
        JOIN productos comp ON comp.id = cc.producto_id
        WHERE cc.combo_id = p.id
    ), 0) ELSE p.stock END AS stock`;

// Devuelve los componentes de un combo (para mostrar/editar).
async function obtenerComponentesCombo(combo_id, negocio_id) {
    const r = await db.query(`
        SELECT cc.producto_id, cc.cantidad, p.nombre, p.precio_costo, p.stock, p.unidad
        FROM producto_combo cc
        JOIN productos p ON p.id = cc.producto_id
        WHERE cc.combo_id = $1 AND cc.negocio_id = $2
        ORDER BY p.nombre ASC
    `, [combo_id, negocio_id]);
    return r.rows;
}

// Calcula el costo del combo (suma costo de cada componente * cantidad) y valida
// que existan y que ninguno sea a su vez un combinado. Usa el client de la tx.
async function calcularCostoCombo(client, negocio_id, componentes) {
    let costo = 0;
    for (const c of componentes) {
        const pid = parseInt(c.producto_id, 10);
        const cant = parseFloat(c.cantidad) || 0;
        if (!pid || cant <= 0) throw new Error('Componente inválido');
        const r = await client.query(
            'SELECT precio_costo, es_combinado FROM productos WHERE id = $1 AND negocio_id = $2',
            [pid, negocio_id]
        );
        if (r.rows.length === 0) throw new Error('Un componente no existe');
        if (r.rows[0].es_combinado) throw new Error('Un combinado no puede contener otro combinado');
        costo += (parseFloat(r.rows[0].precio_costo) || 0) * cant;
    }
    return costo;
}


router.get('/', async (req, res) => {
    try {
        const { buscar, categoria, pagina, limite = 50, stock_bajo, rapida } = req.query;
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        let whereClause = 'WHERE p.activo = TRUE AND p.negocio_id = $1';
        let valores = [negocio_id];
        let contador = 2;

        // Orden por relevancia cuando hay búsqueda:
        //  0 = el nombre EMPIEZA con la primera palabra buscada ("leche" → "Leche Serenísima")
        //  1 = alguna palabra del nombre empieza con lo buscado ("...dulce de Leche")
        //  2 = coincidencia en cualquier parte / por código
        // No afecta QUÉ se encuentra (la búsqueda multi-palabra "coca 2.25" sigue igual),
        // solo el ORDEN de los resultados.
        let ordenarPor = 'p.nombre ASC';
        let paramsOrden = [];

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

            if (palabras.length > 0) {
                // Parámetros del ranking separados de `valores` (el COUNT de la
                // paginación usa solo `valores` y no debe recibir parámetros de más)
                paramsOrden = [`${palabras[0]}%`, `% ${palabras[0]}%`];
                ordenarPor = `CASE
                    WHEN p.nombre ILIKE $${contador} THEN 0
                    WHEN p.nombre ILIKE $${contador + 1} THEN 1
                    ELSE 2 END, p.nombre ASC`;
                contador += 2;
            }
        }

        if (categoria) {
            whereClause += ` AND p.categoria_id = $${contador}`;
            valores.push(categoria);
            contador++;
        }

        // Filtro de stock bajo (stock por debajo o igual al mínimo configurado)
        if (stock_bajo === '1') {
            whereClause += ' AND p.stock <= p.stock_minimo';
        }

        // Sin paginación → devuelve array directo (para el POS)
        // rapida=1: limita los resultados (la búsqueda del POS no necesita cientos de filas)
        if (!pagina) {
            const limiteRapido = rapida === '1' ? 'LIMIT 60' : '';
            const resultado = await db.query(`
                SELECT p.*, c.nombre AS categoria_nombre, ${SELECT_STOCK_COMBO}
                FROM productos p
                LEFT JOIN categorias c ON p.categoria_id = c.id
                ${whereClause}
                ORDER BY ${ordenarPor}
                ${limiteRapido}
            `, [...valores, ...paramsOrden]);
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
            SELECT p.*, c.nombre AS categoria_nombre, ${SELECT_STOCK_COMBO}
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ${whereClause}
            ORDER BY ${ordenarPor}
            LIMIT $${contador} OFFSET $${contador + 1}
        `, [...valores, ...paramsOrden, limiteNum, offset]);

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

// Productos cargados rápido que necesitan que un admin complete sus datos
router.get('/por-revisar', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const resultado = await db.query(`
            SELECT p.*, c.nombre AS categoria_nombre
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.activo = TRUE AND p.negocio_id = $1 AND p.requiere_revision = TRUE
            ORDER BY p.created_at DESC NULLS LAST, p.id DESC
        `, [negocio_id]);
        res.json(resultado.rows);
    } catch (error) {
        console.error('Error productos por revisar:', error);
        res.status(500).json({ error: 'Error al obtener productos por revisar' });
    }
});

// CATÁLOGO LIVIANO para cache offline del POS: todos los productos activos del
// negocio con sus códigos de barra, para poder buscar/escanear sin internet.
router.get('/catalogo', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const resultado = await db.query(`
            SELECT p.id, p.nombre, p.codigo, p.precio_venta, p.precio_mayorista,
                   p.stock, p.unidad, p.requiere_revision,
                   COALESCE(ARRAY_AGG(pc.codigo) FILTER (WHERE pc.codigo IS NOT NULL), '{}') AS codigos
            FROM productos p
            LEFT JOIN producto_codigos pc ON pc.producto_id = p.id
            WHERE p.activo = TRUE AND p.negocio_id = $1
            GROUP BY p.id
            ORDER BY p.nombre ASC
        `, [negocio_id]);
        res.json({ productos: resultado.rows, fecha: new Date().toISOString() });
    } catch (error) {
        console.error('Error obteniendo catálogo:', error);
        res.status(500).json({ error: 'Error al obtener el catálogo' });
    }
});

// Alta RÁPIDA desde el POS: solo el nombre es obligatorio; precio y código
// son opcionales. Queda marcado requiere_revision para que un admin lo complete.
// Lo puede usar cualquiera que venda (permiso ventas:crear).
router.post('/rapido', verificarPermiso('ventas', 'crear'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const nombre = (req.body.nombre || '').trim();
        if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

        const precio = parseFloat(req.body.precio_venta) || 0;
        let codigo = (req.body.codigo || '').trim();

        // Código: si lo cargaron, validar que no exista; si no, generar uno interno
        if (codigo) {
            const ex = await db.query('SELECT id FROM productos WHERE codigo = $1 AND negocio_id = $2', [codigo, negocio_id]);
            if (ex.rows.length > 0) {
                return res.status(400).json({ error: 'Ya existe un producto con ese código de barras' });
            }
        } else {
            codigo = `INT-${Math.floor(Math.random() * 900000 + 100000)}`;
        }

        const resultado = await db.query(`
            INSERT INTO productos (codigo, nombre, precio_venta, precio_costo, stock, stock_minimo, unidad, alicuota_iva, margen_ganancia, negocio_id, requiere_revision)
            VALUES ($1, $2, $3, 0, 0, 0, 'Uni', 0, 0, $4, TRUE)
            RETURNING *
        `, [codigo, nombre, precio, negocio_id]);

        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe un producto con ese código' });
        }
        console.error('Error alta rápida:', error);
        res.status(500).json({ error: 'Error al dar de alta el producto' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const resultado = await db.query(`
            SELECT p.*, c.nombre AS categoria_nombre, ${SELECT_STOCK_COMBO}
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.id = $1 AND p.negocio_id = $2
        `, [req.params.id, negocio_id]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        const producto = resultado.rows[0];
        if (producto.es_combinado) {
            producto.componentes = await obtenerComponentesCombo(producto.id, negocio_id);
        }
        res.json(producto);
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
            stock_minimo, unidad, alicuota_iva, margen_ganancia,
            es_combinado, componentes
        } = req.body;

        if (!nombre || !precio_venta) {
            return res.status(400).json({ error: 'Nombre y precio de venta son obligatorios' });
        }
        if (es_combinado && (!Array.isArray(componentes) || componentes.length === 0)) {
            return res.status(400).json({ error: 'Un producto combinado necesita al menos un componente' });
        }

        // Verificar límite de productos según plan. El superadmin tiene poder
        // total: puede cargar productos extra en cualquier negocio sin límite.
        if (req.usuario?.rol !== 'superadmin') {
            const plan = req.planUsuario || req.usuario?.plan || 'estandar';
            const limites = req.limitesPlan || LIMITES_PLANES[plan] || LIMITES_PLANES.estandar;
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

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // El costo de un combo es la suma del costo de sus componentes; su
            // stock no es propio (se calcula al vuelo), por eso va en 0.
            let costoFinal = precio_costo || 0;
            if (es_combinado) {
                costoFinal = await calcularCostoCombo(client, negocio_id, componentes);
            }

            const resultado = await client.query(`
                INSERT INTO productos (
                    codigo, nombre, categoria_id, precio_costo,
                    precio_venta, precio_mayorista, stock,
                    stock_minimo, unidad, alicuota_iva, margen_ganancia, negocio_id, es_combinado
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                RETURNING *
            `, [
                codigoFinal, nombre, categoria_id || null,
                costoFinal, precio_venta,
                precio_mayorista || null, es_combinado ? 0 : (stock || 0),
                stock_minimo || 0, unidad || 'Uni',
                alicuota_iva || 21, margen_ganancia || 0, negocio_id, !!es_combinado
            ]);

            const nuevoId = resultado.rows[0].id;
            if (es_combinado) {
                for (const c of componentes) {
                    await client.query(
                        'INSERT INTO producto_combo (negocio_id, combo_id, producto_id, cantidad) VALUES ($1,$2,$3,$4)',
                        [negocio_id, nuevoId, parseInt(c.producto_id, 10), parseFloat(c.cantidad) || 1]
                    );
                }
            }

            await client.query('COMMIT');
            res.status(201).json(resultado.rows[0]);
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe un producto con ese código' });
        }
        res.status(500).json({ error: error.message || 'Error al crear producto' });
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

        // Plan del negocio desde la BD (no del token, así funciona también para superadmin).
        // El superadmin importa sin límite de productos.
        const negRes = await client.query('SELECT plan FROM negocios WHERE id = $1', [negocio_id]);
        const plan = negRes.rows[0]?.plan || 'estandar';
        const limitesBase = req.limitesPlan || LIMITES_PLANES[plan] || LIMITES_PLANES.estandar;
        const limites = req.usuario?.rol === 'superadmin'
            ? { ...limitesBase, max_productos: Infinity }
            : limitesBase;

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
            // Si el archivo no trae IVA, queda en 0 para NO alterar el precio de venta final
            // (el precio del archivo es el que vale; el usuario carga el IVA después si lo necesita)
            const ivaParsed = parseFloat(p.alicuota_iva);
            const alicuota_iva = isNaN(ivaParsed) ? 0 : ivaParsed;
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

// -----------------------------------------------
// RUTA: POST /api/productos/precios-masivo
// FUNCIÓN: Actualización masiva de precios.
//   alcance: 'todos' | 'categoria' (requiere categoria_id) | 'seleccion' (requiere ids)
//   campo:   'precio_venta' | 'precio_costo' | 'ambos'
//   operacion: 'porcentaje' (valor +/- %) | 'monto' (suma/resta $) | 'fijar' (setea precio exacto)
// -----------------------------------------------
router.post('/precios-masivo', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const { alcance, categoria_id, ids, campo, operacion, valor } = req.body;

        const valorNum = parseFloat(valor);
        if (isNaN(valorNum)) return res.status(400).json({ error: 'Valor inválido' });

        const camposValidos = ['precio_venta', 'precio_costo', 'ambos'];
        if (!camposValidos.includes(campo)) return res.status(400).json({ error: 'Campo inválido' });
        if (!['porcentaje', 'monto', 'fijar'].includes(operacion)) return res.status(400).json({ error: 'Operación inválida' });
        if (operacion === 'fijar' && campo === 'ambos') {
            return res.status(400).json({ error: 'Para fijar un precio exacto elegí venta o costo, no ambos' });
        }
        if (operacion === 'fijar' && valorNum < 0) return res.status(400).json({ error: 'El precio no puede ser negativo' });

        // Expresión SQL para el nuevo valor de un campo
        const expr = (col) => {
            if (operacion === 'porcentaje') return `GREATEST(0, ROUND(${col} * (1 + ${valorNum} / 100.0)))`;
            if (operacion === 'monto') return `GREATEST(0, ROUND(${col} + ${valorNum}))`;
            return `${valorNum}`; // fijar
        };

        const sets = campo === 'ambos'
            ? `precio_venta = ${expr('precio_venta')}, precio_costo = ${expr('precio_costo')}`
            : `${campo} = ${expr(campo)}`;

        // Alcance
        let where = 'negocio_id = $1 AND activo = TRUE';
        const params = [negocio_id];
        if (alcance === 'categoria') {
            const catId = parseInt(categoria_id);
            if (isNaN(catId)) return res.status(400).json({ error: 'Categoría inválida' });
            params.push(catId);
            where += ` AND categoria_id = $${params.length}`;
        } else if (alcance === 'seleccion') {
            const idsNum = (ids || []).map(x => parseInt(x)).filter(x => !isNaN(x));
            if (idsNum.length === 0) return res.status(400).json({ error: 'No se seleccionaron productos' });
            params.push(idsNum);
            where += ` AND id = ANY($${params.length}::int[])`;
        } else if (alcance !== 'todos') {
            return res.status(400).json({ error: 'Alcance inválido' });
        }

        const r = await db.query(`UPDATE productos SET ${sets}, updated_at = NOW() WHERE ${where}`, params);
        res.json({ actualizados: r.rowCount });
    } catch (error) {
        console.error('Error actualización masiva de precios:', error);
        res.status(500).json({ error: 'Error al actualizar precios' });
    }
});

// -----------------------------------------------
// RUTA: POST /api/productos/categoria-masivo
// FUNCIÓN: Asigna una categoría a varios productos a la vez
// -----------------------------------------------
router.post('/categoria-masivo', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const { ids, categoria_id } = req.body;
        const idsNum = (ids || []).map(x => parseInt(x)).filter(x => !isNaN(x));
        const catId = parseInt(categoria_id);
        if (idsNum.length === 0) return res.status(400).json({ error: 'No se seleccionaron productos' });
        if (isNaN(catId)) return res.status(400).json({ error: 'Categoría inválida' });

        // Verificar que la categoría sea del negocio
        const cat = await db.query('SELECT id FROM categorias WHERE id = $1 AND negocio_id = $2', [catId, negocio_id]);
        if (cat.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });

        const r = await db.query(
            'UPDATE productos SET categoria_id = $1, updated_at = NOW() WHERE negocio_id = $2 AND id = ANY($3::int[])',
            [catId, negocio_id, idsNum]
        );
        res.json({ actualizados: r.rowCount });
    } catch (error) {
        console.error('Error cambio masivo de categoría:', error);
        res.status(500).json({ error: 'Error al cambiar categoría' });
    }
});

// -----------------------------------------------
// RUTA: PUT /api/productos/stock-organizar
// FUNCIÓN: Asigna un producto a una sección de la pantalla de Stock
//          (queda al final de la sección destino)
// -----------------------------------------------
router.put('/stock-organizar', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const producto_id = parseInt(req.body?.producto_id);
        if (isNaN(producto_id)) return res.status(400).json({ error: 'producto_id requerido' });

        // null = "sin ubicación"
        const catId = req.body?.stock_categoria_id != null ? parseInt(req.body.stock_categoria_id) : null;

        if (catId !== null) {
            const cat = await db.query('SELECT id FROM stock_categorias WHERE id = $1 AND negocio_id = $2', [catId, negocio_id]);
            if (cat.rows.length === 0) return res.status(404).json({ error: 'Sección no encontrada' });
        }

        const max = await db.query(
            'SELECT COALESCE(MAX(stock_orden), 0) AS max FROM productos WHERE negocio_id = $1 AND stock_categoria_id IS NOT DISTINCT FROM $2',
            [negocio_id, catId]
        );

        await db.query(
            'UPDATE productos SET stock_categoria_id = $1, stock_orden = $2 WHERE id = $3 AND negocio_id = $4',
            [catId, parseInt(max.rows[0].max) + 1, producto_id, negocio_id]
        );
        res.json({ ok: true });
    } catch (error) {
        console.error('Error organizando producto:', error);
        res.status(500).json({ error: 'Error al mover el producto' });
    }
});

// -----------------------------------------------
// RUTA: PUT /api/productos/stock-reordenar
// FUNCIÓN: Guarda el orden de los productos dentro de una sección
//          según la posición que tienen en el array recibido
// -----------------------------------------------
router.put('/stock-reordenar', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const ids = (req.body?.ids || []).map(x => parseInt(x)).filter(x => !isNaN(x));
        if (ids.length === 0) return res.status(400).json({ error: 'Sin productos para ordenar' });

        for (let i = 0; i < ids.length; i++) {
            await db.query(
                'UPDATE productos SET stock_orden = $1 WHERE id = $2 AND negocio_id = $3',
                [i + 1, ids[i], negocio_id]
            );
        }
        res.json({ ok: true });
    } catch (error) {
        console.error('Error reordenando productos:', error);
        res.status(500).json({ error: 'Error al guardar el orden' });
    }
});

// =============================================
// RUTA: POST /api/productos/stock-sumar
// SUMA existencias al stock actual (recepción de mercadería / compra). A diferencia
// de PUT /:id/stock (que reemplaza), acá se SUMA un delta, por eso maneja bien los
// negativos: si el stock estaba en -1 y se suman 10, queda 9. Acepta uno o varios.
// body: { items: [{ id, cantidad }] }
// =============================================
router.post('/stock-sumar', verificarPermiso('productos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        if (items.length === 0) return res.status(400).json({ error: 'No hay productos para actualizar' });

        const actualizados = [];
        for (const it of items) {
            const id = parseInt(it.id, 10);
            const delta = parseInt(it.cantidad, 10);
            if (!id || isNaN(delta) || delta === 0) continue;

            const p = await db.query('SELECT stock FROM productos WHERE id = $1 AND negocio_id = $2', [id, negocio_id]);
            if (p.rows.length === 0) continue;

            const anterior = parseInt(p.rows[0].stock || 0, 10);
            const nuevo = anterior + delta; // puede quedar negativo si aún falta mercadería

            await db.query('UPDATE productos SET stock = $1 WHERE id = $2 AND negocio_id = $3', [nuevo, id, negocio_id]);
            await db.query(
                'INSERT INTO historial_stock (negocio_id, producto_id, stock_anterior, stock_nuevo) VALUES ($1, $2, $3, $4)',
                [negocio_id, id, anterior, nuevo]
            );
            actualizados.push({ id, stock_anterior: anterior, stock: nuevo });
        }

        if (actualizados.length === 0) return res.status(400).json({ error: 'No se actualizó ningún producto' });
        res.json({ actualizados });
    } catch (error) {
        console.error('Error al sumar stock:', error);
        res.status(500).json({ error: 'Error al sumar el stock' });
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
            stock_minimo, unidad, alicuota_iva, margen_ganancia,
            es_combinado, componentes
        } = req.body;

        if (es_combinado && (!Array.isArray(componentes) || componentes.length === 0)) {
            return res.status(400).json({ error: 'Un producto combinado necesita al menos un componente' });
        }

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

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // No permitir convertir en combinado un producto que ya es componente
            // de otro combo (evita anidar combos indirectamente).
            if (es_combinado) {
                const usado = await client.query('SELECT 1 FROM producto_combo WHERE producto_id = $1 AND negocio_id = $2 LIMIT 1', [id, negocio_id]);
                if (usado.rows.length > 0) throw new Error('Este producto ya es componente de un combo: no puede ser combinado a la vez');
            }

            // El costo y el stock de un combo los maneja el sistema (costo = suma de
            // componentes; stock = calculado). Para un producto normal, lo enviado.
            let costoFinal = precio_costo;
            let stockFinal = stock;
            if (es_combinado) {
                costoFinal = await calcularCostoCombo(client, negocio_id, componentes);
                stockFinal = 0;
            }

            const resultado = await client.query(`
                UPDATE productos SET
                    codigo = $1, nombre = $2, categoria_id = $3,
                    precio_costo = $4, precio_venta = $5,
                    precio_mayorista = $6, stock = $7,
                    stock_minimo = $8, unidad = $9,
                    alicuota_iva = $10, margen_ganancia = $11,
                    es_combinado = $14,
                    requiere_revision = CASE WHEN $5::numeric > 0 THEN FALSE ELSE requiere_revision END,
                    updated_at = NOW()
                WHERE id = $12 AND negocio_id = $13
                RETURNING *
            `, [
                codigoFinal, nombre, categoria_id,
                costoFinal, precio_venta, precio_mayorista,
                stockFinal, stock_minimo, unidad,
                alicuota_iva, margen_ganancia || 0, id, negocio_id, !!es_combinado
            ]);

            if (resultado.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Producto no encontrado' });
            }

            // Reescribir los componentes del combo (o limpiarlos si dejó de serlo)
            await client.query('DELETE FROM producto_combo WHERE combo_id = $1 AND negocio_id = $2', [id, negocio_id]);
            if (es_combinado) {
                for (const c of componentes) {
                    await client.query(
                        'INSERT INTO producto_combo (negocio_id, combo_id, producto_id, cantidad) VALUES ($1,$2,$3,$4)',
                        [negocio_id, id, parseInt(c.producto_id, 10), parseFloat(c.cantidad) || 1]
                    );
                }
            }

            await client.query('COMMIT');
            res.json(resultado.rows[0]);
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }
    } catch (error) {
        res.status(500).json({ error: error.message || 'Error al editar producto' });
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
