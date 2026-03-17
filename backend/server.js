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

const { verificarToken, verificarPermiso } = require('./middleware/auth');

const app = express();
app.use(express.json());
app.use(cors());

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

// Reportes — requiere permiso
app.use('/api/reportes', verificarToken, verificarPermiso('reportes', 'ver'), rutasReportes);

// Configuracion — solo admin
app.use('/api/configuracion', verificarToken, rutasConfiguracion);

// Salud del negocio
app.use('/api/salud', rutasSalud);

// Soporte técnico
app.use('/api/soporte', rutasSoporte);

// Usuarios y superadmin
app.use('/api/usuarios', rutasUsuarios);
app.use('/api/superadmin', rutasSuperadmin);

// Servir el frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    } else {
        next();
    }
});

const PUERTO = process.env.PORT || 3001;
app.listen(PUERTO, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PUERTO}`);
    console.log(`📦 API disponible en http://localhost:${PUERTO}/api`);
});

schedule.scheduleJob('*/5 * * * *', async () => {
    try {
        await fetch('http://localhost:3001/api/superadmin/generar-alertas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Error generando alertas:', err);
    }
});