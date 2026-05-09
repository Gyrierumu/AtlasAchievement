window.AppAdminInit = (() => {
  function bindAdminPageEvents(context) {
    const { bindAdminEvents, bindPaginationControls, state, loadCatalogPage, navigate, loadAdminGames } = context;
    bindAdminEvents();
    bindPaginationControls({ state, loadCatalogPage, navigate, loadAdminGames });
  }

  function initDraftController() {
    window.AppAdminDraft?.createAdminDraftController({
      form: document.getElementById('gameForm'),
      restoreButton: document.getElementById('restoreDraftBtn'),
      clearButton: document.getElementById('clearDraftBtn')
    })?.init();
  }

  async function init(context) {
    const { page, UI, state, bindCommonUi, syncSession, openAdminPanel } = context;
    if (page !== 'admin') return false;
    bindCommonUi();
    bindAdminPageEvents(context);
    initDraftController();
    await syncSession();
    UI.showView('admin');
    if (state.session.authenticated) await openAdminPanel();
    else window.location.replace('/admin');
    return true;
  }

  return { init, bindAdminPageEvents, initDraftController };
})();
