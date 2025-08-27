// ================================================
// GESTION DE AUTENTICACION - SalleInventory
// ================================================

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.loginAttempts = 0;
        this.maxLoginAttempts = 5;
        this.lockoutDuration = 15 * 60 * 1000; // 15 minutos
    }

    // ================================================
    // METODOS DE AUTENTICACION
    // ================================================

    async login(email, password) {
        try {
            // Verificar si la cuenta esta bloqueada
            if (this.isAccountLocked()) {
                throw new Error('Cuenta bloqueada temporalmente. Intenta en 15 minutos.');
            }

            const response = await window.apiClient.login(email, password);

            if (response.success && response.token) {
                // Login exitoso
                this.token = response.token;
                this.currentUser = response.user;
                
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.currentUser));
                
                // Resetear intentos de login
                this.resetLoginAttempts();
                
                // Actualizar UI
                this.showMainApp();
                this.updateUserDisplay();
                
                return true;
            } else {
                throw new Error(response.error || 'Error de autenticacion');
            }

        } catch (error) {
            this.handleLoginError(error);
            return false;
        }
    }

    async logout() {
        try {
            // Limpiar datos locales
            this.token = null;
            this.currentUser = null;
            
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Mostrar pantalla de login
            this.showLoginScreen();
            
            // Limpiar formularios
            this.clearForms();
            
        } catch (error) {
            console.error('Error en logout:', error);
            // Forzar logout aunque haya errores
            window.location.reload();
        }
    }

    async verifyToken() {
        if (!this.token) {
            return false;
        }

        try {
            const profile = await window.apiClient.getProfile();
            this.currentUser = profile;
            localStorage.setItem('user', JSON.stringify(profile));
            return true;
        } catch (error) {
            console.warn('Token invalido:', error);
            this.logout();
            return false;
        }
    }

    // ================================================
    // GESTION DE INTENTOS DE LOGIN
    // ================================================

    handleLoginError(error) {
        this.loginAttempts++;
        
        if (this.loginAttempts >= this.maxLoginAttempts) {
            this.lockAccount();
            this.showLoginError('Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.');
        } else {
            const remainingAttempts = this.maxLoginAttempts - this.loginAttempts;
            this.showLoginError(`${error.message} (${remainingAttempts} intentos restantes)`);
        }
    }

    lockAccount() {
        const lockTime = Date.now() + this.lockoutDuration;
        localStorage.setItem('accountLocked', lockTime.toString());
    }

    isAccountLocked() {
        const lockTime = localStorage.getItem('accountLocked');
        if (!lockTime) return false;

        if (Date.now() < parseInt(lockTime)) {
            return true;
        } else {
            localStorage.removeItem('accountLocked');
            return false;
        }
    }

    resetLoginAttempts() {
        this.loginAttempts = 0;
        localStorage.removeItem('accountLocked');
    }

    // ================================================
    // CONTROL DE PERMISOS
    // ================================================

    hasPermission(action, resource = null) {
        if (!this.currentUser) return false;

        const userRole = this.currentUser.rol;

        // Administrador tiene todos los permisos
        if (userRole === 'administrador') {
            return true;
        }

        // Verificar permisos específicos por rol
        const permissions = {
            'supervisor': {
                view: ['all'],
                edit: ['inventario', 'reportes'],
                admin: false
            },
            'soporte_ti': {
                view: ['audio_video', 'inventario'],
                edit: ['audio_video'],
                admin: false
            },
            'mantenimiento': {
                view: ['mobiliario', 'climatizacion', 'iluminacion', 'infraestructura', 'inventario'],
                edit: ['mobiliario', 'climatizacion', 'iluminacion', 'infraestructura'],
                admin: false
            },
            'docente': {
                view: ['inventario'],
                edit: [],
                admin: false
            }
        };

        const rolePermissions = permissions[userRole];
        if (!rolePermissions) return false;

        switch (action) {
            case 'view':
                return rolePermissions.view.includes('all') || 
                       rolePermissions.view.includes(resource);
            case 'edit':
                return rolePermissions.edit.includes('all') || 
                       rolePermissions.edit.includes(resource);
            case 'admin':
                return rolePermissions.admin;
            default:
                return false;
        }
    }

    canAccessCategory(categoryName) {
        return this.hasPermission('view', categoryName);
    }

    canEditCategory(categoryName) {
        return this.hasPermission('edit', categoryName);
    }

    isAdmin() {
        return this.currentUser && this.currentUser.rol === 'administrador';
    }

    isSupervisor() {
        return this.currentUser && ['administrador', 'supervisor'].includes(this.currentUser.rol);
    }

    // ================================================
    // METODOS DE UI
    // ================================================

    showLoginScreen() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (loginScreen && mainApp) {
            loginScreen.classList.remove('hidden');
            mainApp.classList.add('hidden');
        }

        // Limpiar errores previos
        this.hideLoginError();
        
        // Focus en el campo email
        setTimeout(() => {
            const emailField = document.getElementById('email');
            if (emailField) emailField.focus();
        }, 100);
    }

    showMainApp() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (loginScreen && mainApp) {
            loginScreen.classList.add('hidden');
            mainApp.classList.remove('hidden');
        }

        // Mostrar/ocultar elementos según permisos
        this.updateUIPermissions();
    }

    updateUserDisplay() {
        if (!this.currentUser) return;

        const userNameElement = document.querySelector('.user-name');
        const userRoleElement = document.querySelector('.user-role');

        if (userNameElement) {
            userNameElement.textContent = this.currentUser.nombre;
        }
        
        if (userRoleElement) {
            userRoleElement.textContent = this.formatRole(this.currentUser.rol);
        }
    }

    updateUIPermissions() {
        // Mostrar tab de admin solo para administradores
        const adminTab = document.getElementById('adminTab');
        if (adminTab) {
            if (this.isAdmin()) {
                adminTab.classList.remove('hidden');
            } else {
                adminTab.classList.add('hidden');
            }
        }

        // Ocultar/mostrar botones según permisos
        this.updateButtonPermissions();
    }

    updateButtonPermissions() {
        const editButtons = document.querySelectorAll('[data-requires-edit]');
        const adminButtons = document.querySelectorAll('[data-requires-admin]');
        
        editButtons.forEach(button => {
            const requiredPermission = button.dataset.requiresEdit;
            if (!this.hasPermission('edit', requiredPermission)) {
                button.classList.add('hidden');
            }
        });

        adminButtons.forEach(button => {
            if (!this.isAdmin()) {
                button.classList.add('hidden');
            }
        });
    }

    showLoginError(message) {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
            
            // Auto-ocultar después de 5 segundos
            setTimeout(() => {
                this.hideLoginError();
            }, 5000);
        }
    }

    hideLoginError() {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
        }
    }

    clearForms() {
        // Limpiar todos los formularios
        document.querySelectorAll('form').forEach(form => {
            form.reset();
        });

        // Limpiar campos específicos
        const aulaSelect = document.getElementById('aulaSelect');
        if (aulaSelect) {
            aulaSelect.value = '';
        }

        // Resetear estados de botones
        const loadBtn = document.getElementById('loadInventoryBtn');
        if (loadBtn) {
            loadBtn.disabled = true;
        }
    }

    // ================================================
    // UTILIDADES
    // ================================================

    formatRole(rol) {
        const roles = {
            'administrador': 'Administrador',
            'supervisor': 'Supervisor',
            'soporte_ti': 'Soporte TI',
            'mantenimiento': 'Mantenimiento',
            'docente': 'Docente'
        };
        return roles[rol] || rol;
    }

    getUserRole() {
        return this.currentUser ? this.currentUser.rol : null;
    }

    getUserName() {
        return this.currentUser ? this.currentUser.nombre : null;
    }

    getUserId() {
        return this.currentUser ? this.currentUser.id : null;
    }

    isLoggedIn() {
        return !!(this.token && this.currentUser);
    }

    // Inicializar el sistema al cargar la página
    async initialize() {
        try {
            // Verificar si hay token guardado
            const savedUser = localStorage.getItem('user');
            if (this.token && savedUser) {
                this.currentUser = JSON.parse(savedUser);
                
                // Verificar que el token siga siendo válido
                const isValid = await this.verifyToken();
                if (isValid) {
                    this.showMainApp();
                    return true;
                }
            }
            
            // No hay sesión válida, mostrar login
            this.showLoginScreen();
            return false;
            
        } catch (error) {
            console.error('Error inicializando auth:', error);
            this.showLoginScreen();
            return false;
        }
    }

    // ================================================
    // SESSION MANAGEMENT
    // ================================================

    // Renovar token antes de que expire (opcional)
    async refreshToken() {
        try {
            const response = await window.apiClient.request('/refresh-token', {
                method: 'POST'
            });
            
            if (response.token) {
                this.token = response.token;
                localStorage.setItem('token', this.token);
                return true;
            }
            
            return false;
        } catch (error) {
            console.warn('Error renovando token:', error);
            return false;
        }
    }

    // Auto-logout por inactividad (opcional)
    setupAutoLogout(minutes = 60) {
        let inactivityTimer;
        
        const resetTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                this.logout();
                alert('Sesión cerrada por inactividad');
            }, minutes * 60 * 1000);
        };

        // Eventos que resetean el timer
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });

        // Inicializar timer
        resetTimer();
    }
}

