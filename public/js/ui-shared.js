window.UIShared = (() => {
  function qs(selector) { return document.querySelector(selector); }
  function qsa(selector) { return Array.from(document.querySelectorAll(selector)); }
  function has(selector) { return Boolean(qs(selector)); }
  function setClass(selector, className, force) { const el = qs(selector); if (el) el.classList.toggle(className, force); }

  const FALLBACK_GAME_IMAGE = '/og-default.svg';

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeAttribute(value) { return escapeHtml(value); }

  function getGameImageSrc(value) {
    return value || FALLBACK_GAME_IMAGE;
  }

  function isPlaceholderGameImage(value = '') {
    const text = String(value || '').trim();
    return !text || /(^|\/)og-default\.svg(?:[?#].*)?$/i.test(text);
  }

  function deriveSteamLibraryCover(value = '') {
    const source = String(value || '').trim();
    if (!source || !/\/steam\/apps\/\d+\//i.test(source)) return '';
    const derived = source.replace(/\/(?:header|capsule_616x353)\.jpg([?#].*)?$/i, '/library_600x900.jpg$1');
    return derived !== source ? derived : '';
  }

  function getGameCoverSrc(game = {}, options = {}) {
    const sharedCover = window.AtlasCardModel?.getGameCoverImage?.(game, options);
    if (sharedCover) return getGameImageSrc(sharedCover);
    const explicitCover = String(game?.cover_image || '').trim();
    if (!isPlaceholderGameImage(explicitCover)) return getGameImageSrc(explicitCover);
    const bannerImage = String(game?.image || '').trim();
    const derivedCover = deriveSteamLibraryCover(bannerImage);
    if (derivedCover && derivedCover !== bannerImage) return getGameImageSrc(derivedCover);
    if (options.allowBannerFallback === false || isPlaceholderGameImage(bannerImage)) return '';
    return bannerImage ? getGameImageSrc(bannerImage) : '';
  }

  function buildImageAttrs(src, alt, className, options = {}) {
    const loading = options.loading || 'lazy';
    const decoding = options.decoding || 'async';
    const fetchpriority = options.fetchpriority ? ` fetchpriority="${escapeAttribute(options.fetchpriority)}"` : '';
    const sizes = options.sizes ? ` sizes="${escapeAttribute(options.sizes)}"` : '';
    const width = options.width ? ` width="${escapeAttribute(String(options.width))}"` : '';
    const height = options.height ? ` height="${escapeAttribute(String(options.height))}"` : '';
    return `<img src="${escapeAttribute(getGameImageSrc(src))}" alt="${escapeAttribute(alt || '')}" class="${className}" loading="${escapeAttribute(loading)}" decoding="${escapeAttribute(decoding)}"${fetchpriority}${sizes}${width}${height}>`;
  }

  function getFocusableElements(container) {
    return Array.from(container?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [])
      .filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
  }

  return {
    qs,
    qsa,
    has,
    setClass,
    escapeHtml,
    escapeAttribute,
    getGameImageSrc,
    getGameCoverSrc,
    deriveSteamLibraryCover,
    isPlaceholderGameImage,
    buildImageAttrs,
    getFocusableElements
  };
})();
