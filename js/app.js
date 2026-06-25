// --- (3) Pure Helper Functions ---
        function getStatusKorean(status) { return { 'PENDING': '진행 대기', 'PROGRESS': '진행 중', 'COMPLETED': '완료됨', 'OVERDUE': '기한 초과' }[status] || '전체'; }
        function getPriorityBadge(priority) {
            if (priority === 'HIGH') return '<span class="inline-flex rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/10">높음</span>';
            if (priority === 'NORMAL') return '<span class="inline-flex rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/10">보통</span>';
            return '<span class="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">낮음</span>';
        }
        function getTimelineStatus(dueStr, status) {
            if (status === 'COMPLETED') return { text: '완료됨', class: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
            const diff = Math.ceil((new Date(dueStr.replace(/-/g, '/')) - new Date(getTodayStr().replace(/-/g, '/'))) / 86400000);
            if (diff < 0) return { text: `기한 초과 (D+${Math.abs(diff)})`, class: 'bg-rose-50 text-rose-700 border-rose-100 font-semibold' };
            if (diff === 0) return { text: '오늘 마감', class: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse font-semibold' };
            return { text: `D-${diff}`, class: 'bg-slate-100 text-slate-700 border-slate-200' };
        }
        function getAvatarStyle(name) {
            if (!name) return AVATAR_COLORS[0]; let sum = 0; for(let i=0; i<name.length; i++) sum += name.charCodeAt(i); return AVATAR_COLORS[sum % AVATAR_COLORS.length];
        }

        // --- (추가됨) 필터링 함수 ---
        function getFilteredTasks() {
            const search = document.getElementById('filter-search')?.value.toLowerCase() || '';
            const status = document.getElementById('filter-status')?.value || 'ALL';
            const priority = document.getElementById('filter-priority')?.value || 'ALL';
            const assignee = document.getElementById('filter-assignee')?.value || 'ALL';
            const startDate = document.getElementById('filter-start-date')?.value || '';
            const endDate = document.getElementById('filter-end-date')?.value || '';

            const today = getTodayStr();

            return tasks.filter(t => {
                if (t.trackerId !== currentTrackerId) return false;
                if (search && !t.title.toLowerCase().includes(search) && !(t.assignee && t.assignee.toLowerCase().includes(search))) return false;
                
                if (status === 'OVERDUE') {
                    if (t.status === 'COMPLETED' || (t.dueDate || today) >= today) return false;
                } else if (status !== 'ALL' && t.status !== status) {
                    return false;
                }
                
                if (priority !== 'ALL' && t.priority !== priority) return false;
                if (assignee !== 'ALL' && t.assignee !== assignee) return false;
                
                if (startDate && (t.dueDate || today) < startDate) return false; 
                if (endDate && (t.startDate || today) > endDate) return false;
                
                return true;
            });
        }

        // --- (추가됨) 간트 차트 툴팁 바인딩 함수 ---
        function bindGanttTooltip(element, title, details) {
            const tooltip = document.getElementById('gantt-tooltip');
            element.addEventListener('mouseenter', (e) => {
                const safeTitle = escapeHTML(title || '');
                const safeDetails = String(details || '').replace(/<(?!br\s*\/?)[^>]+>/gi, '');
                tooltip.innerHTML = `<div class="font-bold mb-1">${safeTitle}</div><div class="text-[10.5px] leading-relaxed text-slate-300">${safeDetails}</div>`;
                tooltip.classList.remove('hidden');
            });
            element.addEventListener('mousemove', (e) => {
                tooltip.style.left = e.clientX + 15 + 'px';
                tooltip.style.top = e.clientY + 15 + 'px';
            });
            element.addEventListener('mouseleave', () => {
                tooltip.classList.add('hidden');
            });
        }

        // --- (추가됨) 순서 이동 함수 ---
        function moveTaskOrder(id, direction) {
            const scopeTasks = tasks.filter(t => t.trackerId === currentTrackerId);
            // 정렬 전 order 값이 없는 항목에 대한 안전 처리
            scopeTasks.forEach((t, i) => { if (typeof t.order !== 'number') t.order = i + 1; });
            scopeTasks.sort((a, b) => a.order - b.order);
            
            const idx = scopeTasks.findIndex(t => t.id === id);
            if (idx === -1) return;

            let targetIdx = -1;
            if (direction === 'up' && idx > 0) targetIdx = idx - 1;
            else if (direction === 'down' && idx < scopeTasks.length - 1) targetIdx = idx + 1;

            if (targetIdx !== -1) {
                const currentTask = scopeTasks[idx];
                const targetTask = scopeTasks[targetIdx];

                // order 값 서로 스왑
                const tempOrder = currentTask.order;
                currentTask.order = targetTask.order;
                targetTask.order = tempOrder;

                // UI 1차 즉시 반영
                updateUI();

                // Firestore 실시간 데이터베이스 동기화
                db_updateTask(currentTask.id, { order: currentTask.order });
                db_updateTask(targetTask.id, { order: targetTask.order });
            }
        }

        // --- (4) Toast & UI Utilities ---
        function showToast(msg, isSuccess = true) {
            const t = document.getElementById('toast'); document.getElementById('toast-text').textContent = msg;
            document.getElementById('toast-icon').innerHTML = isSuccess ? `<svg class="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>` : `<svg class="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>`;
            t.classList.remove('translate-y-10', 'opacity-0'); t.classList.add('translate-y-0', 'opacity-100');
            setTimeout(() => { t.classList.remove('translate-y-0', 'opacity-100'); t.classList.add('translate-y-10', 'opacity-0'); }, 4000);
        }

        
        function getServerTimestamp() {
            return (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                ? firebase.firestore.FieldValue.serverTimestamp()
                : new Date().toISOString();
        }

        function canWriteToFirestore() {
            if (!isFirebaseAvailable || !db) return false;
            if (auth && !isAuthReady) {
                showToast('Firebase 인증 준비 중입니다. 잠시 후 다시 시도해 주세요.', false);
                console.warn('Firestore write skipped because auth is not ready.');
                return false;
            }
            return true;
        }

        function markSaving() { lastSaveState = 'saving'; }
        function markSaved() { lastSaveState = 'saved'; }
        function markSaveError() { lastSaveState = 'error'; }

        // --- (5) Database CRUD Operations ---
        async function db_addTask(taskData) {
            const coll = getTasksCollection();
            const newId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            const now = getServerTimestamp();
            const currentTracker = trackers.find(t => t.id === currentTrackerId);
            const payload = {
                ...taskData,
                trackerId: taskData.trackerId || currentTrackerId,
                trackerName: currentTracker ? currentTracker.name : '',
                deleted: false,
                createdAt: now,
                updatedAt: now
            };
            markSaving();
            if (canWriteToFirestore() && coll) {
                try {
                    await coll.doc(newId).set(payload, { merge: true });
                    markSaved();
                } catch (e) {
                    markSaveError();
                    console.warn("Firestore 업무 쓰기 오류 발생, 로컬 저장 연동", e);
                    showToast('Firebase 저장 실패: Console과 Firestore Rules를 확인해 주세요.', false);
                }
            }
            if (!tasks.some(t => t.id === newId)) tasks.push({ id: newId, ...payload });
            updateUI();
        }

        
        async function db_updateTask(id, taskData) {
            const coll = getTasksCollection();
            const currentTracker = trackers.find(t => t.id === (taskData.trackerId || currentTrackerId));
            const payload = {
                ...taskData,
                trackerName: currentTracker ? currentTracker.name : taskData.trackerName,
                updatedAt: getServerTimestamp()
            };
            markSaving();
            if (canWriteToFirestore() && coll) {
                try {
                    await coll.doc(id).set(payload, { merge: true });
                    markSaved();
                } catch (e) {
                    markSaveError();
                    console.warn("Firestore 업무 수정 오류 발생, 로컬 저장 연동", e);
                    showToast('Firebase 수정 실패: Console과 Firestore Rules를 확인해 주세요.', false);
                }
            }
            const idx = tasks.findIndex(t => t.id === id);
            if (idx !== -1) {
                tasks[idx] = { ...tasks[idx], ...payload };
                updateUI();
            }
        }

        
        async function db_deleteTask(id) {
            const coll = getTasksCollection();
            const payload = { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() };
            markSaving();
            if (canWriteToFirestore() && coll) {
                try {
                    await coll.doc(id).set(payload, { merge: true });
                    markSaved();
                } catch (e) {
                    markSaveError();
                    console.warn("Firestore 소프트 삭제 오류 발생, 로컬 제거 연동", e);
                    showToast('Firebase 삭제 반영 실패: Console과 Firestore Rules를 확인해 주세요.', false);
                }
            }
            tasks = tasks.filter(t => t.id !== id);
            selectedTaskIds.delete(id);
            updateUI();
        }

        
        async function db_batchDelete(idsSet) {
            const coll = getTasksCollection();
            markSaving();
            if (canWriteToFirestore() && coll) {
                try {
                    const batch = db.batch();
                    idsSet.forEach(id => {
                        batch.set(coll.doc(id), { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true });
                    });
                    await batch.commit();
                    markSaved();
                } catch (e) {
                    markSaveError();
                    console.warn("Firestore 일괄 소프트 삭제 실패, 로컬 반영 대체", e);
                    showToast('Firebase 일괄 삭제 반영 실패: Console과 Firestore Rules를 확인해 주세요.', false);
                }
            }
            tasks = tasks.filter(t => !idsSet.has(t.id));
            idsSet.clear();
            updateUI();
        }

        
        async function db_addTracker(trackerData) {
            const coll = getTrackersCollection();
            const newId = 'tracker_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            const now = getServerTimestamp();
            const payload = { ...trackerData, deleted: false, createdAt: now, updatedAt: now };
            markSaving();
            if (canWriteToFirestore() && coll) {
                try {
                    await coll.doc(newId).set(payload, { merge: true });
                    markSaved();
                } catch(e) {
                    markSaveError();
                    console.warn("Firestore 트래커 추가 실패, 로컬 처리 진행", e);
                    showToast('Firebase 트래커 저장 실패: Console과 Firestore Rules를 확인해 주세요.', false);
                }
            }
            if (!trackers.some(t => t.id === newId)) trackers.push({ id: newId, ...payload });
            currentTrackerId = newId;
            localStorage.setItem('flow_current_tracker', currentTrackerId);
            updateTrackerUI();
            updateUI();
        }

        
        async function db_updateTracker(id, trackerData) {
            const coll = getTrackersCollection();
            const payload = { ...trackerData, updatedAt: getServerTimestamp() };
            markSaving();
            if (canWriteToFirestore() && coll) {
                try {
                    await coll.doc(id).set(payload, { merge: true });
                    // tracker명 변경 시 관련 task snapshot 명칭도 같이 보정합니다.
                    const tColl = getTasksCollection();
                    if (tColl && trackerData.name) {
                        const snapshot = await tColl.where('trackerId', '==', id).get();
                        const batch = db.batch();
                        snapshot.docs.forEach(doc => batch.set(doc.ref, { trackerName: trackerData.name, updatedAt: getServerTimestamp() }, { merge: true }));
                        if (!snapshot.empty) await batch.commit();
                    }
                    markSaved();
                } catch(e) {
                    markSaveError();
                    console.warn("Firestore 트래커 수정 실패, 로컬 처리 진행", e);
                    showToast('Firebase 트래커 수정 실패: Console과 Firestore Rules를 확인해 주세요.', false);
                }
            }
            const idx = trackers.findIndex(t => t.id === id);
            if (idx !== -1) trackers[idx] = { ...trackers[idx], ...payload };
            else trackers.push({ id, ...payload });
            updateTrackerUI();
            updateUI();
        }

        
        async function db_deleteTracker(id) {
            const coll = getTrackersCollection();
            const tColl = getTasksCollection();
            markSaving();
            if (canWriteToFirestore() && coll) {
                try {
                    await coll.doc(id).set({ deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true });
                    if (tColl) {
                        const snapshot = await tColl.where("trackerId", "==", id).get();
                        const batch = db.batch();
                        snapshot.docs.forEach(doc => batch.set(doc.ref, { deleted: true, deletedAt: getServerTimestamp(), updatedAt: getServerTimestamp() }, { merge: true }));
                        if (!snapshot.empty) await batch.commit();
                    }
                    markSaved();
                } catch(e) {
                    markSaveError();
                    console.warn("트래커 소프트 삭제 실패", e);
                    showToast('Firebase 트래커 삭제 반영 실패: Console과 Firestore Rules를 확인해 주세요.', false);
                }
            }
            tasks = tasks.filter(t => t.trackerId !== id);
            trackers = trackers.filter(t => t.id !== id);
            if(trackers.length === 0) {
                trackers.push({ id: "tracker-default", name: "기본 업무 트래커", desc: "기본 설정된 초기 공간입니다." });
            }
            currentTrackerId = trackers[0].id;
            localStorage.setItem('flow_current_tracker', currentTrackerId);
            updateTrackerUI();
            updateUI();
        }


        // --- (6) Core UI Rendering Functions ---
        function buildAssigneeDropdownFilter() {
            const select = document.getElementById('filter-assignee');
            if(!select) return;
            const currentVal = select.value;
            const scopeTasks = tasks.filter(t => t.trackerId === currentTrackerId);
            const assignees = [...new Set(scopeTasks.map(t => t.assignee).filter(Boolean))];
            
            select.innerHTML = '<option value="ALL">담당자: 전체</option>';
            assignees.forEach(n => {
                const opt = document.createElement('option'); opt.value = n; opt.textContent = n;
                select.appendChild(opt);
            });
            if (assignees.includes(currentVal)) select.value = currentVal;
        }
        function updateTrackerUI() {
            const listContainer = document.getElementById('tracker-list-items');
            if(!listContainer) return;
            listContainer.innerHTML = '';
            
            const currentObj = trackers.find(t => t.id === currentTrackerId) || trackers[0];
            if (currentObj) {
                currentTrackerId = currentObj.id;
                document.getElementById('current-tracker-name').textContent = currentObj.name;
                document.getElementById('current-tracker-desc').textContent = currentObj.desc || '실시간 업무 기한 관리 및 진척도 모니터링 시스템';
            }

            trackers.forEach(t => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `w-full text-left flex flex-col rounded-xl px-3 py-2 text-xs transition ${t.id === currentTrackerId ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700 font-medium'}`;
                btn.innerHTML = `
                    <span class="text-sm font-bold truncate">${escapeHTML(t.name)}</span>
                    <span class="text-[10px] text-slate-400 font-medium truncate mt-0.5">${escapeHTML(t.desc || '상세 설명 없음')}</span>
                `;
                btn.addEventListener('click', () => {
                    currentTrackerId = t.id;
                    localStorage.setItem('flow_current_tracker', currentTrackerId);
                    document.getElementById('tracker-dropdown-menu').classList.add('hidden');
                    updateTrackerUI();
                    updateUI();
                    showToast(`트래커 전환: ${t.name}`);
                });
                listContainer.appendChild(btn);
            });
        }
        function renderStats() {
            const scopeTasks = tasks.filter(t => t.trackerId === currentTrackerId);

            const total = scopeTasks.length;
            const pending = scopeTasks.filter(t => t.status === 'PENDING').length;
            const progress = scopeTasks.filter(t => t.status === 'PROGRESS').length;
            const completed = scopeTasks.filter(t => t.status === 'COMPLETED').length;
            
            const today = getTodayStr();
            const overdue = scopeTasks.filter(t => t.status !== 'COMPLETED' && (t.dueDate||'') < today).length;

            document.getElementById('stat-total').textContent = total;
            document.getElementById('stat-pending').textContent = pending;
            document.getElementById('stat-progress').textContent = progress;
            document.getElementById('stat-completed').textContent = completed;
            document.getElementById('stat-overdue').textContent = overdue;
            document.getElementById('stat-pending-pct').textContent = total > 0 ? `${Math.round((pending/total)*100)}%` : '0%';
            document.getElementById('stat-progress-pct').textContent = total > 0 ? `${Math.round((progress/total)*100)}%` : '0%';
            document.getElementById('stat-completed-pct').textContent = total > 0 ? `${Math.round((completed/total)*100)}%` : '0%';
            
            const overdueLbl = document.getElementById('stat-overdue-lbl');
            overdueLbl.textContent = overdue > 0 ? '조속히 조치 필요' : '매우 양호';
            overdueLbl.className = `text-xs font-medium ${overdue > 0 ? 'text-rose-500 font-semibold' : 'text-emerald-500'}`;
        }
        function renderTable(filtered) {
            const tbody = document.getElementById('task-table-body');
            const emptyState = document.getElementById('empty-state-table');
            if(!tbody) return;

            tbody.innerHTML = '';
            if (filtered.length === 0) {
                emptyState.classList.replace('hidden', 'flex');
                updateSelectAllState(0, 0);
                return;
            } else {
                emptyState.classList.replace('flex', 'hidden');
            }

            filtered.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.dueDate||'').localeCompare(b.dueDate||''));

            let renderedSelectedCount = 0;
            filtered.forEach((t, idx) => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 transition-colors group';
                const isChecked = selectedTaskIds.has(t.id);
                if (isChecked) renderedSelectedCount++;

                const escTitle = escapeHTML(t.title);
                const escAssignee = escapeHTML(t.assignee);
                const timeline = getTimelineStatus(t.dueDate || getTodayStr(), t.status);

                const subTasksList = t.subTasks || [];
                const hasSubTasks = subTasksList.length > 0;
                const isExpanded = expandedTaskIds.has(t.id);
                const completedSubCount = subTasksList.filter(s => s.status === 'COMPLETED').length;

                const toggleAccordionBtn = hasSubTasks ? 
                    `<button class="btn-toggle-subtasks mr-2 text-slate-400 hover:text-indigo-600 transition font-mono text-[11px] outline-none" data-id="${t.id}">${isExpanded ? '▼' : '▶'}</button>` : '';

                const subBadge = hasSubTasks ? 
                    `<span class="ml-2 inline-flex items-center text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">하위 업무 ${completedSubCount}/${subTasksList.length}</span>` : '';

                tr.innerHTML = `
                    <td class="px-2 py-4 text-center">
                        <div class="flex flex-col items-center justify-center gap-0.5">
                            <button class="btn-order-up text-[10px] text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-0.5 rounded transition" data-id="${t.id}" title="위로 이동">▲</button>
                            <button class="btn-order-down text-[10px] text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-0.5 rounded transition" data-id="${t.id}" title="아래로 이동">▼</button>
                        </div>
                    </td>
                    <td class="px-3 py-4 text-center">
                        <input type="checkbox" class="cb-task rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" data-id="${t.id}" ${isChecked ? 'checked' : ''}>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex flex-col gap-1">
                            <span class="font-semibold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition flex items-center" title="${escTitle}">
                                ${toggleAccordionBtn}
                                <span>${escTitle}</span>
                                ${subBadge}
                            </span>
                            <span class="text-xs text-slate-400 line-clamp-1">${escapeHTML(t.notes || '추가 지침 없음')}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap"><div class="flex items-center gap-2.5"><span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${getAvatarStyle(escAssignee)}">${escAssignee.charAt(0) || 'U'}</span><span class="font-medium text-slate-700">${escAssignee || '미지정'}</span></div></td>
                    <td class="px-6 py-4 whitespace-nowrap"><div class="flex flex-col"><span class="text-xs text-slate-500 font-medium">${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${(t.dueDate || '').substring(5)}</span><span class="mt-1 inline-self-start text-[11px] font-medium border rounded-md px-1.5 py-0.5 text-center ${timeline.class}">${timeline.text}</span></div></td>
                    <td class="px-4 py-4 text-center whitespace-nowrap">${getPriorityBadge(t.priority)}</td>
                    <td class="px-6 py-4 text-center">
                        <select class="sel-status mx-auto block rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 outline-none transition focus:border-indigo-500 focus:bg-indigo-50" data-id="${t.id}">
                            <option value="PENDING" ${t.status === 'PENDING' ? 'selected' : ''}>진행 대기 ⌛</option>
                            <option value="PROGRESS" ${t.status === 'PROGRESS' ? 'selected' : ''}>진행 중 ⚙️</option>
                            <option value="COMPLETED" ${t.status === 'COMPLETED' ? 'selected' : ''}>완료됨 ⭐️</option>
                        </select>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-center"><div class="flex items-center justify-center gap-2">
                        <button class="btn-edit rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition" data-id="${t.id}" title="상세 편집"><svg class="h-5 w-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                        <button class="btn-delete rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition" data-id="${t.id}" title="삭제"><svg class="h-5 w-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div></td>
                `;
                tbody.appendChild(tr);

                if (hasSubTasks && isExpanded) {
                    subTasksList.forEach(st => {
                        const subTr = document.createElement('tr');
                        subTr.className = 'bg-slate-50/70 border-l-2 border-l-indigo-500/40 hover:bg-indigo-50/30 transition-colors text-xs';
                        
                        const subAssignee = st.assignee || t.assignee || '미지정';
                        
                        subTr.innerHTML = `
                            <td></td>
                            <td></td>
                            <td class="px-6 py-2.5 pl-12">
                                <div class="flex items-center gap-2">
                                    <span class="text-slate-300 font-mono">└─</span>
                                    <span class="font-medium ${st.status === 'COMPLETED' ? 'line-through text-slate-400 font-normal' : 'text-slate-700'}">${escapeHTML(st.title)}</span>
                                    <span class="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[9.5px] font-bold">👤 ${escapeHTML(subAssignee)}</span>
                                </div>
                            </td>
                            <td class="px-6 py-2.5 text-slate-400 text-xs">-</td>
                            <td class="px-6 py-2.5 text-slate-500 font-medium text-xs">
                                📅 ${st.startDate ? st.startDate.substring(5) : '미정'} ~ ${st.dueDate ? st.dueDate.substring(5) : '미정'}
                            </td>
                            <td class="px-4 py-2.5 text-center text-slate-400">-</td>
                            <td class="px-6 py-2.5 text-center">
                                <label class="inline-flex items-center gap-1.5 cursor-pointer select-none">
                                    <input type="checkbox" class="cb-subtask-status rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" data-task-id="${t.id}" data-subtask-id="${st.id}" ${st.status === 'COMPLETED' ? 'checked' : ''}>
                                    <span class="font-bold text-[11px] ${st.status === 'COMPLETED' ? 'text-emerald-600' : 'text-amber-500'}">${st.status === 'COMPLETED' ? '완료됨' : '진행 대기'}</span>
                                </label>
                            </td>
                            <td></td>
                        `;
                        tbody.appendChild(subTr);
                    });
                }
            });
            updateSelectAllState(filtered.length, renderedSelectedCount);
        }
        function renderCalendar(filteredTasks) {
            const year = currentCalDate.getFullYear();
            const month = currentCalDate.getMonth();
            const grid = document.getElementById('calendar-grid');
            const weekdayHeader = document.getElementById('calendar-weekday-header');
            const todayStr = getTodayStr();

            if(!grid) return;

            if (currentCalMode === 'MONTH') {
                document.getElementById('calendar-month-year').textContent = `${year}년 전체 Gantt 타임라인`;
            } else {
                document.getElementById('calendar-month-year').textContent = `${year}년 ${month + 1}월`;
            }

            // 1. 태스크 그룹 묶음 레이아웃 엔진 가동 (상위 + 연동 하위 세트 구성)
            const taskGroups = filteredTasks.map(t => {
                const startDStr = t.startDate || t.dueDate || todayStr;
                const endDStr = t.dueDate || todayStr;
                
                const group = {
                    id: t.id,
                    title: t.title,
                    startDate: startDStr > endDStr ? endDStr : startDStr,
                    dueDate: endDStr,
                    status: t.status,
                    priority: t.priority,
                    assignee: t.assignee || '미지정',
                    notes: t.notes || '',
                    order: t.order ?? 999,
                    isSub: false,
                    subTasks: (t.subTasks || []).map(st => {
                        const stStart = st.startDate || st.dueDate || endDStr;
                        const stDue = st.dueDate || endDStr;
                        return {
                            id: st.id,
                            title: st.title,
                            startDate: stStart > stDue ? stDue : stStart,
                            dueDate: stDue,
                            status: st.status,
                            assignee: st.assignee || t.assignee || '미지정',
                            isSub: true,
                            parentId: t.id
                        };
                    })
                };

                let rangeStart = group.startDate;
                let rangeEnd = group.dueDate;
                group.subTasks.forEach(st => {
                    if (st.startDate < rangeStart) rangeStart = st.startDate;
                    if (st.dueDate > rangeEnd) rangeEnd = st.dueDate;
                });
                group.rangeStart = rangeStart;
                group.rangeEnd = rangeEnd;

                return group;
            });

            taskGroups.sort((a, b) => a.order - b.order || a.rangeStart.localeCompare(b.rangeStart));

            const globalLines = []; 
            const assignGroupLine = (g) => {
                // 토글 스위치 상태에 따라 캘린더 차지 라인 수 결정
                const totalLinesRequired = isCalSubTaskVisible ? 1 + g.subTasks.length : 1; 
                let targetStartLine = 0;

                while (true) {
                    let hasOverlap = false;
                    for (let l = 0; l < totalLinesRequired; l++) {
                        const lineIndex = targetStartLine + l;
                        if (!globalLines[lineIndex]) globalLines[lineIndex] = [];

                        for (let occupied of globalLines[lineIndex]) {
                            if (g.rangeStart <= occupied.end && occupied.start <= g.rangeEnd) {
                                hasOverlap = true;
                                break;
                            }
                        }
                        if (hasOverlap) break;
                    }

                    if (!hasOverlap) {
                        for (let l = 0; l < totalLinesRequired; l++) {
                            const lineIndex = targetStartLine + l;
                            globalLines[lineIndex].push({ start: g.rangeStart, end: g.rangeEnd, id: g.id });
                        }
                        g.globalLineStart = targetStartLine;
                        break;
                    }
                    targetStartLine++; 
                }
            };

            taskGroups.forEach(assignGroupLine);

            if (currentCalMode === 'DAY') {
                weekdayHeader.classList.remove('hidden');
                grid.className = 'grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-b-lg overflow-hidden relative z-10';
                grid.innerHTML = '';

                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                for (let i = 0; i < firstDay; i++) {
                    const cell = document.createElement('div');
                    cell.className = 'bg-slate-50 min-h-[130px] border-r border-b border-slate-100';
                    grid.appendChild(cell);
                }

                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                    const isToday = dateStr === todayStr;
                    const cellIndex = firstDay + day - 1;
                    const dayOfWeek = cellIndex % 7;
                    const isWeekStart = dayOfWeek === 0;

                    const cell = document.createElement('div');
                    cell.className = `bg-white min-h-[130px] flex flex-col transition-colors border-r border-b border-slate-100 ${isToday ? 'bg-indigo-50/20' : 'hover:bg-slate-50'}`;

                    const dayHeader = document.createElement('div');
                    dayHeader.className = `p-1.5`;
                    if (isToday) {
                        dayHeader.innerHTML = `<div class="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm">${day}</div>`;
                    } else {
                        const textColor = dayOfWeek === 0 ? 'text-rose-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-slate-600';
                        dayHeader.innerHTML = `<div class="w-6 h-6 flex items-center justify-center text-xs font-semibold ${textColor}">${day}</div>`;
                    }
                    cell.appendChild(dayHeader);

                    const taskContainer = document.createElement('div');
                    taskContainer.className = "flex flex-col flex-1 pb-1";

                    const itemsInDay = [];
                    taskGroups.forEach(g => {
                        if (dateStr >= g.startDate && dateStr <= g.dueDate) {
                            itemsInDay.push({
                                id: g.id,
                                title: g.title,
                                isSub: false,
                                status: g.status,
                                lane: g.globalLineStart,
                                start: g.startDate,
                                end: g.dueDate,
                                parentId: g.id,
                                assignee: g.assignee,
                                notes: g.notes
                            });
                        }
                        // 하위 업무 토글 상태에 따라 추가
                        if (isCalSubTaskVisible) {
                            g.subTasks.forEach((st, idx) => {
                                if (dateStr >= st.startDate && dateStr <= st.dueDate) {
                                    itemsInDay.push({
                                        id: st.id,
                                        title: st.title,
                                        isSub: true,
                                        status: st.status,
                                        lane: g.globalLineStart + 1 + idx,
                                        start: st.startDate,
                                        end: st.dueDate,
                                        parentId: g.id,
                                        parentTitle: g.title,
                                        assignee: st.assignee
                                    });
                                }
                            });
                        }
                    });

                    const maxLaneInDay = Math.max(...itemsInDay.map(x => x.lane), -1);

                    for (let l = 0; l <= maxLaneInDay; l++) {
                        const item = itemsInDay.find(x => x.lane === l);
                        if (item) {
                            const isStart = dateStr === item.start;
                            const isEnd = dateStr === item.end;
                            const showText = isStart || isWeekStart;

                            let bgClass = '';
                            let label = '';
                            let icon = '';

                            if (item.isSub) {
                                bgClass = item.status === 'COMPLETED' 
                                    ? 'bg-emerald-50/70 text-emerald-800 border border-dashed border-emerald-300' 
                                    : 'bg-slate-50 text-slate-700 border border-dashed border-slate-300';
                                icon = item.status === 'COMPLETED' ? '✅' : '⬜';
                            } else {
                                if (item.status === 'COMPLETED') {
                                    bgClass = 'bg-emerald-100 text-emerald-800'; icon = '⭐️';
                                } else if (item.status === 'PROGRESS') {
                                    bgClass = 'bg-blue-100 text-blue-800'; icon = '⚙️';
                                } else {
                                    bgClass = 'bg-slate-200 text-slate-700'; icon = '⌛';
                                }
                                if (todayStr > item.end && item.status !== 'COMPLETED') {
                                    bgClass = 'bg-rose-100 text-rose-800'; icon = '🚨';
                                }
                            }

                            let shapeClass = 'h-[22px] flex items-center mb-1 shadow-sm';
                            if (isStart && isEnd) shapeClass += ' rounded mx-1 px-1.5';
                            else if (isStart) shapeClass += ' rounded-l ml-1 mr-0 pr-0 pl-1.5';
                            else if (isEnd) shapeClass += ' rounded-r mr-1 ml-0 pl-0 pr-1.5';
                            else shapeClass += ' mx-0 px-0 rounded-none';

                            if (!isStart && !isWeekStart) shapeClass += ' -ml-[1px] relative z-10';

                            const taskEl = document.createElement('div');
                            taskEl.className = `text-[10px] font-semibold cursor-pointer transition-all hover:scale-[1.02] ${bgClass} ${shapeClass}`;
                            taskEl.onclick = () => openTaskModal(item.parentId);

                            const detailText = item.isSub 
                                ? `[하위업무] 상위: ${escapeHTML(item.parentTitle)}<br>담당자: ${escapeHTML(item.assignee)}<br>기간: ${item.start} ~ ${item.end}<br>상태: ${item.status === 'COMPLETED' ? '완료' : '진행 대기'}`
                                : `[본업무] 담당자: ${escapeHTML(item.assignee)}<br>기간: ${item.start} ~ ${item.end}<br>메모: ${escapeHTML(item.notes || '없음')}`;
                            bindGanttTooltip(taskEl, item.title, detailText);

                            if (showText) {
                                const txtDiv = document.createElement('div');
                                txtDiv.className = 'truncate w-full whitespace-nowrap z-20';
                                if (item.isSub) {
                                    txtDiv.innerHTML = `<span>${icon}</span> <span class="text-[9.5px] text-slate-400 font-normal">↳ 👤 ${escapeHTML(item.assignee)} |</span> ${escapeHTML(item.title)}`;
                                } else {
                                    txtDiv.innerHTML = `<span>${icon}</span> ${escapeHTML(item.title)}`;
                                }
                                taskEl.appendChild(txtDiv);
                            }
                            taskContainer.appendChild(taskEl);
                        } else {
                            const spacer = document.createElement('div');
                            spacer.className = 'h-[22px] mb-1';
                            taskContainer.appendChild(spacer);
                        }
                    }
                    cell.appendChild(taskContainer);
                    grid.appendChild(cell);
                }

                const totalCells = firstDay + daysInMonth;
                const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
                for (let i = 0; i < remaining; i++) {
                    const cell = document.createElement('div');
                    cell.className = 'bg-slate-50 min-h-[130px] border-r border-b border-slate-100';
                    grid.appendChild(cell);
                }

            } else if (currentCalMode === 'MONTH') {
                weekdayHeader.classList.add('hidden');
                grid.className = 'relative bg-white border border-slate-200 rounded-xl overflow-hidden';
                grid.innerHTML = '';

                // 고정 월 헤더 바 생성
                const bgHeader = document.createElement('div');
                bgHeader.className = 'grid grid-cols-12 gap-px bg-slate-50 relative z-20 border-b border-slate-200/80 shadow-sm';
                for (let m = 1; m <= 12; m++) {
                    const hCell = document.createElement('div');
                    hCell.className = 'py-3 text-center text-xs font-bold text-slate-700';
                    hCell.textContent = `${m}월`;
                    bgHeader.appendChild(hCell);
                }
                grid.appendChild(bgHeader);

                // 바디 콘텐츠 세션 컨테이너 구축 (z-index 10)
                const bodyContainer = document.createElement('div');
                bodyContainer.className = 'relative z-10 w-full';

                const bgTileGrid = document.createElement('div');
                bgTileGrid.className = 'grid grid-cols-12 gap-px bg-slate-100/50';
                
                const totalLineCount = globalLines.length > 5 ? globalLines.length : 5;
                const lineRowHeight = 28; 
                const overlayTotalHeight = (totalLineCount * lineRowHeight) + 20;

                for (let m = 0; m < 12; m++) {
                    const tile = document.createElement('div');
                    tile.className = 'bg-white border-b border-slate-100';
                    tile.style.height = `${overlayTotalHeight}px`;
                    bgTileGrid.appendChild(tile);
                }
                bodyContainer.appendChild(bgTileGrid);

                // 끊김 없는 Gantt 타임라인 오버레이 캔버스 구축
                const overlayContainer = document.createElement('div');
                overlayContainer.className = 'absolute inset-0 pointer-events-none';
                
                taskGroups.forEach(g => {
                    const gRangeStartStr = g.rangeStart || todayStr;
                    const gRangeEndStr = g.rangeEnd || todayStr;
                    const startD = new Date(gRangeStartStr.replace(/-/g, '/'));
                    const endD = new Date(gRangeEndStr.replace(/-/g, '/'));
                    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return;

                    const sY = startD.getFullYear();
                    const sM = startD.getMonth(); 
                    const eY = endD.getFullYear();
                    const eM = endD.getMonth(); 

                    if (sY > year || eY < year) return;

                    // 1) 상위 업무 드로잉
                    const taskStartStr = g.startDate || todayStr;
                    const taskEndStr = g.dueDate || todayStr;
                    const taskStartD = new Date(taskStartStr.replace(/-/g, '/'));
                    const taskEndD = new Date(taskEndStr.replace(/-/g, '/'));
                    const tStartM = taskStartD.getFullYear() < year ? 0 : taskStartD.getMonth();
                    const tEndM = taskEndD.getFullYear() > year ? 11 : taskEndD.getMonth();

                    const leftPct = (tStartM / 12) * 100;
                    const widthPct = ((tEndM - tStartM + 1) / 12) * 100;
                    const topPx = g.globalLineStart * lineRowHeight + 10;

                    let bgStyleClass = 'bg-slate-200 text-slate-700';
                    let icon = '⌛';
                    if (g.status === 'COMPLETED') {
                        bgStyleClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200'; icon = '⭐️';
                    } else if (g.status === 'PROGRESS') {
                        bgStyleClass = 'bg-blue-100 text-blue-800 border border-blue-200'; icon = '⚙️';
                    }
                    if (todayStr > g.dueDate && g.status !== 'COMPLETED') {
                        bgStyleClass = 'bg-rose-100 text-rose-800 border border-rose-200'; icon = '🚨';
                    }

                    const mainBar = document.createElement('div');
                    mainBar.className = `absolute h-5 rounded-lg shadow-sm text-[10.5px] font-bold flex items-center px-2 cursor-pointer transition-all hover:scale-[1.01] pointer-events-auto truncate z-10 ${bgStyleClass}`;
                    mainBar.style.left = `calc(${leftPct}% + 4px)`;
                    mainBar.style.width = `calc(${widthPct}% - 8px)`;
                    mainBar.style.top = `${topPx}px`;
                    mainBar.onclick = () => openTaskModal(g.id);
                    mainBar.innerHTML = `<span>${icon}</span> <span class="ml-1 truncate">${escapeHTML(g.title)}</span>`;
                    
                    const details = `담당자: ${escapeHTML(g.assignee)}<br>기간: ${g.startDate} ~ ${g.dueDate}<br>우선순위: ${g.priority === 'HIGH' ? '높음' : '보통'}<br>설명: ${escapeHTML(g.notes || '없음')}`;
                    bindGanttTooltip(mainBar, g.title, details);
                    
                    overlayContainer.appendChild(mainBar);

                    // 2) 소속 하위 업무 드로잉
                    if (isCalSubTaskVisible) {
                        g.subTasks.forEach((st, idx) => {
                            const stStartStr = st.startDate || todayStr;
                            const stEndStr = st.dueDate || todayStr;
                            const stStartD = new Date(stStartStr.replace(/-/g, '/'));
                            const stEndD = new Date(stEndStr.replace(/-/g, '/'));
                            const stStartM = stStartD.getFullYear() < year ? 0 : stStartD.getMonth();
                            const stEndM = stEndD.getFullYear() > year ? 11 : stEndD.getMonth();

                            const subLeftPct = (stStartM / 12) * 100;
                            const subWidthPct = ((stEndM - stStartM + 1) / 12) * 100;
                            const subTopPx = (g.globalLineStart + 1 + idx) * lineRowHeight + 10;

                            const subBar = document.createElement('div');
                            
                            const subBgClass = st.status === 'COMPLETED'
                                ? 'bg-emerald-50/80 text-emerald-800 border border-dashed border-emerald-300'
                                : 'bg-slate-50 text-slate-700 border border-dashed border-slate-300';
                            const subIcon = st.status === 'COMPLETED' ? '✅' : '⬜';

                            subBar.className = `absolute h-5 rounded-lg shadow-sm text-[9.5px] font-bold flex items-center px-1.5 cursor-pointer transition-all hover:scale-[1.01] pointer-events-auto truncate ${subBgClass}`;
                            subBar.style.left = `calc(${subLeftPct}% + 4px)`;
                            subBar.style.width = `calc(${subWidthPct}% - 8px)`;
                            subBar.style.top = `${subTopPx}px`;
                            subBar.onclick = () => openTaskModal(g.id);
                            subBar.innerHTML = `<span>${subIcon}</span> <span class="text-slate-400 font-normal">↳ 👤 ${escapeHTML(st.assignee)} |</span> <span class="ml-0.5 truncate">${escapeHTML(st.title)}</span>`;
                            
                            const subDetails = `상위 업무: ${escapeHTML(g.title)}<br>담당자: ${escapeHTML(st.assignee)}<br>기간: ${st.startDate} ~ ${st.dueDate}<br>진척 상태: ${st.status === 'COMPLETED' ? '완료' : '대기'}`;
                            bindGanttTooltip(subBar, st.title, subDetails);

                            overlayContainer.appendChild(subBar);
                        });
                    }
                });

                bodyContainer.appendChild(overlayContainer);
                grid.appendChild(bodyContainer);

            } else {
                // 요약 보기 모드
                weekdayHeader.classList.add('hidden');
                grid.className = 'flex flex-col gap-4 bg-slate-50 border border-slate-100 p-5 rounded-xl min-h-[250px]';
                grid.innerHTML = '';

                const monthStart = new Date(year, month, 1);
                const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);

                const currentMonthTasks = filteredTasks.filter(t => {
                    const startVal = new Date(t.startDate || t.dueDate || todayStr);
                    const endVal = new Date(t.dueDate || todayStr);
                    return startVal <= monthEnd && endVal >= monthStart;
                });

                if (currentMonthTasks.length === 0) {
                    grid.innerHTML = `
                        <div class="text-center py-16 text-sm text-slate-400 font-semibold">
                            현재 조건 혹은 조회 기간 중 해당 월(${month + 1}월)의 업무 정보가 존재하지 않습니다.
                        </div>
                    `;
                    return;
                }

                const groups = { OVERDUE: [], PROGRESS: [], PENDING: [], COMPLETED: [] };
                currentMonthTasks.forEach(t => {
                    if (t.status !== 'COMPLETED' && (t.dueDate || '') < todayStr) {
                        groups.OVERDUE.push(t);
                    } else {
                        groups[t.status].push(t);
                    }
                });

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
                    sec.innerHTML = `
                        <h3 class="text-xs font-bold mb-3 uppercase tracking-wider flex items-center justify-between">
                            <span>${cat.label}</span>
                            <span class="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold shadow-sm">${cat.list.length}건</span>
                        </h3>
                    `;

                    const subGrid = document.createElement('div');
                    subGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5';

                    cat.list.forEach(t => {
                        const subCount = t.subTasks ? t.subTasks.length : 0;
                        const subDone = t.subTasks ? t.subTasks.filter(st => st.status === 'COMPLETED').length : 0;
                        const subBadgeMarkup = subCount > 0 ? 
                            `<span class="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded font-bold">하위 ${subDone}/${subCount}</span>` : '';

                        // 월별 요약에서 하위 업무 목록 표시 기능 추가
                        let subTasksHtml = '';
                        if (t.subTasks && t.subTasks.length > 0) {
                            subTasksHtml = '<div class="mt-2.5 pt-2.5 border-t border-slate-100/80 space-y-1.5">';
                            t.subTasks.forEach(st => {
                                const stIcon = st.status === 'COMPLETED' ? '✅' : '⌛';
                                const stColor = st.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-600';
                                subTasksHtml += `
                                    <div class="text-[10px] flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-1.5 truncate ${stColor}">
                                            <span>${stIcon}</span>
                                            <span class="truncate">${escapeHTML(st.title)}</span>
                                        </div>
                                        <span class="shrink-0 font-medium text-[9px] bg-slate-50 px-1.5 py-0.5 rounded text-slate-400 border border-slate-200">
                                            ${st.dueDate ? st.dueDate.substring(5) : ''}
                                        </span>
                                    </div>
                                `;
                            });
                            subTasksHtml += '</div>';
                        }

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
                                    <span class="flex items-center gap-1">🗓️ ${t.startDate ? t.startDate.substring(5) : '미정'} ~ ${t.dueDate.substring(5)}</span>
                                    <span class="font-bold bg-slate-50 text-slate-600 px-1.5 py-0.5 border rounded">${escapeHTML(t.assignee)}</span>
                                </div>
                            </div>
                            ${subTasksHtml}
                        `;
                        subGrid.appendChild(box);
                    });

                    sec.appendChild(subGrid);
                    grid.appendChild(sec);
                });
            }
        }
        function renderActiveViews() {
            const filteredTasks = getFilteredTasks();
            const fStatus = document.getElementById('filter-status').value;
            
            document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('ring-2', 'ring-indigo-600', 'bg-indigo-50/10'));
            const activeCard = document.getElementById(`card-${fStatus}`);
            if (activeCard) activeCard.classList.add('ring-2', 'ring-indigo-600', 'bg-indigo-50/10');

            renderTable(filteredTasks);
            if (currentViewMode === 'CALENDAR') {
                renderCalendar(filteredTasks);
            }
        }
        function updateUI() {
            renderStats();
            buildAssigneeDropdownFilter();
            renderActiveViews();
            updateUndoButton();
        }

        // --- (7) Modal & Sub-task Functions ---
        function addSubTaskToModalList() {
            const input = document.getElementById('input-subtask-title');
            const inputAssignee = document.getElementById('input-subtask-assignee');
            const inputStart = document.getElementById('input-subtask-start');
            const inputDue = document.getElementById('input-subtask-due');
            
            const titleVal = input.value.trim();
            const assigneeVal = inputAssignee.value.trim();
            const startVal = inputStart.value;
            const dueVal = inputDue.value;

            if(!titleVal) return;

            const parentAssignee = document.getElementById('input-task-assignee').value.trim();
            const finalAssignee = assigneeVal || parentAssignee || '미지정';

            if (editingSubTaskIndex > -1) {
                currentSubTasks[editingSubTaskIndex].title = titleVal;
                currentSubTasks[editingSubTaskIndex].assignee = finalAssignee;
                currentSubTasks[editingSubTaskIndex].startDate = startVal || getTodayStr();
                currentSubTasks[editingSubTaskIndex].dueDate = dueVal || getTodayStr();
                editingSubTaskIndex = -1;

                const btn = document.getElementById('btn-add-subtask');
                btn.textContent = '추가';
                btn.className = 'rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition shrink-0 ml-auto';
            } else {
                const stObj = {
                    id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    title: titleVal,
                    status: 'PENDING',
                    assignee: finalAssignee,
                    startDate: startVal || getTodayStr(),
                    dueDate: dueVal || getTodayStr()
                };
                currentSubTasks.push(stObj);
            }

            input.value = '';
            inputAssignee.value = '';
            inputStart.value = getTodayStr();
            inputDue.value = getFutureDateStr(7);
            renderModalSubTasks();
        }
        function renderModalSubTasks() {
            const container = document.getElementById('subtask-list-container');
            container.innerHTML = '';
            
            currentSubTasks.forEach((st, idx) => {
                const li = document.createElement('li');
                li.className = 'flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-xl p-2 text-xs hover:bg-slate-100/50 transition-colors';
                const startText = st.startDate ? st.startDate.substring(5) : '미정';
                const dueText = st.dueDate ? st.dueDate.substring(5) : '미정';
                li.innerHTML = `
                    <div class="flex items-center gap-2 max-w-[70%]">
                        <span class="font-bold shrink-0 ${st.status === 'COMPLETED' ? 'text-emerald-600' : 'text-amber-500'}">
                            ${st.status === 'COMPLETED' ? '✓ 완료' : '⌛ 대기'}
                        </span>
                        <span class="text-slate-700 font-medium truncate ${st.status === 'COMPLETED' ? 'line-through opacity-50' : ''}">
                            ${escapeHTML(st.title)} 
                            <span class="text-[10px] text-slate-400 font-semibold">📅 ${startText} ~ ${dueText}</span>
                            <span class="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1 py-0.2 rounded text-[9px] font-bold">👤 ${escapeHTML(st.assignee || '미지정')}</span>
                        </span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button type="button" class="text-indigo-600 hover:text-indigo-800 font-bold px-1" onclick="editSubTaskInModal(${idx})">수정</button>
                        <span class="text-slate-300">|</span>
                        <button type="button" class="text-rose-500 hover:text-rose-700 font-semibold px-1" onclick="removeSubTaskFromModal(${idx})">삭제</button>
                    </div>
                `;
                container.appendChild(li);
            });
        }
        window.editSubTaskInModal = function(index) {
            const st = currentSubTasks[index];
            if (!st) return;

            editingSubTaskIndex = index; 

            document.getElementById('input-subtask-title').value = st.title;
            document.getElementById('input-subtask-assignee').value = st.assignee || '';
            document.getElementById('input-subtask-start').value = st.startDate || '';
            document.getElementById('input-subtask-due').value = st.dueDate || '';

            const btn = document.getElementById('btn-add-subtask');
            btn.textContent = '수정 완료';
            btn.className = 'rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition shrink-0 ml-auto';
        };
        window.removeSubTaskFromModal = function(index) {
            if (editingSubTaskIndex === index) {
                editingSubTaskIndex = -1;
                const btn = document.getElementById('btn-add-subtask');
                btn.textContent = '추가';
                btn.className = 'rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition shrink-0 ml-auto';
            }
            currentSubTasks.splice(index, 1);
            renderModalSubTasks();
        };

        // --- (8) Dialog Opening / Closing Handlers ---
        function openTaskModal(id = null) {
            document.getElementById('form-task').reset();
            document.getElementById('input-subtask-title').value = '';
            document.getElementById('input-subtask-assignee').value = '';
            document.getElementById('input-subtask-start').value = getTodayStr();
            document.getElementById('input-subtask-due').value = getFutureDateStr(7);
            editingSubTaskIndex = -1; 
            
            const btn = document.getElementById('btn-add-subtask');
            btn.textContent = '추가';
            btn.className = 'rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition shrink-0 ml-auto';

            const title = document.getElementById('modal-title');
            if (id) {
                const t = tasks.find(x => x.id === id); if (!t) return;
                title.textContent = '업무 상세 변경';
                document.getElementById('input-task-id').value = t.id; 
                document.getElementById('input-task-title').value = t.title || '';
                document.getElementById('input-task-assignee').value = t.assignee || ''; 
                document.getElementById('input-task-start').value = t.startDate || '';
                document.getElementById('input-task-due').value = t.dueDate || ''; 
                document.getElementById('input-task-priority').value = t.priority || 'NORMAL';
                document.getElementById('input-task-status').value = t.status || 'PENDING'; 
                document.getElementById('input-task-notes').value = t.notes || '';
                
                document.getElementById('input-subtask-assignee').placeholder = `담당자 (기본: ${t.assignee || '본 업무 담당자'})`;
                currentSubTasks = Array.isArray(t.subTasks) ? JSON.parse(JSON.stringify(t.subTasks)) : [];
            } else {
                title.textContent = '새로운 업무 배정';
                document.getElementById('input-task-id').value = '';
                document.getElementById('input-task-start').value = getTodayStr(); 
                document.getElementById('input-task-due').value = getFutureDateStr(7);
                document.getElementById('input-subtask-assignee').placeholder = `담당자 (선택)`;
                currentSubTasks = [];
            }
            renderModalSubTasks();
            document.getElementById('modal-task').classList.remove('hidden');
        }
        function closeModal() { document.getElementById('modal-task').classList.add('hidden'); }
        function closeConfirmModal() { document.getElementById('modal-confirm').classList.add('hidden'); confirmActionCb = null; }
        
        function openTrackerModal(id = null) {
            document.getElementById('form-tracker').reset();
            const btnDelete = document.getElementById('btn-delete-tracker');
            if (id) {
                const t = trackers.find(x => x.id === id); if (!t) return;
                document.getElementById('modal-tracker-title').textContent = '트래커 정보 수정';
                document.getElementById('input-tracker-id').value = t.id;
                document.getElementById('input-tracker-name').value = t.name;
                document.getElementById('input-tracker-desc').value = t.desc || '';
                btnDelete.classList.remove('hidden');
            } else {
                document.getElementById('modal-tracker-title').textContent = '새 트래커 스페이스 추가';
                document.getElementById('input-tracker-id').value = '';
                btnDelete.classList.add('hidden');
            }
            document.getElementById('tracker-dropdown-menu').classList.add('hidden');
            document.getElementById('modal-tracker').classList.remove('hidden');
        }
        function closeTrackerModal() { document.getElementById('modal-tracker').classList.add('hidden'); }

        // --- (9) Submission, Change & State Management Handlers ---
        async function handleTrackerSubmit(e) {
            e.preventDefault();
            const id = document.getElementById('input-tracker-id').value;
            const data = {
                name: document.getElementById('input-tracker-name').value.trim(),
                desc: document.getElementById('input-tracker-desc').value.trim()
            };

            if (id) {
                await db_updateTracker(id, data);
                showToast("트래커가 수정되었습니다.");
            } else {
                await db_addTracker(data);
                showToast("새 트래커 공간이 생성되었습니다.");
            }
            closeTrackerModal();
        }
        async function handleTaskSubmit(e) {
            e.preventDefault();
            const id = document.getElementById('input-task-id').value;
            const start = document.getElementById('input-task-start').value;
            const due = document.getElementById('input-task-due').value;

            if (start && due && start > due) return showToast('시작일은 마감일보다 늦을 수 없습니다.', false);

            let assignedOrder = 1;
            if (!id) {
                const scopeTasks = tasks.filter(t => t.trackerId === currentTrackerId);
                if (scopeTasks.length > 0) {
                    assignedOrder = Math.max(...scopeTasks.map(x => x.order ?? 0)) + 1;
                }
            }

            const data = {
                trackerId: currentTrackerId, 
                title: document.getElementById('input-task-title').value.trim(),
                assignee: document.getElementById('input-task-assignee').value.trim(),
                startDate: start, dueDate: due,
                priority: document.getElementById('input-task-priority').value,
                status: document.getElementById('input-task-status').value,
                notes: document.getElementById('input-task-notes').value.trim(),
                subTasks: currentSubTasks 
            };

            if (!id) {
                data.order = assignedOrder; 
            }

            try {
                if (id) { 
                    await db_updateTask(id, data); 
                    showToast('수정되었습니다.'); 
                } 
                else { 
                    await db_addTask(data); 
                    showToast('추가되었습니다.'); 
                }
                closeModal();
            } catch(err) { showToast('저장 실패', false); }
        }
        async function updateTaskStatus(id, newStatus) {
            try { 
                await db_updateTask(id, { status: newStatus }); 
                showToast(`상태 변경: ${getStatusKorean(newStatus)}`); 
            } catch(e) { showToast('업데이트 실패', false); }
        }
        function confirmDelete(id) {
            const t = tasks.find(x => x.id === id); if (!t) return;
            document.getElementById('confirm-title').textContent = '업무 삭제 알림';
            document.getElementById('confirm-message').innerHTML = `<strong>'${escapeHTML(t.title)}'</strong> 업무를 삭제하시겠습니까?`;
            confirmActionCb = async () => {
                try {
                    await db_deleteTask(id);
                    deletionHistory.push({ timestamp: Date.now(), items: [t] });
                    closeConfirmModal(); showToast('삭제되었습니다.');
                } catch(e) { showToast('삭제 실패', false); }
            };
            document.getElementById('modal-confirm').classList.remove('hidden');
        }
        function confirmBatchDelete() {
            if (selectedTaskIds.size === 0) return;
            document.getElementById('confirm-title').textContent = '선택한 업무 일괄 삭제';
            document.getElementById('confirm-message').innerHTML = `선택된 <strong>${selectedTaskIds.size}개</strong>의 업무를 삭제하시겠습니까?`;
            confirmActionCb = async () => {
                const deleted = [];
                selectedTaskIds.forEach(id => { 
                    const task = tasks.find(t => t.id === id); 
                    if(task) deleted.push(task); 
                });
                try {
                    await db_batchDelete(selectedTaskIds);
                    deletionHistory.push({ timestamp: Date.now(), items: deleted });
                    closeConfirmModal(); showToast(`${deleted.length}개 삭제됨.`);
                } catch(e) { showToast('일괄 삭제 실패', false); }
            };
            document.getElementById('modal-confirm').classList.remove('hidden');
        }
        async function undoDelete() {
            if (deletionHistory.length === 0) return;
            const last = deletionHistory.pop();
            const coll = getTasksCollection();
            if (canWriteToFirestore() && coll) {
                try {
                    const batch = db.batch();
                    last.items.forEach(t => {
                        const { id, ...data } = t;
                        batch.set(coll.doc(id), { ...data, deleted: false, deletedAt: null, updatedAt: getServerTimestamp() }, { merge: true });
                    });
                    await batch.commit();
                    last.items.forEach(t => { if (!tasks.some(x => x.id === t.id)) tasks.push({ ...t, deleted: false, deletedAt: null }); });
                    showToast(`${last.items.length}개 복원됨.`);
                    updateUI();
                    return;
                } catch (e) {
                    console.warn("Firestore 실행 취소 복원 실패, 임시 메모리 반영", e);
                    showToast('Firebase 복원 반영 실패: Console과 Firestore Rules를 확인해 주세요.', false);
                }
            }
            last.items.forEach(t => { if (!tasks.some(x => x.id === t.id)) tasks.push({ ...t, deleted: false, deletedAt: null }); });
            showToast(`${last.items.length}개 복원됨.`);
            updateUI();
        }

        function handleTableClick(e) {
            const editBtn = e.target.closest('.btn-edit'); 
            const delBtn = e.target.closest('.btn-delete');
            const toggleSubBtn = e.target.closest('.btn-toggle-subtasks');
            const orderUpBtn = e.target.closest('.btn-order-up');
            const orderDownBtn = e.target.closest('.btn-order-down');

            if (editBtn) openTaskModal(editBtn.dataset.id);
            if (delBtn) confirmDelete(delBtn.dataset.id);

            if (toggleSubBtn) {
                const targetId = toggleSubBtn.dataset.id;
                if (expandedTaskIds.has(targetId)) expandedTaskIds.delete(targetId);
                else expandedTaskIds.add(targetId);
                renderActiveViews();
            }

            if (orderUpBtn) moveTaskOrder(orderUpBtn.dataset.id, 'up');
            if (orderDownBtn) moveTaskOrder(orderDownBtn.dataset.id, 'down');
        }
        function handleTableChange(e) {
            const sel = e.target.closest('.sel-status'); 
            const cb = e.target.closest('.cb-task');
            const cbSubStatus = e.target.closest('.cb-subtask-status');

            if (sel) updateTaskStatus(sel.dataset.id, sel.value);
            if (cb) { cb.checked ? selectedTaskIds.add(cb.dataset.id) : selectedTaskIds.delete(cb.dataset.id); renderActiveViews(); updateBatchButton(); }
            
            if (cbSubStatus) {
                const parentId = cbSubStatus.getAttribute('data-task-id');
                const subId = cbSubStatus.getAttribute('data-subtask-id');
                const isCompleted = cbSubStatus.checked;

                const parentTask = tasks.find(x => x.id === parentId);
                if (parentTask && parentTask.subTasks) {
                    const mappedSubs = parentTask.subTasks.map(st => {
                        if (st.id === subId) return { ...st, status: isCompleted ? 'COMPLETED' : 'PENDING' };
                        return st;
                    });
                    
                    db_updateTask(parentId, { subTasks: mappedSubs })
                        .then(() => showToast('하위 업무 상태가 반영되었습니다.'))
                        .catch(() => showToast('하위 상태 반영 실패', false));
                }
            }
        }
        function toggleSelectAll(e) {
            const isChecked = e.target.checked;
            document.querySelectorAll('.cb-task').forEach(cb => isChecked ? selectedTaskIds.add(cb.dataset.id) : selectedTaskIds.delete(cb.dataset.id));
            renderActiveViews(); updateBatchButton();
        }
        function updateSelectAllState(totalVis, totalSel) {
            const cbAll = document.getElementById('checkbox-select-all');
            if(!cbAll) return;
            if (totalVis === 0) { cbAll.checked = false; cbAll.indeterminate = false; cbAll.disabled = true; } 
            else { cbAll.disabled = false; cbAll.checked = (totalVis === totalSel); cbAll.indeterminate = totalSel > 0 && totalSel < totalVis; }
            updateBatchButton();
        }
        function updateBatchButton() {
            const btn = document.getElementById('btn-batch-delete');
            if(btn) selectedTaskIds.size > 0 ? btn.classList.remove('hidden') : btn.classList.add('hidden');
        }
        function updateUndoButton() {
            const btn = document.getElementById('btn-undo');
            if(btn) deletionHistory.length > 0 ? btn.classList.remove('hidden') : btn.classList.add('hidden');
        }
        function resetFilters() {
            document.getElementById('filter-search').value = ''; 
            document.getElementById('filter-status').value = 'ALL';
            document.getElementById('filter-priority').value = 'ALL'; 
            document.getElementById('filter-assignee').value = 'ALL';
            document.getElementById('filter-start-date').value = '';
            document.getElementById('filter-end-date').value = '';
            renderActiveViews();
        }
        function handleDeleteTrackerClick() {
            const id = document.getElementById('input-tracker-id').value;
            if (!id) return;
            const t = trackers.find(x => x.id === id);
            if (!t) return;

            closeTrackerModal();
            document.getElementById('confirm-title').textContent = '트래커 완전 삭제';
            document.getElementById('confirm-message').innerHTML = `정말 <strong>'${escapeHTML(t.name)}'</strong> 트래커를 삭제하시겠습니까?<br><span class="text-rose-500 font-semibold text-xs">* 이 트래커 소속의 모든 업무 데이터가 실시간으로 함께 파괴됩니다.</span>`;
            confirmActionCb = async () => {
                try {
                    await db_deleteTracker(id);
                    closeConfirmModal();
                    showToast('트래커 및 소속 데이터가 완전히 제거되었습니다.');
                } catch(e) {
                    showToast('삭제 연쇄 오류', false);
                }
            };
            document.getElementById('modal-confirm').classList.remove('hidden');
        }

        // --- (10) Data Export / Import & System Initialization ---
        async function importFromJSON(e) {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const imp = JSON.parse(ev.target.result); if (!Array.isArray(imp)) throw new Error("배열 아님");
                    const coll = getTasksCollection();
                    if (isFirebaseAvailable && db && coll) {
                        const batch = db.batch(); const validStatus = ['PENDING','PROGRESS','COMPLETED','OVERDUE']; const validPri = ['HIGH','NORMAL','LOW'];
                        imp.forEach(t => { if(!t.title||!t.assignee||!t.dueDate||!validStatus.includes(t.status)||!validPri.includes(t.priority)) throw new Error("데이터 서식 오류");
                            const { id, ...data } = t; 
                            batch.set(coll.doc(), { ...data, trackerId: currentTrackerId }); 
                        });
                        await batch.commit(); 
                        fetchInitialData(); // DB 저장 후 최신 데이터 리로드
                    } else {
                        imp.forEach(t => {
                            const newId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                            tasks.push({ id: newId, trackerId: currentTrackerId, deleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...t });
                        });
                        updateUI();
                    }
                    showToast('성공적으로 불러왔습니다.');
                } catch (err) { showToast('읽기 오류 발생', false); }
            }; reader.readAsText(file); e.target.value = '';
        }
        function exportToJSON() {
            const activeScope = tasks.filter(t => t.trackerId === currentTrackerId);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(JSON.stringify(activeScope, null, 4));
            const link = document.createElement('a'); link.href = dataUri; link.download = `backup_${getTodayStr()}.json`; link.click();
        }
        function exportToCSV() {
            let csv = "\uFEFF업무명,담당자,시작일,마감일,우선순위,상태,세부메모\n";
            const activeScope = tasks.filter(t => t.trackerId === currentTrackerId);
            activeScope.forEach(t => { csv += `"${(t.title||'').replace(/"/g, '""')}","${(t.assignee||'').replace(/"/g, '""')}","${t.startDate||''}","${t.dueDate||''}","${t.priority==='HIGH'?'높음':t.priority==='NORMAL'?'보통':'낮음'}","${getStatusKorean(t.status)}","${(t.notes||'').replace(/"/g, '""')}"\n`; });
            const blobUrl = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8;'}));
            const link = document.createElement("a"); link.href = blobUrl;
            link.download = `export_${getTodayStr()}.csv`; link.click();
            URL.revokeObjectURL(blobUrl);
        }

        // 캘린더 모드 세팅 및 토글 스위치 가시성 제어 함수
        function setCalMode(mode) {
            currentCalMode = mode;
            ['day', 'month', 'summary'].forEach(m => {
                const btn = document.getElementById(`btn-cal-mode-${m}`);
                if (!btn) return;
                if (m.toUpperCase() === mode) {
                    btn.className = 'rounded-lg bg-white px-3.5 py-1.5 text-slate-800 shadow-sm transition';
                } else {
                    btn.className = 'rounded-lg px-3.5 py-1.5 text-slate-500 hover:text-slate-800 transition';
                }
            });
            
            // 토글 버튼 가시성 업데이트 (월별, 일별 보기에서만 보임)
            const toggleWrapper = document.getElementById('toggle-subtask-cal-wrapper');
            if (toggleWrapper) {
                if (mode === 'DAY' || mode === 'MONTH') {
                    toggleWrapper.classList.remove('hidden');
                    toggleWrapper.classList.add('inline-flex');
                } else {
                    toggleWrapper.classList.add('hidden');
                    toggleWrapper.classList.remove('inline-flex');
                }
            }
            renderActiveViews();
        }

        // --- (11) Global Event Listeners Initialization ---
        
