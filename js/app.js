
console.info('Smart Task Flow app.js v20260625-subtask-3status-full loaded');

// --- Helper Functions ---
function getStatusKorean(status) {
    return { PENDING: '진행 대기', PROGRESS: '진행 중', COMPLETED: '완료됨', OVERDUE: '기한 초과' }[status] || '전체';
}
function getPriorityBadge(priority) {
    if (priority === 'HIGH') return '높음';
    if (priority === 'NORMAL') return '보통';
    return '낮음';
}
function getPriorityClass(priority) {
    if (priority === 'HIGH') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (priority === 'NORMAL') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}
function getStatusClass(status) {
    if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'PROGRESS') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
}
function getStatusIcon(status) {
    if (status === 'COMPLETED') return '✅';
    if (status === 'PROGRESS') return '⚙️';
    return '⌛';
}
function getTimelineStatus(dueStr, status) {
    if (status === 'COMPLETED') return { text: '완료됨', class: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    const today = getTodayStr();
    const due = dueStr || today;
    const diff = Math.ceil((new Date(String(due).replace(/-/g, '/')) - new Date(today.replace(/-/g, '/'))) / 86400000);
    if (diff < 0) return { text: `D+${Math.abs(diff)}`, class: 'bg-rose-50 text-rose-700 border-rose-100 font-semibold' };
    if (diff === 0) return { text: '오늘 마감', class: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold' };
    return { text: `D-${diff}`, class: 'bg-slate-100 text-slate-700 border-slate-200' };
}
function getAvatarStyle(name) {
    if (!name) return AVATAR_COLORS[0];
    let sum = 0;
    for (let i = 0; i < String(name).length; i++) sum += String(name).charCodeAt(i);
    return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}
function normalizeStatus(status) {
    return ['PENDING', 'PROGRESS', 'COMPLETED'].includes(status) ? status : 'PENDING';
}
function getSubTaskStatusSelect(parentId, subId, currentStatus, className = '') {
    const status = normalizeStatus(currentStatus);
    return `
        <select class="sel-subtask-status ${className || 'rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100'}"
                data-task-id="${escapeHTML(parentId)}"
                data-subtask-id="${escapeHTML(subId)}"
                title="하위 업무 상태 변경">
            <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>진행 대기</option>
            <option value="PROGRESS" ${status === 'PROGRESS' ? 'selected' : ''}>진행 중</option>
            <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>완료</option>
        </select>`;
}
function bindGanttTooltip(element, title, details) {
    const tooltip = document.getElementById('gantt-tooltip');
    if (!tooltip || !element) return;
    element.addEventListener('mouseenter', () => {
        tooltip.innerHTML = `<div class="font-bold mb-1">${escapeHTML(title || '')}</div><div>${String(details || '').replace(/<(?!br\s*\/?)\/?[^>]+>/gi, '')}</div>`;
        tooltip.classList.remove('hidden');
    });
    element.addEventListener('mousemove', e => {
        tooltip.style.left = e.clientX + 15 + 'px';
        tooltip.style.top = e.clientY + 15 + 'px';
    });
    element.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
}
function showToast(msg, isSuccess = true) {
    const t = document.getElementById('toast');
    const txt = document.getElementById('toast-text');
    const icon = document.getElementById('toast-icon');
    if (!t || !txt) { console.info(msg); return; }
    txt.textContent = msg;
    if (icon) icon.innerHTML = isSuccess ? '✅' : '⚠️';
    t.classList.remove('translate-y-10', 'opacity-0');
    t.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
        t.classList.remove('translate-y-0', 'opacity-100');
        t.classList.add('translate-y-10', 'opacity-0');
    }, 3000);
}
function getServerTimestamp() {
    return (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();
}
function canWriteToFirestore() {
    if (!isFirebaseAvailable || !db) return false;
    if (auth && !isAuthReady) {
        showToast('Firebase 인증 준비 중입니다. 잠시 후 다시 시도해 주세요.', false);
        return false;
    }
    return true;
}
function markSaving(){ lastSaveState = 'saving'; }
function markSaved(){ lastSaveState = 'saved'; }
function markSaveError(){ lastSaveState = 'error'; }

let pendingTrackerOrderSignature = null;
let isTrackerOrderSaving = false;
let draggedTrackerElement = null;
let trackerDragOrderChanged = false;

function getTrackerOrderSignature(list) { return (list || []).map(t => t && t.id).filter(Boolean).join('|'); }
function normalizeTrackerOrder(list) { return (list || []).map((t, i) => ({ ...t, order: i + 1 })); }
function sortTrackersByOrder(list) {
    return [...(list || [])].sort((a,b) => {
        const ao = typeof a.order === 'number' ? a.order : 999999;
        const bo = typeof b.order === 'number' ? b.order : 999999;
        if (ao !== bo) return ao - bo;
        return (a.name || '').localeCompare(b.name || '');
    });
}
async function saveTrackerOrder() {
    trackers = normalizeTrackerOrder(trackers).map(t => ({ ...t, updatedAt: getServerTimestamp() }));
    pendingTrackerOrderSignature = getTrackerOrderSignature(trackers);
    isTrackerOrderSaving = true;
    updateTrackerUI();
    const coll = getTrackersCollection();
    if (canWriteToFirestore() && coll) {
        try {
            const batch = db.batch();
            trackers.forEach((t, i) => batch.set(coll.doc(t.id), { order: i + 1, updatedAt: getServerTimestamp() }, { merge: true }));
            await batch.commit();
            markSaved();
            showToast('트래커 순서가 저장되었습니다.');
        } catch(e) {
            pendingTrackerOrderSignature = null;
            isTrackerOrderSaving = false;
            markSaveError();
            showToast('트래커 순서 저장 실패', false);
        }
    } else {
        pendingTrackerOrderSignature = null;
        isTrackerOrderSaving = false;
    }
}
async function moveTrackerOrder(id, direction) {
    trackers = sortTrackersByOrder(trackers);
    const idx = trackers.findIndex(t => t.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || targetIdx < 0 || targetIdx >= trackers.length) return;
    const moved = trackers.splice(idx, 1)[0];
    trackers.splice(targetIdx, 0, moved);
    trackers = normalizeTrackerOrder(trackers);
    updateTrackerUI();
    await saveTrackerOrder();
}
async function moveTaskOrder(id, direction) {
    const scopeTasks = tasks.filter(t => t.trackerId === currentTrackerId);
    scopeTasks.forEach((t, i) => { if (typeof t.order !== 'number') t.order = i + 1; });
    scopeTasks.sort((a,b) => a.order - b.order);
    const idx = scopeTasks.findIndex(t => t.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || targetIdx < 0 || targetIdx >= scopeTasks.length) return;
    const currentTask = scopeTasks[idx];
    const targetTask = scopeTasks[targetIdx];
    const temp = currentTask.order;
    currentTask.order = targetTask.order;
    targetTask.order = temp;
    updateUI();
    await db_updateTask(currentTask.id, { order: currentTask.order });
    await db_updateTask(targetTask.id, { order: targetTask.order });
}

// --- Firestore CRUD ---
async function db_addTask(taskData) {
    const coll = getTasksCollection();
    const newId = 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    const now = getServerTimestamp();
    const currentTracker = trackers.find(t => t.id === currentTrackerId);
    const payload = { ...taskData, trackerId: taskData.trackerId || currentTrackerId, trackerName: currentTracker ? currentTracker.name : '', deleted: false, createdAt: now, updatedAt: now };
    markSaving();
    if (canWriteToFirestore() && coll) {
        try { await coll.doc(newId).set(payload, { merge: true }); markSaved(); }
        catch(e) { markSaveError(); showToast('Firebase 저장 실패', false); }
    }
    if (!tasks.some(t => t.id === newId)) tasks.push({ id: newId, ...payload });
    updateUI();
}
async function db_updateTask(id, taskData) {
    const coll = getTasksCollection();
    const targetTrackerId = taskData.trackerId || currentTrackerId;
    const currentTracker = trackers.find(t => t.id === targetTrackerId);
    const payload = { ...taskData, trackerName: currentTracker ? currentTracker.name : taskData.trackerName, updatedAt: getServerTimestamp() };
    markSaving();
    if (canWriteToFirestore() && coll) {
        try { await coll.doc(id).set(payload, { merge: true }); markSaved(); }
        catch(e) { markSaveError(); showToast('Firebase 수정 실패', false); }
    }
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) tasks[idx] = { ...tasks[idx], ...payload };
    updateUI();
}
async function db_deleteTask(id) {
    const coll = getTasksCollection();
    const payload = { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() };
    markSaving();
    if (canWriteToFirestore() && coll) {
        try { await coll.doc(id).set(payload, { merge: true }); markSaved(); }
        catch(e) { markSaveError(); showToast('Firebase 삭제 반영 실패', false); }
    }
    tasks = tasks.filter(t => t.id !== id);
    selectedTaskIds.delete(id);
    updateUI();
}
async function db_batchDelete(idsSet) {
    const ids = Array.from(idsSet || []);
    const coll = getTasksCollection();
    if (canWriteToFirestore() && coll) {
        try {
            const batch = db.batch();
            ids.forEach(id => batch.set(coll.doc(id), { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true }));
            await batch.commit();
            markSaved();
        } catch(e) { markSaveError(); showToast('Firebase 일괄 삭제 반영 실패', false); }
    }
    tasks = tasks.filter(t => !ids.includes(t.id));
    idsSet.clear();
    updateUI();
}
async function db_addTracker(trackerData) {
    const coll = getTrackersCollection();
    const newId = 'tracker_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    const now = getServerTimestamp();
    const nextOrder = trackers.length ? Math.max(...trackers.map(t => typeof t.order === 'number' ? t.order : 0)) + 1 : 1;
    const payload = { ...trackerData, order: nextOrder, deleted: false, createdAt: now, updatedAt: now };
    if (canWriteToFirestore() && coll) {
        try { await coll.doc(newId).set(payload, { merge: true }); markSaved(); }
        catch(e) { markSaveError(); showToast('Firebase 트래커 저장 실패', false); }
    }
    if (!trackers.some(t => t.id === newId)) trackers.push({ id: newId, ...payload });
    currentTrackerId = newId;
    localStorage.setItem('flow_current_tracker', currentTrackerId);
    updateTrackerUI(); updateUI();
}
async function db_updateTracker(id, trackerData) {
    const coll = getTrackersCollection();
    const existing = trackers.find(t => t.id === id);
    const payload = { ...trackerData, order: existing && typeof existing.order === 'number' ? existing.order : trackerData.order, updatedAt: getServerTimestamp() };
    if (canWriteToFirestore() && coll) {
        try { await coll.doc(id).set(payload, { merge: true }); markSaved(); }
        catch(e) { markSaveError(); showToast('Firebase 트래커 수정 실패', false); }
    }
    const idx = trackers.findIndex(t => t.id === id);
    if (idx !== -1) trackers[idx] = { ...trackers[idx], ...payload };
    updateTrackerUI(); updateUI();
}
async function db_deleteTracker(id) {
    const coll = getTrackersCollection();
    const tColl = getTasksCollection();
    if (canWriteToFirestore() && coll) {
        try {
            await coll.doc(id).set({ deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true });
            if (tColl) {
                const snapshot = await tColl.where('trackerId', '==', id).get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.set(doc.ref, { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true }));
                if (!snapshot.empty) await batch.commit();
            }
            markSaved();
        } catch(e) { markSaveError(); showToast('Firebase 트래커 삭제 반영 실패', false); }
    }
    tasks = tasks.filter(t => t.trackerId !== id);
    trackers = trackers.filter(t => t.id !== id);
    if (!trackers.length) trackers.push({ id: 'tracker-default', name: '기본 업무 트래커', desc: '기본 설정된 초기 공간입니다.', order: 1 });
    currentTrackerId = trackers[0].id;
    localStorage.setItem('flow_current_tracker', currentTrackerId);
    updateTrackerUI(); updateUI();
}

