// =============================================
// ARCHIVO: services/whatsappService.js
// Integración de WhatsApp con Baileys (portado de burgerpos, adaptado a la
// arquitectura de gestionq24: pg crudo, sin bot/IA). Sirve para VINCULAR el
// WhatsApp del negocio (por QR) y ENVIAR avisos automáticos a los clientes
// (confirmación de pedidos de la tienda online).
//
// Multi-tenant: una instancia (socket) por negocio, lazy-load, con apagado por
// inactividad y tope de instancias en memoria. La sesión se guarda en disco
// (whatsapp-sessions/<negocioId>) y sobrevive reinicios.
// =============================================

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

class WhatsAppService {
    constructor() {
        this.instances = new Map();       // negocioId -> { sock, qr, status, numero, lastActivity }
        this.MAX_INSTANCES = 8;
        this.IDLE_TIMEOUT = 30 * 60 * 1000;
        this.idleTimers = new Map();
        this.sendQueues = new Map();
        this.reconnectAttempts = new Map();
        console.log('✅ WhatsApp Service inicializado (Baileys)');
    }

    // ---- Persistencia de estado en whatsapp_config (pg) ----
    async upsertConfig(negocioId, fields) {
        try {
            const cols = Object.keys(fields);
            const setPairs = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
            const insCols = ['negocio_id', ...cols].join(', ');
            const insVals = ['$1', ...cols.map((_, i) => `$${i + 2}`)].join(', ');
            await db.query(
                `INSERT INTO whatsapp_config (${insCols}) VALUES (${insVals})
                 ON CONFLICT (negocio_id) DO UPDATE SET ${setPairs}, updated_at = NOW()`,
                [negocioId, ...cols.map(c => fields[c])]
            );
        } catch (e) {
            console.error(`Error guardando whatsapp_config (negocio ${negocioId}):`, e.message);
        }
    }
    async updateStatus(negocioId, status, qr = null, numero = undefined) {
        const f = { status, qr_code: qr, last_activity: new Date() };
        if (numero !== undefined) f.numero = numero;
        await this.upsertConfig(negocioId, f);
    }

    limpiarSesionArchivos(negocioId) {
        try {
            const authPath = path.join(__dirname, `../whatsapp-sessions/${negocioId}`);
            if (fs.existsSync(authPath)) { fs.rmSync(authPath, { recursive: true, force: true }); }
        } catch (err) { console.error(`Error limpiando sesión WA (negocio ${negocioId}):`, err.message); }
    }

    async getInstance(negocioId) {
        negocioId = String(negocioId);
        if (this.instances.has(negocioId)) { this.resetIdleTimer(negocioId); return this.instances.get(negocioId); }
        if (this.instances.size >= this.MAX_INSTANCES) await this.evictLeastRecentlyUsed();
        return await this.initInstance(negocioId);
    }

    async initInstance(negocioId) {
        negocioId = String(negocioId);
        try {
            const authPath = path.join(__dirname, `../whatsapp-sessions/${negocioId}`);
            if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });
            const { state, saveCreds } = await useMultiFileAuthState(authPath);
            const { version } = await fetchLatestBaileysVersion();

            const sock = makeWASocket({
                version,
                auth: state,
                logger: pino({ level: 'silent' }),
                browser: ['GestionQ24', 'Chrome', '120.0.0'],
                defaultQueryTimeoutMs: 60_000,
                connectTimeoutMs: 60_000,
                keepAliveIntervalMs: 25_000,
                markOnlineOnConnect: false,
            });

