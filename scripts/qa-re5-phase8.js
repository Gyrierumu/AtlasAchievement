const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts', 're5-phase8');
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'production-qa.json');
const PORT = Number(process.env.RE5_PHASE8_PORT || 4320);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const GUIDE_URL = `${BASE_URL}/jogo/resident-evil-5`;
const CDP_PORT = Number(process.env.RE5_PHASE8_CDP_PORT || (9800 + (process.pid % 100)));
const CDP_LIST_URL = `http://127.0.0.1:${CDP_PORT}/json/list`;

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function findBrowser() {
  return [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].find(candidate => fs.existsSync(candidate));
}

async function waitForUrl(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (_error) { /* startup polling */ }
    await delay(150);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function startServer(overrides = {}) {
  const logs = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PORT),
      RE5_PRODUCT_ANALYTICS_ENABLED: 'false',
      RE5_CWV_ENABLED: 'false',
      RE5_ERROR_MONITORING_ENABLED: 'false',
      RE5_ADS_ENABLED: 'false',
      RE5_ADS_TEST_PLACEHOLDERS: 'false',
      ...overrides
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  child.stdout.on('data', chunk => logs.push(String(chunk)));
  child.stderr.on('data', chunk => logs.push(String(chunk)));
  try {
    await waitForUrl(`${BASE_URL}/robots.txt`);
  } catch (error) {
    child.kill();
    throw new Error(`${error.message}\n${logs.join('').slice(-2000)}`);
  }
  return { child, logs, pid: child.pid };
}

async function stopServer(server) {
  if (!server?.child || server.child.exitCode !== null) return;
  server.child.kill();
  await Promise.race([
    new Promise(resolve => server.child.once('exit', resolve)),
    delay(5000).then(() => { if (server.child.exitCode === null) server.child.kill('SIGKILL'); })
  ]);
}

class CdpClient {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); }
  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 45000);
      this.pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); }
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { if (this.socket?.readyState < 2) this.socket.close(); }
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result?.value;
}

async function waitFor(client, expression, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`Timeout waiting for ${expression}`);
}

async function viewport(client, width, height = 900) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile: width < 768
  });
}

async function navigate(client, url = GUIDE_URL, productionScript = true) {
  await client.send('Page.navigate', { url });
  await waitFor(client, `document.readyState === 'complete' && Boolean(document.querySelector('#view-guide'))`);
  await waitFor(client, `document.documentElement.classList.contains('re5-ready')`);
  if (productionScript) await waitFor(client, `document.documentElement.dataset.re5ProductionReady === 'true'`);
  await delay(120);
}

async function clickVisible(client, selector) {
  const result = await evaluate(client, `(() => {
    const nodes=[...document.querySelectorAll(${JSON.stringify(selector)})];
    const node=nodes.find(item=>item.offsetParent!==null && !item.closest('[hidden]')) || nodes[0];
    if(!node) return false;
    node.scrollIntoView({block:'center',behavior:'auto'}); node.focus(); node.click(); return true;
  })()`);
  assert(result, `Could not click ${selector}`);
  await delay(100);
}

async function screenshot(client, filename, selector = '') {
  if (selector) await evaluate(client, `(() => { document.documentElement.style.scrollBehavior='auto'; document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',behavior:'instant'}); })()`);
  await delay(80);
  const capture = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  const target = path.join(SCREENSHOT_DIR, filename);
  fs.writeFileSync(target, Buffer.from(capture.data, 'base64'));
  return path.relative(ROOT, target).replace(/\\/g, '/');
}

async function inspectCore(client) {
  return evaluate(client, `(() => ({
    h1:document.querySelectorAll('h1').length,
    trophies:document.querySelectorAll('#trophyList [data-trophy-id]').length,
    faq:document.querySelectorAll('#guideFaqPanel .atlas-faq-item').length,
    tabs:document.querySelectorAll('#guideLayerNav [role="tab"]').length,
    overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    adsScripts:[...document.scripts].map(s=>s.src).filter(src=>/googlesyndication|doubleclick|adsbygoogle/i.test(src)),
    gaScripts:[...document.scripts].map(s=>s.src).filter(src=>/googletagmanager|google-analytics/i.test(src)),
    config:window.AtlasRe5ProductionConfig,
    slots:document.querySelectorAll('[data-re5-ad-slot]').length,
    resources:performance.getEntriesByType('resource').map(e=>e.name).filter(name=>/googlesyndication|doubleclick|adsbygoogle|googletagmanager|google-analytics/i.test(name))
  }))()`);
}

