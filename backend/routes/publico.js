// =============================================
// ARCHIVO: routes/publico.js
// Rutas públicas (sin autenticación) para la landing page.
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/publico/precios — precios mensuales de cada plan para la landing.
// Los edita el superadmin desde Configuración de Planes.
router.get('/precios', async (req, res) => {
    try {
        const r = await db.query('SELECT plan, precio FROM planes_config');
        const precios = {};
        for (const row of r.rows) precios[row.plan] = row.precio ?? 0;
        res.json({
            estandar: precios.estandar || 10000,
            premium: precios.premium || 30000
        });
    } catch (e) {
        // Ante cualquier error devolvemos los valores por defecto para no romper la landing.
        res.json({ estandar: 10000, premium: 30000 });
    }
});

module.exports = router;
