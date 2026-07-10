
console.info('Smart Task Flow event-bindings.js v20260626-final-stable loaded');

function initEventBindings(){
  if(window.__eventBindingsInitialized)return;
  window.__eventBindingsInitialized=true;

  // Theme toggle initialization and binding
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  const lightIcon = document.getElementById('theme-toggle-light-icon');
  const darkIcon = document.getElementById('theme-toggle-dark-icon');

  function updateToggleIcons(theme) {
    if (theme === 'dark') {
      lightIcon?.classList.remove('hidden');
      darkIcon?.classList.add('hidden');
    } else {
      lightIcon?.classList.add('hidden');
      darkIcon?.classList.remove('hidden');
    }
  }

  if (window.ThemeService) {
    updateToggleIcons(window.ThemeService.getCurrentTheme());
  }

  themeToggleBtn?.addEventListener('click', () => {
    if (window.ThemeService) {
      const newTheme = window.ThemeService.toggleTheme();
      updateToggleIcons(newTheme);
    }
  });

  window.addEventListener('themeChanged', e => {
    updateToggleIcons(e.detail.theme);
  });

  document.getElementById('btn-add-task')?.addEventListener('click',()=>window.openTaskModal?.());
  document.getElementById('btn-export-csv')?.addEventListener('click',exportToCSV);
  document.getElementById('btn-export-excel')?.addEventListener('click',exportToExcel);
  document.getElementById('btn-export-powerbi')?.addEventListener('click',exportPowerBIJSON);
  document.getElementById('btn-export-json')?.addEventListener('click',exportToJSON);
  document.getElementById('btn-undo')?.addEventListener('click',undoDelete);
  document.getElementById('btn-batch-delete')?.addEventListener('click',confirmBatchDelete);
  document.getElementById('btn-import-trigger')?.addEventListener('click',()=>document.getElementById('input-import-json')?.click());
  document.getElementById('input-import-json')?.addEventListener('change',importFromJSON);
  document.getElementById('btn-tracker-dropdown')?.addEventListener('click',e=>{e.stopPropagation();document.getElementById('tracker-dropdown-menu')?.classList.toggle('hidden');});
  document.addEventListener('click',e=>{if(!e.target.closest('#tracker-dropdown-container'))document.getElementById('tracker-dropdown-menu')?.classList.add('hidden');});
  document.getElementById('btn-create-tracker-open')?.addEventListener('click',()=>window.openTrackerModal?.());
  document.getElementById('btn-edit-tracker-open')?.addEventListener('click',()=>window.openTrackerModal?.(currentTrackerId));
  document.querySelectorAll('.filter-card').forEach(card=>card.addEventListener('click',()=>{const status=card.getAttribute('data-status');const el=document.getElementById('filter-status');if(el)el.value=status;renderActiveViews();}));
  ['filter-search','filter-start-month','filter-end-month'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderActiveViews));
  ['filter-status','filter-priority','filter-assignee','filter-start-month','filter-end-month'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderActiveViews));
  document.getElementById('filter-start-month')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      const [yr, mn] = val.split('-').map(Number);
      if (!isNaN(yr) && !isNaN(mn)) {
        currentCalDate.setFullYear(yr);
        currentCalDate.setMonth(mn - 1);
      }
    }
  });
  document.getElementById('btn-reset-filters')?.addEventListener('click',resetFilters);
  document.getElementById('checkbox-select-all')?.addEventListener('change',toggleSelectAll);
  document.getElementById('task-table-body')?.addEventListener('click',handleTableClick);
  document.getElementById('task-table-body')?.addEventListener('change',handleTableChange);
  document.getElementById('task-card-container')?.addEventListener('click',handleTableClick);
  document.getElementById('task-card-container')?.addEventListener('change',handleTableChange);
  document.getElementById('kanban-container')?.addEventListener('click',handleTableClick);
  document.getElementById('kanban-container')?.addEventListener('change',handleTableChange);
  document.getElementById('btn-view-table')?.addEventListener('click',()=>window.switchView?.('TABLE'));
  document.getElementById('btn-view-calendar')?.addEventListener('click',()=>window.switchView?.('CALENDAR'));
  document.getElementById('btn-view-kanban')?.addEventListener('click',()=>window.switchView?.('KANBAN'));
  document.getElementById('btn-view-admin')?.addEventListener('click',()=>window.switchView?.('ADMIN'));

  document.getElementById('btn-cal-mode-day')?.addEventListener('click',()=>setCalMode('DAY'));
  document.getElementById('btn-cal-mode-month')?.addEventListener('click',()=>setCalMode('MONTH'));
  document.getElementById('btn-cal-mode-summary')?.addEventListener('click',()=>setCalMode('SUMMARY'));
  document.getElementById('btn-prev-month')?.addEventListener('click',()=>{currentCalDate.setMonth(currentCalDate.getMonth()-1);renderActiveViews();});
  document.getElementById('btn-today-month')?.addEventListener('click',()=>{currentCalDate=new Date();renderActiveViews();});
  document.getElementById('btn-next-month')?.addEventListener('click',()=>{currentCalDate.setMonth(currentCalDate.getMonth()+1);renderActiveViews();});
  document.getElementById('btn-close-task-modal')?.addEventListener('click',()=>window.closeModal?.());
  document.getElementById('btn-cancel-task')?.addEventListener('click',()=>window.closeModal?.());
  document.getElementById('form-task')?.addEventListener('submit',e=>window.handleTaskSubmit?.(e));
  document.getElementById('btn-add-subtask')?.addEventListener('click',()=>window.addSubTaskToModalList?.());
  document.getElementById('btn-close-tracker-modal')?.addEventListener('click',()=>window.closeTrackerModal?.());
  document.getElementById('btn-cancel-tracker')?.addEventListener('click',()=>window.closeTrackerModal?.());
  document.getElementById('form-tracker')?.addEventListener('submit',e=>window.handleTrackerSubmit?.(e));
  document.getElementById('btn-delete-tracker')?.addEventListener('click',handleDeleteTrackerClick);
  document.getElementById('btn-cancel-confirm')?.addEventListener('click',()=>window.closeConfirmModal?.());
  document.getElementById('btn-action-confirm')?.addEventListener('click',()=>{if(confirmActionCb)confirmActionCb();});
  document.addEventListener('click',e=>{
    console.log('[EventBindings] click detected on:', e.target);
    const statusBtn=e.target.closest('.mobile-status-btn');
    if(statusBtn){
      console.log('[EventBindings] handling mobile-status-btn');
      e.preventDefault();
      e.stopPropagation();
      updateTaskStatus(statusBtn.dataset.id,statusBtn.dataset.status);
      return;
    }
    const btn=e.target.closest('button');
    if(!btn) {
      console.log('[EventBindings] no button ancestor found');
      return;
    }
    console.log('[EventBindings] button clicked:', btn.id, btn.className);
    if(btn.id==='btn-focus-risk') {
      console.log('[EventBindings] triggering toggleFocusMode for riskOnly');
      toggleFocusMode('riskOnly');
    }
    else if(btn.id==='btn-focus-high') {
      console.log('[EventBindings] triggering toggleFocusMode for highOnly');
      toggleFocusMode('highOnly');
    }
    else if(btn.id==='btn-open-assignee-modal') openAssigneeModal();
    else if(btn.id==='btn-clear-assignee-filter') clearAssigneeMultiSelect();
    else if(btn.id==='bulk-change-status') bulkChangeStatus();
    else if(btn.id==='bulk-change-assignee') bulkChangeAssignee();
    else if(btn.id==='bulk-change-due') bulkChangeDueDate();
    else if(btn.id==='bulk-clear-selection') clearSelection();
    else if(btn.id==='btn-logout') {
      if (typeof window.logout === 'function') {
        window.logout();
      }
    }
  });

  // --- Mobile Filter Dialog Control ---
  const mobileFilterDialog = document.getElementById('mobile-filter-dialog');
  const btnOpenMobileFilter = document.getElementById('btn-open-mobile-filter');
  const btnCloseMobileFilter = document.getElementById('btn-close-mobile-filter');
  const btnApplyMobileFilter = document.getElementById('mobile-btn-apply-filters');

  function openMobileFilter() {
    if (!mobileFilterDialog) return;
    mobileFilterDialog.showModal();
    // 부드러운 하단 슬라이드 업 효과
    setTimeout(() => {
      mobileFilterDialog.classList.remove('translate-y-full');
      mobileFilterDialog.classList.add('translate-y-0');
    }, 10);
  }

  function closeMobileFilter() {
    if (!mobileFilterDialog) return;
    mobileFilterDialog.classList.remove('translate-y-0');
    mobileFilterDialog.classList.add('translate-y-full');
    // transition 완료 후 close 실행
    setTimeout(() => {
      mobileFilterDialog.close();
    }, 300);
  }

  btnOpenMobileFilter?.addEventListener('click', openMobileFilter);
  btnCloseMobileFilter?.addEventListener('click', closeMobileFilter);
  btnApplyMobileFilter?.addEventListener('click', closeMobileFilter);

  // 모바일 다이얼로그 바깥(backdrop) 클릭 시 닫기
  mobileFilterDialog?.addEventListener('click', (e) => {
    if (e.target === mobileFilterDialog) {
      closeMobileFilter();
    }
  });

  // 모바일 뷰 전환 버튼 이벤트 바인딩
  document.getElementById('btn-view-table-mobile')?.addEventListener('click',()=>window.switchView?.('TABLE'));
  document.getElementById('btn-view-calendar-mobile')?.addEventListener('click',()=>window.switchView?.('CALENDAR'));
  document.getElementById('btn-view-kanban-mobile')?.addEventListener('click',()=>window.switchView?.('KANBAN'));
  document.getElementById('btn-view-admin-mobile')?.addEventListener('click',()=>window.switchView?.('ADMIN'));

  // 모바일 필터 요소를 데스크톱 필터 요소와 양방향 동기화
  const filterSyncMappings = [
    ['mobile-filter-start-month', 'filter-start-month', 'input'],
    ['mobile-filter-end-month', 'filter-end-month', 'input'],
    ['mobile-filter-status', 'filter-status', 'change'],
    ['mobile-filter-priority', 'filter-priority', 'change']
  ];

  filterSyncMappings.forEach(([mobileId, desktopId, eventType]) => {
    const mobileEl = document.getElementById(mobileId);
    const desktopEl = document.getElementById(desktopId);
    if (mobileEl && desktopEl) {
      mobileEl.addEventListener(eventType, () => {
        desktopEl.value = mobileEl.value;
        // 데스크톱 요소의 change/input 이벤트를 강제로 발생시켜 renderActiveViews 가 구동되게 합니다.
        desktopEl.dispatchEvent(new Event(eventType));
      });
    }
  });

  // 모바일 팝업 내 담당자 버튼 이벤트 위임
  document.getElementById('mobile-btn-open-assignee-modal')?.addEventListener('click', () => {
    if (typeof openAssigneeModal === 'function') openAssigneeModal();
  });
  document.getElementById('mobile-btn-clear-assignee-filter')?.addEventListener('click', () => {
    if (typeof clearAssigneeMultiSelect === 'function') clearAssigneeMultiSelect();
  });
  
  // 모바일 리셋 버튼 바인딩
  document.getElementById('mobile-btn-reset-filters')?.addEventListener('click', () => {
    if (typeof resetFilters === 'function') resetFilters();
  });
  document.getElementById('btn-mobile-reset-filters')?.addEventListener('click', () => {
    if (typeof resetFilters === 'function') resetFilters();
  });

  
  // Backdrop click listeners to close modals (Disabled for task & tracker to prevent accidental data loss)
  // document.getElementById('modal-task')?.addEventListener('click', e => {
  //   if (e.target.closest('#modal-task .inline-block') === null && document.contains(e.target)) {
  //     window.closeModal?.();
  //   }
  // });
  // document.getElementById('modal-tracker')?.addEventListener('click', e => {
  //   if (e.target.closest('#modal-tracker .inline-block') === null && document.contains(e.target)) {
  //     window.closeTrackerModal?.();
  //   }
  // });
  document.getElementById('modal-confirm')?.addEventListener('click', e => {
    if (e.target.closest('#modal-confirm .inline-block') === null && document.contains(e.target)) {
      window.closeConfirmModal?.();
    }
  });

  // ESC key listener to close modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modalTask = document.getElementById('modal-task');
      if (modalTask && !modalTask.classList.contains('hidden')) {
        window.closeModal?.();
      }
      const modalTracker = document.getElementById('modal-tracker');
      if (modalTracker && !modalTracker.classList.contains('hidden')) {
        window.closeTrackerModal?.();
      }
      const modalConfirm = document.getElementById('modal-confirm');
      if (modalConfirm && !modalConfirm.classList.contains('hidden')) {
        window.closeConfirmModal?.();
      }
      const modalAssignee = document.getElementById('assignee-filter-modal');
      if (modalAssignee && !modalAssignee.classList.contains('hidden')) {
        window.closeAssigneeModal?.();
      }
    }
  });

  let lastIsMobile = (window.matchMedia ? window.matchMedia('(max-width: 1023px)').matches : window.innerWidth < 1024);
  window.addEventListener('resize',()=>{
    setViewVisibility(currentViewMode);
    const isMobile = (window.matchMedia ? window.matchMedia('(max-width: 1023px)').matches : window.innerWidth < 1024);
    if (isMobile !== lastIsMobile) {
      lastIsMobile = isMobile;
      if (typeof renderActiveViews === 'function') {
        renderActiveViews();
      }
    }
  });
  window.addEventListener('beforeunload',()=>{if(typeof unsubscribeTasks==='function')unsubscribeTasks();if(typeof unsubscribeTrackers==='function')unsubscribeTrackers();});
}
window.initEventBindings=initEventBindings;
