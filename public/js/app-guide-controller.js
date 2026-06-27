window.AppGuideController = (() => {
  function createGuideController({
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
  }) {
    let quickDockScrollFrame = null;
    let quickDockListenersBound = false;

    function shouldResetGuideScroll(options = {}) {
      return page === 'public'
        && !options.preserveScroll
        && !options.preserveChecklistState
        && !window.location.hash;
    }

    function resetGuideScrollAfterRender(options = {}) {
      if (!shouldResetGuideScroll(options)) return;
      const schedule = window.requestAnimationFrame || (callback => window.setTimeout(callback, 0));
      schedule(() => {
        UI.resetPageScroll?.();
        UI.focusRouteContent?.();
        syncGuideQuickDock();
        schedule(() => {
          UI.resetPageScroll?.();
          UI.focusRouteContent?.();
          syncGuideQuickDock();
        });
        window.setTimeout(() => {
          if (!window.location.hash) UI.resetPageScroll?.();
          UI.focusRouteContent?.();
          syncGuideQuickDock();
        }, 60);
        window.setTimeout(() => {
          UI.focusRouteContent?.();
        }, 180);
      });
    }

    function renderCurrentGuide(options = {}) {
      if (!state.currentGame) return;
      const renderModel = buildGuideRenderModel(state.currentGame, state.library, state.availableGames, {
        getSlug: getGameSlug,
        normalizeLibraryEntry: (game, normalizeOptions = {}) => normalizeLibraryEntry(game, normalizeOptions),
        limit: 4
      });
      if (!renderModel) return;
      UI.renderGuide(state.currentGame, {
        completedTrophies: renderModel.completedTrophies,
        isSaved: renderModel.isSaved,
        libraryEntry: renderModel.libraryEntry,
        relatedGames: renderModel.relatedGames,
        storageLabel: isAccountLibrary?.() ? 'Salvo na conta' : 'Salvo neste navegador',
        activeGuideTab: state.activeGuideTab || 'summary'
      });
      state.checklistDensity = UI.applyChecklistDensity?.(state.checklistDensity) || state.checklistDensity;
      UI.setPageMeta(state.currentGame);
      navigate('guide', { ...options, game: state.currentGame, skipHistory: options.skipHistory });
      if (!options.preserveChecklistState) {
        UI.clearTrophySearch();
        state.guideSearch = '';
        state.activeGuideTab = 'summary';
        UI.activateGuideTab?.('summary', { scroll: false });
      }
      UI.applyTrophyFilter(state.activeFilter, state.guideSearch);
      if (UI.has('#guideDecisionStack')) UI.qs('#guideDecisionStack').classList.remove('hidden');
      if (UI.has('#guideContent')) UI.qs('#guideContent').classList.remove('hidden');
      resetGuideScrollAfterRender(options);
      if (!options.preserveChecklistState) {
        window.AtlasAnalytics?.trackGuideView?.(state.currentGame, {
          source: options.analyticsSource || 'direct'
        });
      }
    }

    async function loadGuideBySlug(slug, options = {}) {
      const slugValue = slug?.trim();
      if (!slugValue) return navigate('home', options);
      try {
        UI.resetTransientNavigationState?.();
        navigate('guide', { ...options, game: { slug: slugValue } });
        UI.setLoading(true);
        UI.setGuideEmptyState(false);
        const initialGuide = state.initialState?.page === 'guide'
          && state.initialState?.game
          && getGameSlug(state.initialState.game) === slugValue
          ? state.initialState.game
          : null;
        const guide = initialGuide || await ApiService.getGameBySlug(slugValue);
        state.initialState = null;
        state.currentGame = guide;
        state.quickDockDismissed = false;
        const existing = syncLibraryIdentityForGame(guide) || state.library[getLibraryKey(guide)];
        if (existing) {
          upsertLibraryEntry(guide, {
            completed: Array.isArray(existing.completed) ? existing.completed : [],
            savedAt: existing.savedAt,
            lastActivityAt: existing.lastActivityAt,
            lastOpenedAt: new Date().toISOString(),
            status: existing.status
          });
        }
        UI.setSearchFeedback(`Página de ${guide.name} aberta.`, 'success');
        renderCurrentGuide(options);
      } catch (error) {
        UI.showToast(error.message, 'error');
        UI.setSearchFeedback(error.message, 'error');
        navigate('home', options);
      } finally {
        UI.setLoading(false);
      }
    }

    async function loadGuideByName(name, options = {}) {
      const gameName = name?.trim();
      if (!gameName) {
        UI.setSearchFeedback('Digite o nome de um jogo para continuar.', 'error');
        return UI.showToast('Digite o nome de um jogo.', 'error');
      }
      try {
        UI.resetTransientNavigationState?.();
        navigate('guide', { ...options, game: { name: gameName } });
        UI.setLoading(true);
        UI.setGuideEmptyState(false);
        const guide = await ApiService.getGameByName(gameName);
        state.currentGame = guide;
        state.quickDockDismissed = false;
        const existing = syncLibraryIdentityForGame(guide) || state.library[getLibraryKey(guide)];
        if (existing) {
          upsertLibraryEntry(guide, {
            completed: Array.isArray(existing.completed) ? existing.completed : [],
            savedAt: existing.savedAt,
            lastActivityAt: existing.lastActivityAt,
            lastOpenedAt: new Date().toISOString(),
            status: existing.status
          });
        }
        UI.setSearchFeedback(`Página de ${guide.name} aberta.`, 'success');
        renderCurrentGuide(options);
      } catch (error) {
        UI.showToast(error.message, 'error');
        UI.setSearchFeedback(error.message, 'error');
        if (page === 'public') navigate('home', options);
      } finally {
        UI.setLoading(false);
      }
    }

    function toggleTrophy(trophyId) {
      if (!state.currentGame) return;
      const trophyKey = String(trophyId || '').trim();
      if (!trophyKey) return;
      const key = getLibraryKey(state.currentGame);
      const currentEntry = state.library[key] || normalizeLibraryEntry(state.currentGame, { completed: [] });
      const completed = Array.isArray(currentEntry.completed)
        ? currentEntry.completed.map(id => String(id || '').trim()).filter(Boolean)
        : [];
      const index = completed.indexOf(trophyKey);
      const nextCompleted = index < 0;
      if (index >= 0) completed.splice(index, 1); else completed.push(trophyKey);
      const trophy = (Array.isArray(state.currentGame.trophies) ? state.currentGame.trophies : [])
        .find(item => String(item?.id || item?.name || '') === trophyKey);
      window.AtlasAnalytics?.trackChecklistToggle?.({
        gameSlug: getGameSlug(state.currentGame),
        trophyId: trophy?.id || trophyKey,
        trophyName: trophy?.name || '',
        action: nextCompleted ? 'checked' : 'unchecked'
      });
      upsertLibraryEntry(state.currentGame, {
        completed,
        lastActivityAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString()
      });
      if (isAccountLibrary?.()) {
        syncTrophyProgress?.(state.currentGame, trophyKey, nextCompleted);
      }
      renderCurrentGuide({ preserveChecklistState: true, skipHistory: true });
    }

    async function loadFromLibrary(key) {
      const resolvedKey = resolveLibraryKey(key);
      const entry = state.library[resolvedKey];
      if (!entry) return;
      if (entry.slug) {
        try {
          return await loadGuideBySlug(entry.slug);
        } catch (_error) {}
      }
      state.currentGame = entry;
      state.quickDockDismissed = false;
      upsertLibraryEntry(entry, { lastOpenedAt: new Date().toISOString() });
      renderCurrentGuide();
    }

    function focusGuideAction(action = 'trophies') {
      const tabByAction = {
        header: 'summary',
        quick: 'summary',
        roadmap: 'roadmap',
        trophies: 'checklist',
        checklist: 'checklist',
        search: 'checklist',
        'first-pending': 'checklist',
        risks: 'summary',
        missables: 'summary',
        online: 'summary',
        dlc: 'summary',
        related: 'details',
        details: 'details'
      };
      const nextTab = tabByAction[action] || 'checklist';
      state.activeGuideTab = nextTab;
      UI.activateGuideTab?.(nextTab, { scroll: false });
      window.AtlasAnalytics?.trackGuideTabChange?.({
        gameSlug: getGameSlug(state.currentGame),
        tabName: nextTab
      });
      const map = {
        header: '#guideHeader',
        quick: '#guidePlatinumSummaryPanel',
        roadmap: '#guideRoadmapPanel',
        missables: '#guideQuickCard-missables',
        trophies: '#guideChecklistPanel',
        online: '#guideQuickCard-online',
        dlc: '#guideQuickCard-dlc',
        search: '#trophySearch',
        risks: '#guideHeader',
        related: '#guideRelatedPanel',
        'first-pending': '[data-next-focus="true"]'
      };
      const selector = map[action] || map.trophies;
      const element = document.querySelector(selector) || document.querySelector('#trophyList');
      if (!element) return;

      const sectionBody = element.matches?.('[data-guide-section-content]')
        ? element
        : element.querySelector?.('[data-guide-section-content]') || element.closest?.('[data-guide-section-content]');
      if (sectionBody?.classList.contains('is-collapsed')) {
        const toggle = document.querySelector(`[data-guide-section-toggle="${sectionBody.id}"]`);
        sectionBody.classList.remove('is-collapsed');
        sectionBody.setAttribute('aria-hidden', 'false');
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'true');
          const label = toggle.querySelector('[data-toggle-label]');
          if (label) label.textContent = toggle.dataset.expandedLabel || 'Ocultar detalhes';
          const icon = toggle.querySelector('i');
          if (icon) {
            icon.classList.add('fa-chevron-up');
            icon.classList.remove('fa-chevron-down');
          }
        }
      }

      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (selector === '#trophySearch') {
        window.setTimeout(() => {
          element.focus({ preventScroll: true });
          if (typeof element.select === 'function') element.select();
        }, 280);
      }
      if (selector === '[data-next-focus="true"]') {
        element.classList.add('ring-2', 'ring-atlas-300');
        window.setTimeout(() => element.classList.remove('ring-2', 'ring-atlas-300'), 1800);
      }
    }

    function isMobileQuickDock() {
      return typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 767px)').matches
        : window.innerWidth <= 767;
    }

    function hasScrolledPastGuideHero() {
      const hero = document.querySelector('#guideHeader');
      if (!hero) return false;
      const topbarHeight = document.querySelector('.atlas-topbar')?.getBoundingClientRect?.().height || 0;
      return hero.getBoundingClientRect().bottom <= topbarHeight + 16;
    }

    function hasReachedGuideChecklist() {
      const checklist = document.querySelector('#guideChecklistPanel') || document.querySelector('#trophyList');
      if (!checklist) return false;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      return checklist.getBoundingClientRect().top <= Math.max(128, viewportHeight * 0.82);
    }

    function hasMobileQuickDockTrigger() {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      return scrollY > 160 || hasReachedGuideChecklist();
    }

    function hasReachedGuideEnd() {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const footer = document.querySelector('footer');
      if (footer && footer.getBoundingClientRect().top <= viewportHeight + 18) return true;
      const relatedPanel = document.querySelector('#guideRelatedPanel');
      if (!relatedPanel) return false;
      return relatedPanel.getBoundingClientRect().bottom <= viewportHeight + 96;
    }

    function isGuideQuickDockEnabled() {
      return page === 'public' && Boolean(state.currentGame) && !UI.qs('#view-guide')?.classList.contains('hidden');
    }

    function requestGuideQuickDockSync() {
      if (quickDockScrollFrame) return;
      const schedule = window.requestAnimationFrame || (callback => window.setTimeout(callback, 16));
      quickDockScrollFrame = schedule(() => {
        quickDockScrollFrame = null;
        syncGuideQuickDock();
      });
    }

    function bindGuideQuickDockAutoSync() {
      if (quickDockListenersBound || typeof window === 'undefined') return;
      quickDockListenersBound = true;
      window.addEventListener('scroll', requestGuideQuickDockSync, { passive: true });
      window.addEventListener('resize', requestGuideQuickDockSync);
    }

    function syncGuideQuickDock() {
      if (page !== 'public') {
        UI.setGuideQuickDockState({ enabled: false, visible: false });
        return;
      }
      bindGuideQuickDockAutoSync();
      const enabled = isGuideQuickDockEnabled();
      const mobile = isMobileQuickDock();
      const visible = enabled && !state.quickDockDismissed && !hasReachedGuideEnd() && (mobile ? hasMobileQuickDockTrigger() : hasScrolledPastGuideHero());
      UI.setGuideQuickDockState({ enabled, visible, collapsed: mobile && state.quickDockCollapsed !== false });
    }

    function handleGuideQuickDockClick(event) {
      const closeButton = event.target.closest('[data-quick-dock-close]');
      if (closeButton) {
        event.preventDefault();
        state.quickDockDismissed = true;
        syncGuideQuickDock();
        return;
      }

      const collapseButton = event.target.closest('[data-quick-dock-toggle]');
      if (collapseButton) {
        event.preventDefault();
        state.quickDockCollapsed = !collapseButton.closest('#guideQuickDock')?.classList.contains('is-collapsed');
        syncGuideQuickDock();
        return;
      }

      const actionButton = event.target.closest('[data-guide-action]');
      if (actionButton) {
        event.preventDefault();
        focusGuideAction(actionButton.dataset.guideAction || 'trophies');
        if (isMobileQuickDock()) {
          state.quickDockCollapsed = true;
          syncGuideQuickDock();
        }
        return;
      }
      const topButton = event.target.closest('[data-scroll-top]');
      if (topButton) {
        event.preventDefault();
        state.quickDockCollapsed = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        syncGuideQuickDock();
      }
    }

    return {
      renderCurrentGuide,
      loadGuideBySlug,
      loadGuideByName,
      toggleTrophy,
      loadFromLibrary,
      focusGuideAction,
      syncGuideQuickDock,
      handleGuideQuickDockClick
    };
  }

  return {
    createGuideController
  };
})();
