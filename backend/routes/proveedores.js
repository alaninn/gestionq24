const express = require('express');
const { verificarPermiso } = require('../middleware/auth');
const router = express.Router();
const db = require('../config/database');

// =============================================
// GET - Listado de proveedores
// =============================================
router.get('/', verificarPermiso('proveedores', 'ver'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        
        const { buscar, activo } = req.query;
        let consulta = 'SELECT * FROM proveedores WHERE negocio_id = $1';
        let valores = [negocio_id];
        let contador = 2;

        if (activo === 'false' || activo === '0' || activo === 'no') {
            consulta += ' AND activo = FALSE';
        } else if (activo === 'true' || activo === '1' || activo === 'si') {
            consulta += ' AND activo = TRUE';
        } else {
            // Por defecto, solo activos
            consulta += ' AND activo = TRUE';
        }

        if (buscar) {
            consulta += ` AND (nombre ILIKE $${contador} OR telefono ILIKE $${contador} OR email ILIKE $${contador})`;
            valores.push(`%${buscar}%`);
            contador++;
        }

        consulta += ' ORDER BY nombre ASC';
        const resultado = await db.query(consulta, valores);
        res.json(resultado.rows);
    } catch (error) {
        console.error('❌ Error al obtener proveedores:', error.message);
        res.status(500).json({ error: `Error al obtener proveedores: ${error.message}` });
    }
});

