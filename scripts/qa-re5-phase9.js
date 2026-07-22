'use strict';

const assert = require('assert');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT, delay, startAuditServer, stopAuditServer, ensureArtifactDir } = require('./re5-audit-utils');

const PORT = Number(process.env.RE5_PHASE9_QA_PORT || (4590 + (process.pid % 100)));
const CDP_PORT = Number(process.env.RE5_PHASE9_CDP_PORT || (9900 + (process.pid % 80)));
const BASE_URL = `http://127.0.0.1:${PORT}`;
const GUIDE_URL = `${BASE_URL}/jogo/resident-evil-5`;
const ARTIFACT_DIR = ensureArtifactDir();
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function findBrowser() {
  return [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].find(candidate => fs.existsSync(candidate));
}

class CdpClient {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); }
  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
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
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 40000);
      this.pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { if (this.socket?.readyState < 2) this.socket.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

async function waitFor(client, expression, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`Timeout: ${expression}`);
}

async function navigate(client, url) {
  await client.send('Page.navigate', { url });
  await waitFor(client, `document.readyState==='complete' && Boolean(document.querySelector('#view-guide'))`);
  await delay(250);
}

async function viewport(client, width, height) {
  await client.send('Emulation.setDeviceMetricsOverride', { width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile: width < 768 });
}

async function screenshot(client, filename) {
  const capture = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  const target = path.join(SCREENSHOT_DIR, filename);
  fs.writeFileSync(target, Buffer.from(capture.data, 'base64'));
  return path.relative(ROOT, target).replace(/\\/g, '/');
}

async function openFeedback(client, slug) {
  await evaluate(client, `(() => {
    const candidates=[...document.querySelectorAll(${JSON.stringify(slug === 'resident-evil-5' ? '[data-guide-action="feedback"],[data-guide-feedback-open]' : '[data-guide-feedback-open],[data-guide-action="feedback"]')})];
    const button=candidates.find(node=>node.offsetParent!==null)||candidates[0];
    if(!button) return false;
    button.scrollIntoView({block:'center'}); button.click(); return true;
  })()`);
  await waitFor(client, `Boolean(window.AppFeedback && window.AtlasModalFactories)`);
  await delay(500);
  const openedByButton = await evaluate(client, `Boolean(document.querySelector('#feedbackModal:not([hidden])'))`);
  if (!openedByButton) {
    await evaluate(client, `window.AppFeedback.openGuideFeedback({slug:${JSON.stringify(slug)},gameName:${JSON.stringify(slug === 'resident-evil-5' ? 'Resident Evil 5' : 'INSIDE')},section:'summary'})`);
  }
  await waitFor(client, `Boolean(document.querySelector('#feedbackModal:not([hidden])'))`, 5000);
  if (slug === 'resident-evil-5') await waitFor(client, `Boolean(document.querySelector('#feedbackRe5Governance:not([hidden])'))`);
  return { openedByButton };
}

async function waitForCdp() {
  const url = `http://127.0.0.1:${CDP_PORT}/json/list`;
  const started = Date.now();
  while (Date.now() - started < 25000) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (_error) { /* navegador iniciando */ }
    await delay(120);
  }
  throw new Error('CDP indisponível');
}

