const assert = require('assert');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'artifacts', 're5-phase8', 'lighthouse');
const PORT = Number(process.env.RE5_PHASE8_LIGHTHOUSE_PORT || 4321);
const GUIDE_URL = `http://127.0.0.1:${PORT}/jogo/resident-evil-5`;

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${GUIDE_URL}?phase8_lighthouse=ready`);
      if (response.ok) return;
    } catch (_error) { /* startup polling */ }
    await delay(150);
  }
  throw new Error('Phase 8 Lighthouse server did not start');
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    delay(5000).then(() => { if (child.exitCode === null) child.kill('SIGKILL'); })
  ]);
}

async function startServer(mode) {
  const logs = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(PORT),
      RE5_PRODUCT_ANALYTICS_ENABLED: 'false',
      RE5_CWV_ENABLED: 'false',
      RE5_ERROR_MONITORING_ENABLED: 'false',
      RE5_ADS_ENABLED: 'false',
      RE5_ADS_TEST_PLACEHOLDERS: mode === 'placeholders' ? 'true' : 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  child.stdout.on('data', chunk => logs.push(String(chunk)));
  child.stderr.on('data', chunk => logs.push(String(chunk)));
  await waitForServer();
  return { child, logs };
}

function runLighthouse(mode, profile, run) {
  const output = path.join(OUTPUT_DIR, `${mode}-${profile}-${run}.json`);
  const log = path.join(OUTPUT_DIR, `${mode}-${profile}-${run}.log`);
  const args = [
    'lighthouse',
    `${GUIDE_URL}?phase8_lighthouse=${mode}-${profile}-${run}`,
    '--quiet',
    '--output=json',
    `--output-path=${output}`,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--chrome-flags=--headless=new --disable-gpu --no-first-run --no-default-browser-check'
  ];
  if (profile === 'desktop') args.push('--preset=desktop');
  const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx', ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000, windowsHide: true });
  fs.writeFileSync(log, `${result.stdout || ''}${result.stderr || ''}${result.error ? `\n${result.error.stack || result.error.message}` : ''}`);
  assert(fs.existsSync(output), `${mode}/${profile}/${run} did not produce JSON (exit ${result.status})`);
  const parsed = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert(!parsed.runtimeError, `${mode}/${profile}/${run} runtime error`);
  process.stdout.write(`lighthouse ${mode} ${profile} ${run}: ${Math.round(parsed.categories.performance.score * 100)}\n`);
}

async function main() {
  for (const mode of ['off', 'placeholders']) {
    const server = await startServer(mode);
    try {
      for (const profile of ['mobile', 'desktop']) {
        for (let run = 1; run <= 3; run += 1) runLighthouse(mode, profile, run);
      }
    } finally {
      await stopServer(server.child);
      fs.writeFileSync(path.join(OUTPUT_DIR, `${mode}-server.log`), server.logs.join(''));
    }
  }
  process.stdout.write(`Phase 8 Lighthouse reports written: ${OUTPUT_DIR}\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
