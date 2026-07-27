const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../src/app');
const env = require('../src/config/env');

let baseUrl;
let server;

before(async () => {
  const app = createApp({
    beforeNotFound(testApp) {
      testApp.get('/__test/error', () => {
        throw new Error('erro de teste');
      });
    }
  });

  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

test('homepage temporária retorna 200 e contém somente navegação válida', async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(html, /AtlasAchievement está sendo reconstruído\./);
  assert.match(html, /guias de troféus, roadmaps e checklists/i);
  assert.doesNotMatch(html, /href=["']#/);
});

test('health check é independente do banco de dados', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    status: 'ok',
    service: 'atlasachievement',
    database: 'preserved-not-required'
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('rotas públicas antigas retornam 404 real', async () => {
  const legacyRoutes = [
    '/catalogo',
    '/biblioteca',
    '/jogo/resident-evil-5',
    '/colecoes/primeira-platina',
    '/sobre',
    '/admin'
  ];

  for (const route of legacyRoutes) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 404, route);
    assert.match(await response.text(), /noindex,nofollow/);
  }
});

test('APIs antigas estão desativadas e respondem 404 em JSON', async () => {
  const response = await fetch(`${baseUrl}/api/games`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'API_NOT_FOUND');
});

test('código e assets legados não são servidos', async () => {
  const legacyAssets = [
    '/js/app.js',
    '/shared/guideRendererV2.js',
    '/assets/games/resident-evil-5/cover.jpg',
    '/data/guides/manifest.json'
  ];

  for (const asset of legacyAssets) {
    const response = await fetch(`${baseUrl}${asset}`);
    assert.equal(response.status, 404, asset);
  }
});

test('assets mínimos são servidos', async () => {
  const assets = [
    '/assets/site.css',
    '/assets/brand/atlasachievement-logo.png',
    '/favicon.svg',
    '/site.webmanifest'
  ];

  for (const asset of assets) {
    const response = await fetch(`${baseUrl}${asset}`);
    assert.equal(response.status, 200, asset);
  }
});

test('página de indisponibilidade retorna 503', async () => {
  const response = await fetch(`${baseUrl}/indisponivel`);
  const html = await response.text();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '3600');
  assert.match(html, /temporariamente indisponível/);
});

test('erros internos retornam 500 sem expor detalhes', async () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const response = await fetch(`${baseUrl}/__test/error`);
    const html = await response.text();

    assert.equal(response.status, 500);
    assert.match(html, /Não foi possível carregar esta página/);
    assert.doesNotMatch(html, /erro de teste/);
  } finally {
    console.error = originalConsoleError;
  }
});

test('SEO temporário indexa apenas a homepage', async () => {
  const [robotsResponse, sitemapResponse] = await Promise.all([
    fetch(`${baseUrl}/robots.txt`),
    fetch(`${baseUrl}/sitemap.xml`)
  ]);
  const robots = await robotsResponse.text();
  const sitemap = await sitemapResponse.text();

  assert.equal(robotsResponse.status, 200);
  assert.match(robots, /Allow: \/\$/);
  assert.match(robots, /Disallow: \//);
  assert.equal(sitemapResponse.status, 200);
  assert.ok(sitemap.includes(`<loc>${env.canonicalOrigin}/</loc>`));
  assert.doesNotMatch(sitemap, /catalogo|biblioteca|jogo/);
});

test('headers essenciais de segurança estão ativos', async () => {
  const response = await fetch(`${baseUrl}/`);

  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
});
