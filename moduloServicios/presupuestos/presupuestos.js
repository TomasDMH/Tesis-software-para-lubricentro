// MÓDULO PRESUPUESTOS (Frontend)
// Creación, listado, gestión de presupuestos + ABM Tipos de Servicio.
// Incluye selector de Productos/Insumos con cálculo por litros/unidades.

document.addEventListener('DOMContentLoaded', async () => {
    // MODAL
    const modal = document.getElementById('modal-sistema');
    const elTitulo = document.getElementById('modal-titulo');
    const elMensaje = document.getElementById('modal-mensaje');
    const elSubMensaje = document.getElementById('modal-submensaje');

    function mostrarModal(config) {
        return new Promise((resolve) => {
            const btnSi = document.getElementById('btn-modal-confirmar');
            const btnNo = document.getElementById('btn-modal-cancelar');

            elTitulo.textContent = config.titulo || 'Atención';
            elMensaje.textContent = config.mensaje || '';
            elSubMensaje.textContent = config.submensaje || '';

            btnSi.className = 'modal-btn';
            btnSi.textContent = config.textoConfirmar || 'Aceptar';

            if (config.tipo === 'eliminar') {
                btnSi.classList.add('confirmar');
            } else {
                btnSi.classList.add('aceptar');
            }

            if (config.tipo === 'aviso') {
                btnNo.style.display = 'none';
            } else {
                btnNo.style.display = 'block';
                btnNo.textContent = 'Cancelar';
            }

            modal.style.display = 'flex';

            const nuevoSi = btnSi.cloneNode(true);
            const nuevoNo = btnNo.cloneNode(true);
            btnSi.replaceWith(nuevoSi);
            btnNo.replaceWith(nuevoNo);

            nuevoSi.addEventListener('click', () => { modal.style.display = 'none'; resolve(true); });
            nuevoNo.addEventListener('click', () => { modal.style.display = 'none'; resolve(false); });
            nuevoSi.focus();
        });
    }

    // UTILIDADES
    function escapeHtml(str) {
        return (str || '').toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatearMoneda(valor) {
        const n = Math.round(Number(valor || 0));
        const s = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return '$' + s;
    }

    function formatoFechaSimple(isoDate) {
        if (!isoDate) return '-';
        const str = isoDate.toString().trim();
        const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        return str.slice(0, 10);
    }

    function normalizarPatente(valor) {
        return (valor || '').toString().replace(/\s+/g, '').toUpperCase();
    }

    function leerPresupuestoDestino() {
        const raw = sessionStorage.getItem('presuDestino');
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.error('No se pudo leer presuDestino:', error);
            sessionStorage.removeItem('presuDestino');
            return null;
        }
    }

    function extraerCapacidadLitrosEnvase(tipoEnvase) {
        if (!tipoEnvase) return null;
        if (tipoEnvase.toString().toLowerCase().includes('caja')) return 1;
        const match = tipoEnvase.toString().toLowerCase().match(/(\d+)\s*(?:l|lt|lts)/i);
        return match ? parseInt(match[1], 10) : null;
    }

    // SUB-PESTAÑAS: Crear Presupuesto / Tipos de Servicio (estilo Stock)
    const tabCrear = document.getElementById('tab-crear-presupuesto');
    const tabTipos = document.getElementById('tab-tipos-servicio');
    const vistaCrear = document.getElementById('vista-crear-presupuesto');
    const vistaTipos = document.getElementById('vista-tipos-servicio');

    tabCrear.addEventListener('click', async () => {
        vistaCrear.style.display = 'flex';
        vistaTipos.style.display = 'none';
        tabCrear.classList.add('activa');
        tabTipos.classList.remove('activa');
        // Refrescar select con precios actualizados
        await cargarTiposServicio();
        poblarSelectTipo();
    });
    tabTipos.addEventListener('click', () => {
        vistaCrear.style.display = 'none';
        vistaTipos.style.display = 'flex';
        tabTipos.classList.add('activa');
        tabCrear.classList.remove('activa');
        cargarListaTipos();
    });

    // REFERENCIAS DOM — CREAR PRESUPUESTO
    const inputBuscarCliente = document.getElementById('presu-buscar-cliente');
    const divResultadosCliente = document.getElementById('presu-resultados-cliente');
    const spanClienteNombre = document.getElementById('presu-cliente-nombre');
    const spanClienteDni = document.getElementById('presu-cliente-dni');
    const inputObservaciones = document.getElementById('presu-observaciones');
    const selectTipoGlobal = document.getElementById('presu-select-tipo');
    const btnAgregarItem = document.getElementById('btn-agregar-item-presu');
    const tbodyItems = document.getElementById('presu-items-body');
    const placeholderItems = document.getElementById('presu-items-placeholder');
    const spanTotal = document.getElementById('presu-total');
    const btnGuardar = document.getElementById('btn-guardar-presu');
    const tituloForm = document.getElementById('titulo-form-presupuesto');

    // Productos
    const inputBuscarProducto = document.getElementById('presu-buscar-producto');
    const divResultadosProducto = document.getElementById('presu-resultados-producto');
    const tbodyProductos = document.getElementById('presu-productos-body');
    const placeholderProductos = document.getElementById('presu-productos-placeholder');

    const tbodyLista = document.getElementById('presu-lista-body');
    const selectFiltroEstado = document.getElementById('presu-filtro-estado');
    const btnRecargar = document.getElementById('btn-recargar-presu');

    // ESTADO
    let tiposServicioCache = [];
    let productosCache = [];
    let clienteSeleccionado = null;
    let presupuestosCache = [];
    let presupuestoDestino = leerPresupuestoDestino();

    function enfocarPresupuestoDestino() {
        if (!presupuestoDestino) return;

        const patenteDestino = normalizarPatente(presupuestoDestino.patente);
        const filas = Array.from(tbodyLista.querySelectorAll('tr[data-id]'));
        const fila = filas.find(tr => {
            const mismoId = presupuestoDestino.idPresupuesto && tr.dataset.id === String(presupuestoDestino.idPresupuesto);
            const mismaPatente = patenteDestino && tr.dataset.patente === patenteDestino;
            return mismoId || mismaPatente;
        });

        if (!fila) return;

        filas.forEach(tr => {
            tr.style.background = '';
            tr.style.boxShadow = '';
        });

        fila.style.background = 'rgba(46, 125, 50, 0.18)';
        fila.style.boxShadow = 'inset 0 0 0 1px rgba(250, 176, 98, 0.45)';
        fila.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const btnRegistrar = fila.querySelector('button[data-accion="registrar"]');
        if (btnRegistrar) btnRegistrar.focus();

        sessionStorage.removeItem('presuDestino');
        presupuestoDestino = null;
    }

    // TIPOS DE SERVICIO (datos)
    async function cargarTiposServicio() {
        try {
            tiposServicioCache = await window.electronAPI.getTiposServicio();
            if (!Array.isArray(tiposServicioCache)) tiposServicioCache = [];
        } catch (e) {
            tiposServicioCache = [];
            console.error('Error cargando tipos servicio:', e);
        }
    }

    function poblarSelectTipo() {
        selectTipoGlobal.innerHTML = '<option value="">Seleccionar tipo</option>';
        tiposServicioCache.forEach(ts => {
            const opt = document.createElement('option');
            opt.value = ts.idTipoServicio;
            opt.dataset.precio = ts.precioBase || 0;
            opt.dataset.nombre = ts.nombre;
            opt.textContent = ts.nombre;
            selectTipoGlobal.appendChild(opt);
        });
    }

    // PRODUCTOS CACHE
    async function cargarProductosCache() {
        try {
            const data = await window.electronAPI.getProducts({ busqueda: '' });
            productosCache = Array.isArray(data) ? data : (data.rows || []);
            productosCache.sort((a, b) => (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' }));
        } catch (e) {
            productosCache = [];
            console.error('Error cargando productos:', e);
        }
    }

    function buscarProductos(termino) {
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

    function textoProducto(prod) {
        if (!prod) return '';
        const nombre = (prod.nombre || '').trim();
        const marca = (prod.marca || '').trim();
        return marca ? `${nombre} - ${marca}` : nombre;
    }

    const FACTOR_GANANCIA_PRODUCTOS = 1.2;

    /** Calcula precio por litro (o por unidad para filtros) usando producto.precio y tipoEnvase */
    function precioPorLitro(prod) {
        if (!prod || !prod.precio) return 0;
        const esFiltro = (prod.tipo || '').toLowerCase().includes('filtro');
        if (esFiltro) return prod.precio * FACTOR_GANANCIA_PRODUCTOS; // precio por unidad
        const cap = extraerCapacidadLitrosEnvase(prod.tipoEnvase);
        if (cap && cap > 0) return (prod.precio / cap) * FACTOR_GANANCIA_PRODUCTOS;
        return prod.precio * FACTOR_GANANCIA_PRODUCTOS; // sin envase conocido, se usa precio tal cual
    }

    // ÍTEMS DEL PRESUPUESTO (Tipos de Servicio)
    function actualizarPlaceholder() {
        const filas = tbodyItems.querySelectorAll('tr:not(#presu-items-placeholder)');
        if (placeholderItems) placeholderItems.style.display = filas.length > 0 ? 'none' : '';
    }

    function recalcularTotal() {
        let total = 0;
        // Sumar servicios
        tbodyItems.querySelectorAll('tr:not(#presu-items-placeholder)').forEach(tr => {
            total += parseFloat(tr.dataset.precio || 0);
        });
        // Sumar productos
        tbodyProductos.querySelectorAll('tr:not(#presu-productos-placeholder)').forEach(tr => {
            total += parseFloat(tr.dataset.subtotal || 0);
        });
        spanTotal.textContent = formatearMoneda(total);
    }

    btnAgregarItem.addEventListener('click', () => {
        const opt = selectTipoGlobal.options[selectTipoGlobal.selectedIndex];
        if (!opt || !opt.value) return;

        const yaExiste = tbodyItems.querySelector(`tr[data-id-tipo="${opt.value}"]`);
        if (yaExiste) return;

        const tr = document.createElement('tr');
        tr.dataset.idTipo = opt.value;
        tr.dataset.precio = opt.dataset.precio || 0;
        tr.dataset.nombre = opt.dataset.nombre || opt.textContent;

        const tdServ = document.createElement('td');
        tdServ.textContent = opt.dataset.nombre || opt.textContent;

        const tdPrecio = document.createElement('td');
        tdPrecio.textContent = formatearMoneda(opt.dataset.precio || 0);

        const tdAcc = document.createElement('td');
        const btnQuitar = document.createElement('button');
        btnQuitar.type = 'button';
        btnQuitar.className = 'btn-mini peligro';
        btnQuitar.textContent = 'X';
        btnQuitar.style.fontSize = '0.8em';
        btnQuitar.addEventListener('click', () => {
            tr.remove();
            actualizarPlaceholder();
            recalcularTotal();
        });
        tdAcc.appendChild(btnQuitar);

        tr.appendChild(tdServ);
        tr.appendChild(tdPrecio);
        tr.appendChild(tdAcc);
        tbodyItems.appendChild(tr);

        selectTipoGlobal.selectedIndex = 0;
        actualizarPlaceholder();
        recalcularTotal();
    });

    // PRODUCTOS DEL PRESUPUESTO (búsqueda predictiva + cantidad)
    function actualizarPlaceholderProductos() {
        const filas = tbodyProductos.querySelectorAll('tr:not(#presu-productos-placeholder)');
        if (placeholderProductos) placeholderProductos.style.display = filas.length > 0 ? 'none' : '';
    }

    function agregarProductoAlPresupuesto(prod, cantidadInicial) {
        if (!prod) return;
        // Evitar duplicados por idProducto
        const yaExiste = tbodyProductos.querySelector(`tr[data-id-producto="${prod.idProducto}"]`);
        if (yaExiste) return;

        const esFiltro = (prod.tipo || '').toLowerCase().includes('filtro');
        const precioUnit = precioPorLitro(prod);
        const cantInit = cantidadInicial || (esFiltro ? 1 : 1);

        const tr = document.createElement('tr');
        tr.dataset.idProducto = prod.idProducto;
        tr.dataset.precioUnit = precioUnit;
        tr.dataset.subtotal = Math.round(precioUnit * cantInit);
        tr.dataset.esFiltro = esFiltro ? '1' : '0';

        const tdNombre = document.createElement('td');
        const nombreTexto = textoProducto(prod);
        const envaseTexto = prod.tipoEnvase ? ` (${prod.tipoEnvase})` : '';
        tdNombre.innerHTML = `<strong>${escapeHtml(nombreTexto)}</strong><br><small style="color:#bbb;">${escapeHtml(envaseTexto)}</small>`;

        const tdCant = document.createElement('td');
        const inputCant = document.createElement('input');
        inputCant.type = 'number';
        inputCant.min = esFiltro ? '1' : '0.1';
        inputCant.step = esFiltro ? '1' : '0.1';
        inputCant.value = cantInit;
        inputCant.style.width = '70px';
        inputCant.style.padding = '5px 8px';
        inputCant.style.border = '1px solid rgba(250,176,98,0.4)';
        inputCant.style.borderRadius = '4px';
        inputCant.style.background = '#fffbe6';
        inputCant.style.color = '#3a3a3a';
        inputCant.style.textAlign = 'center';
        inputCant.title = esFiltro ? 'Unidades' : 'Litros';
        tdCant.appendChild(inputCant);
        if (!esFiltro) {
            const labelLts = document.createElement('small');
            labelLts.style.color = '#bbb';
            labelLts.style.marginLeft = '4px';
            labelLts.textContent = 'Lts';
            tdCant.appendChild(labelLts);
        } else {
            const labelUn = document.createElement('small');
            labelUn.style.color = '#bbb';
            labelUn.style.marginLeft = '4px';
            labelUn.textContent = 'Un.';
            tdCant.appendChild(labelUn);
        }

        const tdPU = document.createElement('td');
        tdPU.textContent = formatearMoneda(precioUnit);
        tdPU.title = esFiltro ? 'Precio por unidad' : 'Precio por litro';

        const tdSub = document.createElement('td');
        tdSub.className = 'celda-subtotal-prod';
        tdSub.textContent = formatearMoneda(Math.round(precioUnit * cantInit));

        const tdAcc = document.createElement('td');
        const btnQuitar = document.createElement('button');
        btnQuitar.type = 'button';
        btnQuitar.className = 'btn-mini peligro';
        btnQuitar.textContent = 'X';
        btnQuitar.style.fontSize = '0.8em';
        btnQuitar.addEventListener('click', () => {
            tr.remove();
            actualizarPlaceholderProductos();
            recalcularTotal();
        });
        tdAcc.appendChild(btnQuitar);

        tr.appendChild(tdNombre);
        tr.appendChild(tdCant);
        tr.appendChild(tdPU);
        tr.appendChild(tdSub);
        tr.appendChild(tdAcc);

        // Recalcular subtotal al cambiar cantidad
        inputCant.addEventListener('input', () => {
            const cant = parseFloat(inputCant.value) || 0;
            const sub = Math.round(precioUnit * cant);
            tr.dataset.subtotal = sub;
            tdSub.textContent = formatearMoneda(sub);
            recalcularTotal();
        });

        tbodyProductos.appendChild(tr);
        actualizarPlaceholderProductos();
        recalcularTotal();
    }

    // Buscador predictivo de productos
    if (inputBuscarProducto) {
        inputBuscarProducto.addEventListener('focus', async () => {
            await cargarProductosCache();
            renderResultadosProducto(inputBuscarProducto.value);
        });

        inputBuscarProducto.addEventListener('input', () => {
            renderResultadosProducto(inputBuscarProducto.value);
        });
    }

    function renderResultadosProducto(termino) {
        const lista = buscarProductos(termino);
        if (!lista.length) {
            divResultadosProducto.innerHTML = '';
            divResultadosProducto.style.display = 'none';
            return;
        }
        divResultadosProducto.innerHTML = lista.map(p => {
            const titulo = escapeHtml(textoProducto(p) || '-');
            const envase = escapeHtml(p.tipoEnvase || '');
            return `
                <div class="item-resultado" data-id-producto="${p.idProducto}">
                    <strong>${titulo}</strong>
                    ${envase ? `<small style="color:#fab062;">${envase}</small>` : ''}
                </div>
            `;
        }).join('');
        divResultadosProducto.style.display = 'block';
    }

    if (divResultadosProducto) {
        divResultadosProducto.addEventListener('click', (e) => {
            const item = e.target.closest('.item-resultado[data-id-producto]');
            if (!item) return;
            const idProd = parseInt(item.dataset.idProducto, 10);
            const prod = productosCache.find(p => p.idProducto === idProd);
            if (prod) {
                agregarProductoAlPresupuesto(prod);
                inputBuscarProducto.value = '';
                divResultadosProducto.style.display = 'none';
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (divResultadosCliente && inputBuscarCliente && !inputBuscarCliente.contains(e.target) && !divResultadosCliente.contains(e.target)) {
            divResultadosCliente.style.display = 'none';
        }
        if (divResultadosProducto && inputBuscarProducto && !inputBuscarProducto.contains(e.target) && !divResultadosProducto.contains(e.target)) {
            divResultadosProducto.style.display = 'none';
        }
    });

    // BUSCADOR DE CLIENTE (PREDICTIVO)
    function actualizarClienteSeleccionado() {
        if (clienteSeleccionado) {
            spanClienteNombre.textContent = clienteSeleccionado.nombre || '-';
            spanClienteDni.textContent = `DNI: ${clienteSeleccionado.dni || '-'}`;
        } else {
            spanClienteNombre.textContent = '-';
            spanClienteDni.textContent = 'DNI: -';
        }
    }

    if (inputBuscarCliente) {
        inputBuscarCliente.addEventListener('input', async () => {
            const texto = inputBuscarCliente.value.trim();
            if (texto.length < 2) {
                divResultadosCliente.style.display = 'none';
                return;
            }
            try {
                const resultados = await window.electronAPI.searchVehicles(texto);
                divResultadosCliente.innerHTML = '';
                if (resultados && resultados.length > 0) {
                    const patentes = new Set();
                    resultados.forEach(r => {
                        if (r.patente && !patentes.has(r.patente)) {
                            patentes.add(r.patente);
                            const div = document.createElement('div');
                            div.classList.add('item-resultado');
                            div.dataset.id = r.idCliente || r.id || '';
                            div.dataset.nombre = r.nombre || '';
                            div.dataset.dni = r.dni || '';
                            div.dataset.patente = r.patente || '';
                            div.dataset.marca = r.marca || '';
                            div.dataset.modelo = r.modelo || '';
                            div.textContent = `${r.nombre} - ${r.patente} (${r.marca} ${r.modelo})`;
                            divResultadosCliente.appendChild(div);
                        }
                    });
                    divResultadosCliente.style.display = 'block';
                } else {
                    divResultadosCliente.innerHTML = '<div class="item-resultado">Sin resultados</div>';
                    divResultadosCliente.style.display = 'block';
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    if (divResultadosCliente) {
        divResultadosCliente.addEventListener('click', (e) => {
            const item = e.target.closest('.item-resultado[data-patente]');
            if (!item) return;
            clienteSeleccionado = {
                id: item.dataset.id,
                nombre: item.dataset.nombre,
                dni: item.dataset.dni,
                patente: item.dataset.patente,
                vehiculoTexto: `${item.dataset.patente} - ${item.dataset.marca} ${item.dataset.modelo}`
            };
            inputBuscarCliente.value = '';
            actualizarClienteSeleccionado();
            divResultadosCliente.style.display = 'none';
        });
    }

    // GUARDAR PRESUPUESTO
    function limpiarFormulario() {
        clienteSeleccionado = null;
        inputBuscarCliente.value = '';
        actualizarClienteSeleccionado();
        tbodyItems.querySelectorAll('tr:not(#presu-items-placeholder)').forEach(tr => tr.remove());
        tbodyProductos.querySelectorAll('tr:not(#presu-productos-placeholder)').forEach(tr => tr.remove());
        actualizarPlaceholder();
        actualizarPlaceholderProductos();
        spanTotal.textContent = '$0';
        inputObservaciones.value = '';
        inputBuscarProducto.value = '';
        selectTipoGlobal.selectedIndex = 0;
        tituloForm.textContent = 'Nuevo Presupuesto';
    }

    btnGuardar.addEventListener('click', async () => {
        if (!clienteSeleccionado || !clienteSeleccionado.patente) {
            await mostrarModal({ tipo: 'aviso', titulo: 'Atención', mensaje: 'Seleccione un cliente/vehículo.' });
            return;
        }

        const items = [];
        // Items de tipo servicio
        tbodyItems.querySelectorAll('tr:not(#presu-items-placeholder)').forEach(tr => {
            items.push({
                idTipoServicio: parseInt(tr.dataset.idTipo) || null,
                precio: parseFloat(tr.dataset.precio || 0),
                descripcion: tr.dataset.nombre || ''
            });
        });

        // Items de productos
        tbodyProductos.querySelectorAll('tr:not(#presu-productos-placeholder)').forEach(tr => {
            const cantidad = parseFloat(tr.querySelector('input[type="number"]').value) || 0;
            const esFiltro = tr.dataset.esFiltro === '1';
            const prod = productosCache.find(p => p.idProducto === parseInt(tr.dataset.idProducto));
            const nombreProd = prod ? textoProducto(prod) : 'Producto';
            const unidad = esFiltro ? `${cantidad} un.` : `${cantidad} lts`;
            items.push({
                idTipoServicio: null,
                precio: parseFloat(tr.dataset.subtotal || 0),
                descripcion: `${nombreProd} (${unidad})`
            });
        });

        if (items.length === 0) {
            await mostrarModal({ tipo: 'aviso', titulo: 'Atención', mensaje: 'Agregue al menos un ítem o producto.' });
            return;
        }

        const observaciones = (inputObservaciones.value || '').trim();

        try {
            const res = await window.electronAPI.savePresupuesto({
                idCliente: parseInt(clienteSeleccionado.id, 10) || 0,
                patente: clienteSeleccionado.patente,
                items,
                observaciones
            });

            if (res && res.success) {
                await mostrarModal({ tipo: 'aviso', titulo: 'Éxito', mensaje: 'Presupuesto guardado correctamente.' });
                limpiarFormulario();
                await cargarPresupuestos();
            } else {
                await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: res.error || 'No se pudo guardar el presupuesto.' });
            }
        } catch (e) {
            console.error(e);
            await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: e.message || 'Error al guardar presupuesto.' });
        }
    });

    // LISTADO DE PRESUPUESTOS (HISTORIAL)
    async function cargarPresupuestos() {
        try {
            presupuestosCache = await window.electronAPI.getPresupuestos();
            if (!Array.isArray(presupuestosCache)) presupuestosCache = [];
            if (presupuestoDestino) {
                selectFiltroEstado.value = 'Aprobado';
            }
            aplicarFiltroEstado();
            enfocarPresupuestoDestino();
        } catch (e) {
            console.error(e);
            presupuestosCache = [];
            renderPresupuestos([]);
        }
    }

    function aplicarFiltroEstado() {
        const filtro = selectFiltroEstado.value;
        if (!filtro) {
            renderPresupuestos(presupuestosCache);
        } else {
            renderPresupuestos(presupuestosCache.filter(p => p.estado === filtro));
        }
    }

    selectFiltroEstado.addEventListener('change', aplicarFiltroEstado);
    btnRecargar.addEventListener('click', () => cargarPresupuestos());

    function mostrarDetallePresupuesto(presu, items) {
        const existing = document.getElementById('modal-detalle-presu');
        if (existing) existing.remove();

        let itemsHTML = '';
        if (Array.isArray(items) && items.length > 0) {
            itemsHTML = items.map(it => `
                <tr>
                    <td style="padding:7px 10px; border-bottom:1px solid rgba(250,176,98,0.1); color:#fff;">${escapeHtml(it.descripcion || '-')}</td>
                    <td style="padding:7px 10px; border-bottom:1px solid rgba(250,176,98,0.1); color:#fab062; text-align:right; font-weight:bold;">${formatearMoneda(it.precio || 0)}</td>
                </tr>
            `).join('');
        } else {
            itemsHTML = '<tr><td colspan="2" style="text-align:center; color:#bbb; padding:10px;">Sin ítems.</td></tr>';
        }

        const estadoColor = presu.estado === 'Aprobado' ? '#2e7d32' : (presu.estado === 'Rechazado' ? '#e20613' : '#f8cc3d');
        const obsHTML = presu.observaciones ? `<p style="margin:4px 0 12px 0; color:#bbb;"><strong style="color:#fff;">Observaciones:</strong> ${escapeHtml(presu.observaciones)}</p>` : '';

        const overlay = document.createElement('div');
        overlay.id = 'modal-detalle-presu';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;';
        overlay.innerHTML = `
            <div style="background:#01242c;border:1.5px solid #fab062;border-radius:12px;padding:28px 32px;min-width:440px;max-width:92vw;max-height:82vh;overflow-y:auto;color:#fff;">
                <h3 style="color:#fab062;margin:0 0 14px 0;">Detalle de Presupuesto #${presu.idPresupuesto}</h3>
                <p style="margin:4px 0;"><strong>Cliente:</strong> ${escapeHtml(presu.cliente || '-')}</p>
                <p style="margin:4px 0; color:#bbb;"><strong style="color:#fff;">Fecha:</strong> ${formatoFechaSimple(presu.fecha)}</p>
                <p style="margin:4px 0 12px 0;"><strong>Estado:</strong> <span style="color:${estadoColor};font-weight:bold;">${escapeHtml(presu.estado || '-')}</span></p>
                ${obsHTML}
                <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
                    <thead>
                        <tr style="border-bottom:1px solid rgba(250,176,98,0.4);">
                            <th style="text-align:left;padding:7px 10px;color:#fab062;">Ítem</th>
                            <th style="text-align:right;padding:7px 10px;color:#fab062;">Precio</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHTML}</tbody>
                </table>
                <div style="text-align:right;font-size:1.1em;color:#fab062;font-weight:bold;margin-bottom:18px;border-top:1px solid rgba(250,176,98,0.3);padding-top:10px;">
                    Total: ${formatearMoneda(presu.total || 0)}
                </div>
                <div style="display:flex;justify-content:flex-end;gap:10px;">
                    <button type="button" id="btn-descargar-detalle-presu" style="background:#fffbe6;color:#01242c;border:none;border-radius:6px;padding:9px 24px;font-weight:bold;cursor:pointer;font-size:0.95em;">Descargar</button>
                    <button type="button" id="btn-cerrar-detalle-presu" style="background:#fab062;color:#01242c;border:none;border-radius:6px;padding:9px 24px;font-weight:bold;cursor:pointer;font-size:0.95em;">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('btn-descargar-detalle-presu').addEventListener('click', async () => {
            const botonDescargar = document.getElementById('btn-descargar-detalle-presu');
            if (!botonDescargar) return;

            const textoOriginal = botonDescargar.textContent;
            botonDescargar.disabled = true;
            botonDescargar.textContent = 'Descargando...';

            let modalResultado = null;

            try {
                const res = await window.electronAPI.downloadPresupuestoPdf({
                    presupuesto: presu,
                    items
                });

                if (res && res.success) {
                    modalResultado = {
                        tipo: 'aviso',
                        titulo: 'PDF generado',
                        mensaje: 'El detalle del presupuesto se descargó correctamente en la carpeta Descargas.',
                        submensaje: res.path || ''
                    };
                } else {
                    modalResultado = {
                        tipo: 'aviso',
                        titulo: 'Error',
                        mensaje: res.error || 'No se pudo descargar el PDF.'
                    };
                }
            } catch (error) {
                console.error('Error al descargar PDF del presupuesto:', error);
                modalResultado = {
                    tipo: 'aviso',
                    titulo: 'Error',
                    mensaje: error.message || 'No se pudo descargar el PDF.'
                };
            } finally {
                botonDescargar.disabled = false;
                botonDescargar.textContent = textoOriginal;
            }

            // Cerrar el overlay de detalle antes de abrir el modal del sistema para evitar superposición/bloqueo.
            if (overlay && overlay.parentNode) {
                overlay.remove();
            }

            if (modalResultado) {
                await mostrarModal(modalResultado);
            }
        });
        document.getElementById('btn-cerrar-detalle-presu').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    function renderPresupuestos(lista) {
        tbodyLista.innerHTML = '';
        if (!lista || lista.length === 0) {
            tbodyLista.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#bbb;">Sin presupuestos.</td></tr>';
            return;
        }

        lista.forEach(p => {
            const tr = document.createElement('tr');
            tr.dataset.id = p.idPresupuesto;
            tr.dataset.patente = normalizarPatente(p.patente);
            const estadoClass = p.estado === 'Aprobado' ? 'estado-aprobado' : (p.estado === 'Rechazado' ? 'estado-rechazado' : 'estado-pendiente');

            let accionesHTML = `<button type="button" class="btn-ver-presu" data-id="${p.idPresupuesto}" data-accion="ver">Ver</button>`;
            if (p.estado === 'Pendiente') {
                accionesHTML += `
                    <button type="button" class="btn-aprobar" data-id="${p.idPresupuesto}" data-accion="editar">✏️</button>
                    <button type="button" class="btn-aprobar" data-id="${p.idPresupuesto}" data-accion="Aprobado">✓</button>
                    <button type="button" class="btn-rechazar" data-id="${p.idPresupuesto}" data-accion="Rechazado">✗</button>
                `;
            } else if (p.estado === 'Aprobado') {
                accionesHTML += `
                    <button type="button" class="btn-registrar-serv" data-id="${p.idPresupuesto}" data-accion="registrar">Registrar Servicio</button>
                `;
            }
            accionesHTML += `<button type="button" class="btn-eliminar-presu" data-id="${p.idPresupuesto}" data-accion="eliminar">🗑️</button>`;

            tr.innerHTML = `
                <td>${formatoFechaSimple(p.fecha)}</td>
                <td>${escapeHtml(p.cliente || '-')}</td>
                <td class="${estadoClass}">${p.estado || 'Pendiente'}</td>
                <td>${formatearMoneda(p.total || 0)}</td>
                <td><div class="acciones-presupuesto">${accionesHTML}</div></td>
            `;
            tbodyLista.appendChild(tr);
        });
    }

    // Eventos en la tabla de presupuestos (delegación)
    tbodyLista.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-accion]');
        if (!btn) return;

        const idPresupuesto = parseInt(btn.dataset.id, 10);
        const accion = btn.dataset.accion;

        if (accion === 'Aprobado' || accion === 'Rechazado') {
            try {
                await window.electronAPI.updatePresupuestoEstado(idPresupuesto, accion);
                await cargarPresupuestos();
            } catch (e) {
                console.error(e);
                await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'No se pudo actualizar el estado.' });
            }
        } else if (accion === 'eliminar') {
            const confirmar = await mostrarModal({
                tipo: 'eliminar',
                titulo: 'Eliminar Presupuesto',
                mensaje: `¿Eliminar el presupuesto #${idPresupuesto}?`,
                textoConfirmar: 'Eliminar'
            });
            if (confirmar) {
                try {
                    await window.electronAPI.deletePresupuesto(idPresupuesto);
                    await cargarPresupuestos();
                } catch (e) {
                    console.error(e);
                    await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'No se pudo eliminar.' });
                }
            }
        } else if (accion === 'registrar') {
            const presu = presupuestosCache.find(p => p.idPresupuesto === idPresupuesto);
            if (presu) {
                // Obtener detalle completo del presupuesto
                try {
                    const detalleItems = await window.electronAPI.getPresupuestoDetalle(idPresupuesto);
                    const enrichedItems = [];
                    if (Array.isArray(detalleItems)) {
                        for (const it of detalleItems) {
                            if (it.idTipoServicio) {
                                enrichedItems.push({
                                    idTipoServicio: it.idTipoServicio,
                                    tipoServicioNombre: it.tipoServicioNombre || it.descripcion,
                                    precio: it.precio
                                });
                            } else {
                                // Producto: parsear descripción para extraer datos
                                const match = (it.descripcion || '').match(/^(.+?)\s*\((\d+(?:\.\d+)?)\s*(lts|un\.?)\)$/i);
                                if (match) {
                                    const nombreProd = match[1].trim();
                                    const cantidad = parseFloat(match[2]);
                                    const esFiltro = match[3].toLowerCase().startsWith('un');
                                    const prod = productosCache.find(p => {
                                        const texto = p.marca ? `${p.nombre} - ${p.marca}` : p.nombre;
                                        return texto === nombreProd;
                                    });
                                    enrichedItems.push({
                                        idProducto: prod ? prod.idProducto : null,
                                        nombre: nombreProd,
                                        cantidad,
                                        esFiltro,
                                        precio: it.precio
                                    });
                                }
                            }
                        }
                    }
                    sessionStorage.setItem('presuRegistrar', JSON.stringify({
                        idPresupuesto: presu.idPresupuesto,
                        patente: presu.patente,
                        cliente: presu.cliente,
                        dniCliente: presu.clienteDni,
                        total: presu.total,
                        observaciones: presu.observaciones,
                        items: enrichedItems
                    }));
                } catch (err) {
                    console.error('Error fetching presupuesto detail:', err);
                    sessionStorage.setItem('presuRegistrar', JSON.stringify({
                        idPresupuesto: presu.idPresupuesto,
                        patente: presu.patente,
                        cliente: presu.cliente,
                        dniCliente: presu.clienteDni,
                        total: presu.total,
                        observaciones: presu.observaciones
                    }));
                }
                window.location.href = '../servicios/servicios.html';
            }
        } else if (accion === 'ver') {
            const presu = presupuestosCache.find(p => p.idPresupuesto === idPresupuesto);
            if (!presu) return;
            try {
                const items = await window.electronAPI.getPresupuestoDetalle(idPresupuesto);
                mostrarDetallePresupuesto(presu, items);
            } catch (err) {
                console.error('Error cargando detalle:', err);
            }
        } else if (accion === 'editar') {
            const presu = presupuestosCache.find(p => p.idPresupuesto === idPresupuesto);
            if (presu) {
                try {
                    const detalleItems = await window.electronAPI.getPresupuestoDetalle(idPresupuesto);
                    
                    // Cargar cliente
                    const resultados = await window.electronAPI.searchVehicles(presu.patente);
                    if (resultados && resultados.length > 0) {
                        const v = resultados.find(r => r.patente === presu.patente) || resultados[0];
                        clienteSeleccionado = {
                            id: v.id,
                            nombre: v.nombre,
                            dni: v.dni || presu.clienteDni,
                            patente: v.patente,
                            vehiculoTexto: `${v.patente} - ${v.marca || ''} ${v.modelo || ''}`
                        };
                        actualizarClienteSeleccionado();
                    }

                    // Limpiar items actuales
                    tbodyItems.querySelectorAll('tr:not(#presu-items-placeholder)').forEach(tr => tr.remove());
                    tbodyProductos.querySelectorAll('tr:not(#presu-productos-placeholder)').forEach(tr => tr.remove());

                    // Cargar items
                    if (Array.isArray(detalleItems)) {
                        for (const it of detalleItems) {
                            if (it.idTipoServicio) {
                                // Agregar item de tipo servicio
                                const ts = tiposServicioCache.find(t => t.idTipoServicio === it.idTipoServicio);
                                if (ts) {
                                    const tr = document.createElement('tr');
                                    tr.dataset.idTipo = ts.idTipoServicio;
                                    tr.dataset.precio = ts.precioBase || it.precio || 0;
                                    tr.dataset.nombre = ts.nombre;

                                    const tdServ = document.createElement('td');
                                    tdServ.textContent = ts.nombre;
                                    const tdPrecio = document.createElement('td');
                                    tdPrecio.textContent = formatearMoneda(ts.precioBase || it.precio || 0);
                                    const tdAcc = document.createElement('td');
                                    const btnQ = document.createElement('button');
                                    btnQ.type = 'button';
                                    btnQ.textContent = 'X';
                                    btnQ.className = 'btn-rechazar';
                                    btnQ.style.cssText = 'padding:2px 8px; font-size:0.85em; cursor:pointer;';
                                    btnQ.addEventListener('click', () => { tr.remove(); actualizarPlaceholder(); recalcularTotal(); });
                                    tdAcc.appendChild(btnQ);
                                    tr.appendChild(tdServ); tr.appendChild(tdPrecio); tr.appendChild(tdAcc);
                                    tbodyItems.appendChild(tr);
                                }
                            } else {
                                // Agregar item de producto
                                const match = (it.descripcion || '').match(/^(.+?)\s*\((\d+(?:\.\d+)?)\s*(lts|un\.?)\)$/i);
                                if (match) {
                                    const nombreProd = match[1].trim();
                                    const cantidad = parseFloat(match[2]);
                                    const prod = productosCache.find(p => {
                                        const texto = p.marca ? `${p.nombre} - ${p.marca}` : p.nombre;
                                        return texto === nombreProd;
                                    });
                                    if (prod) agregarProductoAlPresupuesto(prod, cantidad);
                                }
                            }
                        }
                    }

                    inputObservaciones.value = presu.observaciones || '';
                    actualizarPlaceholder();
                    actualizarPlaceholderProductos();
                    recalcularTotal();

                    // Eliminar presupuesto viejo para recrearlo al guardar
                    await window.electronAPI.deletePresupuesto(idPresupuesto);
                    tituloForm.textContent = 'Editar Presupuesto';

                    // Cambiar a pestaña Crear
                    vistaCrear.style.display = 'flex';
                    vistaTipos.style.display = 'none';
                    tabCrear.classList.add('activa');
                    tabTipos.classList.remove('activa');

                    await cargarPresupuestos();
                } catch (err) {
                    console.error('Error al editar presupuesto:', err);
                    await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'No se pudo cargar el presupuesto para edición.' });
                }
            }
        }
    });

    // ABM TIPOS DE SERVICIO
    const inputTipoNombre = document.getElementById('tipo-nombre');
    const inputTipoPrecio = document.getElementById('tipo-precio');
    const inputTipoIdEditar = document.getElementById('tipo-id-editar');
    const btnGuardarTipo = document.getElementById('btn-guardar-tipo');
    const tituloFormTipo = document.getElementById('titulo-form-tipo');
    const tbodyTipos = document.getElementById('tipos-lista-body');

    async function cargarListaTipos() {
        await cargarTiposServicio();
        poblarSelectTipo();
        renderTipos();
    }

    function renderTipos() {
        tbodyTipos.innerHTML = '';
        if (tiposServicioCache.length === 0) {
            tbodyTipos.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#bbb;">Sin tipos registrados.</td></tr>';
            return;
        }
        tiposServicioCache.forEach(ts => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(ts.nombre)}</td>
                <td>${formatearMoneda(ts.precioBase || 0)}</td>
                <td>
                    <div class="acciones-presupuesto">
                        <button type="button" class="btn-aprobar" data-id="${ts.idTipoServicio}" data-accion-tipo="editar">Editar</button>
                        <button type="button" class="btn-eliminar-presu" data-id="${ts.idTipoServicio}" data-accion-tipo="eliminar">Eliminar</button>
                    </div>
                </td>
            `;
            tbodyTipos.appendChild(tr);
        });
    }

    function limpiarFormTipo() {
        inputTipoNombre.value = '';
        inputTipoPrecio.value = '';
        inputTipoIdEditar.value = '';
        tituloFormTipo.textContent = 'ABM Tipo de Servicio';
    }

    // Formateo de precio base con puntos de miles
    inputTipoPrecio.addEventListener('input', function() {
        const raw = this.value.replace(/\D/g, '');
        this.value = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    });

    btnGuardarTipo.addEventListener('click', async () => {
        const nombre = inputTipoNombre.value.trim();
        const precioBase = parseFloat((inputTipoPrecio.value || '').replace(/\./g, '')) || 0;
        const idEditar = inputTipoIdEditar.value ? parseInt(inputTipoIdEditar.value) : null;

        if (!nombre) {
            await mostrarModal({ tipo: 'aviso', titulo: 'Atención', mensaje: 'Ingrese un nombre para el tipo de servicio.' });
            return;
        }

        try {
            const res = await window.electronAPI.saveTipoServicio({
                id: idEditar,
                nombre,
                precioBase
            });
            if (res && res.success) {
                await mostrarModal({ tipo: 'aviso', titulo: 'Éxito', mensaje: idEditar ? 'Tipo actualizado.' : 'Tipo creado.' });
                limpiarFormTipo();
                await cargarListaTipos();
            } else {
                await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: res.error || 'No se pudo guardar.' });
            }
        } catch (e) {
            console.error(e);
            await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: e.message || 'Error al guardar tipo.' });
        }
    });

    tbodyTipos.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-accion-tipo]');
        if (!btn) return;
        const id = parseInt(btn.dataset.id);
        const accion = btn.dataset.accionTipo;

        if (accion === 'editar') {
            const tipo = tiposServicioCache.find(t => t.idTipoServicio === id);
            if (tipo) {
                inputTipoNombre.value = tipo.nombre;
                const pBase = Math.round(tipo.precioBase || 0);
                inputTipoPrecio.value = pBase ? pBase.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
                inputTipoIdEditar.value = tipo.idTipoServicio;
                tituloFormTipo.textContent = 'Editar Tipo de Servicio';
                inputTipoNombre.focus();
            }
        } else if (accion === 'eliminar') {
            const confirmar = await mostrarModal({
                tipo: 'eliminar',
                titulo: 'Eliminar Tipo',
                mensaje: '¿Eliminar este tipo de servicio?',
                textoConfirmar: 'Eliminar'
            });
            if (confirmar) {
                try {
                    await window.electronAPI.deleteTipoServicio(id);
                    limpiarFormTipo();
                    await cargarListaTipos();
                } catch (e) {
                    console.error(e);
                    await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'No se pudo eliminar.' });
                }
            }
        }
    });

    // CERRAR SESIÓN
    const btnCerrarSesion = document.querySelector('.boton-cierre-sesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            const confirmar = await mostrarModal({
                tipo: 'confirmar',
                titulo: 'Cerrar Sesión',
                mensaje: '¿Seguro que desea cerrar sesión?',
                textoConfirmar: 'Cerrar Sesión'
            });
            if (confirmar) window.location.href = '../../moduloLogin/login/login.html';
        });
    }

    // INIT
    await cargarTiposServicio();
    poblarSelectTipo();
    await cargarProductosCache();
    await cargarPresupuestos();
});
