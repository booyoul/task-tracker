const fs = require('node:fs');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require('@firebase/rules-unit-testing');
const {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc
} = require('firebase/firestore');

const PROJECT_ID = 'demo-task-tracker-security';
const ENV_APP_ID = 'default-app-id';

function userData(uid, status = 'approved', role = 'user') {
  return {
    uid,
    email: `${uid}@kr.spiraxsarco.com`,
    displayName: uid,
    status,
    role
  };
}

function taskData(ownerId, title = `${ownerId} 업무`) {
  return {
    title,
    status: 'PENDING',
    createdBy: ownerId,
    ownerId
  };
}

async function seedData(testEnv) {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const data of [
      userData('alice'),
      userData('bob'),
      userData('pending-user', 'pending'),
      userData('admin', 'approved', 'admin')
    ]) {
      await setDoc(doc(db, 'users', data.uid), data);
      await setDoc(doc(db, 'artifacts', ENV_APP_ID, 'public', 'data', 'users', data.uid), data);
    }

    await setDoc(doc(db, 'tasks', 'alice-task'), taskData('alice'));
    await setDoc(doc(db, 'tasks', 'legacy-task'), {
      title: '레거시 업무',
      status: 'PENDING',
      createdBy: 'anonymous',
      ownerId: 'anonymous'
    });
    await setDoc(
      doc(db, 'artifacts', ENV_APP_ID, 'public', 'data', 'tasks', 'alice-task'),
      taskData('alice', '환경별 Alice 업무')
    );
  });
}

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8')
    }
  });

  let passed = 0;
  const check = async (name, callback) => {
    await callback();
    passed += 1;
    console.log(`✓ ${name}`);
  };

  try {
    await testEnv.clearFirestore();
    await seedData(testEnv);

    const aliceDb = testEnv.authenticatedContext('alice', {
      email: 'alice@kr.spiraxsarco.com'
    }).firestore();
    const bobDb = testEnv.authenticatedContext('bob', {
      email: 'bob@kr.spiraxsarco.com'
    }).firestore();
    const pendingDb = testEnv.authenticatedContext('pending-user', {
      email: 'pending-user@kr.spiraxsarco.com'
    }).firestore();
    const adminDb = testEnv.authenticatedContext('admin', {
      email: 'admin@kr.spiraxsarco.com'
    }).firestore();
    const masterDb = testEnv.authenticatedContext('master-without-document', {
      email: 'booyoul.oh@kr.spiraxsarco.com'
    }).firestore();
    const anonymousDb = testEnv.unauthenticatedContext().firestore();

    await check('비로그인 사용자의 업무 읽기 차단', () =>
      assertFails(getDoc(doc(anonymousDb, 'tasks', 'alice-task'))));
    await check('승인 대기 사용자의 업무 읽기 차단', () =>
      assertFails(getDoc(doc(pendingDb, 'tasks', 'alice-task'))));
    await check('승인 사용자의 업무 읽기 허용', () =>
      assertSucceeds(getDoc(doc(aliceDb, 'tasks', 'alice-task'))));

    await check('작성자의 자신의 업무 생성 허용', () =>
      assertSucceeds(setDoc(doc(aliceDb, 'tasks', 'alice-new-task'), taskData('alice'))));
    await check('다른 사용자 명의의 업무 생성 차단', () =>
      assertFails(setDoc(doc(aliceDb, 'tasks', 'spoofed-task'), taskData('bob'))));
    await check('작성자의 자신의 업무 수정 허용', () =>
      assertSucceeds(updateDoc(doc(aliceDb, 'tasks', 'alice-task'), { status: 'COMPLETED' })));
    await check('다른 사용자의 업무 수정 차단', () =>
      assertFails(updateDoc(doc(bobDb, 'tasks', 'alice-task'), { status: 'PROGRESS' })));
    await check('작성자의 소유권 이전 차단', () =>
      assertFails(updateDoc(doc(aliceDb, 'tasks', 'alice-task'), { createdBy: 'bob', ownerId: 'bob' })));
    await check('관리자의 다른 사용자 업무 수정 허용', () =>
      assertSucceeds(updateDoc(doc(adminDb, 'tasks', 'alice-task'), { status: 'PROGRESS' })));
    await check('일반 사용자의 레거시 업무 수정 차단', () =>
      assertFails(updateDoc(doc(aliceDb, 'tasks', 'legacy-task'), { status: 'COMPLETED' })));
    await check('관리자의 레거시 업무 수정 허용', () =>
      assertSucceeds(updateDoc(doc(adminDb, 'tasks', 'legacy-task'), { status: 'COMPLETED' })));

    const charlieDb = testEnv.authenticatedContext('charlie', {
      email: 'charlie@kr.spiraxsarco.com'
    }).firestore();
    await check('일반 사용자의 pending/user 자체 등록 허용', () =>
      assertSucceeds(setDoc(doc(charlieDb, 'users', 'charlie'), userData('charlie', 'pending', 'user'))));
    await check('신규 사용자의 approved/admin 자체 등록 차단', () =>
      assertFails(setDoc(doc(charlieDb, 'users', 'charlie-admin'), {
        ...userData('charlie-admin', 'approved', 'admin'),
        uid: 'charlie'
      })));
    await check('승인 대기 사용자의 관리자 자체 승격 차단', () =>
      assertFails(updateDoc(doc(pendingDb, 'users', 'pending-user'), { role: 'admin', status: 'approved' })));
    await check('사용자의 자신의 표시명 수정 허용', () =>
      assertSucceeds(updateDoc(doc(pendingDb, 'users', 'pending-user'), { displayName: '새 표시명' })));
    await check('승인 사용자의 승인 사용자 조회 허용', () =>
      assertSucceeds(getDoc(doc(aliceDb, 'users', 'bob'))));
    await check('일반 사용자의 승인 대기 사용자 조회 차단', () =>
      assertFails(getDoc(doc(aliceDb, 'users', 'pending-user'))));

    await check('메모 작성자 UID 위조 차단', () =>
      assertFails(setDoc(doc(aliceDb, 'progress_notes', 'spoofed-note'), {
        taskId: 'alice-task',
        trackerId: 'tracker-1',
        title: '위조 메모',
        body: '',
        createdBy: 'bob'
      })));
    await check('자신의 메모 생성 허용', () =>
      assertSucceeds(setDoc(doc(aliceDb, 'progress_notes', 'alice-note'), {
        taskId: 'alice-task',
        trackerId: 'tracker-1',
        title: '정상 메모',
        body: '',
        createdBy: 'alice'
      })));
    await check('다른 사용자의 메모 삭제 차단', () =>
      assertFails(deleteDoc(doc(bobDb, 'progress_notes', 'alice-note'))));
    await check('관리자의 다른 사용자 메모 삭제 허용', () =>
      assertSucceeds(deleteDoc(doc(adminDb, 'progress_notes', 'alice-note'))));

    await check('변경 이력 작성자 UID 위조 차단', () =>
      assertFails(setDoc(doc(aliceDb, 'activity_logs', 'spoofed-log'), {
        taskId: 'alice-task',
        action: 'UPDATE',
        changedBy: 'bob'
      })));
    await check('자신의 변경 이력 생성 허용', () =>
      assertSucceeds(setDoc(doc(aliceDb, 'activity_logs', 'alice-log'), {
        taskId: 'alice-task',
        action: 'UPDATE',
        changedBy: 'alice'
      })));

    const envTaskPath = ['artifacts', ENV_APP_ID, 'public', 'data', 'tasks', 'alice-task'];
    await check('환경별 컬렉션에서 승인 사용자의 업무 읽기 허용', () =>
      assertSucceeds(getDoc(doc(aliceDb, ...envTaskPath))));
    await check('환경별 컬렉션에서 다른 사용자의 업무 수정 차단', () =>
      assertFails(updateDoc(doc(bobDb, ...envTaskPath), { status: 'COMPLETED' })));
    await check('사용자 문서가 없는 마스터 관리자의 업무 수정 허용', () =>
      assertSucceeds(updateDoc(doc(masterDb, 'tasks', 'alice-task'), { status: 'COMPLETED' })));

    console.log(`Firestore Rules emulator tests passed: ${passed} cases`);
  } finally {
    await testEnv.cleanup();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
