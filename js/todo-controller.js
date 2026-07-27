console.info('Smart Task Flow todo-controller.js v20260727-v1 loaded');

let todoDateFilter = 'TODAY';
let todoCompletionFilter = 'ACTIVE';
let todoSearchText = '';
let todoReminderSnapshotKey = '';

function addDaysToDateString(dateString, days) {
  const [year, month, day] = String(dateString || '').split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthRange(dateString) {
  const [year, month] = String(dateString || '').split('-').map(Number);
  const end = new Date(year, month, 0);
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  };
}

function todoOverlapsRange(todo, rangeStart, rangeEnd) {
  const start = todo.startDate || todo.dueDate || '';
  const end = todo.dueDate || todo.startDate || '';
  return !!start && !!end && start <= rangeEnd && end >= rangeStart;
}

function isTodoOverdue(todo, today = getTodayStr()) {
  return todo.completed !== true && !!todo.dueDate && todo.dueDate < today;
}

function matchesTodoDateFilter(todo, filter = todoDateFilter, today = getTodayStr()) {
  if (filter === 'ALL') return true;
  if (filter === 'OVERDUE') return isTodoOverdue(todo, today);
  if (filter === 'TODAY') return isTodoOverdue(todo, today) || todoOverlapsRange(todo, today, today);
  if (filter === 'WEEK') return todoOverlapsRange(todo, today, addDaysToDateString(today, 7));
  if (filter === 'MONTH') {
    const range = getMonthRange(today);
    return todoOverlapsRange(todo, range.start, range.end);
  }
  return true;
}

function getTodoFilterCounts(items = todoItems, today = getTodayStr()) {
  const active = items.filter(item => item.completed !== true);
  const monthRange = getMonthRange(today);
  return {
    TODAY: active.filter(item => matchesTodoDateFilter(item, 'TODAY', today)).length,
    WEEK: active.filter(item => todoOverlapsRange(item, today, addDaysToDateString(today, 7))).length,
    MONTH: active.filter(item => todoOverlapsRange(item, monthRange.start, monthRange.end)).length,
    OVERDUE: active.filter(item => isTodoOverdue(item, today)).length,
    ALL: active.length
  };
}

function getVisibleTodos(items = todoItems) {
  const search = todoSearchText.trim().toLowerCase();
  return items.filter(item => {
    if (todoCompletionFilter === 'ACTIVE' && item.completed === true) return false;
    if (todoCompletionFilter === 'COMPLETED' && item.completed !== true) return false;
    if (!matchesTodoDateFilter(item)) return false;
    if (search && !`${item.title || ''} ${item.memo || ''}`.toLowerCase().includes(search)) return false;
    return true;
  }).sort((a, b) => {
    const overdueOrder = Number(isTodoOverdue(b)) - Number(isTodoOverdue(a));
    if (overdueOrder) return overdueOrder;
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    return String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
      || String(a.startDate || '').localeCompare(String(b.startDate || ''))
      || String(a.title || '').localeCompare(String(b.title || ''), 'ko');
  });
}

function getTodoDateLabel(todo, today = getTodayStr()) {
  if (isTodoOverdue(todo, today)) return { label: `기한 경과 · ${todo.dueDate}`, className: 'border-rose-200 bg-rose-50 text-rose-700' };
  if (todoOverlapsRange(todo, today, today)) return { label: '오늘 할 일', className: 'border-indigo-200 bg-indigo-50 text-indigo-700' };
  return { label: `${todo.startDate} ~ ${todo.dueDate}`, className: 'border-slate-200 bg-slate-50 text-slate-600' };
}

