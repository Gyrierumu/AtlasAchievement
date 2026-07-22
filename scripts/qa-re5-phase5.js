const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'artifacts', 're5-phase5', 'screenshots');
const REPORT_PATH = path.join(ROOT, 'artifacts', 're5-phase5', 'browser-qa.json');
const APP_URL = process.env.RE5_QA_URL || 'http://127.0.0.1:4319/jogo/resident-evil-5';
const CDP_LIST_URL = process.env.RE5_QA_CDP_LIST_URL || 'http://127.0.0.1:9340/json/list';
const VIEWPORTS = [320, 360, 390, 768, 1280];
const SCREENSHOT_VIEWPORTS = new Set([360, 390, 768, 1280]);
const TABS = ['summary', 'roadmap', 'checklist', 'extras', 'dlc', 'attention'];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    const list = this.listeners.get(method) || [];
    list.push(listener);
    this.listeners.set(method, list);
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
    this.socket.close();
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

async function navigate(client, url, timeoutMs = 30000) {
  await client.send('Page.navigate', { url });
  await waitFor(client, `document.readyState === 'complete' && Boolean(document.querySelector('#view-guide'))`, timeoutMs);
  await delay(250);
}

async function setViewport(client, width, height = 1100) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
    screenWidth: width,
    screenHeight: height
  });
}

async function capture(client, width) {
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: true
  });
  const file = `re5-phase5-${width}.png`;
  fs.writeFileSync(path.join(OUTPUT_DIR, file), Buffer.from(result.data, 'base64'));
  return file;
}

async function inspectViewport(client) {
  return evaluate(client, `(() => {
    const root = document.documentElement;
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
    const references = [...document.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls]')]
      .flatMap(node => ['aria-labelledby', 'aria-describedby', 'aria-controls']
        .flatMap(name => (node.getAttribute(name) || '').split(/\\s+/).filter(Boolean)));
    const activeTab = document.querySelector('#guideLayerNav [aria-selected="true"]');
    const activePanel = activeTab ? document.getElementById(activeTab.getAttribute('aria-controls')) : null;
    const essentialMobileText = [...document.querySelectorAll('[data-instructional-mobile-layout] li, [data-instructional-mobile-layout] h5')]
      .filter(node => getComputedStyle(node).display !== 'none')
      .map(node => Number.parseFloat(getComputedStyle(node).fontSize))
      .filter(Number.isFinite);
    const primaryTargets = [...document.querySelectorAll('#guideLayerNav [role="tab"], #view-guide .atlas-btn, #view-guide button')]
      .filter(node => node.offsetParent !== null)
      .map(node => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height, text: node.textContent.trim().slice(0, 40) };
      });
    return {
      viewport: window.innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      h1: document.querySelector('h1')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
      h1Count: document.querySelectorAll('h1').length,
      tabCount: document.querySelectorAll('#guideLayerNav [role="tab"]').length,
      activeTab: activeTab?.dataset.guideTabButton || '',
      activePanelVisible: Boolean(activePanel && !activePanel.hidden && activePanel.getAttribute('aria-hidden') === 'false'),
      figureCount: document.querySelectorAll('[data-instructional-visual]').length,
      faqCount: document.querySelectorAll('#guideFaqPanel .atlas-faq-item').length,
      attentionCount: document.querySelectorAll('#guideAttentionPointsPanel .atlas-attention-item, #guideAttentionPointsPanel [data-attention-point]').length,
      duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
      brokenAriaReferences: [...new Set(references.filter(id => !document.getElementById(id)))],
      minInstructionalTextPx: essentialMobileText.length ? Math.min(...essentialMobileText) : null,
      primaryTargetBelow24: primaryTargets.filter(item => item.width < 24 || item.height < 24),
      primaryTargetBelow44Height: primaryTargets.filter(item => item.height < 43.5).length,
      ready: root.classList.contains('re5-ready')
    };
  })()`);
}

