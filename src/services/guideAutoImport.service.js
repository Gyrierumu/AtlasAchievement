const fs = require('fs');
const path = require('path');

const env = require('../config/env');
const { runImport } = require('../../scripts/import-data');
const { DEFAULT_DATA_DIR, ROOT } = require('../../scripts/data-sync-utils');

function readManifestSummary(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return {
      found: false,
      total: 0,
      error: null
    };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
    return {
      found: true,
      total: Array.isArray(manifest.games) ? manifest.games.length : 0,
      error: null
    };
  } catch (error) {
    return {
      found: true,
      total: 0,
      error: error.message || String(error)
    };
  }
}

function logStartupContext(enabled) {
  const manifestPath = path.join(DEFAULT_DATA_DIR, 'manifest.json');
  const manifest = readManifestSummary(manifestPath);
  const context = {
    enabled,
    rawEnvValue: process.env.AUTO_IMPORT_GUIDES_ON_START || '',
    cwd: process.cwd(),
    packageRoot: ROOT,
    dataDir: DEFAULT_DATA_DIR,
    manifestPath,
    manifestFound: manifest.found,
    manifestGuides: manifest.total,
    manifestError: manifest.error,
    databasePath: env.databasePath
  };

  console.log(`guides import startup context: ${JSON.stringify(context)}`);
  return context;
}

async function runAutoImportGuidesOnStart() {
  if (!env.autoImportGuidesOnStart) {
    logStartupContext(false);
    console.log(`guides import startup: disabled AUTO_IMPORT_GUIDES_ON_START=${process.env.AUTO_IMPORT_GUIDES_ON_START || '(unset)'}`);
    return { enabled: false, skipped: true };
  }

  const context = logStartupContext(true);
  if (!context.manifestFound) {
    throw new Error(`guides import startup: manifest nao encontrado em ${context.manifestPath}`);
  }

  let result;
  try {
    result = await runImport({
      apply: true,
      changedOnly: true,
      dataDir: DEFAULT_DATA_DIR,
      databasePath: env.databasePath,
      logLabel: 'guides import startup'
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const isConflict = message.includes('Conflito de jogo') || message.includes('Conflito de guia');
    console.error(`guides import startup error: ${JSON.stringify({
      error: message,
      conflict: isConflict,
      cwd: process.cwd(),
      dataDir: DEFAULT_DATA_DIR,
      databasePath: env.databasePath
    })}`);
    throw error;
  }

  const imported = Array.isArray(result.imported) ? result.imported : [];
  const skipped = Array.isArray(result.skipped) ? result.skipped : [];
  const detected = result.detected || {};
  const pending = Array.isArray(detected.pending) ? detected.pending : [];

  console.log(`guides import startup summary: ${JSON.stringify({
    manifestGuides: result.manifestTotal || context.manifestGuides,
    pending: pending.map(item => item.slug),
    pendingReasons: pending,
    imported,
    skipped,
    missingInDatabase: detected.missingInDatabase || [],
    hashChanged: detected.hashChanged || [],
    notTracked: detected.notTracked || [],
    databasePath: result.database,
    dataDir: result.input
  })}`);

  return {
    enabled: true,
    ...result
  };
}

module.exports = {
  runAutoImportGuidesOnStart
};
