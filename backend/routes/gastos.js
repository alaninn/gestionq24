const express = require('express');
const { verificarPermiso } = require('../middleware/auth');
const router = express.Router();
const db = require('../config/database');

router.get('/', verificarPermiso('gastos', 'ver'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { fecha_desde, fecha_hasta, tipo, con_boleta, proveedor_id, es_compra } = req.query;

        let where = 'WHERE g.negocio_id = $1';
        let valores = [negocio_id];
        let contador = 2;

        if (fecha_desde) { where += ` AND g.fecha >= $${contador}`; valores.push(fecha_desde); contador++; }
        if (fecha_hasta) { where += ` AND g.fecha <= $${contador}`; valores.push(fecha_hasta + ' 23:59:59'); contador++; }
        if (tipo && tipo !== 'todos') { where += ` AND g.tipo = $${contador}`; valores.push(tipo); contador++; }
        if (es_compra === 'true' || es_compra === '1') { where += ` AND g.es_compra = TRUE`; }
        if (es_compra === 'false' || es_compra === '0') { where += ` AND g.es_compra = FALSE`; }
        if (con_boleta === 'true' || con_boleta === '1') { where += ` AND g.tipo_documento IN ('boleta','factura')`; }
        if (con_boleta === 'false' || con_boleta === '0') { where += ` AND (g.tipo_documento IS NULL OR g.tipo_documento = 'sin_boleta')`; }
        if (proveedor_id) { where += ` AND g.proveedor_id = $${contador}`; valores.push(proveedor_id); contador++; }

        const consulta = `
            SELECT g.*, p.nombre AS proveedor_nombre
            FROM gastos g
            LEFT JOIN proveedores p ON p.id = g.proveedor_id AND p.negocio_id = g.negocio_id
            ${where}
            ORDER BY g.fecha DESC
        `;
        const resultado = await db.query(consulta, valores);
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener gastos' });
    }
});

router.post('/', verificarPermiso('gastos', 'crear'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const {
            descripcion,
            monto,
            categoria,
            turno_id,
            tipo,
            metodo_pago,
            proveedor_id,
            recibo_url,
            es_compra,
            tipo_documento,
            tipo_comprobante,
            condicion_iva_proveedor,
            numero_boleta,
            iva_incluido,
            porcentaje_iva,
            productos_json,
            tipo_pago_proveedor,
            estado_pago
        } = req.body;

        if (!monto || Number(monto) <= 0) return res.status(400).json({ error: 'El monto es obligatorio y debe ser mayor a 0' });

        // Validar que proveedor exista si se proporciona
        if (proveedor_id) {
            const proveedor = await db.query('SELECT id FROM proveedores WHERE id = $1 AND negocio_id = $2',
                [proveedor_id, negocio_id]);
            if (proveedor.rows.length === 0) {
                return res.status(400).json({ error: 'Proveedor no encontrado' });
            }
        }

        const tipoFinal = es_compra ? 'compra' : (tipo || 'variable');
        const ivaPct = Number(porcentaje_iva || 0);
        const incluyeIva = iva_incluido === true || iva_incluido === 'true' || iva_incluido === 1 || iva_incluido === '1';
        let montoIva = 0;
        if (ivaPct > 0) {
            if (incluyeIva) {
                montoIva = Number((Number(monto) * ivaPct / (100 + ivaPct)).toFixed(2));
            } else {
                montoIva = Number((Number(monto) * ivaPct / 100).toFixed(2));
            }
        }

        const resultado = await db.query(`
            INSERT INTO gastos (descripcion, monto, categoria, turno_id, tipo, metodo_pago, negocio_id, proveedor_id, recibo_url, es_compra, tipo_documento, tipo_comprobante, condicion_iva_proveedor, numero_boleta, iva_incluido, porcentaje_iva, monto_iva, productos_json, tipo_pago_proveedor, estado_pago)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *
        `, [
            descripcion || '',
            monto,
            categoria || null,
            turno_id || null,
            tipoFinal,
            metodo_pago || 'efectivo',
            negocio_id,
            proveedor_id || null,
            recibo_url || null,
            es_compra || false,
            tipo_documento || null,
            tipo_comprobante || null,
            condicion_iva_proveedor || null,
            numero_boleta || null,
            incluyeIva,
            ivaPct,
            montoIva,
            productos_json ? JSON.stringify(productos_json) : null,
            tipo_pago_proveedor || null,
            estado_pago || 'pagado'
        ]);

        // Si es pago a proveedor, actualizar saldo
        if (proveedor_id && tipoFinal === 'pago_proveedor') {
            await db.query(`
                UPDATE proveedores 
                SET saldo_deuda = GREATEST(saldo_deuda - $1, 0)
                WHERE id = $2 AND negocio_id = $3
            `, [monto, proveedor_id, negocio_id]);
        }

        // Si es compra con deuda, se suma a saldo de deuda del proveedor
        if (proveedor_id && es_compra && (estado_pago === 'deuda' || estado_pago === 'pendiente')) {
            await db.query(`
                UPDATE proveedores
                SET saldo_deuda = saldo_deuda + $1
                WHERE id = $2 AND negocio_id = $3
            `, [monto, proveedor_id, negocio_id]);
        }

        res.status(201).json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al crear gasto' });
    }
});

