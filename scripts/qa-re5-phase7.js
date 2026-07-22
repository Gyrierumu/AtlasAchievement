const assert = require('assert');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts', 're5-phase7');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'journeys-resilience-a11y.json');
const APP_URL = process.env.RE5_QA_URL || 'http://127.0.0.1:4319/jogo/resident-evil-5';
const CDP_PORT = Number(process.env.RE5_PHASE7_CDP_PORT || (9600 + (process.pid % 200)));
const CDP_LIST_URL = `http://127.0.0.1:${CDP_PORT}/json/list`;

const JOURNEYS = [
  { id: 'new-player', label: '1 — Novo jogador', target: '.atlas-re5-hero', steps: [], timeLimitSeconds: 30 },
  { id: 'platinum-vs-100', label: '2 — Platina versus 100%', target: '#re5-versus-dlc', steps: ['a[href="#re5-versus-dlc"]'], timeLimitSeconds: 10 },
  { id: 'resume-progress', label: '3 — Retomar progresso', target: '#guideChecklistPanel', steps: ['#guideTabButton-checklist'] },
  { id: 'bsaa-29', label: '4 — BSAA Emblem #29', target: '#re5-bsaa-emblem-29', steps: ['a[href="#extras-bsaa-emblems"]'] },
  { id: 'heart-of-africa', label: '5 — Heart of Africa', target: '#re5-treasure-50-heart-of-africa', steps: ['a[href="#extras-tesouros"]'] },
  { id: 'all-dressed-up', label: '6 — All Dressed Up', target: '#re5-bonus-features-all-dressed-up', steps: ['a[href="#extras-bonus-features-outfits-figures"]'] },
  { id: 'infinite-ammo', label: '7 — Infinite Ammo', target: '#re5-bonus-features-infinite-ammo', steps: ['a[href="#extras-bonus-features-outfits-figures"]'] },
  { id: 'professional', label: '8 — Professional', target: '#guideProfessionalAiPanel', steps: ['#guideTabButton-roadmap'] },
  { id: 'score-stars', label: '9 — Score Stars', target: '#re5-lost-in-nightmares-score-stars', steps: ['a[href="#re5-lost-in-nightmares-score-stars"]'] },
  { id: 'agitators', label: '10 — Agitators', target: '#re5-desperate-escape-agitator-majini', steps: ['a[href="#re5-desperate-escape-agitator-majini"]'] },
  { id: 'versus', label: '11 — Versus', target: '#re5-versus-dlc', steps: ['a[href="#re5-versus-dlc"]'] },
  { id: 'mobile', label: '12 — Mobile 360/390 px', target: '.atlas-re5-hero', steps: [] }
];

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function findBrowser() {
  return [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].find(candidate => fs.existsSync(candidate));
}

async function waitForCdp(timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(CDP_LIST_URL);
      if (response.ok) return response.json();
    } catch (_error) { /* startup polling */ }
    await delay(150);
  }
  throw new Error(`CDP unavailable: ${CDP_LIST_URL}`);
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

async function navigate(client, url = APP_URL, enhanced = true) {
  await client.send('Page.navigate', { url });
  await waitFor(client, `document.readyState === 'complete' && Boolean(document.querySelector('#view-guide'))`);
  if (enhanced) await waitFor(client, `document.documentElement.classList.contains('re5-ready')`);
  await delay(120);
}

async function clickVisible(client, selector) {
  const result = await evaluate(client, `(() => {
    const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
    const node = nodes.find(item => item.offsetParent !== null && !item.closest('[hidden]')) || nodes[0];
    if (!node) return { clicked: false };
    node.scrollIntoView({ block: 'center' });
    node.focus();
    node.click();
    return { clicked: true, text: node.textContent.replace(/\\s+/g, ' ').trim().slice(0, 90) };
  })()`);
  assert(result.clicked, `Could not click ${selector}`);
  await delay(80);
  return result;
}

async function pressKey(client, key, code, keyCode) {
  await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: keyCode });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
}

