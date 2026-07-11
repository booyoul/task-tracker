console.info('Smart Task Flow calendar-mobile-renderer.js v20260711-v1 loaded');

// ============================================================
//  모바일 전용 캘린더 렌더러
//  - 일별 뷰: 선택 월의 날짜별 업무 리스트 카드
//  - 월별 뷰: 12개월 업무 현황 요약 리스트
//  - 요약 뷰: 데스크탑 요약 뷰와 동일한 JS 함수 호출
// ============================================================

function renderMobileCalendar(filtered) {
  const content = document.getElementById('cal-mobile-content');
  const monthYearEl = document.getElementById('cal-mobile-month-year');
  if (!content) return;

  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();
  const todayStr = getTodayStr();
  const mode = currentCalMode || 'DAY';

  if (monthYearEl) {
    if (mode === 'MONTH') {
      monthYearEl.textContent = year + '년 년간 현황';
    } else if (mode === 'SUMMARY') {
      monthYearEl.textContent = year + '년 ' + (month + 1) + '월 요약';
    } else {
      monthYearEl.textContent = year + '년 ' + (month + 1) + '월';
    }
  }

  _updateMobileCalModeButtons(mode);

  content.innerHTML = '';
  if (mode === 'MONTH') {
    _renderMobileMonthView(content, filtered, year, todayStr);
  } else if (mode === 'SUMMARY') {
    if (typeof renderCalendarSummaryView === 'function') {
      renderCalendarSummaryView({ grid: content, year, month, filteredTasks: filtered, todayStr });
    } else {
      content.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">요약 뷰를 불러올 수 없습니다.</p>';
    }
  } else {
    _renderMobileDayView(content, filtered, year, month, todayStr);
  }
}

function _updateMobileCalModeButtons(mode) {
  const active = 'flex-1 rounded-lg bg-white px-2 py-2 text-slate-800 shadow-sm transition';
  const inactive = 'flex-1 rounded-lg px-2 py-2 text-slate-500 hover:text-slate-800 transition';
  const dayBtn = document.getElementById('btn-cal-mode-day-m');
  const monthBtn = document.getElementById('btn-cal-mode-month-m');
  const summaryBtn = document.getElementById('btn-cal-mode-summary-m');
  if (dayBtn) dayBtn.className = mode === 'DAY' ? active : inactive;
  if (monthBtn) monthBtn.className = mode === 'MONTH' ? active : inactive;
  if (summaryBtn) summaryBtn.className = mode === 'SUMMARY' ? active : inactive;
}

