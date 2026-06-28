(() => {
  async function init() {
    try {
      const context = window.AppContextFactory?.createAppContext?.();
      if (!context) throw new Error('Contexto principal indisponível.');

      window.AtlasAppContext = context;

      const initializedPublic = await window.AppPublicInit?.init?.(context);
      if (initializedPublic) return;

      const initializedAdmin = await window.AppAdminInit?.init?.(context);
      if (initializedAdmin) return;

      throw new Error(`Página inválida para inicialização: ${context.page}`);
    } catch (error) {
      UI.showToast(`Falha ao iniciar: ${error.message}`, 'error');
    }
  }

  init();
})();
