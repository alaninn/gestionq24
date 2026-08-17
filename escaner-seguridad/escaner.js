/* =============================================================================
 * ESCÁNER DE SEGURIDAD — herramienta independiente (sin levantar la app)
 *
 * Se abre con doble clic en "Escaner-Seguridad.bat". Levanta un mini panel en el
 * navegador (http://127.0.0.1:7333) donde ponés una o varias URLs, elegís qué
 * pruebas correr, y ves el informe de errores/vulnerabilidades en pantalla.
 *
 * No usa dependencias externas (solo módulos propios de Node) ni la base de datos
 * ni el resto del sistema: es un programa aparte.
 *
 * ⚠️  USALO SOLO contra sistemas que sean TUYOS o para los que tengas permiso.
 * ============================================================================= */

'use strict';
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { exec } = require('child_process');

const SEV_ORDEN = { CRITICA: 5, ALTA: 4, MEDIA: 3, BAJA: 2, INFO: 1, OK: 0 };

// ---------------------------------------------------------------------------
// Cliente HTTP con módulos propios de Node (soporta http/https, self-signed).
// Nunca lanza: devuelve el resultado o el error para poder analizarlo.
// ---------------------------------------------------------------------------
function pedir(method, urlStr, { headers = {}, body, timeout = 9000 } = {}) {
    return new Promise((resolve) => {
        let u;
        try { u = new URL(urlStr); } catch { return resolve({ status: 0, headers: {}, data: '', ms: 0, err: 'URL inválida' }); }
        const lib = u.protocol === 'https:' ? https : http;
        const t0 = Date.now();
        const opts = {
            method,
            hostname: u.hostname,
            port: u.port || (u.protocol === 'https:' ? 443 : 80),
            path: u.pathname + u.search,
            headers: Object.assign({ 'User-Agent': 'EscanerSeguridad/1.0', 'Accept': '*/*' }, headers),
            timeout,
            rejectUnauthorized: false, // permitir certificados self-signed al escanear
        };
        if (body != null && !opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
        const req = lib.request(opts, (res) => {
            let data = '';
            res.on('data', (c) => { if (data.length < 200000) data += c; });
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data, ms: Date.now() - t0 }));
        });
        req.on('error', (e) => resolve({ status: 0, headers: {}, data: '', ms: Date.now() - t0, err: e.code || e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, headers: {}, data: '', ms: Date.now() - t0, err: 'timeout' }); });
        if (body != null) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

