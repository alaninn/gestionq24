const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../config/database');
const { soloAdmin } = require('../middleware/auth');
const { ajustarStock, disponibleCombo } = require('../helpers/stock');

// =============================================
// MULTINEGOCIO (premium)
// - Vincular negocios propios en un mismo "grupo_multinegocio".
// - Ver de cada uno su vencimiento + estadísticas y acceder (cambia de sesión).
// - Mover mercadería entre negocios del grupo (solo stock, con valor de costo).
// El router se monta con verificarToken + validarLimitePlan + puedeUsarFuncion('multinegocio').
// =============================================

// Capacidad multinegocio: la da el plan (planes_config.multinegocio, editable por
// el superadmin) o un override puntual del negocio (negocios.multinegocio_habilitado).
async function verificarMultinegocio(req, res, next) {
    try {
        if (req.esSuperadmin || req.usuario?.rol === 'superadmin') return next();
        if (req.limitesPlan?.multinegocio === true) return next();
        const r = await db.query('SELECT multinegocio_habilitado FROM negocios WHERE id = $1', [req.negocio_id]);
        if (r.rows[0]?.multinegocio_habilitado === true) return next();
        return res.status(403).json({
            error: 'La función Multinegocio no está habilitada para este negocio.',
            requierePremium: true,
        });
    } catch (e) {
        return res.status(500).json({ error: 'Error al verificar la función' });
    }
}
router.use(verificarMultinegocio);

// Rate limit simple para el vínculo (mismo espíritu que el login).
const intentosVinculo = new Map();
const MAX_INTENTOS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// Devuelve la lista de negocios del grupo del negocio actual (incluido él).
async function listarMisNegocios(negocioActualId, exec = db) {
    const r = await exec.query(`
        SELECT n.id, n.nombre, n.plan, n.estado, n.fecha_vencimiento, n.color_primario,
               (n.id = $1) AS es_actual,
               (SELECT COUNT(*) FROM productos WHERE negocio_id = n.id AND activo = TRUE) AS total_productos,
               (SELECT COUNT(*) FROM ventas WHERE negocio_id = n.id) AS total_ventas,
               (SELECT COUNT(*) FROM ventas WHERE negocio_id = n.id AND fecha > NOW() - INTERVAL '30 days') AS ventas_30d,
               (SELECT COALESCE(SUM(total),0) FROM ventas WHERE negocio_id = n.id AND fecha > NOW() - INTERVAL '30 days') AS facturado_30d,
               (SELECT MAX(fecha) FROM ventas WHERE negocio_id = n.id) AS ultima_venta
        FROM negocios n
        WHERE n.id = $1
           OR (n.grupo_multinegocio IS NOT NULL
               AND n.grupo_multinegocio = (SELECT grupo_multinegocio FROM negocios WHERE id = $1))
        ORDER BY es_actual DESC, n.nombre ASC
    `, [negocioActualId]);
    return r.rows;
}

// Resuelve el producto equivalente en el negocio destino: 1º por código de
// barras (productos.codigo), 2º por código alternativo (producto_codigos),
// 3º por nombre exacto. Devuelve { id, match_por } o null.
async function resolverProductoDestino(destinoId, codigo, nombre, exec = db) {
    if (codigo && String(codigo).trim() !== '') {
        const porCodigo = await exec.query(
            'SELECT id FROM productos WHERE negocio_id = $1 AND activo = TRUE AND LOWER(TRIM(codigo)) = LOWER(TRIM($2)) LIMIT 1',
            [destinoId, String(codigo)]
        );
        if (porCodigo.rows[0]) return { id: porCodigo.rows[0].id, match_por: 'codigo' };

        const porAlt = await exec.query(
            'SELECT producto_id FROM producto_codigos WHERE negocio_id = $1 AND LOWER(TRIM(codigo)) = LOWER(TRIM($2)) LIMIT 1',
            [destinoId, String(codigo)]
        );
        if (porAlt.rows[0]) return { id: porAlt.rows[0].producto_id, match_por: 'codigo' };
    }
    if (nombre && String(nombre).trim() !== '') {
        const porNombre = await exec.query(
            'SELECT id FROM productos WHERE negocio_id = $1 AND activo = TRUE AND LOWER(TRIM(nombre)) = LOWER(TRIM($2)) LIMIT 1',
            [destinoId, String(nombre)]
        );
        if (porNombre.rows[0]) return { id: porNombre.rows[0].id, match_por: 'nombre' };
    }
    return null;
}

// Verifica que el negocio destino pertenezca al mismo grupo que el actual.
async function mismoGrupo(negocioActualId, destinoId, exec = db) {
    if (parseInt(destinoId) === parseInt(negocioActualId)) return false;
    const r = await exec.query(`
        SELECT 1 FROM negocios
        WHERE id = $2
          AND grupo_multinegocio IS NOT NULL
          AND grupo_multinegocio = (SELECT grupo_multinegocio FROM negocios WHERE id = $1)
        LIMIT 1
    `, [negocioActualId, destinoId]);
    return r.rows.length > 0;
}

