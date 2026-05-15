const sampleGames = require('../data/sampleGames');
const { all, run } = require('./db');
const { slugifyGameName } = require('../utils/slug');
const { formatTimeMetadata } = require('../utils/time');

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

function serializeRoadmapStep(step) {
  if (step && typeof step === 'object') return JSON.stringify(step);
  return String(step || '');
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

async function seed() {
  const existingRows = await all('SELECT slug FROM games');
  const existingSlugs = new Set(existingRows.map(row => String(row.slug || '').trim()).filter(Boolean));

  for (const game of sampleGames) {
    const timeMeta = formatTimeMetadata(game.time);
    const slug = game.slug || slugifyGameName(game.name);
    if (existingSlugs.has(slug)) continue;
    const timeMinHours = Number.isFinite(Number(game.time_min_hours)) ? Number(game.time_min_hours) : timeMeta.time_min_hours;
    const timeMaxHours = Number.isFinite(Number(game.time_max_hours)) ? Number(game.time_max_hours) : timeMeta.time_max_hours;
    const timeSortHours = Number.isFinite(Number(game.time_sort_hours)) ? Number(game.time_sort_hours) : timeMeta.time_sort_hours;
    const timeBucket = game.time_bucket || timeMeta.time_bucket;
    const verificationStatus = normalizeVerificationStatus(game);
    const qualityWarnings = Array.isArray(game.quality_warnings || game.qualityWarnings)
      ? JSON.stringify(game.quality_warnings || game.qualityWarnings)
      : (game.quality_warnings || game.qualityWarnings || '');
    const result = await run(
      'INSERT INTO games (name, slug, difficulty, time, time_min_hours, time_max_hours, time_sort_hours, time_bucket, missable, runs_summary, missable_summary, online_summary, grind_summary, dlc_scope, difficulty_reason, time_reason, first_run_advice, cleanup_advice, before_you_start, best_for, avoid_if, verification_status, editorial_status, coverage_level, is_verified, verification_note, editorial_review_status, last_reviewed_at, editorial_notes, quality_warnings, reviewed_by, image, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        game.image || null,
        game.cover_image || deriveSteamCoverImage(game.image) || null
      ]
    );

    const gameId = result.lastID;
    existingSlugs.add(slug);

    for (const alias of GAME_SLUG_ALIASES[slug] || []) {
      await run(
        'INSERT OR IGNORE INTO game_slug_redirects (game_id, slug) VALUES (?, ?)',
        [gameId, alias]
      );
    }

    for (let index = 0; index < game.roadmap.length; index += 1) {
      await run(
        'INSERT INTO roadmaps (game_id, step_order, content) VALUES (?, ?, ?)',
        [gameId, index + 1, serializeRoadmapStep(game.roadmap[index])]
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