async function main() {
  const browserPath = findBrowser();
  assert(browserPath, 'Edge/Chrome not found');
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-re5-phase8-'));
  const browserProcess = spawn(browserPath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });

  let server;
  let client;
  const report = { generatedAt: new Date().toISOString(), safeMode: true, realAdCalls: 0, realAdClicks: 0 };
  try {
    await waitForUrl(CDP_LIST_URL);
    const targets = await (await fetch(CDP_LIST_URL)).json();
    const target = targets.find(item => item.type === 'page');
    assert(target?.webSocketDebuggerUrl, 'CDP page target missing');
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');
    await viewport(client, 1440, 900);

    const captureScript = await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__re5Events=[];
      window.addEventListener('atlas:re5-telemetry',event=>window.__re5Events.push(event.detail));
    ` });

    server = await startServer();
    report.serverOffPid = server.pid;
    await navigate(client, `${GUIDE_URL}?phase8=flags-off`);
    report.flagsOff = await inspectCore(client);
    report.flagsOff.events = await evaluate(client, `window.__re5Events.length`);
    assert.strictEqual(report.flagsOff.config.analyticsEnabled, false);
    assert.strictEqual(report.flagsOff.config.adsEnabled, false);
    assert.strictEqual(report.flagsOff.config.placeholderMode, false);
    assert.strictEqual(report.flagsOff.slots, 0);
    assert.strictEqual(report.flagsOff.events, 0);
    assert.deepStrictEqual(report.flagsOff.adsScripts, []);
    assert.deepStrictEqual(report.flagsOff.gaScripts, []);
    assert.deepStrictEqual(report.flagsOff.resources, []);
    await stopServer(server);
    server = null;

    server = await startServer({
      RE5_PRODUCT_ANALYTICS_ENABLED: 'true',
      RE5_CWV_ENABLED: 'false',
      RE5_ERROR_MONITORING_ENABLED: 'true',
      RE5_ADS_ENABLED: 'false',
      RE5_ADS_TEST_PLACEHOLDERS: 'true'
    });
    report.serverTestPid = server.pid;

    await client.send('Network.setBlockedURLs', { urls: ['*/api/analytics/events', '*googlesyndication*', '*doubleclick*', '*adsbygoogle*'] });

    await navigate(client, `${GUIDE_URL}?phase8=consent-absent`);
    report.consentAbsent = await inspectCore(client);
    report.consentAbsent.events = await evaluate(client, `window.__re5Events.length`);
    assert.strictEqual(report.consentAbsent.events, 0);
    assert.strictEqual(report.consentAbsent.slots, 4);

    const deniedScript = await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.AtlasConsent={hasConsent:()=>false};` });
    await navigate(client, `${GUIDE_URL}?phase8=consent-denied`);
    report.consentDenied = await inspectCore(client);
    report.consentDenied.events = await evaluate(client, `window.__re5Events.length`);
    assert.strictEqual(report.consentDenied.events, 0);
    assert.strictEqual(report.consentDenied.trophies, 51);
    assert.strictEqual(report.consentDenied.tabs, 6);
    await client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: deniedScript.identifier });

    const grantedScript = await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.AtlasConsent={hasConsent:category=>category==='analytics'};
      window.__re5Errors=[];
      window.AtlasErrorMonitoring={capture:payload=>window.__re5Errors.push(payload)};
    ` });
    await navigate(client, `${GUIDE_URL}?phase8=consent-granted-test`);
    await waitFor(client, `window.__re5Events.length>=1`);
    const initialEvents = await evaluate(client, `window.__re5Events.slice()`);
    assert.strictEqual(initialEvents.filter(item => item.eventType === 'guide_view').length, 1);
    await evaluate(client, `window.AtlasRe5Production.init(); window.AtlasRe5Production.init();`);
    await delay(100);
    const afterReinit = await evaluate(client, `window.__re5Events.slice()`);
    assert.strictEqual(afterReinit.filter(item => item.eventType === 'guide_view').length, 1);

    let before = await evaluate(client, `window.__re5Events.length`);
    await clickVisible(client, '#guideTabButton-roadmap');
    let after = await evaluate(client, `window.__re5Events.length`);
    assert.strictEqual(after - before, 1, 'roadmap click must produce one event');
    assert.strictEqual(await evaluate(client, `window.__re5Events.at(-1).eventType`), 'roadmap_start');

    await clickVisible(client, '#guideTabButton-checklist');
    await evaluate(client, `(() => { const input=document.querySelector('#trophySearch'); input.value='NAO_ENVIAR_12345'; input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await waitFor(client, `window.__re5Events.some(item=>item.eventType==='guide_internal_search')`, 5000);
    const searchEvent = await evaluate(client, `window.__re5Events.findLast(item=>item.eventType==='guide_internal_search')`);
    assert(searchEvent, 'search event missing');
    assert(!JSON.stringify(searchEvent).includes('NAO_ENVIAR_12345'), 'search text leaked');
    assert(searchEvent.metadata.query_length_bucket);

    await evaluate(client, `(() => { const input=document.querySelector('#trophySearch'); input.value=''; input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await waitFor(client, `window.__re5Events.filter(item=>item.eventType==='guide_internal_search').length>=2`, 5000);

    before = await evaluate(client, `window.__re5Events.length`);
    await clickVisible(client, '#trophyList [data-trophy-toggle]');
    await waitFor(client, `window.__re5Events.some(item=>item.eventType==='checklist_first_toggle')`, 5000);
    after = await evaluate(client, `window.__re5Events.length`);
    assert.strictEqual(after - before, 1, 'checklist click must produce one event');
    const checklistEvent = await evaluate(client, `window.__re5Events.findLast(item=>item.eventType==='checklist_first_toggle')`);
    assert.strictEqual(checklistEvent.eventType, 'checklist_first_toggle');
    assert(!/trophy|platinum|re5_/i.test(JSON.stringify(checklistEvent.metadata)), 'trophy identity leaked');

    before = await evaluate(client, `window.__re5Events.length`);
    await clickVisible(client, 'button[data-checklist-density="comfortable"]');
    after = await evaluate(client, `window.__re5Events.length`);
    report.filterInteraction = await evaluate(client, `({
      event:window.__re5Events.at(-1),
      density:document.querySelector('#trophyList').dataset.checklistDensity,
      trophies:document.querySelectorAll('#trophyList [data-trophy-id]').length
    })`);
    assert.strictEqual(after - before, 1, 'density filter must produce one event');
    assert.strictEqual(report.filterInteraction.event.eventType, 'guide_filter_change');
    assert.deepStrictEqual(report.filterInteraction.event.metadata, { filter: 'density', value: 'comfortable' });
    assert.strictEqual(report.filterInteraction.density, 'comfortable');
    assert.strictEqual(report.filterInteraction.trophies, 51);

    await clickVisible(client, '#guideTabButton-summary');
    before = await evaluate(client, `window.__re5Events.length`);
    await clickVisible(client, 'a[href="#re5-versus-dlc"]');
    after = await evaluate(client, `window.__re5Events.length`);
    assert.strictEqual(after - before, 1, 'Versus click must produce one event');
    assert.strictEqual(await evaluate(client, `window.__re5Events.at(-1).eventType`), 'versus_route_open');

    report.consentGranted = await inspectCore(client);
    report.consentGranted.events = await evaluate(client, `window.__re5Events.slice()`);
    report.consentGranted.piiLeak = /NAO_ENVIAR_12345|re5_platinum|trophy_name|completed_ids|query["']?\s*:/i.test(JSON.stringify(report.consentGranted.events));
    assert.strictEqual(report.consentGranted.piiLeak, false);
    assert.deepStrictEqual(report.consentGranted.adsScripts, []);
    assert.deepStrictEqual(report.consentGranted.gaScripts, []);
    assert.deepStrictEqual(report.consentGranted.resources, []);

    await clickVisible(client, '#guideTabButton-summary');
    await evaluate(client, `document.querySelector('#guideTabButton-summary').focus()`);
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight' });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight' });
    report.keyboard = await evaluate(client, `({
      focused:document.activeElement?.id,
      roadmapVisible:document.querySelector('#guideTab-roadmap').hidden===false,
      summarySelected:document.querySelector('#guideTabButton-summary').getAttribute('aria-selected'),
      roadmapSelected:document.querySelector('#guideTabButton-roadmap').getAttribute('aria-selected')
    })`);
    assert.strictEqual(report.keyboard.focused, 'guideTabButton-roadmap');
    assert.strictEqual(report.keyboard.roadmapVisible, true);
    assert.strictEqual(report.keyboard.summarySelected, 'false');
    assert.strictEqual(report.keyboard.roadmapSelected, 'true');

    report.placeholders = await evaluate(client, `(() => {
      const slots=[...document.querySelectorAll('[data-re5-ad-slot]')];
      const prohibited=['.atlas-re5-hero','#guideLayerNav','.atlas-checklist-toolbar','label','.atlas-re5-stage-toggle','.atlas-tip-box'];
      return {
        count:slots.length,
        placements:slots.map(slot=>slot.dataset.re5AdSlot),
        labels:slots.map(slot=>slot.getAttribute('aria-label')),
        focusables:slots.reduce((sum,slot)=>sum+slot.querySelectorAll('a,button,input,select,textarea,[tabindex]').length,0),
        prohibitedParents:slots.filter(slot=>prohibited.some(selector=>slot.closest(selector))).map(slot=>slot.dataset.re5AdSlot),
        checklistSlots:document.querySelectorAll('#guideTab-checklist [data-re5-ad-slot]').length,
        adsEnabled:window.AtlasRe5ProductionConfig.adsEnabled,
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
      };
    })()`);
    assert.strictEqual(report.placeholders.count, 4);
    assert.deepStrictEqual([...report.placeholders.placements].sort(), ['dlc', 'extras', 'roadmap', 'summary']);
    assert.strictEqual(report.placeholders.focusables, 0);
    assert.deepStrictEqual(report.placeholders.prohibitedParents, []);
    assert.strictEqual(report.placeholders.checklistSlots, 0);
    assert.strictEqual(report.placeholders.adsEnabled, false);
    assert.strictEqual(report.placeholders.overflow, false);

    await viewport(client, 1440, 900);
    await clickVisible(client, '#guideTabButton-summary');
    report.desktopScreenshot = await screenshot(client, 're5-phase8-placeholder-desktop-1440.png', '#re5-ad-slot-summary');
    await viewport(client, 390, 844);
    await navigate(client, `${GUIDE_URL}?phase8=mobile-placeholder`);
    report.mobileState = await inspectCore(client);
    assert.strictEqual(report.mobileState.overflow, false);
    report.mobileScreenshot = await screenshot(client, 're5-phase8-placeholder-mobile-390.png', '#re5-ad-slot-summary');

    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 450,
      downloadThroughput: 25 * 1024,
      uploadThroughput: 12.5 * 1024,
      connectionType: 'cellular3g'
    });
    const slowStartedAt = Date.now();
    await navigate(client, `${GUIDE_URL}?phase8=slow-network-placeholder`);
    report.slowNetwork = await inspectCore(client);
    report.slowNetwork.loadElapsedMs = Date.now() - slowStartedAt;
    assert.strictEqual(report.slowNetwork.h1, 1);
    assert.strictEqual(report.slowNetwork.trophies, 51);
    assert.strictEqual(report.slowNetwork.slots, 4);
    assert.strictEqual(report.slowNetwork.overflow, false);
    assert.deepStrictEqual(report.slowNetwork.resources, []);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: 'none'
    });

    report.noFill = await evaluate(client, `(() => {
      const before=document.querySelector('#re5-ad-slot-summary').getBoundingClientRect().height;
      const changed=window.AtlasRe5Production.setAdSlotState('summary','no-fill');
      const slot=document.querySelector('#re5-ad-slot-summary');
      return {before,changed,hidden:slot.hidden,after:slot.getBoundingClientRect().height,trophies:document.querySelectorAll('#trophyList [data-trophy-id]').length};
    })()`);
    assert(report.noFill.before >= 112);
    assert.strictEqual(report.noFill.changed, true);
    assert.strictEqual(report.noFill.hidden, true);
    assert.strictEqual(report.noFill.after, 0);
    assert.strictEqual(report.noFill.trophies, 51);

    report.errorMonitoring = await evaluate(client, `(() => {
      const results=[];
      results.push(window.AtlasRe5Production.reportError('tab',{component:'tabs',message:'SECRET',token:'TOKEN'}));
      results.push(window.AtlasRe5Production.reportError('tab',{component:'tabs',message:'SECRET2'}));
      results.push(window.AtlasRe5Production.reportError('api',{component:'api'}));
      return {results,captured:window.__re5Errors};
    })()`);
    assert.deepStrictEqual(report.errorMonitoring.results, [true, false, true]);
    assert.strictEqual(report.errorMonitoring.captured.length, 2);
    assert(!/SECRET|TOKEN|message|token/i.test(JSON.stringify(report.errorMonitoring.captured)));

    await client.send('Network.setBlockedURLs', { urls: ['*/js/re5-production.js', '*/api/analytics/events', '*googlesyndication*', '*doubleclick*'] });
    await navigate(client, `${GUIDE_URL}?phase8=production-script-blocked`, false);
    report.productionScriptBlocked = await inspectCore(client);
    assert.strictEqual(report.productionScriptBlocked.h1, 1);
    assert.strictEqual(report.productionScriptBlocked.trophies, 51);
    assert.strictEqual(report.productionScriptBlocked.tabs, 6);
    assert.strictEqual(report.productionScriptBlocked.slots, 0);
    await clickVisible(client, '#guideTabButton-checklist');
    report.productionScriptBlocked.tabWorks = await evaluate(client, `document.querySelector('#guideTab-checklist').hidden===false`);
    assert.strictEqual(report.productionScriptBlocked.tabWorks, true);
    await client.send('Network.setBlockedURLs', { urls: ['*/api/analytics/events', '*googlesyndication*', '*doubleclick*', '*adsbygoogle*'] });

    await viewport(client, 1440, 900);
    const regressions = [];
    for (const slug of ['inside', 'resident-evil-village', 'resident-evil-6']) {
      await client.send('Page.navigate', { url: `${BASE_URL}/jogo/${slug}?phase8_regression=1` });
      await waitFor(client, `document.readyState==='complete' && Boolean(document.querySelector('#view-guide'))`);
      const state = await evaluate(client, `(() => ({
        slug:${JSON.stringify(slug)}, h1:document.querySelectorAll('h1').length,
        re5Script:[...document.scripts].some(s=>/re5-production\.js/.test(s.src)),
        re5Config:Boolean(window.AtlasRe5ProductionConfig),
        slots:document.querySelectorAll('[data-re5-ad-slot]').length,
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
        tabs:document.querySelectorAll('#guideLayerNav [role="tab"]').length
      }))()`);
      assert.strictEqual(state.h1, 1);
      assert.strictEqual(state.re5Script, false);
      assert.strictEqual(state.re5Config, false);
      assert.strictEqual(state.slots, 0);
      assert.strictEqual(state.overflow, false);
      regressions.push(state);
    }
    report.regressions = regressions;

    await client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: grantedScript.identifier });
    await client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: captureScript.identifier });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`Phase 8 production QA passed: ${REPORT_PATH}\n`);
  } finally {
    if (server) await stopServer(server);
    if (client) client.close();
    if (browserProcess.exitCode === null) browserProcess.kill();
    await Promise.race([
      new Promise(resolve => browserProcess.once('exit', resolve)),
      delay(1500)
    ]);
    const resolvedTemp = path.resolve(profileDir);
    if (resolvedTemp.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
      try { fs.rmSync(resolvedTemp, { recursive: true, force: true }); }
      catch (error) { process.stderr.write(`Temporary browser profile cleanup deferred: ${error.code || error.message}\n`); }
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
