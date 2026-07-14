const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/task-service.js', 'utf8');

function createContext() {
  const toasts = [];
  const context = {
    console: { info() {}, warn() {}, error() {} },
    tasks: [{ id: 'task-1', trackerId: 'tracker-1', title: '원본 업무', ownerId: 'user-1' }],
    trackers: [{ id: 'tracker-1', name: '원본 트래커', order: 1, ownerId: 'user-1' }],
    currentTrackerId: 'tracker-1',
    selectedTaskIds: new Set(['task-1']),
    localStorage: { setItem() {}, getItem() { return null; } },
    getTasksCollection: () => ({ name: 'tasks' }),
    getTrackersCollection: () => ({ name: 'trackers' }),
    getServerTimestamp: () => 'server-time',
    normalizeTaskForSchema: value => ({ ...value }),
    canWriteToFirestore: () => true,
    markSaving: () => { context.saveState = 'saving'; },
    markSaved: () => { context.saveState = 'saved'; },
    markSaveError: () => { context.saveState = 'error'; },
    showToast: (message, success = true) => { toasts.push({ message, success }); },
    updateUI() {},
    updateTrackerUI() {},
    db_recordActivity: async () => {},
    isFirebaseAvailable: true,
    db: {},
    setTimeout,
    clearTimeout,
  };
  context.window = context;
  context.currentUser = { uid: 'user-1', email: 'user-1@example.com' };
  context.hasWritePermission = task => task && task.ownerId === 'user-1';
  context.hasTrackerWritePermission = tracker => tracker && tracker.ownerId === 'user-1';
  context.fs = {
    doc: (_collection, id) => ({ id }),
    setDoc: async () => {},
    where: (...args) => args,
    query: (...args) => args,
    getDocs: async () => ({ docs: [], empty: true }),
    writeBatch: () => ({
      set() {},
      commit: async () => {},
    }),
  };
  context.toasts = toasts;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'js/task-service.js' });
  return context;
}

async function main() {
  const failedAdd = createContext();
  failedAdd.fs.setDoc = async () => { throw new Error('write denied'); };
  const addResult = await failedAdd.db_addTask({ title: '추가 실패 업무' });
  assert.equal(addResult.success, false);
  assert.equal(failedAdd.tasks.length, 1, '추가 실패 후 로컬 업무가 늘어나면 안 됩니다.');
  assert.equal(failedAdd.saveState, 'error');

  const failedUpdate = createContext();
  failedUpdate.fs.setDoc = async () => { throw new Error('write denied'); };
  const updateResult = await failedUpdate.db_updateTask('task-1', { title: '잘못된 성공 상태' });
  assert.equal(updateResult.success, false);
  assert.equal(failedUpdate.tasks[0].title, '원본 업무', '수정 실패 후 로컬 업무가 바뀌면 안 됩니다.');

  const failedDelete = createContext();
  failedDelete.fs.setDoc = async () => { throw new Error('write denied'); };
  const deleteResult = await failedDelete.db_deleteTask('task-1');
  assert.equal(deleteResult.success, false);
  assert.equal(failedDelete.tasks.length, 1, '삭제 실패 후 로컬 업무가 사라지면 안 됩니다.');
  assert.equal(failedDelete.selectedTaskIds.has('task-1'), true, '삭제 실패 후 선택 상태를 보존해야 합니다.');

  const failedOrder = createContext();
  failedOrder.tasks.push({ id: 'task-2', trackerId: 'tracker-1', title: '두 번째 업무', order: 2, ownerId: 'user-1' });
  failedOrder.tasks[0].order = 1;
  failedOrder.fs.writeBatch = () => ({ set() {}, commit: async () => { throw new Error('batch denied'); } });
  const orderResult = await failedOrder.db_updateTaskOrders([
    { id: 'task-1', order: 2 },
    { id: 'task-2', order: 1 },
  ]);
  assert.equal(orderResult.success, false);
  assert.deepEqual(failedOrder.tasks.map(task => task.order), [1, 2], '순서 저장 실패 후 로컬 순서가 바뀌면 안 됩니다.');

  const failedTrackerUpdate = createContext();
  failedTrackerUpdate.fs.setDoc = async () => { throw new Error('write denied'); };
  const trackerResult = await failedTrackerUpdate.db_updateTracker('tracker-1', { name: '잘못된 성공 상태' });
  assert.equal(trackerResult.success, false);
  assert.equal(failedTrackerUpdate.trackers[0].name, '원본 트래커', '트래커 수정 실패 후 로컬 상태가 바뀌면 안 됩니다.');

  const failedTrackerDelete = createContext();
  failedTrackerDelete.fs.writeBatch = () => ({ set() {}, commit: async () => { throw new Error('batch denied'); } });
  const trackerDeleteResult = await failedTrackerDelete.db_deleteTracker('tracker-1');
  assert.equal(trackerDeleteResult.success, false);
  assert.equal(failedTrackerDelete.trackers.length, 1, '트래커 삭제 실패 후 로컬 트래커가 사라지면 안 됩니다.');
  assert.equal(failedTrackerDelete.tasks.length, 1, '트래커 삭제 실패 후 소속 업무가 사라지면 안 됩니다.');

  const successfulUpdate = createContext();
  const successResult = await successfulUpdate.db_updateTask('task-1', { title: '저장된 업무' });
  assert.equal(successResult.success, true);
  assert.equal(successfulUpdate.tasks[0].title, '저장된 업무');
  assert.equal(successfulUpdate.saveState, 'saved');

  const unavailable = createContext();
  unavailable.canWriteToFirestore = () => false;
  const unavailableResult = await unavailable.db_updateTask('task-1', { title: '로컬만 변경' });
  assert.equal(unavailableResult.success, false);
  assert.equal(unavailable.tasks[0].title, '원본 업무', 'DB 접근 불가 시 로컬만 변경하면 안 됩니다.');

  console.log('task CRUD smoke passed: failed writes preserve local task and tracker state');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
