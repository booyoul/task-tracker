
console.info('Smart Task Flow app.js v20260626-module-split-phase4d-summary-renderer loaded');
// --- UX optimization globals: must be declared before helper functions ---
var focusState = window.focusState || { riskOnly: false, mineOnly: false, highOnly: false };
window.focusState = focusState;
var UX_STORAGE_KEYS = window.UX_STORAGE_KEYS || { myAssignee: 'flow_my_assignee_name' };
window.UX_STORAGE_KEYS = UX_STORAGE_KEYS;
var isDashboardCollapsed = window.isDashboardCollapsed || false;
window.isDashboardCollapsed = isDashboardCollapsed;
var isRiskPanelCollapsed = window.isRiskPanelCollapsed;
if (typeof isRiskPanelCollapsed !== 'boolean') isRiskPanelCollapsed = true;
window.isRiskPanelCollapsed = isRiskPanelCollapsed;
var selectedAssigneeFilters = window.selectedAssigneeFilters || new Set();
window.selectedAssigneeFilters = selectedAssigneeFilters;
var calendarUxState = window.calendarUxState || { subtasksExpanded: true, criticalOnly: false, colorByIndustry: false, groupByAssignee: false };
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
    calendarUxState = { subtasksExpanded: true, criticalOnly: false, colorByIndustry: false, groupByAssignee: false, ...calendarUxState, ...parsed };
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
    <button type="button" id="btn-cal-ux-assignee"></button>`;
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
  const existing = document.getElementById('risk-dashboard-panel');  
  if (existing) return existing;  
  // Robust anchor: the KPI section class changed from mb-6 to mb-3, so do not rely on a fixed class selector.  
  const cards = document.getElementById('card-ALL')?.parentElement || document.getElementById('kpi-dashboard-section') || document.querySelector('section.grid:has(.filter-card)') || document.querySelector('.filter-card')?.parentElement;  
  if (!cards) return null;  
  const panel = document.createElement('section');  
  panel.id = 'risk-dashboard-panel';  
  panel.className = 'mb-3';  
  cards.insertAdjacentElement('afterend', panel);  
  return panel;  
}

function applyCompactDashboardStyles() {
  const section = document.getElementById('card-ALL')?.parentElement;
  if (!section) return;
  section.id = section.id || 'kpi-dashboard-section';
  section.className = isDashboardCollapsed
    ? 'hidden'
    : 'mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5';
  document.querySelectorAll('.filter-card').forEach(card => {
    const active = card.classList.contains('ring-2');
    card.className = `filter-card rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm cursor-pointer transition-all duration-150 hover:bg-slate-50 ${active ? 'ring-2 ring-indigo-600 bg-indigo-50/10' : ''}`;
    const label = card.querySelector('.text-xs.font-semibold');
    if (label) label.className = 'text-[10px] font-bold text-slate-500 uppercase tracking-tight';
    const value = card.querySelector('[id^="stat-"]:not([id$="pct"]):not([id$="lbl"])');
    if (value) value.className = value.id === 'stat-overdue' ? 'text-lg font-black text-rose-600' : 'text-lg font-black text-slate-900';
    card.querySelectorAll('svg').forEach(svg => { svg.classList.remove('h-5','w-5'); svg.classList.add('h-4','w-4'); });
    const numberRow = card.querySelector('.mt-2.flex');
    if (numberRow) numberRow.className = 'mt-1 flex items-baseline gap-1.5';
  });
}
function ensureDashboardCompactControls() {
  if (document.getElementById('dashboard-compact-controls')) return;
  const section = document.getElementById('card-ALL')?.parentElement;
  if (!section) return;
  const controls = document.createElement('div');
  controls.id = 'dashboard-compact-controls';
  controls.className = 'mb-2 flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm';
  controls.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-xs font-black text-slate-700">Dashboard</span>
      <span class="text-[10px] text-slate-400">Compact view</span>
    </div>
    <div class="flex items-center gap-1.5">
      <button type="button" id="btn-toggle-risk-panel" class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-white">Risk 펼치기</button>
      <button type="button" id="btn-toggle-dashboard" class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-white">KPI 접기</button>
    </div>`;
  section.insertAdjacentElement('beforebegin', controls);
  document.getElementById('btn-toggle-risk-panel')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleRiskPanelCompact(); });
  document.getElementById('btn-toggle-dashboard')?.addEventListener('click', toggleDashboardCompact);
  updateDashboardCompactControls();
}
function updateDashboardCompactControls() {
  const riskBtn = document.getElementById('btn-toggle-risk-panel');
  const dashBtn = document.getElementById('btn-toggle-dashboard');
  if (riskBtn) riskBtn.textContent = isRiskPanelCollapsed ? 'Risk 펼치기' : 'Risk 접기';
  if (dashBtn) dashBtn.textContent = isDashboardCollapsed ? 'KPI 펼치기' : 'KPI 접기';
}
function toggleRiskPanelCompact() {
  window.isRiskPanelCollapsed = !(window.isRiskPanelCollapsed === true);
  isRiskPanelCollapsed = window.isRiskPanelCollapsed;
  updateDashboardCompactControls();
  const scope = tasks.filter(t => t.trackerId === currentTrackerId && !t.deleted);
  renderRiskDashboard(scope);
}
function toggleDashboardCompact() {
  window.isDashboardCollapsed = !window.isDashboardCollapsed;
  isDashboardCollapsed = window.isDashboardCollapsed;
  applyCompactDashboardStyles();
  updateDashboardCompactControls();
  renderActiveViews();
}