            const instance = { sock, qr: null, status: 'connecting', numero: null, lastActivity: Date.now() };
            this.instances.set(negocioId, instance);

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    instance.qr = qr; instance.status = 'connecting';
                    await this.updateStatus(negocioId, 'connecting', qr);
                }
                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    this.instances.delete(negocioId);
                    if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.connectionReplaced) {
                        this.limpiarSesionArchivos(negocioId);
                        this.reconnectAttempts.delete(negocioId);
                        await this.updateStatus(negocioId, 'disconnected', null, null);
                        return;
                    }
                    const intentos = (this.reconnectAttempts.get(negocioId) || 0) + 1;
                    this.reconnectAttempts.set(negocioId, intentos);
                    if (intentos > 5) { this.reconnectAttempts.delete(negocioId); await this.updateStatus(negocioId, 'disconnected', null); return; }
                    const espera = Math.min(3000 * intentos, 15000);
                    setTimeout(() => { this.initInstance(negocioId).catch(() => {}); }, espera);
                }
                if (connection === 'open') {
                    instance.status = 'connected'; instance.qr = null; instance.lastActivity = Date.now();
                    instance.numero = (sock.user?.id || '').split(':')[0].split('@')[0] || null;
                    this.reconnectAttempts.delete(negocioId);
                    await this.updateStatus(negocioId, 'connected', null, instance.numero);
                    this.scheduleIdleShutdown(negocioId);
                    console.log(`✅ WhatsApp conectado (negocio ${negocioId}, ${instance.numero})`);
                }
            });

            return instance;
        } catch (error) {
            console.error(`❌ Error inicializando WhatsApp (negocio ${negocioId}):`, error.message);
            await this.updateStatus(negocioId, 'error', null);
            throw error;
        }
    }

    async getStatus(negocioId) {
        negocioId = String(negocioId);
        const instance = this.instances.get(negocioId);
        if (instance) return { status: instance.status, ready: instance.status === 'connected', hasQr: !!instance.qr, numero: instance.numero };
        try {
            const r = await db.query('SELECT status, numero FROM whatsapp_config WHERE negocio_id = $1', [negocioId]);
            return { status: r.rows[0]?.status || 'disconnected', ready: false, hasQr: false, numero: r.rows[0]?.numero || null };
        } catch { return { status: 'disconnected', ready: false, hasQr: false, numero: null }; }
    }

    async getQrCode(negocioId) {
        negocioId = String(negocioId);
        const actual = this.instances.get(negocioId);
        if (actual?.status === 'connected') return null;
        for (let intento = 0; intento < 2; intento++) {
            let instance = this.instances.get(negocioId);
            if (!instance) { try { instance = await this.getInstance(negocioId); } catch { instance = null; } }
            for (let i = 0; i < 40; i++) {
                if (!this.instances.has(negocioId) && !instance?.qr) break;
                if (instance?.qr) { try { return await qrcode.toDataURL(instance.qr); } catch { return null; } }
                if (instance?.status === 'connected') return null;
                await new Promise(r => setTimeout(r, 500));
            }
            if (intento === 0) { this.instances.delete(negocioId); this.limpiarSesionArchivos(negocioId); }
        }
        return null;
    }

    async disconnect(negocioId) {
        negocioId = String(negocioId);
        try {
            const instance = this.instances.get(negocioId);
            if (instance?.sock) { try { await instance.sock.logout(); } catch (e) {} }
            this.instances.delete(negocioId);
            this.clearIdleTimer(negocioId);
            this.limpiarSesionArchivos(negocioId);
            await this.updateStatus(negocioId, 'disconnected', null, null);
            return true;
        } catch (error) { console.error(`Error desconectando WA (negocio ${negocioId}):`, error.message); return false; }
    }

    // ---- Envío (FIFO por negocio) ----
    async sendMessage(negocioId, number, message) {
        negocioId = String(negocioId);
        const previa = this.sendQueues.get(negocioId) || Promise.resolve();
        const tarea = previa.catch(() => {}).then(() => this._enviarAhora(negocioId, number, message));
        this.sendQueues.set(negocioId, tarea);
        tarea.finally(() => { if (this.sendQueues.get(negocioId) === tarea) this.sendQueues.delete(negocioId); });
        return tarea;
    }

    async _enviarAhora(negocioId, number, message) {
        try {
            const instance = await this.getInstance(negocioId);
            if (instance.status !== 'connected') return false;

            let num = String(number).replace(/\D/g, '');
            if (num.length === 10 && num.startsWith('11')) num = '549' + num;
            else if (num.length === 8) num = '54911' + num;
            else if (num.length === 10 && !num.startsWith('549')) num = '54' + num;
            else if (num.length === 11 && num.startsWith('0')) num = '549' + num.slice(1);
            const jid = num + '@s.whatsapp.net';

            let isRegistered = true;
            try {
                const [result] = await Promise.race([
                    instance.sock.onWhatsApp(jid),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10_000)),
                ]);
                isRegistered = result?.exists ?? false;
            } catch { isRegistered = true; }
            if (!isRegistered) { console.log(`❌ ${num} no tiene WhatsApp`); return false; }

            await instance.sock.sendMessage(jid, { text: message });
            instance.lastActivity = Date.now();
            this.resetIdleTimer(negocioId);
            console.log(`✅ WhatsApp enviado (negocio ${negocioId} -> ${num})`);
            return true;
        } catch (error) { console.error(`❌ Error enviando WA (negocio ${negocioId}):`, error.message); return false; }
    }

    // ---- idle / LRU ----
    scheduleIdleShutdown(negocioId) {
        this.clearIdleTimer(negocioId);
        const timer = setTimeout(() => {
            const instance = this.instances.get(negocioId);
            if (instance && Date.now() - instance.lastActivity >= this.IDLE_TIMEOUT) {
                this.instances.delete(negocioId); this.clearIdleTimer(negocioId);
            }
        }, this.IDLE_TIMEOUT);
        if (timer.unref) timer.unref();
        this.idleTimers.set(negocioId, timer);
    }
    resetIdleTimer(negocioId) { const i = this.instances.get(negocioId); if (i) { i.lastActivity = Date.now(); this.scheduleIdleShutdown(negocioId); } }
    clearIdleTimer(negocioId) { const t = this.idleTimers.get(negocioId); if (t) { clearTimeout(t); this.idleTimers.delete(negocioId); } }
    async evictLeastRecentlyUsed() {
        let viejo = null, min = Infinity;
        for (const [id, inst] of this.instances.entries()) if (inst.lastActivity < min) { min = inst.lastActivity; viejo = id; }
        if (viejo) { this.instances.delete(viejo); this.clearIdleTimer(viejo); }
    }
}

module.exports = new WhatsAppService();