// ---- GET /mis-negocios ----
router.get('/mis-negocios', soloAdmin, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const negocios = await listarMisNegocios(negocio_id);
        res.json({ negocio_actual_id: negocio_id, negocios });
    } catch (error) {
        console.error('Error mis-negocios:', error);
        res.status(500).json({ error: 'Error al listar los negocios' });
    }
});

// ---- GET /grupo ----  negocios del grupo (solo id + nombre), SIN datos sensibles.
// Accesible a cualquier usuario con la capacidad (no solo admin): lo usa la pantalla
// de "Movimiento de mercadería" para el filtro por negocio.
router.get('/grupo', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const r = await db.query(`
            SELECT n.id, n.nombre, (n.id = $1) AS es_actual
            FROM negocios n
            WHERE n.id = $1
               OR (n.grupo_multinegocio IS NOT NULL
                   AND n.grupo_multinegocio = (SELECT grupo_multinegocio FROM negocios WHERE id = $1))
            ORDER BY es_actual DESC, n.nombre ASC
        `, [negocio_id]);
        res.json({ negocio_actual_id: negocio_id, negocios: r.rows });
    } catch (error) {
        console.error('Error grupo:', error);
        res.status(500).json({ error: 'Error al listar el grupo' });
    }
});

// ---- POST /vincular ----  { email, password }
router.post('/vincular', soloAdmin, async (req, res) => {
    try {
        const negocioActualId = req.negocio_id || req.usuario?.negocio_id;
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Mail y contraseña son obligatorios' });
        }

        const clientIP = req.ip || req.connection?.remoteAddress || '';
        const attemptKey = `vinc-${clientIP}-${String(email).toLowerCase()}`;
        const now = Date.now();
        const attempts = intentosVinculo.get(attemptKey);
        if (attempts && attempts.count >= MAX_INTENTOS && (now - attempts.lastAttempt) < LOCKOUT_MS) {
            const min = Math.ceil((LOCKOUT_MS - (now - attempts.lastAttempt)) / 60000);
            return res.status(429).json({ error: `Demasiados intentos. Probá de nuevo en ${min} minutos.` });
        }

        // Validación de credenciales del negocio (misma lógica que /auth/acceso-negocio):
        // password del portal si está configurada, si no la del admin.
        const r = await db.query(`
            SELECT u.negocio_id, n.nombre AS negocio_nombre, n.estado AS negocio_estado, n.plan,
                   (n.password_portal_hash IS NOT NULL) AS tiene_portal,
                   (n.password_portal_hash IS NOT NULL
                        AND n.password_portal_hash = crypt($2, n.password_portal_hash)) AS portal_ok,
                   (u.password_hash = crypt($2, u.password_hash)) AS admin_ok
            FROM usuarios u
            JOIN negocios n ON u.negocio_id = n.id
            WHERE LOWER(u.email) = LOWER($1) AND u.activo = TRUE AND u.rol = 'admin'
            LIMIT 1
        `, [email, password]);

        const fila = r.rows[0];
        const passwordValida = fila && (fila.portal_ok || (!fila.tiene_portal && fila.admin_ok));
        if (!passwordValida) {
            const a = intentosVinculo.get(attemptKey) || { count: 0, lastAttempt: now };
            a.count++; a.lastAttempt = now;
            intentosVinculo.set(attemptKey, a);
            return res.status(401).json({ error: 'Mail o contraseña incorrectos' });
        }
        intentosVinculo.delete(attemptKey);

        const negocioB = fila.negocio_id;
        if (parseInt(negocioB) === parseInt(negocioActualId)) {
            return res.status(400).json({ error: 'Ese es el negocio en el que ya estás. Ingresá las claves de OTRO negocio tuyo.' });
        }
        if (fila.negocio_estado === 'bloqueado') {
            return res.status(403).json({ error: 'Ese negocio está bloqueado y no se puede vincular.' });
        }

        // Grupos actuales de A y B.
        const grupos = await db.query(
            'SELECT id, grupo_multinegocio FROM negocios WHERE id = ANY($1)',
            [[negocioActualId, negocioB]]
        );
        const gA = grupos.rows.find(x => x.id === parseInt(negocioActualId))?.grupo_multinegocio || null;
        const gB = grupos.rows.find(x => x.id === parseInt(negocioB))?.grupo_multinegocio || null;

        if (gB != null) {
            if (gA != null && gB === gA) {
                // Ya estaban vinculados: idempotente.
                const negocios = await listarMisNegocios(negocioActualId);
                return res.json({ ok: true, ya_vinculado: true, negocios });
            }
            return res.status(409).json({ error: 'Ese negocio ya pertenece a otro grupo. Desvinculalo primero desde allí.' });
        }

        // B no tiene grupo: lo sumamos al de A (creándolo si A tampoco tenía).
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            let grupoFinal = gA;
            if (grupoFinal == null) {
                grupoFinal = parseInt(negocioActualId);
                await client.query('UPDATE negocios SET grupo_multinegocio = $1 WHERE id = $1', [grupoFinal]);
            }
            await client.query('UPDATE negocios SET grupo_multinegocio = $1 WHERE id = $2', [grupoFinal, negocioB]);
            await client.query('COMMIT');
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }

        const negocios = await listarMisNegocios(negocioActualId);
        res.json({ ok: true, vinculado: fila.negocio_nombre, negocios });
    } catch (error) {
        console.error('Error vincular negocio:', error);
        res.status(500).json({ error: 'Error al vincular el negocio' });
    }
});

