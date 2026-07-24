const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!doctype html><body>
  <div id="note-detail-panel" class="translate-x-full"></div>
  <div id="note-panel-backdrop" class="hidden"></div>
  <div id="note-panel-title"></div>
  <div id="note-panel-meta"></div>
  <div id="note-panel-read-mode">
    <div id="note-panel-fields"></div>
    <div id="note-panel-body"></div>
    <section id="note-panel-comments-section">
      <span id="note-panel-comment-count"></span>
      <div id="note-panel-comments"></div>
      <textarea id="input-note-review-comment"></textarea>
      <button id="btn-add-note-review-comment"></button>
    </section>
    <section id="note-panel-history-section" class="hidden">
      <span id="note-panel-history-count"></span>
      <div id="note-panel-history"></div>
    </section>
  </div>
  <div id="note-panel-edit-mode" class="hidden">
    <input id="input-note-edit-title">
    <input id="input-note-edit-date">
    <input id="input-note-edit-customer">
    <input id="input-note-edit-opp-no">
    <select id="input-note-edit-work-type"></select>
    <div id="input-note-edit-body" contenteditable="true"></div>
  </div>
  <div id="note-panel-read-actions">
    <button id="btn-note-edit"></button>
    <button id="btn-note-delete"></button>
  </div>
  <div id="note-panel-edit-actions" class="hidden">
    <button id="btn-note-edit-cancel"></button>
    <button id="btn-note-edit-save"></button>
  </div>
  <button id="btn-close-note-panel"></button>
  <button id="btn-open-note-type-settings"></button>
  <div id="modal-note-type-settings" class="hidden">
    <button id="btn-close-note-type-settings"></button>
    <button id="btn-cancel-note-type-settings"></button>
    <div id="note-type-settings-backdrop"></div>
    <div id="note-type-settings-list"></div>
    <button id="btn-add-note-type"></button>
    <button id="btn-save-note-type-settings"></button>
  </div>
