
console.info('Smart Task Flow app.js v20260625-stable-full-3status loaded');
// This app.js intentionally relies on state.js for global state, getTodayStr(), getFutureDateStr(), escapeHTML(), and AVATAR_COLORS.

function getStatusKorean(status) {
  return ({ PENDING: '진행 대기', PROGRESS: '진행 중', COMPLETED: '완료됨', OVERDUE: '기한 초과' })[status] || '전체';
}
function getPriorityBadge(priority) {
  if (priority === 'HIGH') return '높음';
  if (priority === 'NORMAL') return '보통';
  return '낮음';
}
function getStatusIcon(status) {
  if (status === 'COMPLETED') return '✅';
  if (status === 'PROGRESS') return '⚙️';
  return '⌛';
}
function normalizeStatus(status) {
  return ['PENDING', 'PROGRESS', 'COMPLETED'].includes(status) ? status : 'PENDING';
}
function getAvatarStyle(name) {
  if (!name || !Array.isArray(AVATAR_COLORS)) return 'bg-slate-100 text-slate-700';
  let sum = 0;
  String(name).split('').forEach(ch => sum += ch.charCodeAt(0));
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}
function getDelayDays(dueStr, todayStr = getTodayStr()) {
  if (!dueStr) return 0;
  const diff = Math.ceil((new Date(String(dueStr).replace(/-/g, '/')) - new Date(todayStr.replace(/-/g, '/'))) / 86400000);
  return diff < 0 ? Math.abs(diff) : 0;
}
function getRiskLevelByDelay(days) {
  if (days >= 7) return 'CRITICAL';
  if (days >= 3) return 'HIGH';
  if (days >= 1) return 'LOW';
  return 'NONE';
}
function getRiskLabel(level) {
  return ({ CRITICAL: '긴급', HIGH: '높음', LOW: '주의', NONE: '정상' })[level] || '정상';
}
function getRiskClass(level) {
  return ({
    CRITICAL: 'bg-red-100 text-red-800 border-red-200 font-black',
    HIGH: 'bg-rose-50 text-rose-700 border-rose-100 font-bold',
    LOW: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
    NONE: 'bg-slate-100 text-slate-700 border-slate-200'
  })[level] || 'bg-slate-100 text-slate-700 border-slate-200';
}
function getTimelineStatus(dueStr, status) {
  if (normalizeStatus(status) === 'COMPLETED') return { text: '완료됨', level: 'NONE', class: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  const today = getTodayStr();
  const due = dueStr || today;
  const diff = Math.ceil((new Date(String(due).replace(/-/g, '/')) - new Date(today.replace(/-/g, '/'))) / 86400000);
  if (diff < 0) {
    const level = getRiskLevelByDelay(Math.abs(diff));
    return { text: `기한 초과 (D+${Math.abs(diff)})`, level, class: getRiskClass(level) };
  }
  if (diff === 0) return { text: '오늘 마감', level: 'DUE_TODAY', class: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold' };
  if (diff <= 3) return { text: `임박 D-${diff}`, level: 'DUE_SOON', class: 'bg-orange-50 text-orange-700 border-orange-200 font-semibold' };
  return { text: `D-${diff}`, level: 'NONE', class: 'bg-slate-100 text-slate-700 border-slate-200' };
}

function isSubTaskOverdue(st, todayStr = getTodayStr()) {
  return !!st && normalizeStatus(st.status) !== 'COMPLETED' && !!st.dueDate && String(st.dueDate) < todayStr;
}
function countOverdueSubTasks(task, todayStr = getTodayStr()) {
  return (Array.isArray(task?.subTasks) ? task.subTasks : []).filter(st => isSubTaskOverdue(st, todayStr)).length;
}
function isMainTaskOverdue(task, todayStr = getTodayStr()) {
  return !!task && normalizeStatus(task.status) !== 'COMPLETED' && !!task.dueDate && String(task.dueDate) < todayStr;
}
function isTaskOverdueEffective(task, todayStr = getTodayStr()) {
  return isMainTaskOverdue(task, todayStr) || countOverdueSubTasks(task, todayStr) > 0;
}
function countTaskOverdueUnits(task, todayStr = getTodayStr()) {
  return (isMainTaskOverdue(task, todayStr) ? 1 : 0) + countOverdueSubTasks(task, todayStr);
}
function getSubTaskTimelineStatus(st, todayStr = getTodayStr()) {
  return getTimelineStatus(st?.dueDate || todayStr, normalizeStatus(st?.status));
}

function getMaxDelayDays(task, todayStr = getTodayStr()) {
  const mainDelay = isMainTaskOverdue(task, todayStr) ? getDelayDays(task.dueDate, todayStr) : 0;
  const subDelay = (Array.isArray(task?.subTasks) ? task.subTasks : [])
    .filter(st => isSubTaskOverdue(st, todayStr))
    .reduce((max, st) => Math.max(max, getDelayDays(st.dueDate, todayStr)), 0);
  return Math.max(mainDelay, subDelay);
}
function getTaskRiskInfo(task, todayStr = getTodayStr()) {
  const delay = getMaxDelayDays(task, todayStr);
  const level = getRiskLevelByDelay(delay);
  return { delay, level, label: getRiskLabel(level), class: getRiskClass(level) };
}
function getEffectiveStatus(task, todayStr = getTodayStr()) {
  const status = normalizeStatus(task?.status);
  const subs = Array.isArray(task?.subTasks) ? task.subTasks : [];
  if (status === 'COMPLETED') return 'COMPLETED';
  if (isTaskOverdueEffective(task, todayStr)) return 'OVERDUE';
  if (subs.length && subs.every(st => normalizeStatus(st.status) === 'COMPLETED')) return 'COMPLETED';
  if (status === 'PROGRESS' || subs.some(st => ['PROGRESS', 'COMPLETED'].includes(normalizeStatus(st.status)))) return 'PROGRESS';
  return status;
}
function getTaskProgress(task) {
  const subs = Array.isArray(task?.subTasks) ? task.subTasks : [];
  if (!subs.length) return normalizeStatus(task?.status) === 'COMPLETED' ? 100 : normalizeStatus(task?.status) === 'PROGRESS' ? 50 : 0;
  const done = subs.filter(st => normalizeStatus(st.status) === 'COMPLETED').length;
  return Math.round(done / subs.length * 100);
}
function getBottleneckSubTask(task, todayStr = getTodayStr()) {
  const subs = (Array.isArray(task?.subTasks) ? task.subTasks : []).filter(st => normalizeStatus(st.status) !== 'COMPLETED');
  if (!subs.length) return null;
  return [...subs].sort((a, b) => {
    const ad = isSubTaskOverdue(a, todayStr) ? -getDelayDays(a.dueDate, todayStr) : 0;
    const bd = isSubTaskOverdue(b, todayStr) ? -getDelayDays(b.dueDate, todayStr) : 0;
    if (ad !== bd) return ad - bd;
    return String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31'));
  })[0];
}
function hasDueSoonRisk(task, todayStr = getTodayStr(), days = 3) {
  const inRange = d => !!d && String(d) >= todayStr && String(d) <= getFutureDateStr(days);
  return normalizeStatus(task?.status) !== 'COMPLETED' && (inRange(task?.dueDate) || (Array.isArray(task?.subTasks) ? task.subTasks : []).some(st => normalizeStatus(st.status) !== 'COMPLETED' && inRange(st.dueDate)));
}
function getEffectiveStatusBadge(status) {
  const s = status === 'OVERDUE' ? 'OVERDUE' : normalizeStatus(status);
  const cls = s === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-100' : s === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : s === 'PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-amber-50 text-amber-700 border-amber-100';
  return `<span class="rounded-lg border px-2 py-1 text-[10px] font-bold ${cls}">운영상태: ${getStatusKorean(s)}</span>`;
}
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
  if (document.getElementById('risk-dashboard-panel')) return document.getElementById('risk-dashboard-panel');
  const cards = document.querySelector('section.mb-6.grid');
  if (!cards) return null;
  const panel = document.createElement('section');
  panel.id = 'risk-dashboard-panel';
  panel.className = 'mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3';
  cards.insertAdjacentElement('afterend', panel);
  return panel;
}
function renderRiskDashboard(scope) {
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
  const assigneeRows = Object.entries(byAssignee).sort((a,b) => b[1] - a[1]).slice(0, 5);
  const topRisk = risky[0];
  const topRiskInfo = topRisk ? getTaskRiskInfo(topRisk, today) : null;
  const bottleneck = topRisk ? getBottleneckSubTask(topRisk, today) : null;
  panel.innerHTML = `
    <div class="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
      <div class="text-xs font-bold uppercase text-slate-400">Risk Monitor</div>
      <div class="mt-2 flex items-baseline gap-2"><span class="text-2xl font-black text-rose-600">${risky.length}</span><span class="text-xs text-slate-400">위험 업무</span></div>
      <div class="mt-1 text-[11px] text-slate-500">Critical ${critical} · High ${high} · 3일 내 마감 ${dueSoon}</div>
    </div>
    <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div class="text-xs font-bold uppercase text-slate-400">Top Bottleneck</div>
      ${topRisk ? `<div class="mt-2 text-sm font-bold text-slate-800 truncate">${escapeHTML(topRisk.title)}</div><div class="mt-1 text-xs text-slate-500 truncate">${bottleneck ? `병목: ${escapeHTML(bottleneck.title)} · ${bottleneck.dueDate || '마감 미정'}` : '본 업무 일정 지연'} · ${topRiskInfo.label} D+${topRiskInfo.delay}</div>` : '<div class="mt-2 text-sm font-semibold text-emerald-600">현재 중대 지연 없음</div>'}
    </div>
    <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div class="text-xs font-bold uppercase text-slate-400">Assignee Risk</div>
      <div class="mt-2 space-y-1">${assigneeRows.length ? assigneeRows.map(([name, cnt]) => `<div class="flex items-center justify-between text-xs"><span class="truncate text-slate-600">${escapeHTML(name)}</span><span class="font-bold text-rose-600">${cnt}항목</span></div>`).join('') : '<div class="text-xs font-semibold text-emerald-600">담당자별 지연 없음</div>'}</div>
    </div>`;
}

function normalizeAssigneeName(name) {
  return String(name || '').toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim();
}
function getMyAssigneeName() {
  return localStorage.getItem(UX_STORAGE_KEYS.myAssignee) || 'Booyoul Oh';
}
function setMyAssigneeName() {
  const current = getMyAssigneeName();
  const name = prompt('나의 Task 필터에 사용할 담당자명을 입력하세요. 예: Booyoul Oh 또는 오부열', current);
  if (name && name.trim()) {
    localStorage.setItem(UX_STORAGE_KEYS.myAssignee, name.trim());
    showToast(`나의 담당자명 설정: ${name.trim()}`);
    renderActiveViews();
  }
}
function isMineTask(task) {
  const mine = normalizeAssigneeName(getMyAssigneeName());
  if (!mine) return false;
  const match = name => {
    const n = normalizeAssigneeName(name);
    return n === mine || n.includes(mine) || mine.includes(n);
  };
  return match(task?.assignee) || (Array.isArray(task?.subTasks) ? task.subTasks : []).some(st => match(st.assignee));
}
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
      <button type="button" id="btn-focus-mine" class="ux-focus-btn rounded-xl border px-3 py-1.5 text-xs font-bold transition">👤 My Tasks</button>
      <button type="button" id="btn-focus-high" class="ux-focus-btn rounded-xl border px-3 py-1.5 text-xs font-bold transition">🔥 High Priority</button>
      <button type="button" id="btn-set-my-assignee" class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition">담당자명 설정</button>
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
  document.getElementById('btn-focus-mine')?.addEventListener('click', () => toggleFocusMode('mineOnly'));
  document.getElementById('btn-focus-high')?.addEventListener('click', () => toggleFocusMode('highOnly'));
  document.getElementById('btn-set-my-assignee')?.addEventListener('click', setMyAssigneeName);
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
  const mine = document.getElementById('btn-focus-mine');
  const high = document.getElementById('btn-focus-high');
  if (risk) risk.className = getFocusButtonClass(focusState.riskOnly);
  if (mine) mine.className = getFocusButtonClass(focusState.mineOnly);
  if (high) high.className = getFocusButtonClass(focusState.highOnly);
}
function toggleFocusMode(key) {
  focusState[key] = !focusState[key];
  if (key === 'mineOnly' && focusState.mineOnly && !localStorage.getItem(UX_STORAGE_KEYS.myAssignee)) setMyAssigneeName();
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

async function db_addTask(taskData) {
  const coll = getTasksCollection();
  const id = 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const tracker = trackers.find(t => t.id === currentTrackerId);
  const payload = { ...taskData, trackerId: taskData.trackerId || currentTrackerId, trackerName: tracker ? tracker.name : '', deleted: false, createdAt: getServerTimestamp(), updatedAt: getServerTimestamp() };
  markSaving();
  if (canWriteToFirestore() && coll) {
    try { await coll.doc(id).set(payload, { merge: true }); markSaved(); }
    catch (e) { markSaveError(); console.warn('업무 추가 실패', e); showToast('Firebase 저장 실패', false); }
  }
  if (!tasks.some(t => t.id === id)) tasks.push({ id, ...payload });
  updateUI();
}
async function db_updateTask(id, taskData) {
  const coll = getTasksCollection();
  const tracker = trackers.find(t => t.id === (taskData.trackerId || currentTrackerId));
  const payload = { ...taskData, trackerName: tracker ? tracker.name : taskData.trackerName, updatedAt: getServerTimestamp() };
  markSaving();
  if (canWriteToFirestore() && coll) {
    try { await coll.doc(id).set(payload, { merge: true }); markSaved(); }
    catch (e) { markSaveError(); console.warn('업무 수정 실패', e); showToast('Firebase 수정 실패', false); }
  }
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1) tasks[idx] = { ...tasks[idx], ...payload };
  updateUI();
}
async function db_deleteTask(id) {
  const coll = getTasksCollection();
  const payload = { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() };
  if (canWriteToFirestore() && coll) {
    try { await coll.doc(id).set(payload, { merge: true }); markSaved(); }
    catch (e) { markSaveError(); console.warn('업무 삭제 실패', e); showToast('Firebase 삭제 실패', false); }
  }
  tasks = tasks.filter(t => t.id !== id);
  selectedTaskIds.delete(id);
  updateUI();
}
async function db_batchDelete(idsSet) {
  const ids = Array.from(idsSet || []);
  const coll = getTasksCollection();
  if (canWriteToFirestore() && coll) {
    try {
      const batch = db.batch();
      ids.forEach(id => batch.set(coll.doc(id), { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true }));
      await batch.commit();
      markSaved();
    } catch (e) { markSaveError(); showToast('Firebase 일괄 삭제 실패', false); }
  }
  tasks = tasks.filter(t => !ids.includes(t.id));
  idsSet.clear();
  updateUI();
}
async function db_addTracker(data) {
  const coll = getTrackersCollection();
  const id = 'tracker_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const nextOrder = trackers.length ? Math.max(...trackers.map(t => typeof t.order === 'number' ? t.order : 0)) + 1 : 1;
  const payload = { ...data, order: nextOrder, deleted: false, createdAt: getServerTimestamp(), updatedAt: getServerTimestamp() };
  if (canWriteToFirestore() && coll) {
    try { await coll.doc(id).set(payload, { merge: true }); markSaved(); }
    catch (e) { console.warn('트래커 추가 실패', e); showToast('Firebase 트래커 저장 실패', false); }
  }
  if (!trackers.some(t => t.id === id)) trackers.push({ id, ...payload });
  currentTrackerId = id;
  localStorage.setItem('flow_current_tracker', id);
  updateTrackerUI();
  updateUI();
}
async function db_updateTracker(id, data) {
  const coll = getTrackersCollection();
  const original = trackers.find(t => t.id === id);
  const payload = { ...data, order: original && typeof original.order === 'number' ? original.order : data.order, updatedAt: getServerTimestamp() };
  if (canWriteToFirestore() && coll) {
    try { await coll.doc(id).set(payload, { merge: true }); markSaved(); }
    catch (e) { console.warn('트래커 수정 실패', e); showToast('Firebase 트래커 수정 실패', false); }
  }
  const idx = trackers.findIndex(t => t.id === id);
  if (idx !== -1) trackers[idx] = { ...trackers[idx], ...payload };
  updateTrackerUI();
  updateUI();
}
async function db_deleteTracker(id) {
  const coll = getTrackersCollection();
  const tColl = getTasksCollection();
  if (canWriteToFirestore() && coll) {
    try {
      await coll.doc(id).set({ deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true });
      if (tColl) {
        const snap = await tColl.where('trackerId', '==', id).get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.set(doc.ref, { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true }));
        if (!snap.empty) await batch.commit();
      }
      markSaved();
    } catch (e) { console.warn('트래커 삭제 실패', e); showToast('Firebase 트래커 삭제 실패', false); }
  }
  trackers = trackers.filter(t => t.id !== id);
  tasks = tasks.filter(t => t.trackerId !== id);
  if (!trackers.length) trackers.push({ id: 'tracker-default', name: '기본 업무 트래커', desc: '기본 설정된 초기 공간입니다.', order: 1 });
  currentTrackerId = trackers[0].id;
  localStorage.setItem('flow_current_tracker', currentTrackerId);
  updateTrackerUI();
  updateUI();
}

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
  renderRiskDashboard(scope);
}
function subTaskStatusSelect(parentId, subId, status) {
  status = normalizeStatus(status);
  return `
    <select class="sel-subtask-status rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100" data-task-id="${escapeHTML(parentId)}" data-subtask-id="${escapeHTML(subId)}">
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
      <td class="px-6 py-4"><div class="flex items-center gap-2"><button type="button" class="btn-toggle-subtasks text-slate-400 hover:text-indigo-600 ${subTasks.length ? '' : 'invisible'}" data-id="${t.id}">${subTasks.length ? (isExpanded ? '▼' : '▶') : ''}</button><span class="inline-edit-title font-bold text-slate-900 rounded px-1 -mx-1 hover:bg-indigo-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none" contenteditable="true" spellcheck="false" data-id="${t.id}" title="클릭해서 업무명을 바로 수정">${escapeHTML(t.title)}</span>${subTasks.length ? `<span class="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">하위 업무 ${doneSubs}/${subTasks.length}</span>` : ''}${subOverdueBadge}${getEffectiveStatusBadge(effectiveStatus)}${riskBadge}</div><div class="pl-6 text-xs text-slate-400 mt-1">${escapeHTML(t.notes || '추가 지침 없음')} · 진척 ${progressPct}%</div>${bottleneckHTML}</td>
      <td class="px-6 py-4"><div class="inline-flex items-center gap-2"><span class="inline-flex h-8 w-8 items-center justify-center rounded-full ${getAvatarStyle(t.assignee)} text-xs font-bold">${escapeHTML((t.assignee || 'U').charAt(0))}</span><span class="font-semibold">${escapeHTML(t.assignee || '미지정')}</span></div></td>
      <td class="px-6 py-4"><div class="text-xs font-semibold text-slate-600">${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5)}</div><span class="mt-1 inline-flex rounded-lg border px-2 py-1 text-xs ${timeline.class}">${timeline.text}</span></td>
      <td class="px-4 py-4 text-center"><span class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold">${getPriorityBadge(t.priority)}</span></td>
      <td class="px-6 py-4 text-center"><div class="mb-1 text-[10px] font-bold text-slate-400">${getStatusKorean(effectiveStatus)}</div><select class="sel-status rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-500" data-id="${t.id}"><option value="PENDING" ${t.status === 'PENDING' ? 'selected' : ''}>진행 대기 ⌛</option><option value="PROGRESS" ${t.status === 'PROGRESS' ? 'selected' : ''}>진행 중 ⚙️</option><option value="COMPLETED" ${t.status === 'COMPLETED' ? 'selected' : ''}>완료됨 ⭐️</option></select></td>
      <td class="px-6 py-4 text-center"><button type="button" class="btn-edit text-slate-400 hover:text-indigo-600 px-2" data-id="${t.id}">✎</button><button type="button" class="btn-delete text-slate-400 hover:text-rose-600 px-2" data-id="${t.id}">🗑</button></td>`;
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
          <td class="px-6 py-2 text-slate-600"><div class="flex items-center gap-2 pl-8"><span class="text-slate-300">└─</span><span class="font-semibold ${status === 'COMPLETED' ? 'line-through text-slate-400' : isSubTaskOverdue(st) ? 'text-rose-700' : 'text-slate-700'}">${isSubTaskOverdue(st) ? '🚨 ' : ''}${escapeHTML(st.title)}</span><span class="rounded border border-indigo-100 bg-indigo-50 px-1 py-0.5 text-[10px] font-bold text-indigo-700">👤 ${escapeHTML(subAssignee)}</span></div></td>
          <td class="px-6 py-2 text-center text-slate-400">-</td>
          <td class="px-6 py-2 text-slate-500"><div>📅 ${st.startDate ? st.startDate.substring(5) : '미정'} ~ ${st.dueDate ? st.dueDate.substring(5) : '미정'}</div><span class="mt-1 inline-flex rounded-lg border px-2 py-0.5 text-[10px] ${stTimeline.class}">${stTimeline.text}</span></td>
          <td class="px-4 py-2 text-center text-slate-400">-</td>
          <td class="px-6 py-2 text-center">${subTaskStatusSelect(t.id, st.id, status)}</td>
          <td class="px-6 py-2 text-center text-slate-300">-</td>`;
        tbody.appendChild(sr);
      });
    }
  });
  updateSelectAllState(filtered.length, selectedCount);
}
function dateRangeOverlaps(item, monthStart, monthEnd, fallbackDate) {
  const start = new Date(String(item.startDate || item.dueDate || fallbackDate).replace(/-/g, '/'));
  const end = new Date(String(item.dueDate || item.startDate || fallbackDate).replace(/-/g, '/'));
  return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= monthEnd && end >= monthStart;
}
function getMonthlySubTasks(task, monthStart, monthEnd, todayStr) {
  const allSubTasks = Array.isArray(task.subTasks) ? task.subTasks : [];
  return { allSubTasks, visibleSubTasks: allSubTasks.filter(st => dateRangeOverlaps(st, monthStart, monthEnd, todayStr)) };
}
function buildMonthlySubTaskHTML(task, monthStart, monthEnd, todayStr) {
  const { allSubTasks, visibleSubTasks } = getMonthlySubTasks(task, monthStart, monthEnd, todayStr);
  if (!allSubTasks.length || !visibleSubTasks.length) return '';
  let html = '<div class="mt-2 space-y-1">';
  visibleSubTasks.forEach(st => {
    const status = normalizeStatus(st.status);
    const overdue = isSubTaskOverdue(st, todayStr);
    html += `<div class="truncate text-[10px] ${status === 'COMPLETED' ? 'text-slate-400 line-through' : overdue ? 'text-rose-700 font-semibold' : status === 'PROGRESS' ? 'text-blue-600' : 'text-slate-600'}">${overdue ? '🚨' : getStatusIcon(status)} ${escapeHTML(st.title)} <span class="${overdue ? 'text-rose-500' : 'text-slate-400'}">${st.dueDate ? st.dueDate.substring(5) : ''}</span></div>`;
  });
  const hidden = allSubTasks.length - visibleSubTasks.length;
  if (hidden > 0) html += `<div class="text-[10px] text-slate-400">외 ${hidden}건 숨김</div>`;
  html += '</div>';
  return html;
}
function bindGanttTooltip(el, title, details) {
  const tip = document.getElementById('gantt-tooltip');
  if (!tip || !el) return;
  el.addEventListener('mouseenter', () => {
    tip.innerHTML = `<div class="font-bold mb-1">${escapeHTML(title || '')}</div><div>${String(details || '')}</div>`;
    tip.classList.remove('hidden');
  });
  el.addEventListener('mousemove', e => { tip.style.left = e.clientX + 15 + 'px'; tip.style.top = e.clientY + 15 + 'px'; });
  el.addEventListener('mouseleave', () => tip.classList.add('hidden'));
}
function renderCalendar(filteredTasks) {
  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();
  const grid = document.getElementById('calendar-grid');
  const weekdayHeader = document.getElementById('calendar-weekday-header');
  const titleEl = document.getElementById('calendar-month-year');
  const todayStr = getTodayStr();
  if (!grid) return;
  if (titleEl) titleEl.textContent = currentCalMode === 'MONTH' ? `${year}년 전체 Gantt 타임라인` : `${year}년 ${month + 1}월`;

  const groups = filteredTasks.map(t => {
    const start = t.startDate || t.dueDate || todayStr;
    const end = t.dueDate || todayStr;
    const g = {
      id: t.id, title: t.title, startDate: start > end ? end : start, dueDate: end, status: t.status || 'PENDING',
      priority: t.priority || 'NORMAL', assignee: t.assignee || '미지정', notes: t.notes || '', order: t.order ?? 999,
      subTasks: (t.subTasks || []).map(st => {
        const ss = st.startDate || st.dueDate || end;
        const dd = st.dueDate || end;
        return { id: st.id, title: st.title, startDate: ss > dd ? dd : ss, dueDate: dd, status: normalizeStatus(st.status), assignee: st.assignee || t.assignee || '미지정', parentId: t.id, parentTitle: t.title };
      })
    };
    g.rangeStart = g.startDate; g.rangeEnd = g.dueDate;
    g.subTasks.forEach(st => { if (st.startDate < g.rangeStart) g.rangeStart = st.startDate; if (st.dueDate > g.rangeEnd) g.rangeEnd = st.dueDate; });
    return g;
  }).sort((a, b) => a.order - b.order || a.rangeStart.localeCompare(b.rangeStart));

  const lines = [];
  groups.forEach(g => {
    const need = isCalSubTaskVisible ? 1 + g.subTasks.length : 1;
    let startLine = 0;
    while (true) {
      let overlap = false;
      for (let i = 0; i < need; i++) {
        if (!lines[startLine + i]) lines[startLine + i] = [];
        if (lines[startLine + i].some(o => g.rangeStart <= o.end && o.start <= g.rangeEnd)) { overlap = true; break; }
      }
      if (!overlap) {
        for (let i = 0; i < need; i++) lines[startLine + i].push({ start: g.rangeStart, end: g.rangeEnd });
        g.globalLineStart = startLine;
        break;
      }
      startLine++;
    }
  });
  const mainClass = item => getEffectiveStatus(item, todayStr) === 'OVERDUE' ? 'bg-rose-100 text-rose-800 border border-rose-200 font-semibold' : getEffectiveStatus(item, todayStr) === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : getEffectiveStatus(item, todayStr) === 'PROGRESS' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-slate-200 text-slate-700';
  const subClass = item => normalizeStatus(item.status) === 'COMPLETED' ? 'bg-emerald-50/80 text-emerald-800 border border-dashed border-emerald-300' : isSubTaskOverdue(item, todayStr) ? 'bg-rose-50/90 text-rose-800 border border-dashed border-rose-300 font-semibold' : normalizeStatus(item.status) === 'PROGRESS' ? 'bg-blue-50/80 text-blue-800 border border-dashed border-blue-300' : 'bg-slate-50 text-slate-700 border border-dashed border-slate-300';

  if (currentCalMode === 'DAY') {
    weekdayHeader?.classList.remove('hidden');
    grid.className = 'grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-b-lg overflow-hidden relative z-10';
    grid.innerHTML = '';
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) { const c = document.createElement('div'); c.className = 'bg-slate-50 min-h-[130px] border-r border-b border-slate-100'; grid.appendChild(c); }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const cellIndex = firstDay + day - 1;
      const dayOfWeek = cellIndex % 7;
      const isWeekStart = dayOfWeek === 0;
      const cell = document.createElement('div');
      cell.className = `bg-white min-h-[130px] flex flex-col transition-colors border-r border-b border-slate-100 ${dateStr === todayStr ? 'bg-indigo-50/20' : 'hover:bg-slate-50'}`;
      cell.innerHTML = `<div class="p-1.5"><span class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${dateStr === todayStr ? 'bg-indigo-600 text-white shadow-sm' : dayOfWeek === 0 ? 'text-rose-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-slate-600'}">${day}</span></div>`;
      const taskContainer = document.createElement('div');
      taskContainer.className = 'flex flex-col flex-1 pb-1';
      const items = [];
      groups.forEach(g => {
        if (dateStr >= g.startDate && dateStr <= g.dueDate) items.push({ id: g.id, title: g.title, isSub: false, status: g.status, lane: g.globalLineStart, start: g.startDate, end: g.dueDate, parentId: g.id, assignee: g.assignee, notes: g.notes, dueDate: g.dueDate });
        if (isCalSubTaskVisible) g.subTasks.forEach((st, idx) => { if (dateStr >= st.startDate && dateStr <= st.dueDate) items.push({ ...st, isSub: true, lane: g.globalLineStart + 1 + idx, start: st.startDate, end: st.dueDate, parentId: g.id, parentTitle: g.title }); });
      });
      const maxLane = Math.max(...items.map(x => x.lane), -1);
      for (let lane = 0; lane <= maxLane; lane++) {
        const item = items.find(x => x.lane === lane);
        if (!item) { const sp = document.createElement('div'); sp.className = 'h-[22px] mb-1'; taskContainer.appendChild(sp); continue; }
        const isStart = dateStr === item.start;
        const isEnd = dateStr === item.end;
        const showText = isStart || isWeekStart;
        let shape = 'h-[22px] flex items-center mb-1 shadow-sm';
        if (isStart && isEnd) shape += ' rounded mx-1 px-1.5';
        else if (isStart) shape += ' rounded-l ml-1 mr-0 pr-0 pl-1.5';
        else if (isEnd) shape += ' rounded-r mr-1 ml-0 pl-0 pr-1.5';
        else shape += ' mx-0 px-0 rounded-none';
        if (!isStart && !isWeekStart) shape += ' -ml-[1px] relative z-10';
        const el = document.createElement('div');
        el.className = `text-[10px] font-semibold cursor-pointer transition-all hover:scale-[1.02] ${item.isSub ? subClass(item) : mainClass(item)} ${shape}`;
        el.onclick = () => openTaskModal(item.parentId);
        bindGanttTooltip(el, item.title, item.isSub ? `[하위업무] 상위: ${escapeHTML(item.parentTitle)}<br>담당자: ${escapeHTML(item.assignee)}<br>기간: ${item.start} ~ ${item.end}<br>상태: ${getStatusKorean(item.status)}` : `[본업무] 담당자: ${escapeHTML(item.assignee)}<br>기간: ${item.start} ~ ${item.end}<br>메모: ${escapeHTML(item.notes || '없음')}`);
        if (showText) {
          const txt = document.createElement('div');
          txt.className = 'truncate w-full whitespace-nowrap z-20';
          txt.innerHTML = item.isSub ? `${isSubTaskOverdue(item, todayStr) ? '🚨' : getStatusIcon(item.status)} ↳ 👤 ${escapeHTML(item.assignee)} | ${escapeHTML(item.title)}` : `${getEffectiveStatus(item, todayStr) === 'OVERDUE' ? '🚨' : getEffectiveStatus(item, todayStr) === 'COMPLETED' ? '⭐️' : getEffectiveStatus(item, todayStr) === 'PROGRESS' ? '⚙️' : '⌛'} ${escapeHTML(item.title)}`;
          el.appendChild(txt);
        }
        taskContainer.appendChild(el);
      }
      cell.appendChild(taskContainer);
      grid.appendChild(cell);
    }
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 0; i < remaining; i++) { const c = document.createElement('div'); c.className = 'bg-slate-50 min-h-[130px] border-r border-b border-slate-100'; grid.appendChild(c); }
    return;
  }

  if (currentCalMode === 'MONTH') {
    weekdayHeader?.classList.add('hidden');
    grid.className = 'relative bg-white border border-slate-200 rounded-xl overflow-hidden';
    grid.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'grid grid-cols-12 gap-px bg-slate-50 relative z-20 border-b border-slate-200/80 shadow-sm';
    for (let m = 1; m <= 12; m++) { const h = document.createElement('div'); h.className = 'py-3 text-center text-xs font-bold text-slate-700'; h.textContent = `${m}월`; header.appendChild(h); }
    grid.appendChild(header);
    const body = document.createElement('div');
    body.className = 'relative z-10 w-full';
    const tiles = document.createElement('div');
    tiles.className = 'grid grid-cols-12 gap-px bg-slate-100/50';
    const rowHeight = 28;
    const totalLines = lines.length > 5 ? lines.length : 5;
    const bodyHeight = totalLines * rowHeight + 20;
    for (let i = 0; i < 12; i++) { const tile = document.createElement('div'); tile.className = 'bg-white border-b border-slate-100'; tile.style.height = `${bodyHeight}px`; tiles.appendChild(tile); }
    body.appendChild(tiles);
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 pointer-events-none';
    groups.forEach(g => {
      const startD = new Date(g.rangeStart.replace(/-/g, '/'));
      const endD = new Date(g.rangeEnd.replace(/-/g, '/'));
      if (startD.getFullYear() > year || endD.getFullYear() < year) return;
      const taskStart = new Date(g.startDate.replace(/-/g, '/'));
      const taskEnd = new Date(g.dueDate.replace(/-/g, '/'));
      const startMonth = taskStart.getFullYear() < year ? 0 : taskStart.getMonth();
      const endMonth = taskEnd.getFullYear() > year ? 11 : taskEnd.getMonth();
      const bar = document.createElement('div');
      bar.className = `absolute h-5 rounded-lg shadow-sm text-[10.5px] font-bold flex items-center px-2 cursor-pointer transition-all hover:scale-[1.01] pointer-events-auto truncate z-10 ${mainClass(g)}`;
      bar.style.left = `calc(${startMonth / 12 * 100}% + 4px)`;
      bar.style.width = `calc(${(endMonth - startMonth + 1) / 12 * 100}% - 8px)`;
      bar.style.top = `${g.globalLineStart * rowHeight + 10}px`;
      bar.onclick = () => openTaskModal(g.id);
      bar.innerHTML = `${getEffectiveStatus(g, todayStr) === 'OVERDUE' ? '🚨' : getEffectiveStatus(g, todayStr) === 'COMPLETED' ? '⭐️' : getEffectiveStatus(g, todayStr) === 'PROGRESS' ? '⚙️' : '⌛'} ${escapeHTML(g.title)}`;
      bindGanttTooltip(bar, g.title, `담당자: ${escapeHTML(g.assignee)}<br>기간: ${g.startDate} ~ ${g.dueDate}<br>설명: ${escapeHTML(g.notes || '없음')}`);
      overlay.appendChild(bar);
      if (isCalSubTaskVisible) {
        g.subTasks.forEach((st, idx) => {
          const stStart = new Date(st.startDate.replace(/-/g, '/'));
          const stEnd = new Date(st.dueDate.replace(/-/g, '/'));
          if (stStart.getFullYear() > year || stEnd.getFullYear() < year) return;
          const sm = stStart.getFullYear() < year ? 0 : stStart.getMonth();
          const em = stEnd.getFullYear() > year ? 11 : stEnd.getMonth();
          const sb = document.createElement('div');
          sb.className = `absolute h-5 rounded-lg shadow-sm text-[9.5px] font-bold flex items-center px-1.5 cursor-pointer transition-all hover:scale-[1.01] pointer-events-auto truncate ${subClass(st)}`;
          sb.style.left = `calc(${sm / 12 * 100}% + 4px)`;
          sb.style.width = `calc(${(em - sm + 1) / 12 * 100}% - 8px)`;
          sb.style.top = `${(g.globalLineStart + 1 + idx) * rowHeight + 10}px`;
          sb.onclick = () => openTaskModal(g.id);
          sb.innerHTML = `${isSubTaskOverdue(st, todayStr) ? '🚨' : getStatusIcon(st.status)} ↳ 👤 ${escapeHTML(st.assignee)} | ${escapeHTML(st.title)}`;
          bindGanttTooltip(sb, st.title, `상위 업무: ${escapeHTML(g.title)}<br>담당자: ${escapeHTML(st.assignee)}<br>기간: ${st.startDate} ~ ${st.dueDate}<br>상태: ${getStatusKorean(st.status)}`);
          overlay.appendChild(sb);
        });
      }
    });
    body.appendChild(overlay);
    grid.appendChild(body);
    return;
  }

  weekdayHeader?.classList.add('hidden');
  grid.className = 'flex flex-col gap-4 bg-slate-50 border border-slate-100 p-5 rounded-xl min-h-[250px]';
  grid.innerHTML = '';
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  const monthTasks = filteredTasks.filter(t => dateRangeOverlaps(t, monthStart, monthEnd, todayStr));
  if (!monthTasks.length) { grid.innerHTML = `<div class="text-sm text-slate-400">현재 조건 혹은 조회 기간 중 해당 월(${month + 1}월)의 업무 정보가 존재하지 않습니다.</div>`; return; }
  const cats = { OVERDUE: [], PROGRESS: [], PENDING: [], COMPLETED: [] };
  monthTasks.forEach(t => { const es = getEffectiveStatus(t, todayStr); if (es === 'OVERDUE') cats.OVERDUE.push(t); else cats[es || 'PENDING'].push(t); });
  const total = monthTasks.length;
  const done = cats.COMPLETED.length;
  const overdue = monthTasks.reduce((sum, t) => sum + countTaskOverdueUnits(t, todayStr), 0);
  const subTotal = monthTasks.reduce((sum, t) => sum + ((t.subTasks || []).length), 0);
  const subDone = monthTasks.reduce((sum, t) => sum + ((t.subTasks || []).filter(st => st.status === 'COMPLETED').length), 0);
  const panel = document.createElement('div');
  panel.className = 'grid grid-cols-2 md:grid-cols-4 gap-3';
  panel.innerHTML = `<div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">월간 업무</div><div class="text-xl font-bold">${total}</div><div class="text-[10px] text-slate-400">진행 ${cats.PROGRESS.length} · 대기 ${cats.PENDING.length}</div></div><div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">완료율</div><div class="text-xl font-bold">${Math.round(done / total * 100)}%</div><div class="text-[10px] text-slate-400">완료 ${done}/${total}</div></div><div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">지연율</div><div class="text-xl font-bold text-rose-600">${Math.round(overdue / Math.max(total + subTotal, 1) * 100)}%</div><div class="text-[10px] text-slate-400">지연 ${overdue}/${total + subTotal}</div></div><div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">하위 업무 완료</div><div class="text-xl font-bold">${subDone}/${subTotal}</div></div>`;
  grid.appendChild(panel);
  [
    { key: 'OVERDUE', label: '🚨 일정 초과 및 지연 상태', style: 'bg-rose-50/75 border-rose-100 text-rose-800' },
    { key: 'PROGRESS', label: '⚙️ 현재 적극 진행 중', style: 'bg-blue-50/75 border-blue-100 text-blue-800' },
    { key: 'PENDING', label: '⌛ 대기 및 진행 준비 중', style: 'bg-amber-50/75 border-amber-100 text-amber-800' },
    { key: 'COMPLETED', label: '⭐️ 정상 완료 항목', style: 'bg-emerald-50/75 border-emerald-100 text-emerald-800' }
  ].forEach(cat => {
    if (!cats[cat.key].length) return;
    const sec = document.createElement('div');
    sec.className = `rounded-xl border p-4 ${cat.style}`;
    sec.innerHTML = `<h4 class="font-bold mb-3">${cat.label} <span class="text-xs opacity-70">${cats[cat.key].length}건</span></h4>`;
    const cards = document.createElement('div');
    cards.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5';
    cats[cat.key].forEach(t => {
      const { allSubTasks, visibleSubTasks } = getMonthlySubTasks(t, monthStart, monthEnd, todayStr);
      const subOverdueCount = countOverdueSubTasks(t, todayStr);
      const badge = allSubTasks.length ? `<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">하위 ${visibleSubTasks.length}/${allSubTasks.length}</span>${subOverdueCount ? ` <span class="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-100">하위 초과 ${subOverdueCount}</span>` : ''}` : '';
      const card = document.createElement('div');
      card.className = 'bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm cursor-pointer transition hover:border-indigo-400 hover:shadow-md';
      card.onclick = () => openTaskModal(t.id);
      card.innerHTML = `<div class="font-bold text-sm text-slate-800">${escapeHTML(t.title)}</div><div class="mt-1 text-xs text-slate-500">${badge} 🗓️ ${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5)} · ${escapeHTML(t.assignee || '미지정')}</div>${buildMonthlySubTaskHTML(t, monthStart, monthEnd, todayStr)}`;
      cards.appendChild(card);
    });
    sec.appendChild(cards);
    grid.appendChild(sec);
  });
}
function renderActiveViews() {
  ensureAdvancedFilterOptions();
  ensureUXToolbar();
  updateFocusButtons();
  updateBulkActionBar();
  const filtered = getFilteredTasks();
  const fStatus = document.getElementById('filter-status')?.value || 'ALL';
  document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('ring-2', 'ring-indigo-600', 'bg-indigo-50/10'));
  document.getElementById(`card-${['ALL','PENDING','PROGRESS','COMPLETED','OVERDUE'].includes(fStatus) ? fStatus : 'OVERDUE'}`)?.classList.add('ring-2', 'ring-indigo-600', 'bg-indigo-50/10');
  renderTable(filtered);
  if (currentViewMode === 'CALENDAR') renderCalendar(filtered);
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
    setVal('input-task-id', t.id); setVal('input-task-title', t.title || ''); setVal('input-task-assignee', t.assignee || ''); setVal('input-task-start', t.startDate || ''); setVal('input-task-due', t.dueDate || ''); setVal('input-task-priority', t.priority || 'NORMAL'); setVal('input-task-status', t.status || 'PENDING'); setVal('input-task-notes', t.notes || '');
    const subAssignee = document.getElementById('input-subtask-assignee'); if (subAssignee) subAssignee.placeholder = `담당자 (기본: ${t.assignee || '본 업무 담당자'})`;
    currentSubTasks = Array.isArray(t.subTasks) ? JSON.parse(JSON.stringify(t.subTasks)).map(st => ({ ...st, status: normalizeStatus(st.status) })) : [];
  } else {
    if (title) title.textContent = '새로운 업무 배정';
    setVal('input-task-id', ''); setVal('input-task-start', getTodayStr()); setVal('input-task-due', getFutureDateStr(7));
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
    notes: document.getElementById('input-task-notes').value.trim(),
    subTasks: currentSubTasks.map(st => ({ ...st, status: normalizeStatus(st.status) }))
  };
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
function exportToJSON() {
  const data = tasks.filter(t => t.trackerId === currentTrackerId);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 4));
  a.download = `backup_${getTodayStr()}.json`;
  a.click();
}
function exportToCSV() {
  let csv = '\uFEFF업무명,담당자,시작일,마감일,우선순위,상태,세부메모\n';
  tasks.filter(t => t.trackerId === currentTrackerId).forEach(t => {
    csv += `"${(t.title || '').replace(/"/g, '""')}","${(t.assignee || '').replace(/"/g, '""')}","${t.startDate || ''}","${t.dueDate || ''}","${getPriorityBadge(t.priority)}","${getStatusKorean(t.status)}","${(t.notes || '').replace(/"/g, '""')}"\n`;
  });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `export_${getTodayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
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
  const wrapper = document.getElementById('toggle-subtask-cal-wrapper');
  if (wrapper) {
    if (mode === 'DAY' || mode === 'MONTH') { wrapper.classList.remove('hidden'); wrapper.classList.add('inline-flex'); }
    else { wrapper.classList.add('hidden'); wrapper.classList.remove('inline-flex'); }
  }
  renderActiveViews();
}
async function ensureDefaultTrackersInFirestore() {
  if (!isFirebaseAvailable || !db) return;
  const coll = getTrackersCollection(); if (!coll) return;
  try {
    for (let i = 0; i < trackers.length; i++) {
      const t = trackers[i]; if (!t || !t.id) continue;
      const snap = await coll.doc(t.id).get();
      if (!snap.exists) await coll.doc(t.id).set({ name: t.name, desc: t.desc || '', order: t.order || i + 1, deleted: false, createdAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true });
    }
  } catch (e) { console.warn('기본 트래커 보정 실패', e); }
}
function setupRealtimeListeners() {
  if (!isFirebaseAvailable || !db) return false;
  const trackerColl = getTrackersCollection();
  const taskColl = getTasksCollection();
  if (!trackerColl || !taskColl) return false;
  if (typeof unsubscribeTrackers === 'function') unsubscribeTrackers();
  if (typeof unsubscribeTasks === 'function') unsubscribeTasks();
  unsubscribeTrackers = trackerColl.onSnapshot(snapshot => {
    const incoming = sortTrackersByOrder(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(t => t.deleted !== true));
    if (incoming.length) trackers = incoming;
    const saved = localStorage.getItem('flow_current_tracker');
    if (saved && trackers.some(t => t.id === saved)) currentTrackerId = saved;
    else if (!trackers.some(t => t.id === currentTrackerId) && trackers[0]) currentTrackerId = trackers[0].id;
    updateTrackerUI();
    updateUI();
  }, err => { console.error('트래커 동기화 오류', err); showToast('트래커 실시간 동기화 오류', false); });
  unsubscribeTasks = taskColl.onSnapshot(snapshot => {
    tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(t => t.deleted !== true);
    updateTrackerUI();
    updateUI();
  }, err => { console.error('업무 동기화 오류', err); showToast('업무 실시간 동기화 오류', false); });
  return true;
}
async function fetchInitialData() { await ensureDefaultTrackersInFirestore(); if (!setupRealtimeListeners()) updateUI(); }

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
  document.getElementById('btn-export-json')?.addEventListener('click', exportToJSON);
  document.getElementById('btn-undo')?.addEventListener('click', undoDelete);
  document.getElementById('btn-batch-delete')?.addEventListener('click', confirmBatchDelete);
  document.getElementById('btn-import-trigger')?.addEventListener('click', () => document.getElementById('input-import-json')?.click());
  document.getElementById('input-import-json')?.addEventListener('change', importFromJSON);
  document.getElementById('btn-tracker-dropdown')?.addEventListener('click', e => { e.stopPropagation(); document.getElementById('tracker-dropdown-menu')?.classList.toggle('hidden'); });
  document.addEventListener('click', e => { if (!e.target.closest('#tracker-dropdown-container')) document.getElementById('tracker-dropdown-menu')?.classList.add('hidden'); });
  document.getElementById('btn-create-tracker-open')?.addEventListener('click', () => openTrackerModal());
  document.getElementById('btn-edit-tracker-open')?.addEventListener('click', () => openTrackerModal(currentTrackerId));
  document.querySelectorAll('.filter-card').forEach(card => card.addEventListener('click', () => { const status = card.getAttribute('data-status'); const el = document.getElementById('filter-status'); if (el) el.value = status; renderActiveViews(); }));
  ['filter-search', 'filter-start-date', 'filter-end-date'].forEach(id => document.getElementById(id)?.addEventListener('input', renderActiveViews));
  ['filter-status', 'filter-priority', 'filter-assignee'].forEach(id => document.getElementById(id)?.addEventListener('change', renderActiveViews));
  document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
  document.getElementById('checkbox-select-all')?.addEventListener('change', toggleSelectAll);
  document.getElementById('task-table-body')?.addEventListener('click', handleTableClick);
  document.getElementById('task-table-body')?.addEventListener('change', handleTableChange);
  document.getElementById('task-table-body')?.addEventListener('focusout', e => { const el = e.target.closest('.inline-edit-title'); if (el) updateTaskTitleInline(el.dataset.id, el.textContent); });
  document.getElementById('task-table-body')?.addEventListener('keydown', handleInlineEditKeydown);
  document.getElementById('btn-view-table')?.addEventListener('click', () => { currentViewMode = 'TABLE'; document.getElementById('btn-view-table').className = 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition'; document.getElementById('btn-view-calendar').className = 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition'; document.getElementById('view-table')?.classList.remove('hidden'); document.getElementById('view-calendar')?.classList.add('hidden'); renderActiveViews(); });
  document.getElementById('btn-view-calendar')?.addEventListener('click', () => { currentViewMode = 'CALENDAR'; document.getElementById('btn-view-calendar').className = 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition'; document.getElementById('btn-view-table').className = 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition'; document.getElementById('view-table')?.classList.add('hidden'); document.getElementById('view-calendar')?.classList.remove('hidden'); renderActiveViews(); });
  document.getElementById('btn-cal-mode-day')?.addEventListener('click', () => setCalMode('DAY'));
  document.getElementById('btn-cal-mode-month')?.addEventListener('click', () => setCalMode('MONTH'));
  document.getElementById('btn-cal-mode-summary')?.addEventListener('click', () => setCalMode('SUMMARY'));
  document.getElementById('cb-show-subtasks-cal')?.addEventListener('change', e => { isCalSubTaskVisible = e.target.checked; renderActiveViews(); });
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
  window.addEventListener('beforeunload', () => { if (typeof unsubscribeTasks === 'function') unsubscribeTasks(); if (typeof unsubscribeTrackers === 'function') unsubscribeTrackers(); });
});