// ---- DELETE /vincular/:negocioId ----  desvincular del grupo
router.delete('/vincular/:negocioId', soloAdmin, async (req, res) => {
    try {
        const negocioActualId = req.negocio_id || req.usuario?.negocio_id;
        const objetivo = parseInt(req.params.negocioId);
        if (objetivo === parseInt(negocioActualId)) {
            return res.status(400).json({ error: 'No podés desvincular el negocio en el que estás.' });
        }
        // Solo si comparte grupo con el actual.
        const ok = await db.query(`
            SELECT 1 FROM negocios
            WHERE id = $2 AND grupo_multinegocio IS NOT NULL
              AND grupo_multinegocio = (SELECT grupo_multinegocio FROM negocios WHERE id = $1) LIMIT 1
        `, [negocioActualId, objetivo]);
        if (ok.rows.length === 0) {
            return res.status(404).json({ error: 'Ese negocio no está en tu grupo.' });
        }
        // Grupo del que sale, para limpiar despues.
        const grupoR = await db.query('SELECT grupo_multinegocio AS g FROM negocios WHERE id = $1', [negocioActualId]);
        const grupo = grupoR.rows[0]?.g;
        await db.query('UPDATE negocios SET grupo_multinegocio = NULL WHERE id = $1', [objetivo]);
        // Si el grupo queda con un solo miembro, deja de ser grupo: lo desarmamos.
        if (grupo != null) {
            const quedan = await db.query('SELECT id FROM negocios WHERE grupo_multinegocio = $1', [grupo]);
            if (quedan.rows.length <= 1) {
                await db.query('UPDATE negocios SET grupo_multinegocio = NULL WHERE grupo_multinegocio = $1', [grupo]);
            }
        }
        const negocios = await listarMisNegocios(negocioActualId);
        res.json({ ok: true, negocios });
    } catch (error) {
        console.error('Error desvincular negocio:', error);
        res.status(500).json({ error: 'Error al desvincular el negocio' });
    }
});

