window.AppPublicNav = (() => {
  function ensureMeta(selector, attr, value) {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      const [key, keyValue] = selector.includes('property=')
        ? ['property', selector.match(/property="([^"]+)"/)?.[1]]
        : ['name', selector.match(/name="([^"]+)"/)?.[1]];
      if (keyValue) el.setAttribute(key, keyValue);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  }

  function getPublicOrigin() {
    const canonicalHref = document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    try {
      return new URL(canonicalHref).origin;
    } catch (error) {
      return window.location.origin;
    }
  }

  function buildPublicUrl(path = '/') {
    const pathPart = String(path || '/').startsWith('/') ? String(path || '/') : `/${path}`;
    return `${getPublicOrigin()}${pathPart}`;
  }

  function setStaticViewMeta({ title, description, path, robots = 'noindex,follow' }) {
    document.title = title;
    const canonical = buildPublicUrl(path);
    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonical);
    ensureMeta('meta[name="description"]', 'content', description);
    ensureMeta('meta[name="robots"]', 'content', robots);
    ensureMeta('meta[property="og:title"]', 'content', title);
    ensureMeta('meta[property="og:description"]', 'content', description);
    ensureMeta('meta[property="og:type"]', 'content', 'website');
    ensureMeta('meta[property="og:url"]', 'content', canonical);
    ensureMeta('meta[property="og:image"]', 'content', buildPublicUrl('/og-default.svg'));
    ensureMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    ensureMeta('meta[name="twitter:title"]', 'content', title);
    ensureMeta('meta[name="twitter:description"]', 'content', description);
    ensureMeta('meta[name="twitter:image"]', 'content', buildPublicUrl('/og-default.svg'));
  }

  function setLibraryMeta() {
    setStaticViewMeta({
      title: 'Biblioteca - AtlasAchievement',
      description: 'Acompanhe jogos salvos, progresso de troféus e próximos passos na sua biblioteca do AtlasAchievement sem expor dados do usuário.',
      path: '/biblioteca'
    });
  }

  function setProfileMeta() {
    setStaticViewMeta({
      title: 'Perfil - AtlasAchievement',
      description: 'Veja e edite seu perfil público no AtlasAchievement sem expor dados sensíveis no HTML inicial.',
      path: '/perfil'
    });
  }

  function createNavigate({ UI, page, state, getCatalogPath, getGameSlug, syncGuideQuickDock }) {
    return function navigate(view, options = {}) {
      UI.showView(view);

      if (page !== 'public') return;

      let path = '/';
      if (view === 'library') path = '/biblioteca';
      if (view === 'profile') path = '/perfil';
      if (view === 'catalog') path = getCatalogPath(options.facet || state.catalogFacet || 'all');
      if (view === 'guide' && options.game) path = `/jogo/${getGameSlug(options.game)}`;

      if (!options.skipHistory) {
        const currentPath = `${window.location.pathname}${window.location.search}`;
        if (currentPath !== path) {
          window.history.pushState({ view, slug: options.game ? getGameSlug(options.game) : null }, '', path);
        }
      }

      if (view === 'home') UI.setPageMeta();
      if (view === 'library') setLibraryMeta();
      if (view === 'profile') setProfileMeta();
      if (view === 'catalog') UI.setCatalogMeta(options.facet || state.catalogFacet || 'all');
      if (view === 'library') {
        UI.renderLibrary(state.library, {
          search: state.librarySearch,
          sort: state.librarySort,
          statusFilter: state.libraryStatus,
          availableGames: state.availableGames,
          storageLabel: state.librarySource === 'account' ? 'Salvo na conta' : 'Salvo neste navegador'
        });
      }
      if (view === 'catalog') UI.renderCatalog(state.catalogResponse, { search: state.catalogSearch, sort: state.catalogSort, facet: options.facet || state.catalogFacet, compareSelection: state.catalogCompare, intent: state.catalogIntent, allGames: state.availableGames });
      window.AtlasAnalytics?.trackPageView?.({ path, title: document.title });
      syncGuideQuickDock();
    };
  }

  async function handlePublicPath({ pathname, state, navigate, loadGuideBySlug, loadCatalogPage, loadGames, syncCatalogRoute, syncGuideQuickDock }) {
    syncGuideQuickDock();

    if (pathname.startsWith('/jogo/')) {
      const slug = decodeURIComponent(pathname.split('/jogo/')[1] || '');
      await loadGuideBySlug(slug, { skipHistory: true });
      return;
    }

    if (pathname === '/biblioteca') {
      navigate('library', { skipHistory: true });
      return;
    }

    if (pathname === '/perfil') {
      navigate('profile', { skipHistory: true });
      return;
    }

    if (pathname === '/catalogo' || pathname.startsWith('/catalogo/')) {
      await syncCatalogRoute({ pathname, state, navigate, loadCatalogPage });
      return;
    }

    if (typeof loadGames === 'function') await loadGames();
    navigate('home', { skipHistory: true });
  }

  function bindPublicNavigation({ UI, page, state, navigate, loadCatalogPage, loadGuideByName, loadGames, debouncedSearchGames, getCatalogFacetFromPath = () => 'all' }) {
    UI.qsa('[data-view-link]').forEach(button => button.addEventListener('click', async event => {
      event.preventDefault();
      const view = button.dataset.viewLink;
      if (view === 'home' && typeof loadGames === 'function') {
        await loadGames();
      }
      if (view === 'catalog' && !(state.catalogResponse?.items || []).length) {
        state.catalogPage = 1;
        await loadCatalogPage({ page: 1, facet: state.catalogFacet || getCatalogFacetFromPath(window.location.pathname) || 'all' });
      }
      navigate(view);
    }));

    UI.qs('#view-home')?.addEventListener('click', async event => {
      const viewTrigger = event.target.closest('[data-view-link]');
      if (viewTrigger) {
        event.preventDefault();
        navigate(viewTrigger.dataset.viewLink);
        return;
      }

      const scrollTrigger = event.target.closest('[data-scroll-target]');
      if (scrollTrigger) {
        event.preventDefault();
        const target = document.querySelector(scrollTrigger.dataset.scrollTarget || '');
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const facetTrigger = event.target.closest('[data-home-facet]');
      if (facetTrigger) {
        event.preventDefault();
        state.catalogFacet = facetTrigger.dataset.homeFacet || 'all';
        state.catalogPage = 1;
        await loadCatalogPage({ page: 1, facet: state.catalogFacet });
        navigate('catalog', { facet: state.catalogFacet });
        return;
      }

      const gameTrigger = event.target.closest('[data-home-game]');
      if (gameTrigger) {
        event.preventDefault();
        await loadGuideByName(gameTrigger.dataset.homeGame);
        return;
      }

      const chip = event.target.closest('.atlas-chip');
      if (chip) {
        event.preventDefault();
        const value = chip.textContent.trim();
        if (!value || !UI.qs('#gameInput')) return;
        UI.qs('#gameInput').value = value;
        debouncedSearchGames(value);
        await loadGuideByName(value);
      }
    });
  }

  function bindPublicPopState({ page, onNavigate }) {
    window.addEventListener('popstate', async () => {
      if (page !== 'public') return;
      await onNavigate(window.location.pathname);
    });
  }

  return {
    createNavigate,
    handlePublicPath,
    bindPublicNavigation,
    bindPublicPopState
  };
})();
