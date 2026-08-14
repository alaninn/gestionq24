// =============================================
// ARCHIVO: routes/pagos.js
// Webhook público de Mercado Pago para acreditar tokens comprados por
// revendedores. Idempotente (no acredita dos veces el mismo pago) gracias al
// índice único sobre revendedor_tokens_mov.pago_ref. Inactivo si no hay
// MP_ACCESS_TOKEN o si la capa de revendedores está apagada.
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const mp = require('../services/mercadopago');
const { revendedoresHabilitado } = require('../helpers/configSistema');

// POST /api/pagos/mp-webhook — notificación de Mercado Pago
router.post('/mp-webhook', async (req, res) => {
    // Siempre respondemos 200 rápido: MP reintenta si no le damos 200, y no
    // queremos que un error nuestro genere reintentos infinitos. El trabajo real
    // se hace igual pero cualquier fallo se traga y se loguea.
    res.sendStatus(200);

    try {
        if (!mp.habilitado() || !(await revendedoresHabilitado())) return;

        // MP manda el id del pago de distintas formas segun el tipo de evento.
        const tipo = req.body?.type || req.query?.type || req.query?.topic;
        const pagoId = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
        if (tipo && tipo !== 'payment') return;
        if (!pagoId) return;

        const pago = await mp.obtenerPago(pagoId);
        if (!pago || pago.status !== 'approved') return;

        // external_reference con el formato rev:<revendedorId>:<cantidad>
        const ref = String(pago.external_reference || '');
        const m = ref.match(/^rev:(\d+):(\d+)$/);
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

            // Idempotencia: si ese pago ya se acreditó, el INSERT no devuelve fila.
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
            console.error('Error acreditando pago MP:', e.message);
        } finally {
            cliente.release();
        }
    } catch (error) {
        console.error('Error en webhook MP:', error.message);
    }
});

module.exports = router;
