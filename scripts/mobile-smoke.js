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
    createdAt: new Date('2026-07-10T09:30:00+09:00')
  },
  {
    taskId: 'task-1__sub_sub-1',
    title: '하위 업무 점검',
    body: '현장 확인 완료',
    createdByName: 'engineer@example.com',
    createdAt: new Date('2026-07-11T15:00:00+09:00')
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
      startDate: '2026-03-01',
      dueDate: '2026-04-30',
      assignee: ['이매니저'],
      subTasks: []
    }
  ];

  for (let i = 3; i <= 14; i += 1) {
    const month = String(((i - 1) % 12) + 1).padStart(2, '0');
    base.push({
      id: `task-${i}`,
      title: `연간 간트 밀집 테스트 업무 ${i}`,
      status: i % 4 === 0 ? 'PENDING' : 'PROGRESS',
      priority: i % 5 === 0 ? 'HIGH' : 'NORMAL',
      startDate: `2026-${month}-01`,
      dueDate: `2026-${month}-20`,
      assignee: ['담당자'],
      subTasks: []
    });
  }

  return base;
}

async function main() {
  loadScript('js/date-risk-utils.js');
  loadScript('js/calendar-summary-renderer.js');
  loadScript('js/calendar-mobile-renderer.js');
  loadScript('js/table-mobile-renderer.js');

  const tasks = makeTasks();

  global.renderMobileCards(tasks.slice(0, 2));
  assert(document.querySelectorAll('.mobile-task-card').length === 2, '모바일 목록 카드가 렌더링되지 않았습니다.');
  assert(document.querySelector('.mobile-command-deck'), '모바일 목록 상단 제어 영역이 없습니다.');
  assert(document.querySelector('.btn-toggle-subtasks[data-expanded="true"]'), '하위 업무 펼침 상태가 렌더링되지 않았습니다.');
  assert(document.querySelector('.line-clamp-2'), '긴 업무명 줄임 클래스가 누락되었습니다.');

  global.currentCalMode = 'DAY';
  window.renderMobileCalendar(tasks.slice(0, 2));
  assert(document.getElementById('cal-mobile-month-year').textContent.includes('2026년 7월'), '모바일 월간 헤더가 올바르지 않습니다.');
  assert(document.querySelectorAll('#cal-mobile-content .mobile-cal-card').length >= 1, '모바일 월간 업무 카드가 없습니다.');

  global.currentCalMode = 'MONTH';
  window.renderMobileCalendar(tasks);
  const yearText = document.getElementById('cal-mobile-content').textContent;
  assert(yearText.includes('2026년 연간 타임라인'), '모바일 연간 간트 헤더가 없습니다.');
  assert(/주요 \d+\/14|총 14개/.test(yearText), '모바일 연간 밀집 상태 배지가 없습니다.');
  assert(document.querySelectorAll('#cal-mobile-content [title$="월 일별 보기로 이동"]').length >= 12, '월 축 이동 타깃이 부족합니다.');

  global.currentCalMode = 'SUMMARY';
  await global.renderCalendarSummaryView({
    grid: document.getElementById('cal-mobile-content'),
    year: 2026,
    month: 6,
    filteredTasks: tasks,
    todayStr: '2026-07-12'
  });
  const summary = document.getElementById('cal-mobile-content');
  assert(summary.className.includes('bg-white'), '모바일 월별 요약 배경 클래스가 없습니다.');
  assert(summary.textContent.includes('이번 달 작성된 진행 상황 메모 목록'), '월별 요약 메모 섹션이 없습니다.');
  assert(summary.textContent.includes('총 2건'), '월별 요약 메모 통계가 올바르지 않습니다.');

  console.log('mobile smoke passed: list, calendar day, calendar year, summary');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