async function runJourneys(client) {
  const results = [];
  for (const journey of JOURNEYS) {
    await navigate(client, `${APP_URL}?utm_source=google&utm_medium=organic&phase7_journey=${journey.id}`);
    const started = Date.now();
    let clicks = 0;
    for (const selector of journey.steps) { await clickVisible(client, selector); clicks += 1; }
    if (journey.input) {
      await evaluate(client, `(() => {
        const input = document.querySelector(${JSON.stringify(journey.input.selector)});
        input.value = ${JSON.stringify(journey.input.value)};
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      await delay(80);
    }
    await waitFor(client, `(() => { const n=document.querySelector(${JSON.stringify(journey.target)}); return Boolean(n && n.getBoundingClientRect().height > 0 && !n.closest('[hidden]')); })()`);
    const located = await evaluate(client, `(() => {
      const node=document.querySelector(${JSON.stringify(journey.target)});
      node.scrollIntoView({ block: 'start' });
      const rect=node.getBoundingClientRect();
      const heading=node.matches('h1,h2,h3,h4,h5,h6') ? node : node.querySelector('h1,h2,h3,h4,h5,h6');
      return {
        hash: location.hash,
        selectedTab: document.querySelector('#guideLayerNav [aria-selected="true"]')?.dataset.guideTabButton || 'summary',
        documentY: Math.round(rect.top + scrollY),
        heading: heading?.textContent.replace(/\\s+/g, ' ').trim().slice(0, 120) || '',
        visible: rect.height > 0
      };
    })()`);
    results.push({
      ...journey,
      steps: undefined,
      input: undefined,
      startPoint: 'entrada orgânica simulada na URL canônica',
      clicks,
      measuredMs: Date.now() - started,
      usedSearch: Boolean(journey.input),
      finalAnchor: journey.target,
      blocker: null,
      located
    });
  }
  return results;
}

async function runA11y(client) {
  await navigate(client);
  const semantics = await evaluate(client, `(() => {
    const levels=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>Number(h.tagName.slice(1)));
    const skipped=[]; for(let i=1;i<levels.length;i+=1) if(levels[i] > levels[i-1] + 1) skipped.push([levels[i-1],levels[i]]);
    const focusables=[...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
      .filter(n => !n.disabled && n.tabIndex >= 0);
    const hiddenFocusable=focusables.filter(n => n.closest('[aria-hidden="true"]') && n.getClientRects().length > 0).map(n=>n.id||n.textContent.trim().slice(0,40));
    return {
      lang: document.documentElement.lang,
      title: document.title,
      h1: document.querySelectorAll('h1').length,
      headingCount: levels.length,
      skippedHeadingLevels: skipped,
      landmarks: { main: document.querySelectorAll('main').length, nav: document.querySelectorAll('nav').length, header: document.querySelectorAll('header').length, footer: document.querySelectorAll('footer').length },
      skipLink: [...document.querySelectorAll('a')].find(a => /pular|conteúdo principal/i.test(a.textContent))?.getAttribute('href') || null,
      liveRegions: document.querySelectorAll('[aria-live],[role="status"],[role="alert"]').length,
      visibleLabelsMissing: [...document.querySelectorAll('input,select,textarea')].filter(n => n.offsetParent !== null && !n.labels?.length && !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby')).map(n=>n.id),
      hiddenFocusable
    };
  })()`);
  assert.strictEqual(semantics.lang, 'pt-BR');
  assert.strictEqual(semantics.h1, 1);
  assert.strictEqual(semantics.landmarks.main, 1);
  assert.strictEqual(semantics.visibleLabelsMissing.length, 0);
  assert.strictEqual(semantics.hiddenFocusable.length, 0);

  await evaluate(client, `document.querySelector('#guideTabButton-summary').focus()`);
  const tabSequence = ['summary'];
  for (let index = 0; index < 6; index += 1) {
    await pressKey(client, 'ArrowRight', 'ArrowRight', 39);
    tabSequence.push(await evaluate(client, `document.querySelector('#guideLayerNav [aria-selected="true"]')?.dataset.guideTabButton`));
  }
  assert.deepStrictEqual(tabSequence, ['summary', 'roadmap', 'checklist', 'extras', 'dlc', 'attention', 'summary']);

  await navigate(client);
  const focusVisibility = await evaluate(client, `(async () => {
    document.documentElement.style.scrollBehavior='auto';
    const targets=[...document.querySelectorAll('#view-guide a[href],#view-guide button,#view-guide input')].filter(n=>n.offsetParent!==null && !n.disabled && !n.closest('[hidden]') && n.getClientRects().length>0).slice(0,80);
    const failures=[];
    for(const node of targets){
      node.focus({ preventScroll:true }); node.scrollIntoView({ block:'center', inline:'nearest', behavior:'auto' }); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const r=node.getBoundingClientRect();
      if(r.bottom<1 || r.top>innerHeight-1 || r.right<1 || r.left>innerWidth-1) failures.push(node.id||node.textContent.trim().slice(0,40));
    }
    return { checked:targets.length, failures };
  })()`);
  assert.deepStrictEqual(focusVisibility.failures, []);
  return { semantics, tabSequence, focusVisibility };
}

async function coreState(client) {
  return evaluate(client, `(() => ({
    h1: document.querySelectorAll('h1').length,
    trophies: document.querySelectorAll('#trophyList [data-trophy-id]').length,
    faq: document.querySelectorAll('#guideFaqPanel .atlas-faq-item').length,
    tabs: document.querySelectorAll('#guideLayerNav [role="tab"]').length,
    methodology: Boolean(document.querySelector('#fontes-e-metodologia')),
    enhanced: document.documentElement.classList.contains('re5-ready'),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  }))()`);
}

async function runResilience(client) {
  const report = {};

  await client.send('Network.setBlockedURLs', { urls: ['*/api/comments*', '*/api/games/slug/*'] });
  await navigate(client);
  report.apiAndCommentsFailure = await coreState(client);
  await client.send('Network.setBlockedURLs', { urls: [] });

  await client.send('Network.setBlockedURLs', { urls: ['*/js/re5-guide-enhance.*.js'] });
  await navigate(client, `${APP_URL}?phase7_script_failure=1`, false);
  report.enhancementScriptFailure = await coreState(client);
  report.enhancementScriptFailure.visiblePanels = await evaluate(client, `[...document.querySelectorAll('[data-guide-tab-panel]')].filter(n=>!n.hidden && getComputedStyle(n).display!=='none').length`);
  await client.send('Network.setBlockedURLs', { urls: [] });

  const injection = await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('blocked','SecurityError')}});` });
  await navigate(client, `${APP_URL}?phase7_storage_blocked=1`);
  report.localStorageBlocked = await coreState(client);
  report.localStorageBlocked.tabWorks = (await clickVisible(client, '#guideTabButton-roadmap')).clicked;
  await client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier });

  await client.send('Network.setBlockedURLs', { urls: ['*steamstatic.com/*', '*/assets/guides/resident-evil-5/*.svg', '*youtube.com/*', '*youtu.be/*'] });
  await navigate(client, `${APP_URL}?phase7_media_failure=1`);
  report.coverSvgVideoFailure = await coreState(client);
  await client.send('Network.setBlockedURLs', { urls: [] });

  await client.send('Network.emulateNetworkConditions', { offline: false, latency: 180, downloadThroughput: 95000, uploadThroughput: 40000, connectionType: 'cellular3g' });
  const slowStarted = Date.now();
  await navigate(client, `${APP_URL}?phase7_slow=1`);
  report.slowNetwork = { ...(await coreState(client)), measuredMs: Date.now() - slowStarted };
  await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'none' });

  report.persistence = {};
  await navigate(client, `${APP_URL}?phase7_trophy_persistence=1#guideTab-checklist`);
  report.persistence.trophy = await evaluate(client, `(() => { const b=document.querySelector('[data-trophy-toggle]'); const before=b.getAttribute('aria-pressed'); b.click(); return { id:b.closest('[data-trophy-id]')?.dataset.trophyId, before, changed:b.getAttribute('aria-pressed') }; })()`);
  await navigate(client, `${APP_URL}?phase7_trophy_persistence=1#guideTab-checklist`);
  report.persistence.trophy.afterReload = await evaluate(client, `document.querySelector('[data-trophy-toggle]')?.getAttribute('aria-pressed')`);
  assert.strictEqual(report.persistence.trophy.afterReload, report.persistence.trophy.changed);
  await evaluate(client, `document.querySelector('[data-trophy-toggle]')?.click()`);

  await navigate(client, `${APP_URL}?phase7_persistence=1#guideTab-roadmap`);
  report.persistence.roadmap = await evaluate(client, `(() => { const b=document.querySelector('[data-roadmap-toggle]'); const before=b.getAttribute('aria-pressed'); b.click(); return { before, changed:b.getAttribute('aria-pressed') }; })()`);
  await navigate(client, `${APP_URL}?phase7_persistence=1#guideTab-roadmap`);
  report.persistence.roadmap.afterReload = await evaluate(client, `document.querySelector('[data-roadmap-toggle]')?.getAttribute('aria-pressed')`);
  assert.strictEqual(report.persistence.roadmap.afterReload, report.persistence.roadmap.changed);
  await evaluate(client, `document.querySelector('[data-roadmap-toggle]')?.click()`);

  for (const [name, state] of Object.entries(report)) {
    if (name === 'persistence') continue;
    assert.strictEqual(state.h1, 1, `${name}: H1`);
    assert.strictEqual(state.trophies, 51, `${name}: trophies`);
    assert.strictEqual(state.faq, 36, `${name}: FAQ`);
    assert.strictEqual(state.methodology, true, `${name}: methodology`);
    assert.strictEqual(state.overflow, false, `${name}: overflow`);
  }
  assert.strictEqual(report.enhancementScriptFailure.visiblePanels, 6);
  return report;
}

