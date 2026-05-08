window.StorageService = (() => {
  const LIBRARY_KEY = 'trophy_library_v2';
  const LEGACY_LIBRARY_KEY = 'trophy_library';
  const IMPORT_DECISION_PREFIX = 'atlas_library_import_decision_';

  function normalizeKey(game = {}) {
    if (game.slug) return String(game.slug).trim();
    return String(game.name || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function migrateLegacyLibrary() {
    try {
      const current = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '{}');
      if (current && Object.keys(current).length) return current;

      const legacy = JSON.parse(localStorage.getItem(LEGACY_LIBRARY_KEY) || '{}');
      const migrated = {};
      Object.values(legacy || {}).forEach(game => {
        const key = normalizeKey(game);
        if (!key) return;
        migrated[key] = { ...game, slug: game.slug || key, completed: Array.isArray(game.completed) ? game.completed : [] };
      });

      if (Object.keys(migrated).length) {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(migrated));
      }
      return migrated;
    } catch (error) {
      console.error('Erro ao migrar biblioteca do localStorage:', error);
      return {};
    }
  }

  function getLibrary() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '{}');
      if (parsed && Object.keys(parsed).length) return parsed;
      return migrateLegacyLibrary();
    } catch (error) {
      console.error('Erro ao ler biblioteca do localStorage:', error);
      return migrateLegacyLibrary();
    }
  }

  function saveLibrary(library) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library || {}));
  }

  function getImportDecision(userKey = '') {
    try {
      const key = `${IMPORT_DECISION_PREFIX}${normalizeImportUserKey(userKey)}`;
      return localStorage.getItem(key) || '';
    } catch (_error) {
      return '';
    }
  }

  function setImportDecision(userKey = '', decision = '') {
    try {
      const key = `${IMPORT_DECISION_PREFIX}${normalizeImportUserKey(userKey)}`;
      localStorage.setItem(key, String(decision || 'ignored'));
    } catch (_error) {}
  }

  function normalizeImportUserKey(value = '') {
    return String(value || 'anon')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'anon';
  }

  return {
    getLibrary,
    saveLibrary,
    getImportDecision,
    setImportDecision,
    normalizeKey
  };
})();
