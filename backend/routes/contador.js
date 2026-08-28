// =============================================
// ARCHIVO: routes/contador.js
// Módulo "Tu Contador": situación fiscal en tiempo real.
// - Categoría (monotributo / responsable) desde ARCA con respaldo configurado.
// - Ventas facturadas (comprobantes_electronicos: datos reales de ARCA) vs
//   compras facturadas (CSV de Mis Comprobantes + gastos con factura).
// - Monotributo: acumulado 12 meses vs tope. Responsable: IVA débito − crédito.
// Se monta con verificarToken + validarLimitePlan + verificarPermiso('resumen_fiscal','ver').
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const arcaPadron = require('../services/arcaPadron');

// Capacidad del módulo: la habilita el PLAN (premium) o un OVERRIDE por negocio
// (negocios.contador_habilitado), que activa el superadmin. Mismo criterio que la
// Tienda Online. El superadmin siempre pasa.
router.use(async (req, res, next) => {
    try {
        if (req.usuario?.rol === 'superadmin' || req.esSuperadmin) return next();
        if (req.limitesPlan?.contador === true) return next();
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (negocio_id) {
            const r = await db.query('SELECT contador_habilitado FROM negocios WHERE id = $1', [negocio_id]);
            if (r.rows[0]?.contador_habilitado === true) return next();
        }
        return res.status(403).json({ error: 'Tu Contador no está habilitado en tu plan.', requierePremium: true });
    } catch (e) {
        return res.status(403).json({ error: 'Tu Contador no está habilitado.' });
    }
});

const FACTURAS = [1, 6, 11];   // Factura A, B, C
const NOTAS_CREDITO = [3, 8, 13]; // NC A, B, C (restan)
const hoyISO = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

// Ventas facturadas reales (comprobantes autorizados por ARCA) en un rango.
async function ventasEnRango(negocioId, desde, hasta) {
    const r = await db.query(`
        SELECT
            COALESCE(SUM(CASE WHEN tipo_comprobante = ANY($4) THEN -importe_total ELSE importe_total END), 0) AS total,
            COALESCE(SUM(CASE WHEN tipo_comprobante = ANY($4) THEN -importe_neto ELSE importe_neto END), 0) AS neto,
            COALESCE(SUM(CASE WHEN tipo_comprobante = ANY($4) THEN -importe_iva ELSE importe_iva END), 0) AS iva,
            COUNT(*) AS cantidad
        FROM comprobantes_electronicos
        WHERE negocio_id = $1 AND estado = 'emitido'
          AND fecha_emision::date BETWEEN $2::date AND $3::date
          AND tipo_comprobante = ANY($5)
    `, [negocioId, desde, hasta, NOTAS_CREDITO, [...FACTURAS, ...NOTAS_CREDITO]]);
    const x = r.rows[0] || {};
    return { total: +(+x.total).toFixed(2), neto: +(+x.neto).toFixed(2), iva: +(+x.iva).toFixed(2), cantidad: parseInt(x.cantidad) || 0 };
}

// Compras facturadas: CSV de Mis Comprobantes (recibidos) + gastos con factura.
async function comprasEnRango(negocioId, desde, hasta) {
    const imp = await db.query(`
        SELECT COALESCE(SUM(total),0) total, COALESCE(SUM(neto),0) neto, COALESCE(SUM(iva),0) iva, COUNT(*) cantidad
        FROM comprobantes_importados
        WHERE negocio_id=$1 AND tipo='recibido' AND fecha BETWEEN $2::date AND $3::date
    `, [negocioId, desde, hasta]);
    const gas = await db.query(`
        SELECT
            COALESCE(SUM(monto),0) total,
            COALESCE(SUM(monto / (1 + COALESCE(NULLIF(porcentaje_iva,0),21)/100.0)),0) neto,
            COALESCE(SUM(monto - monto / (1 + COALESCE(NULLIF(porcentaje_iva,0),21)/100.0)),0) iva,
            COUNT(*) cantidad
        FROM gastos
        WHERE negocio_id=$1 AND tipo_comprobante IN ('factura_a','factura_b','factura_c')
          AND fecha::date BETWEEN $2::date AND $3::date
    `, [negocioId, desde, hasta]).catch(() => ({ rows: [{ total: 0, neto: 0, iva: 0, cantidad: 0 }] }));
    const a = imp.rows[0], b = gas.rows[0];
    return {
        total: +(+a.total + +b.total).toFixed(2),
        neto: +(+a.neto + +b.neto).toFixed(2),
        iva: +(+a.iva + +b.iva).toFixed(2),
        cantidad: (parseInt(a.cantidad) || 0) + (parseInt(b.cantidad) || 0),
    };
}

