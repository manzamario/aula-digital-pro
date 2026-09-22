/* ============================================
   AULA DIGITAL PRO v2.0 — JavaScript Principal
   Plataforma de Gestión Educativa Integral
   ============================================ */

'use strict';

const APP_VERSION = '1.2.5';

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
    userMenuOpen: false,
    aulaControlada: false,
    examenActual: {
        preguntaActual: 0,
        totalPreguntas: 10,
        tiempoRestante: 40 * 60,
        respuestas: {},
        timerInterval: null
    },
    qrTimerInterval: null,
    qrTimeLeft: 300,
    exitTimeout: null,
    examenTimer: null,
    realtimeInterval: null,
    alumnoQrStream: null,
    classAccessExpiresAt: null,
    classCourseId: null,
    sessionToken: null,
    sessionExpiresAt: null,
    loginAttempts: {
        docente: { count: 0, lockUntil: null },
        alumno: { count: 0, lockUntil: null },
        admin: { count: 0, lockUntil: null }
    },
    notifications: [
        { id: 1, type: 'info', title: 'Bienvenido', text: 'La plataforma está lista para trabajar.', time: 'Ahora' },
        { id: 2, type: 'success', title: 'Sistema', text: 'Los registros se guardan localmente en tu navegador.', time: 'Hoy' }
    ]
};

// ============================================
// SECURITY — XSS Sanitization
// ============================================
function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================
// SECURITY — Simple hash for passwords
// ============================================
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(36);
}

function normalizeText(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

function isStrongPassword(password) {
    return typeof password === 'string' && password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
}

function generateSessionToken() {
    try {
        const random = new Uint32Array(8);
        crypto.getRandomValues(random);
        return Array.from(random).map(n => n.toString(16).padStart(8, '0')).join('');
    } catch (e) {
        return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    }
}

function saveSession(role, user) {
    const token = generateSessionToken();
    AppState.currentRole = role;
    AppState.currentUser = user;
    AppState.sessionToken = token;
    AppState.sessionExpiresAt = Date.now() + 60 * 60 * 1000;

    sessionStorage.setItem('aulaSession', JSON.stringify({
        role,
        userId: user?.id ?? null,
        token,
        expiresAt: AppState.sessionExpiresAt
    }));
}

function clearSession() {
    AppState.currentRole = null;
    AppState.currentUser = null;
    AppState.sessionToken = null;
    AppState.sessionExpiresAt = null;
    AppState.classAccessExpiresAt = null;
    AppState.classCourseId = null;
    sessionStorage.removeItem('aulaSession');
}

function restoreSession() {
    try {
        const raw = sessionStorage.getItem('aulaSession');
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !data.role || !data.userId || !data.token) return false;
        if (Date.now() > (data.expiresAt || 0)) {
            clearSession();
            return false;
        }

        const target = data.role === 'docente' ? USERS.docente : data.role === 'alumno' ? USERS.alumno : USERS.admin;
        if (!target || Number(target.id) !== Number(data.userId)) {
            clearSession();
            return false;
        }

        AppState.currentRole = data.role;
        AppState.currentUser = target;
        AppState.sessionToken = data.token;
        AppState.sessionExpiresAt = data.expiresAt;
        AppState.classAccessExpiresAt = data.classAccessExpiresAt || null;
        AppState.classCourseId = data.classCourseId || null;
        return true;
    } catch (e) {
        clearSession();
        return false;
    }
}

function hasActiveClassAccess() {
    return AppState.currentRole === 'alumno' && AppState.classAccessExpiresAt && Date.now() < AppState.classAccessExpiresAt;
}

function grantClassAccess(durationMinutes = 90, courseId = null) {
    AppState.classAccessExpiresAt = Date.now() + durationMinutes * 60 * 1000;
    AppState.classCourseId = courseId ? Number(courseId) : null;
    const raw = sessionStorage.getItem('aulaSession');
    if (!raw) return;
    try {
        const session = JSON.parse(raw);
        session.classAccessExpiresAt = AppState.classAccessExpiresAt;
        session.classCourseId = AppState.classCourseId;
        sessionStorage.setItem('aulaSession', JSON.stringify(session));
    } catch (e) {
        console.warn('[AulaDigital] No se pudo guardar el acceso de clase:', e);
    }
}

function isSessionValid() {
    if (!AppState.sessionToken || !AppState.currentUser || !AppState.currentRole) return false;
    if (!AppState.sessionExpiresAt || Date.now() > AppState.sessionExpiresAt) {
        clearSession();
        return false;
    }
    return true;
}

function blockIfUnauthorized(role) {
    if (!isSessionValid() || AppState.currentRole !== role) {
        clearSession();
        showScreen('screen-welcome');
        showToast('Sesión inválida o expirada. Volvé a iniciar sesión.', 'error');
        return false;
    }
    return true;
}

function getLoginAttemptState(role) {
    const attempts = AppState.loginAttempts[role] || { count: 0, lockUntil: null };
    return attempts;
}

function registerFailedAttempt(role) {
    const state = AppState.loginAttempts[role] || { count: 0, lockUntil: null };
    const now = Date.now();
    if (state.lockUntil && now < state.lockUntil) return true;
    state.count += 1;
    if (state.count >= 5) {
        state.lockUntil = now + 10 * 60 * 1000;
        state.count = 5;
        showToast('Máximo de intentos superado. Esperá 10 minutos antes de volver a intentar.', 'warning');
        return true;
    }
    AppState.loginAttempts[role] = state;
    return false;
}

function registerSuccessAttempt(role) {
    AppState.loginAttempts[role] = { count: 0, lockUntil: null };
}

function renderNotifications() {
    const panel = document.getElementById('notifications-panel');
    const list = panel?.querySelector('.notif-list');
    if (!list) return;

    if (!AppState.notifications || AppState.notifications.length === 0) {
        list.innerHTML = '<p class="empty-state">No hay notificaciones.</p>';
        return;
    }

    list.innerHTML = AppState.notifications.map(item => `
        <div class="notif-item ${item.type === 'info' ? 'unread' : ''}">
            <div class="notif-icon">${item.type === 'success' ? '✅' : item.type === 'warning' ? '⚠️' : 'ℹ️'}</div>
            <div class="notif-content">
                <p>${esc(item.title)}</p>
                <small>${esc(item.text)} · ${esc(item.time)}</small>
            </div>
        </div>
    `).join('');
}

// ============================================
// USERS
// ============================================
const USERS = {
    docente: null,
    alumno: null,
    admin: {
        id: 1,
        rol: 'admin',
        nombre: 'Luis',
        apellido: 'Manzanelli',
        emailCompleto: 'Mario Luis Manzanelli',
        email: 'admin@auladigital.com',
        passwordHash: simpleHash('Admin2026!Seguro')
    }
};

let ALUMNOS_REGISTRADOS = [];
let PREGUNTAS_BANCO = [];

// ============================================
// DATA STORES
// ============================================
let CURSOS = [];
let MATERIALES = [];
let TRABAJOS_PRACTICOS = [];
let EXAMENES = [];
let ASISTENCIAS = [];
let ALUMNOS_POR_CURSO = {};

// ============================================
// PERSISTENCIA (localStorage) — with error handling
// ============================================
function safeSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        showToast('Error al guardar datos. El almacenamiento está lleno.', 'error');
    }
}

function safeGet(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn('[AulaDigital] Error leyendo ' + key + ':', e);
        return null;
    }
}

function saveUsers() {
    const toSave = {
        docente: USERS.docente ? { ...USERS.docente, password: undefined, passwordHash: USERS.docente.passwordHash } : null,
        alumno: USERS.alumno ? { ...USERS.alumno, password: undefined, passwordHash: USERS.alumno.passwordHash } : null
    };
    safeSet('aulaUsers', toSave);
}

function saveAlumnos() {
    const toSave = ALUMNOS_REGISTRADOS.map(a => ({
        ...a,
        password: undefined,
        passwordHash: a.passwordHash
    }));
    safeSet('aulaAlumnos', toSave);
}

function saveCursos() { safeSet('aulaCursos', CURSOS); }
function saveMateriales() { safeSet('aulaMateriales', MATERIALES); }
function saveTP() { safeSet('aulaTP', TRABAJOS_PRACTICOS); }
function saveExamenes() { safeSet('aulaExamenes', EXAMENES); }
function saveAsistencias() { safeSet('aulaAsistencias', ASISTENCIAS); }
function saveAlumnosPorCurso() { safeSet('aulaAlumnosPorCurso', ALUMNOS_POR_CURSO); }

function loadPersistedData() {
    const u = safeGet('aulaUsers');
    if (u) {
        if (u.docente) USERS.docente = u.docente;
        if (u.alumno) USERS.alumno = u.alumno;
    }
    const a = safeGet('aulaAlumnos');
    if (a && Array.isArray(a)) ALUMNOS_REGISTRADOS = a;

    CURSOS = safeGet('aulaCursos') || [];
    MATERIALES = safeGet('aulaMateriales') || [];
    TRABAJOS_PRACTICOS = safeGet('aulaTP') || [];
    EXAMENES = safeGet('aulaExamenes') || [];
    ASISTENCIAS = safeGet('aulaAsistencias') || [];
    PREGUNTAS_BANCO = safeGet('aulaPreguntas') || [];
    ALUMNOS_POR_CURSO = safeGet('aulaAlumnosPorCurso') || {};

    if (Object.keys(ALUMNOS_POR_CURSO).length === 0 && ALUMNOS_REGISTRADOS.length > 0) {
        ALUMNOS_POR_CURSO = ALUMNOS_REGISTRADOS.reduce((acc, alumno) => {
            const courseId = String(alumno.curso || '');
            if (!courseId) return acc;
            if (!acc[courseId]) acc[courseId] = [];
            acc[courseId].push({
                id: alumno.id,
                nombre: alumno.nombre,
                apellido: alumno.apellido,
                dni: alumno.dni,
                division: alumno.division,
                curso: alumno.curso,
                escuela: alumno.escuela,
                email: alumno.email,
                whatsapp: alumno.whatsapp,
                conectado: !!alumno.conectado
            });
            return acc;
        }, {});
        saveAlumnosPorCurso();
    }
}

function savePreguntas() { safeSet('aulaPreguntas', PREGUNTAS_BANCO); }

// ============================================
// ADMIN — RESET PASSWORD
// ============================================
function showResetPassword(type, id, nombre) {
    document.getElementById('reset-user-type').value = type;
    document.getElementById('reset-user-id').value = id;
    document.getElementById('reset-user-name').textContent = nombre;
    document.getElementById('reset-new-password').value = '';
    document.getElementById('reset-new-password').placeholder = 'Ej: NuevaClave2026!';
    showModal('modal-reset-password');
}

function aplicarResetPassword() {
    const type = document.getElementById('reset-user-type').value;
    const id = parseInt(document.getElementById('reset-user-id').value, 10);
    const newPassword = document.getElementById('reset-new-password').value;

    if (!newPassword || newPassword.trim().length < 8) {
        showToast('La contraseña debe tener al menos 8 caracteres', 'error');
        return;
    }

    if (!isStrongPassword(newPassword)) {
        showToast('La contraseña debe incluir mayúscula, minúscula y número', 'error');
        return;
    }

    const hash = simpleHash(newPassword);
    let updated = false;

    if (type === 'docente') {
        if (USERS.docente && Number(USERS.docente.id) === Number(id)) {
            USERS.docente.passwordHash = hash;
            saveUsers();
            updated = true;
        }
    } else if (type === 'alumno') {
        const alumno = ALUMNOS_REGISTRADOS.find(a => Number(a.id) === Number(id));
        if (alumno) {
            alumno.passwordHash = hash;
            if (USERS.alumno && Number(USERS.alumno.id) === Number(id)) {
                USERS.alumno.passwordHash = hash;
            }
            saveAlumnos();
            updated = true;
        }
    }

    closeAllModals();
    if (updated) {
        showToast('Contraseña restablecida correctamente por el administrador', 'success');
    } else {
        showToast('No se encontró el usuario para actualizar la contraseña', 'error');
    }
}

function getSelectedUserIds(type) {
    const selector = type === 'docente' ? 'input[data-user-type="docente"][data-selected="true"]' : 'input[data-user-type="alumno"][data-selected="true"]';
    return Array.from(document.querySelectorAll(selector)).map(el => Number(el.value)).filter(Boolean);
}

