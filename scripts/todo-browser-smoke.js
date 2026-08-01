const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const ROOT = path.resolve(__dirname, '..');
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createStaticServer() {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    const requestPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    const resolved = path.resolve(ROOT, relativePath);
    if (!resolved.startsWith(`${ROOT}${path.sep}`) && resolved !== path.join(ROOT, 'index.html')) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(resolved, (error, body) => {
      if (error) {
        response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
        return;
      }
      let responseBody = body;
      if (relativePath === 'index.html' && requestUrl.searchParams.get('browser-smoke') === '1') {
        responseBody = body.toString('utf8')
          .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/dompurify\/[\s\S]*?<\/script>/, '')
          .replace(/<script type="module" src="\.\/js\/firebase\.js[^"]*"><\/script>/, '');
      }
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(resolved)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      response.end(responseBody);
    });
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function getFreePort() {
  const server = http.createServer();
  const port = await listen(server);
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForDebuggerUrl(port) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const pages = await response.json();
      const appPage = pages.find(page => page.type === 'page' && page.url === 'about:blank');
      if (appPage?.webSocketDebuggerUrl) return appPage.webSocketDebuggerUrl;
    } catch {}
    await delay(100);
  }
  throw new Error('Chrome DevTools endpoint did not become ready.');
}

