// ================================================
// ARCHIVO: server.js
// ================================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB } = require('./db');
const apiRoutes = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;

// ================================================
// CONFIGURACIÓN DE SEGURIDAD
// ================================================
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100 // máximo 100 requests por ventana
});
app.use('/api/', limiter);

// ================================================
// CONFIGURACIÓN DE CORS
// ================================================
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://10.0.10.26:3000',
    'http://10.0.10.26:8080',
    process.env.CORS_ORIGIN
].filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requests sin origin (como mobile apps)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS bloqueado para origen:', origin);
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// ================================================
// MIDDLEWARES GLOBALES
// ================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ================================================
// RUTAS ESTÁTICAS (Frontend)
// ================================================
app.use(express.static('../frontend'));

// ================================================
// RUTAS DE LA API
// ================================================
app.use('/api', apiRoutes);

// ================================================
// RUTA DE SALUD DEL SERVIDOR
// ================================================
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ================================================
// MANEJO DE ERRORES GLOBALES
// ================================================
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Error interno del servidor'
            : err.message
    });
});

// ================================================
// FUNCIÓN PARA INICIAR EL SERVIDOR
// ================================================
async function startServer() {
    try {
        // Conectar a la base de datos
        await connectDB();
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
            console.log(`📡 API disponible en http://localhost:${PORT}/api`);
            console.log(`🌐 Frontend disponible en http://localhost:${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
        });
        
    } catch (error) {
        console.error('❌ Error fatal al iniciar servidor:', error);
        process.exit(1);
    }
}

// Manejo graceful de cierre
process.on('SIGTERM', () => {
    console.log('🛑 Cerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Cerrando servidor...');
    process.exit(0);
});

startServer();