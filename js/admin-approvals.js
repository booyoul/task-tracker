// js/admin-approvals.js
console.info('Smart Task Flow admin-approvals.js loaded');

let unsubscribeAdminUsers = null;
let unsubscribeApprovedUsers = null;
let currentAdminTab = 'PENDING'; // PENDING 또는 ALL

// 1. 관리자 전용 사용자 구독 및 렌더링
function listenUsersForAdmin() {
    if (!window.isFirebaseAvailable || !window.db) return;
    const usersCol = window.getUsersCollection();
    if (!usersCol) return;

    // 모든 사용자 문서를 가입일 역순으로 정렬하여 구독
    const q = window.fs.query(usersCol, window.fs.orderBy('createdAt', 'desc'));
    
    unsubscribeAdminUsers = window.fs.onSnapshot(q, (snapshot) => {
        const users = [];
        snapshot.forEach(doc => {
            users.push(doc.data());
        });
        
        renderAdminDashboard(users);
    }, (error) => {
        console.error("Admin users snapshot listen failed:", error);
    });
}

function renderAdminDashboard(users) {
    const pendingUsers = users.filter(u => u.status === 'pending');
    
    // 대기자 카운트 업데이트
    const countEl = document.getElementById('admin-pending-count');
    if (countEl) countEl.textContent = pendingUsers.length;

    // 1) 승인 대기자 렌더링
    const pendingTbody = document.getElementById('admin-pending-tbody');
    if (pendingTbody) {
        if (pendingUsers.length === 0) {
            pendingTbody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-4 py-8 text-center text-slate-400 font-medium">대기 중인 가입 신청자가 없습니다.</td>
                </tr>
            `;
        } else {
            pendingTbody.innerHTML = pendingUsers.map(u => {
                const dateStr = u.createdAt && typeof u.createdAt.toDate === 'function' 
                    ? u.createdAt.toDate().toLocaleDateString('ko-KR') 
                    : '미정';
                return `
                    <tr class="hover:bg-slate-50 transition">
                        <td class="px-4 py-3">
                            <div class="flex items-center gap-2">
                                <span class="font-semibold text-slate-700 admin-name-display" data-uid="${escapeHTML(u.uid)}" title="클릭하여 이름 수정">${escapeHTML(u.displayName)}</span>
                                <button onclick="window.editDisplayName('${escapeHTML(u.uid)}', this)" class="text-indigo-400 hover:text-indigo-600 transition" title="이름 수정">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                                </button>
                            </div>
                        </td>
                        <td class="px-4 py-3 text-slate-500 font-mono text-xs">${escapeHTML(u.email)}</td>
                        <td class="px-4 py-3 text-slate-400 text-xs">${dateStr}</td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <button onclick="window.approveUser('${u.uid}')" class="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm transition mr-1.5">승인</button>
                            <button onclick="window.rejectUser('${u.uid}')" class="px-2.5 py-1 text-xs bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-bold shadow-sm transition mr-1.5">거부</button>
                            <button onclick="window.deleteUser('${u.uid}', '${escapeHTML(u.displayName)}')" class="px-2.5 py-1 text-xs bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-bold shadow-sm transition">삭제</button>
                        </td>
                    </tr>
                `;
            }).join('');

        }
    }

    // 2) 전체 사용자 렌더링
    const allTbody = document.getElementById('admin-all-tbody');
    if (allTbody) {
        if (users.length === 0) {
            allTbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-8 text-center text-slate-400 font-medium">가입된 사용자가 없습니다.</td>
                </tr>
            `;
        } else {
            allTbody.innerHTML = users.map(u => {
                const dateStr = u.createdAt && typeof u.createdAt.toDate === 'function' 
                    ? u.createdAt.toDate().toLocaleDateString('ko-KR') 
                    : '미정';
                
                let statusBadge = '';
                let actionBtn = '';
                
                const loggedInUserUid = window.currentUser?.uid;
                const isSelf = u.uid === loggedInUserUid;
                
                if (u.status === 'approved') {
                    statusBadge = `<span class="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md font-bold">승인됨</span>`;
                    if (!isSelf) {
                        actionBtn = `<button onclick="window.rejectUser('${u.uid}')" class="px-2 py-0.5 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-md font-semibold transition mr-1">거부 처리</button>`;
                    }
                } else if (u.status === 'pending') {
                    statusBadge = `<span class="px-2 py-0.5 text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-md font-bold">대기 중</span>`;
                    actionBtn = `
                        <button onclick="window.approveUser('${u.uid}')" class="px-2 py-0.5 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 rounded-md font-semibold transition mr-1">승인</button>
                        <button onclick="window.rejectUser('${u.uid}')" class="px-2 py-0.5 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-md font-semibold transition mr-1">거부</button>
                    `;
                } else if (u.status === 'rejected') {
                    statusBadge = `<span class="px-2 py-0.5 text-xs bg-rose-50 text-rose-700 border border-rose-100 rounded-md font-bold">거부됨</span>`;
                    actionBtn = `<button onclick="window.approveUser('${u.uid}')" class="px-2 py-0.5 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 rounded-md font-semibold transition mr-1">다시 승인</button>`;
                }
                
                if (!isSelf) {
                    actionBtn += `<button onclick="window.deleteUser('${u.uid}', '${escapeHTML(u.displayName)}')" class="px-2 py-0.5 text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md font-semibold transition">삭제</button>`;
                }

                const isAdminRole = u.role === 'admin';
                const isMasterAdmin = window.isMasterAdmin(u.email);

                let roleCell = '';
                if (isMasterAdmin) {
                    roleCell = `<span class="px-2 py-0.5 text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded-md font-bold">최고 관리자</span>`;
                } else {
                    roleCell = `
                        <button onclick="window.setAdminRole('${escapeHTML(u.uid)}', ${!isAdminRole})"
                            class="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold rounded-md border transition ${isAdminRole ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}">
                            <span class="w-2 h-2 rounded-full ${isAdminRole ? 'bg-violet-500' : 'bg-slate-300'}"></span>
                            ${isAdminRole ? '관리자' : '일반'}
                        </button>`;
                }

                return `
                    <tr class="hover:bg-slate-50 transition">
                        <td class="px-4 py-3">
                            <div class="flex items-center gap-2">
                                <span class="font-semibold text-slate-700 admin-name-display" data-uid="${escapeHTML(u.uid)}" title="클릭하여 이름 수정">${escapeHTML(u.displayName)}</span>
                                <button onclick="window.editDisplayName('${escapeHTML(u.uid)}', this)" class="text-indigo-400 hover:text-indigo-600 transition" title="이름 수정">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                                </button>
                            </div>
                        </td>
                        <td class="px-4 py-3 text-slate-500 font-mono text-xs">${escapeHTML(u.email)}</td>
                        <td class="px-4 py-3 text-slate-400 text-xs">${dateStr}</td>
                        <td class="px-4 py-3">${statusBadge}</td>
                        <td class="px-4 py-3 text-center">${roleCell}</td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">${actionBtn}</td>
                    </tr>
                `;
            }).join('');

        }
    }
}