async function ensureDefaultTrackersInFirestore() {
            if (!isFirebaseAvailable || !db) return;
            const coll = getTrackersCollection();
            if (!coll) return;
            try {
                for (const t of trackers) {
                    if (!t || !t.id) continue;
                    const ref = coll.doc(t.id);
                    const snap = await ref.get();
                    if (!snap.exists) {
                        const now = getServerTimestamp();
                        await ref.set({ name: t.name, desc: t.desc || '', deleted: false, createdAt: now, updatedAt: now }, { merge: true });
                    }
                }
            } catch (e) {
                console.warn('기본 트래커 Firestore 보정 실패', e);
            }
        }

        function setupRealtimeListeners() {
            if (!isFirebaseAvailable || !db) return false;
            const trackersColl = getTrackersCollection();
            const tasksColl = getTasksCollection();
            if (!trackersColl || !tasksColl) return false;
            if (typeof unsubscribeTrackers === 'function') unsubscribeTrackers();
            if (typeof unsubscribeTasks === 'function') unsubscribeTasks();

            unsubscribeTrackers = trackersColl.onSnapshot(snapshot => {
                trackers = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(t => t.deleted !== true);
                const savedTracker = localStorage.getItem('flow_current_tracker');
                if (trackers.length > 0) {
                    if (savedTracker && trackers.some(t => t.id === savedTracker)) {
                        currentTrackerId = savedTracker;
                    } else if (!trackers.some(t => t.id === currentTrackerId)) {
                        currentTrackerId = trackers[0].id;
                        localStorage.setItem('flow_current_tracker', currentTrackerId);
                    }
                }
                updateTrackerUI();
                updateUI();
            }, error => {
                console.error('Firestore 트래커 실시간 동기화 오류', error);
                showToast('트래커 실시간 동기화 오류가 발생했습니다.', false);
            });

            unsubscribeTasks = tasksColl.onSnapshot(snapshot => {
                tasks = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(t => t.deleted !== true);
                updateTrackerUI();
                updateUI();
            }, error => {
                console.error('Firestore 업무 실시간 동기화 오류', error);
                showToast('업무 실시간 동기화 오류가 발생했습니다.', false);
            });
            return true;
        }

        async function fetchInitialData() {
            await ensureDefaultTrackersInFirestore();
            if (setupRealtimeListeners()) return;
            updateUI();
        }

        document.addEventListener('DOMContentLoaded', () => {
            // Firebase 인증 및 초기 데이터 로딩 처리
            if (isFirebaseAvailable && auth) {
                const initAuth = async () => {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await auth.signInWithCustomToken(__initial_auth_token);
                    } else {
                        await auth.signInAnonymously();
                    }
                };

                initAuth().then(() => {
                    auth.onAuthStateChanged(user => {
                        if (user) {
                            isAuthReady = true;
                            fetchInitialData();
                        } else {
                            isAuthReady = false;
                        }
                    });
                }).catch(e => {
                    isAuthReady = false;
                    console.error("Auth initialization failed", e);
                    showToast('Firebase 인증 실패: Authentication 설정을 확인해 주세요.', false);
                    updateUI(); // 오프라인 모드로 폴백
                });
            } else {
                updateUI(); // 오프라인 모드
            }

            // 복구되었던 로컬 스토리지값 기반 트래커 초기화
            const savedTracker = localStorage.getItem('flow_current_tracker');
            if(savedTracker && trackers.some(t => t.id === savedTracker)) {
                currentTrackerId = savedTracker;
            }
            updateTrackerUI();

            // 1) 상단 액션 버튼 그룹
            document.getElementById('btn-add-task')?.addEventListener('click', () => openTaskModal());
            document.getElementById('btn-export-csv')?.addEventListener('click', exportToCSV);
            document.getElementById('btn-export-json')?.addEventListener('click', exportToJSON);
            document.getElementById('btn-undo')?.addEventListener('click', undoDelete);
            document.getElementById('btn-batch-delete')?.addEventListener('click', confirmBatchDelete);
            document.getElementById('btn-import-trigger')?.addEventListener('click', () => document.getElementById('input-import-json').click());
            document.getElementById('input-import-json')?.addEventListener('change', importFromJSON);

            // 2) 트래커 관리 드롭다운 & 버튼
            document.getElementById('btn-tracker-dropdown')?.addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('tracker-dropdown-menu').classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#tracker-dropdown-container')) {
                    document.getElementById('tracker-dropdown-menu')?.classList.add('hidden');
                }
            });
            document.getElementById('btn-create-tracker-open')?.addEventListener('click', () => openTrackerModal());
            document.getElementById('btn-edit-tracker-open')?.addEventListener('click', () => openTrackerModal(currentTrackerId));

            // 3) 대시보드 카드 클릭 (필터 연동)
            document.querySelectorAll('.filter-card').forEach(card => {
                card.addEventListener('click', () => {
                    const status = card.getAttribute('data-status');
                    document.getElementById('filter-status').value = status;
                    renderActiveViews();
                });
            });

            // 4) 필터 및 테이블 이벤트
            ['filter-search', 'filter-start-date', 'filter-end-date'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', renderActiveViews);
            });
            ['filter-status', 'filter-priority', 'filter-assignee'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', renderActiveViews);
            });
            document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
            document.getElementById('checkbox-select-all')?.addEventListener('change', toggleSelectAll);
            
            document.getElementById('task-table-body')?.addEventListener('click', handleTableClick);
            document.getElementById('task-table-body')?.addEventListener('change', handleTableChange);

            // 5) 뷰 토글
            document.getElementById('btn-view-table')?.addEventListener('click', () => {
                currentViewMode = 'TABLE';
                document.getElementById('btn-view-table').className = 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition';
                document.getElementById('btn-view-calendar').className = 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition';
                document.getElementById('view-table').classList.remove('hidden');
                document.getElementById('view-calendar').classList.add('hidden');
                renderActiveViews();
            });
            document.getElementById('btn-view-calendar')?.addEventListener('click', () => {
                currentViewMode = 'CALENDAR';
                document.getElementById('btn-view-calendar').className = 'rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition';
                document.getElementById('btn-view-table').className = 'rounded-lg px-4 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition';
                document.getElementById('view-table').classList.add('hidden');
                document.getElementById('view-calendar').classList.remove('hidden');
                renderActiveViews();
            });

            // 6) 캘린더 모드 & 네비게이션
            document.getElementById('btn-cal-mode-day')?.addEventListener('click', () => setCalMode('DAY'));
            document.getElementById('btn-cal-mode-month')?.addEventListener('click', () => setCalMode('MONTH'));
            document.getElementById('btn-cal-mode-summary')?.addEventListener('click', () => setCalMode('SUMMARY'));
            
            document.getElementById('cb-show-subtasks-cal')?.addEventListener('change', (e) => {
                isCalSubTaskVisible = e.target.checked;
                renderActiveViews();
            });

            document.getElementById('btn-prev-month')?.addEventListener('click', () => {
                currentCalDate.setMonth(currentCalDate.getMonth() - 1); renderActiveViews();
            });
            document.getElementById('btn-today-month')?.addEventListener('click', () => {
                currentCalDate = new Date(); renderActiveViews();
            });
            document.getElementById('btn-next-month')?.addEventListener('click', () => {
                currentCalDate.setMonth(currentCalDate.getMonth() + 1); renderActiveViews();
            });

            // 7) 모달창 폼 제출 및 닫기
            document.getElementById('btn-close-task-modal')?.addEventListener('click', closeModal);
            document.getElementById('btn-cancel-task')?.addEventListener('click', closeModal);
            document.getElementById('form-task')?.addEventListener('submit', handleTaskSubmit);
            document.getElementById('btn-add-subtask')?.addEventListener('click', addSubTaskToModalList);

            document.getElementById('btn-close-tracker-modal')?.addEventListener('click', closeTrackerModal);
            document.getElementById('btn-cancel-tracker')?.addEventListener('click', closeTrackerModal);
            document.getElementById('form-tracker')?.addEventListener('submit', handleTrackerSubmit);
            document.getElementById('btn-delete-tracker')?.addEventListener('click', handleDeleteTrackerClick);

            document.getElementById('btn-cancel-confirm')?.addEventListener('click', closeConfirmModal);
            document.getElementById('btn-action-confirm')?.addEventListener('click', () => {
                if (confirmActionCb) confirmActionCb();
            });
            window.addEventListener('beforeunload', () => {
                if (typeof unsubscribeTasks === 'function') unsubscribeTasks();
                if (typeof unsubscribeTrackers === 'function') unsubscribeTrackers();
            });
        });
