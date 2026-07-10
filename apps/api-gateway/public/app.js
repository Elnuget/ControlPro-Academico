const state = { projects: [], notifications: [] };

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

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.details?.join(', ') || data.error || 'No se pudo completar la operación');
  return data;
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
        student: 'Carlos Angulo'
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
        student: 'Carlos Angulo'
      })
    });
    $('#projectDialog').close();
    event.target.reset();
    showToast('Proyecto creado correctamente');
    await loadDashboard();
  } catch (error) { showToast(error.message, true); }
});

$('#newProjectButton').addEventListener('click', () => {
  const date = new Date(); date.setDate(date.getDate() + 14);
  $('#projectDeadline').value = date.toISOString().slice(0, 10);
  $('#projectDialog').showModal();
});
$('#refreshButton').addEventListener('click', () => loadDashboard(true));

loadDashboard();
setInterval(loadDashboard, 15000);
