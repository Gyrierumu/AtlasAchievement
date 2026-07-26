window.AppViewBindings = (() => {
  function bindLibraryView({ UI, state, deleteFromLibrary, loadGuideBySlug, loadFromLibrary, isCurrentGameSaved, removeCurrentGameFromLibrary, saveCurrentGameToLibrary, loadCatalogPage, navigate, refreshAccountLibrary }) {
    let activeRemoveConfirmResolve = null;

    function renderLibraryView() {
      UI.renderLibrary(state.library, {
        search: state.librarySearch,
        sort: state.librarySort,
        statusFilter: state.libraryStatus,
        platform: state.libraryPlatform,
        availableGames: state.availableGames,
        storageLabel: state.librarySource === 'account' ? 'Salvo na conta' : 'Salvo neste navegador',
        userSession: state.userSession
      });
    }

    function syncLibraryUrl() {
      if (window.location.pathname !== '/biblioteca') return;
      const params = new URLSearchParams();
      if (String(state.librarySearch || '').trim()) params.set('q', String(state.librarySearch).trim());
      if (state.libraryPlatform && state.libraryPlatform !== 'all') params.set('platform', state.libraryPlatform);
      if (state.libraryStatus && state.libraryStatus !== 'all') params.set('status', state.libraryStatus);
      if (state.librarySort && state.librarySort !== 'recent') params.set('sort', state.librarySort);
      const nextUrl = `/biblioteca${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({ view: 'library' }, '', nextUrl);
    }

    function isAccountLibraryView() {
      return Boolean(state.userSession?.authenticated || state.librarySource === 'account');
    }

    function closeLibraryMenus(exceptCard = null) {
      UI.qsa('#view-library [data-library-game]').forEach(card => {
        if (exceptCard && card === exceptCard) return;
        card.querySelector('[data-library-options-menu]')?.classList.add('hidden');
        card.querySelector('[data-library-options]')?.setAttribute('aria-expanded', 'false');
      });
    }

    function alignLibraryMenu(card, menu) {
      if (!card || !menu || typeof card.getBoundingClientRect !== 'function') return;
      const rect = card.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
      const menuWidth = 190;
      const wouldClipLeft = rect.right - menuWidth < 8;
      const fitsFromLeft = rect.left + menuWidth < viewportWidth - 8;
      menu.classList.toggle('library-game__options-menu--align-left', wouldClipLeft && fitsFromLeft);
    }

    function settleLibraryRemoveConfirm(result = { confirmed: false, keepProgress: false }) {
      const modal = document.querySelector('#libraryRemoveConfirmModal');
      if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
      }
      const resolve = activeRemoveConfirmResolve;
      activeRemoveConfirmResolve = null;
      if (resolve) {
        const payload = typeof result === 'object' && result
          ? result
          : { confirmed: Boolean(result), keepProgress: false };
        resolve(payload);
      }
    }

    function ensureLibraryRemoveConfirmModal() {
      let modal = document.querySelector('#libraryRemoveConfirmModal');
      if (modal) return modal;

      modal = document.createElement('div');
      modal.id = 'libraryRemoveConfirmModal';
      modal.className = 'hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[100] p-4';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'libraryRemoveConfirmTitle');
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="max-w-md mx-auto mt-10 atlas-panel p-6 rounded-[28px] atlas-auth-modal auth-modal">
          <div class="space-y-3">
            <h3 id="libraryRemoveConfirmTitle" class="text-xl font-bold">Remover da biblioteca?</h3>
            <p class="text-sm text-white/58">Este jogo será removido da sua biblioteca. Você poderá adicioná-lo novamente pelo catálogo.</p>
            <p class="text-sm text-white/58" data-library-remove-progress-copy>Escolha se quer manter o progresso salvo para uma futura readição.</p>
            <label class="library-remove-confirm__keep-progress" data-library-keep-progress-row>
              <input type="checkbox" data-library-keep-progress checked>
              <span>Manter progresso/checklist salvo</span>
            </label>
          </div>
          <div class="grid gap-3 mt-5">
            <button type="button" class="atlas-btn atlas-btn-primary auth-modal__submit" data-library-confirm-remove>Remover</button>
            <button type="button" class="atlas-btn atlas-btn-secondary auth-modal__secondary" data-library-cancel-remove>Cancelar</button>
          </div>
        </div>
      `;
      modal.addEventListener('click', event => {
        if (event.target === modal || event.target.closest('[data-library-cancel-remove]')) {
          settleLibraryRemoveConfirm(false);
          return;
        }
        if (event.target.closest('[data-library-confirm-remove]')) {
          const keepProgress = Boolean(modal.querySelector('[data-library-keep-progress]')?.checked);
          settleLibraryRemoveConfirm({ confirmed: true, keepProgress });
        }
      });
      document.body.appendChild(modal);
      return modal;
    }

    function confirmLibraryRemoval() {
      const modal = ensureLibraryRemoveConfirmModal();
      const keepProgressRow = modal.querySelector('[data-library-keep-progress-row]');
      const keepProgressInput = modal.querySelector('[data-library-keep-progress]');
      const progressCopy = modal.querySelector('[data-library-remove-progress-copy]');
      const canKeepProgress = isAccountLibraryView();
      if (keepProgressRow) keepProgressRow.hidden = !canKeepProgress;
      if (keepProgressInput) keepProgressInput.checked = canKeepProgress;
      if (progressCopy) {
        progressCopy.textContent = canKeepProgress
          ? 'Escolha se quer manter o progresso salvo para uma futura readição.'
          : 'O progresso local fica no próprio item e será removido junto com ele.';
      }
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
      window.setTimeout(() => modal.querySelector('[data-library-confirm-remove]')?.focus(), 30);
      return new Promise(resolve => {
        activeRemoveConfirmResolve = resolve;
      });
    }

    UI.qs('#view-library')?.addEventListener('click', async event => {
      const catalogLink = event.target.closest('[data-library-catalog-link]');
      if (catalogLink) {
        event.preventDefault();
        closeLibraryMenus();
        state.catalogFacet = 'all';
        state.catalogPage = 1;
        if (typeof loadCatalogPage === 'function') {
          await loadCatalogPage({ page: 1, facet: 'all' });
        }
        if (typeof navigate === 'function') {
          navigate('catalog', { resetScroll: true });
          return;
        }
        window.location.href = catalogLink.getAttribute('href') || '/catalogo';
        return;
      }

      const clearSearchButton = event.target.closest('[data-library-clear-search]');
      if (clearSearchButton) {
        event.preventDefault();
        state.librarySearch = '';
        const searchInput = UI.qs('#librarySearch');
        if (searchInput) searchInput.value = '';
        closeLibraryMenus();
        renderLibraryView();
        syncLibraryUrl();
        searchInput?.focus();
        return;
      }

      const clearFiltersButton = event.target.closest('[data-library-clear-filters]');
      if (clearFiltersButton) {
        event.preventDefault();
        state.librarySearch = '';
        state.libraryPlatform = 'all';
        state.libraryStatus = 'all';
        state.librarySort = 'recent';
        const searchInput = UI.qs('#librarySearch');
        const platformInput = UI.qs('#libraryPlatform');
        const statusInput = UI.qs('#libraryStatus');
        const sortInput = UI.qs('#librarySort');
        if (searchInput) searchInput.value = '';
        if (platformInput) platformInput.value = 'all';
        if (statusInput) statusInput.value = 'all';
        if (sortInput) sortInput.value = 'recent';
        closeLibraryMenus();
        renderLibraryView();
        syncLibraryUrl();
        searchInput?.focus();
        return;
      }

      const retryButton = event.target.closest('[data-library-retry]');
      if (retryButton) {
        event.preventDefault();
        retryButton.disabled = true;
        retryButton.setAttribute('aria-busy', 'true');
        try {
          if (typeof refreshAccountLibrary === 'function' && isAccountLibraryView()) {
            await refreshAccountLibrary({ silent: false });
          } else {
            renderLibraryView();
          }
        } finally {
          retryButton.disabled = false;
          retryButton.removeAttribute('aria-busy');
        }
        return;
      }

      const statusButton = event.target.closest('[data-library-status]');
      if (statusButton) {
        event.preventDefault();
        event.stopPropagation();
        state.libraryStatus = statusButton.dataset.libraryStatus || 'all';
        const statusInput = UI.qs('#libraryStatus');
        if (statusInput) statusInput.value = state.libraryStatus;
        closeLibraryMenus();
        renderLibraryView();
        syncLibraryUrl();
        return;
      }

      const optionsButton = event.target.closest('[data-library-options]');
      if (optionsButton) {
        event.preventDefault();
        event.stopPropagation();
        const card = optionsButton.closest('[data-library-game]');
        const menu = card?.querySelector('[data-library-options-menu]');
        const expanded = menu?.classList.contains('hidden');
        closeLibraryMenus(card);
        if (menu) {
          alignLibraryMenu(card, menu);
          menu.classList.toggle('hidden', !expanded);
        }
        optionsButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        return;
      }

      const deleteButton = event.target.closest('[data-delete-game]');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        closeLibraryMenus();
        return confirmLibraryRemoval().then(decision => {
          if (!decision.confirmed) return null;
          return deleteFromLibrary(deleteButton.dataset.deleteGame, { keepProgress: decision.keepProgress });
        });
      }

      const openButton = event.target.closest('[data-open-game]');
      if (openButton) {
        event.preventDefault();
        closeLibraryMenus();
        const slug = openButton.dataset.openSlug || '';
        const name = openButton.dataset.openGame || '';
        if (slug) return loadGuideBySlug(slug);
        if (name) return loadFromLibrary(name);
      }

      const card = event.target.closest('[data-library-game]');
      if (card && !event.target.closest('[data-delete-game], [data-toggle-save-game], [data-library-options], [data-open-game], button, a')) {
        closeLibraryMenus();
        loadFromLibrary(card.dataset.libraryGame);
      }
    });

    UI.qs('#view-library')?.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (activeRemoveConfirmResolve) settleLibraryRemoveConfirm(false);
        closeLibraryMenus();
        return;
      }
      const card = event.target.closest('[data-library-game]');
      if (!card || event.target !== card || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      loadFromLibrary(card.dataset.libraryGame);
    });

    UI.qs('#librarySearch')?.addEventListener('input', event => {
      state.librarySearch = event.target.value || '';
      closeLibraryMenus();
      renderLibraryView();
      syncLibraryUrl();
    });

    UI.qs('#librarySort')?.addEventListener('change', event => {
      state.librarySort = event.target.value || 'recent';
      closeLibraryMenus();
      renderLibraryView();
      syncLibraryUrl();
    });

    UI.qs('#libraryPlatform')?.addEventListener('change', event => {
      state.libraryPlatform = event.target.value || 'all';
      closeLibraryMenus();
      renderLibraryView();
      syncLibraryUrl();
    });

    UI.qs('#libraryStatus')?.addEventListener('change', event => {
      state.libraryStatus = event.target.value || 'all';
      closeLibraryMenus();
      renderLibraryView();
      syncLibraryUrl();
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('#view-library [data-library-game]')) closeLibraryMenus();
      const saveButton = event.target.closest('[data-toggle-save-game]');
      if (!saveButton) return;
      event.preventDefault();
      if (isCurrentGameSaved()) removeCurrentGameFromLibrary();
      else saveCurrentGameToLibrary();
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (activeRemoveConfirmResolve) settleLibraryRemoveConfirm(false);
      closeLibraryMenus();
    });
  }

  function bindCatalogView({ UI, state, loadCatalogPage, navigate, loadGuideBySlug, rerenderCatalogView, toggleCatalogCompare, clearCatalogCompare, setCatalogIntent }) {
    let catalogSearchTimer = null;
    const catalogSearchFields = () => [
      UI.qs('#catalogSearch'),
      UI.qs('#catalogHeaderSearch')
    ].filter(Boolean);

    const syncCatalogSearchFields = value => {
      catalogSearchFields().forEach(field => {
        if (field.value !== value) field.value = value;
      });
    };

    const syncCatalogSearchClear = () => {
      const clearButton = UI.qs('.atlas-catalog-search-clear');
      if (!clearButton) return;
      const hasSearch = Boolean(String(state.catalogSearch || '').trim());
      clearButton.hidden = !hasSearch;
      clearButton.setAttribute('aria-hidden', hasSearch ? 'false' : 'true');
    };

    const syncCatalogUrl = () => {
      const path = window.AppCatalog?.getCatalogPath?.(state.catalogFacet || 'all') || '/catalogo';
      const params = new URLSearchParams();
      if (String(state.catalogSearch || '').trim()) params.set('q', String(state.catalogSearch).trim());
      if (state.catalogPlatform && state.catalogPlatform !== 'all') params.set('platform', state.catalogPlatform);
      if (state.catalogStatus && state.catalogStatus !== 'all') params.set('status', state.catalogStatus);
      if (state.catalogSort && state.catalogSort !== 'recommended-desc') params.set('sort', state.catalogSort);
      const query = params.toString();
      window.history.replaceState(window.history.state, '', `${path}${query ? `?${query}` : ''}`);
    };

    const loadNextCatalogPage = async trigger => {
      if (state.catalogLoadingMore) return;
      const currentPage = Number(state.catalogResponse?.pagination?.page || state.catalogPage || 1);
      const totalPages = Number(state.catalogResponse?.pagination?.totalPages || currentPage);
      if (currentPage >= totalPages) return;

      const nextPage = Number(trigger?.dataset?.nextPage || currentPage + 1);
      const originalText = trigger?.textContent || 'Carregar mais guias';
      state.catalogLoadingMore = true;
      if (trigger) {
        trigger.setAttribute('aria-disabled', 'true');
        trigger.setAttribute('aria-busy', 'true');
        trigger.textContent = 'Carregando guias...';
      }
      UI.renderCatalogLoadingSkeletons?.(4);

      try {
        await loadCatalogPage({ page: nextPage, append: true });
        syncCatalogUrl();
      } catch (error) {
        UI.clearCatalogLoadingSkeletons?.();
        const errorState = UI.qs('#catalogLoadError');
        if (errorState) errorState.hidden = false;
      } finally {
        state.catalogLoadingMore = false;
        if (trigger?.isConnected) {
          trigger.removeAttribute('aria-disabled');
          trigger.removeAttribute('aria-busy');
          trigger.textContent = originalText;
        }
      }
    };

    const loadCatalogSearch = async value => {
      state.catalogSearch = String(value || '');
      state.catalogPage = 1;
      setCatalogIntent('all');
      syncCatalogSearchFields(state.catalogSearch);
      syncCatalogSearchClear();
      const response = await loadCatalogPage({ page: 1, search: state.catalogSearch });
      syncCatalogUrl();
      window.AtlasAnalytics?.trackCatalogSearch?.({
        searchTerm: state.catalogSearch,
        resultsCount: Number(response?.pagination?.total || 0)
      });
    };

    syncCatalogSearchFields(state.catalogSearch || '');
    syncCatalogSearchClear();

    catalogSearchFields().forEach(field => {
      field.addEventListener('input', event => {
        const value = event.target.value || '';
        syncCatalogSearchFields(value);
        window.clearTimeout(catalogSearchTimer);
        catalogSearchTimer = window.setTimeout(() => {
          loadCatalogSearch(value).catch(() => {
            const error = UI.qs('#catalogLoadError');
            if (error) error.hidden = false;
          });
        }, 350);
      });
    });

    [UI.qs('#catalogMobileSearchForm'), UI.qs('#catalogHeaderSearchForm')].filter(Boolean).forEach(form => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        window.clearTimeout(catalogSearchTimer);
        const field = form.querySelector('input[type="search"]');
        await loadCatalogSearch(field?.value || '');
      });
    });

    UI.qs('#catalogSort')?.addEventListener('change', async event => {
      state.catalogSort = event.target.value || 'recommended-desc';
      state.catalogPage = 1;
      await loadCatalogPage({ page: 1 });
      syncCatalogUrl();
    });

    UI.qs('#catalogDifficultyFilter')?.addEventListener('change', async event => {
      setCatalogIntent('all');
      state.catalogFacet = event.target.value || 'all';
      state.catalogPage = 1;
      await loadCatalogPage({ page: 1, facet: state.catalogFacet });
      navigate('catalog', { facet: state.catalogFacet });
      syncCatalogUrl();
    });

    UI.qs('#catalogPlatformFilter')?.addEventListener('change', async event => {
      state.catalogPlatform = event.target.value || 'all';
      state.catalogPage = 1;
      await loadCatalogPage({ page: 1, platform: state.catalogPlatform });
      syncCatalogUrl();
    });

    UI.qs('#catalogStatusFilter')?.addEventListener('change', async event => {
      state.catalogStatus = event.target.value || 'all';
      state.catalogPage = 1;
      await loadCatalogPage({ page: 1, status: state.catalogStatus });
      syncCatalogUrl();
    });

    UI.qs('#view-catalog')?.addEventListener('click', async event => {
      const loadMoreButton = event.target.closest('[data-catalog-load-more]');
      if (loadMoreButton) {
        event.preventDefault();
        await loadNextCatalogPage(loadMoreButton);
        return;
      }

      const retryButton = event.target.closest('[data-catalog-retry]');
      if (retryButton) {
        event.preventDefault();
        const errorState = UI.qs('#catalogLoadError');
        if (errorState) errorState.hidden = true;
        const currentPage = Number(state.catalogResponse?.pagination?.page || state.catalogPage || 1);
        const totalPages = Number(state.catalogResponse?.pagination?.totalPages || currentPage);
        if (currentPage < totalPages) {
          await loadNextCatalogPage(UI.qs('[data-catalog-load-more]'));
        } else {
          await loadCatalogPage({ page: 1 });
          syncCatalogUrl();
        }
        return;
      }

      const removeFilterButton = event.target.closest('[data-catalog-remove-filter]');
      if (removeFilterButton) {
        event.preventDefault();
        const filter = removeFilterButton.dataset.catalogRemoveFilter;
        if (filter === 'platform') {
          state.catalogPlatform = 'all';
          const field = UI.qs('#catalogPlatformFilter');
          if (field) field.value = 'all';
        }
        if (filter === 'status') {
          state.catalogStatus = 'all';
          const field = UI.qs('#catalogStatusFilter');
          if (field) field.value = 'all';
        }
        state.catalogPage = 1;
        await loadCatalogPage({
          page: 1,
          platform: state.catalogPlatform,
          status: state.catalogStatus
        });
        syncCatalogUrl();
        return;
      }

      const intentButton = event.target.closest('[data-catalog-intent]');
      if (intentButton) {
        event.preventDefault();
        const intent = intentButton.dataset.catalogIntent || 'all';
        const facet = intentButton.dataset.intentFacet || 'all';
        const sort = intentButton.dataset.intentSort || 'recommended-desc';
        setCatalogIntent(intent);
        state.catalogFacet = facet;
        state.catalogSort = sort;
        state.catalogPage = 1;
        const sortField = UI.qs('#catalogSort');
        if (sortField) sortField.value = sort;
        const response = await loadCatalogPage({ page: 1, facet, sort });
        window.AtlasAnalytics?.trackCatalogFilterUsed?.({
          facet,
          resultsCount: response
        });
        navigate('catalog', { facet });
        syncCatalogUrl();
        return;
      }

      const compareToggle = event.target.closest('[data-compare-toggle]');
      if (compareToggle) {
        event.preventDefault();
        event.stopPropagation();
        toggleCatalogCompare(compareToggle.dataset.compareToggle || '');
        return;
      }

      const clearCompareButton = event.target.closest('[data-clear-compare]');
      if (clearCompareButton) {
        event.preventDefault();
        clearCatalogCompare();
        return;
      }

      const clearSearchButton = event.target.closest('[data-catalog-clear-search]');
      if (clearSearchButton) {
        event.preventDefault();
        state.catalogSearch = '';
        state.catalogPage = 1;
        syncCatalogSearchFields('');
        syncCatalogSearchClear();
        await loadCatalogPage({ page: 1, search: '' });
        navigate('catalog', { facet: state.catalogFacet || 'all' });
        syncCatalogUrl();
        return;
      }

      const clearFiltersButton = event.target.closest('[data-catalog-clear-filters]');
      if (clearFiltersButton) {
        event.preventDefault();
        setCatalogIntent('all');
        state.catalogFacet = 'all';
        state.catalogSearch = '';
        state.catalogPlatform = 'all';
        state.catalogStatus = 'all';
        state.catalogSort = 'recommended-desc';
        state.catalogPage = 1;
        syncCatalogSearchFields('');
        const difficultyField = UI.qs('#catalogDifficultyFilter');
        const platformField = UI.qs('#catalogPlatformFilter');
        const statusField = UI.qs('#catalogStatusFilter');
        const sortField = UI.qs('#catalogSort');
        if (difficultyField) difficultyField.value = 'all';
        if (platformField) platformField.value = 'all';
        if (statusField) statusField.value = 'all';
        if (sortField) sortField.value = 'recommended-desc';
        syncCatalogSearchClear();
        await loadCatalogPage({
          page: 1,
          facet: 'all',
          search: '',
          platform: 'all',
          status: 'all',
          sort: 'recommended-desc'
        });
        navigate('catalog', { facet: 'all' });
        syncCatalogUrl();
        return;
      }

      const compareOpenButton = event.target.closest('[data-compare-open]');
      if (compareOpenButton) {
        event.preventDefault();
        const slug = compareOpenButton.dataset.compareOpen || '';
        if (slug) {
          window.AtlasAnalytics?.trackGameCardClick?.({
            element: compareOpenButton,
            gameSlug: slug,
            origin: 'catalog'
          });
          await loadGuideBySlug(slug, { analyticsSource: 'catalog' });
        }
        return;
      }

      const facetButton = event.target.closest('[data-catalog-facet]');
      if (facetButton) {
        event.preventDefault();
        setCatalogIntent('all');
        state.catalogFacet = facetButton.dataset.catalogFacet || 'all';
        state.catalogPage = 1;
        const response = await loadCatalogPage({ page: 1, facet: state.catalogFacet });
        window.AtlasAnalytics?.trackCatalogFilterUsed?.({
          facet: state.catalogFacet,
          resultsCount: response
        });
        const difficultyField = UI.qs('#catalogDifficultyFilter');
        if (difficultyField) difficultyField.value = ['difficulty-low', 'difficulty-mid', 'difficulty-high'].includes(state.catalogFacet)
          ? state.catalogFacet
          : 'all';
        navigate('catalog', { facet: state.catalogFacet });
        syncCatalogUrl();
        return;
      }

      const gameLink = event.target.closest('[data-open-guide-card]');
      if (!gameLink || event.target.closest('button')) return;
      event.preventDefault();
      const slug = gameLink.dataset.gameSlug || gameLink.dataset.openGuideCard || decodeURIComponent(((gameLink.getAttribute('href') || '').split('/jogo/')[1] || '').trim());
      if (slug) {
        const origin = window.AtlasAnalytics?.getInteractionOrigin?.(gameLink)
          || (window.location.pathname.startsWith('/platinas-') || window.location.pathname === '/comece-aqui' ? 'seo_page' : 'catalog');
        window.AtlasAnalytics?.trackGameCardClick?.({
          element: gameLink,
          gameSlug: slug,
          origin
        });
        await loadGuideBySlug(slug, { analyticsSource: origin });
      }
    });
  }

  const bindPaginationControls = window.AppPagination?.bindPaginationControls || (() => {});

  return {
    bindLibraryView,
    bindCatalogView,
    bindPaginationControls
  };
})();
