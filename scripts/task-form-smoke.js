const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function main() {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'));
  const document = dom.window.document;
  const context = {
    console: { info() {}, warn() {}, error() {} }, document,
    setTimeout, clearTimeout, currentTrackerId: 'tracker-1', currentSubTasks: [],
    trackers: [{ id: 'tracker-1', name: '트래커' }],
    tasks: [{ id: 'task-1', trackerId: 'tracker-1', title: '원본 업무', status: 'PROGRESS',
      priority: 'NORMAL', industry: 'AUTO', taskType: 'GENERAL', assignee: ['미지정'],
      startDate: '2026-01-01', dueDate: '2026-01-31', notes: '',
      subTasks: [{ id: 'sub-1', title: '하위 업무', status: 'PENDING' }] }],
    hasTaskPermission: () => true, showToast() {},
    getTodayStr: () => '2026-01-01', getFutureDateStr: () => '2026-01-08',
    getCurrentTaskCategoryOptions: () => [{ id: 'AUTO', label: '미분류' }],
    escapeHTML: value => String(value || ''),
    normalizeStatus: value => value || 'PENDING',
    validateTaskPayload: value => value.title ? '' : '업무명은 필수입니다.'
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/modal-controller.js', 'utf8'), context);
  // Keep form initialization/submission real; stub unrelated rich-note/subtask rendering.
  for (const name of ['bindSubTaskRecurrenceControls', 'resetSubtaskAssigneeDropdown',
    'resetSubTaskRecurrenceForm', 'resetSubTaskButton', 'renderModalSubTasks',
    'updateMainTaskNoteButton', 'loadTaskHistory', 'initNoteFormattingEvents',
    'initTaskCategorySettingsEvents', 'initNoteTypeSettingsEvents', 'initProgressNotesEvents']) {
    context[name] = () => {};
  }
  const event = { preventDefault() {} };
  const submit = document.querySelector('#form-task button[type="submit"]');
  context.openTaskModal();
  document.getElementById('input-task-title').value = '신규 업무';
  let calls = 0;
  let pending = deferred();
  context.db_addTask = () => { calls++; return pending.promise; };
  const first = context.handleTaskSubmit(event);
  await context.handleTaskSubmit(event);
  assert.equal(calls, 1, '저장 중 반복 제출은 신규 업무를 한 번만 생성해야 합니다.');
  assert.equal(submit.disabled, true);
  assert.equal(document.getElementById('form-task').getAttribute('aria-busy'), 'true');
  pending.resolve({ success: false, error: '연결 실패' });
  await first;
  assert.equal(submit.disabled, false);
  assert.equal(document.getElementById('input-task-title').value, '신규 업무');
  assert.equal(document.getElementById('task-save-error').textContent, '연결 실패');
  assert.equal(document.getElementById('modal-task').classList.contains('hidden'), false);
  context.db_addTask = async () => { calls++; return { success: true }; };
  await context.handleTaskSubmit(event);
  assert.equal(calls, 2, '실패 후 사용자가 재시도할 수 있어야 합니다.');

  context.openTaskModal('task-1');
  context.tasks[0].subTasks[0].status = 'COMPLETED';
  context.tasks[0].notes = '다른 사용자가 기록';
  document.getElementById('input-task-title').value = '수정한 제목';
  let captured;
  context.db_updateTask = async (id, patch, options) => {
    captured = { id, patch, options };
    return { success: false, conflict: true, error: '다른 사용자가 변경했습니다.' };
  };
  await context.handleTaskSubmit(event);
  assert.deepEqual(Object.keys(captured.patch), ['title'], '제목만 수정하면 오래된 하위 업무/메모를 전송하지 않아야 합니다.');
  assert.equal(captured.options.expectedTask.subTasks[0].status, 'PENDING');
  assert.equal(captured.options.expectedTask.notes, '');
  assert.equal(document.getElementById('input-task-title').value, '수정한 제목', '충돌 시 입력을 보존해야 합니다.');
  assert.equal(document.getElementById('modal-task').classList.contains('hidden'), false);
  assert.equal(submit.disabled, false);

  context.openTaskModal('task-1');
  context.currentSubTasks[0].title = '수정한 하위 업무';
  await context.handleTaskSubmit(event);
  assert.deepEqual(Object.keys(captured.patch), ['subTasks']);
  assert.equal(captured.options.expectedTask.subTasks[0].status, 'COMPLETED');

  context.openTaskModal('task-1');
  let updateCalls = 0;
  context.db_updateTask = async () => { updateCalls++; return { success: true }; };
  await context.handleTaskSubmit(event);
  assert.equal(updateCalls, 0, '변경 없는 폼은 쓰기를 수행하지 않아야 합니다.');

  context.openTaskModal();
  context.db_addTask = async () => { throw new Error('일시 오류'); };
  document.getElementById('input-task-title').value = '재시도 대상';
  await context.handleTaskSubmit(event);
  assert.equal(submit.disabled, false, '예외가 발생해도 제출 잠금을 해제해야 합니다.');

  let trackerCalls = 0;
  pending = deferred();
  context.collectTrackerAccessControl = () => null;
  context.db_addTracker = () => { trackerCalls++; return pending.promise; };
  document.getElementById('input-tracker-id').value = '';
  document.getElementById('input-tracker-name').value = '새 트래커';
  const trackerSubmit = context.handleTrackerSubmit(event);
  await context.handleTrackerSubmit(event);
  assert.equal(trackerCalls, 1, '트래커도 저장 중 반복 제출을 차단해야 합니다.');
  pending.resolve({ success: false });
  await trackerSubmit;
  assert.equal(document.getElementById('btn-save-tracker').disabled, false);
  dom.window.close();
  console.log('task form smoke passed: duplicate submits, retry, changed fields, conflict preservation');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
