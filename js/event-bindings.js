
console.info('Smart Task Flow event-bindings.js v20260626-phase12-13-hotfix loaded');

function initEventBindings() {
  if (window.__eventBindingsInitialized) return;
  window.__eventBindingsInitialized = true;

  // Header actions
  document.getElementById('btn-add-task')?.addEventListener('click', () => window.openTaskModal?.());
  document.getElementById('btn-export-csv')?.addEventListener('click', exportToCSV);
  document.getElementById('btn-export-excel')?.addEventListener('click', exportToExcel);
  document.getElementById('btn-export-powerbi')?.addEventListener('click', exportPowerBIJSON);
  document.getElementById('btn-export-json')?.addEventListener('click', exportToJSON);
  document.getElementById('btn-undo')?.addEventListener('click', undoDelete);
  document.getElementById('btn-batch-delete')?.addEventListener('click', confirmBatchDelete);
  document.getElementById('btn-import-trigger')?.addEventListener('click', () => document.getElementById('input-import-json')?.click());
  document.getElementById('input-import-json')?.addEventListener('change', importFromJSON);

  // Tracker dropdown
  document.getElementById('btn-tracker-dropdown')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('tracker-dropdown-menu')?.classList.toggle('hidden');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#tracker-dropdown-container')) document.getElementById('tracker-dropdown-menu')?.classList.add('hidden');
  });
  document.getElementById('btn-create-tracker-open')?.addEventListener('click', () => window.openTrackerModal?.());
  document.getElementById('btn-edit-tracker-open')?.addEventListener('click', () => window.openTrackerModal?.(currentTrackerId));

  // Filters
  document.querySelectorAll('.filter-card').forEach(card => card.addEventListener('click', () => {
    const status = card.getAttribute('data-status');
    const el = document.getElementById('filter-status');
    if (el) el.value = status;
    renderActiveViews();
  }));
  ['filter-search','filter-start-date','filter-end-date'].forEach(id => document.getElementById(id)?.addEventListener('input', renderActiveViews));
  ['filter-status','filter-priority','filter-assignee'].forEach(id => document.getElementById(id)?.addEventListener('change', renderActiveViews));
  document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);

  // List/mobile/kanban task events
  document.getElementById('checkbox-select-all')?.addEventListener('change', toggleSelectAll);
  document.getElementById('task-table-body')?.addEventListener('click', handleTableClick);
  document.getElementById('task-table-body')?.addEventListener('change', handleTableChange);
  document.getElementById('task-card-container')?.addEventListener('click', handleTableClick);
  document.getElementById('task-card-container')?.addEventListener('change', handleTableChange);
  document.getElementById('kanban-container')?.addEventListener('click', handleTableClick);
  document.getElementById('kanban-container')?.addEventListener('change', handleTableChange);
  document.getElementById('task-table-body')?.addEventListener('focusout', e => {
    const el = e.target.closest('.inline-edit-title');
    if (el) updateTaskTitleInline(el.dataset.id, el.textContent);
  });
  document.getElementById('task-table-body')?.addEventListener('keydown', handleInlineEditKeydown);

  // View buttons
  document.getElementById('btn-view-table')?.addEventListener('click', () => switchView('TABLE'));
  document.getElementById('btn-view-calendar')?.addEventListener('click', () => switchView('CALENDAR'));
  document.getElementById('btn-view-kanban')?.addEventListener('click', () => switchView('KANBAN'));
  document.getElementById('btn-cal-mode-day')?.addEventListener('click', () => setCalMode('DAY'));
  document.getElementById('btn-cal-mode-month')?.addEventListener('click', () => setCalMode('MONTH'));
  document.getElementById('btn-cal-mode-summary')?.addEventListener('click', () => setCalMode('SUMMARY'));
  document.getElementById('btn-prev-month')?.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() - 1); renderActiveViews(); });
  document.getElementById('btn-today-month')?.addEventListener('click', () => { currentCalDate = new Date(); renderActiveViews(); });
  document.getElementById('btn-next-month')?.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() + 1); renderActiveViews(); });

  // Modal/confirm
  document.getElementById('btn-close-task-modal')?.addEventListener('click', () => window.closeModal?.());
  document.getElementById('btn-cancel-task')?.addEventListener('click', () => window.closeModal?.());
  document.getElementById('form-task')?.addEventListener('submit', e => window.handleTaskSubmit?.(e));
  document.getElementById('btn-add-subtask')?.addEventListener('click', () => window.addSubTaskToModalList?.());
  document.getElementById('btn-close-tracker-modal')?.addEventListener('click', () => window.closeTrackerModal?.());
  document.getElementById('btn-cancel-tracker')?.addEventListener('click', () => window.closeTrackerModal?.());
  document.getElementById('form-tracker')?.addEventListener('submit', e => window.handleTrackerSubmit?.(e));
  document.getElementById('btn-delete-tracker')?.addEventListener('click', handleDeleteTrackerClick);
  document.getElementById('btn-cancel-confirm')?.addEventListener('click', () => window.closeConfirmModal?.());
  document.getElementById('btn-action-confirm')?.addEventListener('click', () => { if (confirmActionCb) confirmActionCb(); });

  // Dynamic toolbar + mobile quick status
  document.addEventListener('click', e => {
    const statusBtn = e.target.closest('.mobile-status-btn');
    if (statusBtn) { e.preventDefault(); e.stopPropagation(); updateTaskStatus(statusBtn.dataset.id, statusBtn.dataset.status); return; }
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.id === 'btn-focus-risk') toggleFocusMode('riskOnly');
    else if (btn.id === 'btn-focus-high') toggleFocusMode('highOnly');
    else if (btn.id === 'btn-open-assignee-modal') openAssigneeModal();
    else if (btn.id === 'btn-clear-assignee-filter') clearAssigneeMultiSelect();
    else if (btn.id === 'bulk-change-status') bulkChangeStatus();
    else if (btn.id === 'bulk-change-assignee') bulkChangeAssignee();
    else if (btn.id === 'bulk-change-due') bulkChangeDueDate();
    else if (btn.id === 'bulk-clear-selection') clearSelection();
  });

  window.addEventListener('resize', () => setViewVisibility(currentViewMode === 'CALENDAR' ? 'CALENDAR' : currentViewMode === 'KANBAN' ? 'KANBAN' : 'TABLE'));
  window.addEventListener('beforeunload', () => {
    if (typeof unsubscribeTasks === 'function') unsubscribeTasks();
    if (typeof unsubscribeTrackers === 'function') unsubscribeTrackers();
  });
}
window.initEventBindings = initEventBindings;
