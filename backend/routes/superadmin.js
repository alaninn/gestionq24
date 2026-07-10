// =============================================
// ARCHIVO: routes/superadmin.js
// =============================================

const express = require('express');
const router = express.Router();
const path = require('path');
const axios = require('axios');
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
                (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE negocio_id = n.id) AS total_facturado,
                (SELECT MAX(fecha) FROM ventas WHERE negocio_id = n.id) AS ultima_venta,
                (SELECT COUNT(*) FROM ventas WHERE negocio_id = n.id AND fecha > NOW() - INTERVAL '30 days') AS ventas_30d,
                (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE negocio_id = n.id AND fecha > NOW() - INTERVAL '30 days') AS facturado_30d
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
        `, [nombre, email, telefono || null, direccion || null, plan || 'estandar', diasNum]);

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

// PUT /api/superadmin/negocios/:id/plan
router.put('/negocios/:id/plan', async (req, res) => {
    try {
        const { id } = req.params;
        const { plan } = req.body;

        if (!plan || (plan !== 'estandar' && plan !== 'premium')) {
            return res.status(400).json({ error: 'Plan debe ser "estandar" o "premium"' });
        }

        const resultado = await db.query(`
            UPDATE negocios SET plan = $1 WHERE id = $2 RETURNING *
        `, [plan, id]);

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al cambiar el plan' });
    }
});

// DELETE /api/superadmin/negocios/:id
// Elimina el negocio y TODA su data dependiente en el orden correcto.
// Muchas tablas tienen FK con NO ACTION (turnos, ventas, productos, etc.) que
// bloquean el borrado si no se eliminan primero. Se hace en una transacción.
router.delete('/negocios/:id', async (req, res) => {
    const { id } = req.params;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Borra de una tabla; ignora si la tabla o la columna no existen en esta instalación
        const borrar = async (sql) => {
            await client.query('SAVEPOINT sp');
            try {
                await client.query(sql, [id]);
                await client.query('RELEASE SAVEPOINT sp');
            } catch (e) {
                await client.query('ROLLBACK TO SAVEPOINT sp');
                // 42P01 = tabla inexistente, 42703 = columna inexistente → se ignoran
                if (e.code !== '42P01' && e.code !== '42703') throw e;
            }
        };

        // Orden: hijos antes que padres para respetar las FK NO ACTION
        await borrar('DELETE FROM venta_items WHERE negocio_id = $1');
        await borrar('DELETE FROM comprobantes_electronicos WHERE negocio_id = $1');
        await borrar('DELETE FROM pagos_deuda WHERE negocio_id = $1');
        await borrar('DELETE FROM gastos WHERE negocio_id = $1');
        await borrar('DELETE FROM ventas WHERE negocio_id = $1');
        await borrar('DELETE FROM turno_usuarios WHERE negocio_id = $1');
        await borrar('DELETE FROM turnos WHERE negocio_id = $1');
        await borrar('DELETE FROM historial_stock WHERE negocio_id = $1');
        await borrar('DELETE FROM producto_codigos WHERE negocio_id = $1');
        await borrar('DELETE FROM productos WHERE negocio_id = $1');
        await borrar('DELETE FROM categorias WHERE negocio_id = $1');
        await borrar('DELETE FROM clientes WHERE negocio_id = $1');
        await borrar('DELETE FROM proveedores WHERE negocio_id = $1');
        await borrar('DELETE FROM configuracion WHERE negocio_id = $1');
        await borrar('DELETE FROM alertas WHERE negocio_id = $1');
        await borrar('DELETE FROM certificados_arca WHERE negocio_id = $1');
        await borrar('DELETE FROM tickets_acceso_wsaa WHERE negocio_id = $1');
        await borrar('DELETE FROM tickets_soporte WHERE negocio_id = $1');
        await borrar('DELETE FROM salud_negocio WHERE negocio_id = $1');
        await borrar('DELETE FROM pagos_historial WHERE negocio_id = $1');
        await borrar('DELETE FROM usuarios WHERE negocio_id = $1');

        // Finalmente, el negocio
        await client.query('DELETE FROM negocios WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ mensaje: 'Negocio eliminado correctamente' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar negocio:', error);
        res.status(500).json({ error: 'Error al eliminar negocio' });
    } finally {
        client.release();
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

        // Validar que el negocio exista
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'El negocio no existe' });
        }

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

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'El negocio no existe' });
        }

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
              AND a.severidad IN ('alta', 'crítica')
            ORDER BY 
                CASE 
                    WHEN a.severidad = 'crítica' THEN 1
                    WHEN a.severidad = 'alta' THEN 2
                    WHEN a.severidad = 'media' THEN 3
                    ELSE 4
                END,
                a.fecha DESC
            LIMIT 20
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
            SELECT id, nombre, fecha_vencimiento FROM negocios
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
            SELECT u.id, u.nombre, u.email, u.username, u.rol,
                   (n.password_portal_hash IS NOT NULL) AS tiene_password_portal
            FROM usuarios u
            JOIN negocios n ON u.negocio_id = n.id
            WHERE u.negocio_id = $1 AND u.rol = 'admin' AND u.activo = TRUE
            ORDER BY u.created_at ASC LIMIT 1
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
// El mail del admin es la llave del "Acceso del negocio" (Paso 1 del login), así que
// debe ser único entre negocios. Se sincroniza con el mail del negocio.
router.put('/negocios/:id/admin', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, username, password, password_portal, email } = req.body;

        if (!nombre || !username) {
            return res.status(400).json({ error: 'Nombre y usuario son obligatorios' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ error: 'El mail del negocio es obligatorio (es la llave de acceso)' });
        }
        const mail = email.trim();

        const admin = await db.query(`
            SELECT id FROM usuarios
            WHERE negocio_id = $1 AND rol = 'admin' AND activo = TRUE
            ORDER BY created_at ASC LIMIT 1
        `, [id]);

        if (admin.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontró administrador' });
        }

        const adminId = admin.rows[0].id;

        // Verificar que el username no esté en uso por otro usuario del mismo negocio
        const usernameExiste = await db.query(
            'SELECT id FROM usuarios WHERE username = $1 AND negocio_id = $2 AND id != $3 AND activo = TRUE',
            [username, id, adminId]
        );
        if (usernameExiste.rows.length > 0) {
            return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' });
        }

        // El mail tiene que ser único entre negocios (es la llave del Paso 1).
        const mailEnNegocio = await db.query(
            'SELECT id FROM negocios WHERE LOWER(email) = LOWER($1) AND id != $2',
            [mail, id]
        );
        const mailEnAdmin = await db.query(
            "SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) AND rol = 'admin' AND id != $2 AND activo = TRUE",
            [mail, adminId]
        );
        if (mailEnNegocio.rows.length > 0 || mailEnAdmin.rows.length > 0) {
            return res.status(400).json({ error: 'Ese mail ya está en uso por otro negocio' });
        }

        if (password) {
            await db.query(`
                UPDATE usuarios SET nombre = $1, username = $2, email = $3,
                password_hash = crypt($4, gen_salt('bf'))
                WHERE id = $5
            `, [nombre, username, mail, password, adminId]);
        } else {
            await db.query(`
                UPDATE usuarios SET nombre = $1, username = $2, email = $3
                WHERE id = $4
            `, [nombre, username, mail, adminId]);
        }

        // Sincronizar el mail del negocio con el del admin
        await db.query('UPDATE negocios SET email = $1 WHERE id = $2', [mail, id]);

        // Contraseña del portal de acceso (Paso 1): es distinta de la del admin y la
        // conocen todos los usuarios. Solo se actualiza si se mandó una nueva.
        if (password_portal && password_portal.trim() !== '') {
            await db.query(
                'UPDATE negocios SET password_portal_hash = crypt($1, gen_salt(\'bf\')) WHERE id = $2',
                [password_portal, id]
            );
        }

        res.json({ mensaje: 'Administrador actualizado correctamente' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ese mail o nombre de usuario ya está en uso' });
        }
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar administrador' });
    }
});

// =============================================
// BACKUPS DE BASE DE DATOS
// =============================================
const backupService = require('../services/backupService');

// GET /api/superadmin/backups — listar backups existentes
router.get('/backups', async (req, res) => {
    try {
        res.json(backupService.listarBackups());
    } catch (error) {
        console.error('Error listando backups:', error);
        res.status(500).json({ error: 'Error al listar backups' });
    }
});

// POST /api/superadmin/backups — crear un backup ahora
router.post('/backups', async (req, res) => {
    try {
        const r = await backupService.hacerBackup();
        res.json({ exito: true, ...r });
    } catch (error) {
        console.error('Error creando backup:', error);
        res.status(500).json({ error: error.message || 'Error al crear backup' });
    }
});

// GET /api/superadmin/backups/:archivo/descargar — bajar un backup
router.get('/backups/:archivo/descargar', async (req, res) => {
    try {
        const ruta = backupService.rutaBackup(req.params.archivo);
        if (!ruta) return res.status(404).json({ error: 'Backup no encontrado' });
        res.download(ruta);
    } catch (error) {
        console.error('Error descargando backup:', error);
        res.status(500).json({ error: 'Error al descargar backup' });
    }
});

// =============================================
// VISOR DE LOGS (bajo demanda, pensado para servidores con poca RAM)
// =============================================
const logBuffer = require('../services/logBuffer');

// GET /api/superadmin/logs/en-vivo?desde=ID
// Devuelve solo las líneas nuevas desde el último id (polling incremental).
router.get('/logs/en-vivo', (req, res) => {
    const desde = parseInt(req.query.desde) || 0;
    res.json(logBuffer.obtenerDesde(desde));
});

// GET /api/superadmin/logs/archivo?tipo=out|error
// Lee SOLO los últimos 64KB del archivo de log de pm2 (no carga el archivo entero).
router.get('/logs/archivo', (req, res) => {
    try {
        const os = require('os');
        const fs = require('fs');
        const tipo = req.query.tipo === 'error' ? 'error' : 'out';
        const dirLogs = process.env.PM2_LOG_DIR || path.join(os.homedir(), '.pm2', 'logs');
        const archivo = path.join(dirLogs, `gestionq24-${tipo}.log`);

        if (!fs.existsSync(archivo)) {
            return res.json({ disponible: false, mensaje: `No se encontró el archivo de log (${archivo}). Este visor de archivos funciona solo en el servidor con pm2.` });
        }

        const stat = fs.statSync(archivo);
        const LEER = 64 * 1024; // últimos 64KB como máximo
        const inicio = Math.max(0, stat.size - LEER);
        const fd = fs.openSync(archivo, 'r');
        const buf = Buffer.alloc(Math.min(LEER, stat.size));
        fs.readSync(fd, buf, 0, buf.length, inicio);
        fs.closeSync(fd);

        let texto = buf.toString('utf8');
        // Descartar la primera línea cortada si empezamos a mitad de archivo
        if (inicio > 0) texto = texto.slice(texto.indexOf('\n') + 1);

        res.json({
            disponible: true,
            archivo: `gestionq24-${tipo}.log`,
            bytes_totales: stat.size,
            contenido: texto,
        });
    } catch (error) {
        console.error('Error leyendo log:', error);
        res.status(500).json({ error: 'Error al leer el archivo de log' });
    }
});

// =============================================
// ERRORES DEL FRONTEND (reportados automáticamente)
// =============================================
// GET /api/superadmin/errores-frontend — últimos errores reportados
router.get('/errores-frontend', async (req, res) => {
    try {
        const r = await db.query(`
            SELECT e.*, n.nombre AS negocio_nombre
            FROM errores_frontend e
            LEFT JOIN negocios n ON n.id = e.negocio_id
            ORDER BY e.fecha DESC
            LIMIT 100
        `);
        res.json(r.rows);
    } catch (error) {
        console.error('Error obteniendo errores frontend:', error);
        res.status(500).json({ error: 'Error al obtener errores' });
    }
});

// =============================================
// REPORTE DE ERRORES (para que la IA lo lea sin copiar/pegar)
// =============================================

// Fecha/hora en horario de Argentina (UTC-3), para que coincida con la PC del usuario.
const TZ_AR = 'America/Argentina/Buenos_Aires';
function partesFechaAr(d = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ_AR, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    return Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
}
// 'YYYY-MM-DDTHH-MM-SS' para nombres de archivo (ordenable cronológicamente)
function fechaArchivoAr(d = new Date()) {
    const p = partesFechaAr(d);
    return `${p.year}-${p.month}-${p.day}T${p.hour}-${p.minute}-${p.second}`;
}
// 'YYYY-MM-DD HH:MM:SS (hora Argentina)' legible para el reporte
function fechaLegibleAr(d = new Date()) {
    const p = partesFechaAr(d);
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} (hora Argentina)`;
}