function renderRiskDashboard(scope) {
  isRiskPanelCollapsed = window.isRiskPanelCollapsed === true;
  const panel = ensureRiskDashboardPanel();
  if (!panel) return;
  const today = getTodayStr();
  const risky = scope.filter(t => isTaskOverdueEffective(t, today)).sort((a,b) => getMaxDelayDays(b, today) - getMaxDelayDays(a, today));
  const critical = risky.filter(t => getTaskRiskInfo(t, today).level === 'CRITICAL').length;
  const high = risky.filter(t => getTaskRiskInfo(t, today).level === 'HIGH').length;
  const dueSoon = scope.filter(t => hasDueSoonRisk(t, today)).length;
  const byAssignee = {};
  risky.forEach(t => {
    const name = t.assignee || '미지정';
    byAssignee[name] = (byAssignee[name] || 0) + countTaskOverdueUnits(t, today);
  });
  const assigneeRows = Object.entries(byAssignee).sort((a,b) => b[1] - a[1]).slice(0, 3);
  const topRisk = risky[0];
  const topRiskInfo = topRisk ? getTaskRiskInfo(topRisk, today) : null;
  const bottleneck = topRisk ? getBottleneckSubTask(topRisk, today) : null;
  const topSummary = topRisk ? `${escapeHTML(topRisk.title)} · ${topRiskInfo.label} D+${topRiskInfo.delay}` : '현재 중대 지연 없음';
  const bottleneckSummary = bottleneck ? `병목: ${escapeHTML(bottleneck.title)} · ${bottleneck.dueDate || '마감 미정'}` : '병목 없음';
  if (isRiskPanelCollapsed) {
    panel.className = 'mb-3';
    panel.innerHTML = `
      <div class="rounded-xl border border-rose-100 bg-white px-3 py-2 shadow-sm">
        <div class="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="font-black text-slate-700">Risk</span>
            <span class="rounded-lg bg-rose-50 px-2 py-0.5 font-black text-rose-600">${risky.length}</span>
            <span class="text-slate-400">Critical ${critical}</span>
            <span class="text-slate-400">High ${high}</span>
            <span class="text-slate-400">3일 내 ${dueSoon}</span>
          </div>
          <div class="min-w-0 truncate text-[11px] font-semibold text-slate-500">Top: ${topSummary}${topRisk ? ` / ${bottleneckSummary}` : ''}</div>
        </div>
      </div>`;
    return;
  }
  panel.className = 'mb-3 grid grid-cols-1 gap-2 lg:grid-cols-3';
  panel.innerHTML = `
    <div class="rounded-xl border border-rose-100 bg-white px-3 py-2 shadow-sm">
      <div class="text-[10px] font-bold uppercase text-slate-400">Risk Monitor</div>
      <div class="mt-1 flex items-baseline gap-2"><span class="text-xl font-black text-rose-600">${risky.length}</span><span class="text-[11px] text-slate-400">위험 업무</span></div>
      <div class="text-[10px] text-slate-500">Critical ${critical} · High ${high} · 3일 내 마감 ${dueSoon}</div>
    </div>
    <div class="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
      <div class="text-[10px] font-bold uppercase text-slate-400">Top Bottleneck</div>
      ${topRisk ? `<div class="mt-1 truncate text-xs font-bold text-slate-800">${escapeHTML(topRisk.title)}</div><div class="truncate text-[11px] text-slate-500">${bottleneckSummary} · ${topRiskInfo.label} D+${topRiskInfo.delay}</div>` : '<div class="mt-1 text-xs font-semibold text-emerald-600">현재 중대 지연 없음</div>'}
    </div>
    <div class="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
      <div class="text-[10px] font-bold uppercase text-slate-400">Assignee Risk</div>
      <div class="mt-1 space-y-0.5">${assigneeRows.length ? assigneeRows.map(([name, cnt]) => `<div class="flex items-center justify-between text-[11px]"><span class="truncate text-slate-600">${escapeHTML(name)}</span><span class="font-bold text-rose-600">${cnt}항목</span></div>`).join('') : '<div class="text-xs font-semibold text-emerald-600">담당자별 지연 없음</div>'}</div>
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
  const match = name => {
    const n = normalizeAssigneeName(name);
    return !!n && (n === mine || n.includes(mine) || mine.includes(n));
  };
  return match(task?.assignee) || (Array.isArray(task?.subTasks) ? task.subTasks : []).some(st => match(st.assignee));
}

function getTrackerAssignees() {
  const set = new Set();
  tasks.filter(t => t.trackerId === currentTrackerId && !t.deleted).forEach(t => {
    if (t.assignee) set.add(t.assignee);
    (Array.isArray(t.subTasks) ? t.subTasks : []).forEach(st => { if (st.assignee) set.add(st.assignee); });
  });
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
}
function isAssigneeFilterMatched(task) {
  if (!selectedAssigneeFilters || selectedAssigneeFilters.size === 0) return true;
  const match = name => !!name && selectedAssigneeFilters.has(String(name));
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

function ensureUXToolbar() {
  if (document.getElementById('ux-toolbar')) return;
  const filterBox = document.getElementById('btn-reset-filters')?.closest('.mb-4');
  if (!filterBox) return;
  const bar = document.createElement('div');
  bar.id = 'ux-toolbar';
  bar.className = 'mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4';
  bar.innerHTML = `
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Focus Mode</span>
      <button type="button" id="btn-focus-risk" class="ux-focus-btn rounded-xl border px-3 py-1.5 text-xs font-bold transition">🚨 Risk Only</button>
      <button type="button" id="btn-focus-high" class="ux-focus-btn rounded-xl border px-3 py-1.5 text-xs font-bold transition">🔥 High Priority</button>
      <button type="button" id="btn-open-assignee-modal" class="rounded-xl border border-indigo-100 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-50 transition">👤 담당자: 전체</button>
      <button type="button" id="btn-clear-assignee-filter" class="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-white transition">담당자 해제</button>
    </div>
    <div id="bulk-action-bar" class="hidden flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-2">
      <span id="bulk-selected-count" class="text-xs font-bold text-indigo-700">0개 선택됨</span>
      <button type="button" id="bulk-change-status" class="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">상태 변경</button>
      <button type="button" id="bulk-change-assignee" class="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">담당자 변경</button>
      <button type="button" id="bulk-change-due" class="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">마감일 변경</button>
      <button type="button" id="bulk-clear-selection" class="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-white">선택 해제</button>
    </div>`;
  filterBox.appendChild(bar);
  document.getElementById('btn-focus-risk')?.addEventListener('click', () => toggleFocusMode('riskOnly'));
  document.getElementById('btn-focus-high')?.addEventListener('click', () => toggleFocusMode('highOnly'));
  document.getElementById('btn-open-assignee-modal')?.addEventListener('click', openAssigneeModal);
  document.getElementById('btn-clear-assignee-filter')?.addEventListener('click', clearAssigneeMultiSelect);
  document.getElementById('bulk-change-status')?.addEventListener('click', bulkChangeStatus);
  document.getElementById('bulk-change-assignee')?.addEventListener('click', bulkChangeAssignee);
  document.getElementById('bulk-change-due')?.addEventListener('click', bulkChangeDueDate);
  document.getElementById('bulk-clear-selection')?.addEventListener('click', clearSelection);
  updateFocusButtons();
  updateBulkActionBar();
}
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
  if (!bar || !count) return;
  count.textContent = `${selectedTaskIds.size}개 선택됨`;
  selectedTaskIds.size ? bar.classList.remove('hidden') : bar.classList.add('hidden');
}
function clearSelection() {
  selectedTaskIds.clear();
  renderActiveViews();
  updateBulkActionBar();
}
async function bulkUpdateSelected(payloadBuilder, successMessage) {
  const ids = Array.from(selectedTaskIds || []);
  if (!ids.length) return showToast('선택된 업무가 없습니다.', false);
  for (const id of ids) {
    const payload = typeof payloadBuilder === 'function' ? payloadBuilder(id) : payloadBuilder;
    await db_updateTask(id, payload);
  }
  showToast(successMessage || `${ids.length}개 업무가 일괄 수정되었습니다.`);
  clearSelection();
}
async function bulkChangeStatus() {
  const raw = prompt('변경할 상태를 입력하세요: PENDING, PROGRESS, COMPLETED', 'PROGRESS');
  if (!raw) return;
  const status = raw.trim().toUpperCase();
  if (!['PENDING', 'PROGRESS', 'COMPLETED'].includes(status)) return showToast('상태값은 PENDING, PROGRESS, COMPLETED 중 하나여야 합니다.', false);
  await bulkUpdateSelected({ status }, `선택 업무 상태가 ${getStatusKorean(status)}로 변경되었습니다.`);
}
async function bulkChangeAssignee() {
  const assignee = prompt('변경할 담당자명을 입력하세요.', '');
  if (!assignee || !assignee.trim()) return;
  await bulkUpdateSelected({ assignee: assignee.trim() }, `선택 업무 담당자가 ${assignee.trim()}로 변경되었습니다.`);
}
async function bulkChangeDueDate() {
  const dueDate = prompt('변경할 마감일을 입력하세요. 예: 2026-07-31', getTodayStr());
  if (!dueDate) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) return showToast('마감일 형식은 YYYY-MM-DD 이어야 합니다.', false);
  await bulkUpdateSelected({ dueDate: dueDate.trim() }, `선택 업무 마감일이 ${dueDate.trim()}로 변경되었습니다.`);
}
async function updateTaskTitleInline(id, title) {
  const newTitle = String(title || '').trim();
  const task = tasks.find(t => t.id === id);
  if (!task || !newTitle || newTitle === task.title) return;
  await db_updateTask(id, { title: newTitle });
  showToast('업무명이 빠르게 수정되었습니다.');
}
function handleInlineEditKeydown(e) {
  const el = e.target.closest('.inline-edit-title');
  if (!el) return;
  if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
  if (e.key === 'Escape') { e.preventDefault(); const t = tasks.find(x => x.id === el.dataset.id); if (t) el.textContent = t.title || ''; el.blur(); }
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
  return (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
    ? firebase.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();
}
function canWriteToFirestore() {
  if (!isFirebaseAvailable || !db) return false;
  if (auth && !isAuthReady) {
    showToast('Firebase 인증 준비 중입니다. 잠시 후 다시 시도해 주세요.', false);
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
  const coll = getTrackersCollection();
  if (canWriteToFirestore() && coll) {
    try {
      const batch = db.batch();
      trackers.forEach((t, i) => batch.set(coll.doc(t.id), { order: i + 1, updatedAt: getServerTimestamp() }, { merge: true }));
      await batch.commit();
      markSaved();
    } catch (e) {
      markSaveError();
      console.warn('트래커 순서 저장 실패', e);
      showToast('트래커 순서 저장 실패', false);
    }
  }
  pendingTrackerOrderSignature = null;
  isTrackerOrderSaving = false;
}
async function moveTrackerOrder(id, direction) {
  trackers = sortTrackersByOrder(trackers);
  const idx = trackers.findIndex(t => t.id === id);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || targetIdx < 0 || targetIdx >= trackers.length) return;
  const moved = trackers.splice(idx, 1)[0];
  trackers.splice(targetIdx, 0, moved);
  trackers = normalizeTrackerOrder(trackers);
  updateTrackerUI();
  await saveTrackerOrder();
}
async function moveTaskOrder(id, direction) {
  const scoped = tasks.filter(t => t.trackerId === currentTrackerId).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  scoped.forEach((t, i) => { if (typeof t.order !== 'number') t.order = i + 1; });
  const idx = scoped.findIndex(t => t.id === id);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || targetIdx < 0 || targetIdx >= scoped.length) return;
  const a = scoped[idx];
  const b = scoped[targetIdx];
  const temp = a.order;
  a.order = b.order;
  b.order = temp;
  updateUI();
  await db_updateTask(a.id, { order: a.order });
  await db_updateTask(b.id, { order: b.order });
}

// Task and tracker CRUD helpers moved to js/task-service.js

function getFilteredTasks() {
  const search = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
  const status = document.getElementById('filter-status')?.value || 'ALL';
  const priority = document.getElementById('filter-priority')?.value || 'ALL';
  const assignee = document.getElementById('filter-assignee')?.value || 'ALL';
  const startDate = document.getElementById('filter-start-date')?.value || '';
  const endDate = document.getElementById('filter-end-date')?.value || '';
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
    if (assignee !== 'ALL' && t.assignee !== assignee) return false;
    if (focusState.riskOnly && !isTaskOverdueEffective(t, today)) return false;
    if (focusState.mineOnly && !isMineTask(t)) return false;
    if (focusState.highOnly && t.priority !== 'HIGH') return false;
    if (!isAssigneeFilterMatched(t)) return false;
    if (startDate && (t.dueDate || today) < startDate) return false;
    if (endDate && (t.startDate || today) > endDate) return false;
    return true;
  });
}
function buildAssigneeDropdownFilter() {
  const select = document.getElementById('filter-assignee');
  if (!select) return;
  const currentVal = select.value;
  const assignees = [...new Set(tasks.filter(t => t.trackerId === currentTrackerId && !t.deleted).map(t => t.assignee).filter(Boolean))];
  select.innerHTML = '<option value="ALL">담당자: 전체</option>';
  assignees.forEach(n => { const opt = document.createElement('option'); opt.value = n; opt.textContent = n; select.appendChild(opt); });
  if (assignees.includes(currentVal)) select.value = currentVal;
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
      <div class="flex flex-col py-1 pr-1">
        <button type="button" class="btn-tracker-up text-[10px] text-slate-400 hover:text-indigo-600">▲</button>
        <button type="button" class="btn-tracker-down text-[10px] text-slate-400 hover:text-indigo-600">▼</button>
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
  const overdue = scope.filter(t => isTaskOverdueEffective(t, today)).length;
  const overdueUnits = scope.reduce((sum, t) => sum + countTaskOverdueUnits(t, today), 0);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-total', total); set('stat-pending', pending); set('stat-progress', progress); set('stat-completed', completed); set('stat-overdue', overdue);
  set('stat-pending-pct', total ? Math.round(pending / total * 100) + '%' : '0%');
  set('stat-progress-pct', total ? Math.round(progress / total * 100) + '%' : '0%');
  set('stat-completed-pct', total ? Math.round(completed / total * 100) + '%' : '0%');
  const lbl = document.getElementById('stat-overdue-lbl');
  if (lbl) {
    lbl.textContent = overdue ? `하위 포함 ${overdueUnits}항목` : '매우 양호';
    lbl.className = `text-xs font-medium ${overdue ? 'text-rose-500 font-semibold' : 'text-emerald-500'}`;
  }
  ensureDashboardCompactControls();
  applyCompactDashboardStyles();
  renderRiskDashboard(scope);
  updateDashboardCompactControls();
}

function buildTaskDetailCellHTML(t, subTasks, isExpanded, doneSubs, progressPct, bottleneckHTML) {
  const subInfo = subTasks.length ? ` · 하위 업무 ${doneSubs}/${subTasks.length}` : '';
  return `
      <td class="px-4 py-4 align-top"><div class="flex items-start gap-2">
        <button type="button" class="btn-toggle-subtasks mt-1 shrink-0 text-slate-400 hover:text-indigo-600 ${subTasks.length ? '' : 'invisible'}" data-id="${t.id}">${subTasks.length ? (isExpanded ? '▼' : '▶') : ''}</button>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="inline-edit-title block min-w-0 max-w-full rounded px-1 -mx-1 text-base font-black leading-snug text-slate-900 hover:bg-indigo-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none" contenteditable="true" spellcheck="false" data-id="${t.id}" title="클릭해서 업무명을 바로 수정">${escapeHTML(t.title)}</span>
          </div>
          <div class="mt-1 text-xs text-slate-400">${escapeHTML(t.notes || '추가 지침 없음')} · 진척 ${progressPct}%${subInfo}</div>
          ${bottleneckHTML}
        </div>
      </div></td>`;
}

function subTaskStatusSelect(parentId, subId, status) {
  status = normalizeStatus(status);
  return `
    <select class="sel-subtask-status rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100" data-task-id="${escapeHTML(parentId)}" data-subtask-id="${escapeHTML(subId)}">
      <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>진행 대기</option>
      <option value="PROGRESS" ${status === 'PROGRESS' ? 'selected' : ''}>진행 중</option>
      <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>완료</option>
    </select>`;
}
function renderTable(filtered) {
  const tbody = document.getElementById('task-table-body');
  const emptyState = document.getElementById('empty-state-table');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (filtered.length === 0) {
    emptyState?.classList.replace('hidden', 'flex');
    updateSelectAllState(0, 0);
    return;
  }
  emptyState?.classList.replace('flex', 'hidden');
  filtered.sort((a, b) => {
    const todayStr = getTodayStr();
    const ar = getMaxDelayDays(a, todayStr);
    const br = getMaxDelayDays(b, todayStr);
    if (ar !== br) return br - ar;
    const ae = getEffectiveStatus(a, todayStr) === 'OVERDUE' ? 1 : 0;
    const be = getEffectiveStatus(b, todayStr) === 'OVERDUE' ? 1 : 0;
    if (ae !== be) return be - ae;
    return (a.order ?? 999) - (b.order ?? 999) || String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
  });
  let selectedCount = 0;
  filtered.forEach(t => {
    const subTasks = Array.isArray(t.subTasks) ? t.subTasks : [];
    let isExpanded = expandedTaskIds.has(t.id);
    const checked = selectedTaskIds.has(t.id);
    if (checked) selectedCount++;
    const doneSubs = subTasks.filter(st => st.status === 'COMPLETED').length;
    const subOverdueCount = countOverdueSubTasks(t);
    if (subOverdueCount > 0) isExpanded = true;
    const subOverdueBadge = subOverdueCount ? ` <span class="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 border border-rose-100">하위 기한 초과 ${subOverdueCount}</span>` : '';
    const todayStr = getTodayStr();
    const effectiveStatus = getEffectiveStatus(t, todayStr);
    const progressPct = getTaskProgress(t);
    const riskInfo = getTaskRiskInfo(t, todayStr);
    const bottleneck = getBottleneckSubTask(t, todayStr);
    const timeline = getTimelineStatus(t.dueDate || getTodayStr(), t.status);
    const riskBadge = riskInfo.level !== 'NONE' ? ` <span class="rounded-lg border px-2 py-1 text-[10px] font-bold ${riskInfo.class}">Risk: ${riskInfo.label} D+${riskInfo.delay}</span>` : '';
    const bottleneckHTML = bottleneck ? `<div class="pl-6 text-[11px] text-rose-500 mt-1 font-semibold">🔥 Bottleneck: ${escapeHTML(bottleneck.title)} · ${bottleneck.dueDate || '마감 미정'}</div>` : '';
    const tr = document.createElement('tr');
    tr.className = ['transition-colors group', ['HIGH', 'CRITICAL'].includes(riskInfo.level) ? 'bg-rose-50/70 border-l-4 border-l-rose-500 hover:bg-rose-50' : effectiveStatus === 'OVERDUE' ? 'bg-amber-50/50 border-l-4 border-l-amber-400 hover:bg-amber-50' : 'hover:bg-slate-50'].join(' ');
    tr.title = `Risk: ${riskInfo.label}${riskInfo.delay ? ' D+' + riskInfo.delay : ''} | 운영상태: ${getStatusKorean(effectiveStatus)} | 진척: ${progressPct}%${bottleneck ? ' | Bottleneck: ' + bottleneck.title : ''}`;
    tr.innerHTML = `
      <td class="px-2 py-4 text-center text-slate-400"><button type="button" class="btn-order-up block mx-auto hover:text-indigo-600" data-id="${t.id}">▲</button><button type="button" class="btn-order-down block mx-auto hover:text-indigo-600" data-id="${t.id}">▼</button></td>
      <td class="px-3 py-4 text-center"><input type="checkbox" class="cb-task rounded border-slate-300 cursor-pointer text-indigo-600 focus:ring-indigo-500" data-id="${t.id}" ${checked ? 'checked' : ''}></td>
      ${buildTaskDetailCellHTML(t, subTasks, isExpanded, doneSubs, progressPct, bottleneckHTML)}
      <td class="px-3 py-4 align-top whitespace-nowrap"><div class="inline-flex items-center gap-1.5 whitespace-nowrap"><span class="inline-flex h-7 w-7 items-center justify-center rounded-full ${getAvatarStyle(t.assignee)} text-xs font-bold">${escapeHTML((t.assignee || 'U').charAt(0))}</span><span class="font-semibold">${escapeHTML(t.assignee || '미지정')}</span></div></td>
      <td class="px-3 py-4 align-top whitespace-nowrap"><div class="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-600"><span>${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5)}</span><span class="inline-flex shrink-0 rounded-lg border px-2 py-0.5 text-[11px] ${timeline.class}">${timeline.text}</span></div></td>
      <td class="px-2 py-4 text-center align-top"><span class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold">${getPriorityBadge(t.priority)}</span></td>
      <td class="px-3 py-4 text-center align-top whitespace-nowrap"><div class="mb-1 text-[10px] font-bold text-slate-400 whitespace-nowrap">${getStatusKorean(effectiveStatus)}</div><select class="sel-status rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-500 task-status-compact" data-id="${t.id}"><option value="PENDING" ${t.status === 'PENDING' ? 'selected' : ''}>진행 대기 ⌛</option><option value="PROGRESS" ${t.status === 'PROGRESS' ? 'selected' : ''}>진행 중 ⚙️</option><option value="COMPLETED" ${t.status === 'COMPLETED' ? 'selected' : ''}>완료됨 ⭐️</option></select></td>
      <td class="px-2 py-4 text-center align-top whitespace-nowrap"><button type="button" class="btn-edit text-slate-400 hover:text-indigo-600 px-2" data-id="${t.id}">✎</button><button type="button" class="btn-delete text-slate-400 hover:text-rose-600 px-2" data-id="${t.id}">🗑</button></td>`;
    tbody.appendChild(tr);
    if (subTasks.length && isExpanded) {
      subTasks.forEach(st => {
        const status = normalizeStatus(st.status);
        const subAssignee = st.assignee || t.assignee || '미지정';
        const stTimeline = getSubTaskTimelineStatus(st);
        const sr = document.createElement('tr');
        sr.className = isSubTaskOverdue(st) ? 'bg-rose-50/70 border-l-2 border-l-rose-500/60 hover:bg-rose-50 transition-colors text-xs' : 'bg-slate-50/70 border-l-2 border-l-indigo-500/40 hover:bg-indigo-50/30 transition-colors text-xs';
        sr.innerHTML = `
          <td colspan="2"></td>
          <td class="px-4 py-2 text-slate-600"><div class="flex items-center gap-2 pl-8"><span class="text-slate-300">└─</span><span class="font-semibold ${status === 'COMPLETED' ? 'line-through text-slate-400' : isSubTaskOverdue(st) ? 'text-rose-700' : 'text-slate-700'}">${isSubTaskOverdue(st) ? '🚨 ' : ''}${escapeHTML(st.title)}</span><span class="rounded border border-indigo-100 bg-indigo-50 px-1 py-0.5 text-[10px] font-bold text-indigo-700">👤 ${escapeHTML(subAssignee)}</span></div></td>
          <td class="px-3 py-2 text-center text-slate-400">-</td>
          <td class="px-3 py-2 text-slate-500 whitespace-nowrap"><div class="inline-flex items-center gap-1.5 whitespace-nowrap"><span>📅 ${st.startDate ? st.startDate.substring(5) : '미정'} ~ ${st.dueDate ? st.dueDate.substring(5) : '미정'}</span><span class="inline-flex shrink-0 rounded-lg border px-2 py-0.5 text-[10px] ${stTimeline.class}">${stTimeline.text}</span></div></td>
          <td class="px-4 py-2 text-center text-slate-400">-</td>
          <td class="px-3 py-2 text-center">${subTaskStatusSelect(t.id, st.id, status)}</td>
          <td class="px-2 py-2 text-center text-slate-300">-</td>`;
        tbody.appendChild(sr);
      });
    }
  });
  updateSelectAllState(filtered.length, selectedCount);
}
// Calendar helper functions moved to js/calendar-utils.js
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
  if (titleEl) titleEl.textContent = currentCalMode === 'MONTH' ? `${year}년 전체 Gantt 타임라인` : `${year}년 ${month + 1}월`;

  const groups = filteredTasks.map(t => {
    const start = t.startDate || t.dueDate || todayStr;
    const end = t.dueDate || todayStr;
    const g = {
      id: t.id, title: t.title, startDate: start > end ? end : start, dueDate: end, status: t.status || 'PENDING',
      priority: t.priority || 'NORMAL', industry: t.industry || 'AUTO', taskType: t.taskType || 'GENERAL', assignee: t.assignee || '미지정', notes: t.notes || '', order: t.order ?? 999,
      subTasks: (t.subTasks || []).map(st => {
        const ss = st.startDate || st.dueDate || end;
        const dd = st.dueDate || end;
        return { id: st.id, title: st.title, startDate: ss > dd ? dd : ss, dueDate: dd, status: normalizeStatus(st.status), assignee: st.assignee || t.assignee || '미지정', parentId: t.id, parentTitle: t.title, industry: t.industry || 'AUTO', taskType: t.taskType || 'GENERAL' };
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

  const laneLayout = calendarComputeLaneLayout(groups, { currentCalMode, showSubTaskBars, groupByAssignee: calendarUxState.groupByAssignee, todayStr });
  const lines = laneLayout.lines;
  const totalCalLanes = laneLayout.totalCalLanes;
  const forceTextOnFirstDay = day => day === 1;
  const shouldShowCalendarText = (item, dateStr, isWeekStart, day) => dateStr === item.start || dateStr === item.end || isWeekStart || forceTextOnFirstDay(day) || dateStr === todayStr;
  const addInvisibleCalendarSpacer = container => { const sp = document.createElement('div'); sp.className = 'calendar-lane-spacer min-h-[17px] invisible'; container.appendChild(sp); };
  const isCalendarCriticalItem = item => item?.isSub
    ? isSubTaskOverdue(item, todayStr) || (normalizeStatus(item.status) !== 'COMPLETED' && !!item.dueDate && item.dueDate <= getFutureDateStr(3))
    : getEffectiveStatus(item, todayStr) === 'OVERDUE' || item.priority === 'HIGH' || hasDueSoonRisk(item, todayStr, 3);
  const dimIfNotCritical = item => highlightRiskOnly && !isCalendarCriticalItem(item) ? ' opacity-25 grayscale' : '';
  const mainClass = item => {
    const effective = getEffectiveStatus(item, todayStr);
    if (effective === 'OVERDUE') return 'bg-rose-100 text-rose-800 border border-rose-200 font-semibold';
    if (effective === 'COMPLETED') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    if (useIndustryColor) return getIndustryBarClass(item, false);
    if (effective === 'PROGRESS') return 'bg-blue-100 text-blue-800 border border-blue-200';
    return 'bg-slate-200 text-slate-700';
  };
  const subClass = item => {
    const status = normalizeStatus(item.status);
    if (status === 'COMPLETED') return 'bg-emerald-50/80 text-emerald-800 border border-dashed border-emerald-300';
    if (isSubTaskOverdue(item, todayStr)) return 'bg-rose-50/90 text-rose-800 border border-dashed border-rose-300 font-semibold';
    if (useIndustryColor) return getIndustryBarClass(item, true);
    if (status === 'PROGRESS') return 'bg-blue-50/80 text-blue-800 border border-dashed border-blue-300';
    return 'bg-slate-50 text-slate-700 border border-dashed border-slate-300';
  };

  if (currentCalMode === 'DAY') {
    renderCalendarDayView({ weekdayHeader, grid, year, month, todayStr, totalCalLanes, groups, showSubTaskBars, mainClass, dimIfNotCritical });
    return;
  }
  if (currentCalMode === 'MONTH') {
    renderCalendarMonthView({ weekdayHeader, grid, year, groups, lines, mainClass, subClass, dimIfNotCritical, showSubTaskBars, todayStr });
    return;
  }

  renderCalendarSummaryView({ weekdayHeader, grid, year, month, filteredTasks, todayStr });
}

function getMobilePriorityClass(priority) {
  if (priority === 'HIGH') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (priority === 'LOW') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}
function buildMobileSubTaskHTML(t, subTasks) {
  if (!subTasks.length) return '';
  const isExpanded = expandedTaskIds.has(t.id) || countOverdueSubTasks(t) > 0;
  if (!isExpanded) {
    const done = subTasks.filter(st => normalizeStatus(st.status) === 'COMPLETED').length;
    return `<button type="button" class="btn-toggle-subtasks mt-2 inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 border border-slate-100" data-id="${t.id}">하위 업무 ${done}/${subTasks.length} 펼치기</button>`;
  }
  return `<div class="mt-3 space-y-1.5 border-t border-slate-100 pt-3">${subTasks.map(st => {
    const status = normalizeStatus(st.status);
    const stTimeline = getSubTaskTimelineStatus(st);
    const overdue = isSubTaskOverdue(st);
    return `<div class="rounded-xl border ${overdue ? 'border-rose-100 bg-rose-50/70' : 'border-slate-100 bg-slate-50'} px-3 py-2">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="truncate text-xs font-bold ${status === 'COMPLETED' ? 'line-through text-slate-400' : overdue ? 'text-rose-700' : 'text-slate-700'}">↳ ${overdue ? '🚨 ' : ''}${escapeHTML(st.title || '')}</div>
          <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
            <span class="rounded-md bg-white px-1.5 py-0.5 border border-slate-100">👤 ${escapeHTML(st.assignee || t.assignee || '미지정')}</span>
            <span class="inline-flex items-center gap-1 whitespace-nowrap"><span>📅 ${st.startDate ? st.startDate.substring(5) : '미정'} ~ ${st.dueDate ? st.dueDate.substring(5) : '미정'}</span><span class="inline-flex shrink-0 rounded-md border px-1.5 py-0.5 ${stTimeline.class}">${stTimeline.text}</span></span>
          </div>
        </div>
        <select class="sel-subtask-status mobile-touch-btn shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 outline-none" data-task-id="${escapeHTML(t.id)}" data-subtask-id="${escapeHTML(st.id)}">
          <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>대기</option>
          <option value="PROGRESS" ${status === 'PROGRESS' ? 'selected' : ''}>진행</option>
          <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>완료</option>
        </select>
      </div>
    </div>`;
  }).join('')}</div>`;
}
function renderMobileCards(filtered) {
  const container = document.getElementById('task-card-container');
  const emptyState = document.getElementById('empty-state-mobile');
  if (!container) return;
  container.innerHTML = '';
  if (!filtered || filtered.length === 0) {
    emptyState?.classList.remove('hidden');
    emptyState?.classList.add('flex');
    return;
  }
  emptyState?.classList.add('hidden');
  emptyState?.classList.remove('flex');
  const todayStr = getTodayStr();
  filtered.forEach(t => {
    const subTasks = Array.isArray(t.subTasks) ? t.subTasks : [];
    const effectiveStatus = getEffectiveStatus(t, todayStr);
    const timeline = getTimelineStatus(t.dueDate || getTodayStr(), t.status);
    const riskInfo = getTaskRiskInfo(t, todayStr);
    const progressPct = getTaskProgress(t);
    const subDone = subTasks.filter(st => normalizeStatus(st.status) === 'COMPLETED').length;
    const card = document.createElement('article');
    card.className = `mobile-task-card rounded-2xl border bg-white p-3 shadow-sm ${['HIGH','CRITICAL'].includes(riskInfo.level) ? 'border-rose-200 bg-rose-50/40' : effectiveStatus === 'OVERDUE' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`;
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <button type="button" class="btn-edit block w-full text-left" data-id="${t.id}"><div class="truncate text-sm font-black text-slate-900">${escapeHTML(t.title || '')}</div></button>
          <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span class="rounded-lg bg-slate-50 px-2 py-1 border border-slate-100">👤 ${escapeHTML(t.assignee || '미지정')}</span>
            <span class="rounded-lg border px-2 py-1 font-bold ${getMobilePriorityClass(t.priority)}">${getPriorityBadge(t.priority)}</span>
            <span class="rounded-lg bg-white px-2 py-1 font-bold text-slate-500 border border-slate-100">진척 ${progressPct}%</span>
          </div>
        </div>
        <button type="button" class="btn-delete mobile-touch-btn shrink-0 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-600" data-id="${t.id}">🗑</button>
      </div>
      <div class="mt-3 rounded-xl bg-white/80 border border-slate-100 px-3 py-2">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 overflow-x-auto"><div class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-slate-600"><span class="shrink-0">📅 ${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5) || '미정'}</span><span class="inline-flex shrink-0 rounded-lg border px-2 py-0.5 text-[11px] ${timeline.class}">${timeline.text}</span></div></div>
          <select class="sel-status mobile-touch-btn shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 outline-none" data-id="${t.id}">
            <option value="PENDING" ${t.status === 'PENDING' ? 'selected' : ''}>대기</option><option value="PROGRESS" ${t.status === 'PROGRESS' ? 'selected' : ''}>진행</option><option value="COMPLETED" ${t.status === 'COMPLETED' ? 'selected' : ''}>완료</option>
          </select>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full ${progressPct >= 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-blue-500' : 'bg-slate-300'}" style="width:${progressPct}%"></div></div>
      </div>
      ${(riskInfo.level !== 'NONE') ? `<div class="mt-2 inline-flex rounded-lg border px-2 py-1 text-[11px] font-black ${riskInfo.class}">Risk: ${riskInfo.label} D+${riskInfo.delay}</div>` : ''}
      ${subTasks.length ? `<div class="mt-2 text-[11px] font-semibold text-slate-400">하위 업무 ${subDone}/${subTasks.length}</div>` : ''}
      ${buildMobileSubTaskHTML(t, subTasks)}
      <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <button type="button" class="btn-toggle-subtasks ${subTasks.length ? '' : 'invisible'} mobile-touch-btn rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600" data-id="${t.id}">${expandedTaskIds.has(t.id) ? '하위 접기' : '하위 펼치기'}</button>
        <button type="button" class="btn-edit mobile-touch-btn rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white" data-id="${t.id}">수정</button>
      </div>`;
    container.appendChild(card);
  });
}


