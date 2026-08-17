// =============================================
// ARCHIVO: services/escanerSeguridad.js
// Motor del escáner de auto-auditoría. Recibe una URL de un sistema propio y
// corre pruebas de seguridad NO destructivas, devolviendo los hallazgos como
// datos (para la API/UI del panel Superadmin y para el CLI tools/escaner-seguridad.js).
//
// SOLO para sistemas propios o autorizados. No borra ni modifica datos.
// =============================================

const axios = require('axios');

const SEV_ORDEN = { CRITICA: 5, ALTA: 4, MEDIA: 3, BAJA: 2, INFO: 1, OK: 0 };

// Valida y normaliza la URL objetivo. Rechaza esquemas raros y el endpoint de
// metadatos de la nube (169.254.169.254), que sería el blanco clásico de un SSRF.
function normalizarObjetivo(url) {
    let u;
    try { u = new URL(String(url).trim()); } catch { throw new Error('URL inválida. Ejemplo: http://localhost:3001'); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Solo se permiten URLs http:// o https://');
    if (/^169\.254\./.test(u.hostname) || u.hostname === 'metadata.google.internal') {
        throw new Error('Objetivo no permitido');
    }
    return u.origin;
}

function b64url(obj) {
    return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Ejecuta el escaneo. Devuelve { objetivo, fecha, resumen, hallazgos }.
async function escanear(urlObjetivo, opciones = {}) {
    const OBJETIVO = normalizarObjetivo(urlObjetivo);
    const TIMEOUT = opciones.timeout || 9000;
    const incluirFuerzaBruta = opciones.fuerzaBruta !== false;

    const hallazgos = [];
    const add = (sev, titulo, detalle, recomendacion) => hallazgos.push({ sev, titulo, detalle: detalle || '', recomendacion: recomendacion || '' });

    async function req(method, path, { headers = {}, data, timeout = TIMEOUT } = {}) {
        const t0 = Date.now();
        try {
            const r = await axios({ method, url: OBJETIVO + path, headers, data, timeout, validateStatus: () => true, maxRedirects: 0 });
            return { status: r.status, headers: r.headers, data: r.data, ms: Date.now() - t0 };
        } catch (e) {
            return { status: 0, headers: {}, data: null, ms: Date.now() - t0, err: e.code || e.message };
        }
    }

    // 1) Encabezados de seguridad
    const raiz = await req('GET', '/');
    if (!raiz.status) {
        add('CRITICA', 'El sistema no responde', `No se pudo conectar a ${OBJETIVO} (${raiz.err}).`, 'Verificá que el sistema esté corriendo y que la URL/puerto sean correctos.');
        return armarResultado(OBJETIVO, hallazgos);
    }
    {
        const h = raiz.headers;
        if (!h['strict-transport-security'] && OBJETIVO.startsWith('https')) add('BAJA', 'Falta HSTS', 'No se envía Strict-Transport-Security sobre HTTPS.', 'Activar HSTS (helmet).');
        if (!h['x-content-type-options']) add('BAJA', 'Falta X-Content-Type-Options', 'Permite MIME-sniffing.', 'Agregar "X-Content-Type-Options: nosniff".');
        if (!h['x-frame-options'] && !h['content-security-policy']) add('MEDIA', 'Falta anti-clickjacking', 'Sin X-Frame-Options ni CSP: la app puede embeberse en un iframe (clickjacking).', 'Agregar X-Frame-Options: DENY o CSP frame-ancestors.');
        if (!h['content-security-policy']) add('BAJA', 'Falta Content-Security-Policy', 'Sin CSP se pierde defensa en profundidad ante XSS.', 'Definir una CSP para el frontend.');
        if (h['x-powered-by']) add('BAJA', 'Fuga de tecnología', `Header X-Powered-By: ${h['x-powered-by']}`, 'Ocultar (app.disable("x-powered-by")).');
        if (h['server'] && /\d/.test(h['server'])) add('INFO', 'Banner del servidor', `Server: ${h['server']}`, 'Ocultar la versión del servidor.');
    }

    // 2) JWT falsificado
    {
        const rutas = ['/api/superadmin/negocios', '/api/usuarios', '/api/configuracion'];
        const none = b64url({ alg: 'none', typ: 'JWT' }) + '.' + b64url({ id: 1, rol: 'superadmin', negocio_id: 1 }) + '.';
        const basura = b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url({ id: 1, rol: 'superadmin' }) + '.firmafalsa';
        let aceptado = false;
        for (const ruta of rutas) for (const tok of [none, basura]) {
            const r = await req('GET', ruta, { headers: { Authorization: 'Bearer ' + tok } });
            if (r.status && ![401, 403, 404].includes(r.status)) { aceptado = true; add('CRITICA', 'Token JWT falsificado aceptado', `${ruta} respondió ${r.status} con un token sin firma válida.`, 'Verificar la firma del JWT y no permitir alg=none.'); }
        }
        if (!aceptado) add('OK', 'JWT bien validado', 'Los tokens falsificados (alg=none / firma inválida) son rechazados.', '');
    }

    // 3) Endpoints protegidos sin login
    {
        const protegidas = ['/api/usuarios', '/api/productos', '/api/ventas', '/api/reportes/dashboard', '/api/clientes', '/api/superadmin/negocios', '/api/configuracion'];
        let exp = 0;
        for (const ruta of protegidas) {
            const r = await req('GET', ruta);
            if (r.status && ![401, 403].includes(r.status)) { exp++; add('ALTA', 'Endpoint sin autenticación', `${ruta} respondió ${r.status} SIN token.`, 'Exigir token (verificarToken) en esa ruta.'); }
        }
        if (!exp) add('OK', 'Endpoints protegidos', 'Los endpoints sensibles piden autenticación (401/403 sin token).', '');
    }

    // 4) Inyección SQL en el login
    {
        const base = await req('POST', '/api/auth/login', { data: { username: 'zzz_no_existe', password: 'zzz' } });
        let vuln = false;
        for (const p of ["' OR '1'='1", "admin'--", "' OR 1=1--"]) {
            const r = await req('POST', '/api/auth/login', { data: { username: p, password: p } });
            if (r.status === 200 && r.data && (r.data.token || r.data.usuario)) { vuln = true; add('CRITICA', 'Inyección SQL en login (bypass)', `El payload ${JSON.stringify(p)} logró autenticar.`, 'Usar consultas parametrizadas ($1,$2).'); }
            if (r.status >= 500 && typeof r.data === 'string' && /sql|syntax|pg_|postgres|column/i.test(r.data)) { vuln = true; add('ALTA', 'Error SQL expuesto en login', `El payload ${JSON.stringify(p)} provocó un error SQL visible.`, 'Parametrizar y no exponer el error crudo.'); }
        }
        const t = await req('POST', '/api/auth/login', { data: { username: "x'; SELECT pg_sleep(3)--", password: 'x' }, timeout: 8000 });
        if (t.ms > 2800 && (base.ms || 0) < 1500) { vuln = true; add('CRITICA', 'Posible SQL injection por tiempo', `Un payload con pg_sleep(3) tardó ${t.ms}ms (base ${base.ms}ms).`, 'Parametrizar TODAS las consultas.'); }
        if (!vuln) add('OK', 'Login sin inyección SQL', 'No se detectó bypass ni inyección por error/tiempo en el login.', '');
    }

    // 5) Archivos sensibles expuestos
    {
        const rutas = ['/.env', '/backend/.env', '/.env.local', '/.git/config', '/.git/HEAD', '/package.json', '/backend/package.json', '/.vps-credenciales', '/server.js'];
        let exp = 0;
        for (const ruta of rutas) {
            const r = await req('GET', ruta);
            if (r.status === 200 && r.data && String(r.data).length > 0 && !/<!doctype html|<html/i.test(String(r.data).slice(0, 200))) { exp++; add('CRITICA', 'Archivo sensible expuesto', `${ruta} responde 200 con contenido.`, 'Bloquear el acceso a ese archivo/carpeta desde la web.'); }
        }
        if (!exp) add('OK', 'Sin archivos sensibles expuestos', 'No se accede a .env, .git ni código fuente por la web.', '');
    }

    // 6) CORS
    {
        const origen = 'https://atacante-malicioso.example';
        const r = await req('GET', '/api/publico/precios', { headers: { Origin: origen } });
        const acao = r.headers['access-control-allow-origin'];
        const acac = r.headers['access-control-allow-credentials'];
        if (acao === origen || acao === '*') {
            if (acac === 'true' && acao === origen) add('ALTA', 'CORS peligroso', `Refleja el Origin del atacante (${acao}) con credenciales.`, 'Fijar el origen permitido; no reflejar el Origin.');
            else add('MEDIA', 'CORS permisivo', `Access-Control-Allow-Origin = ${acao}.`, 'Restringir CORS a orígenes conocidos.');
        } else add('OK', 'CORS restringido', 'No refleja orígenes arbitrarios.', '');
    }

    // 7) Credenciales débiles / por defecto
    {
        const combos = [['admin', 'admin'], ['admin', '1234'], ['admin', '123456'], ['admin', 'admin123'], ['superadmin', 'superadmin'], ['test', 'test'], ['admin', 'password']];
        let enc = false;
        for (const [u, p] of combos) {
            const r = await req('POST', '/api/auth/login', { data: { username: u, password: p } });
            if (r.status === 200 && r.data && r.data.token) { enc = true; add('CRITICA', 'Credencial débil/por defecto válida', `Entró con ${u} / ${p}.`, 'Cambiar esa contraseña por una fuerte inmediatamente.'); }
        }
        if (!enc) add('OK', 'Sin credenciales por defecto', 'Ninguna combinación común de usuario/clave funcionó.', '');
    }

    // 8) Fuga de info en errores
    {
        let fuga = false;
        const r1 = await req('POST', '/api/auth/login', { headers: { 'Content-Type': 'application/json' }, data: 'no-json-{{{' });
        const r2 = await req('GET', '/api/reportes/dashboard?fecha_desde=' + encodeURIComponent("'||abc"));
        for (const r of [r1, r2]) {
            const txt = typeof r.data === 'string' ? r.data : JSON.stringify(r.data || '');
            if (/at\s+\/|node_modules|\.js:\d+:\d+|Error:\s.+\n\s+at/i.test(txt)) { fuga = true; add('MEDIA', 'Fuga de información en errores', 'Un error devolvió detalles internos (stack trace / rutas).', 'Devolver mensajes genéricos; loguear el detalle solo del lado del servidor.'); }
        }
        if (!fuga) add('OK', 'Errores sin fuga', 'Los errores no exponen stack traces ni rutas internas.', '');
    }

    // 9) Fuerza bruta (+ evasión por X-Forwarded-For). Al final: puede dejar
    //    usuarios de prueba bloqueados un rato. Se puede saltear con fuerzaBruta:false.
    if (incluirFuerzaBruta) {
        let bloqueoFijo = false;
        for (let i = 0; i < 8; i++) {
            const r = await req('POST', '/api/auth/login', { headers: { 'X-Forwarded-For': '203.0.113.7' }, data: { username: 'usuario_prueba_bruta', password: 'malo' + i } });
            if (r.status === 429) { bloqueoFijo = true; break; }
        }
        if (!bloqueoFijo) add('ALTA', 'Sin freno de fuerza bruta', 'Tras 8 intentos fallidos no aparece bloqueo (429).', 'Agregar lockout por usuario tras N intentos.');
        let bloqueoRot = false;
        for (let i = 0; i < 15; i++) {
            const r = await req('POST', '/api/auth/login', { headers: { 'X-Forwarded-For': '198.51.100.' + i }, data: { username: 'otro_usuario_bruta', password: 'malo' + i } });
            if (r.status === 429) { bloqueoRot = true; break; }
        }
        if (!bloqueoRot) add('ALTA', 'Fuerza bruta evadible por X-Forwarded-For', 'Rotando X-Forwarded-For no se activa ningún bloqueo: la protección se puede evadir.', 'Bloquear por identidad (usuario) además de por IP, y no confiar en X-Forwarded-For arbitrario.');
        if (bloqueoFijo && bloqueoRot) add('OK', 'Freno de fuerza bruta', 'El sistema bloquea intentos repetidos incluso rotando la IP.', '');
    }

    return armarResultado(OBJETIVO, hallazgos);
}

function armarResultado(objetivo, hallazgos) {
    hallazgos.sort((a, b) => SEV_ORDEN[b.sev] - SEV_ORDEN[a.sev]);
    const resumen = {};
    for (const h of hallazgos) resumen[h.sev] = (resumen[h.sev] || 0) + 1;
    return { objetivo, fecha: new Date().toISOString(), resumen, hallazgos };
}

module.exports = { escanear, normalizarObjetivo };
