// MÓDULO LOGIN (Frontend)
// Inicio de sesión y opción "Recordarme".

document.addEventListener('DOMContentLoaded', () => {
    // Lógica del Ojo (Mostrar/Ocultar contraseña)
    const togglePassword = document.querySelector('#togglePassword');
    const passwordInput = document.querySelector('#contrasena');
    const usuarioInput = document.querySelector('#usuario');
    const btnLogin = document.querySelector('.btn-login');
    const checkRecordarme = document.querySelector('#recordarme');

    // Modal
    const modalOverlay = document.getElementById('modal-sistema');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalMensaje = document.getElementById('modal-mensaje');
    const modalSubmensaje = document.getElementById('modal-submensaje');

    // FUNCIÓN MODAL (Reemplaza alert())
    function mostrarModal(titulo, mensaje, submensaje = '') {
        return new Promise((resolve) => {
            const btnConfirmar = document.getElementById('btn-modal-confirmar');
            const btnCancelar = document.getElementById('btn-modal-cancelar');

            modalTitulo.textContent = titulo;
            modalMensaje.textContent = mensaje;
            modalSubmensaje.textContent = submensaje;

            btnConfirmar.className = 'modal-btn aceptar';
            btnConfirmar.textContent = 'Aceptar';
            btnCancelar.style.display = 'none';

            modalOverlay.style.display = 'flex';

            const nuevoConfirmar = btnConfirmar.cloneNode(true);
            btnConfirmar.replaceWith(nuevoConfirmar);

            nuevoConfirmar.addEventListener('click', () => {
                modalOverlay.style.display = 'none';
                resolve(true);
            });

            nuevoConfirmar.focus();
        });
    }

    // LÓGICA "RECORDARME"
    const usuarioGuardado = localStorage.getItem('recordarme_usuario');
    if (usuarioGuardado) {
        usuarioInput.value = usuarioGuardado;
        checkRecordarme.checked = true;
        passwordInput.focus(); // Foco directo al campo contraseña
    }

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.classList.toggle('abierto');
        });
    }

    // Lógica de Inicio de Sesión
    btnLogin.addEventListener('click', async (e) => {
        e.preventDefault(); // Evita que el form recargue la página

        const usuario = usuarioInput.value;
        const password = passwordInput.value;

        if (!usuario || !password) {
            await mostrarModal('Atención', '¡Debe completar todos los campos!');
            return;
        }

        try {
            const resultado = await window.electronAPI.login({ usuario, password });

            if (resultado.success) {
                // Guardar datos del usuario en localStorage
                localStorage.setItem('usuarioID', resultado.user.idUsuario);
                localStorage.setItem('usuarioNombre', resultado.user.nombreUsuario);
                localStorage.setItem('usuarioRol', resultado.user.idRol);

                // Guardar o limpiar "Recordarme"
                if (checkRecordarme.checked) {
                    localStorage.setItem('recordarme_usuario', usuario);
                } else {
                    localStorage.removeItem('recordarme_usuario');
                }
                
                // Admin (1) y Presidente (3) → Dashboard, otros → Clientes
                const rol = String(resultado.user.idRol);
                if (rol === '1' || rol === '3') {
                    window.location.href = '../../moduloDashboard/dashboard.html';
                } else {
                    window.location.href = '../../moduloServicios/clientes/index.html';
                }
            } else {
                await mostrarModal('Error', '¡Usuario o contraseña incorrectos!');
                // Limpiar campos tras fallo y re-enfocar
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            console.error('Error:', error);
            await mostrarModal('Error', 'Error al conectar con la base de datos.');
        }
    });
});
