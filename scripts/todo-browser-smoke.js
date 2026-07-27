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
        todoItems = [
          { id: 'overdue', ownerId: 'browser-user', title: '기한 경과 확인', memo: '', startDate: '2026-07-20', dueDate: '2026-07-26', completed: false },
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
      return {
        visible: !view.hidden && getComputedStyle(view).display !== 'none',
        taskDashboardHidden: document.getElementById('task-dashboard-summary').hidden,
        trackerHeaderHidden: document.getElementById('tracker-header-context').hidden,
        resultIds: [...document.querySelectorAll('#todo-list [data-todo-id]')].map(card => card.dataset.todoId),
        noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      };
    })()`);
    assert.equal(desktop.visible, true);
    assert.equal(desktop.taskDashboardHidden, true);
    assert.equal(desktop.trackerHeaderHidden, true);
    assert.equal(desktop.noOverflow, true);
    assert.deepEqual(desktop.resultIds.slice(0, 2), ['overdue', 'today']);

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
    await evaluate(client, `document.getElementById('btn-open-todo').click()`);

    await evaluate(client, `
      document.getElementById('btn-add-todo').click();
      document.getElementById('input-todo-title').value = '브라우저에서 추가';
      document.getElementById('input-todo-start').value = getTodayStr();
      document.getElementById('input-todo-due').value = getFutureDateStr(3);
      document.getElementById('form-todo').requestSubmit();
    `);
    await waitFor(client, `document.querySelector('[data-todo-id="browser-added"]')`, 'To-do add flow did not render.');

    await evaluate(client, `
      document.querySelector('.btn-edit-todo[data-id="browser-added"]').click();
      document.getElementById('input-todo-title').value = '브라우저에서 수정';
      document.getElementById('form-todo').requestSubmit();
    `);
    await waitFor(client, `document.querySelector('[data-todo-id="browser-added"]')?.textContent.includes('브라우저에서 수정')`, 'To-do edit flow did not render.');

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
    await evaluate(client, `setViewVisibility('TODO'); renderTodoView();`);
    const mobile = await evaluate(client, `(() => {
      const view = document.getElementById('view-todo');
      document.getElementById('btn-add-todo').click();
      const modal = document.getElementById('modal-todo');
      const result = {
        viewport: document.documentElement.clientWidth,
        viewOverflow: view.scrollWidth > view.clientWidth + 1,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        modalVisible: !modal.classList.contains('hidden'),
        modalOverflow: modal.scrollWidth > document.documentElement.clientWidth + 1
      };
      document.getElementById('btn-cancel-todo').click();
      return result;
    })()`);
    assert.equal(mobile.viewport, 390);
    assert.equal(mobile.viewOverflow, false);
    assert.equal(mobile.pageOverflow, false);
    assert.equal(mobile.modalVisible, true);
    assert.equal(mobile.modalOverflow, false);

    await evaluate(client, `document.getElementById('btn-open-todo').click()`);
    const returnedTaskView = await evaluate(client, `(() => {
      const taskView = document.getElementById('view-calendar-mobile');
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
    assert.equal(returnedTaskView.mode, 'CALENDAR');
    assert.equal(returnedTaskView.todoHidden, true);
    assert.equal(returnedTaskView.taskHidden, false);
    assert.notEqual(returnedTaskView.taskDisplay, 'none');
    assert.equal(returnedTaskView.dashboardDisplay, 'none');
    assert.equal(returnedTaskView.compactDashboardDisplay, 'flex');

    console.log('todo browser smoke passed: desktop/mobile layout, CRUD interactions, filters, reminder, and task-view return');
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
