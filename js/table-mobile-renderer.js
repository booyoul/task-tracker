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
      <td class="px-2 py-4 text-center text-slate-400"><button type="button" class="btn-order-up block mx-auto hover:text-indigo-600" data-id="${t.id}">▲</button><button type="button" class="btn-order-down block mx-auto hover:text-indigo-600" data-id="${t.id}">▼</button></td>
      <td class="px-3 py-4 text-center"><input type="checkbox" class="cb-task rounded border-slate-300 cursor-pointer text-indigo-600 focus:ring-indigo-500" data-id="${t.id}" ${checked ? 'checked' : ''}></td>
      ${buildTaskDetailCellHTML(t, subTasks, isExpanded, doneSubs, progressPct, bottleneckHTML)}
      <td class="px-3 py-4 align-top whitespace-nowrap"><div class="inline-flex items-center gap-1.5 whitespace-nowrap"><span class="inline-flex h-7 w-7 items-center justify-center rounded-full ${getAvatarStyle(t.assignee)} text-xs font-bold">${escapeHTML((t.assignee || 'U').charAt(0))}</span><span class="font-semibold">${escapeHTML(t.assignee || '미지정')}</span></div></td>
      <td class="px-3 py-4 align-top whitespace-nowrap"><div class="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-600"><span>${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5)}</span><span class="inline-flex shrink-0 rounded-lg border px-2 py-0.5 text-[11px] ${timeline.class}">${timeline.text}</span></div></td>
      <td class="px-2 py-4 text-center align-top"><span class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold">${getPriorityBadge(t.priority)}</span></td>
      <td class="px-3 py-4 text-center align-top whitespace-nowrap"><div class="mb-1 text-[10px] font-bold text-slate-400 whitespace-nowrap">${getStatusKorean(effectiveStatus)}</div><select class="sel-status rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-500 task-status-compact" data-id="${t.id}"><option value="PENDING" ${t.status === 'PENDING' ? 'selected' : ''}>진행 대기 ⌛</option><option value="PROGRESS" ${t.status === 'PROGRESS' ? 'selected' : ''}>진행 중 ⚙️</option><option value="COMPLETED" ${t.status === 'COMPLETED' ? 'selected' : ''}>완료됨 ⭐️</option></select></td>
      <td class="px-2 py-4 text-center align-top whitespace-nowrap"><button type="button" class="btn-edit text-slate-400 hover:text-indigo-600 px-2" data-id="${t.id}">✎</button><button type="button" class="btn-delete text-slate-400 hover:text-rose-600 px-2" data-id="${t.id}">🗑</button></td>`;
    tbody.appendChild(tr);
    if (subTasks.length && isExpanded) {
      subTasks.forEach(st => {
        const status = normalizeStatus(st.status);
        const subAssignee = st.assignee || t.assignee || '미지정';
        const stTimeline = getSubTaskTimelineStatus(st);
        const sr = document.createElement('tr');
        sr.className = isSubTaskOverdue(st) ? 'bg-rose-50/70 border-l-2 border-l-rose-500/60 hover:bg-rose-50 transition-colors text-xs' : 'bg-slate-50/70 border-l-2 border-l-indigo-500/40 hover:bg-indigo-50/30 transition-colors text-xs';
        sr.innerHTML = `
          <td colspan="2"></td>
          <td class="px-4 py-2 text-slate-600"><div class="flex items-center gap-2 pl-8"><span class="text-slate-300">└─</span><span class="font-semibold ${status === 'COMPLETED' ? 'line-through text-slate-400' : isSubTaskOverdue(st) ? 'text-rose-700' : 'text-slate-700'}">${isSubTaskOverdue(st) ? '🚨 ' : ''}${escapeHTML(st.title)}</span><span class="rounded border border-indigo-100 bg-indigo-50 px-1 py-0.5 text-[10px] font-bold text-indigo-700">👤 ${escapeHTML(subAssignee)}</span></div></td>
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
          <div class="truncate text-xs font-bold ${status === 'COMPLETED' ? 'line-through text-slate-400' : overdue ? 'text-rose-700' : 'text-slate-700'}">↳ ${overdue ? '🚨 ' : ''}${escapeHTML(st.title || '')}</div>
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
        <button type="button" class="btn-edit mobile-touch-btn rounded-xl bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white" data-id="${t.id}">수정</button>
      </div>`;
    container.appendChild(card);
  });
}


function setViewVisibility(mode) {
  const table = document.getElementById('view-table');
  const mobile = document.getElementById('view-mobile');
  const calendar = document.getElementById('view-calendar');
  const isMobile = window.matchMedia ? window.matchMedia('(max-width: 1023px)').matches : window.innerWidth < 1024;

  // Hard reset: prevent Tailwind responsive classes (e.g., lg:block) from overriding visibility.
  if (table) { table.classList.add('hidden'); table.style.display = 'none'; }
  if (mobile) { mobile.classList.add('hidden'); mobile.style.display = 'none'; }
  if (calendar) { calendar.classList.add('hidden'); calendar.style.display = 'none'; }

  if (mode === 'CALENDAR') {
    if (calendar) { calendar.classList.remove('hidden'); calendar.style.display = ''; }
    return;
  }

  // TABLE/LIST mode: desktop gets table, mobile gets card. Never show both.
  if (isMobile) {
    if (mobile) { mobile.classList.remove('hidden'); mobile.style.display = ''; }
  } else {
    if (table) { table.classList.remove('hidden'); table.style.display = ''; }
  }
}
function updateViewToggleButtons(mode) {
  const tableBtn = document.getElementById('btn-view-table');
  const calBtn = document.getElementById('btn-view-calendar');
  if (tableBtn) tableBtn.className = mode === 'CALENDAR'
    ? 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition'
    : 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition';
  if (calBtn) calBtn.className = mode === 'CALENDAR'
    ? 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition'
    : 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition';
}
function switchView(mode) {
  currentViewMode = mode === 'CALENDAR' ? 'CALENDAR' : 'TABLE';
  updateViewToggleButtons(currentViewMode);
  setViewVisibility(currentViewMode);
  renderActiveViews();
}

