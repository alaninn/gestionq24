// =============================================
// ARCHIVO: routes/tienda.js
// Panel de administración de la TIENDA / VENTA ONLINE (solo admin, premium).
// Se monta con verificarToken + validarLimitePlan + puedeUsarFuncion('tienda_online') + soloAdmin.
// Configura la tienda, arma el catálogo y gestiona los pedidos online.
// Los pedidos online descuentan stock y se gestionan aparte (no tocan la caja).
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { ajustarStock } = require('../helpers/stock');

// Aviso al cliente por WhatsApp cuando cambia el estado del pedido (si está
// vinculado y con avisos activos). Nunca lanza.
async function avisarEstadoWhatsapp(negocio_id, pedido, estado) {
    try {
        if (!pedido?.whatsapp) return;
        const wc = await db.query('SELECT status, notificar_pedidos FROM whatsapp_config WHERE negocio_id = $1', [negocio_id]);
        if (!wc.rows[0] || wc.rows[0].status !== 'connected' || wc.rows[0].notificar_pedidos === false) return;
        const nombre = pedido.cliente_nombre || '';
        const msgs = {
            confirmado: `¡Hola ${nombre}! Tu pedido *#${pedido.id}* fue confirmado ✅. ${pedido.tipo_entrega === 'takeaway' ? 'Podés pasar a retirarlo cuando quieras.' : 'Ya lo estamos preparando para enviártelo.'}`,
            entregado: `¡Tu pedido *#${pedido.id}* fue entregado! 🎉 ¡Gracias por tu compra!`,
            cancelado: `Hola ${nombre}, tu pedido *#${pedido.id}* fue cancelado. Si tenés dudas, escribinos. 🙏`,
        };
        const msg = msgs[estado];
        if (!msg) return;
        require('../services/whatsappService').sendMessage(negocio_id, pedido.whatsapp, msg).catch(() => {});
    } catch (e) { /* nunca romper por el aviso */ }
}

// Capacidad de tienda: la habilita el PLAN (premium) o un OVERRIDE por negocio
// (negocios.tienda_online_habilitado, que activa el superadmin). Mismo criterio
// que multinegocio. El superadmin siempre pasa.
router.use(async (req, res, next) => {
    try {
        if (req.usuario?.rol === 'superadmin' || req.esSuperadmin) return next();
        if (req.limitesPlan?.tienda_online === true) return next();
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (negocio_id) {
            const r = await db.query('SELECT tienda_online_habilitado FROM negocios WHERE id = $1', [negocio_id]);
            if (r.rows[0]?.tienda_online_habilitado === true) return next();
        }
        return res.status(403).json({ error: 'La Tienda Online no está habilitada en tu plan.', requierePremium: true });
    } catch (e) {
        return res.status(403).json({ error: 'La Tienda Online no está habilitada.' });
    }
});

// Normaliza un slug (minúsculas, letras/números/guiones). Vacío => null.
function normalizarSlug(s) {
    if (s == null) return undefined; // undefined = no tocar
    let v = String(s).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return v || null;
}

// Palabras que NO pueden ser slug de tienda (chocan con rutas del sistema).
const SLUG_RESERVADOS = new Set(['login', 'admin', 'superadmin', 'revendedor', 'r', 'pos', 'api', 'assets', 'tienda', 'favicon']);

// Tope de seguridad para imágenes en base64. Las imágenes se comprimen en el
// navegador antes de subir (quedan en ~60-260KB), así que este límite es solo
// una red de contención para que nadie llene la base con imágenes gigantes.
const MAX_IMG = 700_000; // ~500KB de binario
function imagenOk(dataUri) {
    if (!dataUri) return true;
    if (typeof dataUri !== 'string') return false;
    if (dataUri.length > MAX_IMG) return false;
    return /^data:image\//i.test(dataUri) || /^https?:\/\//i.test(dataUri);
}

// -----------------------------------------------
// GET /api/tienda/config — configuración + slug del negocio
// -----------------------------------------------
router.get('/config', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        await db.query('INSERT INTO tienda_config (negocio_id) VALUES ($1) ON CONFLICT (negocio_id) DO NOTHING', [negocio_id]);
        const cfg = await db.query('SELECT * FROM tienda_config WHERE negocio_id = $1', [negocio_id]);
        const neg = await db.query('SELECT slug, nombre FROM negocios WHERE id = $1', [negocio_id]);
        res.json({ ...cfg.rows[0], slug: neg.rows[0]?.slug || null, negocio_nombre: neg.rows[0]?.nombre || '' });
    } catch (error) {
        console.error('Error tienda/config GET:', error);
        res.status(500).json({ error: 'Error al obtener la configuración de la tienda' });
    }
});

