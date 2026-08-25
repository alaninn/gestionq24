// =============================================
// ARCHIVO: routes/publico.js
// Rutas públicas (sin autenticación) para la landing page.
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { ajustarStock, disponibleCombo } = require('../helpers/stock');
const { diaVencido } = require('../helpers/vencimiento');

// Días de la semana (0=domingo) mapeados a las claves de horarios.
const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

// ¿Está dentro del horario? (horario Argentina). abiertaSiempre = siempre abierto.
function dentroDeHorario(abiertaSiempre, horarios) {
    if (abiertaSiempre !== false) return true;
    const h = horarios || {};
    const ahora = new Date();
    const partes = new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(ahora);
    const diaIdx = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short' }).format(ahora);
    const mapEn = { Sun: 'dom', Mon: 'lun', Tue: 'mar', Wed: 'mie', Thu: 'jue', Fri: 'vie', Sat: 'sab' };
    const dia = h[mapEn[diaIdx] || 'lun'];
    if (!dia || dia.cerrado) return false;
    const hh = partes.find(p => p.type === 'hour')?.value || '00';
    const mm = partes.find(p => p.type === 'minute')?.value || '00';
    const actual = `${hh}:${mm}`;
    if (dia.abre && actual < dia.abre) return false;
    if (dia.cierra && actual > dia.cierra) return false;
    return true;
}
// La tienda (para mirar el catálogo / hacer pedidos).
function estaAbierta(cfg) { return dentroDeHorario(cfg.abierta_siempre, cfg.horarios); }
// El delivery (puede tener un horario distinto al de la tienda).
function deliveryAbierto(cfg) {
    if (cfg.mostrar_delivery === false) return false;
    return dentroDeHorario(cfg.delivery_abierto_siempre, cfg.delivery_horarios);
}

// Resuelve la tienda por slug. Devuelve { negocio, cfg } o null si no aplica
// (no existe, no está habilitada, negocio bloqueado/vencido, o plan sin tienda).
async function resolverTienda(slug) {
    if (!slug) return null;
    const r = await db.query(`
        SELECT n.id, n.nombre, n.estado, n.fecha_vencimiento, n.plan,
               tc.*,
               (COALESCE(pc.tienda_online, n.plan = 'premium') OR n.tienda_online_habilitado = TRUE) AS plan_permite
        FROM negocios n
        JOIN tienda_config tc ON tc.negocio_id = n.id
        LEFT JOIN planes_config pc ON pc.plan = n.plan
        WHERE n.slug = $1
    `, [slug]).catch(() => ({ rows: [] }));
    const row = r.rows[0];
    if (!row) return null;
    if (!row.habilitada || !row.plan_permite) return null;
    if (row.estado === 'bloqueado' || row.estado === 'vencido' || diaVencido(row.fecha_vencimiento)) return null;
    return { negocio: { id: row.id, nombre: row.nombre }, cfg: row };
}

// Precio final online de un producto (override o precio de venta) + recargo global.
function precioEfectivo(precioOnline, precioVenta, recargoPct) {
    const base = precioOnline != null ? parseFloat(precioOnline) : parseFloat(precioVenta) || 0;
    const rec = parseFloat(recargoPct) || 0;
    return Math.round(base * (1 + rec / 100) * 100) / 100;
}

const fmtPeso = (n) => '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

// Avisa al cliente por WhatsApp que su pedido fue recibido (si el negocio tiene
// WhatsApp vinculado y los avisos activados). Nunca lanza.
async function avisarClienteWhatsapp(negocio, cfg, pedido, body, tipoEntrega, metodo, total) {
    try {
        const wc = await db.query('SELECT status, notificar_pedidos FROM whatsapp_config WHERE negocio_id = $1', [negocio.id]);
        if (!wc.rows[0] || wc.rows[0].status !== 'connected' || wc.rows[0].notificar_pedidos === false) return;
        if (!body.whatsapp) return;
        const entrega = tipoEntrega === 'takeaway' ? 'Retiro en el local' : `Delivery a: ${body.direccion}`;
        const pago = metodo === 'transferencia'
            ? `Transferencia${cfg.alias_transferencia ? ` (alias: ${cfg.alias_transferencia})` : ''}`
            : 'Efectivo al recibir';
        const msg = [
            `¡Hola ${body.cliente_nombre}! 👋`,
            `Recibimos tu pedido *#${pedido.id}* en *${cfg.titulo || negocio.nombre}* ✅`,
            '',
            `Total: *${fmtPeso(total)}*`,
            `Entrega: ${entrega}`,
            `Pago: ${pago}`,
            tipoEntrega === 'delivery' ? '\nTe informamos el costo del envío al confirmarte el pedido.' : '',
            '\n¡Gracias por tu compra! Te contactamos para coordinar. 🙌',
        ].filter(Boolean).join('\n');
        require('../services/whatsappService').sendMessage(negocio.id, body.whatsapp, msg).catch(() => {});
    } catch (e) { /* nunca romper el pedido por el aviso */ }
}

