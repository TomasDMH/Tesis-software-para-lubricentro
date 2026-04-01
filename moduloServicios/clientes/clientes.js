// MÓDULO CLIENTES (Frontend)
// ABM de clientes, vehículos e historial.

document.addEventListener('DOMContentLoaded', async () => {
    // FUNCIÓN DE FORMATEO DE NÚMEROS
    function formatearNumero(valor) {
        if (!valor || valor === '-' || valor === 'N/D') return valor;
        const numero = valor.toString().replace(/\D/g, '');
        if (numero === '' || numero === '0') return valor;
        return numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function validarPatenteConLetrasYNumeros(patente) {
        const valor = (patente || '').toString().trim().toUpperCase().replace(/\s+/g, '');
        if (!valor) return false;
        return /[A-Z]/.test(valor) && /\d/.test(valor);
    }

    // --- REFERENCIAS DOM GLOBALES ---
    const formClientes = document.querySelector('.form-clientes');
    const listaClientesContainer = document.getElementById('lista-clientes');
    const tablaHistorialBody = document.querySelector('#historial-servicios-clientes tbody');
    const inputBusqueda = document.querySelector('.buscar-cliente-input');
    const btnEliminar = document.querySelector('.eliminar-seleccionado-clientes');
    const tablaVehiculosBody = document.querySelector('.vehiculos-table-clientes tbody');

    // Bloquear años negativos o inválidos en tiempo real (delegación de eventos)
    document.querySelector('.vehiculos-table-clientes').addEventListener('input', (e) => {
        if (e.target.type === 'number' && e.target.closest('td')) {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val < 0) e.target.value = '';
        }
    });

    // Referencias para Edición
    const inpIdOculto = document.getElementById('cliente-id-oculto');
    const btnLimpiarEdicion = document.getElementById('btn-limpiar-edicion');
    const btnGuardarSubmit = document.querySelector('.guardar-cliente-btn');

    // Paginación del historial
    const divPaginacionHistorial = document.getElementById('paginacion-historial-controls');
    const btnPrevHistorial = document.getElementById('btn-prev-historial');
    const btnNextHistorial = document.getElementById('btn-next-historial');
    const spanInfoPaginaHistorial = document.getElementById('info-pagina-historial');

    // Referencias Modal
    const modal = document.getElementById('modal-sistema');
    const elTitulo = document.getElementById('modal-titulo');
    const elMensaje = document.getElementById('modal-mensaje');
    const elSubMensaje = document.getElementById('modal-submensaje');

    let clienteSeleccionadoId = null;
    let clientesRenderizados = [];
    
    // Variables de paginación (clientes)
    let paginaClientes = 1;
    let totalClientes = 0;
    let busquedaClientes = '';
    const ITEMS_CLIENTES = 15;

    // Variables de paginación (historial)
    let totalHistorial = 0;
    let paginaHistorial = 1;
    const ITEMS_HISTORIAL = 15;

    if (!listaClientesContainer || !tablaHistorialBody) return;

    // Cache de marcas de vehículo
    let marcasVehiculoCache = [];

    async function cargarMarcasVehiculo() {
        try {
            marcasVehiculoCache = await window.electronAPI.getMarcasVehiculo();
        } catch (e) {
            marcasVehiculoCache = [];
        }
    }

    function generarOpcionesMarcaVehiculo(valorSeleccionado) {
        let html = '<option value="">Marca</option>';
        marcasVehiculoCache.forEach(m => {
            const sel = (m.nombre === valorSeleccionado) ? ' selected' : '';
            html += `<option value="${m.nombre}"${sel}>${m.nombre}</option>`;
        });
        // Si el valor no está en la lista, agregarlo
        if (valorSeleccionado && !marcasVehiculoCache.some(m => m.nombre === valorSeleccionado)) {
            html += `<option value="${valorSeleccionado}" selected>${valorSeleccionado}</option>`;
        }
        return html;
    }

    function poblarSelectsMarcaVehiculo() {
        document.querySelectorAll('.select-marca-vehiculo').forEach(sel => {
            const valorActual = sel.value;
            sel.innerHTML = generarOpcionesMarcaVehiculo(valorActual);
        });
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
                btnSi_Actual.classList.add('confirmar'); // ROJO
            } else {
                btnSi_Actual.classList.add('aceptar');   // VERDE
            }

            if (config.tipo === 'aviso') {
                btnNo_Actual.style.display = 'none';
            } else {
                btnNo_Actual.style.display = 'block';
                btnNo_Actual.textContent = 'Cancelar';
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

    // 1. GESTIÓN DE FORMULARIO (ALTA / EDICIÓN)

    function resetearFormulario() {
        formClientes.reset();
        inpIdOculto.value = ''; 
        
        tablaVehiculosBody.innerHTML = `
            <tr>
                <td>
                    <select class="input-vehiculos-clientes select-marca-vehiculo" required>
                        <option value="">Marca</option>
                    </select>
                </td>
                <td><input type="text" class="input-vehiculos-clientes" placeholder="Modelo" required></td>
                <td><input type="text" class="input-vehiculos-clientes" placeholder="Patente" required></td>
                <td><input type="number" class="input-vehiculos-clientes" placeholder="Año" min="1900" max="2100" required></td>
                <td><button type="button" class="vehiculo-btn-clientes agregar-clientes">+</button></td>
            </tr>`;
        
        poblarSelectsMarcaVehiculo();
        btnGuardarSubmit.textContent = "Guardar Cliente";
        if(btnLimpiarEdicion) btnLimpiarEdicion.style.display = 'none';
        
        document.querySelectorAll('.cliente-card-clientes').forEach(c => c.classList.remove('seleccionado'));
        clienteSeleccionadoId = null;
        
        // Resetear tabla historial
        tablaHistorialBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Seleccione un cliente...</td></tr>';
        if (divPaginacionHistorial) divPaginacionHistorial.style.display = 'none';
    }

    if(btnLimpiarEdicion) {
        btnLimpiarEdicion.addEventListener('click', resetearFormulario);
    }

    async function llenarFormularioEdicion(cliente) {
        inpIdOculto.value = cliente.id;
        
        if (cliente.nombre && cliente.nombre.includes(',')) {
            const partes = cliente.nombre.split(',');
            document.getElementById('apellido-clientes').value = partes[0].trim();
            document.getElementById('nombre-clientes').value = partes[1].trim();
        } else {
            document.getElementById('nombre-clientes').value = cliente.nombre;
            document.getElementById('apellido-clientes').value = '';
        }

        document.getElementById('telefono-clientes').value = cliente.telefono || '';
        document.getElementById('dni-clientes').value = cliente.dni || '';
        const emailInput = document.getElementById('email-clientes');
        if (emailInput) emailInput.value = cliente.email || '';

        try {
            const vehiculos = await window.electronAPI.getClientVehicles(cliente.id);
            tablaVehiculosBody.innerHTML = ''; 
            
            if (vehiculos && vehiculos.length > 0) {
                vehiculos.forEach(v => {
                    const fila = document.createElement('tr');
                    fila.innerHTML = `
                        <td>
                            <select class="input-vehiculos-clientes select-marca-vehiculo" required>
                                ${generarOpcionesMarcaVehiculo(v.marca)}
                            </select>
                        </td>
                        <td><input type="text" class="input-vehiculos-clientes" value="${v.modelo}" required></td>
                        <td><input type="text" class="input-vehiculos-clientes" value="${v.patente}" required></td>
                        <td><input type="number" class="input-vehiculos-clientes" value="${v.año}" min="1900" max="2100" required></td>
                        <td><button type="button" class="vehiculo-btn-clientes quitar-clientes">-</button></td>
                    `;
                    tablaVehiculosBody.appendChild(fila);
                });
            }
            
            const filaPlus = document.createElement('tr');
            filaPlus.innerHTML = `
                <td>
                    <select class="input-vehiculos-clientes select-marca-vehiculo">
                        ${generarOpcionesMarcaVehiculo('')}
                    </select>
                </td>
                <td><input type="text" class="input-vehiculos-clientes"></td>
                <td><input type="text" class="input-vehiculos-clientes"></td>
                <td><input type="number" class="input-vehiculos-clientes"></td>
                <td><button type="button" class="vehiculo-btn-clientes agregar-clientes">+</button></td>
            `;
            tablaVehiculosBody.appendChild(filaPlus);

        } catch (error) {
            console.error("Error trayendo vehículos:", error);
        }

        btnGuardarSubmit.textContent = "Modificar Cliente";
        if(btnLimpiarEdicion) btnLimpiarEdicion.style.display = 'block';
    }

    if (tablaVehiculosBody) {
        tablaVehiculosBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('agregar-clientes')) {
                e.preventDefault();
                const nuevaFila = document.createElement('tr');
                nuevaFila.innerHTML = `
                    <td>
                        <select class="input-vehiculos-clientes select-marca-vehiculo" required>
                            ${generarOpcionesMarcaVehiculo('')}
                        </select>
                    </td>
                    <td><input type="text" class="input-vehiculos-clientes" placeholder="Modelo" required></td>
                    <td><input type="text" class="input-vehiculos-clientes" placeholder="Patente" required></td>
                    <td><input type="number" class="input-vehiculos-clientes" placeholder="Año" min="1900" max="2100" required></td>
                    <td><button type="button" class="vehiculo-btn-clientes quitar-clientes">-</button></td>
                `;
                tablaVehiculosBody.appendChild(nuevaFila);
            }
            if (e.target.classList.contains('quitar-clientes')) {
                e.preventDefault();
                if (tablaVehiculosBody.querySelectorAll('tr').length > 1) {
                    e.target.closest('tr').remove();
                }
            }
        });
    }

    if (formClientes) {
        formClientes.addEventListener('submit', async (e) => {
            e.preventDefault();

            const idEdicion = inpIdOculto.value; 
            const accionTexto = idEdicion ? "Modificar Cliente" : "Guardar Cliente";

            const datosCliente = {
                id: idEdicion || null,
                nombre: document.getElementById('nombre-clientes').value.trim(),
                apellido: document.getElementById('apellido-clientes').value.trim(),
                telefono: document.getElementById('telefono-clientes').value.trim(),
                dni: document.getElementById('dni-clientes').value.trim(),
                email: (document.getElementById('email-clientes') ? document.getElementById('email-clientes').value.trim() : ''),
                vehiculos: []
            };

            tablaVehiculosBody.querySelectorAll('tr').forEach(fila => {
                const selectMarca = fila.querySelector('.select-marca-vehiculo');
                const inputs = fila.querySelectorAll('input');
                const marca = selectMarca ? selectMarca.value.trim() : (inputs[0] ? inputs[0].value.trim() : '');
                const modelo = inputs[0] ? inputs[0].value.trim() : '';
                const patente = inputs[1] ? inputs[1].value.trim() : '';
                const anio = inputs[2] ? inputs[2].value.trim() : '';
                
                // Si hay select, los inputs empiezan desde modelo
                if (selectMarca) {
                    const modeloVal = inputs[0] ? inputs[0].value.trim() : '';
                    const patenteVal = inputs[1] ? inputs[1].value.trim() : '';
                    const anioVal = inputs[2] ? inputs[2].value.trim() : '';
                    if (marca && patenteVal) {
                        datosCliente.vehiculos.push({
                            marca: marca,
                            modelo: modeloVal,
                            patente: patenteVal.toUpperCase(),
                            anio: anioVal
                        });
                    }
                } else if (inputs[0] && inputs[0].value && inputs[2] && inputs[2].value) {
                    datosCliente.vehiculos.push({
                        marca: inputs[0].value.trim(),
                        modelo: inputs[1] ? inputs[1].value.trim() : '',
                        patente: inputs[2].value.trim().toUpperCase(),
                        anio: inputs[3] ? inputs[3].value.trim() : ''
                    });
                }
            });

            if (datosCliente.vehiculos.length === 0) {
                await mostrarModal({ 
                    tipo: 'aviso', 
                    titulo: 'Datos Incompletos', 
                    mensaje: 'Por favor ingrese al menos un Vehículo.',
                    textoConfirmar: 'Cerrar'
                });
                return;
            }

            const patentesInvalidas = datosCliente.vehiculos
                .map(v => (v && v.patente ? v.patente.toString().trim().toUpperCase() : ''))
                .filter(p => !validarPatenteConLetrasYNumeros(p));

            if (patentesInvalidas.length > 0) {
                await mostrarModal({
                    tipo: 'aviso',
                    titulo: 'Patente inválida',
                    mensaje: 'Cada patente debe incluir letras y números.',
                    submensaje: `Corregir: ${patentesInvalidas.join(', ')}`,
                    textoConfirmar: 'Cerrar'
                });
                return;
            }

            const confirmar = await mostrarModal({
                tipo: 'guardar',
                titulo: idEdicion ? 'Confirmar Modificación' : 'Confirmar Registro',
                mensaje: `¿Seguro desea ${idEdicion ? 'modificar los datos de' : 'registrar a'} este cliente?`,
                submensaje: 'Verifique que los datos ingresados sean correctos.',
                textoConfirmar: accionTexto
            });

            if (confirmar) {
                try {
                    const resultado = await window.electronAPI.saveClient(datosCliente);
                    if (resultado.success) {
                        await mostrarModal({ 
                            tipo: 'aviso', 
                            titulo: '¡Éxito!', 
                            mensaje: idEdicion ? 'Cliente modificado correctamente.' : 'Cliente registrado correctamente.',
                            textoConfirmar: 'Cerrar'
                        });

                        resetearFormulario();
                        paginaClientes = 1;
                        busquedaClientes = '';
                        if (inputBusqueda) inputBusqueda.value = '';
                        await cargarClientes();
                    } else {
                        await mostrarModal({
                            tipo: 'aviso',
                            titulo: 'Error',
                            mensaje: (resultado && resultado.error) ? resultado.error : 'No se pudo guardar el cliente.',
                            textoConfirmar: 'Cerrar'
                        });
                    }
                } catch (error) {
                    console.error(error);
                    await mostrarModal({ 
                        tipo: 'aviso', 
                        titulo: 'Error', 
                        mensaje: 'EL CLIENTE YA EXISTE',
                        textoConfirmar: 'Cerrar'
                    });
                }
            }
        });
    }

    // 2. LÓGICA DE LISTADO Y ELIMINACIÓN

    // Formatea patente: Mercosur (AB123CD -> AB 123 CD) o Vieja (ABC123 -> ABC 123)
    function formatearPatente(pat) {
        const limpio = pat.replace(/\s+/g, '').toUpperCase();
        // Mercosur: 2 letras + 3 números + 2 letras (AA123AA)
        const mercosur = limpio.match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/);
        if (mercosur) return { texto: `${mercosur[1]} ${mercosur[2]} ${mercosur[3]}`, tipo: 'mercosur' };
        // Vieja: 3 letras + 3 números (AAA123)
        const vieja = limpio.match(/^([A-Z]{3})(\d{3})$/);
        if (vieja) return { texto: `${vieja[1]} ${vieja[2]}`, tipo: 'vieja' };
        return { texto: pat, tipo: 'vieja' };
    }

    function renderizarClientes(clientes) {
        clientesRenderizados = clientes || [];
        listaClientesContainer.innerHTML = ''; 
        if (clientesRenderizados.length > 0) {
            clientesRenderizados.forEach(cliente => {
                const clienteCard = document.createElement('article');
                clienteCard.classList.add('cliente-card-clientes');
                clienteCard.setAttribute('data-id', cliente.id);

                let fechaFormateada = 'N/D';
                if (cliente.ultimaVisita) {
                    const [anio, mes, dia] = cliente.ultimaVisita.split('-');
                    fechaFormateada = `${dia}/${mes}/${anio}`;
                }

                // Limitar a 5 patentes visibles con formato legible
                let patentesHTML = '<span style="color:#888;">Sin Vehículo</span>';
                if (cliente.patentes) {
                    const listaPatentes = cliente.patentes.split(',');
                    const visibles = listaPatentes.length > 5 ? listaPatentes.slice(0, 5) : listaPatentes;
                    patentesHTML = visibles.map(p => {
                        const { texto, tipo } = formatearPatente(p.trim());
                        const clase = tipo === 'mercosur' ? 'patente-mercosur' : 'patente-vieja';
                        return `<span class="${clase}">${texto}</span>`;
                    }).join(' / ');
                    if (listaPatentes.length > 5) patentesHTML += ' ...';
                }

                clienteCard.innerHTML = `
                    <strong>${cliente.nombre || 'Nombre no disponible'}</strong>
                    <br>DNI: ${cliente.dni || 'N/D'}
                    <br>Patente: ${patentesHTML}  
                    <br>Ult. Visita: ${fechaFormateada} 
                    <br>Servicio: ${cliente.ultimoServicio || 'Sin servicios registrados'} `;

                listaClientesContainer.appendChild(clienteCard);
            });
        } else {
            listaClientesContainer.innerHTML = '<p style="color: #fab66d; text-align: center;">NO HAY REGISTRO DE ESE CLIENTE</p>';
        }
    }

    // Delegación de eventos (1 solo listener en el contenedor padre)
    listaClientesContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.cliente-card-clientes');
        if (!card) return;
        const id = parseInt(card.dataset.id);
        const cliente = clientesRenderizados.find(c => c.id === id);
        if (!cliente) return;

        clienteSeleccionadoId = cliente.id;
        document.querySelectorAll('.cliente-card-clientes').forEach(c => c.classList.remove('seleccionado'));
        card.classList.add('seleccionado');
        cargarHistorial(cliente.id);
        llenarFormularioEdicion(cliente);
    });

    async function cargarClientes() {
        try {
            let resultado;
            if (busquedaClientes) {
                resultado = await window.electronAPI.searchClients(busquedaClientes, { pagina: paginaClientes, limite: ITEMS_CLIENTES });
            } else {
                resultado = await window.electronAPI.getClients({ pagina: paginaClientes, limite: ITEMS_CLIENTES });
            }
            totalClientes = resultado.total;
            renderizarClientes(resultado.rows);
            actualizarPaginacionClientes();
        } catch (e) { console.error(e); }
    }

    function actualizarPaginacionClientes() {
        const divPagClientes = document.getElementById('paginacion-clientes-controls');
        const spanInfoClientes = document.getElementById('info-pagina-clientes');
        const btnPrevClientes = document.getElementById('btn-prev-clientes');
        const btnNextClientes = document.getElementById('btn-next-clientes');
        if (!divPagClientes) return;

        const totalPaginas = Math.ceil(totalClientes / ITEMS_CLIENTES) || 1;
        if (totalClientes <= ITEMS_CLIENTES) {
            divPagClientes.style.display = 'none';
        } else {
            divPagClientes.style.display = 'flex';
            spanInfoClientes.textContent = `${paginaClientes} / ${totalPaginas}`;
            btnPrevClientes.disabled = (paginaClientes === 1);
            btnNextClientes.disabled = (paginaClientes >= totalPaginas);
        }
    }

    // Eventos paginación clientes
    document.addEventListener('click', (e) => {
        if (e.target.id === 'btn-prev-clientes') {
            if (paginaClientes > 1) { paginaClientes--; cargarClientes(); }
        }
        if (e.target.id === 'btn-next-clientes') {
            const totalPaginas = Math.ceil(totalClientes / ITEMS_CLIENTES);
            if (paginaClientes < totalPaginas) { paginaClientes++; cargarClientes(); }
        }
    });

    // Cargar marcas de vehículo y luego clientes
    await cargarMarcasVehiculo();
    poblarSelectsMarcaVehiculo();
    cargarClientes();

    // --- Agregar Marca de Vehículo ---
    const btnAgregarMarcaVeh = document.getElementById('btn-agregar-marca-vehiculo');
    const inputNuevaMarcaVeh = document.getElementById('input-nueva-marca-vehiculo');
    if (btnAgregarMarcaVeh) {
        btnAgregarMarcaVeh.addEventListener('click', async () => {
            const nombre = (inputNuevaMarcaVeh.value || '').trim();
            if (!nombre) {
                await mostrarModal({ tipo: 'aviso', titulo: 'Atención', mensaje: 'Ingrese un nombre de marca.', textoConfirmar: 'Cerrar' });
                return;
            }
            try {
                await window.electronAPI.saveMarcaVehiculo(nombre);
                inputNuevaMarcaVeh.value = '';
                await cargarMarcasVehiculo();
                poblarSelectsMarcaVehiculo();
                await mostrarModal({ tipo: 'aviso', titulo: 'Éxito', mensaje: `Marca "${nombre}" agregada correctamente.`, textoConfirmar: 'Cerrar' });
            } catch (err) {
                console.error(err);
                await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'No se pudo guardar la marca.', textoConfirmar: 'Cerrar' });
            }
        });
    }

    if (btnEliminar) {
        btnEliminar.addEventListener('click', async () => {
            if (!clienteSeleccionadoId) {
                await mostrarModal({ 
                    tipo: 'aviso', 
                    titulo: 'Atención', 
                    mensaje: 'Por favor, seleccione un cliente primero.',
                    textoConfirmar: 'Cerrar'
                });
                return;
            }

            const confirmar = await mostrarModal({
                tipo: 'eliminar', 
                titulo: 'Eliminar Cliente',
                mensaje: '¿Seguro desea eliminar el cliente?',
                submensaje: 'SE ELIMINARÁ TODO SU HISTORIAL.',
                textoConfirmar: 'Eliminar Definitivamente'
            });
            
            if (confirmar) {
                try {
                    await window.electronAPI.deleteClient(clienteSeleccionadoId);
                    
                    await mostrarModal({
                        tipo: 'aviso',
                        titulo: '¡Éxito!',
                        mensaje: 'Cliente eliminado correctamente.',
                        textoConfirmar: 'Cerrar'
                    });

                    if (inpIdOculto.value == clienteSeleccionadoId) {
                        resetearFormulario();
                    }

                    clienteSeleccionadoId = null;
                    tablaHistorialBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Seleccione un cliente...</td></tr>';
                    if (divPaginacionHistorial) divPaginacionHistorial.style.display = 'none';
                    
                    if (inputBusqueda) {
                        inputBusqueda.value = '';
                        inputBusqueda.disabled = false;
                        setTimeout(() => inputBusqueda.focus(), 50);
                    }
                    
                    paginaClientes = 1;
                    busquedaClientes = '';
                    await cargarClientes();

                } catch (error) {
                    console.error("Error al eliminar:", error);
                    await mostrarModal({ 
                        tipo: 'aviso', 
                        titulo: 'Error', 
                        mensaje: 'Hubo un error al intentar eliminar.',
                        textoConfirmar: 'Cerrar'
                    });
                }
            } else {
                if (inputBusqueda) inputBusqueda.focus();
            }
        });
    }

    // Normaliza texto quitando tildes/acentos para búsqueda insensible
    function normalizarTexto(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', async (e) => {
            busquedaClientes = normalizarTexto(inputBusqueda.value.trim());
            paginaClientes = 1;
            await cargarClientes();
        });
    }

    // 3. HISTORIAL DE SERVICIOS (CON PAGINACIÓN SERVER-SIDE)
    async function cargarHistorial(idClient, resetPagina = true) {
        try {
            tablaHistorialBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Cargando...</td></tr>';
            if (resetPagina) paginaHistorial = 1;

            const resultado = await window.electronAPI.getClientHistory(idClient, { pagina: paginaHistorial, limite: ITEMS_HISTORIAL });
            totalHistorial = resultado.total;
            renderizarHistorialPaginado(resultado.rows);

        } catch (e) { console.error(e); }
    }

    function renderizarHistorialPaginado(items) {
        tablaHistorialBody.innerHTML = '';

        if (!items || items.length === 0) {
            tablaHistorialBody.innerHTML = '<tr><td colspan="10">Sin historial.</td></tr>';
            if (divPaginacionHistorial) divPaginacionHistorial.style.display = 'none';
            return;
        }

        const inicio = (paginaHistorial - 1) * ITEMS_HISTORIAL;
        items.forEach((item, index) => {
            let f = item.fecha;
            if (f && f.includes('-')) { const [a,m,d] = f.split('-'); f = `${d}/${m}/${a}`; }

            const litros = item.litrosAceite ? formatearNumero(item.litrosAceite) : '-';
            const klmAct = item.klmAct ? formatearNumero(item.klmAct) : '-';
            const klmProx = item.klmProx ? formatearNumero(item.klmProx) : '-';
            const precio = item.precio != null ? Math.round(parseFloat(item.precio)).toLocaleString('es-AR') : '-';
            const productosUsados = item.productosUsados || '-';
            const indiceReal = inicio + index + 1;

            const row = document.createElement('tr');
            row.innerHTML = `<td>${indiceReal}</td><td>${item.dueno||'-'}</td><td>${item.vehiculo||'-'}</td><td>${item.servicio||'-'}</td><td>${litros}</td><td>${productosUsados}</td><td>${klmAct}</td><td>${klmProx}</td><td>$${precio}</td><td>${f}</td>`;
            tablaHistorialBody.appendChild(row);
        });

        if (divPaginacionHistorial) {
            const totalPaginas = Math.ceil(totalHistorial / ITEMS_HISTORIAL) || 1;
            divPaginacionHistorial.style.display = 'flex';
            spanInfoPaginaHistorial.textContent = `Página ${paginaHistorial} de ${totalPaginas}`;
            btnPrevHistorial.disabled = (paginaHistorial === 1);
            btnNextHistorial.disabled = (paginaHistorial >= totalPaginas);
        }
    }

    // Eventos de botones paginación historial
    if (btnPrevHistorial && btnNextHistorial) {
        btnPrevHistorial.addEventListener('click', () => {
            if (paginaHistorial > 1 && clienteSeleccionadoId) {
                paginaHistorial--;
                cargarHistorial(clienteSeleccionadoId, false);
            }
        });

        btnNextHistorial.addEventListener('click', () => {
            const totalPaginas = Math.ceil(totalHistorial / ITEMS_HISTORIAL);
            if (paginaHistorial < totalPaginas && clienteSeleccionadoId) {
                paginaHistorial++;
                cargarHistorial(clienteSeleccionadoId, false);
            }
        });
    }

    // 4. BOTÓN CERRAR SESIÓN (POWER)
    const btnCerrarSesion = document.querySelector('.boton-cierre-sesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            const confirmar = await mostrarModal({
                tipo: 'confirmar',
                titulo: 'Cerrar Sesión',
                mensaje: '¿Seguro que desea cerrar sesión y salir?',
                submensaje: 'Se cerrará la sesión actual.',
                textoConfirmar: 'Cerrar Sesión'
            });

            if (confirmar) {
                window.location.href = '../../moduloLogin/login/login.html';
            }
        });
    }
});