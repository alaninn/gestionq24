const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { soloAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const resultado = await db.query(
            'SELECT * FROM configuracion WHERE negocio_id = $1 LIMIT 1',
            [negocio_id]
        );
        res.json(resultado.rows[0] || {});
    } catch (error) {
        console.error('Error al obtener configuración:', error);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

router.put('/', soloAdmin, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const {
            nombre_negocio, cuit, direccion, telefono, email,
            recargo_tarjeta, descuento_maximo, permite_stock_negativo,
            moneda, permite_venta_rapida, permite_precio_mayorista,
            validar_monto_efectivo, recargo_modo, descuento_modo,
            pin_cierre, escaner_barras, impresion_tickets, impresion_tickets_automatica,
            ocultar_stock_pos, metodos_pago_activos, nombre_ticket,
            mostrar_stock_pos, cantidad_minima_mayorista,
            redondeo_precios, color_primario, modo_oscuro,
            tamanio_ticket, tamanio_ticket_personalizado,
            facturacion_electronica_activa, regimen_fiscal, punto_venta_arca,
            tipo_comprobante_default, entorno_arca,
            ingresos_brutos, inicio_actividades, condicion_iva,
            recargo_general, limite_aviso_pago_virtual, cajas_corte_hora
        } = req.body;

        const resultado = await db.query(`
            INSERT INTO configuracion (
                negocio_id, nombre_negocio, cuit, direccion, telefono, email,
                recargo_tarjeta, descuento_maximo, permite_stock_negativo,
                moneda, permite_venta_rapida, permite_precio_mayorista,
                validar_monto_efectivo, recargo_modo, descuento_modo,
                pin_cierre, escaner_barras, impresion_tickets, impresion_tickets_automatica,
                ocultar_stock_pos, metodos_pago_activos, nombre_ticket,
                mostrar_stock_pos, cantidad_minima_mayorista,
                redondeo_precios, color_primario, modo_oscuro,
                tamanio_ticket, tamanio_ticket_personalizado,
                facturacion_electronica_activa, regimen_fiscal, punto_venta_arca,
                tipo_comprobante_default, entorno_arca,
                ingresos_brutos, inicio_actividades, condicion_iva,
                recargo_general, limite_aviso_pago_virtual, cajas_corte_hora,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
                $30, $31, $32, $33, $34,
                $35, $36, $37,
                $38, $39, $40,
                NOW()
            )
            ON CONFLICT (negocio_id) DO UPDATE SET
                nombre_negocio=EXCLUDED.nombre_negocio, cuit=EXCLUDED.cuit, direccion=EXCLUDED.direccion, telefono=EXCLUDED.telefono, email=EXCLUDED.email,
                recargo_tarjeta=EXCLUDED.recargo_tarjeta, descuento_maximo=EXCLUDED.descuento_maximo, permite_stock_negativo=EXCLUDED.permite_stock_negativo,
                moneda=EXCLUDED.moneda, permite_venta_rapida=EXCLUDED.permite_venta_rapida, permite_precio_mayorista=EXCLUDED.permite_precio_mayorista,
                validar_monto_efectivo=EXCLUDED.validar_monto_efectivo, recargo_modo=EXCLUDED.recargo_modo, descuento_modo=EXCLUDED.descuento_modo,
                pin_cierre=EXCLUDED.pin_cierre, escaner_barras=EXCLUDED.escaner_barras, impresion_tickets=EXCLUDED.impresion_tickets, impresion_tickets_automatica=EXCLUDED.impresion_tickets_automatica,
                ocultar_stock_pos=EXCLUDED.ocultar_stock_pos, metodos_pago_activos=EXCLUDED.metodos_pago_activos, nombre_ticket=EXCLUDED.nombre_ticket,
                mostrar_stock_pos=EXCLUDED.mostrar_stock_pos, cantidad_minima_mayorista=EXCLUDED.cantidad_minima_mayorista,
                redondeo_precios=EXCLUDED.redondeo_precios, color_primario=EXCLUDED.color_primario, modo_oscuro=EXCLUDED.modo_oscuro,
                tamanio_ticket=EXCLUDED.tamanio_ticket, tamanio_ticket_personalizado=EXCLUDED.tamanio_ticket_personalizado,
                facturacion_electronica_activa=EXCLUDED.facturacion_electronica_activa,
                regimen_fiscal=EXCLUDED.regimen_fiscal,
                punto_venta_arca=EXCLUDED.punto_venta_arca,
                tipo_comprobante_default=EXCLUDED.tipo_comprobante_default,
                entorno_arca=EXCLUDED.entorno_arca,
                ingresos_brutos=EXCLUDED.ingresos_brutos,
                inicio_actividades=EXCLUDED.inicio_actividades,
                condicion_iva=EXCLUDED.condicion_iva,
                recargo_general=EXCLUDED.recargo_general,
                limite_aviso_pago_virtual=EXCLUDED.limite_aviso_pago_virtual,
                cajas_corte_hora=EXCLUDED.cajas_corte_hora,
                updated_at=NOW()
            RETURNING *
        `, [
            negocio_id, nombre_negocio, cuit, direccion, telefono, email,
            recargo_tarjeta, descuento_maximo, permite_stock_negativo,
            moneda, permite_venta_rapida, permite_precio_mayorista,
            validar_monto_efectivo, recargo_modo, descuento_modo,
            pin_cierre, escaner_barras, impresion_tickets, impresion_tickets_automatica,
            ocultar_stock_pos, JSON.stringify(metodos_pago_activos || ['efectivo']),
            nombre_ticket, mostrar_stock_pos,
            cantidad_minima_mayorista || 5, redondeo_precios || 0,
            color_primario || '#f97316', modo_oscuro ?? true,
            tamanio_ticket || '80', tamanio_ticket_personalizado || 80,
            facturacion_electronica_activa || false,
            regimen_fiscal || 'responsable_inscripto',
            punto_venta_arca || 1,
            tipo_comprobante_default || 1,
            entorno_arca || 'homologacion',
            ingresos_brutos || null,
            inicio_actividades || null,
            condicion_iva || null,
            recargo_general || 0,
            (limite_aviso_pago_virtual === '' || limite_aviso_pago_virtual == null) ? 100000 : parseFloat(limite_aviso_pago_virtual),
            // 0 = dia calendario; 1..23 = hora de corte del turno noche. Se acota al rango valido.
            Math.min(23, Math.max(0, parseInt(cajas_corte_hora) || 0))
        ]);

        if (color_primario) {
            await db.query(
                'UPDATE negocios SET color_primario = $1 WHERE id = $2',
                [color_primario, negocio_id]
            );
        }

        res.json(resultado.rows[0]);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

// =============================================
// PUT /cajas
// Actualiza SOLO la configuración de cajas (día comercial + alerta de cierre),
// sin tocar el resto de la config. Se usa desde el panel de Control de Cajas.
// =============================================
router.put('/cajas', soloAdmin, async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

        const { alerta_cierre_activa, alerta_cierre_minutos, cierre_politica } = req.body;

        const minutos = alerta_cierre_minutos == null ? null : Math.min(120, Math.max(5, parseInt(alerta_cierre_minutos) || 30));
        const politica = cierre_politica == null ? null : (['seguir', 'forzar'].includes(cierre_politica) ? cierre_politica : 'seguir');
        const activa = alerta_cierre_activa == null ? null : !!alerta_cierre_activa;

        // Nos aseguramos de que exista la fila de configuración del negocio.
        await db.query(
            'INSERT INTO configuracion (negocio_id) VALUES ($1) ON CONFLICT (negocio_id) DO NOTHING',
            [negocio_id]
        );

        const resultado = await db.query(`
            UPDATE configuracion SET
                alerta_cierre_activa = COALESCE($1, alerta_cierre_activa),
                alerta_cierre_minutos = COALESCE($2, alerta_cierre_minutos),
                cierre_politica = COALESCE($3, cierre_politica),
                updated_at = NOW()
            WHERE negocio_id = $4
            RETURNING alerta_cierre_activa, alerta_cierre_minutos, cierre_politica
        `, [activa, minutos, politica, negocio_id]);

        res.json(resultado.rows[0] || {});
    } catch (error) {
        console.error('Error al actualizar config de cajas:', error);
        res.status(500).json({ error: 'Error al actualizar la configuración de cajas' });
    }
});