// Arma el contenido Markdown del reporte: errores de pantalla + logs del server.
async function construirReporteErrores() {
    const ahora = fechaLegibleAr();

    // 1) Errores de pantalla (frontend)
    const erroresFront = await db.query(`
        SELECT e.*, n.nombre AS negocio_nombre, u.nombre AS usuario_nombre
        FROM errores_frontend e
        LEFT JOIN negocios n ON n.id = e.negocio_id
        LEFT JOIN usuarios u ON u.id = e.usuario_id
        ORDER BY e.fecha DESC
        LIMIT 50
    `);

    // 2) Últimos logs de ERROR del servidor (archivo de pm2, últimos 32KB)
    let logsServer = '(no disponible)';
    let logPath = null;
    let logServerConContenido = false; // true solo si el log trae errores reales
    try {
        const os = require('os');
        const fs = require('fs');
        const dirLogs = process.env.PM2_LOG_DIR || path.join(os.homedir(), '.pm2', 'logs');
        const archivo = path.join(dirLogs, 'gestionq24-error.log');
        if (fs.existsSync(archivo)) {
            logPath = archivo;
            const stat = fs.statSync(archivo);
            const LEER = 32 * 1024;
            const inicio = Math.max(0, stat.size - LEER);
            const fd = fs.openSync(archivo, 'r');
            const buf = Buffer.alloc(Math.min(LEER, stat.size));
            fs.readSync(fd, buf, 0, buf.length, inicio);
            fs.closeSync(fd);
            let texto = buf.toString('utf8');
            if (inicio > 0) texto = texto.slice(texto.indexOf('\n') + 1);
            logServerConContenido = texto.trim().length > 0;
            logsServer = texto.trim() || '(sin errores recientes en el log)';
        }
    } catch (e) {
        logsServer = `(error al leer el log: ${e.message})`;
    }

    // 3) Logs en memoria (por si pm2 no está, p. ej. en local)
    let logsMemoria = '';
    try {
        const { lineas } = logBuffer.obtenerDesde(0);
        const enMemoria = (lineas || []).filter(l => l.nivel === 'error');
        if (enMemoria.length) {
            logsMemoria = enMemoria.slice(-40).map(l => `[${l.fecha}] ${l.mensaje}`).join('\n');
        }
    } catch { /* ignore */ }

    let md = `# 🐞 Reporte de errores — gestionQ24\n\n`;
    md += `Generado: ${ahora}\n\n`;
    md += `> Archivo para que la IA diagnostique. Indicá: "revisá reportes/<este archivo>".\n\n`;
    md += `---\n\n## Errores de pantalla (frontend) — ${erroresFront.rows.length}\n\n`;
    if (erroresFront.rows.length === 0) {
        md += `_Sin errores de pantalla registrados._\n\n`;
    } else {
        for (const e of erroresFront.rows) {
            md += `### #${e.id} · ${fechaLegibleAr(new Date(e.fecha))}\n`;
            md += `- **Negocio**: ${e.negocio_nombre || e.negocio_id || '-'} · **Usuario**: ${e.usuario_nombre || e.usuario_id || '-'}\n`;
            md += `- **URL**: ${e.url || '-'}\n`;
            md += `- **Navegador**: ${(e.user_agent || '-').slice(0, 160)}\n`;
            md += `- **Mensaje**: ${e.mensaje || '-'}\n`;
            if (e.stack) md += `\n\`\`\`\n${String(e.stack).slice(0, 2000)}\n\`\`\`\n`;
            md += `\n`;
        }
    }
    md += `---\n\n## Logs de error del servidor (pm2, últimos)\n\n\`\`\`\n${logsServer.slice(-12000)}\n\`\`\`\n`;
    if (logsMemoria) md += `\n## Logs de error en memoria\n\n\`\`\`\n${logsMemoria.slice(-8000)}\n\`\`\`\n`;

    // Devolvemos también qué se incluyó, para poder limpiarlo tras subir a git.
    const idsFront = erroresFront.rows.map(e => e.id);
    // ¿Hay algo real para reportar? (errores de pantalla, log del server o memoria)
    const hayErrores = idsFront.length > 0 || logServerConContenido || logsMemoria.length > 0;
    return { md, idsFront, logPath, hayErrores };
}

