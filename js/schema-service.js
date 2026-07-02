console.info('Smart Task Flow schema-service.js v20260626-module-split-phase4b-day-renderer loaded');
const CURRENT_TASK_SCHEMA_VERSION = 2; let schemaMigrationInProgress = false;
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
function normalizeSubTaskForSchema(st = {}, parent = {}) { const start = st.startDate || st.dueDate || parent.dueDate || getTodayStr(); const due = st.dueDate || st.startDate || parent.dueDate || start; return { id: st.id || 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), title: String(st.title || '').trim() || '하위 업무', assignee: normalizeAssignee(st.assignee || (Array.isArray(parent.assignee) ? parent.assignee : [parent.assignee || '미지정'])), startDate: start > due ? due : start, dueDate: due, status: normalizeStatus(st.status), industry: parent.industry || st.industry || 'AUTO', taskType: parent.taskType || st.taskType || 'GENERAL' }; }
function normalizeTaskForSchema(task = {}) { const start = task.startDate || task.dueDate || getTodayStr(); const due = task.dueDate || task.startDate || start; const normalized = { ...task, title: String(task.title || '').trim() || '업무', assignee: normalizeAssignee(task.assignee), startDate: start > due ? due : start, dueDate: due, priority: ['HIGH','NORMAL','LOW'].includes(task.priority) ? task.priority : 'NORMAL', status: normalizeStatus(task.status), industry: task.industry || 'AUTO', taskType: task.taskType || 'GENERAL', notes: task.notes || '', deleted: task.deleted === true ? true : false, schemaVersion: CURRENT_TASK_SCHEMA_VERSION }; normalized.subTasks = (Array.isArray(task.subTasks) ? task.subTasks : []).map(st => normalizeSubTaskForSchema(st, normalized)); return normalized; }
function taskNeedsSchemaMigration(task = {}) { return task.schemaVersion !== CURRENT_TASK_SCHEMA_VERSION || !task.industry || !task.taskType || !Array.isArray(task.subTasks) || (task.subTasks || []).some(st => !st.id || !st.status || !st.startDate || !st.dueDate); }
async function migrateExistingTasksToCurrentSchema(scopeTasks = tasks) { if (schemaMigrationInProgress || !isFirebaseAvailable || !db) return; const coll = getTasksCollection(); if (!coll) return; const candidates = (scopeTasks || []).filter(t => t && t.id && t.deleted !== true && taskNeedsSchemaMigration(t)); if (!candidates.length) return; schemaMigrationInProgress = true; try { const batch = window.fs.writeBatch(window.db); candidates.forEach(t => batch.set(window.fs.doc(coll, t.id), normalizeTaskForSchema(t), { merge: true })); await batch.commit(); markSaved(); } catch (e) { markSaveError(); console.warn('Schema migration failed', e); } finally { schemaMigrationInProgress = false; } }
function validateTaskPayload(data) { if (!data.title || !String(data.title).trim()) return '업무명은 필수입니다.'; const validAssignees = Array.isArray(data.assignee) ? data.assignee.filter(Boolean) : []; if (!validAssignees.length) return '담당자는 필수입니다.'; if (data.startDate && data.dueDate && data.startDate > data.dueDate) return '시작일은 마감일보다 늦을 수 없습니다.'; const invalidSub = (Array.isArray(data.subTasks) ? data.subTasks : []).find(st => st.startDate && st.dueDate && st.startDate > st.dueDate); if (invalidSub) return `하위 업무 '${invalidSub.title || ''}'의 시작일이 마감일보다 늦습니다.`; return ''; }
