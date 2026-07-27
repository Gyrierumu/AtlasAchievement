const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const databasePath = path.join(root, 'database.sqlite');

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function getAvailablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  await new Promise(resolve => probe.close(resolve));
  return address.port;
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Servidor encerrou antes do health check (código ${child.exitCode}).`);
    }

    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // O processo ainda pode estar iniciando.
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error('Servidor de produção não ficou pronto no tempo esperado.');
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');

  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 3000))
  ]);

  if (child.exitCode === null) child.kill('SIGKILL');
}

async function main() {
  const port = await getAvailablePort();
  const origin = `http://127.0.0.1:${port}`;
  const databaseHashBefore = getFileHash(databasePath);
  let stdout = '';
  let stderr = '';

  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      CANONICAL_ORIGIN: 'https://atlasachievement.com.br',
      NODE_ENV: 'production',
      PORT: String(port)
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  child.stdout.on('data', chunk => {
    stdout += chunk;
  });
  child.stderr.on('data', chunk => {
    stderr += chunk;
  });

  try {
    await waitForServer(`${origin}/api/health`, child);

    const expectedStatuses = new Map([
      ['/', 200],
      ['/api/health', 200],
      ['/catalogo', 404],
      ['/api/games', 404],
      ['/indisponivel', 503],
      ['/assets/site.css', 200]
    ]);

    for (const [route, expectedStatus] of expectedStatuses) {
      const response = await fetch(`${origin}${route}`);
      if (response.status !== expectedStatus) {
        throw new Error(`${route}: esperado ${expectedStatus}, recebido ${response.status}.`);
      }
      console.log(`${route} -> ${response.status}`);
    }

    const health = await fetch(`${origin}/api/health`).then(response => response.json());
    if (health.status !== 'ok' || health.database !== 'preserved-not-required') {
      throw new Error('Payload do health check não corresponde ao contrato mínimo.');
    }

    const databaseHashAfter = getFileHash(databasePath);
    if (databaseHashBefore !== databaseHashAfter) {
      throw new Error('O banco local foi alterado durante o start de produção.');
    }

    console.log(`Banco local preservado: ${databaseHashAfter || 'não presente'}.`);
  } finally {
    await stopServer(child);
  }

  if (stderr.trim()) {
    throw new Error(`Servidor escreveu em stderr:\n${stderr.trim()}`);
  }
  if (!stdout.includes('AtlasAchievement disponível na porta')) {
    throw new Error('Mensagem esperada de inicialização não foi registrada.');
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
