# 📚 SalleInventory - Sistema de Inventario de Aulas

**Instituto La Salle Florida**  
Sistema integral de gestión de inventario de equipamiento educativo.

## 🎯 Descripción

SalleInventory es un sistema web diseñado específicamente para el Instituto La Salle Florida que permite gestionar el inventario de equipamiento en aulas de manera eficiente y detallada.

### ✨ Características Principales

- **Registro detallado** con cantidades por estado (Bueno/Regular/Malo/Roto)
- **Sistema de perfiles** con permisos específicos por rol
- **Campos dinámicos** para especificaciones técnicas (pulgadas TV, tipo de sillas, etc.)
- **Reportes inteligentes** con estadísticas y alertas
- **Interfaz responsive** optimizada para tablets y móviles
- **Validaciones automáticas** para integridad de datos

## 🏗️ Arquitectura Técnica

### Backend
- **Node.js + Express** para API REST
- **SQL Server 2022** como base de datos
- **JWT** para autenticación
- **bcrypt** para encriptación de contraseñas

### Frontend
- **HTML5/CSS3/JavaScript** nativo (sin frameworks)
- **Responsive design** para múltiples dispositivos
- **PWA ready** para instalación como app móvil

## 📦 Instalación

### Prerrequisitos

- Node.js 16+ 
- SQL Server 2022
- Git

### 1. Clonar y configurar proyecto

```bash
# Crear estructura del proyecto
mkdir salle-inventory
cd salle-inventory
mkdir server frontend

# Copiar archivos del repositorio
# (Copiar los archivos generados por Claude)
```

### 2. Configurar base de datos

```sql
-- Ejecutar en SQL Server Management Studio
-- Archivo: schema.sql (archivo corregido que proporcionaste)
```

### 3. Configurar backend

```bash
# Ir al directorio del servidor
cd server

# Instalar dependencias
npm install express cors bcryptjs jsonwebtoken mssql dotenv helmet express-rate-limit moment
npm install --save-dev nodemon

# Crear archivo .env
```

Contenido del archivo `.env`:
```env
DB_SERVER=10.0.10.26
DB_INSTANCE=
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=LaSalle2599
DB_DATABASE=inventario_aulas
JWT_SECRET=salle_secreto_muy_largo_y_seguro_2025
PORT=3000
NODE_ENV=development
```

### 4. Ejecutar sistema

```bash
# En el directorio server/
npm run dev

# El sistema estará disponible en:
# http://localhost:3000
```

## 👥 Usuarios por Defecto

| Email | Contraseña | Rol | Permisos |
|-------|------------|-----|----------|
| admin@escuela.edu | 123456 | Administrador | Acceso total |
| supervisor@escuela.edu | 123456 | Supervisor | Ve todo, edita inventario |
| ti@escuela.edu | 123456 | Soporte TI | Solo equipos tecnológicos |
| mantenimiento@escuela.edu | 123456 | Mantenimiento | Infraestructura y mobiliario |
| docente@escuela.edu | 123456 | Docente | Solo consulta |

## 🔧 Configuración de Permisos

### Roles definidos:

#### 🔑 Administrador
- Acceso completo a todas las funcionalidades
- Gestión de usuarios y configuración del sistema
- Generación de todos los reportes

#### 👨‍💼 Supervisor  
- Ve todo el inventario
- Puede registrar y editar inventarios
- Acceso a reportes completos
- No puede gestionar usuarios

#### 💻 Soporte TI
- **Solo equipos tecnológicos**: Televisores, computadoras, proyectores, parlantes
- Puede registrar y editar su categoría asignada
- Ve reportes de equipos tecnológicos

#### 🔧 Mantenimiento
- **Infraestructura**: Mobiliario, climatización, iluminación, infraestructura
- Puede registrar y editar sus categorías asignadas  
- Ve reportes de infraestructura

#### 📚 Docente
- **Solo consulta** del inventario
- No puede editar datos
- Puede reportar problemas básicos

## 📋 Categorías de Inventario

### 📺 Audio/Video (Soporte TI)
- **Televisión**: Pulgadas, marca, modelo
- **Computadora**: Tipo (desktop/laptop), procesador, RAM
- **Proyector**: Lumens, marca, resolución
- **Parlantes**: Tipo (activos/pasivos), potencia

### 🪑 Mobiliario (Mantenimiento)
- **Sillas**: Tipo (plástica/madera/ergonómica), color
- **Pupitres**: Tipo (individual/doble), material
- **Escritorio**: Material (madera/metal/melamina), tamaño
- **Pizarrón**: Tipo (tiza/marcador/digital), tamaño
- **Armarios**: Material, cantidad de puertas

### 🌡️ Climatización (Mantenimiento)
- **Calefacción**: Tipo (gas/eléctrica/radiador), BTU
- **Refrigeración**: Tipo (ventilador/aire acondicionado/cooling), BTU

### 💡 Iluminación (Mantenimiento)
- **Plafones**: Tipo (LED/fluorescente), watts
- **Tubos**: Tipo (LED/fluorescente), watts, longitud
- **Bombillas**: Tipo (LED/incandescente/ahorro), watts

### 🏗️ Infraestructura (Mantenimiento)
- **Ventanas**: Tipo (corrediza/batiente/fija), material, medidas
- **Pintura**: Áreas (paredes/techo/todo), tipo, color
- **Pisos**: Material (cerámica/madera/vinílico)
- **Puertas**: Material (madera/metal/vidrio), tipo

## 📊 Sistema de Estados

Para cada ítem se registra:

- **Cantidad Total**: Número total de unidades
- **Cantidad Buena**: Unidades en perfecto estado
- **Cantidad Regular**: Unidades funcionales con detalles menores
- **Cantidad Mala**: Unidades que funcionan pero necesitan reparación
- **Cantidad Rota**: Unidades no funcionales

### Validación automática:
```
Total = Bueno + Regular + Malo + Roto
```

## 🎯 Casos de Uso

### Registro de Inventario
1. Seleccionar aula
2. Completar cantidades por estado de cada equipo
3. Agregar especificaciones técnicas
4. Incluir observaciones
5. Guardar registro

### Consulta de Estado
- Ver estadísticas generales del instituto
- Consultar estado por aula
- Identificar equipos críticos

### Reportes
- **Resumen General**: Estadísticas globales
- **Items Críticos**: Equipos con >30% en mal estado
- **Por Aulas**: Estado detallado de cada aula
- **Exportación**: Excel con datos completos

## 🗄️ Estructura de Base de Datos

### Tablas Principales:
- `usuarios` - Sistema de autenticación
- `aulas` - Listado de espacios físicos
- `categorias` - Tipos de equipamiento
- `subcategorias` - Items específicos
- `inventarios` - Registro principal por aula
- `detalles_inventario` - Cantidades por estado
- `permisos_categoria` - Control de acceso por rol
- `historial` - Auditoría de cambios

## 🔒 Seguridad

### Autenticación
- Tokens JWT con expiración de 24h
- Contraseñas encriptadas con bcrypt
- Rate limiting en endpoints sensibles

### Autorización
- Middleware de verificación de permisos
- Filtrado de datos por rol de usuario
- Validación de acceso a categorías

### Auditor
