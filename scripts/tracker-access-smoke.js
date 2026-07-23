const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!doctype html><body>
  <form id="form-tracker"></form>
  <div id="modal-tracker-title"></div>
  <input id="input-tracker-id">
  <input id="input-tracker-name">
  <textarea id="input-tracker-desc"></textarea>
  <div id="tracker-copy-summary" class="hidden"></div>
  <section id="tracker-access-section"><div id="tracker-access-list"></div></section>
  <button id="btn-delete-tracker" class="hidden"></button>
  <button id="btn-save-tracker"></button>
  <div id="tracker-dropdown-menu"></div>
  <div id="modal-tracker" class="hidden"></div>
</body>`);

const context = {
  console: { info() {}, warn() {}, error() {} },
  document: dom.window.document,
  Event: dom.window.Event,
  setTimeout,
  clearTimeout,
  trackers: [],
  tasks: [],
  currentTrackerId: '',
  currentSubTasks: [],
  approvedUsers: [],
  showToast() {},
  escapeHTML: value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]),
};
context.window = context;
context.currentUser = { uid: 'owner', displayName: '소유자', email: 'owner@kr.spiraxsarco.com' };
context.approvedUsers = [
  { uid: 'owner', displayName: '소유자', email: 'owner@kr.spiraxsarco.com' },
  { uid: 'member', displayName: '구성원', email: 'member@kr.spiraxsarco.com' }
];
context.window.approvedUsers = context.approvedUsers;

vm.createContext(context);
vm.runInContext(fs.readFileSync('js/modal-controller.js', 'utf8'), context, { filename: 'js/modal-controller.js' });

const getInputs = uid => [...context.document.querySelectorAll('.tracker-access-checkbox')]
  .filter(input => input.dataset.userId === uid);

context.renderTrackerAccessControl(null, true);
const ownerInputs = getInputs('owner');
const memberInputs = getInputs('member');
assert.equal(ownerInputs.length, 4, '소유자 권한 4개가 표시되어야 합니다.');
assert.equal(ownerInputs.every(input => input.checked && input.disabled), true, '소유자는 전체 권한이 고정되어야 합니다.');
assert.equal(memberInputs.every(input => !input.checked && !input.disabled), true, '신규 트래커의 다른 사용자는 기본적으로 권한이 없어야 합니다.');

const memberCreate = memberInputs.find(input => input.dataset.permission === 'create');
const memberView = memberInputs.find(input => input.dataset.permission === 'view');
memberCreate.checked = true;
memberCreate.dispatchEvent(new dom.window.Event('change'));
assert.equal(memberView.checked, true, '등록 권한을 켜면 조회 권한도 자동으로 켜져야 합니다.');
const newAcl = context.collectTrackerAccessControl();
assert.equal(newAcl.member.create, true);
assert.equal(newAcl.member.view, true);

context.renderTrackerAccessControl({ id: 'legacy', ownerId: 'owner' }, true);
assert.equal(context.collectTrackerAccessControl(), null, '기존 트래커는 권한을 건드리지 않으면 ACL로 자동 전환되면 안 됩니다.');

context.renderTrackerAccessControl({
  id: 'acl',
  ownerId: 'owner',
  accessControl: {
    owner: { view: true, create: true, update: true, delete: true },
    member: { view: true, create: false, update: true, delete: false }
  }
}, true);
const savedMemberInputs = getInputs('member');
assert.equal(savedMemberInputs.find(input => input.dataset.permission === 'view').checked, true);
assert.equal(savedMemberInputs.find(input => input.dataset.permission === 'update').checked, true);
assert.equal(savedMemberInputs.find(input => input.dataset.permission === 'delete').checked, false);

context.trackers = [{
  id: 'source',
  name: '원본 트래커',
  desc: '원본 설명',
  ownerId: 'another-owner',
  accessControl: {
    owner: { view: true, create: false, update: false, delete: false }
  }
}];
context.tasks = [
  { id: 'task-1', trackerId: 'source', deleted: false },
  { id: 'task-deleted', trackerId: 'source', deleted: true }
];
context.currentTrackerId = 'source';
context.hasTaskPermission = (_tracker, permission) => permission === 'view';
context.openTrackerCopyModal('source');
assert.equal(context.document.getElementById('input-tracker-id').value, '', '복사는 원본 트래커 ID를 재사용하면 안 됩니다.');
assert.equal(context.document.getElementById('input-tracker-name').value, '원본 트래커 - 복사본');
assert.match(context.document.getElementById('tracker-copy-summary').textContent, /활성 태스크 1개/);
assert.match(context.document.getElementById('tracker-copy-summary').textContent, /태스크 메모, 진행 메모, 변경 이력, 원본 사용자 권한은 복사하지 않으며/);
assert.equal(context.document.getElementById('btn-save-tracker').textContent, '복사하기');
assert.equal(context.document.getElementById('tracker-access-section').classList.contains('hidden'), true, '복사 시 적용되지 않는 권한 편집 UI는 숨겨야 합니다.');

console.log('tracker access smoke passed: owner lock, permission dependencies, legacy compatibility, copy mode');
