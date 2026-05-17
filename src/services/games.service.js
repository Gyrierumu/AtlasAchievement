const { all, get, run, exec } = require('../db/db');
const AppError = require('../utils/AppError');
const { removeManagedUpload, isManagedUpload } = require('./file.service');
const { slugifyGameName, buildSlugVariant } = require('../utils/slug');
const { formatTimeMetadata } = require('../utils/time');
const editorialModel = require('../shared/editorialModel');
const sampleGames = require('../data/sampleGames');

const PUBLIC_EDITORIAL_STATUSES = new Set(['review', 'published']);
const COVERAGE_LEVELS = new Set(['partial', 'strong', 'complete']);
const VERIFICATION_STATUSES = new Set(['unverified', 'review', 'verified']);
const EDITORIAL_REVIEW_STATUSES = new Set(Object.keys(editorialModel.EDITORIAL_TRUST_STATUSES || {}));
const LOCALIZED_TROPHY_SOURCE_SLUGS = new Set(['astro-bot', 'astros-playroom', 'hades-ii', 'nioh-2', 'nioh-3', 'the-last-of-us-part-i', 'the-last-of-us-part-ii', 'subnautica']);
const CATALOG_IMAGE_BY_SLUG = {
  'the-last-of-us-part-ii': 'https://cdn.cloudflare.steamstatic.com/steam/apps/2531310/header.jpg'
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

function firstText(...values) {
  return values.map(value => String(value || '').trim()).find(Boolean) || '';
}

function serializeRoadmapStep(step) {
  if (step && typeof step === 'object') return JSON.stringify(step);
  return String(step || '');
}

function deserializeRoadmapStep(content) {
  const text = String(content || '').trim();
  if (!text || !/^\{[\s\S]*\}$/.test(text)) return text;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : text;
  } catch (_error) {
    return text;
  }
}

function normalizeGuideCleanupAdvice(row = {}) {
  const text = row.cleanup_advice || '';
  if (row.slug === 'road-96') {
    return text.replace('seleção de capítulos tradicional', 'Chapter Select tradicional');
  }
  return text;
}

function getSeedTrophy(slug = '', trophyCode = '') {
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  const code = String(trophyCode || '').trim();
  if (!normalizedSlug || !code) return null;
  const game = sampleGames.find(item => String(item?.slug || '').trim().toLowerCase() === normalizedSlug);
  return (game?.trophies || []).find(trophy => trophy?.id === code) || null;
}

function inferCoverageLevelFromPayload(payload = {}) {
  const trophyCount = Array.isArray(payload.trophies) ? payload.trophies.length : Number(payload.trophy_count || 0);
  const roadmapCount = Array.isArray(payload.roadmap) ? payload.roadmap.length : Number(payload.roadmap_count || 0);
  const hasReadableTime = /\d/.test(String(payload.time || ''));
  const hasMissableContext = String(payload.missable || '').trim().length >= 20;
  const editorialFields = [
    payload.runs_summary,
    payload.missable_summary,
    payload.online_summary,
    payload.grind_summary,
    payload.dlc_scope,
    payload.difficulty_reason,
    payload.time_reason,
    payload.first_run_advice,
    payload.cleanup_advice,
    payload.before_you_start,
    payload.best_for,
    payload.avoid_if,
    payload.runs,
    payload.online,
    payload.grind,
    payload.dlc,
    payload.ideal_for,
    payload.avoid_for,
    payload.best_for_when
  ].filter(value => String(value || '').trim().length >= 4).length;

  if (trophyCount >= 30 && roadmapCount >= 4 && hasReadableTime && hasMissableContext && editorialFields >= 3) {
    return 'complete';
  }

  if (trophyCount >= 12 && roadmapCount >= 2 && hasReadableTime && hasMissableContext) {
    return 'strong';
  }

  return 'partial';
}

function normalizeEditorialStatus(value) {
  return ['draft', 'review', 'published'].includes(value) ? value : 'published';
}

function normalizeEditorialReviewStatus(value) {
  const status = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  return EDITORIAL_REVIEW_STATUSES.has(status) ? status : null;
}

function serializeQualityWarnings(value) {
  const warnings = editorialModel.parseQualityWarnings(value);
  return warnings.length ? JSON.stringify(warnings) : '';
}

function normalizeReviewedDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : '';
}

function buildEditorialReviewFields(row = {}) {
  const editorialReviewStatus = normalizeEditorialReviewStatus(row.editorial_review_status);
  const trustGame = {
    ...row,
    editorial_review_status: editorialReviewStatus,
    quality_warnings: row.quality_warnings || ''
  };
  const badge = editorialModel.getEditorialTrustBadge(trustGame);
  return {
    editorial_review_status: editorialReviewStatus,
    editorialReviewStatus: badge.status,
    editorialStatus: badge.status,
    last_reviewed_at: normalizeReviewedDate(row.last_reviewed_at),
    lastReviewedAt: normalizeReviewedDate(row.last_reviewed_at),
    editorial_notes: row.editorial_notes || '',
    editorialNotes: row.editorial_notes || '',
    quality_warnings: badge.qualityWarnings,
    qualityWarnings: badge.qualityWarnings,
    reviewed_by: row.reviewed_by || '',
    reviewedBy: row.reviewed_by || ''
  };
}

function normalizeTrophyType(value) {
  const raw = String(value || '').trim();
  const key = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return TROPHY_TYPE_ALIASES[key] || raw;
}

function isVerifiedEditorialPayload(payload = {}) {
  return payload.is_verified || payload.verification_status === 'verified';
}

function normalizeCoverageLevel(value, fallbackPayload = null) {
  const payload = fallbackPayload || {};
  const level = COVERAGE_LEVELS.has(value) ? value : inferCoverageLevelFromPayload(payload);
  return level === 'complete' && !isVerifiedEditorialPayload(payload) ? 'strong' : level;
}

function normalizeVerificationStatus(value, fallbackPayload = {}) {
  if (fallbackPayload.is_verified) return 'verified';
  if (value === 'verified') return 'verified';
  if (VERIFICATION_STATUSES.has(value)) return value;
  if (fallbackPayload.editorial_status === 'review') return 'review';
  return 'unverified';
}

function ensurePublicGame(row, includeDrafts = false) {
  if (!row) return row;
  if (!includeDrafts && !PUBLIC_EDITORIAL_STATUSES.has(row.editorial_status || 'published')) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }
  if (!includeDrafts && normalizeEditorialReviewStatus(row.editorial_review_status) === 'draft') {
    throw new AppError('Jogo nÃ£o encontrado.', 404, null, 'GAME_NOT_FOUND');
  }
  return row;
}

