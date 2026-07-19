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
    getProgressNotesCollection: () => ({ name: 'progress_notes' }),
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
  context.hasTaskPermission = (item, permission) => {
    if (permission === 'view' || permission === 'create') return true;
    return item ? item.ownerId === 'user-1' : true;
  };
  context.hasTrackerWritePermission = tracker => tracker && tracker.ownerId === 'user-1';
  context.fs = {
    doc: (_collection, id) => ({ id }),
    setDoc: async () => {},
    updateDoc: async () => {},
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

  const failedRestore = createContext();
  failedRestore.fs.writeBatch = () => ({ set() {}, commit: async () => { throw new Error('batch denied'); } });
  const restoreResult = await failedRestore.db_restoreTasks([{ ...failedRestore.tasks[0], deleted: true }]);
  assert.equal(restoreResult.success, false);
  assert.deepEqual(Array.from(restoreResult.restoredIds), [], '복원 저장 실패를 성공한 ID로 보고하면 안 됩니다.');

  const failedTrackerOrder = createContext();
  failedTrackerOrder.fs.writeBatch = () => ({ set() {}, commit: async () => { throw new Error('batch denied'); } });
  const trackerOrderResult = await failedTrackerOrder.db_updateTrackerOrders([{ id: 'tracker-1', order: 2 }]);
  assert.equal(trackerOrderResult.success, false);
  assert.equal(failedTrackerOrder.trackers[0].order, 1, '트래커 순서 저장 실패 후 로컬 순서가 바뀌면 안 됩니다.');

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

  const successfulRestore = createContext();
  const successfulRestoreResult = await successfulRestore.db_restoreTasks([{ ...successfulRestore.tasks[0], deleted: true }]);
  assert.equal(successfulRestoreResult.success, true);
  assert.deepEqual(Array.from(successfulRestoreResult.restoredIds), ['task-1']);

  const unavailable = createContext();
  unavailable.canWriteToFirestore = () => false;
  const unavailableResult = await unavailable.db_updateTask('task-1', { title: '로컬만 변경' });
  assert.equal(unavailableResult.success, false);
  assert.equal(unavailable.tasks[0].title, '원본 업무', 'DB 접근 불가 시 로컬만 변경하면 안 됩니다.');

  const deniedCreate = createContext();
  let deniedCreateWrites = 0;
  deniedCreate.hasTaskPermission = (_item, permission) => permission !== 'create';
  deniedCreate.fs.setDoc = async () => { deniedCreateWrites += 1; };
  const deniedCreateResult = await deniedCreate.db_addTask({ title: '권한 없는 업무' });
  assert.equal(deniedCreateResult.success, false);
  assert.equal(deniedCreateWrites, 0, '등록 권한이 없으면 Firestore 쓰기를 시도하면 안 됩니다.');

  const aclUpdate = createContext();
  aclUpdate.tasks[0].ownerId = 'user-2';
  aclUpdate.tasks[0].createdBy = 'user-2';
  aclUpdate.hasTaskPermission = (_item, permission) => permission === 'update';
  const aclUpdateResult = await aclUpdate.db_updateTask('task-1', { title: '권한으로 수정된 업무' });
  assert.equal(aclUpdateResult.success, true);
  assert.equal(aclUpdate.tasks[0].title, '권한으로 수정된 업무', '트래커 수정 권한은 다른 작성자의 업무에도 적용되어야 합니다.');

  const trackerCreate = createContext();
  let trackerCreatePayload = null;
  trackerCreate.fs.setDoc = async (_ref, payload) => { trackerCreatePayload = payload; };
  const trackerCreateResult = await trackerCreate.db_addTracker({ name: '권한 트래커', accessControl: {} });
  assert.equal(trackerCreateResult.success, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(trackerCreatePayload.accessControl['user-1'])),
    { view: true, create: true, update: true, delete: true },
    '트래커 등록자는 항상 전체 권한을 가져야 합니다.'
  );

  const trackerAclUpdate = createContext();
  let trackerUpdatePayload = null;
  trackerAclUpdate.fs.setDoc = async (_ref, payload) => { trackerUpdatePayload = payload; };
  const trackerAclResult = await trackerAclUpdate.db_updateTracker('tracker-1', {
    accessControl: { 'user-2': { view: true, create: false, update: false, delete: false } }
  });
  assert.equal(trackerAclResult.success, true);
  assert.equal(trackerUpdatePayload.accessControl['user-1'].delete, true, '권한 수정 시 소유자 전체 권한을 보존해야 합니다.');
  assert.equal(trackerUpdatePayload.accessControl['user-2'].view, true, '다른 사용자의 조회 권한을 저장해야 합니다.');

  const noteCreate = createContext();
  let createdNotePayload = null;
  noteCreate.fs.setDoc = async (_ref, payload) => { createdNotePayload = payload; };
  const noteCreateResult = await noteCreate.db_addProgressNote('task-1', {
    title: '지난 회의',
    body: '지정 날짜 기록',
    noteDate: '2026-07-03',
  });
  assert.equal(noteCreateResult.success, true);
  assert.equal(createdNotePayload.noteDate, '2026-07-03', '메모 생성 시 지정 기록일을 저장해야 합니다.');
  assert.equal(createdNotePayload.createdAt, 'server-time', '기록일과 별개로 실제 작성 시각을 보존해야 합니다.');

  const noteUpdate = createContext();
  let updatedNotePayload = null;
  noteUpdate.fs.updateDoc = async (_ref, payload) => { updatedNotePayload = payload; };
  const noteUpdateResult = await noteUpdate.db_updateProgressNote('note-1', {
    title: '날짜 수정',
    body: '수정된 기록',
    noteDate: '2026-07-04',
  });
  assert.equal(noteUpdateResult.success, true);
  assert.equal(updatedNotePayload.noteDate, '2026-07-04', '메모 수정 시 변경한 기록일을 저장해야 합니다.');

  console.log('task CRUD smoke passed: failed writes preserve local state and note dates persist');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
