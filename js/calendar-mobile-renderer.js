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

  const tasksInMonth = filtered.filter(function(t) {
    const s = t.startDate || t.dueDate;
    const e = t.dueDate || t.startDate;
    return s && e && s <= monthEnd && e >= monthStart;
  });

  if (tasksInMonth.length === 0) {
    container.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-center"><span class="text-4xl mb-3">📅</span><p class="text-sm font-semibold text-slate-500">이번 달 업무가 없습니다.</p><p class="text-xs text-slate-400 mt-1">다른 달을 선택하거나 새 업무를 추가해 주세요.</p></div>';
    return;
  }

  const dayMap = new Map();
  tasksInMonth.forEach(function(task) {
    const s = task.startDate || task.dueDate;
    const e = task.dueDate || task.startDate;
    if (!s || !e) return;
    const effectiveStart = s < monthStart ? monthStart : s;
    const displayDate = effectiveStart;
    if (!dayMap.has(displayDate)) dayMap.set(displayDate, []);
    dayMap.get(displayDate).push(task);
  });

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
    dayMap.get(dateStr).forEach(function(task) {
      taskList.appendChild(_buildMobileTaskCard(task, todayStr));
    });
    container.appendChild(taskList);
  });
}

function _renderMobileMonthView(container, filtered, year, todayStr) {
  const today = new Date(todayStr.replace(/-/g, '/'));
  for (let m = 1; m <= 12; m++) {
    const monthStart = year + '-' + String(m).padStart(2, '0') + '-01';
    const daysInM = new Date(year, m, 0).getDate();
    const monthEnd = year + '-' + String(m).padStart(2, '0') + '-' + String(daysInM).padStart(2, '0');
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === m;

    const tasksInM = filtered.filter(function(t) {
      const s = t.startDate || t.dueDate;
      const e = t.dueDate || t.startDate;
      return s && e && s <= monthEnd && e >= monthStart;
    });

    const total = tasksInM.length;
    const completed = tasksInM.filter(function(t) { return (t.status || '').toUpperCase() === 'COMPLETED'; }).length;
    const overdue = tasksInM.filter(function(t) {
      const eff = typeof getEffectiveStatus === 'function' ? getEffectiveStatus(t, todayStr) : t.status;
      return eff === 'OVERDUE';
    }).length;
    const progress = tasksInM.filter(function(t) { return (t.status || '').toUpperCase() === 'PROGRESS'; }).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const monthCard = document.createElement('div');
    monthCard.className = 'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm mb-2 ' + (isCurrentMonth ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-100 bg-white hover:bg-slate-50');
    monthCard.onclick = (function(mo) { return function() {
      currentCalDate.setMonth(mo - 1);
      currentCalMode = 'DAY';
      if (typeof renderActiveViews === 'function') renderActiveViews();
    }; })(m);

    monthCard.innerHTML = '<div class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ' + (isCurrentMonth ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600') + '"><span class="text-sm font-bold">' + m + '월</span></div><div class="flex-1 min-w-0"><div class="flex items-center justify-between mb-1"><span class="text-xs font-semibold text-slate-700">전체 ' + total + '건</span><span class="text-[10px] font-bold ' + (pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-slate-400') + '">' + pct + '% 완료</span></div><div class="w-full bg-slate-100 rounded-full h-1.5"><div class="bg-indigo-500 h-1.5 rounded-full" style="width:' + pct + '%"></div></div><div class="flex gap-2 mt-1">' + (progress > 0 ? '<span class="text-[10px] text-blue-600">⚙️ 진행 ' + progress + '</span>' : '') + (overdue > 0 ? '<span class="text-[10px] text-rose-600">🚨 지연 ' + overdue + '</span>' : '') + (completed > 0 ? '<span class="text-[10px] text-emerald-600">✅ 완료 ' + completed + '</span>' : '') + (total === 0 ? '<span class="text-[10px] text-slate-400">업무 없음</span>' : '') + '</div></div><svg class="h-4 w-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>';
    container.appendChild(monthCard);
  }
}

function _buildMobileTaskCard(task, todayStr) {
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

  card.className = 'mobile-cal-card rounded-xl border bg-white p-3 shadow-sm cursor-pointer active:scale-[0.98] transition-all hover:shadow-md';
  card.onclick = function() { if (typeof openTaskModal === 'function') openTaskModal(task.id); };
  card.innerHTML = '<div class="flex items-start gap-2.5"><span class="text-lg leading-none mt-0.5 shrink-0">' + sc.icon + '</span><div class="flex-1 min-w-0"><p class="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">' + escapeHTML(task.title || '') + '</p><div class="flex flex-wrap items-center gap-1.5 mt-1.5"><span class="inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ' + sc.cls + '">' + sc.label + '</span><span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ' + pc.cls + '">' + pc.label + '</span>' + (subCount > 0 ? '<span class="rounded-full bg-indigo-50 text-indigo-600 px-2 py-0.5 text-[10px] font-semibold">하위 ' + subDone + '/' + subCount + '</span>' : '') + '</div><div class="flex items-center justify-between mt-2"><span class="text-[11px] text-slate-500 truncate">👤 ' + escapeHTML(assignees) + '</span><span class="text-[10px] text-slate-400 shrink-0 ml-2">' + (task.startDate ? task.startDate.substring(5) : '?') + ' ~ ' + (task.dueDate ? task.dueDate.substring(5) : '?') + '</span></div></div></div>';
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
