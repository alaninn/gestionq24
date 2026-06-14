// =============================================
// ARCHIVO: routes/usuarios.js
// FUNCIÓN: Gestión de usuarios del negocio
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { validarLimitePlan, LIMITES_PLANES } = require('../middleware/planLimites');

// Todas las rutas requieren token
router.use(verificarToken);

// Plantillas de permisos por defecto (si el negocio no las personalizó)
const PLANTILLAS_DEFAULT = {
    encargado: {
        dashboard: ['ver'],
        productos: ['ver', 'crear', 'editar'],
        stock: ['ver'],
        caja: ['ver', 'abrir', 'cerrar'],
        clientes: ['ver', 'crear'],
        proveedores: ['ver', 'crear', 'editar'],
        gastos: ['ver', 'crear'],
        resumen_fiscal: ['ver'],
        reportes: ['ver'],
        ventas: ['ver', 'crear'],
    },
    cajero: {
        caja: ['abrir', 'cerrar'],
        clientes: ['ver'],
        proveedores: ['ver', 'crear'],
        gastos: ['crear'],
        ventas: ['crear'],
    },
};

// -----------------------------------------------
// GET /api/usuarios/plantillas — plantillas de permisos del negocio
// -----------------------------------------------
router.get('/plantillas', soloAdmin, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const r = await db.query('SELECT rol, permisos FROM plantillas_permisos WHERE negocio_id = $1', [negocio_id]);
        const guardadas = {};
        for (const row of r.rows) guardadas[row.rol] = row.permisos;
        res.json({
            encargado: guardadas.encargado || PLANTILLAS_DEFAULT.encargado,
            cajero: guardadas.cajero || PLANTILLAS_DEFAULT.cajero,
        });
    } catch (error) {
        console.error('Error obteniendo plantillas:', error);
        res.status(500).json({ error: 'Error al obtener las plantillas' });
    }
});

// -----------------------------------------------
// PUT /api/usuarios/plantillas/:rol — guardar la plantilla de un rol
// -----------------------------------------------
router.put('/plantillas/:rol', soloAdmin, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const rol = req.params.rol;
        if (!['encargado', 'cajero'].includes(rol)) {
            return res.status(400).json({ error: 'Solo se pueden editar las plantillas de encargado y cajero' });
        }
        const permisos = req.body.permisos || {};
        await db.query(`
            INSERT INTO plantillas_permisos (negocio_id, rol, permisos, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (negocio_id, rol) DO UPDATE SET permisos = $3, updated_at = NOW()
        `, [negocio_id, rol, JSON.stringify(permisos)]);
        res.json({ mensaje: 'Plantilla guardada', rol, permisos });
    } catch (error) {
        console.error('Error guardando plantilla:', error);
        res.status(500).json({ error: 'Error al guardar la plantilla' });
    }
});