// Limpia las fuentes ya incluidas en un reporte subido (para no repetir errores
// viejos en el próximo). Se llama SOLO tras subir a git con éxito.
async function limpiarFuentesReporte({ idsFront, logPath }) {
    // 1) Borrar los errores de pantalla ya reportados
    if (idsFront && idsFront.length) {
        try {
            await db.query('DELETE FROM errores_frontend WHERE id = ANY($1)', [idsFront]);
        } catch (e) { console.error('No se pudieron borrar errores_frontend:', e.message); }
    }
    // 2) Vaciar el log de error de pm2 (truncar el archivo; pm2 sigue escribiendo)
    if (logPath) {
        try { require('fs').truncateSync(logPath, 0); }
        catch (e) { console.error('No se pudo truncar el log de pm2:', e.message); }
    }
    // 3) Vaciar el buffer de logs en memoria
    try { logBuffer.limpiar(); } catch { /* ignore */ }
}

// GET /api/superadmin/errores/reporte — descarga el .md
router.get('/errores/reporte', async (req, res) => {
    try {
        const { md } = await construirReporteErrores();
        const nombre = `errores-${fechaArchivoAr()}.md`;
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
        res.send(md);
    } catch (error) {
        console.error('Error generando reporte:', error);
        res.status(500).json({ error: 'Error al generar el reporte de errores' });
    }
});