</body>`);

const currentNote = {
  id: 'note-current',
  taskId: 'task-1',
  title: '현재 메모',
  body: '현재 내용',
  bodyHtml: '<ul><li><font color="#dc2626">현재 내용</font></li></ul>',
  noteDate: '2026-07-12',
  createdAt: new Date('2026-07-12T10:00:00+09:00'),
  createdByName: 'current@example.com',
  customerName: 'ACME',
  oppNo: 'OPP-123',
  workType: 'CUSTOMER_VISIT',
  workTypeLabel: 'Customer Visit',
  reviewComments: [],
};
const notes = [
  currentNote,
  {
    id: 'note-subtask-history',
    taskId: 'task-1__sub_sub-1',
    title: '하위 업무 과거 메모',
    body: '두 번째 과거 내용',
    noteDate: '2026-07-11',
    createdAt: new Date('2026-07-11T09:00:00+09:00'),
    createdByName: 'sub@example.com',
  },
  {
    id: 'note-oldest',
    taskId: 'task-1',
    title: '가장 오래된 메모',
    body: '첫 번째 과거 내용',
    noteDate: '2026-07-10',
    createdAt: new Date('2026-07-10T09:00:00+09:00'),
    createdByName: 'old@example.com',
  },
  {
    id: 'note-subtask-oldest',
    taskId: 'task-1__sub_sub-1',
    title: '하위 업무 더 과거 메모',
    body: '하위 업무 첫 기록',
    noteDate: '2026-07-09',
    createdAt: new Date('2026-07-09T08:00:00+09:00'),
    createdByName: 'sub-old@example.com',
  },
  {
    id: 'note-future',
    taskId: 'task-1',
    title: '선택 메모보다 최신',
    body: '미래 내용',
    noteDate: '2026-07-13',
    createdAt: new Date('2026-07-13T09:00:00+09:00'),
    createdByName: 'future@example.com',
  },
  {
    id: 'note-other-task',
    taskId: 'task-2',
    title: '다른 태스크 메모',
    body: '다른 내용',
    noteDate: '2026-07-09',
    createdAt: new Date('2026-07-09T09:00:00+09:00'),
    createdByName: 'other@example.com',
  },
];

async function main() {
  let updatedNote = null;
  let addedComment = null;
  let updatedTracker = null;
  const context = {
    console: { info() {}, warn() {}, error() {} },
    document: dom.window.document,
    Event: dom.window.Event,
    setTimeout,
    clearTimeout,
    tasks: [{
      id: 'task-1',
      subTasks: [{ id: 'sub-1', title: '현장 확인' }],
    }],
    trackers: [{
      id: 'tracker-1',
      ownerId: 'user-1',
      noteTypeOptions: [
        { id: 'CUSTOMER_VISIT', label: 'Customer Visit' },
        { id: 'QUOTATION', label: 'Quotation' },
      ],
    }],
    currentTrackerId: 'tracker-1',
    currentSubTasks: [],
    approvedUsers: [],
    showToast() {},
    renderActiveViews() {},
    hasTrackerWritePermission: () => true,
    DOMPurify: { sanitize: html => html },
    escapeHTML: value => String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]),
  };
  context.window = context;
  context.db_fetchProgressNotes = async taskId => {
    assert.equal(
      ['task-1', 'task-1__sub_sub-1'].includes(taskId),
      true,
      'history 조회는 선택 메모의 정확한 taskId를 사용해야 합니다.'
    );
    return notes;
  };
  context.db_updateProgressNote = async (noteId, payload) => {
    updatedNote = { noteId, payload };
    return { success: true };
  };
  context.db_addProgressNoteComment = async (noteId, taskId, body) => {
    addedComment = { noteId, taskId, body };
    return {
      success: true,
      comment: { id: 'comment-1', body, createdByName: 'reviewer@example.com', createdAt: '2026-07-12T12:00:00+09:00' }
    };
  };
  context.db_updateTracker = async (trackerId, payload) => {
    updatedTracker = { trackerId, payload };
    context.trackers[0] = { ...context.trackers[0], ...payload };
    return { success: true };
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/modal-controller.js', 'utf8'), context, { filename: 'js/modal-controller.js' });
  context.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

  await context.openNoteDetailPanel(currentNote);
  assert.equal(context.document.getElementById('note-detail-panel').classList.contains('translate-x-0'), true);
  const historyItems = [...context.document.querySelectorAll('[data-note-history-id]')];
  assert.deepEqual(
    historyItems.map(item => item.dataset.noteHistoryId),
    ['note-oldest'],
    '본 업무 메모를 열면 그 본 업무의 과거 메모만 표시해야 합니다.'
  );
  assert.equal(context.document.getElementById('note-panel-history-count').textContent, '1건');
  assert.equal(context.document.getElementById('note-panel-history').textContent.includes('하위 업무 과거 메모'), false);
  assert.equal(context.document.getElementById('note-panel-history').textContent.includes('미래 내용'), false);
  assert.equal(context.document.getElementById('note-panel-history').textContent.includes('다른 내용'), false);
  assert.match(context.document.getElementById('note-panel-fields').textContent, /ACME/);
  assert.match(context.document.getElementById('note-panel-fields').textContent, /OPP-123/);
  assert.match(context.document.getElementById('note-panel-fields').textContent, /Customer Visit/);
  assert.equal(context.document.querySelector('#note-panel-body ul li')?.textContent, '현재 내용');
  assert.equal(context.document.querySelector('#note-panel-body font')?.getAttribute('color'), '#dc2626');

  context.document.getElementById('input-note-review-comment').value = '다음 회의 전에 확인해 주세요.';
  context.document.getElementById('btn-add-note-review-comment').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(addedComment, {
    noteId: 'note-current',
    taskId: 'task-1',
    body: '다음 회의 전에 확인해 주세요.'
  });
  assert.match(context.document.getElementById('note-panel-comments').textContent, /다음 회의 전에 확인해 주세요/);

  context.document.getElementById('btn-open-note-type-settings').click();
  assert.equal(context.document.getElementById('modal-note-type-settings').classList.contains('hidden'), false);
  const typeRows = [...context.document.querySelectorAll('#note-type-settings-list [data-note-type-id]')];
  typeRows[0].querySelector('input').value = 'Customer Meeting';
  typeRows[1].querySelector('[data-remove-note-type]').click();
  context.document.getElementById('btn-add-note-type').click();
  context.document.querySelector('#note-type-settings-list [data-note-type-id]:last-child input').value = 'New Type';
  context.document.getElementById('btn-save-note-type-settings').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(updatedTracker.trackerId, 'tracker-1');
  assert.deepEqual(
    Array.from(updatedTracker.payload.noteTypeOptions, option => option.label),
    ['Customer Meeting', 'New Type']
  );

  await context.openNoteDetailPanel(notes.find(note => note.id === 'note-subtask-history'));
  assert.deepEqual(
    [...context.document.querySelectorAll('[data-note-history-id]')].map(item => item.dataset.noteHistoryId),
    ['note-subtask-oldest'],
    '하위 업무 메모를 열면 그 하위 업무의 과거 메모만 표시해야 합니다.'
  );
  assert.equal(context.document.getElementById('note-panel-history').textContent.includes('첫 번째 과거 내용'), false);

  await context.openNoteDetailPanel(currentNote);
  context.document.getElementById('btn-note-edit').click();
  context.document.getElementById('input-note-edit-title').value = '수정된 현재 메모';
  context.document.getElementById('input-note-edit-date').value = '2026-07-12';
  context.document.getElementById('input-note-edit-customer').value = '새 고객사';
  context.document.getElementById('input-note-edit-opp-no').value = 'OPP-999';
  context.document.getElementById('input-note-edit-work-type').value = 'CUSTOMER_VISIT';
  context.document.getElementById('input-note-edit-body').innerHTML = '<ul><li><font color="#2563eb">수정된 현재 내용</font></li></ul>';
  context.document.getElementById('btn-note-edit-save').click();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(updatedNote.noteId, 'note-current', 'history가 보여도 선택한 현재 메모 ID만 수정해야 합니다.');
  assert.equal(updatedNote.payload.body, '수정된 현재 내용');
  assert.match(updatedNote.payload.bodyHtml, /<ul>/);
  assert.match(updatedNote.payload.bodyHtml, /#2563eb/);
  assert.equal(updatedNote.payload.customerName, '새 고객사');
  assert.equal(updatedNote.payload.oppNo, 'OPP-999');
  assert.equal(context.document.getElementById('note-panel-body').textContent, '수정된 현재 내용');
  assert.equal(context.document.querySelector('[data-note-history-id="note-oldest"]').textContent.includes('첫 번째 과거 내용'), true);

  console.log('note panel smoke passed: rich fields, comments, work-type settings, exact-task history, and selected-note edits');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
