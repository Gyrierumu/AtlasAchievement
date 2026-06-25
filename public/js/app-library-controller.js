window.AppLibraryController = (() => {
  function createLibraryController({ UI, ApiService, state, StorageService, getLibraryKeyFromModule, buildLibraryStatus, normalizeLibraryEntryFromModule, findLibraryEntryByGameIdentity, resolveLibraryKeyFromModule }) {
    function getLibraryKey(game) {
      return getLibraryKeyFromModule(game, StorageService.normalizeKey);
    }

    function isAccountLibrary() {
      return Boolean(state.userSession?.authenticated);
    }

    function getStorageLabel() {
      return isAccountLibrary() ? 'Salvo na conta' : 'Salvo neste navegador';
    }

    function renderLibraryView() {
      UI.updateLibraryBadge(state.library);
      UI.renderHomeOverview(state.availableGames, state.library);
      UI.renderLibrary(state.library, {
        search: state.librarySearch,
        sort: state.librarySort,
        statusFilter: state.libraryStatus,
        availableGames: state.availableGames,
        storageLabel: getStorageLabel()
      });
    }

    function persistLibrary() {
      if (!isAccountLibrary()) {
        StorageService.saveLibrary(state.library);
        state.librarySource = 'local';
      }
      renderLibraryView();
    }

    function normalizeLibraryEntry(game, options = {}) {
      return normalizeLibraryEntryFromModule(game, state.library, StorageService.normalizeKey, options);
    }

    function upsertLibraryEntry(game, options = {}) {
      const key = getLibraryKey(game);
      const entry = normalizeLibraryEntry(game, options);
      state.library[key] = entry;
      persistLibrary();
      if (isAccountLibrary() && game?.id && !Array.isArray(options.completed) && options.skipRemoteUpdate !== true) {
        const payload = {
          game_id: game.id,
          status: entry.status,
          last_opened_at: entry.lastOpenedAt || new Date().toISOString()
        };
        ApiService.addUserLibrary(payload).catch(error => {
          UI.showToast(error.message || 'Não foi possível salvar na conta.', 'error');
        });
      }
      return entry;
    }

    function resolveLibraryKey(rawKey = '') {
      return resolveLibraryKeyFromModule(state.library, rawKey, StorageService.normalizeKey);
    }

    function syncLibraryIdentityForGame(game) {
      if (!game) return null;
      const currentKey = getLibraryKey(game);
      if (state.library[currentKey]) return state.library[currentKey];

      const match = findLibraryEntryByGameIdentity(state.library, game);
      if (!match) return null;

      const [legacyKey, legacyEntry] = match;
      if (legacyKey !== currentKey) delete state.library[legacyKey];

      const syncedEntry = normalizeLibraryEntry({ ...legacyEntry, ...game }, {
        completed: Array.isArray(legacyEntry?.completed) ? legacyEntry.completed : [],
        savedAt: legacyEntry?.savedAt,
        lastOpenedAt: legacyEntry?.lastOpenedAt,
        lastActivityAt: legacyEntry?.lastActivityAt,
        status: legacyEntry?.status
      });

      state.library[currentKey] = syncedEntry;
      persistLibrary();
      return syncedEntry;
    }

    async function applyAccountPayload(response = {}) {
      if (response.library && typeof response.library === 'object') {
        state.library = response.library;
      }
      state.accountStats = response.stats || null;
      state.librarySource = 'account';
      renderLibraryView();
      return response;
    }

    function restoreLocalLibrary() {
      state.library = StorageService.getLibrary();
      state.accountStats = null;
      state.librarySource = 'local';
      renderLibraryView();
      return state.library;
    }

    function getImportUserKey() {
      const user = state.userSession?.user || {};
      return user.username || user.email || user.id || 'anon';
    }

    function getLocalImportCandidates(localLibrary = StorageService.getLibrary()) {
      return Object.values(localLibrary || {}).filter(entry => entry && (entry.id || entry.slug || entry.name));
    }

    function showImportPrompt(localLibrary = StorageService.getLibrary()) {
      const modal = document.querySelector('#libraryImportModal');
      if (!modal) return;
      const candidates = getLocalImportCandidates(localLibrary);
      if (!candidates.length) return;
      state.pendingLocalImport = localLibrary;
      const count = document.querySelector('#libraryImportCount');
      if (count) {
        count.textContent = `${candidates.length} jogo(s) salvo(s) neste navegador`;
      }
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
      modal.removeAttribute('inert');
    }

    function closeImportPrompt() {
      const modal = document.querySelector('#libraryImportModal');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
      modal.setAttribute('inert', '');
    }

    function maybePromptLocalImport() {
      if (!isAccountLibrary()) return;
      const localLibrary = StorageService.getLibrary();
      const candidates = getLocalImportCandidates(localLibrary);
      if (!candidates.length) return;
      const decision = StorageService.getImportDecision(getImportUserKey());
      if (decision) return;
      showImportPrompt(localLibrary);
    }

    async function refreshAccountLibrary(options = {}) {
      if (!isAccountLibrary()) return restoreLocalLibrary();
      try {
        const response = await ApiService.getUserLibrary();
        await applyAccountPayload(response);
        if (options.promptImport) maybePromptLocalImport();
        return response;
      } catch (error) {
        if (error.status === 401) {
          restoreLocalLibrary();
          return null;
        }
        if (!options.silent) {
          UI.showToast(error.message || 'Não foi possível carregar biblioteca da conta.', 'error');
        }
        return null;
      }
    }

    function resolveGameIdForImport(entry = {}) {
      const id = Number(entry.id || entry.game_id || entry.gameId || 0);
      if (Number.isInteger(id) && id > 0) return id;
      const key = String(entry.slug || entry.name || '').trim().toLowerCase();
      if (!key) return null;
      const match = (state.availableGames || []).find(game => {
        return String(game?.slug || '').toLowerCase() === key
          || String(game?.name || '').toLowerCase() === key;
      });
      return match?.id || null;
    }

    async function importLocalLibraryToAccount(localLibrary = state.pendingLocalImport || StorageService.getLibrary()) {
      if (!isAccountLibrary()) return null;
      const entries = getLocalImportCandidates(localLibrary);
      let importedGames = 0;
      let importedTrophies = 0;
      for (const entry of entries) {
        const gameId = resolveGameIdForImport(entry);
        if (!gameId) continue;
        await ApiService.addUserLibrary({
          game_id: gameId,
          status: entry.status || 'saved',
          last_opened_at: entry.lastOpenedAt || entry.lastActivityAt || entry.savedAt || new Date().toISOString()
        });
        importedGames += 1;

        const completed = Array.isArray(entry.completed) ? entry.completed : [];
        if (completed.length) {
          await ApiService.bulkUserProgress(gameId, { completed });
          importedTrophies += completed.length;
        }
      }

      StorageService.setImportDecision(getImportUserKey(), 'imported');
      closeImportPrompt();
      await refreshAccountLibrary({ silent: true });
      UI.showToast(importedGames
        ? `Progresso importado: ${importedGames} jogo(s), ${importedTrophies} troféu(s).`
        : 'Não encontramos jogos compatíveis para importar.', importedGames ? 'success' : 'error');
      return { importedGames, importedTrophies };
    }

    function keepLocalLibraryForLater() {
      StorageService.setImportDecision(getImportUserKey(), 'keep-local');
      closeImportPrompt();
      UI.showToast('Progresso local mantido neste navegador.', 'success');
    }

    function ignoreLocalImport() {
      StorageService.setImportDecision(getImportUserKey(), 'ignored');
      closeImportPrompt();
    }

    async function syncTrophyProgress(game, trophyId, completed) {
      if (!isAccountLibrary() || !game?.id || !trophyId) return null;
      try {
        return await ApiService.updateUserProgress(game.id, trophyId, { completed: Boolean(completed) });
      } catch (error) {
        UI.showToast(error.message || 'Não foi possível salvar o troféu na conta.', 'error');
        return null;
      }
    }

    async function removeCurrentGameFromLibrary() {
      if (!state.currentGame) return;
      const key = getLibraryKey(state.currentGame);
      if (!state.library[key]) return;

      if (isAccountLibrary() && state.currentGame.id) {
        try {
          const response = await ApiService.removeUserLibrary(state.currentGame.id);
          await applyAccountPayload(response);
        } catch (error) {
          UI.showToast(error.message || 'Não foi possível remover o jogo. Tente novamente.', 'error');
          return;
        }
      } else {
        delete state.library[key];
        persistLibrary();
      }

      delete state.library[key];
      if (state.currentGame) {
        UI.renderGuide(state.currentGame, { completedTrophies: [], isSaved: false, libraryEntry: null });
        UI.applyTrophyFilter(state.activeFilter, state.guideSearch);
      }
      UI.showToast('Jogo removido da biblioteca.', 'success');
    }

    async function saveCurrentGameToLibrary(renderCurrentGuide) {
      if (!state.currentGame) return;
      const existing = state.library[getLibraryKey(state.currentGame)];
      const entryOptions = {
        savedAt: existing?.savedAt,
        lastOpenedAt: new Date().toISOString(),
        lastActivityAt: existing?.lastActivityAt || new Date().toISOString(),
        status: buildLibraryStatus(existing?.progress || 0)
      };

      if (isAccountLibrary() && state.currentGame.id) {
        try {
          const response = await ApiService.addUserLibrary({
            game_id: state.currentGame.id,
            status: entryOptions.status,
            last_opened_at: entryOptions.lastOpenedAt
          });
          await applyAccountPayload(response);
        } catch (error) {
          UI.showToast(error.message || 'Não foi possível salvar na conta.', 'error');
          return;
        }
      } else {
        upsertLibraryEntry(state.currentGame, entryOptions);
      }

      if (typeof renderCurrentGuide === 'function') renderCurrentGuide({ skipHistory: true });
      UI.showToast(existing ? 'Biblioteca atualizada.' : 'Jogo salvo na biblioteca.', 'success');
    }

    function isCurrentGameSaved() {
      if (!state.currentGame) return false;
      return Boolean(state.library[getLibraryKey(state.currentGame)]);
    }

    async function deleteFromLibrary(key, options = {}) {
      const resolvedKey = resolveLibraryKey(key);
      if (!resolvedKey || !state.library[resolvedKey]) return false;
      const entry = state.library[resolvedKey];
      if (isAccountLibrary() && entry?.id) {
        try {
          const response = await ApiService.removeUserLibrary(entry.id, { keep_progress: Boolean(options.keepProgress) });
          await applyAccountPayload(response);
        } catch (error) {
          UI.showToast(error.message || 'Não foi possível remover o jogo. Tente novamente.', 'error');
          return false;
        }
      } else {
        delete state.library[resolvedKey];
        persistLibrary();
        renderLibraryView();
      }
      UI.showToast('Jogo removido da biblioteca.', 'success');
      return true;
    }

    return {
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
    };
  }

  return {
    createLibraryController
  };
})();
