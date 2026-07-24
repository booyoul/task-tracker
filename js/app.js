
console.info('Smart Task Flow app.js v20260724-v4 loaded');
// --- UX optimization globals: must be declared before helper functions ---
var focusState = window.focusState || { riskOnly: false, mineOnly: false, highOnly: false };
window.focusState = focusState;
var UX_STORAGE_KEYS = window.UX_STORAGE_KEYS || { myAssignee: 'flow_my_assignee_name' };
window.UX_STORAGE_KEYS = UX_STORAGE_KEYS;
var isDashboardCollapsed = true;
window.isDashboardCollapsed = isDashboardCollapsed;
var isRiskPanelCollapsed = true;
window.isRiskPanelCollapsed = isRiskPanelCollapsed;
var selectedAssigneeFilters = window.selectedAssigneeFilters || new Set();
window.selectedAssigneeFilters = selectedAssigneeFilters;
var calendarUxState = window.calendarUxState || { subtasksExpanded: true, criticalOnly: false, colorByIndustry: false, groupByAssignee: false, duplicateMultiAssignee: true };
window.calendarUxState = calendarUxState;
function safeLocalStorageGet(key, fallback = '') {
  try { return window.localStorage ? (localStorage.getItem(key) || fallback) : fallback; }
  catch (e) { console.warn('localStorage read blocked', e); return fallback; }
}
function safeLocalStorageSet(key, value) {
  try { if (window.localStorage) localStorage.setItem(key, value); return true; }
  catch (e) { console.warn('localStorage write blocked', e); return false; }
}

const CALENDAR_UX_STORAGE_KEY = 'flow_calendar_ux_state';
function loadCalendarUxState() {
  try {
    const raw = safeLocalStorageGet(CALENDAR_UX_STORAGE_KEY, '');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    calendarUxState = { subtasksExpanded: true, criticalOnly: false, colorByIndustry: false, groupByAssignee: false, duplicateMultiAssignee: true, ...calendarUxState, ...parsed };
    window.calendarUxState = calendarUxState;
  } catch (e) { console.warn('calendar UX state load failed', e); }
}
function saveCalendarUxState() {
  try { safeLocalStorageSet(CALENDAR_UX_STORAGE_KEY, JSON.stringify(calendarUxState)); }
  catch (e) { console.warn('calendar UX state save failed', e); }
}
function getCalendarUxButtonClass(active) {
  return active
    ? 'rounded-xl border border-indigo-200 bg-indigo-600 px-2.5 py-1.5 text-[11px] font-black text-white shadow-sm transition hover:bg-indigo-700'
    : 'rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition hover:bg-slate-50';
}
function updateCalendarUxButtons() {
  const subBtn = document.getElementById('btn-cal-ux-subtasks');
  const riskBtn = document.getElementById('btn-cal-ux-risk');
  const industryBtn = document.getElementById('btn-cal-ux-industry');
  const assigneeBtn = document.getElementById('btn-cal-ux-assignee');
  const duplicateBtn = document.getElementById('btn-cal-ux-duplicate-assignee');
  if (subBtn) {
    subBtn.textContent = calendarUxState.subtasksExpanded ? '하위 펼침' : '하위 접힘';
    subBtn.className = getCalendarUxButtonClass(calendarUxState.subtasksExpanded);
  }
  if (riskBtn) {
    riskBtn.textContent = calendarUxState.criticalOnly ? 'Risk 강조 ON' : 'Risk 강조';
    riskBtn.className = getCalendarUxButtonClass(calendarUxState.criticalOnly);
  }
  if (industryBtn) {
    industryBtn.textContent = calendarUxState.colorByIndustry ? '산업 색상 ON' : '산업 색상';
    industryBtn.className = getCalendarUxButtonClass(calendarUxState.colorByIndustry);
  }
  if (assigneeBtn) {
    assigneeBtn.textContent = calendarUxState.groupByAssignee ? '담당자 보기 ON' : '담당자 보기';
    assigneeBtn.className = getCalendarUxButtonClass(calendarUxState.groupByAssignee);
  }
  if (duplicateBtn) {
    duplicateBtn.textContent = calendarUxState.duplicateMultiAssignee ? '공동 개별표시 ON' : '공동 개별표시';
    duplicateBtn.className = getCalendarUxButtonClass(calendarUxState.duplicateMultiAssignee);
    if (calendarUxState.groupByAssignee) {
      duplicateBtn.classList.remove('hidden');
    } else {
      duplicateBtn.classList.add('hidden');
    }
  }
}
function ensureCalendarUxControls() {
  loadCalendarUxState();
  if (document.getElementById('calendar-ux-controls')) { updateCalendarUxButtons(); return; }
  const anchor = document.getElementById('btn-cal-mode-summary')?.parentElement || document.getElementById('calendar-month-year');
  if (!anchor) return;
  const controls = document.createElement('div');
  controls.id = 'calendar-ux-controls';
  controls.className = 'inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-100 bg-white px-2 py-1 shadow-sm';
  controls.innerHTML = `
    <button type="button" id="btn-cal-ux-subtasks"></button>
    <button type="button" id="btn-cal-ux-risk"></button>
    <button type="button" id="btn-cal-ux-industry"></button>
    <button type="button" id="btn-cal-ux-assignee"></button>
    <button type="button" id="btn-cal-ux-duplicate-assignee" class="hidden"></button>`;
  anchor.insertAdjacentElement('afterend', controls);
  document.getElementById('btn-cal-ux-subtasks')?.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    calendarUxState.subtasksExpanded = !calendarUxState.subtasksExpanded;
    window.calendarUxState = calendarUxState;
    saveCalendarUxState(); updateCalendarUxButtons(); renderActiveViews();
  });
  document.getElementById('btn-cal-ux-risk')?.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    calendarUxState.criticalOnly = !calendarUxState.criticalOnly;
    window.calendarUxState = calendarUxState;
    saveCalendarUxState(); updateCalendarUxButtons(); renderActiveViews();
  });
  document.getElementById('btn-cal-ux-industry')?.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    calendarUxState.colorByIndustry = !calendarUxState.colorByIndustry;
    window.calendarUxState = calendarUxState;
    saveCalendarUxState(); updateCalendarUxButtons(); renderActiveViews();
  });
  document.getElementById('btn-cal-ux-assignee')?.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    calendarUxState.groupByAssignee = !calendarUxState.groupByAssignee;
    window.calendarUxState = calendarUxState;
    saveCalendarUxState(); updateCalendarUxButtons(); renderActiveViews();
  });
  document.getElementById('btn-cal-ux-duplicate-assignee')?.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    calendarUxState.duplicateMultiAssignee = !calendarUxState.duplicateMultiAssignee;
    window.calendarUxState = calendarUxState;
    saveCalendarUxState(); updateCalendarUxButtons(); renderActiveViews();
  });
  updateCalendarUxButtons();
}
// Date, risk, status, and industry helpers moved to js/date-risk-utils.js
function ensureAdvancedFilterOptions() {
  const sel = document.getElementById('filter-status');
  if (!sel || sel.dataset.advanced === 'true') return;
  [
    ['SUBTASK_OVERDUE', '하위 업무 기한 초과'],
    ['DUE_SOON', '3일 내 마감 임박'],
    ['HIGH_RISK', 'High Risk 이상'],
    ['CRITICAL_RISK', 'Critical Risk']
  ].forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    sel.appendChild(opt);
  });
  sel.dataset.advanced = 'true';
}
function ensureRiskDashboardPanel() {
  const host = document.getElementById('unified-risk-host');
  if (!host) return null;
  let panel = document.getElementById('risk-dashboard-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'risk-dashboard-panel';
  }
  if (panel.parentElement !== host) host.appendChild(panel);
  return panel;
}


function renderRiskDashboard(scope) {
  const panel = ensureRiskDashboardPanel();
  if (!panel) return;
  const today = getTodayStr();
  const risky = scope.filter(t => isTaskOverdueEffective(t, today)).sort((a,b) => getMaxDelayDays(b, today) - getMaxDelayDays(a, today));
  
  if (risky.length === 0) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  
  const topRisk = risky[0];
  const topRiskInfo = topRisk ? getTaskRiskInfo(topRisk, today) : null;
  const bottleneck = topRisk ? getBottleneckSubTask(topRisk, today) : null;
  const topSummary = topRisk ? `${escapeHTML(topRisk.title)} · ${topRiskInfo.label} D+${topRiskInfo.delay}` : '현재 중대 지연 없음';
  const bottleneckSummary = bottleneck ? `병목: ${escapeHTML(bottleneck.title)} · ${bottleneck.dueDate || '마감 미정'}` : '병목 없음';
  
  panel.className = '';
  panel.innerHTML = `
    <div class="flex min-w-0 items-center gap-2 rounded-xl bg-rose-50/70 px-3 py-2 text-[11px] dark:bg-rose-950/20">
      <span class="shrink-0 font-black text-rose-700 dark:text-rose-300">우선 확인</span>
      <span class="min-w-0 truncate font-semibold text-slate-600 dark:text-slate-300">${topSummary}${topRisk ? ` / ${bottleneckSummary}` : ''}</span>
    </div>`;
}