// 2. 가입 상태 업데이트 처리
async function approveUser(uid) {
    if (!window.isFirebaseAvailable || !window.db) return;
    const usersCol = window.getUsersCollection();
    if (!usersCol) return;

    try {
        await window.fs.setDoc(window.fs.doc(usersCol, uid), { status: 'approved' }, { merge: true });
        console.log(`사용자 승인 완료: ${uid}`);
    } catch (e) {
        console.error("User approval update failed:", e);
        if (e.code === 'permission-denied' || (e.message && (e.message.includes('permission') || e.message.includes('Permission')))) {
            alert("승인 처리에 실패했습니다: " + e.message + "\n\n[권한 오류 가이드]\n현재 로그인한 계정에 다른 사용자의 문서를 수정할 수 있는 Firestore 보안 규칙(Security Rules)이 적용되어 있지 않은 상태일 가능성이 큽니다.\nFirebase Console에서 보안 규칙을 수정해 주시거나, 프로젝트 루트에 새로 생성된 'firestore.rules' 파일을 적용해 주세요.");
        } else {
            alert("승인 처리에 실패했습니다: " + e.message);
        }
    }
}

async function rejectUser(uid) {
    if (!confirm("해당 사용자의 등록 신청을 거부하시겠습니까? (이미 승인된 사용자라면 로그인이 불가능하게 변경됩니다)")) return;
    if (!window.isFirebaseAvailable || !window.db) return;
    const usersCol = window.getUsersCollection();
    if (!usersCol) return;

    try {
        await window.fs.setDoc(window.fs.doc(usersCol, uid), { status: 'rejected' }, { merge: true });
        console.log(`사용자 거부 완료: ${uid}`);
    } catch (e) {
        console.error("User rejection update failed:", e);
        if (e.code === 'permission-denied' || (e.message && (e.message.includes('permission') || e.message.includes('Permission')))) {
            alert("거부 처리에 실패했습니다: " + e.message + "\n\n[권한 오류 가이드]\n현재 로그인한 계정에 다른 사용자의 문서를 수정할 수 있는 Firestore 보안 규칙(Security Rules)이 적용되어 있지 않은 상태일 가능성이 큽니다.\nFirebase Console에서 보안 규칙을 수정해 주시거나, 프로젝트 루트에 새로 생성된 'firestore.rules' 파일을 적용해 주세요.");
        } else {
            alert("거부 처리에 실패했습니다: " + e.message);
        }
    }
}

