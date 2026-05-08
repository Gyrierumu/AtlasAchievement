window.ApiService = (() => {
  let csrfToken = null;

  function setCsrfToken(token) {
    csrfToken = token || null;
  }

  async function request(url, options = {}) {
    const hasBody = options.body instanceof FormData;
    const method = String(options.method || 'GET').toUpperCase();
    const headers = hasBody
      ? { ...(options.headers || {}) }
      : {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        };

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers
    });

    const responseCsrfToken = response.headers.get('x-csrf-token');
    if (responseCsrfToken) {
      setCsrfToken(responseCsrfToken);
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : null;

    if (payload?.csrfToken) {
      setCsrfToken(payload.csrfToken);
    }

    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || payload?.error || 'Erro inesperado.';
      const error = new Error(message);
      error.status = response.status;
      error.code = payload?.error?.code || null;
      error.details = payload?.error?.details || payload?.details || null;
      throw error;
    }

    return payload;
  }

  return {
    setCsrfToken,
    getGames(params = {}) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') searchParams.set(key, String(value));
      });
      const query = searchParams.toString();
      return request(`/api/games${query ? `?${query}` : ''}`);
    },
    getGameByName(name) {
      return request(`/api/games/name/${encodeURIComponent(name)}`);
    },
    getGameBySlug(slug) {
      return request(`/api/games/slug/${encodeURIComponent(slug)}`);
    },
    getGameById(id) {
      return request(`/api/games/id/${id}`);
    },
    createGame(payload) {
      return request('/api/games', { method: 'POST', body: JSON.stringify(payload) });
    },
    updateGame(id, payload) {
      return request(`/api/games/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    deleteGame(id) {
      return request(`/api/games/${id}`, { method: 'DELETE' });
    },
    duplicateGame(id) {
      return request(`/api/games/${id}/duplicate`, { method: 'POST' });
    },
    uploadCover(file) {
      const body = new FormData();
      body.append('cover', file);
      return request('/api/uploads/cover', { method: 'POST', body });
    },
    getAdminSummary() {
      return request('/api/games/admin/summary');
    },
    submitFeedback(payload) {
      return request('/api/feedback', { method: 'POST', body: JSON.stringify(payload) });
    },
    getAdminFeedback(params = {}) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') searchParams.set(key, String(value));
      });
      const query = searchParams.toString();
      return request(`/api/feedback/admin${query ? `?${query}` : ''}`);
    },
    getSession() {
      return request('/api/auth/session');
    },
    login(payload) {
      return request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    },
    logout() {
      return request('/api/auth/logout', { method: 'POST' });
    },
    changePassword(payload) {
      return request('/api/auth/change-password', { method: 'POST', body: JSON.stringify(payload) });
    },
    getCurrentUser() {
      return request('/api/auth/me');
    },
    registerUser(payload) {
      return request('/api/auth/register', {
        method: 'POST',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ ...payload, scope: 'user' })
      });
    },
    loginUser(payload) {
      return request('/api/auth/login', {
        method: 'POST',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ ...payload, scope: 'user' })
      });
    },
    logoutUser() {
      return request('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ scope: 'user' })
      });
    },
    updateUserProfile(payload) {
      return request('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ ...payload, scope: 'user' })
      });
    },
    changeUserPassword(payload) {
      return request('/api/auth/change-password', {
        method: 'POST',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ ...payload, scope: 'user' })
      });
    },
    getUserLibrary() {
      return request('/api/me/library', {
        headers: { 'X-Atlas-Auth-Scope': 'user' }
      });
    },
    addUserLibrary(payload) {
      return request('/api/me/library', {
        method: 'POST',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ ...payload, scope: 'user' })
      });
    },
    updateUserLibrary(gameId, payload = {}) {
      return request(`/api/me/library/${encodeURIComponent(gameId)}`, {
        method: 'PATCH',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ ...payload, scope: 'user' })
      });
    },
    removeUserLibrary(gameId, payload = {}) {
      return request(`/api/me/library/${encodeURIComponent(gameId)}`, {
        method: 'DELETE',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ ...payload, scope: 'user' })
      });
    },
    getUserProgress(gameId) {
      return request(`/api/me/progress/${encodeURIComponent(gameId)}`, {
        headers: { 'X-Atlas-Auth-Scope': 'user' }
      });
    },
    updateUserProgress(gameId, trophyCode, payload = {}) {
      return request(`/api/me/progress/${encodeURIComponent(gameId)}/${encodeURIComponent(trophyCode)}`, {
        method: 'PATCH',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ ...payload, scope: 'user' })
      });
    },
    bulkUserProgress(gameId, payload = {}) {
      return request(`/api/me/progress/${encodeURIComponent(gameId)}/bulk`, {
        method: 'POST',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ ...payload, scope: 'user' })
      });
    },
    exportUserData() {
      return request('/api/me/export', {
        headers: { 'X-Atlas-Auth-Scope': 'user' }
      });
    },
    clearUserProgress() {
      return request('/api/me/progress', {
        method: 'DELETE',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ scope: 'user' })
      });
    },
    deleteUserAccount(payload = {}) {
      return request('/api/me/account', {
        method: 'DELETE',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ ...payload, scope: 'user' })
      });
    }
  };
})();
