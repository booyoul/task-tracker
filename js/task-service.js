console.info('Smart Task Flow task-service.js v20260701-v2 loaded');
// Task / tracker CRUD and Firebase realtime listener helpers.
async function db_addTask(taskData) {
  const coll = getTasksCollection();
  const id = 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const tracker = trackers.find(t => t.id === currentTrackerId);
  const payload = normalizeTaskForSchema({
    ...taskData,
    trackerId: taskData.trackerId || currentTrackerId,
    trackerName: tracker ? tracker.name : '',
    deleted: false,
    createdAt: getServerTimestamp(),
    updatedAt: getServerTimestamp(),
    createdBy: window.currentUser ? window.currentUser.uid : 'anonymous',
    createdByName: window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : 'anonymous',
    ownerId: window.currentUser ? window.currentUser.uid : 'anonymous'
  });
  console.info('db_addTask - 생성할 payload:', payload);
  markSaving();
  if (!coll || !canWriteToFirestore()) {
    markSaveError();
    return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  }
  try {
    await window.fs.setDoc(window.fs.doc(coll, id), payload, { merge: true });
    markSaved();
    await db_recordActivity(id, 'CREATE');
  } catch (e) {
    markSaveError();
    console.warn('업무 추가 실패', e);
    showToast('Firebase 저장 실패', false);
    return { success: false, error: e.message || String(e) };
  }
  if (!tasks.some(t => t.id === id)) tasks.push({ id, ...payload });
  updateUI();
  return { success: true, id, task: { id, ...payload } };
}
async function db_updateTask(id, taskData) {
  const originalTask = tasks.find(t => t.id === id) || {};
  if (!window.hasWritePermission(originalTask)) {
    showToast('수정 권한이 없습니다.', false);
    return { success: false, error: '수정 권한이 없습니다.' };
  }
  
  // Calculate field changes
  const changes = {};
  const fields = ['title', 'status', 'priority', 'assignee', 'startDate', 'dueDate', 'notes'];
  fields.forEach(f => {
    const oldVal = originalTask[f];
    const newVal = taskData[f];
    if (newVal !== undefined && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[f] = { old: oldVal || '', new: newVal || '' };
    }
  });

  const coll = getTasksCollection();
  const tracker = trackers.find(t => t.id === (taskData.trackerId || currentTrackerId));
  const payload = normalizeTaskForSchema({ ...originalTask, ...taskData, trackerName: tracker ? tracker.name : taskData.trackerName, updatedAt: getServerTimestamp() });
  markSaving();
  if (!coll || !canWriteToFirestore()) {
    markSaveError();
    return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  }
  try {
    await window.fs.setDoc(window.fs.doc(coll, id), payload, { merge: true });
    markSaved();
    if (Object.keys(changes).length > 0) {
      await db_recordActivity(id, 'UPDATE', changes);
    }
  } catch (e) {
    markSaveError();
    console.error('업무 수정 실패 상세 에러:', e);
    showToast(`Firebase 수정 실패: ${e.message || e}`, false);
    return { success: false, error: e.message || String(e) };
  }
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1) tasks[idx] = { ...tasks[idx], ...payload };
  updateUI();
  return { success: true, id, task: idx !== -1 ? tasks[idx] : { id, ...payload } };
}
async function db_deleteTask(id) {
  const originalTask = tasks.find(t => t.id === id);
  if (!window.hasWritePermission(originalTask)) {
    showToast('삭제 권한이 없습니다.', false);
    return { success: false, error: '삭제 권한이 없습니다.' };
  }
  const coll = getTasksCollection();
  const payload = { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() };
  markSaving();
  if (!coll || !canWriteToFirestore()) {
    markSaveError();
    return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  }
  try {
    await window.fs.setDoc(window.fs.doc(coll, id), payload, { merge: true });
    markSaved();
    await db_recordActivity(id, 'DELETE');
  } catch (e) {
    markSaveError();
    console.warn('업무 삭제 실패', e);
    showToast('Firebase 삭제 실패', false);
    return { success: false, error: e.message || String(e) };
  }
  tasks = tasks.filter(t => t.id !== id);
  if (typeof selectedTaskIds !== 'undefined') selectedTaskIds.delete(id);
  updateUI();
  return { success: true, id, task: originalTask };
}
async function db_batchDelete(idsSet) {
  const ids = Array.from(idsSet || []);
  const myIds = ids.filter(id => {
    const task = tasks.find(t => t.id === id);
    return window.hasWritePermission(task);
  });
  if (myIds.length === 0) {
    showToast('삭제 권한이 있는 업무가 없습니다.', false);
    return { success: false, error: '삭제 권한이 있는 업무가 없습니다.', deletedIds: [] };
  }
  const coll = getTasksCollection();
  markSaving();
  if (!coll || !canWriteToFirestore()) {
    markSaveError();
    return { success: false, error: '인증 실패 또는 DB 접근 불가', deletedIds: [] };
  }
  try {
    const batch = window.fs.writeBatch(window.db);
    myIds.forEach(id => batch.set(window.fs.doc(coll, id), { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true }));
    await batch.commit();
    markSaved();
    for (const id of myIds) {
      await db_recordActivity(id, 'DELETE');
    }
  } catch (e) {
    markSaveError();
    console.warn('업무 일괄 삭제 실패', e);
    showToast('Firebase 일괄 삭제 실패', false);
    return { success: false, error: e.message || String(e), deletedIds: [] };
  }
  tasks = tasks.filter(t => !myIds.includes(t.id));
  if (idsSet && typeof idsSet.clear === 'function') {
    ids.forEach(id => idsSet.delete(id));
  }
  updateUI();
  return { success: true, deletedIds: myIds };
}
async function db_updateTaskOrders(orderUpdates) {
  const updates = Array.isArray(orderUpdates) ? orderUpdates : [];
  if (!updates.length) return { success: true, updatedIds: [] };
  const invalid = updates.find(update => {
    const task = tasks.find(t => t.id === update.id);
    return !task || !window.hasWritePermission(task);
  });
  if (invalid) {
    showToast('업무 순서 변경 권한이 없습니다.', false);
    return { success: false, error: '업무 순서 변경 권한이 없습니다.', updatedIds: [] };
  }
  const coll = getTasksCollection();
  markSaving();
  if (!coll || !canWriteToFirestore()) {
    markSaveError();
    return { success: false, error: '인증 실패 또는 DB 접근 불가', updatedIds: [] };
  }
  try {
    const batch = window.fs.writeBatch(window.db);
    updates.forEach(update => batch.set(window.fs.doc(coll, update.id), {
      order: update.order,
      updatedAt: getServerTimestamp()
    }, { merge: true }));
    await batch.commit();
    markSaved();
  } catch (e) {
    markSaveError();
    console.warn('업무 순서 저장 실패', e);
    showToast('업무 순서 저장 실패', false);
    return { success: false, error: e.message || String(e), updatedIds: [] };
  }
  updates.forEach(update => {
    const idx = tasks.findIndex(t => t.id === update.id);
    if (idx !== -1) tasks[idx] = { ...tasks[idx], order: update.order };
  });
  updateUI();
  return { success: true, updatedIds: updates.map(update => update.id) };
}
async function db_addTracker(data) {
  const coll = getTrackersCollection();
  const id = 'tracker_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const nextOrder = trackers.length ? Math.max(...trackers.map(t => typeof t.order === 'number' ? t.order : 0)) + 1 : 1;
  const payload = {
    ...data,
    kpiTitle: data.kpiTitle || '업무 완료율',
    kpiTarget: typeof data.kpiTarget === 'number' ? data.kpiTarget : (typeof data.targetKpi === 'number' ? data.targetKpi : 80),
    kpiUnit: data.kpiUnit || '%',
    kpiType: data.kpiType || 'AUTO_DONE_PCT',
    kpiCurrent: typeof data.kpiCurrent === 'number' ? data.kpiCurrent : 0,
    order: nextOrder,
    deleted: false,
    createdAt: getServerTimestamp(),
    updatedAt: getServerTimestamp(),
    createdBy: window.currentUser ? window.currentUser.uid : 'anonymous',
    createdByName: window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : 'anonymous',
    ownerId: window.currentUser ? window.currentUser.uid : 'anonymous'
  };
  markSaving();
  if (!coll || !canWriteToFirestore()) {
    markSaveError();
    return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  }
  try {
    await window.fs.setDoc(window.fs.doc(coll, id), payload, { merge: true });
    markSaved();
  } catch (e) {
    markSaveError();
    console.warn('트래커 추가 실패', e);
    showToast('Firebase 트래커 저장 실패', false);
    return { success: false, error: e.message || String(e) };
  }
  if (!trackers.some(t => t.id === id)) trackers.push({ id, ...payload });
  currentTrackerId = id;
  localStorage.setItem('flow_current_tracker', id);
  updateTrackerUI();
  updateUI();
  return { success: true, id, tracker: { id, ...payload } };
}
async function db_updateTracker(id, data) {
  const original = trackers.find(t => t.id === id);
  if (!window.hasTrackerWritePermission(original)) {
    showToast('트래커 수정 권한이 없습니다.', false);
    return { success: false, error: '트래커 수정 권한이 없습니다.' };
  }
  const coll = getTrackersCollection();
  const payload = { ...data, order: original && typeof original.order === 'number' ? original.order : data.order, updatedAt: getServerTimestamp() };
  markSaving();
  if (!coll || !canWriteToFirestore()) {
    markSaveError();
    return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  }
  try {
    await window.fs.setDoc(window.fs.doc(coll, id), payload, { merge: true });
    markSaved();
  } catch (e) {
    markSaveError();
    console.warn('트래커 수정 실패', e);
    showToast('Firebase 트래커 수정 실패', false);
    return { success: false, error: e.message || String(e) };
  }
  const idx = trackers.findIndex(t => t.id === id);
  if (idx !== -1) trackers[idx] = { ...trackers[idx], ...payload };
  updateTrackerUI();
  updateUI();
  return { success: true, id, tracker: idx !== -1 ? trackers[idx] : { id, ...payload } };
}
async function db_deleteTracker(id) {
  const original = trackers.find(t => t.id === id);
  if (!window.hasTrackerWritePermission(original)) {
    showToast('트래커 삭제 권한이 없습니다.', false);
    return { success: false, error: '트래커 삭제 권한이 없습니다.' };
  }
  const coll = getTrackersCollection();
  const tColl = getTasksCollection();
  markSaving();
  if (!coll || !canWriteToFirestore()) {
    markSaveError();
    return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  }
  try {
    const snap = tColl
      ? await window.fs.getDocs(window.fs.query(tColl, window.fs.where('trackerId', "==", id)))
      : { docs: [], empty: true };
    if (snap.docs.length > 499) throw new Error('소속 업무가 499개를 초과하여 한 번에 삭제할 수 없습니다.');
    const batch = window.fs.writeBatch(window.db);
    batch.set(window.fs.doc(coll, id), { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true });
    if (tColl) {
      snap.docs.forEach(doc => batch.set(doc.ref, { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true }));
    }
    await batch.commit();
    markSaved();
  } catch (e) {
    markSaveError();
    console.warn('트래커 삭제 실패', e);
    showToast('Firebase 트래커 삭제 실패', false);
    return { success: false, error: e.message || String(e) };
  }
  trackers = trackers.filter(t => t.id !== id);
  tasks = tasks.filter(t => t.trackerId !== id);
  if (!trackers.length) trackers.push({ id: 'tracker-default', name: '기본 업무 트래커', desc: '기본 설정된 초기 공간입니다.', order: 1 });
  currentTrackerId = trackers[0].id;
  localStorage.setItem('flow_current_tracker', currentTrackerId);
  updateTrackerUI();
  updateUI();
  return { success: true, id, tracker: original };
}
async function ensureDefaultTrackersInFirestore() {
  if (!isFirebaseAvailable || !db) return;
  const coll = getTrackersCollection(); if (!coll) return;
  try {
    for (let i = 0; i < trackers.length; i++) {
      const t = trackers[i]; if (!t || !t.id) continue;
      const snap = await window.fs.getDoc(window.fs.doc(coll, t.id));
      if (!snap.exists) await window.fs.setDoc(window.fs.doc(coll, t.id), { name: t.name, desc: t.desc || '', order: t.order || i + 1, deleted: false, createdAt: getServerTimestamp(), updatedAt: getServerTimestamp(), createdBy: window.currentUser.uid, ownerId: window.currentUser.uid }, { merge: true });
    }
  } catch (e) { console.warn('기본 트래커 보정 실패', e); }
}
function setupRealtimeListeners() {
  if (!isFirebaseAvailable || !db) return false;
  const trackerColl = getTrackersCollection();
  const taskColl = getTasksCollection();
  if (!trackerColl || !taskColl) return false;
  if (typeof unsubscribeTrackers === 'function') unsubscribeTrackers();
  if (typeof unsubscribeTasks === 'function') unsubscribeTasks();
  unsubscribeTrackers = window.fs.onSnapshot(trackerColl, snapshot => {
    const incoming = sortTrackersByOrder(snapshot.docs.map(doc => {
      const d = doc.data();
      const targetVal = typeof d.kpiTarget === 'number' ? d.kpiTarget : (typeof d.targetKpi === 'number' ? d.targetKpi : 80);
      return { 
        id: doc.id, 
        kpiTitle: d.kpiTitle || '업무 완료율',
        kpiTarget: targetVal,
        kpiUnit: d.kpiUnit || '%',
        kpiType: d.kpiType || 'AUTO_DONE_PCT',
        kpiCurrent: typeof d.kpiCurrent === 'number' ? d.kpiCurrent : 0,
        ...d 
      };
    }).filter(t => t.deleted !== true));
    if (incoming.length) trackers = incoming;
    const saved = localStorage.getItem('flow_current_tracker');
    if (saved && trackers.some(t => t.id === saved)) currentTrackerId = saved;
    else if (!trackers.some(t => t.id === currentTrackerId) && trackers[0]) currentTrackerId = trackers[0].id;
    updateTrackerUI();
    updateUI();
  }, err => { console.error('트래커 동기화 오류', err); showToast('트래커 실시간 동기화 오류', false); });
  unsubscribeTasks = window.fs.onSnapshot(taskColl, snapshot => {
    tasks = snapshot.docs.map(doc => normalizeTaskForSchema({ id: doc.id, ...doc.data() })).filter(t => t.deleted !== true);
    updateTrackerUI();
    updateUI();
    migrateExistingTasksToCurrentSchema(tasks);
  }, err => { console.error('업무 동기화 오류', err); showToast('업무 실시간 동기화 오류', false); });
  return true;
}
async function fetchInitialData() { await ensureDefaultTrackersInFirestore(); if (!setupRealtimeListeners()) updateUI(); }

