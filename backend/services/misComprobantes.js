// =============================================
// SERVICIO (BETA): "Mis Comprobantes" de AFIP por Clave Fiscal.
// AFIP no tiene web service oficial para comprobantes RECIBIDOS (compras), así
// que se automatiza entrando al portal con la clave fiscal del negocio.
// El login está verificado empíricamente; la bajada de datos se calibra contra
// una cuenta real. Best-effort: si hay 2FA/captcha o AFIP cambia, falla con un
// error descriptivo. La clave fiscal NUNCA se loguea.
// =============================================

const axios = require('axios');
const db = require('../config/database');
const { descifrar } = require('../helpers/cripto');

const AUTH_BASE = 'https://auth.afip.gob.ar';
const AUTH_LOGIN = AUTH_BASE + '/contribuyente_/login.xhtml';
const PORTAL = 'https://portalcf.cloud.afip.gob.ar';
const FES = 'https://fes.afip.gob.ar';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Importe en formato AR ("1.234,56") -> número.
const numAR = (v) => { const n = parseFloat(String(v || '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
const dmy2iso = (s) => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const iso2dmy = (s) => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : s; };

// --- Manejo manual de cookies (sin dependencias extra) ---
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

const viewState = (html) => {
    const m = String(html).match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/i);
    return m ? m[1] : null;
};
const formAction = (html) => {
    const m = String(html).match(/<form[^>]*action="([^"]+)"/i);
    if (!m) return null;
    return m[1].startsWith('http') ? m[1] : AUTH_BASE + m[1];
};
const hiddenInputs = (html) => [...String(html).matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi)];

