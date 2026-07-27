'use strict';

const assert = require('assert');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ROOT,
  RE5_SLUG,
  countMatches,
  fetchPage,
  withTempApp
} = require('./test-re5-v2-ssr');

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 }
];
const ARTIFACT_DIR = path.join(ROOT, 'tmp', 're5-v2-visual');
const CDP_PORT = 9600 + (process.pid % 300);
const CDP_LIST_URL = `http://127.0.0.1:${CDP_PORT}/json/list`;

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function findBrowsers() {
  return [...new Set([
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(candidate => fs.existsSync(candidate)))];
}

function findBrowser() {
  return findBrowsers()[0];
}

async function waitForCdp(listUrl = CDP_LIST_URL, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(listUrl);
      if (response.ok) return response.json();
    } catch (_error) {}
    await delay(150);
  }
  throw new Error(`CDP did not become available at ${listUrl}`);
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
        return;
      }
      (this.listeners.get(message.method) || []).forEach(listener => listener(message.params || {}));
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 30000);
      this.pending.set(id, {
        resolve: value => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: error => {
          clearTimeout(timer);
          reject(error);
        }
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.socket?.readyState < 2) this.socket.close();
  }
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description
      || response.exceptionDetails.text
      || 'Runtime.evaluate failed'
    );
  }
  return response.result?.value;
}

async function waitFor(client, expression, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`Timeout waiting for ${expression}`);
}

async function setViewport(client, viewport) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 768,
    screenWidth: viewport.width,
    screenHeight: viewport.height
  });
}

async function navigate(client, url) {
  await client.send('Page.navigate', { url });
  await waitFor(
    client,
    "document.readyState === 'complete' && document.querySelector('[data-guide-v2]')?.dataset.guideProgressInitialized === 'true'"
  );
}

async function capture(client, name) {
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });
  const filePath = path.join(ARTIFACT_DIR, `${name}.png`);
  fs.writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

async function inspectLayout(client) {
  return evaluate(client, `(() => {
    const root = document.querySelector('[data-guide-v2]');
    const cards = [...document.querySelectorAll('[data-v2-trophy]')];
    const buttons = [...document.querySelectorAll('.guide-v2-reset-button')];
    const tables = [...document.querySelectorAll('.guide-v2-table-wrap')];
    return {
      initialized: root?.dataset.guideProgressInitialized === 'true',
      checkboxes: document.querySelectorAll('[data-guide-progress-checkbox]').length,
      disabledCheckboxes: document.querySelectorAll('[data-guide-progress-checkbox]:disabled').length,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      cutCards: cards.filter(card => {
        const rect = card.getBoundingClientRect();
        return rect.width <= 0 || rect.right > document.documentElement.clientWidth + 1;
      }).length,
      undersizedButtons: buttons.filter(button => {
        const rect = button.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      }).length,
      tableWrappers: tables.length,
      unsafeTables: tables.filter(wrapper => wrapper.scrollWidth > wrapper.clientWidth && getComputedStyle(wrapper).overflowX !== 'auto').length,
      progress: [...document.querySelectorAll('[data-progress-scope]')].map(node => ({
        scope: node.dataset.progressScope,
        value: node.getAttribute('aria-valuenow'),
        max: node.getAttribute('aria-valuemax')
      }))
    };
  })()`);
}

