console.info('Smart Task Flow export-service.js v20260714-v2 loaded');

function getExportSubTaskRows(normalized, today, exportStart, exportEnd) {
  const rows = [];
  (Array.isArray(normalized.subTasks) ? normalized.subTasks : []).forEach(st => {
    const recurrenceLabel = typeof getRecurrenceLabel === 'function' ? getRecurrenceLabel(st.recurrence) : '';
    const baseRow = {
      rowType: 'SUBTASK',
      parentTask: normalized.title || '',
      id: st.id || '',
      title: st.title || '',
      industry: normalized.industry || 'AUTO',
      taskType: normalized.taskType || 'GENERAL',
      assignee: st.assignee || normalized.assignee || '',
      startDate: st.startDate || '',
      dueDate: st.dueDate || '',
      priority: '',
      status: getStatusKorean(normalizeStatus(st.status)),
      progressPct: '',
      riskLevel: isSubTaskOverdue(st, today) ? '지연' : getStatusKorean(normalizeStatus(st.status)),
      riskDelayDays: isSubTaskOverdue(st, today) ? getDelayDays(st.dueDate, today) : 0,
      recurrence: recurrenceLabel,
      notes: ''
    };
    rows.push(baseRow);

    if (st.recurrence?.enabled === true && typeof getRecurringSubTaskOccurrences === 'function') {
      getRecurringSubTaskOccurrences(st, exportStart, exportEnd, today).forEach(occ => {
        rows.push({
          ...baseRow,
          rowType: 'SUBTASK_OCCURRENCE',
          id: occ.id || `${st.id || ''}@${occ.startDate || ''}`,
          startDate: occ.startDate || '',
          dueDate: occ.dueDate || '',
          status: getStatusKorean(normalizeStatus(occ.status)),
          riskLevel: isSubTaskOverdue(occ, today) ? '지연' : getStatusKorean(normalizeStatus(occ.status)),
          riskDelayDays: isSubTaskOverdue(occ, today) ? getDelayDays(occ.dueDate, today) : 0
        });
      });
    }
  });
  return rows;
}

function getExportRows() {
  const rows = [];
  const today = getTodayStr();
  const exportYear = String(today).slice(0, 4);
  const exportStart = `${exportYear}-01-01`;
  const exportEnd = `${exportYear}-12-31`;
  tasks.filter(t => t.trackerId === currentTrackerId && !t.deleted).forEach(t => {
    const normalized = normalizeTaskForSchema(t);
    const risk = getTaskRiskInfo(normalized, today);
    rows.push({
      rowType: 'TASK',
      parentTask: '',
      id: normalized.id || '',
      title: normalized.title || '',
      industry: normalized.industry || 'AUTO',
      taskType: normalized.taskType || 'GENERAL',
      assignee: normalized.assignee || '',
      startDate: normalized.startDate || '',
      dueDate: normalized.dueDate || '',
      priority: getPriorityBadge(normalized.priority),
      status: getStatusKorean(normalized.status),
      progressPct: getTaskProgress(normalized),
      riskLevel: risk.label,
      riskDelayDays: risk.delay,
      recurrence: '',
      notes: normalized.notes || ''
    });
    rows.push(...getExportSubTaskRows(normalized, today, exportStart, exportEnd));
  });
  return rows;
}

function downloadTextFile(filename, content, mime = 'text/plain;charset=utf-8;') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToJSON() {
  const data = tasks.filter(t => t.trackerId === currentTrackerId).map(normalizeTaskForSchema);
  downloadTextFile(`backup_${getTodayStr()}.json`, JSON.stringify(data, null, 4), 'application/json;charset=utf-8;');
}

function exportPowerBIJSON() {
  const today = getTodayStr();
  const records = getExportRows().map(r => ({ ...r, trackerId: currentTrackerId, exportDate: today }));
  downloadTextFile(`powerbi_task_flat_${today}.json`, JSON.stringify(records, null, 2), 'application/json;charset=utf-8;');
}

function exportToCSV() {
  const cols = ['rowType', 'parentTask', 'id', 'title', 'industry', 'taskType', 'assignee', 'startDate', 'dueDate', 'priority', 'status', 'progressPct', 'riskLevel', 'riskDelayDays', 'recurrence', 'notes'];
  const rows = [cols, ...getExportRows().map(r => cols.map(c => r[c] ?? ''))];
  const csv = '\uFEFF' + rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadTextFile(`bd_task_export_${getTodayStr()}.csv`, csv, 'text/csv;charset=utf-8;');
}

function exportToExcel() {
  const cols = ['rowType', 'parentTask', 'id', 'title', 'industry', 'taskType', 'assignee', 'startDate', 'dueDate', 'priority', 'status', 'progressPct', 'riskLevel', 'riskDelayDays', 'recurrence', 'notes'];
  const escapeCell = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = getExportRows();
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px}th{background:#eef2ff;font-weight:bold}td,th{border:1px solid #cbd5e1;padding:4px 6px;white-space:nowrap}.TASK{background:#f8fafc;font-weight:bold}.SUBTASK{background:#ffffff;color:#475569}.SUBTASK_OCCURRENCE{background:#f5f3ff;color:#4338ca}</style></head><body><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr class="${r.rowType}">${cols.map(c => `<td>${escapeCell(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  downloadTextFile(`bd_task_export_${getTodayStr()}.xls`, '\uFEFF' + html, 'application/vnd.ms-excel;charset=utf-8;');
}
