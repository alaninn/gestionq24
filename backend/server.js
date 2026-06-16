process.env.TZ = 'America/Argentina/Buenos_Aires';

require('dotenv').config();

// Captura los logs del servidor en un buffer chico en memoria (~100KB)
// para poder verlos desde el panel SuperAdmin sin gastar recursos.
require('./services/logBuffer').instalar();

const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const schedule = require('node-schedule');

const rutasAuth = require('./routes/auth');
const rutasCategorias = require('./routes/categorias');
const rutasProductos = require('./routes/productos');
const rutasTurnos = require('./routes/turnos');
const rutasVentas = require('./routes/ventas');
const rutasGastos = require('./routes/gastos');
const rutasConfiguracion = require('./routes/configuracion');
const rutasClientes = require('./routes/clientes');
const rutasReportes = require('./routes/reportes');
const rutasUsuarios = require('./routes/usuarios');
const rutasSuperadmin = require('./routes/superadmin');
const rutasSalud = require('./routes/salud');
const rutasSoporte = require('./routes/soporte');
const rutasArca = require('./routes/arca');
const rutasProveedores = require('./routes/proveedores');

const { verificarToken, verificarPermiso, soloSuperadmin } = require('./middleware/auth');
const { validarLimitePlan, puedeUsarFuncion } = require('./middleware/planLimites');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    strictTransportSecurity: false,
    originAgentCluster: false,
}));
app.use(rateLimit({ 
    windowMs: 15 * 60 * 1000,
    max: 500,
    skip: (req) => !req.path.startsWith('/api')
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));

// Rutas públicas
app.use('/api/auth', rutasAuth);

// Productos
app.use('/api/productos', verificarToken, validarLimitePlan, rutasProductos);

// Categorias
app.use('/api/categorias', verificarToken, validarLimitePlan, rutasCategorias);

// Secciones de la pantalla de Stock (orden físico del local)
app.use('/api/stock-categorias', verificarToken, validarLimitePlan, require('./routes/stockCategorias'));

// Ventas — cajero puede crear
app.use('/api/ventas', verificarToken, validarLimitePlan, rutasVentas);

// Gastos — cajero puede crear
app.use('/api/gastos', verificarToken, validarLimitePlan, rutasGastos);

// Gastos fijos / operativos mensuales (Centro de Control)
app.use('/api/gastos-fijos', verificarToken, validarLimitePlan, require('./routes/gastosFijos'));

// Turnos — todos pueden abrir/cerrar
app.use('/api/turnos', verificarToken, validarLimitePlan, rutasTurnos);

// Clientes
app.use('/api/clientes', verificarToken, validarLimitePlan, rutasClientes);

// Proveedores
app.use('/api/proveedores', verificarToken, validarLimitePlan, rutasProveedores);

// Reportes — son solo lecturas del propio negocio. La VISIBILIDAD de cada
// panel (Dashboard, Reportes, Control de Caja, Resumen Fiscal) la controla el
// menú según los permisos del usuario; acá basta con estar logueado.
// Los reportes "avanzados" sí exigen plan premium.
app.use('/api/reportes/avanzados', verificarToken, validarLimitePlan, puedeUsarFuncion('reportes_avanzados'));
app.use('/api/reportes', verificarToken, validarLimitePlan, rutasReportes);

// Configuracion — solo admin
app.use('/api/configuracion', verificarToken, validarLimitePlan, rutasConfiguracion);

// Salud del negocio
app.use('/api/salud', rutasSalud);

// Soporte técnico
app.use('/api/soporte', rutasSoporte);

// Facturación Electrónica ARCA — solo plan premium
app.use('/api/arca', verificarToken, validarLimitePlan, puedeUsarFuncion('facturacion_electronica'), rutasArca);

// Usuarios y superadmin
app.use('/api/usuarios', verificarToken, validarLimitePlan, rutasUsuarios);
app.use('/api/superadmin', verificarToken, soloSuperadmin, rutasSuperadmin);

// Servir el frontend
const rutaFrontend = process.env.RENDER 
    ? path.join('/opt/render/project/src', 'frontend/dist')
    : path.join(__dirname, '../frontend/dist');

app.use(express.static(rutaFrontend));
app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(rutaFrontend, 'index.html'));
    } else {
        next();
    }
});

