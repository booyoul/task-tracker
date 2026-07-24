console.info('Smart Task Flow modal-controller.js v20260724-v4 loaded');
// Task modal, subtask modal list, tracker modal, and form submit handlers.
function resetSubTaskButton() {
  const btn = document.getElementById('btn-add-subtask');
  if (!btn) return;
  btn.textContent = '추가';
  btn.className = 'rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition shrink-0 ml-auto';
}
const SUBTASK_RECURRENCE_LABELS = {
  DAILY: '매일',
  WEEKLY: '매주',
  MONTHLY: '매월',
  QUARTERLY: '분기',
  YEARLY: '매년'
};
const SUBTASK_WEEKDAY_LABELS = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
  SUN: '일'
};
const SUBTASK_RECURRENCE_INTERVAL_UNITS = {
  DAILY: '일',
  WEEKLY: '주',
  MONTHLY: '개월',
  QUARTERLY: '분기',
  YEARLY: '년'
};
function updateSubTaskRecurrenceControls() {
  const enabled = document.getElementById('input-subtask-recurrence-enabled')?.checked === true;
  const frequency = document.getElementById('input-subtask-recurrence-frequency')?.value || 'WEEKLY';
  const endType = document.getElementById('input-subtask-recurrence-end-type')?.value || 'NONE';
  document.getElementById('subtask-recurrence-options')?.classList.toggle('hidden', !enabled);
  document.getElementById('subtask-recurrence-weekdays')?.classList.toggle('hidden', !enabled || frequency !== 'WEEKLY');
  document.getElementById('input-subtask-recurrence-until')?.classList.toggle('hidden', !enabled || endType !== 'UNTIL');
  document.getElementById('input-subtask-recurrence-count')?.classList.toggle('hidden', !enabled || endType !== 'COUNT');
}
function bindSubTaskRecurrenceControls() {
  if (window.__subTaskRecurrenceControlsBound) return;
  window.__subTaskRecurrenceControlsBound = true;
  ['input-subtask-recurrence-enabled', 'input-subtask-recurrence-frequency', 'input-subtask-recurrence-end-type'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateSubTaskRecurrenceControls);
  });
}
function resetSubTaskRecurrenceForm() {
  const enabled = document.getElementById('input-subtask-recurrence-enabled');
  const frequency = document.getElementById('input-subtask-recurrence-frequency');
  const interval = document.getElementById('input-subtask-recurrence-interval');
  const endType = document.getElementById('input-subtask-recurrence-end-type');
  const until = document.getElementById('input-subtask-recurrence-until');
  const count = document.getElementById('input-subtask-recurrence-count');
  if (enabled) enabled.checked = false;
  if (frequency) frequency.value = 'WEEKLY';
  if (interval) interval.value = '1';
  if (endType) endType.value = 'NONE';
  if (until) until.value = '';
  if (count) count.value = '';
  document.querySelectorAll('.subtask-recurrence-day').forEach(cb => { cb.checked = false; });
  updateSubTaskRecurrenceControls();
}
function setSubTaskRecurrenceForm(recurrence = null) {
  resetSubTaskRecurrenceForm();
  if (!recurrence || recurrence.enabled !== true) return;
  const enabled = document.getElementById('input-subtask-recurrence-enabled');
  const frequency = document.getElementById('input-subtask-recurrence-frequency');
  const interval = document.getElementById('input-subtask-recurrence-interval');
  const endType = document.getElementById('input-subtask-recurrence-end-type');
  const until = document.getElementById('input-subtask-recurrence-until');
  const count = document.getElementById('input-subtask-recurrence-count');
  if (enabled) enabled.checked = true;
  if (frequency) frequency.value = recurrence.frequency || 'WEEKLY';
  if (interval) interval.value = recurrence.interval || '1';
  if (endType) endType.value = recurrence.endType || 'NONE';
  if (until) until.value = recurrence.until || '';
  if (count) count.value = recurrence.count || '';
  const days = Array.isArray(recurrence.byDay) ? recurrence.byDay : [];
  document.querySelectorAll('.subtask-recurrence-day').forEach(cb => { cb.checked = days.includes(cb.value); });
  updateSubTaskRecurrenceControls();
}
function getSubTaskRecurrenceFromForm() {
  const enabled = document.getElementById('input-subtask-recurrence-enabled')?.checked === true;
  if (!enabled) return null;
  const frequency = document.getElementById('input-subtask-recurrence-frequency')?.value || 'WEEKLY';
  const endType = document.getElementById('input-subtask-recurrence-end-type')?.value || 'NONE';
  const recurrence = {
    enabled: true,
    frequency,
    interval: document.getElementById('input-subtask-recurrence-interval')?.value || '1',
    endType
  };
  if (frequency === 'WEEKLY') {
    recurrence.byDay = Array.from(document.querySelectorAll('.subtask-recurrence-day:checked')).map(cb => cb.value);
  }
  if (endType === 'UNTIL') recurrence.until = document.getElementById('input-subtask-recurrence-until')?.value || '';
  if (endType === 'COUNT') recurrence.count = document.getElementById('input-subtask-recurrence-count')?.value || '';
  return recurrence;
}
function formatSubTaskRecurrenceLabel(st = {}) {
  const recurrence = st.recurrence;
  if (!recurrence || recurrence.enabled !== true) return '';
  const frequency = recurrence.frequency || 'WEEKLY';
  const interval = Number.parseInt(recurrence.interval, 10);
  const base = interval > 1
    ? `${interval}${SUBTASK_RECURRENCE_INTERVAL_UNITS[frequency] || '회'}마다`
    : (SUBTASK_RECURRENCE_LABELS[frequency] || '반복');
  const days = frequency === 'WEEKLY' && Array.isArray(recurrence.byDay) && recurrence.byDay.length
    ? ` · ${recurrence.byDay.map(day => SUBTASK_WEEKDAY_LABELS[day] || day).join('/')}`
    : '';
  const end = recurrence.endType === 'UNTIL' && recurrence.until
    ? ` · ${recurrence.until.substring(5)}까지`
    : recurrence.endType === 'COUNT' && recurrence.count
      ? ` · ${recurrence.count}회`
      : '';
  return `${base}${days}${end}`;
}
function getModalSubTaskOccurrences(st = {}) {
  if (!st?.recurrence || st.recurrence.enabled !== true || typeof getRecurringSubTaskOccurrences !== 'function') return [];
  const today = getTodayStr();
  const year = Number.parseInt(String(today).slice(0, 4), 10) || new Date().getFullYear();
  const rangeStart = `${year}-01-01`;
  const rangeEnd = `${year + 1}-12-31`;
  return getRecurringSubTaskOccurrences(st, rangeStart, rangeEnd, today)
    .sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')))
    .slice(0, 12);
}
function buildModalSubTaskOccurrenceStatusHTML(st = {}, idx) {
  const occurrences = getModalSubTaskOccurrences(st);
  if (!occurrences.length) return '';
  const rows = occurrences.map(occ => {
    const status = normalizeStatus(occ.status);
    const key = occ.occurrenceKey || occ.startDate || '';
    const dateLabel = occ.startDate === occ.dueDate
      ? (occ.startDate ? occ.startDate.substring(5) : '미정')
      : `${occ.startDate ? occ.startDate.substring(5) : '미정'}~${occ.dueDate ? occ.dueDate.substring(5) : '미정'}`;
    return `<div class="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
      <span class="min-w-0 truncate text-[11px] font-semibold text-slate-500">📅 ${escapeHTML(dateLabel)}</span>
      <select class="sel-modal-subtask-occurrence-status shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 outline-none focus:border-indigo-500" data-index="${idx}" data-occurrence-key="${escapeHTML(key)}">
        <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>대기</option>
        <option value="PROGRESS" ${status === 'PROGRESS' ? 'selected' : ''}>진행</option>
        <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>완료</option>
        <option value="CANCELLED" ${status === 'CANCELLED' ? 'selected' : ''}>취소</option>
      </select>
    </div>`;
  }).join('');
  return `<details class="rounded-lg border border-indigo-100 bg-indigo-50/40 px-2 py-1.5">
    <summary class="cursor-pointer text-[11px] font-bold text-indigo-700">회차별 상태</summary>
    <div class="mt-1.5 grid gap-1 sm:grid-cols-2">${rows}</div>
  </details>`;
}
function addSubTaskToModalList() {
  const titleInput = document.getElementById('input-subtask-title');
  const startInput = document.getElementById('input-subtask-start');
  const dueInput = document.getElementById('input-subtask-due');
  const title = (titleInput?.value || '').trim();
  if (!title) return;
  const parentAssignees = Array.from(document.querySelectorAll('.task-assignee-checkbox:checked')).map(cb => cb.value);
  const subAssignees = Array.from(document.querySelectorAll('.subtask-assignee-checkbox:checked')).map(cb => cb.value);
  const assignee = subAssignees.length ? subAssignees : (parentAssignees.length ? parentAssignees : ['미지정']);
  const recurrence = getSubTaskRecurrenceFromForm();
  const payload = { title, assignee, startDate: startInput?.value || getTodayStr(), dueDate: dueInput?.value || getTodayStr() };
  if (recurrence) payload.recurrence = recurrence;
  if (typeof validateSubTaskRecurrence === 'function') {
    const recurrenceMessage = validateSubTaskRecurrence(payload);
    if (recurrenceMessage) return showToast(recurrenceMessage, false);
  }
  if (editingSubTaskIndex > -1 && currentSubTasks[editingSubTaskIndex]) {
    currentSubTasks[editingSubTaskIndex] = { ...currentSubTasks[editingSubTaskIndex], ...payload, status: normalizeStatus(currentSubTasks[editingSubTaskIndex].status) };
    if (!recurrence) delete currentSubTasks[editingSubTaskIndex].recurrence;
    editingSubTaskIndex = -1;
    resetSubTaskButton();
  } else {
    currentSubTasks.push({ id: 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), status: 'PENDING', ...payload });
  }
  if (titleInput) titleInput.value = '';
  resetSubtaskAssigneeDropdown();
  if (startInput) startInput.value = getTodayStr();
  if (dueInput) dueInput.value = getFutureDateStr(7);
  resetSubTaskRecurrenceForm();
  renderModalSubTasks();
}
function renderModalSubTasks() {
  // Populate the dropdown to keep it synchronized with the latest subtask list!
  populateNoteScopeDropdown();

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
    li.className = 'flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm hover:border-slate-300 transition-colors';
    const subAssigneeLabel = Array.isArray(st.assignee) ? st.assignee.join(', ') : (st.assignee || '미정');
    const subNoteCount = _currentSubNoteCounts[st.id] || 0;
    const recurrenceLabel = formatSubTaskRecurrenceLabel(st);
    const recurrenceHtml = recurrenceLabel
      ? `<span class="text-slate-300">|</span><span class="flex items-center gap-1 font-semibold text-indigo-600" title="${escapeHTML(recurrenceLabel)}">반복 ${escapeHTML(recurrenceLabel)}</span>`
      : '';
    const noteBtnText = subNoteCount > 0 ? `📌 ${subNoteCount}` : '📌';
    const noteBtnHtml = _currentNoteTaskId 
      ? `<button type="button" class="btn-modal-note-subtask px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold transition flex items-center gap-1" data-index="${idx}" title="진행 메모 관리">${noteBtnText}</button><span class="text-slate-300">|</span>` 
      : '';
    const occurrenceStatusHtml = buildModalSubTaskOccurrenceStatusHTML(st, idx);
    li.innerHTML = `<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div class="flex items-start gap-2 min-w-0"><span class="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : status === 'CANCELLED' ? 'bg-slate-100 text-slate-500 border border-slate-200' : overdue ? 'bg-rose-50 text-rose-700 border border-rose-200' : status === 'PROGRESS' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">${overdue ? '🚨 기한 초과' : getStatusIcon(status) + ' ' + getStatusKorean(status).replace('됨', '')}</span><span class="text-[13px] font-bold text-slate-900 break-all leading-normal ${['COMPLETED', 'CANCELLED'].includes(status) ? 'line-through opacity-50' : ''}" title="${escapeHTML(st.title)}">${escapeHTML(st.title)}</span></div><div class="flex shrink-0 items-center justify-end gap-1.5">${noteBtnHtml}<select class="sel-modal-subtask-status rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 outline-none focus:border-indigo-500" data-index="${idx}"><option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>진행 대기</option><option value="PROGRESS" ${status === 'PROGRESS' ? 'selected' : ''}>진행 중</option><option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>완료</option><option value="CANCELLED" ${status === 'CANCELLED' ? 'selected' : ''}>취소</option></select><button type="button" class="btn-modal-edit-subtask text-[12px] font-bold text-indigo-600 hover:text-indigo-800 px-1" data-index="${idx}">수정</button><span class="text-slate-300">|</span><button type="button" class="btn-modal-delete-subtask text-[12px] font-semibold text-rose-500 hover:text-rose-700 px-1" data-index="${idx}">삭제</button></div></div><div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 border-t border-slate-100 pt-2 mt-0.5"><span class="flex items-center gap-1 font-medium"><span class="text-slate-400">📅</span> ${st.startDate ? st.startDate.substring(5) : '미정'} ~ ${st.dueDate ? st.dueDate.substring(5) : '미정'}</span><span class="text-slate-300">|</span><span class="flex items-center gap-1 font-medium max-w-[150px] truncate" title="${escapeHTML(subAssigneeLabel)}"><span class="text-slate-400">👤</span> ${escapeHTML(subAssigneeLabel)}</span>${recurrenceHtml}</div>${occurrenceStatusHtml}`;
    container.appendChild(li);
  });
  
  // Attach event listeners after DOM update
  container.querySelectorAll('.btn-modal-note-subtask').forEach(el => {
    el.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      window.openSubTaskNoteModal(idx);
    });
  });
  container.querySelectorAll('.sel-modal-subtask-status').forEach(el => {
    el.addEventListener('change', (e) => window.updateSubTaskStatusInModal(e.target.dataset.index, e.target.value));
  });
  container.querySelectorAll('.sel-modal-subtask-occurrence-status').forEach(el => {
    el.addEventListener('change', (e) => window.updateSubTaskOccurrenceStatusInModal(e.target.dataset.index, e.target.dataset.occurrenceKey, e.target.value));
  });
  container.querySelectorAll('.btn-modal-edit-subtask').forEach(el => {
    el.addEventListener('click', (e) => window.editSubTaskInModal(e.target.dataset.index));
  });
  container.querySelectorAll('.btn-modal-delete-subtask').forEach(el => {
    el.addEventListener('click', (e) => window.removeSubTaskFromModal(e.target.dataset.index));
  });
}
window.updateSubTaskStatusInModal = function(index, status) {
  if (!currentSubTasks[index]) return;
  currentSubTasks[index].status = normalizeStatus(status);
  renderModalSubTasks();
};
window.updateSubTaskOccurrenceStatusInModal = function(index, occurrenceKey, status) {
  const st = currentSubTasks[index];
  if (!st || !occurrenceKey) return;
  const normalizedStatus = normalizeStatus(status);
  const recurrenceCompletions = { ...(st.recurrenceCompletions || {}) };
  if (normalizedStatus === normalizeStatus(st.status)) delete recurrenceCompletions[occurrenceKey];
  else recurrenceCompletions[occurrenceKey] = normalizedStatus;
  st.recurrenceCompletions = recurrenceCompletions;
  if (!Object.keys(recurrenceCompletions).length) delete st.recurrenceCompletions;
  renderModalSubTasks();
};
window.editSubTaskInModal = function(index) {
  const st = currentSubTasks[index]; if (!st) return;
  editingSubTaskIndex = index;
  
  const parentAssignees = Array.from(document.querySelectorAll('.task-assignee-checkbox:checked')).map(cb => cb.value);
  if (typeof window.populateAssigneeDropdowns === 'function') {
    window.populateAssigneeDropdowns(parentAssignees, st.assignee || []);
  }
  
  document.getElementById('input-subtask-title').value = st.title || '';
  document.getElementById('input-subtask-start').value = st.startDate || '';
  document.getElementById('input-subtask-due').value = st.dueDate || '';
  setSubTaskRecurrenceForm(st.recurrence || null);
  const btn = document.getElementById('btn-add-subtask');
  if (btn) { btn.textContent = '수정 완료'; btn.className = 'rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition shrink-0 ml-auto'; }
};
window.removeSubTaskFromModal = function(index) {
  currentSubTasks.splice(index, 1);
  if (editingSubTaskIndex === index) { editingSubTaskIndex = -1; resetSubTaskButton(); }
  renderModalSubTasks();
};
function openTaskModal(id = null) {
  const targetTask = id ? tasks.find(task => task.id === id) : null;
  const targetTracker = trackers.find(tracker => tracker.id === currentTrackerId);
  const canSave = id
    ? window.hasTaskPermission?.(targetTask, 'update') === true
    : window.hasTaskPermission?.(targetTracker, 'create') === true;
  if (!id && !canSave) {
    showToast('이 트래커에 업무를 등록할 권한이 없습니다.', false);
    return;
  }
  bindSubTaskRecurrenceControls();
  document.getElementById('form-task')?.reset();
  _currentNoteTaskId = id; // Set task ID immediately for subtask notes visibility
  _currentSubNoteCounts = {}; // Reset subtask notes counts cache

  
  let initialTaskAssignee = ['미지정'];
  let initialSubtaskAssignee = [];
  if (id) {
    const t = tasks.find(x => x.id === id);
    if (t) {
      initialTaskAssignee = t.assignee || ['미지정'];
    }
  }
  if (typeof window.populateAssigneeDropdowns === 'function') {
    window.populateAssigneeDropdowns(initialTaskAssignee, initialSubtaskAssignee);
  }
  
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const advancedSection = document.getElementById('task-advanced-section');
  const subTasksSection = document.getElementById('task-subtasks-section');
  setVal('input-subtask-title', '');
  resetSubtaskAssigneeDropdown();
  setVal('input-subtask-start', getTodayStr()); setVal('input-subtask-due', getFutureDateStr(7));
  resetSubTaskRecurrenceForm();
  editingSubTaskIndex = -1; resetSubTaskButton();
  const title = document.getElementById('modal-title');
  if (id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    if (title) title.textContent = canSave ? '업무 상세 변경' : '업무 상세 조회';
    setVal('input-task-id', t.id); setVal('input-task-title', t.title || ''); setVal('input-task-start', t.startDate || ''); setVal('input-task-due', t.dueDate || ''); setVal('input-task-priority', t.priority || 'NORMAL'); setVal('input-task-status', t.status || 'PENDING'); setVal('input-task-industry', t.industry || 'AUTO'); setVal('input-task-notes', t.notes || '');
    currentSubTasks = Array.isArray(t.subTasks) ? JSON.parse(JSON.stringify(t.subTasks)).map(st => ({ ...st, status: normalizeStatus(st.status) })) : [];
    if (advancedSection) advancedSection.open = !!(t.notes || (t.industry && t.industry !== 'AUTO'));
    if (subTasksSection) subTasksSection.open = currentSubTasks.length > 0;
  } else {
    if (title) title.textContent = '새로운 업무 배정';
    setVal('input-task-id', ''); setVal('input-task-start', getTodayStr()); setVal('input-task-due', getFutureDateStr(7)); setVal('input-task-industry', 'AUTO');
    currentSubTasks = [];
    if (advancedSection) advancedSection.open = false;
    if (subTasksSection) subTasksSection.open = false;
  }
  renderModalSubTasks();
  document.querySelector('#form-task button[type="submit"]')?.classList.toggle('hidden', !canSave);

  // Load and render Unified Task History (Progress Notes & Activity Logs)
  const historySection = document.getElementById('task-history-section');
  if (historySection) {
    if (id) {
      historySection.classList.remove('hidden');
      loadTaskHistory(id, 1);
    } else {
      historySection.classList.add('hidden');
      const feed = document.getElementById('task-history-feed');
      if (feed) feed.innerHTML = '';
      const pagination = document.getElementById('task-history-pagination');
      if (pagination) pagination.innerHTML = '';
      const addForm = document.getElementById('progress-note-add-form');
      if (addForm) addForm.classList.add('hidden');
    }
  }


  document.getElementById('modal-task')?.classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-task')?.classList.add('hidden'); }
function closeConfirmModal() { document.getElementById('modal-confirm')?.classList.add('hidden'); confirmActionCb = null; }

const TRACKER_ACCESS_LABELS = { view: '조회', create: '등록', update: '수정', delete: '삭제' };
let trackerAccessMode = 'new';
let trackerAccessWasEdited = false;
let trackerCopySourceId = '';

function getTrackerAccessUsers() {
  const usersById = new Map();
  (window.approvedUsers || []).forEach(user => {
    if (user?.uid) usersById.set(user.uid, user);
  });
  if (window.currentUser?.uid && !usersById.has(window.currentUser.uid)) {
    usersById.set(window.currentUser.uid, {
      uid: window.currentUser.uid,
      displayName: window.currentUser.displayName || window.currentUser.email || '현재 사용자',
      email: window.currentUser.email || ''
    });
  }
  return [...usersById.values()].sort((a, b) => String(a.displayName || a.email).localeCompare(String(b.displayName || b.email), 'ko'));
}

function renderTrackerAccessControl(tracker = null, editable = true) {
  const list = document.getElementById('tracker-access-list');
  if (!list) return;
  const ownerId = tracker?.ownerId || tracker?.createdBy || window.currentUser?.uid || '';
  const acl = tracker?.accessControl && typeof tracker.accessControl === 'object' ? tracker.accessControl : null;
  trackerAccessMode = tracker ? (acl ? 'acl' : 'legacy') : 'new';
  trackerAccessWasEdited = false;
  const users = getTrackerAccessUsers();
  list.innerHTML = '';

  users.forEach(user => {
    const isOwner = user.uid === ownerId;
    const row = document.createElement('div');
    row.className = 'grid grid-cols-[minmax(180px,1fr)_repeat(4,58px)] items-center gap-1 px-2 py-2';
    const fallbackPermissions = tracker
      ? { view: true, create: true, update: false, delete: false }
      : { view: false, create: false, update: false, delete: false };
    const permissions = isOwner
      ? { view: true, create: true, update: true, delete: true }
      : (acl?.[user.uid] || fallbackPermissions);
    row.innerHTML = `
      <div class="min-w-0 pr-2">
        <div class="truncate text-xs font-semibold text-slate-700">${escapeHTML(user.displayName || user.email || user.uid)}${isOwner ? ' <span class="text-indigo-600">(소유자)</span>' : ''}</div>
        <div class="truncate text-[10px] text-slate-400">${escapeHTML(user.email || user.uid)}</div>
      </div>
      ${Object.keys(TRACKER_ACCESS_LABELS).map(permission => `
        <label class="flex justify-center" title="${TRACKER_ACCESS_LABELS[permission]}">
          <input type="checkbox" class="tracker-access-checkbox h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            data-user-id="${escapeHTML(user.uid)}" data-permission="${permission}"
            ${permissions[permission] === true ? 'checked' : ''} ${(isOwner || !editable) ? 'disabled' : ''}>
        </label>
      `).join('')}
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('.tracker-access-checkbox:not(:disabled)').forEach(input => {
    input.addEventListener('change', () => {
      trackerAccessWasEdited = true;
      const userId = input.dataset.userId;
      const permission = input.dataset.permission;
      const userInputs = [...list.querySelectorAll('.tracker-access-checkbox')].filter(item => item.dataset.userId === userId);
      const viewInput = userInputs.find(item => item.dataset.permission === 'view');
      if (permission !== 'view' && input.checked && viewInput) viewInput.checked = true;
      if (permission === 'view' && !input.checked) {
        userInputs.forEach(item => { item.checked = false; });
      }
    });
  });
}

function collectTrackerAccessControl() {
  if (trackerAccessMode === 'legacy' && !trackerAccessWasEdited) return null;
  const acl = {};
  document.querySelectorAll('#tracker-access-list .tracker-access-checkbox').forEach(input => {
    const userId = input.dataset.userId;
    const permission = input.dataset.permission;
    if (!userId || !permission) return;
    if (!acl[userId]) acl[userId] = { view: false, create: false, update: false, delete: false };
    acl[userId][permission] = input.checked;
  });
  return Object.fromEntries(Object.entries(acl).filter(([, permissions]) => Object.values(permissions).some(Boolean)));
}

function openTrackerModal(id = null) {
  trackerCopySourceId = '';
  document.getElementById('form-tracker')?.reset();
  const del = document.getElementById('btn-delete-tracker');
  const saveBtn = document.getElementById('btn-save-tracker');
  const inputName = document.getElementById('input-tracker-name');
  const inputDesc = document.getElementById('input-tracker-desc');
  const copySummary = document.getElementById('tracker-copy-summary');
  document.getElementById('tracker-access-section')?.classList.remove('hidden');
  copySummary?.classList.add('hidden');
  if (copySummary) copySummary.textContent = '';
  if (saveBtn) saveBtn.textContent = '저장하기';
  
  if (id) {
    const t = trackers.find(x => x.id === id); if (!t) return;
    const hasPerm = typeof window.hasTrackerWritePermission === 'function' ? window.hasTrackerWritePermission(t) : true;
    
    if (hasPerm) {
      document.getElementById('modal-tracker-title').textContent = '트래커 정보 수정';
      if (inputName) inputName.readOnly = false;
      if (inputDesc) inputDesc.readOnly = false;
      del?.classList.remove('hidden');
      saveBtn?.classList.remove('hidden');
    } else {
      document.getElementById('modal-tracker-title').textContent = '트래커 정보 조회';
      if (inputName) inputName.readOnly = true;
      if (inputDesc) inputDesc.readOnly = true;
      del?.classList.add('hidden');
      saveBtn?.classList.add('hidden');
    }
    
    document.getElementById('input-tracker-id').value = t.id;
    document.getElementById('input-tracker-name').value = t.name || '';
    document.getElementById('input-tracker-desc').value = t.desc || '';
    renderTrackerAccessControl(t, hasPerm);
  } else {
    document.getElementById('modal-tracker-title').textContent = '새 트래커 스페이스 추가';
    document.getElementById('input-tracker-id').value = '';
    if (inputName) inputName.readOnly = false;
    if (inputDesc) inputDesc.readOnly = false;
    del?.classList.add('hidden');
    saveBtn?.classList.remove('hidden');
    renderTrackerAccessControl(null, true);
  }
  document.getElementById('tracker-dropdown-menu')?.classList.add('hidden');
  document.getElementById('modal-tracker')?.classList.remove('hidden');
}

function openTrackerCopyModal(id = currentTrackerId) {
  const sourceTracker = trackers.find(tracker => tracker.id === id);
  if (!sourceTracker || window.hasTaskPermission?.(sourceTracker, 'view') !== true) {
    showToast('복사할 트래커의 조회 권한이 없습니다.', false);
    return;
  }

  openTrackerModal();
  trackerCopySourceId = sourceTracker.id;
  const sourceTasks = tasks.filter(task => task.trackerId === sourceTracker.id && task.deleted !== true);
  document.getElementById('modal-tracker-title').textContent = '트래커 복사';
  document.getElementById('input-tracker-name').value = `${sourceTracker.name || '트래커'} - 복사본`;
  document.getElementById('input-tracker-desc').value = sourceTracker.desc || '';
  const copySummary = document.getElementById('tracker-copy-summary');
  if (copySummary) {
    copySummary.textContent = `활성 태스크 ${sourceTasks.length}개와 하위 업무를 복사합니다. 태스크 메모, 진행 메모, 변경 이력, 원본 사용자 권한은 복사하지 않으며 새 트래커는 본인이 소유합니다.`;
    copySummary.classList.remove('hidden');
  }
  document.getElementById('tracker-access-section')?.classList.add('hidden');
  const saveBtn = document.getElementById('btn-save-tracker');
  if (saveBtn) saveBtn.textContent = '복사하기';
}

function closeTrackerModal() {
  trackerCopySourceId = '';
  document.getElementById('modal-tracker')?.classList.add('hidden');
}

async function handleTrackerSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('input-tracker-id').value;
  const data = {
    name: document.getElementById('input-tracker-name').value.trim(),
    desc: document.getElementById('input-tracker-desc').value.trim()
  };
  let result;
  if (trackerCopySourceId) {
    result = await db_duplicateTracker(trackerCopySourceId, data);
  } else {
    const accessControl = collectTrackerAccessControl();
    if (accessControl) data.accessControl = accessControl;
    result = id ? await db_updateTracker(id, data) : await db_addTracker(data);
  }
  if (!result || !result.success) return;
  showToast(trackerCopySourceId ? `트래커와 태스크 ${result.taskCount}개가 복사되었습니다.` : (id ? '트래커가 수정되었습니다.' : '새 트래커 공간이 생성되었습니다.'));
  closeTrackerModal();
}
async function handleTaskSubmit(e) {
  e.preventDefault();
  try {
    const id = document.getElementById('input-task-id').value;
    const start = document.getElementById('input-task-start').value;
    const due = document.getElementById('input-task-due').value;
    if (start && due && start > due) return showToast('시작일은 마감일보다 늦을 수 없습니다.', false);
    let order = 1;
    if (!id) {
      const scoped = tasks.filter(t => t.trackerId === currentTrackerId);
      if (scoped.length) order = Math.max(...scoped.map(t => t.order ?? 0)) + 1;
    }
    const taskAssignees = Array.from(document.querySelectorAll('.task-assignee-checkbox:checked')).map(cb => cb.value);
    const data = {
      trackerId: currentTrackerId,
      title: document.getElementById('input-task-title').value.trim(),
      assignee: taskAssignees.length ? taskAssignees : ['미지정'],
      startDate: start,
      dueDate: due,
      priority: document.getElementById('input-task-priority').value,
      status: document.getElementById('input-task-status').value,
      industry: document.getElementById('input-task-industry')?.value || 'AUTO',
      taskType: id ? (tasks.find(task => task.id === id)?.taskType || 'GENERAL') : 'GENERAL',
      notes: document.getElementById('input-task-notes').value.trim(),
      subTasks: currentSubTasks.map(st => ({ ...st, status: normalizeStatus(st.status) }))
    };
    const validationMessage = validateTaskPayload(data);
    if (validationMessage) return showToast(validationMessage, false);
    if (!id) data.order = order;
    const result = id ? await db_updateTask(id, data) : await db_addTask(data);
    if (!result || !result.success) return;
    showToast(id ? '수정되었습니다.' : '추가되었습니다.');
    closeModal();
  } catch (err) {
    console.error('handleTaskSubmit 에러 발생:', err);
    showToast(`저장 실패: ${err.message || String(err)}`, false);
  }
}

// === Phase 8 fix: expose modal/controller functions for non-module script files ===
// app.js and event-bindings.js call these handlers from the global scope.
// Keeping explicit window exports prevents ReferenceError after file splitting.
window.openTaskModal = openTaskModal;
window.closeModal = closeModal;
window.closeConfirmModal = closeConfirmModal;
window.openTrackerModal = openTrackerModal;
window.openTrackerCopyModal = openTrackerCopyModal;
window.closeTrackerModal = closeTrackerModal;
window.handleTrackerSubmit = handleTrackerSubmit;
window.handleTaskSubmit = handleTaskSubmit;
window.addSubTaskToModalList = addSubTaskToModalList;

function populateNoteScopeDropdown() {
  const scopeSelect = document.getElementById('input-note-scope');
  if (!scopeSelect) return;
  scopeSelect.innerHTML = '';
  
  if (!_currentNoteTaskId) return;
  const t = tasks.find(x => x.id === _currentNoteTaskId);
  if (!t) return;
  
  // 1. Parent Task option
  const parentOpt = document.createElement('option');
  parentOpt.value = _currentNoteTaskId;
  parentOpt.textContent = `[본 업무] ${t.title || '업무명 없음'}`;
  scopeSelect.appendChild(parentOpt);
  
  // 2. Subtasks options
  currentSubTasks.forEach(st => {
    const opt = document.createElement('option');
    opt.value = `${_currentNoteTaskId}__sub_${st.id}`;
    opt.textContent = `[하위] ${st.title || '업무명 없음'}`;
    scopeSelect.appendChild(opt);
  });
}

function populateAssigneeDropdowns(currentTaskAssignee = ['미지정'], currentSubtaskAssignee = []) {
  const taskMenu = document.getElementById('list-task-assignee-menu');
  const subtaskMenu = document.getElementById('list-subtask-assignee-menu');
  
  const taskSel = Array.isArray(currentTaskAssignee) ? currentTaskAssignee : (currentTaskAssignee ? [currentTaskAssignee] : ['미지정']);
  const subtaskSel = Array.isArray(currentSubtaskAssignee) ? currentSubtaskAssignee : (currentSubtaskAssignee ? [currentSubtaskAssignee] : []);
  
  const candidateUsers = [];
  if (window.approvedUsers && window.approvedUsers.length > 0) {
    window.approvedUsers.forEach(u => candidateUsers.push(u.displayName));
  }
  
  if (taskMenu) {
    taskMenu.innerHTML = '';
    const allTaskUsers = ['미지정', ...candidateUsers];
    taskSel.forEach(name => {
      if (name && !allTaskUsers.includes(name)) allTaskUsers.push(name);
    });
    
    allTaskUsers.forEach(name => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'flex items-center justify-between rounded-lg p-1.5 hover:bg-slate-50 transition cursor-pointer text-xs font-semibold text-slate-700';
      const isChecked = taskSel.includes(name);
      itemDiv.innerHTML = `
        <span>${escapeHTML(name)}</span>
        <input type="checkbox" value="${escapeHTML(name)}" class="task-assignee-checkbox h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" ${isChecked ? 'checked' : ''}>
      `;
      itemDiv.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = itemDiv.querySelector('input');
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
        }
      });
      taskMenu.appendChild(itemDiv);
    });
    
    // Add event listeners to task checkboxes
    taskMenu.querySelectorAll('.task-assignee-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const val = e.target.value;
        const isChecked = e.target.checked;
        if (val === '미지정' && isChecked) {
          taskMenu.querySelectorAll('.task-assignee-checkbox').forEach(other => {
            if (other.value !== '미지정') other.checked = false;
          });
        } else if (val !== '미지정' && isChecked) {
          taskMenu.querySelectorAll('.task-assignee-checkbox').forEach(other => {
            if (other.value === '미지정') other.checked = false;
          });
        }
        
        const checkedCount = taskMenu.querySelectorAll('.task-assignee-checkbox:checked').length;
        if (checkedCount === 0) {
          const noneCb = Array.from(taskMenu.querySelectorAll('.task-assignee-checkbox')).find(c => c.value === '미지정');
          if (noneCb) noneCb.checked = true;
        }
        
        updateTaskTriggerLabel();
      });
    });
  }
  
  if (subtaskMenu) {
    subtaskMenu.innerHTML = '';
    const allSubUsers = [...candidateUsers];
    subtaskSel.forEach(name => {
      if (name && name !== '미지정' && !allSubUsers.includes(name)) allSubUsers.push(name);
    });
    
    allSubUsers.forEach(name => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'flex items-center justify-between rounded-lg p-1.5 hover:bg-slate-50 transition cursor-pointer text-xs font-semibold text-slate-700';
      const isChecked = subtaskSel.includes(name);
      itemDiv.innerHTML = `
        <span>${escapeHTML(name)}</span>
        <input type="checkbox" value="${escapeHTML(name)}" class="subtask-assignee-checkbox h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" ${isChecked ? 'checked' : ''}>
      `;
      itemDiv.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const cb = itemDiv.querySelector('input');
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
        }
      });
      subtaskMenu.appendChild(itemDiv);
    });
    
    subtaskMenu.querySelectorAll('.subtask-assignee-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        updateSubtaskTriggerLabel();
      });
    });
  }
  
  updateTaskTriggerLabel();
  updateSubtaskTriggerLabel();
}

function updateTaskTriggerLabel() {
  const checked = Array.from(document.querySelectorAll('.task-assignee-checkbox:checked')).map(el => el.value);
  const textEl = document.getElementById('text-task-assignee-value');
  if (textEl) {
    textEl.textContent = checked.length ? checked.join(', ') : '미지정';
  }
}

function updateSubtaskTriggerLabel() {
  const checked = Array.from(document.querySelectorAll('.subtask-assignee-checkbox:checked')).map(el => el.value);
  const textEl = document.getElementById('text-subtask-assignee-value');
  if (textEl) {
    textEl.textContent = checked.length ? checked.join(', ') : '본 업무 담당자';
  }
}

function resetSubtaskAssigneeDropdown() {
  document.querySelectorAll('.subtask-assignee-checkbox').forEach(cb => cb.checked = false);
  const textEl = document.getElementById('text-subtask-assignee-value');
  if (textEl) textEl.textContent = '본 업무 담당자';
}

// Global click event to close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  const taskTrigger = document.getElementById('btn-task-assignee-trigger');
  const taskMenu = document.getElementById('list-task-assignee-menu');
  const subtaskTrigger = document.getElementById('btn-subtask-assignee-trigger');
  const subtaskMenu = document.getElementById('list-subtask-assignee-menu');
  
  if (taskTrigger && taskMenu) {
    if (taskTrigger.contains(e.target)) {
      taskMenu.classList.toggle('hidden');
      if (subtaskMenu) subtaskMenu.classList.add('hidden');
    } else if (!taskMenu.contains(e.target)) {
      taskMenu.classList.add('hidden');
    }
  }
  
  if (subtaskTrigger && subtaskMenu) {
    if (subtaskTrigger.contains(e.target)) {
      subtaskMenu.classList.toggle('hidden');
      if (taskMenu) taskMenu.classList.add('hidden');
    } else if (!subtaskMenu.contains(e.target)) {
      subtaskMenu.classList.add('hidden');
    }
  }
});

window.populateAssigneeDropdowns = populateAssigneeDropdowns;

// === Custom KPI Settings Modal Logic ===
function openKpiSettingsModal() {
  const tracker = trackers.find(t => t.id === currentTrackerId);
  if (!tracker) {
    console.warn('[KPI Modal] 트래커를 찾을 수 없습니다. currentTrackerId =', currentTrackerId, '/ trackers =', trackers);
    return;
  }

  const kpiTitle = tracker.kpiTitle || '업무 완료율';
  const kpiTarget = typeof tracker.kpiTarget === 'number' ? tracker.kpiTarget : 80;
  const kpiUnit = tracker.kpiUnit || '%';
  const kpiType = tracker.kpiType || 'AUTO_DONE_PCT';
  const kpiCurrent = typeof tracker.kpiCurrent === 'number' ? tracker.kpiCurrent : 0;

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setVal('input-kpi-title', kpiTitle);
  setVal('input-kpi-target', kpiTarget);
  setVal('input-kpi-unit', kpiUnit);
  setVal('select-kpi-type', kpiType);
  setVal('input-kpi-current', kpiCurrent);

  const wrapper = document.getElementById('kpi-manual-input-wrapper');
  if (wrapper) {
    if (kpiType === 'MANUAL') {
      wrapper.classList.remove('hidden');
    } else {
      wrapper.classList.add('hidden');
    }
  }

  document.getElementById('modal-kpi-settings')?.classList.remove('hidden');
}

function closeKpiSettingsModal() {
  document.getElementById('modal-kpi-settings')?.classList.add('hidden');
}

function initKpiSettingsEvents() {
  const selectType = document.getElementById('select-kpi-type');
  const wrapper = document.getElementById('kpi-manual-input-wrapper');
  if (selectType && wrapper) {
    selectType.addEventListener('change', () => {
      if (selectType.value === 'MANUAL') {
        wrapper.classList.remove('hidden');
      } else {
        wrapper.classList.add('hidden');
      }
    });
  }

  const closeIds = ['btn-close-kpi-settings', 'btn-cancel-kpi-settings', 'modal-kpi-backdrop'];
  closeIds.forEach(id => {
    document.getElementById(id)?.addEventListener('click', closeKpiSettingsModal);
  });

  const form = document.getElementById('form-kpi-settings');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const getVal = (id) => document.getElementById(id)?.value || '';
      const getNum = (id) => {
        const val = document.getElementById(id)?.value;
        return val !== undefined && val !== '' ? Number(val) : 0;
      };

      const payload = {
        kpiTitle: getVal('input-kpi-title'),
        kpiTarget: getNum('input-kpi-target'),
        kpiUnit: getVal('input-kpi-unit'),
        kpiType: getVal('select-kpi-type'),
        kpiCurrent: getNum('input-kpi-current'),
        targetKpi: getNum('input-kpi-target')
      };

      if (typeof window.db_updateTracker === 'function') {
        showToast('KPI 설정을 저장하는 중...');
        const result = await window.db_updateTracker(currentTrackerId, payload);
        if (!result || !result.success) return;
      }

      closeKpiSettingsModal();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initKpiSettingsEvents();
  });
} else {
  initKpiSettingsEvents();
}

window.openKpiSettingsModal = openKpiSettingsModal;

// ══════════════════════════════════════════════════════════
// 진행 메모(Progress Notes) 컨트롤러
// ══════════════════════════════════════════════════════════

let _currentNotePanelNote = null; // 현재 패널에 표시 중인 메모 객체
let _currentNoteTaskId = null;    // 현재 메모가 속한 태스크 ID
let _currentSubNoteCounts = {};  // 서브태스크별 메모 개수 캐시
let _currentFeedPage = 1;         // 현재 피드 페이지
const FEED_PAGE_SIZE = 5;         // 페이지당 아이템 개수
let _cachedFeedItems = [];        // 머지된 타임라인 데이터 캐시
let _notePanelHistoryRequestId = 0;

// ─── 날짜 포맷 헬퍼 ───────────────────────────────────────
function getNoteDateValue(note = {}) {
  if (note.noteDate && /^\d{4}-\d{2}-\d{2}$/.test(note.noteDate)) return note.noteDate;
  const ts = note.createdAt;
  if (!ts) return '';
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatNoteDate(note) {
  const dateValue = getNoteDateValue(note);
  if (!dateValue) return '';
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getNoteSortTime(note = {}) {
  const dateValue = getNoteDateValue(note);
  if (!dateValue) return 0;
  const [year, month, day] = dateValue.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const createdAt = note.createdAt?.toDate ? note.createdAt.toDate() : new Date(note.createdAt || 0);
  if (!Number.isNaN(createdAt.getTime())) {
    d.setHours(createdAt.getHours(), createdAt.getMinutes(), createdAt.getSeconds(), createdAt.getMilliseconds());
  }
  return d.getTime();
}

const DEFAULT_NOTE_WORK_TYPES = [
  { id: 'GENERAL', label: 'General' },
  { id: 'PIPELINE_REVIEW', label: 'Pipeline Review' },
  { id: 'CUSTOMER_VISIT', label: 'Customer Visit' },
  { id: 'TECH_FOLLOWUP', label: 'Technical Follow-up' },
  { id: 'QUOTATION', label: 'Quotation' },
  { id: 'NPI_LAUNCH', label: 'NPI / Launch' },
  { id: 'MARKETING', label: 'Marketing / Webinar' },
  { id: 'DISTRIBUTOR', label: 'Distributor' },
  { id: 'INTERNAL_REVIEW', label: 'Internal Review' },
  { id: 'COMPLIANCE', label: 'Compliance / Certification' }
];

function normalizeNoteWorkTypes(options) {
  const seen = new Set();
  const normalized = [];
  (Array.isArray(options) ? options : []).forEach((option, index) => {
    const label = String(option?.label || '').trim().slice(0, 60);
    const id = String(option?.id || `TYPE_${Date.now()}_${index}`).trim().slice(0, 80);
    if (!label || !id || seen.has(id)) return;
    seen.add(id);
    normalized.push({ id, label });
  });
  return normalized;
}

function getCurrentNoteWorkTypes() {
  const tracker = Array.isArray(trackers) ? trackers.find(item => item.id === currentTrackerId) : null;
  const configured = normalizeNoteWorkTypes(tracker?.noteTypeOptions);
  return configured.length ? configured : DEFAULT_NOTE_WORK_TYPES.map(option => ({ ...option }));
}

function populateNoteWorkTypeSelect(select, selectedValue = '') {
  if (!select) return;
  const options = getCurrentNoteWorkTypes();
  const selected = selectedValue || options[0]?.id || '';
  select.innerHTML = options.map(option =>
    `<option value="${escapeHTML(option.id)}">${escapeHTML(option.label)}</option>`
  ).join('');
  if (selected && !options.some(option => option.id === selected)) {
    const legacy = document.createElement('option');
    legacy.value = selected;
    legacy.textContent = selected;
    select.appendChild(legacy);
  }
  select.value = selected;
}

function getSelectedNoteWorkType(select) {
  const id = select?.value || '';
  const option = getCurrentNoteWorkTypes().find(item => item.id === id);
  return { workType: id, workTypeLabel: option?.label || select?.selectedOptions?.[0]?.textContent || id };
}

function sanitizeNoteBodyHtml(html, plainText = '') {
  const source = String(html || '').trim();
  if (!source) return escapeHTML(String(plainText || '')).replace(/\n/g, '<br>');
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(source, {
      ALLOWED_TAGS: ['br', 'div', 'p', 'ul', 'ol', 'li', 'span', 'font'],
      ALLOWED_ATTR: ['color']
    });
  }
  return escapeHTML(String(plainText || '')).replace(/\n/g, '<br>');
}

function setNoteEditorContent(editor, note = {}) {
  if (!editor) return;
  editor.innerHTML = sanitizeNoteBodyHtml(note.bodyHtml, note.body);
}

function readNoteEditor(editor) {
  const body = String(editor?.innerText || editor?.textContent || '').trim();
  return {
    body,
    bodyHtml: sanitizeNoteBodyHtml(editor?.innerHTML || '', body)
  };
}

function renderNoteBody(target, note = {}) {
  if (!target) return;
  target.innerHTML = sanitizeNoteBodyHtml(note.bodyHtml, note.body);
}

function formatReviewCommentDate(comment = {}) {
  const value = comment.createdAt;
  const date = value?.toDate ? value.toDate() : new Date(value || 0);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderNotePanelComments(note = {}) {
  const list = document.getElementById('note-panel-comments');
  const count = document.getElementById('note-panel-comment-count');
  if (!list) return;
  const comments = Array.isArray(note.reviewComments) ? note.reviewComments : [];
  if (count) count.textContent = `${comments.length}건`;
  list.innerHTML = '';
  if (!comments.length) {
    list.innerHTML = '<p class="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-400 dark:bg-slate-800/50">아직 리뷰 코멘트가 없습니다.</p>';
    return;
  }
  comments.forEach(comment => {
    const item = document.createElement('article');
    item.className = 'rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40';
    item.innerHTML = `
      <div class="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-400">
        <span>${escapeHTML((comment.createdByName || '').split('@')[0] || '알 수 없음')}</span>
        <span>${escapeHTML(formatReviewCommentDate(comment))}</span>
      </div>
      <p class="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">${escapeHTML(comment.body || '')}</p>
    `;
    list.appendChild(item);
  });
}

// ─── 메모 카드 렌더러 ─────────────────────────────────────
function renderNoteCard(note) {
  let subTaskLabel = '';
  if (note.taskId && note.taskId.includes('__sub_')) {
    const subId = note.taskId.split('__sub_')[1];
    const st = currentSubTasks.find(x => x.id === subId);
    subTaskLabel = st ? `[하위: ${st.title}] ` : '[하위 과제] ';
  }

  const titleText = subTaskLabel + (note.title || '(제목 없음)');
  const title = note.title ? escapeHTML(titleText) : `<span class="text-slate-400 italic">${escapeHTML(titleText)}</span>`;
  const bodyPreview = escapeHTML((note.body || '').slice(0, 80)) + ((note.body || '').length > 80 ? '...' : '');
  const dateStr = formatNoteDate(note);
  const author = escapeHTML((note.createdByName || '').split('@')[0] || '알 수 없음');
  const context = [note.customerName, note.oppNo, note.workTypeLabel || note.workType].filter(Boolean).map(escapeHTML).join(' · ');
  const commentCount = Array.isArray(note.reviewComments) ? note.reviewComments.length : 0;

  const card = document.createElement('div');
  card.className = 'group flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 p-3 cursor-pointer transition dark:bg-slate-900/50 dark:border-slate-800 dark:hover:border-indigo-700';
  card.dataset.noteId = note.id;
  card.innerHTML = `
    <span class="text-sm mt-0.5 shrink-0">📌</span>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-1 mb-0.5">
        <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">${title}</span>
        <span class="text-[10px] text-slate-400 shrink-0">${dateStr}</span>
      </div>
      <p class="text-[11px] text-slate-500 leading-relaxed line-clamp-2">${bodyPreview || '<span class="italic">(내용 없음)</span>'}</p>
      <div class="mt-1 flex flex-wrap gap-x-2 text-[10px] text-slate-400">
        <span>${author}</span>
        ${context ? `<span>${context}</span>` : ''}
        ${commentCount ? `<span>💬 ${commentCount}</span>` : ''}
      </div>
    </div>
  `;
  card.addEventListener('click', () => openNoteDetailPanel(note));
  return card;
}

// ─── 통합 진행 메모 로드 ───────────────────────────────────────

async function loadTaskHistory(taskId, page = 1) {
  _currentNoteTaskId = taskId;
  _currentFeedPage = page;
  
  const feedContainer = document.getElementById('task-history-feed');
  const emptyMsg = document.getElementById('task-history-empty');
  const paginationContainer = document.getElementById('task-history-pagination');
  if (!feedContainer) return;

  if (page === 1 || _cachedFeedItems.length === 0) {
    feedContainer.innerHTML = '<p class="text-center text-xs text-slate-400 py-4">로드 중...</p>';
    if (emptyMsg) emptyMsg.classList.add('hidden');
    if (paginationContainer) paginationContainer.innerHTML = '';

    const notes = typeof window.db_fetchProgressNotes === 'function'
      ? await window.db_fetchProgressNotes(taskId)
      : [];
      
    // 활동 이력(system log)을 제외하고 사용자가 작성한 진행 메모만 노출
    const items = notes.map(n => ({ ...n, feedType: 'NOTE', sortDate: getNoteSortTime(n) }));

    items.sort((a, b) => {
      const timeA = a.sortDate?.toDate ? a.sortDate.toDate().getTime() : new Date(a.sortDate || 0).getTime();
      const timeB = b.sortDate?.toDate ? b.sortDate.toDate().getTime() : new Date(b.sortDate || 0).getTime();
      return timeB - timeA;
    });

    _cachedFeedItems = items;

    _currentSubNoteCounts = {};
    notes.forEach(n => {
      if (n.taskId && n.taskId.includes('__sub_')) {
        const subId = n.taskId.split('__sub_')[1];
        _currentSubNoteCounts[subId] = (_currentSubNoteCounts[subId] || 0) + 1;
      }
    });

    renderModalSubTasks();
  }

  feedContainer.innerHTML = '';
  const totalItems = _cachedFeedItems.length;

  if (totalItems === 0) {
    if (emptyMsg) emptyMsg.classList.remove('hidden');
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  if (emptyMsg) emptyMsg.classList.add('hidden');

  const startIdx = (page - 1) * FEED_PAGE_SIZE;
  const endIdx = page * FEED_PAGE_SIZE;
  const pageItems = _cachedFeedItems.slice(startIdx, endIdx);

  pageItems.forEach(item => {
    feedContainer.appendChild(renderNoteCard(item));
  });

  renderHistoryPagination(totalItems);
}

function renderHistoryPagination(totalItems) {
  const container = document.getElementById('task-history-pagination');
  if (!container) return;
  container.innerHTML = '';

  const totalPages = Math.ceil(totalItems / FEED_PAGE_SIZE);
  if (totalPages <= 1) return;

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = `px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none`;
  prevBtn.textContent = '이전';
  prevBtn.disabled = _currentFeedPage === 1;
  prevBtn.addEventListener('click', () => loadTaskHistory(_currentNoteTaskId, _currentFeedPage - 1));
  container.appendChild(prevBtn);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `w-6 h-6 flex items-center justify-center rounded-lg text-[11px] font-bold transition ${
      i === _currentFeedPage
        ? 'bg-indigo-600 text-white'
        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }`;
    btn.textContent = i;
    btn.addEventListener('click', () => loadTaskHistory(_currentNoteTaskId, i));
    container.appendChild(btn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = `px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-40 disabled:pointer-events-none`;
  nextBtn.textContent = '다음';
  nextBtn.disabled = _currentFeedPage === totalPages;
  nextBtn.addEventListener('click', () => loadTaskHistory(_currentNoteTaskId, _currentFeedPage + 1));
  container.appendChild(nextBtn);
}

// ─── 슬라이드오버 패널 열기 ──────────────────────────────
async function openNoteDetailPanel(note) {
  _currentNotePanelNote = note;
  const panel = document.getElementById('note-detail-panel');
  const backdrop = document.getElementById('note-panel-backdrop');
  if (!panel) return;

  // 월별 요약 등 어떤 진입점에서도 선택한 메모의 본 업무를 현재 범위로 사용
  if (note.taskId) {
    _currentNoteTaskId = note.taskId.split('__sub_')[0];
  }

  // 읽기 모드로 초기화
  setNotePanel_readMode(note);
  const commentInput = document.getElementById('input-note-review-comment');
  if (commentInput) commentInput.value = '';
  panel.classList.remove('translate-x-full');
  panel.classList.add('translate-x-0');
  if (backdrop) backdrop.classList.remove('hidden');
  await loadNotePanelHistory(note);
}

function closeNoteDetailPanel() {
  const panel = document.getElementById('note-detail-panel');
  const backdrop = document.getElementById('note-panel-backdrop');
  if (panel) { panel.classList.add('translate-x-full'); panel.classList.remove('translate-x-0'); }
  if (backdrop) backdrop.classList.add('hidden');
  _notePanelHistoryRequestId += 1;
  _currentNotePanelNote = null;
}

function getNoteScopeLabel(note = {}) {
  const parts = String(note.taskId || '').split('__sub_');
  if (parts.length < 2) return '본 업무';
  const subTaskId = parts[1];
  const parentTask = typeof tasks !== 'undefined' && Array.isArray(tasks)
    ? tasks.find(task => task.id === parts[0])
    : null;
  const subTask = parentTask?.subTasks?.find(item => item.id === subTaskId);
  return `하위 업무${subTask?.title ? ` · ${subTask.title}` : ''}`;
}

function renderNotePanelHistory(currentNote, notes) {
  const section = document.getElementById('note-panel-history-section');
  const list = document.getElementById('note-panel-history');
  const count = document.getElementById('note-panel-history-count');
  if (!section || !list) return;

  const targetTaskId = String(currentNote.taskId || '');
  const currentTime = getNoteSortTime(currentNote);
  const historyNotes = (Array.isArray(notes) ? notes : [])
    .filter(note => {
      if (!note || note.id === currentNote.id) return false;
      if (String(note.taskId || '') !== targetTaskId) return false;
      return getNoteSortTime(note) < currentTime;
    })
    .sort((a, b) => getNoteSortTime(b) - getNoteSortTime(a));

  list.innerHTML = '';
  if (count) count.textContent = `${historyNotes.length}건`;
  if (!historyNotes.length) {
    section.classList.add('hidden');
    return;
  }

  historyNotes.forEach(note => {
    const item = document.createElement('article');
    item.dataset.noteHistoryId = note.id || '';
    item.className = 'rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40';
    item.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="truncate text-xs font-bold text-slate-700 dark:text-slate-200">${escapeHTML(note.title || '(제목 없음)')}</div>
          <div class="mt-0.5 text-[10px] font-semibold text-slate-400">${escapeHTML(getNoteScopeLabel(note))} · ${formatNoteDate(note)} · ${escapeHTML((note.createdByName || '').split('@')[0] || '알 수 없음')}</div>
        </div>
        <span class="shrink-0 rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">과거 기록</span>
      </div>
      <div class="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600 dark:text-slate-400" data-note-history-body></div>
    `;
    const historyBody = item.querySelector('[data-note-history-body]');
    if (note.body || note.bodyHtml) renderNoteBody(historyBody, note);
    else historyBody.innerHTML = '<span class="italic text-slate-400">(내용 없음)</span>';
    list.appendChild(item);
  });
  section.classList.remove('hidden');
}

async function loadNotePanelHistory(note) {
  const section = document.getElementById('note-panel-history-section');
  const list = document.getElementById('note-panel-history');
  const count = document.getElementById('note-panel-history-count');
  if (!section || !list) return;

  const requestId = ++_notePanelHistoryRequestId;
  section.classList.remove('hidden');
  list.innerHTML = '<p class="py-2 text-center text-[11px] text-slate-400">이전 메모를 불러오는 중...</p>';
  if (count) count.textContent = '';
  const targetTaskId = String(note.taskId || '');
  const notes = targetTaskId && typeof window.db_fetchProgressNotes === 'function'
    ? await window.db_fetchProgressNotes(targetTaskId)
    : [];
  if (requestId !== _notePanelHistoryRequestId || _currentNotePanelNote?.id !== note.id) return;
  renderNotePanelHistory(note, notes);
}

function setNotePanel_readMode(note) {
  const title = document.getElementById('note-panel-title');
  const meta  = document.getElementById('note-panel-meta');
  const body  = document.getElementById('note-panel-body');
  const fields = document.getElementById('note-panel-fields');
  const readMode = document.getElementById('note-panel-read-mode');
  const editMode = document.getElementById('note-panel-edit-mode');
  const readActions = document.getElementById('note-panel-read-actions');
  const editActions = document.getElementById('note-panel-edit-actions');

  if (title) title.textContent = note.title || '(제목 없음)';
  if (meta)  meta.textContent  = `${(note.createdByName || '').split('@')[0] || '알 수 없음'} · 기록일 ${formatNoteDate(note)}`;
  renderNoteBody(body, note);
  if (fields) {
    const values = [
      note.customerName ? `고객사 · ${note.customerName}` : '',
      note.oppNo ? `Opp No · ${note.oppNo}` : '',
      (note.workTypeLabel || note.workType) ? `업무 유형 · ${note.workTypeLabel || note.workType}` : ''
    ].filter(Boolean);
    fields.innerHTML = values.map(value =>
      `<span class="rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">${escapeHTML(value)}</span>`
    ).join('');
  }
  renderNotePanelComments(note);

  readMode?.classList.remove('hidden');
  editMode?.classList.add('hidden');
  readActions?.classList.remove('hidden');
  editActions?.classList.add('hidden');
}

function setNotePanel_editMode(note) {
  const readMode   = document.getElementById('note-panel-read-mode');
  const editMode   = document.getElementById('note-panel-edit-mode');
  const readActions= document.getElementById('note-panel-read-actions');
  const editActions= document.getElementById('note-panel-edit-actions');
  const editTitle  = document.getElementById('input-note-edit-title');
  const editDate   = document.getElementById('input-note-edit-date');
  const editBody   = document.getElementById('input-note-edit-body');
  const editCustomer = document.getElementById('input-note-edit-customer');
  const editOppNo = document.getElementById('input-note-edit-opp-no');
  const editWorkType = document.getElementById('input-note-edit-work-type');

  if (editTitle) editTitle.value = note.title || '';
  if (editDate)  editDate.value  = getNoteDateValue(note);
  if (editCustomer) editCustomer.value = note.customerName || '';
  if (editOppNo) editOppNo.value = note.oppNo || '';
  populateNoteWorkTypeSelect(editWorkType, note.workType || '');
  setNoteEditorContent(editBody, note);

  readMode?.classList.add('hidden');
  editMode?.classList.remove('hidden');
  readActions?.classList.add('hidden');
  editActions?.classList.remove('hidden');
}

const _noteEditorRanges = new Map();
let _noteFormattingInitialized = false;
let _noteTypeSettingsInitialized = false;
let _progressNotesInitialized = false;

function restoreNoteEditorRange(editor) {
  const range = _noteEditorRanges.get(editor?.id);
  if (!editor || !range || typeof window.getSelection !== 'function') return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function initNoteFormattingEvents() {
  if (_noteFormattingInitialized) return;
  _noteFormattingInitialized = true;
  document.addEventListener('selectionchange', () => {
    if (typeof window.getSelection !== 'function') return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const node = selection.anchorNode?.nodeType === 3 ? selection.anchorNode.parentElement : selection.anchorNode;
    const editor = node?.closest?.('[contenteditable="true"]');
    if (editor?.id) _noteEditorRanges.set(editor.id, selection.getRangeAt(0).cloneRange());
  });

  document.querySelectorAll('[data-note-command]').forEach(button => {
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => {
      const editor = document.getElementById(button.dataset.noteEditor || '');
      if (!editor) return;
      editor.focus();
      restoreNoteEditorRange(editor);
      document.execCommand(button.dataset.noteCommand, false, null);
    });
  });

  document.querySelectorAll('[data-note-color]').forEach(input => {
    input.addEventListener('change', () => {
      const editor = document.getElementById(input.dataset.noteEditor || '');
      if (!editor) return;
      editor.focus();
      restoreNoteEditorRange(editor);
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('foreColor', false, input.value);
    });
  });
}

function renderNoteTypeSettings(options = getCurrentNoteWorkTypes()) {
  const list = document.getElementById('note-type-settings-list');
  if (!list) return;
  list.innerHTML = '';
  normalizeNoteWorkTypes(options).forEach(option => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.dataset.noteTypeId = option.id;
    row.innerHTML = `
      <input type="text" maxlength="60" value="${escapeHTML(option.label)}"
        class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
      <button type="button" data-remove-note-type class="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-600">삭제</button>
    `;
    row.querySelector('[data-remove-note-type]')?.addEventListener('click', () => row.remove());
    list.appendChild(row);
  });
}

