(function () {
  function getSession() {
    try {
      return JSON.parse(localStorage.getItem("aa_user_session") || "null");
    } catch (e) {
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem("aa_user_session", JSON.stringify(session));
  }

  function logout() {
    localStorage.removeItem("aa_user_session");
  }

  function createGuestSession() {
    const session = {
      id: "guest_" + Date.now(),
      type: "guest",
      createdAt: new Date().toISOString()
    };
    saveSession(session);
    return session;
  }

  window.AAAuth = {
    getSession,
    saveSession,
    logout,
    createGuestSession
  };
})();