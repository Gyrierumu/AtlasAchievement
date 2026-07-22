const { all, run, get } = require('../db/db');
const sampleGames = require('../data/sampleGames');
const env = require('../config/env');
const re5ProductionContract = require('../../public/js/re5-production');

const RE5_EVENT_TYPES = new Set(Object.keys(re5ProductionContract.EVENT_PROPERTIES));

const PUBLIC_EVENT_TYPES = new Set([
  'guide_view',
  'catalog_search',
  'catalog_filter_used',
  'game_card_click',
  'checklist_toggle',
  'feedback_submit',
  'guide_tab_change',
  'seo_page_view',
  ...RE5_EVENT_TYPES
]);

const SEO_PAGE_TYPES = new Map([
  ['/privacidade', 'privacy_policy'],
  ['/comece-aqui', 'start_here'],
  ['/platinas-faceis', 'easy_platinums'],
  ['/platinas-curtas', 'short_platinums'],
  ['/platinas-sem-online', 'no_online'],
  ['/platinas-sem-perdiveis', 'no_missables'],
  ['/platinas-para-iniciantes', 'beginner_platinums']
]);

const PENDING_EDITORIAL_STATUSES = [
  'needs_missables_check',
  'needs_online_check',
  'dlc_pending',
  'outdated'
];

const SEED_VERIFIED_GUIDE_SLUGS = Array.from(new Set(sampleGames
  .filter(game => game?.is_verified || game?.verification_status === 'verified' || game?.editorial_review_status === 'verified')
  .map(game => normalizeSlug(game?.slug || game?.name))
  .filter(Boolean)));

