// ============================================================================
// CSU-ISS FINTRACK — POSTGRESQL API-CONNECTED APPLICATION LOGIC
// ============================================================================

const API_BASE = '/api';

const QUICK_FILL_USERS = [
  { username: 'president', password: 'password123', role: 'President' },
  { username: 'treasurer', password: 'password123', role: 'Treasurer' },
  { username: 'vp', password: 'password123', role: 'Vice President' },
  { username: 'auditor', password: 'password123', role: 'Auditor' },
  { username: 'adviser', password: 'password123', role: 'Adviser' }
];

const INCOME_CATEGORIES = [
  'Membership Fees',
  'Sponsorship & Grants',
  'Merchandise Sales',
  'Event Registration',
  'Donations',
  'Other Income'
];

const EXPENSE_CATEGORIES = [
  'Event Operations',
  'Office & Printing Supplies',
  'Refreshments & Catering',
  'Equipment & Tech',
  'Transportation',
  'Miscellaneous'
];

const ROLE_PERMISSIONS = {
  President: { canAdd: true, canEdit: true, canSoftDelete: true, canPermanentDelete: true },
  Treasurer: { canAdd: true, canEdit: true, canSoftDelete: true, canPermanentDelete: false },
  'Vice President': { canAdd: true, canEdit: true, canSoftDelete: true, canPermanentDelete: false },
  Auditor: { canAdd: false, canEdit: false, canSoftDelete: false, canPermanentDelete: false },
  Adviser: { canAdd: false, canEdit: false, canSoftDelete: false, canPermanentDelete: false }
};

// Application State
let transactions = [];
let auditLogs = [];
let authToken = sessionStorage.getItem('fintrack_token') || null;
let currentUser = JSON.parse(sessionStorage.getItem('fintrack_session_user')) || null;
let isLocked = false;
let lockAttempts = 0;
let currentReportMode = 'treasurer';
let pendingDeleteId = null;
let inactivityTimer = null;

// ============================================================================
// API HELPER & SESSION STORAGE
// ============================================================================
function saveSession() {
  if (currentUser && authToken) {
    sessionStorage.setItem('fintrack_token', authToken);
    sessionStorage.setItem('fintrack_session_user', JSON.stringify(currentUser));
  } else {
    sessionStorage.removeItem('fintrack_token');
    sessionStorage.removeItem('fintrack_session_user');
  }
}

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && endpoint !== '/login' && endpoint !== '/unlock') {
      currentUser = null;
      authToken = null;
      isLocked = false;
      saveSession();
      updateAppView();
    }
    throw new Error(data.error || 'Server request failed.');
  }

  return data;
}

async function syncDataFromPostgres() {
  const [txData, logData] = await Promise.all([
    apiRequest('/transactions'),
    apiRequest('/audit-logs')
  ]);
  transactions = txData;
  auditLogs = logData;
}

function formatPHP(amount) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ============================================================================
// INITIALIZATION & EVENT LISTENERS
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  renderDemoButtons();
  populateFilterCategories();
  setupEventListeners();

  if (currentUser && authToken) {
    try {
      await syncDataFromPostgres();
    } catch (err) {
      console.error(err);
    }
  }
  updateAppView();
});

function renderDemoButtons() {
  const container = document.getElementById('quick-fill-buttons');
  container.innerHTML = '';
  QUICK_FILL_USERS.forEach(u => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'demo-pill';
    btn.textContent = u.role;
    btn.onclick = () => {
      document.getElementById('login-identifier').value = u.username;
      document.getElementById('login-password').value = u.password;
      document.getElementById('login-error').classList.add('hidden');
    };
    container.appendChild(btn);
  });
}