function normalizeAssigneeName(name) {
  return String(name || '').toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim();
}
function getMyAssigneeName() {
  return safeLocalStorageGet(UX_STORAGE_KEYS.myAssignee, window.__flowMyAssigneeFallback || '');
}
function setMyAssigneeName() {
  const current = getMyAssigneeName();
  const name = prompt('나의 Task 필터에 사용할 담당자명을 입력하세요. 예: Booyoul Oh 또는 오부열', current || '');
  if (name && name.trim()) {
    window.__flowMyAssigneeFallback = name.trim();
    safeLocalStorageSet(UX_STORAGE_KEYS.myAssignee, name.trim());
    showToast(`나의 담당자명 설정: ${name.trim()}`);
    updateFocusButtons();
    renderActiveViews();
  }
}
function isMineTask(task) {
  const mine = normalizeAssigneeName(getMyAssigneeName());
  if (!mine) return true; // 담당자명이 없으면 전체를 유지해서 빈 화면이 되지 않도록 함
  const match = val => {
    const list = Array.isArray(val) ? val : [val];
    return list.some(name => {
      const n = normalizeAssigneeName(name);
      return !!n && (n === mine || n.includes(mine) || mine.includes(n));
    });
  };
  return match(task?.assignee) || (Array.isArray(task?.subTasks) ? task.subTasks : []).some(st => match(st.assignee));
}

function getTrackerAssignees() {
  const set = new Set();
  tasks.filter(t => t.trackerId === currentTrackerId && !t.deleted).forEach(t => {
    if (Array.isArray(t.assignee)) {
      t.assignee.forEach(a => { if (a) set.add(a); });
    } else if (t.assignee) {
      set.add(t.assignee);
    }
    (Array.isArray(t.subTasks) ? t.subTasks : []).forEach(st => {
      if (Array.isArray(st.assignee)) {
        st.assignee.forEach(a => { if (a) set.add(a); });
      } else if (st.assignee) {
        set.add(st.assignee);
      }
    });
  });
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
}
function isAssigneeFilterMatched(task) {
  if (!selectedAssigneeFilters || selectedAssigneeFilters.size === 0) return true;
  const match = val => {
    const list = Array.isArray(val) ? val : [val];
    return list.some(name => !!name && selectedAssigneeFilters.has(String(name)));
  };
  return match(task?.assignee) || (Array.isArray(task?.subTasks) ? task.subTasks : []).some(st => match(st.assignee));
}

function getSelectedAssigneeLabel() {
  const names = Array.from(selectedAssigneeFilters || []);
  if (!names.length) return '👤 담당자: 전체';
  if (names.length <= 2) return `👤 담당자: ${names.join(', ')}`;
  return `👤 담당자: ${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}
function updateAssigneeButton() {
  const btn = document.getElementById('btn-open-assignee-modal');
  if (btn) btn.textContent = getSelectedAssigneeLabel();
}
function ensureAssigneeModal() {
  if (document.getElementById('assignee-filter-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'assignee-filter-modal';
  modal.className = 'hidden fixed inset-0 z-[80] items-center justify-center bg-slate-900/40 px-4';
  modal.innerHTML = `
    <div class="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
      <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <div class="text-sm font-black text-slate-800">담당자 선택</div>
          <div class="text-[11px] text-slate-400">현재 트래커의 본 업무/하위 업무 담당자 기준</div>
        </div>
        <button type="button" id="btn-close-assignee-modal" class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
      </div>
      <div class="px-5 py-4">
        <div class="mb-3 flex items-center justify-between gap-2">
          <button type="button" id="btn-assignee-select-all" class="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200">전체 선택</button>
          <button type="button" id="btn-assignee-clear-modal" class="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200">선택 해제</button>
        </div>
        <div id="assignee-modal-list" class="max-h-72 space-y-1 overflow-y-auto pr-1"></div>
      </div>
      <div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
        <button type="button" id="btn-cancel-assignee-modal" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">취소</button>
        <button type="button" id="btn-apply-assignee-modal" class="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700">적용</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('btn-close-assignee-modal')?.addEventListener('click', closeAssigneeModal);
  document.getElementById('btn-cancel-assignee-modal')?.addEventListener('click', closeAssigneeModal);
  document.getElementById('btn-apply-assignee-modal')?.addEventListener('click', applyAssigneeModalSelection);
  document.getElementById('btn-assignee-select-all')?.addEventListener('click', () => document.querySelectorAll('#assignee-modal-list input[type="checkbox"]').forEach(cb => cb.checked = true));
  document.getElementById('btn-assignee-clear-modal')?.addEventListener('click', () => document.querySelectorAll('#assignee-modal-list input[type="checkbox"]').forEach(cb => cb.checked = false));
  modal.addEventListener('click', e => { if (e.target === modal) closeAssigneeModal(); });
}
function renderAssigneeModalList() {
  ensureAssigneeModal();
  const list = document.getElementById('assignee-modal-list');
  if (!list) return;
  const names = getTrackerAssignees();
  if (!names.length) {
    list.innerHTML = '<div class="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">현재 트래커에 등록된 담당자가 없습니다.</div>';
    return;
  }
  list.innerHTML = names.map(name => `
    <label class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-indigo-50/50">
      <span class="min-w-0 truncate font-semibold text-slate-700">${escapeHTML(name)}</span>
      <input type="checkbox" class="assignee-modal-checkbox rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" value="${escapeHTML(name)}" ${selectedAssigneeFilters.has(name) ? 'checked' : ''}>
    </label>`).join('');
}
function openAssigneeModal() {
  renderAssigneeModalList();
  const modal = document.getElementById('assignee-filter-modal');
  if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}
function closeAssigneeModal() {
  const modal = document.getElementById('assignee-filter-modal');
  if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}
window.openAssigneeModal = openAssigneeModal;
window.closeAssigneeModal = closeAssigneeModal;
function applyAssigneeModalSelection() {
  selectedAssigneeFilters = new Set(Array.from(document.querySelectorAll('#assignee-modal-list .assignee-modal-checkbox:checked')).map(cb => cb.value));
  window.selectedAssigneeFilters = selectedAssigneeFilters;
  updateAssigneeButton();
  closeAssigneeModal();
  renderActiveViews();
}
function clearAssigneeMultiSelect() {
  selectedAssigneeFilters.clear();
  window.selectedAssigneeFilters = selectedAssigneeFilters;
  updateAssigneeButton();
  renderActiveViews();
}
function updateAssigneeMultiSelect() { updateAssigneeButton(); }
function handleAssigneeMultiSelectChange() { updateAssigneeButton(); renderActiveViews(); }


