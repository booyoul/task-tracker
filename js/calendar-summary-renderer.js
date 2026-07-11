console.info('Smart Task Flow calendar-summary-renderer.js v20260711-v12 loaded');

function formatSummaryNoteDate(ts) {
    if (!ts) return '';
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Helper functions for monthly calculations
function parseDateOnly(dateStr) {
    if (!dateStr) return null;
    const d = new Date(String(dateStr).replace(/-/g, '/'));
    return isNaN(d.getTime()) ? null : d;
}

function getParentTaskDateRange(item, fallbackDate) {
    const start = parseDateOnly(item.startDate || item.dueDate || fallbackDate);
    const end = parseDateOnly(item.dueDate || item.startDate || fallbackDate);
    return { start, end };
}

function isDateInMonth(dateValue, monthStart, monthEnd) {
    return dateValue && dateValue >= monthStart && dateValue <= monthEnd;
}

function isTaskOverlappingMonth(item, monthStart, monthEnd, fallbackDate) {
    const { start, end } = getParentTaskDateRange(item, fallbackDate);
    if (!start || !end) return false;
    return start <= monthEnd && end >= monthStart;
}

function isSubTaskInMonth(item, monthStart, monthEnd) {
    const start = parseDateOnly(item.startDate);
    const end = parseDateOnly(item.dueDate);
    if (!start || !end) return false;
    return start <= monthEnd && end >= monthStart;
}

function getMonthlySubTaskSummary(task, monthStart, monthEnd) {
    const allSubTasks = Array.isArray(task.subTasks) ? task.subTasks : [];
    const inMonthSubTasks = allSubTasks.filter(st => isSubTaskInMonth(st, monthStart, monthEnd));
    const outsideMonthSubTasks = allSubTasks.filter(st => !isSubTaskInMonth(st, monthStart, monthEnd));
    const completedInMonth = inMonthSubTasks.filter(st => st.status === 'COMPLETED').length;
    return {
        allSubTasks,
        inMonthSubTasks,
        outsideMonthSubTasks,
        totalAll: allSubTasks.length,
        totalInMonth: inMonthSubTasks.length,
        hiddenOutsideMonth: outsideMonthSubTasks.length,
        completedInMonth
    };
}

function buildMonthlySubTaskHTML(task, monthStart, monthEnd) {
    const summary = getMonthlySubTaskSummary(task, monthStart, monthEnd);
    if (summary.totalInMonth === 0) return '';

    // 서브태스크 목록이 많아도 카드 높이가 무한정 늘어나지 않도록 스크롤 영역 제한
    let html = '<div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 max-h-36 overflow-y-auto pr-0.5">';

    summary.inMonthSubTasks.forEach(st => {
        const status = normalizeStatus(st.status);
        const statusKorean = getStatusKorean(status);
        const assigneeNames = Array.isArray(st.assignee) ? st.assignee.join(', ') : (st.assignee || '미지정');
        
        let statusClass = '';
        let textClass = 'text-slate-700 dark:text-slate-350';
        if (status === 'COMPLETED') {
            statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50';
            textClass = 'text-slate-400 line-through dark:text-slate-500';
        } else if (status === 'PROGRESS') {
            statusClass = 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50';
        } else {
            statusClass = 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700';
        }

        html += `
            <div class="text-[11px] flex flex-col gap-1.5 p-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 truncate ${textClass} font-semibold">
                        <span class="truncate">${escapeHTML(st.title)}</span>
                    </div>
                    <span class="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusClass} origin-right">
                        ${statusKorean}
                    </span>
                </div>
                <div class="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <span class="truncate">👤 ${escapeHTML(assigneeNames)}</span>
                    <span class="shrink-0 text-slate-400 dark:text-slate-500">
                        ${st.dueDate ? '📅 ' + st.dueDate.substring(5) : ''}
                    </span>
                </div>
            </div>`;
    });

    html += '</div>';
    return html;
}

let _summaryRenderInProgress = false;
async function renderCalendarSummaryView({ weekdayHeader, grid, year, month, filteredTasks, todayStr }) {
    if (!grid) return;
    // 연속 호출(onSnapshot 중복 트리거) 방지: 이미 렌더링 중이면 스킵
    if (_summaryRenderInProgress) return;
    _summaryRenderInProgress = true;

    try {
    const calMonthYearEl = document.getElementById('calendar-month-year');
    if (calMonthYearEl) calMonthYearEl.textContent = `${year}년 ${month + 1}월`;
    if (weekdayHeader) weekdayHeader.classList.add('hidden');
    grid.className = 'flex flex-col gap-4 bg-slate-50 border border-slate-100 p-5 rounded-xl min-h-[250px]';
    grid.innerHTML = '';

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
    const currentMonthTasks = (filteredTasks || []).filter(t => isTaskOverlappingMonth(t, monthStart, monthEnd, todayStr));

    // ★ 메모를 먼저 가져옴 — 업무 유무와 무관하게 항상 메모를 표시해야 하므로
    let trackerNotes = [];
    if (typeof window.db_fetchTrackerProgressNotes === 'function' && window.currentTrackerId) {
        trackerNotes = await window.db_fetchTrackerProgressNotes(window.currentTrackerId);
    }

    // 태스크 ID 기준(서브태스크 포함)으로 메모 분류
    const notesByTaskId = {};
    trackerNotes.forEach(note => {
        if (!note.taskId) return;
        const baseTaskId = note.taskId.split('__sub_')[0];
        if (!notesByTaskId[baseTaskId]) {
            notesByTaskId[baseTaskId] = [];
        }
        notesByTaskId[baseTaskId].push(note);
    });

    // 이번 달 작성된 메모 필터링 (+ 현재 필터링된 활성 업무에 달린 메모 또는 검색어 매칭 메모 포함)
    const activeTaskIds = new Set((filteredTasks || []).map(t => t.id));
    const searchVal = (document.getElementById('filter-search')?.value || '').trim() || (document.getElementById('filter-search-desktop')?.value || '').trim();
    const search = searchVal.toLowerCase();

    const monthNotes = trackerNotes.filter(note => {
        const ts = note.createdAt;
        if (!ts) return false;
        
        // 1) 날짜 범위 검사
        const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
        const inMonth = d >= monthStart && d <= monthEnd;
        if (!inMonth) return false;
        
        // 2) 소속 업무 검사 (현재 필터링된 활성 업무 목록에 포함되는지)
        if (!note.taskId) return false;
        const parts = note.taskId.split('__sub_');
        const baseTaskId = parts[0];
        const isMatchedTask = activeTaskIds.has(baseTaskId);
        if (!isMatchedTask) return false;

        // 하위 태스크 메모인 경우, 해당 하위 태스크가 실제로 존재하는지 추가 검증 (삭제된 하위 태스크 메모 노출 방지)
        if (parts.length > 1) {
            const subId = parts[1];
            const parentTask = (filteredTasks || []).find(t => t.id === baseTaskId);
            if (!parentTask) return false;
            const subExists = (parentTask.subTasks || []).some(st => st.id === subId);
            if (!subExists) return false;
        }
        
        // 3) 검색어 매칭 대조 (메모 자체 텍스트/작성자 교차 검증)
        if (search) {
            const title = (note.title || '').toLowerCase();
            const body = (note.body || '').toLowerCase();
            const author = (note.createdByName || '').toLowerCase();
            const isNoteMatch = title.includes(search) || body.includes(search) || author.includes(search);
            return isMatchedTask || isNoteMatch;
        }
        
        return isMatchedTask;
    });
    const monthNotesCount = monthNotes.length;

    // 업무도 없고 메모도 없을 때만 빈 화면 표시
    if (currentMonthTasks.length === 0 && monthNotesCount === 0) {
        grid.innerHTML = `<div class="text-center py-16 text-sm text-slate-400 font-semibold">현재 조건 혹은 조회 기간 중 해당 월(${month + 1}월)의 업무 또는 메모 정보가 없습니다.</div>`;
        _summaryRenderInProgress = false;
        return;
    }

    // ── 📌 월간 진행 메모 리스트 (업무 유무와 무관하게 항상 표시) ──
    if (monthNotes.length > 0) {
        monthNotes.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
        });

        const notesSec = document.createElement('div');
        notesSec.className = 'rounded-xl border border-amber-100 bg-amber-50/20 p-3 mb-4 dark:bg-amber-950/10 dark:border-amber-900/50';
        notesSec.innerHTML = `
            <h3 class="text-xs font-bold mb-3 text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between gap-2">
                <span>📌 이번 달 작성된 진행 상황 메모 목록</span>
                <span class="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold shadow-sm text-amber-700 dark:bg-slate-900">최신 ${Math.min(monthNotes.length, 3)}/${monthNotes.length}</span>
            </h3>
        `;
        const notesGrid = document.createElement('div');
        notesGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2';

        const createNoteCard = (note) => {
            let taskTitle = '알 수 없는 업무';
            let subTaskLabel = '';
            if (note.taskId) {
                const baseTaskId = note.taskId.split('__sub_')[0];
                const t = tasks.find(x => x.id === baseTaskId);
                if (t) {
                    taskTitle = t.title;
                    if (note.taskId.includes('__sub_')) {
                        const subId = note.taskId.split('__sub_')[1];
                        const st = t.subTasks?.find(x => x.id === subId);
                        subTaskLabel = st ? `[하위: ${st.title}] ` : '[하위] ';
                    } else {
                        subTaskLabel = '[본 업무] ';
                    }
                }
            }

            const dateStr = formatSummaryNoteDate(note.createdAt);
            const author = escapeHTML((note.createdByName || '').split('@')[0] || '알 수 없음');
            const bodyPreview = escapeHTML((note.body || '').slice(0, 80)) + ((note.body || '').length > 80 ? '...' : '');
            const noteTitleText = subTaskLabel + (note.title || '(제목 없음)');

            const card = document.createElement('div');
            card.className = 'group flex flex-col justify-between rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-md p-3 cursor-pointer transition dark:bg-slate-900 dark:border-slate-800';
            card.innerHTML = `
                <div>
                    <div class="flex items-center justify-between gap-1 mb-1">
                        <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${escapeHTML(noteTitleText)}</span>
                        <span class="text-[10px] text-slate-400 shrink-0">${dateStr}</span>
                    </div>
                    <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3 mb-2">${bodyPreview || '<span class="italic text-slate-400">(내용 없음)</span>'}</p>
                </div>
                <div class="flex items-center justify-between text-[9px] text-slate-450 font-semibold border-t border-slate-50 pt-1.5 mt-1 dark:border-slate-800">
                    <span class="truncate text-slate-500">업무: ${escapeHTML(taskTitle)}</span>
                    <span class="shrink-0 text-slate-400">👤 ${author}</span>
                </div>
            `;
            card.addEventListener('click', () => {
                if (typeof window.openNoteDetailPanel === 'function') {
                    window.openNoteDetailPanel(note);
                }
            });
            return card;
        };

        monthNotes.slice(0, 3).forEach(note => notesGrid.appendChild(createNoteCard(note)));

        notesSec.appendChild(notesGrid);

        if (monthNotes.length > 3) {
            const moreDetails = document.createElement('details');
            moreDetails.className = 'mt-3 rounded-lg border border-amber-100 bg-white/70 p-2 dark:bg-slate-900/70 dark:border-amber-900/50';
            moreDetails.innerHTML = `
                <summary class="cursor-pointer select-none text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    전체 보기 (${monthNotes.length - 3}건 더 보기)
                </summary>
            `;
            const moreGrid = document.createElement('div');
            moreGrid.className = 'mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-0.5';
            monthNotes.slice(3).forEach(note => moreGrid.appendChild(createNoteCard(note)));
            moreDetails.appendChild(moreGrid);
            notesSec.appendChild(moreDetails);
        }

        grid.appendChild(notesSec);
    }

    // ── KPI 요약 바 (업무가 있을 때만, 메모 리뷰 영역 아래에 한 줄로 최소화) ──
    if (currentMonthTasks.length > 0) {
        const groups = { OVERDUE: [], PROGRESS: [], PENDING: [], COMPLETED: [] };
        currentMonthTasks.forEach(t => {
            if (t.status !== 'COMPLETED' && (t.dueDate || '') < todayStr) groups.OVERDUE.push(t);
            else if (groups[t.status]) groups[t.status].push(t);
            else groups.PENDING.push(t);
        });

        const monthlyTotal = currentMonthTasks.length;
        const monthlyCompleted = groups.COMPLETED.length;
        const monthlyOverdue = groups.OVERDUE.length;
        const monthlyProgress = groups.PROGRESS.length;
        const monthlyPending = groups.PENDING.length;
        const monthlyCompletionRate = monthlyTotal > 0 ? Math.round((monthlyCompleted / monthlyTotal) * 100) : 0;
        const monthlySubTotal = currentMonthTasks.reduce((sum, t) => sum + getMonthlySubTaskSummary(t, monthStart, monthEnd).totalInMonth, 0);
        const monthlySubCompleted = currentMonthTasks.reduce((sum, t) => sum + getMonthlySubTaskSummary(t, monthStart, monthEnd).completedInMonth, 0);

        const kpiPanel = document.createElement('div');
        kpiPanel.className = 'mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300';
        kpiPanel.innerHTML = `
            <div class="flex min-w-max items-center gap-2 whitespace-nowrap">
                <span class="text-slate-800 dark:text-slate-100">${year}년 ${month + 1}월 요약</span>
                <span class="text-slate-300">|</span>
                <span>전체 <b class="text-slate-900 dark:text-white">${monthlyTotal}</b></span>
                <span class="text-rose-600">지연 <b>${monthlyOverdue}</b></span>
                <span class="text-blue-600">진행 <b>${monthlyProgress}</b></span>
                <span class="text-amber-600">대기 <b>${monthlyPending}</b></span>
                <span class="text-emerald-600">완료율 <b>${monthlyCompletionRate}%</b> (${monthlyCompleted})</span>
                <span class="text-indigo-600">하위 <b>${monthlySubCompleted}/${monthlySubTotal}</b></span>
                <span class="text-amber-700">메모 <b>${monthNotesCount}</b></span>
            </div>
        `;
        grid.appendChild(kpiPanel);
    }

    // 업무 없음 안내 (메모는 위에 표시됐으므로 가벼운 메시지만)
    if (currentMonthTasks.length === 0) {
        const noTaskEl = document.createElement('div');
        noTaskEl.className = 'text-center py-6 text-sm text-slate-400';
        noTaskEl.textContent = `${month + 1}월에 해당하는 업무가 없습니다.`;
        grid.appendChild(noTaskEl);
        _summaryRenderInProgress = false;
        return;
    }

    // ── 업무 카테고리별 섹션 ──────────────────────────────────────
    const groups = { OVERDUE: [], PROGRESS: [], PENDING: [], COMPLETED: [] };
    currentMonthTasks.forEach(t => {
        if (t.status !== 'COMPLETED' && (t.dueDate || '') < todayStr) groups.OVERDUE.push(t);
        else if (groups[t.status]) groups[t.status].push(t);
        else groups.PENDING.push(t);
    });

    const categories = [
        { key: 'OVERDUE', label: '🚨 일정 초과 및 지연 상태', style: 'bg-rose-50/60 border-rose-100 text-rose-800', list: groups.OVERDUE, open: true },
        { key: 'PROGRESS', label: '⚙️ 현재 적극 진행 중', style: 'bg-blue-50/60 border-blue-100 text-blue-800', list: groups.PROGRESS, open: true },
        { key: 'PENDING', label: '⌛ 대기 및 진행 준비 중', style: 'bg-amber-50/60 border-amber-100 text-amber-800', list: groups.PENDING, open: false },
        { key: 'COMPLETED', label: '⭐️ 정상 완료 항목', style: 'bg-emerald-50/60 border-emerald-100 text-emerald-800', list: groups.COMPLETED, open: false }
    ];

    categories.forEach(cat => {
        if (cat.list.length === 0) return;
        const sec = document.createElement('details');
        sec.className = `rounded-xl border p-4 ${cat.style} mb-4`;
        sec.open = cat.open;
        sec.innerHTML = `<summary class="cursor-pointer select-none text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-2"><span>${cat.label}</span><span class="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold shadow-sm">${cat.list.length}건</span></summary>`;
        const subGrid = document.createElement('div');
        subGrid.className = 'mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5';

        cat.list.forEach(t => {
            const subSummary = getMonthlySubTaskSummary(t, monthStart, monthEnd);
            const subBadgeMarkup = subSummary.totalInMonth > 0
                ? `<span class="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded font-bold">하위 ${subSummary.totalInMonth}건</span>`
                : (subSummary.totalAll > 0 ? `<span class="text-[10px] bg-slate-50 text-slate-500 border border-slate-100 px-1.5 py-0.5 rounded font-bold">하위 0건</span>` : '');
            const subProgressMarkup = subSummary.totalInMonth > 0
                ? `<span class="text-[10px] text-slate-400">월내 하위 완료 ${subSummary.completedInMonth}/${subSummary.totalInMonth}</span>`
                : (subSummary.totalAll > 0 ? `<span class="text-[10px] text-slate-400">해당 월 하위 업무 없음</span>` : '');

            // 태스크의 메모 수 배지
            const noteCount = notesByTaskId[t.id]?.length || 0;
            const noteBadgeMarkup = noteCount > 0
                ? `<span class="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded font-bold">메모 ${noteCount}건</span>`
                : '';

            const progressPct = typeof getTaskProgress === 'function' ? getTaskProgress(t) : 0;

            const priorityColors = {
                CRITICAL: 'bg-rose-100 text-rose-700 border-rose-200',
                HIGH: 'bg-red-50 text-red-700 border-red-100',
                NORMAL: 'bg-slate-50 text-slate-600 border-slate-100',
                LOW: 'bg-slate-100/70 text-slate-500 border-slate-100/50'
            };

            const box = document.createElement('div');
            box.className = 'bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm cursor-pointer transition hover:border-indigo-400 hover:shadow-md flex flex-col justify-between h-full dark:bg-slate-900 dark:border-slate-800';
            box.onclick = () => openTaskModal(t.id);
            box.innerHTML = `
                <div class="flex-grow">
                    <div class="flex items-start justify-between gap-2 mb-1.5">
                        <h4 class="text-xs font-bold text-slate-800 dark:text-white line-clamp-2 flex-1">${escapeHTML(t.title)}</h4>
                        <div class="flex items-center gap-1 shrink-0">
                            <span class="px-1.5 py-0.5 rounded text-[8px] font-black border uppercase tracking-wider ${priorityColors[t.priority] || priorityColors.NORMAL}">${t.priority || 'NORMAL'}</span>
                        </div>
                    </div>
                    <div class="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        <span class="flex items-center gap-1">🗓️ ${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5)}</span>
                        <span class="font-bold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 px-1.5 py-0.5 border dark:border-slate-700 rounded">${escapeHTML(Array.isArray(t.assignee) ? t.assignee.join(', ') : (t.assignee || '미정'))}</span>
                    </div>
                    <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-1.5">
                            ${subBadgeMarkup}
                            ${noteBadgeMarkup}
                        </div>
                        ${subProgressMarkup}
                    </div>
                </div>
                <div class="mt-3">
                    <div class="flex items-center justify-between text-[9px] text-slate-400 mb-1">
                        <span>진척도</span>
                        <span class="font-bold text-slate-700 dark:text-slate-300">${progressPct}%</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1">
                        <div class="bg-indigo-600 h-1 rounded-full" style="width: ${progressPct}%"></div>
                    </div>
                </div>`;
            subGrid.appendChild(box);
        });

        sec.appendChild(subGrid);
        grid.appendChild(sec);
    });

    } catch(e) {
        console.error('[CalendarSummary] 렌더링 중 오류:', e);
    } finally {
        _summaryRenderInProgress = false;
    }
}
