const { exec, all, run, get } = require('./db');
const sampleGames = require('../data/sampleGames');
const { slugifyGameName, buildSlugVariant } = require('../utils/slug');
const { formatTimeMetadata, getTimeBucketFromHours } = require('../utils/time');

const GAME_SLUG_ALIASES = {
  'little-nightmares-ii': ['little-nightmares'],
  'monster-hunter-world': ['monster-hunter-world-iceborne']
};

const TROPHY_TYPE_ALIASES = {
  platinum: 'Platina',
  platina: 'Platina',
  gold: 'Ouro',
  ouro: 'Ouro',
  silver: 'Prata',
  prata: 'Prata',
  bronze: 'Bronze'
};

function normalizeTrophyType(value) {
  const raw = String(value || '').trim();
  const key = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return TROPHY_TYPE_ALIASES[key] || raw;
}

function deriveSteamCoverImage(imageUrl) {
  const match = String(imageUrl || '').match(/steam\/apps\/(\d+)\/header\.jpg/i);
  return match ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${match[1]}/library_600x900.jpg` : null;
}

function normalizeVerificationStatus(game = {}) {
  if (game.is_verified || game.verification_status === 'verified') return 'verified';
  if (game.verification_status === 'review' || game.editorial_status === 'review') return 'review';
  return 'unverified';
}

function normalizeSeedCoverageLevel(game = {}) {
  const level = game.coverage_level || 'strong';
  return level === 'complete' && normalizeVerificationStatus(game) !== 'verified' ? 'strong' : level;
}

async function ensureGameColumns() {
  const columns = await all('PRAGMA table_info(games)');
  const columnNames = new Set(columns.map(column => column.name));
  const addedColumns = {
    coverageLevel: !columnNames.has('coverage_level')
  };

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
  if (!columnNames.has('guide_runs')) {
    statements.push('ALTER TABLE games ADD COLUMN guide_runs TEXT');
  }
  if (!columnNames.has('guide_online')) {
    statements.push('ALTER TABLE games ADD COLUMN guide_online TEXT');
  }
  if (!columnNames.has('guide_grind')) {
    statements.push('ALTER TABLE games ADD COLUMN guide_grind TEXT');
  }
  if (!columnNames.has('guide_dlc')) {
    statements.push('ALTER TABLE games ADD COLUMN guide_dlc TEXT');
  }
  if (!columnNames.has('guide_ideal')) {
    statements.push('ALTER TABLE games ADD COLUMN guide_ideal TEXT');
  }
  if (!columnNames.has('guide_avoid')) {
    statements.push('ALTER TABLE games ADD COLUMN guide_avoid TEXT');
  }
  if (!columnNames.has('guide_best_moment')) {
    statements.push('ALTER TABLE games ADD COLUMN guide_best_moment TEXT');
  }
  if (!columnNames.has('editorial_status')) {
    statements.push("ALTER TABLE games ADD COLUMN editorial_status TEXT NOT NULL DEFAULT 'published'");
  }
  if (!columnNames.has('coverage_level')) {
    statements.push("ALTER TABLE games ADD COLUMN coverage_level TEXT NOT NULL DEFAULT 'partial'");
  }
  if (!columnNames.has('is_verified')) {
    statements.push('ALTER TABLE games ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnNames.has('verification_note')) {
    statements.push('ALTER TABLE games ADD COLUMN verification_note TEXT');
  }
  if (!columnNames.has('runs_summary')) {
    statements.push('ALTER TABLE games ADD COLUMN runs_summary TEXT');
  }
  if (!columnNames.has('missable_summary')) {
    statements.push('ALTER TABLE games ADD COLUMN missable_summary TEXT');
  }
  if (!columnNames.has('online_summary')) {
    statements.push('ALTER TABLE games ADD COLUMN online_summary TEXT');
  }
  if (!columnNames.has('grind_summary')) {
    statements.push('ALTER TABLE games ADD COLUMN grind_summary TEXT');
  }
  if (!columnNames.has('dlc_scope')) {
    statements.push('ALTER TABLE games ADD COLUMN dlc_scope TEXT');
  }
  if (!columnNames.has('difficulty_reason')) {
    statements.push('ALTER TABLE games ADD COLUMN difficulty_reason TEXT');
  }
  if (!columnNames.has('time_reason')) {
    statements.push('ALTER TABLE games ADD COLUMN time_reason TEXT');
  }
  if (!columnNames.has('first_run_advice')) {
    statements.push('ALTER TABLE games ADD COLUMN first_run_advice TEXT');
  }
  if (!columnNames.has('cleanup_advice')) {
    statements.push('ALTER TABLE games ADD COLUMN cleanup_advice TEXT');
  }
  if (!columnNames.has('before_you_start')) {
    statements.push('ALTER TABLE games ADD COLUMN before_you_start TEXT');
  }
  if (!columnNames.has('best_for')) {
    statements.push('ALTER TABLE games ADD COLUMN best_for TEXT');
  }
  if (!columnNames.has('avoid_if')) {
    statements.push('ALTER TABLE games ADD COLUMN avoid_if TEXT');
  }
  if (!columnNames.has('verification_status')) {
    statements.push("ALTER TABLE games ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified'");
  }
  if (!columnNames.has('cover_image')) {
    statements.push('ALTER TABLE games ADD COLUMN cover_image TEXT');
  }

  for (const statement of statements) {
    await exec(statement);
  }

  await exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_games_slug_unique ON games(slug)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_time_sort_hours ON games(time_sort_hours)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_time_bucket ON games(time_bucket)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_editorial_status ON games(editorial_status)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_coverage_level ON games(coverage_level)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at)');
  await exec('CREATE TABLE IF NOT EXISTS game_slug_redirects (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER NOT NULL, slug TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE)');
  await exec('CREATE INDEX IF NOT EXISTS idx_game_slug_redirects_game_id ON game_slug_redirects(game_id)');

  const rows = await all('SELECT id, name, time, slug, time_min_hours, time_max_hours, time_sort_hours FROM games ORDER BY id ASC');
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
    const storedSortHours = Number(row.time_sort_hours);
    if (!timeMeta.time_bucket && Number.isFinite(storedSortHours) && storedSortHours > 0) {
      const storedMinHours = row.time_min_hours === null || row.time_min_hours === undefined ? null : Number(row.time_min_hours);
      const storedMaxHours = row.time_max_hours === null || row.time_max_hours === undefined ? null : Number(row.time_max_hours);
      timeMeta.time_min_hours = Number.isFinite(storedMinHours) ? storedMinHours : storedSortHours;
      timeMeta.time_max_hours = Number.isFinite(storedMaxHours) ? storedMaxHours : storedSortHours;
      timeMeta.time_sort_hours = storedSortHours;
      timeMeta.time_bucket = getTimeBucketFromHours(storedSortHours);
    }

    await run(
      'UPDATE games SET slug = ?, time_min_hours = ?, time_max_hours = ?, time_sort_hours = ?, time_bucket = ? WHERE id = ?',
      [slug, timeMeta.time_min_hours, timeMeta.time_max_hours, timeMeta.time_sort_hours, timeMeta.time_bucket, row.id]
    );
  }

  return addedColumns;
}

async function ensureTrophyColumns() {
  const columns = await all('PRAGMA table_info(trophies)');
  const columnNames = new Set(columns.map(column => column.name));

  if (!columnNames.has('name_pt')) {
    await exec('ALTER TABLE trophies ADD COLUMN name_pt TEXT');
  }
  if (!columnNames.has('is_missable')) {
    await exec('ALTER TABLE trophies ADD COLUMN is_missable INTEGER NOT NULL DEFAULT 0');
  }
}

async function ensureUserTables() {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
  `);
}