// --- Rendering ---
function getFilteredTasks() {
    const search = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
    const status = document.getElementById('filter-status')?.value || 'ALL';
    const priority = document.getElementById('filter-priority')?.value || 'ALL';
    const assignee = document.getElementById('filter-assignee')?.value || 'ALL';
    const startDate = document.getElementById('filter-start-date')?.value || '';
    const endDate = document.getElementById('filter-end-date')?.value || '';
    const today = getTodayStr();
    return tasks.filter(t => {
        if ((t.deleted === true) || t.trackerId !== currentTrackerId) return false;
        if (search && !String(t.title || '').toLowerCase().includes(search) && !String(t.assignee || '').toLowerCase().includes(search)) return false;
        if (status === 'OVERDUE') {
            if (t.status === 'COMPLETED' || (t.dueDate || today) >= today) return false;
        } else if (status !== 'ALL' && t.status !== status) return false;
        if (priority !== 'ALL' && t.priority !== priority) return false;
        if (assignee !== 'ALL' && t.assignee !== assignee) return false;
        if (startDate && (t.dueDate || today) < startDate) return false;
        if (endDate && (t.startDate || today) > endDate) return false;
        return true;
    });
}
function buildAssigneeDropdownFilter() {
    const select = document.getElementById('filter-assignee');
    if (!select) return;
    const currentVal = select.value;
    const assignees = [...new Set(tasks.filter(t => t.trackerId === currentTrackerId && !t.deleted).map(t => t.assignee).filter(Boolean))];
    select.innerHTML = '<option value="ALL">담당자: 전체</option>';
    assignees.forEach(n => {
        const opt = document.createElement('option'); opt.value = n; opt.textContent = n; select.appendChild(opt);
    });
    if (assignees.includes(currentVal)) select.value = currentVal;
}
function updateTrackerUI() {
    const listContainer = document.getElementById('tracker-list-items');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    trackers = sortTrackersByOrder(trackers).map((t, i) => ({ ...t, order: typeof t.order === 'number' ? t.order : i + 1 }));
    const currentObj = trackers.find(t => t.id === currentTrackerId) || trackers[0];
    if (currentObj) {
        currentTrackerId = currentObj.id;
        const nameEl = document.getElementById('current-tracker-name');
        const descEl = document.getElementById('current-tracker-desc');
        if (nameEl) nameEl.textContent = currentObj.name || '기본 트래커';
        if (descEl) descEl.textContent = currentObj.desc || '실시간 업무 기한 관리 및 진척도 모니터링 시스템';
    }
    trackers.forEach((t) => {
        const row = document.createElement('div');
        row.className = `tracker-item group flex items-stretch gap-1 rounded-xl transition ${t.id === currentTrackerId ? 'bg-indigo-50 ring-1 ring-indigo-100' : 'hover:bg-slate-50'}`;
        row.dataset.id = t.id;
        row.innerHTML = `
            <button type="button" class="tracker-select flex-1 text-left px-3 py-2 rounded-xl">
                <div class="text-xs font-bold text-slate-800">${escapeHTML(t.name)}</div>
                <div class="text-[10px] text-slate-400 truncate">${escapeHTML(t.desc || '상세 설명 없음')}</div>
            </button>
            <div class="flex flex-col py-1 pr-1">
                <button type="button" class="btn-tracker-up text-[10px] text-slate-400 hover:text-indigo-600">▲</button>
                <button type="button" class="btn-tracker-down text-[10px] text-slate-400 hover:text-indigo-600">▼</button>
            </div>`;
        row.querySelector('.tracker-select').addEventListener('click', () => {
            currentTrackerId = t.id;
            localStorage.setItem('flow_current_tracker', currentTrackerId);
            document.getElementById('tracker-dropdown-menu')?.classList.add('hidden');
            updateTrackerUI(); updateUI(); showToast(`트래커 전환: ${t.name}`);
        });
        row.querySelector('.btn-tracker-up')?.addEventListener('click', async e => { e.stopPropagation(); await moveTrackerOrder(t.id, 'up'); });
        row.querySelector('.btn-tracker-down')?.addEventListener('click', async e => { e.stopPropagation(); await moveTrackerOrder(t.id, 'down'); });
        listContainer.appendChild(row);
    });
}
function renderStats() {
    const scope = tasks.filter(t => t.trackerId === currentTrackerId && !t.deleted);
    const total = scope.length;
    const pending = scope.filter(t => t.status === 'PENDING').length;
    const progress = scope.filter(t => t.status === 'PROGRESS').length;
    const completed = scope.filter(t => t.status === 'COMPLETED').length;
    const today = getTodayStr();
    const overdue = scope.filter(t => t.status !== 'COMPLETED' && (t.dueDate || '') < today).length;
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('stat-total', total); setText('stat-pending', pending); setText('stat-progress', progress); setText('stat-completed', completed); setText('stat-overdue', overdue);
    setText('stat-pending-pct', total ? `${Math.round(pending / total * 100)}%` : '0%');
    setText('stat-progress-pct', total ? `${Math.round(progress / total * 100)}%` : '0%');
    setText('stat-completed-pct', total ? `${Math.round(completed / total * 100)}%` : '0%');
    const overdueLbl = document.getElementById('stat-overdue-lbl');
    if (overdueLbl) { overdueLbl.textContent = overdue ? '조속히 조치 필요' : '매우 양호'; overdueLbl.className = `text-xs font-medium ${overdue ? 'text-rose-500 font-semibold' : 'text-emerald-500'}`; }
}
function renderTable(filtered) {
    const tbody = document.getElementById('task-table-body');
    const emptyState = document.getElementById('empty-state-table');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!filtered.length) {
        if (emptyState) emptyState.classList.replace('hidden', 'flex');
        updateSelectAllState(0, 0); return;
    }
    if (emptyState) emptyState.classList.replace('flex', 'hidden');
    filtered.sort((a,b) => (a.order ?? 999) - (b.order ?? 999) || String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
    let selectedCount = 0;
    filtered.forEach(t => {
        const subTasksList = Array.isArray(t.subTasks) ? t.subTasks : [];
        const hasSubTasks = subTasksList.length > 0;
        const isExpanded = expandedTaskIds.has(t.id);
        const doneSubs = subTasksList.filter(st => st.status === 'COMPLETED').length;
        const timeline = getTimelineStatus(t.dueDate || getTodayStr(), t.status);
        const checked = selectedTaskIds.has(t.id);
        if (checked) selectedCount += 1;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors group';
        tr.innerHTML = `
            <td class="px-2 py-4 text-center text-slate-400"><button type="button" class="btn-order-up block mx-auto" data-id="${t.id}">▲</button><button type="button" class="btn-order-down block mx-auto" data-id="${t.id}">▼</button></td>
            <td class="px-3 py-4 text-center"><input type="checkbox" class="cb-task rounded border-slate-300" data-id="${t.id}" ${checked ? 'checked' : ''}></td>
            <td class="px-6 py-4"><div class="flex items-center gap-2"><button type="button" class="btn-toggle-subtasks text-slate-400 ${hasSubTasks ? '' : 'invisible'}" data-id="${t.id}">${isExpanded ? '▼' : '▶'}</button><span class="font-bold text-slate-900">${escapeHTML(t.title)}</span>${hasSubTasks ? `<span class="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">하위 업무 ${doneSubs}/${subTasksList.length}</span>` : ''}</div><div class="pl-6 text-xs text-slate-400 mt-1">${escapeHTML(t.notes || '추가 지침 없음')}</div></td>
            <td class="px-6 py-4"><div class="inline-flex items-center gap-2"><span class="inline-flex h-8 w-8 items-center justify-center rounded-full ${getAvatarStyle(t.assignee)} text-xs font-bold">${escapeHTML((t.assignee || 'U').charAt(0))}</span><span class="font-semibold">${escapeHTML(t.assignee || '미지정')}</span></div></td>
            <td class="px-6 py-4"><div class="text-xs font-semibold text-slate-600">${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5)}</div><span class="mt-1 inline-flex rounded-lg border px-2 py-1 text-xs ${timeline.class}">${timeline.text}</span></td>
            <td class="px-4 py-4 text-center"><span class="rounded-lg border px-2 py-1 text-xs font-bold ${getPriorityClass(t.priority)}">${getPriorityBadge(t.priority)}</span></td>
            <td class="px-6 py-4 text-center"><select class="sel-status rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold" data-id="${t.id}"><option value="PENDING" ${t.status === 'PENDING' ? 'selected' : ''}>진행 대기 ⌛</option><option value="PROGRESS" ${t.status === 'PROGRESS' ? 'selected' : ''}>진행 중 ⚙️</option><option value="COMPLETED" ${t.status === 'COMPLETED' ? 'selected' : ''}>완료됨 ⭐️</option></select></td>
            <td class="px-6 py-4 text-center"><button type="button" class="btn-edit text-slate-400 hover:text-indigo-600 px-2" data-id="${t.id}">✎</button><button type="button" class="btn-delete text-slate-400 hover:text-rose-600 px-2" data-id="${t.id}">🗑</button></td>`;
        tbody.appendChild(tr);
        if (hasSubTasks && isExpanded) {
            subTasksList.forEach(st => {
                const subTr = document.createElement('tr');
                const stStatus = normalizeStatus(st.status);
                const subAssignee = st.assignee || t.assignee || '미지정';
                subTr.className = 'bg-slate-50/70 border-l-2 border-l-indigo-500/40 hover:bg-indigo-50/30 transition-colors text-xs';
                subTr.innerHTML = `
                    <td colspan="2"></td>
                    <td class="px-6 py-2 text-slate-600"><div class="flex items-center gap-2 pl-8"><span class="text-slate-300">└─</span><span class="font-semibold ${stStatus === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-700'}">${escapeHTML(st.title)}</span><span class="rounded border border-indigo-100 bg-indigo-50 px-1 py-0.5 text-[10px] font-bold text-indigo-700">👤 ${escapeHTML(subAssignee)}</span></div></td>
                    <td class="px-6 py-2 text-center text-slate-400">-</td>
                    <td class="px-6 py-2 text-slate-500">📅 ${st.startDate ? st.startDate.substring(5) : '미정'} ~ ${st.dueDate ? st.dueDate.substring(5) : '미정'}</td>
                    <td class="px-4 py-2 text-center text-slate-400">-</td>
                    <td class="px-6 py-2 text-center">${getSubTaskStatusSelect(t.id, st.id, stStatus)}</td>
                    <td class="px-6 py-2 text-center text-slate-300">-</td>`;
                tbody.appendChild(subTr);
            });
        }
    });
    updateSelectAllState(filtered.length, selectedCount);
}
function getDateRange(item, fallbackDate) {
    const startStr = item.startDate || item.dueDate || fallbackDate;
    const endStr = item.dueDate || item.startDate || fallbackDate;
    const start = new Date(String(startStr).replace(/-/g, '/'));
    const end = new Date(String(endStr).replace(/-/g, '/'));
    return { start, end };
}
function isRangeOverlappingMonth(item, monthStart, monthEnd, fallbackDate) {
    const { start, end } = getDateRange(item, fallbackDate);
    return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= monthEnd && end >= monthStart;
}
function getMonthlySubTasks(task, monthStart, monthEnd, todayStr) {
    const allSubTasks = Array.isArray(task.subTasks) ? task.subTasks : [];
    const visibleSubTasks = allSubTasks.filter(st => isRangeOverlappingMonth(st, monthStart, monthEnd, todayStr));
    return { allSubTasks, visibleSubTasks };
}
function buildMonthlySubTaskHTML(task, monthStart, monthEnd, todayStr) {
    const { allSubTasks, visibleSubTasks } = getMonthlySubTasks(task, monthStart, monthEnd, todayStr);
    if (!allSubTasks.length || !visibleSubTasks.length) return '';
    let html = '<div class="mt-2 space-y-1">';
    visibleSubTasks.forEach(st => {
        const status = normalizeStatus(st.status);
        html += `<div class="truncate text-[10px] ${status === 'COMPLETED' ? 'text-slate-400 line-through' : status === 'PROGRESS' ? 'text-blue-600' : 'text-slate-600'}">${getStatusIcon(status)} ${escapeHTML(st.title)} <span class="text-slate-400">${st.dueDate ? st.dueDate.substring(5) : ''}</span></div>`;
    });
    const hidden = allSubTasks.length - visibleSubTasks.length;
    if (hidden > 0) html += `<div class="text-[10px] text-slate-400">외 ${hidden}건 숨김</div>`;
    html += '</div>';
    return html;
}
function renderCalendar(filteredTasks) {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    const grid = document.getElementById('calendar-grid');
    const weekdayHeader = document.getElementById('calendar-weekday-header');
    const title = document.getElementById('calendar-month-year');
    const todayStr = getTodayStr();
    if (!grid) return;
    if (title) title.textContent = currentCalMode === 'MONTH' ? `${year}년 전체 Gantt 타임라인` : `${year}년 ${month + 1}월`;

    const taskGroups = filteredTasks.map(t => {
        const startDStr = t.startDate || t.dueDate || todayStr;
        const endDStr = t.dueDate || todayStr;
        const group = {
            id: t.id,
            title: t.title,
            startDate: startDStr > endDStr ? endDStr : startDStr,
            dueDate: endDStr,
            status: t.status,
            priority: t.priority,
            assignee: t.assignee || '미지정',
            notes: t.notes || '',
            order: t.order ?? 999,
            subTasks: (t.subTasks || []).map(st => {
                const stStart = st.startDate || st.dueDate || endDStr;
                const stDue = st.dueDate || endDStr;
                return { id: st.id, title: st.title, startDate: stStart > stDue ? stDue : stStart, dueDate: stDue, status: normalizeStatus(st.status), assignee: st.assignee || t.assignee || '미지정', parentId: t.id, parentTitle: t.title };
            })
        };
        let rangeStart = group.startDate, rangeEnd = group.dueDate;
        group.subTasks.forEach(st => { if (st.startDate < rangeStart) rangeStart = st.startDate; if (st.dueDate > rangeEnd) rangeEnd = st.dueDate; });
        group.rangeStart = rangeStart; group.rangeEnd = rangeEnd;
        return group;
    }).sort((a,b) => a.order - b.order || a.rangeStart.localeCompare(b.rangeStart));

    if (currentCalMode === 'DAY') {
        if (weekdayHeader) weekdayHeader.classList.remove('hidden');
        grid.className = 'grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-b-lg overflow-hidden relative z-10';
        grid.innerHTML = '';
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 0; i < firstDay; i++) grid.appendChild(Object.assign(document.createElement('div'), { className: 'bg-slate-50 min-h-[130px]' }));
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const cell = document.createElement('div');
            cell.className = `bg-white min-h-[130px] flex flex-col border-r border-b border-slate-100 ${dateStr === todayStr ? 'bg-indigo-50/20' : 'hover:bg-slate-50'}`;
            cell.innerHTML = `<div class="p-1.5 text-xs font-bold ${dateStr === todayStr ? 'text-indigo-700' : 'text-slate-600'}">${day}</div>`;
            const taskContainer = document.createElement('div');
            taskContainer.className = 'flex flex-col gap-1 px-1 pb-1';
            taskGroups.forEach(g => {
                if (dateStr >= g.startDate && dateStr <= g.dueDate) addCalendarPill(taskContainer, g, false);
                if (isCalSubTaskVisible) g.subTasks.forEach(st => { if (dateStr >= st.startDate && dateStr <= st.dueDate) addCalendarPill(taskContainer, st, true); });
            });
            cell.appendChild(taskContainer); grid.appendChild(cell);
        }
        const totalCells = firstDay + daysInMonth;
        for (let i = 0; i < (totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7)); i++) grid.appendChild(Object.assign(document.createElement('div'), { className: 'bg-slate-50 min-h-[130px]' }));
    } else if (currentCalMode === 'MONTH') {
        if (weekdayHeader) weekdayHeader.classList.add('hidden');
        grid.className = 'flex flex-col gap-2 bg-white border border-slate-200 rounded-xl p-4';
        grid.innerHTML = '';
        taskGroups.forEach(g => {
            const box = document.createElement('div');
            box.className = 'rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer hover:border-indigo-300';
            box.onclick = () => openTaskModal(g.id);
            const subs = isCalSubTaskVisible && g.subTasks.length ? `<div class="mt-2 pl-3 space-y-1">${g.subTasks.map(st => `<div class="text-xs ${st.status === 'COMPLETED' ? 'line-through text-slate-400' : st.status === 'PROGRESS' ? 'text-blue-700' : 'text-slate-600'}">${getStatusIcon(st.status)} ↳ ${escapeHTML(st.title)} (${st.startDate} ~ ${st.dueDate})</div>`).join('')}</div>` : '';
            box.innerHTML = `<div class="font-bold text-sm">${getStatusIcon(g.status)} ${escapeHTML(g.title)}</div><div class="text-xs text-slate-500 mt-1">${g.startDate} ~ ${g.dueDate} · ${escapeHTML(g.assignee)}</div>${subs}`;
            grid.appendChild(box);
        });
    } else {
        if (weekdayHeader) weekdayHeader.classList.add('hidden');
        grid.className = 'flex flex-col gap-4 bg-slate-50 border border-slate-100 p-5 rounded-xl min-h-[250px]';
        grid.innerHTML = '';
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
        const currentMonthTasks = filteredTasks.filter(t => isRangeOverlappingMonth(t, monthStart, monthEnd, todayStr));
        if (!currentMonthTasks.length) { grid.innerHTML = `<div class="text-sm text-slate-400">현재 조건 혹은 조회 기간 중 해당 월(${month + 1}월)의 업무 정보가 존재하지 않습니다.</div>`; return; }
        const groups = { OVERDUE: [], PROGRESS: [], PENDING: [], COMPLETED: [] };
        currentMonthTasks.forEach(t => { if (t.status !== 'COMPLETED' && (t.dueDate || '') < todayStr) groups.OVERDUE.push(t); else groups[t.status || 'PENDING'].push(t); });
        const monthlySubTotal = currentMonthTasks.reduce((sum, t) => sum + (Array.isArray(t.subTasks) ? t.subTasks.length : 0), 0);
        const monthlySubCompleted = currentMonthTasks.reduce((sum, t) => sum + ((t.subTasks || []).filter(st => st.status === 'COMPLETED').length), 0);
        const panel = document.createElement('div');
        panel.className = 'grid grid-cols-2 md:grid-cols-4 gap-3';
        panel.innerHTML = `<div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">월간 업무</div><div class="text-xl font-bold">${currentMonthTasks.length}</div></div><div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">완료</div><div class="text-xl font-bold">${groups.COMPLETED.length}</div></div><div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">지연</div><div class="text-xl font-bold text-rose-600">${groups.OVERDUE.length}</div></div><div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">하위 업무 완료</div><div class="text-xl font-bold">${monthlySubCompleted}/${monthlySubTotal}</div></div>`;
        grid.appendChild(panel);
        Object.entries({ OVERDUE: '🚨 일정 초과 및 지연 상태', PROGRESS: '⚙️ 현재 적극 진행 중', PENDING: '⌛ 대기 및 진행 준비 중', COMPLETED: '⭐️ 정상 완료 항목' }).forEach(([key, label]) => {
            if (!groups[key].length) return;
            const sec = document.createElement('div');
            sec.className = 'rounded-xl border bg-white p-4';
            sec.innerHTML = `<h4 class="font-bold mb-3">${label} <span class="text-xs text-slate-400">${groups[key].length}건</span></h4>`;
            const cards = document.createElement('div'); cards.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5';
            groups[key].forEach(t => {
                const card = document.createElement('div'); card.className = 'rounded-xl border border-slate-200 p-3 cursor-pointer hover:border-indigo-300'; card.onclick = () => openTaskModal(t.id);
                card.innerHTML = `<div class="font-bold text-sm">${escapeHTML(t.title)}</div><div class="text-xs text-slate-400 mt-1">🗓️ ${t.startDate || '미정'} ~ ${t.dueDate || '미정'} · ${escapeHTML(t.assignee || '미지정')}</div>${buildMonthlySubTaskHTML(t, monthStart, monthEnd, todayStr)}`;
                cards.appendChild(card);
            });
            sec.appendChild(cards); grid.appendChild(sec);
        });
    }
}
function addCalendarPill(container, item, isSub) {
    const status = normalizeStatus(item.status);
    const div = document.createElement('div');
    div.className = `truncate rounded px-1.5 py-1 text-[10px] font-semibold cursor-pointer ${isSub ? (status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border border-dashed border-emerald-300' : status === 'PROGRESS' ? 'bg-blue-50 text-blue-800 border border-dashed border-blue-300' : 'bg-slate-50 text-slate-700 border border-dashed border-slate-300') : (status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : status === 'PROGRESS' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700')}`;
    div.textContent = `${getStatusIcon(status)} ${isSub ? '↳ ' : ''}${item.title}`;
    div.onclick = () => openTaskModal(isSub ? item.parentId : item.id);
    bindGanttTooltip(div, item.title, `${isSub ? '하위 업무' : '본 업무'}<br>담당자: ${escapeHTML(item.assignee || '미지정')}<br>기간: ${item.startDate} ~ ${item.dueDate}<br>상태: ${getStatusKorean(status)}`);
    container.appendChild(div);
}
function renderActiveViews() {
    const filteredTasks = getFilteredTasks();
    const fStatus = document.getElementById('filter-status')?.value || 'ALL';
    document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('ring-2','ring-indigo-600','bg-indigo-50/10'));
    document.getElementById(`card-${fStatus}`)?.classList.add('ring-2','ring-indigo-600','bg-indigo-50/10');
    renderTable(filteredTasks);
    if (currentViewMode === 'CALENDAR') renderCalendar(filteredTasks);
}
function updateUI() { renderStats(); buildAssigneeDropdownFilter(); renderActiveViews(); updateUndoButton(); }

