// =============================================
// SERVICIO: Backup automático de la base de datos
// Hace un dump diario de PostgreSQL con pg_dump y rota los archivos viejos.
// Configuración por .env (opcional):
//   BACKUP_ENABLED=true|false   (default: true)
//   BACKUP_HORA=3               (hora del día, default 3 AM)
//   BACKUP_RETENER=14           (cantidad de backups a conservar, default 14)
// =============================================

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');

const BACKUP_DIR = path.join(__dirname, '../backups');

function asegurarDirectorio() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

/**
 * Ejecuta pg_dump y genera un backup comprimido (formato custom de PostgreSQL).
 * Se restaura con: pg_restore -d <base> <archivo>
 * @returns {Promise<{archivo: string, bytes: number}>}
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

        proceso.on('close', (code) => {
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
            resolve({ archivo: nombre, bytes });
        });
    });
}

/** Borra los backups más viejos, conservando los últimos N */
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

/** Lista los backups existentes (más nuevos primero) */
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

/** Ruta absoluta de un backup, validando el nombre (sin path traversal) */
function rutaBackup(nombre) {
    if (!/^backup_[\w.-]+\.dump$/.test(nombre)) return null;
    const ruta = path.join(BACKUP_DIR, nombre);
    return fs.existsSync(ruta) ? ruta : null;
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
            console.log(`✅ Backup OK: ${r.archivo} (${(r.bytes / 1024 / 1024).toFixed(1)} MB)`);
        } catch (e) {
            console.error('❌ Backup automático FALLÓ:', e.message);
        }
    });
    console.log(`💾 Backup automático programado todos los días a las ${horaFinal}:30`);
}

module.exports = { hacerBackup, listarBackups, rutaBackup, iniciarBackupsAutomaticos };
