console.info('Smart Task Flow calendar-utils.js v20260626-module-split-phase4a-calendar-utils loaded');
// Calendar helper functions and lane packing logic. Full renderCalendar remains in app.js.
function dateRangeOverlaps(item, monthStart, monthEnd, fallbackDate) {
  const start = new Date(String(item.startDate || item.dueDate || fallbackDate).replace(/-/g, '/'));
  const end = new Date(String(item.dueDate || item.startDate || fallbackDate).replace(/-/g, '/'));
  return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= monthEnd && end >= monthStart;
}
function getMonthlySubTasks(task, monthStart, monthEnd, todayStr) {
  const allSubTasks = Array.isArray(task.subTasks) ? task.subTasks : [];
  return { allSubTasks, visibleSubTasks: allSubTasks.filter(st => dateRangeOverlaps(st, monthStart, monthEnd, todayStr)) };
}
function buildMonthlySubTaskHTML(task, monthStart, monthEnd, todayStr) {
  const { allSubTasks, visibleSubTasks } = getMonthlySubTasks(task, monthStart, monthEnd, todayStr);
  if (!allSubTasks.length || !visibleSubTasks.length) return '';
  let html = '<div class="mt-2 space-y-1">';
  visibleSubTasks.forEach(st => {
    const status = normalizeStatus(st.status);
    const overdue = isSubTaskOverdue(st, todayStr);
    html += `<div class="truncate text-[10px] ${status === 'COMPLETED' ? 'text-slate-400 line-through' : overdue ? 'text-rose-700 font-semibold' : status === 'PROGRESS' ? 'text-blue-600' : 'text-slate-600'}">${overdue ? '🚨' : getStatusIcon(status)} ${escapeHTML(st.title)} <span class="${overdue ? 'text-rose-500' : 'text-slate-400'}">${st.dueDate ? st.dueDate.substring(5) : ''}</span></div>`;
  });
  const hidden = allSubTasks.length - visibleSubTasks.length;
  if (hidden > 0) html += `<div class="text-[10px] text-slate-400">외 ${hidden}건 숨김</div>`;
  html += '</div>';
  return html;
}
function bindGanttTooltip(el, title, details) {
  const tip = document.getElementById('gantt-tooltip');
  if (!tip || !el) return;
  el.addEventListener('mouseenter', () => {
    tip.innerHTML = `<div class="font-bold mb-1">${escapeHTML(title || '')}</div><div>${String(details || '')}</div>`;
    tip.classList.remove('hidden');
  });
  el.addEventListener('mousemove', e => { tip.style.left = e.clientX + 15 + 'px'; tip.style.top = e.clientY + 15 + 'px'; });
  el.addEventListener('mouseleave', () => tip.classList.add('hidden'));
}

function calendarComputeLaneLayout(groups, options = {}) {
  const currentCalMode = options.currentCalMode || 'DAY';
  const showSubTaskBars = options.showSubTaskBars !== false;
  const groupByAssignee = options.groupByAssignee === true;
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
        if (lineStore[startLine + i].some(o => g.rangeStart <= o.end && o.start <= g.rangeEnd)) { overlap = true; break; }
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
    const key = g.assignee || '미지정';
    const current = assigneeKpis.get(key) || { total: 0, progress: 0, overdue: 0, completed: 0 };
    current.total += 1;
    const es = getEffectiveStatus(g, todayStr);
    if (es === 'PROGRESS') current.progress += 1;
    if (es === 'OVERDUE') current.overdue += 1;
    if (es === 'COMPLETED') current.completed += 1;
    assigneeKpis.set(key, current);
  });
  if (groupByAssignee) {
    const buckets = new Map();
    groups.forEach(g => {
      const key = g.assignee || '미지정';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(g);
    });
    let lineOffset = 0;
    Array.from(buckets.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]))).forEach(([assigneeName, bucket]) => {
      const headerLine = lineOffset;
      lines[headerLine] = [{ start: '0000-01-01', end: '9999-12-31', type: 'assignee-header' }];
      const localLines = [];
      bucket.forEach(g => {
        g.assigneeHeaderLine = headerLine;
        g.assigneeGroupName = assigneeName;
        g.assigneeKpi = assigneeKpis.get(assigneeName) || { total: 0, progress: 0, overdue: 0, completed: 0 };
        packGroupIntoLines(g, localLines, headerLine + 1);
      });
      localLines.forEach((ln, idx) => { lines[headerLine + 1 + idx] = ln; });
      lineOffset = headerLine + 1 + Math.max(localLines.length, 1);
    });
  } else {
    groups.forEach(g => packGroupIntoLines(g, lines, 0));
  }
  return { lines, totalCalLanes: lines.length, assigneeKpis };
}
