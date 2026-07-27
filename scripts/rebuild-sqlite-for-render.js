'use strict';

const { spawnSync } = require('child_process');

function envFlag(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function shouldRebuildForCurrentEnvironment(env = process.env) {
  return envFlag(env.RENDER) || envFlag(env.ATLAS_FORCE_SQLITE_SOURCE_BUILD);
}

function rebuildSqliteFromSource(env = process.env) {
  const npmExecPath = String(env.npm_execpath || '').trim();
  if (!npmExecPath) {
    throw new Error('npm_execpath is required to rebuild sqlite3 from source');
  }

  const result = spawnSync(
    process.execPath,
    [npmExecPath, 'rebuild', 'sqlite3', '--build-from-source'],
    {
      stdio: 'inherit',
      env: {
        ...env,
        npm_config_build_from_source: 'true'
      }
    }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`sqlite3 source rebuild failed with exit code ${result.status}`);
  }
}

function main() {
  if (!shouldRebuildForCurrentEnvironment()) {
    console.log('sqlite3 source rebuild skipped outside Render');
    return;
  }

  console.log('Rebuilding sqlite3 from source for Render GLIBC compatibility');
  rebuildSqliteFromSource();
  console.log('sqlite3 source rebuild completed');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  }
}

module.exports = {
  envFlag,
  shouldRebuildForCurrentEnvironment,
  rebuildSqliteFromSource
};