function compactText(value = '', maxLength = 160) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeSlug(value = '') {
  return compactText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePagePath(value = '') {
  const raw = compactText(value || '/', 180);
  if (!raw) return '/';
  try {
    const url = new URL(raw, 'https://atlasachievement.com.br');
    return url.pathname || '/';
  } catch (_error) {
    const path = raw.split('?')[0].split('#')[0] || '/';
    return path.startsWith('/') ? path : `/${path}`;
  }
}

function looksSensitiveSearchTerm(value = '') {
  const text = String(value || '').trim();
  return /@/.test(text)
    || /https?:\/\//i.test(text)
    || /\b\d{3,}[-.\s]?\d{3,}[-.\s]?\d{2,}\b/.test(text);
}

function sanitizeMetadata(eventType, metadata = {}) {
  const source = metadata && typeof metadata === 'object' ? metadata : {};
  const allowed = {};

  const setText = (key, maxLength = 160) => {
    const value = compactText(source[key], maxLength);
    if (value) allowed[key] = value;
  };
  const setNumber = key => {
    const value = Number(source[key]);
    if (Number.isFinite(value)) allowed[key] = value;
  };
  const setBoolean = key => {
    if (typeof source[key] === 'boolean') allowed[key] = source[key];
  };

  if (eventType === 'catalog_search') {
    const term = compactText(source.search_term, 100);
    if (term && !looksSensitiveSearchTerm(term)) allowed.search_term = term;
    setNumber('results_count');
    setBoolean('has_results');
  }

  if (eventType === 'catalog_filter_used') {
    setText('filter_name', 80);
    setText('filter_value', 80);
    setNumber('results_count');
  }

  if (['guide_view', 'game_card_click'].includes(eventType)) {
    setText('game_title', 160);
    setText(eventType === 'guide_view' ? 'source' : 'origin', 40);
  }

  if (eventType === 'checklist_toggle') {
    setText('trophy_id', 120);
    setText('trophy_name', 160);
    setText('action', 20);
  }

  if (eventType === 'feedback_submit') {
    setText('feedback_type', 80);
    setText('page_context', 160);
  }

  if (eventType === 'guide_tab_change') {
    setText('tab_name', 80);
  }

  if (eventType === 'seo_page_view') {
    setText('page_type', 80);
    setText('page_path', 160);
    setText('page_title', 160);
  }

  return allowed;
}

function parseMetadata(value = '') {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

async function createPublicEvent(payload = {}) {
  const eventType = compactText(payload.eventType || payload.event_name || payload.eventName, 60);
  if (!PUBLIC_EVENT_TYPES.has(eventType)) {
    return { stored: false };
  }

  const page = normalizePagePath(payload.page || payload.page_path || payload.pagePath || '/');
  const gameSlug = normalizeSlug(payload.gameSlug || payload.game_slug || '');
  const isResidentEvil5Event = gameSlug === 'resident-evil-5' || page === '/jogo/resident-evil-5';
  if (isResidentEvil5Event) {
    if (!RE5_EVENT_TYPES.has(eventType) || env.re5ProductAnalyticsEnabled !== true) return { stored: false };
    if (gameSlug !== 'resident-evil-5' || page !== '/jogo/resident-evil-5') return { stored: false };
  } else if (RE5_EVENT_TYPES.has(eventType) && eventType !== 'guide_view') {
    return { stored: false };
  }
  const metadata = isResidentEvil5Event
    ? (re5ProductionContract.normalizeProperties(eventType, payload.metadata || {}) || {})
    : sanitizeMetadata(eventType, payload.metadata || {});

  if (eventType === 'catalog_search' && !metadata.search_term) {
    return { stored: false };
  }

  await run(
    `INSERT INTO analytics_events (event_type, page, game_slug, metadata_json)
     VALUES (?, ?, ?, ?)`,
    [eventType, page, gameSlug || null, JSON.stringify(metadata)]
  );

  return { stored: true };
}

function increment(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function topFromMap(map, limit = 8, mapper = (key, count) => ({ key, count })) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'))
    .slice(0, limit)
    .map(([key, count]) => mapper(key, count));
}

function aggregateEventMetrics(events = []) {
  const searchTerms = new Map();
  const noResultSearchTerms = new Map();
  const seoPages = new Map();
  const checklistByGame = new Map();
  const trophies = new Map();
  let checklistToggleTotal = 0;
  let checklistCheckedTotal = 0;
  let checklistUncheckedTotal = 0;

  events.forEach(event => {
    const metadata = parseMetadata(event.metadata_json);
    if (event.event_type === 'catalog_search') {
      const term = compactText(metadata.search_term, 100);
      if (term) {
        increment(searchTerms, term);
        if (metadata.has_results === false || Number(metadata.results_count || 0) === 0) {
          increment(noResultSearchTerms, term);
        }
      }
    }

    if (event.event_type === 'seo_page_view') {
      const pagePath = normalizePagePath(metadata.page_path || event.page);
      increment(seoPages, pagePath);
    }

    if (event.event_type === 'checklist_toggle') {
      checklistToggleTotal += 1;
      if (metadata.action === 'unchecked') checklistUncheckedTotal += 1;
      else checklistCheckedTotal += 1;
      increment(checklistByGame, event.game_slug || '');
      const trophyKey = compactText(metadata.trophy_id || metadata.trophy_name, 160);
      if (trophyKey) increment(trophies, trophyKey);
    }
  });

  return {
    search: {
      topTerms: topFromMap(searchTerms, 10, (term, count) => ({ term, count })),
      noResultTerms: topFromMap(noResultSearchTerms, 10, (term, count) => ({ term, count }))
    },
    seo: {
      topPages: topFromMap(seoPages, 8, (pagePath, count) => ({
        pagePath,
        pageType: SEO_PAGE_TYPES.get(pagePath) || 'seo_page',
        count
      }))
    },
    checklist: {
      totalToggles: checklistToggleTotal,
      checked: checklistCheckedTotal,
      unchecked: checklistUncheckedTotal,
      topGames: topFromMap(checklistByGame, 10, (gameSlug, count) => ({ gameSlug, count })),
      topTrophies: topFromMap(trophies, 10, (trophy, count) => ({ trophy, count }))
    }
  };
}

function residentEvil5Rate(count, guideViews) {
  if (!guideViews) return null;
  return Number(((count / guideViews) * 100).toFixed(1));
}

function percentile75(values = []) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.75) - 1)];
}