function setViewVisibility(mode) {
  const table = document.getElementById('view-table');
  const mobile = document.getElementById('view-mobile');
  const calendar = document.getElementById('view-calendar');
  const isMobile = window.matchMedia ? window.matchMedia('(max-width: 1023px)').matches : window.innerWidth < 1024;

  // Hard reset: prevent Tailwind responsive classes (e.g., lg:block) from overriding visibility.
  if (table) { table.classList.add('hidden'); table.style.display = 'none'; }
  if (mobile) { mobile.classList.add('hidden'); mobile.style.display = 'none'; }
  if (calendar) { calendar.classList.add('hidden'); calendar.style.display = 'none'; }

  if (mode === 'CALENDAR') {
    if (calendar) { calendar.classList.remove('hidden'); calendar.style.display = ''; }
    return;
  }

  // TABLE/LIST mode: desktop gets table, mobile gets card. Never show both.
  if (isMobile) {
    if (mobile) { mobile.classList.remove('hidden'); mobile.style.display = ''; }
  } else {
    if (table) { table.classList.remove('hidden'); table.style.display = ''; }
  }
}
function updateViewToggleButtons(mode) {
  const tableBtn = document.getElementById('btn-view-table');
  const calBtn = document.getElementById('btn-view-calendar');
  if (tableBtn) tableBtn.className = mode === 'CALENDAR'
    ? 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition'
    : 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition';
  if (calBtn) calBtn.className = mode === 'CALENDAR'
    ? 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition'
    : 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition';
}
function switchView(mode) {
  currentViewMode = mode === 'CALENDAR' ? 'CALENDAR' : 'TABLE';
  updateViewToggleButtons(currentViewMode);
  setViewVisibility(currentViewMode);
  renderActiveViews();
}

