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
    <div id="note-panel-body"></div>
    <section id="note-panel-history-section" class="hidden">
      <span id="note-panel-history-count"></span>
      <div id="note-panel-history"></div>
    </section>
  </div>
  <div id="note-panel-edit-mode" class="hidden">
    <input id="input-note-edit-title">
    <input id="input-note-edit-date">
    <textarea id="input-note-edit-body"></textarea>
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
</body>`);

const currentNote = {
  id: 'note-current',
  taskId: 'task-1',
  title: '현재 메모',
  body: '현재 내용',
  noteDate: '2026-07-12',
  createdAt: new Date('2026-07-12T10:00:00+09:00'),
  createdByName: 'current@example.com',
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
    trackers: [],
    currentTrackerId: 'tracker-1',
    currentSubTasks: [],
    approvedUsers: [],
    showToast() {},
    renderActiveViews() {},
    escapeHTML: value => String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]),
  };
  context.window = context;
  context.db_fetchProgressNotes = async taskId => {
    assert.equal(taskId, 'task-1', 'history 조회는 선택 메모의 본 업무 ID를 사용해야 합니다.');
    return notes;
  };
  context.db_updateProgressNote = async (noteId, payload) => {
    updatedNote = { noteId, payload };
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
    ['note-subtask-history', 'note-oldest'],
    '같은 본 업무의 과거 메모만 최신순으로 표시해야 합니다.'
  );
  assert.equal(context.document.getElementById('note-panel-history-count').textContent, '2건');
  assert.equal(context.document.getElementById('note-panel-history').textContent.includes('미래 내용'), false);
  assert.equal(context.document.getElementById('note-panel-history').textContent.includes('다른 내용'), false);

  context.document.getElementById('btn-note-edit').click();
  context.document.getElementById('input-note-edit-title').value = '수정된 현재 메모';
  context.document.getElementById('input-note-edit-date').value = '2026-07-12';
  context.document.getElementById('input-note-edit-body').value = '수정된 현재 내용';
  context.document.getElementById('btn-note-edit-save').click();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(updatedNote.noteId, 'note-current', 'history가 보여도 선택한 현재 메모 ID만 수정해야 합니다.');
  assert.equal(updatedNote.payload.body, '수정된 현재 내용');
  assert.equal(context.document.getElementById('note-panel-body').textContent, '수정된 현재 내용');
  assert.equal(context.document.querySelector('[data-note-history-id="note-oldest"]').textContent.includes('첫 번째 과거 내용'), true);

  console.log('note panel smoke passed: task history is newest-first and edits target only the selected note');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