function toggleUserSelection(type, id, checked) {
    const selector = `input[data-user-type="${type}"][value="${id}"]`;
    const item = document.querySelector(selector);
    if (item) {
        item.dataset.selected = checked ? 'true' : 'false';
        item.checked = checked;
    }
}

function eliminarDocente(docenteId) {
    if (!confirm('¿Querés eliminar este docente y su acceso?')) return;

    if (USERS.docente && Number(USERS.docente.id) === Number(docenteId)) {
        USERS.docente = null;
        saveUsers();
    }

    populateAdminDashboard();
    showToast('Docente eliminado', 'success');
}

function eliminarAlumnosSeleccionados() {
    const ids = getSelectedUserIds('alumno');
    if (ids.length === 0) {
        showToast('Seleccioná al menos un alumno para eliminar', 'warning');
        return;
    }

    if (!confirm(`¿Querés eliminar ${ids.length} alumno(s) seleccionados?`)) return;

    const inicial = ALUMNOS_REGISTRADOS.length;
    ALUMNOS_REGISTRADOS = ALUMNOS_REGISTRADOS.filter(a => !ids.includes(Number(a.id)));
    Object.keys(ALUMNOS_POR_CURSO).forEach(cursoId => {
        ALUMNOS_POR_CURSO[cursoId] = (ALUMNOS_POR_CURSO[cursoId] || []).filter(a => !ids.includes(Number(a.id)));
        if (ALUMNOS_POR_CURSO[cursoId].length === 0) {
            delete ALUMNOS_POR_CURSO[cursoId];
        }
    });

    if (USERS.alumno && ids.includes(Number(USERS.alumno.id))) {
        USERS.alumno = null;
    }

    if (ALUMNOS_REGISTRADOS.length !== inicial) {
        saveAlumnos();
        saveAlumnosPorCurso();
    }

    populateAdminDashboard();
    showToast(`${ids.length} alumno(s) eliminados`, 'success');
}

function eliminarDocentesSeleccionados() {
    const ids = getSelectedUserIds('docente');
    if (ids.length === 0) {
        showToast('Seleccioná al menos un docente para eliminar', 'warning');
        return;
    }

    if (!confirm(`¿Querés eliminar ${ids.length} docente(s) seleccionados?`)) return;

    if (USERS.docente && ids.includes(Number(USERS.docente.id))) {
        USERS.docente = null;
        saveUsers();
    }

    populateAdminDashboard();
    showToast(`${ids.length} docente(s) eliminados`, 'success');
}

function eliminarAlumno(alumnoId) {
    if (!confirm('¿Querés eliminar este alumno de la base de datos?')) return;

    const inicial = ALUMNOS_REGISTRADOS.length;
    ALUMNOS_REGISTRADOS = ALUMNOS_REGISTRADOS.filter(a => Number(a.id) !== Number(alumnoId));
    Object.keys(ALUMNOS_POR_CURSO).forEach(cursoId => {
        ALUMNOS_POR_CURSO[cursoId] = (ALUMNOS_POR_CURSO[cursoId] || []).filter(a => Number(a.id) !== Number(alumnoId));
        if (ALUMNOS_POR_CURSO[cursoId].length === 0) {
            delete ALUMNOS_POR_CURSO[cursoId];
        }
    });

    if (USERS.alumno && Number(USERS.alumno.id) === Number(alumnoId)) {
        USERS.alumno = null;
    }

    if (ALUMNOS_REGISTRADOS.length !== inicial) {
        saveAlumnos();
        saveAlumnosPorCurso();
    }

    populateAdminDashboard();
    showToast('Alumno eliminado', 'success');
}

// ============================================
// SPLASH SCREEN
// ============================================
function initApp() {
    loadPersistedData();
    renderNotifications();
    try {
        const restored = restoreSession();
        if (restored && AppState.currentRole && AppState.currentUser) {
            showApp(AppState.currentRole);
            return;
        }
    } catch (e) {
        console.warn('[AulaDigital] No se pudo restaurar sesión:', e);
    }
    initQRCodeReaderFromUrl();
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';
        showScreen('screen-welcome');
        showLatestUpdateNotice();
    }, 3000);
}

function showLatestUpdateNotice() {
    setTimeout(() => showToast(`Actualización v${APP_VERSION}: Informática y materiales por curso ya están disponibles.`, 'info'), 250);
}

// ============================================
// WELCOME - NAVIGATION
// ============================================
function goToDocentePlatform() { showScreen('screen-login-docente'); }
function goToAlumnoPlatform() { showScreen('screen-login-alumno'); }

// ============================================
// SCREEN MANAGEMENT
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.style.display = 'none';

    const target = document.getElementById(screenId);
    if (target) target.style.display = 'flex';
}

function showApp(role) {
    loadPersistedData();

    if (!USERS[role]) {
        showScreen('screen-welcome');
        showToast('No existe un usuario activo para este rol.', 'error');
        return;
    }

    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.style.display = 'flex';

    AppState.currentRole = role;
    AppState.currentUser = USERS[role];
    saveSession(role, USERS[role]);

    buildSidebar(role);
    updateUserInfo(role);
    renderNotifications();

    if (role === 'docente') {
        showView('view-dashboard-docente');
        updateDocenteDashboard();
    } else if (role === 'alumno') {
        showView('view-dashboard-alumno');
        updateAlumnoDashboard();
    } else if (role === 'admin') {
        showView('view-dashboard-admin');
        populateAdminDashboard();
    }
    showLatestUpdateNotice();
}

// ============================================
// ADMIN - POPULATE DASHBOARD (XAMPP style)
// ============================================
function populateAdminDashboard() {
    const docenteCount = USERS.docente ? 1 : 0;
    const alumnoCount = ALUMNOS_REGISTRADOS.length;
    const escuelas = new Set();

    if (USERS.docente && USERS.docente.escuelas) {
        USERS.docente.escuelas.forEach(e => escuelas.add(e.nombre));
    }
    ALUMNOS_REGISTRADOS.forEach(a => { if (a.escuela) escuelas.add(a.escuela); });

    document.getElementById('admin-count-docentes').textContent = docenteCount;
    document.getElementById('admin-count-alumnos').textContent = alumnoCount;
    document.getElementById('admin-count-escuelas').textContent = escuelas.size;
    document.getElementById('admin-badge-docentes').textContent = docenteCount + ' registros';
    document.getElementById('admin-badge-alumnos').textContent = alumnoCount + ' registros';

    const docBody = document.getElementById('admin-docentes-body');
    if (USERS.docente) {
        const d = USERS.docente;
        const escuelasStr = esc(d.escuelas.map(e => e.nombre).join(', '));
        docBody.innerHTML = `<tr>
            <td class="admin-check-cell"><input type="checkbox" data-user-type="docente" data-selected="false" value="${esc(d.id)}" class="admin-selection-checkbox" onchange="toggleUserSelection('docente', ${d.id}, this.checked)"></td>
            <td>${esc(d.id)}</td>
            <td>${esc(d.nombre)}</td>
            <td>${esc(d.apellido)}</td>
            <td>${esc(d.email)}</td>
            <td>${esc(d.materia || '-')}</td>
            <td>${escuelasStr}</td>
            <td><span class="badge-activo">Activo</span></td>
            <td class="admin-action-cell">
                <div class="admin-action-group">
                    <button class="btn btn-sm btn-outline" onclick="showResetPassword('docente', ${d.id}, '${esc(d.nombre)} ${esc(d.apellido)}')">🔐 Modificar</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarDocente(${d.id})">🗑 Eliminar</button>
                </div>
            </td>
        </tr>`;
    } else {
        docBody.innerHTML = '<tr><td colspan="9" class="empty-state">No hay docentes registrados</td></tr>';
    }

    const aluBody = document.getElementById('admin-alumnos-body');
    if (ALUMNOS_REGISTRADOS.length > 0) {
        aluBody.innerHTML = ALUMNOS_REGISTRADOS.map(a => `<tr>
            <td class="admin-check-cell"><input type="checkbox" data-user-type="alumno" data-selected="false" value="${esc(a.id)}" class="admin-selection-checkbox" onchange="toggleUserSelection('alumno', ${a.id}, this.checked)"></td>
            <td>${esc(a.id)}</td>
            <td>${esc(a.nombre)}</td>
            <td>${esc(a.apellido)}</td>
            <td>${esc(a.dni)}</td>
            <td>${esc(a.edad)}</td>
            <td>${esc(a.curso)}° Año</td>
            <td>${esc(a.division)}</td>
            <td>${esc(a.escuela)}</td>
            <td>${esc(a.email)}</td>
            <td>${esc(a.whatsapp)}</td>
            <td><span class="badge-conectado">Registrado</span></td>
            <td class="admin-action-cell">
                <div class="admin-action-group">
                    <button class="btn btn-sm btn-outline" onclick="showResetPassword('alumno', ${a.id}, '${esc(a.nombre)} ${esc(a.apellido)}')">🔐 Modificar</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarAlumno(${a.id})">🗑 Eliminar</button>
                </div>
            </td>
        </tr>`).join('');
    } else {
        aluBody.innerHTML = '<tr><td colspan="13" class="empty-state">No hay alumnos registrados</td></tr>';
    }
}

// ============================================
// DASHBOARD UPDATES
// ============================================
function updateDocenteDashboard() {
    const user = USERS.docente;
    if (!user) return;
    const greetingEl = document.querySelector('#view-dashboard-docente .dashboard-greeting h1');
    const hour = new Date().getHours();
    const saludo = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
    if (greetingEl) greetingEl.textContent = `${saludo} 👋`;

    const stats = document.querySelectorAll('#view-dashboard-docente .stat-number');
    if (stats[0]) stats[0].textContent = CURSOS.length;
    const totalAlumnos = Object.values(ALUMNOS_POR_CURSO).reduce((sum, arr) => sum + arr.length, 0);
    if (stats[1]) stats[1].textContent = totalAlumnos;
    if (stats[2]) stats[2].textContent = TRABAJOS_PRACTICOS.filter(t => t.estado === 'pendiente').length;
    if (stats[3]) stats[3].textContent = EXAMENES.length;

    renderCursosList();
}

function renderCursosList() {
    const el = document.getElementById('cursos-list');
    if (!el) return;
    if (CURSOS.length === 0) {
        el.innerHTML = '<p class="empty-state">No tenés cursos creados. Creá tu primer curso para comenzar.</p>';
        return;
    }
    el.innerHTML = CURSOS.map(c => `
        <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);">
            <div>
                <strong>${esc(c.nombre)}</strong>
                <span style="color:var(--text-secondary); font-size:0.85rem; margin-left:8px;">${esc(c.escuela || 'Sin escuela')}</span>
            </div>
            <div style="display:flex; gap:6px;">
                <span style="color:var(--text-secondary); font-size:0.85rem;">${esc(c.anio || '')} ${esc(c.division || '')}</span>
                <button class="btn btn-danger btn-sm" onclick="eliminarCurso(${c.id})" style="padding:2px 8px; font-size:0.75rem;">✕</button>
            </div>
        </div>
    `).join('');
}

function eliminarCurso(id) {
    if (!confirm('¿Eliminar este curso y todos sus alumnos?')) return;
    CURSOS = CURSOS.filter(c => c.id !== id);
    delete ALUMNOS_POR_CURSO[id];
    saveCursos();
    saveAlumnosPorCurso();
    updateDocenteDashboard();
    showToast('Curso y alumnos eliminados', 'success');
}

