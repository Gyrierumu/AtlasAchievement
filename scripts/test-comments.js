const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

class CookieJar {
  constructor() {
    this.cookies = new Map();
    this.csrfToken = '';
  }

  update(response) {
    const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    setCookie.forEach(cookie => {
      const [pair] = cookie.split(';');
      const [name, value] = pair.split('=');
      if (name && value) this.cookies.set(name.trim(), value.trim());
    });
    const csrfToken = response.headers.get('x-csrf-token');
    if (csrfToken) this.csrfToken = csrfToken;
  }

  header() {
    return Array.from(this.cookies.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

async function request(baseUrl, pathName, options = {}, jar = null) {
  const headers = { ...(options.headers || {}) };
  if (jar?.header()) headers.cookie = jar.header();
  if (jar?.csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(String(options.method || 'GET').toUpperCase()) && options.csrf !== false) {
    headers['x-csrf-token'] = jar.csrfToken;
  }
  if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
    signal: AbortSignal.timeout(30000)
  });
  if (jar) jar.update(response);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, payload };
}

async function withTempApp(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-comments-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = path.join(tempDir, 'database.sqlite');
  process.env.UPLOAD_DIR = path.join(tempDir, 'uploads');
  process.env.SESSION_CLEANUP_INTERVAL_MINUTES = '0';
  process.env.RUN_SEED_SYNC = 'true';
  process.env.ALLOW_DEFAULT_ADMIN_BOOTSTRAP = 'true';
  process.env.ADMIN_USERNAME = 'admin-comments';
  process.env.ADMIN_PASSWORD = 'admin-comments-password';

  const migrate = require(path.join(ROOT, 'src/db/migrate'));
  const seed = require(path.join(ROOT, 'src/db/seed'));
  const app = require(path.join(ROOT, 'src/app'));
  const adminService = require(path.join(ROOT, 'src/services/admin.service'));
  const { db, get, run } = require(path.join(ROOT, 'src/db/db'));

  await migrate();
  await seed();
  await adminService.ensureDefaultAdmin();

  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    return await callback({
      baseUrl: `http://127.0.0.1:${server.address().port}`,
      get,
      run
    });
  } finally {
    server.closeIdleConnections?.();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function registerUser(baseUrl, username) {
  const jar = new CookieJar();
  const result = await request(baseUrl, '/api/auth/register', {
    method: 'POST',
    headers: { 'x-atlas-auth-scope': 'user' },
    body: {
      username,
      email: `${username}@example.com`,
      password: 'password-123',
      display_name: `Conta ${username}`
    }
  }, jar);
  assert.strictEqual(result.response.status, 201, `registro de ${username} deve passar`);
  assert(result.payload.csrfToken, 'registro deve retornar CSRF');
  jar.csrfToken = result.payload.csrfToken;
  return { jar, user: result.payload.user };
}

async function loginAdmin(baseUrl) {
  const jar = new CookieJar();
  const result = await request(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: {
      username: 'admin-comments',
      password: 'admin-comments-password'
    }
  }, jar);
  assert.strictEqual(result.response.status, 200, 'login admin deve passar');
  jar.csrfToken = result.payload.csrfToken;
  return jar;
}

