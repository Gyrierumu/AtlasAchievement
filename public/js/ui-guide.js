window.UIGuide = (() => {
  const { qs, qsa, escapeHtml, escapeAttribute, getGameCoverSrc, getGameImageSrc, deriveSteamLibraryCover, isPlaceholderGameImage } = window.UIShared;
  const { buildGameGuideH1, getLibraryStatusLabel } = window.UIFormatters;
  const {
    TROPHY_TYPE_FILTERS,
    buildGuidePlayerFit,
    buildGuideViewModel,
    buildThirtySecondVerdict,
    getEditorialBadge,
    getDifficultyTone,
    getDifficultyToneClass,
    getLibraryMeta,
    hasMissableRiskText,
    getTrophyRiskTags,
    getGuideTrophyTags,
    getGuideTrophyDisplayTags,
    getGuideTrophySearchText,
    buildGuideSummaryCards,
    buildGuideRiskAlerts,
    buildGuideBeforeStartItems
  } = window.UIDecisionModels;
  const sharedEditorial = window.AtlasEditorialModel || {};
  const sharedCard = window.AtlasCardModel || {};

  const CHECKLIST_DENSITY_KEY = 'atlas_checklist_density';
  const CHECKLIST_DENSITIES = new Set(['comfortable', 'compact']);
  const GUIDE_FILTER_LABELS = {
    all: 'Todos',
    pending: 'Pendentes',
    completed: 'Concluídos',
    missable: 'Perdíveis',
    online: 'Online',
    coop: 'Coop',
    spoiler: 'Spoiler',
    grind: 'Grind',
    cleanup: 'Cleanup',
    collectible: 'Coletáveis',
    story: 'História',
    difficulty: 'Dificuldade',
    Platina: 'Platina',
    Ouro: 'Ouro',
    Prata: 'Prata',
    Bronze: 'Bronze'
  };

  function normalizeChecklistDensity(value = 'compact') {
    return CHECKLIST_DENSITIES.has(value) ? value : 'compact';
  }

  function getChecklistDensityPreference() {
    try {
      if (typeof localStorage === 'undefined') return 'compact';
      return normalizeChecklistDensity(localStorage.getItem(CHECKLIST_DENSITY_KEY) || 'compact');
    } catch (_error) {
      return 'compact';
    }
  }

  function saveChecklistDensityPreference(density) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CHECKLIST_DENSITY_KEY, normalizeChecklistDensity(density));
      }
    } catch (_error) {}
  }

  function applyChecklistDensity(density = getChecklistDensityPreference()) {
    const nextDensity = normalizeChecklistDensity(density);
    const isCompact = nextDensity === 'compact';
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return nextDensity;
    const body = typeof document !== 'undefined' ? document.body : null;
    if (body) {
      body.dataset.checklistDensity = nextDensity;
      body.classList.toggle('atlas-checklist-density-compact', isCompact);
    }

    [qs('#guideChecklistPanel'), qs('#trophyList')].filter(Boolean).forEach(element => {
      element.dataset.checklistDensity = nextDensity;
      element.classList.toggle('is-compact', isCompact);
    });

    qsa('[data-checklist-density]').forEach(button => {
      const active = button.dataset.checklistDensity === nextDensity;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    return nextDensity;
  }

  function setChecklistDensity(density) {
    const nextDensity = applyChecklistDensity(density);
    saveChecklistDensityPreference(nextDensity);
    return nextDensity;
  }

  function setGuideEmptyState(...args) {
    return window.UI?.setGuideEmptyState?.(...args);
  }

  function getGuideFilterLabel(filter = 'all') {
    return GUIDE_FILTER_LABELS[filter] || filter || 'filtro atual';
  }

  function normalizeGuideSearchValue(value = '') {
    if (typeof getGuideTrophySearchText === 'function') {
      return getGuideTrophySearchText({ name: value }, []);
    }
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function getTrophyCards() {
    return qsa('#trophyList .trophy-card, #trophyList .atlas-trophy-card');
  }

  function cardMatchesGuideFilter(card, filter = 'all') {
    const riskTokens = String(card.dataset.risks || '').split(/\s+/).filter(Boolean);
    const matchesType = TROPHY_TYPE_FILTERS.has(filter) ? card.dataset.type === filter : false;
    const matchesStatus = filter === 'completed' ? card.dataset.status === 'completed' : filter === 'pending' ? card.dataset.status === 'pending' : false;
    const matchesRisk = riskTokens.includes(filter);
    return filter === 'all' || matchesStatus || matchesType || matchesRisk;
  }

  function getGuideFilterEmptyMessage(filter = 'all', query = '') {
    const label = getGuideFilterLabel(filter);
    const hasQuery = Boolean(String(query || '').trim());
    if (hasQuery && filter !== 'all') {
      return {
        title: `Nenhum troféu em ${label} para essa busca.`,
        detail: 'Tente limpar filtros ou buscar por outro termo.'
      };
    }
    if (hasQuery) {
      return {
        title: 'Nenhum resultado para essa busca.',
        detail: 'Tente limpar filtros ou buscar por outro termo.'
      };
    }
    if (filter === 'completed') return { title: 'Nenhum troféu concluído ainda.', detail: 'Marque um troféu para ele aparecer aqui.' };
    if (filter === 'pending') return { title: 'Nenhum troféu pendente neste guia.', detail: 'A checklist pode estar completa.' };
    if (filter === 'online') return { title: 'Nenhum troféu online neste guia.', detail: 'Este filtro só mostra troféus com sinal online claro no conteúdo ou nas tags derivadas.' };
    if (filter === 'coop') return { title: 'Nenhum troféu coop neste guia.', detail: 'Este filtro só mostra troféus com sinal claro de co-op ou 2 jogadores obrigatórios.' };
    if (filter === 'missable') return { title: 'Nenhum troféu perdível encontrado.', detail: 'O cadastro atual não aponta perdíveis para este filtro.' };
    return { title: `Nenhum troféu marcado como ${label}.`, detail: 'Tente limpar filtros ou buscar por outro termo.' };
  }

  function updateGuideFilterButtons(query = '') {
    const normalizedQuery = normalizeGuideSearchValue(query).trim();
    const cards = getTrophyCards();
    qsa('.filter-btn').forEach(button => {
      const filter = button.dataset.filter || 'all';
      const visibleMatchCount = cards.filter(card => {
        const matchesSearch = !normalizedQuery || (card.dataset.search || '').includes(normalizedQuery);
        return cardMatchesGuideFilter(card, filter) && matchesSearch;
      }).length;
      button.dataset.count = String(visibleMatchCount);
      button.setAttribute('aria-label', `${getGuideFilterLabel(filter)}: ${visibleMatchCount} troféu(s)`);
    });
  }

  function applyTrophyFilter(filter, query = '') {
    const normalizedQuery = normalizeGuideSearchValue(query).trim();
    let activeFilter = filter || 'all';
    let visibleCount = 0;
    const cards = getTrophyCards();
    if (!cards.length) {
      const results = qs('#guideResults');
      if (results) results.textContent = 'Checklist ainda não disponível para este guia.';
      setGuideEmptyState(true, {
        title: 'Checklist ainda não disponível para este guia.',
        detail: 'Este guia ainda não possui troféus cadastrados.',
        action: false
      });
      return { activeFilter: 'all', visibleCount: 0 };
    }
    updateGuideFilterButtons(normalizedQuery);
    const activeButton = qsa('.filter-btn').find(button => button.dataset.filter === activeFilter);
    if (activeButton?.hidden) activeFilter = 'all';
    cards.forEach(card => {
      const passesFilter = cardMatchesGuideFilter(card, activeFilter);
      const matchesSearch = !normalizedQuery || (card.dataset.search || '').includes(normalizedQuery);
      const visible = passesFilter && matchesSearch;
      card.classList.toggle('hidden', !visible);
      if (visible) visibleCount += 1;
    });
    qsa('.filter-btn').forEach(button => {
      const active = button.dataset.filter === activeFilter;
      button.classList.toggle('atlas-pill-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const results = qs('#guideResults');
    const resultLabel = activeFilter === 'all' ? '' : ` em ${getGuideFilterLabel(activeFilter)}`;
    if (results) results.textContent = `${visibleCount} troféu(s) visível(is)${resultLabel}`;
    setGuideEmptyState(visibleCount === 0, getGuideFilterEmptyMessage(activeFilter, query));
    return { activeFilter, visibleCount };
  }

  function clearTrophySearch() {
    const field = qs('#trophySearch');
    if (field) field.value = '';
  }

  function bindGuideSearch(onInput) {
    const field = qs('#trophySearch');
    if (!field) return;
    field.addEventListener('input', onInput);
  }

  function getTrophySearchValue() {
    return qs('#trophySearch')?.value || '';
  }

  function clearGuideChecklistFilters() {
    clearTrophySearch();
    return applyTrophyFilter('all', '');
  }

  function getGuideRoadmapCount(game = {}, viewModel = {}) {
    if (typeof sharedEditorial.getGuideRoadmapCount === 'function') {
      return sharedEditorial.getGuideRoadmapCount(game, viewModel);
    }
    return Number(game?.roadmap_count || viewModel?.roadmap?.length || viewModel?.roadmapStages?.length || 0);
  }

  function buildTrophyDetailsId(trophy = {}, index = 0) {
    const base = String(trophy?.id || trophy?.name || `trophy-${index}`)
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `trophy-${index}`;
    return `trophy-details-${base}-${index}`;
  }

  function hasLongTrophyDescription(description = '') {
    const text = String(description || '').trim();
    return text.length > 130 || text.includes('\n');
  }

  function shouldShowTrophyDetailsToggle(trophy = {}, description = '', tip = '') {
    return Boolean(trophy?.is_spoiler || String(tip || '').trim() || hasLongTrophyDescription(description));
  }

  function getTrophyEditorialName(trophy = {}) {
    const officialName = String(trophy?.name || '').trim();
    const editorialName = String(trophy?.name_pt || '').trim();
    if (!editorialName || editorialName.toLowerCase() === officialName.toLowerCase()) return '';
    return editorialName;
  }

  function buildGuideHeroStats(game = {}, viewModel = {}) {
    if (typeof buildGuideSummaryCards === 'function') {
      const essentials = new Set(['Tempo estimado', 'Dificuldade', 'Trofeus', 'Troféus', 'Platina/100%']);
      return buildGuideSummaryCards(game, viewModel).filter(item => essentials.has(item.label)).slice(0, 4);
    }
    if (typeof sharedEditorial.buildGuideHeroStats === 'function') {
      return sharedEditorial.buildGuideHeroStats(game, viewModel);
    }
    return [
      { icon: 'fa-gauge-high', label: 'Dificuldade', value: `${String(game?.difficulty || '-')}/10`, tone: getDifficultyToneClass(game?.difficulty) },
      { icon: 'fa-clock', label: 'Tempo', value: game?.time || 'Tempo não informado', tone: 'atlas-meta-signal--time' },
      { icon: 'fa-trophy', label: 'Troféus', value: `${String(viewModel.total || 0)} troféu(s)`, tone: 'atlas-meta-signal--trophy' },
      { icon: 'fa-route', label: 'Roadmap', value: `${String(getGuideRoadmapCount(game, viewModel))} etapa(s)`, tone: 'atlas-meta-signal--partial' }
    ];
  }

  function renderGuideRoadmapTimeline(roadmapStages = []) {
    if (!roadmapStages.length) return '<div class="atlas-inline-empty">Sem roadmap cadastrado.</div>';
    return `
      <ol class="atlas-roadmap-timeline">
        ${roadmapStages.map(stage => {
          const category = stage.category || { id: 'plan', label: 'Plano', icon: 'fa-route' };
          const actions = splitGuideRoadmapActions(stage.description || stage.objective).slice(0, 3);
          return `
          <li class="atlas-roadmap-step atlas-roadmap-step--${escapeAttribute(category.id || 'plan')}${Number(stage.number) === 1 ? ' atlas-roadmap-step--first' : ''}">
            <div class="atlas-roadmap-step__marker">${escapeHtml(String(stage.number))}</div>
            <article class="atlas-roadmap-step__body">
              <div class="atlas-roadmap-step__head">
                <div>
                  <span>${Number(stage.number) === 1 ? 'Comece aqui' : `Passo ${escapeHtml(String(stage.number))}`}</span>
                  <h3>${escapeHtml(stage.title)}</h3>
                </div>
                <span class="atlas-roadmap-step__category atlas-roadmap-step__category--${escapeAttribute(category.id || 'plan')}"><i class="fas ${escapeAttribute(category.icon || 'fa-route')}" aria-hidden="true"></i>${escapeHtml(category.label || 'Plano')}</span>
              </div>
              <p>${escapeHtml(stage.objective || stage.description)}</p>
              ${actions.length ? `<ul class="atlas-roadmap-step__actions">${actions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}</ul>` : ''}
              <div class="atlas-roadmap-step__meta">
                <span><strong>Objetivo</strong>${escapeHtml(stage.objective)}</span>
                ${stage.risk ? `<span><strong>Risco</strong>${escapeHtml(stage.risk)}</span>` : ''}
                ${stage.relatedTrophies?.length ? `<span><strong>Troféus relacionados</strong>${stage.relatedTrophies.map(escapeHtml).join(' / ')}</span>` : ''}
              </div>
            </article>
          </li>
        `;
        }).join('')}
      </ol>`;
  }

  function splitGuideRoadmapActions(value = '') {
    return String(value || '')
      .split(/(?:[.;]\s+|\n+|,\s+(?=e |depois|entao|então|antes|sem |com |use |faça |faca ))/i)
      .map(item => item.trim().replace(/^[-•]\s*/, ''))
      .filter(item => item.length > 18)
      .map(item => item.length > 120 ? `${item.slice(0, 117).trim()}...` : item);
  }

  function renderGuideInternalNav() {
    const items = [
      { action: 'header', href: '#guideHeader', icon: 'fa-compass', label: 'Resumo' },
      { action: 'roadmap', href: '#guideRoadmapPanel', icon: 'fa-route', label: 'Roadmap' },
      { action: 'trophies', href: '#guideChecklistPanel', icon: 'fa-list-check', label: 'Checklist' },
      { action: 'risks', href: '#guideRiskSummaryPanel', icon: 'fa-triangle-exclamation', label: 'Alertas' },
      { action: 'related', href: '#guideRelatedPanel', icon: 'fa-layer-group', label: 'Relacionados' }
    ];
    return `
      <nav id="guideInternalNav" class="atlas-guide-nav" aria-label="Navegação interna do guia">
        ${items.map(item => `<a class="atlas-guide-nav__link" href="${escapeAttribute(item.href)}" data-guide-action="${escapeAttribute(item.action)}"><i class="fas ${escapeAttribute(item.icon)}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></a>`).join('')}
      </nav>`;
  }

  function renderGuideRoadmapPanel(viewModel = {}) {
    const roadmapStages = Array.isArray(viewModel.roadmapStages) ? viewModel.roadmapStages : [];
    return `
      <section id="guideRoadmapPanel" class="atlas-panel atlas-panel--section atlas-roadmap-panel p-5 md:p-6">
        <div class="atlas-section-head atlas-section-head--compact">
          <div>
            <div class="atlas-eyebrow">Roadmap da platina</div>
            <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">Ordem recomendada para jogar</h2>
            <p class="text-white/58 mt-2 max-w-4xl">Comece por estas etapas antes de mergulhar na lista completa. A ordem ajuda a reduzir retrabalho, evitar perdas e deixar o cleanup para o momento certo.</p>
          </div>
          <span class="atlas-tag atlas-tag--soft">${escapeHtml(String(roadmapStages.length))} etapa(s)</span>
        </div>
        ${renderGuideRoadmapTimeline(roadmapStages)}
      </section>`;
  }

  function renderGuidePlatinumSummaryPanel(game = {}, viewModel = {}) {
    const cards = typeof buildGuideSummaryCards === 'function' ? buildGuideSummaryCards(game, viewModel) : buildGuideHeroStats(game, viewModel);
    return `
      <section id="guidePlatinumSummaryPanel" class="atlas-panel atlas-panel--section atlas-platinum-summary p-5 md:p-6">
        <div class="atlas-section-head atlas-section-head--compact">
          <div>
            <div class="atlas-eyebrow">Resumo rápido da platina</div>
            <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">O que você precisa saber antes de jogar</h2>
            <p class="text-white/58 mt-2 max-w-4xl">Tempo, dificuldade, escopo, online, coop e riscos ficam aqui para decisão rápida antes do plano completo.</p>
          </div>
        </div>
        <div class="atlas-platinum-summary__grid" aria-label="Resumo essencial da platina">
          ${cards.map(card => `<article class="atlas-platinum-summary__card ${escapeAttribute(card.tone || '')}" title="${escapeAttribute(card.detail || '')}"><i class="fas ${escapeAttribute(card.icon || 'fa-circle-info')}" aria-hidden="true"></i><div><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><p>${escapeHtml(card.detail || '')}</p></div></article>`).join('')}
        </div>
      </section>`;
  }

  function renderGuideRiskAlertsPanel(game = {}, viewModel = {}) {
    const alerts = typeof buildGuideRiskAlerts === 'function' ? buildGuideRiskAlerts(game, viewModel) : [];
    const beforeItems = Array.isArray(viewModel.beforeStartItems) && viewModel.beforeStartItems.length
      ? viewModel.beforeStartItems
      : (typeof buildGuideBeforeStartItems === 'function' ? buildGuideBeforeStartItems(game, viewModel) : []);
    if (!alerts.length && !beforeItems.length) return '';
    return `
      <section id="guideRiskSummaryPanel" class="atlas-panel atlas-panel--section atlas-guide-risk-summary p-5 md:p-6">
        <div class="atlas-section-head atlas-section-head--compact">
          <div>
            <div class="atlas-eyebrow">Leia antes de começar</div>
            <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Alertas que mudam a rota da platina</h2>
            <p class="text-white/58 mt-2 max-w-4xl">Confirme estes sinais antes da primeira sessão. Eles dizem se você deve priorizar roadmap, online, grind, NG+ ou cleanup antes de abrir a lista completa.</p>
          </div>
          <span class="atlas-tag atlas-tag--soft">${escapeHtml(String(beforeItems.length || alerts.length))} sinal(is)</span>
        </div>
        ${beforeItems.length ? `<div class="atlas-guide-before-grid">
          ${beforeItems.map(item => `
            <article class="atlas-guide-before-card atlas-guide-before-card--${escapeAttribute(item.tone || 'neutral')}">
              <i class="fas ${escapeAttribute(item.icon || 'fa-circle-info')}" aria-hidden="true"></i>
              <div>
                <span>${escapeHtml(item.label || 'Sinal')}</span>
                <strong>${escapeHtml(item.title || 'Revise antes de começar')}</strong>
                <p>${escapeHtml(item.detail || '')}</p>
              </div>
            </article>
          `).join('')}
        </div>` : ''}
        ${alerts.length ? `
        <div class="atlas-guide-risk-subhead">
          <span>Alertas detalhados</span>
        </div>
        <div class="atlas-guide-risk-grid">
          ${alerts.map(alert => `
            <article class="atlas-guide-risk-card atlas-guide-risk-card--${escapeAttribute(alert.tone || 'neutral')}">
              <i class="fas ${escapeAttribute(alert.icon || 'fa-circle-info')}" aria-hidden="true"></i>
              <div>
                <span>${escapeHtml(alert.label || 'Alerta')}</span>
                <strong>${escapeHtml(alert.title || 'Revise este ponto.')}</strong>
                <p>${escapeHtml(alert.detail || '')}</p>
              </div>
            </article>
          `).join('')}
        </div>
        ` : ''}
      </section>`;
  }

  function renderGuideDecisionStack(game = {}, viewModel = {}) {
    const verdict = buildThirtySecondVerdict(game, viewModel);
    return `
      <section id="guideVerdictPanel" class="atlas-panel atlas-panel--primary atlas-editorial-band p-5 md:p-6">
        <div class="atlas-editorial-band__intro">
          <div>
            <div class="atlas-eyebrow">Veredito de 30 segundos</div>
            <h2>O custo da platina em leitura rápida</h2>
            <p>${escapeHtml(verdict.summary)}</p>
          </div>
          <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-guide-action="${escapeAttribute(viewModel.nextActionModel?.focus === 'risks' ? 'risks' : 'trophies')}"><i class="fas ${escapeAttribute(viewModel.nextActionModel?.focus === 'risks' ? 'fa-triangle-exclamation' : 'fa-list-check')}"></i> ${escapeHtml(viewModel.nextActionModel?.focus === 'risks' ? 'Ler alertas e roadmap' : 'Ir para checklist')}</button>
        </div>
        <div class="atlas-verdict-strip" aria-label="Resumo rápido da platina">
          ${verdict.cards.map(card => `<article class="atlas-verdict-strip__item ${escapeAttribute(card.tone || '')}" title="${escapeAttribute(card.detail || '')}"><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><p>${escapeHtml(card.detail)}</p></article>`).join('')}
        </div>
      </section>
      ${renderGuideRiskAlertsPanel(game, viewModel)}
      ${renderGuideInternalNav()}`;
  }

  function renderGuideRiskAlertsPanelV2(game = {}, viewModel = {}) {
    const beforeItems = Array.isArray(viewModel.beforeStartItems) && viewModel.beforeStartItems.length
      ? viewModel.beforeStartItems
      : (typeof buildGuideBeforeStartItems === 'function' ? buildGuideBeforeStartItems(game, viewModel) : []);
    const items = beforeItems.slice(0, 5);
    if (!items.length) return '';
    return `
      <section id="guideRiskSummaryPanel" class="atlas-panel atlas-panel--section atlas-guide-risk-summary p-5 md:p-6">
        <div class="atlas-section-head atlas-section-head--compact">
          <div>
            <div class="atlas-eyebrow">Leia antes de começar</div>
            <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Alertas que mudam a rota da platina</h2>
            <p class="text-white/58 mt-2 max-w-4xl">No máximo cinco pontos críticos antes do roadmap. Leia isso para evitar erro de ordem, DLC fora do escopo, coop esquecido ou cleanup mal planejado.</p>
          </div>
          <span class="atlas-tag atlas-tag--soft">${escapeHtml(String(items.length))} alerta(s)</span>
        </div>
        <div class="atlas-guide-before-grid">
          ${items.map(item => `
            <article class="atlas-guide-before-card atlas-guide-before-card--${escapeAttribute(item.tone || 'neutral')}">
              <i class="fas ${escapeAttribute(item.icon || 'fa-circle-info')}" aria-hidden="true"></i>
              <div>
                <span>${escapeHtml(item.label || 'Sinal')}</span>
                <strong>${escapeHtml(item.title || 'Revise antes de começar')}</strong>
                <p>${escapeHtml(item.detail || '')}</p>
              </div>
            </article>
          `).join('')}
        </div>
      </section>`;
  }

  function renderGuideDecisionStackV2(game = {}, viewModel = {}) {
    return `
      ${renderGuidePlatinumSummaryPanel(game, viewModel)}
      ${renderGuideRiskAlertsPanelV2(game, viewModel)}
      ${renderGuideInternalNav()}`;
  }

  function renderGuideSidebarCompact(game = {}, viewModel = {}, context = {}) {
    const guideMeta = context.guideMeta || getLibraryMeta({ ...game, trophies: viewModel.trophies || [] });
    const isSaved = Boolean(context.isSaved);
    const libraryEntry = context.libraryEntry || null;
    const storageLabel = context.storageLabel || 'Salvo neste navegador';
    const libraryLabel = isSaved ? `${storageLabel} • ${getLibraryStatusLabel(libraryEntry?.status, viewModel.progress)}` : 'Ainda não salvo';
    const nextAction = viewModel.nextActionModel || {};
    return `
      <section class="atlas-panel atlas-panel--section atlas-guide-sidebar-card p-5">
        <div class="atlas-guide-sidebar-card__top">
          <div>
            <div class="atlas-eyebrow">Progresso</div>
            <strong id="guideProgressLabel" data-guide-progress-label>${viewModel.progress}%</strong>
          </div>
          <span class="atlas-badge atlas-badge--${escapeAttribute(guideMeta.progressState.accent || 'partial')}">${escapeHtml(guideMeta.momentumLabel)}</span>
        </div>
        <div class="atlas-sidebar-progress" aria-hidden="true">
          <span id="guideProgressBar" data-guide-progress-bar style="width: ${escapeAttribute(String(viewModel.progress))}%"></span>
        </div>
        <div class="atlas-sidebar-counts">
          <span class="atlas-sidebar-counts__complete"><strong id="guideCompletedCount" data-guide-completed-count>${escapeHtml(String(viewModel.completed))}</strong> concluídos</span>
          <span class="atlas-sidebar-counts__pending"><strong id="guideRemainingCount" data-guide-remaining-count>${escapeHtml(String(viewModel.pending))}</strong> pendentes</span>
          <span class="atlas-sidebar-counts__risk">${escapeHtml(String(viewModel.riskCounts?.alertCount || 0))} alertas</span>
        </div>
        <div class="atlas-sidebar-next">
          <div class="atlas-eyebrow">Próximo passo</div>
          <strong>${escapeHtml(nextAction.title || 'Abrir checklist')}</strong>
          <p>${escapeHtml(nextAction.detail || 'Use a lista principal para continuar sem perder contexto.')}</p>
          <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-guide-action="${escapeAttribute(nextAction.focus || 'trophies')}">${escapeHtml(nextAction.cta || 'Continuar')}</button>
        </div>
        <div class="atlas-sidebar-actions">
          <div class="text-xs text-white/45">${escapeHtml(libraryLabel)}</div>
          <button type="button" class="atlas-btn ${isSaved ? 'atlas-btn-secondary atlas-btn-muted-action' : 'atlas-btn-primary'} atlas-btn-compact" data-toggle-save-game="true">${isSaved ? 'Remover da biblioteca' : 'Salvar na biblioteca'}</button>
          <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-copy-game-link="${escapeAttribute(game?.slug || '')}">Copiar link</button>
        </div>
      </section>`;
  }

  function renderGuideEditorialNotes(game = {}, viewModel = {}) {
    const routeTrophies = Array.isArray(viewModel.routeChangingTrophies) ? viewModel.routeChangingTrophies.slice(0, 4) : [];
    const faqItems = Array.isArray(viewModel.contextualFaq) ? viewModel.contextualFaq.slice(0, 3) : [];
    const playerFit = viewModel.playerFit || buildGuidePlayerFit(game, viewModel);
    const methodItems = Array.isArray(viewModel.editorial?.methodItems) ? viewModel.editorial.methodItems : [];
    const statusBadge = viewModel.editorial?.statusBadge || getEditorialBadge(game);
    return `
      <section id="guideEditorialNotesPanel" class="atlas-panel atlas-panel--editorial atlas-editorial-notes p-5 md:p-6">
        <div class="atlas-section-head atlas-section-head--compact">
          <div>
            <span class="atlas-section-kicker">Notas editoriais</span>
            <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Pontos críticos, confiança e FAQ</h2>
            <p class="text-white/58 mt-2 max-w-4xl">Depois de consultar o checklist, use este bloco para tirar dúvidas e revisar riscos sem repetir o roadmap.</p>
          </div>
          <span class="atlas-tag atlas-tag--soft">${escapeHtml(statusBadge.label || 'Notas de apoio')}</span>
        </div>
        <div class="atlas-editorial-notes__grid">
          <details class="atlas-editorial-note" open>
            <summary><span>Pontos críticos</span><small>${escapeHtml(String(routeTrophies.length || 0))}</small></summary>
            <div class="atlas-editorial-notes__column">
            ${routeTrophies.length ? routeTrophies.map(item => {
              const badge = Array.isArray(item.tags) && item.tags.length ? item.tags[0] : null;
              return `<article class="atlas-critical-row"><div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.text)}</p></div><span class="atlas-badge atlas-badge--${escapeAttribute(badge?.tone || 'neutral')}">${escapeHtml(badge?.label || item.type)}</span></article>`;
            }).join('') : '<p class="atlas-muted-copy">Nenhum troféu com risco editorial alto foi detectado nos dados atuais.</p>'}
            </div>
          </details>
          <details class="atlas-editorial-note atlas-editorial-note--quiet">
            <summary><span>Confiança editorial</span><small>Metodologia</small></summary>
            <div class="atlas-editorial-notes__column atlas-editorial-notes__column--quiet">
            <strong>${escapeHtml(viewModel.snapshot.confidence.label)}</strong>
            <p>${escapeHtml(viewModel.snapshot.confidence.detail)}</p>
            <p>${escapeHtml(playerFit.fit[0] || 'Para quem quer validar custo, risco e ordem antes de começar.')}</p>
            <p>${escapeHtml(methodItems[0] || viewModel.editorial.methodSummary)}</p>
            </div>
          </details>
          <details class="atlas-editorial-note">
            <summary><span>FAQ</span><small>${escapeHtml(String(faqItems.length || 0))}</small></summary>
            <div class="atlas-editorial-notes__column">
            <div class="atlas-faq-list">
              ${faqItems.map(item => `<article class="atlas-faq-item atlas-faq-row"><strong>${escapeHtml(item.question)}</strong><p>${escapeHtml(item.answer)}</p></article>`).join('')}
            </div>
            </div>
          </details>
        </div>
      </section>`;
  }

  function getGuideCoverModel(game = {}, viewModel = {}) {
    const fallbackImage = (getGameCoverSrc ? getGameCoverSrc(game) : '') || viewModel.image || '';
    return viewModel.guideCover || {
      image: fallbackImage,
      backdropImage: game?.image || '',
      mode: fallbackImage ? 'poster' : 'fallback',
      className: fallbackImage ? 'atlas-guide-cover--poster' : 'atlas-guide-cover--fallback',
      alt: `Capa de ${game?.name || 'Jogo'}`
    };
  }

  function renderGuideHeroCover(game = {}, viewModel = {}) {
    const cover = getGuideCoverModel(game, viewModel);
    const title = game?.name || 'Jogo';
    const image = cover.image || '';
    const backdrop = cover.backdropImage && cover.mode === 'banner'
      ? `<img class="atlas-guide-cover__backdrop" src="${escapeAttribute(cover.backdropImage)}" alt="" aria-hidden="true" loading="eager" decoding="async">`
      : '';
    const fallbackVisible = image ? '' : ' atlas-guide-cover--fallback-visible';
    return `
      <div class="atlas-guide-cover atlas-guide-cover--hero ${escapeAttribute(cover.className || '')}${fallbackVisible}">
        <span class="atlas-guide-cover__fallback" aria-hidden="true">${escapeHtml(title)}</span>
        ${backdrop}
        ${image ? `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(cover.alt || `Capa de ${title}`)}" class="atlas-guide-cover__image" loading="eager" decoding="sync" fetchpriority="high" width="900" height="1200" sizes="(min-width: 1280px) 220px, (min-width: 768px) 180px, 120px" onerror="this.hidden=true;this.parentElement.classList.add('atlas-guide-cover--fallback-visible');var backdrop=this.parentElement.querySelector('.atlas-guide-cover__backdrop');if(backdrop)backdrop.setAttribute('hidden','hidden');">` : ''}
      </div>
    `;
  }

  function renderGuideHeaderShell(game = {}, viewModel = {}) {
    const guideEyebrow = 'Resumo rápido do guia';
    const verdict = buildThirtySecondVerdict(game, viewModel);
    const heroStats = buildGuideHeroStats(game, viewModel);
    const nextAction = viewModel.nextActionModel || {};
    const scopeModel = viewModel.scopeModel || {};
    const isSaved = Boolean(viewModel?.isSaved);
    const libraryActionLabel = isSaved ? 'Remover da biblioteca' : 'Adicionar a biblioteca';
    const libraryActionClass = isSaved ? 'atlas-btn-secondary atlas-btn-muted-action' : 'atlas-btn-primary';
    const libraryActionIcon = isSaved ? 'fa-bookmark' : 'fa-plus';
    const shouldReadPlan = ['risks', 'roadmap'].includes(nextAction.focus || '');
    const primaryAction = shouldReadPlan ? (nextAction.focus || 'roadmap') : 'trophies';
    const primaryLabel = shouldReadPlan ? 'Ler plano da platina' : 'Ir para checklist';
    const secondaryHtml = shouldReadPlan
      ? '<button type="button" class="atlas-btn atlas-btn-secondary" data-guide-action="trophies"><i class="fas fa-list-check"></i> Ir para checklist</button>'
      : `<button type="button" class="atlas-btn ${escapeAttribute(libraryActionClass)}" data-toggle-save-game="true" aria-label="${escapeAttribute(`${libraryActionLabel} ${game?.name || 'jogo'}`)}"><i class="fas ${escapeAttribute(libraryActionIcon)}"></i> ${escapeHtml(isSaved ? 'Salvo' : 'Salvar guia')}</button>`;
    return `
      <section class="atlas-panel atlas-panel--primary atlas-guide-hero p-5 md:p-6">
        <div class="atlas-guide-hero__layout">
          ${renderGuideHeroCover(game, viewModel)}
          <div class="atlas-guide-hero__body">
            <div class="atlas-guide-hero__kicker">
              <span>${escapeHtml(guideEyebrow)}</span>
            </div>
            <h1>${escapeHtml(buildGameGuideH1(game))}</h1>
            <p class="atlas-guide-hero__subtitle">${escapeHtml(scopeModel.subtitle || 'Guia de troféus e roadmap da platina')}</p>
            <p class="atlas-guide-hero__summary">${escapeHtml(verdict.summary || viewModel.decisionModel.verdictDetail)}</p>
            <div class="atlas-guide-start-card">
              <div>
                <span>Comece por aqui</span>
                <strong>${escapeHtml(nextAction.title || 'Abrir roadmap')}</strong>
                <p>${escapeHtml(nextAction.detail || 'Use o roadmap para entender a ordem antes de marcar troféus soltos.')}</p>
              </div>
            </div>
            <div class="atlas-guide-hero__facts">
              ${heroStats.map(item => `<span class="atlas-meta-signal ${escapeAttribute(item.tone || 'atlas-meta-signal--partial')}" title="${escapeAttribute(item.detail || '')}"><i class="fas ${escapeAttribute(item.icon)}"></i><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></span>`).join('')}
            </div>
            <div class="atlas-guide-hero__actions">
              <button type="button" class="atlas-btn atlas-btn-primary" data-guide-action="${escapeAttribute(primaryAction)}"><i class="fas ${shouldReadPlan ? 'fa-route' : 'fa-list-check'}"></i> ${escapeHtml(primaryLabel)}</button>
              ${secondaryHtml}
            </div>
          </div>
        </div>
      </section>`;
  }

  function getRelatedGuideImageValue(value = '') {
    const image = String(value || '').trim();
    return image && !(isPlaceholderGameImage ? isPlaceholderGameImage(image) : false) ? image : '';
  }

  function getRelatedGuideImageModel(game = {}) {
    const cover = getRelatedGuideImageValue(game?.cover_image);
    const banner = getRelatedGuideImageValue(game?.image);
    const derivedCover = cover ? '' : getRelatedGuideImageValue(typeof deriveSteamLibraryCover === 'function' ? deriveSteamLibraryCover(banner) : '');
    const primary = cover || derivedCover || banner;
    const fallback = primary && banner && primary !== banner ? banner : '';
    const mode = cover || derivedCover ? 'poster' : banner ? 'banner' : 'fallback';
    return {
      primary: primary ? getGameImageSrc(primary) : '',
      fallback: fallback ? getGameImageSrc(fallback) : '',
      mode
    };
  }

  function renderRelatedGuideThumb(game = {}) {
    const imageModel = getRelatedGuideImageModel(game);
    const fallbackAttr = imageModel.fallback ? ` data-fallback-src="${escapeAttribute(imageModel.fallback)}"` : '';
    const image = imageModel.primary
      ? `<img src="${escapeAttribute(imageModel.primary)}"${fallbackAttr} alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="if(this.dataset.fallbackSrc&&!this.dataset.fallbackUsed){this.dataset.fallbackUsed='true';this.src=this.dataset.fallbackSrc;this.parentElement.classList.remove('atlas-related-guide-card__thumb--poster');this.parentElement.classList.add('atlas-related-guide-card__thumb--banner');return;}this.hidden=true;this.parentElement.classList.add('atlas-related-guide-card__thumb--fallback-visible');">`
      : '';
    return `
          <div class="atlas-related-guide-card__thumb atlas-related-guide-card__thumb--${escapeAttribute(imageModel.mode)}${imageModel.primary ? '' : ' atlas-related-guide-card__thumb--fallback-visible'}">
            <span aria-hidden="true"></span>
            ${image}
          </div>`;
  }

  function renderGuideRelatedCards(relatedGames = []) {
    if (!Array.isArray(relatedGames) || !relatedGames.length) {
      return '<div class="atlas-inline-empty md:col-span-2">Conforme o catálogo crescer, os jogos parecidos e a próxima trilha aparecem aqui.</div>';
    }

    return relatedGames.map(item => {
      const model = typeof sharedCard.buildCompactGuideCardModel === 'function'
        ? sharedCard.buildCompactGuideCardModel(item)
        : null;
      const game = model?.game || item?.game || item;
      const hasRisk = model ? model.hasRisk : Number(game?.missable_count || 0) > 0 || hasMissableRiskText(game?.missable || game?.missable_summary || '');
      const shortReason = model?.shortReason || ((item?.reason || 'Boa continuação para manter o ritmo de platina.').length > 96 ? `${(item?.reason || 'Boa continuação para manter o ritmo de platina.').slice(0, 93)}...` : (item?.reason || 'Boa continuação para manter o ritmo de platina.'));
      const difficultyTone = model?.difficultyTone || getDifficultyTone(game?.difficulty);
      const difficultyClass = model?.difficultyClass || getDifficultyToneClass(game?.difficulty);
      const slug = escapeAttribute(model?.slug || game?.slug || '');
      const hasImage = true;
      return `
        <article class="atlas-card atlas-card--game atlas-card--compact atlas-related-guide-card${hasImage ? ' atlas-related-guide-card--with-thumb' : ''}" data-difficulty-tone="${escapeAttribute(difficultyTone)}" data-risk="${hasRisk ? 'missable' : 'none'}">
          ${renderRelatedGuideThumb(game)}
          <div class="atlas-card__body">
            <h3 class="atlas-card__title">${escapeHtml(model?.name || game?.name || 'Jogo')}</h3>
            <p class="atlas-card__reason">${escapeHtml(shortReason)}</p>
            <div class="atlas-card__meta">
              <span class="atlas-meta-signal ${escapeAttribute(difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(model?.difficulty || String(game?.difficulty || '-'))}/10</span>
              <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(model?.time || game?.time || 'Tempo não informado')}</span>
            </div>
            <div class="atlas-card__actions">
              <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-home-game="${escapeAttribute(game?.name || '')}" data-open-guide-card="${slug}">Abrir guia</a>
            </div>
          </div>
        </article>`;
    }).join('');
  }

  function renderGuideComparisonOverview(game, comparisonModel = null) {
    const model = comparisonModel && Array.isArray(comparisonModel.rows)
      ? comparisonModel
      : (typeof sharedCard.buildGuideComparisonModel === 'function'
        ? sharedCard.buildGuideComparisonModel(game, [])
        : (window.GuidePresenter?.buildGuideComparisonModel ? window.GuidePresenter.buildGuideComparisonModel(game, []) : null));

    if (!model?.rows?.length) return '';

    const lead = model.lead;
    return `
      <section class="atlas-panel atlas-panel--support p-5 rounded-[24px] space-y-4 md:col-span-2">
        <div class="atlas-decision-panel__header">
          <div>
            <span class="atlas-section-kicker">Próximo passo depois deste guia</span>
            <h2 class="text-lg md:text-xl font-extrabold mt-2">Se você curtir esta platina, qual jogo deve abrir depois?</h2>
          </div>
          <span class="atlas-tag atlas-tag--accent">Continuidade</span>
        </div>
        ${lead ? `<article class="atlas-card atlas-card--game atlas-card--compact" data-difficulty-tone="${escapeAttribute(getDifficultyTone(lead.difficulty))}"><div class="atlas-card__body"><h3 class="atlas-card__title">${escapeHtml(lead.name)}</h3><p class="atlas-card__reason">${escapeHtml(lead.reason.length > 96 ? `${lead.reason.slice(0, 93)}...` : lead.reason)}</p><div class="atlas-card__meta"><span class="atlas-meta-signal ${escapeAttribute(getDifficultyToneClass(lead.difficulty))}"><i class="fas fa-gauge-high"></i>${escapeHtml(lead.difficulty)}/10</span><span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(lead.time)}</span></div><div class="atlas-card__actions"><button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-home-game="${escapeAttribute(lead.name)}" data-open-guide-card="${escapeAttribute(lead.slug)}">Abrir guia</button></div></div></article>` : ''}
        <div class="grid lg:grid-cols-4 gap-3">
          <a href="/jogo/${escapeAttribute(game?.slug || '')}" class="atlas-card atlas-card--minimal"><div class="atlas-card__body"><h3 class="atlas-card__title">${escapeHtml(model.baseline.name)}</h3><p class="atlas-card__reason">Base atual para comparar ritmo.</p><span class="atlas-card__link">Guia atual</span></div></a>
          ${model.rows.map(item => `<article class="atlas-card atlas-card--game atlas-card--compact" data-difficulty-tone="${escapeAttribute(getDifficultyTone(item.difficulty))}"><div class="atlas-card__body"><h3 class="atlas-card__title">${escapeHtml(item.name)}</h3><p class="atlas-card__reason">${escapeHtml(item.trackDetail)}</p><div class="atlas-card__meta"><span class="atlas-meta-signal ${escapeAttribute(getDifficultyToneClass(item.difficulty))}"><i class="fas fa-gauge-high"></i>${escapeHtml(item.difficulty)}/10</span><span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(item.time)}</span></div><div class="atlas-card__actions"><button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-home-game="${escapeAttribute(item.name)}" data-open-guide-card="${escapeAttribute(item.slug)}">Abrir guia</button></div></div></article>`).join('')}
        </div>
      </section>`;
  }

  function renderGuideRelatedOverview(game, relatedGames = [], comparisonModel = null) {
    const compareHtml = renderGuideComparisonOverview(game, comparisonModel);
    const cardsHtml = `<section class="md:col-span-2 space-y-4"><div class="atlas-decision-panel__header"><div><span class="atlas-section-kicker">Se você gostou desta platina, tente estas 3</span><h2 class="text-lg md:text-xl font-extrabold mt-2">Jogos parecidos para manter o ritmo</h2></div><span class="atlas-tag atlas-tag--soft">Descoberta</span></div><div class="grid md:grid-cols-2 gap-4">${renderGuideRelatedCards(relatedGames)}</div></section>`;
    return `${compareHtml}${cardsHtml}`;
  }

  function renderGuide(game, state = {}) {
    const headerEl = qs('#guideHeader');
    const decisionEl = qs('#guideDecisionStack');
    const sidebarEl = qs('#sidebarInfo');
    const trophiesEl = qs('#trophyList') || qs('#trophiesList') || qs('#guideTrophies');
    const roadmapEl = qs('#guideRoadmapSlot');
    const relatedEl = qs('#guideRelatedOverview');
    const editorialNotesEl = qs('#guideEditorialNotes');
    const isSaved = Boolean(state?.isSaved);
    const libraryEntry = state?.libraryEntry || null;
    const storageLabel = state?.storageLabel || 'Salvo neste navegador';
    const relatedGames = Array.isArray(state?.relatedGames) ? state.relatedGames : [];
    const comparisonModel = state?.comparisonModel || (window.GuidePresenter?.buildGuideComparisonModel ? window.GuidePresenter.buildGuideComparisonModel(game, relatedGames) : null);
    const completedSource = Array.isArray(state)
      ? state
      : Array.isArray(state?.completedTrophies)
        ? state.completedTrophies
        : (Array.isArray(game?.completed) ? game.completed : []);
    const viewModel = buildGuideViewModel(game, completedSource, { isSaved, libraryEntry });
    const guideMeta = getLibraryMeta({ ...game, completed: completedSource, trophies: viewModel.trophies });
    const collectionLinksEl = qs('#guideCollectionLinks');
    if (collectionLinksEl) {
      collectionLinksEl.innerHTML = viewModel.collectionModel.collectionLinks.map(item => `<a href="${escapeAttribute(item.path)}" class="atlas-card atlas-card--minimal atlas-related-collection"><div class="atlas-card__body"><strong class="atlas-card__title">${escapeHtml(item.label)}</strong><span class="atlas-card__reason">${escapeHtml(item.reason)}</span><span class="atlas-card__link">Abrir coleção</span></div></a>`).join('');
    }

    if (decisionEl) {
      decisionEl.innerHTML = renderGuideDecisionStackV2(game, viewModel);
    }

    if (headerEl) {
      headerEl.innerHTML = renderGuideHeaderShell(game, viewModel);
    }
    if (sidebarEl) {
      sidebarEl.innerHTML = renderGuideSidebarCompact(game, viewModel, { guideMeta, isSaved, libraryEntry, storageLabel });
    }
    if (trophiesEl) {
      trophiesEl.innerHTML = viewModel.trophies.length
        ? viewModel.trophies.map((trophy, index) => {
            const done = viewModel.completedIds.has(trophy.id);
            const description = trophy.description || '';
            const tip = trophy.tip || '';
            const officialName = trophy.name || 'Troféu';
            const editorialName = getTrophyEditorialName(trophy);
            const riskTags = typeof getGuideTrophyTags === 'function' ? getGuideTrophyTags(trophy, game) : getTrophyRiskTags(trophy);
            const displayRiskTags = typeof getGuideTrophyDisplayTags === 'function' ? getGuideTrophyDisplayTags(trophy, game, 4) : riskTags.slice(0, 4);
            const riskTokens = riskTags.map(tag => tag.id).join(' ');
            const search = typeof getGuideTrophySearchText === 'function'
              ? getGuideTrophySearchText(trophy, riskTags)
              : normalizeGuideSearchValue(`${trophy.name || ''} ${trophy.name_pt || ''} ${description} ${tip} ${trophy.type || ''} ${riskTags.map(tag => `${tag.id} ${tag.label}`).join(' ')}`);
            const spoilerClasses = trophy.is_spoiler ? 'spoiler-blur' : '';
            const detailsId = buildTrophyDetailsId(trophy, index);
            const spoilerText = trophy.is_spoiler ? '<span class="spoiler-hint">Conteúdo oculto até você revelar.</span>' : '';
            const hasDetailsToggle = shouldShowTrophyDetailsToggle(trophy, description, tip);
            const detailsToggleHtml = hasDetailsToggle
              ? `<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact atlas-trophy-details-toggle" data-trophy-details-toggle="true" aria-expanded="false" aria-controls="${escapeAttribute(detailsId)}"><span data-details-label>Ver detalhes</span><i class="fas fa-chevron-down" aria-hidden="true"></i></button>`
              : '';
            const toggleLabel = done ? 'Desmarcar' : 'Concluir';
            const toggleAria = `${toggleLabel} ${officialName}`;
            return `
              <article class="trophy-card atlas-trophy-card atlas-panel atlas-panel--quiet ${done ? 'completed' : ''} ${hasDetailsToggle ? 'has-details-toggle' : ''}" data-trophy-id="${escapeAttribute(trophy.id || '')}" data-type="${escapeAttribute(trophy.type || 'Bronze')}" data-risks="${escapeAttribute(riskTokens)}" data-status="${done ? 'completed' : 'pending'}" data-search="${escapeAttribute(search)}" ${!done && trophy.id === viewModel.nextActionModel.trophyId ? 'data-next-focus="true"' : ''}>
                <div class="atlas-trophy-card__layout">
                  <div class="atlas-trophy-card__main">
                    <div class="atlas-trophy-card__headline">
                      <div class="atlas-trophy-card__title">
                        <h4>${escapeHtml(officialName)}</h4>
                        ${editorialName ? `<p class="atlas-trophy-card__title-translation">${escapeHtml(editorialName)}</p>` : ''}
                      </div>
                      <div class="atlas-trophy-card__meta">
                        <span class="atlas-trophy-type">${escapeHtml(trophy.type || 'Bronze')}</span>
                        <span class="atlas-trophy-state ${done ? 'atlas-trophy-state--done' : ''}">${done ? 'Concluído' : 'Pendente'}</span>
                      </div>
                    </div>
                    ${displayRiskTags.length ? `<div class="atlas-trophy-risk-list">${displayRiskTags.map(tag => `<span class="atlas-risk-chip atlas-risk-chip--${escapeAttribute(tag.tone)}">${escapeHtml(tag.label)}</span>`).join('')}</div>` : ''}
                    ${trophy.is_spoiler ? '<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact atlas-spoiler-btn" data-spoiler-toggle="true" aria-expanded="false">Revelar spoiler</button>' : ''}
                    <div id="${escapeAttribute(detailsId)}" class="atlas-trophy-details" data-trophy-details>
                      <p class="atlas-trophy-description ${spoilerClasses}" ${trophy.is_spoiler ? 'data-spoiler="true" aria-hidden="true"' : ''}>${spoilerText}${escapeHtml(description || 'Sem descrição.')}</p>
                      ${tip ? `<div class="atlas-tip-box atlas-trophy-tip"><div class="atlas-tip-label">Dica</div><p class="text-sm mt-2 ${spoilerClasses}" ${trophy.is_spoiler ? 'data-spoiler="true" aria-hidden="true"' : ''}>${trophy.is_spoiler ? '<span class="spoiler-hint">Dica oculta até você revelar.</span>' : ''}${escapeHtml(tip)}</p></div>` : ''}
                    </div>
                    ${detailsToggleHtml}
                  </div>
                  <div class="atlas-trophy-card__actions">
                    <button type="button" class="atlas-btn ${done ? 'atlas-btn-secondary' : 'atlas-btn-primary'} atlas-trophy-toggle" data-trophy-toggle="${escapeAttribute(trophy.id || '')}" aria-pressed="${done ? 'true' : 'false'}" aria-label="${escapeAttribute(toggleAria)}"><i class="fas ${done ? 'fa-rotate-left' : 'fa-check'}"></i><span>${escapeHtml(toggleLabel)}</span></button>
                  </div>
                </div>
              </article>
            `;
          }).join('')
        : '<div class="text-white/60">Nenhum troféu cadastrado.</div>';
    }

    if (roadmapEl) {
      roadmapEl.innerHTML = renderGuideRoadmapPanel(viewModel);
    }

    if (editorialNotesEl) {
      editorialNotesEl.innerHTML = renderGuideEditorialNotes(game, viewModel);
    }

    if (relatedEl) {
      relatedEl.innerHTML = renderGuideRelatedOverview(game, relatedGames, comparisonModel);
    }

    const progressLabel = qs('#progressPercent');
    const counterLabel = qs('#guideCounter');
    const quickDockProgressNodes = qsa('[data-quick-dock-progress]');
    if (progressLabel) progressLabel.textContent = `${viewModel.progress}%`;
    if (counterLabel) {
      counterLabel.textContent = viewModel.total > 0
        ? `${viewModel.completed}/${viewModel.total} concluídos`
        : 'Checklist ainda não disponível';
    }
    quickDockProgressNodes.forEach(node => {
      node.textContent = `${viewModel.progress}%`;
      node.setAttribute('aria-label', `Progresso atual ${viewModel.progress}%`);
    });
    applyChecklistDensity();
  }



  function updateProgress(game, completedIds = []) {
    const trophies = Array.isArray(game?.trophies) ? game.trophies : [];
    const doneSet = new Set(Array.isArray(completedIds) ? completedIds : []);
    const total = trophies.length;
    const completed = trophies.filter(t => doneSet.has(t.id)).length;
    const progress = total ? Math.round((completed / total) * 100) : 0;

    const progressBar =
      qs('#guideProgressBar') ||
      qs('#progressBar') ||
      qs('[data-guide-progress-bar]');

    const progressLabel =
      qs('#guideProgressLabel') ||
      qs('#progressLabel') ||
      qs('[data-guide-progress-label]');

    const completedLabel =
      qs('#guideCompletedCount') ||
      qs('#completedCount') ||
      qs('[data-guide-completed-count]');

    const remainingLabel =
      qs('#guideRemainingCount') ||
      qs('#remainingCount') ||
      qs('[data-guide-remaining-count]');

    const quickDockProgressNodes = qsa('[data-quick-dock-progress]');

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressLabel) progressLabel.textContent = `${progress}%`;
    if (completedLabel) completedLabel.textContent = String(completed);
    if (remainingLabel) remainingLabel.textContent = String(Math.max(total - completed, 0));
    quickDockProgressNodes.forEach(node => {
      node.textContent = `${progress}%`;
      node.setAttribute('aria-label', `Progresso atual ${progress}%`);
    });

    return { total, completed, progress };
  }

  function setGuideQuickDockState({ enabled = visible, visible = false, collapsed = false } = {}) {
    const dock = qs('#guideQuickDock');
    const body = typeof document !== 'undefined' ? document.body : null;
    const isCollapsed = Boolean(visible && collapsed);
    if (!dock) {
      body?.classList.toggle('atlas-guide-dock-active', Boolean(visible));
      body?.classList.toggle('atlas-guide-dock-enabled', Boolean(enabled));
      body?.classList.toggle('atlas-guide-dock-collapsed', isCollapsed);
      return;
    }
    dock.setAttribute('aria-hidden', visible ? 'false' : 'true');
    dock.classList.toggle('hidden', !visible);
    dock.classList.toggle('is-enabled', Boolean(enabled));
    dock.classList.toggle('is-collapsed', isCollapsed);
    const toggleButton = dock.querySelector('[data-quick-dock-toggle]');
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    }
    body?.classList.toggle('atlas-guide-dock-active', Boolean(visible));
    body?.classList.toggle('atlas-guide-dock-enabled', Boolean(enabled));
    body?.classList.toggle('atlas-guide-dock-collapsed', isCollapsed);
  }

  return {
    applyTrophyFilter,
    getChecklistDensityPreference,
    applyChecklistDensity,
    setChecklistDensity,
    clearTrophySearch,
    clearGuideChecklistFilters,
    bindGuideSearch,
    getTrophySearchValue,
    renderGuideDecisionStack: renderGuideDecisionStackV2,
    renderGuideRoadmapPanel,
    renderGuideSidebarCompact,
    renderGuideEditorialNotes,
    renderGuideHeaderShell,
    renderGuideRelatedCards,
    renderGuideComparisonOverview,
    renderGuideRelatedOverview,
    renderGuide,
    updateProgress,
    setGuideQuickDockState
  };
})();
