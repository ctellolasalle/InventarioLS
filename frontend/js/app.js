// ================================================
// APLICACION PRINCIPAL - SalleInventory
// Instituto La Salle Florida
// ================================================

class InventarioApp {
    /**
     * Constructor de la clase principal de la aplicación.
     * Inicializa el estado de la aplicación.
     */
    constructor() {
        this.categorias = [];
        this.subcategorias = {};
        this.aulasData = [];
        this.currentInventario = null;
        this.currentAulaId = null;
        this.unsavedChanges = false; // Flag para detectar cambios sin guardar
    }

    // ================================================
    // SECCIÓN DE INICIALIZACIÓN
    // ================================================

    /**
     * Inicializa la aplicación después de que el usuario se ha autenticado.
     * Carga los datos iniciales y configura los listeners de eventos.
     */
    async initialize() {
        console.log('🚀 Inicializando SalleInventory App...');
        try {
            if (!window.authManager.isLoggedIn()) {
                console.log('Usuario no autenticado. Deteniendo inicialización.');
                return;
            }

            this.showLoadingOverlay('Cargando datos iniciales...');
            
            await this.loadInitialData();
            this.setupEventListeners();
            this.loadActiveTab(); // Carga el contenido de la pestaña activa por defecto
            
            console.log('✅ Aplicación inicializada correctamente.');
        } catch (error) {
            this.handleGlobalError(error, 'initialize');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    /**
     * Carga los datos esenciales para el funcionamiento de la app (aulas, categorías).
     */
    async loadInitialData() {
        try {
            // Carga paralela de datos para mejorar performance
            const [aulas, categorias] = await Promise.all([
                window.apiClient.getAulas(),
                window.apiClient.getCategorias()
            ]);

            this.aulasData = aulas;
            this.categorias = categorias;

            this.populateAulaSelect();

            // Cargar subcategorías para cada categoría obtenida
            for (const categoria of this.categorias) {
                this.subcategorias[categoria.id] = await window.apiClient.getSubcategorias(categoria.id);
            }

            this.renderInventoryForm();
        } catch (error) {
            console.error('Error cargando datos iniciales:', error);
            this.showAlert('No se pudieron cargar los datos iniciales. ' + error.message, 'danger');
            throw error;
        }
    }

    /**
     * Configura todos los event listeners principales de la aplicación.
     */
    setupEventListeners() {
        // Selector de Aulas
        document.getElementById('aulaSelect')?.addEventListener('change', (e) => {
            const aulaId = e.target.value;
            document.getElementById('loadInventoryBtn').disabled = !aulaId;
            this.currentAulaId = aulaId;
        });

        // Botón para Cargar Inventario existente
        document.getElementById('loadInventoryBtn')?.addEventListener('click', () => this.loadInventoryForAula());

        // Formulario de Inventario
        document.getElementById('inventoryForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveInventory();
        });

        // Navegación por Pestañas (Tabs)
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(tab.dataset.tab);
            });
        });

        // Advertencia antes de salir si hay cambios sin guardar
        window.addEventListener('beforeunload', (e) => {
            if (this.unsavedChanges) {
                e.preventDefault();
                e.returnValue = 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?';
                return e.returnValue;
            }
        });
    }

    // ================================================
    // SECCIÓN DE NAVEGACIÓN (TABS)
    // ================================================

    /**
     * Cambia a la pestaña especificada.
     * @param {string} targetTab - El ID de la pestaña a activar.
     */
    switchTab(targetTab) {
        if (this.unsavedChanges && !confirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres cambiar de pestaña?')) {
            return;
        }
        this.unsavedChanges = false; // Resetea el flag al cambiar

        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

        document.querySelector(`[data-tab="${targetTab}"]`)?.classList.add('active');
        document.getElementById(targetTab)?.classList.add('active');

        this.loadTabContent(targetTab);
    }

    /**
     * Carga el contenido dinámico de una pestaña cuando se activa.
     * @param {string} tabName - El nombre de la pestaña a cargar.
     */
    async loadTabContent(tabName) {
        try {
            switch (tabName) {
                case 'inventario':
                    await this.loadInventarioTab();
                    break;
                case 'reportes':
                    await this.loadReportesTab();
                    break;
                case 'admin':
                    if (window.authManager.isAdmin()) {
                        await this.loadAdminTab();
                    }
                    break;
            }
        } catch (error) {
            this.handleGlobalError(error, `loadTabContent: ${tabName}`);
        }
    }

    /**
     * Carga el contenido de la pestaña que está activa al iniciar la app.
     */
    loadActiveTab() {
        const activeTab = document.querySelector('.nav-tab.active');
        if (activeTab) {
            this.loadTabContent(activeTab.dataset.tab);
        }
    }
    
    // ================================================
    // SECCIÓN: REGISTRO DE INVENTARIO
    // ================================================

    /**
     * Rellena el <select> de aulas con los datos obtenidos de la API.
     */
    populateAulaSelect() {
        const select = document.getElementById('aulaSelect');
        if (!select) return;
        select.innerHTML = '<option value="">-- Selecciona un aula --</option>';
        this.aulasData.forEach(aula => {
            const option = document.createElement('option');
            option.value = aula.id;
            option.textContent = `${aula.codigo} - ${aula.nombre}`;
            select.appendChild(option);
        });
    }

    /**
     * Carga el inventario existente para el aula seleccionada y rellena el formulario.
     */
    async loadInventoryForAula() {
        if (!this.currentAulaId) {
            this.showAlert('Por favor, selecciona un aula primero.', 'warning');
            return;
        }
        const loadBtn = document.getElementById('loadInventoryBtn');
        try {
            this.setButtonLoading(loadBtn, true);
            const data = await window.apiClient.getInventarioAula(this.currentAulaId);

            if (data.inventario && data.detalles) {
                this.currentInventario = data.inventario;
                this.populateInventoryForm(data.detalles);
                document.getElementById('observacionesGenerales').value = data.inventario.observaciones || '';
                this.showAlert('Inventario actual cargado. Puedes modificarlo y guardarlo.', 'success');
            } else {
                this.showAlert('Esta aula no tiene un inventario previo. Puedes registrar uno nuevo.', 'info');
                this.clearInventoryForm();
            }
        } catch (error) {
            this.handleGlobalError(error, 'loadInventoryForAula');
        } finally {
            this.setButtonLoading(loadBtn, false);
        }
    }

    /**
     * Renderiza la estructura del formulario de inventario a partir de las categorías y subcategorías.
     */
    renderInventoryForm() {
        const container = document.getElementById('inventoryContainer');
        if (!container) return;
        container.innerHTML = ''; // Limpia el contenedor

        this.categorias.forEach(categoria => {
            const subs = this.subcategorias[categoria.id] || [];
            if (subs.length > 0) {
                const categoryWrapper = document.createElement('div');
                categoryWrapper.className = 'category-wrapper';
                
                const categoryHeader = document.createElement('h3');
                categoryHeader.innerHTML = `<span class="category-icon">${categoria.icono || '📁'}</span> ${categoria.descripcion}`;
                categoryWrapper.appendChild(categoryHeader);

                subs.forEach(sub => {
                    const itemDiv = this.createInventoryItem(sub, categoria);
                    categoryWrapper.appendChild(itemDiv);
                });
                container.appendChild(categoryWrapper);
            }
        });
    }

    /**
     * Crea el HTML para un único item de inventario en el formulario.
     * @param {object} subcategoria - El objeto de la subcategoría.
     * @param {object} categoria - El objeto de la categoría padre.
     * @returns {HTMLElement} El elemento div del item de inventario.
     */
    createInventoryItem(subcategoria, categoria) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'inventory-item';
        itemDiv.dataset.subcategoriaId = subcategoria.id;
        const icon = this.getEquipoIcon(subcategoria.nombre);

        itemDiv.innerHTML = `
            <div class="item-header">
                <div class="item-title"><span class="item-icon">${icon}</span>${subcategoria.descripcion}</div>
                <span class="category-badge">${categoria.nombre.replace('_', ' ')}</span>
            </div>
            <div class="quantity-controls">
                ${['total', 'bueno', 'regular', 'malo', 'roto'].map(estado => `
                    <div class="quantity-row">
                        <label for="qty-${subcategoria.id}-${estado}" class="quantity-label ${estado}">${estado}</label>
                        <input type="number" id="qty-${subcategoria.id}-${estado}" class="quantity-input ${estado}" min="0" value="0" oninput="app.handleQuantityChange(this)">
                    </div>
                `).join('')}
            </div>
            <div class="quantity-error-message hidden">La suma de los estados no coincide con el total.</div>
            ${this.renderExtraFields(subcategoria)}
            <div class="form-group">
                <textarea class="form-control observaciones" rows="2" placeholder="Observaciones específicas..." oninput="app.markUnsavedChanges(true)"></textarea>
            </div>
        `;
        return itemDiv;
    }
    
    /**
     * Renderiza los campos extra (JSON) para un item de inventario.
     * @param {object} subcategoria - El objeto de la subcategoría.
     * @returns {string} El HTML de los campos extra.
     */
    renderExtraFields(subcategoria) {
        if (!subcategoria.campos_extra) return '';
        try {
            const campos = JSON.parse(subcategoria.campos_extra);
            let html = '<div class="extra-fields"><h4>Especificaciones</h4>';
            for (const [key, type] of Object.entries(campos)) {
                html += `<div class="extra-field"><label>${this.formatFieldName(key)}:</label>`;
                if (type.startsWith('select:')) {
                    const options = type.replace('select:', '').split(',');
                    html += `<select class="extra-field-input form-control" data-field="${key}" onchange="app.markUnsavedChanges(true)"><option value="">-- Seleccionar --</option>${options.map(o => `<option value="${o.trim()}">${o.trim()}</option>`).join('')}</select>`;
                } else {
                    html += `<input type="${type}" class="extra-field-input form-control" data-field="${key}" oninput="app.markUnsavedChanges(true)">`;
                }
                html += `</div>`;
            }
            html += '</div>';
            return html;
        } catch (e) {
            console.warn('Error parseando campos_extra:', e);
            return '';
        }
    }

    /**
     * Rellena el formulario con datos de un inventario existente.
     * @param {Array} detalles - Array con los detalles del inventario.
     */
    populateInventoryForm(detalles) {
        this.clearInventoryForm();
        detalles.forEach(detalle => {
            const itemDiv = document.querySelector(`[data-subcategoria-id="${detalle.id_subcategoria}"]`);
            if (!itemDiv) return;

            // Llenar cantidades
            itemDiv.querySelector('.total').value = detalle.cantidad_total || 0;
            itemDiv.querySelector('.bueno').value = detalle.cantidad_bueno || 0;
            itemDiv.querySelector('.regular').value = detalle.cantidad_regular || 0;
            itemDiv.querySelector('.malo').value = detalle.cantidad_malo || 0;
            itemDiv.querySelector('.roto').value = detalle.cantidad_roto || 0;
            
            // Llenar observaciones y campos extra
            itemDiv.querySelector('.observaciones').value = detalle.observaciones || '';
            if (detalle.especificaciones) {
                const specs = JSON.parse(detalle.especificaciones);
                for (const [key, value] of Object.entries(specs)) {
                    const field = itemDiv.querySelector(`[data-field="${key}"]`);
                    if (field) field.value = value;
                }
            }
        });
        this.unsavedChanges = false;
    }

    /**
     * Limpia completamente el formulario de registro de inventario.
     */
    clearInventoryForm() {
        document.getElementById('inventoryForm')?.reset();
        document.querySelectorAll('.quantity-input').forEach(input => input.value = '0');
        document.querySelectorAll('.quantity-error-message').forEach(el => el.classList.add('hidden'));
        this.unsavedChanges = false;
    }

    /**
     * Maneja el cambio en cualquier input de cantidad, valida la suma.
     * @param {HTMLInputElement} input - El input que cambió.
     */
    handleQuantityChange(input) {
        this.markUnsavedChanges(true);
        const itemDiv = input.closest('.inventory-item');
        this.validateQuantities(itemDiv);
    }
    
    /**
     * Valida que la suma de los estados (bueno, regular, etc.) sea igual al total.
     * @param {HTMLElement} itemDiv - El contenedor del item de inventario.
     */
    validateQuantities(itemDiv) {
        const total = parseInt(itemDiv.querySelector('.total').value) || 0;
        const suma = ['bueno', 'regular', 'malo', 'roto']
            .reduce((acc, estado) => acc + (parseInt(itemDiv.querySelector(`.${estado}`).value) || 0), 0);
        
        const errorMsg = itemDiv.querySelector('.quantity-error-message');
        if (total !== suma) {
            errorMsg.classList.remove('hidden');
            return false;
        } else {
            errorMsg.classList.add('hidden');
            return true;
        }
    }

    /**
     * Recolecta todos los datos del formulario y los prepara para ser enviados a la API.
     * @returns {object|null} Objeto con los datos del inventario o null si hay errores.
     */
    collectInventoryData() {
        let isValid = true;
        const detalles = [];
        
        document.querySelectorAll('.inventory-item').forEach(itemDiv => {
            const total = parseInt(itemDiv.querySelector('.total').value) || 0;
            if (total > 0) {
                if (!this.validateQuantities(itemDiv)) isValid = false;
                
                const especificaciones = {};
                itemDiv.querySelectorAll('.extra-field-input').forEach(field => {
                    if (field.value) especificaciones[field.dataset.field] = field.value;
                });

                detalles.push({
                    id_subcategoria: parseInt(itemDiv.dataset.subcategoriaId),
                    cantidad_total: total,
                    cantidad_bueno: parseInt(itemDiv.querySelector('.bueno').value) || 0,
                    cantidad_regular: parseInt(itemDiv.querySelector('.regular').value) || 0,
                    cantidad_malo: parseInt(itemDiv.querySelector('.malo').value) || 0,
                    cantidad_roto: parseInt(itemDiv.querySelector('.roto').value) || 0,
                    observaciones: itemDiv.querySelector('.observaciones').value.trim() || null,
                    especificaciones: Object.keys(especificaciones).length > 0 ? JSON.stringify(especificaciones) : null
                });
            }
        });

        if (!isValid) {
            this.showAlert('Corrige los errores en las cantidades antes de guardar.', 'danger');
            return null;
        }

        if (detalles.length === 0) {
            this.showAlert('Debes registrar al menos un item con cantidad mayor a 0.', 'warning');
            return null;
        }

        return {
            observaciones: document.getElementById('observacionesGenerales').value.trim() || null,
            detalles
        };
    }
    
    /**
     * Guarda el inventario actual en la base de datos.
     */
    async saveInventory() {
        if (!this.currentAulaId) {
            this.showAlert('Debes seleccionar un aula.', 'danger');
            return;
        }

        const inventarioData = this.collectInventoryData();
        if (!inventarioData) return; // La validación falló

        const saveBtn = document.querySelector('#inventoryForm button[type="submit"]');
        try {
            this.setButtonLoading(saveBtn, true);
            await window.apiClient.saveInventario(this.currentAulaId, inventarioData);
            this.showAlert('Inventario guardado con éxito.', 'success');
            this.unsavedChanges = false;
            document.getElementById('aulaSelect').value = '';
            this.clearInventoryForm();
        } catch (error) {
            this.handleGlobalError(error, 'saveInventory');
        } finally {
            this.setButtonLoading(saveBtn, false);
        }
    }

    // ================================================
    // SECCIÓN: CONSULTA DE INVENTARIO
    // ================================================

    async loadInventarioTab() {
        const statsContainer = document.getElementById('statsContainer');
        const aulasContainer = document.getElementById('aulasInventario');
        this.showLoading(statsContainer);
        this.showLoading(aulasContainer);

        try {
            const [stats, aulasReporte] = await Promise.all([
                window.apiClient.getReporteResumen(),
                window.apiClient.getReporteAulas()
            ]);
            this.renderStats(statsContainer, stats);
            this.renderAulasInventario(aulasContainer, aulasReporte);
        } catch (error) {
            this.handleGlobalError(error, 'loadInventarioTab');
            statsContainer.innerHTML = '<div class="alert alert-danger">Error al cargar estadísticas.</div>';
            aulasContainer.innerHTML = '<div class="alert alert-danger">Error al cargar aulas.</div>';
        }
    }

    renderStats(container, stats) {
        const operativo = stats.porcentaje_operativo || 0;
        container.innerHTML = `
            <div class="stat-card"><div class="stat-number">${stats.total_aulas || 0}</div><div class="stat-label">Aulas Totales</div></div>
            <div class="stat-card"><div class="stat-number">${stats.aulas_con_inventario || 0}</div><div class="stat-label">Con Inventario</div></div>
            <div class="stat-card"><div class="stat-number">${stats.total_items || 0}</div><div class="stat-label">Items Totales</div></div>
            <div class="stat-card"><div class="stat-number" style="color: ${this.getStatusColor(operativo)}">${operativo}%</div><div class="stat-label">Operativo</div></div>
        `;
    }

    renderAulasInventario(container, aulas) {
        if (!aulas || aulas.length === 0) {
            container.innerHTML = `<div class="aula-card"><p>No hay inventarios registrados.</p></div>`;
            return;
        }
        container.innerHTML = aulas.map(aula => this.renderAulaCard(aula)).join('');
    }

    renderAulaCard(aula) {
        const operativo = aula.porcentaje_operativo || 0;
        return `
            <div class="aula-card">
                <div class="aula-header">
                    <div>
                        <div class="aula-code">${aula.codigo}</div>
                        <div class="text-muted">${aula.nombre_aula}</div>
                    </div>
                    <div class="status-badge status-${this.getStatusClass(operativo)}">${this.getStatusText(operativo)} (${operativo}%)</div>
                </div>
                <div class="stats-grid" style="gap: 10px; font-size: 0.9rem; margin-top: 15px;">
                    <div><strong>Buenos:</strong> <span class="text-success">${aula.items_buenos || 0}</span></div>
                    <div><strong>Regulares:</strong> <span class="text-warning">${aula.items_regulares || 0}</span></div>
                    <div><strong>Malos:</strong> <span class="text-danger">${aula.items_malos || 0}</span></div>
                    <div><strong>Rotos:</strong> <span class="text-danger">${aula.items_rotos || 0}</span></div>
                </div>
                <div class="text-muted" style="font-size: 0.8rem; margin-top: 15px;">Último registro: ${aula.ultimo_inventario ? this.formatDate(aula.ultimo_inventario) : 'N/A'}</div>
                <div style="margin-top: 15px; text-align: right;">
                    <button class="btn btn-outline btn-sm" onclick="app.viewAulaDetails(${aula.id_aula})">Ver Detalles</button>
                </div>
            </div>
        `;
    }

    // ================================================
    // SECCIÓN: REPORTES
    // ================================================

    async loadReportesTab() {
        const statsContainer = document.getElementById('reporteStats');
        this.showLoading(statsContainer);
        try {
            const stats = await window.apiClient.getReporteResumen();
            this.renderReporteStats(statsContainer, stats);
        } catch (error) {
            this.handleGlobalError(error, 'loadReportesTab');
            statsContainer.innerHTML = '<div class="alert alert-danger">Error al cargar estadísticas de reportes.</div>';
        }
    }
    
    async generarReporte(tipo) {
        const container = document.getElementById('reporteContainer');
        this.showLoading(container);
        try {
            let data, title;
            switch (tipo) {
                case 'resumen':
                    data = await window.apiClient.getReporteResumen();
                    title = 'Resumen General del Inventario';
                    this.renderReporteResumen(container, data, title);
                    break;
                case 'criticos':
                    data = await window.apiClient.getReporteCriticos();
                    title = 'Reporte de Items Críticos';
                    this.renderReporteCriticos(container, data, title);
                    break;
                case 'aulas':
                    data = await window.apiClient.getReporteAulas();
                    title = 'Reporte Detallado por Aulas';
                    this.renderReporteAulas(container, data, title);
                    break;
            }
        } catch (error) {
             this.handleGlobalError(error, `generarReporte: ${tipo}`);
        }
    }

    // (Los métodos renderReporte... se encuentran en la sección de Utilidades de UI)

    // ================================================
    // SECCIÓN: ADMINISTRACIÓN
    // ================================================

    async loadAdminTab() {
        const container = document.getElementById('adminContainer');
        if (!window.authManager.isAdmin()) {
            container.innerHTML = `<div class="alert alert-danger">Acceso denegado.</div>`;
            return;
        }
        this.showLoading(container);
        try {
            const usuarios = await window.apiClient.getUsuarios();
            this.renderUsuariosAdmin(container, usuarios);
        } catch (error) {
            this.handleGlobalError(error, 'loadAdminTab');
        }
    }

    renderUsuariosAdmin(container, usuarios) {
        container.innerHTML = `
            <div class="aula-card">
                <h3>Gestión de Usuarios <button class="btn btn-primary btn-sm" onclick="app.showCreateUserModal()">+ Nuevo</button></h3>
                <div style="overflow-x: auto;">
                    <table>
                        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Último Acceso</th><th>Acciones</th></tr></thead>
                        <tbody>${usuarios.map(user => `
                            <tr>
                                <td>${user.nombre}</td>
                                <td>${user.email}</td>
                                <td>${this.formatRole(user.rol)}</td>
                                <td><span class="status-badge ${user.activo ? 'status-excelente' : 'status-critico'}">${user.activo ? 'Activo' : 'Inactivo'}</span></td>
                                <td>${user.ultimo_acceso ? this.formatDate(user.ultimo_acceso) : 'Nunca'}</td>
                                <td><button class="btn btn-outline btn-sm" onclick="app.editUsuario(${user.id})">Editar</button></td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }

    // ... (El resto de métodos de admin como showCreateUserModal, createUsuario, etc. se encuentran en la sección de Modales)

    // ================================================
    // SECCIÓN DE MODALES Y ACCIONES
    // ================================================

    async viewAulaDetails(aulaId) {
        this.showLoadingOverlay('Cargando detalles...');
        try {
            const data = await window.apiClient.getInventarioAula(aulaId);
            const aula = this.aulasData.find(a => a.id == aulaId);
            if (!data.inventario) {
                this.showModal('Sin Inventario', `<p>El aula <strong>${aula.codigo}</strong> no tiene inventario registrado.</p>`);
                return;
            }
            const detallesHtml = data.detalles.map(d => `
                <div class="detalle-item">
                    <strong>${this.getEquipoIcon(d.subcategoria_nombre)} ${d.subcategoria_nombre}:</strong> ${d.cantidad_total}
                    <div class="detalle-estados">
                        <span>B: ${d.cantidad_bueno}</span> | <span>R: ${d.cantidad_regular}</span> | <span>M: ${d.cantidad_malo}</span> | <span>X: ${d.cantidad_roto}</span>
                    </div>
                </div>`).join('');
            this.showModal(`Detalle: ${aula.codigo}`, `<h4>${aula.nombre}</h4><p class="text-muted">Registrado: ${this.formatDate(data.inventario.fecha_registro)}</p><div class="detalles-container">${detallesHtml}</div>`);
        } catch (error) {
            this.handleGlobalError(error, 'viewAulaDetails');
        } finally {
            this.hideLoadingOverlay();
        }
    }
    
    showCreateUserModal() {
        const modalBody = `
            <form id="createUserForm">
                <div class="form-group"><label>Nombre</label><input type="text" name="nombre" class="form-control" required></div>
                <div class="form-group"><label>Email</label><input type="email" name="email" class="form-control" required></div>
                <div class="form-group"><label>Contraseña</label><input type="password" name="password" class="form-control" required minlength="6"></div>
                <div class="form-group"><label>Rol</label><select name="rol" class="form-control" required>
                    <option value="docente">Docente</option><option value="mantenimiento">Mantenimiento</option><option value="soporte_ti">Soporte TI</option><option value="supervisor">Supervisor</option><option value="administrador">Administrador</option>
                </select></div>
                <div class="form-actions"><button type="submit" class="btn btn-primary">Crear Usuario</button></div>
            </form>`;
        this.showModal('Crear Nuevo Usuario', modalBody);
        document.getElementById('createUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const userData = Object.fromEntries(formData.entries());
            const saveBtn = e.target.querySelector('button[type="submit"]');
            try {
                this.setButtonLoading(saveBtn, true);
                await window.apiClient.createUsuario(userData);
                this.showAlert('Usuario creado con éxito.');
                this.closeModal();
                this.loadAdminTab();
            } catch (error) {
                this.handleGlobalError(error, 'createUsuario');
            } finally {
                this.setButtonLoading(saveBtn, false);
            }
        });
    }

    showCreateAulaModal() {
        const modalBody = `
            <form id="createAulaForm">
                <div class="form-group"><label>Código</label><input type="text" name="codigo" class="form-control" required></div>
                <div class="form-group"><label>Nombre</label><input type="text" name="nombre" class="form-control" required></div>
                <div class="form-group"><label>Edificio</label><input type="text" name="edificio" class="form-control"></div>
                <div class="form-group"><label>Piso</label><input type="number" name="piso" class="form-control"></div>
                <div class="form-group"><label>Capacidad</label><input type="number" name="capacidad" class="form-control"></div>
                <div class="form-group"><label>Tipo</label><select name="tipo" class="form-control"><option value="aula">Aula</option><option value="laboratorio">Laboratorio</option><option value="auditorio">Auditorio</option></select></div>
                <div class="form-actions"><button type="submit" class="btn btn-primary">Crear Aula</button></div>
            </form>`;
        this.showModal('Crear Nueva Aula', modalBody);
        document.getElementById('createAulaForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const aulaData = Object.fromEntries(formData.entries());
            const saveBtn = e.target.querySelector('button[type="submit"]');
            try {
                this.setButtonLoading(saveBtn, true);
                await window.apiClient.createAula(aulaData);
                this.showAlert('Aula creada con éxito.');
                this.closeModal();
                this.aulasData = await window.apiClient.getAulas(); // Recargar aulas
                this.populateAulaSelect();
            } catch (error) {
                this.handleGlobalError(error, 'createAula');
            } finally {
                this.setButtonLoading(saveBtn, false);
            }
        });
    }

    editUsuario(userId) {
        this.showModal('Editar Usuario', `<p>La funcionalidad para editar usuarios (ID: ${userId}) estará disponible en futuras versiones.</p>`);
    }

    // ================================================
    // SECCIÓN DE UTILIDADES Y HELPERS
    // ================================================

    getEquipoIcon(nombre) {
        const icons = {'television':'📺','computadora':'💻','proyector':'📽️','parlantes':'🔊','sillas':'🪑','pupitres':'📚','escritorio':'🖥️','pizarron':'칠판','armarios':'🗄️','calefaccion':'🌡️','refrigeracion':'❄️','plafones':'💡','tubos':'💡','bombillas':'💡','ventanas':'🪟','pintura':'🎨','pisos':'🧱','puertas':'🚪'};
        return icons[nombre] || '🔧';
    }

    formatFieldName(fieldName) {
        return fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatRole(rol) {
        return (rol || '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
        } catch { return dateString; }
    }

    getStatusClass = (p) => p >= 80 ? 'excelente' : p >= 60 ? 'bueno' : p >= 40 ? 'regular' : 'critico';
    getStatusText = (p) => p >= 80 ? 'Excelente' : p >= 60 ? 'Bueno' : p >= 40 ? 'Regular' : 'Crítico';
    getStatusColor = (p) => p >= 80 ? '#28a745' : p >= 60 ? '#17a2b8' : p >= 40 ? '#ffc107' : '#dc3545';

    markUnsavedChanges(status) {
        this.unsavedChanges = status;
    }

    // ================================================
    // HELPERS DE UI (MODALES, ALERTAS, LOADERS)
    // ================================================

    showLoading(container) {
        if (container) container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    }

    showLoadingOverlay(message = 'Cargando...') {
        const overlay = document.getElementById('loadingOverlay');
        overlay.querySelector('p').textContent = message;
        overlay.classList.remove('hidden');
    }

    hideLoadingOverlay() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    showAlert(message, type = 'success', duration = 4000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }
    
    setButtonLoading(button, isLoading) {
        if (!button) return;
        if (isLoading) {
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<div class="spinner" style="width:1em;height:1em;border-width:2px;"></div>`;
            button.disabled = true;
        } else {
            button.innerHTML = button.dataset.originalText;
            button.disabled = false;
        }
    }

    showModal(title, body) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = body;
        document.getElementById('modal').classList.add('active');
    }

    closeModal() {
        document.getElementById('modal').classList.remove('active');
    }

    handleGlobalError(error, context = 'general') {
        console.error(`Error en [${context}]:`, error);
        this.showAlert(error.message || 'Ocurrió un error inesperado.', 'danger');
        // Si el error es de autenticación, desloguear
        if (error.message.toLowerCase().includes('sesion expirada') || error.message.includes('401')) {
            setTimeout(() => window.authManager.logout(), 2000);
        }
    }
}

// ================================================
// INICIALIZACIÓN GLOBAL
// ================================================
let app;

document.addEventListener('DOMContentLoaded', async () => {
    // Esperar que el AuthManager esté listo
    await new Promise(resolve => {
        const interval = setInterval(() => {
            if (window.authManager) {
                clearInterval(interval);
                resolve();
            }
        }, 50);
    });

    app = new InventarioApp();
    window.app = app; // Hacer la instancia accesible globalmente

    if (window.authManager.isLoggedIn()) {
        await app.initialize();
    }
});

// Funciones globales para ser llamadas desde el HTML (onclick)
function generarReporte(tipo) { window.app?.generarReporte(tipo); }
function exportarExcel() { window.app?.exportarExcel(); }