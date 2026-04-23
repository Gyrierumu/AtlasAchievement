(function () {
  window.AdminHelper = {
    duplicateGuideTemplate: function (gameName) {
      return {
        source: gameName || "",
        createdAt: new Date().toISOString(),
        status: "draft"
      };
    }
  };
})();