// POST /api/superadmin/errores/subir-git — sube el .md a GitHub vía API REST
// (no toca el git de producción). Necesita GITHUB_TOKEN en el .env del server.
router.post('/errores/subir-git', async (req, res) => {
    try {
        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO || 'alaninn/gestionq24';
        const rama = process.env.GITHUB_REPORTES_BRANCH || 'reportes-errores';
        if (!token) {
            return res.status(400).json({
                error: 'Falta configurar GITHUB_TOKEN en el servidor. Por ahora usá "Descargar".',
                sinToken: true,
            });
        }

        const reporte = await construirReporteErrores();

        // Si no hay errores reales, no subimos nada (no ensuciar la rama de reportes)
        if (!reporte.hayErrores) {
            return res.json({ vacio: true, mensaje: 'No hay errores para enviar 🎉 No se subió nada.' });
        }

        const md = reporte.md;
        const nombre = `reportes/errores-${fechaArchivoAr()}.md`;
        const api = `https://api.github.com/repos/${repo}`;
        const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'gestionq24', Accept: 'application/vnd.github+json' };

        // Asegurar que la rama de reportes exista (si no, crearla desde la default)
        try {
            await axios.get(`${api}/git/ref/heads/${rama}`, { headers });
        } catch (e) {
            if (e.response?.status === 404) {
                const repoInfo = await axios.get(api, { headers });
                const base = repoInfo.data.default_branch || 'master';
                const baseRef = await axios.get(`${api}/git/ref/heads/${base}`, { headers });
                await axios.post(`${api}/git/refs`, { ref: `refs/heads/${rama}`, sha: baseRef.data.object.sha }, { headers });
            } else { throw e; }
        }

        // Subir el archivo (nombre único → no necesita sha de archivo previo)
        const contenidoB64 = Buffer.from(md, 'utf8').toString('base64');
        const r = await axios.put(`${api}/contents/${encodeURIComponent(nombre).replace(/%2F/g, '/')}`, {
            message: `Reporte de errores ${fechaLegibleAr()}`,
            content: contenidoB64,
            branch: rama,
        }, { headers });

        // Subido OK → limpiar las fuentes para no repetir estos errores en el próximo reporte
        await limpiarFuentesReporte(reporte);

        res.json({
            mensaje: 'Reporte subido a GitHub',
            archivo: nombre,
            rama,
            url: r.data.content?.html_url || null,
            limpiado: { errores_pantalla: reporte.idsFront.length, log_servidor: !!reporte.logPath },
        });
    } catch (error) {
        console.error('Error subiendo reporte a git:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.message || 'Error al subir el reporte a GitHub' });
    }
});

