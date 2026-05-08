window.AppCatalog = (() => {
  const sharedCatalog = window.AtlasCatalogModel || {};
  const fallbackCatalogFacetPathMap = {
    all: '/catalogo',
    'difficulty-low': '/catalogo/dificuldade-baixa',
    'difficulty-mid': '/catalogo/dificuldade-media',
    'difficulty-high': '/catalogo/dificuldade-alta',
    'time-short': '/catalogo/ate-15-horas',
    'time-medium': '/catalogo/16-a-40-horas',
    'time-long': '/catalogo/mais-de-40-horas',
    'trophies-small': '/catalogo/ate-30-trofeus',
    'trophies-medium': '/catalogo/31-a-60-trofeus',
    'trophies-large': '/catalogo/mais-de-60-trofeus',
    'online-none': '/catalogo',
    'online-required': '/catalogo',
    'coop-required': '/catalogo',
    'missable-present': '/catalogo',
    'missable-none': '/catalogo',
    'grind-present': '/catalogo',
    'dlc-base': '/catalogo',
    'chapter-select': '/catalogo',
    'editorial-verified': '/catalogo',
    'editorial-review': '/catalogo'
  };
  const catalogFacetPathMap = sharedCatalog.catalogFacetPathMap || fallbackCatalogFacetPathMap;

  function getCatalogPath(facet = 'all') {
    return typeof sharedCatalog.getCatalogPath === 'function'
      ? sharedCatalog.getCatalogPath(facet)
      : (catalogFacetPathMap[facet] || '/catalogo');
  }

  function getCatalogFacetFromPath(pathname = '/') {
    if (typeof sharedCatalog.getCatalogFacetFromPath === 'function') {
      return sharedCatalog.getCatalogFacetFromPath(pathname);
    }
    const normalized = String(pathname || '/').replace(/\/+$/, '') || '/';
    const match = Object.entries(catalogFacetPathMap).find(([, path]) => path === normalized);
    return match ? match[0] : 'all';
  }

  async function loadCatalogPage(apiService, ui, state, options = {}) {
    if (!apiService || !ui || !state) {
      throw new Error('loadCatalogPage requer apiService, ui e state.');
    }

    state.catalogResponse = await apiService.getGames({
      q: options.search !== undefined ? options.search : state.catalogSearch,
      sort: options.sort || state.catalogSort,
      facet: options.facet || state.catalogFacet,
      page: options.page || state.catalogPage,
      limit: Number(options.limit || 24)
    });

    state.catalogPage = state.catalogResponse.pagination?.page || 1;
    ui.renderCatalog(state.catalogResponse, {
      search: state.catalogSearch,
      sort: state.catalogSort,
      facet: state.catalogFacet,
      compareSelection: state.catalogCompare,
      intent: state.catalogIntent,
      allGames: state.availableGames
    });

    return state.catalogResponse;
  }

  async function syncCatalogRoute({ pathname, state, navigate, loadCatalogPage }) {
    const nextFacet = getCatalogFacetFromPath(pathname);
    state.catalogFacet = nextFacet;
    state.catalogPage = 1;
    await loadCatalogPage({ page: 1, facet: nextFacet });
    navigate('catalog', { skipHistory: true, facet: nextFacet });
  }

  return {
    catalogFacetPathMap,
    getCatalogPath,
    getCatalogFacetFromPath,
    loadCatalogPage,
    syncCatalogRoute
  };
})();
