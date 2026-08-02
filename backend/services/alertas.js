const db = require('../config/database');

// Genera las alertas del superadmin manteniendo UNA sola alerta no resuelta por
// (negocio, tipo). Si ya existe, la pisa (actualiza) en lugar de acumular otra.
// Se usa tanto desde el cron horario (server.js) como desde el endpoint manual.
async function generarAlertas() {
    // 1) Colapsar duplicados historicos: dejar solo la mas nueva por (negocio, tipo).
    await db.query(`
        UPDATE alertas SET resuelta = true
        WHERE resuelta = false
          AND id NOT IN (
            SELECT DISTINCT ON (negocio_id, tipo) id
            FROM alertas WHERE resuelta = false
            ORDER BY negocio_id, tipo, fecha DESC
          )
    `);

    // 1b) Auto-resolver alertas que YA NO aplican (ej: se renovó y dejó de estar
    // vencido, o volvió a tener actividad). Así no quedan alertas viejas colgadas.
    await db.query(`
        UPDATE alertas SET resuelta = true, fecha_resolucion = NOW()
        WHERE resuelta = false AND tipo = 'vencimiento_vencido'
          AND negocio_id NOT IN (SELECT id FROM negocios WHERE estado = 'activo' AND fecha_vencimiento < NOW())
    `);
    await db.query(`
        UPDATE alertas SET resuelta = true, fecha_resolucion = NOW()
        WHERE resuelta = false AND tipo = 'vencimiento'
          AND negocio_id NOT IN (
            SELECT id FROM negocios WHERE estado = 'activo'
              AND fecha_vencimiento < NOW() + INTERVAL '5 days' AND fecha_vencimiento > NOW())
    `);
    await db.query(`
        UPDATE alertas SET resuelta = true, fecha_resolucion = NOW()
        WHERE resuelta = false AND tipo = 'sin_actividad'
          AND negocio_id NOT IN (
            SELECT id FROM negocios WHERE estado = 'activo'
              AND (ultima_actividad IS NULL OR ultima_actividad < NOW() - INTERVAL '7 days'))
    `);

    // Upsert: actualiza la alerta no resuelta de ese (negocio, tipo) o crea una.
    const upsert = async (negocio_id, tipo, titulo, descripcion, severidad) => {
        const upd = await db.query(`
            UPDATE alertas SET titulo = $3, descripcion = $4, severidad = $5, fecha = NOW()
            WHERE negocio_id = $1 AND tipo = $2 AND resuelta = false
        `, [negocio_id, tipo, titulo, descripcion, severidad]);
        if (upd.rowCount === 0) {
            await db.query(`
                INSERT INTO alertas (negocio_id, tipo, titulo, descripcion, severidad)
                VALUES ($1, $2, $3, $4, $5)
            `, [negocio_id, tipo, titulo, descripcion, severidad]);
        }
    };

    // 2) Vencimiento proximo (dentro de 5 dias)
    const vencimientos = await db.query(`
        SELECT id, nombre, fecha_vencimiento FROM negocios
        WHERE estado = 'activo'
          AND fecha_vencimiento < NOW() + INTERVAL '5 days'
          AND fecha_vencimiento > NOW()
    `);
    for (const neg of vencimientos.rows) {
        const dias = Math.ceil((new Date(neg.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));
        await upsert(neg.id, 'vencimiento', '⏰ Vencimiento próximo',
            `${neg.nombre} vence en ${dias} días. Renova la suscripción.`,
            dias <= 2 ? 'crítica' : 'alta');
    }

    // 3) Vencidos
    const vencidos = await db.query(`
        SELECT id, nombre FROM negocios WHERE estado = 'activo' AND fecha_vencimiento < NOW()
    `);
    for (const neg of vencidos.rows) {
        await upsert(neg.id, 'vencimiento_vencido', '🚨 Suscripción VENCIDA',
            `${neg.nombre} está vencido. El negocio debería estar bloqueado.`, 'crítica');
    }

    // 4) Sin actividad (mas de 7 dias)
    const inactivos = await db.query(`
        SELECT id, nombre, ultima_actividad FROM negocios
        WHERE estado = 'activo'
          AND (ultima_actividad IS NULL OR ultima_actividad < NOW() - INTERVAL '7 days')
    `);
    for (const neg of inactivos.rows) {
        const dias = neg.ultima_actividad
            ? Math.floor((new Date() - new Date(neg.ultima_actividad)) / (1000 * 60 * 60 * 24))
            : '∞';
        await upsert(neg.id, 'sin_actividad', `💾 Sin actividad por ${dias} días`,
            `${neg.nombre} no ha registrado ventas en ${dias} días. ¿Error o abandono?`, 'media');
    }

    return {
        vencimientos: vencimientos.rows.length,
        vencidos: vencidos.rows.length,
        inactivos: inactivos.rows.length,
    };
}

module.exports = { generarAlertas };
