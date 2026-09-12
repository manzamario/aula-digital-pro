/* ============================================
   AULA DIGITAL PRO - JavaScript Principal
   ============================================ */

// ============================================
// STATE
// ============================================
const AppState = {
    currentScreen: 'splash',
    currentView: null,
    currentRole: null,
    currentUser: null,
    sidebarOpen: false,
    notificationsOpen: false,
    aulaControlada: false,
    oportunidades: 5,
    maxOportunidades: 5,
    examenActual: {
        preguntaActual: 0,
        totalPreguntas: 10,
        tiempoRestante: 40 * 60,
        respuestas: {},
        timerInterval: null
    },
    qrTimerInterval: null,
    qrTimeLeft: 300
};

// ============================================
// USERS DEMO
// ============================================
const DEMO_USERS = {
    docente: {
        id: 1,
        rol: 'docente',
        nombre: 'García',
        apellido: 'Prof.',
        email: 'garcia@escuela.edu',
        cursos: 4
    },
    alumno: {
        id: 101,
        rol: 'alumno',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'perez@escuela.edu',
        curso: '3°A',
        oportunidades: 5
    },
    admin: {
        id: 1,
        rol: 'admin',
        nombre: 'Admin',
        apellido: 'Sistema',
        email: 'admin@escuela.edu'
    }
};

const DEMO_ALUMNOS = [
    { id: 1, nombre: 'Ana', apellido: 'García', curso: '3°A', oportunidades: 5, conectado: true },
    { id: 2, nombre: 'Carlos', apellido: 'López', curso: '3°A', oportunidades: 4, conectado: true },
    { id: 3, nombre: 'Sofía', apellido: 'Martínez', curso: '3°A', oportunidades: 3, conectado: true },
    { id: 4, nombre: 'Diego', apellido: 'Rodríguez', curso: '3°A', oportunidades: 5, conectado: false },
    { id: 5, nombre: 'Valentina', apellido: 'Fernández', curso: '3°A', oportunidades: 2, conectado: true },
    { id: 6, nombre: 'Mateo', apellido: 'López', curso: '3°A', oportunidades: 5, conectado: true },
    { id: 7, nombre: 'Camila', apellido: 'García', curso: '3°A', oportunidades: 4, conectado: true },
    { id: 8, nombre: 'Santiago', apellido: 'Díaz', curso: '3°A', oportunidades: 5, conectado: false },
    { id: 9, nombre: 'Luciana', apellido: 'Morales', curso: '3°A', oportunidades: 5, conectado: true },
    { id: 10, nombre: 'Tomás', apellido: 'Ruiz', curso: '3°A', oportunidades: 3, conectado: true },
    { id: 11, nombre: 'Isabella', apellido: 'Torres', curso: '3°A', opportunidades: 5, conectado: true },
    { id: 12, nombre: 'Benjamín', apellido: 'Acosta', curso: '3°A', oportunidades: 5, conectado: true },
    { id: 13, nombre: 'Mía', apellido: 'Romero', curso: '3°A', oportunidades: 4, conectado: true },
    { id: 14, nombre: 'Emilio', apellido: 'Silva', curso: '3°A', oportunidades: 5, conectado: true },
    { id: 15, nombre: 'Emma', apellido: 'Medina', curso: '3°A', oportunidades: 5, conectado: true }
];