// 새 함수: 실시간 리스너 해제
function stopRealtimeListeners() {
  if (typeof unsubscribeTrackers === 'function') {
    try { unsubscribeTrackers(); } catch (e) { console.warn('unsubscribeTrackers error', e); }
    unsubscribeTrackers = null;
  }
  if (typeof unsubscribeTasks === 'function') {
    try { unsubscribeTasks(); } catch (e) { console.warn('unsubscribeTasks error', e); }
    unsubscribeTasks = null;
  }
}

// 변경 이력(Activity Log) 기록 헬퍼 함수
async function db_recordActivity(taskId, action, changes = null) {
  const coll = window.getActivityLogsCollection?.();
  if (!coll || !canWriteToFirestore()) return;
  const id = 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const payload = {
    taskId,
    trackerId: currentTrackerId,
    action,
    changedBy: window.currentUser ? window.currentUser.uid : 'anonymous',
    changedByName: window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : 'anonymous',
    timestamp: getServerTimestamp(),
    changes: changes
  };
  try {
    await window.fs.setDoc(window.fs.doc(coll, id), payload);
    console.info('db_recordActivity 성공:', payload);
  } catch (e) {
    console.warn('db_recordActivity 실패:', e);
  }
}

// 특정 태스크 ID의 변경 이력(Activity Logs) 가져오기
async function db_fetchActivityLogs(taskId) {
  const coll = window.getActivityLogsCollection?.();
  if (!coll || !canWriteToFirestore()) return [];
  try {
    const q = window.fs.query(
      coll,
      window.fs.where('taskId', '==', taskId)
    );
    const snap = await window.fs.getDocs(q);
    const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logs.sort((a, b) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime();
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
    return logs;
  } catch (e) {
    console.error('db_fetchActivityLogs 실패:', e);
    return [];
  }
}

// 전역으로 노출
window.stopRealtimeListeners = stopRealtimeListeners;
window.db_recordActivity = db_recordActivity;
window.db_fetchActivityLogs = db_fetchActivityLogs;

// ──────────────────────────────────────────────────────
// 진행 메모(Progress Notes) CRUD
// ──────────────────────────────────────────────────────

async function db_addProgressNote(taskId, { title, body, noteDate }) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll || !canWriteToFirestore()) return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  const id = 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const payload = {
    taskId,
    trackerId: currentTrackerId,
    title: title || '',
    body: body || '',
    noteDate: noteDate || '',
    createdBy: window.currentUser ? window.currentUser.uid : 'anonymous',
    createdByName: window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : 'anonymous',
    createdAt: getServerTimestamp(),
    updatedAt: getServerTimestamp()
  };
  try {
    await window.fs.setDoc(window.fs.doc(coll, id), payload);
    await db_recordActivity(taskId, 'NOTE_ADD', { title: title || '(제목 없음)' });
    return { success: true, note: { id, ...payload } };
  } catch (e) {
    console.warn('db_addProgressNote 실패:', e);
    return { success: false, error: e.message || String(e) };
  }
}

