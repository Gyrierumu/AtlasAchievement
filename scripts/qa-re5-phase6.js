const assert = require('assert');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODE = process.argv.includes('--baseline') ? 'baseline' : 'qa';
const ARTIFACT_DIR = process.env.RE5_QA_ARTIFACT_DIR
  ? path.resolve(ROOT, process.env.RE5_QA_ARTIFACT_DIR)
  : path.join(ROOT, 'artifacts', 're5-phase6');
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, MODE === 'baseline' ? 'before' : 'screenshots');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'browser-qa.json');
const APP_URL = process.env.RE5_QA_URL || 'http://127.0.0.1:4319/jogo/resident-evil-5';
const CDP_PORT = Number(process.env.RE5_QA_CDP_PORT || (9400 + (process.pid % 200)));
const CDP_LIST_URL = `http://127.0.0.1:${CDP_PORT}/json/list`;
const VIEWPORTS = [320, 360, 390, 768, 1024, 1280, 1440];
const TABS = ['summary', 'roadmap', 'checklist', 'extras', 'dlc', 'attention'];
const INTERNAL_TARGETS = {
  'chapter-route-chapter-4-1': 'roadmap',
  guideProfessionalAiPanel: 'roadmap',
  'extras-bsaa-emblems': 'extras',
  'extras-tesouros': 'extras',
  're5-lost-in-nightmares-score-stars': 'dlc',
  're5-desperate-escape-agitator-majini': 'dlc',
  're5-versus-dlc': 'dlc',
  'fontes-e-metodologia': 'summary'
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function findBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  return candidates.find(candidate => fs.existsSync(candidate));
}

async function waitForCdp(timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(CDP_LIST_URL);
      if (response.ok) return response.json();
    } catch (_error) {
      // Browser startup is intentionally polled.
    }
    await delay(150);
  }
  throw new Error(`CDP did not become available at ${CDP_LIST_URL}`);
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
      }, 45000);
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
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Runtime.evaluate failed');
  }
  return response.result?.value;
}

async function waitFor(client, expression, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`Timeout waiting for: ${expression}`);
}

async function setViewport(client, width) {
  const height = width < 768 ? 900 : 1000;
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
    screenWidth: width,
    screenHeight: height
  });
}

async function navigate(client, url, waitForEnhancement = true) {
  await client.send('Page.navigate', { url });
  await waitFor(client, `document.readyState === 'complete' && Boolean(document.querySelector('#view-guide'))`);
  if (waitForEnhancement) {
    await waitFor(client, `document.documentElement.classList.contains('re5-ready')`);
  }
  await delay(180);
}

async function capture(client, width) {
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: true
  });
  const filePrefix = process.env.RE5_QA_FILE_PREFIX || (MODE === 'baseline' ? 're5-phase5-before' : 're5-phase6');
  const file = `${filePrefix}-${width}.png`;
  fs.writeFileSync(path.join(SCREENSHOT_DIR, file), Buffer.from(result.data, 'base64'));
  return file;
}

async function captureViewports(client, report) {
  for (const width of VIEWPORTS) {
    process.stdout.write(`${MODE}: screenshot ${width}px\n`);
    await setViewport(client, width);
    await navigate(client, `${APP_URL}?phase6_${MODE}=${width}#guideTab-summary`);
    await evaluate(client, `window.scrollTo({ top: 0, left: 0, behavior: 'auto' })`);
    await delay(100);
    report.screenshots.push(await capture(client, width));
  }
}

async function inspectPage(client) {
  return evaluate(client, `(() => {
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
    const ariaReferences = [...document.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby]')]
      .flatMap(node => ['aria-controls', 'aria-labelledby', 'aria-describedby']
        .flatMap(name => (node.getAttribute(name) || '').split(/\\s+/).filter(Boolean)));
    const targets = [...document.querySelectorAll('#view-guide button, #view-guide a.atlas-btn, #guideLayerNav [role="tab"]')]
      .filter(node => node.offsetParent !== null)
      .map(node => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height, text: node.textContent.replace(/\\s+/g, ' ').trim().slice(0, 50) };
      });
    return {
      width: innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      h1Count: document.querySelectorAll('h1').length,
      tabCount: document.querySelectorAll('#guideLayerNav [role="tab"]').length,
      trophyCount: document.querySelectorAll('#trophyList [data-trophy-id]').length,
      faqCount: document.querySelectorAll('#guideFaqPanel .atlas-faq-item').length,
      attentionCount: document.querySelectorAll('.atlas-re5-attention-item').length,
      bossCount: document.querySelectorAll('#extras-bosses-critical-encounters [data-platinum-extra-check]').length,
      figureCount: document.querySelectorAll('[data-instructional-visual]').length,
      chapterCount: document.querySelectorAll('[data-re5-chapter]').length,
      roadmapCount: document.querySelectorAll('[data-roadmap-summary-stage]').length,
      duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
      brokenAriaReferences: [...new Set(ariaReferences.filter(id => !document.getElementById(id)))],
      undersizedTargets: targets.filter(item => item.width < 24 || item.height < 24)
    };
  })()`);
}