// GET /api/publico/precios — precios mensuales de cada plan para la landing.
// Los edita el superadmin desde Configuración de Planes.
router.get('/precios', async (req, res) => {
    try {
        const r = await db.query('SELECT plan, precio FROM planes_config');
        const precios = {};
        for (const row of r.rows) precios[row.plan] = row.precio ?? 0;
        res.json({
            estandar: precios.estandar || 10000,
            premium: precios.premium || 30000
        });
    } catch (e) {
        // Ante cualquier error devolvemos los valores por defecto para no romper la landing.
        res.json({ estandar: 10000, premium: 30000 });
    }
});

// GET /api/publico/landing — datos configurables de la página de venta.
// Teléfono de contacto y textos del hero (los edita el superadmin) + precios.
router.get('/landing', async (req, res) => {
    const DEFAULT_WA = '5491162684353';
    try {
        const cs = await db.query('SELECT landing_whatsapp, landing_hero_titulo, landing_hero_subtitulo FROM config_sistema WHERE id = 1');
        const pc = await db.query('SELECT plan, precio FROM planes_config');
        const precios = {};
        for (const row of pc.rows) precios[row.plan] = row.precio ?? 0;
        const c = cs.rows[0] || {};
        const wa = String(c.landing_whatsapp || DEFAULT_WA).replace(/\D/g, '') || DEFAULT_WA;
        res.json({
            whatsapp: wa,
            hero_titulo: c.landing_hero_titulo || '',
            hero_subtitulo: c.landing_hero_subtitulo || '',
            precios: { estandar: precios.estandar || 10000, premium: precios.premium || 30000 },
        });
    } catch (e) {
        // Ante cualquier error, valores por defecto para no romper la landing.
        res.json({ whatsapp: DEFAULT_WA, hero_titulo: '', hero_subtitulo: '', precios: { estandar: 10000, premium: 30000 } });
    }
});

// =============================================
// TIENDA ONLINE PÚBLICA (sin login) — catálogo y pedidos
// =============================================

// GET /api/publico/tienda/:slug — datos de la tienda + catálogo
router.get('/tienda/:slug', async (req, res) => {
    try {
        const t = await resolverTienda(req.params.slug);
        if (!t) return res.status(404).json({ error: 'Tienda no disponible' });
        const { negocio, cfg } = t;

        const abierta = estaAbierta(cfg);
        const prods = await db.query(`
            SELECT tp.id, tp.producto_id, tp.foto, tp.descripcion, tp.orden, tp.permitir_sin_stock,
                   p.nombre, p.unidad, p.precio_venta, p.stock, p.es_combinado,
                   tp.precio_online
            FROM tienda_productos tp
            JOIN productos p ON p.id = tp.producto_id
            WHERE tp.negocio_id = $1 AND tp.activo = TRUE AND p.activo = TRUE
            ORDER BY tp.orden ASC, p.nombre ASC
        `, [negocio.id]);

        const catalogo = prods.rows.map(p => {
            const sinStock = !p.es_combinado && parseFloat(p.stock) <= 0;
            const comprable = p.es_combinado || parseFloat(p.stock) > 0 || p.permitir_sin_stock === true;
            return {
                id: p.producto_id,
                nombre: p.nombre,
                descripcion: p.descripcion || '',
                foto: p.foto || null,
                unidad: p.unidad || 'un',
                precio: precioEfectivo(p.precio_online, p.precio_venta, cfg.recargo_pct),
                sin_stock: sinStock,
                comprable,
            };
        });

        res.json({
            negocio: { nombre: negocio.nombre },
            tienda: {
                titulo: cfg.titulo || negocio.nombre,
                descripcion: cfg.descripcion || '',
                logo: cfg.logo || null,
                banner: cfg.banner || null,
                fondo_imagen: cfg.fondo_imagen || null,
                color_primario: cfg.color_primario || '#f97316',
                color_fondo: cfg.color_fondo || '#0b0f1a',
                color_texto: cfg.color_texto || null,
                whatsapp: cfg.whatsapp || null,
                mostrar_efectivo: cfg.mostrar_efectivo !== false,
                mostrar_transferencia: cfg.mostrar_transferencia !== false,
                alias_transferencia: cfg.mostrar_transferencia !== false ? (cfg.alias_transferencia || null) : null,
                titular_cuenta: cfg.mostrar_transferencia !== false ? (cfg.titular_cuenta || null) : null,
                mostrar_takeaway: cfg.mostrar_takeaway !== false,
                mostrar_delivery: cfg.mostrar_delivery !== false,
                delivery_abierto: deliveryAbierto(cfg),
                abierta,
            },
            catalogo,
        });
    } catch (error) {
        console.error('Error tienda pública GET:', error);
        res.status(500).json({ error: 'Error al cargar la tienda' });
    }
});

