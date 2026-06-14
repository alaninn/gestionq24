// Diagnóstico SOLO LECTURA de la configuración ARCA local.
// No toca AFIP ni emite nada: solo lista negocios con certificado activo.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../config/database');

(async () => {
    try {
        const r = await db.query(`
            SELECT c.negocio_id, n.nombre AS negocio, c.cuit, c.punto_venta, c.regimen_fiscal,
                   c.modo, c.activo, cfg.entorno_arca,
                   (SELECT COUNT(*) FROM comprobantes_electronicos ce WHERE ce.negocio_id = c.negocio_id AND ce.estado='emitido') AS emitidos
            FROM certificados_arca c
            LEFT JOIN negocios n ON n.id = c.negocio_id
            LEFT JOIN configuracion cfg ON cfg.negocio_id = c.negocio_id
            WHERE c.activo = true
            ORDER BY c.negocio_id
        `);
        if (!r.rows.length) {
            console.log('No hay certificados ARCA activos en esta base.');
        } else {
            console.log('Negocios con certificado ARCA activo:');
            for (const x of r.rows) {
                console.log(`- negocio_id=${x.negocio_id} (${x.negocio}) | CUIT=${x.cuit} | ptoVta=${x.punto_venta} | regimen=${x.regimen_fiscal} | modo=${x.modo} | entorno=${x.entorno_arca || '(sin config)'} | comprobantes_emitidos=${x.emitidos}`);
            }
        }
    } catch (e) {
        console.error('ERROR de diagnóstico:', e.message);
    } finally {
        process.exit(0);
    }
})();
