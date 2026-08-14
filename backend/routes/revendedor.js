// =============================================
// ARCHIVO: routes/revendedor.js
// Panel del REVENDEDOR (marca blanca). Todo scopeado a req.revendedor_id.
// Se monta con verificarToken + soloRevendedor. Un revendedor solo ve y opera
// SUS negocios; el aislamiento lo garantiza el middleware (pertenencia validada)
// y el filtro por revendedor_id en cada consulta.
// La capa completa está detrás del interruptor global revendedores_habilitado
// (modo apagado por defecto): si está apagado, estas rutas responden 404.
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { invalidarCacheNegocio, invalidarCacheDuenoNegocio } = require('../middleware/auth');
const { getConfigSistema, revendedoresHabilitado } = require('../helpers/configSistema');

// Guarda global: si la capa está apagada, nada de esto existe.
router.use(async (req, res, next) => {
    try {
        if (!(await revendedoresHabilitado())) {
            return res.status(404).json({ error: 'No disponible' });
        }
    } catch (e) {
        return res.status(404).json({ error: 'No disponible' });
    }
    next();
});

// Trae los datos frescos del revendedor logueado (incluye días por token efectivos).
async function traerRevendedor(revendedorId) {
    const cfg = await getConfigSistema();
    const r = await db.query(`
        SELECT id, nombre, email, tokens, activo, slug,
               marca_nombre, marca_logo, marca_color,
               precio_token, dias_por_token, created_at
        FROM revendedores WHERE id = $1
    `, [revendedorId]);
    const rev = r.rows[0];
    if (!rev) return null;
    rev.precio_token_efectivo = rev.precio_token != null ? rev.precio_token : cfg.precio_token;
    rev.dias_por_token_efectivo = rev.dias_por_token != null ? rev.dias_por_token : cfg.dias_por_token;
    return rev;
}

// -----------------------------------------------
// GET /api/revendedor/me — datos + saldo de tokens + marca + métricas
// -----------------------------------------------
router.get('/me', async (req, res) => {
    try {
        const rev = await traerRevendedor(req.revendedor_id);
        if (!rev) return res.status(404).json({ error: 'Revendedor no encontrado' });

        const stats = await db.query(`
            SELECT
                COUNT(*)::int AS total_negocios,
                COUNT(*) FILTER (WHERE estado = 'activo' AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= NOW()))::int AS activos,
                COUNT(*) FILTER (WHERE estado = 'bloqueado' OR estado = 'vencido' OR (fecha_vencimiento IS NOT NULL AND fecha_vencimiento < NOW()))::int AS vencidos
            FROM negocios WHERE revendedor_id = $1
        `, [req.revendedor_id]);

        res.json({ revendedor: rev, stats: stats.rows[0] });
    } catch (error) {
        console.error('Error en /revendedor/me:', error);
        res.status(500).json({ error: 'Error al obtener datos' });
    }
});

// -----------------------------------------------
// GET /api/revendedor/negocios — solo los suyos, con métricas
// -----------------------------------------------
router.get('/negocios', async (req, res) => {
    try {
        const r = await db.query(`
            SELECT
                n.id, n.nombre, n.email, n.telefono, n.direccion, n.plan,
                n.estado, n.fecha_vencimiento, n.dias_uso, n.created_at,
                (SELECT email FROM usuarios WHERE negocio_id = n.id AND rol = 'admin' AND activo = TRUE
                   ORDER BY created_at ASC LIMIT 1) AS admin_email,
                (SELECT COUNT(*) FROM usuarios WHERE negocio_id = n.id AND activo = TRUE)::int AS total_usuarios,
                (SELECT COUNT(*) FROM ventas WHERE negocio_id = n.id)::int AS total_ventas,
                (SELECT MAX(fecha) FROM ventas WHERE negocio_id = n.id) AS ultima_venta
            FROM negocios n
            WHERE n.revendedor_id = $1
            ORDER BY n.created_at DESC
        `, [req.revendedor_id]);
        res.json(r.rows);
    } catch (error) {
        console.error('Error al listar negocios del revendedor:', error);
        res.status(500).json({ error: 'Error al obtener negocios' });
    }
});

