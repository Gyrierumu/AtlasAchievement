'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const LOCK_PATH = path.join(ROOT, 'package-lock.json');
const MINIMUM_SAFE_TAR = [7, 5, 21];

function runNpm(args) {
  const npmCli = process.env.npm_execpath;
  assert(npmCli && fs.existsSync(npmCli), 'npm_execpath is required for a reproducible audit');
  return spawnSync(process.execPath, [npmCli, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true
  });
}

function compareVersion(left, right) {
  const normalized = value => String(value).split('.').slice(0, 3).map(part => Number(part) || 0);
  const a = normalized(left);
  const b = Array.isArray(right) ? right : normalized(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function packageVersions(lock, packageName) {
  const suffix = `/node_modules/${packageName}`;
  return [...new Set(Object.entries(lock.packages)
    .filter(([location]) => location === `node_modules/${packageName}` || location.endsWith(suffix))
    .map(([, value]) => value.version))]
    .sort();
}

function formatFinding(name, vulnerability) {
  return {
    package: name,
    severity: vulnerability.severity,
    advisories: (vulnerability.via || [])
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        source: item.source,
        title: item.title,
        url: item.url,
        severity: item.severity,
        range: item.range
      })),
    path: vulnerability.nodes || [],
    effects: vulnerability.effects || [],
    fixAvailable: vulnerability.fixAvailable || false
  };
}

function assertLockConsistency(packageJson, lock) {
  assert.strictEqual(lock.lockfileVersion, 3);
  assert(lock.packages && lock.packages[''], 'package-lock root package is missing');
  assert.deepStrictEqual(lock.packages[''].dependencies, packageJson.dependencies);
  assert.deepStrictEqual(lock.packages[''].devDependencies, packageJson.devDependencies);
  for (const [location, value] of Object.entries(lock.packages)) {
    if (!location || value.link) continue;
    assert(value.version, `${location} has no locked version`);
    assert(value.integrity, `${location} has no integrity hash`);
  }
}

function main() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  assertLockConsistency(packageJson, lock);

  assert.strictEqual(packageJson.dependencies.sqlite3, '6.0.1');
  assert.strictEqual(packageJson.dependencies.bcrypt, '6.0.0');
  assert.deepStrictEqual(packageVersions(lock, 'sqlite3'), ['6.0.1']);
  assert.deepStrictEqual(packageVersions(lock, 'bcrypt'), ['6.0.0']);
  assert.deepStrictEqual(
    packageVersions(lock, '@mapbox/node-pre-gyp'),
    [],
    '@mapbox/node-pre-gyp must not return through a transitive path'
  );
  const tarVersions = packageVersions(lock, 'tar');
  assert(tarVersions.length > 0, 'tar must remain explainable in the native build tree');
  tarVersions.forEach(version => {
    assert(
      compareVersion(version, MINIMUM_SAFE_TAR) >= 0,
      `Forbidden vulnerable tar version in production lockfile: ${version}`
    );
  });

  const auditResult = runNpm(['audit', '--omit=dev', '--json']);
  assert(auditResult.stdout, `npm audit returned no JSON: ${auditResult.stderr || ''}`);
  const audit = JSON.parse(auditResult.stdout);
  const findings = Object.entries(audit.vulnerabilities || {}).map(([name, value]) => (
    formatFinding(name, value)
  ));
  const critical = findings.filter(item => item.severity === 'critical');
  const high = findings.filter(item => item.severity === 'high');
  const report = {
    policy: {
      criticalAllowed: 0,
      highAllowedAfterRemediation: 0,
      minimumSafeTar: MINIMUM_SAFE_TAR.join('.'),
      requiredSqlite3: '6.0.1',
      requiredBcrypt: '6.0.0'
    },
    installed: {
      sqlite3: packageVersions(lock, 'sqlite3'),
      bcrypt: packageVersions(lock, 'bcrypt'),
      tar: tarVersions,
      nodeGyp: packageVersions(lock, 'node-gyp')
    },
    counts: audit.metadata?.vulnerabilities || {},
    findings
  };
  console.log(JSON.stringify(report, null, 2));
  assert.deepStrictEqual(critical, [], 'Production audit contains a critical vulnerability');
  assert.deepStrictEqual(high, [], 'Remediation introduced or retained a high vulnerability');
  console.log('Production dependency security gate passed');
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
}