// --- Modal & Sub-task ---
function resetSubTaskButton() {
    const btn = document.getElementById('btn-add-subtask');
    if (!btn) return;
    btn.textContent = '추가';
    btn.className = 'rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition shrink-0 ml-auto';
}
function addSubTaskToModalList() {
    const titleInput = document.getElementById('input-subtask-title');
    const assigneeInput = document.getElementById('input-subtask-assignee');
    const startInput = document.getElementById('input-subtask-start');
    const dueInput = document.getElementById('input-subtask-due');
    const titleVal = (titleInput?.value || '').trim();
    if (!titleVal) return;
    const parentAssignee = (document.getElementById('input-task-assignee')?.value || '').trim();
    const finalAssignee = (assigneeInput?.value || '').trim() || parentAssignee || '미지정';
    const payload = { title: titleVal, assignee: finalAssignee, startDate: startInput?.value || getTodayStr(), dueDate: dueInput?.value || getTodayStr() };
    if (editingSubTaskIndex > -1 && currentSubTasks[editingSubTaskIndex]) {
        currentSubTasks[editingSubTaskIndex] = { ...currentSubTasks[editingSubTaskIndex], ...payload, status: normalizeStatus(currentSubTasks[editingSubTaskIndex].status) };
        editingSubTaskIndex = -1;
        resetSubTaskButton();
    } else {
        currentSubTasks.push({ id: 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2,7), status: 'PENDING', ...payload });
    }
    if (titleInput) titleInput.value = '';
    if (assigneeInput) assigneeInput.value = '';
    if (startInput) startInput.value = getTodayStr();
    if (dueInput) dueInput.value = getFutureDateStr(7);
    renderModalSubTasks();
}
function renderModalSubTasks() {
    const container = document.getElementById('subtask-list-container');
    if (!container) return;
    container.innerHTML = '';
    if (!currentSubTasks.length) {
        container.innerHTML = '<li class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400">등록된 하위 과제가 없습니다.</li>';
        return;
    }
    currentSubTasks.forEach((st, idx) => {
        const status = normalizeStatus(st.status);
        const li = document.createElement('li');
        li.className = 'flex flex-col gap-2 rounded-xl border border-slate-200/60 bg-slate-50 p-2 text-xs hover:bg-slate-100/50 sm:flex-row sm:items-center sm:justify-between';
        li.innerHTML = `
            <div class="flex min-w-0 flex-1 items-center gap-2">
                <span class="shrink-0 font-bold ${status === 'COMPLETED' ? 'text-emerald-600' : status === 'PROGRESS' ? 'text-blue-600' : 'text-amber-500'}">${getStatusIcon(status)} ${getStatusKorean(status).replace('됨','')}</span>
                <span class="min-w-0 truncate font-medium text-slate-700 ${status === 'COMPLETED' ? 'line-through opacity-50' : ''}">${escapeHTML(st.title)} <span class="text-[10px] text-slate-400 font-semibold">📅 ${st.startDate ? st.startDate.substring(5) : '미정'} ~ ${st.dueDate ? st.dueDate.substring(5) : '미정'}</span> <span class="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1 py-0.2 rounded text-[9px] font-bold">👤 ${escapeHTML(st.assignee || '미지정')}</span></span>
            </div>
            <div class="flex shrink-0 items-center justify-end gap-1.5">
                <select class="sel-modal-subtask-status rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100" onchange="updateSubTaskStatusInModal(${idx}, this.value)">
                    <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>진행 대기</option>
                    <option value="PROGRESS" ${status === 'PROGRESS' ? 'selected' : ''}>진행 중</option>
                    <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>완료</option>
                </select>
                <button type="button" class="px-1 font-bold text-indigo-600 hover:text-indigo-800" onclick="editSubTaskInModal(${idx})">수정</button>
                <span class="text-slate-300">|</span>
                <button type="button" class="px-1 font-semibold text-rose-500 hover:text-rose-700" onclick="removeSubTaskFromModal(${idx})">삭제</button>
            </div>`;
        container.appendChild(li);
    });
}
window.updateSubTaskStatusInModal = function(index, status) { if (!currentSubTasks[index]) return; currentSubTasks[index].status = normalizeStatus(status); renderModalSubTasks(); };
window.editSubTaskInModal = function(index) {
    const st = currentSubTasks[index]; if (!st) return;
    editingSubTaskIndex = index;
    document.getElementById('input-subtask-title').value = st.title || '';
    document.getElementById('input-subtask-assignee').value = st.assignee || '';
    document.getElementById('input-subtask-start').value = st.startDate || '';
    document.getElementById('input-subtask-due').value = st.dueDate || '';
    const btn = document.getElementById('btn-add-subtask');
    if (btn) { btn.textContent = '수정 완료'; btn.className = 'rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition shrink-0 ml-auto'; }
};
window.removeSubTaskFromModal = function(index) { currentSubTasks.splice(index, 1); if (editingSubTaskIndex === index) { editingSubTaskIndex = -1; resetSubTaskButton(); } renderModalSubTasks(); };
function openTaskModal(id = null) {
    document.getElementById('form-task')?.reset();
    ['input-subtask-title','input-subtask-assignee'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const st = document.getElementById('input-subtask-start'); if (st) st.value = getTodayStr();
    const sd = document.getElementById('input-subtask-due'); if (sd) sd.value = getFutureDateStr(7);
    editingSubTaskIndex = -1; resetSubTaskButton();
    const title = document.getElementById('modal-title');
    if (id) {
        const t = tasks.find(x => x.id === id); if (!t) return;
        if (title) title.textContent = '업무 상세 변경';
        document.getElementById('input-task-id').value = t.id;
        document.getElementById('input-task-title').value = t.title || '';
        document.getElementById('input-task-assignee').value = t.assignee || '';
        document.getElementById('input-task-start').value = t.startDate || '';
        document.getElementById('input-task-due').value = t.dueDate || '';
        document.getElementById('input-task-priority').value = t.priority || 'NORMAL';
        document.getElementById('input-task-status').value = t.status || 'PENDING';
        document.getElementById('input-task-notes').value = t.notes || '';
        const subAssignee = document.getElementById('input-subtask-assignee'); if (subAssignee) subAssignee.placeholder = `담당자 (기본: ${t.assignee || '본 업무 담당자'})`;
        currentSubTasks = Array.isArray(t.subTasks) ? JSON.parse(JSON.stringify(t.subTasks)).map(st => ({ ...st, status: normalizeStatus(st.status) })) : [];
    } else {
        if (title) title.textContent = '새로운 업무 배정';
        const idEl = document.getElementById('input-task-id'); if (idEl) idEl.value = '';
        document.getElementById('input-task-start').value = getTodayStr();
        document.getElementById('input-task-due').value = getFutureDateStr(7);
        const subAssignee = document.getElementById('input-subtask-assignee'); if (subAssignee) subAssignee.placeholder = '담당자 (선택)';
        currentSubTasks = [];
    }
    renderModalSubTasks();
    document.getElementById('modal-task')?.classList.remove('hidden');
}
function closeModal(){ document.getElementById('modal-task')?.classList.add('hidden'); }
function closeConfirmModal(){ document.getElementById('modal-confirm')?.classList.add('hidden'); confirmActionCb = null; }
function openTrackerModal(id = null) {
    document.getElementById('form-tracker')?.reset();
    const btnDelete = document.getElementById('btn-delete-tracker');
    if (id) {
        const t = trackers.find(x => x.id === id); if (!t) return;
        document.getElementById('modal-tracker-title').textContent = '트래커 정보 수정';
        document.getElementById('input-tracker-id').value = t.id;
        document.getElementById('input-tracker-name').value = t.name || '';
        document.getElementById('input-tracker-desc').value = t.desc || '';
        btnDelete?.classList.remove('hidden');
    } else {
        document.getElementById('modal-tracker-title').textContent = '새 트래커 스페이스 추가';
        document.getElementById('input-tracker-id').value = '';
        btnDelete?.classList.add('hidden');
    }
    document.getElementById('tracker-dropdown-menu')?.classList.add('hidden');
    document.getElementById('modal-tracker')?.classList.remove('hidden');
}
function closeTrackerModal(){ document.getElementById('modal-tracker')?.classList.add('hidden'); }

// --- Handlers ---
async function handleTrackerSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('input-tracker-id').value;
    const data = { name: document.getElementById('input-tracker-name').value.trim(), desc: document.getElementById('input-tracker-desc').value.trim() };
    if (id) { await db_updateTracker(id, data); showToast('트래커가 수정되었습니다.'); }
    else { await db_addTracker(data); showToast('새 트래커 공간이 생성되었습니다.'); }
    closeTrackerModal();
}
async function handleTaskSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('input-task-id').value;
    const start = document.getElementById('input-task-start').value;
    const due = document.getElementById('input-task-due').value;
    if (start && due && start > due) return showToast('시작일은 마감일보다 늦을 수 없습니다.', false);
    let assignedOrder = 1;
    if (!id) {
        const scope = tasks.filter(t => t.trackerId === currentTrackerId);
        if (scope.length) assignedOrder = Math.max(...scope.map(x => x.order ?? 0)) + 1;
    }
    const data = {
        trackerId: currentTrackerId,
        title: document.getElementById('input-task-title').value.trim(),
        assignee: document.getElementById('input-task-assignee').value.trim(),
        startDate: start,
        dueDate: due,
        priority: document.getElementById('input-task-priority').value,
        status: document.getElementById('input-task-status').value,
        notes: document.getElementById('input-task-notes').value.trim(),
        subTasks: currentSubTasks.map(st => ({ ...st, status: normalizeStatus(st.status) }))
    };
    if (!id) data.order = assignedOrder;
    try { if (id) { await db_updateTask(id, data); showToast('수정되었습니다.'); } else { await db_addTask(data); showToast('추가되었습니다.'); } closeModal(); }
    catch(e2) { showToast('저장 실패', false); }
}
async function updateTaskStatus(id, status) { await db_updateTask(id, { status }); showToast(`상태 변경: ${getStatusKorean(status)}`); }
async function updateSubTaskStatus(parentId, subId, status) {
    const parent = tasks.find(t => t.id === parentId);
    if (!parent || !Array.isArray(parent.subTasks)) return;
    const updated = parent.subTasks.map(st => st.id === subId ? { ...st, status: normalizeStatus(status) } : st);
    await db_updateTask(parentId, { subTasks: updated });
    showToast(`하위 업무 상태 변경: ${getStatusKorean(status)}`);
}
function confirmDelete(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    document.getElementById('confirm-title').textContent = '업무 삭제 알림';
    document.getElementById('confirm-message').innerHTML = `'${escapeHTML(t.title)}' 업무를 삭제하시겠습니까?`;
    confirmActionCb = async () => { await db_deleteTask(id); deletionHistory.push({ timestamp: Date.now(), items: [t] }); closeConfirmModal(); showToast('삭제되었습니다.'); };
    document.getElementById('modal-confirm')?.classList.remove('hidden');
}
function confirmBatchDelete() {
    if (!selectedTaskIds.size) return;
    document.getElementById('confirm-title').textContent = '선택한 업무 일괄 삭제';
    document.getElementById('confirm-message').innerHTML = `선택된 ${selectedTaskIds.size}개의 업무를 삭제하시겠습니까?`;
    confirmActionCb = async () => {
        const deleted = [];
        selectedTaskIds.forEach(id => { const t = tasks.find(x => x.id === id); if (t) deleted.push(t); });
        await db_batchDelete(selectedTaskIds); deletionHistory.push({ timestamp: Date.now(), items: deleted }); closeConfirmModal(); showToast(`${deleted.length}개 삭제됨.`);
    };
    document.getElementById('modal-confirm')?.classList.remove('hidden');
}
async function undoDelete() {
    if (!deletionHistory.length) return;
    const last = deletionHistory.pop();
    const coll = getTasksCollection();
    if (canWriteToFirestore() && coll) {
        try {
            const batch = db.batch();
            last.items.forEach(t => { const { id, ...data } = t; batch.set(coll.doc(id), { ...data, deleted: false, deletedAt: null, updatedAt: getServerTimestamp() }, { merge: true }); });
            await batch.commit();
        } catch(e) { showToast('Firebase 복원 반영 실패', false); }
    }
    last.items.forEach(t => { if (!tasks.some(x => x.id === t.id)) tasks.push({ ...t, deleted: false, deletedAt: null }); });
    showToast(`${last.items.length}개 복원됨.`); updateUI();
}
function handleTableClick(e) {
    const editBtn = e.target.closest('.btn-edit');
    const delBtn = e.target.closest('.btn-delete');
    const toggleSubBtn = e.target.closest('.btn-toggle-subtasks');
    const orderUpBtn = e.target.closest('.btn-order-up');
    const orderDownBtn = e.target.closest('.btn-order-down');
    if (editBtn) openTaskModal(editBtn.dataset.id);
    if (delBtn) confirmDelete(delBtn.dataset.id);
    if (toggleSubBtn) { const id = toggleSubBtn.dataset.id; expandedTaskIds.has(id) ? expandedTaskIds.delete(id) : expandedTaskIds.add(id); renderActiveViews(); }
    if (orderUpBtn) moveTaskOrder(orderUpBtn.dataset.id, 'up');
    if (orderDownBtn) moveTaskOrder(orderDownBtn.dataset.id, 'down');
}
function handleTableChange(e) {
    const sel = e.target.closest('.sel-status');
    const selSub = e.target.closest('.sel-subtask-status');
    const cb = e.target.closest('.cb-task');
    if (sel) updateTaskStatus(sel.dataset.id, sel.value);
    if (selSub) updateSubTaskStatus(selSub.dataset.taskId, selSub.dataset.subtaskId, selSub.value);
    if (cb) { cb.checked ? selectedTaskIds.add(cb.dataset.id) : selectedTaskIds.delete(cb.dataset.id); renderActiveViews(); updateBatchButton(); }
}
function toggleSelectAll(e) { document.querySelectorAll('.cb-task').forEach(cb => e.target.checked ? selectedTaskIds.add(cb.dataset.id) : selectedTaskIds.delete(cb.dataset.id)); renderActiveViews(); updateBatchButton(); }
function updateSelectAllState(totalVis, totalSel) {
    const cbAll = document.getElementById('checkbox-select-all'); if (!cbAll) return;
    cbAll.disabled = totalVis === 0; cbAll.checked = totalVis > 0 && totalVis === totalSel; cbAll.indeterminate = totalSel > 0 && totalSel < totalVis;
    updateBatchButton();
}
function updateBatchButton() { const btn = document.getElementById('btn-batch-delete'); if (btn) selectedTaskIds.size ? btn.classList.remove('hidden') : btn.classList.add('hidden'); }
function updateUndoButton() { const btn = document.getElementById('btn-undo'); if (btn) deletionHistory.length ? btn.classList.remove('hidden') : btn.classList.add('hidden'); }
function resetFilters() { ['filter-search','filter-start-date','filter-end-date'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); ['filter-status','filter-priority','filter-assignee'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 'ALL'; }); renderActiveViews(); }
function handleDeleteTrackerClick() {
    const id = document.getElementById('input-tracker-id').value; if (!id) return;
    const t = trackers.find(x => x.id === id); if (!t) return;
    closeTrackerModal();
    document.getElementById('confirm-title').textContent = '트래커 완전 삭제';
    document.getElementById('confirm-message').innerHTML = `정말 '${escapeHTML(t.name)}' 트래커를 삭제하시겠습니까?<br>* 이 트래커 소속의 모든 업무 데이터가 함께 삭제됩니다.`;
    confirmActionCb = async () => { await db_deleteTracker(id); closeConfirmModal(); showToast('트래커 및 소속 데이터가 제거되었습니다.'); };
    document.getElementById('modal-confirm')?.classList.remove('hidden');
}
function exportToJSON() {
    const active = tasks.filter(t => t.trackerId === currentTrackerId);
    const link = document.createElement('a');
    link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(active, null, 4));
    link.download = `backup_${getTodayStr()}.json`; link.click();
}
function exportToCSV() {
    const active = tasks.filter(t => t.trackerId === currentTrackerId);
    let csv = '\uFEFF업무명,담당자,시작일,마감일,우선순위,상태,세부메모\n';
    active.forEach(t => { csv += `"${(t.title||'').replace(/"/g,'""')}","${(t.assignee||'').replace(/"/g,'""')}","${t.startDate||''}","${t.dueDate||''}","${getPriorityBadge(t.priority)}","${getStatusKorean(t.status)}","${(t.notes||'').replace(/"/g,'""')}"\n`; });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `export_${getTodayStr()}.csv`; link.click(); URL.revokeObjectURL(url);
}
async function importFromJSON(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
        try {
            const imp = JSON.parse(ev.target.result);
            if (!Array.isArray(imp)) throw new Error('배열 아님');
            for (const t of imp) await db_addTask({ ...t, trackerId: currentTrackerId });
            showToast('성공적으로 불러왔습니다.');
        } catch(err) { showToast('읽기 오류 발생', false); }
    };
    reader.readAsText(file); e.target.value = '';
}
function setCalMode(mode) {
    currentCalMode = mode;
    ['day','month','summary'].forEach(m => {
        const btn = document.getElementById(`btn-cal-mode-${m}`); if (!btn) return;
        btn.className = m.toUpperCase() === mode ? 'rounded-lg bg-white px-3.5 py-1.5 text-slate-800 shadow-sm transition' : 'rounded-lg px-3.5 py-1.5 text-slate-500 hover:text-slate-800 transition';
    });
    const toggleWrapper = document.getElementById('toggle-subtask-cal-wrapper');
    if (toggleWrapper) { if (mode === 'DAY' || mode === 'MONTH') { toggleWrapper.classList.remove('hidden'); toggleWrapper.classList.add('inline-flex'); } else { toggleWrapper.classList.add('hidden'); toggleWrapper.classList.remove('inline-flex'); }}
    renderActiveViews();
}

