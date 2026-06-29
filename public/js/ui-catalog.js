window.UICatalog = (() => {
  const { qs, escapeHtml, escapeAttribute, getGameImageSrc, getGameCoverSrc, isPlaceholderGameImage } = window.UIShared;
  const { buildBreadcrumbsHtml, formatCatalogCount } = window.UIFormatters;
  const {
    buildCatalogIntentConfigs,
    catalogFacetMeta,
    getEditorialBadge,
    hasMissableRiskText,
    getDifficultyTone,
    getDifficultyToneClass
  } = window.UIDecisionModels;
  const sharedCatalog = window.AtlasCatalogModel || {};
  const sharedCard = window.AtlasCardModel || {};

  function renderPagination(...args) {
    return window.UI?.renderPagination?.(...args);
  }

  function getPublicOrigin() {
    const canonicalHref = document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    try {
      return new URL(canonicalHref).origin;
    } catch (error) {
      return window.location.origin;
    }
  }

  function isUnverifiedBadge(statusBadge = {}) {
    if (statusBadge.status && statusBadge.status !== 'verified') return true;
    return (statusBadge.badge || statusBadge.tone) === 'unverified'
      || /verifica/i.test(String(statusBadge.label || ''));
  }

  function getCatalogStatusBadge(statusBadge = {}, game = {}) {
    const verified = typeof sharedCatalog.isCatalogVerified === 'function'
      ? sharedCatalog.isCatalogVerified(game)
      : !isUnverifiedBadge(statusBadge);
    return verified
      ? { ...statusBadge, status: 'verified', label: 'Verificado', badge: 'verified', tone: 'verified' }
      : { ...statusBadge, status: 'in_review', label: 'Em revisão', badge: 'review', tone: 'review' };
  }

  function renderVerificationNotice(items = []) {
    const target = qs('#catalogVerificationNotice');
    if (!target) return;
    const count = items.reduce((total, game) => {
      const statusBadge = typeof sharedCard.buildStandardGameCardModel === 'function'
        ? sharedCard.buildStandardGameCardModel(game).statusBadge
        : getEditorialBadge(game);
      return total + (isUnverifiedBadge(statusBadge) ? 1 : 0);
    }, 0);
    target.innerHTML = count > 1
      ? `<i class="fas fa-circle-info" aria-hidden="true"></i><span>${escapeHtml(`${count} guias em revisão editorial`)}</span>`
      : '';
  }

  function getCatalogCardImageSource(game = {}, model = {}) {
    const candidates = [
      game?.catalogImage,
      game?.catalog_image,
      game?.cardImage,
      game?.image,
      model?.bannerImage,
      game?.cover_image,
      model?.coverImage,
      model?.image
    ];
    return candidates
      .map(value => String(value || '').trim())
      .find(value => value && !(isPlaceholderGameImage ? isPlaceholderGameImage(value) : false)) || '';
  }

  function renderCatalogCardImage(game = {}, model = {}, source = '') {
    const name = model.name || game?.name || 'Jogo';
    const fallbackClass = source ? '' : ' catalog-card__media--fallback-visible';
    const image = source
      ? `<img src="${escapeAttribute(getGameImageSrc(source))}" alt="${escapeAttribute(name)}" class="catalog-card__image" loading="lazy" decoding="async" width="600" height="338" sizes="(min-width: 1180px) 31vw, (min-width: 720px) 46vw, 100vw" onerror="this.hidden=true;this.parentElement.classList.add('catalog-card__media--fallback-visible');var card=this.closest('.catalog-card');if(card)card.classList.add('catalog-card--image-fallback');">`
      : '';
    return `
          <div class="catalog-card__media${fallbackClass}">
            <span class="catalog-card__fallback" aria-hidden="true">${escapeHtml(name)}</span>
            ${image}
          </div>`;
  }

  function getCatalogFacetCountFromGames(facet = 'all', games = []) {
    return typeof sharedCatalog.getCatalogFacetCountFromGames === 'function'
      ? sharedCatalog.getCatalogFacetCountFromGames(facet, games)
      : 0;
  }

  function getCatalogFacetCountsFromGames(games = []) {
    return typeof sharedCatalog.getCatalogFacetCountsFromGames === 'function'
      ? sharedCatalog.getCatalogFacetCountsFromGames(games)
      : Object.fromEntries(Object.keys(catalogFacetMeta).map(facet => [facet, getCatalogFacetCountFromGames(facet, games)]));
  }

  function getCatalogCounts(response = {}, allGames = []) {
    return typeof sharedCatalog.getCatalogCounts === 'function'
      ? sharedCatalog.getCatalogCounts(response, allGames)
      : (response?.facetCounts && typeof response.facetCounts === 'object' ? response.facetCounts : getCatalogFacetCountsFromGames(allGames));
  }

  function getRelatedCatalogFacets(facet = 'all', facetCounts = {}, options = {}) {
    return typeof sharedCatalog.getRelatedCatalogFacets === 'function'
      ? sharedCatalog.getRelatedCatalogFacets(facet, facetCounts, options)
      : [];
  }

  function getCatalogDecisionSignals(game = {}) {
    return typeof sharedCatalog.getCatalogDecisionSignals === 'function'
      ? sharedCatalog.getCatalogDecisionSignals(game)
      : { signals: [] };
  }

  function selectCatalogStarterPicks(games = [], limit = 4) {
    return typeof sharedCatalog.selectCatalogStarterPicks === 'function'
      ? sharedCatalog.selectCatalogStarterPicks(games, limit)
      : [];
  }

  function getCatalogChipLabel(config = {}) {
    const labels = {
      all: 'Todos',
      'difficulty-low': 'Fácil',
      'difficulty-mid': 'Médio',
      'difficulty-high': 'Difícil',
      'time-short': 'Curto',
      'time-medium': 'Médio',
      'time-long': 'Longo',
      'online-none': 'Sem online',
      'missable-none': 'Sem perdíveis',
      'coop-required': 'Coop',
      'missable-present': 'Perdíveis',
      'editorial-verified': 'Verificados',
      'editorial-review': 'Em revisão'
    };
    return labels[config.id] || config.chipLabel || config.name || config.id || 'Filtro';
  }

  function getCatalogFilterHelp(id = '') {
    const help = {
      all: 'Mostra todos os jogos do catálogo.',
      'difficulty-low': 'Jogos com dificuldade baixa para começar com menos atrito.',
      'difficulty-mid': 'Jogos com desafio moderado, sem virar um projeto extremo.',
      'difficulty-high': 'Jogos que exigem mais execução, paciência ou domínio.',
      'time-short': 'Platinas mais curtas, boas para projetos rápidos.',
      'time-medium': 'Platinas de duração intermediária.',
      'time-long': 'Platinas longas, com mais volume, exploração ou grind.',
      'online-none': 'Sem troféus online obrigatórios.',
      'online-required': 'Possui algum requisito online ou dependente de servidor.',
      'coop-required': 'Exige ou recomenda cooperação/segundo jogador em algum ponto.',
      'missable-none': 'Sem troféus perdíveis relevantes cadastrados.',
      'missable-present': 'Perdíveis: troféus que podem ser perdidos se certas ações não forem feitas.',
      'editorial-verified': 'Guias revisados editorialmente e marcados como verificados.',
      'editorial-review': 'Guias ainda em revisão editorial.',
      'grind-present': 'Guias com grind relevante, farm ou repetição acima do normal.',
      'dlc-base': 'Guias focados na lista base, sem exigir DLC para a platina.',
      'chapter-select': 'Jogos com seleção de capítulos ou retorno útil para cleanup.'
    };
    return help[id] || '';
  }

  function getExperienceIntentConfigs(items = [], facetCounts = {}) {
    const base = buildCatalogIntentConfigs(items);
    const byId = new Map(base.map(item => [item.id, item]));
    const defaults = [
      {
        id: 'first-platinum',
        label: 'Ideal para começar',
        icon: 'fa-seedling',
        facet: 'difficulty-low',
        sort: 'recommended-desc',
        count: Number(facetCounts['difficulty-low'] || 0),
        helper: `${Number(facetCounts['difficulty-low'] || 0)} opção(ões) fáceis`
      },
      {
        id: 'weekend-run',
        label: 'Platina rápida',
        icon: 'fa-bolt',
        facet: 'time-short',
        sort: 'time-asc',
        count: Number(facetCounts['time-short'] || 0),
        helper: `${Number(facetCounts['time-short'] || 0)} jogo(s) curtos`
      },
      {
        id: 'high-challenge',
        label: 'Desafio',
        icon: 'fa-mountain',
        facet: 'difficulty-high',
        sort: 'difficulty-desc',
        count: Number(facetCounts['difficulty-high'] || 0),
        helper: `${Number(facetCounts['difficulty-high'] || 0)} projeto(s) exigentes`
      }
    ];
    defaults.forEach(item => {
      if (!byId.has(item.id) && item.count > 0) byId.set(item.id, item);
    });
    return defaults.map(item => byId.get(item.id)).filter(item => item && Number(item.count || 0) > 0);
  }

  function getActiveIntentLabel(intent = 'all', items = [], facetCounts = {}) {
    if (!intent || intent === 'all') return '';
    const match = getExperienceIntentConfigs(items, facetCounts).find(item => item.id === intent);
    return match?.label || '';
  }

  function renderCatalogActiveFilters({ search = '', facet = 'all', activeFacet = {}, intent = 'all', items = [], facetCounts = {}, total = 0 } = {}) {
    const target = qs('#catalogActiveFilters');
    if (!target) return;
    const chips = [];
    const normalizedSearch = String(search || '').trim();
    if (normalizedSearch) {
      chips.push(`<button type="button" class="atlas-active-filter-chip" data-catalog-clear-search title="Limpar busca"><i class="fas fa-magnifying-glass" aria-hidden="true"></i><span>${escapeHtml(normalizedSearch)}</span><i class="fas fa-xmark" aria-hidden="true"></i></button>`);
    }
    if (facet && facet !== 'all') {
      chips.push(`<button type="button" class="atlas-active-filter-chip" data-catalog-facet="all" title="Remover filtro"><i class="fas fa-filter" aria-hidden="true"></i><span>${escapeHtml(getCatalogChipLabel(activeFacet))}</span><i class="fas fa-xmark" aria-hidden="true"></i></button>`);
    }
    const intentLabel = getActiveIntentLabel(intent, items, facetCounts);
    if (intentLabel) {
      chips.push(`<button type="button" class="atlas-active-filter-chip" data-catalog-intent="all" data-intent-facet="all" data-intent-sort="recommended-desc" title="Remover experiência"><i class="fas fa-compass" aria-hidden="true"></i><span>${escapeHtml(intentLabel)}</span><i class="fas fa-xmark" aria-hidden="true"></i></button>`);
    }
    const resultCount = Number(total || 0);
    const resultLabel = formatCatalogCount(resultCount);
    target.innerHTML = `
      <div class="atlas-catalog-active-filters__count">${escapeHtml(resultLabel)} ${resultCount === 1 ? 'encontrado' : 'encontrados'}</div>
      ${chips.length ? `<div class="atlas-catalog-active-filters__chips">${chips.join('')}</div><button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-catalog-clear-filters><i class="fas fa-rotate-left" aria-hidden="true"></i> Limpar filtros</button>` : ''}`;
  }

  function updateCatalogCollectionIntro(facet = 'all', total = 0, facetCounts = {}) {
    const meta = catalogFacetMeta[facet] || catalogFacetMeta.all;
    const titleTarget = qs('#catalogTitle');
    const heroTitleTarget = qs('#catalogHeroTitle');
    const heroDescriptionTarget = qs('#catalogHeroDescription');
    const collectionTitleTarget = qs('#catalogCollectionTitle');
    const collectionDescriptionTarget = qs('#catalogCollectionDescription');
    const reasonTarget = qs('#catalogCollectionReason');
    const checklistTarget = qs('#catalogCollectionChecklist');
    const relatedTarget = qs('#catalogRelatedCollections');
    const seoTitleTarget = qs('#catalogSeoIntroTitle');
    const seoBodyTarget = qs('#catalogSeoIntroBody');

    const isCatalogRoot = (meta.id || facet) === 'all';
    if (titleTarget) titleTarget.textContent = isCatalogRoot ? 'Escolha sua próxima platina' : (meta.name || 'Catálogo de jogos');
    if (heroTitleTarget) heroTitleTarget.textContent = meta.heroTitle || 'Filtre por tempo, dificuldade e risco';
    if (heroDescriptionTarget) {
      heroDescriptionTarget.textContent = isCatalogRoot
        ? 'Compare jogos por tempo, dificuldade, troféus perdíveis, online obrigatório e status editorial antes de escolher sua próxima platina.'
        : `${meta.heroDescription || meta.description}${typeof total === 'number' ? ` ${total} jogo(s) visível(is) nesta faixa agora.` : ''}`.trim();
    }
    if (collectionTitleTarget) collectionTitleTarget.textContent = meta.collectionTitle || meta.name || 'Coleção aberta';
    if (collectionDescriptionTarget) collectionDescriptionTarget.textContent = meta.collectionDescription || meta.description || '';
    if (reasonTarget) reasonTarget.textContent = meta.reason || 'Use esta visão para comparar esforço, tempo e densidade do guia antes de escolher um jogo.';
    if (checklistTarget) checklistTarget.textContent = meta.checklist || 'Abra a página do jogo para confirmar perdíveis, roadmap e se a lista combina com o seu momento.';
    if (seoTitleTarget) seoTitleTarget.textContent = meta.introTitle || 'Contexto editorial da coleção';
    if (seoBodyTarget) seoBodyTarget.textContent = meta.introBody || meta.collectionDescription || meta.description || 'Esta coleção ajuda a comparar jogos antes do clique, com tempo, dificuldade, roadmap e riscos em primeiro plano.';

    if (relatedTarget) {
      const related = getRelatedCatalogFacets(facet, facetCounts, { includeEmpty: true });
      relatedTarget.innerHTML = related.length
        ? related.map(item => `<a href="${escapeAttribute(item.path)}" class="atlas-related-pill" data-catalog-facet="${escapeAttribute(item.id)}"><span>${escapeHtml(item.name || item.collectionTitle || item.title || item.id)}</span><small>${escapeHtml(item.count ? formatCatalogCount(item.count) : 'em expansão')}</small></a>`).join('')
        : '<span class="text-sm text-white/45">As próximas coleções relacionadas aparecerão aqui conforme o catálogo crescer.</span>';
    }
  }

  function setCatalogRobotsMeta(noindex = false) {
    if (typeof document === 'undefined' || !document.head) return;
    let meta = qs('meta[name="robots"]');
    if (noindex) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'robots');
        meta.dataset.catalogRobots = 'true';
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', 'noindex,follow');
      return;
    }
    if (meta && (meta.dataset.catalogRobots === 'true' || meta.getAttribute('content') === 'noindex,follow')) {
      meta.remove();
    }
  }

  function renderCatalogCard(game = {}, options = {}) {
    const getTotal = item => Number(item.trophy_count || item.trophies?.length || 0);
    const model = typeof sharedCard.buildStandardGameCardModel === 'function'
      ? sharedCard.buildStandardGameCardModel(game)
      : {
        slug: game.slug || '',
        name: game.name || 'Jogo',
        image: getGameCoverSrc ? getGameCoverSrc(game) : (game.cover_image || game.image || ''),
        difficulty: game.difficulty || '-',
        time: game.time || 'Tempo não informado',
        trophies: getTotal(game),
        statusBadge: getEditorialBadge(game),
        hasRisk: Number(game.missable_count || 0) > 0 || hasMissableRiskText(game.missable || game.missable_summary || ''),
        difficultyTone: getDifficultyTone(game.difficulty),
        difficultyClass: getDifficultyToneClass(game.difficulty)
      };
    model.statusBadge = getCatalogStatusBadge(model.statusBadge, game);
    const slug = escapeAttribute(model.slug || '');
    const imageSource = getCatalogCardImageSource(game, model);
    const decision = getCatalogDecisionSignals(game);
    const primarySignalIds = new Set(['online', 'no-online', 'coop', 'no-coop', 'missable', 'no-missable', 'grind']);
    const signalHtml = (decision.signals || []).filter(signal => primarySignalIds.has(signal.id)).slice(0, 4).map(signal => `
              <span class="catalog-card__signal catalog-card__signal--${escapeAttribute(signal.tone || 'neutral')}" title="${escapeAttribute(signal.label)}"><i class="fas ${escapeAttribute(signal.icon || 'fa-circle-info')}" aria-hidden="true"></i>${escapeHtml(signal.label)}</span>`).join('');
    const curatorNote = String(options.curatorNote || game.starterPickNote || '').trim();
    const modifier = options.modifier ? ` ${options.modifier}` : '';
    return `
        <article class="catalog-card${modifier}${imageSource ? '' : ' catalog-card--image-fallback'}" data-game-slug="${slug}" data-difficulty-tone="${escapeAttribute(model.difficultyTone)}" data-risk="${model.hasRisk ? 'missable' : 'none'}">
          ${renderCatalogCardImage(game, model, imageSource)}
          <div class="catalog-card__body">
            <h3 class="catalog-card__title">${escapeHtml(model.name)}</h3>
            ${curatorNote ? `<p class="catalog-card__curator-note">${escapeHtml(curatorNote)}</p>` : ''}
            <div class="catalog-card__badges">
              <span class="catalog-card__status atlas-badge atlas-badge--${escapeAttribute(model.statusBadge.badge || model.statusBadge.tone || 'partial')}">${escapeHtml(model.statusBadge.label)}</span>
            </div>
            <div class="catalog-card__meta">
              <span class="atlas-meta-signal ${escapeAttribute(model.difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(String(model.difficulty))}/10</span>
              <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(model.time)}</span>
              <span class="atlas-meta-signal atlas-meta-signal--trophy"><i class="fas fa-trophy"></i>${escapeHtml(String(model.trophies))} troféus</span>
            </div>
            ${signalHtml ? `<div class="catalog-card__risk-block">
              <span class="catalog-card__risk-label">Riscos e requisitos</span>
              <div class="catalog-card__signals" aria-label="Riscos e requisitos da platina">${signalHtml}</div>
            </div>` : ''}
            <div class="catalog-card__actions">
              <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-open-guide-card="${slug}">Abrir guia</a>
            </div>
          </div>
        </article>`;
  }

  function renderCatalogStarterPicks(games = [], options = {}) {
    const target = qs('#catalogStarterPicksSlot');
    if (!target) return;
    const search = String(options.search || '').trim();
    const facet = options.facet || 'all';
    const shouldShow = !search && facet === 'all';
    const picks = shouldShow ? selectCatalogStarterPicks(games, 4) : [];
    if (!shouldShow || !picks.length) {
      target.innerHTML = '';
      target.hidden = true;
      target.setAttribute('aria-hidden', 'true');
      return;
    }
    target.hidden = false;
    target.setAttribute('aria-hidden', 'false');
    target.innerHTML = `
      <section class="atlas-catalog-starter" aria-labelledby="catalogStarterPicksTitle">
        <div class="atlas-catalog-starter__head">
          <div>
            <span class="atlas-section-kicker">Curadoria rápida</span>
            <h2 id="catalogStarterPicksTitle">Melhores para começar</h2>
            <p>Guias mais tranquilos para iniciar uma nova platina sem online obrigatório ou grandes riscos.</p>
          </div>
          <span class="atlas-catalog-starter__count">${escapeHtml(`${picks.length} guias`)}</span>
        </div>
        <div class="atlas-catalog-starter__grid">
          ${picks.map(game => renderCatalogCard(game, { modifier: 'catalog-card--starter' })).join('')}
        </div>
      </section>`;
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
    const intent = options.intent || 'all';
    const allGames = Array.isArray(options.allGames) && options.allGames.length ? options.allGames : items;
    const facetCounts = getCatalogCounts(response, allGames);
    const starterSource = allGames.length ? allGames : items;

    renderCatalogIntentBar(allGames, intent, facetCounts);
    renderCatalogCompareTray(allGames, facetCounts);
    renderVerificationNotice(items);
    renderCatalogStarterPicks(starterSource, { search, facet });

    const activeFacet = catalogFacetMeta[facet] || catalogFacetMeta.all;
    const activeTotal = Number(facetCounts[facet] ?? pagination.total ?? items.length ?? 0);
    const isEmptyCollection = facet !== 'all' && activeTotal === 0;
    const visibleTotal = Number(pagination.total ?? activeTotal ?? items.length ?? 0);
    renderCatalogActiveFilters({ search, facet, activeFacet, intent, items: allGames, facetCounts, total: visibleTotal });
    updateCatalogCollectionIntro(facet, activeTotal, facetCounts);
    setCatalogRobotsMeta(isEmptyCollection);
    setCatalogMeta(facet, { items });

    if (segments) {
      const primaryGroups = [
        { label: 'Tempo', help: 'Escolha pelo tamanho do compromisso antes de abrir o guia.', facets: ['time-short', 'time-medium', 'time-long'] },
        { label: 'Dificuldade', help: 'Filtra pela exigência estimada da platina.', facets: ['difficulty-low', 'difficulty-mid', 'difficulty-high'] },
        { label: 'Perdíveis', help: 'Perdíveis são troféus que podem exigir atenção antes de avançar.', facets: ['missable-none', 'missable-present'] },
        { label: 'Online/co-op', help: 'Mostra se a platina depende de servidor, online ou cooperação.', facets: ['online-none', 'online-required', 'coop-required'] }
      ];
      const secondaryFacetIds = [
        'grind-present',
        'dlc-base',
        'chapter-select',
        'editorial-verified',
        'editorial-review'
      ];
      const buildChipConfigs = facetIds => facetIds
        .map(id => catalogFacetMeta[id])
        .filter(Boolean)
        .map(config => ({
          config,
          count: Number(facetCounts[config.id] ?? (config.id === 'all' ? allGames.length || pagination.total || items.length : 0))
        }))
        .filter(entry => entry.config.id === activeFacet.id || entry.config.id === 'all' || entry.count > 0);
      const renderChip = ({ config, count }, labelOverride = '') => {
        const isActive = config.id === activeFacet.id;
        const isEmpty = count === 0;
        const countLabel = count ? formatCatalogCount(count) : 'em expansão';
        const chipLabel = labelOverride || config.chipLabel || config.name;
        const helpText = getCatalogFilterHelp(config.id) || config.chipDescription || config.description || countLabel;
        return `
          <button type="button" class="atlas-collection-chip ${isActive ? 'is-active' : ''} ${isEmpty ? 'is-empty' : ''}" data-catalog-facet="${escapeAttribute(config.id)}" aria-pressed="${isActive ? 'true' : 'false'}" title="${escapeAttribute(helpText)}" aria-label="${escapeAttribute(`${chipLabel}: ${helpText}`)}">
            <span>${escapeHtml(chipLabel)}</span>
            <small>${escapeHtml(countLabel)}</small>
          </button>`;
      };
      const labelOverrides = {
        'difficulty-low': 'Fácil',
        'difficulty-mid': 'Médio',
        'difficulty-high': 'Difícil',
        'time-short': 'Curto',
        'time-medium': 'Médio',
        'time-long': 'Longo',
        'online-none': 'Sem online',
        'missable-none': 'Sem perdíveis',
        'coop-required': 'Coop',
        'missable-present': 'Perdíveis',
        'editorial-verified': 'Verificados',
        'editorial-review': 'Em revisão'
      };
      const allChip = renderChip({
        config: catalogFacetMeta.all,
        count: Number(facetCounts.all ?? allGames.length ?? pagination.total ?? items.length)
      });
      const primaryHtml = primaryGroups.map((group, index) => {
        const configs = buildChipConfigs(group.facets);
        if (!configs.length) return '';
        const isGroupActive = configs.some(entry => entry.config.id === activeFacet.id);
        const isDefaultOpen = activeFacet.id === 'all' && index === 0;
        return `
          <details class="atlas-catalog-filter-group" ${isGroupActive || isDefaultOpen ? 'open' : ''}>
            <summary class="atlas-catalog-filter-group__summary">
              <span class="atlas-catalog-filter-group__label">${escapeHtml(group.label)}</span>
              <small class="atlas-catalog-filter-group__help">${escapeHtml(group.help || '')}</small>
              <i class="fas fa-chevron-down" aria-hidden="true"></i>
            </summary>
            <div class="atlas-catalog-filter-group__options">
              ${configs.map(entry => renderChip(entry, labelOverrides[entry.config.id])).join('')}
            </div>
          </details>`;
      }).join('');
      const secondaryConfigs = buildChipConfigs(secondaryFacetIds);
      const secondaryActive = secondaryFacetIds.includes(activeFacet.id);
      const secondaryHtml = secondaryConfigs.length ? `
        <details class="atlas-catalog-more-filters" ${secondaryActive ? 'open' : ''}>
          <summary><span>Mais filtros</span><small>Status, grind, DLC e estrutura</small><i class="fas fa-chevron-down" aria-hidden="true"></i></summary>
          <div class="atlas-catalog-more-filters__content">
            <p>Use estes filtros quando quiser refinar por status editorial, grind, DLC ou seleção de capítulos.</p>
            <div class="atlas-catalog-filter-group__options">
              ${secondaryConfigs.map(entry => renderChip(entry, labelOverrides[entry.config.id])).join('')}
            </div>
          </div>
        </details>` : '';
      segments.innerHTML = `
        <div class="atlas-catalog-filter-all">${allChip}</div>
        <div class="atlas-catalog-filter-groups">${primaryHtml}</div>
        ${secondaryHtml}`;
    }

    if (summary) {
      const page = Number(pagination.page || 1);
      const totalPages = Number(pagination.totalPages || 1);
      summary.textContent = search
        ? `${formatCatalogCount(visibleTotal)} para "${search}" · página ${page} de ${totalPages}`
        : `${formatCatalogCount(activeTotal)} nesta coleção · página ${page} de ${totalPages}`;
    }

    if (!items.length) {
      const related = getRelatedCatalogFacets(facet, facetCounts).slice(0, 4);
      const fallbackLinks = related.length
        ? related
        : [{ id: 'all', path: '/catalogo', name: 'Catálogo completo', count: Number(facetCounts.all || allGames.length || 0) }];
      list.innerHTML = isEmptyCollection ? `
        <article class="atlas-panel atlas-panel--plain p-6 text-white/70 md:col-span-2 xl:col-span-3">
          <span class="atlas-section-kicker">Coleção em expansão</span>
          <h3 class="text-2xl font-extrabold tracking-tight mt-2">Ainda não há jogos nesta faixa</h3>
          <p class="mt-3 text-white/60">Nenhum guia publicado cumpre exatamente este filtro hoje.</p>
          <div class="mt-5">
            <div class="text-[11px] uppercase tracking-[0.18em] text-white/40 mb-3">Coleções próximas com jogos disponíveis</div>
            <div class="flex flex-wrap gap-3">
              ${fallbackLinks.map(item => `<a href="${escapeAttribute(item.path)}" class="atlas-chip" data-catalog-facet="${escapeAttribute(item.id || 'all')}">${escapeHtml(item.name || item.collectionTitle || 'Catálogo')} • ${escapeHtml(formatCatalogCount(item.count))}</a>`).join('')}
            </div>
          </div>
        </article>` : `
        <div class="atlas-panel atlas-panel--plain atlas-catalog-empty p-6 text-white/60 md:col-span-2 xl:col-span-3">
          <span class="atlas-section-kicker">Nada com esses filtros</span>
          <h3>Nenhum guia encontrado com esses filtros.</h3>
          <p>Tente remover algum filtro ou buscar por outro jogo.</p>
          <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" ${search ? 'data-catalog-clear-search' : 'data-catalog-clear-filters'}><i class="fas fa-rotate-left"></i> ${search ? 'Limpar busca' : 'Limpar filtros'}</button>
        </div>`;
      renderPagination('#catalogPagination', pagination, { mode: 'catalog', itemLabel: 'jogos', compact: true });
      return;
    }

    list.innerHTML = items.map(game => {
      const model = typeof sharedCard.buildStandardGameCardModel === 'function'
        ? sharedCard.buildStandardGameCardModel(game)
        : {
          slug: game.slug || '',
          name: game.name || 'Jogo',
          image: getGameCoverSrc ? getGameCoverSrc(game) : (game.cover_image || game.image || ''),
          difficulty: game.difficulty || '-',
          time: game.time || 'Tempo não informado',
          trophies: getTotal(game),
          statusBadge: getEditorialBadge(game),
          hasRisk: Number(game.missable_count || 0) > 0 || hasMissableRiskText(game.missable || game.missable_summary || ''),
          difficultyTone: getDifficultyTone(game.difficulty),
          difficultyClass: getDifficultyToneClass(game.difficulty)
        };
      model.statusBadge = getCatalogStatusBadge(model.statusBadge, game);
      const slug = escapeAttribute(model.slug || '');
      const imageSource = getCatalogCardImageSource(game, model);
      const decision = getCatalogDecisionSignals(game);
      const primarySignalIds = new Set(['online', 'no-online', 'coop', 'no-coop', 'missable', 'no-missable', 'grind']);
      const signalHtml = (decision.signals || []).filter(signal => primarySignalIds.has(signal.id)).slice(0, 4).map(signal => `
              <span class="catalog-card__signal catalog-card__signal--${escapeAttribute(signal.tone || 'neutral')}" title="${escapeAttribute(signal.label)}"><i class="fas ${escapeAttribute(signal.icon || 'fa-circle-info')}" aria-hidden="true"></i>${escapeHtml(signal.label)}</span>`).join('');
      return `
        <article class="catalog-card${imageSource ? '' : ' catalog-card--image-fallback'}" data-game-slug="${slug}" data-difficulty-tone="${escapeAttribute(model.difficultyTone)}" data-risk="${model.hasRisk ? 'missable' : 'none'}">
          ${renderCatalogCardImage(game, model, imageSource)}
          <div class="catalog-card__body">
            <h3 class="catalog-card__title">${escapeHtml(model.name)}</h3>
            <div class="catalog-card__badges">
              <span class="catalog-card__status atlas-badge atlas-badge--${escapeAttribute(model.statusBadge.badge || model.statusBadge.tone || 'partial')}">${escapeHtml(model.statusBadge.label)}</span>
            </div>
            <div class="catalog-card__meta">
              <span class="atlas-meta-signal ${escapeAttribute(model.difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(String(model.difficulty))}/10</span>
              <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(model.time)}</span>
              <span class="atlas-meta-signal atlas-meta-signal--trophy"><i class="fas fa-trophy"></i>${escapeHtml(String(model.trophies))} troféus</span>
            </div>
            ${signalHtml ? `<div class="catalog-card__risk-block">
              <span class="catalog-card__risk-label">Riscos e requisitos</span>
              <div class="catalog-card__signals" aria-label="Riscos e requisitos da platina">${signalHtml}</div>
            </div>` : ''}
            <div class="catalog-card__actions">
              <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-open-guide-card="${slug}">Abrir guia</a>
            </div>
          </div>
        </article>`;
    }).join('');

    renderPagination('#catalogPagination', pagination, { mode: 'catalog', itemLabel: 'jogos', compact: true });
  }


  function setCatalogMeta(facet = 'all', options = {}) {
    const meta = catalogFacetMeta[facet] || catalogFacetMeta.all;
    const items = Array.isArray(options.items) ? options.items.filter(game => game?.slug && game?.name) : [];
    const publicOrigin = getPublicOrigin();
    const defaultSocialImage = `${publicOrigin}/assets/brand/atlasachievement-og.png`;
    const canonicalUrl = `${publicOrigin}${meta.path}`;
    document.title = meta.title;
    const metaDescription = qs('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute('content', meta.description);
    const canonical = qs('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', canonicalUrl);
    const ogTitle = qs('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.title);
    const ogDescription = qs('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute('content', meta.description);
    const ogType = qs('meta[property="og:type"]');
    if (ogType) ogType.setAttribute('content', 'website');
    const ogUrl = qs('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', canonicalUrl);
    const ogImage = qs('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute('content', defaultSocialImage);
    const twitterTitle = qs('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute('content', meta.title);
    const twitterDescription = qs('meta[name="twitter:description"]');
    if (twitterDescription) twitterDescription.setAttribute('content', meta.description);
    const twitterImage = qs('meta[name="twitter:image"]');
    if (twitterImage) twitterImage.setAttribute('content', defaultSocialImage);
    const breadcrumbsTarget = qs('#catalogBreadcrumbs');
    if (breadcrumbsTarget) breadcrumbsTarget.innerHTML = buildBreadcrumbsHtml([{ label: 'Início', href: '/' }, { label: 'Catálogo', href: '/catalogo' }, { label: meta.name }]);
    const jsonLd = qs('#gameStructuredData');
    if (jsonLd) jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': 'CollectionPage',
        name: meta.name,
        url: canonicalUrl,
        description: meta.description,
        mainEntity: {
          '@type': 'ItemList',
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          numberOfItems: items.length,
          itemListElement: items.map((game, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `${publicOrigin}/jogo/${game.slug}`,
            name: game.name
          }))
        }
      }, {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: `${publicOrigin}/` },
          { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${publicOrigin}/catalogo` },
          { '@type': 'ListItem', position: 3, name: meta.name, item: canonicalUrl }
        ]
      }]
    });
  }

  function renderCatalogIntentBar(items = [], activeIntent = 'all', facetCounts = {}) {
    const target = qs('#catalogIntentBar');
    if (!target) return;
    const intents = getExperienceIntentConfigs(items, facetCounts);
    if (!intents.length) {
      target.classList.add('hidden');
      target.setAttribute('aria-hidden', 'true');
      target.innerHTML = '<span class="text-sm text-white/45">Atalhos por intenção aparecem quando houver jogos publicados nessas faixas.</span>';
      return;
    }
    target.classList.remove('hidden');
    target.setAttribute('aria-hidden', 'false');
    target.innerHTML = `
      <div class="atlas-catalog-filter-group atlas-catalog-filter-group--experience">
        <span class="atlas-catalog-filter-group__label">Experiência</span>
        <div class="atlas-catalog-intent-bar__options">
          ${intents.map(intent => {
      const active = activeIntent === intent.id;
      return `<button type="button" class="atlas-pill ${active ? 'atlas-pill-active' : ''}" data-catalog-intent="${escapeAttribute(intent.id)}" data-intent-facet="${escapeAttribute(intent.facet)}" data-intent-sort="${escapeAttribute(intent.sort)}"><i class="fas ${escapeAttribute(intent.icon)}"></i> ${escapeHtml(intent.label)} <span class="text-white/45">• ${escapeHtml(intent.helper)}</span></button>`;
    }).join('')}
        </div>
      </div>`;
  }

  function renderCatalogCompareTray(items = [], facetCounts = {}) {
    const tray = qs('#catalogCompareTray');
    if (!tray) return;
    const total = Number(facetCounts.all || items.length || 0);
    if (!total) {
      tray.innerHTML = '';
      tray.classList.add('hidden');
      tray.setAttribute('aria-hidden', 'true');
      return;
    }
    const quickLinks = [
      { label: 'Mais rápidas', facet: 'time-short', icon: 'fa-bolt' },
      { label: 'Mais fáceis', facet: 'difficulty-low', icon: 'fa-shield-halved' },
      { label: 'Verificados', facet: 'editorial-verified', icon: 'fa-circle-check' }
    ].map(item => ({
      ...item,
      count: Number(facetCounts[item.facet] || 0)
    })).filter(item => item.count > 0);
    tray.classList.remove('hidden');
    tray.setAttribute('aria-hidden', 'false');
    tray.innerHTML = `
      <div class="atlas-catalog-compare-tray__intro">
        <span>Comparação rápida</span>
        <p>Use os atalhos para cruzar tempo, dificuldade e status antes de abrir um guia.</p>
      </div>
      <div class="atlas-catalog-compare-tray__links">
        ${quickLinks.map(item => `<button type="button" class="atlas-compare-chip" data-catalog-facet="${escapeAttribute(item.facet)}"><i class="fas ${escapeAttribute(item.icon)}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(formatCatalogCount(item.count))}</strong></button>`).join('')}
      </div>`;
  }

  return {
    getCatalogFacetCountFromGames,
    getCatalogFacetCountsFromGames,
    getCatalogCounts,
    getRelatedCatalogFacets,
    updateCatalogCollectionIntro,
    setCatalogRobotsMeta,
    renderCatalog,
    setCatalogMeta,
    renderCatalogIntentBar,
    renderCatalogCompareTray,
    selectCatalogStarterPicks,
    renderCatalogStarterPicks
  };
})();