function aggregateResidentEvil5Metrics(events = []) {
  const re5Events = events.filter(event => (
    event.game_slug === 'resident-evil-5'
    && normalizePagePath(event.page) === '/jogo/resident-evil-5'
    && RE5_EVENT_TYPES.has(event.event_type)
  ));
  const eventCounts = new Map();
  const tabCounts = new Map();
  const dlcCounts = new Map();
  const vitalGroups = new Map();
  let returningViews = 0;

  re5Events.forEach(event => {
    const metadata = parseMetadata(event.metadata_json);
    increment(eventCounts, event.event_type);
    if (event.event_type === 'guide_view' && metadata.visit_type === 'returning') returningViews += 1;
    if (event.event_type === 'guide_tab_open') increment(tabCounts, compactText(metadata.tab, 24));
    if (event.event_type === 'dlc_package_open') increment(dlcCounts, compactText(metadata.package, 40));

    if (event.event_type === 'guide_web_vital') {
      const metric = compactText(metadata.metric, 8);
      const deviceClass = compactText(metadata.device_class, 16);
      const adState = compactText(metadata.ad_state, 16);
      const rawValue = metric === 'CLS' ? metadata.value : metadata.value_ms;
      const value = Number(rawValue);
      if (!['LCP', 'INP', 'CLS', 'TTFB', 'FCP'].includes(metric)
        || !['mobile', 'desktop'].includes(deviceClass)
        || !['none', 'reserved', 'loaded'].includes(adState)
        || !Number.isFinite(value)
        || value < 0) return;

      const key = `${metric}|${deviceClass}|${adState}`;
      if (!vitalGroups.has(key)) {
        vitalGroups.set(key, { metric, deviceClass, adState, values: [], dates: [] });
      }
      const group = vitalGroups.get(key);
      group.values.push(value);
      const date = new Date(event.created_at);
      if (Number.isFinite(date.getTime())) group.dates.push(date);
    }
  });

  const count = eventType => eventCounts.get(eventType) || 0;
  const guideViews = count('guide_view');
  const roadmapOrChecklist = count('roadmap_start') + count('checklist_open');
  const firstUsefulInteraction = count('checklist_first_toggle')
    + count('guide_internal_search')
    + count('guide_filter_change')
    + count('next_action_open');
  const progressMilestones = count('checklist_progress_milestone');
  const fieldVitals = Array.from(vitalGroups.values()).map(group => {
    const distinctDays = new Set(group.dates.map(date => date.toISOString().slice(0, 10))).size;
    const timestamps = group.dates.map(date => date.getTime());
    const spanDays = timestamps.length
      ? ((Math.max(...timestamps) - Math.min(...timestamps)) / 86400000) + 1
      : 0;
    const sufficient = group.values.length >= 200 && distinctDays >= 3 && spanDays >= 7;
    return {
      metric: group.metric,
      deviceClass: group.deviceClass,
      adState: group.adState,
      samples: group.values.length,
      distinctDays,
      collectionSpanDays: Number(spanDays.toFixed(1)),
      status: sufficient ? 'ready' : 'dados insuficientes',
      p75: sufficient ? percentile75(group.values) : null
    };
  }).sort((a, b) => `${a.metric}|${a.deviceClass}|${a.adState}`.localeCompare(`${b.metric}|${b.deviceClass}|${b.adState}`));
  const readyVitalMetrics = new Set(fieldVitals.filter(item => item.status === 'ready').map(item => item.metric));
  const allRequiredVitalsReady = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'].every(metric => readyVitalMetrics.has(metric))
    && fieldVitals.every(item => item.status === 'ready');

  return {
    windowDays: 90,
    totalEvents: re5Events.length,
    eventCounts: Object.fromEntries(Array.from(eventCounts.entries()).sort()),
    funnel: {
      guideViews,
      roadmapOrChecklist: { count: roadmapOrChecklist, ratePercent: residentEvil5Rate(roadmapOrChecklist, guideViews) },
      firstUsefulInteraction: { count: firstUsefulInteraction, ratePercent: residentEvil5Rate(firstUsefulInteraction, guideViews) },
      progressMilestones: { count: progressMilestones, ratePercent: residentEvil5Rate(progressMilestones, guideViews) },
      returningViews: { count: returningViews, ratePercent: residentEvil5Rate(returningViews, guideViews) }
    },
    tabs: Object.fromEntries(Array.from(tabCounts.entries()).sort()),
    dlcPackages: Object.fromEntries(Array.from(dlcCounts.entries()).sort()),
    searches: count('guide_internal_search'),
    filters: count('guide_filter_change'),
    sourceLinks: count('source_link_open'),
    videoLinks: count('video_link_open'),
    instructionalVisuals: count('instructional_visual_view'),
    problemReportsOpened: count('report_problem_open'),
    fieldVitals: {
      minimum: { samplesPerMetricSegment: 200, collectionDays: 7, distinctDays: 3 },
      status: allRequiredVitalsReady ? 'ready' : 'dados insuficientes',
      segments: fieldVitals
    }
  };
}

async function getFeedbackMetrics() {
  const [
    totalRow,
    newRow,
    statusRows,
    typeRows,
    topGameRows,
    recentRows
  ] = await Promise.all([
    get('SELECT COUNT(*) AS total FROM feedbacks'),
    get("SELECT COUNT(*) AS total FROM feedbacks WHERE status = 'new'"),
    all('SELECT status, COUNT(*) AS total FROM feedbacks GROUP BY status ORDER BY total DESC'),
    all('SELECT type, COUNT(*) AS total FROM feedbacks GROUP BY type ORDER BY total DESC, type ASC'),
    all(`SELECT COALESCE(NULLIF(TRIM(related_game), ''), 'Sem jogo relacionado') AS related_game, COUNT(*) AS total
           FROM feedbacks
          GROUP BY COALESCE(NULLIF(TRIM(related_game), ''), 'Sem jogo relacionado')
          ORDER BY total DESC, related_game ASC
          LIMIT 10`),
    all(`SELECT id, type, related_game, page_url, status, created_at
           FROM feedbacks
          ORDER BY datetime(created_at) DESC, id DESC
          LIMIT 8`)
  ]);

  return {
    total: Number(totalRow?.total || 0),
    new: Number(newRow?.total || 0),
    byStatus: statusRows.map(item => ({ status: item.status || 'new', count: Number(item.total || 0) })),
    byType: typeRows.map(item => ({ type: item.type || 'Feedback', count: Number(item.total || 0) })),
    topGames: topGameRows.map(item => ({ game: item.related_game, count: Number(item.total || 0) })),
    recent: recentRows.map(item => ({
      id: item.id,
      type: item.type,
      relatedGame: item.related_game || '',
      pagePath: normalizePagePath(item.page_url || ''),
      status: item.status,
      createdAt: item.created_at
    }))
  };
}