// Inicia sesión en AFIP con la clave fiscal. Devuelve el jar autenticado
// (cookies AFIPBG + AFIPSID) o lanza con un error claro. Flujo verificado.
async function loginAfip(cuit, usuario, password) {
    const jar = crearJar();
    const req = (config) => axios({
        ...config, maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 500,
        timeout: 25000,
        headers: { 'User-Agent': UA, 'Cookie': jar.header(), ...(config.headers || {}) },
    });
    const post = (url, fields) => req({
        method: 'POST', url, data: new URLSearchParams(fields).toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    // 1) Página de login.
    let r = await req({ method: 'GET', url: AUTH_LOGIN });
    jar.set(r.headers['set-cookie']);
    let vs = viewState(r.data);
    let action = formAction(r.data) || AUTH_LOGIN;
    if (!vs) throw new Error('No se pudo leer el formulario de login de AFIP.');

    // 2) Usuario (CUIT) -> página de contraseña.
    r = await post(action, { 'F1': 'F1', 'F1:username': String(usuario || cuit), 'F1:btnSiguiente': 'Siguiente', 'javax.faces.ViewState': vs });
    jar.set(r.headers['set-cookie']);
    if (/usuario inexistente|no est[aá] registrado/i.test(String(r.data))) throw new Error('El CUIT/usuario no es válido en AFIP.');
    vs = viewState(r.data) || vs;
    action = formAction(r.data) || action;

    // 3) Contraseña -> setea AFIPBG si es correcta.
    r = await post(action, { 'F1': 'F1', 'F1:captcha': '', 'F1:username': String(usuario || cuit), 'F1:password': String(password), 'F1:btnIngresar': 'Ingresar', 'javax.faces.ViewState': vs });
    jar.set(r.headers['set-cookie']);
    const cuerpo = String(r.data || '');
    if (/clave.*incorrecta|no coincide|datos incorrectos|contrase[ñn]a.*incorrecta/i.test(cuerpo)) throw new Error('Clave fiscal incorrecta.');
    if (/segundo factor|c[oó]digo de seguridad|autenticaci[oó]n.*dos pasos/i.test(cuerpo)) throw new Error('Tu clave fiscal pide segundo factor (2FA). No se puede automatizar; usá el CSV.');
    if (!jar.has('AFIPBG')) throw new Error('AFIP no confirmó el login (revisá CUIT/clave, o si tenés 2FA).');

    // 4) SSO al portal (form auto-submit) -> setea AFIPSID.
    const sso = formAction(r.data);
    if (sso) {
        const campos = {}; hiddenInputs(r.data).forEach(m => { campos[m[1]] = m[2]; });
        r = await post(sso, campos);
        jar.set(r.headers['set-cookie']);
        const loc = r.headers['location'];
        if (loc) { const u = loc.startsWith('http') ? loc : new URL(sso).origin + loc; const r2 = await req({ method: 'GET', url: u }); jar.set(r2.headers['set-cookie']); }
    }
    return jar;
}

// Baja los comprobantes RECIBIDOS del período desde "Mis Comprobantes" (fes).
// Flujo (reverse-engineered): activar portal -> pedir token/sign de acceso al
// servicio mcmp -> POST token/sign a fes (SSO) -> setear contribuyente ->
// generarConsulta (t=R) -> listaResultados. Devuelve el array de comprobantes.
async function bajarRecibidos(jar, cuit, desde, hasta) {
    const put = (h) => jar.set(h);
    const req = (c) => axios({ maxRedirects: 0, timeout: 25000, validateStatus: (s) => s < 600, headers: { 'User-Agent': UA, Cookie: jar.header(), ...(c.headers || {}) }, ...c });

    // Activar la sesión del portal.
    await req({ method: 'GET', url: PORTAL + '/portal/app/' }).then(x => put(x.headers['set-cookie'])).catch(() => {});

    // Token/sign de acceso al servicio (el endpoint es intermitente: reintentos).
    let aut = null;
    for (let i = 0; i < 5 && !aut; i++) {
        await req({ method: 'GET', url: `${PORTAL}/portal/api/servicios/${cuit}`, headers: { Referer: PORTAL + '/portal/app/', Accept: 'application/json' } }).then(x => put(x.headers['set-cookie'])).catch(() => {});
        const a = await req({ method: 'GET', url: `${PORTAL}/portal/api/servicios/${cuit}/servicio/mcmp/autorizacion`, headers: { Referer: PORTAL + '/portal/app/', Accept: 'application/json' } });
        if (a.status === 200 && a.data) { try { aut = typeof a.data === 'object' ? a.data : JSON.parse(a.data); } catch { /* reintenta */ } }
        if (!aut) await sleep(2000);
    }
    if (!aut || !aut.token || !aut.sign) throw new Error('AFIP no autorizó el acceso a Mis Comprobantes (probá de nuevo en unos minutos).');

    // SSO al servicio de Mis Comprobantes (POST token/sign) y seguir redirects.
    let r = await req({ method: 'POST', url: FES + '/mcmp/jsp/index.do', data: new URLSearchParams({ token: aut.token, sign: aut.sign }).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    put(r.headers['set-cookie']);
    let loc = r.headers['location'];
    for (let i = 0; i < 6 && loc; i++) { const u = loc.startsWith('http') ? loc : FES + loc; r = await req({ method: 'GET', url: u }); put(r.headers['set-cookie']); loc = r.headers['location']; }

    // Setear el contribuyente representado (para el propio CUIT alcanza idContribuyente=0).
    await req({ method: 'GET', url: FES + '/mcmp/jsp/setearContribuyente.do?idContribuyente=0' }).then(x => put(x.headers['set-cookie'])).catch(() => {});

    // Generar la consulta de RECIBIDOS y traer las filas.
    const rango = `${iso2dmy(desde)} - ${iso2dmy(hasta)}`;
    const g = await req({ method: 'GET', url: FES + '/mcmp/jsp/ajax.do', params: { f: 'generarConsulta', t: 'R', fechaEmision: rango, tiposComprobantes: '', cuitConsultada: cuit }, headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: FES + '/mcmp/jsp/comprobantesRecibidos.do' } });
    let gj; try { gj = typeof g.data === 'object' ? g.data : JSON.parse(g.data); } catch { /* */ }
    const idc = gj?.datos?.idConsulta;
    if (!idc) throw new Error('No se pudo generar la consulta en Mis Comprobantes (revisá que el servicio esté adherido a tu clave fiscal).');

    const l = await req({ method: 'GET', url: FES + '/mcmp/jsp/ajax.do', params: { f: 'listaResultados', id: idc }, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    let lj; try { lj = typeof l.data === 'object' ? l.data : JSON.parse(l.data); } catch { /* */ }
    const data = lj?.datos?.data;
    if (!Array.isArray(data)) return [];

    // Mapeo de columnas (Mis Comprobantes RECIBIDOS): el "Emisor" es el proveedor.
    return data.map((row) => ({
        fecha: dmy2iso(row[0]),
        tipo_cbte: parseInt(String(row[1] || '').replace(/\D/g, '')) || null,
        punto_venta: parseInt(row[3]) || null,
        numero: parseInt(row[4]) || null,
        cuit_contraparte: String(row[11] || '').replace(/\D/g, '').slice(0, 15) || null,
        nombre_contraparte: String(row[12] || '').slice(0, 200) || null,
        neto: numAR(row[15]),
        iva: numAR(row[21]),
        total: numAR(row[23]),
    })).filter((c) => c.fecha);
}

// Orquesta: descifra credenciales, entra a AFIP y baja los recibidos.
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

module.exports = { sincronizarRecibidos, loginAfip, crearJar };