const DEMO_PREGUNTAS = [
    {
        num: 1, tipo: 'multiple', tipoLabel: 'Opción Múltiple', puntos: 2,
        enunciado: '¿Cuál es el tipo de dato correcto para almacenar el valor 3.14 en Python?',
        opciones: ['a) int', 'b) string', 'c) float', 'd) bool']
    },
    {
        num: 2, tipo: 'vf', tipoLabel: 'Verdadero / Falso', puntos: 1,
        enunciado: 'Python es un lenguaje tipado estáticamente.',
        opciones: ['Verdadero', 'Falso']
    },
    {
        num: 3, tipo: 'corta', tipoLabel: 'Respuesta Corta', puntos: 3,
        enunciado: '¿Cuál es la diferencia entre una lista y una tupla en Python?',
        opciones: []
    },
    {
        num: 4, tipo: 'multiple', tipoLabel: 'Opción Múltiple', puntos: 2,
        enunciado: '¿Cuál de estos es un operador de asignación en Python?',
        opciones: ['a) ==', 'b) =', 'c) !=', 'd) <']
    },
    {
        num: 5, tipo: 'vf', tipoLabel: 'Verdadero / Falso', puntos: 1,
        enunciado: 'En Python, las variables deben ser declaradas con su tipo antes de usarlas.',
        opciones: ['Verdadero', 'Falso']
    },
    {
        num: 6, tipo: 'multiple', tipoLabel: 'Opción Múltiple', puntos: 2,
        enunciado: '¿Qué función se usa para obtener la longitud de una lista en Python?',
        opciones: ['a) length()', 'b) size()', 'c) len()', 'd) count()']
    },
    {
        num: 7, tipo: 'corta', tipoLabel: 'Respuesta Corta', puntos: 3,
        enunciado: 'Escribí un programa que imprima "Hola Mundo" en Python.',
        opciones: []
    },
    {
        num: 8, tipo: 'multiple', tipoLabel: 'Opción Múltiple', puntos: 2,
        enunciado: '¿Cuál es el resultado de: print(type(5))?',
        opciones: ['a) <class \'str\'>', 'b) <class \'int\'>', 'c) <class \'float\'>', 'd) <class \'bool\'>']
    },
    {
        num: 9, tipo: 'vf', tipoLabel: 'Verdadero / Falso', puntos: 1,
        enunciado: 'Una función en Python se define con la palabra clave "function".',
        opciones: ['Verdadero', 'Falso']
    },
    {
        num: 10, tipo: 'multiple', tipoLabel: 'Opción Múltiple', puntos: 2,
        enunciado: '¿Cuál de las siguientes es una forma correcta de crear una lista en Python?',
        opciones: ['a) lista = (1, 2, 3)', 'b) lista = [1, 2, 3]', 'c) lista = {1, 2, 3}', 'd) lista = 1, 2, 3']
    }
];

// ============================================
// SPLASH SCREEN
// ============================================
function initApp() {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.display = 'none';
        }
        showScreen('screen-login');
    }, 3000);
}

// ============================================
// SCREEN MANAGEMENT
// ============================================
function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.style.display = 'none';

    // Show target screen
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = 'flex';
    }
}

function showApp(role) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.style.display = 'flex';

    AppState.currentRole = role;
    AppState.currentUser = DEMO_USERS[role];

    buildSidebar(role);
    updateUserInfo(role);

    // Show default view
    if (role === 'docente') {
        showView('view-dashboard-docente');
    } else if (role === 'alumno') {
        showView('view-dashboard-alumno');
    } else if (role === 'admin') {
        showView('view-dashboard-admin');
    }
}

