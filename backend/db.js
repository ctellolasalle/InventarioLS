// ================================================
// ARCHIVO: db.js
// ================================================
const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
        encrypt: false,
        trustServerCertificate: true,
        instanceName: process.env.DB_INSTANCE || '',
        requestTimeout: 30000,
        connectionTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool;

async function connectDB() {
    try {
        if (pool) {
            return pool;
        }

        console.log('🔌 Conectando a SQL Server...');
        pool = await sql.connect(dbConfig);
        
        console.log('✅ Conectado exitosamente a SQL Server');
        console.log(`📊 Base de datos: ${process.env.DB_DATABASE}`);
        
        return pool;
    } catch (err) {
        console.error('❌ Error de conexión a base de datos:', err);
        throw err;
    }
}

// Función para cerrar la conexión
async function closeDB() {
    try {
        if (pool) {
            await pool.close();
            pool = null;
            console.log('🔌 Conexión a base de datos cerrada');
        }
    } catch (err) {
        console.error('❌ Error cerrando conexión:', err);
    }
}

module.exports = {
    connectDB,
    closeDB,
    sql
};
