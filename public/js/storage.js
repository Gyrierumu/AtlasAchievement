window.StorageService = (() => {
  const LIBRARY_KEY = 'trophy_library';

  function getLibrary() {
    try {
      return JSON.parse(localStorage.getItem(LIBRARY_KEY) || '{}');
    } catch (error) {
      console.error('Erro ao ler biblioteca do localStorage:', error);
      return {};
    }
  }

  function saveLibrary(library) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  }

  return {
    getLibrary,
    saveLibrary
  };
})();
