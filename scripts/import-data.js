const fs = require('fs');
const path = require('path');

const env = require('../src/config/env');
const {
  parseArgs,
  normalizeDataDir,
  createContentHash,
  createDatabaseBackup,
  openDatabase,
  normalizeGuideFileName
} = require('./data-sync-utils');

const IMPORT_VERSION = 1;

const GAME_COLUMNS = [
  'name',
  'slug',
  'difficulty',
  'time',
  'time_min_hours',
  'time_max_hours',
  'time_sort_hours',
  'time_bucket',
  'missable',
  'guide_runs',
  'guide_online',
  'guide_grind',
  'guide_dlc',
  'guide_ideal',
  'guide_avoid',
  'guide_best_moment',
  'runs_summary',
  'missable_summary',
  'online_summary',
  'grind_summary',
  'dlc_scope',
  'difficulty_reason',
  'time_reason',
  'first_run_advice',
  'cleanup_advice',
  'before_you_start',
  'best_for',
  'avoid_if',
  'verification_status',
  'editorial_status',
  'coverage_level',
  'is_verified',
  'verification_note',
  'image',
  'cover_image',
  'created_at',
  'updated_at',
  'editorial_review_status',
  'last_reviewed_at',
  'editorial_notes',
  'quality_warnings',
  'reviewed_by',
  'walkthrough'
];

const TROPHY_COLUMNS = [
  'trophy_code',
  'name',
  'name_pt',
  'type',
  'description',
  'tip',
  'is_spoiler',
  'is_missable'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function assertSafeGuidePath(dataDir, fileName) {
  const resolvedDataDir = path.resolve(dataDir);
  const resolvedFilePath = path.resolve(resolvedDataDir, fileName);
  const expectedPrefix = `${resolvedDataDir}${path.sep}`;
  if (!resolvedFilePath.startsWith(expectedPrefix)) {
    throw new Error(`Arquivo de guia invalido no manifest: ${fileName}`);
  }
  return resolvedFilePath;
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.games)) {
    throw new Error('Manifest invalido: campo games deve ser uma lista.');
  }
}

function validateGuide(guide, expectedSlug, sourceFile) {
  if (!guide || typeof guide !== 'object') {
    throw new Error(`Guia invalido em ${sourceFile}: JSON deve ser um objeto.`);
  }
  if (guide.slug !== expectedSlug) {
    throw new Error(`Guia invalido em ${sourceFile}: slug esperado ${expectedSlug}, recebido ${guide.slug || '(vazio)'}.`);
  }
  if (!guide.game || typeof guide.game !== 'object' || Array.isArray(guide.game)) {
    throw new Error(`Guia invalido em ${sourceFile}: campo game deve ser um objeto.`);
  }
  for (const field of ['roadmaps', 'trophies', 'redirects']) {
    if (guide[field] !== undefined && !Array.isArray(guide[field])) {
      throw new Error(`Guia invalido em ${sourceFile}: campo ${field} deve ser uma lista.`);
    }
  }
}

function resolveSelectedSlugs(manifest, onlyArg) {
  const manifestSlugs = manifest.games.map(game => game.slug);
  if (!onlyArg) return manifestSlugs;
  const requested = String(onlyArg)
    .split(',')
    .map(slug => slug.trim().toLowerCase())
    .filter(Boolean);
  const missing = requested.filter(slug => !manifestSlugs.includes(slug));
  if (missing.length) {
    throw new Error(`Slugs nao encontrados no manifest: ${missing.join(', ')}`);
  }
  return requested;
}

function pickValues(source, columns) {
  return columns.map(column => source[column] ?? null);
}

function normalizeSlugValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isEmptySlug(value) {
  return normalizeSlugValue(value).length === 0;
}

function createGameConflictError({ name, existingSlug, newSlug }) {
  return new Error(
    `Conflito de jogo: name ja existe com outro slug. name="${name}", slug existente="${existingSlug || '(vazio)'}", slug novo="${newSlug}".`
  );
}

async function getTableColumns(database, tableName) {
  const rows = await database.all(`PRAGMA table_info(${tableName})`);
  return new Set(rows.map(row => row.name));
}

function filterColumns(columns, availableColumns) {
  return columns.filter(column => availableColumns.has(column));
}

async function assertRequiredTables(database) {
  const rows = await database.all("SELECT name FROM sqlite_master WHERE type = 'table'");
  const tables = new Set(rows.map(row => row.name));
  for (const table of ['games', 'roadmaps', 'trophies', 'game_slug_redirects']) {
    if (!tables.has(table)) {
      throw new Error(`Tabela ${table} nao existe. Rode npm run db:setup antes de importar.`);
    }
  }
}

