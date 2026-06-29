console.info('Smart Task Flow calendar-month-renderer.js v20260626-module-split-phase4c-month-renderer loaded');
// MONTH calendar Gantt renderer. Extracted from app.js in Phase 4C.
function renderCalendarMonthView(ctx) {
  const { weekdayHeader, grid, year, groups, lines, mainClass, subClass, dimIfNotCritical, showSubTaskBars, todayStr } = ctx;
    weekdayHeader?.classList.add('hidden');
    grid.className = 'relative bg-white border border-slate-200 rounded-xl overflow-hidden';
    grid.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'grid grid-cols-12 gap-px bg-slate-50 relative z-20 border-b border-slate-200/80 shadow-sm';
    for (let m = 1; m <= 12; m++) {
      const h = document.createElement('div');
      h.className = 'py-3 text-center text-xs font-bold text-slate-700 cursor-pointer hover:text-indigo-600 hover:bg-slate-100 transition-colors';
      h.textContent = `${m}월`;
      h.title = `${m}월 일별 보기로 이동`;
      h.onclick = () => {
        currentCalDate.setMonth(m - 1);
        setCalMode('DAY');
      };
      header.appendChild(h);
    }
    grid.appendChild(header);
    const body = document.createElement('div');
    body.className = 'relative z-10 w-full';
    const tiles = document.createElement('div');
    tiles.className = 'grid grid-cols-12 gap-px bg-slate-100/50';
    const rowHeight = 28;
    const totalLines = lines.length > 5 ? lines.length : 5;
    const bodyHeight = totalLines * rowHeight + 20;
    for (let i = 0; i < 12; i++) {
      const tile = document.createElement('div');
      tile.className = 'bg-white border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors';
      tile.style.height = `${bodyHeight}px`;
      tile.title = `${i + 1}월 일별 보기로 이동`;
      tile.onclick = () => {
        currentCalDate.setMonth(i);
        setCalMode('DAY');
      };
      tiles.appendChild(tile);
    }
    body.appendChild(tiles);
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 pointer-events-none';
    if (calendarUxState.groupByAssignee) {
      const renderedAssigneeLabels = new Set();
      groups.forEach(g => {
        if (g.assigneeHeaderLine == null || renderedAssigneeLabels.has(g.assigneeGroupName)) return;
        renderedAssigneeLabels.add(g.assigneeGroupName);
        const k = g.assigneeKpi || { total: 0, progress: 0, overdue: 0, completed: 0 };
        const label = document.createElement('div');
        label.className = 'absolute rounded-md bg-slate-800/85 px-2 py-0.5 text-[10px] font-black text-white shadow-sm';
        label.style.left = '4px';
        label.style.top = `${g.assigneeHeaderLine * rowHeight + 10}px`;
        label.style.zIndex = 30;
        label.textContent = `👤 ${g.assigneeGroupName} · 전체 ${k.total} · 진행 ${k.progress} · 지연 ${k.overdue} · 완료 ${k.completed}`;
        overlay.appendChild(label);
      });
    }
    groups.forEach(g => {
      const startD = new Date(g.rangeStart.replace(/-/g, '/'));
      const endD = new Date(g.rangeEnd.replace(/-/g, '/'));
      if (startD.getFullYear() > year || endD.getFullYear() < year) return;
      const taskStart = new Date(g.startDate.replace(/-/g, '/'));
      const taskEnd = new Date(g.dueDate.replace(/-/g, '/'));
      const startMonth = taskStart.getFullYear() < year ? 0 : taskStart.getMonth();
      const endMonth = taskEnd.getFullYear() > year ? 11 : taskEnd.getMonth();
      const bar = document.createElement('div');
      bar.className = `absolute h-5 rounded-lg shadow-sm text-[10.5px] font-bold flex items-center px-2 cursor-pointer transition-all hover:scale-[1.01] pointer-events-auto truncate z-10 ${mainClass(g)}${dimIfNotCritical(g)}`;
      bar.style.left = `calc(${startMonth / 12 * 100}% + 4px)`;
      bar.style.width = `calc(${(endMonth - startMonth + 1) / 12 * 100}% - 8px)`;
      bar.style.top = `${g.globalLineStart * rowHeight + 10}px`;
      bar.onclick = () => openTaskModal(g.id);
      bar.innerHTML = `${getEffectiveStatus(g, todayStr) === 'OVERDUE' ? '🚨' : getEffectiveStatus(g, todayStr) === 'COMPLETED' ? '⭐️' : getEffectiveStatus(g, todayStr) === 'PROGRESS' ? '⚙️' : '⌛'} ${escapeHTML(g.title)}`;
      bindGanttTooltip(bar, g.title, `담당자: ${escapeHTML(g.assignee)}<br>기간: ${g.startDate} ~ ${g.dueDate}<br>설명: ${escapeHTML(g.notes || '없음')}`);
      overlay.appendChild(bar);
      if (showSubTaskBars) {
        g.subTasks.forEach((st, idx) => {
          const stStart = new Date(st.startDate.replace(/-/g, '/'));
          const stEnd = new Date(st.dueDate.replace(/-/g, '/'));
          if (stStart.getFullYear() > year || stEnd.getFullYear() < year) return;
          const sm = stStart.getFullYear() < year ? 0 : stStart.getMonth();
          const em = stEnd.getFullYear() > year ? 11 : stEnd.getMonth();
          const sb = document.createElement('div');
          sb.className = `absolute h-5 rounded-lg shadow-sm text-[9.5px] font-bold flex items-center px-1.5 cursor-pointer transition-all hover:scale-[1.01] pointer-events-auto truncate ${subClass(st)}${dimIfNotCritical({ ...st, isSub: true })}`;
          sb.style.left = `calc(${sm / 12 * 100}% + 4px)`;
          sb.style.width = `calc(${(em - sm + 1) / 12 * 100}% - 8px)`;
          sb.style.top = `${(g.globalLineStart + 1 + idx) * rowHeight + 10}px`;
          sb.onclick = () => openTaskModal(g.id);
          sb.innerHTML = `${isSubTaskOverdue(st, todayStr) ? '🚨' : getStatusIcon(st.status)} ↳ 👤 ${escapeHTML(st.assignee)} | ${escapeHTML(st.title)}`;
          bindGanttTooltip(sb, st.title, `상위 업무: ${escapeHTML(g.title)}<br>담당자: ${escapeHTML(st.assignee)}<br>기간: ${st.startDate} ~ ${st.dueDate}<br>상태: ${getStatusKorean(st.status)}`);
          overlay.appendChild(sb);
        });
      }
    });
    body.appendChild(overlay);
    grid.appendChild(body);
    return;
}
