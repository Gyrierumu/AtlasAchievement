(function () {
  function track(eventName, payload) {
    try {
      const entry = {
        event: eventName,
        payload: payload || {},
        timestamp: new Date().toISOString()
      };

      const existing = JSON.parse(localStorage.getItem("aa_analytics") || "[]");
      existing.push(entry);
      localStorage.setItem("aa_analytics", JSON.stringify(existing.slice(-500)));

      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      }).catch(function () {});
    } catch (e) {}
  }

  window.AAAnalytics = { track: track };

  document.addEventListener("DOMContentLoaded", function () {
    track("page_view", {
      path: window.location.pathname
    });
  });
})();