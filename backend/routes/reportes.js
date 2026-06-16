const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Sanea una fecha que llega por query: devuelve 'YYYY-MM-DD' válido o null.
// Evita el error de PostgreSQL "DateTimeParseError" cuando llega '' o basura.
function fechaONull(v) {
    if (!v || typeof v !== 'string') return null;
    const s = v.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : s;
}

// Rango seguro para reportes: si no mandan fechas válidas, usa un rango amplio.
function rangoSeguro(req) {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset() * 60000;
    const hoyStr = new Date(hoy - offset).toISOString().split('T')[0];
    return {
        desde: fechaONull(req.query.fecha_desde) || '2000-01-01',
        hasta: fechaONull(req.query.fecha_hasta) || hoyStr,
    };
}

router.get('/historial', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { turno_id } = req.query;
        const fecha_desde = fechaONull(req.query.fecha_desde);
        const fecha_hasta = fechaONull(req.query.fecha_hasta);

        let consulta = `
            SELECT v.*, COUNT(vi.id) as cantidad_items,
                SUM(vi.cantidad * vi.precio_unitario) as subtotal_items
            FROM ventas v
            LEFT JOIN venta_items vi ON v.id = vi.venta_id
            WHERE v.negocio_id = $1
        `;
        let valores = [negocio_id];
        let contador = 2;

        if (fecha_desde) { consulta += ` AND v.fecha::date >= $${contador}`; valores.push(fecha_desde); contador++; }
        if (fecha_hasta) { consulta += ` AND v.fecha::date <= $${contador}`; valores.push(fecha_hasta); contador++; }
        if (turno_id) { consulta += ` AND v.turno_id = $${contador}`; valores.push(turno_id); contador++; }

        consulta += ' GROUP BY v.id ORDER BY v.fecha DESC';
        const ventas = await db.query(consulta, valores);

        const totalVendido = ventas.rows.reduce((acc, v) => acc + parseFloat(v.total), 0);
        const totalVentas = ventas.rows.length;
        const porMetodo = ventas.rows.reduce((acc, v) => {
            if (v.metodo_pago === 'dividido') {
                // Repartir: la parte efectivo cuenta como efectivo y la virtual en su medio
                acc['efectivo'] = (acc['efectivo'] || 0) + (parseFloat(v.monto_efectivo) || 0);
                const mv = v.metodo_virtual || 'transferencia';
                acc[mv] = (acc[mv] || 0) + (parseFloat(v.monto_virtual) || 0);
            } else {
                acc[v.metodo_pago] = (acc[v.metodo_pago] || 0) + parseFloat(v.total);
            }
            return acc;
        }, {});
        const porDia = ventas.rows.reduce((acc, v) => {
            const dia = new Date(v.fecha).toISOString().split('T')[0];
            acc[dia] = (acc[dia] || 0) + parseFloat(v.total);
            return acc;
        }, {});
        const ticketPromedio = totalVentas > 0 ? totalVendido / totalVentas : 0;

        // Cuántas ventas se facturaron electrónicamente (con CAE)
        const facturadas = ventas.rows.filter(v => v.tipo_facturacion === 'electronica').length;
        const facturadoElectronico = ventas.rows
            .filter(v => v.tipo_facturacion === 'electronica')
            .reduce((acc, v) => acc + parseFloat(v.total), 0);

        // Gastos del turno: los pagados con dinero de la CAJA descuentan del
        // efectivo esperado en el cierre. Los de 'local'/'otro' no afectan.
        let gastosCaja = 0, gastosTotal = 0, gastosCantidad = 0;
        if (turno_id) {
            const g = await db.query(`
                SELECT
                    COALESCE(SUM(monto) FILTER (WHERE COALESCE(origen_dinero, 'caja') = 'caja'), 0) AS gastos_caja,
                    COALESCE(SUM(monto), 0) AS gastos_total,
                    COUNT(*) AS cantidad
                FROM gastos
                WHERE negocio_id = $1 AND turno_id = $2
            `, [negocio_id, turno_id]);
            gastosCaja = parseFloat(g.rows[0].gastos_caja) || 0;
            gastosTotal = parseFloat(g.rows[0].gastos_total) || 0;
            gastosCantidad = parseInt(g.rows[0].cantidad) || 0;
        }

        res.json({ ventas: ventas.rows, totalVendido, totalVentas, ticketPromedio, porMetodo, porDia, gastosCaja, gastosTotal, gastosCantidad, facturadas, facturadoElectronico });
    } catch (error) {
        console.error('Error en historial:', error);
        res.status(500).json({ error: 'Error al generar historial' });
    }
});