async function hasGuideImportStateTable(database) {
  const row = await database.get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'guide_import_state'"
  );
  return Boolean(row);
}

async function ensureGuideImportStateTable(database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS guide_import_state (
      slug TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source_file TEXT NOT NULL,
      import_version INTEGER NOT NULL DEFAULT ${IMPORT_VERSION}
    );

    CREATE INDEX IF NOT EXISTS idx_guide_import_state_imported_at
      ON guide_import_state(imported_at);
  `);
}

async function readGuideImportState(database) {
  if (!(await hasGuideImportStateTable(database))) {
    return new Map();
  }

  const rows = await database.all('SELECT slug, content_hash FROM guide_import_state');
  return new Map(rows.map(row => [row.slug, row.content_hash]));
}

async function upsertGuideImportState(database, record) {
  await database.run(
    `INSERT INTO guide_import_state (slug, content_hash, imported_at, source_file, import_version)
     VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       content_hash = excluded.content_hash,
       imported_at = CURRENT_TIMESTAMP,
       source_file = excluded.source_file,
       import_version = excluded.import_version`,
    [record.slug, record.contentHash, record.sourceFile, IMPORT_VERSION]
  );
}

function loadGuideRecords(dataDir, manifest, selectedSlugs) {
  const manifestBySlug = new Map(manifest.games.map(game => [game.slug, game]));
  return selectedSlugs.map(slug => {
    const entry = manifestBySlug.get(slug);
    const sourceFile = entry?.file || normalizeGuideFileName(slug);
    const filePath = assertSafeGuidePath(dataDir, sourceFile);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Guia nao encontrado para ${slug}: ${filePath}`);
    }

    const guide = readJson(filePath);
    validateGuide(guide, slug, sourceFile);

    return {
      slug,
      guide,
      sourceFile,
      contentHash: createContentHash(guide)
    };
  });
}

function normalizeGuideName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function assertNoGuideRecordConflicts(records) {
  const seenSlugs = new Set();
  const slugByName = new Map();

  for (const record of records) {
    const slug = normalizeSlugValue(record.slug);
    const name = normalizeGuideName(record.guide?.game?.name);

    if (seenSlugs.has(slug)) {
      throw new Error(`Conflito de guia: slug duplicado nos snapshots versionados: ${slug}.`);
    }
    seenSlugs.add(slug);

    if (!name) continue;
    const existingSlug = slugByName.get(name);
    if (existingSlug && existingSlug !== slug) {
      throw createGameConflictError({
        name: record.guide.game.name,
        existingSlug,
        newSlug: slug
      });
    }
    slugByName.set(name, slug);
  }
}

async function upsertGame(database, record, gameColumns) {
  const guide = record.guide;
  const game = { ...(guide.game || {}), slug: guide.slug };
  const existing = record.target;
  const values = pickValues(game, gameColumns);

  if (existing) {
    const assignments = gameColumns.map(column => `${column} = ?`).join(', ');
    await database.run(`UPDATE games SET ${assignments} WHERE id = ?`, [...values, existing.id]);
    return { id: existing.id, action: 'updated' };
  }

  const placeholders = gameColumns.map(() => '?').join(', ');
  const result = await database.run(
    `INSERT INTO games (${gameColumns.join(', ')}) VALUES (${placeholders})`,
    values
  );
  return { id: result.lastID, action: 'inserted' };
}

async function replaceRoadmaps(database, gameId, roadmaps = []) {
  await database.run('DELETE FROM roadmaps WHERE game_id = ?', [gameId]);
  for (const roadmap of roadmaps) {
    await database.run(
      'INSERT INTO roadmaps (game_id, step_order, content) VALUES (?, ?, ?)',
      [gameId, Number(roadmap.step_order || 0), roadmap.content || '']
    );
  }
}

async function replaceTrophies(database, gameId, trophies = [], trophyColumns) {
  await database.run('DELETE FROM trophies WHERE game_id = ?', [gameId]);
  const insertColumns = ['game_id', ...trophyColumns];
  const placeholders = insertColumns.map(() => '?').join(', ');
  for (const trophy of trophies) {
    await database.run(
      `INSERT INTO trophies (${insertColumns.join(', ')}) VALUES (${placeholders})`,
      [gameId, ...pickValues(trophy, trophyColumns)]
    );
  }
}

