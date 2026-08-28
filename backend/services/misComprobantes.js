// =============================================
// SERVICIO (BETA): "Mis Comprobantes" de AFIP por Clave Fiscal.
// AFIP no tiene web service oficial para comprobantes RECIBIDOS (compras), así
// que se automatiza entrando al portal con la clave fiscal del negocio.
// Flujo (reverse-engineered): login clave fiscal -> portal -> token/sign del
// servicio mcmp -> SSO a fes.afip.gob.ar -> ajax.do (generarConsulta/listaResultados).
// La clave fiscal NUNCA se loguea. Best-effort: 2FA/captcha/cambios de AFIP -> error claro.
// =============================================

const axios = require('axios');
const db = require('../config/database');
const { descifrar } = require('../helpers/cripto');

const AUTH_BASE = 'https://auth.afip.gob.ar';
const AUTH_LOGIN = AUTH_BASE + '/contribuyente_/login.xhtml';
const PORTAL = 'https://portalcf.cloud.afip.gob.ar';
const FES = 'https://fes.afip.gob.ar';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Parsea importes tanto en formato AR ("1.234,56") como con punto decimal ("1234.56").
const num = (v) => {
    let s = String(v ?? '').trim().replace(/[^0-9.,\-]/g, '');
    if (!s) return 0;
    const d = s.includes('.'), c = s.includes(',');
    if (d && c) s = (s.lastIndexOf(',') > s.lastIndexOf('.')) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (c) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
};
const dmy2iso = (s) => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const iso2dmy = (s) => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : s; };

// --- Cookie jar plano. El flujo SSO de AFIP comparte cookies entre sus hosts
// (auth / portalcf / fes), así que se reenvían todas; un jar por-dominio rompe
// el SSO (no se llega a setear AFIPSID). Los parámetros host se ignoran. ---
function crearJar() {
    const cookies = {};
    return {
        set(setCookieHeaders) {
            for (const sc of (setCookieHeaders || [])) {
                const par = sc.split(';')[0];
                const i = par.indexOf('=');
                if (i > 0) cookies[par.slice(0, i).trim()] = par.slice(i + 1).trim();
            }
        },
        header() { return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '); },
        has(name) { return name in cookies; },
    };
}

// Request con cookies scopeadas por host (sin seguir redirects automáticamente).
async function pedir(jar, config) {
    const host = new URL(config.url).host;
    const resp = await axios({
        maxRedirects: 0, timeout: 25000, validateStatus: (s) => s < 600,
        ...config,
        headers: { 'User-Agent': UA, 'Cookie': jar.header(host), ...(config.headers || {}) },
    });
    jar.set(resp.headers['set-cookie'], host);
    return resp;
}
const postForm = (jar, url, fields, extra) => pedir(jar, { method: 'POST', url, data: new URLSearchParams(fields).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(extra || {}) } });

const viewState = (h) => { const m = String(h).match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/i); return m ? m[1] : null; };
const formAction = (h) => { const m = String(h).match(/<form[^>]*action="([^"]+)"/i); return m ? (m[1].startsWith('http') ? m[1] : AUTH_BASE + m[1]) : null; };
const hiddenInputs = (h) => [...String(h).matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi)];

// Login con clave fiscal. Devuelve el jar autenticado (AFIPBG + AFIPSID) o lanza.
async function loginAfip(cuit, usuario, password) {
    const jar = crearJar();
    // 1) Página de login.
    let r = await pedir(jar, { method: 'GET', url: AUTH_LOGIN });
    let vs = viewState(r.data), action = formAction(r.data) || AUTH_LOGIN;
    if (!vs) throw new Error('No se pudo leer el formulario de login de AFIP.');
    // 2) Usuario -> página de contraseña.
    r = await postForm(jar, action, { 'F1': 'F1', 'F1:username': String(usuario || cuit), 'F1:btnSiguiente': 'Siguiente', 'javax.faces.ViewState': vs });
    if (/usuario inexistente|no est[aá] registrado/i.test(String(r.data))) throw new Error('El CUIT/usuario no es válido en AFIP.');
    vs = viewState(r.data) || vs; action = formAction(r.data) || action;
    // 3) Contraseña -> AFIPBG.
    r = await postForm(jar, action, { 'F1': 'F1', 'F1:captcha': '', 'F1:username': String(usuario || cuit), 'F1:password': String(password), 'F1:btnIngresar': 'Ingresar', 'javax.faces.ViewState': vs });
    const cuerpo = String(r.data || '');
    if (/clave.*incorrecta|no coincide|datos incorrectos|contrase[ñn]a.*incorrecta/i.test(cuerpo)) throw new Error('Clave fiscal incorrecta.');
    if (/segundo factor|c[oó]digo de seguridad|autenticaci[oó]n.*dos pasos/i.test(cuerpo)) throw new Error('Tu clave fiscal pide segundo factor (2FA). No se puede automatizar; usá el CSV.');
    if (!jar.has('AFIPBG')) throw new Error('AFIP no confirmó el login (revisá CUIT/clave, o si tenés 2FA).');
    // 4) SSO al portal -> AFIPSID.
    const sso = formAction(r.data);
    if (sso) {
        const campos = {}; hiddenInputs(r.data).forEach((m) => { campos[m[1]] = m[2]; });
        r = await postForm(jar, sso, campos);
        let loc = r.headers['location'];
        for (let i = 0; i < 4 && loc; i++) { const u = loc.startsWith('http') ? loc : new URL(sso).origin + loc; r = await pedir(jar, { method: 'GET', url: u }); loc = r.headers['location']; }
    }
    return jar;
}

