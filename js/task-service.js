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
  if (canWriteToFirestore() && coll) {
    try { 
      await window.fs.setDoc(window.fs.doc(coll, id), payload, { merge: true }); 
      markSaved(); 
      await db_recordActivity(id, 'CREATE');
    }
    catch (e) { markSaveError(); console.warn('업무 추가 실패', e); showToast('Firebase 저장 실패', false); }
  }
  if (!tasks.some(t => t.id === id)) tasks.push({ id, ...payload });
  updateUI();
}
async function db_updateTask(id, taskData) {
  const originalTask = tasks.find(t => t.id === id) || {};
  if (!window.hasWritePermission(originalTask)) {
    showToast('수정 권한이 없습니다.', false);
    return;
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
  if (canWriteToFirestore() && coll) {
    try { 
      await window.fs.setDoc(window.fs.doc(coll, id), payload, { merge: true }); 
      markSaved(); 
      if (Object.keys(changes).length > 0) {
        await db_recordActivity(id, 'UPDATE', changes);
      }
    }
    catch (e) { 
      markSaveError(); 
      console.error('업무 수정 실패 상세 에러:', e); 
      showToast(`Firebase 수정 실패: ${e.message || e}`, false); 
    }
  }
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1) tasks[idx] = { ...tasks[idx], ...payload };
  updateUI();
}
async function db_deleteTask(id) {
  const originalTask = tasks.find(t => t.id === id);
  if (!window.hasWritePermission(originalTask)) {
    showToast('삭제 권한이 없습니다.', false);
    return;
  }
  const coll = getTasksCollection();
  const payload = { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() };
  if (canWriteToFirestore() && coll) {
    try { 
      await window.fs.setDoc(window.fs.doc(coll, id), payload, { merge: true }); 
      markSaved(); 
      await db_recordActivity(id, 'DELETE');
    }
    catch (e) { markSaveError(); console.warn('업무 삭제 실패', e); showToast('Firebase 삭제 실패', false); }
  }
  tasks = tasks.filter(t => t.id !== id);
  if (typeof selectedTaskIds !== 'undefined') selectedTaskIds.delete(id);
  updateUI();
}
async function db_batchDelete(idsSet) {
  const ids = Array.from(idsSet || []);
  const myIds = ids.filter(id => {
    const task = tasks.find(t => t.id === id);
    return window.hasWritePermission(task);
  });
  if (myIds.length === 0) {
    showToast('삭제 권한이 있는 업무가 없습니다.', false);
    return;
  }
  const coll = getTasksCollection();
  if (canWriteToFirestore() && coll) {
    try {
      const batch = window.fs.writeBatch(window.db);
      myIds.forEach(id => batch.set(window.fs.doc(coll, id), { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true }));
      await batch.commit();
      markSaved();
      for (const id of myIds) {
        await db_recordActivity(id, 'DELETE');
      }
    } catch (e) { markSaveError(); showToast('Firebase 일괄 삭제 실패', false); }
  }
  tasks = tasks.filter(t => !myIds.includes(t.id));
  if (idsSet && typeof idsSet.clear === 'function') {
    ids.forEach(id => idsSet.delete(id));
  }
  updateUI();
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
  if (canWriteToFirestore() && coll) {
    try { await window.fs.setDoc(window.fs.doc(coll, id), payload, { merge: true }); markSaved(); }
    catch (e) { console.warn('트래커 추가 실패', e); showToast('Firebase 트래커 저장 실패', false); }
  }
  if (!trackers.some(t => t.id === id)) trackers.push({ id, ...payload });
  currentTrackerId = id;
  localStorage.setItem('flow_current_tracker', id);
  updateTrackerUI();
  updateUI();
}
async function db_updateTracker(id, data) {
  const original = trackers.find(t => t.id === id);
  if (!window.hasTrackerWritePermission(original)) {
    showToast('트래커 수정 권한이 없습니다.', false);
    return;
  }
  const coll = getTrackersCollection();
  const payload = { ...data, order: original && typeof original.order === 'number' ? original.order : data.order, updatedAt: getServerTimestamp() };
  if (canWriteToFirestore() && coll) {
    try { await window.fs.setDoc(window.fs.doc(coll, id), payload, { merge: true }); markSaved(); }
    catch (e) { console.warn('트래커 수정 실패', e); showToast('Firebase 트래커 수정 실패', false); }
  }
  const idx = trackers.findIndex(t => t.id === id);
  if (idx !== -1) trackers[idx] = { ...trackers[idx], ...payload };
  updateTrackerUI();
  updateUI();
}
async function db_deleteTracker(id) {
  const original = trackers.find(t => t.id === id);
  if (!window.hasTrackerWritePermission(original)) {
    showToast('트래커 삭제 권한이 없습니다.', false);
    return;
  }
  const coll = getTrackersCollection();
  const tColl = getTasksCollection();
  if (canWriteToFirestore() && coll) {
    try {
      await window.fs.setDoc(window.fs.doc(coll, id), { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true });
      if (tColl) {
        const snap = await window.fs.getDocs(window.fs.query(tColl, window.fs.where('trackerId', "==", id)));
        const batch = window.fs.writeBatch(window.db);
        snap.docs.forEach(doc => batch.set(doc.ref, { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true }));
        if (!snap.empty) await batch.commit();
      }
      markSaved();
    } catch (e) { console.warn('트래커 삭제 실패', e); showToast('Firebase 트래커 삭제 실패', false); }
  }
  trackers = trackers.filter(t => t.id !== id);
  tasks = tasks.filter(t => t.trackerId !== id);
  if (!trackers.length) trackers.push({ id: 'tracker-default', name: '기본 업무 트래커', desc: '기본 설정된 초기 공간입니다.', order: 1 });
  currentTrackerId = trackers[0].id;
  localStorage.setItem('flow_current_tracker', currentTrackerId);
  updateTrackerUI();
  updateUI();
}
async function ensureDefaultTrackersInFirestore() {
  if (!isFirebaseAvailable || !db) return;
  const coll = getTrackersCollection(); if (!coll) return;
  try {
    for (let i = 0; i < trackers.length; i++) {
      const t = trackers[i]; if (!t || !t.id) continue;
      const snap = await window.fs.getDoc(window.fs.doc(coll, t.id));
      if (!snap.exists) await window.fs.setDoc(window.fs.doc(coll, t.id), { name: t.name, desc: t.desc || '', order: t.order || i + 1, deleted: false, createdAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true });
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
      window.fs.where('taskId', '==', taskId),
      window.fs.orderBy('timestamp', 'desc')
    );
    const snap = await window.fs.getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

async function db_addProgressNote(taskId, { title, body }) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll || !canWriteToFirestore()) return null;
  const id = 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const payload = {
    taskId,
    trackerId: currentTrackerId,
    title: title || '',
    body: body || '',
    createdBy: window.currentUser ? window.currentUser.uid : 'anonymous',
    createdByName: window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : 'anonymous',
    createdAt: getServerTimestamp(),
    updatedAt: getServerTimestamp()
  };
  try {
    await window.fs.setDoc(window.fs.doc(coll, id), payload);
    await db_recordActivity(taskId, 'NOTE_ADD', { title: title || '(제목 없음)' });
    return { id, ...payload };
  } catch (e) {
    console.warn('db_addProgressNote 실패:', e);
    return null;
  }
}