// -----------------------------------------------
// PUT /api/tienda/config — guardar configuración (+ slug del negocio)
// -----------------------------------------------
router.put('/config', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const b = req.body || {};

        for (const campo of ['logo', 'banner']) {
            if (b[campo] && !imagenOk(b[campo])) return res.status(400).json({ error: 'La imagen es demasiado grande o no es válida' });
        }

        // Slug (opcional): validar reservados y unicidad.
        let slug = normalizarSlug(b.slug);
        if (slug !== undefined) {
            if (slug && SLUG_RESERVADOS.has(slug)) return res.status(400).json({ error: 'Ese enlace no está permitido, elegí otro' });
            if (slug) {
                const usado = await db.query('SELECT id FROM negocios WHERE slug = $1 AND id <> $2', [slug, negocio_id]);
                if (usado.rows.length) return res.status(400).json({ error: 'Ese enlace ya está en uso, elegí otro' });
            }
            await db.query('UPDATE negocios SET slug = $1 WHERE id = $2', [slug, negocio_id]);
        }

        if (b.fondo_imagen && !imagenOk(b.fondo_imagen)) return res.status(400).json({ error: 'La imagen de fondo es demasiado grande o no es válida' });
        await db.query('INSERT INTO tienda_config (negocio_id) VALUES ($1) ON CONFLICT (negocio_id) DO NOTHING', [negocio_id]);
        const r = await db.query(`
            UPDATE tienda_config SET
                habilitada = COALESCE($2, habilitada),
                titulo = COALESCE($3, titulo),
                descripcion = COALESCE($4, descripcion),
                logo = COALESCE($5, logo),
                banner = COALESCE($6, banner),
                color_primario = COALESCE($7, color_primario),
                color_fondo = COALESCE($8, color_fondo),
                abierta_siempre = COALESCE($9, abierta_siempre),
                horarios = COALESCE($10, horarios),
                alias_transferencia = COALESCE($11, alias_transferencia),
                titular_cuenta = COALESCE($12, titular_cuenta),
                mostrar_transferencia = COALESCE($13, mostrar_transferencia),
                mostrar_efectivo = COALESCE($14, mostrar_efectivo),
                whatsapp = COALESCE($15, whatsapp),
                recargo_pct = COALESCE($16, recargo_pct),
                fondo_imagen = COALESCE($17, fondo_imagen),
                color_texto = COALESCE($18, color_texto),
                mostrar_takeaway = COALESCE($19, mostrar_takeaway),
                mostrar_delivery = COALESCE($20, mostrar_delivery),
                delivery_abierto_siempre = COALESCE($21, delivery_abierto_siempre),
                delivery_horarios = COALESCE($22, delivery_horarios),
                sonido_tipo = COALESCE($23, sonido_tipo),
                sonido_repeticiones = COALESCE($24, sonido_repeticiones),
                updated_at = NOW()
            WHERE negocio_id = $1
            RETURNING *
        `, [
            negocio_id,
            typeof b.habilitada === 'boolean' ? b.habilitada : null,
            b.titulo ?? null, b.descripcion ?? null, b.logo ?? null, b.banner ?? null,
            b.color_primario ?? null, b.color_fondo ?? null,
            typeof b.abierta_siempre === 'boolean' ? b.abierta_siempre : null,
            b.horarios != null ? JSON.stringify(b.horarios) : null,
            b.alias_transferencia ?? null, b.titular_cuenta ?? null,
            typeof b.mostrar_transferencia === 'boolean' ? b.mostrar_transferencia : null,
            typeof b.mostrar_efectivo === 'boolean' ? b.mostrar_efectivo : null,
            b.whatsapp ?? null,
            b.recargo_pct != null ? parseFloat(b.recargo_pct) : null,
            b.fondo_imagen ?? null, b.color_texto ?? null,
            typeof b.mostrar_takeaway === 'boolean' ? b.mostrar_takeaway : null,
            typeof b.mostrar_delivery === 'boolean' ? b.mostrar_delivery : null,
            typeof b.delivery_abierto_siempre === 'boolean' ? b.delivery_abierto_siempre : null,
            b.delivery_horarios != null ? JSON.stringify(b.delivery_horarios) : null,
            b.sonido_tipo ?? null,
            b.sonido_repeticiones != null ? parseInt(b.sonido_repeticiones) : null,
        ]);
        const neg = await db.query('SELECT slug FROM negocios WHERE id = $1', [negocio_id]);
        res.json({ ...r.rows[0], slug: neg.rows[0]?.slug || null });
    } catch (error) {
        console.error('Error tienda/config PUT:', error);
        res.status(500).json({ error: 'Error al guardar la configuración' });
    }
});