function renderTodoView() {
  const container = document.getElementById('todo-list');
  if (!container) return;
  const counts = getTodoFilterCounts();
  Object.entries(counts).forEach(([key, value]) => {
    const count = document.getElementById(`todo-count-${key.toLowerCase()}`);
    if (count) count.textContent = value;
  });

  document.querySelectorAll('[data-todo-date-filter]').forEach(button => {
    const active = button.dataset.todoDateFilter === todoDateFilter;
    button.className = active
      ? 'rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition'
      : 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700';
  });
  const completion = document.getElementById('todo-completion-filter');
  if (completion) completion.value = todoCompletionFilter;
  const search = document.getElementById('todo-search');
  if (search && search.value !== todoSearchText) search.value = todoSearchText;

  const visible = getVisibleTodos();
  const resultCount = document.getElementById('todo-result-count');
  if (resultCount) resultCount.textContent = `${visible.length}개`;
  container.innerHTML = '';
  if (!visible.length) {
    container.innerHTML = `<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <div class="text-3xl">✓</div>
      <p class="mt-3 text-sm font-bold text-slate-600">조건에 맞는 To-do가 없습니다.</p>
      <p class="mt-1 text-xs text-slate-400">새로운 할 일을 등록하거나 조회 조건을 바꿔보세요.</p>
    </div>`;
    return;
  }

  visible.forEach(todo => {
    const dateLabel = getTodoDateLabel(todo);
    const card = document.createElement('article');
    card.className = `rounded-2xl border p-4 shadow-sm transition ${todo.completed ? 'border-slate-100 bg-slate-50/70 opacity-75' : isTodoOverdue(todo) ? 'border-rose-200 bg-rose-50/40' : 'border-slate-100 bg-white hover:border-indigo-200'}`;
    card.dataset.todoId = todo.id;
    card.innerHTML = `
      <div class="flex items-start gap-3">
        <label class="mt-0.5 shrink-0 cursor-pointer" title="${todo.completed ? '미완료로 되돌리기' : '완료 처리'}">
          <input type="checkbox" class="todo-complete-toggle h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" data-id="${escapeHTML(todo.id)}" ${todo.completed ? 'checked' : ''}>
        </label>
        <div class="min-w-0 flex-1">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <h3 class="break-words text-sm font-black text-slate-800 ${todo.completed ? 'line-through text-slate-400' : ''}">${escapeHTML(todo.title)}</h3>
              ${todo.memo ? `<p class="mt-1 break-words text-xs leading-relaxed text-slate-500">${escapeHTML(todo.memo)}</p>` : ''}
            </div>
            <div class="flex shrink-0 items-center gap-1.5 self-end sm:self-start">
              <button type="button" class="btn-edit-todo rounded-lg px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50" data-id="${escapeHTML(todo.id)}">수정</button>
              <button type="button" class="btn-delete-todo rounded-lg px-2 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50" data-id="${escapeHTML(todo.id)}">삭제</button>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="inline-flex rounded-lg border px-2 py-1 text-[11px] font-bold ${dateLabel.className}">${escapeHTML(dateLabel.label)}</span>
            <span class="text-[11px] font-semibold text-slate-400">📅 ${escapeHTML(todo.startDate)} ~ ${escapeHTML(todo.dueDate)}</span>
            ${todo.taskLink ? '<span class="inline-flex rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">업무 연결됨</span>' : ''}
          </div>
        </div>
      </div>`;
    container.appendChild(card);
  });
}

function openTodoModal(id = '') {
  const todo = id ? todoItems.find(item => item.id === id) : null;
  const today = getTodayStr();
  document.getElementById('todo-modal-title').textContent = todo ? 'To-do 수정' : '새 To-do';
  document.getElementById('input-todo-id').value = todo?.id || '';
  document.getElementById('input-todo-title').value = todo?.title || '';
  document.getElementById('input-todo-memo').value = todo?.memo || '';
  document.getElementById('input-todo-start').value = todo?.startDate || today;
  document.getElementById('input-todo-due').value = todo?.dueDate || today;
  document.getElementById('modal-todo')?.classList.remove('hidden');
  document.getElementById('input-todo-title')?.focus();
}

function closeTodoModal() {
  document.getElementById('modal-todo')?.classList.add('hidden');
  document.getElementById('form-todo')?.reset();
}