const PUERTO = process.env.PORT || 3001;

// Ajuste solo para Render - NO AFECTA FUNCIONAMIENTO LOCAL
const host = '0.0.0.0';

app.listen(PUERTO, host, () => {
    if(process.env.RENDER) {
        console.log(`🚀 Servidor corriendo en Render en puerto ${PUERTO}`);
        console.log(`📦 API lista para produccion`);
    } else {
        console.log(`🚀 Servidor corriendo en http://localhost:${PUERTO}`);
        console.log(`📦 API disponible en http://localhost:${PUERTO}/api`);
    }
});

// Backup automático diario de la base de datos
require('./services/backupService').iniciarBackupsAutomaticos();

// Pool ya disponible via require('./config/database')

schedule.scheduleJob('0 * * * *', async () => { // cada hora
    try {
        const db = require('./config/database');

        // Alertas de vencimiento próximo (menos de 5 días)
        const vencimientos = await db.query(`
            SELECT id, nombre, fecha_vencimiento FROM negocios 
            WHERE estado = 'activo'
            AND fecha_vencimiento < NOW() + INTERVAL '5 days'
            AND fecha_vencimiento > NOW()
            AND NOT EXISTS (
                SELECT 1 FROM alertas 
                WHERE negocio_id = negocios.id 
                AND tipo = 'vencimiento'
                AND resuelta = false
                AND DATE(fecha) = CURRENT_DATE
            )
        `);
        for (const neg of vencimientos.rows) {
            const diasFaltantes = Math.ceil((new Date(neg.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));
            await db.query(`
                INSERT INTO alertas (negocio_id, tipo, titulo, descripcion, severidad)
                VALUES ($1, 'vencimiento', $2, $3, $4)
            `, [neg.id, `⏰ Vencimiento próximo`, `${neg.nombre} vence en ${diasFaltantes} días.`, diasFaltantes <= 2 ? 'crítica' : 'alta']);
        }

        // Alertas de vencidos
        const vencidos = await db.query(`
            SELECT id, nombre FROM negocios 
            WHERE estado = 'activo' AND fecha_vencimiento < NOW()
            AND NOT EXISTS (
                SELECT 1 FROM alertas WHERE negocio_id = negocios.id 
                AND tipo = 'vencimiento_vencido' AND resuelta = false
            )
        `);
        for (const neg of vencidos.rows) {
            await db.query(`
                INSERT INTO alertas (negocio_id, tipo, titulo, descripcion, severidad)
                VALUES ($1, 'vencimiento_vencido', '🚨 Suscripción VENCIDA', $2, 'crítica')
            `, [neg.id, `${neg.nombre} está vencido.`]);
        }

        // Alertas de inactividad
        const inactivos = await db.query(`
            SELECT id, nombre, ultima_actividad FROM negocios 
            WHERE estado = 'activo'
            AND (ultima_actividad IS NULL OR ultima_actividad < NOW() - INTERVAL '7 days')
            AND NOT EXISTS (
                SELECT 1 FROM alertas WHERE negocio_id = negocios.id 
                AND tipo = 'sin_actividad' AND resuelta = false
                AND DATE(fecha) = CURRENT_DATE
            )
        `);
        for (const neg of inactivos.rows) {
            const dias = neg.ultima_actividad
                ? Math.floor((new Date() - new Date(neg.ultima_actividad)) / (1000 * 60 * 60 * 24))
                : '∞';
            await db.query(`
                INSERT INTO alertas (negocio_id, tipo, titulo, descripcion, severidad)
                VALUES ($1, 'sin_actividad', $2, $3, 'media')
            `, [neg.id, `💾 Sin actividad por ${dias} días`, `${neg.nombre} no registró ventas.`]);
        }

    } catch (err) {
        console.error('Error generando alertas automáticas:', err.message);
    }
});