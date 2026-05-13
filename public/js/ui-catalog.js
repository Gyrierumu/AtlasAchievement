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

  function getCatalogStatusBadge(statusBadge = {}) {
    if (statusBadge.status) return statusBadge;
    if (isUnverifiedBadge(statusBadge)) {
      return { ...statusBadge, label: 'Em verificação', badge: 'unverified', tone: 'unverified' };
    }
    return statusBadge;
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
      ? `<i class="fas fa-circle-info" aria-hidden="true"></i><span>${escapeHtml(`${count} guias com dados em verificação`)}</span>`
      : '';
  }

  function getCatalogCardImageSource(game = {}, model = {}) {
    const candidates = [
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

    if (titleTarget) titleTarget.textContent = meta.name || 'Catálogo de jogos';
    if (heroTitleTarget) heroTitleTarget.textContent = meta.heroTitle || 'Navegue sem depender da busca';
    if (heroDescriptionTarget) heroDescriptionTarget.textContent = `${meta.heroDescription || meta.description}${typeof total === 'number' ? ` ${total} jogo(s) visível(is) nesta faixa agora.` : ''}`.trim();
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
    const getTotal = game => Number(game.trophy_count || game.trophies?.length || 0);

    renderCatalogIntentBar(allGames, intent);
    renderCatalogCompareTray();
    renderVerificationNotice(items);

    const activeFacet = catalogFacetMeta[facet] || catalogFacetMeta.all;
    const activeTotal = Number(facetCounts[facet] ?? pagination.total ?? items.length ?? 0);
    const isEmptyCollection = facet !== 'all' && activeTotal === 0;
    updateCatalogCollectionIntro(facet, activeTotal, facetCounts);
    setCatalogRobotsMeta(isEmptyCollection);
    setCatalogMeta(facet, { items });

    if (segments) {
      const primaryFacetIds = [
        'all',
        'time-short',
        'time-medium',
        'time-long',
        'difficulty-low',
        'difficulty-high',
        'online-none',
        'online-required',
        'coop-required',
        'missable-present',
        'missable-none',
        'grind-present',
        'dlc-base',
        'chapter-select',
        'editorial-verified',
        'editorial-review'
      ];
      const chipConfigs = primaryFacetIds
        .map(id => catalogFacetMeta[id])
        .filter(Boolean)
        .map(config => ({
          config,
          count: Number(facetCounts[config.id] ?? (config.id === 'all' ? allGames.length || pagination.total || items.length : 0))
        }))
        .filter(entry => entry.config.id === activeFacet.id || entry.config.id === 'all' || entry.count > 0);

      segments.innerHTML = chipConfigs.map(({ config, count }) => {
        const isActive = config.id === activeFacet.id;
        const isEmpty = count === 0;
        const countLabel = count ? formatCatalogCount(count) : 'em expansão';
        return `
          <button type="button" class="atlas-collection-chip ${isActive ? 'is-active' : ''} ${isEmpty ? 'is-empty' : ''}" data-catalog-facet="${escapeAttribute(config.id)}" aria-pressed="${isActive ? 'true' : 'false'}" title="${escapeAttribute(config.chipDescription || config.description)}">
            <span>${escapeHtml(config.chipLabel || config.name)}</span>
            <small>${escapeHtml(countLabel)}</small>
          </button>`;
      }).join('');
    }

    if (summary) {
      const visibleTotal = Number(pagination.total ?? activeTotal ?? 0);
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
          <h3>Nenhum guia encontrado com essa combinação.</h3>
          <p>Tente remover o filtro de online, ampliar a faixa de tempo ou limpar a busca.</p>
          <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-catalog-clear-filters><i class="fas fa-rotate-left"></i> Limpar filtros</button>
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
      model.statusBadge = getCatalogStatusBadge(model.statusBadge);
      const slug = escapeAttribute(model.slug || '');
      const imageSource = getCatalogCardImageSource(game, model);
      const decision = getCatalogDecisionSignals(game);
      const signalHtml = (decision.signals || []).slice(0, 5).map(signal => `
              <span class="catalog-card__signal catalog-card__signal--${escapeAttribute(signal.tone || 'neutral')}" title="${escapeAttribute(signal.label)}"><i class="fas ${escapeAttribute(signal.icon || 'fa-circle-info')}" aria-hidden="true"></i>${escapeHtml(signal.label)}</span>`).join('');
      return `
        <article class="catalog-card${imageSource ? '' : ' catalog-card--image-fallback'}" data-game-slug="${slug}" data-difficulty-tone="${escapeAttribute(model.difficultyTone)}" data-risk="${model.hasRisk ? 'missable' : 'none'}">
          ${renderCatalogCardImage(game, model, imageSource)}
          <div class="catalog-card__body">
            <div class="catalog-card__badges">
              <span class="catalog-card__status atlas-badge atlas-badge--${escapeAttribute(model.statusBadge.badge || model.statusBadge.tone || 'partial')}">${escapeHtml(model.statusBadge.label)}</span>
              ${model.hasRisk ? '<span class="atlas-badge atlas-badge--risk">Perdíveis</span>' : ''}
            </div>
            <h3 class="catalog-card__title">${escapeHtml(model.name)}</h3>
            <div class="catalog-card__meta">
              <span class="atlas-meta-signal ${escapeAttribute(model.difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(String(model.difficulty))}/10</span>
              <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(model.time)}</span>
              <span class="atlas-meta-signal atlas-meta-signal--trophy"><i class="fas fa-trophy"></i>${escapeHtml(String(model.trophies))} troféus</span>
            </div>
            <div class="catalog-card__signals" aria-label="Sinais para decidir a platina">
              ${signalHtml}
            </div>
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

  function renderCatalogIntentBar(items = [], activeIntent = 'all') {
    const target = qs('#catalogIntentBar');
    if (!target) return;
    const intents = buildCatalogIntentConfigs(items);
    if (!intents.length) {
      target.innerHTML = '<span class="text-sm text-white/45">Atalhos por intenção aparecem quando houver jogos publicados nessas faixas.</span>';
      return;
    }
    target.innerHTML = intents.map(intent => {
      const active = activeIntent === intent.id;
      return `<button type="button" class="atlas-pill ${active ? 'atlas-pill-active' : ''}" data-catalog-intent="${escapeAttribute(intent.id)}" data-intent-facet="${escapeAttribute(intent.facet)}" data-intent-sort="${escapeAttribute(intent.sort)}"><i class="fas ${escapeAttribute(intent.icon)}"></i> ${escapeHtml(intent.label)} <span class="text-white/45">• ${escapeHtml(intent.helper)}</span></button>`;
    }).join('');
  }

  function renderCatalogCompareTray() {
    const tray = qs('#catalogCompareTray');
    if (!tray) return;
    tray.innerHTML = '';
    tray.classList.add('hidden');
    tray.setAttribute('aria-hidden', 'true');
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
    renderCatalogCompareTray
  };
})();