// =============================================
// CONFIGURACIÓN DE PLANES (límites y funciones editables)
// =============================================
const { invalidarCachePlanes } = require('../middleware/planLimites');

// GET /api/superadmin/finanzas — resumen de cobros/ingresos y alertas
router.get('/finanzas', async (req, res) => {
    try {
        const [cobros, estimado, estados, ultimos] = await Promise.all([
            db.query(`
                SELECT
                    COALESCE(SUM(monto) FILTER (WHERE pagado), 0) AS total,
                    COALESCE(SUM(monto) FILTER (WHERE pagado AND date_trunc('month', fecha) = date_trunc('month', NOW())), 0) AS mes,
                    COALESCE(SUM(monto) FILTER (WHERE pagado AND fecha > NOW() - INTERVAL '30 days'), 0) AS ult30,
                    COUNT(*) FILTER (WHERE date_trunc('month', fecha) = date_trunc('month', NOW())) AS pagos_mes
                FROM pagos_historial
            `),
            db.query(`
                SELECT COALESCE(SUM(pc.precio), 0) AS ingreso_estimado
                FROM negocios n
                LEFT JOIN planes_config pc ON pc.plan = n.plan
                WHERE n.estado = 'activo'
            `),
            db.query(`
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE estado = 'activo') AS activos,
                    COUNT(*) FILTER (WHERE fecha_vencimiento IS NOT NULL AND fecha_vencimiento < NOW()) AS vencidos,
                    COUNT(*) FILTER (WHERE fecha_vencimiento IS NOT NULL AND fecha_vencimiento >= NOW() AND fecha_vencimiento < NOW() + INTERVAL '7 days') AS por_vencer,
                    COUNT(*) FILTER (WHERE plan = 'premium') AS premium,
                    COUNT(*) FILTER (WHERE plan = 'estandar') AS estandar
                FROM negocios
            `),
            db.query(`
                SELECT ph.monto, ph.fecha, ph.metodo_pago, ph.tipo, ph.pagado, n.nombre AS negocio
                FROM pagos_historial ph
                JOIN negocios n ON n.id = ph.negocio_id
                ORDER BY ph.fecha DESC
                LIMIT 8
            `),
        ]);

        const c = cobros.rows[0];
        const e = estados.rows[0];
        res.json({
            cobrado_mes: Number(c.mes),
            cobrado_total: Number(c.total),
            cobrado_30d: Number(c.ult30),
            pagos_mes: parseInt(c.pagos_mes),
            ingreso_estimado: Number(estimado.rows[0].ingreso_estimado),
            negocios: {
                total: parseInt(e.total),
                activos: parseInt(e.activos),
                vencidos: parseInt(e.vencidos),
                por_vencer: parseInt(e.por_vencer),
                premium: parseInt(e.premium),
                estandar: parseInt(e.estandar),
            },
            ultimos_pagos: ultimos.rows,
        });
    } catch (error) {
        console.error('Error obteniendo finanzas:', error);
        res.status(500).json({ error: 'Error al obtener finanzas' });
    }
});

