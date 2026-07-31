console.info('Smart Task Flow todo-controller.js v20260731-v4 loaded');

let todoDateFilter = 'TODAY';
let todoCompletionFilter = 'ACTIVE';
let todoSearchText = '';
let todoReminderSnapshotKey = '';
let todoViewMode = 'LIST';
let todoCalendarMode = 'MONTH';
let todoCalendarDate = null;
let todoModalOriginalTaskLink = null;
let todoModalTaskLinkChanged = false;
const TODO_CALENDAR_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function addDaysToDateString(dateString, days) {
  const [year, month, day] = String(dateString || '').split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthRange(dateString) {
  const [year, month] = String(dateString || '').split('-').map(Number);
  const end = new Date(year, month, 0);
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  };
}

function todoOverlapsRange(todo, rangeStart, rangeEnd) {
  const start = todo.startDate || todo.dueDate || '';
  const end = todo.dueDate || todo.startDate || '';
  return !!start && !!end && start <= rangeEnd && end >= rangeStart;
}

function isTodoOverdue(todo, today = getTodayStr()) {
  return todo.completed !== true && !!todo.dueDate && todo.dueDate < today;
}

function matchesTodoDateFilter(todo, filter = todoDateFilter, today = getTodayStr()) {
  if (filter === 'ALL') return true;
  if (filter === 'OVERDUE') return isTodoOverdue(todo, today);
  if (filter === 'TODAY') return isTodoOverdue(todo, today) || todoOverlapsRange(todo, today, today);
  if (filter === 'WEEK') return todoOverlapsRange(todo, today, addDaysToDateString(today, 7));
  if (filter === 'MONTH') {
    const range = getMonthRange(today);
    return todoOverlapsRange(todo, range.start, range.end);
  }
  return true;
}

function getTodoFilterCounts(items = todoItems, today = getTodayStr()) {
  const active = items.filter(item => item.completed !== true);
  const monthRange = getMonthRange(today);
  return {
    TODAY: active.filter(item => matchesTodoDateFilter(item, 'TODAY', today)).length,
    WEEK: active.filter(item => todoOverlapsRange(item, today, addDaysToDateString(today, 7))).length,
    MONTH: active.filter(item => todoOverlapsRange(item, monthRange.start, monthRange.end)).length,
    OVERDUE: active.filter(item => isTodoOverdue(item, today)).length,
    ALL: active.length
  };
}

function getVisibleTodos(items = todoItems) {
  const search = todoSearchText.trim().toLowerCase();
  return items.filter(item => {
    if (todoCompletionFilter === 'ACTIVE' && item.completed === true) return false;
    if (todoCompletionFilter === 'COMPLETED' && item.completed !== true) return false;
    if (!matchesTodoDateFilter(item)) return false;
    if (search && !`${item.title || ''} ${item.memo || ''}`.toLowerCase().includes(search)) return false;
    return true;
  }).sort((a, b) => {
    const overdueOrder = Number(isTodoOverdue(b)) - Number(isTodoOverdue(a));
    if (overdueOrder) return overdueOrder;
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    return String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
      || String(a.startDate || '').localeCompare(String(b.startDate || ''))
      || String(a.title || '').localeCompare(String(b.title || ''), 'ko');
  });
}

