(function () {
  'use strict';

  const root = document.documentElement;
  const view = document.querySelector('#view-guide.atlas-guide--resident-evil-5');
  if (!view) {
    root.classList.remove('re5-js');
    return;
  }

  const state = window.__INITIAL_STATE__ || {};
  const game = state.game || {};
  const slug = String(game.slug || 'resident-evil-5');
  const gameId = Number(game.id || 0);
  const libraryKey = 'trophy_library_v2';
  const densityKey = 'atlas_checklist_density';
  const phase6StateKey = 'atlas_re5_phase6_state_v1';
  const tabs = Array.from(document.querySelectorAll('#guideLayerNav [role="tab"]'));
  const panels = Array.from(document.querySelectorAll('[data-guide-tab-panel]'));
  const cards = Array.from(document.querySelectorAll('#trophyList [data-trophy-id]'));
  const extraChecks = Array.from(document.querySelectorAll('[data-platinum-extra-check]'));
  const completed = new Set();
  const completedRoadmapStages = new Set();
  const completedChapters = new Set();
  const completedExtras = new Set();
  const sessionLibrary = {};
  const sessionPhase6State = { roadmap: [], chapters: [], extras: [] };
  let persistentStorage = true;
  let activeFilter = 'all';
  let searchValue = '';
  let filterAnnouncementTimer = 0;
  let csrfToken = '';
  let scrollFrame = 0;

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function setStatus(message, tone) {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    toast.textContent = String(message || '');
    toast.dataset.tone = tone || 'info';
  }

  function revealLinearFallback(message) {
    root.classList.remove('re5-js');
    root.className = root.className.replace(/\bre5-tab-[a-z-]+\b/g, '').trim();
    panels.forEach(panel => {
      panel.hidden = false;
      panel.classList.remove('hidden');
      panel.setAttribute('aria-hidden', 'false');
    });
    document.querySelectorAll('[data-guide-section-content]').forEach(content => {
      content.hidden = false;
      content.classList.remove('is-collapsed');
      content.setAttribute('aria-hidden', 'false');
    });
    if (message) setStatus(message, 'warning');
  }

  function safeReadLibrary() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(libraryKey) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
      persistentStorage = false;
      return sessionLibrary;
    }
  }

  function safeWriteLibrary(library) {
    Object.keys(sessionLibrary).forEach(key => delete sessionLibrary[key]);
    Object.assign(sessionLibrary, library);
    if (!persistentStorage) return false;
    try {
      window.localStorage.setItem(libraryKey, JSON.stringify(library));
      return true;
    } catch (_error) {
      persistentStorage = false;
      setStatus('O progresso funciona nesta sessão, mas não pôde ser salvo neste navegador.', 'warning');
      return false;
    }
  }

  function safeReadPhase6State() {
    if (!persistentStorage) return sessionPhase6State;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(phase6StateKey) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
      persistentStorage = false;
      return sessionPhase6State;
    }
  }

  function persistPhase6State() {
    const next = {
      roadmap: Array.from(completedRoadmapStages),
      chapters: Array.from(completedChapters),
      extras: Array.from(completedExtras)
    };
    Object.assign(sessionPhase6State, next);
    if (!persistentStorage) return;
    try {
      window.localStorage.setItem(phase6StateKey, JSON.stringify(next));
    } catch (_error) {
      persistentStorage = false;
      setStatus('O estado desta sessão funciona, mas não pôde ser salvo neste navegador.', 'warning');
    }
  }

  function getLibraryEntry(library) {
    return library[slug] || Object.values(library).find(entry => normalize(entry && entry.slug) === normalize(slug)) || null;
  }

  function persistProgress(options) {
    const library = safeReadLibrary();
    const current = getLibraryEntry(library) || {};
    const entry = {
      ...current,
      id: gameId || current.id,
      slug,
      name: game.name || current.name || 'Resident Evil 5',
      completed: Array.from(completed),
      savedAt: current.savedAt || new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      status: completed.size === cards.length ? 'completed' : (completed.size ? 'playing' : 'backlog')
    };
    if (options && options.remove) delete library[slug];
    else library[slug] = entry;
    safeWriteLibrary(library);
    updateSaveButtons(Boolean(library[slug]));
  }

  function updateSaveButtons(saved) {
    document.querySelectorAll('[data-toggle-save-game]').forEach(button => {
      button.setAttribute('aria-pressed', saved ? 'true' : 'false');
      const textNode = Array.from(button.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      const label = saved ? 'Salvo na biblioteca' : 'Salvar na biblioteca';
      if (textNode) textNode.textContent = label;
      else {
        const span = button.querySelector('span');
        if (span) span.textContent = label;
      }
    });
  }

  function updateCard(card, isCompleted) {
    const button = card.querySelector('[data-trophy-toggle]');
    const stateLabel = card.querySelector('.atlas-trophy-state');
    const name = card.querySelector('h3, h4')?.textContent?.trim() || 'troféu';
    card.classList.toggle('completed', isCompleted);
    card.dataset.status = isCompleted ? 'completed' : 'pending';
    if (stateLabel) {
      stateLabel.textContent = isCompleted ? 'Concluído' : 'Pendente';
      stateLabel.classList.toggle('atlas-trophy-state--done', isCompleted);
    }
    if (button) {
      button.setAttribute('aria-pressed', isCompleted ? 'true' : 'false');
      button.setAttribute('aria-label', `${isCompleted ? 'Desmarcar' : 'Concluir'} ${name}`);
      const phase6Toggle = button.classList.contains('atlas-re5-trophy-toggle');
      button.classList.toggle('atlas-btn-primary', !phase6Toggle && !isCompleted);
      button.classList.toggle('atlas-btn-secondary', phase6Toggle || isCompleted);
      const label = button.querySelector('span');
      if (label) label.textContent = isCompleted ? 'Desmarcar' : 'Concluir';
      const icon = button.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-check', !isCompleted);
        icon.classList.toggle('fa-rotate-left', isCompleted);
      }
    }
  }

  function updateProgress() {
    const total = cards.length;
    const done = completed.size;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const updates = [
      ['#progressPercent', `${percent}%`],
      ['#guideCounter', `${done}/${total} concluídos`],
      ['#guideProgressLabel', `${percent}%`],
      ['#guideCompletedCount', String(done)],
      ['#guideRemainingCount', String(Math.max(0, total - done))]
    ];
    updates.forEach(([selector, value]) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    });
    document.querySelectorAll('[data-quick-dock-progress]').forEach(node => {
      node.textContent = `${percent}%`;
      node.setAttribute('aria-label', `Progresso atual: ${percent}%`);
    });
    const bar = document.querySelector('#guideProgressBar');
    if (bar) bar.style.width = `${percent}%`;
    updateRecommendedNextAction();
  }

  function getSectionToggle(content) {
    if (!content?.id) return null;
    return document.querySelector(`[data-guide-section-toggle="${CSS.escape(content.id)}"]`);
  }

  function openContainingSections(target) {
    let content = target?.matches?.('[data-guide-section-content]')
      ? target
      : target?.closest?.('[data-guide-section-content]');
    while (content) {
      const button = getSectionToggle(content);
      if (button) setSectionExpanded(button, content, true);
      content = content.parentElement?.closest?.('[data-guide-section-content]') || null;
    }
  }

  function navigateToTarget(targetId, options) {
    const target = document.getElementById(String(targetId || ''));
    if (!target) return false;
    const panelName = target.closest('[data-guide-tab-panel]')?.dataset.guideTabPanel || options?.tab;
    if (panelName) activateTab(panelName, { history: false, scroll: false });
    openContainingSections(target);
    if (options?.history !== false) {
      const hash = `#${target.id}`;
      if (window.location.hash !== hash) window.history.pushState({ guideTarget: target.id }, '', hash);
    }
    target.scrollIntoView({ block: 'start', behavior: 'auto' });
    return true;
  }

  function updateRecommendedNextAction() {
    const panel = document.querySelector('[data-re5-next-action]');
    if (!panel) return;
    const title = panel.querySelector('[data-re5-next-title]');
    const detail = panel.querySelector('[data-re5-next-detail]');
    const button = panel.querySelector('[data-re5-next-button]');
    const stages = Array.from(document.querySelectorAll('[data-roadmap-stage]'));
    const nextStage = stages.find(stage => !completedRoadmapStages.has(String(stage.dataset.roadmapStage || '')));

    if (cards.length && completed.size >= cards.length) {
      if (title) title.textContent = 'Platina concluída: avance para os DLCs e o 100%';
      if (detail) detail.textContent = 'Os 51 troféus base estão marcados. Versus, Lost in Nightmares e Desperate Escape são agora a próxima rota opcional.';
      if (button) {
        button.textContent = 'Abrir DLCs e 100%';
        delete button.dataset.roadmapJump;
        button.dataset.guideAction = 'dlcs';
      }
      return;
    }

    if (!nextStage) {
      if (title) title.textContent = 'Roadmap concluído: revise a checklist da platina';
      if (detail) detail.textContent = 'As sete etapas foram marcadas. Use o filtro Pendentes para localizar o que ainda falta entre os 51 troféus base.';
      if (button) {
        button.textContent = 'Ver troféus pendentes';
        delete button.dataset.roadmapJump;
        button.dataset.guideAction = 'first-pending';
      }
      return;
    }

    const number = String(nextStage.dataset.roadmapStage || '1');
    const stageTitle = nextStage.querySelector('h3')?.textContent?.trim() || `Etapa ${number}`;
    const progressed = completed.size > 0 || completedRoadmapStages.size > 0;
    if (title) title.textContent = progressed ? `Próxima etapa: ${stageTitle}` : 'Comece pela campanha em Normal ou Veteran';
    if (detail) detail.textContent = progressed
      ? 'Esta é a primeira etapa do roadmap que ainda não foi marcada como concluída.'
      : 'Abra a primeira etapa do roadmap, avance a história e use o checklist sem tentar limpar tudo na primeira passagem.';
    if (button) {
      button.textContent = `Abrir etapa ${number}`;
      delete button.dataset.guideAction;
      button.dataset.roadmapJump = nextStage.id;
    }
  }

  function updateRoadmapState() {
    document.querySelectorAll('[data-roadmap-stage]').forEach(stage => {
      const number = String(stage.dataset.roadmapStage || '');
      const done = completedRoadmapStages.has(number);
      stage.classList.toggle('is-complete', done);
      const button = stage.querySelector('[data-roadmap-toggle]');
      if (button) {
        button.setAttribute('aria-pressed', done ? 'true' : 'false');
        const label = button.querySelector('[data-roadmap-toggle-label]');
        if (label) label.textContent = done ? 'Etapa concluída' : 'Marcar etapa';
      }
      const summary = document.querySelector(`[data-roadmap-summary-stage="${CSS.escape(number)}"]`);
      if (summary) {
        summary.classList.toggle('is-complete', done);
        const stateLabel = summary.querySelector('[data-roadmap-summary-state]');
        if (stateLabel) stateLabel.textContent = done ? 'Concluída' : 'Pendente';
      }
    });
    const next = Array.from(document.querySelectorAll('[data-roadmap-summary-stage]')).find(item => !item.classList.contains('is-complete'));
    if (next) {
      const stateLabel = next.querySelector('[data-roadmap-summary-state]');
      if (stateLabel) stateLabel.textContent = 'Próxima';
    }
    updateRecommendedNextAction();
  }

  function updateChapterState() {
    document.querySelectorAll('[data-re5-chapter]').forEach(chapter => {
      const number = String(chapter.dataset.re5Chapter || '');
      const done = completedChapters.has(number);
      chapter.classList.toggle('is-complete', done);
      const stateLabel = chapter.querySelector('[data-chapter-state]');
      if (stateLabel) stateLabel.textContent = done ? 'Concluído' : 'Pendente';
      const button = chapter.querySelector('[data-chapter-toggle]');
      if (button) {
        button.setAttribute('aria-pressed', done ? 'true' : 'false');
        const label = button.querySelector('[data-chapter-toggle-label]');
        if (label) label.textContent = done ? 'Capítulo concluído' : 'Marcar capítulo concluído';
      }
    });
  }

  function updateExtraProgress() {
    extraChecks.forEach(input => {
      const id = String(input.dataset.platinumExtraCheck || '');
      input.checked = completedExtras.has(id);
    });

    document.querySelectorAll('[data-extra-category-card]').forEach(card => {
      const id = String(card.dataset.extraCategoryCard || '');
      const inputs = Array.from(card.querySelectorAll('[data-platinum-extra-check]'));
      const done = inputs.filter(input => completedExtras.has(String(input.dataset.platinumExtraCheck || ''))).length;
      const count = card.querySelector(`[data-extra-category-count="${CSS.escape(id)}"]`);
      const stateLabel = card.querySelector('[data-extra-category-state]');
      if (count) count.textContent = `${done}/${inputs.length}`;
      if (stateLabel) stateLabel.textContent = done === inputs.length && inputs.length ? 'Concluído' : done ? 'Em progresso' : 'Não iniciado';
      card.classList.toggle('is-complete', done === inputs.length && inputs.length > 0);
    });

    document.querySelectorAll('[data-dlc-progress]').forEach(progress => {
      const key = String(progress.dataset.dlcProgress || '');
      const inputs = Array.from(document.querySelectorAll(`[data-dlc-progress-group="${CSS.escape(key)}"]`));
      const done = inputs.filter(input => completedExtras.has(String(input.dataset.platinumExtraCheck || ''))).length;
      const percent = inputs.length ? Math.round((done / inputs.length) * 100) : 0;
      const count = progress.querySelector('[data-dlc-progress-count]');
      const percentLabel = progress.querySelector('[data-dlc-progress-percent]');
      const bar = progress.querySelector('[data-dlc-progress-bar]');
      if (count) count.textContent = `${done}/${inputs.length} ${inputs.length === 1 ? 'troféu' : 'troféus'}`;
      if (percentLabel) percentLabel.textContent = `${percent}%`;
      if (bar) bar.style.width = `${percent}%`;
      document.querySelectorAll(`[data-dlc-package-summary-progress="${CSS.escape(key)}"]`).forEach(node => {
        node.textContent = `${done}/${inputs.length}`;
      });
    });

    document.querySelectorAll('[data-dlc-collectible-progress]').forEach(progress => {
      const key = String(progress.dataset.dlcCollectibleProgress || '');
      const inputs = Array.from(document.querySelectorAll(`[data-dlc-collectible-group="${CSS.escape(key)}"]`));
      const done = inputs.filter(input => completedExtras.has(String(input.dataset.platinumExtraCheck || ''))).length;
      const count = progress.querySelector('[data-dlc-collectible-count]');
      if (count) count.textContent = `${done}/${inputs.length} encontrados`;
    });
  }

  function applyExtrasSearch(value) {
    const query = normalize(value);
    let visibleCategories = 0;
    let visibleItems = 0;
    document.querySelectorAll('[data-extra-category-card]').forEach(card => {
      const items = Array.from(card.querySelectorAll('[data-platinum-extra-item]'));
      const heading = normalize(card.querySelector('.atlas-re5-extra-heading')?.textContent || '');
      const categoryMatch = Boolean(query && heading.includes(query));
      items.forEach(item => {
        const show = !query || categoryMatch || normalize(item.textContent).includes(query);
        item.hidden = !show;
        if (show) visibleItems += 1;
      });
      const showCategory = !query || categoryMatch || items.some(item => !item.hidden);
      card.hidden = !showCategory;
      if (showCategory) visibleCategories += 1;
      if (query && showCategory) {
        const content = card.querySelector('[data-guide-section-content]');
        const button = getSectionToggle(content);
        if (content && button) setSectionExpanded(button, content, true);
      }
    });
    const status = document.querySelector('#extrasSearchStatus');
    if (status) status.textContent = query
      ? `${visibleItems} itens em ${visibleCategories} categorias`
      : `${visibleCategories} categorias disponíveis`;
  }

  function initializePhase6State() {
    const saved = safeReadPhase6State();
    (Array.isArray(saved.roadmap) ? saved.roadmap : []).forEach(id => completedRoadmapStages.add(String(id)));
    (Array.isArray(saved.chapters) ? saved.chapters : []).forEach(id => completedChapters.add(String(id)));
    (Array.isArray(saved.extras) ? saved.extras : []).forEach(id => completedExtras.add(String(id)));
    updateRoadmapState();
    updateChapterState();
    updateExtraProgress();
    const filterDrawer = document.querySelector('.atlas-re5-filter-drawer');
    if (filterDrawer) filterDrawer.open = window.matchMedia('(min-width: 769px)').matches;
  }

  async function requestJson(url, options) {
    const requestOptions = { credentials: 'include', ...(options || {}) };
    requestOptions.headers = { 'Content-Type': 'application/json', ...(requestOptions.headers || {}) };
    if (!['GET', 'HEAD'].includes(String(requestOptions.method || 'GET').toUpperCase()) && csrfToken) {
      requestOptions.headers['X-CSRF-Token'] = csrfToken;
    }
    const response = await fetch(url, requestOptions);
    csrfToken = response.headers.get('x-csrf-token') || csrfToken;
    const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {};
    if (payload && payload.csrfToken) csrfToken = payload.csrfToken;
    if (!response.ok) throw new Error(payload?.error?.message || payload?.message || 'Não foi possível concluir a operação.');
    return payload;
  }

  async function syncAccountProgress(trophyId, isCompleted) {
    if (!state.actorAuthenticated || !gameId) return;
    try {
      if (!csrfToken) await requestJson('/api/auth/me');
      await requestJson(`/api/me/progress/${encodeURIComponent(gameId)}/${encodeURIComponent(trophyId)}`, {
        method: 'PATCH',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ completed: isCompleted, scope: 'user' })
      });
    } catch (_error) {
      setStatus('O progresso foi mantido nesta sessão, mas a sincronização da conta falhou.', 'warning');
    }
  }

  function setCompletedIds(ids) {
    completed.clear();
    (Array.isArray(ids) ? ids : []).forEach(id => completed.add(String(id)));
    cards.forEach(card => updateCard(card, completed.has(String(card.dataset.trophyId || ''))));
    updateProgress();
  }

  async function loadAccountLibrary() {
    if (!state.actorAuthenticated) return;
    try {
      const payload = await requestJson('/api/me/library');
      const library = payload && typeof payload.library === 'object' ? payload.library : payload;
      const entry = library && typeof library === 'object' ? getLibraryEntry(library) : null;
      if (entry && Array.isArray(entry.completed)) {
        setCompletedIds(entry.completed);
        updateSaveButtons(true);
      }
    } catch (_error) {
      // The SSR and session/local progress remain authoritative when the API fails.
    }
  }

  function tabFromHash() {
    const direct = window.location.hash.match(/^#guideTab-(summary|roadmap|checklist|extras|dlc|attention)$/);
    if (direct) return direct[1];
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    return target?.closest?.('[data-guide-tab-panel]')?.dataset.guideTabPanel || 'summary';
  }

  function activateTab(name, options) {
    const nextName = tabs.some(tab => tab.dataset.guideTabButton === name) ? name : 'summary';
    tabs.forEach(tab => {
      const active = tab.dataset.guideTabButton === nextName;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => {
      const active = panel.dataset.guideTabPanel === nextName;
      panel.hidden = !active;
      panel.classList.toggle('hidden', !active);
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    root.className = root.className.replace(/\bre5-tab-[a-z-]+\b/g, '').trim();
    root.classList.add(`re5-tab-${nextName}`);
    if (options?.history) {
      const hash = `#guideTab-${nextName}`;
      if (window.location.hash !== hash) window.history[options.history === 'replace' ? 'replaceState' : 'pushState']({ guideTab: nextName }, '', hash);
    }
    if (options?.focus) tabs.find(tab => tab.dataset.guideTabButton === nextName)?.focus({ preventScroll: true });
    if (options?.scroll) document.querySelector(`#guideTab-${nextName}`)?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  function revealHashTarget() {
    const id = window.location.hash.slice(1);
    if (!id || /^guideTab-(summary|roadmap|checklist|extras|dlc|attention)$/.test(id)) return;
    navigateToTarget(id, { history: false });
  }

  function initializeTabs() {
    activateTab(tabFromHash(), { history: false });
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', event => {
        event.preventDefault();
        activateTab(tab.dataset.guideTabButton, { history: 'push', scroll: true });
      });
      tab.addEventListener('keydown', event => {
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else if (event.key === 'Enter' || event.key === ' ') nextIndex = index;
        else return;
        event.preventDefault();
        activateTab(tabs[nextIndex].dataset.guideTabButton, { history: 'push', focus: true, scroll: false });
      });
    });
    window.addEventListener('popstate', () => {
      activateTab(tabFromHash(), { history: false });
      revealHashTarget();
    });
    window.addEventListener('hashchange', () => {
      activateTab(tabFromHash(), { history: false });
      revealHashTarget();
    });
    window.requestAnimationFrame(revealHashTarget);
  }

  function setSectionExpanded(button, content, expanded) {
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    content.dataset.re5Collapsed = expanded ? 'false' : 'true';
    content.hidden = !expanded;
    content.classList.toggle('is-collapsed', !expanded);
    content.setAttribute('aria-hidden', expanded ? 'false' : 'true');
    const label = button.querySelector('[data-toggle-label]');
    if (label) label.textContent = expanded ? (button.dataset.expandedLabel || 'Ocultar detalhes') : (button.dataset.collapsedLabel || 'Mostrar detalhes');
    const icon = button.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-chevron-up', expanded);
      icon.classList.toggle('fa-chevron-down', !expanded);
    }
  }

  function initializeAccordions() {
    document.querySelectorAll('[data-re5-collapsed="true"]').forEach(content => {
      const button = document.querySelector(`[data-guide-section-toggle="${CSS.escape(content.id)}"]`);
      if (button) setSectionExpanded(button, content, false);
    });
  }

  function setDensity(density, persist) {
    const normalized = density === 'comfortable' ? 'comfortable' : 'compact';
    const list = document.querySelector('#trophyList');
    if (list) {
      list.dataset.checklistDensity = normalized;
      list.classList.toggle('is-compact', normalized === 'compact');
      list.classList.toggle('is-comfortable', normalized === 'comfortable');
    }
    document.querySelectorAll('[data-checklist-density]').forEach(button => {
      const active = button.dataset.checklistDensity === normalized;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    cards.forEach(card => {
      const details = card.querySelector('[data-trophy-details]');
      const toggle = card.querySelector('[data-trophy-details-toggle]');
      if (!details || !toggle) return;
      const expanded = normalized === 'comfortable';
      details.hidden = !expanded;
      details.setAttribute('aria-hidden', expanded ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      const label = toggle.querySelector('[data-details-label]');
      if (label) label.textContent = expanded ? 'Ocultar detalhes' : 'Ver detalhes';
    });
    if (persist && persistentStorage) {
      try {
        window.localStorage.setItem(densityKey, normalized);
      } catch (_error) {
        persistentStorage = false;
        setStatus('A preferência visual funciona nesta sessão, mas não pôde ser salva.', 'warning');
      }
    }
  }

  function matchesCard(card) {
    const id = String(card.dataset.trophyId || '');
    const done = completed.has(id);
    const filter = normalize(activeFilter);
    const statusMatch = filter === 'all'
      || (filter === 'pending' && !done)
      || (filter === 'completed' && done);
    const typeMatch = normalize(card.dataset.type) === filter;
    const riskMatch = normalize(card.dataset.risks).split(/\s+/).includes(filter);
    const filterMatch = statusMatch || typeMatch || riskMatch;
    const searchMatch = !searchValue || normalize(card.dataset.search).includes(searchValue);
    return filterMatch && searchMatch;
  }

  function applyFilters(announce) {
    let visible = 0;
    cards.forEach(card => {
      const show = matchesCard(card);
      card.hidden = !show;
      if (show) visible += 1;
    });
    const results = document.querySelector('#guideResults');
    const empty = document.querySelector('#guideEmptyState');
    const message = `${visible} ${visible === 1 ? 'troféu visível' : 'troféus visíveis'}`;
    if (empty) {
      empty.hidden = visible !== 0;
      empty.classList.toggle('hidden', visible !== 0);
      empty.setAttribute('aria-hidden', visible === 0 ? 'false' : 'true');
      empty.textContent = visible === 0 ? 'Nenhum troféu corresponde à busca e ao filtro selecionado.' : '';
    }
    if (announce && results) {
      window.clearTimeout(filterAnnouncementTimer);
      filterAnnouncementTimer = window.setTimeout(() => {
        results.textContent = message;
      }, 220);
    } else if (results) {
      results.textContent = message;
    }
  }

  function initializeChecklist() {
    const localLibrary = safeReadLibrary();
    const localEntry = getLibraryEntry(localLibrary);
    setCompletedIds(localEntry?.completed || []);
    updateSaveButtons(Boolean(localEntry));
    const trophyList = document.querySelector('#trophyList');
    if (trophyList) trophyList.setAttribute('aria-live', 'off');
    let density = 'compact';
    if (persistentStorage) {
      try {
        density = window.localStorage.getItem(densityKey) || 'compact';
      } catch (_error) {
        persistentStorage = false;
      }
    }
    setDensity(density, false);
    applyFilters(false);
    void loadAccountLibrary();
  }

  function focusAction(action) {
    const map = {
      summary: ['summary', '#guideSummaryActions'],
      roadmap: ['roadmap', '#guideRoadmapPanel'],
      quick: ['summary', '#guideQuickPlan'],
      'chapter-route': ['roadmap', '#guideChapterRoutePanel'],
      professional: ['roadmap', '#guideProfessionalAiPanel'],
      farm: ['roadmap', '#guideFarmRoutesPanel'],
      myths: ['roadmap', '#guideCommonMythsPanel'],
      trophies: ['checklist', '#guideChecklistPanel'],
      checklist: ['checklist', '#guideChecklistPanel'],
      extras: ['extras', '#guidePlatinumExtrasPanel'],
      dlcs: ['dlc', '#guideDlcCompletionPanel'],
      attention: ['attention', '#guideAttentionPointsPanel'],
      faq: ['summary', '#guideFaqPanel'],
      comments: ['summary', '#guideCommentsPanel'],
      related: ['summary', '#guideRelatedPanel'],
      search: ['checklist', '#trophySearch'],
      'first-pending': ['checklist', '[data-trophy-id]:not(.completed)']
    };
    const target = map[action];
    if (!target) return false;
    activateTab(target[0], { history: 'push', scroll: false });
    const element = document.querySelector(target[1]);
    if (!element) return true;
    element.scrollIntoView({ block: 'start', behavior: 'auto' });
    if (action === 'search') element.focus({ preventScroll: true });
    return true;
  }

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${source}"]`);
      if (existing?.dataset.loaded === 'true') return resolve();
      const script = existing || document.createElement('script');
      script.src = source;
      script.defer = true;
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Falha ao carregar ${source}`)), { once: true });
      if (!existing) document.head.appendChild(script);
    });
  }

  async function openFeedback() {
    try {
      await loadScript('/js/api.js');
      await loadScript('/js/app-modal-factories.js');
      await loadScript('/js/app-feedback.js');
      await window.ApiService?.getCurrentUser?.().catch(() => null);
      window.AppModalFactories?.ensureFeedbackModal?.();
      window.AppFeedback?.bind?.();
      window.AppFeedback?.openGuideFeedback?.({ gameSlug: slug, gameName: game.name || 'Resident Evil 5' });
    } catch (_error) {
      setStatus('O formulário de feedback não carregou. O guia continua disponível; tente novamente mais tarde.', 'warning');
    }
  }

  function ensureAuthDialog(mode) {
    let dialog = document.querySelector('#re5LiteAuthDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 're5LiteAuthDialog';
      dialog.className = 'atlas-lite-dialog';
      dialog.setAttribute('aria-labelledby', 're5LiteAuthTitle');
      dialog.innerHTML = `
        <form method="dialog" class="atlas-lite-dialog__body" data-lite-auth-form>
          <div class="atlas-lite-dialog__head">
            <h2 id="re5LiteAuthTitle">Acessar o AtlasAchievement</h2>
            <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-lite-auth-close>Fechar</button>
          </div>
          <div role="group" aria-label="Escolha entre entrar e criar conta" class="atlas-lite-dialog__actions">
            <button type="button" class="atlas-btn atlas-btn-secondary" data-lite-auth-mode="login">Entrar</button>
            <button type="button" class="atlas-btn atlas-btn-secondary" data-lite-auth-mode="register">Criar conta</button>
          </div>
          <div data-lite-auth-login>
            <label>Email ou username<input class="atlas-input" name="identifier" autocomplete="username" required></label>
            <label>Senha<input class="atlas-input" name="password" type="password" autocomplete="current-password" minlength="8" required></label>
          </div>
          <div data-lite-auth-register hidden>
            <label>Username<input class="atlas-input" name="username" autocomplete="username" minlength="3" maxlength="30"></label>
            <label>Email<input class="atlas-input" name="email" type="email" autocomplete="email"></label>
            <label>Nome exibido<input class="atlas-input" name="displayName" autocomplete="name" maxlength="60"></label>
            <label>Senha<input class="atlas-input" name="registerPassword" type="password" autocomplete="new-password" minlength="8"></label>
          </div>
          <button type="submit" class="atlas-btn atlas-btn-primary" data-lite-auth-submit>Entrar</button>
          <p role="status" aria-live="polite" data-lite-auth-status></p>
        </form>`;
      document.body.appendChild(dialog);
      dialog.querySelector('[data-lite-auth-close]').addEventListener('click', () => dialog.close());
      dialog.querySelectorAll('[data-lite-auth-mode]').forEach(button => button.addEventListener('click', () => setAuthMode(dialog, button.dataset.liteAuthMode)));
      dialog.querySelector('[data-lite-auth-form]').addEventListener('submit', event => {
        event.preventDefault();
        void submitAuth(dialog);
      });
    }
    setAuthMode(dialog, mode === 'register' ? 'register' : 'login');
    dialog.showModal();
    dialog.querySelector('input:not([hidden])')?.focus();
  }

  function setAuthMode(dialog, mode) {
    dialog.dataset.mode = mode;
    const register = mode === 'register';
    dialog.querySelector('[data-lite-auth-login]').hidden = register;
    dialog.querySelector('[data-lite-auth-register]').hidden = !register;
    dialog.querySelector('#re5LiteAuthTitle').textContent = register ? 'Criar conta' : 'Entrar';
    dialog.querySelector('[data-lite-auth-submit]').textContent = register ? 'Criar conta' : 'Entrar';
    dialog.querySelectorAll('[data-lite-auth-mode]').forEach(button => button.setAttribute('aria-pressed', button.dataset.liteAuthMode === mode ? 'true' : 'false'));
  }

  async function submitAuth(dialog) {
    const form = dialog.querySelector('[data-lite-auth-form]');
    const status = dialog.querySelector('[data-lite-auth-status]');
    const submit = dialog.querySelector('[data-lite-auth-submit]');
    const data = new FormData(form);
    const register = dialog.dataset.mode === 'register';
    submit.disabled = true;
    status.textContent = register ? 'Criando conta…' : 'Entrando…';
    try {
      await requestJson(register ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify(register
          ? {
              username: data.get('username'),
              email: data.get('email'),
              displayName: data.get('displayName'),
              password: data.get('registerPassword'),
              scope: 'user'
            }
          : { identifier: data.get('identifier'), password: data.get('password'), scope: 'user' })
      });
      status.textContent = 'Acesso concluído. Atualizando o guia…';
      window.location.reload();
    } catch (error) {
      status.textContent = error.message || 'Não foi possível acessar a conta.';
      submit.disabled = false;
    }
  }

  async function submitComment(form) {
    const panel = form.closest('[data-guide-comments]');
    const input = form.querySelector('[data-guide-comment-input]');
    const feedback = form.querySelector('[data-guide-comment-feedback]');
    const submit = form.querySelector('[data-guide-comment-submit]');
    const body = String(input?.value || '').trim();
    if (body.length < 2) {
      if (feedback) feedback.textContent = 'Escreva pelo menos dois caracteres.';
      return;
    }
    submit.disabled = true;
    if (feedback) feedback.textContent = 'Enviando…';
    try {
      if (!csrfToken) await requestJson('/api/auth/me');
      const response = await requestJson(`/jogo/${encodeURIComponent(panel.dataset.guideCommentsSlug || slug)}/comments`, {
        method: 'POST',
        headers: { 'X-Atlas-Auth-Scope': 'user' },
        body: JSON.stringify({ body, scope: 'user' })
      });
      input.value = '';
      if (feedback) feedback.textContent = response.message || 'Comentário enviado e aguardando moderação.';
    } catch (error) {
      if (feedback) feedback.textContent = error.message || 'Não foi possível enviar o comentário.';
    } finally {
      submit.disabled = false;
    }
  }

  function bindDelegatedInteractions() {
    document.addEventListener('click', event => {
      const feedbackButton = event.target.closest('[data-feedback-open], [data-guide-feedback-open], [data-guide-action="feedback"]');
      if (feedbackButton) {
        event.preventDefault();
        void openFeedback();
        return;
      }

      const authButton = event.target.closest('[data-auth-open]');
      if (authButton) {
        event.preventDefault();
        ensureAuthDialog(authButton.dataset.authOpen);
        return;
      }

      const viewLink = event.target.closest('[data-view-link]');
      if (viewLink) {
        event.preventDefault();
        const destinations = { home: '/', catalog: '/catalogo', library: '/biblioteca', profile: '/perfil' };
        const destination = destinations[viewLink.dataset.viewLink];
        if (destination) window.location.assign(destination);
        return;
      }

      const roadmapJump = event.target.closest('[data-roadmap-jump]');
      if (roadmapJump) {
        event.preventDefault();
        navigateToTarget(roadmapJump.dataset.roadmapJump, { tab: 'roadmap' });
        return;
      }

      const extraCategoryLink = event.target.closest('[data-extra-category-link]');
      if (extraCategoryLink) {
        event.preventDefault();
        navigateToTarget(extraCategoryLink.dataset.extraCategoryLink, { tab: 'extras' });
        return;
      }

      const directTarget = event.target.closest('[data-guide-target]');
      if (directTarget) {
        event.preventDefault();
        navigateToTarget(directTarget.dataset.guideTarget);
        return;
      }

      const roadmapToggle = event.target.closest('[data-roadmap-toggle]');
      if (roadmapToggle) {
        event.preventDefault();
        const number = String(roadmapToggle.dataset.roadmapToggle || '');
        if (completedRoadmapStages.has(number)) completedRoadmapStages.delete(number);
        else completedRoadmapStages.add(number);
        persistPhase6State();
        updateRoadmapState();
        setStatus(completedRoadmapStages.has(number) ? `Etapa ${number} concluída.` : `Etapa ${number} marcada como pendente.`, 'success');
        return;
      }

      const chapterToggle = event.target.closest('[data-chapter-toggle]');
      if (chapterToggle) {
        event.preventDefault();
        const number = String(chapterToggle.dataset.chapterToggle || '');
        if (completedChapters.has(number)) completedChapters.delete(number);
        else completedChapters.add(number);
        persistPhase6State();
        updateChapterState();
        setStatus(completedChapters.has(number) ? 'Capítulo concluído.' : 'Capítulo marcado como pendente.', 'success');
        return;
      }

      const saveButton = event.target.closest('[data-toggle-save-game]');
      if (saveButton) {
        event.preventDefault();
        const library = safeReadLibrary();
        const saved = Boolean(getLibraryEntry(library));
        persistProgress({ remove: saved });
        setStatus(saved ? 'Jogo removido da biblioteca.' : 'Jogo salvo na biblioteca.', 'success');
        if (!saved && state.actorAuthenticated && gameId) {
          void requestJson('/api/me/library', {
            method: 'POST',
            headers: { 'X-Atlas-Auth-Scope': 'user' },
            body: JSON.stringify({ game_id: gameId, status: completed.size ? 'playing' : 'backlog', scope: 'user' })
          }).catch(() => setStatus('A biblioteca local foi atualizada, mas a sincronização da conta falhou.', 'warning'));
        }
        return;
      }

      const trophyToggle = event.target.closest('[data-trophy-toggle]');
      if (trophyToggle) {
        event.preventDefault();
        const trophyId = String(trophyToggle.dataset.trophyToggle || '');
        const card = trophyToggle.closest('[data-trophy-id]');
        const isCompleted = !completed.has(trophyId);
        if (isCompleted) completed.add(trophyId);
        else completed.delete(trophyId);
        if (card) updateCard(card, isCompleted);
        persistProgress();
        updateProgress();
        applyFilters(true);
        void syncAccountProgress(trophyId, isCompleted);
        return;
      }

      const densityButton = event.target.closest('[data-checklist-density]');
      if (densityButton) {
        event.preventDefault();
        setDensity(densityButton.dataset.checklistDensity, true);
        return;
      }

      const detailsToggle = event.target.closest('[data-trophy-details-toggle]');
      if (detailsToggle) {
        event.preventDefault();
        const details = document.getElementById(detailsToggle.getAttribute('aria-controls') || '');
        if (!details) return;
        const expanded = detailsToggle.getAttribute('aria-expanded') !== 'true';
        detailsToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        details.hidden = !expanded;
        details.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        const label = detailsToggle.querySelector('[data-details-label]');
        if (label) label.textContent = expanded ? 'Ocultar detalhes' : 'Ver detalhes';
        return;
      }

      const sectionToggle = event.target.closest('[data-guide-section-toggle]');
      if (sectionToggle) {
        event.preventDefault();
        const content = document.getElementById(sectionToggle.getAttribute('aria-controls') || sectionToggle.dataset.guideSectionToggle || '');
        if (content) setSectionExpanded(sectionToggle, content, sectionToggle.getAttribute('aria-expanded') !== 'true');
        return;
      }

      const filterButton = event.target.closest('.filter-btn');
      if (filterButton) {
        event.preventDefault();
        activeFilter = filterButton.dataset.filter || 'all';
        document.querySelectorAll('.filter-btn').forEach(button => {
          const active = button === filterButton;
          button.classList.toggle('atlas-pill-active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        applyFilters(true);
        return;
      }

      const clearButton = event.target.closest('[data-guide-clear-filters]');
      if (clearButton) {
        event.preventDefault();
        activeFilter = 'all';
        searchValue = '';
        const search = document.querySelector('#trophySearch');
        if (search) search.value = '';
        document.querySelectorAll('.filter-btn').forEach(button => {
          const active = button.dataset.filter === 'all';
          button.classList.toggle('atlas-pill-active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        applyFilters(true);
        return;
      }

      const actionButton = event.target.closest('[data-guide-action]');
      if (actionButton) {
        if (actionButton.matches('#guideLayerNav [role="tab"]')) return;
        const action = actionButton.dataset.guideAction;
        if (focusAction(action)) event.preventDefault();
      }
    });

    document.addEventListener('input', event => {
      if (event.target.matches('#trophySearch')) {
        searchValue = normalize(event.target.value);
        applyFilters(true);
      }
      if (event.target.matches('#extrasSearch')) {
        applyExtrasSearch(event.target.value);
      }
      if (event.target.matches('[data-guide-comment-input]')) {
        const counter = event.target.closest('form')?.querySelector('[data-guide-comment-counter]');
        if (counter) counter.textContent = `${String(event.target.value || '').length}/1000`;
      }
    });

    document.addEventListener('change', event => {
      const input = event.target.closest('[data-platinum-extra-check]');
      if (!input) return;
      const id = String(input.dataset.platinumExtraCheck || '');
      if (input.checked) completedExtras.add(id);
      else completedExtras.delete(id);
      persistPhase6State();
      updateExtraProgress();
    });

    document.addEventListener('submit', event => {
      const form = event.target.closest('[data-guide-comment-form]');
      if (!form) return;
      event.preventDefault();
      void submitComment(form);
    });
  }

  function initializeBackToTop() {
    const button = document.querySelector('#backToTopBtn');
    if (!button) return;
    const update = () => {
      scrollFrame = 0;
      const visible = window.scrollY > 520;
      button.classList.toggle('is-visible', visible);
      button.setAttribute('aria-hidden', visible ? 'false' : 'true');
      button.tabIndex = visible ? 0 : -1;
    };
    window.addEventListener('scroll', () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  function loadIconFontAfterPageLoad() {
    const load = () => {
      if (document.querySelector('link[data-re5-icon-font]')) return;
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
      stylesheet.dataset.re5IconFont = 'true';
      stylesheet.addEventListener('error', () => {
        // Text labels and reserved icon boxes keep every control usable.
      }, { once: true });
      document.head.appendChild(stylesheet);
    };
    if (document.readyState === 'complete') load();
    else window.addEventListener('load', load, { once: true });
  }

  function initialize() {
    try {
      initializeTabs();
      initializeAccordions();
      initializeChecklist();
      initializePhase6State();
      bindDelegatedInteractions();
      initializeBackToTop();
      loadIconFontAfterPageLoad();
      root.classList.add('re5-ready');
    } catch (_error) {
      revealLinearFallback('Os controles avançados não iniciaram, mas todo o guia permanece disponível em fluxo linear.');
    }
  }

  initialize();
})();
