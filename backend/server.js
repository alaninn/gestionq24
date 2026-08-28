process.env.TZ = 'America/Argentina/Buenos_Aires';

require('dotenv').config();

// Captura los logs del servidor en un buffer chico en memoria (~100KB)
// para poder verlos desde el panel SuperAdmin sin gastar recursos.
require('./services/logBuffer').instalar();

const express = require('express');
const app = express();
// Detrás de nginx: confiar en el primer proxy para leer la IP real del cliente
// (necesario para que el rate-limit y los logs no vean siempre la IP del proxy).
app.set('trust proxy', 1);
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
    // CSP afinada a lo que la app REALMENTE usa, para no romper nada:
    //  - scripts propios + la librería de QR del comprobante (cdnjs)
    //  - estilos inline (React/Tailwind) + Google Fonts
    //  - imágenes propias, data: y blob: (logos, QR, capturas)
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    // HSTS: fuerza HTTPS en el navegador (evita SSL-strip). Solo tiene efecto
    // cuando la página se sirve por HTTPS, así que en local (HTTP) se ignora.
    strictTransportSecurity: { maxAge: 15552000 }, // 180 días
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
app.use('/api/publico', require('./routes/publico'));

// Webhook de pagos (Mercado Pago) — público, lo llama MP. Inactivo si no hay
// MP_ACCESS_TOKEN o si la capa de revendedores está apagada.
app.use('/api/pagos', require('./routes/pagos'));

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

// Retiros de dinero del local (Centro de Control: bajan el dinero disponible)
app.use('/api/retiros', verificarToken, validarLimitePlan, require('./routes/retiros'));

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

// Gateway interno del ticket de acceso ARCA (maquina a maquina, protegido por
// secreto). Va ANTES del /api/arca protegido por JWT para que sea alcanzable sin
// login de usuario. Solo expone /api/arca/ticket-compartido; el resto cae al router
// protegido de abajo.
app.use('/api/arca', require('./routes/arcaGateway'));

// Facturación Electrónica ARCA — solo plan premium
app.use('/api/arca', verificarToken, validarLimitePlan, puedeUsarFuncion('facturacion_electronica'), rutasArca);

// Tienda / Venta Online (panel) — se accede con el permiso 'tienda' (admin lo
// tiene siempre; a los demás usuarios se les asigna desde Usuarios). La
// capacidad la define el plan (premium) O un override por negocio
// (negocios.tienda_online_habilitado), que activa el superadmin: ese chequeo
// combinado vive dentro del router.
// Los endpoints públicos de la tienda (catálogo/pedidos) viven en /api/publico.
app.use('/api/tienda', verificarToken, validarLimitePlan, verificarPermiso('tienda', 'ver'), require('./routes/tienda'));

// Integraciones: WhatsApp (Baileys) — vincular y avisos automáticos. Mismo
// permiso que la tienda (es parte del panel de la Tienda Online).
app.use('/api/whatsapp', verificarToken, validarLimitePlan, verificarPermiso('tienda', 'ver'), require('./routes/whatsapp'));

// Tu Contador: situación fiscal (categoría ARCA, IVA/tope). Mismo permiso que el
// Resumen Fiscal (ambos son la parte contable/fiscal del negocio).
app.use('/api/contador', verificarToken, validarLimitePlan, verificarPermiso('resumen_fiscal', 'ver'), require('./routes/contador'));

// Multinegocio: vincular negocios propios y mover mercadería entre ellos.
// La capacidad la define el plan (configurable por superadmin) o un override por
// negocio; el chequeo vive dentro del router (verificarMultinegocio).
app.use('/api/multinegocio', verificarToken, validarLimitePlan, require('./routes/multinegocio'));

// Usuarios y superadmin
app.use('/api/usuarios', verificarToken, validarLimitePlan, rutasUsuarios);
app.use('/api/superadmin', verificarToken, soloSuperadmin, rutasSuperadmin);

// Panel del revendedor (capa marca blanca). Scopeado a su revendedor_id. La
// guarda interna del router responde 404 si la capa está apagada.
const { soloRevendedor } = require('./middleware/auth');
app.use('/api/revendedor', verificarToken, soloRevendedor, require('./routes/revendedor'));

// Servir el frontend
const rutaFrontend = process.env.RENDER 
    ? path.join('/opt/render/project/src', 'frontend/dist')
    : path.join(__dirname, '../frontend/dist');

app.use(express.static(rutaFrontend, {
    setHeaders: (res, filePath) => {
        const p = filePath.replace(/\\/g, '/');
        if (p.endsWith('/index.html')) {
            // Nunca cachear duro el HTML: tras un deploy el navegador toma siempre
            // el index nuevo (que apunta al bundle nuevo) y no queda pidiendo un JS
            // viejo que ya no existe (pantalla en blanco / cosas que "a veces salen").
            res.setHeader('Cache-Control', 'no-cache');
        } else if (p.includes('/assets/')) {
            // Archivos con hash en el nombre: inmutables, se cachean a largo plazo.
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));
app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
        res.set('Cache-Control', 'no-cache');
        res.sendFile(path.join(rutaFrontend, 'index.html'));
    } else {
        next();
    }
});

// Manejador de errores: responde JSON genérico sin exponer detalles internos
// del servidor (rutas de archivos, stack traces) al cliente.
app.use((err, req, res, next) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
        return res.status(400).json({ error: 'La solicitud no tiene un formato válido' });
    }
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'El contenido enviado es demasiado grande' });
    }
    console.error('Error no controlado:', err);
    res.status(500).json({ error: 'Ocurrió un error en el servidor' });
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
        // Genera/actualiza/auto-resuelve alertas sin acumular duplicados.
        await require('./services/alertas').generarAlertas();
    } catch (err) {
        console.error('Error generando alertas automáticas:', err.message);
    }
});

// Reintento automático de facturaciones que quedaron en error (ej. AFIP caído o
// en mantenimiento). Cada 30 min, y una vez ~2 min después de arrancar para que
// se recuperen rápido tras un despliegue o cuando AFIP vuelve.
schedule.scheduleJob('*/30 * * * *', async () => {
    try {
        await require('./services/refacturacion').reintentarTodos();
    } catch (err) {
        console.error('Error en reintento automático de facturación:', err.message);
    }
});
setTimeout(() => {
    require('./services/refacturacion').reintentarTodos().catch(() => {});
}, 120000);