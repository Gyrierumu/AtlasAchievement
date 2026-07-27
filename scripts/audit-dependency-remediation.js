'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function sha256(filename) {
  return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function runNpm(args) {
  const npmCli = process.env.npm_execpath;
  assert(npmCli && fs.existsSync(npmCli), 'npm_execpath is required');
  return spawnSync(process.execPath, [npmCli, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true
  });
}

function packageVersions(lock, packageName) {
  const suffix = `/node_modules/${packageName}`;
  return [...new Set(Object.entries(lock.packages)
    .filter(([location]) => location === `node_modules/${packageName}` || location.endsWith(suffix))
    .map(([, value]) => value.version))]
    .sort();
}

function main() {
  const packagePath = path.join(ROOT, 'package.json');
  const lockPath = path.join(ROOT, 'package-lock.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const auditResult = runNpm(['audit', '--omit=dev', '--json']);
  const audit = JSON.parse(auditResult.stdout);
  const explanations = {};
  for (const packageName of ['sqlite3', 'bcrypt', 'tar', 'node-gyp']) {
    const result = runNpm(['explain', packageName, '--json']);
    explanations[packageName] = result.status === 0 ? JSON.parse(result.stdout) : [];
  }

  console.log(JSON.stringify({
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch
    },
    fileHashes: {
      packageJson: sha256(packagePath),
      packageLock: sha256(lockPath)
    },
    directDependencies: {
      sqlite3: packageJson.dependencies.sqlite3,
      bcrypt: packageJson.dependencies.bcrypt
    },
    installedVersions: {
      sqlite3: packageVersions(lock, 'sqlite3'),
      bcrypt: packageVersions(lock, 'bcrypt'),
      tar: packageVersions(lock, 'tar'),
      nodeGyp: packageVersions(lock, 'node-gyp')
    },
    productionAudit: audit.metadata?.vulnerabilities || {},
    vulnerabilities: audit.vulnerabilities || {},
    explanations
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
}