function updateAlumnoDashboard() {
    const user = USERS.alumno;
    if (!user) return;
    const nameEl = document.getElementById('greeting-alumno-name');
    if (nameEl) nameEl.textContent = esc(user.nombre);

    const opps = getUserOportunidades(user.id);
    const countEl = document.getElementById('oportunidades-count');
    const fillEl = document.getElementById('oportunidades-fill');
    const textEl = document.getElementById('oportunidades-text');
    if (countEl) countEl.textContent = opps;
    if (fillEl) fillEl.style.width = `${(opps / 5) * 100}%`;
    if (textEl) {
        if (opps === 5) textEl.textContent = 'Todas tus oportunidades disponibles.';
        else if (opps > 2) textEl.textContent = `Te quedan ${opps} oportunidades.`;
        else if (opps > 0) textEl.textContent = `¡Atención! Solo te quedan ${opps}.`;
        else textEl.textContent = 'Sin oportunidades. Se asignó Trabajo Integrador.';
    }

    const stats = document.querySelectorAll('#view-dashboard-alumno .stat-number');
    if (stats[0]) stats[0].textContent = CURSOS.length;
    if (stats[1]) stats[1].textContent = TRABAJOS_PRACTICOS.filter(t => t.estado === 'pendiente').length;
    if (stats[2]) stats[2].textContent = '0';

    renderAlumnoAsistenciaStatus();
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
            <div class="nav-section"><div class="nav-section-title">Principal</div></div>
            <div class="nav-item active" onclick="showView('view-dashboard-docente')" data-view="view-dashboard-docente">
                <span class="nav-icon">🏠</span> Dashboard
            </div>
            <div class="nav-section"><div class="nav-section-title">Gestión</div></div>
            <div class="nav-item" onclick="showView('view-gestionar-alumnos')" data-view="view-gestionar-alumnos">
                <span class="nav-icon">👥</span> Gestionar Alumnos
            </div>
            <div class="nav-item" onclick="showView('view-asistencia')" data-view="view-asistencia">
                <span class="nav-icon">📋</span> Asistencia
            </div>
            <div class="nav-item" onclick="showView('view-materiales')" data-view="view-materiales">
                <span class="nav-icon">📚</span> Materiales
            </div>
            <div class="nav-item" onclick="showView('view-informatica')" data-view="view-informatica">
                <span class="nav-icon">💻</span> Informática
            </div>
            <div class="nav-item" onclick="showView('view-tp')" data-view="view-tp">
                <span class="nav-icon">📝</span> Trabajos Prácticos
            </div>
            <div class="nav-item" onclick="showView('view-examenes')" data-view="view-examenes">
                <span class="nav-icon">📊</span> Exámenes
            </div>
            <div class="nav-section"><div class="nav-section-title">Aula Virtual</div></div>
            <div class="nav-item" onclick="showView('view-aula-controlada')" data-view="view-aula-controlada">
                <span class="nav-icon">🔒</span> Aula Controlada
            </div>
            <div class="nav-item" onclick="showView('view-panel-realtime')" data-view="view-panel-realtime">
                <span class="nav-icon">📡</span> Panel en Vivo
            </div>
            <div class="nav-section"><div class="nav-section-title">Escuela</div></div>
            <div class="nav-item" onclick="cambiarEscuela()">
                <span class="nav-icon">🏫</span> Cambiar Escuela
            </div>`;
    } else if (role === 'alumno') {
        items = `
            <div class="nav-section"><div class="nav-section-title">Principal</div></div>
            <div class="nav-item active" onclick="showView('view-dashboard-alumno')" data-view="view-dashboard-alumno">
                <span class="nav-icon">🏠</span> Mi Panel
            </div>
            <div class="nav-section"><div class="nav-section-title">Aprendizaje</div></div>
            <div class="nav-item" onclick="showView('view-material-alumno')" data-view="view-material-alumno">
                <span class="nav-icon">📚</span> Materiales
            </div>
            <div class="nav-item" onclick="showView('view-informatica')" data-view="view-informatica">
                <span class="nav-icon">💻</span> Informática
            </div>
            <div class="nav-item" onclick="showView('view-tp-alumno')" data-view="view-tp-alumno">
                <span class="nav-icon">📝</span> Mis Trabajos Prácticos
            </div>
            <div class="nav-item" onclick="showView('view-asistencia-alumno')" data-view="view-asistencia-alumno">
                <span class="nav-icon">📱</span> Asistencia
            </div>
            <div class="nav-item" onclick="showView('view-examen-alumno')" data-view="view-examen-alumno">
                <span class="nav-icon">📊</span> Rendir Examen
            </div>
            <div class="nav-section"><div class="nav-section-title">Progreso</div></div>
            <div class="nav-item" onclick="showView('view-notas-alumno')" data-view="view-notas-alumno">
                <span class="nav-icon">⭐</span> Mis Notas
            </div>`;
    } else if (role === 'admin') {
        items = `
            <div class="nav-section"><div class="nav-section-title">Administración</div></div>
            <div class="nav-item active" onclick="showView('view-dashboard-admin')" data-view="view-dashboard-admin">
                <span class="nav-icon">🏠</span> Base de Datos
            </div>`;
    }

    nav.innerHTML = items;
}

function updateUserInfo(role) {
    const user = USERS[role];
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-info')?.querySelector('.user-avatar');
    const topbarAvatar = document.getElementById('topbar-avatar');

    const roleName = role === 'docente' ? 'Docente' : role === 'alumno' ? 'Alumno' : 'Administrador';

    if (!user) {
        if (nameEl) nameEl.textContent = roleName;
        if (roleEl) roleEl.textContent = '';
        if (avatarEl) avatarEl.textContent = '?';
        if (topbarAvatar) topbarAvatar.textContent = '?';
        return;
    }

    const displayName = `${user.apellido} ${user.nombre}`;
    if (nameEl) nameEl.textContent = displayName;
    if (avatarEl) avatarEl.textContent = user.nombre.charAt(0);
    if (topbarAvatar) topbarAvatar.textContent = user.nombre.charAt(0);

    if (role === 'docente' && user.escuelaActual) {
        if (roleEl) roleEl.textContent = `${roleName} — ${user.escuelaActual.nombre}`;
    } else {
        if (roleEl) roleEl.textContent = roleName;
    }

    const notifBadge = document.getElementById('notif-badge');
    if (notifBadge) notifBadge.style.display = 'none';
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
    const restrictedViews = ['view-material-alumno', 'view-tp-alumno', 'view-examen-alumno', 'view-informatica'];
    if (AppState.currentRole === 'alumno' && restrictedViews.includes(viewId) && !hasActiveClassAccess()) {
        showToast('Acceso disponible únicamente durante la clase. Escaneá el QR del docente.', 'warning');
        viewId = 'view-asistencia-alumno';
    }
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');

    const view = document.getElementById(viewId);
    if (view) view.style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewId) item.classList.add('active');
    });

    const titles = {
        'view-dashboard-docente': 'Dashboard',
        'view-dashboard-alumno': 'Mi Panel',
        'view-dashboard-admin': 'Base de Datos',
        'view-asistencia': 'Asistencia',
        'view-materiales': 'Materiales Didácticos',
        'view-informatica': 'Informática',
        'view-tp': 'Trabajos Prácticos',
        'view-examenes': 'Exámenes',
        'view-aula-controlada': 'Aula Controlada',
        'view-panel-realtime': 'Panel en Tiempo Real',
        'view-examen-alumno': 'Examen en Curso',
        'view-material-alumno': 'Mis Materiales',
        'view-tp-alumno': 'Mis Trabajos Prácticos',
        'view-asistencia-alumno': 'Registrar Asistencia',
        'view-notas-alumno': 'Mis Notas'
    };

    const topbarTitle = document.getElementById('topbar-title');
    if (topbarTitle && titles[viewId]) topbarTitle.textContent = titles[viewId];

    AppState.currentView = viewId;

    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 768) sidebar.classList.remove('open');

    initViewContent(viewId);
}

function initViewContent(viewId) {
    if (viewId === 'view-gestionar-alumnos') {
        populateGACursoSelect();
    } else if (viewId === 'view-asistencia') {
        const fechaEl = document.getElementById('asistencia-fecha');
        if (fechaEl) fechaEl.textContent = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
        populateAsistenciaCursos();
        renderAsistenciaHistorial();
    } else if (viewId === 'view-materiales') {
        renderMateriales();
    } else if (viewId === 'view-material-alumno') {
        renderMaterialesAlumno();
    } else if (viewId === 'view-tp') {
        renderTP();
    } else if (viewId === 'view-examenes') {
        renderExamenes();
        renderPreguntasBanco();
    } else if (viewId === 'view-aula-controlada') {
        populateAulaCursos();
    } else if (viewId === 'view-panel-realtime') {
        populateRealtimeExamenes();
    } else if (viewId === 'view-asistencia-alumno') {
        renderAlumnoAsistenciaStatus();
    } else if (viewId === 'view-informatica') {
        const libraryLink = document.getElementById('docente-informatica-library');
        if (libraryLink) libraryLink.style.display = ['docente', 'admin'].includes(AppState.currentRole) ? 'inline-block' : 'none';
    }
}

function populateSelectOptions(selectId, options) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const first = sel.querySelector('option');
    sel.innerHTML = '';
    if (first) sel.appendChild(first);
    options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value || opt;
        o.textContent = opt.label || opt;
        sel.appendChild(o);
    });
}

// ============================================
// GESTIONAR ALUMNOS POR CURSO
// ============================================
let _csvAlumnosParsed = [];

function populateGACursoSelect() {
    populateSelectOptions('ga-curso-select', CURSOS.map(c => ({ value: c.id, label: `${c.nombre} — ${c.escuela}` })));
    const el = document.getElementById('ga-content');
    if (el) el.innerHTML = '<div class="card"><div class="card-body"><p class="empty-state">Seleccioná un curso para gestionar sus alumnos.</p></div></div>';
}

function cargarAlumnosCurso() {
    const cursoId = document.getElementById('ga-curso-select')?.value;
    const el = document.getElementById('ga-content');
    if (!el) return;

    if (!cursoId) {
        el.innerHTML = '<div class="card"><div class="card-body"><p class="empty-state">Seleccioná un curso para gestionar sus alumnos.</p></div></div>';
        return;
    }

    const curso = CURSOS.find(c => c.id == cursoId);
    const alumnos = ALUMNOS_POR_CURSO[cursoId] || [];

    let alumnosHtml = '';
    if (alumnos.length === 0) {
        alumnosHtml = '<p class="empty-state">No hay alumnos cargados. Importá un CSV o agregá alumnos manualmente.</p>';
    } else {
        alumnosHtml = `
            <table class="data-table">
                <thead><tr><th>#</th><th>Apellido</th><th>Nombre</th><th>DNI</th><th>Acciones</th></tr></thead>
                <tbody>${alumnos.map((a, i) => `<tr>
                    <td>${i + 1}</td>
                    <td>${esc(a.apellido)}</td>
                    <td>${esc(a.nombre)}</td>
                    <td>${esc(a.dni || '-')}</td>
                    <td><button class="btn btn-danger btn-sm" onclick="eliminarAlumnoDelCurso('${cursoId}', ${a.id})" style="padding:2px 8px;font-size:0.75rem;">✕</button></td>
                </tr>`).join('')}</tbody>
            </table>`;
    }

    el.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3>📋 ${esc(curso.nombre)} — ${esc(curso.escuela)}</h3>
                <span class="badge badge-blue">${alumnos.length} alumno${alumnos.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="card-body" style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="showModal('modal-importar-csv')">📤 Importar CSV</button>
                <button class="btn btn-primary" onclick="showModal('modal-agregar-alumno-curso')">➕ Agregar Alumno</button>
                ${alumnos.length > 0 ? `<button class="btn btn-danger" onclick="eliminarTodosAlumnosCurso('${cursoId}')">🗑️ Eliminar Todos</button>` : ''}
            </div>
        </div>
        <div class="card" style="margin-top:1rem;">
            <div class="card-body">${alumnosHtml}</div>
        </div>`;
}

function previewCSV(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const lines = e.target.result.split('\n').map(l => l.trim()).filter(l => l);
        _csvAlumnosParsed = [];
        let startRow = 0;

        if (lines.length > 0) {
            const first = lines[0].toLowerCase();
            if (first.includes('apellido') || first.includes('nombre') || first.includes('dni')) {
                startRow = 1;
            }
        }

        for (let i = startRow; i < lines.length; i++) {
            const parts = lines[i].split(';');
            if (parts.length >= 2) {
                _csvAlumnosParsed.push({
                    id: Date.now() + i,
                    apellido: parts[0].trim(),
                    nombre: parts[1].trim(),
                    dni: parts[2] ? parts[2].trim() : ''
                });
            }
        }

        const preview = document.getElementById('csv-preview');
        const btnConfirm = document.getElementById('btn-confirmar-csv');
        if (!preview) return;

        if (_csvAlumnosParsed.length === 0) {
            preview.innerHTML = '<p style="color:var(--danger);">No se encontraron alumnos válidos en el archivo.</p>';
            preview.style.display = 'block';
            if (btnConfirm) btnConfirm.style.display = 'none';
            return;
        }

        preview.innerHTML = `
            <p style="font-weight:600;margin-bottom:8px;">Vista previa — ${_csvAlumnosParsed.length} alumno${_csvAlumnosParsed.length !== 1 ? 's' : ''} encontrado${_csvAlumnosParsed.length !== 1 ? 's' : ''}:</p>
            <table class="data-table">
                <thead><tr><th>Apellido</th><th>Nombre</th><th>DNI</th></tr></thead>
                <tbody>${_csvAlumnosParsed.slice(0, 20).map(a => `<tr><td>${esc(a.apellido)}</td><td>${esc(a.nombre)}</td><td>${esc(a.dni || '-')}</td></tr>`).join('')}</tbody>
            </table>
            ${_csvAlumnosParsed.length > 20 ? `<p style="color:var(--text-secondary);font-size:0.85rem;margin-top:8px;">Mostrando 20 de ${_csvAlumnosParsed.length} alumnos.</p>` : ''}`;
        preview.style.display = 'block';
        if (btnConfirm) btnConfirm.style.display = 'inline-flex';
    };
    reader.readAsText(file);
}