// =============================================
// GET - Detalle de un proveedor + histórico de pagos
// =============================================
router.get('/:id', verificarPermiso('proveedores', 'ver'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        console.log('Cargando detalle proveedor:', req.params.id, 'negocio:', negocio_id);

        const proveedor = await db.query(
            'SELECT * FROM proveedores WHERE id = $1 AND negocio_id = $2',
            [parseInt(req.params.id), negocio_id]
        );

        if (proveedor.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        // Obtener estadísticas generales
        const estadisticas = await db.query(`
            SELECT
                COUNT(*) as total_gastos,
                COALESCE(SUM(monto), 0) as total_monto,
                COALESCE(AVG(monto), 0) as promedio_gasto,
                MIN(fecha) as primer_gasto,
                MAX(fecha) as ultimo_gasto,
                COUNT(*) FILTER (WHERE tipo_documento IN ('boleta','factura')) as con_boleta,
                COUNT(*) FILTER (WHERE tipo_documento IS NULL OR tipo_documento = 'sin_boleta') as sin_boleta,
                COALESCE(SUM(monto_iva), 0) as total_iva,
                COALESCE(SUM(CASE WHEN es_compra THEN monto ELSE 0 END), 0) as total_compras
            FROM gastos
            WHERE proveedor_id = $1 AND negocio_id = $2
        `, [parseInt(req.params.id), negocio_id]);

        // Obtener histórico de pagos/movimientos con filtros opcionales
        const { fecha_desde, fecha_hasta, periodo } = req.query;
        let whereClause = 'g.proveedor_id = $1 AND g.negocio_id = $2';
        let valores = [parseInt(req.params.id), negocio_id];
        let contador = 3;

        if (fecha_desde) {
            whereClause += ` AND g.fecha >= $${contador}`;
            valores.push(fecha_desde);
            contador++;
        }
        if (fecha_hasta) {
            whereClause += ` AND g.fecha <= $${contador}`;
            valores.push(fecha_hasta + ' 23:59:59');
            contador++;
        }

        // Filtros por período predefinido
        if (periodo) {
            const hoy = new Date();
            const offset = hoy.getTimezoneOffset() * 60000;
            const local = new Date(hoy - offset);
            const hoyStr = local.toISOString().split('T')[0];

            if (periodo === 'hoy') {
                whereClause += ` AND DATE(g.fecha) = $${contador}`;
                valores.push(hoyStr);
                contador++;
            } else if (periodo === 'semana') {
                const semanaAtras = new Date(hoy);
                semanaAtras.setDate(hoy.getDate() - 7);
                const semanaStr = semanaAtras.toISOString().split('T')[0];
                whereClause += ` AND DATE(g.fecha) >= $${contador}`;
                valores.push(semanaStr);
                contador++;
            } else if (periodo === 'mes') {
                const mesAtras = new Date(hoy);
                mesAtras.setMonth(hoy.getMonth() - 1);
                const mesStr = mesAtras.toISOString().split('T')[0];
                whereClause += ` AND DATE(g.fecha) >= $${contador}`;
                valores.push(mesStr);
                contador++;
            }
        }

        const movimientos = await db.query(`
            SELECT
                g.id,
                g.fecha,
                g.monto,
                g.descripcion,
                g.metodo_pago,
                g.recibo_url,
                g.tipo,
                g.es_compra,
                g.tipo_comprobante,
                g.registrar_nueva_factura,
                g.total_factura,
                'pago' as tipo_movimiento
            FROM gastos g
            WHERE ${whereClause}
            ORDER BY g.fecha DESC
        `, valores);

        // Obtener estadísticas por período
        const statsPorPeriodo = await db.query(`
            SELECT
                DATE_TRUNC('month', fecha) as mes,
                COUNT(*) as cantidad,
                SUM(monto) as total
            FROM gastos
            WHERE proveedor_id = $1 AND negocio_id = $2
            GROUP BY DATE_TRUNC('month', fecha)
            ORDER BY mes DESC
            LIMIT 12
        `, [parseInt(req.params.id), negocio_id]);

        res.json({
            ...proveedor.rows[0],
            estadisticas: estadisticas.rows[0],
            movimientos: movimientos.rows,
            estadisticas_por_mes: statsPorPeriodo.rows
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al obtener proveedor' });
    }
});

// =============================================
// POST - Crear proveedor
// =============================================
router.post('/', verificarPermiso('proveedores', 'crear'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        
        const { nombre, telefono, email, direccion, notas } = req.body;
        
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        
        const resultado = await db.query(`
            INSERT INTO proveedores 
            (nombre, telefono, email, direccion, notas, negocio_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [nombre.trim(), telefono || null, email || null, direccion || null, notas || null, negocio_id]);
        
        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        console.error('❌ Error al crear proveedor:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: `Error al crear proveedor: ${error.message}` });
    }
});

// =============================================
// PUT - Editar proveedor
// =============================================
router.put('/:id', verificarPermiso('proveedores', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        
        const { nombre, telefono, email, direccion, notas, saldo_deuda, saldo_a_favor } = req.body;
        
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        
        const resultado = await db.query(`
            UPDATE proveedores 
            SET nombre=$1, telefono=$2, email=$3, direccion=$4, notas=$5, 
                saldo_deuda=$6, saldo_a_favor=$7, updated_at=CURRENT_TIMESTAMP
            WHERE id=$8 AND negocio_id=$9
            RETURNING *
        `, [
            nombre.trim(),
            telefono || null,
            email || null,
            direccion || null,
            notas || null,
            saldo_deuda || 0,
            saldo_a_favor || 0,
            parseInt(req.params.id),
            negocio_id
        ]);
        
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }
        
        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('❌ Error al editar proveedor:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: `Error al editar proveedor: ${error.message}` });
    }
});

// =============================================
// PATCH - Reactivar proveedor archivado
// =============================================
router.patch('/:id/reactivar', verificarPermiso('proveedores', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        await db.query(
            'UPDATE proveedores SET activo = TRUE WHERE id = $1 AND negocio_id = $2',
            [parseInt(req.params.id), negocio_id]
        );

        res.json({ mensaje: 'Proveedor reactivado' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al reactivar proveedor' });
    }
});

// =============================================
// DELETE - Eliminar definitivo proveedor
// =============================================
router.delete('/:id/definitivo', verificarPermiso('proveedores', 'eliminar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        await db.query(
            'DELETE FROM proveedores WHERE id = $1 AND negocio_id = $2',
            [parseInt(req.params.id), negocio_id]
        );

        res.json({ mensaje: 'Proveedor eliminado definitivamente' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar proveedor' });
    }
});

// =============================================
// DELETE - Archivar proveedor (soft delete)
// =============================================
router.delete('/:id', verificarPermiso('proveedores', 'eliminar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        
        await db.query(
            'UPDATE proveedores SET activo = FALSE WHERE id = $1 AND negocio_id = $2',
            [parseInt(req.params.id), negocio_id]
        );
        
        res.json({ mensaje: 'Proveedor desactivado' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al eliminar proveedor' });
    }
});

// =============================================
// POST - Registrar pago a proveedor
// =============================================
router.post('/:id/pago', verificarPermiso('proveedores', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const { monto, metodo_pago, tipo_pago, descripcion, recibo_url } = req.body;

        if (!monto || monto <= 0) {
            return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
        }

        // Verificar que el proveedor existe
        const proveedor = await db.query(
            'SELECT * FROM proveedores WHERE id = $1 AND negocio_id = $2',
            [parseInt(req.params.id), negocio_id]
        );

        if (proveedor.rows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        const proveedorData = proveedor.rows[0];

        // Crear el gasto como pago a proveedor
        const gasto = await db.query(`
            INSERT INTO gastos 
            (monto, metodo_pago, tipo, descripcion, fecha, proveedor_id, negocio_id, recibo_url)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)
            RETURNING *
        `, [
            monto,
            metodo_pago || 'efectivo',
            'pago_proveedor',
            descripcion || 'Pago a proveedor',
            req.params.id,
            negocio_id,
            recibo_url || null
        ]);

        // Actualizar saldos del proveedor
        let nuevoSaldoDeuda = proveedorData.saldo_deuda || 0;
        let nuevoSaldoFavor = proveedorData.saldo_a_favor || 0;

        if (tipo_pago === 'pago_deuda') {
            // Nosotros pagamos nuestra deuda al proveedor
            nuevoSaldoFavor = Math.max(0, nuevoSaldoFavor - monto);
        } else if (tipo_pago === 'cobro_deuda') {
            // El proveedor nos pagó lo que nos debía
            nuevoSaldoDeuda = Math.max(0, nuevoSaldoDeuda - monto);
        } else {
            // Pago nuevo / anticipo - aumenta saldo a favor
            nuevoSaldoFavor = nuevoSaldoFavor + monto;
        }

        await db.query(`
            UPDATE proveedores 
            SET saldo_deuda = $1, saldo_a_favor = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND negocio_id = $4
        `, [nuevoSaldoDeuda, nuevoSaldoFavor, parseInt(req.params.id), negocio_id]);

        res.status(201).json({
            mensaje: 'Pago registrado correctamente',
            gasto: gasto.rows[0],
            saldo_deuda: nuevoSaldoDeuda,
            saldo_a_favor: nuevoSaldoFavor
        });
    } catch (error) {
        console.error('❌ Error al registrar pago:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: `Error al registrar pago: ${error.message}` });
    }
});

module.exports = router;
