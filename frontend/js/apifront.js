// ================================================
// CLIENTE API - SalleInventory
// ================================================

// --- CAMBIO CLAVE ---
// La URL de la API ahora es dinámica. Usará 'localhost' si estás en la misma
// máquina, o la IP del servidor si accedes desde otro dispositivo.
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : `http://${window.location.hostname}:3000/api`;

class ApiClient {
    constructor() {
        this.baseUrl = API_BASE;
        console.log(`API Base URL establecida en: ${this.baseUrl}`); // Para depuración
    }

    // Metodo base para llamadas HTTP
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: { 
                ...defaultOptions.headers, 
                ...options.headers 
            }
        };

        try {
            // La URL completa ahora será, por ejemplo, 'http://192.168.1.10:3000/api/login'
            const response = await fetch(this.baseUrl + endpoint, mergedOptions);
            
            // Manejo de respuestas HTTP
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                if (response.status === 401) {
                    // Token expirado o invalido
                    this.handleUnauthorized();
                    throw new Error('Sesion expirada. Por favor inicia sesion nuevamente.');
                }
                
                throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
            }

            // Intentar parsear JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();

        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // Manejo de token expirado
    handleUnauthorized() {
        localStorage.removeItem('token');
        if (window.authManager) {
            window.authManager.logout();
        }
    }

    // ================================================
    // METODOS DE AUTENTICACION
    // ================================================
    
    async login(email, password) {
        return await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ 
                email: email.toLowerCase().trim(), 
                password 
            })
        });
    }

    async getProfile() {
        return await this.request('/me');
    }

    // ================================================
    // METODOS DE AULAS
    // ================================================
    
    async getAulas(activa = true) {
        return await this.request(`/aulas?activa=${activa}`);
    }

    async createAula(aulaData) {
        return await this.request('/aulas', {
            method: 'POST',
            body: JSON.stringify(aulaData)
        });
    }

    async updateAula(aulaId, aulaData) {
        return await this.request(`/aulas/${aulaId}`, {
            method: 'PUT',
            body: JSON.stringify(aulaData)
        });
    }

    // ================================================
    // METODOS DE CATEGORIAS
    // ================================================
    
    async getCategorias() {
        return await this.request('/categorias');
    }

    async getSubcategorias(categoriaId) {
        return await this.request(`/categorias/${categoriaId}/subcategorias`);
    }

    // ================================================
    // METODOS DE INVENTARIO
    // ================================================
    
    async getInventarioAula(aulaId) {
        return await this.request(`/aulas/${aulaId}/inventario`);
    }

    async saveInventario(aulaId, inventarioData) {
        return await this.request(`/aulas/${aulaId}/inventario`, {
            method: 'POST',
            body: JSON.stringify(inventarioData)
        });
    }

    async updateInventario(aulaId, inventarioId, inventarioData) {
        return await this.request(`/aulas/${aulaId}/inventario/${inventarioId}`, {
            method: 'PUT',
            body: JSON.stringify(inventarioData)
        });
    }

    // ================================================
    // METODOS DE REPORTES
    // ================================================
    
    async getReporteResumen() {
        return await this.request('/reportes/resumen');
    }

    async getReporteCriticos() {
        return await this.request('/reportes/criticos');
    }

    async getReporteAulas() {
        return await this.request('/reportes/aulas');
    }

    async getReportePorCategoria(categoriaId) {
        return await this.request(`/reportes/categorias/${categoriaId}`);
    }

    // ================================================
    // METODOS DE ADMINISTRACION
    // ================================================
    
    async getUsuarios() {
        return await this.request('/admin/usuarios');
    }

    async createUsuario(userData) {
        return await this.request('/admin/usuarios', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async updateUsuario(userId, userData) {
        return await this.request(`/admin/usuarios/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async deleteUsuario(userId) {
        return await this.request(`/admin/usuarios/${userId}`, {
            method: 'DELETE'
        });
    }

    async resetPassword(userId, newPassword) {
        return await this.request(`/admin/usuarios/${userId}/password`, {
            method: 'PUT',
            body: JSON.stringify({ password: newPassword })
        });
    }

    // ================================================
    // METODOS DE CONFIGURACION
    // ================================================
    
    async getConfiguracion() {
        return await this.request('/admin/config');
    }

    async updateConfiguracion(configData) {
        return await this.request('/admin/config', {
            method: 'PUT',
            body: JSON.stringify(configData)
        });
    }

    // ================================================
    // METODOS DE EXPORTACION
    // ================================================
    
    async exportarExcel(tipoReporte = 'completo') {
        try {
            const response = await fetch(this.baseUrl + `/reportes/export/excel?tipo=${tipoReporte}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Error al generar el archivo Excel');
            }

            // Crear descarga del archivo
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `inventario_${new Date().toISOString().slice(0,10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error exportando Excel:', error);
            throw error;
        }
    }

    async exportarPDF(aulaId = null) {
        try {
            const endpoint = aulaId 
                ? `/reportes/export/pdf?aula=${aulaId}`
                : '/reportes/export/pdf';

            const response = await fetch(this.baseUrl + endpoint, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Error al generar el archivo PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `reporte_${aulaId || 'general'}_${new Date().toISOString().slice(0,10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error exportando PDF:', error);
            throw error;
        }
    }

    // ================================================
    // METODOS DE UTILIDAD
    // ================================================
    
    // Verificar conectividad con el servidor
    async healthCheck() {
        try {
            const response = await fetch(this.baseUrl.replace('/api', '/health'));
            return await response.json();
        } catch (error) {
            return { status: 'ERROR', error: error.message };
        }
    }

    // Subir archivos (para futuras funcionalidades como fotos)
    async uploadFile(file, tipo = 'evidencia') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tipo', tipo);

        return await this.request('/upload', {
            method: 'POST',
            body: formData,
            headers: {
                // No establecer Content-Type para FormData
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
    }
}

// Crear instancia global del cliente API
window.apiClient = new ApiClient();

// Funciones helper globales para compatibilidad
window.apiCall = async (endpoint, options = {}) => {
    return await window.apiClient.request(endpoint, options);
};
