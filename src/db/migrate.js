const { exec, all, run, get } = require('./db');
const { slugifyGameName, buildSlugVariant } = require('../utils/slug');
const { formatTimeMetadata } = require('../utils/time');

async function ensureGameColumns() {
  const columns = await all('PRAGMA table_info(games)');
  const columnNames = new Set(columns.map(column => column.name));

  const statements = [];

  if (!columnNames.has('slug')) {
    statements.push('ALTER TABLE games ADD COLUMN slug TEXT');
  }
  if (!columnNames.has('time_min_hours')) {
    statements.push('ALTER TABLE games ADD COLUMN time_min_hours INTEGER');
  }
  if (!columnNames.has('time_max_hours')) {
    statements.push('ALTER TABLE games ADD COLUMN time_max_hours INTEGER');
  }
  if (!columnNames.has('time_sort_hours')) {
    statements.push('ALTER TABLE games ADD COLUMN time_sort_hours INTEGER');
  }
  if (!columnNames.has('time_bucket')) {
    statements.push('ALTER TABLE games ADD COLUMN time_bucket TEXT');
  }

  for (const statement of statements) {
    await exec(statement);
  }

  await exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_games_slug_unique ON games(slug)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_time_sort_hours ON games(time_sort_hours)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_time_bucket ON games(time_bucket)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at)');
  await exec('CREATE TABLE IF NOT EXISTS game_slug_redirects (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER NOT NULL, slug TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE)');
  await exec('CREATE INDEX IF NOT EXISTS idx_game_slug_redirects_game_id ON game_slug_redirects(game_id)');

  const rows = await all('SELECT id, name, time, slug FROM games ORDER BY id ASC');
  const usedSlugs = new Set();

  for (const row of rows) {
    const baseSlug = slugifyGameName(row.name);
    let slug = row.slug || baseSlug;
    let sequence = 0;
    while (usedSlugs.has(slug) || (await get('SELECT id FROM games WHERE slug = ? AND id != ?', [slug, row.id]))) {
      sequence += 1;
      slug = buildSlugVariant(baseSlug, sequence);
    }
    usedSlugs.add(slug);

    const timeMeta = formatTimeMetadata(row.time);

    await run(
      'UPDATE games SET slug = ?, time_min_hours = ?, time_max_hours = ?, time_sort_hours = ?, time_bucket = ? WHERE id = ?',
      [slug, timeMeta.time_min_hours, timeMeta.time_max_hours, timeMeta.time_sort_hours, timeMeta.time_bucket, row.id]
    );
  }
}

async function migrate() {
  await exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT UNIQUE,
      difficulty INTEGER NOT NULL,
      time TEXT NOT NULL,
      time_min_hours INTEGER,
      time_max_hours INTEGER,
      time_sort_hours INTEGER,
      time_bucket TEXT,
      missable TEXT NOT NULL,
      image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roadmaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      step_order INTEGER NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trophies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      trophy_code TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      tip TEXT NOT NULL,
      is_spoiler INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      UNIQUE (game_id, trophy_code)
    );

    CREATE TABLE IF NOT EXISTS game_slug_redirects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TRIGGER IF NOT EXISTS trg_games_updated_at
    AFTER UPDATE ON games
    FOR EACH ROW
    BEGIN
      UPDATE games SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_admin_users_updated_at
    AFTER UPDATE ON admin_users
    FOR EACH ROW
    BEGIN
      UPDATE admin_users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
  `);

  await ensureGameColumns();
}

module.exports = migrate;