function normalizeGame(row, roadmapRows, trophyRows) {
  const normalizeCompletionText = value => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const isPlatinumTrophy = item => {
    const type = normalizeCompletionText(item?.type);
    const name = normalizeCompletionText(item?.name);
    const description = normalizeCompletionText(item?.description);
    return type === 'platina'
      || type === 'platinum'
      || /god of blood/.test(name)
      || /earn (?:every|all) other trophies|obtenha todos os trofeus|obtenha todos os outros trofeus/.test(description);
  };
  const normalizedSlug = String(row.slug || '').trim().toLowerCase();
  const supportsLocalizedDescriptions = [
    'elden-ring',
    'hades',
    'pragmata',
    'ghost-of-tsushima',
    'hades-ii',
    'astro-bot',
    'astros-playroom',
    'nioh-2',
    'nioh-3',
    'saros',
    'the-last-of-us-part-i',
    'the-last-of-us-part-ii',
    'subnautica'
  ].includes(normalizedSlug);
  const missableCount = trophyRows.filter(item => item.is_missable && !isPlatinumTrophy(item)).length;
  const spoilerCount = trophyRows.filter(item => item.is_spoiler).length;

  return {
    id: row.id,
    name: row.name,
    difficulty: row.difficulty,
    time: row.time,
    missable: row.missable,
    image: row.image,
    cover_image: row.cover_image || null,
    catalogImage: CATALOG_IMAGE_BY_SLUG[normalizedSlug] || '',
    runs_summary: firstText(row.runs_summary, row.guide_runs),
    missable_summary: firstText(row.missable_summary, row.missable),
    online_summary: firstText(row.online_summary, row.guide_online),
    grind_summary: firstText(row.grind_summary, row.guide_grind),
    dlc_scope: firstText(row.dlc_scope, row.guide_dlc),
    difficulty_reason: row.difficulty_reason || '',
    time_reason: row.time_reason || '',
    first_run_advice: row.first_run_advice || '',
    cleanup_advice: normalizeGuideCleanupAdvice(row),
    before_you_start: row.before_you_start || '',
    best_for: firstText(row.best_for, row.guide_ideal),
    avoid_if: firstText(row.avoid_if, row.guide_avoid),
    verification_status: normalizeVerificationStatus(row.verification_status, row),
    runs: firstText(row.runs_summary, row.guide_runs),
    online: firstText(row.online_summary, row.guide_online),
    grind: firstText(row.grind_summary, row.guide_grind),
    dlc: firstText(row.dlc_scope, row.guide_dlc),
    ideal_for: firstText(row.best_for, row.guide_ideal),
    avoid_for: firstText(row.avoid_if, row.guide_avoid),
    best_for_when: row.guide_best_moment || '',
    editorial_status: normalizeEditorialStatus(row.editorial_status),
    publication_status: normalizeEditorialStatus(row.editorial_status),
    ...buildEditorialReviewFields(row),
    coverage_level: normalizeCoverageLevel(row.coverage_level, row),
    is_verified: Boolean(row.is_verified),
    verification_note: row.verification_note || '',
    slug: row.slug || slugifyGameName(row.name),
    chapterSelect: ['the-last-of-us-part-i', 'the-last-of-us-part-ii'].includes(normalizedSlug) ? true : (['nioh-3', 'saros', 'subnautica'].includes(normalizedSlug) ? false : undefined),
    missionReplay: normalizedSlug === 'nioh-3' ? true : undefined,
    openWorldCleanup: normalizedSlug === 'subnautica' ? true : undefined,
    onlineRequired: ['astro-bot', 'astros-playroom', 'nioh-2', 'nioh-3', 'saros', 'the-last-of-us-part-i', 'the-last-of-us-part-ii', 'subnautica'].includes(normalizedSlug) ? false : undefined,
    coopRequired: ['astro-bot', 'astros-playroom', 'nioh-2', 'nioh-3', 'saros', 'the-last-of-us-part-i', 'the-last-of-us-part-ii', 'subnautica'].includes(normalizedSlug) ? false : undefined,
    dlcRequired: ['astro-bot', 'astros-playroom', 'nioh-2', 'nioh-3', 'saros', 'the-last-of-us-part-i', 'the-last-of-us-part-ii', 'subnautica'].includes(normalizedSlug) ? false : undefined,
    newGamePlusRequired: normalizedSlug === 'the-last-of-us-part-ii' ? true : (normalizedSlug === 'the-last-of-us-part-i' ? false : undefined),
    difficultyTrophiesRequired: ['the-last-of-us-part-i', 'the-last-of-us-part-ii'].includes(normalizedSlug) ? false : undefined,
    roadmap: roadmapRows.map(item => deserializeRoadmapStep(item.content)),
    trophies: trophyRows.map(item => {
      const description = item.description || '';
      const isMissable = Boolean(item.is_missable) && !isPlatinumTrophy(item);
      const seedTrophy = LOCALIZED_TROPHY_SOURCE_SLUGS.has(normalizedSlug) ? getSeedTrophy(normalizedSlug, item.trophy_code) : null;
      return {
        id: item.trophy_code,
        name: item.name,
        name_pt: item.name_pt || '',
        trophyNameOriginal: item.name,
        trophyNamePtBr: item.name_pt || '',
        namePtSource: item.name_pt && LOCALIZED_TROPHY_SOURCE_SLUGS.has(normalizedSlug) ? (seedTrophy?.namePtSource || 'trusted_steam_ptbr') : '',
        type: item.type,
        description,
        descriptionOriginal: seedTrophy?.descriptionOriginal || '',
        descriptionPtBr: supportsLocalizedDescriptions ? description : '',
        ptDescription: supportsLocalizedDescriptions ? description : '',
        descriptionPtSource: supportsLocalizedDescriptions && LOCALIZED_TROPHY_SOURCE_SLUGS.has(normalizedSlug) ? (seedTrophy?.descriptionPtSource || 'trusted_steam_ptbr') : '',
        tip: item.tip,
        is_missable: isMissable,
        is_spoiler: Boolean(item.is_spoiler)
      };
    }),
    created_at: row.created_at,
    updated_at: row.updated_at,
    time_min_hours: row.time_min_hours,
    time_max_hours: row.time_max_hours,
    time_sort_hours: row.time_sort_hours,
    time_bucket: row.time_bucket || null,
    missable_count: missableCount,
    spoiler_count: spoilerCount,
    attention_count: missableCount + spoilerCount
  };
}