// ============================================
// SIDEBAR
// ============================================
function buildSidebar(role) {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    let items = '';

    if (role === 'docente') {
        items = `
            <div class="nav-section">
                <div class="nav-section-title">Principal</div>
            </div>
            <div class="nav-item active" onclick="showView('view-dashboard-docente')" data-view="view-dashboard-docente">
                <span class="nav-icon">🏠</span> Dashboard
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Gestión</div>
            </div>
            <div class="nav-item" onclick="showView('view-asistencia')" data-view="view-asistencia">
                <span class="nav-icon">📋</span> Asistencia
            </div>
            <div class="nav-item" onclick="showView('view-materiales')" data-view="view-materiales">
                <span class="nav-icon">📚</span> Materiales
            </div>
            <div class="nav-item" onclick="showView('view-tp')" data-view="view-tp">
                <span class="nav-icon">📝</span> Trabajos Prácticos
                <span class="nav-badge">5</span>
            </div>
            <div class="nav-item" onclick="showView('view-examenes')" data-view="view-examenes">
                <span class="nav-icon">📊</span> Exámenes
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Aula Virtual</div>
            </div>
            <div class="nav-item" onclick="showView('view-aula-controlada')" data-view="view-aula-controlada">
                <span class="nav-icon">🔒</span> Aula Controlada
            </div>
            <div class="nav-item" onclick="showView('view-panel-realtime')" data-view="view-panel-realtime">
                <span class="nav-icon">📡</span> Panel en Vivo
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Análisis</div>
            </div>
            <div class="nav-item" onclick="showView('view-estadisticas')" data-view="view-estadisticas">
                <span class="nav-icon">📈</span> Estadísticas
            </div>
            <div class="nav-item" onclick="showView('view-integradores')" data-view="view-integradores">
                <span class="nav-icon">📋</span> Integradores
            </div>
        `;
    } else if (role === 'alumno') {
        items = `
            <div class="nav-section">
                <div class="nav-section-title">Principal</div>
            </div>
            <div class="nav-item active" onclick="showView('view-dashboard-alumno')" data-view="view-dashboard-alumno">
                <span class="nav-icon">🏠</span> Mi Panel
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Aprendizaje</div>
            </div>
            <div class="nav-item" onclick="showView('view-material-alumno')" data-view="view-material-alumno">
                <span class="nav-icon">📚</span> Materiales
            </div>
            <div class="nav-item" onclick="showView('view-tp-alumno')" data-view="view-tp-alumno">
                <span class="nav-icon">📝</span> Mis Trabajos Prácticos
                <span class="nav-badge">2</span>
            </div>
            <div class="nav-item" onclick="showView('view-examen-alumno')" data-view="view-examen-alumno">
                <span class="nav-icon">📊</span> Rendir Examen
            </div>
            <div class="nav-section">
                <div class="nav-section-title">Progreso</div>
            </div>
            <div class="nav-item" onclick="showView('view-notas-alumno')" data-view="view-notas-alumno">
                <span class="nav-icon">⭐</span> Mis Notas
            </div>
            <div class="nav-item" onclick="showView('view-integradores')" data-view="view-integradores">
                <span class="nav-icon">📋</span> Integradores
            </div>
        `;
    } else if (role === 'admin') {
        items = `
            <div class="nav-section">
                <div class="nav-section-title">Administración</div>
            </div>
            <div class="nav-item active" onclick="showView('view-dashboard-admin')" data-view="view-dashboard-admin">
                <span class="nav-icon">🏠</span> Dashboard
            </div>
            <div class="nav-item" onclick="showView('view-estadisticas')" data-view="view-estadisticas">
                <span class="nav-icon">📈</span> Estadísticas
            </div>
        `;
    }

    nav.innerHTML = items;
}

function updateUserInfo(role) {
    const user = DEMO_USERS[role];
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-info')?.querySelector('.user-avatar');
    const topbarAvatar = document.getElementById('topbar-avatar');

    const roleName = role === 'docente' ? 'Docente' : role === 'alumno' ? 'Alumno' : 'Administrador';
    const displayName = role === 'docente' ? `${user.apellido} ${user.nombre}` :
                         `${user.apellido} ${user.nombre}`;

    if (nameEl) nameEl.textContent = displayName;
    if (roleEl) roleEl.textContent = roleName;
    if (avatarEl) avatarEl.textContent = user.nombre.charAt(0);
    if (topbarAvatar) topbarAvatar.textContent = user.nombre.charAt(0);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
        AppState.sidebarOpen = !AppState.sidebarOpen;
    }
}