async function ensureUserProgressTables() {
  await exec(`
    CREATE TABLE IF NOT EXISTS user_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'want_to_play' CHECK (status IN ('want_to_play', 'in_progress', 'paused', 'completed')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_opened_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      UNIQUE (user_id, game_id)
    );

    CREATE TABLE IF NOT EXISTS user_trophy_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      trophy_code TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      UNIQUE (user_id, game_id, trophy_code)
    );

    CREATE INDEX IF NOT EXISTS idx_user_library_user ON user_library(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_library_game ON user_library(game_id);
    CREATE INDEX IF NOT EXISTS idx_user_library_user_game ON user_library(user_id, game_id);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_user ON user_trophy_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_game ON user_trophy_progress(game_id);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_trophy ON user_trophy_progress(trophy_code);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_user_game ON user_trophy_progress(user_id, game_id);

    CREATE TRIGGER IF NOT EXISTS trg_user_library_updated_at
    AFTER UPDATE ON user_library
    FOR EACH ROW
    BEGIN
      UPDATE user_library SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_user_trophy_progress_updated_at
    AFTER UPDATE ON user_trophy_progress
    FOR EACH ROW
    BEGIN
      UPDATE user_trophy_progress SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
  `);
}

async function backfillMissableTrophyFlags() {
  const missableCodes = [
    ...new Set(sampleGames.flatMap(game => (
      Array.isArray(game.trophies)
        ? game.trophies.filter(trophy => trophy?.is_missable).map(trophy => trophy.id)
        : []
    )))
  ].filter(Boolean);

  if (!missableCodes.length) return;

  const placeholders = missableCodes.map(() => '?').join(', ');
  await run(
    `UPDATE trophies SET is_missable = 1 WHERE trophy_code IN (${placeholders}) AND is_missable != 1`,
    missableCodes
  );
}

