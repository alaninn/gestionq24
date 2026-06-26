// =============================================
// SERVICIO: Facturación Electrónica ARCA
// Maneja autenticación, generación de certificados y emisión de comprobantes
// =============================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');
const axios = require('axios');
const xml2js = require('xml2js');
const https = require('https');

// AFIP usa claves DH antiguas, hay que permitirlas
const httpsAgent = new https.Agent({
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    ciphers: 'DEFAULT:@SECLEVEL=0'
});
const db = require('../config/database');
const wsaaService = require('./wsaaService');

// Crear directorio para certificados si no existe
const CERT_DIR = path.join(__dirname, '../uploads/certificados');
if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
}

// =============================================
// FECHAS PARA AFIP (CbteFch)
// AFIP valida el rango de fechas (Concepto 1: N±5 días) contra SU reloj, que está
// en horario de Argentina. Por eso la fecha del comprobante se calcula en hora AR y
// NO en UTC: de noche (21:00–23:59 AR) UTC ya es el día siguiente, y la factura
// saldría con la fecha equivocada (un día adelantada).
// =============================================
function fechaArgYYYYMMDD(d = new Date()) {
    const p = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d).reduce((acc, x) => { acc[x.type] = x.value; return acc; }, {});
    return `${p.year}${p.month}${p.day}`;
}

// Consulta a AFIP la fecha (CbteFch, YYYYMMDD) de un comprobante YA autorizado.
// Sirve para no emitir una factura con fecha anterior a la del último autorizado:
// la regla de AFIP es CbteFch >= fecha del último comprobante de ese PtoVta/CbteTipo;
// si es menor, AFIP rechaza con el error 10016 y se traba la facturación.
async function consultarFechaComprobante({ wsfeUrl, token, sign, cuit, puntoVenta, tipoComprobante, cbteNro }) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/>
    <soapenv:Body>
        <ar:FECompConsultar>
            <ar:Auth>
                <ar:Token>${token}</ar:Token>
                <ar:Sign>${sign}</ar:Sign>
                <ar:Cuit>${cuit}</ar:Cuit>
            </ar:Auth>
            <ar:FeCompConsReq>
                <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
                <ar:CbteNro>${cbteNro}</ar:CbteNro>
                <ar:PtoVta>${puntoVenta}</ar:PtoVta>
            </ar:FeCompConsReq>
        </ar:FECompConsultar>
    </soapenv:Body>
