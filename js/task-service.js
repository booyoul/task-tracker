console.info('Smart Task Flow task-service.js v20260724-v2 loaded');
// Task / tracker CRUD and Firebase realtime listener helpers.
let taskSnapshotsByTracker = new Map();
async function db_addTask(taskData) {
  const coll = getTasksCollection();
  const id = 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const targetTrackerId = taskData.trackerId || currentTrackerId;
  const tracker = trackers.find(t => t.id === targetTrackerId);
  if (!window.hasTaskPermission?.(tracker, 'create')) {
    showToast('이 트래커에 업무를 등록할 권한이 없습니다.', false);
    return { success: false, error: '업무 등록 권한이 없습니다.' };
  }
  const payload = normalizeTaskForSchema({
    ...taskData,
    trackerId: targetTrackerId,
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
  if (!window.hasTaskPermission?.(originalTask, 'update')) {
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
  if (!window.hasTaskPermission?.(originalTask, 'delete')) {
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
    return window.hasTaskPermission?.(task, 'delete');
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
    return !task || !window.hasTaskPermission?.(task, 'update');
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
async function db_restoreTasks(items) {
  const restoreItems = Array.isArray(items) ? items : [];
  if (!restoreItems.length) return { success: true, restoredIds: [] };
  const invalid = restoreItems.find(task => !task?.id || !window.hasTaskPermission?.(task, 'delete'));
  if (invalid) {
    showToast('업무 복원 권한이 없습니다.', false);
    return { success: false, error: '업무 복원 권한이 없습니다.', restoredIds: [] };
  }
  const coll = getTasksCollection();
  markSaving();
  if (!coll || !canWriteToFirestore()) {
    markSaveError();
    return { success: false, error: '인증 실패 또는 DB 접근 불가', restoredIds: [] };
  }
  try {
    const batch = window.fs.writeBatch(window.db);
    restoreItems.forEach(task => {
      const { id, ...data } = task;
      batch.set(window.fs.doc(coll, id), {
        ...data,
        deleted: false,
        deletedAt: null,
        updatedAt: getServerTimestamp()
      }, { merge: true });
    });
    await batch.commit();
    markSaved();
  } catch (e) {
    markSaveError();
    console.warn('Firebase 복원 실패', e);
    showToast('Firebase 복원 실패', false);
    return { success: false, error: e.message || String(e), restoredIds: [] };
  }
  return { success: true, restoredIds: restoreItems.map(task => task.id) };
}
async function db_updateTrackerOrders(orderUpdates) {
  const updates = Array.isArray(orderUpdates) ? orderUpdates : [];
  if (!updates.length) return { success: true, updatedIds: [] };
  const invalid = updates.find(update => {
    const tracker = trackers.find(item => item.id === update.id);
    return !tracker || !window.hasTrackerWritePermission?.(tracker);
  });
  if (invalid) {
    showToast('트래커 순서 변경 권한이 없습니다.', false);
    return { success: false, error: '트래커 순서 변경 권한이 없습니다.', updatedIds: [] };
  }
  const coll = getTrackersCollection();
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
    console.warn('트래커 순서 저장 실패', e);
    showToast('트래커 순서 저장 실패', false);
    return { success: false, error: e.message || String(e), updatedIds: [] };
  }
  return { success: true, updatedIds: updates.map(update => update.id) };
}
async function db_addTracker(data) {
  const coll = getTrackersCollection();
  const id = 'tracker_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const nextOrder = trackers.length ? Math.max(...trackers.map(t => typeof t.order === 'number' ? t.order : 0)) + 1 : 1;
  const ownerId = window.currentUser ? window.currentUser.uid : 'anonymous';
  const ownerPermissions = { view: true, create: true, update: true, delete: true };
  const payload = {
    ...data,
    accessControl: { ...(data.accessControl || {}), [ownerId]: ownerPermissions },
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
    ownerId
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

function cloneSubTasksForTrackerCopy(subTasks, copyToken, taskIndex) {
  return (Array.isArray(subTasks) ? subTasks : []).map((subTask, subTaskIndex) => {
    const copy = {
      id: `sub_${copyToken}_${taskIndex}_${subTaskIndex}`,
      title: subTask.title || '',
      assignee: Array.isArray(subTask.assignee) ? [...subTask.assignee] : subTask.assignee,
      startDate: subTask.startDate || '',
      dueDate: subTask.dueDate || '',
      status: subTask.status,
    };
    if (subTask.recurrence) copy.recurrence = JSON.parse(JSON.stringify(subTask.recurrence));
    if (subTask.recurrenceCompletions) copy.recurrenceCompletions = { ...subTask.recurrenceCompletions };
    return copy;
  });
}

async function db_duplicateTracker(sourceTrackerId, data = {}) {
  const sourceTracker = trackers.find(tracker => tracker.id === sourceTrackerId);
  if (!sourceTracker || window.hasTaskPermission?.(sourceTracker, 'view') !== true) {
    showToast('복사할 트래커의 조회 권한이 없습니다.', false);
    return { success: false, error: '트래커 조회 권한이 없습니다.' };
  }

  const trackerColl = getTrackersCollection();
  const taskColl = getTasksCollection();
  const sourceTasks = tasks.filter(task => task.trackerId === sourceTrackerId && task.deleted !== true);
  if (sourceTasks.length > 499) {
    showToast('활성 태스크가 499개를 초과하여 한 번에 복사할 수 없습니다.', false);
    return { success: false, error: '복사 가능한 태스크 수를 초과했습니다.' };
  }
  if (!trackerColl || !taskColl || !canWriteToFirestore()) {
    markSaveError();
    return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  }

  const copyToken = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const trackerId = `tracker_${copyToken}`;
  const ownerId = window.currentUser ? window.currentUser.uid : 'anonymous';
  const ownerName = window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : 'anonymous';
  const ownerPermissions = { view: true, create: true, update: true, delete: true };
  const nextOrder = trackers.length ? Math.max(...trackers.map(tracker => typeof tracker.order === 'number' ? tracker.order : 0)) + 1 : 1;
  const trackerPayload = {
    name: String(data.name || `${sourceTracker.name || '트래커'} - 복사본`).trim(),
    desc: String(data.desc ?? sourceTracker.desc ?? '').trim(),
    accessControl: { [ownerId]: ownerPermissions },
    kpiTitle: sourceTracker.kpiTitle || '업무 완료율',
    kpiTarget: typeof sourceTracker.kpiTarget === 'number' ? sourceTracker.kpiTarget : 80,
    kpiUnit: sourceTracker.kpiUnit || '%',
    kpiType: sourceTracker.kpiType || 'AUTO_DONE_PCT',
    kpiCurrent: typeof sourceTracker.kpiCurrent === 'number' ? sourceTracker.kpiCurrent : 0,
    ...(Array.isArray(sourceTracker.noteTypeOptions)
      ? { noteTypeOptions: sourceTracker.noteTypeOptions.map(option => ({ ...option })) }
      : {}),
    order: nextOrder,
    deleted: false,
    createdAt: getServerTimestamp(),
    updatedAt: getServerTimestamp(),
    createdBy: ownerId,
    createdByName: ownerName,
    ownerId,
  };
  const copiedTasks = sourceTasks.map((sourceTask, taskIndex) => {
    const taskId = `task_${copyToken}_${taskIndex}`;
    const payload = normalizeTaskForSchema({
      title: sourceTask.title,
      assignee: Array.isArray(sourceTask.assignee) ? [...sourceTask.assignee] : sourceTask.assignee,
      startDate: sourceTask.startDate,
      dueDate: sourceTask.dueDate,
      priority: sourceTask.priority,
      status: sourceTask.status,
      industry: sourceTask.industry,
      taskType: sourceTask.taskType,
      notes: '',
      order: sourceTask.order,
      subTasks: cloneSubTasksForTrackerCopy(sourceTask.subTasks, copyToken, taskIndex),
      trackerId,
      trackerName: trackerPayload.name,
      deleted: false,
      createdAt: getServerTimestamp(),
      updatedAt: getServerTimestamp(),
      createdBy: ownerId,
      createdByName: ownerName,
      ownerId,
    });
    return { id: taskId, ...payload };
  });

  markSaving();
  try {
    const batch = window.fs.writeBatch(window.db);
    batch.set(window.fs.doc(trackerColl, trackerId), trackerPayload);
    copiedTasks.forEach(task => {
      const { id, ...payload } = task;
      batch.set(window.fs.doc(taskColl, id), payload);
    });
    await batch.commit();
    markSaved();
  } catch (e) {
    markSaveError();
    console.warn('트래커 복사 실패', e);
    showToast('Firebase 트래커 복사 실패', false);
    return { success: false, error: e.message || String(e) };
  }

  if (!trackers.some(tracker => tracker.id === trackerId)) {
    trackers.push({ id: trackerId, ...trackerPayload });
  }
  copiedTasks.forEach(task => {
    if (!tasks.some(item => item.id === task.id)) tasks.push(task);
  });
  currentTrackerId = trackerId;
  localStorage.setItem('flow_current_tracker', trackerId);
  updateTrackerUI();
  updateUI();
  return {
    success: true,
    id: trackerId,
    tracker: { id: trackerId, ...trackerPayload },
    tasks: copiedTasks,
    taskCount: copiedTasks.length,
  };
}
async function db_updateTracker(id, data) {
  const original = trackers.find(t => t.id === id);
  if (!window.hasTrackerWritePermission(original)) {
    showToast('트래커 수정 권한이 없습니다.', false);
    return { success: false, error: '트래커 수정 권한이 없습니다.' };
  }
  const coll = getTrackersCollection();
  const ownerId = original?.ownerId || original?.createdBy;
  const ownerPermissions = { view: true, create: true, update: true, delete: true };
  const payload = {
    ...data,
    accessControl: data.accessControl ? { ...data.accessControl, ...(ownerId ? { [ownerId]: ownerPermissions } : {}) } : original?.accessControl,
    order: original && typeof original.order === 'number' ? original.order : data.order,
    updatedAt: getServerTimestamp()
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
    }).filter(t => t.deleted !== true && window.canAccessTracker?.(t) === true));
    trackers = incoming;
    const saved = localStorage.getItem('flow_current_tracker');
    if (saved && trackers.some(t => t.id === saved)) currentTrackerId = saved;
    else if (!trackers.some(t => t.id === currentTrackerId) && trackers[0]) currentTrackerId = trackers[0].id;
    else if (!trackers.length) currentTrackerId = '';
    setupAccessibleTaskListeners(taskColl, trackers);
    updateTrackerUI();
    updateUI();
  }, err => { console.error('트래커 동기화 오류', err); showToast('트래커 실시간 동기화 오류', false); });
  return true;
}

function setupAccessibleTaskListeners(taskColl, accessibleTrackers) {
  if (typeof unsubscribeTasks === 'function') unsubscribeTasks();
  taskSnapshotsByTracker = new Map();
  const unsubscribers = [];
  const refreshTasks = () => {
    tasks = [...taskSnapshotsByTracker.values()].flat();
    updateTrackerUI();
    updateUI();
    migrateExistingTasksToCurrentSchema(tasks);
  };

  (accessibleTrackers || []).forEach(tracker => {
    const q = window.fs.query(taskColl, window.fs.where('trackerId', '==', tracker.id));
    const unsubscribe = window.fs.onSnapshot(q, snapshot => {
      const scopedTasks = snapshot.docs
        .map(doc => normalizeTaskForSchema({ id: doc.id, ...doc.data() }))
        .filter(task => task.deleted !== true && window.hasTaskPermission?.(task, 'view') === true);
      taskSnapshotsByTracker.set(tracker.id, scopedTasks);
      refreshTasks();
    }, err => {
      console.error(`업무 동기화 오류 (${tracker.id})`, err);
      showToast(`'${tracker.name || tracker.id}' 업무 동기화 권한을 확인해 주세요.`, false);
    });
    unsubscribers.push(unsubscribe);
  });

  unsubscribeTasks = () => {
    unsubscribers.forEach(unsubscribe => {
      try { unsubscribe(); } catch (e) { console.warn('unsubscribe task scope error', e); }
    });
    taskSnapshotsByTracker.clear();
  };
  if (!unsubscribers.length) refreshTasks();
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
    const q = window.fs.query(coll, window.fs.where('trackerId', '==', currentTrackerId));
    const snap = await window.fs.getDocs(q);
    const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(log => log.taskId === taskId);
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

async function db_addProgressNote(taskId, {
  title,
  body,
  bodyHtml,
  noteDate,
  customerName,
  oppNo,
  workType,
  workTypeLabel
}) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll || !canWriteToFirestore()) return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  const task = tasks.find(item => item.id === taskId.split('__sub_')[0]);
  if (!window.hasTaskPermission?.(task, 'update')) return { success: false, error: '메모 등록 권한이 없습니다.' };
  const id = 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const payload = {
    taskId,
    trackerId: currentTrackerId,
    title: title || '',
    body: body || '',
    bodyHtml: bodyHtml || '',
    noteDate: noteDate || '',
    customerName: customerName || '',
    oppNo: oppNo || '',
    workType: workType || '',
    workTypeLabel: workTypeLabel || '',
    reviewComments: [],
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
    const q = window.fs.query(coll, window.fs.where('trackerId', '==', currentTrackerId));
    const snap = await window.fs.getDocs(q);
    const notes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(note => {
      if (taskId.includes('__sub_')) return note.taskId === taskId;
      return note.taskId === taskId || note.taskId?.startsWith(`${taskId}__sub_`);
    });
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

async function db_updateProgressNote(noteId, {
  title,
  body,
  bodyHtml,
  noteDate,
  customerName,
  oppNo,
  workType,
  workTypeLabel,
  taskId
}) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll || !canWriteToFirestore()) return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  const task = tasks.find(item => item.id === String(taskId || '').split('__sub_')[0]);
  if (!window.hasTaskPermission?.(task || null, 'update')) return { success: false, error: '메모 수정 권한이 없습니다.' };
  try {
    await window.fs.updateDoc(window.fs.doc(coll, noteId), {
      title: title || '',
      body: body || '',
      bodyHtml: bodyHtml || '',
      noteDate: noteDate || '',
      customerName: customerName || '',
      oppNo: oppNo || '',
      workType: workType || '',
      workTypeLabel: workTypeLabel || '',
      updatedAt: getServerTimestamp()
    });
    return { success: true };
  } catch (e) {
    console.warn('db_updateProgressNote 실패:', e);
    return { success: false, error: e.message || String(e) };
  }
}

async function db_addProgressNoteComment(noteId, taskId, body) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll || !canWriteToFirestore()) return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  const task = tasks.find(item => item.id === String(taskId || '').split('__sub_')[0]);
  if (!window.hasTaskPermission?.(task || null, 'update')) return { success: false, error: '리뷰 코멘트 등록 권한이 없습니다.' };
  const comment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    body: String(body || '').trim().slice(0, 500),
    createdBy: window.currentUser ? window.currentUser.uid : 'anonymous',
    createdByName: window.currentUser ? (window.currentUser.displayName || window.currentUser.email) : 'anonymous',
    createdAt: new Date().toISOString()
  };
  if (!comment.body) return { success: false, error: '리뷰 코멘트를 입력해 주세요.' };
  try {
    await window.fs.updateDoc(window.fs.doc(coll, noteId), {
      reviewComments: window.fs.arrayUnion(comment),
      updatedAt: getServerTimestamp()
    });
    return { success: true, comment };
  } catch (e) {
    console.warn('db_addProgressNoteComment 실패:', e);
    return { success: false, error: e.message || String(e) };
  }
}

async function db_deleteProgressNote(noteId, taskId) {
  const coll = window.getProgressNotesCollection?.();
  if (!coll || !canWriteToFirestore()) return { success: false, error: '인증 실패 또는 DB 접근 불가' };
  const task = tasks.find(item => item.id === String(taskId || '').split('__sub_')[0]);
  if (!window.hasTaskPermission?.(task, 'delete')) return { success: false, error: '메모 삭제 권한이 없습니다.' };
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
window.db_addProgressNoteComment = db_addProgressNoteComment;
window.db_deleteProgressNote = db_deleteProgressNote;
window.db_fetchTrackerProgressNotes = db_fetchTrackerProgressNotes;