async function backfillCoverImagesFromSeed() {
  const seededCovers = sampleGames
    .map(game => ({
      slug: game.slug || slugifyGameName(game.name),
      coverImage: typeof game.cover_image === 'string' && game.cover_image.trim()
        ? game.cover_image.trim()
        : deriveSteamCoverImage(game.image)
    }))
    .filter(item => item.slug && item.coverImage);

  for (const item of seededCovers) {
    await run(
      "UPDATE games SET cover_image = ? WHERE slug = ? AND (cover_image IS NULL OR trim(cover_image) = '')",
      [item.coverImage, item.slug]
    );
  }
}

async function backfillTrophyTypeAliases() {
  for (const [alias, normalizedType] of Object.entries(TROPHY_TYPE_ALIASES)) {
    await run(
      "UPDATE trophies SET type = ? WHERE lower(trim(type)) = ?",
      [normalizedType, alias]
    );
  }
}

async function backfillTrophyNamePtFromSeed() {
  const translatedTrophies = sampleGames.flatMap(game => {
    const slug = game.slug || slugifyGameName(game.name);
    return (game.trophies || [])
      .filter(trophy => trophy?.id && trophy?.name_pt)
      .map(trophy => ({
        slug,
        trophyCode: trophy.id,
        namePt: trophy.name_pt
      }));
  });

  if (!translatedTrophies.length) return;

  const placeholders = translatedTrophies.map(() => '?').join(', ');
  const missingRow = await get(
    `SELECT COUNT(*) AS total
     FROM trophies
     WHERE trophy_code IN (${placeholders})
       AND (name_pt IS NULL OR trim(name_pt) = '')`,
    translatedTrophies.map(trophy => trophy.trophyCode)
  );
  if (!Number(missingRow?.total || 0)) return;

  await exec('BEGIN TRANSACTION');
  for (const trophy of translatedTrophies) {
    try {
      await run(
        `UPDATE trophies
         SET name_pt = ?
         WHERE trophy_code = ?
           AND game_id = (SELECT id FROM games WHERE slug = ?)
           AND (name_pt IS NULL OR trim(name_pt) = '')`,
        [trophy.namePt, trophy.trophyCode, trophy.slug]
      );
    } catch (error) {
      await exec('ROLLBACK').catch(() => {});
      throw error;
    }
  }
  await exec('COMMIT');
}

function getSeedGameBySlug(slug) {
  return sampleGames.find(game => (game.slug || slugifyGameName(game.name)) === slug);
}

