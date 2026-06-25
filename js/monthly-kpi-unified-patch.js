
(function () {
    const originalRenderCalendar = renderCalendar;

    // Parent task는 월과 겹치면 월별 요약에 포함합니다.
    // Sub-task는 fallback 없이 실제 startDate 또는 dueDate가 해당 월에 있는 경우만 포함합니다.
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

        let html = '<div class="mt-2.5 pt-2.5 border-t border-slate-100/80 space-y-1.5">';

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

    function renderMonthlySummary(filteredTasks) {
        const year = currentCalDate.getFullYear();
        const month = currentCalDate.getMonth();
        const grid = document.getElementById('calendar-grid');
        const weekdayHeader = document.getElementById('calendar-weekday-header');
        const todayStr = getTodayStr();
        if (!grid) return;

        document.getElementById('calendar-month-year').textContent = `${year}년 ${month + 1}월`;
        weekdayHeader.classList.add('hidden');
        grid.className = 'flex flex-col gap-4 bg-slate-50 border border-slate-100 p-5 rounded-xl min-h-[250px]';
        grid.innerHTML = '';

        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
        const currentMonthTasks = filteredTasks.filter(t => isTaskOverlappingMonth(t, monthStart, monthEnd, todayStr));

        if (currentMonthTasks.length === 0) {
            grid.innerHTML = `<div class="text-center py-16 text-sm text-slate-400 font-semibold">현재 조건 혹은 조회 기간 중 해당 월(${month + 1}월)의 업무 정보가 존재하지 않습니다.</div>`;
            return;
        }

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
        const monthlySubHidden = currentMonthTasks.reduce((sum, t) => sum + getMonthlySubTaskSummary(t, monthStart, monthEnd).hiddenOutsideMonth, 0);

        const kpiPanel = document.createElement('div');
        kpiPanel.className = 'grid grid-cols-2 md:grid-cols-4 gap-3';
        kpiPanel.innerHTML = `
            <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div class="text-[11px] font-bold text-slate-400 uppercase">월간 업무</div><div class="mt-1 text-2xl font-black text-slate-900">${monthlyTotal}</div><div class="text-[10px] text-slate-400">진행 ${monthlyProgress} · 대기 ${monthlyPending}</div></div>
            <div class="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm"><div class="text-[11px] font-bold text-emerald-600 uppercase">완료율</div><div class="mt-1 text-2xl font-black text-emerald-800">${monthlyCompletionRate}%</div><div class="text-[10px] text-emerald-600">완료 ${monthlyCompleted}/${monthlyTotal}</div></div>
            <div class="rounded-2xl border border-rose-100 bg-rose-50/70 p-4 shadow-sm"><div class="text-[11px] font-bold text-rose-600 uppercase">지연율</div><div class="mt-1 text-2xl font-black text-rose-800">${monthlyDelayRate}%</div><div class="text-[10px] text-rose-600">지연 ${monthlyOverdue}/${monthlyTotal}</div></div>
            <div class="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm"><div class="text-[11px] font-bold text-indigo-600 uppercase">해당 월 하위 업무</div><div class="mt-1 text-2xl font-black text-indigo-800">${monthlySubTotal}</div><div class="text-[10px] text-indigo-600">완료 ${monthlySubCompleted} · 숨김 ${monthlySubHidden}</div></div>
        `;
        grid.appendChild(kpiPanel);

        const categories = [
            { key: 'OVERDUE', label: '🚨 일정 초과 및 지연 상태', style: 'bg-rose-50/75 border-rose-100 text-rose-800', list: groups.OVERDUE },
            { key: 'PROGRESS', label: '⚙️ 현재 적극 진행 중', style: 'bg-blue-50/75 border-blue-100 text-blue-800', list: groups.PROGRESS },
            { key: 'PENDING', label: '⌛ 대기 및 진행 준비 중', style: 'bg-amber-50/75 border-amber-100 text-amber-800', list: groups.PENDING },
            { key: 'COMPLETED', label: '⭐️ 정상 완료 항목', style: 'bg-emerald-50/75 border-emerald-100 text-emerald-800', list: groups.COMPLETED }
        ];

        categories.forEach(cat => {
            if (cat.list.length === 0) return;
            const sec = document.createElement('div');
            sec.className = `rounded-xl border p-4 ${cat.style}`;
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
                const subTasksHtml = buildMonthlySubTaskHTML(t, monthStart, monthEnd);

                const box = document.createElement('div');
                box.className = 'bg-white rounded-xl p-3 border border-slate-200/60 shadow-sm cursor-pointer transition hover:border-indigo-400 hover:shadow-md flex flex-col justify-between h-full';
                box.onclick = () => openTaskModal(t.id);
                box.innerHTML = `
                    <div>
                        <div class="flex items-start justify-between gap-2">
                            <h4 class="text-xs font-bold text-slate-800 line-clamp-1 flex-1">${escapeHTML(t.title)}</h4>
                            ${subBadgeMarkup}
                        </div>
                        <div class="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                            <span class="flex items-center gap-1">🗓️ ${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5)}</span>
                            <span class="font-bold bg-slate-50 text-slate-600 px-1.5 py-0.5 border rounded">${escapeHTML(t.assignee)}</span>
                        </div>
                        <div class="mt-1 flex justify-end">${subProgressMarkup}</div>
                    </div>
                    ${subTasksHtml}`;
                subGrid.appendChild(box);
            });

            sec.appendChild(subGrid);
            grid.appendChild(sec);
        });
    }

    renderCalendar = function (filteredTasks) {
        if (currentCalMode === 'SUMMARY') return renderMonthlySummary(filteredTasks);
        return originalRenderCalendar(filteredTasks);
    };

    console.info('Smart Task Flow monthly KPI unified patch v20260625-unified-patch-v2 loaded');
})();