function renderActiveViews() {
  ensureAdvancedFilterOptions();
  ensureUXToolbar();
  if (typeof focusState === 'undefined') window.focusState = focusState = { riskOnly: false, mineOnly: false, highOnly: false };
  if (typeof UX_STORAGE_KEYS === 'undefined') window.UX_STORAGE_KEYS = UX_STORAGE_KEYS = { myAssignee: 'flow_my_assignee_name' };
  updateFocusButtons();
  updateAssigneeMultiSelect();
  updateBulkActionBar();
  const filtered = getFilteredTasks();
  const fStatus = document.getElementById('filter-status')?.value || 'ALL';
  document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('ring-2', 'ring-indigo-600', 'bg-indigo-50/10'));
  document.getElementById(`card-${['ALL','PENDING','PROGRESS','COMPLETED','OVERDUE'].includes(fStatus) ? fStatus : 'OVERDUE'}`)?.classList.add('ring-2', 'ring-indigo-600', 'bg-indigo-50/10');
  applyCompactDashboardStyles();
  const mode = currentViewMode === 'CALENDAR' ? 'CALENDAR' : 'TABLE';
  setViewVisibility(mode);
  updateViewToggleButtons(mode);
  if (mode === 'CALENDAR') {
    renderCalendar(filtered);
    return;
  }
  renderTable(filtered);
  renderMobileCards(filtered);
}
function updateUI() { renderStats(); buildAssigneeDropdownFilter(); renderActiveViews(); updateUndoButton(); }

