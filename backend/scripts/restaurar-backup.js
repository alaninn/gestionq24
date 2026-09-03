// =============================================================================
// restaurar-backup.js  --  Descifra un backup .dump.enc bajado de GitHub.
//
// Los backups que sube backupService.js a la rama "backups" del repo están
// cifrados con AES-256-GCM (clave = BACKUP_CIFRADO_CLAVE). Este script los
// descifra y deja el .dump listo para pg_restore.
//
// USO:
//   node scripts/restaurar-backup.js <archivo.dump.enc> [salida.dump]
//   (la clave se toma de BACKUP_CIFRADO_CLAVE en el entorno o el .env;
//    o se pasa por  --clave "la frase")
//
// Después:
//   createdb almacenq24    # si hace falta
//   pg_restore -d almacenq24 --clean --if-exists --no-owner <salida.dump>
// =============================================================================

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch { /* opcional */ }

const args = process.argv.slice(2);
let clave = process.env.BACKUP_CIFRADO_CLAVE || null;
const positional = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--clave') clave = args[++i];
    else positional.push(args[i]);
}

const entrada = positional[0];
if (!entrada) {
    console.error('Falta el archivo. Uso: node scripts/restaurar-backup.js <archivo.dump.enc> [salida.dump]');
    process.exit(1);
}
if (!fs.existsSync(entrada)) {
    console.error('No existe: ' + entrada);
    process.exit(1);
}
if (!clave) {
    console.error('Falta la clave. Poné BACKUP_CIFRADO_CLAVE en el .env o pasá --clave "la frase".');
    process.exit(1);
}

const salida = positional[1] || entrada.replace(/\.enc$/, '') || (entrada + '.dump');

const buf = fs.readFileSync(entrada);
const magic = buf.subarray(0, 8).toString();
if (magic !== 'GQ24BK01') {
    console.error('Formato desconocido (magic="' + magic + '"). ¿Es un .dump.enc de este sistema?');
    process.exit(1);
}
const salt = buf.subarray(8, 24);
const iv = buf.subarray(24, 36);
const tag = buf.subarray(36, 52);
const ciphertext = buf.subarray(52);

try {
    const key = crypto.scryptSync(clave, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plano = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    fs.writeFileSync(salida, plano);
    console.log('OK -> ' + salida + '  (' + (plano.length / 1024 / 1024).toFixed(1) + ' MB)');
    console.log('Ahora: pg_restore -d almacenq24 --clean --if-exists --no-owner "' + salida + '"');
} catch (e) {
    console.error('No se pudo descifrar: ' + e.message + '  (¿clave incorrecta o archivo dañado?)');
    process.exit(1);
}