// -----------------------------------------------
// GET /api/tienda/productos-disponibles — productos del stock para elegir
// -----------------------------------------------
router.get('/productos-disponibles', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const r = await db.query(`
            SELECT p.id, p.nombre, p.codigo, p.precio_venta, p.stock, p.unidad,
                   (tp.id IS NOT NULL) AS en_catalogo
            FROM productos p
            LEFT JOIN tienda_productos tp ON tp.producto_id = p.id AND tp.negocio_id = p.negocio_id
            WHERE p.negocio_id = $1 AND p.activo = TRUE
            ORDER BY p.nombre ASC
        `, [negocio_id]);
        res.json(r.rows);
    } catch (error) {
        console.error('Error productos-disponibles:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// -----------------------------------------------
// GET /api/tienda/catalogo — productos del catálogo online
// -----------------------------------------------
router.get('/catalogo', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const r = await db.query(`
            SELECT tp.*, p.nombre, p.codigo, p.precio_venta, p.stock, p.unidad,
                   COALESCE(tp.precio_online, p.precio_venta) AS precio_efectivo
            FROM tienda_productos tp
            JOIN productos p ON p.id = tp.producto_id
            WHERE tp.negocio_id = $1
            ORDER BY tp.orden ASC, p.nombre ASC
        `, [negocio_id]);
        res.json(r.rows);
    } catch (error) {
        console.error('Error catalogo GET:', error);
        res.status(500).json({ error: 'Error al obtener el catálogo' });
    }
});

// -----------------------------------------------
// POST /api/tienda/catalogo — agregar producto al catálogo
// -----------------------------------------------
router.post('/catalogo', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { producto_id, precio_online, foto, descripcion, permitir_sin_stock } = req.body || {};
        if (!producto_id) return res.status(400).json({ error: 'Falta el producto' });
        if (foto && !imagenOk(foto)) return res.status(400).json({ error: 'La imagen es demasiado grande o no es válida' });
        // El producto debe ser de este negocio.
        const p = await db.query('SELECT id FROM productos WHERE id = $1 AND negocio_id = $2', [producto_id, negocio_id]);
        if (!p.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });

        const r = await db.query(`
            INSERT INTO tienda_productos (negocio_id, producto_id, precio_online, foto, descripcion, permitir_sin_stock)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (negocio_id, producto_id) DO UPDATE SET activo = TRUE
            RETURNING *
        `, [negocio_id, producto_id, precio_online != null && precio_online !== '' ? parseFloat(precio_online) : null, foto || null, descripcion || null, permitir_sin_stock === true]);
        res.status(201).json(r.rows[0]);
    } catch (error) {
        console.error('Error catalogo POST:', error);
        res.status(500).json({ error: 'Error al agregar el producto' });
    }
});

// -----------------------------------------------
// PUT /api/tienda/catalogo/:id — editar item del catálogo
// -----------------------------------------------
router.put('/catalogo/:id', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { activo, precio_online, foto, descripcion, orden, permitir_sin_stock } = req.body || {};
        if (foto && !imagenOk(foto)) return res.status(400).json({ error: 'La imagen es demasiado grande o no es válida' });
        const r = await db.query(`
            UPDATE tienda_productos SET
                activo = COALESCE($3, activo),
                precio_online = $4,
                foto = COALESCE($5, foto),
                descripcion = COALESCE($6, descripcion),
                orden = COALESCE($7, orden),
                permitir_sin_stock = COALESCE($8, permitir_sin_stock)
            WHERE id = $1 AND negocio_id = $2
            RETURNING *
        `, [req.params.id, negocio_id,
            typeof activo === 'boolean' ? activo : null,
            precio_online != null && precio_online !== '' ? parseFloat(precio_online) : null,
            foto || null, descripcion ?? null,
            orden != null ? parseInt(orden) : null,
            typeof permitir_sin_stock === 'boolean' ? permitir_sin_stock : null]);
        if (!r.rows.length) return res.status(404).json({ error: 'Item no encontrado' });
        res.json(r.rows[0]);
    } catch (error) {
        console.error('Error catalogo PUT:', error);
        res.status(500).json({ error: 'Error al actualizar el producto' });
    }
});

