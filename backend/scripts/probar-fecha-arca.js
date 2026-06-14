// =============================================
// PRUEBA SOLO LECTURA del fix de fecha de ARCA (no emite nada, no consume números).
// Valida, contra el AFIP REAL del entorno configurado:
//   1) La fecha de hoy en hora de Argentina (CbteFch) vs la vieja en UTC.
//   2) El último comprobante autorizado y SU fecha (FECompConsultar).
//   3) Qué fecha usaría una factura nueva hoy (regla: nunca anterior al último).
//
// Uso en el VPS:
//   cd /root/gestionq24/backend
//   node scripts/probar-fecha-arca.js [negocio_id] [tipo_comprobante]
//   (tipo: 6=Factura B, 11=Factura C; por defecto 11)
//
// Reusa el ticket WSAA cacheado, así que NO genera conflicto con la facturación viva.
// =============================================
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const xml2js = require('xml2js');
const https = require('https');
const crypto = require('crypto');
const db = require('../config/database');
const wsaaService = require('../services/wsaaService');
const arcaService = require('../services/arcaService');

const httpsAgent = new https.Agent({
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    ciphers: 'DEFAULT:@SECLEVEL=0',
});

async function ultimoAutorizado({ wsfeUrl, token, sign, cuit, ptoVta, tipo }) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/>
    <soapenv:Body>
        <ar:FECompUltimoAutorizado>
            <ar:Auth><ar:Token>${token}</ar:Token><ar:Sign>${sign}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>
            <ar:PtoVta>${ptoVta}</ar:PtoVta>
            <ar:CbteTipo>${tipo}</ar:CbteTipo>
        </ar:FECompUltimoAutorizado>
    </soapenv:Body>
</soapenv:Envelope>`;
    const resp = await axios.post(wsfeUrl, xml, {
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado' },
        timeout: 30000, httpsAgent,
    });
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
    const r = await parser.parseStringPromise(resp.data);
    const env = r['soap:Envelope'] || r['soapenv:Envelope'];
    const body = env['soap:Body'] || env['soapenv:Body'];
    const res = body['FECompUltimoAutorizadoResponse']?.FECompUltimoAutorizadoResult
        || body['ns1:FECompUltimoAutorizadoResponse']?.FECompUltimoAutorizadoResult;
    return parseInt(res?.CbteNro || '0');
}

(async () => {
    try {
        const negocio_id = parseInt(process.argv[2] || '1');
        const tipo = parseInt(process.argv[3] || '11');

        const cfg = await db.query('SELECT entorno_arca FROM configuracion WHERE negocio_id = $1', [negocio_id]);
        const cert = await db.query('SELECT cuit, punto_venta FROM certificados_arca WHERE negocio_id = $1 AND activo = true LIMIT 1', [negocio_id]);
        if (!cert.rows.length) { console.log(`❌ No hay certificado ARCA activo para negocio_id=${negocio_id}`); process.exit(0); }

        const entorno = cfg.rows[0]?.entorno_arca || 'homologacion';
        const cuit = String(cert.rows[0].cuit).replace(/[-\s]/g, '');
        const ptoVta = parseInt(cert.rows[0].punto_venta);
        const wsfeUrl = entorno === 'produccion'
            ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
            : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';

        console.log('============================================');
        console.log(`Negocio_id : ${negocio_id}`);
        console.log(`CUIT       : ${cuit}`);
        console.log(`Entorno    : ${entorno}`);
        console.log(`Punto vta  : ${ptoVta}  |  Tipo comprobante: ${tipo}`);
        console.log('============================================');

        const hoyAR = arcaService.fechaArgYYYYMMDD();
        const hoyUTC = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        console.log(`Fecha hoy (hora Argentina, NUEVA): ${hoyAR}`);
        console.log(`Fecha hoy (UTC, esquema VIEJO)   : ${hoyUTC}  ${hoyUTC !== hoyAR ? '⬅️ DIFERENTE (estamos en la franja nocturna)' : '(igual hoy)'}`);

        console.log('\n→ Pidiendo ticket WSAA (reusa el cacheado si está vigente)...');
        const ticket = await wsaaService.obtenerTicketAcceso(negocio_id);
        if (!ticket?.token) { console.log('❌ No se pudo obtener ticket WSAA.'); process.exit(0); }

        console.log('→ Consultando último comprobante autorizado en AFIP...');
        const ultimoNro = await ultimoAutorizado({ wsfeUrl, token: ticket.token, sign: ticket.sign, cuit, ptoVta, tipo });
        console.log(`   Último Nº autorizado: ${ultimoNro}`);

        let ultimaFch = null;
        if (ultimoNro > 0) {
            ultimaFch = await arcaService.consultarFechaComprobante({
                wsfeUrl, token: ticket.token, sign: ticket.sign, cuit,
                puntoVenta: ptoVta, tipoComprobante: tipo, cbteNro: ultimoNro,
            });
            console.log(`   Fecha del último (CbteFch): ${ultimaFch}`);
        } else {
            console.log('   (No hay comprobantes previos para este PtoVta/Tipo)');
        }

        const resultante = (ultimaFch && /^\d{8}$/.test(ultimaFch) && ultimaFch > hoyAR) ? ultimaFch : hoyAR;
        console.log('\n--------------------------------------------');
        console.log(`✅ CbteFch que usaría una factura NUEVA hoy: ${resultante}`);
        if (ultimaFch && resultante !== hoyAR) {
            console.log(`   (se ajustó a la fecha del último autorizado para no violar la regla de AFIP)`);
        }
        const ok = !ultimaFch || resultante >= ultimaFch;
        console.log(`   ¿Respeta "fecha >= último autorizado"? ${ok ? 'SÍ ✅ (no habrá error 10016)' : 'NO ❌'}`);
        console.log('--------------------------------------------');
        console.log('\nNota: esta prueba es SOLO LECTURA. No se emitió ningún comprobante.');
    } catch (e) {
        console.error('ERROR en la prueba:', e.response?.data || e.message);
    } finally {
        process.exit(0);
    }
})();
