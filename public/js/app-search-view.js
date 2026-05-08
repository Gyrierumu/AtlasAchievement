window.AppSearchView = (() => {
  function bindGlobalSearch({ UI, state, debouncedSearchGames, openBestSearchResult, syncSuggestionHighlight }) {
    UI.qs('#btnLoad')?.addEventListener('click', event => {
      event.preventDefault();
      openBestSearchResult(UI.qs('#gameInput').value);
    });

    UI.qs('#gameInput')?.addEventListener('input', event => {
      debouncedSearchGames(event.target.value);
    });

    UI.qs('#gameInput')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        openBestSearchResult(event.target.value);
        return;
      }
      if (!state.searchSuggestions.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.activeSuggestionIndex = (state.activeSuggestionIndex + 1) % state.searchSuggestions.length;
        syncSuggestionHighlight();
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        state.activeSuggestionIndex = (state.activeSuggestionIndex - 1 + state.searchSuggestions.length) % state.searchSuggestions.length;
        syncSuggestionHighlight();
      }
      if (event.key === 'Escape') {
        UI.hideSuggestions();
      }
    });

    UI.qs('#suggestions')?.addEventListener('mousemove', event => {
      const button = event.target.closest('[data-suggestion-index]');
      if (!button) return;
      const nextIndex = Number(button.dataset.suggestionIndex);
      if (Number.isInteger(nextIndex) && nextIndex !== state.activeSuggestionIndex) {
        state.activeSuggestionIndex = nextIndex;
        syncSuggestionHighlight();
      }
    });

    UI.qs('#suggestions')?.addEventListener('click', event => {
      const button = event.target.closest('[data-suggestion]');
      if (!button) return;
      const nextIndex = Number(button.dataset.suggestionIndex);
      if (Number.isInteger(nextIndex)) state.activeSuggestionIndex = nextIndex;
      UI.qs('#gameInput').value = button.dataset.suggestion;
      openBestSearchResult(button.dataset.suggestion);
    });

    document.addEventListener('click', event => {
      const input = UI.qs('#gameInput');
      const suggestions = UI.qs('#suggestions');
      if (input && suggestions && !input.contains(event.target) && !suggestions.contains(event.target)) {
        UI.hideSuggestions();
      }
    });
  }

  return {
    bindGlobalSearch
  };
})();