function getFocusButtonClass(isOn) {
  return isOn
    ? 'ux-focus-btn rounded-xl border border-indigo-200 bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition'
    : 'ux-focus-btn rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition';
}
function updateFocusButtons() {
  const risk = document.getElementById('btn-focus-risk');
  const high = document.getElementById('btn-focus-high');
  if (risk) risk.className = getFocusButtonClass(focusState.riskOnly);
  if (high) high.className = getFocusButtonClass(focusState.highOnly);
  updateAssigneeMultiSelect();
}
function toggleFocusMode(key) {
  if (key === 'mineOnly' && !focusState.mineOnly && !safeLocalStorageGet(UX_STORAGE_KEYS.myAssignee, '')) {
    setMyAssigneeName();
    if (!safeLocalStorageGet(UX_STORAGE_KEYS.myAssignee, window.__flowMyAssigneeFallback || '')) {
      focusState.mineOnly = false;
      updateFocusButtons();
      showToast('담당자명이 설정되지 않아 My Tasks 필터를 적용하지 않았습니다.', false);
      renderActiveViews();
      return;
    }
  }
  focusState[key] = !focusState[key];
  updateFocusButtons();
  renderActiveViews();
}
function updateBulkActionBar() {
  const bar = document.getElementById('bulk-action-bar');
  const count = document.getElementById('bulk-selected-count');
  if (bar && count) {
    count.textContent = `${selectedTaskIds.size}개 선택됨`;
    supportsTaskSelectionActions() && selectedTaskIds.size
      ? bar.classList.remove('hidden')
      : bar.classList.add('hidden');
  }
  if (typeof updateMobileBulkActionBar === 'function') updateMobileBulkActionBar();
}
function clearSelection() {
  selectedTaskIds.clear();
  renderActiveViews();
  updateBulkActionBar();
}
async function bulkUpdateSelected(payloadBuilder, successMessage) {
  const ids = Array.from(selectedTaskIds || []);
  if (!ids.length) return showToast('선택된 업무가 없습니다.', false);
  const succeeded = [];
  for (const id of ids) {
    const payload = typeof payloadBuilder === 'function' ? payloadBuilder(id) : payloadBuilder;
    const result = await db_updateTask(id, payload);
    if (result && result.success) succeeded.push(id);
  }
  succeeded.forEach(id => selectedTaskIds.delete(id));
  if (succeeded.length !== ids.length) {
    showToast(`${succeeded.length}개 수정, ${ids.length - succeeded.length}개 실패`, false);
    renderActiveViews();
    updateBulkActionBar();
    return { success: false, succeeded };
  }
  showToast(successMessage || `${succeeded.length}개 업무가 일괄 수정되었습니다.`);
  clearSelection();
  return { success: true, succeeded };
}
async function bulkChangeStatus() {
  const raw = prompt('변경할 상태를 입력하세요: PENDING, PROGRESS, COMPLETED, CANCELLED', 'PROGRESS');
  if (!raw) return;
  const status = raw.trim().toUpperCase();
  if (!['PENDING', 'PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) return showToast('상태값은 PENDING, PROGRESS, COMPLETED, CANCELLED 중 하나여야 합니다.', false);
  await bulkUpdateSelected({ status }, `선택 업무 상태가 ${getStatusKorean(status)}로 변경되었습니다.`);
}
async function bulkChangeAssignee() {
  const assignee = prompt('변경할 담당자명을 입력하세요. (복수인 경우 쉼표로 구분)', '');
  if (assignee === null) return;
  const assignees = assignee.split(',').map(s => s.trim()).filter(Boolean);
  const finalAssignees = assignees.length ? assignees : ['미지정'];
  await bulkUpdateSelected({ assignee: finalAssignees }, `선택 업무 담당자가 변경되었습니다.`);
}
async function bulkChangeDueDate() {
  const dueDate = prompt('변경할 마감일을 입력하세요. 예: 2026-07-31', getTodayStr());
  if (!dueDate) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) return showToast('마감일 형식은 YYYY-MM-DD 이어야 합니다.', false);
  await bulkUpdateSelected({ dueDate: dueDate.trim() }, `선택 업무 마감일이 ${dueDate.trim()}로 변경되었습니다.`);
}


function showToast(msg, isSuccess = true) {
  const t = document.getElementById('toast');
  const txt = document.getElementById('toast-text');
  const icon = document.getElementById('toast-icon');
  if (!t || !txt) { console.info(msg); return; }
  txt.textContent = msg;
  if (icon) icon.textContent = isSuccess ? '✅' : '⚠️';
  t.classList.remove('translate-y-10', 'opacity-0');
  t.classList.add('translate-y-0', 'opacity-100');
  setTimeout(() => {
    t.classList.remove('translate-y-0', 'opacity-100');
    t.classList.add('translate-y-10', 'opacity-0');
  }, 3500);
}
function getServerTimestamp() {
  return (typeof window.fs !== 'undefined' && window.fs.serverTimestamp)
    ? window.fs.serverTimestamp()
    : new Date().toISOString();
}
function canWriteToFirestore() {
  if (!isFirebaseAvailable || !db) return false;
  if (auth && !isAuthReady) {
    showToast('Firebase 인증 준비 중입니다. 잠시 후 다시 시도해 주세요.', false);
    return false;
  }
  if (!window.currentUser) {
    showToast('승인된 사용자만 데이터를 변경할 수 있습니다.', false);
    return false;
  }
  return true;
}
function markSaving() { lastSaveState = 'saving'; }
function markSaved() { lastSaveState = 'saved'; }
function markSaveError() { lastSaveState = 'error'; }

let pendingTrackerOrderSignature = null;
let isTrackerOrderSaving = false;
let draggedTrackerElement = null;
let trackerDragOrderChanged = false;

function sortTrackersByOrder(list) {
  return [...(list || [])].sort((a, b) => {
    const ao = typeof a.order === 'number' ? a.order : 999999;
    const bo = typeof b.order === 'number' ? b.order : 999999;
    if (ao !== bo) return ao - bo;
    return (a.name || '').localeCompare(b.name || '');
  });
}
function normalizeTrackerOrder(list) { return (list || []).map((t, i) => ({ ...t, order: i + 1 })); }
function getTrackerOrderSignature(list) { return (list || []).map(t => t && t.id).filter(Boolean).join('|'); }

async function saveTrackerOrder() {
  trackers = normalizeTrackerOrder(trackers).map(t => ({ ...t, updatedAt: getServerTimestamp() }));
  pendingTrackerOrderSignature = getTrackerOrderSignature(trackers);
  isTrackerOrderSaving = true;
  updateTrackerUI();
  const result = await db_updateTrackerOrders(trackers.map((tracker, index) => ({
    id: tracker.id,
    order: index + 1
  })));
  pendingTrackerOrderSignature = null;
  isTrackerOrderSaving = false;
  return result;
}
async function moveTrackerOrder(id, direction) {
  trackers = sortTrackersByOrder(trackers);
  const previousTrackers = trackers.map(t => ({ ...t }));
  const idx = trackers.findIndex(t => t.id === id);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || targetIdx < 0 || targetIdx >= trackers.length) return;
  const moved = trackers.splice(idx, 1)[0];
  trackers.splice(targetIdx, 0, moved);
  trackers = normalizeTrackerOrder(trackers);
  updateTrackerUI();
  const result = await saveTrackerOrder();
  if (!result || !result.success) {
    trackers = previousTrackers;
    updateTrackerUI();
  }
  return result;
}
async function moveTaskOrder(id, direction) {
  const scoped = tasks.filter(t => t.trackerId === currentTrackerId).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  scoped.forEach((t, i) => { if (typeof t.order !== 'number') t.order = i + 1; });
  const idx = scoped.findIndex(t => t.id === id);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || targetIdx < 0 || targetIdx >= scoped.length) return;
  const a = scoped[idx];
  const b = scoped[targetIdx];
  return db_updateTaskOrders([
    { id: a.id, order: b.order },
    { id: b.id, order: a.order }
  ]);
}

// Task and tracker CRUD helpers moved to js/task-service.js

