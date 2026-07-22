const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'artifacts', 're5-phase3');
const APP_URL = process.env.RE5_QA_URL || 'http://127.0.0.1:3210/jogo/resident-evil-5';
const APP_ORIGIN = new URL(APP_URL).origin;
const CDP_LIST_URL = process.env.RE5_QA_CDP_LIST_URL || 'http://127.0.0.1:9333/json/list';
const BREAKPOINTS = [360, 390, 768, 1280];
const SCREENSHOT_BREAKPOINTS = new Set(BREAKPOINTS);
const SCREENSHOT_VISUAL_IDS = new Set([
  're5-visual-score-stars-route',
  're5-visual-agitator-triggers'
]);

function logProgress(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
}
const VISUALS = [
  {
    id: 're5-visual-score-stars-route',
    file: 'score-stars',
    tab: 'dlc'
  },
  {
    id: 're5-visual-agitator-triggers',
    file: 'agitators',
    tab: 'dlc'
  },
  {
    id: 're5-visual-bsaa-29-container',
    file: 'bsaa-29',
    tab: 'extras',
    toggle: 'extras-bsaa-emblems'
  },
  {
    id: 're5-visual-heart-of-africa',
    file: 'heart-of-africa',
    tab: 'extras',
    toggle: 'extras-tesouros'
  },
  {
    id: 're5-visual-wesker-volcano',
    file: 'wesker-volcano',
    tab: 'extras',
    toggle: 'extras-bosses-critical-encounters'
  }
];

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
      const listeners = this.listeners.get(message.method) || [];
      listeners.forEach(listener => listener(message.params || {}));
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
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  }
  return result.result?.value;
}

async function waitFor(client, expression, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`Timeout waiting for: ${expression}`);
}

async function clickExact(client, selector) {
  const result = await evaluate(client, `(() => {
    const nodes = document.querySelectorAll(${JSON.stringify(selector)});
    if (nodes.length !== 1) return { count: nodes.length, clicked: false };
    nodes[0].click();
    return { count: 1, clicked: true };
  })()`);
  if (!result?.clicked) throw new Error(`Expected one clickable node for ${selector}, found ${result?.count}`);
  await delay(120);
}

async function openTab(client, tab) {
  const selector = `#guideTabButton-${tab}`;
  const selected = await evaluate(client, `document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-selected') === 'true'`);
  if (!selected) await clickExact(client, selector);
  await waitFor(client, `document.querySelector('#guideTab-${tab}')?.hidden === false`);
}

async function openToggle(client, toggle) {
  const selector = `[data-guide-section-toggle="${toggle}"]`;
  const expanded = await evaluate(client, `document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-expanded') === 'true'`);
  if (!expanded) await clickExact(client, selector);
  await waitFor(client, `document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-expanded') === 'true'`);
}

async function inspectLayout(client) {
  return evaluate(client, `(() => {
    const root = document.documentElement;
    const visuals = [...document.querySelectorAll('[data-instructional-visual]')];
    const ids = visuals.map(node => node.id);
    return {
      viewport: window.innerWidth,
      documentClientWidth: root.clientWidth,
      documentScrollWidth: root.scrollWidth,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      visualCount: visuals.length,
      uniqueVisualCount: new Set(ids).size,
      duplicateDocumentIds: [...new Set([...document.querySelectorAll('[id]')].map(node => node.id).filter((id, index, all) => all.indexOf(id) !== index))],
      visualLinksKeyboardReachable: visuals.every(node => {
        const link = node.querySelector('.atlas-instructional-visual__link');
        return link instanceof HTMLAnchorElement && link.tabIndex === 0 && link.getAttribute('href')?.startsWith('#');
      }),
      reducedMotionSafe: visuals.every(node => {
        const style = getComputedStyle(node);
        const transitionsStopped = style.transitionDuration.split(',').every(value => Number.parseFloat(value) === 0);
        const animationsStopped = style.animationDuration.split(',').every(value => Number.parseFloat(value) === 0);
        return style.animationName === 'none' && transitionsStopped && animationsStopped;
      }),
      mobileLayouts: visuals.map(node => {
        const layout = node.querySelector('[data-instructional-mobile-layout]');
        const visible = Boolean(layout && getComputedStyle(layout).display !== 'none');
        const textNodes = visible ? [...layout.querySelectorAll('h5, li')] : [];
        return {
          id: node.id,
          visible,
          minTextCssPx: textNodes.length ? Math.min(...textNodes.map(item => Number.parseFloat(getComputedStyle(item).fontSize))) : 0
        };
      }),
      images: visuals.map(node => {
        const image = node.querySelector('img');
        return {
          id: node.id,
          src: image?.getAttribute('src') || '',
          currentSrc: image?.currentSrc || '',
          complete: Boolean(image?.complete),
          naturalWidth: Number(image?.naturalWidth || 0),
          renderedWidth: Number(image?.getBoundingClientRect().width || 0),
          renderedHeight: Number(image?.getBoundingClientRect().height || 0),
          alt: image?.getAttribute('alt') || '',
          width: image?.getAttribute('width') || '',
          height: image?.getAttribute('height') || '',
          minInternalTextCssPx: image?.naturalWidth
            ? Number((16 * Math.min(1, image.getBoundingClientRect().width / image.naturalWidth)).toFixed(2))
            : 0
        };
      })
    };
  })()`);
}