</soapenv:Envelope>`;
    const resp = await axios.post(wsfeUrl, xml, {
        headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompConsultar' },
        timeout: 30000,
        httpsAgent,
    });
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
    const r = await parser.parseStringPromise(resp.data);
    const env = r['soap:Envelope'] || r['soapenv:Envelope'];
    const body = env['soap:Body'] || env['soapenv:Body'];
    const result = body['FECompConsultarResponse']?.FECompConsultarResult
        || body['ns1:FECompConsultarResponse']?.FECompConsultarResult;
    return result?.ResultGet?.CbteFch || null;
}

/**
 * Genera un par de claves RSA y un CSR (Certificate Signing Request)
 * @param {string} cuit - CUIT del negocio
 * @param {string} razonSocial - Razón social del negocio
 * @returns {Object} - { keyPem, csrPem, keyPath, csrPath }
 */
function generarCertificados(cuit, razonSocial) {
    try {
        // Generar clave privada RSA 2048 bits
        const keys = forge.pki.rsa.generateKeyPair(2048);
        
        // Crear CSR
        const csr = forge.pki.createCertificationRequest();
        csr.publicKey = keys.publicKey;
        
        // Agregar atributos al CSR
        csr.setSubject([{
            name: 'commonName',
            value: razonSocial || 'Usuario ARCA'
        }, {
            name: 'serialNumber',
            value: `CUIT ${cuit}`
        }]);
        
        // Firmar CSR con la clave privada
        csr.sign(keys.privateKey);
        
        // Convertir a PEM
        const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
        const csrPem = forge.pki.certificationRequestToPem(csr);
        
        // Generar nombres únicos de archivos
        const timestamp = Date.now();
        const keyFileName = `key_${cuit}_${timestamp}.key`;
        const csrFileName = `csr_${cuit}_${timestamp}.csr`;
        
        const keyPath = path.join(CERT_DIR, keyFileName);
        const csrPath = path.join(CERT_DIR, csrFileName);
        
        // Guardar archivos
        fs.writeFileSync(keyPath, keyPem);
        fs.writeFileSync(csrPath, csrPem);
        
        console.log(`✅ Certificados generados para CUIT: ${cuit}`);
        
        return {
            keyPem,
            csrPem,
            keyPath: `certificados/${keyFileName}`,
            csrPath: `certificados/${csrFileName}`
        };
    } catch (error) {
        console.error('❌ Error generando certificados:', error);
        throw new Error('Error al generar certificados: ' + error.message);
    }
}

/**
 * Guarda un certificado (.crt) recibido de ARCA
 * @param {Buffer} certBuffer - Contenido del certificado
 * @param {string} cuit - CUIT del negocio
 * @returns {string} - Ruta del certificado guardado
 */
function guardarCertificado(certBuffer, cuit) {
    try {
        const timestamp = Date.now();
        const certFileName = `cert_${cuit}_${timestamp}.crt`;
        const certPath = path.join(CERT_DIR, certFileName);
        
        fs.writeFileSync(certPath, certBuffer);
        
        console.log(`✅ Certificado guardado: ${certFileName}`);
        
        return `certificados/${certFileName}`;
    } catch (error) {
        console.error('❌ Error guardando certificado:', error);
        throw new Error('Error al guardar certificado: ' + error.message);
    }
}

/**
 * Verifica si un certificado es válido y no está vencido
 * @param {string} certPath - Ruta del certificado
 * @returns {Object} - { valido, fechaVencimiento, diasRestantes }
 */
function verificarCertificado(certPath) {
    try {
        const fullPath = path.join(__dirname, '../uploads', certPath);
        
        if (!fs.existsSync(fullPath)) {
            return { valido: false, error: 'Certificado no encontrado' };
        }
        
        const certPem = fs.readFileSync(fullPath, 'utf8');
        const cert = forge.pki.certificateFromPem(certPem);
        
        const ahora = new Date();
        const vencimiento = cert.validity.notAfter;
        const diasRestantes = Math.floor((vencimiento - ahora) / (1000 * 60 * 60 * 24));
        
        return {
            valido: vencimiento > ahora,
            fechaVencimiento: vencimiento,
            diasRestantes: diasRestantes,
            subject: cert.subject.attributes.map(a => `${a.name}=${a.value}`).join(', ')
        };
    } catch (error) {
        console.error('❌ Error verificando certificado:', error);
        return { valido: false, error: error.message };
    }
}

/**
 * Obtiene los tipos de comprobante según el régimen fiscal
 * @param {string} regimenFiscal - 'responsable_inscripto' o 'monotributista'
 * @returns {Array} - Lista de tipos de comprobante
 */
function obtenerTiposComprobante(regimenFiscal) {
    const tipos = {
        // Factura B primero: es la habitual (consumidor final). La A es solo
        // para ventas a otros Responsables Inscriptos y se elige a mano.
        responsable_inscripto: [
            { codigo: 6, nombre: 'Factura B', descripcion: 'Para consumidores finales', emoji: '📄' },
            { codigo: 1, nombre: 'Factura A', descripcion: 'Para Responsables Inscriptos', emoji: '📄' },
            { codigo: 8, nombre: 'Nota de Crédito B', descripcion: 'Devolución Factura B', emoji: '📝' },
            { codigo: 3, nombre: 'Nota de Crédito A', descripcion: 'Devolución Factura A', emoji: '📝' },
            { codigo: 7, nombre: 'Nota de Débito B', descripcion: 'Ajuste Factura B', emoji: '📋' },
            { codigo: 2, nombre: 'Nota de Débito A', descripcion: 'Ajuste Factura A', emoji: '📋' },
        ],
        monotributista: [
            { codigo: 11, nombre: 'Factura C', descripcion: 'Para Monotributistas', emoji: '📄' },
            { codigo: 13, nombre: 'Nota de Crédito C', descripcion: 'Devolución Factura C', emoji: '📝' },
            { codigo: 12, nombre: 'Nota de Débito C', descripcion: 'Ajuste Factura C', emoji: '📋' },
        ]
    };
    
    return tipos[regimenFiscal] || tipos.responsable_inscripto;
}

/**
 * Obtiene los tipos de documento para facturación
 * @returns {Array} - Lista de tipos de documento
 */
function obtenerTiposDocumento() {
    return [
        { codigo: 80, nombre: 'CUIT', descripcion: 'Código Único de Identificación Tributaria' },
        { codigo: 96, nombre: 'DNI', descripcion: 'Documento Nacional de Identidad' },
        { codigo: 99, nombre: 'Sin Identificar', descripcion: 'Consumidor Final' },
    ];
}

/**
 * Emite un comprobante electrónico real usando WSFEv1
 * @param {Object} datos - Datos del comprobante
 * @returns {Object} - Resultado de la emisión
 */
async function emitirComprobante(datos) {
    const {
        negocio_id,
        venta_id,
        tipo_comprobante,
        punto_venta,
        tipo_documento,
        numero_documento,
        denominacion_comprador,
        importe_total,
        importe_neto,
        importe_iva,
        condicion_iva_receptor
    } = datos;

    // Condición frente al IVA del receptor (RG 5616 — obligatorio en WSFEv1):
    // 1=Resp. Inscripto, 4=Exento, 5=Consumidor Final, 6=Resp. Monotributo,
    // 7=Sujeto No Categorizado, 13=Monotributista Social, 15=IVA No Alcanzado.
    // Si el frontend no la manda, se infiere: comprobantes A → RI;
    // con CUIT → Monotributista; resto → Consumidor Final.
    const tipoCmp = parseInt(tipo_comprobante);
    const docTipo = parseInt(tipo_documento) || 99;
    let condIvaReceptor = parseInt(condicion_iva_receptor) || 0;
    if (!condIvaReceptor) {
        if ([1, 2, 3].includes(tipoCmp)) condIvaReceptor = 1;
        else if (docTipo === 80) condIvaReceptor = 6;
        else condIvaReceptor = 5;
    }
    
    let xmlEnviado = null;
    let xmlRespuesta = null;
    let numeroComprobante = 0;
    
    try {
        // 1. Obtener certificado activo del negocio
        const certResult = await db.query(
            'SELECT * FROM certificados_arca WHERE negocio_id = $1 AND activo = true LIMIT 1',
            [negocio_id]
        );
        
        if (certResult.rows.length === 0) {
            throw new Error('No hay certificado activo configurado');
        }
        
        const certificado = certResult.rows[0];

        // 2. Verificar que el certificado no esté vencido
        if (certificado.modo === 'delegado') {
            // Modo delegado: se verifica el certificado del proveedor (configurado en el servidor)
            const delegado = wsaaService.obtenerCertDelegado();
            if (!delegado.disponible) {
                throw new Error(delegado.error);
            }
            const verifDelegado = verificarCertificado(path.relative(path.join(__dirname, '../uploads'), delegado.certPath));
            if (!verifDelegado.valido) {
                throw new Error('El certificado del proveedor está vencido o no es válido. Contactá a soporte.');
            }
        } else {
            const verificacion = verificarCertificado(certificado.cert_path);
            if (!verificacion.valido) {
                throw new Error('El certificado está vencido o no es válido');
            }
        }
        
        // 3. Obtener ticket de acceso del WSAA
        console.log('🔐 Obteniendo ticket de acceso WSAA...');
        const ticket = await wsaaService.obtenerTicketAcceso(negocio_id, 'wsfe');

        // 4. Obtener configuración del negocio (necesario antes de consultar AFIP)
        const configResult = await db.query(
            'SELECT cuit, entorno_arca FROM configuracion WHERE negocio_id = $1',
            [negocio_id]
        );
        
        const cuitEmisor = configResult.rows[0]?.cuit?.replace(/[-\s]/g, '') || certificado.cuit?.replace(/[-\s]/g, '');
        const entorno = configResult.rows[0]?.entorno_arca || 'homologacion';

        // 5. Obtener último número de comprobante directamente desde AFIP
        const wsfeUrl2 = entorno === 'produccion'
    ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
    : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';

const xmlUltimo = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/>
    <soapenv:Body>
        <ar:FECompUltimoAutorizado>
            <ar:Auth>
                <ar:Token>${ticket.token}</ar:Token>
                <ar:Sign>${ticket.sign}</ar:Sign>
                <ar:Cuit>${cuitEmisor}</ar:Cuit>
            </ar:Auth>
            <ar:PtoVta>${parseInt(punto_venta)}</ar:PtoVta>
            <ar:CbteTipo>${parseInt(tipo_comprobante)}</ar:CbteTipo>
        </ar:FECompUltimoAutorizado>
    </soapenv:Body>
</soapenv:Envelope>`;

