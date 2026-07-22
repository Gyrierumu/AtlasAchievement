const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'artifacts', 're5-phase4');
const APP_URL = process.env.RE5_QA_URL || 'http://127.0.0.1:4317/jogo/resident-evil-5';
const APP_ORIGIN = new URL(APP_URL).origin;
const CDP_LIST_URL = process.env.RE5_QA_CDP_LIST_URL || 'http://127.0.0.1:9334/json/list';
const BREAKPOINTS = [360, 390, 768, 1280];
const EXPECTED_DESCRIPTION = 'Guia de platina de Resident Evil 5 no PS4: 51 troféus base formam a platina, com roadmap, BSAA e Professional; 20 troféus de DLC são só para o 100%.';
const EXPECTED_CANONICAL = 'https://atlasachievement.com.br/jogo/resident-evil-5';

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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  return result.result?.value;
}

async function waitFor(client, expression, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await delay(100);
  }
  throw new Error(`Timeout waiting for: ${expression}`);
}

async function captureElement(client, selector, file, maxHeight = 1500) {
  await evaluate(client, `(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    node?.scrollIntoView({ block: 'start', inline: 'nearest' });
    window.scrollBy({ top: -20, left: 0 });
    return Boolean(node);
  })()`);
  await delay(180);
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: true
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, file), Buffer.from(screenshot.data, 'base64'));
  const viewport = await evaluate(client, `({ width: window.innerWidth, height: window.innerHeight })`);
  return { file, width: viewport.width, height: viewport.height, focus: selector, maxRequestedHeight: maxHeight };
}

async function inspectPage(client) {
  return evaluate(client, `(() => {
    const root = document.documentElement;
    const allIds = [...document.querySelectorAll('[id]')].map(node => node.id);
    const ariaReferences = [...document.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls]')]
      .flatMap(node => ['aria-labelledby', 'aria-describedby', 'aria-controls']
        .flatMap(name => (node.getAttribute(name) || '').split(/\\s+/).filter(Boolean)));
    const sourceLinks = [...document.querySelectorAll('#fontes-e-metodologia a[href^="http"]')];
    const json = JSON.parse(document.querySelector('#gameStructuredData')?.textContent || '{}');
    const graph = Array.isArray(json['@graph']) ? json['@graph'] : [];
    const article = graph.find(item => item['@type'] === 'Article');
    const faq = graph.find(item => item['@type'] === 'FAQPage');
    const topLevelIds = graph.map(item => item['@id']).filter(Boolean);
    const tabs = [...document.querySelectorAll('#guideLayerNav [role="tab"]')];
    const tabsFunctional = tabs.every(tab => {
      tab.click();
      const panel = document.getElementById(tab.getAttribute('aria-controls') || '');
      return tab.getAttribute('aria-selected') === 'true' && Boolean(panel && panel.hidden === false);
    });
    tabs[0]?.click();
    return {
      viewport: window.innerWidth,
      lang: document.documentElement.lang,
      mainCount: document.querySelectorAll('main').length,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
      h1Count: document.querySelectorAll('h1').length,
      h1Text: document.querySelector('h1')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
      tabCount: document.querySelectorAll('#guideLayerNav [role="tab"]').length,
      tabsFunctional,
      figureCount: document.querySelectorAll('[data-instructional-visual]').length,
      faqCount: document.querySelectorAll('#guideFaqPanel .atlas-faq-item').length,
      methodologyCount: document.querySelectorAll('#fontes-e-metodologia').length,
      authorityCount: document.querySelectorAll('.atlas-editorial-trust--authority').length,
      authorText: document.querySelector('.atlas-editorial-trust--authority')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
      authorHref: document.querySelector('.atlas-editorial-trust--authority a[href="/sobre"]')?.getAttribute('href') || '',
      reviewDatetime: document.querySelector('.atlas-editorial-trust--authority time')?.getAttribute('datetime') || '',
      duplicateIds: [...new Set(allIds.filter((id, index) => allIds.indexOf(id) !== index))],
      brokenAriaReferences: [...new Set(ariaReferences.filter(id => !document.getElementById(id)))],
      sourceLinks: sourceLinks.map(link => ({
        href: link.href,
        target: link.target,
        rel: link.rel
      })),
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
      twitterDescription: document.querySelector('meta[name="twitter:description"]')?.content || '',
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
      ogLocale: document.querySelector('meta[property="og:locale"]')?.content || '',
      ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
      ogImageWidth: document.querySelector('meta[property="og:image:width"]')?.content || '',
      ogImageHeight: document.querySelector('meta[property="og:image:height"]')?.content || '',
      ogImageAlt: document.querySelector('meta[property="og:image:alt"]')?.content || '',
      twitterImage: document.querySelector('meta[name="twitter:image"]')?.content || '',
      twitterImageAlt: document.querySelector('meta[name="twitter:image:alt"]')?.content || '',
      articleDateModified: article?.dateModified || '',
      articleAuthor: article?.author?.name || '',
      articleHasDatePublished: Object.hasOwn(article || {}, 'datePublished'),
      faqStructuredCount: faq?.mainEntity?.length || 0,
      graphTypes: graph.map(item => item['@type']),
      graphTopLevelIdsUnique: new Set(topLevelIds).size === topLevelIds.length
    };
  })()`);
}

