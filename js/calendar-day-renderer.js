console.info('Smart Task Flow calendar-day-renderer.js v20260805-v18 loaded');

function getCalendarProgressNoteDateKey(note = {}) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(note.noteDate || ''))) return note.noteDate;
    const createdAt = note.createdAt?.toDate ? note.createdAt.toDate() : new Date(note.createdAt || 0);
    if (Number.isNaN(createdAt.getTime())) return '';
    return `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`;
}

function getCalendarProgressNoteTitle(note = {}) {
    const title = String(note.title || '').trim();
    if (title) return title;
    const body = String(note.body || '').replace(/\s+/g, ' ').trim();
    return body ? body.slice(0, 40) : '제목 없는 메모';
}

function getCalendarProgressNotesForMonth(notes, taskList, year, month) {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const taskMap = new Map((taskList || []).map(task => [String(task.id || ''), task]));
    return (notes || []).flatMap(note => {
        const dateKey = getCalendarProgressNoteDateKey(note);
        if (!dateKey.startsWith(monthPrefix)) return [];
        const [baseTaskId, subTaskId = ''] = String(note.taskId || '').split('__sub_');
        const parentTask = taskMap.get(baseTaskId);
        if (!parentTask) return [];
        const subTasks = parentTask.subTasks || parentTask.monthSubTasks || [];
        const subTask = subTaskId ? subTasks.find(item => String(item.id || '') === subTaskId) : null;
        if (subTaskId && !subTask) return [];
        return [{
            ...note,
            taskTitle: parentTask.title || '알 수 없는 업무',
            subTaskTitle: subTask?.title || '',
            calendarDateKey: dateKey,
            calendarTaskLabel: subTask ? `${parentTask.title} › ${subTask.title}` : (parentTask.title || '알 수 없는 업무')
        }];
    }).sort((a, b) => {
        const dateDiff = a.calendarDateKey.localeCompare(b.calendarDateKey);
        if (dateDiff) return dateDiff;
        const aTime = typeof getListProgressNoteSortTime === 'function' ? getListProgressNoteSortTime(a) : 0;
        const bTime = typeof getListProgressNoteSortTime === 'function' ? getListProgressNoteSortTime(b) : 0;
        return aTime - bTime;
    });
}

function openCalendarProgressNote(note, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (typeof window.openNoteDetailPanel === 'function') window.openNoteDetailPanel(note);
}

