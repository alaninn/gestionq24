-- =============================================
-- CREAR TABLA: pagos_historial
-- DESCRIPCIÓN: Registra el historial de pagos y renovaciones de suscripciones
-- =============================================

CREATE TABLE IF NOT EXISTS pagos_historial (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    dias INTEGER DEFAULT 30,
    monto DECIMAL(10, 2) DEFAULT 0,
    metodo_pago VARCHAR(100),
    observaciones TEXT,
    tipo VARCHAR(50) DEFAULT 'pago', -- 'pago', 'renovacion', 'ajuste'
    pagado BOOLEAN DEFAULT true,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(negocio_id, fecha, tipo)
);

-- Crear índices para mejores búsquedas
CREATE INDEX IF NOT EXISTS idx_pagos_negocio ON pagos_historial(negocio_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos_historial(fecha DESC);

-- Agregar columna 'pagado' a negocios si no existe
ALTER TABLE negocios
ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT true;

-- Agregar columna 'dias_uso' a negocios si no existe
ALTER TABLE negocios
ADD COLUMN IF NOT EXISTS dias_uso INTEGER DEFAULT 30;

-- Mostrar resultado
SELECT 'Tabla pagos_historial creada correctamente' AS resultado;
