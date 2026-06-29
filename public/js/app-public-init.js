window.AppPublicInit = (() => {
  function bindPublicEvents(context) {
    const {
      UI,
      page,
      state,
      navigate,
      loadCatalogPage,
      loadGuideByName,
      debouncedSearchGames,
      getCatalogFacetFromPath,
      bindPublicNavigation,
      bindPublicPopState,
      handlePublicPath,
      loadGuideBySlug,
      syncCatalogRoute,
      syncGuideQuickDock,
      bindGlobalSearch,
      openBestSearchResult,
      syncSuggestionHighlight,
      bindGuideInteractions,
      toggleTrophy,
      focusGuideAction,
      handleGuideQuickDockClick,
      bindLibraryView,
      deleteFromLibrary,
      loadFromLibrary,
      isCurrentGameSaved,
      removeCurrentGameFromLibrary,
      saveCurrentGameToLibrary,
      renderCurrentGuide,
      bindCatalogView,
      rerenderCatalogView,
      toggleCatalogCompare,
      clearCatalogCompare,
      setCatalogIntent,
      bindPaginationControls,
      loadAdminGames,
      loadGames,
      bindAdminEvents,
      bindUserAuthEvents
    } = context;

    bindPublicNavigation({ UI, page, state, navigate, loadCatalogPage, loadGuideByName, loadGames, debouncedSearchGames, getCatalogFacetFromPath });
    bindAdminEvents();
    bindUserAuthEvents();
    bindPublicPopState({
      page,
      UI,
      onNavigate: pathname => handlePublicPath({ pathname, UI, state, navigate, loadGuideBySlug, loadCatalogPage, loadGames, syncCatalogRoute, syncGuideQuickDock })
    });
    bindGlobalSearch({ UI, state, debouncedSearchGames, openBestSearchResult, syncSuggestionHighlight });
    bindGuideInteractions({ UI, state, toggleTrophy, focusGuideAction, handleGuideQuickDockClick });
    bindLibraryView({ UI, state, deleteFromLibrary, loadGuideBySlug, loadFromLibrary, isCurrentGameSaved, removeCurrentGameFromLibrary, saveCurrentGameToLibrary: () => saveCurrentGameToLibrary(renderCurrentGuide), loadCatalogPage, navigate });
    bindCatalogView({ UI, state, loadCatalogPage, navigate, loadGuideBySlug, rerenderCatalogView, toggleCatalogCompare, clearCatalogCompare, setCatalogIntent });
    bindPaginationControls({ state, loadCatalogPage, navigate, loadAdminGames });
  }

  async function init(context) {
    const { page, UI, bindCommonUi, syncSession, syncUserSession, handlePublicPath, state, navigate, loadGuideBySlug, loadCatalogPage, loadGames, syncCatalogRoute, syncGuideQuickDock } = context;
    if (page !== 'public') return false;
    bindCommonUi();
    bindPublicEvents(context);
    await Promise.all([syncSession(), syncUserSession()]);
    await handlePublicPath({
      pathname: window.location.pathname,
      UI,
      state,
      navigate,
      loadGuideBySlug,
      loadCatalogPage,
      loadGames,
      syncCatalogRoute,
      syncGuideQuickDock
    });
    return true;
  }

  return { init, bindPublicEvents };
})();
