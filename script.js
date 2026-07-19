const API_BASE = 'http://127.0.0.1:8001';

const authOverlay = document.getElementById('auth-overlay');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const demoLoginButton = document.getElementById('demo-login');
const logoutButton = document.getElementById('logout-btn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const roleSelect = document.getElementById('role-select');
const rolePill = document.getElementById('role-pill');
const schedulingMatrixBtn = document.getElementById('scheduling-matrix-btn');
const maintenanceLogTools = document.getElementById('maintenance-log-tools');
const managerAccessTools = document.getElementById('manager-access-tools');
const machineGrid = document.getElementById('machine-grid');
const feedList = document.getElementById('feed-list');
const insightCard = document.getElementById('insight-card');
const queryInput = document.getElementById('query-input');
const querySubmit = document.getElementById('query-submit');
const runOrchestrationBtn = document.getElementById('run-orchestration');
const queryChips = document.getElementById('query-chips');
const activityStatus = document.getElementById('activity-status');

const state = {
  role: 'Guest',
  roleKey: 'guest',
  username: 'Guest',
  telemetry: [],
  token: null,
  lastQuery: 'Why is Machine M4 in alarm?',
  orchestrating: false,
};

const ROLE_PROFILES = {
  operator: { key: 'operator', label: 'Operator', username: 'ops.manager', password: 'securepass' },
  maintenance: { key: 'maintenance', label: 'Maintenance Engineer', username: 'maint.engineer', password: 'securepass' },
  manager: { key: 'manager', label: 'Factory Manager', username: 'factory.manager', password: 'securepass' },
};

function getRoleProfile(roleKey) {
  if (roleKey && ROLE_PROFILES[roleKey]) {
    return ROLE_PROFILES[roleKey];
  }
  return ROLE_PROFILES.operator;
}

function normalizeRoleKey(roleLabel) {
  if (!roleLabel) return 'guest';
  const normalized = String(roleLabel).toLowerCase();
  if (normalized.includes('maintenance')) return 'maintenance';
  if (normalized.includes('manager') || normalized.includes('factory')) return 'manager';
  if (normalized.includes('operator')) return 'operator';
  return 'guest';
}

function showLogin() {
  authOverlay.classList.remove('hidden');
  appShell.classList.add('hidden');
  applyRolePermissions('guest');
}

function showDashboard() {
  authOverlay.classList.add('hidden');
  appShell.classList.remove('hidden');
}

function applyRolePermissions(roleKey = 'guest') {
  const normalizedRole = roleKey === 'guest' ? 'guest' : roleKey;
  const roleElements = document.querySelectorAll('[data-role-visibility]');
  roleElements.forEach((element) => {
    const allowedRoles = (element.getAttribute('data-role-visibility') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const shouldShow = allowedRoles.includes(normalizedRole);
    element.style.display = shouldShow ? '' : 'none';
  });

  if (schedulingMatrixBtn) {
    schedulingMatrixBtn.style.display = normalizedRole === 'maintenance' || normalizedRole === 'manager' ? '' : 'none';
  }
  if (maintenanceLogTools) {
    maintenanceLogTools.style.display = normalizedRole === 'maintenance' ? '' : 'none';
  }
  if (managerAccessTools) {
    managerAccessTools.style.display = normalizedRole === 'manager' ? '' : 'none';
  }
}

function setSession(role, username, roleKey = null) {
  const selectedRoleKey = roleKey || normalizeRoleKey(role);
  const profile = ROLE_PROFILES[selectedRoleKey] || ROLE_PROFILES.operator;
  const resolvedRole = role || profile.label;
  state.role = resolvedRole;
  state.roleKey = profile.key;
  state.username = username || profile.username;
  state.token = `sim.${state.username}.${profile.key}`;
  rolePill.textContent = profile.label;
  roleSelect.value = profile.key;
  localStorage.setItem('ams-token', state.token);
  localStorage.setItem('ams-role', profile.key);
  localStorage.setItem('ams-username', state.username);
  localStorage.setItem('ams-role-label', profile.label);
  applyRolePermissions(profile.key);
  showDashboard();
  appendFeed(`${state.username} authenticated as ${profile.label}.`, 'green');
}

function clearSession() {
  state.role = 'Guest';
  state.roleKey = 'guest';
  state.username = 'Guest';
  state.token = null;
  rolePill.textContent = 'Guest';
  usernameInput.value = '';
  passwordInput.value = '';
  roleSelect.value = 'operator';
  localStorage.removeItem('ams-token');
  localStorage.removeItem('ams-role');
  localStorage.removeItem('ams-username');
  localStorage.removeItem('ams-role-label');
  applyRolePermissions('guest');
  showLogin();
  appendFeed('Session closed. Secure login overlay restored.', 'amber');
}

/** Normalize FastAPI MachineTelemetry or legacy mock shape. */
function normalizeMachine(raw) {
  const statusRaw = (raw.status || 'NORMAL').toString().toUpperCase();
  let status = 'stable';
  if (statusRaw === 'CRITICAL' || statusRaw === 'FAULT') status = 'critical';
  else if (statusRaw === 'WARNING' || statusRaw === 'WARN') status = 'warning';

  return {
    machine: raw.machine_id || raw.machine || 'M?',
    temperature: Number(raw.temperature_c ?? raw.temperature ?? 0),
    vibration: Number(raw.vibration_mm_s ?? raw.vibration ?? 0),
    rpm: Number(raw.rpm ?? 0),
    status,
  };
}

function statusClass(status) {
  if (status === 'critical') return 'status-critical';
  if (status === 'warning') return 'status-warn';
  return 'status-ok';
}

function badgeClass(status) {
  if (status === 'critical') return 'critical';
  if (status === 'warning') return 'warn';
  return 'ok';
}

function createMachineCard(item) {
  const card = document.createElement('article');
  card.className = `machine-card ${statusClass(item.status)}`;
  const fault =
    item.status === 'critical'
      ? '<span class="fault-tag">Fault</span>'
      : '';
  card.innerHTML = `
    <div class="machine-top">
      <h4>${item.machine}</h4>
      <div>
        ${fault}
        <span class="badge ${badgeClass(item.status)}">${(item.status || 'stable').toUpperCase()}</span>
      </div>
    </div>
    <div class="metric-grid">
      <div class="metric-cell">
        <span class="metric-label">Temp</span>
        <span class="metric-value temp">${item.temperature.toFixed(1)}°C</span>
      </div>
      <div class="metric-cell">
        <span class="metric-label">Vib</span>
        <span class="metric-value">${item.vibration.toFixed(1)}</span>
      </div>
      <div class="metric-cell">
        <span class="metric-label">RPM</span>
        <span class="metric-value">${item.rpm}</span>
      </div>
    </div>
    <button class="machine-action" data-machine="${item.machine}" type="button">
      Run Agent Analysis
    </button>
  `;
  return card;
}

function renderMachines() {
  machineGrid.innerHTML = '';
  state.telemetry.forEach((item) => {
    machineGrid.appendChild(createMachineCard(item));
  });
}

function appendFeed(message, tone = 'blue') {
  const item = document.createElement('div');
  item.className = 'feed-item';
  item.innerHTML = `<span class="feed-dot ${tone}"></span>${message}`;
  feedList.prepend(item);
}

function setActivityStatus(mode) {
  activityStatus.className = `activity-status ${mode}`;
  activityStatus.textContent =
    mode === 'processing' ? 'Processing' : mode === 'ready' ? 'Ready' : 'Idle';
}

function showProcessingBanner(query) {
  insightCard.innerHTML = `
    <div class="processing-banner" role="status" aria-live="polite">
      <span class="processing-spinner" aria-hidden="true"></span>
      <span>Orchestrating agents for “${escapeHtml(query)}”…</span>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function agentBubbleClass(agentName) {
  const a = (agentName || '').toLowerCase();
  if (a.includes('machine')) return 'machine';
  if (a.includes('maintenance')) return 'maintenance';
  if (a.includes('production')) return 'production';
  if (a.includes('supervisor')) return 'supervisor';
  return 'supervisor';
}

function renderCascade(steps, summary) {
  insightCard.innerHTML = '';
  steps.forEach((step, index) => {
    const bubble = document.createElement('div');
    const agent = step.agent || 'Agent';
    bubble.className = `agent-bubble ${agentBubbleClass(agent)}`;
    bubble.style.animationDelay = `${index * 120}ms`;
    const ts = step.timestamp
      ? new Date(step.timestamp).toLocaleTimeString()
      : new Date().toLocaleTimeString();
    bubble.innerHTML = `
      <span class="agent-tag">[${escapeHtml(agent)}]</span>
      <p>${escapeHtml(step.message)}</p>
      <div class="bubble-meta">${ts}</div>
    `;
    insightCard.appendChild(bubble);
  });

  if (summary) {
    const box = document.createElement('div');
    box.className = 'summary-box';
    box.style.animationDelay = `${steps.length * 120 + 80}ms`;
    box.innerHTML = `
      <h4>Supervisor summary</h4>
      <p>${escapeHtml(summary)}</p>
    `;
    insightCard.appendChild(box);
  }
}

/**
 * Client-side agent parser: regex-scan query intent when backend is offline
 * or response is empty — never leave the operator without a cascade.
 */
function buildClientCascade(query) {
  const q = query.toLowerCase();
  const critical = state.telemetry.find((m) => m.status === 'critical');
  const warning = state.telemetry.find((m) => m.status === 'warning');
  const focus =
    (q.match(/\bm([1-4])\b/) || [])[0]?.toUpperCase() ||
    critical?.machine ||
    warning?.machine ||
    'M4';
  const focusMachine =
    state.telemetry.find((m) => m.machine.toUpperCase() === focus) ||
    critical ||
    state.telemetry[0];

  const wantsMachine = /machine|m[1-4]|alarm|failure|oee|thermal|vibration|rpm|health/.test(q);
  const wantsInventory = /inventory|material|shortage|stock|steel|aluminum|supply/.test(q);
  const wantsMaintenance = /maintenance|repair|spare|work\s*order|service|dispatch/.test(q);
  const wantsProduction = /order|a102|throughput|reroute|production|batch|finish/.test(q);

  const steps = [];
  const ts = new Date().toISOString();

  if (wantsMachine || (!wantsInventory && !wantsMaintenance && !wantsProduction)) {
    const temp = focusMachine?.temperature?.toFixed(1) ?? '98.6';
    const sev = focusMachine?.status === 'critical' ? 'critical' : focusMachine?.status === 'warning' ? 'elevated' : 'nominal';
    steps.push({
      agent: 'MachineAgent',
      message:
        sev === 'critical'
          ? `Detected critical thermal threshold on Machine ${focus} (${temp} C). High failure probability. Pushing alert to Maintenance.`
          : `Machine ${focus} telemetry reviewed (${temp} C). Status ${sev}. Continuing cascade for query context.`,
      timestamp: ts,
    });
  }

  if (wantsMaintenance || wantsMachine || focusMachine?.status === 'critical') {
    steps.push({
      agent: 'MaintenanceAgent',
      message: wantsMaintenance
        ? `Maintenance priority assessed for ${focus}. Spare kit availability verified (mock). Shift B work order staged.`
        : `Verified spare parts availability. Scheduled preventive maintenance window for Shift B on ${focus}.`,
      timestamp: ts,
    });
  }

  if (wantsInventory) {
    steps.push({
      agent: 'ProductionAgent',
      message:
        'Material risk scan: Aluminum days-left below threshold; Steel healthy. Recommend expedite aluminum replenishment before next batch.',
      timestamp: ts,
    });
  } else if (wantsProduction || focusMachine?.status === 'critical') {
    steps.push({
      agent: 'ProductionAgent',
      message: `Shifted ongoing batch queue for Order #A102 away from ${focus} toward a healthy asset to protect throughput.`,
      timestamp: ts,
    });
  }

  if (!steps.some((s) => s.agent === 'ProductionAgent') && wantsMachine) {
    steps.push({
      agent: 'ProductionAgent',
      message: 'Capacity check passed. No forced reroute; monitoring OEE impact of current envelope.',
      timestamp: ts,
    });
  }

  steps.push({
    agent: 'SupervisorAgent',
    message: `Action cascade complete for “${query}”. Production line adjusted where required. Maintenance dispatch logged.`,
    timestamp: ts,
  });

  return {
    steps,
    summary: `Client-side orchestrator resolved “${query}” via intent parse (machine/inventory/maintenance). Backend may be offline — mock cascade applied.`,
  };
}

