// Forzar timezone Argentina en PostgreSQL
process.env.TZ = 'America/Argentina/Buenos_Aires';
'use strict';


const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({
    host: 'localhost',
    port: 5432,
    database: 'almacenq24',
    user: 'postgres',
    password: process.env.DB_PASSWORD,
});

pool.connect()
    .then(() => console.log('✅ Conectado a PostgreSQL correctamente'))
    .catch(err => console.error('❌ Error:', err.message));

function query(text, params) {
    return pool.query(text, params);
}

exports.query = query;