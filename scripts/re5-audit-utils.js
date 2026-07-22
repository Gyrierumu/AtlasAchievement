'use strict';

const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts', 're5-phase9');

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stable(value[key]);
      return result;
    }, {});
  }
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function assertRe5Slug(argv = process.argv) {
  const slug = String(argv[2] || '').trim().toLowerCase();
  if (slug !== 'resident-evil-5') {
    throw new Error('Uso: comando -- resident-evil-5. O audit da Fase 9 é isolado ao RE5.');
  }
  return slug;
}

async function waitForUrl(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (response.ok) return;
    } catch (_error) { /* servidor ainda iniciando */ }
    await delay(150);
  }
  throw new Error(`Timeout aguardando ${url}`);
}

async function startAuditServer(port) {
  const logs = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-re5-audit-server-'));
  const sourceDatabase = path.join(ROOT, 'database.sqlite');
  const databasePath = path.join(tempDir, 'audit.sqlite');
  if (fs.existsSync(sourceDatabase)) fs.copyFileSync(sourceDatabase, databasePath);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      DATABASE_PATH: databasePath,
      DISABLE_STARTUP_SEED: 'true',
      RUN_SEED_SYNC: 'false',
      AUTO_IMPORT_GUIDES_ON_START: 'false',
      RE5_PRODUCT_ANALYTICS_ENABLED: 'false',
      RE5_CWV_ENABLED: 'false',
      RE5_ERROR_MONITORING_ENABLED: 'false',
      RE5_ADS_ENABLED: 'false',
      RE5_ADS_TEST_PLACEHOLDERS: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  child.stdout.on('data', chunk => logs.push(String(chunk)));
  child.stderr.on('data', chunk => logs.push(String(chunk)));
  const origin = `http://127.0.0.1:${port}`;
  try {
    await waitForUrl(`${origin}/robots.txt`);
  } catch (error) {
    child.kill();
    const resolved = path.resolve(tempDir);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(resolved, { recursive: true, force: true });
    throw new Error(`${error.message}\n${logs.join('').slice(-2500)}`);
  }
  return { child, logs, origin, tempDir, databasePath };
}

async function stopAuditServer(server) {
  if (server?.child && server.child.exitCode === null) {
    server.child.kill();
    await Promise.race([
      new Promise(resolve => server.child.once('exit', resolve)),
      delay(4000).then(() => { if (server.child.exitCode === null) server.child.kill('SIGKILL'); })
    ]);
  }
  if (server?.tempDir) {
    const resolved = path.resolve(server.tempDir);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }
}

function ensureArtifactDir() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  return ARTIFACT_DIR;
}

function writeJsonAndMarkdown(baseName, data, markdown) {
  ensureArtifactDir();
  const jsonPath = path.join(ARTIFACT_DIR, `${baseName}.json`);
  const mdPath = path.join(ARTIFACT_DIR, `${baseName}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`);
  fs.writeFileSync(mdPath, `${String(markdown || '').trim()}\n`);
  return { jsonPath, mdPath };
}

module.exports = {
  ROOT, ARTIFACT_DIR, delay, stable, hash, assertRe5Slug, startAuditServer,
  stopAuditServer, ensureArtifactDir, writeJsonAndMarkdown
};
