'use strict';

const assert = require('assert');

const RE5_PATH = '/jogo/resident-evil-5';
const PRODUCTION_HOSTS = new Set([
  'atlasachievement.com.br',
  'www.atlasachievement.com.br'
]);

async function request(baseUrl, pathName, options = {}) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    redirect: 'manual',
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  return {
    path: pathName,
    status: response.status,
    milliseconds: Math.round((performance.now() - started) * 100) / 100,
    contentType: response.headers.get('content-type'),
    sourceMode: response.headers.get('x-guide-source-mode'),
    robots: response.headers.get('x-robots-tag'),
    text
  };
}

async function main() {
  const configured = String(process.env.STAGING_BASE_URL || '').trim();
  if (!configured) {
    console.error(JSON.stringify({
      status: 'NOT_EXECUTED',
      reason: 'STAGING_BASE_URL is not configured; no staging access was invented.'
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  const url = new URL(configured);
  assert(!PRODUCTION_HOSTS.has(url.hostname.toLowerCase()), 'Production host is forbidden in staging validation');
  assert(['http:', 'https:'].includes(url.protocol));
  const baseUrl = url.href.replace(/\/+$/, '');
  const expectedV2 = !/^(0|false|no)$/i.test(String(process.env.STAGING_EXPECT_V2 || 'true'));
  const results = [];

  for (const pathName of [
    '/api/health',
    '/',
    RE5_PATH,
    '/jogo/resident-evil-6',
    '/sitemap.xml',
    '/robots.txt'
  ]) {
    results.push(await request(baseUrl, pathName, {
      headers: { accept: pathName.endsWith('.xml') ? 'application/xml' : 'text/html' }
    }));
  }
  results.forEach(result => assert.strictEqual(result.status, 200, `${result.path} must return 200`));

  const re5 = results.find(item => item.path === RE5_PATH);
  if (expectedV2) {
    assert.strictEqual(re5.sourceMode, 'v2');
    assert.strictEqual((re5.text.match(/data-guide-progress-checkbox/g) || []).length, 71);
  } else {
    assert.notStrictEqual(re5.sourceMode, 'v2');
    assert(!re5.text.includes('/js/guide-progress-v2.js'));
  }
  const re6 = results.find(item => item.path === '/jogo/resident-evil-6');
  assert.notStrictEqual(re6.sourceMode, 'v2', 'RE6 must remain V1 in staging');
  assert(results.find(item => item.path === '/sitemap.xml').text.includes(RE5_PATH));

  const authMe = await request(baseUrl, '/api/auth/me', {
    headers: { accept: 'application/json', 'x-atlas-auth-scope': 'user' }
  });
  assert.strictEqual(authMe.status, 200);
  const authPayload = JSON.parse(authMe.text);
  assert.strictEqual(authPayload.authenticated, false);
  const anonymousProgress = await request(baseUrl, '/api/library/guides/resident-evil-5/progress', {
    headers: { accept: 'application/json' }
  });
  assert.strictEqual(anonymousProgress.status, 401);
  const notFound = await request(baseUrl, '/bloco-7-staging-404', {
    headers: { accept: 'application/json' }
  });
  assert.strictEqual(notFound.status, 404);

  console.log(JSON.stringify({
    status: 'READ_ONLY_STAGING_SMOKE_PASSED',
    artifact: process.env.APP_VERSION || process.env.COMMIT_SHA || null,
    baseUrl,
    expectedV2,
    noindexObserved: Boolean(re5.robots || /<meta[^>]+noindex/i.test(re5.text)),
    results: [...results, authMe, anonymousProgress, notFound].map(item => ({
      path: item.path,
      status: item.status,
      milliseconds: item.milliseconds,
      sourceMode: item.sourceMode,
      robots: item.robots
    }))
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
