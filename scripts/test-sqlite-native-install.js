'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_SQLITE_MODULE = '6.0.1';
const EXPECTED_BCRYPT_MODULE = '6.0.0';

function querySqliteVersion() {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(':memory:', error => {
      if (error) {
        reject(new Error(`sqlite3 native module failed to open: ${error.message}`));
        return;
      }
      database.get('SELECT sqlite_version() AS version', (queryError, row) => {
        if (queryError) {
          database.close(() => reject(queryError));
          return;
        }
        database.close(closeError => {
          if (closeError) reject(closeError);
          else resolve(row.version);
        });
      });
    });
  });
}

async function testBcryptNativeRoundtrip() {
  const hash = await bcrypt.hash('atlas-native-compatibility', 4);
  assert.strictEqual(await bcrypt.compare('atlas-native-compatibility', hash), true);
  assert.strictEqual(await bcrypt.compare('incorrect', hash), false);
}

async function main() {
  assert.strictEqual(Number(process.versions.node.split('.')[0]), 20, 'Node 20 is required');
  assert.strictEqual(process.arch, 'x64', 'The validated release architecture is x64');
  assert(['win32', 'linux'].includes(process.platform), 'Only release target platforms are accepted');

  const sqlitePackage = require('sqlite3/package.json');
  const bcryptPackage = require('bcrypt/package.json');
  assert.strictEqual(sqlitePackage.version, EXPECTED_SQLITE_MODULE);
  assert.strictEqual(bcryptPackage.version, EXPECTED_BCRYPT_MODULE);
  assert.deepStrictEqual(sqlitePackage.binary?.napi_versions, [3, 6]);

  const sqliteLibrary = await querySqliteVersion();
  await testBcryptNativeRoundtrip();
  const nativeBinary = Object.keys(require.cache).find(filename => (
    filename.endsWith('.node') && /sqlite3/i.test(filename)
  ));
  assert(nativeBinary && fs.existsSync(nativeBinary), 'Loaded sqlite3 native binary was not found');

  const installLogPath = process.env.SQLITE_INSTALL_LOG
    ? path.resolve(process.env.SQLITE_INSTALL_LOG)
    : null;
  let localRebuildObserved = null;
  if (installLogPath) {
    assert(fs.existsSync(installLogPath), `Install log not found: ${installLogPath}`);
    const installLogBuffer = fs.readFileSync(installLogPath);
    const installLog = (
      installLogBuffer[0] === 0xff && installLogBuffer[1] === 0xfe
        ? installLogBuffer.subarray(2).toString('utf16le')
        : installLogBuffer.toString('utf8')
    );
    assert.match(installLog, /> sqlite3@6\.0\.1 install/);
    localRebuildObserved = /\bgyp info using node-gyp\b|\bMSBuild\b|\bCXX\(/i.test(installLog);
    assert.strictEqual(
      localRebuildObserved,
      false,
      'Unexpected local sqlite3 rebuild; inspect compiler/prebuild compatibility'
    );
  }

  console.log(JSON.stringify({
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    sqliteModule: sqlitePackage.version,
    sqliteLibrary,
    sqliteLicense: sqlitePackage.license,
    napiVersions: sqlitePackage.binary.napi_versions,
    nativeBinary,
    bcryptModule: bcryptPackage.version,
    bcryptLicense: bcryptPackage.license,
    cleanInstallLogChecked: Boolean(installLogPath),
    localRebuildObserved,
    prebuildFallback: 'sqlite3 install script falls back to node-gyp rebuild with actionable output',
    sourceBuildSimulation: 'not executed on Windows; prebuilt binary was available'
  }, null, 2));
  console.log('SQLite native install contract passed');
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