// -----------------------------------------------
// POST /api/revendedor/negocios — crear negocio (gasta 1 token)
// Transacción con lock del saldo para no quedar en negativo ni en carreras.
// -----------------------------------------------
router.post('/negocios', async (req, res) => {
    const { nombre, email, telefono, direccion, plan, password_admin, username_admin } = req.body;
    if (!nombre || !email || !password_admin || !username_admin) {
        return res.status(400).json({ error: 'Nombre, email, usuario y contraseña son obligatorios' });
    }

    const cliente = await db.pool.connect();
    try {
        await cliente.query('BEGIN');

        // Bloqueamos la fila del revendedor para leer/gastar el token sin carreras.
        const rv = await cliente.query('SELECT tokens, dias_por_token, marca_color FROM revendedores WHERE id = $1 FOR UPDATE', [req.revendedor_id]);
        const rev = rv.rows[0];
        if (!rev) { await cliente.query('ROLLBACK'); return res.status(404).json({ error: 'Revendedor no encontrado' }); }
        if (rev.tokens < 1) {
            await cliente.query('ROLLBACK');
            return res.status(402).json({ error: 'No tenés tokens disponibles. Comprá tokens para crear un negocio.' });
        }

        const cfg = await getConfigSistema();
        const dias = rev.dias_por_token != null ? rev.dias_por_token : cfg.dias_por_token;
        const color = rev.marca_color || '#f97316';

        const negocio = await cliente.query(`
            INSERT INTO negocios (nombre, email, telefono, direccion, plan, estado, fecha_vencimiento, dias_uso, revendedor_id, color_primario)
            VALUES ($1, $2, $3, $4, $5, 'activo', NOW() + ($6 * INTERVAL '1 day'), $6, $7, $8)
            RETURNING *
        `, [nombre, email, telefono || null, direccion || null, plan || 'estandar', dias, req.revendedor_id, color]);
        const negocioId = negocio.rows[0].id;

        await cliente.query(`
            INSERT INTO usuarios (negocio_id, nombre, username, email, password_hash, rol)
            VALUES ($1, $2, $3, $4, crypt($5, gen_salt('bf')), 'admin')
        `, [negocioId, `Admin ${nombre}`, username_admin, email, password_admin]);

        await cliente.query(`
            INSERT INTO configuracion (nombre_negocio, email, negocio_id)
            VALUES ($1, $2, $3)
        `, [nombre, email, negocioId]);

        // Gastar 1 token + registrar el movimiento (libro).
        const upd = await cliente.query('UPDATE revendedores SET tokens = tokens - 1 WHERE id = $1 RETURNING tokens', [req.revendedor_id]);
        const saldo = upd.rows[0].tokens;
        await cliente.query(`
            INSERT INTO revendedor_tokens_mov (revendedor_id, tipo, cantidad, saldo_resultante, negocio_id, observaciones)
            VALUES ($1, 'consumo', -1, $2, $3, $4)
        `, [req.revendedor_id, saldo, negocioId, `Alta de negocio: ${nombre}`]);

        await cliente.query('COMMIT');
        res.status(201).json({ negocio: negocio.rows[0], tokens: saldo });
    } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe un negocio o usuario con ese email/usuario en tu cuenta' });
        }
        console.error('Error al crear negocio (revendedor):', error);
        res.status(500).json({ error: 'Error al crear negocio' });
    } finally {
        cliente.release();
    }
});

