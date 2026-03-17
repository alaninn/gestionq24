const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/historial', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const { fecha_desde, fecha_hasta } = req.query;

        const ventas = await db.query(`
            SELECT v.*, COUNT(vi.id) as cantidad_items,
                SUM(vi.cantidad * vi.precio_unitario) as subtotal_items
            FROM ventas v
            LEFT JOIN venta_items vi ON v.id = vi.venta_id
            WHERE v.fecha::date >= $1::date 
              AND v.fecha::date <= $2::date 
              AND v.negocio_id = $3
            GROUP BY v.id
            ORDER BY v.fecha DESC
        `, [fecha_desde, fecha_hasta, negocio_id]);

        const totalVendido = ventas.rows.reduce((acc, v) => acc + parseFloat(v.total), 0);
        const totalVentas = ventas.rows.length;
        const porMetodo = ventas.rows.reduce((acc, v) => {
            acc[v.metodo_pago] = (acc[v.metodo_pago] || 0) + parseFloat(v.total);
            return acc;
        }, {});
        const porDia = ventas.rows.reduce((acc, v) => {
            const dia = new Date(v.fecha).toISOString().split('T')[0];
            acc[dia] = (acc[dia] || 0) + parseFloat(v.total);
            return acc;
        }, {});
        const ticketPromedio = totalVentas > 0 ? totalVendido / totalVentas : 0;

        res.json({ ventas: ventas.rows, totalVendido, totalVentas, ticketPromedio, porMetodo, porDia });
    } catch (error) {
        console.error('Error en historial:', error);
        res.status(500).json({ error: 'Error al generar historial' });
    }
});

router.get('/productos-vendidos', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const { fecha_desde, fecha_hasta } = req.query;

        const resultado = await db.query(`
            SELECT 
                vi.producto_id,
                vi.nombre_producto,
                p.codigo,
                c.nombre AS categoria,
                SUM(vi.cantidad) AS total_cantidad,
                SUM(vi.subtotal) AS total_facturado,
                AVG(vi.precio_unitario) AS precio_promedio,
                COUNT(DISTINCT v.id) AS veces_vendido
            FROM venta_items vi
            JOIN ventas v ON vi.venta_id = v.id
            LEFT JOIN productos p ON vi.producto_id = p.id
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE v.fecha::date >= $1::date
              AND v.fecha::date <= $2::date
              AND v.negocio_id = $3
            GROUP BY vi.producto_id, vi.nombre_producto, p.codigo, c.nombre
            ORDER BY total_cantidad DESC
        `, [fecha_desde, fecha_hasta, negocio_id]);

        res.json(resultado.rows);
    } catch (error) {
        console.error('Error productos vendidos:', error);
        res.status(500).json({ error: 'Error al generar reporte' });
    }
});

router.get('/por-turno', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const { fecha_desde, fecha_hasta } = req.query;

        const resultado = await db.query(`
            SELECT 
                t.id, t.fecha_apertura, t.fecha_cierre,
                t.inicio_caja, t.estado,
                COUNT(v.id) AS total_ventas,
                COALESCE(SUM(v.total), 0) AS total_facturado,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'efectivo' THEN v.total ELSE 0 END), 0) AS efectivo,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'tarjeta' THEN v.total ELSE 0 END), 0) AS tarjeta,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'mercadopago' THEN v.total ELSE 0 END), 0) AS mercadopago,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'transferencia' THEN v.total ELSE 0 END), 0) AS transferencia,
                COALESCE(g.total_gastos, 0) AS total_gastos
            FROM turnos t
            LEFT JOIN ventas v ON v.turno_id = t.id
            LEFT JOIN (
                SELECT turno_id, SUM(monto) AS total_gastos
                FROM gastos WHERE negocio_id = $3
                GROUP BY turno_id
            ) g ON g.turno_id = t.id
            WHERE t.fecha_apertura::date >= $1::date
              AND t.fecha_apertura::date <= $2::date
              AND t.negocio_id = $3
            GROUP BY t.id, g.total_gastos
            ORDER BY t.fecha_apertura DESC
        `, [fecha_desde, fecha_hasta, negocio_id]);

        res.json(resultado.rows);
    } catch (error) {
        console.error('Error reporte por turno:', error);
        res.status(500).json({ error: 'Error al generar reporte por turno' });
    }
});

