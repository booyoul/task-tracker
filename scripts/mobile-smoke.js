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
    <button id="btn-prev-month-mobile"></button>
    <button id="btn-today-month-mobile"></button>
    <button id="btn-next-month-mobile"></button>
    <div id="cal-mobile-content"></div>
    <div id="calendar-month-year"></div>
    <div id="calendar-weekday-header"></div>
    <div id="calendar-grid"></div>
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
  duplicateMultiAssignee: true
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
    taskId: 'task-1__sub_sub-1',
    title: '하위 업무 점검',
    body: '현장 확인 완료',
    createdByName: 'engineer@example.com',
    createdAt: new Date('2026-07-11T15:00:00+09:00')
  },
  {
    taskId: 'task-1',
    title: '후속 검토',
    body: '회의 결과 후속 조치 확인',
    createdByName: 'bd@example.com',
    noteDate: '2026-07-12',
    createdAt: new Date('2026-07-12T10:00:00+09:00')
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
  assert(taskCategorySelect && taskCategorySelect.previousElementSibling?.textContent.includes('업무 분류'), '업무 등록 화면의 산업 분류가 업무 분류로 변경되지 않았습니다.');
  assert(taskCategorySelect.compareDocumentPosition(taskTitleInput) & indexDom.window.Node.DOCUMENT_POSITION_FOLLOWING, '업무 분류가 업무 등록 화면 최상단에 있지 않습니다.');
  assert(indexDom.window.document.getElementById('btn-open-task-category-settings') && indexDom.window.document.getElementById('modal-task-category-settings'), '업무 분류 설정 진입점 또는 설정 모달이 없습니다.');

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
  const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const batchDeleteButton = indexDom.window.document.getElementById('btn-batch-delete');
  const undoButton = indexDom.window.document.getElementById('btn-undo');
  assert(batchDeleteButton?.hidden && undoButton?.hidden, '일괄 삭제 또는 되돌리기 버튼의 초기 숨김 속성이 누락되었습니다.');
  assert(indexDom.window.document.querySelectorAll('#filter-search').length === 1 && !indexDom.window.document.getElementById('filter-search-desktop'), '업무 검색 입력이 하나의 통합 영역으로 정리되지 않았습니다.');
  assert(indexDom.window.document.getElementById('unified-status-host') && indexDom.window.document.getElementById('unified-risk-host'), 'KPI와 Risk를 수용할 통합 현황 영역이 없습니다.');
  const dashboardRow = indexDom.window.document.getElementById('unified-dashboard-row');
  assert(dashboardRow?.contains(indexDom.window.document.getElementById('unified-status-host')) && dashboardRow?.contains(indexDom.window.document.getElementById('secondary-tools-menu')), '모바일에서 KPI와 도구가 같은 행에 배치되지 않았습니다.');
  assert(!dashboardRow.textContent.includes('업무 현황 및 필터') && !dashboardRow.textContent.includes('현황 확인과 업무 탐색'), '삭제하기로 한 통합 영역 제목 또는 설명이 남아 있습니다.');
  assert(indexDom.window.document.getElementById('unified-status-host').classList.contains('w-full') && indexDom.window.document.getElementById('unified-status-host').classList.contains('order-3'), '모바일 현황 버튼이 KPI와 도구 아래의 별도 행에 배치되지 않았습니다.');
  const secondaryTools = indexDom.window.document.getElementById('secondary-tools-menu');
  assert(secondaryTools && !secondaryTools.open, '다운로드 및 백업 도구가 기본 접힘 상태가 아닙니다.');
  assert(indexDom.window.document.getElementById('ux-tool-host'), '접힌 보조 도구 영역이 없습니다.');
  assert(indexDom.window.document.getElementById('primary-task-action-host'), '새 업무 버튼을 배치할 뷰 전환 행 영역이 없습니다.');
  assert(/function updateBatchButton\(\)[\s\S]*?supportsTaskSelectionActions\(\) && selectedTaskIds\.size > 0[\s\S]*?btn\.hidden = !shouldShow/.test(appSource), '일괄 삭제 버튼이 지원 화면에서만 실제로 표시되도록 제한되지 않았습니다.');
  assert(/function updateUndoButton\(\)[\s\S]*?supportsTaskSelectionActions\(\) && deletionHistory\.length > 0[\s\S]*?btn\.hidden = !shouldShow/.test(appSource), '되돌리기 버튼이 지원 화면에서만 실제로 표시되도록 제한되지 않았습니다.');
  assert(/const toolHost = document\.getElementById\('ux-tool-host'\)[\s\S]*?const primaryHost = document\.getElementById\('primary-task-action-host'\)/.test(appSource), '보조 도구와 새 업무 버튼 이동 로직이 누락되었습니다.');
  assert(/if \(status === 'ALL'\)[\s\S]*?statusFilter\.value = 'ALL'[\s\S]*?priorityFilter\.value = 'ALL'/.test(appSource), '전체 KPI 버튼이 Risk와 High 필터를 함께 해제하지 않습니다.');
  assert(/statusFilter\.value = statusFilter\.value === status \? 'ALL' : status/.test(appSource), '활성 상태 KPI 버튼을 다시 눌렀을 때 필터가 해제되지 않습니다.');
  assert(/priorityFilter\.value = priorityFilter\.value === priority \? 'ALL' : priority/.test(appSource), '활성 High KPI 버튼을 다시 눌렀을 때 필터가 해제되지 않습니다.');

  loadScript('js/date-risk-utils.js');
  loadScript('js/calendar-utils.js');
  loadScript('js/calendar-day-renderer.js');
  loadScript('js/calendar-summary-renderer.js');
  loadScript('js/calendar-mobile-renderer.js');
  loadScript('js/table-mobile-renderer.js');

  const tasks = makeTasks();
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
  assert(compactedFirstWeekBar?.style.top === '56px', `첫 주 업무 위에 비활성 업무 분류 빈 줄이 남아 있습니다: ${compactedFirstWeekBar?.style.top}`);

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
  assert(document.querySelectorAll('#task-card-container [data-task-category-group]').length === 2, '모바일 목록이 업무 분류 최상위 그룹으로 나뉘지 않았습니다.');
  assert(!document.querySelector('.mobile-command-deck'), '모바일 목록에 중복 Focus 및 Risk 제어 영역이 남아 있습니다.');
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
  window.renderMobileCalendar(tasks.slice(0, 2));
  assert(document.getElementById('cal-mobile-month-year').textContent.includes('2026년 7월'), '모바일 월간 헤더가 올바르지 않습니다.');
  assert(document.querySelectorAll('#cal-mobile-content .mobile-cal-card').length >= 1, '모바일 월간 업무 카드가 없습니다.');
  assert(document.querySelector('#cal-mobile-content [data-mobile-calendar-category]'), '모바일 일별 캘린더에 업무 분류 헤더가 없습니다.');
  assert(document.getElementById('cal-mobile-content').textContent.includes('월간 정기 완료 체크'), '반복 하위 업무가 모바일 월간에 반영되지 않았습니다.');

  global.currentCalMode = 'MONTH';
  window.renderMobileCalendar(tasks);
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
    todayStr: '2026-07-12'
  });
  const summary = document.getElementById('cal-mobile-content');
  assert(summary.className.includes('bg-white'), '모바일 월별 요약 배경 클래스가 없습니다.');
  assert(summary.textContent.includes('이번 달 메모 리뷰'), '월별 요약 메모 섹션이 없습니다.');
  assert(summary.textContent.includes('총 3건'), '월별 요약 메모 통계가 올바르지 않습니다.');
  assert(summary.textContent.includes('2026년 7월 10일'), '사용자가 지정한 메모 기록일이 월별 요약에 반영되지 않았습니다.');
  assert(summary.textContent.includes('고객사 ACME'), '메모 고객사 정보가 월별 요약에 표시되지 않았습니다.');
  assert(summary.textContent.includes('Opp OPP-101'), '메모 Opp No가 월별 요약에 표시되지 않았습니다.');
  assert(summary.textContent.includes('Customer Visit'), '메모 업무 유형이 월별 요약에 표시되지 않았습니다.');
  assert(summary.textContent.includes('💬 1'), '메모 리뷰 코멘트 수가 월별 요약에 표시되지 않았습니다.');
  assert(summary.querySelectorAll('[data-summary-note-card]').length === 2, '본 업무와 하위 업무 메모는 서로 다른 태스크 카드로 분리되어야 합니다.');
  const taskNoteEntries = [...summary.querySelector('[data-task-id="task-1"]')?.querySelectorAll('[data-summary-note-entry]') || []];
  assert(taskNoteEntries.length === 2, '본 업무 카드 안에 동일 태스크의 메모가 모두 표시되지 않았습니다.');
  assert(taskNoteEntries.map(entry => entry.textContent).join('|').match(/후속 검토.*리스크 회의 결과/s), '본 업무 카드 안의 메모가 기록일 최신순으로 정렬되지 않았습니다.');
  assert(summary.querySelector('[data-task-id="task-1__sub_sub-1"]')?.querySelectorAll('[data-summary-note-entry]').length === 1, '하위 업무 메모가 해당 하위 업무 카드에 분리되지 않았습니다.');
  assert(summary.textContent.includes('취소 1'), '월별 요약에 취소 업무 집계가 없습니다.');

  console.log('mobile smoke passed: calendar default, task and subtask cancelled status, list, calendar day, calendar year, summary');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
