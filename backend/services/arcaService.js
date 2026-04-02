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
        responsable_inscripto: [
            { codigo: 1, nombre: 'Factura A', descripcion: 'Para Responsables Inscriptos', emoji: '📄' },
            { codigo: 6, nombre: 'Factura B', descripcion: 'Para consumidores finales', emoji: '📄' },
            { codigo: 3, nombre: 'Nota de Crédito A', descripcion: 'Devolución Factura A', emoji: '📝' },
            { codigo: 8, nombre: 'Nota de Crédito B', descripcion: 'Devolución Factura B', emoji: '📝' },
            { codigo: 2, nombre: 'Nota de Débito A', descripcion: 'Ajuste Factura A', emoji: '📋' },
            { codigo: 7, nombre: 'Nota de Débito B', descripcion: 'Ajuste Factura B', emoji: '📋' },
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
        importe_iva
    } = datos;
    
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
        const verificacion = verificarCertificado(certificado.cert_path);
        if (!verificacion.valido) {
            throw new Error('El certificado está vencido o no es válido');
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
        const fechaEmision = new Date().toISOString().split('T')[0].replace(/-/g, '');
        
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
                        <ar:DocTipo>${tipo_documento || 99}</ar:DocTipo>
                        <ar:DocNro>${tipo_documento === 99 ? 0 : (numero_documento || 0)}</ar:DocNro>
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
        
        // 11. Verificar resultado
        if (!feDetResp) {
            const errores = feCAESolicitarResult.Errors?.Err;
            const mensajeError = Array.isArray(errores) 
                ? errores.map(e => `${e.Code}: ${e.Msg}`).join(', ')
                : (errores ? `${errores.Code}: ${errores.Msg}` : 'Error desconocido');
            throw new Error(`Error WSFEv1: ${mensajeError}`);
        }
        
        const cae = feDetResp.CAE;
        const caeVencimiento = feDetResp.CAEFchVto;
        const resultadoOperacion = feDetResp.Resultado;
        
        // Verificar si el CAE fue aprobado
       // Verificar si el CAE fue aprobado
if (resultadoOperacion !== 'A') {
   
    const observaciones = feDetResp.Observaciones?.Obs;
    const mensajeObs = Array.isArray(observaciones)
        ? observaciones.map(o => `${o.Code}: ${o.Msg}`).join(', ')
        : (observaciones ? `${observaciones.Code}: ${observaciones.Msg}` : '');
    throw new Error(`CAE no aprobado: ${mensajeObs}`);
}
        
        // 12. Guardar comprobante en BD con CAE real
        const caeVencimientoDate = new Date(
            caeVencimiento.substring(0, 4),
            parseInt(caeVencimiento.substring(4, 6)) - 1,
            caeVencimiento.substring(6, 8)
        );
        
        const comprobanteResult = await db.query(`
            INSERT INTO comprobantes_electronicos (
                venta_id, negocio_id, cae, cae_vencimiento, numero_comprobante,
                punto_venta, tipo_comprobante, tipo_documento, numero_documento,
                denominacion_comprador, importe_total, importe_neto, importe_iva,
                xml_enviado, xml_respuesta, estado
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'emitido')
            RETURNING *
        `, [
            venta_id, negocio_id, cae, caeVencimientoDate, numeroComprobante,
            punto_venta, tipo_comprobante, tipo_documento || 99,
            numero_documento || null, denominacion_comprador || 'Consumidor Final',
            importe_total, importeNetoCalculado, importeIvaCalculado,
            xmlEnviado, xmlRespuesta
        ]);
        
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

module.exports = {
    generarCertificados,
    guardarCertificado,
    verificarCertificado,
    obtenerTiposComprobante,
    obtenerTiposDocumento,
    emitirComprobante,
    obtenerComprobantes,
    obtenerUltimoNumero,
    guardarCertificadoNegocio,
    CERT_DIR
};