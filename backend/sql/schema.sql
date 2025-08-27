-- ================================================
-- SISTEMA DE INVENTARIO DE AULAS - SCHEMA SQL SERVER
-- ================================================

-- Crear base de datos solo si no existe para evitar errores
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inventario_aulas')
BEGIN
    CREATE DATABASE inventario_aulas;
    PRINT 'Base de datos "inventario_aulas" creada.';
END
ELSE
BEGIN
    PRINT 'La base de datos "inventario_aulas" ya existe. No se realizaron cambios.';
END
GO

USE inventario_aulas;
GO

-- ================================================
-- TABLA: usuarios
-- Se crea solo si no existe
-- ================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='usuarios' and xtype='U')
CREATE TABLE usuarios (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    email NVARCHAR(100) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    rol NVARCHAR(50) NOT NULL DEFAULT 'docente',
    activo BIT DEFAULT 1,
    fecha_creacion DATETIME DEFAULT GETDATE(),
    ultimo_acceso DATETIME NULL
);
GO

-- ================================================
-- TABLA: aulas
-- ================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='aulas' and xtype='U')
CREATE TABLE aulas (
    id INT IDENTITY(1,1) PRIMARY KEY,
    codigo NVARCHAR(20) UNIQUE NOT NULL, -- ej: "A1", "B2", "Lab1"
    nombre NVARCHAR(100) NOT NULL,
    edificio NVARCHAR(50) NULL,
    piso INT NULL,
    capacidad INT NULL,
    tipo NVARCHAR(50) NULL, -- "aula", "laboratorio", "auditorio"
    activa BIT DEFAULT 1,
    fecha_creacion DATETIME DEFAULT GETDATE()
);
GO

-- ================================================
-- TABLA: categorias (Tipos principales de equipamiento)
-- ================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='categorias' and xtype='U')
CREATE TABLE categorias (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(50) UNIQUE NOT NULL, -- "audio_video", "mobiliario", "climatizacion", etc.
    descripcion NVARCHAR(200) NULL,
    icono NVARCHAR(20) NULL, -- emoji o clase CSS
    orden_display INT DEFAULT 0,
    activa BIT DEFAULT 1
);
GO

-- ================================================
-- TABLA: subcategorias (Items específicos)
-- ================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='subcategorias' and xtype='U')
CREATE TABLE subcategorias (
    id INT IDENTITY(1,1) PRIMARY KEY,
    id_categoria INT NOT NULL,
    nombre NVARCHAR(50) NOT NULL, -- "television", "sillas", "calefaccion"
    descripcion NVARCHAR(200) NULL,
    unidad_medida NVARCHAR(20) DEFAULT 'unidades', -- "unidades", "metros", "litros"
    permite_cantidad BIT DEFAULT 1, -- si se puede especificar cantidad
    campos_extra NVARCHAR(MAX) NULL, -- JSON con campos específicos
    orden_display INT DEFAULT 0,
    activa BIT DEFAULT 1,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id)
);
GO

-- ================================================
-- TABLA: inventarios (Registro principal por aula)
-- ================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='inventarios' and xtype='U')
CREATE TABLE inventarios (
    id INT IDENTITY(1,1) PRIMARY KEY,
    id_aula INT NOT NULL,
    id_usuario INT NOT NULL, -- quien registro
    fecha_registro DATETIME DEFAULT GETDATE(),
    observaciones NVARCHAR(MAX) NULL,
    estado_general NVARCHAR(20) DEFAULT 'pendiente', -- "pendiente", "completo", "revision"
    FOREIGN KEY (id_aula) REFERENCES aulas(id),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);
GO

-- ================================================
-- TABLA: detalles_inventario (Cantidades por estado de cada item)
-- ================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='detalles_inventario' and xtype='U')
CREATE TABLE detalles_inventario (
    id INT IDENTITY(1,1) PRIMARY KEY,
    id_inventario INT NOT NULL,
    id_subcategoria INT NOT NULL,
    cantidad_total INT DEFAULT 0,
    cantidad_bueno INT DEFAULT 0,
    cantidad_regular INT DEFAULT 0,
    cantidad_malo INT DEFAULT 0,
    cantidad_roto INT DEFAULT 0,
    especificaciones NVARCHAR(MAX) NULL, -- JSON con datos extra (tamaño TV, tipo silla, etc.)
    observaciones NVARCHAR(500) NULL,
    fecha_actualizacion DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (id_inventario) REFERENCES inventarios(id) ON DELETE CASCADE,
    FOREIGN KEY (id_subcategoria) REFERENCES subcategorias(id)
);
GO