// =============================================
// POST /reiniciar-datos
// Borra de forma selectiva los datos del negocio (estadísticas, gastos/compras,
// caja, fiados, comprobantes AFIP y/o productos), dejando todo en cero, sin tocar
// el catálogo salvo que se pida explícitamente. Es IRREVERSIBLE. Solo admin.
// Requiere body.confirmacion === 'ELIMINAR'. Todo en una transacción y scoping
// por negocio_id. Respeta las dependencias de claves foráneas.
// =============================================
router.post('/reiniciar-datos', soloAdmin, async (req, res) => {
    const negocio_id = req.negocio_id || req.usuario?.negocio_id;
    if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

    const { confirmacion, borrar } = req.body || {};
    if (confirmacion !== 'ELIMINAR') {
        return res.status(400).json({ error: 'Tenés que escribir ELIMINAR para confirmar.' });
    }
    const sel = borrar || {};
    // Resolver dependencias por FKs: borrar productos o caja obliga a borrar ventas
    const borrarVentas = !!sel.ventas || !!sel.productos || !!sel.caja;
    const borrarGastos = !!sel.gastos;
    const borrarCaja = !!sel.caja;
    const borrarFiados = !!sel.fiados;
    const borrarComprobantes = !!sel.comprobantes;
    const borrarProductos = !!sel.productos;

    if (!borrarVentas && !borrarGastos && !borrarCaja && !borrarFiados && !borrarComprobantes && !borrarProductos) {
        return res.status(400).json({ error: 'No seleccionaste nada para borrar.' });
    }

    const borrado = {};
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Si se borran comprobantes pero NO las ventas, hay que soltar la FK de ventas
        if (borrarComprobantes && !borrarVentas) {
            await client.query(
                'UPDATE ventas SET comprobante_electronico_id = NULL WHERE negocio_id = $1',
                [negocio_id]
            );
        }

        // 1) Ventas y estadísticas
        if (borrarVentas) {
            const vi = await client.query('DELETE FROM venta_items WHERE negocio_id = $1', [negocio_id]);
            const ve = await client.query('DELETE FROM ventas WHERE negocio_id = $1', [negocio_id]);
            const hs = await client.query('DELETE FROM historial_stock WHERE negocio_id = $1', [negocio_id]);
            borrado.venta_items = vi.rowCount;
            borrado.ventas = ve.rowCount;
            borrado.historial_stock = hs.rowCount;
        }

        // 2) Gastos y compras (+ saldos de proveedores a 0)
        if (borrarGastos) {
            const ga = await client.query('DELETE FROM gastos WHERE negocio_id = $1', [negocio_id]);
            await client.query('UPDATE proveedores SET saldo_deuda = 0, saldo_a_favor = 0 WHERE negocio_id = $1', [negocio_id]);
            borrado.gastos = ga.rowCount;
        }

        // 3) Caja, turnos y retiros
        if (borrarCaja) {
            const tu = await client.query('DELETE FROM turno_usuarios WHERE negocio_id = $1', [negocio_id]);
            const tu2 = await client.query('DELETE FROM turnos WHERE negocio_id = $1', [negocio_id]);
            const re = await client.query('DELETE FROM retiros WHERE negocio_id = $1', [negocio_id]);
            borrado.turno_usuarios = tu.rowCount;
            borrado.turnos = tu2.rowCount;
            borrado.retiros = re.rowCount;
        }

        // 4) Fiados / cuentas corrientes (+ saldo de clientes a 0)
        if (borrarFiados) {
            const pd = await client.query('DELETE FROM pagos_deuda WHERE negocio_id = $1', [negocio_id]);
            await client.query('UPDATE clientes SET saldo_deuda = 0 WHERE negocio_id = $1', [negocio_id]);
            borrado.pagos_deuda = pd.rowCount;
        }

        // 5) Comprobantes electrónicos AFIP
        if (borrarComprobantes) {
            const ce = await client.query('DELETE FROM comprobantes_electronicos WHERE negocio_id = $1', [negocio_id]);
            borrado.comprobantes_electronicos = ce.rowCount;
        }

        // 6) Borrado total de productos (deja categorías y secciones de stock)
        if (borrarProductos) {
            await client.query('DELETE FROM producto_codigos WHERE negocio_id = $1', [negocio_id]);
            // producto_combo puede no existir en instalaciones viejas. Borrado defensivo
            // con SAVEPOINT: si la tabla no existe, el error no aborta toda la transacción.
            await client.query('SAVEPOINT sp_combo');
            try {
                await client.query('DELETE FROM producto_combo WHERE negocio_id = $1', [negocio_id]);
                await client.query('RELEASE SAVEPOINT sp_combo');
            } catch (e) {
                await client.query('ROLLBACK TO SAVEPOINT sp_combo');
            }
            const pr = await client.query('DELETE FROM productos WHERE negocio_id = $1', [negocio_id]);
            borrado.productos = pr.rowCount;
        }

        await client.query('COMMIT');
        res.json({ ok: true, borrado });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al reiniciar datos:', error);
        res.status(500).json({ error: 'Error al reiniciar los datos: ' + (error.message || '') });
    } finally {
        client.release();
    }
});

module.exports = router;