function confirmarImportacionCSV() {
    const cursoId = document.getElementById('ga-curso-select')?.value;
    if (!cursoId) { showToast('Seleccioná un curso primero', 'error'); return; }
    if (_csvAlumnosParsed.length === 0) { showToast('No hay alumnos para importar', 'error'); return; }

    const existentes = ALUMNOS_POR_CURSO[cursoId] || [];
    const existenteIds = new Set(existentes.map(a => `${a.apellido.toLowerCase()}_${a.nombre.toLowerCase()}`));
    const nuevos = _csvAlumnosParsed.filter(a => !existenteIds.has(`${a.apellido.toLowerCase()}_${a.nombre.toLowerCase()}`));

    ALUMNOS_POR_CURSO[cursoId] = [...existentes, ...nuevos];
    saveAlumnosPorCurso();
    _csvAlumnosParsed = [];
    closeAllModals();
    cargarAlumnosCurso();
    showToast(`${nuevos.length} alumno${nuevos.length !== 1 ? 's' : ''} importado${nuevos.length !== 1 ? 's' : ''}`, 'success');
}

function agregarAlumnoManual() {
    const cursoId = document.getElementById('ga-curso-select')?.value;
    if (!cursoId) { showToast('Seleccioná un curso primero', 'error'); return; }

    const apellido = document.getElementById('ga-alumno-apellido')?.value.trim();
    const nombre = document.getElementById('ga-alumno-nombre')?.value.trim();
    const dni = document.getElementById('ga-alumno-dni')?.value.trim();

    if (!apellido || !nombre) { showToast('Completá apellido y nombre', 'error'); return; }

    if (!ALUMNOS_POR_CURSO[cursoId]) ALUMNOS_POR_CURSO[cursoId] = [];
    ALUMNOS_POR_CURSO[cursoId].push({ id: Date.now(), apellido, nombre, dni });
    ALUMNOS_POR_CURSO[cursoId].sort((a, b) => a.apellido.localeCompare(b.apellido));
    saveAlumnosPorCurso();
    closeAllModals();
    cargarAlumnosCurso();
    showToast('Alumno agregado', 'success');
}

function eliminarAlumnoDelCurso(cursoId, alumnoId) {
    if (!confirm('¿Eliminar este alumno?')) return;
    if (!ALUMNOS_POR_CURSO[cursoId]) return;
    ALUMNOS_POR_CURSO[cursoId] = ALUMNOS_POR_CURSO[cursoId].filter(a => a.id !== alumnoId);
    saveAlumnosPorCurso();
    cargarAlumnosCurso();
    showToast('Alumno eliminado', 'success');
}

function eliminarTodosAlumnosCurso(cursoId) {
    if (!confirm('¿Eliminar TODOS los alumnos de este curso? Esta acción no se puede deshacer.')) return;
    ALUMNOS_POR_CURSO[cursoId] = [];
    saveAlumnosPorCurso();
    cargarAlumnosCurso();
    showToast('Todos los alumnos eliminados del curso', 'success');
}

function populateAsistenciaCursos() {
    populateSelectOptions('asistencia-curso', CURSOS.map(c => ({ value: c.id, label: `${c.nombre} — ${c.escuela}` })));
    if (CURSOS.length === 0) {
        const sel = document.getElementById('asistencia-curso');
        if (sel) sel.innerHTML = '<option value="">No hay cursos creados. Creá uno desde el Dashboard.</option>';
    }
}

function populateAulaCursos() {
    populateSelectOptions('aula-curso-select', CURSOS.map(c => ({ value: c.id, label: c.nombre })));
}

function populateRealtimeExamenes() {
    populateSelectOptions('realtime-examen-select', EXAMENES.map(e => ({ value: e.id, label: e.titulo })));
}

// ============================================
// ASISTENCIA — RENDER
// ============================================
function renderAsistenciaHistorial() {
    const el = document.getElementById('asistencia-historial');
    if (!el) return;
    if (ASISTENCIAS.length === 0) { el.innerHTML = '<p class="empty-state">No hay registros anteriores.</p>'; return; }
    el.innerHTML = ASISTENCIAS.slice(-10).reverse().map(a => {
        const fecha = new Date(a.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
        const total = a.registros.length;
        const pres = a.registros.filter(r => r.presente).length;
        const curso = a.cursoNombre ? `<span style="margin-left:6px;color:var(--text-secondary);font-size:0.8rem;">— ${esc(a.cursoNombre)}</span>` : '';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid #e5e7eb;font-size:0.85rem;"><span>📅 ${fecha}${curso}</span><span><span class="badge badge-green">${pres} presentes</span> / <span class="badge badge-red">${total - pres} ausentes</span></span></div>`;
    }).join('');
}

// ============================================
// MATERIALES — RENDER
// ============================================
function renderMateriales() {
    const grid = document.getElementById('materiales-grid');
    if (!grid) return;
    if (MATERIALES.length === 0) { grid.innerHTML = '<p class="empty-state">No hay materiales subidos.</p>'; return; }
    grid.innerHTML = MATERIALES.map(m => {
        const fecha = new Date(m.fecha).toLocaleDateString('es-AR');
        const icon = m.tipo === 'PDF' ? '📄' : m.tipo === 'Video (enlace)' ? '🎬' : '📝';
        return `<div class="card" style="margin-bottom:1rem;">
            <div class="card-header"><h3>${icon} ${esc(m.titulo)}</h3><span class="badge badge-blue">${esc(m.tipo)}</span></div>
            <div class="card-body"><p style="font-size:0.85rem;color:var(--text-muted);">${esc(m.descripcion || 'Sin descripción')}</p><p style="font-size:0.75rem;color:#94a3b8;margin-top:0.5rem;">📅 ${fecha}</p>
                <div style="margin-top:0.75rem; display:flex; justify-content:flex-end;">
                    <button class="btn btn-danger btn-sm" onclick="eliminarMaterial(${m.id})">🗑️ Eliminar</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderMaterialesAlumno() {
    const grid = document.querySelector('#view-material-alumno .materiales-grid');
    if (!grid) return;
    const publicados = MATERIALES.filter(material => material.publicado !== false &&
        (!material.cursoId || Number(material.cursoId) === Number(AppState.classCourseId)));
    if (publicados.length === 0) {
        grid.innerHTML = '<p class="empty-state">El docente todavía no publicó materiales para esta clase.</p>';
        return;
    }
    grid.innerHTML = publicados.map(material => `
        <div class="card" style="margin-bottom:1rem;">
            <div class="card-header"><h3>📚 ${esc(material.titulo)}</h3><span class="badge badge-green">Disponible en clase</span></div>
            <div class="card-body"><p>${esc(material.descripcion || 'Material indicado por el docente.')}</p><small>Publicado: ${new Date(material.fecha).toLocaleDateString('es-AR')}</small></div>
        </div>`).join('');
}

// ============================================
// TP — RENDER
// ============================================
function renderTP() {
    const pendientes = document.getElementById('tp-list-pendientes');
    const entregados = document.getElementById('tp-list-entregados');
    const corregidos = document.getElementById('tp-list-corregidos');

    const tpPendientes = TRABAJOS_PRACTICOS.filter(t => t.estado === 'pendiente');
    const tpEntregados = TRABAJOS_PRACTICOS.filter(t => t.estado === 'entregado');
    const tpCorregidos = TRABAJOS_PRACTICOS.filter(t => t.estado === 'corregido');

    if (pendientes) {
        pendientes.innerHTML = tpPendientes.length === 0 ? '<p class="empty-state">No hay TP pendientes.</p>'
            : tpPendientes.map(t => `<div class="card" style="margin-bottom:1rem;"><div class="card-header"><h3>📝 ${esc(t.titulo)}</h3><span class="badge badge-orange">Pendiente</span></div><div class="card-body"><p style="font-size:0.85rem;">${esc(t.descripcion || '')}</p>${t.fechaEntrega ? `<p style="font-size:0.75rem;color:#94a3b8;margin-top:0.5rem;">📅 Entrega: ${esc(t.fechaEntrega)}</p>` : ''}<div style="margin-top:0.75rem; display:flex; justify-content:flex-end;"><button class="btn btn-danger btn-sm" onclick="eliminarTP(${t.id})">🗑️ Eliminar</button></div></div></div>`).join('');
    }
    if (entregados) {
        entregados.innerHTML = tpEntregados.length === 0 ? '<p class="empty-state">No hay TP entregados.</p>'
            : tpEntregados.map(t => `<div class="card" style="margin-bottom:1rem;"><div class="card-header"><h3>📝 ${esc(t.titulo)}</h3><span class="badge badge-blue">Entregado</span></div><div class="card-body"><p style="font-size:0.85rem;">${esc(t.descripcion || '')}</p><div style="margin-top:0.75rem; display:flex; justify-content:flex-end;"><button class="btn btn-danger btn-sm" onclick="eliminarTP(${t.id})">🗑️ Eliminar</button></div></div></div>`).join('');
    }
    if (corregidos) {
        corregidos.innerHTML = tpCorregidos.length === 0 ? '<p class="empty-state">No hay TP corregidos.</p>'
            : tpCorregidos.map(t => `<div class="card" style="margin-bottom:1rem;"><div class="card-header"><h3>📝 ${esc(t.titulo)}</h3><span class="badge badge-green">Corregido</span></div><div class="card-body"><div style="display:flex; justify-content:flex-end;"><button class="btn btn-danger btn-sm" onclick="eliminarTP(${t.id})">🗑️ Eliminar</button></div></div></div>`).join('');
    }
}

// ============================================
// EXÁMENES — RENDER
// ============================================
function renderExamenes() {
    const grid = document.getElementById('examenes-grid');
    if (!grid) return;
    if (EXAMENES.length === 0) { grid.innerHTML = '<p class="empty-state">No hay exámenes creados.</p>'; return; }
    grid.innerHTML = EXAMENES.map(e => `<div class="card" style="margin-bottom:1rem;">
        <div class="card-header"><h3>📊 ${esc(e.titulo)}</h3><span class="badge badge-blue">${e.duracion} min</span></div>
        <div class="card-body">
            <p style="font-size:0.85rem;">${e.preguntas ? e.preguntas.length : PREGUNTAS_BANCO.length} preguntas</p>
            <div style="margin-top:0.5rem;"><button class="btn btn-sm btn-outline" onclick="iniciarExamenDocente(${e.id})">▶️ Iniciar para alumnos</button></div>
        </div>
    </div>`).join('');
}

function iniciarExamenDocente(examenId) {
    showToast('Examen activado. Los alumnos pueden rendir desde su panel.', 'success');
}

function renderPreguntasBanco() {
    const grid = document.getElementById('preguntas-banco-grid');
    if (!grid) return;
    if (PREGUNTAS_BANCO.length === 0) { grid.innerHTML = '<p class="empty-state">No hay preguntas en el banco.</p>'; return; }
    grid.innerHTML = PREGUNTAS_BANCO.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem;border-bottom:1px solid #e5e7eb;">
        <div><strong style="color:var(--primary);">P${p.num}</strong> <span style="font-size:0.85rem;">${esc(p.enunciado.substring(0, 80))}${p.enunciado.length > 80 ? '...' : ''}</span></div>
        <div><span class="badge badge-blue">${esc(p.tipoLabel)}</span> <span class="badge badge-green">${p.puntos} pts</span></div>
    </div>`).join('');
}

// ============================================
// AULA CONTROLADA — RENDER
// ============================================
function renderAlumnoMonitor() {
    const grid = document.getElementById('alumno-monitor-grid');
    if (!grid) return;

    const cursoId = document.getElementById('aula-curso-select')?.value;
    const alumnos = cursoId ? (ALUMNOS_POR_CURSO[cursoId] || []) : ALUMNOS_REGISTRADOS;

    let html = '';
    alumnos.forEach(alumno => {
        const opps = getUserOportunidades(alumno.id);
        let dots = '';
        for (let i = 0; i < 5; i++) dots += `<div class="am-dot ${i >= opps ? 'used' : ''}"></div>`;

        html += `<div class="alumno-monitor-card">
            <div class="am-avatar">${esc(alumno.nombre.charAt(0))}</div>
            <div class="am-name">${esc(alumno.apellido)}, ${esc(alumno.nombre)}</div>
            <div class="am-oportunidades">${dots}</div>
            <div class="am-status">${alumno.conectado ? '🟢 Conectado' : '🔴 Desconectado'}</div>
        </div>`;
    });

    grid.innerHTML = html || '<p class="empty-state">No hay alumnos en este curso.</p>';
    const conectados = alumnos.filter(a => a.conectado).length;
    const conectadosEl = document.getElementById('aula-conectados');
    if (conectadosEl) conectadosEl.textContent = conectados;
}
// ============================================
function loadRealtimePanel() {
    const examenId = document.getElementById('realtime-examen-select')?.value;
    if (!examenId) { document.getElementById('realtime-live-badge').style.display = 'none'; return; }
    document.getElementById('realtime-live-badge').style.display = 'inline-flex';

    const totalAlumnos = Object.values(ALUMNOS_POR_CURSO).reduce((sum, arr) => sum + arr.length, 0);
    const body = document.getElementById('realtime-alumnos-body');
    if (totalAlumnos === 0) {
        body.innerHTML = '<tr><td colspan="4"><p class="empty-state">No hay alumnos en los cursos.</p></td></tr>';
        return;
    }
    body.innerHTML = Object.values(ALUMNOS_POR_CURSO).flat().map((a, i) => `<tr>
        <td>${esc(a.apellido)}, ${esc(a.nombre)}</td>
        <td>00:00</td>
        <td>0/${PREGUNTAS_BANCO.length}</td>
        <td><span class="badge badge-red">Esperando</span></td>
    </tr>`).join('');
}

// ============================================
// LOGIN - DOCENTE
// ============================================
document.getElementById('login-form-docente')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = normalizeText(document.getElementById('login-docente-email').value).toLowerCase();
    const password = document.getElementById('login-docente-password').value;
    const role = 'docente';
    const attempt = getLoginAttemptState(role);
    if (attempt.lockUntil && Date.now() < attempt.lockUntil) {
        showToast('Este usuario está temporalmente bloqueado por demasiados intentos.', 'warning');
        return;
    }

    const user = USERS.docente;
    if (!user || user.email !== email) {
        registerFailedAttempt(role);
        showToast('No se encontró una cuenta con ese email. Registrate primero.', 'error');
        return;
    }

    if (user.passwordHash !== simpleHash(password) && user.password !== password) {
        registerFailedAttempt(role);
        showToast('Contraseña incorrecta', 'error');
        return;
    }
    if (!user.passwordHash) { user.passwordHash = simpleHash(password); saveUsers(); }

    registerSuccessAttempt(role);
    if (user.escuelas.length > 1) {
        saveSession(role, user);
        showSchoolSelector(user);
    } else {
        user.escuelaActual = user.escuelas[0];
        saveSession(role, user);
        showApp('docente');
    }
    showToast(`¡Bienvenido, Prof. ${user.apellido}!`, 'success');
});