async function getGuideMetrics() {
  const seedVerifiedPlaceholders = SEED_VERIFIED_GUIDE_SLUGS.map(() => '?').join(',');
  const seedVerifiedSql = seedVerifiedPlaceholders ? ` OR slug IN (${seedVerifiedPlaceholders})` : '';
  const excludeSeedVerifiedSql = seedVerifiedPlaceholders ? ` AND slug NOT IN (${seedVerifiedPlaceholders})` : '';
  const [
    totalRow,
    publishedRow,
    reviewRow,
    verifiedRow,
    pendingRows,
    inReviewRows
  ] = await Promise.all([
    get('SELECT COUNT(*) AS total FROM games'),
    get("SELECT COUNT(*) AS total FROM games WHERE COALESCE(editorial_status, 'published') != 'draft'"),
    get(`SELECT COUNT(*) AS total FROM games WHERE COALESCE(editorial_review_status, 'in_review') = 'in_review'${excludeSeedVerifiedSql}`, SEED_VERIFIED_GUIDE_SLUGS),
    get(`SELECT COUNT(*) AS total FROM games WHERE editorial_review_status = 'verified' OR is_verified = 1 OR verification_status = 'verified'${seedVerifiedSql}`, SEED_VERIFIED_GUIDE_SLUGS),
    all(`SELECT name, slug, editorial_review_status, quality_warnings, last_reviewed_at
           FROM games
          WHERE editorial_review_status IN (${PENDING_EDITORIAL_STATUSES.map(() => '?').join(',')})
          ORDER BY updated_at DESC, name ASC
          LIMIT 20`, PENDING_EDITORIAL_STATUSES),
    all(`SELECT name, slug, editorial_review_status, quality_warnings, last_reviewed_at
           FROM games
          WHERE COALESCE(editorial_review_status, 'in_review') = 'in_review'${excludeSeedVerifiedSql}
          ORDER BY updated_at DESC, name ASC
          LIMIT 20`, SEED_VERIFIED_GUIDE_SLUGS)
  ]);

  return {
    totalGames: Number(totalRow?.total || 0),
    publishedGuides: Number(publishedRow?.total || 0),
    inReview: Number(reviewRow?.total || 0),
    verified: Number(verifiedRow?.total || 0),
    pendingEditorial: pendingRows.map(item => ({
      name: item.name,
      slug: item.slug,
      status: item.editorial_review_status || 'in_review',
      qualityWarnings: parseMetadata(item.quality_warnings),
      lastReviewedAt: item.last_reviewed_at || ''
    })),
    inReviewGuides: inReviewRows.map(item => ({
      name: item.name,
      slug: item.slug,
      status: item.editorial_review_status || 'in_review',
      lastReviewedAt: item.last_reviewed_at || ''
    }))
  };
}

async function getBetaMetrics() {
  const [feedback, guides, events] = await Promise.all([
    getFeedbackMetrics(),
    getGuideMetrics(),
    all(`SELECT event_type, page, game_slug, metadata_json, created_at
           FROM analytics_events
          WHERE datetime(created_at) >= datetime('now', '-90 days')
          ORDER BY datetime(created_at) DESC, id DESC
          LIMIT 5000`)
  ]);
  const eventMetrics = aggregateEventMetrics(events);

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      totalFeedbacks: feedback.total,
      newFeedbacks: feedback.new,
      totalGames: guides.totalGames,
      publishedGuides: guides.publishedGuides,
      guidesInReview: guides.inReview,
      verifiedGuides: guides.verified,
      internalEvents90d: events.length
    },
    feedback,
    guides: {
      topFeedbackGames: feedback.topGames,
      inReview: guides.inReviewGuides,
      pendingEditorial: guides.pendingEditorial
    },
    search: eventMetrics.search,
    seo: eventMetrics.seo,
    checklist: eventMetrics.checklist,
    residentEvil5: aggregateResidentEvil5Metrics(events)
  };
}

module.exports = {
  createPublicEvent,
  getBetaMetrics,
  sanitizeMetadata,
  aggregateResidentEvil5Metrics,
  PUBLIC_EVENT_TYPES: Array.from(PUBLIC_EVENT_TYPES),
  RE5_EVENT_TYPES: Array.from(RE5_EVENT_TYPES)
};