router.get('/productos-vendidos', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { desde, hasta } = rangoSeguro(req);

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
        `, [desde, hasta, negocio_id]);

        res.json(resultado.rows);
    } catch (error) {
        console.error('Error productos vendidos:', error);
        res.status(500).json({ error: 'Error al generar reporte' });
    }
});

router.get('/por-turno', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { desde, hasta } = rangoSeguro(req);

        const resultado = await db.query(`
            SELECT
                t.id, t.fecha_apertura, t.fecha_cierre,
                t.inicio_caja, t.estado, t.nombre AS nombre_caja,
                uc.nombre AS usuario_cierre_nombre,
                COUNT(v.id) AS total_ventas,
                COALESCE(SUM(v.total), 0) AS total_facturado,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'efectivo' THEN v.total WHEN v.metodo_pago = 'dividido' THEN COALESCE(v.monto_efectivo,0) ELSE 0 END), 0) AS efectivo,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'tarjeta' THEN v.total WHEN v.metodo_pago = 'dividido' AND v.metodo_virtual = 'tarjeta' THEN COALESCE(v.monto_virtual,0) ELSE 0 END), 0) AS tarjeta,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'mercadopago' THEN v.total WHEN v.metodo_pago = 'dividido' AND v.metodo_virtual = 'mercadopago' THEN COALESCE(v.monto_virtual,0) ELSE 0 END), 0) AS mercadopago,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'transferencia' THEN v.total WHEN v.metodo_pago = 'dividido' AND v.metodo_virtual = 'transferencia' THEN COALESCE(v.monto_virtual,0) ELSE 0 END), 0) AS transferencia,
                COALESCE(g.total_gastos, 0) AS total_gastos
            FROM turnos t
            LEFT JOIN usuarios uc ON uc.id = t.usuario_cierre_id
            LEFT JOIN ventas v ON v.turno_id = t.id
            LEFT JOIN (
                SELECT turno_id, SUM(monto) AS total_gastos
                FROM gastos WHERE negocio_id = $3
                GROUP BY turno_id
            ) g ON g.turno_id = t.id
            WHERE t.fecha_apertura::date >= $1::date
              AND t.fecha_apertura::date <= $2::date
              AND t.negocio_id = $3
            GROUP BY t.id, g.total_gastos, uc.nombre
            ORDER BY t.fecha_apertura DESC
        `, [desde, hasta, negocio_id]);

        res.json(resultado.rows);
    } catch (error) {
        console.error('Error reporte por turno:', error);
        res.status(500).json({ error: 'Error al generar reporte por turno' });
    }
});

router.get('/rentabilidad', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { desde, hasta } = rangoSeguro(req);

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
        `, [desde, hasta, negocio_id]);

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
        `, [desde, hasta, negocio_id]);

        res.json({ porProducto: porProducto.rows, porCategoria: porCategoria.rows });
    } catch (error) {
        console.error('Error rentabilidad:', error);
        res.status(500).json({ error: 'Error al generar reporte de rentabilidad' });
    }
});

router.get('/stock', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });

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
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { categoria_id } = req.query;
        const { desde, hasta } = rangoSeguro(req);

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
        `, [desde, hasta, categoria_id, negocio_id]);

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
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { desde, hasta } = rangoSeguro(req);

        const resultado = await db.query(`
            SELECT
                t.*,
                uc.nombre AS usuario_cierre_nombre,
                COUNT(v.id) AS total_ventas,
                COALESCE(SUM(v.total), 0) AS total_facturado,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'efectivo' THEN v.total WHEN v.metodo_pago = 'dividido' THEN COALESCE(v.monto_efectivo,0) ELSE 0 END), 0) AS ventas_efectivo,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'tarjeta' THEN v.total WHEN v.metodo_pago = 'dividido' AND v.metodo_virtual = 'tarjeta' THEN COALESCE(v.monto_virtual,0) ELSE 0 END), 0) AS ventas_tarjeta,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'mercadopago' THEN v.total WHEN v.metodo_pago = 'dividido' AND v.metodo_virtual = 'mercadopago' THEN COALESCE(v.monto_virtual,0) ELSE 0 END), 0) AS ventas_mp,
                COALESCE(SUM(CASE WHEN v.metodo_pago = 'transferencia' THEN v.total WHEN v.metodo_pago = 'dividido' AND v.metodo_virtual = 'transferencia' THEN COALESCE(v.monto_virtual,0) ELSE 0 END), 0) AS ventas_transferencia,
                COALESCE(g.total_gastos, 0) AS total_gastos
            FROM turnos t
            LEFT JOIN usuarios uc ON uc.id = t.usuario_cierre_id
            LEFT JOIN ventas v ON v.turno_id = t.id
            LEFT JOIN (
                SELECT turno_id, SUM(monto) AS total_gastos
                FROM gastos WHERE negocio_id = $3
                GROUP BY turno_id
            ) g ON g.turno_id = t.id
            WHERE t.fecha_apertura::date >= $1::date
              AND t.fecha_apertura::date <= $2::date
              AND t.negocio_id = $3
            GROUP BY t.id, g.total_gastos, uc.nombre
            ORDER BY t.fecha_apertura DESC
        `, [desde, hasta, negocio_id]);

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
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
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

        // Desglose por método repartiendo el pago dividido (efectivo + medio virtual)
        const ventasPorMetodo = await db.query(`
            WITH v AS (
                SELECT * FROM ventas
                WHERE negocio_id = $1 AND fecha::date >= $2::date AND fecha::date <= $3::date
            )
            SELECT metodo_pago, cantidad, total FROM (
                SELECT 'efectivo' AS metodo_pago,
                    COUNT(*) FILTER (WHERE metodo_pago IN ('efectivo','dividido')) AS cantidad,
                    COALESCE(SUM(CASE WHEN metodo_pago='efectivo' THEN total WHEN metodo_pago='dividido' THEN COALESCE(monto_efectivo,0) ELSE 0 END),0) AS total FROM v
                UNION ALL
                SELECT 'transferencia',
                    COUNT(*) FILTER (WHERE metodo_pago='transferencia' OR (metodo_pago='dividido' AND metodo_virtual='transferencia')),
                    COALESCE(SUM(CASE WHEN metodo_pago='transferencia' THEN total WHEN metodo_pago='dividido' AND metodo_virtual='transferencia' THEN COALESCE(monto_virtual,0) ELSE 0 END),0) FROM v
                UNION ALL
                SELECT 'tarjeta',
                    COUNT(*) FILTER (WHERE metodo_pago='tarjeta' OR (metodo_pago='dividido' AND metodo_virtual='tarjeta')),
                    COALESCE(SUM(CASE WHEN metodo_pago='tarjeta' THEN total WHEN metodo_pago='dividido' AND metodo_virtual='tarjeta' THEN COALESCE(monto_virtual,0) ELSE 0 END),0) FROM v
                UNION ALL
                SELECT 'mercadopago',
                    COUNT(*) FILTER (WHERE metodo_pago='mercadopago' OR (metodo_pago='dividido' AND metodo_virtual='mercadopago')),
                    COALESCE(SUM(CASE WHEN metodo_pago='mercadopago' THEN total WHEN metodo_pago='dividido' AND metodo_virtual='mercadopago' THEN COALESCE(monto_virtual,0) ELSE 0 END),0) FROM v
                UNION ALL
                SELECT 'cuenta_corriente',
                    COUNT(*) FILTER (WHERE metodo_pago='cuenta_corriente'),
                    COALESCE(SUM(CASE WHEN metodo_pago='cuenta_corriente' THEN total ELSE 0 END),0) FROM v
            ) t WHERE total > 0 ORDER BY total DESC
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

        // Detalle del DÍA (hoy por defecto, o ?fecha=YYYY-MM-DD para otro día):
        // desglose por método de pago, facturación electrónica, gastos por origen,
        // ventas por hora y productos más vendidos del día.
        const fechaDia = fechaONull(req.query.fecha);

        const diaDetalle = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total WHEN metodo_pago = 'dividido' THEN COALESCE(monto_efectivo,0) END), 0) AS efectivo,
                COUNT(CASE WHEN metodo_pago IN ('efectivo','dividido') THEN 1 END) AS efectivo_cant,
                COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN total WHEN metodo_pago = 'dividido' AND metodo_virtual = 'transferencia' THEN COALESCE(monto_virtual,0) END), 0) AS transferencia,
                COUNT(CASE WHEN metodo_pago = 'transferencia' OR (metodo_pago = 'dividido' AND metodo_virtual = 'transferencia') THEN 1 END) AS transferencia_cant,
                COALESCE(SUM(CASE WHEN metodo_pago = 'tarjeta' THEN total WHEN metodo_pago = 'dividido' AND metodo_virtual = 'tarjeta' THEN COALESCE(monto_virtual,0) END), 0) AS tarjeta,
                COUNT(CASE WHEN metodo_pago = 'tarjeta' OR (metodo_pago = 'dividido' AND metodo_virtual = 'tarjeta') THEN 1 END) AS tarjeta_cant,
                COALESCE(SUM(CASE WHEN metodo_pago = 'mercadopago' THEN total WHEN metodo_pago = 'dividido' AND metodo_virtual = 'mercadopago' THEN COALESCE(monto_virtual,0) END), 0) AS mercadopago,
                COUNT(CASE WHEN metodo_pago = 'mercadopago' OR (metodo_pago = 'dividido' AND metodo_virtual = 'mercadopago') THEN 1 END) AS mercadopago_cant,
                COALESCE(SUM(CASE WHEN metodo_pago NOT IN ('efectivo','transferencia','tarjeta','mercadopago','dividido') THEN total END), 0) AS otros,
                COUNT(CASE WHEN tipo_facturacion = 'electronica' THEN 1 END) AS facturadas,
                COALESCE(SUM(CASE WHEN tipo_facturacion = 'electronica' THEN total END), 0) AS facturado_electronico,
                COUNT(*) AS total_ventas,
                COALESCE(SUM(total), 0) AS total_vendido
            FROM ventas
            WHERE negocio_id = $1 AND fecha::date = COALESCE($2::date, CURRENT_DATE)
        `, [negocio_id, fechaDia]);

        const gastosDia = await db.query(`
            SELECT COALESCE(origen_dinero, 'caja') AS origen,
                   COUNT(*) AS cantidad, COALESCE(SUM(monto), 0) AS total
            FROM gastos
            WHERE negocio_id = $1 AND fecha::date = COALESCE($2::date, CURRENT_DATE)
            GROUP BY COALESCE(origen_dinero, 'caja')
        `, [negocio_id, fechaDia]);

        const ventasPorHora = await db.query(`
            SELECT EXTRACT(HOUR FROM fecha)::int AS hora,
                   COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS total
            FROM ventas
            WHERE negocio_id = $1 AND fecha::date = COALESCE($2::date, CURRENT_DATE)
            GROUP BY EXTRACT(HOUR FROM fecha)
            ORDER BY hora ASC
        `, [negocio_id, fechaDia]);

        const topDia = await db.query(`
            SELECT vi.nombre_producto,
                   SUM(vi.cantidad) AS cantidad_vendida,
                   SUM(vi.subtotal) AS total_facturado
            FROM venta_items vi
            JOIN ventas v ON vi.venta_id = v.id
            WHERE v.negocio_id = $1 AND v.fecha::date = COALESCE($2::date, CURRENT_DATE)
            GROUP BY vi.nombre_producto
            ORDER BY cantidad_vendida DESC
            LIMIT 5
        `, [negocio_id, fechaDia]);

        const gastos = { caja: 0, local: 0, otro: 0, total: 0, cantidad: 0 };
        for (const g of gastosDia.rows) {
            const monto = parseFloat(g.total) || 0;
            gastos[g.origen] = (gastos[g.origen] || 0) + monto;
            gastos.total += monto;
            gastos.cantidad += parseInt(g.cantidad) || 0;
        }

        res.json({
            stats: stats.rows[0],
            ventasPorDia: ventasPorDia.rows,
            ventasPorMetodo: ventasPorMetodo.rows,
            topProductos: topProductos.rows,
            comparacion: comparacion.rows[0],
            dia: {
                fecha: fechaDia,
                detalle: diaDetalle.rows[0],
                gastos,
                porHora: ventasPorHora.rows,
                topProductos: topDia.rows,
            },
        });

    } catch (error) {
        console.error('Error dashboard:', error);
        res.status(500).json({ error: 'Error al obtener datos del dashboard' });
    }
});