const respUltimo = await axios.post(wsfeUrl2, xmlUltimo, {
    headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado'
    },
    timeout: 30000,
    httpsAgent: httpsAgent
});

const parserUltimo = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
const resultadoUltimo = await parserUltimo.parseStringPromise(respUltimo.data);
const envelopeU = resultadoUltimo['soap:Envelope'] || resultadoUltimo['soapenv:Envelope'];
const bodyU = envelopeU['soap:Body'] || envelopeU['soapenv:Body'];
const ultResp = bodyU['FECompUltimoAutorizadoResponse']?.FECompUltimoAutorizadoResult
    || bodyU['ns1:FECompUltimoAutorizadoResponse']?.FECompUltimoAutorizadoResult;

const ultimoNro = parseInt(ultResp?.CbteNro || '0');
numeroComprobante = ultimoNro + 1;
console.log(`📋 Último comprobante AFIP: ${ultimoNro}, próximo: ${numeroComprobante}`);
        
            
        // 6. Calcular importes
        const importeNetoCalculado = parseFloat(importe_neto) || parseFloat(importe_total);
        const importeIvaCalculado = parseFloat(importe_iva) || 0;
        
        // 7. Crear XML para WSFEv1 (CAESolicitar)
        // Fecha del comprobante (CbteFch) en HORA DE ARGENTINA (no UTC).
        let fechaEmision = fechaArgYYYYMMDD();
        // Piso de seguridad: nunca emitir con fecha anterior a la del último comprobante
        // autorizado (regla AFIP; si no, error 10016 y se traba la facturación). Esto cubre
        // la transición desde el esquema viejo en UTC y cualquier desfasaje de reloj.
        if (ultimoNro > 0) {
            try {
                const ultimaFch = await consultarFechaComprobante({
                    wsfeUrl: wsfeUrl2, token: ticket.token, sign: ticket.sign, cuit: cuitEmisor,
                    puntoVenta: parseInt(punto_venta), tipoComprobante: parseInt(tipo_comprobante), cbteNro: ultimoNro,
                });
                if (ultimaFch && /^\d{8}$/.test(ultimaFch) && ultimaFch > fechaEmision) {
                    console.log(`📅 CbteFch ajustada de ${fechaEmision} a ${ultimaFch} (fecha del último autorizado) para respetar la regla de AFIP`);
                    fechaEmision = ultimaFch;
                }
            } catch (e) {
                console.warn('⚠️ No se pudo consultar la fecha del último comprobante; uso la fecha de hoy (AR):', e.message);
            }
        }
        
        xmlEnviado = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/>
    <soapenv:Body>
        <ar:FECAESolicitar>
            <ar:Auth>
                <ar:Token>${ticket.token}</ar:Token>
                <ar:Sign>${ticket.sign}</ar:Sign>
                <ar:Cuit>${cuitEmisor}</ar:Cuit>
            </ar:Auth>
            <ar:FeCAEReq>
                <ar:FeCabReq>
    <ar:CantReg>1</ar:CantReg>
    <ar:PtoVta>${parseInt(punto_venta)}</ar:PtoVta>
    <ar:CbteTipo>${parseInt(tipo_comprobante)}</ar:CbteTipo>
