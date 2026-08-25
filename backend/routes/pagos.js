// =============================================
// ARCHIVO: routes/pagos.js
// Mercado Pago: webhook público + autopago de la membresía del negocio.
// - El webhook acredita tanto tokens de revendedores (external_reference rev:...)
//   como renovaciones de membresía (mem:<negocioId>:<dias>). Idempotente por
//   pago_ref. Inactivo si no hay MP_ACCESS_TOKEN.
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const mp = require('../services/mercadopago');
const { revendedoresHabilitado } = require('../helpers/configSistema');
const { acreditarMembresia } = require('../helpers/membresia');

const DIAS_MEMBRESIA = 30;

// --- Tokens de revendedor (external_reference rev:<id>:<cantidad>) ---
async function acreditarTokensRevendedor(pago) {
    if (!(await revendedoresHabilitado())) return;
    const m = String(pago.external_reference || '').match(/^rev:(\d+):(\d+)$/);
    if (!m) return;
    const revendedorId = parseInt(m[1]);
    const cantidad = parseInt(m[2]);
    if (!revendedorId || !cantidad) return;
    const pagoRef = `mp:${pago.id}`;
    const cliente = await db.pool.connect();
    try {
        await cliente.query('BEGIN');
        const rv = await cliente.query('SELECT tokens FROM revendedores WHERE id = $1 FOR UPDATE', [revendedorId]);
        if (!rv.rows[0]) { await cliente.query('ROLLBACK'); return; }
        const nuevoSaldo = rv.rows[0].tokens + cantidad;
        const ins = await cliente.query(`
            INSERT INTO revendedor_tokens_mov (revendedor_id, tipo, cantidad, saldo_resultante, pago_ref, observaciones)
            VALUES ($1, 'compra', $2, $3, $4, 'Compra por Mercado Pago')
            ON CONFLICT (pago_ref) DO NOTHING
            RETURNING id
        `, [revendedorId, cantidad, nuevoSaldo, pagoRef]);
        if (ins.rows[0]) {
            await cliente.query('UPDATE revendedores SET tokens = $1 WHERE id = $2', [nuevoSaldo, revendedorId]);
        }
        await cliente.query('COMMIT');
    } catch (e) {
        await cliente.query('ROLLBACK').catch(() => {});
        console.error('Error acreditando tokens MP:', e.message);
    } finally {
        cliente.release();
    }
}

// --- Membresía de un negocio (external_reference mem:<negocioId>:<dias>) ---
async function procesarMembresia(pago) {
    const m = String(pago.external_reference || '').match(/^mem:(\d+):(\d+)$/);
    if (!m) return;
    const negocioId = parseInt(m[1]);
    const dias = parseInt(m[2]);
    if (!negocioId || !dias) return;
    await acreditarMembresia(negocioId, dias, pago.transaction_amount, `mp:${pago.id}`);
}

// POST /api/pagos/mp-webhook — notificación de Mercado Pago (tokens y membresías).
// Respondemos 200 al toque: MP reintenta si no le damos 200. El trabajo real se
// hace igual y cualquier fallo se traga y se loguea.
router.post('/mp-webhook', async (req, res) => {
    res.sendStatus(200);
    try {
        if (!mp.habilitado()) return;
        const tipo = req.body?.type || req.query?.type || req.query?.topic;
        const pagoId = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
        if (tipo && tipo !== 'payment') return;
        if (!pagoId) return;

        // Nunca confiamos en el webhook: consultamos el pago real.
        const pago = await mp.obtenerPago(pagoId);
        if (!pago || pago.status !== 'approved') return;

        const ref = String(pago.external_reference || '');
        if (ref.startsWith('mem:')) await procesarMembresia(pago);
        else if (ref.startsWith('rev:')) await acreditarTokensRevendedor(pago);
    } catch (error) {
        console.error('Error en webhook MP:', error.message);
    }
});

