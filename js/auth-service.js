// js/auth-service.js
console.info('Smart Task Flow auth-service.js loaded');

// 가입을 허용할 사내 이메일 도메인 설정 (필요시 도메인 추가 가능)
const ALLOWED_DOMAINS = ['@kr.spiraxsarco.com', '@kr.spiraxsarco.kr', '@test.com'];

function validateEmailDomain(email) {
    if (!email) return false;
    const lowerEmail = email.toLowerCase().trim();
    return ALLOWED_DOMAINS.some(domain => lowerEmail.endsWith(domain.toLowerCase()));
}

async function signUpWithEmail(email, password, displayName) {
    if (!window.isFirebaseAvailable || !window.auth) {
        alert("Firebase를 사용할 수 없습니다.");
        return;
    }
    if (!validateEmailDomain(email)) {
        alert(`가입이 불가능한 이메일입니다. 다음 도메인만 허용됩니다: ${ALLOWED_DOMAINS.join(', ')}`);
        return;
    }
    if (!displayName || !displayName.trim()) {
        alert("이름(표시명)은 필수 입력 항목입니다.");
        return;
    }
    try {
        const userCredential = await window.createUserWithEmailAndPassword(window.auth, email, password);
        const user = userCredential.user;
        
        // 1. Auth 프로필에 displayName 설정
        await window.updateProfile(user, { displayName: displayName.trim() });
        
        // 2. Firestore 'users' 컬렉션에 사용자 등록 신청 정보 저장
        const usersCol = window.getUsersCollection();
        if (usersCol) {
            const lowerEmail = email.toLowerCase().trim();
            const isAdmin = lowerEmail === 'booyoul.oh@kr.spiraxsarco.com' || lowerEmail === 'test.admin@kr.spiraxsarco.com' || lowerEmail === 'test.admin@kr.spiraxsarco.kr';
            const status = isAdmin ? 'approved' : 'pending';
            
            await window.fs.setDoc(window.fs.doc(usersCol, user.uid), {
                uid: user.uid,
                email: user.email,
                displayName: displayName.trim(),
                status: status,
                role: isAdmin ? 'admin' : 'user',
                createdAt: window.fs.serverTimestamp()
            });
        }
        
        console.log("회원가입 성공:", user);
        if (email.toLowerCase().trim() === 'booyoul.oh@kr.spiraxsarco.com') {
            alert("관리자 계정 회원가입에 성공했습니다! 자동으로 로그인됩니다.");
        } else {
            alert("회원가입 신청이 완료되었습니다! 관리자의 승인 후 사용하실 수 있습니다.");
        }
    } catch (error) {
        console.error("회원가입 실패:", error);
        alert("회원가입 실패: " + error.message);
    }
}

async function loginWithEmail(email, password) {
    if (!window.isFirebaseAvailable || !window.auth) {
        alert("Firebase를 사용할 수 없습니다.");
        return;
    }
    if (!validateEmailDomain(email)) {
        alert(`허용되지 않은 사내 이메일입니다. (${ALLOWED_DOMAINS.join(', ')} 도메인만 허용)`);
        return;
    }
    try {
        await window.signInWithEmailAndPassword(window.auth, email, password);
    } catch (error) {
        console.error("로그인 실패:", error);
        alert("로그인 실패: 이메일 또는 비밀번호를 확인해 주세요.");
    }
}

async function logout() {
    if (!window.isFirebaseAvailable || !window.auth) return;
    try {
        await window.signOut(window.auth);
        window.currentUser = null;
        window.currentUserDoc = null;
        window.currentUserRole = null;
        if (typeof updateUI === 'function') {
            updateUI();
        }
    } catch (error) {
        console.error("로그아웃 실패:", error);
    }
}

function renderAuthHeader() {
    const userMenuContainer = document.getElementById('user-menu-container');
    if (!userMenuContainer) return;

    if (window.currentUser) {
        const displayName = window.currentUser.displayName || window.currentUser.email || '사용자';
        const initial = displayName.charAt(0).toUpperCase();
        
        // 이메일 기반 로그인 사용자를 위한 텍스트 아바타 렌더링
        userMenuContainer.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm">
                    ${initial}
                </div>
                <div class="hidden md:flex flex-col text-left">
                    <span class="text-xs font-semibold text-slate-700">${displayName.split('@')[0]}</span>
                    <span class="text-[10px] text-slate-400">${window.currentUser.email || ''}</span>
                </div>
                <button id="btn-logout" class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition font-medium">로그아웃</button>
            </div>
        `;
    } else {
        // 비로그인 상태일 때는 헤더에 별도의 간편 버튼 대신 공백이나 간단한 문구 노출 가능
        userMenuContainer.innerHTML = `
            <span class="text-xs text-slate-400 font-medium">로그인이 필요합니다</span>
        `;
    }

    // 어드민 뷰 토글 버튼 노출 관리
    const btnViewAdmin = document.getElementById('btn-view-admin');
    if (btnViewAdmin) {
        if (window.currentUser && isAdminUser()) {
            btnViewAdmin.classList.remove('hidden');
        } else {
            btnViewAdmin.classList.add('hidden');
        }
    }
}

function isAdminUser() {
    if (!window.currentUser) return false;
    // 1. 마스터 어드민 이메일 (하드코딩 백업)
    const email = (window.currentUser.email || '').toLowerCase().trim();
    if (email === 'booyoul.oh@kr.spiraxsarco.com' || email === 'test.admin@kr.spiraxsarco.com' || email === 'test.admin@kr.spiraxsarco.kr') return true;
    // 2. Firestore users 콜렉션의 role 필드가 'admin'인 경우
    return window.currentUserDoc?.role === 'admin';
}

function hasWritePermission(item) {
    if (!window.currentUser) {
        console.warn('hasWritePermission 거부: 로그인된 사용자가 없습니다.');
        return false;
    }
    if (typeof isAdminUser === 'function' && isAdminUser()) return true; // 관리자는 전체 권한 허용
    if (!item) return true;
    if (!item.createdBy || item.createdBy === 'anonymous') return true; // 레거시 및 anonymous 데이터 허용
    
    const hasPermission = item.createdBy === window.currentUser.uid;
    if (!hasPermission) {
        console.warn(`hasWritePermission 거부: 데이터 작성자(${item.createdBy})와 현재 사용자(${window.currentUser.uid})가 일치하지 않습니다.`);
    }
    return hasPermission;
}

window.signUpWithEmail = signUpWithEmail;
window.loginWithEmail = loginWithEmail;
window.logout = logout;
window.renderAuthHeader = renderAuthHeader;
window.hasWritePermission = hasWritePermission;
window.isAdminUser = isAdminUser;
