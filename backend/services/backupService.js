// =============================================
// SERVICIO: Backup automático de la base de datos
// Hace un dump diario de PostgreSQL con pg_dump, rota los archivos viejos y
// (si hay token) sube una copia a GitHub — así, si el disco del VPS falla, el
// respaldo sigue disponible y se puede levantar el sistema en otro lado.
//
// Configuración por .env (todo opcional):
//   BACKUP_ENABLED=true|false        (default: true)
//   BACKUP_HORA=3                    (hora del backup diario, default 3 AM; corre a las :30)
//   BACKUP_RETENER=14                (backups locales a conservar, default 14)
//
//   BACKUP_GIT_ENABLED=true|false    (default: true si hay GITHUB_TOKEN)
//   GITHUB_TOKEN=...                 (PAT con permiso de contenidos sobre el repo)
//   GITHUB_REPO=alaninn/gestionq24   (default)
//   GITHUB_BACKUP_BRANCH=backups     (rama aparte donde se guardan los .dump; default)
//   GITHUB_BACKUP_RETENER=30         (dumps a conservar en GitHub, default 30)
//
//   BACKUP_CIFRADO_CLAVE=...         (frase para cifrar el dump antes de subirlo,
//                                     AES-256-GCM. MUY recomendado: el repo puede
//                                     ser público. Sin esta clave NO se sube a
//                                     GitHub salvo BACKUP_GIT_PERMITIR_SIN_CIFRAR=true)
//   BACKUP_GIT_PERMITIR_SIN_CIFRAR=true   (subir el dump en claro; usar solo con repo privado)
//
// RECUPERACIÓN ante caída del VPS:
//   git clone -b backups https://github.com/alaninn/gestionq24 recuperado
//   node backend/scripts/restaurar-backup.js recuperado/db/backup_...dump.enc  (si está cifrado)
//   pg_restore -d almacenq24 backup_...dump
// =============================================

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const schedule = require('node-schedule');
const axios = require('axios');

const BACKUP_DIR = path.join(__dirname, '../backups');

// Carpeta dentro de la rama de backups donde viven los .dump
const GIT_BACKUP_DIR = 'db';
const GH_API = 'https://api.github.com';

function asegurarDirectorio() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

/**
 * Ejecuta pg_dump y genera un backup comprimido (formato custom de PostgreSQL).
 * Se restaura con: pg_restore -d <base> <archivo>
 * Al terminar, rota los locales y —si está configurado— sube la copia a GitHub.
 * @returns {Promise<{archivo: string, bytes: number, github: object}>}
 */
function hacerBackup() {
    return new Promise((resolve, reject) => {
        asegurarDirectorio();

        const fecha = new Date();
        const stamp = fecha.toISOString().replace(/[:T]/g, '-').slice(0, 16); // 2026-06-11-03-30
        const nombre = `backup_${process.env.DB_NAME || 'almacenq24'}_${stamp}.dump`;
        const destino = path.join(BACKUP_DIR, nombre);

        const args = [
            '-h', process.env.DB_HOST || 'localhost',
            '-p', String(process.env.DB_PORT || 5432),
            '-U', process.env.DB_USER || 'postgres',
            '-Fc',              // formato custom comprimido
            '-f', destino,
            process.env.DB_NAME || 'almacenq24',
        ];

        const proceso = spawn('pg_dump', args, {
            env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || '' },
        });

        let stderr = '';
        proceso.stderr.on('data', d => { stderr += d.toString(); });

        proceso.on('error', (err) => {
            // pg_dump no instalado / no está en el PATH
            reject(new Error(`No se pudo ejecutar pg_dump: ${err.message}`));
        });

        proceso.on('close', async (code) => {
            if (code !== 0) {
                // Limpiar archivo a medias
                try { if (fs.existsSync(destino)) fs.unlinkSync(destino); } catch {}
                return reject(new Error(`pg_dump terminó con código ${code}: ${stderr.slice(0, 300)}`));
            }
            const bytes = fs.existsSync(destino) ? fs.statSync(destino).size : 0;
            if (bytes === 0) {
                try { if (fs.existsSync(destino)) fs.unlinkSync(destino); } catch {}
                return reject(new Error('El backup quedó vacío'));
            }
            rotarBackups();

            // Subida a GitHub: best-effort. Nunca hace fallar el backup local.
            let github = { subido: false, motivo: 'no intentado' };
            try {
                github = await subirBackupAGitHub(destino, nombre);
            } catch (e) {
                github = { subido: false, motivo: e.message };
            }

            resolve({ archivo: nombre, bytes, github });
        });
    });
}

