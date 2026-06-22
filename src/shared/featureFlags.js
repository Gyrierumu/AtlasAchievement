(function attachFeatureFlags(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  if (root) root.AtlasFeatureFlags = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function featureFlagsFactory() {
  const featureFlags = {
    ENABLE_WALKTHROUGH: false,
    isWalkthroughEnabled() {
      return featureFlags.ENABLE_WALKTHROUGH === true;
    }
  };

  return featureFlags;
});
