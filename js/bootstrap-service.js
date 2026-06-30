console.info('Smart Task Flow bootstrap-service.js v20260629-v1 loaded');

async function initializeAuthAndData(){
  if(window.isFirebaseAvailable && window.auth){
    window.onAuthStateChanged(window.auth, async user => {
      // No anonymous sign‑in fallback – users must sign in via email/password.
      // If no user is signed in, the app will stay in unauthenticated state.
      isAuthReady = true;

      if (user) {
        // Firebase users 컬렉션에서 해당 사용자의 승인 상태 조회
        (async () => {
          try {
            const usersCol = window.getUsersCollection();
            let userDoc = null;
            if (usersCol) {
              const docRef = window.fs.doc(usersCol, user.uid);
              const docSnap = await window.fs.getDoc(docRef);
              if (docSnap.exists()) {
                userDoc = docSnap.data();
                // 마스터 어드민(booyoul.oh@kr.spiraxsarco.com)인데 DB에 admin으로 등록 안 되었으면 강제 승인 및 어드민 지정
                const lowerEmail = (user.email || '').toLowerCase().trim();
                const isMasterAdmin = lowerEmail === 'booyoul.oh@kr.spiraxsarco.com' || lowerEmail === 'test.admin@kr.spiraxsarco.com' || lowerEmail === 'test.admin@kr.spiraxsarco.kr';
                if (isMasterAdmin && (userDoc.role !== 'admin' || userDoc.status !== 'approved')) {
                  userDoc.role = 'admin';
                  userDoc.status = 'approved';
                  await window.fs.setDoc(docRef, { role: 'admin', status: 'approved' }, { merge: true });
                }
              } else {
                // 문서가 없으면 레거시 유저 혹은 신규 가입 시 누락된 경우이므로 자동으로 생성 (기본 approved)
                const lowerEmail = (user.email || '').toLowerCase().trim();
                const isMasterAdmin = lowerEmail === 'booyoul.oh@kr.spiraxsarco.com' || lowerEmail === 'test.admin@kr.spiraxsarco.com' || lowerEmail === 'test.admin@kr.spiraxsarco.kr';
                const status = 'approved'; // 레거시 유저(문서 없음)는 기본 승인 처리
                userDoc = {
                  uid: user.uid,
                  email: user.email || '',
                  displayName: user.displayName || user.email.split('@')[0],
                  status: status,
                  role: isMasterAdmin ? 'admin' : 'user', // 마스터 어드민은 기본 어드민
                  createdAt: window.fs.serverTimestamp()
                };
                await window.fs.setDoc(docRef, userDoc);
              }
            }

            if (userDoc) {
              if (userDoc.status === 'approved') {
                window.currentUser = user;
                window.currentUserDoc = userDoc;
                window.currentUserRole = userDoc.role || 'user';
                if (typeof window.renderAuthHeader === 'function') {
                  window.renderAuthHeader();
                }
                // 승인된 유저 목록 구독 시작
                if (typeof window.listenApprovedUsers === 'function') {
                  window.listenApprovedUsers();
                }
                // 어드민인 경우 어드민 전용 사용자 리스너도 구독 시작
                if (typeof window.isAdminUser === 'function' && window.isAdminUser() && typeof window.listenUsersForAdmin === 'function') {
                  window.listenUsersForAdmin();
                }
                fetchInitialData();
              } else if (userDoc.status === 'pending') {
                alert('회원가입 승인 대기 중입니다. 관리자의 승인을 기다려 주세요.');
                window.currentUser = null;
                window.currentUserDoc = null;
                window.currentUserRole = null;
                await window.signOut(window.auth);
                tasks = [];
                trackers = [];
                if (typeof updateUI === 'function') {
                  updateUI();
                }
                if (typeof window.renderAuthHeader === 'function') {
                  window.renderAuthHeader();
                }
              } else if (userDoc.status === 'rejected') {
                alert('회원가입 신청이 거부되었습니다. 관리자에게 문의하세요.');
                window.currentUser = null;
                window.currentUserDoc = null;
                window.currentUserRole = null;
                await window.signOut(window.auth);
                tasks = [];
                trackers = [];
                if (typeof updateUI === 'function') {
                  updateUI();
                }
                if (typeof window.renderAuthHeader === 'function') {
                  window.renderAuthHeader();
                }
              }
            } else {
              // No document found – treat as signed‑in user without extra metadata
              window.currentUser = user;
              window.currentUserDoc = null;
              window.currentUserRole = 'user';
              if (typeof window.renderAuthHeader === 'function') {
                window.renderAuthHeader();
              }
              fetchInitialData();
            }
          } catch (e) {
            console.error('사용자 정보 조회 실패:', e);
            const lowerEmail = (user.email || '').toLowerCase().trim();
            const isMasterAdmin = lowerEmail === 'booyoul.oh@kr.spiraxsarco.com' || lowerEmail === 'test.admin@kr.spiraxsarco.com' || lowerEmail === 'test.admin@kr.spiraxsarco.kr';
            
            window.currentUser = user;
            window.currentUserDoc = isMasterAdmin ? { role: 'admin', status: 'approved' } : null;
            window.currentUserRole = isMasterAdmin ? 'admin' : 'user';
            
            if (typeof window.renderAuthHeader === 'function') {
              window.renderAuthHeader();
            }
            fetchInitialData();
          }
        })();
      } else {
        // No authenticated user – clear UI state
        window.currentUser = null;
        window.currentUserDoc = null;
        window.currentUserRole = null;
        if (typeof window.renderAuthHeader === 'function') {
          window.renderAuthHeader();
        }
        tasks = [];
        trackers = [];
        if (typeof updateUI === 'function') {
          updateUI();
        }
      }
    });
  } else {
    // Firebase not available – mark auth ready and render UI anyway
    isAuthReady = true;
    if (typeof updateUI === 'function') {
      updateUI();
    }
  }
}

function restoreCurrentTrackerSelection(){
  try {
    const saved = localStorage.getItem('flow_current_tracker');
    if (saved && trackers.some(t => t.id === saved)) currentTrackerId = saved;
  } catch (e) {
    console.warn('Tracker restore skipped because localStorage is unavailable.', e);
  }
  updateTrackerUI();
}

function initializeApplicationEvents(){
  if (typeof window.initEventBindings === 'function') window.initEventBindings();
  else console.warn('initEventBindings missing; UI loaded without extra event binding.');
}

async function bootstrapApp(){
  initializeApplicationEvents();
  restoreCurrentTrackerSelection();
  await initializeAuthAndData();
}

window.bootstrapApp = bootstrapApp;
