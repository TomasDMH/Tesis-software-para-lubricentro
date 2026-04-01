// PUENTE (PRELOAD)
// Expone una API segura al frontend usando ContextBridge.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Clientes (paginado)
    getClients: (options) => ipcRenderer.invoke('get-clients', options),
    saveClient: (data) => ipcRenderer.invoke('save-client', data),
    getClientHistory: (id, options) => ipcRenderer.invoke('get-client-history', id, options),
    searchClients: (query, options) => ipcRenderer.invoke('search-clients', query, options),
    searchVehicles: (query) => ipcRenderer.invoke('search-vehicles', query),
    deleteClient: (id) => ipcRenderer.invoke('delete-client', id),
    forceWindowFocus: () => ipcRenderer.invoke('force-focus'),
    getClientVehicles: (id) => ipcRenderer.invoke('get-client-vehicles', id),

    // Login y usuarios
    login: (credenciales) => ipcRenderer.invoke('login-user', credenciales),
    getUsers: () => ipcRenderer.invoke('get-users'),
    saveUser: (data) => ipcRenderer.invoke('save-user', data),
    deleteUser: (id) => ipcRenderer.invoke('delete-user', id),
    getUserRole: (id) => ipcRenderer.invoke('get-user-role', id),

    // Stock (paginado)
    getProducts: (options) => ipcRenderer.invoke('get-products', options),
    getStockAlerts: () => ipcRenderer.invoke('get-stock-alerts'),
    getProductById: (id) => ipcRenderer.invoke('get-product-by-id', id),
    saveProduct: (data) => ipcRenderer.invoke('save-product', data),
    deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),

    // Stock por comprobantes (auditable)
    saveFacturaCompra: (data) => ipcRenderer.invoke('save-factura-compra', data),
    saveAjusteStock: (data) => ipcRenderer.invoke('save-ajuste-stock', data),
    getFacturas: (options) => ipcRenderer.invoke('get-facturas', options),
    getFacturaDetalle: (idFactura) => ipcRenderer.invoke('get-factura-detalle', idFactura),
    downloadFacturaPdf: (data) => ipcRenderer.invoke('download-factura-pdf', data),
    getMovimientosStock: (options) => ipcRenderer.invoke('get-movimientos-stock', options),

    // Proveedores (CRUD expandido)
    getProveedores: () => ipcRenderer.invoke('get-proveedores'),
    saveProveedor: (data) => ipcRenderer.invoke('save-proveedor', data),
    deleteProveedor: (id) => ipcRenderer.invoke('delete-proveedor', id),

    // Marcas de vehículos
    getMarcasVehiculo: () => ipcRenderer.invoke('get-marcas-vehiculo'),
    saveMarcaVehiculo: (nombre) => ipcRenderer.invoke('save-marca-vehiculo', nombre),

    // Marcas de productos/lubricantes
    getMarcasProducto: () => ipcRenderer.invoke('get-marcas-producto'),
    saveMarcaProducto: (nombre) => ipcRenderer.invoke('save-marca-producto', nombre),

    // Tipos de servicio
    getTiposServicio: () => ipcRenderer.invoke('get-tipos-servicio'),
    saveTipoServicio: (data) => ipcRenderer.invoke('save-tipo-servicio', data),
    deleteTipoServicio: (id) => ipcRenderer.invoke('delete-tipo-servicio', id),

    // Servicios
    saveService: (data) => ipcRenderer.invoke('save-service', data),
    saveVentaParticular: (data) => ipcRenderer.invoke('save-venta-particular', data),

    // Dashboard
    getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
    getDashboardCharts: () => ipcRenderer.invoke('get-dashboard-charts'),

    // Presupuestos
    getPresupuestos: (options) => ipcRenderer.invoke('get-presupuestos', options),
    savePresupuesto: (data) => ipcRenderer.invoke('save-presupuesto', data),
    updatePresupuestoEstado: (idPresupuesto, estado) => ipcRenderer.invoke('update-presupuesto-estado', { idPresupuesto, estado }),
    getPresupuestoDetalle: (id) => ipcRenderer.invoke('get-presupuesto-detalle', id),
    deletePresupuesto: (id) => ipcRenderer.invoke('delete-presupuesto', id),
    downloadPresupuestoPdf: (data) => ipcRenderer.invoke('download-presupuesto-pdf', data),

    // Email
    getEmailConfig: () => ipcRenderer.invoke('get-email-config'),
    saveEmailConfig: (data) => ipcRenderer.invoke('save-email-config', data),
    sendEmail: (data) => ipcRenderer.invoke('send-email', data),
    runServiceRemindersNow: () => ipcRenderer.invoke('run-service-reminders-now'),
});

console.log('Puente (preload) cargado correctamente.');
