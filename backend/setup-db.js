const db = require('./config/database');

const sql = `
-- =============================================
-- TABLA: alertas
-- Descripción: Sistema de alertas automáticas para SuperAdmin
-- =============================================
CREATE TABLE IF NOT EXISTS alertas (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    tipo VARCHAR(100) NOT NULL, -- 'vencimiento', 'sin_actividad', 'error', 'cambio_admin'
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    severidad VARCHAR(20) DEFAULT 'media', -- 'baja', 'media', 'alta', 'crítica'
    leida BOOLEAN DEFAULT false,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resuelta BOOLEAN DEFAULT false,
    fecha_resolucion TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alertas_negocio ON alertas(negocio_id);
CREATE INDEX IF NOT EXISTS idx_alertas_fecha ON alertas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_leida ON alertas(leida);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON alertas(tipo);

-- =============================================
-- TABLA: tickets_soporte
-- Descripción: Sistema de tickets para reportar problemas
-- =============================================
CREATE TABLE IF NOT EXISTS tickets_soporte (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT NOT NULL,
    categoria VARCHAR(100), -- 'bug', 'pregunta', 'lentitud', 'acceso', 'otro'
    estado VARCHAR(50) DEFAULT 'abierto', -- 'abierto', 'en_progreso', 'resuelto', 'cerrado'
    prioridad VARCHAR(20) DEFAULT 'media', -- 'baja', 'media', 'alta', 'urgente'
    respuesta TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion TIMESTAMP,
    tiempo_respuesta_horas INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_negocio ON tickets_soporte(negocio_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets_soporte(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_fecha ON tickets_soporte(fecha_creacion DESC);

-- =============================================
-- TABLA: salud_negocio (logs de actividad para dashboard)
-- Descripción: Registra actividad y errores del negocio
-- =============================================
CREATE TABLE IF NOT EXISTS salud_negocio (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    tipo_evento VARCHAR(100), -- 'venta', 'error', 'login', 'cambio_datos'
    detalles TEXT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    exitoso BOOLEAN DEFAULT true,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_salud_negocio ON salud_negocio(negocio_id);
CREATE INDEX IF NOT EXISTS idx_salud_fecha ON salud_negocio(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_salud_tipo ON salud_negocio(tipo_evento);

-- =============================================
-- TABLA: pagos_historial
-- Descripción: Registro de pagos y renovaciones
-- =============================================
CREATE TABLE IF NOT EXISTS pagos_historial (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    dias INTEGER DEFAULT 30,
    monto DECIMAL(10, 2) DEFAULT 0,
    metodo_pago VARCHAR(100),
    observaciones TEXT,
    tipo VARCHAR(50) DEFAULT 'pago',
    pagado BOOLEAN DEFAULT true,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(negocio_id, fecha, tipo)
);

CREATE INDEX IF NOT EXISTS idx_pagos_negocio ON pagos_historial(negocio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos_historial(fecha DESC);

-- =============================================
-- Agregar columnas a tabla negocios si no existen
-- =============================================
ALTER TABLE negocios
ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMP,
ADD COLUMN IF NOT EXISTS sin_actividad_dias INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS errores_24h INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS dias_uso INTEGER DEFAULT 30;
`;

async function setupDB() {
    console.log('🚀 Iniciando configuración de base de datos...\n');
    
    const queries = sql.split(';').filter(q => q.trim());
    
    for (let i = 0; i < queries.length; i++) {
        try {
            await db.query(queries[i]);
            console.log(`✓ Query ${i + 1}/${queries.length} ejecutada`);
        } catch (error) {
            if (error.code === '42P07' || error.code === '42P01' || error.code === '42701') {
                console.log(`⚠️ (Ya existe): Query ${i + 1}`);
            } else {
                console.error(`❌ Error en query ${i + 1}:`, error.message);
            }
        }
    }
    
    console.log('\n✅ Base de datos configurada correctamente');
    console.log('📊 Tablas creadas: alertas, tickets_soporte, salud_negocio, pagos_historial');
    console.log('🔧 Columnas agregadas a negocios: ultima_actividad, sin_actividad_dias, errores_24h, pagado, dias_uso');
    process.exit(0);
}

setupDB();