router.get('/rentabilidad', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const { fecha_desde, fecha_hasta } = req.query;

        const porProducto = await db.query(`
            SELECT 
                vi.nombre_producto,
                p.codigo,
                SUM(vi.cantidad) AS cantidad_vendida,
                SUM(vi.subtotal) AS total_vendido,
                SUM(vi.cantidad * p.precio_costo) AS total_costo,
                SUM(vi.subtotal) - SUM(vi.cantidad * p.precio_costo) AS ganancia,
                CASE 
                    WHEN SUM(vi.subtotal) > 0 
                    THEN ROUND(((SUM(vi.subtotal) - SUM(vi.cantidad * p.precio_costo)) / SUM(vi.subtotal) * 100)::numeric, 2)
                    ELSE 0 
                END AS margen_porcentaje
            FROM venta_items vi
            JOIN ventas v ON vi.venta_id = v.id
            LEFT JOIN productos p ON vi.producto_id = p.id
            WHERE v.fecha::date >= $1::date
              AND v.fecha::date <= $2::date
              AND v.negocio_id = $3
            GROUP BY vi.nombre_producto, p.codigo, p.precio_costo
            ORDER BY ganancia DESC
        `, [fecha_desde, fecha_hasta, negocio_id]);

        const porCategoria = await db.query(`
            SELECT 
                COALESCE(c.nombre, 'Sin categoría') AS categoria,
                SUM(vi.cantidad) AS cantidad_vendida,
                SUM(vi.subtotal) AS total_vendido,
                SUM(vi.cantidad * p.precio_costo) AS total_costo,
                SUM(vi.subtotal) - SUM(vi.cantidad * p.precio_costo) AS ganancia
            FROM venta_items vi
            JOIN ventas v ON vi.venta_id = v.id
            LEFT JOIN productos p ON vi.producto_id = p.id
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE v.fecha::date >= $1::date
              AND v.fecha::date <= $2::date
              AND v.negocio_id = $3
            GROUP BY c.nombre
            ORDER BY ganancia DESC
        `, [fecha_desde, fecha_hasta, negocio_id]);

        res.json({ porProducto: porProducto.rows, porCategoria: porCategoria.rows });
    } catch (error) {
        console.error('Error rentabilidad:', error);
        res.status(500).json({ error: 'Error al generar reporte de rentabilidad' });
    }
});

router.get('/stock', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;

        const resultado = await db.query(`
            SELECT p.*, c.nombre AS categoria,
                p.stock * p.precio_costo AS valor_costo,
                p.stock * p.precio_venta AS valor_venta
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.activo = TRUE AND p.negocio_id = $1
            ORDER BY p.nombre ASC
        `, [negocio_id]);

        const totalProductos = resultado.rows.length;
        const valorTotalCosto = resultado.rows.reduce((acc, p) => acc + parseFloat(p.valor_costo || 0), 0);
        const valorTotalVenta = resultado.rows.reduce((acc, p) => acc + parseFloat(p.valor_venta || 0), 0);
        const productosStockBajo = resultado.rows.filter(p => p.stock <= p.stock_minimo).length;

        res.json({ productos: resultado.rows, totalProductos, valorTotalCosto, valorTotalVenta, productosStockBajo });
    } catch (error) {
        console.error('Error stock:', error);
        res.status(500).json({ error: 'Error al generar reporte de stock' });
    }
});

router.get('/por-categoria', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const { fecha_desde, fecha_hasta, categoria_id } = req.query;

        const resultado = await db.query(`
            SELECT 
                vi.nombre_producto, p.codigo,
                SUM(vi.cantidad) AS total_cantidad,
                SUM(vi.subtotal) AS total_facturado,
                SUM(vi.cantidad * p.precio_costo) AS total_costo,
                SUM(vi.subtotal) - SUM(vi.cantidad * p.precio_costo) AS ganancia,
                COUNT(DISTINCT v.id) AS veces_vendido
            FROM venta_items vi
            JOIN ventas v ON vi.venta_id = v.id
            LEFT JOIN productos p ON vi.producto_id = p.id
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE v.fecha::date >= $1::date
              AND v.fecha::date <= $2::date
              AND p.categoria_id = $3
              AND v.negocio_id = $4
            GROUP BY vi.nombre_producto, p.codigo, p.precio_costo
            ORDER BY total_cantidad DESC
        `, [fecha_desde, fecha_hasta, categoria_id, negocio_id]);

        const totalVendido = resultado.rows.reduce((acc, r) => acc + parseFloat(r.total_facturado), 0);
        const totalCosto = resultado.rows.reduce((acc, r) => acc + parseFloat(r.total_costo || 0), 0);
        const totalUnidades = resultado.rows.reduce((acc, r) => acc + parseFloat(r.total_cantidad), 0);

        res.json({
            productos: resultado.rows,
            totalVendido, totalCosto, totalUnidades,
            gananciaTotal: totalVendido - totalCosto,
        });
    } catch (error) {
        console.error('Error reporte por categoría:', error);
        res.status(500).json({ error: 'Error al generar reporte por categoría' });
    }
});