async function callOrchestrate(query) {
  const response = await fetch(`${API_BASE}/api/v1/agent/orchestrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!data.steps || !data.steps.length) throw new Error('Empty orchestration');
  return data;
}

async function runOrchestration(query) {
  const trimmed = (query || '').trim();
  if (!trimmed || state.orchestrating) return;

  state.lastQuery = trimmed;
  state.orchestrating = true;
  querySubmit.disabled = true;
  runOrchestrationBtn.disabled = true;
  setActivityStatus('processing');
  showProcessingBanner(trimmed);
  appendFeed(`Orchestration started: ${trimmed}`, 'blue');

  // Brief processing beat so the UI always shows computation feedback
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));

  let result;
  try {
    result = await callOrchestrate(trimmed);
  } catch {
    result = buildClientCascade(trimmed);
    appendFeed('Backend offline or unrecognized path — client agent parser engaged.', 'amber');
  }

  renderCascade(result.steps, result.summary);
  setActivityStatus('ready');
  appendFeed('Multi-agent cascade rendered.', 'green');
  state.orchestrating = false;
  querySubmit.disabled = false;
  runOrchestrationBtn.disabled = false;
}

function submitQueryFromInput() {
  const q = queryInput.value.trim() || state.lastQuery;
  if (!q) return;
  queryInput.value = '';
  document.querySelectorAll('.query-chip').forEach((c) => c.classList.remove('active'));
  runOrchestration(q);
}

async function fetchTelemetry() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/telemetry`);
    if (!response.ok) throw new Error('Telemetry request failed');
    const data = await response.json();
    const list = Array.isArray(data) ? data : data.machines || [];
    state.telemetry = list.map(normalizeMachine);
    renderMachines();
  } catch {
    state.telemetry = [
      { machine: 'M1', temperature: 72.4, vibration: 2.1, rpm: 1840, status: 'stable' },
      { machine: 'M2', temperature: 76.3, vibration: 2.3, rpm: 1780, status: 'stable' },
      { machine: 'M3', temperature: 86.1, vibration: 3.9, rpm: 1520, status: 'warning' },
      { machine: 'M4', temperature: 98.6, vibration: 7.9, rpm: 980, status: 'critical' },
    ];
    renderMachines();
    appendFeed('Telemetry fallback engaged; backend telemetry stream unavailable.', 'amber');
  }
}

