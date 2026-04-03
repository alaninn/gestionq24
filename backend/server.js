process.env.TZ = 'America/Argentina/Buenos_Aires';

require('dotenv').config();

const express = require('express');
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

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
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
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));

// Rutas públicas
app.use('/api/auth', rutasAuth);

// Productos
app.use('/api/productos', verificarToken, rutasProductos);

// Categorias
app.use('/api/categorias', verificarToken, rutasCategorias);

// Ventas — cajero puede crear
app.use('/api/ventas', verificarToken, rutasVentas);

// Gastos — cajero puede crear
app.use('/api/gastos', verificarToken, rutasGastos);

// Turnos — todos pueden abrir/cerrar
app.use('/api/turnos', verificarToken, rutasTurnos);

// Clientes
app.use('/api/clientes', verificarToken, rutasClientes);

// Proveedores
app.use('/api/proveedores', verificarToken, rutasProveedores);

// Reportes — requiere permiso
app.use('/api/reportes', verificarToken, verificarPermiso('reportes', 'ver'), rutasReportes);

// Configuracion — solo admin
app.use('/api/configuracion', verificarToken, rutasConfiguracion);

// Salud del negocio
app.use('/api/salud', rutasSalud);

// Soporte técnico
app.use('/api/soporte', rutasSoporte);

// Facturación Electrónica ARCA
app.use('/api/arca', verificarToken, rutasArca);

// Usuarios y superadmin
app.use('/api/usuarios', verificarToken, rutasUsuarios);
app.use('/api/superadmin', verificarToken, soloSuperadmin, rutasSuperadmin);

// Servir el frontend
const rutaFrontend = process.env.RENDER 
    ? path.join(process.cwd(), 'frontend/dist')
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
const host = process.env.RENDER ? '0.0.0.0' : '0.0.0.0';

app.listen(PUERTO, host, () => {
    if(process.env.RENDER) {
        console.log(`🚀 Servidor corriendo en Render en puerto ${PUERTO}`);
        console.log(`📦 API lista para produccion`);
    } else {
        console.log(`🚀 Servidor corriendo en http://localhost:${PUERTO}`);
        console.log(`📦 API disponible en http://localhost:${PUERTO}/api`);
    }
});

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