async function runNormalQa(client, report) {
  process.stdout.write('QA: normal viewports\n');
  await client.send('Network.setBlockedURLs', { urls: ['http://0.invalid/never'] });
  await client.send('Emulation.setScriptExecutionDisabled', { value: false });
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });

  for (const width of VIEWPORTS) {
    process.stdout.write(`QA: viewport ${width}\n`);
    await setViewport(client, width);
    await navigate(client, `${APP_URL}#guideTab-summary`);
    await waitFor(client, `document.documentElement.classList.contains('re5-ready')`);
    const result = await inspectViewport(client);
    assert.strictEqual(result.horizontalOverflow, false, `${width}px must not overflow horizontally`);
    assert.strictEqual(result.h1Count, 1, `${width}px must keep one H1`);
    assert.strictEqual(result.tabCount, 6, `${width}px must keep six tabs`);
    assert.strictEqual(result.activePanelVisible, true, `${width}px active panel must be exposed`);
    assert.strictEqual(result.figureCount, 5, `${width}px must keep five figures`);
    assert.deepStrictEqual(result.duplicateIds, [], `${width}px must not contain duplicate IDs`);
    assert.deepStrictEqual(result.brokenAriaReferences, [], `${width}px must not contain broken ARIA references`);
    assert.deepStrictEqual(result.primaryTargetBelow24, [], `${width}px must meet WCAG 2.2 minimum target size`);
    if (width <= 390 && result.minInstructionalTextPx !== null) {
      assert(result.minInstructionalTextPx >= 14, `${width}px instructional text must be at least 14 CSS px`);
    }
    report.viewports.push(result);
    if (SCREENSHOT_VIEWPORTS.has(width)) {
      await navigate(client, `${APP_URL}?phase5_screenshot=${width}`);
      await waitFor(client, `document.documentElement.classList.contains('re5-ready')`);
      report.screenshots.push(await capture(client, width));
    }
  }

  await setViewport(client, 390);
  process.stdout.write('QA: keyboard\n');
  await navigate(client, `${APP_URL}#guideTab-summary`);
  await waitFor(client, `document.documentElement.classList.contains('re5-ready')`);
  await evaluate(client, `document.querySelector('#guideTabButton-summary').focus()`);
  await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 });
  report.keyboard.arrowRight = await evaluate(client, `({
    selected: document.querySelector('#guideLayerNav [aria-selected="true"]')?.dataset.guideTabButton,
    hash: location.hash,
    focused: document.activeElement?.dataset.guideTabButton
  })`);
  assert.deepStrictEqual(report.keyboard.arrowRight, { selected: 'roadmap', hash: '#guideTab-roadmap', focused: 'roadmap' });

  await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35, nativeVirtualKeyCode: 35 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35, nativeVirtualKeyCode: 35 });
  report.keyboard.end = await evaluate(client, `document.querySelector('#guideLayerNav [aria-selected="true"]')?.dataset.guideTabButton`);
  assert.strictEqual(report.keyboard.end, 'attention');

  await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36, nativeVirtualKeyCode: 36 });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36, nativeVirtualKeyCode: 36 });
  report.keyboard.home = await evaluate(client, `document.querySelector('#guideLayerNav [aria-selected="true"]')?.dataset.guideTabButton`);
  assert.strictEqual(report.keyboard.home, 'summary');

  for (const tab of TABS) {
    process.stdout.write(`QA: deep link ${tab}\n`);
    await navigate(client, `${APP_URL}#guideTab-${tab}`);
    const deepLink = await evaluate(client, `({
      selected: document.querySelector('#guideLayerNav [aria-selected="true"]')?.dataset.guideTabButton,
      panelVisible: !document.querySelector('#guideTab-${tab}').hidden,
      hash: location.hash
    })`);
    assert.deepStrictEqual(deepLink, { selected: tab, panelVisible: true, hash: `#guideTab-${tab}` });
    report.deepLinks[tab] = deepLink;
  }

  await navigate(client, `${APP_URL}#guideTab-checklist`);
  process.stdout.write('QA: checklist\n');
  report.checklist = await evaluate(client, `(() => {
    const button = document.querySelector('[data-trophy-toggle]');
    const before = button.getAttribute('aria-pressed');
    button.click();
    const after = button.getAttribute('aria-pressed');
    const counter = document.querySelector('#guideCounter').textContent;
    button.click();
    return { before, after, counter, restored: button.getAttribute('aria-pressed') };
  })()`);
  assert.notStrictEqual(report.checklist.after, report.checklist.before);
  assert.strictEqual(report.checklist.restored, report.checklist.before);

  report.filters = await evaluate(client, `(() => {
    const search = document.querySelector('#trophySearch');
    search.value = 'platinum';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const searchCount = [...document.querySelectorAll('#trophyList [data-trophy-id]')].filter(card => !card.hidden).length;
    document.querySelector('[data-guide-clear-filters]').click();
    const clearedCount = [...document.querySelectorAll('#trophyList [data-trophy-id]')].filter(card => !card.hidden).length;
    return { searchCount, clearedCount, status: document.querySelector('#guideResults').textContent };
  })()`);
  assert(report.filters.searchCount > 0 && report.filters.searchCount < 51);
  assert.strictEqual(report.filters.clearedCount, 51);

  await navigate(client, `${APP_URL}#guideTab-attention`);
  process.stdout.write('QA: accordion\n');
  report.accordion = await evaluate(client, `(() => {
    const button = document.querySelector('[data-re5-collapsed-toggle="true"]');
    const content = document.getElementById(button.getAttribute('aria-controls'));
    const before = { expanded: button.getAttribute('aria-expanded'), hidden: content.hidden };
    button.click();
    const opened = { expanded: button.getAttribute('aria-expanded'), hidden: content.hidden };
    button.click();
    const closed = { expanded: button.getAttribute('aria-expanded'), hidden: content.hidden };
    return { before, opened, closed };
  })()`);
  assert.deepStrictEqual(report.accordion.before, { expanded: 'false', hidden: true });
  assert.deepStrictEqual(report.accordion.opened, { expanded: 'true', hidden: false });
  assert.deepStrictEqual(report.accordion.closed, { expanded: 'false', hidden: true });

  await setViewport(client, 640);
  process.stdout.write('QA: zoom\n');
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  await navigate(client, `${APP_URL}#guideTab-summary`);
  report.zoom200 = await inspectViewport(client);
  assert.strictEqual(report.zoom200.horizontalOverflow, false, '200% zoom must not overflow');
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 4 });
  report.zoom400 = await inspectViewport(client);
  assert.strictEqual(report.zoom400.horizontalOverflow, false, '400% zoom/reflow must not overflow');
  await client.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });

  await client.send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [
      { name: 'prefers-reduced-motion', value: 'reduce' },
      { name: 'prefers-contrast', value: 'more' },
      { name: 'forced-colors', value: 'active' }
    ]
  });
  report.preferences = await evaluate(client, `({
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    moreContrast: matchMedia('(prefers-contrast: more)').matches,
    forcedColors: matchMedia('(forced-colors: active)').matches,
    transitionDuration: getComputedStyle(document.querySelector('#view-guide .atlas-btn')).transitionDuration
  })`);
  assert.strictEqual(report.preferences.reducedMotion, true);
  assert.strictEqual(report.preferences.moreContrast, true);
  assert.strictEqual(report.preferences.forcedColors, true);
  await client.send('Emulation.setEmulatedMedia', { media: 'screen', features: [] });

  report.textSpacing = await evaluate(client, `(() => {
    const style = document.createElement('style');
    style.id = 'phase5-text-spacing-audit';
    style.textContent = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
    document.head.appendChild(style);
    const result = {
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      h1Visible: document.querySelector('h1').getBoundingClientRect().height > 0
    };
    style.remove();
    return result;
  })()`);
  assert.strictEqual(report.textSpacing.horizontalOverflow, false);
  assert.strictEqual(report.textSpacing.h1Visible, true);
}