function buildListFilters({ search = '', facet = 'all' } = {}) {
  const where = [];
  const params = [];
  const textSql = (...columns) => columns.map(column => `lower(coalesce(${column}, ''))`).join(" || ' ' || ");
  const onlineText = textSql('online_summary', 'guide_online');
  const missableText = textSql('missable_summary', 'missable');
  const grindText = textSql('grind_summary', 'guide_grind', 'cleanup_advice');
  const dlcText = textSql('dlc_scope', 'guide_dlc');
  const chapterText = textSql('missable_summary', 'cleanup_advice', 'first_run_advice', 'before_you_start');
  const onlineNegatedSql = `((${onlineText}) LIKE '%não há%online%' OR (${onlineText}) LIKE '%nao ha%online%' OR (${onlineText}) LIKE '%sem online obrigatório%' OR (${onlineText}) LIKE '%sem online obrigatorio%' OR (${onlineText}) LIKE '%não exige online%' OR (${onlineText}) LIKE '%nao exige online%')`;
  const onlineStrongSql = `((${onlineText}) LIKE '%online/multiplayer%' OR (${onlineText}) LIKE '%sos flare%' OR (${onlineText}) LIKE '%guild card%' OR (${onlineText}) LIKE '%guild cards%' OR (${onlineText}) LIKE '%quests multiplayer%' OR (${onlineText}) LIKE '%pvp%' OR (${onlineText}) LIKE '%servidor obrigatório%' OR (${onlineText}) LIKE '%servidor obrigatorio%' OR (${onlineText}) LIKE '%server obrigatório%' OR (${onlineText}) LIKE '%server obrigatorio%')`;
  const onlineGenericSql = `((${onlineText}) LIKE '%multiplayer obrigatório%' OR (${onlineText}) LIKE '%multiplayer obrigatorio%' OR (${onlineText}) LIKE '%online obrigatório%' OR (${onlineText}) LIKE '%online obrigatorio%' OR (${onlineText}) LIKE '%ps+ obrigatório%' OR (${onlineText}) LIKE '%ps+ obrigatorio%')`;
  const onlineRequiredSql = `(${onlineStrongSql} OR (${onlineGenericSql} AND NOT ${onlineNegatedSql}))`;
  const coopRequiredSql = `((${onlineText}) LIKE '%exige 2 jogadores%' OR (${onlineText}) LIKE '%2 jogadores%' OR (${onlineText}) LIKE '%dois jogadores%' OR (${onlineText}) LIKE '%não pode ser platinado solo%' OR (${onlineText}) LIKE '%nao pode ser platinado solo%' OR (${onlineText}) LIKE '%coop obrigatório%' OR (${onlineText}) LIKE '%coop obrigatorio%' OR (${onlineText}) LIKE '%co-op obrigatório%' OR (${onlineText}) LIKE '%co-op obrigatorio%' OR (${onlineText}) LIKE '%campanha em coop%' OR lower(coalesce(before_you_start, '')) LIKE '%segundo jogador%' OR lower(coalesce(before_you_start, '')) LIKE '%dupla%')`;
  const missableSql = `(missable_count > 0 OR (((${missableText}) LIKE '%perdível%' OR (${missableText}) LIKE '%perdivel%' OR (${missableText}) LIKE '%perdíveis%' OR (${missableText}) LIKE '%perdiveis%' OR (${missableText}) LIKE '%perda permanente%' OR (${missableText}) LIKE '%bloqueado%' OR (${missableText}) LIKE '%bloquear%') AND (${missableText}) NOT LIKE '%não há%perdível%' AND (${missableText}) NOT LIKE '%nao ha%perdivel%' AND (${missableText}) NOT LIKE '%não há%perdíveis%' AND (${missableText}) NOT LIKE '%nao ha%perdiveis%' AND (${missableText}) NOT LIKE '%não há perda permanente%' AND (${missableText}) NOT LIKE '%nao ha perda permanente%' AND (${missableText}) NOT LIKE '%sem perdível permanente%' AND (${missableText}) NOT LIKE '%sem perdivel permanente%' AND (${missableText}) NOT LIKE '%sem perdíveis%' AND (${missableText}) NOT LIKE '%sem perdiveis%'))`;
  const grindSql = `(((${grindText}) LIKE '%grind%' OR (${grindText}) LIKE '%farm%' OR (${grindText}) LIKE '%rng%' OR (${grindText}) LIKE '%coroa%' OR (${grindText}) LIKE '%crown%' OR (${grindText}) LIKE '%boss stem cell%' OR (${grindText}) LIKE '%bsc%' OR (${grindText}) LIKE '%endgame longo%') AND (${grindText}) NOT LIKE '%sem grind%' AND (${grindText}) NOT LIKE '%não há grind%' AND (${grindText}) NOT LIKE '%nao ha grind%')`;
  const baseGameSql = `((${dlcText}) LIKE '%lista base%' OR (${dlcText}) LIKE '%jogo base%' OR (${dlcText}) LIKE '%base game%' OR (${dlcText}) LIKE '%sem dlc%' OR (${dlcText}) LIKE '%não inclui%' OR (${dlcText}) LIKE '%nao inclui%' OR (${dlcText}) LIKE '%não é necessária%' OR (${dlcText}) LIKE '%nao e necessaria%' OR (${dlcText}) LIKE '%dlc não necessária%' OR (${dlcText}) LIKE '%dlc nao necessaria%' OR (${dlcText}) LIKE '%não há dlc%' OR (${dlcText}) LIKE '%nao ha dlc%' OR (${dlcText}) LIKE '%platina própria%' OR (${dlcText}) LIKE '%platina propria%')`;
  const chapterSelectSql = `((${chapterText}) LIKE '%chapter select%' OR (${chapterText}) LIKE '%seleção de capítulo%' OR (${chapterText}) LIKE '%selecao de capitulo%' OR (${chapterText}) LIKE '%seleção de capítulos%' OR (${chapterText}) LIKE '%selecao de capitulos%' OR (${chapterText}) LIKE '%selecionar capítulo%' OR (${chapterText}) LIKE '%selecionar capitulo%')`;

  const chapterSelectNegatedSql = `((${chapterText}) LIKE '%não há%chapter select%' OR (${chapterText}) LIKE '%nao ha%chapter select%' OR (${chapterText}) LIKE '%não tem%chapter select%' OR (${chapterText}) LIKE '%nao tem%chapter select%' OR (${chapterText}) LIKE '%sem chapter select%' OR (${chapterText}) LIKE '%não existe%chapter select%' OR (${chapterText}) LIKE '%nao existe%chapter select%' OR (${chapterText}) LIKE '%não há%seleção de capítulo%' OR (${chapterText}) LIKE '%nao ha%selecao de capitulo%' OR (${chapterText}) LIKE '%sem seleção de capítulo%' OR (${chapterText}) LIKE '%sem selecao de capitulo%')`;

  if (search) {
    const tokens = String(search || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean)
      .slice(0, 8);

    if (tokens.length) {
      const searchFields = [
        'lower(name)',
        'lower(slug)',
        'lower(coalesce(time, \'\'))',
        'lower(coalesce(missable, \'\'))',
        'lower(coalesce(guide_runs, \'\'))',
        'lower(coalesce(guide_online, \'\'))',
        'lower(coalesce(guide_grind, \'\'))',
        'lower(coalesce(guide_dlc, \'\'))',
        'lower(coalesce(guide_ideal, \'\'))',
        'lower(coalesce(guide_avoid, \'\'))',
        'lower(coalesce(runs_summary, \'\'))',
        'lower(coalesce(missable_summary, \'\'))',
        'lower(coalesce(online_summary, \'\'))',
        'lower(coalesce(grind_summary, \'\'))',
        'lower(coalesce(dlc_scope, \'\'))',
        'lower(coalesce(difficulty_reason, \'\'))',
        'lower(coalesce(time_reason, \'\'))',
        'lower(coalesce(first_run_advice, \'\'))',
        'lower(coalesce(cleanup_advice, \'\'))',
        'lower(coalesce(before_you_start, \'\'))',
        'lower(coalesce(best_for, \'\'))',
        'lower(coalesce(avoid_if, \'\'))'
      ];
      where.push(tokens.map(() => `(${searchFields.map(field => `${field} LIKE ?`).join(' OR ')})`).join(' AND '));
      tokens.forEach(token => {
        searchFields.forEach(() => params.push(`%${token}%`));
      });
    }
  }

  switch (facet) {
    case 'difficulty-low':
      where.push('difficulty BETWEEN 1 AND 3');
      break;
    case 'difficulty-mid':
      where.push('difficulty BETWEEN 4 AND 6');
      break;
    case 'difficulty-high':
      where.push('difficulty BETWEEN 7 AND 10');
      break;
    case 'time-short':
      where.push("(time_bucket = 'short' OR (time_bucket IS NULL AND time_sort_hours IS NOT NULL AND time_sort_hours <= 15))");
      break;
    case 'time-medium':
      where.push("(time_bucket = 'medium' OR (time_bucket IS NULL AND time_sort_hours IS NOT NULL AND time_sort_hours > 15 AND time_sort_hours <= 40))");
      break;
    case 'time-long':
      where.push("(time_bucket = 'long' OR (time_bucket IS NULL AND time_sort_hours IS NOT NULL AND time_sort_hours > 40))");
      break;
    case 'trophies-small':
      where.push('trophy_count > 0 AND trophy_count <= 30');
      break;
    case 'trophies-medium':
      where.push('trophy_count > 30 AND trophy_count <= 60');
      break;
    case 'trophies-large':
      where.push('trophy_count > 60');
      break;
    case 'online-none':
      where.push(`NOT ${onlineRequiredSql}`);
      where.push("(coalesce(editorial_review_status, '') != 'needs_online_check')");
      break;
    case 'online-required':
      where.push(onlineRequiredSql);
      where.push(`NOT ((${onlineText}) LIKE '%não há%online obrigat%' OR (${onlineText}) LIKE '%nao ha%online obrigat%' OR (${onlineText}) LIKE '%sem online obrigat%' OR (${onlineText}) LIKE '%não exige online%' OR (${onlineText}) LIKE '%nao exige online%' OR (${onlineText}) LIKE '%online opcional%' OR (${onlineText}) LIKE '%recursos online opcionais%' OR (${onlineText}) LIKE '%fora dos requisitos da platina%')`);
      break;
    case 'coop-required':
      where.push(coopRequiredSql);
      where.push(`NOT ((${onlineText}) LIKE '%não há%coop obrigat%' OR (${onlineText}) LIKE '%nao ha%coop obrigat%' OR (${onlineText}) LIKE '%não indica%coop obrigat%' OR (${onlineText}) LIKE '%nao indica%coop obrigat%' OR (${onlineText}) LIKE '%sem coop obrigat%' OR (${onlineText}) LIKE '%não exige coop%' OR (${onlineText}) LIKE '%nao exige coop%' OR (${onlineText}) LIKE '%coop opcional%' OR (${onlineText}) LIKE '%single-player%' OR (${onlineText}) LIKE '%single player%' OR lower(coalesce(before_you_start, '')) LIKE '%não há%coop obrigat%' OR lower(coalesce(before_you_start, '')) LIKE '%nao ha%coop obrigat%' OR lower(coalesce(before_you_start, '')) LIKE '%não indica%coop obrigat%' OR lower(coalesce(before_you_start, '')) LIKE '%nao indica%coop obrigat%' OR lower(coalesce(before_you_start, '')) LIKE '%sem coop obrigat%' OR lower(coalesce(before_you_start, '')) LIKE '%single-player%' OR lower(coalesce(before_you_start, '')) LIKE '%single player%')`);
      break;
    case 'missable-present':
      where.push(missableSql);
      break;
    case 'missable-none':
      where.push(`NOT ${missableSql}`);
      where.push("(coalesce(editorial_review_status, '') != 'needs_missables_check')");
      break;
    case 'grind-present':
      where.push(grindSql);
      break;
    case 'dlc-base':
      where.push(baseGameSql);
      break;
    case 'chapter-select':
      where.push(chapterSelectSql);
      where.push(`NOT ${chapterSelectNegatedSql}`);
      break;
    case 'editorial-verified':
      where.push("(editorial_review_status = 'verified' OR is_verified = 1 OR verification_status = 'verified')");
      break;
    case 'editorial-review':
      where.push("(coalesce(editorial_review_status, '') IN ('in_review', 'needs_missables_check', 'needs_online_check', 'dlc_pending', 'outdated') OR (is_verified = 0 AND (verification_status = 'review' OR editorial_status = 'review' OR coverage_level = 'strong')))");
      break;
    default:
      break;
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

function normalizeListRow(row) {
  const normalizedSlug = String(row.slug || '').trim().toLowerCase();
  return {
    ...row,
    trophy_count: Number(row.trophy_count || 0),
    roadmap_count: Number(row.roadmap_count || 0),
    missable_count: Number(row.missable_count || 0),
    spoiler_count: Number(row.spoiler_count || 0),
    attention_count: Number(row.attention_count || 0),
    editorial_status: normalizeEditorialStatus(row.editorial_status),
    publication_status: normalizeEditorialStatus(row.editorial_status),
    ...buildEditorialReviewFields(row),
    coverage_level: normalizeCoverageLevel(row.coverage_level),
    is_verified: Boolean(row.is_verified),
    verification_note: row.verification_note || '',
    verification_status: normalizeVerificationStatus(row.verification_status, row),
    cover_image: row.cover_image || null,
    catalogImage: CATALOG_IMAGE_BY_SLUG[normalizedSlug] || '',
    runs_summary: firstText(row.runs_summary, row.guide_runs),
    missable_summary: firstText(row.missable_summary, row.missable),
    online_summary: firstText(row.online_summary, row.guide_online),
    grind_summary: firstText(row.grind_summary, row.guide_grind),
    dlc_scope: firstText(row.dlc_scope, row.guide_dlc),
    difficulty_reason: row.difficulty_reason || '',
    time_reason: row.time_reason || '',
    first_run_advice: row.first_run_advice || '',
    cleanup_advice: normalizeGuideCleanupAdvice(row),
    before_you_start: row.before_you_start || '',
    best_for: firstText(row.best_for, row.guide_ideal),
    avoid_if: firstText(row.avoid_if, row.guide_avoid),
    runs: firstText(row.runs_summary, row.guide_runs),
    online: firstText(row.online_summary, row.guide_online),
    grind: firstText(row.grind_summary, row.guide_grind),
    dlc: firstText(row.dlc_scope, row.guide_dlc),
    ideal_for: firstText(row.best_for, row.guide_ideal),
    avoid_for: firstText(row.avoid_if, row.guide_avoid),
    best_for_when: row.guide_best_moment || '',
    slug: row.slug || slugifyGameName(row.name),
    time_bucket: row.time_bucket || null
  };
}

function getListOrderBy(sort = 'name-asc') {
  const sorts = {
    'recommended-desc': `
      CASE WHEN roadmap_count > 0 THEN 0 ELSE 1 END ASC,
      CASE
        WHEN difficulty IS NULL THEN 2
        WHEN difficulty <= 3 THEN 0
        WHEN difficulty <= 6 THEN 1
        ELSE 2
      END ASC,
      CASE
        WHEN time_sort_hours IS NULL THEN 2
        WHEN time_sort_hours <= 15 THEN 0
        WHEN time_sort_hours <= 40 THEN 1
        ELSE 2
      END ASC,
      trophy_count DESC,
      updated_at DESC,
      name COLLATE NOCASE ASC
    `,
    'updated-desc': 'updated_at DESC, name COLLATE NOCASE ASC',
    'created-desc': 'created_at DESC, name COLLATE NOCASE ASC',
    'difficulty-desc': 'difficulty DESC, name COLLATE NOCASE ASC',
    'difficulty-asc': 'CASE WHEN difficulty IS NULL THEN 1 ELSE 0 END ASC, difficulty ASC, name COLLATE NOCASE ASC',
    'time-asc': 'CASE WHEN time_sort_hours IS NULL THEN 1 ELSE 0 END ASC, time_sort_hours ASC, name COLLATE NOCASE ASC',
    'time-desc': 'CASE WHEN time_sort_hours IS NULL THEN 1 ELSE 0 END ASC, time_sort_hours DESC, name COLLATE NOCASE ASC',
    'trophies-desc': 'trophy_count DESC, name COLLATE NOCASE ASC',
    'trophies-asc': 'CASE WHEN trophy_count IS NULL THEN 1 ELSE 0 END ASC, trophy_count ASC, name COLLATE NOCASE ASC',
    'name-asc': 'name COLLATE NOCASE ASC'
  };

  return sorts[sort] || sorts['name-asc'];
}
async function reserveUniqueSlug(baseName, excludeGameId = null) {
  const normalizedBase = slugifyGameName(baseName) || 'jogo';
  let sequence = 0;

  while (sequence < 1000) {
    const candidate = buildSlugVariant(normalizedBase, sequence);
    const existing = excludeGameId
      ? await get('SELECT id FROM games WHERE slug = ? AND id != ?', [candidate, excludeGameId])
      : await get('SELECT id FROM games WHERE slug = ?', [candidate]);

    if (!existing) {
      return candidate;
    }

    sequence += 1;
  }

  throw new AppError('Não foi possível gerar um slug único para o jogo.', 500, null, 'SLUG_GENERATION_FAILED');
}

async function listGames(options = {}) {
  const { search = '', facet = 'all', sort = 'name-asc', page = 1, limit = 500, includeDrafts = false } = options;
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 100);
  const requestedPage = Math.max(Number(page) || 1, 1);
  const { whereSql, params } = buildListFilters({ search, facet });
  const visibilitySql = includeDrafts ? '' : "editorial_status IN ('review', 'published') AND coalesce(editorial_review_status, '') != 'draft'";
  const finalWhereSql = [visibilitySql, whereSql.replace(/^WHERE\s+/i, '')].filter(Boolean).join(' AND ');
  const scopedWhereSql = finalWhereSql ? `WHERE ${finalWhereSql}` : '';
  const orderBy = getListOrderBy(sort);

  const baseCte = `WITH game_stats AS (
    SELECT g.id,
           g.name,
           g.slug,
           g.difficulty,
           g.time,
           g.time_min_hours,
           g.time_max_hours,
           g.time_sort_hours,
           g.time_bucket,
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
           g.verification_status,
           g.editorial_status,
           g.coverage_level,
           g.is_verified,
           g.verification_note,
           g.editorial_review_status,
           g.last_reviewed_at,
           g.editorial_notes,
           g.quality_warnings,
           g.reviewed_by,
           g.image,
           g.cover_image,
           g.created_at,
           g.updated_at,
           COUNT(DISTINCT t.id) AS trophy_count,
           COUNT(DISTINCT CASE WHEN t.is_missable = 1 AND lower(coalesce(t.type, '')) NOT IN ('platina', 'platinum') THEN t.id END) AS missable_count,
           COUNT(DISTINCT CASE WHEN t.is_spoiler = 1 THEN t.id END) AS spoiler_count,
           COUNT(DISTINCT CASE WHEN (t.is_missable = 1 AND lower(coalesce(t.type, '')) NOT IN ('platina', 'platinum')) OR t.is_spoiler = 1 THEN t.id END) AS attention_count,
           COUNT(DISTINCT r.id) AS roadmap_count
    FROM games g
    LEFT JOIN trophies t ON t.game_id = g.id
    LEFT JOIN roadmaps r ON r.game_id = g.id
    GROUP BY g.id, g.name, g.slug, g.difficulty, g.time, g.time_min_hours, g.time_max_hours, g.time_sort_hours, g.time_bucket, g.missable, g.guide_runs, g.guide_online, g.guide_grind, g.guide_dlc, g.guide_ideal, g.guide_avoid, g.guide_best_moment, g.runs_summary, g.missable_summary, g.online_summary, g.grind_summary, g.dlc_scope, g.difficulty_reason, g.time_reason, g.first_run_advice, g.cleanup_advice, g.before_you_start, g.best_for, g.avoid_if, g.verification_status, g.editorial_status, g.coverage_level, g.is_verified, g.verification_note, g.editorial_review_status, g.last_reviewed_at, g.editorial_notes, g.quality_warnings, g.reviewed_by, g.image, g.cover_image, g.created_at, g.updated_at
  )`;

  const totalRow = await get(
    `${baseCte}
     SELECT COUNT(*) AS total
     FROM game_stats
     ${scopedWhereSql}`,
    params
  );

  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
  const safePage = total > 0 ? Math.min(requestedPage, totalPages) : 1;
  const offset = (safePage - 1) * safeLimit;

  const rows = await all(
    `${baseCte}
     SELECT *
     FROM game_stats
     ${scopedWhereSql}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  const items = rows.map(normalizeListRow);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1
    }
  };
}

const CATALOG_COUNT_FACETS = [
  'all',
  'difficulty-low',
  'difficulty-mid',
  'difficulty-high',
  'time-short',
  'time-medium',
  'time-long',
  'trophies-small',
  'trophies-medium',
  'trophies-large',
  'online-none',
  'online-required',
  'coop-required',
  'missable-present',
  'missable-none',
  'grind-present',
  'dlc-base',
  'chapter-select',
  'editorial-verified',
  'editorial-review'
];

async function getCatalogFacetCounts(options = {}) {
  const includeDrafts = Boolean(options.includeDrafts);
  const entries = await Promise.all(CATALOG_COUNT_FACETS.map(async facet => {
    const response = await listGames({ facet, page: 1, limit: 1, includeDrafts });
    return [facet, Number(response.pagination?.total || 0)];
  }));
  return Object.fromEntries(entries);
}

async function getGameRowById(id, options = {}) {
  const row = await get(
    'SELECT id, name, slug, difficulty, time, time_min_hours, time_max_hours, time_sort_hours, time_bucket, missable, guide_runs, guide_online, guide_grind, guide_dlc, guide_ideal, guide_avoid, guide_best_moment, runs_summary, missable_summary, online_summary, grind_summary, dlc_scope, difficulty_reason, time_reason, first_run_advice, cleanup_advice, before_you_start, best_for, avoid_if, verification_status, editorial_status, coverage_level, is_verified, verification_note, editorial_review_status, last_reviewed_at, editorial_notes, quality_warnings, reviewed_by, image, cover_image, created_at, updated_at FROM games WHERE id = ?',
    [id]
  );
  return ensurePublicGame(row, options.includeDrafts);
}

async function getGameById(id, options = {}) {
  const row = await getGameRowById(id, options);
  if (!row) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  const roadmapRows = await all(
    'SELECT content FROM roadmaps WHERE game_id = ? ORDER BY step_order ASC',
    [row.id]
  );

  const trophyRows = await all(
    `SELECT trophy_code, name, name_pt, type, description, tip, is_missable, is_spoiler
     FROM trophies
     WHERE game_id = ?
     ORDER BY CASE type
       WHEN 'Platina' THEN 1
       WHEN 'Ouro' THEN 2
       WHEN 'Prata' THEN 3
       ELSE 4
     END, name ASC`,
    [row.id]
  );

  return normalizeGame(row, roadmapRows, trophyRows);
}

async function getGameByName(name, options = {}) {
  const row = await get(
    'SELECT id FROM games WHERE lower(name) = lower(?)',
    [name]
  );

  if (!row) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  return getGameById(row.id, options);
}

async function getGameBySlug(slug, options = {}) {
  const normalizedSlug = slugifyGameName(slug);
  const directRow = await get('SELECT id, slug FROM games WHERE slug = ?', [normalizedSlug]);

  if (directRow) {
    const game = await getGameById(directRow.id, options);
    return {
      ...game,
      requested_slug: normalizedSlug,
      canonical_slug: game.slug,
      redirect_required: false
    };
  }

  const redirectRow = await get(
    'SELECT g.id, g.slug FROM game_slug_redirects r JOIN games g ON g.id = r.game_id WHERE r.slug = ?',
    [normalizedSlug]
  );

  if (!redirectRow) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  const game = await getGameById(redirectRow.id, options);
  return {
    ...game,
    requested_slug: normalizedSlug,
    canonical_slug: game.slug,
    redirect_required: redirectRow.slug !== normalizedSlug
  };
}

async function insertGameData(gameId, payload) {
  for (let index = 0; index < payload.roadmap.length; index += 1) {
    await run(
      'INSERT INTO roadmaps (game_id, step_order, content) VALUES (?, ?, ?)',
      [gameId, index + 1, serializeRoadmapStep(payload.roadmap[index]).trim()]
    );
  }

  for (const trophy of payload.trophies) {
    await run(
      `INSERT INTO trophies (game_id, trophy_code, name, name_pt, type, description, tip, is_missable, is_spoiler)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gameId,
        trophy.id.trim(),
        trophy.name.trim(),
        trophy.name_pt?.trim() || null,
        normalizeTrophyType(trophy.type),
        trophy.description.trim(),
        trophy.tip.trim(),
        trophy.is_missable ? 1 : 0,
        trophy.is_spoiler ? 1 : 0
      ]
    );
  }
}


