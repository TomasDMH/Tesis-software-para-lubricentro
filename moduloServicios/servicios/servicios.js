// MÓDULO SERVICIOS (Frontend)
// Carga de servicios, uso de insumos y consulta de stock.

document.addEventListener('DOMContentLoaded', async () => {
    // --- REFERENCIAS MODAL ---
    const modal = document.getElementById('modal-sistema');
    const elTitulo = document.getElementById('modal-titulo');
    const elMensaje = document.getElementById('modal-mensaje');
    const elSubMensaje = document.getElementById('modal-submensaje');

    // LÓGICA DE ALERTA DE STOCK (mismos umbrales que Stock)
    function obtenerStockMinimo(prod) {
        // Si the product has stockMinimo configured in DB, use that
        if (prod && typeof prod === 'object' && prod.stockMinimo && prod.stockMinimo > 0) {
            return prod.stockMinimo;
        }
        // Fallback: support both old signature (tipoEnvase, tipo) and new object
        const tipoEnvase = (typeof prod === 'object') ? (prod.tipoEnvase || '') : (prod || '');
        const tipo = (typeof prod === 'object') ? (prod.tipo || '') : (arguments[1] || '');
        if (!tipoEnvase) return 100; 
        const envase = tipoEnvase.toLowerCase().trim();
        // Filtros: umbral en unidades
        if (envase.includes('caja')) return 3;
        // Líquidos refrigerantes: siempre 20 Lts
        if (tipo && tipo.toLowerCase().replace(/_/g, ' ').includes('refrigerante')) return 20;
        // Aceites y otros líquidos: por tipo de envase
        if (envase === 'tambor (200 lts)') return 100;
        if (envase === 'bidon (4 lts)') return 60;
        if (envase === 'bidon (5 lts)') return 75;
        if (envase === 'botella (1lt)') return 20;
        
        return 100;
    }

    // FUNCIÓN MAESTRA DE MODALES
    function mostrarModal(config) {
        return new Promise((resolve) => {
            const btnSi_Actual = document.getElementById('btn-modal-confirmar');
            const btnNo_Actual = document.getElementById('btn-modal-cancelar');

            elTitulo.textContent = config.titulo || 'Atención';
            elMensaje.textContent = config.mensaje || '';
            elSubMensaje.textContent = config.submensaje || '';
            
            btnSi_Actual.className = 'modal-btn'; 
            btnSi_Actual.textContent = config.textoConfirmar || 'Aceptar';

            if (config.tipo === 'eliminar') {
                btnSi_Actual.classList.add('confirmar'); 
            } else {
                btnSi_Actual.classList.add('aceptar');
            }

            if (config.tipo === 'aviso') {
                btnNo_Actual.style.display = 'none';
            } else {
                btnNo_Actual.style.display = 'block';
                btnNo_Actual.textContent = config.textoCancelar || 'Cancelar';
            }

            modal.style.display = 'flex';

            const nuevoSi = btnSi_Actual.cloneNode(true);
            const nuevoNo = btnNo_Actual.cloneNode(true);
            
            btnSi_Actual.replaceWith(nuevoSi);
            btnNo_Actual.replaceWith(nuevoNo);

            const cerrar = (resultado) => {
                modal.style.display = 'none';
                resolve(resultado);
            };

            nuevoSi.addEventListener('click', () => cerrar(true));
            nuevoNo.addEventListener('click', () => cerrar(false));
            
            nuevoSi.focus();
        });
    }

    // --- REFERENCIAS DOM ---
    const inputBusquedaVehiculo = document.getElementById('busqueda-vehiculo');
    const listaResultados = document.getElementById('resultados-busqueda');
    
    // Insumos
    const contenedorInsumos = document.getElementById('lista-insumos-container');
    const inputBuscarInsumo = document.querySelector('.buscar-insumo-servicios');

    // Consulta de Stock
    const inputBuscarProducto = document.getElementById('buscar-producto-servicios');
    const tablaStockConsulta = document.getElementById('tabla-stock-consulta');
    const tablaStockConsultaBody = document.getElementById('tabla-stock-consulta-body');

    // Paginación Consulta
    const divPaginacionConsulta = document.getElementById('paginacion-consulta-controls');
    const btnPrevConsulta = document.getElementById('btn-prev-consulta');
    const btnNextConsulta = document.getElementById('btn-next-consulta');
    const spanInfoPaginaConsulta = document.getElementById('info-pagina-consulta');

    // Inputs Formulario
    const inputLitrosUsados = document.getElementById('input-litros-usados');
    const inputKlmActuales = document.getElementById('input-klm-actuales');
    const inputKlmProximos = document.getElementById('input-klm-proximos');
    const totalServicioDisplay = document.getElementById('total-servicio-display');

    // Venta Particular
    const formVentaParticular = document.getElementById('form-venta-particular');
    const inputVentaBusquedaCliente = document.getElementById('venta-busqueda-cliente');
    const resultadosVentaCliente = document.getElementById('resultados-venta-cliente');
    const inputVentaProducto = document.getElementById('venta-producto');
    const resultadosVentaProducto = document.getElementById('resultados-venta-producto');
    const ventaProductosBody = document.getElementById('venta-productos-body');
    const ventaTotalDisplay = document.getElementById('venta-total-display');
    const inputVentaFecha = document.getElementById('venta-fecha');
    const inputVentaDetalle = document.getElementById('venta-detalle');
    let presupuestoOrigenRegistrar = null;

    // FORMATEO AUTOMÁTICO
    function formatearNumero(valor) {
        if (!valor) return '';
        const numero = valor.toString().replace(/\D/g, '');
        if (numero === '') return '';
        return numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function desformatearNumero(valor) {
        if (!valor) return '';
        return valor.toString().replace(/\./g, '');
    }
    // Formateo especial para precio (soporta decimales con coma)
    function formatearPrecio(valor) {
        if (!valor) return '';
        const str = valor.toString();
        // Separar parte entera y decimal por coma
        const partes = str.split(',');
        const enteroLimpio = partes[0].replace(/\D/g, '');
        if (enteroLimpio === '') return partes.length > 1 ? ',' + partes[1] : '';
        const enteroFormateado = enteroLimpio.replace(/\B(?=(?:\d{3})+(?!\d))/g, '.');
        if (partes.length > 1) {
            // Limitar a 2 decimales
            const decimales = partes[1].replace(/\D/g, '').substring(0, 2);
            return enteroFormateado + ',' + decimales;
        }
        return enteroFormateado;
    }

    function desformatearPrecio(valor) {
        if (!valor) return '';
        // Quitar puntos de miles, reemplazar coma decimal por punto
        return valor.toString().replace(/\./g, '').replace(',', '.');
    }

    function normalizarPatente(valor) {
        return (valor || '').toString().replace(/\s+/g, '').toUpperCase();
    }

    function formatearTextoVehiculoSeleccionado(datos) {
        const patente = datos && datos.patente ? datos.patente : '';
        const marca = datos && datos.marca ? datos.marca : '';
        const modelo = datos && datos.modelo ? datos.modelo : '';
        const klmProx = datos && datos.klmProx ? formatearNumero(datos.klmProx) : 'Sin registro';
        return `${patente} - ${marca} ${modelo} | Debería tener: ${klmProx} km`.replace(/\s+/g, ' ').trim();
    }

    async function buscarPresupuestoAprobadoPorPatente(patente) {
        try {
            const respuesta = await window.electronAPI.getPresupuestos({ estado: 'Aprobado' });
            const presupuestos = Array.isArray(respuesta) ? respuesta : (respuesta && Array.isArray(respuesta.rows) ? respuesta.rows : []);
            const patenteNormalizada = normalizarPatente(patente);
            return presupuestos.find(p => normalizarPatente(p.patente) === patenteNormalizada) || null;
        } catch (error) {
            console.error('Error al verificar presupuesto aprobado:', error);
            return null;
        }
    }

    async function advertirPresupuestoAprobado(presupuesto) {
        if (!presupuesto) return;

        const irAPresupuestos = await mostrarModal({
            titulo: 'Presupuesto aprobado encontrado',
            mensaje: 'El cliente ya tiene un Presupuesto aprobado para esta patente.',
            submensaje: 'Para registrar el servicio, ingresá desde Presupuestos usando el botón "Registrar Servicio" del presupuesto correspondiente.',
            textoConfirmar: 'Ir a Presupuestos',
            textoCancelar: 'Seguir en Servicios'
        });

        if (!irAPresupuestos) return;

        sessionStorage.setItem('presuDestino', JSON.stringify({
            idPresupuesto: presupuesto.idPresupuesto,
            patente: presupuesto.patente,
            estado: presupuesto.estado || 'Aprobado'
        }));
        window.location.href = '../presupuestos/presupuestos.html';
    }

    async function manejarSeleccionVehiculo(item) {
        inputBusquedaVehiculo.value = formatearTextoVehiculoSeleccionado({
            patente: item.dataset.patente,
            marca: item.dataset.marca,
            modelo: item.dataset.modelo,
            klmProx: item.dataset.klmProx
        });
        inputBusquedaVehiculo.dataset.dniCliente = item.dataset.dni;
        inputBusquedaVehiculo.dataset.patenteCliente = item.dataset.patente;
        listaResultados.style.display = 'none';

        const presupuestoAprobado = await buscarPresupuestoAprobadoPorPatente(item.dataset.patente);
        if (presupuestoAprobado) {
            await advertirPresupuestoAprobado(presupuestoAprobado);
        }
    }
    function aplicarFormateoAutomatico(input) {
        input.addEventListener('input', function(e) {
            const cursorPos = this.selectionStart;
            const valorAnterior = this.value;
            const longitudAnterior = valorAnterior.length;
            
            const numeroLimpio = desformatearNumero(this.value);
            const numeroFormateado = formatearNumero(numeroLimpio);
            this.value = numeroFormateado;
            
            const longitudNueva = numeroFormateado.length;
            const diff = longitudNueva - longitudAnterior;
            this.setSelectionRange(cursorPos + diff, cursorPos + diff);
        });

        input.addEventListener('keypress', function(e) {
            if (!/^\d$/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                e.preventDefault();
            }
        });
    }

    aplicarFormateoAutomatico(inputLitrosUsados);
    aplicarFormateoAutomatico(inputKlmActuales);
    aplicarFormateoAutomatico(inputKlmProximos);

    // FUNCIONES DE CÁLCULO DE PRECIO (como Presupuestos)
    function extraerCapacidadLitrosEnvase(tipoEnvase) {
        if (!tipoEnvase) return null;
        if (tipoEnvase.toString().toLowerCase().includes('caja')) return 1;
        const match = tipoEnvase.toString().toLowerCase().match(/(\d+)\s*(?:l|lt|lts)/i);
        return match ? parseInt(match[1], 10) : null;
    }

    const FACTOR_GANANCIA_PRODUCTOS = 1.2;

    function redondearPrecioCentena(valor) {
        return Math.round((Number(valor) || 0) / 100) * 100;
    }

    function precioPorLitro(prod) {
        if (!prod || !prod.precio) return 0;
        const esFiltro = (prod.tipo || '').toLowerCase().includes('filtro');
        if (esFiltro) return redondearPrecioCentena(prod.precio * FACTOR_GANANCIA_PRODUCTOS);
        const cap = extraerCapacidadLitrosEnvase(prod.tipoEnvase);
        if (cap && cap > 0) return redondearPrecioCentena((prod.precio / cap) * FACTOR_GANANCIA_PRODUCTOS);
        return redondearPrecioCentena(prod.precio * FACTOR_GANANCIA_PRODUCTOS);
    }

    function formatearMonedaServicio(valor) {
        return '$' + redondearPrecioCentena(valor).toLocaleString('es-AR');
    }

    function recalcularTotalServicio() {
        let total = 0;
        // Sumar precios de tipos de servicio marcados
        document.querySelectorAll('.tipo-servicio-cb:checked').forEach(cb => {
            total += parseFloat(cb.dataset.precio || 0);
        });
        // Sumar insumos activos
        document.querySelectorAll('.insumo-item-servicios.insumo-en-uso').forEach(item => {
            const ml = parseFloat(item.querySelector('.insumo-valor-real-ml').value) || 0;
            if (ml > 0) {
                const idProd = parseInt(item.getAttribute('data-id'));
                const prod = productosCache.find(p => p.idProducto === idProd);
                if (prod) {
                    const esFiltro = (prod.tipo || '').toLowerCase().includes('filtro');
                    const ppuVenta = precioPorLitro(prod);
                    const subtotalInsumo = ppuVenta * (esFiltro ? ml : (ml / 1000));
                    total += redondearPrecioCentena(subtotalInsumo);
                }
            }
        });
        total = redondearPrecioCentena(total);
        if (totalServicioDisplay) {
            totalServicioDisplay.textContent = formatearMonedaServicio(total);
        }
        return total;
    }

    // 1. CARGA INICIAL DE PRODUCTOS (INSUMOS)
    async function cargarInsumos() {
        try {
            const productos = await window.electronAPI.getProducts('');
            contenedorInsumos.innerHTML = ''; 

            if (productos.length > 0) {
                productos.forEach(prod => {
                    // Botonera de Insumos
                    crearItemBotonera(prod);
                });
                
                document.querySelectorAll('.insumo-item-servicios').forEach(item => {
                    item.style.display = 'none';
                });
            } else {
                contenedorInsumos.innerHTML = '<p style="color:#fff; text-align:center;">No hay insumos.</p>';
            }

        } catch (error) {
            console.error("Error cargando insumos:", error);
        }
    }

    // NUEVA LÓGICA DE INSUMOS INTELIGENTES
    function crearItemBotonera(prod) {
        const div = document.createElement('div');
        div.classList.add('insumo-item-servicios');
        div.setAttribute('data-nombre', prod.nombre.toLowerCase()); 
        div.setAttribute('data-id', prod.idProducto);
        div.setAttribute('data-stock-ml', prod.mililitros || 0);

        const esFiltro = (prod.tipo || '').toLowerCase().includes('filtro');
        const unidadInicial = esFiltro ? 'Un.' : 'ml';
        const precioVentaUnitario = precioPorLitro(prod);
        const precioLabel = esFiltro
            ? `${formatearMonedaServicio(precioVentaUnitario)} /Un.`
            : `${formatearMonedaServicio(precioVentaUnitario)} /Lts`;

        div.innerHTML = `
            <span class="insumo-trash-servicios" title="Quitar" style="cursor:pointer;">X</span>
            <span class="insumo-nombre-servicios">${prod.nombre}<small style="display:block; font-size:0.78em; color:#fab062; margin-top:2px;">${precioLabel}</small></span>
            <button type="button" class="insumo-btn-servicios btn-menos">-</button>
            <div style="display: flex; align-items: center; gap: 5px;">
                <input type="number" class="insumo-cantidad-input" value="" placeholder="0" 
                       style="width: 60px; text-align: center; border: 1px solid #ccc; border-radius: 4px; padding: 2px;">
                <span class="insumo-unidad-label" style="font-size: 0.8em; font-weight: bold; color: #7a263a;">${unidadInicial}</span>
            </div>
            <input type="hidden" class="insumo-valor-real-ml" value="0">
            <button type="button" class="insumo-btn-servicios btn-mas">+</button>
        `;

        const btnMas = div.querySelector('.btn-mas');
        const btnMenos = div.querySelector('.btn-menos');
        const inputVisual = div.querySelector('.insumo-cantidad-input');
        const labelUnidad = div.querySelector('.insumo-unidad-label');
        const inputHidden = div.querySelector('.insumo-valor-real-ml'); 
        const btnTrash = div.querySelector('.insumo-trash-servicios');

        const UMBRAL_LITROS = 100; 
        const PASO_BOTONES = esFiltro ? 1 : 250; 

        // Función para marcar/desmarcar item como "en uso"
        function marcarEnUso(cantidad) {
            if (cantidad > 0) {
                div.classList.add('insumo-en-uso');
                div.style.display = 'flex';
            } else {
                div.classList.remove('insumo-en-uso');
                // Ocultar solo si el buscador está vacío
                const textoActual = inputBuscarInsumo ? inputBuscarInsumo.value.trim() : '';
                if (!textoActual) {
                    div.style.display = 'none';
                }
            }
        }

        // Input manual
        inputVisual.addEventListener('input', () => {
            limpiarBusquedaInsumosSiAplica();
            const val = parseFloat(inputVisual.value);
            if (isNaN(val) || val === 0) {
                labelUnidad.textContent = unidadInicial;
                inputHidden.value = 0;
                estilizarBotones(btnMenos, labelUnidad, 0);
                // No ocultar si el input está vacío (usuario borrando para re-escribir)
                if (inputVisual.value.trim() !== '') {
                    marcarEnUso(0);
                }
                recalcularTotalServicio();
                return;
            }
            if (esFiltro) {
                labelUnidad.textContent = 'Un.';
                inputHidden.value = Math.round(val);
            } else if (val < UMBRAL_LITROS) {
                labelUnidad.textContent = 'Lts';
                inputHidden.value = val * 1000;
            } else {
                labelUnidad.textContent = 'ml';
                inputHidden.value = val;
            }
            estilizarBotones(btnMenos, labelUnidad, parseFloat(inputHidden.value));
            marcarEnUso(parseFloat(inputHidden.value));
            recalcularTotalServicio();
        });

        // Botones
        btnMas.addEventListener('click', () => {
            limpiarBusquedaInsumosSiAplica();
            let stockActualMl = parseFloat(inputHidden.value) || 0;
            stockActualMl += PASO_BOTONES;
            actualizarVisualDesdeMl(stockActualMl, inputVisual, inputHidden, labelUnidad, btnMenos, esFiltro);
            marcarEnUso(stockActualMl);
            recalcularTotalServicio();
        });

        btnMenos.addEventListener('click', () => {
            limpiarBusquedaInsumosSiAplica();
            let stockActualMl = parseFloat(inputHidden.value) || 0;
            if (stockActualMl > 0) {
                stockActualMl -= PASO_BOTONES;
                if (stockActualMl < 0) stockActualMl = 0;
                actualizarVisualDesdeMl(stockActualMl, inputVisual, inputHidden, labelUnidad, btnMenos, esFiltro);
                marcarEnUso(stockActualMl);
                recalcularTotalServicio();
            }
        });

        btnTrash.addEventListener('click', () => {
            actualizarVisualDesdeMl(0, inputVisual, inputHidden, labelUnidad, btnMenos, esFiltro);
            marcarEnUso(0);
            recalcularTotalServicio();
        });

        contenedorInsumos.appendChild(div);
    }

    function actualizarVisualDesdeMl(ml, inputVisual, inputHidden, labelUnidad, btnMenos, esFiltro) {
        inputHidden.value = ml;
        if (ml === 0) {
            inputVisual.value = '';
            labelUnidad.textContent = esFiltro ? 'Un.' : 'ml';
        } else if (esFiltro) {
            inputVisual.value = Math.round(ml);
            labelUnidad.textContent = 'Un.';
        } else {
            if (ml >= 1000 && ml % 1000 === 0) {
                inputVisual.value = ml / 1000;
                labelUnidad.textContent = 'Lts';
            } else {
                inputVisual.value = ml;
                labelUnidad.textContent = 'ml';
            }
        }
        estilizarBotones(btnMenos, labelUnidad, ml);
    }

    function estilizarBotones(btnMenos, label, cantidadMl) {
        if (cantidadMl <= 0) {
            btnMenos.disabled = true;
            btnMenos.style.opacity = '0.5';
            btnMenos.style.cursor = 'not-allowed';
            label.style.color = '#7a263a';
        } else {
            btnMenos.disabled = false;
            btnMenos.style.opacity = '1';
            btnMenos.style.cursor = 'pointer';
            label.style.color = '#e20613';
        }
    }

    function refrescarVisibilidadInsumosConBusquedaVacia() {
        const items = document.querySelectorAll('.insumo-item-servicios');
        items.forEach(item => {
            const enUso = item.classList.contains('insumo-en-uso');
            item.style.display = enUso ? 'flex' : 'none';
        });
    }

    function limpiarBusquedaInsumosSiAplica() {
        if (!inputBuscarInsumo) return;
        if (!inputBuscarInsumo.value.trim()) return;
        inputBuscarInsumo.value = '';
        refrescarVisibilidadInsumosConBusquedaVacia();
    }

    // 2. BUSCADOR DE INSUMOS
    if (inputBuscarInsumo) {
        inputBuscarInsumo.addEventListener('input', (e) => {
            const texto = e.target.value.trim().toLowerCase();
            const items = document.querySelectorAll('.insumo-item-servicios');
            if (texto.length === 0) {
                // Sin búsqueda: solo mostrar los que están en uso
                items.forEach(item => {
                    const enUso = item.classList.contains('insumo-en-uso');
                    item.style.display = enUso ? 'flex' : 'none';
                });
            } else {
                items.forEach(item => {
                    const nombre = item.getAttribute('data-nombre');
                    const enUso = item.classList.contains('insumo-en-uso');
                    // Mostrar si coincide con búsqueda O si está en uso
                    item.style.display = (nombre.includes(texto) || enUso) ? 'flex' : 'none';
                });
            }
        });
    }

    // 3. CONSULTA DE STOCK CON PAGINACIÓN
    let productosCache = []; 
    let productosFiltradosConsulta = [];
    let paginaConsulta = 1;
    const ITEMS_POR_PAGINA = 10;

    async function cargarProductosCache() {
        try {
            productosCache = await window.electronAPI.getProducts('');
            tablaStockConsulta.style.display = 'none';
            if(divPaginacionConsulta) divPaginacionConsulta.style.display = 'none';
        } catch (error) {
            console.error("Error cargando productos en cache:", error);
        }
    }


    // 3B. VENTA PARTICULAR - BUSCADOR PREDICTIVO DE PRODUCTO
    function escapeHtmlVenta(str) {
        return (str || '').toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function buscarProductosVenta(termino) {
        const t = (termino || '').toString().trim().toLowerCase();
        if (!t) return productosCache.slice(0, 25);

        const out = [];
        for (const p of productosCache) {
            const hay = `${p.nombre || ''} ${p.marca || ''} ${p.tipo || ''}`.toLowerCase();
            if (hay.includes(t)) out.push(p);
            if (out.length >= 25) break;
        }
        return out;
    }

    function textoVehiculoVenta(cliente) {
        return `${cliente.patente} - ${cliente.marca || ''} ${cliente.modelo || ''} (${cliente.nombre || ''})`.replace(/\s+/g, ' ').trim();
    }

    if (inputVentaBusquedaCliente) {
        inputVentaBusquedaCliente.dataset.patenteCliente = '';
        inputVentaBusquedaCliente.dataset.dniCliente = '';

        inputVentaBusquedaCliente.addEventListener('input', async (e) => {
            const texto = e.target.value.trim();
            inputVentaBusquedaCliente.dataset.patenteCliente = '';
            inputVentaBusquedaCliente.dataset.dniCliente = '';

            if (!texto) {
                if (resultadosVentaCliente) {
                    resultadosVentaCliente.innerHTML = '';
                    resultadosVentaCliente.style.display = 'none';
                }
                return;
            }

            try {
                const resultados = await window.electronAPI.searchVehicles(texto);
                if (!resultadosVentaCliente) return;

                resultadosVentaCliente.innerHTML = '';
                if (!Array.isArray(resultados) || resultados.length === 0) {
                    resultadosVentaCliente.innerHTML = '<div class="item-resultado">No hay registro de ese cliente</div>';
                    resultadosVentaCliente.style.display = 'block';
                    return;
                }

                const unicos = [];
                const patentes = new Set();
                resultados.forEach(r => {
                    if (r.patente && !patentes.has(r.patente)) {
                        patentes.add(r.patente);
                        unicos.push(r);
                    }
                });

                unicos.forEach(cliente => {
                    const div = document.createElement('div');
                    div.classList.add('item-resultado');
                    div.dataset.patente = cliente.patente;
                    div.dataset.marca = cliente.marca || '';
                    div.dataset.modelo = cliente.modelo || '';
                    div.dataset.nombre = cliente.nombre || '';
                    div.dataset.dni = cliente.dni || '';
                    div.textContent = textoVehiculoVenta(cliente);
                    resultadosVentaCliente.appendChild(div);
                });

                resultadosVentaCliente.style.display = 'block';
            } catch (error) {
                console.error('Error buscando cliente para venta:', error);
            }
        });
    }

    if (resultadosVentaCliente) {
        resultadosVentaCliente.addEventListener('click', (e) => {
            const item = e.target.closest('.item-resultado[data-patente]');
            if (!item || !inputVentaBusquedaCliente) return;

            inputVentaBusquedaCliente.value = `${item.dataset.patente} - ${item.dataset.marca} ${item.dataset.modelo}`.replace(/\s+/g, ' ').trim();
            inputVentaBusquedaCliente.dataset.patenteCliente = item.dataset.patente || '';
            inputVentaBusquedaCliente.dataset.dniCliente = item.dataset.dni || '';
            resultadosVentaCliente.style.display = 'none';
        });
    }

    function renderResultadosVentaProducto(termino) {
        if (!resultadosVentaProducto) return;

        const lista = buscarProductosVenta(termino);
        if (!lista.length) {
            resultadosVentaProducto.innerHTML = '';
            resultadosVentaProducto.style.display = 'none';
            return;
        }

        resultadosVentaProducto.innerHTML = lista.map(p => {
            const nombre = escapeHtmlVenta(p.nombre || '-');
            const marca = escapeHtmlVenta(p.marca || '');
            const envase = escapeHtmlVenta(p.tipoEnvase || '');
            return `
                <div class="item-resultado" data-id-producto="${p.idProducto}">
                    <strong>${nombre}${marca ? ' - ' + marca : ''}</strong>
                    ${envase ? `<small>${envase}</small>` : ''}
                </div>
            `;
        }).join('');

        resultadosVentaProducto.style.display = 'block';
    }

    if (inputVentaProducto) {
        inputVentaProducto.dataset.idProducto = '';

        inputVentaProducto.addEventListener('focus', async () => {
            if (!productosCache.length) await cargarProductosCache();
            renderResultadosVentaProducto(inputVentaProducto.value);
        });

        inputVentaProducto.addEventListener('input', async () => {
            inputVentaProducto.dataset.idProducto = '';
            if (!productosCache.length) await cargarProductosCache();
            renderResultadosVentaProducto(inputVentaProducto.value);
        });
    }

    if (resultadosVentaProducto) {
        resultadosVentaProducto.addEventListener('click', (e) => {
            const item = e.target.closest('.item-resultado[data-id-producto]');
            if (!item) return;

            const idProducto = parseInt(item.dataset.idProducto, 10);
            const prod = productosCache.find(p => p.idProducto === idProducto);
            if (!prod) return;

            // Evitar duplicados
            if (ventaProductosBody && ventaProductosBody.querySelector(`tr[data-id-producto="${idProducto}"]`)) {
                resultadosVentaProducto.style.display = 'none';
                inputVentaProducto.value = '';
                return;
            }

            agregarProductoVenta(prod);
            resultadosVentaProducto.style.display = 'none';
            inputVentaProducto.value = '';
        });
    }

    function agregarProductoVenta(prod) {
        const placeholder = document.getElementById('venta-productos-placeholder');
        if (placeholder) placeholder.style.display = 'none';

        const esFiltro = (prod.tipo || '').toLowerCase().includes('filtro');
        const precioUnit = precioPorLitro(prod);

        const tr = document.createElement('tr');
        tr.dataset.idProducto = prod.idProducto;
        tr.dataset.esFiltro = esFiltro ? '1' : '0';
        tr.dataset.precioUnit = precioUnit;
        tr.dataset.subtotal = redondearPrecioCentena(precioUnit);

        const nombre = `${prod.nombre}${prod.marca ? ' - ' + prod.marca : ''}`;
        const unidad = esFiltro ? 'Un.' : 'Lts';

        tr.innerHTML = `
            <td style="color:#fff; padding:6px 8px; font-size:0.9em;">${escapeHtmlVenta(nombre)}</td>
            <td style="text-align:center; padding:6px 8px;">
                <input type="number" class="venta-cant-input" value="1" min="${esFiltro ? '1' : '0.1'}" step="${esFiltro ? '1' : '0.1'}"
                    style="width:60px; text-align:center; border:1px solid #fab062; border-radius:4px; padding:2px; background:#fffbe6; color:#000;">
                <small style="color:#bbb; font-size:0.8em;">${unidad}</small>
            </td>
            <td style="text-align:right; color:#fff; padding:6px 8px; font-size:0.9em;">${formatearMonedaServicio(precioUnit)}</td>
            <td class="venta-subtotal-cell" style="text-align:right; color:#fab062; padding:6px 8px; font-weight:bold; font-size:0.9em;">${formatearMonedaServicio(precioUnit)}</td>
            <td style="text-align:center; padding:6px 8px;"><span class="venta-quitar-prod" style="color:#e20613; cursor:pointer; font-weight:bold;">X</span></td>
        `;

        ventaProductosBody.appendChild(tr);

        const cantInput = tr.querySelector('.venta-cant-input');
        cantInput.addEventListener('input', () => {
            const cant = parseFloat(cantInput.value) || 0;
            const sub = redondearPrecioCentena(precioUnit * cant);
            tr.dataset.subtotal = sub;
            tr.querySelector('.venta-subtotal-cell').textContent = formatearMonedaServicio(sub);
            recalcularTotalVenta();
        });

        tr.querySelector('.venta-quitar-prod').addEventListener('click', () => {
            tr.remove();
            recalcularTotalVenta();
            if (!ventaProductosBody.querySelector('tr:not(#venta-productos-placeholder)')) {
                const ph = document.getElementById('venta-productos-placeholder');
                if (ph) ph.style.display = '';
            }
        });

        recalcularTotalVenta();
    }

    function recalcularTotalVenta() {
        let total = 0;
        if (ventaProductosBody) {
            ventaProductosBody.querySelectorAll('tr:not(#venta-productos-placeholder)').forEach(tr => {
                total += parseFloat(tr.dataset.subtotal || 0);
            });
        }
        total = redondearPrecioCentena(total);
        if (ventaTotalDisplay) ventaTotalDisplay.textContent = formatearMonedaServicio(total);
        return total;
    }

    document.addEventListener('click', (e) => {
        if (inputVentaBusquedaCliente && resultadosVentaCliente && !inputVentaBusquedaCliente.contains(e.target) && !resultadosVentaCliente.contains(e.target)) {
            resultadosVentaCliente.style.display = 'none';
        }
        if (inputVentaProducto && resultadosVentaProducto && !inputVentaProducto.contains(e.target) && !resultadosVentaProducto.contains(e.target)) {
            resultadosVentaProducto.style.display = 'none';
        }
    }, { once: false });


    if (inputBuscarProducto) {
        inputBuscarProducto.addEventListener('input', (e) => {
            const busqueda = e.target.value.trim().toLowerCase();

            if (busqueda.length === 0) {
                tablaStockConsulta.style.display = 'none';
                if(divPaginacionConsulta) divPaginacionConsulta.style.display = 'none';
                return;
            }

            productosFiltradosConsulta = productosCache.filter(prod => 
                prod.nombre.toLowerCase().includes(busqueda) ||
                prod.marca.toLowerCase().includes(busqueda) ||
                prod.tipo.toLowerCase().includes(busqueda)
            );

            paginaConsulta = 1;
            renderizarTablaConsultaPaginada();
        });
    }

    function renderizarTablaConsultaPaginada() {
        tablaStockConsultaBody.innerHTML = '';
        tablaStockConsulta.style.display = 'table';
        if(divPaginacionConsulta) divPaginacionConsulta.style.display = 'flex';

        if (productosFiltradosConsulta.length === 0) {
            tablaStockConsultaBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #999;">¡Producto no encontrado!</td></tr>';
            if(divPaginacionConsulta) divPaginacionConsulta.style.display = 'none';
            return;
        }

        const totalPaginas = Math.ceil(productosFiltradosConsulta.length / ITEMS_POR_PAGINA);
        if (paginaConsulta < 1) paginaConsulta = 1;
        if (paginaConsulta > totalPaginas) paginaConsulta = totalPaginas;

        const inicio = (paginaConsulta - 1) * ITEMS_POR_PAGINA;
        const fin = inicio + ITEMS_POR_PAGINA;
        const paginaItems = productosFiltradosConsulta.slice(inicio, fin);

        paginaItems.forEach(prod => {
            const row = document.createElement('tr');
            const esFiltroConsulta = (prod.tipo || '').toLowerCase().includes('filtro');
            let cantidadTexto;
            if (esFiltroConsulta) {
                cantidadTexto = `${prod.cantidad || 0} Un.`;
            } else {
                cantidadTexto = `${(prod.mililitros / 1000).toFixed(2)} Lts.`;
            }
            
            // LÓGICA DE COLOR DINÁMICA TAMBIÉN AQUÍ
            const limite = obtenerStockMinimo(prod);
            const valorCheck = esFiltroConsulta ? (prod.cantidad || 0) : parseFloat((prod.mililitros / 1000).toFixed(2));
            const colorStock = valorCheck <= limite ? '#e20613' : '#2e7d32';

            row.innerHTML = `
                <td>${prod.nombre} <small>(${prod.marca})</small></td>
                <td style="color: ${colorStock}; font-weight: bold;">${cantidadTexto}</td>
            `;
            tablaStockConsultaBody.appendChild(row);
        });

        spanInfoPaginaConsulta.textContent = `Página ${paginaConsulta} de ${totalPaginas}`;
        btnPrevConsulta.disabled = (paginaConsulta === 1);
        btnNextConsulta.disabled = (paginaConsulta === totalPaginas);
    }

    if (btnPrevConsulta && btnNextConsulta) {
        btnPrevConsulta.addEventListener('click', () => {
            if (paginaConsulta > 1) {
                paginaConsulta--;
                renderizarTablaConsultaPaginada();
            }
        });

        btnNextConsulta.addEventListener('click', () => {
            const totalPaginas = Math.ceil(productosFiltradosConsulta.length / ITEMS_POR_PAGINA);
            if (paginaConsulta < totalPaginas) {
                paginaConsulta++;
                renderizarTablaConsultaPaginada();
            }
        });
    }

    // 4. BUSCADOR DE VEHÍCULOS
    if(inputBusquedaVehiculo) {
        inputBusquedaVehiculo.addEventListener('input', async (e) => {
            const texto = e.target.value.trim();
            if (texto.length === 0) {
                listaResultados.style.display = 'none';
                return;
            }
            try {
                const resultados = await window.electronAPI.searchVehicles(texto);
                listaResultados.innerHTML = '';
                if (resultados.length > 0) {
                    const vehiculosUnicos = [];
                    const patentes = new Set();
                    
                    resultados.forEach(cliente => {
                        if (cliente.patente && !patentes.has(cliente.patente)) {
                            patentes.add(cliente.patente);
                            vehiculosUnicos.push(cliente);
                        }
                    });

                    vehiculosUnicos.forEach(cliente => {
                        const div = document.createElement('div');
                        div.classList.add('item-resultado');
                        div.setAttribute('data-patente', cliente.patente);
                        div.setAttribute('data-marca', cliente.marca || '');
                        div.setAttribute('data-modelo', cliente.modelo || '');
                        div.setAttribute('data-dni', cliente.dni);
                        div.setAttribute('data-klm-prox', cliente.klmProx || '');
                        let textoResultado = `${cliente.patente} - ${cliente.marca} ${cliente.modelo} (${cliente.nombre})`;
                        if (cliente.klmProx) {
                            textoResultado += ` - Debería tener: ${formatearNumero(cliente.klmProx)}km`;
                        } else {
                            textoResultado += ' - Debería tener: Sin registro';
                        }
                        div.innerHTML = textoResultado;
                        listaResultados.appendChild(div);
                    });
                    
                    listaResultados.style.display = 'block';
                } else {
                    listaResultados.innerHTML = '<div class="item-resultado">No hay registro de ese cliente</div>';
                    listaResultados.style.display = 'block';
                }
            } catch (error) { console.error(error); }
        });
    }

    // Delegación de eventos en resultados de búsqueda (1 solo listener)
    if (listaResultados) {
        listaResultados.addEventListener('click', async (e) => {
            const item = e.target.closest('.item-resultado[data-patente]');
            if (!item) return;
            await manejarSeleccionVehiculo(item);
        });
    }

    document.addEventListener('click', (e) => {
        if (inputBusquedaVehiculo && listaResultados && !inputBusquedaVehiculo.contains(e.target) && !listaResultados.contains(e.target)) {
            listaResultados.style.display = 'none';
        }
    }, { once: false });

    // 5. FECHA Y REGISTRO
    const inputFecha = document.getElementById('input-fecha');
    function establecerFechaActual() {
        const hoy = new Date();
        const dia = String(hoy.getDate()).padStart(2, '0');
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        const año = hoy.getFullYear();
        inputFecha.value = `${dia}/${mes}/${año}`;
        inputFecha.dataset.fechaIso = `${año}-${mes}-${dia}`;

        if (inputVentaFecha) {
            inputVentaFecha.value = `${dia}/${mes}/${año}`;
            inputVentaFecha.dataset.fechaIso = `${año}-${mes}-${dia}`;
        }
    }
    establecerFechaActual();

    const btnRegistrar = document.querySelector('.registrar-btn-servicios');

    if (btnRegistrar) {
        btnRegistrar.addEventListener('click', async () => {
            const vehiculo = inputBusquedaVehiculo.value.trim();
            const fechaIso = inputFecha.dataset.fechaIso;

            // Construir descripción desde checkboxes de tipo de servicio
            const checks = document.querySelectorAll('.tipo-servicio-cb:checked');
            const descripcion = Array.from(checks).map(cb => cb.value).join(' + ') || 'Servicio';

            // Calcular precio total automáticamente
            const precioTotal = recalcularTotalServicio();
            
            const litrosStr = desformatearNumero(inputLitrosUsados.value.trim());
            const klmActualesStr = desformatearNumero(inputKlmActuales.value.trim());
            const klmProximosStr = desformatearNumero(inputKlmProximos.value.trim());

            if (!vehiculo) return mostrarModal({ tipo: 'aviso', titulo: 'Campo Requerido', mensaje: 'Por favor selecciona un vehículo' });
            if (!klmActualesStr) return mostrarModal({ tipo: 'aviso', titulo: 'Campo Requerido', mensaje: 'Ingresa los kilómetros actuales del vehículo.' });
            if (!klmProximosStr) return mostrarModal({ tipo: 'aviso', titulo: 'Campo Requerido', mensaje: 'Ingresa los kilómetros para el próximo servicio.' });

            const patente = inputBusquedaVehiculo.dataset.patenteCliente;
            const dniCliente = inputBusquedaVehiculo.dataset.dniCliente;

            if (!patente || !dniCliente) return mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'Seleccione vehículo de la lista' });

            const idUsuario = parseInt(localStorage.getItem('usuarioID')) || null;
            if (!idUsuario) return mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'Sesión no válida. Inicie sesión nuevamente.' });

            const insumos = [];
            const insumosItems = document.querySelectorAll('.insumo-item-servicios');
            
            insumosItems.forEach(item => {
                const inputVal = item.querySelector('.insumo-valor-real-ml');
                const cantidad = parseFloat(inputVal.value) || 0;
                
                if (cantidad > 0) {
                    const idProducto = parseInt(item.getAttribute('data-id'));
                    const nombre = item.getAttribute('data-nombre');
                    insumos.push({ idProducto, nombre, mililitros: cantidad }); 
                }
            });

            if (insumos.length === 0) return mostrarModal({ tipo: 'aviso', titulo: 'Productos Requeridos', mensaje: 'Debe cargar al menos un producto con su cantidad antes de guardar el servicio.' });

            const datosServicio = {
                patente,
                dniCliente: parseInt(dniCliente),
                idUsuario,
                idPresupuestoOrigen: presupuestoOrigenRegistrar,
                descripcion,
                fecha: fechaIso,
                precio: precioTotal,
                litrosAceite: litrosStr ? parseFloat(litrosStr) : null,
                klmAct: klmActualesStr ? parseInt(klmActualesStr) : null,
                klmProx: klmProximosStr ? parseInt(klmProximosStr) : null,
                insumos
            };

            try {
                const resultado = await window.electronAPI.saveService(datosServicio);
                
                if (resultado.stockExcedido) {
                    await mostrarModal({ tipo: 'aviso', titulo: 'Stock insuficiente', mensaje: `¡LA CANTIDAD SELECCIONADA SUPERA EL STOCK DISPONIBLE! (${resultado.producto})` });
                    return;
                }
                if (resultado.success) {
                    await mostrarModal({ tipo: 'aviso', titulo: 'Éxito', mensaje: '¡SE HA GUARDADO CORRECTAMENTE EL SERVICIO!' });
                    
                    inputBusquedaVehiculo.value = '';
                    inputBusquedaVehiculo.dataset.dniCliente = '';
                    inputBusquedaVehiculo.dataset.patenteCliente = '';
                    presupuestoOrigenRegistrar = null;
                    inputLitrosUsados.value = '';
                    inputKlmActuales.value = '';
                    inputKlmProximos.value = '';
                    establecerFechaActual();
                    inputBuscarInsumo.value = ''; 

                    // Limpiar checkboxes de tipos de servicio
                    document.querySelectorAll('.tipo-servicio-cb').forEach(cb => { cb.checked = false; });
                    if (totalServicioDisplay) totalServicioDisplay.textContent = '$0';
                    
                    if (inputBuscarProducto) {
                        inputBuscarProducto.value = '';
                        tablaStockConsulta.style.display = 'none'; 
                        if(divPaginacionConsulta) divPaginacionConsulta.style.display = 'none';
                    }
                    
                    insumosItems.forEach(item => {
                        const inputVisual = item.querySelector('.insumo-cantidad-input');
                        const inputHidden = item.querySelector('.insumo-valor-real-ml');
                        const labelUnidad = item.querySelector('.insumo-unidad-label');
                        const btnMenos = item.querySelector('.btn-menos');

                        actualizarVisualDesdeMl(0, inputVisual, inputHidden, labelUnidad, btnMenos);
                        item.style.display = 'none'; 
                    });
                    
                    await cargarInsumos();
                    await cargarProductosCache();
                } else {
                    await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'Error al registrar el servicio' });
                }
            } catch (error) {
                console.error(error);
                await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'Error: ' + error.message });
            }
        });
    }


    // 6. VENTA PARTICULAR (SALIDA DE STOCK SIN VEHÍCULO - MULTI-PRODUCTO)
    if (formVentaParticular) {
        formVentaParticular.addEventListener('submit', async (e) => {
            e.preventDefault();

            const idUsuario = parseInt(localStorage.getItem('usuarioID')) || null;
            if (!idUsuario) {
                await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'Sesión no válida. Inicie sesión nuevamente.' });
                return;
            }

            const patenteVenta = inputVentaBusquedaCliente ? (inputVentaBusquedaCliente.dataset.patenteCliente || '') : '';
            const dniVenta = inputVentaBusquedaCliente ? (inputVentaBusquedaCliente.dataset.dniCliente || '') : '';
            if (!patenteVenta || !dniVenta) {
                await mostrarModal({ tipo: 'aviso', titulo: 'Campo Requerido', mensaje: 'Seleccione un cliente/vehículo de la lista.' });
                return;
            }

            const filas = ventaProductosBody ? ventaProductosBody.querySelectorAll('tr:not(#venta-productos-placeholder)') : [];
            if (!filas.length) {
                await mostrarModal({ tipo: 'aviso', titulo: 'Campo Requerido', mensaje: 'Agregue al menos un producto.' });
                return;
            }

            const items = [];
            for (const tr of filas) {
                const idProducto = parseInt(tr.dataset.idProducto, 10);
                const cantidad = parseFloat(tr.querySelector('.venta-cant-input').value) || 0;
                const esFiltro = tr.dataset.esFiltro === '1';

                if (cantidad <= 0) {
                    await mostrarModal({ tipo: 'aviso', titulo: 'Cantidad Requerida', mensaje: 'Todos los productos deben tener una cantidad válida.' });
                    return;
                }
                items.push({ idProducto, cantidad, esFiltro });
            }

            const detalle = (inputVentaDetalle ? inputVentaDetalle.value : '').trim();
            const fechaIso = (inputVentaFecha && inputVentaFecha.dataset.fechaIso) ? inputVentaFecha.dataset.fechaIso : (inputFecha.dataset.fechaIso || null);
            const precioTotal = recalcularTotalVenta();

            try {
                const res = await window.electronAPI.saveVentaParticular({
                    items,
                    detalle,
                    fecha: fechaIso,
                    idUsuario,
                    patente: patenteVenta,
                    dniCliente: parseInt(dniVenta, 10),
                    precioTotal
                });

                if (res && res.stockExcedido) {
                    await mostrarModal({ tipo: 'aviso', titulo: 'Stock insuficiente', mensaje: `¡LA CANTIDAD SELECCIONADA SUPERA EL STOCK DISPONIBLE! (${res.producto})` });
                    return;
                }

                if (res && res.success) {
                    await mostrarModal({ tipo: 'aviso', titulo: 'Éxito', mensaje: '¡SE HA REGISTRADO CORRECTAMENTE LA VENTA!' });

                    // Reset tabla de productos
                    ventaProductosBody.innerHTML = '<tr id="venta-productos-placeholder"><td colspan="5" style="text-align:center; color:#bbb; padding:10px;">Sin productos.</td></tr>';
                    if (inputVentaBusquedaCliente) {
                        inputVentaBusquedaCliente.value = '';
                        inputVentaBusquedaCliente.dataset.patenteCliente = '';
                        inputVentaBusquedaCliente.dataset.dniCliente = '';
                    }
                    if (inputVentaProducto) inputVentaProducto.value = '';
                    if (inputVentaDetalle) inputVentaDetalle.value = '';
                    if (ventaTotalDisplay) ventaTotalDisplay.textContent = '$0';
                    establecerFechaActual();

                    await cargarInsumos();
                    await cargarProductosCache();
                } else {
                    await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: (res && res.error) ? res.error : 'Error al registrar la venta.' });
                }
            } catch (err) {
                console.error(err);
                await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'Error: ' + (err.message || '') });
            }
        });
    }

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

    // 7. TIPOS DE SERVICIO (CHECKBOXES DINÁMICOS)
    const tiposServicioCheckboxes = document.getElementById('tipos-servicio-checkboxes');

    async function cargarTiposServicio() {
        if (!tiposServicioCheckboxes) return;
        try {
            const tipos = await window.electronAPI.getTiposServicio();
            tiposServicioCheckboxes.innerHTML = '';
            if (Array.isArray(tipos)) {
                tipos.forEach(ts => {
                    const label = document.createElement('label');
                    label.style.cssText = 'display:flex; align-items:center; gap:4px; color:#fff; cursor:pointer; padding:4px 8px; border:1px solid rgba(250,176,98,0.3); border-radius:6px; font-size:0.9em;';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.value = ts.nombre;
                    cb.dataset.precio = ts.precioBase || 0;
                    cb.className = 'tipo-servicio-cb';
                    cb.addEventListener('change', () => actualizarDescripcionDesdeTipos());
                    label.appendChild(cb);
                    label.appendChild(document.createTextNode(ts.nombre));
                    tiposServicioCheckboxes.appendChild(label);
                });
            }
        } catch (e) {
            console.error('Error cargando tipos de servicio:', e);
        }
    }

    function actualizarDescripcionDesdeTipos() {
        recalcularTotalServicio();
    }

    // 8. DOBLE CLIC EN CONSULTA DE STOCK → AUTO-AGREGAR INSUMOS
    if (tablaStockConsultaBody) {
        tablaStockConsultaBody.addEventListener('dblclick', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;
            
            // Encontrar el producto de la fila clickeada
            const index = Array.from(tablaStockConsultaBody.children).indexOf(row);
            if (index < 0 || index >= productosFiltradosConsulta.length) return;

            // Ajustar por paginación
            const inicio = (paginaConsulta - 1) * ITEMS_POR_PAGINA;
            const prod = productosFiltradosConsulta[inicio + index];
            if (!prod) return;

            // Buscar el insumo correspondiente en la botonera
            const insumoItem = contenedorInsumos.querySelector(`.insumo-item-servicios[data-id="${prod.idProducto}"]`);
            if (!insumoItem) return;

            const inputVisual = insumoItem.querySelector('.insumo-cantidad-input');
            const inputHidden = insumoItem.querySelector('.insumo-valor-real-ml');
            const labelUnidad = insumoItem.querySelector('.insumo-unidad-label');
            const btnMenos = insumoItem.querySelector('.btn-menos');

            const esFiltro = (prod.tipo || '').toLowerCase().includes('filtro');

            // Si es filtro: agregar 1 unidad. Si es líquido: agregar 1 litro (1000ml)
            let valorActual = parseFloat(inputHidden.value) || 0;
            if (esFiltro) {
                valorActual += 1;
            } else {
                valorActual += 1000; // 1 litro = 1000ml
            }

            actualizarVisualDesdeMl(valorActual, inputVisual, inputHidden, labelUnidad, btnMenos, esFiltro);

            // Marcar como en uso y mostrar
            insumoItem.classList.add('insumo-en-uso');
            insumoItem.style.display = 'flex';
            recalcularTotalServicio();
        });
    }

    cargarInsumos();
    cargarProductosCache();
    cargarTiposServicio();

    // PRE-CARGA DESDE PRESUPUESTO (Registrar como Servicio)
    const presuData = sessionStorage.getItem('presuRegistrar');
    if (presuData) {
        sessionStorage.removeItem('presuRegistrar');
        try {
            const presu = JSON.parse(presuData);
            presupuestoOrigenRegistrar = presu.idPresupuesto || null;
            if (presu.patente) {
                // Buscar el vehículo para obtener datos completos
                const resultados = await window.electronAPI.searchVehicles(presu.patente);
                if (resultados && resultados.length > 0) {
                    const v = resultados.find(r => r.patente === presu.patente) || resultados[0];
                    inputBusquedaVehiculo.value = formatearTextoVehiculoSeleccionado({
                        patente: v.patente,
                        marca: v.marca || '',
                        modelo: v.modelo || '',
                        klmProx: v.klmProx
                    });
                    inputBusquedaVehiculo.dataset.dniCliente = v.dni || presu.dniCliente || '';
                    inputBusquedaVehiculo.dataset.patenteCliente = v.patente;
                } else {
                    // Fallback: usar datos del presupuesto directamente
                    inputBusquedaVehiculo.value = formatearTextoVehiculoSeleccionado({
                        patente: presu.patente,
                        marca: '',
                        modelo: '',
                        klmProx: presu.klmProx || ''
                    });
                    inputBusquedaVehiculo.dataset.dniCliente = presu.dniCliente || '';
                    inputBusquedaVehiculo.dataset.patenteCliente = presu.patente;
                }
            }

            // Cargar items del presupuesto (tipos de servicio + productos)
            if (Array.isArray(presu.items)) {
                for (const item of presu.items) {
                    if (item.idTipoServicio) {
                        // Marcar checkbox de tipo de servicio
                        const allCbs = document.querySelectorAll('.tipo-servicio-cb');
                        for (const cb of allCbs) {
                            if (cb.value === item.tipoServicioNombre) {
                                cb.checked = true;
                                break;
                            }
                        }
                    } else if (item.idProducto) {
                        // Activar insumo con la cantidad correspondiente
                        const insumoItem = contenedorInsumos.querySelector(`.insumo-item-servicios[data-id="${item.idProducto}"]`);
                        if (insumoItem) {
                            const iv = insumoItem.querySelector('.insumo-cantidad-input');
                            const ih = insumoItem.querySelector('.insumo-valor-real-ml');
                            const lu = insumoItem.querySelector('.insumo-unidad-label');
                            const bm = insumoItem.querySelector('.btn-menos');
                            const ef = !!item.esFiltro;
                            const ml = ef ? item.cantidad : item.cantidad * 1000;
                            actualizarVisualDesdeMl(ml, iv, ih, lu, bm, ef);
                            insumoItem.classList.add('insumo-en-uso');
                            insumoItem.style.display = 'flex';
                        }
                    }
                }
            }

            recalcularTotalServicio();
        } catch (e) {
            console.error('Error al pre-cargar presupuesto:', e);
        }
    }
});
