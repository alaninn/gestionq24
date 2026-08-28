// =============================================
// SERVICIO: Padrón AFIP (constancia de inscripción)
// Trae el régimen (monotributo / responsable inscripto) y, si es monotributo,
// la categoría (A-K) directo de ARCA. Best-effort: ante CUALQUIER problema
// (servicio no autorizado, red, parseo) devuelve null y el llamador usa el
// respaldo configurado en el sistema. Nunca lanza.
// =============================================

const axios = require('axios');
const xml2js = require('xml2js');
const db = require('../config/database');
const wsaaService = require('./wsaaService');

const PADRON_URLS = {
    homologacion: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5',
    produccion: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5',
};
const SERVICIO = 'ws_sr_padron_a5';

const limpiarCuit = (c) => String(c || '').replace(/[^0-9]/g, '');
function extraerLetra(txt) {
    if (!txt) return null;
    const m = String(txt).match(/\b([A-K])\b/);
    return m ? m[1] : null;
}

// Cache en memoria (12 hs) para no pegarle a AFIP en cada request.
const cache = new Map();
const TTL_MS = 12 * 60 * 60 * 1000;

async function consultarConstancia(negocioId) {
    const cached = cache.get(negocioId);
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

    let data = null;
    try {
        const cfg = await db.query('SELECT cuit, entorno_arca FROM configuracion WHERE negocio_id = $1', [negocioId]);
        const cuitNegocio = limpiarCuit(cfg.rows[0]?.cuit);
        if (cuitNegocio) {
            const entorno = cfg.rows[0]?.entorno_arca === 'produccion' ? 'produccion' : 'homologacion';
            const delegado = wsaaService.obtenerCertDelegado ? wsaaService.obtenerCertDelegado() : { disponible: false };
            const cuitRepresentada = delegado?.disponible ? limpiarCuit(delegado.cuit) : cuitNegocio;

            const ticket = await wsaaService.obtenerTicketAcceso(negocioId, SERVICIO);
            if (ticket?.token) {
                const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="http://a5.soap.ws.server.puc.sr/">
  <soapenv:Header/>
  <soapenv:Body>
    <a5:getPersona>
      <token>${ticket.token}</token>
      <sign>${ticket.sign}</sign>
      <cuitRepresentada>${cuitRepresentada}</cuitRepresentada>
      <idPersona>${cuitNegocio}</idPersona>
    </a5:getPersona>
  </soapenv:Body>
</soapenv:Envelope>`;
                const resp = await axios.post(PADRON_URLS[entorno], soap, {
                    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
                    timeout: 15000,
                });
                const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true, tagNameProcessors: [xml2js.processors.stripPrefix] });
                const parsed = await parser.parseStringPromise(resp.data);
                const body = parsed?.Envelope?.Body || parsed?.Body;
                const ret = body?.getPersonaResponse?.personaReturn || body?.personaReturn;
                const persona = ret?.persona || ret;
                if (persona) {
                    if (persona.datosMonotributo) {
                        const cat = persona.datosMonotributo.categoriaMonotributo?.descripcionCategoria
                            || persona.datosMonotributo.categoriaMonotributo?.idCategoria || null;
                        data = { regimen: 'monotributista', categoria_monotributo: extraerLetra(cat), fuente: 'arca' };
                    } else if (persona.datosRegimenGeneral) {
                        data = { regimen: 'responsable_inscripto', categoria_monotributo: null, fuente: 'arca' };
                    }
                }
            }
        }
    } catch (e) {
        data = null; // fail-soft
    }

    cache.set(negocioId, { data, ts: Date.now() });
    // Si ARCA trajo la categoría, la guardamos como respaldo para futuras consultas.
    if (data) {
        db.query('UPDATE configuracion SET regimen_fiscal = COALESCE($2, regimen_fiscal), categoria_monotributo = COALESCE($3, categoria_monotributo) WHERE negocio_id = $1',
            [negocioId, data.regimen, data.categoria_monotributo]).catch(() => {});
    }
    return data;
}

// Devuelve SOLO lo cacheado (sin pegarle a ARCA). Para usar en el camino rápido
// (resumen) sin bloquear con la consulta lenta al WSAA.
function constanciaCacheada(negocioId) {
    const c = cache.get(negocioId);
    return c ? c.data : null;
}

module.exports = { consultarConstancia, constanciaCacheada };