function resetSubTaskButton() {
  const btn = document.getElementById('btn-add-subtask');
  if (!btn) return;
  btn.textContent = '추가';
  btn.className = 'rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition shrink-0 ml-auto';
}
function addSubTaskToModalList() {
  const titleInput = document.getElementById('input-subtask-title');
  const assigneeInput = document.getElementById('input-subtask-assignee');
  const startInput = document.getElementById('input-subtask-start');
  const dueInput = document.getElementById('input-subtask-due');
  const title = (titleInput?.value || '').trim();
  if (!title) return;
  const parentAssignee = (document.getElementById('input-task-assignee')?.value || '').trim();
  const assignee = (assigneeInput?.value || '').trim() || parentAssignee || '미지정';
  const payload = { title, assignee, startDate: startInput?.value || getTodayStr(), dueDate: dueInput?.value || getTodayStr() };
  if (editingSubTaskIndex > -1 && currentSubTasks[editingSubTaskIndex]) {
    currentSubTasks[editingSubTaskIndex] = { ...currentSubTasks[editingSubTaskIndex], ...payload, status: normalizeStatus(currentSubTasks[editingSubTaskIndex].status) };
    editingSubTaskIndex = -1;
    resetSubTaskButton();
  } else {
    currentSubTasks.push({ id: 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), status: 'PENDING', ...payload });
  }
  if (titleInput) titleInput.value = '';
  if (assigneeInput) assigneeInput.value = '';
  if (startInput) startInput.value = getTodayStr();
  if (dueInput) dueInput.value = getFutureDateStr(7);
  renderModalSubTasks();
}
function renderModalSubTasks() {
  const container = document.getElementById('subtask-list-container');
  if (!container) return;
  container.innerHTML = '';
  if (!currentSubTasks.length) {
    container.innerHTML = '<li class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">등록된 하위 과제가 없습니다.</li>';
    return;
  }
  currentSubTasks.forEach((st, idx) => {
    const status = normalizeStatus(st.status);
    const overdue = isSubTaskOverdue(st);
    const li = document.createElement('li');
    li.className = 'flex flex-col gap-2 rounded-xl border border-slate-200/60 bg-slate-50 p-2 text-xs hover:bg-slate-100/50 sm:flex-row sm:items-center sm:justify-between';
    li.innerHTML = `<div class="flex min-w-0 flex-1 items-center gap-2"><span class="shrink-0 font-bold ${status === 'COMPLETED' ? 'text-emerald-600' : overdue ? 'text-rose-600' : status === 'PROGRESS' ? 'text-blue-600' : 'text-amber-500'}">${overdue ? '🚨 기한 초과' : getStatusIcon(status) + ' ' + getStatusKorean(status).replace('됨', '')}</span><span class="min-w-0 truncate font-medium text-slate-700 ${status === 'COMPLETED' ? 'line-through opacity-50' : ''}">${escapeHTML(st.title)} <span class="text-[10px] text-slate-400 font-semibold">📅 ${st.startDate ? st.startDate.substring(5) : '미정'} ~ ${st.dueDate ? st.dueDate.substring(5) : '미정'}</span> <span class="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1 py-0.2 rounded text-[9px] font-bold">👤 ${escapeHTML(st.assignee || '미지정')}</span></span></div><div class="flex shrink-0 items-center justify-end gap-1.5"><select class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 outline-none focus:border-indigo-500" onchange="updateSubTaskStatusInModal(${idx}, this.value)"><option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>진행 대기</option><option value="PROGRESS" ${status === 'PROGRESS' ? 'selected' : ''}>진행 중</option><option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>완료</option></select><button type="button" class="px-1 font-bold text-indigo-600 hover:text-indigo-800" onclick="editSubTaskInModal(${idx})">수정</button><span class="text-slate-300">|</span><button type="button" class="px-1 font-semibold text-rose-500 hover:text-rose-700" onclick="removeSubTaskFromModal(${idx})">삭제</button></div>`;
    container.appendChild(li);
  });
}
window.updateSubTaskStatusInModal = function(index, status) {
  if (!currentSubTasks[index]) return;
  currentSubTasks[index].status = normalizeStatus(status);
  renderModalSubTasks();
};
window.editSubTaskInModal = function(index) {
  const st = currentSubTasks[index]; if (!st) return;
  editingSubTaskIndex = index;
  document.getElementById('input-subtask-title').value = st.title || '';
  document.getElementById('input-subtask-assignee').value = st.assignee || '';
  document.getElementById('input-subtask-start').value = st.startDate || '';
  document.getElementById('input-subtask-due').value = st.dueDate || '';
  const btn = document.getElementById('btn-add-subtask');
  if (btn) { btn.textContent = '수정 완료'; btn.className = 'rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition shrink-0 ml-auto'; }
};
window.removeSubTaskFromModal = function(index) {
  currentSubTasks.splice(index, 1);
  if (editingSubTaskIndex === index) { editingSubTaskIndex = -1; resetSubTaskButton(); }
  renderModalSubTasks();
};
function openTaskModal(id = null) {
  document.getElementById('form-task')?.reset();
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setVal('input-subtask-title', ''); setVal('input-subtask-assignee', ''); setVal('input-subtask-start', getTodayStr()); setVal('input-subtask-due', getFutureDateStr(7));
  editingSubTaskIndex = -1; resetSubTaskButton();
  const title = document.getElementById('modal-title');
  if (id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    if (title) title.textContent = '업무 상세 변경';
    setVal('input-task-id', t.id); setVal('input-task-title', t.title || ''); setVal('input-task-assignee', t.assignee || ''); setVal('input-task-start', t.startDate || ''); setVal('input-task-due', t.dueDate || ''); setVal('input-task-priority', t.priority || 'NORMAL'); setVal('input-task-status', t.status || 'PENDING'); setVal('input-task-industry', t.industry || 'AUTO'); setVal('input-task-type', t.taskType || 'GENERAL'); setVal('input-task-notes', t.notes || '');
    const subAssignee = document.getElementById('input-subtask-assignee'); if (subAssignee) subAssignee.placeholder = `담당자 (기본: ${t.assignee || '본 업무 담당자'})`;
    currentSubTasks = Array.isArray(t.subTasks) ? JSON.parse(JSON.stringify(t.subTasks)).map(st => ({ ...st, status: normalizeStatus(st.status) })) : [];
  } else {
    if (title) title.textContent = '새로운 업무 배정';
    setVal('input-task-id', ''); setVal('input-task-start', getTodayStr()); setVal('input-task-due', getFutureDateStr(7)); setVal('input-task-industry', 'AUTO'); setVal('input-task-type', 'GENERAL');
    const subAssignee = document.getElementById('input-subtask-assignee'); if (subAssignee) subAssignee.placeholder = '담당자 (선택)';
    currentSubTasks = [];
  }
  renderModalSubTasks();
  document.getElementById('modal-task')?.classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-task')?.classList.add('hidden'); }
function closeConfirmModal() { document.getElementById('modal-confirm')?.classList.add('hidden'); confirmActionCb = null; }
function openTrackerModal(id = null) {
  document.getElementById('form-tracker')?.reset();
  const del = document.getElementById('btn-delete-tracker');
  if (id) {
    const t = trackers.find(x => x.id === id); if (!t) return;
    document.getElementById('modal-tracker-title').textContent = '트래커 정보 수정';
    document.getElementById('input-tracker-id').value = t.id;
    document.getElementById('input-tracker-name').value = t.name || '';
    document.getElementById('input-tracker-desc').value = t.desc || '';
    del?.classList.remove('hidden');
  } else {
    document.getElementById('modal-tracker-title').textContent = '새 트래커 스페이스 추가';
    document.getElementById('input-tracker-id').value = '';
    del?.classList.add('hidden');
  }
  document.getElementById('tracker-dropdown-menu')?.classList.add('hidden');
  document.getElementById('modal-tracker')?.classList.remove('hidden');
}
function closeTrackerModal() { document.getElementById('modal-tracker')?.classList.add('hidden'); }

async function handleTrackerSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('input-tracker-id').value;
  const data = { name: document.getElementById('input-tracker-name').value.trim(), desc: document.getElementById('input-tracker-desc').value.trim() };
  if (id) { await db_updateTracker(id, data); showToast('트래커가 수정되었습니다.'); }
  else { await db_addTracker(data); showToast('새 트래커 공간이 생성되었습니다.'); }
  closeTrackerModal();
}
async function handleTaskSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('input-task-id').value;
  const start = document.getElementById('input-task-start').value;
  const due = document.getElementById('input-task-due').value;
  if (start && due && start > due) return showToast('시작일은 마감일보다 늦을 수 없습니다.', false);
  let order = 1;
  if (!id) {
    const scoped = tasks.filter(t => t.trackerId === currentTrackerId);
    if (scoped.length) order = Math.max(...scoped.map(t => t.order ?? 0)) + 1;
  }
  const data = {
    trackerId: currentTrackerId,
    title: document.getElementById('input-task-title').value.trim(),
    assignee: document.getElementById('input-task-assignee').value.trim(),
    startDate: start,
    dueDate: due,
    priority: document.getElementById('input-task-priority').value,
    status: document.getElementById('input-task-status').value,
    industry: document.getElementById('input-task-industry')?.value || 'AUTO',
    taskType: document.getElementById('input-task-type')?.value || 'GENERAL',
    notes: document.getElementById('input-task-notes').value.trim(),
    subTasks: currentSubTasks.map(st => ({ ...st, status: normalizeStatus(st.status) }))
  };
  const validationMessage = validateTaskPayload(data);
  if (validationMessage) return showToast(validationMessage, false);
  if (!id) data.order = order;
  if (id) { await db_updateTask(id, data); showToast('수정되었습니다.'); }
  else { await db_addTask(data); showToast('추가되었습니다.'); }
  closeModal();
}
async function updateTaskStatus(id, status) { await db_updateTask(id, { status }); showToast(`상태 변경: ${getStatusKorean(status)}`); }
async function updateSubTaskStatus(parentId, subId, status) {
  const parent = tasks.find(t => t.id === parentId);
  if (!parent || !Array.isArray(parent.subTasks)) return;
  const updated = parent.subTasks.map(st => st.id === subId ? { ...st, status: normalizeStatus(status) } : st);
  await db_updateTask(parentId, { subTasks: updated });
  showToast(`하위 업무 상태 변경: ${getStatusKorean(status)}`);
}
function confirmDelete(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  document.getElementById('confirm-title').textContent = '업무 삭제 알림';
  document.getElementById('confirm-message').innerHTML = `'${escapeHTML(t.title)}' 업무를 삭제하시겠습니까?`;
  confirmActionCb = async () => { await db_deleteTask(id); deletionHistory.push({ timestamp: Date.now(), items: [t] }); closeConfirmModal(); showToast('삭제되었습니다.'); };
  document.getElementById('modal-confirm')?.classList.remove('hidden');
}
function confirmBatchDelete() {
  if (!selectedTaskIds.size) return;
  document.getElementById('confirm-title').textContent = '선택한 업무 일괄 삭제';
  document.getElementById('confirm-message').innerHTML = `선택된 ${selectedTaskIds.size}개의 업무를 삭제하시겠습니까?`;
  confirmActionCb = async () => {
    const deleted = [];
    selectedTaskIds.forEach(id => { const t = tasks.find(x => x.id === id); if (t) deleted.push(t); });
    await db_batchDelete(selectedTaskIds);
    deletionHistory.push({ timestamp: Date.now(), items: deleted });
    closeConfirmModal();
    showToast(`${deleted.length}개 삭제됨.`);
  };
  document.getElementById('modal-confirm')?.classList.remove('hidden');
}
async function undoDelete() {
  if (!deletionHistory.length) return;
  const last = deletionHistory.pop();
  const coll = getTasksCollection();
  if (canWriteToFirestore() && coll) {
    try {
      const batch = db.batch();
      last.items.forEach(t => { const { id, ...data } = t; batch.set(coll.doc(id), { ...data, deleted: false, deletedAt: null, updatedAt: getServerTimestamp() }, { merge: true }); });
      await batch.commit();
    } catch (e) { showToast('Firebase 복원 실패', false); }
  }
  last.items.forEach(t => { if (!tasks.some(x => x.id === t.id)) tasks.push({ ...t, deleted: false, deletedAt: null }); });
  showToast(`${last.items.length}개 복원됨.`);
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
  if (toggle) { const id = toggle.dataset.id; expandedTaskIds.has(id) ? expandedTaskIds.delete(id) : expandedTaskIds.add(id); renderActiveViews(); }
  if (up) moveTaskOrder(up.dataset.id, 'up');
  if (down) moveTaskOrder(down.dataset.id, 'down');
}
function handleTableChange(e) {
  const sel = e.target.closest('.sel-status');
  const subSel = e.target.closest('.sel-subtask-status');
  const cb = e.target.closest('.cb-task');
  if (sel) updateTaskStatus(sel.dataset.id, sel.value);
  if (subSel) updateSubTaskStatus(subSel.dataset.taskId, subSel.dataset.subtaskId, subSel.value);
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
function updateBatchButton() { const btn = document.getElementById('btn-batch-delete'); if (btn) selectedTaskIds.size ? btn.classList.remove('hidden') : btn.classList.add('hidden'); updateBulkActionBar(); }
function updateUndoButton() { const btn = document.getElementById('btn-undo'); if (btn) deletionHistory.length ? btn.classList.remove('hidden') : btn.classList.add('hidden'); }
function resetFilters() {
  ['filter-search', 'filter-start-date', 'filter-end-date'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['filter-status', 'filter-priority', 'filter-assignee'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 'ALL'; });
  renderActiveViews();
}
function handleDeleteTrackerClick() {
  const id = document.getElementById('input-tracker-id').value;
  const t = trackers.find(x => x.id === id); if (!t) return;
  closeTrackerModal();
  document.getElementById('confirm-title').textContent = '트래커 완전 삭제';
  document.getElementById('confirm-message').innerHTML = `정말 '${escapeHTML(t.name)}' 트래커를 삭제하시겠습니까?<br>* 이 트래커 소속의 모든 업무 데이터가 함께 삭제됩니다.`;
  confirmActionCb = async () => { await db_deleteTracker(id); closeConfirmModal(); showToast('트래커 및 소속 데이터가 제거되었습니다.'); };
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
      for (const t of arr) await db_addTask({ ...t, trackerId: currentTrackerId });
      showToast('성공적으로 불러왔습니다.');
    } catch (err) { showToast('읽기 오류 발생', false); }
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
  const overdue = scope.filter(t => isTaskOverdueEffective(t, today)).length;
  return { total, pending, progress, completed, overdue };
}
function relocateHeaderActionsToToolbar() {
  const actionHost = document.getElementById('ux-action-host');
  if (!actionHost) return;
  const items = [
    ['btn-export-csv', 'CSV'],
    ['btn-export-excel', 'Excel'],
    ['btn-export-powerbi', 'Power BI'],
    ['btn-export-json', '백업'],
    ['btn-import-trigger', '가져오기'],
    ['btn-add-task', '+ 새 업무']
  ];
  items.forEach(([id]) => {
    const el = document.getElementById(id);
    if (!el || el.parentElement === actionHost) return;
    el.className = id === 'btn-add-task'
      ? 'control-action-btn inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 whitespace-nowrap'
      : 'control-action-btn inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition whitespace-nowrap';
    actionHost.appendChild(el);
  });
  const originalToolbar = document.querySelector('header .flex.flex-wrap.items-center.gap-2');
  if (originalToolbar && !Array.from(originalToolbar.children).some(ch => ch.id && ['btn-export-csv','btn-export-excel','btn-export-powerbi','btn-export-json','btn-import-trigger','btn-add-task','btn-undo','btn-batch-delete'].includes(ch.id))) {
    originalToolbar.classList.add('hidden');
  }
}
function applyCompactDashboardStyles() {
  const section = document.getElementById('card-ALL')?.parentElement;
  if (!section) return;
  section.id = section.id || 'kpi-dashboard-section';
  const summary = ensureKpiCollapsedSummary(section);
  if (isDashboardCollapsed) {
    const k = getKpiCompactValues();
    section.className = 'hidden';
    summary.className = 'mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm';
    summary.innerHTML = `
      <span class="text-[11px] font-black uppercase tracking-wide text-slate-400">KPI</span>
      <span class="kpi-compact-chip inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 border border-slate-100">전체 <b class="text-slate-900">${k.total}</b></span>
      <span class="kpi-compact-chip inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-100">진행 <b>${k.progress}</b></span>
      <span class="kpi-compact-chip inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-100">완료 <b>${k.completed}</b></span>
      <span class="kpi-compact-chip inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700 border border-rose-100">지연 <b>${k.overdue}</b></span>`;
    return;
  }
  summary.className = 'hidden';
  summary.innerHTML = '';
  section.className = 'mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5';
  document.querySelectorAll('.filter-card').forEach(card => {
    const active = card.classList.contains('ring-2');
    card.className = `filter-card rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm cursor-pointer transition-all duration-150 hover:bg-slate-50 ${active ? 'ring-2 ring-indigo-600 bg-indigo-50/10' : ''}`;
    const label = (card.querySelector('.text-xs.font-semibold') || card.querySelector('.font-bold'));
    if (label) label.className = 'text-[10px] font-bold text-slate-500 uppercase tracking-tight';
    const value = card.querySelector('[id^="stat-"]:not([id$="pct"]):not([id$="lbl"])');
    if (value) value.className = value.id === 'stat-overdue' ? 'text-lg font-black text-rose-600' : 'text-lg font-black text-slate-900';
    card.querySelectorAll('svg').forEach(svg => { svg.classList.remove('h-5','w-5'); svg.classList.add('h-4','w-4'); });
    const numberRow = (card.querySelector('.mt-2.flex') || card.querySelector('.mt-1.flex'));
    if (numberRow) numberRow.className = 'mt-1 flex items-baseline gap-1.5';
  });
}
function ensureDashboardCompactControls() {
  const tracker = document.getElementById('tracker-dropdown-container');
  const section = document.getElementById('card-ALL')?.parentElement;
  if (!tracker || !section) return;
  let controls = document.getElementById('dashboard-compact-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'dashboard-compact-controls';
    controls.innerHTML = `
      <span class="hidden sm:inline text-[11px] font-black uppercase tracking-wide text-slate-400">Insight</span>
      <button type="button" id="btn-toggle-risk-panel" class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-white whitespace-nowrap">Risk 펼치기</button>
      <button type="button" id="btn-toggle-dashboard" class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-white whitespace-nowrap">KPI 접기</button>`;
    tracker.insertAdjacentElement('afterend', controls);
  } else if (controls.previousElementSibling !== tracker) {
    tracker.insertAdjacentElement('afterend', controls);
  }
  controls.className = 'ml-2 mb-1 inline-flex align-middle items-center gap-1.5 rounded-xl border border-slate-100 bg-white px-2 py-1 shadow-sm';
  const riskBtn = document.getElementById('btn-toggle-risk-panel');
  const dashBtn = document.getElementById('btn-toggle-dashboard');
  riskBtn?.replaceWith(riskBtn.cloneNode(true));
  dashBtn?.replaceWith(dashBtn.cloneNode(true));
  document.getElementById('btn-toggle-risk-panel')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleRiskPanelCompact(); });
  document.getElementById('btn-toggle-dashboard')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleDashboardCompact(); });
  updateDashboardCompactControls();
}
function ensureUXToolbar() {
  const filterBox = document.getElementById('btn-reset-filters')?.closest('.mb-4');
  if (!filterBox) return;
  let bar = document.getElementById('ux-toolbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'ux-toolbar';
    bar.className = 'mt-4 border-t border-slate-100 pt-4';
    bar.innerHTML = `
      <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Focus Mode</span>
          <button type="button" id="btn-focus-risk" class="ux-focus-btn rounded-xl border px-3 py-1.5 text-xs font-bold transition">🚨 Risk Only</button>
          <button type="button" id="btn-focus-high" class="ux-focus-btn rounded-xl border px-3 py-1.5 text-xs font-bold transition">🔥 High Priority</button>
          <button type="button" id="btn-open-assignee-modal" class="rounded-xl border border-indigo-100 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-50 transition">👤 담당자: 전체</button>
          <button type="button" id="btn-clear-assignee-filter" class="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-white transition">담당자 해제</button>
        </div>
        <div id="ux-action-host" class="control-hub-actions flex flex-wrap items-center gap-2 lg:justify-end"></div>
      </div>
      <div id="bulk-action-bar" class="hidden mt-3 flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-2">
        <span id="bulk-selected-count" class="text-xs font-bold text-indigo-700">0개 선택됨</span>
        <button type="button" id="bulk-change-status" class="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">상태 변경</button>
        <button type="button" id="bulk-change-assignee" class="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">담당자 변경</button>
        <button type="button" id="bulk-change-due" class="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">마감일 변경</button>
        <button type="button" id="bulk-clear-selection" class="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-white">선택 해제</button>
      </div>`;
    filterBox.appendChild(bar);
    document.getElementById('btn-focus-risk')?.addEventListener('click', () => toggleFocusMode('riskOnly'));
    document.getElementById('btn-focus-high')?.addEventListener('click', () => toggleFocusMode('highOnly'));
    document.getElementById('btn-open-assignee-modal')?.addEventListener('click', openAssigneeModal);
    document.getElementById('btn-clear-assignee-filter')?.addEventListener('click', clearAssigneeMultiSelect);
    document.getElementById('bulk-change-status')?.addEventListener('click', bulkChangeStatus);
    document.getElementById('bulk-change-assignee')?.addEventListener('click', bulkChangeAssignee);
    document.getElementById('bulk-change-due')?.addEventListener('click', bulkChangeDueDate);
    document.getElementById('bulk-clear-selection')?.addEventListener('click', clearSelection);
  }
  relocateHeaderActionsToToolbar();
  updateFocusButtons();
  updateBulkActionBar();
}

