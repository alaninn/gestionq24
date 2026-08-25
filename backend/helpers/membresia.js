// =============================================
// Acreditación de una renovación de membresía pagada por Mercado Pago.
// Idempotente por pago_ref: un mismo pago no acredita dos veces, aunque lleguen
// tanto el webhook como la confirmación al volver del checkout.
// Extiende fecha_vencimiento y reactiva el negocio (misma lógica que el renovar
// del superadmin en routes/superadmin.js).
// =============================================

const db = require('../config/database');
const { invalidarCacheNegocio } = require('../middleware/auth');

// Acredita `dias` de membresía al negocio si ese pago (pagoRef) no fue procesado
// antes. Devuelve { acreditado }.
async function acreditarMembresia(negocioId, dias, monto, pagoRef) {
    const diasNum = Math.max(1, parseInt(dias) || 30);
    const cliente = await db.pool.connect();
    try {
        await cliente.query('BEGIN');
        // Guard de idempotencia: si ese pago ya se registró, no devuelve fila.
        const ins = await cliente.query(`
            INSERT INTO pagos_historial (negocio_id, dias, monto, metodo_pago, observaciones, tipo, pago_ref)
            VALUES ($1, $2, $3, 'mercadopago', 'Pago automático por Mercado Pago', 'renovacion', $4)
            ON CONFLICT (pago_ref) DO NOTHING
            RETURNING id
        `, [negocioId, diasNum, monto || 0, pagoRef]);

        if (!ins.rows[0]) {
            await cliente.query('ROLLBACK');
            return { acreditado: false };
        }

        await cliente.query(`
            UPDATE negocios SET
                estado = 'activo',
                fecha_vencimiento = CASE
                    WHEN fecha_vencimiento > NOW()
                    THEN fecha_vencimiento + ($1 * INTERVAL '1 day')
                    ELSE NOW() + ($1 * INTERVAL '1 day')
                END
            WHERE id = $2
        `, [diasNum, negocioId]);
        await cliente.query('COMMIT');
        invalidarCacheNegocio(negocioId);
        return { acreditado: true };
    } catch (e) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        cliente.release();
    }
}

module.exports = { acreditarMembresia };
