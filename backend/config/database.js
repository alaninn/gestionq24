// Forzar timezone Argentina en PostgreSQL
process.env.TZ = 'America/Argentina/Buenos_Aires';
'use strict';


const pg = require('pg');
require('dotenv').config({ override: process.env.RENDER ? true : false });

// En Render usamos directamente la conexion completa, sino las variables locales
const poolConfig = process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'almacenq24',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
    };

const pool = new pg.Pool(poolConfig);

pool.connect()
    .then(() => console.log('✅ Conectado a PostgreSQL correctamente'))
    .catch(err => console.error('❌ Error:', err.message));

function query(text, params) {
    return pool.query(text, params);
}

exports.query = query;