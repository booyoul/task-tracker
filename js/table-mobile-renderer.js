console.info('Smart Task Flow table-mobile-renderer.js v20260626-module-split-phase5-table-mobile-renderer loaded');
// Table and mobile card renderers. Extracted from app.js in Phase 5.
function renderTable(filtered) {
  const tbody = document.getElementById('task-table-body');
  const emptyState = document.getElementById('empty-state-table');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (filtered.length === 0) {
    emptyState?.classList.replace('hidden', 'flex');
    updateSelectAllState(0, 0);
    return;
  }
  emptyState?.classList.replace('flex', 'hidden');
  filtered.sort((a, b) => {
    const todayStr = getTodayStr();
    const ar = getMaxDelayDays(a, todayStr);
    const br = getMaxDelayDays(b, todayStr);
    if (ar !== br) return br - ar;
    const ae = getEffectiveStatus(a, todayStr) === 'OVERDUE' ? 1 : 0;
    const be = getEffectiveStatus(b, todayStr) === 'OVERDUE' ? 1 : 0;
    if (ae !== be) return be - ae;
    return (a.order ?? 999) - (b.order ?? 999) || String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
  });
  let selectedCount = 0;
  filtered.forEach(t => {
    const subTasks = Array.isArray(t.subTasks) ? t.subTasks : [];
    let isExpanded = expandedTaskIds.has(t.id);
    const checked = selectedTaskIds.has(t.id);
    if (checked) selectedCount++;
    const doneSubs = subTasks.filter(st => st.status === 'COMPLETED').length;
    const subOverdueCount = countOverdueSubTasks(t);
    if (subOverdueCount > 0) isExpanded = true;
    const subOverdueBadge = subOverdueCount ? ` <span class="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 border border-rose-100">하위 기한 초과 ${subOverdueCount}</span>` : '';
    const todayStr = getTodayStr();
    const effectiveStatus = getEffectiveStatus(t, todayStr);
    const progressPct = getTaskProgress(t);
    const riskInfo = getTaskRiskInfo(t, todayStr);
    const bottleneck = getBottleneckSubTask(t, todayStr);
    const timeline = getTimelineStatus(t.dueDate || getTodayStr(), t.status);
    const riskBadge = riskInfo.level !== 'NONE' ? ` <span class="rounded-lg border px-2 py-1 text-[10px] font-bold ${riskInfo.class}">Risk: ${riskInfo.label} D+${riskInfo.delay}</span>` : '';
    const bottleneckHTML = bottleneck ? `<div class="pl-6 text-[11px] text-rose-500 mt-1 font-semibold">🔥 Bottleneck: ${escapeHTML(bottleneck.title)} · ${bottleneck.dueDate || '마감 미정'}</div>` : '';
    const tr = document.createElement('tr');
    tr.className = ['transition-colors group', ['HIGH', 'CRITICAL'].includes(riskInfo.level) ? 'bg-rose-50/70 border-l-4 border-l-rose-500 hover:bg-rose-50' : effectiveStatus === 'OVERDUE' ? 'bg-amber-50/50 border-l-4 border-l-amber-400 hover:bg-amber-50' : 'hover:bg-slate-50'].join(' ');
    tr.title = `Risk: ${riskInfo.label}${riskInfo.delay ? ' D+' + riskInfo.delay : ''} | 운영상태: ${getStatusKorean(effectiveStatus)} | 진척: ${progressPct}%${bottleneck ? ' | Bottleneck: ' + bottleneck.title : ''}`;
    tr.innerHTML = `
      <td class="px-2 py-4 text-center text-slate-400">
        <button type="button" class="btn-order-up block mx-auto hover:text-indigo-600 mb-1.5" data-id="${t.id}" title="위로 이동">
          <svg class="h-3.5 w-3.5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
        </button>
        <button type="button" class="btn-order-down block mx-auto hover:text-indigo-600" data-id="${t.id}" title="아래로 이동">
          <svg class="h-3.5 w-3.5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
        </button>
      </td>
      <td class="px-2 py-4 text-center"><input type="checkbox" class="cb-task rounded border-slate-300 cursor-pointer text-indigo-600 focus:ring-indigo-500" data-id="${t.id}" ${checked ? 'checked' : ''}></td>
      ${buildTaskDetailCellHTML(t, subTasks, isExpanded, doneSubs, progressPct, bottleneckHTML)}
      <td class="px-3 py-4 align-top whitespace-nowrap">${typeof window.renderAssignees === 'function' ? window.renderAssignees(t.assignee) : escapeHTML(t.assignee)}</td>
      <td class="px-3 py-4 align-top whitespace-nowrap"><div class="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-600"><span>${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5)}</span><span class="inline-flex shrink-0 rounded-lg border px-2 py-0.5 text-[11px] ${timeline.class}">${timeline.text}</span></div></td>
      <td class="px-2 py-4 text-center align-top"><span class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold">${getPriorityBadge(t.priority)}</span></td>
      <td class="px-3 py-4 text-center align-top whitespace-nowrap"><div class="mb-1 text-[10px] font-bold text-slate-400 whitespace-nowrap">${getStatusKorean(effectiveStatus)}</div><select class="sel-status rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-500 task-status-compact" data-id="${t.id}"><option value="PENDING" ${t.status === 'PENDING' ? 'selected' : ''}>진행 대기 ⌛</option><option value="PROGRESS" ${t.status === 'PROGRESS' ? 'selected' : ''}>진행 중 ⚙️</option><option value="COMPLETED" ${t.status === 'COMPLETED' ? 'selected' : ''}>완료됨 ⭐️</option></select></td>
      <td class="px-2 py-4 text-center align-top whitespace-nowrap"><button type="button" class="btn-delete text-slate-400 hover:text-rose-600 px-2" data-id="${t.id}">🗑</button></td>`;
    tbody.appendChild(tr);
    if (subTasks.length && isExpanded) {
      subTasks.forEach(st => {
        const status = normalizeStatus(st.status);
        const subAssignee = st.assignee || t.assignee || ['미지정'];
        const subAssigneeLabel = Array.isArray(subAssignee) ? subAssignee.join(', ') : (subAssignee || '미지정');
        const stTimeline = getSubTaskTimelineStatus(st);
        const sr = document.createElement('tr');
        sr.className = isSubTaskOverdue(st) ? 'bg-rose-50/70 border-l-2 border-l-rose-500/60 hover:bg-rose-50 transition-colors text-xs' : 'bg-slate-50/70 border-l-2 border-l-indigo-500/40 hover:bg-indigo-50/30 transition-colors text-xs';
        sr.innerHTML = `
          <td colspan="2"></td>
          <td class="px-4 py-2 text-slate-600"><div class="flex items-center gap-2 pl-8"><span class="text-slate-300">└─</span><button type="button" class="btn-edit font-semibold text-left ${status === 'COMPLETED' ? 'line-through text-slate-400' : isSubTaskOverdue(st) ? 'text-rose-700' : 'text-slate-700'} hover:text-indigo-600 outline-none" data-id="${t.id}" title="클릭해서 업무 수정">${isSubTaskOverdue(st) ? '🚨 ' : ''}${escapeHTML(st.title)}</button><span class="shrink-0 max-w-[120px] truncate rounded border border-indigo-100 bg-indigo-50 px-1 py-0.5 text-[10px] font-bold text-indigo-700" title="${escapeHTML(subAssigneeLabel)}">👤 ${escapeHTML(subAssigneeLabel)}</span></div></td>
          <td class="px-3 py-2 text-center text-slate-400">-</td>
          <td class="px-3 py-2 text-slate-500 whitespace-nowrap"><div class="inline-flex items-center gap-1.5 whitespace-nowrap"><span>📅 ${st.startDate ? st.startDate.substring(5) : '미정'} ~ ${st.dueDate ? st.dueDate.substring(5) : '미정'}</span><span class="inline-flex shrink-0 rounded-lg border px-2 py-0.5 text-[10px] ${stTimeline.class}">${stTimeline.text}</span></div></td>
          <td class="px-4 py-2 text-center text-slate-400">-</td>
          <td class="px-3 py-2 text-center">${subTaskStatusSelect(t.id, st.id, status)}</td>
          <td class="px-2 py-2 text-center text-slate-300">-</td>`;
        tbody.appendChild(sr);
      });
    }
  });
  updateSelectAllState(filtered.length, selectedCount);
}
// Calendar helper functions moved to js/calendar-utils.js


