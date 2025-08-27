// ================================================
// ARCHIVO: api.js
// ================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const { connectDB, sql } = require('./db');

const router = express.Router();

// ================================================
// MIDDLEWARE DE AUTENTICACIÓN
// ================================================
function auth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

// Middleware para verificar permisos de categoría
async function checkCategoryPermission(req, res, next) {
    try {
        const { categoryId } = req.params;
        const userRole = req.user.rol;
        
        if (userRole === 'administrador') {
            return next(); // Admin tiene acceso a todo
        }
        
        const pool = await connectDB();
        const result = await pool.request()
            .input('rol', sql.NVarChar, userRole)
            .input('categoryId', sql.Int, categoryId)
            .query(`
                SELECT puede_ver, puede_editar 
                FROM permisos_categoria 
                WHERE rol = @rol AND id_categoria = @categoryId
            `);
        
        if (result.recordset.length === 0 || !result.recordset[0].puede_ver) {
            return res.status(403).json({ error: 'No tienes permisos para acceder a esta categoría' });
        }
        
        req.categoryPermissions = result.recordset[0];
        next();
        
    } catch (err) {
        console.error('Error verificando permisos:', err);
        res.status(500).json({ error: 'Error verificando permisos' });
    }
}

// ================================================
// RUTAS DE AUTENTICACIÓN
// ================================================

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }
        
        const pool = await connectDB();
        const result = await pool.request()
            .input('email', sql.NVarChar, email.toLowerCase())
            .query(`
                SELECT id, nombre, email, password_hash, rol, activo
                FROM usuarios 
                WHERE email = @email AND activo = 1
            `);
        
        const user = result.recordset[0];
        if (!user || !await bcrypt.compare(password, user.password_hash)) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }
        
        // Actualizar último acceso
        await pool.request()
            .input('userId', sql.Int, user.id)
            .query('UPDATE usuarios SET ultimo_acceso = GETDATE() WHERE id = @userId');
        
        // Generar token
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email, 
                rol: user.rol,
                nombre: user.nombre
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                nombre: user.nombre,
                email: user.email,
                rol: user.rol
            }
        });
        
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// OBTENER PERFIL DEL USUARIO ACTUAL
router.get('/me', auth, async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request()
            .input('userId', sql.Int, req.user.userId)
            .query(`
                SELECT id, nombre, email, rol, ultimo_acceso, fecha_creacion
                FROM usuarios 
                WHERE id = @userId AND activo = 1
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json(result.recordset[0]);
        
    } catch (err) {
        console.error('Error obteniendo perfil:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ================================================
// RUTAS DE AULAS
// ================================================

// LISTAR AULAS
router.get('/aulas', auth, async (req, res) => {
    try {
        const { activa = true } = req.query;
        const pool = await connectDB();
        
        const result = await pool.request()
            .input('activa', sql.Bit, activa === 'true')
            .query(`
                SELECT id, codigo, nombre, edificio, piso, capacidad, tipo, activa
                FROM aulas 
                WHERE activa = @activa
                ORDER BY codigo
            `);
        
        res.json(result.recordset);
        
    } catch (err) {
        console.error('Error listando aulas:', err);
        res.status(500).json({ error: 'Error obteniendo aulas' });
    }
});

// CREAR AULA (solo admin/supervisor)
router.post('/aulas', auth, async (req, res) => {
    try {
        if (!['administrador', 'supervisor'].includes(req.user.rol)) {
            return res.status(403).json({ error: 'No tienes permisos para crear aulas' });
        }
        
        const { codigo, nombre, edificio, piso, capacidad, tipo } = req.body;
        
        if (!codigo || !nombre) {
            return res.status(400).json({ error: 'Código y nombre son requeridos' });
        }
        
        const pool = await connectDB();
        const result = await pool.request()
            .input('codigo', sql.NVarChar, codigo.toUpperCase())
            .input('nombre', sql.NVarChar, nombre)
            .input('edificio', sql.NVarChar, edificio || null)
            .input('piso', sql.Int, piso || null)
            .input('capacidad', sql.Int, capacidad || null)
            .input('tipo', sql.NVarChar, tipo || 'aula')
            .query(`
                INSERT INTO aulas (codigo, nombre, edificio, piso, capacidad, tipo)
                OUTPUT INSERTED.*
                VALUES (@codigo, @nombre, @edificio, @piso, @capacidad, @tipo)
            `);
        
        res.status(201).json({
            success: true,
            aula: result.recordset[0]
        });
        
    } catch (err) {
        if (err.number === 2627) { // Error de clave duplicada
            return res.status(400).json({ error: 'Ya existe un aula con ese código' });
        }
        console.error('Error creando aula:', err);
        res.status(500).json({ error: 'Error creando aula' });
    }
});

// ================================================
// RUTAS DE CATEGORÍAS Y SUBCATEGORÍAS
// ================================================

// LISTAR CATEGORÍAS (según permisos del usuario)
router.get('/categorias', auth, async (req, res) => {
    try {
        const pool = await connectDB();
        let query = `
            SELECT c.id, c.nombre, c.descripcion, c.icono, c.orden_display
            FROM categorias c
            WHERE c.activa = 1
        `;
        
        const request = pool.request();
        
        // Si no es admin, filtrar por permisos
        if (req.user.rol !== 'administrador') {
            query += ` 
                AND EXISTS (
                    SELECT 1 FROM permisos_categoria pc 
                    WHERE pc.id_categoria = c.id 
                    AND pc.rol = @rol 
                    AND pc.puede_ver = 1
                )
            `;
            request.input('rol', sql.NVarChar, req.user.rol);
        }
        
        query += ' ORDER BY c.orden_display, c.nombre';
        
        const result = await request.query(query);
        res.json(result.recordset);
        
    } catch (err) {
        console.error('Error listando categorías:', err);
        res.status(500).json({ error: 'Error obteniendo categorías' });
    }
});

// LISTAR SUBCATEGORÍAS DE UNA CATEGORÍA
router.get('/categorias/:categoryId/subcategorias', auth, checkCategoryPermission, async (req, res) => {
    try {
        const { categoryId } = req.params;
        const pool = await connectDB();
        
        const result = await pool.request()
            .input('categoryId', sql.Int, categoryId)
            .query(`
                SELECT 
                    id, nombre, descripcion, unidad_medida, 
                    permite_cantidad, campos_extra, orden_display
                FROM subcategorias
                WHERE id_categoria = @categoryId AND activa = 1
                ORDER BY orden_display, nombre
            `);
        
        res.json(result.recordset);
        
    } catch (err) {
        console.error('Error listando subcategorías:', err);
        res.status(500).json({ error: 'Error obteniendo subcategorías' });
    }
});

// ================================================
// RUTAS DE INVENTARIO
// ================================================

// OBTENER INVENTARIO DE UN AULA
router.get('/aulas/:aulaId/inventario', auth, async (req, res) => {
    try {
        const { aulaId } = req.params;
        const pool = await connectDB();
        
        // Obtener el inventario más reciente del aula
        const inventarioResult = await pool.request()
            .input('aulaId', sql.Int, aulaId)
            .query(`
                SELECT TOP 1 
                    i.id, i.fecha_registro, i.observaciones, i.estado_general,
                    u.nombre as registrado_por,
                    a.codigo as aula_codigo, a.nombre as aula_nombre
                FROM inventarios i
                JOIN usuarios u ON i.id_usuario = u.id
                JOIN aulas a ON i.id_aula = a.id
                WHERE i.id_aula = @aulaId
                ORDER BY i.fecha_registro DESC
            `);
        
        if (inventarioResult.recordset.length === 0) {
            return res.json({
                aula: null,
                inventario: null,
                detalles: []
            });
        }
        
        const inventario = inventarioResult.recordset[0];
        
        // Obtener los detalles del inventario
        const detallesResult = await pool.request()
            .input('inventarioId', sql.Int, inventario.id)
            .query(`
                SELECT 
                    di.*,
                    s.nombre as subcategoria_nombre,
                    s.descripcion as subcategoria_descripcion,
                    s.unidad_medida,
                    s.campos_extra,
                    c.nombre as categoria_nombre,
                    c.icono as categoria_icono
                FROM detalles_inventario di
                JOIN subcategorias s ON di.id_subcategoria = s.id
                JOIN categorias c ON s.id_categoria = c.id
                WHERE di.id_inventario = @inventarioId
                ORDER BY c.orden_display, s.orden_display
            `);
        
        res.json({
            inventario,
            detalles: detallesResult.recordset
        });
        
    } catch (err) {
        console.error('Error obteniendo inventario:', err);
        res.status(500).json({ error: 'Error obteniendo inventario' });
    }
});

// CREAR/ACTUALIZAR INVENTARIO DE AULA
router.post('/aulas/:aulaId/inventario', auth, async (req, res) => {
    try {
        const { aulaId } = req.params;
        const { observaciones, detalles } = req.body;
        
        if (!detalles || !Array.isArray(detalles)) {
            return res.status(400).json({ error: 'Detalles de inventario requeridos' });
        }
        
        const pool = await connectDB();
        const transaction = new sql.Transaction(pool);
        
        try {
            await transaction.begin();
            
            // Crear nuevo inventario
            const inventarioRequest = new sql.Request(transaction);
            const inventarioResult = await inventarioRequest
                .input('aulaId', sql.Int, aulaId)
                .input('userId', sql.Int, req.user.userId)
                .input('observaciones', sql.NVarChar, observaciones || null)
                .query(`
                    INSERT INTO inventarios (id_aula, id_usuario, observaciones)
                    OUTPUT INSERTED.id
                    VALUES (@aulaId, @userId, @observaciones)
                `);
            
            const inventarioId = inventarioResult.recordset[0].id;
            
            // Insertar detalles
            for (const detalle of detalles) {
                const detalleRequest = new sql.Request(transaction);
                await detalleRequest
                    .input('inventarioId', sql.Int, inventarioId)
                    .input('subcategoriaId', sql.Int, detalle.id_subcategoria)
                    .input('cantidadTotal', sql.Int, detalle.cantidad_total || 0)
                    .input('cantidadBueno', sql.Int, detalle.cantidad_bueno || 0)
                    .input('cantidadRegular', sql.Int, detalle.cantidad_regular || 0)
                    .input('cantidadMalo', sql.Int, detalle.cantidad_malo || 0)
                    .input('cantidadRoto', sql.Int, detalle.cantidad_roto || 0)
                    .input('especificaciones', sql.NVarChar, JSON.stringify(detalle.especificaciones || {}))
                    .input('observaciones', sql.NVarChar, detalle.observaciones || null)
                    .query(`
                        INSERT INTO detalles_inventario 
                        (id_inventario, id_subcategoria, cantidad_total, cantidad_bueno, 
                         cantidad_regular, cantidad_malo, cantidad_roto, especificaciones, observaciones)
                        VALUES 
                        (@inventarioId, @subcategoriaId, @cantidadTotal, @cantidadBueno,
                         @cantidadRegular, @cantidadMalo, @cantidadRoto, @especificaciones, @observaciones)
                    `);
            }
            
            await transaction.commit();
            
            res.status(201).json({
                success: true,
                inventario_id: inventarioId,
                message: 'Inventario guardado correctamente'
            });
            
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
        
    } catch (err) {
        console.error('Error guardando inventario:', err);
        res.status(500).json({ error: 'Error guardando inventario' });
    }
});

// ================================================
// RUTAS DE REPORTES
// ================================================

// REPORTE RESUMEN GENERAL
router.get('/reportes/resumen', auth, async (req, res) => {
    try {
        const pool = await connectDB();
        
        const result = await pool.request().query(`
            SELECT 
                COUNT(DISTINCT a.id) as total_aulas,
                COUNT(DISTINCT i.id) as aulas_con_inventario,
                SUM(di.cantidad_total) as total_items,
                SUM(di.cantidad_bueno) as items_buenos,
                SUM(di.cantidad_regular) as items_regulares,
                SUM(di.cantidad_malo) as items_malos,
                SUM(di.cantidad_roto) as items_rotos,
                CASE 
                    WHEN SUM(di.cantidad_total) > 0 
                    THEN ROUND((CAST(SUM(di.cantidad_bueno + di.cantidad_regular) AS FLOAT) / SUM(di.cantidad_total)) * 100, 1)
                    ELSE 0 
                END as porcentaje_operativo
            FROM aulas a
            LEFT JOIN inventarios i ON a.id = i.id_aula
            LEFT JOIN detalles_inventario di ON i.id = di.id_inventario
            WHERE a.activa = 1
        `);
        
        res.json(result.recordset[0] || {});
        
    } catch (err) {
        console.error('Error generando resumen:', err);
        res.status(500).json({ error: 'Error generando resumen' });
    }
});

// REPORTE DE ITEMS CRÍTICOS
router.get('/reportes/criticos', auth, async (req, res) => {
    try {
        const pool = await connectDB();
        
        const result = await pool.request().query(`
            SELECT * FROM vista_items_criticos
            ORDER BY porcentaje_problemas DESC, aula, categoria
        `);
        
        res.json(result.recordset);
        
    } catch (err) {
        console.error('Error obteniendo items críticos:', err);
        res.status(500).json({ error: 'Error obteniendo items críticos' });
    }
});

// REPORTE POR AULA
router.get('/reportes/aulas', auth, async (req, res) => {
    try {
        const pool = await connectDB();
        
        const result = await pool.request().query(`
            SELECT * FROM vista_resumen_aulas
            ORDER BY porcentaje_operativo ASC, codigo
        `);
        
        res.json(result.recordset);
        
    } catch (err) {
        console.error('Error generando reporte de aulas:', err);
        res.status(500).json({ error: 'Error generando reporte de aulas' });
    }
});

// ================================================
// RUTAS DE ADMINISTRACIÓN (solo admin)
// ================================================

// LISTAR USUARIOS
router.get('/admin/usuarios', auth, async (req, res) => {
    try {
        if (req.user.rol !== 'administrador') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const pool = await connectDB();
        const result = await pool.request().query(`
            SELECT id, nombre, email, rol, activo, fecha_creacion, ultimo_acceso
            FROM usuarios
            ORDER BY nombre
        `);
        
        res.json(result.recordset);
        
    } catch (err) {
        console.error('Error listando usuarios:', err);
        res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
});

// CREAR USUARIO
router.post('/admin/usuarios', auth, async (req, res) => {
    try {
        if (req.user.rol !== 'administrador') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const { nombre, email, password, rol } = req.body;
        
        if (!nombre || !email || !password) {
            return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
        }
        
        const hash = await bcrypt.hash(password, 12);
        const pool = await connectDB();
        
        const result = await pool.request()
            .input('nombre', sql.NVarChar, nombre)
            .input('email', sql.NVarChar, email.toLowerCase())
            .input('passwordHash', sql.NVarChar, hash)
            .input('rol', sql.NVarChar, rol || 'docente')
            .query(`
                INSERT INTO usuarios (nombre, email, password_hash, rol)
                OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.email, INSERTED.rol
                VALUES (@nombre, @email, @passwordHash, @rol)
            `);
        
        res.status(201).json({
            success: true,
            usuario: result.recordset[0]
        });
        
    } catch (err) {
        if (err.number === 2627) {
            return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
        }
        console.error('Error creando usuario:', err);
        res.status(500).json({ error: 'Error creando usuario' });
    }
});

// ================================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ================================================
router.use((err, req, res, next) => {
    console.error('Error en API:', err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Error interno del servidor'
            : err.message
    });
});

module.exports = router;