async function handleTodoSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('input-todo-id').value;
  const data = {
    title: document.getElementById('input-todo-title').value,
    memo: document.getElementById('input-todo-memo').value,
    startDate: document.getElementById('input-todo-start').value,
    dueDate: document.getElementById('input-todo-due').value,
    completed: id ? todoItems.find(item => item.id === id)?.completed === true : false,
    taskLink: id ? todoItems.find(item => item.id === id)?.taskLink : null
  };
  const validationMessage = validateTodoPayload(data);
  if (validationMessage) return showToast(validationMessage, false);
  const result = id ? await db_updateTodo(id, data) : await db_addTodo(data);
  if (!result?.success) return showToast(result?.error || 'To-do를 저장하지 못했습니다.', false);
  closeTodoModal();
  showToast(id ? 'To-do가 수정되었습니다.' : 'To-do가 추가되었습니다.');
}

function confirmTodoDelete(id) {
  const todo = todoItems.find(item => item.id === id);
  if (!todo) return;
  document.getElementById('confirm-title').textContent = 'To-do 삭제';
  document.getElementById('confirm-message').textContent = `'${todo.title}' 항목을 삭제하시겠습니까?`;
  confirmActionCb = async () => {
    const result = await db_deleteTodo(id);
    if (!result?.success) return showToast(result?.error || 'To-do를 삭제하지 못했습니다.', false);
    closeConfirmModal();
    showToast('To-do가 삭제되었습니다.');
  };
  document.getElementById('modal-confirm')?.classList.remove('hidden');
}

function openTodoViewFromHeader() {
  if (currentViewMode === 'TODO') {
    window.switchView?.(lastTaskViewMode || 'CALENDAR');
  } else {
    lastTaskViewMode = ['TABLE', 'CALENDAR', 'KANBAN', 'ADMIN'].includes(currentViewMode) ? currentViewMode : 'CALENDAR';
    window.switchView?.('TODO');
  }
}

function updateTodoReminderContent(overdueItems, todayItems) {
  const summary = document.getElementById('todo-reminder-summary');
  const list = document.getElementById('todo-reminder-list');
  if (summary) summary.textContent = `기한 경과 ${overdueItems.length}건 · 오늘 할 일 ${todayItems.length}건`;
  if (!list) return;
  const unique = [...overdueItems, ...todayItems.filter(item => !overdueItems.some(overdue => overdue.id === item.id))].slice(0, 5);
  list.innerHTML = unique.map(item => `
    <li class="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span class="min-w-0 break-words text-xs font-bold text-slate-700">${escapeHTML(item.title)}</span>
      <span class="shrink-0 text-[10px] font-semibold ${isTodoOverdue(item) ? 'text-rose-600' : 'text-indigo-600'}">${isTodoOverdue(item) ? '기한 경과' : '오늘'}</span>
    </li>`).join('');
}

function handleTodoInitialSnapshot() {
  const userId = window.currentUser?.uid || '';
  if (!userId) return;
  const today = getTodayStr();
  const snapshotKey = `${userId}:${today}`;
  if (todoReminderSnapshotKey === snapshotKey) return;
  todoReminderSnapshotKey = snapshotKey;
  const seenKey = `flow_todo_reminder_seen_${userId}_${today}`;
  const dismissedKey = `flow_todo_reminder_dismissed_${userId}`;
  try {
    if (sessionStorage.getItem(seenKey) === '1' || localStorage.getItem(dismissedKey) === today) return;
    sessionStorage.setItem(seenKey, '1');
  } catch (error) {
    console.warn('To-do 알림 표시 상태를 저장하지 못했습니다.', error);
  }
  const active = todoItems.filter(item => item.completed !== true);
  const overdueItems = active.filter(item => isTodoOverdue(item, today));
  const todayItems = active.filter(item => todoOverlapsRange(item, today, today));
  if (!overdueItems.length && !todayItems.length) return;
  updateTodoReminderContent(overdueItems, todayItems);
  document.getElementById('modal-todo-reminder')?.classList.remove('hidden');
}