router.delete('/:id', verificarPermiso('gastos', 'eliminar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        await db.query('DELETE FROM gastos WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        res.json({ mensaje: 'Gasto eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar gasto' });
    }
});

// =============================================
// PUT - Editar gasto
// =============================================
router.put('/:id', verificarPermiso('gastos', 'editar'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const {
            descripcion,
            monto,
            categoria,
            turno_id,
            tipo,
            metodo_pago,
            proveedor_id,
            recibo_url,
            fecha,
            es_compra,
            tipo_documento,
            tipo_comprobante,
            condicion_iva_proveedor,
            numero_boleta,
            iva_incluido,
            porcentaje_iva,
            productos_json,
            tipo_pago_proveedor,
            estado_pago
        } = req.body;

        if (!monto || Number(monto) <= 0) return res.status(400).json({ error: 'El monto es obligatorio y debe ser mayor a 0' });

        if (proveedor_id) {
            const proveedor = await db.query('SELECT id FROM proveedores WHERE id = $1 AND negocio_id = $2',
                [proveedor_id, negocio_id]);
            if (proveedor.rows.length === 0) {
                return res.status(400).json({ error: 'Proveedor no encontrado' });
            }
        }

        const ivaPct = Number(porcentaje_iva || 0);
        const incluyeIva = iva_incluido === true || iva_incluido === 'true' || iva_incluido === 1 || iva_incluido === '1';
        let montoIva = 0;
        if (ivaPct > 0) {
            if (incluyeIva) {
                montoIva = Number((Number(monto) * ivaPct / (100 + ivaPct)).toFixed(2));
            } else {
                montoIva = Number((Number(monto) * ivaPct / 100).toFixed(2));
            }
        }

        const resultado = await db.query(`
            UPDATE gastos
            SET descripcion=$1, monto=$2, categoria=$3, turno_id=$4, tipo=$5, metodo_pago=$6,
                proveedor_id=$7, recibo_url=$8, fecha=$9, es_compra=$10, tipo_documento=$11, tipo_comprobante=$12, condicion_iva_proveedor=$13, numero_boleta=$14,
                iva_incluido=$15, porcentaje_iva=$16, monto_iva=$17, productos_json=$18,
                tipo_pago_proveedor=$19, estado_pago=$20
            WHERE id=$21 AND negocio_id=$22
            RETURNING *
        `, [
            descripcion || '',
            monto,
            categoria || null,
            turno_id || null,
            tipo || (es_compra ? 'compra' : 'variable'),
            metodo_pago || 'efectivo',
            proveedor_id || null,
            recibo_url || null,
            fecha || null,
            es_compra || false,
            tipo_documento || null,
            tipo_comprobante || null,
            condicion_iva_proveedor || null,
            numero_boleta || null,
            incluyeIva,
            ivaPct,
            montoIva,
            productos_json ? JSON.stringify(productos_json) : null,
            tipo_pago_proveedor || null,
            estado_pago || 'pagado',
            req.params.id,
            negocio_id
        ]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Gasto no encontrado' });
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al editar gasto' });
    }
});

module.exports = router;