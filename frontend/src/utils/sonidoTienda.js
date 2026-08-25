// Sonidos del aviso de venta online, generados con Web Audio API (sin archivos).
// Cada tipo es un patrón de tonos. reproducirSonido(tipo, veces) lo repite.

export const SONIDOS = [
    { id: 'campana', label: '🔔 Campana' },
    { id: 'timbre', label: '🛎️ Timbre (din-don)' },
    { id: 'alerta', label: '🚨 Alerta (3 pitidos)' },
    { id: 'suave', label: '🎵 Suave' },
    { id: 'caja', label: '💰 Caja registradora' },
];

let ctx = null;
function getCtx() {
    try {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    } catch (e) { return null; }
}

// Un tono simple con envolvente (ataque/decaimiento) para que suene "limpio".
function tono(ac, freq, start, dur, tipo = 'sine', vol = 0.25) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, ac.currentTime + start);
    g.gain.setValueAtTime(0, ac.currentTime + start);
    g.gain.linearRampToValueAtTime(vol, ac.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + dur + 0.02);
}

// Reproduce UNA vez el patrón del tipo. Devuelve la duración aproximada (seg).
function patron(ac, tipo) {
    switch (tipo) {
        case 'timbre':
            tono(ac, 784, 0, 0.35, 'sine', 0.3);      // Sol
            tono(ac, 587, 0.32, 0.5, 'sine', 0.3);    // Re
            return 0.85;
        case 'alerta':
            tono(ac, 880, 0, 0.12, 'square', 0.2);
            tono(ac, 880, 0.18, 0.12, 'square', 0.2);
            tono(ac, 880, 0.36, 0.14, 'square', 0.2);
            return 0.55;
        case 'suave':
            tono(ac, 523, 0, 0.5, 'sine', 0.22);
            tono(ac, 659, 0.12, 0.6, 'sine', 0.18);
            return 0.75;
        case 'caja':
            tono(ac, 1318, 0, 0.08, 'triangle', 0.25);
            tono(ac, 1567, 0.09, 0.08, 'triangle', 0.25);
            tono(ac, 1046, 0.2, 0.4, 'triangle', 0.2);
            return 0.65;
        case 'campana':
        default:
            tono(ac, 987, 0, 0.6, 'sine', 0.3);       // Si (campanita)
            tono(ac, 1318, 0.02, 0.7, 'sine', 0.15);  // armónico
            return 0.75;
    }
}

// Reproduce el sonido `tipo` repetido `veces` (1..8), espaciado.
export function reproducirSonido(tipo = 'campana', veces = 2) {
    const ac = getCtx();
    if (!ac) return;
    const n = Math.max(1, Math.min(8, parseInt(veces) || 1));
    let t = 0;
    for (let i = 0; i < n; i++) {
        setTimeout(() => { try { patron(ac, tipo); } catch (e) {} }, t * 1000);
        t += 1.0; // separación entre repeticiones
    }
}