// ============================================
// LOGIN - ALUMNO
// ============================================
document.getElementById('login-form-alumno')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = normalizeText(document.getElementById('login-alumno-email').value).toLowerCase();
    const password = document.getElementById('login-alumno-password').value;
    const role = 'alumno';

    if (getLoginAttemptState(role).lockUntil && Date.now() < getLoginAttemptState(role).lockUntil) {
        showToast('Este usuario está temporalmente bloqueado por demasiados intentos.', 'warning');
        return;
    }

    const alumno = ALUMNOS_REGISTRADOS.find(a => String(a.email).toLowerCase() === email || String(a.dni) === email);

    if (!alumno) {
        registerFailedAttempt(role);
        showToast('No se encontró una cuenta con ese email/DNI. Registrate primero.', 'error');
        return;
    }

    if (alumno.passwordHash !== simpleHash(password) && alumno.password !== password) {
        registerFailedAttempt(role);
        showToast('Contraseña incorrecta', 'error');
        return;
    }
    if (!alumno.passwordHash) { alumno.passwordHash = simpleHash(password); saveAlumnos(); }

    registerSuccessAttempt(role);
    USERS.alumno = alumno;
    saveUsers();
    saveSession(role, alumno);
    showApp('alumno');
    showToast(`¡Bienvenido, ${alumno.nombre}!`, 'success');
});

// ============================================
// LOGIN - ADMIN
// ============================================
document.getElementById('login-form-admin')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('login-admin-email').value.trim();
    const password = document.getElementById('login-admin-password').value;

    if (email !== USERS.admin.email) {
        showToast('Email de administrador no encontrado', 'error');
        return;
    }

    if (USERS.admin.passwordHash !== simpleHash(password)) {
        showToast('Contraseña de administrador incorrecta', 'error');
        return;
    }
    showApp('admin');
    showToast(`¡Bienvenido, ${USERS.admin.emailCompleto}!`, 'success');
});

// ============================================
// SCHOOL SELECTOR
// ============================================
function showSchoolSelector(user) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const appContainer = document.getElementById('app-container');
    if (appContainer) appContainer.style.display = 'none';

    const screen = document.getElementById('screen-select-escuela');
    if (screen) screen.style.display = 'flex';

    const list = document.getElementById('escuelas-list');
    if (!list) return;

    const colores = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626'];
    let html = '';
    user.escuelas.forEach((escuela, index) => {
        const color = colores[index % colores.length];
        html += `
            <div class="escuela-item" onclick="selectEscuela(${index})">
                <div class="escuela-icon" style="background:linear-gradient(135deg, ${color}, ${color}dd);">🏫</div>
                <div class="escuela-info">
                    <h4>${esc(escuela.nombre)}</h4>
                    <p>${esc(escuela.direccion)}</p>
                </div>
                <span class="escuela-arrow">→</span>
            </div>`;
    });

    list.innerHTML = html;
    AppState._pendingDocente = user;
}

function cambiarEscuela() {
    const user = USERS.docente;
    if (user && user.escuelas.length > 1) {
        showSchoolSelector(user);
    } else {
        showToast('Solo tenés una escuela asignada', 'info');
    }
}

function selectEscuela(index) {
    const user = AppState._pendingDocente;
    if (user && user.escuelas[index]) {
        user.escuelaActual = user.escuelas[index];
        USERS.docente = user;
        saveUsers();
        showApp('docente');
        showToast(`Trabajando en: ${esc(user.escuelaActual.nombre)}`, 'success');
    }
}

// ============================================
// REGISTRO DOCENTE
// ============================================
document.getElementById('register-docente-form')?.addEventListener('submit', function(e) {
    e.preventDefault();

    const password = document.getElementById('regd-password').value;
    const passwordConfirm = document.getElementById('regd-password-confirm').value;

    if (password !== passwordConfirm) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
    }

    if (password.length < 8) {
        showToast('La contraseña debe tener al menos 8 caracteres', 'error');
        return;
    }

    const email = document.getElementById('regd-email').value.trim();

    if (USERS.docente && USERS.docente.email === email) {
        showToast('Ya existe un docente registrado con ese email', 'error');
        return;
    }

    const escuelasRaw = document.getElementById('regd-escuelas').value;
    const escuelas = escuelasRaw.split(';').map(e => e.trim()).filter(e => e.length > 0);

    if (escuelas.length === 0) {
        showToast('Agregá al menos una escuela', 'error');
        return;
    }

    const nombre = document.getElementById('regd-nombre').value.trim();
    const apellido = document.getElementById('regd-apellido').value.trim();

    const newUser = {
        id: Date.now(),
        rol: 'docente',
        nombre: nombre,
        apellido: apellido,
        email: email,
        materia: document.getElementById('regd-materia').value.trim(),
        passwordHash: simpleHash(password),
        escuelas: escuelas.map((e, i) => ({
            id: i + 1,
            nombre: e,
            direccion: 'Dirección pendiente',
            cursos: []
        })),
        escuelaActual: null
    };

    USERS.docente = newUser;
    saveUsers();

    showToast(`¡Cuenta creada! Bienvenido, Prof. ${apellido}`, 'success');

    if (newUser.escuelas.length > 1) {
        showSchoolSelector(newUser);
    } else {
        newUser.escuelaActual = newUser.escuelas[0];
        showApp('docente');
    }
});

// ============================================
// REGISTRO - ALUMNO
// ============================================
document.getElementById('register-form')?.addEventListener('submit', function(e) {
    e.preventDefault();

    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;

    if (password !== passwordConfirm) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
    }

    if (password.length < 8) {
        showToast('La contraseña debe tener al menos 8 caracteres', 'error');
        return;
    }

    const email = document.getElementById('reg-email').value.trim();
    const dni = document.getElementById('reg-dni').value.trim();

    const exists = ALUMNOS_REGISTRADOS.find(a => a.email === email || a.dni === dni);
    if (exists) {
        showToast('Ya existe una cuenta con ese email o DNI', 'error');
        return;
    }

    const newAlumno = {
        id: Date.now(),
        nombre: document.getElementById('reg-nombre').value.trim(),
        apellido: document.getElementById('reg-apellido').value.trim(),
        edad: document.getElementById('reg-edad').value,
        dni: dni,
        curso: document.getElementById('reg-curso').value,
        division: document.getElementById('reg-division').value,
        escuela: document.getElementById('reg-escuela').value.trim(),
        whatsapp: document.getElementById('reg-whatsapp').value.trim(),
        email: email,
        passwordHash: simpleHash(password),
        conectado: false,
        calificaciones: [],
        trabajosEntregados: []
    };

    ALUMNOS_REGISTRADOS.push(newAlumno);
    USERS.alumno = newAlumno;

    const cursoId = String(newAlumno.curso || '');
    if (cursoId) {
        if (!ALUMNOS_POR_CURSO[cursoId]) ALUMNOS_POR_CURSO[cursoId] = [];
        ALUMNOS_POR_CURSO[cursoId].push({
            id: newAlumno.id,
            nombre: newAlumno.nombre,
            apellido: newAlumno.apellido,
            dni: newAlumno.dni,
            division: newAlumno.division,
            curso: newAlumno.curso,
            escuela: newAlumno.escuela,
            email: newAlumno.email,
            whatsapp: newAlumno.whatsapp,
            conectado: false
        });
        saveAlumnosPorCurso();
    }

    saveAlumnos();
    saveUsers();

    showToast(`¡Cuenta creada! Bienvenido, ${newAlumno.nombre}`, 'success');
    showApp('alumno');
});

// ============================================
// PASSWORD STRENGTH
// ============================================
function checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
}

function updatePasswordStrength(inputId, strengthId) {
    const input = document.getElementById(inputId);
    const strengthEl = document.getElementById(strengthId);
    if (!input || !strengthEl) return;

    const password = input.value;
    const strength = checkPasswordStrength(password);
    const bars = strengthEl.querySelectorAll('.strength-bar');
    const text = strengthEl.querySelector('.password-strength-text');

    bars.forEach((bar, i) => {
        bar.className = 'strength-bar';
        if (password.length > 0 && i < strength) {
            if (strength <= 2) bar.classList.add('active-weak');
            else if (strength <= 3) bar.classList.add('active-medium');
            else bar.classList.add('active-strong');
        }
    });

    if (text) {
        if (password.length === 0) text.textContent = '';
        else if (strength <= 2) { text.textContent = 'Débil'; text.style.color = 'var(--danger)'; }
        else if (strength <= 3) { text.textContent = 'Media'; text.style.color = 'var(--warning)'; }
        else { text.textContent = 'Fuerte'; text.style.color = 'var(--success)'; }
    }
}

