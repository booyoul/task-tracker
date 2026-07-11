console.info('Smart Task Flow calendar-mobile-renderer.js v20260711-v16 loaded');

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
      monthYearEl.textContent = year + '년 연간 현황';
    } else if (mode === 'SUMMARY') {
      monthYearEl.textContent = year + '년 ' + (month + 1) + '월 요약';
    } else {
      monthYearEl.textContent = year + '년 ' + (month + 1) + '월';
    }
  }

  _updateMobileCalModeButtons(mode);

  content.innerHTML = '';
  if (mode === 'MONTH') {
    const containerWidth = content.clientWidth || 320;
    _renderMobileMonthView(content, filtered, year, todayStr, containerWidth);
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

function _renderMobileMonthView(container, filtered, year, todayStr, containerWidth) {
  const today = new Date(todayStr.replace(/-/g, '/'));
  const yearStart = year + '-01-01';
  const yearEnd = year + '-12-31';
  const useIndustryColor = !!(window.calendarUxState && window.calendarUxState.colorByIndustry);
  const showSubTaskBars = !(window.calendarUxState && window.calendarUxState.subtasksExpanded === false);

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

  if (tasksInYear.length === 0) {
    container.innerHTML = '<div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm"><span class="text-4xl mb-3">📅</span><p class="text-sm font-semibold text-slate-500">해당 연도의 업무가 없습니다.</p><p class="text-xs text-slate-400 mt-1">다른 연도로 이동하거나 새 업무를 추가해 주세요.</p></div>';
    return;
  }

  const getTaskTone = function(task) {
    const eff = typeof getEffectiveStatus === 'function' ? getEffectiveStatus(task, todayStr) : (task.status || 'PENDING');
    if (eff === 'OVERDUE') return 'bg-rose-100 text-rose-800 border border-rose-200 font-semibold';
    if (eff === 'COMPLETED') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    if (useIndustryColor && typeof getIndustryBarClass === 'function') return getIndustryBarClass(task, false);
    if (eff === 'PROGRESS') return 'bg-blue-100 text-blue-800 border border-blue-200';
    return 'bg-slate-200 text-slate-700 border border-slate-300';
  };

  const getSubTaskTone = function(st, parent) {
    const status = typeof normalizeStatus === 'function' ? normalizeStatus(st.status) : (st.status || 'PENDING');
    if (typeof isSubTaskOverdue === 'function' && isSubTaskOverdue(st, todayStr)) return 'bg-rose-50/90 text-rose-800 border border-dashed border-rose-300 font-semibold';
    if (status === 'COMPLETED') return 'bg-emerald-50/80 text-emerald-800 border border-dashed border-emerald-300';
    if (useIndustryColor && typeof getIndustryBarClass === 'function') return getIndustryBarClass(parent || st, true);
    if (status === 'PROGRESS') return 'bg-blue-50/80 text-blue-800 border border-dashed border-blue-300';
    return 'bg-slate-50 text-slate-700 border border-dashed border-slate-300';
  };

  const getTaskIcon = function(task) {
    const eff = typeof getEffectiveStatus === 'function' ? getEffectiveStatus(task, todayStr) : (task.status || 'PENDING');
    if (eff === 'OVERDUE') return '🚨';
    if (eff === 'COMPLETED') return '⭐️';
    if (eff === 'PROGRESS') return '⚙️';
    return '⌛';
  };

  const getSubTaskIcon = function(st) {
    if (typeof isSubTaskOverdue === 'function' && isSubTaskOverdue(st, todayStr)) return '🚨';
    if (typeof getStatusIcon === 'function') return getStatusIcon(st.status);
    if (st.status === 'COMPLETED') return '⭐️';
    if (st.status === 'PROGRESS') return '⚙️';
    return '⌛';
  };

  const denseTaskLimit = 12;
  const isDenseYear = tasksInYear.length > denseTaskLimit;
  const getDisplayRank = function(task) {
    const eff = typeof getEffectiveStatus === 'function' ? getEffectiveStatus(task, todayStr) : (task.status || 'PENDING');
    if (eff === 'OVERDUE') return 0;
    if ((task.priority || '').toUpperCase() === 'HIGH') return 1;
    if (eff === 'PROGRESS') return 2;
    if (eff === 'PENDING') return 3;
    return 4;
  };
  let displayedTasks = isDenseYear
    ? [...tasksInYear].sort(function(a, b) {
        const rankDiff = getDisplayRank(a) - getDisplayRank(b);
        if (rankDiff) return rankDiff;
        const dueA = a.dueDate || a.startDate || '';
        const dueB = b.dueDate || b.startDate || '';
        return dueA.localeCompare(dueB);
      }).slice(0, denseTaskLimit)
    : tasksInYear;
  let usesCompactYear = isDenseYear;
  let hideSubTaskBarsForFit = false;

  const getSubTasksInYear = function(task) {
    return showSubTaskBars && Array.isArray(task.subTasks) ? task.subTasks.filter(function(st) {
      const stS = st.startDate || st.dueDate;
      const stE = st.dueDate || st.startDate;
      if (!stS || !stE) return false;
      const stSDate = new Date(stS.replace(/-/g, '/'));
      const stEDate = new Date(stE.replace(/-/g, '/'));
      return stSDate.getFullYear() <= year && stEDate.getFullYear() >= year;
    }) : [];
  };

  const axisWidth = 46;
  const horizontalPadding = 24;
  const chartWidth = Math.max(220, (containerWidth || 320) - axisWidth - horizontalPadding);
  const startOffset = 14;
  const endPadding = 10;
  const barGap = 3;
  const minBarThickness = 10;

  let subTasksByTaskId = new Map();
  let maxBarsInGroup = 1;
  const buildSubTaskLayout = function(allowSubTaskBars) {
    const map = new Map();
    let maxBars = 1;
    displayedTasks.forEach(function(task) {
      const visibleSubTasks = allowSubTaskBars ? getSubTasksInYear(task) : [];
      map.set(task.id, visibleSubTasks);
      maxBars = Math.max(maxBars, 1 + visibleSubTasks.length);
    });
    subTasksByTaskId = map;
    maxBarsInGroup = maxBars;
  };

  const buildLaneLayout = function(tasksForLayout) {
    const lanes = [];
    const taskLanes = new Map();

    tasksForLayout.forEach(function(task) {
      const s = task.startDate || task.dueDate;
      const e = task.dueDate || task.startDate;
      const sDate = new Date(s.replace(/-/g, '/'));
      const eDate = new Date(e.replace(/-/g, '/'));

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

    return { taskLanes: taskLanes, totalLanes: lanes.length > 0 ? lanes.length : 1 };
  };

  const estimateLayoutWidth = function(totalLaneCount, barsInGroup) {
    const gap = totalLaneCount > 1 ? 12 : 0;
    const groupWidthForEstimate = barsInGroup * minBarThickness + (barsInGroup - 1) * barGap;
    return startOffset + endPadding + (totalLaneCount * groupWidthForEstimate) + (gap * Math.max(0, totalLaneCount - 1));
  };

  buildSubTaskLayout(showSubTaskBars);

  const goToMonthDayView = function(monthIndex) {
    currentCalDate.setMonth(monthIndex);
    if (typeof setCalMode === 'function') setCalMode('DAY');
    else {
      currentCalMode = 'DAY';
      if (typeof renderActiveViews === 'function') renderActiveViews();
    }
  };

  // 2. 겹침 방지 알고리즘 (Lane Assignment)
  let laneLayout = buildLaneLayout(displayedTasks);
  if (estimateLayoutWidth(laneLayout.totalLanes, maxBarsInGroup) > chartWidth) {
    usesCompactYear = true;
    hideSubTaskBarsForFit = true;
    buildSubTaskLayout(false);
    laneLayout = buildLaneLayout(displayedTasks);
  }

  if (estimateLayoutWidth(laneLayout.totalLanes, maxBarsInGroup) > chartWidth) {
    const maxMainBars = Math.max(6, Math.min(denseTaskLimit, Math.floor((chartWidth - startOffset - endPadding + 12) / (minBarThickness + 12))));
    displayedTasks = [...tasksInYear].sort(function(a, b) {
      const rankDiff = getDisplayRank(a) - getDisplayRank(b);
      if (rankDiff) return rankDiff;
      const dueA = a.dueDate || a.startDate || '';
      const dueB = b.dueDate || b.startDate || '';
      return dueA.localeCompare(dueB);
    }).slice(0, maxMainBars);
    buildSubTaskLayout(false);
    laneLayout = buildLaneLayout(displayedTasks);
  }

  const taskLanes = laneLayout.taskLanes;
  const totalLanes = laneLayout.totalLanes;

  // 3. 모바일 세로형 간트: 데스크탑의 막대 질감은 유지하고, 월 축만 세로로 전환
  const groupGap = totalLanes > 1 ? 12 : 0;
  const availableWidth = Math.max(120, chartWidth - startOffset - endPadding - groupGap * Math.max(0, totalLanes - 1));
  const rawBarThickness = (availableWidth / totalLanes - barGap * (maxBarsInGroup - 1)) / maxBarsInGroup;
  const barThickness = Math.max(minBarThickness, Math.min(22, Math.floor(rawBarThickness)));
  const groupWidth = maxBarsInGroup * barThickness + (maxBarsInGroup - 1) * barGap;
  const laneSlotWidth = groupWidth + groupGap;

  container.innerHTML = '';

  const ganttWrapper = document.createElement('div');
  ganttWrapper.className = 'w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm';
  
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50 px-3.5 py-3 shadow-sm';
  header.innerHTML = `
    <span class="text-xs font-bold text-slate-700">${year}년 연간 타임라인</span>
    <span class="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">${displayedTasks.length < tasksInYear.length ? `주요 ${displayedTasks.length}/${tasksInYear.length}` : (hideSubTaskBarsForFit ? `총 ${tasksInYear.length}개 · 본 업무` : `총 ${tasksInYear.length}개`)}</span>
  `;
  ganttWrapper.appendChild(header);

  const rowHeight = 46;
  const totalHeight = rowHeight * 12;

  const chartBody = document.createElement('div');
  chartBody.className = 'flex relative w-full overflow-hidden';
  chartBody.style.height = `${totalHeight}px`;

  // 5. Y축 월 라벨 영역
  const yAxis = document.createElement('div');
  yAxis.className = 'w-[46px] shrink-0 flex flex-col bg-slate-50 border-r border-slate-200 select-none h-full';
  for (let m = 1; m <= 12; m++) {
    const isCurrentM = today.getFullYear() === year && today.getMonth() + 1 === m;
    const mLabel = document.createElement('div');
    mLabel.className = 'flex-1 border-b border-slate-100 last:border-b-0 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors';
    mLabel.style.height = `${rowHeight}px`;
    mLabel.title = `${m}월 일별 보기로 이동`;
    mLabel.innerHTML = `<span class="text-[11px] font-extrabold ${isCurrentM ? 'rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-indigo-600' : 'text-slate-500'}">${m}월</span>`;
    mLabel.onclick = function() {
      goToMonthDayView(m - 1);
    };
    yAxis.appendChild(mLabel);
  }
  chartBody.appendChild(yAxis);

  // 6. 오른쪽 차트 영역
  const chartArea = document.createElement('div');
  chartArea.className = 'flex-1 relative h-full bg-white';

  // 7. 클릭 가능한 가로 행 배경
  const bgGrid = document.createElement('div');
  bgGrid.className = 'absolute inset-0 flex flex-col z-0';
  for (let m = 1; m <= 12; m++) {
    const rowEl = document.createElement('div');
    const isCurrentM = today.getFullYear() === year && today.getMonth() + 1 === m;
    rowEl.className = 'flex-1 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors ' + (isCurrentM ? 'bg-indigo-50/35' : 'hover:bg-slate-50');
    rowEl.style.height = `${rowHeight}px`;
    rowEl.title = `${m}월 일별 보기로 이동`;
    rowEl.onclick = function() {
      goToMonthDayView(m - 1);
    };
    bgGrid.appendChild(rowEl);
  }
  chartArea.appendChild(bgGrid);

  // 8. 막대 배치 영역
  const barContainer = document.createElement('div');
  barContainer.className = 'absolute inset-0 z-10 pointer-events-none';

  displayedTasks.forEach(function(task) {
    const tLane = taskLanes.get(task.id);
    if (!tLane) return;

    const sm = tLane.startMonth;
    const em = tLane.endMonth;
    const laneIdx = tLane.laneIndex;

    const top = sm * rowHeight;
    const height = (em - sm + 1) * rowHeight;
    
    const subTasksInYear = subTasksByTaskId.get(task.id) || [];
    const laneLeft = startOffset + laneIdx * laneSlotWidth;
    const mainLeft = laneLeft + subTasksInYear.length * (barThickness + barGap);
    const assignees = Array.isArray(task.assignee) ? task.assignee.join(', ') : (task.assignee || '미지정');
    const mainCls = getTaskTone(task);
    const statusIcon = getTaskIcon(task);

    const mainBar = document.createElement('div');
    mainBar.className = `absolute rounded-lg shadow-sm text-[10.5px] font-bold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] pointer-events-auto flex items-center pl-3 pr-2 ${mainCls}`;
    mainBar.style.width = `${height - 6}px`;
    mainBar.style.height = `${barThickness}px`;
    mainBar.style.top = `${top + 3}px`;
    mainBar.style.left = `${mainLeft + barThickness}px`;
    mainBar.style.transformOrigin = 'top left';
    mainBar.style.transform = 'rotate(90deg)';
    mainBar.style.overflow = 'hidden';
    mainBar.title = `${task.title || ''} · 담당자: ${assignees} · ${task.startDate || '?'} ~ ${task.dueDate || '?'}`;
    mainBar.onclick = function(e) {
      e.stopPropagation();
      if (typeof openTaskModal === 'function') openTaskModal(task.id);
    };

    // 데스크탑과 동일 텍스트 포맷 (flex-1 min-w-0 truncate 구조 적용)
    mainBar.innerHTML = `<span class="flex-1 min-w-0 truncate text-left">${statusIcon} ${escapeHTML(task.title || '')}</span>`;
    barContainer.appendChild(mainBar);

    // 서브 태스크들 DOM 생성
    subTasksInYear.forEach(function(st, idx) {
      const stS = st.startDate || st.dueDate;
      const stE = st.dueDate || st.startDate;
      const stSDate = new Date(stS.replace(/-/g, '/'));
      const stEDate = new Date(stE.replace(/-/g, '/'));

      const stSm = stSDate.getFullYear() < year ? 0 : stSDate.getMonth();
      const stEm = stEDate.getFullYear() > year ? 11 : stEDate.getMonth();

      const stTop = stSm * rowHeight;
      const stHeight = (stEm - stSm + 1) * rowHeight;

      const subLeft = laneLeft + idx * (barThickness + barGap);
      const stCls = getSubTaskTone(st, task);

      const subAssignees = Array.isArray(st.assignee) ? st.assignee.join(', ') : (st.assignee || '미지정');
      const stStatusIcon = getSubTaskIcon(st);

      // 서브태스크도 동일하게 보정: (left = subLeft + subBarWidth) 배치 후 90도 회전
      const subBar = document.createElement('div');
      subBar.className = `absolute rounded-lg shadow-sm text-[9.5px] font-bold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] pointer-events-auto flex items-center pl-2.5 pr-1.5 ${stCls}`;
      subBar.style.width = `${stHeight - 6}px`;
      subBar.style.height = `${barThickness}px`;
      subBar.style.top = `${stTop + 3}px`;
      subBar.style.left = `${subLeft + barThickness}px`;
      subBar.style.transformOrigin = 'top left';
      subBar.style.transform = 'rotate(90deg)';
      subBar.style.overflow = 'hidden';
      subBar.title = `↳ 하위: ${st.title || ''} · 담당자: ${subAssignees} · ${st.startDate || '?'} ~ ${st.dueDate || '?'}`;
      subBar.onclick = function(e) {
        e.stopPropagation();
        if (typeof openTaskModal === 'function') openTaskModal(task.id);
      };

      subBar.innerHTML = `<span class="flex-1 min-w-0 truncate text-left">${stStatusIcon} ↳ 👤 ${escapeHTML(subAssignees)} | ${escapeHTML(st.title || '')}</span>`;
      barContainer.appendChild(subBar);
    });
  });

  chartArea.appendChild(barContainer);
  chartBody.appendChild(chartArea);
  ganttWrapper.appendChild(chartBody);
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
