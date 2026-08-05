console.info('Smart Task Flow calendar-notes-renderer.js v20260805-v4 loaded');

let _calendarNotesRenderToken = 0;

async function renderCalendarNotesView({ weekdayHeader, grid, noteTaskScope = [] }) {
    if (!grid) return;
    const renderToken = ++_calendarNotesRenderToken;
    const startMonth = document.getElementById('filter-start-month')?.value || '';
    const endMonth = document.getElementById('filter-end-month')?.value || '';
    const formatMonth = value => {
        if (!/^\d{4}-\d{2}$/.test(value)) return '';
        const [rangeYear, rangeMonth] = value.split('-').map(Number);
        return `${rangeYear}년 ${rangeMonth}월`;
    };
    const rangeLabel = startMonth && endMonth
        ? (startMonth === endMonth ? formatMonth(startMonth) : `${formatMonth(startMonth)} – ${formatMonth(endMonth)}`)
        : (startMonth ? `${formatMonth(startMonth)} 이후` : (endMonth ? `${formatMonth(endMonth)} 이전` : '전체 기간'));
    if (weekdayHeader) weekdayHeader.classList.add('hidden');

    const isMobile = window.matchMedia
        ? window.matchMedia('(max-width: 1023px)').matches
        : window.innerWidth < 1024;
    grid.className = isMobile
        ? 'flex min-h-[250px] flex-col gap-3 bg-white p-3 pb-24 dark:bg-slate-950'
        : 'flex min-h-[250px] flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950';
    grid.innerHTML = `
        <div class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
            메모를 불러오는 중입니다.
        </div>`;

    try {
        const { notes: rangeNotes } = await loadCalendarNotesForRange({ startMonth, endMonth, noteTaskScope });
        if (renderToken !== _calendarNotesRenderToken) return;
        if (typeof currentViewMode !== 'undefined' && currentViewMode !== 'NOTES') return;

        const notes = [...rangeNotes].sort((a, b) => b.createdAtTime - a.createdAtTime);
        const workTypes = [...new Map(
            notes
                .filter(note => note.workTypeKey)
                .map(note => [note.workTypeKey, note.workTypeDisplayLabel || note.workTypeKey])
        ).entries()].sort((a, b) => a[1].localeCompare(b[1], 'ko'));
        const hasUncategorizedNotes = notes.some(note => !note.workTypeKey);
        const pageSize = 20;
        const filterState = { workType: 'all', commentsOnly: false, currentPage: 1 };

        grid.innerHTML = `
            <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" data-calendar-notes-view>
                <header class="border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-sm dark:bg-amber-950/40" aria-hidden="true">📌</span>
                                <div>
                                    <h3 class="text-sm font-black text-slate-900 dark:text-slate-100">${escapeHTML(rangeLabel)} 메모</h3>
                                    <p class="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">메모 기록일 기준 · 최신순</p>
                                </div>
                            </div>
                        </div>
                        <span class="self-start rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300" data-calendar-notes-count>총 ${notes.length}건</span>
                    </div>
                    <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <label class="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 sm:max-w-xs">
                            메모 유형
                            <select data-calendar-notes-work-type class="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-amber-950/50">
                                <option value="all">전체 유형</option>
                                ${workTypes.map(([key, label]) => `<option value="${escapeHTML(key)}">${escapeHTML(label)}</option>`).join('')}
                                ${hasUncategorizedNotes ? '<option value="__uncategorized__">유형 미지정</option>' : ''}
                            </select>
                        </label>
                        <button type="button" aria-pressed="false" data-calendar-notes-comments-only class="inline-flex min-h-10 items-center justify-center gap-1.5 self-stretch whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-300 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:self-end">
                            <span aria-hidden="true">💬</span><span data-calendar-notes-comments-label>댓글 있음</span>
                        </button>
                    </div>
                </header>
                <div class="divide-y divide-slate-100 dark:divide-slate-800" data-calendar-notes-list></div>
                <nav class="hidden items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5" data-calendar-notes-pagination aria-label="메모 페이지 이동">
                    <button type="button" data-calendar-notes-prev class="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-300 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">이전</button>
                    <span class="text-xs font-black tabular-nums text-slate-600 dark:text-slate-300" data-calendar-notes-page-status></span>
                    <button type="button" data-calendar-notes-next class="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-300 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">다음</button>
                </nav>
            </section>`;

        const list = grid.querySelector('[data-calendar-notes-list]');
        const count = grid.querySelector('[data-calendar-notes-count]');
        const workTypeFilter = grid.querySelector('[data-calendar-notes-work-type]');
        const commentsToggle = grid.querySelector('[data-calendar-notes-comments-only]');
        const pagination = grid.querySelector('[data-calendar-notes-pagination]');
        const pageStatus = grid.querySelector('[data-calendar-notes-page-status]');
        const prevButton = grid.querySelector('[data-calendar-notes-prev]');
        const nextButton = grid.querySelector('[data-calendar-notes-next]');

        function getFilteredNotes() {
            return notes.filter(note => {
                if (filterState.workType === '__uncategorized__' && note.workTypeKey) return false;
                if (filterState.workType !== 'all' && filterState.workType !== '__uncategorized__' && note.workTypeKey !== filterState.workType) return false;
                if (filterState.commentsOnly && !(Array.isArray(note.reviewComments) && note.reviewComments.length > 0)) return false;
                return true;
            });
        }

        function createNoteRow(note) {
            const commentsCount = Array.isArray(note.reviewComments) ? note.reviewComments.length : 0;
            const taskPath = note.isSubTask
                ? `${note.taskTitle} › ${note.subTaskTitle || '하위 업무'}`
                : note.taskTitle;
            const bodyPreview = String(note.body || '').replace(/\s+/g, ' ').trim();
            const row = document.createElement('button');
            row.type = 'button';
            row.dataset.calendarNoteListItem = '';
            row.dataset.noteId = note.id || '';
            row.className = 'group block w-full px-4 py-4 text-left transition hover:bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-300 active:bg-amber-50 dark:hover:bg-amber-950/10 dark:active:bg-amber-950/20 sm:px-5';
            row.innerHTML = `
                <div class="flex items-start gap-3">
                    <time class="w-14 shrink-0 pt-0.5 text-[11px] font-black tabular-nums text-amber-700 dark:text-amber-400">${escapeHTML(formatSummaryNoteDate(note))}</time>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <p class="truncate text-[11px] font-bold text-slate-500 dark:text-slate-400">${escapeHTML(taskPath)}</p>
                                <h4 class="mt-1 text-sm font-black leading-snug text-slate-900 dark:text-slate-100">${escapeHTML(note.noteTitle)}</h4>
                            </div>
                            <span class="shrink-0 pt-0.5 text-[11px] font-bold text-amber-700 opacity-0 transition group-hover:opacity-100 group-focus:opacity-100 dark:text-amber-400">열기</span>
                        </div>
                        ${bodyPreview ? `<p class="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">${escapeHTML(bodyPreview)}</p>` : '<p class="mt-1.5 text-xs italic text-slate-400">내용 없음</p>'}
                        <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
                            ${note.workTypeDisplayLabel ? `<span class="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">${escapeHTML(note.workTypeDisplayLabel)}</span>` : '<span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">유형 미지정</span>'}
                            <span class="rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${note.reviewClassName}">${escapeHTML(note.reviewLabel)}</span>
                            <span class="text-[10px] font-semibold text-slate-400">${escapeHTML(note.author)}</span>
                            ${note.customerName ? `<span class="text-[10px] font-semibold text-slate-400">고객사 ${escapeHTML(note.customerName)}</span>` : ''}
                            ${note.oppNo ? `<span class="text-[10px] font-semibold text-slate-400">Opp ${escapeHTML(note.oppNo)}</span>` : ''}
                            ${commentsCount ? `<span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">💬 ${commentsCount}</span>` : ''}
                        </div>
                    </div>
                </div>`;
            row.addEventListener('click', () => {
                if (typeof window.openNoteDetailPanel === 'function') window.openNoteDetailPanel(note);
            });
            return row;
        }

        function renderList() {
            const filteredNotes = getFilteredNotes();
            const totalPages = Math.max(1, Math.ceil(filteredNotes.length / pageSize));
            filterState.currentPage = Math.min(Math.max(filterState.currentPage, 1), totalPages);
            const pageStart = (filterState.currentPage - 1) * pageSize;
            const visibleNotes = filteredNotes.slice(pageStart, pageStart + pageSize);
            list.innerHTML = '';
            if (filteredNotes.length === 0) {
                list.innerHTML = `
                    <div class="px-5 py-12 text-center">
                        <p class="text-sm font-bold text-slate-500 dark:text-slate-400">${notes.length ? '선택한 조건에 맞는 메모가 없습니다.' : '선택한 기간에 기록된 메모가 없습니다.'}</p>
                        <p class="mt-1 text-xs text-slate-400">다른 기간이나 메모 유형을 확인해 주세요.</p>
                    </div>`;
            } else {
                visibleNotes.forEach(note => list.appendChild(createNoteRow(note)));
            }
            count.textContent = totalPages > 1
                ? `메모 ${filteredNotes.length}/${notes.length}건 · ${filterState.currentPage}/${totalPages}페이지`
                : `메모 ${filteredNotes.length}/${notes.length}건`;
            pagination.classList.toggle('hidden', totalPages <= 1);
            pagination.classList.toggle('flex', totalPages > 1);
            pageStatus.textContent = `${filterState.currentPage} / ${totalPages} 페이지`;
            prevButton.disabled = filterState.currentPage <= 1;
            nextButton.disabled = filterState.currentPage >= totalPages;
            commentsToggle.setAttribute('aria-pressed', String(filterState.commentsOnly));
            commentsToggle.classList.toggle('border-amber-400', filterState.commentsOnly);
            commentsToggle.classList.toggle('bg-amber-50', filterState.commentsOnly);
            commentsToggle.classList.toggle('text-amber-800', filterState.commentsOnly);
            commentsToggle.classList.toggle('ring-2', filterState.commentsOnly);
            commentsToggle.classList.toggle('ring-amber-100', filterState.commentsOnly);
            commentsToggle.querySelector('[data-calendar-notes-comments-label]').textContent = filterState.commentsOnly ? '댓글 있음 ON' : '댓글 있음';
        }

        workTypeFilter?.addEventListener('change', event => {
            filterState.workType = event.target.value || 'all';
            filterState.currentPage = 1;
            renderList();
        });
        commentsToggle?.addEventListener('click', () => {
            filterState.commentsOnly = !filterState.commentsOnly;
            filterState.currentPage = 1;
            renderList();
        });
        prevButton?.addEventListener('click', () => {
            if (filterState.currentPage <= 1) return;
            filterState.currentPage -= 1;
            renderList();
        });
        nextButton?.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(getFilteredNotes().length / pageSize));
            if (filterState.currentPage >= totalPages) return;
            filterState.currentPage += 1;
            renderList();
        });
        renderList();
    } catch (error) {
        console.error('메모 뷰 렌더링 실패:', error);
        if (renderToken !== _calendarNotesRenderToken) return;
        grid.innerHTML = '<div class="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300">메모를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
    }
}

window.renderCalendarNotesView = renderCalendarNotesView;
