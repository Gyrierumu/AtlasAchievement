window.AtlasAnalytics = (() => {
  const config = window.AtlasAnalyticsConfig || {};
  const measurementId = String(config.measurementId || '').trim();
  let lastPagePath = '';
  let catalogSearchTimer = null;

  const seoPageMap = {
    '/comece-aqui': 'start_here',
    '/platinas-faceis': 'easy_platinums',
    '/platinas-curtas': 'short_platinums',
    '/platinas-sem-online': 'no_online',
    '/platinas-sem-perdiveis': 'no_missables',
    '/platinas-para-iniciantes': 'beginner_platinums'
  };

  const internalEventTypes = new Set([
    'guide_view',
    'catalog_search',
    'catalog_filter_used',
    'game_card_click',
    'checklist_toggle',
    'feedback_submit',
    'guide_tab_change',
    'seo_page_view'
  ]);

  const catalogFacetEventMap = {
    'difficulty-low': ['difficulty', 'low'],
    'difficulty-mid': ['difficulty', 'medium'],
    'difficulty-high': ['difficulty', 'high'],
    'time-short': ['estimated_time', 'short'],
    'time-medium': ['estimated_time', 'medium'],
    'time-long': ['estimated_time', 'long'],
    'online-none': ['no_online', 'true'],
    'online-required': ['online', 'required'],
    'coop-required': ['coop', 'required'],
    'missable-none': ['no_missables', 'true'],
    'missable-present': ['missables', 'present'],
    'grind-present': ['grind', 'present'],
    'dlc-base': ['dlc', 'base_game'],
    'chapter-select': ['chapter_select', 'available'],
    'editorial-verified': ['editorial_status', 'verified'],
    'editorial-review': ['editorial_status', 'in_review'],
    'trophies-small': ['trophy_count', 'small'],
    'trophies-medium': ['trophy_count', 'medium'],
    'trophies-large': ['trophy_count', 'large']
  };

  function isEnabled() {
    return /^G-[A-Z0-9]+$/i.test(measurementId)
      && typeof window.gtag === 'function'
      && !getPublicPath().startsWith('/admin');
  }

  function canTrackPublicEvent() {
    return !getPublicPath().startsWith('/admin');
  }

  function getPublicPath(path = window.location.pathname) {
    const rawPath = String(path || '/').split('#')[0].split('?')[0] || '/';
    return rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  }

  function getPublicOrigin() {
    const canonicalHref = document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    try {
      return new URL(canonicalHref).origin;
    } catch (error) {
      return window.location.origin;
    }
  }

  function getPageLocation(path = window.location.pathname) {
    return `${getPublicOrigin()}${getPublicPath(path)}`;
  }

  function cleanString(value = '', maxLength = 120) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  function cleanSlug(value = '') {
    return cleanString(value, 120).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function looksSensitiveSearchTerm(value = '') {
    const text = String(value || '').trim();
    return /@/.test(text)
      || /https?:\/\//i.test(text)
      || /\b\d{3,}[-.\s]?\d{3,}[-.\s]?\d{2,}\b/.test(text);
  }

  function cleanSearchTerm(value = '') {
    const text = cleanString(value, 100);
    if (!text || looksSensitiveSearchTerm(text)) return '';
    return text;
  }

  function normalizeParams(params = {}) {
    return Object.entries(params || {}).reduce((cleaned, [key, value]) => {
      if (value === undefined || value === null || value === '') return cleaned;
      if (typeof value === 'number') {
        if (Number.isFinite(value)) cleaned[key] = value;
        return cleaned;
      }
      if (typeof value === 'boolean') {
        cleaned[key] = value;
        return cleaned;
      }
      cleaned[key] = cleanString(value, 200);
      return cleaned;
    }, {});
  }

  function postInternalEvent(eventName, params = {}) {
    if (!canTrackPublicEvent() || !internalEventTypes.has(eventName)) return;
    const payload = JSON.stringify({
      eventType: eventName,
      page: getPublicPath(),
      gameSlug: params.game_slug || '',
      metadata: normalizeParams(params)
    });

    try {
      if (navigator.sendBeacon) {
        const body = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/analytics/events', body);
        return;
      }
    } catch (_error) {}

    try {
      window.fetch('/api/analytics/events', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: payload
      }).catch(() => {});
    } catch (_error) {}
  }

  function send(eventName, params = {}) {
    const cleanParams = normalizeParams(params);
    postInternalEvent(eventName, cleanParams);
    if (!isEnabled()) return false;
    try {
      window.gtag('event', eventName, cleanParams);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function trackPageView(options = {}) {
    const pagePath = getPublicPath(options.path);
    if (options.dedupe !== false && pagePath === lastPagePath) return false;
    lastPagePath = pagePath;
    return send('page_view', {
      page_title: String(options.title || document.title || 'AtlasAchievement'),
      page_location: getPageLocation(pagePath),
      page_path: pagePath
    });
  }

  function trackEvent(eventName, params = {}) {
    return send(eventName, params);
  }

  function getSeoPageType(path = window.location.pathname) {
    return seoPageMap[getPublicPath(path)] || '';
  }

  function getInteractionOrigin(element = null) {
    const path = getPublicPath();
    if (element?.closest?.('#guideRelatedOverview, .atlas-related-suggestions')) return 'related_games';
    if (getSeoPageType(path)) return 'seo_page';
    if (element?.closest?.('#view-home')) return 'home';
    if (element?.closest?.('#view-catalog')) return 'catalog';
    return 'direct';
  }

  function getElementGameTitle(element = null) {
    return cleanString(
      element?.dataset?.homeGame
        || element?.dataset?.gameTitle
        || element?.closest?.('[data-game-title]')?.dataset?.gameTitle
        || element?.closest?.('.catalog-card, .atlas-card, .atlas-featured-game, .atlas-editorial-update')?.querySelector?.('.catalog-card__title, .atlas-card__title, .atlas-featured-game__title, h3, h2')?.textContent
        || '',
      160
    );
  }

  function trackGuideView(game = {}, options = {}) {
    const slug = String(game.slug || '').trim();
    const title = String(game.name || '').trim();
    if (!slug || !title) return false;
    return send('guide_view', {
      game_slug: slug,
      game_title: title,
      source: cleanString(options.source || getInteractionOrigin(), 40) || 'direct'
    });
  }

  function trackGameCardClick({ element = null, gameSlug = '', gameTitle = '', origin = '' } = {}) {
    const slug = cleanSlug(gameSlug || element?.dataset?.gameSlug || element?.dataset?.openGuideCard || '');
    const title = cleanString(gameTitle || getElementGameTitle(element), 160);
    if (!slug) return false;
    return send('game_card_click', {
      game_slug: slug,
      game_title: title,
      origin: cleanString(origin || getInteractionOrigin(element), 40) || 'direct'
    });
  }

  function getCatalogFacetEvent(facet = '') {
    return catalogFacetEventMap[String(facet || '')] || ['', ''];
  }

  function getResultsCount(responseOrCount = 0) {
    if (typeof responseOrCount === 'number') return Math.max(0, responseOrCount);
    const paginationTotal = Number(responseOrCount?.pagination?.total);
    if (Number.isFinite(paginationTotal)) return Math.max(0, paginationTotal);
    if (Array.isArray(responseOrCount?.items)) return responseOrCount.items.length;
    return 0;
  }

  function trackCatalogSearch({ searchTerm = '', resultsCount = 0 } = {}) {
    const term = cleanSearchTerm(searchTerm);
    if (!term) return false;
    if (catalogSearchTimer) window.clearTimeout(catalogSearchTimer);
    catalogSearchTimer = window.setTimeout(() => {
      send('catalog_search', {
        search_term: term,
        results_count: getResultsCount(resultsCount),
        has_results: getResultsCount(resultsCount) > 0
      });
    }, 700);
    return true;
  }

  function trackCatalogFilterUsed({ facet = '', filterName = '', filterValue = '', resultsCount = 0 } = {}) {
    const [mappedName, mappedValue] = getCatalogFacetEvent(facet);
    const name = cleanString(filterName || mappedName, 80);
    const value = cleanString(filterValue || mappedValue || facet, 80);
    if (!name || !value || value === 'all') return false;
    return send('catalog_filter_used', {
      filter_name: name,
      filter_value: value,
      results_count: getResultsCount(resultsCount)
    });
  }

  function trackChecklistToggle({ gameSlug = '', trophyId = '', trophyName = '', action = '' } = {}) {
    const slug = cleanSlug(gameSlug);
    const nextAction = action === 'unchecked' ? 'unchecked' : 'checked';
    const params = {
      game_slug: slug,
      action: nextAction
    };
    const id = cleanString(trophyId, 120);
    const name = cleanString(trophyName, 160);
    if (id) params.trophy_id = id;
    else if (name) params.trophy_name = name;
    if (!slug || (!params.trophy_id && !params.trophy_name)) return false;
    return send('checklist_toggle', params);
  }

  function trackGuideTabChange({ gameSlug = '', tabName = '' } = {}) {
    const slug = cleanSlug(gameSlug);
    const tab = cleanString(tabName, 80);
    if (!slug || !tab) return false;
    return send('guide_tab_change', {
      game_slug: slug,
      tab_name: tab
    });
  }

  function trackSeoPageView({ path = window.location.pathname, title = document.title } = {}) {
    const pagePath = getPublicPath(path);
    const pageType = getSeoPageType(pagePath);
    if (!pageType) return false;
    return send('seo_page_view', {
      page_type: pageType,
      page_path: pagePath,
      page_title: cleanString(title || document.title || 'AtlasAchievement', 160)
    });
  }

  function trackFeedbackSubmit({ feedbackType = '', gameSlug = '', pageContext = '' } = {}) {
    const params = {
      feedback_type: String(feedbackType || 'Indefinido').slice(0, 80)
    };
    const slug = String(gameSlug || '').trim();
    if (slug) params.game_slug = slug.slice(0, 120);
    const context = cleanString(pageContext || getPublicPath(), 120);
    if (context) params.page_context = context;
    return send('feedback_submit', params);
  }

  return {
    isEnabled,
    trackEvent,
    getInteractionOrigin,
    trackPageView,
    trackGuideView,
    trackGameCardClick,
    trackCatalogSearch,
    trackCatalogFilterUsed,
    trackChecklistToggle,
    trackGuideTabChange,
    trackSeoPageView,
    trackFeedbackSubmit
  };
})();