-- ================================================
-- TABLA: permisos_categoria (Qué puede ver cada rol)
-- ================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='permisos_categoria' and xtype='U')
CREATE TABLE permisos_categoria (
    id INT IDENTITY(1,1) PRIMARY KEY,
    rol NVARCHAR(50) NOT NULL,
    id_categoria INT NOT NULL,
    puede_ver BIT DEFAULT 1,
    puede_editar BIT DEFAULT 0,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id),
    UNIQUE(rol, id_categoria)
);
GO

-- ================================================
-- TABLA: historial (Auditoría de cambios)
-- ================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='historial' and xtype='U')
CREATE TABLE historial (
    id INT IDENTITY(1,1) PRIMARY KEY,
    tabla_afectada NVARCHAR(50) NOT NULL,
    id_registro INT NOT NULL,
    accion NVARCHAR(20) NOT NULL, -- "INSERT", "UPDATE", "DELETE"
    datos_anteriores NVARCHAR(MAX) NULL, -- JSON
    datos_nuevos NVARCHAR(MAX) NULL, -- JSON
    id_usuario INT NOT NULL,
    fecha DATETIME DEFAULT GETDATE(),
    ip_address NVARCHAR(45) NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);
GO

-- ================================================
-- TABLA: configuracion (Parámetros del sistema)
-- ================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='configuracion' and xtype='U')
CREATE TABLE configuracion (
    id INT IDENTITY(1,1) PRIMARY KEY,
    clave NVARCHAR(100) UNIQUE NOT NULL,
    valor NVARCHAR(MAX) NOT NULL,
    descripcion NVARCHAR(300) NULL,
    tipo NVARCHAR(20) DEFAULT 'texto', -- "texto", "numero", "booleano", "json"
    fecha_actualizacion DATETIME DEFAULT GETDATE()
);
GO

-- ================================================
-- ÍNDICES PARA PERFORMANCE
-- ================================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_inventarios_aula_fecha')
CREATE INDEX IX_inventarios_aula_fecha ON inventarios(id_aula, fecha_registro);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_detalles_inventario_subcategoria')
CREATE INDEX IX_detalles_inventario_subcategoria ON detalles_inventario(id_subcategoria);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_usuarios_email')
CREATE INDEX IX_usuarios_email ON usuarios(email);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_aulas_codigo')
CREATE INDEX IX_aulas_codigo ON aulas(codigo);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_historial_tabla_registro')
CREATE INDEX IX_historial_tabla_registro ON historial(tabla_afectada, id_registro);
GO