/** Borra los backups locales más viejos, conservando los últimos N */
function rotarBackups() {
    try {
        const retener = parseInt(process.env.BACKUP_RETENER) || 14;
        const archivos = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup_') && f.endsWith('.dump'))
            .sort()       // el nombre incluye la fecha → orden cronológico
            .reverse();   // más nuevos primero

        for (const viejo of archivos.slice(retener)) {
            fs.unlinkSync(path.join(BACKUP_DIR, viejo));
            console.log(`🧹 Backup viejo eliminado: ${viejo}`);
        }
    } catch (e) {
        console.error('Error rotando backups:', e.message);
    }
}

/** Lista los backups locales existentes (más nuevos primero) */
function listarBackups() {
    asegurarDirectorio();
    return fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup_') && f.endsWith('.dump'))
        .sort().reverse()
        .map(f => {
            const stat = fs.statSync(path.join(BACKUP_DIR, f));
            return { archivo: f, bytes: stat.size, fecha: stat.mtime };
        });
}

/** Ruta absoluta de un backup local, validando el nombre (sin path traversal) */
function rutaBackup(nombre) {
    if (!/^backup_[\w.-]+\.dump$/.test(nombre)) return null;
    const ruta = path.join(BACKUP_DIR, nombre);
    return fs.existsSync(ruta) ? ruta : null;
}

// ============================================================
// SUBIDA A GITHUB (copia externa del backup)
// ============================================================

function configGit() {
    const token = process.env.GITHUB_TOKEN;
    const habilitado = process.env.BACKUP_GIT_ENABLED !== 'false' && !!token;
    return {
        habilitado,
        token,
        repo: process.env.GITHUB_REPO || 'alaninn/gestionq24',
        rama: process.env.GITHUB_BACKUP_BRANCH || 'backups',
        retener: parseInt(process.env.GITHUB_BACKUP_RETENER) || 30,
        clave: process.env.BACKUP_CIFRADO_CLAVE || null,
        permitirSinCifrar: process.env.BACKUP_GIT_PERMITIR_SIN_CIFRAR === 'true',
    };
}

// Cifra un archivo con AES-256-GCM (clave derivada de la frase con scrypt).
// Formato del .enc:  magic(8) | salt(16) | iv(12) | authTag(16) | ciphertext
// Se descifra con backend/scripts/restaurar-backup.js
function cifrarArchivo(rutaEntrada, rutaSalida, frase) {
    const plano = fs.readFileSync(rutaEntrada);
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = crypto.scryptSync(frase, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plano), cipher.final()]);
    const tag = cipher.getAuthTag();
    fs.writeFileSync(rutaSalida, Buffer.concat([Buffer.from('GQ24BK01'), salt, iv, tag, enc]));
}

function ghHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'gestionq24-backup',
    };
}

/** Se asegura de que exista la rama de backups; la crea desde la rama por defecto si falta. */
async function asegurarRama({ token, repo, rama }) {
    const headers = ghHeaders(token);
    try {
        await axios.get(`${GH_API}/repos/${repo}/git/ref/heads/${rama}`, { headers, timeout: 15000 });
        return; // ya existe
    } catch (e) {
        if (e.response?.status !== 404) throw e;
    }
    // No existe: crearla apuntando al HEAD de la rama por defecto.
    const repoInfo = await axios.get(`${GH_API}/repos/${repo}`, { headers, timeout: 15000 });
    const base = repoInfo.data.default_branch;
    const ref = await axios.get(`${GH_API}/repos/${repo}/git/ref/heads/${base}`, { headers, timeout: 15000 });
    await axios.post(`${GH_API}/repos/${repo}/git/refs`,
        { ref: `refs/heads/${rama}`, sha: ref.data.object.sha },
        { headers, timeout: 15000 });
    console.log(`🌿 Rama de backups "${rama}" creada en ${repo}`);
}

/** Deja en GitHub solo los últimos N dumps. */
async function rotarBackupsGitHub({ token, repo, rama, retener }) {
    const headers = ghHeaders(token);
    let lista;
    try {
        const r = await axios.get(
            `${GH_API}/repos/${repo}/contents/${GIT_BACKUP_DIR}?ref=${rama}`,
            { headers, timeout: 15000 });
        lista = Array.isArray(r.data) ? r.data : [];
    } catch (e) {
        if (e.response?.status === 404) return; // carpeta aún vacía
        throw e;
    }
    const dumps = lista
        .filter(x => x.type === 'file' && x.name.startsWith('backup_') && /\.dump(\.enc)?$/.test(x.name))
        .sort((a, b) => (a.name < b.name ? 1 : -1)); // más nuevos primero (el nombre lleva la fecha)

    for (const viejo of dumps.slice(retener)) {
        try {
            await axios.delete(`${GH_API}/repos/${repo}/contents/${viejo.path}`, {
                headers, timeout: 15000,
                data: { message: `rotacion backups: elimina ${viejo.name}`, sha: viejo.sha, branch: rama },
            });
            console.log(`🧹 Backup viejo eliminado de GitHub: ${viejo.name}`);
        } catch (e) {
            console.error(`No se pudo borrar ${viejo.name} de GitHub:`, e.response?.data?.message || e.message);
        }
    }
}

