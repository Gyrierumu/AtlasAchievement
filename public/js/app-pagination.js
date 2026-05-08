window.AppPagination = (() => {
  function bindPaginationControls({ state, loadCatalogPage, navigate, loadAdminGames }) {
    document.addEventListener('click', async event => {
      const pageButton = event.target.closest('[data-page-target][data-page-value]');
      if (!pageButton) return;
      const pageTarget = pageButton.dataset.pageTarget;
      const pageValue = Number(pageButton.dataset.pageValue || 1);
      if (!Number.isInteger(pageValue) || pageValue <= 0) return;

      if (pageTarget === 'catalog') {
        state.catalogPage = pageValue;
        await loadCatalogPage({ page: state.catalogPage });
        navigate('catalog', { facet: state.catalogFacet, skipHistory: true });
        return;
      }

      if (pageTarget === 'admin') {
        state.adminPage = pageValue;
        await loadAdminGames();
      }
    });
  }

  return { bindPaginationControls };
})();
