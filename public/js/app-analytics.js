window.AtlasAnalytics = (() => {
  const config = window.AtlasAnalyticsConfig || {};
  const measurementId = String(config.measurementId || '').trim();
  let lastPagePath = '';

  function isEnabled() {
    return /^G-[A-Z0-9]+$/i.test(measurementId) && typeof window.gtag === 'function';
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

  function send(eventName, params = {}) {
    if (!isEnabled()) return false;
    window.gtag('event', eventName, params);
    return true;
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

  function trackGuideView(game = {}) {
    const slug = String(game.slug || '').trim();
    const title = String(game.name || '').trim();
    if (!slug || !title) return false;
    return send('guide_view', {
      game_slug: slug,
      game_title: title
    });
  }

  function trackFeedbackSubmit({ feedbackType = '', gameSlug = '' } = {}) {
    const params = {
      feedback_type: String(feedbackType || 'Indefinido').slice(0, 80)
    };
    const slug = String(gameSlug || '').trim();
    if (slug) params.game_slug = slug.slice(0, 120);
    return send('feedback_submit', params);
  }

  return {
    isEnabled,
    trackPageView,
    trackGuideView,
    trackFeedbackSubmit
  };
})();
