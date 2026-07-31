console.info('Smart Task Flow todo-service.js v20260731-v2 loaded');

function normalizeTodoTaskLink(taskLink) {
  if (!taskLink || typeof taskLink !== 'object' || Array.isArray(taskLink)) return null;
  const trackerId = String(taskLink.trackerId || '').trim();
  const taskId = String(taskLink.taskId || '').trim();
  if (!trackerId || !taskId || trackerId.length > 200 || taskId.length > 200) return null;
  const normalized = { trackerId, taskId };
  const subTaskId = String(taskLink.subTaskId || '').trim();
  const occurrenceKey = String(taskLink.occurrenceKey || '').trim();
  if (subTaskId.length > 200 || occurrenceKey.length > 200) return null;
  if (subTaskId) normalized.subTaskId = subTaskId;
  if (occurrenceKey) normalized.occurrenceKey = occurrenceKey;
  return normalized;
}

function normalizeTodoPayload(data = {}) {
  const normalized = {
    title: String(data.title || '').trim().slice(0, 100),
    memo: String(data.memo || '').trim().slice(0, 500),
    startDate: String(data.startDate || ''),
    dueDate: String(data.dueDate || ''),
    completed: data.completed === true
  };
  const taskLink = normalizeTodoTaskLink(data.taskLink);
  if (taskLink) normalized.taskLink = taskLink;
  return normalized;
}

function validateTodoPayload(data = {}) {
  const normalized = normalizeTodoPayload(data);
  if (!normalized.title) return '할 일 제목을 입력해 주세요.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.startDate)) return '시작일을 선택해 주세요.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.dueDate)) return '종료일을 선택해 주세요.';
  if (normalized.startDate > normalized.dueDate) return '종료일은 시작일보다 빠를 수 없습니다.';
  return '';
}

function getTodoServerTimestamp() {
  return typeof getServerTimestamp === 'function'
    ? getServerTimestamp()
    : window.fs?.serverTimestamp?.();
}

async function db_addTodo(todoData) {
  const coll = window.getTodosCollection?.();
  const userId = window.currentUser?.uid || '';
  const normalized = normalizeTodoPayload(todoData);
  const validationMessage = validateTodoPayload(normalized);
  if (validationMessage) return { success: false, error: validationMessage };
  if (!userId || !coll || !canWriteToFirestore()) {
    return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  }

  const id = `todo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = getTodoServerTimestamp();
  const payload = {
    ...normalized,
    ownerId: userId,
    completedAt: normalized.completed ? timestamp : null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  markSaving();
  try {
    await window.fs.setDoc(window.fs.doc(coll, id), payload);
    markSaved();
    return { success: true, id, todo: { id, ...payload } };
  } catch (error) {
    markSaveError();
    console.warn('To-do 추가 실패', error);
    showToast('To-do 저장에 실패했습니다.', false);
    return { success: false, error: error.message || String(error) };
  }
}

async function db_updateTodo(id, updates) {
  const original = todoItems.find(item => item.id === id);
  if (!original || original.ownerId !== window.currentUser?.uid) {
    return { success: false, error: '수정할 수 있는 To-do가 아닙니다.' };
  }
  const coll = window.getTodosCollection?.();
  if (!coll || !canWriteToFirestore()) {
    return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  }

  const normalized = normalizeTodoPayload({ ...original, ...updates });
  const validationMessage = validateTodoPayload(normalized);
  if (validationMessage) return { success: false, error: validationMessage };
  const timestamp = getTodoServerTimestamp();
  const payload = {
    ...normalized,
    ownerId: original.ownerId,
    completedAt: normalized.completed
      ? (original.completed === true ? original.completedAt || timestamp : timestamp)
      : null,
    updatedAt: timestamp
  };
  if (!payload.taskLink) payload.taskLink = null;

  markSaving();
  try {
    await window.fs.setDoc(window.fs.doc(coll, id), payload, { merge: true });
    markSaved();
    return { success: true, id, todo: { ...original, ...payload, id } };
  } catch (error) {
    markSaveError();
    console.warn('To-do 수정 실패', error);
    showToast('To-do 수정에 실패했습니다.', false);
    return { success: false, error: error.message || String(error) };
  }
}

async function db_deleteTodo(id) {
  const original = todoItems.find(item => item.id === id);
  if (!original || original.ownerId !== window.currentUser?.uid) {
    return { success: false, error: '삭제할 수 있는 To-do가 아닙니다.' };
  }
  const coll = window.getTodosCollection?.();
  if (!coll || !canWriteToFirestore()) {
    return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  }

  markSaving();
  try {
    await window.fs.deleteDoc(window.fs.doc(coll, id));
    markSaved();
    return { success: true, id, todo: original };
  } catch (error) {
    markSaveError();
    console.warn('To-do 삭제 실패', error);
    showToast('To-do 삭제에 실패했습니다.', false);
    return { success: false, error: error.message || String(error) };
  }
}

function stopTodoRealtimeListener() {
  if (typeof unsubscribeTodos === 'function') unsubscribeTodos();
  unsubscribeTodos = null;
  todoItems = [];
  if (typeof window.resetTodoReminderState === 'function') window.resetTodoReminderState();
  if (!window.currentUser && currentViewMode === 'TODO') {
    currentViewMode = lastTaskViewMode || 'CALENDAR';
    window.currentViewMode = currentViewMode;
    if (typeof window.setViewVisibility === 'function') window.setViewVisibility(currentViewMode);
  }
}

function startTodoRealtimeListener() {
  stopTodoRealtimeListener();
  const coll = window.getTodosCollection?.();
  const userId = window.currentUser?.uid || '';
  if (!coll || !userId || !window.fs?.onSnapshot) return false;
  const todoQuery = window.fs.query(coll, window.fs.where('ownerId', '==', userId));
  unsubscribeTodos = window.fs.onSnapshot(todoQuery, snapshot => {
    todoItems = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (currentViewMode === 'TODO' && typeof window.renderTodoView === 'function') {
      window.renderTodoView();
    }
    if (typeof window.handleTodoInitialSnapshot === 'function') {
      window.handleTodoInitialSnapshot();
    }
  }, error => {
    console.error('To-do 동기화 오류', error);
    showToast('To-do 실시간 동기화에 실패했습니다.', false);
  });
  return true;
}

window.normalizeTodoTaskLink = normalizeTodoTaskLink;
window.normalizeTodoPayload = normalizeTodoPayload;
window.validateTodoPayload = validateTodoPayload;
window.db_addTodo = db_addTodo;
window.db_updateTodo = db_updateTodo;
window.db_deleteTodo = db_deleteTodo;
window.startTodoRealtimeListener = startTodoRealtimeListener;
window.stopTodoRealtimeListener = stopTodoRealtimeListener;
