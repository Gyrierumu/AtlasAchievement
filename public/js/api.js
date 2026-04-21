const ApiService = (() => {
  async function request(url, options = {}) {
    const hasBody = options.body instanceof FormData;
    const response = await fetch(url, {
      credentials: 'include',
      headers: hasBody
        ? (options.headers || {})
        : {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          },
      ...options
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : null;

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
    }
  };
})();
