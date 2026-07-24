console.info('Smart Task Flow month-picker-controller.js v20260724-v1 loaded');

(function initializeMonthPickerController(global) {
  const MONTH_INPUT_IDS = [
    'filter-start-month',
    'filter-end-month',
    'mobile-filter-start-month',
    'mobile-filter-end-month'
  ];
  const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}월`);

  let pickerOverlay = null;
  let activeInput = null;
  let viewYear = new Date().getFullYear();

  function isFirefox() {
    return /Firefox\//.test(global.navigator?.userAgent || '');
  }

  function dispatchMonthChange(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function closePicker() {
    if (!pickerOverlay) return;
    pickerOverlay.classList.remove('flex');
    pickerOverlay.classList.add('hidden');
    pickerOverlay.setAttribute('aria-hidden', 'true');
    activeInput?.focus();
    activeInput = null;
  }

  function renderMonths() {
    if (!pickerOverlay || !activeInput) return;

    const selectedValue = /^(\d{4})-(\d{2})$/.exec(activeInput.value);
    const selectedYear = selectedValue ? Number(selectedValue[1]) : null;
    const selectedMonth = selectedValue ? Number(selectedValue[2]) : null;
    const yearLabel = pickerOverlay.querySelector('[data-month-picker-year]');
    const monthGrid = pickerOverlay.querySelector('[data-month-picker-grid]');

    yearLabel.textContent = `${viewYear}년`;
    monthGrid.replaceChildren(...MONTH_LABELS.map((label, index) => {
      const month = index + 1;
      const button = document.createElement('button');
      const isSelected = selectedYear === viewYear && selectedMonth === month;
      button.type = 'button';
      button.dataset.month = String(month);
      button.textContent = label;
      button.className = isSelected
        ? 'rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm'
        : 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
      button.setAttribute('aria-pressed', String(isSelected));
      return button;
    }));
  }

  function ensurePicker() {
    if (pickerOverlay) return pickerOverlay;

    pickerOverlay = document.createElement('div');
    pickerOverlay.id = 'month-picker-fallback';
    pickerOverlay.className = 'fixed inset-0 z-[90] hidden items-center justify-center bg-slate-950/40 p-4';
    pickerOverlay.setAttribute('role', 'dialog');
    pickerOverlay.setAttribute('aria-modal', 'true');
    pickerOverlay.setAttribute('aria-hidden', 'true');
    pickerOverlay.setAttribute('aria-labelledby', 'month-picker-title');
    pickerOverlay.innerHTML = `
      <div class="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div class="mb-4 flex items-center justify-between gap-3">
          <button type="button" data-month-picker-prev
            class="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="이전 연도">‹</button>
          <h3 id="month-picker-title" data-month-picker-year class="text-base font-bold text-slate-800 dark:text-white"></h3>
          <button type="button" data-month-picker-next
            class="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="다음 연도">›</button>
        </div>
        <div data-month-picker-grid class="grid grid-cols-3 gap-2"></div>
        <div class="mt-4 flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          <button type="button" data-month-picker-clear
            class="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">선택 해제</button>
          <button type="button" data-month-picker-close
            class="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">닫기</button>
        </div>
      </div>`;

    pickerOverlay.addEventListener('click', (event) => {
      if (event.target === pickerOverlay || event.target.closest('[data-month-picker-close]')) {
        closePicker();
        return;
      }
      if (event.target.closest('[data-month-picker-prev]')) {
        viewYear -= 1;
        renderMonths();
        return;
      }
      if (event.target.closest('[data-month-picker-next]')) {
        viewYear += 1;
        renderMonths();
        return;
      }
      if (event.target.closest('[data-month-picker-clear]')) {
        activeInput.value = '';
        dispatchMonthChange(activeInput);
        closePicker();
        return;
      }

      const monthButton = event.target.closest('[data-month]');
      if (!monthButton) return;
      activeInput.value = `${viewYear}-${String(monthButton.dataset.month).padStart(2, '0')}`;
      dispatchMonthChange(activeInput);
      closePicker();
    });

    pickerOverlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePicker();
    });
    document.body.appendChild(pickerOverlay);
    return pickerOverlay;
  }

  function openPicker(input) {
    activeInput = input;
    const selectedValue = /^(\d{4})-(\d{2})$/.exec(input.value);
    viewYear = selectedValue ? Number(selectedValue[1]) : new Date().getFullYear();
    ensurePicker();
    renderMonths();
    pickerOverlay.classList.remove('hidden');
    pickerOverlay.classList.add('flex');
    pickerOverlay.setAttribute('aria-hidden', 'false');
    const initialFocus = pickerOverlay.querySelector('[aria-pressed="true"]')
      || pickerOverlay.querySelector('[data-month]');
    initialFocus?.focus();
  }

  function enhanceInput(input) {
    if (input.dataset.monthPickerFallback === 'true') return;
    input.dataset.monthPickerFallback = 'true';
    input.placeholder = '연도-월';
    input.setAttribute('autocomplete', 'off');

    const wrapper = document.createElement('span');
    wrapper.className = input.id.startsWith('mobile-')
      ? 'relative inline-flex min-w-0 flex-1 items-center'
      : 'relative inline-flex w-[7.5rem] items-center';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.classList.add('w-full', 'pr-7');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'absolute right-0 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-indigo-100 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:text-slate-300 dark:hover:bg-slate-700';
    button.setAttribute('aria-label', input.id.includes('start') ? '시작 월 선택' : '종료 월 선택');
    button.setAttribute('aria-haspopup', 'dialog');
    button.innerHTML = `
      <svg class="h-4 w-4" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M8 2v3m8-3v3M3 9h18M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/>
      </svg>`;
    button.addEventListener('click', () => openPicker(input));
    wrapper.appendChild(button);
  }

  function init(options = {}) {
    if (!options.force && !isFirefox()) return false;
    MONTH_INPUT_IDS
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .forEach(enhanceInput);
    return true;
  }

  global.MonthPickerController = { init, openPicker, closePicker };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(), { once: true });
  } else {
    init();
  }
})(window);
