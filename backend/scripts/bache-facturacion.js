// =============================================
// BACHE DE FACTURACIÓN: encuentra las ventas que pidieron factura electrónica
// pero NO tienen un comprobante válido (CAE), para re-emitirlas.
// Útil tras una caída de AFIP (p. ej. la ventana de mantenimiento de madrugada).
//
// Uso en el VPS:
//   cd /root/gestionq24/backend
//   node scripts/bache-facturacion.js [negocio_id] [horas_atras]
//   (negocio_id por defecto 1; horas_atras por defecto 48)
// =============================================
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/database');

(async () => {
    try {
        const negocio_id = parseInt(process.argv[2] || '1');
        const horas = parseInt(process.argv[3] || '48');

        // Último comprobante VÁLIDO (con CAE) — referencia de "hasta dónde llegó bien"
        const ultimo = await db.query(`
            SELECT numero_comprobante, punto_venta, tipo_comprobante, cae, fecha_emision
            FROM comprobantes_electronicos
            WHERE negocio_id = $1 AND estado = 'emitido' AND cae IS NOT NULL
            ORDER BY fecha_emision DESC LIMIT 1
        `, [negocio_id]);

        console.log('============================================');
        console.log(`Negocio ${negocio_id} · ventana: últimas ${horas} h`);
        if (ultimo.rows.length) {
            const u = ultimo.rows[0];
            console.log(`Último comprobante VÁLIDO: Nº ${u.numero_comprobante} (ptoVta ${u.punto_venta}, tipo ${u.tipo_comprobante}) · CAE ${u.cae} · ${new Date(u.fecha_emision).toLocaleString('es-AR')}`);
        } else {
            console.log('No hay comprobantes válidos registrados.');
        }
        console.log('============================================');

        // Ventas que querían factura electrónica y NO tienen comprobante emitido OK
        const bache = await db.query(`
            SELECT v.id, v.fecha, v.total, v.metodo_pago,
                   ce.id AS comp_id, ce.estado AS comp_estado, ce.numero_comprobante
            FROM ventas v
            LEFT JOIN comprobantes_electronicos ce
                   ON ce.venta_id = v.id AND ce.estado = 'emitido' AND ce.cae IS NOT NULL
            WHERE v.negocio_id = $1
              AND v.tipo_facturacion = 'electronica'
              AND v.fecha >= NOW() - ($2 || ' hours')::interval
              AND ce.id IS NULL
            ORDER BY v.fecha
        `, [negocio_id, String(horas)]);

        if (!bache.rows.length) {
            console.log('✅ Sin bache: todas las ventas electrónicas de la ventana tienen su CAE.');
        } else {
            console.log(`⚠️ ${bache.rows.length} venta(s) SIN factura válida (a re-emitir):\n`);
            let totalBache = 0;
            for (const r of bache.rows) {
                totalBache += parseFloat(r.total);
                console.log(`  venta #${r.id} · ${new Date(r.fecha).toLocaleString('es-AR')} · $${r.total} · ${r.metodo_pago}`);
            }
            console.log(`\n  Total del bache: $${totalBache.toFixed(2)}`);
            console.log('\n  → Re-emití estas facturas desde Configuración → Facturación, o avisá para automatizarlo.');
        }
        console.log('============================================');
        console.log('Solo lectura: no se emitió ni modificó nada.');
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        process.exit(0);
    }
})();
