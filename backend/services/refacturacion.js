// =============================================
// ARCHIVO: services/refacturacion.js
// Reintenta las facturaciones que quedaron en error (por ejemplo, cuando AFIP
// se cae o entra en mantenimiento). La venta ya se hizo (queda como Factura X);
// esto vuelve a pedir el CAE cuando AFIP está disponible.
//
// Seguridad fiscal:
//  - Solo toca ventas que TUVIERON un intento fallido (comprobante en 'error')
//    y que siguen SIN CAE (no re-factura algo ya facturado -> no duplica).
//  - AFIP asigna el número al emitir, así que reintentar toma el próximo libre.
//  - Antes de reintentar en lote chequea que el WSFEv1 responda, para no
//    golpear en vano durante una caída.
// =============================================

const db = require('../config/database');
const axios = require('axios');
const arcaService = require('./arcaService');

let enProceso = false;

// Solo se reintentan facturaciones fallidas RECIENTES. Motivos:
//  - AFIP factura con la fecha del día (CbteFch): una venta muy vieja saldría con
//    fecha de hoy, lo cual no corresponde. Concepto 1 (bienes) además solo admite
//    fechas dentro de ±5 días.
//  - Fallas viejas por datos inválidos (CUIT, etc.) nunca van a salir: no tiene
//    sentido reintentarlas para siempre.
// 7 días cubre de sobra una caída/mantenimiento de AFIP (horas).
const DIAS_VENTANA = 7;

function urlWsfe(entorno) {
    return entorno === 'produccion'
        ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
        : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';
}

// Chequeo liviano de disponibilidad del WSFEv1 (sin WSAA): un GET al endpoint.
// 2xx/3xx/4xx = el servidor de AFIP responde. 5xx o sin respuesta = caído.
async function afipDisponible(entorno) {
    try {
        const r = await axios.get(`${urlWsfe(entorno)}?op=FEDummy`, {
            timeout: 15000,
            validateStatus: () => true,
        });
        return r.status >= 200 && r.status < 500;
    } catch (e) {
        return false;
    }
}

// Ventas de un negocio con facturación fallida que siguen SIN CAE. Toma el
// último comprobante 'error' por venta (trae los datos para reenviar).
async function listarPendientes(negocioId) {
    const r = await db.query(`
        SELECT DISTINCT ON (e.venta_id)
            e.id, e.venta_id, e.negocio_id, e.tipo_comprobante, e.punto_venta,
            e.tipo_documento, e.numero_documento, e.denominacion_comprador,
            e.importe_total, e.importe_neto, e.importe_iva, e.created_at
        FROM comprobantes_electronicos e
        WHERE e.negocio_id = $1
          AND e.estado = 'error'
          AND e.venta_id IS NOT NULL
          AND e.created_at > NOW() - ($2 || ' days')::interval
          AND NOT EXISTS (
              SELECT 1 FROM comprobantes_electronicos o
              WHERE o.venta_id = e.venta_id AND o.cae IS NOT NULL
          )
        ORDER BY e.venta_id, e.created_at DESC
    `, [negocioId, DIAS_VENTANA]);
    return r.rows;
}

// Negocios que tienen pendientes (para el job global).
async function negociosConPendientes() {
    const r = await db.query(`
        SELECT DISTINCT e.negocio_id
        FROM comprobantes_electronicos e
        WHERE e.estado = 'error' AND e.venta_id IS NOT NULL
          AND e.created_at > NOW() - ($1 || ' days')::interval
          AND NOT EXISTS (
              SELECT 1 FROM comprobantes_electronicos o
              WHERE o.venta_id = e.venta_id AND o.cae IS NOT NULL
          )
    `, [DIAS_VENTANA]);
    return r.rows.map(x => x.negocio_id);
}

async function entornoNegocio(negocioId) {
    const c = await db.query('SELECT entorno_arca FROM configuracion WHERE negocio_id = $1', [negocioId]);
    return c.rows[0]?.entorno_arca || 'homologacion';
}

// Reintenta las pendientes de UN negocio.
// Devuelve { intentadas, exitosas, fallidas, afipCaido, pendientes }.
async function reintentarNegocio(negocioId) {
    const pendientes = await listarPendientes(negocioId);
    if (pendientes.length === 0) {
        return { intentadas: 0, exitosas: 0, fallidas: 0, afipCaido: false, pendientes: 0 };
    }

    // NO usamos un pre-chequeo de disponibilidad de AFIP: un GET al WSDL puede
    // fallar (TLS/handshake) aunque el POST real de facturación ande perfecto, y
    // eso bloqueaba el reintento con un falso "AFIP caído". En su lugar, detectamos
    // que AFIP está caído por el resultado real del primer intento: si el primero
    // falla por infraestructura, cortamos el lote; si AFIP responde, seguimos.
    let exitosas = 0, fallidas = 0, afipCaido = false;
    for (const p of pendientes) {
        let r;
        try {
            r = await arcaService.emitirComprobante({
                negocio_id: negocioId,
                venta_id: p.venta_id,
                tipo_comprobante: p.tipo_comprobante,
                punto_venta: p.punto_venta,
                tipo_documento: p.tipo_documento,
                numero_documento: p.numero_documento,
                denominacion_comprador: p.denominacion_comprador,
                importe_total: p.importe_total,
                importe_neto: p.importe_neto,
                importe_iva: p.importe_iva,
                noGuardarError: true, // no acumular filas de error en cada reintento
            });
        } catch (e) {
            // Excepción no controlada = AFIP/infra: cortamos el lote.
            fallidas++; afipCaido = true; break;
        }
        if (r && r.exito) {
            exitosas++;
            // Marcar todos los intentos fallidos de esa venta como reintentados,
            // así no vuelven a contarse como pendientes ni ensucian el conteo.
            await db.query(
                "UPDATE comprobantes_electronicos SET estado = 'reintentado' WHERE venta_id = $1 AND estado = 'error'",
                [p.venta_id]
            ).catch(() => {});
        } else {
            fallidas++;
            // Si el motivo es que AFIP está caído (infraestructura), cortamos el
            // lote para no seguir golpeando. Si fue un rechazo por DATOS de este
            // comprobante puntual, seguimos con los demás (no se traba el resto).
            const msg = (r && r.error) || '';
            if (/AFIP no está disponible|no responde|mantenimiento/i.test(msg)) { afipCaido = true; break; }
        }
    }
    return { intentadas: pendientes.length, exitosas, fallidas, afipCaido, pendientes: pendientes.length - exitosas };
}

// Job global: recorre los negocios con pendientes y reintenta. No corre en
// paralelo consigo mismo.
async function reintentarTodos() {
    if (enProceso) return;
    enProceso = true;
    try {
        const negocios = await negociosConPendientes();
        if (negocios.length) {
            console.log(`🔁 Reintento de facturación: ${negocios.length} negocio(s) con pendientes`);
        }
        for (const n of negocios) {
            try {
                const res = await reintentarNegocio(n);
                if (res.exitosas > 0) {
                    console.log(`✅ Reintento facturación negocio ${n}: ${res.exitosas} emitida(s), ${res.pendientes} pendiente(s)`);
                }
            } catch (e) {
                console.error(`Error reintentando facturación del negocio ${n}:`, e.message);
            }
        }
    } catch (e) {
        console.error('Error en reintento global de facturación:', e.message);
    } finally {
        enProceso = false;
    }
}

module.exports = { listarPendientes, reintentarNegocio, reintentarTodos, afipDisponible };