function populateFilterCategories() {
  const select = document.getElementById('filter-category');
  const all = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])];
  all.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function updateAppView() {
  const loginScreen = document.getElementById('login-screen');
  const lockScreen = document.getElementById('lock-screen');
  const workspace = document.getElementById('app-workspace');

  if (!currentUser || !authToken) {
    loginScreen.classList.remove('hidden');
    lockScreen.classList.add('hidden');
    workspace.classList.add('hidden');
    clearTimeout(inactivityTimer);
    return;
  }

  loginScreen.classList.add('hidden');

  if (isLocked) {
    lockScreen.classList.remove('hidden');
    workspace.classList.add('hidden');
    document.getElementById('lock-user-name').textContent = currentUser.name;
    document.getElementById('lock-user-role').textContent = currentUser.role;
    return;
  }

  lockScreen.classList.add('hidden');
  workspace.classList.remove('hidden');

  document.getElementById('sidebar-user-name').textContent = currentUser.name;
  document.getElementById('sidebar-user-role').textContent = currentUser.role;

  const perms = ROLE_PERMISSIONS[currentUser.role] || ROLE_PERMISSIONS.Adviser;
  document.querySelectorAll('.officer-only').forEach(el => {
    el.classList.toggle('hidden', !perms.canAdd);
  });
  document.getElementById('readonly-badge').classList.toggle('hidden', perms.canAdd);

  resetInactivityTimer();
  switchTab('dashboard');
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  if (!currentUser || isLocked) return;
  inactivityTimer = setTimeout(() => {
    isLocked = true;
    updateAppView();
    showToast('Session locked due to inactivity.', 'warning');
  }, 5 * 60 * 1000);
}