// Régimen + categoría — CAMINO RÁPIDO: config + lo que haya cacheado de ARCA.
// No le pega a ARCA (esa consulta es lenta y se hace explícita en /sincronizar).
async function obtenerCategoria(negocioId) {
    const cfg = await db.query('SELECT regimen_fiscal, categoria_monotributo FROM configuracion WHERE negocio_id = $1', [negocioId]);
    const base = cfg.rows[0] || {};
    let regimen = base.regimen_fiscal || 'responsable_inscripto';
    let categoria = base.categoria_monotributo || null;
    let fuente = 'config';
    const arca = arcaPadron.constanciaCacheada(negocioId);
    if (arca) { regimen = arca.regimen; categoria = arca.categoria_monotributo || categoria; fuente = 'arca'; }
    return { regimen, categoria_monotributo: categoria, fuente };
}

// GET /api/contador/categoria
router.get('/categoria', async (req, res) => {
    try {
        const negocioId = req.negocio_id || req.usuario?.negocio_id;
        if (!negocioId) return res.status(400).json({ error: 'negocio_id requerido' });
        res.json(await obtenerCategoria(negocioId));
    } catch (e) {
        console.error('Error contador/categoria:', e);
        res.status(500).json({ error: 'No se pudo obtener la categoría' });
    }
});

// POST /api/contador/categoria/sincronizar — consulta ARCA (padrón) EXPLÍCITA.
// Puede tardar (WSAA). Si el servicio no está autorizado en AFIP, devuelve la
// configurada avisando que no se pudo traer de ARCA.
router.post('/categoria/sincronizar', async (req, res) => {
    try {
        const negocioId = req.negocio_id || req.usuario?.negocio_id;
        if (!negocioId) return res.status(400).json({ error: 'negocio_id requerido' });
        const arca = await arcaPadron.consultarConstancia(negocioId);
        if (arca) return res.json({ ok: true, ...arca });
        const base = await obtenerCategoria(negocioId);
        res.json({ ok: false, mensaje: 'No se pudo traer de ARCA (verificá que tu certificado tenga autorizado el servicio de Padrón). Se usa la categoría configurada.', ...base });
    } catch (e) {
        console.error('Error contador/sincronizar:', e.message);
        res.status(500).json({ error: 'No se pudo consultar ARCA' });
    }
});

// GET /api/contador/resumen?desde=&hasta=  (default: mes en curso)
router.get('/resumen', async (req, res) => {
    try {
        const negocioId = req.negocio_id || req.usuario?.negocio_id;
        if (!negocioId) return res.status(400).json({ error: 'negocio_id requerido' });

        const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || '') ? req.query.desde : primerDiaMes();
        const hasta = /^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta || '') ? req.query.hasta : hoyISO();

        const cat = await obtenerCategoria(negocioId);
        const ventas = await ventasEnRango(negocioId, desde, hasta);
        const compras = await comprasEnRango(negocioId, desde, hasta);

        // Año en curso (para las tarjetas) y últimos 12 meses (para el tope mono).
        const anio = new Date().getFullYear();
        const ventasAnio = await ventasEnRango(negocioId, `${anio}-01-01`, hoyISO());
        const d12 = new Date(); d12.setMonth(d12.getMonth() - 12);
        const ventas12 = await ventasEnRango(negocioId, d12.toISOString().slice(0, 10), hoyISO());

        let monotributo = null, responsable = null;

        if (cat.regimen === 'monotributista') {
            const topesR = await db.query('SELECT categoria, tope_anual FROM monotributo_topes ORDER BY tope_anual ASC');
            const topes = topesR.rows.map(t => ({ categoria: t.categoria, tope: +t.tope_anual }));
            const acumulado = ventas12.total;
            // Categoría que le correspondería según lo facturado.
            const sugerida = topes.find(t => acumulado <= t.tope) || topes[topes.length - 1] || null;
            const propia = cat.categoria_monotributo ? topes.find(t => t.categoria === cat.categoria_monotributo) : null;
            // El tope de referencia: el de su categoría declarada, o el de exclusión (última).
            const refTope = propia?.tope || (topes.length ? topes[topes.length - 1].tope : 0);
            const restante = +(refTope - acumulado).toFixed(2);
            const uso = refTope > 0 ? acumulado / refTope : 0;
            const estado = uso >= 1 ? 'rojo' : (uso >= 0.85 ? 'amarillo' : 'verde');
            const rateMensual = acumulado / 12;
            const proyeccion_meses = rateMensual > 0 && restante > 0 ? +(restante / rateMensual).toFixed(1) : null;
            monotributo = {
                acumulado_12m: acumulado,
                categoria_declarada: cat.categoria_monotributo || null,
                categoria_sugerida: sugerida?.categoria || null,
                tope_referencia: refTope,
                restante,
                uso_pct: +(uso * 100).toFixed(1),
                estado,
                proyeccion_meses,
                topes,
            };
        } else {
            responsable = {
                iva_debito: ventas.iva,
                iva_credito: compras.iva,
                posicion: +(ventas.iva - compras.iva).toFixed(2),
            };
        }

        res.json({
            categoria: cat,
            periodo: { desde, hasta },
            ventas, compras,
            ventas_anio: ventasAnio,
            responsable, monotributo,
        });
    } catch (e) {
        console.error('Error contador/resumen:', e);
        res.status(500).json({ error: 'No se pudo calcular el resumen fiscal' });
    }
});

