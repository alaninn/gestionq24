// =============================================
// VER COMPROBANTES REALES EN AFIP (solo lectura, sin login, sin emitir).
// Consulta al web service oficial (FECompConsultar) los datos que AFIP tiene
// registrados de tus últimas facturas: importes, IVA, CAE, fecha, resultado.
//
// Uso en el VPS:
//   cd /root/gestionq24/backend
//   node scripts/ver-comprobantes-arca.js [negocio_id] [tipo_comprobante] [cantidad]
//   (tipo: 6=Factura B, 1=Factura A, 11=Factura C; cantidad: cuántas ver, def. 3)
//
// Reusa el ticket WSAA cacheado → no interfiere con la facturación viva.
// =============================================
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const xml2js = require('xml2js');
const https = require('https');
const crypto = require('crypto');
const db = require('../config/database');
const wsaaService = require('../services/wsaaService');

const httpsAgent = new https.Agent({
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    ciphers: 'DEFAULT:@SECLEVEL=0',
});

function soap(body) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`;
}

async function post(wsfeUrl, action, xml) {
    const resp = await axios.post(wsfeUrl, xml, {
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': `http://ar.gov.afip.dif.FEV1/${action}` },
        timeout: 30000, httpsAgent,
    });
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
    const r = await parser.parseStringPromise(resp.data);
    const env = r['soap:Envelope'] || r['soapenv:Envelope'];
    return env['soap:Body'] || env['soapenv:Body'];
}

(async () => {
    try {
        const negocio_id = parseInt(process.argv[2] || '1');
        const tipo = parseInt(process.argv[3] || '6');
        const cantidad = parseInt(process.argv[4] || '3');

        const cfg = await db.query('SELECT entorno_arca FROM configuracion WHERE negocio_id = $1', [negocio_id]);
        const cert = await db.query('SELECT cuit, punto_venta FROM certificados_arca WHERE negocio_id = $1 AND activo = true LIMIT 1', [negocio_id]);
        if (!cert.rows.length) { console.log(`❌ Sin certificado activo para negocio_id=${negocio_id}`); process.exit(0); }

        const entorno = cfg.rows[0]?.entorno_arca || 'homologacion';
        const cuit = String(cert.rows[0].cuit).replace(/[-\s]/g, '');
        const ptoVta = parseInt(cert.rows[0].punto_venta);
        const wsfeUrl = entorno === 'produccion'
            ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
            : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';

        console.log(`\nCUIT ${cuit} | entorno ${entorno} | PtoVta ${ptoVta} | Tipo ${tipo}\n`);

        const ticket = await wsaaService.obtenerTicketAcceso(negocio_id);
        const auth = `<ar:Auth><ar:Token>${ticket.token}</ar:Token><ar:Sign>${ticket.sign}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>`;

        // Último número autorizado
        const bodyU = await post(wsfeUrl, 'FECompUltimoAutorizado',
            soap(`<ar:FECompUltimoAutorizado>${auth}<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${tipo}</ar:CbteTipo></ar:FECompUltimoAutorizado>`));
        const ult = bodyU['FECompUltimoAutorizadoResponse']?.FECompUltimoAutorizadoResult || bodyU['ns1:FECompUltimoAutorizadoResponse']?.FECompUltimoAutorizadoResult;
        const ultimoNro = parseInt(ult?.CbteNro || '0');
        if (!ultimoNro) { console.log('No hay comprobantes de este tipo.'); process.exit(0); }

        const desde = Math.max(1, ultimoNro - cantidad + 1);
        for (let nro = ultimoNro; nro >= desde; nro--) {
            const body = await post(wsfeUrl, 'FECompConsultar',
                soap(`<ar:FECompConsultar>${auth}<ar:FeCompConsReq><ar:CbteTipo>${tipo}</ar:CbteTipo><ar:CbteNro>${nro}</ar:CbteNro><ar:PtoVta>${ptoVta}</ar:PtoVta></ar:FeCompConsReq></ar:FECompConsultar>`));
            const g = (body['FECompConsultarResponse']?.FECompConsultarResult || body['ns1:FECompConsultarResponse']?.FECompConsultarResult)?.ResultGet;
            if (!g) { console.log(`#${nro}: (sin datos)`); continue; }
            const iva = g.Iva?.AlicIva;
            const ivaTxt = iva ? (Array.isArray(iva) ? iva : [iva]).map(a => `Id${a.Id} base ${a.BaseImp} IVA ${a.Importe}`).join(' · ') : '(sin IVA)';
            console.log('============================================');
            console.log(`Comprobante Nº ${g.CbteDesde}  (PtoVta ${g.PtoVta}, Tipo ${g.CbteTipo})`);
            console.log(`  Fecha (CbteFch) : ${g.CbteFch}`);
            console.log(`  Importe total   : $${g.ImpTotal}   | Neto: $${g.ImpNeto} | IVA: $${g.ImpIVA}`);
            console.log(`  IVA detalle     : ${ivaTxt}`);
            console.log(`  Receptor        : DocTipo ${g.DocTipo} / DocNro ${g.DocNro}`);
            console.log(`  CAE             : ${g.CodAutorizacion}  (vto ${g.FchVto})`);
            console.log(`  Resultado AFIP  : ${g.Resultado}  ${g.Resultado === 'A' ? '✅ Aprobado' : '⚠️'}`);
        }
        console.log('============================================');
        console.log('\nDatos traídos directamente de AFIP. Solo lectura, no se emitió ni modificó nada.');
    } catch (e) {
        console.error('ERROR:', e.response?.data || e.message);
    } finally {
        process.exit(0);
    }
})();
