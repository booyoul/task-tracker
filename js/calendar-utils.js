console.info('Smart Task Flow calendar-utils.js v20260714-v3 loaded');
function dateRangeOverlaps(item, monthStart, monthEnd, fallbackDate) { const start = new Date(String(item.startDate || item.dueDate || fallbackDate).replace(/-/g, '/')); const end = new Date(String(item.dueDate || item.startDate || fallbackDate).replace(/-/g, '/')); return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= monthEnd && end >= monthStart; }
function parseDateOnlyValue(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(/-/g, '/'));
  return isNaN(date.getTime()) ? null : date;
}
function formatDateOnlyValue(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function addDateDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}
function addDateMonthsClamped(date, months, targetDay) {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDay || date.getDate(), maxDay));
  return next;
}
function getDateDiffDays(start, end) {
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / oneDayMs));
}
function getWeekdayCode(date) {
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()];
}
function getRecurrenceLabel(recurrence = {}) {
  if (!recurrence || recurrence.enabled !== true) return '';
  const labels = { DAILY: '매일', WEEKLY: '매주', MONTHLY: '매월', QUARTERLY: '분기', YEARLY: '매년' };
  const units = { DAILY: '일', WEEKLY: '주', MONTHLY: '개월', QUARTERLY: '분기', YEARLY: '년' };
  const days = { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' };
  const frequency = recurrence.frequency || 'WEEKLY';
  const interval = Number.parseInt(recurrence.interval, 10);
  const base = interval > 1 ? `${interval}${units[frequency] || '회'}마다` : (labels[frequency] || '반복');
  const byDay = frequency === 'WEEKLY' && Array.isArray(recurrence.byDay) && recurrence.byDay.length
    ? ` · ${recurrence.byDay.map(day => days[day] || day).join('/')}`
    : '';
  const end = recurrence.endType === 'UNTIL' && recurrence.until
    ? ` · ${String(recurrence.until).substring(5)}까지`
    : recurrence.endType === 'COUNT' && recurrence.count
      ? ` · ${recurrence.count}회`
      : '';
  return `${base}${byDay}${end}`;
}
function getSubTaskOccurrenceStatus(st, occurrenceKey) {
  const completions = st && typeof st.recurrenceCompletions === 'object' && st.recurrenceCompletions
    ? st.recurrenceCompletions
    : {};
  return normalizeStatus(completions[occurrenceKey] || st?.status);
}
function getClampedOccurrenceEndDate(occurrenceStart, durationDays, nextOccurrenceStart, effectiveEnd) {
  let occurrenceEnd = addDateDays(occurrenceStart, durationDays);
  if (nextOccurrenceStart instanceof Date && !isNaN(nextOccurrenceStart.getTime())) {
    const latestBeforeNext = addDateDays(nextOccurrenceStart, -1);
    if (latestBeforeNext < occurrenceEnd) occurrenceEnd = latestBeforeNext;
  }
  if (effectiveEnd instanceof Date && !isNaN(effectiveEnd.getTime()) && effectiveEnd < occurrenceEnd) {
    occurrenceEnd = effectiveEnd;
  }
  return occurrenceEnd < occurrenceStart ? occurrenceStart : occurrenceEnd;
}
function makeSubTaskOccurrence(st, occurrenceStart, durationDays, index, occurrenceEnd = null) {
  const startDate = formatDateOnlyValue(occurrenceStart);
  const dueDate = formatDateOnlyValue(occurrenceEnd || addDateDays(occurrenceStart, durationDays));
  return {
    ...st,
    id: `${st.id || st.title || 'sub'}__occ_${startDate}`,
    sourceSubTaskId: st.id || '',
    occurrenceKey: startDate,
    occurrenceIndex: index,
    isRecurringOccurrence: true,
    recurrenceLabel: getRecurrenceLabel(st.recurrence),
    status: getSubTaskOccurrenceStatus(st, startDate),
    startDate,
    dueDate
  };
}
function getRecurringSubTaskOccurrences(st, rangeStart, rangeEnd, fallbackDate) {
  const recurrence = st && st.recurrence;
  if (!recurrence || recurrence.enabled !== true) return [];
  const start = parseDateOnlyValue(st.startDate || st.dueDate || fallbackDate);
  const due = parseDateOnlyValue(st.dueDate || st.startDate || fallbackDate);
  if (!start || !due) return [];
  const rangeS = rangeStart instanceof Date ? rangeStart : parseDateOnlyValue(rangeStart || fallbackDate);
  const rangeE = rangeEnd instanceof Date ? rangeEnd : parseDateOnlyValue(rangeEnd || fallbackDate);
  if (!rangeS || !rangeE) return [];
  const durationDays = getDateDiffDays(start, due);
  const interval = Math.max(1, Number.parseInt(recurrence.interval, 10) || 1);
  const countLimit = recurrence.endType === 'COUNT' ? Math.max(1, Number.parseInt(recurrence.count, 10) || 1) : Number.POSITIVE_INFINITY;
  const untilDate = recurrence.endType === 'UNTIL' ? parseDateOnlyValue(recurrence.until) : null;
  const effectiveEnd = untilDate && untilDate < rangeE ? untilDate : rangeE;
  const safetyLimit = 10000;
  const frequency = recurrence.frequency || 'WEEKLY';
  const occurrenceStarts = [];
  const addOccurrenceStart = occurrenceStart => {
    if (occurrenceStart > effectiveEnd) return false;
    occurrenceStarts.push(new Date(occurrenceStart));
    return true;
  };
  let generated = 0;
  let safety = 0;
  if (frequency === 'DAILY') {
    for (let cursor = new Date(start); generated < countLimit && cursor <= effectiveEnd && safety < safetyLimit; cursor = addDateDays(cursor, interval)) {
      addOccurrenceStart(cursor);
      generated += 1;
      safety += 1;
    }
  } else if (frequency === 'WEEKLY') {
    const selectedDays = Array.isArray(recurrence.byDay) && recurrence.byDay.length ? recurrence.byDay : [getWeekdayCode(start)];
    for (let cursor = new Date(start); generated < countLimit && cursor <= effectiveEnd && safety < safetyLimit; cursor = addDateDays(cursor, 1)) {
      safety += 1;
      const weekDiff = Math.floor(getDateDiffDays(start, cursor) / 7);
      if (weekDiff % interval !== 0 || !selectedDays.includes(getWeekdayCode(cursor))) continue;
      addOccurrenceStart(cursor);
      generated += 1;
    }
  } else {
    const monthStep = frequency === 'MONTHLY' ? interval : frequency === 'QUARTERLY' ? interval * 3 : interval * 12;
    for (let cursor = new Date(start); generated < countLimit && cursor <= effectiveEnd && safety < safetyLimit; cursor = addDateMonthsClamped(cursor, monthStep, start.getDate())) {
      addOccurrenceStart(cursor);
      generated += 1;
      safety += 1;
    }
  }
  const getNextScheduledStart = occurrenceStart => {
    if (frequency === 'DAILY') return addDateDays(occurrenceStart, interval);
    if (frequency === 'WEEKLY') {
      const selectedDays = Array.isArray(recurrence.byDay) && recurrence.byDay.length ? recurrence.byDay : [getWeekdayCode(start)];
      for (let cursor = addDateDays(occurrenceStart, 1), guard = 0; guard < safetyLimit; cursor = addDateDays(cursor, 1), guard += 1) {
        const weekDiff = Math.floor(getDateDiffDays(start, cursor) / 7);
        if (weekDiff % interval === 0 && selectedDays.includes(getWeekdayCode(cursor))) return cursor;
      }
      return null;
    }
    const monthStep = frequency === 'MONTHLY' ? interval : frequency === 'QUARTERLY' ? interval * 3 : interval * 12;
    return addDateMonthsClamped(occurrenceStart, monthStep, start.getDate());
  };
  const occurrences = [];
  occurrenceStarts.forEach((occurrenceStart, index) => {
    const nextOccurrenceStart = occurrenceStarts[index + 1] || getNextScheduledStart(occurrenceStart);
    const occurrenceEnd = getClampedOccurrenceEndDate(occurrenceStart, durationDays, nextOccurrenceStart, effectiveEnd);
    if (occurrenceEnd >= rangeS && occurrenceStart <= rangeE) {
      occurrences.push(makeSubTaskOccurrence(st, occurrenceStart, durationDays, index, occurrenceEnd));
    }
  });
  return occurrences;
}
function expandSubTasksForRange(task, rangeStart, rangeEnd, fallbackDate) {
  const allSubTasks = Array.isArray(task?.subTasks) ? task.subTasks : [];
  const expanded = [];
  allSubTasks.forEach(st => {
    if (st?.recurrence?.enabled === true) {
      expanded.push(...getRecurringSubTaskOccurrences(st, rangeStart, rangeEnd, fallbackDate));
    } else {
      expanded.push(st);
    }
  });
  return expanded;
}
function getMonthlySubTasks(task, monthStart, monthEnd, todayStr) { const allSubTasks = Array.isArray(task.subTasks) ? task.subTasks : []; const expandedSubTasks = expandSubTasksForRange(task, monthStart, monthEnd, todayStr); return { allSubTasks, expandedSubTasks, visibleSubTasks: expandedSubTasks.filter(st => dateRangeOverlaps(st, monthStart, monthEnd, todayStr)) }; }
function buildMonthlySubTaskHTML(task, monthStart, monthEnd, todayStr) { const { allSubTasks, visibleSubTasks } = getMonthlySubTasks(task, monthStart, monthEnd, todayStr); if (!allSubTasks.length || !visibleSubTasks.length) return ''; let html = '<div class="mt-2 space-y-1">'; visibleSubTasks.forEach(st => { const status = normalizeStatus(st.status); const overdue = isSubTaskOverdue(st, todayStr); html += `<div class="truncate text-[10px] ${status === 'COMPLETED' ? 'text-slate-400 line-through' : overdue ? 'text-rose-700 font-semibold' : status === 'PROGRESS' ? 'text-blue-600' : 'text-slate-600'}">${overdue ? '🚨' : getStatusIcon(status)} ${escapeHTML(st.title)} <span class="${overdue ? 'text-rose-500' : 'text-slate-400'}">${st.dueDate ? st.dueDate.substring(5) : ''}</span></div>`; }); const hidden = allSubTasks.length - visibleSubTasks.length; if (hidden > 0) html += `<div class="text-[10px] text-slate-400">외 ${hidden}건 숨김</div>`; html += '</div>'; return html; }
function bindGanttTooltip(el, title, details) { const tip = document.getElementById('gantt-tooltip'); if (!tip || !el) return; el.addEventListener('mouseenter', () => { tip.innerHTML = `<div class="font-bold mb-1">${escapeHTML(title || '')}</div><div>${String(details || '')}</div>`; tip.classList.remove('hidden'); }); el.addEventListener('mousemove', e => { tip.style.left = e.clientX + 15 + 'px'; tip.style.top = e.clientY + 15 + 'px'; }); el.addEventListener('mouseleave', () => tip.classList.add('hidden')); }
function calendarComputeLaneLayout(groups, options = {}) {
  const currentCalMode = options.currentCalMode || 'DAY';
  const showSubTaskBars = options.showSubTaskBars !== false;
  const groupByAssignee = options.groupByAssignee === true;
  const duplicateMultiAssignee = options.duplicateMultiAssignee !== false;
  const todayStr = options.todayStr || getTodayStr();
  const lines = [];
  const packGroupIntoLines = (g, lineStore, lineOffset = 0) => {
    const layoutSubTasks = currentCalMode === 'MONTH' ? g.subTasks : (g.monthSubTasks || []);
    const need = showSubTaskBars ? 1 + layoutSubTasks.length : 1;
    let startLine = 0;
    while (true) {
      let overlap = false;
      for (let i = 0; i < need; i++) {
        if (!lineStore[startLine + i]) lineStore[startLine + i] = [];
        if (lineStore[startLine + i].some(o => g.rangeStart <= o.end && o.start <= g.rangeEnd)) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        for (let i = 0; i < need; i++) lineStore[startLine + i].push({ start: g.rangeStart, end: g.rangeEnd });
        g.globalLineStart = lineOffset + startLine;
        break;
      }
      startLine++;
    }
  };
  
  const assigneeKpis = new Map();
  groups.forEach(g => {
    let keys;
    if (groupByAssignee && !duplicateMultiAssignee) {
      const rawAssignees = Array.isArray(g.assignee) ? g.assignee : [g.assignee || '미지정'];
      keys = [rawAssignees[0] || '미지정'];
    } else {
      keys = Array.isArray(g.assignee) ? g.assignee : [g.assignee || '미지정'];
    }
    keys.forEach(key => {
      const current = assigneeKpis.get(key) || { total: 0, progress: 0, overdue: 0, completed: 0 };
      current.total += 1;
      const es = getEffectiveStatus(g, todayStr);
      if (es === 'PROGRESS') current.progress += 1;
      if (es === 'OVERDUE') current.overdue += 1;
      if (es === 'COMPLETED') current.completed += 1;
      assigneeKpis.set(key, current);
    });
  });
  
  const layoutGroups = [];
  if (groupByAssignee) {
    const buckets = new Map();
    groups.forEach(g => {
      let keys;
      if (!duplicateMultiAssignee) {
        const rawAssignees = Array.isArray(g.assignee) ? g.assignee : [g.assignee || '미지정'];
        keys = [rawAssignees[0] || '미지정'];
      } else {
        keys = Array.isArray(g.assignee) ? g.assignee : [g.assignee || '미지정'];
      }
      keys.forEach(key => {
        if (!buckets.has(key)) buckets.set(key, []);
        const gClone = { ...g };
        buckets.get(key).push(gClone);
      });
    });
    let lineOffset = 0;
    Array.from(buckets.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0]))).forEach(([assigneeName, bucket]) => {
      const headerLine = lineOffset;
      lines[headerLine] = [{ start: '0000-01-01', end: '9999-12-31', type: 'assignee-header' }];
      const localLines = [];
      bucket.forEach(g => {
        g.assigneeHeaderLine = headerLine;
        g.assigneeGroupName = assigneeName;
        g.assigneeKpi = assigneeKpis.get(assigneeName) || { total: 0, progress: 0, overdue: 0, completed: 0 };
        packGroupIntoLines(g, localLines, headerLine + 1);
        layoutGroups.push(g);
      });
      localLines.forEach((ln, idx) => {
        lines[headerLine + 1 + idx] = ln;
      });
      lineOffset = headerLine + 1 + Math.max(localLines.length, 1);
    });
  } else {
    groups.forEach(g => {
      packGroupIntoLines(g, lines, 0);
      layoutGroups.push(g);
    });
  }
  return { lines, totalCalLanes: lines.length, assigneeKpis, layoutGroups };
}
