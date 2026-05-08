window.AppSearchUtils = (() => {
  function normalizeSearchText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function scoreSearchMatch(game, query, options = {}) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return -1;
    const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
    const normalizedName = normalizeSearchText(game?.name || '');
    const normalizedSlug = normalizeSearchText(game?.slug || '');
    const haystack = `${normalizedName} ${normalizedSlug}`.trim();

    if (!haystack) return -1;

    let score = 0;

    if (normalizedName === normalizedQuery) score += 1200;
    if (normalizedSlug === normalizedQuery) score += 1100;
    if (normalizedName.startsWith(normalizedQuery)) score += 800;
    if (normalizedSlug.startsWith(normalizedQuery)) score += 700;
    if (normalizedName.includes(normalizedQuery)) score += 450;
    if (normalizedSlug.includes(normalizedQuery)) score += 350;

    const joinedInitials = normalizedName.split(/\s+/).map(part => part[0] || '').join('');
    if (joinedInitials && joinedInitials.startsWith(normalizedQuery.replace(/\s+/g, ''))) score += 220;

    const matchedTerms = queryTerms.filter(term => haystack.includes(term));
    if (!matchedTerms.length) return -1;
    score += matchedTerms.length * 100;

    if (queryTerms.every(term => normalizedName.includes(term))) score += 220;
    if (queryTerms.every(term => haystack.includes(term))) score += 120;

    score -= Math.max(normalizedName.length - normalizedQuery.length, 0) * 0.35;

    return score;
  }

  function rankGamesByQuery(games, query, limit = 8, options = {}) {
    const getSlug = typeof options.getSlug === 'function'
      ? options.getSlug
      : (game => game?.slug || String(game?.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'));

    const deduped = new Map();
    (Array.isArray(games) ? games : []).forEach(game => {
      const key = getSlug(game) || game?.name;
      if (key && !deduped.has(key)) deduped.set(key, game);
    });

    return Array.from(deduped.values())
      .map(game => ({ game, score: scoreSearchMatch(game, query, options) }))
      .filter(entry => entry.score >= 0)
      .sort((a, b) => b.score - a.score || String(a.game.name || '').localeCompare(String(b.game.name || ''), 'pt-BR'))
      .slice(0, limit)
      .map(entry => entry.game);
  }

  function debounce(fn, delay = 180) {
    let timeoutId = null;
    return (...args) => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => fn(...args), delay);
    };
  }

  return { normalizeSearchText, scoreSearchMatch, rankGamesByQuery, debounce };
})();
