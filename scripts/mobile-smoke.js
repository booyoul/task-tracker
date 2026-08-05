const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');

const dom = new JSDOM(`<!doctype html>
<html>
  <body>
    <div id="task-card-container"></div>
    <div id="empty-state-mobile" class="hidden"></div>
    <h2 id="cal-mobile-month-year"></h2>
    <button id="btn-cal-mode-day-m"></button>
    <button id="btn-cal-mode-month-m"></button>
    <button id="btn-cal-mode-summary-m"></button>
    <button id="btn-view-notes-mobile"></button>
    <button id="btn-view-notes"></button>
    <div id="calendar-date-navigation"></div>
    <div id="calendar-date-navigation-m"></div>
    <span id="filter-date-label">마감 월:</span>
    <span id="mobile-filter-date-label">마감 월</span>
    <input id="filter-start-month" type="month">
    <input id="filter-end-month" type="month">
    <div id="calendar-notes-only-control-m" hidden class="hidden">
      <button id="btn-cal-ux-notes-only-m" aria-pressed="false"></button>
    </div>
    <button id="btn-prev-month-mobile"></button>
    <button id="btn-today-month-mobile"></button>
    <button id="btn-next-month-mobile"></button>
    <button id="btn-toggle-all-table-subtasks" disabled>
      <span data-table-subtask-toggle-icon></span>
      <span data-table-subtask-toggle-label></span>
    </button>
    <div id="task-table-body"></div>
    <div id="cal-mobile-content"></div>
    <div id="calendar-month-year"></div>
    <div id="calendar-weekday-header"></div>
    <div id="calendar-grid"></div>
    <main id="view-notes"><div id="notes-content"></div></main>
  </body>
</html>`, {
  url: 'http://localhost/',
  pretendToBeVisual: true
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.navigator = dom.window.navigator;
global.currentCalDate = new Date('2026-07-12T00:00:00+09:00');
global.currentCalMode = 'DAY';
global.currentTrackerId = 'tracker-smoke';
global.currentViewMode = 'TABLE';
global.calendarUxState = {
  subtasksExpanded: true,
  criticalOnly: false,
  colorByIndustry: false,
  groupByAssignee: false,
  duplicateMultiAssignee: true,
  notesOnly: false
};
global.focusState = { riskOnly: false, highOnly: false };
global.selectedAssigneeFilters = new Set();
global.selectedTaskIds = new Set();
global.expandedTaskIds = new Set();
global.collapsedTaskIds = new Set();
global.AVATAR_COLORS = ['bg-slate-100 text-slate-700'];

window.currentTrackerId = global.currentTrackerId;
window.calendarUxState = global.calendarUxState;
window.db_fetchTrackerProgressNotes = async () => [
  {
    id: 'note-main-older',
    taskId: 'task-1',
    title: '리스크 회의 결과',
    body: '설비 인터락 이슈를 확인하고 후속 조치 담당자를 지정함',
    createdByName: 'bd@example.com',
    customerName: 'ACME',
    oppNo: 'OPP-101',
    workType: 'CUSTOMER_VISIT',
    workTypeLabel: 'Customer Visit',
    reviewComments: [{ body: '담당자 확인 필요', createdByName: 'reviewer@example.com' }],
    noteDate: '2026-07-10',
    createdAt: new Date('2026-06-30T09:30:00+09:00')
  },
  {
    id: 'note-sub-latest',
    taskId: 'task-1__sub_sub-1',
    title: '하위 업무 점검',
    body: '현장 확인 완료',
    createdByName: 'engineer@example.com',
    createdAt: new Date('2026-07-11T15:00:00+09:00')
  },
  {
    id: 'note-main-latest',
    taskId: 'task-1',
    title: '후속 검토',
    body: '회의 결과 후속 조치 확인',
    createdByName: 'bd@example.com',
    noteDate: '2026-07-12',
    createdAt: new Date('2026-07-12T10:00:00+09:00')
  },
  {
    id: 'note-outside-task-range',
    taskId: 'task-outside-month',
    title: '일정 밖 실행 메모',
    body: '관련 업무는 4월에 끝났지만 실행일은 7월인 메모',
    createdByName: 'manager@example.com',
    noteDate: '2026-07-13',
    createdAt: new Date('2026-07-13T11:00:00+09:00')
  },
  {
    id: 'note-previous-month',
    taskId: 'task-1',
    title: '6월 영업 회의',
    body: '기간 필터 확장 검증용 메모',
    createdByName: 'bd@example.com',
    workType: 'SALES_MEETING',
    workTypeLabel: 'Sales Meeting',
    noteDate: '2026-06-20',
    createdAt: new Date('2026-06-20T14:00:00+09:00')
  }
];

function expose(name, value) {
  global[name] = value;
  window[name] = value;
}

expose('getTodayStr', () => '2026-07-12');
expose('getFutureDateStr', (days) => {
  const d = new Date('2026-07-12T00:00:00+09:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
});
expose('escapeHTML', (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[ch]));
expose('openTaskModal', () => {});
expose('toggleFocusMode', () => {});
expose('openAssigneeModal', () => {});
expose('bulkChangeStatus', () => {});
expose('bulkChangeDueDate', () => {});
expose('confirmBatchDelete', () => {});
let openedListNote = null;
expose('openNoteDetailPanel', note => { openedListNote = note; });
let openedCalendarTodoId = '';
expose('openTodoModal', id => { openedCalendarTodoId = id; });
expose('getLinkedTodosForCalendarMonth', (_taskList, year, month) => year === 2026 && month === 6 ? [{
  id: 'todo-linked-calendar',
  title: '연결된 개인 To-do',
  startDate: '2026-07-12',
  dueDate: '2026-07-13',
  completed: false,
  calendarDateKey: '2026-07-12',
  calendarTaskLabel: '장기 프로젝트 리스크 점검'
}] : []);
expose('setCalMode', (mode) => {
  global.currentCalMode = mode;
  window.currentCalMode = mode;
});
expose('renderActiveViews', () => {});

Object.defineProperty(document.getElementById('cal-mobile-content'), 'clientWidth', {
  configurable: true,
  value: 390
});

function loadScript(relativePath) {
  const filePath = path.join(root, relativePath);
  const code = fs.readFileSync(filePath, 'utf8');
  vm.runInThisContext(code, { filename: relativePath });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeTasks() {
  const base = [
    {
      id: 'task-1',
      title: '장기 프로젝트 리스크 점검 및 모바일 줄임 처리 확인용 긴 업무명',
      status: 'PROGRESS',
      priority: 'HIGH',
      industry: 'FNB',
      industryLabel: '식음료',
      startDate: '2026-01-10',
      dueDate: '2026-09-25',
      assignee: ['김BD', '박엔지니어'],
      notes: '모바일 카드에서 두 줄 미리보기를 확인한다.',
      subTasks: [
        { id: 'sub-1', title: '현장 데이터 수집', status: 'PROGRESS', startDate: '2026-02-01', dueDate: '2026-07-08', assignee: ['박엔지니어'] },
        { id: 'sub-2', title: '고객 보고서 초안', status: 'PENDING', startDate: '2026-07-15', dueDate: '2026-08-10', assignee: ['김BD'] }
      ]
    },
    {
      id: 'task-2',
      title: '완료된 KPI 검토',
      status: 'COMPLETED',
      priority: 'NORMAL',
      industry: 'PHARMA',
      industryLabel: '제약',
      startDate: '2026-03-01',
      dueDate: '2026-04-30',
      assignee: ['이매니저'],
      subTasks: [
        { id: 'sub-recurring-1', title: '월간 정기 완료 체크', status: 'PENDING', startDate: '2026-03-15', dueDate: '2026-03-15', assignee: ['이매니저'], recurrence: { enabled: true, frequency: 'MONTHLY', interval: 1, endType: 'NONE' } }
      ]
    }
  ];

  for (let i = 3; i <= 14; i += 1) {
    const month = String(((i - 1) % 12) + 1).padStart(2, '0');
    base.push({
      id: `task-${i}`,
      title: `연간 간트 밀집 테스트 업무 ${i}`,
      status: i % 4 === 0 ? 'PENDING' : 'PROGRESS',
      priority: i % 5 === 0 ? 'HIGH' : 'NORMAL',
      industry: i % 2 === 0 ? 'CHEM' : 'BUILDING',
      startDate: `2026-${month}-01`,
      dueDate: `2026-${month}-20`,
      assignee: ['담당자'],
      subTasks: []
    });
  }

  return base;
}

async function main() {
  const indexDom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'http://localhost/',
    runScripts: 'outside-only'
  });
  const noteDateInput = indexDom.window.document.getElementById('input-note-date');
  assert(noteDateInput && !noteDateInput.required, '숨겨진 진행 메모 기록일이 신규 업무 폼 제출을 차단합니다.');
  indexDom.window.document.getElementById('input-task-title').value = '신규 업무 저장 회귀 테스트';
  indexDom.window.document.getElementById('input-task-due').value = '2026-07-31';
  assert(indexDom.window.document.getElementById('form-task').checkValidity(), '필수 업무값을 입력해도 신규 업무 폼이 제출 가능한 상태가 아닙니다.');
  const taskCategorySelect = indexDom.window.document.getElementById('input-task-industry');
  const taskTitleInput = indexDom.window.document.getElementById('input-task-title');
  const mainTaskNoteButton = indexDom.window.document.getElementById('btn-modal-note-task');
  const taskDescriptionSection = indexDom.window.document.getElementById('task-advanced-section');
  assert(taskCategorySelect && taskCategorySelect.previousElementSibling?.textContent.includes('업무 분류'), '업무 등록 화면의 산업 분류가 업무 분류로 변경되지 않았습니다.');
  assert(taskCategorySelect.compareDocumentPosition(taskTitleInput) & indexDom.window.Node.DOCUMENT_POSITION_FOLLOWING, '업무 분류가 업무 등록 화면 최상단에 있지 않습니다.');
  assert(indexDom.window.document.getElementById('btn-open-task-category-settings') && indexDom.window.document.getElementById('modal-task-category-settings'), '업무 분류 설정 진입점 또는 설정 모달이 없습니다.');
  assert(taskDescriptionSection?.querySelector('summary')?.textContent.includes('업무 상세 설명'), '업무 상세 설명 섹션명이 올바르지 않습니다.');
  assert(!taskDescriptionSection?.textContent.includes('세부 메모'), '업무 상세 설명 영역에 이전 세부 메모 문구가 남아 있습니다.');
  assert(mainTaskNoteButton && taskTitleInput.parentElement?.contains(mainTaskNoteButton), '본 업무 제목 옆에 진행 메모 핀 버튼이 없습니다.');
  assert(mainTaskNoteButton.hidden && mainTaskNoteButton.classList.contains('hidden'), '신규 업무에서 본 업무 메모 핀 버튼이 숨겨지지 않았습니다.');
  assert(!indexDom.window.document.getElementById('btn-add-progress-note'), '하단 메모 추가 버튼이 남아 있습니다.');

  const monthPickerSource = fs.readFileSync(path.join(root, 'js/month-picker-controller.js'), 'utf8');
  indexDom.window.eval(monthPickerSource);
  assert(indexDom.window.MonthPickerController.init({ force: true }), 'Firefox 월 선택 fallback을 초기화하지 못했습니다.');
  const startMonthInput = indexDom.window.document.getElementById('filter-start-month');
  const startMonthButton = indexDom.window.document.querySelector('[aria-label="시작 월 선택"]');
  assert(startMonthButton, 'Firefox 월 선택 버튼이 생성되지 않았습니다.');
  startMonthButton.click();
  const monthPicker = indexDom.window.document.getElementById('month-picker-fallback');
  assert(monthPicker && monthPicker.getAttribute('aria-hidden') === 'false', 'Firefox 월 선택 팝업이 열리지 않았습니다.');
  monthPicker.querySelector('[data-month="7"]').click();
  assert(startMonthInput.value === `${new Date().getFullYear()}-07`, 'Firefox 월 선택 결과가 YYYY-MM 형식으로 반영되지 않았습니다.');
  assert(monthPicker.getAttribute('aria-hidden') === 'true', '월 선택 후 Firefox fallback 팝업이 닫히지 않았습니다.');

  const stateSource = fs.readFileSync(path.join(root, 'js/state.js'), 'utf8');
  assert(/let currentViewMode = ['"]CALENDAR['"]/.test(stateSource), '트래커 기본 진입 뷰가 캘린더가 아닙니다.');
  assert(/let currentCalMode = ['"]MONTH['"]/.test(stateSource), '캘린더 기본 진입 모드가 연간 보기가 아닙니다.');
  const desktopMonthModeButton = indexDom.window.document.getElementById('btn-cal-mode-day');
  const desktopYearModeButton = indexDom.window.document.getElementById('btn-cal-mode-month');
  const mobileMonthModeButton = indexDom.window.document.getElementById('btn-cal-mode-day-m');
  const mobileYearModeButton = indexDom.window.document.getElementById('btn-cal-mode-month-m');
  const desktopNotesViewButton = indexDom.window.document.getElementById('btn-view-notes');
  const mobileNotesViewButton = indexDom.window.document.getElementById('btn-view-notes-mobile');
  assert(desktopYearModeButton?.classList.contains('bg-white') && !desktopMonthModeButton?.classList.contains('bg-white'), '데스크톱 캘린더의 초기 활성 버튼이 연간 보기가 아닙니다.');
  assert(mobileYearModeButton?.classList.contains('bg-white') && !mobileMonthModeButton?.classList.contains('bg-white'), '모바일 캘린더의 초기 활성 버튼이 연간 보기가 아닙니다.');
  assert(desktopYearModeButton?.textContent.replace(/\s+/g, ' ').trim() === '연간 보기', '데스크톱 캘린더의 연간 보기 문구가 일관되지 않습니다.');
  assert(mobileYearModeButton?.textContent.trim() === '연간', '모바일 캘린더의 연간 문구가 일관되지 않습니다.');
  assert(desktopNotesViewButton?.textContent.trim() === '메모' && mobileNotesViewButton?.textContent.trim() === '메모', '데스크톱 또는 모바일 최상위 탐색에 메모 뷰 버튼이 없습니다.');
  assert(!indexDom.window.document.getElementById('btn-cal-mode-notes') && !indexDom.window.document.getElementById('btn-cal-mode-notes-m'), '캘린더 하위 모드에 이전 메모 버튼이 남아 있습니다.');
  assert(indexDom.window.document.getElementById('view-notes')?.contains(indexDom.window.document.getElementById('notes-content')), '독립 메모 뷰 콘텐츠 영역이 없습니다.');
  assert(indexDom.window.document.getElementById('btn-cal-ux-notes-only-m')?.getAttribute('aria-pressed') === 'false', '모바일 메모만 보기 토글의 초기 접근성 상태가 없습니다.');
  assert(indexDom.window.document.querySelector('#todo-calendar-section p')?.textContent.trim() === 'To-do 캘린더', 'To-do 캘린더 헤더가 한국어 UI 문구를 따르지 않습니다.');
  assert(indexDom.window.document.querySelector('#empty-state-kanban h3')?.textContent.trim() === '칸반에 표시할 업무가 없습니다.', '칸반 빈 상태 문구가 일관되지 않습니다.');
  const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const eventBindingsSource = fs.readFileSync(path.join(root, 'js/event-bindings.js'), 'utf8');
  const modalControllerSource = fs.readFileSync(path.join(root, 'js/modal-controller.js'), 'utf8');
  const tableRendererSource = fs.readFileSync(path.join(root, 'js/table-mobile-renderer.js'), 'utf8');
  const todoControllerSource = fs.readFileSync(path.join(root, 'js/todo-controller.js'), 'utf8');
  const todoServiceSource = fs.readFileSync(path.join(root, 'js/todo-service.js'), 'utf8');
  const calendarMobileSource = fs.readFileSync(path.join(root, 'js/calendar-mobile-renderer.js'), 'utf8');
  const kanbanRendererSource = fs.readFileSync(path.join(root, 'js/kanban-renderer.js'), 'utf8');
  const adminApprovalsSource = fs.readFileSync(path.join(root, 'js/admin-approvals.js'), 'utf8');
  const dateRiskSource = fs.readFileSync(path.join(root, 'js/date-risk-utils.js'), 'utf8');
  const inputCssSource = fs.readFileSync(path.join(root, 'src/input.css'), 'utf8');
  const batchDeleteButton = indexDom.window.document.getElementById('btn-batch-delete');
  const undoButton = indexDom.window.document.getElementById('btn-undo');
  assert(batchDeleteButton?.hidden && undoButton?.hidden, '일괄 삭제 또는 되돌리기 버튼의 초기 숨김 속성이 누락되었습니다.');
  assert(indexDom.window.document.querySelectorAll('#filter-search').length === 1 && !indexDom.window.document.getElementById('filter-search-desktop'), '업무 검색 입력이 하나의 통합 영역으로 정리되지 않았습니다.');
  const clearSearchButton = indexDom.window.document.getElementById('btn-clear-search');
  assert(clearSearchButton && indexDom.window.document.getElementById('filter-search')?.parentElement?.nextElementSibling === clearSearchButton, '검색창 옆에 검색어 전용 초기화 버튼이 없습니다.');
  assert(clearSearchButton.getAttribute('aria-label') === '검색어 지우기' && clearSearchButton.disabled, '검색어 초기화 버튼의 접근성 이름 또는 초기 비활성 상태가 올바르지 않습니다.');
  assert(indexDom.window.document.getElementById('unified-status-host') && indexDom.window.document.getElementById('unified-risk-host'), 'KPI와 Risk를 수용할 통합 현황 영역이 없습니다.');
  const dashboardRow = indexDom.window.document.getElementById('unified-dashboard-row');
  assert(dashboardRow?.contains(indexDom.window.document.getElementById('unified-status-host')) && dashboardRow?.contains(indexDom.window.document.getElementById('secondary-tools-menu')), '모바일에서 KPI와 도구가 같은 행에 배치되지 않았습니다.');
  assert(!dashboardRow.textContent.includes('업무 현황 및 필터') && !dashboardRow.textContent.includes('현황 확인과 업무 탐색'), '삭제하기로 한 통합 영역 제목 또는 설명이 남아 있습니다.');
  assert(indexDom.window.document.getElementById('unified-status-host').classList.contains('w-full') && indexDom.window.document.getElementById('unified-status-host').classList.contains('order-3'), '모바일 현황 버튼이 KPI와 도구 아래의 별도 행에 배치되지 않았습니다.');
  const secondaryTools = indexDom.window.document.getElementById('secondary-tools-menu');
  const tableSubTaskToggle = indexDom.window.document.getElementById('btn-toggle-all-table-subtasks');
  const taskDetailHeader = [...indexDom.window.document.querySelectorAll('#view-table th')]
    .find(header => header.textContent.includes('업무 상세'));
  assert(secondaryTools && !secondaryTools.open, '다운로드 및 백업 도구가 기본 접힘 상태가 아닙니다.');
  assert(tableSubTaskToggle && taskDetailHeader?.contains(tableSubTaskToggle), '목록 테이블 업무 상세 왼쪽에 서브 태스크 전체 펼치기 버튼이 없습니다.');
  assert(taskDetailHeader.querySelector('button')?.nextElementSibling?.textContent.includes('업무 상세'), '서브 태스크 전체 펼치기 버튼이 업무 상세 왼쪽에 배치되지 않았습니다.');
  assert(![...indexDom.window.document.querySelectorAll('#view-table th')].some(header => header.textContent.trim() === '작업'), '목록 테이블에 개별 삭제용 작업 열이 남아 있습니다.');
  assert(indexDom.window.document.getElementById('ux-tool-host'), '접힌 보조 도구 영역이 없습니다.');
  assert(indexDom.window.document.getElementById('primary-task-action-host'), '새 업무 버튼을 배치할 뷰 전환 행 영역이 없습니다.');
  assert(/function updateBatchButton\(\)[\s\S]*?supportsTaskSelectionActions\(\) && selectedTaskIds\.size > 0[\s\S]*?btn\.hidden = !shouldShow/.test(appSource), '일괄 삭제 버튼이 지원 화면에서만 실제로 표시되도록 제한되지 않았습니다.');
  assert(/function updateUndoButton\(\)[\s\S]*?supportsTaskSelectionActions\(\) && deletionHistory\.length > 0[\s\S]*?btn\.hidden = !shouldShow/.test(appSource), '되돌리기 버튼이 지원 화면에서만 실제로 표시되도록 제한되지 않았습니다.');
  assert(/const toolHost = document\.getElementById\('ux-tool-host'\)[\s\S]*?const primaryHost = document\.getElementById\('primary-task-action-host'\)/.test(appSource), '보조 도구와 새 업무 버튼 이동 로직이 누락되었습니다.');
  assert(/if \(status === 'ALL'\)[\s\S]*?statusFilter\.value = 'ALL'[\s\S]*?priorityFilter\.value = 'ALL'/.test(appSource), '전체 KPI 버튼이 Risk와 High 필터를 함께 해제하지 않습니다.');
  assert(/statusFilter\.value = statusFilter\.value === status \? 'ALL' : status/.test(appSource), '활성 상태 KPI 버튼을 다시 눌렀을 때 필터가 해제되지 않습니다.');
  assert(/priorityFilter\.value = priorityFilter\.value === priority \? 'ALL' : priority/.test(appSource), '활성 High KPI 버튼을 다시 눌렀을 때 필터가 해제되지 않습니다.');
  assert(/function getFilteredTasks\(options = \{\}\)[^]*!options\.ignoreDateRange[^]*getFilteredTasks\(\{ ignoreDateRange: true \}\)[^]*renderMobileCalendar\(filtered, noteTaskScope\)[^]*renderCalendar\(filtered, noteTaskScope\)/.test(appSource), '월간 메모 연결 업무 범위가 날짜 필터와 독립적으로 데스크톱·모바일 캘린더에 전달되지 않습니다.');
  assert(/function updateViewFilterContext[^]*mode === ['"]NOTES['"][^]*메모 기간/.test(appSource), '독립 메모 뷰가 공유 기간 필터의 문맥을 메모 기간으로 전환하지 않습니다.');
  assert(/currentViewMode===['"]NOTES['"][^]*getFilteredTasks\(\{ ignoreDateRange: true \}\)[^]*notes-content[^]*renderCalendarNotesView/.test(appSource), '독립 메모 뷰가 기간과 무관한 연결 업무 범위 또는 전용 콘텐츠 영역을 사용하지 않습니다.');
  assert(/btn-view-notes[^]*switchView[^]*NOTES[^]*btn-view-notes-mobile[^]*switchView[^]*NOTES/.test(eventBindingsSource), '데스크톱 또는 모바일 메모 뷰 전환 이벤트가 없습니다.');
  assert(/btn-clear-search[^]*searchInput\.value = ''[^]*dispatchEvent\(new Event\('input'/.test(eventBindingsSource), '검색어 전용 초기화 버튼이 다른 필터를 건드리지 않고 검색 입력 이벤트를 발생시키지 않습니다.');
  assert(/function resetFilters\(\)[^]*btn-clear-search[^]*disabled = true/.test(appSource), '전체 필터 초기화 후 검색어 초기화 버튼이 비활성 상태로 동기화되지 않습니다.');
  assert(/btn-toggle-all-table-subtasks[^]*addEventListener\('click',toggleAllTableSubTasks\)/.test(eventBindingsSource), '서브 태스크 전체 펼치기 버튼의 클릭 연결이 없습니다.');
  assert(/btn-list-note[^]*openTaskNoteFromList/.test(appSource), '목록 메모 핀의 클릭 연결이 없습니다.');
  assert(/btn-list-note-count[^]*openLatestListTaskNote/.test(appSource), '목록 메모 수 버튼의 최근 메모 연결이 없습니다.');
  assert(/btn-add-linked-todo[^]*openTodoModalForTask/.test(appSource) && /btn-edit-linked-todo[^]*openTodoModal/.test(appSource), '업무 목록의 To-do 등록 또는 수정 이벤트 연결이 없습니다.');
  assert(/function getTaskLinkedTodos[^]*function getLinkedTodosForCalendarMonth[^]*function buildLinkedTodoListHTML/.test(todoControllerSource), '연결 To-do의 목록·월간 캘린더 표시 도우미가 없습니다.');
  assert(/ownerId === ownerId/.test(todoControllerSource), '트래커 표시용 To-do가 현재 사용자 소유 범위로 제한되지 않습니다.');
  assert(/currentViewMode === 'TODO'[^]*renderTodoView[^]*renderActiveViews/.test(todoServiceSource), 'To-do 실시간 변경이 현재 트래커 목록·캘린더를 다시 렌더링하지 않습니다.');
  assert(/openTaskNoteFromList[^]*openTaskModal\(taskId\)[^]*openProgressNoteComposer/.test(modalControllerSource), '목록 메모 핀이 작성 폼과 기존 이력을 함께 여는 경로로 연결되지 않았습니다.');
  assert((modalControllerSource.match(/invalidateListProgressNoteSummary/g) || []).length >= 3, '메모 추가·수정·삭제 후 목록 메모 수 캐시가 갱신되지 않습니다.');
  assert(/buildTaskDetailCellHTML[^]*buildListNoteButtonHTML\(t.id\)/.test(appSource), '데스크톱 본 업무 제목 옆 메모 핀이 없습니다.');
  assert(tableRendererSource.includes('buildListNoteButtonHTML(t.id, st.id)'), '목록 서브 태스크 제목 옆 메모 핀이 없습니다.');
  assert(!tableRendererSource.includes('class="btn-delete'), '목록 렌더러에 개별 삭제 버튼이 남아 있습니다.');
  assert(!/#[0-9a-fA-F]{3,8}\//.test(inputCssSource), '다크 테마 CSS에 브라우저가 무시하는 hex/alpha 색상 문법이 남아 있습니다.');
  assert(indexDom.window.document.getElementById('tracker-access-section')?.className.includes('dark:bg-'), '트래커 권한 패널의 다크 테마 배경이 누락되었습니다.');
  assert(/kpi-compact-chip[^`]*dark:bg-/.test(appSource), '상단 KPI 배지의 다크 테마 배경이 누락되었습니다.');
  assert(/const mainClass[^]*dark:bg-/.test(appSource) && /const subClass[^]*dark:bg-/.test(appSource), '데스크톱 캘린더 막대의 다크 테마 상태색이 누락되었습니다.');
  assert(/function getIndustryBarClass[^]*dark:bg-/.test(dateRiskSource), '업무 분류별 캘린더 막대의 다크 테마 색상이 누락되었습니다.');
  assert(/function kanbanTone[^]*dark:bg-/.test(kanbanRendererSource), '칸반 열의 다크 테마 배경이 누락되었습니다.');
  const adminApprovalsView = indexDom.window.document.getElementById('view-admin-approvals');
  assert(adminApprovalsView?.className.includes('dark:bg-') && adminApprovalsView.className.includes('dark:border-'), '가입 승인 화면의 다크 테마 표면이 누락되었습니다.');
  assert(/data-admin-mobile-card="pending"[^>]*dark:bg-/.test(adminApprovalsSource), '모바일 승인 대기자 카드의 다크 테마 배경이 누락되었습니다.');
  assert(/data-admin-mobile-card="all"[^>]*dark:bg-/.test(adminApprovalsSource), '모바일 전체 가입자 카드의 다크 테마 배경이 누락되었습니다.');
  assert(/btnPending\.className = [^;]*dark:bg-slate-700/.test(adminApprovalsSource) && /btnAll\.className = [^;]*dark:bg-slate-700/.test(adminApprovalsSource), '가입 승인 탭 전환 시 활성 탭의 다크 테마가 유지되지 않습니다.');
  assert(tableRendererSource.includes('bg-indigo-50/80') && tableRendererSource.includes('dark:bg-indigo-950/35'), '목록 업무 분류 헤더의 다크 테마 배경이 누락되었습니다.');
  assert(calendarMobileSource.includes('bg-indigo-50/80') && calendarMobileSource.includes('dark:bg-indigo-950/35'), '모바일 캘린더 업무 분류 헤더의 다크 테마 배경이 누락되었습니다.');
  assert(calendarMobileSource.includes("btn-cal-ux-notes-only-m") && appSource.includes("btn-cal-ux-notes-only"), '데스크톱·모바일 메모만 보기 토글 연결이 누락되었습니다.');
  const modalDarkSurfaces = [...indexDom.window.document.querySelectorAll('[data-modal-dark-surface]')];
  assert(modalDarkSurfaces.length === 4, '조건부 업무·트래커 모달 다크 표면 식별자가 누락되었습니다.');
  assert(modalDarkSurfaces.every(surface => surface.className.includes('dark:bg-') && surface.className.includes('dark:border-')), '조건부 업무·트래커 모달에 다크 배경 또는 테두리가 누락되었습니다.');
  const recurrenceFormSurface = indexDom.window.document.querySelector('[data-task-recurrence-surface="form"]');
  assert(recurrenceFormSurface?.className.includes('dark:bg-slate-800') && recurrenceFormSurface.className.includes('dark:border-slate-700'), '하위 과제 실행 주기 등록 표면의 다크 계층이 누락되었습니다.');
  const recurrenceControls = [
    'input-subtask-recurrence-frequency',
    'input-subtask-recurrence-interval',
    'input-subtask-recurrence-end-type',
    'input-subtask-recurrence-until',
    'input-subtask-recurrence-count'
  ].map(id => indexDom.window.document.getElementById(id));
  assert(recurrenceControls.every(control => control?.className.includes('dark:bg-slate-900') && control.className.includes('dark:border-slate-700')), '하위 과제 실행 주기 입력 컨트롤의 다크 표면이 누락되었습니다.');
  assert(/data-task-recurrence-surface="occurrence-list"[^>]*dark:bg-indigo-950\/30/.test(modalControllerSource), '회차별 상태 패널의 다크 배경이 누락되었습니다.');
  assert(/data-task-recurrence-surface="occurrence-row"[^>]*dark:bg-violet-950\/40/.test(modalControllerSource), 'To-do 연결 회차 강조 행의 다크 배경이 누락되었습니다.');
  assert(/bg-rose-50\/70[^']*dark:bg-rose-950\/30/.test(tableRendererSource), 'High/Risk 목록 행의 다크 테마 강조가 누락되었습니다.');
  assert(/bg-amber-50\/50[^']*dark:bg-amber-950\/30/.test(tableRendererSource), '기한 초과 목록 행의 다크 테마 강조가 누락되었습니다.');
  assert(/bg-rose-50\/70[^']*dark:bg-rose-950\/25/.test(tableRendererSource), '기한 초과 서브 태스크 행의 다크 테마 강조가 누락되었습니다.');
  assert(/function getMobileRiskAccent[^]*dark:bg-rose-950\/30[^]*dark:bg-amber-950\/30/.test(tableRendererSource), '모바일 Risk·기한 초과 카드의 다크 테마 강조가 누락되었습니다.');
  assert(/mobile-bulk-action-bar[^]*bg-white\/95[^]*dark:bg-slate-900\/95/.test(tableRendererSource), '모바일 일괄 작업 바의 다크 테마 배경이 누락되었습니다.');

  indexDom.window.escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
  indexDom.window.isMasterAdmin = () => false;
  indexDom.window.currentUser = { uid: 'admin-current' };
  indexDom.window.eval(`${adminApprovalsSource}
    window.__renderAdminDashboardForSmoke = renderAdminDashboard;
    window.__initAdminTabEventsForSmoke = initAdminTabEvents;`);
  indexDom.window.__renderAdminDashboardForSmoke([
    { uid: 'pending-user', displayName: '승인 대기자', email: 'pending@example.com', status: 'pending', role: 'user', createdAt: { toDate: () => new Date('2026-07-31') } },
    { uid: 'approved-user', displayName: '승인 사용자', email: 'approved@example.com', status: 'approved', role: 'user', createdAt: { toDate: () => new Date('2026-07-30') } },
    { uid: 'rejected-user', displayName: '거부 사용자', email: 'rejected@example.com', status: 'rejected', role: 'user', createdAt: { toDate: () => new Date('2026-07-29') } }
  ]);
  const renderedAdminCards = [...indexDom.window.document.querySelectorAll('[data-admin-mobile-card]')];
  assert(renderedAdminCards.length === 4, '모바일 가입 승인 카드가 대기자·전체 가입자 패널에 렌더링되지 않았습니다.');
  assert(renderedAdminCards.every(card => card.className.includes('dark:bg-') && card.className.includes('dark:border-')), '렌더링된 모바일 가입 승인 카드에 다크 배경 또는 테두리가 누락되었습니다.');
  indexDom.window.__initAdminTabEventsForSmoke();
  indexDom.window.document.getElementById('btn-admin-tab-all').click();
  assert(indexDom.window.document.getElementById('btn-admin-tab-all').className.includes('dark:bg-slate-700'), '전체 가입자 활성 탭의 다크 배경이 누락되었습니다.');
  indexDom.window.document.getElementById('btn-admin-tab-pending').click();
  assert(indexDom.window.document.getElementById('btn-admin-tab-pending').className.includes('dark:bg-slate-700'), '승인 대기자 활성 탭의 다크 배경이 누락되었습니다.');

  loadScript('js/date-risk-utils.js');
  loadScript('js/calendar-utils.js');
  loadScript('js/calendar-day-renderer.js');
  loadScript('js/calendar-summary-renderer.js');
  loadScript('js/calendar-notes-renderer.js');
  loadScript('js/calendar-mobile-renderer.js');
  loadScript('js/table-mobile-renderer.js');

  const tasks = makeTasks();
  const outsideMonthTask = {
    id: 'task-outside-month',
    title: '4월 종료 업무',
    status: 'COMPLETED',
    priority: 'NORMAL',
    industry: 'PHARMA',
    startDate: '2026-04-01',
    dueDate: '2026-04-30',
    assignee: ['이매니저'],
    subTasks: []
  };
  await global.ensureListProgressNoteSummaryLoaded(global.currentTrackerId);
  assert(global.getListProgressNoteSummary('task-1').count === 3, '본 업무의 메모 수가 정확히 집계되지 않습니다.');
  assert(global.getListProgressNoteSummary('task-1__sub_sub-1').count === 1, '서브 태스크의 메모 수가 정확히 집계되지 않습니다.');
  const calendarMonthNotes = global.getCalendarProgressNotesForMonth(
    global.getCachedTrackerProgressNotes(global.currentTrackerId),
    [...tasks.slice(0, 2), outsideMonthTask],
    2026,
    6
  );
  assert(calendarMonthNotes.length === 4, '월간 캘린더 메모가 기록일과 연결 업무 기준으로 필터링되지 않았습니다.');
  assert(calendarMonthNotes.find(note => note.id === 'note-sub-latest')?.subTaskTitle, '월간 캘린더 하위 업무 메모에 정확한 하위 업무 연결 정보가 없습니다.');
  global.openLatestListTaskNote('task-1');
  assert(openedListNote?.id === 'note-main-latest', '메모 수 버튼이 본 업무의 가장 최근 메모를 열지 않습니다.');
  const tableBody = document.getElementById('task-table-body');
  tableBody.innerHTML = `
    <button class="btn-toggle-subtasks" data-id="task-1" data-expanded="false"></button>
    <button class="btn-toggle-subtasks" data-id="task-2" data-expanded="false"></button>
  `;
  global.updateTableSubTaskToggleButton();
  assert(document.querySelector('[data-table-subtask-toggle-label]').textContent === '전체 펼치기', '일괄 버튼이 접힌 목록에서 전체 펼치기로 표시되지 않습니다.');
  global.toggleAllTableSubTasks();
  assert(global.expandedTaskIds.has('task-1') && global.expandedTaskIds.has('task-2'), '일괄 버튼이 보이는 업무의 서브 태스크를 모두 펼치지 않습니다.');
  tableBody.querySelectorAll('.btn-toggle-subtasks').forEach(toggle => { toggle.dataset.expanded = 'true'; });
  global.updateTableSubTaskToggleButton();
  assert(document.querySelector('[data-table-subtask-toggle-label]').textContent === '전체 접기', '모두 펼친 목록에서 일괄 버튼이 전체 접기로 바뀌지 않습니다.');
  global.toggleAllTableSubTasks();
  assert(global.collapsedTaskIds.has('task-1') && global.collapsedTaskIds.has('task-2'), '일괄 버튼이 보이는 업무의 서브 태스크를 모두 접지 않습니다.');
  tableBody.innerHTML = '';
  global.expandedTaskIds.clear();
  global.collapsedTaskIds.clear();
  global.renderCalendarDayView({
    weekdayHeader: document.getElementById('calendar-weekday-header'),
    grid: document.getElementById('calendar-grid'),
    year: 2026,
    month: 6,
    todayStr: '2026-07-12',
    totalCalLanes: 7,
    groups: [
      {
        id: 'late-lane-first-week',
        title: '첫 주 높은 논리 lane 업무',
        status: 'PENDING',
        priority: 'NORMAL',
        startDate: '2026-07-01',
        dueDate: '2026-07-02',
        globalLineStart: 6,
        categoryHeaderLine: 5,
        categoryGroupKey: 'FNB',
        categoryGroupLabel: '식음료',
        categoryTaskCount: 1,
        industry: 'FNB',
        assignee: ['담당자'],
        notes: '',
        monthSubTasks: []
      },
      {
        id: 'early-lane-later-week',
        title: '후반 주 업무',
        status: 'PENDING',
        priority: 'NORMAL',
        startDate: '2026-07-20',
        dueDate: '2026-07-20',
        globalLineStart: 1,
        categoryHeaderLine: 0,
        categoryGroupKey: 'PHARMA',
        categoryGroupLabel: '제약',
        categoryTaskCount: 1,
        industry: 'PHARMA',
        assignee: ['담당자'],
        notes: '',
        monthSubTasks: []
      }
    ],
    monthNotes: [
      ...calendarMonthNotes,
      {
        id: 'note-day-one',
        taskId: 'late-lane-first-week',
        title: '월간 캘린더 첫날 메모',
        calendarDateKey: '2026-07-01',
        calendarTaskLabel: '첫 주 높은 논리 lane 업무'
      }
    ],
    showSubTaskBars: true,
    mainClass: () => 'bg-slate-200 text-slate-700',
    dimIfNotCritical: () => '',
    useIndustryColor: false
  });
  const weekLaneCounts = document.getElementById('calendar-grid').dataset.weekLaneCounts.split(',').map(Number);
  const compactedFirstWeekBar = document.querySelector('#calendar-grid [data-week-index="0"][data-logical-lane="6"]');
  assert(weekLaneCounts[0] === 2, `첫 주에 활성 업무 분류 헤더와 업무 외 빈 줄이 남아 있습니다: ${weekLaneCounts[0]}`);
  assert(document.querySelector('#calendar-grid [data-calendar-category-header="FNB"]'), '캘린더의 최상위 업무 분류 헤더가 없습니다.');
  assert(compactedFirstWeekBar?.dataset.compactLane === '1', '첫 주의 높은 논리 lane 업무가 활성 업무 분류 헤더 바로 아래로 압축되지 않았습니다.');
  assert(compactedFirstWeekBar?.style.top === '76px', `첫 주 메모 행과 업무 막대가 겹치거나 비활성 업무 분류 빈 줄이 남아 있습니다: ${compactedFirstWeekBar?.style.top}`);
  assert(document.querySelectorAll('#calendar-grid [data-calendar-note-id]').length === 5, '데스크톱 월간 캘린더에 메모가 날짜별로 표시되지 않았습니다.');
  assert(document.querySelector('#calendar-grid [data-calendar-note-id="note-outside-task-range"]'), '태스크 일정 밖 실행일의 메모가 데스크톱 월간 캘린더에 표시되지 않았습니다.');
  const desktopCalendarNote = document.querySelector('#calendar-grid [data-calendar-note-id="note-sub-latest"]');
  assert(desktopCalendarNote?.className.includes('dark:bg-'), '데스크톱 월간 캘린더 메모에 다크 테마 클래스가 없습니다.');
  desktopCalendarNote.click();
  assert(openedListNote?.id === 'note-sub-latest', '데스크톱 월간 캘린더 메모 클릭 시 메모 상세가 열리지 않습니다.');
  global.renderCalendarDayView({
    weekdayHeader: document.getElementById('calendar-weekday-header'),
    grid: document.getElementById('calendar-grid'),
    year: 2026,
    month: 6,
    todayStr: '2026-07-12',
    groups: [{
      id: 'hidden-in-notes-only',
      title: '메모만 보기에서 숨길 업무',
      status: 'PENDING',
      priority: 'NORMAL',
      startDate: '2026-07-01',
      dueDate: '2026-07-31',
      globalLineStart: 1,
      categoryHeaderLine: 0,
      categoryGroupKey: 'GENERAL',
      categoryGroupLabel: '일반',
      categoryTaskCount: 1,
      assignee: ['담당자'],
      monthSubTasks: []
    }],
    monthNotes: calendarMonthNotes,
    notesOnly: true,
    showSubTaskBars: true,
    mainClass: () => 'bg-slate-200 text-slate-700',
    dimIfNotCritical: () => '',
    useIndustryColor: false
  });
  assert(document.getElementById('calendar-grid').dataset.notesOnly === 'true', '데스크톱 월간 캘린더에 메모만 보기 상태가 반영되지 않았습니다.');
  assert(!document.querySelector('#calendar-grid [data-week-index]') && !document.querySelector('#calendar-grid [data-calendar-category-header]'), '데스크톱 메모만 보기에서 업무 막대 또는 분류 헤더가 남아 있습니다.');
  assert(document.querySelectorAll('#calendar-grid [data-calendar-note-id]').length === 4, '데스크톱 메모만 보기에서 월간 메모가 유지되지 않았습니다.');

  const cancelledTask = {
    id: 'task-cancelled',
    title: '취소 상태 회귀 테스트',
    status: 'CANCELLED',
    priority: 'HIGH',
    startDate: '2026-06-01',
    dueDate: '2026-07-05',
    assignee: ['김BD'],
    subTasks: [
      { id: 'cancelled-sub-1', title: '취소 업무의 미완료 하위 업무', status: 'PENDING', startDate: '2026-06-01', dueDate: '2026-06-15', assignee: ['김BD'] }
    ]
  };
  const taskWithCancelledSubTask = {
    id: 'task-with-cancelled-subtask',
    title: '취소 하위 업무 회귀 테스트',
    status: 'PENDING',
    priority: 'NORMAL',
    startDate: '2026-07-01',
    dueDate: '2026-07-31',
    assignee: ['박엔지니어'],
    subTasks: [
      { id: 'active-completed-sub', title: '완료된 유효 하위 업무', status: 'COMPLETED', startDate: '2026-07-01', dueDate: '2026-07-10', assignee: ['박엔지니어'] },
      { id: 'cancelled-sub', title: '취소된 하위 업무', status: 'CANCELLED', startDate: '2026-06-01', dueDate: '2026-06-15', assignee: ['박엔지니어'] }
    ]
  };

  assert(global.normalizeStatus('CANCELLED') === 'CANCELLED', '취소 상태가 스키마에서 유지되지 않습니다.');
  assert(global.getEffectiveStatus(cancelledTask, '2026-07-12') === 'CANCELLED', '취소 업무의 운영 상태가 올바르지 않습니다.');
  assert(global.isTaskOverdueEffective(cancelledTask, '2026-07-12') === false, '취소 업무가 기한 초과로 계산됩니다.');
  assert(global.getTaskRiskInfo(cancelledTask, '2026-07-12').level === 'NONE', '취소 업무가 위험 업무로 계산됩니다.');
  assert(global.isSubTaskOverdue(taskWithCancelledSubTask.subTasks[1], '2026-07-12') === false, '취소 하위 업무가 기한 초과로 계산됩니다.');
  assert(global.getSubTaskCompletionCounts(taskWithCancelledSubTask).active === 1, '취소 하위 업무가 진행률 분모에 포함됩니다.');
  assert(global.getTaskProgress(taskWithCancelledSubTask) === 100, '취소 하위 업무를 제외한 진행률이 올바르지 않습니다.');
  assert(global.getEffectiveStatus(taskWithCancelledSubTask, '2026-07-12') === 'COMPLETED', '취소 하위 업무를 제외한 운영 상태가 올바르지 않습니다.');

  global.renderMobileCards(tasks.slice(0, 2));
  assert(document.querySelectorAll('.mobile-task-card').length === 2, '모바일 목록 카드가 렌더링되지 않았습니다.');
  const progressTaskCard = document.querySelector('.mobile-task-card[data-id="task-1"]');
  assert(progressTaskCard?.textContent.includes('기한 초과'), '모바일 목록의 계산된 기한 초과 운영 상태가 표시되지 않았습니다.');
  assert(progressTaskCard?.querySelector('.mobile-status-btn[data-status="PROGRESS"]')?.getAttribute('aria-pressed') === 'true', '기한 초과된 진행 중 업무가 모바일 상태 선택기에서 대기로 표시됩니다.');
  assert(progressTaskCard?.querySelector('.mobile-status-btn[data-status="PENDING"]')?.getAttribute('aria-pressed') === 'false', '기한 초과된 진행 중 업무의 대기 상태가 모바일에서 잘못 활성화됩니다.');
  assert(document.querySelectorAll('#task-card-container [data-task-category-group]').length === 2, '모바일 목록이 업무 분류 최상위 그룹으로 나뉘지 않았습니다.');
  assert([...document.querySelectorAll('#task-card-container [data-task-category-group]')].every(header => header.className.includes('dark:bg-') && header.className.includes('dark:text-')), '모바일 목록 업무 분류 헤더에 다크 테마 클래스가 적용되지 않았습니다.');
  assert(global.getIndustryBarClass(tasks[0], false).includes('dark:bg-'), '업무 분류별 본 업무 막대에 다크 테마 클래스가 적용되지 않았습니다.');
  assert(global.getIndustryBarClass(tasks[0], true).includes('dark:bg-'), '업무 분류별 하위 업무 막대에 다크 테마 클래스가 적용되지 않았습니다.');
  assert([...document.querySelectorAll('.mobile-task-card')].every(card => card.className.includes('dark:bg-')), '모바일 목록 카드에 명시적 다크 테마 배경이 적용되지 않았습니다.');
  const mobileRiskBanner = progressTaskCard?.querySelector('[data-mobile-risk-banner]');
  assert(mobileRiskBanner, '모바일 고위험 업무의 Risk 배너가 렌더링되지 않았습니다.');
  assert(
    mobileRiskBanner.className.includes('dark:border-rose-800')
      && mobileRiskBanner.className.includes('dark:bg-rose-950/40')
      && mobileRiskBanner.className.includes('dark:text-rose-300'),
    '모바일 Risk 배너의 다크 테마 표면 스타일이 누락되었습니다.'
  );
  const mobileSubTaskGroup = [...document.querySelectorAll('#task-card-container div')].find(element => element.className.includes('bg-slate-50/80'));
  assert(mobileSubTaskGroup?.className.includes('dark:bg-'), '모바일 하위 업무 컨테이너의 다크 테마 배경이 누락되었습니다.');
  assert(document.getElementById('mobile-bulk-action-bar')?.className.includes('dark:bg-'), '렌더링된 모바일 일괄 작업 바의 다크 테마 배경이 누락되었습니다.');
  assert(!document.querySelector('.mobile-command-deck'), '모바일 목록에 중복 Focus 및 Risk 제어 영역이 남아 있습니다.');
  assert(document.querySelector('#task-card-container .btn-list-note[data-task-id="task-1"]:not([data-subtask-id])'), '모바일 본 업무 제목 옆 메모 핀이 없습니다.');
  assert(document.querySelector('#task-card-container .btn-list-note[data-task-id="task-1"][data-subtask-id="sub-1"]'), '모바일 서브 태스크 제목 옆 메모 핀이 없습니다.');
  assert(document.querySelector('#task-card-container .btn-list-note-count[data-task-id="task-1"]')?.textContent.trim() === '3', '모바일 본 업무 메모 수가 핀 옆에 표시되지 않습니다.');
  assert(document.querySelector('#task-card-container .btn-list-note-count[data-task-id="task-1__sub_sub-1"]')?.textContent.trim() === '1', '모바일 서브 태스크 메모 수가 핀 옆에 표시되지 않습니다.');
  assert(!document.querySelector('#task-card-container .btn-delete'), '모바일 목록에 개별 삭제 버튼이 남아 있습니다.');
  assert(document.querySelector('.btn-toggle-subtasks[data-expanded="true"]'), '하위 업무 펼침 상태가 렌더링되지 않았습니다.');
  assert(document.querySelector('.line-clamp-2'), '긴 업무명 줄임 클래스가 누락되었습니다.');
  global.selectedTaskIds.add(tasks[0].id);
  global.currentViewMode = 'CALENDAR';
  global.updateMobileBulkActionBar();
  assert(document.getElementById('mobile-bulk-action-bar').classList.contains('hidden'), '캘린더에서 모바일 일괄 작업 바가 표시됩니다.');
  global.currentViewMode = 'TABLE';
  global.updateMobileBulkActionBar();
  assert(!document.getElementById('mobile-bulk-action-bar').classList.contains('hidden'), '목록에서 모바일 일괄 작업 바가 표시되지 않습니다.');
  global.currentViewMode = 'KANBAN';
  global.updateMobileBulkActionBar();
  assert(!document.getElementById('mobile-bulk-action-bar').classList.contains('hidden'), '칸반에서 모바일 일괄 작업 바가 표시되지 않습니다.');
  global.currentViewMode = 'ADMIN';
  global.updateMobileBulkActionBar();
  assert(document.getElementById('mobile-bulk-action-bar').classList.contains('hidden'), '관리 화면에서 모바일 일괄 작업 바가 표시됩니다.');
  global.selectedTaskIds.clear();
  global.currentViewMode = 'TABLE';

  global.renderMobileCards([cancelledTask]);
  assert(document.getElementById('task-card-container').textContent.includes('취소'), '모바일 목록에 취소 상태가 표시되지 않습니다.');
  assert(document.querySelector('.mobile-status-btn[data-status="CANCELLED"]'), '모바일 목록에 취소 상태 버튼이 없습니다.');

  global.expandedTaskIds.add(taskWithCancelledSubTask.id);
  global.renderMobileCards([taskWithCancelledSubTask]);
  assert(document.getElementById('task-card-container').textContent.includes('취소 1'), '모바일 목록에 취소 하위 업무 집계가 없습니다.');
  assert(document.querySelector('.sel-subtask-status option[value="CANCELLED"]'), '하위 업무 상태 선택에 취소가 없습니다.');

  global.currentCalMode = 'DAY';
  window.renderMobileCalendar(tasks.slice(0, 2), [...tasks.slice(0, 2), outsideMonthTask]);
  assert(document.getElementById('cal-mobile-month-year').textContent.includes('2026년 7월'), '모바일 월간 헤더가 올바르지 않습니다.');
  assert(document.querySelectorAll('#cal-mobile-content .mobile-cal-card').length >= 1, '모바일 월간 업무 카드가 없습니다.');
  assert(document.querySelector('#cal-mobile-content [data-mobile-calendar-category]'), '모바일 일별 캘린더에 업무 분류 헤더가 없습니다.');
  assert(document.querySelector('#cal-mobile-content [data-mobile-calendar-category]').className.includes('dark:bg-'), '모바일 일별 캘린더 업무 분류 헤더의 다크 테마 클래스가 누락되었습니다.');
  assert(document.getElementById('cal-mobile-content').textContent.includes('월간 정기 완료 체크'), '반복 하위 업무가 모바일 월간에 반영되지 않았습니다.');
  const mobileCalendarNotes = document.querySelectorAll('#cal-mobile-content [data-calendar-note-id]');
  assert(mobileCalendarNotes.length === 4, '태스크 일정 밖 실행일의 메모가 모바일 월간 캘린더에 표시되지 않았습니다.');
  assert(document.querySelector('#cal-mobile-content [data-calendar-note-id="note-outside-task-range"]'), '태스크 일정 밖 실행일의 메모 식별자가 모바일 월간 캘린더에 없습니다.');
  assert([...mobileCalendarNotes].every(button => button.className.includes('min-h-11') && button.className.includes('dark:bg-')), '모바일 월간 메모의 터치 영역 또는 다크 테마 클래스가 누락되었습니다.');
  document.querySelector('#cal-mobile-content [data-calendar-note-id="note-main-older"]').click();
  assert(openedListNote?.id === 'note-main-older', '모바일 월간 캘린더 메모 클릭 시 메모 상세가 열리지 않습니다.');
  const mobileCalendarTodo = document.querySelector('#cal-mobile-content [data-calendar-todo-id="todo-linked-calendar"]');
  assert(mobileCalendarTodo, '연결된 개인 To-do가 모바일 트래커 월간 캘린더에 표시되지 않습니다.');
  assert(mobileCalendarTodo.textContent.includes('연결된 개인 To-do') && mobileCalendarTodo.textContent.includes('☐'), '월간 캘린더 To-do가 메모와 다른 아이콘 또는 제목을 표시하지 않습니다.');
  assert(mobileCalendarTodo.className.includes('dark:bg-violet-950'), '월간 캘린더 To-do에 명시적 다크 테마 배경이 없습니다.');
  mobileCalendarTodo.click();
  assert(openedCalendarTodoId === 'todo-linked-calendar', '월간 캘린더 To-do 클릭 시 기존 To-do 모달이 열리지 않습니다.');
  window.calendarUxState.notesOnly = true;
  window.renderMobileCalendar(tasks.slice(0, 2), [...tasks.slice(0, 2), outsideMonthTask]);
  assert(document.getElementById('btn-cal-ux-notes-only-m').getAttribute('aria-pressed') === 'true', '모바일 메모만 보기 토글의 활성 상태가 전달되지 않았습니다.');
  assert(!document.getElementById('calendar-notes-only-control-m').hidden, '모바일 월간 모드에서 메모만 보기 토글이 숨겨져 있습니다.');
  assert(document.getElementById('cal-mobile-content').dataset.notesOnly === 'true', '모바일 월간 콘텐츠에 메모만 보기 상태가 반영되지 않았습니다.');
  assert(document.querySelectorAll('#cal-mobile-content .mobile-cal-card').length === 0 && document.querySelectorAll('#cal-mobile-content [data-mobile-calendar-category]').length === 0, '모바일 메모만 보기에서 업무 카드 또는 분류 헤더가 남아 있습니다.');
  assert(document.querySelectorAll('#cal-mobile-content [data-calendar-note-id]').length === 4, '모바일 메모만 보기에서 월간 메모가 유지되지 않았습니다.');
  assert(document.querySelectorAll('#cal-mobile-content [data-calendar-todo-id]').length === 0, '메모만 보기에서 별도 유형인 To-do가 남아 있습니다.');
  window.calendarUxState.notesOnly = false;

  global.currentCalMode = 'MONTH';
  window.renderMobileCalendar(tasks);
  assert(document.getElementById('calendar-notes-only-control-m').hidden, '모바일 연간 모드에서 메모만 보기 토글이 노출됩니다.');
  const yearText = document.getElementById('cal-mobile-content').textContent;
  assert(yearText.includes('2026년 연간 타임라인'), '모바일 연간 간트 헤더가 없습니다.');
  assert(/주요 \d+\/14|총 14개/.test(yearText), '모바일 연간 밀집 상태 배지가 없습니다.');
  assert(document.querySelectorAll('#cal-mobile-content [data-mobile-calendar-category]').length >= 2, '모바일 연간 캘린더에 업무 분류 그룹이 없습니다.');
  assert(document.querySelectorAll('#cal-mobile-content [title$="월 일별 보기로 이동"]').length >= 12, '월 축 이동 타깃이 부족합니다.');
  const mobileYearGantt = document.querySelector('[data-mobile-year-gantt]');
  assert(mobileYearGantt?.dataset.layoutFits === 'true', `390px 연간 간트 계산 폭(${mobileYearGantt?.dataset.layoutWidth})이 가용 폭(${mobileYearGantt?.dataset.availableWidth})을 넘습니다.`);

  global.currentCalMode = 'SUMMARY';
  await global.renderCalendarSummaryView({
    grid: document.getElementById('cal-mobile-content'),
    year: 2026,
    month: 6,
    filteredTasks: [...tasks, cancelledTask],
    noteTaskScope: [...tasks, cancelledTask, outsideMonthTask],
    todayStr: '2026-07-12'
  });
  const summary = document.getElementById('cal-mobile-content');
  assert(summary.className.includes('bg-white'), '모바일 월별 요약 배경 클래스가 없습니다.');
  assert(summary.textContent.includes('이번 달 메모 리뷰'), '월별 요약 메모 섹션이 없습니다.');
  assert(summary.textContent.includes('총 4건'), '태스크 일정 밖 실행일의 메모가 월별 요약 통계에 포함되지 않았습니다.');
  assert(summary.textContent.includes('일정 밖 실행 메모'), '태스크 일정 밖 실행일의 메모가 월별 요약에 표시되지 않았습니다.');
  assert(summary.textContent.includes('2026년 7월 10일'), '사용자가 지정한 메모 기록일이 월별 요약에 반영되지 않았습니다.');
  assert(summary.textContent.includes('고객사 ACME'), '메모 고객사 정보가 월별 요약에 표시되지 않았습니다.');
  assert(summary.textContent.includes('Opp OPP-101'), '메모 Opp No가 월별 요약에 표시되지 않았습니다.');
  assert(summary.textContent.includes('Customer Visit'), '메모 업무 유형이 월별 요약에 표시되지 않았습니다.');
  assert(summary.textContent.includes('💬 1'), '메모 리뷰 코멘트 수가 월별 요약에 표시되지 않았습니다.');
  const summaryStatusGroups = [...summary.querySelectorAll('[data-summary-status-group]')];
  assert(summaryStatusGroups.length > 0, '월별 요약 상태별 업무 그룹이 없습니다.');
  assert(summaryStatusGroups.every(group => group.className.includes('dark:bg-') && group.className.includes('dark:border-') && group.className.includes('dark:text-')), '월별 요약 상태별 업무 그룹의 다크 테마 스타일이 누락되었습니다.');
  const summaryDarkBadges = [...summary.querySelectorAll('[data-summary-dark-badge]')];
  assert(summaryDarkBadges.length > 0 && summaryDarkBadges.every(badge => badge.className.includes('dark:bg-') && badge.className.includes('dark:text-')), '월별 요약 업무 배지의 다크 테마 스타일이 누락되었습니다.');
  const summaryAuthorFilter = summary.querySelector('[data-summary-note-author-filter]');
  const summaryWorkTypeFilter = summary.querySelector('[data-summary-note-work-type-filter]');
  assert(summaryWorkTypeFilter && summaryAuthorFilter?.parentElement === summaryWorkTypeFilter.parentElement, '업무 유형 필터가 작성자 필터 옆에 배치되지 않았습니다.');
  assert(summaryWorkTypeFilter.querySelector('option[value="CUSTOMER_VISIT"]')?.textContent === 'Customer Visit', '월별 요약 업무 유형 필터 옵션이 올바르지 않습니다.');
  summaryWorkTypeFilter.value = 'CUSTOMER_VISIT';
  summaryWorkTypeFilter.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert(summary.querySelectorAll('[data-summary-note-entry]').length === 1, '업무 유형 필터가 해당 유형의 메모만 표시하지 않습니다.');
  summaryWorkTypeFilter.value = 'all';
  summaryWorkTypeFilter.dispatchEvent(new window.Event('change', { bubbles: true }));
  const importantToggle = summary.querySelector('[data-summary-note-important]');
  const commentsToggle = summary.querySelector('[data-summary-note-comments]');
  assert(commentsToggle && importantToggle?.nextElementSibling === commentsToggle, '댓글 있음 토글이 중요만 토글 오른쪽에 배치되지 않았습니다.');
  assert(importantToggle.classList.contains('whitespace-nowrap') && commentsToggle.classList.contains('whitespace-nowrap'), '월별 요약 토글 버튼 문구의 한 줄 유지 스타일이 없습니다.');
  commentsToggle.click();
  assert(summary.querySelectorAll('[data-summary-note-entry]').length === 1, '댓글 있음 토글이 코멘트가 있는 메모만 표시하지 않습니다.');
  assert(summary.textContent.includes('리스크 회의 결과'), '댓글 있음 필터 결과에 코멘트가 있는 메모가 없습니다.');
  commentsToggle.click();
  assert(summary.querySelectorAll('[data-summary-note-card]').length === 3, '본 업무, 하위 업무, 일정 밖 연결 업무의 메모가 서로 다른 태스크 카드로 분리되지 않았습니다.');
  const taskNoteEntries = [...summary.querySelector('[data-task-id="task-1"]')?.querySelectorAll('[data-summary-note-entry]') || []];
  assert(taskNoteEntries.length === 2, '본 업무 카드 안에 동일 태스크의 메모가 모두 표시되지 않았습니다.');
  assert(taskNoteEntries.map(entry => entry.textContent).join('|').match(/후속 검토.*리스크 회의 결과/s), '본 업무 카드 안의 메모가 기록일 최신순으로 정렬되지 않았습니다.');
  assert(summary.querySelector('[data-task-id="task-1__sub_sub-1"]')?.querySelectorAll('[data-summary-note-entry]').length === 1, '하위 업무 메모가 해당 하위 업무 카드에 분리되지 않았습니다.');
  assert(summary.textContent.includes('취소 1'), '월별 요약에 취소 업무 집계가 없습니다.');

  global.currentViewMode = 'NOTES';
  window.currentViewMode = 'NOTES';
  document.getElementById('filter-start-month').value = '2026-06';
  document.getElementById('filter-end-month').value = '2026-07';
  await global.renderCalendarNotesView({
    grid: document.getElementById('notes-content'),
    year: 2030,
    month: 0,
    noteTaskScope: [...tasks, cancelledTask, outsideMonthTask]
  });
  const notesView = document.getElementById('notes-content');
  assert(notesView.querySelector('[data-calendar-notes-view]'), '기간별 메모 리스트 뷰가 렌더링되지 않았습니다.');
  assert(notesView.querySelectorAll('[data-calendar-note-list-item]').length === 5, '메모 뷰가 선택 월과 무관하게 지정 기간의 메모를 표시하지 않습니다.');
  assert(notesView.textContent.includes('2026년 6월 – 2026년 7월 메모'), '메모 뷰에 적용된 조회 기간이 표시되지 않습니다.');

  document.getElementById('filter-start-month').value = '2026-07';
  document.getElementById('filter-end-month').value = '2026-07';
  await global.renderCalendarNotesView({
    grid: document.getElementById('notes-content'),
    year: 2030,
    month: 0,
    noteTaskScope: [...tasks, cancelledTask, outsideMonthTask]
  });
  assert(notesView.querySelectorAll('[data-calendar-note-list-item]').length === 4, '메모 뷰가 일정 밖 실행 메모를 포함한 월간 메모 전체를 표시하지 않습니다.');
  assert(notesView.textContent.includes('일정 밖 실행 메모'), '메모 뷰에 태스크 일정 밖 실행일의 메모가 없습니다.');
  const notesWorkTypeFilter = notesView.querySelector('[data-calendar-notes-work-type]');
  assert(notesWorkTypeFilter?.querySelector('option[value="CUSTOMER_VISIT"]')?.textContent === 'Customer Visit', '메모 뷰 유형 필터 옵션이 올바르지 않습니다.');
  notesWorkTypeFilter.value = 'CUSTOMER_VISIT';
  notesWorkTypeFilter.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert(notesView.querySelectorAll('[data-calendar-note-list-item]').length === 1, '메모 뷰 유형 필터가 선택한 유형만 표시하지 않습니다.');
  notesWorkTypeFilter.value = 'all';
  notesWorkTypeFilter.dispatchEvent(new window.Event('change', { bubbles: true }));
  const notesCommentsToggle = notesView.querySelector('[data-calendar-notes-comments-only]');
  notesCommentsToggle.click();
  assert(notesCommentsToggle.getAttribute('aria-pressed') === 'true', '메모 뷰 댓글 토글의 접근성 상태가 반영되지 않습니다.');
  assert(notesView.querySelectorAll('[data-calendar-note-list-item]').length === 1 && notesView.textContent.includes('리스크 회의 결과'), '메모 뷰 댓글 필터가 댓글 있는 메모만 표시하지 않습니다.');
  notesCommentsToggle.click();
  notesView.querySelector('[data-note-id="note-outside-task-range"]').click();
  assert(openedListNote?.id === 'note-outside-task-range', '메모 리스트 항목 클릭 시 기존 메모 상세 패널이 열리지 않습니다.');

  const originalFetchTrackerNotes = window.db_fetchTrackerProgressNotes;
  window.db_fetchTrackerProgressNotes = async () => Array.from({ length: 25 }, (_, index) => ({
    id: `note-page-${index + 1}`,
    taskId: 'task-1',
    title: `페이지 메모 ${index + 1}`,
    body: '20건 단위 페이지 이동 검증',
    createdByName: 'pagination@example.com',
    noteDate: `2026-07-${String(index + 1).padStart(2, '0')}`,
    createdAt: new Date(`2026-07-${String(index + 1).padStart(2, '0')}T09:00:00+09:00`)
  }));
  await global.renderCalendarNotesView({
    grid: document.getElementById('notes-content'),
    noteTaskScope: tasks
  });
  const pagination = notesView.querySelector('[data-calendar-notes-pagination]');
  assert(notesView.querySelectorAll('[data-calendar-note-list-item]').length === 20, '메모 첫 페이지가 20건으로 제한되지 않습니다.');
  assert(pagination?.classList.contains('flex') && !pagination.classList.contains('hidden'), '메모가 20건을 초과해도 페이지 이동 영역이 표시되지 않습니다.');
  assert(notesView.querySelector('[data-calendar-notes-page-status]')?.textContent.trim() === '1 / 2 페이지', '메모 첫 페이지 상태가 올바르지 않습니다.');
  notesView.querySelector('[data-calendar-notes-next]').click();
  assert(notesView.querySelectorAll('[data-calendar-note-list-item]').length === 5, '메모 두 번째 페이지에 나머지 5건이 표시되지 않습니다.');
  assert(notesView.querySelector('[data-calendar-notes-page-status]')?.textContent.trim() === '2 / 2 페이지', '메모 다음 페이지 이동 상태가 올바르지 않습니다.');
  notesView.querySelector('[data-calendar-notes-prev]').click();
  assert(notesView.querySelectorAll('[data-calendar-note-list-item]').length === 20, '메모 이전 페이지 이동이 첫 페이지를 복원하지 않습니다.');
  window.db_fetchTrackerProgressNotes = originalFetchTrackerNotes;

  console.log('mobile smoke passed: calendar default, task and subtask cancelled status, list, calendar day, calendar year, summary, notes');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