// ============================================
// VIEW MANAGEMENT
// ============================================
function showView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');

    // Show target view
    const view = document.getElementById(viewId);
    if (view) {
        view.style.display = 'block';
    }

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewId) {
            item.classList.add('active');
        }
    });

    // Update topbar title
    const titles = {
        'view-dashboard-docente': 'Dashboard',
        'view-dashboard-alumno': 'Mi Panel',
        'view-dashboard-admin': 'Panel de Administración',
        'view-asistencia': 'Asistencia',
        'view-materiales': 'Materiales Didácticos',
        'view-tp': 'Trabajos Prácticos',
        'view-examenes': 'Exámenes',
        'view-aula-controlada': 'Aula Controlada',
        'view-panel-realtime': 'Panel en Tiempo Real',
        'view-examen-alumno': 'Examen en Curso',
        'view-material-alumno': 'Mis Materiales',
        'view-tp-alumno': 'Mis Trabajos Prácticos',
        'view-notas-alumno': 'Mis Notas',
        'view-integradores': 'Trabajos Integradores',
        'view-estadisticas': 'Estadísticas'
    };

    const topbarTitle = document.getElementById('topbar-title');
    if (topbarTitle && titles[viewId]) {
        topbarTitle.textContent = titles[viewId];
    }

    AppState.currentView = viewId;

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('open');
    }

    // Initialize view-specific content
    initViewContent(viewId);
}

function initViewContent(viewId) {
    if (viewId === 'view-asistencia') {
        const fechaEl = document.getElementById('asistencia-fecha');
        if (fechaEl) {
            fechaEl.textContent = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
        }
    }
}

// ============================================
// LOGIN
// ============================================
document.getElementById('login-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const role = document.getElementById('login-role').value;
    if (role) {
        showApp(role);
        showToast('¡Bienvenido! Has ingresado correctamente.', 'success');
    }
});

function demoLogin(role) {
    showApp(role);
    showToast(`Acceso demo como ${role.charAt(0).toUpperCase() + role.slice(1)}`, 'success');
}

function logout() {
    AppState.currentRole = null;
    AppState.currentUser = null;
    showScreen('screen-login');
    showToast('Sesión cerrada', 'success');
}

// ============================================
// PASSWORD TOGGLE
// ============================================
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

// ============================================
// NOTIFICATIONS
// ============================================
function toggleNotifications() {
    const panel = document.getElementById('notifications-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        AppState.notificationsOpen = !AppState.notificationsOpen;
    }
}

function toggleUserMenu() {
    // Could expand to show dropdown
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// MODALS
// ============================================
function showModal(modalId) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById(modalId);
    if (overlay && modal) {
        // Hide all modals first
        overlay.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        modal.style.display = 'block';
        overlay.style.display = 'flex';
    }
}

function closeAllModals() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        overlay.style.display = 'none';
    }
}

// ============================================
// TABS
// ============================================
function switchTab(btn, contentId) {
    // Update tab buttons
    btn.closest('.tp-tabs').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    // Update tab content
    const parent = btn.closest('.view') || document;
    parent.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
    const content = document.getElementById(contentId);
    if (content) content.style.display = 'block';
}

// ============================================
// ASISTENCIA
// ============================================
function loadAsistenciaAlumnos() {
    const lista = document.getElementById('asistencia-lista');
    const btnGuardar = document.getElementById('btn-guardar-asistencia');
    if (!lista) return;

    let html = '';
    DEMO_ALUMNOS.forEach(alumno => {
        html += `
            <div class="alumno-asistencia">
                <input type="checkbox" id="asis-${alumno.id}" ${alumno.conectado ? 'checked' : ''}>
                <div class="aa-nombre">
                    <strong>${alumno.apellido}, ${alumno.nombre}</strong>
                    <small>${alumno.curso}</small>
                </div>
                <span class="badge ${alumno.conectado ? 'badge-green' : 'badge-red'}">${alumno.conectado ? 'Presente' : 'Ausente'}</span>
            </div>
        `;
    });

    lista.innerHTML = html;
    if (btnGuardar) btnGuardar.style.display = 'block';

    updateAsistenciaCount();
}

function updateAsistenciaCount() {
    const checkboxes = document.querySelectorAll('.alumno-asistencia input[type="checkbox"]');
    let presentes = 0;
    checkboxes.forEach(cb => { if (cb.checked) presentes++; });

    const presentesEl = document.getElementById('presentes-count');
    const ausentesEl = document.getElementById('ausentes-count');

    if (presentesEl) presentesEl.textContent = `${presentes} Presentes`;
    if (ausentesEl) ausentesEl.textContent = `${checkboxes.length - presentes} Ausentes`;
}

