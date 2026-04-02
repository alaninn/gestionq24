// =============================================
// RUTAS: Facturación Electrónica ARCA
// =============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const arcaService = require('../services/arcaService');

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/certificados');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.crt', '.key', '.csr', '.pem'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo .crt, .key, .csr, .pem'));
        }
    }
});

// =============================================
// GENERAR CERTIFICADOS (.key + .csr)
// =============================================
router.post('/generar-certificados', verificarToken, soloAdmin, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const { cuit, razon_social } = req.body;
        
        if (!cuit) {
            return res.status(400).json({ error: 'CUIT es requerido' });
        }

        // Generar certificados
        const certificados = arcaService.generarCertificados(cuit, razon_social || 'Usuario ARCA');

        res.json({
            exito: true,
            mensaje: 'Certificados generados correctamente',
            archivos: {
                key: certificados.keyPath,
                csr: certificados.csrPath
            },
            instrucciones: [
                '1. Descargá el archivo .csr',
                '2. Ingresá a https://www.arca.gob.ar',
                '3. Andá a Administración de Certificados Digitales',
                '4. Subí el archivo .csr',
                '5. Descargá el archivo .crt que te devuelve ARCA',
                '6. Volvé acá y subí el archivo .crt'
            ]
        });
    } catch (error) {
        console.error('❌ Error generando certificados:', error);
        res.status(500).json({ error: error.message || 'Error al generar certificados' });
    }
});

// =============================================
// DESCARGAR ARCHIVO GENERADO (.key o .csr)
// =============================================
router.get('/descargar/:tipo/:filename', verificarToken, async (req, res) => {
    try {
        const { tipo, filename } = req.params;
        
        if (!['key', 'csr', 'crt'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo de archivo no válido' });
        }

        const filePath = path.join(__dirname, '../uploads/certificados', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        res.download(filePath);
    } catch (error) {
        console.error('❌ Error descargando archivo:', error);
        res.status(500).json({ error: 'Error al descargar archivo' });
    }
});

// =============================================
// SUBIR CERTIFICADO .CRT RECIBIDO DE ARCA
// =============================================
router.post('/subir-certificado', verificarToken, soloAdmin, upload.single('certificado'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        const { cuit, punto_venta, regimen_fiscal } = req.body;

        if (!cuit) {
            return res.status(400).json({ error: 'CUIT es requerido' });
        }

        // Leer el archivo subido
        // Leer el archivo subido
const certBuffer = fs.readFileSync(req.file.path);

// Buscar el .key más reciente generado para este CUIT
const certDir = path.join(__dirname, '../uploads/certificados');
const archivos = fs.readdirSync(certDir);
const keyFiles = archivos
    .filter(f => f.startsWith(`key_${cuit}_`) && f.endsWith('.key'))
    .sort()
    .reverse(); // el más reciente primero

const keyPath = keyFiles.length > 0 ? `certificados/${keyFiles[0]}` : null;

if (!keyPath) {
    return res.status(400).json({ 
        error: 'No se encontró la clave privada (.key) para este CUIT. Generá los certificados primero.' 
    });
}

// Guardar certificado en BD
const certificado = await arcaService.guardarCertificadoNegocio(
    negocio_id,
    certBuffer,
    cuit,
    parseInt(punto_venta) || 1,
    regimen_fiscal || 'responsable_inscripto',
    keyPath
);

        // Eliminar archivo temporal
        fs.unlinkSync(req.file.path);

        res.json({
            exito: true,
            mensaje: 'Certificado subido correctamente',
            certificado: certificado
        });
    } catch (error) {
        console.error('❌ Error subiendo certificado:', error);
        res.status(500).json({ error: error.message || 'Error al subir certificado' });
    }
});

// =============================================
// OBTENER CERTIFICADOS DEL NEGOCIO
// =============================================
router.get('/certificados', verificarToken, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const resultado = await db.query(
            'SELECT * FROM certificados_arca WHERE negocio_id = $1 ORDER BY created_at DESC',
            [negocio_id]
        );

        // Verificar estado de cada certificado
        const certificados = resultado.rows.map(cert => {
            const verificacion = arcaService.verificarCertificado(cert.cert_path);
            return {
                ...cert,
                estado_certificado: verificacion
            };
        });

        res.json(certificados);
    } catch (error) {
        console.error('❌ Error obteniendo certificados:', error);
        res.status(500).json({ error: 'Error al obtener certificados' });
    }
});

// =============================================
// ELIMINAR CERTIFICADO
// =============================================
router.delete('/certificados/:id', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;

        // Obtener certificado
        const cert = await db.query(
            'SELECT * FROM certificados_arca WHERE id = $1 AND negocio_id = $2',
            [id, negocio_id]
        );

        if (cert.rows.length === 0) {
            return res.status(404).json({ error: 'Certificado no encontrado' });
        }

        // Eliminar archivos físicos
        const certData = cert.rows[0];
        if (certData.cert_path) {
            const certPath = path.join(__dirname, '../uploads', certData.cert_path);
            if (fs.existsSync(certPath)) fs.unlinkSync(certPath);
        }
        if (certData.key_path) {
            const keyPath = path.join(__dirname, '../uploads', certData.key_path);
            if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
        }
        if (certData.csr_path) {
            const csrPath = path.join(__dirname, '../uploads', certData.csr_path);
            if (fs.existsSync(csrPath)) fs.unlinkSync(csrPath);
        }

        // Eliminar de BD
        await db.query('DELETE FROM certificados_arca WHERE id = $1', [id]);

        res.json({ mensaje: 'Certificado eliminado correctamente' });
    } catch (error) {
        console.error('❌ Error eliminando certificado:', error);
        res.status(500).json({ error: 'Error al eliminar certificado' });
    }
});