async function countGamesUsingImage(imageUrl, excludeGameId = null) {
  if (!imageUrl) return 0;

  const row = excludeGameId
    ? await get('SELECT COUNT(*) AS total FROM games WHERE (image = ? OR cover_image = ?) AND id != ?', [imageUrl, imageUrl, excludeGameId])
    : await get('SELECT COUNT(*) AS total FROM games WHERE image = ? OR cover_image = ?', [imageUrl, imageUrl]);

  return Number(row?.total || 0);
}

async function removeManagedUploadIfUnused(imageUrl, excludeGameId = null) {
  if (!isManagedUpload(imageUrl)) return;

  const usageCount = await countGamesUsingImage(imageUrl, excludeGameId);
  if (usageCount === 0) {
    removeManagedUpload(imageUrl);
  }
}

function buildEditorialPersistence(payload = {}) {
  const runsSummary = firstText(payload.runs_summary, payload.runs);
  const missableSummary = firstText(payload.missable_summary, payload.missable);
  const onlineSummary = firstText(payload.online_summary, payload.online);
  const grindSummary = firstText(payload.grind_summary, payload.grind);
  const dlcScope = firstText(payload.dlc_scope, payload.dlc);
  const bestFor = firstText(payload.best_for, payload.ideal_for);
  const avoidIf = firstText(payload.avoid_if, payload.avoid_for);
  return {
    runsSummary,
    missableSummary,
    onlineSummary,
    grindSummary,
    dlcScope,
    difficultyReason: payload.difficulty_reason || '',
    timeReason: payload.time_reason || '',
    firstRunAdvice: payload.first_run_advice || '',
    cleanupAdvice: payload.cleanup_advice || '',
    beforeYouStart: payload.before_you_start || '',
    bestFor,
    avoidIf,
    verificationStatus: normalizeVerificationStatus(payload.verification_status, payload),
    editorialReviewStatus: normalizeEditorialReviewStatus(payload.editorial_review_status ?? payload.editorialReviewStatus ?? payload.editorialStatus),
    lastReviewedAt: normalizeReviewedDate(payload.last_reviewed_at ?? payload.lastReviewedAt),
    editorialNotes: payload.editorial_notes || payload.editorialNotes || '',
    qualityWarnings: serializeQualityWarnings(payload.quality_warnings ?? payload.qualityWarnings),
    reviewedBy: payload.reviewed_by || payload.reviewedBy || '',
    legacyRuns: runsSummary,
    legacyOnline: onlineSummary,
    legacyGrind: grindSummary,
    legacyDlc: dlcScope,
    legacyIdeal: bestFor,
    legacyAvoid: avoidIf,
    legacyBestMoment: firstText(payload.best_for_when, payload.first_run_advice)
  };
}