async function analyzeMachine(machineName) {
  await runOrchestration(`Why is Machine ${machineName} in alarm? Analyze thermal and vibration risk.`);
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const roleKey = roleSelect.value || 'operator';
  const profile = ROLE_PROFILES[roleKey];
  const username = (usernameInput.value.trim() || profile.username).toLowerCase();
  const password = passwordInput.value.trim() || profile.password;

  const roleMatches =
    username === profile.username.toLowerCase() && password === profile.password;

  if (!roleMatches) {
    appendFeed('Authentication rejected; use the matching demo credentials for the selected role.', 'crimson');
    return;
  }

  setSession(profile.label, username, profile.key);
  fetchTelemetry().then(() => runOrchestration(state.lastQuery));
});

roleSelect.addEventListener('change', () => {
  const profile = ROLE_PROFILES[roleSelect.value] || ROLE_PROFILES.operator;
  usernameInput.value = profile.username;
  passwordInput.value = profile.password;
});

demoLoginButton.addEventListener('click', () => {
  roleSelect.value = 'operator';
  usernameInput.value = 'ops.manager';
  passwordInput.value = 'securepass';
  loginForm.requestSubmit();
});

logoutButton.addEventListener('click', () => {
  clearSession();
});

machineGrid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-machine]');
  if (button) analyzeMachine(button.dataset.machine);
});

