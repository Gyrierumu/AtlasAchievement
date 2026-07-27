'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { RE5_SLUG, withTempApp } = require('./test-re5-v2-ssr');

const ROOT = path.resolve(__dirname, '..');
const PROGRESS_PATH = `/api/library/guides/${RE5_SLUG}/progress`;
const ALLOWED_EVENT_FIELDS = new Set([
  'event',
  'slug',
  'sourceMode',
  'packageCode',
  'completedCount',
  'totalCount',
  'reasonCode',
  'snapshotHash',
  'featureFlagEnabled'
]);

function createHttpClient(baseUrl) {
  let cookie = '';
  let csrfToken = '';

  function remember(response, payload) {
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const sessionCookie = setCookie
        .split(',')
        .map(item => item.trim())
        .find(item => item.startsWith('mtg.sid='));
      if (sessionCookie) cookie = sessionCookie.split(';')[0];
    }
    csrfToken = payload?.csrfToken || response.headers.get('x-csrf-token') || csrfToken;
  }

  async function request(pathName, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = {
      accept: 'application/json',
      ...(!options.rawBody ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method) && options.csrf !== false
        ? { 'x-csrf-token': csrfToken }
        : {}),
      ...(options.headers || {})
    };
    const response = await fetch(`${baseUrl}${pathName}`, {
      method,
      headers,
      body: options.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(30000)
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (_error) {}
    remember(response, payload);
    return { response, payload, text };
  }

  return {
    request,
    get cookie() {
      return cookie;
    },
    get csrfToken() {
      return csrfToken;
    }
  };
}

async function register(client, suffix) {
  const result = await client.request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: `re5-release-${suffix}`,
      email: `re5-release-${suffix}@example.com`,
      password: 'senha-release-123',
      display_name: `Release ${suffix}`
    }),
    headers: { 'x-atlas-auth-scope': 'user' }
  });
  assert.strictEqual(result.response.status, 201, `user ${suffix} registration`);
  assert(result.payload?.authenticated);
}

function progressBody(items) {
  return JSON.stringify({
    version: 2,
    slug: RE5_SLUG,
    items
  });
}