async function db_fetchProgressNotes(taskId) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll) return [];
  try {
    let q;
    if (taskId.includes('__sub_')) {
      q = window.fs.query(
        coll,
        window.fs.where('taskId', '==', taskId)
      );
    } else {
      q = window.fs.query(
        coll,
        window.fs.where('taskId', '>=', taskId),
        window.fs.where('taskId', '<=', taskId + '\uf8ff')
      );
    }
    const snap = await window.fs.getDocs(q);
    const notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notes.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    return notes;
  } catch (e) {
    console.error('db_fetchProgressNotes 실패:', e);
    return [];
  }
}

async function db_updateProgressNote(noteId, { title, body, noteDate }) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll || !canWriteToFirestore()) return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  try {
    await window.fs.updateDoc(window.fs.doc(coll, noteId), {
      title: title || '',
      body: body || '',
      noteDate: noteDate || '',
      updatedAt: getServerTimestamp()
    });
    return { success: true };
  } catch (e) {
    console.warn('db_updateProgressNote 실패:', e);
    return { success: false, error: e.message || String(e) };
  }
}

async function db_deleteProgressNote(noteId, taskId) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll || !canWriteToFirestore()) return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  try {
    await window.fs.deleteDoc(window.fs.doc(coll, noteId));
    if (taskId) await db_recordActivity(taskId, 'NOTE_DELETE', null);
    return { success: true };
  } catch (e) {
    console.warn('db_deleteProgressNote 실패:', e);
    return { success: false, error: e.message || String(e) };
  }
}

async function db_fetchTrackerProgressNotes(trackerId) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll) return [];
  try {
    const q = window.fs.query(
      coll,
      window.fs.where('trackerId', '==', trackerId)
    );
    const snap = await window.fs.getDocs(q);
    const notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notes.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
    return notes;
  } catch (e) {
    console.error('db_fetchTrackerProgressNotes 실패:', e);
    return [];
  }
}

window.db_addProgressNote    = db_addProgressNote;
window.db_fetchProgressNotes = db_fetchProgressNotes;
window.db_updateProgressNote = db_updateProgressNote;
window.db_deleteProgressNote = db_deleteProgressNote;
window.db_fetchTrackerProgressNotes = db_fetchTrackerProgressNotes;
