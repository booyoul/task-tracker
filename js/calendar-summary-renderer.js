console.info('Smart Task Flow calendar-summary-renderer.js v20260711-v1 loaded');

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
    const isStartInMonth = isDateInMonth(start, monthStart, monthEnd);
    const isEndInMonth = isDateInMonth(end, monthStart, monthEnd);
    return isStartInMonth || isEndInMonth;
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
    if (summary.totalAll === 0) return '';

    // 서브태스크 목록이 많아도 카드 높이가 무한정 늘어나지 않도록 스크롤 영역 제한
    let html = '<div class="mt-2.5 pt-2.5 border-t border-slate-100/80 space-y-1.5 max-h-24 overflow-y-auto pr-0.5">';

    if (summary.totalInMonth > 0) {
        summary.inMonthSubTasks.forEach(st => {
            const stIcon = st.status === 'COMPLETED' ? '✅' : '⌛';
            const stColor = st.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-600';
            html += `
                <div class="text-[10px] flex items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 truncate ${stColor}">
                        <span>${stIcon}</span>
                        <span class="truncate">${escapeHTML(st.title)}</span>
                    </div>
                    <span class="shrink-0 font-medium text-[9px] bg-slate-50 px-1.5 py-0.5 rounded text-slate-400 border border-slate-200">
                        ${st.dueDate ? st.dueDate.substring(5) : ''}
                    </span>
                </div>`;
        });
    } else {
        html += '<div class="text-[10px] text-slate-400">해당 월 하위 업무 없음</div>';
    }

    if (summary.hiddenOutsideMonth > 0) {
        html += `<div class="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1">외 ${summary.hiddenOutsideMonth}건 숨김 (해당 월 외)</div>`;
    }

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
    const currentMonthTasks = filteredTasks.filter(t => isTaskOverlappingMonth(t, monthStart, monthEnd, todayStr));

    if (currentMonthTasks.length === 0) {
        grid.innerHTML = `<div class="text-center py-16 text-sm text-slate-400 font-semibold">현재 조건 혹은 조회 기간 중 해당 월(${month + 1}월)의 업무 정보가 존재하지 않습니다.</div>`;
        _summaryRenderInProgress = false;
        return;
    }

    // 트래커 전체 메모 가져오기
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

    // 월별 작성된 총 메모 건수 계산
    const monthNotesCount = trackerNotes.filter(note => {
        const ts = note.createdAt;
        if (!ts) return false;
        const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
        return d >= monthStart && d <= monthEnd;
    }).length;

    const groups = { OVERDUE: [], PROGRESS: [], PENDING: [], COMPLETED: [] };
    currentMonthTasks.forEach(t => {
        if (t.status !== 'COMPLETED' && (t.dueDate || '') < todayStr) groups.OVERDUE.push(t);
        else groups[t.status].push(t);
    });

    const monthlyTotal = currentMonthTasks.length;
    const monthlyCompleted = groups.COMPLETED.length;
    const monthlyOverdue = groups.OVERDUE.length;
    const monthlyProgress = groups.PROGRESS.length;
    const monthlyPending = groups.PENDING.length;
    const monthlyCompletionRate = monthlyTotal > 0 ? Math.round((monthlyCompleted / monthlyTotal) * 100) : 0;
    const monthlyDelayRate = monthlyTotal > 0 ? Math.round((monthlyOverdue / monthlyTotal) * 100) : 0;
    const monthlySubTotal = currentMonthTasks.reduce((sum, t) => sum + getMonthlySubTaskSummary(t, monthStart, monthEnd).totalInMonth, 0);
    const monthlySubCompleted = currentMonthTasks.reduce((sum, t) => sum + getMonthlySubTaskSummary(t, monthStart, monthEnd).completedInMonth, 0);

    const kpiPanel = document.createElement('div');
    kpiPanel.className = 'flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-2.5 shadow-sm mb-4 text-xs';
    kpiPanel.innerHTML = `
        <div class="flex flex-wrap items-center gap-2">
            <span class="font-black text-slate-800">${year}년 ${month + 1}월 요약</span>
            <span class="rounded bg-slate-50 px-2 py-0.5 font-semibold text-slate-600 border border-slate-100">전체 <b>${monthlyTotal}</b>건</span>
            <span class="rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 border border-emerald-100">완료 <b>${monthlyCompleted}</b>건 (${monthlyCompletionRate}%)</span>
            <span class="rounded bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 border border-blue-100">진행 <b>${monthlyProgress}</b></span>
            <span class="rounded bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 border border-rose-100">지연 <b>${monthlyOverdue}</b></span>
        </div>
        <div class="flex items-center gap-3 text-slate-500 font-medium shrink-0 flex-wrap">
            <span>⏱️ 하위 업무 <b class="text-indigo-600">${monthlySubTotal}</b>건 (완료 ${monthlySubCompleted})</span>
            <span class="text-slate-300">|</span>
            <span>📌 이번 달 메모 <b class="text-amber-600">${monthNotesCount}</b>건</span>
        </div>
    `;
    grid.appendChild(kpiPanel);

    // 📌 월간 진행 메모 리스트 렌더링
    const monthNotes = trackerNotes.filter(note => {
        const ts = note.createdAt;
        if (!ts) return false;
        const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
        return d >= monthStart && d <= monthEnd;
    });

    if (monthNotes.length > 0) {
        monthNotes.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
        });

        const notesSec = document.createElement('div');
        notesSec.className = 'rounded-xl border border-amber-250 bg-amber-50/20 p-4 mb-4 dark:bg-amber-950/10 dark:border-amber-900/50';
        notesSec.innerHTML = `
            <h3 class="text-xs font-bold mb-3 text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between">
                <span>📌 이번 달 작성된 진행 상황 메모 목록</span>
                <span class="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold shadow-sm text-amber-700 dark:bg-slate-900">${monthNotes.length}건</span>
            </h3>
        `;
        const notesGrid = document.createElement('div');
        // 메모가 많아도 월별 요약 레이아웃이 무한 확장되지 않도록 최대 높이 + 스크롤 적용
        notesGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-0.5';

        monthNotes.forEach(note => {
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
            notesGrid.appendChild(card);
        });

        notesSec.appendChild(notesGrid);
        grid.appendChild(notesSec);
    }

    const categories = [
        { key: 'OVERDUE', label: '🚨 일정 초과 및 지연 상태', style: 'bg-rose-50/60 border-rose-100 text-rose-800', list: groups.OVERDUE },
        { key: 'PROGRESS', label: '⚙️ 현재 적극 진행 중', style: 'bg-blue-50/60 border-blue-100 text-blue-800', list: groups.PROGRESS },
        { key: 'PENDING', label: '⌛ 대기 및 진행 준비 중', style: 'bg-amber-50/60 border-amber-100 text-amber-800', list: groups.PENDING },
        { key: 'COMPLETED', label: '⭐️ 정상 완료 항목', style: 'bg-emerald-50/60 border-emerald-100 text-emerald-800', list: groups.COMPLETED }
    ];

    categories.forEach(cat => {
        if (cat.list.length === 0) return;
        const sec = document.createElement('div');
        sec.className = `rounded-xl border p-4 ${cat.style} mb-4`;
        sec.innerHTML = `<h3 class="text-xs font-bold mb-3 uppercase tracking-wider flex items-center justify-between"><span>${cat.label}</span><span class="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold shadow-sm">${cat.list.length}건</span></h3>`;
        const subGrid = document.createElement('div');
        subGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5';

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

            // 최신 메모 1줄 미리보기
            const latestNote = notesByTaskId[t.id]?.[0];
            let latestNoteMarkup = '';
            if (latestNote) {
                const noteTitle = latestNote.title ? `[${latestNote.title}] ` : '';
                const noteBody = escapeHTML(latestNote.body || '').slice(0, 50) + ((latestNote.body || '').length > 50 ? '...' : '');
                const noteAuthor = latestNote.createdByName ? ` (${latestNote.createdByName.split('@')[0]})` : '';
                latestNoteMarkup = `
                    <div class="mt-2 text-[10px] bg-amber-50/50 border border-amber-100 rounded-lg p-2 text-slate-600 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-slate-350">
                        <span class="font-semibold text-amber-800 dark:text-amber-400">📌 최신 진행 상황:</span>
                        <span>${escapeHTML(noteTitle)}${noteBody}${noteAuthor}</span>
                    </div>
                `;
            }

            const subTasksHtml = buildMonthlySubTaskHTML(t, monthStart, monthEnd);
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
                    ${latestNoteMarkup}
                    ${subTasksHtml}
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