function closeTodoReminder(dismissForToday = false) {
  if (dismissForToday && window.currentUser?.uid) {
    try {
      localStorage.setItem(`flow_todo_reminder_dismissed_${window.currentUser.uid}`, getTodayStr());
    } catch (error) {
      console.warn('To-do 오늘 알림 숨김 상태를 저장하지 못했습니다.', error);
    }
  }
  document.getElementById('modal-todo-reminder')?.classList.add('hidden');
}

function resetTodoReminderState() {
  todoReminderSnapshotKey = '';
  document.getElementById('modal-todo-reminder')?.classList.add('hidden');
}

function initTodoController() {
  if (window.__todoControllerInitialized) return;
  window.__todoControllerInitialized = true;
  document.getElementById('btn-open-todo')?.addEventListener('click', openTodoViewFromHeader);
  document.getElementById('btn-add-todo')?.addEventListener('click', () => openTodoModal());
  document.getElementById('btn-close-todo-modal')?.addEventListener('click', closeTodoModal);
  document.getElementById('btn-cancel-todo')?.addEventListener('click', closeTodoModal);
  document.getElementById('form-todo')?.addEventListener('submit', handleTodoSubmit);
  document.querySelectorAll('[data-todo-date-filter]').forEach(button => {
    button.addEventListener('click', () => {
      todoDateFilter = button.dataset.todoDateFilter || 'TODAY';
      renderTodoView();
    });
  });
  document.getElementById('todo-completion-filter')?.addEventListener('change', event => {
    todoCompletionFilter = event.target.value || 'ACTIVE';
    renderTodoView();
  });
  document.getElementById('todo-search')?.addEventListener('input', event => {
    todoSearchText = event.target.value || '';
    renderTodoView();
  });
  document.getElementById('todo-list')?.addEventListener('change', async event => {
    const checkbox = event.target.closest('.todo-complete-toggle');
    if (!checkbox) return;
    checkbox.disabled = true;
    const result = await db_updateTodo(checkbox.dataset.id, { completed: checkbox.checked });
    if (!result?.success) {
      checkbox.checked = !checkbox.checked;
      checkbox.disabled = false;
      showToast(result?.error || '완료 상태를 변경하지 못했습니다.', false);
    }
  });
  document.getElementById('todo-list')?.addEventListener('click', event => {
    const edit = event.target.closest('.btn-edit-todo');
    if (edit) return openTodoModal(edit.dataset.id);
    const remove = event.target.closest('.btn-delete-todo');
    if (remove) confirmTodoDelete(remove.dataset.id);
  });
  document.getElementById('btn-close-todo-reminder')?.addEventListener('click', () => closeTodoReminder(false));
  document.getElementById('btn-dismiss-todo-reminder-today')?.addEventListener('click', () => closeTodoReminder(true));
  document.getElementById('btn-view-todos-from-reminder')?.addEventListener('click', () => {
    closeTodoReminder(false);
    if (currentViewMode !== 'TODO') {
      lastTaskViewMode = ['TABLE', 'CALENDAR', 'KANBAN', 'ADMIN'].includes(currentViewMode) ? currentViewMode : 'CALENDAR';
      window.switchView?.('TODO');
    }
  });
}

window.addDaysToDateString = addDaysToDateString;
window.getMonthRange = getMonthRange;
window.todoOverlapsRange = todoOverlapsRange;
window.isTodoOverdue = isTodoOverdue;
window.matchesTodoDateFilter = matchesTodoDateFilter;
window.getTodoFilterCounts = getTodoFilterCounts;
window.getVisibleTodos = getVisibleTodos;
window.renderTodoView = renderTodoView;
window.handleTodoInitialSnapshot = handleTodoInitialSnapshot;
window.resetTodoReminderState = resetTodoReminderState;
window.initTodoController = initTodoController;
