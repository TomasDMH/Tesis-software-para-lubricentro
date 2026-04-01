// MÓDULO ABM USUARIOS (Frontend)
// Alta, baja y modificación de usuarios.

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.querySelector('form');
    const listaUsuariosDiv = document.querySelector('.lista-usuarios');
    const btnEliminar = document.querySelector('.eliminar-seleccionado-usuarios');
    
    // Modal del sistema (lo usamos para avisos y confirmaciones)
    const modal = document.getElementById('modal-sistema');
    const elTitulo = document.getElementById('modal-titulo');
    const elMensaje = document.getElementById('modal-mensaje');
    const elSubMensaje = document.getElementById('modal-submensaje');

    // Función maestra del modal (reemplaza alert() y confirm())
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

    // Cerrar sesión: vuelve a la pantalla de login
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
                // Redirige a la pantalla de Login
                window.location.href = '../login/login.html';
            }
        });
    }
    
    // Inputs del formulario (alta / edición)
    const inputNombre = document.getElementById('nombre-completo');
    const inputRol = document.getElementById('rol-usuario');
    const inputPass = document.getElementById('contrasena-usuario');
    const inputIdEdicion = document.getElementById('id-usuario-edicion');
    const btnSubmit = document.querySelector('.registrar-usuario-btn');
    const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion-abm');
    const tituloForm = document.querySelector('.panel-izq-abm-usuarios .subtitulo-abm-usuarios');
    
    let usuarioSeleccionadoId = null;

    // MAPEO DE ROLES (ID <-> valor del select)
    function rolIdAValor(idRol) {
        if (idRol === 1) return 'admin';
        if (idRol === 3) return 'presidente';
        if (idRol === 4) return 'encargado';
        return 'empleado'; // default
    }

    function rolTexto(idRol) {
        if (idRol === 1) return 'Administrador';
        if (idRol === 3) return 'Presidente';
        if (idRol === 4) return 'Encargado';
        return 'Empleado';
    }

    // RESETEAR FORMULARIO (volver a modo "Alta")
    function resetearFormulario() {
        form.reset();
        inputIdEdicion.value = '';
        usuarioSeleccionadoId = null;
        tituloForm.textContent = 'Registrar Usuario';
        btnSubmit.textContent = 'Registrar Usuario';
        btnCancelarEdicion.style.display = 'none';
        document.querySelectorAll('.usuario-card').forEach(el => el.style.border = '1px solid #ccc');
    }

    // 1) Cargar usuarios en la lista
    async function cargarUsuarios() {
        listaUsuariosDiv.innerHTML = ''; // Limpiar la lista antes de recargar
        try {
            const usuarios = await window.electronAPI.getUsers();
            
            usuarios.forEach(u => {
                const item = document.createElement('div');
                item.className = 'usuario-item';
                
                item.innerHTML = `
                    <article class="usuario-card" data-id="${u.idUsuario}" data-nombre="${u.nombreUsuario}" data-rol="${u.idRol}">
                        <strong>${u.nombreUsuario}</strong>
                        <br>Rol: ${rolTexto(u.idRol)}
                    </article>
                `;

                // Click: seleccionar usuario y pasar a modo edición
                const card = item.querySelector('.usuario-card');
                card.addEventListener('click', () => {
                    // Marcar selección visual (borde rojo)
                    document.querySelectorAll('.usuario-card').forEach(el => el.style.border = '1px solid #ccc');
                    card.style.border = '2px solid #e20613';

                    // Guardar el ID seleccionado
                    usuarioSeleccionadoId = u.idUsuario;
                    btnEliminar.disabled = false;

                    // Cargar datos en el formulario (modo edición)
                    inputIdEdicion.value = u.idUsuario;
                    inputNombre.value = u.nombreUsuario;
                    inputRol.value = rolIdAValor(u.idRol);
                    inputPass.value = ''; // Vacío por seguridad, se rellena solo si quiere cambiarla
                    inputPass.placeholder = 'Dejar vacío para no cambiar';

                    // Ajustar título/botón para edición
                    tituloForm.textContent = 'Modificar Usuario';
                    btnSubmit.textContent = 'Modificar Usuario';
                    btnCancelarEdicion.style.display = 'inline-block';
                });

                listaUsuariosDiv.appendChild(item);
            });
        } catch (error) {
            console.error("Error cargando usuarios:", error);
        }
    }

    // 2) Cancelar edición
    btnCancelarEdicion.addEventListener('click', () => {
        resetearFormulario();
        inputPass.placeholder = '';
    });

    // 3) Guardar / Modificar usuario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const idEdicion = inputIdEdicion.value;
        const esEdicion = !!idEdicion;

        const datosUsuario = {
            id: esEdicion ? parseInt(idEdicion) : null,
            nombreCompleto: inputNombre.value,
            usuario: inputNombre.value,
            rol: inputRol.value,
            password: inputPass.value
        };

        // Validación: usuario obligatorio
        if (!datosUsuario.usuario) {
            await mostrarModal({
                tipo: 'aviso',
                titulo: 'Atención',
                mensaje: '¡NO SE HAN COMPLETADO CORRECTAMENTE LOS DATOS!',
                textoConfirmar: 'Cerrar'
            });
            return;
        }

        // Validación: contraseña obligatoria solo en alta
        if (!esEdicion && !datosUsuario.password) {
            await mostrarModal({
                tipo: 'aviso',
                titulo: 'Atención',
                mensaje: '¡NO SE HAN COMPLETADO CORRECTAMENTE LOS DATOS!',
                textoConfirmar: 'Cerrar'
            });
            return;
        }

        try {
            const res = await window.electronAPI.saveUser(datosUsuario);
            if (res.success) {
                await mostrarModal({
                    tipo: 'aviso',
                    titulo: '¡Éxito!',
                    mensaje: esEdicion ? '¡USUARIO MODIFICADO CORRECTAMENTE!' : '¡USUARIO REGISTRADO CORRECTAMENTE!',
                    textoConfirmar: 'Cerrar'
                });
                resetearFormulario();
                inputPass.placeholder = '';
                cargarUsuarios();
            }else{
                await mostrarModal({
                        tipo: 'aviso',
                        titulo: 'Atención',
                        mensaje: '¡USUARIO YA EXISTENTE!',
                        textoConfirmar: 'Cerrar'
                });
            }
        } catch (error) {
            if (error.message && error.message.includes("UNIQUE")) {
                await mostrarModal({
                    tipo: 'aviso',
                    titulo: 'Atención',
                    mensaje: '¡USUARIO YA EXISTENTE!',
                    textoConfirmar: 'Cerrar'
                });
            }
        }
    });

    // 4) Eliminar usuario
    btnEliminar.addEventListener('click', async () => {
        if(!usuarioSeleccionadoId) {
            await mostrarModal({
                tipo: 'aviso',
                titulo: 'Atención',
                mensaje: 'Por favor seleccione un usuario primero.',
                textoConfirmar: 'Cerrar'
            });
            return;
        }

        const confirmar = await mostrarModal({
            tipo: 'eliminar',
            titulo: 'Eliminar Usuario',
            mensaje: '¿Está seguro que desea eliminar el usuario?',
            textoConfirmar: 'Eliminar Definitivamente'
        });
        
        if(confirmar) {
            try {
                await window.electronAPI.deleteUser(usuarioSeleccionadoId);
                await mostrarModal({
                    tipo: 'aviso',
                    titulo: '¡Éxito!',
                    mensaje: 'Usuario eliminado correctamente.',
                    textoConfirmar: 'Cerrar'
                });
                resetearFormulario();
                inputPass.placeholder = '';
                cargarUsuarios();
            } catch (error) {
                console.error(error);
                await mostrarModal({
                    tipo: 'aviso',
                    titulo: 'Error',
                    mensaje: 'Hubo un error al eliminar el usuario.',
                    textoConfirmar: 'Cerrar'
                });
            }
        }
    });

    // BUSCADOR EN VIVO DE USUARIOS (filtra la lista, no consulta BD)
    const inputBuscarUsuario = document.querySelector('.buscar-usuario-input');
    if (inputBuscarUsuario) {
        inputBuscarUsuario.addEventListener('input', () => {
            const termino = inputBuscarUsuario.value.toLowerCase().trim();
            const items = document.querySelectorAll('.usuario-item');
            let encontrados = 0;

            // 1) Filtrar elementos y contar coincidencias
            items.forEach(item => {
                const card = item.querySelector('.usuario-card');
                if (!card) return;
                const nombre = (card.dataset.nombre || '').toLowerCase();
                
                if (nombre.includes(termino)) {
                    item.style.display = '';
                    encontrados++;
                } else {
                    item.style.display = 'none';
                }
            });

            // 2) Si no hay coincidencias, mostramos el mensaje (igual que Stock)
            // Primero borramos el mensaje anterior, así no se duplica
            const mensajeExistente = document.getElementById('error-busqueda-usuario');
            if (mensajeExistente) mensajeExistente.remove();

            // Si el contador da 0, inyectamos el mensaje
            if (encontrados === 0) {
                const mensajeDiv = document.createElement('div');
                mensajeDiv.id = 'error-busqueda-usuario';
                mensajeDiv.style.width = '100%';
                mensajeDiv.innerHTML = `
                    <div style="text-align:center; padding: 20px; color: #fab66d; font-weight: bold;">
                        ¡USUARIO NO ENCONTRADO!
                    </div>
                `;
                listaUsuariosDiv.appendChild(mensajeDiv);
            }
        });
    }
   

    // Cargar al inicio
    cargarUsuarios();
});