// --- Initialization ---
async function ensureDefaultTrackersInFirestore() {
    if (!isFirebaseAvailable || !db) return;
    const coll = getTrackersCollection(); if (!coll) return;
    try {
        for (let i = 0; i < trackers.length; i++) {
            const t = trackers[i]; if (!t || !t.id) continue;
            const snap = await coll.doc(t.id).get();
            if (!snap.exists) await coll.doc(t.id).set({ name: t.name, desc: t.desc || '', order: t.order || i+1, deleted: false, createdAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true });
        }
    } catch(e) { console.warn('기본 트래커 보정 실패', e); }
}
function setupRealtimeListeners() {
    if (!isFirebaseAvailable || !db) return false;
    const trackersColl = getTrackersCollection(); const tasksColl = getTasksCollection();
    if (!trackersColl || !tasksColl) return false;
    if (typeof unsubscribeTrackers === 'function') unsubscribeTrackers();
    if (typeof unsubscribeTasks === 'function') unsubscribeTasks();
    unsubscribeTrackers = trackersColl.onSnapshot(snapshot => {
        const incoming = sortTrackersByOrder(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(t => t.deleted !== true));
        const sig = getTrackerOrderSignature(incoming);
        if (isTrackerOrderSaving && pendingTrackerOrderSignature && sig !== pendingTrackerOrderSignature) return;
        if (pendingTrackerOrderSignature && sig === pendingTrackerOrderSignature) { pendingTrackerOrderSignature = null; isTrackerOrderSaving = false; }
        trackers = incoming.length ? incoming : trackers;
        const saved = localStorage.getItem('flow_current_tracker');
        if (saved && trackers.some(t => t.id === saved)) currentTrackerId = saved;
        else if (!trackers.some(t => t.id === currentTrackerId) && trackers[0]) currentTrackerId = trackers[0].id;
        updateTrackerUI(); updateUI();
    }, err => { console.error('트래커 동기화 오류', err); showToast('트래커 실시간 동기화 오류', false); });
    unsubscribeTasks = tasksColl.onSnapshot(snapshot => {
        tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(t => t.deleted !== true);
        updateTrackerUI(); updateUI();
    }, err => { console.error('업무 동기화 오류', err); showToast('업무 실시간 동기화 오류', false); });
    return true;
}
async function fetchInitialData(){ await ensureDefaultTrackersInFirestore(); if (!setupRealtimeListeners()) updateUI(); }

