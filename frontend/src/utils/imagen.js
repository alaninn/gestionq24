// Compresión de imágenes en el navegador (antes de subirlas). Redimensiona a un
// lado máximo y re-codifica en WebP (o JPEG si no hay soporte) bajando la calidad
// hasta cumplir un peso objetivo. Así las fotos del catálogo se ven bien pero
// pesan poquísimo: no llenan el disco ni cargan RAM al servir el catálogo.

function soportaWebp() {
    try { return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'); }
    catch { return false; }
}
function bytesDataUri(d) { const i = d.indexOf(','); return i < 0 ? d.length : Math.floor((d.length - i - 1) * 3 / 4); }

// opts: maxLado (px), calidad (0..1), maxBytes (peso objetivo), fondoBlanco (para
// fotos: rellena transparencia con blanco al pasar a JPEG). Devuelve un data-URI.
export async function comprimirImagen(file, opts = {}) {
    const { maxLado = 800, calidad = 0.72, maxBytes = 140_000, fondoBlanco = true } = opts;
    if (!file) return null;
    try {
        const dataUrl = await new Promise((res, rej) => {
            const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
        });
        const img = await new Promise((res, rej) => {
            const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
        });

        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxLado || h > maxLado) {
            const r = Math.min(maxLado / w, maxLado / h);
            w = Math.round(w * r); h = Math.round(h * r);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        // WebP conserva transparencia; JPEG no, así que si vamos a JPEG y el
        // usuario NO quiere fondo transparente, rellenamos blanco (evita negro).
        const webp = soportaWebp();
        const tipo = webp ? 'image/webp' : 'image/jpeg';
        if (fondoBlanco || tipo === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);

        let q = calidad;
        let out = canvas.toDataURL(tipo, q);
        while (bytesDataUri(out) > maxBytes && q > 0.4) {
            q = Math.round((q - 0.1) * 100) / 100;
            out = canvas.toDataURL(tipo, q);
        }
        // Si por algún motivo salió más pesado que el original (imágenes ya
        // chicas), devolvemos el original.
        return bytesDataUri(out) < bytesDataUri(dataUrl) ? out : dataUrl;
    } catch (e) {
        // Fallback: si algo falla, subimos el archivo tal cual (sin comprimir).
        try {
            return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
        } catch { return null; }
    }
}

// Presets por tipo de imagen de la tienda.
export const PRESETS = {
    producto: { maxLado: 800, calidad: 0.72, maxBytes: 130_000, fondoBlanco: true },
    logo: { maxLado: 300, calidad: 0.85, maxBytes: 60_000, fondoBlanco: false },
    banner: { maxLado: 1280, calidad: 0.7, maxBytes: 220_000, fondoBlanco: true },
    fondo: { maxLado: 1400, calidad: 0.68, maxBytes: 260_000, fondoBlanco: true },
};
