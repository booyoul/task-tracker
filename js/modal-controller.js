console.info('Smart Task Flow modal-controller.js v20260626-module-split-phase6-modal-controller loaded');
// Task modal, subtask modal list, tracker modal, and form submit handlers.
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