document.addEventListener('DOMContentLoaded', () => {
    if (isFirebaseAvailable && auth) {
        const initAuth = async () => {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await auth.signInWithCustomToken(__initial_auth_token);
            else await auth.signInAnonymously();
        };
        initAuth().then(() => auth.onAuthStateChanged(user => { isAuthReady = !!user; if (user) fetchInitialData(); })).catch(e => { console.error('Auth initialization failed', e); updateUI(); });
    } else updateUI();
    const savedTracker = localStorage.getItem('flow_current_tracker');
    if (savedTracker && trackers.some(t => t.id === savedTracker)) currentTrackerId = savedTracker;
    updateTrackerUI();

    document.getElementById('btn-add-task')?.addEventListener('click', () => openTaskModal());
    document.getElementById('btn-export-csv')?.addEventListener('click', exportToCSV);
    document.getElementById('btn-export-json')?.addEventListener('click', exportToJSON);
    document.getElementById('btn-undo')?.addEventListener('click', undoDelete);
    document.getElementById('btn-batch-delete')?.addEventListener('click', confirmBatchDelete);
    document.getElementById('btn-import-trigger')?.addEventListener('click', () => document.getElementById('input-import-json')?.click());
    document.getElementById('input-import-json')?.addEventListener('change', importFromJSON);
    document.getElementById('btn-tracker-dropdown')?.addEventListener('click', e => { e.stopPropagation(); document.getElementById('tracker-dropdown-menu')?.classList.toggle('hidden'); });
    document.addEventListener('click', e => { if (!e.target.closest('#tracker-dropdown-container')) document.getElementById('tracker-dropdown-menu')?.classList.add('hidden'); });
    document.getElementById('btn-create-tracker-open')?.addEventListener('click', () => openTrackerModal());
    document.getElementById('btn-edit-tracker-open')?.addEventListener('click', () => openTrackerModal(currentTrackerId));
    document.querySelectorAll('.filter-card').forEach(card => card.addEventListener('click', () => { const status = card.getAttribute('data-status'); const el = document.getElementById('filter-status'); if (el) el.value = status; renderActiveViews(); }));
    ['filter-search','filter-start-date','filter-end-date'].forEach(id => document.getElementById(id)?.addEventListener('input', renderActiveViews));
    ['filter-status','filter-priority','filter-assignee'].forEach(id => document.getElementById(id)?.addEventListener('change', renderActiveViews));
    document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
    document.getElementById('checkbox-select-all')?.addEventListener('change', toggleSelectAll);
    document.getElementById('task-table-body')?.addEventListener('click', handleTableClick);
    document.getElementById('task-table-body')?.addEventListener('change', handleTableChange);
    document.getElementById('btn-view-table')?.addEventListener('click', () => { currentViewMode = 'TABLE'; document.getElementById('btn-view-table').className = 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition'; document.getElementById('btn-view-calendar').className = 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition'; document.getElementById('view-table')?.classList.remove('hidden'); document.getElementById('view-calendar')?.classList.add('hidden'); renderActiveViews(); });
    document.getElementById('btn-view-calendar')?.addEventListener('click', () => { currentViewMode = 'CALENDAR'; document.getElementById('btn-view-calendar').className = 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition'; document.getElementById('btn-view-table').className = 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition'; document.getElementById('view-table')?.classList.add('hidden'); document.getElementById('view-calendar')?.classList.remove('hidden'); renderActiveViews(); });
    document.getElementById('btn-cal-mode-day')?.addEventListener('click', () => setCalMode('DAY'));
    document.getElementById('btn-cal-mode-month')?.addEventListener('click', () => setCalMode('MONTH'));
    document.getElementById('btn-cal-mode-summary')?.addEventListener('click', () => setCalMode('SUMMARY'));
    document.getElementById('cb-show-subtasks-cal')?.addEventListener('change', e => { isCalSubTaskVisible = e.target.checked; renderActiveViews(); });
    document.getElementById('btn-prev-month')?.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() - 1); renderActiveViews(); });
    document.getElementById('btn-today-month')?.addEventListener('click', () => { currentCalDate = new Date(); renderActiveViews(); });
    document.getElementById('btn-next-month')?.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() + 1); renderActiveViews(); });
    document.getElementById('btn-close-task-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-task')?.addEventListener('click', closeModal);
    document.getElementById('form-task')?.addEventListener('submit', handleTaskSubmit);
    document.getElementById('btn-add-subtask')?.addEventListener('click', addSubTaskToModalList);
    document.getElementById('btn-close-tracker-modal')?.addEventListener('click', closeTrackerModal);
    document.getElementById('btn-cancel-tracker')?.addEventListener('click', closeTrackerModal);
    document.getElementById('form-tracker')?.addEventListener('submit', handleTrackerSubmit);
    document.getElementById('btn-delete-tracker')?.addEventListener('click', handleDeleteTrackerClick);
    document.getElementById('btn-cancel-confirm')?.addEventListener('click', closeConfirmModal);
    document.getElementById('btn-action-confirm')?.addEventListener('click', () => { if (confirmActionCb) confirmActionCb(); });
    window.addEventListener('beforeunload', () => { if (typeof unsubscribeTasks === 'function') unsubscribeTasks(); if (typeof unsubscribeTrackers === 'function') unsubscribeTrackers(); });
});
