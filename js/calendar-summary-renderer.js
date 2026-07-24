console.info('Smart Task Flow calendar-summary-renderer.js v20260724-v1 loaded');

function getSummaryNoteDate(note = {}) {
    if (note.noteDate && /^\d{4}-\d{2}-\d{2}$/.test(note.noteDate)) {
        const [year, month, day] = note.noteDate.split('-').map(Number);
        return new Date(year, month - 1, day);
    }
    const ts = note.createdAt;
    if (!ts) return null;
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatSummaryNoteDate(note) {
    const d = getSummaryNoteDate(note);
    if (!d) return '';
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getSummaryNoteTime(note) {
    const d = getSummaryNoteDate(note);
    if (!d) return 0;
    const createdAt = note.createdAt?.toDate ? note.createdAt.toDate() : new Date(note.createdAt || 0);
    if (note.noteDate && !Number.isNaN(createdAt.getTime())) {
        d.setHours(createdAt.getHours(), createdAt.getMinutes(), createdAt.getSeconds(), createdAt.getMilliseconds());
    }
    const time = d.getTime();
    return Number.isFinite(time) ? time : 0;
}

const SUMMARY_REVIEW_TYPES = {
    RESULT: { label: '결과', className: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50' },
    ISSUE: { label: '이슈', className: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50' },
    DECISION: { label: '결정 필요', className: 'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/50' },
    FOLLOWUP: { label: '후속 조치', className: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50' },
    GENERAL: { label: '일반 메모', className: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' }
};
const IMPORTANT_SUMMARY_REVIEW_TYPES = new Set(['ISSUE', 'DECISION', 'FOLLOWUP']);

function getSummaryNoteReviewType(note = {}) {
    const text = `${note.title || ''} ${note.body || ''}`.toLowerCase();
    if (/(완료|완료됨|결과|달성|마감|종료|done|closed|complete|result)/i.test(text)) return 'RESULT';
    if (/(이슈|문제|장애|리스크|지연|차질|막힘|실패|risk|issue|block|delay|problem)/i.test(text)) return 'ISSUE';
    if (/(결정|승인|검토 필요|확인 필요|의사결정|보류|approval|decision|confirm|review needed)/i.test(text)) return 'DECISION';
    if (/(후속|팔로업|추가 조치|다음 단계|액션|예정|follow.?up|todo|to do|next step|action)/i.test(text)) return 'FOLLOWUP';
    return 'GENERAL';
}

function buildSummaryNoteItem(note, taskList) {
    const taskId = note.taskId || '';
    const parts = taskId.split('__sub_');
    const baseTaskId = parts[0];
    const subTaskId = parts.length > 1 ? parts[1] : '';
    const parentTask = (taskList || []).find(t => t.id === baseTaskId);
    const subTask = subTaskId ? parentTask?.subTasks?.find(st => st.id === subTaskId) : null;
    const isSubTask = Boolean(subTaskId);
    const taskTitle = parentTask?.title || '알 수 없는 업무';
    const subTaskTitle = subTask?.title || '';
    const author = (note.createdByName || '').split('@')[0] || '알 수 없음';
    const noteTitle = note.title || '(제목 없음)';
    const body = note.body || '';
    const reviewType = getSummaryNoteReviewType(note);
    const reviewConfig = SUMMARY_REVIEW_TYPES[reviewType] || SUMMARY_REVIEW_TYPES.GENERAL;
    const linkedTitle = isSubTask ? `${taskTitle} ${subTaskTitle}` : taskTitle;
    const isImportant = IMPORTANT_SUMMARY_REVIEW_TYPES.has(reviewType)
        || /(중요|긴급|최우선|주의|important|urgent|critical)/i.test(`${noteTitle} ${body}`);
    const searchText = [
        noteTitle,
        body,
        author,
        taskTitle,
        subTaskTitle,
        note.createdByName || '',
        reviewConfig.label
    ].join(' ').toLowerCase();

    return {
        ...note,
        taskTitle,
        subTaskTitle,
        isSubTask,
        author,
        linkedTitle,
        noteTitle,
        body,
        reviewType,
        reviewLabel: reviewConfig.label,
        reviewClassName: reviewConfig.className,
        isImportant,
        searchText,
        createdAtTime: getSummaryNoteTime(note)
    };
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
    const expandedSubTasks = typeof expandSubTasksForRange === 'function'
        ? expandSubTasksForRange(task, monthStart, monthEnd, getTodayStr())
        : allSubTasks;
    const inMonthSubTasks = expandedSubTasks.filter(st => isSubTaskInMonth(st, monthStart, monthEnd));
    const outsideMonthSubTasks = allSubTasks.filter(st => !isSubTaskInMonth(st, monthStart, monthEnd));
    const completedInMonth = inMonthSubTasks.filter(st => normalizeStatus(st.status) === 'COMPLETED').length;
    const cancelledInMonth = inMonthSubTasks.filter(st => normalizeStatus(st.status) === 'CANCELLED').length;
    return {
        allSubTasks,
        expandedSubTasks,
        inMonthSubTasks,
        outsideMonthSubTasks,
        totalAll: allSubTasks.length,
        totalInMonth: inMonthSubTasks.length,
        activeInMonth: inMonthSubTasks.length - cancelledInMonth,
        hiddenOutsideMonth: Math.max(0, outsideMonthSubTasks.length),
        completedInMonth,
        cancelledInMonth
    };
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
    const isMobileSummaryGrid = grid.id === 'cal-mobile-content';
    grid.className = isMobileSummaryGrid
        ? 'flex flex-col gap-3 bg-white border border-slate-100 p-3 pb-24 rounded-xl min-h-[250px] dark:bg-slate-950 dark:border-slate-800'
        : 'flex flex-col gap-4 bg-slate-50 border border-slate-100 p-5 rounded-xl min-h-[250px] dark:bg-slate-950 dark:border-slate-800';
    grid.innerHTML = '';

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
    const currentMonthTasks = (filteredTasks || []).filter(t => {
        if (isTaskOverlappingMonth(t, monthStart, monthEnd, todayStr)) return true;
        return getMonthlySubTaskSummary(t, monthStart, monthEnd).totalInMonth > 0;
    });

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

    // 이번 달 기록일 기준 메모 필터링 (+ 현재 필터링된 활성 업무에 달린 메모만 포함)
    const activeTaskIds = new Set((filteredTasks || []).map(t => t.id));

    const monthNotes = trackerNotes.filter(note => {
        // 1) 날짜 범위 검사
        const d = getSummaryNoteDate(note);
        if (!d) return false;
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
        
        // 3) 전역 업무 필터는 업무 포함 여부까지만 반영하고, 메모 본문 검색은 섹션 내부 검색으로 분리

        return isMatchedTask;
    }).map(note => buildSummaryNoteItem(note, filteredTasks || []));
    const monthNotesCount = monthNotes.length;

    // 업무도 없고 메모도 없을 때만 빈 화면 표시
    if (currentMonthTasks.length === 0 && monthNotesCount === 0) {
        grid.innerHTML = `<div class="text-center py-16 text-sm text-slate-400 font-semibold">현재 조건 혹은 조회 기간 중 해당 월(${month + 1}월)의 업무 또는 메모 정보가 없습니다.</div>`;
        _summaryRenderInProgress = false;
        return;
    }

    // ── 📌 월간 진행 메모 리스트 (업무 유무와 무관하게 항상 표시) ──
    if (monthNotes.length > 0) {
        monthNotes.sort((a, b) => b.createdAtTime - a.createdAtTime);

        const notesSec = document.createElement('div');
        notesSec.className = 'rounded-xl border border-amber-100 bg-amber-50/20 p-3 mb-4 dark:bg-amber-950/10 dark:border-amber-900/50';
        notesSec.innerHTML = `
            <h3 class="text-xs font-bold mb-3 text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between gap-2">
                <span>📌 이번 달 메모 리뷰</span>
                <span data-summary-note-count class="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold shadow-sm text-amber-700 dark:bg-slate-900">총 ${monthNotes.length}건</span>
            </h3>
        `;
        const noteAuthors = [...new Set(monthNotes.map(note => note.author).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
        const noteFilterState = { type: 'all', reviewType: 'all', author: 'all', query: '', importantOnly: false };

        const filtersBar = document.createElement('div');
        filtersBar.className = 'mb-3 flex flex-col gap-2 rounded-lg border border-amber-100 bg-white/70 p-2 dark:bg-slate-900/70 dark:border-amber-900/50';
        filtersBar.innerHTML = `
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div class="inline-flex w-full overflow-x-auto rounded-lg border border-amber-100 bg-amber-50 p-0.5 text-[11px] font-bold text-amber-800 sm:w-auto dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-300" data-summary-note-type-filter>
                    <button type="button" data-note-type="all" class="flex-1 min-w-[3.5rem] whitespace-nowrap rounded-md px-2.5 py-1.5 bg-white shadow-sm dark:bg-slate-800">전체</button>
                    <button type="button" data-note-type="main" class="flex-1 min-w-[4.5rem] whitespace-nowrap rounded-md px-2.5 py-1.5">본 업무</button>
                    <button type="button" data-note-type="sub" class="flex-1 min-w-[4.5rem] whitespace-nowrap rounded-md px-2.5 py-1.5">하위 업무</button>
                </div>
                <select data-summary-note-author-filter class="w-full rounded-lg border border-amber-100 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 outline-none focus:border-amber-300 sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <option value="all">작성자 전체</option>
                    ${noteAuthors.map(author => `<option value="${escapeHTML(author)}">${escapeHTML(author)}</option>`).join('')}
                </select>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input data-summary-note-search type="search" placeholder="메모 검색" class="min-w-0 flex-1 rounded-lg border border-amber-100 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none placeholder:text-slate-400 focus:border-amber-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100" />
                <button type="button" data-summary-note-important class="shrink-0 rounded-lg border border-amber-200 bg-white px-3 py-2 text-[11px] font-bold text-amber-700 shadow-sm transition hover:bg-amber-50 dark:bg-slate-900 dark:border-amber-900/50 dark:text-amber-300">중요만</button>
            </div>
            <div class="flex gap-1.5 overflow-x-auto pb-0.5 text-[11px] font-bold" data-summary-note-review-filter>
                <button type="button" data-review-type="all" class="shrink-0 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">리뷰 전체</button>
                ${Object.entries(SUMMARY_REVIEW_TYPES).map(([key, config]) => `<button type="button" data-review-type="${key}" class="shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 ${config.className}">${escapeHTML(config.label)}</button>`).join('')}
            </div>
            <div data-summary-note-stats class="text-[11px] font-bold text-amber-700 dark:text-amber-400"></div>
        `;
        notesSec.appendChild(filtersBar);

        const notesList = document.createElement('div');
        notesList.className = 'flex max-h-[460px] flex-col gap-3 overflow-y-auto pr-0.5';

        const createTaskNoteCard = (taskNotes, isPinned = false) => {
            const latestNote = taskNotes[0];
            const baseTaskId = String(latestNote.taskId || '').split('__sub_')[0];
            const hasMainNotes = taskNotes.some(note => !note.isSubTask);
            const hasSubTaskNotes = taskNotes.some(note => note.isSubTask);
            const scopeLabel = hasMainNotes && hasSubTaskNotes
                ? '본·하위 업무'
                : (hasSubTaskNotes ? '하위 업무' : '본 업무');
            const card = document.createElement('div');
            card.dataset.summaryNoteCard = '';
            card.dataset.taskId = baseTaskId;
            card.className = [
                'w-full overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-slate-900',
                isPinned ? 'border-amber-200 dark:border-amber-900/60' : 'border-slate-200 dark:border-slate-800'
            ].join(' ');
            card.innerHTML = `
                <div class="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50">
                    <div class="flex min-w-0 items-center gap-1.5">
                        ${isPinned ? '<span class="shrink-0 text-[11px] text-amber-500">★</span>' : ''}
                        <span class="truncate text-xs font-bold text-slate-800 dark:text-slate-200">${escapeHTML(latestNote.taskTitle)}</span>
                        <span class="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">${scopeLabel}</span>
                    </div>
                    <span class="shrink-0 text-[10px] font-bold text-amber-700 dark:text-amber-400">메모 ${taskNotes.length}건</span>
                </div>
                <div class="divide-y divide-slate-100 dark:divide-slate-800" data-summary-task-notes></div>
            `;

            const entries = card.querySelector('[data-summary-task-notes]');
            taskNotes.forEach(note => {
                const entry = document.createElement('button');
                entry.type = 'button';
                entry.dataset.summaryNoteEntry = '';
                entry.className = 'group block w-full p-3 text-left transition hover:bg-amber-50/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-300 dark:hover:bg-amber-950/10';
                entry.innerHTML = `
                    <div class="flex items-start justify-between gap-2">
                        <span class="min-w-0 flex-1 truncate text-xs font-bold text-slate-800 dark:text-slate-200">${escapeHTML(note.noteTitle)}</span>
                        <span class="shrink-0 text-[10px] font-bold text-amber-600 opacity-0 transition group-hover:opacity-100 dark:text-amber-400">열기</span>
                    </div>
                    <div class="mt-1 flex flex-wrap items-center gap-1.5">
                        ${note.isSubTask ? `<span class="rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-300">하위: ${escapeHTML(note.subTaskTitle || '하위 업무')}</span>` : ''}
                        <span class="rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${note.reviewClassName}">${escapeHTML(note.reviewLabel)}</span>
                        <span class="text-[10px] font-semibold text-slate-400">${formatSummaryNoteDate(note)}</span>
                        <span class="text-[10px] font-semibold text-slate-400">👤 ${escapeHTML(note.author)}</span>
                    </div>
                    <p class="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">${escapeHTML(note.body || '') || '<span class="italic text-slate-400">(내용 없음)</span>'}</p>
                `;
                entry.addEventListener('click', () => {
                    if (typeof window.openNoteDetailPanel === 'function') {
                        window.openNoteDetailPanel(note);
                    }
                });
                entries.appendChild(entry);
            });
            return card;
        };

        function groupNotesByTask(notes) {
            const groups = new Map();
            notes.forEach(note => {
                const taskKey = note.taskId
                    ? String(note.taskId).split('__sub_')[0]
                    : `note:${note.id || note.createdAtTime}`;
                if (!groups.has(taskKey)) groups.set(taskKey, []);
                groups.get(taskKey).push(note);
            });
            return [...groups.values()]
                .map(taskNotes => taskNotes.sort((a, b) => b.createdAtTime - a.createdAtTime))
                .sort((a, b) => b[0].createdAtTime - a[0].createdAtTime);
        }

        function getFilteredNotes() {
            return monthNotes.filter(note => {
                if (noteFilterState.type === 'main' && note.isSubTask) return false;
                if (noteFilterState.type === 'sub' && !note.isSubTask) return false;
                if (noteFilterState.reviewType !== 'all' && note.reviewType !== noteFilterState.reviewType) return false;
                if (noteFilterState.author !== 'all' && note.author !== noteFilterState.author) return false;
                if (noteFilterState.importantOnly && !note.isImportant) return false;
                if (noteFilterState.query && !note.searchText.includes(noteFilterState.query)) return false;
                return true;
            });
        }

        function updateTypeButtons() {
            filtersBar.querySelectorAll('[data-note-type]').forEach(btn => {
                const active = btn.dataset.noteType === noteFilterState.type;
                btn.classList.toggle('bg-white', active);
                btn.classList.toggle('shadow-sm', active);
                btn.classList.toggle('dark:bg-slate-800', active);
            });
        }

        function updateImportantButton() {
            const btn = filtersBar.querySelector('[data-summary-note-important]');
            if (!btn) return;
            btn.classList.toggle('bg-amber-100', noteFilterState.importantOnly);
            btn.classList.toggle('border-amber-400', noteFilterState.importantOnly);
            btn.classList.toggle('ring-2', noteFilterState.importantOnly);
            btn.classList.toggle('ring-amber-200', noteFilterState.importantOnly);
            btn.textContent = noteFilterState.importantOnly ? '중요 해제' : '중요만';
        }

        function updateReviewButtons() {
            filtersBar.querySelectorAll('[data-review-type]').forEach(btn => {
                const active = btn.dataset.reviewType === noteFilterState.reviewType;
                btn.classList.toggle('ring-2', active);
                btn.classList.toggle('ring-amber-300', active);
                btn.classList.toggle('shadow-sm', active);
            });
        }

        function appendNoteGroup(title, taskGroups, pinned) {
            if (!taskGroups.length) return;
            const group = document.createElement('div');
            group.className = 'space-y-2';
            group.innerHTML = `
                <div class="flex items-center justify-between px-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span>${title}</span>
                    <span>${taskGroups.length}개 업무 · ${taskGroups.reduce((sum, notes) => sum + notes.length, 0)}건</span>
                </div>
            `;
            taskGroups.forEach(taskNotes => group.appendChild(createTaskNoteCard(taskNotes, pinned)));
            notesList.appendChild(group);
        }

        function renderFilteredNotes() {
            const filteredNotes = getFilteredNotes();
            const mainCount = filteredNotes.filter(note => !note.isSubTask).length;
            const subCount = filteredNotes.filter(note => note.isSubTask).length;
            const authorCount = new Set(filteredNotes.map(note => note.author)).size;
            const importantCount = filteredNotes.filter(note => note.isImportant).length;
            const reviewCounts = Object.entries(SUMMARY_REVIEW_TYPES)
                .map(([key, config]) => `${config.label} ${filteredNotes.filter(note => note.reviewType === key).length}`)
                .join(' · ');
            const taskGroups = groupNotesByTask(filteredNotes);
            const importantTaskGroups = taskGroups.filter(notes => notes.some(note => note.isImportant));
            const regularTaskGroups = noteFilterState.importantOnly
                ? importantTaskGroups
                : taskGroups.filter(notes => !notes.some(note => note.isImportant));

            notesList.innerHTML = '';
            if (!noteFilterState.importantOnly) {
                appendNoteGroup('중요 업무 메모', importantTaskGroups, true);
                appendNoteGroup('최근 업무 메모', regularTaskGroups, false);
            } else {
                appendNoteGroup('중요 업무 메모', regularTaskGroups, true);
            }
            if (filteredNotes.length === 0) {
                notesList.innerHTML = '<div class="rounded-lg border border-dashed border-amber-200 bg-white/70 p-5 text-center text-xs font-semibold text-slate-400 dark:bg-slate-900/70 dark:border-slate-700">조건에 맞는 메모가 없습니다.</div>';
            }
            notesSec.querySelector('[data-summary-note-count]').textContent = `업무 ${taskGroups.length}개 · 메모 ${filteredNotes.length}/${monthNotes.length}건`;
            notesSec.querySelector('[data-summary-note-stats]').textContent = `총 ${filteredNotes.length}건 · 중요 ${importantCount} · 본 업무 ${mainCount} · 하위 업무 ${subCount} · 작성자 ${authorCount}명 · ${reviewCounts}`;
            updateTypeButtons();
            updateImportantButton();
            updateReviewButtons();
        }

        filtersBar.querySelectorAll('[data-note-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                noteFilterState.type = btn.dataset.noteType || 'all';
                renderFilteredNotes();
            });
        });
        filtersBar.querySelectorAll('[data-review-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                noteFilterState.reviewType = btn.dataset.reviewType || 'all';
                renderFilteredNotes();
            });
        });
        filtersBar.querySelector('[data-summary-note-author-filter]')?.addEventListener('change', (event) => {
            noteFilterState.author = event.target.value || 'all';
            renderFilteredNotes();
        });
        filtersBar.querySelector('[data-summary-note-search]')?.addEventListener('input', (event) => {
            noteFilterState.query = (event.target.value || '').trim().toLowerCase();
            renderFilteredNotes();
        });
        filtersBar.querySelector('[data-summary-note-important]')?.addEventListener('click', () => {
            noteFilterState.importantOnly = !noteFilterState.importantOnly;
            renderFilteredNotes();
        });

        renderFilteredNotes();
        notesSec.appendChild(notesList);

        grid.appendChild(notesSec);
    }

    // ── KPI 요약 바 (업무가 있을 때만, 메모 리뷰 영역 아래에 한 줄로 최소화) ──
    if (currentMonthTasks.length > 0) {
        const groups = { OVERDUE: [], PROGRESS: [], PENDING: [], COMPLETED: [], CANCELLED: [] };
        currentMonthTasks.forEach(t => {
            const status = getEffectiveStatus(t, todayStr);
            if (groups[status]) groups[status].push(t);
            else groups.PENDING.push(t);
        });

        const monthlyTotal = currentMonthTasks.length;
        const monthlyCompleted = groups.COMPLETED.length;
        const monthlyOverdue = groups.OVERDUE.length;
        const monthlyProgress = groups.PROGRESS.length;
        const monthlyPending = groups.PENDING.length;
        const monthlyCancelled = groups.CANCELLED.length;
        const monthlyActiveTotal = monthlyTotal - monthlyCancelled;
        const monthlyCompletionRate = monthlyActiveTotal > 0 ? Math.round((monthlyCompleted / monthlyActiveTotal) * 100) : 0;
        const monthlyActiveTasks = currentMonthTasks.filter(t => getEffectiveStatus(t, todayStr) !== 'CANCELLED');
        const monthlySubTotal = monthlyActiveTasks.reduce((sum, t) => sum + getMonthlySubTaskSummary(t, monthStart, monthEnd).activeInMonth, 0);
        const monthlySubCompleted = monthlyActiveTasks.reduce((sum, t) => sum + getMonthlySubTaskSummary(t, monthStart, monthEnd).completedInMonth, 0);

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
                <span class="text-slate-500">취소 <b>${monthlyCancelled}</b></span>
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
    const groups = { OVERDUE: [], PROGRESS: [], PENDING: [], COMPLETED: [], CANCELLED: [] };
    currentMonthTasks.forEach(t => {
        const status = getEffectiveStatus(t, todayStr);
        if (groups[status]) groups[status].push(t);
        else groups.PENDING.push(t);
    });

    const categories = [
        { key: 'OVERDUE', label: '🚨 일정 초과 및 지연 상태', style: 'bg-rose-50/60 border-rose-100 text-rose-800', list: groups.OVERDUE, open: true },
        { key: 'PROGRESS', label: '⚙️ 현재 적극 진행 중', style: 'bg-blue-50/60 border-blue-100 text-blue-800', list: groups.PROGRESS, open: true },
        { key: 'PENDING', label: '⌛ 대기 및 진행 준비 중', style: 'bg-amber-50/60 border-amber-100 text-amber-800', list: groups.PENDING, open: false },
        { key: 'COMPLETED', label: '⭐️ 정상 완료 항목', style: 'bg-emerald-50/60 border-emerald-100 text-emerald-800', list: groups.COMPLETED, open: false },
        { key: 'CANCELLED', label: '🚫 취소된 업무', style: 'bg-slate-100/70 border-slate-200 text-slate-600', list: groups.CANCELLED, open: false }
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
                ? `<span class="text-[10px] text-slate-400">월내 하위 완료 ${subSummary.completedInMonth}/${subSummary.activeInMonth}${subSummary.cancelledInMonth ? ` · 취소 ${subSummary.cancelledInMonth}` : ''}</span>`
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