async function main() {
  const executable = findBrowser();
  assert(executable, 'Edge/Chrome indisponível');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-re5-phase9-browser-'));
  const browser = spawn(executable, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-gpu', 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  let server;
  let client;
  try {
    server = await startAuditServer(PORT);
    const targets = await waitForCdp();
    const target = targets.find(item => item.type === 'page');
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable')]);

    await viewport(client, 1440, 1000);
    await navigate(client, `${GUIDE_URL}?utm_source=nao_deve_ser_coletado#guideTab-dlc`);
    await evaluate(client, `document.querySelector('#guideTabButton-dlc')?.click()`);
    await openFeedback(client, 'resident-evil-5');
    const desktop = await evaluate(client, `(() => {
      const ids=['feedbackCategory','feedbackSectionAnchor','feedbackPlatformVersion','feedbackSourceUrl','feedbackGuideSlug','feedbackFrontendVersion','feedbackReportDate','feedbackViewportBucket','feedbackActiveTab'];
      const labels=[...document.querySelectorAll('#feedbackRe5Governance label')];
      return {
        fields:Object.fromEntries(ids.map(id=>[id,document.getElementById(id)?.value||''])),
        labels:labels.map(label=>label.textContent.replace(/\s+/g,' ').trim()),
        pageUrl:document.querySelector('#feedbackPageUrl')?.value,
        message:document.querySelector('#feedbackMessage')?.value,
        sourceRequestBefore:performance.getEntriesByType('resource').filter(item=>item.name.includes('example.org')).length,
        visible:!document.querySelector('#feedbackRe5Governance').hidden,
        noChecklistFields:![...document.querySelectorAll('#feedbackForm input,#feedbackForm textarea,#feedbackForm select')].some(node=>/completed|trophyProgress|checklistState/i.test(node.id||node.name||'')),
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
        config:window.AtlasRe5ProductionConfig
      };
    })()`);
    assert.strictEqual(desktop.visible, true);
    assert.strictEqual(desktop.fields.feedbackGuideSlug, 'resident-evil-5');
    assert.strictEqual(desktop.fields.feedbackPlatformVersion, 'PS4/Remaster');
    assert.strictEqual(desktop.fields.feedbackViewportBucket, 'large');
    assert.strictEqual(desktop.fields.feedbackActiveTab, 'dlc');
    assert.strictEqual(desktop.pageUrl, `${GUIDE_URL}`);
    assert(!desktop.message.includes('utm_source'));
    assert.strictEqual(desktop.noChecklistFields, true);
    assert.strictEqual(desktop.overflow, false);
    await evaluate(client, `document.querySelector('#feedbackSourceUrl').value='https://example.org/evidencia'; document.querySelector('#feedbackSourceUrl').dispatchEvent(new Event('input',{bubbles:true}))`);
    await delay(250);
    desktop.sourceRequestAfter = await evaluate(client, `performance.getEntriesByType('resource').filter(item=>item.name.includes('example.org')).length`);
    assert.strictEqual(desktop.sourceRequestAfter, desktop.sourceRequestBefore);
    await evaluate(client, `document.querySelector('#feedbackRe5Governance')?.scrollIntoView({block:'center',behavior:'instant'})`);
    await delay(120);
    desktop.screenshot = await screenshot(client, 'feedback-governance-desktop-1440.png');

    desktop.missingCsrfStatus = await evaluate(client, `fetch('/api/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'Erro em guia',message:'Teste sem token que não deve persistir.'})}).then(r=>r.status)`);
    assert.strictEqual(desktop.missingCsrfStatus, 403);

    await viewport(client, 390, 844);
    await navigate(client, `${GUIDE_URL}#guideTab-attention`);
    await openFeedback(client, 'resident-evil-5');
    const mobile = await evaluate(client, `({
      viewport:document.querySelector('#feedbackViewportBucket')?.value,
      visible:!document.querySelector('#feedbackRe5Governance').hidden,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      sourceHint:document.querySelector('#feedbackSourceUrl')?.parentElement?.textContent.replace(/\s+/g,' ').trim()
    })`);
    assert.strictEqual(mobile.viewport, 'small');
    assert.strictEqual(mobile.visible, true);
    assert.strictEqual(mobile.overflow, false);
    await evaluate(client, `document.querySelector('#feedbackRe5Governance')?.scrollIntoView({block:'center',behavior:'instant'})`);
    await delay(120);
    mobile.screenshot = await screenshot(client, 'feedback-governance-mobile-390.png');

    await viewport(client, 1024, 900);
    await navigate(client, `${BASE_URL}/jogo/inside?phase9_regression=1`);
    await openFeedback(client, 'inside');
    const regression = await evaluate(client, `({
      h1:document.querySelectorAll('h1').length,
      governanceBlock:document.querySelector('#feedbackRe5Governance'),
      governanceVisible:Boolean(document.querySelector('#feedbackRe5Governance:not([hidden])')),
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
    })`);
    assert.strictEqual(regression.h1, 1);
    assert.strictEqual(regression.governanceVisible, false);
    assert.strictEqual(regression.overflow, false);

    const report = {
      lastChecked: new Date().toISOString(),
      browser: `${path.basename(executable)} headless via CDP; fallback após browser integrado indisponível`,
      desktop, mobile, regression,
      status: 'PASS'
    };
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'browser-feedback-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`Fase 9 browser feedback QA passed: ${path.join(ARTIFACT_DIR, 'browser-feedback-qa.json')}\n`);
  } finally {
    await stopAuditServer(server);
    client?.close();
    if (browser.exitCode === null) browser.kill();
    if (process.platform === 'win32' && browser.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    await delay(250);
    const resolved = path.resolve(profile);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
