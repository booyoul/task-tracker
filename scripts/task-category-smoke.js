const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

async function createCategoryHarness({ canUpdate = true, trackerFields = {} } = {}) {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const { document } = window;
  const writes = [];
  const messages = [];
  Object.assign(window, {
    trackers: [{ id: 'tracker-1', ownerId: 'owner-1', ...trackerFields }],
    currentTrackerId: 'tracker-1', tasks: [],
    hasTrackerWritePermission: () => false,
    hasTaskPermission: (_tracker, permission) => permission === 'update' && canUpdate,
    getTrackersCollection: () => ({}), canWriteToFirestore: () => true,
    getServerTimestamp: () => 'server-time',
    markSaving() {}, markSaved() {}, markSaveError() {},
    updateTrackerUI() {}, updateUI() {},
    showToast: message => messages.push(message),
    escapeHTML: value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    fs: {
      doc: (_collection, id) => ({ id }),
      async setDoc(_ref, payload) {
        // Firestore rejects undefined fields, including with merge: true.
        for (const [key, value] of Object.entries(payload)) {
          if (value === undefined) throw new Error(`Unsupported field value: undefined (${key})`);
        }
        writes.push(payload);
      },
    },
  });
  for (const file of ['js/date-risk-utils.js', 'js/task-service.js', 'js/modal-controller.js']) {
    window.eval(fs.readFileSync(file, 'utf8'));
  }
  window.initTaskCategorySettingsEvents();
  return { dom, window, document, writes, messages };
}

async function checkAuthorizedCategorySave(trackerFields) {
  const { dom, document, writes, messages } = await createCategoryHarness({ trackerFields });
  document.getElementById('btn-open-task-category-settings').click();
  assert.equal(document.getElementById('modal-task-category-settings').classList.contains('hidden'), false,
    `수정 권한 사용자가 업무 분류 설정을 열 수 있어야 합니다: ${messages.join('; ')}`);
  const rows = () => document.querySelectorAll('#task-category-settings-list [data-task-category-id]');
  const initialCount = rows().length;
  rows()[0].querySelector('input').value = '변경한 업무 구분';
  if (initialCount > 1) rows()[1].querySelector('[data-remove-task-category]').click();
  document.getElementById('btn-add-task-category').click();
  assert.equal(rows().length, initialCount, '삭제 후 추가하면 업무 분류 수가 유지되어야 합니다.');
  const added = [...rows()].at(-1);
  const id = added.dataset.taskCategoryId;
  added.querySelector('input').value = '신규 업무 구분';
  document.getElementById('btn-save-task-category-settings').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(writes.length, 1, `업무 분류 저장 실패: ${messages.join('; ')}`);
  assert.equal(writes[0].taskCategoryOptions[0].label, '변경한 업무 구분');
  assert.equal(writes[0].taskCategoryOptions.at(-1).label, '신규 업무 구분');
  assert.deepEqual(Object.keys(writes[0]).sort(), ['taskCategoryOptions', 'updatedAt'],
    '수정 권한 사용자의 저장은 업무 분류와 수정 시각만 변경해야 합니다.');
  assert.equal(document.getElementById('modal-task-category-settings').classList.contains('hidden'), true);
  assert.equal([...document.getElementById('input-task-industry').options].find(option => option.value === id)?.textContent, '신규 업무 구분');
  document.getElementById('btn-open-task-category-settings').click();
  assert.equal([...rows()].at(-1).querySelector('input').value, '신규 업무 구분', '다시 열어도 저장한 분류가 유지되어야 합니다.');
  dom.window.close();
}

async function checkDeniedWithoutUpdatePermission() {
  const { dom, document, writes, messages } = await createCategoryHarness({ canUpdate: false });
  document.getElementById('btn-open-task-category-settings').click();
  assert.equal(document.getElementById('modal-task-category-settings').classList.contains('hidden'), true);
  assert.equal(writes.length, 0);
  assert(messages.some(message => message.includes('수정 권한')), '수정 권한 안내가 표시되어야 합니다.');
  dom.window.close();
}

(async () => {
  await checkAuthorizedCategorySave({
    order: 2,
    taskCategoryOptions: [{ id: 'GENERAL', label: '일반' }, { id: 'FNB', label: '식음료' }],
    accessControl: { 'editor-1': { view: true, create: false, update: true, delete: false } }
  });
  await checkDeniedWithoutUpdatePermission();
  console.log('Task category smoke passed: update-authorized add, delete, rename, save, reopen, and denied access');
})().catch(error => { console.error(error); process.exitCode = 1; });
