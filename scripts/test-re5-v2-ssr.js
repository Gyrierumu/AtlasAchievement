'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RE5_SLUG = 'resident-evil-5';
const CANONICAL_ORIGIN = 'https://atlasachievement.com.br';

function countMatches(value, pattern) {
  return (String(value || '').match(pattern) || []).length;
}

async function fetchPage(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { accept: 'text/html' },
    redirect: 'manual',
    signal: AbortSignal.timeout(30000)
  });
  return {
    response,
    html: await response.text()
  };
}

async function withTempApp(callback, options = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-re5-v2-ssr-'));
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = path.join(tempDir, 'database.sqlite');
  process.env.UPLOAD_DIR = path.join(tempDir, 'uploads');
  process.env.SESSION_CLEANUP_INTERVAL_MINUTES = '0';
  process.env.RUN_SEED_SYNC = 'true';
  process.env.CANONICAL_ORIGIN = CANONICAL_ORIGIN;
  if (options.guideV2EnabledSlugs === undefined) {
    delete process.env.GUIDE_V2_ENABLED_SLUGS;
  } else {
    process.env.GUIDE_V2_ENABLED_SLUGS = options.guideV2EnabledSlugs;
  }

  const migrate = require(path.join(ROOT, 'src', 'db', 'migrate'));
  const seed = require(path.join(ROOT, 'src', 'db', 'seed'));
  const gamesService = require(path.join(ROOT, 'src', 'services', 'games.service'));
  const app = require(path.join(ROOT, 'src', 'app'));
  const { db } = require(path.join(ROOT, 'src', 'db', 'db'));

  await migrate();
  await seed();
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    return await callback({ baseUrl, gamesService });
  } finally {
    server.closeIdleConnections?.();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
  }
}

function assertLegacyPage(page, label) {
  assert.strictEqual(page.response.status, 200, `${label}: HTTP must remain 200`);
  assert.notStrictEqual(page.response.headers.get('x-guide-source-mode'), 'v2', `${label}: source must remain legacy`);
  assert(!page.html.includes('data-guide-source="v2"'), `${label}: V2 document must not be present`);
  assert.strictEqual(countMatches(page.html, /data-v2-trophy(?:\s|>)/g), 0, `${label}: V2 trophies must not leak`);
  assert.strictEqual(countMatches(page.html, /data-guide-progress-checkbox/g), 0, `${label}: V2 controls must not leak`);
  assert(!page.html.includes('/js/guide-progress-v2.js'), `${label}: V2 client must not load`);
  assert(!page.html.includes('/js/re5-guide-progress-v2.js'), `${label}: RE5 V2 client must not load`);
  assert(page.html.includes('id="view-guide"'), `${label}: legacy shell must remain present`);
}