document.addEventListener('DOMContentLoaded', () => {
  if (isFirebaseAvailable && auth) {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await auth.signInWithCustomToken(__initial_auth_token);
      else await auth.signInAnonymously();
    };
    initAuth().then(() => auth.onAuthStateChanged(user => { isAuthReady = !!user; if (user) fetchInitialData(); })).catch(e => { console.error('Auth initialization failed', e); updateUI(); });
  } else updateUI();

  const saved = localStorage.getItem('flow_current_tracker');
  if (saved && trackers.some(t => t.id === saved)) currentTrackerId = saved;
  updateTrackerUI();

  document.getElementById('btn-add-task')?.addEventListener('click', () => openTaskModal());
  document.getElementById('btn-export-csv')?.addEventListener('click', exportToCSV);
  document.getElementById('btn-export-excel')?.addEventListener('click', exportToExcel);
  document.getElementById('btn-export-powerbi')?.addEventListener('click', exportPowerBIJSON);
  document.getElementById('btn-export-json')?.addEventListener('click', exportToJSON);
  document.getElementById('btn-undo')?.addEventListener('click', undoDelete);
  document.getElementById('btn-batch-delete')?.addEventListener('click', confirmBatchDelete);
  document.getElementById('btn-import-trigger')?.addEventListener('click', () => document.getElementById('input-import-json')?.click());
  document.getElementById('input-import-json')?.addEventListener('change', importFromJSON);
  document.getElementById('btn-tracker-dropdown')?.addEventListener('click', e => { e.stopPropagation(); document.getElementById('tracker-dropdown-menu')?.classList.toggle('hidden'); });
  document.addEventListener('click', e => { if (!e.target.closest('#tracker-dropdown-container')) document.getElementById('tracker-dropdown-menu')?.classList.add('hidden'); });
  // Risk panel button has its own listener. Do not delegate here, otherwise one click toggles twice.
  document.getElementById('btn-create-tracker-open')?.addEventListener('click', () => openTrackerModal());
  document.getElementById('btn-edit-tracker-open')?.addEventListener('click', () => openTrackerModal(currentTrackerId));
  document.querySelectorAll('.filter-card').forEach(card => card.addEventListener('click', () => { const status = card.getAttribute('data-status'); const el = document.getElementById('filter-status'); if (el) el.value = status; renderActiveViews(); }));
  ['filter-search', 'filter-start-date', 'filter-end-date'].forEach(id => document.getElementById(id)?.addEventListener('input', renderActiveViews));
  ['filter-status', 'filter-priority', 'filter-assignee'].forEach(id => document.getElementById(id)?.addEventListener('change', renderActiveViews));
  document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
  document.getElementById('checkbox-select-all')?.addEventListener('change', toggleSelectAll);
  document.getElementById('task-table-body')?.addEventListener('click', handleTableClick);
  document.getElementById('task-table-body')?.addEventListener('change', handleTableChange);
  document.getElementById('task-card-container')?.addEventListener('click', handleTableClick);
  document.getElementById('task-card-container')?.addEventListener('change', handleTableChange);
  document.getElementById('task-table-body')?.addEventListener('focusout', e => { const el = e.target.closest('.inline-edit-title'); if (el) updateTaskTitleInline(el.dataset.id, el.textContent); });
  document.getElementById('task-table-body')?.addEventListener('keydown', handleInlineEditKeydown);
  document.getElementById('btn-view-table')?.addEventListener('click', () => switchView('TABLE'));
  document.getElementById('btn-view-calendar')?.addEventListener('click', () => switchView('CALENDAR'));
  document.getElementById('btn-cal-mode-day')?.addEventListener('click', () => setCalMode('DAY'));
  document.getElementById('btn-cal-mode-month')?.addEventListener('click', () => setCalMode('MONTH'));
  document.getElementById('btn-cal-mode-summary')?.addEventListener('click', () => setCalMode('SUMMARY'));
  document.getElementById('btn-prev-month')?.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() - 1); renderActiveViews(); });
  document.getElementById('btn-today-month')?.addEventListener('click', () => { currentCalDate = new Date(); renderActiveViews(); });
  document.getElementById('btn-next-month')?.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() + 1); renderActiveViews(); });
  document.getElementById('btn-close-task-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-task')?.addEventListener('click', closeModal);
  document.getElementById('form-task')?.addEventListener('submit', handleTaskSubmit);
  document.getElementById('btn-add-subtask')?.addEventListener('click', addSubTaskToModalList);
  document.getElementById('btn-close-tracker-modal')?.addEventListener('click', closeTrackerModal);
  document.getElementById('btn-cancel-tracker')?.addEventListener('click', closeTrackerModal);
  document.getElementById('form-tracker')?.addEventListener('submit', handleTrackerSubmit);
  document.getElementById('btn-delete-tracker')?.addEventListener('click', handleDeleteTrackerClick);
  document.getElementById('btn-cancel-confirm')?.addEventListener('click', closeConfirmModal);
  document.getElementById('btn-action-confirm')?.addEventListener('click', () => { if (confirmActionCb) confirmActionCb(); });
  window.addEventListener('resize', () => setViewVisibility(currentViewMode === 'CALENDAR' ? 'CALENDAR' : 'TABLE'));
  window.addEventListener('beforeunload', () => { if (typeof unsubscribeTasks === 'function') unsubscribeTasks(); if (typeof unsubscribeTrackers === 'function') unsubscribeTrackers(); });
});