// ================================================
// INICIALIZACION
// ================================================

// Crear instancia global del gestor de autenticación
window.authManager = new AuthManager();

// Auto-inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    await window.authManager.initialize();
});

// ================================================
// EVENT LISTENERS GLOBALES DE AUTENTICACION
// ================================================

// Manejar envío del formulario de login
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                window.authManager.showLoginError('Por favor ingresa email y contraseña');
                return;
            }

            // Mostrar loading
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px;"></div> Iniciando...';
            submitBtn.disabled = true;

            try {
                await window.authManager.login(email, password);
            } finally {
                // Restaurar botón
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Manejar logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (confirm('¿Estas seguro que deseas cerrar sesion?')) {
                window.authManager.logout();
            }
        });
    }

    // Prevenir acceso directo a páginas sin autenticación
    if (!window.authManager.isLoggedIn() && window.location.pathname !== '/login') {
        // Redirigir a login si no hay sesión válida
        window.authManager.showLoginScreen();
    }
});

// ================================================
// INTERCEPTOR PARA MANEJO DE ERRORES 401
// ================================================

// Interceptar responses de la API para manejar expiración de token
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    // Si hay error 401 y tenemos un auth manager
    if (response.status === 401 && window.authManager && window.authManager.isLoggedIn()) {
        console.warn('Token expirado, cerrando sesion...');
        window.authManager.logout();
    }
    
    return response;
};