async function preserveAndInsertRedirects(database, gameId, redirects = []) {
  for (const redirect of redirects) {
    if (!redirect) continue;
    await database.run(
      'INSERT OR IGNORE INTO game_slug_redirects (game_id, slug) VALUES (?, ?)',
      [gameId, redirect]
    );
  }
}

function buildPlan(records, existingSlugs) {
  return records.map(record => ({
    slug: record.slug,
    action: record.target ? 'update' : (existingSlugs.has(record.slug) ? 'update' : 'insert'),
    reason: record.importReason || 'selected',
    hash_changed: Boolean(record.hashChanged),
    missing_in_database: Boolean(record.missingInDatabase),
    content_hash: record.contentHash,
    source_file: record.sourceFile,
    trophies: Array.isArray(record.guide.trophies) ? record.guide.trophies.length : 0,
    roadmaps: Array.isArray(record.guide.roadmaps) ? record.guide.roadmaps.length : 0,
    redirects: Array.isArray(record.guide.redirects) ? record.guide.redirects.length : 0
  }));
}

async function resolveGameTarget(database, guide) {
  const game = guide.game || {};
  const slug = normalizeSlugValue(guide.slug);
  const name = String(game.name || '').trim();
  const matches = [];

  const slugMatch = await database.get(
    'SELECT id, slug, name FROM games WHERE slug = ?',
    [slug]
  );
  if (slugMatch) matches.push(slugMatch);

  if (name) {
    const nameMatch = await database.get(
      'SELECT id, slug, name FROM games WHERE lower(name) = lower(?)',
      [name]
    );
    if (nameMatch && !matches.some(row => row.id === nameMatch.id)) {
      matches.push(nameMatch);
    }
  }

  if (matches.length > 1) {
    const conflict = matches.find(row => row.id !== slugMatch?.id) || matches[0];
    throw createGameConflictError({
      name,
      existingSlug: conflict.slug,
      newSlug: slug
    });
  }

  const target = matches[0] || null;
  if (!target) return null;

  const existingSlug = normalizeSlugValue(target.slug);
  if (existingSlug && existingSlug !== slug) {
    throw createGameConflictError({
      name,
      existingSlug: target.slug,
      newSlug: slug
    });
  }

  if (!slugMatch && isEmptySlug(target.slug)) {
    return { ...target, matchedBy: 'name-empty-slug' };
  }

  return { ...target, matchedBy: slugMatch ? 'slug' : 'name' };
}

async function attachGameTargets(database, records) {
  const resolved = [];
  for (const record of records) {
    const target = await resolveGameTarget(database, record.guide);
    resolved.push({ ...record, target });
  }
  return resolved;
}

function attachImportDecisions(records, importState, changedOnly) {
  return records.map(record => {
    const storedHash = importState.get(record.slug) || null;
    const hashChanged = storedHash !== record.contentHash;
    const missingInDatabase = !record.target;
    let importReason = 'full-import';

    if (changedOnly) {
      if (!storedHash) {
        importReason = 'not-in-import-state';
      } else if (hashChanged) {
        importReason = 'hash-changed';
      } else if (missingInDatabase) {
        importReason = 'missing-game-with-current-hash';
      } else {
        importReason = 'unchanged';
      }
    }

    return {
      ...record,
      storedHash,
      hashChanged,
      missingInDatabase,
      importReason
    };
  });
}

function summarizeDetected(records, pendingRecords, skipped) {
  return {
    manifestTotal: records.length,
    pending: pendingRecords.map(record => ({
      slug: record.slug,
      reason: record.importReason,
      action: record.target ? 'update' : 'insert'
    })),
    hashChanged: pendingRecords.filter(record => record.hashChanged && record.storedHash).map(record => record.slug),
    notTracked: pendingRecords.filter(record => !record.storedHash).map(record => record.slug),
    missingInDatabase: pendingRecords.filter(record => record.missingInDatabase).map(record => record.slug),
    skipped
  };
}

