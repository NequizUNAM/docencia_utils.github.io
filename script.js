/**
 * INVENTARIO SYSTEM - CLIENT SCRIPT
 * Version: 2.0 (Optimized & Modular)
 */

// ================= 1. CONFIGURATION & STATE =================
const CONFIG = {
    // Centralized API URL - Easier to update
    API_URL: 'https://script.google.com/macros/s/AKfycbzqS5nd7z8GEL1eIIJAz78AyVZLMuVvMt-NdTxR2OuoGWYFuUXZKcvfUWMlGkxuO0k1/exec',
    DEBOUNCE_DELAY: 500, // milisegundos de espera para búsqueda
    COLORS: {
        primary: 'var(--primary-color)', // Usar variables CSS
        secondary: 'var(--secondary-color)',
        danger: 'var(--danger-color)',
        warning: '#ffc107',
        info: '#17a2b8'
    }
};

const STATE = {
    productCache: new Map(), // Cache para búsquedas recientes
    charts: {
        financial: null,
        trends: null
    }
};

// ================= 2. UTILS & HELPERS =================

/**
 * Debounce: Retrasa la ejecución de una función (ideal para búsqueda)
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// ================= 3. API SERVICE LAYER =================
const API = {
    async request(params, method = 'GET', body = null) {
        const url = new URL(CONFIG.API_URL);

        // Agregar parámetros GET
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });

        const options = {
            method: method,
            headers: {
                // Apps Script requiere este content-type para POSTs simples
                'Content-Type': 'text/plain;charset=utf-8'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return { status: 'error', message: 'Error de conexión con el servidor. Intente nuevamente.' };
        }
    },

    get(action, extraParams = {}) {
        return this.request({ action, ...extraParams });
    },

    post(payload) {
        const cacheBuster = { t: new Date().getTime() };
        return this.request(cacheBuster, 'POST', payload);
    }
};

// ================= 4. UI MANAGER =================
const UI = {
    /**
     * Muestra mensajes de estado con iconos y auto-ocultado para éxito
     */
    showStatus(elementId, type, message) {
        const el = document.getElementById(elementId);
        if (!el) return;

        el.style.display = 'block';
        el.className = `status-message ${type}`;

        const iconMap = {
            success: 'check',
            error: 'times',
            warning: 'exclamation-triangle',
            info: 'info'
        };
        const icon = iconMap[type] || 'info';

        // Usamos textContent para el mensaje para evitar XSS, pero el icono es HTML seguro
        el.innerHTML = `<i class="fas fa-${icon}-circle"></i> <span></span>`;
        el.querySelector('span').textContent = message;

        // Auto-ocultar mensajes de éxito
        if (type === 'success') {
            setTimeout(() => {
                el.style.display = 'none';
            }, 5000);
        }
    },

    /**
     * Activa o desactiva botones de carga
     */
    setLoading(btnId, isLoading, originalText = '') {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        if (isLoading) {
            btn.dataset.originalText = btn.innerHTML; // Guardar texto original
            btn.disabled = true;
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Procesando...`;
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalText || originalText;
        }
    },

    toggleElement(elementId, show) {
        const el = document.getElementById(elementId);
        if (el) {
            if (show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    },

    /**
     * Renderiza una tabla de forma segura
     */
    renderTable(tbodyId, data, columns, emptyMsg = 'No hay datos') {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columns.length}">${emptyMsg}</td></tr>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        data.forEach(row => {
            const tr = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                if (col.html) {
                    td.innerHTML = col.html(row); // Usar solo si confiamos en el contenido HTML generado
                } else {
                    td.textContent = col.text ? col.text(row) : (row[col.key] || '');
                }
                tr.appendChild(td);
            });
            fragment.appendChild(tr);
        });
        tbody.appendChild(fragment);
    }
};

// ================= 5. MAIN APP CONTROLLER =================
const App = {
    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupNavigation();
            this.setupListeners();
            this.loadInitialData(); // Cargar categorías al inicio
        });
    },

    setupNavigation() {
        const navLinks = document.querySelectorAll('.sidebar-nav a');
        const sections = document.querySelectorAll('.main-content .content-section');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-section');

                // UI Updates
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                sections.forEach(s => s.classList.remove('active'));
                const targetSection = document.getElementById(targetId);
                if (targetSection) targetSection.classList.add('active');

                // Logica especifica por sección
                if (targetId === 'dashboard') this.loadDashboard();
                if (targetId === 'inventario') this.loadInventario();
            });
        });
    },

    setupListeners() {
        // Configuración DB
        document.getElementById('iniciarDBBtn')?.addEventListener('click', () => this.handleConfigAction('iniciar'));
        document.getElementById('resetDBBtn')?.addEventListener('click', () => {
            if (window.confirm("¡ADVERTENCIA CRÍTICA!\n\n¿Estás seguro de que quieres BORRAR TODA la base de datos?\nEsta acción no se puede deshacer.")) {
                this.handleConfigAction('resetear');
            }
        });

        // Formularios (POST)
        this.bindForm('categoriaForm', 'agregarCategoria', 'statusCategoria', () => this.loadInitialData());
        this.bindForm('productoForm', 'agregarProducto', 'statusProducto');

        // Transacciones
        document.getElementById('compraForm')?.addEventListener('submit', (e) => this.handleTransaction(e, 'compra'));
        document.getElementById('ventaForm')?.addEventListener('submit', (e) => this.handleTransaction(e, 'venta'));

        // Búsqueda (con Debounce)
        const debouncedSearch = debounce((q, type) => this.searchProduct(q, type), CONFIG.DEBOUNCE_DELAY);

        ['co', 'v'].forEach(prefix => {
            const input = document.getElementById(`${prefix}_query`);
            if (input) {
                input.addEventListener('input', (e) => debouncedSearch(e.target.value, prefix));
            }
        });

        // Dashboard & Resúmenes
        document.getElementById('cargarInventarioBtn')?.addEventListener('click', () => this.loadInventario());
        document.getElementById('cargarDatosGraficosBtn')?.addEventListener('click', () => this.loadDashboard());
        document.getElementById('calcularResumenBtn')?.addEventListener('click', () => this.calculateFinancialSummary());

        document.getElementById('resumenVentasBtn')?.addEventListener('click', () => this.loadSummary('VENTAS'));
        document.getElementById('resumenComprasBtn')?.addEventListener('click', () => this.loadSummary('COMPRAS'));
    },

    bindForm(formId, action, statusId, onSuccess) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]'); // Buscar el botón submit dentro del form
            const btnId = submitBtn ? submitBtn.id : null;

            if (btnId) UI.setLoading(btnId, true);
            else if (submitBtn) submitBtn.disabled = true;

            UI.showStatus(statusId, 'info', 'Procesando...');

            // Recolectar datos automáticamente basados en IDs (p_nombre -> nombre)
            const data = {};
            Array.from(form.elements).forEach(el => {
                const prefixMatch = el.id ? el.id.match(/^([a-z]+)_(.+)$/) : null;
                if (prefixMatch) {
                    data[prefixMatch[2]] = el.value;
                }
            });

            data.action = action; // Agregar acción para API

            const result = await API.post(data);

            if (btnId) UI.setLoading(btnId, false);
            else if (submitBtn) submitBtn.disabled = false;

            if (result.status === 'success') {
                UI.showStatus(statusId, 'success', result.message);
                form.reset();
                if (onSuccess) onSuccess();
            } else {
                UI.showStatus(statusId, 'error', result.message);
            }
        });
    },

    // --- Data Loading Functions ---

    async loadInitialData() {
        // Cargar categorías
        const result = await API.get('getCategorias');
        const select = document.getElementById('p_categoria');
        const list = document.getElementById('listaCategorias');

        if (!select || !list) return;

        select.innerHTML = '<option value="" disabled selected>Seleccione una categoría</option>';

        if (result.status === 'success' && Array.isArray(result.data)) {
            let listHtml = '';
            result.data.forEach(cat => {
                // Llenar Select
                const opt = document.createElement('option');
                opt.value = cat.nombre;
                opt.textContent = cat.nombre;
                select.appendChild(opt);

                // Llenar Lista
                listHtml += `<li>ID: ${cat.id || '?'} | <b>${UI.escapeHtml(cat.nombre)}</b></li>`;
            });
            list.innerHTML = listHtml || '<li>No hay categorías.</li>';
        } else {
            list.innerHTML = '<li>No se pudieron cargar las categorías.</li>';
        }
    },

    async loadInventario() {
        UI.showStatus('statusInventario', 'info', 'Cargando inventario...');

        const result = await API.get('getInventario');

        if (result.status === 'success') {
            UI.showStatus('statusInventario', 'success', `Cargados ${result.data.length} productos.`);

            UI.renderTable('inventarioTableBody', result.data, [
                { key: 'id' },
                { key: 'nombre' },
                { key: 'código' },
                { key: 'categoría' },
                {
                    key: 'stock',
                    html: (row) => {
                        const style = row.stock < 5 ? `color:${CONFIG.COLORS.danger}; font-weight:bold;` : '';
                        return `<span style="${style}">${row.stock}</span>`;
                    }
                },
                {
                    key: 'precio_venta',
                    text: (row) => `$${parseFloat(row.precio_venta).toFixed(2)}`
                }
            ]);
        } else {
            UI.showStatus('statusInventario', 'error', result.message);
            UI.renderTable('inventarioTableBody', [], [], 'Error al cargar inventario.');
        }
    },

    async searchProduct(query, prefix) {
        const detailDiv = document.getElementById(`${prefix}_product_details`);
        const idInput = document.getElementById(`${prefix}_producto_id`);
        const submitBtn = document.getElementById(`${prefix}_submit_btn`);

        // Reset UI
        UI.toggleElement(`${prefix}_product_details`, false);
        detailDiv.innerHTML = '';
        idInput.value = '';
        submitBtn.disabled = true;

        if (!query || query.length < 2) return;

        const result = await API.get('buscarProducto', { query: encodeURIComponent(query) });

        if (result.status === 'success' && result.data && result.data.length > 0) {
            const product = result.data[0];
            STATE.productCache.set(product.id, product);

            // Mostrar detalles
            UI.toggleElement(`${prefix}_product_details`, true);
            this.renderProductDetails(product, detailDiv, prefix);

            idInput.value = product.id;
            submitBtn.disabled = false;
        } else {
            UI.toggleElement(`${prefix}_product_details`, true);
            detailDiv.innerHTML = `<p style="color:var(--danger-color)">No se encontraron productos.</p>`;
        }
    },

    renderProductDetails(product, container, prefix) {
        const isCompra = prefix === 'co';
        const price = isCompra ? product.precio_compra : product.precio_venta;
        const priceLabel = isCompra ? 'Precio Compra Actual' : 'Precio Venta Actual';
        const stockStyle = product.stock < 5 ? `color:${CONFIG.COLORS.danger}` : `color:${CONFIG.COLORS.secondary}`;

        container.innerHTML = `
            <div class="product-info-card" style="padding:10px; background:#f8f9fa; border-radius:5px; margin-bottom:10px;">
                <p><b>Producto:</b> ${UI.escapeHtml(product.nombre)} <small>(${product.código})</small></p>
                <p><b>Categoría:</b> ${UI.escapeHtml(product.categoría)}</p>
                <p><b>Stock:</b> <span style="font-weight:bold; ${stockStyle}">${product.stock}</span></p>
                <p><b>${priceLabel}:</b> $${parseFloat(price).toFixed(2)}</p>
            </div>
        `;

        // Auto-llenar precio sugerido
        const priceInput = document.getElementById(`${prefix}_precio_${isCompra ? 'compra' : 'venta'}`);
        if (priceInput) priceInput.value = parseFloat(price).toFixed(2);

        // Advertencia de stock para ventas
        if (!isCompra && product.stock < 5) {
            container.innerHTML += `<p class="status-message warning" style="display:block">⚠️ Stock bajo (${product.stock} unidades)</p>`;
        }
    },

    async handleTransaction(e, type) {
        e.preventDefault();
        const prefix = type === 'compra' ? 'co' : 'v';
        const statusId = type === 'compra' ? 'statusCompra' : 'statusVenta';
        const btnId = `${prefix}_submit_btn`;

        const form = e.target;
        const productoId = document.getElementById(`${prefix}_producto_id`).value;

        if (!productoId) {
            UI.showStatus(statusId, 'error', 'Error: Debes buscar y seleccionar un producto primero.');
            return;
        }

        UI.setLoading(btnId, true);
        UI.showStatus(statusId, 'info', `Registrando ${type}...`);

        const payload = {
            action: 'registrarTransaccion',
            type: type,
            producto_id: productoId,
            cantidad: document.getElementById(`${prefix}_cantidad`).value,
            precio: document.getElementById(`${prefix}_precio_${type === 'compra' ? 'compra' : 'venta'}`).value,
            extra_data: document.getElementById(`${prefix}_${type === 'compra' ? 'proveedor' : 'cliente'}`).value
        };

        const result = await API.post(payload);

        UI.setLoading(btnId, false);

        if (result.status === 'success') {
            UI.showStatus(statusId, 'success', result.message);
            form.reset();
            // Limpiar UI de detalles
            UI.toggleElement(`${prefix}_product_details`, false);
            STATE.productCache.delete(productoId); // Invalidar cache
        } else {
            UI.showStatus(statusId, 'error', result.message);
        }
    },

    // --- Dashboard logic ---

    async loadDashboard() {
        await this.calculateFinancialSummary();
        await this.loadCharts();
    },

    async calculateFinancialSummary() {
        UI.showStatus('statusDashboard', 'info', 'Calculando...');

        try {
            const [ventas, compras] = await Promise.all([
                API.get('getData', { sheetName: 'VENTAS' }),
                API.get('getData', { sheetName: 'COMPRAS' })
            ]);

            const sumVentas = this.sumDataAmounts(ventas.data, 'precio_venta');
            const sumCompras = this.sumDataAmounts(compras.data, 'precio_compra');
            const ganancia = sumVentas - sumCompras;

            // DOM Updates
            document.getElementById('totalVentas').textContent = formatCurrency(sumVentas);
            document.getElementById('totalCompras').textContent = formatCurrency(sumCompras);
            document.getElementById('totalGastos').textContent = formatCurrency(sumCompras);

            const gananciaEl = document.getElementById('totalGanancias');
            gananciaEl.textContent = formatCurrency(ganancia);
            gananciaEl.style.color = ganancia >= 0 ? CONFIG.COLORS.secondary : CONFIG.COLORS.danger;

            UI.showStatus('statusDashboard', 'success', 'Resumen actualizado.');
        } catch (e) {
            UI.showStatus('statusDashboard', 'error', 'Error calculando resumen.');
        }
    },

    sumDataAmounts(data, priceKey) {
        if (!data || !Array.isArray(data)) return 0;
        return data.reduce((sum, item) => sum + (parseFloat(item.cantidad || 0) * parseFloat(item[priceKey] || 0)), 0);
    },

    async loadCharts() {
        // Lógica simplificada de gráficos
        const result = await API.get('getResumenDiario');
        if (result.status === 'success' && result.data && result.data.length > 0) {
            this.renderCharts(result.data);
        } else {
            console.warn('No hay datos históricos para graficar (se requiere implementar lógica de fallback si se desea)');
        }
    },

    renderCharts(data) {
        const labels = data.map(d => new Date(d.fecha).toLocaleDateString());
        const ventas = data.map(d => d.total_ventas);
        const compras = data.map(d => d.total_compras);
        const ganancias = data.map(d => d.ganancia);

        this.initChart('resumenFinancieroChart', 'bar', labels, [
            { label: 'Ventas', data: ventas, backgroundColor: 'rgba(0,123,255,0.7)' },
            { label: 'Compras', data: compras, backgroundColor: 'rgba(23,162,184,0.7)' },
            { label: 'Ganancias', data: ganancias, type: 'line', borderColor: 'green', fill: false }
        ]);

        // Acumulados para tendencias (reduce simple)
        // ... (Se podría agregar lógica más compleja de tendencias aquí)
    },

    initChart(canvasId, type, labels, datasets) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return;

        // Destruir gráfico anterior si existe
        if (STATE.charts[canvasId]) STATE.charts[canvasId].destroy();

        STATE.charts[canvasId] = new Chart(ctx, {
            type: type,
            data: { labels, datasets },
            options: { responsive: true, maintainAspectRatio: false }
        });
    },

    async loadSummary(sheetName) {
        UI.showStatus('statusResumen', 'info', `Cargando ${sheetName}...`);
        UI.toggleElement('resumenTable', false);

        const result = await API.get('getData', { sheetName });

        if (result.status === 'success' && result.data.length > 0) {
            UI.toggleElement('resumenTable', true);
            UI.showStatus('statusResumen', 'success', 'Datos cargados.');

            // Generar columnas dinámicamente basadas en la primera fila
            const firstRow = result.data[0];
            const columns = Object.keys(firstRow).map(key => ({
                key: key,
                text: (row) => {
                    const val = row[key];
                    if (key.includes('fecha')) return new Date(val).toLocaleDateString();
                    if (typeof val === 'number' && key.includes('precio')) return `$${val.toFixed(2)}`;
                    return val;
                }
            }));

            // Render Headers
            const thead = document.querySelector('#resumenTable thead');
            thead.innerHTML = '<tr>' + Object.keys(firstRow).map(k => `<th>${k.toUpperCase()}</th>`).join('') + '</tr>';

            UI.renderTable('resumenTableBody', result.data, columns);
        } else {
            UI.showStatus('statusResumen', 'warning', 'No hay datos disponibles.');
        }
    },

    async handleConfigAction(action) {
        const btnId = action === 'iniciar' ? 'iniciarDBBtn' : 'resetDBBtn';
        UI.setLoading(btnId, true);
        UI.showStatus('statusConfig', 'info', 'Procesando...');

        const result = await API.get(action);

        UI.setLoading(btnId, false);

        if (result.status === 'success') {
            UI.showStatus('statusConfig', 'success', result.message);
            if (action === 'iniciar') this.loadInitialData();
        } else {
            UI.showStatus('statusConfig', 'error', result.message);
        }
    }
};

// Start the Application
App.init();