// POST /api/publico/tienda/:slug/pedido — crear un pedido (descuenta stock)
router.post('/tienda/:slug/pedido', async (req, res) => {
    const t = await resolverTienda(req.params.slug);
    if (!t) return res.status(404).json({ error: 'Tienda no disponible' });
    const { negocio, cfg } = t;
    if (!estaAbierta(cfg)) return res.status(400).json({ error: 'La tienda está cerrada en este momento' });

    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items.filter(i => i && i.producto_id && parseFloat(i.cantidad) > 0) : [];
    if (!items.length) return res.status(400).json({ error: 'El carrito está vacío' });

    // Tipo de entrega: delivery o takeaway. Delivery exige dirección y horario.
    const tipoEntrega = b.tipo_entrega === 'takeaway' ? 'takeaway' : 'delivery';
    if (tipoEntrega === 'delivery') {
        if (cfg.mostrar_delivery === false) return res.status(400).json({ error: 'El delivery no está disponible' });
        if (!deliveryAbierto(cfg)) return res.status(400).json({ error: 'El delivery está cerrado en este horario' });
        if (!b.direccion) return res.status(400).json({ error: 'Ingresá la dirección de entrega' });
    } else {
        if (cfg.mostrar_takeaway === false) return res.status(400).json({ error: 'El retiro en el local no está disponible' });
    }
    if (!b.cliente_nombre || !b.whatsapp) {
        return res.status(400).json({ error: 'Completá tu nombre y WhatsApp' });
    }
    const metodo = b.metodo_pago === 'transferencia' ? 'transferencia' : 'efectivo';
    if (metodo === 'transferencia' && cfg.mostrar_transferencia === false) return res.status(400).json({ error: 'Ese método de pago no está disponible' });
    if (metodo === 'efectivo' && cfg.mostrar_efectivo === false) return res.status(400).json({ error: 'Ese método de pago no está disponible' });

    const cliente = await db.pool.connect();
    try {
        await cliente.query('BEGIN');
        let total = 0;
        const snapshot = [];
        for (const it of items) {
            // El producto debe estar en el catálogo activo de este negocio.
            const pr = await cliente.query(`
                SELECT p.id, p.nombre, p.precio_venta, p.stock, p.es_combinado, p.unidad, tp.precio_online, tp.permitir_sin_stock
                FROM tienda_productos tp
                JOIN productos p ON p.id = tp.producto_id
                WHERE tp.negocio_id = $1 AND tp.producto_id = $2 AND tp.activo = TRUE AND p.activo = TRUE
            `, [negocio.id, it.producto_id]);
            if (!pr.rows.length) { await cliente.query('ROLLBACK'); return res.status(400).json({ error: 'Un producto ya no está disponible' }); }
            const p = pr.rows[0];
            const cant = Math.max(1, Math.floor(parseFloat(it.cantidad)));

            // Stock (combo-aware). Si el producto NO permite venta sin stock, se
            // bloquea; si el dueño habilitó "vender sin stock", se deja pasar.
            if (p.permitir_sin_stock !== true) {
                const disp = p.es_combinado ? await disponibleCombo(negocio.id, p.id, cliente) : parseFloat(p.stock);
                if (disp < cant) { await cliente.query('ROLLBACK'); return res.status(400).json({ error: `Sin stock suficiente de ${p.nombre}` }); }
            }

            const precio = precioEfectivo(p.precio_online, p.precio_venta, cfg.recargo_pct);
            const subtotal = Math.round(precio * cant * 100) / 100;
            total += subtotal;
            snapshot.push({ producto_id: p.id, nombre: p.nombre, cantidad: cant, precio_unitario: precio, subtotal });
            await ajustarStock(negocio.id, p.id, cant, -1, cliente);
        }

        const ped = await cliente.query(`
            INSERT INTO tienda_pedidos (negocio_id, cliente_nombre, cliente_apellido, direccion, whatsapp, metodo_pago, total, items_json, notas, tipo_entrega)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, total, metodo_pago, created_at
        `, [negocio.id, String(b.cliente_nombre).slice(0, 120), String(b.cliente_apellido || '').slice(0, 120),
            tipoEntrega === 'delivery' ? String(b.direccion).slice(0, 500) : null, String(b.whatsapp).slice(0, 40), metodo, total,
            JSON.stringify(snapshot), String(b.notas || '').slice(0, 500), tipoEntrega]);

        await cliente.query('COMMIT');

        // Aviso automático al cliente por WhatsApp (si el negocio lo vinculó).
        // Fire-and-forget: nunca demora ni rompe la respuesta del pedido.
        avisarClienteWhatsapp(negocio, cfg, ped.rows[0], b, tipoEntrega, metodo, total).catch(() => {});

        res.status(201).json({
            ok: true,
            pedido_id: ped.rows[0].id,
            total,
            metodo_pago: metodo,
            tipo_entrega: tipoEntrega,
            alias: metodo === 'transferencia' ? (cfg.alias_transferencia || null) : null,
            titular_cuenta: metodo === 'transferencia' ? (cfg.titular_cuenta || null) : null,
        });
    } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        console.error('Error creando pedido online:', error);
        res.status(500).json({ error: 'No se pudo registrar el pedido, probá de nuevo' });
    } finally {
        cliente.release();
    }
});

module.exports = router;