/**
 * Sube un .dump a la rama de backups del repo. Best-effort.
 * @returns {Promise<{subido: boolean, url?: string, motivo?: string}>}
 */
async function subirBackupAGitHub(rutaArchivo, nombre) {
    const cfg = configGit();
    if (!cfg.habilitado) {
        return { subido: false, motivo: cfg.token ? 'BACKUP_GIT_ENABLED=false' : 'sin GITHUB_TOKEN' };
    }

    // Cifrado: el repo puede ser público, así que por defecto NO se sube en claro.
    let rutaSubir = rutaArchivo;
    let nombreSubir = nombre;
    let cifrado = false;
    let tmpEnc = null;
    if (cfg.clave) {
        tmpEnc = rutaArchivo + '.enc';
        cifrarArchivo(rutaArchivo, tmpEnc, cfg.clave);
        rutaSubir = tmpEnc;
        nombreSubir = nombre + '.enc';
        cifrado = true;
    } else if (!cfg.permitirSinCifrar) {
        return { subido: false, motivo: 'sin BACKUP_CIFRADO_CLAVE (no se sube en claro; poné la clave o BACKUP_GIT_PERMITIR_SIN_CIFRAR=true si el repo es privado)' };
    }

    try {
        const bytes = fs.statSync(rutaSubir).size;
        // La API de contenidos manda el archivo en base64 dentro del JSON. Por
        // arriba de ~45 MB conviene otra vía; por ahora se avisa y no se sube.
        if (bytes > 45 * 1024 * 1024) {
            return { subido: false, motivo: `dump de ${(bytes / 1024 / 1024).toFixed(0)} MB: demasiado grande para la API de contenidos` };
        }

        await asegurarRama(cfg);

        const headers = ghHeaders(cfg.token);
        const contenido = fs.readFileSync(rutaSubir).toString('base64');
        const rutaRepo = `${GIT_BACKUP_DIR}/${nombreSubir}`;

        const r = await axios.put(`${GH_API}/repos/${cfg.repo}/contents/${rutaRepo}`, {
            message: `backup ${nombreSubir}`,
            content: contenido,
            branch: cfg.rama,
        }, { headers, timeout: 120000, maxBodyLength: Infinity, maxContentLength: Infinity });

        console.log(`☁️  Backup subido a GitHub${cifrado ? ' (cifrado)' : ''}: ${cfg.repo}@${cfg.rama}/${rutaRepo}`);

        // Rotar en GitHub (no bloquea el resultado si falla).
        try { await rotarBackupsGitHub(cfg); } catch (e) {
            console.error('Error rotando backups en GitHub:', e.response?.data?.message || e.message);
        }

        return { subido: true, cifrado, url: r.data?.content?.html_url };
    } finally {
        if (tmpEnc) { try { fs.unlinkSync(tmpEnc); } catch { /* noop */ } }
    }
}

/** Programa el backup diario */
function iniciarBackupsAutomaticos() {
    if (process.env.BACKUP_ENABLED === 'false') {
        console.log('💾 Backups automáticos desactivados (BACKUP_ENABLED=false)');
        return;
    }
    const hora = parseInt(process.env.BACKUP_HORA);
    const horaFinal = isNaN(hora) ? 3 : hora;

    schedule.scheduleJob({ hour: horaFinal, minute: 30 }, async () => {
        console.log('💾 Iniciando backup automático de la base de datos...');
        try {
            const r = await hacerBackup();
            const gh = r.github?.subido ? '☁️  subido a GitHub'
                : `⚠️  no se subió a GitHub (${r.github?.motivo})`;
            console.log(`✅ Backup OK: ${r.archivo} (${(r.bytes / 1024 / 1024).toFixed(1)} MB) — ${gh}`);
        } catch (e) {
            console.error('❌ Backup automático FALLÓ:', e.message);
        }
    });

    const cfg = configGit();
    let estadoGit = ' (solo local: falta GITHUB_TOKEN)';
    if (cfg.habilitado && cfg.clave) estadoGit = ` (con copia CIFRADA a GitHub: ${cfg.repo}@${cfg.rama})`;
    else if (cfg.habilitado && cfg.permitirSinCifrar) estadoGit = ` (con copia SIN CIFRAR a GitHub: ${cfg.repo}@${cfg.rama})`;
    else if (cfg.habilitado) estadoGit = ' (solo local: falta BACKUP_CIFRADO_CLAVE para subir a GitHub)';
    console.log(`💾 Backup automático programado todos los días a las ${horaFinal}:30${estadoGit}`);
}

module.exports = { hacerBackup, listarBackups, rutaBackup, iniciarBackupsAutomaticos, subirBackupAGitHub };
