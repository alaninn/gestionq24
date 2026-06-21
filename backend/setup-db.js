require('dotenv').config();
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

-- Columnas de configuracion que pueden faltar en instalaciones viejas
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS tamanio_ticket VARCHAR(20) DEFAULT '80';
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS tamanio_ticket_personalizado INTEGER DEFAULT 80;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS impresion_tickets_automatica BOOLEAN DEFAULT TRUE;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS permite_stock_negativo BOOLEAN DEFAULT FALSE;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS mostrar_stock_pos BOOLEAN DEFAULT TRUE;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS ocultar_stock_pos BOOLEAN DEFAULT FALSE;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS color_primario VARCHAR(20) DEFAULT '#f97316';
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS recargo_general NUMERIC DEFAULT 0;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS modo_oscuro BOOLEAN DEFAULT TRUE;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS entorno_arca VARCHAR(20) DEFAULT 'homologacion';

-- Tabla de codigos alternativos de productos (si no existe)
CREATE TABLE IF NOT EXISTS producto_codigos (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    codigo VARCHAR(100) NOT NULL,
    negocio_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_producto_codigos_unico ON producto_codigos(codigo, negocio_id);

-- Modo de conexión ARCA: 'propio' (certificado del negocio) o 'delegado' (web service delegado al CUIT del proveedor)
ALTER TABLE certificados_arca ADD COLUMN IF NOT EXISTS modo VARCHAR(20) DEFAULT 'propio';

-- Gastos: quién lo hizo y de dónde salió el dinero
-- origen_dinero: 'caja' (caja del turno, afecta el cierre) | 'local' (dinero del local) | 'otro'
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS origen_dinero VARCHAR(20) DEFAULT 'caja';
CREATE INDEX IF NOT EXISTS idx_gastos_turno ON gastos(turno_id);

-- Índices para acelerar la búsqueda exacta por código de barras (scanner)
CREATE INDEX IF NOT EXISTS idx_productos_codigo_lower ON productos (negocio_id, LOWER(codigo));
CREATE INDEX IF NOT EXISTS idx_producto_codigos_lower ON producto_codigos (negocio_id, LOWER(codigo));

-- =============================================
-- TABLA: stock_categorias
-- Secciones propias de la pantalla de Stock (góndolas, heladeras, depósito...)
-- Independientes de las categorías de productos: reflejan el orden FÍSICO del local
-- para hacer inventario recorriendo las estanterías con el celular.
-- =============================================
CREATE TABLE IF NOT EXISTS stock_categorias (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stock_categorias_negocio ON stock_categorias(negocio_id, orden);

-- Ubicación y orden de cada producto dentro de la pantalla de Stock
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_categoria_id INTEGER REFERENCES stock_categorias(id) ON DELETE SET NULL;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock_orden INTEGER DEFAULT 0;

-- Producto cargado "rápido" desde el POS (sin precio/datos completos):
-- queda marcado para que un admin después le complete la info.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS requiere_revision BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_productos_revision ON productos(negocio_id) WHERE requiere_revision = TRUE;
CREATE INDEX IF NOT EXISTS idx_productos_stock_cat ON productos(negocio_id, stock_categoria_id, stock_orden);

-- =============================================
-- TABLA: cajas_definidas
-- Cajas FIJAS del local (Mañana, Tarde, Trasnoche...) que se crean desde
-- Control de Cajas. Los usuarios las abren/cierran según su turno.
-- =============================================
CREATE TABLE IF NOT EXISTS cajas_definidas (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    orden INTEGER DEFAULT 0,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cajas_definidas_negocio ON cajas_definidas(negocio_id, activa);

-- Quién cerró cada caja + de qué caja fija proviene el turno
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS usuario_cierre_id INTEGER;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS caja_definida_id INTEGER;

-- =============================================
-- TABLA: plantillas_permisos
-- Permisos predefinidos por rol y por negocio (encargado, cajero).
-- El admin los edita desde la pantalla de Usuarios. Si no hay fila, se usan
-- los valores por defecto del código.
-- =============================================
CREATE TABLE IF NOT EXISTS plantillas_permisos (
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    rol VARCHAR(20) NOT NULL,
    permisos JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (negocio_id, rol)
);

-- =============================================
-- TABLA: planes_config
-- Límites y funciones de cada plan, editables desde el panel de superadmin.
-- Si está vacía, el middleware usa los valores por defecto hardcodeados.
-- =============================================
CREATE TABLE IF NOT EXISTS planes_config (
    plan VARCHAR(20) PRIMARY KEY,
    max_productos INTEGER NOT NULL DEFAULT 500,
    max_usuarios INTEGER NOT NULL DEFAULT 3,
    facturacion_electronica BOOLEAN DEFAULT FALSE,
    reportes_avanzados BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO planes_config (plan, max_productos, max_usuarios, facturacion_electronica, reportes_avanzados)
VALUES
    ('estandar', 500, 3, FALSE, FALSE),
    ('premium', 3000, 99999, TRUE, TRUE)
ON CONFLICT (plan) DO NOTHING;

-- =============================================
-- TABLA: errores_frontend
-- Errores de pantalla reportados automáticamente por la app (ErrorBoundary)
-- =============================================
CREATE TABLE IF NOT EXISTS errores_frontend (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER,
    usuario_id INTEGER,
    mensaje TEXT NOT NULL,
    stack TEXT,
    url VARCHAR(500),
    user_agent VARCHAR(300),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_errores_frontend_fecha ON errores_frontend(fecha DESC);

-- El código de producto debe ser único POR NEGOCIO, no global (multi-tenant).
-- Quitamos el constraint global viejo y creamos un índice único por (negocio_id, codigo).
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_codigo_key;
CREATE UNIQUE INDEX IF NOT EXISTS productos_codigo_negocio_uniq
ON productos (negocio_id, codigo)
WHERE codigo IS NOT NULL;

-- Agregar columna username a usuarios si no existe
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- El email es OPCIONAL (se inicia sesión con username): no puede ser NOT NULL
ALTER TABLE usuarios ALTER COLUMN email DROP NOT NULL;

-- Crear índice único para username por negocio (null permitido para compatibilidad)
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_username_negocio 
ON usuarios(username, negocio_id) 
WHERE username IS NOT NULL;

-- Poblar username con el email actual para usuarios existentes
UPDATE usuarios SET username = SPLIT_PART(email, '@', 1) WHERE username IS NULL;

-- =============================================
-- TABLA: certificados_arca
-- Descripción: Almacena certificados digitales para facturación electrónica
-- =============================================
CREATE TABLE IF NOT EXISTS certificados_arca (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    cert_path VARCHAR(500),
    key_path VARCHAR(500),
    csr_path VARCHAR(500),
    cuit VARCHAR(15),
    punto_venta INTEGER DEFAULT 1,
    regimen_fiscal VARCHAR(50) DEFAULT 'responsable_inscripto', -- 'responsable_inscripto', 'monotributista'
    activo BOOLEAN DEFAULT true,
    fecha_vencimiento DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_certificados_negocio ON certificados_arca(negocio_id);

-- =============================================
-- TABLA: comprobantes_electronicos
-- Descripción: Registra comprobantes electrónicos emitidos (facturas, notas de crédito)
-- =============================================
CREATE TABLE IF NOT EXISTS comprobantes_electronicos (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    cae VARCHAR(50),
    cae_vencimiento DATE,
    numero_comprobante INTEGER,
    punto_venta INTEGER,
    tipo_comprobante INTEGER, -- 1=Fact A, 6=Fact B, 11=Fact C, 3=NC A, 8=NC B, 13=NC C
    tipo_documento INTEGER, -- 80=CUIT, 96=DNI, 99=Consumidor Final
    numero_documento VARCHAR(20),
    denominacion_comprador VARCHAR(200),
    importe_total DECIMAL(12,2),
    importe_neto DECIMAL(12,2),
    importe_iva DECIMAL(12,2),
    xml_enviado TEXT,
    xml_respuesta TEXT,
    estado VARCHAR(20) DEFAULT 'emitido', -- 'emitido', 'anulado', 'error'
    fecha_emision TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comprobantes_negocio ON comprobantes_electronicos(negocio_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_venta ON comprobantes_electronicos(venta_id);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON comprobantes_electronicos(estado);

-- Condición frente al IVA del receptor (RG 5616) guardada en cada comprobante
ALTER TABLE comprobantes_electronicos ADD COLUMN IF NOT EXISTS condicion_iva_receptor INTEGER;

-- Fecha exacta (CbteFch, formato YYYYMMDD) que se envió a AFIP, para que el QR y la
-- fecha impresa coincidan SIEMPRE con lo que registró AFIP (sin desfasajes de zona horaria).
ALTER TABLE comprobantes_electronicos ADD COLUMN IF NOT EXISTS cbte_fecha VARCHAR(8);

-- Pago dividido: una venta puede pagarse parte en efectivo y parte por un medio
-- virtual (transferencia/MP/tarjeta). metodo_pago = 'dividido' y se guardan los montos
-- de cada parte para que el cierre de caja y los reportes sigan cuadrando.
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_efectivo NUMERIC(12,2);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_virtual NUMERIC(12,2);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS metodo_virtual VARCHAR(30);

-- Monto a partir del cual el POS pide confirmación al cobrar por un medio virtual
-- (aviso anti-error de tipeo). Default $100.000, editable por negocio.
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS limite_aviso_pago_virtual NUMERIC(12,2) DEFAULT 100000;

-- Idempotencia de ventas offline: cada venta sin internet trae un UUID propio
-- y al sincronizar se evita duplicarla si el reenvio se repite.
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS offline_uuid VARCHAR(60);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ventas_offline_uuid
    ON ventas(negocio_id, offline_uuid) WHERE offline_uuid IS NOT NULL;

-- Centro de Control: costo del producto al momento de la venta (para ganancia
-- historica exacta, aunque despues cambie el precio de costo del producto).
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12,2);

-- Gastos fijos / operativos mensuales del local (luz, alquiler, impuestos, etc.)
-- Se prorratean por dia para calcular la ganancia neta real.
CREATE TABLE IF NOT EXISTS gastos_fijos (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    monto_mensual NUMERIC(12,2) NOT NULL DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gastos_fijos_negocio ON gastos_fijos(negocio_id);

-- Centro de Control: DINERO DISPONIBLE (capital rotativo). Saldo inicial que
-- carga el dueño (efectivo y virtual) desde una fecha y de ahi se acumula con
-- las ventas de cajas cerradas menos gastos y retiros.
-- OJO: sin punto y coma en los comentarios (setup-db divide el SQL por ';').
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS disponible_fecha_inicio DATE;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS disponible_inicial_efectivo NUMERIC(12,2) DEFAULT 0;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS disponible_inicial_virtual NUMERIC(12,2) DEFAULT 0;

-- Retiros de dinero del local (tomar ganancia). Bajan el dinero disponible pero
-- NO son gastos del negocio (no afectan la ganancia). tipo: efectivo o virtual.
CREATE TABLE IF NOT EXISTS retiros (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    monto NUMERIC(12,2) NOT NULL DEFAULT 0,
    tipo VARCHAR(10) NOT NULL DEFAULT 'efectivo',
    nota TEXT,
    usuario_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_retiros_negocio_fecha ON retiros(negocio_id, fecha);

-- Columnas nuevas en configuración para facturación electrónica
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS facturacion_electronica_activa BOOLEAN DEFAULT false;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS regimen_fiscal VARCHAR(50) DEFAULT 'responsable_inscripto';
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS punto_venta_arca INTEGER DEFAULT 1;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS tipo_comprobante_default INTEGER DEFAULT 1;

-- Columna nueva en ventas para tipo de facturación
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS tipo_facturacion VARCHAR(20) DEFAULT 'x'; -- 'electronica' o 'x'
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS comprobante_electronico_id INTEGER REFERENCES comprobantes_electronicos(id);

-- =============================================
-- TABLA: tickets_acceso_wsaa
-- Descripción: Almacena tickets de acceso del WSAA para reutilizar
-- =============================================
CREATE TABLE IF NOT EXISTS tickets_acceso_wsaa (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    servicio VARCHAR(50) DEFAULT 'wsfe', -- 'wsfe', 'wsmtxca', etc.
    token TEXT NOT NULL,
    sign TEXT NOT NULL,
    expiracion TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_wsaa_negocio ON tickets_acceso_wsaa(negocio_id);
CREATE INDEX IF NOT EXISTS idx_tickets_wsaa_expiracion ON tickets_acceso_wsaa(expiracion);

-- =============================================
-- TABLA: proveedores
-- Descripción: Gestión de proveedores con saldo bidireccional
-- =============================================
CREATE TABLE IF NOT EXISTS proveedores (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion TEXT,
    saldo_deuda DECIMAL(12, 2) DEFAULT 0,
    saldo_a_favor DECIMAL(12, 2) DEFAULT 0,
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proveedores_negocio ON proveedores(negocio_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_activo ON proveedores(activo);
CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);

-- =============================================
-- Modificar tabla gastos para agregar referencia a proveedores, recibo y datos de compra/iva
-- =============================================
ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL;

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS recibo_url TEXT;

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS es_compra BOOLEAN DEFAULT FALSE;

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(50); -- 'boleta', 'sin_boleta', 'factura'

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS tipo_comprobante VARCHAR(50); -- 'sin_factura', 'factura_a', 'factura_b', 'factura_c'

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS condicion_iva_proveedor VARCHAR(50);

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS numero_boleta VARCHAR(100);

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS iva_incluido BOOLEAN DEFAULT FALSE;

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS porcentaje_iva DECIMAL(5,2) DEFAULT 0;

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS monto_iva DECIMAL(12,2) DEFAULT 0;

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS productos_json JSONB;

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS tipo_pago_proveedor VARCHAR(50);

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(20) DEFAULT 'pagado';

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS registrar_nueva_factura BOOLEAN DEFAULT FALSE;

ALTER TABLE gastos
ADD COLUMN IF NOT EXISTS total_factura NUMERIC(12,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_gastos_proveedor ON gastos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_gastos_es_compra ON gastos(es_compra);
CREATE INDEX IF NOT EXISTS idx_gastos_tipo_documento ON gastos(tipo_documento);

-- =============================================
-- TABLA: historial_stock
-- =============================================
CREATE TABLE IF NOT EXISTS historial_stock (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    stock_anterior INTEGER NOT NULL,
    stock_nuevo INTEGER NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_historial_stock_producto ON historial_stock(producto_id);

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