// Baja los comprobantes RECIBIDOS del período desde "Mis Comprobantes".
async function bajarRecibidos(jar, cuit, desde, hasta) {
    // Activar portal.
    await pedir(jar, { method: 'GET', url: PORTAL + '/portal/app/' }).catch(() => {});
    // token/sign de acceso al servicio mcmp (reintentos por si el portal tarda en activar).
    let aut = null;
    for (let i = 0; i < 5 && !aut; i++) {
        await pedir(jar, { method: 'GET', url: `${PORTAL}/portal/api/servicios/${cuit}`, headers: { Referer: PORTAL + '/portal/app/', Accept: 'application/json' } }).catch(() => {});
        const a = await pedir(jar, { method: 'GET', url: `${PORTAL}/portal/api/servicios/${cuit}/servicio/mcmp/autorizacion`, headers: { Referer: PORTAL + '/portal/app/', Accept: 'application/json' } });
        if (a.status === 200 && a.data) { try { aut = typeof a.data === 'object' ? a.data : JSON.parse(a.data); } catch { /* reintenta */ } }
        if (!aut) await sleep(1500);
    }
    if (!aut || !aut.token || !aut.sign) throw new Error('AFIP no autorizó el acceso a Mis Comprobantes (probá de nuevo en unos minutos).');

    // SSO al servicio (POST token/sign) + seguir redirects.
    let r = await postForm(jar, FES + '/mcmp/jsp/index.do', { token: aut.token, sign: aut.sign });
    let loc = r.headers['location'];
    for (let i = 0; i < 6 && loc; i++) { const u = loc.startsWith('http') ? loc : FES + loc; r = await pedir(jar, { method: 'GET', url: u }); loc = r.headers['location']; }
    // Setear contribuyente (para el propio CUIT alcanza idContribuyente=0).
    await pedir(jar, { method: 'GET', url: FES + '/mcmp/jsp/setearContribuyente.do?idContribuyente=0' }).catch(() => {});

    // generarConsulta (RECIBIDOS) + listaResultados.
    const rango = `${iso2dmy(desde)} - ${iso2dmy(hasta)}`;
    const g = await pedir(jar, { method: 'GET', url: FES + '/mcmp/jsp/ajax.do', params: { f: 'generarConsulta', t: 'R', fechaEmision: rango, tiposComprobantes: '', cuitConsultada: cuit }, headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: FES + '/mcmp/jsp/comprobantesRecibidos.do' } });
    let gj; try { gj = typeof g.data === 'object' ? g.data : JSON.parse(g.data); } catch { /* */ }
    const idc = gj?.datos?.idConsulta;
    if (!idc) throw new Error('No se pudo generar la consulta en Mis Comprobantes (revisá que el servicio esté adherido a tu clave fiscal).');

    const l = await pedir(jar, { method: 'GET', url: FES + '/mcmp/jsp/ajax.do', params: { f: 'listaResultados', id: idc }, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    let lj; try { lj = typeof l.data === 'object' ? l.data : JSON.parse(l.data); } catch { /* */ }
    const data = lj?.datos?.data;
    if (!Array.isArray(data)) return [];

    // Mapeo de columnas de RECIBIDOS (el "Emisor" es el proveedor). Importes en
    // pesos: 48=IVA discriminado (solo Factura A), 50=total. El neto se deriva como
    // total - IVA para que siempre reconcilie (en Factura B/C el IVA no se computa).
    return data.map((row) => {
        const total = num(row[50]);
        const iva = num(row[48]);
        return {
            fecha: dmy2iso(row[0]),
            tipo_cbte: parseInt(String(row[1] || '').replace(/\D/g, '')) || null,
            punto_venta: parseInt(row[3]) || null,
            numero: parseInt(row[4]) || null,
            cuit_contraparte: String(row[11] || '').replace(/\D/g, '').slice(0, 15) || null,
            nombre_contraparte: String(row[12] || '').slice(0, 200) || null,
            neto: Math.round((total - iva) * 100) / 100,
            iva,
            total,
        };
    }).filter((c) => c.fecha);
}

async function sincronizarRecibidos(negocioId, desde, hasta) {
    const r = await db.query('SELECT cuit, usuario_cifrado, password_cifrado FROM afip_clave_fiscal WHERE negocio_id = $1', [negocioId]);
    const cred = r.rows[0];
    if (!cred || !cred.password_cifrado) throw new Error('No hay clave fiscal configurada para este negocio.');
    const cuit = String(cred.cuit || '').replace(/\D/g, '');
    const usuario = descifrar(cred.usuario_cifrado) || cuit;
    const password = descifrar(cred.password_cifrado);
    if (!password) throw new Error('No se pudo leer la clave fiscal guardada.');
    const jar = await loginAfip(cuit, usuario, password);
    return await bajarRecibidos(jar, cuit, desde, hasta);
}

module.exports = { sincronizarRecibidos, loginAfip, bajarRecibidos, crearJar };