queryChips.addEventListener('click', (event) => {
  const chip = event.target.closest('.query-chip');
  if (!chip) return;
  document.querySelectorAll('.query-chip').forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
  const q = chip.dataset.query;
  queryInput.value = q;
  runOrchestration(q);
});

querySubmit.addEventListener('click', () => {
  submitQueryFromInput();
});

queryInput.addEventListener('keyup', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitQueryFromInput();
  }
});

runOrchestrationBtn.addEventListener('click', () => {
  const q = queryInput.value.trim() || state.lastQuery;
  runOrchestration(q);
});

function initialize() {
  const savedToken = localStorage.getItem('ams-token');
  const savedRole = localStorage.getItem('ams-role');
  const savedUsername = localStorage.getItem('ams-username');
  const savedRoleLabel = localStorage.getItem('ams-role-label');
  if (savedToken && savedRole) {
    const roleKey = savedRole;
    const profile = ROLE_PROFILES[roleKey] || ROLE_PROFILES.operator;
    setSession(savedRoleLabel || profile.label, savedUsername || profile.username, roleKey);
    fetchTelemetry().then(() => runOrchestration(state.lastQuery));
  } else {
    showLogin();
    appendFeed('Secure session required. Authenticate to access A-I-M-S.', 'blue');
  }
}

initialize();
setInterval(() => {
  if (!appShell.classList.contains('hidden')) fetchTelemetry();
}, 4000);
