// =============================================
// SERVICIO (BETA): "Mis Comprobantes" de AFIP por Clave Fiscal.
// AFIP no tiene web service oficial para comprobantes RECIBIDOS (compras), así
// que se automatiza entrando al portal con la clave fiscal del negocio y bajando
// los recibidos. Es best-effort: si el negocio tiene 2FA, captcha, o AFIP cambia
// el flujo, falla con un error descriptivo (que se guarda para diagnosticar).
// El texto plano de la clave fiscal NUNCA se loguea.
// =============================================

const axios = require('axios');
const db = require('../config/database');
const { descifrar } = require('../helpers/cripto');

const AUTH_LOGIN = 'https://auth.afip.gob.ar/contribuyente_/login.xhtml';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

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
    };
}

const extraerViewState = (html) => {
    const m = String(html).match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/i)
        || String(html).match(/id="javax\.faces\.ViewState[^"]*"[^>]*value="([^"]+)"/i);
    return m ? m[1] : null;
};

// Inicia sesión en AFIP con la clave fiscal. Devuelve el jar autenticado o lanza.
async function loginAfip(cuit, usuario, password) {
    const jar = crearJar();
    const req = (config) => axios({
        ...config,
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
        timeout: 20000,
        headers: { 'User-Agent': UA, 'Cookie': jar.header(), ...(config.headers || {}) },
    });

    // 1) Página de login (ViewState + cookies).
    let resp = await req({ method: 'GET', url: AUTH_LOGIN });
    jar.set(resp.headers['set-cookie']);
    let vs = extraerViewState(resp.data);
    if (!vs) throw new Error('No se pudo leer el formulario de login de AFIP (paso 1).');

    // 2) Enviar el usuario (CUIT).
    const form1 = new URLSearchParams({
        'F1': 'F1', 'F1:username': String(usuario || cuit),
        'F1:btnSiguiente': 'Siguiente', 'javax.faces.ViewState': vs,
    });
    resp = await req({
        method: 'POST', url: AUTH_LOGIN, data: form1.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    jar.set(resp.headers['set-cookie']);
    vs = extraerViewState(resp.data) || vs;

    // 3) Enviar la contraseña.
    const form2 = new URLSearchParams({
        'F1': 'F1', 'F1:username': String(usuario || cuit), 'F1:password': String(password),
        'F1:btnIngresar': 'Ingresar', 'javax.faces.ViewState': vs,
    });
    resp = await req({
        method: 'POST', url: AUTH_LOGIN, data: form2.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    jar.set(resp.headers['set-cookie']);

    const cuerpo = String(resp.data || '');
    if (/clave.*incorrecta|usuario o clave|datos incorrectos/i.test(cuerpo)) {
        throw new Error('CUIT o clave fiscal incorrectos.');
    }
    if (/segundo factor|c[oó]digo de seguridad|autenticaci[oó]n en dos pasos|token/i.test(cuerpo)) {
        throw new Error('Tu clave fiscal pide segundo factor (2FA). La automatización no puede continuar; usá el CSV.');
    }
    // Si no hay cookies de sesión de AFIP, probablemente no autenticó.
    if (!jar.header().length) throw new Error('AFIP no devolvió una sesión válida tras el login.');
    return jar;
}

// Intenta bajar los comprobantes RECIBIDOS del período. Este paso depende del
// endpoint interno de "Mis Comprobantes", que puede variar; ante cualquier
// problema lanza con detalle para poder ajustarlo con una cuenta real.
async function bajarRecibidos(jar, cuit, desde, hasta) {
    // NOTA: el endpoint de datos de Mis Comprobantes requiere ajustarse contra
    // una respuesta real de AFIP. Se deja el intento y el error queda registrado.
    throw new Error('La conexión con AFIP funcionó, pero la bajada automática de compras todavía se está afinando (beta). Por ahora usá el CSV de abajo.');
}

// Orquesta todo: descifra credenciales, entra a AFIP y baja los recibidos.
// Devuelve un array de comprobantes { fecha, tipo_cbte, punto_venta, numero,
// cuit_contraparte, nombre_contraparte, neto, iva, total }.
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

module.exports = { sincronizarRecibidos, loginAfip };
