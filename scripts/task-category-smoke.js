const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

async function checkCategorySave(trackerFields) {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const { document } = window;
  const writes = [];
  const messages = [];
  Object.assign(window, {
    trackers: [{ id: 'tracker-1', ownerId: 'owner-1', ...trackerFields }],
    currentTrackerId: 'tracker-1', tasks: [],
    hasTrackerWritePermission: () => true,
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
  document.getElementById('btn-open-task-category-settings').click();
  const rows = () => document.querySelectorAll('#task-category-settings-list [data-task-category-id]');
  const initialCount = rows().length;
  document.getElementById('btn-add-task-category').click();
  assert.equal(rows().length, initialCount + 1, '추가 버튼으로 업무 분류 입력 행이 생겨야 합니다.');
  const added = [...rows()].at(-1);
  const id = added.dataset.taskCategoryId;
  added.querySelector('input').value = '신규 업무 구분';
  document.getElementById('btn-save-task-category-settings').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(writes.length, 1, `업무 분류 저장 실패: ${messages.join('; ')}`);
  assert.equal(writes[0].taskCategoryOptions.at(-1).label, '신규 업무 구분');
  assert.equal(document.getElementById('modal-task-category-settings').classList.contains('hidden'), true);
  assert.equal([...document.getElementById('input-task-industry').options].find(option => option.value === id)?.textContent, '신규 업무 구분');
  document.getElementById('btn-open-task-category-settings').click();
  assert.equal([...rows()].at(-1).querySelector('input').value, '신규 업무 구분', '다시 열어도 저장한 분류가 유지되어야 합니다.');
  assert.equal(writes[0].order, trackerFields.order);
  assert.equal(JSON.stringify(writes[0].accessControl), JSON.stringify(trackerFields.accessControl));
  dom.window.close();
}

(async () => {
  await checkCategorySave({ order: 1 });
  await checkCategorySave({});
  await checkCategorySave({ order: 2, accessControl: { 'owner-1': { view: true, create: true, update: true, delete: true } } });
  console.log('Task category smoke passed: add, save, reopen, legacy fields, and existing ACL/order preservation');
})().catch(error => { console.error(error); process.exitCode = 1; });
