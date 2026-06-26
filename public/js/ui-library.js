window.UILibrary = (() => {
  const { qs, escapeHtml, escapeAttribute, getGameImageSrc, deriveSteamLibraryCover, isPlaceholderGameImage } = window.UIShared;
  const { formatRelativeDate, getLibraryStatusLabel } = window.UIFormatters;
  const {
    buildLibraryRecommendations,
    deriveNextAction,
    getEditorialBadge,
    getLibraryMeta,
    getNextIdealTrophy,
    summarizeLibraryProfile
  } = window.UIDecisionModels;

  const STATUS_FILTERS = [
    { id: 'all', label: 'Todos', matcher: () => true },
    { id: 'in-progress', label: 'Em andamento', matcher: game => game.progress > 0 && game.progress < 100 },
    { id: 'completed', label: 'Concluídos', matcher: game => game.progress >= 100 || game.status === 'completed' },
    { id: 'saved', label: 'Não iniciados', matcher: game => game.progress <= 0 && game.status !== 'completed' }
  ];

  function clampProgress(value = 0) {
    return Math.min(Math.max(Number(value || 0), 0), 100);
  }

  function getLibraryKey(game = {}) {
    return game.slug || game.name || '';
  }

  function getStatusTone(status = '', progress = 0) {
    if (status === 'completed' || progress >= 100) return 'completed';
    if (progress > 0) return 'in-progress';
    return 'saved';
  }

  function buildCatalogLookup(availableGames = []) {
    const lookup = new Map();
    (Array.isArray(availableGames) ? availableGames : []).forEach(game => {
      const keys = [game?.slug, game?.name].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
      keys.forEach(key => lookup.set(key, game));
    });
    return lookup;
  }

  function findCatalogGame(catalogLookup, game = {}) {
    const keys = [game?.slug, game?.name].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
    return keys.map(key => catalogLookup.get(key)).find(Boolean) || null;
  }

  function buildLibraryItems(library = {}, search = '', availableGames = []) {
    const query = String(search || '').trim().toLowerCase();
    const catalogLookup = buildCatalogLookup(availableGames);
    return Object.values(library || {}).map(game => {
      const catalogGame = findCatalogGame(catalogLookup, game) || {};
      const mergedGame = {
        ...catalogGame,
        ...game,
        image: game.image || catalogGame.image || '',
        cover_image: game.cover_image || catalogGame.cover_image || ''
      };
      const trophies = Array.isArray(game.trophies) ? game.trophies : [];
      const validTrophyIds = new Set(trophies.map(trophy => trophy?.id).filter(Boolean));
      const completed = [...new Set((Array.isArray(game.completed) ? game.completed : []).filter(id => !validTrophyIds.size || validTrophyIds.has(id)))];
      const total = trophies.length;
      const done = completed.length;
      const progress = clampProgress(total ? Math.round((done / total) * 100) : Number(game.progress || 0));
      const missables = trophies.filter(t => t && (t.is_missable || t.is_spoiler)).length;
      const status = game.status || (progress >= 100 ? 'completed' : progress > 0 ? 'in-progress' : 'saved');
      const meta = getLibraryMeta({ ...mergedGame, trophies, completed });
      return {
        ...mergedGame,
        total,
        done,
        progress,
        status,
        statusTone: getStatusTone(status, progress),
        statusLabel: getLibraryStatusLabel(status, progress),
        remaining: Math.max(total - done, 0),
        missables,
        savedAt: game.savedAt || game.lastOpenedAt || game.lastActivityAt || null,
        lastOpenedAt: game.lastOpenedAt || game.lastActivityAt || game.savedAt || null,
        lastActivityAt: game.lastActivityAt || game.lastOpenedAt || game.savedAt || null,
        momentumScore: meta.momentumScore,
        momentumLabel: meta.momentumLabel,
        momentumTone: meta.momentumTone,
        progressState: meta.progressState,
        nextActionModel: meta.nextActionModel,
        nextTrophyModel: getNextIdealTrophy({ ...mergedGame, trophies }, completed),
        editorialBadge: typeof getEditorialBadge === 'function' ? getEditorialBadge(mergedGame) : null
      };
    }).filter(game => !query || String(game.name || '').toLowerCase().includes(query));
  }

  function sortLibraryItems(items = [], sort = 'continue') {
    return [...items].sort((a, b) => {
      if (sort === 'name' || sort === 'name-asc') return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      if (sort === 'difficulty' || sort === 'difficulty-desc') return Number(b.difficulty || 0) - Number(a.difficulty || 0);
      if (sort === 'near-100' || sort === 'remaining-asc') return a.remaining - b.remaining || b.progress - a.progress;
      if (sort === 'best-next' || sort === 'today') return b.momentumScore - a.momentumScore || a.remaining - b.remaining || b.progress - a.progress;
      if (sort === 'progress' || sort === 'progress-desc') return b.progress - a.progress || a.remaining - b.remaining;
      if (sort === 'recent' || sort === 'continue') return new Date(b.lastActivityAt || b.lastOpenedAt || b.savedAt || 0) - new Date(a.lastActivityAt || a.lastOpenedAt || a.savedAt || 0);
      return b.progress - a.progress || a.remaining - b.remaining;
    });
  }

  function renderStatusTabs(items = [], activeFilter = 'all') {
    const tabs = qs('#libraryStatusTabs');
    if (!tabs) return;
    if (!items.length) {
      tabs.innerHTML = '';
      return;
    }
    tabs.innerHTML = STATUS_FILTERS.map(filter => {
      const count = items.filter(filter.matcher).length;
      const active = filter.id === activeFilter;
      return `
        <button type="button" class="library-shelf__tab${active ? ' is-active' : ''}${count ? '' : ' is-empty'}" data-library-status="${escapeAttribute(filter.id)}" aria-pressed="${active ? 'true' : 'false'}">
          <span>${escapeHtml(filter.label)}</span>
          <strong>${count}</strong>
        </button>
      `;
    }).join('');
  }

  function renderFocusCards(sorted = []) {
    const focus = qs('#libraryFocus');
    if (!focus) return;

    if (!sorted.length) {
      focus.innerHTML = '';
      return;
    }

    const inProgress = sorted.filter(game => game.progress > 0 && game.progress < 100);
    const candidatePool = inProgress.length ? inProgress : sorted;
    const nextGame = [...candidatePool].sort((a, b) => b.momentumScore - a.momentumScore || a.remaining - b.remaining || b.progress - a.progress)[0];
    const progress = clampProgress(nextGame.progress);
    const title = inProgress.length
      ? nextGame.nextActionModel?.title || 'Retome este guia'
      : 'Nenhum jogo em andamento ainda. Escolha um salvo para começar.';
    const detail = inProgress.length
      ? nextGame.nextActionModel?.detail || nextGame.progressState?.detail || 'Continue pelo próximo passo do guia.'
      : `${nextGame.name || 'Jogo salvo'} está pronto para virar seu primeiro projeto ativo.`;
    const cta = progress > 0 ? 'Continuar' : 'Abrir guia';

    focus.innerHTML = `
      <article class="library-focus-card">
        <div class="library-focus-card__copy">
          <span class="atlas-section-kicker">Retomar agora</span>
          <h3>${escapeHtml(nextGame.name || 'Jogo')}</h3>
          <p>${escapeHtml(title)} ${escapeHtml(detail)}</p>
        </div>
        <div class="library-focus-card__meta" aria-label="Resumo do jogo recomendado">
          <span>${progress}%</span>
          <small>${escapeHtml(nextGame.statusLabel || 'Salvo')}</small>
        </div>
        <button type="button" class="atlas-btn atlas-btn-primary" data-open-game="${escapeAttribute(nextGame.name || '')}" data-open-slug="${escapeAttribute(nextGame.slug || '')}">${escapeHtml(cta)}</button>
      </article>`;
    return;

    const bestToday = [...sorted].sort((a, b) => b.momentumScore - a.momentumScore || a.remaining - b.remaining || b.progress - a.progress)[0];
    const closest = [...sorted].sort((a, b) => a.remaining - b.remaining || b.progress - a.progress)[0];
    const recentlyActive = [...sorted].sort((a, b) => new Date(b.lastActivityAt || b.lastOpenedAt || b.savedAt || 0) - new Date(a.lastActivityAt || a.lastOpenedAt || a.savedAt || 0))[0];
    const cards = [
      { label: 'Abrir hoje', game: bestToday, value: bestToday.momentumLabel, hint: bestToday.progressState.detail },
      { label: 'Mais perto de 100%', game: closest, value: `${closest.remaining}`, hint: `${closest.progress}% completo • ${closest.nextActionModel.cta}` },
      { label: 'Última sessão', game: recentlyActive, value: `${formatRelativeDate(recentlyActive.lastActivityAt || recentlyActive.lastOpenedAt || recentlyActive.savedAt)}`, hint: recentlyActive.nextActionModel.title }
    ];

    focus.innerHTML = cards.map(item => `
      <article class="atlas-panel atlas-panel--support atlas-library-focus p-5 rounded-[24px]">
        <span class="atlas-section-kicker">${escapeHtml(item.label)}</span>
        <h3 class="text-xl font-bold mt-3">${escapeHtml(item.game.name || 'Jogo')}</h3>
        <div class="atlas-library-focus__value text-3xl font-extrabold text-atlas-300">${escapeHtml(item.value)}</div>
        <p class="text-sm text-white/55 mt-2">${escapeHtml(item.hint)}</p>
        <button type="button" class="atlas-btn atlas-btn-primary mt-4" data-open-game="${escapeAttribute(item.game.name || '')}" data-open-slug="${escapeAttribute(item.game.slug || '')}">Abrir guia</button>
      </article>
    `).join('');
  }

  function truncateLibraryText(value = '', maxLength = 112) {
    const text = String(value || '').trim();
    if (!text || text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  }

  function renderLibraryRecommendationThumb(game = {}) {
    const coverImage = getLibraryCoverImage(game);
    const bannerImage = coverImage ? '' : getLibraryBannerImage(game);
    const source = coverImage || bannerImage;
    const modeClass = coverImage ? ' library-rec-card__thumb--cover' : bannerImage ? ' library-rec-card__thumb--banner' : '';
    const fallbackClass = source ? '' : ' library-rec-card__thumb--fallback';
    const image = source
      ? `<img src="${escapeAttribute(getGameImageSrc(source))}" alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="this.hidden=true;this.parentElement.classList.add('library-rec-card__thumb--fallback');">`
      : '';
    return `
      <div class="library-rec-card__thumb${modeClass}${fallbackClass}">
        <span aria-hidden="true"></span>
        ${image}
      </div>`;
  }

  function renderSuggestions(sorted = [], availableGames = []) {
    const suggestions = qs('#librarySuggestions');
    if (!suggestions) return;

    if (!sorted.length) {
      suggestions.innerHTML = '';
      return;
    }

    {
    const recommendationItems = buildLibraryRecommendations(sorted, availableGames).slice(0, 3);
    const profile = summarizeLibraryProfile(sorted);
    const topNext = [...sorted]
      .filter(game => game.nextTrophyModel)
      .sort((a, b) => b.momentumScore - a.momentumScore || a.remaining - b.remaining)[0] || null;

    const usefulMetrics = profile ? [
      { label: 'Salvos', value: sorted.length },
      profile.openProjects > 0 ? { label: 'Em andamento', value: profile.openProjects } : null,
      profile.nearFinish > 0 ? { label: 'Perto de 100%', value: profile.nearFinish } : null,
      profile.avgDifficulty > 0 ? { label: 'Dificuldade média', value: `${Math.round(profile.avgDifficulty * 10) / 10}/10` } : null
    ].filter(Boolean) : [];

    const profileCard = profile ? `
      <article class="library-profile-card">
        <div>
          <span class="atlas-section-kicker">Seu ritmo atual</span>
          <h3>Resumo da coleção</h3>
          <p>${escapeHtml(profile.openProjects > 0 ? `${profile.style} ${profile.pace}` : 'Nenhum jogo em andamento ainda. Escolha um salvo para começar.')}</p>
        </div>
        <div class="library-profile-card__metrics">
          ${usefulMetrics.map(metric => `<span><strong>${escapeHtml(String(metric.value))}</strong>${escapeHtml(metric.label)}</span>`).join('')}
        </div>
        ${topNext && profile.openProjects > 0 ? `
          <div class="library-profile-card__next">
            <span>Próximo troféu</span>
            <strong>${escapeHtml(topNext.nextTrophyModel.name)}</strong>
            <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-open-game="${escapeAttribute(topNext.name || '')}" data-open-slug="${escapeAttribute(topNext.slug || '')}">Continuar</button>
          </div>` : ''}
      </article>` : '';

    const recCard = recommendationItems.length ? `
      <article class="library-recommendations-card">
        <div class="library-recommendations-card__head">
          <div>
            <span class="atlas-section-kicker">Recomendações</span>
            <h3>Próximos jogos sugeridos</h3>
          </div>
        </div>
        <div class="library-rec-list">
          ${recommendationItems.map(item => {
            const game = item.game || {};
            return `
              <article class="library-rec-card">
                ${renderLibraryRecommendationThumb(game)}
                <div class="library-rec-card__body">
                  <div>
                    <strong>${escapeHtml(game.name || 'Jogo')}</strong>
                    <p>${escapeHtml(truncateLibraryText(item.reason || 'Boa continuação para manter o ritmo.', 96))}</p>
                  </div>
                  <div class="library-rec-card__meta">
                    <span>${escapeHtml(String(game.difficulty || '-'))}/10</span>
                    <span>${escapeHtml(game.time || 'Tempo não informado')}</span>
                  </div>
                </div>
                <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-open-game="${escapeAttribute(game.name || '')}" data-open-slug="${escapeAttribute(game.slug || '')}">Abrir guia</button>
              </article>`;
          }).join('')}
        </div>
      </article>` : `
      <article class="library-recommendations-card library-recommendations-card--empty">
        <span class="atlas-section-kicker">Recomendações</span>
        <h3>Recomendações aparecem quando houver mais contexto</h3>
        <p>Salve mais jogos para receber sugestões compactas baseadas na sua coleção.</p>
      </article>`;

    suggestions.innerHTML = `${profileCard}${recCard}`;
    return;
    }

    const recommendationItems = buildLibraryRecommendations(sorted, availableGames);
    const profile = summarizeLibraryProfile(sorted);
    const topNext = [...sorted]
      .filter(game => game.nextTrophyModel)
      .sort((a, b) => b.momentumScore - a.momentumScore || a.remaining - b.remaining)[0] || null;

    const profileCard = profile ? `
      <article class="atlas-panel atlas-panel--support p-5 md:p-6 rounded-[24px] space-y-4">
        <div>
          <span class="atlas-section-kicker">Seu ritmo atual</span>
          <h3 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Continue de onde faz mais sentido</h3>
          <p class="text-white/58 mt-2">${escapeHtml(profile.style)} ${escapeHtml(profile.pace)}</p>
        </div>
        <div class="grid sm:grid-cols-2 gap-3 text-sm text-white/72">
          <div class="atlas-panel atlas-panel--plain rounded-[18px] p-4">
            <div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Projetos abertos</div>
            <strong class="block text-2xl text-atlas-300 mt-2">${profile.openProjects}</strong>
            <span>${profile.nearFinish} perto de 100%</span>
          </div>
          <div class="atlas-panel atlas-panel--plain rounded-[18px] p-4">
            <div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Média atual</div>
            <strong class="block text-2xl text-atlas-300 mt-2">${Math.round(profile.avgDifficulty * 10) / 10}/10</strong>
            <span>${profile.avgTime ? `até ${Math.round(profile.avgTime)}h por projeto` : 'tempo ainda indefinido'}</span>
          </div>
        </div>
        ${topNext ? `
          <div class="atlas-panel atlas-panel--support rounded-[18px] p-4">
            <div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Próximo troféu ideal</div>
            <strong class="block text-white mt-2">${escapeHtml(topNext.nextTrophyModel.name)}</strong>
            <p class="text-sm text-white/68 mt-2">${escapeHtml(topNext.nextTrophyModel.detail)}</p>
            <button type="button" class="atlas-btn atlas-btn-primary mt-4" data-open-game="${escapeAttribute(topNext.name || '')}" data-open-slug="${escapeAttribute(topNext.slug || '')}">Abrir ${escapeHtml(topNext.name || 'guia')}</button>
          </div>` : ''}
      </article>` : '';

    const recCard = recommendationItems.length ? `
      <article class="atlas-panel atlas-panel--support p-5 md:p-6 rounded-[24px] space-y-4">
        <div>
          <span class="atlas-section-kicker">Próximos jogos sugeridos</span>
          <h3 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Baseado no que você já salvou</h3>
          <p class="text-white/58 mt-2">Sugestões pensadas para manter ritmo, reduzir atrito ou encaixar melhor no perfil que a sua biblioteca já mostra.</p>
        </div>
        <div class="space-y-3">
          ${recommendationItems.map(item => {
            const game = item.game || {};
            return `
              <div class="atlas-panel atlas-panel--plain rounded-[18px] p-4 space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <strong class="text-white">${escapeHtml(game.name || 'Jogo')}</strong>
                      <span class="atlas-tag atlas-tag--accent">${escapeHtml(item.badge)}</span>
                    </div>
                    <p class="text-sm text-white/65 mt-2">${escapeHtml(item.reason)}</p>
                  </div>
                  <span class="atlas-tag">${escapeHtml(String(game.difficulty || '-'))}/10</span>
                </div>
                <div class="flex flex-wrap gap-2 text-xs text-white/60">
                  <span class="atlas-tag">${escapeHtml(game.time || 'Tempo não informado')}</span>
                  <span class="atlas-tag">${escapeHtml(String(game.trophy_count || game.trophies?.length || 0))} troféus</span>
                </div>
                <div class="flex flex-wrap gap-3">
                  <button type="button" class="atlas-btn atlas-btn-primary" data-open-game="${escapeAttribute(game.name || '')}" data-open-slug="${escapeAttribute(game.slug || '')}">Abrir guia</button>
                </div>
              </div>`;
          }).join('')}
        </div>
      </article>` : `
      <article class="atlas-panel atlas-panel--plain p-5 md:p-6 rounded-[24px] space-y-4">
        <span class="atlas-section-kicker">Próximos jogos sugeridos</span>
        <h3 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">As recomendações aparecem aqui</h3>
        <p class="text-white/58 mt-2">Salve mais jogos ou aumente o catálogo para gerar sugestões mais personalizadas a partir da biblioteca.</p>
      </article>`;

    suggestions.innerHTML = `${profileCard}${recCard}`;
  }

  function getLibraryCoverImage(game = {}) {
    const cover = String(game.cover_image || '').trim();
    if (cover && !(isPlaceholderGameImage ? isPlaceholderGameImage(cover) : false)) return cover;

    const image = String(game.image || '').trim();
    const derivedCover = typeof deriveSteamLibraryCover === 'function' ? deriveSteamLibraryCover(image) : '';
    return derivedCover && !(isPlaceholderGameImage ? isPlaceholderGameImage(derivedCover) : false) ? derivedCover : '';
  }

  function getLibraryBannerImage(game = {}) {
    const image = String(game.image || '').trim();
    return image && !(isPlaceholderGameImage ? isPlaceholderGameImage(image) : false) ? image : '';
  }

  function renderCover(game = {}) {
    const coverImage = getLibraryCoverImage(game);
    const bannerImage = getLibraryBannerImage(game);
    const sourceImage = coverImage || bannerImage;
    const image = sourceImage ? getGameImageSrc(sourceImage) : '';
    const title = game.name || 'Jogo';
    const backdrop = bannerImage && !coverImage
      ? `<img class="library-game__backdrop" src="${escapeAttribute(getGameImageSrc(bannerImage))}" alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="this.hidden=true;">`
      : '';
    return `
      <div class="library-game__cover${image ? '' : ' library-game__cover--fallback-visible'}">
        <span class="library-game__fallback" aria-hidden="true"></span>
        ${backdrop}
        ${image ? `<img class="library-game__image" src="${escapeAttribute(image)}" alt="" aria-hidden="true" loading="lazy" decoding="async" sizes="(max-width: 640px) 30vw, 150px" onerror="this.hidden=true;this.parentElement.classList.add('library-game__cover--fallback-visible');var card=this.closest('.library-game');if(card){card.classList.add('library-game--no-image');card.classList.remove('library-game--poster-cover','library-game--banner-fallback');}var backdrop=this.parentElement.querySelector('.library-game__backdrop');if(backdrop)backdrop.setAttribute('hidden','hidden');">` : ''}
      </div>
    `;
  }

  function renderLibraryGame(game = {}) {
    const key = getLibraryKey(game);
    const nextActionModel = game.nextActionModel || deriveNextAction(game, game.completed || []);
    const elementKey = String(key || game.name || 'game').replace(/[^a-z0-9_-]+/gi, '-');
    const detailsId = `library-details-${elementKey}`;
    const menuId = `library-menu-${elementKey}`;
    const progress = clampProgress(game.progress);
    const statusBadge = game.editorialBadge || { label: 'Guia parcial' };
    const title = game.name || 'Sem nome';
    const hasPosterCover = Boolean(getLibraryCoverImage(game));
    const hasBannerFallback = !hasPosterCover && Boolean(getLibraryBannerImage(game));
    const imageClass = hasPosterCover ? 'library-game--poster-cover' : hasBannerFallback ? 'library-game--banner-fallback' : 'library-game--no-image';

    return `
      <article class="library-game library-game--${escapeAttribute(game.statusTone)} ${imageClass}" data-library-game="${escapeAttribute(key)}" tabindex="0" role="link" aria-label="Abrir guia de ${escapeAttribute(title)}" aria-describedby="${escapeAttribute(detailsId)}">
        <div class="library-game__poster">
          ${renderCover(game)}
          <div class="library-game__progress" aria-hidden="true">
            <span style="width:${progress}%"></span>
          </div>
          <div class="library-game__caption">
            <h3 class="library-game__title">${escapeHtml(title)}</h3>
            <span class="library-game__state">${escapeHtml(game.statusLabel)}</span>
          </div>
          <button type="button" class="library-game__details-toggle" data-library-options aria-label="Abrir opções de ${escapeAttribute(title)}" aria-haspopup="menu" aria-expanded="false" aria-controls="${escapeAttribute(menuId)}">
            <i class="fas fa-ellipsis" aria-hidden="true"></i>
          </button>
          <div id="${escapeAttribute(detailsId)}" class="library-game__overlay">
            <div class="library-game__overlay-head">
              <strong>${escapeHtml(title)}</strong>
              <span>${escapeHtml(game.momentumLabel || game.statusLabel)}</span>
            </div>
            <dl class="library-game__meta">
              <div><dt>Dificuldade</dt><dd>${escapeHtml(String(game.difficulty || '-'))}/10</dd></div>
              <div><dt>Tempo</dt><dd>${escapeHtml(game.time || 'Tempo não informado')}</dd></div>
              <div><dt>Troféus</dt><dd>${game.done}/${game.total || 0}</dd></div>
              <div><dt>Progresso</dt><dd>${progress}%</dd></div>
              <div><dt>Guia</dt><dd>${escapeHtml(statusBadge.label || 'Guia parcial')}</dd></div>
              <div><dt>Atividade</dt><dd>${escapeHtml(formatRelativeDate(game.lastActivityAt || game.lastOpenedAt || game.savedAt))}</dd></div>
            </dl>
            <p class="library-game__next">${escapeHtml(nextActionModel.title)} · ${escapeHtml(nextActionModel.detail)}</p>
            <div class="library-game__actions">
              <button type="button" class="library-game__action library-game__action--primary" data-open-game="${escapeAttribute(title)}" data-open-slug="${escapeAttribute(game.slug || '')}">
                Abrir guia
              </button>
            </div>
          </div>
        </div>
        <div id="${escapeAttribute(menuId)}" class="library-game__options-menu auth-menu user-menu hidden" data-library-options-menu role="menu" aria-label="Opções de ${escapeAttribute(title)}">
          <button type="button" class="auth-menu__item auth-menu__item--danger user-menu__item user-menu__item--danger" data-delete-game="${escapeAttribute(key)}" role="menuitem">
            <i class="fas fa-trash" aria-hidden="true"></i>
            <span>Remover da biblioteca</span>
          </button>
        </div>
      </article>
    `;
  }

  function buildLibraryEmptyState({ hasSavedItems, search, statusFilter, activeFilter } = {}) {
    const trimmedSearch = String(search || '').trim();

    if (!hasSavedItems && !trimmedSearch) {
      return {
        title: 'Sua próxima platina começa aqui.',
        detail: 'Salve um guia para acompanhar progresso, checklist e próxima etapa sem precisar procurar tudo de novo.',
        helper: 'Entre para sincronizar sua biblioteca entre dispositivos.',
        benefits: [
          'Continue de onde parou.',
          'Acompanhe checklist e roadmap.',
          'Organize suas platinas em andamento.'
        ],
        example: true,
        action: '<a class="atlas-btn atlas-btn-primary" href="/catalogo" data-library-catalog-link><i class="fas fa-compass" aria-hidden="true"></i> Explorar guias para salvar</a>',
        premium: true
      };
    }

    if (trimmedSearch) {
      return {
        title: 'Nenhum jogo encontrado',
        detail: hasSavedItems
          ? 'Revise o termo buscado ou limpe a busca para ver todos os jogos salvos.'
          : 'Você ainda não salvou jogos para pesquisar. Comece pelo catálogo.',
        action: hasSavedItems
          ? '<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-library-clear-search><i class="fas fa-xmark" aria-hidden="true"></i> Limpar busca</button>'
          : '<a class="atlas-btn atlas-btn-primary atlas-btn-compact" href="/catalogo"><i class="fas fa-compass" aria-hidden="true"></i> Explorar catálogo</a>'
      };
    }

    if (statusFilter === 'in-progress') {
      return {
        title: 'Nenhum jogo em andamento',
        detail: 'Abra um jogo salvo, marque alguns troféus no checklist e ele passa a aparecer aqui automaticamente.',
        action: '<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-library-status="all"><i class="fas fa-layer-group" aria-hidden="true"></i> Ver todos os salvos</button>'
      };
    }

    if (statusFilter === 'completed') {
      return {
        title: 'Nenhuma platina concluída ainda',
        detail: 'Quando um checklist chegar a 100%, o jogo entra nesta aba para consulta rápida.',
        action: '<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-library-status="all"><i class="fas fa-layer-group" aria-hidden="true"></i> Ver todos os salvos</button>'
      };
    }

    if (statusFilter === 'saved') {
      return {
        title: 'Nenhum jogo salvo para depois',
        detail: 'Os jogos sem progresso aparecem aqui. Use a aba Todos para retomar o que já está em andamento.',
        action: '<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-library-status="all"><i class="fas fa-layer-group" aria-hidden="true"></i> Ver todos os salvos</button>'
      };
    }

    return {
      title: activeFilter?.label ? `Nada em ${activeFilter.label.toLowerCase()}` : 'Nada nesta aba',
      detail: 'Troque o filtro para ver outros jogos salvos ou explore o catálogo para adicionar mais opções.',
      action: '<a class="atlas-btn atlas-btn-primary atlas-btn-compact" href="/catalogo"><i class="fas fa-compass" aria-hidden="true"></i> Explorar catálogo</a>'
    };
  }

  function renderLibrary(library = {}, options = {}) {
    const view = qs('#view-library');
    const target = qs('#libraryGrid') || qs('#libraryList') || qs('#libraryContent');
    const summary = qs('#librarySummary');
    const syncStatus = qs('#librarySyncStatus');
    const empty = qs('#libraryEmptyState');
    if (!target) return;

    const search = String(options.search || '').trim();
    const sort = options.sort || 'continue';
    const statusFilter = STATUS_FILTERS.some(filter => filter.id === options.statusFilter) ? options.statusFilter : 'all';
    const availableGames = Array.isArray(options.availableGames) ? options.availableGames : [];

    const libraryItems = buildLibraryItems(library, '', availableGames);
    const searchedItems = buildLibraryItems(library, search, availableGames);
    renderStatusTabs(searchedItems, statusFilter);
    const hasSavedItems = libraryItems.length > 0;

    if (view) {
      view.classList.remove('is-library-loading');
      view.classList.toggle('is-library-empty', !hasSavedItems);
      view.classList.toggle('has-library-items', hasSavedItems);
    }

    if (syncStatus) {
      syncStatus.textContent = options.storageLabel || 'Salvo neste navegador';
    }

    const activeFilter = STATUS_FILTERS.find(filter => filter.id === statusFilter) || STATUS_FILTERS[0];
    const sorted = sortLibraryItems(searchedItems.filter(activeFilter.matcher), sort);

    if (summary) {
      if (!libraryItems.length) {
        summary.textContent = '';
      } else if (!searchedItems.length) {
        summary.textContent = 'Nenhum jogo salvo corresponde à busca.';
      } else {
        const inProgress = searchedItems.filter(game => game.progress > 0 && game.progress < 100).length;
        const completedGames = searchedItems.filter(game => game.progress >= 100).length;
        summary.textContent = `${searchedItems.length} jogo(s) salvo(s) • ${inProgress} em andamento • ${completedGames} concluído(s).`;
      }
    }

    const librarySorted = sortLibraryItems(libraryItems, sort);
    renderFocusCards(librarySorted);
    renderSuggestions(librarySorted, availableGames);

    if (empty) empty.classList.toggle('hidden', searchedItems.length > 0);

    target.classList.add('library-shelf__grid');
    target.setAttribute('aria-live', 'polite');

    if (!sorted.length) {
      const emptyTitle = statusFilter === 'in-progress' && !search
        ? 'Nenhum jogo em andamento ainda'
        : search ? 'Nenhum jogo encontrado' : 'Nada nesta aba';
      const emptyDetail = statusFilter === 'in-progress' && !search
        ? 'Escolha um salvo para começar.'
        : search ? 'Tente outro termo ou limpe a busca.' : 'Troque o filtro para ver outros jogos salvos.';
      const emptyState = buildLibraryEmptyState({
        hasSavedItems: libraryItems.length > 0,
        search,
        statusFilter,
        activeFilter
      });
      target.innerHTML = `
        <div class="library-shelf__empty${emptyState.premium ? ' library-shelf__empty--welcome' : ''}">
          <div class="library-empty__copy">
            <strong>${escapeHtml(emptyState.title || emptyTitle)}</strong>
            <span>${escapeHtml(emptyState.detail || emptyDetail)}</span>
            ${Array.isArray(emptyState.benefits) && emptyState.benefits.length ? `
              <ul class="library-empty__benefits" aria-label="Benefícios de salvar guias">
                ${emptyState.benefits.slice(0, 3).map(item => `<li><i class="fas fa-check" aria-hidden="true"></i>${escapeHtml(item)}</li>`).join('')}
              </ul>
            ` : ''}
            ${emptyState.helper ? `<small>${escapeHtml(emptyState.helper)}</small>` : ''}
            ${emptyState.action || ''}
          </div>
          ${emptyState.example ? `
            <article class="library-empty-example" aria-label="Exemplo visual de guia salvo">
              <span>Exemplo de guia salvo</span>
              <strong>Hades</strong>
              <div class="library-empty-example__progress" aria-hidden="true"><span style="width:0%"></span></div>
              <p>0% concluído</p>
              <small>Próxima etapa: começar pelo roadmap</small>
              <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" disabled>Continuar</button>
            </article>
          ` : ''}
        </div>
      `;
      return;
    }

    target.innerHTML = sorted.map(renderLibraryGame).join('');
  }

  return { renderLibrary };
})();