async function runFailureQa(client, report) {
  process.stdout.write('QA: failures\n');
  await setViewport(client, 390);

  await client.send('Emulation.setScriptExecutionDisabled', { value: true });
  process.stdout.write('QA: no JavaScript\n');
  await navigate(client, APP_URL);
  report.failures.noJavaScript = await evaluate(client, `(() => {
    const panels = [...document.querySelectorAll('[data-guide-tab-panel]')];
    const sections = [...document.querySelectorAll('[data-guide-section-content]')];
    return {
      panels: panels.length,
      visiblePanels: panels.filter(panel => !panel.hidden && getComputedStyle(panel).display !== 'none' && panel.getAttribute('aria-hidden') === 'false').length,
      hiddenEssentialSections: sections.filter(section => section.hidden || getComputedStyle(section).display === 'none').length,
      methodology: Boolean(document.querySelector('#fontes-e-metodologia'))
    };
  })()`);
  assert.deepStrictEqual(report.failures.noJavaScript, { panels: 6, visiblePanels: 6, hiddenEssentialSections: 0, methodology: true });
  await client.send('Emulation.setScriptExecutionDisabled', { value: false });

  await client.send('Network.setBlockedURLs', { urls: ['*/js/re5-guide-enhance.a30a6622.js'] });
  process.stdout.write('QA: hydration script failure\n');
  await navigate(client, APP_URL);
  await delay(300);
  report.failures.hydrationScript = await evaluate(client, `({
    linear: !document.documentElement.classList.contains('re5-js'),
    visiblePanels: [...document.querySelectorAll('[data-guide-tab-panel]')].filter(panel => getComputedStyle(panel).display !== 'none').length,
    h1: Boolean(document.querySelector('h1'))
  })`);
  assert.deepStrictEqual(report.failures.hydrationScript, { linear: true, visiblePanels: 6, h1: true });

  await client.send('Network.setBlockedURLs', { urls: ['*/api/*', '*/jogo/*/comments*'] });
  process.stdout.write('QA: API/comments failure\n');
  await navigate(client, APP_URL);
  report.failures.apiAndComments = await evaluate(client, `({
    h1: Boolean(document.querySelector('h1')),
    tabs: document.querySelectorAll('#guideLayerNav [role="tab"]').length,
    checklist: document.querySelectorAll('[data-trophy-id]').length,
    comments: Boolean(document.querySelector('[data-guide-comments]'))
  })`);
  assert.deepStrictEqual(report.failures.apiAndComments, { h1: true, tabs: 6, checklist: 51, comments: true });

  const storageOverride = await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });`
  });
  await client.send('Network.setBlockedURLs', { urls: ['http://0.invalid/never'] });
  process.stdout.write('QA: localStorage failure\n');
  await navigate(client, `${APP_URL}#guideTab-checklist`);
  report.failures.localStorage = await evaluate(client, `(() => {
    const button = document.querySelector('[data-trophy-toggle]');
    const before = button.getAttribute('aria-pressed');
    button.click();
    return {
      before,
      after: button.getAttribute('aria-pressed'),
      status: document.querySelector('#toast').textContent,
      ready: document.documentElement.classList.contains('re5-ready')
    };
  })()`);
  assert.notStrictEqual(report.failures.localStorage.after, report.failures.localStorage.before);
  assert.strictEqual(report.failures.localStorage.ready, true);
  await client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: storageOverride.identifier });

  await client.send('Network.setBlockedURLs', { urls: ['*steamstatic*', '*steamcdn*'] });
  process.stdout.write('QA: cover failure\n');
  await navigate(client, APP_URL);
  report.failures.cover = await evaluate(client, `(() => {
    const cover = document.querySelector('.atlas-guide-cover');
    const image = cover?.querySelector('.atlas-guide-cover__image');
    return {
      h1: Boolean(document.querySelector('h1')),
      fallback: Boolean(cover?.classList.contains('atlas-guide-cover--fallback-visible') || image?.hidden)
    };
  })()`);
  assert.strictEqual(report.failures.cover.h1, true);

  await client.send('Network.setBlockedURLs', { urls: ['*/assets/guides/resident-evil-5/score-stars-route.svg'] });
  process.stdout.write('QA: SVG failure\n');
  await navigate(client, `${APP_URL}#guideTab-dlc`);
  await evaluate(client, `document.querySelector('#re5-visual-score-stars-route')?.scrollIntoView()`);
  await delay(500);
  report.failures.svg = await evaluate(client, `(() => {
    const figure = document.querySelector('#re5-visual-score-stars-route');
    return {
      fallbackText: figure?.querySelector('.atlas-instructional-visual__fallback')?.textContent.trim().length || 0,
      caption: figure?.querySelector('figcaption')?.textContent.trim().length || 0,
      guideUsable: Boolean(document.querySelector('#guideLayerNav'))
    };
  })()`);
  assert(report.failures.svg.fallbackText > 30 && report.failures.svg.caption > 10 && report.failures.svg.guideUsable);

  await client.send('Network.setBlockedURLs', { urls: ['*psnprofiles.com*'] });
  process.stdout.write('QA: external link failure\n');
  report.failures.externalLink = await evaluate(client, `(async () => {
    const link = document.querySelector('#fontes-e-metodologia a[href*="psnprofiles.com"]');
    try { await fetch(link.href); } catch (_error) {}
    return { h1: Boolean(document.querySelector('h1')), methodology: Boolean(document.querySelector('#fontes-e-metodologia')) };
  })()`);
  assert.deepStrictEqual(report.failures.externalLink, { h1: true, methodology: true });

  await client.send('Network.setBlockedURLs', { urls: ['http://0.invalid/never'] });
  process.stdout.write('QA: slow connection\n');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 350,
    downloadThroughput: 300 * 1024 / 8,
    uploadThroughput: 150 * 1024 / 8,
    connectionType: 'cellular3g'
  });
  const slowStarted = Date.now();
  await navigate(client, APP_URL, 45000);
  report.failures.slowConnection = {
    elapsedMs: Date.now() - slowStarted,
    ...(await evaluate(client, `({
      h1: Boolean(document.querySelector('h1')),
      tabs: document.querySelectorAll('#guideLayerNav [role="tab"]').length,
      ready: document.documentElement.classList.contains('re5-ready')
    })`))
  };
  assert(report.failures.slowConnection.h1 && report.failures.slowConnection.tabs === 6);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });
  await client.send('Network.setBlockedURLs', { urls: ['http://0.invalid/never'] });
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const targets = await fetch(CDP_LIST_URL).then(response => response.json());
  const target = targets.find(item => item.type === 'page' && item.url === 'about:blank')
    || targets.find(item => item.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('No Edge CDP page target available');

  const client = new CdpClient(target.webSocketDebuggerUrl);
  const normalDiagnostics = { consoleErrors: [], exceptions: [], failedRequests: [] };
  let collectNormalDiagnostics = true;
  client.on('Runtime.exceptionThrown', event => {
    if (collectNormalDiagnostics) normalDiagnostics.exceptions.push(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || 'unknown');
  });
  client.on('Log.entryAdded', ({ entry }) => {
    if (collectNormalDiagnostics && entry?.level === 'error') normalDiagnostics.consoleErrors.push(entry.text || '');
  });
  client.on('Network.loadingFailed', event => {
    if (collectNormalDiagnostics && !event.canceled) normalDiagnostics.failedRequests.push(event.errorText || '');
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
    browser: 'Microsoft Edge headless via local CDP (in-app browser unavailable: missing sandboxPolicy)',
    viewports: [],
    screenshots: [],
    keyboard: {},
    deepLinks: {},
    checklist: {},
    filters: {},
    accordion: {},
    zoom200: {},
    zoom400: {},
    preferences: {},
    textSpacing: {},
    failures: {},
    normalDiagnostics
  };

  try {
    await runNormalQa(client, report);
    collectNormalDiagnostics = false;
    assert.deepStrictEqual(normalDiagnostics.exceptions, [], 'Normal QA must not throw browser exceptions');
    assert.deepStrictEqual(normalDiagnostics.consoleErrors, [], 'Normal QA must not log site errors');
    assert.deepStrictEqual(normalDiagnostics.failedRequests, [], 'Normal QA must not fail network requests');
    await runFailureQa(client, report);
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`Phase 5 browser QA passed: ${REPORT_PATH}\n`);
  } finally {
    client.close();
  }
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
