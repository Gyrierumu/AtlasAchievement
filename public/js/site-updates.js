window.AtlasSiteUpdates = (() => {
  const initialState = window.__INITIAL_STATE__ || {};
  const weeklyHomeUpdate = initialState.homeUpdate || null;

  return {
    activeHomeUpdate: weeklyHomeUpdate?.active ? weeklyHomeUpdate : null
  };
})();
