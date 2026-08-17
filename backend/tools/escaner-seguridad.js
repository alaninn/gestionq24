#!/usr/bin/env node
/* =============================================================================
 * ESCÁNER DE SEGURIDAD (CLI) — auto-auditoría de sistemas PROPIOS
 *
 *   USO:
 *     cd backend
 *     node tools/escaner-seguridad.js http://localhost:3001
 *     node tools/escaner-seguridad.js http://localhost:4000    (otro sistema tuyo)
 *
 *   Genera un informe en pantalla y lo guarda en tools/informe-seguridad-<fecha>.md
 *
 * ⚠️  Usalo SOLO contra sistemas que sean TUYOS o para los que tengas permiso.
 *     El mismo motor lo usa el botón "Pruebas de seguridad" del panel Superadmin.
 * ============================================================================= */

const { escanear } = require('../services/escanerSeguridad');

const TARGET = process.argv[2] || 'http://localhost:3001';
const emoji = { CRITICA: '🟥', ALTA: '🟧', MEDIA: '🟨', BAJA: '🟦', INFO: '⬜', OK: '🟩' };
const orden = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFO', 'OK'];

(async () => {
    console.log(`\n🔎 Escaneando ${TARGET} ...`);
    console.log('   (pruebas no destructivas — usá esto solo en sistemas propios)\n');
    let res;
    try {
        res = await escanear(TARGET);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }

    let out = `# Informe de seguridad — ${res.objetivo}\n\nFecha: ${new Date(res.fecha).toLocaleString('es-AR')}\n\n`;
    out += 'Resumen: ' + orden.filter(s => res.resumen[s]).map(s => `${emoji[s]} ${s}: ${res.resumen[s]}`).join('  ·  ') + '\n\n';
    if (res.hallazgos.every(h => h.sev === 'OK')) out += '✅ No se detectaron vulnerabilidades en las pruebas realizadas.\n\n';
    for (const h of res.hallazgos) {
        out += `## ${emoji[h.sev]} [${h.sev}] ${h.titulo}\n`;
        if (h.detalle) out += `${h.detalle}\n`;
        if (h.recomendacion) out += `**Recomendación:** ${h.recomendacion}\n`;
        out += '\n';
    }

    console.log('\n' + out);
    try {
        const fs = require('fs'); const path = require('path');
        const nombre = `informe-seguridad-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
        const dest = path.join(__dirname, nombre);
        fs.writeFileSync(dest, out);
        console.log(`📄 Informe guardado en: ${dest}\n`);
    } catch (e) { /* con la salida en pantalla alcanza */ }
    process.exit(0);
})();
