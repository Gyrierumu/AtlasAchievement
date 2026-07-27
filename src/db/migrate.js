const { exec, all, run, get } = require('./db');
const sampleGames = require('../data/sampleGames');
const { slugifyGameName, getCanonicalGameSlug, buildSlugVariant } = require('../utils/slug');
const { formatTimeMetadata, getTimeBucketFromHours } = require('../utils/time');
const guideModel = require('../shared/guideViewModel');
const editorialModel = require('../shared/editorialModel');
const {
  RE5_GAME_ID,
  RE5_SLUG,
  RE5_EXPECTED_COUNTS,
  RE5_EXPECTED_TYPE_COUNTS,
  RE5_BASE_TROPHY_CODES,
  RE5_VERSION_SPECS,
  RE5_PACKAGE_SPECS,
  RE5_ADDITIONAL_TROPHIES
} = require('../shared/re5V2Constants');

const GAME_SLUG_ALIASES = {
  'astros-playroom': [
    "Astro's Playroom",
    'Astros Playroom',
    'Astro Playroom',
    "Astro's Playrrom",
    'astro-s-playroom',
    'astros-playrrom',
    'astro-playroom',
    'astro-s-playrrom'
  ],
  'little-nightmares-ii': ['little-nightmares'],
  'god-of-war': ['god-of-war-2018'],
  'assassin-s-creed-mirage': ['assassins-creed-mirage'],
  'assassin-s-creed-odyssey': ['assassins-creed-odyssey'],
  'assassin-s-creed-origins': ['assassins-creed-origins'],
  'assassin-s-creed-shadows': ['assassins-creed-shadows'],
  'assassin-s-creed-valhalla': ['assassins-creed-valhalla'],
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

function hasManualVerifiedStatus(row = {}) {
  return row?.is_verified === 1
    || row?.is_verified === true
    || row?.verification_status === 'verified'
    || row?.editorial_review_status === 'verified'
    || row?.editorialReviewStatus === 'verified';
}

function hasManualVerificationMetadata(row = {}) {
  return Boolean(row?.reviewed_by || row?.reviewedBy || row?.last_reviewed_at || row?.lastReviewedAt || row?.editorial_notes || row?.editorialNotes);
}

function buildSeedEditorialPersistence(game = {}, existing = null, options = {}) {
  const seedVerificationStatus = normalizeVerificationStatus(game);
  const seedReviewStatus = game.editorial_review_status || game.editorialReviewStatus || null;
  const sanitizeQualityWarningsForPersistence = value => {
    const warnings = editorialModel.parseQualityWarnings(value);
    return warnings.length ? JSON.stringify(warnings) : '[]';
  };
  const seedQualityWarnings = sanitizeQualityWarningsForPersistence(game.quality_warnings || game.qualityWarnings || []);
  const existingQualityWarnings = existing?.quality_warnings
    ? sanitizeQualityWarningsForPersistence(existing.quality_warnings)
    : '';

  const shouldPreserveManualVerification = existing
    && hasManualVerifiedStatus(existing)
    && options.forceEditorialStatus !== true
    && process.env.NODE_ENV === 'production'
    && hasManualVerificationMetadata(existing);

  if (shouldPreserveManualVerification) {
    return {
      verificationStatus: 'verified',
      isVerified: 1,
      editorialReviewStatus: 'verified',
      verificationNote: existing.verification_note || game.verification_note || '',
      lastReviewedAt: existing.last_reviewed_at || game.last_reviewed_at || game.lastReviewedAt || '',
      editorialNotes: existing.editorial_notes || game.editorial_notes || game.editorialNotes || '',
      qualityWarnings: existingQualityWarnings || seedQualityWarnings,
      reviewedBy: existing.reviewed_by || game.reviewed_by || game.reviewedBy || ''
    };
  }

  return {
    verificationStatus: seedVerificationStatus,
    isVerified: seedVerificationStatus === 'verified' ? 1 : 0,
    editorialReviewStatus: seedReviewStatus,
    verificationNote: game.verification_note || '',
    lastReviewedAt: game.last_reviewed_at || game.lastReviewedAt || '',
    editorialNotes: game.editorial_notes || game.editorialNotes || '',
    qualityWarnings: seedQualityWarnings,
    reviewedBy: game.reviewed_by || game.reviewedBy || ''
  };
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
  if (!columnNames.has('editorial_review_status')) {
    statements.push('ALTER TABLE games ADD COLUMN editorial_review_status TEXT');
  }
  if (!columnNames.has('last_reviewed_at')) {
    statements.push('ALTER TABLE games ADD COLUMN last_reviewed_at TEXT');
  }
  if (!columnNames.has('editorial_notes')) {
    statements.push('ALTER TABLE games ADD COLUMN editorial_notes TEXT');
  }
  if (!columnNames.has('quality_warnings')) {
    statements.push('ALTER TABLE games ADD COLUMN quality_warnings TEXT');
  }
  if (!columnNames.has('reviewed_by')) {
    statements.push('ALTER TABLE games ADD COLUMN reviewed_by TEXT');
  }
  if (!columnNames.has('walkthrough')) {
    statements.push('ALTER TABLE games ADD COLUMN walkthrough TEXT');
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
  await exec('CREATE INDEX IF NOT EXISTS idx_games_editorial_review_status ON games(editorial_review_status)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_coverage_level ON games(coverage_level)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at)');
  await exec('CREATE INDEX IF NOT EXISTS idx_games_updated_at ON games(updated_at)');
  await exec('CREATE TABLE IF NOT EXISTS game_slug_redirects (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id INTEGER NOT NULL, slug TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE)');
  await exec('CREATE INDEX IF NOT EXISTS idx_game_slug_redirects_game_id ON game_slug_redirects(game_id)');
  await exec('CREATE TABLE IF NOT EXISTS guide_import_state (slug TEXT PRIMARY KEY, content_hash TEXT NOT NULL, imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, source_file TEXT NOT NULL, import_version INTEGER NOT NULL DEFAULT 1)');
  await exec('CREATE INDEX IF NOT EXISTS idx_guide_import_state_imported_at ON guide_import_state(imported_at)');

  const rows = await all('SELECT id, name, time, slug, time_min_hours, time_max_hours, time_sort_hours FROM games ORDER BY id ASC');
  const usedSlugs = new Set();

  for (const row of rows) {
    const baseSlug = getCanonicalGameSlug(row.slug || row.name);
    let slug = row.slug ? slugifyGameName(row.slug) : baseSlug;
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

async function ensureFeedbackGovernanceColumns() {
  const columns = await all('PRAGMA table_info(feedbacks)');
  const names = new Set(columns.map(column => column.name));
  const definitions = {
    guide_slug: 'TEXT',
    category: 'TEXT',
    section_anchor: 'TEXT',
    platform_version: 'TEXT',
    source_url: 'TEXT',
    frontend_version: 'TEXT',
    report_date: 'TEXT',
    viewport_bucket: 'TEXT',
    active_tab: 'TEXT',
    workflow_state: "TEXT NOT NULL DEFAULT 'NEW'"
  };
  for (const [name, definition] of Object.entries(definitions)) {
    if (!names.has(name)) await exec(`ALTER TABLE feedbacks ADD COLUMN ${name} ${definition}`);
  }
  await exec('CREATE INDEX IF NOT EXISTS idx_feedbacks_guide_slug ON feedbacks(guide_slug)');
  await exec('CREATE INDEX IF NOT EXISTS idx_feedbacks_workflow_state ON feedbacks(workflow_state)');
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

async function ensureGuideCommentTables() {
  await exec(`
    CREATE TABLE IF NOT EXISTS guide_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guide_slug TEXT NOT NULL,
      game_id INTEGER,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden', 'deleted')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      hidden_reason TEXT,
      moderation_note TEXT,
      user_ip_hash TEXT,
      user_agent_hash TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_guide_comments_guide_status ON guide_comments(guide_slug, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_guide_comments_user ON guide_comments(user_id);
    CREATE INDEX IF NOT EXISTS idx_guide_comments_status_created ON guide_comments(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_guide_comments_game_id ON guide_comments(game_id);

    CREATE TRIGGER IF NOT EXISTS trg_guide_comments_updated_at
    AFTER UPDATE ON guide_comments
    FOR EACH ROW
    BEGIN
      UPDATE guide_comments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
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
      slug: getCanonicalGameSlug(game.slug || game.name),
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
    const slug = getCanonicalGameSlug(game.slug || game.name);
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

async function backfillEldenRingTrophyDescriptionsFromSeed() {
  const game = getSeedGameBySlug('elden-ring');
  const localizedTrophies = (game?.trophies || [])
    .filter(trophy => trophy?.id && (trophy.descriptionPtBr || trophy.ptDescription || trophy.localizedDescription?.ptBr || trophy.description))
    .map(trophy => ({
      trophyCode: trophy.id,
      description: trophy.descriptionPtBr || trophy.ptDescription || trophy.localizedDescription?.ptBr || trophy.description
    }));

  if (!localizedTrophies.length) return;

  await exec('BEGIN TRANSACTION');
  for (const trophy of localizedTrophies) {
    try {
      await run(
        `UPDATE trophies
         SET description = ?
         WHERE trophy_code = ?
           AND game_id = (SELECT id FROM games WHERE slug = 'elden-ring')
           AND description != ?`,
        [trophy.description, trophy.trophyCode, trophy.description]
      );
    } catch (error) {
      await exec('ROLLBACK').catch(() => {});
      throw error;
    }
  }
  await exec('COMMIT');
}

async function backfillHadesTrophyLocalizationFromSeed() {
  const game = getSeedGameBySlug('hades');
  const localizedTrophies = (game?.trophies || [])
    .filter(trophy => trophy?.id && (trophy.descriptionPtBr || trophy.ptDescription || trophy.localizedDescription?.ptBr || trophy.description))
    .map(trophy => ({
      trophyCode: trophy.id,
      description: trophy.descriptionPtBr || trophy.ptDescription || trophy.localizedDescription?.ptBr || trophy.description
    }));

  if (!localizedTrophies.length) return;

  await exec('BEGIN TRANSACTION');
  for (const trophy of localizedTrophies) {
    try {
      await run(
        `UPDATE trophies
         SET description = ?,
             is_missable = 0
         WHERE trophy_code = ?
           AND game_id = (SELECT id FROM games WHERE slug = 'hades')
           AND (description != ? OR is_missable != 0)`,
        [trophy.description, trophy.trophyCode, trophy.description]
      );
    } catch (error) {
      await exec('ROLLBACK').catch(() => {});
      throw error;
    }
  }
  await exec('COMMIT');
}

async function backfillTrophyChecklistLocalizationFromSeed(seedSlug) {
  const game = getSeedGameBySlug(seedSlug);
  const localizedTrophies = (game?.trophies || [])
    .filter(trophy => trophy?.id && trophy?.name && trophy?.name_pt && (trophy.descriptionPtBr || trophy.ptDescription || trophy.localizedDescription?.ptBr || trophy.description))
    .map(trophy => ({
      trophyCode: trophy.id,
      name: trophy.name,
      namePt: trophy.name_pt,
      description: trophy.descriptionPtBr || trophy.ptDescription || trophy.localizedDescription?.ptBr || trophy.description
    }));

  if (!localizedTrophies.length) return;

  await exec('BEGIN TRANSACTION');
  for (const trophy of localizedTrophies) {
    try {
      await run(
        `UPDATE trophies
         SET name = ?,
             name_pt = ?,
             description = ?
         WHERE trophy_code = ?
           AND game_id = (SELECT id FROM games WHERE slug = ?)
           AND (name != ? OR name_pt IS NULL OR trim(name_pt) != ? OR description != ?)`,
        [
          trophy.name,
          trophy.namePt,
          trophy.description,
          trophy.trophyCode,
          seedSlug,
          trophy.name,
          trophy.namePt,
          trophy.description
        ]
      );
    } catch (error) {
      await exec('ROLLBACK').catch(() => {});
      throw error;
    }
  }
  await exec('COMMIT');
}

function getSeedGameBySlug(slug) {
  const canonicalSlug = getCanonicalGameSlug(slug);
  return sampleGames.find(game => getCanonicalGameSlug(game.slug || game.name) === canonicalSlug);
}

function normalizeSlugValue(value) {
  return getCanonicalGameSlug(value);
}

function createSeedGameConflictError({ name, existingSlug, newSlug }) {
  return new Error(
    `Conflito de jogo: name ja existe com outro slug. name="${name}", slug existente="${existingSlug || '(vazio)'}", slug novo="${newSlug}".`
  );
}

async function assertNoSeedGameNameSlugConflict(game = {}, slug = '') {
  const name = String(game.name || '').trim();
  const rows = await all(
    'SELECT id, slug, name FROM games WHERE slug = ? OR lower(name) = lower(?) ORDER BY id ASC',
    [slug, name]
  );
  const uniqueRows = rows.filter((row, index) => rows.findIndex(candidate => candidate.id === row.id) === index);

  if (uniqueRows.length > 1) {
    const conflict = uniqueRows.find(row => normalizeSlugValue(row.slug) !== normalizeSlugValue(slug)) || uniqueRows[0];
    throw createSeedGameConflictError({ name, existingSlug: conflict.slug, newSlug: slug });
  }

  const existing = uniqueRows[0];
  const existingSlug = normalizeSlugValue(existing?.slug);
  if (existingSlug && existingSlug !== normalizeSlugValue(slug)) {
    throw createSeedGameConflictError({ name, existingSlug: existing.slug, newSlug: slug });
  }
}

function serializeRoadmapStep(step, index = 0, total = 1) {
  const normalized = guideModel.normalizeRoadmapStep(step, index, total);
  return JSON.stringify({
    title: normalized.title,
    focus: normalized.focus,
    objective: normalized.objective,
    actions: normalized.actions,
    warning: normalized.warning,
    result: normalized.result
  });
}

async function shouldSyncSeedGame(seedSlug, options = {}) {
  if (options.forceSync) return true;

  const game = getSeedGameBySlug(seedSlug);
  if (!game) return false;

  const slug = getCanonicalGameSlug(game.slug || game.name);
  await assertNoSeedGameNameSlugConflict(game, slug);
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
            g.editorial_review_status,
            g.last_reviewed_at,
            g.editorial_notes,
            g.reviewed_by,
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
  const editorialPersistence = buildSeedEditorialPersistence(game, existing, options);
  const coverageSeed = {
    ...game,
    verification_status: editorialPersistence.verificationStatus,
    is_verified: editorialPersistence.isVerified
  };

  return (
    Number(existing.trophy_count || 0) !== Number((game.trophies || []).length) ||
    Number(existing.roadmap_count || 0) !== Number((game.roadmap || []).length) ||
    Number(existing.difficulty) !== Number(game.difficulty) ||
    existing.time !== game.time ||
    Number(existing.time_min_hours || 0) !== Number(expectedTimeMinHours || 0) ||
    Number(existing.time_max_hours || 0) !== Number(expectedTimeMaxHours || 0) ||
    Number(existing.time_sort_hours || 0) !== Number(expectedTimeSortHours || 0) ||
    existing.time_bucket !== expectedTimeBucket ||
    existing.coverage_level !== normalizeSeedCoverageLevel(coverageSeed) ||
    Number(existing.is_verified || 0) !== Number(editorialPersistence.isVerified || 0) ||
    existing.verification_status !== editorialPersistence.verificationStatus ||
    (existing.editorial_review_status || null) !== (editorialPersistence.editorialReviewStatus || null)
  );
}

async function syncSeedGameFromSeed(seedSlug, options = {}) {
  const game = getSeedGameBySlug(seedSlug);
  if (!game) return;
  if (!(await shouldSyncSeedGame(seedSlug, options))) return;

  const { insertIfMissing = false } = options;
  const slug = getCanonicalGameSlug(game.slug || game.name);
  await assertNoSeedGameNameSlugConflict(game, slug);
  const existing = await get(
    `SELECT id,
            is_verified,
            verification_status,
            editorial_review_status,
            verification_note,
            last_reviewed_at,
            editorial_notes,
            quality_warnings,
            reviewed_by
       FROM games
      WHERE slug = ? OR name = ?
      ORDER BY id ASC
      LIMIT 1`,
    [slug, game.name]
  );

  const timeMeta = formatTimeMetadata(game.time);
  const timeMinHours = Number.isFinite(Number(game.time_min_hours)) ? Number(game.time_min_hours) : timeMeta.time_min_hours;
  const timeMaxHours = Number.isFinite(Number(game.time_max_hours)) ? Number(game.time_max_hours) : timeMeta.time_max_hours;
  const timeSortHours = Number.isFinite(Number(game.time_sort_hours)) ? Number(game.time_sort_hours) : timeMeta.time_sort_hours;
  const timeBucket = game.time_bucket || timeMeta.time_bucket;
  const editorialPersistence = buildSeedEditorialPersistence(game, existing, options);
  const coverageSeed = {
    ...game,
    verification_status: editorialPersistence.verificationStatus,
    is_verified: editorialPersistence.isVerified
  };
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
    editorialPersistence.verificationStatus,
    game.editorial_status || 'published',
    normalizeSeedCoverageLevel(coverageSeed),
    editorialPersistence.isVerified,
    editorialPersistence.verificationNote,
    editorialPersistence.editorialReviewStatus,
    editorialPersistence.lastReviewedAt,
    editorialPersistence.editorialNotes,
    editorialPersistence.qualityWarnings,
    editorialPersistence.reviewedBy,
    (() => {
      const walkthrough = guideModel.normalizeWalkthrough(game.walkthrough);
      return walkthrough.length ? JSON.stringify(walkthrough) : '';
    })(),
    game.image || null,
    game.cover_image || deriveSteamCoverImage(game.image) || null
  ];

  let gameId = existing?.id;

  if (existing) {
    await run(
      'UPDATE games SET name = ?, slug = ?, difficulty = ?, time = ?, time_min_hours = ?, time_max_hours = ?, time_sort_hours = ?, time_bucket = ?, missable = ?, runs_summary = ?, missable_summary = ?, online_summary = ?, grind_summary = ?, dlc_scope = ?, difficulty_reason = ?, time_reason = ?, first_run_advice = ?, cleanup_advice = ?, before_you_start = ?, best_for = ?, avoid_if = ?, verification_status = ?, editorial_status = ?, coverage_level = ?, is_verified = ?, verification_note = ?, editorial_review_status = ?, last_reviewed_at = ?, editorial_notes = ?, quality_warnings = ?, reviewed_by = ?, walkthrough = ?, image = ?, cover_image = ? WHERE id = ?',
      [...gameValues, existing.id]
    );
  } else if (insertIfMissing) {
    const result = await run(
      'INSERT INTO games (name, slug, difficulty, time, time_min_hours, time_max_hours, time_sort_hours, time_bucket, missable, runs_summary, missable_summary, online_summary, grind_summary, dlc_scope, difficulty_reason, time_reason, first_run_advice, cleanup_advice, before_you_start, best_for, avoid_if, verification_status, editorial_status, coverage_level, is_verified, verification_note, editorial_review_status, last_reviewed_at, editorial_notes, quality_warnings, reviewed_by, walkthrough, image, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
      [gameId, index + 1, serializeRoadmapStep(game.roadmap[index], index, game.roadmap.length)]
    );
  }

  if (options.preserveTrophyRows === true) {
    await syncSeedGameTrophiesFromSeed(seedSlug);
  } else {
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
}

async function syncSeedGameRoadmapFromSeed(seedSlug) {
  const game = getSeedGameBySlug(seedSlug);
  if (!game || !Array.isArray(game.roadmap)) return;

  const slug = getCanonicalGameSlug(game.slug || game.name);
  await assertNoSeedGameNameSlugConflict(game, slug);
  const existing = await get('SELECT id FROM games WHERE slug = ? OR name = ? ORDER BY id ASC LIMIT 1', [slug, game.name]);
  if (!existing) return;

  await run('DELETE FROM roadmaps WHERE game_id = ?', [existing.id]);
  for (let index = 0; index < game.roadmap.length; index += 1) {
    await run(
      'INSERT INTO roadmaps (game_id, step_order, content) VALUES (?, ?, ?)',
      [existing.id, index + 1, serializeRoadmapStep(game.roadmap[index], index, game.roadmap.length)]
    );
  }
}

async function syncSeedGameTrophiesFromSeed(seedSlug) {
  const game = getSeedGameBySlug(seedSlug);
  if (!game || !Array.isArray(game.trophies) || !game.trophies.length) return;

  const slug = getCanonicalGameSlug(game.slug || game.name);
  await assertNoSeedGameNameSlugConflict(game, slug);
  const existing = await get('SELECT id FROM games WHERE slug = ? OR name = ? ORDER BY id ASC LIMIT 1', [slug, game.name]);
  if (!existing) return;

  const trophyCodes = game.trophies.map(trophy => String(trophy?.id || '').trim()).filter(Boolean);
  if (!trophyCodes.length) return;

  await exec('BEGIN TRANSACTION');
  try {
    for (const trophy of game.trophies) {
      const trophyCode = String(trophy?.id || '').trim();
      if (!trophyCode) continue;

      await run(
        `INSERT INTO trophies (game_id, trophy_code, name, name_pt, type, description, tip, is_missable, is_spoiler)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(game_id, trophy_code) DO UPDATE SET
           name = excluded.name,
           name_pt = excluded.name_pt,
           type = excluded.type,
           description = excluded.description,
           tip = excluded.tip,
           is_missable = excluded.is_missable,
           is_spoiler = excluded.is_spoiler`,
        [
          existing.id,
          trophyCode,
          String(trophy.name || '').trim(),
          trophy.name_pt ? String(trophy.name_pt).trim() : null,
          normalizeTrophyType(trophy.type),
          String(trophy.description || '').trim(),
          String(trophy.tip || '').trim(),
          trophy.is_missable ? 1 : 0,
          trophy.is_spoiler ? 1 : 0
        ]
      );
    }

    const placeholders = trophyCodes.map(() => '?').join(', ');
    await run(
      `DELETE FROM trophies WHERE game_id = ? AND trophy_code NOT IN (${placeholders})`,
      [existing.id, ...trophyCodes]
    );

    await exec('COMMIT');
  } catch (error) {
    await exec('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function syncEldenRingVerifiedGuideFromSeed() {
  const game = getSeedGameBySlug('elden-ring');
  if (!game) return;

  const slug = getCanonicalGameSlug(game.slug || game.name);
  await assertNoSeedGameNameSlugConflict(game, slug);
  const existing = await get(
    `SELECT id,
            is_verified,
            verification_status,
            editorial_review_status,
            verification_note,
            last_reviewed_at,
            editorial_notes,
            quality_warnings,
            reviewed_by
       FROM games
      WHERE slug = ? OR name = ?
      ORDER BY id ASC
      LIMIT 1`,
    [slug, game.name]
  );
  if (!existing) return;

  const timeMeta = formatTimeMetadata(game.time);
  const timeMinHours = Number.isFinite(Number(game.time_min_hours)) ? Number(game.time_min_hours) : timeMeta.time_min_hours;
  const timeMaxHours = Number.isFinite(Number(game.time_max_hours)) ? Number(game.time_max_hours) : timeMeta.time_max_hours;
  const timeSortHours = Number.isFinite(Number(game.time_sort_hours)) ? Number(game.time_sort_hours) : timeMeta.time_sort_hours;
  const timeBucket = game.time_bucket || timeMeta.time_bucket;
  const editorialPersistence = buildSeedEditorialPersistence(game, existing);
  const coverageSeed = {
    ...game,
    verification_status: editorialPersistence.verificationStatus,
    is_verified: editorialPersistence.isVerified
  };

  await run(
    `UPDATE games
        SET name = ?,
            slug = ?,
            difficulty = ?,
            time = ?,
            time_min_hours = ?,
            time_max_hours = ?,
            time_sort_hours = ?,
            time_bucket = ?,
            missable = ?,
            runs_summary = ?,
            missable_summary = ?,
            online_summary = ?,
            grind_summary = ?,
            dlc_scope = ?,
            difficulty_reason = ?,
            time_reason = ?,
            first_run_advice = ?,
            cleanup_advice = ?,
            before_you_start = ?,
            best_for = ?,
            avoid_if = ?,
            verification_status = ?,
            editorial_status = ?,
            coverage_level = ?,
            is_verified = ?,
            verification_note = ?,
            editorial_review_status = ?,
            last_reviewed_at = ?,
            editorial_notes = ?,
            quality_warnings = ?,
            reviewed_by = ?,
            walkthrough = ?,
            image = ?,
            cover_image = ?
      WHERE id = ?`,
    [
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
      editorialPersistence.verificationStatus,
      game.editorial_status || 'published',
      normalizeSeedCoverageLevel(coverageSeed),
      editorialPersistence.isVerified,
      editorialPersistence.verificationNote,
      editorialPersistence.editorialReviewStatus,
      editorialPersistence.lastReviewedAt,
      editorialPersistence.editorialNotes,
      editorialPersistence.qualityWarnings,
      editorialPersistence.reviewedBy,
      (() => {
        const walkthrough = guideModel.normalizeWalkthrough(game.walkthrough);
        return walkthrough.length ? JSON.stringify(walkthrough) : '';
      })(),
      game.image || null,
      game.cover_image || deriveSteamCoverImage(game.image) || null,
      existing.id
    ]
  );

  for (const trophy of game.trophies || []) {
    await run(
      `UPDATE trophies
          SET name = ?,
              name_pt = ?,
              type = ?,
              description = ?,
              tip = ?,
              is_missable = ?,
              is_spoiler = ?
        WHERE game_id = ?
          AND trophy_code = ?`,
      [
        trophy.name,
        trophy.name_pt || null,
        normalizeTrophyType(trophy.type),
        trophy.description,
        trophy.tip,
        trophy.is_missable ? 1 : 0,
        trophy.is_spoiler ? 1 : 0,
        existing.id,
        trophy.id
      ]
    );
  }
}

async function syncSeedGameGuideSummaryAndRoadmapFromSeed(seedSlug) {
  const game = getSeedGameBySlug(seedSlug);
  if (!game || !Array.isArray(game.roadmap)) return;

  const slug = getCanonicalGameSlug(game.slug || game.name);
  await assertNoSeedGameNameSlugConflict(game, slug);
  const existing = await get(
    `SELECT id,
            is_verified,
            verification_status,
            editorial_review_status,
            verification_note,
            last_reviewed_at,
            editorial_notes,
            quality_warnings,
            reviewed_by
       FROM games
      WHERE slug = ? OR name = ?
      ORDER BY id ASC
      LIMIT 1`,
    [slug, game.name]
  );
  if (!existing) return;

  const editorialPersistence = buildSeedEditorialPersistence(game, existing);
  const coverageSeed = {
    ...game,
    verification_status: editorialPersistence.verificationStatus,
    is_verified: editorialPersistence.isVerified
  };

  await run(
    `UPDATE games
        SET runs_summary = ?,
            missable_summary = ?,
            online_summary = ?,
            grind_summary = ?,
            dlc_scope = ?,
            difficulty_reason = ?,
            time_reason = ?,
            first_run_advice = ?,
            cleanup_advice = ?,
            before_you_start = ?,
            best_for = ?,
            avoid_if = ?,
            verification_status = ?,
            editorial_status = ?,
            coverage_level = ?,
            is_verified = ?,
            verification_note = ?,
            editorial_review_status = ?,
            last_reviewed_at = ?,
            editorial_notes = ?,
            quality_warnings = ?,
            reviewed_by = ?
      WHERE id = ?`,
    [
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
      editorialPersistence.verificationStatus,
      game.editorial_status || 'published',
      normalizeSeedCoverageLevel(coverageSeed),
      editorialPersistence.isVerified,
      editorialPersistence.verificationNote,
      editorialPersistence.editorialReviewStatus,
      editorialPersistence.lastReviewedAt,
      editorialPersistence.editorialNotes,
      editorialPersistence.qualityWarnings,
      editorialPersistence.reviewedBy,
      existing.id
    ]
  );

  await syncSeedGameRoadmapFromSeed(seedSlug);
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
  await syncSeedGameFromSeed('assassin-s-creed-origins', syncOptions);
  await syncSeedGameFromSeed('assassin-s-creed-shadows', syncOptions);
  await syncSeedGameFromSeed('assassin-s-creed-valhalla', syncOptions);
  await syncSeedGameFromSeed('prince-of-persia-the-lost-crown', syncOptions);
  await syncSeedGameFromSeed('the-evil-within', syncOptions);
  await syncSeedGameFromSeed('nioh-2', syncOptions);
  await syncSeedGameFromSeed('nioh-3', syncOptions);
  await syncSeedGameFromSeed('resident-evil', { ...syncOptions, preserveTrophyRows: true });
  await syncSeedGameFromSeed('resident-evil-5', syncOptions);
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
  await syncSeedGameFromSeed('god-of-war', syncOptions);
  await syncSeedGameFromSeed('god-of-war-ragnarok', syncOptions);
  await syncSeedGameFromSeed('the-last-of-us-part-i', syncOptions);
  await syncSeedGameFromSeed('the-last-of-us-part-ii', syncOptions);
  await syncSeedGameFromSeed('subnautica', syncOptions);
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
  await syncSeedGameFromSeed('dead-cells', { ...syncOptions, preserveTrophyRows: true });
  await syncSeedGameFromSeed('monster-hunter-world', syncOptions);
  await syncSeedGameFromSeed('pragmata', syncOptions);
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
  await run(
    "UPDATE games SET editorial_review_status = NULL WHERE editorial_review_status IS NOT NULL AND editorial_review_status NOT IN ('verified', 'in_review', 'needs_missables_check', 'needs_online_check', 'dlc_pending', 'outdated', 'draft')"
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
  await run("UPDATE games SET verification_status = 'verified' WHERE editorial_review_status = 'verified'");
  await run("UPDATE games SET verification_status = 'verified' WHERE is_verified = 1");
  await run("UPDATE games SET is_verified = 1 WHERE verification_status = 'verified'");
  await run(
    "UPDATE games SET editorial_review_status = 'verified' WHERE (is_verified = 1 OR verification_status = 'verified') AND (editorial_review_status IS NULL OR editorial_review_status = '' OR editorial_review_status = 'in_review')"
  );
  await run("UPDATE games SET is_verified = 0 WHERE verification_status != 'verified' AND coalesce(editorial_review_status, '') != 'verified' AND is_verified != 0");
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

function isAstrosPlayroomCandidate(row = {}) {
  return getCanonicalGameSlug(row.slug) === 'astros-playroom'
    || getCanonicalGameSlug(row.name) === 'astros-playroom';
}

async function addAstrosPlayroomRedirects(gameId, extraAliases = []) {
  const aliases = [
    ...extraAliases,
    ...(GAME_SLUG_ALIASES['astros-playroom'] || [])
  ];

  for (const alias of aliases) {
    const normalizedAlias = slugifyGameName(alias);
    if (!normalizedAlias || normalizedAlias === 'astros-playroom') continue;
    await run(
      'INSERT OR IGNORE INTO game_slug_redirects (game_id, slug) VALUES (?, ?)',
      [gameId, normalizedAlias]
    );
  }
}

async function mergeUserProgressIntoAstrosPlayroom(sourceGameId, targetGameId) {
  const progressRows = await all(
    `SELECT user_id, trophy_code, completed, completed_at, created_at, updated_at
       FROM user_trophy_progress
      WHERE game_id = ?`,
    [sourceGameId]
  );

  for (const progress of progressRows) {
    const existing = await get(
      `SELECT id, completed, completed_at
         FROM user_trophy_progress
        WHERE user_id = ? AND game_id = ? AND trophy_code = ?`,
      [progress.user_id, targetGameId, progress.trophy_code]
    );

    if (!existing) {
      await run(
        `INSERT INTO user_trophy_progress
          (user_id, game_id, trophy_code, completed, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          progress.user_id,
          targetGameId,
          progress.trophy_code,
          progress.completed,
          progress.completed_at,
          progress.created_at,
          progress.updated_at
        ]
      );
      continue;
    }

    if (Number(progress.completed) && !Number(existing.completed)) {
      await run(
        `UPDATE user_trophy_progress
            SET completed = 1,
                completed_at = ?,
                updated_at = COALESCE(?, CURRENT_TIMESTAMP)
          WHERE id = ?`,
        [progress.completed_at || existing.completed_at, progress.updated_at, existing.id]
      );
    } else if (Number(progress.completed) && Number(existing.completed) && !existing.completed_at && progress.completed_at) {
      await run(
        'UPDATE user_trophy_progress SET completed_at = ? WHERE id = ?',
        [progress.completed_at, existing.id]
      );
    }
  }

  await run('DELETE FROM user_trophy_progress WHERE game_id = ?', [sourceGameId]);
}

async function mergeAstrosPlayroomDuplicates() {
  const rows = await all('SELECT id, name, slug FROM games ORDER BY id ASC');
  const candidates = rows.filter(isAstrosPlayroomCandidate);
  if (candidates.length === 0) return;

  const canonical = candidates.find(row => row.slug === 'astros-playroom') || candidates[0];
  const duplicates = candidates.filter(row => row.id !== canonical.id);

  if (canonical.slug !== 'astros-playroom') {
    await run('UPDATE games SET slug = ? WHERE id = ?', ['astros-playroom', canonical.id]);
  }

  for (const duplicate of duplicates) {
    const duplicateAliases = [duplicate.slug, duplicate.name].filter(Boolean);
    await run('DELETE FROM game_slug_redirects WHERE game_id = ?', [duplicate.id]);
    await addAstrosPlayroomRedirects(canonical.id, duplicateAliases);
    await run(
      `INSERT OR IGNORE INTO user_library
        (user_id, game_id, status, created_at, updated_at, last_opened_at)
       SELECT user_id, ?, status, created_at, updated_at, last_opened_at
         FROM user_library
        WHERE game_id = ?`,
      [canonical.id, duplicate.id]
    );
    await run('DELETE FROM user_library WHERE game_id = ?', [duplicate.id]);
    await mergeUserProgressIntoAstrosPlayroom(duplicate.id, canonical.id);
    await run('UPDATE analytics_events SET game_slug = ? WHERE game_slug = ?', ['astros-playroom', duplicate.slug]);
    await run('DELETE FROM roadmaps WHERE game_id = ?', [duplicate.id]);
    await run('DELETE FROM trophies WHERE game_id = ?', [duplicate.id]);
    await run('DELETE FROM games WHERE id = ?', [duplicate.id]);
  }

  await run('UPDATE games SET name = ?, slug = ? WHERE id = ?', ['Astro’s Playroom', 'astros-playroom', canonical.id]);
  await addAstrosPlayroomRedirects(canonical.id);
}

const DEFAULT_DATABASE = { exec, all, run, get };
const RE5_V2_TROPHY_COLUMN_DEFINITIONS = Object.freeze({
  version_id: 'INTEGER',
  package_id: 'INTEGER',
  display_order: 'INTEGER',
  is_online: 'INTEGER NOT NULL DEFAULT 0',
  is_coop: 'INTEGER NOT NULL DEFAULT 0',
  is_cumulative: 'INTEGER NOT NULL DEFAULT 0',
  is_missable: 'INTEGER NOT NULL DEFAULT 0',
  category: 'TEXT',
  source_trophy_code: 'TEXT'
});

async function tableExistsInDatabase(database, tableName) {
  const row = await database.get(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName]
  );
  return Boolean(row);
}

async function getTableColumnNames(database, tableName) {
  const columns = await database.all(`PRAGMA table_info(${tableName})`);
  return new Set(columns.map(column => column.name));
}

async function captureRe5Progress(database) {
  if (!await tableExistsInDatabase(database, 'user_trophy_progress')) return [];
  return database.all('SELECT * FROM user_trophy_progress ORDER BY id');
}

async function ensureRe5V2Tables(database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS game_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      version_code TEXT NOT NULL,
      platform TEXT NOT NULL,
      region TEXT NOT NULL DEFAULT 'global',
      release_kind TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      is_native INTEGER NOT NULL DEFAULT 0,
      native_trophy_list INTEGER NOT NULL DEFAULT 0,
      save_transfer_supported INTEGER NOT NULL DEFAULT 0,
      autopop_supported INTEGER NOT NULL DEFAULT 0,
      upgrade_supported INTEGER NOT NULL DEFAULT 0,
      source_version_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (source_version_id)
        REFERENCES game_versions(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      UNIQUE (game_id, version_code),
      UNIQUE (game_id, display_order),
      CHECK (display_order > 0),
      CHECK (is_native IN (0, 1)),
      CHECK (native_trophy_list IN (0, 1)),
      CHECK (save_transfer_supported IN (0, 1)),
      CHECK (autopop_supported IN (0, 1)),
      CHECK (upgrade_supported IN (0, 1)),
      CHECK (release_kind IN ('native', 'backward_compatibility')),
      CHECK (release_kind <> 'backward_compatibility' OR is_native = 0),
      CHECK (native_trophy_list = 0 OR is_native = 1)
    );

    CREATE INDEX IF NOT EXISTS idx_game_versions_game_id
      ON game_versions(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_versions_platform
      ON game_versions(platform);
    CREATE INDEX IF NOT EXISTS idx_game_versions_source_version_id
      ON game_versions(source_version_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_game_versions_one_native_list
      ON game_versions(game_id)
      WHERE native_trophy_list = 1;
    CREATE TRIGGER IF NOT EXISTS trg_game_versions_updated_at
      AFTER UPDATE ON game_versions
      FOR EACH ROW
      BEGIN
        UPDATE game_versions SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

    CREATE TABLE IF NOT EXISTS trophy_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      package_code TEXT NOT NULL,
      name TEXT NOT NULL,
      package_type TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      expected_trophy_count INTEGER NOT NULL,
      counts_for_platinum INTEGER NOT NULL DEFAULT 0,
      counts_for_100_percent INTEGER NOT NULL DEFAULT 1,
      is_online INTEGER NOT NULL DEFAULT 0,
      is_coop INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE CASCADE ON DELETE CASCADE,
      UNIQUE (game_id, package_code),
      UNIQUE (game_id, display_order),
      CHECK (display_order > 0),
      CHECK (expected_trophy_count > 0),
      CHECK (counts_for_platinum IN (0, 1)),
      CHECK (counts_for_100_percent IN (0, 1)),
      CHECK (is_online IN (0, 1)),
      CHECK (is_coop IN (0, 1)),
      CHECK (counts_for_platinum = 1 OR counts_for_100_percent = 1),
      CHECK (package_type IN ('base', 'dlc', 'mode'))
    );

    CREATE INDEX IF NOT EXISTS idx_trophy_packages_game_id
      ON trophy_packages(game_id);
    CREATE INDEX IF NOT EXISTS idx_trophy_packages_package_type
      ON trophy_packages(package_type);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_trophy_packages_one_base
      ON trophy_packages(game_id)
      WHERE package_type = 'base';
    CREATE TRIGGER IF NOT EXISTS trg_trophy_packages_updated_at
      AFTER UPDATE ON trophy_packages
      FOR EACH ROW
      BEGIN
        UPDATE trophy_packages SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

    CREATE TABLE IF NOT EXISTS game_guide_payloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      schema_version INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON UPDATE CASCADE ON DELETE CASCADE,
      UNIQUE (game_id, schema_version),
      CHECK (schema_version > 0),
      CHECK (validation_status IN ('valid', 'invalid', 'pending'))
    );

    CREATE INDEX IF NOT EXISTS idx_game_guide_payloads_game_id
      ON game_guide_payloads(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_guide_payloads_payload_hash
      ON game_guide_payloads(payload_hash);
    CREATE INDEX IF NOT EXISTS idx_game_guide_payloads_validation_status
      ON game_guide_payloads(validation_status);
    CREATE TRIGGER IF NOT EXISTS trg_game_guide_payloads_updated_at
      AFTER UPDATE ON game_guide_payloads
      FOR EACH ROW
      BEGIN
        UPDATE game_guide_payloads SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;
  `);
}

async function ensureRe5V2TrophyColumns(database) {
  const columnNames = await getTableColumnNames(database, 'trophies');
  for (const [columnName, definition] of Object.entries(RE5_V2_TROPHY_COLUMN_DEFINITIONS)) {
    if (!columnNames.has(columnName)) {
      await database.exec(`ALTER TABLE trophies ADD COLUMN ${columnName} ${definition}`);
      columnNames.add(columnName);
    }
  }

  // SQLite cannot add a complete package_id foreign key with ALTER TABLE.
  // Referential integrity is enforced transactionally below; a global table
  // rebuild requires a separate migration and full cross-game backup.
  await database.exec(`
    CREATE INDEX IF NOT EXISTS idx_trophies_version_id
      ON trophies(version_id);
    CREATE INDEX IF NOT EXISTS idx_trophies_package_id
      ON trophies(package_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_trophies_game_package_display_order_unique
      ON trophies(game_id, package_id, display_order)
      WHERE package_id IS NOT NULL AND display_order IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_trophies_game_source_trophy_code
      ON trophies(game_id, source_trophy_code);
  `);
  return columnNames;
}

async function requireRe5Game(database) {
  const game = await database.get(
    'SELECT id, slug FROM games WHERE id = ?',
    [RE5_GAME_ID]
  );
  if (!game) {
    throw new Error(`RE5_V2_GAME_NOT_FOUND: game ${RE5_GAME_ID} is required`);
  }
  if (game.slug !== RE5_SLUG) {
    throw new Error(`RE5_V2_GAME_SLUG_MISMATCH: expected ${RE5_SLUG}`);
  }
}

async function insertAndValidateRe5Versions(database) {
  const ps4 = RE5_VERSION_SPECS[0];
  await database.run(
    `INSERT INTO game_versions
      (game_id, version_code, platform, region, release_kind, display_order,
       is_native, native_trophy_list, save_transfer_supported, autopop_supported,
       upgrade_supported, source_version_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(game_id, version_code) DO NOTHING`,
    [
      RE5_GAME_ID,
      ps4.versionCode,
      ps4.platform,
      ps4.region,
      ps4.releaseKind,
      ps4.displayOrder,
      Number(ps4.isNative),
      Number(ps4.nativeTrophyList),
      Number(ps4.saveTransferSupported),
      Number(ps4.autopopSupported),
      Number(ps4.upgradeSupported)
    ]
  );
  const ps4Row = await database.get(
    'SELECT * FROM game_versions WHERE game_id = ? AND version_code = ?',
    [RE5_GAME_ID, ps4.versionCode]
  );
  if (!ps4Row) throw new Error('RE5_V2_PS4_VERSION_MISSING');

  const ps5 = RE5_VERSION_SPECS[1];
  await database.run(
    `INSERT INTO game_versions
      (game_id, version_code, platform, region, release_kind, display_order,
       is_native, native_trophy_list, save_transfer_supported, autopop_supported,
       upgrade_supported, source_version_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_id, version_code) DO NOTHING`,
    [
      RE5_GAME_ID,
      ps5.versionCode,
      ps5.platform,
      ps5.region,
      ps5.releaseKind,
      ps5.displayOrder,
      Number(ps5.isNative),
      Number(ps5.nativeTrophyList),
      Number(ps5.saveTransferSupported),
      Number(ps5.autopopSupported),
      Number(ps5.upgradeSupported),
      ps4Row.id
    ]
  );

  const rows = await database.all(
    'SELECT * FROM game_versions WHERE game_id = ? ORDER BY display_order',
    [RE5_GAME_ID]
  );
  if (rows.length !== 2) throw new Error('RE5_V2_INVALID_VERSION_COUNT');

  for (const spec of RE5_VERSION_SPECS) {
    const row = rows.find(item => item.version_code === spec.versionCode);
    const sourceVersionId = spec.sourceVersionCode ? ps4Row.id : null;
    const expected = {
      platform: spec.platform,
      region: spec.region,
      release_kind: spec.releaseKind,
      display_order: spec.displayOrder,
      is_native: Number(spec.isNative),
      native_trophy_list: Number(spec.nativeTrophyList),
      save_transfer_supported: Number(spec.saveTransferSupported),
      autopop_supported: Number(spec.autopopSupported),
      upgrade_supported: Number(spec.upgradeSupported),
      source_version_id: sourceVersionId
    };
    if (!row) throw new Error(`RE5_V2_VERSION_MISSING: ${spec.versionCode}`);
    for (const [field, value] of Object.entries(expected)) {
      if (row[field] !== value) {
        throw new Error(`RE5_V2_VERSION_CONFLICT: ${spec.versionCode}.${field}`);
      }
    }
  }
  return { ps4VersionId: ps4Row.id, rows };
}

async function insertAndValidateRe5Packages(database) {
  for (const spec of RE5_PACKAGE_SPECS) {
    await database.run(
      `INSERT INTO trophy_packages
        (game_id, package_code, name, package_type, display_order,
         expected_trophy_count, counts_for_platinum, counts_for_100_percent,
         is_online, is_coop)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(game_id, package_code) DO NOTHING`,
      [
        RE5_GAME_ID,
        spec.packageCode,
        spec.name,
        spec.packageType,
        spec.displayOrder,
        spec.expectedTrophyCount,
        Number(spec.countsForPlatinum),
        Number(spec.countsFor100Percent),
        Number(spec.isOnline),
        Number(spec.isCoop)
      ]
    );
  }

  const rows = await database.all(
    'SELECT * FROM trophy_packages WHERE game_id = ? ORDER BY display_order',
    [RE5_GAME_ID]
  );
  if (rows.length !== 4) throw new Error('RE5_V2_INVALID_PACKAGE_COUNT');

  for (const spec of RE5_PACKAGE_SPECS) {
    const row = rows.find(item => item.package_code === spec.packageCode);
    const expected = {
      name: spec.name,
      package_type: spec.packageType,
      display_order: spec.displayOrder,
      expected_trophy_count: spec.expectedTrophyCount,
      counts_for_platinum: Number(spec.countsForPlatinum),
      counts_for_100_percent: Number(spec.countsFor100Percent),
      is_online: Number(spec.isOnline),
      is_coop: Number(spec.isCoop)
    };
    if (!row) throw new Error(`RE5_V2_PACKAGE_MISSING: ${spec.packageCode}`);
    for (const [field, value] of Object.entries(expected)) {
      if (row[field] !== value) {
        throw new Error(`RE5_V2_PACKAGE_CONFLICT: ${spec.packageCode}.${field}`);
      }
    }
  }
  return rows;
}

async function validateRe5LegacyTrophies(database) {
  const rows = await database.all(
    'SELECT id, trophy_code, type FROM trophies WHERE game_id = ? ORDER BY id',
    [RE5_GAME_ID]
  );
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.trophy_code, (counts.get(row.trophy_code) || 0) + 1);
  }

  const missing = RE5_BASE_TROPHY_CODES.filter(code => !counts.has(code));
  const duplicated = RE5_BASE_TROPHY_CODES.filter(code => counts.get(code) !== 1);
  if (missing.length) {
    throw new Error(`RE5_V2_BASE_TROPHY_MISSING: ${missing.join(',')}`);
  }
  if (duplicated.length) {
    throw new Error(`RE5_V2_BASE_TROPHY_DUPLICATED: ${duplicated.join(',')}`);
  }

  const allowedCodes = new Set([
    ...RE5_BASE_TROPHY_CODES,
    ...RE5_ADDITIONAL_TROPHIES.map(item => item.trophyCode)
  ]);
  const unexpected = rows.filter(row => !allowedCodes.has(row.trophy_code));
  if (unexpected.length) {
    throw new Error(`RE5_V2_CONFLICTING_TROPHY: ${unexpected.map(item => item.trophy_code).join(',')}`);
  }

  const additionalCount = rows.filter(row => !RE5_BASE_TROPHY_CODES.includes(row.trophy_code)).length;
  if (additionalCount !== 0 && additionalCount !== RE5_ADDITIONAL_TROPHIES.length) {
    throw new Error(`RE5_V2_PARTIAL_ADDITIONAL_SET: ${additionalCount}`);
  }

  const baseRows = RE5_BASE_TROPHY_CODES.map(code => rows.find(row => row.trophy_code === code));
  return {
    baseRows,
    baseIds: baseRows.map(row => row.id),
    additionalCount
  };
}

async function backfillRe5BaseTrophies(database, packageId, ps4VersionId) {
  for (let index = 0; index < RE5_BASE_TROPHY_CODES.length; index += 1) {
    const result = await database.run(
      `UPDATE trophies
       SET package_id = ?,
           version_id = ?,
           display_order = ?,
           is_online = 0,
           category = COALESCE(category, 'base')
       WHERE game_id = ? AND trophy_code = ?`,
      [packageId, ps4VersionId, index + 1, RE5_GAME_ID, RE5_BASE_TROPHY_CODES[index]]
    );
    if (result.changes !== 1) {
      throw new Error(`RE5_V2_BASE_BACKFILL_FAILED: ${RE5_BASE_TROPHY_CODES[index]}`);
    }
  }
}

function buildAdditionalTrophyInsert(columnNames, trophy, packageId, ps4VersionId) {
  const valuesByColumn = {
    game_id: RE5_GAME_ID,
    trophy_code: trophy.trophyCode,
    name: trophy.trophyCode,
    name_pt: null,
    type: trophy.type,
    description: '',
    tip: '',
    is_spoiler: 0,
    version_id: ps4VersionId,
    package_id: packageId,
    display_order: trophy.displayOrder,
    is_online: Number(trophy.isOnline),
    is_coop: 0,
    is_cumulative: 0,
    is_missable: 0,
    category: trophy.packageCode,
    source_trophy_code: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const insertColumns = Object.keys(valuesByColumn).filter(column => columnNames.has(column));
  return {
    sql: `INSERT INTO trophies (${insertColumns.join(', ')})
          VALUES (${insertColumns.map(() => '?').join(', ')})`,
    values: insertColumns.map(column => valuesByColumn[column])
  };
}

async function insertRe5AdditionalTrophies(
  database,
  columnNames,
  packageRows,
  ps4VersionId
) {
  const packageIds = new Map(packageRows.map(row => [row.package_code, row.id]));
  let inserted = 0;
  for (const trophy of RE5_ADDITIONAL_TROPHIES) {
    const existing = await database.get(
      'SELECT id FROM trophies WHERE game_id = ? AND trophy_code = ?',
      [RE5_GAME_ID, trophy.trophyCode]
    );
    if (existing) continue;
    const statement = buildAdditionalTrophyInsert(
      columnNames,
      trophy,
      packageIds.get(trophy.packageCode),
      ps4VersionId
    );
    const result = await database.run(statement.sql, statement.values);
    if (result.changes !== 1) {
      throw new Error(`RE5_V2_ADDITIONAL_INSERT_FAILED: ${trophy.trophyCode}`);
    }
    inserted += 1;
  }
  return inserted;
}

async function validateRe5V2MigrationIntegrity(
  database,
  preservedBaseIds,
  preservedProgress
) {
  const versions = await database.all(
    'SELECT * FROM game_versions WHERE game_id = ? ORDER BY display_order',
    [RE5_GAME_ID]
  );
  if (versions.length !== 2) throw new Error('RE5_V2_POSTCHECK_VERSION_COUNT');
  if (versions.filter(item => item.native_trophy_list === 1).length !== 1) {
    throw new Error('RE5_V2_POSTCHECK_NATIVE_LIST_COUNT');
  }
  const ps4 = versions.find(item => item.version_code === 'ps4-native');
  const ps5 = versions.find(item => item.version_code === 'ps5-backcompat-ps4');
  if (
    !ps4
    || !ps5
    || ps5.source_version_id !== ps4.id
    || ps5.is_native !== 0
    || ps5.native_trophy_list !== 0
    || ps5.autopop_supported !== 0
    || ps5.upgrade_supported !== 0
  ) {
    throw new Error('RE5_V2_POSTCHECK_BACKWARD_COMPATIBILITY');
  }

  const packages = await database.all(
    'SELECT * FROM trophy_packages WHERE game_id = ? ORDER BY display_order',
    [RE5_GAME_ID]
  );
  if (packages.length !== 4) throw new Error('RE5_V2_POSTCHECK_PACKAGE_COUNT');
  if (packages.filter(item => item.package_type === 'base').length !== 1) {
    throw new Error('RE5_V2_POSTCHECK_BASE_PACKAGE_COUNT');
  }

  const trophies = await database.all(
    `SELECT t.id, t.trophy_code, t.type, t.package_id, t.version_id,
            t.display_order, t.is_online, p.package_code
     FROM trophies t
     LEFT JOIN trophy_packages p ON p.id = t.package_id
     WHERE t.game_id = ?
     ORDER BY p.display_order, t.display_order`,
    [RE5_GAME_ID]
  );
  if (trophies.length !== RE5_EXPECTED_COUNTS.total) {
    throw new Error(`RE5_V2_POSTCHECK_TOTAL: ${trophies.length}`);
  }
  if (trophies.some(item => !item.package_id || !item.version_id || !item.display_order)) {
    throw new Error('RE5_V2_POSTCHECK_NULL_RELATION');
  }
  if (new Set(trophies.map(item => item.trophy_code)).size !== trophies.length) {
    throw new Error('RE5_V2_POSTCHECK_DUPLICATE_CODE');
  }

  for (const spec of RE5_PACKAGE_SPECS) {
    const packageRow = packages.find(item => item.package_code === spec.packageCode);
    const packageTrophies = trophies.filter(item => item.package_code === spec.packageCode);
    if (
      !packageRow
      || packageTrophies.length !== spec.expectedTrophyCount
      || packageRow.expected_trophy_count !== packageTrophies.length
    ) {
      throw new Error(`RE5_V2_POSTCHECK_PACKAGE_TOTAL: ${spec.packageCode}`);
    }
    if (new Set(packageTrophies.map(item => item.display_order)).size !== packageTrophies.length) {
      throw new Error(`RE5_V2_POSTCHECK_DUPLICATE_ORDER: ${spec.packageCode}`);
    }
  }

  for (const [type, expected] of Object.entries(RE5_EXPECTED_TYPE_COUNTS)) {
    const count = trophies.filter(item => item.type === type).length;
    if (count !== expected) {
      throw new Error(`RE5_V2_POSTCHECK_TYPE_TOTAL: ${type}=${count}`);
    }
  }
  const versus = trophies.filter(item => item.package_code === 'versus');
  if (versus.length !== 10 || versus.some(item => item.is_online !== 1)) {
    throw new Error('RE5_V2_POSTCHECK_VERSUS_ONLINE');
  }

  const currentBaseIds = RE5_BASE_TROPHY_CODES.map(code => (
    trophies.find(item => item.trophy_code === code)?.id
  ));
  if (JSON.stringify(currentBaseIds) !== JSON.stringify(preservedBaseIds)) {
    throw new Error('RE5_V2_POSTCHECK_BASE_IDS_CHANGED');
  }
  const currentProgress = await captureRe5Progress(database);
  if (JSON.stringify(currentProgress) !== JSON.stringify(preservedProgress)) {
    throw new Error('RE5_V2_POSTCHECK_PROGRESS_CHANGED');
  }

  const foreignKeyErrors = [];
  for (const tableName of ['game_versions', 'trophy_packages', 'game_guide_payloads']) {
    foreignKeyErrors.push(...await database.all(`PRAGMA foreign_key_check(${tableName})`));
  }
  if (foreignKeyErrors.length) throw new Error('RE5_V2_POSTCHECK_FOREIGN_KEY');

  return {
    versions: versions.length,
    packages: packages.length,
    trophies: trophies.length,
    base: trophies.filter(item => item.package_code === 'base').length,
    versus: versus.length,
    lostInNightmares: trophies.filter(item => item.package_code === 'lost-in-nightmares').length,
    desperateEscape: trophies.filter(item => item.package_code === 'desperate-escape').length
  };
}

async function migrateGuideSchemaV2PackagesAndVersions(database = DEFAULT_DATABASE) {
  if (
    !database
    || typeof database.exec !== 'function'
    || typeof database.all !== 'function'
    || typeof database.run !== 'function'
    || typeof database.get !== 'function'
  ) {
    throw new TypeError('A database adapter with exec/all/run/get is required');
  }

  await database.exec('PRAGMA foreign_keys = ON');
  await database.exec('BEGIN IMMEDIATE');
  try {
    await requireRe5Game(database);
    const preservedProgress = await captureRe5Progress(database);
    await ensureRe5V2Tables(database);
    const trophyColumnNames = await ensureRe5V2TrophyColumns(database);
    const { ps4VersionId } = await insertAndValidateRe5Versions(database);
    const packageRows = await insertAndValidateRe5Packages(database);
    const legacy = await validateRe5LegacyTrophies(database);
    const basePackage = packageRows.find(item => item.package_code === 'base');

    await backfillRe5BaseTrophies(database, basePackage.id, ps4VersionId);
    const additionalInserted = await insertRe5AdditionalTrophies(
      database,
      trophyColumnNames,
      packageRows,
      ps4VersionId
    );
    const integrity = await validateRe5V2MigrationIntegrity(
      database,
      legacy.baseIds,
      preservedProgress
    );
    await database.exec('COMMIT');

    return {
      gameId: RE5_GAME_ID,
      baseFound: legacy.baseRows.length,
      baseUpdated: RE5_BASE_TROPHY_CODES.length,
      baseIdsPreserved: true,
      trophyCodesPreserved: true,
      progressPreserved: true,
      additionalInserted,
      ...integrity
    };
  } catch (error) {
    await database.exec('ROLLBACK').catch(() => {});
    throw error;
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
      editorial_review_status TEXT,
      last_reviewed_at TEXT,
      editorial_notes TEXT,
      quality_warnings TEXT,
      reviewed_by TEXT,
      walkthrough TEXT,
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

    CREATE TABLE IF NOT EXISTS guide_import_state (
      slug TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source_file TEXT NOT NULL,
      import_version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('Erro em guia', 'Bug do site', 'Sugestão', 'Pedido de novo guia')),
      related_game TEXT,
      page_url TEXT,
      message TEXT NOT NULL,
      nickname TEXT,
      email TEXT,
      guide_slug TEXT,
      category TEXT,
      section_anchor TEXT,
      platform_version TEXT,
      source_url TEXT,
      frontend_version TEXT,
      report_date TEXT,
      viewport_bucket TEXT,
      active_tab TEXT,
      workflow_state TEXT NOT NULL DEFAULT 'NEW',
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'archived')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      page TEXT,
      game_slug TEXT,
      metadata_json TEXT,
      anonymous_session_id TEXT,
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

    CREATE TABLE IF NOT EXISTS guide_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guide_slug TEXT NOT NULL,
      game_id INTEGER,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden', 'deleted')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      hidden_reason TEXT,
      moderation_note TEXT,
      user_ip_hash TEXT,
      user_agent_hash TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_guide_import_state_imported_at ON guide_import_state(imported_at);
    CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at);
    CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events(event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_game_slug ON analytics_events(game_slug);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_page ON analytics_events(page);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_user_library_user ON user_library(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_library_game ON user_library(game_id);
    CREATE INDEX IF NOT EXISTS idx_user_library_user_game ON user_library(user_id, game_id);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_user ON user_trophy_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_game ON user_trophy_progress(game_id);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_trophy ON user_trophy_progress(trophy_code);
    CREATE INDEX IF NOT EXISTS idx_user_trophy_progress_user_game ON user_trophy_progress(user_id, game_id);
    CREATE INDEX IF NOT EXISTS idx_guide_comments_guide_status ON guide_comments(guide_slug, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_guide_comments_user ON guide_comments(user_id);
    CREATE INDEX IF NOT EXISTS idx_guide_comments_status_created ON guide_comments(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_guide_comments_game_id ON guide_comments(game_id);

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

    CREATE TRIGGER IF NOT EXISTS trg_guide_comments_updated_at
    AFTER UPDATE ON guide_comments
    FOR EACH ROW
    BEGIN
      UPDATE guide_comments SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
  `);

  const gameColumnChanges = await ensureGameColumns();
  await ensureTrophyColumns();
  await ensureFeedbackGovernanceColumns();
  await backfillTrophyTypeAliases();
  await ensureUserTables();
  await ensureUserProgressTables();
  await ensureGuideCommentTables();
  await mergeAstrosPlayroomDuplicates();
  await backfillMissableTrophyFlags();
  await backfillCoverImagesFromSeed();
  await backfillTrophyNamePtFromSeed();
  await backfillEldenRingTrophyDescriptionsFromSeed();
  await backfillHadesTrophyLocalizationFromSeed();
  await backfillTrophyChecklistLocalizationFromSeed('astro-bot');
  await backfillTrophyChecklistLocalizationFromSeed('astros-playroom');
  await backfillTrophyChecklistLocalizationFromSeed('the-last-of-us-part-ii');
  await backfillEditorialStatusFields({ recalculateCoverage: gameColumnChanges.coverageLevel });
  if (shouldSyncSeedData(options)) {
    await syncReviewedGuidesFromSeed();
  }
  await syncSeedGameRoadmapFromSeed('elden-ring');
  await syncEldenRingVerifiedGuideFromSeed();
  await syncSeedGameRoadmapFromSeed('hades');
  await syncSeedGameFromSeed('pragmata', { insertIfMissing: true, forceSync: true });
  await syncSeedGameFromSeed('celeste', { insertIfMissing: true, forceSync: true });
  await syncSeedGameGuideSummaryAndRoadmapFromSeed('ghost-of-tsushima');
  await syncSeedGameFromSeed('hades-ii', { insertIfMissing: true, forceSync: true });
  await syncSeedGameFromSeed('astro-bot', { insertIfMissing: true, forceSync: true });
  await syncSeedGameFromSeed('astros-playroom', { insertIfMissing: true, forceSync: true });
  await syncSeedGameGuideSummaryAndRoadmapFromSeed('resident-evil-4-remake');
  await syncSeedGameTrophiesFromSeed('resident-evil-4-remake');
  await syncSeedGameFromSeed('nioh-2', { insertIfMissing: true, forceSync: true });
  await syncSeedGameFromSeed('nioh-3', { insertIfMissing: true, forceSync: true });
  await syncSeedGameFromSeed('demons-souls', { insertIfMissing: true, forceSync: true });
  await syncSeedGameFromSeed('saros', { insertIfMissing: true, forceSync: true });
  await syncSeedGameFromSeed('subnautica', { insertIfMissing: true, forceSync: true });
  await syncSeedGameFromSeed('hollow-knight-silksong', { insertIfMissing: true, forceSync: true });
  await syncSeedGameFromSeed('lego-batman-legacy-of-the-dark-knight', { insertIfMissing: true, forceSync: true });
  await syncSeedGameFromSeed('heavy-rain', { insertIfMissing: true, forceSync: true });
  await syncSeedGameFromSeed('black-myth-wukong', { insertIfMissing: true });
  await syncSeedGameTrophiesFromSeed('the-last-of-us-part-i');
  await syncSeedGameRoadmapFromSeed('the-last-of-us-part-i');
  await syncSeedGameRoadmapFromSeed('the-last-of-us-part-ii');
  await syncSeedGameRoadmapFromSeed('pragmata');
  await syncSeedGameRoadmapFromSeed('hades-ii');
  await syncSeedGameRoadmapFromSeed('astro-bot');
  await syncSeedGameRoadmapFromSeed('astros-playroom');
  await syncSeedGameRoadmapFromSeed('ghost-of-tsushima');
  await syncSeedGameRoadmapFromSeed('resident-evil-4-remake');
  await syncSeedGameRoadmapFromSeed('nioh-2');
  await syncSeedGameRoadmapFromSeed('nioh-3');
  await syncSeedGameRoadmapFromSeed('saros');
  await syncSeedGameRoadmapFromSeed('subnautica');
  await syncSeedGameFromSeed('disney-epic-mickey-rebrushed', { insertIfMissing: true });
  await mergeAstrosPlayroomDuplicates();
  await ensureKnownSlugRedirects();
}

module.exports = migrate;
module.exports.migrateGuideSchemaV2PackagesAndVersions =
  migrateGuideSchemaV2PackagesAndVersions;
module.exports.validateRe5V2MigrationIntegrity =
  validateRe5V2MigrationIntegrity;