function assertError(result, status, code) {
  assert.strictEqual(result.response.status, status);
  if (code) assert.strictEqual(result.payload?.error?.code, code);
}

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'guides', 'resident-evil-5.json'),
    'utf8'
  ));
  const trophyCodes = snapshot.trophies.map(item => item.trophyCode);
  assert.strictEqual(trophyCodes.length, 71);
  const now = '2026-07-26T20:00:00.000Z';
  const capturedLogs = [];
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn
  };

  await withTempApp(async ({ baseUrl }) => {
    const anonymous = createHttpClient(baseUrl);
    assertError(await anonymous.request(PROGRESS_PATH), 401, 'USER_AUTH_REQUIRED');
    assertError(await anonymous.request(PROGRESS_PATH, {
      method: 'PUT',
      body: progressBody([{ trophyCode: trophyCodes[0], completed: true, updatedAt: now }])
    }), 401, 'USER_AUTH_REQUIRED');

    const userA = createHttpClient(baseUrl);
    const userB = createHttpClient(baseUrl);
    await register(userA, 'alpha');
    await register(userB, 'beta');
    assert(userA.cookie && userA.csrfToken);
    assert(userB.cookie && userB.csrfToken);

    console.log = (...values) => capturedLogs.push(values);
    console.info = (...values) => capturedLogs.push(values);
    console.warn = (...values) => capturedLogs.push(values);
    try {
      const validSave = await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        body: progressBody([{ trophyCode: trophyCodes[0], completed: true, updatedAt: now }])
      });
      assert.strictEqual(validSave.response.status, 200);
      assert.strictEqual(validSave.payload.trophies[trophyCodes[0]].completed, true);

      const userARead = await userA.request(PROGRESS_PATH);
      const userBRead = await userB.request(PROGRESS_PATH);
      assert.strictEqual(userARead.response.status, 200);
      assert.strictEqual(Object.keys(userARead.payload.trophies).length, 1);
      assert.strictEqual(userBRead.response.status, 200);
      assert.strictEqual(Object.keys(userBRead.payload.trophies).length, 0);

      const userBSave = await userB.request(PROGRESS_PATH, {
        method: 'PUT',
        body: progressBody([{
          trophyCode: trophyCodes[1],
          completed: true,
          updatedAt: '2026-07-26T20:01:00.000Z'
        }])
      });
      assert.strictEqual(userBSave.response.status, 200);
      const userAAfterB = await userA.request(PROGRESS_PATH);
      assert.deepStrictEqual(Object.keys(userAAfterB.payload.trophies), [trophyCodes[0]]);

      assertError(await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        csrf: false,
        body: progressBody([{ trophyCode: trophyCodes[0], completed: true, updatedAt: now }])
      }), 403, 'CSRF_TOKEN_INVALID');
      assertError(await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        body: progressBody([{ trophyCode: trophyCodes[0], completed: true, updatedAt: now }]),
        headers: { origin: 'https://attacker.invalid' }
      }), 403, 'CSRF_ORIGIN_MISMATCH');

      assertError(await userA.request('/api/library/guides/not-resident-evil-5/progress'), 404, 'GUIDE_PROGRESS_NOT_FOUND');
      assertError(await userA.request('/api/library/guides/not-resident-evil-5/progress', {
        method: 'PUT',
        body: progressBody([])
      }), 404, 'GUIDE_PROGRESS_NOT_FOUND');
      assertError(await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        body: progressBody([{ trophyCode: '', completed: true, updatedAt: now }])
      }), 400, 'VALIDATION_ERROR');
      assertError(await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        body: progressBody([{ trophyCode: 're5_unknown', completed: true, updatedAt: now }])
      }), 400, 'TROPHY_NOT_FOUND');
      assertError(await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        body: progressBody([
          { trophyCode: trophyCodes[0], completed: true, updatedAt: now },
          { trophyCode: trophyCodes[0], completed: false, updatedAt: now }
        ])
      }), 400, 'DUPLICATE_TROPHY_CODE');
      assertError(await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        body: progressBody(Array.from({ length: 72 }, (_, index) => ({
          trophyCode: trophyCodes[index % trophyCodes.length],
          completed: false,
          updatedAt: now
        })))
      }), 400, 'VALIDATION_ERROR');
      assertError(await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        body: progressBody([{ trophyCode: trophyCodes[0], completed: true, updatedAt: 'not-a-date' }])
      }), 400, 'VALIDATION_ERROR');
      assertError(await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        body: JSON.stringify({ version: 2, slug: RE5_SLUG })
      }), 400, 'VALIDATION_ERROR');

      const prototypePayload = `{"version":2,"slug":"${RE5_SLUG}","items":[],"__proto__":{"polluted":true}}`;
      assertError(await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        body: prototypePayload
      }), 400, 'VALIDATION_ERROR');
      assert.strictEqual({}.polluted, undefined);

      const malformed = await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        body: '{"version":2,',
        headers: { 'content-type': 'application/json' }
      });
      assert.strictEqual(malformed.response.status, 400);
      const excessive = await userA.request(PROGRESS_PATH, {
        method: 'PUT',
        body: JSON.stringify({
          version: 2,
          slug: RE5_SLUG,
          items: [],
          padding: 'x'.repeat(1024 * 1024)
        }),
        headers: { 'content-type': 'application/json' }
      });
      assert.strictEqual(excessive.response.status, 413);
      const wrongMethod = await userA.request(PROGRESS_PATH, {
        method: 'POST',
        body: progressBody([])
      });
      assert.strictEqual(wrongMethod.response.status, 404);

      const loggedPublicPage = await fetch(`${baseUrl}/jogo/${RE5_SLUG}`, {
        headers: { accept: 'text/html' },
        signal: AbortSignal.timeout(30000)
      });
      assert.strictEqual(loggedPublicPage.status, 200);
      await loggedPublicPage.arrayBuffer();
    } finally {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
    }

    const pageResponse = await fetch(`${baseUrl}/jogo/${RE5_SLUG}`, {
      headers: { accept: 'text/html' },
      signal: AbortSignal.timeout(30000)
    });
    const pageHtml = await pageResponse.text();
    assert.strictEqual(pageResponse.status, 200);
    assert.strictEqual(pageResponse.headers.get('x-guide-source-mode'), 'v2');
    assert(pageResponse.headers.get('content-security-policy'));
    assert(!/href="javascript:/i.test(pageHtml));

    for (const pathName of [
      '/',
      '/jogo/resident-evil-2-remake',
      '/jogo/resident-evil-6',
      '/jogo/stray',
      '/sitemap.xml',
      '/robots.txt'
    ]) {
      const response = await fetch(`${baseUrl}${pathName}`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(30000)
      });
      assert.strictEqual(response.status, 200, `${pathName} integration smoke`);
      if (pathName.includes('resident-evil-2') || pathName.includes('resident-evil-6') || pathName === '/jogo/stray') {
        assert.notStrictEqual(response.headers.get('x-guide-source-mode'), 'v2', `${pathName} must remain V1`);
      }
      if (pathName === '/sitemap.xml') {
        assert((await response.text()).includes('/jogo/resident-evil-5'));
      }
    }
    const notFound = await fetch(`${baseUrl}/rota-inexistente-bloco-7`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(30000)
    });
    assert.strictEqual(notFound.status, 404);
  }, { guideV2EnabledSlugs: RE5_SLUG });

  const structuredLogs = capturedLogs
    .flat()
    .filter(value => value && typeof value === 'object' && typeof value.event === 'string');
  assert(structuredLogs.length > 0, 'Guide operations must produce structured events');
  structuredLogs.forEach(event => {
    Object.keys(event).forEach(field => {
      assert(ALLOWED_EVENT_FIELDS.has(field), `${event.event} emitted forbidden field ${field}`);
    });
  });
  const serializedLogs = JSON.stringify(capturedLogs);
  [
    're5-release-alpha@example.com',
    're5-release-beta@example.com',
    'senha-release-123',
    'mtg.sid=',
    userTokenPattern()
  ].forEach(secret => {
    if (secret instanceof RegExp) assert(!secret.test(serializedLogs));
    else assert(!serializedLogs.includes(secret));
  });

  const clientSource = fs.readFileSync(path.join(ROOT, 'public', 'js', 'guide-progress-v2.js'), 'utf8');
  assert(!/\beval\s*\(/.test(clientSource));
  assert(!/\.innerHTML\s*=/.test(clientSource));
  assert(!/localStorage[\s\S]{0,100}(?:csrf|token)/i.test(clientSource));
  console.log('RE5 V2 security and integrated route contract passed');
  console.log('Rate limiting: login endpoints are limited; progress endpoint has no dedicated limiter (residual documented).');
}

function userTokenPattern() {
  return /(?:csrf-test|x-csrf-token.{0,40}[a-f0-9]{24,})/i;
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
