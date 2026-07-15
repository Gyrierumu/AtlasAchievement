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

    function resolveGuideTabFromHash(hash = window.location.hash) {
      return UI.resolveGuideTabFromHash?.(hash) || null;
    }

    function getDecodedHashId(hash = window.location.hash) {
      return UI.resolveGuideHashTargetId?.(hash) || '';
    }

    function expandCollapsedGuideAncestor(element) {
      const sectionBody = element?.matches?.('[data-guide-section-content]')
        ? element
        : element?.querySelector?.('[data-guide-section-content]') || element?.closest?.('[data-guide-section-content]');
      if (!sectionBody?.classList?.contains('is-collapsed')) return;
      const toggle = document.querySelector(`[data-guide-section-toggle="${sectionBody.id}"]`);
      sectionBody.classList.remove('is-collapsed');
      sectionBody.hidden = false;
      sectionBody.setAttribute('aria-hidden', 'false');
      if (!toggle) return;
      toggle.setAttribute('aria-expanded', 'true');
      const label = toggle.querySelector('[data-toggle-label]');
      if (label) label.textContent = toggle.dataset.expandedLabel || 'Ocultar detalhes';
      const icon = toggle.querySelector('i');
      if (icon) {
        icon.classList.add('fa-chevron-up');
        icon.classList.remove('fa-chevron-down');
      }
    }

    function scrollCurrentGuideHashTarget() {
      const targetId = getDecodedHashId();
      if (!targetId) return;
      const element = document.getElementById(targetId);
      if (!element) return;
      expandCollapsedGuideAncestor(element);
      const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
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
      const hashGuideTab = !options.preserveChecklistState ? resolveGuideTabFromHash() : null;
      const hasGuideHash = !options.preserveChecklistState && Boolean(window.location.hash);
      const activeGuideTab = hashGuideTab || state.activeGuideTab || 'summary';
      UI.renderGuide(state.currentGame, {
        completedTrophies: renderModel.completedTrophies,
        isSaved: renderModel.isSaved,
        libraryEntry: renderModel.libraryEntry,
        relatedGames: renderModel.relatedGames,
        storageLabel: isAccountLibrary?.() ? 'Salvo na conta' : 'Salvo neste navegador',
        activeGuideTab
      });
      window.AppGuideComments?.renderForGuide?.(state.currentGame, state.userSession);
      state.checklistDensity = UI.applyChecklistDensity?.(state.checklistDensity) || state.checklistDensity;
      UI.setPageMeta(state.currentGame);
      navigate('guide', { ...options, game: state.currentGame, skipHistory: options.skipHistory });
      if (!options.preserveChecklistState) {
        UI.clearTrophySearch();
        state.guideSearch = '';
        state.activeGuideTab = activeGuideTab;
        UI.activateGuideTab?.(activeGuideTab, { scroll: Boolean(hashGuideTab) });
        if (hasGuideHash) {
          const schedule = window.requestAnimationFrame || (callback => window.setTimeout(callback, 0));
          schedule(() => scrollCurrentGuideHashTarget());
          window.setTimeout(scrollCurrentGuideHashTarget, 120);
        }
      }
      UI.applyTrophyFilter(state.activeFilter, state.guideSearch);
      if (UI.has('#guideDecisionStack')) UI.qs('#guideDecisionStack').classList.remove('hidden');
      if (UI.has('#guideTabsSlot')) UI.qs('#guideTabsSlot').classList.remove('hidden');
      if (UI.has('#guideContent')) UI.qs('#guideContent').classList.remove('hidden');
      UI.syncGuideNavigationOffsets?.();
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

    function normalizeTrophySignal(value = '') {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    }

    function getTrophyId(trophy = {}) {
      return String(trophy?.id || trophy?.trophy_code || trophy?.trophyCode || trophy?.code || '').trim();
    }

    function isPlatinumTrophy(trophy = {}) {
      const structuredSignals = [
        trophy.type,
        trophy.rank,
        trophy.rarity,
        trophy.tier,
        trophy.trophyType,
        trophy.trophy_type,
        trophy.category
      ].map(normalizeTrophySignal);

      if (structuredSignals.some(value => value === 'platinum' || value === 'platina')) return true;

      const fallbackSignals = [
        trophy.name,
        trophy.name_pt,
        trophy.trophyNameOriginal,
        trophy.trophyNamePtBr
      ].map(normalizeTrophySignal);

      return fallbackSignals.some(value => value === 'platinum' || value === 'platina');
    }

    function isBaseTrophy(trophy = {}) {
      const scopeSignals = [
        trophy.scope,
        trophy.list,
        trophy.listType,
        trophy.list_type,
        trophy.group,
        trophy.groupName,
        trophy.dlc,
        trophy.dlcName,
        trophy.dlc_name,
        trophy.pack,
        trophy.packName,
        trophy.pack_name
      ].map(normalizeTrophySignal);
      const hasDlcBoolean = trophy.is_dlc === true
        || trophy.isDlc === true
        || trophy.dlc_required === true
        || trophy.dlcRequired === true;
      const hasDlcScope = scopeSignals.some(value => value && value !== 'base' && value !== 'base game' && value !== 'jogo base' && value.includes('dlc'));
      return !hasDlcBoolean && !hasDlcScope;
    }

    function getPlatinumSyncModel(game = {}) {
      const trophies = (Array.isArray(game?.trophies) ? game.trophies : [])
        .map(trophy => ({ ...trophy, id: getTrophyId(trophy) }))
        .filter(trophy => trophy.id);
      const baseTrophies = trophies.filter(isBaseTrophy);
      const platinumTrophies = baseTrophies.filter(isPlatinumTrophy);

      if (platinumTrophies.length > 1) {
        console.warn('[AtlasAchievement] Sincronização de platina ignorada: mais de um troféu de platina detectado.', {
          game: game?.slug || game?.name || '',
          trophies: platinumTrophies.map(trophy => ({ id: trophy.id, name: trophy.name, type: trophy.type }))
        });
        return { enabled: false, reason: 'multiple-platinum', trophies, baseTrophies, platinumTrophies };
      }

      if (platinumTrophies.length !== 1) {
        return { enabled: false, reason: 'no-platinum', trophies, baseTrophies, platinumTrophies };
      }

      const platinumId = platinumTrophies[0].id;
      const baseIds = baseTrophies.map(trophy => trophy.id);
      return {
        enabled: true,
        trophies,
        baseTrophies,
        platinumTrophy: platinumTrophies[0],
        platinumId,
        baseIds,
        nonPlatinumBaseIds: baseIds.filter(id => id !== platinumId)
      };
    }

    function syncAccountTrophyChanges(game, changedIds = [], completed) {
      if (!isAccountLibrary?.() || !game?.id) return;
      const uniqueIds = [...new Set((Array.isArray(changedIds) ? changedIds : [changedIds])
        .map(id => String(id || '').trim())
        .filter(Boolean))];
      if (!uniqueIds.length) return;

      if (completed && uniqueIds.length > 1 && typeof ApiService?.bulkUserProgress === 'function') {
        ApiService.bulkUserProgress(game.id, { completed: uniqueIds }).catch(error => {
          UI.showToast(error.message || 'Não foi possível salvar os troféus na conta.', 'error');
        });
        return;
      }

      uniqueIds.forEach(id => syncTrophyProgress?.(game, id, completed));
    }

    function applyPlatinumChecklistSync(game, toggledId, completedIds, nextCompleted) {
      const syncModel = getPlatinumSyncModel(game);
      if (!syncModel.enabled) {
        return { completed: completedIds, changedIds: [toggledId], feedback: '' };
      }

      const completedSet = new Set(completedIds);
      const isPlatinumToggle = toggledId === syncModel.platinumId;
      let feedback = '';

      if (isPlatinumToggle && nextCompleted) {
        syncModel.baseIds.forEach(id => completedSet.add(id));
        feedback = 'Platina marcada. Todos os troféus base foram concluídos.';
      } else if (isPlatinumToggle && !nextCompleted) {
        completedSet.delete(syncModel.platinumId);
      } else if (!isPlatinumToggle && !nextCompleted) {
        completedSet.delete(syncModel.platinumId);
      } else if (!isPlatinumToggle && nextCompleted) {
        const allNonPlatinumDone = syncModel.nonPlatinumBaseIds.every(id => completedSet.has(id));
        if (allNonPlatinumDone) {
          completedSet.add(syncModel.platinumId);
          feedback = 'Todos os troféus foram marcados. Platina concluída!';
        }
      }

      const changedIds = [
        toggledId,
        ...syncModel.baseIds.filter(id => completedIds.includes(id) !== completedSet.has(id))
      ];

      return {
        completed: [...completedSet].filter(id => syncModel.trophies.some(trophy => trophy.id === id)),
        changedIds: [...new Set(changedIds)].filter(Boolean),
        feedback
      };
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
      const syncResult = applyPlatinumChecklistSync(state.currentGame, trophyKey, completed, nextCompleted);
      const trophy = (Array.isArray(state.currentGame.trophies) ? state.currentGame.trophies : [])
        .find(item => String(item?.id || item?.name || '') === trophyKey);
      window.AtlasAnalytics?.trackChecklistToggle?.({
        gameSlug: getGameSlug(state.currentGame),
        trophyId: trophy?.id || trophyKey,
        trophyName: trophy?.name || '',
        action: nextCompleted ? 'checked' : 'unchecked'
      });
      upsertLibraryEntry(state.currentGame, {
        completed: syncResult.completed,
        lastActivityAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString()
      });
      if (syncResult.changedIds.length) {
        const changedToCompleted = syncResult.completed.includes(syncResult.changedIds[0]);
        syncAccountTrophyChanges(state.currentGame, syncResult.changedIds, changedToCompleted);
      }
      if (syncResult.feedback) {
        UI.showToast(syncResult.feedback, 'success');
      } else {
        UI.showToast(nextCompleted ? 'Troféu marcado no checklist.' : 'Troféu voltou para pendente.', 'success');
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
      const isResidentEvil2 = getGameSlug(state.currentGame) === 'resident-evil-2-remake';
      const tabByAction = {
        header: 'summary',
        usage: isResidentEvil2 ? 'summary' : 'roadmap',
        summary: 'summary',
        quick: 'summary',
        roadmap: 'roadmap',
        'chapter-route': 'roadmap',
        professional: 'roadmap',
        farm: 'roadmap',
        myths: 'roadmap',
        trophies: 'checklist',
        checklist: 'checklist',
        extras: 'extras',
        dlcs: 'dlc',
        search: 'checklist',
        'first-pending': 'checklist',
        risks: 'summary',
        attention: 'attention',
        missables: 'summary',
        online: 'summary',
        dlc: 'summary',
        details: 'attention'
      };
      const externalActions = new Set(['faq', 'feedback', 'comments', 'related']);
      const nextTab = externalActions.has(action) ? state.activeGuideTab || 'summary' : (tabByAction[action] || 'checklist');
      if (!externalActions.has(action)) {
        state.activeGuideTab = nextTab;
        UI.activateGuideTab?.(nextTab, { scroll: false });
        window.AtlasAnalytics?.trackGuideTabChange?.({
          gameSlug: getGameSlug(state.currentGame),
          tabName: nextTab
        });
      }
      const map = {
        header: '#guideHeader',
        usage: '#guideUsagePanel',
        summary: '#guideSummaryActions',
        quick: '#guideQuickPlan',
        roadmap: '#guideRoadmapPanel',
        'chapter-route': '#guideChapterRoutePanel',
        professional: '#guideProfessionalAiPanel',
        farm: '#guideFarmRoutesPanel',
        myths: isResidentEvil2 ? '#mitos-e-erros-comuns' : '#guideCommonMythsPanel',
        extras: '#guidePlatinumExtrasPanel',
        dlcs: '#guideDlcCompletionPanel',
        missables: '#guideQuickCard-missables',
        trophies: '#guideChecklistPanel',
        online: '#guideQuickCard-online',
        dlc: '#guideQuickCard-dlc',
        search: '#trophySearch',
        risks: '#guideRiskSummaryPanel',
        attention: isResidentEvil2 ? '#guideEditorialNotesPanel' : '#guideAttentionPointsPanel',
        faq: '#guideFaqPanel',
        feedback: isResidentEvil2 ? '#guideFeedbackPanel' : '#guideFeedbackSlot',
        comments: '#guideCommentsPanel',
        related: '#guideRelatedPanel',
        'first-pending': '[data-next-focus="true"]'
      };
      const selector = map[action] || map.trophies;
      const element = document.querySelector(selector) || document.querySelector('#guideEditorialNotes') || document.querySelector('#trophyList');
      if (!element) return;
      UI.setGuideSectionActive?.(element.id || selector.replace(/^#/, ''));
      const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const scrollBehavior = reducedMotion ? 'auto' : 'smooth';

      const sectionBody = element.matches?.('[data-guide-section-content]')
        ? element
        : element.querySelector?.('[data-guide-section-content]') || element.closest?.('[data-guide-section-content]');
      if (sectionBody?.classList.contains('is-collapsed')) {
        const toggle = document.querySelector(`[data-guide-section-toggle="${sectionBody.id}"]`);
        sectionBody.classList.remove('is-collapsed');
        sectionBody.hidden = false;
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

      element.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
      const canonicalHashActions = new Set(['summary', 'roadmap', 'trophies', 'checklist', 'extras', 'dlcs', 'attention']);
      const targetHash = canonicalHashActions.has(action) && !isResidentEvil2
        ? UI.getGuideCanonicalHash?.(nextTab) || ''
        : selector.startsWith('#') ? selector : (element.id ? `#${element.id}` : '');
      if (targetHash && window.location.hash !== targetHash) {
        if (window.history?.pushState) window.history.pushState({ guideAction: action }, '', targetHash);
        else window.location.hash = targetHash;
      }
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
      if (selector === '#guideFeedbackSlot' || selector === '#guideFeedbackPanel') {
        window.setTimeout(() => {
          const feedbackButton = element.querySelector?.('[data-guide-feedback-open]');
          feedbackButton?.focus?.({ preventScroll: true });
        }, reducedMotion ? 0 : 280);
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
      quickDockScrollFrame = window.setTimeout(() => {
        quickDockScrollFrame = null;
        syncGuideQuickDock();
      }, 50);
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
        const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
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
