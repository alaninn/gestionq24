// =============================================
// ARCHIVO: routes/superadmin.js
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarToken, soloSuperadmin } = require('../middleware/auth');

router.use(verificarToken);
router.use(soloSuperadmin);

// GET /api/superadmin/negocios
router.get('/negocios', async (req, res) => {
    try {
        const resultado = await db.query(`
            SELECT 
                n.*,
                COUNT(DISTINCT u.id) AS total_usuarios,
                COUNT(DISTINCT p.id) AS total_productos,
                COUNT(DISTINCT v.id) AS total_ventas,
                COALESCE(SUM(v.total), 0) AS total_facturado
            FROM negocios n
            LEFT JOIN usuarios u ON u.negocio_id = n.id AND u.activo = TRUE
            LEFT JOIN productos p ON p.negocio_id = n.id AND p.activo = TRUE
            LEFT JOIN ventas v ON v.negocio_id = n.id
            GROUP BY n.id
            ORDER BY n.created_at DESC
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener negocios' });
    }
});

// POST /api/superadmin/negocios
router.post('/negocios', async (req, res) => {
    try {
        const { nombre, email, telefono, direccion, plan, dias_uso, password_admin } = req.body;

        if (!nombre || !email || !password_admin) {
            return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
        }

        const diasNum = parseInt(dias_uso) || 30;

        const negocio = await db.query(`
            INSERT INTO negocios (nombre, email, telefono, direccion, plan, estado, fecha_vencimiento, dias_uso)
            VALUES ($1, $2, $3, $4, $5, 'activo', NOW() + ($6 * INTERVAL '1 day'), $6)
            RETURNING *
        `, [nombre, email, telefono || null, direccion || null, plan || 'mensual', diasNum]);

        await db.query(`
            INSERT INTO usuarios (negocio_id, nombre, email, password_hash, rol)
            VALUES ($1, $2, $3, crypt($4, gen_salt('bf')), 'admin')
        `, [negocio.rows[0].id, `Admin ${nombre}`, email, password_admin]);

        await db.query(`
            INSERT INTO configuracion (nombre_negocio, email, negocio_id)
            VALUES ($1, $2, $3)
        `, [nombre, email, negocio.rows[0].id]);

        res.status(201).json(negocio.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe un negocio con ese email' });
        }
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al crear negocio' });
    }
});

// PUT /api/superadmin/negocios/:id
router.put('/negocios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, dias_uso, plan, nombre, telefono, direccion } = req.body;
        const diasNum = dias_uso ? parseInt(dias_uso) : null;

        const resultado = await db.query(`
            UPDATE negocios SET
                nombre = COALESCE($1, nombre),
                telefono = COALESCE($2, telefono),
                direccion = COALESCE($3, direccion),
                plan = COALESCE($4, plan),
                estado = COALESCE($5, estado),
                fecha_vencimiento = CASE 
                    WHEN $6::integer IS NOT NULL THEN NOW() + ($6::integer * INTERVAL '1 day')
                    ELSE fecha_vencimiento
                END,
                dias_uso = COALESCE($6::integer, dias_uso)
            WHERE id = $7
            RETURNING *
        `, [nombre, telefono, direccion, plan, estado, diasNum, id]);

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar negocio' });
    }
});

// GET /api/superadmin/stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM negocios) AS total_negocios,
                (SELECT COUNT(*) FROM negocios WHERE estado = 'activo') AS negocios_activos,
                (SELECT COUNT(*) FROM negocios WHERE estado = 'bloqueado') AS negocios_bloqueados,
                (SELECT COUNT(*) FROM negocios WHERE fecha_vencimiento < NOW()) AS negocios_vencidos,
                (SELECT COUNT(*) FROM usuarios WHERE negocio_id IS NOT NULL) AS total_usuarios,
                (SELECT COALESCE(SUM(total), 0) FROM ventas) AS total_facturado_global,
                (SELECT COUNT(*) FROM ventas) AS total_ventas_global
        `);

        const topNegocios = await db.query(`
            SELECT 
                n.nombre,
                n.estado,
                COUNT(v.id) AS total_ventas,
                COALESCE(SUM(v.total), 0) AS total_facturado
            FROM negocios n
            LEFT JOIN ventas v ON v.negocio_id = n.id
            GROUP BY n.id
            ORDER BY total_facturado DESC
            LIMIT 10
        `);

        res.json({
            ...stats.rows[0],
            top_negocios: topNegocios.rows
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// POST /api/superadmin/negocios/:id/renovar
router.post('/negocios/:id/renovar', async (req, res) => {
    try {
        const { id } = req.params;
        const { dias, monto, metodo_pago, observaciones } = req.body;
        const diasNum = parseInt(dias) || 30;

        // Actualizar negocio con nueva fecha de vencimiento
        const resultado = await db.query(`
            UPDATE negocios SET
                estado = 'activo',
                fecha_vencimiento = CASE
                    WHEN fecha_vencimiento > NOW() 
                    THEN fecha_vencimiento + ($1 * INTERVAL '1 day')
                    ELSE NOW() + ($1 * INTERVAL '1 day')
                END
            WHERE id = $2
            RETURNING *
        `, [diasNum, id]);

        // Registrar en historial de pagos
        if (monto || metodo_pago) {
            await db.query(`
                INSERT INTO pagos_historial (negocio_id, dias, monto, metodo_pago, observaciones, tipo)
                VALUES ($1, $2, $3, $4, $5, 'renovacion')
                ON CONFLICT DO NOTHING
            `, [id, diasNum, monto || 0, metodo_pago || 'manual', observaciones || null]);
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al renovar suscripción' });
    }
});

// GET /api/superadmin/negocios/:id/historial-pagos
router.get('/negocios/:id/historial-pagos', async (req, res) => {
    try {
        const { id } = req.params;
        
        const resultado = await db.query(`
            SELECT * FROM pagos_historial
            WHERE negocio_id = $1
            ORDER BY fecha DESC
            LIMIT 50
        `, [id]);

        res.json(resultado.rows || []);
    } catch (error) {
        if (error.code === '42P01') {
            // Tabla no existe, retornar array vacío
            return res.json([]);
        }
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

// POST /api/superadmin/negocios/:id/registrar-pago
router.post('/negocios/:id/registrar-pago', async (req, res) => {
    try {
        const { id } = req.params;
        const { dias, monto, metodo_pago, observaciones, pagado } = req.body;

        // Actualizar estado de pago en negocio si es necesario
        if (pagado !== undefined) {
            await db.query(`
                UPDATE negocios SET pagado = $1 WHERE id = $2
            `, [pagado, id]);
        }

        // Registrar pago
        const resultado = await db.query(`
            INSERT INTO pagos_historial 
            (negocio_id, dias, monto, metodo_pago, observaciones, tipo, pagado)
            VALUES ($1, $2, $3, $4, $5, 'pago', $6)
            RETURNING *
            ON CONFLICT DO NOTHING
        `, [id, dias || 30, monto || 0, metodo_pago || 'pendiente', observaciones || null, pagado ?? true]);

        res.json(resultado.rows[0] || { mensaje: 'Pago registrado' });
    } catch (error) {
        if (error.code === '42P01') {
            return res.status(400).json({ error: 'Tabla de pagos no existe. Contacte al administrador.' });
        }
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al registrar pago' });
    }
});

// PUT /api/superadmin/negocios/:id/dias-uso
router.put('/negocios/:id/dias-uso', async (req, res) => {
    try {
        const { id } = req.params;
        const { dias } = req.body;

        if (!dias || parseInt(dias) <= 0) {
            return res.status(400).json({ error: 'Debe especificar días válidos' });
        }

        const diasNum = parseInt(dias);
        
        // Actualizar fecha de vencimiento basado en días de uso
        const resultado = await db.query(`
            UPDATE negocios SET
                fecha_vencimiento = NOW() + ($1 * INTERVAL '1 day'),
                dias_uso = $1,
                estado = 'activo'
            WHERE id = $2
            RETURNING *
        `, [diasNum, id]);

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar días de uso' });
    }
});

// GET /api/superadmin/negocios/:id/acceso
// Permite al superadmin obtener token de acceso a otro negocio
router.get('/negocios/:id/acceso', async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener info del negocio
        const negocio = await db.query(`
            SELECT id, nombre, estado FROM negocios WHERE id = $1
        `, [id]);

        if (!negocio.rows[0]) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        if (negocio.rows[0].estado !== 'activo') {
            return res.status(403).json({ error: 'Negocio no está activo' });
        }

        // Retornar información para acceso
        res.json({
            negocio_id: negocio.rows[0].id,
            nombre: negocio.rows[0].nombre,
            acceso_permitido: true
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al verificar acceso' });
    }
});

module.exports = router;