// DAY calendar mini-Gantt renderer. Extracted from app.js in Phase 4B.
function renderCalendarDayView(ctx) {
    const { weekdayHeader, grid, year, month, todayStr, groups, monthNotes = [], monthTodos = [], notesOnly = false, showSubTaskBars, mainClass, dimIfNotCritical, useIndustryColor } = ctx;
    weekdayHeader?.classList.remove('hidden');
    grid.className = 'relative bg-white border border-slate-200 rounded-b-lg overflow-hidden';
    grid.innerHTML = '';

    const monthFirstStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    const fullCells = totalCells + remaining;
    const weekCount = Math.ceil(fullCells / 7);

    // DAY view uses a weekly mini-Gantt overlay.
    // Important: bars are drawn from the real start/end dates, clipped only by the visible month.
    // This makes sub tasks such as "6월 Review" run continuously from 7/1 to 7/3.
    const laneHeight = 22;
    const rowDateHeight = 34;
    const noteRowHeight = 20;
    const maxVisibleNoteRows = 3;
    const notesByDate = new Map();
    monthNotes.forEach(note => {
      const dateKey = note.calendarDateKey || getCalendarProgressNoteDateKey(note);
      if (!notesByDate.has(dateKey)) notesByDate.set(dateKey, []);
      notesByDate.get(dateKey).push(note);
    });
    const todosByDate = new Map();
    if (!notesOnly) monthTodos.forEach(todo => {
      const dateKey = todo.calendarDateKey || todo.startDate || '';
      if (!todosByDate.has(dateKey)) todosByDate.set(dateKey, []);
      todosByDate.get(dateKey).push(todo);
    });
    const weekBounds = Array.from({ length: weekCount }, (_, week) => {
      const weekCellStart = week * 7;
      const weekCellEnd = weekCellStart + 6;
      const startDay = Math.max(1, weekCellStart - firstDay + 1);
      const endDay = Math.min(daysInMonth, weekCellEnd - firstDay + 1);
      return {
        start: `${year}-${String(month + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
        end: `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
      };
    });
    const weekLayouts = weekBounds.map(({ start, end }) => {
      const activeLanes = new Set();
      if (!notesOnly) groups.forEach(g => {
        let groupHasVisibleItem = false;
        if (g.startDate <= end && g.dueDate >= start) {
          activeLanes.add(g.globalLineStart);
          groupHasVisibleItem = true;
        }
        if (showSubTaskBars) {
          (g.monthSubTasks || []).forEach((st, idx) => {
            if (st.startDate <= end && st.dueDate >= start) {
              activeLanes.add(g.globalLineStart + 1 + idx);
              groupHasVisibleItem = true;
            }
          });
        }
        if (groupHasVisibleItem && g.categoryHeaderLine != null) {
          activeLanes.add(g.categoryHeaderLine);
        }
      });
      const orderedLanes = Array.from(activeLanes).sort((a, b) => a - b);
      let maxEventsInDay = 0;
      for (let day = Number(start.slice(8, 10)); day <= Number(end.slice(8, 10)); day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const eventCount = (notesByDate.get(dateKey)?.length || 0) + (todosByDate.get(dateKey)?.length || 0);
        maxEventsInDay = Math.max(maxEventsInDay, eventCount);
      }
      const noteRows = Math.min(maxVisibleNoteRows, maxEventsInDay);
      const noteAreaHeight = noteRows * noteRowHeight;
      return {
        laneMap: new Map(orderedLanes.map((lane, index) => [lane, index])),
        laneCount: orderedLanes.length,
        noteAreaHeight,
        height: rowDateHeight + noteAreaHeight + orderedLanes.length * laneHeight + 14
      };
    });
    const weekOffsets = [];
    weekLayouts.reduce((offset, layout, week) => {
      weekOffsets[week] = offset;
      return offset + layout.height;
    }, 0);
    grid.dataset.weekLaneCounts = weekLayouts.map(layout => layout.laneCount).join(',');
    grid.dataset.notesOnly = String(notesOnly);

    const plate = document.createElement('div');
    plate.className = 'grid grid-cols-7 gap-px bg-slate-200 relative z-0';
    for (let cellIndex = 0; cellIndex < fullCells; cellIndex++) {
      const day = cellIndex - firstDay + 1;
      const dayOfWeek = cellIndex % 7;
      const dateStr = day >= 1 && day <= daysInMonth ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
      const cell = document.createElement('div');
      cell.className = `${dateStr ? 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80' : 'bg-slate-50 dark:bg-slate-950'} relative transition-colors border-r border-b border-slate-100 dark:border-slate-800`;
      cell.style.height = `${weekLayouts[Math.floor(cellIndex / 7)].height}px`;
      cell.innerHTML = dateStr
        ? `<div class="p-1.5"><span class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${dateStr === todayStr ? 'bg-indigo-600 text-white shadow-sm' : dayOfWeek === 0 ? 'text-rose-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-slate-600 dark:text-slate-300'}">${day}</span></div>`
        : '';
      const dayNotes = notesByDate.get(dateStr) || [];
      const dayTodos = todosByDate.get(dateStr) || [];
      const noteAreaHeight = weekLayouts[Math.floor(cellIndex / 7)].noteAreaHeight;
      if (dateStr && noteAreaHeight > 0) {
        const noteList = document.createElement('div');
        noteList.className = 'absolute inset-x-1 top-[32px] z-20 space-y-0.5 overflow-y-auto pointer-events-auto';
        noteList.style.maxHeight = `${noteAreaHeight}px`;
        dayNotes.forEach(note => {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.calendarNoteId = String(note.id || '');
          button.dataset.calendarNoteDate = dateStr;
          button.className = 'flex h-[18px] w-full items-center gap-1 rounded bg-amber-50 px-1 text-left text-[10px] font-semibold text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:bg-amber-950/45 dark:text-amber-200 dark:hover:bg-amber-900/60';
          button.innerHTML = `<span aria-hidden="true">📌</span><span class="truncate">${escapeHTML(getCalendarProgressNoteTitle(note))}</span>`;
          button.title = `${note.calendarTaskLabel || ''} · ${getCalendarProgressNoteTitle(note)}`;
          button.setAttribute('aria-label', `${dateStr} 메모 보기: ${getCalendarProgressNoteTitle(note)}`);
          button.addEventListener('click', event => openCalendarProgressNote(note, event));
          noteList.appendChild(button);
        });
        dayTodos.forEach(todo => {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.calendarTodoId = String(todo.id || '');
          button.dataset.calendarTodoDate = dateStr;
          button.className = `flex h-[18px] w-full items-center gap-1 rounded px-1 text-left text-[10px] font-semibold transition hover:bg-violet-100 focus:outline-none focus:ring-1 focus:ring-violet-400 dark:hover:bg-violet-900/60 ${todo.completed ? 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-400' : 'bg-violet-50 text-violet-800 dark:bg-violet-950/45 dark:text-violet-200'}`;
          button.innerHTML = `<span aria-hidden="true">${todo.completed ? '☑' : '☐'}</span><span class="truncate">${escapeHTML(todo.title || '제목 없는 To-do')}</span>`;
          button.title = `${todo.calendarTaskLabel || ''} · ${todo.startDate} ~ ${todo.dueDate}`;
          button.setAttribute('aria-label', `${dateStr} To-do 열기: ${todo.title || '제목 없는 To-do'}`);
          button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            window.openTodoModal?.(todo.id);
          });
          noteList.appendChild(button);
        });
        cell.appendChild(noteList);
      }
      plate.appendChild(cell);
    }
    grid.appendChild(plate);

    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 z-10 pointer-events-none';

    const clampDateStr = (value, min, max) => {
      const v = String(value || min);
      if (v < min) return min;
      if (v > max) return max;
      return v;
    };
    const dayNumber = dateStr => Number(String(dateStr).slice(8, 10));
    const barLabel = item => {
      const labelAssignees = Array.isArray(item.assignee) ? item.assignee.join(', ') : (item.assignee || '미지정');
      return item.isSub
        ? `${isSubTaskOverdue(item, todayStr) ? '🚨' : getStatusIcon(item.status)} ↳ 👤 ${escapeHTML(labelAssignees)} | ${escapeHTML(item.title)}`
        : `${getEffectiveStatus(item, todayStr) === 'OVERDUE' ? '🚨' : getStatusIcon(getEffectiveStatus(item, todayStr))} ${escapeHTML(item.title)}${item.subCount && !showSubTaskBars ? ` · 하위 ${item.subCount}` : ''}`;
    };
    const polishedSubClass = item => normalizeStatus(item.status) === 'COMPLETED'
      ? 'bg-emerald-100/90 text-emerald-800 border border-emerald-200'
      : normalizeStatus(item.status) === 'CANCELLED'
        ? 'bg-slate-100/90 text-slate-500 border border-slate-200 opacity-70'
      : isSubTaskOverdue(item, todayStr)
        ? 'bg-rose-100/90 text-rose-800 border border-rose-200 font-semibold'
        : useIndustryColor
          ? getIndustryBarClass(item, true)
          : normalizeStatus(item.status) === 'PROGRESS'
            ? 'bg-sky-100/90 text-sky-800 border border-sky-200'
            : 'bg-indigo-50/95 text-indigo-800 border border-indigo-200';

    const drawWeekFragment = item => {
      // Clip to the selected month, but preserve the actual task range inside the month.
      const displayStart = clampDateStr(item.start, monthFirstStr, lastDayStr);
      const displayEnd = clampDateStr(item.end, monthFirstStr, lastDayStr);
      const startDay = dayNumber(displayStart);
      const endDay = dayNumber(displayEnd);
      if (!startDay || !endDay || startDay > daysInMonth || endDay < 1 || startDay > endDay) return;

      for (let week = 0; week < weekCount; week++) {
        const weekCellStart = week * 7;
        const weekCellEnd = weekCellStart + 6;
        const weekStartDay = Math.max(1, weekCellStart - firstDay + 1);
        const weekEndDay = Math.min(daysInMonth, weekCellEnd - firstDay + 1);
        const segStartDay = Math.max(startDay, weekStartDay);
        const segEndDay = Math.min(endDay, weekEndDay);
        if (segStartDay > segEndDay) continue;

        const startCol = (firstDay + segStartDay - 1) % 7;
        const endCol = (firstDay + segEndDay - 1) % 7;
        const startsAtWeekStart = segStartDay === weekStartDay;
        const endsAtWeekEnd = segEndDay === weekEndDay;
        const isRealStart = segStartDay === startDay;
        const isRealEnd = segEndDay === endDay;
        const showText = isRealStart || startsAtWeekStart || segStartDay === 1 || `${year}-${String(month + 1).padStart(2, '0')}-${String(segStartDay).padStart(2, '0')}` === todayStr;
        const compactLane = weekLayouts[week].laneMap.get(item.lane);
        if (compactLane == null) continue;

        const bar = document.createElement('div');
        const elClassStatus = item.isSub ? polishedSubClass(item) : mainClass(item);
        bar.className = `absolute h-5 shadow-sm text-[10px] leading-none font-semibold flex items-center cursor-pointer transition-all hover:scale-[1.01] pointer-events-auto truncate ${elClassStatus}${dimIfNotCritical(item)}`;
        bar.classList.add(isRealStart || startsAtWeekStart ? 'rounded-l-lg' : 'rounded-l-sm');
        bar.classList.add(isRealEnd || endsAtWeekEnd ? 'rounded-r-lg' : 'rounded-r-sm');
        // Use exact day-cell fractions. Start/end padding only trims the outer edge; middle fragments touch cell borders.
        const leftPad = (isRealStart || startsAtWeekStart) ? 4 : 0;
        const rightPad = (isRealEnd || endsAtWeekEnd) ? 4 : 0;
        bar.style.left = `calc(${startCol / 7 * 100}% + ${leftPad}px)`;
        bar.style.width = `calc(${(endCol - startCol + 1) / 7 * 100}% - ${leftPad + rightPad}px)`;
        bar.style.top = `${weekOffsets[week] + rowDateHeight + weekLayouts[week].noteAreaHeight + compactLane * laneHeight}px`;
        bar.dataset.weekIndex = String(week);
        bar.dataset.logicalLane = String(item.lane);
        bar.dataset.compactLane = String(compactLane);
        bar.style.paddingLeft = item.isSub ? '10px' : '8px';
        bar.style.paddingRight = '8px';
        bar.onclick = () => openTaskModal(item.parentId);
        const detailAssignees = Array.isArray(item.assignee) ? item.assignee.join(', ') : (item.assignee || '미지정');
        bindGanttTooltip(bar, item.title, item.isSub
          ? `[하위업무] 상위: ${escapeHTML(item.parentTitle)}<br>담당자: ${escapeHTML(detailAssignees)}<br>기간: ${item.start} ~ ${item.end}<br>상태: ${getStatusKorean(item.status)}<br>업무 분류: ${escapeHTML(getTaskCategoryLabel(item))}`
          : `[본업무] 담당자: ${escapeHTML(detailAssignees)}<br>기간: ${item.start} ~ ${item.end}<br>진척: ${item.progressPct ?? 0}% · 하위 ${item.subDone ?? 0}/${item.subCount ?? 0}<br>Risk: ${getTaskRiskInfo(item, todayStr).label}${getTaskRiskInfo(item, todayStr).delay ? ' D+' + getTaskRiskInfo(item, todayStr).delay : ''}<br>업무 분류: ${escapeHTML(getTaskCategoryLabel(item))}<br>메모: ${escapeHTML(item.notes || '없음')}`);
        if (showText) bar.innerHTML = `<span class="truncate">${barLabel(item)}</span>`;
        overlay.appendChild(bar);
      }
    };

    if (!notesOnly) {
      const renderedCategoryLabels = new Set();
      groups.forEach(g => {
        if (g.categoryHeaderLine == null || renderedCategoryLabels.has(g.categoryGroupKey)) return;
        renderedCategoryLabels.add(g.categoryGroupKey);
        for (let week = 0; week < weekCount; week++) {
          const compactHeaderLane = weekLayouts[week].laneMap.get(g.categoryHeaderLine);
          if (compactHeaderLane == null) continue;

          const label = document.createElement('div');
          label.dataset.calendarCategoryHeader = g.categoryGroupKey;
          label.className = 'absolute z-20 pointer-events-none rounded-md bg-indigo-700/90 px-2 py-0.5 text-[10px] font-black text-white shadow-sm';
          label.style.left = '4px';
          label.style.top = `${weekOffsets[week] + rowDateHeight + weekLayouts[week].noteAreaHeight + compactHeaderLane * laneHeight + 1}px`;
          label.style.maxWidth = 'calc(100% - 8px)';
          label.textContent = `${g.categoryGroupLabel} · 본 업무 ${g.categoryTaskCount}개`;
          overlay.appendChild(label);
        }
      });
    }

    if (!notesOnly) groups.forEach(g => {
      // Main task bar
      if (g.startDate <= lastDayStr && g.dueDate >= monthFirstStr) {
        drawWeekFragment({ id: g.id, title: g.title, isSub: false, status: g.status, priority: g.priority, industry: g.industry, industryLabel: g.industryLabel, taskType: g.taskType, lane: g.globalLineStart, start: g.startDate, end: g.dueDate, parentId: g.id, assignee: g.assignee, notes: g.notes, dueDate: g.dueDate, subCount: getSubTaskCompletionCounts(g.monthSubTasks || []).active, subDone: getSubTaskCompletionCounts(g.monthSubTasks || []).completed, progressPct: getTaskProgress(g) });
      }
      // Stable sub-task lane within the current month. Do not calculate by visible day; calculate once per month.
      if (showSubTaskBars) {
        const daySubTasks = g.monthSubTasks || [];
        const subLaneMap = new Map(daySubTasks.map((st, idx) => [st.id || `${st.title}-${idx}`, g.globalLineStart + 1 + idx]));
        daySubTasks.forEach((st, idx) => {
          drawWeekFragment({ ...st, isSub: true, lane: subLaneMap.get(st.id || `${st.title}-${idx}`), start: st.startDate, end: st.dueDate, parentId: g.id, parentTitle: g.title });
        });
      }
    });

    grid.appendChild(overlay);
    return;
}
