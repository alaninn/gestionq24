// Endpoint de salud liviano para que el frontend detecte si el backend está
// realmente alcanzable (no alcanza con navigator.onLine: un corte de WAN con la
// LAN viva deja navigator.onLine en true). Sin base de datos, sin token, sin
// logs. Responde rápido y no se cachea.
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, ts: Date.now() });
});

module.exports = router;
