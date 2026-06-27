const sampleGames = require('../data/sampleGames');
const { all, run } = require('./db');
const { slugifyGameName, getCanonicalGameSlug } = require('../utils/slug');
const { formatTimeMetadata } = require('../utils/time');
const guideModel = require('../shared/guideViewModel');

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
  'assassin-s-creed-valhalla': ['assassins-creed-valhalla'],
  'monster-hunter-world': ['monster-hunter-world-iceborne']
};

function getSeedGameSlugAliases(game = {}, slug = '') {
  const configuredAliases = GAME_SLUG_ALIASES[slug] || [];
  const gameAliases = Array.isArray(game.aliases)
    ? game.aliases
    : Array.isArray(game.slug_aliases)
    ? game.slug_aliases
    : [];
  return [...configuredAliases, ...gameAliases];
}

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

function deriveSteamCoverImage(imageUrl) {
  const match = String(imageUrl || '').match(/steam\/apps\/(\d+)\/header\.jpg/i);
  return match ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${match[1]}/library_600x900.jpg` : null;
}

function normalizeVerificationStatus(game = {}) {
  if (game.is_verified || game.verification_status === 'verified') return 'verified';
  if (game.verification_status === 'review' || game.editorial_status === 'review') return 'review';
  return 'unverified';
}

function inferCoverageLevel(game = {}) {
  const trophyCount = Array.isArray(game.trophies) ? game.trophies.length : 0;
  const roadmapCount = Array.isArray(game.roadmap) ? game.roadmap.length : 0;
  const hasTime = /\d/.test(String(game.time || ''));
  const hasMissableContext = String(game.missable || '').trim().length >= 20;

  if (trophyCount >= 30 && roadmapCount >= 4 && hasTime && hasMissableContext) return 'complete';
  if (trophyCount >= 12 && roadmapCount >= 2 && hasTime && hasMissableContext) return 'strong';
  return 'partial';
}

function normalizeCoverageLevel(game = {}) {
  const level = game.coverage_level || inferCoverageLevel(game);
  return level === 'complete' && normalizeVerificationStatus(game) !== 'verified' ? 'strong' : level;
}

function normalizeSlugValue(value) {
  return getCanonicalGameSlug(value);
}

function createSeedGameConflictError({ name, existingSlug, newSlug }) {
  return new Error(
    `Conflito de jogo no seed: name ja existe com outro slug. name="${name}", slug existente="${existingSlug || '(vazio)'}", slug novo="${newSlug}".`
  );
}

async function resolveSeedGameTarget(game, slug) {
  const name = String(game.name || '').trim();
  const matches = [];
  const slugMatch = await all('SELECT id, slug, name FROM games WHERE slug = ?', [slug]);
  for (const row of slugMatch) matches.push(row);

  if (name) {
    const nameMatches = await all('SELECT id, slug, name FROM games WHERE lower(name) = lower(?)', [name]);
    for (const row of nameMatches) {
      if (!matches.some(match => match.id === row.id)) matches.push(row);
    }
  }

  if (matches.length > 1) {
    const conflict = matches.find(row => row.id !== matches[0].id) || matches[0];
    throw createSeedGameConflictError({ name, existingSlug: conflict.slug, newSlug: slug });
  }

  const target = matches[0] || null;
  if (!target) return null;

  const existingSlug = normalizeSlugValue(target.slug);
  if (existingSlug && existingSlug !== slug) {
    throw createSeedGameConflictError({ name, existingSlug: target.slug, newSlug: slug });
  }

  return target;
}

async function seed() {
  const existingRows = await all('SELECT slug, name FROM games');
  const existingSlugs = new Set(existingRows.map(row => getCanonicalGameSlug(row.slug || row.name)).filter(Boolean));

  for (const game of sampleGames) {
    const timeMeta = formatTimeMetadata(game.time);
    const slug = getCanonicalGameSlug(game.slug || game.name);
    const existing = await resolveSeedGameTarget(game, slug);
    if (existing && normalizeSlugValue(existing.slug) === slug) continue;
    const timeMinHours = Number.isFinite(Number(game.time_min_hours)) ? Number(game.time_min_hours) : timeMeta.time_min_hours;
    const timeMaxHours = Number.isFinite(Number(game.time_max_hours)) ? Number(game.time_max_hours) : timeMeta.time_max_hours;
    const timeSortHours = Number.isFinite(Number(game.time_sort_hours)) ? Number(game.time_sort_hours) : timeMeta.time_sort_hours;
    const timeBucket = game.time_bucket || timeMeta.time_bucket;
    const verificationStatus = normalizeVerificationStatus(game);
    const qualityWarnings = Array.isArray(game.quality_warnings || game.qualityWarnings)
      ? JSON.stringify(game.quality_warnings || game.qualityWarnings)
      : (game.quality_warnings || game.qualityWarnings || '');
    const walkthrough = guideModel.normalizeWalkthrough(game.walkthrough);
    const values = [
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
      normalizeCoverageLevel(game),
      verificationStatus === 'verified' ? 1 : 0,
      game.verification_note || '',
      game.editorial_review_status || game.editorialReviewStatus || null,
      game.last_reviewed_at || game.lastReviewedAt || '',
      game.editorial_notes || game.editorialNotes || '',
      qualityWarnings,
      game.reviewed_by || game.reviewedBy || '',
      walkthrough.length ? JSON.stringify(walkthrough) : '',
      game.image || null,
      game.cover_image || deriveSteamCoverImage(game.image) || null
    ];

    let gameId = existing?.id;
    if (existing) {
      await run(
        'UPDATE games SET name = ?, slug = ?, difficulty = ?, time = ?, time_min_hours = ?, time_max_hours = ?, time_sort_hours = ?, time_bucket = ?, missable = ?, runs_summary = ?, missable_summary = ?, online_summary = ?, grind_summary = ?, dlc_scope = ?, difficulty_reason = ?, time_reason = ?, first_run_advice = ?, cleanup_advice = ?, before_you_start = ?, best_for = ?, avoid_if = ?, verification_status = ?, editorial_status = ?, coverage_level = ?, is_verified = ?, verification_note = ?, editorial_review_status = ?, last_reviewed_at = ?, editorial_notes = ?, quality_warnings = ?, reviewed_by = ?, walkthrough = ?, image = ?, cover_image = ? WHERE id = ?',
        [...values, existing.id]
      );
    } else {
      const result = await run(
        'INSERT INTO games (name, slug, difficulty, time, time_min_hours, time_max_hours, time_sort_hours, time_bucket, missable, runs_summary, missable_summary, online_summary, grind_summary, dlc_scope, difficulty_reason, time_reason, first_run_advice, cleanup_advice, before_you_start, best_for, avoid_if, verification_status, editorial_status, coverage_level, is_verified, verification_note, editorial_review_status, last_reviewed_at, editorial_notes, quality_warnings, reviewed_by, walkthrough, image, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        values
      );
      gameId = result.lastID;
    }
    existingSlugs.add(slug);

    if (existing) {
      await run('DELETE FROM roadmaps WHERE game_id = ?', [gameId]);
      await run('DELETE FROM trophies WHERE game_id = ?', [gameId]);
    }

    for (const alias of getSeedGameSlugAliases(game, slug)) {
      const normalizedAlias = slugifyGameName(alias);
      if (!normalizedAlias || normalizedAlias === slug) continue;
      await run(
        'INSERT OR IGNORE INTO game_slug_redirects (game_id, slug) VALUES (?, ?)',
        [gameId, normalizedAlias]
      );
    }

    for (let index = 0; index < game.roadmap.length; index += 1) {
      await run(
        'INSERT INTO roadmaps (game_id, step_order, content) VALUES (?, ?, ?)',
        [gameId, index + 1, serializeRoadmapStep(game.roadmap[index], index, game.roadmap.length)]
      );
    }

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

module.exports = seed;
