const state = { projects: [], notifications: [], user: null, token: sessionStorage.getItem('controlpro_token') };

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[char]);

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short' })
    .format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
}

function relativeDate(value) {
  const days = Math.ceil((new Date(value) - new Date()) / 86400000);
  if (days < 0) return `${Math.abs(days)} d atrasado`;
  if (days === 0) return 'Hoy';
  return `${days} d restantes`;
}

function showToast(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.className = 'toast', 3000);
}

function authenticationMessage(error) {
  return ({
    invalid_credentials: 'El correo o la contraseña no son correctos.',
    too_many_attempts: 'Demasiados intentos. Espera un minuto y vuelve a probar.',
    authentication_required: 'Tu sesión venció. Inicia sesión nuevamente.'
  })[error] || 'No se pudo iniciar sesión. Inténtalo nuevamente.';
}

async function request(url, options = {}, includeAuth = true) {
  const headers = new Headers(options.headers || {});
  if (includeAuth && state.token) headers.set('authorization', `Bearer ${state.token}`);
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && url !== '/api/auth/login') showLogin('Tu sesión venció. Inicia sesión nuevamente.');
  if (!response.ok) throw new Error(data.details?.join(', ') || data.error || 'No se pudo completar la operación');
  return data;
}

function initials(name) {
  return String(name || 'Usuario').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function setAuthenticatedSession(payload) {
  state.token = payload.token || state.token;
  state.user = payload.user;
  if (payload.token) sessionStorage.setItem('controlpro_token', payload.token);
  $('#loginScreen').hidden = true;
  $('#appShell').hidden = false;
  $('#sidebarUserName').textContent = state.user.name;
  $('#topUserName').textContent = state.user.name.split(' ')[0];
  $('#userInitials').textContent = initials(state.user.name);
  $('#dropdownUserName').textContent = state.user.name;
  $('#dropdownUserEmail').textContent = state.user.email;
  document.querySelector('.topbar h1').textContent = `Hola, ${state.user.name.split(' ')[0]}`;
}

function showLogin(message = '') {
  state.token = null;
  state.user = null;
  sessionStorage.removeItem('controlpro_token');
  $('#appShell').hidden = true;
  $('#loginScreen').hidden = false;
  $('#userDropdown').hidden = true;
  const error = $('#loginError');
  error.textContent = message;
  error.hidden = !message;
}

function renderKpis() {
  const active = state.projects.filter(project => project.status !== 'completado');
  const average = state.projects.length
    ? Math.round(state.projects.reduce((sum, project) => sum + Number(project.progress || 0), 0) / state.projects.length)
    : 0;
  const upcoming = [...active].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
  $('#projectCount').textContent = active.length;
  $('#averageProgress').textContent = `${average}%`;
  $('#notificationCount').textContent = state.notifications.length;
  $('#nextDeadline').textContent = upcoming ? formatDate(upcoming.deadline) : '—';
  $('#nextProject').textContent = upcoming ? upcoming.name : 'sin proyectos';
  renderSteps();
}

function renderSteps() {
  const states = {
    stepProject: state.projects.length > 0,
    stepProgress: state.projects.some(project => Number(project.progress) > 0),
    stepActivity: state.notifications.length > 0
  };
  Object.entries(states).forEach(([id, complete]) => {
    document.getElementById(id).classList.toggle('done', complete);
  });
  const projectAction = $('#stepProject [data-action="create-project"]');
  projectAction.textContent = states.stepProject ? 'Proyecto creado' : 'Crear ahora';
}

function renderProjects() {
  const container = $('#projectsList');
  if (!state.projects.length) {
    container.innerHTML = '<div class="empty-state">No hay proyectos. Crea el primero para comenzar.</div>';
    return;
  }
  container.innerHTML = state.projects.map(project => `
    <div class="project-row">
      <div class="project-name">
        <strong>${escapeHtml(project.name)}</strong>
        <small>${escapeHtml(project.subject)} · ${escapeHtml(project.student)}</small>
      </div>
      <div>
        <div class="progress-track"><span style="width:${Number(project.progress)}%"></span></div>
        <div class="progress-label"><span>${escapeHtml(project.status.replace('_', ' '))}</span><b>${Number(project.progress)}%</b></div>
      </div>
      <div class="deadline"><b>${formatDate(project.deadline)}</b><br>${relativeDate(project.deadline)}</div>
      <button class="progress-button" data-progress-id="${project.id}">Registrar avance</button>
    </div>
  `).join('');
}

function renderNotifications() {
  const container = $('#notificationsList');
  if (!state.notifications.length) {
    container.innerHTML = '<div class="empty-state">Aún no hay alertas procesadas.</div>';
    return;
  }
  container.innerHTML = state.notifications.slice(0, 8).map(item => `
    <div class="notification">
      <strong>${escapeHtml(item.type.replaceAll('_', ' '))}</strong>
      <span>${escapeHtml(item.message)}</span>
      <small>${new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</small>
    </div>
  `).join('');
}

async function loadDashboard(showSuccess = false) {
  try {
    const [health, projects, notifications] = await Promise.all([
      request('/health'), request('/api/projects'), request('/api/notifications')
    ]);
    state.projects = projects;
    state.notifications = notifications;
    renderKpis(); renderProjects(); renderNotifications();
    const status = $('#systemStatus');
    status.className = 'status-pill ok';
    status.innerHTML = '<i></i> Sistema operativo';
    if (showSuccess) showToast('Datos actualizados');
  } catch (error) {
    $('#systemStatus').innerHTML = '<i></i> Sistema no disponible';
    showToast(error.message, true);
  }
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-action="create-project"]')) openProjectDialog();
  const progressButton = event.target.closest('[data-progress-id]');
  if (progressButton) {
    const project = state.projects.find(item => item.id === progressButton.dataset.progressId);
    $('#progressProjectId').value = project.id;
    $('#progressProjectName').textContent = project.name;
    $('#percentage').value = project.progress;
    $('#percentageOutput').textContent = `${project.progress}%`;
    $('#progressDialog').showModal();
  }
  const closeButton = event.target.closest('[data-close]');
  if (closeButton) document.getElementById(closeButton.dataset.close).close();
});

