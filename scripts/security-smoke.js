const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const rules = fs.readFileSync('firestore.rules', 'utf8');
const authService = fs.readFileSync('js/auth-service.js', 'utf8');
const state = fs.readFileSync('js/state.js', 'utf8');
const bootstrap = fs.readFileSync('js/bootstrap-service.js', 'utf8');

function getRuleBlock(pathPattern) {
  const escaped = pathPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = rules.match(new RegExp(`match ${escaped} \\{([\\s\\S]*?)\\n    \\}`));
  assert(match, `Firestore Rules 블록을 찾을 수 없습니다: ${pathPattern}`);
  return match[1];
}

const taskBlocks = [
  getRuleBlock('/tasks/{taskId}'),
  getRuleBlock('/artifacts/{envAppId}/public/data/tasks/{taskId}')
];
for (const block of taskBlocks) {
  assert.match(block, /allow read: if is(?:Env)?Approved/);
  assert.match(block, /isResourceOwner\(\)/);
  assert.doesNotMatch(block, /allow update, delete: if isAuthenticated\(\)/);
}

const userBlocks = [
  getRuleBlock('/users/{userId}'),
  getRuleBlock('/artifacts/{envAppId}/public/data/users/{userId}')
];
for (const block of userBlocks) {
  assert.match(block, /isValidSelfRegistration\(userId\)/);
  assert.match(block, /isSafeSelfProfileUpdate\(userId\)/);
}

assert.match(rules, /request\.resource\.data\.status == 'pending'/);
assert.match(rules, /request\.resource\.data\.role == 'user'/);
assert.match(rules, /function hasTrackerPermission\(trackerId, permission\)/);
assert.match(rules, /hasTrackerPermission\(resource\.data\.trackerId, 'view'\)/);
assert.match(rules, /hasTrackerPermission\(request\.resource\.data\.trackerId, 'create'\)/);
assert.match(rules, /hasTrackerPermission\(resource\.data\.trackerId, 'delete'\)/);
assert.doesNotMatch(rules, /test\.admin@kr\.spiraxsarco/);
assert.doesNotMatch(state, /test\.admin@kr\.spiraxsarco/);
assert.doesNotMatch(bootstrap, /const status = 'approved'/);

const adminEmails = [...state.matchAll(/'([^']+@kr\.spiraxsarco\.(?:com|kr))'/g)].map(match => match[1]);
assert(adminEmails.length > 0, '클라이언트 마스터 관리자 목록이 비어 있습니다.');
for (const email of adminEmails) {
  assert(rules.includes(`'${email}'`), `Firestore Rules 마스터 관리자 목록 불일치: ${email}`);
}

global.window = global;
global.currentUser = { uid: 'user-1', email: 'user-1@kr.spiraxsarco.com' };
global.currentUserDoc = { role: 'user', status: 'approved' };
global.isMasterAdmin = () => false;
global.currentTrackerId = 'tracker-1';
global.trackers = [{ id: 'tracker-1', name: '레거시 트래커', createdBy: 'owner-user' }];
vm.runInThisContext(authService, { filename: 'js/auth-service.js' });

assert.equal(hasWritePermission({ trackerId: 'tracker-1', createdBy: 'user-1' }), true, 'ACL 이전 업무는 작성자가 수정할 수 있어야 합니다.');
assert.equal(hasWritePermission({ trackerId: 'tracker-1', createdBy: 'user-2' }), false, 'ACL 이전 업무는 다른 사용자가 수정할 수 없어야 합니다.');
assert.equal(hasWritePermission({ trackerId: 'tracker-1', createdBy: 'anonymous' }), false, '일반 사용자는 레거시 업무를 수정할 수 없어야 합니다.');

global.trackers.push({
  id: 'tracker-acl',
  name: '권한 트래커',
  ownerId: 'owner-user',
  accessControl: {
    'user-1': { view: true, create: true, update: false, delete: false }
  }
});
const aclTask = { trackerId: 'tracker-acl', createdBy: 'user-2' };
assert.equal(hasTaskPermission(aclTask, 'view'), true, '조회 권한이 부여된 사용자는 트래커 업무를 볼 수 있어야 합니다.');
assert.equal(hasTaskPermission(aclTask, 'create'), true, '등록 권한이 부여된 사용자는 업무를 만들 수 있어야 합니다.');
assert.equal(hasTaskPermission(aclTask, 'update'), false, '수정 권한이 없는 사용자는 업무를 수정할 수 없어야 합니다.');
assert.equal(hasTaskPermission(aclTask, 'delete'), false, '삭제 권한이 없는 사용자는 업무를 삭제할 수 없어야 합니다.');

global.currentUserDoc = { role: 'admin', status: 'approved' };
assert.equal(hasTaskPermission(aclTask, 'delete'), true, '관리자는 트래커 ACL과 관계없이 전체 권한을 가져야 합니다.');

console.log('security smoke passed: approval, role, tracker ACL, legacy write guards');