// ---- POST /acceder/:negocioId ----  cambia de sesión al otro negocio
router.post('/acceder/:negocioId', soloAdmin, async (req, res) => {
    try {
        const negocioActualId = req.negocio_id || req.usuario?.negocio_id;
        const objetivo = parseInt(req.params.negocioId);
        if (!(await mismoGrupo(negocioActualId, objetivo))) {
            return res.status(403).json({ error: 'Ese negocio no está en tu grupo.' });
        }
        // Datos del negocio destino + su usuario admin.
        const r = await db.query(`
            SELECT u.id, u.email, u.nombre, u.rol, u.negocio_id, u.permisos,
                   n.nombre AS negocio_nombre, n.plan, n.estado AS negocio_estado, n.fecha_vencimiento
            FROM usuarios u
            JOIN negocios n ON n.id = u.negocio_id
            WHERE u.negocio_id = $1 AND u.rol = 'admin' AND u.activo = TRUE
            ORDER BY u.id ASC
            LIMIT 1
        `, [objetivo]);
        const usuario = r.rows[0];
        if (!usuario) {
            return res.status(404).json({ error: 'Ese negocio no tiene un administrador activo.' });
        }
        if (usuario.negocio_estado === 'bloqueado') {
            return res.status(403).json({ error: 'Ese negocio está bloqueado.' });
        }
        if (usuario.negocio_estado === 'vencido' ||
            (usuario.fecha_vencimiento && new Date(usuario.fecha_vencimiento) < new Date())) {
            return res.status(403).json({ error: 'La suscripción de ese negocio está vencida.' });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                rol: usuario.rol,
                negocio_id: usuario.negocio_id,
                negocio_nombre: usuario.negocio_nombre,
                permisos: usuario.permisos,
                plan: usuario.plan || null,
                estado: usuario.negocio_estado || null,
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        await db.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1', [usuario.id]);

        res.json({
            token,
            usuario: {
                id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol,
                negocio_id: usuario.negocio_id, negocio_nombre: usuario.negocio_nombre,
                permisos: usuario.permisos, plan: usuario.plan, estado: usuario.negocio_estado,
            }
        });
    } catch (error) {
        console.error('Error acceder a negocio:', error);
        res.status(500).json({ error: 'Error al acceder al negocio' });
    }
});

// ---- POST /movimiento/validar ----  { destino_id, items:[{producto_id}] }
// Devuelve, por cada producto de origen, si tiene equivalente en el destino.
router.post('/movimiento/validar', async (req, res) => {
    try {
        const origen = req.negocio_id || req.usuario?.negocio_id;
        const { destino_id, items } = req.body;
        if (!destino_id || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }
        if (!(await mismoGrupo(origen, destino_id))) {
            return res.status(403).json({ error: 'El negocio destino no está en tu grupo.' });
        }
        const resultado = [];
        for (const it of items) {
            const prod = await db.query(
                'SELECT id, nombre, codigo FROM productos WHERE id = $1 AND negocio_id = $2 LIMIT 1',
                [it.producto_id, origen]
            );
            const p = prod.rows[0];
            if (!p) { resultado.push({ producto_id: it.producto_id, destino_producto_id: null, match_por: null }); continue; }
            const match = await resolverProductoDestino(destino_id, p.codigo, p.nombre);
            resultado.push({
                producto_id: it.producto_id,
                destino_producto_id: match ? match.id : null,
                match_por: match ? match.match_por : null,
            });
        }
        res.json({ items: resultado });
    } catch (error) {
        console.error('Error validar movimiento:', error);
        res.status(500).json({ error: 'Error al validar el movimiento' });
    }
});

// ---- POST /movimiento ----  { destino_id, items:[{producto_origen_id, cantidad}], comentario }
// Crea un envío EN PROCESO. El stock NO se mueve todavía: recién se mueve cuando
// el negocio destino confirma la recepción (los ítems que efectivamente llegaron).
router.post('/movimiento', async (req, res) => {
    try {
        const origen = req.negocio_id || req.usuario?.negocio_id;
        const { destino_id, items, comentario } = req.body;
        if (!destino_id || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Cargá al menos un producto para enviar.' });
        }
        if (!(await mismoGrupo(origen, destino_id))) {
            return res.status(403).json({ error: 'El negocio destino no está en tu grupo.' });
        }

        // El negocio origen debe tener el multinegocio activado.
        const cfg = await db.query('SELECT multinegocio_activo FROM configuracion WHERE negocio_id = $1', [origen]);
        if (!cfg.rows[0]?.multinegocio_activo) {
            return res.status(403).json({ error: 'Activá "Multinegocio" en Configuración para enviar mercadería.' });
        }
        const permiteStockNegativo = !!(await db.query(
            'SELECT permite_stock_negativo FROM configuracion WHERE negocio_id = $1', [origen]
        )).rows[0]?.permite_stock_negativo;

        // Nombres para el remito.
        const negs = await db.query('SELECT id, nombre FROM negocios WHERE id = ANY($1)', [[origen, destino_id]]);
        const nombreOrigen = negs.rows.find(n => n.id === parseInt(origen))?.nombre || '';
        const nombreDestino = negs.rows.find(n => n.id === parseInt(destino_id))?.nombre || '';

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const cab = await client.query(`
                INSERT INTO movimientos_mercaderia
                    (grupo_multinegocio, negocio_origen_id, negocio_destino_id, usuario_id, estado, comentario_envio)
                VALUES ((SELECT grupo_multinegocio FROM negocios WHERE id = $1), $1, $2, $3, 'en_proceso', $4)
                RETURNING id, fecha
            `, [origen, destino_id, req.usuario?.id || null, (comentario || '').trim() || null]);
            const movimientoId = cab.rows[0].id;

            let totalCosto = 0;
            let cantItems = 0;
            const itemsTicket = [];
            const faltantes = [];

            for (const it of items) {
                const cantidad = parseFloat(it.cantidad);
                if (!cantidad || cantidad <= 0) continue;

                const prodR = await client.query(
                    'SELECT id, nombre, codigo, precio_costo, stock, unidad, es_combinado FROM productos WHERE id = $1 AND negocio_id = $2 LIMIT 1',
                    [it.producto_origen_id, origen]
                );
                const prod = prodR.rows[0];
                if (!prod) { faltantes.push(`#${it.producto_origen_id} (no existe en origen)`); continue; }

                const match = await resolverProductoDestino(destino_id, prod.codigo, prod.nombre, client);
                if (!match) { faltantes.push(prod.nombre); continue; }

                // Aviso de stock (no bloquea el envío: el stock se descuenta al recibir).
                if (!permiteStockNegativo) {
                    const disp = prod.es_combinado
                        ? await disponibleCombo(origen, prod.id, client)
                        : parseFloat(prod.stock) || 0;
                    if (disp < cantidad) {
                        faltantes.push(`${prod.nombre} (sin stock: hay ${disp}, pedís ${cantidad})`);
                        continue;
                    }
                }

                const costo = parseFloat(prod.precio_costo) || 0;
                const subtotal = costo * cantidad;
                totalCosto += subtotal;
                cantItems += 1;

                // recibido = NULL (pendiente de confirmación del destino).
                await client.query(`
                    INSERT INTO movimientos_mercaderia_items
                        (movimiento_id, producto_origen_id, producto_destino_id, nombre_producto, codigo, cantidad, costo_unitario, subtotal_costo, recibido)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
                `, [movimientoId, prod.id, match.id, prod.nombre, prod.codigo, cantidad, costo, subtotal]);

                itemsTicket.push({
                    nombre_producto: prod.nombre, codigo: prod.codigo, cantidad,
                    costo_unitario: costo, subtotal_costo: subtotal, match_por: match.match_por,
                });
            }

            if (faltantes.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: 'No se pudo completar el envío. Revisá estos productos:',
                    faltantes,
                });
            }
            if (cantItems === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'No hay productos válidos para enviar.' });
            }

            await client.query(
                'UPDATE movimientos_mercaderia SET total_costo = $1, cantidad_items = $2 WHERE id = $3',
                [totalCosto, cantItems, movimientoId]
            );
            await client.query('COMMIT');

            res.status(201).json({
                movimiento: {
                    id: movimientoId,
                    fecha: cab.rows[0].fecha,
                    total_costo: totalCosto,
                    cantidad_items: cantItems,
                    estado: 'en_proceso',
                    comentario_envio: (comentario || '').trim() || null,
                    negocio_origen: nombreOrigen,
                    negocio_destino: nombreDestino,
                },
                items: itemsTicket,
            });
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error movimiento de mercadería:', error);
        res.status(500).json({ error: 'Error al enviar la mercadería' });
    }
});

