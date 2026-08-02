const db = require('../config/database');

// ---- STOCK COMBO-AWARE ----
// Ajusta el stock por un item vendido/movido. Si el producto es COMBINADO, no
// tiene stock propio: descuenta/repone el stock de cada componente segun su
// cantidad en el combo. Si es normal, ajusta el producto directo.
// signo: -1 al vender/enviar, +1 al restaurar/recibir.
// exec: conexion a usar (un client dentro de una transaccion, o el pool por defecto).
async function ajustarStock(negocio_id, producto_id, cantidadVenta, signo, exec = db) {
    const combo = await exec.query(
        'SELECT producto_id, cantidad FROM producto_combo WHERE combo_id = $1 AND negocio_id = $2',
        [producto_id, negocio_id]
    );
    if (combo.rows.length > 0) {
        for (const comp of combo.rows) {
            const delta = signo * (parseFloat(comp.cantidad) || 0) * (parseFloat(cantidadVenta) || 0);
            await exec.query(
                'UPDATE productos SET stock = stock + $1::numeric WHERE id = $2 AND negocio_id = $3',
                [delta, comp.producto_id, negocio_id]
            );
        }
    } else {
        const delta = signo * (parseFloat(cantidadVenta) || 0);
        await exec.query(
            'UPDATE productos SET stock = stock + $1::numeric WHERE id = $2 AND negocio_id = $3',
            [delta, producto_id, negocio_id]
        );
    }
}

// Disponible real de un combo = lo que alcanza del componente mas escaso.
async function disponibleCombo(negocio_id, combo_id, exec = db) {
    const r = await exec.query(`
        SELECT MIN(FLOOR(comp.stock / NULLIF(cc.cantidad, 0))) AS disp
        FROM producto_combo cc
        JOIN productos comp ON comp.id = cc.producto_id
        WHERE cc.combo_id = $1 AND cc.negocio_id = $2
    `, [combo_id, negocio_id]);
    return r.rows[0]?.disp == null ? 0 : parseFloat(r.rows[0].disp);
}

module.exports = { ajustarStock, disponibleCombo };
