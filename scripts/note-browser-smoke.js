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

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
      if (relativePath === 'index.html' && requestUrl.searchParams.get('browser-smoke') === 'notes') {
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
      const page = pages.find(item => item.type === 'page' && item.url === 'about:blank');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
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
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-tracker-note-browser-'));
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
        window.__noteBrowserSmokeErrors = [];
        window.DOMPurify = { sanitize: value => String(value || '') };
        window.addEventListener('error', event => window.__noteBrowserSmokeErrors.push(String(event.message || event.error || 'window error')));
        window.addEventListener('unhandledrejection', event => window.__noteBrowserSmokeErrors.push(String(event.reason || 'unhandled rejection')));
      `
    });
    const loaded = client.once('Page.loadEventFired');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${appPort}/index.html?browser-smoke=notes` });
    await Promise.race([loaded, delay(5000)]);
    await waitFor(
      client,
      `typeof window.openTaskNoteFromList === 'function' && typeof window.openNoteDetailPanel === 'function'`,
      'Progress-note UI did not load in Chrome.'
    );

    await evaluate(client, `
      (async () => {
        window.currentUser = { uid: 'note-browser-owner', displayName: '브라우저 메모 QA', email: 'note-browser@example.com' };
        window.currentUserRole = 'user';
        isAuthReady = true;
        currentTrackerId = 'tracker-note-browser';
        window.currentTrackerId = currentTrackerId;
        currentViewMode = 'TABLE';
        window.currentViewMode = currentViewMode;
        trackers = [{
          id: currentTrackerId,
          name: '메모 브라우저 QA',
          ownerId: window.currentUser.uid,
          createdBy: window.currentUser.uid,
          accessControl: {
            [window.currentUser.uid]: { view: true, create: true, update: true, delete: true }
          },
          noteTypeOptions: [{ id: 'GENERAL', label: '일반 업무' }]
        }];
        tasks = [{
          id: 'task-note-browser',
          trackerId: currentTrackerId,
          title: '메모 브라우저 검증 업무',
          status: 'PROGRESS',
          priority: 'NORMAL',
          assignee: ['브라우저 메모 QA'],
          startDate: getTodayStr(),
          dueDate: getFutureDateStr(7),
          notes: '',
          subTasks: [],
          createdBy: window.currentUser.uid,
          ownerId: window.currentUser.uid,
          deleted: false
        }];
        window.__noteBrowserNotes = [];
        window.__noteBrowserComments = [];
        window.db_fetchProgressNotes = async taskId =>
          window.__noteBrowserNotes.filter(note => note.taskId === taskId || note.taskId.startsWith(taskId + '__sub_'));
        window.db_fetchTrackerProgressNotes = async () => [...window.__noteBrowserNotes];
        window.db_updateTracker = async (_id, updates) => {
          trackers[0] = { ...trackers[0], ...updates };
          return { success: true, tracker: trackers[0] };
        };
        window.db_addProgressNote = async (taskId, data) => {
          const note = {
            id: 'note-browser-created',
            taskId,
            trackerId: currentTrackerId,
            ...data,
            reviewComments: [],
            createdBy: window.currentUser.uid,
            createdByName: window.currentUser.displayName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          window.__noteBrowserNotes.unshift(note);
          return { success: true, note };
        };
        window.db_updateProgressNote = async (noteId, updates) => {
          const index = window.__noteBrowserNotes.findIndex(note => note.id === noteId);
          window.__noteBrowserNotes[index] = { ...window.__noteBrowserNotes[index], ...updates };
          return { success: true };
        };
        window.db_addProgressNoteComment = async (noteId, _taskId, body) => {
          const comment = {
            id: 'comment-' + (window.__noteBrowserComments.length + 1),
            body,
            createdBy: window.currentUser.uid,
            createdByName: window.currentUser.displayName,
            createdAt: new Date().toISOString()
          };
          window.__noteBrowserComments.push(comment);
          return { success: true, comment };
        };
        window.db_deleteProgressNote = async () => ({ success: true });
        updateUI();
        switchView('TABLE');
        window.openTaskNoteFromList('task-note-browser');
        return true;
      })()
    `);
    await waitFor(client, `!document.getElementById('progress-note-add-form').classList.contains('hidden')`, 'Note composer did not open.');

    await evaluate(client, `
      document.getElementById('btn-open-note-type-settings').click();
      document.getElementById('btn-add-note-type').click();
      document.querySelector('#note-type-settings-list [data-note-type-id]:last-child input').value = '브라우저 QA 유형';
      document.getElementById('btn-save-note-type-settings').click();
    `);
    await waitFor(client, `document.getElementById('modal-note-type-settings').classList.contains('hidden')`, 'Work-type settings did not save.');
    const workTypeState = await evaluate(client, `(() => {
      const option = [...document.getElementById('input-note-work-type').options].find(item => item.textContent === '브라우저 QA 유형');
      return {
        trackerSaved: trackers[0].noteTypeOptions.some(item => item.label === '브라우저 QA 유형'),
        optionValue: option?.value || ''
      };
    })()`);
    assert.equal(workTypeState.trackerSaved, true);
    assert.notEqual(workTypeState.optionValue, '');

    await evaluate(client, `
      (() => {
        const editor = document.getElementById('input-note-body');
        editor.innerHTML = '<div>데스크톱 첫 번째 항목</div><div>데스크톱 두 번째 항목</div>';
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(editor);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        const listStyle = document.querySelector('[data-note-list-style][data-note-editor="input-note-body"]');
        listStyle.value = 'square';
        listStyle.dispatchEvent(new Event('change', { bubbles: true }));
        const items = editor.querySelectorAll('li');
        const indentRange = document.createRange();
        indentRange.selectNodeContents(items[1]);
        indentRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(indentRange);
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        const firstItem = editor.querySelector('li') || editor.firstChild;
        const colorRange = document.createRange();
        colorRange.selectNodeContents(firstItem);
        selection.removeAllRanges();
        selection.addRange(colorRange);
        document.dispatchEvent(new Event('selectionchange'));
        document.querySelector('[data-note-color-value="#dc2626"][data-note-editor="input-note-body"]').click();
        const nestedItem = editor.querySelector('ul ul li');
        const customRange = document.createRange();
        customRange.selectNodeContents(nestedItem);
        selection.removeAllRanges();
        selection.addRange(customRange);
        document.dispatchEvent(new Event('selectionchange'));
        const customColor = document.querySelector('[data-note-color][data-note-editor="input-note-body"]');
        customColor.value = '#7c3aed';
        customColor.dispatchEvent(new Event('change', { bubbles: true }));
        const toolbar = listStyle.parentElement;
        const controls = [...toolbar.querySelectorAll('select, button, input')];
        window.__noteDesktopFormatting = {
          palette: [...toolbar.querySelectorAll('[data-note-color-value]')].map(button => button.dataset.noteColorValue),
          paletteSizes: [...toolbar.querySelectorAll('[data-note-color-value]')].map(button => ({
            width: button.getBoundingClientRect().width,
            height: button.getBoundingClientRect().height
          })),
          customLast: controls[controls.length - 1]?.matches('[data-note-color]') || false,
          customSize: {
            width: customColor.getBoundingClientRect().width,
            height: customColor.getBoundingClientRect().height
          },
          rootStyle: editor.querySelector('ul')?.dataset.noteListStyle || '',
          nestedList: !!editor.querySelector('ul ul'),
          nestedMarker: editor.querySelector('ul ul') ? getComputedStyle(editor.querySelector('ul ul')).listStyleType : ''
        };
        document.getElementById('input-note-title').value = '데스크톱 서식 메모';
        document.getElementById('input-note-date').value = getTodayStr();
        document.getElementById('input-note-work-type').value =
          [...document.getElementById('input-note-work-type').options].find(item => item.textContent === '브라우저 QA 유형').value;
        document.getElementById('btn-save-progress-note').click();
      })()
    `);
    await waitFor(client, `window.__noteBrowserNotes.length === 1 && document.getElementById('progress-note-add-form').classList.contains('hidden')`, 'Desktop rich note did not save.');
    const desktopNote = await evaluate(client, `(() => {
      const note = window.__noteBrowserNotes[0];
      return {
        hasList: /<(ul|ol)[\\s>]/i.test(note.bodyHtml) && /<li[\\s>]/i.test(note.bodyHtml),
        hasColor: /<(font|span)[^>]*(color|style)/i.test(note.bodyHtml),
        hasCustomColor: /#7c3aed|rgb\\(124,\\s*58,\\s*237\\)/i.test(note.bodyHtml),
        hasListStyle: /data-note-list-style="square"/i.test(note.bodyHtml),
        formatting: window.__noteDesktopFormatting,
        workType: note.workTypeLabel,
        modalFits: document.getElementById('modal-task').scrollWidth <= document.documentElement.clientWidth + 1,
        pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      };
    })()`);
    assert.equal(desktopNote.hasList, true);
    assert.equal(desktopNote.hasColor, true);
    assert.equal(desktopNote.hasCustomColor, true);
    assert.equal(desktopNote.hasListStyle, true);
    assert.deepEqual(desktopNote.formatting.palette, ['#000000', '#dc2626', '#16a34a', '#2563eb']);
    assert.deepEqual(desktopNote.formatting.paletteSizes, Array(4).fill({ width: 12, height: 12 }));
    assert.equal(desktopNote.formatting.customLast, true);
    assert.deepEqual(desktopNote.formatting.customSize, { width: 24, height: 20 });
    assert.equal(desktopNote.formatting.rootStyle, 'square');
    assert.equal(desktopNote.formatting.nestedList, true);
    assert.equal(desktopNote.formatting.nestedMarker, 'disc');
    assert.equal(desktopNote.workType, '브라우저 QA 유형');
    assert.equal(desktopNote.modalFits, true);
    assert.equal(desktopNote.pageFits, true);

    await evaluate(client, `
      (async () => {
        await window.openNoteDetailPanel(window.__noteBrowserNotes[0]);
        document.getElementById('input-note-review-comment').value = '데스크톱 리뷰 코멘트';
        document.getElementById('btn-add-note-review-comment').click();
      })()
    `);
    await waitFor(client, `window.__noteBrowserComments.length === 1 && document.getElementById('note-panel-comment-count').textContent === '1건'`, 'Desktop review comment did not render.');

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await delay(250);
    await evaluate(client, `
      (() => {
        document.getElementById('btn-note-edit').click();
        const editor = document.getElementById('input-note-edit-body');
        editor.innerHTML = '<div>모바일 첫 번째 항목</div><div>모바일 두 번째 항목</div>';
        editor.focus();
        const range = document.createRange();
        range.selectNodeContents(editor);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        const listStyle = document.querySelector('[data-note-list-style][data-note-editor="input-note-edit-body"]');
        listStyle.value = 'circle';
        listStyle.dispatchEvent(new Event('change', { bubbles: true }));
        const items = editor.querySelectorAll('li');
        const indentRange = document.createRange();
        indentRange.selectNodeContents(items[1]);
        indentRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(indentRange);
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        const firstItem = editor.querySelector('li') || editor.firstChild;
        const colorRange = document.createRange();
        colorRange.selectNodeContents(firstItem);
        selection.removeAllRanges();
        selection.addRange(colorRange);
        document.dispatchEvent(new Event('selectionchange'));
        document.querySelector('[data-note-color-value="#2563eb"][data-note-editor="input-note-edit-body"]').click();
        window.__noteMobileFormatting = {
          rootStyle: editor.querySelector('ul')?.dataset.noteListStyle || '',
          nestedList: !!editor.querySelector('ul ul'),
          nestedMarker: editor.querySelector('ul ul') ? getComputedStyle(editor.querySelector('ul ul')).listStyleType : ''
        };
        document.getElementById('input-note-edit-title').value = '모바일 서식 메모';
        document.getElementById('btn-note-edit-save').click();
      })()
    `);
    await waitFor(client, `window.__noteBrowserNotes[0]?.title === '모바일 서식 메모' && !document.getElementById('note-panel-read-mode').classList.contains('hidden')`, 'Mobile rich-note edit did not save.');

    await evaluate(client, `
      document.getElementById('input-note-review-comment').value = '모바일 리뷰 코멘트';
      document.getElementById('btn-add-note-review-comment').click();
    `);
    await waitFor(client, `window.__noteBrowserComments.length === 2 && document.getElementById('note-panel-comment-count').textContent === '2건'`, 'Mobile review comment did not render.');

    const mobileState = await evaluate(client, `(() => {
      const note = window.__noteBrowserNotes[0];
      const panel = document.getElementById('note-detail-panel');
      document.getElementById('btn-open-note-type-settings').click();
      const settings = document.getElementById('modal-note-type-settings');
      const settingsCard = settings.querySelector('.max-w-md');
      const result = {
        viewport: document.documentElement.clientWidth,
        hasList: /<(ul|ol)[\\s>]/i.test(note.bodyHtml) && /<li[\\s>]/i.test(note.bodyHtml),
        hasColor: /<(font|span)[^>]*(color|style)/i.test(note.bodyHtml),
        hasListStyle: /data-note-list-style="circle"/i.test(note.bodyHtml),
        formatting: window.__noteMobileFormatting,
        panelFits: panel.scrollWidth <= document.documentElement.clientWidth + 1,
        settingsFits: settingsCard.scrollWidth <= document.documentElement.clientWidth + 1,
        pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        comments: window.__noteBrowserComments.map(comment => comment.body)
      };
      document.getElementById('btn-close-note-type-settings').click();
      return result;
    })()`);
    assert.equal(mobileState.viewport, 390);
    assert.equal(mobileState.hasList, true);
    assert.equal(mobileState.hasColor, true);
    assert.equal(mobileState.hasListStyle, true);
    assert.equal(mobileState.formatting.rootStyle, 'circle');
    assert.equal(mobileState.formatting.nestedList, true);
    assert.equal(mobileState.formatting.nestedMarker, 'square');
    assert.equal(mobileState.panelFits, true);
    assert.equal(mobileState.settingsFits, true);
    assert.equal(mobileState.pageFits, true);
    assert.deepEqual(mobileState.comments, ['데스크톱 리뷰 코멘트', '모바일 리뷰 코멘트']);

    await evaluate(client, `
      (() => {
        window.closeNoteDetailPanel();
        window.closeModal();
        document.getElementById('toast')?.classList.add('opacity-0');
        window.__noteBrowserNotes[0].reviewComments = [...window.__noteBrowserComments];
        document.getElementById('filter-start-month').value = '2026-01';
        document.getElementById('filter-end-month').value = '2026-12';
        switchView('NOTES');
      })()
    `);
    await waitFor(client, `document.querySelector('#notes-content [data-calendar-notes-view]')`, 'Mobile top-level period-filtered note list did not render.');
    const mobileNotesView = await evaluate(client, `(() => {
      const root = document.querySelector('#notes-content [data-calendar-notes-view]');
      const workType = root.querySelector('[data-calendar-notes-work-type]');
      const comments = root.querySelector('[data-calendar-notes-comments-only]');
      workType.value = window.__noteBrowserNotes[0].workType;
      workType.dispatchEvent(new Event('change', { bubbles: true }));
      comments.click();
      return {
        itemCount: root.querySelectorAll('[data-calendar-note-list-item]').length,
        commentsPressed: comments.getAttribute('aria-pressed'),
        pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        rootFits: root.scrollWidth <= document.documentElement.clientWidth + 1,
        activeTab: document.getElementById('btn-view-notes-mobile').classList.contains('bg-white'),
        calendarHidden: document.getElementById('view-calendar-mobile').hidden,
        dateLabel: document.getElementById('mobile-filter-date-label').textContent.trim(),
        hasRangeHeading: root.textContent.includes('2026년 1월 – 2026년 12월 메모')
      };
    })()`);
    assert.equal(mobileNotesView.itemCount, 1);
    assert.equal(mobileNotesView.commentsPressed, 'true');
    assert.equal(mobileNotesView.pageFits, true);
    assert.equal(mobileNotesView.rootFits, true);
    assert.equal(mobileNotesView.activeTab, true);
    assert.equal(mobileNotesView.calendarHidden, true);
    assert.equal(mobileNotesView.dateLabel, '메모 기간');
    assert.equal(mobileNotesView.hasRangeHeading, true);

    if (process.env.NOTE_VIEW_SCREENSHOT) {
      await delay(350);
      await evaluate(client, `document.getElementById('toast').style.display = 'none'`);
      const screenshot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      fs.writeFileSync(process.env.NOTE_VIEW_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
    }

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await evaluate(client, 'renderActiveViews()');
    await waitFor(client, `document.querySelector('#notes-content [data-calendar-notes-view]')`, 'Desktop top-level period-filtered note list did not render.');
    const desktopNotesView = await evaluate(client, `(() => ({
      itemCount: document.querySelectorAll('#notes-content [data-calendar-note-list-item]').length,
      pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      activeTab: document.getElementById('btn-view-notes').classList.contains('bg-white'),
      calendarHidden: document.getElementById('view-calendar').hidden,
      dateLabel: document.getElementById('filter-date-label').textContent.trim()
    }))()`);
    assert.equal(desktopNotesView.itemCount, 1);
    assert.equal(desktopNotesView.pageFits, true);
    assert.equal(desktopNotesView.activeTab, true);
    assert.equal(desktopNotesView.calendarHidden, true);
    assert.equal(desktopNotesView.dateLabel, '메모 기간:');

    const runtimeErrors = await evaluate(client, 'window.__noteBrowserSmokeErrors');
    assert.deepEqual(runtimeErrors, []);
    console.log('note browser smoke passed: desktop/mobile selection, colors, bullets, work types, comments, note list, and layout');
  } catch (error) {
    if (client) {
      try {
        const diagnostics = await evaluate(client, `({
          readyState: document.readyState,
          errors: window.__noteBrowserSmokeErrors || [],
          noteCount: window.__noteBrowserNotes?.length || 0,
          commentCount: window.__noteBrowserComments?.length || 0,
          editorHtml: document.getElementById('input-note-body')?.innerHTML || '',
          editEditorHtml: document.getElementById('input-note-edit-body')?.innerHTML || ''
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
    await delay(300);
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
