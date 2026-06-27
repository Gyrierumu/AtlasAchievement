const fs = require('fs');
const path = require('path');

const env = require('../src/config/env');
const {
  parseArgs,
  normalizeDataDir,
  createDatabaseBackup,
  openDatabase,
  normalizeGuideFileName
} = require('./data-sync-utils');

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
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

async function upsertGame(database, guide, gameColumns) {
  const game = { ...(guide.game || {}), slug: guide.slug };
  const existing = await database.get('SELECT id FROM games WHERE slug = ?', [guide.slug]);
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

async function main() {
  const args = parseArgs();
  const apply = Boolean(args.yes || args.apply || process.env.ATLAS_IMPORT_CONFIRM === '1');
  const dataDir = normalizeDataDir(args.dataDir);
  const manifestPath = path.join(dataDir, 'manifest.json');
  const databasePath = path.resolve(env.databasePath);

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest nao encontrado em ${manifestPath}. Rode npm run export:data primeiro.`);
  }

  const manifest = readJson(manifestPath);
  const selectedSlugs = resolveSelectedSlugs(manifest, args.only);
  const guides = selectedSlugs.map(slug => readJson(path.join(dataDir, normalizeGuideFileName(slug))));
  const backupPath = apply ? createDatabaseBackup(databasePath, 'import-data') : null;
  const database = openDatabase(databasePath);

  try {
    await assertRequiredTables(database);
    const gameColumns = filterColumns(GAME_COLUMNS, await getTableColumns(database, 'games'));
    const trophyColumns = filterColumns(TROPHY_COLUMNS, await getTableColumns(database, 'trophies'));
    const existingRows = await database.all('SELECT slug FROM games');
    const existingSlugs = new Set(existingRows.map(row => row.slug));
    const plan = guides.map(guide => ({
      slug: guide.slug,
      action: existingSlugs.has(guide.slug) ? 'update' : 'insert',
      trophies: Array.isArray(guide.trophies) ? guide.trophies.length : 0,
      roadmaps: Array.isArray(guide.roadmaps) ? guide.roadmaps.length : 0,
      redirects: Array.isArray(guide.redirects) ? guide.redirects.length : 0
    }));

    if (!apply) {
      console.log(JSON.stringify({
        ok: true,
        mode: 'dry-run',
        database: databasePath,
        input: dataDir,
        selected: plan.length,
        message: 'Nenhuma alteracao aplicada. Rode npm run import:data -- --yes para importar com backup.',
        plan
      }, null, 2));
      return;
    }

    await database.exec('BEGIN TRANSACTION');
    const summary = { inserted: 0, updated: 0, trophies: 0, roadmaps: 0, redirects: 0 };
    try {
      for (const guide of guides) {
        const result = await upsertGame(database, guide, gameColumns);
        summary[result.action] += 1;
        await replaceRoadmaps(database, result.id, guide.roadmaps || []);
        await replaceTrophies(database, result.id, guide.trophies || [], trophyColumns);
        await preserveAndInsertRedirects(database, result.id, guide.redirects || []);
        summary.trophies += Array.isArray(guide.trophies) ? guide.trophies.length : 0;
        summary.roadmaps += Array.isArray(guide.roadmaps) ? guide.roadmaps.length : 0;
        summary.redirects += Array.isArray(guide.redirects) ? guide.redirects.length : 0;
      }
      await database.exec('COMMIT');
    } catch (error) {
      await database.exec('ROLLBACK').catch(() => {});
      throw error;
    }

    console.log(JSON.stringify({
      ok: true,
      mode: 'import',
      database: databasePath,
      backup: backupPath,
      input: dataDir,
      selected: plan.length,
      summary
    }, null, 2));
  } finally {
    await database.close();
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