// ============================================
// LOGOUT
// ============================================
function logout() {
    if (AppState.examenTimer) clearInterval(AppState.examenTimer);
    if (AppState.qrTimerInterval) clearInterval(AppState.qrTimerInterval);
    if (AppState.realtimeInterval) clearInterval(AppState.realtimeInterval);
    stopAlumnoQRCodeScanner();
    clearSession();

    AppState.aulaControlada = false;
    AppState.examenActual.respuestas = {};
    AppState.examenActual.preguntaActual = 0;
    AppState.userMenuOpen = false;

    const userMenu = document.getElementById('user-menu');
    if (userMenu) userMenu.style.display = 'none';

    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    showScreen('screen-welcome');
    showToast('Sesión cerrada', 'success');
}

// ============================================
// PASSWORD TOGGLE
// ============================================
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

// ============================================
// FORGOT PASSWORD HANDLERS
// ============================================
document.getElementById('forgot-form-docente')?.addEventListener('submit', function(e) {
    e.preventDefault();
    showToast('Función de recuperación no disponible aún. Contactá al administrador.', 'info');
    showScreen('screen-login-docente');
});

document.getElementById('forgot-form-alumno')?.addEventListener('submit', function(e) {
    e.preventDefault();
    showToast('Función de recuperación no disponible aún. Contactá al administrador.', 'info');
    showScreen('screen-login-alumno');
});

// ============================================
// NOTIFICATIONS
// ============================================
function toggleNotifications() {
    const panel = document.getElementById('notifications-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
}

function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    if (!menu) return;
    AppState.userMenuOpen = !AppState.userMenuOpen;
    menu.style.display = AppState.userMenuOpen ? 'block' : 'none';
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${esc(message)}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;

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
        if (modalId === 'modal-nuevo-material') {
            populateSelectOptions('material-curso', CURSOS.map(c => ({ value: c.id, label: `${c.nombre} — ${c.escuela}` })));
        }
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
    btn.closest('.tp-tabs').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    const parent = btn.closest('.view') || document;
    parent.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
    const content = document.getElementById(contentId);
    if (content) content.style.display = 'block';
}

// ============================================
// CURSOS (CRUD)
// ============================================
function crearCurso() {
    const nombre = document.getElementById('curso-nombre')?.value.trim();
    const escuela = document.getElementById('curso-escuela')?.value;
    const anio = document.getElementById('curso-anio')?.value;
    const division = document.getElementById('curso-division')?.value.trim();

    if (!nombre) { showToast('Ingresá el nombre del curso', 'error'); return; }
    if (!escuela) { showToast('Seleccioná una escuela', 'error'); return; }

    CURSOS.push({
        id: Date.now(),
        nombre: nombre,
        anio: anio,
        division: division,
        escuela: escuela,
        creadoPor: USERS.docente?.id
    });
    saveCursos();
    closeAllModals();
    updateDocenteDashboard();
    showToast('Curso creado correctamente', 'success');
}

// ============================================
// MATERIALES (CRUD)
// ============================================
function crearMaterial() {
    const titulo = document.getElementById('material-titulo')?.value.trim();
    const descripcion = document.getElementById('material-descripcion')?.value.trim();

    if (!titulo) { showToast('Ingresá el título del material', 'error'); return; }

    MATERIALES.push({
        id: Date.now(),
        titulo: titulo,
        descripcion: descripcion,
        tipo: document.getElementById('material-tipo')?.value || 'PDF',
        fecha: new Date().toISOString(),
        creadoPor: USERS.docente?.id,
        publicado: document.getElementById('material-publicado')?.value !== 'false',
        cursoId: Number(document.getElementById('material-curso')?.value) || null
    });
    saveMateriales();
    closeAllModals();
    renderMateriales();
    showToast('Material subido correctamente', 'success');
}

// ============================================
// TRABAJOS PRÁCTICOS (CRUD)
// ============================================
function crearTP() {
    const titulo = document.getElementById('tp-titulo')?.value.trim();
    const descripcion = document.getElementById('tp-descripcion')?.value.trim();
    const fechaEntrega = document.getElementById('tp-fecha-entrega')?.value;

    if (!titulo) { showToast('Ingresá el título del TP', 'error'); return; }

    TRABAJOS_PRACTICOS.push({
        id: Date.now(),
        titulo: titulo,
        descripcion: descripcion,
        fechaEntrega: fechaEntrega || '',
        estado: 'pendiente',
        creadoPor: USERS.docente?.id
    });
    saveTP();
    closeAllModals();
    renderTP();
    showToast('Trabajo Práctico creado correctamente', 'success');
}

function eliminarMaterial(materialId) {
    if (!confirm('¿Querés eliminar este material de estudio?')) return;
    MATERIALES = MATERIALES.filter(item => Number(item.id) !== Number(materialId));
    saveMateriales();
    renderMateriales();
    showToast('Material eliminado', 'success');
}

function eliminarTP(tpId) {
    if (!confirm('¿Querés eliminar este trabajo práctico?')) return;
    TRABAJOS_PRACTICOS = TRABAJOS_PRACTICOS.filter(item => Number(item.id) !== Number(tpId));
    saveTP();
    renderTP();
    showToast('Trabajo práctico eliminado', 'success');
}

function resetTodaLaBaseDeDatos() {
    if (!confirm('⚠️ Esta acción elimina toda la base de datos local. ¿Seguro que querés continuar?')) return;

    USERS.docente = null;
    USERS.alumno = null;
    ALUMNOS_REGISTRADOS = [];
    CURSOS = [];
    MATERIALES = [];
    TRABAJOS_PRACTICOS = [];
    EXAMENES = [];
    ASISTENCIAS = [];
    ALUMNOS_POR_CURSO = {};
    PREGUNTAS_BANCO = [];

    localStorage.removeItem('aulaUsers');
    localStorage.removeItem('aulaAlumnos');
    localStorage.removeItem('aulaCursos');
    localStorage.removeItem('aulaMateriales');
    localStorage.removeItem('aulaTP');
    localStorage.removeItem('aulaExamenes');
    localStorage.removeItem('aulaAsistencias');
    localStorage.removeItem('aulaAlumnosPorCurso');
    localStorage.removeItem('aulaPreguntas');
    sessionStorage.removeItem('aulaSession');

    populateAdminDashboard();
    renderMateriales();
    renderTP();
    showScreen('screen-welcome');
    showToast('Se eliminó toda la base de datos.', 'warning');
}

// ============================================
// EXÁMENES (CRUD)
// ============================================
function crearExamen() {
    const titulo = document.getElementById('examen-titulo-input')?.value.trim();
    const duracion = document.getElementById('examen-duracion')?.value || 40;

    if (!titulo) { showToast('Ingresá el título del examen', 'error'); return; }

    EXAMENES.push({
        id: Date.now(),
        titulo: titulo,
        duracion: parseInt(duracion),
        preguntas: [],
        creadoPor: USERS.docente?.id
    });
    saveExamenes();
    closeAllModals();
    renderExamenes();
    showToast('Examen creado correctamente', 'success');
}

// ============================================
// BANCO DE PREGUNTAS (CRUD)
// ============================================
function agregarPregunta() {
    const tipo = document.getElementById('tipo-pregunta-select')?.value;
    const enunciado = document.getElementById('pregunta-enunciado-input')?.value.trim();
    const puntos = parseInt(document.getElementById('pregunta-puntos')?.value) || 1;

    if (!enunciado) { showToast('Ingresá el enunciado de la pregunta', 'error'); return; }

    const opciones = [];
    if (tipo === 'multiple' || tipo === 'vf') {
        for (let i = 1; i <= 4; i++) {
            const opt = document.getElementById(`pregunta-opcion-${i}`)?.value.trim();
            if (opt) opciones.push(opt);
        }
    }

    PREGUNTAS_BANCO.push({
        num: PREGUNTAS_BANCO.length + 1,
        tipo: tipo,
        tipoLabel: tipo === 'multiple' ? 'Opción Múltiple' : tipo === 'vf' ? 'Verdadero / Falso' : 'Respuesta Corta',
        puntos: puntos,
        enunciado: enunciado,
        opciones: opciones
    });
    savePreguntas();
    closeAllModals();
    renderPreguntasBanco();
    showToast('Pregunta agregada al banco', 'success');
}

function updatePreguntaForm() {
    const tipo = document.getElementById('tipo-pregunta-select')?.value;
    const multipleSection = document.getElementById('opciones-multiple');
    if (multipleSection) {
        multipleSection.style.display = (tipo === 'multiple' || tipo === 'vf') ? 'block' : 'none';
    }
}

// ============================================
// ASISTENCIA
// ============================================
function loadAsistenciaAlumnos() {
    const lista = document.getElementById('asistencia-lista');
    const btnGuardar = document.getElementById('btn-guardar-asistencia');
    if (!lista) return;

    const cursoId = document.getElementById('asistencia-curso')?.value;
    if (!cursoId) {
        lista.innerHTML = '<p class="empty-state">Seleccioná un curso para ver la lista</p>';
        if (btnGuardar) btnGuardar.style.display = 'none';
        return;
    }

    const alumnos = ALUMNOS_POR_CURSO[cursoId] || [];

    let html = '';
    alumnos.forEach(alumno => {
        html += `
            <div class="alumno-asistencia">
                <input type="checkbox" id="asis-${alumno.id}" onchange="updateAsistenciaCount()">
                <div class="aa-nombre">
                    <strong>${esc(alumno.apellido)}, ${esc(alumno.nombre)}</strong>
                    <small>${esc(alumno.dni || '')}</small>
                </div>
                <span class="badge badge-red">Ausente</span>
            </div>`;
    });

    if (alumnos.length === 0) {
        html = '<p class="empty-state">No hay alumnos cargados en este curso. Importá una lista desde "Gestionar Alumnos".</p>';
    }

    lista.innerHTML = html;
    if (btnGuardar) btnGuardar.style.display = alumnos.length > 0 ? 'block' : 'none';
    updateAsistenciaCount();
}

function updateAsistenciaCount() {
    const checkboxes = document.querySelectorAll('.alumno-asistencia input[type="checkbox"]');
    let presentes = 0;

    checkboxes.forEach(cb => {
        const badge = cb.closest('.alumno-asistencia')?.querySelector('.badge');
        if (cb.checked) {
            presentes++;
            if (badge) { badge.className = 'badge badge-green'; badge.textContent = 'Presente'; }
        } else {
            if (badge) { badge.className = 'badge badge-red'; badge.textContent = 'Ausente'; }
        }
    });

    const presentesEl = document.getElementById('presentes-count');
    const ausentesEl = document.getElementById('ausentes-count');
    if (presentesEl) presentesEl.textContent = `${presentes} Presentes`;
    if (ausentesEl) ausentesEl.textContent = `${checkboxes.length - presentes} Ausentes`;
}

function guardarAsistencia() {
    const cursoId = document.getElementById('asistencia-curso')?.value;
    if (!cursoId) { showToast('Seleccioná un curso', 'error'); return; }

    const fecha = new Date().toISOString();
    const registros = [];
    const checkboxes = document.querySelectorAll('.alumno-asistencia input[type="checkbox"]');
    const alumnos = ALUMNOS_POR_CURSO[cursoId] || [];

    checkboxes.forEach(cb => {
        const id = cb.id.replace('asis-', '');
        const alumno = alumnos.find(a => String(a.id) === id);
        if (alumno) {
            registros.push({
                alumnoId: alumno.id,
                nombre: alumno.nombre,
                apellido: alumno.apellido,
                presente: cb.checked
            });
        }
    });

    const curso = CURSOS.find(c => c.id == cursoId);
    ASISTENCIAS.push({ fecha, cursoId: parseInt(cursoId), cursoNombre: curso?.nombre || '', registros });
    saveAsistencias();
    renderAsistenciaHistorial();
    showToast('Asistencia guardada correctamente', 'success');
}

// ============================================
// QR
// ============================================
function buildAsistenciaQRPayload() {
    const cursoId = document.getElementById('asistencia-curso')?.value || '0';
    const curso = CURSOS.find(c => String(c.id) === String(cursoId)) || { nombre: 'Curso sin nombre' };
    const timestamp = Date.now();
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // FORMATO: AULA_DIGITAL_PRO|asistencia|cursoId=<id>|curso=<nombre encodeURIComponent>|ts=<timestamp>|token=<aleatorio>
    // Nota: se mantiene compatibilidad con payloads generados anteriormente.
    return `AULA_DIGITAL_PRO|asistencia|cursoId=${cursoId}|curso=${encodeURIComponent(curso.nombre)}|ts=${timestamp}|token=${token}`;
}