async function createGame(payload) {
  const duplicate = await get('SELECT id FROM games WHERE lower(name) = lower(?)', [payload.name]);
  if (duplicate) {
    throw new AppError('Já existe um jogo com esse nome.', 409, null, 'GAME_NAME_CONFLICT');
  }

  const slug = await reserveUniqueSlug(payload.name);
  const timeMeta = formatTimeMetadata(payload.time);
  const editorialStatus = normalizeEditorialStatus(payload.editorial_status);
  const verificationNote = payload.verification_note || '';
  const editorial = buildEditorialPersistence(payload);
  const isVerified = editorial.verificationStatus === 'verified' ? 1 : 0;
  const coverageLevel = normalizeCoverageLevel(payload.coverage_level, {
    ...payload,
    verification_status: editorial.verificationStatus,
    is_verified: isVerified
  });

  await exec('BEGIN TRANSACTION');

  let result;
  try {
    result = await run(
      'INSERT INTO games (name, slug, difficulty, time, time_min_hours, time_max_hours, time_sort_hours, time_bucket, missable, guide_runs, guide_online, guide_grind, guide_dlc, guide_ideal, guide_avoid, guide_best_moment, runs_summary, missable_summary, online_summary, grind_summary, dlc_scope, difficulty_reason, time_reason, first_run_advice, cleanup_advice, before_you_start, best_for, avoid_if, verification_status, editorial_status, coverage_level, is_verified, verification_note, editorial_review_status, last_reviewed_at, editorial_notes, quality_warnings, reviewed_by, image, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [payload.name.trim(), slug, payload.difficulty, payload.time.trim(), timeMeta.time_min_hours, timeMeta.time_max_hours, timeMeta.time_sort_hours, timeMeta.time_bucket, payload.missable.trim(), editorial.legacyRuns, editorial.legacyOnline, editorial.legacyGrind, editorial.legacyDlc, editorial.legacyIdeal, editorial.legacyAvoid, editorial.legacyBestMoment, editorial.runsSummary, editorial.missableSummary, editorial.onlineSummary, editorial.grindSummary, editorial.dlcScope, editorial.difficultyReason, editorial.timeReason, editorial.firstRunAdvice, editorial.cleanupAdvice, editorial.beforeYouStart, editorial.bestFor, editorial.avoidIf, editorial.verificationStatus, editorialStatus, coverageLevel, isVerified, verificationNote, editorial.editorialReviewStatus, editorial.lastReviewedAt, editorial.editorialNotes, editorial.qualityWarnings, editorial.reviewedBy, payload.image?.trim() || null, payload.cover_image?.trim() || null]
    );

    await insertGameData(result.lastID, payload);
    await exec('COMMIT');
  } catch (error) {
    await exec('ROLLBACK').catch(() => {});
    await Promise.all([
      removeManagedUploadIfUnused(payload.image),
      removeManagedUploadIfUnused(payload.cover_image)
    ]);
    throw error;
  }

  return getGameById(result.lastID, { includeDrafts: true });
}

