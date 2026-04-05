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
                (SELECT COUNT(*) FROM usuarios WHERE negocio_id = n.id AND activo = TRUE) AS total_usuarios,
                (SELECT COUNT(*) FROM productos WHERE negocio_id = n.id AND activo = TRUE) AS total_productos,
                (SELECT COUNT(*) FROM ventas WHERE negocio_id = n.id) AS total_ventas,
                (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE negocio_id = n.id) AS total_facturado
            FROM negocios n
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
        const { nombre, email, telefono, direccion, plan, dias_uso, password_admin, username_admin } = req.body;

        if (!nombre || !email || !password_admin || !username_admin) {
            return res.status(400).json({ error: 'Nombre, email, usuario y contraseña son obligatorios' });
        }

        const diasNum = parseInt(dias_uso) || 30;

        const negocio = await db.query(`
            INSERT INTO negocios (nombre, email, telefono, direccion, plan, estado, fecha_vencimiento, dias_uso)
            VALUES ($1, $2, $3, $4, $5, 'activo', NOW() + ($6 * INTERVAL '1 day'), $6)
            RETURNING *
        `, [nombre, email, telefono || null, direccion || null, plan || 'mensual', diasNum]);

        await db.query(`
            INSERT INTO usuarios (negocio_id, nombre, username, email, password_hash, rol)
            VALUES ($1, $2, $3, $4, crypt($5, gen_salt('bf')), 'admin')
        `, [negocio.rows[0].id, `Admin ${nombre}`, username_admin, email, password_admin]);

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
            GROUP BY n.id, n.nombre, n.estado
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