function b64url(obj) {
    return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function jsonBody(data) { try { return typeof data === 'string' ? JSON.parse(data) : data; } catch { return null; } }

// ¿El objetivo tiene un endpoint de login tipo /api/auth/login? Las pruebas de
// login (fuerza bruta, SQLi, credenciales) solo tienen sentido si existe: contra
// un sistema que no lo tiene darían falsos positivos.
async function loginAplica(base, req) {
    const r = await req('POST', base + '/api/auth/login', { body: { username: '__probe__', password: '__probe__' } });
    if (!r.status || r.status === 404) return false;
    const esHtml = /<html|<!doctype/i.test(String(r.data).slice(0, 200));
    if (r.status === 200 && esHtml) return false; // devolvió una página, no el endpoint
    return true;
}
function omitidaLogin(add, nombre) {
    add('INFO', `${nombre}: no aplica`, 'No se encontró un endpoint de login tipo /api/auth/login en este sistema, así que la prueba se omitió (evita falsos positivos).', 'Esta prueba es para sistemas con ese login (ej. gestionq24/burgerpos).');
}

// ---------------------------------------------------------------------------
// Pruebas. Cada una recibe (base, add) y agrega hallazgos.
// ---------------------------------------------------------------------------
const PRUEBAS = {
    recon: async (base, add, req) => {
        const r = await req('GET', base + '/');
        if (!r.status) { add('CRITICA', 'El sistema no responde', `No se pudo conectar (${r.err}).`, 'Verificá la URL/puerto y que el sistema esté online.'); return false; }
        const titulo = (String(r.data).match(/<title>([^<]{1,120})<\/title>/i) || [])[1];
        add('INFO', 'Sistema accesible', `Respondió HTTP ${r.status} en ${r.ms}ms${titulo ? ` · título: "${titulo.trim()}"` : ''}${r.headers.server ? ` · server: ${r.headers.server}` : ''}.`, '');
        return true;
    },
    headers: async (base, add, req) => {
        const r = await req('GET', base + '/');
        const h = r.headers || {};
        const https = base.startsWith('https');
        if (https && !h['strict-transport-security']) add('BAJA', 'Falta HSTS', 'No envía Strict-Transport-Security sobre HTTPS.', 'Activar HSTS.');
        if (!h['x-content-type-options']) add('BAJA', 'Falta X-Content-Type-Options', 'Permite MIME-sniffing.', 'Agregar "nosniff".');
        if (!h['x-frame-options'] && !h['content-security-policy']) add('MEDIA', 'Falta anti-clickjacking', 'Sin X-Frame-Options ni CSP: se puede embeber en iframe.', 'X-Frame-Options: DENY o CSP frame-ancestors.');
        if (!h['content-security-policy']) add('BAJA', 'Falta Content-Security-Policy', 'Sin CSP se pierde defensa ante XSS.', 'Definir una CSP.');
        if (h['x-powered-by']) add('BAJA', 'Fuga de tecnología', `X-Powered-By: ${h['x-powered-by']}`, 'Ocultarlo.');
        if (!PRUEBAS._huboProblema(add)) add('OK', 'Encabezados de seguridad', 'Los encabezados principales están presentes.', '');
    },
    jwt: async (base, add, req) => {
        const rutas = ['/api/superadmin/negocios', '/api/usuarios', '/api/configuracion', '/api/admin', '/admin'];
        const none = b64url({ alg: 'none', typ: 'JWT' }) + '.' + b64url({ id: 1, rol: 'superadmin' }) + '.';
        const basura = b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url({ id: 1, rol: 'superadmin' }) + '.firmafalsa';
        let aceptado = false;
        for (const ruta of rutas) for (const tok of [none, basura]) {
            const r = await req('GET', base + ruta, { headers: { Authorization: 'Bearer ' + tok } });
            if (r.status && ![401, 403, 404, 0].includes(r.status)) { aceptado = true; add('CRITICA', 'Token JWT falsificado aceptado', `${ruta} respondió ${r.status} con un token sin firma válida.`, 'Verificar la firma y no permitir alg=none.'); }
        }
        if (!aceptado) add('OK', 'JWT bien validado', 'Los tokens falsificados son rechazados (o no hay endpoints JWT).', '');
    },
    authz: async (base, add, req) => {
        const protegidas = ['/api/usuarios', '/api/productos', '/api/ventas', '/api/reportes/dashboard', '/api/clientes', '/api/superadmin/negocios', '/api/configuracion'];
        let exp = 0;
        for (const ruta of protegidas) {
            const r = await req('GET', base + ruta);
            if (r.status && ![401, 403, 404, 0].includes(r.status)) { exp++; add('ALTA', 'Endpoint sin autenticación', `${ruta} respondió ${r.status} SIN token.`, 'Exigir autenticación en esa ruta.'); }
        }
        if (!exp) add('OK', 'Endpoints protegidos', 'Los endpoints sensibles piden autenticación.', '');
    },
    sqli: async (base, add, req) => {
        if (!(await loginAplica(base, req))) return omitidaLogin(add, 'Inyección SQL (login)');
        const b = await req('POST', base + '/api/auth/login', { body: { username: 'zzz_no_existe', password: 'zzz' } });
        let vuln = false;
        for (const p of ["' OR '1'='1", "admin'--", "' OR 1=1--"]) {
            const r = await req('POST', base + '/api/auth/login', { body: { username: p, password: p } });
            const j = jsonBody(r.data);
            if (r.status === 200 && j && (j.token || j.usuario)) { vuln = true; add('CRITICA', 'Inyección SQL en login (bypass)', `El payload ${JSON.stringify(p)} logró autenticar.`, 'Usar consultas parametrizadas.'); }
            if (r.status >= 500 && /sql|syntax|pg_|postgres|column|mysql|sqlite/i.test(String(r.data))) { vuln = true; add('ALTA', 'Error SQL expuesto', `El payload ${JSON.stringify(p)} provocó un error SQL visible.`, 'Parametrizar y no exponer el error.'); }
        }
        const t = await req('POST', base + '/api/auth/login', { body: { username: "x'; SELECT pg_sleep(3)--", password: 'x' }, timeout: 8000 });
        if (t.ms > 2800 && (b.ms || 0) < 1500) { vuln = true; add('CRITICA', 'Posible SQLi por tiempo', `Un pg_sleep(3) tardó ${t.ms}ms (base ${b.ms}ms).`, 'Parametrizar TODAS las consultas.'); }
        if (!vuln) add('OK', 'Login sin inyección SQL', 'No se detectó inyección en /api/auth/login (o no existe ese endpoint).', '');
    },
    archivos: async (base, add, req) => {
        const rutas = ['/.env', '/backend/.env', '/.env.local', '/.git/config', '/.git/HEAD', '/package.json', '/backend/package.json', '/.vps-credenciales', '/server.js', '/config.php', '/wp-config.php', '/.htpasswd', '/phpinfo.php'];
        let exp = 0;
        for (const ruta of rutas) {
            const r = await req('GET', base + ruta);
            if (r.status === 200 && r.data && String(r.data).length > 0 && !/<!doctype html|<html/i.test(String(r.data).slice(0, 200))) { exp++; add('CRITICA', 'Archivo sensible expuesto', `${ruta} responde 200 con contenido.`, 'Bloquear el acceso web a ese archivo.'); }
        }
        if (!exp) add('OK', 'Sin archivos sensibles expuestos', 'No se accede a .env, .git, config ni claves por la web.', '');
    },
    cors: async (base, add, req) => {
        const origen = 'https://atacante-malicioso.example';
        const r = await req('GET', base + '/api/publico/precios', { headers: { Origin: origen } });
        const acao = r.headers['access-control-allow-origin'];
        const acac = r.headers['access-control-allow-credentials'];
        if (acao === origen || acao === '*') {
            if (acac === 'true' && acao === origen) add('ALTA', 'CORS peligroso', `Refleja el Origin del atacante con credenciales.`, 'Fijar el origen permitido; no reflejarlo.');
            else add('MEDIA', 'CORS permisivo', `Access-Control-Allow-Origin = ${acao}.`, 'Restringir a orígenes conocidos.');
        } else add('OK', 'CORS restringido', 'No refleja orígenes arbitrarios.', '');
    },
    credenciales: async (base, add, req) => {
        if (!(await loginAplica(base, req))) return omitidaLogin(add, 'Credenciales por defecto');
        const combos = [['admin', 'admin'], ['admin', '1234'], ['admin', '123456'], ['admin', 'admin123'], ['superadmin', 'superadmin'], ['test', 'test'], ['admin', 'password']];
        let enc = false;
        for (const [u, p] of combos) {
            const r = await req('POST', base + '/api/auth/login', { body: { username: u, password: p } });
            const j = jsonBody(r.data);
            if (r.status === 200 && j && j.token) { enc = true; add('CRITICA', 'Credencial débil/por defecto válida', `Entró con ${u} / ${p}.`, 'Cambiar esa contraseña ya.'); }
        }
        if (!enc) add('OK', 'Sin credenciales por defecto', 'Ninguna combinación común funcionó.', '');
    },
    errores: async (base, add, req) => {
        let fuga = false;
        const r1 = await req('POST', base + '/api/auth/login', { headers: { 'Content-Type': 'application/json' }, body: 'no-json-{{{' });
        const r2 = await req('GET', base + '/api/reportes/dashboard?fecha_desde=' + encodeURIComponent("'||abc"));
        for (const r of [r1, r2]) {
            if (/at\s+\/|node_modules|\.js:\d+:\d+|Error:\s.+\n\s+at|Traceback|Exception/i.test(String(r.data))) { fuga = true; add('MEDIA', 'Fuga de información en errores', 'Un error devolvió detalles internos (stack trace / rutas).', 'Devolver mensajes genéricos.'); }
        }
        if (!fuga) add('OK', 'Errores sin fuga', 'Los errores no exponen stack traces ni rutas internas.', '');
    },
    metodos: async (base, add, req) => {
        const r = await req('OPTIONS', base + '/');
        const allow = r.headers['allow'] || r.headers['access-control-allow-methods'] || '';
        if (/TRACE/i.test(allow)) add('BAJA', 'Método TRACE habilitado', `Allow: ${allow}`, 'Deshabilitar TRACE (riesgo de Cross-Site Tracing).');
        if (/PUT|DELETE/i.test(allow)) add('INFO', 'Métodos de escritura visibles', `Allow: ${allow}`, 'Confirmar que PUT/DELETE estén protegidos.');
        add('OK', 'Métodos HTTP', `Métodos permitidos: ${allow || '(no informado)'}`, '');
    },
    fuerzabruta: async (base, add, req) => {
        if (!(await loginAplica(base, req))) return omitidaLogin(add, 'Fuerza bruta');
        let fijo = false;
        for (let i = 0; i < 8; i++) { const r = await req('POST', base + '/api/auth/login', { headers: { 'X-Forwarded-For': '203.0.113.7' }, body: { username: 'usuario_prueba_bruta', password: 'malo' + i } }); if (r.status === 429) { fijo = true; break; } }
        if (!fijo) add('ALTA', 'Sin freno de fuerza bruta', 'Tras 8 intentos fallidos no aparece bloqueo (429).', 'Agregar lockout por usuario.');
        let rot = false;
        for (let i = 0; i < 15; i++) { const r = await req('POST', base + '/api/auth/login', { headers: { 'X-Forwarded-For': '198.51.100.' + i }, body: { username: 'otro_usuario_bruta', password: 'malo' + i } }); if (r.status === 429) { rot = true; break; } }
        if (!rot) add('ALTA', 'Fuerza bruta evadible por X-Forwarded-For', 'Rotando X-Forwarded-For no se activa bloqueo.', 'Bloquear por identidad además de por IP.');
        if (fijo && rot) add('OK', 'Freno de fuerza bruta', 'Bloquea intentos repetidos incluso rotando la IP.', '');
    },
    _huboProblema: () => false,
};

async function escanear(urlObjetivo, metodos) {
    let base;
    try { const u = new URL(urlObjetivo); if (!/^https?:$/.test(u.protocol)) throw 0; base = u.origin; }
    catch { return { objetivo: urlObjetivo, error: 'URL inválida. Ejemplo: https://tu-sistema.com o http://localhost:3001' }; }

    const hallazgos = [];
    const add = (sev, titulo, detalle, recomendacion) => hallazgos.push({ sev, titulo, detalle: detalle || '', recomendacion: recomendacion || '' });
    const req = (m, u, o) => pedir(m, u, o);

    // recon primero; si no responde, cortamos.
    const vivo = await PRUEBAS.recon(base, add, req);
    if (vivo) {
        const orden = ['headers', 'jwt', 'authz', 'sqli', 'archivos', 'cors', 'credenciales', 'errores', 'metodos', 'fuerzabruta'];
        for (const m of orden) {
            if (metodos.includes(m) && PRUEBAS[m]) {
                try { await PRUEBAS[m](base, add, req); } catch (e) { add('INFO', `Error corriendo prueba "${m}"`, e.message, ''); }
            }
        }
    }
    hallazgos.sort((a, b) => SEV_ORDEN[b.sev] - SEV_ORDEN[a.sev]);
    const resumen = {};
    for (const h of hallazgos) resumen[h.sev] = (resumen[h.sev] || 0) + 1;
    return { objetivo: base, fecha: new Date().toISOString(), resumen, hallazgos };
}

// ---------------------------------------------------------------------------
// Servidor local + interfaz
// ---------------------------------------------------------------------------
const PAGINA = require('./ui');

function servir(puerto) {
    const server = http.createServer(async (req, res) => {
        if (req.url === '/' || req.url.startsWith('/index')) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(PAGINA);
        }
        if (req.url.startsWith('/scan')) {
            const q = new URL(req.url, 'http://x').searchParams;
            const url = q.get('url') || '';
            const metodos = (q.get('metodos') || '').split(',').filter(Boolean);
            const resultado = await escanear(url, metodos);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify(resultado));
        }
        res.writeHead(404); res.end('not found');
    });
    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE' && puerto < 7343) return servir(puerto + 1);
        console.error('No se pudo iniciar:', e.message); process.exit(1);
    });
    // Solo escucha en localhost (no expuesto a la red).
    server.listen(puerto, '127.0.0.1', () => {
        const url = `http://127.0.0.1:${puerto}`;
        console.log('\n  ================================================');
        console.log('   ESCÁNER DE SEGURIDAD listo');
        console.log('   Abrí en el navegador:  ' + url);
        console.log('   (para cerrar, cerrá esta ventana)');
        console.log('  ================================================\n');
        // Abrir el navegador automáticamente (Windows).
        exec(`start "" "${url}"`, () => {});
    });
}

servir(7333);