async function switchTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const activeNav = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
  if (activeNav) activeNav.classList.add('active');

  const titles = {
    dashboard: 'Financial Overview Dashboard',
    'add-income': 'Record Income Transaction',
    'add-expense': 'Record Expense Transaction',
    transactions: 'Digital Financial Records & Search',
    reports: 'Official Financial & Liquidation Reports',
    audit: 'System Audit Trail',
    archive: 'Soft-Deleted & Retention Archive',
    account: 'User Account Management'
  };
  document.getElementById('page-title').textContent = titles[tabName] || 'CSU-ISS FinTrack';

  if (['dashboard', 'transactions', 'reports', 'audit', 'archive'].includes(tabName)) {
    try {
      await syncDataFromPostgres();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  if (tabName === 'dashboard') {
    document.getElementById('tab-dashboard').classList.remove('hidden');
    renderDashboard();
  } else if (tabName === 'add-income' || tabName === 'add-expense') {
    document.getElementById('tab-transaction-form').classList.remove('hidden');
    setTransactionFormType(tabName === 'add-income' ? 'Income' : 'Expense');
  } else if (tabName === 'transactions') {
    document.getElementById('tab-transactions').classList.remove('hidden');
    renderTransactionsTable();
  } else if (tabName === 'reports') {
    document.getElementById('tab-reports').classList.remove('hidden');
    renderReport();
  } else if (tabName === 'audit') {
    document.getElementById('tab-audit').classList.remove('hidden');
    renderAuditLogs();
  } else if (tabName === 'archive') {
    document.getElementById('tab-archive').classList.remove('hidden');
    renderArchiveTable();
  } else if (tabName === 'account') {
    document.getElementById('tab-account').classList.remove('hidden');
    loadAccountForm();
  }
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================
function renderDashboard() {
  const active = transactions.filter(t => !t.isDeleted);
  const incomes = active.filter(t => t.type === 'Income');
  const expenses = active.filter(t => t.type === 'Expense');

  const totalIncome = incomes.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  document.getElementById('kpi-income').textContent = formatPHP(totalIncome);
  document.getElementById('kpi-income-count').textContent = `From ${incomes.length} recorded inflows`;
  document.getElementById('kpi-expense').textContent = formatPHP(totalExpense);
  document.getElementById('kpi-expense-count').textContent = `From ${expenses.length} recorded outflows`;
  document.getElementById('kpi-balance').textContent = formatPHP(balance);

  renderBreakdown('income-breakdown-list', incomes, totalIncome, 'progress-fill-green');
  renderBreakdown('expense-breakdown-list', expenses, totalExpense, 'progress-fill-red');

  const recentContainer = document.getElementById('recent-transactions-list');
  recentContainer.innerHTML = active.slice(0, 5).map(tx => `
    <div class="recent-item">
      <div>
        <p>${tx.description}</p>
        <small>${tx.date} • ${tx.category}</small>
      </div>
      <strong class="${tx.type === 'Income' ? 'text-green' : 'text-red'}">
        ${tx.type === 'Income' ? '+' : '-'}${formatPHP(tx.amount)}
      </strong>
    </div>
  `).join('') || '<p class="subtitle">No active transactions found.</p>';
}

function renderBreakdown(containerId, items, total, barClass) {
  const container = document.getElementById(containerId);
  if (!items.length) {
    container.innerHTML = '<small class="kpi-sub">No records yet.</small>';
    return;
  }
  const map = {};
  items.forEach(t => map[t.category] = (map[t.category] || 0) + Number(t.amount));
  container.innerHTML = Object.entries(map).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
    const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
    return `
      <div class="progress-item">
        <div class="progress-label"><span>${cat}</span><span>${formatPHP(amt)} (${pct}%)</span></div>
        <div class="progress-track"><div class="${barClass}" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('');
}

function setTransactionFormType(type) {
  document.getElementById('tx-type').value = type;
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-description').value = '';
  document.getElementById('tx-form-error').classList.add('hidden');

  const switchInc = document.getElementById('switch-income');
  const switchExp = document.getElementById('switch-expense');
  const submitBtn = document.getElementById('tx-submit-btn');

  if (type === 'Income') {
    switchInc.className = 'switch-btn active-income';
    switchExp.className = 'switch-btn';
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Save Income Record';
  } else {
    switchInc.className = 'switch-btn';
    switchExp.className = 'switch-btn active-expense';
    submitBtn.className = 'btn btn-danger';
    submitBtn.textContent = 'Save Expense Record';
  }

  const cats = type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  document.getElementById('tx-category').innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderTransactionsTable() {
  const search = document.getElementById('filter-search').value.toLowerCase();
  const typeVal = document.getElementById('filter-type').value;
  const catVal = document.getElementById('filter-category').value;
  const fromVal = document.getElementById('filter-from').value;
  const toVal = document.getElementById('filter-to').value;

  const perms = ROLE_PERMISSIONS[currentUser.role] || ROLE_PERMISSIONS.Adviser;
  document.querySelectorAll('.officer-col').forEach(el => el.classList.toggle('hidden', !perms.canEdit));

  const filtered = transactions.filter(tx => {
    if (tx.isDeleted) return false;
    const matchSearch = tx.id.toLowerCase().includes(search) || tx.description.toLowerCase().includes(search) || tx.recordedBy.toLowerCase().includes(search);
    const matchType = typeVal === 'All' || tx.type === typeVal;
    const matchCat = catVal === 'All' || tx.category === catVal;
    const matchFrom = !fromVal || tx.date >= fromVal;
    const matchTo = !toVal || tx.date <= toVal;
    return matchSearch && matchType && matchCat && matchFrom && matchTo;
  });

  const tbody = document.getElementById('transactions-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No matching financial transaction records found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(tx => `
    <tr>
      <td><code>${tx.id}</code></td>
      <td>${tx.date}</td>
      <td><span class="pill ${tx.type === 'Income' ? 'pill-income' : 'pill-expense'}">${tx.type}</span></td>
      <td>${tx.category}</td>
      <td><strong>${tx.description}</strong><br><small class="kpi-sub">By: ${tx.recordedBy}</small></td>
      <td class="text-right ${tx.type === 'Income' ? 'text-green' : 'text-red'}">
        <strong>${tx.type === 'Income' ? '+' : '-'}${formatPHP(tx.amount)}</strong>
      </td>
      ${perms.canEdit ? `
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="openEditModal('${tx.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${tx.id}')">Delete</button>
        </td>
      ` : ''}
    </tr>
  `).join('');
}

function renderReport() {
  const active = transactions.filter(t => !t.isDeleted);
  const totalIncome = active.filter(t => t.type === 'Income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = active.filter(t => t.type === 'Expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpenses;

  document.getElementById('report-generated-date').textContent = `Generated via CSU-ISS FinTrack • Date: ${new Date().toLocaleDateString()}`;
  document.getElementById('sig-preparer').textContent = currentUser.name;
  document.getElementById('sig-preparer-role').textContent = currentUser.position;

  const records = currentReportMode === 'liquidation' ? active.filter(t => t.type === 'Expense') : active;
  document.getElementById('report-subtitle').textContent =
    currentReportMode === 'treasurer'
      ? "OFFICIAL TREASURER'S FINANCIAL SUMMARY REPORT"
      : "OFFICIAL EXPENSE LIQUIDATION & AUDIT STATEMENT";

  const summaryBox = document.getElementById('report-summary-box');
  if (currentReportMode === 'treasurer') {
    summaryBox.innerHTML = `
      <div><small>Total Cash Inflows</small><h4 class="text-green">${formatPHP(totalIncome)}</h4></div>
      <div><small>Total Disbursements</small><h4 class="text-red">${formatPHP(totalExpenses)}</h4></div>
      <div><small>Ending Cash Balance</small><h4>${formatPHP(balance)}</h4></div>
    `;
  } else {
    summaryBox.innerHTML = `
      <div><small>Report Scope</small><h4>Expense Liquidation</h4></div>
      <div><small>Expense Items</small><h4>${records.length} Receipts</h4></div>
      <div><small>Total Liquidated</small><h4 class="text-red">${formatPHP(totalExpenses)}</h4></div>
    `;
  }

  document.getElementById('report-tbody').innerHTML = records.map(tx => `
    <tr>
      <td><code>${tx.id}</code></td>
      <td>${tx.date}</td>
      <td>${tx.type}</td>
      <td>${tx.category}</td>
      <td>${tx.description}</td>
      <td class="text-right"><strong>${formatPHP(tx.amount)}</strong></td>
    </tr>
  `).join('');
}

function renderAuditLogs() {
  document.getElementById('audit-count-badge').textContent = `${auditLogs.length} Entries`;
  document.getElementById('audit-log-list').innerHTML = auditLogs.map(log => `
    <div class="audit-item">
      <div>
        <span class="pill ${log.action === 'CREATE' ? 'pill-income' : 'pill-expense'}">${log.action}</span>
        <code>${log.transactionId || ''}</code> • <small>${log.user}</small>
        <p style="font-size:0.85rem; margin-top:4px;">${log.details}</p>
      </div>
      <small style="font-family:monospace; color:#64748b;">${log.timestamp}</small>
    </div>
  `).join('');
}

function renderArchiveTable() {
  const deleted = transactions.filter(t => t.isDeleted);
  const isPresident = currentUser.role === 'President';
  const perms = ROLE_PERMISSIONS[currentUser.role] || ROLE_PERMISSIONS.Adviser;
  const tbody = document.getElementById('archive-tbody');

  if (!deleted.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No soft-deleted records in the retention archive.</td></tr>';
    return;
  }

  tbody.innerHTML = deleted.map(tx => `
    <tr>
      <td><code>${tx.id}</code></td>
      <td>${tx.date}</td>
      <td>${tx.description}</td>
      <td class="text-right"><strong>${formatPHP(tx.amount)}</strong></td>
      <td>
        <span class="pill ${tx.retentionExpired ? 'pill-expired' : 'pill-hold'}">
          ${tx.retentionExpired ? 'Expired (Eligible for Purge)' : 'Active Retention Hold'}
        </span>
      </td>
      <td class="text-right">
        ${perms.canEdit ? `<button class="btn btn-outline btn-sm" onclick="restoreTx('${tx.id}')">Restore</button>` : ''}
        ${isPresident && tx.retentionExpired ? `<button class="btn btn-danger btn-sm" onclick="permanentDeleteTx('${tx.id}')">Permanent Delete</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function loadAccountForm() {
  document.getElementById('acc-id').value = currentUser.id;
  document.getElementById('acc-role').value = currentUser.role;
  document.getElementById('acc-name').value = currentUser.name;
  document.getElementById('acc-email').value = currentUser.email;
  document.getElementById('acc-password').value = '';
  document.getElementById('acc-password').placeholder = 'Enter new or current password';
}

// ============================================================================
// ACTIONS & MODALS (POSTGRESQL API CALLS)
// ============================================================================
window.openEditModal = function(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  document.getElementById('edit-modal-title').textContent = `Edit Transaction (${tx.id})`;
  document.getElementById('edit-id').value = tx.id;
  document.getElementById('edit-date').value = tx.date;
  document.getElementById('edit-amount').value = tx.amount;
  document.getElementById('edit-description').value = tx.description;

  const cats = tx.type === 'Income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  document.getElementById('edit-category').innerHTML = cats.map(c => `<option value="${c}" ${c === tx.category ? 'selected' : ''}>${c}</option>`).join('');
  document.getElementById('edit-modal').classList.remove('hidden');
};

window.openDeleteModal = function(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;
  pendingDeleteId = id;
  document.getElementById('delete-modal-text').innerHTML = `Are you sure you want to delete <strong>${tx.id}</strong> (${tx.description} — <strong>${formatPHP(tx.amount)}</strong>)?`;
  document.getElementById('delete-modal').classList.remove('hidden');
};

window.restoreTx = async function(id) {
  try {
    await apiRequest(`/transactions/${id}/restore`, { method: 'PATCH' });
    await syncDataFromPostgres();
    showToast(`Transaction ${id} restored.`);
    renderArchiveTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.permanentDeleteTx = async function(id) {
  if (currentUser.role !== 'President') {
    showToast('Only the President can permanently delete expired records.', 'error');
    return;
  }
  try {
    await apiRequest(`/transactions/${id}/permanent`, { method: 'DELETE' });
    await syncDataFromPostgres();
    showToast(`Expired record ${id} permanently purged.`);
    renderArchiveTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function setupEventListeners() {
  // Login
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errBox = document.getElementById('login-error');
    errBox.classList.add('hidden');

    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const data = await apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });

      authToken = data.token;
      currentUser = data.user;
      isLocked = false;
      lockAttempts = 0;
      saveSession();

      await syncDataFromPostgres();
      showToast(`Welcome back, ${currentUser.name} (${currentUser.role})!`);
      updateAppView();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    }
  });

  document.getElementById('toggle-login-pw').addEventListener('click', () => {
    const pwField = document.getElementById('login-password');
    const btn = document.getElementById('toggle-login-pw');
    pwField.type = pwField.type === 'password' ? 'text' : 'password';
    btn.textContent = pwField.type === 'password' ? 'Show' : 'Hide';
  });

  // Lock & Unlock
  const triggerLock = () => {
    isLocked = true;
    updateAppView();
  };
  document.getElementById('btn-lock-screen').addEventListener('click', triggerLock);
  document.getElementById('topbar-lock-btn').addEventListener('click', triggerLock);

  document.getElementById('unlock-form').addEventListener('submit', async e => {
    e.preventDefault();
    const password = document.getElementById('unlock-password').value;
    try {
      await apiRequest('/unlock', {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      isLocked = false;
      lockAttempts = 0;
      document.getElementById('unlock-password').value = '';
      document.getElementById('lock-error').classList.add('hidden');
      updateAppView();
      showToast('Session unlocked.');
    } catch (err) {
      lockAttempts++;
      if (lockAttempts >= 3) {
        currentUser = null;
        authToken = null;
        isLocked = false;
        saveSession();
        updateAppView();
        showToast('Maximum unlock attempts exceeded. Session terminated.', 'error');
      } else {
        const errBox = document.getElementById('lock-error');
        errBox.textContent = `Incorrect password. Attempt ${lockAttempts} of 3 before forced logout.`;
        errBox.classList.remove('hidden');
      }
    }
  });

  // Logout
  const logout = () => {
    currentUser = null;
    authToken = null;
    isLocked = false;
    saveSession();
    updateAppView();
    showToast('Logged out securely.');
  };
  document.getElementById('btn-logout').addEventListener('click', logout);
  document.getElementById('lock-logout-btn').addEventListener('click', logout);

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.goto));
  });

  // Transaction Form
  document.getElementById('switch-income').addEventListener('click', () => setTransactionFormType('Income'));
  document.getElementById('switch-expense').addEventListener('click', () => setTransactionFormType('Expense'));

  document.getElementById('transaction-form').addEventListener('submit', async e => {
    e.preventDefault();
    const type = document.getElementById('tx-type').value;
    const date = document.getElementById('tx-date').value;
    const category = document.getElementById('tx-category').value;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const description = document.getElementById('tx-description').value.trim();

    if (!date || !description || isNaN(amount) || amount <= 0) {
      const err = document.getElementById('tx-form-error');
      err.textContent = 'Please complete all fields with a valid positive PHP amount.';
      err.classList.remove('hidden');
      return;
    }

    try {
      const created = await apiRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify({ date, type, category, amount, description })
      });
      showToast(`${type} transaction (${created.id}) saved to PostgreSQL!`);
      switchTab('transactions');
    } catch (err) {
      const errBox = document.getElementById('tx-form-error');
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    }
  });

  // Search & Filters
  ['filter-search', 'filter-type', 'filter-category', 'filter-from', 'filter-to'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderTransactionsTable);
  });
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-type').value = 'All';
    document.getElementById('filter-category').value = 'All';
    document.getElementById('filter-from').value = '';
    document.getElementById('filter-to').value = '';
    renderTransactionsTable();
  });

  // Edit & Delete Modals
  document.getElementById('close-edit-modal').addEventListener('click', () => document.getElementById('edit-modal').classList.add('hidden'));
  document.getElementById('cancel-edit-modal').addEventListener('click', () => document.getElementById('edit-modal').classList.add('hidden'));
  document.getElementById('edit-tx-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const payload = {
      date: document.getElementById('edit-date').value,
      category: document.getElementById('edit-category').value,
      amount: parseFloat(document.getElementById('edit-amount').value),
      description: document.getElementById('edit-description').value.trim()
    };

    try {
      await apiRequest(`/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      await syncDataFromPostgres();
      document.getElementById('edit-modal').classList.add('hidden');
      showToast(`Transaction ${id} updated.`);
      renderTransactionsTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('cancel-delete-modal').addEventListener('click', () => document.getElementById('delete-modal').classList.add('hidden'));
  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    try {
      await apiRequest(`/transactions/${pendingDeleteId}/soft-delete`, { method: 'PATCH' });
      await syncDataFromPostgres();
      showToast(`Transaction ${pendingDeleteId} moved to Retention Archive.`, 'warning');
      document.getElementById('delete-modal').classList.add('hidden');
      renderTransactionsTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Reports Switcher
  document.getElementById('btn-report-treasurer').addEventListener('click', () => {
    currentReportMode = 'treasurer';
    document.getElementById('btn-report-treasurer').className = 'btn btn-primary';
    document.getElementById('btn-report-liquidation').className = 'btn btn-outline';
    renderReport();
  });
  document.getElementById('btn-report-liquidation').addEventListener('click', () => {
    currentReportMode = 'liquidation';
    document.getElementById('btn-report-liquidation').className = 'btn btn-primary';
    document.getElementById('btn-report-treasurer').className = 'btn btn-outline';
    renderReport();
  });

  // Account Form
  document.getElementById('account-form').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('acc-name').value.trim(),
      email: document.getElementById('acc-email').value.trim(),
      password: document.getElementById('acc-password').value
    };

    try {
      const data = await apiRequest(`/users/${currentUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      currentUser = data.user;
      saveSession();
      updateAppView();
      showToast('Account profile updated in PostgreSQL.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Activity listeners for screen auto-lock
  ['mousemove', 'keydown', 'click'].forEach(evt => {
    window.addEventListener(evt, resetInactivityTimer);
  });
}