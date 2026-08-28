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
const { cifrar } = require('../helpers/cripto');
const misComprobantes = require('../services/misComprobantes');

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
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Rango (desde/hasta) de un mes calendario (y, m con m 0-indexado).
function rangoMes(y, m) {
    const p2 = (n) => String(n).padStart(2, '0');
    const ultimo = new Date(y, m + 1, 0).getDate();
    return { desde: `${y}-${p2(m + 1)}-01`, hasta: `${y}-${p2(m + 1)}-${p2(ultimo)}`, periodo: `${y}-${p2(m + 1)}`, label: `${MESES_CORTOS[m]} ${y}` };
}
// Últimos n meses (del más viejo al más nuevo), incluyendo el actual.
function ultimosMeses(n) {
    const hoy = new Date(); const arr = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); arr.push({ y: d.getFullYear(), m: d.getMonth(), ...rangoMes(d.getFullYear(), d.getMonth()) }); }
    return arr;
}
// Vencimiento aproximado de la DDJJ/pago de IVA (Responsable): mes siguiente al
// período, día según la terminación del CUIT. Las fechas exactas las publica AFIP
// cada año y se corren por fines de semana/feriados; esto es una guía.
const DIA_VENC_IVA = { 0: 18, 1: 18, 2: 19, 3: 19, 4: 20, 5: 20, 6: 21, 7: 21, 8: 22, 9: 22 };
function vencimientoIVA(cuit, y, m) {
    const dig = parseInt(String(cuit || '').replace(/\D/g, '').slice(-1));
    const dia = DIA_VENC_IVA[isNaN(dig) ? 0 : dig] || 20;
    return new Date(y, m + 1, dia).toISOString().slice(0, 10);
}
// Vencimiento de la cuota de Monotributo: aprox. el día 20 del propio mes.
function vencimientoMonotributo(y, m) { return new Date(y, m, 20).toISOString().slice(0, 10); }
// Próxima recategorización del monotributo: cierra ~5/feb y ~5/ago (evalúa los
// últimos 12 meses). Las fechas exactas las publica ARCA cada semestre.
function proximaRecategorizacion() {
    const hoy = new Date(), y = hoy.getFullYear();
    const feb = new Date(y, 1, 5), ago = new Date(y, 7, 5);
    const fecha = hoy <= feb ? feb : (hoy <= ago ? ago : new Date(y + 1, 1, 5));
    return fecha.toISOString().slice(0, 10);
}
// CUIT configurado del negocio (para calcular vencimientos por terminación).
async function cuitDelNegocio(negocioId) {
    const r = await db.query('SELECT cuit FROM configuracion WHERE negocio_id = $1', [negocioId]);
    return String(r.rows[0]?.cuit || '').replace(/\D/g, '') || null;
}

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
        const cuit = await cuitDelNegocio(negocioId);
        const [yPer, mPer] = desde.split('-').map(Number);

        // Año en curso (para las tarjetas) y últimos 12 meses (para el tope mono).
        const anio = new Date().getFullYear();
        const ventasAnio = await ventasEnRango(negocioId, `${anio}-01-01`, hoyISO());
        const d12 = new Date(); d12.setMonth(d12.getMonth() - 12);
        const ventas12 = await ventasEnRango(negocioId, d12.toISOString().slice(0, 10), hoyISO());

        let monotributo = null, responsable = null;

        if (cat.regimen === 'monotributista') {
            const topesR = await db.query('SELECT categoria, tope_anual, cuota_servicios, cuota_bienes FROM monotributo_topes ORDER BY tope_anual ASC');
            const topes = topesR.rows.map(t => ({ categoria: t.categoria, tope: +t.tope_anual, cuota_servicios: +t.cuota_servicios || null, cuota_bienes: +t.cuota_bienes || null }));
            const acumulado = ventas12.total;
            // Categoría que le correspondería según lo facturado.
            const sugerida = topes.find(t => acumulado <= t.tope) || topes[topes.length - 1] || null;
            const propia = cat.categoria_monotributo ? topes.find(t => t.categoria === cat.categoria_monotributo) : null;
            // El tope de referencia: el de su categoría declarada, o el de exclusión (última).
            const refCat = propia || sugerida;
            const refTope = propia?.tope || (topes.length ? topes[topes.length - 1].tope : 0);
            const restante = +(refTope - acumulado).toFixed(2);
            const uso = refTope > 0 ? acumulado / refTope : 0;
            const estado = uso >= 0.95 ? 'rojo' : (uso >= 0.80 ? 'amarillo' : 'verde');
            const rateMensual = acumulado / 12;
            const proyeccion_meses = rateMensual > 0 && restante > 0 ? +(restante / rateMensual).toFixed(1) : null;
            monotributo = {
                acumulado_12m: acumulado,
                categoria_declarada: cat.categoria_monotributo || null,
                categoria_sugerida: sugerida?.categoria || null,
                debe_recategorizar: !!(cat.categoria_monotributo && sugerida && sugerida.categoria !== cat.categoria_monotributo),
                tope_referencia: refTope,
                restante,
                uso_pct: +(uso * 100).toFixed(1),
                estado,
                proyeccion_meses,
                cuota_servicios: refCat?.cuota_servicios || null,
                cuota_bienes: refCat?.cuota_bienes || null,
                vencimiento_cuota: vencimientoMonotributo(new Date().getFullYear(), new Date().getMonth()),
                proxima_recategorizacion: proximaRecategorizacion(),
                topes,
            };
        } else {
            const posicion = +(ventas.iva - compras.iva).toFixed(2);
            responsable = {
                iva_debito: ventas.iva,
                iva_credito: compras.iva,
                posicion,
                vencimiento: vencimientoIVA(cuit, yPer, mPer - 1),
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

// GET /api/contador/historico?meses=12 — evolución mes a mes (para el dashboard).
router.get('/historico', async (req, res) => {
    try {
        const negocioId = req.negocio_id || req.usuario?.negocio_id;
        if (!negocioId) return res.status(400).json({ error: 'negocio_id requerido' });
        const n = Math.min(24, Math.max(3, parseInt(req.query.meses) || 12));
        const cat = await obtenerCategoria(negocioId);
        const cuit = await cuitDelNegocio(negocioId);
        const meses = ultimosMeses(n);

        if (cat.regimen === 'monotributista') {
            const topesR = await db.query('SELECT categoria, tope_anual FROM monotributo_topes ORDER BY tope_anual ASC');
            const topes = topesR.rows.map(t => ({ categoria: t.categoria, tope: +t.tope_anual }));
            const propia = cat.categoria_monotributo ? topes.find(t => t.categoria === cat.categoria_monotributo) : null;
            const out = [];
            for (const mi of meses) {
                const facturadoMes = await ventasEnRango(negocioId, mi.desde, mi.hasta);
                const ini12 = new Date(mi.y, mi.m - 11, 1).toISOString().slice(0, 10);
                const ac = await ventasEnRango(negocioId, ini12, mi.hasta);
                const sugerida = topes.find(t => ac.total <= t.tope) || topes[topes.length - 1];
                const refTope = propia?.tope || sugerida?.tope || 0;
                const uso = refTope > 0 ? ac.total / refTope : 0;
                out.push({
                    periodo: mi.periodo, label: mi.label, facturado: facturadoMes.total, acumulado_12m: ac.total,
                    categoria_sugerida: sugerida?.categoria || null, tope: refTope, uso_pct: +(uso * 100).toFixed(1),
                    estado: uso >= 0.95 ? 'rojo' : (uso >= 0.80 ? 'amarillo' : 'verde'),
                });
            }
            return res.json({ regimen: cat.regimen, meses: out });
        }

        // Responsable: posición de IVA mes a mes, arrastrando el saldo a favor técnico.
        let saldoFavor = 0;
        const out = [];
        for (const mi of meses) {
            const v = await ventasEnRango(negocioId, mi.desde, mi.hasta);
            const c = await comprasEnRango(negocioId, mi.desde, mi.hasta);
            const posicion = +(v.iva - c.iva).toFixed(2);
            const saldoPrevio = saldoFavor;
            const neto = +(posicion - saldoPrevio).toFixed(2);
            const aPagar = neto >= 0 ? neto : 0;
            saldoFavor = neto >= 0 ? 0 : +(-neto).toFixed(2);
            out.push({
                periodo: mi.periodo, label: mi.label, ventas_total: v.total, compras_total: c.total,
                iva_debito: v.iva, iva_credito: c.iva, posicion, saldo_favor_previo: saldoPrevio,
                a_pagar: aPagar, saldo_favor: saldoFavor, vencimiento: vencimientoIVA(cuit, mi.y, mi.m),
            });
        }
        res.json({ regimen: cat.regimen, meses: out });
    } catch (e) {
        console.error('Error contador/historico:', e);
        res.status(500).json({ error: 'No se pudo calcular el histórico' });
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

// ================= AFIP Clave Fiscal (automatizar compras) — BETA =================

// GET /api/contador/afip-estado — ¿está configurada la clave fiscal? (sin exponerla)
router.get('/afip-estado', async (req, res) => {
    try {
        const negocioId = req.negocio_id || req.usuario?.negocio_id;
        if (!negocioId) return res.status(400).json({ error: 'negocio_id requerido' });
        const r = await db.query('SELECT cuit, estado, ultima_sync, ultimo_error, (password_cifrado IS NOT NULL) AS configurado FROM afip_clave_fiscal WHERE negocio_id = $1', [negocioId]);
        const cfg = await db.query('SELECT cuit FROM configuracion WHERE negocio_id = $1', [negocioId]);
        const cuitNegocio = String(cfg.rows[0]?.cuit || '').replace(/\D/g, '') || null;
        const x = r.rows[0];
        res.json(x
            ? { configurado: x.configurado, cuit: x.cuit, cuit_negocio: cuitNegocio, estado: x.estado, ultima_sync: x.ultima_sync, ultimo_error: x.ultimo_error }
            : { configurado: false, cuit_negocio: cuitNegocio });
    } catch (e) {
        res.json({ configurado: false });
    }
});

// PUT /api/contador/afip-credenciales — guardar (cifradas) CUIT + usuario + clave
router.put('/afip-credenciales', async (req, res) => {
    try {
        const negocioId = req.negocio_id || req.usuario?.negocio_id;
        if (!negocioId) return res.status(400).json({ error: 'negocio_id requerido' });
        const cuit = String(req.body?.cuit || '').replace(/\D/g, '');
        const usuario = req.body?.usuario ? String(req.body.usuario) : cuit;
        const password = req.body?.password ? String(req.body.password) : null;
        if (!cuit || !password) return res.status(400).json({ error: 'Ingresá tu CUIT y clave fiscal' });
        await db.query(`
            INSERT INTO afip_clave_fiscal (negocio_id, cuit, usuario_cifrado, password_cifrado, estado, ultimo_error, updated_at)
            VALUES ($1, $2, $3, $4, 'configurado', NULL, NOW())
            ON CONFLICT (negocio_id) DO UPDATE SET cuit = $2, usuario_cifrado = $3, password_cifrado = $4, estado = 'configurado', ultimo_error = NULL, updated_at = NOW()
        `, [negocioId, cuit, cifrar(usuario), cifrar(password)]);
        res.json({ ok: true });
    } catch (e) {
        console.error('Error guardando clave fiscal:', e.message);
        res.status(500).json({ error: 'No se pudo guardar la clave fiscal' });
    }
});

// DELETE /api/contador/afip-credenciales — desvincular
router.delete('/afip-credenciales', async (req, res) => {
    try {
        const negocioId = req.negocio_id || req.usuario?.negocio_id;
        if (!negocioId) return res.status(400).json({ error: 'negocio_id requerido' });
        await db.query('DELETE FROM afip_clave_fiscal WHERE negocio_id = $1', [negocioId]);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'No se pudo desvincular' });
    }
});

// POST /api/contador/sincronizar-compras — bajar recibidos de Mis Comprobantes (BETA)
router.post('/sincronizar-compras', async (req, res) => {
    const negocioId = req.negocio_id || req.usuario?.negocio_id;
    if (!negocioId) return res.status(400).json({ error: 'negocio_id requerido' });
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.desde || '') ? req.body.desde : `${new Date().getFullYear()}-01-01`;
    const hasta = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.hasta || '') ? req.body.hasta : hoyISO();
    try {
        const comprobantes = await misComprobantes.sincronizarRecibidos(negocioId, desde, hasta);
        let insertados = 0;
        const cliente = await db.pool.connect();
        try {
            await cliente.query('BEGIN');
            for (const c of (comprobantes || [])) {
                const r = await cliente.query(`
                    INSERT INTO comprobantes_importados (negocio_id, tipo, fecha, tipo_cbte, punto_venta, numero, cuit_contraparte, nombre_contraparte, neto, iva, total, origen)
                    VALUES ($1,'recibido',$2,$3,$4,$5,$6,$7,$8,$9,$10,'afip')
                    ON CONFLICT (negocio_id, tipo, tipo_cbte, punto_venta, numero, cuit_contraparte) DO NOTHING
                    RETURNING id
                `, [negocioId, c.fecha, c.tipo_cbte, c.punto_venta, c.numero, c.cuit_contraparte, c.nombre_contraparte, c.neto || 0, c.iva || 0, c.total || 0]);
                if (r.rows[0]) insertados++;
            }
            await cliente.query('COMMIT');
        } catch (e) { await cliente.query('ROLLBACK').catch(() => {}); throw e; } finally { cliente.release(); }
        await db.query('UPDATE afip_clave_fiscal SET estado = $2, ultima_sync = NOW(), ultimo_error = NULL WHERE negocio_id = $1', [negocioId, 'ok']);
        res.json({ ok: true, insertados, leidos: (comprobantes || []).length });
    } catch (e) {
        const msg = e.message || 'Error desconocido';
        await db.query('UPDATE afip_clave_fiscal SET estado = $2, ultimo_error = $3 WHERE negocio_id = $1', [negocioId, 'error', msg.slice(0, 500)]).catch(() => {});
        res.status(422).json({ ok: false, error: msg });
    }
});

module.exports = router;