// =============================================
// OBTENER TIPOS DE COMPROBANTE SEGÚN RÉGIMEN
// =============================================
router.get('/tipos-comprobante/:regimen', verificarToken, async (req, res) => {
    try {
        const { regimen } = req.params;
        const tipos = arcaService.obtenerTiposComprobante(regimen);
        res.json(tipos);
    } catch (error) {
        console.error('❌ Error obteniendo tipos:', error);
        res.status(500).json({ error: 'Error al obtener tipos de comprobante' });
    }
});

// =============================================
// OBTENER TIPOS DE DOCUMENTO
// =============================================
router.get('/tipos-documento', verificarToken, async (req, res) => {
    try {
        const tipos = arcaService.obtenerTiposDocumento();
        res.json(tipos);
    } catch (error) {
        console.error('❌ Error obteniendo tipos de documento:', error);
        res.status(500).json({ error: 'Error al obtener tipos de documento' });
    }
});

// =============================================
// EMITIR COMPROBANTE ELECTRÓNICO
// =============================================
router.post('/emitir', verificarToken, soloAdmin, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const {
            venta_id,
            tipo_comprobante,
            punto_venta,
            tipo_documento,
            numero_documento,
            denominacion_comprador,
            importe_total,
            importe_neto,
            importe_iva
        } = req.body;

        if (!tipo_comprobante || !importe_total) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        const resultado = await arcaService.emitirComprobante({
            negocio_id,
            venta_id,
            tipo_comprobante,
            punto_venta: punto_venta || 1,
            tipo_documento,
            numero_documento,
            denominacion_comprador,
            importe_total,
            importe_neto,
            importe_iva
        });

        if (resultado.exito) {
            res.json(resultado);
        } else {
            res.status(400).json(resultado);
        }
    } catch (error) {
        console.error('❌ Error emitiendo comprobante:', error);
        res.status(500).json({ error: error.message || 'Error al emitir comprobante' });
    }
});

// =============================================
// OBTENER HISTORIAL DE COMPROBANTES
// =============================================
router.get('/comprobantes', verificarToken, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const { fecha_desde, fecha_hasta, tipo_comprobante } = req.query;

        const comprobantes = await arcaService.obtenerComprobantes(negocio_id, {
            fecha_desde,
            fecha_hasta,
            tipo_comprobante: tipo_comprobante ? parseInt(tipo_comprobante) : null
        });

        res.json(comprobantes);
    } catch (error) {
        console.error('❌ Error obteniendo comprobantes:', error);
        res.status(500).json({ error: 'Error al obtener comprobantes' });
    }
});

// =============================================
// OBTENER ÚLTIMO NÚMERO DE COMPROBANTE
// =============================================
router.get('/ultimo-numero', verificarToken, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const { punto_venta, tipo_comprobante } = req.query;

        const ultimo = await arcaService.obtenerUltimoNumero(
            negocio_id,
            parseInt(punto_venta) || 1,
            parseInt(tipo_comprobante) || 1
        );

        res.json({ ultimo_numero: ultimo });
    } catch (error) {
        console.error('❌ Error obteniendo último número:', error);
        res.status(500).json({ error: 'Error al obtener último número' });
    }
});

// =============================================
// TEST DE CONEXIÓN CON ARCA
// =============================================
router.post('/test-conexion', verificarToken, soloAdmin, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        // Obtener certificado activo
        const certResult = await db.query(
            'SELECT * FROM certificados_arca WHERE negocio_id = $1 AND activo = true LIMIT 1',
            [negocio_id]
        );

        if (certResult.rows.length === 0) {
            return res.json({
                exito: false,
                mensaje: 'No hay certificado activo configurado. Generá y subí tus certificados primero.'
            });
        }

        const certificado = certResult.rows[0];

        // Verificar certificado
        const verificacion = arcaService.verificarCertificado(certificado.cert_path);
        
        if (!verificacion.valido) {
            return res.json({
                exito: false,
                mensaje: `Certificado inválido: ${verificacion.error || 'Vencido o corrupto'}`
            });
        }

        // Obtener configuración para determinar entorno
        const configResult = await db.query(
            'SELECT entorno_arca FROM configuracion WHERE negocio_id = $1',
            [negocio_id]
        );
        
        const entorno = configResult.rows[0]?.entorno_arca || 'homologacion';
        const urlWsaa = entorno === 'produccion' 
            ? 'https://wsaa.afip.gov.ar' 
            : 'https://wsaahomo.afip.gov.ar';

       
        // Probar conexión real con WSAA
const wsaaService = require('../services/wsaaService');
const ticket = await wsaaService.obtenerTicketAcceso(negocio_id, 'wsfe');
res.json({
    exito: true,
    mensaje: `Conexión exitosa al entorno de ${entorno === 'produccion' ? 'PRODUCCIÓN' : 'HOMOLOGACIÓN'}`,
            detalles: {
                entorno: entorno,
                url_wsaa: urlWsaa,
                cuit: certificado.cuit,
                punto_venta: certificado.punto_venta,
                certificado_vigente: true,
                dias_restantes: verificacion.diasRestantes,
                vencimiento: verificacion.fechaVencimiento
            }
        });
    } catch (error) {
        console.error('❌ Error en test de conexión:', error);
        res.json({
            exito: false,
            mensaje: error.message || 'Error al probar conexión'
        });
    }
});

module.exports = router;
