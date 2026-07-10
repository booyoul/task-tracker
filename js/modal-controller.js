console.info('Smart Task Flow modal-controller.js v20260701-v2 loaded');
// Task modal, subtask modal list, tracker modal, and form submit handlers.
function resetSubTaskButton() {
  const btn = document.getElementById('btn-add-subtask');
  if (!btn) return;
  btn.textContent = '추가';
  btn.className = 'rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition shrink-0 ml-auto';
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
  const payload = { title, assignee, startDate: startInput?.value || getTodayStr(), dueDate: dueInput?.value || getTodayStr() };
  if (editingSubTaskIndex > -1 && currentSubTasks[editingSubTaskIndex]) {
    currentSubTasks[editingSubTaskIndex] = { ...currentSubTasks[editingSubTaskIndex], ...payload, status: normalizeStatus(currentSubTasks[editingSubTaskIndex].status) };
    editingSubTaskIndex = -1;
    resetSubTaskButton();
  } else {
    currentSubTasks.push({ id: 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), status: 'PENDING', ...payload });
  }
  if (titleInput) titleInput.value = '';
  resetSubtaskAssigneeDropdown();
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
    const subAssigneeLabel = Array.isArray(st.assignee) ? st.assignee.join(', ') : (st.assignee || '미정');
    const subNoteCount = _currentSubNoteCounts[st.id] || 0;
    const noteBtnText = subNoteCount > 0 ? `📌 ${subNoteCount}` : '📌';
    const noteBtnHtml = _currentNoteTaskId 
      ? `<button type="button" class="btn-modal-note-subtask px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold transition flex items-center gap-1" data-index="${idx}" title="진행 메모 관리">${noteBtnText}</button><span class="text-slate-300">|</span>` 
      : '';
    li.innerHTML = `<div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-2"><span class="shrink-0 font-bold ${status === 'COMPLETED' ? 'text-emerald-600' : overdue ? 'text-rose-600' : status === 'PROGRESS' ? 'text-blue-600' : 'text-amber-500'}">${overdue ? '🚨 기한 초과' : getStatusIcon(status) + ' ' + getStatusKorean(status).replace('됨', '')}</span><span class="min-w-0 flex-1 truncate font-medium text-slate-700 ${status === 'COMPLETED' ? 'line-through opacity-50' : ''}" title="${escapeHTML(st.title)}">${escapeHTML(st.title)}</span><span class="shrink-0 text-[10px] text-slate-400 font-semibold">📅 ${st.startDate ? st.startDate.substring(5) : '미정'} ~ ${st.dueDate ? st.dueDate.substring(5) : '미정'}</span><span class="shrink-0 max-w-[120px] truncate bg-indigo-50 text-indigo-700 border border-indigo-100 px-1 py-0.2 rounded text-[9px] font-bold" title="${escapeHTML(subAssigneeLabel)}">👤 ${escapeHTML(subAssigneeLabel)}</span></div><div class="flex shrink-0 items-center justify-end gap-1.5">${noteBtnHtml}<select class="sel-modal-subtask-status rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 outline-none focus:border-indigo-500" data-index="${idx}"><option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>진행 대기</option><option value="PROGRESS" ${status === 'PROGRESS' ? 'selected' : ''}>진행 중</option><option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>완료</option></select><button type="button" class="btn-modal-edit-subtask px-1 font-bold text-indigo-600 hover:text-indigo-800" data-index="${idx}">수정</button><span class="text-slate-300">|</span><button type="button" class="btn-modal-delete-subtask px-1 font-semibold text-rose-500 hover:text-rose-700" data-index="${idx}">삭제</button></div>`;
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
  setVal('input-subtask-title', '');
  resetSubtaskAssigneeDropdown();
  setVal('input-subtask-start', getTodayStr()); setVal('input-subtask-due', getFutureDateStr(7));
  editingSubTaskIndex = -1; resetSubTaskButton();
  const title = document.getElementById('modal-title');
  if (id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    if (title) title.textContent = '업무 상세 변경';
    setVal('input-task-id', t.id); setVal('input-task-title', t.title || ''); setVal('input-task-start', t.startDate || ''); setVal('input-task-due', t.dueDate || ''); setVal('input-task-priority', t.priority || 'NORMAL'); setVal('input-task-status', t.status || 'PENDING'); setVal('input-task-industry', t.industry || 'AUTO'); setVal('input-task-type', t.taskType || 'GENERAL'); setVal('input-task-notes', t.notes || '');
    currentSubTasks = Array.isArray(t.subTasks) ? JSON.parse(JSON.stringify(t.subTasks)).map(st => ({ ...st, status: normalizeStatus(st.status) })) : [];
  } else {
    if (title) title.textContent = '새로운 업무 배정';
    setVal('input-task-id', ''); setVal('input-task-start', getTodayStr()); setVal('input-task-due', getFutureDateStr(7)); setVal('input-task-industry', 'AUTO'); setVal('input-task-type', 'GENERAL');
    currentSubTasks = [];
  }
  renderModalSubTasks();

  // Load and render Task Activity Logs (Timeline)
  const activitySection = document.getElementById('task-activity-log-section');
  const activityContainer = document.getElementById('task-activity-log-container');
  if (activitySection) {
    if (id) {
      activitySection.classList.remove('hidden');
      if (activityContainer) {
        activityContainer.innerHTML = '<div class="text-slate-400 text-center py-2">변경 이력을 로드하는 중...</div>';
        if (typeof window.db_fetchActivityLogs === 'function') {
          window.db_fetchActivityLogs(id).then(logs => {
            if (!logs || logs.length === 0) {
              activityContainer.innerHTML = '<div class="text-slate-400 text-center py-2">변경 이력이 없습니다.</div>';
              return;
            }
            activityContainer.innerHTML = logs.map(log => {
              const dateStr = log.timestamp && typeof log.timestamp.toDate === 'function' 
                ? log.timestamp.toDate().toLocaleString('ko-KR')
                : '방금 전';
              
              let actionText = '';
              if (log.action === 'CREATE') {
                actionText = '업무를 <strong>생성</strong>했습니다.';
              } else if (log.action === 'DELETE') {
                actionText = '업무를 <strong>삭제</strong>했습니다.';
              } else if (log.action === 'UPDATE' && log.changes) {
                const changes = log.changes;
                const changeDetails = [];
                Object.keys(changes).forEach(field => {
                  let fieldName = field;
                  if (field === 'title') fieldName = '업무명';
                  else if (field === 'status') fieldName = '상태';
                  else if (field === 'priority') fieldName = '우선순위';
                  else if (field === 'assignee') fieldName = '담당자';
                  else if (field === 'startDate') fieldName = '시작일';
                  else if (field === 'dueDate') fieldName = '마감일';
                  else if (field === 'notes') fieldName = '메모';
                  
                  const oldVal = changes[field].old;
                  const newVal = changes[field].new;
                  
                  const translateVal = (val) => {
                    if (val === 'PENDING') return '진행 대기';
                    if (val === 'PROGRESS') return '진행 중';
                    if (val === 'COMPLETED') return '완료됨';
                    return val;
                  };
                  
                  const oldLabel = translateVal(oldVal);
                  const newLabel = translateVal(newVal);
                  changeDetails.push(`<strong>${fieldName}</strong>을(를) '${oldLabel}'에서 '${newLabel}'(으)로 변경`);
                });
                actionText = changeDetails.join(', ') + '했습니다.';
              }
              
              return `
                <div class="flex items-start gap-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0 dark:border-slate-800">
                  <span class="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold shrink-0 dark:bg-slate-800 dark:text-slate-300">
                    👤 ${escapeHTML(log.changedByName?.split('@')[0] || '알 수 없음')}
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="leading-relaxed text-slate-750 dark:text-slate-200">${actionText}</p>
                    <span class="text-[9px] text-slate-400 font-semibold block mt-0.5">${dateStr}</span>
                  </div>
                </div>
              `;
            }).join('');
          }).catch(err => {
            console.error(err);
            activityContainer.innerHTML = '<div class="text-rose-500 text-center py-2">변경 이력을 로드하지 못했습니다.</div>';
          });
        }
      }
    } else {
      activitySection.classList.add('hidden');
      if (activityContainer) activityContainer.innerHTML = '';
    }
  }

  // Load and render Progress Notes
  const notesSection = document.getElementById('task-progress-notes-section');
  if (notesSection) {
    if (id) {
      notesSection.classList.remove('hidden');
      loadProgressNotes(id);
    } else {
      notesSection.classList.add('hidden');
      const list = document.getElementById('progress-notes-list');
      if (list) list.innerHTML = '';
      const addForm = document.getElementById('progress-note-add-form');
      if (addForm) addForm.classList.add('hidden');
    }
  }

  document.getElementById('modal-task')?.classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-task')?.classList.add('hidden'); }