async function pressKey(client, key, code, keyCode) {
  await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}

async function runQa(client, report) {
  for (const width of VIEWPORTS) {
    process.stdout.write(`qa: inspect ${width}px\n`);
    await setViewport(client, width);
    await navigate(client, `${APP_URL}#guideTab-summary`);
    const result = await inspectPage(client);
    assert.strictEqual(result.horizontalOverflow, false, `${width}px must not overflow horizontally`);
    assert.strictEqual(result.h1Count, 1, `${width}px must expose one H1`);
    assert.strictEqual(result.tabCount, 6, `${width}px must expose six tabs`);
    assert.strictEqual(result.trophyCount, 51, `${width}px must keep 51 base trophies`);
    assert.strictEqual(result.faqCount, 36, `${width}px must keep 36 FAQs`);
    assert.strictEqual(result.attentionCount, 12, `${width}px must keep 12 attention points`);
    assert.strictEqual(result.bossCount, 22, `${width}px must keep 22 bosses`);
    assert.strictEqual(result.figureCount, 5, `${width}px must keep five figures`);
    assert.strictEqual(result.chapterCount, 16, `${width}px must keep 16 chapters`);
    assert.strictEqual(result.roadmapCount, 7, `${width}px must keep seven route stages`);
    assert.deepStrictEqual(result.duplicateIds, [], `${width}px must not have duplicate IDs`);
    assert.deepStrictEqual(result.brokenAriaReferences, [], `${width}px must not have broken ARIA references`);
    assert.deepStrictEqual(result.undersizedTargets, [], `${width}px must meet WCAG 2.2 minimum target size`);
    report.viewports.push(result);
  }

  await setViewport(client, 390);
  await navigate(client, `${APP_URL}#guideTab-summary`);
  await evaluate(client, `document.querySelector('#guideTabButton-summary').focus()`);
  await pressKey(client, 'ArrowRight', 'ArrowRight', 39);
  report.keyboard.arrowRight = await evaluate(client, `({
    selected: document.querySelector('#guideLayerNav [aria-selected="true"]')?.dataset.guideTabButton,
    focused: document.activeElement?.dataset.guideTabButton,
    hash: location.hash
  })`);
  assert.deepStrictEqual(report.keyboard.arrowRight, { selected: 'roadmap', focused: 'roadmap', hash: '#guideTab-roadmap' });
  await pressKey(client, 'End', 'End', 35);
  report.keyboard.end = await evaluate(client, `document.querySelector('#guideLayerNav [aria-selected="true"]')?.dataset.guideTabButton`);
  assert.strictEqual(report.keyboard.end, 'attention');
  await pressKey(client, 'Home', 'Home', 36);
  report.keyboard.home = await evaluate(client, `document.querySelector('#guideLayerNav [aria-selected="true"]')?.dataset.guideTabButton`);
  assert.strictEqual(report.keyboard.home, 'summary');

  for (const tab of TABS) {
    await navigate(client, `${APP_URL}#guideTab-${tab}`);
    report.deepLinks[tab] = await evaluate(client, `({
      selected: document.querySelector('#guideLayerNav [aria-selected="true"]')?.dataset.guideTabButton,
      panelVisible: !document.querySelector('#guideTab-${tab}').hidden,
      hash: location.hash
    })`);
    assert.deepStrictEqual(report.deepLinks[tab], { selected: tab, panelVisible: true, hash: `#guideTab-${tab}` });
  }

  for (const [target, tab] of Object.entries(INTERNAL_TARGETS)) {
    await navigate(client, `${APP_URL}#${target}`);
    report.internalLinks[target] = await evaluate(client, `({
      exists: Boolean(document.getElementById(${JSON.stringify(target)})),
      selected: document.querySelector('#guideLayerNav [aria-selected="true"]')?.dataset.guideTabButton,
      visible: document.getElementById(${JSON.stringify(target)})?.getBoundingClientRect().height > 0,
      display: getComputedStyle(document.getElementById(${JSON.stringify(target)})).display,
      collapsedValue: document.getElementById(${JSON.stringify(target)})?.dataset.re5Collapsed || null,
      hasHiddenAttribute: document.getElementById(${JSON.stringify(target)})?.hasAttribute('hidden') || false,
      closestSectionHidden: document.getElementById(${JSON.stringify(target)})?.closest('[data-guide-section-content]')?.hidden ?? null,
      closestSectionDisplay: document.getElementById(${JSON.stringify(target)})?.closest('[data-guide-section-content]')
        ? getComputedStyle(document.getElementById(${JSON.stringify(target)}).closest('[data-guide-section-content]')).display
        : null
    })`);
    assert(report.internalLinks[target].exists && report.internalLinks[target].selected === tab && report.internalLinks[target].visible, `Internal target #${target} must open in ${tab}: ${JSON.stringify(report.internalLinks[target])}`);
  }

  await navigate(client, `${APP_URL}#guideTab-checklist`);
  report.checklist = await evaluate(client, `(() => {
    const button = document.querySelector('[data-trophy-toggle]');
    const before = button.getAttribute('aria-pressed');
    button.click();
    const after = button.getAttribute('aria-pressed');
    const persisted = localStorage.getItem('trophy_library_v2') || '';
    button.click();
    const search = document.querySelector('#trophySearch');
    search.value = 'Platinum';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const filtered = [...document.querySelectorAll('#trophyList [data-trophy-id]')].filter(card => !card.hidden).length;
    document.querySelector('[data-guide-clear-filters]').click();
    return { before, after, restored: button.getAttribute('aria-pressed'), persisted: Boolean(persisted), filtered };
  })()`);
  assert.notStrictEqual(report.checklist.before, report.checklist.after);
  assert.strictEqual(report.checklist.restored, report.checklist.before);
  assert.strictEqual(report.checklist.persisted, true);
  assert(report.checklist.filtered > 0 && report.checklist.filtered < 51);

  await navigate(client, `${APP_URL}#guideTab-roadmap`);
  report.roadmap = await evaluate(client, `(() => {
    const button = document.querySelector('[data-roadmap-toggle]');
    const before = button.getAttribute('aria-pressed');
    button.click();
    const after = button.getAttribute('aria-pressed');
    const persisted = localStorage.getItem('atlas_re5_phase6_state_v1') || '';
    button.click();
    return { before, after, persisted: Boolean(persisted) };
  })()`);
  assert.notStrictEqual(report.roadmap.before, report.roadmap.after);
  assert.strictEqual(report.roadmap.persisted, true);

  await navigate(client, `${APP_URL}#guideTab-extras`);
  report.extras = await evaluate(client, `(() => {
    const search = document.querySelector('#extrasSearch');
    search.value = 'Heart of Africa';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const visible = [...document.querySelectorAll('[data-extra-category-card]')].filter(card => !card.hidden).length;
    const status = document.querySelector('#extrasSearchStatus')?.textContent || '';
    return { visible, status };
  })()`);
  assert(report.extras.visible > 0 && report.extras.visible < 9);

  await navigate(client, `${APP_URL}#guideTab-dlc`);
  report.dlc = await evaluate(client, `(() => {
    const checkbox = document.querySelector('#guideDlcCompletionPanel [data-platinum-extra-check]');
    const before = checkbox.checked;
    checkbox.click();
    const after = checkbox.checked;
    const progress = document.querySelector('[data-dlc-progress]')?.textContent || '';
    checkbox.click();
    return { before, after, progress };
  })()`);
  assert.notStrictEqual(report.dlc.before, report.dlc.after);
  assert(report.dlc.progress.length > 0);

  await setViewport(client, 640);
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await navigate(client, `${APP_URL}#guideTab-summary`);
  report.zoom200 = await inspectPage(client);
  assert.strictEqual(report.zoom200.horizontalOverflow, false, '200% zoom must reflow without horizontal overflow');
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 4 });
  report.zoom400 = await inspectPage(client);
  assert.strictEqual(report.zoom400.horizontalOverflow, false, '400% zoom must reflow without horizontal overflow');
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });

  await client.send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [
      { name: 'prefers-reduced-motion', value: 'reduce' },
      { name: 'forced-colors', value: 'active' }
    ]
  });
  report.preferences = await evaluate(client, `({
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    forcedColors: matchMedia('(forced-colors: active)').matches
  })`);
  assert.deepStrictEqual(report.preferences, { reducedMotion: true, forcedColors: true });
  await client.send('Emulation.setEmulatedMedia', { media: 'screen', features: [] });

  await client.send('Emulation.setScriptExecutionDisabled', { value: true });
  await navigate(client, APP_URL, false);
  report.noJavaScript = await evaluate(client, `(() => {
    const panels = [...document.querySelectorAll('[data-guide-tab-panel]')];
    const sections = [...document.querySelectorAll('[data-guide-section-content]')];
    return {
      panels: panels.length,
      visiblePanels: panels.filter(panel => !panel.hidden && getComputedStyle(panel).display !== 'none').length,
      hiddenSections: sections.filter(section => section.hidden || getComputedStyle(section).display === 'none').length,
      filtersVisible: document.querySelector('.atlas-re5-filter-drawer')?.open === true,
      methodology: Boolean(document.querySelector('#fontes-e-metodologia'))
    };
  })()`);
  assert.deepStrictEqual(report.noJavaScript, { panels: 6, visiblePanels: 6, hiddenSections: 0, filtersVisible: true, methodology: true });
  await client.send('Emulation.setScriptExecutionDisabled', { value: false });

  await captureViewports(client, report);
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const executable = findBrowser();
  if (!executable) throw new Error('Microsoft Edge or Google Chrome was not found');
  const profileDir = path.join(ARTIFACT_DIR, `cdp-profile-${process.pid}`);
  fs.mkdirSync(profileDir, { recursive: true });
  const browser = spawn(executable, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore', windowsHide: true });

  let client;
  try {
    const targets = await waitForCdp();
    const target = targets.find(item => item.type === 'page' && item.url === 'about:blank')
      || targets.find(item => item.type === 'page');
    if (!target?.webSocketDebuggerUrl) throw new Error('No browser page target is available');
    client = new CdpClient(target.webSocketDebuggerUrl);
    const diagnostics = { consoleErrors: [], exceptions: [], failedRequests: [] };
    client.on('Runtime.exceptionThrown', event => diagnostics.exceptions.push(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || 'unknown'));
    client.on('Log.entryAdded', ({ entry }) => {
      if (entry?.level === 'error') diagnostics.consoleErrors.push(entry.text || '');
    });
    client.on('Network.loadingFailed', event => {
      if (!event.canceled) diagnostics.failedRequests.push(event.errorText || '');
    });
    await client.connect();
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Log.enable'),
      client.send('Network.enable')
    ]);

    const report = {
      generatedAt: new Date().toISOString(),
      url: APP_URL,
      mode: MODE,
      browser: `${path.basename(executable)} headless via local CDP (in-app browser unavailable: missing sandboxPolicy)`,
      screenshots: [],
      viewports: [],
      keyboard: {},
      deepLinks: {},
      internalLinks: {},
      checklist: {},
      roadmap: {},
      extras: {},
      dlc: {},
      zoom200: {},
      zoom400: {},
      preferences: {},
      noJavaScript: {},
      diagnostics
    };

    if (MODE === 'baseline') {
      await captureViewports(client, report);
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'baseline-screenshots.json'), `${JSON.stringify(report, null, 2)}\n`);
      process.stdout.write(`Phase 6 baseline screenshots saved in ${SCREENSHOT_DIR}\n`);
    } else {
      await runQa(client, report);
      assert.deepStrictEqual(diagnostics.exceptions, [], 'Normal QA must not throw browser exceptions');
      assert.deepStrictEqual(diagnostics.consoleErrors, [], 'Normal QA must not log site errors');
      assert.deepStrictEqual(diagnostics.failedRequests, [], 'Normal QA must not fail network requests');
      fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
      process.stdout.write(`Phase 6 browser QA passed: ${REPORT_PATH}\n`);
    }
  } finally {
    client?.close();
    if (!browser.killed) browser.kill('SIGKILL');
    if (process.platform === 'win32' && browser.pid) {
      spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    }
    await delay(250);
    fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  }
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
