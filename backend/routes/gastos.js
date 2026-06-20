const express = require('express');
const { verificarPermiso } = require('../middleware/auth');
const router = express.Router();
const db = require('../config/database');

router.get('/', verificarPermiso('gastos', 'ver'), async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { fecha_desde, fecha_hasta, tipo, con_boleta, proveedor_id, es_compra, con_factura } = req.query;

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
        // Gastos "en blanco" (Factura A/B/C): suman IVA crédito al Resumen Fiscal
        if (con_factura === 'true' || con_factura === '1') { where += ` AND g.tipo_comprobante IN ('factura_a','factura_b','factura_c')`; }

        const consulta = `
            SELECT g.*, p.nombre AS proveedor_nombre, u.nombre AS usuario_nombre
            FROM gastos g
            LEFT JOIN proveedores p ON p.id = g.proveedor_id AND p.negocio_id = g.negocio_id
            LEFT JOIN usuarios u ON u.id = g.usuario_id
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
            estado_pago,
            fecha
        } = req.body;

        // ✅ FIX Error 22P02: Validar cadena vacia y asegurar que sea numero valido
        if (monto === undefined || monto === null || monto === '' || isNaN(Number(monto)) || Number(monto) < 0) {
            return res.status(400).json({ error: 'El monto es obligatorio y debe ser un numero valido mayor o igual a 0' });
        }
        // Convertir definitivamente a numero antes de enviar a PostgreSQL
        const montoNumerico = Number(monto);

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

        const { registrar_nueva_factura, total_factura, pago_independiente } = req.body;

        // origen_dinero: 'caja' (afecta el cierre del turno) | 'local' | 'otro'
        const origenDinero = ['caja', 'local', 'otro'].includes(req.body.origen_dinero)
            ? req.body.origen_dinero : 'caja';

        // Fecha del gasto: si el usuario eligió un día distinto a HOY (ej. cargar
        // un gasto de hace 3 días), se respeta esa fecha (a las 12:00 para evitar
        // saltos por zona horaria). Si es hoy o no vino, se usa NOW() para
        // conservar la hora real. Antes el INSERT no enviaba `fecha` y siempre
        // quedaba el día de hoy aunque el usuario eligiera otro.
        let fechaGasto = null;
        if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            const hoyArg = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
            if (fecha !== hoyArg) fechaGasto = `${fecha} 12:00:00`;
        }

        const resultado = await db.query(`
            INSERT INTO gastos (descripcion, monto, categoria, turno_id, tipo, metodo_pago, negocio_id, proveedor_id, recibo_url, es_compra, tipo_documento, tipo_comprobante, condicion_iva_proveedor, numero_boleta, iva_incluido, porcentaje_iva, monto_iva, productos_json, tipo_pago_proveedor, estado_pago, registrar_nueva_factura, total_factura, usuario_id, origen_dinero, fecha)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24, COALESCE($25, NOW())) RETURNING *
        `, [
            descripcion || '',
            montoNumerico,
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
            estado_pago || 'pagado',
            registrar_nueva_factura || false,
            total_factura || null,
            req.usuario?.id || null,   // quién registró el gasto (del token, no editable)
            origenDinero,
            fechaGasto                 // null → NOW() (vía COALESCE); si no, la fecha elegida
        ]);

        // Si es pago a proveedor, actualizar saldo
        if (proveedor_id && tipoFinal === 'pago_proveedor') {
            const { registrar_nueva_factura, total_factura, pago_independiente } = req.body;
            
            // Si es pago independiente no modificamos la deuda
            if (!pago_independiente) {
                
                // Si se registra una nueva factura, sumamos lo que YO LE DEBO al proveedor
                if (registrar_nueva_factura && total_factura && Number(total_factura) > 0) {
                    await db.query(`
                        UPDATE proveedores 
                        SET saldo_a_favor = saldo_a_favor + $1
                        WHERE id = $2 AND negocio_id = $3
                    `, [Number(total_factura), proveedor_id, negocio_id]);
                }
                
                // Luego restamos lo que le PAGUE al proveedor de la deuda (saldo_a_favor)
                if (Number(monto) > 0) {
                    await db.query(`
                        UPDATE proveedores 
                        SET saldo_a_favor = GREATEST(0, saldo_a_favor - $1)
                        WHERE id = $2 AND negocio_id = $3
                    `, [Number(monto), proveedor_id, negocio_id]);
                }
            }
        }

        // Compra asignada a proveedor: la deuda que genera es el total de la
        // compra menos lo pagado. Se suma a saldo_a_favor ("le debemos"),
        // igual que el resto del circuito de proveedores.
        // (En compras, `monto` = lo PAGADO y `total_factura` = total de la compra.)
        if (proveedor_id && es_compra) {
            const totalCompra = Number(total_factura) > 0 ? Number(total_factura) : montoNumerico;
            let deudaGenerada = 0;
            if (estado_pago === 'deuda' || estado_pago === 'pendiente') deudaGenerada = totalCompra;
            else if (estado_pago === 'parcial') deudaGenerada = Math.max(0, totalCompra - montoNumerico);

            if (deudaGenerada > 0) {
                await db.query(`
                    UPDATE proveedores
                    SET saldo_a_favor = saldo_a_favor + $1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2 AND negocio_id = $3
                `, [deudaGenerada, proveedor_id, negocio_id]);
            }
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

        const g = await db.query('SELECT * FROM gastos WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        if (g.rows.length === 0) return res.status(404).json({ error: 'Gasto no encontrado' });
        const gasto = g.rows[0];

        // Revertir el efecto del gasto en los saldos del proveedor (si aplica)
        if (gasto.proveedor_id) {
            const monto = Number(gasto.monto) || 0;
            if (gasto.es_compra) {
                // La compra había generado deuda nuestra → la descontamos
                const totalCompra = Number(gasto.total_factura) > 0 ? Number(gasto.total_factura) : monto;
                let deudaGenerada = 0;
                if (gasto.estado_pago === 'deuda' || gasto.estado_pago === 'pendiente') deudaGenerada = totalCompra;
                else if (gasto.estado_pago === 'parcial') deudaGenerada = Math.max(0, totalCompra - monto);
                if (deudaGenerada > 0) {
                    await db.query(`
                        UPDATE proveedores SET saldo_a_favor = GREATEST(0, saldo_a_favor - $1), updated_at = CURRENT_TIMESTAMP
                        WHERE id = $2 AND negocio_id = $3
                    `, [deudaGenerada, gasto.proveedor_id, negocio_id]);
                }
            } else if (gasto.tipo === 'pago_proveedor' && monto > 0) {
                // Un pago había bajado un saldo → lo restauramos.
                // (Solo si sabemos de qué tipo fue; los registros viejos sin tipo no se tocan.)
                if (gasto.tipo_pago_proveedor === 'cobro_deuda') {
                    await db.query(`
                        UPDATE proveedores SET saldo_deuda = saldo_deuda + $1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $2 AND negocio_id = $3
                    `, [monto, gasto.proveedor_id, negocio_id]);
                } else if (gasto.tipo_pago_proveedor === 'pago_deuda' || gasto.tipo_pago_proveedor === 'a_cuenta') {
                    await db.query(`
                        UPDATE proveedores SET saldo_a_favor = saldo_a_favor + $1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $2 AND negocio_id = $3
                    `, [monto, gasto.proveedor_id, negocio_id]);
                }
            }
        }

        await db.query('DELETE FROM gastos WHERE id = $1 AND negocio_id = $2', [req.params.id, negocio_id]);
        res.json({ mensaje: 'Gasto eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar gasto:', error);
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

        // ✅ FIX Error 22P02: Validar cadena vacia y asegurar que sea numero valido
        if (monto === undefined || monto === null || monto === '' || isNaN(Number(monto)) || Number(monto) <= 0) {
            return res.status(400).json({ error: 'El monto es obligatorio y debe ser un numero valido mayor a 0' });
        }
        // Convertir definitivamente a numero antes de enviar a PostgreSQL
        const montoNumerico = Number(monto);

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

        const origenDinero = ['caja', 'local', 'otro'].includes(req.body.origen_dinero)
            ? req.body.origen_dinero : null;

        const resultado = await db.query(`
            UPDATE gastos
            SET descripcion=$1, monto=$2, categoria=$3, turno_id=$4, tipo=$5, metodo_pago=$6,
                proveedor_id=$7, recibo_url=$8, fecha=COALESCE($9, fecha), es_compra=$10, tipo_documento=$11, tipo_comprobante=$12, condicion_iva_proveedor=$13, numero_boleta=$14,
                iva_incluido=$15, porcentaje_iva=$16, monto_iva=$17, productos_json=$18,
                tipo_pago_proveedor=$19, estado_pago=$20,
                origen_dinero=COALESCE($23, origen_dinero)
            WHERE id=$21 AND negocio_id=$22
            RETURNING *
        `, [
            descripcion || '',
            montoNumerico,
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
            negocio_id,
            origenDinero
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