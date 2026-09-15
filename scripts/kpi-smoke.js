const fs = require('node:fs');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

async function main() {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const { document } = window;
  window.trackers = [{
    id: 'tracker-kpi',
    kpiTitle: '업무 완료율',
    kpiTarget: 80,
    kpiUnit: '%',
    kpiType: 'AUTO_DONE_PCT',
    kpiCurrent: 0,
  }];
  window.currentTrackerId = 'tracker-kpi';
  window.showToast = () => {};

  window.eval(fs.readFileSync('js/task-service.js', 'utf8'));
  let savedPayload = null;
  let saveCalls = 0;
  let releaseSave;
  window.db_updateTracker = async (_id, payload) => {
    saveCalls += 1;
    savedPayload = payload;
    await new Promise(resolve => { releaseSave = resolve; });
    return { success: true };
  };
  window.eval(fs.readFileSync('js/modal-controller.js', 'utf8'));
  window.initKpiSettingsEvents();
  window.openKpiSettingsModal();

  const kpiSelect = document.getElementById('select-active-kpi');
  assert.equal(kpiSelect.options.length, 1, '기존 단일 KPI가 선택 목록으로 변환되어야 합니다.');
  assert.equal(kpiSelect.options[0].textContent, '업무 완료율');

  document.getElementById('btn-add-kpi').click();
  assert.equal(kpiSelect.options.length, 2, 'KPI 추가 버튼이 새 KPI를 목록에 추가해야 합니다.');
  const addedKpiId = kpiSelect.value;
  document.getElementById('input-kpi-title').value = '고객 미팅';
  document.getElementById('input-kpi-target').value = '12';
  document.getElementById('input-kpi-unit').value = '회';
  document.getElementById('input-kpi-current').value = '7';

  kpiSelect.value = 'kpi_default';
  kpiSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  kpiSelect.value = addedKpiId;
  kpiSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(document.getElementById('input-kpi-title').value, '고객 미팅', 'KPI 전환 후 편집 중인 값이 유지되어야 합니다.');

  const submitEvent = () => document.getElementById('form-kpi-settings').dispatchEvent(new window.Event('submit', {
    bubbles: true,
    cancelable: true,
  }));
  submitEvent();
  submitEvent();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saveCalls, 1, '저장 중 중복 제출을 차단해야 합니다.');
  assert.equal(document.getElementById('btn-save-kpi-settings').disabled, true, '저장 중 저장 버튼이 비활성화되어야 합니다.');
  releaseSave();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(savedPayload.kpis.length, 2, '추가 KPI가 전체 목록으로 저장되어야 합니다.');
  assert.equal(savedPayload.selectedKpiId, addedKpiId, '선택한 KPI가 표시 대상으로 저장되어야 합니다.');
  assert.equal(savedPayload.kpiTitle, '고객 미팅', '선택 KPI가 기존 호환 필드와 동기화되어야 합니다.');
  assert.equal(savedPayload.kpiCurrent, 7);
  assert.equal(document.getElementById('btn-save-kpi-settings').disabled, false, '저장 완료 후 저장 버튼이 다시 활성화되어야 합니다.');

  window.trackers = [{ id: 'tracker-kpi', ...savedPayload }];
  window.tasks = [{ id: 'task-1', trackerId: 'tracker-kpi', status: 'COMPLETED', deleted: false }];
  window.getTodayStr = () => '2026-09-15';
  window.getEffectiveStatus = task => task.status;
  window.escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
  window.eval(fs.readFileSync('js/app.js', 'utf8'));
  window.renderTrackerKpiBadge();
  const badgeText = document.getElementById('tracker-kpi-badge-container').textContent.replace(/\s+/g, ' ').trim();
  assert.match(badgeText, /고객 미팅: 7회 \/ 목표 12회/, '선택한 KPI가 트래커 헤더 배지에 표시되어야 합니다.');

  console.log('KPI smoke passed: legacy migration, add, switch, select, save, and badge render');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
