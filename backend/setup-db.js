const db = require('./config/database');

const sql = `
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

ALTER TABLE negocios ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT true;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS dias_uso INTEGER DEFAULT 30;
`;

async function setupDB() {
    const queries = sql.split(';').filter(q => q.trim());
    
    for (let i = 0; i < queries.length; i++) {
        try {
            await db.query(queries[i]);
            console.log(`✓ Query ${i + 1}/${queries.length} ejecutada`);
        } catch (error) {
            if (error.code === '42P07' || error.code === '42P01' || error.code === '42701') {
                console.log(`⚠️ (Ya existe o relación): Query ${i + 1}`);
            } else {
                console.error(`❌ Error en query ${i + 1}:`, error.message);
            }
        }
    }
    
    console.log('✅ Base de datos configurada correctamente');
    process.exit(0);
}

setupDB();