// ---- POST /movimientos/:id/recibir ----  el destino confirma la recepción
// body: { items: [{item_id, recibido}], comentario }. Los ítems recibidos mueven
// stock (origen -, destino +); los faltantes no mueven nada.
router.post('/movimientos/:id/recibir', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        const id = parseInt(req.params.id);
        const { items, comentario } = req.body;
        const marcas = new Map((Array.isArray(items) ? items : []).map(i => [parseInt(i.item_id), i.recibido !== false]));

        const mov = await db.query('SELECT * FROM movimientos_mercaderia WHERE id = $1', [id]);
        const m = mov.rows[0];
        if (!m) return res.status(404).json({ error: 'Movimiento no encontrado' });
        if (parseInt(m.negocio_destino_id) !== parseInt(negocio_id)) {
            return res.status(403).json({ error: 'Solo el negocio que recibe puede confirmar esta recepción.' });
        }
        if (m.estado !== 'en_proceso') {
            return res.status(400).json({ error: 'Este envío ya fue procesado.' });
        }

        const its = await db.query('SELECT * FROM movimientos_mercaderia_items WHERE movimiento_id = $1', [id]);

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            let recibidos = 0, faltantes = 0;
            for (const it of its.rows) {
                const llego = marcas.has(it.id) ? marcas.get(it.id) : true; // por defecto: llegó
                if (llego) {
                    await ajustarStock(m.negocio_origen_id, it.producto_origen_id, it.cantidad, -1, client);
                    await ajustarStock(m.negocio_destino_id, it.producto_destino_id, it.cantidad, 1, client);
                    recibidos++;
                } else {
                    faltantes++;
                }
                await client.query('UPDATE movimientos_mercaderia_items SET recibido = $1 WHERE id = $2', [llego, it.id]);
            }
            const estado = faltantes === 0 ? 'recibido' : (recibidos === 0 ? 'rechazado' : 'recibido_parcial');
            await client.query(
                `UPDATE movimientos_mercaderia SET estado = $1, fecha_recepcion = NOW(),
                    usuario_recepcion_id = $2, comentario_recepcion = $3 WHERE id = $4`,
                [estado, req.usuario?.id || null, (comentario || '').trim() || null, id]
            );
            await client.query('COMMIT');
            res.json({ ok: true, estado, recibidos, faltantes });
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error al recibir movimiento:', error);
        res.status(500).json({ error: 'Error al confirmar la recepción' });
    }
});