// 2.5 가입 신청 및 유저 정보 완전히 삭제
async function deleteUser(uid, displayName) {
    if (!confirm(`'${displayName}' 사용자의 가입 신청 및 계정 정보를 완전히 삭제하시겠습니까? (삭제된 데이터는 복구할 수 없습니다)`)) return;
    if (!window.isFirebaseAvailable || !window.db) return;
    const usersCol = window.getUsersCollection();
    if (!usersCol) return;

    try {
        await window.fs.deleteDoc(window.fs.doc(usersCol, uid));
        console.log(`사용자 삭제 완료: ${uid}`);
    } catch (e) {
        console.error("User deletion failed:", e);
        if (e.code === 'permission-denied' || (e.message && (e.message.includes('permission') || e.message.includes('Permission')))) {
            alert("사용자 삭제에 실패했습니다: " + e.message + "\n\n[권한 오류 가이드]\n현재 로그인한 계정에 관리자(Admin) 권한이 없거나, 다른 사용자의 문서를 삭제할 수 있는 Firestore 보안 규칙(Security Rules)이 적용되어 있지 않은 상태일 가능성이 큽니다.");
        } else {
            alert("사용자 삭제에 실패했습니다: " + e.message);
        }
    }
}

// 3. 표시명(이름) 인라인 수정
function editDisplayName(uid, btn) {
    const cell = btn.closest('td');
    const nameSpan = cell.querySelector('.admin-name-display');
    if (!nameSpan) return;

    const currentName = nameSpan.textContent.trim();
    // 이미 편집 중이면 중복 실행 방지
    if (cell.querySelector('input.admin-name-input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'admin-name-input w-32 px-2 py-0.5 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '저장';
    saveBtn.className = 'ml-1 px-2 py-0.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '취소';
    cancelBtn.className = 'ml-1 px-2 py-0.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold transition';

    // 원래 요소 숨기기
    nameSpan.style.display = 'none';
    btn.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center gap-1';
    wrapper.appendChild(input);
    wrapper.appendChild(saveBtn);
    wrapper.appendChild(cancelBtn);
    cell.appendChild(wrapper);
    input.focus();
    input.select();

    const restore = () => {
        nameSpan.style.display = '';
        btn.style.display = '';
        wrapper.remove();
    };

    const save = async () => {
        const newName = input.value.trim();
        if (!newName) { alert('이름(표시명)은 비워둘 수 없습니다.'); input.focus(); return; }
        if (newName === currentName) { restore(); return; }
        if (!window.isFirebaseAvailable || !window.db) { restore(); return; }
        const usersCol = window.getUsersCollection();
        if (!usersCol) { restore(); return; }
        try {
            saveBtn.disabled = true;
            saveBtn.textContent = '저장 중…';
            await window.fs.setDoc(window.fs.doc(usersCol, uid), { displayName: newName }, { merge: true });
            console.log(`표시명 수정 완료: ${uid} → ${newName}`);
            // 실시간 리스너가 자동으로 UI 갱신
        } catch (e) {
            console.error('표시명 수정 실패:', e);
            alert('이름 수정에 실패했습니다: ' + e.message);
            restore();
        }
    };

    saveBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', restore);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') restore();
    });
}


// 3. 일반/관리자 공용: 승인된 사용자 구독
function listenApprovedUsers() {
    if (!window.isFirebaseAvailable || !window.db) return;
    const usersCol = window.getUsersCollection();
    if (!usersCol) return;

    // 실시간으로 status가 'approved'인 사용자를 구독
    const q = window.fs.query(usersCol, window.fs.where('status', '==', 'approved'));
    
    unsubscribeApprovedUsers = window.fs.onSnapshot(q, (snapshot) => {
        const list = [];
        snapshot.forEach(doc => {
            list.push(doc.data());
        });
        
        // 정렬: 가나다 순
        list.sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
        
        approvedUsers = list;
        window.approvedUsers = list;
        console.log("실시간 승인 유저 로드 완료:", approvedUsers.length, "명");
        
        // 현재 열려있는 생성/수정 모달 드롭다운 갱신
        if (typeof window.populateAssigneeDropdowns === 'function') {
            const taskAssignee = document.getElementById('input-task-assignee')?.value || '';
            const subtaskAssignee = document.getElementById('input-subtask-assignee')?.value || '';
            window.populateAssigneeDropdowns(taskAssignee, subtaskAssignee);
        }
    }, (error) => {
        console.error("Approved users list snapshot failed:", error);
    });
}