</ar:FeCabReq>
                <ar:FeDetReq>
                    <ar:FECAEDetRequest>
                        <ar:Concepto>1</ar:Concepto>
                        <ar:DocTipo>${docTipo}</ar:DocTipo>
                        <ar:DocNro>${docTipo === 99 ? 0 : (String(numero_documento || '').replace(/[-\s.]/g, '') || 0)}</ar:DocNro>
                        <ar:CbteDesde>${numeroComprobante}</ar:CbteDesde>
                        <ar:CbteHasta>${numeroComprobante}</ar:CbteHasta>
                        <ar:CbteFch>${fechaEmision}</ar:CbteFch>
                        <ar:ImpTotal>${parseFloat(importe_total).toFixed(2)}</ar:ImpTotal>
                        <ar:ImpTotConc>0.00</ar:ImpTotConc>
                        <ar:ImpNeto>${importeNetoCalculado.toFixed(2)}</ar:ImpNeto>
                        <ar:ImpOpEx>0.00</ar:ImpOpEx>
                        <ar:ImpIVA>${importeIvaCalculado.toFixed(2)}</ar:ImpIVA>
                        <ar:ImpTrib>0.00</ar:ImpTrib>
                        <ar:FchServDesde></ar:FchServDesde>
                        <ar:FchServHasta></ar:FchServHasta>
                        <ar:FchVtoPago></ar:FchVtoPago>
                        <ar:MonId>PES</ar:MonId>
                        <ar:MonCotiz>1.000</ar:MonCotiz>
                        <ar:CondicionIVAReceptorId>${condIvaReceptor}</ar:CondicionIVAReceptorId>
                        ${importeIvaCalculado > 0 ? `
                        <ar:Iva>
                            <ar:AlicIva>
                                <ar:Id>5</ar:Id>
                                <ar:BaseImp>${importeNetoCalculado.toFixed(2)}</ar:BaseImp>
                                <ar:Importe>${importeIvaCalculado.toFixed(2)}</ar:Importe>
                            </ar:AlicIva>
                        </ar:Iva>` : ''}
                    </ar:FECAEDetRequest>
                </ar:FeDetReq>
            </ar:FeCAEReq>
        </ar:FECAESolicitar>
    </soapenv:Body>