function _renderMobileDayView(container, filtered, year, month, todayStr) {
  const monthStr = year + '-' + String(month + 1).padStart(2, '0');
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = monthStr + '-01';
  const monthEnd = monthStr + '-' + String(daysInMonth).padStart(2, '0');

  // dayMap: dateStr -> Map(taskId -> { task: task, startSubTasks: [] })
  const dayMap = new Map();

  filtered.forEach(function(task) {
    const s = task.startDate || task.dueDate;
    const e = task.dueDate || task.startDate;
    if (!s || !e) return;

    // 1. 본 태스크가 이번 달에 걸쳐 있는 경우 (시작일에 매핑)
    if (s <= monthEnd && e >= monthStart) {
      const effectiveStart = s < monthStart ? monthStart : s;
      const displayDate = effectiveStart;
      
      if (!dayMap.has(displayDate)) {
        dayMap.set(displayDate, new Map());
      }
      const dateTasks = dayMap.get(displayDate);
      if (!dateTasks.has(task.id)) {
        dateTasks.set(task.id, { task: task, startSubTasks: [] });
      }
    }

    // 2. 이 달에 시작하는 서브 태스크가 있는 경우
    if (Array.isArray(task.subTasks)) {
      task.subTasks.forEach(function(st) {
        const subS = st.startDate || st.dueDate;
        if (subS && subS >= monthStart && subS <= monthEnd) {
          const displayDate = subS;
          if (!dayMap.has(displayDate)) {
            dayMap.set(displayDate, new Map());
          }
          const dateTasks = dayMap.get(displayDate);
          if (!dateTasks.has(task.id)) {
            dateTasks.set(task.id, { task: task, startSubTasks: [] });
          }
          dateTasks.get(task.id).startSubTasks.push(st);
        }
      });
    }
  });

  if (dayMap.size === 0) {
    container.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-center"><span class="text-4xl mb-3">📅</span><p class="text-sm font-semibold text-slate-500">이번 달 업무가 없습니다.</p><p class="text-xs text-slate-400 mt-1">다른 달을 선택하거나 새 업무를 추가해 주세요.</p></div>';
    return;
  }

  const sortedDates = Array.from(dayMap.keys()).sort();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  sortedDates.forEach(function(dateStr) {
    const dayNum = parseInt(dateStr.split('-')[2], 10);
    const dayOfWeek = new Date(dateStr.replace(/-/g, '/')).getDay();
    const isToday = dateStr === todayStr;
    const dayColor = dayOfWeek === 0 ? 'text-rose-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-slate-500';

    const dateHeader = document.createElement('div');
    dateHeader.className = 'flex items-center gap-2 mb-2 mt-4 first:mt-0';
    dateHeader.innerHTML = '<span class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shrink-0 ' + (isToday ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 ' + dayColor) + '">' + dayNum + '</span><span class="text-xs font-semibold ' + dayColor + '">' + dayNames[dayOfWeek] + '</span>' + (isToday ? '<span class="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">오늘</span>' : '') + '<div class="flex-1 h-px bg-slate-100"></div>';
    container.appendChild(dateHeader);

    const taskList = document.createElement('div');
    taskList.className = 'space-y-2';
    
    const dateTasksMap = dayMap.get(dateStr);
    dateTasksMap.forEach(function(entry) {
      taskList.appendChild(_buildMobileTaskCard(entry.task, entry.startSubTasks, todayStr));
    });
    container.appendChild(taskList);
  });
}

function _renderMobileMonthView(container, filtered, year, todayStr) {
  const today = new Date(todayStr.replace(/-/g, '/'));
  const yearStart = year + '-01-01';
  const yearEnd = year + '-12-31';

  // 1. 해당 연도에 걸쳐 있는 태스크 필터링 및 정렬
  const tasksInYear = filtered.filter(function(t) {
    const s = t.startDate || t.dueDate;
    const e = t.dueDate || t.startDate;
    return s && e && s <= yearEnd && e >= yearStart;
  });

  tasksInYear.sort(function(a, b) {
    const sA = a.startDate || a.dueDate || '';
    const sB = b.startDate || b.dueDate || '';
    return sA.localeCompare(sB);
  });

  // 2. 겹침 방지 알고리즘 (Lane Assignment)
  const lanes = [];
  const taskLanes = new Map();

  tasksInYear.forEach(function(task) {
    const s = task.startDate || task.dueDate;
    const e = task.dueDate || task.startDate;
    const sDate = new Date(s.replace(/-/g, '/'));
    const eDate = new Date(e.replace(/-/g, '/'));
    
    // 이 연도 내에서의 시작 월과 종료 월 계산 (0 ~ 11)
    const startMonth = sDate.getFullYear() < year ? 0 : sDate.getMonth();
    const endMonth = eDate.getFullYear() > year ? 11 : eDate.getMonth();
    
    let assignedLane = -1;
    for (let i = 0; i < lanes.length; i++) {
      if (startMonth > lanes[i]) {
        assignedLane = i;
        lanes[i] = endMonth;
        break;
      }
    }
    if (assignedLane === -1) {
      lanes.push(endMonth);
      assignedLane = lanes.length - 1;
    }
    taskLanes.set(task.id, { startMonth: startMonth, endMonth: endMonth, laneIndex: assignedLane });
  });

  const totalLanes = lanes.length > 0 ? lanes.length : 1;

  const ganttWrapper = document.createElement('div');
  ganttWrapper.className = 'flex flex-col w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm';
  
  const rowHeight = 48;
  const totalHeight = rowHeight * 12;

  let html = '';
  html += `
    <div class="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
      <span class="text-xs font-bold text-slate-700">${year}년 년간 스케줄 막대</span>
      <span class="text-[10px] text-slate-400 font-medium">총 ${tasksInYear.length}개 업무 진행</span>
    </div>
  `;

  html += `
    <div class="flex relative w-full overflow-hidden" style="height: ${totalHeight}px;">
      <!-- Y축 고정: 월 라벨 -->
      <div class="w-12 shrink-0 flex flex-col bg-slate-50/50 border-r border-slate-200 select-none h-full">
  `;
  for (let m = 1; m <= 12; m++) {
    const isCurrentM = today.getFullYear() === year && today.getMonth() + 1 === m;
    html += `
      <div class="flex-1 border-b border-slate-100 last:border-b-0 flex items-center justify-center cursor-pointer hover:bg-indigo-50 transition-colors"
           style="height: ${rowHeight}px;"
           onclick="currentCalDate.setMonth(${m - 1}); currentCalMode = 'DAY'; if (typeof renderActiveViews === 'function') renderActiveViews();">
        <span class="text-xs font-extrabold ${isCurrentM ? 'text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md' : 'text-slate-500'}">${m}월</span>
      </div>
    `;
  }
  html += `
      </div>
      
      <!-- 오른쪽 차트 영역 (가로 스크롤 없음, 100% 분할) -->
      <div class="flex-1 relative h-full bg-slate-50/10">
        <!-- 배경 그리드 가로선 -->
        <div class="absolute inset-0 flex flex-col pointer-events-none z-0">
  `;
  for (let m = 1; m <= 12; m++) {
    html += `<div class="flex-1 border-b border-slate-100/70 last:border-b-0" style="height: ${rowHeight}px;"></div>`;
  }
  html += `
        </div>
        
        <!-- 세로 막대 배치 영역 -->
        <div class="absolute inset-0 z-10 pointer-events-none">
  `;

  tasksInYear.forEach(function(task) {
    const tLane = taskLanes.get(task.id);
    if (!tLane) return;

    const sm = tLane.startMonth;
    const em = tLane.endMonth;
    const laneIdx = tLane.laneIndex;

    const top = sm * rowHeight;
    const height = (em - sm + 1) * rowHeight;
    
    const laneWidthPercent = 100 / totalLanes;
    
    // 본 태스크 크기 및 배치
    const mainBarWidth = 14;
    const mainLeftCalc = `calc(${(laneIdx + 1) * laneWidthPercent}% - ${mainBarWidth + 4}px)`;

    const eff = typeof getEffectiveStatus === 'function' ? getEffectiveStatus(task, todayStr) : (task.status || 'PENDING');
    
    // 데스크탑(app.js)의 mainClass 색상 배치 규칙과 일관성 유지
    const mainCls = (function(effective) {
      if (effective === 'OVERDUE') return 'bg-rose-100 text-rose-800 border-rose-200 font-semibold';
      if (effective === 'COMPLETED') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      if (effective === 'PROGRESS') return 'bg-blue-100 text-blue-800 border-blue-200';
      return 'bg-slate-200 text-slate-700 border-slate-300';
    })(eff);
    
    const assignees = Array.isArray(task.assignee) ? task.assignee.join(', ') : (task.assignee || '미지정');

    html += `
      <div class="absolute rounded-md shadow-sm text-[8px] font-bold cursor-pointer transition-all hover:scale-[1.05] pointer-events-auto border overflow-hidden flex flex-col items-center justify-start text-center p-1 ${mainCls}"
           style="left: ${mainLeftCalc}; width: ${mainBarWidth}px; top: ${top + 3}px; height: ${height - 6}px; writing-mode: vertical-rl; text-orientation: mixed; line-height: 1.1;"
           title="${escapeHTML(task.title || '')} (${assignees})"
           onclick="event.stopPropagation(); if (typeof openTaskModal === 'function') openTaskModal('${task.id}');">
        <span class="leading-none tracking-tighter break-all font-black block">
          ${escapeHTML(task.title || '')}
        </span>
      </div>
    `;

    // 서브 태스크들 (본 태스크 왼쪽에 나란히 배치)
    if (Array.isArray(task.subTasks)) {
      const subTasksInYear = task.subTasks.filter(function(st) {
        const stS = st.startDate || st.dueDate;
        const stE = st.dueDate || st.startDate;
        if (!stS || !stE) return false;
        const stSDate = new Date(stS.replace(/-/g, '/'));
        const stEDate = new Date(stE.replace(/-/g, '/'));
        return stSDate.getFullYear() <= year && stEDate.getFullYear() >= year;
      });

      subTasksInYear.forEach(function(st, idx) {
        const stS = st.startDate || st.dueDate;
        const stE = st.dueDate || st.startDate;
        const stSDate = new Date(stS.replace(/-/g, '/'));
        const stEDate = new Date(stE.replace(/-/g, '/'));

        const stSm = stSDate.getFullYear() < year ? 0 : stSDate.getMonth();
        const stEm = stEDate.getFullYear() > year ? 11 : stEDate.getMonth();

        const stTop = stSm * rowHeight;
        const stHeight = (stEm - stSm + 1) * rowHeight;

        const subBarWidth = 11;
        const subLeftOffset = mainBarWidth + 4 + (idx + 1) * (subBarWidth + 3);
        const subLeftCalc = `calc(${(laneIdx + 1) * laneWidthPercent}% - ${subLeftOffset}px)`;

        const stStatus = st.status || 'PENDING';
        // 데스크탑(app.js)의 subClass 색상 배치 규칙과 일관성 유지
        const stCls = (function(status, stItem) {
          const overdue = typeof isSubTaskOverdue === 'function' ? isSubTaskOverdue(stItem, todayStr) : false;
          if (status === 'COMPLETED') return 'bg-emerald-50/80 text-emerald-800 border-emerald-300 border-dashed';
          if (overdue) return 'bg-rose-50/90 text-rose-800 border-rose-300 border-dashed font-semibold';
          if (status === 'PROGRESS') return 'bg-blue-50/80 text-blue-800 border-blue-300 border-dashed';
          return 'bg-slate-50 text-slate-600 border-slate-300 border-dashed';
        })(stStatus, st);

        const subAssignees = Array.isArray(st.assignee) ? st.assignee.join(', ') : (st.assignee || '미지정');

        html += `
          <div class="absolute rounded-md shadow-sm text-[7.5px] font-medium cursor-pointer transition-all hover:scale-[1.05] pointer-events-auto border overflow-hidden flex flex-col items-center justify-start text-center p-0.5 ${stCls}"
               style="left: ${subLeftCalc}; width: ${subBarWidth}px; top: ${stTop + 3}px; height: ${stHeight - 6}px; writing-mode: vertical-rl; text-orientation: mixed; line-height: 1.1;"
               title="↳ 하위: ${escapeHTML(st.title || '')} (${subAssignees})"
               onclick="event.stopPropagation(); if (typeof openTaskModal === 'function') openTaskModal('${task.id}');">
            <span class="leading-none tracking-tighter break-all block">
              ${escapeHTML(st.title || '')}
            </span>
          </div>
        `;
      });
    }
  });

  html += `
        </div>
      </div>
    </div>
  `;

  ganttWrapper.innerHTML = html;
  container.appendChild(ganttWrapper);
}

function _buildMobileTaskCard(task, startSubTasks, todayStr) {
  const card = document.createElement('div');
  const eff = typeof getEffectiveStatus === 'function' ? getEffectiveStatus(task, todayStr) : (task.status || 'PENDING');
  const statusConfig = {
    COMPLETED: { icon: '✅', label: '완료', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    OVERDUE:   { icon: '🚨', label: '지연', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    PROGRESS:  { icon: '⚙️', label: '진행 중', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    PENDING:   { icon: '⌛', label: '대기', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  };
  const priorityConfig = {
    HIGH:   { label: '높음', cls: 'bg-rose-100 text-rose-700' },
    NORMAL: { label: '보통', cls: 'bg-slate-100 text-slate-600' },
    LOW:    { label: '낮음', cls: 'bg-slate-100 text-slate-400' },
  };
  const sc = statusConfig[eff] || statusConfig.PENDING;
  const pc = priorityConfig[(task.priority || 'NORMAL').toUpperCase()] || priorityConfig.NORMAL;
  const assignees = Array.isArray(task.assignee) ? task.assignee.join(', ') : (task.assignee || '미지정');
  const subCount = Array.isArray(task.subTasks) ? task.subTasks.length : 0;
  const subDone = Array.isArray(task.subTasks) ? task.subTasks.filter(function(st) { return (st.status || '').toUpperCase() === 'COMPLETED'; }).length : 0;

  let subTasksHtml = '';
  if (Array.isArray(startSubTasks) && startSubTasks.length > 0) {
    subTasksHtml += '<div class="border-t border-slate-100/80 pt-2 mt-2">';
    subTasksHtml += '<p class="text-[9px] font-bold text-indigo-600 mb-1.5 flex items-center gap-1"><span>↳</span> 오늘 시작하는 하위 작업</p>';
    subTasksHtml += '<div class="space-y-1.5">';
    startSubTasks.forEach(function(st) {
      const stEff = st.status || 'PENDING';
      const stSc = statusConfig[stEff] || statusConfig.PENDING;
      const stAssignee = Array.isArray(st.assignee) ? st.assignee.join(', ') : (st.assignee || '미지정');
      subTasksHtml += `
        <div class="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-xs shrink-0">${stSc.icon}</span>
            <span class="font-medium text-slate-700 truncate">${escapeHTML(st.title || '')}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0 ml-2">
            <span class="text-[9px] bg-slate-200 text-slate-600 px-1 py-0.2 rounded font-medium">👤 ${escapeHTML(stAssignee)}</span>
          </div>
        </div>
      `;
    });
    subTasksHtml += '</div></div>';
  }

  card.className = 'mobile-cal-card rounded-xl border bg-white p-3 shadow-sm cursor-pointer active:scale-[0.98] transition-all hover:shadow-md';
  card.onclick = function() { if (typeof openTaskModal === 'function') openTaskModal(task.id); };
  card.innerHTML = '<div class="flex items-start gap-2.5"><span class="text-lg leading-none mt-0.5 shrink-0">' + sc.icon + '</span><div class="flex-1 min-w-0"><p class="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">' + escapeHTML(task.title || '') + '</p><div class="flex flex-wrap items-center gap-1.5 mt-1.5"><span class="inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ' + sc.cls + '">' + sc.label + '</span><span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ' + pc.cls + '">' + pc.label + '</span>' + (subCount > 0 ? '<span class="rounded-full bg-indigo-50 text-indigo-600 px-2 py-0.5 text-[10px] font-semibold">하위 ' + subDone + '/' + subCount + '</span>' : '') + '</div><div class="flex items-center justify-between mt-2"><span class="text-[11px] text-slate-500 truncate">👤 ' + escapeHTML(assignees) + '</span><span class="text-[10px] text-slate-400 shrink-0 ml-2">' + (task.startDate ? task.startDate.substring(5) : '?') + ' ~ ' + (task.dueDate ? task.dueDate.substring(5) : '?') + '</span></div>' + subTasksHtml + '</div></div>';
  return card;
}

function initMobileCalendarEvents() {
  document.getElementById('btn-prev-month-mobile')?.addEventListener('click', function() {
    currentCalDate.setMonth(currentCalDate.getMonth() - 1);
    if (typeof renderActiveViews === 'function') renderActiveViews();
  });
  document.getElementById('btn-today-month-mobile')?.addEventListener('click', function() {
    currentCalDate = new Date();
    if (typeof renderActiveViews === 'function') renderActiveViews();
  });
  document.getElementById('btn-next-month-mobile')?.addEventListener('click', function() {
    currentCalDate.setMonth(currentCalDate.getMonth() + 1);
    if (typeof renderActiveViews === 'function') renderActiveViews();
  });
  document.getElementById('btn-cal-mode-day-m')?.addEventListener('click', function() {
    currentCalMode = 'DAY';
    if (typeof setCalMode === 'function') setCalMode('DAY');
    else if (typeof renderActiveViews === 'function') renderActiveViews();
  });
  document.getElementById('btn-cal-mode-month-m')?.addEventListener('click', function() {
    currentCalMode = 'MONTH';
    if (typeof setCalMode === 'function') setCalMode('MONTH');
    else if (typeof renderActiveViews === 'function') renderActiveViews();
  });
  document.getElementById('btn-cal-mode-summary-m')?.addEventListener('click', function() {
    currentCalMode = 'SUMMARY';
    if (typeof setCalMode === 'function') setCalMode('SUMMARY');
    else if (typeof renderActiveViews === 'function') renderActiveViews();
  });
}

document.addEventListener('DOMContentLoaded', initMobileCalendarEvents);
window.renderMobileCalendar = renderMobileCalendar;
