// =============================================
// RUTAS: Gateway interno de ticket de acceso ARCA (maquina a maquina)
// Entrega el ticket de acceso compartido del certificado delegado a otro sistema
// del mismo grupo (ej: burgerpos, que comparte el CUIT 23359052979). Asi hay UNA
// sola fuente del TA y nunca se piden dos a AFIP para el mismo certificado (AFIP
// rechaza el segundo mientras el primero este vigente).
//
// No usa login de usuario: se protege con un secreto compartido (TA_GATEWAY_SECRET)
// y esta pensado para uso interno (mismo VPS / localhost). Sin secreto configurado,
// queda deshabilitado. Se monta ANTES del /api/arca protegido por JWT.
// =============================================

const express = require('express');
const router = express.Router();
const wsaaService = require('../services/wsaaService');

router.get('/ticket-compartido', async (req, res) => {
    try {
        const secreto = process.env.TA_GATEWAY_SECRET;
        if (!secreto || req.get('x-ta-secret') !== secreto) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        const servicio = (req.query.servicio || 'wsfe').toString().replace(/[^a-z0-9]/gi, '') || 'wsfe';
        const ta = await wsaaService.obtenerTicketDelegadoCompartido(servicio);
        res.json({ token: ta.token, sign: ta.sign, expiracion: ta.expiracion, cacheado: ta.cacheado });
    } catch (e) {
        console.error('Error en /ticket-compartido:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