</soapenv:Envelope>`;
        
        // 8. Determinar URL del WSFEv1 según entorno
        const wsfeUrl = entorno === 'produccion'
            ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
            : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';
        
        console.log(`📄 Enviando comprobante a WSFEv1 (${entorno})...`);
        
        // 9. Enviar solicitud al WSFEv1
        let response;
        try {
            response = await axios.post(wsfeUrl, xmlEnviado, {
    headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECAESolicitar'
    },
    timeout: 60000,
    httpsAgent: httpsAgent
});
            xmlRespuesta = response.data;
        } catch (axiosError) {
            throw new Error(`Error de conexión con WSFEv1: ${axiosError.message}`);
        }
        
        // 10. Parsear respuesta XML
        const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
        const resultado = await parser.parseStringPromise(response.data);
        
        // Extraer resultado de la operación
        const soapBody = resultado['soap:Envelope'] || resultado['soapenv:Envelope'];
        const body = soapBody['soap:Body'] || soapBody['soapenv:Body'];
        const feCAESolicitarResult = body['FECAESolicitarResponse']?.FECAESolicitarResult 
            || body['ns1:FECAESolicitarResponse']?.FECAESolicitarResult;
        
        if (!feCAESolicitarResult) {
            throw new Error('Respuesta inválida del WSFEv1');
        }
        
        const feDetResp = feCAESolicitarResult.FeDetResp?.FECAEDetResponse;
        const cabecera = feCAESolicitarResult.FeCabResp;

        // Helper: extrae "Code: Msg | Code: Msg" de Obs/Err/Evt (vengan como objeto o array)
        const extraerMsgs = (x) => {
            if (!x) return '';
            const arr = Array.isArray(x) ? x : [x];
            return arr.map(o => `${o?.Code ?? '?'}: ${o?.Msg ?? ''}`).join(' | ');
        };
        const erroresResult = extraerMsgs(feCAESolicitarResult.Errors?.Err);
        const eventosResult = extraerMsgs(feCAESolicitarResult.Events?.Evt);

        // 11. Verificar resultado
        if (!feDetResp) {
            const detalle = [erroresResult && `Errores: ${erroresResult}`, eventosResult && `Eventos: ${eventosResult}`]
                .filter(Boolean).join(' · ') || 'Error desconocido';
            throw new Error(`Error WSFEv1: ${detalle}`);
        }

        const cae = feDetResp.CAE;
        const caeVencimiento = feDetResp.CAEFchVto;
        const resultadoOperacion = feDetResp.Resultado;

        // Verificar si el CAE fue aprobado. Si no, capturar TODO el detalle de AFIP
        // (observaciones + errores + eventos) para poder diagnosticar el motivo real.
        if (resultadoOperacion !== 'A') {
            const obs = extraerMsgs(feDetResp.Observaciones?.Obs);
            const detalle = [
                `Resultado=${resultadoOperacion || '?'}`,
                obs && `Obs: ${obs}`,
                erroresResult && `Errores: ${erroresResult}`,
                eventosResult && `Eventos: ${eventosResult}`,
            ].filter(Boolean).join(' · ');
            throw new Error(`CAE no aprobado — ${detalle}`);
        }
        
        // 12. Guardar comprobante en BD con CAE real
        const caeVencimientoDate = new Date(
            caeVencimiento.substring(0, 4),
            parseInt(caeVencimiento.substring(4, 6)) - 1,
            caeVencimiento.substring(6, 8)
        );
        
        // El CAE ya fue emitido por ARCA: el guardado NO puede perderlo.
        // Si la columna nueva todavía no existe (migración pendiente), reintenta sin ella.
        let comprobanteResult;
        const valoresInsert = [
            venta_id, negocio_id, cae, caeVencimientoDate, numeroComprobante,
            punto_venta, tipo_comprobante, docTipo,
            numero_documento || null, denominacion_comprador || 'Consumidor Final',
            importe_total, importeNetoCalculado, importeIvaCalculado,
            xmlEnviado, xmlRespuesta, fechaEmision
        ];
        try {
            comprobanteResult = await db.query(`
                INSERT INTO comprobantes_electronicos (
                    venta_id, negocio_id, cae, cae_vencimiento, numero_comprobante,
                    punto_venta, tipo_comprobante, tipo_documento, numero_documento,
                    denominacion_comprador, importe_total, importe_neto, importe_iva,
                    xml_enviado, xml_respuesta, cbte_fecha, estado, condicion_iva_receptor
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'emitido', $17)
                RETURNING *
            `, [...valoresInsert, condIvaReceptor]);
        } catch (insertError) {
            console.error('⚠️ Insert con condicion_iva_receptor/cbte_fecha falló, reintentando sin esas columnas:', insertError.message);
            comprobanteResult = await db.query(`
                INSERT INTO comprobantes_electronicos (
                    venta_id, negocio_id, cae, cae_vencimiento, numero_comprobante,
                    punto_venta, tipo_comprobante, tipo_documento, numero_documento,
                    denominacion_comprador, importe_total, importe_neto, importe_iva,
                    xml_enviado, xml_respuesta, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'emitido')
                RETURNING *
            `, valoresInsert.slice(0, 15));
        }
        
        // 13. Actualizar venta con el comprobante electrónico
        if (venta_id) {
            await db.query(
                'UPDATE ventas SET comprobante_electronico_id = $1, tipo_facturacion = $2 WHERE id = $3',
                [comprobanteResult.rows[0].id, 'electronica', venta_id]
            );
        }
        
        console.log(`✅ Comprobante emitido con CAE real: ${cae} - Número ${numeroComprobante}`);
        
        return {
            exito: true,
            comprobante: comprobanteResult.rows[0],
            mensaje: 'Comprobante emitido correctamente'
        };
    } catch (error) {
        console.error('❌ Error emitiendo comprobante:', error);
        
        // Guardar comprobante con error si es posible
        try {
            await db.query(`
                INSERT INTO comprobantes_electronicos (
                    venta_id, negocio_id, cae, cae_vencimiento, numero_comprobante,
                    punto_venta, tipo_comprobante, tipo_documento, numero_documento,
                    denominacion_comprador, importe_total, importe_neto, importe_iva,
                    xml_enviado, xml_respuesta, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'error')
            `, [
                venta_id, negocio_id, null, null, numeroComprobante || 0,
                punto_venta, tipo_comprobante, tipo_documento || 99,
                numero_documento || null, denominacion_comprador || 'Consumidor Final',
                importe_total, importe_neto || importe_total, importe_iva || 0,
                xmlEnviado, xmlRespuesta
            ]);
        } catch (dbError) {
            console.error('Error guardando comprobante con error:', dbError);
        }
        
        return {
            exito: false,
            error: error.message
        };
    }
}

/**
 * Obtiene el historial de comprobantes de un negocio
 * @param {number} negocio_id - ID del negocio
 * @param {Object} filtros - Filtros opcionales (fecha_desde, fecha_hasta, tipo_comprobante)
 * @returns {Array} - Lista de comprobantes
 */
async function obtenerComprobantes(negocio_id, filtros = {}) {
    try {
        let consulta = `
            SELECT ce.*, v.total as venta_total, v.metodo_pago
            FROM comprobantes_electronicos ce
            LEFT JOIN ventas v ON ce.venta_id = v.id
            WHERE ce.negocio_id = $1
        `;
        const valores = [negocio_id];
        let contador = 2;
        
        if (filtros.fecha_desde) {
            consulta += ` AND ce.fecha_emision >= $${contador}`;
            valores.push(filtros.fecha_desde);
            contador++;
        }
        
        if (filtros.fecha_hasta) {
            consulta += ` AND ce.fecha_emision <= $${contador}`;
            valores.push(filtros.fecha_hasta + ' 23:59:59');
            contador++;
        }
        
        if (filtros.tipo_comprobante) {
            consulta += ` AND ce.tipo_comprobante = $${contador}`;
            valores.push(filtros.tipo_comprobante);
            contador++;
        }
        
        consulta += ' ORDER BY ce.fecha_emision DESC LIMIT 100';
        
        const resultado = await db.query(consulta, valores);
        return resultado.rows;
    } catch (error) {
        console.error('❌ Error obteniendo comprobantes:', error);
        throw error;
    }
}

/**
 * Obtiene el último número de comprobante emitido
 * @param {number} negocio_id - ID del negocio
 * @param {number} punto_venta - Punto de venta
 * @param {number} tipo_comprobante - Tipo de comprobante
 * @returns {number} - Último número emitido
 */
async function obtenerUltimoNumero(negocio_id, punto_venta, tipo_comprobante) {
    try {
        const resultado = await db.query(
            'SELECT MAX(numero_comprobante) as ultimo FROM comprobantes_electronicos WHERE negocio_id = $1 AND punto_venta = $2 AND tipo_comprobante = $3',
            [negocio_id, punto_venta, tipo_comprobante]
        );
        return resultado.rows[0]?.ultimo || 0;
    } catch (error) {
        console.error('❌ Error obteniendo último número:', error);
        return 0;
    }
}

/**
 * Guarda un certificado completo (.crt) y lo asocia a un negocio
 * @param {number} negocio_id - ID del negocio
 * @param {Buffer} certBuffer - Contenido del certificado
 * @param {string} cuit - CUIT del negocio
 * @param {number} punto_venta - Punto de venta
 * @param {string} regimen_fiscal - Régimen fiscal
 * @returns {Object} - Certificado guardado
 */
async function guardarCertificadoNegocio(negocio_id, certBuffer, cuit, punto_venta, regimen_fiscal, keyPath = null) {
    try {
        // Guardar archivo .crt
        const certPath = guardarCertificado(certBuffer, cuit);
        
        // Buscar registro existente o crear uno nuevo
        const existente = await db.query(
            'SELECT * FROM certificados_arca WHERE negocio_id = $1 AND activo = true',
            [negocio_id]
        );
        
        if (existente.rows.length > 0) {
    // Actualizar registro existente
    await db.query(`
        UPDATE certificados_arca 
        SET cert_path = $1, key_path = $6, cuit = $2, punto_venta = $3, regimen_fiscal = $4, activo = true
        WHERE id = $5
    `, [certPath, cuit, punto_venta, regimen_fiscal, existente.rows[0].id, keyPath || existente.rows[0].key_path]);
    
    console.log(`✅ Certificado actualizado para negocio ${negocio_id}`);
    return { ...existente.rows[0], cert_path: certPath };
} else {
    // Crear nuevo registro
    const resultado = await db.query(`
        INSERT INTO certificados_arca (negocio_id, cert_path, key_path, cuit, punto_venta, regimen_fiscal, activo)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
    `, [negocio_id, certPath, keyPath || null, cuit, punto_venta, regimen_fiscal]);
            
            console.log(`✅ Certificado creado para negocio ${negocio_id}`);
            return resultado.rows[0];
        }
    } catch (error) {
        console.error('❌ Error guardando certificado del negocio:', error);
        throw error;
    }
}

/**
 * Emite una NOTA DE CRÉDITO electrónica (WSFEv1) que anula/acredita una factura
 * ya emitida. Mapea el tipo (A→3, B→8, C→13), referencia el comprobante original
 * con CbtesAsoc y usa los mismos importes. No toca el stock (eso es "anular").
 * @param {Object} datos - { negocio_id, venta_id }
 */
async function emitirNotaCredito({ negocio_id, venta_id }) {
    if (!venta_id) throw new Error('venta_id requerido');

    // 1. Buscar la factura original de la venta
    const origRes = await db.query(`
        SELECT * FROM comprobantes_electronicos
        WHERE venta_id = $1 AND negocio_id = $2 AND estado = 'emitido'
          AND tipo_comprobante IN (1,2,3,6,7,8,11,12,13)
        ORDER BY id DESC LIMIT 1
    `, [venta_id, negocio_id]);
    if (origRes.rows.length === 0) {
        return { exito: false, error: 'La venta no tiene una factura electrónica emitida' };
    }
    const orig = origRes.rows[0];

    // Mapear factura/ND → nota de crédito (A=3, B=8, C=13)
    const mapNC = { 1: 3, 2: 3, 3: 3, 6: 8, 7: 8, 8: 8, 11: 13, 12: 13, 13: 13 };
    const origTipo = parseInt(orig.tipo_comprobante);
    const ncTipo = mapNC[origTipo];
    if (!ncTipo) return { exito: false, error: 'Tipo de comprobante no soportado para nota de crédito' };

    // Evitar duplicar la nota de crédito
    const yaNC = await db.query(`
        SELECT 1 FROM comprobantes_electronicos
        WHERE venta_id = $1 AND negocio_id = $2 AND estado = 'emitido' AND tipo_comprobante IN (3,8,13) LIMIT 1
    `, [venta_id, negocio_id]);
    if (yaNC.rows.length > 0) return { exito: false, error: 'Esta venta ya tiene una nota de crédito emitida' };

    const punto_venta = parseInt(orig.punto_venta);
    const docTipo = parseInt(orig.tipo_documento) || 99;
    const condIvaReceptor = parseInt(orig.condicion_iva_receptor) || (origTipo === 1 ? 1 : (docTipo === 80 ? 6 : 5));
    const importeTotal = parseFloat(orig.importe_total);
    const importeNeto = parseFloat(orig.importe_neto) || importeTotal;
    const importeIva = parseFloat(orig.importe_iva) || 0;
    const origNro = parseInt(orig.numero_comprobante);
    const origFch = (orig.cbte_fecha && /^\d{8}$/.test(String(orig.cbte_fecha)))
        ? String(orig.cbte_fecha)
        : fechaArgYYYYMMDD();

    let xmlEnviado = null, xmlRespuesta = null, numeroComprobante = 0;
    try {
        // Certificado + ticket WSAA (mismo flujo que emitirComprobante)
        const certResult = await db.query('SELECT * FROM certificados_arca WHERE negocio_id = $1 AND activo = true LIMIT 1', [negocio_id]);
        if (certResult.rows.length === 0) throw new Error('No hay certificado activo configurado');
        const certificado = certResult.rows[0];
        if (certificado.modo === 'delegado') {
            const delegado = wsaaService.obtenerCertDelegado();
            if (!delegado.disponible) throw new Error(delegado.error);
            const verifDelegado = verificarCertificado(path.relative(path.join(__dirname, '../uploads'), delegado.certPath));
            if (!verifDelegado.valido) throw new Error('El certificado del proveedor está vencido o no es válido. Contactá a soporte.');
        } else {
            const verificacion = verificarCertificado(certificado.cert_path);
            if (!verificacion.valido) throw new Error('El certificado está vencido o no es válido');
        }

        console.log('🔐 Obteniendo ticket de acceso WSAA (nota de crédito)...');
        const ticket = await wsaaService.obtenerTicketAcceso(negocio_id, 'wsfe');

        const configResult = await db.query('SELECT cuit, entorno_arca FROM configuracion WHERE negocio_id = $1', [negocio_id]);
        const cuitEmisor = configResult.rows[0]?.cuit?.replace(/[-\s]/g, '') || certificado.cuit?.replace(/[-\s]/g, '');
        const entorno = configResult.rows[0]?.entorno_arca || 'homologacion';
        const wsfeUrl = entorno === 'produccion'
            ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
            : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';

        // Último número de NC autorizado para este PtoVta/Tipo
        const xmlUltimo = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/><soapenv:Body>
        <ar:FECompUltimoAutorizado>
            <ar:Auth><ar:Token>${ticket.token}</ar:Token><ar:Sign>${ticket.sign}</ar:Sign><ar:Cuit>${cuitEmisor}</ar:Cuit></ar:Auth>
            <ar:PtoVta>${punto_venta}</ar:PtoVta><ar:CbteTipo>${ncTipo}</ar:CbteTipo>
        </ar:FECompUltimoAutorizado>
    </soapenv:Body></soapenv:Envelope>`;
        const respUltimo = await axios.post(wsfeUrl, xmlUltimo, {
            headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado' },
            timeout: 30000, httpsAgent
        });
        const parserU = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
        const resU = await parserU.parseStringPromise(respUltimo.data);
        const envU = resU['soap:Envelope'] || resU['soapenv:Envelope'];
        const bodyU = envU['soap:Body'] || envU['soapenv:Body'];
        const ultResp = bodyU['FECompUltimoAutorizadoResponse']?.FECompUltimoAutorizadoResult || bodyU['ns1:FECompUltimoAutorizadoResponse']?.FECompUltimoAutorizadoResult;
        const ultimoNro = parseInt(ultResp?.CbteNro || '0');
        numeroComprobante = ultimoNro + 1;
        console.log(`📋 Última NC AFIP: ${ultimoNro}, próxima: ${numeroComprobante}`);

        // Fecha (AR) con piso de seguridad respecto del último autorizado
        let fechaEmision = fechaArgYYYYMMDD();
        if (ultimoNro > 0) {
            try {
                const ultimaFch = await consultarFechaComprobante({
                    wsfeUrl, token: ticket.token, sign: ticket.sign, cuit: cuitEmisor,
                    puntoVenta: punto_venta, tipoComprobante: ncTipo, cbteNro: ultimoNro,
                });
                if (ultimaFch && /^\d{8}$/.test(ultimaFch) && ultimaFch > fechaEmision) fechaEmision = ultimaFch;
            } catch (e) { console.warn('⚠️ No se pudo consultar la fecha de la última NC:', e.message); }
        }

        xmlEnviado = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
    <soapenv:Header/><soapenv:Body>
        <ar:FECAESolicitar>
            <ar:Auth><ar:Token>${ticket.token}</ar:Token><ar:Sign>${ticket.sign}</ar:Sign><ar:Cuit>${cuitEmisor}</ar:Cuit></ar:Auth>
            <ar:FeCAEReq>
                <ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${punto_venta}</ar:PtoVta><ar:CbteTipo>${ncTipo}</ar:CbteTipo></ar:FeCabReq>
                <ar:FeDetReq>
                    <ar:FECAEDetRequest>
                        <ar:Concepto>1</ar:Concepto>
                        <ar:DocTipo>${docTipo}</ar:DocTipo>
                        <ar:DocNro>${docTipo === 99 ? 0 : (String(orig.numero_documento || '').replace(/[-\s.]/g, '') || 0)}</ar:DocNro>
                        <ar:CbteDesde>${numeroComprobante}</ar:CbteDesde>
                        <ar:CbteHasta>${numeroComprobante}</ar:CbteHasta>
                        <ar:CbteFch>${fechaEmision}</ar:CbteFch>
                        <ar:ImpTotal>${importeTotal.toFixed(2)}</ar:ImpTotal>
                        <ar:ImpTotConc>0.00</ar:ImpTotConc>
                        <ar:ImpNeto>${importeNeto.toFixed(2)}</ar:ImpNeto>
                        <ar:ImpOpEx>0.00</ar:ImpOpEx>
                        <ar:ImpIVA>${importeIva.toFixed(2)}</ar:ImpIVA>
                        <ar:ImpTrib>0.00</ar:ImpTrib>
                        <ar:MonId>PES</ar:MonId>
                        <ar:MonCotiz>1.000</ar:MonCotiz>
                        <ar:CondicionIVAReceptorId>${condIvaReceptor}</ar:CondicionIVAReceptorId>
                        <ar:CbtesAsoc>
                            <ar:CbteAsoc>
                                <ar:Tipo>${origTipo}</ar:Tipo>
                                <ar:PtoVta>${punto_venta}</ar:PtoVta>
                                <ar:Nro>${origNro}</ar:Nro>
                                <ar:Cuit>${cuitEmisor}</ar:Cuit>
                                <ar:CbteFch>${origFch}</ar:CbteFch>
                            </ar:CbteAsoc>
                        </ar:CbtesAsoc>
                        ${importeIva > 0 ? `
                        <ar:Iva>
                            <ar:AlicIva><ar:Id>5</ar:Id><ar:BaseImp>${importeNeto.toFixed(2)}</ar:BaseImp><ar:Importe>${importeIva.toFixed(2)}</ar:Importe></ar:AlicIva>
                        </ar:Iva>` : ''}
                    </ar:FECAEDetRequest>
                </ar:FeDetReq>
            </ar:FeCAEReq>
        </ar:FECAESolicitar>
    </soapenv:Body></soapenv:Envelope>`;

        console.log(`🧾 Enviando nota de crédito a WSFEv1 (${entorno})...`);
        const response = await axios.post(wsfeUrl, xmlEnviado, {
            headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECAESolicitar' },
            timeout: 60000, httpsAgent
        });
        xmlRespuesta = response.data;

        const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
        const resultado = await parser.parseStringPromise(response.data);
        const soapBody = resultado['soap:Envelope'] || resultado['soapenv:Envelope'];
        const body = soapBody['soap:Body'] || soapBody['soapenv:Body'];
        const feResult = body['FECAESolicitarResponse']?.FECAESolicitarResult || body['ns1:FECAESolicitarResponse']?.FECAESolicitarResult;
        if (!feResult) throw new Error('Respuesta inválida del WSFEv1');
        const feDetResp = feResult.FeDetResp?.FECAEDetResponse;
        const extraerMsgs = (x) => { if (!x) return ''; const arr = Array.isArray(x) ? x : [x]; return arr.map(o => `${o?.Code ?? '?'}: ${o?.Msg ?? ''}`).join(' | '); };
        const erroresResult = extraerMsgs(feResult.Errors?.Err);
        if (!feDetResp) throw new Error(`Error WSFEv1: ${erroresResult || 'desconocido'}`);
        const cae = feDetResp.CAE;
        const caeVencimiento = feDetResp.CAEFchVto;
        if (feDetResp.Resultado !== 'A') {
            const obs = extraerMsgs(feDetResp.Observaciones?.Obs);
            throw new Error(`NC no aprobada — Resultado=${feDetResp.Resultado || '?'}${obs ? ' · Obs: ' + obs : ''}${erroresResult ? ' · Errores: ' + erroresResult : ''}`);
        }

        const caeVtoDate = new Date(caeVencimiento.substring(0, 4), parseInt(caeVencimiento.substring(4, 6)) - 1, caeVencimiento.substring(6, 8));
        const valoresInsert = [
            venta_id, negocio_id, cae, caeVtoDate, numeroComprobante,
            punto_venta, ncTipo, docTipo, orig.numero_documento || null,
            orig.denominacion_comprador || 'Consumidor Final',
            importeTotal, importeNeto, importeIva, xmlEnviado, xmlRespuesta, fechaEmision
        ];
        let compResult;
        try {
            compResult = await db.query(`
                INSERT INTO comprobantes_electronicos (
                    venta_id, negocio_id, cae, cae_vencimiento, numero_comprobante,
                    punto_venta, tipo_comprobante, tipo_documento, numero_documento,
                    denominacion_comprador, importe_total, importe_neto, importe_iva,
                    xml_enviado, xml_respuesta, cbte_fecha, estado, condicion_iva_receptor
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'emitido',$17) RETURNING *
            `, [...valoresInsert, condIvaReceptor]);
        } catch (insertError) {
            console.error('⚠️ Insert NC con columnas nuevas falló, reintento sin ellas:', insertError.message);
            compResult = await db.query(`
                INSERT INTO comprobantes_electronicos (
                    venta_id, negocio_id, cae, cae_vencimiento, numero_comprobante,
                    punto_venta, tipo_comprobante, tipo_documento, numero_documento,
                    denominacion_comprador, importe_total, importe_neto, importe_iva,
                    xml_enviado, xml_respuesta, estado
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'emitido') RETURNING *
            `, valoresInsert.slice(0, 15));
        }

        console.log(`✅ Nota de crédito emitida con CAE real: ${cae} - Número ${numeroComprobante}`);
        return { exito: true, cae, comprobante: compResult.rows[0], mensaje: 'Nota de crédito emitida correctamente' };
    } catch (error) {
        console.error('❌ Error emitiendo nota de crédito:', error.message);
        try {
            await db.query(`
                INSERT INTO comprobantes_electronicos (
                    venta_id, negocio_id, cae, cae_vencimiento, numero_comprobante,
                    punto_venta, tipo_comprobante, tipo_documento, numero_documento,
                    denominacion_comprador, importe_total, importe_neto, importe_iva,
                    xml_enviado, xml_respuesta, estado
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'error')
            `, [
                venta_id, negocio_id, null, null, numeroComprobante || 0,
                punto_venta, ncTipo, docTipo, orig.numero_documento || null,
                orig.denominacion_comprador || 'Consumidor Final',
                importeTotal, importeNeto, importeIva, xmlEnviado, xmlRespuesta
            ]);
        } catch (dbError) { console.error('Error guardando NC con error:', dbError.message); }
        return { exito: false, error: error.message };
    }
}

module.exports = {
    generarCertificados,
    guardarCertificado,
    verificarCertificado,
    obtenerTiposComprobante,
    obtenerTiposDocumento,
    emitirComprobante,
    emitirNotaCredito,
    obtenerComprobantes,
    obtenerUltimoNumero,
    guardarCertificadoNegocio,
    fechaArgYYYYMMDD,
    consultarFechaComprobante,
    CERT_DIR
};