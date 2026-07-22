(function attachResidentEvil5Production(root, factory) {
  const api = factory(root || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root) root.AtlasRe5Production = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function residentEvil5ProductionFactory(root) {
  'use strict';

  const GUIDE_PATH = '/jogo/resident-evil-5';
  const EVENT_PROPERTIES = Object.freeze({
    guide_view: ['entry_context', 'initial_tab', 'visit_type'],
    guide_tab_open: ['tab', 'interaction'],
    guide_anchor_open: ['anchor_group'],
    guide_internal_search: ['query_length_bucket', 'result_count_bucket'],
    guide_filter_change: ['filter', 'value'],
    roadmap_start: ['source'],
    roadmap_step_open: ['step_index'],
    checklist_open: ['source'],
    checklist_first_toggle: ['progress_bucket'],
    checklist_progress_milestone: ['progress_bucket'],
    next_action_open: ['target_group'],
    instructional_visual_view: ['visual_id'],
    source_link_open: ['source_group'],
    video_link_open: ['video_group'],
    guide_save: ['action'],
    guide_copy_link: ['target_group'],
    report_problem_open: ['source'],
    dlc_package_open: ['package'],
    versus_route_open: ['source'],
    score_stars_open: ['source'],
    agitators_open: ['source'],
    guide_web_vital: ['metric', 'value_ms', 'value', 'rating', 'device_class', 'connection_bucket', 'initial_tab', 'frontend_version', 'ad_state']
  });

  const ENUMS = Object.freeze({
    entry_context: ['direct', 'internal', 'organic', 'external', 'unknown'],
    initial_tab: ['summary', 'roadmap', 'checklist', 'extras', 'dlc', 'attention'],
    visit_type: ['first', 'returning', 'unknown'],
    tab: ['summary', 'roadmap', 'checklist', 'extras', 'dlc', 'attention'],
    interaction: ['click', 'keyboard', 'hash'],
    anchor_group: ['summary', 'roadmap', 'checklist', 'extras', 'dlc', 'attention', 'professional', 'bsaa', 'treasures', 'sources', 'comments', 'other'],
    query_length_bucket: ['0', '1-4', '5-10', '11-20', '21+'],
    result_count_bucket: ['0', '1-10', '11-25', '26-50', '51+'],
    filter: ['trophy_type', 'completion', 'density', 'dlc_package'],
    value: ['all', 'completed', 'pending', 'platinum', 'gold', 'silver', 'bronze', 'comfortable', 'compact', 'versus', 'lost-in-nightmares', 'desperate-escape'],
    source: ['hero', 'tab', 'anchor', 'next_action', 'utility', 'unknown'],
    progress_bucket: ['0%', '1-24%', '25-49%', '50-74%', '75-99%', '100%'],
    target_group: ['roadmap', 'checklist', 'extras', 'dlc', 'attention', 'first_pending', 'professional', 'unknown'],
    visual_id: ['bsaa-route', 'heart-of-africa', 'score-stars-route', 'agitator-triggers', 'social-overview'],
    source_group: ['official', 'trophy-list', 'walkthrough', 'community', 'methodology', 'unknown'],
    video_group: ['bsaa', 'heart-of-africa', 'score-stars', 'agitators', 'unknown'],
    action: ['saved', 'removed'],
    package: ['versus', 'lost-in-nightmares', 'desperate-escape'],
    metric: ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'],
    rating: ['good', 'needs-improvement', 'poor'],
    device_class: ['mobile', 'desktop'],
    connection_bucket: ['slow-2g', '2g', '3g', '4g', 'unknown'],
    ad_state: ['none', 'reserved', 'loaded']
  });

  const PLACEMENTS = Object.freeze({
    summary: '#guideQuickPlan',
    roadmap: '#guideRoadmapPanel',
    extras: '#extras-upgrades-take-it-to-the-max',
    dlc: '#re5-versus-dlc'
  });

  let initialized = false;
  let interactionBound = false;
  let guideViewSent = false;
  let firstChecklistToggleSent = false;
  let roadmapStarted = false;
  let searchTimer = null;
  const sentDedupe = new Set();
  const errorGroups = new Map();
  const errorTimes = [];

  function getConfig() {
    const source = root.AtlasRe5ProductionConfig || {};
    return {
      analyticsEnabled: source.analyticsEnabled === true,
      cwvEnabled: source.cwvEnabled === true,
      errorMonitoringEnabled: source.errorMonitoringEnabled === true,
      adsEnabled: source.adsEnabled === true,
      placeholderMode: source.placeholderMode === true,
      placements: {
        summary: source.placements?.summary !== false,
        roadmap: source.placements?.roadmap !== false,
        extras: source.placements?.extras !== false,
        dlc: source.placements?.dlc !== false
      },
      frontendVersion: normalizeVersion(source.frontendVersion)
    };
  }

  function normalizePath(value = '') {
    const path = String(value || GUIDE_PATH).split('?')[0].split('#')[0] || '/';
    return path.startsWith('/') ? path : `/${path}`;
  }

  function normalizeVersion(value = '') {
    return String(value || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64) || 'unknown';
  }

  function enumValue(key, value) {
    const candidate = String(value || '');
    return ENUMS[key]?.includes(candidate) ? candidate : '';
  }

  function normalizeProperties(eventName, properties = {}) {
    const allowed = EVENT_PROPERTIES[eventName];
    if (!allowed) return null;
    const clean = {};
    allowed.forEach(key => {
      const value = properties[key];
      if (key === 'step_index') {
        const number = Number(value);
        if (Number.isInteger(number) && number >= 1 && number <= 7) clean[key] = number;
        return;
      }
      if (key === 'value_ms') {
        const number = Number(value);
        if (Number.isFinite(number) && number >= 0 && number <= 120000) clean[key] = Math.round(number);
        return;
      }
      if (key === 'value') {
        if (eventName === 'guide_web_vital') {
          const number = Number(value);
          if (Number.isFinite(number) && number >= 0 && number <= 10) clean[key] = Math.round(number * 100000) / 100000;
        } else {
          const normalized = enumValue(key, value);
          if (normalized) clean[key] = normalized;
        }
        return;
      }
      if (key === 'frontend_version') {
        clean[key] = normalizeVersion(value);
        return;
      }
      const normalized = enumValue(key, value);
      if (normalized) clean[key] = normalized;
    });
    return clean;
  }

  function createEventPayload(eventName, properties = {}, page = GUIDE_PATH) {
    const metadata = normalizeProperties(eventName, properties);
    if (!metadata || normalizePath(page) !== GUIDE_PATH) return null;
    return {
      eventType: eventName,
      page: GUIDE_PATH,
      gameSlug: 'resident-evil-5',
      metadata
    };
  }

  function hasConsent(category) {
    const adapter = root.AtlasConsent;
    if (!adapter || typeof adapter.hasConsent !== 'function') return false;
    try {
      return adapter.hasConsent(category) === true;
    } catch (_error) {
      return false;
    }
  }

  function dispatchAuditEvent(payload) {
    if (typeof root.CustomEvent !== 'function' || typeof root.dispatchEvent !== 'function') return;
    root.dispatchEvent(new root.CustomEvent('atlas:re5-telemetry', { detail: payload }));
  }

  function emit(eventName, properties = {}, options = {}) {
    const config = getConfig();
    if (!config.analyticsEnabled || !hasConsent('analytics')) return false;
    if (normalizePath(root.location?.pathname) !== GUIDE_PATH) return false;
    const payload = createEventPayload(eventName, properties, GUIDE_PATH);
    if (!payload) return false;
    const dedupeKey = options.dedupeKey ? `${eventName}:${options.dedupeKey}` : '';
    if (dedupeKey && sentDedupe.has(dedupeKey)) return false;
    if (dedupeKey) sentDedupe.add(dedupeKey);

    try {
      root.fetch('/api/analytics/events', {
        method: 'POST',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
      dispatchAuditEvent(payload);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function getInitialTab() {
    const match = String(root.location?.hash || '').match(/^#guideTab-(summary|roadmap|checklist|extras|dlc|attention)$/);
    return match ? match[1] : 'summary';
  }

  function getEntryContext() {
    const referrer = String(root.document?.referrer || '');
    if (!referrer) return 'direct';
    try {
      const url = new URL(referrer);
      if (url.origin === root.location?.origin) return 'internal';
      if (/(^|\.)(google|bing|duckduckgo)\./i.test(url.hostname)) return 'organic';
      return 'external';
    } catch (_error) {
      return 'unknown';
    }
  }

  function getVisitType() {
    if (!hasConsent('analytics')) return 'unknown';
    try {
      const key = 'atlas_re5_analytics_seen_v1';
      const seen = root.localStorage?.getItem(key) === '1';
      root.localStorage?.setItem(key, '1');
      return seen ? 'returning' : 'first';
    } catch (_error) {
      return 'unknown';
    }
  }

  function queryLengthBucket(length) {
    const number = Math.max(0, Number(length) || 0);
    if (number === 0) return '0';
    if (number <= 4) return '1-4';
    if (number <= 10) return '5-10';
    if (number <= 20) return '11-20';
    return '21+';
  }

  function resultCountBucket(count) {
    const number = Math.max(0, Number(count) || 0);
    if (number === 0) return '0';
    if (number <= 10) return '1-10';
    if (number <= 25) return '11-25';
    if (number <= 50) return '26-50';
    return '51+';
  }

  function progressBucket(completed, total) {
    const safeTotal = Math.max(0, Number(total) || 0);
    const percent = safeTotal ? (Math.max(0, Number(completed) || 0) / safeTotal) * 100 : 0;
    if (percent <= 0) return '0%';
    if (percent < 25) return '1-24%';
    if (percent < 50) return '25-49%';
    if (percent < 75) return '50-74%';
    if (percent < 100) return '75-99%';
    return '100%';
  }

  function anchorGroup(hash = '') {
    const value = String(hash || '').toLowerCase();
    if (value.includes('professional')) return 'professional';
    if (value.includes('bsaa')) return 'bsaa';
    if (value.includes('treasure') || value.includes('tesouro')) return 'treasures';
    if (value.includes('fonte') || value.includes('methodology')) return 'sources';
    if (value.includes('comment')) return 'comments';
    for (const tab of ['summary', 'roadmap', 'checklist', 'extras', 'dlc', 'attention']) if (value.includes(tab)) return tab;
    return 'other';
  }

  function sourceGroup(href = '') {
    const value = String(href || '').toLowerCase();
    if (value.includes('capcom.com')) return 'official';
    if (value.includes('trophies') || value.includes('/troph')) return 'trophy-list';
    if (value.includes('gamefaqs') || value.includes('walkthrough')) return 'walkthrough';
    if (value.includes('residentevil.org') || value.includes('reddit.com') || value.includes('strategywiki') || value.includes('gamesradar')) return 'community';
    if (value) return 'methodology';
    return 'unknown';
  }

  function videoGroup(href = '') {
    const value = String(href || '');
    if (value.includes('qG94-12Nznk')) return 'bsaa';
    if (value.includes('XKfQyYb_hBY')) return 'heart-of-africa';
    if (value.includes('4KAJ6zfUNxc')) return 'score-stars';
    if (value.includes('Zxx5PkPYeuU')) return 'agitators';
    return 'unknown';
  }

  function visualId(hash = '') {
    const value = String(hash || '').toLowerCase();
    if (value.includes('bsaa')) return 'bsaa-route';
    if (value.includes('heart-of-africa')) return 'heart-of-africa';
    if (value.includes('score-star')) return 'score-stars-route';
    if (value.includes('agitator')) return 'agitator-triggers';
    return '';
  }

  function sourceFromElement(element) {
    if (element?.closest?.('.atlas-re5-hero')) return 'hero';
    if (element?.closest?.('#guideLayerNav')) return 'tab';
    if (element?.closest?.('[data-next-action], [data-guide-next-action]')) return 'next_action';
    if (element?.matches?.('a[href^="#"]') || element?.closest?.('a[href^="#"]')) return 'anchor';
    return 'utility';
  }

  function emitGuideView() {
    if (guideViewSent) return false;
    const sent = emit('guide_view', {
      entry_context: getEntryContext(),
      initial_tab: getInitialTab(),
      visit_type: getVisitType()
    }, { dedupeKey: 'page' });
    if (sent) guideViewSent = true;
    return sent;
  }

  function currentChecklistProgress() {
    const nodes = [...root.document.querySelectorAll('#trophyList [data-trophy-id]')];
    const completed = nodes.filter(node => node.classList.contains('completed') || node.querySelector('input[type="checkbox"]')?.checked).length;
    return { completed, total: nodes.length };
  }

  function handleChecklistToggle() {
    const progress = currentChecklistProgress();
    const bucket = progressBucket(progress.completed, progress.total);
    if (!firstChecklistToggleSent) {
      firstChecklistToggleSent = emit('checklist_first_toggle', { progress_bucket: bucket }, { dedupeKey: 'first' });
      if (firstChecklistToggleSent) sentDedupe.add(`checklist_progress_milestone:${bucket}`);
      return;
    }
    emit('checklist_progress_milestone', { progress_bucket: bucket }, { dedupeKey: bucket });
  }

  function handleSearch(input) {
    if (searchTimer) root.clearTimeout(searchTimer);
    searchTimer = root.setTimeout(() => {
      const visible = [...root.document.querySelectorAll('#trophyList [data-trophy-id]')]
        .filter(node => !node.hidden && node.offsetParent !== null).length;
      emit('guide_internal_search', {
        query_length_bucket: queryLengthBucket(String(input.value || '').length),
        result_count_bucket: resultCountBucket(visible)
      });
    }, 650);
  }

  function handleTab(button, event) {
    const tab = enumValue('tab', button.dataset.guideTabButton || '');
    if (!tab) return;
    const source = sourceFromElement(button);
    if (tab === 'roadmap' && !roadmapStarted) {
      roadmapStarted = emit('roadmap_start', { source }, { dedupeKey: 'start' });
      return;
    }
    if (tab === 'checklist') {
      emit('checklist_open', { source }, { dedupeKey: 'open' });
      return;
    }
    emit('guide_tab_open', { tab, interaction: event?.detail === 0 ? 'keyboard' : 'click' });
  }

  function handleAnchor(anchor) {
    const href = anchor.getAttribute('href') || '';
    if (/youtube\.com|youtu\.be/i.test(href)) {
      emit('video_link_open', { video_group: videoGroup(href) });
      return;
    }
    if (/^https?:/i.test(href)) {
      emit('source_link_open', { source_group: sourceGroup(href) });
      return;
    }
    if (!href.startsWith('#')) return;
    const source = sourceFromElement(anchor);
    if (href.includes('re5-versus-dlc')) return void emit('versus_route_open', { source });
    if (href.includes('score-stars')) return void emit('score_stars_open', { source });
    if (href.includes('agitator')) return void emit('agitators_open', { source });
    const visual = visualId(href);
    if (visual) return void emit('instructional_visual_view', { visual_id: visual });
    emit('guide_anchor_open', { anchor_group: anchorGroup(href) });
  }

  function bindInteractions() {
    if (interactionBound || !root.document) return;
    interactionBound = true;
    root.document.querySelectorAll('[data-trophy-toggle]').forEach(button => {
      button.addEventListener('click', () => root.setTimeout(handleChecklistToggle, 0));
    });
    root.document.addEventListener('input', event => {
      const input = event.target?.closest?.('#trophySearch, [data-guide-search]');
      if (input) handleSearch(input);
    });
    root.document.addEventListener('change', event => {
      const target = event.target;
      if (target?.closest?.('#trophyList') && target.matches?.('input[type="checkbox"]')) return void handleChecklistToggle();
      if (target?.matches?.('[data-trophy-filter]')) {
        const filter = target.dataset.trophyFilter === 'completion' ? 'completion' : 'trophy_type';
        emit('guide_filter_change', { filter, value: String(target.value || '').toLowerCase() });
      }
    });
    root.document.addEventListener('click', event => {
      const target = event.target;
      const tab = target?.closest?.('[data-guide-tab-button]');
      if (tab) return void handleTab(tab, event);

      const density = target?.closest?.('button[data-checklist-density]');
      if (density) return void emit('guide_filter_change', { filter: 'density', value: density.dataset.checklistDensity });

      const nextAction = target?.closest?.('[data-next-action], [data-guide-next-action], [data-re5-next-button]');
      if (nextAction) return void emit('next_action_open', { target_group: nextAction.dataset.roadmapJump ? 'roadmap' : 'unknown' });

      const roadmapStep = target?.closest?.('[data-roadmap-toggle], [data-roadmap-jump]');
      if (roadmapStep) {
        const rawStep = roadmapStep.dataset.roadmapToggle || roadmapStep.dataset.roadmapJump || '';
        const stepIndex = Number(String(rawStep).match(/(\d+)$/)?.[1] || 0);
        return void emit('roadmap_step_open', { step_index: stepIndex });
      }

      const save = target?.closest?.('[data-library-toggle], [data-guide-save]');
      if (save) return void emit('guide_save', { action: save.getAttribute('aria-pressed') === 'true' ? 'removed' : 'saved' });

      const copy = target?.closest?.('[data-copy-link], [data-guide-copy-link]');
      if (copy) return void emit('guide_copy_link', { target_group: anchorGroup(root.location?.hash) });

      const report = target?.closest?.('[data-open-feedback], [data-report-problem]');
      if (report) return void emit('report_problem_open', { source: sourceFromElement(report) });

      const anchor = target?.closest?.('a[href]');
      if (anchor) handleAnchor(anchor);
    });
  }

  function createPlaceholder(placement) {
    const node = root.document.createElement('aside');
    node.id = `re5-ad-slot-${placement}`;
    node.className = 'atlas-re5-ad-slot';
    node.dataset.re5AdSlot = placement;
    node.dataset.adState = 'reserved';
    node.setAttribute('role', 'region');
    node.setAttribute('aria-label', `Publicidade — espaço de teste ${placement}`);
    node.innerHTML = '<span class="atlas-re5-ad-slot__label">Publicidade</span><span class="atlas-re5-ad-slot__note">Placeholder de teste — nenhuma chamada de anúncio é realizada.</span>';
    return node;
  }

  function renderPlaceholders() {
    const config = getConfig();
    if (!config.placeholderMode || normalizePath(root.location?.pathname) !== GUIDE_PATH || !root.document) return 0;
    let rendered = 0;
    Object.entries(PLACEMENTS).forEach(([placement, selector]) => {
      if (!config.placements[placement] || root.document.querySelector(`[data-re5-ad-slot="${placement}"]`)) return;
      const target = root.document.querySelector(selector);
      if (!target) return;
      target.insertAdjacentElement('afterend', createPlaceholder(placement));
      rendered += 1;
    });
    return rendered;
  }

  function setAdSlotState(placement, state) {
    const slot = root.document?.querySelector?.(`[data-re5-ad-slot="${String(placement || '')}"]`);
    if (!slot) return false;
    if (state === 'no-fill' || state === 'blocked' || state === 'error') {
      slot.dataset.adState = state;
      slot.hidden = true;
      return true;
    }
    if (state === 'reserved') {
      slot.dataset.adState = state;
      slot.hidden = false;
      return true;
    }
    return false;
  }

  function deviceClass() {
    return Number(root.innerWidth || 0) < 768 ? 'mobile' : 'desktop';
  }

  function connectionBucket() {
    return enumValue('connection_bucket', root.navigator?.connection?.effectiveType) || 'unknown';
  }

  function adState() {
    if (getConfig().placeholderMode) return 'reserved';
    return 'none';
  }

  function vitalRating(metric, value) {
    if (metric === 'CLS') return value <= 0.1 ? 'good' : (value <= 0.25 ? 'needs-improvement' : 'poor');
    if (metric === 'INP') return value <= 200 ? 'good' : (value <= 500 ? 'needs-improvement' : 'poor');
    if (metric === 'LCP') return value <= 2500 ? 'good' : (value <= 4000 ? 'needs-improvement' : 'poor');
    return 'good';
  }

  function emitVital(metric, value) {
    const config = getConfig();
    const properties = {
      metric,
      rating: vitalRating(metric, value),
      device_class: deviceClass(),
      connection_bucket: connectionBucket(),
      initial_tab: getInitialTab(),
      frontend_version: config.frontendVersion,
      ad_state: adState()
    };
    if (metric === 'CLS') properties.value = value;
    else properties.value_ms = value;
    emit('guide_web_vital', properties, { dedupeKey: metric });
  }

  function observeCoreWebVitals() {
    const config = getConfig();
    if (!config.cwvEnabled || !hasConsent('analytics') || typeof root.PerformanceObserver !== 'function') return false;
    let lcp = 0;
    let cls = 0;
    let inp = 0;
    try {
      const navigation = root.performance?.getEntriesByType?.('navigation')?.[0];
      if (navigation) emitVital('TTFB', Math.max(0, navigation.responseStart));

      const paint = root.performance?.getEntriesByName?.('first-contentful-paint')?.[0];
      if (paint) emitVital('FCP', paint.startTime);

      new root.PerformanceObserver(list => {
        const entries = list.getEntries();
        if (entries.length) lcp = entries[entries.length - 1].startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      new root.PerformanceObserver(list => {
        list.getEntries().forEach(entry => { if (!entry.hadRecentInput) cls += entry.value; });
      }).observe({ type: 'layout-shift', buffered: true });

      new root.PerformanceObserver(list => {
        list.getEntries().forEach(entry => { inp = Math.max(inp, Number(entry.duration || 0)); });
      }).observe({ type: 'event', buffered: true, durationThreshold: 40 });

      const flush = () => {
        if (lcp) emitVital('LCP', lcp);
        emitVital('CLS', cls);
        if (inp) emitVital('INP', inp);
      };
      root.addEventListener('pagehide', flush, { once: true });
      root.document?.addEventListener?.('visibilitychange', () => { if (root.document.visibilityState === 'hidden') flush(); }, { once: true });
      return true;
    } catch (_error) {
      return false;
    }
  }

  function reportError(kind, context = {}) {
    const config = getConfig();
    const adapter = root.AtlasErrorMonitoring;
    if (!config.errorMonitoringEnabled || !adapter || typeof adapter.capture !== 'function') return false;
    const safeKinds = ['javascript', 'unhandled_rejection', 'api', 'hydration', 'persistence', 'comments', 'asset_404', 'tab', 'filter'];
    const safeComponents = ['guide', 'tabs', 'checklist', 'filters', 'comments', 'assets', 'storage', 'api'];
    const safeKind = safeKinds.includes(kind) ? kind : 'javascript';
    const component = safeComponents.includes(context.component) ? context.component : 'guide';
    const group = `${safeKind}:${component}`;
    const now = Date.now();
    while (errorTimes.length && now - errorTimes[0] > 60000) errorTimes.shift();
    if (errorTimes.length >= 5 || (errorGroups.has(group) && now - errorGroups.get(group) < 60000)) return false;
    errorTimes.push(now);
    errorGroups.set(group, now);
    try {
      adapter.capture({ kind: safeKind, component, page: GUIDE_PATH, frontendVersion: config.frontendVersion });
      return true;
    } catch (_error) {
      return false;
    }
  }

  function init() {
    if (normalizePath(root.location?.pathname) !== GUIDE_PATH || !root.document?.querySelector?.('#view-guide.atlas-guide--resident-evil-5')) return false;
    if (!initialized) {
      initialized = true;
      bindInteractions();
      renderPlaceholders();
      root.document.documentElement.dataset.re5ProductionReady = 'true';
    }
    emitGuideView();
    observeCoreWebVitals();
    return true;
  }

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
    root.addEventListener?.('atlas:consent-changed', init);
  }

  return Object.freeze({
    EVENT_PROPERTIES,
    ENUMS,
    createEventPayload,
    normalizeProperties,
    queryLengthBucket,
    resultCountBucket,
    progressBucket,
    renderPlaceholders,
    setAdSlotState,
    reportError,
    init
  });
});
