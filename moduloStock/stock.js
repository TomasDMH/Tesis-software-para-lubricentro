// MÓDULO STOCK (Frontend)
// ABM de productos + movimientos auditables (Factura / Ajuste) + auditoría.
// Fuente de verdad: mililitros (Integer) en BD.

document.addEventListener('DOMContentLoaded', async () => {
    // 1) REFERENCIAS AL DOM
    // Tabs
    const tabProductos = document.getElementById('tab-stock-productos');
    const tabFactura = document.getElementById('tab-stock-factura');
    const tabAjuste = document.getElementById('tab-stock-ajuste');
    const tabAuditoria = document.getElementById('tab-stock-auditoria');

    // Secciones (izquierda)
    const seccionFormProductos = document.getElementById('seccion-form-productos');
    const seccionFormFactura = document.getElementById('seccion-form-factura');
    const seccionFormAjuste = document.getElementById('seccion-form-ajuste');

    // Vistas (derecha)
    const vistaProductos = document.getElementById('vista-stock-productos');
    const vistaAuditoria = document.getElementById('vista-stock-auditoria');

    // Modal genérico
    const modalOverlay = document.getElementById('modal-sistema');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalMensaje = document.getElementById('modal-mensaje');
    const modalSubmensaje = document.getElementById('modal-submensaje');
    const btnModalCancelar = document.getElementById('btn-modal-cancelar');
    const btnModalConfirmar = document.getElementById('btn-modal-confirmar');

    // Modal detalle factura
    const modalDetalleFactura = document.getElementById('modal-detalle-factura');
    const detalleFacturaTitulo = document.getElementById('detalle-factura-titulo');
    const detalleFacturaSubtitulo = document.getElementById('detalle-factura-subtitulo');
    const detalleFacturaBody = document.getElementById('detalle-factura-body');
    const detalleFacturaTotal = document.getElementById('detalle-factura-total');
    const btnDescargarDetalleFactura = document.getElementById('btn-descargar-detalle-factura');
    const btnCerrarDetalleFactura = document.getElementById('btn-cerrar-detalle-factura');
    let facturaDetalleActualId = null;

    // Botón Cerrar Sesión (Power)
    const btnCerrarSesion = document.querySelector('.boton-cierre-sesion');

    // ABM PRODUCTOS
    const formProducto = document.getElementById('form-producto-stock');
    const tituloFormProducto = document.getElementById('titulo-form-producto');
    const btnGuardarProducto = document.getElementById('btn-guardar-producto');
    const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion-stock');
    const grupoStockActual = document.getElementById('grupo-stock-actual');
    const labelStockActualLitros = document.getElementById('stock-actual-litros');

    const inputNombre = document.getElementById('nombre-producto-stock');
    const inputTipo = document.getElementById('tipo-producto-stock');
    const inputTipoEnvase = document.getElementById('tipo-envase-stock');
    const inputMarca = document.getElementById('marca-producto-stock');
    const inputPrecio = document.getElementById('precio-producto-stock');
    const selectProveedorProducto = document.getElementById('proveedor-producto-stock');
    const inputStockMinimo = document.getElementById('stock-minimo-producto');

    const btnAgregarProveedor = document.getElementById('btn-agregar-proveedor');
    const inputAgregarProveedor = document.getElementById('agregar-proveedor-stock');
    const btnEditarProveedor = document.getElementById('btn-editar-proveedor');

    // Marca producto (dropdown + agregar)
    const btnAgregarMarcaProducto = document.getElementById('btn-agregar-marca-producto');
    const inputAgregarMarcaProducto = document.getElementById('agregar-marca-producto');

    // Prevenir Enter en inputs de Agregar Proveedor y Agregar Marca (Issue 8)
    [inputAgregarProveedor, inputAgregarMarcaProducto].forEach(inp => {
        if (inp) {
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') e.preventDefault();
            });
        }
    });

    // Tabla productos
    const tablaCuerpo = document.querySelector('#stock-productos-tabla tbody');
    const inputBusqueda = document.querySelector('.buscar-producto-stock');

    // Paginación
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');
    const spanInfoPagina = document.getElementById('info-pagina');
    const divPaginacion = document.getElementById('paginacion-controls');

    // Notificaciones
    const campanaBtn = document.querySelector('.contenedor-campana');
    const puntoRojo = document.querySelector('.punto-rojo');
    const popupNotificaciones = document.querySelector('.popup-notificaciones');
    const listaAlertas = document.querySelector('.lista-alertas');

    // FACTURA
    const formFactura = document.getElementById('form-factura-stock');
    const selectProveedorFactura = document.getElementById('factura-proveedor-stock');
    const inputFacturaNro = document.getElementById('factura-nro-stock');
    const inputFacturaFecha = document.getElementById('factura-fecha-stock');
    // (Observaciones eliminado del formulario de factura)
    const tbodyItemsFactura = document.getElementById('tbody-items-factura');
    const btnAgregarItemFactura = document.getElementById('btn-agregar-item-factura');
    const labelFacturaTotal = document.getElementById('factura-total');

    // AJUSTE
    const formAjuste = document.getElementById('form-ajuste-stock');
    const selectProductoAjuste = document.getElementById('ajuste-producto-stock');
    const selectMotivoAjuste = document.getElementById('ajuste-motivo-stock');
    const selectDireccionAjuste = document.getElementById('ajuste-direccion-stock');
    const inputLitrosAjuste = document.getElementById('ajuste-litros-stock');
    const inputDetalleAjuste = document.getElementById('ajuste-detalle-stock');
    const labelCantidadAjuste = document.querySelector('label[for="ajuste-litros-stock"]');

    // Cambiar label/step según tipo de producto seleccionado en Ajuste
    if (selectProductoAjuste) {
        selectProductoAjuste.addEventListener('change', () => {
            const idProd = parseInt(selectProductoAjuste.value, 10);
            const prod = productosCache.find(p => p.idProducto === idProd);
            const esFiltroAjuste = prod && (prod.tipo || '').toLowerCase().includes('filtro');
            if (esFiltroAjuste) {
                if (labelCantidadAjuste) labelCantidadAjuste.textContent = 'Cantidad (Unidades):';
                inputLitrosAjuste.step = '1';
                inputLitrosAjuste.placeholder = 'Ej: 2';
            } else {
                if (labelCantidadAjuste) labelCantidadAjuste.textContent = 'Cantidad (Litros):';
                inputLitrosAjuste.step = '0.1';
                inputLitrosAjuste.placeholder = 'Ej: 5';
            }
        });
    }

    // AUDITORÍA
    const subtabFacturas = document.getElementById('subtab-facturas');
    const subtabMovimientos = document.getElementById('subtab-movimientos');
    const seccionAuditFacturas = document.getElementById('auditoria-facturas');
    const seccionAuditMovimientos = document.getElementById('auditoria-movimientos');

    const tbodyAuditFacturas = document.querySelector('#tabla-audit-facturas tbody');
    const tbodyAuditMovimientos = document.querySelector('#tabla-audit-movimientos tbody');

    // Filtros Auditoría - Facturas
    const filtroFactFecha = document.getElementById('filtro-fact-fecha');
    const filtroFactProveedor = document.getElementById('filtro-fact-proveedor');
    const filtroFactNro = document.getElementById('filtro-fact-nro');
    const btnLimpiarFiltrosFact = document.getElementById('btn-limpiar-filtros-fact');

    const pagAuditFacturas = document.getElementById('paginacion-audit-facturas');
    const btnPrevAuditFacturas = document.getElementById('btn-prev-audit-facturas');
    const btnNextAuditFacturas = document.getElementById('btn-next-audit-facturas');
    const infoPaginaAuditFacturas = document.getElementById('info-pagina-audit-facturas');

    // Filtros Auditoría - Movimientos
    const filtroMovFecha = document.getElementById('filtro-mov-fecha');
    const filtroMovProducto = document.getElementById('filtro-mov-producto');
    const filtroMovTipo = document.getElementById('filtro-mov-tipo');
    const filtroMovUsuario = document.getElementById('filtro-mov-usuario');
    const btnLimpiarFiltrosMov = document.getElementById('btn-limpiar-filtros-mov');

    const pagAuditMovimientos = document.getElementById('paginacion-audit-movimientos');
    const btnPrevAuditMovimientos = document.getElementById('btn-prev-audit-movimientos');
    const btnNextAuditMovimientos = document.getElementById('btn-next-audit-movimientos');
    const infoPaginaAuditMovimientos = document.getElementById('info-pagina-audit-movimientos');

    // 2) ESTADO
    let productoEnEdicionId = null;
    let productosPagina = [];
    let paginaActual = 1;
    let totalProductos = 0;
    let busquedaActual = '';
    const ITEMS_POR_PAGINA = 15;

    let productosCache = [];  // Para selects y búsquedas
    let proveedoresCache = []; // Para selects
    let usuariosCache = [];    // Para filtros de auditoría

    // 3) UTILIDADES
    function formatearNumeroEntero(valor) {
        if (valor === null || valor === undefined) return '';
        const s = valor.toString().replace(/\D/g, '');
        if (!s) return '';
        return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function desformatearNumeroEntero(valor) {
        if (!valor) return '';
        return valor.toString().replace(/\./g, '').trim();
    }

    function formatearMoneda(valor) {
        const n = Number(valor || 0);
        const entero = Math.round(n);
        return '$' + formatearNumeroEntero(entero);
    }

    
    function parsearFechaLocal(valor) {
        if (!valor) return null;

        const str = valor.toString().trim();

        // Si viene ISO completo (con hora/zona), tomamos la parte de fecha para evitar corrimientos por timezone.
        const soloFecha = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (soloFecha) {
            const y = parseInt(soloFecha[1], 10);
            const mo = parseInt(soloFecha[2], 10) - 1;
            const d = parseInt(soloFecha[3], 10);
            return new Date(y, mo, d);
        }

        // Caso más común en SQLite: "YYYY-MM-DD" (sin hora).
        const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
            const y = parseInt(m[1], 10);
            const mo = parseInt(m[2], 10) - 1;
            const d = parseInt(m[3], 10);
            return new Date(y, mo, d);
        }


        const mdt = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (mdt) {
            const y = parseInt(mdt[1], 10);
            const mo = parseInt(mdt[2], 10) - 1;
            const d = parseInt(mdt[3], 10);
            const hh = parseInt(mdt[4], 10);
            const mm = parseInt(mdt[5], 10);
            const ss = mdt[6] ? parseInt(mdt[6], 10) : 0;
            return new Date(y, mo, d, hh, mm, ss);
        }

        const dt = new Date(valor);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function formatoFechaSimple(isoOrDate) {
        if (!isoOrDate) return '-';

        const d = parsearFechaLocal(isoOrDate);
        if (!d) return isoOrDate.toString().slice(0, 10);

        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    function extraerCapacidadLitrosEnvase(tipoEnvase) {
        if (!tipoEnvase) return null;
        // Caja = 1 unidad equivalente a 1 litro en el sistema
        if (tipoEnvase.toString().toLowerCase().includes('caja')) return 1;
        const match = tipoEnvase.toString().toLowerCase().match(/(\d+)\s*(?:l|lt|lts)/i);
        return match ? parseInt(match[1], 10) : null;
    }

    function obtenerStockMinimo(prod) {
        // Si el producto tiene stockMinimo configurado en BD, usar ese valor
        if (prod && prod.stockMinimo && prod.stockMinimo > 0) {
            return prod.stockMinimo;
        }
        // Fallback: umbral por defecto según tipo de envase
        const tipoEnvase = prod ? (prod.tipoEnvase || '') : '';
        const tipo = prod ? (prod.tipo || '') : '';
        if (!tipoEnvase) return 100;
        const envase = tipoEnvase.toLowerCase().trim();
        if (envase.includes('caja')) return 3;
        if (tipo && tipo.toLowerCase().replace(/_/g, ' ').includes('refrigerante')) return 20;
        if (envase === 'tambor (200 lts)') return 100;
        if (envase === 'bidon (4 lts)') return 60;
        if (envase === 'bidon (5 lts)') return 75;
        if (envase === 'botella (1lt)') return 20;
        return 100;
    }

    // Modal del sistema (promesa)
    function mostrarModal(titulo, mensaje, submensaje = '', tipo = 'aviso', textoBtn = '') {
        return new Promise((resolve) => {
            modalTitulo.textContent = titulo;
            modalMensaje.textContent = mensaje;
            modalSubmensaje.textContent = submensaje;

            if (modalOverlay) modalOverlay.style.zIndex = '12000';
            if (window.electronAPI && typeof window.electronAPI.forceWindowFocus === 'function') {
                window.electronAPI.forceWindowFocus().catch(() => {});
            }

            // Re-query botones cada vez (pueden haber sido reemplazados por cloneNode)
            let btnConf = document.getElementById('btn-modal-confirmar');
            let btnCanc = document.getElementById('btn-modal-cancelar');

            btnConf.className = 'modal-btn';
            btnCanc.className = 'modal-btn';

            if (tipo === 'aviso' || tipo === 'exito') {
                btnConf.classList.add('aceptar');
                btnConf.textContent = 'Aceptar';
                btnCanc.style.display = 'none';
            } else if (tipo === 'eliminar') {
                btnConf.classList.add('confirmar');
                btnConf.textContent = 'Eliminar Definitivamente';
                btnCanc.classList.add('cancelar');
                btnCanc.textContent = 'Cancelar';
                btnCanc.style.display = 'block';
            } else if (tipo === 'confirmar') {
                btnConf.classList.add('aceptar');
                btnConf.textContent = textoBtn || 'Aceptar';
                btnCanc.classList.add('cancelar');
                btnCanc.textContent = 'Cancelar';
                btnCanc.style.display = 'block';
            } else {
                btnConf.classList.add('aceptar');
                btnConf.textContent = 'Aceptar';
                btnCanc.classList.add('cancelar');
                btnCanc.textContent = 'Cancelar';
                btnCanc.style.display = 'block';
            }

            modalOverlay.style.display = 'flex';

            const nuevoConfirmar = btnConf.cloneNode(true);
            const nuevoCancelar = btnCanc.cloneNode(true);
            btnConf.replaceWith(nuevoConfirmar);
            btnCanc.replaceWith(nuevoCancelar);

            nuevoConfirmar.addEventListener('click', () => {
                modalOverlay.style.display = 'none';
                resolve(true);
            });

            nuevoCancelar.addEventListener('click', () => {
                modalOverlay.style.display = 'none';
                resolve(false);
            });

            nuevoConfirmar.focus();
        });
    }

    function obtenerIdUsuarioActual() {
        const idUsuario = parseInt(localStorage.getItem('usuarioID'), 10);
        return Number.isFinite(idUsuario) ? idUsuario : null;
    }

    function setActivo(btn, activo) {
        if (!btn) return;
        btn.classList.toggle('activa', !!activo);
    }

    function mostrarSeccion(seccion) {
        // Izquierda
        const panelIzq = document.querySelector('.panel-izq-stock');
        [seccionFormProductos, seccionFormFactura, seccionFormAjuste].forEach(s => s.classList.remove('activa'));
        if (seccion === 'productos') seccionFormProductos.classList.add('activa');
        if (seccion === 'factura') seccionFormFactura.classList.add('activa');
        if (seccion === 'ajuste') seccionFormAjuste.classList.add('activa');

        // Ocultar panel izquierdo en Auditoría (eliminar panel vacío)
        if (panelIzq) {
            panelIzq.style.display = (seccion === 'auditoria') ? 'none' : 'flex';
        }

        // Derecha
        if (seccion === 'auditoria') {
            vistaProductos.style.display = 'none';
            vistaAuditoria.style.display = 'block';
        } else {
            vistaProductos.style.display = 'block';
            vistaAuditoria.style.display = 'none';
        }

        // Tabs
        setActivo(tabProductos, seccion === 'productos');
        setActivo(tabFactura, seccion === 'factura');
        setActivo(tabAjuste, seccion === 'ajuste');
        setActivo(tabAuditoria, seccion === 'auditoria');
    }

    // 4) CARGA DE PROVEEDORES / PRODUCTOS PARA SELECTS
    async function cargarProveedores() {
        try {
            proveedoresCache = await window.electronAPI.getProveedores();
        } catch (e) {
            proveedoresCache = [];
        }

        // Select proveedor (producto - referencia: texto)
        const opcionesProd = ['<option value="">Seleccionar proveedor</option>']
            .concat(proveedoresCache.map(p => `<option value="${escapeHtml(p.nombreProveedor)}">${escapeHtml(p.nombreProveedor)}</option>`));
        selectProveedorProducto.innerHTML = opcionesProd.join('');

        // Select proveedor (factura - relacional: id)
        const opcionesFac = ['<option value="">Seleccionar proveedor</option>']
            .concat(proveedoresCache.map(p => `<option value="${p.idProveedor}">${escapeHtml(p.nombreProveedor)}</option>`));
        selectProveedorFactura.innerHTML = opcionesFac.join('');

        // Filtro proveedor (Auditoría - Facturas)
        if (filtroFactProveedor) {
            const opcionesFiltro = ['<option value="">Todos</option>']
                .concat(proveedoresCache.map(p => `<option value="${p.idProveedor}">${escapeHtml(p.nombreProveedor)}</option>`));
            filtroFactProveedor.innerHTML = opcionesFiltro.join('');
        }
    }

    async function cargarProductosCache() {
        try {
            // Sin paginación (devuelve array)
            const data = await window.electronAPI.getProducts({ busqueda: '' });
            productosCache = Array.isArray(data) ? data : (data.rows || []);
            productosCache.sort((a, b) => (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' }));
        } catch (e) {
            productosCache = [];
        }

        // Select ajuste
        const opcionesAjuste = ['<option value="">Seleccionar producto</option>']
            .concat(productosCache.map(p => `<option value="${p.idProducto}">${escapeHtml(p.nombre)}${p.marca ? ' - ' + escapeHtml(p.marca) : ''}</option>`));
        selectProductoAjuste.innerHTML = opcionesAjuste.join('');

        // Filtro producto (Auditoría - Movimientos) — ya no es select, se puebla por búsqueda predictiva

        // Refrescar nombre visible en ítems de factura ya seleccionados
        refrescarItemsFacturaConCache();
    }


    async function cargarUsuariosCache() {
        try {
            usuariosCache = await window.electronAPI.getUsers();
            if (!Array.isArray(usuariosCache)) usuariosCache = [];
        } catch (e) {
            usuariosCache = [];
        }

        usuariosCache.sort((a, b) => (a.nombreUsuario || '').localeCompare((b.nombreUsuario || ''), 'es', { sensitivity: 'base' }));

        if (filtroMovUsuario) {
            const opcionesFiltro = ['<option value="">Todos</option>']
                .concat(usuariosCache.map(u => `<option value="${u.idUsuario}">${escapeHtml(u.nombreUsuario)}</option>`));
            filtroMovUsuario.innerHTML = opcionesFiltro.join('');
        }
    }

    function escapeHtml(str) {
        return (str || '').toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 5) LISTADO PRODUCTOS + ALERTAS
    async function listarProductos(busqueda = '') {
        try {
            const resultado = await window.electronAPI.getProducts({
                busqueda,
                pagina: paginaActual,
                limite: ITEMS_POR_PAGINA
            });

            productosPagina = resultado.rows || [];
            totalProductos = resultado.total || 0;

            renderTablaProductos();
            await cargarAlertas();
        } catch (e) {
            console.error('Error listando productos:', e);
        }
    }

    function renderTablaProductos() {
        tablaCuerpo.innerHTML = '';

        if (!productosPagina || productosPagina.length === 0) {
            tablaCuerpo.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">¡PRODUCTO NO ENCONTRADO!</td></tr>';
            if (divPaginacion) divPaginacion.style.display = 'none';
            return;
        }

        productosPagina.forEach(prod => {
            const tipoRaw = prod.tipo ? prod.tipo.replace(/_/g, ' ') : '-';
            const tipo = tipoRaw.replace(/\b\w/g, c => c.toUpperCase());
            const mililitros = prod.mililitros || 0;
            const esFiltro = (prod.tipo || '').toLowerCase().includes('filtro');

            let stockTexto, colorStock;
            if (esFiltro) {
                const cantUnidades = prod.cantidad || 0;
                const limite = obtenerStockMinimo(prod);
                colorStock = cantUnidades <= limite ? '#e20613' : '#2e7d32';
                stockTexto = `${cantUnidades} Un.`;
            } else {
                const litros = mililitros / 1000;
                const limite = obtenerStockMinimo(prod);
                colorStock = litros <= limite ? '#e20613' : '#2e7d32';
                stockTexto = `${litros.toFixed(2)} Lts.`;
            }

            // Calcular cantidad de envases
            const capL = extraerCapacidadLitrosEnvase(prod.tipoEnvase);
            let cantidadEnvases = '-';
            if (esFiltro) {
                cantidadEnvases = prod.cantidad || 0;
            } else if (capL && capL > 0) {
                cantidadEnvases = Math.floor(mililitros / (capL * 1000));
            }

            const fila = document.createElement('tr');
            fila.dataset.id = prod.idProducto;

            fila.innerHTML = `
                <td>${escapeHtml(prod.nombre || '-')}</td>
                <td>${escapeHtml(tipo)}</td>
                <td>${escapeHtml(prod.tipoEnvase || '-')}</td>
                <td>${cantidadEnvases}</td>
                <td>${escapeHtml(prod.marca || '-')}</td>
                <td>${escapeHtml(prod.proveedor || '-')}</td>
                <td style="color:${colorStock}; font-weight:bold;">${stockTexto}</td>
                <td>${formatearMoneda(prod.precio || 0)}</td>
                <td>
                    <div class="acciones-container-stock">
                        <button type="button" class="vehiculo-btn-stock btn-editar-fila" title="Editar">✏️</button>
                        <button type="button" class="vehiculo-btn-stock btn-eliminar-fila" title="Eliminar" style="background-color:#a60530; color:#fff;">🗑️</button>
                    </div>
                </td>
            `;
            tablaCuerpo.appendChild(fila);
        });

        const totalPaginas = Math.ceil(totalProductos / ITEMS_POR_PAGINA) || 1;
        if (divPaginacion) {
            divPaginacion.style.display = 'flex';
            spanInfoPagina.textContent = `Página ${paginaActual} de ${totalPaginas}`;
            btnPrev.disabled = (paginaActual === 1);
            btnNext.disabled = (paginaActual >= totalPaginas);
        }
    }

    async function cargarAlertas() {
        try {
            const productos = await window.electronAPI.getStockAlerts();
            listaAlertas.innerHTML = '';
            let hayAlertas = false;

            productos.forEach(prod => {
                const esFiltroAlerta = (prod.tipo || '').toLowerCase().includes('filtro');
                const limite = obtenerStockMinimo(prod);
                let stockValor, stockTexto;

                if (esFiltroAlerta) {
                    stockValor = prod.cantidad || 0;
                    stockTexto = `${stockValor} Un.`;
                } else {
                    const mililitros = prod.mililitros || 0;
                    stockValor = mililitros / 1000;
                    stockTexto = `${stockValor.toFixed(2)} Lts.`;
                }

                if (stockValor <= limite) {
                    hayAlertas = true;
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>ALERTA: ${escapeHtml(prod.nombre || '')}</strong><br>
                                    <span style="font-size:0.85em">Quedan ${stockTexto} (Mín: ${limite})</span>`;
                    li.style.cursor = 'pointer';
                    li.title = 'Click para editar el producto';
                    li.dataset.id = prod.idProducto;
                    listaAlertas.appendChild(li);
                }
            });

            puntoRojo.style.display = hayAlertas ? 'block' : 'none';
        } catch (e) {
            console.error('Error cargando alertas:', e);
        }
    }

    // 6) ABM PRODUCTOS (GUARDAR / EDITAR / ELIMINAR)
    function limpiarFormularioProducto() {
        formProducto.reset();
        productoEnEdicionId = null;
        tituloFormProducto.textContent = 'Cargar Nuevo Producto';
        btnGuardarProducto.textContent = 'Guardar Producto';
        btnCancelarEdicion.style.display = 'none';
        grupoStockActual.style.display = 'none';
        labelStockActualLitros.textContent = '0.00';
        if (inputStockMinimo) inputStockMinimo.value = '';
        if (inputMarca) inputMarca.value = '';
    }

    function cargarFormularioEditarProducto(prod) {
        productoEnEdicionId = prod.idProducto;
        inputNombre.value = prod.nombre || '';

        // Mapear tipo de BD al value del <select>
        const tipoLower = (prod.tipo || '').toLowerCase().replace(/_/g, ' ');
        if (tipoLower.includes('refrigerante')) {
            inputTipo.value = 'liquido_refrigerante';
        } else if (tipoLower.includes('filtro')) {
            inputTipo.value = 'filtro';
        } else if (tipoLower.includes('aceite')) {
            inputTipo.value = 'aceite';
        } else {
            // Intentar match directo, si no coincide queda vacío
            inputTipo.value = prod.tipo || '';
        }

        // Mapear tipoEnvase: intentar match directo, si no buscar por similitud
        const envaseDB = (prod.tipoEnvase || '').trim();
        let envaseMatch = false;
        for (const opt of inputTipoEnvase.options) {
            if (opt.value.toLowerCase() === envaseDB.toLowerCase()) {
                inputTipoEnvase.value = opt.value;
                envaseMatch = true;
                break;
            }
        }
        if (!envaseMatch) inputTipoEnvase.value = envaseDB;

        // Marca: seleccionar del dropdown si existe, sino agregarla
        if (inputMarca) {
            const marcaVal = (prod.marca || '').trim();
            const existeEnSelect = Array.from(inputMarca.options).some(o => o.value === marcaVal);
            if (marcaVal && !existeEnSelect) {
                const opt = document.createElement('option');
                opt.value = marcaVal;
                opt.textContent = marcaVal;
                inputMarca.appendChild(opt);
            }
            inputMarca.value = marcaVal;
        }

        inputPrecio.value = formatearNumeroEntero(prod.precio || 0);

        // Stock mínimo
        if (inputStockMinimo) {
            inputStockMinimo.value = (prod.stockMinimo && prod.stockMinimo > 0) ? prod.stockMinimo : '';
        }

        // proveedor referencia (texto)
        if (prod.proveedor) {
            const existe = Array.from(selectProveedorProducto.options).some(o => (o.value || '').toLowerCase() === prod.proveedor.toLowerCase());
            if (!existe) {
                const opt = document.createElement('option');
                opt.value = prod.proveedor;
                opt.textContent = prod.proveedor;
                selectProveedorProducto.appendChild(opt);
            }
            selectProveedorProducto.value = prod.proveedor;
        } else {
            selectProveedorProducto.value = '';
        }

        const litros = (prod.mililitros || 0) / 1000;
        labelStockActualLitros.textContent = litros.toFixed(2);
        grupoStockActual.style.display = 'block';

        tituloFormProducto.textContent = 'Editar Producto: ' + (prod.nombre || '');
        btnGuardarProducto.textContent = 'Guardar Cambios';
        btnCancelarEdicion.style.display = 'inline-block';

        mostrarSeccion('productos');
        formProducto.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Guardar producto (solo metadata)
    formProducto.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = (inputNombre.value || '').trim();
        const tipo = (inputTipo.value || '').trim();
        const tipoEnvase = (inputTipoEnvase.value || '').trim();
        const marca = inputMarca ? (inputMarca.value || '').trim() : '';
        const proveedor = (selectProveedorProducto.value || '').trim();

        const precioLimpio = desformatearNumeroEntero(inputPrecio.value);
        const precio = precioLimpio ? parseFloat(precioLimpio) : 0;

        const stockMinimo = inputStockMinimo ? (parseInt(inputStockMinimo.value, 10) || 0) : 0;

        if (!nombre || !tipo || !tipoEnvase) {
            await mostrarModal('Atención', 'Complete los datos obligatorios: Nombre, Tipo y Tipo Envase.');
            return;
        }

        const datos = {
            id: productoEnEdicionId,
            nombre,
            tipo,
            tipoEnvase,
            marca,
            unidad: 'ml',
            precio,
            proveedor,
            stockMinimo
        };

        try {
            const res = await window.electronAPI.saveProduct(datos);
            if (res && res.success) {
                await mostrarModal('Éxito', productoEnEdicionId ? 'Producto modificado correctamente.' : 'Producto cargado correctamente.', '', 'exito');
                limpiarFormularioProducto();
                paginaActual = 1;
                busquedaActual = '';
                if (inputBusqueda) inputBusqueda.value = '';
                await listarProductos();
                await cargarProductosCache();
                await cargarAuditoria(); // por si cambió referencia
            } else {
                await mostrarModal('Error', 'No se pudo guardar el producto.');
            }
        } catch (err) {
            console.error(err);
            await mostrarModal('Error', 'Error al guardar el producto.', err.message || '');
        }
    });

    // Cancelar edición
    btnCancelarEdicion.addEventListener('click', () => {
        limpiarFormularioProducto();
    });

    // Formateo precio (entero con separadores)
    inputPrecio.addEventListener('input', function() {
        const cursorPos = this.selectionStart;
        const valorAnterior = this.value;
        const lenAnterior = valorAnterior.length;

        const limpio = desformatearNumeroEntero(this.value);
        const formateado = formatearNumeroEntero(limpio);
        this.value = formateado;

        const lenNuevo = formateado.length;
        const diff = lenNuevo - lenAnterior;
        this.setSelectionRange(cursorPos + diff, cursorPos + diff);
    });

    // Tabla: editar / eliminar
    tablaCuerpo.addEventListener('click', async (e) => {
        const fila = e.target.closest('tr[data-id]');
        if (!fila) return;
        const idProducto = parseInt(fila.dataset.id, 10);
        const prod = productosPagina.find(p => p.idProducto === idProducto);
        if (!prod) return;

        if (e.target.closest('.btn-eliminar-fila')) {
            const confirmar = await mostrarModal('Eliminar Producto', `¿Está seguro que desea eliminar "${prod.nombre}"?`, '', 'eliminar');
            if (!confirmar) return;
            try {
                const res = await window.electronAPI.deleteProduct(idProducto);

                if (res && res.success) {
                    await mostrarModal('Éxito', 'Producto eliminado correctamente.', '', 'exito');
                    await listarProductos(busquedaActual);
                    await cargarProductosCache();
                    await cargarAuditoria();
                } else {
                    const detalle = (res && (res.message || res.error)) ? (res.message || res.error) : '';
                    await mostrarModal('Atención', 'No se pudo eliminar el producto.', detalle || 'El producto tiene movimientos asociados (facturas/servicios/ajustes) y no se puede borrar porque se perdería la trazabilidad.');
                }
            } catch (err) {
                console.error(err);
                await mostrarModal('Error', 'No se pudo eliminar el producto.', err.message || '');
            }
        }

        if (e.target.closest('.btn-editar-fila')) {
            cargarFormularioEditarProducto(prod);
        }
    });

    // Buscador
    inputBusqueda.addEventListener('input', (e) => {
        busquedaActual = e.target.value;
        paginaActual = 1;
        listarProductos(busquedaActual);
    });

    // Paginación
    btnPrev.addEventListener('click', () => {
        if (paginaActual > 1) {
            paginaActual--;
            listarProductos(busquedaActual);
        }
    });
    btnNext.addEventListener('click', () => {
        const totalPaginas = Math.ceil(totalProductos / ITEMS_POR_PAGINA) || 1;
        if (paginaActual < totalPaginas) {
            paginaActual++;
            listarProductos(busquedaActual);
        }
    });

    // Campana
    if (campanaBtn) {
        campanaBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            popupNotificaciones.style.display = (popupNotificaciones.style.display === 'block') ? 'none' : 'block';
        });
    }

    // Click en alerta: abrir edición del producto
    listaAlertas.addEventListener('click', async (e) => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;

        const idProducto = parseInt(li.dataset.id, 10);
        try {
            const prod = await window.electronAPI.getProductById(idProducto);
            if (prod) {
                cargarFormularioEditarProducto(prod);
                popupNotificaciones.style.display = 'none';
            }
        } catch (err) {
            console.error(err);
        }
    });

    document.addEventListener('click', (e) => {
        // Cerrar notificaciones
        if (popupNotificaciones && campanaBtn && !campanaBtn.contains(e.target)) {
            popupNotificaciones.style.display = 'none';
        }

        // Cerrar resultados flotantes de Productos (Factura) al hacer click afuera
        if (!e.target.closest('.item-producto-wrapper')) {
            document.querySelectorAll('.resultados-prod-factura').forEach(div => {
                div.style.display = 'none';
            });
        }
    });

    // 7) PROVEEDORES (AGREGAR + EDITAR)
    btnAgregarProveedor.addEventListener('click', async () => {
        const nombre = (inputAgregarProveedor.value || '').trim();
        if (!nombre) {
            await mostrarModal('Atención', 'Ingrese un nombre de proveedor.');
            return;
        }
        try {
            const resultado = await window.electronAPI.saveProveedor(nombre);
            inputAgregarProveedor.value = '';
            await cargarProveedores();

            // Auto-abrir modal de editar con el proveedor recién creado
            if (resultado && resultado.id) {
                renderListaProveedores();
                cargarDatosProveedorEnModal(resultado.id);
                if (modalEditarProveedor) modalEditarProveedor.style.display = 'flex';
            } else {
                await mostrarModal('Éxito', `Proveedor "${nombre}" agregado correctamente.`, '', 'exito');
            }
        } catch (err) {
            console.error(err);
            await mostrarModal('Error', 'No se pudo guardar el proveedor.', err.message || '');
        }
    });

    // --- Modal Editar Proveedor ---
    const modalEditarProveedor = document.getElementById('modal-editar-proveedor');
    const editProvNombre = document.getElementById('edit-prov-nombre');
    const editProvRazon = document.getElementById('edit-prov-razon');
    const editProvCuit = document.getElementById('edit-prov-cuit');
    const editProvDireccion = document.getElementById('edit-prov-direccion');
    const editProvTelefono = document.getElementById('edit-prov-telefono');
    const btnGuardarEditProv = document.getElementById('btn-guardar-edit-prov');
    const btnEliminarEditProv = document.getElementById('btn-eliminar-edit-prov');
    const btnCerrarEditProv = document.getElementById('btn-cerrar-edit-prov');
    const listaProveedoresEdit = document.getElementById('lista-proveedores-edit');

    let proveedorEditandoId = null;

    function renderListaProveedores() {
        if (!listaProveedoresEdit) return;
        listaProveedoresEdit.innerHTML = '';
        if (!proveedoresCache.length) {
            listaProveedoresEdit.innerHTML = '<p style="color:#bbb;">No hay proveedores.</p>';
            return;
        }
        proveedoresCache.forEach(p => {
            const div = document.createElement('div');
            div.style.cssText = 'padding:8px 10px; border-bottom:1px solid rgba(250,176,98,0.2); color:#fff;';

            // Línea principal: nombre + botón
            const lineaPrincipal = document.createElement('div');
            lineaPrincipal.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
            lineaPrincipal.innerHTML = `
                <strong>${escapeHtml(p.nombreProveedor)}</strong>
                <button type="button" class="btn-mini btn-seleccionar-prov" data-id="${p.idProveedor}" style="font-size:0.8em;">Seleccionar</button>
            `;
            div.appendChild(lineaPrincipal);

            // Línea de detalles (siempre visible)
            const detalles = [];
            if (p.razonSocial) detalles.push(`<span>Razón Social: ${escapeHtml(p.razonSocial)}</span>`);
            if (p.cuit) detalles.push(`<span>CUIT: ${escapeHtml(p.cuit)}</span>`);
            if (p.direccion) detalles.push(`<span>Dir: ${escapeHtml(p.direccion)}</span>`);
            if (p.telefono) detalles.push(`<span>Tel: ${escapeHtml(p.telefono)}</span>`);
            if (detalles.length > 0) {
                const lineaDetalle = document.createElement('div');
                lineaDetalle.style.cssText = 'color:#bbb; font-size:0.8em; margin-top:3px; display:flex; gap:12px; flex-wrap:wrap;';
                lineaDetalle.innerHTML = detalles.join('');
                div.appendChild(lineaDetalle);
            } else {
                const sinDatos = document.createElement('div');
                sinDatos.style.cssText = 'color:#666; font-size:0.75em; margin-top:2px; font-style:italic;';
                sinDatos.textContent = 'Sin datos adicionales — seleccionar para completar';
                div.appendChild(sinDatos);
            }

            listaProveedoresEdit.appendChild(div);
        });
    }

    function cargarDatosProveedorEnModal(idProv) {
        const prov = proveedoresCache.find(p => p.idProveedor === idProv);
        if (!prov) return;
        proveedorEditandoId = idProv;
        if (editProvNombre) editProvNombre.value = prov.nombreProveedor || '';
        if (editProvRazon) editProvRazon.value = prov.razonSocial || '';
        if (editProvCuit) editProvCuit.value = prov.cuit || '';
        if (editProvDireccion) editProvDireccion.value = prov.direccion || '';
        if (editProvTelefono) editProvTelefono.value = prov.telefono || '';
        if (btnEliminarEditProv) btnEliminarEditProv.style.display = 'inline-block';
    }

    if (btnEditarProveedor) {
        btnEditarProveedor.addEventListener('click', async () => {
            proveedorEditandoId = null;
            if (editProvNombre) editProvNombre.value = '';
            if (editProvRazon) editProvRazon.value = '';
            if (editProvCuit) editProvCuit.value = '';
            if (editProvDireccion) editProvDireccion.value = '';
            if (editProvTelefono) editProvTelefono.value = '';
            if (btnEliminarEditProv) btnEliminarEditProv.style.display = 'none';
            await cargarProveedores();
            renderListaProveedores();
            if (modalEditarProveedor) modalEditarProveedor.style.display = 'flex';
        });
    }

    if (listaProveedoresEdit) {
        listaProveedoresEdit.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-seleccionar-prov');
            if (!btn) return;
            const idProv = parseInt(btn.dataset.id, 10);
            cargarDatosProveedorEnModal(idProv);
        });
    }

    if (btnGuardarEditProv) {
        btnGuardarEditProv.addEventListener('click', async () => {
            const nombre = (editProvNombre ? editProvNombre.value : '').trim();
            if (!nombre) {
                await mostrarModal('Atención', 'El nombre del proveedor es obligatorio.');
                return;
            }
            const datos = {
                id: proveedorEditandoId || null,
                nombre: nombre,
                razonSocial: (editProvRazon ? editProvRazon.value : '').trim(),
                cuit: (editProvCuit ? editProvCuit.value : '').trim(),
                direccion: (editProvDireccion ? editProvDireccion.value : '').trim(),
                telefono: (editProvTelefono ? editProvTelefono.value : '').trim()
            };
            try {
                await window.electronAPI.saveProveedor(datos);
                await cargarProveedores();
                renderListaProveedores();
                proveedorEditandoId = null;
                if (editProvNombre) editProvNombre.value = '';
                if (editProvRazon) editProvRazon.value = '';
                if (editProvCuit) editProvCuit.value = '';
                if (editProvDireccion) editProvDireccion.value = '';
                if (editProvTelefono) editProvTelefono.value = '';
                if (btnEliminarEditProv) btnEliminarEditProv.style.display = 'none';
                if (modalEditarProveedor) modalEditarProveedor.style.display = 'none';
                await mostrarModal('Éxito', 'Proveedor guardado correctamente.', '', 'exito');
            } catch (err) {
                console.error(err);
                await mostrarModal('Error', 'No se pudo guardar el proveedor.', err.message || '');
            }
        });
    }

    if (btnEliminarEditProv) {
        btnEliminarEditProv.addEventListener('click', async () => {
            if (!proveedorEditandoId) {
                await mostrarModal('Atención', 'Seleccione un proveedor de la lista primero.');
                return;
            }
            const prov = proveedoresCache.find(p => p.idProveedor === proveedorEditandoId);
            const nombreProv = prov ? prov.nombreProveedor : 'este proveedor';
            const confirmar = await mostrarModal(
                'Confirmar Eliminación',
                `¿Está seguro que desea eliminar al proveedor "${nombreProv}"?`,
                'Esta acción no se puede deshacer.',
                'confirmar'
            );
            if (!confirmar) return;
            try {
                await window.electronAPI.deleteProveedor(proveedorEditandoId);
                proveedorEditandoId = null;
                if (editProvNombre) editProvNombre.value = '';
                if (editProvRazon) editProvRazon.value = '';
                if (editProvCuit) editProvCuit.value = '';
                if (editProvDireccion) editProvDireccion.value = '';
                if (editProvTelefono) editProvTelefono.value = '';
                if (btnEliminarEditProv) btnEliminarEditProv.style.display = 'none';
                await cargarProveedores();
                renderListaProveedores();
                await mostrarModal('Éxito', 'Proveedor eliminado correctamente.', '', 'exito');
            } catch (err) {
                console.error(err);
                await mostrarModal('Error', 'No se pudo eliminar el proveedor.', err.message || '');
            }
        });
    }

    if (btnCerrarEditProv) {
        btnCerrarEditProv.addEventListener('click', () => {
            if (modalEditarProveedor) modalEditarProveedor.style.display = 'none';
        });
    }

    if (modalEditarProveedor) {
        modalEditarProveedor.addEventListener('click', (e) => {
            if (e.target === modalEditarProveedor) modalEditarProveedor.style.display = 'none';
        });
    }

    // 7B) MARCAS PRODUCTO (CARGAR + AGREGAR)
    async function cargarMarcasProducto() {
        try {
            const marcas = await window.electronAPI.getMarcasProducto();
            if (inputMarca) {
                const valorActual = inputMarca.value;
                inputMarca.innerHTML = '<option value="">Seleccionar marca</option>';
                if (Array.isArray(marcas)) {
                    marcas.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.nombre;
                        opt.textContent = m.nombre;
                        inputMarca.appendChild(opt);
                    });
                }
                // Restaurar valor seleccionado si existía
                if (valorActual) inputMarca.value = valorActual;
            }
        } catch (e) {
            console.error('Error cargando marcas producto:', e);
        }
    }

    if (btnAgregarMarcaProducto) {
        btnAgregarMarcaProducto.addEventListener('click', async () => {
            const nombre = (inputAgregarMarcaProducto ? inputAgregarMarcaProducto.value : '').trim();
            if (!nombre) {
                await mostrarModal('Atención', 'Ingrese un nombre de marca.');
                return;
            }
            try {
                await window.electronAPI.saveMarcaProducto(nombre);
                if (inputAgregarMarcaProducto) inputAgregarMarcaProducto.value = '';
                await cargarMarcasProducto();
                // Seleccionar la marca recién agregada
                if (inputMarca) inputMarca.value = nombre;
                await mostrarModal('Éxito', `Marca "${nombre}" agregada correctamente.`, '', 'exito');
            } catch (err) {
                console.error(err);
                await mostrarModal('Error', 'No se pudo guardar la marca.', err.message || '');
            }
        });
    }

    // 8) FACTURA (COMPRAS AUDITABLES)

    function refrescarItemsFacturaConCache() {
        const filas = Array.from(tbodyItemsFactura.querySelectorAll('tr'));
        filas.forEach(tr => {
            const inputProd = tr.querySelector('.item-producto-busqueda');
            if (!inputProd) return;

            const idProd = parseInt(inputProd.dataset.idProducto, 10);
            if (!idProd) return;

            const prod = productosCache.find(p => p.idProducto === idProd);
            if (!prod) return;

            inputProd.value = textoProductoFactura(prod);

            const inputLitrosU = tr.querySelector('.item-litros-unidad');
            if (!inputLitrosU) return;

            const cap = extraerCapacidadLitrosEnvase(prod.tipoEnvase);
            if (!cap) {
                inputLitrosU.disabled = false;
                inputLitrosU.placeholder = 'Ingresar litros/unidad';
            } else {
                inputLitrosU.value = '';
                inputLitrosU.disabled = true;
                inputLitrosU.placeholder = 'Sólo "Otro"';
            }
        });
    }

    function setFechaFacturaHoy() {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        inputFacturaFecha.value = `${yyyy}-${mm}-${dd}`;
    }

    
    function textoProductoFactura(prod) {
        if (!prod) return '';
        const nombre = (prod.nombre || '').toString().trim();
        const marca = (prod.marca || '').toString().trim();
        return marca ? `${nombre} - ${marca}` : nombre;
    }

    function buscarProductosFactura(termino) {
        const t = (termino || '').toString().trim().toLowerCase();
        if (!t) return productosCache.slice(0, 25);

        const out = [];
        for (const p of productosCache) {
            const hay = `${p.nombre || ''} ${p.marca || ''} ${p.tipo || ''} ${p.tipoEnvase || ''}`.toLowerCase();
            if (hay.includes(t)) out.push(p);
            if (out.length >= 25) break;
        }
        return out;
    }

    function crearFilaItemFactura() {
        const tr = document.createElement('tr');

        // Producto (Live Search)
        const tdProd = document.createElement('td');
        tdProd.className = 'item-producto-wrapper';

        const inputProd = document.createElement('input');
        inputProd.type = 'text';
        inputProd.className = 'input-stock item-producto-busqueda';
        inputProd.placeholder = 'Buscar producto...';
        inputProd.autocomplete = 'off';
        inputProd.dataset.idProducto = '';

        const divResultados = document.createElement('div');
        divResultados.className = 'resultados-flotantes resultados-prod-factura';

        tdProd.appendChild(inputProd);
        tdProd.appendChild(divResultados);

        const tdCant = document.createElement('td');
        const inputCant = document.createElement('input');
        inputCant.type = 'number';
        inputCant.min = '1';
        inputCant.value = '1';
        inputCant.className = 'input-stock item-cantidad';
        tdCant.appendChild(inputCant);

        const tdLitrosU = document.createElement('td');
        const inputLitrosU = document.createElement('input');
        inputLitrosU.type = 'number';
        inputLitrosU.step = '0.1';
        inputLitrosU.placeholder = 'Sólo "Otro"';
        inputLitrosU.className = 'input-stock item-litros-unidad';
        inputLitrosU.disabled = true;
        tdLitrosU.appendChild(inputLitrosU);

        const tdPU = document.createElement('td');
        const inputPU = document.createElement('input');
        inputPU.type = 'text';
        inputPU.placeholder = '0';
        inputPU.className = 'input-stock item-precio';
        tdPU.appendChild(inputPU);

        const tdSub = document.createElement('td');
        const spanSub = document.createElement('span');
        spanSub.className = 'item-subtotal';
        spanSub.textContent = '$0';
        spanSub.style.display = 'block';
        spanSub.style.width = '100%';
        spanSub.style.padding = '6px 8px';
        spanSub.style.background = '#fffbe6';
        spanSub.style.color = '#3a3a3a';
        spanSub.style.border = '1px solid #fab062';
        spanSub.style.borderRadius = '4px';
        spanSub.style.boxSizing = 'border-box';
        spanSub.style.fontWeight = 'bold';
        tdSub.appendChild(spanSub);

        const tdAcc = document.createElement('td');
        const btnQuitar = document.createElement('button');
        btnQuitar.type = 'button';
        btnQuitar.className = 'btn-mini peligro btn-quitar-item';
        btnQuitar.textContent = 'Quitar';
        tdAcc.appendChild(btnQuitar);

        tr.appendChild(tdProd);
        tr.appendChild(tdCant);
        tr.appendChild(tdLitrosU);
        tr.appendChild(tdPU);
        tr.appendChild(tdSub);
        tr.appendChild(tdAcc);

        function ocultarResultados() {
            divResultados.style.display = 'none';
        }

        function renderResultados(termino) {
            const lista = buscarProductosFactura(termino);

            if (!lista.length) {
                divResultados.innerHTML = '';
                divResultados.style.display = 'none';
                return;
            }

            divResultados.innerHTML = lista.map(p => {
                const titulo = escapeHtml(textoProductoFactura(p) || '-');
                const envase = escapeHtml(p.tipoEnvase || '');
                const id = p.idProducto;
                return `
                    <div class="item-resultado" data-id-producto="${id}">
                        <strong>${titulo}</strong>
                        ${envase ? `<small>${envase}</small>` : ''}
                    </div>
                `;
            }).join('');

            divResultados.style.display = 'block';
        }

        function aplicarSeleccionProducto(idProductoSeleccionado) {
            const idProd = parseInt(idProductoSeleccionado, 10);
            const prod = productosCache.find(p => p.idProducto === idProd);
            if (!prod) return;

            inputProd.value = textoProductoFactura(prod);
            inputProd.dataset.idProducto = String(idProd);

            const esFiltroItem = (prod.tipo || '').toLowerCase().includes('filtro');
            if (esFiltroItem) {
                inputLitrosU.value = '';
                inputLitrosU.disabled = true;
                inputLitrosU.placeholder = 'N/A (Filtro)';
            } else {
                const cap = extraerCapacidadLitrosEnvase(prod.tipoEnvase);
                if (!cap) {
                    inputLitrosU.disabled = false;
                    inputLitrosU.placeholder = 'Ingresar litros/unidad';
                } else {
                    inputLitrosU.value = '';
                    inputLitrosU.disabled = true;
                    inputLitrosU.placeholder = 'Sólo "Otro"';
                }
            }

            ocultarResultados();
            recalcularFila(tr);
        }

        // Live search eventos
        inputProd.addEventListener('focus', async () => {
            // Asegura cache actualizado al momento de seleccionar
            await cargarProductosCache();
            renderResultados(inputProd.value);
        });

        inputProd.addEventListener('input', () => {
            inputProd.dataset.idProducto = '';
            inputLitrosU.value = '';
            inputLitrosU.disabled = true;
            inputLitrosU.placeholder = 'Sólo "Otro"';
            renderResultados(inputProd.value);
            recalcularFila(tr);
        });

        divResultados.addEventListener('click', (e) => {
            const item = e.target.closest('.item-resultado');
            if (!item) return;
            aplicarSeleccionProducto(item.dataset.idProducto);
        });

        // Formateo precio unitario (entero)
        inputPU.addEventListener('input', function() {
            const cursorPos = this.selectionStart;
            const valorAnterior = this.value;
            const lenAnterior = valorAnterior.length;

            const limpio = desformatearNumeroEntero(this.value);
            const formateado = formatearNumeroEntero(limpio);
            this.value = formateado;

            const lenNuevo = formateado.length;
            const diff = lenNuevo - lenAnterior;
            this.setSelectionRange(cursorPos + diff, cursorPos + diff);

            recalcularFila(tr);
        });

        // Recalcular por cambios
        inputCant.addEventListener('input', () => recalcularFila(tr));
        inputLitrosU.addEventListener('input', () => recalcularFila(tr));

        btnQuitar.addEventListener('click', () => {
            tr.remove();
            recalcularTotalFactura();
        });

        return tr;
    }


    
    function recalcularFila(tr) {
        const inputProd = tr.querySelector('.item-producto-busqueda');
        const inputCant = tr.querySelector('.item-cantidad');
        const inputLitrosU = tr.querySelector('.item-litros-unidad');
        const inputPU = tr.querySelector('.item-precio');
        const spanSub = tr.querySelector('.item-subtotal');

        const cant = parseInt(inputCant.value, 10) || 0;
        const pu = parseFloat(desformatearNumeroEntero(inputPU.value)) || 0;

        // Subtotal monetario (siempre depende de Cantidad x Precio)
        const subtotal = cant * pu;
        spanSub.textContent = formatearMoneda(subtotal);

        // Nota: Litros/unidad se valida al registrar la factura cuando el envase es "Otro".
        // Acá solo lo mantenemos para recalcular el total.
        if (inputLitrosU && !inputLitrosU.disabled) {
            // No hace falta recalcular nada extra, pero deja el hook para UX.
        }

        recalcularTotalFactura();
    }


    function recalcularTotalFactura() {
        let total = 0;
        const filas = Array.from(tbodyItemsFactura.querySelectorAll('tr'));
        filas.forEach(tr => {
            const inputPU = tr.querySelector('.item-precio');
            const inputCant = tr.querySelector('.item-cantidad');
            const cant = parseInt(inputCant.value, 10) || 0;
            const pu = parseFloat(desformatearNumeroEntero(inputPU.value)) || 0;
            total += cant * pu;
        });
        labelFacturaTotal.textContent = formatearMoneda(total);
    }

    btnAgregarItemFactura.addEventListener('click', () => {
        const tr = crearFilaItemFactura();
        tbodyItemsFactura.appendChild(tr);
        recalcularTotalFactura();
    });

    // Formato nro comprobante
    inputFacturaNro.addEventListener('input', function() {
        let v = this.value.replace(/[^A-Za-z0-9]/g, '');
        let letra = v.slice(0, 1).toUpperCase().replace(/[^A-C]/g, '');
        let p1 = v.slice(1, 5).replace(/\D/g, '');
        let p2 = v.slice(5, 13).replace(/\D/g, '');
        this.value = (letra || '') + (p1 ? '-' + p1 : '') + (p2 ? '-' + p2 : '');
    });

    formFactura.addEventListener('submit', async (e) => {
        e.preventDefault();

        const idUsuario = obtenerIdUsuarioActual();
        if (!idUsuario) {
            await mostrarModal('Error', 'Sesión no válida. Inicie sesión nuevamente.');
            return;
        }

        const idProveedor = parseInt(selectProveedorFactura.value, 10) || null;
        const nro = (inputFacturaNro.value || '').trim();
        const fecha = (inputFacturaFecha.value || '').trim();
        const observaciones = '';

        if (!idProveedor) {
            await mostrarModal('Atención', 'Seleccione un proveedor.');
            return;
        }
        if (!nro) {
            await mostrarModal('Atención', 'Ingrese el número de factura/comprobante.');
            return;
        }

        const filas = Array.from(tbodyItemsFactura.querySelectorAll('tr'));
        if (filas.length === 0) {
            await mostrarModal('Atención', 'Agregue al menos un ítem.');
            return;
        }

        const items = [];
        for (const tr of filas) {
            const inputProd = tr.querySelector('.item-producto-busqueda');
            const inputCant = tr.querySelector('.item-cantidad');
            const inputLitrosU = tr.querySelector('.item-litros-unidad');
            const inputPU = tr.querySelector('.item-precio');

            const idProducto = inputProd ? parseInt(inputProd.dataset.idProducto, 10) : NaN;
            const cantidadEnvases = parseInt(inputCant.value, 10);
            const precioUnitario = parseFloat(desformatearNumeroEntero(inputPU.value));

            if (!idProducto) {
                await mostrarModal('Atención', 'Hay ítems sin producto seleccionado.');
                return;
            }
            if (!cantidadEnvases || cantidadEnvases <= 0) {
                await mostrarModal('Atención', 'Hay ítems con cantidad inválida.');
                return;
            }
            if (Number.isNaN(precioUnitario) || precioUnitario < 0) {
                await mostrarModal('Atención', 'Hay ítems con precio unitario inválido.');
                return;
            }

            const prod = productosCache.find(p => p.idProducto === idProducto);
            const esFiltroValidacion = prod && (prod.tipo || '').toLowerCase().includes('filtro');
            const cap = prod ? extraerCapacidadLitrosEnvase(prod.tipoEnvase) : null;

            let litrosPorUnidad = null;
            if (!esFiltroValidacion && !cap) {
                litrosPorUnidad = parseFloat(inputLitrosU.value);
                if (!litrosPorUnidad || Number.isNaN(litrosPorUnidad) || litrosPorUnidad <= 0) {
                    await mostrarModal('Atención', `El producto "${prod ? prod.nombre : ''}" requiere Litros/unidad (Envase: Otro).`);
                    return;
                }
            }

            items.push({
                idProducto,
                cantidadEnvases,
                precioUnitario,
                litrosPorUnidad
            });
        }

        try {
            const res = await window.electronAPI.saveFacturaCompra({
                idProveedor,
                nroComprobante: nro,
                fecha: fecha || null,
                observaciones,
                items,
                idUsuario
            });

            if (res && res.success) {
                await mostrarModal('Éxito', 'Factura registrada correctamente.', '', 'exito');

                // Reset
                formFactura.reset();
                setFechaFacturaHoy();
                tbodyItemsFactura.innerHTML = '';
                tbodyItemsFactura.appendChild(crearFilaItemFactura());
                recalcularTotalFactura();

                // Refrescar listas
                paginaActual = 1;
                busquedaActual = '';
                if (inputBusqueda) inputBusqueda.value = '';
                await listarProductos();
                await cargarProductosCache();
                await cargarAuditoria();
            } else {
                await mostrarModal('Error', 'No se pudo registrar la factura.', (res && res.error) ? res.error : '');
            }
        } catch (err) {
            console.error(err);
            await mostrarModal('Error', 'Error al registrar factura.', err.message || '');
        }
    });

    // 9) AJUSTE (AUDITABLE)
    formAjuste.addEventListener('submit', async (e) => {
        e.preventDefault();

        const idUsuario = obtenerIdUsuarioActual();
        if (!idUsuario) {
            await mostrarModal('Error', 'Sesión no válida. Inicie sesión nuevamente.');
            return;
        }

        const idProducto = parseInt(selectProductoAjuste.value, 10);
        const motivo = (selectMotivoAjuste.value || '').trim();
        const direccion = (selectDireccionAjuste.value || 'salida').trim();
        const cantidadInput = parseFloat(inputLitrosAjuste.value);

        if (!idProducto) {
            await mostrarModal('Atención', 'Seleccione un producto.');
            return;
        }
        if (!motivo) {
            await mostrarModal('Atención', 'Seleccione un motivo.');
            return;
        }
        if (!cantidadInput || Number.isNaN(cantidadInput) || cantidadInput <= 0) {
            await mostrarModal('Atención', 'Ingrese una cantidad válida.');
            return;
        }

        // Detectar si es filtro
        const prodAjuste = productosCache.find(p => p.idProducto === idProducto);
        const esFiltroAjuste = prodAjuste && (prodAjuste.tipo || '').toLowerCase().includes('filtro');

        let mlDelta;
        if (esFiltroAjuste) {
            // Para filtros: unidades enteras
            const unidades = Math.round(cantidadInput);
            mlDelta = (direccion === 'entrada') ? unidades : -unidades;
        } else {
            // Para líquidos: convertir litros a ml
            const ml = Math.round(cantidadInput * 1000);
            mlDelta = (direccion === 'entrada') ? ml : -ml;
        }

        const detalleLibre = (inputDetalleAjuste.value || '').trim();

        try {
            const res = await window.electronAPI.saveAjusteStock({
                idProducto,
                mlDelta,
                motivoEnum: motivo,
                detalleLibre,
                idUsuario,
                esFiltro: !!esFiltroAjuste
            });

            if (res && res.success) {
                await mostrarModal('Éxito', 'Ajuste registrado correctamente.', '', 'exito');
                
                // Limpiar campos explícitamente
                selectProductoAjuste.value = '';
                selectMotivoAjuste.value = '';
                selectDireccionAjuste.value = 'salida';
                inputLitrosAjuste.value = '';
                inputDetalleAjuste.value = '';
                if (labelCantidadAjuste) labelCantidadAjuste.textContent = 'Cantidad (Litros):';
                inputLitrosAjuste.step = '0.1';
                inputLitrosAjuste.placeholder = 'Ej: 5';

                // Refrescar tabla de productos y cache
                await listarProductos(busquedaActual);
                await cargarProductosCache();
                await cargarAuditoria();
            } else {
                await mostrarModal('Error', 'No se pudo registrar el ajuste.', (res && res.error) ? res.error : '');
            }
        } catch (err) {
            console.error(err);
            await mostrarModal('Error', 'Error al registrar ajuste.', err.message || '');
        }
    });

    
    // 10) AUDITORÍA (Facturas / Movimientos) - paginación server-side + filtros
    const ITEMS_AUDITORIA_POR_PAGINA = 15;
    let paginaAuditFacturas = 1;
    let totalAuditFacturas = 0;
    let paginaAuditMovimientos = 1;
    let totalAuditMovimientos = 0;

    function setSubtabAuditoria(tipo) {
        setActivo(subtabFacturas, tipo === 'facturas');
        setActivo(subtabMovimientos, tipo === 'movimientos');

        seccionAuditFacturas.classList.toggle('activa', tipo === 'facturas');
        seccionAuditMovimientos.classList.toggle('activa', tipo === 'movimientos');

        // Cargar la subtabla activa (respeta filtros/paginación)
        if (tipo === 'facturas') cargarAuditoriaFacturas();
        if (tipo === 'movimientos') cargarAuditoriaMovimientos();
    }

    function obtenerFiltrosFacturasDesdeUI() {
        const fecha = (filtroFactFecha && filtroFactFecha.value) ? filtroFactFecha.value : '';
        const idProveedor = (filtroFactProveedor && filtroFactProveedor.value) ? parseInt(filtroFactProveedor.value, 10) : null;
        const nroComprobante = (filtroFactNro && filtroFactNro.value) ? filtroFactNro.value.trim() : '';
        return { fecha, idProveedor, nroComprobante };
    }

    function obtenerFiltrosMovimientosDesdeUI() {
        const fecha = (filtroMovFecha && filtroMovFecha.value) ? filtroMovFecha.value : '';
        const idProducto = (filtroMovProducto && filtroMovProducto.dataset.idProducto) ? parseInt(filtroMovProducto.dataset.idProducto, 10) : null;
        const tipoMovimiento = (filtroMovTipo && filtroMovTipo.value) ? filtroMovTipo.value.trim() : '';
        const idUsuario = (filtroMovUsuario && filtroMovUsuario.value) ? parseInt(filtroMovUsuario.value, 10) : null;
        return { fecha, idProducto, tipoMovimiento, idUsuario };
    }

    function actualizarPaginacionAuditFacturas() {
        if (!pagAuditFacturas) return;

        const totalPaginas = Math.ceil((totalAuditFacturas || 0) / ITEMS_AUDITORIA_POR_PAGINA) || 1;
        pagAuditFacturas.style.display = totalPaginas > 1 ? 'flex' : 'none';
        if (infoPaginaAuditFacturas) infoPaginaAuditFacturas.textContent = `Página ${paginaAuditFacturas} de ${totalPaginas}`;
        if (btnPrevAuditFacturas) btnPrevAuditFacturas.disabled = (paginaAuditFacturas === 1);
        if (btnNextAuditFacturas) btnNextAuditFacturas.disabled = (paginaAuditFacturas >= totalPaginas);
    }

    function actualizarPaginacionAuditMovimientos() {
        if (!pagAuditMovimientos) return;

        const totalPaginas = Math.ceil((totalAuditMovimientos || 0) / ITEMS_AUDITORIA_POR_PAGINA) || 1;
        pagAuditMovimientos.style.display = totalPaginas > 1 ? 'flex' : 'none';
        if (infoPaginaAuditMovimientos) infoPaginaAuditMovimientos.textContent = `Página ${paginaAuditMovimientos} de ${totalPaginas}`;
        if (btnPrevAuditMovimientos) btnPrevAuditMovimientos.disabled = (paginaAuditMovimientos === 1);
        if (btnNextAuditMovimientos) btnNextAuditMovimientos.disabled = (paginaAuditMovimientos >= totalPaginas);
    }

    async function cargarAuditoriaFacturas() {
        if (vistaAuditoria.style.display !== 'block') return;

        try {
            const filtros = obtenerFiltrosFacturasDesdeUI();
            const res = await window.electronAPI.getFacturas({
                pagina: paginaAuditFacturas,
                limite: ITEMS_AUDITORIA_POR_PAGINA,
                fecha: filtros.fecha || null,
                idProveedor: filtros.idProveedor,
                nroComprobante: filtros.nroComprobante || null
            });

            const filas = (res && Array.isArray(res.rows)) ? res.rows : [];
            totalAuditFacturas = (res && Number.isFinite(res.total)) ? res.total : (parseInt(res.total, 10) || 0);

            renderFacturas(filas);
            actualizarPaginacionAuditFacturas();
        } catch (e) {
            console.error('Error audit facturas:', e);
        }
    }

    async function cargarAuditoriaMovimientos() {
        if (vistaAuditoria.style.display !== 'block') return;

        try {
            const filtros = obtenerFiltrosMovimientosDesdeUI();
            const res = await window.electronAPI.getMovimientosStock({
                pagina: paginaAuditMovimientos,
                limite: ITEMS_AUDITORIA_POR_PAGINA,
                fecha: filtros.fecha || null,
                idProducto: filtros.idProducto,
                tipoMovimiento: filtros.tipoMovimiento || null,
                idUsuario: filtros.idUsuario
            });

            const filas = (res && Array.isArray(res.rows)) ? res.rows : [];
            totalAuditMovimientos = (res && Number.isFinite(res.total)) ? res.total : (parseInt(res.total, 10) || 0);

            renderMovimientos(filas);
            actualizarPaginacionAuditMovimientos();
        } catch (e) {
            console.error('Error audit movimientos:', e);
        }
    }

    async function cargarAuditoria() {
        if (vistaAuditoria.style.display !== 'block') return;
        await cargarAuditoriaFacturas();
        await cargarAuditoriaMovimientos();
    }

    function renderFacturas(facturas) {
        tbodyAuditFacturas.innerHTML = '';
        if (!facturas.length) {
            tbodyAuditFacturas.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Sin facturas registradas.</td></tr>';
            return;
        }

        facturas.forEach(f => {
            const tr = document.createElement('tr');
            tr.dataset.idFactura = f.idFactura;

            tr.innerHTML = `
                <td>${formatoFechaSimple(f.fecha)}</td>
                <td>${escapeHtml(f.proveedor || '-')}</td>
                <td>${escapeHtml(f.nroComprobante || '-')}</td>
                <td>${formatearMoneda(f.importe || 0)}</td>
                <td>${f.cantidadItems || 0}</td>
                <td><button type="button" class="btn-mini btn-ver-detalle">Ver</button></td>
            `;
            tbodyAuditFacturas.appendChild(tr);
        });
    }

    function renderMovimientos(movs) {
        tbodyAuditMovimientos.innerHTML = '';
        if (!movs.length) {
            tbodyAuditMovimientos.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Sin movimientos.</td></tr>';
            return;
        }

        movs.forEach(m => {
            const tr = document.createElement('tr');

            const esFiltroMov = (m.tipoProducto || '').toLowerCase().includes('filtro');

            let deltaTexto, antesTexto, despuesTexto;
            if (esFiltroMov) {
                // Filtros: valores ya son unidades enteras
                deltaTexto = `${m.cantidad || 0} Un.`;
                antesTexto = `${m.datoAnterior || 0} Un.`;
                despuesTexto = `${m.datoActual || 0} Un.`;
            } else {
                // Líquidos: convertir ml a litros
                const deltaL = (m.cantidad || 0) / 1000;
                const antesL = (m.datoAnterior || 0) / 1000;
                const despuesL = (m.datoActual || 0) / 1000;
                deltaTexto = `${deltaL.toFixed(2)} Lts.`;
                antesTexto = `${antesL.toFixed(2)} Lts.`;
                despuesTexto = `${despuesL.toFixed(2)} Lts.`;
            }

            let origen = m.proceso || '-';
            let origenHtml = '';
            if (m.idFactura) {
                origen = `FACT ${m.nroFactura || ''}`.trim();
                origenHtml = escapeHtml(origen);
            } else if (m.idServicio) {
                let origenDetalle = '';
                try {
                    const detalleObj = m.detalleMovimiento ? JSON.parse(m.detalleMovimiento) : null;
                    origenDetalle = ((detalleObj && detalleObj.origen) || '').toString().toUpperCase();
                } catch (_) {
                    origenDetalle = '';
                }

                const proceso = (m.proceso || '').toString().toUpperCase();
                const patenteServicio = (m.patenteServicio || '').toString().toUpperCase();
                const esVentaParticular = proceso === 'VENTA PARTICULAR' || origenDetalle === 'VENTA PARTICULAR' || patenteServicio === 'VENTA PARTICULAR';

                if (esVentaParticular) {
                    origen = 'VENTA PARTICULAR';
                } else {
                    origen = `SERVICIO ${m.patenteServicio || ''}`.trim();
                }
                origenHtml = escapeHtml(origen);
            } else if ((m.tipoMovimiento || '').toUpperCase() === 'AJUSTE' && m.detalleMovimiento) {
                origenHtml = `${escapeHtml(origen)} <button class="btn-ver-ajuste btn-mini" style="padding:2px 8px; font-size:0.75em; margin-left:6px;" data-detalle='${escapeHtml(m.detalleMovimiento)}'>Ver</button>`;
            } else {
                origenHtml = escapeHtml(origen);
            }

            const fechaRender = (m.idServicio && m.fechaServicio) ? m.fechaServicio : m.fecha;

            tr.innerHTML = `
                <td>${formatoFechaSimple(fechaRender)}</td>
                <td>${escapeHtml(m.producto || '-')}</td>
                <td>${escapeHtml(m.tipoMovimiento || '-')}</td>
                <td>${deltaTexto}</td>
                <td>${antesTexto}</td>
                <td>${despuesTexto}</td>
                <td>${origenHtml}</td>
                <td>${escapeHtml(m.usuario || '-')}</td>
            `;
            tbodyAuditMovimientos.appendChild(tr);
        });
    }

    // Ver detalle ajuste (auditoría movimientos)
    tbodyAuditMovimientos.addEventListener('click', async (e) => {
        const btnAjuste = e.target.closest('.btn-ver-ajuste');
        if (btnAjuste) {
            try {
                const raw = btnAjuste.dataset.detalle || '{}';
                const info = JSON.parse(raw);
                const modalAjuste = document.getElementById('modal-detalle-ajuste');
                const contenido = document.getElementById('detalle-ajuste-contenido');
                if (modalAjuste && contenido) {
                    contenido.textContent = `Motivo: ${info.motivo || '-'}\nDetalle: ${info.detalle || '-'}`;
                    modalAjuste.style.display = 'flex';
                }
            } catch (err) {
                console.error('Error parseando detalle ajuste:', err);
            }
            return;
        }
    });

    // Modal cerrar detalle ajuste
    const btnCerrarDetalleAjuste = document.getElementById('btn-cerrar-detalle-ajuste');
    const modalDetalleAjuste = document.getElementById('modal-detalle-ajuste');
    if (btnCerrarDetalleAjuste) {
        btnCerrarDetalleAjuste.addEventListener('click', () => {
            modalDetalleAjuste.style.display = 'none';
        });
    }
    if (modalDetalleAjuste) {
        modalDetalleAjuste.addEventListener('click', (e) => {
            if (e.target === modalDetalleAjuste) modalDetalleAjuste.style.display = 'none';
        });
    }

    // Ver detalle factura
    tbodyAuditFacturas.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-ver-detalle');
        if (!btn) return;

        const tr = e.target.closest('tr[data-id-factura], tr[data-idFactura], tr');
        const idFactura = tr ? parseInt(tr.dataset.idFactura, 10) : null;
        if (!idFactura) return;

        try {
            const detalle = await window.electronAPI.getFacturaDetalle(idFactura);
            abrirModalDetalleFactura(idFactura, detalle || []);
        } catch (err) {
            console.error(err);
            await mostrarModal('Error', 'No se pudo cargar el detalle de la factura.');
        }
    });

    function abrirModalDetalleFactura(idFactura, items) {
        detalleFacturaTitulo.textContent = `Detalle de Factura #${idFactura}`;
        detalleFacturaSubtitulo.textContent = 'Ítems registrados en itemFactura (auditables).';
        facturaDetalleActualId = idFactura;

        detalleFacturaBody.innerHTML = '';
        let totalFactura = 0;
        if (!items.length) {
            detalleFacturaBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 16px;">Sin ítems.</td></tr>';
        } else {
            items.forEach(it => {
                totalFactura += Number(it.precioTotal || 0);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(it.nombre || '-')}</td>
                    <td>${escapeHtml(it.tipoEnvase || '-')}</td>
                    <td>${it.cantidad || 0}</td>
                    <td>${formatearMoneda(it.precioUnitario || 0)}</td>
                    <td>${formatearMoneda(it.precioTotal || 0)}</td>
                `;
                detalleFacturaBody.appendChild(tr);
            });
        }

        if (detalleFacturaTotal) {
            detalleFacturaTotal.textContent = formatearMoneda(totalFactura);
        }

        modalDetalleFactura.style.display = 'flex';
    }

    if (btnDescargarDetalleFactura) {
        btnDescargarDetalleFactura.addEventListener('click', async () => {
            if (!facturaDetalleActualId) return;

            const textoOriginal = btnDescargarDetalleFactura.textContent;
            btnDescargarDetalleFactura.disabled = true;
            btnDescargarDetalleFactura.textContent = 'Descargando...';

            let modalResultado = null;

            try {
                const res = await window.electronAPI.downloadFacturaPdf({ idFactura: facturaDetalleActualId });

                if (res && res.success) {
                    modalResultado = {
                        tipo: 'aviso',
                        titulo: 'PDF generado',
                        mensaje: 'El detalle de la factura se descargó correctamente en la carpeta Descargas.',
                        submensaje: res.path || ''
                    };
                } else {
                    modalResultado = {
                        tipo: 'aviso',
                        titulo: 'Error',
                        mensaje: (res && res.error) ? res.error : 'No se pudo descargar el PDF.'
                    };
                }
            } catch (error) {
                console.error('Error al descargar PDF de factura:', error);
                modalResultado = {
                    tipo: 'aviso',
                    titulo: 'Error',
                    mensaje: error.message || 'No se pudo descargar el PDF.'
                };
            } finally {
                btnDescargarDetalleFactura.disabled = false;
                btnDescargarDetalleFactura.textContent = textoOriginal;
            }

            modalDetalleFactura.style.display = 'none';
            if (modalResultado) {
                await mostrarModal(modalResultado.titulo, modalResultado.mensaje, modalResultado.submensaje || '');
            }
        });
    }

    btnCerrarDetalleFactura.addEventListener('click', () => {
        modalDetalleFactura.style.display = 'none';
    });

    modalDetalleFactura.addEventListener('click', (e) => {
        if (e.target === modalDetalleFactura) {
            modalDetalleFactura.style.display = 'none';
        }
    });

    // Subtabs auditoría
    subtabFacturas.addEventListener('click', () => setSubtabAuditoria('facturas'));
    subtabMovimientos.addEventListener('click', () => setSubtabAuditoria('movimientos'));

    // Paginación Facturas
    if (btnPrevAuditFacturas) {
        btnPrevAuditFacturas.addEventListener('click', () => {
            if (paginaAuditFacturas > 1) {
                paginaAuditFacturas--;
                cargarAuditoriaFacturas();
            }
        });
    }
    if (btnNextAuditFacturas) {
        btnNextAuditFacturas.addEventListener('click', () => {
            const totalPaginas = Math.ceil((totalAuditFacturas || 0) / ITEMS_AUDITORIA_POR_PAGINA) || 1;
            if (paginaAuditFacturas < totalPaginas) {
                paginaAuditFacturas++;
                cargarAuditoriaFacturas();
            }
        });
    }

    // Paginación Movimientos
    if (btnPrevAuditMovimientos) {
        btnPrevAuditMovimientos.addEventListener('click', () => {
            if (paginaAuditMovimientos > 1) {
                paginaAuditMovimientos--;
                cargarAuditoriaMovimientos();
            }
        });
    }
    if (btnNextAuditMovimientos) {
        btnNextAuditMovimientos.addEventListener('click', () => {
            const totalPaginas = Math.ceil((totalAuditMovimientos || 0) / ITEMS_AUDITORIA_POR_PAGINA) || 1;
            if (paginaAuditMovimientos < totalPaginas) {
                paginaAuditMovimientos++;
                cargarAuditoriaMovimientos();
            }
        });
    }

    // Filtros Facturas
    function aplicarFiltrosFacturas() {
        paginaAuditFacturas = 1;
        cargarAuditoriaFacturas();
    }

    if (filtroFactFecha) filtroFactFecha.addEventListener('change', aplicarFiltrosFacturas);
    if (filtroFactProveedor) filtroFactProveedor.addEventListener('change', aplicarFiltrosFacturas);
    if (filtroFactNro) filtroFactNro.addEventListener('input', aplicarFiltrosFacturas);

    if (btnLimpiarFiltrosFact) {
        btnLimpiarFiltrosFact.addEventListener('click', () => {
            if (filtroFactFecha) filtroFactFecha.value = '';
            if (filtroFactProveedor) filtroFactProveedor.value = '';
            if (filtroFactNro) filtroFactNro.value = '';
            paginaAuditFacturas = 1;
            cargarAuditoriaFacturas();
        });
    }

    // Filtros Movimientos
    function aplicarFiltrosMovimientos() {
        paginaAuditMovimientos = 1;
        cargarAuditoriaMovimientos();
    }

    if (filtroMovFecha) filtroMovFecha.addEventListener('change', aplicarFiltrosMovimientos);
    // filtroMovProducto: búsqueda predictiva con eventos propios (ver abajo)
    if (filtroMovTipo) filtroMovTipo.addEventListener('change', aplicarFiltrosMovimientos);
    if (filtroMovUsuario) filtroMovUsuario.addEventListener('change', aplicarFiltrosMovimientos);

    // --- Búsqueda predictiva para filtro Producto en Movimientos ---
    const divResultadosFiltroMov = document.getElementById('resultados-filtro-mov-producto');

    function renderResultadosFiltroMov(termino) {
        const lista = buscarProductosFactura(termino);
        if (!lista.length) {
            if (divResultadosFiltroMov) { divResultadosFiltroMov.innerHTML = ''; divResultadosFiltroMov.style.display = 'none'; }
            return;
        }
        divResultadosFiltroMov.innerHTML = lista.map(p => {
            const titulo = escapeHtml(textoProductoFactura(p) || '-');
            const envase = escapeHtml(p.tipoEnvase || '');
            return `<div class="item-resultado" data-id-producto="${p.idProducto}"><strong>${titulo}</strong>${envase ? `<small>${envase}</small>` : ''}</div>`;
        }).join('');
        divResultadosFiltroMov.style.display = 'block';
    }

    if (filtroMovProducto) {
        filtroMovProducto.dataset.idProducto = '';

        filtroMovProducto.addEventListener('focus', () => {
            renderResultadosFiltroMov(filtroMovProducto.value);
        });

        filtroMovProducto.addEventListener('input', () => {
            filtroMovProducto.dataset.idProducto = '';
            renderResultadosFiltroMov(filtroMovProducto.value);
        });

        if (divResultadosFiltroMov) {
            divResultadosFiltroMov.addEventListener('click', (e) => {
                const item = e.target.closest('.item-resultado');
                if (!item) return;
                const idProd = parseInt(item.dataset.idProducto, 10);
                const prod = productosCache.find(p => p.idProducto === idProd);
                if (!prod) return;
                filtroMovProducto.value = textoProductoFactura(prod);
                filtroMovProducto.dataset.idProducto = String(idProd);
                divResultadosFiltroMov.style.display = 'none';
                aplicarFiltrosMovimientos();
            });
        }

        // Cerrar lista al hacer click fuera
        document.addEventListener('click', (e) => {
            if (divResultadosFiltroMov && !filtroMovProducto.contains(e.target) && !divResultadosFiltroMov.contains(e.target)) {
                divResultadosFiltroMov.style.display = 'none';
            }
        });
    }

    if (btnLimpiarFiltrosMov) {
        btnLimpiarFiltrosMov.addEventListener('click', () => {
            if (filtroMovFecha) filtroMovFecha.value = '';
            if (filtroMovProducto) { filtroMovProducto.value = ''; filtroMovProducto.dataset.idProducto = ''; }
            if (divResultadosFiltroMov) divResultadosFiltroMov.style.display = 'none';
            if (filtroMovTipo) filtroMovTipo.value = '';
            if (filtroMovUsuario) filtroMovUsuario.value = '';
            paginaAuditMovimientos = 1;
            cargarAuditoriaMovimientos();
        });
    }


    // 11) NAVEGACIÓN TABS (PRODUCTOS / FACTURA / AJUSTE / AUDITORÍA)
    tabProductos.addEventListener('click', () => {
        mostrarSeccion('productos');
        setSubtabAuditoria('facturas');
    });

    tabFactura.addEventListener('click', async () => {
        mostrarSeccion('factura');
        setSubtabAuditoria('facturas');

        // Si venís de crear/editar productos, refrescamos cache para que aparezcan al instante en la factura
        await cargarProductosCache();
    });

    tabAjuste.addEventListener('click', () => {
        mostrarSeccion('ajuste');
        setSubtabAuditoria('facturas');
    });

    tabAuditoria.addEventListener('click', async () => {
        mostrarSeccion('auditoria');
        setSubtabAuditoria('facturas');

        // Refrescar filtros (por si cambió la BD en otra pestaña)
        await cargarProveedores();
        await cargarProductosCache();
        await cargarUsuariosCache();

        await cargarAuditoria();
    });

    // 12) CERRAR SESIÓN
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            const confirmar = await mostrarModal('Cerrar Sesión', '¿Seguro que desea cerrar sesión y salir?', 'Se cerrará la sesión actual.', 'confirmar', 'Cerrar Sesión');
            if (confirmar) {
                window.location.href = '../moduloLogin/login/login.html';
            }
        });
    }

    // 13) INICIALIZACIÓN
    // Ocultar pestaña Ajuste si el usuario no es Administrador (idRol !== 1)
    try {
        const rolUsuario = localStorage.getItem('usuarioRol');
        if (rolUsuario && rolUsuario !== '1') {
            if (tabAjuste) tabAjuste.style.display = 'none';
        }
    } catch (e) {
        console.warn('No se pudo verificar el rol del usuario:', e);
    }

    await cargarProveedores();
    await cargarMarcasProducto();
    await cargarProductosCache();
    await cargarUsuariosCache();

    // Factura: fecha + primer ítem
    setFechaFacturaHoy();
    tbodyItemsFactura.innerHTML = '';
    tbodyItemsFactura.appendChild(crearFilaItemFactura());
    recalcularTotalFactura();

    // Listado inicial
    limpiarFormularioProducto();
    await listarProductos();
});