// ---- POST /movimientos/:id/anular ----  cancela un envío
// en_proceso: no movió stock, solo se marca anulado.
// recibido/confirmado: revierte el stock que se había movido.
router.post('/movimientos/:id/anular', soloAdmin, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        const id = parseInt(req.params.id);
        const mov = await db.query('SELECT * FROM movimientos_mercaderia WHERE id = $1', [id]);
        const m = mov.rows[0];
        if (!m) return res.status(404).json({ error: 'Movimiento no encontrado' });
        if (parseInt(m.negocio_origen_id) !== parseInt(negocio_id) && parseInt(m.negocio_destino_id) !== parseInt(negocio_id)) {
            return res.status(403).json({ error: 'No podés anular este movimiento.' });
        }
        if (m.estado === 'anulado') return res.status(400).json({ error: 'Ya está anulado.' });

        const its = await db.query('SELECT * FROM movimientos_mercaderia_items WHERE movimiento_id = $1', [id]);
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            // Revertir stock solo de lo que efectivamente se había movido.
            const moviaStock = ['recibido', 'recibido_parcial', 'confirmado'].includes(m.estado);
            if (moviaStock) {
                for (const it of its.rows) {
                    const seHabiaMovido = m.estado === 'confirmado' ? true : it.recibido === true;
                    if (seHabiaMovido) {
                        await ajustarStock(m.negocio_origen_id, it.producto_origen_id, it.cantidad, 1, client);   // devolver al origen
                        await ajustarStock(m.negocio_destino_id, it.producto_destino_id, it.cantidad, -1, client); // quitar del destino
                    }
                }
            }
            await client.query('UPDATE movimientos_mercaderia SET estado = $1 WHERE id = $2', ['anulado', id]);
            await client.query('COMMIT');
            res.json({ ok: true });
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error al anular movimiento:', error);
        res.status(500).json({ error: 'Error al anular el movimiento' });
    }
});

// ---- POST /movimientos/:id/editar ----  editar un envío EN PROCESO (solo el origen)
// body: { items:[{producto_origen_id, cantidad}], comentario }. Reemplaza los ítems
// y recalcula totales. Como en_proceso no movió stock, no hay nada que revertir.
router.post('/movimientos/:id/editar', soloAdmin, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        const id = parseInt(req.params.id);
        const { items, comentario } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Cargá al menos un producto.' });
        }

        const mov = await db.query('SELECT * FROM movimientos_mercaderia WHERE id = $1', [id]);
        const m = mov.rows[0];
        if (!m) return res.status(404).json({ error: 'Movimiento no encontrado' });
        if (parseInt(m.negocio_origen_id) !== parseInt(negocio_id)) {
            return res.status(403).json({ error: 'Solo el negocio que envía puede editar este envío.' });
        }
        if (m.estado !== 'en_proceso') {
            return res.status(400).json({ error: 'Solo se puede editar un envío que está en proceso.' });
        }

        const origen = m.negocio_origen_id;
        const destino_id = m.negocio_destino_id;
        const permiteStockNegativo = !!(await db.query(
            'SELECT permite_stock_negativo FROM configuracion WHERE negocio_id = $1', [origen]
        )).rows[0]?.permite_stock_negativo;

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            // El en_proceso no movió stock: reemplazamos los ítems directamente.
            await client.query('DELETE FROM movimientos_mercaderia_items WHERE movimiento_id = $1', [id]);

            let totalCosto = 0, cantItems = 0;
            const faltantes = [];
            for (const it of items) {
                const cantidad = parseFloat(it.cantidad);
                if (!cantidad || cantidad <= 0) continue;
                const prodR = await client.query(
                    'SELECT id, nombre, codigo, precio_costo, stock, unidad, es_combinado FROM productos WHERE id = $1 AND negocio_id = $2 LIMIT 1',
                    [it.producto_origen_id, origen]
                );
                const prod = prodR.rows[0];
                if (!prod) { faltantes.push(`#${it.producto_origen_id} (no existe en origen)`); continue; }
                const match = await resolverProductoDestino(destino_id, prod.codigo, prod.nombre, client);
                if (!match) { faltantes.push(prod.nombre); continue; }
                if (!permiteStockNegativo) {
                    const disp = prod.es_combinado
                        ? await disponibleCombo(origen, prod.id, client)
                        : parseFloat(prod.stock) || 0;
                    if (disp < cantidad) { faltantes.push(`${prod.nombre} (sin stock: hay ${disp}, pedís ${cantidad})`); continue; }
                }
                const costo = parseFloat(prod.precio_costo) || 0;
                const subtotal = costo * cantidad;
                totalCosto += subtotal; cantItems += 1;
                await client.query(`
                    INSERT INTO movimientos_mercaderia_items
                        (movimiento_id, producto_origen_id, producto_destino_id, nombre_producto, codigo, cantidad, costo_unitario, subtotal_costo, recibido)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
                `, [id, prod.id, match.id, prod.nombre, prod.codigo, cantidad, costo, subtotal]);
            }

            if (faltantes.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'No se pudo guardar. Revisá estos productos:', faltantes });
            }
            if (cantItems === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'No hay productos válidos.' });
            }

            await client.query(
                `UPDATE movimientos_mercaderia SET total_costo = $1, cantidad_items = $2, comentario_envio = $3 WHERE id = $4`,
                [totalCosto, cantItems, (comentario || '').trim() || null, id]
            );
            await client.query('COMMIT');
            res.json({ ok: true, total_costo: totalCosto, cantidad_items: cantItems });
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error al editar movimiento:', error);
        res.status(500).json({ error: 'Error al editar el envío' });
    }
});

