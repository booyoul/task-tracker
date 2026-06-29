// view-manager.js
// Centralized view handling for Task Tracker

export const VIEW = {
  TABLE: 'TABLE',
  CALENDAR: 'CALENDAR',
  KANBAN: 'KANBAN',
  ADMIN: 'ADMIN'
};

const VIEW_IDS = {
  [VIEW.TABLE]: '#view-table',
  [VIEW.CALENDAR]: '#view-calendar',
  [VIEW.KANBAN]: '#view-kanban',
  [VIEW.ADMIN]: '#view-admin-approvals'
};

let currentView = VIEW.TABLE;

function hideAllViews() {
  Object.values(VIEW_IDS).forEach(id => {
    const el = document.querySelector(id);
    if (el) el.classList.add('hidden');
  });
}

function showView(view) {
  const id = VIEW_IDS[view];
  if (!id) return;
  const el = document.querySelector(id);
  if (el) el.classList.remove('hidden');
}

export function setCurrentView(view) {
  if (!VIEW_IDS[view]) return;
  currentView = view;
  hideAllViews();
  showView(view);
  // sync legacy global variable
  if (window) window.currentViewMode = view;
}

export function switchView(view) {
  setCurrentView(view);
}

/**
 * Show or hide the admin view button based on user role.
 * Runs on DOMContentLoaded.
 */
export function updateAdminButtonVisibility() {
  const btn = document.getElementById('btn-view-admin');
  if (!btn) return;
  if (window.currentUserRole === 'admin') {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateAdminButtonVisibility();
});
