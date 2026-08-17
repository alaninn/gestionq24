#!/usr/bin/env node
/* =============================================================================
 * ESCÁNER DE SEGURIDAD (auto-auditoría) — GestionQ24 / uso propio
 *
 * Corré una batería de pruebas de seguridad NO destructivas contra un sistema
 * TUYO que tengas corriendo, y te devuelve un informe de vulnerabilidades.
 *
 *   USO:
 *     cd backend
 *     node tools/escaner-seguridad.js http://localhost:3001
 *     node tools/escaner-seguridad.js http://localhost:4000   (otro sistema tuyo, ej. burgerpos)
 *
 *   Genera un informe en pantalla y lo guarda en tools/informe-seguridad-<fecha>.md
 *
 * ⚠️  USALO SOLO contra sistemas que sean TUYOS o para los que tengas permiso
 *     explícito. Escanear sistemas de terceros sin autorización es ilegal.
 *
 * Qué prueba (todo de forma no destructiva: no borra ni modifica datos):
 *   - Encabezados de seguridad (HSTS, CSP, anti-clickjacking, fuga de versión)
 *   - JWT falsificado (alg=none / firma inválida) aceptado
 *   - Endpoints protegidos accesibles sin login
 *   - Inyección SQL en el login (por error y por tiempo)
 *   - Freno de fuerza bruta y si se evade rotando X-Forwarded-For
 *   - Archivos sensibles expuestos (.env, .git, backups, etc.)
 *   - CORS mal configurado (refleja cualquier origen)
 *   - Credenciales débiles/por defecto
 *   - Fuga de información en errores (stack traces)
 * ============================================================================= */

const axios = require('axios');

const TARGET = (process.argv[2] || 'http://localhost:3001').replace(/\/+$/, '');
const TIMEOUT = 12000;

const hallazgos = [];
function add(sev, titulo, detalle, recomendacion) {
    hallazgos.push({ sev, titulo, detalle, recomendacion });
}
const SEV = { CRITICA: 5, ALTA: 4, MEDIA: 3, BAJA: 2, INFO: 1, OK: 0 };

// Cliente HTTP que nunca tira excepción (para poder analizar cualquier respuesta).
async function req(method, path, { headers = {}, data, timeout = TIMEOUT } = {}) {
    const t0 = Date.now();
    try {
        const r = await axios({
            method, url: TARGET + path, headers, data, timeout,
            validateStatus: () => true, maxRedirects: 0,
        });
        return { status: r.status, headers: r.headers, data: r.data, ms: Date.now() - t0 };
    } catch (e) {
        return { status: 0, headers: {}, data: null, ms: Date.now() - t0, err: e.code || e.message };
    }
}