-- ================================================
-- DATOS INICIALES - (Se insertan solo si las tablas están vacías)
-- ================================================
-- Password por defecto: "123456" (hash bcrypt)
IF (SELECT COUNT(*) FROM usuarios) = 0
BEGIN
    INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
    ('Administrador', 'admin@escuela.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'administrador'),
    ('Supervisor General', 'supervisor@escuela.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'supervisor'),
    ('Soporte TI', 'ti@escuela.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'soporte_ti'),
    ('Mantenimiento', 'mantenimiento@escuela.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'mantenimiento'),
    ('Docente Ejemplo', 'docente@escuela.edu', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'docente');
END
GO

IF (SELECT COUNT(*) FROM aulas) = 0
BEGIN
    INSERT INTO aulas (codigo, nombre, edificio, piso, capacidad, tipo) VALUES
    ('A1', 'Aula A1 - Matemáticas', 'Edificio A', 1, 30, 'aula'),
    ('A2', 'Aula A2 - Lengua', 'Edificio A', 1, 30, 'aula'),
    ('A3', 'Aula A3 - Historia', 'Edificio A', 1, 30, 'aula'),
    ('B1', 'Aula B1 - Ciencias', 'Edificio B', 1, 25, 'aula'),
    ('B2', 'Aula B2 - Inglés', 'Edificio B', 1, 25, 'aula'),
    ('LAB1', 'Laboratorio de Informática 1', 'Edificio C', 1, 20, 'laboratorio'),
    ('LAB2', 'Laboratorio de Ciencias', 'Edificio C', 1, 15, 'laboratorio'),
    ('AUD1', 'Auditorio Principal', 'Edificio A', 2, 100, 'auditorio');
END
GO

IF (SELECT COUNT(*) FROM categorias) = 0
BEGIN
    INSERT INTO categorias (nombre, descripcion, icono, orden_display) VALUES
    ('audio_video', 'Equipos tecnológicos audiovisuales', '📺', 1),
    ('mobiliario', 'Muebles y mobiliario', '🪑', 2),
    ('climatizacion', 'Sistemas de calefacción y refrigeración', '🌡️', 3),
    ('iluminacion', 'Sistemas de iluminación', '💡', 4),
    ('infraestructura', 'Ventanas, pintura, pisos', '🏗️', 5);
END
GO

-- (Se asume que si categorias está vacía, subcategorias también lo está)
IF (SELECT COUNT(*) FROM subcategorias) = 0
BEGIN
    -- Audio/Video
    INSERT INTO subcategorias (id_categoria, nombre, descripcion, campos_extra, orden_display) VALUES
    (1, 'television', 'Televisores y pantallas', '{"pulgadas": "number", "marca": "text", "modelo": "text"}', 1),
    (1, 'computadora', 'PCs y laptops', '{"tipo": "select:desktop,laptop", "procesador": "text", "ram": "text"}', 2),
    (1, 'proyector', 'Proyectores multimedia', '{"lumens": "number", "marca": "text", "resolucion": "text"}', 3),
    (1, 'parlantes', 'Sistemas de audio', '{"tipo": "select:activos,pasivos", "potencia": "number"}', 4);

    -- Mobiliario
    INSERT INTO subcategorias (id_categoria, nombre, descripcion, campos_extra, orden_display) VALUES
    (2, 'sillas', 'Sillas para estudiantes', '{"tipo": "select:plastica,madera,ergonomica", "color": "text"}', 1),
    (2, 'pupitres', 'Pupitres y mesas de estudio', '{"tipo": "select:individual,doble", "material": "text"}', 2),
    (2, 'escritorio', 'Escritorio del docente', '{"material": "select:madera,metal,melamina", "tamano": "text"}', 3),
    (2, 'pizarron', 'Pizarrones y tableros', '{"tipo": "select:tiza,marcador,digital", "tamano": "text"}', 4),
    (2, 'armarios', 'Armarios y estanterías', '{"material": "text", "puertas": "number"}', 5);

    -- Climatización
    INSERT INTO subcategorias (id_categoria, nombre, descripcion, campos_extra, orden_display) VALUES
    (3, 'calefaccion', 'Sistemas de calefacción', '{"tipo": "select:gas,electrica,radiador", "btu": "number"}', 1),
    (3, 'refrigeracion', 'Sistemas de refrigeración', '{"tipo": "select:ventilador,aire_acondicionado,cooling", "btu": "number"}', 2);

    -- Iluminación
    INSERT INTO subcategorias (id_categoria, nombre, descripcion, campos_extra, orden_display) VALUES
    (4, 'plafones', 'Plafones de techo', '{"tipo": "select:led,fluorescente", "watts": "number"}', 1),
    (4, 'tubos', 'Tubos fluorescentes', '{"tipo": "select:led,fluorescente", "watts": "number", "longitud": "text"}', 2),
    (4, 'bombillas', 'Bombillas y focos', '{"tipo": "select:led,incandescente,ahorro", "watts": "number"}', 3);

    -- Infraestructura
    INSERT INTO subcategorias (id_categoria, nombre, descripcion, campos_extra, orden_display) VALUES
    (5, 'ventanas', 'Ventanas y vidrios', '{"tipo": "select:corrediza,batiente,fija", "material": "text", "medidas": "text"}', 1),
    (5, 'pintura', 'Estado de pintura', '{"areas": "select:paredes,techo,todo", "tipo": "text", "color": "text"}', 2),
    (5, 'pisos', 'Pisos y revestimientos', '{"material": "select:ceramica,madera,vinilico", "estado": "text"}', 3),
    (5, 'puertas', 'Puertas y marcos', '{"material": "select:madera,metal,vidrio", "tipo": "text"}', 4);
END
GO

IF (SELECT COUNT(*) FROM permisos_categoria) = 0
BEGIN
    -- Administrador - ve todo
    INSERT INTO permisos_categoria (rol, id_categoria, puede_ver, puede_editar) 
    SELECT 'administrador', id, 1, 1 FROM categorias;

    -- Supervisor - ve todo, edita todo
    INSERT INTO permisos_categoria (rol, id_categoria, puede_ver, puede_editar) 
    SELECT 'supervisor', id, 1, 1 FROM categorias;

    -- Soporte TI - solo audio/video
    INSERT INTO permisos_categoria (rol, id_categoria, puede_ver, puede_editar) VALUES
    ('soporte_ti', 1, 1, 1); -- audio_video

    -- Mantenimiento - mobiliario, climatización, iluminación, infraestructura
    INSERT INTO permisos_categoria (rol, id_categoria, puede_ver, puede_editar) VALUES
    ('mantenimiento', 2, 1, 1), -- mobiliario
    ('mantenimiento', 3, 1, 1), -- climatizacion
    ('mantenimiento', 4, 1, 1), -- iluminacion
    ('mantenimiento', 5, 1, 1); -- infraestructura

    -- Docente - solo puede ver (no editar)
    INSERT INTO permisos_categoria (rol, id_categoria, puede_ver, puede_editar) 
    SELECT 'docente', id, 1, 0 FROM categorias;
END
GO

IF (SELECT COUNT(*) FROM configuracion) = 0
BEGIN
    INSERT INTO configuracion (clave, valor, descripcion, tipo) VALUES
    ('app_nombre', 'Sistema de Inventario de Aulas', 'Nombre de la aplicación', 'texto'),
    ('app_version', '1.0.0', 'Versión actual del sistema', 'texto'),
    ('items_por_pagina', '20', 'Cantidad de items por página en reportes', 'numero'),
    ('notificar_criticos', 'true', 'Notificar cuando items críticos < 50%', 'booleano'),
    ('exportar_logo', '', 'URL del logo para reportes exportados', 'texto');
END
GO

-- ================================================
-- VISTAS ÚTILES PARA REPORTES
-- ================================================

-- Eliminar vistas si existen para poder crearlas de nuevo
IF OBJECT_ID('vista_resumen_aulas', 'V') IS NOT NULL
    DROP VIEW vista_resumen_aulas;
GO

-- Vista resumen por aula
CREATE VIEW vista_resumen_aulas AS
SELECT 
    a.id as id_aula,
    a.codigo,
    a.nombre as nombre_aula,
    a.edificio,
    COUNT(DISTINCT i.id) as total_inventarios,
    MAX(i.fecha_registro) as ultimo_inventario,
    SUM(ISNULL(di.cantidad_total, 0)) as total_items,
    SUM(ISNULL(di.cantidad_bueno, 0)) as items_buenos,
    SUM(ISNULL(di.cantidad_regular, 0)) as items_regulares,
    SUM(ISNULL(di.cantidad_malo, 0)) as items_malos,
    SUM(ISNULL(di.cantidad_roto, 0)) as items_rotos,
    CASE 
        WHEN SUM(ISNULL(di.cantidad_total, 0)) > 0 
        THEN ROUND((CAST(SUM(ISNULL(di.cantidad_bueno, 0) + ISNULL(di.cantidad_regular, 0)) AS FLOAT) / SUM(di.cantidad_total)) * 100, 1)
        ELSE 0 
    END as porcentaje_operativo
FROM aulas a
LEFT JOIN inventarios i ON a.id = i.id_aula
LEFT JOIN detalles_inventario di ON i.id = di.id_inventario
WHERE a.activa = 1
GROUP BY a.id, a.codigo, a.nombre, a.edificio;
GO

IF OBJECT_ID('vista_items_criticos', 'V') IS NOT NULL
    DROP VIEW vista_items_criticos;
GO

-- Vista de items críticos (mal estado > 30%)
CREATE VIEW vista_items_criticos AS
SELECT 
    a.codigo as aula,
    c.nombre as categoria,
    s.nombre as subcategoria,
    di.cantidad_total,
    di.cantidad_malo + di.cantidad_roto as cantidad_problemas,
    ROUND((CAST(di.cantidad_malo + di.cantidad_roto AS FLOAT) / NULLIF(di.cantidad_total, 0)) * 100, 1) as porcentaje_problemas,
    di.observaciones,
    i.fecha_registro
FROM detalles_inventario di
JOIN inventarios i ON di.id_inventario = i.id
JOIN aulas a ON i.id_aula = a.id
JOIN subcategorias s ON di.id_subcategoria = s.id
JOIN categorias c ON s.id_categoria = c.id
WHERE di.cantidad_total > 0 
    AND (CAST(di.cantidad_malo + di.cantidad_roto AS FLOAT) / di.cantidad_total) > 0.3
    AND a.activa = 1;
GO

PRINT 'Base de datos y objetos creados/verificados exitosamente!';
PRINT 'Usuario por defecto: admin@escuela.edu / 123456';
GO