// GET /api/superadmin/planes — configuración actual de cada plan
router.get('/planes', async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM planes_config ORDER BY max_productos ASC');
        res.json(r.rows);
    } catch (error) {
        console.error('Error obteniendo planes:', error);
        res.status(500).json({ error: 'Error al obtener configuración de planes' });
    }
});

// PUT /api/superadmin/planes/:plan — editar límites y funciones de un plan
router.put('/planes/:plan', async (req, res) => {
    try {
        const { plan } = req.params;
        const { max_productos, max_usuarios, facturacion_electronica, reportes_avanzados, precio, modulos } = req.body;

        const maxProd = parseInt(max_productos);
        const maxUsu = parseInt(max_usuarios);
        if (isNaN(maxProd) || maxProd < 1 || isNaN(maxUsu) || maxUsu < 1) {
            return res.status(400).json({ error: 'Los límites deben ser números mayores a 0' });
        }

        const precioNum = Math.max(0, parseInt(precio) || 0);
        // modulos: array de claves de módulos habilitados. null/ausente = todos.
        const modulosJson = Array.isArray(modulos) ? JSON.stringify(modulos) : null;

        const r = await db.query(`
            UPDATE planes_config SET
                max_productos = $1,
                max_usuarios = $2,
                facturacion_electronica = $3,
                reportes_avanzados = $4,
                precio = $5,
                modulos = $6::jsonb,
                updated_at = NOW()
            WHERE plan = $7
            RETURNING *
        `, [maxProd, maxUsu, !!facturacion_electronica, !!reportes_avanzados, precioNum, modulosJson, plan]);

        if (r.rows.length === 0) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        // Que el cambio aplique de inmediato en todo el sistema
        invalidarCachePlanes();

        res.json({ mensaje: 'Plan actualizado', plan: r.rows[0] });
    } catch (error) {
        console.error('Error actualizando plan:', error);
        res.status(500).json({ error: 'Error al actualizar el plan' });
    }
});

module.exports = router;