function getMobilePriorityClass(priority) {
  if (priority === 'HIGH') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (priority === 'LOW') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}
function buildMobileSubTaskHTML(t, subTasks) {
  if (!subTasks.length) return '';
  const isExpanded = expandedTaskIds.has(t.id) || countOverdueSubTasks(t) > 0;
  if (!isExpanded) {
    const done = subTasks.filter(st => normalizeStatus(st.status) === 'COMPLETED').length;
    return `<button type="button" class="btn-toggle-subtasks mt-2 inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 border border-slate-100" data-id="${t.id}">하위 업무 ${done}/${subTasks.length} 펼치기</button>`;
  }
  return `<div class="mt-3 space-y-1.5 border-t border-slate-100 pt-3">${subTasks.map(st => {
    const status = normalizeStatus(st.status);
    const stTimeline = getSubTaskTimelineStatus(st);
    const overdue = isSubTaskOverdue(st);
    return `<div class="rounded-xl border ${overdue ? 'border-rose-100 bg-rose-50/70' : 'border-slate-100 bg-slate-50'} px-3 py-2">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <button type="button" class="btn-edit truncate text-xs font-bold text-left ${status === 'COMPLETED' ? 'line-through text-slate-400' : overdue ? 'text-rose-700' : 'text-slate-700'} hover:text-indigo-600 outline-none" data-id="${t.id}" title="클릭해서 업무 수정">↳ ${overdue ? '🚨 ' : ''}${escapeHTML(st.title || '')}</button>
          <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
            <span class="rounded-md bg-white px-1.5 py-0.5 border border-slate-100">👤 ${escapeHTML(st.assignee || t.assignee || '미지정')}</span>
            <span class="inline-flex items-center gap-1 whitespace-nowrap"><span>📅 ${st.startDate ? st.startDate.substring(5) : '미정'} ~ ${st.dueDate ? st.dueDate.substring(5) : '미정'}</span><span class="inline-flex shrink-0 rounded-md border px-1.5 py-0.5 ${stTimeline.class}">${stTimeline.text}</span></span>
          </div>
        </div>
        <select class="sel-subtask-status mobile-touch-btn shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 outline-none" data-task-id="${escapeHTML(t.id)}" data-subtask-id="${escapeHTML(st.id)}">
          <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>대기</option>
          <option value="PROGRESS" ${status === 'PROGRESS' ? 'selected' : ''}>진행</option>
          <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>완료</option>
        </select>
      </div>
    </div>`;
  }).join('')}</div>`;
}
function renderMobileCards(filtered) {
  const container = document.getElementById('task-card-container');
  const emptyState = document.getElementById('empty-state-mobile');
  if (!container) return;
  container.innerHTML = '';
  if (!filtered || filtered.length === 0) {
    emptyState?.classList.remove('hidden');
    emptyState?.classList.add('flex');
    return;
  }
  emptyState?.classList.add('hidden');
  emptyState?.classList.remove('flex');
  const todayStr = getTodayStr();
  filtered.forEach(t => {
    const subTasks = Array.isArray(t.subTasks) ? t.subTasks : [];
    const effectiveStatus = getEffectiveStatus(t, todayStr);
    const timeline = getTimelineStatus(t.dueDate || getTodayStr(), t.status);
    const riskInfo = getTaskRiskInfo(t, todayStr);
    const progressPct = getTaskProgress(t);
    const subDone = subTasks.filter(st => normalizeStatus(st.status) === 'COMPLETED').length;
    const card = document.createElement('article');
    card.className = `mobile-task-card rounded-2xl border bg-white p-3 shadow-sm ${['HIGH','CRITICAL'].includes(riskInfo.level) ? 'border-rose-200 bg-rose-50/40' : effectiveStatus === 'OVERDUE' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`;
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <button type="button" class="btn-edit block w-full text-left" data-id="${t.id}"><div class="truncate text-sm font-black text-slate-900">${escapeHTML(t.title || '')}</div></button>
          <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span class="rounded-lg bg-slate-50 px-2 py-1 border border-slate-100">👤 ${escapeHTML(t.assignee || '미지정')}</span>
            <span class="rounded-lg border px-2 py-1 font-bold ${getMobilePriorityClass(t.priority)}">${getPriorityBadge(t.priority)}</span>
            <span class="rounded-lg bg-white px-2 py-1 font-bold text-slate-500 border border-slate-100">진척 ${progressPct}%</span>
          </div>
        </div>
        <button type="button" class="btn-delete mobile-touch-btn shrink-0 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-600" data-id="${t.id}">🗑</button>
      </div>
      <div class="mt-3 rounded-xl bg-white/80 border border-slate-100 px-3 py-2">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 overflow-x-auto"><div class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-slate-600"><span class="shrink-0">📅 ${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5) || '미정'}</span><span class="inline-flex shrink-0 rounded-lg border px-2 py-0.5 text-[11px] ${timeline.class}">${timeline.text}</span></div></div>
          <select class="sel-status mobile-touch-btn shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 outline-none" data-id="${t.id}">
            <option value="PENDING" ${t.status === 'PENDING' ? 'selected' : ''}>대기</option><option value="PROGRESS" ${t.status === 'PROGRESS' ? 'selected' : ''}>진행</option><option value="COMPLETED" ${t.status === 'COMPLETED' ? 'selected' : ''}>완료</option>
          </select>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full ${progressPct >= 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-blue-500' : 'bg-slate-300'}" style="width:${progressPct}%"></div></div>
      </div>
      ${(riskInfo.level !== 'NONE') ? `<div class="mt-2 inline-flex rounded-lg border px-2 py-1 text-[11px] font-black ${riskInfo.class}">Risk: ${riskInfo.label} D+${riskInfo.delay}</div>` : ''}
      ${subTasks.length ? `<div class="mt-2 text-[11px] font-semibold text-slate-400">하위 업무 ${subDone}/${subTasks.length}</div>` : ''}
      ${buildMobileSubTaskHTML(t, subTasks)}
      <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <button type="button" class="btn-toggle-subtasks ${subTasks.length ? '' : 'invisible'} mobile-touch-btn rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600" data-id="${t.id}">${expandedTaskIds.has(t.id) ? '하위 접기' : '하위 펼치기'}</button>
      </div>`;
    container.appendChild(card);
  });
}



// === Phase 11 Mobile Redesign: compact executive mobile cards + sticky bulk action ===
console.info('Smart Task Flow mobile redesign v20260626-phase11 loaded');

function getMobileStatusClass(status) {
  const s = normalizeStatus(status);
  if (s === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s === 'PROGRESS') return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

function getMobileRiskAccent(t, todayStr) {
  const risk = getTaskRiskInfo(t, todayStr);
  const effective = getEffectiveStatus(t, todayStr);
  if (['HIGH', 'CRITICAL'].includes(risk.level)) return 'border-rose-200 bg-rose-50/60 ring-1 ring-rose-100';
  if (effective === 'OVERDUE') return 'border-amber-200 bg-amber-50/50 ring-1 ring-amber-100';
  return 'border-slate-100 bg-white';
}

function getMobileDuePill(t, todayStr) {
  const timeline = getTimelineStatus(t.dueDate || todayStr, t.status);
  const risk = getTaskRiskInfo(t, todayStr);
  const isRisk = risk.level !== 'NONE' || getEffectiveStatus(t, todayStr) === 'OVERDUE';
  const cls = isRisk ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-50 text-slate-600 border-slate-100';
  const start = t.startDate ? t.startDate.substring(5) : '';
  const due = (t.dueDate || '').substring(5) || '미정';
  const dateText = start ? `${start}~${due}` : due;
  return `<span class="inline-flex flex-wrap items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${cls}">📅 ${dateText}<span class="font-semibold opacity-80">${timeline.text || ''}</span></span>`;
}

function getMobileProgressBar(progressPct, status) {
  const s = normalizeStatus(status);
  const color = s === 'COMPLETED' ? 'bg-emerald-500' : s === 'PROGRESS' ? 'bg-blue-500' : 'bg-amber-400';
  return `<div class="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full ${color} transition-all" style="width:${Math.max(0, Math.min(100, progressPct || 0))}%"></div></div>`;
}

function mobileStatusSegment(id, status) {
  const s = normalizeStatus(status);
  const btn = (value, label, activeClass) => {
    const active = s === value;
    return `<button type="button" class="mobile-status-btn flex-1 rounded-xl px-2 py-2 text-[11px] font-black transition ${active ? activeClass : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}" data-id="${escapeHTML(id)}" data-status="${value}">${label}</button>`;
  };
  return `<div class="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100/70 p-1">
    ${btn('PENDING', '대기', 'bg-white text-amber-700 shadow-sm')}
    ${btn('PROGRESS', '진행', 'bg-white text-blue-700 shadow-sm')}
    ${btn('COMPLETED', '완료', 'bg-white text-emerald-700 shadow-sm')}
  </div>`;
}

function buildMobileSubTaskHTML(t, subTasks) {
  if (!subTasks.length) return '';
  const isExpanded = expandedTaskIds.has(t.id) || countOverdueSubTasks(t) > 0;
  const done = subTasks.filter(st => normalizeStatus(st.status) === 'COMPLETED').length;
  if (!isExpanded) {
    return `<button type="button" class="btn-toggle-subtasks mt-3 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-500" data-id="${escapeHTML(t.id)}">하위 업무 ${done}/${subTasks.length} 보기</button>`;
  }
  return `<div class="mt-3 space-y-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-2">
    <div class="flex items-center justify-between px-1 text-[11px] font-black text-slate-400"><span>하위 업무</span><button type="button" class="btn-toggle-subtasks text-indigo-600" data-id="${escapeHTML(t.id)}">접기</button></div>
    ${subTasks.map(st => {
      const status = normalizeStatus(st.status);
      const overdue = isSubTaskOverdue(st);
      const stTimeline = getSubTaskTimelineStatus(st);
      const subAssignee = st.assignee || t.assignee || ['미지정'];
      const subAssigneeLabel = Array.isArray(subAssignee) ? subAssignee.join(', ') : (subAssignee || '미지정');
      return `<div class="rounded-xl border ${overdue ? 'border-rose-100 bg-white' : 'border-slate-100 bg-white'} p-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="truncate text-xs font-black ${overdue ? 'text-rose-700' : 'text-slate-700'}">${overdue ? '🚨 ' : ''}${escapeHTML(st.title || '')}</div>
            <div class="mt-1 text-[11px] text-slate-400">👤 ${escapeHTML(subAssigneeLabel)} · ${st.startDate ? st.startDate.substring(5) : '미정'}~${st.dueDate ? st.dueDate.substring(5) : '미정'} ${stTimeline.text || ''}</div>
          </div>
          <select class="sel-subtask-status rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600" data-task-id="${escapeHTML(t.id)}" data-subtask-id="${escapeHTML(st.id)}">
            <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>대기</option>
            <option value="PROGRESS" ${status === 'PROGRESS' ? 'selected' : ''}>진행</option>
            <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>완료</option>
          </select>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function ensureMobileBulkActionBar() {
  if (document.getElementById('mobile-bulk-action-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'mobile-bulk-action-bar';
  bar.className = 'hidden lg:hidden fixed inset-x-3 bottom-3 z-40 rounded-3xl border border-indigo-100 bg-white/95 p-2 shadow-2xl backdrop-blur';
  bar.innerHTML = `<div class="flex items-center gap-2">
    <div class="min-w-0 flex-1 pl-2"><div id="mobile-bulk-count" class="text-xs font-black text-indigo-700">0개 선택됨</div><div class="text-[10px] text-slate-400">선택 업무 빠른 처리</div></div>
    <button type="button" id="mobile-bulk-status" class="rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-black text-white">상태</button>
    <button type="button" id="mobile-bulk-due" class="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">마감</button>
    <button type="button" id="mobile-bulk-delete" class="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-600">삭제</button>
  </div>`;
  document.body.appendChild(bar);
  document.getElementById('mobile-bulk-status')?.addEventListener('click', bulkChangeStatus);
  document.getElementById('mobile-bulk-due')?.addEventListener('click', bulkChangeDueDate);
  document.getElementById('mobile-bulk-delete')?.addEventListener('click', confirmBatchDelete);
}

function updateMobileBulkActionBar() {
  ensureMobileBulkActionBar();
  const bar = document.getElementById('mobile-bulk-action-bar');
  const count = document.getElementById('mobile-bulk-count');
  if (!bar || !count) return;
  count.textContent = `${selectedTaskIds.size}개 선택됨`;
  selectedTaskIds.size ? bar.classList.remove('hidden') : bar.classList.add('hidden');
}

function renderMobileCards(filtered) {
  const container = document.getElementById('task-card-container');
  const emptyState = document.getElementById('empty-state-mobile');
  if (!container) return;
  ensureMobileBulkActionBar();
  container.innerHTML = '';
  if (!filtered || filtered.length === 0) {
    emptyState?.classList.remove('hidden');
    emptyState?.classList.add('flex');
    updateMobileBulkActionBar();
    return;
  }
  emptyState?.classList.add('hidden');
  emptyState?.classList.remove('flex');

  const todayStr = getTodayStr();
  const riskyCount = filtered.filter(t => isTaskOverdueEffective(t, todayStr) || ['HIGH','CRITICAL'].includes(getTaskRiskInfo(t, todayStr).level)).length;
  const completedCount = filtered.filter(t => getEffectiveStatus(t, todayStr) === 'COMPLETED').length;

  const isRiskActive = typeof focusState !== 'undefined' && focusState.riskOnly;
  const isHighActive = typeof focusState !== 'undefined' && focusState.highOnly;
  const isAssigneeActive = typeof selectedAssigneeFilters !== 'undefined' && selectedAssigneeFilters.size > 0;

  const riskClass = isRiskActive 
    ? 'rounded-2xl border border-rose-600 bg-rose-600 px-3 py-2 text-xs font-black text-white transition shadow-sm' 
    : 'rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition';

  const highClass = isHighActive 
    ? 'rounded-2xl border border-amber-600 bg-amber-600 px-3 py-2 text-xs font-black text-white transition shadow-sm' 
    : 'rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 transition';

  const assigneeClass = isAssigneeActive 
    ? 'rounded-2xl border border-indigo-600 bg-indigo-600 px-3 py-2 text-xs font-black text-white transition shadow-sm' 
    : 'rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 transition';

  const header = document.createElement('section');
  header.className = 'mobile-command-deck sticky top-0 z-20 -mx-1 mb-3 rounded-b-3xl border border-slate-100 bg-white/90 p-3 shadow-sm backdrop-blur lg:hidden';
  header.innerHTML = `<div class="flex items-center justify-between gap-3">
    <div><div class="text-[11px] font-black uppercase tracking-wide text-slate-400">Mobile Focus</div><div class="text-base font-black text-slate-900">업무 ${filtered.length}건</div></div>
    <div class="flex items-center gap-1.5 text-[11px] font-black">
      <span class="rounded-full bg-rose-50 px-2 py-1 text-rose-600">Risk ${riskyCount}</span>
      <span class="rounded-full bg-emerald-50 px-2 py-1 text-emerald-600">완료 ${completedCount}</span>
    </div>
  </div>
  <div class="mt-3 grid grid-cols-3 gap-2">
    <button type="button" id="mobile-focus-risk" class="${riskClass}">Risk</button>
    <button type="button" id="mobile-focus-high" class="${highClass}">High</button>
    <button type="button" id="mobile-open-assignee" class="${assigneeClass}">담당자</button>
  </div>`;
  container.appendChild(header);
  header.querySelector('#mobile-focus-risk')?.addEventListener('click', () => toggleFocusMode('riskOnly'));
  header.querySelector('#mobile-focus-high')?.addEventListener('click', () => toggleFocusMode('highOnly'));
  header.querySelector('#mobile-open-assignee')?.addEventListener('click', openAssigneeModal);

  filtered.forEach(t => {
    const subTasks = Array.isArray(t.subTasks) ? t.subTasks : [];
    const effectiveStatus = getEffectiveStatus(t, todayStr);
    const riskInfo = getTaskRiskInfo(t, todayStr);
    const progressPct = getTaskProgress(t);
    const subDone = subTasks.filter(st => normalizeStatus(st.status) === 'COMPLETED').length;
    const checked = selectedTaskIds.has(t.id);
    const notes = String(t.notes || '').trim();
    const card = document.createElement('article');
    card.className = `mobile-task-card rounded-[1.35rem] border p-3 shadow-sm transition ${getMobileRiskAccent(t, todayStr)}`;
    card.dataset.id = t.id;
    card.innerHTML = `<div class="flex items-start gap-3">
      <input type="checkbox" class="cb-task mt-1 h-5 w-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500" data-id="${escapeHTML(t.id)}" ${checked ? 'checked' : ''}>
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <button type="button" class="btn-edit min-w-0 flex-1 text-left" data-id="${escapeHTML(t.id)}">
            <div class="line-clamp-2 text-[15px] font-black leading-snug text-slate-900">${escapeHTML(t.title || '')}</div>
          </button>
          <div class="flex shrink-0 items-center gap-1">
            <button type="button" class="btn-delete rounded-xl bg-white/80 px-2 py-1 text-xs font-black text-rose-500 shadow-sm" data-id="${escapeHTML(t.id)}">삭제</button>
          </div>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <span class="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-bold ${getMobileStatusClass(effectiveStatus)}">${getStatusIcon(effectiveStatus)} ${getStatusKorean(effectiveStatus)}</span>
          ${getMobileDuePill(t, todayStr)}
          <span class="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-bold ${getMobilePriorityClass(t.priority)}">${t.priority === 'HIGH' ? '높음' : t.priority === 'LOW' ? '낮음' : '보통'}</span>
        </div>
        <div class="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <span class="truncate">👤 ${escapeHTML(Array.isArray(t.assignee) ? t.assignee.join(', ') : (t.assignee || '미지정'))}</span>
          <span class="shrink-0 font-bold text-slate-500">진척 ${progressPct}%</span>
        </div>
        ${getMobileProgressBar(progressPct, effectiveStatus)}
        ${riskInfo.level !== 'NONE' ? `<div class="mt-2 rounded-2xl border border-rose-100 bg-white/80 px-3 py-2 text-xs font-bold text-rose-700">🚨 Risk: ${riskInfo.label} D+${riskInfo.delay}</div>` : ''}
        ${notes ? `<div class="mt-2 line-clamp-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">${escapeHTML(notes)}</div>` : ''}
        ${subTasks.length ? `<div class="mt-2 text-[11px] font-bold text-slate-400">하위 업무 ${subDone}/${subTasks.length}</div>` : ''}
        ${mobileStatusSegment(t.id, effectiveStatus)}
        ${buildMobileSubTaskHTML(t, subTasks)}
      </div>
    </div>`;
    container.appendChild(card);
  });
  updateMobileBulkActionBar();
}


// === Final Stable View Routing Override: TABLE / CALENDAR / KANBAN / ADMIN ===
function setViewVisibility(mode) {
  const table = document.getElementById('view-table');
  const mobile = document.getElementById('view-mobile');
  const calendar = document.getElementById('view-calendar');
  const calendarMobile = document.getElementById('view-calendar-mobile');
  const kanban = document.getElementById('view-kanban');
  const adminView = document.getElementById('view-admin-approvals');
  const isMobile = window.matchMedia ? window.matchMedia('(max-width: 1023px)').matches : window.innerWidth < 1024;
  [table, mobile, calendar, calendarMobile, kanban, adminView].forEach(el => { if (el) { el.classList.add('hidden'); el.style.display = 'none'; } });
  
  // 어드민 승인 관리 뷰에서는 불필요한 필터 박스, 리스크 패널 감추기
  const filterBox = document.getElementById('btn-reset-filters')?.closest('.mb-3');
  const riskPanel = document.getElementById('risk-dashboard-panel');
  if (filterBox) {
    if (mode === 'ADMIN') {
      filterBox.classList.add('hidden');
    } else {
      filterBox.classList.remove('hidden');
    }
  }
  if (riskPanel) {
    if (mode === 'ADMIN') {
      riskPanel.classList.add('hidden');
    } else {
      riskPanel.classList.remove('hidden');
    }
  }

  if (mode === 'ADMIN') { if (adminView) { adminView.classList.remove('hidden'); adminView.style.display = ''; } return; }
  if (mode === 'CALENDAR') {
    if (isMobile) {
      // 모바일: 모바일 전용 캘린더 뷰 표시
      if (calendarMobile) { calendarMobile.classList.remove('hidden'); calendarMobile.style.display = ''; }
    } else {
      // 데스크탑: 기존 간트 캘린더 뷰 표시
      if (calendar) { calendar.classList.remove('hidden'); calendar.style.display = ''; }
    }
    return;
  }
  if (mode === 'KANBAN') { if (kanban) { kanban.classList.remove('hidden'); kanban.style.display = ''; } return; }
  if (isMobile) { if (mobile) { mobile.classList.remove('hidden'); mobile.style.display = ''; } }
  else { if (table) { table.classList.remove('hidden'); table.style.display = ''; } }
}
function updateViewToggleButtons(mode) {
  const mappings = [
    ['btn-view-table', 'TABLE'],
    ['btn-view-calendar', 'CALENDAR'],
    ['btn-view-kanban', 'KANBAN'],
    ['btn-view-admin', 'ADMIN'],
    ['btn-view-table-mobile', 'TABLE'],
    ['btn-view-calendar-mobile', 'CALENDAR'],
    ['btn-view-kanban-mobile', 'KANBAN'],
    ['btn-view-admin-mobile', 'ADMIN']
  ];
  mappings.forEach(([id, key]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const isActive = mode === key;
    if (id.endsWith('-mobile')) {
      btn.className = isActive
        ? 'flex-1 rounded-lg bg-white py-2 text-xs font-semibold text-slate-800 shadow-sm transition'
        : 'flex-1 rounded-lg py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition';
    } else {
      btn.className = isActive
        ? 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition'
        : 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition';
    }
  });
}
function switchView(mode) {
  currentViewMode = mode === 'CALENDAR' ? 'CALENDAR' : mode === 'KANBAN' ? 'KANBAN' : mode === 'ADMIN' ? 'ADMIN' : 'TABLE';
  window.currentViewMode = currentViewMode;
  updateViewToggleButtons(currentViewMode);
  setViewVisibility(currentViewMode);
  renderActiveViews();
}
window.switchView = switchView;
window.setViewVisibility = setViewVisibility;
