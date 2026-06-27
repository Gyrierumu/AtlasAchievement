const env = require('../config/env');
const { runImport } = require('../../scripts/import-data');
const { DEFAULT_DATA_DIR } = require('../../scripts/data-sync-utils');

async function runAutoImportGuidesOnStart() {
  if (!env.autoImportGuidesOnStart) {
    console.log(`guides import startup: AUTO_IMPORT_GUIDES_ON_START=false; skipped database=${env.databasePath} input=${DEFAULT_DATA_DIR}`);
    return { enabled: false, skipped: true };
  }

  console.log(`guides import startup: AUTO_IMPORT_GUIDES_ON_START=true database=${env.databasePath} input=${DEFAULT_DATA_DIR}`);
  const result = await runImport({
    apply: true,
    changedOnly: true,
    databasePath: env.databasePath,
    logLabel: 'guides import startup'
  });

  const imported = Array.isArray(result.imported) ? result.imported : [];
  const skipped = Array.isArray(result.skipped) ? result.skipped : [];
  console.log(`guides import startup: imported=${imported.length} skipped=${skipped.length}`);

  return {
    enabled: true,
    ...result
  };
}

module.exports = {
  runAutoImportGuidesOnStart
};