function createCdpClient(url) {
  const socket = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  socket.on('message', raw => {
    const message = JSON.parse(String(raw));
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    (listeners.get(message.method) || []).forEach(listener => listener(message.params));
  });
  return {
    async ready() {
      if (socket.readyState === WebSocket.OPEN) return;
      await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      });
    },
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    once(method) {
      return new Promise(resolve => {
        const handler = params => {
          listeners.set(method, (listeners.get(method) || []).filter(item => item !== handler));
          resolve(params);
        };
        listeners.set(method, [...(listeners.get(method) || []), handler]);
      });
    },
    close() {
      socket.close();
    }
  };
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitFor(client, expression, message) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await evaluate(client, `Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(message);
}

async function main() {
  assert.equal(fs.existsSync(CHROME_PATH), true, `Chrome binary not found: ${CHROME_PATH}`);
  const server = createStaticServer();
  const appPort = await listen(server);
  const debugPort = await getFreePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-tracker-todo-browser-'));
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeErrors = '';
  chrome.stderr.on('data', chunk => { chromeErrors += String(chunk); });

  let client;
  try {
    client = createCdpClient(await waitForDebuggerUrl(debugPort));
    await client.ready();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__todoBrowserSmokeErrors = [];
        window.addEventListener('error', event => window.__todoBrowserSmokeErrors.push(String(event.message || event.error || 'window error')));
        window.addEventListener('unhandledrejection', event => window.__todoBrowserSmokeErrors.push(String(event.reason || 'unhandled rejection')));
      `
    });
    const loaded = client.once('Page.loadEventFired');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${appPort}/index.html?browser-smoke=1` });
    await Promise.race([loaded, delay(5000)]);
    await waitFor(
      client,
      `typeof window.renderTodoView === 'function' && typeof window.switchView === 'function' && typeof window.initTodoController === 'function'`,
      'Application scripts did not load in Chrome.'
    );

    await evaluate(client, `
      (() => {
        window.currentUser = { uid: 'browser-user', displayName: '브라우저 테스트 사용자', email: 'browser@example.com' };
        window.currentUserRole = 'user';
        isAuthReady = true;
        trackers = [{
          id: 'tracker-sales',
          name: '영업 트래커',
          desc: '브라우저 연결 테스트',
          ownerId: 'browser-user',
          createdBy: 'browser-user',
          order: 1
        }];
        currentTrackerId = 'tracker-sales';
        tasks = [{
          id: 'task-quote',
          trackerId: 'tracker-sales',
          title: '견적 검토',
          status: 'PENDING',
          priority: 'NORMAL',
          startDate: getTodayStr(),
          dueDate: getFutureDateStr(5),
          ownerId: 'browser-user',
          createdBy: 'browser-user',
          assignee: ['브라우저 테스트 사용자'],
          subTasks: [{
            id: 'sub-customer',
            title: '고객 조건 확인',
            status: 'PENDING',
            startDate: getTodayStr(),
            dueDate: getFutureDateStr(2),
            assignee: ['브라우저 테스트 사용자'],
            recurrence: { enabled: true, frequency: 'DAILY', interval: 1, endType: 'COUNT', count: 20 }
          }]
        }];
        todoItems = [
          { id: 'overdue', ownerId: 'browser-user', title: '기한 경과 확인', memo: '', startDate: '2026-07-20', dueDate: '2026-07-26', completed: false, taskLink: { trackerId: 'tracker-sales', taskId: 'missing-task' } },
          { id: 'today', ownerId: 'browser-user', title: '오늘 현장 확인', memo: '고객 일정 확인', startDate: getTodayStr(), dueDate: getTodayStr(), completed: false },
          { id: 'week', ownerId: 'browser-user', title: '이번 주 견적 검토', memo: '', startDate: getFutureDateStr(2), dueDate: getFutureDateStr(4), completed: false }
        ];
        window.db_addTodo = async data => {
          const todo = { id: 'browser-added', ownerId: 'browser-user', ...normalizeTodoPayload(data) };
          todoItems.push(todo);
          renderTodoView();
          return { success: true, id: todo.id, todo };
        };
        window.db_updateTodo = async (id, updates) => {
          const index = todoItems.findIndex(item => item.id === id);
          if (index < 0) return { success: false, error: 'missing' };
          todoItems[index] = { ...todoItems[index], ...updates };
          renderTodoView();
          return { success: true, id, todo: todoItems[index] };
        };
        window.db_deleteTodo = async id => {
          todoItems = todoItems.filter(item => item.id !== id);
          renderTodoView();
          return { success: true, id };
        };
        updateUI();
        window.__todoBrowserInitialCalendarState = {
          mode: currentCalMode,
          desktopYearActive: document.getElementById('btn-cal-mode-month')?.classList.contains('bg-white') || false,
          desktopMonthActive: document.getElementById('btn-cal-mode-day')?.classList.contains('bg-white') || false,
          mobileYearActive: document.getElementById('btn-cal-mode-month-m')?.classList.contains('bg-white') || false,
          mobileMonthActive: document.getElementById('btn-cal-mode-day-m')?.classList.contains('bg-white') || false
        };
        switchView('TODO');
        return true;
      })()
    `);

    const initialCalendarState = await evaluate(client, 'window.__todoBrowserInitialCalendarState');
    assert.equal(initialCalendarState.mode, 'MONTH');
    assert.equal(initialCalendarState.desktopYearActive, true);
    assert.equal(initialCalendarState.desktopMonthActive, false);
    assert.equal(initialCalendarState.mobileYearActive, true);
    assert.equal(initialCalendarState.mobileMonthActive, false);

    const desktop = await evaluate(client, `(() => {
      const view = document.getElementById('view-todo');
      const brightness = element => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        context.fillStyle = getComputedStyle(element).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        return Math.round((red + green + blue) / 3);
      };
      return {
        visible: !view.hidden && getComputedStyle(view).display !== 'none',
        taskDashboardHidden: document.getElementById('task-dashboard-summary').hidden,
        trackerHeaderHidden: document.getElementById('tracker-header-context').hidden,
        listViewVisible: !document.getElementById('todo-list-view').hidden && getComputedStyle(document.getElementById('todo-list-view')).display !== 'none',
        calendarViewHidden: document.getElementById('todo-calendar-section').hidden && getComputedStyle(document.getElementById('todo-calendar-section')).display === 'none',
        listToggleActive: document.getElementById('btn-todo-view-list').getAttribute('aria-pressed') === 'true',
        resultIds: [...document.querySelectorAll('#todo-list [data-todo-id]')].map(card => card.dataset.todoId),
        noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        filterBrightness: brightness(document.getElementById('todo-shared-filter-section')),
        resultsBrightness: brightness(document.querySelector('[data-todo-dark-surface="results"]')),
        cardBrightness: brightness(document.querySelector('[data-todo-id="today"]'))
      };
    })()`);
    assert.equal(desktop.visible, true);
    assert.equal(desktop.taskDashboardHidden, true);
    assert.equal(desktop.trackerHeaderHidden, true);
    assert.equal(desktop.listViewVisible, true);
    assert.equal(desktop.calendarViewHidden, true);
    assert.equal(desktop.listToggleActive, true);
    assert.equal(desktop.noOverflow, true);
    assert.deepEqual(desktop.resultIds.slice(0, 2), ['overdue', 'today']);
    assert.ok(desktop.filterBrightness > 220 && desktop.resultsBrightness > 220 && desktop.cardBrightness > 220, '라이트 모드 To-do 표면은 밝은 계층을 유지해야 합니다.');

    await evaluate(client, `
      document.querySelector('.btn-edit-todo[data-id="overdue"]').click();
      document.getElementById('input-todo-title').value = '기한 경과 확인 수정';
      document.getElementById('form-todo').requestSubmit();
    `);
    await waitFor(client, `todoItems.find(item => item.id === 'overdue')?.title === '기한 경과 확인 수정'`, 'Inaccessible linked To-do edit did not finish.');
    assert.deepEqual(
      await evaluate(client, `todoItems.find(item => item.id === 'overdue')?.taskLink`),
      { trackerId: 'tracker-sales', taskId: 'missing-task' },
      '볼 수 없는 연결은 일반 To-do 수정만으로 삭제되면 안 됩니다.'
    );
    await evaluate(client, `
      document.querySelector('.btn-edit-todo[data-id="overdue"]').click();
      document.getElementById('btn-clear-todo-task-link').click();
      document.getElementById('form-todo').requestSubmit();
    `);
    await waitFor(client, `todoItems.find(item => item.id === 'overdue')?.taskLink == null`, 'Inaccessible task link could not be cleared.');

    await evaluate(client, `document.getElementById('btn-todo-view-calendar').click()`);
    const desktopTodoCalendar = await evaluate(client, `(() => {
      const title = document.getElementById('todo-calendar-title');
      const expectedTitle = (() => {
        const [year, month] = getTodayStr().split('-');
        return year + '년 ' + Number(month) + '월';
      })();
      return {
        title: title.textContent,
        expectedTitle,
        listViewHidden: document.getElementById('todo-list-view').hidden && getComputedStyle(document.getElementById('todo-list-view')).display === 'none',
        calendarViewVisible: !document.getElementById('todo-calendar-section').hidden && getComputedStyle(document.getElementById('todo-calendar-section')).display !== 'none',
        calendarToggleActive: document.getElementById('btn-todo-view-calendar').getAttribute('aria-pressed') === 'true',
        monthActive: document.getElementById('btn-todo-calendar-month').classList.contains('bg-white'),
        view: document.querySelector('[data-todo-calendar-view]')?.dataset.todoCalendarView,
        dayCells: document.querySelectorAll('#todo-calendar-content [data-todo-calendar-date]').length,
        hasTodayItem: !!document.querySelector('#todo-calendar-content [data-todo-calendar-id="today"]'),
        fits: document.getElementById('todo-calendar-section').scrollWidth <= document.getElementById('todo-calendar-section').clientWidth + 1
      };
    })()`);
    assert.equal(desktopTodoCalendar.title, desktopTodoCalendar.expectedTitle);
    assert.equal(desktopTodoCalendar.listViewHidden, true);
    assert.equal(desktopTodoCalendar.calendarViewVisible, true);
    assert.equal(desktopTodoCalendar.calendarToggleActive, true);
    assert.equal(desktopTodoCalendar.monthActive, true);
    assert.equal(desktopTodoCalendar.view, 'desktop-month');
    assert.ok(desktopTodoCalendar.dayCells >= 28 && desktopTodoCalendar.dayCells <= 31);
    assert.equal(desktopTodoCalendar.hasTodayItem, true);
    assert.equal(desktopTodoCalendar.fits, true);

    await evaluate(client, `document.getElementById('btn-todo-calendar-year').click()`);
    const desktopTodoYear = await evaluate(client, `(() => ({
      title: document.getElementById('todo-calendar-title').textContent,
      expectedTitle: getTodayStr().slice(0, 4) + '년 연간 현황',
      yearActive: document.getElementById('btn-todo-calendar-year').classList.contains('bg-white'),
      view: document.querySelector('[data-todo-calendar-view]')?.dataset.todoCalendarView,
      monthCards: document.querySelectorAll('#todo-calendar-content [data-todo-calendar-month]').length,
      itemBars: document.querySelectorAll('#todo-calendar-content [data-todo-calendar-id]').length,
      fits: document.getElementById('todo-calendar-section').scrollWidth <= document.getElementById('todo-calendar-section').clientWidth + 1
    }))()`);
    assert.equal(desktopTodoYear.title, desktopTodoYear.expectedTitle);
    assert.equal(desktopTodoYear.yearActive, true);
    assert.equal(desktopTodoYear.view, 'desktop-year');
    assert.equal(desktopTodoYear.monthCards, 12);
    assert.ok(desktopTodoYear.itemBars >= 2);
    assert.equal(desktopTodoYear.fits, true);

    await evaluate(client, `document.querySelector('[data-todo-calendar-month="' + getTodayStr().slice(0, 7) + '"]').click()`);
    assert.equal(await evaluate(client, `document.getElementById('btn-todo-calendar-month').classList.contains('bg-white')`), true);
    const initialTodoCalendarTitle = await evaluate(client, `document.getElementById('todo-calendar-title').textContent`);
    await evaluate(client, `document.getElementById('btn-todo-calendar-next').click()`);
    assert.notEqual(await evaluate(client, `document.getElementById('todo-calendar-title').textContent`), initialTodoCalendarTitle);
    await evaluate(client, `document.getElementById('btn-todo-calendar-today').click()`);
    assert.equal(await evaluate(client, `document.getElementById('todo-calendar-title').textContent`), desktopTodoCalendar.expectedTitle);
    await evaluate(client, `document.querySelector('#todo-calendar-content [data-todo-calendar-id="today"]').click()`);
    assert.equal(await evaluate(client, `document.getElementById('input-todo-id').value`), 'today');
    await evaluate(client, `document.getElementById('btn-cancel-todo').click()`);

    await evaluate(client, `document.getElementById('btn-open-todo').click()`);
    const desktopTaskView = await evaluate(client, `(() => {
      const taskView = document.getElementById('view-calendar');
      const filterBox = document.getElementById('unified-control-center');
      const dashboard = document.getElementById('task-dashboard-summary');
      const compactDashboard = document.getElementById('kpi-collapsed-summary');
      return {
        mode: currentViewMode,
        todoHidden: document.getElementById('view-todo').hidden,
        taskHidden: taskView.hidden,
        taskDisplay: getComputedStyle(taskView).display,
        filterHidden: filterBox.hidden,
        filterDisplay: getComputedStyle(filterBox).display,
        dashboardDisplay: getComputedStyle(dashboard).display,
        compactDashboardDisplay: getComputedStyle(compactDashboard).display,
        compactDashboardChipCount: compactDashboard.querySelectorAll('.kpi-compact-chip').length
      };
    })()`);
    assert.equal(desktopTaskView.mode, 'CALENDAR');
    assert.equal(desktopTaskView.todoHidden, true);
    assert.equal(desktopTaskView.taskHidden, false);
    assert.notEqual(desktopTaskView.taskDisplay, 'none');
    assert.equal(desktopTaskView.filterHidden, false);
    assert.notEqual(desktopTaskView.filterDisplay, 'none');
    assert.equal(desktopTaskView.dashboardDisplay, 'none');
    assert.equal(desktopTaskView.compactDashboardDisplay, 'flex');
    assert.equal(desktopTaskView.compactDashboardChipCount, 7);
    await evaluate(client, `document.getElementById('btn-open-todo').click(); setTodoViewMode('LIST');`);

    await evaluate(client, `ThemeService.setTheme('dark')`);
    await delay(250);
    await evaluate(client, `
      window.__todoDarkViewStyles = (() => {
        const sample = (name, element) => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d');
          context.fillStyle = '#0f172a';
          context.fillRect(0, 0, 1, 1);
          context.fillStyle = getComputedStyle(element).backgroundColor;
          context.fillRect(0, 0, 1, 1);
          const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
          return { name, color: getComputedStyle(element).backgroundColor, brightness: Math.round((red + green + blue) / 3) };
        };
        setTodoViewMode('LIST');
        const list = [
          sample('list-toggle', document.getElementById('btn-todo-view-list')),
          sample('filter', document.getElementById('todo-shared-filter-section')),
          sample('search', document.getElementById('todo-search')),
          sample('completion-filter', document.getElementById('todo-completion-filter')),
          sample('results', document.querySelector('[data-todo-dark-surface="results"]')),
          sample('normal-card', document.querySelector('[data-todo-id="today"]')),
          sample('overdue-card', document.querySelector('[data-todo-id="overdue"]')),
          sample('today-badge', document.querySelector('[data-todo-id="today"] .inline-flex.rounded-lg.border'))
        ];
        setTodoViewMode('CALENDAR');
        setTodoCalendarMode('MONTH');
        const month = [
          sample('calendar-panel', document.getElementById('todo-calendar-section')),
          sample('month-toggle', document.getElementById('btn-todo-calendar-month')),
          sample('calendar-today', document.getElementById('btn-todo-calendar-today')),
          sample('month-day-cell', document.querySelector('[data-todo-calendar-date]')),
          sample('month-item', document.querySelector('[data-todo-calendar-id="today"]'))
        ];
        setTodoCalendarMode('YEAR');
        const year = [
          sample('year-tile', document.querySelector('[data-todo-calendar-month-target]')),
          sample('year-item', document.querySelector('[data-todo-calendar-id="today"]'))
        ];
        setTodoViewMode('LIST');
        return {
          list,
          month,
          year,
          darkActive: document.documentElement.classList.contains('dark'),
          toggleClass: document.getElementById('btn-todo-view-list').className,
          toggleMatchesDarkWhite: document.getElementById('btn-todo-view-list').matches('.dark .bg-white')
        };
      })();
      document.getElementById('btn-add-todo').click();
      window.openAssigneeModal();
      window.closeAssigneeModal();
      window.__allDarkModalStyles = {
        panels: [...document.querySelectorAll('[data-theme-modal-panel]')].map((panel, index) => ({
          id: panel.id || panel.dataset.todoDarkSurface || 'panel-' + index,
          background: getComputedStyle(panel).backgroundColor,
          border: getComputedStyle(panel).borderColor
        })),
        alignmentWrappers: ['modal-task', 'modal-tracker', 'modal-confirm'].map(id => ({
          id,
          background: getComputedStyle(document.getElementById(id).firstElementChild).backgroundColor
        }))
      };
      window.__todoDarkModalStyles = (() => {
        const panel = document.querySelector('[data-todo-dark-surface="modal-panel"]');
        const linkSection = document.querySelector('[data-todo-dark-surface="task-link"]');
        const trackerSelect = document.getElementById('input-todo-link-tracker');
        const titleInput = document.getElementById('input-todo-title');
        return {
          panelBackground: getComputedStyle(panel).backgroundColor,
          linkBackground: getComputedStyle(linkSection).backgroundColor,
          trackerBackground: getComputedStyle(trackerSelect).backgroundColor,
          titleBackground: getComputedStyle(titleInput).backgroundColor,
          titleColor: getComputedStyle(titleInput).color
        };
      })();
      document.getElementById('input-todo-title').value = '브라우저에서 추가';
      document.getElementById('input-todo-start').value = getTodayStr();
      document.getElementById('input-todo-due').value = getFutureDateStr(3);
      const trackerSelect = document.getElementById('input-todo-link-tracker');
      trackerSelect.value = 'tracker-sales';
      trackerSelect.dispatchEvent(new Event('change', { bubbles: true }));
      const taskSelect = document.getElementById('input-todo-link-task');
      taskSelect.value = 'task-quote';
      taskSelect.dispatchEvent(new Event('change', { bubbles: true }));
      const subTaskSelect = document.getElementById('input-todo-link-subtask');
      subTaskSelect.value = 'sub-customer';
      subTaskSelect.dispatchEvent(new Event('change', { bubbles: true }));
      document.getElementById('input-todo-link-occurrence').value = getTodayStr();
      window.__todoOccurrenceUi = (() => {
        const field = document.getElementById('todo-link-occurrence-field');
        const select = document.getElementById('input-todo-link-occurrence');
        return {
          fieldVisible: !field.hidden && getComputedStyle(field).display !== 'none',
          optionCount: select.options.length,
          selectBackground: getComputedStyle(select).backgroundColor,
          modalFits: document.querySelector('[data-todo-dark-surface="modal-panel"]').scrollWidth <= document.querySelector('[data-todo-dark-surface="modal-panel"]').clientWidth
        };
      })();
      document.getElementById('form-todo').requestSubmit();
      ThemeService.setTheme('light');
    `);
    const darkViewStyles = await evaluate(client, 'window.__todoDarkViewStyles');
    assert.equal(darkViewStyles.darkActive, true, `다크 클래스가 색상 측정 중 유지되어야 합니다: ${JSON.stringify(darkViewStyles)}`);
    assert.equal(darkViewStyles.toggleMatchesDarkWhite, true, `활성 To-do 토글이 다크 선택자와 일치해야 합니다: ${darkViewStyles.toggleClass}`);
    [...darkViewStyles.list, ...darkViewStyles.month, ...darkViewStyles.year].forEach(surface => {
      assert.ok(surface.brightness < 120, `${surface.name} 다크 표면이 너무 밝습니다: ${surface.color}`);
    });
    await waitFor(client, `document.querySelector('[data-todo-id="browser-added"]')`, 'To-do add flow did not render.');
    await evaluate(client, `ThemeService.setTheme('dark'); renderTodoView();`);
    await delay(250);
    const linkedTodoDarkStyles = await evaluate(client, `(() => {
      const sample = element => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        context.fillStyle = '#0f172a';
        context.fillRect(0, 0, 1, 1);
        context.fillStyle = getComputedStyle(element).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        return { color: getComputedStyle(element).backgroundColor, brightness: Math.round((red + green + blue) / 3) };
      };
      const styles = {
        card: sample(document.querySelector('[data-todo-id="browser-added"]')),
        link: sample(document.querySelector('[data-todo-id="browser-added"] .btn-open-todo-task-link'))
      };
      return styles;
    })()`);
    assert.ok(linkedTodoDarkStyles.card.brightness < 120, `연결된 To-do 카드가 너무 밝습니다: ${linkedTodoDarkStyles.card.color}`);
    assert.ok(linkedTodoDarkStyles.link.brightness < 120, `업무 연결 배지가 너무 밝습니다: ${linkedTodoDarkStyles.link.color}`);
    await evaluate(client, `ThemeService.setTheme('light')`);
    const darkModalStyles = await evaluate(client, 'window.__todoDarkModalStyles');
    [
      darkModalStyles.panelBackground,
      darkModalStyles.linkBackground,
      darkModalStyles.trackerBackground,
      darkModalStyles.titleBackground
    ].forEach(color => assert.notEqual(color, 'rgb(255, 255, 255)', '다크 To-do 모달에 순백색 배경이 남으면 안 됩니다.'));
    assert.notEqual(darkModalStyles.titleColor, 'rgb(15, 23, 42)', '다크 입력 필드는 밝은 전경색을 사용해야 합니다.');
    const occurrenceUi = await evaluate(client, 'window.__todoOccurrenceUi');
    assert.equal(occurrenceUi.fieldVisible, true, '반복 하위 과제를 선택하면 회차 선택란이 보여야 합니다.');
    assert.equal(occurrenceUi.optionCount, 13, '회차 미지정과 가까운 12개 회차가 보여야 합니다.');
    assert.notEqual(occurrenceUi.selectBackground, 'rgb(255, 255, 255)', '다크 모드의 회차 선택란에 순백색 배경이 남으면 안 됩니다.');
    assert.equal(occurrenceUi.modalFits, true, '회차 선택란이 To-do 모달의 가로 폭을 넘으면 안 됩니다.');
    const allDarkModalStyles = await evaluate(client, 'window.__allDarkModalStyles');
    assert.ok(allDarkModalStyles.panels.length >= 11, '정적·동적 모달 패널이 공통 다크 계약에 등록되어야 합니다.');
    assert.equal(
      new Set(allDarkModalStyles.panels.map(panel => panel.background)).size,
      1,
      `모든 모달 패널은 동일한 다크 배경 역할을 사용해야 합니다: ${JSON.stringify(allDarkModalStyles.panels)}`
    );
    allDarkModalStyles.panels.forEach(panel => {
      assert.notEqual(panel.background, 'rgb(255, 255, 255)', `${panel.id} 모달 패널에 순백색 배경이 남으면 안 됩니다.`);
    });
    allDarkModalStyles.alignmentWrappers.forEach(wrapper => {
      assert.equal(wrapper.background, 'rgba(0, 0, 0, 0)', `${wrapper.id} 정렬 래퍼가 화면 전체를 불투명하게 덮으면 안 됩니다.`);
    });
    const linkedTodo = await evaluate(client, `(() => ({
      label: document.querySelector('[data-todo-id="browser-added"] .btn-open-todo-task-link')?.textContent || '',
      link: todoItems.find(item => item.id === 'browser-added')?.taskLink || null
    }))()`);
    assert.equal(linkedTodo.label.includes('영업 트래커 › 견적 검토 › 고객 조건 확인'), true);
    assert.equal(linkedTodo.label.includes('회차'), true);
    assert.deepEqual(linkedTodo.link, {
      trackerId: 'tracker-sales',
      taskId: 'task-quote',
      subTaskId: 'sub-customer',
      occurrenceKey: await evaluate(client, 'getTodayStr()')
    });

    await evaluate(client, `document.querySelector('[data-todo-id="browser-added"] .btn-open-todo-task-link').click()`);
    const linkedTaskTarget = await evaluate(client, `(() => ({
      mode: currentViewMode,
      trackerId: currentTrackerId,
      taskModalVisible: !document.getElementById('modal-task').classList.contains('hidden'),
      linkedSubTask: document.querySelector('[data-subtask-id="sub-customer"]')?.textContent.includes('To-do 연결') || false,
      linkedOccurrence: document.querySelector('[data-subtask-id="sub-customer"] [data-occurrence-key="' + getTodayStr() + '"]')?.textContent.includes('To-do 연결') || false
    }))()`);
    assert.equal(linkedTaskTarget.mode, 'TABLE');
    assert.equal(linkedTaskTarget.trackerId, 'tracker-sales');
    assert.equal(linkedTaskTarget.taskModalVisible, true);
    assert.equal(linkedTaskTarget.linkedSubTask, true);
    assert.equal(linkedTaskTarget.linkedOccurrence, true);
    await evaluate(client, `closeModal(); switchView('TODO'); setTodoViewMode('LIST');`);

    await evaluate(client, `
      document.querySelector('.btn-edit-todo[data-id="browser-added"]').click();
      document.getElementById('input-todo-title').value = '브라우저에서 수정';
      document.getElementById('btn-clear-todo-task-link').click();
      document.getElementById('form-todo').requestSubmit();
    `);
    await waitFor(client, `document.querySelector('[data-todo-id="browser-added"]')?.textContent.includes('브라우저에서 수정')`, 'To-do edit flow did not render.');
    assert.equal(await evaluate(client, `todoItems.find(item => item.id === 'browser-added')?.taskLink == null`), true);
    assert.equal(await evaluate(client, `!document.querySelector('[data-todo-id="browser-added"] .btn-open-todo-task-link')`), true);

    await evaluate(client, `
      const checkbox = document.querySelector('.todo-complete-toggle[data-id="browser-added"]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    `);
    await waitFor(client, `todoItems.find(item => item.id === 'browser-added')?.completed === true`, 'To-do completion flow failed.');

    await evaluate(client, `
      document.getElementById('todo-completion-filter').value = 'ALL';
      document.getElementById('todo-completion-filter').dispatchEvent(new Event('change', { bubbles: true }));
      document.querySelector('.btn-delete-todo[data-id="browser-added"]').click();
      document.getElementById('btn-action-confirm').click();
    `);
    await waitFor(client, `!todoItems.some(item => item.id === 'browser-added')`, 'To-do delete flow failed.');

    const filterResult = await evaluate(client, `(() => {
      document.querySelector('[data-todo-date-filter="WEEK"]').click();
      return [...document.querySelectorAll('#todo-list [data-todo-id]')].map(card => card.dataset.todoId);
    })()`);
    assert.equal(filterResult.includes('week'), true);
    assert.equal(filterResult.includes('overdue'), false);

    await evaluate(client, `
      sessionStorage.clear();
      localStorage.removeItem('flow_todo_reminder_dismissed_browser-user');
      resetTodoReminderState();
      handleTodoInitialSnapshot();
    `);
    assert.equal(await evaluate(client, `!document.getElementById('modal-todo-reminder').classList.contains('hidden')`), true);
    await evaluate(client, `document.getElementById('btn-dismiss-todo-reminder-today').click()`);
    assert.equal(await evaluate(client, `localStorage.getItem('flow_todo_reminder_dismissed_browser-user') === getTodayStr()`), true);

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await delay(200);
    await evaluate(client, `setViewVisibility('TODO'); setTodoViewMode('CALENDAR'); setTodoCalendarMode('YEAR');`);
    const mobile = await evaluate(client, `(() => {
      const view = document.getElementById('view-todo');
      document.getElementById('btn-add-todo').click();
      const modal = document.getElementById('modal-todo');
      const result = {
        viewport: document.documentElement.clientWidth,
        viewOverflow: view.scrollWidth > view.clientWidth + 1,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        listViewHidden: document.getElementById('todo-list-view').hidden && getComputedStyle(document.getElementById('todo-list-view')).display === 'none',
        calendarViewVisible: !document.getElementById('todo-calendar-section').hidden && getComputedStyle(document.getElementById('todo-calendar-section')).display !== 'none',
        calendarOverflow: document.getElementById('todo-calendar-section').scrollWidth > document.getElementById('todo-calendar-section').clientWidth + 1,
        calendarView: document.querySelector('[data-todo-calendar-view]')?.dataset.todoCalendarView,
        yearMonthCards: document.querySelectorAll('#todo-calendar-content [data-todo-calendar-month]').length,
        modalVisible: !modal.classList.contains('hidden'),
        modalOverflow: modal.scrollWidth > document.documentElement.clientWidth + 1
      };
      document.getElementById('btn-cancel-todo').click();
      return result;
    })()`);
    assert.equal(mobile.viewport, 390);
    assert.equal(mobile.viewOverflow, false);
    assert.equal(mobile.pageOverflow, false);
    assert.equal(mobile.listViewHidden, true);
    assert.equal(mobile.calendarViewVisible, true);
    assert.equal(mobile.calendarOverflow, false);
    assert.equal(mobile.calendarView, 'mobile-year');
    assert.equal(mobile.yearMonthCards, 12);
    assert.equal(mobile.modalVisible, true);
    assert.equal(mobile.modalOverflow, false);

    await evaluate(client, `document.getElementById('btn-todo-calendar-month').click()`);
    const mobileMonth = await evaluate(client, `(() => ({
      view: document.querySelector('[data-todo-calendar-view]')?.dataset.todoCalendarView,
      hasDateSection: !!document.querySelector('#todo-calendar-content [data-todo-calendar-date]'),
      hasTodayItem: !!document.querySelector('#todo-calendar-content [data-todo-calendar-id="today"]'),
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    }))()`);
    assert.equal(mobileMonth.view, 'mobile-month');
    assert.equal(mobileMonth.hasDateSection, true);
    assert.equal(mobileMonth.hasTodayItem, true);
    assert.equal(mobileMonth.pageOverflow, false);

    await evaluate(client, `document.getElementById('btn-todo-view-list').click()`);
    const mobileList = await evaluate(client, `(() => ({
      listViewVisible: !document.getElementById('todo-list-view').hidden && getComputedStyle(document.getElementById('todo-list-view')).display !== 'none',
      calendarViewHidden: document.getElementById('todo-calendar-section').hidden && getComputedStyle(document.getElementById('todo-calendar-section')).display === 'none',
      listToggleActive: document.getElementById('btn-todo-view-list').getAttribute('aria-pressed') === 'true',
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    }))()`);
    assert.equal(mobileList.listViewVisible, true);
    assert.equal(mobileList.calendarViewHidden, true);
    assert.equal(mobileList.listToggleActive, true);
    assert.equal(mobileList.pageOverflow, false);

    await evaluate(client, `document.getElementById('btn-open-todo').click()`);
    const returnedTaskView = await evaluate(client, `(() => {
      const taskView = document.getElementById('view-mobile');
      const dashboard = document.getElementById('task-dashboard-summary');
      const compactDashboard = document.getElementById('kpi-collapsed-summary');
      return {
        mode: currentViewMode,
        todoHidden: document.getElementById('view-todo').hidden,
        taskHidden: taskView.hidden,
        taskDisplay: getComputedStyle(taskView).display,
        dashboardDisplay: getComputedStyle(dashboard).display,
        compactDashboardDisplay: getComputedStyle(compactDashboard).display
      };
    })()`);
    assert.equal(returnedTaskView.mode, 'TABLE');
    assert.equal(returnedTaskView.todoHidden, true);
    assert.equal(returnedTaskView.taskHidden, false);
    assert.notEqual(returnedTaskView.taskDisplay, 'none');
    assert.equal(returnedTaskView.dashboardDisplay, 'none');
    assert.equal(returnedTaskView.compactDashboardDisplay, 'flex');

    console.log('todo browser smoke passed: task linking, split list/calendar views, task-style desktop/mobile calendars, CRUD, filters, reminder, and task-view return');
  } catch (error) {
    if (client) {
      try {
        const diagnostics = await evaluate(client, `({
          readyState: document.readyState,
          errors: window.__todoBrowserSmokeErrors || [],
          scripts: [...document.scripts].map(script => ({ src: script.src, defer: script.defer })),
          stylesheets: [...document.styleSheets].map(sheet => sheet.href || 'inline'),
          viewport: document.documentElement.clientWidth,
          dashboard: (() => {
            const element = document.getElementById('task-dashboard-summary');
            return element ? {
              className: element.className,
              hidden: element.hidden,
              display: getComputedStyle(element).display,
              columns: getComputedStyle(element).gridTemplateColumns
            } : null;
          })(),
          todoController: typeof window.renderTodoView,
          switchView: typeof window.switchView
        })`);
        console.error(JSON.stringify(diagnostics, null, 2));
      } catch {}
    }
    if (chromeErrors) console.error(chromeErrors.slice(-2000));
    throw error;
  } finally {
    client?.close();
    if (chrome.exitCode === null) {
      const exited = new Promise(resolve => chrome.once('exit', resolve));
      chrome.kill('SIGTERM');
      await Promise.race([exited, delay(2000)]);
    }
    await new Promise(resolve => server.close(resolve));
    await delay(500);
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (error) {
      console.warn(`Chrome temporary profile cleanup skipped: ${error.message}`);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
