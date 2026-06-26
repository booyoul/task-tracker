
function initEventBindings() {
  bindTaskEvents();
  bindFilterEvents();
  bindModalEvents();
  bindTrackerEvents();
  bindSelectionEvents();
}

function bindTaskEvents() {
  document.addEventListener('click', handleTableClick);
  document.addEventListener('change', handleTableChange);
}

function bindFilterEvents() {
  document.getElementById('filter-search')?.addEventListener('input', renderActiveViews);
  document.getElementById('filter-status')?.addEventListener('change', renderActiveViews);
  document.getElementById('filter-priority')?.addEventListener('change', renderActiveViews);
  document.getElementById('filter-assignee')?.addEventListener('change', renderActiveViews);
  document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
}

function bindModalEvents() {
  document.getElementById('btn-add-task')?.addEventListener('click', () => openTaskModal());
  document.getElementById('form-task')?.addEventListener('submit', handleTaskSubmit);
}

function bindTrackerEvents() {
  document.getElementById('btn-tracker-dropdown')?.addEventListener('click', () => {
    document.getElementById('tracker-dropdown-menu')?.classList.toggle('hidden');
  });
}

function bindSelectionEvents() {
  document.getElementById('checkbox-select-all')?.addEventListener('change', toggleSelectAll);
}

window.addEventListener('DOMContentLoaded', initEventBindings);