// ================================================
// UTILIDADES DE AUTENTICACION
// ================================================

// Funciones helper globales
window.isLoggedIn = () => window.authManager && window.authManager.isLoggedIn();
window.getCurrentUser = () => window.authManager ? window.authManager.currentUser : null;
window.getUserRole = () => window.authManager ? window.authManager.getUserRole() : null;
window.hasPermission = (action, resource) => window.authManager ? window.authManager.hasPermission(action, resource) : false;

// Función para proteger funciones que requieren autenticación
window.requireAuth = (callback) => {
    return function(...args) {
        if (!window.isLoggedIn()) {
            window.authManager.showLoginScreen();
            return;
        }
        return callback.apply(this, args);
    };
};

// Función para proteger funciones que requieren permisos específicos
window.requirePermission = (action, resource, callback) => {
    return function(...args) {
        if (!window.hasPermission(action, resource)) {
            alert('No tienes permisos para realizar esta accion');
            return;
        }
        return callback.apply(this, args);
    };
};

// ================================================
// VALIDACIONES DE SEGURIDAD
// ================================================

// Validar formato de email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validar fortaleza de contraseña
function validatePasswordStrength(password) {
    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    const errors = [];
    
    if (password.length < minLength) {
        errors.push(`Debe tener al menos ${minLength} caracteres`);
    }
    
    if (!hasLowerCase) {
        errors.push('Debe incluir al menos una letra minuscula');
    }
    
    if (!hasNumbers) {
        errors.push('Debe incluir al menos un numero');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        strength: errors.length === 0 ? 'Fuerte' : 
                 password.length >= minLength && (hasUpperCase || hasNumbers) ? 'Media' : 'Débil'
    };
}

// ================================================
// EVENTOS DE SEGURIDAD
// ================================================

// Detectar cuando el usuario sale de la pestaña (para auto-logout opcional)
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden' && window.authManager && window.authManager.isLoggedIn()) {
        // Opcional: auto-logout después de X tiempo de inactividad
        // window.authManager.startInactivityTimer();
    }
});

// Manejar errores de red
window.addEventListener('online', function() {
    console.log('Conexion restaurada');
    // Opcional: mostrar notificación de conexión restaurada
});

window.addEventListener('offline', function() {
    console.log('Sin conexion a internet');
    // Opcional: mostrar notificación de sin conexión
});

// ================================================
// EXPORTAR PARA COMPATIBILIDAD
// ================================================

// Para compatibilidad con código legacy
window.login = (email, password) => window.authManager.login(email, password);
window.logout = () => window.authManager.logout();