function b64url(obj) {
    return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// 1) Encabezados de seguridad
// ---------------------------------------------------------------------------
async function chequearEncabezados() {
    const r = await req('GET', '/');
    if (!r.status) { add('CRITICA', 'El sistema no responde', `No se pudo conectar a ${TARGET} (${r.err}).`, 'Verificá que el sistema esté corriendo y la URL/puerto sean correctos.'); return; }
    const h = r.headers;
    if (!h['strict-transport-security'] && TARGET.startsWith('https')) add('BAJA', 'Falta HSTS', 'No se envía Strict-Transport-Security sobre HTTPS.', 'Activar HSTS (helmet strictTransportSecurity).');
    if (!h['x-content-type-options']) add('BAJA', 'Falta X-Content-Type-Options', 'Permite MIME-sniffing.', 'Agregar "X-Content-Type-Options: nosniff" (helmet lo hace).');
    if (!h['x-frame-options'] && !h['content-security-policy']) add('MEDIA', 'Falta anti-clickjacking', 'Sin X-Frame-Options ni CSP frame-ancestors: la app puede embeberse en un iframe (clickjacking).', 'Agregar X-Frame-Options: DENY o CSP frame-ancestors.');
    if (!h['content-security-policy']) add('BAJA', 'Falta Content-Security-Policy', 'Sin CSP se pierde defensa en profundidad ante XSS.', 'Definir una CSP para el frontend.');
    if (h['x-powered-by']) add('BAJA', 'Fuga de tecnología', `Header X-Powered-By: ${h['x-powered-by']}`, 'Ocultar con app.disable("x-powered-by") o helmet.');
    if (h['server'] && /\d/.test(h['server'])) add('INFO', 'Banner del servidor', `Server: ${h['server']}`, 'Ocultar la versión del servidor.');
}

// ---------------------------------------------------------------------------
// 2) JWT falsificado (alg=none / firma inválida)
// ---------------------------------------------------------------------------
async function chequearJWT() {
    const rutasAdmin = ['/api/superadmin/negocios', '/api/usuarios', '/api/configuracion'];
    const none = b64url({ alg: 'none', typ: 'JWT' }) + '.' + b64url({ id: 1, rol: 'superadmin', negocio_id: 1 }) + '.';
    const basura = b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url({ id: 1, rol: 'superadmin' }) + '.firmafalsa';
    let aceptado = false;
    for (const ruta of rutasAdmin) {
        for (const tok of [none, basura]) {
            const r = await req('GET', ruta, { headers: { Authorization: 'Bearer ' + tok } });
            if (r.status && r.status !== 401 && r.status !== 403 && r.status !== 404) { aceptado = true; add('CRITICA', 'Token JWT falsificado aceptado', `${ruta} respondió ${r.status} con un token sin firma válida.`, 'Verificar la firma del JWT y NO permitir alg=none (jwt.verify con algorithms fijos).'); }
        }
    }
    if (!aceptado) add('OK', 'JWT bien validado', 'Los tokens falsificados (alg=none / firma inválida) son rechazados.', null);
}

// ---------------------------------------------------------------------------
// 3) Endpoints protegidos sin login
// ---------------------------------------------------------------------------
async function chequearAuthRequerida() {
    const protegidas = ['/api/usuarios', '/api/productos', '/api/ventas', '/api/reportes/dashboard', '/api/clientes', '/api/superadmin/negocios', '/api/configuracion'];
    let expuestas = 0;
    for (const ruta of protegidas) {
        const r = await req('GET', ruta);
        if (r.status && r.status !== 401 && r.status !== 403) { expuestas++; add('ALTA', 'Endpoint sin autenticación', `${ruta} respondió ${r.status} SIN token.`, 'Exigir token (verificarToken) en esa ruta.'); }
    }
    if (!expuestas) add('OK', 'Endpoints protegidos', 'Los endpoints sensibles piden autenticación (401/403 sin token).', null);
}

// ---------------------------------------------------------------------------
// 4) Inyección SQL en el login
// ---------------------------------------------------------------------------
async function chequearSQLi() {
    // Base de tiempo: un login normal fallido
    const base = await req('POST', '/api/auth/login', { data: { username: 'zzz_no_existe', password: 'zzz' } });
    const payloadsError = ["' OR '1'='1", "admin'--", "' OR 1=1--", "\"; DROP TABLE x;--"];
    let vuln = false;
    for (const p of payloadsError) {
        const r = await req('POST', '/api/auth/login', { data: { username: p, password: p } });
        if (r.status === 200 && r.data && (r.data.token || r.data.usuario)) { vuln = true; add('CRITICA', 'Inyección SQL en login (bypass)', `El payload ${JSON.stringify(p)} logró autenticar.`, 'Usar consultas parametrizadas ($1,$2) — nunca concatenar entrada del usuario.'); }
        if (r.status >= 500 && typeof r.data === 'string' && /sql|syntax|pg_|postgres|column/i.test(r.data)) { vuln = true; add('ALTA', 'Error SQL expuesto en login', `El payload ${JSON.stringify(p)} provocó un error SQL visible.`, 'Parametrizar consultas y no exponer el error crudo.'); }
    }
    // Base de tiempo (blind): pg_sleep
    const t = await req('POST', '/api/auth/login', { data: { username: "x'; SELECT pg_sleep(3)--", password: 'x' }, timeout: 8000 });
    if (t.ms > 2800 && (base.ms || 0) < 1500) { vuln = true; add('CRITICA', 'Posible SQL injection por tiempo', `Un payload con pg_sleep(3) tardó ${t.ms}ms (base ${base.ms}ms).`, 'Parametrizar TODAS las consultas.'); }
    if (!vuln) add('OK', 'Login sin inyección SQL', 'No se detectó bypass ni inyección por error/tiempo en el login.', null);
}

// ---------------------------------------------------------------------------
// 5) Fuerza bruta / rate limiting (+ evasión por X-Forwarded-For)
// ---------------------------------------------------------------------------
async function chequearFuerzaBruta() {
    // 8 intentos con IP fija: ¿llega a bloquear (429)?
    let bloqueoFijo = false;
    for (let i = 0; i < 8; i++) {
        const r = await req('POST', '/api/auth/login', { headers: { 'X-Forwarded-For': '203.0.113.7' }, data: { username: 'usuario_prueba_bruta', password: 'malo' + i } });
        if (r.status === 429) { bloqueoFijo = true; break; }
    }
    if (!bloqueoFijo) add('ALTA', 'Sin freno de fuerza bruta', 'Tras 8 intentos fallidos no aparece bloqueo (429).', 'Agregar lockout por usuario tras N intentos.');

    // Rotando X-Forwarded-For: ¿se puede seguir intentando? (evasión)
    let bloqueoRot = false;
    for (let i = 0; i < 15; i++) {
        const r = await req('POST', '/api/auth/login', { headers: { 'X-Forwarded-For': '198.51.100.' + i }, data: { username: 'otro_usuario_bruta', password: 'malo' + i } });
        if (r.status === 429) { bloqueoRot = true; break; }
    }
    if (!bloqueoRot) add('ALTA', 'Fuerza bruta evadible por X-Forwarded-For', 'Rotando el header X-Forwarded-For no se activa ningún bloqueo: la protección se puede evadir.', 'Bloquear por identidad (usuario) además de por IP, y no confiar en X-Forwarded-For arbitrario.');
    if (bloqueoFijo && bloqueoRot) add('OK', 'Freno de fuerza bruta', 'El sistema bloquea intentos repetidos incluso rotando la IP.', null);
}

// ---------------------------------------------------------------------------
// 6) Archivos / rutas sensibles expuestos
// ---------------------------------------------------------------------------
async function chequearArchivosSensibles() {
    const rutas = ['/.env', '/backend/.env', '/.env.local', '/.git/config', '/.git/HEAD', '/package.json', '/backend/package.json', '/config.json', '/.vps-credenciales', '/backups', '/uploads/', '/server.js'];
    let exp = 0;
    for (const ruta of rutas) {
        const r = await req('GET', ruta);
        if (r.status === 200 && r.data && String(r.data).length > 0 && !/<!doctype html|<html/i.test(String(r.data).slice(0, 200))) {
            exp++; add('CRITICA', 'Archivo sensible expuesto', `${ruta} responde 200 con contenido.`, 'Bloquear el acceso a ese archivo/carpeta desde la web.');
        }
    }
    if (!exp) add('OK', 'Sin archivos sensibles expuestos', 'No se accede a .env, .git, backups ni código fuente por la web.', null);
}

// ---------------------------------------------------------------------------
// 7) CORS mal configurado
// ---------------------------------------------------------------------------
async function chequearCORS() {
    const origen = 'https://atacante-malicioso.example';
    const r = await req('GET', '/api/publico/precios', { headers: { Origin: origen } });
    const acao = r.headers['access-control-allow-origin'];
    const acac = r.headers['access-control-allow-credentials'];
    if (acao === origen || acao === '*') {
        if (acac === 'true' && acao === origen) add('ALTA', 'CORS peligroso', `Refleja el Origin del atacante (${acao}) con credenciales.`, 'Fijar el origen permitido a tu dominio; no reflejar el Origin.');
        else add('MEDIA', 'CORS permisivo', `Access-Control-Allow-Origin = ${acao}.`, 'Restringir CORS a orígenes conocidos.');
    } else {
        add('OK', 'CORS restringido', 'No refleja orígenes arbitrarios.', null);
    }
}

// ---------------------------------------------------------------------------
// 8) Credenciales débiles / por defecto
// ---------------------------------------------------------------------------
async function chequearCredencialesDebiles() {
    const combos = [
        ['admin', 'admin'], ['admin', '1234'], ['admin', '123456'], ['admin', 'admin123'],
        ['superadmin', 'superadmin'], ['test', 'test'], ['cajero', 'cajero'], ['admin', 'password'],
    ];
    let encontrada = false;
    for (const [u, p] of combos) {
        const r = await req('POST', '/api/auth/login', { data: { username: u, password: p } });
        if (r.status === 200 && r.data && r.data.token) { encontrada = true; add('CRITICA', 'Credencial débil/por defecto válida', `Entró con ${u} / ${p}.`, 'Cambiar esa contraseña por una fuerte inmediatamente.'); }
    }
    if (!encontrada) add('OK', 'Sin credenciales por defecto', 'Ninguna combinación común de usuario/clave funcionó.', null);
}

// ---------------------------------------------------------------------------
// 9) Fuga de información en errores (stack traces)
// ---------------------------------------------------------------------------
async function chequearFugaErrores() {
    const pruebas = [
        ['POST', '/api/auth/login', 'no-json-{{{'],
        ['GET', '/api/reportes/dashboard?fecha_desde=' + encodeURIComponent("'||abc")],
    ];
    let fuga = false;
    for (const [m, ruta, body] of pruebas) {
        const r = await req(m, ruta, { headers: { 'Content-Type': 'application/json' }, data: body });
        const txt = typeof r.data === 'string' ? r.data : JSON.stringify(r.data || '');
        if (/at\s+\/|node_modules|\.js:\d+:\d+|stack|Error:\s.+\n\s+at/i.test(txt)) { fuga = true; add('MEDIA', 'Fuga de información en errores', `${ruta} devolvió detalles internos (stack trace / rutas).`, 'Devolver mensajes genéricos; loguear el detalle solo del lado del servidor.'); }
    }
    if (!fuga) add('OK', 'Errores sin fuga', 'Los errores no exponen stack traces ni rutas internas.', null);
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------
function imprimirInforme() {
    const orden = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA', 'INFO', 'OK'];
    const emoji = { CRITICA: '🟥', ALTA: '🟧', MEDIA: '🟨', BAJA: '🟦', INFO: '⬜', OK: '🟩' };
    hallazgos.sort((a, b) => SEV[b.sev] - SEV[a.sev]);
    const problemas = hallazgos.filter(h => h.sev !== 'OK');

    let out = `# Informe de seguridad — ${TARGET}\n\nFecha: ${new Date().toLocaleString('es-AR')}\n\n`;
    const conteo = {};
    for (const h of hallazgos) conteo[h.sev] = (conteo[h.sev] || 0) + 1;
    out += 'Resumen: ' + orden.filter(s => conteo[s]).map(s => `${emoji[s]} ${s}: ${conteo[s]}`).join('  ·  ') + '\n\n';

    if (problemas.length === 0) out += '✅ No se detectaron vulnerabilidades en las pruebas realizadas.\n\n';
    for (const h of hallazgos) {
        out += `## ${emoji[h.sev]} [${h.sev}] ${h.titulo}\n`;
        if (h.detalle) out += `${h.detalle}\n`;
        if (h.recomendacion) out += `**Recomendación:** ${h.recomendacion}\n`;
        out += '\n';
    }

    console.log('\n' + out);
    try {
        const fs = require('fs'); const path = require('path');
        const nombre = `informe-seguridad-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
        const dest = path.join(__dirname, nombre);
        fs.writeFileSync(dest, out);
        console.log(`📄 Informe guardado en: ${dest}\n`);
    } catch (e) { /* si no se puede escribir, con la salida en pantalla alcanza */ }
}

(async () => {
    console.log(`\n🔎 Escaneando ${TARGET} ...`);
    console.log('   (pruebas no destructivas — usá esto solo en sistemas propios)\n');
    await chequearEncabezados();
    if (hallazgos.some(h => h.titulo === 'El sistema no responde')) { imprimirInforme(); process.exit(1); }
    await chequearJWT();
    await chequearAuthRequerida();
    await chequearSQLi();
    await chequearArchivosSensibles();
    await chequearCORS();
    await chequearCredencialesDebiles();
    await chequearFugaErrores();
    await chequearFuerzaBruta(); // al final: puede dejar cuentas de prueba bloqueadas un rato
    imprimirInforme();
    process.exit(0);
})();
