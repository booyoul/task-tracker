const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const serviceSource = fs.readFileSync('js/todo-service.js', 'utf8');
const controllerSource = fs.readFileSync('js/todo-controller.js', 'utf8');
const viewSource = fs.readFileSync('js/table-mobile-renderer.js', 'utf8');

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
      { id: 'overdue', ownerId: 'user-1', title: '지난 할 일', memo: '', startDate: '2026-07-20', dueDate: '2026-07-26', completed: false },
      { id: 'today', ownerId: 'user-1', title: '오늘 할 일', memo: '검토', startDate: '2026-07-27', dueDate: '2026-07-27', completed: false },
      { id: 'week', ownerId: 'user-1', title: '이번 주 할 일', memo: '', startDate: '2026-08-01', dueDate: '2026-08-02', completed: false },
      { id: 'month', ownerId: 'user-1', title: '이번 달 할 일', memo: '', startDate: '2026-07-29', dueDate: '2026-07-31', completed: false },
      { id: 'done', ownerId: 'user-1', title: '완료한 일', memo: '', startDate: '2026-07-27', dueDate: '2026-07-27', completed: true }
    ],
    currentViewMode: 'TODO',
    lastTaskViewMode: 'CALENDAR',
    confirmActionCb: null,
    showToast() {},
    validateTodoPayload: () => '',
    db_addTodo: async () => ({ success: true }),
    db_updateTodo: async () => ({ success: true }),
    db_deleteTodo: async () => ({ success: true }),
    closeConfirmModal() {},
    setTimeout,
    clearTimeout
  };
  context.window = context;
  context.currentUser = { uid: 'user-1' };
  context.matchMedia = () => ({ matches: true });
  vm.createContext(context);
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
  assert.equal(context.document.getElementById('todo-count-week').textContent, '3');
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
  console.log('todo smoke passed: ownership CRUD, task-link readiness, date grouping, today rendering, and view isolation');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