async function db_fetchProgressNotes(taskId) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll) return [];
  try {
    const q = window.fs.query(
      coll,
      window.fs.where('taskId', '==', taskId),
      window.fs.orderBy('createdAt', 'desc')
    );
    const snap = await window.fs.getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error('db_fetchProgressNotes 실패:', e);
    return [];
  }
}

async function db_updateProgressNote(noteId, { title, body }) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll || !canWriteToFirestore()) return;
  try {
    await window.fs.updateDoc(window.fs.doc(coll, noteId), {
      title: title || '',
      body: body || '',
      updatedAt: getServerTimestamp()
    });
  } catch (e) {
    console.warn('db_updateProgressNote 실패:', e);
  }
}

async function db_deleteProgressNote(noteId, taskId) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll || !canWriteToFirestore()) return;
  try {
    await window.fs.deleteDoc(window.fs.doc(coll, noteId));
    if (taskId) await db_recordActivity(taskId, 'NOTE_DELETE', null);
  } catch (e) {
    console.warn('db_deleteProgressNote 실패:', e);
  }
}

async function db_fetchTrackerProgressNotes(trackerId) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll) return [];
  try {
    const q = window.fs.query(
      coll,
      window.fs.where('trackerId', '==', trackerId),
      window.fs.orderBy('createdAt', 'desc')
    );
    const snap = await window.fs.getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
