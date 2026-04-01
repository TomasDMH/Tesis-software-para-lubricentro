// MÓDULO DASHBOARD (Frontend)
// KPIs, gráficos (Chart.js) y configuración de email.

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
            btnSi.classList.add('aceptar');

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

    // STOCK MÍNIMO (misma lógica que stock.js)
    function obtenerStockMinimo(prod) {
        if (prod && prod.stockMinimo && prod.stockMinimo > 0) return prod.stockMinimo;
        const tipoEnvase = prod ? (prod.tipoEnvase || '') : '';
        const tipo = prod ? (prod.tipo || '') : '';
        const envase = tipoEnvase.toLowerCase().trim();
        if (envase.includes('caja')) return 3;
        if (tipo && tipo.toLowerCase().replace(/_/g, ' ').includes('refrigerante')) return 20;
        if (envase === 'tambor (200 lts)') return 100;
        if (envase === 'bidon (4 lts)') return 60;
        if (envase === 'bidon (5 lts)') return 75;
        if (envase === 'botella (1lt)') return 20;
        return 100;
    }

    // FORMATEO
    function formatearMoneda(valor) {
        const n = Math.round(Number(valor || 0));
        const s = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return '$' + s;
    }

    // KPIs
    const kpiServiciosHoy = document.getElementById('kpi-servicios-hoy');
    const kpiServiciosAyer = document.getElementById('kpi-servicios-ayer');
    const kpiIngresosHoy = document.getElementById('kpi-ingresos-hoy');
    const kpiIngresosMes = document.getElementById('kpi-ingresos-mes');
    const kpiClientesTotal = document.getElementById('kpi-clientes-total');
    const kpiAlertasStock = document.getElementById('kpi-alertas-stock');

    async function cargarKPIs() {
        try {
            const [stats, productos] = await Promise.all([
                window.electronAPI.getDashboardStats(),
                window.electronAPI.getStockAlerts()
            ]);
            if (stats) {
                kpiServiciosHoy.textContent = stats.serviciosHoy || 0;
                kpiServiciosAyer.textContent = stats.serviciosAyer || 0;
                kpiIngresosHoy.textContent = formatearMoneda(stats.ingresosHoy || 0);
                kpiIngresosMes.textContent = formatearMoneda(stats.ingresosMes || 0);
                kpiClientesTotal.textContent = stats.clientesTotal || 0;
            }
            // Contar alertas con la misma lógica que la campanita
            if (Array.isArray(productos)) {
                let conteoAlertas = 0;
                productos.forEach(prod => {
                    const esFiltro = (prod.tipo || '').toLowerCase().includes('filtro');
                    const limite = obtenerStockMinimo(prod);
                    const stockValor = esFiltro ? (prod.cantidad || 0) : (prod.mililitros || 0) / 1000;
                    if (stockValor <= limite) conteoAlertas++;
                });
                if (kpiAlertasStock) kpiAlertasStock.textContent = conteoAlertas;
            }
        } catch (e) {
            console.error('Error cargando KPIs:', e);
        }
    }

    // GRÁFICOS
    let chartTipos = null;
    let chartBarras = null;

    async function cargarGraficos() {
        try {
            const data = await window.electronAPI.getDashboardCharts();
            if (!data) return;

            // --- Pie Chart: Tipos de Servicio ---
            const ctxPie = document.getElementById('chart-tipos-servicio');
            if (ctxPie && data.tiposServicioMes) {
                const labels = data.tiposServicioMes.map(t => t.tipo || 'Sin tipo');
                const valores = data.tiposServicioMes.map(t => t.cantidad || 0);
                const colores = ['#fab062', '#e20613', '#2e7d32', '#1976d2', '#ff9800', '#9c27b0'];

                if (chartTipos) chartTipos.destroy();
                chartTipos = new Chart(ctxPie, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: valores,
                            backgroundColor: colores.slice(0, labels.length),
                            borderColor: '#01242c',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { color: '#fff', font: { size: 11 } }
                            }
                        }
                    }
                });
            }

            // --- Bar Chart: Servicios últimos 30 días ---
            const ctxBar = document.getElementById('chart-servicios-30dias');
            if (ctxBar && data.serviciosPorDia) {
                const labels = data.serviciosPorDia.map(d => d.dia);
                const valores = data.serviciosPorDia.map(d => d.cantidad);

                if (chartBarras) chartBarras.destroy();
                chartBarras = new Chart(ctxBar, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Servicios',
                            data: valores,
                            backgroundColor: 'rgba(250,176,98,0.7)',
                            borderColor: '#fab062',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: {
                                ticks: { color: '#bbb', font: { size: 9 }, maxRotation: 45 },
                                grid: { color: 'rgba(250,176,98,0.1)' }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: { color: '#bbb', stepSize: 1 },
                                grid: { color: 'rgba(250,176,98,0.1)' }
                            }
                        },
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
            }

            // --- Top 5 Productos ---
            const topBody = document.getElementById('top-productos-body');
            if (topBody && data.topProductos) {
                topBody.innerHTML = '';
                if (data.topProductos.length === 0) {
                    topBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#bbb;">Sin datos este mes.</td></tr>';
                } else {
                    data.topProductos.forEach((p, i) => {
                        const tr = document.createElement('tr');
                        const cantTexto = (p.nombre || '').toLowerCase().includes('filtro')
                            ? `${p.totalUsado || 0} Un.`
                            : `${((p.totalUsado || 0) / 1000).toFixed(2)} Lts.`;
                        tr.innerHTML = `<td>${i + 1}</td><td>${p.nombre || '-'}</td><td>${cantTexto}</td>`;
                        topBody.appendChild(tr);
                    });
                }
            }
        } catch (e) {
            console.error('Error cargando gráficos:', e);
        }
    }

    // EMAIL CONFIG
    const inputHost = document.getElementById('email-host');
    const inputPort = document.getElementById('email-port');
    const inputUser = document.getElementById('email-user');
    const inputPass = document.getElementById('email-pass');
    const btnGuardarEmail = document.getElementById('btn-guardar-email-config');
    const btnTestEmail = document.getElementById('btn-test-email');
    const btnRunRemindersNow = document.getElementById('btn-run-reminders-now');

    async function cargarEmailConfig() {
        try {
            const config = await window.electronAPI.getEmailConfig();
            if (config) {
                if (inputHost) inputHost.value = config.host || '';
                if (inputPort) inputPort.value = config.port || 587;
                if (inputUser) inputUser.value = config.user || '';
                if (inputPass) inputPass.value = config.pass || '';
            }
        } catch (e) {
            console.error('Error cargando config email:', e);
        }
    }

    if (btnGuardarEmail) {
        btnGuardarEmail.addEventListener('click', async () => {
            const config = {
                host: (inputHost ? inputHost.value : '').trim(),
                port: inputPort ? parseInt(inputPort.value, 10) : 587,
                user: (inputUser ? inputUser.value : '').trim(),
                pass: (inputPass ? inputPass.value : '').trim()
            };
            if (!config.host || !config.user) {
                await mostrarModal({ tipo: 'aviso', titulo: 'Atención', mensaje: 'Complete al menos Host y Usuario.' });
                return;
            }
            try {
                await window.electronAPI.saveEmailConfig(config);
                await mostrarModal({ tipo: 'aviso', titulo: 'Éxito', mensaje: 'Configuración de email guardada.' });
            } catch (e) {
                console.error(e);
                await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'No se pudo guardar la configuración.', submensaje: e.message || '' });
            }
        });
    }

    if (btnTestEmail) {
        btnTestEmail.addEventListener('click', async () => {
            const destinatario = (inputUser ? inputUser.value : '').trim();
            if (!destinatario) {
                await mostrarModal({ tipo: 'aviso', titulo: 'Atención', mensaje: 'Configure un email primero.' });
                return;
            }
            try {
                const res = await window.electronAPI.sendEmail({
                    destinatario: destinatario,
                    asunto: 'Test - Los Gallegos',
                    cuerpo: 'Este es un email de prueba desde el sistema Los Gallegos.'
                });
                if (res && res.success) {
                    await mostrarModal({ tipo: 'aviso', titulo: 'Éxito', mensaje: 'Email de prueba enviado correctamente.' });
                } else {
                    await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'No se pudo enviar el email.', submensaje: (res && res.error) || '' });
                }
            } catch (e) {
                console.error(e);
                await mostrarModal({ tipo: 'aviso', titulo: 'Error', mensaje: 'Error enviando email.', submensaje: e.message || '' });
            }
        });
    }

    if (btnRunRemindersNow) {
        btnRunRemindersNow.addEventListener('click', async () => {
            try {
                btnRunRemindersNow.disabled = true;
                const originalText = btnRunRemindersNow.textContent;
                btnRunRemindersNow.textContent = 'Procesando...';

                const res = await window.electronAPI.runServiceRemindersNow();
                if (res && res.success) {
                    await mostrarModal({
                        tipo: 'aviso',
                        titulo: 'Recordatorios Ejecutados',
                        mensaje: `Proceso finalizado. Candidatos: ${res.candidatos || 0} | Enviados: ${res.enviados || 0}`,
                        submensaje: (res.omitidos && res.omitidos > 0)
                            ? `Omitidos por duplicado: ${res.omitidos}`
                            : ''
                    });
                } else {
                    await mostrarModal({
                        tipo: 'aviso',
                        titulo: 'No se pudo ejecutar',
                        mensaje: 'No se pudo correr el proceso de recordatorios.',
                        submensaje: (res && res.error) ? res.error : ''
                    });
                }

                btnRunRemindersNow.textContent = originalText;
                btnRunRemindersNow.disabled = false;
            } catch (e) {
                btnRunRemindersNow.disabled = false;
                btnRunRemindersNow.textContent = 'Ejecutar Recordatorios Ahora';
                await mostrarModal({
                    tipo: 'aviso',
                    titulo: 'Error',
                    mensaje: 'Error ejecutando recordatorios.',
                    submensaje: e.message || ''
                });
            }
        });
    }

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
            if (confirmar) window.location.href = '../moduloLogin/login/login.html';
        });
    }

    // INIT
    await cargarKPIs();
    await cargarGraficos();
    await cargarEmailConfig();
});