// -----------------------------------------------
// POST /api/revendedor/negocios/:id/renovar — gasta 1 token, extiende vencimiento
// -----------------------------------------------
router.post('/negocios/:id/renovar', async (req, res) => {
    const negocioId = parseInt(req.params.id);
    const cliente = await db.pool.connect();
    try {
        await cliente.query('BEGIN');

        // El negocio debe ser de este revendedor (aislamiento).
        const ng = await cliente.query('SELECT id FROM negocios WHERE id = $1 AND revendedor_id = $2', [negocioId, req.revendedor_id]);
        if (!ng.rows[0]) { await cliente.query('ROLLBACK'); return res.status(404).json({ error: 'Negocio no encontrado' }); }

        const rv = await cliente.query('SELECT tokens, dias_por_token FROM revendedores WHERE id = $1 FOR UPDATE', [req.revendedor_id]);
        const rev = rv.rows[0];
        if (rev.tokens < 1) {
            await cliente.query('ROLLBACK');
            return res.status(402).json({ error: 'No tenés tokens disponibles para renovar.' });
        }

        const cfg = await getConfigSistema();
        const dias = rev.dias_por_token != null ? rev.dias_por_token : cfg.dias_por_token;

        // Extiende desde el vencimiento actual si sigue vigente, o desde hoy si ya venció.
        const upNeg = await cliente.query(`
            UPDATE negocios SET
                estado = 'activo',
                fecha_vencimiento = GREATEST(COALESCE(fecha_vencimiento, NOW()), NOW()) + ($1 * INTERVAL '1 day'),
                dias_uso = $1
            WHERE id = $2
            RETURNING *
        `, [dias, negocioId]);

        const upd = await cliente.query('UPDATE revendedores SET tokens = tokens - 1 WHERE id = $1 RETURNING tokens', [req.revendedor_id]);
        const saldo = upd.rows[0].tokens;
        await cliente.query(`
            INSERT INTO revendedor_tokens_mov (revendedor_id, tipo, cantidad, saldo_resultante, negocio_id, observaciones)
            VALUES ($1, 'consumo', -1, $2, $3, 'Renovación de negocio')
        `, [req.revendedor_id, saldo, negocioId]);

        await cliente.query('COMMIT');
        invalidarCacheNegocio(negocioId);
        res.json({ negocio: upNeg.rows[0], tokens: saldo });
    } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        console.error('Error al renovar negocio (revendedor):', error);
        res.status(500).json({ error: 'Error al renovar negocio' });
    } finally {
        cliente.release();
    }
});

// -----------------------------------------------
// PUT /api/revendedor/negocios/:id — editar datos básicos (valida pertenencia)
// -----------------------------------------------
router.put('/negocios/:id', async (req, res) => {
    try {
        const negocioId = parseInt(req.params.id);
        const { nombre, telefono, direccion, plan, estado } = req.body;
        // estado permitido para el revendedor: activo | bloqueado (no puede tocar otros).
        const estadoValido = ['activo', 'bloqueado'].includes(estado) ? estado : null;

        const r = await db.query(`
            UPDATE negocios SET
                nombre = COALESCE($1, nombre),
                telefono = COALESCE($2, telefono),
                direccion = COALESCE($3, direccion),
                plan = COALESCE($4, plan),
                estado = COALESCE($5, estado)
            WHERE id = $6 AND revendedor_id = $7
            RETURNING *
        `, [nombre || null, telefono || null, direccion || null, plan || null, estadoValido, negocioId, req.revendedor_id]);

        if (!r.rows[0]) return res.status(404).json({ error: 'Negocio no encontrado' });
        invalidarCacheNegocio(negocioId);
        res.json(r.rows[0]);
    } catch (error) {
        console.error('Error al editar negocio (revendedor):', error);
        res.status(500).json({ error: 'Error al actualizar negocio' });
    }
});

