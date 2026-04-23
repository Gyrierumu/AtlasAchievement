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
    const featuredTarget = qs('#featuredNowOverview');
    const trustTarget = qs('#editorialTrustOverview');
    const intentTarget = qs('#intentOverview');
    const collectionRoutesTarget = qs('#collectionRoutesOverview');
    const totalGamesTarget = qs('#homeStatGames');
    const totalTrophiesTarget = qs('#homeStatTrophies');
    const recentTargetStat = qs('#homeStatRecent');

    const getTotal = game => Number(game.trophy_count || game.trophies?.length || 0);
    const byRecent = [...games].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const byUpdated = [...games].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    const mostRelevant = [...games].sort((a, b) => getTotal(b) - getTotal(a)).slice(0, 4);
    const totalTrophies = games.reduce((sum, game) => sum + getTotal(game), 0);
    const recentCount = byRecent.slice(0, 3).length;
    const totalRoadmapSteps = games.reduce((sum, game) => sum + Number(game.roadmap_count || game.roadmap?.length || 0), 0);
    const guidesWithRoadmap = games.filter(game => Number(game.roadmap_count || game.roadmap?.length || 0) > 0).length;
    const spoilerTracked = games.filter(game => Array.isArray(game.trophies) && game.trophies.some(trophy => trophy?.is_spoiler)).length;
    const longGuides = games.filter(game => getTotal(game) >= 25).length;


    if (trustTarget) {
      trustTarget.innerHTML = [
        {
          icon: 'fa-list-check',
          title: `${guidesWithRoadmap} ${guidesWithRoadmap === 1 ? 'guia com roadmap' : 'guias com roadmap'}`,
          text: totalRoadmapSteps ? `${totalRoadmapSteps} etapa(s) editoriais distribuídas no catálogo atual.` : 'Os próximos jogos publicados devem ganhar roadmap para ficar mais confiáveis.'
        },
        {
          icon: 'fa-eye-slash',
          title: `${spoilerTracked} ${spoilerTracked === 1 ? 'guia com spoiler sinalizado' : 'guias com spoilers sinalizados'}`,
          text: spoilerTracked ? 'Os jogos com spoiler marcado podem ser consultados com mais cautela antes de avançar.' : 'Ainda faltam marcações explícitas de spoiler no catálogo atual.'
        },
        {
          icon: 'fa-trophy',
          title: `${longGuides} ${longGuides === 1 ? 'lista mais densa' : 'listas mais densas'}`,
          text: longGuides ? 'Esses jogos já têm volume suficiente para demonstrar profundidade de checklist e descoberta.' : 'O catálogo ainda precisa de listas mais longas para aumentar o valor percebido.'
        },
        {
          icon: 'fa-clock-rotate-left',
          title: `${recentCount} ${recentCount === 1 ? 'guia recente em destaque' : 'guias recentes em destaque'}`,
          text: recentCount ? 'A home já puxa os jogos mais novos para ajudar quem chega a encontrar algo útil rápido.' : 'Ainda faltam guias recentes suficientes para sustentar descoberta contínua.'
        }
      ].map(item => `
        <article class="atlas-kpi-card">
          <i class="fas ${item.icon}"></i>
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.text)}</span>
        </article>`).join('');
    }

    if (totalGamesTarget) totalGamesTarget.textContent = `${games.length} ${games.length === 1 ? 'jogo' : 'jogos'}`;
    if (totalTrophiesTarget) totalTrophiesTarget.textContent = `${totalTrophies} ${totalTrophies === 1 ? 'troféu' : 'troféus'}`;
    if (recentTargetStat) recentTargetStat.textContent = `${recentCount} ${recentCount === 1 ? 'guia recente' : 'guias recentes'}`;

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
      target.innerHTML = items.slice(0, 5).map(game => {
        const updatedLabel = game.updated_at ? formatRelativeDate(game.updated_at) : 'agora';
        return `
        <a href="/jogo/${escapeAttribute(game.slug)}" class="atlas-feature-panel justify-between gap-4" data-home-game="${escapeAttribute(game.name)}">
          <div>
            <strong>${escapeHtml(game.name)}</strong>
            <span>${getTotal(game)} troféus • Roadmap ${game.roadmap_count || 0} etapa(s)</span>
            <span class="text-white/40">Última revisão ${escapeHtml(updatedLabel)}</span>
          </div>
          <span class="atlas-tag shrink-0">${label}</span>
        </a>`;
      }).join('');
    };


    if (featuredTarget) {
      if (!games.length) {
        featuredTarget.innerHTML = '<div class="sm:col-span-2 atlas-feature-panel"><i class="fas fa-compass"></i><div><strong>Catálogo em expansão</strong><span>Assim que mais guias forem publicados, esta área passa a sugerir os melhores primeiros cliques.</span></div></div>';
      } else {
        featuredTarget.innerHTML = mostRelevant.map(game => {
          const roadmapCount = Number(game.roadmap_count || game.roadmap?.length || 0);
          const updatedLabel = game.updated_at ? formatRelativeDate(game.updated_at) : 'sem revisão recente';
          return `
          <a href="/jogo/${escapeAttribute(game.slug)}" class="atlas-feature-panel" data-home-game="${escapeAttribute(game.name)}">
            <i class="fas fa-trophy"></i>
            <div>
              <strong>${escapeHtml(game.name)}</strong>
              <span>${getTotal(game)} troféus • dificuldade ${escapeHtml(String(game.difficulty || '-'))}/10 • ${roadmapCount} etapa(s)</span>
              <span class="text-white/40">Revisado ${escapeHtml(updatedLabel)}</span>
            </div>
          </a>`;
        }).join('');
      }
    }

    if (intentTarget) {
      const intentConfigs = [
        {
          facet: 'time-short',
          icon: 'fa-bolt',
          tag: 'Entrada rápida',
          title: 'Quero algo curto',
          description: 'Veja jogos com tempo menor para terminar uma platina sem arrastar por semanas.',
          metric: `${games.filter(game => getTimeValue(game) <= 15).length} opção(ões) no catálogo atual`
        },
        {
          facet: 'difficulty-low',
          icon: 'fa-seedling',
          tag: 'Baixo atrito',
          title: 'Quero algo mais fácil',
          description: 'Filtre jogos de dificuldade mais baixa para começar sem tanta pressão.',
          metric: `${games.filter(game => Number(game.difficulty || 0) <= 3).length} opção(ões) acessíveis agora`
        },
        {
          facet: 'time-medium',
          icon: 'fa-layer-group',
          tag: 'Projeto médio',
          title: 'Quero um projeto equilibrado',
          description: 'Entre em jogos de 16 a 40 horas para algo mais completo sem virar maratona infinita.',
          metric: `${games.filter(game => { const value = getTimeValue(game); return value > 15 && value <= 40; }).length} opção(ões) intermediárias`
        },
        {
          facet: 'trophies-large',
          icon: 'fa-list-check',
          tag: 'Checklist denso',
          title: 'Quero um guia mais encorpado',
          description: 'Encontre listas maiores para quem prefere acompanhar progresso com mais profundidade.',
          metric: `${games.filter(game => getTotal(game) > 60).length} lista(s) mais densas`
        }
      ];

      intentTarget.innerHTML = intentConfigs.map(item => `
        <button type="button" class="atlas-intent-card" data-home-facet="${item.facet}">
          <div class="atlas-intent-card__head">
            <span class="atlas-tag">${item.tag}</span>
            <i class="fas ${item.icon}"></i>
          </div>
          <strong>${item.title}</strong>
          <p>${item.description}</p>
          <span class="atlas-intent-card__meta">${item.metric}</span>
        </button>`).join('');
    }


    if (collectionRoutesTarget) {
      const collectionCards = [
        { facet: 'difficulty-low', icon: 'fa-seedling', tag: 'Começo simples', title: 'Jogos de dificuldade baixa', text: 'Uma porta de entrada melhor para primeiras platinas e sessões com menos atrito.', metric: `${games.filter(game => Number(game.difficulty || 0) <= 3).length} jogo(s) nesta faixa` },
        { facet: 'time-short', icon: 'fa-bolt', tag: 'Rápidos de validar', title: 'Jogos até 15 horas', text: 'Boa faixa para retorno rápido e menos risco de se perder em projetos longos.', metric: `${games.filter(game => getTimeValue(game) <= 15).length} jogo(s) curtos agora` },
        { facet: 'time-medium', icon: 'fa-layer-group', tag: 'Projetos médios', title: 'Jogos de 16 a 40 horas', text: 'Faixa equilibrada para manter tração sem virar maratona infinita.', metric: `${games.filter(game => { const v = getTimeValue(game); return v > 15 && v <= 40; }).length} jogo(s) intermediários` },
        { facet: 'difficulty-high', icon: 'fa-mountain', tag: 'Desafio real', title: 'Jogos de dificuldade alta', text: 'Coleção pensada para quem quer projetos exigentes e mais seletivos na escolha.', metric: `${games.filter(game => Number(game.difficulty || 0) >= 7).length} jogo(s) exigentes` },
        { facet: 'trophies-large', icon: 'fa-list-check', tag: 'Checklist denso', title: 'Jogos com mais de 60 troféus', text: 'As listas mais encorpadas do catálogo para quem gosta de profundidade e acompanhamento.', metric: `${games.filter(game => getTotal(game) > 60).length} lista(s) densas` },
        { facet: 'trophies-small', icon: 'fa-feather-pointed', tag: 'Lista leve', title: 'Jogos com até 30 troféus', text: 'Boa faixa para checklists menores e navegação mais leve.', metric: `${games.filter(game => getTotal(game) > 0 && getTotal(game) <= 30).length} lista(s) enxutas` }
      ];

      collectionRoutesTarget.innerHTML = collectionCards.map(item => `
        <a href="${escapeAttribute(catalogFacetMeta[item.facet].path)}" class="atlas-intent-card atlas-intent-card--link" data-home-facet="${item.facet}">
          <div class="atlas-intent-card__head">
            <span class="atlas-tag">${escapeHtml(item.tag)}</span>
            <i class="fas ${item.icon}"></i>
          </div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.text)}</p>
          <span class="atlas-intent-card__meta">${escapeHtml(item.metric)}</span>
        </a>`).join('');
    }

    renderCompactList(recentTarget, byRecent, 'Nenhum jogo recente disponível.', 'Novo');
    renderCompactList(updatedTarget, byUpdated, 'Nenhuma atualização recente disponível.', 'Atualizado');

    if (resumeTarget) {
      const libraryGames = Object.values(library)
        .map(game => ({
          ...game,
          ...getLibraryMeta(game),
          completed: Array.isArray(game.completed) ? game.completed : []
        }))
        .sort((a, b) => b.momentumScore - a.momentumScore || b.percent - a.percent || a.remaining - b.remaining);
      if (!libraryGames.length) {
        resumeTarget.innerHTML = `
          <div class="atlas-feature-panel">
            <i class="fas fa-bookmark"></i>
            <div><strong>Nenhum jogo salvo ainda</strong><span>Salve manualmente seus jogos favoritos e continue de onde parou.</span></div>
          </div>`;
      } else {
        resumeTarget.innerHTML = libraryGames.slice(0, 3).map(game => {
          return `
            <button type="button" class="w-full atlas-feature-panel text-left atlas-feature-panel--stack" data-home-game="${escapeAttribute(game.name)}">
              <i class="fas fa-play-circle"></i>
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <strong>${escapeHtml(game.name)}</strong>
                  <span class="atlas-tag atlas-tag--${escapeAttribute(game.momentumTone)}">${escapeHtml(game.momentumLabel)}</span>
                </div>
                <span>${game.completedCount}/${game.total} troféus concluídos • ${game.percent}% completo • faltam ${game.remaining}</span>
                <span class="text-white/45">${escapeHtml(game.progressState.title)} — ${escapeHtml(game.nextActionModel.cta)}</span>
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
      name: 'Catálogo de jogos',
      heroTitle: 'Navegue sem depender da busca',
      heroDescription: 'Veja todos os jogos em uma lista filtrável com dificuldade, tempo estimado, troféus e acesso direto à página de guia.',
      collectionTitle: 'Catálogo completo',
      collectionDescription: 'Use a visão geral para comparar jogos por dificuldade, tempo e densidade de checklist antes de decidir onde investir seu tempo.',
      reason: 'Boa para quem ainda não sabe o que jogar e quer sentir o tamanho real do catálogo.',
      checklist: 'Ordene por recomendação, abra um destaque e valide roadmap, perdíveis e esforço total.',
      related: ['difficulty-low', 'time-short', 'trophies-large']
    },
    'difficulty-low': {
      path: '/catalogo/dificuldade-baixa',
      title: 'Jogos de dificuldade baixa | AtlasAchievement',
      description: 'Veja jogos com dificuldade de 1 a 3 para começar listas de troféus e concluir mais rápido.',
      name: 'Jogos de dificuldade baixa',
      heroTitle: 'Coleção para começar com menos atrito',
      heroDescription: 'Abra jogos de dificuldade baixa quando quiser uma platina mais viável, com menos risco de travar logo no começo.',
      collectionTitle: 'Jogos de dificuldade baixa',
      collectionDescription: 'Esta faixa funciona bem para primeiras platinas, descansos entre projetos maiores e sessões em que você quer avançar sem pressão excessiva.',
      reason: 'Filtra jogos que tendem a exigir menos execução avançada e deixam a leitura do guia mais direta.',
      checklist: 'Confira se o jogo também é curto e se já possui roadmap suficiente para virar uma entrada segura.',
      related: ['time-short', 'difficulty-mid', 'trophies-small']
    },
    'difficulty-mid': {
      path: '/catalogo/dificuldade-media',
      title: 'Jogos de dificuldade média | AtlasAchievement',
      description: 'Explore jogos com dificuldade de 4 a 6 e escolha projetos intermediários para continuar.',
      name: 'Jogos de dificuldade média',
      heroTitle: 'Projetos intermediários para continuar em bom ritmo',
      heroDescription: 'Use esta coleção quando quiser algo mais substancial do que uma platina fácil, mas sem cair direto em maratonas brutais.',
      collectionTitle: 'Jogos de dificuldade média',
      collectionDescription: 'Boa faixa para quem já está confortável com checklists, mas ainda quer equilíbrio entre progresso consistente e desafio moderado.',
      reason: 'Ajuda a separar jogos que já pedem mais atenção sem virar projetos excessivamente punitivos.',
      checklist: 'Abra a página e valide se o tempo total e o roadmap combinam com a sua disponibilidade atual.',
      related: ['difficulty-low', 'time-medium', 'trophies-medium']
    },
    'difficulty-high': {
      path: '/catalogo/dificuldade-alta',
      title: 'Jogos de dificuldade alta | AtlasAchievement',
      description: 'Encontre jogos com dificuldade de 7 a 10 para quem busca listas mais exigentes.',
      name: 'Jogos de dificuldade alta',
      heroTitle: 'Listas exigentes para quem quer desafio real',
      heroDescription: 'Entre nesta faixa quando quiser projetos mais duros, que pedem leitura cuidadosa e mais comprometimento de execução.',
      collectionTitle: 'Jogos de dificuldade alta',
      collectionDescription: 'Ideal para usuários que já sabem onde estão entrando e querem separar jogos realmente exigentes do restante do catálogo.',
      reason: 'Concentra projetos que costumam exigir mais habilidade, persistência e leitura disciplinada do guia.',
      checklist: 'Antes de começar, confirme tempo total, troféus sensíveis e se há roadmap suficiente para não desperdiçar horas.',
      related: ['time-long', 'trophies-large', 'difficulty-mid']
    },
    'time-short': {
      path: '/catalogo/ate-15-horas',
      title: 'Jogos até 15 horas | AtlasAchievement',
      description: 'Veja jogos com tempo estimado mais curto para concluir troféus em até 15 horas.',
      name: 'Jogos até 15 horas',
      heroTitle: 'Coleção de entrada rápida',
      heroDescription: 'Veja projetos mais curtos para fechar uma platina sem transformar o jogo em compromisso de várias semanas.',
      collectionTitle: 'Jogos até 15 horas',
      collectionDescription: 'Ótima faixa para fins de semana, descanso entre listas grandes e usuários que querem retorno rápido por hora investida.',
      reason: 'Reduz o risco de escolher algo que parece simples, mas vira uma maratona maior do que o esperado.',
      checklist: 'Cheque a dificuldade real e se existe algum perdível escondido antes de assumir que o jogo é só rápido.',
      related: ['difficulty-low', 'time-medium', 'trophies-small']
    },
    'time-medium': {
      path: '/catalogo/16-a-40-horas',
      title: 'Jogos de 16 a 40 horas | AtlasAchievement',
      description: 'Encontre jogos com tempo estimado de 16 a 40 horas para projetos de médio prazo.',
      name: 'Jogos de 16 a 40 horas',
      heroTitle: 'Projetos médios para manter tração',
      heroDescription: 'Abra esta faixa quando quiser algo mais completo, mas ainda compatível com uma rotina normal de sessões.',
      collectionTitle: 'Jogos de 16 a 40 horas',
      collectionDescription: 'Aqui ficam projetos equilibrados para quem quer uma trilha mais longa, sem cair nos extremos do catálogo.',
      reason: 'Ajuda a encontrar jogos que rendem progresso contínuo e ainda cabem melhor no calendário.',
      checklist: 'Compare dificuldade, roadmap e tamanho da lista para decidir qual deles encaixa melhor no seu momento.',
      related: ['difficulty-mid', 'time-short', 'time-long']
    },
    'time-long': {
      path: '/catalogo/mais-de-40-horas',
      title: 'Jogos com mais de 40 horas | AtlasAchievement',
      description: 'Navegue por jogos longos e maratonas com listas de troféus acima de 40 horas.',
      name: 'Jogos com mais de 40 horas',
      heroTitle: 'Maratonas para abrir com plena consciência',
      heroDescription: 'Veja projetos longos quando estiver procurando uma trilha mais extensa e quiser validar melhor o custo total de tempo.',
      collectionTitle: 'Jogos com mais de 40 horas',
      collectionDescription: 'Esta coleção serve para separar maratonas que pedem planejamento real, disciplina de checklist e expectativa ajustada desde o começo.',
      reason: 'Evita entrar em jogos longos sem antes comparar esforço, densidade da lista e necessidade de revisão contínua.',
      checklist: 'Abra a página e confirme quantas etapas existem no roadmap e quais troféus podem gerar retrabalho tardio.',
      related: ['difficulty-high', 'time-medium', 'trophies-large']
    },
    'trophies-small': {
      path: '/catalogo/ate-30-trofeus',
      title: 'Jogos com até 30 troféus | AtlasAchievement',
      description: 'Abra listas menores, com até 30 troféus, para organizar checklists mais curtos.',
      name: 'Jogos com até 30 troféus',
      heroTitle: 'Checklists menores para seguir com leveza',
      heroDescription: 'Explore listas curtas quando quiser menos itens para controlar e uma leitura mais rápida da página do jogo.',
      collectionTitle: 'Jogos com até 30 troféus',
      collectionDescription: 'Boa faixa para quem gosta de checklists enxutos e quer sentir progresso sem navegar por listas muito extensas.',
      reason: 'Ajuda a filtrar jogos com menos volume estrutural de troféus, úteis para sessões mais leves.',
      checklist: 'Mesmo com lista pequena, confirme se há roadmap e troféus sensíveis antes de começar despreocupado.',
      related: ['time-short', 'difficulty-low', 'trophies-medium']
    },
    'trophies-medium': {
      path: '/catalogo/31-a-60-trofeus',
      title: 'Jogos com 31 a 60 troféus | AtlasAchievement',
      description: 'Explore jogos com listas intermediárias de 31 a 60 troféus.',
      name: 'Jogos com 31 a 60 troféus',
      heroTitle: 'Volume intermediário de checklist',
      heroDescription: 'Use esta coleção quando quiser listas mais completas, mas ainda legíveis em um fluxo normal de acompanhamento.',
      collectionTitle: 'Jogos com 31 a 60 troféus',
      collectionDescription: 'Aqui ficam jogos com densidade intermediária de troféus, bons para usuários que gostam de progresso granular sem excesso.',
      reason: 'Separa projetos com mais profundidade de checklist, mas ainda sem o peso de listas muito grandes.',
      checklist: 'Compare o número de etapas do roadmap e o tempo estimado para evitar escolher só pelo tamanho da lista.',
      related: ['difficulty-mid', 'time-medium', 'trophies-large']
    },
    'trophies-large': {
      path: '/catalogo/mais-de-60-trofeus',
      title: 'Jogos com mais de 60 troféus | AtlasAchievement',
      description: 'Veja jogos com listas longas, acima de 60 troféus, para acompanhar por etapas.',
      name: 'Jogos com mais de 60 troféus',
      heroTitle: 'Listas densas para quem gosta de profundidade',
      heroDescription: 'Abra esta faixa quando quiser jogos com muitos troféus e sensação forte de progresso ao longo de várias sessões.',
      collectionTitle: 'Jogos com mais de 60 troféus',
      collectionDescription: 'Essa coleção funciona como vitrine das listas mais densas do catálogo, boas para quem valoriza acompanhamento detalhado.',
      reason: 'Ajuda a encontrar jogos em que o checklist é parte central da experiência, não só um complemento.',
      checklist: 'Antes de entrar, valide tempo total, risco de retrabalho e se o roadmap já está forte o suficiente para sustentar a maratona.',
      related: ['time-long', 'difficulty-high', 'trophies-medium']
    }
  };

  function parseTimeValue(value = '') {
    const normalized = String(value).toLowerCase();
    const numbers = normalized.match(/\d+/g);
    if (!numbers) return Number.MAX_SAFE_INTEGER;
    const values = numbers.map(Number);
    return Math.max(...values);
  }

  function deriveNextAction(game = {}, completedIds = []) {
    const trophies = Array.isArray(game.trophies) ? game.trophies : [];
    const completedSet = new Set(Array.isArray(completedIds) ? completedIds : []);
    const total = trophies.length;
    const completedCount = completedSet.size;
    const remaining = Math.max(total - completedCount, 0);
    const started = completedCount > 0;
    const pendingTrophies = trophies.filter(trophy => trophy && !completedSet.has(trophy.id));
    const firstPending = pendingTrophies[0] || null;
    const missablePending = pendingTrophies.find(trophy => trophy && trophy.is_missable);
    const spoilerPending = pendingTrophies.find(trophy => trophy && trophy.is_spoiler);
    const roadmapCount = Array.isArray(game.roadmap) ? game.roadmap.length : Number(game.roadmap_count || 0);

    if (!total) {
      return {
        kind: 'overview',
        title: 'Revisar a estrutura do guia',
        detail: 'Este jogo ainda precisa de checklist mais completo antes de virar rotina na biblioteca.',
        cta: 'Ver resumo',
        focus: 'header',
        trophyId: '',
        trophyName: ''
      };
    }

    if (remaining === 0) {
      return {
        kind: 'review',
        title: 'Confirmar o fechamento da platina',
        detail: 'Checklist concluído. Vale revisar a página e garantir que nada importante ficou sem validação final.',
        cta: 'Revisar 100%',
        focus: 'trophies',
        trophyId: '',
        trophyName: ''
      };
    }

    if (!started && roadmapCount > 0) {
      return {
        kind: 'roadmap',
        title: 'Começar pelo roadmap',
        detail: `Use as ${roadmapCount} etapa(s) do roadmap para iniciar sem retrabalho e evitar ordem errada logo no começo.`,
        cta: 'Abrir roadmap',
        focus: 'roadmap',
        trophyId: firstPending?.id || '',
        trophyName: firstPending?.name || ''
      };
    }

    if (!started && firstPending) {
      return {
        kind: 'first-trophy',
        title: 'Marcar o primeiro troféu',
        detail: `Abra a lista e use ${firstPending.name} como ponto de partida para tirar o jogo do zero.`,
        cta: 'Ir ao primeiro troféu',
        focus: 'first-pending',
        trophyId: firstPending?.id || '',
        trophyName: firstPending.name || ''
      };
    }

    if (missablePending) {
      return {
        kind: 'missable',
        title: 'Revisar pendências sensíveis',
        detail: `Ainda existe pelo menos um objetivo crítico pendente. Priorize ${missablePending.name} antes de avançar sem checagem.`,
        cta: 'Ver pendência crítica',
        focus: 'first-pending',
        trophyId: missablePending?.id || '',
        trophyName: missablePending.name || ''
      };
    }

    if (spoilerPending) {
      return {
        kind: 'spoiler',
        title: 'Retomar a lista principal',
        detail: `Continue pelo próximo objetivo pendente, começando por ${spoilerPending.name}, com cuidado para não abrir spoiler antes da hora.`,
        cta: 'Continuar checklist',
        focus: 'first-pending',
        trophyId: spoilerPending?.id || '',
        trophyName: spoilerPending.name || ''
      };
    }

    return {
      kind: 'continue',
      title: 'Continuar os troféus pendentes',
      detail: firstPending
        ? `O próximo bom passo é voltar na lista e avançar em ${firstPending.name} para empurrar o progresso.`
        : 'Volte para a lista principal e conclua os troféus restantes em sequência.',
      cta: 'Continuar checklist',
      focus: 'first-pending',
      trophyId: firstPending?.id || '',
      trophyName: firstPending?.name || ''
    };
  }

  function getMomentumLabel(score = 0) {
    if (score >= 120) return 'Vale abrir hoje';
    if (score >= 95) return 'Quase fechando';
    if (score >= 72) return 'Bom momento';
    return 'Retomar sem pressa';
  }

  function getMomentumTone(score = 0) {
    if (score >= 120) return 'hot';
    if (score >= 95) return 'close';
    if (score >= 72) return 'warm';
    return 'soft';
  }

  function computeMomentumScore(game = {}) {
    const total = Array.isArray(game.trophies) ? game.trophies.length : Number(game.trophy_count || 0);
    const completed = Array.isArray(game.completed) ? game.completed.length : 0;
    const progress = total ? Math.round((completed / total) * 100) : 0;
    const remaining = Math.max(total - completed, 0);
    const roadmapCount = Array.isArray(game.roadmap) ? game.roadmap.length : Number(game.roadmap_count || 0);
    const updatedAt = game.lastActivityAt || game.lastOpenedAt || game.updated_at || game.savedAt || null;
    const ageHours = updatedAt ? Math.max((Date.now() - new Date(updatedAt).getTime()) / 36e5, 0) : 999;

    let score = 12;
    if (progress > 0 && progress < 100) score += 30;
    if (progress >= 70 && progress < 100) score += 24;
    if (progress >= 85 && progress < 100) score += 30;
    if (remaining > 0 && remaining <= 3) score += 30;
    else if (remaining > 0 && remaining <= 8) score += 18;
    if (roadmapCount > 0) score += 10;
    if (ageHours <= 24) score += 18;
    else if (ageHours <= 72) score += 12;
    else if (ageHours <= 168) score += 6;
    if (!progress && total > 0 && roadmapCount > 0) score += 8;
    if (progress >= 100) score = 22;
    return score;
  }

  function getProgressState(game = {}) {
    const total = Number(game.total || game.trophies?.length || 0);
    const done = Number(game.done || game.completed?.length || 0);
    const remaining = Math.max(Number(game.remaining ?? (total - done)), 0);
    const progress = total ? Math.round((done / total) * 100) : Number(game.progress || 0);

    if (total && remaining === 0) {
      return {
        title: 'Checklist fechado',
        detail: 'Tudo marcado. Só vale abrir para revisão final, conferência ou para compartilhar o link.',
        accent: 'completed'
      };
    }

    if (total && remaining <= 3 && progress >= 80) {
      return {
        title: 'Falta muito pouco',
        detail: `${remaining} troféu(s) restante(s). Este é o candidato mais forte para fechar hoje.`,
        accent: 'close'
      };
    }

    if (progress >= 45) {
      return {
        title: 'Projeto bem encaminhado',
        detail: `Você já passou da metade útil do guia. Bom momento para continuar sem perder contexto.`,
        accent: 'warm'
      };
    }

    if (progress > 0) {
      return {
        title: 'Já saiu do zero',
        detail: 'Retomar agora custa menos do que começar outro jogo do zero.',
        accent: 'soft'
      };
    }

    return {
      title: 'Pronto para começar',
      detail: 'Abra o roadmap antes da primeira sessão para entrar com direção.',
      accent: 'soft'
    };
  }

  function getLibraryMeta(game) {
    const total = game.trophies?.length || 0;
    const completed = game.completed || [];
    const completedCount = completed.length;
    const remaining = Math.max(total - completedCount, 0);
    const percent = total ? Math.round((completedCount / total) * 100) : 0;
    const started = completedCount > 0;
    const nextActionModel = deriveNextAction(game, completed);
    const momentumScore = computeMomentumScore({ ...game, total, done: completedCount, remaining, progress: percent });
    return {
      total,
      completedCount,
      remaining,
      percent,
      started,
      nextAction: nextActionModel.detail,
      nextActionModel,
      timeValue: parseTimeValue(game.time),
      missable: Boolean(game.missable),
      momentumScore,
      momentumLabel: getMomentumLabel(momentumScore),
      momentumTone: getMomentumTone(momentumScore),
      progressState: getProgressState({ ...game, total, done: completedCount, remaining, progress: percent })
    };
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
      const meta = getLibraryMeta({ ...game, trophies, completed });
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
        lastActivityAt: game.lastActivityAt || game.lastOpenedAt || game.savedAt || null,
        momentumScore: meta.momentumScore,
        momentumLabel: meta.momentumLabel,
        momentumTone: meta.momentumTone,
        progressState: meta.progressState,
        nextActionModel: meta.nextActionModel
      };
    }).filter(game => !search || String(game.name || '').toLowerCase().includes(search));

    const sorted = items.sort((a, b) => {
      if (sort === 'name' || sort === 'name-asc') return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      if (sort === 'difficulty' || sort === 'difficulty-desc') return Number(b.difficulty || 0) - Number(a.difficulty || 0);
      if (sort === 'near-100' || sort === 'remaining-asc') return a.remaining - b.remaining || b.progress - a.progress;
      if (sort === 'best-next' || sort === 'today') return b.momentumScore - a.momentumScore || a.remaining - b.remaining || b.progress - a.progress;
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
        const bestToday = [...sorted].sort((a, b) => b.momentumScore - a.momentumScore || a.remaining - b.remaining || b.progress - a.progress)[0];
        const closest = [...sorted].sort((a, b) => a.remaining - b.remaining || b.progress - a.progress)[0];
        const recentlyActive = [...sorted].sort((a, b) => new Date(b.lastActivityAt || b.lastOpenedAt || b.savedAt || 0) - new Date(a.lastActivityAt || a.lastOpenedAt || a.savedAt || 0))[0];
        const cards = [
          { label: 'Abrir hoje', game: bestToday, value: bestToday.momentumLabel, hint: bestToday.progressState.detail },
          { label: 'Mais perto de 100%', game: closest, value: `${closest.remaining}`, hint: `${closest.progress}% completo • ${closest.nextActionModel.cta}` },
          { label: 'Última sessão', game: recentlyActive, value: `${formatRelativeDate(recentlyActive.lastActivityAt || recentlyActive.lastOpenedAt || recentlyActive.savedAt)}`, hint: recentlyActive.nextActionModel.title }
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
      const nextActionModel = game.nextActionModel || deriveNextAction(game, game.completed || []);
      return `
        <article class="atlas-panel rounded-[24px] p-5 bg-white/[0.03] border border-white/10 space-y-4 atlas-library-card atlas-library-card--${escapeAttribute(game.momentumTone || 'soft')}" data-library-game="${escapeAttribute(game.slug || game.name || '')}">
          <div class="flex gap-4">
            ${buildImageAttrs(image, game.name || 'Jogo', 'w-24 h-24 rounded-2xl object-cover bg-white/5', { width: 96, height: 96, sizes: '96px' })}
            <div class="min-w-0 flex-1 space-y-2">
              <h3 class="text-lg font-semibold text-white">${escapeHtml(game.name || 'Sem nome')}</h3>
              <div class="flex flex-wrap gap-2 text-xs text-white/65">
                <span class="atlas-tag">${escapeHtml(game.statusLabel)}</span>
                <span class="atlas-tag atlas-tag--${escapeAttribute(game.momentumTone || 'soft')}">${escapeHtml(game.momentumLabel || 'Retomar')}</span>
                <span class="atlas-tag">Dificuldade ${escapeHtml(game.difficulty || '-')}</span>
                <span class="atlas-tag">${game.done}/${game.total} concluídos</span>
                ${game.missables ? `<span class="atlas-tag">Perdíveis: ${game.missables}</span>` : ''}
              </div>
              <p class="text-sm text-white/60">Progresso: ${game.progress}% · Restam ${game.remaining} troféu(s)</p>
              <p class="text-xs text-white/42">Última atividade: ${escapeHtml(formatRelativeDate(game.lastActivityAt || game.lastOpenedAt || game.savedAt))}</p>
            </div>
          </div>
          <div class="glass-morphism rounded-[18px] p-4 border border-white/10 atlas-next-action-box">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Próxima ação</div>
              <span class="atlas-tag atlas-tag--${escapeAttribute(game.progressState?.accent || 'soft')}">${escapeHtml(game.progressState?.title || 'Retomar')}</span>
            </div>
            <strong class="block text-white mt-2">${escapeHtml(nextActionModel.title)}</strong>
            <p class="text-sm text-white/68 mt-2">${escapeHtml(nextActionModel.detail)}</p>
            <p class="text-xs text-white/48 mt-3">${escapeHtml(game.progressState?.detail || '')}</p>
          </div>
          <div class="h-2 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full bg-cyan-400" style="width:${game.progress}%"></div>
          </div>
          <div class="flex flex-wrap gap-3">
            <button type="button" class="atlas-btn atlas-btn-primary" data-open-game="${escapeAttribute(game.name || '')}" data-open-slug="${slug}">${escapeHtml(nextActionModel.cta)}</button>
            <button type="button" class="atlas-btn atlas-btn-secondary" data-delete-game="${escapeAttribute(game.slug || game.name || '')}">Remover</button>
          </div>
        </article>
      `;
    }).join('');
  }


  function getRelatedCatalogFacets(facet = 'all') {
    const meta = catalogFacetMeta[facet] || catalogFacetMeta.all;
    return (meta.related || []).map(id => ({ id, ...(catalogFacetMeta[id] || {}) })).filter(item => item.id && item.path);
  }

  function updateCatalogCollectionIntro(facet = 'all', total = 0) {
    const meta = catalogFacetMeta[facet] || catalogFacetMeta.all;
    const titleTarget = qs('#catalogTitle');
    const heroTitleTarget = qs('#catalogHeroTitle');
    const heroDescriptionTarget = qs('#catalogHeroDescription');
    const collectionTitleTarget = qs('#catalogCollectionTitle');
    const collectionDescriptionTarget = qs('#catalogCollectionDescription');
    const reasonTarget = qs('#catalogCollectionReason');
    const checklistTarget = qs('#catalogCollectionChecklist');
    const relatedTarget = qs('#catalogRelatedCollections');

    if (titleTarget) titleTarget.textContent = meta.name || 'Catálogo de jogos';
    if (heroTitleTarget) heroTitleTarget.textContent = meta.heroTitle || 'Navegue sem depender da busca';
    if (heroDescriptionTarget) heroDescriptionTarget.textContent = `${meta.heroDescription || meta.description}${typeof total === 'number' ? ` ${total} jogo(s) visível(is) nesta faixa agora.` : ''}`.trim();
    if (collectionTitleTarget) collectionTitleTarget.textContent = meta.collectionTitle || meta.name || 'Coleção aberta';
    if (collectionDescriptionTarget) collectionDescriptionTarget.textContent = meta.collectionDescription || meta.description || '';
    if (reasonTarget) reasonTarget.textContent = meta.reason || 'Use esta visão para comparar esforço, tempo e densidade do guia antes de escolher um jogo.';
    if (checklistTarget) checklistTarget.textContent = meta.checklist || 'Abra a página do jogo para confirmar perdíveis, roadmap e se a lista combina com o seu momento.';

    if (relatedTarget) {
      const related = getRelatedCatalogFacets(facet);
      relatedTarget.innerHTML = related.length
        ? related.map(item => `<a href="${escapeAttribute(item.path)}" class="atlas-pill" data-catalog-facet="${escapeAttribute(item.id)}">${escapeHtml(item.name || item.collectionTitle || item.title || item.id)}</a>`).join('')
        : '<span class="text-sm text-white/45">As próximas coleções relacionadas aparecerão aqui conforme o catálogo crescer.</span>';
    }
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
    const sort = options.sort || 'recommended-desc';
    const getTotal = game => Number(game.trophy_count || game.trophies?.length || 0);
    const getTimeValue = game => parseTimeValue(game.time || '');
    const formatUpdatedLabel = value => value ? new Date(value).toLocaleDateString('pt-BR') : 'Sem data';
    const getPaceLabel = value => value <= 15 ? 'Curto para fechar' : value <= 40 ? 'Projeto médio' : 'Maratona longa';
    const getStrengthLabel = game => {
      const total = getTotal(game);
      const timeValue = getTimeValue(game);
      const roadmapCount = Number(game.roadmap_count || 0);
      const difficulty = Number(game.difficulty || 0);
      if (roadmapCount > 0 && difficulty > 0 && difficulty <= 3 && timeValue <= 15) return 'Melhor para começar';
      if (roadmapCount > 0 && timeValue <= 15) return 'Curto e direto';
      if (roadmapCount > 0 && difficulty <= 3) return 'Baixo atrito';
      if (total > 60) return 'Checklist denso';
      if (roadmapCount >= 3) return 'Guia encorpado';
      if (roadmapCount > 0) return 'Bom ponto de entrada';
      return 'Guia em crescimento';
    };
    const getAssistiveText = game => {
      const total = getTotal(game);
      const timeValue = getTimeValue(game);
      const roadmapCount = Number(game.roadmap_count || 0);
      const difficulty = Number(game.difficulty || 0);
      if (roadmapCount > 0 && difficulty <= 3 && timeValue <= 15) return 'Ótimo para primeira platina ou para descansar entre projetos maiores.';
      if (roadmapCount > 0 && timeValue <= 15) return 'Boa escolha para avançar rápido sem virar compromisso longo.';
      if (roadmapCount >= 3 && total >= 40) return 'Mais contexto editorial para quem quer abrir a página já com direção.';
      if (difficulty >= 7) return 'Melhor para quem quer desafio e já sabe onde está entrando.';
      return 'Vale abrir a página e validar roadmap, tempo e perdíveis antes de investir horas.';
    };

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
    const recommended = items.slice(0, 3);
    updateCatalogCollectionIntro(facet, Number(pagination.total || items.length || 0));

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

      const featuredStrip = recommended.length ? `
        <article class="atlas-clear-filter atlas-clear-filter--feature is-active" aria-label="Sugestões para começar">
          <i class="fas fa-wand-magic-sparkles"></i>
          <div>
            <strong>${sort === 'recommended-desc' ? 'Comece por estes jogos primeiro' : 'Sugestões rápidas da coleção atual'}</strong>
            <span>${recommended.map(game => escapeHtml(game.name)).join(' • ')} • ${Number(pagination.total || items.length || 0)} jogo(s) nesta faixa</span>
          </div>
        </article>` : '';

      segments.innerHTML = `
        ${featuredStrip}
        <button type="button" class="atlas-clear-filter ${activeFacet.id === 'all' ? 'is-active' : ''}" data-catalog-facet="all">
          <i class="fas fa-layer-group"></i>
          <div>
            <strong>${activeFacet.id === 'all' ? 'Catálogo completo ativo' : 'Voltar para todas as faixas'}</strong>
            <span>${activeFacet.id === 'all' ? 'Você está vendo todos os jogos disponíveis.' : 'Remover a faixa atual e voltar para a visão completa do catálogo.'}</span>
          </div>
        </button>
        ${segmentCards.join('')}`;
    }

    if (summary) {
      const facetLabel = activeFacet.id === 'all' ? 'sem filtro de faixa' : activeFacet.title.toLowerCase();
      const sortLabel = sort === 'recommended-desc' ? 'ordenados para ajudar você a começar mais rápido' : 'ordenados conforme o critério selecionado';
      summary.textContent = search
        ? `${pagination.total || 0} jogo(s) encontrados para “${search}”, com ${facetLabel} e ${sortLabel}.`
        : `${pagination.total || 0} jogo(s) no catálogo, com ${facetLabel} e ${sortLabel}.`;
    }

    if (!items.length) {
      list.innerHTML = `
        <div class="atlas-panel p-6 text-white/60 md:col-span-2 xl:col-span-3">
          Nenhum jogo encontrado com essa combinação de busca e faixa. Ajuste o termo digitado ou limpe o filtro.
        </div>`;
      renderPagination('#catalogPagination', pagination, { mode: 'catalog', itemLabel: 'jogos' });
      return;
    }

    list.innerHTML = items.map((game, index) => {
      const total = getTotal(game);
      const updated = formatUpdatedLabel(game.updated_at);
      const timeValue = getTimeValue(game);
      const paceLabel = getPaceLabel(timeValue);
      const roadmapCount = Number(game.roadmap_count || 0);
      const trustLabel = roadmapCount >= 3 ? 'Guia encorpado' : roadmapCount > 0 ? 'Guia em crescimento' : 'Precisa aprofundar';
      const strengthLabel = getStrengthLabel(game);
      const assistiveText = getAssistiveText(game);
      const spotlight = sort === 'recommended-desc' && index < 3 ? `<span class="atlas-catalog-spotlight"><i class="fas fa-star"></i> Destaque ${index + 1}</span>` : '';
      return `
        <a href="/jogo/${escapeAttribute(game.slug)}" class="atlas-catalog-card" data-home-game="${escapeAttribute(game.name)}">
          ${buildImageAttrs(game.image, game.name, 'atlas-catalog-card__image', { width: 900, height: 520, sizes: '(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw' })}
          <div class="atlas-catalog-card__body">
            <div class="atlas-catalog-badges">
              <span class="atlas-tag">Página do jogo</span>
              <span class="atlas-tag atlas-tag--accent">${escapeHtml(strengthLabel)}</span>
              ${spotlight}
            </div>
            <div class="flex items-start justify-between gap-3 mt-3">
              <div>
                <h3>${escapeHtml(game.name)}</h3>
                <p class="atlas-catalog-lead">${escapeHtml(assistiveText)}</p>
              </div>
              <span class="atlas-tag atlas-tag--ghost">${escapeHtml(String(game.difficulty))}/10</span>
            </div>
            <p>${total} troféus • ${escapeHtml(game.time || 'Tempo não informado')} • ${roadmapCount} etapa(s) no roadmap</p>
            <div class="atlas-catalog-meta">
              <span><i class="fas fa-gauge-high"></i> ${paceLabel}</span>
              <span><i class="fas fa-rotate"></i> Atualizado em ${updated}</span>
            </div>
            <div class="atlas-catalog-meta">
              <span><i class="fas fa-shield-halved"></i> ${trustLabel}</span>
              <span><i class="fas fa-arrow-right"></i> Abrir guia e validar perdíveis</span>
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
      description: meta.description,
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Catálogo', item: `${window.location.origin}/catalogo` },
          { '@type': 'ListItem', position: 2, name: meta.name, item: `${window.location.origin}${meta.path}` }
        ]
      }
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
    setClass('#adminAccessBtn', 'hidden', true);
    setClass('#adminAccessBtnFooter', 'hidden', authenticated);
    const status = qs('#adminStatus'); if (status) status.textContent = authenticated ? `Modo editor: ${session.username}` : '';
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


  function buildEditorialSignals(game, viewModel) {
    const total = Number(viewModel?.total || 0);
    const roadmapCount = Number(viewModel?.roadmap?.length || 0);
    const missables = Number(viewModel?.missables || 0);
    const difficulty = Number(game?.difficulty || 0);
    const reviewedAt = formatDisplayDate(game?.updated_at || game?.created_at || new Date().toISOString());

    let coverageLabel = 'Base inicial';
    let coverageDetail = 'O guia ainda precisa ganhar mais camadas para transmitir confiança total.';
    let readinessLabel = 'Leia o guia antes de começar';
    let readinessDetail = 'A página já ajuda, mas ainda vale validar cada etapa com atenção antes da primeira run.';

    if (total >= 40 && roadmapCount >= 4) {
      coverageLabel = 'Cobertura forte';
      coverageDetail = 'Há densidade suficiente de troféus e roadmap para passar sensação de guia mais completo.';
    } else if (total >= 20 && roadmapCount >= 2) {
      coverageLabel = 'Cobertura intermediária';
      coverageDetail = 'O guia já oferece direção útil, mas ainda pode ganhar mais profundidade editorial.';
    }

    if (missables === 0 && roadmapCount >= 3) {
      readinessLabel = 'Entrada mais segura';
      readinessDetail = 'A combinação de roadmap e poucos alertas reduz o risco de começar no escuro.';
    } else if (missables >= 3 || difficulty >= 7) {
      readinessLabel = 'Pede preparo real';
      readinessDetail = 'Os alertas e o nível de exigência justificam leitura disciplinada antes de jogar.';
    }

    const scopeItems = [
      `${total} troféu(s) visíveis no guia`,
      roadmapCount ? `${roadmapCount} etapa(s) no roadmap` : 'roadmap ainda enxuto',
      missables ? `${missables} alerta(s) de atenção` : 'sem alerta crítico marcado'
    ];

    const methodItems = [
      'Dificuldade, tempo e perdíveis apresentados no topo para decisão rápida.',
      roadmapCount ? 'O roadmap já organiza a ordem de progressão antes da checklist completa.' : 'A checklist existe, mas o roadmap ainda precisa de mais detalhamento.',
      missables ? 'Os alertas marcados sugerem começar com leitura cuidadosa do guia.' : 'Sem muitos alertas críticos, a entrada tende a ser mais simples.'
    ];

    return {
      reviewer: 'Equipe editorial AtlasAchievement',
      reviewedAt,
      coverageLabel,
      coverageDetail,
      readinessLabel,
      readinessDetail,
      scopeSummary: scopeItems.join(' • '),
      methodSummary: 'Dificuldade, tempo, roadmap e alertas são consolidados na própria página para reduzir retrabalho.',
      scopeItems,
      methodItems
    };
  }


  function buildPrepCards(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : [];
    const roadmapCount = Array.isArray(viewModel.roadmap) ? viewModel.roadmap.length : 0;
    const missableCount = trophies.filter(trophy => trophy && trophy.is_missable).length;
    const spoilerCount = trophies.filter(trophy => trophy && trophy.is_spoiler).length;
    const hasLongList = trophies.length >= 45;
    const timeLabel = game?.time || 'Tempo não informado';
    return [
      {
        tag: 'Leitura inicial',
        title: 'Valide o custo real antes da primeira sessão',
        text: `Este guia projeta ${timeLabel} e dificuldade ${String(game?.difficulty || '-')}/10. Abra com expectativa alinhada para não começar um projeto maior do que parece.`
      },
      {
        tag: 'Risco de retrabalho',
        title: missableCount ? `${missableCount} ponto(s) sensível(is) merecem atenção` : 'Sem perdíveis críticos explícitos',
        text: missableCount
          ? 'Há objetivos marcados como perdíveis. Leia o alerta editorial e passe pelo roadmap antes de jogar no improviso.'
          : 'Nada no cadastro atual indica bloqueio crítico, mas ainda vale verificar troféus únicos e escolhas de campanha.'
      },
      {
        tag: 'Estratégia',
        title: roadmapCount ? `Roadmap com ${roadmapCount} etapa(s) para guiar a ordem ideal` : 'Ainda sem roadmap editorial completo',
        text: roadmapCount
          ? 'Use a sequência proposta para evitar cleanup torto, runs fora de ordem e perda de contexto entre sessões.'
          : 'Nesta página, use primeiro os troféus destacados e a leitura de preparação até o roadmap ficar mais forte.'
      },
      {
        tag: 'Nível de atenção',
        title: spoilerCount ? `${spoilerCount} alerta(s) de spoiler ou contexto sensível` : (hasLongList ? 'Lista longa pede disciplina de checklist' : 'Página pronta para leitura rápida'),
        text: spoilerCount
          ? 'Revele o conteúdo com cuidado e só quando isso fizer sentido para a sua run atual.'
          : (hasLongList
            ? 'Como a lista é mais densa, o ideal é marcar progresso com frequência para não perder tração.'
            : 'A estrutura atual favorece leitura rápida antes de decidir se vale colocar o jogo na biblioteca.')
      }
    ];
  }

  function buildRoadmapStages(viewModel = {}) {
    const steps = Array.isArray(viewModel.roadmap) ? viewModel.roadmap : [];
    return steps.map((step, index) => {
      const raw = typeof step === 'string'
        ? step
        : (step?.title || step?.description || step?.name || 'Etapa');
      const clean = String(raw || 'Etapa').trim();
      const title = clean.length > 72 ? `${clean.slice(0, 69).trimEnd()}...` : clean;
      let cue = 'Use esta etapa como bloco principal antes de avançar para a próxima.';
      if (index === 0) cue = 'Comece por aqui para alinhar rota, risco e ritmo antes de investir várias horas.';
      else if (index === steps.length - 1) cue = 'Feche por aqui com cleanup, revisão final e validação do que ficou pendente.';
      else if (/online|multiplayer|coop/i.test(clean)) cue = 'Planeje essa parte cedo para não depender de fila, parceiro ou janela ruim depois.';
      else if (/cleanup|colet|colecion|farm|grind/i.test(clean)) cue = 'Entre nesta etapa quando a campanha principal já estiver estabilizada e o checklist fizer mais sentido.';
      else if (/run|campanha|hist[oó]ria|new game|ng\+?/i.test(clean)) cue = 'Trate esta etapa como o eixo da run principal e evite desviar sem necessidade.';
      return { number: index + 1, title, detail: clean, cue };
    });
  }

  function buildContextualFaq(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : [];
    const missableCount = trophies.filter(trophy => trophy && trophy.is_missable).length;
    const spoilerCount = trophies.filter(trophy => trophy && trophy.is_spoiler).length;
    const roadmapCount = Array.isArray(viewModel.roadmap) ? viewModel.roadmap.length : 0;
    const hasDenseList = trophies.length >= 45;
    return [
      {
        question: 'É seguro começar sem ler tudo?',
        answer: roadmapCount
          ? `Leia pelo menos o bloco “Antes de começar” e as ${roadmapCount} etapa(s) do roadmap. Isso já reduz boa parte do risco de ordem errada.`
          : 'Leia primeiro os alertas editoriais, os destaques da lista e o resumo de risco. O restante pode ser consultado durante a run.'
      },
      {
        question: 'Onde está o maior risco de retrabalho?',
        answer: missableCount
          ? `Nos ${missableCount} troféu(s) sinalizado(s) como perdíveis. Eles merecem conferência antes de avançar cegamente na campanha.`
          : 'O cadastro atual não mostra perdíveis críticos claros, então o maior risco tende a ser tempo mal distribuído, cleanup torto ou farming deixado para tarde.'
      },
      {
        question: 'Preciso usar o checklist desde o começo?',
        answer: hasDenseList
          ? 'Sim. Como a lista é mais extensa, marcar progresso cedo evita perder contexto e transforma sessões longas em avanço visível.'
          : 'Vale a pena pelo menos para objetivos únicos, troféus sensíveis e para saber exatamente onde você parou.'
      },
      {
        question: 'Tem algo que pede leitura com mais cautela?',
        answer: spoilerCount
          ? `Sim. Há ${spoilerCount} alerta(s) de spoiler ou conteúdo sensível. Revele apenas quando isso não atrapalhar sua experiência.`
          : 'Nada muito sensível aparece no cadastro atual, então a leitura pode ser mais direta sem tanta preocupação com spoiler.'
      }
    ];
  }


  function buildCriticalTrophyAlerts(game = {}, trophies = []) {
    const ranked = trophies
      .filter(Boolean)
      .map(trophy => {
        const bag = `${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`.toLowerCase();
        let score = 0;
        if (trophy?.is_missable) score += 5;
        if (trophy?.is_spoiler) score += 2;
        if (/online|multiplayer|coop/.test(bag)) score += 4;
        if (/grind|farm|rank|xp|nível|level/.test(bag)) score += 3;
        if (/colet|colecion|miss|perd|chapter|cap[ií]tulo/.test(bag)) score += 3;
        if (/difficulty|dificuldade|hard|survival/.test(bag)) score += 2;
        return {
          name: trophy?.name || 'Troféu',
          label: trophy?.is_missable ? 'Perdível' : (trophy?.is_spoiler ? 'Spoiler / atenção' : (trophy?.type || 'Troféu')),
          reason: trophy?.tip || trophy?.description || 'Requer leitura antes da run.',
          score
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (ranked.length) return ranked;

    return [{
      name: 'Sem alerta crítico explícito',
      label: 'Baixo risco aparente',
      reason: game?.missable || 'O cadastro atual não marca troféus realmente bloqueadores, então o risco maior tende a estar na gestão do tempo e do cleanup.'
    }];
  }

  function buildExecutionProfile(game = {}, trophies = [], roadmap = []) {
    const timeValue = getTimeValue(game);
    const difficulty = Number(game?.difficulty || 0);
    const onlineCount = trophies.filter(trophy => /online|multiplayer|coop/i.test(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`)).length;
    const grindCount = trophies.filter(trophy => /grind|farm|rank|xp|nível|level/i.test(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`)).length;
    const missableCount = trophies.filter(trophy => trophy?.is_missable).length;

    let timeBand = 'Projeto curto';
    let timeDetail = 'Bom para fechar em poucas sessões e manter sensação de avanço rápido.';
    if (timeValue > 15 && timeValue <= 35) {
      timeBand = 'Projeto médio';
      timeDetail = 'Pede organização mínima para não transformar a reta final em cleanup desordenado.';
    } else if (timeValue > 35) {
      timeBand = 'Projeto longo';
      timeDetail = 'Vale entrar com rota definida, checkpoints claros e expectativa de constância por vários dias.';
    }

    let difficultyBand = 'Entrada tranquila';
    let difficultyDetail = 'A dificuldade declarada sugere execução mais estável e menor chance de travar por mecânica pura.';
    if (difficulty >= 5 && difficulty <= 7) {
      difficultyBand = 'Exigência moderada';
      difficultyDetail = 'Há chance real de trechos que cobram consistência, leitura prévia e alguma disciplina de checklist.';
    } else if (difficulty > 7) {
      difficultyBand = 'Execução exigente';
      difficultyDetail = 'Este é o tipo de guia em que ordem, treino e preparação editorial economizam mais horas.';
    }

    const friction = [];
    if (missableCount) friction.push(`${missableCount} perdível(is) marcado(s)`);
    if (onlineCount) friction.push(`${onlineCount} objetivo(s) com online/co-op`);
    if (grindCount) friction.push(`${grindCount} ponto(s) com cara de grind`);
    if (roadmap.length >= 4) friction.push(`${roadmap.length} etapas no roadmap`);
    if (!friction.length) friction.push('sem gargalo crítico explícito no cadastro atual');

    return {
      timeBand,
      timeDetail,
      difficultyBand,
      difficultyDetail,
      frictionLine: friction.join(' • ')
    };
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
    const prepCards = buildPrepCards(game, { trophies, roadmap });
    const roadmapStages = buildRoadmapStages({ roadmap });
    const contextualFaq = buildContextualFaq(game, { trophies, roadmap });
    const criticalAlerts = buildCriticalTrophyAlerts(game, trophies);
    const executionProfile = buildExecutionProfile(game, trophies, roadmap);
    const spotlightTrophies = trophies
      .filter(trophy => trophy?.is_spoiler || /perd|miss|colet|online|grind|dific/i.test(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`))
      .slice(0, 3)
      .map(trophy => ({
        name: trophy?.name || 'Troféu',
        label: trophy?.is_spoiler ? 'Spoiler / atenção' : (trophy?.type || 'Troféu'),
        text: trophy?.tip || trophy?.description || 'Revise este troféu antes de começar.'
      }));
    const nextActionModel = deriveNextAction(game, completedSource);

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
      prepCards,
      roadmapStages,
      contextualFaq,
      criticalAlerts,
      executionProfile,
      spotlightTrophies,
      nextActionModel,
      decisionModel: buildGuideDecisionModel(game, trophies, roadmap),
      difficultyLabel: getDifficultyProfileLabel(game?.difficulty),
      image: getGameImageSrc(game?.image),
      editorial: buildEditorialSignals(game, { trophies, roadmap, total, missables }),
      isSaved: Boolean(options?.isSaved),
      libraryEntry: options?.libraryEntry || null
    };
  }


  function renderGuideRelatedCards(relatedGames = []) {
    if (!Array.isArray(relatedGames) || !relatedGames.length) {
      return '<div class="atlas-inline-empty md:col-span-2">Conforme o catálogo crescer, os jogos parecidos e a próxima trilha aparecem aqui.</div>';
    }

    return relatedGames.map((item, index) => {
      const game = item?.game || item;
      const reason = item?.reason || 'Boa continuação para manter o ritmo de platina.';
      const badge = item?.badge || `Sugestão ${index + 1}`;
      const trophyCount = Number(game?.trophy_count || game?.trophies?.length || 0);
      const roadmapCount = Number(game?.roadmap_count || game?.roadmap?.length || 0);
      const image = getGameImageSrc(game?.image);
      return `
        <a href="/jogo/${escapeAttribute(game?.slug || '')}" class="atlas-catalog-card" data-home-game="${escapeAttribute(game?.name || '')}">
          ${buildImageAttrs(image, game?.name || 'Jogo', 'atlas-catalog-card__image', { width: 900, height: 520, sizes: '(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw' })}
          <div class="atlas-catalog-card__body">
            <div class="atlas-catalog-badges">
              <span class="atlas-tag">Jogo parecido</span>
              <span class="atlas-tag atlas-tag--accent">${escapeHtml(badge)}</span>
            </div>
            <div class="flex items-start justify-between gap-3 mt-3">
              <div>
                <h3>${escapeHtml(game?.name || 'Jogo')}</h3>
                <p class="atlas-catalog-lead">${escapeHtml(reason)}</p>
              </div>
              <span class="atlas-tag atlas-tag--ghost">${escapeHtml(String(game?.difficulty || '-'))}/10</span>
            </div>
            <p>${trophyCount} troféus • ${escapeHtml(game?.time || 'Tempo não informado')} • ${roadmapCount} etapa(s) no roadmap</p>
            <div class="atlas-catalog-meta">
              <span><i class="fas fa-arrow-trend-up"></i> Mantém a mesma pegada</span>
              <span><i class="fas fa-arrow-right"></i> Abrir próximo guia</span>
            </div>
          </div>
        </a>`;
    }).join('');
  }

  function renderGuide(game, state = {}) {
    const headerEl = qs('#guideHeader');
    const sidebarEl = qs('#sidebarInfo');
    const trophiesEl = qs('#trophyList') || qs('#trophiesList') || qs('#guideTrophies');
    const relatedEl = qs('#guideRelatedOverview');
    const isSaved = Boolean(state?.isSaved);
    const libraryEntry = state?.libraryEntry || null;
    const relatedGames = Array.isArray(state?.relatedGames) ? state.relatedGames : [];
    const completedSource = Array.isArray(state)
      ? state
      : Array.isArray(state?.completedTrophies)
        ? state.completedTrophies
        : (Array.isArray(game?.completed) ? game.completed : []);
    const viewModel = buildGuideViewModel(game, completedSource, { isSaved, libraryEntry });
    const guideMeta = getLibraryMeta({ ...game, completed: completedSource, trophies: viewModel.trophies });

    if (headerEl) {
      headerEl.innerHTML = `
        <section class="atlas-panel p-5 md:p-6 bg-white/[0.03] border border-white/10">
          <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
            <div class="flex gap-4 items-start min-w-0">
              <div class="atlas-guide-cover shrink-0">
                ${buildImageAttrs(viewModel.image, game?.name || 'Jogo', 'w-full h-full object-cover', { width: 900, height: 520, fetchpriority: 'high', loading: 'eager', decoding: 'sync', sizes: '(min-width: 1280px) 240px, 160px' })}
              </div>
              <div class="min-w-0">
                <div class="atlas-eyebrow">Guia revisado para decidir antes de começar</div>
                <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight mt-2 break-words">${escapeHtml(game?.name || 'Guia')}</h1>
                <p class="text-white/58 mt-3 max-w-3xl">Dificuldade ${escapeHtml(String(game?.difficulty || '-'))}/10 • ${escapeHtml(game?.time || 'Tempo não informado')} • ${viewModel.total} troféu(s) • revisão ${escapeHtml(viewModel.editorial.reviewedAt)}</p>
                <div class="flex flex-wrap gap-2 mt-4">
                  <span class="atlas-tag">Perfil ${escapeHtml(viewModel.difficultyLabel)}</span>
                  <span class="atlas-tag">${escapeHtml(game?.time || 'Tempo não informado')}</span>
                  <span class="atlas-tag ${getDecisionToneClass(viewModel.decisionModel.fitLabel)}">${escapeHtml(viewModel.decisionModel.fitLabel)}</span>
                  <span class="atlas-tag ${getDecisionToneClass(viewModel.decisionModel.riskLabel)}">${escapeHtml(viewModel.decisionModel.riskLabel)}</span>
                  <span class="atlas-tag">${escapeHtml(viewModel.breakdownText)}</span>
                </div>
                <section class="atlas-decision-panel mt-5">
                  <div class="atlas-decision-panel__header">
                    <div>
                      <div class="atlas-eyebrow">Decisão rápida</div>
                      <h2 class="text-2xl md:text-3xl font-extrabold mt-2">${escapeHtml(viewModel.decisionModel.verdict)}</h2>
                    </div>
                    <span class="atlas-tag ${getDecisionToneClass(viewModel.decisionModel.paceLabel)}">${escapeHtml(viewModel.decisionModel.paceLabel)}</span>
                  </div>
                  <p class="text-white/74 mt-3 max-w-3xl">${escapeHtml(viewModel.decisionModel.verdictDetail)}</p>
                  <div class="atlas-decision-grid mt-4">
                    <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Esforço</div><strong class="block mt-2 text-white">${escapeHtml(viewModel.decisionModel.fitLabel)}</strong><p class="text-sm text-white/72 mt-2">${escapeHtml(viewModel.decisionModel.fitDetail)}</p></article>
                    <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Risco</div><strong class="block mt-2 text-white">${escapeHtml(viewModel.decisionModel.riskLabel)}</strong><p class="text-sm text-white/72 mt-2">${escapeHtml(viewModel.decisionModel.riskDetail)}</p></article>
                    <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Quando vale abrir</div><strong class="block mt-2 text-white">${escapeHtml(viewModel.decisionModel.paceLabel)}</strong><p class="text-sm text-white/72 mt-2">${escapeHtml(viewModel.decisionModel.paceDetail)}</p></article>
                  </div>
                </section>
                <div class="grid sm:grid-cols-3 gap-3 mt-4 max-w-4xl">
                  <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Última revisão</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.reviewedAt)} • ${escapeHtml(viewModel.editorial.reviewer)}</p></article>
                  <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Status do guia</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.coverageLabel)} • ${escapeHtml(viewModel.editorial.scopeSummary)}</p></article>
                  <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Vale abrir agora?</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.readinessLabel)} • ${escapeHtml(viewModel.editorial.readinessDetail)}</p></article>
                </div>
                <div class="atlas-decision-panel mt-4">
                  <div class="atlas-decision-panel__header">
                    <div>
                      <div class="atlas-eyebrow">O que este guia já valida para você</div>
                      <h2 class="text-xl md:text-2xl font-extrabold mt-2">O que já está claro antes de você investir horas</h2>
                    </div>
                    <span class="atlas-tag atlas-tag--soft">${escapeHtml(viewModel.editorial.coverageLabel)}</span>
                  </div>
                  <p class="text-white/74 mt-3 max-w-3xl">${escapeHtml(viewModel.editorial.coverageDetail)}</p>
                  <div class="grid lg:grid-cols-3 gap-3 mt-4">
                    <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Assinatura editorial</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.reviewer)} revisou este material em ${escapeHtml(viewModel.editorial.reviewedAt)}.</p></article>
                    <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Escopo coberto</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.scopeSummary)}</p></article>
                    <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Como ler esta página</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.methodSummary)}</p></article>
                  </div>
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
          <div class="glass-morphism rounded-[18px] p-4 border border-white/10 atlas-next-action-box">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Janela de progresso</div>
              <span class="atlas-tag atlas-tag--${escapeAttribute(guideMeta.progressState.accent)}">${escapeHtml(guideMeta.momentumLabel)}</span>
            </div>
            <strong class="block text-white mt-2">${escapeHtml(guideMeta.progressState.title)}</strong>
            <p class="text-sm text-white/72 mt-2">${escapeHtml(guideMeta.progressState.detail)}</p>
          </div>
        </section>
        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Confiança editorial</div>
          <div class="space-y-3 text-sm text-white/72">
            <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Revisado por</div><p class="mt-2">${escapeHtml(viewModel.editorial.reviewer)} em ${escapeHtml(viewModel.editorial.reviewedAt)}.</p></article>
            <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Cobertura</div><p class="mt-2">${escapeHtml(viewModel.editorial.coverageLabel)}. ${escapeHtml(viewModel.editorial.coverageDetail)}</p></article>
            <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Leitura recomendada</div><p class="mt-2">${escapeHtml(viewModel.editorial.readinessLabel)}. ${escapeHtml(viewModel.editorial.readinessDetail)}</p></article>
          </div>
        </section>
        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Escopo e método</div>
          <ul class="space-y-3 text-sm text-white/72">
            ${viewModel.editorial.scopeItems.map(item => `<li class="flex items-start gap-3"><span class="atlas-tag mt-0.5">•</span><span>${escapeHtml(item)}</span></li>`).join('')}
          </ul>
          <div class="space-y-3">
            ${viewModel.editorial.methodItems.map((item, index) => `<article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Método ${index + 1}</div><p class="mt-2 text-sm text-white/72">${escapeHtml(item)}</p></article>`).join('')}
          </div>
        </section>
        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Sua próxima ação</div>
          <div class="glass-morphism rounded-[18px] p-4 border border-white/10">
            <strong class="block text-white">${escapeHtml(viewModel.nextActionModel.title)}</strong>
            <p class="text-sm text-white/72 mt-2">${escapeHtml(viewModel.nextActionModel.detail)}</p>
            <div class="flex flex-wrap gap-2 mt-4">
              <button type="button" class="atlas-btn atlas-btn-primary" data-guide-action="${escapeAttribute(viewModel.nextActionModel.focus)}">${escapeHtml(viewModel.nextActionModel.cta)}</button>
              <button type="button" class="atlas-btn atlas-btn-secondary" data-guide-action="trophies">Ver checklist</button>
            </div>
          </div>
        </section>
        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Antes de começar</div>
          <p class="text-sm text-white/60">Use esta leitura para entender risco, esforço e a melhor forma de entrar no guia sem desperdiçar tempo.</p>
          <div class="atlas-prep-grid">
            ${viewModel.prepCards.map(card => `<article class="glass-morphism rounded-[18px] p-4 border border-white/10 atlas-prep-card"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">${escapeHtml(card.tag)}</div><strong class="block text-white mt-2">${escapeHtml(card.title)}</strong><p class="text-sm text-white/72 mt-2">${escapeHtml(card.text)}</p></article>`).join('')}
          </div>
          <ul class="space-y-3 text-sm text-white/72">
            ${viewModel.prepChecklist.map(item => `<li class="flex items-start gap-3"><span class="atlas-tag mt-0.5">•</span><span>${escapeHtml(item)}</span></li>`).join('')}
          </ul>
        </section>
        <section id="guideRoadmapPanel" class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="atlas-eyebrow">Roadmap</div>
              <p class="text-sm text-white/60 mt-3">Sequência editorial para entrar, avançar e fechar a platina com menos retrabalho.</p>
            </div>
            <span class="atlas-tag atlas-tag--soft">${escapeHtml(String(viewModel.roadmap.length || 0))} etapa(s)</span>
          </div>
          ${viewModel.roadmapStages.length ? `<div class="atlas-roadmap-stack">${viewModel.roadmapStages.map(stage => `<article class="glass-morphism rounded-[18px] p-4 border border-white/10 atlas-roadmap-stage"><div class="atlas-roadmap-stage__head"><span class="atlas-tag">${stage.number}</span><strong class="text-white">${escapeHtml(stage.title)}</strong></div><p class="text-sm text-white/72 mt-3">${escapeHtml(stage.detail)}</p><p class="text-xs text-white/48 mt-3">${escapeHtml(stage.cue)}</p></article>`).join('')}</div>` : '<div class="text-white/45">Sem roadmap cadastrado.</div>'}
        </section>
        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Pontos críticos antes da primeira run</div>
          <p class="text-sm text-white/60">Estes são os trechos com maior chance de gerar retrabalho, cleanup torto ou perda de ritmo se você entrar no improviso.</p>
          <div class="space-y-3">
            ${viewModel.criticalAlerts.map(item => `<article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="flex flex-wrap items-center gap-2 justify-between"><strong class="text-white">${escapeHtml(item.name)}</strong><span class="atlas-tag atlas-tag--warning">${escapeHtml(item.label)}</span></div><p class="text-sm text-white/72 mt-3">${escapeHtml(item.reason)}</p></article>`).join('')}
          </div>
        </section>
        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Como ler tempo e dificuldade deste guia</div>
          <div class="grid md:grid-cols-2 gap-3">
            <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Tempo estimado</div><strong class="block text-white mt-2">${escapeHtml(viewModel.executionProfile.timeBand)}</strong><p class="text-sm text-white/72 mt-2">${escapeHtml(viewModel.executionProfile.timeDetail)}</p></article>
            <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Dificuldade real</div><strong class="block text-white mt-2">${escapeHtml(viewModel.executionProfile.difficultyBand)}</strong><p class="text-sm text-white/72 mt-2">${escapeHtml(viewModel.executionProfile.difficultyDetail)}</p></article>
          </div>
          <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">O que mais pesa aqui</div><p class="text-sm text-white/72 mt-2">${escapeHtml(viewModel.executionProfile.frictionLine)}</p></article>
        </section>
        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Perguntas que importam antes da run</div>
          <div class="space-y-3 text-sm text-white/72">
            ${viewModel.contextualFaq.map(item => `<article class="glass-morphism rounded-[18px] p-4 border border-white/10 atlas-faq-item"><strong class="text-white block">${escapeHtml(item.question)}</strong><p class="mt-2">${escapeHtml(item.answer)}</p></article>`).join('')}
          </div>
        </section>

        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Metodologia</div>
          <div class="space-y-3 text-sm text-white/72">
            <p><strong class="text-white">Dificuldade:</strong> considera execução real, exigência mecânica, RNG, troféus online e risco de retrabalho.</p>
            <p><strong class="text-white">Tempo estimado:</strong> baseado em rota eficiente, sem speedrun irreal e considerando cleanup necessário.</p>
            <p><strong class="text-white">Perdíveis:</strong> marcamos apenas quando há real risco de bloqueio ou necessidade de nova campanha.</p>
          </div>
        </section>


        <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
          <div class="atlas-eyebrow">Depois deste guia</div>
          <div class="space-y-3 text-sm text-white/72">
            <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><strong class="text-white block">Qual é o próximo bom clique?</strong><p class="mt-2">Se este jogo te agradar, o próximo passo ideal é abrir um guia com ritmo parecido de dificuldade e duração para manter consistência, não só novidade.</p></article>
            <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><strong class="text-white block">Como usar as recomendações</strong><p class="mt-2">As sugestões abaixo priorizam jogos com tempo, densidade de checklist e dificuldade semelhantes para você não quebrar o ritmo da biblioteca.</p></article>
          </div>
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
              <article class="trophy-card atlas-panel rounded-[24px] p-5 bg-white/[0.03] border border-white/10 ${done ? 'completed' : ''}" data-trophy-id="${escapeAttribute(trophy.id || '')}" data-type="${escapeAttribute(trophy.type || 'Bronze')}" data-status="${done ? 'completed' : 'pending'}" data-search="${escapeAttribute(search)}" ${!done && trophy.id === viewModel.nextActionModel.trophyId ? 'data-next-focus="true"' : ''}>
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

    if (relatedEl) {
      relatedEl.innerHTML = renderGuideRelatedCards(relatedGames);
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
