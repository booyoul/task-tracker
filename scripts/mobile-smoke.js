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
      startDate: `2026-${month}-01`,
      dueDate: `2026-${month}-20`,
      assignee: ['담당자'],
      subTasks: []
    });
  }

  return base;
}

async function main() {
  const indexDom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  const noteDateInput = indexDom.window.document.getElementById('input-note-date');
  assert(noteDateInput && !noteDateInput.required, '숨겨진 진행 메모 기록일이 신규 업무 폼 제출을 차단합니다.');
  indexDom.window.document.getElementById('input-task-title').value = '신규 업무 저장 회귀 테스트';
  indexDom.window.document.getElementById('input-task-due').value = '2026-07-31';
  assert(indexDom.window.document.getElementById('form-task').checkValidity(), '필수 업무값을 입력해도 신규 업무 폼이 제출 가능한 상태가 아닙니다.');

  const stateSource = fs.readFileSync(path.join(root, 'js/state.js'), 'utf8');
  assert(/let currentViewMode = ['"]CALENDAR['"]/.test(stateSource), '트래커 기본 진입 뷰가 캘린더가 아닙니다.');

  loadScript('js/date-risk-utils.js');
  loadScript('js/calendar-utils.js');
  loadScript('js/calendar-summary-renderer.js');
  loadScript('js/calendar-mobile-renderer.js');
  loadScript('js/table-mobile-renderer.js');

  const tasks = makeTasks();
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
  assert(document.querySelector('.mobile-command-deck'), '모바일 목록 상단 제어 영역이 없습니다.');
  assert(document.querySelector('.btn-toggle-subtasks[data-expanded="true"]'), '하위 업무 펼침 상태가 렌더링되지 않았습니다.');
  assert(document.querySelector('.line-clamp-2'), '긴 업무명 줄임 클래스가 누락되었습니다.');

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
  assert(document.getElementById('cal-mobile-content').textContent.includes('월간 정기 완료 체크'), '반복 하위 업무가 모바일 월간에 반영되지 않았습니다.');

  global.currentCalMode = 'MONTH';
  window.renderMobileCalendar(tasks);
  const yearText = document.getElementById('cal-mobile-content').textContent;
  assert(yearText.includes('2026년 연간 타임라인'), '모바일 연간 간트 헤더가 없습니다.');
  assert(/주요 \d+\/14|총 14개/.test(yearText), '모바일 연간 밀집 상태 배지가 없습니다.');
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
  assert(summary.querySelectorAll('[data-summary-note-card]').length === 2, '같은 업무의 메모가 하나의 카드로 묶이지 않았습니다.');
  assert(summary.querySelector('[data-task-id="task-1"]')?.querySelectorAll('[data-summary-note-entry]').length === 2, '업무 카드 안에 같은 업무의 메모가 모두 표시되지 않았습니다.');
  assert(summary.textContent.includes('취소 1'), '월별 요약에 취소 업무 집계가 없습니다.');

  console.log('mobile smoke passed: calendar default, task and subtask cancelled status, list, calendar day, calendar year, summary');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