async function inspectIntermediateLayout(client) {
  await viewport(client, 768, 1000);
  await navigate(client, `${APP_URL}?phase7_layout=768`);
  return evaluate(client, `(() => {
    const layout=document.querySelector('.atlas-re5-hero .atlas-guide-hero__layout');
    const body=document.querySelector('.atlas-re5-hero .atlas-guide-hero__body');
    const cover=document.querySelector('.atlas-re5-hero .atlas-guide-cover--hero');
    const scope=document.querySelector('.atlas-re5-scope');
    const facts=document.querySelector('.atlas-re5-hero__facts');
    const rect=n=>{const r=n.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}};
    return { innerWidth, domNodes:document.querySelectorAll('*').length, visualViewport:{width:visualViewport.width,scale:visualViewport.scale}, layout:rect(layout), body:rect(body), cover:rect(cover), scope:rect(scope), facts:rect(facts), layoutColumns:getComputedStyle(layout).gridTemplateColumns, bodyColumns:getComputedStyle(body).gridTemplateColumns };
  })()`);
}

async function runRegressionGuides(client) {
  const guides = [
    { slug: 'inside', profile: 'curto' },
    { slug: 'resident-evil-village', profile: 'médio' },
    { slug: 'resident-evil-6', profile: 'com DLC/modos extras' }
  ];
  const origin = new URL(APP_URL).origin;
  const results = [];
  await viewport(client, 1024, 900);
  for (const guide of guides) {
    const url = `${origin}/jogo/${guide.slug}?phase7_regression=1`;
    await navigate(client, url, false);
    const before = await evaluate(client, `(() => {
      const json=document.querySelector('#gameStructuredData');
      let graphTypes=[]; try { graphTypes=(JSON.parse(json.textContent)['@graph']||[]).map(item=>item['@type']); } catch (_) {}
      return {
        h1:document.querySelectorAll('h1').length,
        tabCount:document.querySelectorAll('[role="tab"]').length,
        selectedTab:document.querySelector('[role="tab"][aria-selected="true"]')?.id||null,
        re5Body:document.body.dataset.re5Phase6||null,
        re5Css:[...document.styleSheets].some(sheet=>/re5-(?:guide|phase6)/.test(sheet.href||'')),
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
        canonical:document.querySelector('link[rel="canonical"]')?.href||'',
        graphTypes
      };
    })()`);
    let after = null;
    if (before.tabCount > 1) {
      after = await evaluate(client, `(() => { const tabs=[...document.querySelectorAll('[role="tab"]')]; tabs[1].click(); return { id:tabs[1].id, selected:tabs[1].getAttribute('aria-selected'), panelVisible:document.getElementById(tabs[1].getAttribute('aria-controls'))?.hidden===false }; })()`);
      assert.strictEqual(after.selected, 'true', `${guide.slug}: second tab must select`);
      assert.strictEqual(after.panelVisible, true, `${guide.slug}: second panel must show`);
    }
    assert.strictEqual(before.h1, 1, `${guide.slug}: one H1`);
    assert.strictEqual(before.re5Body, null, `${guide.slug}: RE5 body marker leaked`);
    assert.strictEqual(before.re5Css, false, `${guide.slug}: RE5 CSS leaked`);
    assert.strictEqual(before.overflow, false, `${guide.slug}: horizontal overflow`);
    assert(before.canonical.endsWith(`/jogo/${guide.slug}`), `${guide.slug}: canonical`);
    results.push({ ...guide, url, before, after });
  }
  return results;
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const executable = findBrowser();
  if (!executable) throw new Error('Edge/Chrome unavailable');
  const profileDir = path.join(ARTIFACT_DIR, `cdp-profile-${process.pid}`);
  fs.mkdirSync(profileDir, { recursive: true });
  const browser = spawn(executable, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-gpu', 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  let client;
  try {
    const targets = await waitForCdp();
    const target = targets.find(item => item.type === 'page' && item.url === 'about:blank') || targets.find(item => item.type === 'page');
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Network.enable')]);
    if (process.argv.includes('--layout-only')) {
      const layout = await inspectIntermediateLayout(client);
      layout.media = await evaluate(client, `(() => { const b=getComputedStyle(document.querySelector('.atlas-re5-hero .atlas-guide-hero__body')); const c=getComputedStyle(document.querySelector('.atlas-re5-hero .atlas-guide-cover--hero')); return { max560:matchMedia('(max-width: 560px)').matches, max768:matchMedia('(max-width: 768px)').matches, bodyGridColumn:b.gridColumn, coverGridColumn:c.gridColumn, coverPosition:c.position, coverTransform:c.transform, coverMargin:c.margin, coverJustifySelf:c.justifySelf }; })()`);
      const shot = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'layout-fresh-768.png'), Buffer.from(shot.data, 'base64'));
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'layout-fresh-768.json'), `${JSON.stringify(layout, null, 2)}\n`);
      process.stdout.write(`${JSON.stringify(layout, null, 2)}\n`);
      return;
    }
    await viewport(client, 390, 900);
    const report = {
      generatedAt: new Date().toISOString(),
      url: APP_URL,
      browser: `${path.basename(executable)} headless via CDP; browser integrado indisponível por sandboxPolicy ausente`,
      journeys: await runJourneys(client),
      accessibility: await runA11y(client),
      resilience: await runResilience(client),
      intermediateLayout: await inspectIntermediateLayout(client),
      regressions: await runRegressionGuides(client)
    };
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`Phase 7 journeys/resilience/a11y passed: ${REPORT_PATH}\n`);
  } finally {
    client?.close();
    if (!browser.killed) browser.kill('SIGKILL');
    if (process.platform === 'win32' && browser.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    await delay(250);
    fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  }
}

main().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