async function updateGame(id, payload) {
  const existing = await getGameRowById(id, { includeDrafts: true });
  if (!existing) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  const duplicate = await get(
    'SELECT id FROM games WHERE lower(name) = lower(?) AND id != ?',
    [payload.name, id]
  );

  if (duplicate) {
    throw new AppError('Já existe outro jogo com esse nome.', 409, null, 'GAME_NAME_CONFLICT');
  }

  const slug = await reserveUniqueSlug(payload.name, id);
  const timeMeta = formatTimeMetadata(payload.time);
  const editorialStatus = normalizeEditorialStatus(payload.editorial_status);
  const verificationNote = payload.verification_note || '';
  const editorial = buildEditorialPersistence(payload);
  const isVerified = editorial.verificationStatus === 'verified' ? 1 : 0;
  const coverageLevel = normalizeCoverageLevel(payload.coverage_level, {
    ...payload,
    verification_status: editorial.verificationStatus,
    is_verified: isVerified
  });

  await exec('BEGIN TRANSACTION');

  try {
    const existingTrophyTranslations = await all(
      'SELECT trophy_code, name_pt FROM trophies WHERE game_id = ?',
      [id]
    );
    const existingNamePtByCode = new Map(existingTrophyTranslations
      .filter(trophy => trophy.name_pt)
      .map(trophy => [trophy.trophy_code, trophy.name_pt]));
    const persistedPayload = {
      ...payload,
      trophies: payload.trophies.map(trophy => ({
        ...trophy,
        name_pt: trophy.name_pt || existingNamePtByCode.get(trophy.id) || ''
      }))
    };

    if (existing.slug && existing.slug !== slug) {
      await run('INSERT OR IGNORE INTO game_slug_redirects (game_id, slug) VALUES (?, ?)', [id, existing.slug]);
      await run('DELETE FROM game_slug_redirects WHERE game_id = ? AND slug = ?', [id, slug]);
    }

    await run(
      'UPDATE games SET name = ?, slug = ?, difficulty = ?, time = ?, time_min_hours = ?, time_max_hours = ?, time_sort_hours = ?, time_bucket = ?, missable = ?, guide_runs = ?, guide_online = ?, guide_grind = ?, guide_dlc = ?, guide_ideal = ?, guide_avoid = ?, guide_best_moment = ?, runs_summary = ?, missable_summary = ?, online_summary = ?, grind_summary = ?, dlc_scope = ?, difficulty_reason = ?, time_reason = ?, first_run_advice = ?, cleanup_advice = ?, before_you_start = ?, best_for = ?, avoid_if = ?, verification_status = ?, editorial_status = ?, coverage_level = ?, is_verified = ?, verification_note = ?, editorial_review_status = ?, last_reviewed_at = ?, editorial_notes = ?, quality_warnings = ?, reviewed_by = ?, image = ?, cover_image = ? WHERE id = ?',
      [payload.name.trim(), slug, payload.difficulty, payload.time.trim(), timeMeta.time_min_hours, timeMeta.time_max_hours, timeMeta.time_sort_hours, timeMeta.time_bucket, payload.missable.trim(), editorial.legacyRuns, editorial.legacyOnline, editorial.legacyGrind, editorial.legacyDlc, editorial.legacyIdeal, editorial.legacyAvoid, editorial.legacyBestMoment, editorial.runsSummary, editorial.missableSummary, editorial.onlineSummary, editorial.grindSummary, editorial.dlcScope, editorial.difficultyReason, editorial.timeReason, editorial.firstRunAdvice, editorial.cleanupAdvice, editorial.beforeYouStart, editorial.bestFor, editorial.avoidIf, editorial.verificationStatus, editorialStatus, coverageLevel, isVerified, verificationNote, editorial.editorialReviewStatus, editorial.lastReviewedAt, editorial.editorialNotes, editorial.qualityWarnings, editorial.reviewedBy, payload.image?.trim() || null, payload.cover_image?.trim() || null, id]
    );

    await run('DELETE FROM roadmaps WHERE game_id = ?', [id]);
    await run('DELETE FROM trophies WHERE game_id = ?', [id]);
    await insertGameData(id, persistedPayload);

    await exec('COMMIT');
  } catch (error) {
    await exec('ROLLBACK').catch(() => {});
    await Promise.all([
      payload.image && payload.image !== existing.image ? removeManagedUploadIfUnused(payload.image, id) : Promise.resolve(),
      payload.cover_image && payload.cover_image !== existing.cover_image ? removeManagedUploadIfUnused(payload.cover_image, id) : Promise.resolve()
    ]);
    throw error;
  }

  await Promise.all([
    existing.image && existing.image !== payload.image ? removeManagedUploadIfUnused(existing.image, id) : Promise.resolve(),
    existing.cover_image && existing.cover_image !== payload.cover_image ? removeManagedUploadIfUnused(existing.cover_image, id) : Promise.resolve()
  ]);

  return getGameById(id, { includeDrafts: true });
}