function buildAsistenciaQRUrl(payload) {
    const rawBase = window.location.href.split('?')[0].split('#')[0];
    const publicBase = 'https://manzamario.github.io/aula-digital-pro/';
    const baseUrl = new URL(rawBase && /^https?:\/\//i.test(rawBase) ? rawBase : publicBase);

    // Añadimos versión para permitir debugging y manejo de cambios futuros
    baseUrl.searchParams.set('v', APP_VERSION);
    // El parámetro `qr` contiene el payload tal como se construyó en `buildAsistenciaQRPayload()`
    // Puede ser un string plano o una cadena URL-encoded; al leerlo usamos decode/normalización.
    baseUrl.searchParams.set('qr', payload);
    return baseUrl.toString();
}

function parseAsistenciaQRPayload(rawValue) {
    // Acepta: texto plano, texto URL-encoded y URLs que incluyan `?qr=`.
    try {
        if (typeof rawValue !== 'string') return null;
        let value = rawValue.trim();

        // Si recibimos una URL completa con query param `qr`, extraemos su valor
        if (/^https?:\/\//i.test(value)) {
            try {
                const u = new URL(value);
                const q = u.searchParams.get('qr');
                if (q) value = q;
            } catch (e) {
                // no es una URL válida, seguimos con el valor original
            }
        }

        // Si viene codificado con % (URL-encoded), lo decodeamos antes de parsear
        if (/%[0-9A-Fa-f]{2}/.test(value)) {
            try { value = decodeURIComponent(value); } catch (e) { /* ignore */ }
        }

        if (!value || !value.startsWith('AULA_DIGITAL_PRO|asistencia|')) return null;

        const parts = value.split('|');
        if (parts.length < 6) return null;

        const cursoId = Number(parts[2].replace('cursoId=', '')) || 0;
        const curso = decodeURIComponent(parts[3].replace('curso=', ''));
        const ts = Number(parts[4].replace('ts=', '')) || 0;
        const token = parts[5].replace('token=', '');

        if (!cursoId || !ts || !token) return null;

        return { type: 'asistencia', cursoId, curso, ts, token };
    } catch (err) {
        // En caso de cualquier error inesperado, devolvemos null (payload inválido)
        return null;
    }
}

function renderAlumnoAsistenciaStatus() {
    const container = document.getElementById('asistencia-alumno-status');
    if (!container) return;

    const alumno = USERS.alumno;
    if (!alumno) {
        container.innerHTML = '<p class="empty-state">Iniciá sesión para registrar tu asistencia.</p>';
        return;
    }

    const registros = ASISTENCIAS.filter(item => Number(item.alumnoId) === Number(alumno.id) && item.source === 'qr')
        .slice(-5)
        .reverse();

    if (registros.length === 0) {
        container.innerHTML = '<p class="empty-state">Aún no registraste tu ingreso.</p>';
        return;
    }

    container.innerHTML = registros.map(item => `
        <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border-color);">
            <div>
                <strong>${esc(item.cursoNombre || 'Curso')}</strong>
                <div style="color:var(--text-secondary); font-size:0.8rem;">${new Date(item.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</div>
            </div>
            <span class="badge badge-green">Registrado</span>
        </div>
    `).join('');
}

function stopAlumnoQRCodeScanner() {
    const video = document.getElementById('qr-video');
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    AppState.alumnoQrStream = null;
}

function scanQRCodeFromFile(input) {
    if (!input || !input.files || !input.files[0]) return;
    if (!window.jsQR) {
        showToast('La lectura de QR desde imagen no está disponible en este navegador.', 'error');
        return;
    }

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });

            if (!code) {
                showToast('No se pudo leer un QR válido en la imagen.', 'error');
                input.value = '';
                return;
            }

            const ok = registrarAsistenciaDesdeQR(code.data);
            if (ok) {
                const status = document.getElementById('qr-status');
                if (status) status.textContent = 'QR leído correctamente. Asistencia registrada.';
            }
            input.value = '';
        };
        image.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function scanFrameFromVideo() {
    const video = document.getElementById('qr-video');
    const status = document.getElementById('qr-status');
    if (!video || !video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(scanFrameFromVideo);
        return;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR ? jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' }) : null;

    if (code) {
        const ok = registrarAsistenciaDesdeQR(code.data);
        if (ok) {
            if (status) status.textContent = 'QR detectado. Asistencia registrada.';
            stopAlumnoQRCodeScanner();
            return;
        }
    }

    if (AppState.alumnoQrStream) {
        requestAnimationFrame(scanFrameFromVideo);
    }
}

function startAlumnoQRCodeScanner() {
    const video = document.getElementById('qr-video');
    const status = document.getElementById('qr-status');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Tu navegador no soporta acceso a cámara para escanear QR.', 'error');
        return;
    }

    if (!video) return;
    if (AppState.alumnoQrStream) {
        showToast('La cámara ya está en uso.', 'info');
        return;
    }

    navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
    }).then(stream => {
        AppState.alumnoQrStream = stream;
        video.srcObject = stream;
        video.play();
        if (status) status.textContent = 'Apuntá la cámara al QR del docente...';
        scanFrameFromVideo();
    }).catch(err => {
        console.error('[AulaDigital] Error acceso a cámara:', err);
        showToast('No se pudo acceder a la cámara. Probá con una imagen.', 'error');
        if (status) status.textContent = 'No se pudo acceder a la cámara. Probá con una imagen.';
    });
}

function registrarAsistenciaDesdeQR(payload) {
    // Normalizar payload: puede venir como payload directo, payload codificado,
    // o como una URL que incluye ?qr=... (ej: cuando se genera con buildAsistenciaQRUrl)
    let raw = String(payload || '');

    // Si es una URL completa, extraer el parámetro 'qr' / 'payload' / 'aula'
    try {
        const possibleUrl = new URL(raw);
        const qrParam = possibleUrl.searchParams.get('qr') || possibleUrl.searchParams.get('payload') || possibleUrl.searchParams.get('aula');
        if (qrParam) raw = decodeURIComponent(qrParam);
    } catch (e) {
        // not a full URL, intentar extraer (?qr=... dentro de la cadena)
        const m = raw.match(/[?&]qr=([^&]+)/);
        if (m && m[1]) {
            try { raw = decodeURIComponent(m[1]); } catch (e2) { raw = m[1]; }
        }
    }

    // Intentar decodificar en caso de que venga codificado directamente
    try {
        const dec = decodeURIComponent(raw);
        if (dec && dec !== raw) raw = dec;
    } catch (e) {
        // ignore
    }

    const parsed = parseAsistenciaQRPayload(raw);
    if (!parsed) {
        showToast('El código QR escaneado no corresponde a una asistencia válida.', 'error');
        return false;
    }

    const now = Date.now();
    const ttl = 5 * 60 * 1000;
    if (now - parsed.ts > ttl) {
        showToast('El código QR ya expiró. Pedí uno nuevo al docente.', 'warning');
        return false;
    }

    let alumno = USERS.alumno;
    if (!alumno) {
        // Intentar restaurar un alumno persistido (si el navegador ya tiene datos guardados)
        const persisted = safeGet('aulaUsers') || {};
        if (persisted.alumno) {
            USERS.alumno = persisted.alumno;
            alumno = USERS.alumno;
            // Crear sesión y mostrar la vista de alumno para redirigir automáticamente
            saveSession('alumno', alumno);
            showApp('alumno');
        }
    }

    if (!alumno) {
        // Si no hay sesión, abrimos modal fallback para que el alumno busque por DNI
        showModal('modal-fallback-dni');
        showToast('Iniciá sesión o buscá tu DNI para registrar asistencia.', 'info');
        return false;
    }

    const cursoId = parseInt(parsed.cursoId, 10);
    const alumnosDelCurso = ALUMNOS_POR_CURSO[cursoId] || [];
    const existe = alumnosDelCurso.some(a => Number(a.id) === Number(alumno.id));

    if (!existe) {
        showToast('Este QR no corresponde a tu curso.', 'error');
        return false;
    }

    grantClassAccess(90, cursoId);

    const yaRegistrado = ASISTENCIAS.some(item => {
        const sameToken = item?.qrToken === parsed.token;
        const sameAlumno = Number(item?.alumnoId) === Number(alumno.id);
        const sameCurso = Number(item?.cursoId) === Number(cursoId);
        return sameToken || (sameAlumno && sameCurso && item?.fecha && (Date.now() - new Date(item.fecha).getTime() < ttl));
    });

    if (yaRegistrado) {
        showToast('Ya registraste tu asistencia para este QR.', 'info');
        renderAlumnoAsistenciaStatus();
        return true;
    }

    ASISTENCIAS.push({
        fecha: new Date().toISOString(),
        cursoId,
        cursoNombre: parsed.curso,
        alumnoId: alumno.id,
        alumnoNombre: alumno.nombre,
        alumnoApellido: alumno.apellido,
        presente: true,
        qrToken: parsed.token,
        source: 'qr'
    });
    saveAsistencias();
    renderAsistenciaHistorial();
    renderAlumnoAsistenciaStatus();
    showView('view-informatica');
    showToast(`Bienvenida a clases, ${esc(alumno.nombre)} ${esc(alumno.apellido)}. Asistencia registrada en ${parsed.curso}.`, 'success');
    return true;
}

// ===== Fallback DNI: búsqueda y selección cuando no hay sesión activa =====
function fallbackBuscarPorDni() {
    const dni = document.getElementById('fallback-dni-input')?.value.trim();
    const results = document.getElementById('fallback-dni-results');
    if (!dni) { showToast('Ingresá un DNI válido', 'error'); return; }

    const matches = ALUMNOS_REGISTRADOS.filter(a => String(a.dni).replace(/\D/g,'').includes(String(dni).replace(/\D/g,'')));
    if (!results) return;
    if (matches.length === 0) {
        results.innerHTML = `<p class="empty-state">No se encontraron alumnos con ese DNI.</p>`;
        return;
    }

    results.innerHTML = matches.map(a => `
        <div class="list-item" style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 0;">
            <div>
                <strong>${esc(a.nombre)} ${esc(a.apellido)}</strong>
                <div style="color:var(--text-secondary); font-size:0.85rem;">DNI: ${esc(a.dni)} · Curso: ${esc(a.curso || '')}</div>
            </div>
            <div><button class="btn btn-primary" onclick="fallbackSeleccionarAlumno(${Number(a.id)})">Seleccionar</button></div>
        </div>
    `).join('');
}

function fallbackSeleccionarAlumno(alumnoId) {
    const alumno = ALUMNOS_REGISTRADOS.find(a => Number(a.id) === Number(alumnoId));
    if (!alumno) { showToast('Alumno no encontrado', 'error'); return; }

    // Crear sesión temporal para proceder con el registro (no guarda contraseña)
    USERS.alumno = { ...alumno };
    saveSession('alumno', USERS.alumno);
    closeAllModals();
    showToast(`Sesión iniciada como ${esc(alumno.nombre)} ${esc(alumno.apellido)} (temporal)`, 'success');
    // Volver a intentar registrar la última lectura QR si existe en el historial de navegación
}

function initQRCodeReaderFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const payload = params.get('qr') || params.get('payload') || params.get('aula');
        if (payload) {
            const decoded = decodeURIComponent(payload);
            if (registrarAsistenciaDesdeQR(decoded)) {
                history.replaceState(null, '', window.location.pathname);
            }
        }
    } catch (error) {
        console.warn('[AulaDigital] Error leyendo payload QR desde URL:', error);
    }
}

