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
vm.runInThisContext(authService, { filename: 'js/auth-service.js' });

assert.equal(hasWritePermission({ createdBy: 'user-1' }), true, '작성자는 자신의 업무를 수정할 수 있어야 합니다.');
assert.equal(hasWritePermission({ createdBy: 'user-2' }), false, '일반 사용자는 다른 사용자의 업무를 수정할 수 없어야 합니다.');
assert.equal(hasWritePermission({ createdBy: 'anonymous' }), false, '일반 사용자는 레거시 업무를 수정할 수 없어야 합니다.');
assert.equal(hasWritePermission({}), false, '소유권 없는 업무는 관리자만 수정할 수 있어야 합니다.');

global.currentUserDoc = { role: 'admin', status: 'approved' };
assert.equal(hasWritePermission({ createdBy: 'user-2' }), true, '관리자는 다른 사용자의 업무를 수정할 수 있어야 합니다.');

console.log('security smoke passed: approval, role, ownership, legacy write guards');