async function checkExternalSource(source) {
  try {
    const response = await fetch(source.url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 AtlasAchievement editorial link audit' },
      signal: AbortSignal.timeout(20000)
    });
    return {
      id: source.id,
      url: source.url,
      finalUrl: response.url,
      status: response.status,
      notFound: response.status === 404,
      serverError: response.status >= 500
    };
  } catch (error) {
    return { id: source.id, url: source.url, error: error.message };
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const targets = await fetch(CDP_LIST_URL).then(response => response.json());
  const target = targets.find(item => item.type === 'page' && item.url.startsWith(APP_URL))
    || targets.find(item => item.type === 'page' && item.url === 'about:blank');
  if (!target?.webSocketDebuggerUrl) throw new Error('No Edge CDP page target available');

  const client = new CdpClient(target.webSocketDebuggerUrl);
  const diagnostics = { logErrors: [], exceptions: [], networkFailures: [] };
  client.on('Log.entryAdded', ({ entry }) => {
    if (entry?.level === 'error' || entry?.source === 'security') diagnostics.logErrors.push(entry);
  });
  client.on('Runtime.exceptionThrown', ({ exceptionDetails }) => diagnostics.exceptions.push(exceptionDetails));
  client.on('Network.loadingFailed', failure => {
    if (!failure?.canceled) diagnostics.networkFailures.push(failure);
  });
  await client.connect();
  await Promise.all([
    client.send('Page.enable'),
    client.send('Runtime.enable'),
    client.send('Log.enable'),
    client.send('Network.enable')
  ]);

  const ssrResponse = await fetch(APP_URL);
  const ssrHtml = await ssrResponse.text();
  const apiGame = await fetch(`${APP_ORIGIN}/api/games/slug/resident-evil-5`).then(response => response.json());
  const trackingHtml = await fetch(`${APP_URL}?utm_source=phase4-qa`).then(response => response.text());
  const trackingCanonical = trackingHtml.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || '';
  const report = {
    generatedAt: new Date().toISOString(),
    url: APP_URL,
    integratedBrowser: {
      attempted: true,
      available: false,
      fallback: 'Microsoft Edge headless via local CDP'
    },
    ssr: {
      status: ssrResponse.status,
      h1Count: (ssrHtml.match(/<h1\b/g) || []).length,
      figureCount: (ssrHtml.match(/data-instructional-visual=/g) || []).length,
      faqCount: (ssrHtml.match(/<article class="atlas-faq-item atlas-faq-row">/g) || []).length,
      methodologyCount: (ssrHtml.match(/id="fontes-e-metodologia"/g) || []).length
    },
    trackingCanonical,
    breakpoints: [],
    screenshots: [],
    diagnostics,
    externalSources: []
  };

  for (const width of BREAKPOINTS) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: width < 768,
      screenWidth: width,
      screenHeight: 1100
    });
    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await client.send('Page.navigate', { url: APP_URL });
    await waitFor(client, `document.readyState === 'complete'`);
    await waitFor(client, `document.querySelectorAll('[data-instructional-visual]').length === 5`);
    await waitFor(client, `document.querySelectorAll('#guideFaqPanel .atlas-faq-item').length === 36`);
    await delay(500);
    const layout = await inspectPage(client);
    report.breakpoints.push(layout);
    report.screenshots.push(await captureElement(client, '#guideHeader .atlas-guide-hero', `${width}-editorial-header.png`, 1400));
    report.screenshots.push(await captureElement(client, '#fontes-e-metodologia', `${width}-sources-methodology.png`, 1500));
  }

  report.externalSources = await Promise.all(apiGame.editorialAuthority.sources.map(checkExternalSource));

  assert.strictEqual(report.ssr.status, 200, 'Rota publica deve responder 200');
  assert.deepStrictEqual(report.ssr, { status: 200, h1Count: 1, figureCount: 5, faqCount: 36, methodologyCount: 1 }, 'SSR deve preservar H1, cinco figuras, 36 FAQs e metodologia');
  assert.strictEqual(report.trackingCanonical, EXPECTED_CANONICAL, 'Canonical deve ignorar query de tracking');
  assert.strictEqual(report.screenshots.length, 8, 'QA deve gerar oito screenshots');
  assert.deepStrictEqual(diagnostics.logErrors, [], 'Console não pode conter erros');
  assert.deepStrictEqual(diagnostics.exceptions, [], 'DOM não pode lançar exceções');
  assert.deepStrictEqual(diagnostics.networkFailures, [], 'Assets locais não podem falhar na rede');

  report.breakpoints.forEach(layout => {
    assert.strictEqual(layout.horizontalOverflow, false, `${layout.viewport}px não pode ter overflow horizontal`);
    assert.strictEqual(layout.lang, 'pt-BR', `${layout.viewport}px deve preservar lang pt-BR`);
    assert.strictEqual(layout.mainCount, 1, `${layout.viewport}px deve preservar o main`);
    assert.strictEqual(layout.h1Count, 1, `${layout.viewport}px deve manter H1 único`);
    assert.strictEqual(layout.h1Text, 'Resident Evil 5 — Guia de platina e troféus', `${layout.viewport}px deve preservar o H1 editorial`);
    assert.strictEqual(layout.tabCount, 6, `${layout.viewport}px deve manter seis abas`);
    assert.strictEqual(layout.tabsFunctional, true, `${layout.viewport}px deve manter seis abas funcionais`);
    assert.strictEqual(layout.figureCount, 5, `${layout.viewport}px deve manter cinco figuras hidratadas`);
    assert.strictEqual(layout.faqCount, 36, `${layout.viewport}px deve manter 36 FAQs hidratadas`);
    assert.strictEqual(layout.methodologyCount, 1, `${layout.viewport}px deve manter metodologia única`);
    assert.strictEqual(layout.authorityCount, 1, `${layout.viewport}px deve manter bloco de autoridade único`);
    assert(layout.authorText.includes('Equipe Editorial AtlasAchievement') && layout.authorText.includes('PS4/Remaster'), `${layout.viewport}px deve mostrar autoria e escopo`);
    assert.strictEqual(layout.authorHref, '/sobre', `${layout.viewport}px deve vincular autoria a Sobre`);
    assert.strictEqual(layout.reviewDatetime, '2026-07-18', `${layout.viewport}px deve manter data semântica`);
    assert.deepStrictEqual(layout.duplicateIds, [], `${layout.viewport}px não pode ter IDs duplicados`);
    assert.deepStrictEqual(layout.brokenAriaReferences, [], `${layout.viewport}px não pode ter referências ARIA quebradas`);
    assert.strictEqual(layout.sourceLinks.length, 6, `${layout.viewport}px deve manter seis fontes externas`);
    assert(layout.sourceLinks.every(link => link.target === '_blank' && link.rel.includes('noopener') && link.rel.includes('noreferrer') && !link.rel.includes('nofollow')), `${layout.viewport}px deve manter segurança e links editoriais follow`);
    assert.strictEqual(layout.description, EXPECTED_DESCRIPTION, `${layout.viewport}px deve manter meta description`);
    assert.strictEqual(layout.ogDescription, EXPECTED_DESCRIPTION, `${layout.viewport}px deve manter og:description`);
    assert.strictEqual(layout.twitterDescription, EXPECTED_DESCRIPTION, `${layout.viewport}px deve manter twitter:description`);
    assert.strictEqual(layout.canonical, EXPECTED_CANONICAL, `${layout.viewport}px deve manter canonical de produção`);
    assert.strictEqual(layout.canonicalCount, 1, `${layout.viewport}px deve manter canonical único`);
    assert.strictEqual(layout.ogLocale, 'pt_BR', `${layout.viewport}px deve manter locale pt_BR`);
    assert.strictEqual(layout.ogImage, layout.twitterImage, `${layout.viewport}px deve sincronizar imagem OG e Twitter`);
    assert(layout.ogImage.endsWith('/assets/guides/resident-evil-5/resident-evil-5-social.png'), `${layout.viewport}px deve usar imagem social local`);
    assert.strictEqual(layout.ogImageWidth, '1200', `${layout.viewport}px deve declarar largura social`);
    assert.strictEqual(layout.ogImageHeight, '630', `${layout.viewport}px deve declarar altura social`);
    assert(layout.ogImageAlt && layout.ogImageAlt === layout.twitterImageAlt, `${layout.viewport}px deve sincronizar alt social`);
    assert.strictEqual(layout.articleDateModified, '2026-07-18', `${layout.viewport}px deve sincronizar dateModified`);
    assert.strictEqual(layout.articleAuthor, 'Equipe Editorial AtlasAchievement', `${layout.viewport}px deve sincronizar autor estruturado`);
    assert.strictEqual(layout.articleHasDatePublished, false, `${layout.viewport}px não pode inventar datePublished`);
    assert.strictEqual(layout.faqStructuredCount, 36, `${layout.viewport}px deve manter 36 FAQs no JSON-LD`);
    assert.strictEqual(layout.graphTopLevelIdsUnique, true, `${layout.viewport}px deve manter IDs estruturados únicos`);
    assert(!layout.graphTypes.some(type => ['Review', 'AggregateRating', 'Product', 'SoftwareApplication', 'HowTo', 'TechArticle'].includes(type)), `${layout.viewport}px não deve usar schema indevido`);
  });

  report.externalSources.forEach(source => {
    assert(!source.error, `${source.id} deve responder ao teste de rede: ${source.error || ''}`);
    assert.strictEqual(source.notFound, false, `${source.id} não pode responder 404`);
    assert.strictEqual(source.serverError, false, `${source.id} não pode responder erro 5xx`);
    assert(/^https:\/\//.test(source.finalUrl || ''), `${source.id} deve terminar em URL HTTPS`);
  });

  fs.writeFileSync(path.join(OUTPUT_DIR, 'qa-results.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  client.close();
  console.log(JSON.stringify({
    ok: true,
    screenshots: report.screenshots.length,
    breakpoints: report.breakpoints.map(item => item.viewport),
    externalSources: report.externalSources.map(item => ({ id: item.id, status: item.status, finalUrl: item.finalUrl }))
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