// -----------------------------------------------
// DELETE /api/tienda/catalogo/:id — quitar del catálogo
// -----------------------------------------------
router.delete('/catalogo/:id', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        await db.query('DELETE FROM tienda_productos WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        res.json({ mensaje: 'Producto quitado del catálogo' });
    } catch (error) {
        console.error('Error catalogo DELETE:', error);
        res.status(500).json({ error: 'Error al quitar el producto' });
    }
});

// -----------------------------------------------
// GET /api/tienda/pedidos — lista de pedidos online
// -----------------------------------------------
router.get('/pedidos', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const r = await db.query('SELECT * FROM tienda_pedidos WHERE negocio_id = $1 ORDER BY created_at DESC LIMIT 300', [negocio_id]);
        res.json(r.rows);
    } catch (error) {
        console.error('Error pedidos GET:', error);
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

// -----------------------------------------------
// GET /api/tienda/pedidos/nuevos — conteo de pedidos no leídos (badge del POS)
// -----------------------------------------------
router.get('/pedidos/nuevos', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.json({ nuevos: 0 });
        const r = await db.query("SELECT COUNT(*)::int AS n FROM tienda_pedidos WHERE negocio_id = $1 AND leido = FALSE AND estado <> 'cancelado'", [negocio_id]);
        const cfg = await db.query('SELECT sonido_tipo, sonido_repeticiones FROM tienda_config WHERE negocio_id = $1', [negocio_id]);
        res.json({
            nuevos: r.rows[0].n,
            sonido_tipo: cfg.rows[0]?.sonido_tipo || 'campana',
            sonido_repeticiones: cfg.rows[0]?.sonido_repeticiones ?? 2,
        });
    } catch (error) {
        res.json({ nuevos: 0 });
    }
});

// -----------------------------------------------
// PUT /api/tienda/pedidos/marcar-leidos — marcar todos como leídos
// -----------------------------------------------
router.put('/pedidos/marcar-leidos', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        await db.query('UPDATE tienda_pedidos SET leido = TRUE WHERE negocio_id = $1 AND leido = FALSE', [negocio_id]);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Error' });
    }
});

// -----------------------------------------------
// PUT /api/tienda/pedidos/:id/estado — cambiar estado (cancelar restaura stock)
// -----------------------------------------------
router.put('/pedidos/:id/estado', async (req, res) => {
    const negocio_id = req.negocio_id || req.usuario?.negocio_id;
    if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
    const nuevo = req.body?.estado;
    if (!['pendiente', 'confirmado', 'entregado', 'cancelado'].includes(nuevo)) {
        return res.status(400).json({ error: 'Estado inválido' });
    }
    const cliente = await db.pool.connect();
    try {
        await cliente.query('BEGIN');
        const ped = await cliente.query('SELECT * FROM tienda_pedidos WHERE id = $1 AND negocio_id = $2 FOR UPDATE', [req.params.id, negocio_id]);
        if (!ped.rows.length) { await cliente.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido no encontrado' }); }
        const p = ped.rows[0];

        // Al CANCELAR (desde un estado no cancelado): restaurar el stock.
        if (nuevo === 'cancelado' && p.estado !== 'cancelado') {
            const items = Array.isArray(p.items_json) ? p.items_json : [];
            for (const it of items) {
                if (it.producto_id) await ajustarStock(negocio_id, it.producto_id, it.cantidad, +1, cliente);
            }
        }
        const r = await cliente.query('UPDATE tienda_pedidos SET estado = $1, leido = TRUE WHERE id = $2 RETURNING *', [nuevo, req.params.id]);
        await cliente.query('COMMIT');
        // Aviso automático al cliente por WhatsApp según el nuevo estado.
        avisarEstadoWhatsapp(negocio_id, r.rows[0], nuevo).catch(() => {});
        res.json(r.rows[0]);
    } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        console.error('Error pedido estado:', error);
        res.status(500).json({ error: 'Error al cambiar el estado' });
    } finally {
        cliente.release();
    }
});

module.exports = router;
