const UI = (() => {
  const toastTimer = { id: null };

  function qs(selector) { return document.querySelector(selector); }
  function qsa(selector) { return Array.from(document.querySelectorAll(selector)); }
  function has(selector) { return Boolean(qs(selector)); }
  function setClass(selector, className, force) { const el = qs(selector); if (el) el.classList.toggle(className, force); }



  const FALLBACK_GAME_IMAGE = '/og-default.svg';

  function getGameImageSrc(value) {
    return value || FALLBACK_GAME_IMAGE;
  }

  function buildImageAttrs(src, alt, className, options = {}) {
    const loading = options.loading || 'lazy';
    const decoding = options.decoding || 'async';
    const fetchpriority = options.fetchpriority ? ` fetchpriority="${escapeAttribute(options.fetchpriority)}"` : '';
    const sizes = options.sizes ? ` sizes="${escapeAttribute(options.sizes)}"` : '';
    const width = options.width ? ` width="${escapeAttribute(String(options.width))}"` : '';
    const height = options.height ? ` height="${escapeAttribute(String(options.height))}"` : '';
    return `<img src="${escapeAttribute(getGameImageSrc(src))}" alt="${escapeAttribute(alt || '')}" class="${className}" loading="${escapeAttribute(loading)}" decoding="${escapeAttribute(decoding)}"${fetchpriority}${sizes}${width}${height}>`;
  }

  function showToast(message, type = 'success') {
    const toast = qs('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'} show`;
    if (toastTimer.id) clearTimeout(toastTimer.id);
    toastTimer.id = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function setLoading(loading) {
    setClass('#loading', 'hidden', !loading);
    if (loading) setClass('#guideContent', 'hidden', true);
  }

  function updateLibraryBadge(library) {
    const count = Object.keys(library).length;
    [qs('#libraryBadge'), ...qsa('[data-mobile-library-badge]')].filter(Boolean).forEach(badge => {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    });
  }

  function showView(viewId) {
    qsa('main > section').forEach(section => section.classList.add('hidden'));
    const target = qs(`#view-${viewId}`);
    if (target) target.classList.remove('hidden');
    qsa('[data-view-link]').forEach(button => {
      const isActive = button.dataset.viewLink === viewId;
      button.classList.toggle('is-active', isActive);
    });
  }

  function setSearchFeedback(message = '', type = 'default') {
    const feedback = qs('#searchFeedback');
    if (!feedback) return;
    feedback.textContent = message || '';
    feedback.className = `mt-3 text-sm ${type === 'error' ? 'text-rose-300' : type === 'success' ? 'text-emerald-300' : 'text-white/50'}`;
  }

  function renderSuggestions(games, options = {}) {
    const suggestionsDiv = qs('#suggestions');
    if (!suggestionsDiv) return;
    const activeIndex = Number.isInteger(options.activeIndex) ? options.activeIndex : -1;

    if (!games.length) {
      suggestionsDiv.innerHTML = '';
      suggestionsDiv.classList.add('hidden');
      suggestionsDiv.setAttribute('aria-expanded', 'false');
      qs('#gameInput')?.setAttribute('aria-expanded', 'false');
      setSearchFeedback('Nenhum jogo encontrado com esse nome. Tente outro termo.', 'error');
      return;
    }

    setSearchFeedback(`Abrindo o resultado mais próximo ao pressionar Enter. ${games.length} sugestão(ões) encontrada(s).`, 'default');
    suggestionsDiv.innerHTML = games.map((game, index) => {
      const isActive = index === activeIndex;
      const imageMarkup = game.image
        ? buildImageAttrs(game.image, '', 'h-14 w-10 rounded-lg object-cover border border-white/10 bg-white/5 shrink-0', { width: 40, height: 56, sizes: '40px' })
        : `<div class="h-14 w-10 rounded-lg border border-white/10 bg-white/5 shrink-0"></div>`;
      const meta = [`Dificuldade ${escapeHtml(game.difficulty || '?')}/10`, escapeHtml(game.time || 'Tempo não informado')].join(' • ');
      return `
        <button
          type="button"
          class="atlas-suggestion-item ${isActive ? 'is-active' : ''}"
          data-suggestion="${escapeAttribute(game.name)}"
          data-suggestion-index="${index}"
          data-suggestion-slug="${escapeAttribute(game.slug || '')}"
          role="option"
          aria-selected="${isActive ? 'true' : 'false'}"
        >
          <span class="flex items-center gap-3">
            ${imageMarkup}
            <span class="min-w-0">
              <span class="block font-semibold text-white truncate">${escapeHtml(game.name)}</span>
              <span class="mt-1 block text-xs text-slate-400 truncate">${meta}</span>
            </span>
          </span>
          <span class="text-[11px] uppercase tracking-[0.18em] text-sky-200/80">Abrir</span>
        </button>
      `;
    }).join('');
    suggestionsDiv.classList.remove('hidden');
    suggestionsDiv.setAttribute('aria-expanded', 'true');
    qs('#gameInput')?.setAttribute('aria-expanded', 'true');
  }

  function hideSuggestions() {
    const suggestions = qs('#suggestions');
    if (suggestions) {
      suggestions.classList.add('hidden');
      suggestions.setAttribute('aria-expanded', 'false');
      qs('#gameInput')?.setAttribute('aria-expanded', 'false');
    }
  }

  function setGuideEmptyState(visible, message = 'Nenhum troféu corresponde ao filtro atual. Limpe a busca ou troque o filtro.') {
    const empty = qs('#guideEmptyState');
    if (!empty) return;
    empty.textContent = message;
    empty.classList.toggle('hidden', !visible);
  }




  function setAdminFormFeedback(message = '', type = 'info') {
    const target = qs('#adminFormFeedback');
    if (!target) return;
    target.textContent = message || '';
    target.className = `text-sm ${type === 'error' ? 'text-rose-300' : type === 'success' ? 'text-emerald-300' : 'text-white/55'}`;
  }

  function togglePasswordPanel(force) {
    const panel = qs('#adminPasswordPanel');
    if (!panel) return;
    const shouldOpen = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldOpen);
  }

  function togglePreviewPanel(force) {
    const panel = qs('#adminPreviewPanel');
    if (!panel) return;
    const shouldOpen = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldOpen);
  }

  function renderAdminPreview(game = {}) {
    const target = qs('#adminPreviewContent');
    const openBtn = qs('#previewOpenPublicBtn');
    if (!target) return;
    const roadmap = Array.isArray(game.roadmap) ? game.roadmap : [];
    const trophies = Array.isArray(game.trophies) ? game.trophies : [];
    const spoilerCount = trophies.filter(item => item.is_spoiler).length;
    const image = getGameImageSrc(game.image);
    target.innerHTML = `
      <div class="grid xl:grid-cols-[320px_1fr] gap-6">
        <div class="atlas-panel p-4 rounded-[24px] bg-white/[0.02]">
          ${buildImageAttrs(image, game.name || 'Sem nome', 'w-full h-[240px] rounded-[18px] object-cover', { width: 900, height: 520, sizes: '(min-width: 1280px) 320px, 100vw' })}
        </div>
        <div class="space-y-4">
          <div class="atlas-panel p-5 rounded-[24px] bg-white/[0.02]">
            <div class="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div class="atlas-tag">Prévia editorial</div>
                <h3 class="text-2xl font-bold mt-3">${escapeHtml(game.name || 'Jogo sem nome')}</h3>
                <p class="text-white/62 mt-2">Dificuldade ${escapeHtml(String(game.difficulty || '-'))}/10 • ${escapeHtml(game.time || 'Tempo não informado')}</p>
              </div>
              <div class="grid grid-cols-2 gap-3 min-w-[240px]">
                <div class="glass-morphism p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Troféus</div><div class="text-2xl font-extrabold mt-2">${trophies.length}</div></div>
                <div class="glass-morphism p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Spoilers</div><div class="text-2xl font-extrabold mt-2">${spoilerCount}</div></div>
              </div>
            </div>
            <p class="text-white/62 mt-4">${escapeHtml(game.missable || 'Sem alerta de perdíveis informado.')}</p>
          </div>
          <div class="grid lg:grid-cols-2 gap-4">
            <div class="atlas-panel p-5 rounded-[24px] bg-white/[0.02]">
              <div class="atlas-label mb-3">Roadmap</div>
              ${roadmap.length ? `<ol class="space-y-2 text-white/72">${roadmap.slice(0,6).map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` : '<div class="text-white/45">Nenhuma etapa cadastrada.</div>'}
            </div>
            <div class="atlas-panel p-5 rounded-[24px] bg-white/[0.02]">
              <div class="atlas-label mb-3">Primeiros troféus</div>
              ${trophies.length ? `<ul class="space-y-2 text-white/72">${trophies.slice(0,5).map(item => `<li><strong>${escapeHtml(item.name)}</strong> <span class="text-white/45">• ${escapeHtml(item.type || 'Bronze')}</span></li>`).join('')}</ul>` : '<div class="text-white/45">Nenhum troféu cadastrado.</div>'}
            </div>
          </div>
        </div>
      </div>`;
    if (openBtn) {
      const hasSlug = Boolean(game.slug);
      openBtn.classList.toggle('hidden', !hasSlug);
      openBtn.dataset.previewSlug = hasSlug ? game.slug : '';
    }
    togglePreviewPanel(true);
  }

  function renderPagination(targetSelector, pagination = {}, options = {}) {
    const target = qs(targetSelector);
    if (!target) return;

    const page = Number(pagination.page || 1);
    const totalPages = Number(pagination.totalPages || 1);
    const total = Number(pagination.total || 0);
    const itemLabel = options.itemLabel || 'itens';

    if (!total || totalPages <= 1) {
      target.innerHTML = total ? `<div class="text-sm text-white/45">${total} ${itemLabel} no total.</div>` : '';
      return;
    }

    const windowStart = Math.max(1, page - 2);
    const windowEnd = Math.min(totalPages, page + 2);
    const pages = [];
    for (let value = windowStart; value <= windowEnd; value += 1) pages.push(value);

    target.innerHTML = `
      <div class="text-sm text-white/45 mr-2">Página ${page} de ${totalPages} • ${total} ${itemLabel}</div>
      <button type="button" class="atlas-btn atlas-btn-secondary" data-page-target="${escapeAttribute(options.mode || 'catalog')}" data-page-value="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
      ${pages.map(value => `<button type="button" class="atlas-pill ${value === page ? 'atlas-pill-active' : ''}" data-page-target="${escapeAttribute(options.mode || 'catalog')}" data-page-value="${value}">${value}</button>`).join('')}
      <button type="button" class="atlas-btn atlas-btn-secondary" data-page-target="${escapeAttribute(options.mode || 'catalog')}" data-page-value="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Próxima</button>
    `;
  }

  function renderHomeOverview(games = [], library = {}) {
    const gamesTarget = qs('#gamesOverview');
    const recentTarget = qs('#recentGamesOverview');
    const updatedTarget = qs('#updatedGamesOverview');
    const linksTarget = qs('#browseLinks');
    const resumeTarget = qs('#libraryResume');

    const getTotal = game => Number(game.trophy_count || game.trophies?.length || 0);
    const byRecent = [...games].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const byUpdated = [...games].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    const mostRelevant = [...games].sort((a, b) => getTotal(b) - getTotal(a)).slice(0, 4);

    if (gamesTarget) {
      if (!games.length) {
        gamesTarget.innerHTML = '<div class="col-span-full atlas-panel p-6 text-white/55">Nenhum jogo cadastrado ainda.</div>';
      } else {
        gamesTarget.innerHTML = mostRelevant.map(game => {
          const completed = library[game.name]?.completed || [];
          const total = getTotal(game);
          const percent = total ? Math.round((completed.length / total) * 100) : 0;
          return `
            <a href="/jogo/${escapeAttribute(game.slug)}" class="atlas-guide-preview block" data-home-game="${escapeAttribute(game.name)}">
              ${buildImageAttrs(game.image, game.name, '', { width: 900, height: 520, fetchpriority: 'high', loading: 'eager', decoding: 'sync', sizes: '(min-width: 1280px) 50vw, 100vw' })}
              <div class="atlas-guide-preview__body">
                <span class="atlas-tag">Página do jogo</span>
                <h3>${escapeHtml(game.name)}</h3>
                <p><i class="fas fa-trophy"></i> ${total} troféus • Dificuldade ${game.difficulty}/10</p>
                <div class="atlas-progress"><span style="width:${percent}%"></span></div>
                <strong>${percent}% concluído</strong>
              </div>
            </a>`;
        }).join('');
      }
    }

    if (linksTarget) {
      if (!games.length) {
        linksTarget.innerHTML = '<div class="sm:col-span-2 text-white/55">Os links por jogo aparecerão quando houver catálogo.</div>';
      } else {
        linksTarget.innerHTML = byRecent.slice(0, 8).map(game => `
          <a href="/jogo/${escapeAttribute(game.slug)}" class="atlas-feature-panel" data-home-game="${escapeAttribute(game.name)}">
            <i class="fas fa-arrow-up-right-from-square"></i>
            <div>
              <strong>${escapeHtml(game.name)}</strong>
              <span>${getTotal(game)} troféus • dificuldade ${escapeHtml(String(game.difficulty))}/10</span>
            </div>
          </a>`).join('');
      }
    }

    const renderCompactList = (target, items, emptyMessage, label) => {
      if (!target) return;
      if (!items.length) {
        target.innerHTML = `<div class="atlas-inline-empty">${emptyMessage}</div>`;
        return;
      }
      target.innerHTML = items.slice(0, 5).map(game => `
        <a href="/jogo/${escapeAttribute(game.slug)}" class="atlas-feature-panel justify-between gap-4" data-home-game="${escapeAttribute(game.name)}">
          <div>
            <strong>${escapeHtml(game.name)}</strong>
            <span>${getTotal(game)} troféus • Roadmap ${game.roadmap_count || 0} etapa(s)</span>
          </div>
          <span class="atlas-tag shrink-0">${label}</span>
        </a>`).join('');
    };

    renderCompactList(recentTarget, byRecent, 'Nenhum jogo recente disponível.', 'Novo');
    renderCompactList(updatedTarget, byUpdated, 'Nenhuma atualização recente disponível.', 'Atualizado');

    if (resumeTarget) {
      const libraryGames = Object.values(library).sort((a, b) => (b.completed?.length || 0) - (a.completed?.length || 0));
      if (!libraryGames.length) {
        resumeTarget.innerHTML = `
          <div class="atlas-feature-panel">
            <i class="fas fa-bookmark"></i>
            <div><strong>Nenhum jogo salvo ainda</strong><span>Salve manualmente seus jogos favoritos e continue de onde parou.</span></div>
          </div>`;
      } else {
        resumeTarget.innerHTML = libraryGames.slice(0, 3).map(game => {
          const total = getTotal(game);
          const completed = game.completed?.length || 0;
          const percent = total ? Math.round((completed / total) * 100) : 0;
          return `
            <button type="button" class="w-full atlas-feature-panel text-left" data-home-game="${escapeAttribute(game.name)}">
              <i class="fas fa-play-circle"></i>
              <div>
                <strong>${escapeHtml(game.name)}</strong>
                <span>${completed}/${total} troféus concluídos • ${percent}% completo</span>
              </div>
            </button>`;
        }).join('');
      }
    }
  }

  const catalogFacetMeta = {
    all: {
      path: '/catalogo',
      title: 'Catálogo de jogos | AtlasAchievement',
      description: 'Navegue pelo catálogo de jogos com dificuldade, tempo estimado, troféus e atalhos por faixa de desafio e duração.',
      name: 'Catálogo de jogos'
    },
    'difficulty-low': {
      path: '/catalogo/dificuldade-baixa',
      title: 'Jogos de dificuldade baixa | AtlasAchievement',
      description: 'Veja jogos com dificuldade de 1 a 3 para começar listas de troféus e concluir mais rápido.',
      name: 'Jogos de dificuldade baixa'
    },
    'difficulty-mid': {
      path: '/catalogo/dificuldade-media',
      title: 'Jogos de dificuldade média | AtlasAchievement',
      description: 'Explore jogos com dificuldade de 4 a 6 e escolha projetos intermediários para continuar.',
      name: 'Jogos de dificuldade média'
    },
    'difficulty-high': {
      path: '/catalogo/dificuldade-alta',
      title: 'Jogos de dificuldade alta | AtlasAchievement',
      description: 'Encontre jogos com dificuldade de 7 a 10 para quem busca listas mais exigentes.',
      name: 'Jogos de dificuldade alta'
    },
    'time-short': {
      path: '/catalogo/ate-15-horas',
      title: 'Jogos até 15 horas | AtlasAchievement',
      description: 'Veja jogos com tempo estimado mais curto para concluir troféus em até 15 horas.',
      name: 'Jogos até 15 horas'
    },
    'time-medium': {
      path: '/catalogo/16-a-40-horas',
      title: 'Jogos de 16 a 40 horas | AtlasAchievement',
      description: 'Encontre jogos com tempo estimado de 16 a 40 horas para projetos de médio prazo.',
      name: 'Jogos de 16 a 40 horas'
    },
    'time-long': {
      path: '/catalogo/mais-de-40-horas',
      title: 'Jogos com mais de 40 horas | AtlasAchievement',
      description: 'Navegue por jogos longos e maratonas com listas de troféus acima de 40 horas.',
      name: 'Jogos com mais de 40 horas'
    },
    'trophies-small': {
      path: '/catalogo/ate-30-trofeus',
      title: 'Jogos com até 30 troféus | AtlasAchievement',
      description: 'Abra listas menores, com até 30 troféus, para organizar checklists mais curtos.',
      name: 'Jogos com até 30 troféus'
    },
    'trophies-medium': {
      path: '/catalogo/31-a-60-trofeus',
      title: 'Jogos com 31 a 60 troféus | AtlasAchievement',
      description: 'Explore jogos com listas intermediárias de 31 a 60 troféus.',
      name: 'Jogos com 31 a 60 troféus'
    },
    'trophies-large': {
      path: '/catalogo/mais-de-60-trofeus',
      title: 'Jogos com mais de 60 troféus | AtlasAchievement',
      description: 'Veja jogos com listas longas, acima de 60 troféus, para acompanhar por etapas.',
      name: 'Jogos com mais de 60 troféus'
    }
  };

  function parseTimeValue(value = '') {
    const normalized = String(value).toLowerCase();
    const numbers = normalized.match(/\d+/g);
    if (!numbers) return Number.MAX_SAFE_INTEGER;
    const values = numbers.map(Number);
    return Math.max(...values);
  }

  function getLibraryMeta(game) {
    const total = game.trophies?.length || 0;
    const completed = game.completed || [];
    const completedCount = completed.length;
    const remaining = Math.max(total - completedCount, 0);
    const percent = total ? Math.round((completedCount / total) * 100) : 0;
    const started = completedCount > 0;
    const nextAction = total === 0
      ? 'Abra este jogo para revisar a lista.'
      : remaining === 0
        ? 'Revisar checklist concluído e confirmar 100%.'
        : !started
          ? 'Começar roadmap e marcar o primeiro troféu.'
          : game.missable
            ? 'Retomar checklist e revisar troféus perdíveis.'
            : 'Retomar checklist e concluir os troféus pendentes.';
    return { total, completedCount, remaining, percent, started, nextAction, timeValue: parseTimeValue(game.time), missable: Boolean(game.missable) };
  }



  function formatRelativeDate(value) {
    if (!value) return 'Agora';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Agora';
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.max(Math.round(diffMs / 36e5), 0);
    if (diffHours < 1) return 'Agora';
    if (diffHours < 24) return `${diffHours}h atrás`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString('pt-BR');
  }

  function getLibraryStatusLabel(status, progress) {
    if (status === 'completed' || progress >= 100) return '100% concluído';
    if (status === 'in-progress' || progress > 0) return 'Em andamento';
    return 'Salvo para depois';
  }

  function renderLibrary(library = {}, options = {}) {
    const target = qs('#libraryGrid') || qs('#libraryList') || qs('#libraryContent');
    const summary = qs('#librarySummary');
    const empty = qs('#libraryEmptyState');
    const focus = qs('#libraryFocus');
    if (!target) return;

    const search = String(options.search || '').trim().toLowerCase();
    const sort = options.sort || 'continue';

    const items = Object.values(library || {}).map(game => {
      const trophies = Array.isArray(game.trophies) ? game.trophies : [];
      const completed = Array.isArray(game.completed) ? game.completed : [];
      const total = trophies.length;
      const done = completed.length;
      const progress = total ? Math.round((done / total) * 100) : 0;
      const missables = trophies.filter(t => t && (t.is_missable || t.is_spoiler)).length;
      const status = game.status || (progress >= 100 ? 'completed' : progress > 0 ? 'in-progress' : 'saved');
      return {
        ...game,
        total,
        done,
        progress,
        status,
        statusLabel: getLibraryStatusLabel(status, progress),
        remaining: Math.max(total - done, 0),
        missables,
        savedAt: game.savedAt || game.lastOpenedAt || game.lastActivityAt || null,
        lastOpenedAt: game.lastOpenedAt || game.lastActivityAt || game.savedAt || null,
        lastActivityAt: game.lastActivityAt || game.lastOpenedAt || game.savedAt || null
      };
    }).filter(game => !search || String(game.name || '').toLowerCase().includes(search));

    const sorted = items.sort((a, b) => {
      if (sort === 'name' || sort === 'name-asc') return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      if (sort === 'difficulty' || sort === 'difficulty-desc') return Number(b.difficulty || 0) - Number(a.difficulty || 0);
      if (sort === 'near-100' || sort === 'remaining-asc') return a.remaining - b.remaining || b.progress - a.progress;
      if (sort === 'progress' || sort === 'progress-desc') return b.progress - a.progress || a.remaining - b.remaining;
      if (sort === 'recent' || sort === 'continue') return new Date(b.lastActivityAt || b.lastOpenedAt || b.savedAt || 0) - new Date(a.lastActivityAt || a.lastOpenedAt || a.savedAt || 0);
      return b.progress - a.progress || a.remaining - b.remaining;
    });

    if (summary) {
      if (!sorted.length) {
        summary.textContent = search ? 'Nenhum jogo salvo corresponde à busca.' : 'Sua biblioteca está vazia.';
      } else {
        const inProgress = sorted.filter(game => game.progress > 0 && game.progress < 100).length;
        const completedGames = sorted.filter(game => game.progress >= 100).length;
        summary.textContent = `${sorted.length} jogo(s) salvo(s) • ${inProgress} em andamento • ${completedGames} concluído(s).`;
      }
    }

    if (focus) {
      if (!sorted.length) {
        focus.innerHTML = '';
      } else {
        const mostAdvanced = [...sorted].sort((a, b) => b.progress - a.progress || a.remaining - b.remaining)[0];
        const closest = [...sorted].sort((a, b) => a.remaining - b.remaining || b.progress - a.progress)[0];
        const recentlyActive = [...sorted].sort((a, b) => new Date(b.lastActivityAt || b.lastOpenedAt || b.savedAt || 0) - new Date(a.lastActivityAt || a.lastOpenedAt || a.savedAt || 0))[0];
        const cards = [
          { label: 'Mais avançado', game: mostAdvanced, value: `${mostAdvanced.progress}%`, hint: `${mostAdvanced.done}/${mostAdvanced.total} concluídos` },
          { label: 'Mais perto de 100%', game: closest, value: `${closest.remaining}`, hint: 'troféu(s) restante(s)' },
          { label: 'Atividade recente', game: recentlyActive, value: `${formatRelativeDate(recentlyActive.lastActivityAt || recentlyActive.lastOpenedAt || recentlyActive.savedAt)}`, hint: 'última atualização' }
        ];
        focus.innerHTML = cards.map(item => `
          <article class="atlas-panel atlas-library-focus p-5 rounded-[24px] bg-white/[0.03] border border-white/10">
            <div class="atlas-eyebrow">${escapeHtml(item.label)}</div>
            <h3 class="text-xl font-bold mt-3">${escapeHtml(item.game.name || 'Jogo')}</h3>
            <div class="atlas-library-focus__value text-3xl font-extrabold text-atlas-300">${escapeHtml(item.value)}</div>
            <p class="text-sm text-white/55 mt-2">${escapeHtml(item.hint)}</p>
            <button type="button" class="atlas-btn atlas-btn-secondary mt-4" data-open-game="${escapeAttribute(item.game.name || '')}" data-open-slug="${escapeAttribute(item.game.slug || '')}">Abrir guia</button>
          </article>
        `).join('');
      }
    }

    if (empty) empty.classList.toggle('hidden', sorted.length > 0);

    if (!sorted.length) {
      target.innerHTML = '';
      return;
    }

    target.innerHTML = sorted.map(game => {
      const image = getGameImageSrc(game.image);
      const slug = escapeAttribute(game.slug || '');
      return `
        <article class="atlas-panel rounded-[24px] p-5 bg-white/[0.03] border border-white/10 space-y-4" data-library-game="${escapeAttribute(game.slug || game.name || '')}">
          <div class="flex gap-4">
            ${buildImageAttrs(image, game.name || 'Jogo', 'w-24 h-24 rounded-2xl object-cover bg-white/5', { width: 96, height: 96, sizes: '96px' })}
            <div class="min-w-0 flex-1 space-y-2">
              <h3 class="text-lg font-semibold text-white">${escapeHtml(game.name || 'Sem nome')}</h3>
              <div class="flex flex-wrap gap-2 text-xs text-white/65">
                <span class="atlas-tag">${escapeHtml(game.statusLabel)}</span>
                <span class="atlas-tag">Dificuldade ${escapeHtml(game.difficulty || '-')}</span>
                <span class="atlas-tag">${game.done}/${game.total} concluídos</span>
                ${game.missables ? `<span class="atlas-tag">Perdíveis: ${game.missables}</span>` : ''}
              </div>
              <p class="text-sm text-white/60">Progresso: ${game.progress}% · Restam ${game.remaining} troféu(s)</p>
              <p class="text-xs text-white/42">Última atividade: ${escapeHtml(formatRelativeDate(game.lastActivityAt || game.lastOpenedAt || game.savedAt))}</p>
            </div>
          </div>
          <div class="h-2 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full bg-cyan-400" style="width:${game.progress}%"></div>
          </div>
          <div class="flex flex-wrap gap-3">
            <button type="button" class="atlas-btn atlas-btn-primary" data-open-game="${escapeAttribute(game.name || '')}" data-open-slug="${slug}">Abrir guia</button>
            <button type="button" class="atlas-btn atlas-btn-secondary" data-delete-game="${escapeAttribute(game.slug || game.name || '')}">Remover</button>
          </div>
        </article>
      `;
    }).join('');
  }


  function renderCatalog(response = {}, options = {}) {
    const list = qs('#catalogList');
    const summary = qs('#catalogSummary');
    const segments = qs('#catalogSegments');
    if (!list) return;

    const items = Array.isArray(response.items) ? response.items : [];
    const pagination = response.pagination || {};
    const search = String(options.search || '').trim();
    const facet = options.facet || 'all';
    const getTotal = game => Number(game.trophy_count || game.trophies?.length || 0);
    const getTimeValue = game => parseTimeValue(game.time || '');

    const facetConfigs = [
      { id: 'all', title: 'Todos os jogos', description: 'Ver o catálogo completo.', match: () => true },
      { id: 'difficulty-low', title: 'Dificuldade 1–3', description: 'Jogos mais acessíveis para começar.', match: game => Number(game.difficulty || 0) <= 3 },
      { id: 'difficulty-mid', title: 'Dificuldade 4–6', description: 'Desafio intermediário.', match: game => Number(game.difficulty || 0) >= 4 && Number(game.difficulty || 0) <= 6 },
      { id: 'difficulty-high', title: 'Dificuldade 7–10', description: 'Jogos mais exigentes.', match: game => Number(game.difficulty || 0) >= 7 },
      { id: 'time-short', title: 'Até 15 horas', description: 'Campanhas e listas mais curtas.', match: game => getTimeValue(game) <= 15 },
      { id: 'time-medium', title: '16–40 horas', description: 'Projetos médios para continuar.', match: game => getTimeValue(game) > 15 && getTimeValue(game) <= 40 },
      { id: 'time-long', title: '40+ horas', description: 'Jogos longos e maratonas.', match: game => getTimeValue(game) > 40 && getTimeValue(game) < Number.MAX_SAFE_INTEGER },
      { id: 'trophies-small', title: 'Até 30 troféus', description: 'Listas menores.', match: game => getTotal(game) > 0 && getTotal(game) <= 30 },
      { id: 'trophies-medium', title: '31–60 troféus', description: 'Tamanho intermediário de checklist.', match: game => getTotal(game) > 30 && getTotal(game) <= 60 },
      { id: 'trophies-large', title: '60+ troféus', description: 'Listas longas para acompanhar.', match: game => getTotal(game) > 60 }
    ];

    const activeFacet = facetConfigs.find(item => item.id === facet) || facetConfigs[0];

    if (segments) {
      const segmentCards = facetConfigs.filter(item => item.id !== 'all').map(config => `
          <article class="atlas-segment-card ${config.id === activeFacet.id ? 'is-active' : ''}">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="atlas-tag">Faixa pública</div>
                <h4>${escapeHtml(config.title)}</h4>
              </div>
              <button type="button" class="atlas-pill ${config.id === activeFacet.id ? 'atlas-pill-active' : ''}" data-catalog-facet="${config.id}">${config.id === activeFacet.id ? 'Ativo' : 'Filtrar'}</button>
            </div>
            <p>${escapeHtml(config.description)}</p>
          </article>`);

      segments.innerHTML = `
        <button type="button" class="atlas-clear-filter ${activeFacet.id === 'all' ? 'is-active' : ''}" data-catalog-facet="all">
          <i class="fas fa-layer-group"></i>
          <div>
            <strong>${activeFacet.id === 'all' ? 'Catálogo completo ativo' : 'Limpar filtro por faixa'}</strong>
            <span>${activeFacet.id === 'all' ? 'Você está vendo todos os jogos disponíveis.' : 'Voltar para a lista completa do catálogo.'}</span>
          </div>
        </button>
        ${segmentCards.join('')}`;
    }

    if (summary) {
      const facetLabel = activeFacet.id === 'all' ? 'sem filtro de faixa' : activeFacet.title.toLowerCase();
      summary.textContent = search
        ? `${pagination.total || 0} jogo(s) encontrados para “${search}”, com ${facetLabel}.`
        : `${pagination.total || 0} jogo(s) no catálogo, com ${facetLabel}.`;
    }

    if (!items.length) {
      list.innerHTML = `
        <div class="atlas-panel p-6 text-white/60 md:col-span-2 xl:col-span-3">
          Nenhum jogo encontrado com essa combinação de busca e faixa. Ajuste o termo digitado ou limpe o filtro.
        </div>`;
      renderPagination('#catalogPagination', pagination, { mode: 'catalog', itemLabel: 'jogos' });
      return;
    }

    list.innerHTML = items.map(game => {
      const total = getTotal(game);
      const updated = game.updated_at ? new Date(game.updated_at).toLocaleDateString('pt-BR') : 'Sem data';
      const timeValue = getTimeValue(game);
      const paceLabel = timeValue <= 15 ? 'Curto' : timeValue <= 40 ? 'Médio' : 'Longo';
      return `
        <a href="/jogo/${escapeAttribute(game.slug)}" class="atlas-catalog-card" data-home-game="${escapeAttribute(game.name)}">
          ${buildImageAttrs(game.image, game.name, 'atlas-catalog-card__image', { width: 900, height: 520, sizes: '(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw' })}
          <div class="atlas-catalog-card__body">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="atlas-tag">Página do jogo</div>
                <h3>${escapeHtml(game.name)}</h3>
              </div>
              <span class="atlas-tag atlas-tag--ghost">${escapeHtml(String(game.difficulty))}/10</span>
            </div>
            <p>${total} troféus • ${escapeHtml(game.time || 'Tempo não informado')} • ${game.roadmap_count || 0} etapa(s) no roadmap</p>
            <div class="atlas-catalog-meta">
              <span><i class="fas fa-gauge-high"></i> Ritmo ${paceLabel}</span>
              <span><i class="fas fa-rotate"></i> Atualizado em ${updated}</span>
            </div>
          </div>
        </a>`;
    }).join('');

    renderPagination('#catalogPagination', pagination, { mode: 'catalog', itemLabel: 'jogos' });
  }

  function setCatalogMeta(facet = 'all') {
    const meta = catalogFacetMeta[facet] || catalogFacetMeta.all;
    document.title = meta.title;
    const metaDescription = qs('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute('content', meta.description);
    const canonical = qs('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', `${window.location.origin}${meta.path}`);
    const ogTitle = qs('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.title);
    const ogDescription = qs('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute('content', meta.description);
    const ogUrl = qs('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', `${window.location.origin}${meta.path}`);
    const twitterTitle = qs('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute('content', meta.title);
    const twitterDescription = qs('meta[name="twitter:description"]');
    if (twitterDescription) twitterDescription.setAttribute('content', meta.description);
    const jsonLd = qs('#gameStructuredData');
    if (jsonLd) jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: meta.name,
      url: `${window.location.origin}${meta.path}`,
      description: meta.description
    });
  }

  function applyTrophyFilter(filter, query = '') {
    const normalizedQuery = query.trim().toLowerCase();
    let visibleCount = 0;
    qsa('#trophyList .trophy-card, #trophyList .atlas-trophy-card').forEach(card => {
      const matchesType = filter === 'all' || card.dataset.type === filter;
      const matchesStatus = filter === 'completed' ? card.dataset.status === 'completed' : filter === 'pending' ? card.dataset.status === 'pending' : true;
      const passesFilter = ['completed', 'pending'].includes(filter) ? matchesStatus : matchesType;
      const matchesSearch = !normalizedQuery || (card.dataset.search || '').includes(normalizedQuery);
      const visible = passesFilter && matchesSearch;
      card.classList.toggle('hidden', !visible);
      if (visible) visibleCount += 1;
    });
    qsa('.filter-btn').forEach(button => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('atlas-pill-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const results = qs('#guideResults');
    if (results) results.textContent = `${visibleCount} troféu(s) visível(is)`;
    setGuideEmptyState(visibleCount === 0);
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

  function createTrophyInputBlock(values = {}) {
    return `
      <div class="trophy-input mb-4 p-4 bg-[#111922] rounded-xl space-y-2 border border-white/10">
        <div class="flex items-center justify-between gap-3"><h5 class="text-sm font-semibold text-slate-200">Troféu</h5><button type="button" class="text-xs text-rose-400 hover:text-rose-300" data-remove-trophy>Remover</button></div>
        <input type="text" placeholder="ID do troféu" value="${escapeAttribute(values.id || '')}" class="p-2 rounded bg-slate-700 border border-slate-600 w-full" required>
        <input type="text" placeholder="Nome" value="${escapeAttribute(values.name || '')}" class="p-2 rounded bg-slate-700 border border-slate-600 w-full" required>
        <select class="p-2 rounded bg-slate-700 border border-slate-600 w-full" required>
          <option value="">Tipo</option>
          <option value="Platina" ${values.type === 'Platina' ? 'selected' : ''}>Platina</option>
          <option value="Ouro" ${values.type === 'Ouro' ? 'selected' : ''}>Ouro</option>
          <option value="Prata" ${values.type === 'Prata' ? 'selected' : ''}>Prata</option>
          <option value="Bronze" ${values.type === 'Bronze' ? 'selected' : ''}>Bronze</option>
        </select>
        <textarea placeholder="Descrição" class="p-2 rounded bg-slate-700 border border-slate-600 w-full" required>${escapeHtml(values.description || '')}</textarea>
        <textarea placeholder="Dica" class="p-2 rounded bg-slate-700 border border-slate-600 w-full" required>${escapeHtml(values.tip || '')}</textarea>
        <label class="flex items-center text-sm"><input type="checkbox" class="mr-2" ${values.is_spoiler ? 'checked' : ''}> Contém spoiler</label>
      </div>`;
  }

  function setImagePreview(imageUrl = '') {
    const preview = qs('#gameImagePreview'); const image = qs('#gameImagePreviewImg'); const empty = qs('#gameImagePreviewEmpty'); const input = qs('#gameImage'); const clearButton = qs('#clearImageBtn');
    if (!input || !preview || !image || !empty || !clearButton) return;
    input.value = imageUrl;
    if (imageUrl) { image.src = imageUrl; image.classList.remove('hidden'); preview.classList.remove('hidden'); empty.classList.add('hidden'); clearButton.classList.remove('hidden'); }
    else { image.removeAttribute('src'); image.classList.add('hidden'); preview.classList.add('hidden'); empty.classList.remove('hidden'); clearButton.classList.add('hidden'); }
  }

  function setUploadState(uploading, message = '') {
    const status = qs('#imageUploadStatus'); const trigger = qs('#uploadCoverBtn'); const fileInput = qs('#gameImageFile');
    if (status) { status.textContent = message; status.classList.toggle('hidden', !message); }
    if (trigger) { trigger.disabled = uploading; trigger.textContent = uploading ? 'Enviando...' : 'Enviar capa'; }
    if (fileInput) fileInput.disabled = uploading;
  }

  function resetGameForm() {
    const form = qs('#gameForm'); const container = qs('#trophiesContainer');
    if (!form || !container) return;
    form.reset();
    if (qs('#gameId')) qs('#gameId').value = '';
    if (qs('#gameFormTitle')) qs('#gameFormTitle').textContent = 'Adicionar novo jogo';
    if (qs('#gameSubmitBtn')) qs('#gameSubmitBtn').textContent = 'Salvar jogo';
    if (qs('#rawTrophiesInput')) qs('#rawTrophiesInput').value = '';
    if (qs('#gameImageFile')) qs('#gameImageFile').value = '';
    setImagePreview(''); setUploadState(false, '');
    container.innerHTML = '<h4 class="font-bold mb-2">Troféus</h4>' + createTrophyInputBlock();
  }

  function appendTrophyInput(values = {}) {
    const container = qs('#trophiesContainer'); if (container) container.insertAdjacentHTML('beforeend', createTrophyInputBlock(values));
  }

  function replaceTrophyInputs(trophies = []) {
    const container = qs('#trophiesContainer');
    if (!container) return;
    container.innerHTML = '<h4 class="font-bold mb-2">Troféus</h4>';
    trophies.forEach(trophy => appendTrophyInput(trophy));
    if (!trophies.length) appendTrophyInput();
  }

  function fillGameForm(game) {
    if (!qs('#gameForm')) return;
    qs('#gameId').value = String(game.id);
    qs('#gameName').value = game.name;
    qs('#gameDifficulty').value = game.difficulty;
    qs('#gameTime').value = game.time;
    qs('#gameMissable').value = game.missable;
    qs('#gameRoadmap').value = game.roadmap.join('\n');
    qs('#gameFormTitle').textContent = `Editar ${game.name}`;
    qs('#gameSubmitBtn').textContent = 'Atualizar jogo';
    if (qs('#rawTrophiesInput')) qs('#rawTrophiesInput').value = '';
    if (qs('#gameImageFile')) qs('#gameImageFile').value = '';
    setImagePreview(game.image || '');
    setUploadState(false, game.image ? 'Capa pronta para uso.' : '');
    replaceTrophyInputs(game.trophies);
  }

  function toggleGameForm(force) {
    const form = qs('#adminGameFormPanel'); if (!form) return;
    const shouldOpen = typeof force === 'boolean' ? force : form.classList.contains('hidden');
    form.classList.toggle('hidden', !shouldOpen);
  }

  function renderAdminSummary(summary = { totalGames: 0, totalTrophies: 0 }) {
    const cards = qs('#adminSummaryCards'); if (!cards) return;
    cards.innerHTML = `<div class="glass-morphism p-5 rounded-[20px]"><div class="text-xs uppercase tracking-wide text-slate-400 mb-2">Jogos cadastrados</div><div class="text-3xl font-extrabold text-atlas-400">${summary.totalGames}</div></div><div class="glass-morphism p-5 rounded-[20px]"><div class="text-xs uppercase tracking-wide text-slate-400 mb-2">Troféus cadastrados</div><div class="text-3xl font-extrabold text-emerald-400">${summary.totalTrophies}</div></div>`;
  }

  function renderAdminGames(response = {}) {
    const target = qs('#adminGamesList'); if (!target) return;
    const summary = qs('#adminResultsSummary');
    const items = Array.isArray(response.items) ? response.items : [];
    const pagination = response.pagination || {};
    if (summary) summary.textContent = `${pagination.total || 0} jogo(s) encontrados nesta página administrativa.`;
    if (!items.length) {
      target.innerHTML = '<div class="glass-morphism p-6 rounded-[20px] text-slate-400">Nenhum jogo encontrado para esse filtro.</div>';
      renderPagination('#adminPagination', pagination, { mode: 'admin', itemLabel: 'jogos' });
      return;
    }
    target.innerHTML = items.map(game => `
      <div class="glass-morphism p-5 rounded-[20px] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="flex gap-4 items-center"><div class="w-20 h-20 rounded-[20px] overflow-hidden bg-slate-900 shrink-0">${buildImageAttrs(game.image, game.name, 'w-full h-full object-cover', { width: 160, height: 160, sizes: '80px' })}</div><div><div class="flex items-center gap-3 flex-wrap"><h3 class="text-lg font-bold">${escapeHtml(game.name)}</h3><span class="text-xs px-2 py-1 rounded-full bg-[#111922] text-slate-300">${game.difficulty}/10</span></div><div class="text-sm text-slate-400 mt-2">${escapeHtml(game.time)}</div></div></div>
        <div class="flex gap-2 flex-wrap"><button type="button" class="px-4 py-2 rounded-xl bg-[#111922] hover:bg-slate-700" data-admin-edit="${game.id}">Editar</button><button type="button" class="px-4 py-2 rounded-xl bg-[#111922] hover:bg-slate-700" data-admin-preview="${game.id}">Prévia</button><button type="button" class="px-4 py-2 rounded-xl bg-atlas-600 hover:bg-atlas-500" data-admin-duplicate="${game.id}">Duplicar</button><button type="button" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500" data-admin-delete="${game.id}" data-admin-name="${escapeHtml(game.name)}">Excluir</button></div>
      </div>`).join('');
    renderPagination('#adminPagination', pagination, { mode: 'admin', itemLabel: 'jogos' });
  }


  function setPageMeta(game = null) {
    const title = game
      ? `${game.name} | Troféus, roadmap e guia | AtlasAchievement`
      : 'AtlasAchievement - Troféus, conquistas e guias de jogos';
    const description = game
      ? `${game.name}: dificuldade ${game.difficulty}/10, tempo ${game.time}, ${game.trophies?.length || 0} troféus e guia com roadmap e alertas de perdíveis.`
      : 'Busque jogos, abra guias, veja troféus, roadmap, perdíveis e acompanhe seu progresso.';
    const canonical = game?.slug ? `${window.location.origin}/jogo/${game.slug}` : `${window.location.origin}/`;
    const image = !game?.image
      ? `${window.location.origin}/og-default.svg`
      : /^https?:\/\//i.test(game.image)
        ? game.image
        : `${window.location.origin}${game.image}`;
    const structuredData = game
      ? { '@context': 'https://schema.org', '@type': 'VideoGame', name: game.name, image, description, url: canonical }
      : { '@context': 'https://schema.org', '@type': 'WebSite', name: 'AtlasAchievement', description, url: canonical };

    document.title = title;

    const ensureMeta = (selector, attr, value) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const [key, keyValue] = selector.includes('property=') ? ['property', selector.match(/property="([^"]+)"/)?.[1]] : ['name', selector.match(/name="([^"]+)"/)?.[1]];
        if (keyValue) el.setAttribute(key, keyValue);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonical);

    ensureMeta('meta[name="description"]', 'content', description);
    ensureMeta('meta[property="og:title"]', 'content', title);
    ensureMeta('meta[property="og:description"]', 'content', description);
    ensureMeta('meta[property="og:type"]', 'content', game ? 'article' : 'website');
    ensureMeta('meta[property="og:url"]', 'content', canonical);
    ensureMeta('meta[property="og:image"]', 'content', image);
    ensureMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    ensureMeta('meta[name="twitter:title"]', 'content', title);
    ensureMeta('meta[name="twitter:description"]', 'content', description);
    ensureMeta('meta[name="twitter:image"]', 'content', image);

    let jsonLd = document.getElementById('gameStructuredData');
    if (!jsonLd) {
      jsonLd = document.createElement('script');
      jsonLd.type = 'application/ld+json';
      jsonLd.id = 'gameStructuredData';
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = JSON.stringify(structuredData);
  }

  function setAdminState(session) {
    const authenticated = Boolean(session?.authenticated);
    ['#adminLogoutBtn', '#adminStatus', '#adminPanelLink'].forEach(sel => setClass(sel, 'hidden', !authenticated));
    setClass('#adminAccessBtn', 'hidden', authenticated);
    const status = qs('#adminStatus'); if (status) status.textContent = authenticated ? `Administrador: ${session.username}` : '';
    if (!authenticated) { toggleGameForm(false); togglePasswordPanel(false); togglePreviewPanel(false); }
  }

  function openAdminModal() { const modal = qs('#adminModal'); if (modal) modal.classList.remove('hidden'); if (qs('#adminUsername')) qs('#adminUsername').focus(); }
  function closeAdminModal() { const modal = qs('#adminModal'); if (modal) modal.classList.add('hidden'); if (qs('#adminLoginForm')) qs('#adminLoginForm').reset(); }
  function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
  function escapeAttribute(value) { return escapeHtml(value); }

  function getDifficultyProfileLabel(difficulty) {
    const value = Number(difficulty || 0);
    if (value >= 9) return 'Brutal';
    if (value >= 7) return 'Exigente';
    if (value >= 4) return 'Intermediária';
    if (value >= 1) return 'Acessível';
    return 'Não avaliada';
  }

  function getTrophyBreakdown(trophies = []) {
    return ['Platina', 'Ouro', 'Prata', 'Bronze'].map(type => ({
      type,
      count: trophies.filter(trophy => String(trophy?.type || '').toLowerCase() === type.toLowerCase()).length
    }));
  }

  function buildGuideViewModel(game, completedSource = [], options = {}) {
    const trophies = Array.isArray(game?.trophies) ? game.trophies : [];
    const roadmap = Array.isArray(game?.roadmap) ? game.roadmap : [];
    const completedIds = new Set(Array.isArray(completedSource) ? completedSource : []);
    const completed = trophies.filter(trophy => completedIds.has(trophy.id)).length;
    const total = trophies.length;
    const progress = total ? Math.round((completed / total) * 100) : 0;
    const pending = Math.max(total - completed, 0);
    const missables = trophies.filter(trophy => trophy && (trophy.is_missable || trophy.is_spoiler)).length;
    const spoilerCount = trophies.filter(trophy => trophy?.is_spoiler).length;
    const breakdown = getTrophyBreakdown(trophies);
    const breakdownText = breakdown.filter(item => item.count > 0).map(item => `${item.count} ${item.type}`).join(' • ') || 'Sem troféus detalhados';
    const quickNotes = [
      game?.missable ? game.missable : 'Revise os alertas editoriais antes de iniciar a campanha.',
      roadmap.length ? `Siga ${roadmap.length} etapa(s) do roadmap para evitar retrabalho e organizar a platina.` : 'Monte uma ordem de execução antes de sair marcando troféus soltos.',
      spoilerCount ? `${spoilerCount} troféu(s) têm spoiler e pedem leitura com cautela.` : 'Os troféus visíveis podem ser revisados sem grandes spoilers.'
    ].filter(Boolean);
    const prepChecklist = [
      missables ? `Leia com atenção o bloco de perdíveis: há ${missables} alerta(s) que pedem atenção antes de avançar.` : 'Não há alerta forte de perdível marcado neste guia, então você pode seguir com mais liberdade.',
      total ? `A lista tem ${total} troféu(s), com distribuição ${breakdownText}.` : 'Ainda não há troféus cadastrados para este jogo.',
      roadmap.length ? `O roadmap já está quebrado em ${roadmap.length} etapa(s), útil para sessões curtas.` : 'O guia ainda precisa de um roadmap mais detalhado para orientar melhor a ordem da platina.'
    ];
    const spotlightTrophies = trophies
      .filter(trophy => trophy?.is_spoiler || /perd|miss|colet|online|grind|dific/i.test(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`))
      .slice(0, 3)
      .map(trophy => ({
        name: trophy?.name || 'Troféu',
        label: trophy?.is_spoiler ? 'Spoiler / atenção' : (trophy?.type || 'Troféu'),
        text: trophy?.tip || trophy?.description || 'Revise este troféu antes de começar.'
      }));

    return {
      trophies,
      roadmap,
      completedIds,
      completed,
      total,
      progress,
      pending,
      missables,
      spoilerCount,
      breakdownText,
      quickNotes,
      prepChecklist,
      spotlightTrophies,
      difficultyLabel: getDifficultyProfileLabel(game?.difficulty),
      image: getGameImageSrc(game?.image),
      isSaved: Boolean(options?.isSaved),
      libraryEntry: options?.libraryEntry || null
    };
  }


  function renderGuide(game, state = {}) {
    const headerEl = qs('#guideHeader');
    const sidebarEl = qs('#sidebarInfo');
    const trophiesEl = qs('#trophyList') || qs('#trophiesList') || qs('#guideTrophies');
    const isSaved = Boolean(state?.isSaved);
    const libraryEntry = state?.libraryEntry || null;
    const completedSource = Array.isArray(state)
      ? state
      : Array.isArray(state?.completedTrophies)
        ? state.completedTrophies
        : (Array.isArray(game?.completed) ? game.completed : []);
    const viewModel = buildGuideViewModel(game, completedSource, { isSaved, libraryEntry });

    if (headerEl) {
      headerEl.innerHTML = `
        <section class="atlas-panel p-5 md:p-6 bg-white/[0.03] border border-white/10">
          <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
            <div class="flex gap-4 items-start min-w-0">
              <div class="atlas-guide-cover shrink-0">
                ${buildImageAttrs(viewModel.image, game?.name || 'Jogo', 'w-full h-full object-cover', { width: 900, height: 520, fetchpriority: 'high', loading: 'eager', decoding: 'sync', sizes: '(min-width: 1280px) 240px, 160px' })}
              </div>
              <div class="min-w-0">
                <div class="atlas-eyebrow">Guia do jogo</div>
                <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight mt-2 break-words">${escapeHtml(game?.name || 'Guia')}</h1>
                <p class="text-white/58 mt-3 max-w-3xl">Dificuldade ${escapeHtml(String(game?.difficulty || '-'))}/10 • ${escapeHtml(game?.time || 'Tempo não informado')} • ${viewModel.total} troféu(s)</p>
                <div class="flex flex-wrap gap-2 mt-4">
                  <span class="atlas-tag">Perfil ${escapeHtml(viewModel.difficultyLabel)}</span>
                  <span class="atlas-tag">${escapeHtml(game?.time || 'Tempo não informado')}</span>
                  <span class="atlas-tag">${viewModel.missables ? `${viewModel.missables} alerta(s)` : 'Sem alerta crítico marcado'}</span>
                  <span class="atlas-tag">${escapeHtml(viewModel.breakdownText)}</span>
                </div>
                <p class="text-white/50 mt-4 max-w-3xl">${escapeHtml(game?.missable || 'Sem alerta editorial de perdíveis informado.')}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-3 xl:justify-end">
              <button type="button" class="atlas-btn ${isSaved ? 'atlas-btn-secondary' : 'atlas-btn-primary'}" data-toggle-save-game="true">${isSaved ? 'Remover da biblioteca' : 'Salvar na biblioteca'}</button>
              <button type="button" class="atlas-btn atlas-btn-secondary" data-copy-game-link="${escapeAttribute(game?.slug || '')}">Copiar link</button>
            </div>
          </div>
          <div class="grid lg:grid-cols-3 gap-3 mt-5">
            ${viewModel.quickNotes.map((note, index) => `<article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Leitura ${index + 1}</div><p class="text-sm text-white/78 mt-2">${escapeHtml(note)}</p></article>`).join('')}
          </div>
        </section>`;
    }

    if (sidebarEl) {
      sidebarEl.innerHTML = `
        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="atlas-eyebrow">Resumo</div>
            <div class="text-xs text-white/45">${escapeHtml(isSaved ? `Na biblioteca • ${getLibraryStatusLabel(libraryEntry?.status, viewModel.progress)}` : 'Ainda não salvo')}</div>
          </div>
          <div class="atlas-guide-summary-grid">
            <article class="glass-morphism atlas-stat-mini p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Progresso</div><div class="text-3xl font-extrabold mt-2">${viewModel.progress}%</div></article>
            <article class="glass-morphism atlas-stat-mini p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Concluídos</div><div class="text-3xl font-extrabold mt-2">${viewModel.completed}/${viewModel.total}</div></article>
            <article class="glass-morphism atlas-stat-mini p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Pendentes</div><div class="text-3xl font-extrabold mt-2">${viewModel.pending}</div></article>
            <article class="glass-morphism atlas-stat-mini p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Spoilers</div><div class="text-3xl font-extrabold mt-2">${viewModel.spoilerCount}</div></article>
          </div>
        </section>
        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Antes de começar</div>
          <ul class="space-y-3 text-sm text-white/72">
            ${viewModel.prepChecklist.map(item => `<li class="flex items-start gap-3"><span class="atlas-tag mt-0.5">•</span><span>${escapeHtml(item)}</span></li>`).join('')}
          </ul>
        </section>
        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Roadmap</div>
          ${viewModel.roadmap.length ? `<ol class="space-y-3 text-white/72">${viewModel.roadmap.map((step, index) => `<li class="flex items-start gap-3"><span class="atlas-tag mt-0.5">${index + 1}</span><span>${escapeHtml(typeof step === 'string' ? step : (step?.title || step?.description || 'Etapa'))}</span></li>`).join('')}</ol>` : '<div class="text-white/45">Sem roadmap cadastrado.</div>'}
        </section>
        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Destaques da lista</div>
          ${viewModel.spotlightTrophies.length ? `<div class="space-y-3">${viewModel.spotlightTrophies.map(item => `<article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">${escapeHtml(item.label)}</div><h3 class="text-sm font-semibold text-white mt-2">${escapeHtml(item.name)}</h3><p class="text-sm text-white/68 mt-2">${escapeHtml(item.text)}</p></article>`).join('')}</div>` : '<div class="text-white/45">Nenhum troféu de atenção especial detectado automaticamente.</div>'}
        </section>
      `;
    }

    if (trophiesEl) {
      trophiesEl.innerHTML = viewModel.trophies.length
        ? viewModel.trophies.map(trophy => {
            const done = viewModel.completedIds.has(trophy.id);
            const description = trophy.description || '';
            const tip = trophy.tip || '';
            const search = `${trophy.name || ''} ${description} ${tip}`.trim().toLowerCase();
            const spoilerClasses = trophy.is_spoiler ? 'spoiler-blur' : '';
            const spoilerText = trophy.is_spoiler ? '<span class="spoiler-hint">Conteúdo oculto até você revelar.</span>' : '';
            return `
              <article class="trophy-card atlas-panel rounded-[24px] p-5 bg-white/[0.03] border border-white/10 ${done ? 'completed' : ''}" data-trophy-id="${escapeAttribute(trophy.id || '')}" data-type="${escapeAttribute(trophy.type || 'Bronze')}" data-status="${done ? 'completed' : 'pending'}" data-search="${escapeAttribute(search)}">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2 mb-3">
                      <span class="atlas-tag">${escapeHtml(trophy.type || 'Bronze')}</span>
                      ${trophy.is_spoiler ? '<span class="atlas-tag">Spoiler</span>' : ''}
                      ${done ? '<span class="atlas-tag">Concluído</span>' : '<span class="atlas-tag">Pendente</span>'}
                    </div>
                    <h4 class="text-xl font-bold text-white">${escapeHtml(trophy.name || 'Troféu')}</h4>
                    ${trophy.is_spoiler ? '<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact mt-3" data-spoiler-toggle="true" aria-expanded="false">Revelar spoiler</button>' : ''}
                    <p class="text-sm text-white/80 mt-2 ${spoilerClasses}" ${trophy.is_spoiler ? 'data-spoiler="true" aria-hidden="true"' : ''}>${spoilerText}${escapeHtml(description || 'Sem descrição.')}</p>
                    ${tip ? `<div class="atlas-tip-box mt-4"><div class="text-xs uppercase tracking-wide text-cyan-200/85">Dica</div><p class="text-sm text-cyan-50/92 mt-2 ${spoilerClasses}" ${trophy.is_spoiler ? 'data-spoiler="true" aria-hidden="true"' : ''}>${trophy.is_spoiler ? '<span class="spoiler-hint">Dica oculta até você revelar.</span>' : ''}${escapeHtml(tip)}</p></div>` : ''}
                  </div>
                  <div class="md:w-auto shrink-0 self-start">
                    <button type="button" class="atlas-btn ${done ? 'atlas-btn-secondary' : 'atlas-btn-primary'}" data-trophy-toggle="${escapeAttribute(trophy.id || '')}" aria-pressed="${done ? 'true' : 'false'}">${done ? 'Desmarcar' : 'Marcar como concluído'}</button>
                  </div>
                </div>
              </article>
            `;
          }).join('')
        : '<div class="text-white/60">Nenhum troféu cadastrado.</div>';
    }

    const progressLabel = qs('#progressPercent');
    const counterLabel = qs('#guideCounter');
    if (progressLabel) progressLabel.textContent = `${viewModel.progress}%`;
    if (counterLabel) counterLabel.textContent = `${viewModel.completed}/${viewModel.total} concluídos`;
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

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressLabel) progressLabel.textContent = `${progress}%`;
    if (completedLabel) completedLabel.textContent = String(completed);
    if (remainingLabel) remainingLabel.textContent = String(Math.max(total - completed, 0));

    return { total, completed, progress };
  }


  return { qs, qsa, has, showToast, setLoading, updateLibraryBadge, showView, setSearchFeedback, renderSuggestions, hideSuggestions, renderHomeOverview, renderCatalog, renderLibrary, renderGuide, updateProgress, applyTrophyFilter, setGuideEmptyState, clearTrophySearch, bindGuideSearch, getTrophySearchValue, resetGameForm, appendTrophyInput, replaceTrophyInputs, fillGameForm, toggleGameForm, togglePasswordPanel, togglePreviewPanel, setAdminFormFeedback, renderAdminPreview, renderAdminSummary, renderAdminGames, renderPagination, setPageMeta, setCatalogMeta, setAdminState, openAdminModal, closeAdminModal, setImagePreview, setUploadState };
})();
