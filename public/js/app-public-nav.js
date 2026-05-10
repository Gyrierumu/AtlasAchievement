window.AppPublicNav = (() => {
  const organicSeoPages = {
    '/comece-aqui': {
      view: 'seo-page',
      title: 'Comece por aqui | AtlasAchievement',
      description: 'Aprenda como começar a platinar jogos com guias em português, roadmap, checklist, troféus perdíveis, online obrigatório e recomendações para iniciantes.'
    },
    '/platinas-faceis': {
      view: 'catalog',
      title: 'Platinas fáceis | AtlasAchievement',
      description: 'Lista de jogos com platinas fáceis em português, com tempo estimado, dificuldade, roadmap e checklist.'
    },
    '/platinas-curtas': {
      view: 'catalog',
      title: 'Platinas curtas | AtlasAchievement',
      description: 'Encontre jogos curtos para platinar, com guias em português, tempo estimado, dificuldade e checklist.'
    },
    '/platinas-sem-online': {
      view: 'catalog',
      title: 'Platinas sem online | AtlasAchievement',
      description: 'Veja jogos para platinar sem online obrigatório, com roadmap, checklist e informações de troféus em português.'
    },
    '/platinas-sem-perdiveis': {
      view: 'catalog',
      title: 'Platinas sem troféus perdíveis | AtlasAchievement',
      description: 'Lista de jogos sem troféus perdíveis para platinar com menos risco, usando guias em português.'
    },
    '/platinas-para-iniciantes': {
      view: 'catalog',
      title: 'Platinas para iniciantes | AtlasAchievement',
      description: 'Jogos recomendados para quem está começando a platinar, com guias em português, roadmap, checklist e dicas para evitar erros.'
    }
  };

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

  function setOrganicSeoMeta(pathname = '/') {
    const page = organicSeoPages[pathname];
    if (!page) return;
    setStaticViewMeta({
      title: page.title,
      description: page.description,
      path: pathname,
      robots: 'index,follow'
    });
  }

  function useManualScrollRestoration() {
    try {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
    } catch (_error) {}
  }

  function getVisibleViewId(UI) {
    const current = UI.qsa('main > section').find(section => !section.classList.contains('hidden'));
    return current?.id?.replace(/^view-/, '') || '';
  }

  function createNavigate({ UI, page, state, getCatalogPath, getGameSlug, syncGuideQuickDock }) {
    if (page === 'public') useManualScrollRestoration();

    return function navigate(view, options = {}) {
      const previousView = state.activeView || getVisibleViewId(UI);
      const currentPath = `${window.location.pathname}${window.location.search}`;
      UI.showView(view);
      state.activeView = view;

      if (page !== 'public') return;

      let path = '/';
      if (view === 'library') path = '/biblioteca';
      if (view === 'profile') path = '/perfil';
      if (view === 'catalog') path = getCatalogPath(options.facet || state.catalogFacet || 'all');
      if (view === 'guide' && options.game) path = `/jogo/${getGameSlug(options.game)}`;

      if (!options.skipHistory) {
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

      const viewChanged = Boolean(previousView && previousView !== view);
      const guideChanged = view === 'guide' && path.startsWith('/jogo/') && currentPath !== path;
      const shouldResetScroll = !options.preserveScroll && (options.resetScroll || viewChanged || guideChanged);
      if (shouldResetScroll) {
        const schedule = window.requestAnimationFrame || (callback => window.setTimeout(callback, 0));
        schedule(() => {
          UI.resetPageScroll?.();
          syncGuideQuickDock();
        });
      }
    };
  }

  async function handlePublicPath({ pathname, UI, state, navigate, loadGuideBySlug, loadCatalogPage, loadGames, syncCatalogRoute, syncGuideQuickDock }) {
    syncGuideQuickDock();

    if (organicSeoPages[pathname]) {
      UI?.showView?.(organicSeoPages[pathname].view);
      state.activeView = organicSeoPages[pathname].view;
      setOrganicSeoMeta(pathname);
      return;
    }

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
    useManualScrollRestoration();

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
      navigate(view, { resetScroll: true });
    }));

    UI.qs('#view-home')?.addEventListener('click', async event => {
      const viewTrigger = event.target.closest('[data-view-link]');
      if (viewTrigger) {
        event.preventDefault();
        navigate(viewTrigger.dataset.viewLink, { resetScroll: true });
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
    useManualScrollRestoration();

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