// ✅ ENDPOINT NUEVO: Facturado por Mes Histórico
router.get('/facturado-mes', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        
        // Query que devuelve facturado mes a mes completo historico
        const resultado = await db.query(`
            SELECT 
                EXTRACT(YEAR FROM fecha) AS anio,
                EXTRACT(MONTH FROM fecha) AS mes,
                TO_CHAR(fecha, 'Month') AS nombre_mes,
                COUNT(*) AS total_ventas,
                ROUND(COALESCE(SUM(total), 0)::numeric, 2) AS facturado_mes,
                ROUND(COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total WHEN metodo_pago = 'dividido' THEN COALESCE(monto_efectivo,0) ELSE 0 END), 0)::numeric, 2) AS efectivo,
                ROUND(COALESCE(SUM(CASE WHEN metodo_pago = 'dividido' THEN COALESCE(monto_virtual,0) WHEN metodo_pago != 'efectivo' THEN total ELSE 0 END), 0)::numeric, 2) AS otros_medios
            FROM ventas
            WHERE negocio_id = $1
              AND anulada = FALSE
            GROUP BY EXTRACT(YEAR FROM fecha), EXTRACT(MONTH FROM fecha), TO_CHAR(fecha, 'Month')
            ORDER BY anio DESC, mes DESC
        `, [negocio_id]);

        // Total general acumulado
        const totalGeneral = resultado.rows.reduce((acc, mes) => acc + parseFloat(mes.facturado_mes), 0);

        res.json({
            por_mes: resultado.rows,
            total_general: Math.round(totalGeneral * 100) / 100
        });

    } catch (error) {
        console.error('Error facturado mes:', error);
        res.status(500).json({ error: 'Error al obtener facturado por mes' });
    }
});

