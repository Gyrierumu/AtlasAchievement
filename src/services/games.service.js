const { all, get, run, exec } = require('../db/db');
const AppError = require('../utils/AppError');
const { removeManagedUpload, isManagedUpload } = require('./file.service');
const { slugifyGameName, getCanonicalGameSlug, buildSlugVariant } = require('../utils/slug');
const { formatTimeMetadata } = require('../utils/time');
const editorialModel = require('../shared/editorialModel');
const guideModel = require('../shared/guideViewModel');
const sampleGames = require('../data/sampleGames');

const PUBLIC_EDITORIAL_STATUSES = new Set(['review', 'published']);
const COVERAGE_LEVELS = new Set(['partial', 'strong', 'complete']);
const VERIFICATION_STATUSES = new Set(['unverified', 'review', 'verified']);
const EDITORIAL_REVIEW_STATUSES = new Set(Object.keys(editorialModel.EDITORIAL_TRUST_STATUSES || {}));
const HOME_HIGHLIGHT_TIME_ZONE = 'America/Sao_Paulo';
const HOME_NEW_DATE_FIELDS = ['added_at', 'addedAt', 'created_at', 'createdAt', 'published_at', 'publishedAt', 'guide_added_at'];
const HOME_VERIFIED_DATE_FIELDS = ['verified_at', 'verifiedAt', 'last_reviewed_at', 'lastReviewedAt'];
const VERIFIED_PERSONA_GUIDE_SLUGS = new Set(['persona-3-reload', 'persona-5-royal']);
const CATALOG_SEED_EDITORIAL_STATUS_SLUGS = new Set([
  'red-dead-redemption-2',
  'resident-evil-3-remake',
  'marvels-spider-man',
  'marvels-spider-man-2',
  'marvels-spider-man-miles-morales'
]);
sampleGames
  .filter(game => game?.is_verified || game?.verification_status === 'verified' || game?.editorial_review_status === 'verified')
  .forEach(game => CATALOG_SEED_EDITORIAL_STATUS_SLUGS.add(String(game?.slug || '').trim().toLowerCase()));

function hasVerifiedEditorialStatus(game = {}) {
  return Boolean(game?.is_verified)
    || game?.verification_status === 'verified'
    || game?.editorial_review_status === 'verified';
}

