const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const serviceSource = fs.readFileSync('js/todo-service.js', 'utf8');
const controllerSource = fs.readFileSync('js/todo-controller.js', 'utf8');
const calendarSource = fs.readFileSync('js/calendar-utils.js', 'utf8');
const viewSource = fs.readFileSync('js/table-mobile-renderer.js', 'utf8');
const monthPickerSource = fs.readFileSync('js/month-picker-controller.js', 'utf8');

function createServiceContext() {
  const writes = [];
  const deletes = [];
  const context = {
    console: { info() {}, warn() {}, error() {} },
    todoItems: [{
      id: 'todo-1',
      ownerId: 'user-1',
      title: '기존 할 일',
      memo: '',
      startDate: '2026-07-27',
      dueDate: '2026-07-28',
      completed: false
    }],
    canWriteToFirestore: () => true,
    getServerTimestamp: () => 'server-time',
    markSaving() { context.saveState = 'saving'; },
    markSaved() { context.saveState = 'saved'; },
    markSaveError() { context.saveState = 'error'; },
    showToast() {},
    setTimeout,
    clearTimeout
  };
  context.window = context;
  context.currentUser = { uid: 'user-1' };
  context.getTodosCollection = () => ({ name: 'todos' });
  context.fs = {
    doc: (collection, id) => ({ collection: collection.name, id }),
    async setDoc(ref, payload, options) { writes.push({ ref, payload, options }); },
    async deleteDoc(ref) { deletes.push(ref); },
    serverTimestamp: () => 'server-time',
    query: (...args) => args,
    where: (...args) => args,
    onSnapshot: () => () => {}
  };
  context.writes = writes;
  context.deletes = deletes;
  vm.createContext(context);
  vm.runInContext(serviceSource, context, { filename: 'js/todo-service.js' });
  return context;
}

async function testService() {
  const context = createServiceContext();
  const linked = context.normalizeTodoPayload({
    title: '  업무 연결 준비  ',
    memo: '',
    startDate: '2026-07-27',
    dueDate: '2026-07-30',
    taskLink: {
      trackerId: 'tracker-1',
      taskId: 'task-1',
      subTaskId: 'sub-1',
      occurrenceKey: '2026-07-27'
    }
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(linked.taskLink)),
    { trackerId: 'tracker-1', taskId: 'task-1', subTaskId: 'sub-1', occurrenceKey: '2026-07-27' },
    '향후 Task 연결 정보가 정규화 과정에서 보존되어야 합니다.'
  );
  assert.equal(
    context.normalizeTodoTaskLink({ trackerId: 'tracker-1', taskId: 'task-1', subTaskId: 'x'.repeat(201) }),
    null,
    '비정상적으로 긴 연결 식별자는 저장하지 않아야 합니다.'
  );
  assert.equal(
    context.normalizeTodoTaskLink({ trackerId: 'tracker-1', taskId: 'task-1', occurrenceKey: '2026-07-27' }),
    null,
    '반복 회차는 하위 과제 없이 저장할 수 없어야 합니다.'
  );
  assert.equal(
    context.normalizeTodoTaskLink({ trackerId: 'tracker-1', taskId: 'task-1', subTaskId: 'sub-1', occurrenceKey: '2026/07/27' }),
    null,
    '반복 회차 키는 날짜 전용 형식이어야 합니다.'
  );
  assert.equal(context.validateTodoPayload({ ...linked, startDate: '2026-08-01', dueDate: '2026-07-31' }), '종료일은 시작일보다 빠를 수 없습니다.');

  const addResult = await context.db_addTodo({
    title: '새 개인 할 일',
    memo: '메모',
    startDate: '2026-07-27',
    dueDate: '2026-07-31'
  });
  assert.equal(addResult.success, true);
  assert.equal(context.writes[0].payload.ownerId, 'user-1');
  assert.equal(context.writes[0].payload.completed, false);

  const updateResult = await context.db_updateTodo('todo-1', { completed: true });
  assert.equal(updateResult.success, true);
  assert.equal(context.writes[1].payload.completed, true);
  assert.equal(context.writes[1].payload.completedAt, 'server-time');

  const deleteResult = await context.db_deleteTodo('todo-1');
  assert.equal(deleteResult.success, true);
  assert.equal(context.deletes[0].id, 'todo-1');

  const failed = createServiceContext();
  failed.fs.setDoc = async () => { throw new Error('write denied'); };
  const failedResult = await failed.db_updateTodo('todo-1', { title: '저장되면 안 됨' });
  assert.equal(failedResult.success, false);
  assert.equal(failed.todoItems[0].title, '기존 할 일', '원격 저장 실패 후 로컬 To-do를 먼저 바꾸면 안 됩니다.');
  assert.equal(failed.saveState, 'error');
}

