// =============================================
// ARCHIVO: routes/whatsapp.js
// Integración de WhatsApp (Baileys) — vincular por QR y estado. Solo admin.
// El servicio se carga de forma perezosa: si Baileys falla al cargar, la
// integración queda "no disponible" pero NO tumba el resto del sistema.
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');

function wa() {
    // require perezoso + cacheado; si falla, se propaga como 503 controlado.
    return require('../services/whatsappService');
}

// GET /api/whatsapp/status
router.get('/status', async (req, res) => {
    const negocio_id = req.negocio_id || req.usuario?.negocio_id;
    if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
    try {
        const st = await wa().getStatus(negocio_id);
        const cfg = await db.query('SELECT notificar_pedidos FROM whatsapp_config WHERE negocio_id = $1', [negocio_id]).catch(() => ({ rows: [] }));
        res.json({ ...st, notificar_pedidos: cfg.rows[0]?.notificar_pedidos !== false });
    } catch (e) {
        res.json({ status: 'no_disponible', ready: false, hasQr: false, numero: null, error: 'La integración no está disponible' });
    }
});

// GET /api/whatsapp/qr — genera el QR para vincular
router.get('/qr', async (req, res) => {
    const negocio_id = req.negocio_id || req.usuario?.negocio_id;
    if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
    try {
        const qr = await wa().getQrCode(negocio_id);
        if (!qr) return res.status(408).json({ error: 'No se pudo generar el QR, probá de nuevo' });
        res.json({ qr });
    } catch (e) {
        res.status(503).json({ error: 'La integración de WhatsApp no está disponible' });
    }
});

// POST /api/whatsapp/disconnect — desvincular
router.post('/disconnect', async (req, res) => {
    const negocio_id = req.negocio_id || req.usuario?.negocio_id;
    if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
    try {
        await wa().disconnect(negocio_id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al desvincular' });
    }
});

// PUT /api/whatsapp/config — activar/desactivar avisos automáticos a clientes
router.put('/config', async (req, res) => {
    const negocio_id = req.negocio_id || req.usuario?.negocio_id;
    if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
    try {
        const notificar = req.body?.notificar_pedidos !== false;
        await db.query(`
            INSERT INTO whatsapp_config (negocio_id, notificar_pedidos) VALUES ($1, $2)
            ON CONFLICT (negocio_id) DO UPDATE SET notificar_pedidos = $2, updated_at = NOW()
        `, [negocio_id, notificar]);
        res.json({ ok: true, notificar_pedidos: notificar });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

module.exports = router;