function openNoteTypeSettings() {
  const tracker = Array.isArray(trackers) ? trackers.find(item => item.id === currentTrackerId) : null;
  if (typeof window.hasTrackerWritePermission === 'function' && !window.hasTrackerWritePermission(tracker)) {
    showToast('업무 유형 설정은 트래커 소유자 또는 관리자만 변경할 수 있습니다.', false);
    return;
  }
  renderNoteTypeSettings();
  document.getElementById('modal-note-type-settings')?.classList.remove('hidden');
}

function closeNoteTypeSettings() {
  document.getElementById('modal-note-type-settings')?.classList.add('hidden');
}

function initNoteTypeSettingsEvents() {
  if (_noteTypeSettingsInitialized) return;
  _noteTypeSettingsInitialized = true;
  document.getElementById('btn-open-note-type-settings')?.addEventListener('click', openNoteTypeSettings);
  ['btn-close-note-type-settings', 'btn-cancel-note-type-settings', 'note-type-settings-backdrop'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', closeNoteTypeSettings);
  });
  document.getElementById('btn-add-note-type')?.addEventListener('click', () => {
    const current = [...document.querySelectorAll('#note-type-settings-list [data-note-type-id]')].map(row => ({
      id: row.dataset.noteTypeId,
      label: row.querySelector('input')?.value || ''
    }));
    current.push({ id: `TYPE_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, label: '새 업무 유형' });
    renderNoteTypeSettings(current);
    document.querySelector('#note-type-settings-list [data-note-type-id]:last-child input')?.select();
  });
  document.getElementById('btn-save-note-type-settings')?.addEventListener('click', async () => {
    const options = normalizeNoteWorkTypes(
      [...document.querySelectorAll('#note-type-settings-list [data-note-type-id]')].map(row => ({
        id: row.dataset.noteTypeId,
        label: row.querySelector('input')?.value || ''
      }))
    );
    if (!options.length) {
      showToast('업무 유형을 하나 이상 남겨주세요.', false);
      return;
    }
    const result = await window.db_updateTracker?.(currentTrackerId, { noteTypeOptions: options });
    if (!result?.success) {
      showToast(`업무 유형 저장 실패: ${result?.error || '알 수 없는 오류'}`, false);
      return;
    }
    populateNoteWorkTypeSelect(document.getElementById('input-note-work-type'));
    if (_currentNotePanelNote) {
      populateNoteWorkTypeSelect(document.getElementById('input-note-edit-work-type'), _currentNotePanelNote.workType || '');
    }
    closeNoteTypeSettings();
    showToast('메모 업무 유형 설정이 저장되었습니다.');
  });
}

// ─── 이벤트 바인딩 ───────────────────────────────────────
function initProgressNotesEvents() {
  if (_progressNotesInitialized) return;
  _progressNotesInitialized = true;
  // 메모 추가 버튼 (폼 토글)
  document.getElementById('btn-add-progress-note')?.addEventListener('click', () => {
    const form = document.getElementById('progress-note-add-form');
    if (!form) return;
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      document.getElementById('input-note-title').value = '';
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      document.getElementById('input-note-date').value = typeof getTodayStr === 'function' ? getTodayStr() : localToday;
      document.getElementById('input-note-customer').value = '';
      document.getElementById('input-note-opp-no').value = '';
      const legacyWorkType = tasks.find(task => task.id === _currentNoteTaskId)?.taskType || '';
      populateNoteWorkTypeSelect(document.getElementById('input-note-work-type'), legacyWorkType);
      document.getElementById('input-note-body').innerHTML = '';
      document.getElementById('input-note-body').focus();
    }
  });

  // 메모 추가 취소
  document.getElementById('btn-cancel-note-add')?.addEventListener('click', () => {
    document.getElementById('progress-note-add-form')?.classList.add('hidden');
  });

  // 메모 저장
  document.getElementById('btn-save-progress-note')?.addEventListener('click', async () => {
    if (!_currentNoteTaskId) return;
    const scopeSelect = document.getElementById('input-note-scope');
    const targetTaskId = scopeSelect?.value || _currentNoteTaskId;

    const titleEl = document.getElementById('input-note-title');
    const dateEl  = document.getElementById('input-note-date');
    const bodyEl  = document.getElementById('input-note-body');
    const { body, bodyHtml } = readNoteEditor(bodyEl);
    if (!body) { showToast('메모 내용을 입력해 주세요.', false); return; }
    if (body.length > 2000) { showToast('메모 내용은 2,000자 이내로 입력해 주세요.', false); return; }
    const title = titleEl?.value?.trim() || '';
    const noteDate = dateEl?.value || '';
    const customerName = document.getElementById('input-note-customer')?.value?.trim() || '';
    const oppNo = document.getElementById('input-note-opp-no')?.value?.trim() || '';
    const workTypeInfo = getSelectedNoteWorkType(document.getElementById('input-note-work-type'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) { showToast('기록일을 선택해 주세요.', false); return; }

    const saveBtn = document.getElementById('btn-save-progress-note');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }
    const result = await window.db_addProgressNote?.(targetTaskId, {
      title,
      body,
      bodyHtml,
      noteDate,
      customerName,
      oppNo,
      ...workTypeInfo
    });
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }

    if (result && result.success) {
      showToast('진행 메모가 저장되었습니다.');
      document.getElementById('progress-note-add-form')?.classList.add('hidden');
      await loadTaskHistory(_currentNoteTaskId, 1);
    } else {
      const errMsg = result?.error || '알 수 없는 오류';
      showToast(`저장 실패: ${errMsg}`, false);
    }
  });

  // 슬라이드오버 닫기
  document.getElementById('btn-close-note-panel')?.addEventListener('click', closeNoteDetailPanel);
  document.getElementById('note-panel-backdrop')?.addEventListener('click', closeNoteDetailPanel);

  document.getElementById('btn-add-note-review-comment')?.addEventListener('click', async () => {
    if (!_currentNotePanelNote) return;
    const input = document.getElementById('input-note-review-comment');
    const body = input?.value?.trim() || '';
    if (!body) {
      showToast('리뷰 코멘트를 입력해 주세요.', false);
      return;
    }
    const button = document.getElementById('btn-add-note-review-comment');
    if (button) button.disabled = true;
    const result = await window.db_addProgressNoteComment?.(
      _currentNotePanelNote.id,
      _currentNotePanelNote.taskId,
      body
    );
    if (button) button.disabled = false;
    if (!result?.success) {
      showToast(`코멘트 등록 실패: ${result?.error || '알 수 없는 오류'}`, false);
      return;
    }
    _currentNotePanelNote = {
      ..._currentNotePanelNote,
      reviewComments: [...(_currentNotePanelNote.reviewComments || []), result.comment]
    };
    if (input) input.value = '';
    renderNotePanelComments(_currentNotePanelNote);
    showToast('리뷰 코멘트가 등록되었습니다.');
    _cachedFeedItems = [];
    if (_currentNoteTaskId) await loadTaskHistory(_currentNoteTaskId, _currentFeedPage);
    if (typeof renderActiveViews === 'function') renderActiveViews();
  });

  // 수정 버튼
  document.getElementById('btn-note-edit')?.addEventListener('click', () => {
    if (_currentNotePanelNote) setNotePanel_editMode(_currentNotePanelNote);
  });

  // 수정 취소
  document.getElementById('btn-note-edit-cancel')?.addEventListener('click', () => {
    if (_currentNotePanelNote) setNotePanel_readMode(_currentNotePanelNote);
  });

  // 수정 저장
  document.getElementById('btn-note-edit-save')?.addEventListener('click', async () => {
    if (!_currentNotePanelNote) return;
    const title = document.getElementById('input-note-edit-title')?.value?.trim() || '';
    const noteDate = document.getElementById('input-note-edit-date')?.value || '';
    const { body, bodyHtml } = readNoteEditor(document.getElementById('input-note-edit-body'));
    if (!body) { showToast('메모 내용을 입력해 주세요.', false); return; }
    if (body.length > 2000) { showToast('메모 내용은 2,000자 이내로 입력해 주세요.', false); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(noteDate)) { showToast('기록일을 선택해 주세요.', false); return; }
    const customerName = document.getElementById('input-note-edit-customer')?.value?.trim() || '';
    const oppNo = document.getElementById('input-note-edit-opp-no')?.value?.trim() || '';
    const workTypeInfo = getSelectedNoteWorkType(document.getElementById('input-note-edit-work-type'));

    const result = await window.db_updateProgressNote?.(_currentNotePanelNote.id, {
      title,
      body,
      bodyHtml,
      noteDate,
      customerName,
      oppNo,
      ...workTypeInfo,
      taskId: _currentNotePanelNote.taskId
    });
    if (result && result.success) {
      _currentNotePanelNote = {
        ..._currentNotePanelNote,
        title,
        body,
        bodyHtml,
        noteDate,
        customerName,
        oppNo,
        ...workTypeInfo
      };
      setNotePanel_readMode(_currentNotePanelNote);
      await loadNotePanelHistory(_currentNotePanelNote);
      showToast('메모가 수정되었습니다.');
      _cachedFeedItems = [];
      if (_currentNoteTaskId) await loadTaskHistory(_currentNoteTaskId, _currentFeedPage);
      if (typeof renderActiveViews === 'function') renderActiveViews();
    } else {
      const errMsg = result?.error || '알 수 없는 오류';
      showToast(`수정 실패: ${errMsg}`, false);
    }
  });

  // 삭제 버튼
  document.getElementById('btn-note-delete')?.addEventListener('click', async () => {
    if (!_currentNotePanelNote) return;
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;
    const noteTaskId = _currentNotePanelNote.taskId || _currentNoteTaskId;
    const result = await window.db_deleteProgressNote?.(_currentNotePanelNote.id, noteTaskId);
    if (result && result.success) {
      closeNoteDetailPanel();
      showToast('메모가 삭제되었습니다.');
      if (_currentNoteTaskId) await loadTaskHistory(_currentNoteTaskId, 1);
      if (typeof renderActiveViews === 'function') renderActiveViews();
    } else {
      const errMsg = result?.error || '알 수 없는 오류';
      showToast(`삭제 실패: ${errMsg}`, false);
    }
  });
}


window.closeKpiSettingsModal = closeKpiSettingsModal;
window.renderTrackerAccessControl = renderTrackerAccessControl;

// ──────────────────────────────────────────────────────
// 하위 업무 진행 메모(Sub-task Progress Notes) 통합 라우터
// ──────────────────────────────────────────────────────
window.openSubTaskNoteModal = async function(index) {
  const st = currentSubTasks[index];
  if (!st || !_currentNoteTaskId) {
    showToast('신규 업무는 먼저 저장한 후에 메모를 등록할 수 있습니다.', false);
    return;
  }
  
  // 1. 메모 작성 폼 활성화
  const form = document.getElementById('progress-note-add-form');
  if (form && form.classList.contains('hidden')) {
    form.classList.remove('hidden');
  }

  // 2. 기록 대상 자동 세팅
  const scopeSelect = document.getElementById('input-note-scope');
  if (scopeSelect) {
    scopeSelect.value = `${_currentNoteTaskId}__sub_${st.id}`;
  }

  // 3. 필드 클리어 및 포커스
  const titleEl = document.getElementById('input-note-title');
  const bodyEl = document.getElementById('input-note-body');
  if (titleEl) titleEl.value = '';
  if (bodyEl) {
    bodyEl.innerHTML = '';
    bodyEl.focus();
  }
  populateNoteWorkTypeSelect(document.getElementById('input-note-work-type'));

  // 4. 작성 폼으로 부드러운 스크롤 이동
  if (form) {
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initNoteFormattingEvents();
    initNoteTypeSettingsEvents();
    initProgressNotesEvents();
  });
} else {
  initNoteFormattingEvents();
  initNoteTypeSettingsEvents();
  initProgressNotesEvents();
}

window.openNoteDetailPanel = openNoteDetailPanel;
window.closeNoteDetailPanel = closeNoteDetailPanel;