// =============================================
// CENTRO DE CONTROL: ganancia real por período (día/mes/rango)
// Separa por método (efectivo / virtual / tarjeta), descuenta costo, IVA de lo
// facturado (virtual) y gastos (variables + fijos prorrateados) → ganancia neta.
// =============================================
router.get('/centro-control', async (req, res) => {
    try {
        const negocio_id = req.negocio_id || req.usuario?.negocio_id;
        if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
        const { desde, hasta } = rangoSeguro(req);

        // Ventas del período con su costo (costo al momento de venta; fallback al costo actual)
        const ventas = await db.query(`
            SELECT v.id, v.total, v.metodo_pago, v.monto_efectivo, v.monto_virtual, v.metodo_virtual,
                   COALESCE(SUM(COALESCE(vi.costo_unitario, p.precio_costo, 0) * vi.cantidad), 0) AS costo_venta
            FROM ventas v
            LEFT JOIN venta_items vi ON vi.venta_id = v.id
            LEFT JOIN productos p ON vi.producto_id = p.id
            WHERE v.negocio_id = $1 AND v.fecha::date >= $2::date AND v.fecha::date <= $3::date
            GROUP BY v.id
        `, [negocio_id, desde, hasta]);

        const acc = {
            efectivo: { venta: 0, costo: 0 },
            virtual: { venta: 0, costo: 0 }, // transferencia + mercadopago + tarjeta (facturado)
        };
        const porMetodo = { efectivo: 0, transferencia: 0, mercadopago: 0, tarjeta: 0, cuenta_corriente: 0 };
        let totalVendido = 0;

        for (const v of ventas.rows) {
            const total = parseFloat(v.total) || 0;
            const costo = parseFloat(v.costo_venta) || 0;
            totalVendido += total;

            // Montos por método (reparte el pago dividido)
            const montos = {};
            if (v.metodo_pago === 'dividido') {
                montos.efectivo = parseFloat(v.monto_efectivo) || 0;
                const mv = v.metodo_virtual || 'transferencia';
                montos[mv] = (montos[mv] || 0) + (parseFloat(v.monto_virtual) || 0);
            } else {
                montos[v.metodo_pago] = total;
            }

            for (const [metodo, monto] of Object.entries(montos)) {
                if (!monto) continue;
                if (porMetodo[metodo] === undefined) porMetodo[metodo] = 0;
                porMetodo[metodo] += monto;
                const costoM = total > 0 ? costo * (monto / total) : 0;
                if (metodo === 'efectivo') {
                    acc.efectivo.venta += monto; acc.efectivo.costo += costoM;
                } else if (metodo === 'cuenta_corriente') {
                    // fiado: aún no cobrado → no se cuenta en ganancia real
                } else {
                    // transferencia / mercadopago / tarjeta → facturado (lleva IVA)
                    acc.virtual.venta += monto; acc.virtual.costo += costoM;
                }
            }
        }

        // IVA contenido (21%) de lo facturado virtual
        const ivaVirtual = acc.virtual.venta - acc.virtual.venta / 1.21;
        const gananciaEfectivo = acc.efectivo.venta - acc.efectivo.costo;
        const gananciaVirtual = (acc.virtual.venta - acc.virtual.costo) - ivaVirtual;

        // Gastos variables del período (libro de gastos)
        const gv = await db.query(
            'SELECT COALESCE(SUM(monto), 0) AS total FROM gastos WHERE negocio_id = $1 AND fecha::date >= $2::date AND fecha::date <= $3::date',
            [negocio_id, desde, hasta]
        );
        const gastosVariables = parseFloat(gv.rows[0].total) || 0;

        // Gastos fijos prorrateados: (suma mensual / 30) × días del período
        const gf = await db.query(
            'SELECT COALESCE(SUM(monto_mensual), 0) AS total FROM gastos_fijos WHERE negocio_id = $1 AND activo = TRUE',
            [negocio_id]
        );
        const fijosMensual = parseFloat(gf.rows[0].total) || 0;
        const diasPeriodo = Math.max(1, Math.round((new Date(hasta) - new Date(desde)) / 86400000) + 1);
        const gastoOperativoDiario = fijosMensual / 30;
        const gastosOperativos = gastoOperativoDiario * diasPeriodo;

        const gananciaBruta = gananciaEfectivo + (acc.virtual.venta - acc.virtual.costo);
        const gananciaNeta = gananciaEfectivo + gananciaVirtual - gastosVariables - gastosOperativos;

        res.json({
            desde, hasta, diasPeriodo,
            totalVendido,
            porMetodo,
            efectivo: { venta: acc.efectivo.venta, costo: acc.efectivo.costo, ganancia: gananciaEfectivo },
            virtual: { venta: acc.virtual.venta, costo: acc.virtual.costo, iva: ivaVirtual, ganancia: gananciaVirtual },
            iva_virtual: ivaVirtual,
            ganancia_bruta: gananciaBruta,
            gastos_variables: gastosVariables,
            gastos_operativos: gastosOperativos,
            gasto_operativo_diario: gastoOperativoDiario,
            fijos_mensual: fijosMensual,
            ganancia_neta: gananciaNeta,
        });
    } catch (error) {
        console.error('Error en centro-control:', error);
        res.status(500).json({ error: 'Error al generar el informe del Centro de Control' });
    }
});

module.exports = router