function generarQR() {
    const qrDisplay = document.getElementById('qr-display');
    if (qrDisplay) {
        qrDisplay.style.display = 'block';
        startQRTimer();
        showToast('QR generado. Válido por 5 minutos.', 'success');
    }
}

function startQRTimer() {
    AppState.qrTimeLeft = 300;
    if (AppState.qrTimerInterval) clearInterval(AppState.qrTimerInterval);

    AppState.qrTimerInterval = setInterval(() => {
        AppState.qrTimeLeft--;
        const minutes = Math.floor(AppState.qrTimeLeft / 60);
        const seconds = AppState.qrTimeLeft % 60;
        const timerEl = document.getElementById('qr-timer');
        if (timerEl) {
            timerEl.textContent = `Válido: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        if (AppState.qrTimeLeft <= 0) {
            clearInterval(AppState.qrTimerInterval);
            showToast('El código QR expiró. Regenerá uno nuevo.', 'warning');
        }
    }, 1000);
}

function regenerarQR() {
    clearInterval(AppState.qrTimerInterval);
    startQRTimer();
    showToast('QR regenerado', 'success');
}

function guardarAsistencia() {
    showToast('Asistencia guardada correctamente', 'success');
}

// ============================================
// AULA CONTROLADA
// ============================================
function toggleAulaControlada() {
    const btn = document.getElementById('btn-activar-aula');
    const content = document.getElementById('aula-controlada-content');

    if (!AppState.aulaControlada) {
        AppState.aulaControlada = true;
        if (btn) {
            btn.textContent = '🔓 Desactivar Aula';
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-success');
        }
        if (content) content.style.display = 'block';
        renderAlumnoMonitor();
        showToast('Aula Controlada activada. Los alumnos serán monitoreados.', 'warning');
    } else {
        AppState.aulaControlada = false;
        if (btn) {
            btn.textContent = '🔒 Activar Aula Controlada';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-danger');
        }
        if (content) content.style.display = 'none';
        showToast('Aula Controlada desactivada.', 'success');
    }
}

function renderAlumnoMonitor() {
    const grid = document.getElementById('alumno-monitor-grid');
    if (!grid) return;

    let html = '';
    DEMO_ALUMNOS.forEach(alumno => {
        let dots = '';
        for (let i = 0; i < 5; i++) {
            dots += `<div class="am-dot ${i >= alumno.oportunidades ? 'used' : ''}"></div>`;
        }

        html += `
            <div class="alumno-monitor-card">
                <div class="am-avatar">${alumno.nombre.charAt(0)}</div>
                <div class="am-name">${alumno.apellido}, ${alumno.nombre}</div>
                <div class="am-oportunidades">${dots}</div>
                <div class="am-status">${alumno.conectado ? '🟢 Conectado' : '🔴 Desconectado'}</div>
            </div>
        `;
    });

    grid.innerHTML = html;

    // Update stats
    const conectados = DEMO_ALUMNOS.filter(a => a.conectado).length;
    const conectadosEl = document.getElementById('aula-conectados');
    if (conectadosEl) conectadosEl.textContent = conectados;
}

function autorizarReingreso(btn, autorizar) {
    const solicitud = btn.closest('.solicitud-item');
    if (solicitud) {
        if (autorizar) {
            solicitud.remove();
            showToast('Reingreso autorizado', 'success');
        } else {
            solicitud.remove();
            showToast('Reingreso rechazado', 'error');
        }
    }
}

// ============================================
// EXIT DETECTION (Aula Controlada)
// ============================================
let exitTimeout = null;

function setupExitDetection() {
    // Visibility Change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && AppState.aulaControlada && AppState.currentRole === 'alumno') {
            handleExit('visibilitychange');
        }
    });

    // Blur
    window.addEventListener('blur', () => {
        if (AppState.aulaControlada && AppState.currentRole === 'alumno') {
            handleExit('blur');
        }
    });

    // Before Unload
    window.addEventListener('beforeunload', (e) => {
        if (AppState.aulaControlada && AppState.currentRole === 'alumno') {
            handleExit('beforeunload');
        }
    });

    // Fullscreen Change
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && AppState.aulaControlada && AppState.currentRole === 'alumno') {
            // Could handle fullscreen exit
        }
    });
}

function handleExit(eventType) {
    if (exitTimeout) return; // Prevent multiple exits

    exitTimeout = setTimeout(() => {
        exitTimeout = null;
    }, 5000);

    if (AppState.oportunidades > 0) {
        AppState.oportunidades--;
        updateOportunidadesDisplay();

        const banner = document.getElementById('exit-banner');
        const restantes = document.getElementById('oportunidades-restantes-banner');
        if (banner) banner.style.display = 'flex';
        if (restantes) restantes.textContent = AppState.oportunidades;

        showToast(`Salida detectada (-1 oportunidad). Quedan ${AppState.oportunidades}`, 'warning');

        if (AppState.oportunidades <= 0) {
            showToast('¡Sin oportunidades! Se asigna Trabajo Integrador A.', 'error');
        }
    }
}

function solicitarReingreso() {
    const banner = document.getElementById('exit-banner');
    const pending = document.getElementById('reingreso-pending');

    if (banner) banner.style.display = 'none';
    if (pending) pending.style.display = 'flex';

    showToast('Solicitud de reingreso enviada al docente', 'info');

    // Simulate auto-approve after 3 seconds for demo
    setTimeout(() => {
        if (pending) pending.style.display = 'none';
        showToast('Reingreso autorizado por el docente', 'success');
    }, 3000);
}

function updateOportunidadesDisplay() {
    const count = document.getElementById('oportunidades-count');
    const fill = document.getElementById('oportunidades-fill');
    const text = document.getElementById('oportunidades-text');

    if (count) count.textContent = AppState.oportunidades;
    if (fill) fill.style.width = `${(AppState.oportunidades / AppState.maxOportunidades) * 100}%`;

    if (text) {
        if (AppState.oportunidades === 5) {
            text.textContent = 'Todas tus oportunidades disponibles. ¡Mantenelas!';
        } else if (AppState.oportunidades > 2) {
            text.textContent = `Te quedan ${AppState.oportunidades} oportunidades. Cuidado al salir.`;
        } else if (AppState.oportunidades > 0) {
            text.textContent = `¡Atención! Solo te quedan ${AppState.oportunidades} oportunidades.`;
        } else {
            text.textContent = 'Sin oportunidades. Se asignó Trabajo Integrador A.';
        }
    }

    // Update color
    const countEl = document.getElementById('oportunidades-count');
    if (countEl) {
        if (AppState.oportunidades >= 4) countEl.style.color = 'var(--success)';
        else if (AppState.oportunidades >= 2) countEl.style.color = 'var(--warning)';
        else countEl.style.color = 'var(--danger)';
    }
}

// ============================================
// EXAMEN - ALUMNO
// ============================================
let examenTimer = null;

function startExamen() {
    AppState.examenActual.tiempoRestante = 40 * 60;
    AppState.examenActual.preguntaActual = 0;

    renderPregunta(0);
    startExamenTimer();
}

function startExamenTimer() {
    if (examenTimer) clearInterval(examenTimer);

    examenTimer = setInterval(() => {
        AppState.examenActual.tiempoRestante--;

        const minutes = Math.floor(AppState.examenActual.tiempoRestante / 60);
        const seconds = AppState.examenActual.tiempoRestante % 60;

        const countdownEl = document.getElementById('examen-countdown');
        if (countdownEl) {
            countdownEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        // Update progress
        const totalTime = 40 * 60;
        const elapsed = totalTime - AppState.examenActual.tiempoRestante;
        const progress = document.getElementById('examen-progress');
        if (progress) {
            progress.style.width = `${(elapsed / totalTime) * 100}%`;
        }

        // Warning at 5 minutes
        if (AppState.examenActual.tiempoRestante === 300) {
            showToast('¡Quedan 5 minutos!', 'warning');
        }

        // Auto-submit at 0
        if (AppState.examenActual.tiempoRestante <= 0) {
            clearInterval(examenTimer);
            showToast('Tiempo agotado. Examen enviado automáticamente.', 'warning');
            finalizarExamen();
        }
    }, 1000);
}

function renderPregunta(index) {
    const preguntas = DEMO_PREGUNTAS;
    if (index < 0 || index >= preguntas.length) return;

    AppState.examenActual.preguntaActual = index;
    const p = preguntas[index];

    const container = document.getElementById('pregunta-container');
    if (!container) return;

    let opcionesHtml = '';
    if (p.tipo === 'multiple') {
        p.opciones.forEach((opt, i) => {
            opcionesHtml += `
                <label class="opcion-item">
                    <input type="radio" name="pregunta-${p.num}" value="${String.fromCharCode(97+i)}" 
                           ${AppState.examenActual.respuestas[p.num] === String.fromCharCode(97+i) ? 'checked' : ''}
                           onchange="saveAnswer(${p.num}, this.value)">
                    <span class="opcion-radio"></span>
                    <span class="opcion-texto">${opt}</span>
                </label>
            `;
        });
    } else if (p.tipo === 'vf') {
        p.opciones.forEach((opt, i) => {
            opcionesHtml += `
                <label class="opcion-item">
                    <input type="radio" name="pregunta-${p.num}" value="${opt.toLowerCase()}"
                           ${AppState.examenActual.respuestas[p.num] === opt.toLowerCase() ? 'checked' : ''}
                           onchange="saveAnswer(${p.num}, this.value)">
                    <span class="opcion-radio"></span>
                    <span class="opcion-texto">${opt}</span>
                </label>
            `;
        });
    } else {
        opcionesHtml = `
            <textarea class="form-textarea" rows="6" placeholder="Escribí tu respuesta acá..."
                      onchange="saveAnswer(${p.num}, this.value)">${AppState.examenActual.respuestas[p.num] || ''}</textarea>
        `;
    }

    container.innerHTML = `
        <div class="pregunta-header">
            <span class="pregunta-num">Pregunta ${p.num} de ${preguntas.length}</span>
            <span class="pregunta-tipo-badge">${p.tipoLabel}</span>
            <span class="pregunta-pts">${p.puntos} puntos</span>
        </div>
        <div class="pregunta-enunciado">
            <p>${p.enunciado}</p>
        </div>
        <div class="opciones-container">
            ${opcionesHtml}
        </div>
    `;

    // Update navigation
    updatePreguntaNav();

    // Show/hide buttons
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnFinalizar = document.getElementById('btn-finalizar');

    if (btnPrev) btnPrev.style.display = index > 0 ? 'inline-flex' : 'none';
    if (btnNext) btnNext.style.display = index < preguntas.length - 1 ? 'inline-flex' : 'none';
    if (btnFinalizar) btnFinalizar.style.display = index === preguntas.length - 1 ? 'inline-flex' : 'none';
}

function updatePreguntaNav() {
    const nav = document.getElementById('pregunta-nav');
    if (!nav) return;

    const buttons = nav.querySelectorAll('.pregunta-btn');
    buttons.forEach((btn, i) => {
        btn.classList.remove('active');
        if (i === AppState.examenActual.preguntaActual) {
            btn.classList.add('active');
        }
        // Mark answered
        const pregunta = DEMO_PREGUNTAS[i];
        if (AppState.examenActual.respuestas[pregunta.num]) {
            btn.classList.add('answered');
        } else {
            btn.classList.remove('answered');
        }
    });
}

function goToQuestion(index) {
    renderPregunta(index);
}

function nextQuestion() {
    const current = AppState.examenActual.preguntaActual;
    if (current < DEMO_PREGUNTAS.length - 1) {
        renderPregunta(current + 1);
    }
}

function prevQuestion() {
    const current = AppState.examenActual.preguntaActual;
    if (current > 0) {
        renderPregunta(current - 1);
    }
}

function saveAnswer(preguntaNum, value) {
    AppState.examenActual.respuestas[preguntaNum] = value;
    updatePreguntaNav();
}

function finalizarExamen() {
    if (examenTimer) clearInterval(examenTimer);

    const answered = Object.keys(AppState.examenActual.respuestas).length;
    const total = DEMO_PREGUNTAS.length;

    // Calculate mock grade
    const nota = Math.min(10, Math.round((answered / total) * 8 + Math.random() * 2));
    const aprobado = nota >= 6;

    // Show result modal
    const statusEl = document.getElementById('resultado-status');
    const notaEl = document.getElementById('resultado-nota');
    const estadoEl = document.getElementById('resultado-estado');

    if (statusEl) {
        statusEl.innerHTML = aprobado ?
            '<span class="resultado-emoji">🎉</span><h2>¡Aprobado!</h2>' :
            '<span class="resultado-emoji">😔</span><h2>Desaprobado</h2>';
    }
    if (notaEl) notaEl.textContent = `${nota}/10`;
    if (estadoEl) {
        estadoEl.textContent = aprobado ? 'Aprobado' : 'Desaprobado';
        estadoEl.className = aprobado ? 'text-green' : 'text-red';
    }

    showModal('modal-resultado-examen');
    showToast(`Examen finalizado. Nota: ${nota}/10. El resultado será enviado por WhatsApp.`, aprobado ? 'success' : 'warning');
}

// ============================================
// TP ALUMNO
// ============================================
function toggleEntregaTipo(tipo) {
    const archivo = document.getElementById('entrega-archivo');
    const texto = document.getElementById('entrega-texto');

    if (archivo) archivo.style.display = tipo === 'archivo' ? 'block' : 'none';
    if (texto) texto.style.display = tipo === 'texto' ? 'block' : 'none';
}

function entregarTP() {
    showToast('Trabajo práctico entregado correctamente', 'success');
}

// ============================================
// PREGUNTA FORM
// ============================================
function updatePreguntaForm() {
    const tipo = document.getElementById('tipo-pregunta-select')?.value;
    const multipleSection = document.getElementById('opciones-multiple');
    if (multipleSection) {
        multipleSection.style.display = (tipo === 'multiple' || tipo === 'vf') ? 'block' : 'none';
    }
}

// ============================================
// CURSO SELECTION
// ============================================
function selectCurso(cursoId) {
    showToast(`Curso seleccionado: ${cursoId}`, 'info');
}

function viewMaterial(id) {
    showToast('Abriendo material...', 'info');
}

function openMaterialViewer() {
    showToast('Abriendo visor de material...', 'info');
}

// ============================================
// REALTIME PANEL
// ============================================
function startRealtimeCountdown() {
    let time = 32 * 60 + 45;
    const interval = setInterval(() => {
        time--;
        if (time < 0) {
            clearInterval(interval);
            return;
        }
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        const el = document.getElementById('realtime-countdown');
        if (el) {
            el.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupExitDetection();

    // Close notifications on outside click
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notifications-panel');
        const bell = document.querySelector('.notification-bell');
        if (panel && !panel.contains(e.target) && !bell?.contains(e.target)) {
            panel.style.display = 'none';
        }
    });

    // Close modals on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
            const panel = document.getElementById('notifications-panel');
            if (panel) panel.style.display = 'none';
        }
    });

    // Handle file upload area
    document.querySelectorAll('.file-upload-area').forEach(area => {
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.style.borderColor = 'var(--primary)';
            area.style.background = 'var(--primary-bg)';
        });

        area.addEventListener('dragleave', () => {
            area.style.borderColor = '';
            area.style.background = '';
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.style.borderColor = '';
            area.style.background = '';
            showToast('Archivo recibido', 'success');
        });
    });
});