// GET /api/pagos/membresia/estado?negocio_id= — ¿hay autopago disponible y a
// qué precio? No crea preferencia; solo sirve para decidir si mostrar el botón.
router.get('/membresia/estado', async (req, res) => {
    try {
        if (!mp.habilitado()) return res.json({ disponible: false });
        const negocioId = parseInt(req.query?.negocio_id);
        if (!negocioId) return res.json({ disponible: false });
        const r = await db.query('SELECT plan, estado, revendedor_id FROM negocios WHERE id = $1', [negocioId]);
        const neg = r.rows[0];
        if (!neg || neg.revendedor_id != null || neg.estado === 'bloqueado') return res.json({ disponible: false });
        const plan = ['estandar', 'premium'].includes(neg.plan) ? neg.plan : 'estandar';
        const pc = await db.query('SELECT precio FROM planes_config WHERE plan = $1', [plan]);
        const precio = parseFloat(pc.rows[0]?.precio) || 0;
        res.json({ disponible: precio > 0, precio, dias: DIAS_MEMBRESIA });
    } catch (e) {
        res.json({ disponible: false });
    }
});

// POST /api/pagos/membresia/crear — inicia el pago de renovación de un negocio.
// Público (la pantalla de bloqueo no tiene sesión). Solo negocios DIRECTOS y no
// bloqueados manualmente. Devuelve el init_point del checkout de Mercado Pago.
router.post('/membresia/crear', async (req, res) => {
    try {
        if (!mp.habilitado()) return res.json({ disponible: false });
        const negocioId = parseInt(req.body?.negocio_id);
        if (!negocioId) return res.status(400).json({ error: 'Falta el negocio' });

        const r = await db.query(
            'SELECT id, nombre, plan, estado, revendedor_id FROM negocios WHERE id = $1',
            [negocioId]
        );
        const neg = r.rows[0];
        if (!neg) return res.status(404).json({ error: 'Negocio no encontrado' });
        if (neg.revendedor_id != null) return res.status(400).json({ error: 'Este negocio se renueva a través de su distribuidor' });
        if (neg.estado === 'bloqueado') return res.status(400).json({ error: 'Tu cuenta está bloqueada. Contactá al administrador.' });

        const plan = ['estandar', 'premium'].includes(neg.plan) ? neg.plan : 'estandar';
        const pc = await db.query('SELECT precio FROM planes_config WHERE plan = $1', [plan]);
        const precio = parseFloat(pc.rows[0]?.precio) || 0;
        if (precio <= 0) return res.status(400).json({ error: 'No se pudo determinar el precio del plan' });

        const pref = await mp.crearPreferenciaMembresia({
            negocioId: neg.id,
            negocioNombre: neg.nombre,
            plan,
            precio,
            dias: DIAS_MEMBRESIA,
            emailPagador: req.body?.email || undefined,
        });
        res.json({ disponible: true, init_point: pref.init_point, total: pref.total, dias: DIAS_MEMBRESIA });
    } catch (error) {
        if (error.mpDeshabilitado) return res.json({ disponible: false });
        console.error('Error creando pago de membresía:', error.message);
        res.status(500).json({ error: 'No se pudo iniciar el pago, probá de nuevo' });
    }
});

// POST /api/pagos/membresia/confirmar — al volver del checkout, verifica el pago
// y reactiva al instante (idempotente con el webhook). Público.
router.post('/membresia/confirmar', async (req, res) => {
    try {
        if (!mp.habilitado()) return res.json({ ok: false, disponible: false });
        const paymentId = req.body?.payment_id || req.query?.payment_id;
        if (!paymentId) return res.status(400).json({ error: 'Falta el pago' });

        const pago = await mp.obtenerPago(paymentId);
        if (!pago) return res.json({ ok: false, estado: 'desconocido' });
        if (pago.status !== 'approved') return res.json({ ok: false, estado: pago.status });

        const m = String(pago.external_reference || '').match(/^mem:(\d+):(\d+)$/);
        if (!m) return res.json({ ok: false, estado: 'sin_referencia' });

        // Si ya se acreditó (webhook o confirmación previa), igual está activo.
        await acreditarMembresia(parseInt(m[1]), parseInt(m[2]), pago.transaction_amount, `mp:${pago.id}`);
        res.json({ ok: true, estado: 'approved', activado: true });
    } catch (error) {
        console.error('Error confirmando pago de membresía:', error.message);
        res.status(500).json({ error: 'No se pudo confirmar el pago' });
    }
});

module.exports = router;