$('#percentage').addEventListener('input', event => {
  $('#percentageOutput').textContent = `${event.target.value}%`;
});

$('#progressForm').addEventListener('submit', async event => {
  event.preventDefault();
  const projectId = $('#progressProjectId').value;
  try {
    await request(`/api/projects/${projectId}/progress`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        percentage: Number($('#percentage').value),
        evidence: $('#evidence').value,
        student: state.user.name
      })
    });
    $('#progressDialog').close();
    showToast('Avance guardado y evento publicado');
    setTimeout(() => loadDashboard(), 600);
  } catch (error) { showToast(error.message, true); }
});

$('#projectForm').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await request('/api/projects', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: $('#projectName').value,
        subject: $('#projectSubject').value,
        deadline: $('#projectDeadline').value,
        student: state.user.name
      })
    });
    $('#projectDialog').close();
    event.target.reset();
    showToast('Proyecto creado correctamente');
    await loadDashboard();
  } catch (error) { showToast(error.message, true); }
});

function openProjectDialog() {
  const date = new Date(); date.setDate(date.getDate() + 14);
  $('#projectDeadline').value = date.toISOString().slice(0, 10);
  $('#projectDialog').showModal();
}

$('#newProjectButton').addEventListener('click', openProjectDialog);
$('#heroNewProjectButton').addEventListener('click', openProjectDialog);
$('#refreshButton').addEventListener('click', () => loadDashboard(true));

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('#loginButton');
  const errorBox = $('#loginError');
  errorBox.hidden = true;
  button.disabled = true;
  button.innerHTML = 'Verificando acceso…';
  try {
    const payload = await request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: $('#loginEmail').value.trim(), password: $('#loginPassword').value })
    }, false);
    setAuthenticatedSession(payload);
    $('#loginPassword').value = '';
    await loadDashboard();
  } catch (error) {
    errorBox.textContent = authenticationMessage(error.message);
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Ingresar a ControlPro <span>→</span>';
  }
});

$('#togglePassword').addEventListener('click', event => {
  const input = $('#loginPassword');
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  event.currentTarget.textContent = visible ? 'Ver' : 'Ocultar';
  event.currentTarget.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
});

$('#userMenuButton').addEventListener('click', event => {
  event.stopPropagation();
  const dropdown = $('#userDropdown');
  dropdown.hidden = !dropdown.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!dropdown.hidden));
});

$('#logoutButton').addEventListener('click', () => showLogin());
document.addEventListener('click', event => {
  if (!event.target.closest('.user-menu')) {
    $('#userDropdown').hidden = true;
    $('#userMenuButton').setAttribute('aria-expanded', 'false');
  }
});

async function initialize() {
  if (!state.token) return showLogin();
  try {
    const session = await request('/api/auth/me');
    setAuthenticatedSession(session);
    await loadDashboard();
  } catch {
    showLogin('Tu sesión anterior terminó. Ingresa nuevamente.');
  }
}

initialize();
setInterval(() => { if (state.token) loadDashboard(); }, 15000);
