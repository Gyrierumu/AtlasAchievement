(function (globalScope, factory) {
  'use strict';

  const core = typeof module === 'object' && module.exports
    ? require('./guide-progress-v2.js')
    : globalScope.AtlasGuideProgressV2;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (globalScope && globalScope.document) {
    globalScope.AtlasRe5GuideProgressV2 = api;
    globalScope.AtlasGuideProgressV2Config = {
      ...(globalScope.AtlasGuideProgressV2Config || {}),
      migrateProgress: api.migratePhase6Progress
    };
  }
})(typeof window !== 'undefined' ? window : globalThis, function (core) {
  'use strict';

  const LEGACY_STORAGE_KEY = 'atlas_re5_phase6_state_v1';

  function migratePhase6Progress(options = {}) {
    return core.migrateLegacyProgress({
      ...options,
      slug: options.slug || 'resident-evil-5',
      legacyKey: options.legacyKey || LEGACY_STORAGE_KEY,
      targetKey: options.targetKey || core.STORAGE_KEY
    });
  }

  return {
    ...core,
    LEGACY_STORAGE_KEY,
    migratePhase6Progress
  };
});