function closeConfirmModal() { document.getElementById('modal-confirm')?.classList.add('hidden'); confirmActionCb = null; }
function openTrackerModal(id = null) {
  document.getElementById('form-tracker')?.reset();
  const del = document.getElementById('btn-delete-tracker');
  const saveBtn = document.getElementById('btn-save-tracker');
  const inputName = document.getElementById('input-tracker-name');
  const inputDesc = document.getElementById('input-tracker-desc');
  
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
  } else {
    document.getElementById('modal-tracker-title').textContent = '새 트래커 스페이스 추가';
    document.getElementById('input-tracker-id').value = '';
    if (inputName) inputName.readOnly = false;
    if (inputDesc) inputDesc.readOnly = false;
    del?.classList.add('hidden');
    saveBtn?.classList.remove('hidden');
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
window.closeTrackerModal = closeTrackerModal;
window.handleTrackerSubmit = handleTrackerSubmit;
window.handleTaskSubmit = handleTaskSubmit;
window.addSubTaskToModalList = addSubTaskToModalList;

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
        await window.db_updateTracker(currentTrackerId, payload);
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

// ─── 날짜 포맷 헬퍼 ───────────────────────────────────────
function formatNoteDate(ts) {
  if (!ts) return '';
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  const dateStr = formatNoteDate(note.createdAt);
  const author = escapeHTML((note.createdByName || '').split('@')[0] || '알 수 없음');

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
      <span class="text-[10px] text-slate-400">${author}</span>
    </div>
  `;
  card.addEventListener('click', () => openNoteDetailPanel(note));
  return card;
}

// ─── 메모 목록 로드 ───────────────────────────────────────
async function loadProgressNotes(taskId) {
  _currentNoteTaskId = taskId;
  const list = document.getElementById('progress-notes-list');
  const empty = document.getElementById('progress-notes-empty');
  if (!list) return;

  list.innerHTML = '<p class="text-center text-xs text-slate-400 py-3">로드 중...</p>';
  if (empty) empty.classList.add('hidden');

  const notes = typeof window.db_fetchProgressNotes === 'function'
    ? await window.db_fetchProgressNotes(taskId)
    : [];

  // Group subtask note counts
  _currentSubNoteCounts = {};
  notes.forEach(n => {
    if (n.taskId && n.taskId.includes('__sub_')) {
      const subId = n.taskId.split('__sub_')[1];
      _currentSubNoteCounts[subId] = (_currentSubNoteCounts[subId] || 0) + 1;
    }
  });

  // Update note counts on subtask row buttons
  renderModalSubTasks();

  list.innerHTML = '';
  if (notes.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  notes.forEach(note => list.appendChild(renderNoteCard(note)));
}

// ─── 슬라이드오버 패널 열기 ──────────────────────────────
function openNoteDetailPanel(note) {
  _currentNotePanelNote = note;
  const panel = document.getElementById('note-detail-panel');
  const backdrop = document.getElementById('note-panel-backdrop');
  if (!panel) return;

  // 읽기 모드로 초기화
  setNotePanel_readMode(note);

  panel.classList.remove('translate-x-full');
  panel.classList.add('translate-x-0');
  if (backdrop) backdrop.classList.remove('hidden');
}

function closeNoteDetailPanel() {
  const panel = document.getElementById('note-detail-panel');
  const backdrop = document.getElementById('note-panel-backdrop');
  if (panel) { panel.classList.add('translate-x-full'); panel.classList.remove('translate-x-0'); }
  if (backdrop) backdrop.classList.add('hidden');
  _currentNotePanelNote = null;
}

function setNotePanel_readMode(note) {
  const title = document.getElementById('note-panel-title');
  const meta  = document.getElementById('note-panel-meta');
  const body  = document.getElementById('note-panel-body');
  const readMode = document.getElementById('note-panel-read-mode');
  const editMode = document.getElementById('note-panel-edit-mode');
  const readActions = document.getElementById('note-panel-read-actions');
  const editActions = document.getElementById('note-panel-edit-actions');

  if (title) title.textContent = note.title || '(제목 없음)';
  if (meta)  meta.textContent  = `${(note.createdByName || '').split('@')[0] || '알 수 없음'} · ${formatNoteDate(note.createdAt)}`;
  if (body)  body.textContent  = note.body || '';

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
  const editBody   = document.getElementById('input-note-edit-body');

  if (editTitle) editTitle.value = note.title || '';
  if (editBody)  editBody.value  = note.body  || '';

  readMode?.classList.add('hidden');
  editMode?.classList.remove('hidden');
  readActions?.classList.add('hidden');
  editActions?.classList.remove('hidden');
}

// ─── 이벤트 바인딩 ───────────────────────────────────────
function initProgressNotesEvents() {
  // 메모 추가 버튼 (폼 토글)
  document.getElementById('btn-add-progress-note')?.addEventListener('click', () => {
    const form = document.getElementById('progress-note-add-form');
    if (!form) return;
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      document.getElementById('input-note-title').value = '';
      document.getElementById('input-note-body').value  = '';
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
    const titleEl = document.getElementById('input-note-title');
    const bodyEl  = document.getElementById('input-note-body');
    const body = bodyEl?.value?.trim() || '';
    if (!body) { showToast('메모 내용을 입력해 주세요.', false); return; }
    const title = titleEl?.value?.trim() || '';

    const saveBtn = document.getElementById('btn-save-progress-note');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }
    const result = await window.db_addProgressNote?.(_currentNoteTaskId, { title, body });
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }

    if (result && result.success) {
      showToast('진행 메모가 저장되었습니다.');
      document.getElementById('progress-note-add-form')?.classList.add('hidden');
      await loadProgressNotes(_currentNoteTaskId);
    } else {
      const errMsg = result?.error || '알 수 없는 오류';
      showToast(`저장 실패: ${errMsg}`, false);
    }
  });

  // 슬라이드오버 닫기
  document.getElementById('btn-close-note-panel')?.addEventListener('click', closeNoteDetailPanel);
  document.getElementById('note-panel-backdrop')?.addEventListener('click', closeNoteDetailPanel);

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
    const body  = document.getElementById('input-note-edit-body')?.value?.trim()  || '';
    if (!body) { showToast('메모 내용을 입력해 주세요.', false); return; }

    const result = await window.db_updateProgressNote?.(_currentNotePanelNote.id, { title, body });
    if (result && result.success) {
      _currentNotePanelNote = { ..._currentNotePanelNote, title, body };
      setNotePanel_readMode(_currentNotePanelNote);
      showToast('메모가 수정되었습니다.');
      if (_currentNoteTaskId) await loadProgressNotes(_currentNoteTaskId);
    } else {
      const errMsg = result?.error || '알 수 없는 오류';
      showToast(`수정 실패: ${errMsg}`, false);
    }
  });

  // 삭제 버튼
  document.getElementById('btn-note-delete')?.addEventListener('click', async () => {
    if (!_currentNotePanelNote || !_currentNoteTaskId) return;
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;
    const result = await window.db_deleteProgressNote?.(_currentNotePanelNote.id, _currentNoteTaskId);
    if (result && result.success) {
      closeNoteDetailPanel();
      showToast('메모가 삭제되었습니다.');
      await loadProgressNotes(_currentNoteTaskId);
    } else {
      const errMsg = result?.error || '알 수 없는 오류';
      showToast(`삭제 실패: ${errMsg}`, false);
    }
  });
}


window.closeKpiSettingsModal = closeKpiSettingsModal;

// ──────────────────────────────────────────────────────
// 하위 업무 진행 메모(Sub-task Progress Notes) 컨트롤러
// ──────────────────────────────────────────────────────
let _currentSubTaskId = null;
let _currentSubTaskTitle = "";
let _currentSubNotePanelNote = null;

window.openSubTaskNoteModal = async function(index) {
  const st = currentSubTasks[index];
  if (!st || !_currentNoteTaskId) {
    showToast('신규 업무는 먼저 저장한 후에 메모를 등록할 수 있습니다.', false);
    return;
  }
  _currentSubTaskId = st.id;
  _currentSubTaskTitle = st.title;
  
  const panel = document.getElementById('subtask-notes-panel');
  const backdrop = document.getElementById('subnote-panel-backdrop');
  const titleHeader = document.getElementById('subnote-panel-header-title');
  if (titleHeader) titleHeader.textContent = `하위 업무: ${st.title}`;

  // Reset to list mode
  setSubNotePanel_listMode();
  await loadSubtaskNotes();

  panel.classList.remove('translate-x-full');
  panel.classList.add('translate-x-0');
  if (backdrop) backdrop.classList.remove('hidden');
};

function closeSubtaskNotesPanel() {
  const panel = document.getElementById('subtask-notes-panel');
  const backdrop = document.getElementById('subnote-panel-backdrop');
  if (panel) { panel.classList.add('translate-x-full'); panel.classList.remove('translate-x-0'); }
  if (backdrop) backdrop.classList.add('hidden');
  _currentSubTaskId = null;
  _currentSubNotePanelNote = null;
}

function setSubNotePanel_listMode() {
  document.getElementById('subnote-list-view')?.classList.remove('hidden');
  document.getElementById('subnote-detail-view')?.classList.add('hidden');
  document.getElementById('subnote-edit-view')?.classList.add('hidden');
  document.getElementById('subnote-add-form')?.classList.add('hidden');
}

function setSubNotePanel_readMode(note) {
  _currentSubNotePanelNote = note;
  document.getElementById('subnote-list-view')?.classList.add('hidden');
  document.getElementById('subnote-detail-view')?.classList.remove('hidden');
  document.getElementById('subnote-edit-view')?.classList.add('hidden');

  const meta = document.getElementById('subnote-detail-meta');
  const body = document.getElementById('subnote-detail-body');
  if (meta) meta.textContent = `${(note.createdByName || '').split('@')[0] || '알 수 없음'} · ${formatNoteDate(note.createdAt)}`;
  if (body) body.textContent = note.body || '';
}

function setSubNotePanel_editMode(note) {
  document.getElementById('subnote-list-view')?.classList.add('hidden');
  document.getElementById('subnote-detail-view')?.classList.add('hidden');
  document.getElementById('subnote-edit-view')?.classList.remove('hidden');

  const editTitle = document.getElementById('input-subnote-edit-title');
  const editBody = document.getElementById('input-subnote-edit-body');
  if (editTitle) editTitle.value = note.title || '';
  if (editBody) editBody.value = note.body || '';
}

async function loadSubtaskNotes() {
  if (!_currentNoteTaskId || !_currentSubTaskId) return;
  const compositeId = `${_currentNoteTaskId}__sub_${_currentSubTaskId}`;
  const container = document.getElementById('subnote-cards-container');
  const empty = document.getElementById('subnote-list-empty');
  if (!container) return;

  container.innerHTML = '<p class="text-center text-xs text-slate-400 py-3">로드 중...</p>';
  if (empty) empty.classList.add('hidden');

  const notes = typeof window.db_fetchProgressNotes === 'function'
    ? await window.db_fetchProgressNotes(compositeId)
    : [];

  container.innerHTML = '';
  if (notes.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }

  notes.forEach(note => {
    const card = renderSubNoteCard(note);
    container.appendChild(card);
  });
}

function renderSubNoteCard(note) {
  const title = note.title ? escapeHTML(note.title) : '<span class="text-slate-400 italic">(제목 없음)</span>';
  const bodyPreview = escapeHTML((note.body || '').slice(0, 80)) + ((note.body || '').length > 80 ? '...' : '');
  const dateStr = formatNoteDate(note.createdAt);
  const author = escapeHTML((note.createdByName || '').split('@')[0] || '알 수 없음');

  const card = document.createElement('div');
  card.className = 'group flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 p-3 cursor-pointer transition dark:bg-slate-900/50 dark:border-slate-800 dark:hover:border-indigo-700';
  card.innerHTML = `
    <span class="text-sm mt-0.5 shrink-0">📌</span>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-1 mb-0.5">
        <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">${title}</span>
        <span class="text-[10px] text-slate-400 shrink-0">${dateStr}</span>
      </div>
      <p class="text-[11px] text-slate-500 leading-relaxed line-clamp-2">${bodyPreview || '<span class="italic">(내용 없음)</span>'}</p>
      <span class="text-[10px] text-slate-400">${author}</span>
    </div>
  `;
  card.addEventListener('click', () => setSubNotePanel_readMode(note));
  return card;
}

function initSubTaskNotesEvents() {
  document.getElementById('btn-close-subnote-panel')?.addEventListener('click', closeSubtaskNotesPanel);
  document.getElementById('subnote-panel-backdrop')?.addEventListener('click', closeSubtaskNotesPanel);

  // Add Note Button Toggle
  document.getElementById('btn-add-subnote')?.addEventListener('click', () => {
    const form = document.getElementById('subnote-add-form');
    if (!form) return;
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      document.getElementById('input-subnote-title').value = '';
      document.getElementById('input-subnote-body').value = '';
      document.getElementById('input-subnote-body').focus();
    }
  });

  // Cancel Add Note
  document.getElementById('btn-cancel-subnote-add')?.addEventListener('click', () => {
    document.getElementById('subnote-add-form')?.classList.add('hidden');
  });

  // Save Note
  document.getElementById('btn-save-subnote')?.addEventListener('click', async () => {
    if (!_currentNoteTaskId || !_currentSubTaskId) return;
    const compositeId = `${_currentNoteTaskId}__sub_${_currentSubTaskId}`;
    const titleEl = document.getElementById('input-subnote-title');
    const bodyEl = document.getElementById('input-subnote-body');
    const body = bodyEl?.value?.trim() || '';
    if (!body) { showToast('메모 내용을 입력해 주세요.', false); return; }
    const title = titleEl?.value?.trim() || '';

    const saveBtn = document.getElementById('btn-save-subnote');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }
    const result = await window.db_addProgressNote?.(compositeId, { 
      title: title || `[하위 업무] ${_currentSubTaskTitle}`, 
      body 
    });
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '저장'; }

    if (result && result.success) {
      showToast('하위 업무 메모가 저장되었습니다.');
      document.getElementById('subnote-add-form')?.classList.add('hidden');
      await loadSubtaskNotes();
    } else {
      const errMsg = result?.error || '알 수 없는 오류';
      showToast(`저장 실패: ${errMsg}`, false);
    }
  });

  // Back to list
  document.getElementById('btn-back-to-subnote-list')?.addEventListener('click', setSubNotePanel_listMode);

  // Edit Button
  document.getElementById('btn-subnote-edit')?.addEventListener('click', () => {
    if (_currentSubNotePanelNote) setSubNotePanel_editMode(_currentSubNotePanelNote);
  });

  // Cancel Edit
  document.getElementById('btn-subnote-edit-cancel')?.addEventListener('click', () => {
    if (_currentSubNotePanelNote) setSubNotePanel_readMode(_currentSubNotePanelNote);
  });

  // Save Edit
  document.getElementById('btn-subnote-edit-save')?.addEventListener('click', async () => {
    if (!_currentSubNotePanelNote) return;
    const title = document.getElementById('input-subnote-edit-title')?.value?.trim() || '';
    const body = document.getElementById('input-subnote-edit-body')?.value?.trim() || '';
    if (!body) { showToast('메모 내용을 입력해 주세요.', false); return; }

    const result = await window.db_updateProgressNote?.(_currentSubNotePanelNote.id, { title, body });
    if (result && result.success) {
      _currentSubNotePanelNote = { ..._currentSubNotePanelNote, title, body };
      setSubNotePanel_readMode(_currentSubNotePanelNote);
      showToast('메모가 수정되었습니다.');
      await loadSubtaskNotes();
    } else {
      const errMsg = result?.error || '알 수 없는 오류';
      showToast(`수정 실패: ${errMsg}`, false);
    }
  });

  // Delete Button
  document.getElementById('btn-subnote-delete')?.addEventListener('click', async () => {
    if (!_currentSubNotePanelNote || !_currentNoteTaskId || !_currentSubTaskId) return;
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;
    const compositeId = `${_currentNoteTaskId}__sub_${_currentSubTaskId}`;
    const result = await window.db_deleteProgressNote?.(_currentSubNotePanelNote.id, compositeId);
    if (result && result.success) {
      setSubNotePanel_listMode();
      showToast('메모가 삭제되었습니다.');
      await loadSubtaskNotes();
    } else {
      const errMsg = result?.error || '알 수 없는 오류';
      showToast(`삭제 실패: ${errMsg}`, false);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initProgressNotesEvents();
    initSubTaskNotesEvents();
  });
} else {
  initProgressNotesEvents();
  initSubTaskNotesEvents();
}