async function deleteGame(id) {
  const existing = await getGameRowById(id, { includeDrafts: true });
  if (!existing) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  await run('DELETE FROM games WHERE id = ?', [id]);
  await Promise.all([
    removeManagedUploadIfUnused(existing.image),
    removeManagedUploadIfUnused(existing.cover_image)
  ]);

  return { message: 'Jogo removido com sucesso.' };
}


async function reserveDuplicateName(baseName) {
  const trimmed = String(baseName || '').trim() || 'Jogo';
  let sequence = 1;

  while (sequence < 1000) {
    const suffix = sequence === 1 ? ' (Cópia)' : ` (Cópia ${sequence})`;
    const candidate = `${trimmed}${suffix}`;
    const existing = await get('SELECT id FROM games WHERE lower(name) = lower(?)', [candidate]);
    if (!existing) return candidate;
    sequence += 1;
  }

  throw new AppError('Não foi possível gerar um nome único para a cópia.', 500, null, 'DUPLICATE_NAME_GENERATION_FAILED');
}

async function duplicateGame(id) {
  const game = await getGameById(id, { includeDrafts: true });
  const duplicateName = await reserveDuplicateName(game.name);
  const payload = {
    ...game,
    name: duplicateName,
    image: game.image || '',
    cover_image: game.cover_image || '',
    roadmap: [...(game.roadmap || [])],
    trophies: (game.trophies || []).map(item => ({ ...item }))
  };

  return createGame(payload);
}

async function getAdminDashboardSummary() {
  const [gamesCountRow, trophiesCountRow] = await Promise.all([
    get('SELECT COUNT(*) AS total FROM games'),
    get('SELECT COUNT(*) AS total FROM trophies')
  ]);

  return {
    totalGames: gamesCountRow?.total || 0,
    totalTrophies: trophiesCountRow?.total || 0
  };
}

module.exports = {
  listGames,
  getGameById,
  getGameByName,
  getGameBySlug,
  slugifyGameName,
  createGame,
  updateGame,
  deleteGame,
  getAdminDashboardSummary,
  getCatalogFacetCounts,
  reserveUniqueSlug,
  duplicateGame
};