// GET /api/superadmin/alertas
router.get('/alertas', async (req, res) => {
    try {
        const resultado = await db.query(`
            SELECT 
                a.*,
                n.nombre as negocio_nombre
            FROM alertas a
            LEFT JOIN negocios n ON n.id = a.negocio_id
            WHERE a.resuelta = false
            ORDER BY 
                CASE 
                    WHEN a.severidad = 'crítica' THEN 1
                    WHEN a.severidad = 'alta' THEN 2
                    WHEN a.severidad = 'media' THEN 3
                    ELSE 4
                END,
                a.fecha DESC
            LIMIT 100
        `);
        res.json(resultado.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener alertas' });
    }
});

// PUT /api/superadmin/alertas/:id/marcar-leida
router.put('/alertas/:id/marcar-leida', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE alertas SET leida = true WHERE id = $1', [id]);
        res.json({ mensaje: 'Alerta marcada como leída' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al marcar alerta' });
    }
});

// PUT /api/superadmin/alertas/:id/resolver
router.put('/alertas/:id/resolver', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(
            'UPDATE alertas SET resuelta = true, fecha_resolucion = NOW() WHERE id = $1',
            [id]
        );
        res.json({ mensaje: 'Alerta resuelta' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al resolver alerta' });
    }
});

// GET /api/superadmin/salud/:negocio_id
router.get('/salud/:negocio_id', async (req, res) => {
    try {
        const { negocio_id } = req.params;
        
        // Obtener datos de salud
        const negocio = await db.query(`
            SELECT id, nombre, ultima_actividad, errores_24h FROM negocios WHERE id = $1
        `, [negocio_id]);

        if (!negocio.rows[0]) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        const n = negocio.rows[0];

        // Calcular días sin actividad
        const ultimaActividad = n.ultima_actividad ? new Date(n.ultima_actividad) : null;
        const diasSinActividad = ultimaActividad 
            ? Math.floor((new Date() - ultimaActividad) / (1000 * 60 * 60 * 24))
            : null;

        // Contar transacciones de hoy
        const ventas = await db.query(`
            SELECT COUNT(*) as total FROM ventas 
            WHERE negocio_id = $1 
            AND DATE(fecha) = CURRENT_DATE
        `, [negocio_id]);

        // Usuarios activos hoy
        const usuarios = await db.query(`
            SELECT COUNT(DISTINCT usuario_id) as total FROM salud_negocio
            WHERE negocio_id = $1 
            AND tipo_evento IN ('venta', 'login')
            AND DATE(fecha) = CURRENT_DATE
        `, [negocio_id]);

        // Almacenamiento usado (agrupado por tabla)
        const almacenamiento = await db.query(`
            SELECT 
                pg_size_pretty(SUM(pg_total_relation_size(tablename::regclass))) as total_size
            FROM pg_tables 
            WHERE schemaname = 'public'
            AND tablename IN ('productos', 'ventas', 'categorias', 'usuarios', 'negocios')
        `);

        res.json({
            negocio: {
                id: n.id,
                nombre: n.nombre,
                ultima_actividad: n.ultima_actividad,
                dias_sin_actividad: diasSinActividad,
                errores_24h: n.errores_24h || 0
            },
            transacciones_hoy: parseInt(ventas.rows[0]?.total) || 0,
            usuarios_activos_hoy: parseInt(usuarios.rows[0]?.total) || 0,
            estado: diasSinActividad === null ? 'nunca_usado' : diasSinActividad > 7 ? 'inactivo' : 'activo',
            almacenamiento: {
                total_size: almacenamiento.rows[0]?.total_size || '0 bytes'
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener salud del negocio' });
    }
});

// POST /api/superadmin/tickets
router.post('/tickets', async (req, res) => {
    try {
        const { negocio_id, usuario_id, titulo, descripcion, categoria } = req.body;

        if (!negocio_id || !titulo || !descripcion) {
            return res.status(400).json({ error: 'Campos obligatorios faltantes' });
        }

        const resultado = await db.query(`
            INSERT INTO tickets_soporte (negocio_id, usuario_id, titulo, descripcion, categoria)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [negocio_id, usuario_id, titulo, descripcion, categoria || 'otro']);

        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al crear ticket' });
    }
});

// GET /api/superadmin/tickets
router.get('/tickets', async (req, res) => {
    try {
        const { estado, negocio_id } = req.query;
        let query = 'SELECT t.*, n.nombre as negocio_nombre, u.nombre as usuario_nombre FROM tickets_soporte t LEFT JOIN negocios n ON n.id = t.negocio_id LEFT JOIN usuarios u ON u.id = t.usuario_id WHERE 1=1';
        const params = [];

        if (estado) {
            params.push(estado);
            query += ` AND t.estado = $${params.length}`;
        }
        if (negocio_id) {
            params.push(negocio_id);
            query += ` AND t.negocio_id = $${params.length}`;
        }

        query += ' ORDER BY t.fecha_creacion DESC LIMIT 100';

        const resultado = await db.query(query, params);
        res.json(resultado.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener tickets' });
    }
});

// PUT /api/superadmin/tickets/:id
router.put('/tickets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, respuesta } = req.body;

        const updates = [];
        const params = [];
        let paramCount = 1;

        if (estado) {
            updates.push(`estado = $${paramCount}`);
            params.push(estado);
            paramCount++;
        }
        if (respuesta) {
            updates.push(`respuesta = $${paramCount}`);
            params.push(respuesta);
            paramCount++;
        }
        if (estado === 'resuelto' || estado === 'cerrado') {
            updates.push(`fecha_resolucion = NOW()`);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        params.push(id);
        const query = `UPDATE tickets_soporte SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

        const resultado = await db.query(query, params);
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar ticket' });
    }
});

// POST /api/superadmin/generar-alertas (endpoint para cron job)
router.post('/generar-alertas', async (req, res) => {
    try {
        // Alertas de vencimiento
        const vencimientos = await db.query(`
            SELECT id, nombre FROM negocios 
            WHERE estado = 'activo'
            AND fecha_vencimiento < NOW() + INTERVAL '5 days'
            AND fecha_vencimiento > NOW()
            AND NOT EXISTS (
                SELECT 1 FROM alertas 
                WHERE negocio_id = negocios.id 
                AND tipo = 'vencimiento'
                AND resuelta = false
                AND DATE(fecha) = CURRENT_DATE
            )
        `);

        for (const neg of vencimientos.rows) {
            const diasFaltantes = Math.ceil((new Date(neg.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));
            await db.query(`
                INSERT INTO alertas (negocio_id, tipo, titulo, descripcion, severidad)
                VALUES ($1, 'vencimiento', $2, $3, $4)
            `, [
                neg.id,
                `⏰ Vencimiento próximo`,
                `${neg.nombre} vence en ${diasFaltantes} días. Renova la suscripción.`,
                diasFaltantes <= 2 ? 'crítica' : 'alta'
            ]);
        }

        // Alertas de vencimiento ya pasado
        const vencidos = await db.query(`
            SELECT id, nombre FROM negocios 
            WHERE estado = 'activo'
            AND fecha_vencimiento < NOW()
            AND NOT EXISTS (
                SELECT 1 FROM alertas 
                WHERE negocio_id = negocios.id 
                AND tipo = 'vencimiento_vencido'
                AND resuelta = false
            )
        `);

        for (const neg of vencidos.rows) {
            await db.query(`
                INSERT INTO alertas (negocio_id, tipo, titulo, descripcion, severidad)
                VALUES ($1, 'vencimiento_vencido', $2, $3, 'crítica')
            `, [
                neg.id,
                `🚨 Suscripción VENCIDA`,
                `${neg.nombre} está vencido. El negocio debería estar bloqueado.`
            ]);
        }

        // Alertas de sin actividad
        const inactivos = await db.query(`
            SELECT id, nombre, ultima_actividad FROM negocios 
            WHERE estado = 'activo'
            AND (ultima_actividad IS NULL OR ultima_actividad < NOW() - INTERVAL '7 days')
            AND NOT EXISTS (
                SELECT 1 FROM alertas 
                WHERE negocio_id = negocios.id 
                AND tipo = 'sin_actividad'
                AND resuelta = false
                AND DATE(fecha) = CURRENT_DATE
            )
        `);

        for (const neg of inactivos.rows) {
            const dias = neg.ultima_actividad 
                ? Math.floor((new Date() - new Date(neg.ultima_actividad)) / (1000 * 60 * 60 * 24))
                : '∞';
            await db.query(`
                INSERT INTO alertas (negocio_id, tipo, titulo, descripcion, severidad)
                VALUES ($1, 'sin_actividad', $2, $3, 'media')
            `, [
                neg.id,
                `💾 Sin actividad por ${dias} días`,
                `${neg.nombre} no ha registrado ventas en ${dias} días. ¿Error o abandono?`
            ]);
        }

        res.json({ 
            mensaje: 'Alertas generadas correctamente',
            vencimientos: vencimientos.rows.length,
            inactivos: inactivos.rows.length
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al generar alertas' });
    }
});

// GET /api/superadmin/negocios/:id/acceso
router.get('/negocios/:id/acceso', async (req, res) => {
    try {
        const { id } = req.params;
        
        const negocio = await db.query(`
            SELECT id, nombre, estado FROM negocios WHERE id = $1
        `, [id]);

        if (!negocio.rows[0]) {
            return res.status(404).json({ error: 'Negocio no encontrado' });
        }

        res.json({ 
            acceso_permitido: true,
            negocio: negocio.rows[0]
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al verificar acceso' });
    }
});

// PUT /api/superadmin/mi-cuenta — el superadmin actualiza sus propios datos
router.put('/mi-cuenta', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;
        const id = req.usuario.id;

        if (!nombre || !email) {
            return res.status(400).json({ error: 'Nombre y email son obligatorios' });
        }

        if (password) {
            await db.query(`
                UPDATE usuarios SET 
                    nombre = $1, 
                    email = $2,
                    password_hash = crypt($3, gen_salt('bf'))
                WHERE id = $4 AND rol = 'superadmin'
            `, [nombre, email, password, id]);
        } else {
            await db.query(`
                UPDATE usuarios SET 
                    nombre = $1, 
                    email = $2
                WHERE id = $3 AND rol = 'superadmin'
            `, [nombre, email, id]);
        }

        const resultado = await db.query(
            'SELECT id, nombre, email, rol FROM usuarios WHERE id = $1',
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ mensaje: 'Cuenta actualizada correctamente', usuario: resultado.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
        }
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar cuenta' });
    }
});

// GET /api/superadmin/negocios/:id/admin — obtener admin principal del negocio
router.get('/negocios/:id/admin', async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await db.query(`
            SELECT id, nombre, email, rol FROM usuarios
            WHERE negocio_id = $1 AND rol = 'admin' AND activo = TRUE
            ORDER BY created_at ASC LIMIT 1
        `, [id]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontró administrador para este negocio' });
        }
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener administrador' });
    }
});

// PUT /api/superadmin/negocios/:id/admin — editar admin principal del negocio
router.put('/negocios/:id/admin', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, password } = req.body;

        if (!nombre || !email) {
            return res.status(400).json({ error: 'Nombre y email son obligatorios' });
        }

        const admin = await db.query(`
            SELECT id FROM usuarios
            WHERE negocio_id = $1 AND rol = 'admin' AND activo = TRUE
            ORDER BY created_at ASC LIMIT 1
        `, [id]);

        if (admin.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontró administrador' });
        }

        const adminId = admin.rows[0].id;

        if (password) {
            await db.query(`
                UPDATE usuarios SET nombre = $1, email = $2,
                password_hash = crypt($3, gen_salt('bf'))
                WHERE id = $4
            `, [nombre, email, password, adminId]);
        } else {
            await db.query(`
                UPDATE usuarios SET nombre = $1, email = $2
                WHERE id = $3
            `, [nombre, email, adminId]);
        }

        res.json({ mensaje: 'Administrador actualizado correctamente' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
        }
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar administrador' });
    }
});

module.exports = router;