async function runBrowserQa(baseUrl, executable = findBrowser(), portOffset = 0) {
  if (!executable) {
    return { limited: true, reason: 'No compatible local Chrome or Edge executable was found.' };
  }
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-re5-v2-browser-'));
  const cdpPort = CDP_PORT + portOffset;
  const cdpListUrl = `http://127.0.0.1:${cdpPort}/json/list`;
  const browserCode = path.basename(executable, path.extname(executable)).toLowerCase();
  const browser = spawn(executable, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  let client;
  try {
    const targets = await waitForCdp(cdpListUrl);
    const target = targets.find(item => item.type === 'page');
    assert(target?.webSocketDebuggerUrl, 'A page target is required for browser QA');
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Network.enable')
    ]);
    const url = `${baseUrl}/jogo/${RE5_SLUG}`;
    const report = {
      browser: path.basename(executable),
      screenshots: [],
      viewports: [],
      states: {}
    };

    for (const viewport of VIEWPORTS) {
      await setViewport(client, viewport);
      await navigate(client, `${url}?visual=${viewport.width}`);
      const layout = await inspectLayout(client);
      assert.strictEqual(layout.initialized, true);
      assert.strictEqual(layout.checkboxes, 71);
      assert.strictEqual(layout.disabledCheckboxes, 0);
      assert.strictEqual(layout.horizontalOverflow, false);
      assert.strictEqual(layout.cutCards, 0);
      assert.strictEqual(layout.undersizedButtons, 0);
      assert.strictEqual(layout.unsafeTables, 0);
      report.viewports.push({ ...viewport, ...layout });
      report.screenshots.push(await capture(client, `${browserCode}-initial-${viewport.width}x${viewport.height}`));
    }

    await client.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9
    });
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9
    });
    report.states.keyboardSkipLink = await evaluate(client, `(() => ({
      text: document.activeElement?.textContent?.trim(),
      href: document.activeElement?.getAttribute?.('href'),
      outlineStyle: getComputedStyle(document.activeElement).outlineStyle
    }))()`);
    assert.strictEqual(report.states.keyboardSkipLink.href, '#conteudo-principal');
    assert.notStrictEqual(report.states.keyboardSkipLink.outlineStyle, 'none');
    report.screenshots.push(await capture(client, `${browserCode}-state-keyboard-skip-link`));

    await setViewport(client, { width: 720, height: 450 });
    await navigate(client, `${url}?visual=zoom-200`);
    report.states.zoom200 = {
      effectiveCssViewport: '720x450 (equivalent to 1440x900 at 200% zoom)',
      ...(await inspectLayout(client))
    };
    assert.strictEqual(report.states.zoom200.horizontalOverflow, false);
    assert.strictEqual(report.states.zoom200.cutCards, 0);
    assert.strictEqual(report.states.zoom200.undersizedButtons, 0);
    assert.strictEqual(report.states.zoom200.unsafeTables, 0);
    report.screenshots.push(await capture(client, `${browserCode}-state-zoom-200`));

    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    report.states.reducedMotion = await evaluate(client, `(() => {
      const bar = document.querySelector('[data-progress-bar]');
      return {
        matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
        transitionDuration: getComputedStyle(bar).transitionDuration,
        animationDuration: getComputedStyle(bar).animationDuration
      };
    })()`);
    assert.strictEqual(report.states.reducedMotion.matches, true);
    assert(parseFloat(report.states.reducedMotion.transitionDuration) <= 0.001);
    await client.send('Emulation.setEmulatedMedia', { features: [] });

    await setViewport(client, VIEWPORTS.at(-1));
    await evaluate(client, `(() => {
      const inputs = [...document.querySelectorAll('[data-guide-progress-checkbox]')];
      [inputs[0], inputs[51]].forEach(input => {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    })()`);
    report.states.partial = await inspectLayout(client);
    assert.strictEqual(
      report.states.partial.progress.find(item => item.scope === 'completion').value,
      '2'
    );
    report.screenshots.push(await capture(client, `${browserCode}-state-partial`));

    await evaluate(client, `(() => {
      document.querySelectorAll('[data-guide-progress-checkbox][data-package-code="base"]')
        .forEach(input => {
          if (!input.checked) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
    })()`);
    report.states.baseComplete = await inspectLayout(client);
    assert.strictEqual(
      report.states.baseComplete.progress.find(item => item.scope === 'platinum').value,
      '51'
    );
    assert.strictEqual(
      report.states.baseComplete.progress.find(item => item.scope === 'completion').value,
      '52'
    );
    report.screenshots.push(await capture(client, `${browserCode}-state-base-complete`));

    await evaluate(client, `(() => {
      document.querySelectorAll('[data-guide-progress-checkbox]').forEach(input => {
        if (!input.checked) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    })()`);
    report.states.complete = await inspectLayout(client);
    assert.strictEqual(
      report.states.complete.progress.find(item => item.scope === 'completion').value,
      '71'
    );
    assert.strictEqual(report.states.complete.horizontalOverflow, false);
    report.screenshots.push(await capture(client, `${browserCode}-state-100-percent`));

    let dialogMessage = '';
    const dialogOpened = new Promise(resolve => {
      client.on('Page.javascriptDialogOpening', event => {
        dialogMessage = event.message || '';
        resolve();
      });
    });
    const resetClick = client.send('Runtime.evaluate', {
      expression: "document.querySelector('[data-guide-progress-reset-all]').click()",
      awaitPromise: true,
      returnByValue: true
    });
    await Promise.race([
      dialogOpened,
      delay(5000).then(() => {
        throw new Error('Reset confirmation dialog did not open');
      })
    ]);
    assert(dialogMessage.includes('71 troféus'));
    await client.send('Page.handleJavaScriptDialog', { accept: false });
    await resetClick;
    assert.strictEqual(
      await evaluate(client, "document.querySelector('[data-progress-scope=\"completion\"]').getAttribute('aria-valuenow')"),
      '71'
    );
    report.states.resetConfirmation = { opened: true, cancelled: true, message: dialogMessage };

    const acceptedDialog = new Promise(resolve => {
      client.on('Page.javascriptDialogOpening', event => resolve(event.message || ''));
    });
    const acceptedResetClick = client.send('Runtime.evaluate', {
      expression: "document.querySelector('[data-guide-progress-reset-all]').click()",
      awaitPromise: true,
      returnByValue: true
    });
    const acceptedMessage = await Promise.race([
      acceptedDialog,
      delay(5000).then(() => {
        throw new Error('Accepted reset confirmation dialog did not open');
      })
    ]);
    assert(String(acceptedMessage).length > 0);
    await client.send('Page.handleJavaScriptDialog', { accept: true });
    await acceptedResetClick;
    assert.strictEqual(
      await evaluate(client, "document.querySelector('[data-progress-scope=\"completion\"]').getAttribute('aria-valuenow')"),
      '0'
    );
    report.states.resetAccepted = { opened: true, accepted: true, completed: 0 };
    await delay(500);
    report.screenshots.push(await capture(client, `${browserCode}-state-reset`));

    const syncInjection = await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        const nativeFetch = window.fetch.bind(window);
        window.fetch = (input, options) => {
          const url = String(input && input.url ? input.url : input);
          if (url.endsWith('/api/auth/me')) {
            return Promise.resolve(new Response(JSON.stringify({
              authenticated: true,
              csrfToken: 'visual-csrf'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
          }
          if (url.includes('/api/library/guides/resident-evil-5/progress')) {
            return Promise.resolve(new Response(JSON.stringify({
              error: { code: 'VISUAL_SYNC_FAILURE', message: 'synthetic visual failure' }
            }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
          }
          return nativeFetch(input, options);
        };
      })();`
    });
    await navigate(client, `${url}?visual=sync-error`);
    await waitFor(
      client,
      "document.querySelector('[data-guide-progress-notice]')?.textContent.includes('sincroniza')"
    );
    report.states.syncError = await evaluate(client, `(() => ({
      noticeVisible: !document.querySelector('[data-guide-progress-notice]').hidden,
      noticeText: document.querySelector('[data-guide-progress-notice]').textContent.trim()
    }))()`);
    assert.strictEqual(report.states.syncError.noticeVisible, true);
    await evaluate(client, `(() => {
      const target = document.querySelector('[data-guide-progress-notice]');
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, target.getBoundingClientRect().top + scrollY - innerHeight / 2);
    })()`);
    await delay(100);
    report.screenshots.push(await capture(client, `${browserCode}-state-sync-error`));
    await client.send('Page.removeScriptToEvaluateOnNewDocument', {
      identifier: syncInjection.identifier
    });

    await evaluate(client, `(() => {
      localStorage.clear();
      localStorage.setItem('atlas_re5_phase6_state_v1', JSON.stringify({
        roadmap: { re5_ch1_1: true },
        extras: { '': true }
      }));
    })()`);
    await navigate(client, `${url}?visual=migration`);
    report.states.migration = await evaluate(client, `(() => ({
      noticeVisible: !document.querySelector('[data-guide-progress-notice]').hidden,
      noticeText: document.querySelector('[data-guide-progress-notice]').textContent.trim(),
      completedDlc: document.querySelectorAll('[data-guide-progress-checkbox]:checked:not([data-package-code="base"])').length,
      completedBase: document.querySelectorAll('[data-guide-progress-checkbox]:checked[data-package-code="base"]').length
    }))()`);
    assert.strictEqual(report.states.migration.noticeVisible, true);
    assert.strictEqual(report.states.migration.completedDlc, 0);
    assert.strictEqual(report.states.migration.completedBase, 1);
    await evaluate(client, `(() => {
      const target = document.querySelector('[data-guide-progress-notice]');
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, target.getBoundingClientRect().top + scrollY - innerHeight / 2);
    })()`);
    await delay(100);
    report.screenshots.push(await capture(client, `${browserCode}-state-migration-warning`));

    await evaluate(client, `(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      dispatchEvent(new Event('offline'));
    })()`);
    report.states.offline = await evaluate(client, `(() => ({
      rootOffline: document.querySelector('[data-guide-v2]').classList.contains('is-offline'),
      statusVisible: !document.querySelector('[data-guide-progress-connectivity]').hidden
    }))()`);
    assert.deepStrictEqual(report.states.offline, { rootOffline: true, statusVisible: true });
    await evaluate(client, `(() => {
      const target = document.querySelector('[data-guide-progress-connectivity]');
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, target.getBoundingClientRect().top + scrollY - innerHeight / 2);
    })()`);
    await delay(100);
    report.screenshots.push(await capture(client, `${browserCode}-state-offline`));

    await evaluate(client, `(() => {
      const control = document.querySelector('[data-guide-progress-checkbox]');
      const targetTop = control.getBoundingClientRect().top + scrollY;
      document.documentElement.style.scrollBehavior = 'auto';
      control.focus({ preventScroll: true });
      scrollTo(0, targetTop - innerHeight / 2);
    })()`);
    await delay(100);
    report.states.focus = await evaluate(client, `(() => ({
      activeIsCheckbox: document.activeElement.matches('[data-guide-progress-checkbox]'),
      outlineStyle: getComputedStyle(document.activeElement).outlineStyle,
      outlineWidth: getComputedStyle(document.activeElement).outlineWidth
    }))()`);
    assert.strictEqual(report.states.focus.activeIsCheckbox, true);
    assert.notStrictEqual(report.states.focus.outlineStyle, 'none');
    report.screenshots.push(await capture(client, `${browserCode}-state-keyboard-focus`));

    await evaluate(client, `(() => {
      const target = document.querySelector('.guide-v2-table-wrap');
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, target.getBoundingClientRect().top + scrollY - innerHeight / 2);
    })()`);
    await delay(100);
    report.screenshots.push(await capture(client, `${browserCode}-state-long-table`));
    await evaluate(client, `(() => {
      const target = document.querySelector('[data-v2-package][data-package-code="versus"]');
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, target.getBoundingClientRect().top + scrollY - 16);
    })()`);
    await delay(100);
    report.screenshots.push(await capture(client, `${browserCode}-state-versus`));

    await evaluate(client, `(() => {
      const target = document.querySelector('[data-v2-review]');
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, target.getBoundingClientRect().top + scrollY - innerHeight / 2);
    })()`);
    await delay(100);
    report.states.sourcesReview = await evaluate(client, `(() => ({
      sources: document.querySelectorAll('[data-v2-source]').length,
      reviewVisible: Boolean(document.querySelector('[data-v2-review]'))
    }))()`);
    assert.deepStrictEqual(report.states.sourcesReview, { sources: 17, reviewVisible: true });
    report.screenshots.push(await capture(client, `${browserCode}-state-sources-review`));

    await evaluate(client, 'localStorage.clear()');
    await navigate(client, `${url}?visual=rollback-v2-before`);
    await evaluate(client, "document.querySelector('[data-guide-progress-checkbox]').click()");
    await delay(100);
    const rollbackStateBefore = await evaluate(client, `(() => ({
      value: localStorage.getItem('atlas:guide-progress:v2:resident-evil-5'),
      completed: Number(document.querySelector('[data-progress-scope="completion"]').getAttribute('aria-valuenow'))
    }))()`);
    assert.strictEqual(rollbackStateBefore.completed, 1);
    const rollbackStarted = Date.now();
    process.env.GUIDE_V2_ENABLED_SLUGS = '';
    await client.send('Page.navigate', { url: `${url}?visual=rollback-v1` });
    await waitFor(
      client,
      "document.readyState === 'complete' && Boolean(document.querySelector('#view-guide')) && !document.querySelector('[data-guide-v2]')"
    );
    const rollbackV1 = await evaluate(client, `(() => ({
      source: document.querySelector('[data-guide-v2]') ? 'v2' : 'v1',
      preserved: localStorage.getItem('atlas:guide-progress:v2:resident-evil-5')
    }))()`);
    assert.strictEqual(rollbackV1.source, 'v1');
    assert.strictEqual(rollbackV1.preserved, rollbackStateBefore.value);

    process.env.GUIDE_V2_ENABLED_SLUGS = RE5_SLUG;
    await navigate(client, `${url}?visual=rollback-v2-restored`);
    const rollbackRestored = await evaluate(client, `(() => ({
      completed: Number(document.querySelector('[data-progress-scope="completion"]').getAttribute('aria-valuenow')),
      checked: document.querySelectorAll('[data-guide-progress-checkbox]:checked').length,
      preserved: localStorage.getItem('atlas:guide-progress:v2:resident-evil-5')
    }))()`);
    assert.strictEqual(rollbackRestored.completed, 1);
    assert.strictEqual(rollbackRestored.checked, 1);
    assert.strictEqual(rollbackRestored.preserved, rollbackStateBefore.value);
    report.states.localRollback = {
      milliseconds: Date.now() - rollbackStarted,
      v1Selected: true,
      localProgressPreserved: true,
      restoredCompleted: rollbackRestored.completed,
      duplicateStates: rollbackRestored.checked - rollbackRestored.completed
    };

    fs.writeFileSync(
      path.join(ARTIFACT_DIR, `report-${browserCode}.json`),
      `${JSON.stringify(report, null, 2)}\n`
    );
    return report;
  } finally {
    process.env.GUIDE_V2_ENABLED_SLUGS = RE5_SLUG;
    client?.close();
    if (!browser.killed) browser.kill('SIGKILL');
    if (process.platform === 'win32' && browser.pid) {
      spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      });
    }
    await delay(150);
    fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

async function main() {
  const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'guide-v2.css'), 'utf8');
  const client = fs.readFileSync(path.join(ROOT, 'public', 'js', 'guide-progress-v2.js'), 'utf8');

  let browserReports = [];
  await withTempApp(async ({ baseUrl }) => {
    const page = await fetchPage(baseUrl, `/jogo/${RE5_SLUG}`);
    const html = page.html;
    assert.strictEqual(page.response.status, 200);
    assert.strictEqual(page.response.headers.get('x-guide-source-mode'), 'v2');
    assert.strictEqual(countMatches(html, /data-guide-progress-checkbox/g), 71);
    assert.strictEqual(countMatches(html, /data-progress-scope=/g), 5);
    assert.strictEqual(countMatches(html, /data-guide-progress-reset-package=/g), 4);
    assert.strictEqual(countMatches(html, /data-guide-progress-reset-all/g), 1);
    assert(html.includes('guide-v2-table-wrap'));
    assert(html.includes('data-package-code="versus"'));

    [
      '.guide-v2-trophy-progress',
      '.guide-v2-trophy-card.is-completed',
      '.guide-v2-progress-track',
      '.guide-v2-progress-notice',
      '.guide-v2-offline-status',
      '.guide-v2-reset-button',
      ':focus-visible',
      'overflow-x: auto',
      'max-width: 100%',
      'overflow-wrap: anywhere',
      '@media (max-width: 30rem)',
      '@media (min-width: 48rem)',
      '@media (min-width: 64rem)',
      '@media (min-width: 90rem)',
      'prefers-reduced-motion'
    ].forEach(contract => assert(css.includes(contract), `Missing visual contract: ${contract}`));

    [
      'is-completed',
      'navigator?.onLine',
      "addEventListener?.('offline'",
      "addEventListener?.('online'",
      'globalScope.confirm',
      'data-guide-progress-live',
      'data-progress-bar'
    ].forEach(contract => assert(client.includes(contract), `Missing client visual state: ${contract}`));
    const browsers = findBrowsers();
    if (!browsers.length) {
      browserReports = [{ limited: true, reason: 'No compatible local Chrome or Edge executable was found.' }];
    } else {
      for (let index = 0; index < browsers.length; index += 1) {
        browserReports.push(await runBrowserQa(baseUrl, browsers[index], index));
      }
    }
  }, { guideV2EnabledSlugs: RE5_SLUG });

  VIEWPORTS.forEach(viewport => {
    assert(viewport.width > 0 && viewport.height > 0);
  });
  if (browserReports.every(report => report?.limited)) {
    console.log(`RE5 V2 browser QA limitation: ${browserReports.map(report => report.reason).join('; ')}`);
  } else {
    browserReports.filter(report => !report.limited).forEach(report => {
      assert(report?.screenshots?.length >= 13);
      assert(report.states.resetAccepted);
      assert(report.states.syncError);
      assert(report.states.sourcesReview);
    });
    console.log(
      `RE5 V2 browser QA passed in ${browserReports.map(report => report.browser).filter(Boolean).join(', ')}: `
      + path.relative(ROOT, ARTIFACT_DIR)
    );
  }
  console.log(
    `RE5 V2 visual contract passed (${VIEWPORTS.map(item => `${item.width}x${item.height}`).join(', ')})`
  );
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  VIEWPORTS,
  CdpClient,
  delay,
  evaluate,
  findBrowser,
  findBrowsers,
  setViewport,
  waitFor
};
