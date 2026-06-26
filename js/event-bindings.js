console.info('Smart Task Flow event-bindings.js v20260626-phase8-safe loaded');

function initEventBindings() {
  if (window.__eventBindingsInitialized) return;
  window.__eventBindingsInitialized = true;
  bindTaskEvents();
  bindFilterEvents();
  bindModalEvents();
  bindTrackerEvents();
  bindSelectionEvents();
}

function bindTaskEvents() {
  const table = document.getElementById('task-table-body');
  const cards = document.getElementById('task-card-container');
  table?.addEventListener('click', handleTableClick);
  table?.addEventListener('change', handleTableChange);
  cards?.addEventListener('click', handleTableClick);
  cards?.addEventListener('change', handleTableChange);
}

function bindFilterEvents() {
  ['filter-search', 'filter-start-date', 'filter-end-date'].forEach(id => document.getElementById(id)?.addEventListener('input', renderActiveViews));
  ['filter-status', 'filter-priority', 'filter-assignee'].forEach(id => document.getElementById(id)?.addEventListener('change', renderActiveViews));
  document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
}

function bindModalEvents() {
  document.getElementById('btn-add-task')?.addEventListener('click', () => window.openTaskModal?.());
  document.getElementById('btn-close-task-modal')?.addEventListener('click', () => window.closeModal?.());
  document.getElementById('btn-cancel-task')?.addEventListener('click', () => window.closeModal?.());
  document.getElementById('form-task')?.addEventListener('submit', e => window.handleTaskSubmit?.(e));
  document.getElementById('btn-add-subtask')?.addEventListener('click', () => window.addSubTaskToModalList?.());
}

function bindTrackerEvents() {
  document.getElementById('btn-tracker-dropdown')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('tracker-dropdown-menu')?.classList.toggle('hidden');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#tracker-dropdown-container')) document.getElementById('tracker-dropdown-menu')?.classList.add('hidden');
  });
  document.getElementById('btn-create-tracker-open')?.addEventListener('click', () => window.openTrackerModal?.());
  document.getElementById('btn-edit-tracker-open')?.addEventListener('click', () => window.openTrackerModal?.(currentTrackerId));
}

function bindSelectionEvents() {
  document.getElementById('checkbox-select-all')?.addEventListener('change', toggleSelectAll);
}

window.initEventBindings = initEventBindings;