// -----------------------------------------------
// GET /api/revendedor/negocios/:id/acceso — impersonar (valida pertenencia)
// El front guarda el negocio y agrega el header x-negocio-id; el middleware
// vuelve a validar la pertenencia en cada request.
// -----------------------------------------------
router.get('/negocios/:id/acceso', async (req, res) => {
    try {
        const negocioId = parseInt(req.params.id);
        const r = await db.query('SELECT id, nombre, estado FROM negocios WHERE id = $1 AND revendedor_id = $2', [negocioId, req.revendedor_id]);
        if (!r.rows[0]) return res.status(404).json({ error: 'Negocio no encontrado' });
        res.json({ acceso_permitido: true, negocio: r.rows[0] });
    } catch (error) {
        console.error('Error en acceso (revendedor):', error);
        res.status(500).json({ error: 'Error al verificar acceso' });
    }
});

// -----------------------------------------------
// GET /api/revendedor/tokens — saldo + libro de movimientos
// -----------------------------------------------
router.get('/tokens', async (req, res) => {
    try {
        const rev = await traerRevendedor(req.revendedor_id);
        if (!rev) return res.status(404).json({ error: 'Revendedor no encontrado' });
        const mov = await db.query(`
            SELECT id, tipo, cantidad, saldo_resultante, negocio_id, pago_ref, observaciones, fecha
            FROM revendedor_tokens_mov
            WHERE revendedor_id = $1
            ORDER BY fecha DESC, id DESC
            LIMIT 200
        `, [req.revendedor_id]);
        res.json({ tokens: rev.tokens, precio_token: rev.precio_token_efectivo, movimientos: mov.rows });
    } catch (error) {
        console.error('Error al obtener tokens:', error);
        res.status(500).json({ error: 'Error al obtener tokens' });
    }
});

// -----------------------------------------------
// PUT /api/revendedor/marca — nombre/logo/color/slug de la marca propia
// -----------------------------------------------
router.put('/marca', async (req, res) => {
    try {
        const { marca_nombre, marca_logo, marca_color } = req.body;
        let { slug } = req.body;
        // slug: minúsculas, letras/números/guiones. Vacío => null (sin slug).
        if (slug != null) {
            slug = String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            if (!slug) slug = null;
        }

        const r = await db.query(`
            UPDATE revendedores SET
                marca_nombre = COALESCE($1, marca_nombre),
                marca_logo = COALESCE($2, marca_logo),
                marca_color = COALESCE($3, marca_color),
                slug = COALESCE($4, slug)
            WHERE id = $5
            RETURNING id, nombre, email, tokens, slug, marca_nombre, marca_logo, marca_color
        `, [marca_nombre || null, marca_logo || null, marca_color || null, slug, req.revendedor_id]);
        res.json(r.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ese enlace (slug) ya está en uso. Probá otro.' });
        }
        console.error('Error al actualizar marca:', error);
        res.status(500).json({ error: 'Error al actualizar la marca' });
    }
});

// -----------------------------------------------
// POST /api/revendedor/tokens/comprar — compra por Mercado Pago (Fase 2)
// Solo activo si hay MP_ACCESS_TOKEN en el .env. Sin esa variable responde que
// no está disponible (el respaldo es la carga manual del maestro).
// -----------------------------------------------
router.post('/tokens/comprar', async (req, res) => {
    try {
        if (!process.env.MP_ACCESS_TOKEN) {
            return res.status(503).json({ error: 'La compra automática no está disponible por ahora. Pedile tokens al administrador.' });
        }
        const cantidad = Math.max(1, parseInt(req.body.cantidad) || 1);
        const rev = await traerRevendedor(req.revendedor_id);
        if (!rev) return res.status(404).json({ error: 'Revendedor no encontrado' });

        const { crearPreferenciaTokens } = require('../services/mercadopago');
        const pref = await crearPreferenciaTokens({
            revendedorId: rev.id,
            cantidad,
            precioUnitario: rev.precio_token_efectivo,
            emailRevendedor: rev.email,
        });
        res.json(pref);
    } catch (error) {
        console.error('Error al crear preferencia de pago:', error);
        res.status(500).json({ error: 'No se pudo iniciar el pago' });
    }
});

module.exports = router;
