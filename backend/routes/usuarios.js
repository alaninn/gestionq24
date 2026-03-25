// =============================================
// ARCHIVO: routes/usuarios.js
// FUNCIÓN: Gestión de usuarios del negocio
// =============================================

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Todas las rutas requieren token
router.use(verificarToken);

// -----------------------------------------------
// RUTA: GET /api/usuarios
// FUNCIÓN: Traer usuarios del negocio actual
// -----------------------------------------------
router.get('/', soloAdmin, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const resultado = await db.query(`
            SELECT id, nombre, email, rol, permisos, activo, ultimo_acceso, created_at
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
router.post('/', soloAdmin, async (req, res) => {
    try {
        const { nombre, username, email, password, rol, permisos } = req.body;

        if (!nombre || !username || !password) {
            return res.status(400).json({ error: 'Nombre, usuario y contraseña son obligatorios' });
        }

        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        
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
// RUTA: DELETE /api/usuarios/:id
// FUNCIÓN: Desactivar usuario
// -----------------------------------------------
router.delete('/:id', soloAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // No se puede eliminar a sí mismo
        if (parseInt(id) === req.usuario.id) {
            return res.status(400).json({ error: 'No podés desactivar tu propio usuario' });
        }

        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        
        await db.query(
            'UPDATE usuarios SET activo = FALSE WHERE id = $1 AND negocio_id = $2',
            [id, negocio_id]
        );

        res.json({ mensaje: 'Usuario desactivado correctamente' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

module.exports = router;