async function revealAllModuleContainers(client) {
  await openTab(client, 'dlc');
  const viewportWidth = await evaluate(client, 'window.innerWidth');
  if (viewportWidth > 520) {
    for (const visualId of ['re5-visual-score-stars-route', 're5-visual-agitator-triggers']) {
      await evaluate(client, `document.getElementById(${JSON.stringify(visualId)})?.scrollIntoView({ block: 'center' })`);
      await waitFor(
        client,
        `(() => {
          const image = document.querySelector(${JSON.stringify(`#${visualId} img`)});
          return Boolean(image?.complete && image.naturalWidth > 0);
        })()`
      );
    }
  }
  const dlcLayout = await inspectLayout(client);
  await openTab(client, 'extras');
  for (const toggle of ['extras-bsaa-emblems', 'extras-tesouros', 'extras-bosses-critical-encounters']) {
    await openToggle(client, toggle);
  }
  const extrasLayout = await inspectLayout(client);
  return { dlcLayout, extrasLayout };
}

async function captureVisual(client, visual, width) {
  await openTab(client, visual.tab);
  if (visual.toggle) await openToggle(client, visual.toggle);
  const selector = `#${visual.id}`;
  await waitFor(client, `Boolean(document.querySelector(${JSON.stringify(selector)}))`);
  await evaluate(client, `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    node.scrollIntoView({ block: 'start', inline: 'nearest' });
    window.scrollBy({ top: -240, left: 0 });
    return true;
  })()`);
  await waitFor(client, `(() => {
    const mobile = document.querySelector(${JSON.stringify(selector + ' [data-instructional-mobile-layout]')});
    if (mobile && getComputedStyle(mobile).display !== 'none') return true;
    const image = document.querySelector(${JSON.stringify(selector + ' img')});
    return Boolean(image?.complete && image.naturalWidth > 0);
  })()`);
  await delay(180);
  const topPadding = width >= 768 && visual.id === 're5-visual-score-stars-route' ? 90 : 0;
  const clip = await evaluate(client, `(() => {
    const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return {
      x: Math.max(0, rect.left + window.scrollX),
      y: Math.max(0, rect.top + window.scrollY - ${topPadding}),
      width: Math.min(document.documentElement.scrollWidth, rect.width),
      height: rect.height + ${topPadding},
      scale: 1
    };
  })()`);
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip
  });
  const file = `${width}-${visual.file}.png`;
  fs.writeFileSync(path.join(OUTPUT_DIR, file), Buffer.from(screenshot.data, 'base64'));
  return {
    id: visual.id,
    file,
    width: Math.round(clip.width),
    height: Math.round(clip.height)
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const targets = await fetch(CDP_LIST_URL).then(response => response.json());
  const target = targets.find(item => item.type === 'page' && item.url.startsWith(APP_URL))
    || targets.find(item => item.type === 'page' && item.url.startsWith(`${APP_ORIGIN}/jogo/`))
    || targets.find(item => item.type === 'page' && item.url === 'about:blank');
  if (!target?.webSocketDebuggerUrl) throw new Error('No Edge CDP page target available');

  const client = new CdpClient(target.webSocketDebuggerUrl);
  const diagnostics = {
    logErrors: [],
    exceptions: [],
    networkFailures: []
  };
  client.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level === 'error' || entry?.source === 'security') diagnostics.logErrors.push(entry);
  });
  client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    diagnostics.exceptions.push(exceptionDetails);
  });
  client.on('Network.loadingFailed', failure => {
    if (!failure?.canceled) diagnostics.networkFailures.push(failure);
  });

  await client.connect();
  logProgress(`QA connected: ${target.url}`);
  await Promise.all([
    client.send('Page.enable'),
    client.send('Runtime.enable'),
    client.send('Log.enable'),
    client.send('Network.enable')
  ]);
  await client.send('Log.clear');

  const ssrHtml = await fetch(APP_URL).then(response => response.text());
  const apiGame = await fetch(`${APP_ORIGIN}/api/games/slug/resident-evil-5`).then(response => response.json());
  const report = {
    generatedAt: new Date().toISOString(),
    url: APP_URL,
    ssrVisualCount: (ssrHtml.match(/data-instructional-visual=/g) || []).length,
    apiVisualCount: apiGame?.instructionalVisuals?.length || apiGame?.game?.instructionalVisuals?.length || 0,
    breakpoints: [],
    screenshots: [],
    diagnostics
  };

  for (const width of BREAKPOINTS) {
    logProgress(`QA viewport ${width}px`);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768,
      screenWidth: width,
      screenHeight: 900
    });
    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await client.send('Page.navigate', { url: APP_URL });
    await waitFor(client, `document.readyState === 'complete'`);
    await waitFor(client, `document.querySelectorAll('[data-instructional-visual]').length === 5`);
    await delay(800);

    const initialLayout = await inspectLayout(client);
    const tabLayouts = await revealAllModuleContainers(client);
    logProgress(`QA layout ${width}px ready`);
    report.breakpoints.push({
      width,
      initialLayout,
      dlcLayout: tabLayouts.dlcLayout,
      extrasLayout: tabLayouts.extrasLayout
    });

    if (SCREENSHOT_BREAKPOINTS.has(width)) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1700,
        deviceScaleFactor: 1,
        mobile: width < 768,
        screenWidth: width,
        screenHeight: 1700
      });
      for (const visual of VISUALS.filter(item => SCREENSHOT_VISUAL_IDS.has(item.id))) {
        logProgress(`QA screenshot ${width}px ${visual.id}`);
        report.screenshots.push(await captureVisual(client, visual, width));
      }
    }
  }

  await client.send('Page.navigate', { url: `${APP_ORIGIN}/jogo/resident-evil-6` });
  await waitFor(client, `document.readyState === 'complete'`);
  await delay(500);
  report.nonRe5VisualCount = await evaluate(client, `document.querySelectorAll('[data-instructional-visual]').length`);

  assert.strictEqual(report.ssrVisualCount, 5, 'SSR deve conter cinco figuras instrucionais');
  assert.strictEqual(report.apiVisualCount, 5, 'API deve conter cinco figuras instrucionais');
  assert.strictEqual(report.screenshots.length, 8, 'Devem existir oito screenshots dos dois diagramas prioritários');
  assert.strictEqual(report.nonRe5VisualCount, 0, 'A microcorreção não pode alterar visuais de outros jogos');
  assert.deepStrictEqual(report.diagnostics.logErrors, [], 'Console não pode conter erros');
  assert.deepStrictEqual(report.diagnostics.exceptions, [], 'Página não pode lançar exceções');
  assert.deepStrictEqual(report.diagnostics.networkFailures, [], 'Assets não podem falhar na rede');

  for (const breakpoint of report.breakpoints) {
    const layout = breakpoint.dlcLayout;
    assert.strictEqual(layout.horizontalOverflow, false, `${breakpoint.width}px não pode ter overflow horizontal`);
    assert.strictEqual(layout.visualCount, 5, `${breakpoint.width}px deve manter cinco figuras no DOM hidratado`);
    assert.strictEqual(layout.uniqueVisualCount, 5, `${breakpoint.width}px deve manter cinco IDs visuais únicos`);
    assert.deepStrictEqual(layout.duplicateDocumentIds, [], `${breakpoint.width}px não pode conter IDs duplicados`);
    assert.strictEqual(layout.visualLinksKeyboardReachable, true, `${breakpoint.width}px deve manter os links acessíveis por teclado`);
    assert.strictEqual(layout.reducedMotionSafe, true, `${breakpoint.width}px deve respeitar prefers-reduced-motion`);

    const priorityIds = ['re5-visual-score-stars-route', 're5-visual-agitator-triggers'];
    const priorityMobileLayouts = layout.mobileLayouts.filter(entry => priorityIds.includes(entry.id));

    if (breakpoint.width <= 520) {
      assert.strictEqual(priorityMobileLayouts.length, 2, `${breakpoint.width}px deve expor duas variantes mobile`);
      assert.strictEqual(
        priorityMobileLayouts.every(entry => entry.visible && entry.minTextCssPx >= 16),
        true,
        `${breakpoint.width}px deve manter texto essencial com pelo menos 16 CSS px`
      );
    } else {
      assert.strictEqual(
        priorityMobileLayouts.every(entry => !entry.visible),
        true,
        `${breakpoint.width}px deve preservar os SVGs desktop`
      );
      const priorityImages = layout.images.filter(entry => priorityIds.includes(entry.id));
      assert.strictEqual(priorityImages.length, 2, `${breakpoint.width}px deve renderizar os dois SVGs prioritários`);
      assert.strictEqual(
        priorityImages.every(entry => entry.complete && entry.naturalWidth > 0 && entry.minInternalTextCssPx >= 14),
        true,
        `${breakpoint.width}px deve manter SVGs carregados e texto interno legível`
      );
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'qa-results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  client.close();
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
