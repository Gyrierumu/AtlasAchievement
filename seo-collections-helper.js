(function () {
  window.AASEOCollections = {
    createCollectionMeta: function (title, description, slug) {
      return {
        title: title || "",
        description: description || "",
        slug: slug || "",
        createdAt: new Date().toISOString()
      };
    }
  };
})();