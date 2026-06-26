window.AppContextFactory = (() => {
  function createAppContext() {
    const page = document.body.dataset.page || 'public';
    const state = {
      availableGames: [],
      gamesLoaded: false,
      currentGame: null,
      activeFilter: 'all',
      checklistDensity: window.UI?.getChecklistDensityPreference?.() || 'comfortable',
      guideSearch: '',
      quickDockCollapsed: true,
      librarySearch: '',
      librarySort: 'recent',
      libraryStatus: 'all',
      catalogSearch: '',
      catalogSort: 'recommended-desc',
      catalogFacet: 'all',
      catalogPage: 1,
      catalogResponse: { items: [], pagination: { page: 1, totalPages: 1, total: 0 } },
      catalogCompare: [],
      catalogIntent: 'all',
      adminSearch: '',
      adminSort: 'updated-desc',
      adminPage: 1,
      adminFeedbackPage: 1,
      adminGamesResponse: { items: [], pagination: { page: 1, totalPages: 1, total: 0 } },
      adminFeedbackResponse: { items: [], pagination: { page: 1, totalPages: 1, total: 0 } },
      adminBetaMetrics: null,
      library: StorageService.getLibrary(),
      session: { authenticated: false },
      userSession: { authenticated: false, user: null },
      librarySource: 'local',
      accountStats: null,
      pendingLocalImport: null,
      adminSummary: { totalGames: 0, totalTrophies: 0 },
      initialState: window.__INITIAL_STATE__ || null,
      searchSuggestions: [],
      activeSuggestionIndex: -1
    };
    if (state.initialState?.page === 'catalog' && state.initialState.catalog) {
      state.catalogFacet = state.initialState.facet || 'all';
      state.catalogResponse = state.initialState.catalog;
      state.catalogPage = Number(state.catalogResponse?.pagination?.page || 1);
      state.availableGames = Array.isArray(state.catalogResponse?.items) ? state.catalogResponse.items : [];
    }

    const noop = () => {};
    const noopAsync = async () => {};
    const identity = value => value;
    const defaultDebounce = (fn, wait = 0) => {
      let timer = null;
      return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), wait);
      };
    };

    function slugify(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || `jogo-${Date.now()}`;
    }

    const defaultRankGames = (games = [], query = '', limit = 8) => {
      const normalized = String(query || '').trim().toLowerCase();
      const items = Array.isArray(games) ? games : [];
      if (!normalized) return items.slice(0, limit);
      return items.filter(game => String(game?.name || '').toLowerCase().includes(normalized)).slice(0, limit);
    };

    const SearchUtils = window.AppSearchUtils || {};
    const normalizeSearchText = SearchUtils.normalizeSearchText || (value => String(value || '').trim().toLowerCase());
    const scoreSearchMatch = SearchUtils.scoreSearchMatch || (() => -1);
    const rankGamesByQuery = SearchUtils.rankGamesByQuery || defaultRankGames;
    const debounce = SearchUtils.debounce || defaultDebounce;

    const LibraryModule = window.AppLibrary || {};
    const getLibraryKeyFromModule = LibraryModule.getLibraryKey || (game => String(game?.slug || game?.name || '').trim().toLowerCase());
    const buildLibraryStatus = LibraryModule.buildLibraryStatus || (() => ({ progress: 0, status: 'new' }));
    const normalizeLibraryEntryFromModule = LibraryModule.normalizeLibraryEntry || ((game = {}, previous = {}, getKey = getLibraryKeyFromModule) => ({ ...game, ...previous, key: getKey(game), completed: previous.completed || [] }));
    const findLibraryEntryByGameIdentity = LibraryModule.findLibraryEntryByGameIdentity || (() => null);
    const resolveLibraryKeyFromModule = LibraryModule.resolveLibraryKey || (game => getLibraryKeyFromModule(game));
    const removeEntriesByIdentity = LibraryModule.removeEntriesByIdentity || (library => ({ removed: false, library }));

    const buildGuideRenderModel = window.GuidePresenter?.buildGuideRenderModel || ((game, library) => ({ game, library, relatedGames: [], completedTrophies: new Set(), isSaved: false }));

    const CatalogModule = window.AppCatalog || {};
    const getCatalogPath = CatalogModule.getCatalogPath || (() => '/catalogo');
    const getCatalogFacetFromPath = CatalogModule.getCatalogFacetFromPath || (() => 'all');
    const loadCatalogPageFromModule = CatalogModule.loadCatalogPage || noopAsync;
    const syncCatalogRoute = CatalogModule.syncCatalogRoute || noopAsync;

    const ViewBindings = window.AppViewBindings || {};
    const bindLibraryView = ViewBindings.bindLibraryView || noop;
    const bindCatalogView = ViewBindings.bindCatalogView || noop;
    const bindPaginationControls = window.AppPagination?.bindPaginationControls || ViewBindings.bindPaginationControls || noop;

    const bindGlobalSearch = window.AppSearchView?.bindGlobalSearch || noop;
    const bindGuideInteractions = window.AppGuideView?.bindGuideInteractions || noop;

    const PublicNav = window.AppPublicNav || {};
    const createNavigate = PublicNav.createNavigate || (() => noop);
    const handlePublicPath = PublicNav.handlePublicPath || noopAsync;
    const bindPublicNavigation = PublicNav.bindPublicNavigation || noop;
    const bindPublicPopState = PublicNav.bindPublicPopState || noop;

    const createLibraryController = window.AppLibraryController?.createLibraryController || (() => ({
      getLibraryKey: getLibraryKeyFromModule,
      persistLibrary: noop,
      renderLibraryView: noop,
      getStorageLabel: () => 'Salvo neste navegador',
      isAccountLibrary: () => false,
      refreshAccountLibrary: noopAsync,
      restoreLocalLibrary: noop,
      importLocalLibraryToAccount: noopAsync,
      keepLocalLibraryForLater: noop,
      ignoreLocalImport: noop,
      syncTrophyProgress: noopAsync,
      normalizeLibraryEntry: normalizeLibraryEntryFromModule,
      upsertLibraryEntry: identity,
      resolveLibraryKey: resolveLibraryKeyFromModule,
      syncLibraryIdentityForGame: noop,
      removeCurrentGameFromLibrary: noop,
      saveCurrentGameToLibrary: noop,
      isCurrentGameSaved: () => false,
      deleteFromLibrary: noop
    }));

    const createGuideController = window.AppGuideController?.createGuideController || (() => ({
      renderCurrentGuide: noop,
      loadGuideBySlug: noopAsync,
      loadGuideByName: noopAsync,
      toggleTrophy: noop,
      loadFromLibrary: noopAsync,
      focusGuideAction: noop,
      syncGuideQuickDock: noop,
      handleGuideQuickDockClick: noop
    }));

    const AdminModule = window.AppAdmin || {};
    const collectAdminGameFormPayload = AdminModule.collectGameFormPayload || (() => ({}));
    const createAdminController = AdminModule.createAdminController || (() => ({
      loadAdminGames: noopAsync,
      loadAdminSummary: noopAsync,
      openFormPreview: noop,
      openAdminPanel: noopAsync,
      bindAdminEvents: noop
    }));

    const UserAuthModule = window.AppUserAuth || {};
    const createUserAuthController = UserAuthModule.createUserAuthController || (() => ({
      bindUserAuthEvents: noop,
      syncUserSession: noopAsync,
      renderProfileView: noop
    }));

    function getGameSlug(game) {
      return game?.slug || slugify(game?.name || '');
    }

    function setSearchSuggestions(games = []) {
      state.searchSuggestions = Array.isArray(games) ? games : [];
      state.activeSuggestionIndex = state.searchSuggestions.length ? 0 : -1;
      UI.renderSuggestions(state.searchSuggestions, { activeIndex: state.activeSuggestionIndex });
    }

    function syncSuggestionHighlight() {
      if (typeof UI.syncSuggestionHighlight === 'function') {
        UI.syncSuggestionHighlight(state.activeSuggestionIndex, { scroll: true });
        return;
      }
      UI.renderSuggestions(state.searchSuggestions, { activeIndex: state.activeSuggestionIndex });
    }

    const debouncedSearchGames = debounce(query => {
      searchGames(query);
    }, 160);

    function getBestSuggestion(query = '') {
      const ranked = rankGamesByQuery(state.searchSuggestions.length ? state.searchSuggestions : state.availableGames, query, 1, { getSlug: getGameSlug });
      return ranked[0] || null;
    }

    const navigate = page === 'public'
      ? createNavigate({ UI, page, state, getCatalogPath, getGameSlug, syncGuideQuickDock: (...args) => guideController.syncGuideQuickDock(...args) })
      : noop;

    const libraryController = createLibraryController({
      UI,
      ApiService,
      state,
      StorageService,
      getLibraryKeyFromModule,
      buildLibraryStatus,
      normalizeLibraryEntryFromModule,
      findLibraryEntryByGameIdentity,
      resolveLibraryKeyFromModule
    });

    const {
      getLibraryKey,
      persistLibrary,
      renderLibraryView,
      getStorageLabel,
      isAccountLibrary,
      refreshAccountLibrary,
      restoreLocalLibrary,
      importLocalLibraryToAccount,
      keepLocalLibraryForLater,
      ignoreLocalImport,
      syncTrophyProgress,
      normalizeLibraryEntry,
      upsertLibraryEntry,
      resolveLibraryKey,
      syncLibraryIdentityForGame,
      removeCurrentGameFromLibrary,
      saveCurrentGameToLibrary,
      isCurrentGameSaved,
      deleteFromLibrary
    } = libraryController;

    async function loadGames(options = {}) {
      const force = Boolean(options.force);
      if (state.gamesLoaded && !force) {
        return state.availableGames;
      }

      const initialGames = Array.isArray(state.initialState?.games) ? state.initialState.games : [];
      if (!force && initialGames.length && !state.availableGames.length) {
        state.availableGames = initialGames;
        if (page === 'public') {
          UI.renderHomeOverview(state.availableGames, state.library);
        }
      }

      let pageNumber = 1;
      let totalPages = 1;
      const allItems = [];

      try {
        do {
          const response = await ApiService.getGames({ page: pageNumber, limit: 100, sort: 'updated-desc' });
          allItems.push(...(response.items || []));
          totalPages = Number(response.pagination?.totalPages || 1);
          pageNumber += 1;
        } while (pageNumber <= totalPages);
      } catch (error) {
        if (state.availableGames.length) {
          state.gamesLoaded = true;
          return state.availableGames;
        }
        throw error;
      }

      state.availableGames = allItems;
      state.gamesLoaded = true;
      if (page === 'public') {
        UI.renderHomeOverview(state.availableGames, state.library);
      }
      return state.availableGames;
    }

    function rerenderCatalogView() {
      UI.renderCatalog(state.catalogResponse, {
        search: state.catalogSearch,
        sort: state.catalogSort,
        facet: state.catalogFacet,
        compareSelection: state.catalogCompare,
        intent: state.catalogIntent,
        allGames: state.availableGames
      });
    }

    function toggleCatalogCompare(slug) {
      const key = String(slug || '').trim();
      if (!key) return;
      const current = Array.isArray(state.catalogCompare) ? state.catalogCompare.slice(0, 3) : [];
      const exists = current.includes(key);
      state.catalogCompare = exists ? current.filter(item => item !== key) : [...current, key].slice(0, 3);
      rerenderCatalogView();
    }

    function clearCatalogCompare() {
      state.catalogCompare = [];
      rerenderCatalogView();
    }

    function setCatalogIntent(intent = 'all') {
      state.catalogIntent = intent || 'all';
    }

    async function fetchSearchSuggestions(query) {
      const normalized = query.trim();
      if (!normalized) return [];

      const localMatches = rankGamesByQuery(state.availableGames, normalized, 8, { getSlug: getGameSlug });

      try {
        const response = await ApiService.getGames({ q: normalized, page: 1, limit: 20, sort: 'name-asc' });
        const remoteMatches = response.items || [];
        return rankGamesByQuery([...localMatches, ...remoteMatches], normalized, 8, { getSlug: getGameSlug });
      } catch (error) {
        return localMatches;
      }
    }

    async function loadCatalogPage(options = {}) {
      return loadCatalogPageFromModule(ApiService, UI, state, options);
    }

    async function syncSession() {
      state.session = await ApiService.getSession();
      UI.setAdminState?.(state.session);
      return state.session;
    }

    const userAuthController = createUserAuthController({
      UI,
      ApiService,
      state,
      navigate,
      refreshAccountLibrary,
      restoreLocalLibrary,
      importLocalLibraryToAccount,
      keepLocalLibraryForLater,
      ignoreLocalImport,
      renderLibraryView
    });

    const { bindUserAuthEvents, syncUserSession, renderProfileView } = userAuthController;

    const adminController = createAdminController({
      UI,
      ApiService,
      state,
      page,
      loadGames,
      syncSession,
      navigate,
      collectGameFormPayload: collectAdminGameFormPayload,
      removeEntriesByIdentity,
      persistLibrary
    });

    const { loadAdminGames, loadAdminSummary, openFormPreview, openAdminPanel, bindAdminEvents } = adminController;

    window.openFormPreview = openFormPreview;
    window.refreshAdminQuality = () => window.AppAdmin?.refreshEditorialQuality?.(UI, state, window.AppAdmin.collectGameFormPayload);

    async function searchGames(query) {
      const normalized = query.trim();
      if (!normalized) {
        state.searchSuggestions = [];
        state.activeSuggestionIndex = -1;
        UI.hideSuggestions();
        UI.setSearchFeedback('Digite um nome para ver sugestões e abrir a página do jogo.');
        return;
      }
      const filtered = await fetchSearchSuggestions(normalized);
      setSearchSuggestions(filtered);
    }

    async function openBestSearchResult(rawQuery, options = {}) {
      const query = String(rawQuery || '').trim();
      if (!query) {
        UI.setSearchFeedback('Digite o nome de um jogo para continuar.', 'error');
        return UI.showToast('Digite o nome de um jogo.', 'error');
      }
      window.AtlasAnalytics?.trackGameSearch?.({
        searchTerm: query,
        source: options.analyticsSource || 'home'
      });

      const normalizedQuery = normalizeSearchText(query);
      let currentSuggestion = state.searchSuggestions[state.activeSuggestionIndex] || getBestSuggestion(query);
      const suggestionMatchesQuery = currentSuggestion
        && scoreSearchMatch(currentSuggestion, normalizedQuery) >= 0;

      if (!suggestionMatchesQuery) {
        const refreshedSuggestions = await fetchSearchSuggestions(query);
        setSearchSuggestions(refreshedSuggestions);
        currentSuggestion = refreshedSuggestions[0] || null;
      }

      if (!currentSuggestion) {
        UI.setSearchFeedback('Nenhum jogo próximo foi encontrado. Tente outro termo.', 'error');
        return UI.showToast('Nenhum jogo correspondente encontrado.', 'error');
      }

      const input = UI.qs('#gameInput');
      if (input) input.value = currentSuggestion.name;
      UI.hideSuggestions();
      state.searchSuggestions = [];
      state.activeSuggestionIndex = -1;
      return loadGuideBySlug(getGameSlug(currentSuggestion), { resetScroll: true, ...options });
    }

    const guideController = createGuideController({
      UI,
      ApiService,
      state,
      page,
      navigate,
      getGameSlug,
      buildGuideRenderModel,
      normalizeLibraryEntry,
      getLibraryKey,
      upsertLibraryEntry,
      syncLibraryIdentityForGame,
      resolveLibraryKey,
      isAccountLibrary,
      syncTrophyProgress
    });

    const {
      renderCurrentGuide,
      loadGuideBySlug,
      loadGuideByName,
      toggleTrophy,
      loadFromLibrary,
      focusGuideAction,
      syncGuideQuickDock,
      handleGuideQuickDockClick
    } = guideController;

    state.loadGuideByName = loadGuideByName;

    function bindCommonUi() {
      UI.updateLibraryBadge(state.library);
      UI.resetGameForm?.();
      syncGuideQuickDock();
    }

    return {
      UI,
      ApiService,
      StorageService,
      page,
      state,
      handlePublicPath,
      bindPublicNavigation,
      bindPublicPopState,
      bindGlobalSearch,
      bindGuideInteractions,
      bindLibraryView,
      bindCatalogView,
      bindPaginationControls,
      getCatalogFacetFromPath,
      syncCatalogRoute,
      navigate,
      loadGames,
      syncSession,
      loadCatalogPage,
      loadAdminGames,
      loadAdminSummary,
      bindUserAuthEvents,
      syncUserSession,
      renderProfileView,
      openFormPreview,
      openAdminPanel,
      bindAdminEvents,
      loadGuideBySlug,
      loadGuideByName,
      toggleTrophy,
      loadFromLibrary,
      focusGuideAction,
      syncGuideQuickDock,
      handleGuideQuickDockClick,
      rerenderCatalogView,
      toggleCatalogCompare,
      clearCatalogCompare,
      setCatalogIntent,
      debouncedSearchGames,
      openBestSearchResult,
      syncSuggestionHighlight,
      deleteFromLibrary,
      isCurrentGameSaved,
      removeCurrentGameFromLibrary,
      saveCurrentGameToLibrary,
      renderLibraryView,
      getStorageLabel,
      refreshAccountLibrary,
      restoreLocalLibrary,
      importLocalLibraryToAccount,
      keepLocalLibraryForLater,
      ignoreLocalImport,
      renderCurrentGuide,
      bindCommonUi
    };
  }

  return { createAppContext };
})();