function getFilteredTasks() {
  const searchVal = (document.getElementById('filter-search')?.value || '').trim();
  const search = searchVal.toLowerCase();
  const status = document.getElementById('filter-status')?.value || 'ALL';
  const priority = document.getElementById('filter-priority')?.value || 'ALL';
  const startMonthVal = document.getElementById('filter-start-month')?.value || '';
  const endMonthVal = document.getElementById('filter-end-month')?.value || '';
  
  let filterStartDate = '';
  let filterEndDate = '';
  if (startMonthVal) {
    const [yr, mn] = startMonthVal.split('-').map(Number);
    filterStartDate = `${yr}-${String(mn).padStart(2, '0')}-01`;
  }
  if (endMonthVal) {
    const [yr, mn] = endMonthVal.split('-').map(Number);
    const lastDay = new Date(yr, mn, 0).getDate();
    filterEndDate = `${yr}-${String(mn).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }
  
  const today = getTodayStr();
  return tasks.filter(t => {
    if (t.deleted === true || t.trackerId !== currentTrackerId) return false;
    const subSearchText = (Array.isArray(t.subTasks) ? t.subTasks : []).map(st => `${st.title || ''} ${st.assignee || ''}`).join(' ').toLowerCase();
    if (search && !String(t.title || '').toLowerCase().includes(search) && !String(t.assignee || '').toLowerCase().includes(search) && !subSearchText.includes(search)) return false;
    if (status === 'OVERDUE') {
      if (!isTaskOverdueEffective(t, today)) return false;
    } else if (status === 'SUBTASK_OVERDUE') {
      if (countOverdueSubTasks(t, today) === 0) return false;
    } else if (status === 'DUE_SOON') {
      if (!hasDueSoonRisk(t, today, 3)) return false;
    } else if (status === 'HIGH_RISK') {
      if (!['HIGH', 'CRITICAL'].includes(getTaskRiskInfo(t, today).level)) return false;
    } else if (status === 'CRITICAL_RISK') {
      if (getTaskRiskInfo(t, today).level !== 'CRITICAL') return false;
    } else if (status !== 'ALL' && getEffectiveStatus(t, today) !== status) return false;
    if (priority !== 'ALL' && t.priority !== priority) return false;
    if (focusState.riskOnly && !isTaskOverdueEffective(t, today)) return false;
    if (focusState.mineOnly && !isMineTask(t)) return false;
    if (focusState.highOnly && t.priority !== 'HIGH') return false;
    if (!isAssigneeFilterMatched(t)) return false;
    if (filterStartDate || filterEndDate) {
      const rangeStart = filterStartDate || '0000-01-01';
      const rangeEnd = filterEndDate || '9999-12-31';
      const taskOverlaps = (t.startDate || today) <= rangeEnd && (t.dueDate || today) >= rangeStart;
      const subTasksInRange = typeof expandSubTasksForRange === 'function'
        ? expandSubTasksForRange(t, rangeStart, rangeEnd, today)
        : (Array.isArray(t.subTasks) ? t.subTasks : []);
      const subOverlaps = subTasksInRange.some(st => (st.startDate || st.dueDate || today) <= rangeEnd && (st.dueDate || st.startDate || today) >= rangeStart);
      if (!taskOverlaps && !subOverlaps) return false;
    }
    return true;
  });
}
function updateTrackerUI() {
  const listContainer = document.getElementById('tracker-list-items');
  if (!listContainer) return;
  listContainer.innerHTML = '';
  trackers = sortTrackersByOrder(trackers).map((t, i) => ({ ...t, order: typeof t.order === 'number' ? t.order : i + 1 }));
  const current = trackers.find(t => t.id === currentTrackerId) || trackers[0];
  if (current) {
    currentTrackerId = current.id;
    const nameEl = document.getElementById('current-tracker-name');
    const descEl = document.getElementById('current-tracker-desc');
    if (nameEl) nameEl.textContent = current.name || '기본 트래커';
    if (descEl) descEl.textContent = current.desc || '실시간 업무 기한 관리 및 진척도 모니터링 시스템';
  }
  trackers.forEach(t => {
    const row = document.createElement('div');
    row.className = `tracker-item group flex items-stretch gap-1 rounded-xl transition ${t.id === currentTrackerId ? 'bg-indigo-50 ring-1 ring-indigo-100' : 'hover:bg-slate-50'}`;
    row.dataset.id = t.id;
    row.innerHTML = `
      <button type="button" class="tracker-select flex-1 text-left px-3 py-2 rounded-xl">
        <div class="text-xs font-bold text-slate-800">${escapeHTML(t.name)}</div>
        <div class="text-[10px] text-slate-400 truncate">${escapeHTML(t.desc || '상세 설명 없음')}</div>
      </button>
      <div class="flex flex-col py-1 pr-1 justify-center">
        <button type="button" class="btn-tracker-up text-slate-400 hover:text-indigo-600 p-0.5" title="위로 이동">
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
        </button>
        <button type="button" class="btn-tracker-down text-slate-400 hover:text-indigo-600 p-0.5" title="아래로 이동">
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
        </button>
      </div>`;
    row.querySelector('.tracker-select').addEventListener('click', () => {
      currentTrackerId = t.id;
      localStorage.setItem('flow_current_tracker', currentTrackerId);
      document.getElementById('tracker-dropdown-menu')?.classList.add('hidden');
      updateTrackerUI();
      updateUI();
      showToast(`트래커 전환: ${t.name}`);
    });
    row.querySelector('.btn-tracker-up').addEventListener('click', e => { e.stopPropagation(); moveTrackerOrder(t.id, 'up'); });
    row.querySelector('.btn-tracker-down').addEventListener('click', e => { e.stopPropagation(); moveTrackerOrder(t.id, 'down'); });
    listContainer.appendChild(row);
  });
}
function renderStats() {
  const scope = tasks.filter(t => t.trackerId === currentTrackerId && !t.deleted);
  const total = scope.length;
  const today = getTodayStr();
  const pending = scope.filter(t => getEffectiveStatus(t, today) === 'PENDING').length;
  const progress = scope.filter(t => getEffectiveStatus(t, today) === 'PROGRESS').length;
  const completed = scope.filter(t => getEffectiveStatus(t, today) === 'COMPLETED').length;
  const cancelled = scope.filter(t => getEffectiveStatus(t, today) === 'CANCELLED').length;
  const activeTotal = total - cancelled;
  const overdue = scope.filter(t => isTaskOverdueEffective(t, today)).length;
  const overdueUnits = scope.reduce((sum, t) => sum + countTaskOverdueUnits(t, today), 0);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-total', total); set('stat-pending', pending); set('stat-progress', progress); set('stat-completed', completed); set('stat-cancelled', cancelled); set('stat-overdue', overdue);
  set('stat-pending-pct', activeTotal ? Math.round(pending / activeTotal * 100) + '%' : '0%');
  set('stat-progress-pct', activeTotal ? Math.round(progress / activeTotal * 100) + '%' : '0%');
  set('stat-completed-pct', activeTotal ? Math.round(completed / activeTotal * 100) + '%' : '0%');
  const lbl = document.getElementById('stat-overdue-lbl');
  if (lbl) {
    lbl.textContent = overdue ? `하위 포함 ${overdueUnits}항목` : '매우 양호';
    lbl.className = `text-xs font-medium ${overdue ? 'text-rose-500 font-semibold' : 'text-emerald-500'}`;
  }
  applyCompactDashboardStyles();
  renderRiskDashboard(scope);
}

function buildTaskDetailCellHTML(t, subTasks, isExpanded, doneSubs, progressPct, bottleneckHTML) {
  const counts = getSubTaskCompletionCounts(subTasks);
  const subInfo = subTasks.length ? ` · 하위 업무 ${doneSubs}/${counts.active}${counts.cancelled ? ` · 취소 ${counts.cancelled}` : ''}` : '';
  return `
      <td class="px-4 py-4 align-top"><div class="flex items-start gap-2">
        <button type="button" class="btn-toggle-subtasks mt-1.5 shrink-0 text-slate-400 hover:text-indigo-600 flex items-center justify-center ${subTasks.length ? '' : 'invisible'}" data-id="${escapeHTML(t.id)}" data-expanded="${isExpanded ? 'true' : 'false'}" title="하위 업무 토글">
          ${subTasks.length ? (isExpanded ? `<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>` : `<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>`) : ''}
        </button>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <button type="button" class="btn-edit text-left block min-w-0 max-w-full rounded px-1 -mx-1 text-base font-black leading-snug text-slate-900 hover:text-indigo-600 outline-none" data-id="${t.id}" title="클릭해서 업무 수정">${escapeHTML(t.title)}</button>
          </div>
          <div class="mt-1 text-xs text-slate-400">${escapeHTML(t.notes || '추가 지침 없음')} · 진척 ${progressPct}%${subInfo}</div>
          ${bottleneckHTML}
        </div>
      </div></td>`;
}

function subTaskStatusSelect(parentId, subId, status, options = {}) {
  status = normalizeStatus(status);
  const sourceSubTaskId = options.sourceSubTaskId || '';
  const occurrenceKey = options.occurrenceKey || '';
  const occurrenceAttrs = occurrenceKey
    ? ` data-source-subtask-id="${escapeHTML(sourceSubTaskId || subId)}" data-occurrence-key="${escapeHTML(occurrenceKey)}"`
    : '';
  return `
    <select class="sel-subtask-status rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100" data-task-id="${escapeHTML(parentId)}" data-subtask-id="${escapeHTML(subId)}"${occurrenceAttrs}>
      <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>진행 대기</option>
      <option value="PROGRESS" ${status === 'PROGRESS' ? 'selected' : ''}>진행 중</option>
      <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>완료</option>
      <option value="CANCELLED" ${status === 'CANCELLED' ? 'selected' : ''}>취소</option>
    </select>`;
}
// Table renderer moved to js/table-mobile-renderer.js
function renderCalendar(filteredTasks) {
  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();
  const grid = document.getElementById('calendar-grid');
  
  const weekdayHeader = document.getElementById('calendar-weekday-header');
  const titleEl = document.getElementById('calendar-month-year');
  const todayStr = getTodayStr();
  const monthStartDate = new Date(year, month, 1);
  const monthEndDate = new Date(year, month + 1, 0, 23, 59, 59);
  if (!grid) return;
  ensureCalendarUxControls();
  const showSubTaskBars = calendarUxState.subtasksExpanded;
  const highlightRiskOnly = calendarUxState.criticalOnly;
  const useIndustryColor = calendarUxState.colorByIndustry;
  if (titleEl) titleEl.textContent = currentCalMode === 'MONTH' ? `${year}년 년간 타임라인` : `${year}년 ${month + 1}월`;

  const groups = filteredTasks.map(t => {
    const start = t.startDate || t.dueDate || todayStr;
    const end = t.dueDate || todayStr;
    const taskAssignees = Array.isArray(t.assignee) ? [...t.assignee] : [t.assignee || '미지정'];
    const subTaskRangeStart = currentCalMode === 'MONTH' ? new Date(year, 0, 1) : monthStartDate;
    const subTaskRangeEnd = currentCalMode === 'MONTH' ? new Date(year, 11, 31, 23, 59, 59) : monthEndDate;
    const sourceSubTasks = typeof expandSubTasksForRange === 'function'
      ? expandSubTasksForRange(t, subTaskRangeStart, subTaskRangeEnd, todayStr)
      : (t.subTasks || []);
    const g = {
      id: t.id, title: t.title, startDate: start > end ? end : start, dueDate: end, status: t.status || 'PENDING',
      priority: t.priority || 'NORMAL', industry: t.industry || 'AUTO', taskType: t.taskType || 'GENERAL', assignee: taskAssignees, notes: t.notes || '', order: t.order ?? 999,
      subTasks: sourceSubTasks.map(st => {
        const ss = st.startDate || st.dueDate || end;
        const dd = st.dueDate || end;
        const subAssignees = Array.isArray(st.assignee) ? [...st.assignee] : (st.assignee ? [st.assignee] : [...taskAssignees]);
        return { id: st.id, title: st.title, startDate: ss > dd ? dd : ss, dueDate: dd, status: normalizeStatus(st.status), assignee: subAssignees, parentId: t.id, parentTitle: t.title, industry: t.industry || 'AUTO', taskType: t.taskType || 'GENERAL', isRecurringOccurrence: st.isRecurringOccurrence === true, sourceSubTaskId: st.sourceSubTaskId || '', occurrenceKey: st.occurrenceKey || '', recurrenceLabel: st.recurrenceLabel || '' };
      })
    };
    // Calendar lane calculation must use only the sub tasks relevant to the current view.
    // DAY / SUMMARY: use only sub tasks overlapping the selected month to avoid wasting vertical space.
    // MONTH(year Gantt): keep all sub tasks because the view spans the full year.
    g.monthSubTasks = g.subTasks.filter(st => dateRangeOverlaps(st, monthStartDate, monthEndDate, todayStr));
    const layoutSubTasks = currentCalMode === 'MONTH' ? g.subTasks : g.monthSubTasks;
    g.rangeStart = g.startDate; g.rangeEnd = g.dueDate;
    layoutSubTasks.forEach(st => { if (st.startDate < g.rangeStart) g.rangeStart = st.startDate; if (st.dueDate > g.rangeEnd) g.rangeEnd = st.dueDate; });
    return g;
  }).sort((a, b) => a.order - b.order || a.rangeStart.localeCompare(b.rangeStart));

  const laneLayout = calendarComputeLaneLayout(groups, { currentCalMode, showSubTaskBars, groupByAssignee: calendarUxState.groupByAssignee, duplicateMultiAssignee: calendarUxState.duplicateMultiAssignee, todayStr });
  const lines = laneLayout.lines;
  const totalCalLanes = laneLayout.totalCalLanes;
  const layoutGroups = laneLayout.layoutGroups || groups;
  const forceTextOnFirstDay = day => day === 1;
  const shouldShowCalendarText = (item, dateStr, isWeekStart, day) => dateStr === item.start || dateStr === item.end || isWeekStart || forceTextOnFirstDay(day) || dateStr === todayStr;
  const addInvisibleCalendarSpacer = container => { const sp = document.createElement('div'); sp.className = 'calendar-lane-spacer min-h-[17px] invisible'; container.appendChild(sp); };
  const isCalendarCriticalItem = item => item?.isSub
    ? isSubTaskOverdue(item, todayStr) || (!['COMPLETED', 'CANCELLED'].includes(normalizeStatus(item.status)) && !!item.dueDate && item.dueDate <= getFutureDateStr(3))
    : getEffectiveStatus(item, todayStr) !== 'CANCELLED' && (getEffectiveStatus(item, todayStr) === 'OVERDUE' || item.priority === 'HIGH' || hasDueSoonRisk(item, todayStr, 3));
  const dimIfNotCritical = item => highlightRiskOnly && !isCalendarCriticalItem(item) ? ' opacity-25 grayscale' : '';
  const mainClass = item => {
    const effective = getEffectiveStatus(item, todayStr);
    if (effective === 'OVERDUE') return 'bg-rose-100 text-rose-800 border border-rose-200 font-semibold';
    if (effective === 'COMPLETED') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    if (effective === 'CANCELLED') return 'bg-slate-100 text-slate-500 border border-slate-200 opacity-70';
    if (useIndustryColor) return getIndustryBarClass(item, false);
    if (effective === 'PROGRESS') return 'bg-blue-100 text-blue-800 border border-blue-200';
    return 'bg-slate-200 text-slate-700';
  };
  const subClass = item => {
    const status = normalizeStatus(item.status);
    if (status === 'COMPLETED') return 'bg-emerald-50/80 text-emerald-800 border border-dashed border-emerald-300';
    if (status === 'CANCELLED') return 'bg-slate-100/80 text-slate-500 border border-dashed border-slate-300 opacity-70';
    if (isSubTaskOverdue(item, todayStr)) return 'bg-rose-50/90 text-rose-800 border border-dashed border-rose-300 font-semibold';
    if (useIndustryColor) return getIndustryBarClass(item, true);
    if (status === 'PROGRESS') return 'bg-blue-50/80 text-blue-800 border border-dashed border-blue-300';
    return 'bg-slate-50 text-slate-700 border border-dashed border-slate-300';
  };

  if (currentCalMode === 'DAY') {
    renderCalendarDayView({ weekdayHeader, grid, year, month, todayStr, totalCalLanes, groups: layoutGroups, showSubTaskBars, mainClass, dimIfNotCritical, useIndustryColor });
    return;
  }
  if (currentCalMode === 'MONTH') {
    renderCalendarMonthView({ weekdayHeader, grid, year, groups: layoutGroups, lines, mainClass, subClass, dimIfNotCritical, showSubTaskBars, todayStr });
    return;
  }

  renderCalendarSummaryView({ weekdayHeader, grid, year, month, filteredTasks, todayStr });
}

// Mobile card renderer moved to js/table-mobile-renderer.js

function updateUI() {
  const gateway = document.getElementById('auth-gateway-view');
  const mainContent = document.getElementById('app-main-content');
  if (gateway && mainContent) {
    if (isAuthReady && !window.currentUser) {
      gateway.classList.remove('hidden');
      mainContent.classList.add('hidden');
      return;
    } else {
      gateway.classList.add('hidden');
      mainContent.classList.remove('hidden');
    }
  }
  renderStats();
  const currentTracker = trackers.find(tracker => tracker.id === currentTrackerId);
  const addTaskButton = document.getElementById('btn-add-task');
  if (addTaskButton) {
    const canCreateTask = window.hasTaskPermission?.(currentTracker, 'create') === true;
    addTaskButton.disabled = !canCreateTask;
    addTaskButton.classList.toggle('opacity-40', !canCreateTask);
    addTaskButton.classList.toggle('cursor-not-allowed', !canCreateTask);
    addTaskButton.title = canCreateTask ? '새 업무 추가' : '업무 등록 권한이 없습니다.';
  }
  renderActiveViews();
  updateUndoButton();
  renderTrackerKpiBadge();
}

// Task/tracker modal controller moved to js/modal-controller.js
async function updateTaskStatus(id, status) {
  const result = await db_updateTask(id, { status });
  if (result && result.success) showToast(`상태 변경: ${getStatusKorean(status)}`);
  return result;
}
async function updateSubTaskStatus(parentId, subId, status, options = {}) {
  const parent = tasks.find(t => t.id === parentId);
  if (!parent || !Array.isArray(parent.subTasks)) return;
  const normalizedStatus = normalizeStatus(status);
  const occurrenceKey = options.occurrenceKey || '';
  const sourceSubTaskId = options.sourceSubTaskId || subId;
  const updated = parent.subTasks.map(st => {
    if (occurrenceKey && st.id === sourceSubTaskId) {
      const recurrenceCompletions = { ...(st.recurrenceCompletions || {}) };
      if (normalizedStatus === normalizeStatus(st.status)) delete recurrenceCompletions[occurrenceKey];
      else recurrenceCompletions[occurrenceKey] = normalizedStatus;
      const next = { ...st, recurrenceCompletions };
      if (!Object.keys(recurrenceCompletions).length) delete next.recurrenceCompletions;
      return next;
    }
    return st.id === subId ? { ...st, status: normalizedStatus } : st;
  });
  const result = await db_updateTask(parentId, { subTasks: updated });
  if (result && result.success) showToast(`하위 업무 상태 변경: ${getStatusKorean(status)}`);
  return result;
}
function confirmDelete(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  document.getElementById('confirm-title').textContent = '업무 삭제 알림';
  document.getElementById('confirm-message').innerHTML = `'${escapeHTML(t.title)}' 업무를 삭제하시겠습니까?`;
  confirmActionCb = async () => {
    const result = await db_deleteTask(id);
    if (!result || !result.success) return;
    deletionHistory.push({ timestamp: Date.now(), items: [t] });
    closeConfirmModal();
    showToast('삭제되었습니다.');
  };
  document.getElementById('modal-confirm')?.classList.remove('hidden');
}
function confirmBatchDelete() {
  if (!selectedTaskIds.size) return;
  document.getElementById('confirm-title').textContent = '선택한 업무 일괄 삭제';
  document.getElementById('confirm-message').innerHTML = `선택된 ${selectedTaskIds.size}개의 업무를 삭제하시겠습니까?`;
  confirmActionCb = async () => {
    const deleted = [];
    selectedTaskIds.forEach(id => { const t = tasks.find(x => x.id === id); if (t) deleted.push(t); });
    const result = await db_batchDelete(selectedTaskIds);
    if (!result || !result.success) return;
    const deletedIds = new Set(result.deletedIds || []);
    const committed = deleted.filter(t => deletedIds.has(t.id));
    deletionHistory.push({ timestamp: Date.now(), items: committed });
    closeConfirmModal();
    showToast(`${committed.length}개 삭제됨.`);
  };
  document.getElementById('modal-confirm')?.classList.remove('hidden');
}
async function undoDelete() {
  if (!deletionHistory.length) return;
  const last = deletionHistory[deletionHistory.length - 1];
  const restorableItems = last.items.filter(task => window.hasTaskPermission?.(task, 'delete') === true);
  if (!restorableItems.length) {
    showToast('복원 권한이 있는 업무가 없습니다.', false);
    return;
  }
  const result = await db_restoreTasks(restorableItems);
  if (!result || !result.success) return;
  const restoredIds = new Set(result.restoredIds || []);
  last.items = last.items.filter(task => !restoredIds.has(task.id));
  if (!last.items.length) deletionHistory.pop();
  restorableItems.filter(task => restoredIds.has(task.id)).forEach(t => {
    if (!tasks.some(x => x.id === t.id)) tasks.push({ ...t, deleted: false, deletedAt: null });
  });
  showToast(`${restoredIds.size}개 복원됨.`);
  updateUI();
}
function handleTableClick(e) {
  const edit = e.target.closest('.btn-edit');
  const del = e.target.closest('.btn-delete');
  const toggle = e.target.closest('.btn-toggle-subtasks');
  const up = e.target.closest('.btn-order-up');
  const down = e.target.closest('.btn-order-down');
  if (edit) openTaskModal(edit.dataset.id);
  if (del) confirmDelete(del.dataset.id);
  if (toggle) {
    const id = toggle.dataset.id;
    const isExpanded = toggle.dataset.expanded === 'true';
    if (isExpanded) {
      expandedTaskIds.delete(id);
      collapsedTaskIds.add(id);
    } else {
      collapsedTaskIds.delete(id);
      expandedTaskIds.add(id);
    }
    renderActiveViews();
  }
  if (up) moveTaskOrder(up.dataset.id, 'up');
  if (down) moveTaskOrder(down.dataset.id, 'down');
}
function handleTableChange(e) {
  const sel = e.target.closest('.sel-status');
  const subSel = e.target.closest('.sel-subtask-status');
  const cb = e.target.closest('.cb-task');
  if (sel) updateTaskStatus(sel.dataset.id, sel.value);
  if (subSel) updateSubTaskStatus(subSel.dataset.taskId, subSel.dataset.subtaskId, subSel.value, { sourceSubTaskId: subSel.dataset.sourceSubtaskId, occurrenceKey: subSel.dataset.occurrenceKey });
  if (cb) { cb.checked ? selectedTaskIds.add(cb.dataset.id) : selectedTaskIds.delete(cb.dataset.id); renderActiveViews(); updateBatchButton(); }
}
function toggleSelectAll(e) { document.querySelectorAll('.cb-task').forEach(cb => e.target.checked ? selectedTaskIds.add(cb.dataset.id) : selectedTaskIds.delete(cb.dataset.id)); renderActiveViews(); updateBatchButton(); }
function updateSelectAllState(totalVisible, totalSelected) {
  const cb = document.getElementById('checkbox-select-all'); if (!cb) return;
  cb.disabled = totalVisible === 0;
  cb.checked = totalVisible > 0 && totalVisible === totalSelected;
  cb.indeterminate = totalSelected > 0 && totalSelected < totalVisible;
  updateBatchButton();
}
function updateBatchButton() {
  const btn = document.getElementById('btn-batch-delete');
  if (btn) {
    const shouldShow = supportsTaskSelectionActions() && selectedTaskIds.size > 0;
    btn.hidden = !shouldShow;
    btn.classList.toggle('hidden', !shouldShow);
  }
  updateBulkActionBar();
}
function updateUndoButton() {
  const btn = document.getElementById('btn-undo');
  if (btn) {
    const shouldShow = supportsTaskSelectionActions() && deletionHistory.length > 0;
    btn.hidden = !shouldShow;
    btn.classList.toggle('hidden', !shouldShow);
  }
}
function resetFilters() {
  ['filter-search', 'filter-start-month', 'filter-end-month', 'mobile-filter-start-month', 'mobile-filter-end-month'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['filter-status', 'filter-priority', 'mobile-filter-status', 'mobile-filter-priority'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 'ALL'; });
  focusState.riskOnly = false;
  focusState.highOnly = false;
  focusState.mineOnly = false;
  selectedAssigneeFilters.clear();
  window.selectedAssigneeFilters = selectedAssigneeFilters;
  updateAssigneeButton();
  renderActiveViews();
}
function handleDeleteTrackerClick() {
  const id = document.getElementById('input-tracker-id').value;
  const t = trackers.find(x => x.id === id); if (!t) return;
  closeTrackerModal();
  document.getElementById('confirm-title').textContent = '트래커 완전 삭제';
  document.getElementById('confirm-message').innerHTML = `정말 '${escapeHTML(t.name)}' 트래커를 삭제하시겠습니까?<br>* 이 트래커 소속의 모든 업무 데이터가 함께 삭제됩니다.`;
  confirmActionCb = async () => {
    const result = await db_deleteTracker(id);
    if (!result || !result.success) return;
    closeConfirmModal();
    showToast('트래커 및 소속 데이터가 제거되었습니다.');
  };
  document.getElementById('modal-confirm')?.classList.remove('hidden');
}
// Export helpers moved to js/export-service.js
async function importFromJSON(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const arr = JSON.parse(ev.target.result);
      if (!Array.isArray(arr)) throw new Error('배열 아님');
      let imported = 0;
      for (const t of arr) {
        const result = await db_addTask({ ...t, trackerId: currentTrackerId });
        if (!result || !result.success) throw new Error(`${imported}개 반영 후 Firebase 저장 실패`);
        imported += 1;
      }
      showToast(`${imported}개 업무를 성공적으로 불러왔습니다.`);
    } catch (err) { showToast(`불러오기 실패: ${err.message || String(err)}`, false); }
  };
  reader.readAsText(file);
  e.target.value = '';
}
function setCalMode(mode) {
  currentCalMode = mode;
  ['day', 'month', 'summary'].forEach(m => {
    const btn = document.getElementById(`btn-cal-mode-${m}`);
    if (!btn) return;
    btn.className = m.toUpperCase() === mode
      ? 'rounded-lg bg-white px-3.5 py-1.5 text-slate-800 shadow-sm transition'
      : 'rounded-lg px-3.5 py-1.5 text-slate-500 hover:text-slate-800 transition';
  });
  renderActiveViews();
}
// Realtime Firebase listener helpers moved to js/task-service.js

// --- UI layout override: Control Hub + KPI compact summary ---
function ensureKpiCollapsedSummary(section) {
  let summary = document.getElementById('kpi-collapsed-summary');
  if (!summary) {
    summary = document.createElement('section');
    summary.id = 'kpi-collapsed-summary';
    summary.addEventListener('click', e => {
      const chip = e.target.closest('.kpi-compact-chip');
      if (chip) {
        const status = chip.getAttribute('data-status');
        const priority = chip.getAttribute('data-priority');
        if (status) {
          const el = document.getElementById('filter-status');
          if (el) el.value = status;
        }
        if (priority) {
          const el = document.getElementById('filter-priority');
          if (el) el.value = priority;
        }
        renderActiveViews();
      }
    });
    section.insertAdjacentElement('beforebegin', summary);
  }
  return summary;
}
function getKpiCompactValues() {
  const scope = (Array.isArray(tasks) ? tasks : []).filter(t => t.trackerId === currentTrackerId && !t.deleted);
  const today = getTodayStr();
  const total = scope.length;
  const pending = scope.filter(t => getEffectiveStatus(t, today) === 'PENDING').length;
  const progress = scope.filter(t => getEffectiveStatus(t, today) === 'PROGRESS').length;
  const completed = scope.filter(t => getEffectiveStatus(t, today) === 'COMPLETED').length;
  const cancelled = scope.filter(t => getEffectiveStatus(t, today) === 'CANCELLED').length;
  const overdue = scope.filter(t => isTaskOverdueEffective(t, today)).length;
  const high = scope.filter(t => t.priority === 'HIGH').length;
  return { total, pending, progress, completed, cancelled, overdue, high };
}
function relocateHeaderActionsToToolbar() {
  const toolHost = document.getElementById('ux-tool-host');
  const primaryHost = document.getElementById('primary-task-action-host');
  const goalHost = document.getElementById('unified-goal-host');
  if (!toolHost || !primaryHost || !goalHost) return;
  const tools = [
    ['btn-export-csv', 'CSV'],
    ['btn-export-excel', 'Excel'],
    ['btn-export-powerbi', 'Power BI'],
    ['btn-export-json', '백업'],
    ['btn-import-trigger', '가져오기']
  ];
  tools.forEach(([id]) => {
    const el = document.getElementById(id);
    if (!el || el.parentElement === toolHost) return;
    el.hidden = false;
    el.className = 'control-action-btn flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800';
    toolHost.appendChild(el);
  });
  const addTask = document.getElementById('btn-add-task');
  if (addTask && addTask.parentElement !== primaryHost) {
    addTask.className = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700';
    primaryHost.appendChild(addTask);
  }
  const goalBadge = document.getElementById('tracker-kpi-badge-container');
  if (goalBadge && goalBadge.parentElement !== goalHost) {
    goalHost.appendChild(goalBadge);
  }
}
function applyCompactDashboardStyles() {
  const section = document.getElementById('card-ALL')?.parentElement;
  if (!section) return;
  section.id = section.id || 'kpi-dashboard-section';
  const summary = ensureKpiCollapsedSummary(section);
  const statusHost = document.getElementById('unified-status-host');
  if (statusHost && summary.parentElement !== statusHost) statusHost.appendChild(summary);

  const k = getKpiCompactValues();
  section.className = 'hidden';
  summary.className = 'flex flex-wrap items-center gap-2';
  
  const currentStatus = document.getElementById('filter-status')?.value || 'ALL';
  const activeClass = (status) => currentStatus === status ? 'ring-2 ring-indigo-600 ring-offset-1 scale-[1.02]' : '';

  summary.innerHTML = `
    <span class="text-[11px] font-black uppercase tracking-wide text-slate-400 mr-1">현황</span>
    <span data-status="ALL" class="kpi-compact-chip inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 border border-slate-200 cursor-pointer hover:bg-slate-100 transition duration-150 ${activeClass('ALL')}">전체 <b class="text-slate-900">${k.total}</b></span>
    <span data-status="PENDING" class="kpi-compact-chip inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200 cursor-pointer hover:bg-amber-100 transition duration-150 ${activeClass('PENDING')}">대기 <b>${k.pending}</b></span>
    <span data-status="PROGRESS" class="kpi-compact-chip inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100 transition duration-150 ${activeClass('PROGRESS')}">진행 <b>${k.progress}</b></span>
    <span data-status="COMPLETED" class="kpi-compact-chip inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition duration-150 ${activeClass('COMPLETED')}">완료 <b>${k.completed}</b></span>
    <span data-status="CANCELLED" class="kpi-compact-chip inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 border border-slate-200 cursor-pointer hover:bg-slate-200 transition duration-150 ${activeClass('CANCELLED')}">취소 <b>${k.cancelled}</b></span>
    <span data-status="OVERDUE" class="kpi-compact-chip inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200 cursor-pointer hover:bg-rose-100 transition duration-150 ${activeClass('OVERDUE')}">Risk <b>${k.overdue}</b></span>
    <span data-priority="HIGH" class="kpi-compact-chip inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200 cursor-pointer hover:bg-amber-100 transition duration-150 ${document.getElementById('filter-priority')?.value === 'HIGH' ? 'ring-2 ring-indigo-600 ring-offset-1 scale-[1.02]' : ''}">High <b>${k.high}</b></span>`;
}
function ensureUXToolbar() {
  const filterBox = document.getElementById('unified-control-center');
  if (!filterBox) return;
  let bar = document.getElementById('ux-toolbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'ux-toolbar';
    bar.className = 'mt-3 border-t border-slate-100 pt-3 dark:border-slate-800';
    bar.innerHTML = `
      <div id="bulk-action-bar" class="hidden mt-3 flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-2">
        <span id="bulk-selected-count" class="text-xs font-bold text-indigo-700">0개 선택됨</span>
        <button type="button" id="bulk-change-status" class="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">상태 변경</button>
        <button type="button" id="bulk-change-assignee" class="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">담당자 변경</button>
        <button type="button" id="bulk-change-due" class="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">마감일 변경</button>
        <button type="button" id="bulk-clear-selection" class="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-505 hover:bg-white">선택 해제</button>
      </div>`;
    filterBox.appendChild(bar);
  }
  relocateHeaderActionsToToolbar();
  updateBulkActionBar();
}



// === Final Stable Render Orchestration Override ===
function renderActiveViews(){
  ensureAdvancedFilterOptions();
  ensureUXToolbar();

  // 캘린더 모드에 따른 상단 필터 값을 선제적으로 동기화하여 getFilteredTasks()가 올바른 범위를 필터링하도록 보장
  if (currentViewMode === 'CALENDAR') {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    const filterStartEl = document.getElementById('filter-start-month');
    const filterEndEl = document.getElementById('filter-end-month');
    if (filterStartEl && filterEndEl) {
      if (currentCalMode === 'MONTH') {
        filterStartEl.value = `${year}-01`;
        filterEndEl.value = `${year}-12`;
      } else {
        const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        filterStartEl.value = currentMonthStr;
        filterEndEl.value = currentMonthStr;
      }
    }
  }

  if (typeof syncMobileFiltersFromDesktop === 'function') {
    syncMobileFiltersFromDesktop();
  }
  

  if(typeof focusState==='undefined')window.focusState=focusState={riskOnly:false,mineOnly:false,highOnly:false};
  if(typeof UX_STORAGE_KEYS==='undefined')window.UX_STORAGE_KEYS=UX_STORAGE_KEYS={myAssignee:'flow_my_assignee_name'};
  updateFocusButtons();
  updateAssigneeMultiSelect();
  updateBatchButton();
  updateUndoButton();
  // ADMIN 뷰는 별도 렌더러 없이 HTML 정적 콘텐츠만 사용하므로 여기서 early return
  if(currentViewMode==='ADMIN'){
    setViewVisibility('ADMIN');
    updateViewToggleButtons('ADMIN');
    return;
  }
  const filtered=getFilteredTasks();
  const fStatus=document.getElementById('filter-status')?.value||'ALL';
  document.querySelectorAll('.filter-card').forEach(c=>c.classList.remove('ring-2','ring-indigo-600','bg-indigo-50/10'));
  document.getElementById(`card-${['ALL','PENDING','PROGRESS','COMPLETED','CANCELLED','OVERDUE'].includes(fStatus)?fStatus:'OVERDUE'}`)?.classList.add('ring-2','ring-indigo-600','bg-indigo-50/10');
  applyCompactDashboardStyles();
  const mode=currentViewMode==='CALENDAR'?'CALENDAR':currentViewMode==='KANBAN'?'KANBAN':'TABLE';
  setViewVisibility(mode);
  updateViewToggleButtons(mode);
  if(mode==='CALENDAR'){
    const isMobile = window.matchMedia ? window.matchMedia('(max-width: 1023px)').matches : window.innerWidth < 1024;
    if (isMobile && typeof renderMobileCalendar === 'function') {
      renderMobileCalendar(filtered);
    } else {
      renderCalendar(filtered);
    }
    return;
  }
  if(mode==='KANBAN'){if(typeof renderKanbanView==='function')renderKanbanView(filtered);else console.warn('renderKanbanView is not available');return;}
  renderTable(filtered);
  renderMobileCards(filtered);
}

function renderTrackerKpiBadge() {
  const container = document.getElementById('tracker-kpi-badge-container');
  if (!container) return;

  const tracker = trackers.find(t => t.id === currentTrackerId);
  if (!tracker) {
    container.hidden = true;
    container.classList.add('hidden');
    return;
  }

  const trackerTasks = tasks.filter(t => t.trackerId === currentTrackerId && !t.deleted);
  const totalCount = trackerTasks.filter(t => getEffectiveStatus(t, getTodayStr()) !== 'CANCELLED').length;
  const today = getTodayStr();
  
  // Custom KPI configuration from tracker
  const kpiTitle = tracker.kpiTitle || '업무 완료율';
  const kpiTarget = typeof tracker.kpiTarget === 'number' ? tracker.kpiTarget : 80;
  const kpiUnit = tracker.kpiUnit || '%';
  const kpiType = tracker.kpiType || 'AUTO_DONE_PCT';
  
  let currentVal = 0;
  let donePct = 0;
  let overdueCount = 0;
  let overduePct = 0;

  if (totalCount > 0) {
    const doneCount = trackerTasks.filter(t => getEffectiveStatus(t, today) === 'COMPLETED').length;
    overdueCount = trackerTasks.filter(t => getEffectiveStatus(t, today) === 'OVERDUE').length;
    donePct = Math.round((doneCount / totalCount) * 100);
    overduePct = Math.round((overdueCount / totalCount) * 100);
  }

  // Calculate current value based on kpiType
  if (kpiType === 'AUTO_DONE_PCT') {
    currentVal = donePct;
  } else if (kpiType === 'AUTO_OVERDUE_COUNT') {
    currentVal = overdueCount;
  } else if (kpiType === 'MANUAL') {
    currentVal = typeof tracker.kpiCurrent === 'number' ? tracker.kpiCurrent : 0;
  }

  // Determine progress percent for circular SVG gauge
  let progressPct = 0;
  if (kpiType === 'AUTO_OVERDUE_COUNT') {
    progressPct = kpiTarget > 0 ? Math.min(Math.round((currentVal / kpiTarget) * 100), 100) : (currentVal > 0 ? 100 : 0);
  } else {
    progressPct = kpiTarget > 0 ? Math.min(Math.round((currentVal / kpiTarget) * 100), 100) : 0;
  }

  // Determine Status health state
  let badgeColor = '';
  let statusText = '';

  if (kpiType === 'AUTO_DONE_PCT') {
    if (currentVal >= kpiTarget) {
      badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60';
      statusText = 'On Track';
    } else if (overduePct < 20) {
      badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60';
      statusText = 'At Risk';
    } else {
      badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60';
      statusText = 'Off Track';
    }
  } else if (kpiType === 'AUTO_OVERDUE_COUNT') {
    if (currentVal <= kpiTarget) {
      badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60';
      statusText = 'On Track';
    } else {
      badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60';
      statusText = 'Off Track';
    }
  } else { // MANUAL
    if (currentVal >= kpiTarget) {
      badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60';
      statusText = 'On Track';
    } else if (currentVal >= kpiTarget * 0.8) {
      badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60';
      statusText = 'At Risk';
    } else {
      badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60';
      statusText = 'Off Track';
    }
  }

  // Renders the mini badge HTML with custom KPI info
  container.className = `inline-flex items-center gap-2.5 cursor-pointer select-none rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:scale-[1.02] ${badgeColor}`;
  container.innerHTML = `
    <span class="relative flex h-5 w-5 items-center justify-center shrink-0">
      <svg class="h-5 w-5 -rotate-90" viewBox="0 0 36 36">
        <circle class="text-slate-200 dark:text-slate-800" stroke-width="3" stroke="currentColor" fill="none" r="16" cx="18" cy="18"/>
        <circle class="text-current" stroke-width="3.5" stroke-dasharray="100.5" stroke-dashoffset="${100.5 - (progressPct * 1.005)}" stroke-linecap="round" stroke="currentColor" fill="none" r="16" cx="18" cy="18"/>
      </svg>
      <span class="absolute text-[7.5px] font-black tracking-tighter" style="line-height: 1;">${currentVal}</span>
    </span>
    <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
    <span class="truncate max-w-[150px] font-semibold text-slate-700 dark:text-slate-350" title="${escapeHTML(kpiTitle)}: ${currentVal}${kpiUnit} / 목표 ${kpiTarget}${kpiUnit}">
      ${escapeHTML(kpiTitle)}: ${currentVal}${kpiUnit} <span class="text-slate-400 dark:text-slate-500 font-medium">/ 목표 ${kpiTarget}${kpiUnit}</span>
    </span>
    <span class="font-bold shrink-0 uppercase tracking-wide text-[9px] bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-current/20">${statusText}</span>
  `;
  container.hidden = false;
  container.classList.remove('hidden');

  // Bind click to open custom KPI settings modal
  container.onclick = (e) => {
    e.stopPropagation();
    if (typeof window.openKpiSettingsModal === 'function') {
      window.openKpiSettingsModal();
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.bootstrapApp === 'function') {
    window.bootstrapApp();
  } else {
    console.error('bootstrapApp is not available. Check bootstrap-service.js script order.');
    if (typeof updateUI === 'function') updateUI();
  }
});

function syncMobileFiltersFromDesktop() {
  const statusVal = document.getElementById('filter-status')?.value || 'ALL';
  const priorityVal = document.getElementById('filter-priority')?.value || 'ALL';
  const startMonthVal = document.getElementById('filter-start-month')?.value || '';
  const endMonthVal = document.getElementById('filter-end-month')?.value || '';

  const mStatus = document.getElementById('mobile-filter-status');
  const mPriority = document.getElementById('mobile-filter-priority');
  const mStartMonth = document.getElementById('mobile-filter-start-month');
  const mEndMonth = document.getElementById('mobile-filter-end-month');

  if (mStatus && mStatus.value !== statusVal) mStatus.value = statusVal;
  if (mPriority && mPriority.value !== priorityVal) mPriority.value = priorityVal;
  if (mStartMonth && mStartMonth.value !== startMonthVal) mStartMonth.value = startMonthVal;
  if (mEndMonth && mEndMonth.value !== endMonthVal) mEndMonth.value = endMonthVal;

  const dAssigneeBtn = document.getElementById('btn-open-assignee-modal');
  const mAssigneeBtn = document.getElementById('mobile-btn-open-assignee-modal');
  if (dAssigneeBtn && mAssigneeBtn) {
    mAssigneeBtn.textContent = dAssigneeBtn.textContent;
  }

  let activeFilterCount = 0;
  if (statusVal !== 'ALL') activeFilterCount++;
  if (priorityVal !== 'ALL') activeFilterCount++;
  if (startMonthVal !== '') activeFilterCount++;
  if (endMonthVal !== '') activeFilterCount++;
  if (window.selectedAssigneeFilters && window.selectedAssigneeFilters.size > 0) activeFilterCount++;

  const mFilterCountBadge = document.getElementById('mobile-filter-count');
  if (mFilterCountBadge) {
    mFilterCountBadge.textContent = activeFilterCount;
    if (activeFilterCount > 0) {
      mFilterCountBadge.classList.remove('hidden');
    } else {
      mFilterCountBadge.classList.add('hidden');
    }
  }
}
window.syncMobileFiltersFromDesktop = syncMobileFiltersFromDesktop;
