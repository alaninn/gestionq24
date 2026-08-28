// =============================================
// Cifrado simétrico para datos sensibles (ej. clave fiscal de AFIP).
// AES-256-GCM con clave derivada de DATA_ENCRYPTION_KEY (o JWT_SECRET como
// respaldo). El valor guardado incluye iv + authTag + ciphertext (base64).
// El texto plano NUNCA se loguea ni se devuelve al cliente.
// =============================================

const crypto = require('crypto');

function getKey() {
    const secret = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'gestionq24-clave-por-defecto';
    return crypto.createHash('sha256').update(String(secret)).digest(); // 32 bytes
}

function cifrar(texto) {
    if (texto == null || texto === '') return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const enc = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}

function descifrar(datos) {
    if (!datos) return null;
    try {
        const buf = Buffer.from(datos, 'base64');
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const enc = buf.subarray(28);
        const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch {
        return null;
    }
}

module.exports = { cifrar, descifrar };
