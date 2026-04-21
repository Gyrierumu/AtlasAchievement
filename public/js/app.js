(() => {
  const page = document.body.dataset.page || 'public';
  const state = {
    availableGames: [],
    currentGame: null,
    activeFilter: 'all',
    guideSearch: '',
    librarySearch: '',
    librarySort: 'continue',
    catalogSearch: '',
    catalogSort: 'updated-desc',
    catalogFacet: 'all',
    catalogPage: 1,
    catalogResponse: { items: [], pagination: { page: 1, totalPages: 1, total: 0 } },
    adminSearch: '',
    adminSort: 'updated-desc',
    adminPage: 1,
    adminGamesResponse: { items: [], pagination: { page: 1, totalPages: 1, total: 0 } },
    library: StorageService.getLibrary(),
    session: { authenticated: false },
    adminSummary: { totalGames: 0, totalTrophies: 0 }
  };

  function getGameSlug(game) {
    return game?.slug || slugify(game?.name || '');
  }

  const catalogFacetPathMap = {
    all: '/catalogo',
    'difficulty-low': '/catalogo/dificuldade-baixa',
    'difficulty-mid': '/catalogo/dificuldade-media',
    'difficulty-high': '/catalogo/dificuldade-alta',
    'time-short': '/catalogo/ate-15-horas',
    'time-medium': '/catalogo/16-a-40-horas',
    'time-long': '/catalogo/mais-de-40-horas',
    'trophies-small': '/catalogo/ate-30-trofeus',
    'trophies-medium': '/catalogo/31-a-60-trofeus',
    'trophies-large': '/catalogo/mais-de-60-trofeus'
  };

  function getCatalogPath(facet = 'all') {
    return catalogFacetPathMap[facet] || '/catalogo';
  }

  function getCatalogFacetFromPath(pathname = '/') {
    const normalized = pathname.replace(/\/+$/, '') || '/';
    const match = Object.entries(catalogFacetPathMap).find(([, path]) => path === normalized);
    return match ? match[0] : 'all';
  }

  function navigate(view, options = {}) {
    UI.showView(view);

    if (page !== 'public') return;

    let path = '/';
    if (view === 'library') path = '/biblioteca';
    if (view === 'catalog') path = getCatalogPath(options.facet || state.catalogFacet || 'all');
    if (view === 'guide' && options.game) path = `/jogo/${getGameSlug(options.game)}`;

    if (!options.skipHistory) {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (currentPath !== path) {
        window.history.pushState({ view, slug: options.game ? getGameSlug(options.game) : null }, '', path);
      }
    }

    if (view === 'home') UI.setPageMeta();
    if (view === 'library') UI.setPageMeta(null);
    if (view === 'catalog') UI.setCatalogMeta(options.facet || state.catalogFacet || 'all');
    if (view === 'library') UI.renderLibrary(state.library, { search: state.librarySearch, sort: state.librarySort });
    if (view === 'catalog') UI.renderCatalog(state.catalogResponse, { search: state.catalogSearch, sort: state.catalogSort, facet: options.facet || state.catalogFacet });
  }

  function persistLibrary() {
    StorageService.saveLibrary(state.library);
    UI.updateLibraryBadge(state.library);
    UI.renderHomeOverview(state.availableGames, state.library);
    UI.renderLibrary(state.library, { search: state.librarySearch, sort: state.librarySort });
  }

  function normalizeLibraryEntry(game) {
    return { ...game, completed: state.library[game.name]?.completed || [] };
  }

  async function loadGames() {
    const response = await ApiService.getGames({ page: 1, limit: 500, sort: 'updated-desc' });
    state.availableGames = response.items || [];
    UI.renderHomeOverview(state.availableGames, state.library);
    return state.availableGames;
  }

  async function fetchSearchSuggestions(query) {
    const normalized = query.trim();
    if (!normalized) return [];
    try {
      const response = await ApiService.getGames({ q: normalized, page: 1, limit: 8, sort: 'name-asc' });
      return response.items || [];
    } catch (error) {
      return state.availableGames
        .filter(game => game.name.toLowerCase().includes(normalized.toLowerCase()))
        .slice(0, 8);
    }
  }

  async function loadCatalogPage(options = {}) {
    state.catalogResponse = await ApiService.getGames({
      q: options.search !== undefined ? options.search : state.catalogSearch,
      sort: options.sort || state.catalogSort,
      facet: options.facet || state.catalogFacet,
      page: options.page || state.catalogPage,
      limit: 12
    });
    state.catalogPage = state.catalogResponse.pagination?.page || 1;
    UI.renderCatalog(state.catalogResponse, { search: state.catalogSearch, sort: state.catalogSort, facet: state.catalogFacet });
    return state.catalogResponse;
  }

  async function loadAdminGames() {
    if (!state.session.authenticated) return;
    state.adminGamesResponse = await ApiService.getGames({
      q: state.adminSearch,
      sort: state.adminSort,
      page: state.adminPage,
      limit: 10
    });
    state.adminPage = state.adminGamesResponse.pagination?.page || 1;
    UI.renderAdminGames(state.adminGamesResponse);
  }

  async function loadAdminSummary() {
    if (!state.session.authenticated) return;
    state.adminSummary = await ApiService.getAdminSummary();
    UI.renderAdminSummary(state.adminSummary);
  }

  async function syncSession() {
    state.session = await ApiService.getSession();
    UI.setAdminState(state.session);
    return state.session;
  }

  async function searchGames(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      UI.hideSuggestions();
      UI.setSearchFeedback('Digite um nome para ver sugestões e abrir a página do jogo.');
      return;
    }
    const filtered = await fetchSearchSuggestions(query);
    UI.renderSuggestions(filtered);
  }

  async function loadGuideBySlug(slug, options = {}) {
    const slugValue = slug?.trim();
    if (!slugValue) return navigate('home', options);
    try {
      navigate('guide', { ...options, game: { slug: slugValue } });
      UI.setLoading(true);
      UI.setGuideEmptyState(false);
      const guide = await ApiService.getGameBySlug(slugValue);
      state.currentGame = guide;
      state.library[guide.name] = normalizeLibraryEntry(guide);
      persistLibrary();
      UI.setSearchFeedback(`Página de ${guide.name} aberta.`, 'success');
      renderCurrentGuide(options);
    } catch (error) {
      UI.showToast(error.message, 'error');
      UI.setSearchFeedback(error.message, 'error');
      navigate('home', options);
    } finally {
      UI.setLoading(false);
    }
  }

  async function loadGuideByName(name, options = {}) {
    const gameName = name?.trim();
    if (!gameName) {
      UI.setSearchFeedback('Digite o nome de um jogo para continuar.', 'error');
      return UI.showToast('Digite o nome de um jogo.', 'error');
    }
    try {
      navigate('guide', { ...options, game: { name: gameName } });
      UI.setLoading(true);
      UI.setGuideEmptyState(false);
      const guide = await ApiService.getGameByName(gameName);
      state.currentGame = guide;
      state.library[guide.name] = normalizeLibraryEntry(guide);
      persistLibrary();
      UI.setSearchFeedback(`Página de ${guide.name} aberta.`, 'success');
      renderCurrentGuide(options);
    } catch (error) {
      UI.showToast(error.message, 'error');
      UI.setSearchFeedback(error.message, 'error');
      if (page === 'public') navigate('home', options);
    } finally {
      UI.setLoading(false);
    }
  }

  function renderCurrentGuide(options = {}) {
    if (!state.currentGame) return;
    const libraryEntry = state.library[state.currentGame.name] || normalizeLibraryEntry(state.currentGame);
    state.library[state.currentGame.name] = libraryEntry;
    UI.renderGuide(state.currentGame, { completedTrophies: libraryEntry.completed });
    UI.setPageMeta(state.currentGame);
    navigate('guide', { ...options, game: state.currentGame, skipHistory: options.skipHistory });
    UI.clearTrophySearch();
    state.guideSearch = '';
    UI.applyTrophyFilter(state.activeFilter, state.guideSearch);
    if (UI.has('#guideContent')) UI.qs('#guideContent').classList.remove('hidden');
  }

  function toggleTrophy(trophyId) {
    if (!state.currentGame) return;
    const entry = state.library[state.currentGame.name];
    const index = entry.completed.indexOf(trophyId);
    if (index >= 0) entry.completed.splice(index, 1); else entry.completed.push(trophyId);
    persistLibrary();
    renderCurrentGuide();
  }

  function loadFromLibrary(name) {
    const entry = state.library[name];
    if (!entry) return;
    state.currentGame = entry;
    renderCurrentGuide();
  }

  function deleteFromLibrary(name) {
    delete state.library[name];
    persistLibrary();
    UI.renderLibrary(state.library, { search: state.librarySearch, sort: state.librarySort });
    UI.showToast('Jogo removido da biblioteca.', 'success');
  }

  function slugify(value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || `trofeu-${Date.now()}`;
  }

  function normalizeType(rawValue, fallback = 'Bronze') {
    const text = String(rawValue || '').toLowerCase();
    if (text.includes('platina')) return 'Platina';
    if (text.includes('ouro')) return 'Ouro';
    if (text.includes('prata')) return 'Prata';
    if (text.includes('bronze')) return 'Bronze';
    return fallback;
  }

  function inferTypeFromLine(line, currentType) {
    const explicitMatch = line.match(/\[(Platina|Ouro|Prata|Bronze)\]|\((Platina|Ouro|Prata|Bronze)\)/i);
    if (explicitMatch) return normalizeType(explicitMatch[1] || explicitMatch[2], currentType || 'Bronze');
    return currentType || 'Bronze';
  }

  function parseTrophiesFromRawText(rawText) {
    const lines = rawText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const trophies = [];
    let currentType = null;
    let sectionName = '';

    for (const line of lines) {
      if (!line.includes(':')) {
        sectionName = line;
        const headingType = normalizeType(line, '');
        currentType = headingType || currentType;
        continue;
      }

      const [rawName, ...rest] = line.split(':');
      const name = rawName.trim().replace(/^[-•*]\s*/, '');
      const description = rest.join(':').trim();
      if (!name || !description) continue;

      const type = inferTypeFromLine(line, currentType || 'Bronze');
      const generatedIdBase = slugify(name);
      const uniqueId = trophies.some(item => item.id === generatedIdBase)
        ? `${generatedIdBase}-${trophies.length + 1}`
        : generatedIdBase;

      const spoiler = /hist[oó]ria|ep[ií]logo|chefe final|final verdadeiro|miss[aã]o principal/i.test(sectionName) || /ep[ií]logo|chefe final|final verdadeiro|miss[aã]o principal/i.test(description);

      trophies.push({
        id: uniqueId,
        name,
        type,
        description,
        tip: `Objetivo: ${description}`,
        is_spoiler: spoiler
      });
    }

    return trophies;
  }

  function collectGameFormPayload() {
    const trophies = UI.qsa('#trophiesContainer .trophy-input').map(block => {
      const fields = block.querySelectorAll('input, textarea, select');
      return {
        id: fields[0].value.trim(),
        name: fields[1].value.trim(),
        type: fields[2].value,
        description: fields[3].value.trim(),
        tip: fields[4].value.trim(),
        is_spoiler: fields[5].checked
      };
    });
    return {
      name: UI.qs('#gameName').value.trim(),
      difficulty: Number(UI.qs('#gameDifficulty').value),
      time: UI.qs('#gameTime').value.trim(),
      image: UI.qs('#gameImage').value.trim(),
      missable: UI.qs('#gameMissable').value.trim(),
      roadmap: UI.qs('#gameRoadmap').value.split('\n').map(item => item.trim()).filter(Boolean),
      trophies
    };
  }


  function buildPreviewPayload() {
    const payload = collectGameFormPayload();
    const currentId = UI.qs('#gameId')?.value?.trim();
    if (currentId) {
      const existing = state.availableGames.find(item => String(item.id) === String(currentId));
      if (existing?.slug) payload.slug = existing.slug;
    }
    return payload;
  }

  function openFormPreview() {
    const payload = buildPreviewPayload();
    if (!payload.name) {
      UI.setAdminFormFeedback('Preencha pelo menos o nome do jogo antes de gerar a prévia.', 'error');
      return UI.showToast('Preencha pelo menos o nome do jogo antes de gerar a prévia.', 'error');
    }
    UI.renderAdminPreview(payload);
    UI.setAdminFormFeedback('Prévia atualizada com os dados do formulário.', 'success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.openFormPreview = openFormPreview;

  async function openAdminPanel() {
    if (!state.session.authenticated) {
      UI.openAdminModal();
      return;
    }
    await Promise.all([loadGames(), loadAdminSummary(), loadAdminGames()]);
    UI.showView('admin');
  }

  async function handleUploadCover() {
    const file = UI.qs('#gameImageFile')?.files?.[0];
    if (!file) return UI.showToast('Selecione uma imagem para enviar.', 'error');
    try {
      UI.setUploadState(true, `Enviando ${file.name}...`);
      const response = await ApiService.uploadCover(file);
      UI.setImagePreview(response.imageUrl);
      UI.setUploadState(false, 'Upload concluído.');
      UI.showToast(response.message, 'success');
    } catch (error) {
      UI.setUploadState(false, error.message);
      UI.showToast(error.message, 'error');
    }
  }

  function handleParseTrophies() {
    const rawText = UI.qs('#rawTrophiesInput')?.value?.trim() || '';
    if (!rawText) return UI.showToast('Cole o texto dos troféus antes de converter.', 'error');

    const trophies = parseTrophiesFromRawText(rawText);
    if (!trophies.length) {
      return UI.showToast('Não consegui identificar troféus nesse texto. Use o formato "Nome: descrição".', 'error');
    }

    UI.replaceTrophyInputs(trophies);
    UI.showToast(`${trophies.length} troféu(s) convertidos com sucesso.`, 'success');
  }

  async function handleGameSubmit(event) {
    event.preventDefault();
    try {
      const payload = collectGameFormPayload();
      const gameId = UI.qs('#gameId').value.trim();
      const response = gameId ? await ApiService.updateGame(gameId, payload) : await ApiService.createGame(payload);
      await Promise.all([loadGames(), loadAdminSummary(), loadAdminGames()]);
      UI.renderAdminSummary(state.adminSummary);
      UI.resetGameForm();
      UI.toggleGameForm(false);
      UI.togglePreviewPanel(false);
      UI.setAdminFormFeedback('', 'info');
      UI.showToast(response.message, 'success');
    } catch (error) {
      if (error.status === 401) { await syncSession(); UI.openAdminModal(); }
      UI.showToast(error.details?.join(' | ') || error.message, 'error');
    }
  }

  async function handleEditGame(id) {
    try {
      const game = await ApiService.getGameById(id);
      UI.fillGameForm(game);
      UI.setAdminFormFeedback('Editando jogo existente. Gere uma prévia se quiser revisar o resultado antes de salvar.', 'info');
      UI.toggleGameForm(true);
      UI.showView('admin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { UI.showToast(error.message, 'error'); }
  }

  async function handleDeleteGame(id, name) {
    if (!window.confirm(`Excluir o jogo "${name}"? Essa ação não pode ser desfeita.`)) return;
    try {
      const response = await ApiService.deleteGame(id);
      delete state.library[name];
      persistLibrary();
      await Promise.all([loadGames(), loadAdminSummary(), loadAdminGames()]);
      UI.renderAdminSummary(state.adminSummary);
      UI.showToast(response.message, 'success');
    } catch (error) { UI.showToast(error.message, 'error'); }
  }


  async function handleDuplicateGame(id) {
    try {
      const response = await ApiService.duplicateGame(id);
      await Promise.all([loadGames(), loadAdminSummary(), loadAdminGames()]);
      UI.renderAdminSummary(state.adminSummary);
      UI.showToast(response.message, 'success');
      UI.setAdminFormFeedback(`Cópia criada: ${response.game?.name || 'novo jogo'}.`, 'success');
    } catch (error) {
      UI.showToast(error.message, 'error');
      UI.setAdminFormFeedback(error.details?.join(' | ') || error.message, 'error');
    }
  }

  async function handlePreviewExistingGame(id) {
    try {
      const game = await ApiService.getGameById(id);
      UI.renderAdminPreview(game);
      UI.setAdminFormFeedback('Prévia aberta a partir do catálogo salvo.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      UI.showToast(error.message, 'error');
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault();
    try {
      const currentPassword = UI.qs('#currentPassword')?.value || '';
      const nextPassword = UI.qs('#nextPassword')?.value || '';
      const response = await ApiService.changePassword({ currentPassword, nextPassword });
      if (UI.qs('#passwordForm')) UI.qs('#passwordForm').reset();
      UI.togglePasswordPanel(false);
      UI.showToast(response.message, 'success');
      UI.setAdminFormFeedback('Senha atualizada com sucesso.', 'success');
    } catch (error) {
      UI.showToast(error.message, 'error');
      UI.setAdminFormFeedback(error.details?.join(' | ') || error.message, 'error');
    }
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    try {
      const username = UI.qs('#adminUsername').value.trim();
      const password = UI.qs('#adminPassword').value;
      const session = await ApiService.login({ username, password });
      state.session = session;
      UI.setAdminState(session);
      UI.closeAdminModal();
      UI.showToast(session.message, 'success');
      if (page === 'public') window.location.href = '/admin';
      else await openAdminPanel();
    } catch (error) { UI.showToast(error.message, 'error'); }
  }

  async function handleAdminLogout() {
    try {
      const response = await ApiService.logout();
      state.session = response;
      UI.setAdminState(response);
      UI.showToast(response.message, 'success');
      if (page === 'admin') { UI.openAdminModal(); UI.togglePreviewPanel(false); UI.togglePasswordPanel(false); UI.renderAdminGames({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } }); UI.renderAdminSummary({ totalGames: 0, totalTrophies: 0 }); }
      else navigate('home');
    } catch (error) { UI.showToast(error.message, 'error'); }
  }

  function bindEvents() {
    UI.qsa('[data-view-link]').forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      const view = button.dataset.viewLink;
      navigate(view);
    }));

    UI.qs('#view-home')?.addEventListener('click', async event => {
      const viewTrigger = event.target.closest('[data-view-link]');
      if (viewTrigger) {
        event.preventDefault();
        navigate(viewTrigger.dataset.viewLink);
        return;
      }

      const trigger = event.target.closest('[data-home-game]');
      if (trigger) {
        event.preventDefault();
        await loadGuideByName(trigger.dataset.homeGame);
        return;
      }

      const chip = event.target.closest('.atlas-chip');
      if (chip) {
        event.preventDefault();
        const value = chip.textContent.trim();
        if (!value || !UI.qs('#gameInput')) return;
        UI.qs('#gameInput').value = value;
        searchGames(value);
        await loadGuideByName(value);
      }
    });

    UI.qs('#adminAccessBtn')?.addEventListener('click', () => page === 'public' ? UI.openAdminModal() : openAdminPanel());
    UI.qs('#adminLogoutBtn')?.addEventListener('click', handleAdminLogout);
    UI.qs('#closeAdminModalBtn')?.addEventListener('click', UI.closeAdminModal);
    UI.qs('#adminModal')?.addEventListener('click', event => { if (event.target.id === 'adminModal') UI.closeAdminModal(); });
    UI.qs('#adminLoginForm')?.addEventListener('submit', handleAdminLogin);

    UI.qs('#btnLoad')?.addEventListener('click', event => { event.preventDefault(); loadGuideByName(UI.qs('#gameInput').value); });
    UI.qs('#gameInput')?.addEventListener('input', event => searchGames(event.target.value));
    UI.qs('#gameInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); loadGuideByName(event.target.value); } });
    UI.qs('#suggestions')?.addEventListener('click', event => { const button = event.target.closest('[data-suggestion]'); if (!button) return; UI.qs('#gameInput').value = button.dataset.suggestion; UI.hideSuggestions(); loadGuideByName(button.dataset.suggestion); });
    document.addEventListener('click', event => { const input = UI.qs('#gameInput'); const suggestions = UI.qs('#suggestions'); if (input && suggestions && !input.contains(event.target) && !suggestions.contains(event.target)) UI.hideSuggestions(); });

    UI.qs('#newGameBtn')?.addEventListener('click', () => { UI.resetGameForm(); UI.setAdminFormFeedback('Preencha os campos e use pré-visualizar para revisar antes de salvar.', 'info'); UI.toggleGameForm(true); });
    UI.qs('#previewGameBtn')?.addEventListener('click', openFormPreview);
    UI.qs('#closePreviewPanelBtn')?.addEventListener('click', () => UI.togglePreviewPanel(false));
    UI.qs('#previewOpenPublicBtn')?.addEventListener('click', event => { const slug = event.currentTarget.dataset.previewSlug; if (slug) window.open(`/jogo/${slug}`, '_blank', 'noopener'); });
    UI.qs('#togglePasswordPanelBtn')?.addEventListener('click', () => UI.togglePasswordPanel());
    UI.qs('#closePasswordPanelBtn')?.addEventListener('click', () => UI.togglePasswordPanel(false));
    UI.qs('#passwordForm')?.addEventListener('submit', handlePasswordChange);
    UI.qs('#adminRefreshBtn')?.addEventListener('click', async () => { await Promise.all([loadGames(), loadAdminSummary(), loadAdminGames()]); UI.showToast('Catálogo administrativo atualizado.', 'success'); });
    UI.qs('#cancelGameFormBtn')?.addEventListener('click', () => { UI.toggleGameForm(false); UI.setAdminFormFeedback('', 'info'); });
    UI.qs('#addTrophyBtn')?.addEventListener('click', () => UI.appendTrophyInput());
    UI.qs('#parseTrophiesBtn')?.addEventListener('click', handleParseTrophies);
    UI.qs('#clearParsedTextBtn')?.addEventListener('click', () => {
      const field = UI.qs('#rawTrophiesInput');
      if (field) field.value = '';
      UI.showToast('Texto bruto limpo.', 'success');
    });
    UI.qs('#gameForm')?.addEventListener('submit', handleGameSubmit);
    UI.qs('#uploadCoverBtn')?.addEventListener('click', handleUploadCover);
    UI.qs('#clearImageBtn')?.addEventListener('click', () => { if (UI.qs('#gameImageFile')) UI.qs('#gameImageFile').value = ''; if (UI.qs('#gameImage')) UI.qs('#gameImage').value = ''; UI.setImagePreview(''); UI.setUploadState(false, 'Capa removida do formulário.'); });
    UI.qs('#gameImage')?.addEventListener('input', event => UI.setImagePreview(event.target.value.trim()));
    UI.qs('#gameImageFile')?.addEventListener('change', event => { const file = event.target.files?.[0]; UI.setUploadState(false, file ? `Arquivo selecionado: ${file.name}` : ''); });

    UI.qs('#trophiesContainer')?.addEventListener('click', event => {
      const removeButton = event.target.closest('[data-remove-trophy]'); if (!removeButton) return;
      const items = UI.qsa('#trophiesContainer .trophy-input');
      if (items.length <= 1) return UI.showToast('O jogo precisa ter pelo menos um troféu.', 'error');
      removeButton.closest('.trophy-input').remove();
    });

    UI.qsa('.filter-btn').forEach(button => button.addEventListener('click', () => { state.activeFilter = button.dataset.filter; UI.applyTrophyFilter(state.activeFilter, state.guideSearch); }));
    UI.bindGuideSearch(event => { state.guideSearch = event.target.value || ''; UI.applyTrophyFilter(state.activeFilter, state.guideSearch); });
    UI.qs('#trophyList')?.addEventListener('click', event => {
      const toggleButton = event.target.closest('[data-trophy-toggle]');
      if (toggleButton) return toggleTrophy(toggleButton.dataset.trophyToggle);
      const spoiler = event.target.closest('[data-spoiler]');
      if (spoiler) { spoiler.classList.remove('spoiler-blur'); spoiler.classList.add('spoiler-unveiled'); }
    });
    UI.qs('#guideHeader')?.addEventListener('click', async event => {
      const copyButton = event.target.closest('[data-copy-game-link]');
      if (copyButton) {
        const url = `${window.location.origin}/jogo/${copyButton.dataset.copyGameLink}`;
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
          else window.prompt('Copie este link:', url);
          UI.showToast('Link da página copiado.', 'success');
        } catch (error) {
          window.prompt('Copie este link:', url);
        }
        return;
      }
    });

    window.addEventListener('popstate', async () => {
      if (page !== 'public') return;
      const path = window.location.pathname;
      if (path.startsWith('/jogo/')) {
        const slug = decodeURIComponent(path.split('/jogo/')[1] || '');
        await loadGuideBySlug(slug, { skipHistory: true });
        return;
      }
      if (path === '/biblioteca') {
        navigate('library', { skipHistory: true });
        return;
      }
      if (path === '/catalogo' || path.startsWith('/catalogo/')) {
        state.catalogFacet = getCatalogFacetFromPath(path);
        state.catalogPage = 1;
        await loadCatalogPage({ page: 1, facet: state.catalogFacet });
        navigate('catalog', { skipHistory: true, facet: state.catalogFacet });
        return;
      }
      navigate('home', { skipHistory: true });
    });

    UI.qs('#view-library')?.addEventListener('click', event => {
      const deleteButton = event.target.closest('[data-delete-game]');
      if (deleteButton) {
        event.preventDefault();
        event.stopPropagation();
        return deleteFromLibrary(deleteButton.dataset.deleteGame);
      }
      const openButton = event.target.closest('[data-open-game]');
      if (openButton) {
        event.preventDefault();
        const slug = openButton.dataset.openSlug || '';
        const name = openButton.dataset.openGame || '';
        if (slug) return loadGuideBySlug(slug);
        if (name) return loadFromLibrary(name);
      }
      const card = event.target.closest('[data-library-game]');
      if (card) loadFromLibrary(card.dataset.libraryGame);
    });

    UI.qs('#librarySearch')?.addEventListener('input', event => {
      state.librarySearch = event.target.value || '';
      UI.renderLibrary(state.library, { search: state.librarySearch, sort: state.librarySort });
    });

    UI.qs('#librarySort')?.addEventListener('change', event => {
      state.librarySort = event.target.value || 'continue';
      UI.renderLibrary(state.library, { search: state.librarySearch, sort: state.librarySort });
    });

    UI.qs('#catalogSearch')?.addEventListener('input', async event => {
      state.catalogSearch = event.target.value || '';
      state.catalogPage = 1;
      await loadCatalogPage({ page: 1 });
    });

    UI.qs('#catalogSort')?.addEventListener('change', async event => {
      state.catalogSort = event.target.value || 'updated-desc';
      state.catalogPage = 1;
      await loadCatalogPage({ page: 1 });
    });

    UI.qs('#adminSearch')?.addEventListener('input', async event => {
      state.adminSearch = event.target.value || '';
      state.adminPage = 1;
      await loadAdminGames();
    });

    UI.qs('#adminSort')?.addEventListener('change', async event => {
      state.adminSort = event.target.value || 'updated-desc';
      state.adminPage = 1;
      await loadAdminGames();
    });


    UI.qs('#view-catalog')?.addEventListener('click', async event => {
      const facetButton = event.target.closest('[data-catalog-facet]');
      if (facetButton) {
        event.preventDefault();
        state.catalogFacet = facetButton.dataset.catalogFacet || 'all';
        state.catalogPage = 1;
        await loadCatalogPage({ page: 1, facet: state.catalogFacet });
        navigate('catalog', { facet: state.catalogFacet });
        return;
      }

      const gameLink = event.target.closest('[data-home-game]');
      if (gameLink) {
        event.preventDefault();
        loadGuideByName(gameLink.dataset.homeGame);
      }
    });


    document.addEventListener('click', async event => {
      const pageButton = event.target.closest('[data-page-target][data-page-value]');
      if (!pageButton) return;
      const pageTarget = pageButton.dataset.pageTarget;
      const pageValue = Number(pageButton.dataset.pageValue || 1);
      if (!Number.isInteger(pageValue) || pageValue <= 0) return;
      if (pageTarget === 'catalog') {
        state.catalogPage = pageValue;
        await loadCatalogPage({ page: state.catalogPage });
        navigate('catalog', { facet: state.catalogFacet, skipHistory: true });
      }
      if (pageTarget === 'admin') {
        state.adminPage = pageValue;
        await loadAdminGames();
      }
    });

    UI.qs('#adminGamesList')?.addEventListener('click', event => {
      const editButton = event.target.closest('[data-admin-edit]'); if (editButton) return handleEditGame(editButton.dataset.adminEdit);
      const previewButton = event.target.closest('[data-admin-preview]'); if (previewButton) return handlePreviewExistingGame(previewButton.dataset.adminPreview);
      const duplicateButton = event.target.closest('[data-admin-duplicate]'); if (duplicateButton) return handleDuplicateGame(duplicateButton.dataset.adminDuplicate);
      const deleteButton = event.target.closest('[data-admin-delete]'); if (deleteButton) handleDeleteGame(deleteButton.dataset.adminDelete, deleteButton.dataset.adminName);
    });
  }

  async function init() {
    try {
      UI.updateLibraryBadge(state.library);
      UI.resetGameForm();
      bindEvents();
      await Promise.all([loadGames(), syncSession()]);
      await loadCatalogPage({ page: 1 });
      if (page === 'admin') {
        UI.showView('admin');
        if (state.session.authenticated) await openAdminPanel();
        else UI.openAdminModal();
      } else {
        const path = window.location.pathname;
        if (path.startsWith('/jogo/')) {
          const slug = decodeURIComponent(path.split('/jogo/')[1] || '');
          await loadGuideBySlug(slug, { skipHistory: true });
        } else if (path === '/biblioteca') {
          navigate('library', { skipHistory: true });
        } else if (path === '/catalogo' || path.startsWith('/catalogo/')) {
          state.catalogFacet = getCatalogFacetFromPath(path);
          state.catalogPage = 1;
          await loadCatalogPage({ page: 1, facet: state.catalogFacet });
          navigate('catalog', { skipHistory: true, facet: state.catalogFacet });
        } else {
          navigate('home', { skipHistory: true });
        }
      }
    } catch (error) { UI.showToast(`Falha ao iniciar: ${error.message}`, 'error'); }
  }

  init();
})();

(function(){
 const form=document.getElementById('gameForm');
 if(!form) return;
 const KEY='admin_game_draft_v1';
 const restore=document.getElementById('restoreDraftBtn');
 const clear=document.getElementById('clearDraftBtn');

 function syncAdminDraftUI(){
   const imageInput = document.getElementById('gameImage');
   if (imageInput && typeof UI !== 'undefined' && typeof UI.setImagePreview === 'function') {
     UI.setImagePreview(imageInput.value || '');
   }
   if (typeof window.openFormPreview === 'function') {
     try { window.openFormPreview(); } catch (e) {}
   }
 }

 function save(){
   const data={};
   form.querySelectorAll('input,textarea,select').forEach(el=>{
     if (el.type === 'file') return;
     const k=el.name||el.id;
     if(k) data[k]=el.value;
   });
   localStorage.setItem(KEY, JSON.stringify(data));
 }

 function restoreDraft(){
   const raw=localStorage.getItem(KEY);
   if(!raw) return;
   try{
     const data=JSON.parse(raw);
     form.querySelectorAll('input,textarea,select').forEach(el=>{
       if (el.type === 'file') return;
       const k=el.name||el.id;
       if(k && data[k]!==undefined) el.value=data[k];
     });
     syncAdminDraftUI();
     alert('Rascunho restaurado');
   }catch(e){
     alert('Não foi possível restaurar o rascunho salvo.');
   }
 }

 function clearDraft(){
   localStorage.removeItem(KEY);
   alert('Rascunho removido');
 }

 form.addEventListener('input', save);
 if(restore) restore.addEventListener('click', restoreDraft);
 if(clear) clear.addEventListener('click', clearDraft);
})();;