router.get('/control-caja', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const { fecha_desde, fecha_hasta } = req.query;

        const resultado = await db.query(`
            SELECT 
                t.*,
                COUNT(v.id) AS total_ventas,
                COALESCE(SUM(v.total), 0) AS total_facturado,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'efectivo' THEN v.total ELSE 0 END), 0) AS ventas_efectivo,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'tarjeta' THEN v.total ELSE 0 END), 0) AS ventas_tarjeta,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'mercadopago' THEN v.total ELSE 0 END), 0) AS ventas_mp,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'transferencia' THEN v.total ELSE 0 END), 0) AS ventas_transferencia,
                COALESCE(g.total_gastos, 0) AS total_gastos
            FROM turnos t
            LEFT JOIN ventas v ON v.turno_id = t.id
            LEFT JOIN (
                SELECT turno_id, SUM(monto) AS total_gastos
                FROM gastos WHERE negocio_id = $3
                GROUP BY turno_id
            ) g ON g.turno_id = t.id
            WHERE t.fecha_apertura::date >= $1::date
              AND t.fecha_apertura::date <= $2::date
              AND t.negocio_id = $3
            GROUP BY t.id, g.total_gastos
            ORDER BY t.fecha_apertura DESC
        `, [fecha_desde, fecha_hasta, negocio_id]);

        const totales = {
            total_ventas: resultado.rows.reduce((a, r) => a + parseInt(r.total_ventas), 0),
            total_facturado: resultado.rows.reduce((a, r) => a + parseFloat(r.total_facturado), 0),
            total_gastos: resultado.rows.reduce((a, r) => a + parseFloat(r.total_gastos), 0),
        };

        res.json({ turnos: resultado.rows, totales });
    } catch (error) {
        console.error('Error control caja:', error);
        res.status(500).json({ error: 'Error al obtener control de caja' });
    }
});

router.get('/dashboard', async (req, res) => {
    try {
        const negocio_id = req.usuario.negocio_id || 1;
        const hoy = new Date();
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

        const ventasPorDia = await db.query(`
            SELECT 
                DATE(fecha) AS dia,
                COUNT(*) AS cantidad,
                COALESCE(SUM(total), 0) AS total
            FROM ventas
            WHERE negocio_id = $1
              AND fecha::date >= NOW()::date - 30
            GROUP BY DATE(fecha)
            ORDER BY dia ASC
        `, [negocio_id]);

        const ventasPorMetodo = await db.query(`
            SELECT 
                metodo_pago,
                COUNT(*) AS cantidad,
                COALESCE(SUM(total), 0) AS total
            FROM ventas
            WHERE negocio_id = $1
              AND fecha::date >= $2::date
              AND fecha::date <= $3::date
            GROUP BY metodo_pago
            ORDER BY total DESC
        `, [negocio_id, inicioMes, finMes]);

        const topProductos = await db.query(`
            SELECT 
                vi.nombre_producto,
                SUM(vi.cantidad) AS cantidad_vendida,
                SUM(vi.subtotal) AS total_facturado
            FROM venta_items vi
            JOIN ventas v ON vi.venta_id = v.id
            WHERE v.negocio_id = $1
              AND v.fecha::date >= $2::date
              AND v.fecha::date <= $3::date
            GROUP BY vi.nombre_producto
            ORDER BY cantidad_vendida DESC
            LIMIT 5
        `, [negocio_id, inicioMes, finMes]);

        const stats = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM productos WHERE negocio_id = $1 AND activo = TRUE) AS total_productos,
                (SELECT COUNT(*) FROM ventas WHERE negocio_id = $1 AND fecha::date >= $2::date) AS ventas_mes,
                (SELECT COALESCE(SUM(total), 0) FROM ventas WHERE negocio_id = $1 AND fecha::date >= $2::date) AS facturado_mes,
                (SELECT COALESCE(SUM(monto), 0) FROM gastos WHERE negocio_id = $1 AND fecha::date >= $2::date) AS gastos_mes,
                (SELECT COUNT(*) FROM productos WHERE negocio_id = $1 AND activo = TRUE AND stock <= stock_minimo) AS stock_bajo,
                (SELECT COALESCE(SUM(saldo_deuda), 0) FROM clientes WHERE negocio_id = $1 AND activo = TRUE) AS total_deudas
        `, [negocio_id, inicioMes]);

        const comparacion = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN fecha::date = CURRENT_DATE THEN total ELSE 0 END), 0) AS hoy,
                COALESCE(SUM(CASE WHEN fecha::date = CURRENT_DATE - 1 THEN total ELSE 0 END), 0) AS ayer,
                COUNT(CASE WHEN fecha::date = CURRENT_DATE THEN 1 END) AS ventas_hoy,
                COUNT(CASE WHEN fecha::date = CURRENT_DATE - 1 THEN 1 END) AS ventas_ayer
            FROM ventas
            WHERE negocio_id = $1
              AND fecha::date >= CURRENT_DATE - 1
        `, [negocio_id]);

        res.json({
            stats: stats.rows[0],
            ventasPorDia: ventasPorDia.rows,
            ventasPorMetodo: ventasPorMetodo.rows,
            topProductos: topProductos.rows,
            comparacion: comparacion.rows[0],
        });

    } catch (error) {
        console.error('Error dashboard:', error);
        res.status(500).json({ error: 'Error al obtener datos del dashboard' });
    }
});

module.exports = router;