const LOCALIZED_TROPHY_SOURCE_SLUGS = new Set(['a-way-out', 'armored-core-vi-fires-of-rubicon', 'assassins-creed-mirage', 'assassins-creed-origins', 'assassins-creed-odyssey', 'assassins-creed-shadows', 'assassins-creed-valhalla', 'astro-bot', 'astros-playroom', 'avatar-frontiers-of-pandora', 'baldurs-gate-3', 'beyond-two-souls', 'bloodborne', 'celeste', 'clair-obscur-expedition-33', 'cyberpunk-2077', 'dark-souls-ii-scholar-of-the-first-sin', 'dark-souls-iii', 'dark-souls-remastered', 'days-gone', 'dead-cells', 'death-stranding', 'death-stranding-2-on-the-beach', 'demons-souls', 'detroit-become-human', 'disney-epic-mickey-rebrushed', 'dragons-dogma-2', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'final-fantasy-xvi', 'god-of-war', 'god-of-war-ragnarok', 'gran-turismo-7', 'hades', 'hades-ii', 'heavy-rain', 'hogwarts-legacy', 'hollow-knight', 'hollow-knight-silksong', 'horizon-forbidden-west', 'horizon-zero-dawn', 'it-takes-two', 'lego-batman-legacy-of-the-dark-knight', 'lies-of-p', 'life-is-strange-double-exposure', 'life-is-strange-remastered', 'life-is-strange-true-colors', 'little-nightmares-ii', 'lords-of-the-fallen', 'marvels-spider-man', 'marvels-spider-man-2', 'marvels-spider-man-miles-morales', 'nioh-2', 'nioh-3', 'persona-3-reload', 'persona-5-royal', 'reanimal', 'red-dead-redemption-2', 'resident-evil', 'resident-evil-2-remake', 'resident-evil-3-remake', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village', 'resident-evil-requiem', 'stray', 'the-last-of-us-part-i', 'the-last-of-us-part-ii', 'the-witcher-3-wild-hunt', 'subnautica', 'until-dawn']);
LOCALIZED_TROPHY_SOURCE_SLUGS.add('prince-of-persia-the-lost-crown');
LOCALIZED_TROPHY_SOURCE_SLUGS.add('ratchet-and-clank-rift-apart');
LOCALIZED_TROPHY_SOURCE_SLUGS.add('returnal');
LOCALIZED_TROPHY_SOURCE_SLUGS.add('road-96');
LOCALIZED_TROPHY_SOURCE_SLUGS.add('split-fiction');
LOCALIZED_TROPHY_SOURCE_SLUGS.add('star-wars-jedi-fallen-order');
LOCALIZED_TROPHY_SOURCE_SLUGS.add('star-wars-jedi-survivor');
LOCALIZED_TROPHY_SOURCE_SLUGS.add('black-myth-wukong');
const CATALOG_IMAGE_BY_SLUG = {
  'the-last-of-us-part-ii': 'https://cdn.cloudflare.steamstatic.com/steam/apps/2531310/header.jpg'
};
const CANONICAL_MISSABLE_TROPHIES_BY_SLUG = {
  'clair-obscur-expedition-33': new Set([
    'clair-obscur-follow-the-trail',
    'clair-obscur-maelle',
    'clair-obscur-connoisseur',
    'clair-obscur-professional',
    'clair-obscur-a-peculiar-encounter',
    'clair_obscur_expedition_33_follow_the_trail',
    'clair_obscur_expedition_33_maelle',
    'clair_obscur_expedition_33_connoisseur',
    'clair_obscur_expedition_33_professional',
    'clair_obscur_expedition_33_a_peculiar_encounter'
  ]),
  'detroit-become-human': new Set([
    'detroit-mission-accomplished',
    'detroit-secrets',
    'detroit-deviant-located',
    'detroit-we-are-free',
    'detroit-defend-yourself',
    'detroit-self-control',
    'detroit-confession',
    'detroit-shelter',
    'detroit-know-your-partner',
    'detroit-run-kara-run',
    'detroit-catch-it',
    'detroit-save-hank',
    'detroit-escape-the-manor',
    'detroit-ruthless',
    'detroit-doubts',
    'detroit-jerichos-hero',
    'detroit-just-a-machine',
    'detroit-a-smile-on-her-face',
    'detroit-plan-comes-together',
    'detroit-a-glimpse-of-jericho',
    'detroit-send-a-message',
    'detroit-burn-the-place',
    'detroit-nothing-to-see-here',
    'detroit-confrontation',
    'detroit-stand-your-ground',
    'detroit-priorities',
    'detroit-kinship',
    'detroit-bloodhound',
    'detroit-three-at-jericho',
    'detroit-scorched-earth',
    'detroit-liberation',
    'detroit-moral-victory',
    'detroit-escape-death',
    'detroit-safe-harbor',
    'detroit-an-army-of-me',
    'detroit-mission-complete',
    'detroit-my-turn-to-decide',
    'detroit-compliant',
    'detroit-one-of-us',
    'detroit-undefeated',
    'detroit-bookworm',
    'detroit-partners',
    'detroit-happy-family',
    'detroit-ill-be-back',
    'detroit-these-are-our-stories',
    'detroit-survivors'
  ]),
  'elden-ring': new Set([
    'er_elden_lord',
    'er_age_of_stars',
    'er_frenzied_flame',
    'er_legendary_armaments',
    'er_fortissax'
  ]),
  'resident-evil-requiem': new Set([
    'rerequiem_hope_and_requiem',
    'rerequiem_speed_demon',
    'rerequiem_never_touch_the_stuff',
    'rerequiem_minimalist'
  ]),
  'red-dead-redemption-2': new Set([
    'rdr2_lending_a_hand',
    'rdr2_friends_with_benefits',
    'rdr2_give_to_the_poor',
    'rdr2_errand_boy'
  ]),
  'resident-evil-2-remake': new Set([
    're2r_hats_off',
    're2r_gotcha',
    're2r_treasure_hunter',
    're2r_waist_space',
    're2r_super_spy',
    're2r_young_escapee',
    're2r_time_spare',
    're2r_blink_eye',
    're2r_lore_explorer',
    're2r_complete_vermin',
    're2r_master_unlocking',
    're2r_leon_s',
    're2r_scarlet_hero',
    're2r_frugalist',
    're2r_minimalist',
    're2r_small_footprint'
  ]),
  'resident-evil-3-remake': new Set([
    're3r_nemesis_down',
    're3r_power_stones',
    're3r_unfortunate_end',
    're3r_jill_valentine',
    're3r_electric_slide',
    're3r_bookworm',
    're3r_goodbye_charlie',
    're3r_kendos_armory',
    're3r_master_unlocking',
    're3r_minimalist',
    're3r_need_these_later',
    're3r_sprinter'
  ])
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

function normalizeExplicitBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return undefined;
  if (['true', '1', 'sim', 'yes', 'y', 'on'].includes(text)) return true;
  if (['false', '0', 'nao', 'não', 'no', 'n', 'off'].includes(text)) return false;
  return undefined;
}

function resolveExplicitBoolean(...values) {
  for (const value of values) {
    const normalized = normalizeExplicitBoolean(value);
    if (normalized !== undefined) return normalized;
  }
  return undefined;
}

function normalizeTrophyLookupCode(value = '') {
  const normalized = String(value || '').trim().replace(/_/g, '-').toLowerCase();
  if (normalized === 'detroit-when-a-plan-comes-together') return 'detroit-plan-comes-together';
  return normalized;
}

function normalizeTrophyLookupName(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"');
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

function hasPayloadField(payload = {}, field = '') {
  if (Array.isArray(payload._providedFields)) return payload._providedFields.includes(field);
  return Object.prototype.hasOwnProperty.call(payload, field);
}

function hasAnyPayloadField(payload = {}, fields = []) {
  return fields.some(field => hasPayloadField(payload, field));
}

function normalizeRoadmapForPersistence(roadmap = []) {
  return guideModel.normalizeRoadmapForSave(roadmap);
}

function warnInvalidAdminRoadmap() {
  console.warn('Roadmap inválido recebido do admin; roadmap existente preservado.');
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

function serializeWalkthrough(value = []) {
  const normalized = guideModel.normalizeWalkthrough(value);
  return normalized.length ? JSON.stringify(normalized) : '';
}

function deserializeWalkthrough(value = '') {
  if (Array.isArray(value)) return guideModel.normalizeWalkthrough(value);
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return guideModel.normalizeWalkthrough(parsed);
  } catch (_error) {
    return [];
  }
}

function normalizeGuideCleanupAdvice(row = {}) {
  const text = row.cleanup_advice || '';
  if (row.slug === 'road-96') {
    return text.replace('seleção de capítulos tradicional', 'Chapter Select tradicional');
  }
  return text;
}

function getSeedTrophy(slug = '', trophyCode = '', trophyName = '') {
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  const code = String(trophyCode || '').trim();
  const normalizedCode = normalizeTrophyLookupCode(code);
  const name = normalizeTrophyLookupName(trophyName);
  if (!normalizedSlug || (!code && !name)) return null;
  const game = sampleGames.find(item => String(item?.slug || '').trim().toLowerCase() === normalizedSlug);
  return (game?.trophies || []).find(trophy => trophy?.id === code || normalizeTrophyLookupCode(trophy?.id) === normalizedCode)
    || (name ? (game?.trophies || []).find(trophy => normalizeTrophyLookupName(trophy?.name || trophy?.trophyNameOriginal || trophy?.originalName || trophy?.officialName || '') === name) : null)
    || null;
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
    editorial_review_status: editorialReviewStatus || badge.status || '',
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
  return hasVerifiedEditorialStatus(payload);
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
  const normalizedSlug = getCanonicalGameSlug(row.slug || row.name);
  const seedGame = sampleGames.find(item => String(item?.slug || '').trim().toLowerCase() === normalizedSlug) || null;
  const useAWayOutSeedEditorial = normalizedSlug === 'a-way-out' && seedGame;
  const useArmoredCoreViSeedEditorial = normalizedSlug === 'armored-core-vi-fires-of-rubicon' && seedGame;
  const useAssassinsCreedMirageSeedEditorial = normalizedSlug === 'assassins-creed-mirage' && seedGame;
  const useAssassinsCreedOriginsSeedEditorial = normalizedSlug === 'assassins-creed-origins' && seedGame;
  const useAssassinsCreedOdysseySeedEditorial = normalizedSlug === 'assassins-creed-odyssey' && seedGame;
  const useAssassinsCreedShadowsSeedEditorial = normalizedSlug === 'assassins-creed-shadows' && seedGame;
  const useAssassinsCreedValhallaSeedEditorial = normalizedSlug === 'assassins-creed-valhalla' && seedGame;
  const useBaldursGate3SeedEditorial = normalizedSlug === 'baldurs-gate-3' && seedGame;
  const useResidentEvilSeedEditorial = ['resident-evil', 'resident-evil-2-remake', 'resident-evil-3-remake', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village'].includes(normalizedSlug) && seedGame;
  const useSpiderManSeedEditorial = normalizedSlug === 'marvels-spider-man' && seedGame;
  const useSpiderMan2SeedEditorial = normalizedSlug === 'marvels-spider-man-2' && seedGame;
  const useMilesMoralesSeedEditorial = normalizedSlug === 'marvels-spider-man-miles-morales' && seedGame;
  const useRedDeadRedemption2SeedEditorial = normalizedSlug === 'red-dead-redemption-2' && seedGame;
  const useDarkSouls2SotfsSeedEditorial = normalizedSlug === 'dark-souls-ii-scholar-of-the-first-sin' && seedGame;
  const useDarkSouls3SeedEditorial = normalizedSlug === 'dark-souls-iii' && seedGame;
  const useDarkSoulsRemasteredSeedEditorial = normalizedSlug === 'dark-souls-remastered' && seedGame;
  const useDeathStrandingSeedEditorial = normalizedSlug === 'death-stranding' && seedGame;
  const useDeathStranding2SeedEditorial = normalizedSlug === 'death-stranding-2-on-the-beach' && seedGame;
  const useBloodborneSeedEditorial = normalizedSlug === 'bloodborne' && seedGame;
  const useClairObscurSeedEditorial = normalizedSlug === 'clair-obscur-expedition-33' && seedGame;
  const useDaysGoneSeedEditorial = normalizedSlug === 'days-gone' && seedGame;
  const useDisneyEpicMickeyRebrushedSeedEditorial = normalizedSlug === 'disney-epic-mickey-rebrushed' && seedGame;
  const useDragonDogma2SeedEditorial = normalizedSlug === 'dragons-dogma-2' && seedGame;
  const useFinalFantasyViiRemakeSeedEditorial = normalizedSlug === 'final-fantasy-vii-remake' && seedGame;
  const useFinalFantasyViiRebirthSeedEditorial = normalizedSlug === 'final-fantasy-vii-rebirth' && seedGame;
  const useFinalFantasyXviSeedEditorial = normalizedSlug === 'final-fantasy-xvi' && seedGame;
  const useGranTurismo7SeedEditorial = normalizedSlug === 'gran-turismo-7' && seedGame;
  const useDetroitSeedEditorial = normalizedSlug === 'detroit-become-human' && seedGame;
  const useHadesSeedEditorial = normalizedSlug === 'hades' && seedGame;
  const useHeavyRainSeedEditorial = normalizedSlug === 'heavy-rain' && seedGame;
  const useHogwartsLegacySeedEditorial = normalizedSlug === 'hogwarts-legacy' && seedGame;
  const useHorizonForbiddenWestSeedEditorial = normalizedSlug === 'horizon-forbidden-west' && seedGame;
  const useHorizonZeroDawnSeedEditorial = normalizedSlug === 'horizon-zero-dawn' && seedGame;
  const useLiesOfPSeedEditorial = normalizedSlug === 'lies-of-p' && seedGame;
  const useLordsOfTheFallenSeedEditorial = normalizedSlug === 'lords-of-the-fallen' && seedGame;
  const useUntilDawnSeedEditorial = normalizedSlug === 'until-dawn' && seedGame;
  const useSilksongSeedEditorial = normalizedSlug === 'hollow-knight-silksong' && seedGame;
  const useLifeIsStrangeDoubleExposureSeedEditorial = normalizedSlug === 'life-is-strange-double-exposure' && seedGame;
  const useLifeIsStrangeRemasteredSeedEditorial = normalizedSlug === 'life-is-strange-remastered' && seedGame;
  const useLifeIsStrangeTrueColorsSeedEditorial = normalizedSlug === 'life-is-strange-true-colors' && seedGame;
  const useLittleNightmaresIISeedEditorial = normalizedSlug === 'little-nightmares-ii' && seedGame;
  const useReanimalSeedEditorial = normalizedSlug === 'reanimal' && seedGame;
  const useItTakesTwoSeedEditorial = normalizedSlug === 'it-takes-two' && seedGame;
  const useStraySeedEditorial = normalizedSlug === 'stray' && seedGame;
  const useWitcher3SeedEditorial = normalizedSlug === 'the-witcher-3-wild-hunt' && seedGame;
  const usePrinceOfPersiaLostCrownSeedEditorial = normalizedSlug === 'prince-of-persia-the-lost-crown' && seedGame;
  const useRatchetRiftApartSeedEditorial = normalizedSlug === 'ratchet-and-clank-rift-apart' && seedGame;
  const useReturnalSeedEditorial = normalizedSlug === 'returnal' && seedGame;
  const useRoad96SeedEditorial = normalizedSlug === 'road-96' && seedGame;
  const useSplitFictionSeedEditorial = normalizedSlug === 'split-fiction' && seedGame;
  const useStarWarsJediFallenOrderSeedEditorial = normalizedSlug === 'star-wars-jedi-fallen-order' && seedGame;
  const useStarWarsJediSurvivorSeedEditorial = normalizedSlug === 'star-wars-jedi-survivor' && seedGame;
  const useBlackMythWukongSeedEditorial = normalizedSlug === 'black-myth-wukong' && seedGame;
  const seedHasVerifiedEditorialStatus = hasVerifiedEditorialStatus(seedGame);
  const rowHasVerifiedEditorialStatus = hasVerifiedEditorialStatus(row);
  const preferManualVerifiedEditorial = rowHasVerifiedEditorialStatus && !seedHasVerifiedEditorialStatus;
  const useStrictSeedEditorial = !preferManualVerifiedEditorial && (VERIFIED_PERSONA_GUIDE_SLUGS.has(normalizedSlug) || useAWayOutSeedEditorial || useArmoredCoreViSeedEditorial || useAssassinsCreedMirageSeedEditorial || useAssassinsCreedOriginsSeedEditorial || useAssassinsCreedOdysseySeedEditorial || useAssassinsCreedShadowsSeedEditorial || useAssassinsCreedValhallaSeedEditorial || useBaldursGate3SeedEditorial || useBloodborneSeedEditorial || useClairObscurSeedEditorial || useDarkSouls2SotfsSeedEditorial || useDarkSouls3SeedEditorial || useDarkSoulsRemasteredSeedEditorial || useDaysGoneSeedEditorial || useDisneyEpicMickeyRebrushedSeedEditorial || useDragonDogma2SeedEditorial || useFinalFantasyViiRemakeSeedEditorial || useFinalFantasyViiRebirthSeedEditorial || useFinalFantasyXviSeedEditorial || useGranTurismo7SeedEditorial || useDetroitSeedEditorial || useHadesSeedEditorial || useHeavyRainSeedEditorial || useDeathStrandingSeedEditorial || useDeathStranding2SeedEditorial || useHogwartsLegacySeedEditorial || useHorizonForbiddenWestSeedEditorial || useHorizonZeroDawnSeedEditorial || useItTakesTwoSeedEditorial || useLiesOfPSeedEditorial || useLifeIsStrangeDoubleExposureSeedEditorial || useLifeIsStrangeRemasteredSeedEditorial || useLifeIsStrangeTrueColorsSeedEditorial || useLittleNightmaresIISeedEditorial || useReanimalSeedEditorial || useLordsOfTheFallenSeedEditorial || useResidentEvilSeedEditorial || useSpiderManSeedEditorial || useSpiderMan2SeedEditorial || useMilesMoralesSeedEditorial || useRedDeadRedemption2SeedEditorial || useSilksongSeedEditorial || useStraySeedEditorial || useUntilDawnSeedEditorial || useWitcher3SeedEditorial || usePrinceOfPersiaLostCrownSeedEditorial || useRatchetRiftApartSeedEditorial || useReturnalSeedEditorial || useRoad96SeedEditorial || useSplitFictionSeedEditorial || useStarWarsJediFallenOrderSeedEditorial || useStarWarsJediSurvivorSeedEditorial || useBlackMythWukongSeedEditorial || normalizedSlug === 'avatar-frontiers-of-pandora' || normalizedSlug === 'beyond-two-souls' || normalizedSlug === 'cyberpunk-2077' || normalizedSlug === 'demons-souls' || normalizedSlug === 'sekiro-shadows-die-twice');
  const editorialSource = (usePrinceOfPersiaLostCrownSeedEditorial || useRatchetRiftApartSeedEditorial || useReturnalSeedEditorial || useRoad96SeedEditorial || useSplitFictionSeedEditorial || useStarWarsJediFallenOrderSeedEditorial || useStarWarsJediSurvivorSeedEditorial || useBlackMythWukongSeedEditorial || VERIFIED_PERSONA_GUIDE_SLUGS.has(normalizedSlug) || ['a-way-out', 'armored-core-vi-fires-of-rubicon', 'assassins-creed-mirage', 'assassins-creed-origins', 'assassins-creed-odyssey', 'assassins-creed-shadows', 'assassins-creed-valhalla', 'avatar-frontiers-of-pandora', 'baldurs-gate-3', 'beyond-two-souls', 'bloodborne', 'clair-obscur-expedition-33', 'cyberpunk-2077', 'dark-souls-ii-scholar-of-the-first-sin', 'dark-souls-iii', 'dark-souls-remastered', 'days-gone', 'death-stranding', 'death-stranding-2-on-the-beach', 'demons-souls', 'detroit-become-human', 'disney-epic-mickey-rebrushed', 'dragons-dogma-2', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'final-fantasy-xvi', 'gran-turismo-7', 'hades', 'heavy-rain', 'hogwarts-legacy', 'hollow-knight-silksong', 'horizon-forbidden-west', 'horizon-zero-dawn', 'it-takes-two', 'lies-of-p', 'life-is-strange-double-exposure', 'life-is-strange-remastered', 'life-is-strange-true-colors', 'little-nightmares-ii', 'lords-of-the-fallen', 'marvels-spider-man', 'marvels-spider-man-2', 'marvels-spider-man-miles-morales', 'reanimal', 'red-dead-redemption-2', 'resident-evil', 'resident-evil-2-remake', 'resident-evil-3-remake', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village', 'resident-evil-requiem', 'sekiro-shadows-die-twice', 'stray', 'the-witcher-3-wild-hunt', 'until-dawn'].includes(normalizedSlug)) && seedGame
    ? {
        ...row,
        ...seedGame,
        verification_status: useStrictSeedEditorial ? seedGame.verification_status : (row.verification_status || seedGame.verification_status),
        editorial_status: useStrictSeedEditorial ? seedGame.editorial_status : (row.editorial_status || seedGame.editorial_status),
        coverage_level: useStrictSeedEditorial ? seedGame.coverage_level : (row.coverage_level || seedGame.coverage_level),
        is_verified: useStrictSeedEditorial ? seedGame.is_verified : row.is_verified,
        verification_note: useStrictSeedEditorial ? seedGame.verification_note : (row.verification_note || seedGame.verification_note),
        editorial_review_status: useStrictSeedEditorial ? seedGame.editorial_review_status : (row.editorial_review_status || seedGame.editorial_review_status),
        last_reviewed_at: useStrictSeedEditorial ? seedGame.last_reviewed_at : (row.last_reviewed_at || seedGame.last_reviewed_at),
        editorial_notes: useStrictSeedEditorial ? seedGame.editorial_notes : (row.editorial_notes || seedGame.editorial_notes),
        quality_warnings: useStrictSeedEditorial ? seedGame.quality_warnings : (row.quality_warnings || seedGame.quality_warnings),
        reviewed_by: useStrictSeedEditorial ? seedGame.reviewed_by : (row.reviewed_by || seedGame.reviewed_by)
      }
    : row;
  const supportsLocalizedDescriptions = [
    'a-way-out',
    'armored-core-vi-fires-of-rubicon',
    'assassins-creed-mirage',
    'assassins-creed-origins',
    'assassins-creed-odyssey',
    'assassins-creed-shadows',
    'assassins-creed-valhalla',
    'avatar-frontiers-of-pandora',
    'baldurs-gate-3',
    'black-myth-wukong',
    'celeste',
    'clair-obscur-expedition-33',
    'cyberpunk-2077',
    'beyond-two-souls',
    'bloodborne',
    'dark-souls-ii-scholar-of-the-first-sin',
    'dark-souls-iii',
    'dark-souls-remastered',
    'days-gone',
    'demons-souls',
    'detroit-become-human',
    'disney-epic-mickey-rebrushed',
    'dragons-dogma-2',
    'final-fantasy-vii-remake',
    'final-fantasy-vii-rebirth',
    'final-fantasy-xvi',
    'celeste',
    'elden-ring',
    'death-stranding',
    'death-stranding-2-on-the-beach',
    'god-of-war',
    'gran-turismo-7',
    'hades',
    'heavy-rain',
    'hogwarts-legacy',
    'pragmata',
    'ghost-of-tsushima',
    'hades-ii',
    'hollow-knight',
    'hollow-knight-silksong',
    'marvels-spider-man',
    'marvels-spider-man-2',
    'marvels-spider-man-miles-morales',
    'lies-of-p',
    'life-is-strange-double-exposure',
    'life-is-strange-remastered',
    'life-is-strange-true-colors',
    'little-nightmares-ii',
    'red-dead-redemption-2',
    'astro-bot',
    'astros-playroom',
    'dead-cells',
    'nioh-2',
    'nioh-3',
    'god-of-war-ragnarok',
    'resident-evil',
    'resident-evil-2-remake',
    'resident-evil-3-remake',
    'resident-evil-5',
    'resident-evil-6',
    'resident-evil-7-biohazard',
    'resident-evil-village',
    'resident-evil-requiem',
    'reanimal',
    'returnal',
    'road-96',
    'split-fiction',
    'star-wars-jedi-fallen-order',
    'star-wars-jedi-survivor',
    'saros',
    'horizon-forbidden-west',
    'horizon-zero-dawn',
    'it-takes-two',
    'lego-batman-legacy-of-the-dark-knight',
    'lords-of-the-fallen',
    'stray',
    'the-witcher-3-wild-hunt',
    'until-dawn',
    'the-last-of-us-part-i',
    'the-last-of-us-part-ii',
    'subnautica'
  ].includes(normalizedSlug);
  const canonicalMissableSet = CANONICAL_MISSABLE_TROPHIES_BY_SLUG[normalizedSlug] || null;
  const isCanonicalMissableTrophy = item => canonicalMissableSet
    ? canonicalMissableSet.has(item?.trophy_code) || canonicalMissableSet.has(normalizeTrophyLookupCode(item?.trophy_code))
    : Boolean(item?.is_missable);
  const useSeedTrophyRows = (usePrinceOfPersiaLostCrownSeedEditorial || useRatchetRiftApartSeedEditorial || useReturnalSeedEditorial || useRoad96SeedEditorial || useSplitFictionSeedEditorial || useStarWarsJediFallenOrderSeedEditorial || useStarWarsJediSurvivorSeedEditorial || useBlackMythWukongSeedEditorial || VERIFIED_PERSONA_GUIDE_SLUGS.has(normalizedSlug) || ['a-way-out', 'armored-core-vi-fires-of-rubicon', 'assassins-creed-mirage', 'assassins-creed-origins', 'assassins-creed-odyssey', 'assassins-creed-shadows', 'assassins-creed-valhalla', 'avatar-frontiers-of-pandora', 'baldurs-gate-3', 'beyond-two-souls', 'cyberpunk-2077', 'dark-souls-ii-scholar-of-the-first-sin', 'demons-souls', 'disney-epic-mickey-rebrushed', 'dragons-dogma-2', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'final-fantasy-xvi', 'gran-turismo-7', 'heavy-rain', 'it-takes-two', 'lego-batman-legacy-of-the-dark-knight', 'life-is-strange-true-colors', 'little-nightmares-ii', 'reanimal', 'stray', 'the-witcher-3-wild-hunt'].includes(normalizedSlug)) && Array.isArray(seedGame?.trophies) && seedGame.trophies.length > 0;
  const normalizedTrophyRows = useSeedTrophyRows
    ? seedGame.trophies.map(trophy => ({
        trophy_code: trophy.id,
        name: trophy.name,
        name_pt: trophy.name_pt,
        type: trophy.type,
        description: trophy.description,
        tip: trophy.tip,
        is_missable: Boolean(trophy.is_missable),
        is_spoiler: Boolean(trophy.is_spoiler),
        is_online: Boolean(trophy.is_online || trophy.isOnline),
        is_coop: Boolean(trophy.is_coop || trophy.isCoop)
      }))
    : trophyRows;
  const missableCount = normalizedTrophyRows.filter(item => isCanonicalMissableTrophy(item) && !isPlatinumTrophy(item)).length;
  const seedMissableCount = Number(editorialSource.missableCount ?? editorialSource.missable_count);
  const resolvedMissableCount = Number.isFinite(seedMissableCount) ? seedMissableCount : missableCount;
  const spoilerCount = normalizedTrophyRows.filter(item => item.is_spoiler).length;
  const useSeedRoadmap = (usePrinceOfPersiaLostCrownSeedEditorial || useRatchetRiftApartSeedEditorial || useReturnalSeedEditorial || useRoad96SeedEditorial || useSplitFictionSeedEditorial || useStarWarsJediFallenOrderSeedEditorial || useStarWarsJediSurvivorSeedEditorial || useBlackMythWukongSeedEditorial || VERIFIED_PERSONA_GUIDE_SLUGS.has(normalizedSlug) || ['a-way-out', 'armored-core-vi-fires-of-rubicon', 'assassins-creed-mirage', 'assassins-creed-origins', 'assassins-creed-odyssey', 'assassins-creed-shadows', 'assassins-creed-valhalla', 'avatar-frontiers-of-pandora', 'baldurs-gate-3', 'beyond-two-souls', 'bloodborne', 'clair-obscur-expedition-33', 'cyberpunk-2077', 'dark-souls-ii-scholar-of-the-first-sin', 'dark-souls-iii', 'dark-souls-remastered', 'days-gone', 'dead-cells', 'death-stranding', 'death-stranding-2-on-the-beach', 'demons-souls', 'detroit-become-human', 'disney-epic-mickey-rebrushed', 'dragons-dogma-2', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'final-fantasy-xvi', 'god-of-war', 'god-of-war-ragnarok', 'gran-turismo-7', 'hades', 'heavy-rain', 'hogwarts-legacy', 'hollow-knight-silksong', 'horizon-forbidden-west', 'horizon-zero-dawn', 'it-takes-two', 'lego-batman-legacy-of-the-dark-knight', 'lies-of-p', 'life-is-strange-double-exposure', 'life-is-strange-remastered', 'life-is-strange-true-colors', 'little-nightmares-ii', 'lords-of-the-fallen', 'marvels-spider-man', 'marvels-spider-man-2', 'marvels-spider-man-miles-morales', 'reanimal', 'red-dead-redemption-2', 'resident-evil', 'resident-evil-2-remake', 'resident-evil-3-remake', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village', 'resident-evil-requiem', 'sekiro-shadows-die-twice', 'stray', 'the-witcher-3-wild-hunt', 'until-dawn'].includes(normalizedSlug)) && Array.isArray(seedGame?.roadmap);
  const explicitOfflineBaseSlugs = ['armored-core-vi-fires-of-rubicon', 'assassins-creed-mirage', 'avatar-frontiers-of-pandora', 'baldurs-gate-3', 'black-myth-wukong', 'bloodborne', 'clair-obscur-expedition-33', 'cyberpunk-2077', 'dark-souls-ii-scholar-of-the-first-sin', 'dark-souls-iii', 'dark-souls-remastered', 'days-gone', 'detroit-become-human', 'disney-epic-mickey-rebrushed', 'dragons-dogma-2', 'elden-ring', 'astro-bot', 'astros-playroom', 'dead-cells', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'final-fantasy-xvi', 'god-of-war', 'god-of-war-ragnarok', 'hades', 'heavy-rain', 'hogwarts-legacy', 'hollow-knight', 'hollow-knight-silksong', 'horizon-forbidden-west', 'horizon-zero-dawn', 'life-is-strange-double-exposure', 'life-is-strange-remastered', 'lego-batman-legacy-of-the-dark-knight', 'marvels-spider-man', 'marvels-spider-man-2', 'marvels-spider-man-miles-morales', 'nioh-2', 'nioh-3', 'resident-evil', 'resident-evil-2-remake', 'resident-evil-3-remake', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village', 'resident-evil-requiem', 'road-96', 'saros', 'sekiro-shadows-die-twice', 'star-wars-jedi-fallen-order', 'star-wars-jedi-survivor', 'the-last-of-us-part-i', 'the-last-of-us-part-ii', 'subnautica', 'until-dawn'];
  const seedEditorialSummary = Array.isArray(seedGame?.editorial_summary)
    ? seedGame.editorial_summary.filter(item => String(item || '').trim())
    : [];
  const seedFaq = Array.isArray(seedGame?.faq)
    ? seedGame.faq
      .map(item => ({
        question: firstText(item?.question),
        answer: firstText(item?.answer)
      }))
      .filter(item => item.question && item.answer)
    : [];

  return {
    id: row.id,
    name: editorialSource.name,
    difficulty: editorialSource.difficulty,
    time: editorialSource.time,
    missable: editorialSource.missable,
    image: editorialSource.image,
    cover_image: editorialSource.cover_image || null,
    catalogImage: CATALOG_IMAGE_BY_SLUG[normalizedSlug] || '',
    runs_summary: firstText(editorialSource.runs_summary, editorialSource.guide_runs),
    missable_summary: firstText(editorialSource.missable_summary, editorialSource.missable),
    online_summary: firstText(editorialSource.online_summary, editorialSource.guide_online),
    grind_summary: firstText(editorialSource.grind_summary, editorialSource.guide_grind),
    dlc_scope: firstText(editorialSource.dlc_scope, editorialSource.guide_dlc),
    difficulty_reason: editorialSource.difficulty_reason || '',
    time_reason: editorialSource.time_reason || '',
    first_run_advice: editorialSource.first_run_advice || '',
    editorial_summary: seedEditorialSummary.length
      ? seedEditorialSummary
      : Array.isArray(editorialSource.editorial_summary)
      ? editorialSource.editorial_summary.filter(item => String(item || '').trim())
      : [],
    seo: editorialSource.seo && typeof editorialSource.seo === 'object' ? { ...editorialSource.seo } : {},
    quickDecision: editorialSource.quickDecision && typeof editorialSource.quickDecision === 'object' ? { ...editorialSource.quickDecision } : null,
    checklist: Array.isArray(editorialSource.checklist) ? editorialSource.checklist.slice() : [],
    walkthrough: deserializeWalkthrough(Array.isArray(seedGame?.walkthrough) && seedGame.walkthrough.length
      ? seedGame.walkthrough
      : editorialSource.walkthrough),
    attentionPoints: Array.isArray(editorialSource.attentionPoints) ? editorialSource.attentionPoints.map(item => ({ ...item })) : [],
    faq: seedFaq.length
      ? seedFaq
      : Array.isArray(editorialSource.faq)
      ? editorialSource.faq
        .map(item => ({
          question: firstText(item?.question),
          answer: firstText(item?.answer)
        }))
        .filter(item => item.question && item.answer)
      : [],
    cleanup_advice: normalizeGuideCleanupAdvice(editorialSource),
    before_you_start: editorialSource.before_you_start || '',
    best_for: firstText(editorialSource.best_for, editorialSource.guide_ideal),
    avoid_if: firstText(editorialSource.avoid_if, editorialSource.guide_avoid),
    verification_status: normalizeVerificationStatus(editorialSource.verification_status, editorialSource),
    runs: firstText(editorialSource.runs_summary, editorialSource.guide_runs),
    online: firstText(editorialSource.online_summary, editorialSource.guide_online),
    grind: firstText(editorialSource.grind_summary, editorialSource.guide_grind),
    dlc: firstText(editorialSource.dlc_scope, editorialSource.guide_dlc),
    ideal_for: firstText(editorialSource.best_for, editorialSource.guide_ideal),
    avoid_for: firstText(editorialSource.avoid_if, editorialSource.guide_avoid),
    best_for_when: editorialSource.guide_best_moment || '',
    editorial_status: normalizeEditorialStatus(editorialSource.editorial_status),
    publication_status: normalizeEditorialStatus(editorialSource.editorial_status),
    ...buildEditorialReviewFields(editorialSource),
    coverage_level: normalizeCoverageLevel(editorialSource.coverage_level, editorialSource),
    is_verified: Boolean(editorialSource.is_verified),
    verification_note: editorialSource.verification_note || '',
    slug: getCanonicalGameSlug(editorialSource.slug || editorialSource.name),
    chapterSelect: ['a-way-out', 'detroit-become-human', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'heavy-rain', 'life-is-strange-double-exposure', 'life-is-strange-remastered', 'life-is-strange-true-colors', 'little-nightmares-ii', 'reanimal', 'resident-evil-5', 'resident-evil-6', 'split-fiction', 'the-last-of-us-part-i', 'the-last-of-us-part-ii', 'until-dawn'].includes(normalizedSlug) ? true : (['nioh-3', 'road-96', 'saros', 'star-wars-jedi-fallen-order', 'star-wars-jedi-survivor', 'subnautica'].includes(normalizedSlug) ? false : undefined),
    missionReplay: normalizedSlug === 'nioh-3' ? true : undefined,
    openWorldCleanup: normalizedSlug === 'subnautica' ? true : undefined,
    onlineRequired: explicitOfflineBaseSlugs.includes(normalizedSlug) ? false : (editorialSource.onlineRequired ?? editorialSource.online_required),
    coopRequired: explicitOfflineBaseSlugs.includes(normalizedSlug) ? false : (editorialSource.coopRequired ?? editorialSource.coop_required),
    coopRequirementLabel: firstText(editorialSource.coopRequirementLabel, editorialSource.coop_requirement_label, editorialSource.duoModeRequirementLabel, editorialSource.duo_mode_requirement_label),
    dlcRequired: explicitOfflineBaseSlugs.includes(normalizedSlug) ? false : (editorialSource.dlcRequired ?? editorialSource.dlc_required),
    hasMissables: editorialSource.hasMissables ?? Boolean(resolvedMissableCount),
    missableCount: resolvedMissableCount,
    dlc_status: normalizedSlug === 'elden-ring' ? 'out_of_base_scope' : undefined,
    dlcGuideStatus: normalizedSlug === 'elden-ring' ? 'pending' : undefined,
    extraContentStatus: normalizedSlug === 'elden-ring' ? 'pending' : undefined,
    newGamePlusRequired: ['armored-core-vi-fires-of-rubicon', 'black-myth-wukong', 'final-fantasy-xvi', 'marvels-spider-man-miles-morales', 'the-last-of-us-part-ii'].includes(normalizedSlug) ? true : (['assassins-creed-mirage', 'clair-obscur-expedition-33', 'days-gone', 'dead-cells', 'detroit-become-human', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'god-of-war-ragnarok', 'hogwarts-legacy', 'horizon-forbidden-west', 'horizon-zero-dawn', 'lego-batman-legacy-of-the-dark-knight', 'marvels-spider-man', 'marvels-spider-man-2', 'resident-evil', 'resident-evil-2-remake', 'resident-evil-3-remake', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village', 'road-96', 'split-fiction', 'star-wars-jedi-fallen-order', 'star-wars-jedi-survivor', 'the-last-of-us-part-i'].includes(normalizedSlug) ? false : undefined),
    difficultyTrophiesRequired: ['baldurs-gate-3', 'dead-cells', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'final-fantasy-xvi', 'resident-evil', 'resident-evil-2-remake', 'resident-evil-3-remake', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village', 'the-witcher-3-wild-hunt'].includes(normalizedSlug) ? true : (['armored-core-vi-fires-of-rubicon', 'assassins-creed-mirage', 'black-myth-wukong', 'clair-obscur-expedition-33', 'dark-souls-ii-scholar-of-the-first-sin', 'days-gone', 'detroit-become-human', 'disney-epic-mickey-rebrushed', 'dragons-dogma-2', 'god-of-war-ragnarok', 'gran-turismo-7', 'heavy-rain', 'hogwarts-legacy', 'horizon-forbidden-west', 'horizon-zero-dawn', 'lego-batman-legacy-of-the-dark-knight', 'life-is-strange-true-colors', 'marvels-spider-man', 'marvels-spider-man-2', 'marvels-spider-man-miles-morales', 'returnal', 'road-96', 'split-fiction', 'star-wars-jedi-fallen-order', 'star-wars-jedi-survivor', 'the-last-of-us-part-i', 'the-last-of-us-part-ii'].includes(normalizedSlug) ? false : undefined),
    roadmap: (useSeedRoadmap
      ? seedGame.roadmap
      : roadmapRows.map(item => deserializeRoadmapStep(item.content)))
      .map((step, index, rows) => guideModel.normalizeRoadmapStep(step, index, rows.length)),
    trophies: normalizedTrophyRows.map(item => {
      const canonicalIsMissable = isCanonicalMissableTrophy(item) && !isPlatinumTrophy(item);
      const seedTrophy = LOCALIZED_TROPHY_SOURCE_SLUGS.has(normalizedSlug) ? getSeedTrophy(normalizedSlug, item.trophy_code, item.name) : null;
      const useSeedEditorialTrophy = (usePrinceOfPersiaLostCrownSeedEditorial || useRatchetRiftApartSeedEditorial || useReturnalSeedEditorial || useRoad96SeedEditorial || useSplitFictionSeedEditorial || useStarWarsJediFallenOrderSeedEditorial || useStarWarsJediSurvivorSeedEditorial || useBlackMythWukongSeedEditorial || VERIFIED_PERSONA_GUIDE_SLUGS.has(normalizedSlug) || ['a-way-out', 'armored-core-vi-fires-of-rubicon', 'assassins-creed-mirage', 'assassins-creed-origins', 'assassins-creed-odyssey', 'assassins-creed-shadows', 'assassins-creed-valhalla', 'avatar-frontiers-of-pandora', 'baldurs-gate-3', 'beyond-two-souls', 'bloodborne', 'celeste', 'clair-obscur-expedition-33', 'cyberpunk-2077', 'dark-souls-ii-scholar-of-the-first-sin', 'dark-souls-iii', 'dark-souls-remastered', 'days-gone', 'dead-cells', 'death-stranding', 'death-stranding-2-on-the-beach', 'demons-souls', 'detroit-become-human', 'disney-epic-mickey-rebrushed', 'dragons-dogma-2', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'final-fantasy-xvi', 'god-of-war', 'god-of-war-ragnarok', 'gran-turismo-7', 'hades', 'heavy-rain', 'hogwarts-legacy', 'hollow-knight-silksong', 'horizon-forbidden-west', 'horizon-zero-dawn', 'it-takes-two', 'lego-batman-legacy-of-the-dark-knight', 'lies-of-p', 'life-is-strange-double-exposure', 'life-is-strange-remastered', 'life-is-strange-true-colors', 'little-nightmares-ii', 'lords-of-the-fallen', 'marvels-spider-man', 'marvels-spider-man-2', 'marvels-spider-man-miles-morales', 'reanimal', 'red-dead-redemption-2', 'resident-evil', 'resident-evil-2-remake', 'resident-evil-3-remake', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village', 'resident-evil-requiem', 'stray', 'the-witcher-3-wild-hunt', 'until-dawn'].includes(normalizedSlug)) && seedTrophy;
      const isMissable = useSeedEditorialTrophy
        ? Boolean(seedTrophy.is_missable || seedTrophy.isMissable || seedTrophy.missable)
        : canonicalIsMissable;
      const localizedSeedDescription = seedTrophy?.descriptionPtBr
        || seedTrophy?.ptDescription
        || seedTrophy?.localizedDescription?.ptBr
        || seedTrophy?.localizedDescription?.['pt-BR']
        || (normalizedSlug === 'life-is-strange-remastered' ? seedTrophy?.tip || '' : '')
        || '';
      const description = useSeedEditorialTrophy ? (localizedSeedDescription || seedTrophy.description || item.description || '') : (item.description || '');
      const tip = useSeedEditorialTrophy ? (seedTrophy.tip || item.tip || '') : item.tip;
      const originalName = useSeedEditorialTrophy ? (seedTrophy.name || item.name || '') : (item.name || '');
      const namePt = useSeedEditorialTrophy ? (seedTrophy.name_pt || '') : (item.name_pt || '');
      const seedTags = useSeedEditorialTrophy && Array.isArray(seedTrophy.tags)
        ? seedTrophy.tags.map(tag => (typeof tag === 'string' ? tag : { ...tag }))
        : [];
      return {
        id: item.trophy_code,
        name: originalName,
        name_pt: namePt,
        trophyNameOriginal: originalName,
        trophyNamePtBr: namePt,
        namePtSource: namePt && LOCALIZED_TROPHY_SOURCE_SLUGS.has(normalizedSlug) ? (seedTrophy?.namePtSource || (['a-way-out', 'assassins-creed-origins', 'assassins-creed-odyssey', 'avatar-frontiers-of-pandora', 'baldurs-gate-3', 'beyond-two-souls', 'celeste', 'clair-obscur-expedition-33', 'dead-cells', 'demons-souls', 'detroit-become-human', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'final-fantasy-xvi', 'god-of-war', 'hades', 'heavy-rain', 'hogwarts-legacy', 'horizon-forbidden-west', 'horizon-zero-dawn', 'it-takes-two', 'life-is-strange-double-exposure', 'life-is-strange-remastered', 'life-is-strange-true-colors', 'marvels-spider-man', 'marvels-spider-man-miles-morales', 'resident-evil', 'resident-evil-2-remake', 'resident-evil-3-remake', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village', 'stray', 'the-witcher-3-wild-hunt'].includes(normalizedSlug) ? 'editorial_ptbr' : 'trusted_steam_ptbr')) : '',
        type: item.type,
        description,
        descriptionOriginal: ['resident-evil', 'resident-evil-2-remake', 'resident-evil-3-remake', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village'].includes(normalizedSlug) ? '' : (seedTrophy?.descriptionOriginal || ''),
        descriptionPtBr: supportsLocalizedDescriptions ? (localizedSeedDescription || description) : '',
        ptDescription: supportsLocalizedDescriptions ? (localizedSeedDescription || description) : '',
        descriptionPtSource: supportsLocalizedDescriptions && LOCALIZED_TROPHY_SOURCE_SLUGS.has(normalizedSlug) ? (seedTrophy?.descriptionPtSource || (['a-way-out', 'assassins-creed-origins', 'assassins-creed-odyssey', 'avatar-frontiers-of-pandora', 'baldurs-gate-3', 'beyond-two-souls', 'celeste', 'clair-obscur-expedition-33', 'dead-cells', 'demons-souls', 'detroit-become-human', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'final-fantasy-xvi', 'hades', 'heavy-rain', 'hogwarts-legacy', 'horizon-forbidden-west', 'horizon-zero-dawn', 'it-takes-two', 'life-is-strange-double-exposure', 'life-is-strange-remastered', 'life-is-strange-true-colors', 'marvels-spider-man', 'marvels-spider-man-miles-morales', 'resident-evil', 'resident-evil-2-remake', 'resident-evil-3-remake', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village', 'stray', 'the-witcher-3-wild-hunt'].includes(normalizedSlug) ? 'editorial_ptbr' : 'trusted_steam_ptbr')) : '',
        tip,
        riskType: seedTrophy?.riskType || '',
        is_missable: isMissable,
        is_spoiler: useSeedEditorialTrophy ? Boolean(seedTrophy.is_spoiler) : Boolean(item.is_spoiler),
        is_online: useSeedEditorialTrophy ? Boolean(seedTrophy.is_online || seedTrophy.isOnline) : Boolean(item.is_online),
        isOnline: useSeedEditorialTrophy ? Boolean(seedTrophy.is_online || seedTrophy.isOnline) : Boolean(item.is_online),
        is_coop: useSeedEditorialTrophy ? Boolean(seedTrophy.is_coop || seedTrophy.isCoop) : Boolean(item.is_coop),
        isCoop: useSeedEditorialTrophy ? Boolean(seedTrophy.is_coop || seedTrophy.isCoop) : Boolean(item.is_coop),
        tags: seedTags
      };
    }),
    created_at: row.created_at,
    updated_at: row.updated_at,
    time_min_hours: editorialSource.time_min_hours,
    time_max_hours: editorialSource.time_max_hours,
    time_sort_hours: editorialSource.time_sort_hours,
    time_bucket: editorialSource.time_bucket || null,
    missable_count: resolvedMissableCount,
    spoiler_count: spoilerCount,
    attention_count: resolvedMissableCount + spoilerCount
  };
}

function getSaoPauloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HOME_HIGHLIGHT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const read = type => Number(parts.find(part => part.type === type)?.value || 0);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day')
  };
}

function formatDateKeyFromParts(parts = {}) {
  const year = String(parts.year || '').padStart(4, '0');
  const month = String(parts.month || '').padStart(2, '0');
  const day = String(parts.day || '').padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey = '', offsetDays = 0) {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + offsetDays));
  return formatDateKeyFromParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  });
}

function getWeeklyHomeHighlightWindow(now = new Date()) {
  const nowKey = formatDateKeyFromParts(getSaoPauloDateParts(now));
  const nowDate = new Date(Date.UTC(
    Number(nowKey.slice(0, 4)),
    Number(nowKey.slice(5, 7)) - 1,
    Number(nowKey.slice(8, 10))
  ));
  const weekKey = shiftDateKey(nowKey, -nowDate.getUTCDay());
  return { weekKey, nowKey };
}

function getFirstDateFieldValue(game = {}, fields = []) {
  for (const field of fields) {
    const value = game?.[field];
    if (value) return { field, value };
  }
  return { field: '', value: '' };
}

function normalizeHomeHighlightDateKey(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatDateKeyFromParts(getSaoPauloDateParts(parsed));
}

function isDateKeyInCurrentHomeWeek(dateKey = '', weekKey = '', nowKey = '') {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    && dateKey >= weekKey
    && dateKey <= nowKey;
}

function isHomeHighlightVerifiedGame(game = {}) {
  const verificationStatus = String(game.verification_status || game.verificationStatus || '').trim().toLowerCase();
  const reviewStatus = String(game.editorial_review_status || game.editorialReviewStatus || game.editorialStatus || '').trim().toLowerCase();
  const coverage = String(game.coverage_level || game.coverageLevel || '').trim().toLowerCase();
  const hasVerifiedStatus = game.is_verified === true || verificationStatus === 'verified';
  const hasTrustedCoverage = coverage === 'strong' || coverage === 'complete';
  return hasVerifiedStatus && reviewStatus === 'verified' && hasTrustedCoverage;
}

function buildHomeHighlightItem(game = {}, dateField = '', dateValue = '') {
  const slug = String(game.slug || '').trim().toLowerCase();
  const platforms = Array.isArray(game.platforms) ? game.platforms.filter(Boolean) : [];
  const isVerified = isHomeHighlightVerifiedGame(game);
  return {
    title: game.title || game.name || slug,
    name: game.name || game.title || slug,
    slug,
    href: slug ? `/jogo/${slug}` : '',
    image: game.image || game.cover_image || game.coverImage || '',
    cover: game.cover_image || game.coverImage || game.image || '',
    platform: game.platform_base || game.platformBase || platforms.join('/') || '',
    difficulty: game.difficulty ?? '',
    time: game.time || game.estimatedTime || '',
    is_verified: isVerified,
    status: isVerified ? 'verified' : 'in_review',
    date: normalizeHomeHighlightDateKey(dateValue),
    dateField
  };
}

function getWeeklyHomeHighlights(games = sampleGames, now = new Date()) {
  const { weekKey, nowKey } = getWeeklyHomeHighlightWindow(now);
  const sourceGames = Array.isArray(games) ? games : [];
  const newGames = sourceGames
    .map(game => {
      const { field, value } = getFirstDateFieldValue(game, HOME_NEW_DATE_FIELDS);
      const dateKey = normalizeHomeHighlightDateKey(value);
      if (!isDateKeyInCurrentHomeWeek(dateKey, weekKey, nowKey)) return null;
      return buildHomeHighlightItem(game, field, value);
    })
    .filter(item => item?.slug && item.href)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'))
    .slice(0, 5);

  const newSlugs = new Set(newGames.map(item => item.slug));
  const verifiedGames = sourceGames
    .map(game => {
      if (!isHomeHighlightVerifiedGame(game)) return null;
      const { field, value } = getFirstDateFieldValue(game, HOME_VERIFIED_DATE_FIELDS);
      const dateKey = normalizeHomeHighlightDateKey(value);
      if (!isDateKeyInCurrentHomeWeek(dateKey, weekKey, nowKey)) return null;
      const item = buildHomeHighlightItem(game, field, value);
      return newSlugs.has(item.slug) ? null : item;
    })
    .filter(item => item?.slug && item.href)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'))
    .slice(0, 5);

  return {
    weekKey,
    newGames,
    verifiedGames,
    hasHighlights: Boolean(newGames.length || verifiedGames.length)
  };
}

function getWeeklyHomeUpdatePopup(now = new Date()) {
  const highlights = getWeeklyHomeHighlights(sampleGames, now);
  const localStorageKey = `atlas-home-news-popup-seen-${highlights.weekKey}`;

  if (!highlights.hasHighlights) {
    return {
      id: `weekly-home-highlights-${highlights.weekKey}`,
      active: false,
      weekKey: highlights.weekKey,
      localStorageKey,
      sections: []
    };
  }

  const sections = [
    highlights.newGames.length
      ? {
          title: 'Novos guias',
          items: highlights.newGames.map(item => ({
            label: item.name || item.title,
            href: item.href,
            slug: item.slug,
            verified: item.is_verified
          }))
        }
      : null,
    highlights.verifiedGames.length
      ? {
          title: 'Guias verificados',
          items: highlights.verifiedGames.map(item => ({
            label: item.name || item.title,
            href: item.href,
            slug: item.slug,
            verified: true
          }))
        }
      : null
  ].filter(Boolean);

  return {
    id: `weekly-home-highlights-${highlights.weekKey}`,
    active: true,
    type: 'weekly_home_highlights',
    weekKey: highlights.weekKey,
    title: 'Novidades da semana',
    subtitle: 'Guias adicionados e verificados recentemente no AtlasAchievement.',
    conservativeSubtitle: 'Guias adicionados e verificados recentemente no AtlasAchievement.',
    description: 'Confira os guias que entraram no catálogo e as revisões editoriais mais recentes desta semana.',
    localStorageKey,
    primaryCta: {
      label: 'Ver catálogo',
      href: '/catalogo'
    },
    secondaryCta: {
      label: 'Explorar guias',
      href: '/catalogo'
    },
    sections,
    highlights
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

  const chapterSelectNegatedSql = `((${chapterText}) LIKE '%não há chapter select%' OR (${chapterText}) LIKE '%nao ha chapter select%' OR (${chapterText}) LIKE '%não tem chapter select%' OR (${chapterText}) LIKE '%nao tem chapter select%' OR (${chapterText}) LIKE '%sem chapter select%' OR (${chapterText}) LIKE '%não existe chapter select%' OR (${chapterText}) LIKE '%nao existe chapter select%' OR (${chapterText}) LIKE '%não há seleção de capítulo%' OR (${chapterText}) LIKE '%nao ha selecao de capitulo%' OR (${chapterText}) LIKE '%sem seleção de capítulo%' OR (${chapterText}) LIKE '%sem selecao de capitulo%')`;

  const seedOnlineRequiredSlugs = sampleGames
    .filter(game => resolveExplicitBoolean(game?.onlineRequired, game?.online_required, game?.requiresOnline, game?.hasMandatoryOnline) === true)
    .map(game => String(game?.slug || '').trim().toLowerCase())
    .filter(Boolean);

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
      if (seedOnlineRequiredSlugs.length) {
        where.push(`slug NOT IN (${seedOnlineRequiredSlugs.map(() => '?').join(',')})`);
        params.push(...seedOnlineRequiredSlugs);
      }
      where.push("(coalesce(editorial_review_status, '') != 'needs_online_check')");
      break;
    case 'online-required':
      if (seedOnlineRequiredSlugs.length) {
        where.push(`(slug IN (${seedOnlineRequiredSlugs.map(() => '?').join(',')}) OR ${onlineRequiredSql})`);
        params.push(...seedOnlineRequiredSlugs);
      } else {
        where.push(onlineRequiredSql);
      }
      where.push(`NOT ((${onlineText}) LIKE '%não há%online obrigat%' OR (${onlineText}) LIKE '%nao ha%online obrigat%' OR (${onlineText}) LIKE '%sem online obrigat%' OR (${onlineText}) LIKE '%não exige online%' OR (${onlineText}) LIKE '%nao exige online%' OR (${onlineText}) LIKE '%online opcional%' OR (${onlineText}) LIKE '%recursos online opcionais%' OR (${onlineText}) LIKE '%fora dos requisitos da platina%')`);
      break;
    case 'coop-required': {
      const seedCoopRequiredSlugs = sampleGames
        .filter(game => resolveExplicitBoolean(game?.coopRequired, game?.coop_required) === true)
        .map(game => String(game?.slug || '').trim().toLowerCase())
        .filter(Boolean);
      if (seedCoopRequiredSlugs.length) {
        where.push(`(slug IN (${seedCoopRequiredSlugs.map(() => '?').join(',')}) OR ${coopRequiredSql})`);
        params.push(...seedCoopRequiredSlugs);
      } else {
        where.push(coopRequiredSql);
      }
      where.push(`NOT ((${onlineText}) LIKE '%não há%coop obrigat%' OR (${onlineText}) LIKE '%nao ha%coop obrigat%' OR (${onlineText}) LIKE '%não indica%coop obrigat%' OR (${onlineText}) LIKE '%nao indica%coop obrigat%' OR (${onlineText}) LIKE '%sem coop obrigat%' OR (${onlineText}) LIKE '%não exige coop%' OR (${onlineText}) LIKE '%nao exige coop%' OR (${onlineText}) LIKE '%coop opcional%' OR (${onlineText}) LIKE '%single-player%' OR (${onlineText}) LIKE '%single player%' OR lower(coalesce(before_you_start, '')) LIKE '%não há%coop obrigat%' OR lower(coalesce(before_you_start, '')) LIKE '%nao ha%coop obrigat%' OR lower(coalesce(before_you_start, '')) LIKE '%não indica%coop obrigat%' OR lower(coalesce(before_you_start, '')) LIKE '%nao indica%coop obrigat%' OR lower(coalesce(before_you_start, '')) LIKE '%sem coop obrigat%' OR lower(coalesce(before_you_start, '')) LIKE '%single-player%' OR lower(coalesce(before_you_start, '')) LIKE '%single player%')`);
      where.push(`NOT ((${onlineText}) LIKE '%sem%coop obrigat%' OR lower(coalesce(before_you_start, '')) LIKE '%sem%coop obrigat%')`);
      break;
    }
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
    case 'editorial-verified': {
      const seedVerifiedSlugs = Array.from(CATALOG_SEED_EDITORIAL_STATUS_SLUGS);
      where.push(`(editorial_review_status = 'verified' OR is_verified = 1 OR verification_status = 'verified' OR slug IN (${seedVerifiedSlugs.map(() => '?').join(',')}))`);
      params.push(...seedVerifiedSlugs);
      break;
    }
    case 'editorial-review': {
      const seedVerifiedSlugs = Array.from(CATALOG_SEED_EDITORIAL_STATUS_SLUGS);
      where.push("(coalesce(editorial_review_status, '') IN ('in_review', 'needs_missables_check', 'needs_online_check', 'dlc_pending', 'outdated') OR (is_verified = 0 AND (verification_status = 'review' OR editorial_status = 'review' OR coverage_level = 'strong')))");
      where.push(`slug NOT IN (${seedVerifiedSlugs.map(() => '?').join(',')})`);
      params.push(...seedVerifiedSlugs);
      break;
    }
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
  const listSeedGame = sampleGames.find(item => String(item?.slug || '').trim().toLowerCase() === normalizedSlug) || null;
  const preferManualVerifiedEditorial = hasVerifiedEditorialStatus(row) && !hasVerifiedEditorialStatus(listSeedGame);
  const seedGame = (!preferManualVerifiedEditorial && (CATALOG_SEED_EDITORIAL_STATUS_SLUGS.has(normalizedSlug) || normalizedSlug === 'assassins-creed-shadows' || normalizedSlug === 'assassins-creed-valhalla' || normalizedSlug === 'clair-obscur-expedition-33' || normalizedSlug === 'days-gone' || normalizedSlug === 'hogwarts-legacy' || normalizedSlug === 'it-takes-two' || normalizedSlug === 'stray'))
    ? listSeedGame
    : null;
  const editorialSource = seedGame
    ? {
        ...row,
        is_verified: seedGame.is_verified,
        verification_status: seedGame.verification_status,
        editorial_review_status: seedGame.editorial_review_status,
        editorial_status: seedGame.editorial_status,
        coverage_level: seedGame.coverage_level,
        verification_note: seedGame.verification_note,
        last_reviewed_at: seedGame.last_reviewed_at,
        editorial_notes: seedGame.editorial_notes,
        quality_warnings: seedGame.quality_warnings,
        reviewed_by: seedGame.reviewed_by
      }
    : row;
  const usesCatalogSeedFlags = VERIFIED_PERSONA_GUIDE_SLUGS.has(normalizedSlug) || ['avatar-frontiers-of-pandora', 'baldurs-gate-3', 'beyond-two-souls', 'bloodborne', 'cyberpunk-2077', 'dark-souls-ii-scholar-of-the-first-sin', 'dark-souls-iii', 'dark-souls-remastered', 'demons-souls', 'disney-epic-mickey-rebrushed', 'dragons-dogma-2', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'final-fantasy-xvi', 'gran-turismo-7', 'heavy-rain', 'hogwarts-legacy', 'horizon-forbidden-west', 'horizon-zero-dawn', 'life-is-strange-true-colors', 'resident-evil-7-biohazard', 'resident-evil-village', 'star-wars-jedi-fallen-order'].includes(normalizedSlug);
  const usesCatalogSeedMissableFlags = usesCatalogSeedFlags || ['a-way-out', 'assassins-creed-origins', 'assassins-creed-odyssey', 'assassins-creed-shadows', 'assassins-creed-valhalla', 'it-takes-two', 'stray', 'the-witcher-3-wild-hunt'].includes(normalizedSlug);
  const seedMissableCount = usesCatalogSeedMissableFlags
    ? Number(listSeedGame?.missableCount ?? listSeedGame?.missable_count)
    : NaN;
  const canonicalMissableCount = Number.isFinite(seedMissableCount) ? seedMissableCount : (CANONICAL_MISSABLE_TROPHIES_BY_SLUG[normalizedSlug]?.size || null);
  const missableCount = canonicalMissableCount ?? Number(row.missable_count || 0);
  const spoilerCount = Number(row.spoiler_count || 0);
  const normalizedOnlineRequired = resolveExplicitBoolean(listSeedGame?.onlineRequired, listSeedGame?.online_required, row.onlineRequired, row.online_required);
  const normalizedCoopRequired = resolveExplicitBoolean(listSeedGame?.coopRequired, listSeedGame?.coop_required, row.coopRequired, row.coop_required);
  const normalizedDlcRequired = resolveExplicitBoolean(listSeedGame?.dlcRequired, listSeedGame?.dlc_required, row.dlcRequired, row.dlc_required);
  const normalizedNewGamePlusRequired = resolveExplicitBoolean(listSeedGame?.newGamePlusRequired, listSeedGame?.requiresNewGamePlus, row.newGamePlusRequired, row.requiresNewGamePlus);
  const normalizedDifficultyTrophiesRequired = resolveExplicitBoolean(listSeedGame?.difficultyTrophiesRequired, row.difficultyTrophiesRequired);
  const useCatalogSeedName = ['baldurs-gate-3', 'demons-souls', 'dragons-dogma-2', 'gran-turismo-7', 'life-is-strange-true-colors'].includes(normalizedSlug) && seedGame;
  const useCatalogSeedTiming = (VERIFIED_PERSONA_GUIDE_SLUGS.has(normalizedSlug) || ['avatar-frontiers-of-pandora', 'baldurs-gate-3', 'beyond-two-souls', 'cyberpunk-2077', 'dark-souls-ii-scholar-of-the-first-sin', 'demons-souls', 'disney-epic-mickey-rebrushed', 'dragons-dogma-2', 'final-fantasy-vii-remake', 'final-fantasy-vii-rebirth', 'final-fantasy-xvi', 'gran-turismo-7', 'heavy-rain', 'life-is-strange-true-colors'].includes(normalizedSlug)) && seedGame;
  return {
    ...row,
    name: useCatalogSeedName ? seedGame.name : row.name,
    difficulty: useCatalogSeedTiming ? seedGame.difficulty : row.difficulty,
    time: useCatalogSeedTiming ? seedGame.time : row.time,
    time_min_hours: useCatalogSeedTiming ? seedGame.time_min_hours : row.time_min_hours,
    time_max_hours: useCatalogSeedTiming ? seedGame.time_max_hours : row.time_max_hours,
    time_sort_hours: useCatalogSeedTiming ? seedGame.time_sort_hours : row.time_sort_hours,
    missable: seedGame?.missable || row.missable,
    trophy_count: Array.isArray(seedGame?.trophies) ? seedGame.trophies.length : Number(row.trophy_count || 0),
    roadmap_count: Array.isArray(seedGame?.roadmap) ? seedGame.roadmap.length : Number(row.roadmap_count || 0),
    missable_count: missableCount,
    missableCount,
    hasMissables: usesCatalogSeedMissableFlags ? Boolean(listSeedGame?.hasMissables) : Boolean(missableCount),
    onlineRequired: usesCatalogSeedFlags ? Boolean(listSeedGame?.onlineRequired) : (normalizedOnlineRequired ?? row.onlineRequired),
    coopRequired: usesCatalogSeedFlags ? Boolean(listSeedGame?.coopRequired) : (normalizedCoopRequired ?? row.coopRequired),
    coopRequirementLabel: firstText(listSeedGame?.coopRequirementLabel, listSeedGame?.coop_requirement_label, listSeedGame?.duoModeRequirementLabel, listSeedGame?.duo_mode_requirement_label, row.coopRequirementLabel, row.coop_requirement_label),
    dlcRequired: usesCatalogSeedFlags ? Boolean(listSeedGame?.dlcRequired) : (normalizedDlcRequired ?? row.dlcRequired),
    newGamePlusRequired: normalizedNewGamePlusRequired ?? row.newGamePlusRequired,
    difficultyTrophiesRequired: normalizedDifficultyTrophiesRequired ?? row.difficultyTrophiesRequired,
    spoiler_count: spoilerCount,
    attention_count: canonicalMissableCount ? missableCount + spoilerCount : Number(row.attention_count || 0),
    editorial_status: normalizeEditorialStatus(editorialSource.editorial_status),
    publication_status: normalizeEditorialStatus(editorialSource.editorial_status),
    ...buildEditorialReviewFields(editorialSource),
    coverage_level: normalizeCoverageLevel(editorialSource.coverage_level, editorialSource),
    is_verified: Boolean(editorialSource.is_verified),
    verification_note: editorialSource.verification_note || '',
    verification_status: normalizeVerificationStatus(editorialSource.verification_status, editorialSource),
    cover_image: row.cover_image || null,
    catalogImage: CATALOG_IMAGE_BY_SLUG[normalizedSlug] || '',
    runs_summary: firstText(seedGame?.runs_summary, row.runs_summary, row.guide_runs),
    missable_summary: firstText(seedGame?.missable_summary, row.missable_summary, row.missable),
    online_summary: firstText(seedGame?.online_summary, row.online_summary, row.guide_online),
    grind_summary: firstText(seedGame?.grind_summary, row.grind_summary, row.guide_grind),
    dlc_scope: firstText(seedGame?.dlc_scope, row.dlc_scope, row.guide_dlc),
    difficulty_reason: seedGame?.difficulty_reason || row.difficulty_reason || '',
    time_reason: seedGame?.time_reason || row.time_reason || '',
    first_run_advice: seedGame?.first_run_advice || row.first_run_advice || '',
    cleanup_advice: seedGame ? normalizeGuideCleanupAdvice(seedGame) : normalizeGuideCleanupAdvice(row),
    before_you_start: seedGame?.before_you_start || row.before_you_start || '',
    best_for: firstText(seedGame?.best_for, row.best_for, row.guide_ideal),
    avoid_if: firstText(seedGame?.avoid_if, row.avoid_if, row.guide_avoid),
    runs: firstText(seedGame?.runs_summary, row.runs_summary, row.guide_runs),
    online: firstText(seedGame?.online_summary, row.online_summary, row.guide_online),
    grind: firstText(seedGame?.grind_summary, row.grind_summary, row.guide_grind),
    dlc: firstText(seedGame?.dlc_scope, row.dlc_scope, row.guide_dlc),
    ideal_for: firstText(seedGame?.best_for, row.best_for, row.guide_ideal),
    avoid_for: firstText(seedGame?.avoid_if, row.avoid_if, row.guide_avoid),
    best_for_when: seedGame?.guide_best_moment || row.guide_best_moment || '',
    slug: getCanonicalGameSlug(row.slug || row.name),
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
  const rawBase = slugifyGameName(baseName) || 'jogo';
  const normalizedBase = getCanonicalGameSlug(baseName) || 'jogo';
  const isKnownAlias = rawBase !== normalizedBase;
  let sequence = 0;

  while (sequence < 1000) {
    const candidate = buildSlugVariant(normalizedBase, sequence);
    const existing = excludeGameId
      ? await get('SELECT id FROM games WHERE slug = ? AND id != ?', [candidate, excludeGameId])
      : await get('SELECT id FROM games WHERE slug = ?', [candidate]);

    if (existing && isKnownAlias && candidate === normalizedBase) {
      throw new AppError('Ja existe um jogo com esse nome.', 409, null, 'GAME_NAME_CONFLICT');
    }

    if (!existing) {
      return candidate;
    }

    sequence += 1;
  }

  throw new AppError('Não foi possível gerar um slug único para o jogo.', 500, null, 'SLUG_GENERATION_FAILED');
}

async function ensureNoCanonicalSlugConflict(baseName, excludeGameId = null) {
  const canonicalSlug = getCanonicalGameSlug(baseName);
  if (!canonicalSlug) return;

  const existing = excludeGameId
    ? await get('SELECT id FROM games WHERE slug = ? AND id != ?', [canonicalSlug, excludeGameId])
    : await get('SELECT id FROM games WHERE slug = ?', [canonicalSlug]);

  if (existing) {
    throw new AppError('Ja existe um jogo com esse nome.', 409, null, 'GAME_NAME_CONFLICT');
  }
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
    'SELECT id, name, slug, difficulty, time, time_min_hours, time_max_hours, time_sort_hours, time_bucket, missable, guide_runs, guide_online, guide_grind, guide_dlc, guide_ideal, guide_avoid, guide_best_moment, runs_summary, missable_summary, online_summary, grind_summary, dlc_scope, difficulty_reason, time_reason, first_run_advice, cleanup_advice, before_you_start, best_for, avoid_if, verification_status, editorial_status, coverage_level, is_verified, verification_note, editorial_review_status, last_reviewed_at, editorial_notes, quality_warnings, reviewed_by, walkthrough, image, cover_image, created_at, updated_at FROM games WHERE id = ?',
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
  const requestedSlug = slugifyGameName(slug);
  const normalizedSlug = getCanonicalGameSlug(slug);
  const directRow = await get('SELECT id, slug FROM games WHERE slug = ?', [normalizedSlug]);

  if (directRow) {
    const game = await getGameById(directRow.id, options);
    return {
      ...game,
      requested_slug: requestedSlug,
      canonical_slug: game.slug,
      redirect_required: requestedSlug !== game.slug
    };
  }

  const redirectRow = await get(
    'SELECT g.id, g.slug FROM game_slug_redirects r JOIN games g ON g.id = r.game_id WHERE r.slug = ?',
    [requestedSlug]
  );

  if (!redirectRow) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  const game = await getGameById(redirectRow.id, options);
  return {
    ...game,
    requested_slug: requestedSlug,
    canonical_slug: game.slug,
    redirect_required: redirectRow.slug !== requestedSlug
  };
}

async function insertRoadmapData(gameId, roadmap = []) {
  const normalizedRoadmap = normalizeRoadmapForPersistence(roadmap);
  for (let index = 0; index < normalizedRoadmap.length; index += 1) {
    await run(
      'INSERT INTO roadmaps (game_id, step_order, content) VALUES (?, ?, ?)',
      [gameId, index + 1, serializeRoadmapStep(normalizedRoadmap[index], index, normalizedRoadmap.length).trim()]
    );
  }
}

async function insertTrophyData(gameId, trophies = []) {
  for (const trophy of trophies) {
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

async function insertGameData(gameId, payload) {
  await insertRoadmapData(gameId, payload.roadmap);
  await insertTrophyData(gameId, payload.trophies);
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
    walkthrough: serializeWalkthrough(payload.walkthrough),
    legacyRuns: runsSummary,
    legacyOnline: onlineSummary,
    legacyGrind: grindSummary,
    legacyDlc: dlcScope,
    legacyIdeal: bestFor,
    legacyAvoid: avoidIf,
    legacyBestMoment: firstText(payload.best_for_when, payload.first_run_advice)
  };
}

function buildEffectiveUpdatePayload(existing = {}, payload = {}) {
  const pick = (fields, incomingValue, existingValue) => (
    hasAnyPayloadField(payload, fields) ? incomingValue : existingValue
  );
  const runsSummary = pick(['runs_summary', 'runs', 'guide_runs'], payload.runs_summary, firstText(existing.runs_summary, existing.guide_runs));
  const missableSummary = pick(['missable_summary', 'missable'], payload.missable_summary, firstText(existing.missable_summary, existing.missable));
  const onlineSummary = pick(['online_summary', 'online', 'guide_online'], payload.online_summary, firstText(existing.online_summary, existing.guide_online));
  const grindSummary = pick(['grind_summary', 'grind', 'guide_grind'], payload.grind_summary, firstText(existing.grind_summary, existing.guide_grind));
  const dlcScope = pick(['dlc_scope', 'dlc', 'guide_dlc'], payload.dlc_scope, firstText(existing.dlc_scope, existing.guide_dlc));
  const bestFor = pick(['best_for', 'ideal_for', 'guide_ideal'], payload.best_for, firstText(existing.best_for, existing.guide_ideal));
  const avoidIf = pick(['avoid_if', 'avoid_for', 'guide_avoid'], payload.avoid_if, firstText(existing.avoid_if, existing.guide_avoid));
  const firstRunAdvice = pick(['first_run_advice', 'best_for_when', 'guide_best_moment'], payload.first_run_advice, firstText(existing.first_run_advice, existing.guide_best_moment));
  const protectsVerifiedBaseGuide = String(existing.slug || '').trim().toLowerCase() === 'elden-ring'
    && (existing.is_verified || existing.verification_status === 'verified' || existing.editorial_review_status === 'verified')
    && payload.is_verified !== false;
  const verificationStatus = protectsVerifiedBaseGuide
    ? 'verified'
    : pick(['verification_status', 'is_verified'], payload.verification_status, existing.verification_status || (existing.is_verified ? 'verified' : 'unverified'));
  const editorialReviewStatus = protectsVerifiedBaseGuide
    ? 'verified'
    : pick(['editorial_review_status', 'editorialReviewStatus', 'editorialStatus'], payload.editorial_review_status, existing.editorial_review_status || '');

  return {
    ...payload,
    name: pick(['name'], payload.name, existing.name),
    difficulty: pick(['difficulty'], payload.difficulty, Number(existing.difficulty)),
    time: pick(['time'], payload.time, existing.time),
    missable: missableSummary,
    runs: runsSummary,
    online: onlineSummary,
    grind: grindSummary,
    dlc: dlcScope,
    ideal_for: bestFor,
    avoid_for: avoidIf,
    best_for_when: pick(['best_for_when', 'first_run_advice', 'guide_best_moment'], payload.best_for_when, firstText(existing.guide_best_moment, firstRunAdvice)),
    runs_summary: runsSummary,
    missable_summary: missableSummary,
    online_summary: onlineSummary,
    grind_summary: grindSummary,
    dlc_scope: dlcScope,
    difficulty_reason: pick(['difficulty_reason'], payload.difficulty_reason, existing.difficulty_reason || ''),
    time_reason: pick(['time_reason'], payload.time_reason, existing.time_reason || ''),
    first_run_advice: firstRunAdvice,
    cleanup_advice: pick(['cleanup_advice'], payload.cleanup_advice, existing.cleanup_advice || ''),
    before_you_start: pick(['before_you_start'], payload.before_you_start, existing.before_you_start || ''),
    best_for: bestFor,
    avoid_if: avoidIf,
    verification_status: verificationStatus,
    editorial_status: pick(['editorial_status'], payload.editorial_status, existing.editorial_status || 'published'),
    editorial_review_status: editorialReviewStatus,
    last_reviewed_at: pick(['last_reviewed_at', 'lastReviewedAt'], payload.last_reviewed_at, existing.last_reviewed_at || ''),
    editorial_notes: pick(['editorial_notes', 'editorialNotes'], payload.editorial_notes, existing.editorial_notes || ''),
    quality_warnings: pick(['quality_warnings', 'qualityWarnings'], payload.quality_warnings, existing.quality_warnings || ''),
    reviewed_by: pick(['reviewed_by', 'reviewedBy'], payload.reviewed_by, existing.reviewed_by || ''),
    coverage_level: pick(['coverage_level'], payload.coverage_level, existing.coverage_level || ''),
    is_verified: protectsVerifiedBaseGuide
      ? true
      : hasAnyPayloadField(payload, ['is_verified', 'verification_status', 'editorial_review_status', 'editorialReviewStatus', 'editorialStatus'])
      ? payload.is_verified
      : Boolean(existing.is_verified),
    verification_note: pick(['verification_note'], payload.verification_note, existing.verification_note || ''),
    image: pick(['image'], payload.image, existing.image || null),
    cover_image: pick(['cover_image'], payload.cover_image, existing.cover_image || null),
    walkthrough: pick(['walkthrough'], payload.walkthrough, deserializeWalkthrough(existing.walkthrough))
  };
}

async function createGame(payload) {
  const duplicate = await get('SELECT id FROM games WHERE lower(name) = lower(?)', [payload.name]);
  if (duplicate) {
    throw new AppError('Já existe um jogo com esse nome.', 409, null, 'GAME_NAME_CONFLICT');
  }

  await ensureNoCanonicalSlugConflict(payload.name);
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
      'INSERT INTO games (name, slug, difficulty, time, time_min_hours, time_max_hours, time_sort_hours, time_bucket, missable, guide_runs, guide_online, guide_grind, guide_dlc, guide_ideal, guide_avoid, guide_best_moment, runs_summary, missable_summary, online_summary, grind_summary, dlc_scope, difficulty_reason, time_reason, first_run_advice, cleanup_advice, before_you_start, best_for, avoid_if, verification_status, editorial_status, coverage_level, is_verified, verification_note, editorial_review_status, last_reviewed_at, editorial_notes, quality_warnings, reviewed_by, walkthrough, image, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [payload.name.trim(), slug, payload.difficulty, payload.time.trim(), timeMeta.time_min_hours, timeMeta.time_max_hours, timeMeta.time_sort_hours, timeMeta.time_bucket, payload.missable.trim(), editorial.legacyRuns, editorial.legacyOnline, editorial.legacyGrind, editorial.legacyDlc, editorial.legacyIdeal, editorial.legacyAvoid, editorial.legacyBestMoment, editorial.runsSummary, editorial.missableSummary, editorial.onlineSummary, editorial.grindSummary, editorial.dlcScope, editorial.difficultyReason, editorial.timeReason, editorial.firstRunAdvice, editorial.cleanupAdvice, editorial.beforeYouStart, editorial.bestFor, editorial.avoidIf, editorial.verificationStatus, editorialStatus, coverageLevel, isVerified, verificationNote, editorial.editorialReviewStatus, editorial.lastReviewedAt, editorial.editorialNotes, editorial.qualityWarnings, editorial.reviewedBy, editorial.walkthrough, payload.image?.trim() || null, payload.cover_image?.trim() || null]
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

  const effectivePayload = buildEffectiveUpdatePayload(existing, payload);

  const duplicate = await get(
    'SELECT id FROM games WHERE lower(name) = lower(?) AND id != ?',
    [effectivePayload.name, id]
  );

  if (duplicate) {
    throw new AppError('Já existe outro jogo com esse nome.', 409, null, 'GAME_NAME_CONFLICT');
  }

  await ensureNoCanonicalSlugConflict(effectivePayload.name, id);
  const slug = await reserveUniqueSlug(effectivePayload.name, id);
  const timeMeta = hasPayloadField(payload, 'time')
    ? formatTimeMetadata(effectivePayload.time)
    : {
        time_min_hours: existing.time_min_hours,
        time_max_hours: existing.time_max_hours,
        time_sort_hours: existing.time_sort_hours,
        time_bucket: existing.time_bucket
      };
  const editorialStatus = normalizeEditorialStatus(effectivePayload.editorial_status);
  const verificationNote = effectivePayload.verification_note || '';
  const editorial = buildEditorialPersistence(effectivePayload);
  const isVerified = editorial.verificationStatus === 'verified' ? 1 : 0;
  const coverageLevel = normalizeCoverageLevel(effectivePayload.coverage_level, {
    ...effectivePayload,
    verification_status: editorial.verificationStatus,
    is_verified: isVerified
  });

  await exec('BEGIN TRANSACTION');

  try {
    const shouldReplaceTrophies = Array.isArray(payload.trophies);
    const shouldConsiderRoadmap = hasPayloadField(payload, 'roadmap') && payload.roadmap !== undefined;
    const shouldReplaceRoadmap = payload.clearRoadmap === true || (shouldConsiderRoadmap && guideModel.isValidRoadmap(payload.roadmap));
    const normalizedIncomingRoadmap = shouldConsiderRoadmap && guideModel.isValidRoadmap(payload.roadmap)
      ? normalizeRoadmapForPersistence(payload.roadmap)
      : [];

    if (shouldConsiderRoadmap && !shouldReplaceRoadmap) {
      warnInvalidAdminRoadmap();
    }

    let persistedTrophies = [];
    if (shouldReplaceTrophies) {
      const existingTrophyTranslations = await all(
        'SELECT trophy_code, name_pt FROM trophies WHERE game_id = ?',
        [id]
      );
      const existingNamePtByCode = new Map(existingTrophyTranslations
        .filter(trophy => trophy.name_pt)
        .map(trophy => [trophy.trophy_code, trophy.name_pt]));
      persistedTrophies = payload.trophies.map(trophy => ({
        ...trophy,
        name_pt: trophy.name_pt || existingNamePtByCode.get(trophy.id) || ''
      }));
    }

    if (existing.slug && existing.slug !== slug) {
      await run('INSERT OR IGNORE INTO game_slug_redirects (game_id, slug) VALUES (?, ?)', [id, existing.slug]);
      await run('DELETE FROM game_slug_redirects WHERE game_id = ? AND slug = ?', [id, slug]);
    }

    await run(
      'UPDATE games SET name = ?, slug = ?, difficulty = ?, time = ?, time_min_hours = ?, time_max_hours = ?, time_sort_hours = ?, time_bucket = ?, missable = ?, guide_runs = ?, guide_online = ?, guide_grind = ?, guide_dlc = ?, guide_ideal = ?, guide_avoid = ?, guide_best_moment = ?, runs_summary = ?, missable_summary = ?, online_summary = ?, grind_summary = ?, dlc_scope = ?, difficulty_reason = ?, time_reason = ?, first_run_advice = ?, cleanup_advice = ?, before_you_start = ?, best_for = ?, avoid_if = ?, verification_status = ?, editorial_status = ?, coverage_level = ?, is_verified = ?, verification_note = ?, editorial_review_status = ?, last_reviewed_at = ?, editorial_notes = ?, quality_warnings = ?, reviewed_by = ?, walkthrough = ?, image = ?, cover_image = ? WHERE id = ?',
      [effectivePayload.name.trim(), slug, effectivePayload.difficulty, effectivePayload.time.trim(), timeMeta.time_min_hours, timeMeta.time_max_hours, timeMeta.time_sort_hours, timeMeta.time_bucket, effectivePayload.missable.trim(), editorial.legacyRuns, editorial.legacyOnline, editorial.legacyGrind, editorial.legacyDlc, editorial.legacyIdeal, editorial.legacyAvoid, editorial.legacyBestMoment, editorial.runsSummary, editorial.missableSummary, editorial.onlineSummary, editorial.grindSummary, editorial.dlcScope, editorial.difficultyReason, editorial.timeReason, editorial.firstRunAdvice, editorial.cleanupAdvice, editorial.beforeYouStart, editorial.bestFor, editorial.avoidIf, editorial.verificationStatus, editorialStatus, coverageLevel, isVerified, verificationNote, editorial.editorialReviewStatus, editorial.lastReviewedAt, editorial.editorialNotes, editorial.qualityWarnings, editorial.reviewedBy, editorial.walkthrough, effectivePayload.image?.trim() || null, effectivePayload.cover_image?.trim() || null, id]
    );

    if (shouldReplaceRoadmap) {
      await run('DELETE FROM roadmaps WHERE game_id = ?', [id]);
      await insertRoadmapData(id, normalizedIncomingRoadmap);
    }

    if (shouldReplaceTrophies) {
      await run('DELETE FROM trophies WHERE game_id = ?', [id]);
      await insertTrophyData(id, persistedTrophies);
    }

    await exec('COMMIT');
  } catch (error) {
    await exec('ROLLBACK').catch(() => {});
    await Promise.all([
      effectivePayload.image && effectivePayload.image !== existing.image ? removeManagedUploadIfUnused(effectivePayload.image, id) : Promise.resolve(),
      effectivePayload.cover_image && effectivePayload.cover_image !== existing.cover_image ? removeManagedUploadIfUnused(effectivePayload.cover_image, id) : Promise.resolve()
    ]);
    throw error;
  }

  await Promise.all([
    existing.image && existing.image !== effectivePayload.image ? removeManagedUploadIfUnused(existing.image, id) : Promise.resolve(),
    existing.cover_image && existing.cover_image !== effectivePayload.cover_image ? removeManagedUploadIfUnused(existing.cover_image, id) : Promise.resolve()
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
  duplicateGame,
  getWeeklyHomeHighlights,
  getWeeklyHomeUpdatePopup
};