// ---- Import de "Mis Comprobantes" (CSV) ----
// Parser flexible: detecta separador (; o ,) y ubica columnas por nombre.
function parseCSV(texto) {
    const filas = [];
    const lineas = String(texto).replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
    if (!lineas.length) return { headers: [], filas };
    const sep = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ';' : ',';
    const partir = (linea) => {
        const out = []; let cur = '', dentro = false;
        for (let i = 0; i < linea.length; i++) {
            const c = linea[i];
            if (c === '"') { if (dentro && linea[i + 1] === '"') { cur += '"'; i++; } else dentro = !dentro; }
            else if (c === sep && !dentro) { out.push(cur); cur = ''; }
            else cur += c;
        }
        out.push(cur);
        return out.map(s => s.trim());
    };
    const headers = partir(lineas[0]);
    for (let i = 1; i < lineas.length; i++) filas.push(partir(lineas[i]));
    return { headers, filas };
}
const normaliza = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function buscarCol(headers, ...claves) {
    const norm = headers.map(normaliza);
    for (const clave of claves) {
        const k = normaliza(clave);
        const idx = norm.findIndex(h => h.includes(k));
        if (idx >= 0) return idx;
    }
    return -1;
}
const num = (v) => { const n = parseFloat(String(v || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n; };
function fechaISO(v) {
    const s = String(v || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return null;
}

// POST /api/contador/importar  { tipo: 'recibido'|'emitido', csv: '...' }
router.post('/importar', async (req, res) => {
    const negocioId = req.negocio_id || req.usuario?.negocio_id;
    if (!negocioId) return res.status(400).json({ error: 'negocio_id requerido' });
    const tipo = req.body?.tipo === 'emitido' ? 'emitido' : 'recibido';
    const csv = req.body?.csv;
    if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'Falta el archivo CSV' });
    if (csv.length > 8_000_000) return res.status(400).json({ error: 'El archivo es demasiado grande' });

    try {
        const { headers, filas } = parseCSV(csv);
        if (!headers.length) return res.status(400).json({ error: 'No se pudo leer el CSV' });

        const cFecha = buscarCol(headers, 'fecha');
        const cTipo = buscarCol(headers, 'tipo de comprobante', 'tipo comprobante', 'tipo');
        const cPV = buscarCol(headers, 'punto de venta', 'punto vta');
        const cNro = buscarCol(headers, 'numero desde', 'número desde', 'numero', 'número');
        const cDoc = buscarCol(headers, 'nro. doc', 'nro doc', 'documento');
        const cNom = buscarCol(headers, 'denominacion', 'denominación', 'razon social');
        const cNeto = buscarCol(headers, 'neto gravado', 'imp. neto gravado', 'neto');
        const cIva = buscarCol(headers, 'iva');
        const cTotal = buscarCol(headers, 'imp. total', 'total');

        const cliente = await db.pool.connect();
        let insertados = 0, leidos = 0;
        try {
            await cliente.query('BEGIN');
            for (const f of filas) {
                const fecha = cFecha >= 0 ? fechaISO(f[cFecha]) : null;
                if (!fecha) continue;
                leidos++;
                const tipoCbte = cTipo >= 0 ? parseInt(String(f[cTipo]).replace(/[^0-9]/g, '')) || null : null;
                const pv = cPV >= 0 ? parseInt(String(f[cPV]).replace(/[^0-9]/g, '')) || null : null;
                const numero = cNro >= 0 ? parseInt(String(f[cNro]).replace(/[^0-9]/g, '')) || null : null;
                const doc = cDoc >= 0 ? String(f[cDoc]).replace(/[^0-9]/g, '').slice(0, 15) : null;
                const nombre = cNom >= 0 ? String(f[cNom]).slice(0, 200) : null;
                const total = cTotal >= 0 ? num(f[cTotal]) : 0;
                const iva = cIva >= 0 ? num(f[cIva]) : 0;
                const neto = cNeto >= 0 ? num(f[cNeto]) : +(total - iva).toFixed(2);
                const r = await cliente.query(`
                    INSERT INTO comprobantes_importados (negocio_id, tipo, fecha, tipo_cbte, punto_venta, numero, cuit_contraparte, nombre_contraparte, neto, iva, total, origen)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'csv')
                    ON CONFLICT (negocio_id, tipo, tipo_cbte, punto_venta, numero, cuit_contraparte) DO NOTHING
                    RETURNING id
                `, [negocioId, tipo, fecha, tipoCbte, pv, numero, doc, nombre, neto, iva, total]);
                if (r.rows[0]) insertados++;
            }
            await cliente.query('COMMIT');
        } catch (e) {
            await cliente.query('ROLLBACK').catch(() => {});
            throw e;
        } finally { cliente.release(); }

        res.json({ ok: true, leidos, insertados, tipo });
    } catch (e) {
        console.error('Error contador/importar:', e);
        res.status(500).json({ error: 'No se pudo importar el archivo. Verificá que sea el CSV de Mis Comprobantes.' });
    }
});

module.exports = router;
