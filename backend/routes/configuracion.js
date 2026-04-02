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
            ingresos_brutos, inicio_actividades, condicion_iva
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
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
                $30, $31, $32, $33, $34,
                $35, $36, $37,
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
            condicion_iva || null
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

module.exports = router;