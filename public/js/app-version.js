window.AtlasAppVersion = (() => {
  const VERSION_KEY = 'atlasachievement_app_version';
  const RELOAD_PREFIX = 'atlasachievement_app_version_reload_';
  const TECHNICAL_CACHE_RE = /atlasachievement|atlas|mtg|workbox|precache|runtime/i;

  function getStorage(type) {
    try {
      return window[type] || null;
    } catch (_error) {
      return null;
    }
  }

  function getCurrentVersion() {
    return String(window.__APP_VERSION__ || '').trim();
  }

  function shouldDeleteCache(cacheName = '') {
    return TECHNICAL_CACHE_RE.test(String(cacheName || ''));
  }

  async function clearTechnicalCaches() {
    const cacheStorage = window.caches;
    if (!cacheStorage?.keys || !cacheStorage?.delete) return false;

    const cacheNames = await cacheStorage.keys();
    const appCaches = cacheNames.filter(shouldDeleteCache);
    await Promise.all(appCaches.map(cacheName => cacheStorage.delete(cacheName)));
    return appCaches.length > 0;
  }

  async function unregisterServiceWorkers() {
    const serviceWorker = window.navigator?.serviceWorker;
    if (!serviceWorker?.getRegistrations) return false;

    const registrations = await serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    return registrations.length > 0;
  }

  function reloadOnceForVersion(version = '') {
    const sessionStorage = getStorage('sessionStorage');
    if (!sessionStorage || !window.location?.reload) return;

    const reloadKey = `${RELOAD_PREFIX}${version}`;
    if (sessionStorage.getItem(reloadKey) === '1') return;
    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
  }

  async function checkVersion() {
    const currentVersion = getCurrentVersion();
    if (!currentVersion) return false;

    const localStorage = getStorage('localStorage');
    if (!localStorage) return false;

    const savedVersion = localStorage.getItem(VERSION_KEY);
    if (savedVersion === currentVersion) return false;

    localStorage.setItem(VERSION_KEY, currentVersion);

    const [removedCaches, removedServiceWorkers] = await Promise.all([
      clearTechnicalCaches().catch(() => false),
      unregisterServiceWorkers().catch(() => false)
    ]);

    if (removedCaches || removedServiceWorkers || window.navigator?.serviceWorker?.controller) {
      reloadOnceForVersion(currentVersion);
    }

    return true;
  }

  checkVersion().catch(() => {});

  return {
    VERSION_KEY,
    checkVersion,
    clearTechnicalCaches,
    unregisterServiceWorkers,
    shouldDeleteCache
  };
})();
