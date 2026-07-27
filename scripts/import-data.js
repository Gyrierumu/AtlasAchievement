const fs = require('fs');
const path = require('path');

const env = require('../src/config/env');
const {
  PROTECTED_VERIFIED_GUIDES,
  getProtectedVerifiedGuide
} = require('../src/data/protectedVerifiedGuides');
const { getCanonicalGameSlug } = require('../src/utils/slug');
const {
  parseArgs,
  normalizeDataDir,
  createContentHash,
  createDatabaseBackup,
  openDatabase,
  normalizeGuideFileName,
  normalizeGuideSnapshotV2,
  hashGuideSnapshotV2
} = require('./data-sync-utils');
const {
  assertGuideSnapshotV2
} = require('../src/validators/guideSnapshotV2.validator');
const {
  RE5_GAME_ID,
  RE5_SLUG
} = require('../src/shared/re5V2Constants');

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
  const guideSlug = guide.schemaVersion === 2 ? guide.game?.slug : guide.slug;
  if (guideSlug !== expectedSlug) {
    throw new Error(`Guia invalido em ${sourceFile}: slug esperado ${expectedSlug}, recebido ${guideSlug || '(vazio)'}.`);
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

function serializeQualityWarnings(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value || '').trim();
  return text === '[object Object]' ? '[]' : text;
}

function normalizeStatusValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isVerifiedGuideStatus(game = {}) {
  return Number(game.is_verified || 0) === 1
    || game.is_verified === true
    || normalizeStatusValue(game.verification_status) === 'verified'
    || normalizeStatusValue(game.editorial_review_status) === 'verified';
}

function describeGuideStatus(game = {}) {
  if (isVerifiedGuideStatus(game)) return 'verified';
  return normalizeStatusValue(game.verification_status)
    || normalizeStatusValue(game.editorial_review_status)
    || (Number(game.is_verified || 0) === 1 ? 'verified' : 'unverified');
}

function isStatusDowngrade(record) {
  if (!record?.target) return false;
  return isVerifiedGuideStatus(record.target) && !isVerifiedGuideStatus(record.guide?.game || {});
}

function buildStatusDowngradeErrors(records) {
  return records
    .filter(isStatusDowngrade)
    .map(record => ({
      slug: record.slug,
      name: record.guide?.game?.name || record.target?.name || '',
      statusEncontrado: describeGuideStatus(record.guide?.game || {}),
      statusEsperado: 'verified',
      arquivo: record.sourceFile
    }));
}

function assertNoStatusDowngrades(records, allowStatusDowngrade = false) {
  const downgrades = buildStatusDowngradeErrors(records);
  if (!downgrades.length || allowStatusDowngrade) return;

  const details = downgrades
    .map(item => `${item.slug} (${item.name || 'sem nome'}): encontrado=${item.statusEncontrado}, esperado=${item.statusEsperado}, arquivo=${item.arquivo}`)
    .join('\n- ');
  throw new Error(
    `Importacao bloqueada: downgrade editorial de Verificado para revisao detectado.\n`
    + `Use --allow-status-downgrade apenas quando a mudanca for intencional e revisada.\n`
    + `- ${details}`
  );
}

function buildProtectedVerifiedStatusErrors(records) {
  return records
    .map(record => {
      if (record.guide?.schemaVersion === 2) return null;
      const expected = getProtectedVerifiedGuide(record.slug);
      if (!expected || expected.expectedStatus !== 'verified') return null;
      const game = record.guide?.game || {};
      if (isVerifiedGuideStatus(game)) return null;
      return {
        slug: record.slug,
        name: game.name || '',
        statusEncontrado: describeGuideStatus(game),
        statusEsperado: expected.expectedStatus,
        arquivo: record.sourceFile
      };
    })
    .filter(Boolean);
}

function assertProtectedVerifiedGuideStatuses(records) {
  const errors = buildProtectedVerifiedStatusErrors(records);
  if (!errors.length) return;

  const details = errors
    .map(item => `${item.slug} (${item.name || 'sem nome'}): encontrado=${item.statusEncontrado}, esperado=${item.statusEsperado}, arquivo=${item.arquivo}`)
    .join('\n- ');
  throw new Error(`data/guides contem guia protegido sem status Verificado:\n- ${details}`);
}