// 4. 관리자 역할 설정/해제
async function setAdminRole(uid, makeAdmin) {
    if (!window.isFirebaseAvailable || !window.db) return;
    if (typeof window.isAdminUser === 'function' && !window.isAdminUser()) {
        alert('관리자만 권한을 설정할 수 있습니다.');
        return;
    }
    const usersCol = window.getUsersCollection();
    if (!usersCol) return;

    const confirmMsg = makeAdmin
        ? '이 사용자에게 관리자 권한을 부여하시겠습니까?\n(승인 관리 화면에 접근할 수 있게 됩니다)'
        : '이 사용자의 관리자 권한을 제거하시겠습니까?';
    if (!confirm(confirmMsg)) return;

    try {
        await window.fs.setDoc(window.fs.doc(usersCol, uid), { role: makeAdmin ? 'admin' : 'user' }, { merge: true });
        console.log(`역할 변경 완료: ${uid} → ${makeAdmin ? 'admin' : 'user'}`);
        // 실시간 리스너가 UI 자동 갱신
    } catch (e) {
        console.error('역할 변경 실패:', e);
        alert('권한 설정에 실패했습니다: ' + e.message);
    }
}



// 6. 어드민 패널 탭 스위칭 로직
function initAdminTabEvents() {
    const btnPending = document.getElementById('btn-admin-tab-pending');
    const btnAll = document.getElementById('btn-admin-tab-all');
    
    const panelPending = document.getElementById('admin-panel-pending');
    const panelAll = document.getElementById('admin-panel-all');
    
    if (btnPending && btnAll && panelPending && panelAll) {
        btnPending.addEventListener('click', () => {
            currentAdminTab = 'PENDING';
            btnPending.className = 'rounded-lg bg-white px-3 py-1 text-xs font-bold text-slate-800 shadow-sm transition';
            btnAll.className = 'rounded-lg px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition';
            panelPending.classList.remove('hidden');
            panelPending.classList.add('block');
            panelAll.classList.remove('block');
            panelAll.classList.add('hidden');
        });
        
        btnAll.addEventListener('click', () => {
            currentAdminTab = 'ALL';
            btnAll.className = 'rounded-lg bg-white px-3 py-1 text-xs font-bold text-slate-800 shadow-sm transition';
            btnPending.className = 'rounded-lg px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition';
            panelAll.classList.remove('hidden');
            panelAll.classList.add('block');
            panelPending.classList.remove('block');
            panelPending.classList.add('hidden');
        });
    }
}

// 초기화 바인딩
function initAdminModule() {
    initAdminTabEvents();
    
    // 승인 관리 탭 버튼 이벤트 연결
    document.getElementById('btn-view-admin')?.addEventListener('click', () => {
        if (typeof window.switchView === 'function') {
            window.switchView('ADMIN');
        }
    });
}

// 리스너 해제 함수
function stopAdminListeners() {
    if (unsubscribeAdminUsers) {
        try { unsubscribeAdminUsers(); } catch (e) { console.warn("unsubscribeAdminUsers failed:", e); }
        unsubscribeAdminUsers = null;
    }
    if (unsubscribeApprovedUsers) {
        try { unsubscribeApprovedUsers(); } catch (e) { console.warn("unsubscribeApprovedUsers failed:", e); }
        unsubscribeApprovedUsers = null;
    }
}

// 모듈 진입점 바인딩
window.listenUsersForAdmin = listenUsersForAdmin;
window.listenApprovedUsers = listenApprovedUsers;
window.stopAdminListeners = stopAdminListeners;
window.approveUser = approveUser;
window.rejectUser = rejectUser;
window.deleteUser = deleteUser;
window.editDisplayName = editDisplayName;
window.setAdminRole = setAdminRole;

// DOM 로딩 직후 또는 즉시 기동
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminModule);
} else {
    initAdminModule();
}
