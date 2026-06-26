console.info('Smart Task Flow calendar-summary-renderer.js v20260626-module-split-phase4d-summary-renderer loaded');
// SUMMARY calendar renderer. Extracted from app.js in Phase 4D.
function renderCalendarSummaryView(ctx) {
  const { weekdayHeader, grid, year, month, filteredTasks, todayStr } = ctx;
  weekdayHeader?.classList.add('hidden');
  grid.className = 'flex flex-col gap-4 bg-slate-50 border border-slate-100 p-5 rounded-xl min-h-[250px]';
  grid.innerHTML = '';
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  const monthTasks = filteredTasks.filter(t => dateRangeOverlaps(t, monthStart, monthEnd, todayStr));
  if (!monthTasks.length) { grid.innerHTML = `<div class="text-sm text-slate-400">현재 조건 혹은 조회 기간 중 해당 월(${month + 1}월)의 업무 정보가 존재하지 않습니다.</div>`; return; }
  const cats = { OVERDUE: [], PROGRESS: [], PENDING: [], COMPLETED: [] };
  monthTasks.forEach(t => { const es = getEffectiveStatus(t, todayStr); if (es === 'OVERDUE') cats.OVERDUE.push(t); else cats[es || 'PENDING'].push(t); });
  const total = monthTasks.length;
  const done = cats.COMPLETED.length;
  const overdue = monthTasks.reduce((sum, t) => sum + countTaskOverdueUnits(t, todayStr), 0);
  const subTotal = monthTasks.reduce((sum, t) => sum + ((t.subTasks || []).length), 0);
  const subDone = monthTasks.reduce((sum, t) => sum + ((t.subTasks || []).filter(st => st.status === 'COMPLETED').length), 0);
  const panel = document.createElement('div');
  panel.className = 'grid grid-cols-2 md:grid-cols-4 gap-3';
  panel.innerHTML = `<div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">월간 업무</div><div class="text-xl font-bold">${total}</div><div class="text-[10px] text-slate-400">진행 ${cats.PROGRESS.length} · 대기 ${cats.PENDING.length}</div></div><div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">완료율</div><div class="text-xl font-bold">${Math.round(done / total * 100)}%</div><div class="text-[10px] text-slate-400">완료 ${done}/${total}</div></div><div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">지연율</div><div class="text-xl font-bold text-rose-600">${Math.round(overdue / Math.max(total + subTotal, 1) * 100)}%</div><div class="text-[10px] text-slate-400">지연 ${overdue}/${total + subTotal}</div></div><div class="bg-white rounded-xl p-3 border"><div class="text-xs text-slate-400">하위 업무 완료</div><div class="text-xl font-bold">${subDone}/${subTotal}</div></div>`;
  grid.appendChild(panel);
  const summaryGrid = document.createElement('div');
  summaryGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-3';
  const assigneeSummary = {};
  const industrySummary = {};
  monthTasks.forEach(t => {
    const a = t.assignee || '미지정';
    assigneeSummary[a] = assigneeSummary[a] || { total: 0, overdue: 0, completed: 0 };
    assigneeSummary[a].total += 1;
    if (getEffectiveStatus(t, todayStr) === 'OVERDUE') assigneeSummary[a].overdue += 1;
    if (getEffectiveStatus(t, todayStr) === 'COMPLETED') assigneeSummary[a].completed += 1;
    const ind = detectIndustryKey(t);
    industrySummary[ind] = (industrySummary[ind] || 0) + 1;
  });
  const topOverdue = [...monthTasks].filter(t => getEffectiveStatus(t, todayStr) === 'OVERDUE').sort((a,b) => getMaxDelayDays(b, todayStr) - getMaxDelayDays(a, todayStr)).slice(0, 5);
  const assigneeRows = Object.entries(assigneeSummary).sort((a,b) => b[1].overdue - a[1].overdue || b[1].total - a[1].total).slice(0, 5);
  const industryRows = Object.entries(industrySummary).sort((a,b) => b[1] - a[1]).slice(0, 6);
  summaryGrid.innerHTML = `
    <div class="rounded-xl border border-rose-100 bg-white p-3 shadow-sm"><div class="text-xs font-black text-rose-700">Top Risk</div><div class="mt-2 space-y-1">${topOverdue.length ? topOverdue.map(t => `<div class="truncate text-xs text-slate-600">🚨 ${escapeHTML(t.title)} · D+${getMaxDelayDays(t, todayStr)}</div>`).join('') : '<div class="text-xs text-emerald-600 font-bold">Risk 없음</div>'}</div></div>
    <div class="rounded-xl border border-slate-100 bg-white p-3 shadow-sm"><div class="text-xs font-black text-slate-700">담당자별 요약</div><div class="mt-2 space-y-1">${assigneeRows.length ? assigneeRows.map(([name,k]) => `<div class="flex justify-between gap-2 text-xs"><span class="truncate text-slate-600">👤 ${escapeHTML(name)}</span><span class="font-bold text-slate-700">전체 ${k.total} · 지연 ${k.overdue} · 완료 ${k.completed}</span></div>`).join('') : '<div class="text-xs text-slate-400">데이터 없음</div>'}</div></div>
    <div class="rounded-xl border border-slate-100 bg-white p-3 shadow-sm"><div class="text-xs font-black text-slate-700">산업별 요약</div><div class="mt-2 flex flex-wrap gap-1.5">${industryRows.length ? industryRows.map(([name,cnt]) => `<span class="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600 border border-slate-100">${escapeHTML(name)} ${cnt}</span>`).join('') : '<span class="text-xs text-slate-400">데이터 없음</span>'}</div></div>`;
  grid.appendChild(summaryGrid);
  [
    { key: 'OVERDUE', label: '🚨 일정 초과 및 지연 상태', style: 'bg-rose-50/75 border-rose-100 text-rose-800' },
    { key: 'PROGRESS', label: '⚙️ 현재 적극 진행 중', style: 'bg-blue-50/75 border-blue-100 text-blue-800' },
    { key: 'PENDING', label: '⌛ 대기 및 진행 준비 중', style: 'bg-amber-50/75 border-amber-100 text-amber-800' },
    { key: 'COMPLETED', label: '⭐️ 정상 완료 항목', style: 'bg-emerald-50/75 border-emerald-100 text-emerald-800' }
  ].forEach(cat => {
    if (!cats[cat.key].length) return;
    const sec = document.createElement('div');
    sec.className = `rounded-xl border p-4 ${cat.style}`;
    sec.innerHTML = `<h4 class="font-bold mb-3">${cat.label} <span class="text-xs opacity-70">${cats[cat.key].length}건</span></h4>`;
    const cards = document.createElement('div');
    cards.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5';
    cats[cat.key].forEach(t => {
      const { allSubTasks, visibleSubTasks } = getMonthlySubTasks(t, monthStart, monthEnd, todayStr);
      const subOverdueCount = countOverdueSubTasks(t, todayStr);
      const badge = allSubTasks.length ? `<span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">하위 ${visibleSubTasks.length}/${allSubTasks.length}</span>${subOverdueCount ? ` <span class="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-100">하위 초과 ${subOverdueCount}</span>` : ''}` : '';
      const card = document.createElement('div');
      card.className = 'bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm cursor-pointer transition hover:border-indigo-400 hover:shadow-md';
      card.onclick = () => openTaskModal(t.id);
      card.innerHTML = `<div class="font-bold text-sm text-slate-800">${escapeHTML(t.title)}</div><div class="mt-1 text-xs text-slate-500">${badge} 🗓️ ${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5)} · ${escapeHTML(t.assignee || '미지정')}</div>${buildMonthlySubTaskHTML(t, monthStart, monthEnd, todayStr)}`;
      cards.appendChild(card);
    });
    sec.appendChild(cards);
    grid.appendChild(sec);
  });
}