async function main() {
  await withTempApp(async ({ baseUrl, run }) => {
    const slug = 'astro-bot';
    const publicEmpty = await request(baseUrl, `/jogo/${slug}/comments`);
    assert.strictEqual(publicEmpty.response.status, 200, 'visitante deve ler comentarios');
    assert.deepStrictEqual(publicEmpty.payload.items, [], 'sem aprovados, lista publica começa vazia');

    const anonymousPost = await request(baseUrl, `/jogo/${slug}/comments`, {
      method: 'POST',
      body: { body: 'Dica pública' }
    });
    assert.strictEqual(anonymousPost.response.status, 401, 'visitante deslogado nao comenta');

    const { jar: userJar, user } = await registerUser(baseUrl, 'commenter-one');
    const csrfBlocked = await request(baseUrl, `/jogo/${slug}/comments`, {
      method: 'POST',
      csrf: false,
      body: { body: 'Sem csrf' }
    }, userJar);
    assert.strictEqual(csrfBlocked.response.status, 403, 'POST autenticado sem CSRF deve bloquear');

    const emptyComment = await request(baseUrl, `/jogo/${slug}/comments`, {
      method: 'POST',
      body: { body: '   ' }
    }, userJar);
    assert.strictEqual(emptyComment.response.status, 400, 'comentario vazio deve falhar');

    const longComment = await request(baseUrl, `/jogo/${slug}/comments`, {
      method: 'POST',
      body: { body: 'a'.repeat(1001) }
    }, userJar);
    assert.strictEqual(longComment.response.status, 400, 'comentario com mais de 1000 caracteres deve falhar');

    const htmlComment = await request(baseUrl, `/jogo/${slug}/comments`, {
      method: 'POST',
      body: { body: '<script>alert(1)</script>' }
    }, userJar);
    assert.strictEqual(htmlComment.response.status, 400, 'comentario com HTML/script deve falhar');

    const created = await request(baseUrl, `/jogo/${slug}/comments`, {
      method: 'POST',
      body: { body: 'Excelente guia, ajudou no cleanup.' }
    }, userJar);
    assert.strictEqual(created.response.status, 201, 'usuario logado deve enviar comentario valido');
    assert.strictEqual(created.payload.status, 'pending', 'comentario nasce pending');

    const pendingHidden = await request(baseUrl, `/jogo/${slug}/comments`);
    assert.strictEqual(pendingHidden.payload.items.length, 0, 'pending nao aparece publicamente');

    const adminJar = await loginAdmin(baseUrl);
    const adminList = await request(baseUrl, '/api/admin/comments?status=pending', {}, adminJar);
    assert.strictEqual(adminList.response.status, 200, 'admin lista comentarios');
    assert(adminList.payload.items.some(item => item.id === created.payload.id), 'admin ve comentario pending');

    const approved = await request(baseUrl, `/api/admin/comments/${created.payload.id}/approve`, {
      method: 'POST',
      body: { moderation_note: 'Aprovado no teste.' }
    }, adminJar);
    assert.strictEqual(approved.response.status, 200, 'admin aprova comentario');

    const publicApproved = await request(baseUrl, `/jogo/${slug}/comments`, {}, userJar);
    assert.strictEqual(publicApproved.payload.items.length, 1, 'approved aparece publicamente');
    assert.strictEqual(publicApproved.payload.items[0].author.display_name, 'Conta commenter-one', 'nome publico aparece');
    assert(!JSON.stringify(publicApproved.payload).includes('@example.com'), 'e-mail nao aparece no JSON publico');
    assert(!JSON.stringify(publicApproved.payload).includes('user_ip_hash'), 'IP/hash interno nao aparece no JSON publico');

    const { jar: otherJar } = await registerUser(baseUrl, 'commenter-two');
    const forbiddenDelete = await request(baseUrl, `/comments/${created.payload.id}`, {
      method: 'DELETE',
      body: {}
    }, otherJar);
    assert.strictEqual(forbiddenDelete.response.status, 403, 'usuario nao apaga comentario de outro');

    const ownerDelete = await request(baseUrl, `/comments/${created.payload.id}`, {
      method: 'DELETE',
      body: {}
    }, userJar);
    assert.strictEqual(ownerDelete.response.status, 200, 'usuario apaga proprio comentario');
    const afterOwnerDelete = await request(baseUrl, `/jogo/${slug}/comments`);
    assert.strictEqual(afterOwnerDelete.payload.items.length, 0, 'comentario deletado nao aparece');

    const ownSecond = await request(baseUrl, `/jogo/${slug}/comments`, {
      method: 'POST',
      body: { body: 'Comentário para ocultar no admin.' }
    }, otherJar);
    const hidden = await request(baseUrl, `/api/admin/comments/${ownSecond.payload.id}/hide`, {
      method: 'POST',
      body: { hidden_reason: 'Teste de ocultação.', moderation_note: 'Ocultado no teste.' }
    }, adminJar);
    assert.strictEqual(hidden.response.status, 200, 'admin oculta comentario');
    const deleted = await request(baseUrl, `/api/admin/comments/${ownSecond.payload.id}/delete`, {
      method: 'POST',
      body: { moderation_note: 'Excluido no teste.' }
    }, adminJar);
    assert.strictEqual(deleted.response.status, 200, 'admin faz soft delete');

    for (let index = 0; index < 3; index += 1) {
      const ok = await request(baseUrl, `/jogo/${slug}/comments`, {
        method: 'POST',
        body: { body: `Comentário de rate ${index}` }
      }, userJar);
      assert.strictEqual(ok.response.status, 201, `comentario ${index} dentro do limite deve passar`);
    }
    const limited = await request(baseUrl, `/jogo/${slug}/comments`, {
      method: 'POST',
      body: { body: 'Comentário acima do limite por usuário.' }
    }, userJar);
    assert.strictEqual(limited.response.status, 429, 'rate limit por usuario/guia deve funcionar');

    await run(
      `INSERT INTO guide_comments (guide_slug, game_id, user_id, body, status)
       VALUES (?, (SELECT id FROM games WHERE slug = ?), ?, ?, 'approved')`,
      [slug, slug, user.id, '<script>alert("xss")</script>']
    );
    const html = (await request(baseUrl, `/jogo/${slug}`, { headers: { accept: 'text/html' } })).payload;
    assert(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'), 'SSR deve escapar comentario aprovado legado com script');
    assert(!html.includes('<script>alert("xss")</script>'), 'SSR nao deve renderizar script bruto do usuario');
  });

  console.log('test:comments passed');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