async function shouldSyncSeedGame(seedSlug, options = {}) {
  if (options.forceSync) return true;

  const game = getSeedGameBySlug(seedSlug);
  if (!game) return false;

  const slug = game.slug || slugifyGameName(game.name);
  const existing = await get(
    `SELECT g.id,
            g.difficulty,
            g.time,
            g.time_min_hours,
            g.time_max_hours,
            g.time_sort_hours,
            g.time_bucket,
            g.coverage_level,
            g.is_verified,
            g.verification_status,
            COUNT(DISTINCT t.id) AS trophy_count,
            COUNT(DISTINCT r.id) AS roadmap_count
       FROM games g
       LEFT JOIN trophies t ON t.game_id = g.id
       LEFT JOIN roadmaps r ON r.game_id = g.id
      WHERE g.slug = ? OR g.name = ?
      GROUP BY g.id
      ORDER BY g.id ASC
      LIMIT 1`,
    [slug, game.name]
  );

  if (!existing) return Boolean(options.insertIfMissing);

  const timeMeta = formatTimeMetadata(game.time);
  const expectedTimeMinHours = Number.isFinite(Number(game.time_min_hours)) ? Number(game.time_min_hours) : timeMeta.time_min_hours;
  const expectedTimeMaxHours = Number.isFinite(Number(game.time_max_hours)) ? Number(game.time_max_hours) : timeMeta.time_max_hours;
  const expectedTimeSortHours = Number.isFinite(Number(game.time_sort_hours)) ? Number(game.time_sort_hours) : timeMeta.time_sort_hours;
  const expectedTimeBucket = game.time_bucket || timeMeta.time_bucket;
  const expectedVerificationStatus = normalizeVerificationStatus(game);

  return (
    Number(existing.trophy_count || 0) !== Number((game.trophies || []).length) ||
    Number(existing.roadmap_count || 0) !== Number((game.roadmap || []).length) ||
    Number(existing.difficulty) !== Number(game.difficulty) ||
    existing.time !== game.time ||
    Number(existing.time_min_hours || 0) !== Number(expectedTimeMinHours || 0) ||
    Number(existing.time_max_hours || 0) !== Number(expectedTimeMaxHours || 0) ||
    Number(existing.time_sort_hours || 0) !== Number(expectedTimeSortHours || 0) ||
    existing.time_bucket !== expectedTimeBucket ||
    existing.coverage_level !== normalizeSeedCoverageLevel(game) ||
    Number(existing.is_verified || 0) !== Number(expectedVerificationStatus === 'verified' ? 1 : 0) ||
    existing.verification_status !== expectedVerificationStatus
  );
}