async function runImport(options = {}) {
  const args = options.args || {};
  const apply = options.apply !== undefined
    ? Boolean(options.apply)
    : Boolean(args.yes || args.apply || process.env.ATLAS_IMPORT_CONFIRM === '1');
  const changedOnly = options.changedOnly !== undefined
    ? Boolean(options.changedOnly)
    : Boolean(args.changed || args.onlyChanged);
  const dataDir = normalizeDataDir(options.dataDir || args.dataDir);
  const manifestPath = path.join(dataDir, 'manifest.json');
  const databasePath = path.resolve(options.databasePath || env.databasePath);
  const logLabel = options.logLabel || 'guides import';

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest nao encontrado em ${manifestPath}. Rode npm run export:data primeiro.`);
  }

  const manifest = readJson(manifestPath);
  validateManifest(manifest);
  const selectedSlugs = resolveSelectedSlugs(manifest, options.only || args.only);
  const allRecords = loadGuideRecords(dataDir, manifest, selectedSlugs);
  assertNoGuideRecordConflicts(allRecords);
  const database = openDatabase(databasePath);

  try {
    await assertRequiredTables(database);
    const gameColumns = filterColumns(GAME_COLUMNS, await getTableColumns(database, 'games'));
    const trophyColumns = filterColumns(TROPHY_COLUMNS, await getTableColumns(database, 'trophies'));
    const existingRows = await database.all('SELECT slug FROM games');
    const existingSlugs = new Set(existingRows.map(row => row.slug));
    const importState = changedOnly ? await readGuideImportState(database) : new Map();
    const recordsWithTargets = await attachGameTargets(database, allRecords);
    const recordsWithDecisions = attachImportDecisions(recordsWithTargets, importState, changedOnly);
    const records = changedOnly
      ? recordsWithDecisions.filter(record => record.hashChanged || record.missingInDatabase)
      : recordsWithDecisions;
    const skipped = changedOnly
      ? recordsWithDecisions
        .filter(record => !record.hashChanged && !record.missingInDatabase)
        .map(record => record.slug)
      : [];
    const plan = buildPlan(records, existingSlugs);
    const detected = summarizeDetected(recordsWithDecisions, records, skipped);

    if (!apply) {
      console.log(JSON.stringify({
        ok: true,
        mode: 'dry-run',
        changedOnly,
        database: databasePath,
        input: dataDir,
        manifestTotal: allRecords.length,
        selected: plan.length,
        detected,
        skipped,
        message: 'Nenhuma alteracao aplicada. Rode npm run import:data -- --yes para importar com backup.',
        plan
      }, null, 2));
      return {
        ok: true,
        mode: 'dry-run',
        changedOnly,
        database: databasePath,
        input: dataDir,
        manifestTotal: allRecords.length,
        selected: plan.length,
        detected,
        skipped,
        plan
      };
    }

    if (changedOnly && records.length === 0) {
      console.log(`${logLabel}: no changes`);
      console.log(JSON.stringify({
        ok: true,
        mode: 'import',
        changedOnly,
        database: databasePath,
        input: dataDir,
        manifestTotal: allRecords.length,
        selected: 0,
        detected,
        skipped
      }, null, 2));
      return {
        ok: true,
        mode: 'import',
        changedOnly,
        database: databasePath,
        input: dataDir,
        manifestTotal: allRecords.length,
        selected: 0,
        detected,
        skipped
      };
    }

    const backupPath = createDatabaseBackup(databasePath, changedOnly ? 'import-data-changed' : 'import-data');

    await database.exec('BEGIN TRANSACTION');
    const summary = { inserted: 0, updated: 0, trophies: 0, roadmaps: 0, redirects: 0 };
    try {
      await ensureGuideImportStateTable(database);
      for (const record of records) {
        const guide = record.guide;
        const result = await upsertGame(database, record, gameColumns);
        summary[result.action] += 1;
        await replaceRoadmaps(database, result.id, guide.roadmaps || []);
        await replaceTrophies(database, result.id, guide.trophies || [], trophyColumns);
        await preserveAndInsertRedirects(database, result.id, guide.redirects || []);
        await upsertGuideImportState(database, record);
        summary.trophies += Array.isArray(guide.trophies) ? guide.trophies.length : 0;
        summary.roadmaps += Array.isArray(guide.roadmaps) ? guide.roadmaps.length : 0;
        summary.redirects += Array.isArray(guide.redirects) ? guide.redirects.length : 0;
      }
      await database.exec('COMMIT');
    } catch (error) {
      await database.exec('ROLLBACK').catch(() => {});
      throw error;
    }

    const result = {
      ok: true,
      mode: 'import',
      changedOnly,
      database: databasePath,
      backup: backupPath,
      input: dataDir,
      manifestTotal: allRecords.length,
      selected: plan.length,
      detected,
      imported: plan.map(item => item.slug),
      skipped,
      summary
    };

    console.log(JSON.stringify(result, null, 2));

    return result;
  } finally {
    await database.close();
  }
}

async function main() {
  const args = parseArgs();
  await runImport({ args });
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  IMPORT_VERSION,
  runImport,
  validateManifest,
  validateGuide,
  loadGuideRecords,
  assertNoGuideRecordConflicts,
  ensureGuideImportStateTable
};