function generarQR() {
    const qrDisplay = document.getElementById('qr-display');
    const qrCodeEl = document.getElementById('qr-code');
    const cursoId = document.getElementById('asistencia-curso')?.value;

    if (!cursoId) {
        showToast('Seleccioná un curso antes de generar el QR.', 'error');
        return;
    }

    if (qrDisplay) qrDisplay.style.display = 'block';

    const payload = buildAsistenciaQRPayload();
    const qrUrl = buildAsistenciaQRUrl(payload);
    if (!qrCodeEl) return;

    qrCodeEl.innerHTML = '';

    const qrImage = document.createElement('img');
    qrImage.alt = 'Código QR de asistencia';
    qrImage.title = 'Código QR de asistencia';
    qrImage.style.width = '100%';
    qrImage.style.height = '100%';
    qrImage.style.objectFit = 'contain';
    qrImage.style.display = 'block';
    qrImage.style.borderRadius = '6px';

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data=${encodeURIComponent(qrUrl)}`;
    qrImage.src = qrApiUrl;
    qrImage.onerror = () => {
        console.warn('[AulaDigital] QR remote fallback failed; trying local canvas generator.');
        if (window.QRCode) {
            const canvas = document.createElement('canvas');
            canvas.width = 180;
            canvas.height = 180;
            canvas.setAttribute('aria-label', 'Código QR de asistencia');
            canvas.title = 'Código QR de asistencia';
            QRCode.toCanvas(canvas, qrUrl, {
                width: 180,
                margin: 1,
                color: { dark: '#101828', light: '#ffffff' }
            }, (error) => {
                if (error) {
                    console.error('[AulaDigital] Error generando QR:', error);
                    qrCodeEl.innerHTML = '<div class="empty-state">No se pudo generar el QR.</div>';
                    return;
                }
                qrCodeEl.appendChild(canvas);
            });
            return;
        }
        qrCodeEl.innerHTML = '<div class="empty-state">No se pudo generar el QR.</div>';
    };

    qrCodeEl.appendChild(qrImage);
    startQRTimer();
    showToast('QR generado. Válido por 5 minutos.', 'success');
}

function startQRTimer() {
    AppState.qrTimeLeft = 300;
    if (AppState.qrTimerInterval) clearInterval(AppState.qrTimerInterval);

    AppState.qrTimerInterval = setInterval(() => {
        AppState.qrTimeLeft--;
        const minutes = Math.floor(AppState.qrTimeLeft / 60);
        const seconds = AppState.qrTimeLeft % 60;
        const timerEl = document.getElementById('qr-timer');
        if (timerEl) timerEl.textContent = `Válido: ${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (AppState.qrTimeLeft <= 0) {
            clearInterval(AppState.qrTimerInterval);
            showToast('El código QR expiró. Regenerá uno nuevo.', 'warning');
        }
    }, 1000);
}

function regenerarQR() {
    clearInterval(AppState.qrTimerInterval);
    generarQR();
    showToast('QR regenerado', 'success');
}

// ============================================
// AULA CONTROLADA
// ============================================
function toggleAulaControlada() {
    const btn = document.getElementById('btn-activar-aula');
    const content = document.getElementById('aula-controlada-content');

    if (!AppState.aulaControlada) {
        AppState.aulaControlada = true;
        if (btn) { btn.textContent = '🔓 Desactivar Aula'; btn.classList.remove('btn-danger'); btn.classList.add('btn-success'); }
        if (content) content.style.display = 'block';
        renderAlumnoMonitor();
        showToast('Aula Controlada activada. Los alumnos serán monitoreados.', 'warning');
    } else {
        AppState.aulaControlada = false;
        if (btn) { btn.textContent = '🔒 Activar Aula Controlada'; btn.classList.remove('btn-success'); btn.classList.add('btn-danger'); }
        if (content) content.style.display = 'none';
        showToast('Aula Controlada desactivada.', 'success');
    }
}

function autorizarReingreso(btn, autorizar) {
    const solicitud = btn.closest('.solicitud-item');
    if (solicitud) {
        solicitud.remove();
        showToast(autorizar ? 'Reingreso autorizado' : 'Reingreso rechazado', autorizar ? 'success' : 'error');
    }
}

// ============================================
// OPORTUNIDADES — per student, persisted
// ============================================
function getUserOportunidades(alumnoId) {
    const data = safeGet('aulaOportunidades') || {};
    return data[alumnoId] != null ? data[alumnoId] : 5;
}

function setUserOportunidades(alumnoId, value) {
    const data = safeGet('aulaOportunidades') || {};
    data[alumnoId] = value;
    safeSet('aulaOportunidades', data);
}

// ============================================
// EXIT DETECTION (Aula Controlada)
// ============================================
function setupExitDetection() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && AppState.aulaControlada && AppState.currentRole === 'alumno') {
            handleExit('visibilitychange');
        }
    });

    window.addEventListener('blur', () => {
        if (AppState.aulaControlada && AppState.currentRole === 'alumno') {
            handleExit('blur');
        }
    });

    window.addEventListener('beforeunload', (e) => {
        if (AppState.aulaControlada && AppState.currentRole === 'alumno') {
            handleExit('beforeunload');
        }
    });
}

function handleExit(eventType) {
    if (AppState.exitTimeout) return;

    AppState.exitTimeout = setTimeout(() => { AppState.exitTimeout = null; }, 5000);

    const user = USERS.alumno;
    if (!user) return;

    let opps = getUserOportunidades(user.id);
    if (opps > 0) {
        opps--;
        setUserOportunidades(user.id, opps);

        const banner = document.getElementById('exit-banner');
        const restantes = document.getElementById('oportunidades-restantes-banner');
        if (banner) banner.style.display = 'flex';
        if (restantes) restantes.textContent = opps;

        showToast(`Salida detectada (-1 oportunidad). Quedan ${opps}`, 'warning');
        updateAlumnoDashboard();

        if (opps <= 0) {
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

    setTimeout(() => {
        if (pending) pending.style.display = 'none';
        showToast('Reingreso autorizado por el docente', 'success');
    }, 3000);
}

// ============================================
// EXAMEN - ALUMNO
// ============================================
function startExamen() {
    if (PREGUNTAS_BANCO.length === 0) {
        showToast('No hay preguntas disponibles. Esperá a que el docente suba el examen.', 'warning');
        return;
    }
    AppState.examenActual.tiempoRestante = 40 * 60;
    AppState.examenActual.preguntaActual = 0;
    AppState.examenActual.respuestas = {};

    renderPregunta(0);
    startExamenTimer();
}

function startExamenTimer() {
    if (AppState.examenTimer) clearInterval(AppState.examenTimer);

    AppState.examenTimer = setInterval(() => {
        AppState.examenActual.tiempoRestante--;

        const minutes = Math.floor(AppState.examenActual.tiempoRestante / 60);
        const seconds = AppState.examenActual.tiempoRestante % 60;

        const countdownEl = document.getElementById('examen-countdown');
        if (countdownEl) {
            countdownEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        const totalTime = 40 * 60;
        const elapsed = totalTime - AppState.examenActual.tiempoRestante;
        const progress = document.getElementById('examen-progress');
        if (progress) progress.style.width = `${(elapsed / totalTime) * 100}%`;

        if (AppState.examenActual.tiempoRestante === 300) {
            showToast('¡Quedan 5 minutos!', 'warning');
        }

        if (AppState.examenActual.tiempoRestante <= 0) {
            clearInterval(AppState.examenTimer);
            showToast('Tiempo agotado. Examen enviado automáticamente.', 'warning');
            finalizarExamen();
        }
    }, 1000);
}

function renderPregunta(index) {
    const preguntas = PREGUNTAS_BANCO;
    if (index < 0 || index >= preguntas.length) return;

    AppState.examenActual.preguntaActual = index;
    const p = preguntas[index];

    const container = document.getElementById('pregunta-container');
    if (!container) return;

    let opcionesHtml = '';
    if (p.tipo === 'multiple') {
        p.opciones.forEach((opt, i) => {
            const letter = String.fromCharCode(97 + i);
            opcionesHtml += `
                <label class="opcion-item">
                    <input type="radio" name="pregunta-${p.num}" value="${esc(letter)}"
                           ${AppState.examenActual.respuestas[p.num] === letter ? 'checked' : ''}
                           onchange="saveAnswer(${p.num}, this.value)">
                    <span class="opcion-radio"></span>
                    <span class="opcion-texto">${esc(opt)}</span>
                </label>`;
        });
    } else if (p.tipo === 'vf') {
        p.opciones.forEach((opt) => {
            opcionesHtml += `
                <label class="opcion-item">
                    <input type="radio" name="pregunta-${p.num}" value="${esc(opt.toLowerCase())}"
                           ${AppState.examenActual.respuestas[p.num] === opt.toLowerCase() ? 'checked' : ''}
                           onchange="saveAnswer(${p.num}, this.value)">
                    <span class="opcion-radio"></span>
                    <span class="opcion-texto">${esc(opt)}</span>
                </label>`;
        });
    } else {
        opcionesHtml = `
            <textarea class="form-textarea" rows="6" placeholder="Escribí tu respuesta acá..."
                      onchange="saveAnswer(${p.num}, this.value)">${esc(AppState.examenActual.respuestas[p.num] || '')}</textarea>`;
    }

    container.innerHTML = `
        <div class="pregunta-header">
            <span class="pregunta-num">Pregunta ${p.num} de ${preguntas.length}</span>
            <span class="pregunta-tipo-badge">${esc(p.tipoLabel)}</span>
            <span class="pregunta-pts">${p.puntos} puntos</span>
        </div>
        <div class="pregunta-enunciado"><p>${esc(p.enunciado)}</p></div>
        <div class="opciones-container">${opcionesHtml}</div>`;

    updatePreguntaNav();

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
        if (i === AppState.examenActual.preguntaActual) btn.classList.add('active');
        const pregunta = PREGUNTAS_BANCO[i];
        if (pregunta && AppState.examenActual.respuestas[pregunta.num]) {
            btn.classList.add('answered');
        } else {
            btn.classList.remove('answered');
        }
    });
}

function goToQuestion(index) { renderPregunta(index); }
function nextQuestion() {
    const current = AppState.examenActual.preguntaActual;
    if (current < PREGUNTAS_BANCO.length - 1) renderPregunta(current + 1);
}
function prevQuestion() {
    const current = AppState.examenActual.preguntaActual;
    if (current > 0) renderPregunta(current - 1);
}

function saveAnswer(preguntaNum, value) {
    AppState.examenActual.respuestas[preguntaNum] = value;
    updatePreguntaNav();
}

function finalizarExamen() {
    if (AppState.examenTimer) clearInterval(AppState.examenTimer);

    const answered = Object.keys(AppState.examenActual.respuestas).length;
    const total = PREGUNTAS_BANCO.length;

    let correctas = 0;
    let puntosTotales = 0;
    let puntosObtenidos = 0;

    PREGUNTAS_BANCO.forEach(p => {
        puntosTotales += p.puntos;
        const respuesta = AppState.examenActual.respuestas[p.num];
        if (respuesta && p.respuestaCorrecta && respuesta === p.respuestaCorrecta) {
            correctas++;
            puntosObtenidos += p.puntos;
        }
    });

    const nota = puntosTotales > 0 ? Math.min(10, Math.round((puntosObtenidos / puntosTotales) * 10)) : Math.min(10, Math.round((answered / total) * 10));
    const aprobado = nota >= 6;

    const statusEl = document.getElementById('resultado-status');
    const notaEl = document.getElementById('resultado-nota');
    const estadoEl = document.getElementById('resultado-estado');

    if (statusEl) {
        statusEl.innerHTML = aprobado
            ? '<span class="resultado-emoji">🎉</span><h2>¡Aprobado!</h2>'
            : '<span class="resultado-emoji">😔</span><h2>Desaprobado</h2>';
    }
    if (notaEl) notaEl.textContent = `${nota}/10`;
    if (estadoEl) {
        estadoEl.textContent = aprobado ? 'Aprobado' : 'Desaprobado';
        estadoEl.className = aprobado ? 'text-green' : 'text-red';
    }

    showModal('modal-resultado-examen');
    showToast(`Examen finalizado. Nota: ${nota}/10.`, aprobado ? 'success' : 'warning');
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
// REALTIME PANEL
// ============================================
function startRealtimeCountdown() {
    if (AppState.realtimeInterval) clearInterval(AppState.realtimeInterval);
    let time = 32 * 60 + 45;
    AppState.realtimeInterval = setInterval(() => {
        time--;
        if (time < 0) { clearInterval(AppState.realtimeInterval); return; }
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        const el = document.getElementById('realtime-countdown');
        if (el) el.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupExitDetection();

    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notifications-panel');
        const bell = document.querySelector('.notification-bell');
        if (panel && !panel.contains(e.target) && !bell?.contains(e.target)) {
            panel.style.display = 'none';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
            const panel = document.getElementById('notifications-panel');
            if (panel) panel.style.display = 'none';
        }
    });

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
