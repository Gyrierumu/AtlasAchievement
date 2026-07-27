'use strict';

const assert = require('assert');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { RE5_SLUG, withTempApp } = require('./test-re5-v2-ssr');
const {
  CdpClient,
  delay,
  evaluate,
  findBrowser,
  setViewport,
  waitFor
} = require('./test-re5-v2-visual');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(ROOT, 'tmp', 're5-v2-performance');
const PAGE_PATH = `/jogo/${RE5_SLUG}`;

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] || 0;
}

async function fetchHtml(baseUrl, mode) {
  process.env.GUIDE_V2_ENABLED_SLUGS = mode === 'v2' ? RE5_SLUG : '';
  const started = performance.now();
  const response = await fetch(`${baseUrl}${PAGE_PATH}?performance=${mode}-${Date.now()}`, {
    headers: { accept: 'text/html' },
    signal: AbortSignal.timeout(30000)
  });
  const html = await response.text();
  return {
    status: response.status,
    sourceMode: response.headers.get('x-guide-source-mode'),
    milliseconds: performance.now() - started,
    html
  };
}

async function measureHttp(baseUrl, mode) {
  await fetchHtml(baseUrl, mode);
  const samples = [];
  let last;
  for (let index = 0; index < 7; index += 1) {
    last = await fetchHtml(baseUrl, mode);
    samples.push(last.milliseconds);
  }
  assert.strictEqual(last.status, 200);
  if (mode === 'v2') assert.strictEqual(last.sourceMode, 'v2');
  else assert.notStrictEqual(last.sourceMode, 'v2');

  const htmlBytes = Buffer.byteLength(last.html);
  const gzipBytes = zlib.gzipSync(last.html, { level: 9 }).length;
  const assetPaths = [...new Set(
    [...last.html.matchAll(/(?:href|src)="(\/(?:css|js)\/[^"]+)"/g)].map(match => match[1])
  )];
  const assets = [];
  for (const assetPath of assetPaths) {
    const response = await fetch(`${baseUrl}${assetPath}`, {
      signal: AbortSignal.timeout(30000)
    });
    const body = Buffer.from(await response.arrayBuffer());
    assert.strictEqual(response.status, 200, assetPath);
    assets.push({
      path: assetPath,
      type: assetPath.includes('/css/') ? 'css' : 'script',
      bytes: body.length,
      gzipBytes: zlib.gzipSync(body, { level: 9 }).length
    });
  }
  return {
    ssrMedianMs: Math.round(percentile(samples, 0.5) * 100) / 100,
    ssrP95Ms: Math.round(percentile(samples, 0.95) * 100) / 100,
    htmlBytes,
    gzipBytes,
    assetRequests: assets.length,
    requestBudget: assets.length + 1,
    cssBytes: assets.filter(item => item.type === 'css').reduce((total, item) => total + item.bytes, 0),
    scriptBytes: assets.filter(item => item.type === 'script').reduce((total, item) => total + item.bytes, 0),
    assets
  };
}

function metricsToObject(metrics) {
  return Object.fromEntries((metrics || []).map(item => [item.name, item.value]));
}