async function syncSeedGameFromSeed(seedSlug, options = {}) {
  const game = getSeedGameBySlug(seedSlug);
  if (!game) return;
  if (!(await shouldSyncSeedGame(seedSlug, options))) return;

  const { insertIfMissing = false } = options;
  const slug = game.slug || slugifyGameName(game.name);
  const existing = await get('SELECT id FROM games WHERE slug = ? OR name = ? ORDER BY id ASC LIMIT 1', [slug, game.name]);

  const timeMeta = formatTimeMetadata(game.time);
  const timeMinHours = Number.isFinite(Number(game.time_min_hours)) ? Number(game.time_min_hours) : timeMeta.time_min_hours;
  const timeMaxHours = Number.isFinite(Number(game.time_max_hours)) ? Number(game.time_max_hours) : timeMeta.time_max_hours;
  const timeSortHours = Number.isFinite(Number(game.time_sort_hours)) ? Number(game.time_sort_hours) : timeMeta.time_sort_hours;
  const timeBucket = game.time_bucket || timeMeta.time_bucket;
  const verificationStatus = normalizeVerificationStatus(game);
  const gameValues = [
    game.name,
    slug,
    game.difficulty,
    game.time,
    timeMinHours,
    timeMaxHours,
    timeSortHours,
    timeBucket,
    game.missable,
    game.runs_summary || game.guide_runs || game.runs || '',
    game.missable_summary || game.missable || '',
    game.online_summary || game.guide_online || game.online || '',
    game.grind_summary || game.guide_grind || game.grind || '',
    game.dlc_scope || game.guide_dlc || game.dlc || '',
    game.difficulty_reason || '',
    game.time_reason || '',
    game.first_run_advice || game.guide_best_moment || game.best_for_when || '',
    game.cleanup_advice || '',
    game.before_you_start || '',
    game.best_for || game.guide_ideal || game.ideal_for || '',
    game.avoid_if || game.guide_avoid || game.avoid_for || '',
    verificationStatus,
    game.editorial_status || 'published',
    normalizeSeedCoverageLevel(game),
    verificationStatus === 'verified' ? 1 : 0,
    game.verification_note || '',
    game.image || null,
    game.cover_image || deriveSteamCoverImage(game.image) || null
  ];

  let gameId = existing?.id;

  if (existing) {
    await run(
      'UPDATE games SET name = ?, slug = ?, difficulty = ?, time = ?, time_min_hours = ?, time_max_hours = ?, time_sort_hours = ?, time_bucket = ?, missable = ?, runs_summary = ?, missable_summary = ?, online_summary = ?, grind_summary = ?, dlc_scope = ?, difficulty_reason = ?, time_reason = ?, first_run_advice = ?, cleanup_advice = ?, before_you_start = ?, best_for = ?, avoid_if = ?, verification_status = ?, editorial_status = ?, coverage_level = ?, is_verified = ?, verification_note = ?, image = ?, cover_image = ? WHERE id = ?',
      [...gameValues, existing.id]
    );
  } else if (insertIfMissing) {
    const result = await run(
      'INSERT INTO games (name, slug, difficulty, time, time_min_hours, time_max_hours, time_sort_hours, time_bucket, missable, runs_summary, missable_summary, online_summary, grind_summary, dlc_scope, difficulty_reason, time_reason, first_run_advice, cleanup_advice, before_you_start, best_for, avoid_if, verification_status, editorial_status, coverage_level, is_verified, verification_note, image, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      gameValues
    );
    gameId = result.lastID;
  } else {
    return;
  }

  await run('DELETE FROM roadmaps WHERE game_id = ?', [gameId]);
  for (let index = 0; index < game.roadmap.length; index += 1) {
    await run(
      'INSERT INTO roadmaps (game_id, step_order, content) VALUES (?, ?, ?)',
      [gameId, index + 1, game.roadmap[index]]
    );
  }

  await run('DELETE FROM trophies WHERE game_id = ?', [gameId]);
  for (const trophy of game.trophies) {
    await run(
      `INSERT INTO trophies (game_id, trophy_code, name, name_pt, type, description, tip, is_missable, is_spoiler)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gameId,
        trophy.id,
        trophy.name,
        trophy.name_pt || null,
        normalizeTrophyType(trophy.type),
        trophy.description,
        trophy.tip,
        trophy.is_missable ? 1 : 0,
        trophy.is_spoiler ? 1 : 0
      ]
    );
  }
}

async function syncReviewedGuidesFromSeed() {
  const existingGames = await get('SELECT COUNT(*) AS total FROM games');
  const syncOptions = {
    insertIfMissing: Number(existingGames?.total || 0) > 0,
    forceSync: process.env.NODE_ENV !== 'test'
  };

  await syncSeedGameFromSeed('ghost-of-tsushima', syncOptions);
  await syncSeedGameFromSeed('horizon-zero-dawn', syncOptions);
  await syncSeedGameFromSeed('horizon-forbidden-west', syncOptions);
  await syncSeedGameFromSeed('mortal-shell', syncOptions);
  await syncSeedGameFromSeed('star-wars-jedi-fallen-order', syncOptions);
  await syncSeedGameFromSeed('star-wars-jedi-survivor', syncOptions);
  await syncSeedGameFromSeed('hogwarts-legacy', syncOptions);
  await syncSeedGameFromSeed('assassins-creed-origins', syncOptions);
  await syncSeedGameFromSeed('assassins-creed-shadows', syncOptions);
  await syncSeedGameFromSeed('prince-of-persia-the-lost-crown', syncOptions);
  await syncSeedGameFromSeed('the-evil-within', syncOptions);
  await syncSeedGameFromSeed('nioh-2', syncOptions);
  await syncSeedGameFromSeed('nioh-3', syncOptions);
  await syncSeedGameFromSeed('resident-evil-requiem', syncOptions);
  await syncSeedGameFromSeed('demons-souls', syncOptions);
  await syncSeedGameFromSeed('dark-souls-remastered', syncOptions);
  await syncSeedGameFromSeed('dark-souls-ii-scholar-of-the-first-sin', syncOptions);
  await syncSeedGameFromSeed('dark-souls-iii', syncOptions);
  await syncSeedGameFromSeed('bloodborne', syncOptions);
  await syncSeedGameFromSeed('sekiro-shadows-die-twice', syncOptions);
  await syncSeedGameFromSeed('armored-core-vi-fires-of-rubicon', syncOptions);
  await syncSeedGameFromSeed('lies-of-p', syncOptions);
  await syncSeedGameFromSeed('lords-of-the-fallen', syncOptions);
  await syncSeedGameFromSeed('death-stranding', syncOptions);
  await syncSeedGameFromSeed('death-stranding-2-on-the-beach', syncOptions);
  await syncSeedGameFromSeed('days-gone', syncOptions);
  await syncSeedGameFromSeed('gran-turismo-7', syncOptions);
  await syncSeedGameFromSeed('final-fantasy-vii-remake', syncOptions);
  await syncSeedGameFromSeed('final-fantasy-vii-rebirth', syncOptions);
  await syncSeedGameFromSeed('final-fantasy-xvi', syncOptions);
  await syncSeedGameFromSeed('persona-5-royal', syncOptions);
  await syncSeedGameFromSeed('persona-3-reload', syncOptions);
  await syncSeedGameFromSeed('metaphor-refantazio', syncOptions);
  await syncSeedGameFromSeed('the-witcher-3-wild-hunt', syncOptions);
  await syncSeedGameFromSeed('cyberpunk-2077', syncOptions);
  await syncSeedGameFromSeed('baldurs-gate-3', syncOptions);
  await syncSeedGameFromSeed('dragons-dogma-2', syncOptions);
  await syncSeedGameFromSeed('ratchet-and-clank-rift-apart', syncOptions);
  await syncSeedGameFromSeed('returnal', syncOptions);
  await syncSeedGameFromSeed('marvels-spider-man', syncOptions);
  await syncSeedGameFromSeed('marvels-spider-man-miles-morales', syncOptions);
  await syncSeedGameFromSeed('marvels-spider-man-2', syncOptions);
  await syncSeedGameFromSeed('god-of-war-2018', syncOptions);
  await syncSeedGameFromSeed('god-of-war-ragnarok', syncOptions);
  await syncSeedGameFromSeed('the-last-of-us-part-i', syncOptions);
  await syncSeedGameFromSeed('the-last-of-us-part-ii', syncOptions);
  await syncSeedGameFromSeed('uncharted-legacy-of-thieves-collection', syncOptions);
  await syncSeedGameFromSeed('life-is-strange-true-colors', syncOptions);
  await syncSeedGameFromSeed('life-is-strange-double-exposure', syncOptions);
  await syncSeedGameFromSeed('life-is-strange-remastered', syncOptions);
  await syncSeedGameFromSeed('road-96', syncOptions);
  await syncSeedGameFromSeed('what-remains-of-edith-finch', syncOptions);
  await syncSeedGameFromSeed('stray', syncOptions);
  await syncSeedGameFromSeed('detroit-become-human', syncOptions);
  await syncSeedGameFromSeed('heavy-rain', syncOptions);
  await syncSeedGameFromSeed('beyond-two-souls', syncOptions);
  await syncSeedGameFromSeed('the-quarry', syncOptions);
  await syncSeedGameFromSeed('until-dawn', syncOptions);
  await syncSeedGameFromSeed('hollow-knight', syncOptions);
  await syncSeedGameFromSeed('it-takes-two', syncOptions);
  await syncSeedGameFromSeed('split-fiction', syncOptions);
  await syncSeedGameFromSeed('a-way-out', syncOptions);
  await syncSeedGameFromSeed('disney-epic-mickey-rebrushed', syncOptions);
  await syncSeedGameFromSeed('little-nightmares-ii', syncOptions);
  await syncSeedGameFromSeed('reanimal', syncOptions);
  await syncSeedGameFromSeed('dead-cells', syncOptions);
  await syncSeedGameFromSeed('monster-hunter-world', syncOptions);
  await syncSeedGameFromSeed('clair-obscur-expedition-33', syncOptions);
}

async function ensureKnownSlugRedirects() {
  for (const [canonicalSlug, aliases] of Object.entries(GAME_SLUG_ALIASES)) {
    const row = await get('SELECT id FROM games WHERE slug = ?', [canonicalSlug]);
    if (!row) continue;

    for (const alias of aliases) {
      const normalizedAlias = slugifyGameName(alias);
      if (!normalizedAlias || normalizedAlias === canonicalSlug) continue;
      await run(
        'INSERT OR IGNORE INTO game_slug_redirects (game_id, slug) VALUES (?, ?)',
        [row.id, normalizedAlias]
      );
    }
  }
}

function inferCoverageLevel(row = {}) {
  const trophyCount = Number(row.trophy_count || 0);
  const roadmapCount = Number(row.roadmap_count || 0);
  const hasTime = Number.isFinite(Number(row.time_sort_hours)) && Number(row.time_sort_hours) > 0;
  const hasMissableContext = typeof row.missable === 'string' && row.missable.trim().length >= 20;
  const hasEditorialContext = [
    row.guide_runs,
    row.guide_online,
    row.guide_grind,
    row.guide_dlc,
    row.guide_ideal,
    row.guide_avoid,
    row.guide_best_moment,
    row.runs_summary,
    row.missable_summary,
    row.online_summary,
    row.grind_summary,
    row.dlc_scope,
    row.difficulty_reason,
    row.time_reason,
    row.first_run_advice,
    row.cleanup_advice,
    row.before_you_start,
    row.best_for,
    row.avoid_if
  ].filter(value => typeof value === 'string' && value.trim().length >= 4).length;

  if (trophyCount >= 30 && roadmapCount >= 4 && hasTime && hasMissableContext && hasEditorialContext >= 3) {
    return 'complete';
  }

  if (trophyCount >= 12 && roadmapCount >= 2 && hasTime && hasMissableContext) {
    return 'strong';
  }

  return 'partial';
}

async function backfillEditorialStatusFields({ recalculateCoverage = false } = {}) {
  await run(
    "UPDATE games SET editorial_status = 'published' WHERE editorial_status IS NULL OR editorial_status NOT IN ('draft', 'review', 'published')"
  );
  await run(
    "UPDATE games SET coverage_level = 'partial' WHERE coverage_level IS NULL OR coverage_level NOT IN ('partial', 'strong', 'complete')"
  );
  await run('UPDATE games SET is_verified = 0 WHERE is_verified IS NULL OR is_verified NOT IN (0, 1)');
  await run(
    "UPDATE games SET runs_summary = guide_runs WHERE (runs_summary IS NULL OR trim(runs_summary) = '') AND guide_runs IS NOT NULL AND trim(guide_runs) != ''"
  );
  await run(
    "UPDATE games SET missable_summary = missable WHERE (missable_summary IS NULL OR trim(missable_summary) = '') AND missable IS NOT NULL AND trim(missable) != ''"
  );
  await run(
    "UPDATE games SET online_summary = guide_online WHERE (online_summary IS NULL OR trim(online_summary) = '') AND guide_online IS NOT NULL AND trim(guide_online) != ''"
  );
  await run(
    "UPDATE games SET grind_summary = guide_grind WHERE (grind_summary IS NULL OR trim(grind_summary) = '') AND guide_grind IS NOT NULL AND trim(guide_grind) != ''"
  );
  await run(
    "UPDATE games SET dlc_scope = guide_dlc WHERE (dlc_scope IS NULL OR trim(dlc_scope) = '') AND guide_dlc IS NOT NULL AND trim(guide_dlc) != ''"
  );
  await run(
    "UPDATE games SET best_for = guide_ideal WHERE (best_for IS NULL OR trim(best_for) = '') AND guide_ideal IS NOT NULL AND trim(guide_ideal) != ''"
  );
  await run(
    "UPDATE games SET avoid_if = guide_avoid WHERE (avoid_if IS NULL OR trim(avoid_if) = '') AND guide_avoid IS NOT NULL AND trim(guide_avoid) != ''"
  );
  await run(
    "UPDATE games SET verification_status = CASE WHEN is_verified = 1 THEN 'verified' WHEN editorial_status = 'review' THEN 'review' ELSE 'unverified' END WHERE verification_status IS NULL OR verification_status NOT IN ('unverified', 'review', 'verified')"
  );
  await run("UPDATE games SET verification_status = 'verified' WHERE is_verified = 1");
  await run("UPDATE games SET is_verified = 1 WHERE verification_status = 'verified'");
  await run("UPDATE games SET is_verified = 0 WHERE verification_status != 'verified' AND is_verified != 0");
  await run(
    "UPDATE games SET coverage_level = 'strong' WHERE coverage_level = 'complete' AND (verification_status != 'verified' OR is_verified != 1)"
  );

  if (!recalculateCoverage) return;

  const rows = await all(`
    SELECT g.id,
           g.verification_status,
           g.is_verified,
           g.time_sort_hours,
           g.missable,
           g.guide_runs,
           g.guide_online,
           g.guide_grind,
           g.guide_dlc,
           g.guide_ideal,
           g.guide_avoid,
           g.guide_best_moment,
           g.runs_summary,
           g.missable_summary,
           g.online_summary,
           g.grind_summary,
           g.dlc_scope,
           g.difficulty_reason,
           g.time_reason,
           g.first_run_advice,
           g.cleanup_advice,
           g.before_you_start,
           g.best_for,
           g.avoid_if,
           COUNT(DISTINCT t.id) AS trophy_count,
           COUNT(DISTINCT r.id) AS roadmap_count
    FROM games g
    LEFT JOIN trophies t ON t.game_id = g.id
    LEFT JOIN roadmaps r ON r.game_id = g.id
    GROUP BY g.id
  `);

  for (const row of rows) {
    const inferredLevel = inferCoverageLevel(row);
    const coverageLevel = inferredLevel === 'complete' && normalizeVerificationStatus(row) !== 'verified'
      ? 'strong'
      : inferredLevel;
    await run('UPDATE games SET coverage_level = ? WHERE id = ?', [coverageLevel, row.id]);
  }
}

function shouldSyncSeedData(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'syncSeedData')) {
    return Boolean(options.syncSeedData);
  }

  return process.env.NODE_ENV !== 'production' && process.env.RUN_SEED_SYNC === 'true';
}

async function migrate(options = {}) {
  await exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
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
      guide_runs TEXT,
      guide_online TEXT,
      guide_grind TEXT,
      guide_dlc TEXT,
      guide_ideal TEXT,
      guide_avoid TEXT,
      guide_best_moment TEXT,
      runs_summary TEXT,
      missable_summary TEXT,
      online_summary TEXT,
      grind_summary TEXT,
      dlc_scope TEXT,
      difficulty_reason TEXT,
      time_reason TEXT,
      first_run_advice TEXT,
      cleanup_advice TEXT,
      before_you_start TEXT,
      best_for TEXT,
      avoid_if TEXT,
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      editorial_status TEXT NOT NULL DEFAULT 'published',
      coverage_level TEXT NOT NULL DEFAULT 'partial',
      is_verified INTEGER NOT NULL DEFAULT 0,
      verification_note TEXT,
      image TEXT,
      cover_image TEXT,
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
      name_pt TEXT,
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

    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('Erro em guia', 'Bug do site', 'Sugestão', 'Pedido de novo guia')),
      related_game TEXT,
      page_url TEXT,
      message TEXT NOT NULL,
      nickname TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'archived')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'want_to_play' CHECK (status IN ('want_to_play', 'in_progress', 'paused', 'completed')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_opened_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      UNIQUE (user_id, game_id)
    );

    CREATE TABLE IF NOT EXISTS user_trophy_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      trophy_code TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      UNIQUE (user_id, game_id, trophy_code)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at);
    CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_user_library_user ON user_library(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_library_game ON user_library(game_id);
    CREATE INDEX IF NOT EXISTS idx_user_library_user_game ON user_library(user_id, game_id);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_user ON user_trophy_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_game ON user_trophy_progress(game_id);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_trophy ON user_trophy_progress(trophy_code);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_user_game ON user_trophy_progress(user_id, game_id);

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

    CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_user_library_updated_at
    AFTER UPDATE ON user_library
    FOR EACH ROW
    BEGIN
      UPDATE user_library SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_user_trophy_progress_updated_at
    AFTER UPDATE ON user_trophy_progress
    FOR EACH ROW
    BEGIN
      UPDATE user_trophy_progress SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
  `);

  const gameColumnChanges = await ensureGameColumns();
  await ensureTrophyColumns();
  await backfillTrophyTypeAliases();
  await ensureUserTables();
  await ensureUserProgressTables();
  await backfillMissableTrophyFlags();
  await backfillCoverImagesFromSeed();
  await backfillTrophyNamePtFromSeed();
  await backfillEditorialStatusFields({ recalculateCoverage: gameColumnChanges.coverageLevel });
  if (shouldSyncSeedData(options)) {
    await syncReviewedGuidesFromSeed();
  }
  await ensureKnownSlugRedirects();
}

module.exports = migrate;