function testDateGroupingAndRendering() {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: 'https://example.test/' });
  const dialogRoots = [...dom.window.document.querySelectorAll('dialog, [role="dialog"]')];
  assert.equal(dialogRoots.length >= 10, true, '주요 정적 모달 목록을 찾을 수 있어야 합니다.');
  assert.equal(
    dialogRoots.every(root => root.matches('[data-theme-modal-panel]') || root.querySelector('[data-theme-modal-panel]')),
    true,
    '모든 정적 모달은 공통 테마 패널 계약을 사용해야 합니다.'
  );
  assert.match(
    monthPickerSource,
    /data-theme-modal-panel/,
    '지연 생성되는 월 선택 모달도 공통 테마 패널 계약을 사용해야 합니다.'
  );
  const context = {
    console: { info() {}, warn() {}, error() {} },
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    getTodayStr: () => '2026-07-27',
    escapeHTML: value => String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]),
    todoItems: [
      { id: 'overdue', ownerId: 'user-1', title: '지난 할 일', memo: '', startDate: '2026-07-20', dueDate: '2026-07-26', completed: false, taskLink: { trackerId: 'tracker-1', taskId: 'missing-task' } },
      { id: 'today', ownerId: 'user-1', title: '오늘 할 일', memo: '검토', startDate: '2026-07-27', dueDate: '2026-07-27', completed: false, taskLink: { trackerId: 'tracker-1', taskId: 'task-1', subTaskId: 'sub-1', occurrenceKey: '2026-07-27' } },
      { id: 'week', ownerId: 'user-1', title: '이번 주 할 일', memo: '', startDate: '2026-08-01', dueDate: '2026-08-02', completed: false },
      { id: 'month', ownerId: 'user-1', title: '이번 달 할 일', memo: '', startDate: '2026-07-29', dueDate: '2026-07-31', completed: false },
      { id: 'done', ownerId: 'user-1', title: '완료한 일', memo: '', startDate: '2026-07-27', dueDate: '2026-07-27', completed: true }
    ],
    trackers: [{ id: 'tracker-1', name: '영업 트래커', ownerId: 'user-1' }],
    tasks: [{
      id: 'task-1',
      trackerId: 'tracker-1',
      title: '견적 검토',
      subTasks: [{
        id: 'sub-1',
        title: '고객 조건 확인',
        status: 'PENDING',
        startDate: '2026-07-27',
        dueDate: '2026-07-27',
        recurrence: { enabled: true, frequency: 'DAILY', interval: 1, endType: 'COUNT', count: 20 }
      }]
    }],
    currentViewMode: 'TODO',
    lastTaskViewMode: 'CALENDAR',
    confirmActionCb: null,
    showToast() {},
    validateTodoPayload: () => '',
    db_addTodo: async () => ({ success: true }),
    db_updateTodo: async () => ({ success: true }),
    db_deleteTodo: async () => ({ success: true }),
    closeConfirmModal() {},
    normalizeTodoTaskLink: taskLink => {
      if (!taskLink?.trackerId || !taskLink?.taskId) return null;
      const normalized = { trackerId: taskLink.trackerId, taskId: taskLink.taskId };
      if (taskLink.subTaskId) normalized.subTaskId = taskLink.subTaskId;
      if (taskLink.occurrenceKey) normalized.occurrenceKey = taskLink.occurrenceKey;
      return normalized;
    },
    hasTaskPermission: () => true,
    normalizeStatus: status => ['PENDING', 'PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status) ? status : 'PENDING',
    getStatusKorean: status => ({ PENDING: '진행 대기', PROGRESS: '진행 중', COMPLETED: '완료됨', CANCELLED: '취소됨' }[status] || status),
    updateTrackerUI() {},
    openTaskModal(id) { context.openedTaskId = id; },
    setTimeout,
    clearTimeout
  };
  context.window = context;
  context.currentUser = { uid: 'user-1' };
  context.matchMedia = () => ({ matches: true });
  vm.createContext(context);
  vm.runInContext(calendarSource, context, { filename: 'js/calendar-utils.js' });
  vm.runInContext(controllerSource, context, { filename: 'js/todo-controller.js' });
  vm.runInContext(viewSource, context, { filename: 'js/table-mobile-renderer.js' });

  const counts = JSON.parse(JSON.stringify(context.getTodoFilterCounts(context.todoItems, '2026-07-27')));
  assert.deepEqual(counts, { TODAY: 2, WEEK: 3, MONTH: 3, OVERDUE: 1, ALL: 4 });
  assert.equal(context.matchesTodoDateFilter(context.todoItems[0], 'TODAY', '2026-07-27'), true, '오늘 보기에는 미완료 기한 경과 항목도 보여야 합니다.');
  assert.equal(context.matchesTodoDateFilter(context.todoItems[2], 'WEEK', '2026-07-27'), true);
  assert.equal(context.matchesTodoDateFilter(context.todoItems[2], 'MONTH', '2026-07-27'), false);

  context.renderTodoView();
  const cards = [...context.document.querySelectorAll('#todo-list [data-todo-id]')];
  assert.deepEqual(cards.map(card => card.dataset.todoId), ['overdue', 'today'], '오늘 보기에서 기한 경과 항목을 먼저 표시해야 합니다.');
  assert.equal(
    cards[0].textContent.includes('연결된 업무를 볼 수 없음'),
    true,
    '삭제되었거나 볼 수 없는 업무 제목은 노출하지 않아야 합니다.'
  );
  assert.equal(
    cards[1].querySelector('.btn-open-todo-task-link')?.textContent.includes('영업 트래커 › 견적 검토 › 고객 조건 확인 › 07-27 회차'),
    true,
    '접근 가능한 연결은 트래커부터 하위 과제까지 동적으로 표시해야 합니다.'
  );
  context.switchView = mode => { context.switchedViewMode = mode; };
  context.openTodoLinkedTask('today');
  assert.equal(context.currentTrackerId, 'tracker-1');
  assert.equal(context.switchedViewMode, 'TABLE');
  assert.equal(context.openedTaskId, 'task-1');
  assert.equal(context.__todoLinkedTaskTarget.subTaskId, 'sub-1');
  assert.equal(context.__todoLinkedTaskTarget.occurrenceKey, '2026-07-27');
  context.openTodoModal('today');
  assert.equal(context.document.getElementById('todo-link-occurrence-field').hidden, false);
  assert.equal(context.document.getElementById('input-todo-link-occurrence').value, '2026-07-27');
  assert.equal(context.document.querySelectorAll('#input-todo-link-occurrence option').length, 13, '회차 미지정과 가까운 12개 회차를 제공해야 합니다.');
  context.closeTodoModal();
  assert.equal(context.document.getElementById('todo-count-week').textContent, '3');
  assert.equal(context.document.getElementById('todo-list-view').hidden, false);
  assert.equal(context.document.getElementById('todo-calendar-section').hidden, true);
  assert.equal(context.document.getElementById('btn-todo-view-list').getAttribute('aria-pressed'), 'true');
  context.setTodoViewMode('CALENDAR');
  assert.equal(context.document.getElementById('todo-list-view').hidden, true);
  assert.equal(context.document.getElementById('todo-calendar-section').hidden, false);
  assert.equal(context.document.getElementById('btn-todo-view-calendar').getAttribute('aria-pressed'), 'true');
  assert.equal(context.document.getElementById('todo-calendar-title').textContent, '2026년 7월');
  assert.ok(context.document.querySelector('[data-todo-calendar-view="mobile-month"]'));
  assert.equal(context.document.querySelectorAll('#todo-calendar-content [data-todo-calendar-date]').length, 3);
  const calendarIds = new Set(
    [...context.document.querySelectorAll('#todo-calendar-content [data-todo-calendar-id]')]
      .map(item => item.dataset.todoCalendarId)
  );
  assert.equal(calendarIds.has('month'), true, '목록 날짜 필터와 무관하게 표시 월의 To-do를 캘린더에 렌더링해야 합니다.');
  assert.equal(calendarIds.has('done'), false, '미완료 상태 필터를 캘린더에서도 공유해야 합니다.');
  assert.deepEqual(
    Array.from(context.getTodoCalendarItems(context.todoItems, 'COMPLETED', '완료')).map(item => item.id),
    ['done'],
    '캘린더는 완료 상태와 검색 조건을 함께 적용해야 합니다.'
  );
  context.setTodoCalendarMode('YEAR');
  assert.equal(context.document.getElementById('todo-calendar-title').textContent, '2026년 연간 현황');
  assert.ok(context.document.querySelector('[data-todo-calendar-view="mobile-year"]'));
  assert.equal(context.document.querySelectorAll('#todo-calendar-content [data-todo-calendar-month]').length, 12);
  context.matchMedia = () => ({ matches: false });
  context.setTodoCalendarMode('MONTH');
  assert.ok(context.document.querySelector('[data-todo-calendar-view="desktop-month"]'));
  assert.equal(context.document.querySelectorAll('#todo-calendar-content [data-todo-calendar-date]').length, 31);
  context.setTodoCalendarMode('YEAR');
  assert.ok(context.document.querySelector('[data-todo-calendar-view="desktop-year"]'));
  assert.equal(context.document.querySelectorAll('#todo-calendar-content [data-todo-calendar-month]').length, 12);
  context.setTodoCalendarMode('MONTH');
  context.setTodoViewMode('LIST');
  assert.equal(context.document.getElementById('todo-list-view').hidden, false);
  assert.equal(context.document.getElementById('todo-calendar-section').hidden, true);
  context.setViewVisibility('TODO');
  assert.equal(context.document.getElementById('view-todo').hidden, false);
  assert.equal(context.document.getElementById('task-dashboard-summary').hidden, true);
  assert.equal(context.document.getElementById('tracker-header-context').hidden, true);
  assert.equal(context.document.getElementById('todo-header-context').hidden, false);
  assert.equal(context.document.getElementById('btn-add-task').hidden, true);
  assert.equal(context.document.documentElement.scrollWidth <= context.document.documentElement.clientWidth || context.document.documentElement.clientWidth === 0, true);
}

async function main() {
  await testService();
  testDateGroupingAndRendering();
  console.log('todo smoke passed: ownership CRUD, task linking, date grouping, split list/calendar views, and task-style calendars');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