function normalizeSlugValue(value) {
  return getCanonicalGameSlug(value);
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
  const errors = [];

  for (const record of records) {
    const slug = normalizeSlugValue(record.slug);
    const name = normalizeGuideName(record.guide?.game?.name);

    if (seenSlugs.has(slug)) {
      errors.push(`slug duplicado nos snapshots versionados: ${slug}.`);
    }
    seenSlugs.add(slug);

    if (!name) continue;
    const existingSlug = slugByName.get(name);
    if (existingSlug && existingSlug !== slug) {
      errors.push(`name="${record.guide.game.name}" aparece com slugs diferentes: ${existingSlug} e ${slug}.`);
    }
    slugByName.set(name, slug);
  }

  if (errors.length) {
    throw new Error(`Conflitos de guia:\n- ${errors.join('\n- ')}`);
  }
}

async function upsertGame(database, record, gameColumns) {
  const guide = record.guide;
  const game = { ...(guide.game || {}), slug: guide.slug };
  if (gameColumns.includes('quality_warnings')) {
    game.quality_warnings = serializeQualityWarnings(game.quality_warnings);
  }
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
    `SELECT id, slug, name, is_verified, verification_status, editorial_review_status
       FROM games
      WHERE slug = ?`,
    [slug]
  );
  if (slugMatch) matches.push(slugMatch);

  if (name) {
    const nameMatch = await database.get(
      `SELECT id, slug, name, is_verified, verification_status, editorial_review_status
         FROM games
        WHERE lower(name) = lower(?)`,
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
  const allowStatusDowngrade = options.allowStatusDowngrade !== undefined
    ? Boolean(options.allowStatusDowngrade)
    : Boolean(args.allowStatusDowngrade || process.env.ATLAS_ALLOW_STATUS_DOWNGRADE === '1');
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
  const loadedRecords = loadGuideRecords(dataDir, manifest, selectedSlugs);
  const v2Records = loadedRecords.filter(record => record.guide?.schemaVersion === 2);
  if (v2Records.length && options.only) {
    throw new Error(
      `Snapshot V2 selecionado (${v2Records.map(record => record.slug).join(', ')}). `
      + 'Use importGuideSnapshotV2 após executar a migration V2.'
    );
  }
  const allRecords = loadedRecords.filter(record => record.guide?.schemaVersion !== 2);
  assertProtectedVerifiedGuideStatuses(allRecords);
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
    assertNoStatusDowngrades(records, allowStatusDowngrade);
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
        allowStatusDowngrade,
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
        allowStatusDowngrade,
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
        allowStatusDowngrade,
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
        allowStatusDowngrade,
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
      allowStatusDowngrade,
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

async function requireGuideSnapshotV2Schema(database) {
  const rows = await database.all("SELECT name FROM sqlite_master WHERE type = 'table'");
  const tables = new Set(rows.map(row => row.name));
  for (const table of [
    'games',
    'trophies',
    'game_versions',
    'trophy_packages',
    'game_guide_payloads'
  ]) {
    if (!tables.has(table)) {
      throw new Error(`RE5_V2_MIGRATION_REQUIRED: missing table ${table}`);
    }
  }
  const trophyColumns = await database.all('PRAGMA table_info(trophies)');
  const columnNames = new Set(trophyColumns.map(column => column.name));
  for (const column of [
    'version_id',
    'package_id',
    'display_order',
    'is_online',
    'is_coop',
    'is_cumulative',
    'is_missable',
    'category',
    'source_trophy_code'
  ]) {
    if (!columnNames.has(column)) {
      throw new Error(`RE5_V2_MIGRATION_REQUIRED: missing trophies.${column}`);
    }
  }
  return columnNames;
}

async function captureUserTrophyProgress(database) {
  const table = await database.get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_trophy_progress'"
  );
  return table ? database.all('SELECT * FROM user_trophy_progress ORDER BY id') : [];
}

function relationalDifference(current, expected) {
  const differences = [];
  for (const [field, value] of Object.entries(expected)) {
    if (current?.[field] !== value) {
      differences.push({ field, current: current?.[field] ?? null, expected: value });
    }
  }
  return differences;
}

async function buildGuideSnapshotV2ImportPlan(database, snapshot, hash) {
  const trophyColumns = new Set(
    (await database.all('PRAGMA table_info(trophies)')).map(column => column.name)
  );
  const versionRows = await database.all(
    'SELECT * FROM game_versions WHERE game_id = ? ORDER BY display_order',
    [RE5_GAME_ID]
  );
  const packageRows = await database.all(
    'SELECT * FROM trophy_packages WHERE game_id = ? ORDER BY display_order',
    [RE5_GAME_ID]
  );
  const trophyRows = await database.all(
    `SELECT t.*, p.package_code, v.version_code
       FROM trophies t
       LEFT JOIN trophy_packages p ON p.id = t.package_id
       LEFT JOIN game_versions v ON v.id = t.version_id
      WHERE t.game_id = ?
      ORDER BY t.id`,
    [RE5_GAME_ID]
  );
  const payload = await database.get(
    'SELECT payload_hash FROM game_guide_payloads WHERE game_id = ? AND schema_version = 2',
    [RE5_GAME_ID]
  );

  const versionByCode = new Map(versionRows.map(row => [row.version_code, row]));
  const packageByCode = new Map(packageRows.map(row => [row.package_code, row]));
  const trophyByCode = new Map(trophyRows.map(row => [row.trophy_code, row]));
  const operations = [];

  for (const version of snapshot.versions) {
    const current = versionByCode.get(version.versionCode);
    const expected = {
      platform: version.platform,
      region: version.region,
      release_kind: version.releaseKind,
      display_order: version.displayOrder,
      is_native: Number(version.isNative),
      native_trophy_list: Number(version.nativeTrophyList),
      save_transfer_supported: Number(version.saveTransferSupported),
      autopop_supported: Number(version.autopopSupported),
      upgrade_supported: Number(version.upgradeSupported)
    };
    const differences = relationalDifference(current, expected);
    operations.push({
      entity: 'version',
      code: version.versionCode,
      action: !current ? 'insert' : (differences.length ? 'update' : 'unchanged'),
      differences
    });
  }

  for (const pkg of snapshot.trophyPackages) {
    const current = packageByCode.get(pkg.packageCode);
    const expected = {
      name: pkg.name,
      package_type: pkg.packageType,
      display_order: pkg.displayOrder,
      expected_trophy_count: pkg.expectedTrophyCount,
      counts_for_platinum: Number(pkg.countsForPlatinum),
      counts_for_100_percent: Number(pkg.countsFor100Percent),
      is_online: Number(pkg.isOnline),
      is_coop: Number(pkg.isCoop)
    };
    const differences = relationalDifference(current, expected);
    operations.push({
      entity: 'package',
      code: pkg.packageCode,
      action: !current ? 'insert' : (differences.length ? 'update' : 'unchanged'),
      differences
    });
  }

  for (const trophy of snapshot.trophies) {
    const current = trophyByCode.get(trophy.trophyCode);
    const expected = {
      name: trophy.name,
      type: trophy.type,
      package_code: trophy.packageCode,
      version_code: 'ps4-native',
      display_order: trophy.displayOrder,
      is_online: Number(trophy.isOnline),
      is_coop: Number(trophy.isCoop),
      is_cumulative: Number(trophy.isCumulative),
      is_missable: Number(trophy.isMissable),
      category: trophy.category,
      source_trophy_code: trophy.sourceTrophyCode
    };
    if (trophyColumns.has('description')) expected.description = trophy.description;
    const differences = relationalDifference(current, expected);
    operations.push({
      entity: 'trophy',
      code: trophy.trophyCode,
      action: !current ? 'insert' : (differences.length ? 'update' : 'unchanged'),
      differences
    });
  }

  operations.push({
    entity: 'payload',
    code: RE5_SLUG,
    action: !payload ? 'insert' : (payload.payload_hash === hash ? 'unchanged' : 'update'),
    differences: payload?.payload_hash === hash
      ? []
      : [{ field: 'payload_hash', current: payload?.payload_hash || null, expected: hash }]
  });
  return operations;
}

function summarizeGuideSnapshotV2Operations(operations) {
  return operations.reduce((summary, operation) => {
    summary[`${operation.action}s`] += 1;
    return summary;
  }, { inserts: 0, updates: 0, unchangeds: 0 });
}

async function importGuideSnapshotV2(database, snapshot, options = {}) {
  if (
    !database
    || typeof database.exec !== 'function'
    || typeof database.all !== 'function'
    || typeof database.get !== 'function'
    || typeof database.run !== 'function'
  ) {
    throw new TypeError('A database adapter with exec/all/get/run is required');
  }
  const settings = {
    validate: options.validate !== false,
    transaction: options.transaction !== false,
    dryRun: Boolean(options.dryRun),
    preserveExistingProgress: options.preserveExistingProgress !== false
  };
  if (settings.validate) assertGuideSnapshotV2(snapshot, { mode: 'complete' });
  if (snapshot?.game?.id !== RE5_GAME_ID || snapshot?.game?.slug !== RE5_SLUG) {
    throw new Error('RE5_V2_GAME_IDENTITY_MISMATCH');
  }

  const trophyColumnNames = await requireGuideSnapshotV2Schema(database);
  const game = await database.get('SELECT id, slug FROM games WHERE id = ?', [RE5_GAME_ID]);
  if (!game || game.slug !== RE5_SLUG) throw new Error('RE5_V2_DATABASE_GAME_MISMATCH');

  const normalized = normalizeGuideSnapshotV2(snapshot);
  const hash = hashGuideSnapshotV2(normalized);
  const progressBefore = settings.preserveExistingProgress
    ? await captureUserTrophyProgress(database)
    : [];
  const operations = await buildGuideSnapshotV2ImportPlan(database, normalized, hash);
  const operationSummary = summarizeGuideSnapshotV2Operations(operations);
  const resultBase = {
    valid: true,
    dryRun: settings.dryRun,
    inserts: operationSummary.inserts,
    updates: operationSummary.updates,
    unchanged: operationSummary.unchangeds,
    warnings: [],
    hash,
    operations
  };
  if (settings.dryRun) return resultBase;

  let inTransaction = false;
  try {
    if (settings.transaction) {
      await database.exec('BEGIN IMMEDIATE');
      inTransaction = true;
    }

    for (const version of normalized.versions) {
      await database.run(
        `INSERT INTO game_versions
          (game_id, version_code, platform, region, release_kind, display_order,
           is_native, native_trophy_list, save_transfer_supported, autopop_supported,
           upgrade_supported, source_version_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT(game_id, version_code) DO UPDATE SET
           platform = excluded.platform,
           region = excluded.region,
           release_kind = excluded.release_kind,
           display_order = excluded.display_order,
           is_native = excluded.is_native,
           native_trophy_list = excluded.native_trophy_list,
           save_transfer_supported = excluded.save_transfer_supported,
           autopop_supported = excluded.autopop_supported,
           upgrade_supported = excluded.upgrade_supported`,
        [
          RE5_GAME_ID,
          version.versionCode,
          version.platform,
          version.region,
          version.releaseKind,
          version.displayOrder,
          Number(version.isNative),
          Number(version.nativeTrophyList),
          Number(version.saveTransferSupported),
          Number(version.autopopSupported),
          Number(version.upgradeSupported)
        ]
      );
    }
    const versionIds = new Map((await database.all(
      'SELECT id, version_code FROM game_versions WHERE game_id = ?',
      [RE5_GAME_ID]
    )).map(row => [row.version_code, row.id]));
    for (const version of normalized.versions) {
      const sourceVersionId = version.sourceVersionCode
        ? versionIds.get(version.sourceVersionCode)
        : null;
      await database.run(
        'UPDATE game_versions SET source_version_id = ? WHERE game_id = ? AND version_code = ?',
        [sourceVersionId, RE5_GAME_ID, version.versionCode]
      );
    }

    for (const pkg of normalized.trophyPackages) {
      await database.run(
        `INSERT INTO trophy_packages
          (game_id, package_code, name, package_type, display_order,
           expected_trophy_count, counts_for_platinum, counts_for_100_percent,
           is_online, is_coop)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(game_id, package_code) DO UPDATE SET
           name = excluded.name,
           package_type = excluded.package_type,
           display_order = excluded.display_order,
           expected_trophy_count = excluded.expected_trophy_count,
           counts_for_platinum = excluded.counts_for_platinum,
           counts_for_100_percent = excluded.counts_for_100_percent,
           is_online = excluded.is_online,
           is_coop = excluded.is_coop`,
        [
          RE5_GAME_ID,
          pkg.packageCode,
          pkg.name,
          pkg.packageType,
          pkg.displayOrder,
          pkg.expectedTrophyCount,
          Number(pkg.countsForPlatinum),
          Number(pkg.countsFor100Percent),
          Number(pkg.isOnline),
          Number(pkg.isCoop)
        ]
      );
    }
    const packageIds = new Map((await database.all(
      'SELECT id, package_code FROM trophy_packages WHERE game_id = ?',
      [RE5_GAME_ID]
    )).map(row => [row.package_code, row.id]));
    const ps4VersionId = versionIds.get('ps4-native');

    for (const trophy of normalized.trophies) {
      const relationalValues = {
        name: trophy.name,
        type: trophy.type,
        description: trophy.description,
        version_id: ps4VersionId,
        package_id: packageIds.get(trophy.packageCode),
        display_order: trophy.displayOrder,
        is_online: Number(trophy.isOnline),
        is_coop: Number(trophy.isCoop),
        is_cumulative: Number(trophy.isCumulative),
        is_missable: Number(trophy.isMissable),
        category: trophy.category,
        source_trophy_code: trophy.sourceTrophyCode
      };
      const updateColumns = Object.keys(relationalValues).filter(column => trophyColumnNames.has(column));
      const update = await database.run(
        `UPDATE trophies
            SET ${updateColumns.map(column => `${column} = ?`).join(', ')}
          WHERE game_id = ? AND trophy_code = ?`,
        [
          ...updateColumns.map(column => relationalValues[column]),
          RE5_GAME_ID,
          trophy.trophyCode
        ]
      );
      if (update.changes !== 1) {
        throw new Error(`RE5_V2_TROPHY_UPSERT_FAILED: ${trophy.trophyCode}`);
      }
    }

    await database.run(
      `INSERT INTO game_guide_payloads
        (game_id, schema_version, payload_json, payload_hash, validation_status)
       VALUES (?, 2, ?, ?, 'valid')
       ON CONFLICT(game_id, schema_version) DO UPDATE SET
         payload_json = excluded.payload_json,
         payload_hash = excluded.payload_hash,
         validation_status = excluded.validation_status`,
      [RE5_GAME_ID, JSON.stringify(normalized), hash]
    );

    const counts = await database.all(
      `SELECT p.package_code, COUNT(*) AS trophy_count
         FROM trophies t
         JOIN trophy_packages p ON p.id = t.package_id
        WHERE t.game_id = ?
        GROUP BY p.package_code`,
      [RE5_GAME_ID]
    );
    const countByPackage = new Map(counts.map(row => [row.package_code, Number(row.trophy_count)]));
    for (const pkg of normalized.trophyPackages) {
      if (countByPackage.get(pkg.packageCode) !== pkg.expectedTrophyCount) {
        throw new Error(`RE5_V2_IMPORT_COUNT_MISMATCH: ${pkg.packageCode}`);
      }
    }

    if (settings.preserveExistingProgress) {
      const progressAfter = await captureUserTrophyProgress(database);
      if (JSON.stringify(progressAfter) !== JSON.stringify(progressBefore)) {
        throw new Error('RE5_V2_IMPORT_PROGRESS_CHANGED');
      }
    }
    if (inTransaction) {
      await database.exec('COMMIT');
      inTransaction = false;
    }
    return { ...resultBase, dryRun: false };
  } catch (error) {
    if (inTransaction) await database.exec('ROLLBACK').catch(() => {});
    throw error;
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
  PROTECTED_VERIFIED_GUIDES,
  runImport,
  validateManifest,
  validateGuide,
  loadGuideRecords,
  assertNoGuideRecordConflicts,
  ensureGuideImportStateTable,
  assertNoStatusDowngrades,
  assertProtectedVerifiedGuideStatuses,
  buildStatusDowngradeErrors,
  buildProtectedVerifiedStatusErrors,
  isVerifiedGuideStatus,
  describeGuideStatus,
  importGuideSnapshotV2
};