function parseTodoCalendarDate(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTodoCalendarDate() {
  if (!(todoCalendarDate instanceof Date) || Number.isNaN(todoCalendarDate.getTime())) {
    todoCalendarDate = parseTodoCalendarDate(getTodayStr()) || new Date();
  }
  return todoCalendarDate;
}

function formatTodoCalendarDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getTodoCalendarItems(
  items = todoItems,
  completionFilter = todoCompletionFilter,
  searchText = todoSearchText
) {
  const search = String(searchText || '').trim().toLowerCase();
  return items.filter(item => {
    if (completionFilter === 'ACTIVE' && item.completed === true) return false;
    if (completionFilter === 'COMPLETED' && item.completed !== true) return false;
    return !search || `${item.title || ''} ${item.memo || ''}`.toLowerCase().includes(search);
  }).sort((a, b) =>
    String(a.startDate || '').localeCompare(String(b.startDate || ''))
    || String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
    || String(a.title || '').localeCompare(String(b.title || ''), 'ko')
  );
}

function getTodoCalendarItemClass(todo) {
  if (todo.completed === true) return 'border-slate-200 bg-slate-100 text-slate-500 line-through';
  if (isTodoOverdue(todo)) return 'border-rose-200 bg-rose-100 text-rose-700';
  return 'border-violet-200 bg-violet-100 text-violet-700';
}

function syncTodoCalendarControls() {
  const monthButton = document.getElementById('btn-todo-calendar-month');
  const yearButton = document.getElementById('btn-todo-calendar-year');
  const activeClass = 'rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm';
  const inactiveClass = 'rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800';
  if (monthButton) monthButton.className = todoCalendarMode === 'MONTH' ? activeClass : inactiveClass;
  if (yearButton) yearButton.className = todoCalendarMode === 'YEAR' ? activeClass : inactiveClass;
}

function isTodoCalendarMobile() {
  return window.matchMedia
    ? window.matchMedia('(max-width: 1023px)').matches
    : window.innerWidth < 1024;
}

function getTodoCalendarStatus(todo) {
  if (todo.completed === true) return { icon: '⭐️', label: '완료' };
  if (isTodoOverdue(todo)) return { icon: '🚨', label: '기한 경과' };
  return { icon: '⌛', label: '미완료' };
}

function setTodoCalendarMeta(titleText, itemCount) {
  const title = document.getElementById('todo-calendar-title');
  const count = document.getElementById('todo-calendar-count');
  if (title) title.textContent = titleText;
  if (count) count.textContent = `${itemCount}개 일정`;
}

function renderTodoDesktopMonthCalendar(content, monthItems, year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = firstDay + daysInMonth;
  const fullCells = totalCells + (totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7));
  const weekCount = fullCells / 7;
  const rowDateHeight = 34;
  const laneHeight = 22;
  const monthValue = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthStart = `${monthValue}-01`;
  const monthEnd = `${monthValue}-${String(daysInMonth).padStart(2, '0')}`;
  const weekBounds = Array.from({ length: weekCount }, (_, week) => {
    const startDay = Math.max(1, week * 7 - firstDay + 1);
    const endDay = Math.min(daysInMonth, week * 7 + 7 - firstDay);
    return {
      start: `${monthValue}-${String(startDay).padStart(2, '0')}`,
      end: `${monthValue}-${String(endDay).padStart(2, '0')}`
    };
  });
  const weekLayouts = weekBounds.map(({ start, end }) => {
    const activeItems = monthItems.filter(item => todoOverlapsRange(item, start, end));
    return {
      laneMap: new Map(activeItems.map((item, index) => [String(item.id), index])),
      laneCount: activeItems.length,
      height: rowDateHeight + activeItems.length * laneHeight + 14
    };
  });
  const weekOffsets = [];
  weekLayouts.reduce((offset, layout, week) => {
    weekOffsets[week] = offset;
    return offset + layout.height;
  }, 0);

  const cells = [];
  for (let index = 0; index < fullCells; index += 1) {
    const day = index - firstDay + 1;
    const dateString = day >= 1 && day <= daysInMonth
      ? `${monthValue}-${String(day).padStart(2, '0')}`
      : '';
    const dayOfWeek = index % 7;
    cells.push(`
      <div ${dateString ? `data-todo-calendar-date="${dateString}"` : ''}
        class="${dateString ? 'bg-white hover:bg-slate-50' : 'bg-slate-50'} border-b border-r border-slate-100 transition-colors"
        style="height:${weekLayouts[Math.floor(index / 7)].height}px">
        ${dateString ? `<div class="p-1.5"><span class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          dateString === getTodayStr() ? 'bg-indigo-600 text-white shadow-sm'
            : dayOfWeek === 0 ? 'text-rose-500'
              : dayOfWeek === 6 ? 'text-blue-500'
                : 'text-slate-600'
        }">${day}</span></div>` : ''}
      </div>
    `);
  }

  const bars = [];
  monthItems.forEach(todo => {
    const displayStart = todo.startDate < monthStart ? monthStart : todo.startDate;
    const displayEnd = todo.dueDate > monthEnd ? monthEnd : todo.dueDate;
    const startDay = Number(displayStart.slice(8, 10));
    const endDay = Number(displayEnd.slice(8, 10));
    for (let week = 0; week < weekCount; week += 1) {
      const weekStartDay = Math.max(1, week * 7 - firstDay + 1);
      const weekEndDay = Math.min(daysInMonth, week * 7 + 7 - firstDay);
      const segmentStart = Math.max(startDay, weekStartDay);
      const segmentEnd = Math.min(endDay, weekEndDay);
      if (segmentStart > segmentEnd) continue;
      const lane = weekLayouts[week].laneMap.get(String(todo.id));
      if (lane == null) continue;
      const startColumn = (firstDay + segmentStart - 1) % 7;
      const endColumn = (firstDay + segmentEnd - 1) % 7;
      const leftPad = segmentStart === startDay || segmentStart === weekStartDay ? 4 : 0;
      const rightPad = segmentEnd === endDay || segmentEnd === weekEndDay ? 4 : 0;
      const status = getTodoCalendarStatus(todo);
      bars.push(`
        <button type="button" data-todo-calendar-id="${escapeHTML(todo.id)}"
          class="pointer-events-auto absolute flex h-5 items-center truncate rounded-lg px-2 text-left text-[10px] font-semibold leading-none shadow-sm transition hover:scale-[1.01] ${getTodoCalendarItemClass(todo)}"
          style="left:calc(${startColumn / 7 * 100}% + ${leftPad}px);width:calc(${(endColumn - startColumn + 1) / 7 * 100}% - ${leftPad + rightPad}px);top:${weekOffsets[week] + rowDateHeight + lane * laneHeight}px"
          title="${escapeHTML(todo.title)} · ${todo.startDate} ~ ${todo.dueDate}">
          <span class="truncate">${status.icon} ${escapeHTML(todo.title)}</span>
        </button>
      `);
    }
  });

  content.innerHTML = `
    <div data-todo-calendar-view="desktop-month" class="overflow-x-auto rounded-xl pb-2">
      <div class="relative min-w-[900px] lg:min-w-0">
        <div class="grid grid-cols-7 gap-px overflow-hidden rounded-t-lg border border-slate-200 bg-slate-200">
          ${TODO_CALENDAR_WEEKDAYS.map((weekday, index) => `<div class="bg-slate-50 py-2 text-center text-xs font-semibold ${
            index === 0 ? 'text-rose-500' : index === 6 ? 'text-blue-500' : 'text-slate-500'
          }">${weekday}</div>`).join('')}
        </div>
        <div class="relative mt-px overflow-hidden rounded-b-lg border border-slate-200 bg-white" data-week-lane-counts="${weekLayouts.map(layout => layout.laneCount).join(',')}">
          <div class="relative z-0 grid grid-cols-7 gap-px bg-slate-200">${cells.join('')}</div>
          <div class="pointer-events-none absolute inset-0 z-10">${bars.join('')}</div>
        </div>
      </div>
    </div>
  `;
}

function renderTodoMobileMonthCalendar(content, monthItems, year, month) {
  const monthValue = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthStart = `${monthValue}-01`;
  const monthEnd = formatTodoCalendarDate(new Date(year, month + 1, 0));
  const grouped = new Map();
  monthItems.forEach(todo => {
    const displayDate = todo.startDate < monthStart ? monthStart : todo.startDate;
    if (displayDate > monthEnd) return;
    if (!grouped.has(displayDate)) grouped.set(displayDate, []);
    grouped.get(displayDate).push(todo);
  });
  if (!grouped.size) {
    content.innerHTML = '<div data-todo-calendar-view="mobile-month" class="flex flex-col items-center justify-center py-16 text-center"><span class="mb-3 text-4xl">📅</span><p class="text-sm font-semibold text-slate-500">이번 달 To-do가 없습니다.</p></div>';
    return;
  }
  const sections = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dateString, dayItems]) => {
    const parsed = parseTodoCalendarDate(dateString);
    const day = parsed.getDate();
    const weekday = parsed.getDay();
    const today = dateString === getTodayStr();
    const dayClass = weekday === 0 ? 'text-rose-500' : weekday === 6 ? 'text-blue-500' : 'text-slate-500';
    return `
      <section data-todo-calendar-date="${dateString}">
        <div class="mb-2 mt-4 flex items-center gap-2 first:mt-0">
          <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            today ? 'bg-indigo-600 text-white shadow-sm' : `bg-slate-100 ${dayClass}`
          }">${day}</span>
          <span class="text-xs font-semibold ${dayClass}">${TODO_CALENDAR_WEEKDAYS[weekday]}</span>
          ${today ? '<span class="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">오늘</span>' : ''}
          <div class="h-px flex-1 bg-slate-100"></div>
        </div>
        <div class="space-y-2">
          ${dayItems.map(todo => {
            const status = getTodoCalendarStatus(todo);
            return `
              <button type="button" data-todo-calendar-id="${escapeHTML(todo.id)}"
                class="block w-full rounded-xl border bg-white p-3 text-left shadow-sm transition active:scale-[0.98] ${getTodoCalendarItemClass(todo)}">
                <div class="flex items-start gap-2.5">
                  <span class="shrink-0 text-lg">${status.icon}</span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold">${escapeHTML(todo.title)}</p>
                    <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span class="rounded-full border border-current px-2 py-0.5 font-semibold">${status.label}</span>
                      <span>${todo.startDate.slice(5)} ~ ${todo.dueDate.slice(5)}</span>
                    </div>
                    ${todo.memo ? `<p class="mt-2 truncate text-[11px] opacity-75">${escapeHTML(todo.memo)}</p>` : ''}
                  </div>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }).join('');
  content.innerHTML = `<div data-todo-calendar-view="mobile-month" class="min-w-0">${sections}</div>`;
}

function renderTodoMonthCalendar(items, date) {
  const content = document.getElementById('todo-calendar-content');
  if (!content) return;
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = formatTodoCalendarDate(new Date(year, month + 1, 0));
  const monthItems = items.filter(item => todoOverlapsRange(item, monthStart, monthEnd));
  setTodoCalendarMeta(`${year}년 ${month + 1}월`, monthItems.length);
  if (isTodoCalendarMobile()) renderTodoMobileMonthCalendar(content, monthItems, year, month);
  else renderTodoDesktopMonthCalendar(content, monthItems, year, month);
}

function renderTodoDesktopYearCalendar(content, yearItems, year) {
  const rowHeight = 28;
  const bodyHeight = Math.max(yearItems.length, 5) * rowHeight + 20;
  const monthButtons = Array.from({ length: 12 }, (_, month) => `
    <button type="button" data-todo-calendar-month="${year}-${String(month + 1).padStart(2, '0')}"
      class="py-3 text-center text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-indigo-600">${month + 1}월</button>
  `).join('');
  const tiles = Array.from({ length: 12 }, (_, month) => `
    <button type="button" data-todo-calendar-month-target="${year}-${String(month + 1).padStart(2, '0')}"
      class="border-b border-slate-100 bg-white transition-colors hover:bg-slate-50" style="height:${bodyHeight}px" aria-label="${month + 1}월 월간 보기"></button>
  `).join('');
  const bars = yearItems.map((todo, index) => {
    const start = parseTodoCalendarDate(todo.startDate);
    const end = parseTodoCalendarDate(todo.dueDate);
    const startMonth = start.getFullYear() < year ? 0 : start.getMonth();
    const endMonth = end.getFullYear() > year ? 11 : end.getMonth();
    const status = getTodoCalendarStatus(todo);
    return `
      <button type="button" data-todo-calendar-id="${escapeHTML(todo.id)}"
        class="pointer-events-auto absolute z-10 flex h-5 items-center truncate rounded-lg px-2 text-left text-[10.5px] font-bold shadow-sm transition hover:scale-[1.01] ${getTodoCalendarItemClass(todo)}"
        style="left:calc(${startMonth / 12 * 100}% + 4px);width:calc(${(endMonth - startMonth + 1) / 12 * 100}% - 8px);top:${index * rowHeight + 10}px"
        title="${escapeHTML(todo.title)} · ${todo.startDate} ~ ${todo.dueDate}">
        <span class="truncate">${status.icon} ${escapeHTML(todo.title)}</span>
      </button>
    `;
  }).join('');
  content.innerHTML = `
    <div data-todo-calendar-view="desktop-year" class="overflow-x-auto rounded-xl pb-2">
      <div class="min-w-[900px] lg:min-w-0">
        <div class="grid grid-cols-12 gap-px border-b border-slate-200 bg-slate-50 shadow-sm">${monthButtons}</div>
        <div class="relative overflow-hidden rounded-b-xl border border-t-0 border-slate-200">
          <div class="grid grid-cols-12 gap-px bg-slate-100/50">${tiles}</div>
          <div class="pointer-events-none absolute inset-0">${bars}</div>
        </div>
      </div>
    </div>
  `;
}

function renderTodoMobileYearCalendar(content, yearItems, year) {
  const displayedItems = yearItems.slice(0, 12);
  const rowHeight = 54;
  const axisWidth = 48;
  const contentWidth = content.clientWidth || 320;
  const chartWidth = Math.max(220, contentWidth - axisWidth - 24);
  const barThickness = Math.max(10, Math.min(22, Math.floor((chartWidth - 24) / Math.max(displayedItems.length, 1)) - 3));
  const laneWidth = barThickness + 3;
  const monthRows = Array.from({ length: 12 }, (_, month) => `
    <button type="button" data-todo-calendar-month="${year}-${String(month + 1).padStart(2, '0')}"
      class="flex h-[54px] w-full items-center justify-center border-b border-slate-100 text-[11px] font-bold text-slate-500 hover:bg-slate-50 hover:text-indigo-600">${month + 1}월</button>
  `).join('');
  const gridRows = Array.from({ length: 12 }, () => '<div class="h-[54px] border-b border-slate-100"></div>').join('');
  const bars = displayedItems.map((todo, index) => {
    const start = parseTodoCalendarDate(todo.startDate);
    const end = parseTodoCalendarDate(todo.dueDate);
    const startMonth = start.getFullYear() < year ? 0 : start.getMonth();
    const endMonth = end.getFullYear() > year ? 11 : end.getMonth();
    const height = (endMonth - startMonth + 1) * rowHeight;
    const status = getTodoCalendarStatus(todo);
    return `
      <button type="button" data-todo-calendar-id="${escapeHTML(todo.id)}"
        class="pointer-events-auto absolute flex items-center overflow-hidden rounded-lg pl-3 pr-2 text-left text-[10px] font-bold shadow-sm transition active:scale-[0.99] ${getTodoCalendarItemClass(todo)}"
        style="width:${height - 6}px;height:${barThickness}px;top:${startMonth * rowHeight + 3}px;left:${12 + index * laneWidth + barThickness}px;transform-origin:top left;transform:rotate(90deg)"
        title="${escapeHTML(todo.title)} · ${todo.startDate} ~ ${todo.dueDate}">
        <span class="min-w-0 flex-1 truncate">${status.icon} ${escapeHTML(todo.title)}</span>
      </button>
    `;
  }).join('');
  content.innerHTML = `
    <div data-todo-calendar-view="mobile-year" class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div class="grid grid-cols-[48px_1fr]" style="height:${rowHeight * 12}px">
        <div class="z-10 border-r border-slate-200 bg-slate-50">${monthRows}</div>
        <div class="relative min-w-0 overflow-hidden">
          <div class="absolute inset-0">${gridRows}</div>
          <div class="pointer-events-none absolute inset-0">${bars}</div>
        </div>
      </div>
      ${yearItems.length > displayedItems.length ? `<p class="border-t border-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-500">화면 맞춤을 위해 시작일이 빠른 ${displayedItems.length}개를 표시합니다. 전체 ${yearItems.length}개</p>` : ''}
    </div>
  `;
}

function renderTodoYearCalendar(items, date) {
  const content = document.getElementById('todo-calendar-content');
  if (!content) return;
  const year = date.getFullYear();
  const yearItems = items.filter(item => todoOverlapsRange(item, `${year}-01-01`, `${year}-12-31`));
  setTodoCalendarMeta(`${year}년 연간 현황`, yearItems.length);
  if (isTodoCalendarMobile()) renderTodoMobileYearCalendar(content, yearItems, year);
  else renderTodoDesktopYearCalendar(content, yearItems, year);
}

function renderTodoCalendar() {
  const content = document.getElementById('todo-calendar-content');
  if (!content) return;
  const date = getTodoCalendarDate();
  const items = getTodoCalendarItems();
  syncTodoCalendarControls();
  if (todoCalendarMode === 'YEAR') renderTodoYearCalendar(items, date);
  else renderTodoMonthCalendar(items, date);
}

function setTodoCalendarMode(mode) {
  todoCalendarMode = mode === 'YEAR' ? 'YEAR' : 'MONTH';
  renderTodoCalendar();
}

function moveTodoCalendar(step) {
  const current = getTodoCalendarDate();
  todoCalendarDate = new Date(current.getFullYear(), current.getMonth(), 1);
  if (todoCalendarMode === 'YEAR') todoCalendarDate.setFullYear(todoCalendarDate.getFullYear() + step);
  else todoCalendarDate.setMonth(todoCalendarDate.getMonth() + step);
  renderTodoCalendar();
}

function resetTodoCalendarToday() {
  todoCalendarDate = parseTodoCalendarDate(getTodayStr()) || new Date();
  renderTodoCalendar();
}

function syncTodoViewMode() {
  const listView = document.getElementById('todo-list-view');
  const calendarView = document.getElementById('todo-calendar-section');
  const listButton = document.getElementById('btn-todo-view-list');
  const calendarButton = document.getElementById('btn-todo-view-calendar');
  const showList = todoViewMode === 'LIST';
  [
    [listView, showList],
    [calendarView, !showList]
  ].forEach(([element, visible]) => {
    if (!element) return;
    element.hidden = !visible;
    element.classList.toggle('hidden', !visible);
    element.style.display = visible ? '' : 'none';
  });
  const activeClass = 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition';
  const inactiveClass = 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-800';
  if (listButton) {
    listButton.className = showList ? activeClass : inactiveClass;
    listButton.setAttribute('aria-pressed', String(showList));
  }
  if (calendarButton) {
    calendarButton.className = showList ? inactiveClass : activeClass;
    calendarButton.setAttribute('aria-pressed', String(!showList));
  }
}

function setTodoViewMode(mode) {
  todoViewMode = mode === 'CALENDAR' ? 'CALENDAR' : 'LIST';
  renderTodoView();
}

function getTodoDateLabel(todo, today = getTodayStr()) {
  if (isTodoOverdue(todo, today)) return { label: `기한 경과 · ${todo.dueDate}`, className: 'border-rose-200 bg-rose-50 text-rose-700' };
  if (todoOverlapsRange(todo, today, today)) return { label: '오늘 할 일', className: 'border-indigo-200 bg-indigo-50 text-indigo-700' };
  return { label: `${todo.startDate} ~ ${todo.dueDate}`, className: 'border-slate-200 bg-slate-50 text-slate-600' };
}

function getTodoLinkTrackers() {
  const source = typeof trackers !== 'undefined' && Array.isArray(trackers) ? trackers : [];
  return source.filter(tracker => window.hasTaskPermission?.(tracker, 'view') === true);
}

function getTodoLinkTasks(trackerId) {
  const source = typeof tasks !== 'undefined' && Array.isArray(tasks) ? tasks : [];
  return source.filter(task =>
    task.trackerId === trackerId &&
    task.deleted !== true &&
    window.hasTaskPermission?.(task, 'view') === true
  );
}

function resolveTodoTaskLink(taskLink) {
  const normalized = window.normalizeTodoTaskLink?.(taskLink);
  if (!normalized) return { available: false, taskLink: null };
  const tracker = getTodoLinkTrackers().find(item => item.id === normalized.trackerId);
  const task = tracker
    ? getTodoLinkTasks(normalized.trackerId).find(item => item.id === normalized.taskId)
    : null;
  const subTask = normalized.subTaskId && task
    ? (Array.isArray(task.subTasks) ? task.subTasks : []).find(item => item.id === normalized.subTaskId)
    : null;
  if (!tracker || !task || (normalized.subTaskId && !subTask)) {
    return { available: false, taskLink: normalized };
  }
  const parts = [tracker.name || '이름 없는 트래커', task.title || '제목 없는 업무'];
  if (subTask) parts.push(subTask.title || '제목 없는 하위 과제');
  return {
    available: true,
    taskLink: normalized,
    tracker,
    task,
    subTask,
    label: parts.join(' › ')
  };
}

function setTodoTaskLinkStatus(message = '', unavailable = false) {
  const status = document.getElementById('todo-task-link-status');
  if (!status) return;
  status.textContent = message;
  status.className = message
    ? `rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${
      unavailable
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-violet-200 bg-white text-violet-700'
    }`
    : 'hidden rounded-lg border px-2.5 py-2 text-[11px] font-semibold';
}

function replaceTodoSelectOptions(select, placeholder, items, getLabel) {
  if (!select) return;
  select.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = placeholder;
  select.appendChild(empty);
  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = getLabel(item);
    select.appendChild(option);
  });
}

function populateTodoLinkSubTasks(taskId, selectedSubTaskId = '') {
  const taskSelect = document.getElementById('input-todo-link-task');
  const subTaskSelect = document.getElementById('input-todo-link-subtask');
  const trackerId = document.getElementById('input-todo-link-tracker')?.value || '';
  const task = getTodoLinkTasks(trackerId).find(item => item.id === (taskId || taskSelect?.value));
  const subTasks = Array.isArray(task?.subTasks) ? task.subTasks : [];
  replaceTodoSelectOptions(subTaskSelect, '본 업무만 연결', subTasks, item => item.title || '제목 없는 하위 과제');
  if (subTaskSelect) {
    subTaskSelect.disabled = !task || !subTasks.length;
    subTaskSelect.value = subTasks.some(item => item.id === selectedSubTaskId) ? selectedSubTaskId : '';
  }
}

function populateTodoLinkTasks(trackerId, selectedTaskId = '', selectedSubTaskId = '') {
  const taskSelect = document.getElementById('input-todo-link-task');
  const tasksForTracker = trackerId ? getTodoLinkTasks(trackerId) : [];
  replaceTodoSelectOptions(taskSelect, tasksForTracker.length ? '업무 선택' : '연결 가능한 업무 없음', tasksForTracker, item => item.title || '제목 없는 업무');
  if (taskSelect) taskSelect.value = tasksForTracker.some(item => item.id === selectedTaskId) ? selectedTaskId : '';
  populateTodoLinkSubTasks(taskSelect?.value || '', selectedSubTaskId);
}

function syncTodoTaskLinkInputs(taskLink = null) {
  const trackerSelect = document.getElementById('input-todo-link-tracker');
  const dependentFields = document.getElementById('todo-link-dependent-fields');
  const clearButton = document.getElementById('btn-clear-todo-task-link');
  const resolved = resolveTodoTaskLink(taskLink);
  const availableTrackers = getTodoLinkTrackers();
  replaceTodoSelectOptions(trackerSelect, '연결하지 않음', availableTrackers, item => item.name || '이름 없는 트래커');

  if (resolved.available) {
    trackerSelect.value = resolved.tracker.id;
    dependentFields?.classList.remove('hidden');
    dependentFields?.classList.add('grid');
    populateTodoLinkTasks(resolved.tracker.id, resolved.task.id, resolved.subTask?.id || '');
    setTodoTaskLinkStatus(resolved.label);
  } else {
    if (trackerSelect) trackerSelect.value = '';
    dependentFields?.classList.add('hidden');
    dependentFields?.classList.remove('grid');
    populateTodoLinkTasks('');
    setTodoTaskLinkStatus(taskLink ? '연결된 업무를 볼 수 없음 · 연결 해제 후 다른 업무를 선택할 수 있습니다.' : '', !!taskLink);
  }
  clearButton?.classList.toggle('hidden', !taskLink);
}

function clearTodoTaskLink() {
  todoModalTaskLinkChanged = true;
  todoModalOriginalTaskLink = null;
  syncTodoTaskLinkInputs();
}

function getTodoTaskLinkFromInputs() {
  const trackerId = document.getElementById('input-todo-link-tracker')?.value || '';
  const taskId = document.getElementById('input-todo-link-task')?.value || '';
  const subTaskId = document.getElementById('input-todo-link-subtask')?.value || '';
  if (!trackerId) {
    return {
      taskLink: todoModalOriginalTaskLink && !todoModalTaskLinkChanged
        ? todoModalOriginalTaskLink
        : null
    };
  }
  if (!taskId) return { error: '연결할 본 업무를 선택해 주세요.' };
  const taskLink = window.normalizeTodoTaskLink?.({ trackerId, taskId, subTaskId });
  if (!taskLink) return { error: '업무 연결 정보를 확인해 주세요.' };
  if (
    todoModalOriginalTaskLink?.occurrenceKey &&
    todoModalOriginalTaskLink.trackerId === taskLink.trackerId &&
    todoModalOriginalTaskLink.taskId === taskLink.taskId &&
    (todoModalOriginalTaskLink.subTaskId || '') === (taskLink.subTaskId || '')
  ) {
    taskLink.occurrenceKey = todoModalOriginalTaskLink.occurrenceKey;
  }
  return { taskLink };
}

function openTodoLinkedTask(todoId) {
  const todo = todoItems.find(item => item.id === todoId);
  const resolved = resolveTodoTaskLink(todo?.taskLink);
  if (!resolved.available) {
    renderTodoView();
    return showToast('연결된 업무를 볼 수 없습니다.', false);
  }
  window.currentTrackerId = resolved.tracker.id;
  try {
    localStorage.setItem('flow_current_tracker', resolved.tracker.id);
  } catch (error) {
    console.warn('선택한 트래커를 저장하지 못했습니다.', error);
  }
  window.updateTrackerUI?.();
  window.switchView?.('TABLE');
  window.__todoLinkedTaskTarget = resolved.taskLink;
  window.openTaskModal?.(resolved.task.id);
}

function renderTodoView() {
  const container = document.getElementById('todo-list');
  if (!container) return;
  const counts = getTodoFilterCounts();
  Object.entries(counts).forEach(([key, value]) => {
    const count = document.getElementById(`todo-count-${key.toLowerCase()}`);
    if (count) count.textContent = value;
  });

  document.querySelectorAll('[data-todo-date-filter]').forEach(button => {
    const active = button.dataset.todoDateFilter === todoDateFilter;
    button.className = active
      ? 'rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition'
      : 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700';
  });
  const completion = document.getElementById('todo-completion-filter');
  if (completion) completion.value = todoCompletionFilter;
  const search = document.getElementById('todo-search');
  if (search && search.value !== todoSearchText) search.value = todoSearchText;

  const visible = getVisibleTodos();
  const resultCount = document.getElementById('todo-result-count');
  if (resultCount) resultCount.textContent = `${visible.length}개`;
  syncTodoViewMode();
  if (todoViewMode === 'CALENDAR') renderTodoCalendar();
  container.innerHTML = '';
  if (!visible.length) {
    container.innerHTML = `<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <div class="text-3xl">✓</div>
      <p class="mt-3 text-sm font-bold text-slate-600">조건에 맞는 To-do가 없습니다.</p>
      <p class="mt-1 text-xs text-slate-400">새로운 할 일을 등록하거나 조회 조건을 바꿔보세요.</p>
    </div>`;
    return;
  }

  visible.forEach(todo => {
    const dateLabel = getTodoDateLabel(todo);
    const linkedTask = todo.taskLink ? resolveTodoTaskLink(todo.taskLink) : null;
    const linkedTaskHtml = linkedTask?.available
      ? `<button type="button" class="btn-open-todo-task-link inline-flex max-w-full items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-left text-[11px] font-bold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100" data-id="${escapeHTML(todo.id)}" title="${escapeHTML(linkedTask.label)}" aria-label="연결된 업무 열기: ${escapeHTML(linkedTask.label)}"><span aria-hidden="true">↗</span><span class="truncate">${escapeHTML(linkedTask.label)}</span></button>`
      : todo.taskLink
        ? '<span class="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">연결된 업무를 볼 수 없음</span>'
        : '';
    const card = document.createElement('article');
    card.className = `rounded-2xl border p-4 shadow-sm transition ${todo.completed ? 'border-slate-100 bg-slate-50/70 opacity-75' : isTodoOverdue(todo) ? 'border-rose-200 bg-rose-50/40' : 'border-slate-100 bg-white hover:border-indigo-200'}`;
    card.dataset.todoId = todo.id;
    card.innerHTML = `
      <div class="flex items-start gap-3">
        <label class="mt-0.5 shrink-0 cursor-pointer" title="${todo.completed ? '미완료로 되돌리기' : '완료 처리'}">
          <input type="checkbox" class="todo-complete-toggle h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" data-id="${escapeHTML(todo.id)}" ${todo.completed ? 'checked' : ''}>
        </label>
        <div class="min-w-0 flex-1">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <h3 class="break-words text-sm font-black text-slate-800 ${todo.completed ? 'line-through text-slate-400' : ''}">${escapeHTML(todo.title)}</h3>
              ${todo.memo ? `<p class="mt-1 break-words text-xs leading-relaxed text-slate-500">${escapeHTML(todo.memo)}</p>` : ''}
            </div>
            <div class="flex shrink-0 items-center gap-1.5 self-end sm:self-start">
              <button type="button" class="btn-edit-todo rounded-lg px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50" data-id="${escapeHTML(todo.id)}">수정</button>
              <button type="button" class="btn-delete-todo rounded-lg px-2 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50" data-id="${escapeHTML(todo.id)}">삭제</button>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="inline-flex rounded-lg border px-2 py-1 text-[11px] font-bold ${dateLabel.className}">${escapeHTML(dateLabel.label)}</span>
            <span class="text-[11px] font-semibold text-slate-400">📅 ${escapeHTML(todo.startDate)} ~ ${escapeHTML(todo.dueDate)}</span>
            ${linkedTaskHtml}
          </div>
        </div>
      </div>`;
    container.appendChild(card);
  });
}

function openTodoModal(id = '') {
  const todo = id ? todoItems.find(item => item.id === id) : null;
  const today = getTodayStr();
  todoModalOriginalTaskLink = window.normalizeTodoTaskLink?.(todo?.taskLink) || null;
  todoModalTaskLinkChanged = false;
  document.getElementById('todo-modal-title').textContent = todo ? 'To-do 수정' : '새 To-do';
  document.getElementById('input-todo-id').value = todo?.id || '';
  document.getElementById('input-todo-title').value = todo?.title || '';
  document.getElementById('input-todo-memo').value = todo?.memo || '';
  document.getElementById('input-todo-start').value = todo?.startDate || today;
  document.getElementById('input-todo-due').value = todo?.dueDate || today;
  syncTodoTaskLinkInputs(todoModalOriginalTaskLink);
  document.getElementById('modal-todo')?.classList.remove('hidden');
  document.getElementById('input-todo-title')?.focus();
}

function closeTodoModal() {
  document.getElementById('modal-todo')?.classList.add('hidden');
  document.getElementById('form-todo')?.reset();
  todoModalOriginalTaskLink = null;
  todoModalTaskLinkChanged = false;
}

async function handleTodoSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('input-todo-id').value;
  const taskLinkResult = getTodoTaskLinkFromInputs();
  if (taskLinkResult.error) return showToast(taskLinkResult.error, false);
  const data = {
    title: document.getElementById('input-todo-title').value,
    memo: document.getElementById('input-todo-memo').value,
    startDate: document.getElementById('input-todo-start').value,
    dueDate: document.getElementById('input-todo-due').value,
    completed: id ? todoItems.find(item => item.id === id)?.completed === true : false,
    taskLink: taskLinkResult.taskLink
  };
  const validationMessage = validateTodoPayload(data);
  if (validationMessage) return showToast(validationMessage, false);
  const result = id ? await db_updateTodo(id, data) : await db_addTodo(data);
  if (!result?.success) return showToast(result?.error || 'To-do를 저장하지 못했습니다.', false);
  closeTodoModal();
  showToast(id ? 'To-do가 수정되었습니다.' : 'To-do가 추가되었습니다.');
}

function confirmTodoDelete(id) {
  const todo = todoItems.find(item => item.id === id);
  if (!todo) return;
  document.getElementById('confirm-title').textContent = 'To-do 삭제';
  document.getElementById('confirm-message').textContent = `'${todo.title}' 항목을 삭제하시겠습니까?`;
  confirmActionCb = async () => {
    const result = await db_deleteTodo(id);
    if (!result?.success) return showToast(result?.error || 'To-do를 삭제하지 못했습니다.', false);
    closeConfirmModal();
    showToast('To-do가 삭제되었습니다.');
  };
  document.getElementById('modal-confirm')?.classList.remove('hidden');
}

function openTodoViewFromHeader() {
  if (currentViewMode === 'TODO') {
    window.switchView?.(lastTaskViewMode || 'CALENDAR');
  } else {
    lastTaskViewMode = ['TABLE', 'CALENDAR', 'KANBAN', 'ADMIN'].includes(currentViewMode) ? currentViewMode : 'CALENDAR';
    window.switchView?.('TODO');
  }
}

function updateTodoReminderContent(overdueItems, todayItems) {
  const summary = document.getElementById('todo-reminder-summary');
  const list = document.getElementById('todo-reminder-list');
  if (summary) summary.textContent = `기한 경과 ${overdueItems.length}건 · 오늘 할 일 ${todayItems.length}건`;
  if (!list) return;
  const unique = [...overdueItems, ...todayItems.filter(item => !overdueItems.some(overdue => overdue.id === item.id))].slice(0, 5);
  list.innerHTML = unique.map(item => `
    <li class="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span class="min-w-0 break-words text-xs font-bold text-slate-700">${escapeHTML(item.title)}</span>
      <span class="shrink-0 text-[10px] font-semibold ${isTodoOverdue(item) ? 'text-rose-600' : 'text-indigo-600'}">${isTodoOverdue(item) ? '기한 경과' : '오늘'}</span>
    </li>`).join('');
}

function handleTodoInitialSnapshot() {
  const userId = window.currentUser?.uid || '';
  if (!userId) return;
  const today = getTodayStr();
  const snapshotKey = `${userId}:${today}`;
  if (todoReminderSnapshotKey === snapshotKey) return;
  todoReminderSnapshotKey = snapshotKey;
  const seenKey = `flow_todo_reminder_seen_${userId}_${today}`;
  const dismissedKey = `flow_todo_reminder_dismissed_${userId}`;
  try {
    if (sessionStorage.getItem(seenKey) === '1' || localStorage.getItem(dismissedKey) === today) return;
    sessionStorage.setItem(seenKey, '1');
  } catch (error) {
    console.warn('To-do 알림 표시 상태를 저장하지 못했습니다.', error);
  }
  const active = todoItems.filter(item => item.completed !== true);
  const overdueItems = active.filter(item => isTodoOverdue(item, today));
  const todayItems = active.filter(item => todoOverlapsRange(item, today, today));
  if (!overdueItems.length && !todayItems.length) return;
  updateTodoReminderContent(overdueItems, todayItems);
  document.getElementById('modal-todo-reminder')?.classList.remove('hidden');
}

function closeTodoReminder(dismissForToday = false) {
  if (dismissForToday && window.currentUser?.uid) {
    try {
      localStorage.setItem(`flow_todo_reminder_dismissed_${window.currentUser.uid}`, getTodayStr());
    } catch (error) {
      console.warn('To-do 오늘 알림 숨김 상태를 저장하지 못했습니다.', error);
    }
  }
  document.getElementById('modal-todo-reminder')?.classList.add('hidden');
}

function resetTodoReminderState() {
  todoReminderSnapshotKey = '';
  document.getElementById('modal-todo-reminder')?.classList.add('hidden');
}

function initTodoController() {
  if (window.__todoControllerInitialized) return;
  window.__todoControllerInitialized = true;
  document.getElementById('btn-open-todo')?.addEventListener('click', openTodoViewFromHeader);
  document.getElementById('btn-add-todo')?.addEventListener('click', () => openTodoModal());
  document.getElementById('btn-close-todo-modal')?.addEventListener('click', closeTodoModal);
  document.getElementById('btn-cancel-todo')?.addEventListener('click', closeTodoModal);
  document.getElementById('form-todo')?.addEventListener('submit', handleTodoSubmit);
  document.getElementById('btn-clear-todo-task-link')?.addEventListener('click', clearTodoTaskLink);
  document.getElementById('input-todo-link-tracker')?.addEventListener('change', event => {
    todoModalTaskLinkChanged = true;
    const trackerId = event.target.value || '';
    const dependentFields = document.getElementById('todo-link-dependent-fields');
    dependentFields?.classList.toggle('hidden', !trackerId);
    dependentFields?.classList.toggle('grid', !!trackerId);
    populateTodoLinkTasks(trackerId);
    setTodoTaskLinkStatus('');
    document.getElementById('btn-clear-todo-task-link')?.classList.toggle('hidden', !trackerId);
  });
  document.getElementById('input-todo-link-task')?.addEventListener('change', event => {
    todoModalTaskLinkChanged = true;
    populateTodoLinkSubTasks(event.target.value || '');
    setTodoTaskLinkStatus('');
  });
  document.getElementById('input-todo-link-subtask')?.addEventListener('change', () => {
    todoModalTaskLinkChanged = true;
    setTodoTaskLinkStatus('');
  });
  document.querySelectorAll('[data-todo-date-filter]').forEach(button => {
    button.addEventListener('click', () => {
      todoDateFilter = button.dataset.todoDateFilter || 'TODAY';
      renderTodoView();
    });
  });
  document.getElementById('todo-completion-filter')?.addEventListener('change', event => {
    todoCompletionFilter = event.target.value || 'ACTIVE';
    renderTodoView();
  });
  document.getElementById('todo-search')?.addEventListener('input', event => {
    todoSearchText = event.target.value || '';
    renderTodoView();
  });
  document.getElementById('todo-list')?.addEventListener('change', async event => {
    const checkbox = event.target.closest('.todo-complete-toggle');
    if (!checkbox) return;
    checkbox.disabled = true;
    const result = await db_updateTodo(checkbox.dataset.id, { completed: checkbox.checked });
    if (!result?.success) {
      checkbox.checked = !checkbox.checked;
      checkbox.disabled = false;
      showToast(result?.error || '완료 상태를 변경하지 못했습니다.', false);
    }
  });
  document.getElementById('todo-list')?.addEventListener('click', event => {
    const linkedTask = event.target.closest('.btn-open-todo-task-link');
    if (linkedTask) return openTodoLinkedTask(linkedTask.dataset.id);
    const edit = event.target.closest('.btn-edit-todo');
    if (edit) return openTodoModal(edit.dataset.id);
    const remove = event.target.closest('.btn-delete-todo');
    if (remove) confirmTodoDelete(remove.dataset.id);
  });
  document.getElementById('btn-todo-view-list')?.addEventListener('click', () => setTodoViewMode('LIST'));
  document.getElementById('btn-todo-view-calendar')?.addEventListener('click', () => setTodoViewMode('CALENDAR'));
  document.getElementById('btn-todo-calendar-month')?.addEventListener('click', () => setTodoCalendarMode('MONTH'));
  document.getElementById('btn-todo-calendar-year')?.addEventListener('click', () => setTodoCalendarMode('YEAR'));
  document.getElementById('btn-todo-calendar-prev')?.addEventListener('click', () => moveTodoCalendar(-1));
  document.getElementById('btn-todo-calendar-today')?.addEventListener('click', resetTodoCalendarToday);
  document.getElementById('btn-todo-calendar-next')?.addEventListener('click', () => moveTodoCalendar(1));
  document.getElementById('todo-calendar-content')?.addEventListener('click', event => {
    const todoButton = event.target.closest('[data-todo-calendar-id]');
    if (todoButton) return openTodoModal(todoButton.dataset.todoCalendarId);
    const monthButton = event.target.closest('[data-todo-calendar-month], [data-todo-calendar-month-target]');
    if (monthButton) {
      const monthValue = monthButton.dataset.todoCalendarMonth || monthButton.dataset.todoCalendarMonthTarget;
      todoCalendarDate = parseTodoCalendarDate(`${monthValue}-01`);
      return setTodoCalendarMode('MONTH');
    }
    const dayButton = event.target.closest('[data-todo-calendar-date]');
    if (dayButton && todoCalendarMode === 'YEAR') {
      todoCalendarDate = parseTodoCalendarDate(dayButton.dataset.todoCalendarDate);
      setTodoCalendarMode('MONTH');
    }
  });
  document.getElementById('btn-close-todo-reminder')?.addEventListener('click', () => closeTodoReminder(false));
  document.getElementById('btn-dismiss-todo-reminder-today')?.addEventListener('click', () => closeTodoReminder(true));
  document.getElementById('btn-view-todos-from-reminder')?.addEventListener('click', () => {
    closeTodoReminder(false);
    if (currentViewMode !== 'TODO') {
      lastTaskViewMode = ['TABLE', 'CALENDAR', 'KANBAN', 'ADMIN'].includes(currentViewMode) ? currentViewMode : 'CALENDAR';
      window.switchView?.('TODO');
    }
  });
}

window.addDaysToDateString = addDaysToDateString;
window.getMonthRange = getMonthRange;
window.todoOverlapsRange = todoOverlapsRange;
window.isTodoOverdue = isTodoOverdue;
window.matchesTodoDateFilter = matchesTodoDateFilter;
window.getTodoFilterCounts = getTodoFilterCounts;
window.getVisibleTodos = getVisibleTodos;
window.resolveTodoTaskLink = resolveTodoTaskLink;
window.openTodoLinkedTask = openTodoLinkedTask;
window.getTodoCalendarItems = getTodoCalendarItems;
window.syncTodoViewMode = syncTodoViewMode;
window.setTodoViewMode = setTodoViewMode;
window.renderTodoCalendar = renderTodoCalendar;
window.setTodoCalendarMode = setTodoCalendarMode;
window.moveTodoCalendar = moveTodoCalendar;
window.resetTodoCalendarToday = resetTodoCalendarToday;
window.renderTodoView = renderTodoView;
window.handleTodoInitialSnapshot = handleTodoInitialSnapshot;
window.resetTodoReminderState = resetTodoReminderState;
window.initTodoController = initTodoController;
