console.info('Smart Task Flow schema-service.js v20260626-module-split-phase4b-day-renderer loaded');
const CURRENT_TASK_SCHEMA_VERSION = 2; let schemaMigrationInProgress = false;
const SUBTASK_RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
const SUBTASK_RECURRENCE_END_TYPES = ['NONE', 'UNTIL', 'COUNT'];
const SUBTASK_RECURRENCE_WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
function normalizeAssignee(val) {
  if (Array.isArray(val)) {
    const clean = val.map(v => String(v || '').trim()).filter(Boolean);
    return clean.length ? clean : ['미지정'];
  }
  if (typeof val === 'string' && val.trim()) {
    return val.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (val) {
    return [String(val).trim()];
  }
  return ['미지정'];
}
function isDateOnlyString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function normalizeSubTaskRecurrence(recurrence = {}) {
  if (!recurrence || recurrence.enabled !== true) return null;
  const frequency = String(recurrence.frequency || 'WEEKLY').toUpperCase();
  const interval = Number.parseInt(recurrence.interval, 10);
  const endType = String(recurrence.endType || 'NONE').toUpperCase();
  const normalized = {
    enabled: true,
    frequency: SUBTASK_RECURRENCE_FREQUENCIES.includes(frequency) ? frequency : 'WEEKLY',
    interval: Number.isFinite(interval) && interval > 0 ? Math.min(interval, 99) : 1,
    endType: SUBTASK_RECURRENCE_END_TYPES.includes(endType) ? endType : 'NONE'
  };
  if (normalized.frequency === 'WEEKLY') {
    const rawDays = Array.isArray(recurrence.byDay) ? recurrence.byDay : [];
    const days = rawDays.map(day => String(day || '').toUpperCase()).filter(day => SUBTASK_RECURRENCE_WEEKDAYS.includes(day));
    normalized.byDay = [...new Set(days)];
  }
  if (normalized.endType === 'UNTIL' && isDateOnlyString(recurrence.until)) normalized.until = recurrence.until;
  if (normalized.endType === 'COUNT') {
    const count = Number.parseInt(recurrence.count, 10);
    if (Number.isFinite(count) && count > 0) normalized.count = Math.min(count, 999);
  }
  return normalized;
}
function validateSubTaskRecurrence(st = {}) {
  const recurrence = st.recurrence;
  if (!recurrence || recurrence.enabled !== true) return '';
  const title = st.title || '하위 업무';
  const frequency = String(recurrence.frequency || '').toUpperCase();
  const interval = Number.parseInt(recurrence.interval, 10);
  const endType = String(recurrence.endType || 'NONE').toUpperCase();
  if (!st.startDate) return `반복 하위 업무 '${title}'의 시작일은 필수입니다.`;
  if (!isDateOnlyString(st.startDate)) return `반복 하위 업무 '${title}'의 시작일 형식이 올바르지 않습니다.`;
  if (st.dueDate && !isDateOnlyString(st.dueDate)) return `반복 하위 업무 '${title}'의 마감일 형식이 올바르지 않습니다.`;
  if (!SUBTASK_RECURRENCE_FREQUENCIES.includes(frequency)) return `반복 하위 업무 '${title}'의 실행 주기가 올바르지 않습니다.`;
  if (!Number.isFinite(interval) || interval < 1 || interval > 99) return `반복 하위 업무 '${title}'의 반복 간격은 1~99 사이여야 합니다.`;
  if (!SUBTASK_RECURRENCE_END_TYPES.includes(endType)) return `반복 하위 업무 '${title}'의 반복 종료 조건이 올바르지 않습니다.`;
  if (frequency === 'WEEKLY') {
    const days = Array.isArray(recurrence.byDay) ? recurrence.byDay.map(day => String(day || '').toUpperCase()) : [];
    if (days.some(day => !SUBTASK_RECURRENCE_WEEKDAYS.includes(day))) return `반복 하위 업무 '${title}'의 요일 값이 올바르지 않습니다.`;
  }
  if (endType === 'UNTIL') {
    if (!isDateOnlyString(recurrence.until)) return `반복 하위 업무 '${title}'의 종료일 형식이 올바르지 않습니다.`;
    if (recurrence.until < st.startDate) return `반복 하위 업무 '${title}'의 종료일은 시작일보다 빠를 수 없습니다.`;
  }
  if (endType === 'COUNT') {
    const count = Number.parseInt(recurrence.count, 10);
    if (!Number.isFinite(count) || count < 1 || count > 999) return `반복 하위 업무 '${title}'의 반복 횟수는 1~999 사이여야 합니다.`;
  }
  return '';
}
function normalizeSubTaskForSchema(st = {}, parent = {}) {
  // 날짜가 명시적으로 존재할 때만 정규화. 없으면 빈 문자열 유지.
  // (날짜가 없는 서브태스크에 오늘 날짜를 강제 주입하면 월별 요약 필터링이 오염됨)
  const rawStart = st.startDate || st.dueDate || '';
  const rawDue   = st.dueDate   || st.startDate || '';
  const start = rawStart > rawDue && rawDue ? rawDue : rawStart;
  const due   = rawDue   || rawStart;
  const normalized = {
    id: st.id || 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    title: String(st.title || '').trim() || '하위 업무',
    assignee: normalizeAssignee(st.assignee || (Array.isArray(parent.assignee) ? parent.assignee : [parent.assignee || '미지정'])),
    startDate: start,
    dueDate: due,
    status: normalizeStatus(st.status),
    industry: parent.industry || st.industry || 'AUTO',
    taskType: parent.taskType || st.taskType || 'GENERAL'
  };
  const recurrence = normalizeSubTaskRecurrence(st.recurrence);
  if (recurrence) normalized.recurrence = recurrence;
  return normalized;
}
function normalizeTaskForSchema(task = {}) { const start = task.startDate || task.dueDate || getTodayStr(); const due = task.dueDate || task.startDate || start; const normalized = { ...task, title: String(task.title || '').trim() || '업무', assignee: normalizeAssignee(task.assignee), startDate: start > due ? due : start, dueDate: due, priority: ['HIGH','NORMAL','LOW'].includes(task.priority) ? task.priority : 'NORMAL', status: normalizeStatus(task.status), industry: task.industry || 'AUTO', taskType: task.taskType || 'GENERAL', notes: task.notes || '', deleted: task.deleted === true ? true : false, schemaVersion: CURRENT_TASK_SCHEMA_VERSION }; normalized.subTasks = (Array.isArray(task.subTasks) ? task.subTasks : []).map(st => normalizeSubTaskForSchema(st, normalized)); return normalized; }
function taskNeedsSchemaMigration(task = {}) { return task.schemaVersion !== CURRENT_TASK_SCHEMA_VERSION || !task.industry || !task.taskType || !Array.isArray(task.subTasks) || (task.subTasks || []).some(st => !st.id || !st.status || !st.startDate || !st.dueDate); }
async function migrateExistingTasksToCurrentSchema(scopeTasks = tasks) { if (schemaMigrationInProgress || !isFirebaseAvailable || !db) return; const coll = getTasksCollection(); if (!coll) return; const candidates = (scopeTasks || []).filter(t => t && t.id && t.deleted !== true && taskNeedsSchemaMigration(t)); if (!candidates.length) return; schemaMigrationInProgress = true; try { const batch = window.fs.writeBatch(window.db); candidates.forEach(t => batch.set(window.fs.doc(coll, t.id), normalizeTaskForSchema(t), { merge: true })); await batch.commit(); markSaved(); } catch (e) { markSaveError(); console.warn('Schema migration failed', e); } finally { schemaMigrationInProgress = false; } }
function validateTaskPayload(data) { if (!data.title || !String(data.title).trim()) return '업무명은 필수입니다.'; const validAssignees = Array.isArray(data.assignee) ? data.assignee.filter(Boolean) : []; if (!validAssignees.length) return '담당자는 필수입니다.'; if (data.startDate && data.dueDate && data.startDate > data.dueDate) return '시작일은 마감일보다 늦을 수 없습니다.'; const subTasks = Array.isArray(data.subTasks) ? data.subTasks : []; const invalidSub = subTasks.find(st => st.startDate && st.dueDate && st.startDate > st.dueDate); if (invalidSub) return `하위 업무 '${invalidSub.title || ''}'의 시작일이 마감일보다 늦습니다.`; const invalidRecurrence = subTasks.map(st => validateSubTaskRecurrence(st)).find(Boolean); if (invalidRecurrence) return invalidRecurrence; return ''; }