async function measureBrowser(baseUrl, executable) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-re5-v2-performance-'));
  const port = 10200 + (process.pid % 300);
  const listUrl = `http://127.0.0.1:${port}/json/list`;
  const browser = spawn(executable, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  let client;
  try {
    const started = Date.now();
    let targets;
    while (Date.now() - started < 20000) {
      try {
        const response = await fetch(listUrl);
        if (response.ok) {
          targets = await response.json();
          break;
        }
      } catch (_error) {}
      await delay(150);
    }
    const target = targets?.find(item => item.type === 'page');
    assert(target?.webSocketDebuggerUrl, 'Browser performance target unavailable');
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([
      client.send('Page.enable'),
      client.send('Runtime.enable'),
      client.send('Network.enable'),
      client.send('Performance.enable')
    ]);
    await setViewport(client, { width: 1440, height: 900 });
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        window.__re5ReleaseStart = performance.now();
        window.__re5GuideInitMs = null;
        window.__re5Cls = 0;
        try {
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) window.__re5Cls += entry.value;
            }
          }).observe({ type: 'layout-shift', buffered: true });
        } catch (_error) {}
        const timer = setInterval(() => {
          const root = document.querySelector('[data-guide-v2]');
          if (root?.dataset.guideProgressInitialized === 'true') {
            window.__re5GuideInitMs = performance.now() - window.__re5ReleaseStart;
            clearInterval(timer);
          }
        }, 1);
      })();`
    });

    let requestCount = 0;
    client.on('Network.requestWillBeSent', () => {
      requestCount += 1;
    });

    async function navigateMode(mode) {
      process.env.GUIDE_V2_ENABLED_SLUGS = mode === 'v2' ? RE5_SLUG : '';
      requestCount = 0;
      await client.send('Page.navigate', {
        url: `${baseUrl}${PAGE_PATH}?browser-performance=${mode}-${Date.now()}`
      });
      await waitFor(client, mode === 'v2'
        ? "document.readyState === 'complete' && document.querySelector('[data-guide-v2]')?.dataset.guideProgressInitialized === 'true'"
        : "document.readyState === 'complete' && Boolean(document.querySelector('#view-guide'))");
      await delay(250);
      const page = await evaluate(client, `(() => {
        const navigation = performance.getEntriesByType('navigation')[0] || {};
        return {
          domNodes: document.querySelectorAll('*').length,
          parseMs: Math.max(0, (navigation.domInteractive || 0) - (navigation.responseEnd || 0)),
          domContentLoadedMs: navigation.domContentLoadedEventEnd || 0,
          loadMs: navigation.loadEventEnd || 0,
          progressInitMs: window.__re5GuideInitMs,
          cls: window.__re5Cls || 0,
          heapBytes: performance.memory?.usedJSHeapSize || null,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        };
      })()`);
      const cdp = metricsToObject((await client.send('Performance.getMetrics')).metrics);
      return {
        ...page,
        networkRequests: requestCount,
        scriptDurationMs: Math.round((cdp.ScriptDuration || 0) * 100000) / 100,
        taskDurationMs: Math.round((cdp.TaskDuration || 0) * 100000) / 100,
        layoutCount: cdp.LayoutCount || 0,
        cdpNodes: cdp.Nodes || page.domNodes,
        heapBytes: page.heapBytes || cdp.JSHeapUsedSize || null
      };
    }

    const v1 = await navigateMode('v1');
    const v2 = await navigateMode('v2');
    const apply71Ms = await evaluate(client, `(() => {
      const controls = [...document.querySelectorAll('[data-guide-progress-checkbox]')];
      const started = performance.now();
      controls.forEach(control => {
        control.checked = true;
        control.dispatchEvent(new Event('change', { bubbles: true }));
      });
      return performance.now() - started;
    })()`);
    v2.apply71Ms = Math.round(apply71Ms * 100) / 100;
    v2.completedAfterApply = await evaluate(
      client,
      "Number(document.querySelector('[data-progress-scope=\"completion\"]').getAttribute('aria-valuenow'))"
    );
    return { browser: path.basename(executable), v1, v2 };
  } finally {
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
  const executable = findBrowser();
  assert(executable, 'Chrome or Edge is required for performance validation');
  let report;
  await withTempApp(async ({ baseUrl }) => {
    const v1 = await measureHttp(baseUrl, 'v1');
    const v2 = await measureHttp(baseUrl, 'v2');
    const browser = await measureBrowser(baseUrl, executable);
    report = {
      measuredAt: new Date().toISOString(),
      runtime: process.version,
      machine: `${process.platform}-${process.arch}`,
      http: { v1, v2 },
      browser
    };
  }, { guideV2EnabledSlugs: RE5_SLUG });

  const { v1, v2 } = report.http;
  const browserV2 = report.browser.v2;
  assert(v2.ssrP95Ms <= Math.max(250, v1.ssrP95Ms * 3), 'V2 SSR latency exceeds conservative budget');
  assert(v2.htmlBytes < 1.5 * 1024 * 1024, 'V2 HTML exceeds 1.5 MiB');
  assert(v2.gzipBytes < 300 * 1024, 'V2 compressed HTML exceeds 300 KiB');
  assert(v2.requestBudget <= v1.requestBudget + 4, 'V2 adds too many page requests');
  assert(browserV2.parseMs < 500, 'V2 parse time exceeds 500 ms');
  assert(browserV2.progressInitMs < 1500, 'Progress initialization exceeds 1.5 s');
  assert(browserV2.apply71Ms < 1000, 'Applying 71 states exceeds 1 s');
  assert.strictEqual(browserV2.completedAfterApply, 71);
  assert(browserV2.cls <= 0.1, 'V2 CLS exceeds 0.1');
  assert.strictEqual(browserV2.horizontalOverflow, false);
  assert(browserV2.domNodes < 15000, 'V2 DOM exceeds 15,000 nodes');

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  console.log(JSON.stringify(report, null, 2));
  console.log(`RE5 V2 performance contract passed: ${path.relative(ROOT, ARTIFACT_DIR)}`);
  console.log('Lighthouse: unavailable in the project/runtime; CDP performance metrics were used without adding dependencies.');
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
