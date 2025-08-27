# ================================================
# COMANDOS DE INSTALACIÓN
# ================================================

# 1. Crear directorio del proyecto
mkdir inventario-aulas
cd inventario-aulas
mkdir backend frontend

# 2. Instalar dependencias del servidor
cd backend
npm init -y
npm install express cors bcryptjs jsonwebtoken mssql dotenv helmet express-rate-limit moment
npm install --save-dev nodemon
npm audit fix --force

# 3. Crear archivo .env con las credenciales de tu base de datos
# (Ajustar DB_SERVER, DB_USER, DB_PASSWORD según tu configuración)

# 4. Ejecutar el script SQL en SQL Server Management Studio
# para crear la base de datos y las tablas

# 5. Ejecutar el servidor
npm run dev

# ================================================
# ESTRUCTURA FINAL DE ARCHIVOS
# ================================================

backend/
├── .env                    # Configuración de BD y JWT
├── package.json           # Dependencias y scripts
├── server.js              # Servidor principal Express
├── db.js                  # Configuración de conexión SQL Server
├── api.js                 # Rutas de la API REST
└── sql/
    └── schema.sql         # Script de creación de BD

frontend/
├── index.html             # Aplicación web principal
├── login.html            # Página de login
├── css/
│   └── styles.css        # Estilos CSS
├── js/
│   ├── app.js            # Lógica principal del frontend
│   ├── auth.js           # Manejo de autenticación
│   └── api.js            # Cliente API REST
└── assets/
    └── icons/            # Iconos y recursos