// Arma el WHERE con filtros comunes (fecha, tipo enviado/recibido, otro negocio)
// para el historial y los reportes de movimientos. Devuelve { where, params }.
function filtrosMovimientos(negocio_id, query) {
    const { desde, hasta, tipo, negocio, estado } = query;
    const cond = ['(m.negocio_origen_id = $1 OR m.negocio_destino_id = $1)'];
    const params = [negocio_id];
    if (desde) { params.push(desde); cond.push(`m.fecha::date >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); cond.push(`m.fecha::date <= $${params.length}::date`); }
    if (tipo === 'enviado') cond.push('m.negocio_origen_id = $1');
    else if (tipo === 'recibido') cond.push('m.negocio_destino_id = $1');
    if (negocio) { params.push(parseInt(negocio)); cond.push(`(m.negocio_origen_id = $${params.length} OR m.negocio_destino_id = $${params.length})`); }
    if (estado) { params.push(estado); cond.push(`m.estado = $${params.length}`); }
    return { where: cond.join(' AND '), params };
}

// ---- GET /movimientos ----  historial de envíos/recepciones (con filtros)
router.get('/movimientos', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        let { where, params } = filtrosMovimientos(negocio_id, req.query);
        // Búsqueda por producto: movimientos que incluyan un producto por nombre/código.
        const buscar = (req.query.buscar || '').trim();
        if (buscar) {
            params.push(`%${buscar}%`);
            where += ` AND EXISTS (SELECT 1 FROM movimientos_mercaderia_items mi WHERE mi.movimiento_id = m.id AND (mi.nombre_producto ILIKE $${params.length} OR mi.codigo ILIKE $${params.length}))`;
        }
        const r = await db.query(`
            SELECT m.id, m.fecha, m.total_costo, m.cantidad_items, m.estado,
                   m.comentario_envio, m.comentario_recepcion, m.fecha_recepcion,
                   m.negocio_origen_id, m.negocio_destino_id,
                   no.nombre AS origen_nombre, nd.nombre AS destino_nombre,
                   (m.negocio_origen_id = $1) AS enviado,
                   u.nombre AS usuario_nombre, ur.nombre AS usuario_recepcion_nombre
            FROM movimientos_mercaderia m
            LEFT JOIN negocios no ON no.id = m.negocio_origen_id
            LEFT JOIN negocios nd ON nd.id = m.negocio_destino_id
            LEFT JOIN usuarios u ON u.id = m.usuario_id
            LEFT JOIN usuarios ur ON ur.id = m.usuario_recepcion_id
            WHERE ${where}
            ORDER BY m.fecha DESC
            LIMIT 500
        `, params);

        // Resumen del período. El valor "efectivo" excluye anulados.
        const resumen = await db.query(`
            SELECT
              COUNT(*) FILTER (WHERE m.estado <> 'anulado') AS movimientos,
              COALESCE(SUM(m.total_costo) FILTER (WHERE m.estado <> 'anulado'),0) AS valor_total,
              COUNT(*) FILTER (WHERE m.negocio_origen_id = $1 AND m.estado <> 'anulado') AS enviados,
              COALESCE(SUM(m.total_costo) FILTER (WHERE m.negocio_origen_id = $1 AND m.estado <> 'anulado'),0) AS valor_enviado,
              COUNT(*) FILTER (WHERE m.negocio_destino_id = $1 AND m.estado <> 'anulado') AS recibidos,
              COALESCE(SUM(m.total_costo) FILTER (WHERE m.negocio_destino_id = $1 AND m.estado <> 'anulado'),0) AS valor_recibido,
              COALESCE(SUM(m.cantidad_items) FILTER (WHERE m.estado <> 'anulado'),0) AS total_items,
              COUNT(*) FILTER (WHERE m.negocio_destino_id = $1 AND m.estado = 'en_proceso') AS pend_recibir,
              COUNT(*) FILTER (WHERE m.negocio_origen_id = $1 AND m.estado = 'en_proceso') AS pend_enviados
            FROM movimientos_mercaderia m
            WHERE ${where}
        `, params);

        // Balance por negocio (contraparte): cuánto le envié y cuánto recibí de cada uno.
        const balance = await db.query(`
            SELECT
              CASE WHEN m.negocio_origen_id = $1 THEN m.negocio_destino_id ELSE m.negocio_origen_id END AS negocio_id,
              CASE WHEN m.negocio_origen_id = $1 THEN nd.nombre ELSE no.nombre END AS nombre,
              COALESCE(SUM(m.total_costo) FILTER (WHERE m.negocio_origen_id = $1),0) AS enviado,
              COALESCE(SUM(m.total_costo) FILTER (WHERE m.negocio_destino_id = $1),0) AS recibido
            FROM movimientos_mercaderia m
            LEFT JOIN negocios no ON no.id = m.negocio_origen_id
            LEFT JOIN negocios nd ON nd.id = m.negocio_destino_id
            WHERE ${where} AND m.estado <> 'anulado'
            GROUP BY 1, 2
            ORDER BY (COALESCE(SUM(m.total_costo) FILTER (WHERE m.negocio_origen_id = $1),0)
                    + COALESCE(SUM(m.total_costo) FILTER (WHERE m.negocio_destino_id = $1),0)) DESC
        `, params);

        res.json({ movimientos: r.rows, resumen: resumen.rows[0], balance: balance.rows });
    } catch (error) {
        console.error('Error historial movimientos:', error);
        res.status(500).json({ error: 'Error al listar los movimientos' });
    }
});

// ---- GET /movimientos/reporte-productos ----  agregado por producto (con filtros)
router.get('/movimientos/reporte-productos', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        let { where, params } = filtrosMovimientos(negocio_id, req.query);
        // Búsqueda por producto: acota a los ítems que matcheen por nombre/código.
        const buscar = (req.query.buscar || '').trim();
        let filtroBuscar = '';
        if (buscar) {
            params.push(`%${buscar}%`);
            filtroBuscar = ` AND (mi.nombre_producto ILIKE $${params.length} OR mi.codigo ILIKE $${params.length})`;
        }
        const r = await db.query(`
            SELECT mi.nombre_producto,
                   MAX(mi.codigo) AS codigo,
                   SUM(mi.cantidad) AS total_cantidad,
                   SUM(mi.subtotal_costo) AS total_costo,
                   COUNT(DISTINCT mi.movimiento_id) AS envios,
                   SUM(mi.cantidad) FILTER (WHERE m.negocio_origen_id = $1) AS cant_enviada,
                   SUM(mi.cantidad) FILTER (WHERE m.negocio_destino_id = $1) AS cant_recibida
            FROM movimientos_mercaderia_items mi
            JOIN movimientos_mercaderia m ON m.id = mi.movimiento_id
            WHERE ${where}
              AND m.estado <> 'anulado'
              -- Solo lo que efectivamente movió stock: recibido, o envíos viejos ya confirmados.
              AND (mi.recibido = TRUE OR m.estado = 'confirmado')${filtroBuscar}
            GROUP BY LOWER(mi.nombre_producto), mi.nombre_producto
            ORDER BY total_cantidad DESC
        `, params);
        res.json(r.rows);
    } catch (error) {
        console.error('Error reporte productos movimientos:', error);
        res.status(500).json({ error: 'Error al generar el reporte de productos' });
    }
});

// ---- GET /movimientos/:id ----  detalle de un movimiento (cabecera + items)
router.get('/movimientos/:id', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        const id = parseInt(req.params.id);
        const cab = await db.query(`
            SELECT m.id, m.fecha, m.total_costo, m.cantidad_items, m.estado,
                   m.comentario_envio, m.comentario_recepcion, m.fecha_recepcion,
                   m.negocio_origen_id, m.negocio_destino_id,
                   no.nombre AS origen_nombre, nd.nombre AS destino_nombre,
                   (m.negocio_origen_id = $1) AS enviado,
                   (m.negocio_destino_id = $1) AS soy_destino,
                   u.nombre AS usuario_nombre, ur.nombre AS usuario_recepcion_nombre
            FROM movimientos_mercaderia m
            LEFT JOIN negocios no ON no.id = m.negocio_origen_id
            LEFT JOIN negocios nd ON nd.id = m.negocio_destino_id
            LEFT JOIN usuarios u ON u.id = m.usuario_id
            LEFT JOIN usuarios ur ON ur.id = m.usuario_recepcion_id
            WHERE m.id = $2 AND (m.negocio_origen_id = $1 OR m.negocio_destino_id = $1)
        `, [negocio_id, id]);
        if (!cab.rows[0]) return res.status(404).json({ error: 'Movimiento no encontrado' });
        const items = await db.query(
            'SELECT id AS item_id, producto_origen_id, producto_destino_id, nombre_producto, codigo, cantidad, costo_unitario, subtotal_costo, recibido FROM movimientos_mercaderia_items WHERE movimiento_id = $1 ORDER BY id',
            [id]
        );
        res.json({ movimiento: cab.rows[0], items: items.rows });
    } catch (error) {
        console.error('Error detalle movimiento:', error);
        res.status(500).json({ error: 'Error al obtener el movimiento' });
    }
});

module.exports = router;