function assertV2Page(page) {
  const html = page.html;
  assert.strictEqual(page.response.status, 200);
  assert.strictEqual(page.response.headers.get('x-guide-source-mode'), 'v2');
  assert(html.includes('<html lang="pt-BR" data-guide-source="v2">'));
  assert(html.includes('data-guide-v2'));
  assert.strictEqual(countMatches(html, /<h1\b/g), 1);
  assert(html.includes('<h1>Resident Evil 5 — Guia de Platina e 100%'));
  assert.strictEqual(countMatches(html, /data-v2-trophy(?:\s|>)/g), 71);
  assert.strictEqual(countMatches(html, /data-v2-package(?:\s|>)/g), 4);
  assert.strictEqual(countMatches(html, /data-v2-trophy[^>]*data-package-code="base"/g), 51);
  assert.strictEqual(countMatches(html, /data-v2-trophy[^>]*data-package-code="versus"/g), 10);
  assert.strictEqual(countMatches(html, /data-v2-trophy[^>]*data-package-code="lost-in-nightmares"/g), 5);
  assert.strictEqual(countMatches(html, /data-v2-trophy[^>]*data-package-code="desperate-escape"/g), 5);
  assert.strictEqual(countMatches(html, /data-v2-roadmap-stage=/g), 9);
  assert.strictEqual(countMatches(html, /data-v2-section=/g), 31);
  assert.strictEqual(countMatches(html, /data-v2-version=/g), 2);
  assert.strictEqual(countMatches(html, /data-v2-bsaa-emblem/g), 30);
  assert.strictEqual(countMatches(html, /data-v2-treasure/g), 50);
  assert.strictEqual(countMatches(html, /data-v2-stockpile-item/g), 27);
  assert.strictEqual(countMatches(html, /data-v2-upgrade(?:\s|>)/g), 18);
  assert.strictEqual(countMatches(html, /data-v2-score-star/g), 18);
  assert.strictEqual(countMatches(html, /data-v2-agitator/g), 3);
  assert.strictEqual(countMatches(html, /data-v2-source(?:\s|>)/g), 17);
  assert(html.includes('<dt>Versão nativa</dt><dd>PS4</dd>'));
  assert(html.includes('Versão PS4 por retrocompatibilidade'));
  assert(html.includes('<dt>Lista nativa PS5</dt><dd>Não existe</dd>'));
  assert(html.includes('<dt>Autopop entre listas</dt><dd>Não se aplica</dd>'));
  assert(html.includes('Revisão factual'));
  assert.strictEqual(countMatches(html, /data-progress-scope=/g), 5);
  assert.strictEqual(countMatches(html, /role="progressbar"/g), 5);
  assert.strictEqual(countMatches(html, /data-guide-progress-checkbox/g), 71);
  assert.strictEqual(countMatches(html, /type="checkbox"/g), 71);
  assert.strictEqual(countMatches(html, /data-guide-progress-reset-package=/g), 4);
  assert.strictEqual(countMatches(html, /data-guide-progress-reset-all/g), 1);
  assert.strictEqual(countMatches(html, /data-guide-progress-live/g), 1);
  assert(!html.includes('localStorage'));
  assert.strictEqual(countMatches(html, /<script\b[^>]*\bsrc="/g), 2);
  assert(html.includes('<script src="/js/guide-progress-v2.js" defer></script>'));
  assert(html.includes('<script src="/js/re5-guide-progress-v2.js" defer></script>'));
  assert(!html.includes('re5-guide-enhance.b84f913c.js'));

  const trophyIds = [...html.matchAll(/<li id="(trophy-[^"]+)"[^>]*data-v2-trophy/g)]
    .map(match => match[1]);
  assert.strictEqual(trophyIds.length, 71);
  assert.strictEqual(new Set(trophyIds).size, 71);
  const trophyCodes = [...html.matchAll(/data-guide-progress-checkbox[^>]*data-trophy-code="([^"]*)"/g)]
    .map(match => match[1]);
  assert.strictEqual(trophyCodes.length, 71);
  assert.strictEqual(new Set(trophyCodes).size, 71);
  assert(trophyCodes.every(Boolean));
}

async function main() {
  await withTempApp(async ({ baseUrl, gamesService }) => {
    delete process.env.GUIDE_V2_ENABLED_SLUGS;
    assertLegacyPage(await fetchPage(baseUrl, `/jogo/${RE5_SLUG}`), 'missing flag');

    process.env.GUIDE_V2_ENABLED_SLUGS = '';
    assertLegacyPage(await fetchPage(baseUrl, `/jogo/${RE5_SLUG}`), 'empty flag');

    process.env.GUIDE_V2_ENABLED_SLUGS = 'resident-evil-6';
    assertLegacyPage(await fetchPage(baseUrl, `/jogo/${RE5_SLUG}`), 'other slug flag');

    process.env.GUIDE_V2_ENABLED_SLUGS = RE5_SLUG;
    const v2Page = await fetchPage(baseUrl, `/jogo/${RE5_SLUG}`);
    assertV2Page(v2Page);

    const otherGame = await fetchPage(baseUrl, '/jogo/resident-evil-6');
    assertLegacyPage(otherGame, 'other game with RE5 flag');

    const originalGetGuide = gamesService.getGuideViewModelBySlug;
    const snapshot = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'data', 'guides', 'resident-evil-5.json'),
      'utf8'
    ));
    const manifest = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'data', 'guides', 'manifest.json'),
      'utf8'
    ));
    try {
      const invalidSnapshot = JSON.parse(JSON.stringify(snapshot));
      invalidSnapshot.trophyPackages[1].expectedTrophyCount = 9;
      gamesService.getGuideViewModelBySlug = (slug, options = {}) => originalGetGuide(slug, {
        ...options,
        featureFlagEnabled: true,
        snapshot: invalidSnapshot,
        manifest,
        logger: null
      });
      assertLegacyPage(
        await fetchPage(baseUrl, `/jogo/${RE5_SLUG}`),
        'invalid snapshot fallback'
      );

      const invalidManifest = JSON.parse(JSON.stringify(manifest));
      invalidManifest.games.find(item => item.slug === RE5_SLUG).payloadHash = '0'.repeat(64);
      gamesService.getGuideViewModelBySlug = (slug, options = {}) => originalGetGuide(slug, {
        ...options,
        featureFlagEnabled: true,
        snapshot,
        manifest: invalidManifest,
        logger: null
      });
      assertLegacyPage(
        await fetchPage(baseUrl, `/jogo/${RE5_SLUG}`),
        'invalid manifest fallback'
      );
    } finally {
      gamesService.getGuideViewModelBySlug = originalGetGuide;
    }
  });

  console.log('RE5 V2 SSR contract passed');
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  ROOT,
  RE5_SLUG,
  CANONICAL_ORIGIN,
  countMatches,
  fetchPage,
  withTempApp,
  assertV2Page
};
