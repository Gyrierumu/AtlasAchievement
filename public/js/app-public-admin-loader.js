window.AppPublicAdminLoader = (() => {
  const scripts = ['/js/ui-admin-render.js', '/js/app-admin.js'];
  let loadPromise = null;
  let adminController = null;

  function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
      document.head.appendChild(script);
    });
  }

  async function loadAdminModules() {
    if (!loadPromise) {
      loadPromise = scripts.reduce((promise, src) => promise.then(() => loadScript(src)), Promise.resolve());
    }
    await loadPromise;
    if (window.UIAdminRender) Object.assign(window.UI, window.UIAdminRender);
  }

  async function getAdminController() {
    await loadAdminModules();
    if (adminController) return adminController;

    const context = window.AtlasAppContext;
    if (!context || !window.AppAdmin?.createAdminController) {
      throw new Error('Contexto editorial indisponivel.');
    }

    adminController = window.AppAdmin.createAdminController({
      UI: context.UI,
      ApiService: context.ApiService,
      state: context.state,
      page: context.page,
      loadGames: context.loadGames,
      syncSession: context.syncSession,
      navigate: context.navigate,
      collectGameFormPayload: window.AppAdmin.collectGameFormPayload,
      removeEntriesByIdentity: library => ({ removed: false, library }),
      persistLibrary: () => {}
    });
    adminController.bindAdminEvents?.();
    return adminController;
  }

  async function openAdminAccess() {
    const context = window.AtlasAppContext;
    const controller = await getAdminController();
    const session = await context.syncSession();
    if (session?.authenticated) {
      window.location.href = '/admin';
      return;
    }
    controller.bindAdminEvents?.();
    context.UI.openAdminModal();
  }

  function bind() {
    document.addEventListener('click', async event => {
      const trigger = event.target.closest('#adminAccessBtn, #adminAccessBtnFooter');
      if (!trigger) return;
      event.preventDefault();
      try {
        await openAdminAccess();
      } catch (error) {
        window.UI?.showToast?.(error.message || 'Falha ao abrir acesso editorial.', 'error');
      }
    });
  }

  return { bind, loadAdminModules };
})();