// -----------------------------------------------
// RUTA: GET /api/usuarios
// FUNCIÓN: Traer usuarios del negocio actual (o todos si es superadmin)
// -----------------------------------------------
router.get('/', soloAdmin, async (req, res) => {
    try {
        // Si es superadmin, puede ver todos los usuarios o filtrar por negocio con header
        if (req.usuario.rol === 'superadmin') {
            const negocio_id_filtro = req.headers['x-negocio-id'];

            if (negocio_id_filtro) {
                // Superadmin filtrando por negocio específico
                const resultado = await db.query(`
                    SELECT id, nombre, email, username, rol, permisos, activo, ultimo_acceso, created_at, negocio_id
                    FROM usuarios
                    WHERE negocio_id = $1
                    ORDER BY created_at ASC
                `, [parseInt(negocio_id_filtro)]);
                return res.json(resultado.rows);
            } else {
                // Superadmin viendo todos los usuarios
                const resultado = await db.query(`
                    SELECT u.id, u.nombre, u.email, u.username, u.rol, u.permisos, u.activo, u.ultimo_acceso, u.created_at, u.negocio_id,
                           n.nombre as negocio_nombre
                    FROM usuarios u
                    LEFT JOIN negocios n ON u.negocio_id = n.id
                    WHERE u.rol != 'superadmin'
                    ORDER BY u.negocio_id, u.created_at ASC
                `);
                return res.json(resultado.rows);
            }
        }

        // Para admin normal, requiere negocio_id
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const resultado = await db.query(`
            SELECT id, nombre, email, username, rol, permisos, activo, ultimo_acceso, created_at
            FROM usuarios
            WHERE negocio_id = $1
            ORDER BY created_at ASC
        `, [negocio_id]);

        res.json(resultado.rows);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// -----------------------------------------------
// RUTA: POST /api/usuarios
// FUNCIÓN: Crear nuevo usuario para el negocio
// -----------------------------------------------
router.post('/', soloAdmin, validarLimitePlan, async (req, res) => {
    try {
        const { nombre, username, email, password, rol, permisos } = req.body;

        if (!nombre || !username || !password) {
            return res.status(400).json({ error: 'Nombre, usuario y contraseña son obligatorios' });
        }

        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        // Verificar límite de usuarios según plan. El superadmin tiene poder
        // total: puede crear usuarios extra en cualquier negocio sin límite.
        if (req.usuario?.rol !== 'superadmin') {
            const plan = req.planUsuario || req.usuario?.plan || 'estandar';
            const limites = req.limitesPlan || LIMITES_PLANES[plan] || LIMITES_PLANES.estandar;
            const countRes = await db.query(
                'SELECT COUNT(*) FROM usuarios WHERE negocio_id = $1 AND activo = TRUE',
                [negocio_id]
            );
            const totalActual = parseInt(countRes.rows[0].count);
            if (totalActual >= limites.max_usuarios) {
                return res.status(403).json({
                    error: `Límite de ${limites.max_usuarios} usuarios alcanzado para el plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}. Para agregar más usuarios necesitás el Plan Premium.`,
                    limitePlan: true,
                    limite: limites.max_usuarios,
                    plan
                });
            }
        }

        // Verificar que el username no esté en uso en el mismo negocio
        const usernameExiste = await db.query(
            'SELECT id FROM usuarios WHERE username = $1 AND negocio_id = $2 AND activo = TRUE',
            [username, negocio_id]
        );
        if (usernameExiste.rows.length > 0) {
            return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' });
        }

        const rolFinal = rol || 'cajero';

        const resultado = await db.query(`
            INSERT INTO usuarios (negocio_id, nombre, username, email, password_hash, rol, permisos)
            VALUES ($1, $2, $3, $4, crypt($5, gen_salt('bf')), $6, $7)
            RETURNING id, nombre, username, email, rol, permisos, activo, created_at
        `, [
            negocio_id,
            nombre,
            username,
            email || null,
            password,
            rolFinal,
            JSON.stringify(permisos || {})
        ]);

        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
        }
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// -----------------------------------------------
// RUTA: PUT /api/usuarios/:id
// FUNCIÓN: Editar usuario
// -----------------------------------------------
router.put('/:id', soloAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, username, email, rol, permisos, activo, password } = req.body;

        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        
        // Verificar que el username no esté en uso por otro usuario del mismo negocio
        if (username) {
            const usernameExiste = await db.query(
                'SELECT id FROM usuarios WHERE username = $1 AND negocio_id = $2 AND id != $3 AND activo = TRUE',
                [username, negocio_id, id]
            );
            if (usernameExiste.rows.length > 0) {
                return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' });
            }
        }

        if (password) {
            await db.query(`
                UPDATE usuarios SET
                    nombre = $1, username = $2, email = $3, rol = $4,
                    permisos = $5, activo = $6,
                    password_hash = crypt($7, gen_salt('bf'))
                WHERE id = $8 AND negocio_id = $9
            `, [nombre, username, email || null, rol, JSON.stringify(permisos || {}), activo, password, id, negocio_id]);
        } else {
            await db.query(`
                UPDATE usuarios SET
                    nombre = $1, username = $2, email = $3, rol = $4,
                    permisos = $5, activo = $6
                WHERE id = $7 AND negocio_id = $8
            `, [nombre, username, email || null, rol, JSON.stringify(permisos || {}), activo, id, negocio_id]);
        }

       const resultado = await db.query(
            'SELECT id, nombre, email, rol, permisos, activo FROM usuarios WHERE id = $1 AND negocio_id = $2',
            [id, negocio_id]
        );
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al editar usuario' });
    }
});

// -----------------------------------------------
// RUTA: DELETE /api/usuarios/:id/permanente
// FUNCIÓN: Eliminar usuario permanentemente (hard delete)
// IMPORTANTE: Esta ruta debe ir ANTES de /:id para que Express la detecte correctamente
// -----------------------------------------------
router.delete('/:id/permanente', soloAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // No se puede eliminar a sí mismo
        if (parseInt(id) === req.usuario.id) {
            return res.status(400).json({ error: 'No podés eliminar tu propio usuario' });
        }

        // Verificar que el usuario existe
        const verificar = await db.query(
            'SELECT id, nombre, negocio_id, rol FROM usuarios WHERE id = $1',
            [id]
        );

        if (verificar.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const usuarioAEliminar = verificar.rows[0];

        // Si no es superadmin, verificar que el usuario pertenezca al mismo negocio
        if (req.usuario.rol !== 'superadmin') {
            const negocio_id = req.negocio_id || req.usuario?.negocio_id;
            if (!negocio_id) {
                return res.status(400).json({ error: 'negocio_id requerido' });
            }
            if (usuarioAEliminar.negocio_id !== negocio_id) {
                return res.status(403).json({ error: 'No tenés permiso para eliminar este usuario' });
            }
        }

        // No permitir eliminar otro superadmin
        if (usuarioAEliminar.rol === 'superadmin') {
            return res.status(403).json({ error: 'No se puede eliminar un superadmin' });
        }

        // Eliminar permanentemente dentro de una transacción.
        // Antes de borrar el usuario, limpiamos las referencias que bloquean (NO ACTION):
        //  - turno_usuarios: registros de membresía → se eliminan
        //  - turnos: turnos con datos financieros → se preserva el turno, se desvincula el usuario (SET NULL)
        // Las tablas salud_negocio y tickets_soporte usan ON DELETE SET NULL, no bloquean.
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM turno_usuarios WHERE usuario_id = $1', [id]);
            await client.query('UPDATE turnos SET usuario_id = NULL WHERE usuario_id = $1', [id]);
            await client.query('DELETE FROM usuarios WHERE id = $1', [id]);
            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        res.json({ mensaje: 'Usuario eliminado permanentemente' });
    } catch (error) {
        console.error('Error:', error);

        // Manejo específico de error de llave foránea (por si queda alguna referencia no contemplada)
        if (error.code === '23503') {
            return res.status(400).json({
                error: 'No se puede eliminar este usuario porque tiene datos relacionados. Desactivalo en lugar de eliminarlo.',
                detalles: error.detail
            });
        }

        res.status(500).json({ error: 'Error al eliminar usuario permanentemente' });
    }
});

// -----------------------------------------------
// RUTA: DELETE /api/usuarios/:id
// FUNCIÓN: Desactivar usuario (soft delete)
// -----------------------------------------------
router.delete('/:id', soloAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // No se puede eliminar a sí mismo
        if (parseInt(id) === req.usuario.id) {
            return res.status(400).json({ error: 'No podés desactivar tu propio usuario' });
        }

        // Verificar que el usuario existe
        const verificar = await db.query(
            'SELECT id, nombre, negocio_id, rol FROM usuarios WHERE id = $1',
            [id]
        );

        if (verificar.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const usuarioADesactivar = verificar.rows[0];

        // Si no es superadmin, verificar que el usuario pertenezca al mismo negocio
        if (req.usuario.rol !== 'superadmin') {
            const negocio_id = req.negocio_id || req.usuario?.negocio_id;
            if (!negocio_id) {
                return res.status(400).json({ error: 'negocio_id requerido' });
            }
            if (usuarioADesactivar.negocio_id !== negocio_id) {
                return res.status(403).json({ error: 'No tenés permiso para desactivar este usuario' });
            }
        }

        // No permitir desactivar otro superadmin
        if (usuarioADesactivar.rol === 'superadmin') {
            return res.status(403).json({ error: 'No se puede desactivar un superadmin' });
        }

        await db.query('UPDATE usuarios SET activo = FALSE WHERE id = $1', [id]);

        res.json({ mensaje: 'Usuario desactivado correctamente' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});


// -----------------------------------------------
// RUTA: GET /api/usuarios/plan-info
// FUNCIÓN: Obtener informacion del plan actual y limites usados
// -----------------------------------------------
router.get('/plan-info', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        
        const plan = req.planUsuario || req.usuario?.plan || 'estandar';
        const limites = req.limitesPlan || LIMITES_PLANES[plan] || LIMITES_PLANES.estandar;

        // Contar uso actual
        const countUsuarios = await db.query('SELECT COUNT(*) FROM usuarios WHERE negocio_id = $1 AND activo = TRUE', [negocio_id]);
        const countProductos = await db.query('SELECT COUNT(*) FROM productos WHERE negocio_id = $1 AND activo = TRUE', [negocio_id]);

        res.json({
            plan_actual: plan,
            limites: limites,
            uso_actual: {
                usuarios: parseInt(countUsuarios.rows[0].count),
                productos: parseInt(countProductos.rows[0].count)
            },
            caracteristicas: {
                facturacion_electronica: limites.facturacion_electronica,
                reportes_avanzados: limites.reportes_avanzados
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener informacion del plan' });
    }
});

module.exports = router;
