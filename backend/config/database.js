// Forzar timezone Argentina en PostgreSQL
process.env.TZ = 'America/Argentina/Buenos_Aires';
'use strict';


const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'almacenq24',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    // Robustez: que nada quede colgado indefinidamente.
    max: 15,                                   // conexiones máximas del pool
    idleTimeoutMillis: 30000,                  // cerrar conexiones ociosas del pool
    connectionTimeoutMillis: 10000,            // si el pool está lleno, esperar máx 10s y fallar (en vez de colgar para siempre)
    statement_timeout: 30000,                  // ninguna consulta puede tardar más de 30s
    idle_in_transaction_session_timeout: 60000,// matar transacciones que queden colgadas 60s (evita saturar el pool)
});

// Un error del pool (conexión caída, etc.) no debe tumbar el proceso.
pool.on('error', (err) => {
    console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

pool.connect()
    .then(() => console.log('✅ Conectado a PostgreSQL correctamente'))
    .catch(err => console.error('❌ Error:', err.message));

function query(text, params) {
    return pool.query(text, params);
}

exports.query = query;
exports.pool = pool;