const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const resultado = await db.query(
            'SELECT * FROM configuracion WHERE negocio_id = $1 LIMIT 1',
            [negocio_id]
        );
        res.json(resultado.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

router.put('/', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const {
            nombre_negocio, cuit, direccion, telefono, email,
            recargo_tarjeta, descuento_maximo, permite_stock_negativo,
            moneda, permite_venta_rapida, permite_precio_mayorista,
            validar_monto_efectivo, recargo_modo, descuento_modo,
            pin_cierre, escaner_barras, impresion_tickets,
            ocultar_stock_pos, metodos_pago_activos, nombre_ticket,
            mostrar_stock_pos, cantidad_minima_mayorista,
            redondeo_precios, color_primario, modo_oscuro
        } = req.body;

        const resultado = await db.query(`
            UPDATE configuracion SET
                nombre_negocio=$1, cuit=$2, direccion=$3, telefono=$4, email=$5,
                recargo_tarjeta=$6, descuento_maximo=$7, permite_stock_negativo=$8,
                moneda=$9, permite_venta_rapida=$10, permite_precio_mayorista=$11,
                validar_monto_efectivo=$12, recargo_modo=$13, descuento_modo=$14,
                pin_cierre=$15, escaner_barras=$16, impresion_tickets=$17,
                ocultar_stock_pos=$18, metodos_pago_activos=$19, nombre_ticket=$20,
                mostrar_stock_pos=$21, cantidad_minima_mayorista=$22,
                redondeo_precios=$23, color_primario=$24, modo_oscuro=$25,
                updated_at=NOW()
            WHERE negocio_id=$26
            RETURNING *
        `, [
            nombre_negocio, cuit, direccion, telefono, email,
            recargo_tarjeta, descuento_maximo, permite_stock_negativo,
            moneda, permite_venta_rapida, permite_precio_mayorista,
            validar_monto_efectivo, recargo_modo, descuento_modo,
            pin_cierre, escaner_barras, impresion_tickets,
            ocultar_stock_pos, JSON.stringify(metodos_pago_activos || ['efectivo']),
            nombre_ticket, mostrar_stock_pos,
            cantidad_minima_mayorista || 5, redondeo_precios || 0,
            color_primario || '#f97316', modo_oscuro ?? true,
            negocio_id
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