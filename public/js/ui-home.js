window.UIHome = (() => {
  const { qs, escapeHtml, escapeAttribute, getGameImageSrc, getGameCoverSrc } = window.UIShared;
  const { formatDisplayDate } = window.UIFormatters;
  const { hasMissableRiskText, getDifficultyTone, getDifficultyToneClass } = window.UIDecisionModels;
  const sharedCatalog = window.AtlasCatalogModel || {};
  const sharedCard = window.AtlasCardModel || {};
  const siteUpdates = window.AtlasSiteUpdates || {};
  let activeAnnouncementCleanup = null;

  function renderHomeEditorialBadge(model = {}) {
    const badge = model.statusBadge || {};
    if (!badge.label) return '';
    return `<span class="atlas-editorial-badge atlas-editorial-badge--small atlas-editorial-badge--${escapeAttribute(badge.status || badge.badge || badge.tone || 'in_review')}" title="${escapeAttribute(badge.detail || '')}">${escapeHtml(badge.label)}</span>`;
  }

  function renderHomeImage(model = {}, imageClass = 'atlas-card__image', options = {}) {
    const name = model.name || 'Jogo';
    const source = model.image ? getGameImageSrc(model.image) : '';
    const width = options.width || 520;
    const height = options.height || 320;
    const sizes = options.sizes || '100vw';
    return `
      <span class="atlas-home-image-fallback" aria-hidden="true">${escapeHtml(name)}</span>
      ${source ? `<img src="${escapeAttribute(source)}" alt="${escapeAttribute(name)}" class="${escapeAttribute(imageClass)}" loading="${escapeAttribute(options.loading || 'lazy')}" decoding="${escapeAttribute(options.decoding || 'async')}" width="${escapeAttribute(String(width))}" height="${escapeAttribute(String(height))}" sizes="${escapeAttribute(sizes)}" onerror="this.hidden=true;this.parentElement.classList.add('atlas-home-image-shell--fallback-visible');">` : ''}
    `;
  }

  function normalizeSlug(value = '') {
    return String(value || '').trim().toLowerCase();
  }

  function isHomeRoute() {
    if (typeof window === 'undefined') return false;
    const path = window.location?.pathname || '/';
    return path === '/' || path === '/index.html';
  }

  function hasSeenUpdate(key = '') {
    if (typeof window === 'undefined' || !key) return true;
    try {
      return window.localStorage.getItem(key) === '1';
    } catch (_error) {
      return false;
    }
  }

  function markUpdateSeen(key = '') {
    if (typeof window === 'undefined' || !key) return;
    try {
      window.localStorage.setItem(key, '1');
    } catch (_error) {
      // localStorage can be blocked; the user can still close the dialog.
    }
  }

  function isGuideVerified(game = {}) {
    const reviewStatus = normalizeSlug(game.editorial_review_status || game.editorialReviewStatus || game.editorialStatus);
    const verificationStatus = normalizeSlug(game.verification_status || game.verificationStatus || game.qualityStatus);
    return game.is_verified === true || game.verified === true || reviewStatus === 'verified' || verificationStatus === 'verified';
  }

  function resolveUpdateItems(items = [], gamesBySlug = new Map()) {
    return items.map(item => {
      const slug = normalizeSlug(item.slug);
      const game = gamesBySlug.get(slug);
      if (!slug || !game || !item.href) return null;
      return {
        ...item,
        slug,
        label: item.label || game.name || slug,
        verified: isGuideVerified(game)
      };
    }).filter(Boolean);
  }

  function trackUpdatePopup(eventName, params = {}) {
    if (!eventName || typeof window === 'undefined') return;
    window.AtlasAnalytics?.trackEvent?.(eventName, {
      campaign_id: siteUpdates.activeHomeUpdate?.id || '',
      ...params
    });
  }

  function closeHomeUpdatePopup(dialog, storageKey, previousFocus, reason = 'close') {
    if (!dialog) return;
    markUpdateSeen(storageKey);
    trackUpdatePopup('update_popup_close', { reason });
    if (typeof activeAnnouncementCleanup === 'function') {
      activeAnnouncementCleanup();
      activeAnnouncementCleanup = null;
    }
    dialog.remove();
    if (previousFocus && typeof previousFocus.focus === 'function') {
      try {
        previousFocus.focus({ preventScroll: true });
      } catch (_error) {
        previousFocus.focus();
      }
    }
  }

  function maybeShowHomeUpdatePopup(games = []) {
    const update = siteUpdates.activeHomeUpdate;
    if (!update?.active || !isHomeRoute() || hasSeenUpdate(update.localStorageKey)) return;
    const homeView = qs('#view-home');
    if (!homeView || homeView.classList.contains('hidden') || document.querySelector('[data-home-update-popup]')) return;

    const gamesBySlug = new Map((Array.isArray(games) ? games : []).map(game => [normalizeSlug(game.slug), game]));
    if (!gamesBySlug.has('saros')) return;

    const sections = (Array.isArray(update.sections) ? update.sections : []).map(section => {
      const items = resolveUpdateItems(section.items || [], gamesBySlug);
      if (!items.length) return null;
      const allVerified = !section.requiresVerifiedStatus || items.every(item => item.verified);
      return {
        ...section,
        title: section.requiresVerifiedStatus && !allVerified ? (section.fallbackTitle || 'Guias revisados recentemente') : section.title,
        allVerified,
        items
      };
    }).filter(Boolean);

    const addedSection = sections.find(section => /Novos jogos adicionados/i.test(section.title));
    if (!addedSection || !addedSection.items.some(item => item.slug === 'saros')) return;

    const usesConservativeCopy = sections.some(section => section.requiresVerifiedStatus && !section.allVerified);
    const subtitle = usesConservativeCopy ? (update.conservativeSubtitle || update.subtitle) : update.subtitle;
    const previousFocus = document.activeElement;
    const popup = document.createElement('div');
    popup.className = 'atlas-update-popup';
    popup.dataset.homeUpdatePopup = update.id || 'home-update';
    popup.innerHTML = `
      <div class="atlas-update-popup__overlay" aria-hidden="true"></div>
      <section class="atlas-update-popup__dialog" role="dialog" aria-modal="true" aria-labelledby="atlasUpdatePopupTitle" aria-describedby="atlasUpdatePopupDescription">
        <button type="button" class="atlas-update-popup__close" data-update-popup-close aria-label="Fechar pop-up de novidades">
          <i class="fas fa-xmark" aria-hidden="true"></i>
          <span class="sr-only">Fechar</span>
        </button>
        <div class="atlas-update-popup__badge"><i class="fas fa-star" aria-hidden="true"></i> Atualização do catálogo</div>
        <h2 id="atlasUpdatePopupTitle">${escapeHtml(update.title)}</h2>
        <p class="atlas-update-popup__subtitle">${escapeHtml(subtitle)}</p>
        <p id="atlasUpdatePopupDescription" class="atlas-update-popup__description">${escapeHtml(update.description)}</p>
        <div class="atlas-update-popup__sections">
          ${sections.map(section => `
            <article class="atlas-update-popup__section">
              <h3>${escapeHtml(section.title)}</h3>
              <div class="atlas-update-popup__chips">
                ${section.items.map(item => `
                  <a href="${escapeAttribute(item.href)}" class="atlas-update-popup__chip" data-update-popup-game="${escapeAttribute(item.slug)}" data-home-game="${escapeAttribute(item.label)}" data-open-guide-card="${escapeAttribute(item.slug)}">${escapeHtml(item.label)}</a>
                `).join('')}
              </div>
            </article>
          `).join('')}
        </div>
        <div class="atlas-update-popup__actions">
          <a href="${escapeAttribute(update.primaryCta?.href || '/catalogo')}" class="atlas-btn atlas-btn-primary" data-update-popup-primary data-view-link="catalog">${escapeHtml(update.primaryCta?.label || 'Ver novidades')}</a>
          <a href="${escapeAttribute(update.secondaryCta?.href || '/catalogo')}" class="atlas-btn atlas-btn-secondary" data-update-popup-secondary data-view-link="catalog">${escapeHtml(update.secondaryCta?.label || 'Explorar catálogo')}</a>
          <button type="button" class="atlas-update-popup__dismiss" data-update-popup-close>Fechar</button>
        </div>
      </section>
    `;

    homeView.appendChild(popup);

    const close = reason => closeHomeUpdatePopup(popup, update.localStorageKey, previousFocus, reason);
    const handleKeydown = event => {
      if (event.key === 'Escape') close('escape');
    };
    const handleClick = event => {
      const closeButton = event.target.closest('[data-update-popup-close]');
      if (closeButton) {
        event.preventDefault();
        close('button');
        return;
      }
      const primary = event.target.closest('[data-update-popup-primary]');
      if (primary) {
        markUpdateSeen(update.localStorageKey);
        trackUpdatePopup('update_popup_primary_cta_click', { href: primary.getAttribute('href') || '' });
        return;
      }
      const secondary = event.target.closest('[data-update-popup-secondary]');
      if (secondary) {
        markUpdateSeen(update.localStorageKey);
        trackUpdatePopup('update_popup_secondary_cta_click', { href: secondary.getAttribute('href') || '' });
        return;
      }
      const gameLink = event.target.closest('[data-update-popup-game]');
      if (gameLink) {
        markUpdateSeen(update.localStorageKey);
        trackUpdatePopup('update_popup_game_click', {
          game_slug: gameLink.dataset.updatePopupGame || '',
          href: gameLink.getAttribute('href') || ''
        });
      }
    };

    popup.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);
    activeAnnouncementCleanup = () => {
      popup.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeydown);
    };

    trackUpdatePopup('update_popup_view', { conservative_copy: usesConservativeCopy ? 'true' : 'false' });

    requestAnimationFrame(() => {
      const primary = popup.querySelector('[data-update-popup-primary]');
      const closeButton = popup.querySelector('[data-update-popup-close]');
      (primary || closeButton)?.focus?.({ preventScroll: true });
    });
  }

  function renderHomeOverview(games = []) {
    const recentTarget = qs('#recentGamesOverview');
    const updatedTarget = qs('#updatedGamesOverview');
    const featuredTarget = qs('#featuredNowOverview');
    const intentTarget = qs('#intentOverview');
    const catalogProofTarget = qs('#homeCatalogProofText');

    const getTotal = sharedCatalog.getGameTotal || (game => Number(game.trophy_count || game.trophies?.length || 0));
    const getRoadmapCount = sharedCatalog.getRoadmapCount || (game => Number(game.roadmap_count || game.roadmap?.length || 0));
    const hasRisk = sharedCatalog.hasGuideRisk || (game => Number(game.missable_count || 0) > 0 || hasMissableRiskText(game.missable || game.missable_summary || ''));
    const getRecommendationScore = sharedCatalog.getHomeRecommendationScore || (() => 0);
    const formatHomeCatalogProof = sharedCatalog.formatHomeCatalogProof || ((gamesCount = 0, totalTrophies = 0, totalRoadmaps = 0) => {
      if (!Number(gamesCount || 0) && !Number(totalTrophies || 0) && !Number(totalRoadmaps || 0)) {
        return 'Guias de platina com roadmap, checklist e progresso para acompanhar sua próxima run.';
      }
      return `${gamesCount} jogos mapeados · ${totalTrophies} troféus · ${totalRoadmaps} etapas de roadmap`;
    });
    const getFeaturedReason = sharedCatalog.getHomeFeaturedReason || (() => 'Tempo, dificuldade e rota em bom equilíbrio.');
    const getRevisionNote = sharedCatalog.getHomeRevisionNote || (() => 'Leitura editorial recente para validar o próximo clique.');
    const byRecent = [...games].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const byUpdated = [...games].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    const featuredShowcase = typeof sharedCatalog.selectHomeShowcaseGames === 'function'
      ? sharedCatalog.selectHomeShowcaseGames(games, 1)
      : [];
    const featuredGame = featuredShowcase[0] || [...games].sort((a, b) => getRecommendationScore(b) - getRecommendationScore(a))[0] || null;
    const totalTrophies = games.reduce((sum, game) => sum + getTotal(game), 0);
    const totalRoadmaps = games.reduce((sum, game) => sum + getRoadmapCount(game), 0);

    if (catalogProofTarget) catalogProofTarget.textContent = formatHomeCatalogProof(games.length, totalTrophies, totalRoadmaps);

    const renderDiscoveryList = (target, items, emptyMessage) => {
      if (!target) return;
      if (!items.length) {
        target.innerHTML = `<div class="atlas-inline-empty">${emptyMessage}</div>`;
        return;
      }
      const showcaseItems = typeof sharedCatalog.selectHomeShowcaseGames === 'function'
        ? sharedCatalog.selectHomeShowcaseGames(items, 6)
        : items.slice(0, 6);
      target.innerHTML = showcaseItems.map(game => {
        const model = typeof sharedCard.buildStandardGameCardModel === 'function'
          ? sharedCard.buildStandardGameCardModel(game)
          : {
            slug: game.slug || '',
            name: game.name || 'Jogo',
            image: getGameCoverSrc ? getGameCoverSrc(game) : (game.cover_image || game.image || ''),
            difficulty: game.difficulty || '-',
            time: game.time || 'Tempo não informado',
            trophies: getTotal(game),
            hasRisk: hasRisk(game),
            difficultyTone: getDifficultyTone(game.difficulty),
            difficultyClass: getDifficultyToneClass(game.difficulty)
          };
        const slug = escapeAttribute(model.slug || '');
        return `
        <article class="atlas-card atlas-card--game atlas-card--standard atlas-discovery-card" data-difficulty-tone="${escapeAttribute(model.difficultyTone)}" data-risk="${model.hasRisk ? 'missable' : 'none'}">
          <div class="atlas-card__media atlas-discovery-card__media atlas-home-image-shell${model.image ? '' : ' atlas-home-image-shell--fallback-visible'}">
            ${renderHomeImage(model, 'atlas-card__image', { width: 600, height: 900, sizes: '(min-width: 1024px) 20vw, (min-width: 640px) 28vw, 42vw' })}
          </div>
          <div class="atlas-card__body">
            <div class="atlas-card__badges">${renderHomeEditorialBadge(model)}<span class="atlas-card__status atlas-badge atlas-badge--partial">Novo guia</span></div>
            <h3 class="atlas-card__title">${escapeHtml(model.name)}</h3>
            <div class="atlas-card__meta">
              <span class="atlas-meta-signal ${escapeAttribute(model.difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(String(model.difficulty))}/10</span>
              <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(model.time)}</span>
              <span class="atlas-meta-signal atlas-meta-signal--trophy"><i class="fas fa-trophy"></i>${escapeHtml(String(model.trophies))} troféus</span>
            </div>
            <div class="atlas-card__actions">
              <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-home-game="${escapeAttribute(model.name)}" data-open-guide-card="${slug}">Abrir guia</a>
            </div>
          </div>
        </article>`;
      }).join('');
    };

    const renderEditorialHistory = (target, items, emptyMessage) => {
      if (!target) return;
      if (!items.length) {
        target.innerHTML = `<div class="atlas-inline-empty">${emptyMessage}</div>`;
        return;
      }
      target.innerHTML = items.slice(0, 5).map(game => {
        const updatedLabel = formatDisplayDate(game.updated_at || game.created_at);
        const slug = escapeAttribute(game.slug || '');
        return `
        <article class="atlas-editorial-update">
          <time datetime="${escapeAttribute(game.updated_at || game.created_at || '')}">${escapeHtml(updatedLabel)}</time>
          <div class="atlas-editorial-update__body">
            <h3>${escapeHtml(game.name)}</h3>
            <p>${escapeHtml(getRevisionNote(game))}</p>
          </div>
          <a href="/jogo/${slug}" class="atlas-editorial-update__link" data-home-game="${escapeAttribute(game.name)}" data-open-guide-card="${slug}" aria-label="Abrir guia de ${escapeAttribute(game.name)}">
            <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
            <span>Abrir</span>
          </a>
        </article>`;
      }).join('');
    };

    if (featuredTarget) {
      const featuredSection = featuredTarget.closest('[data-home-featured-section]');
      if (!featuredGame) {
        featuredTarget.innerHTML = '';
        featuredSection?.classList.add('hidden');
      } else {
        featuredSection?.classList.remove('hidden');
        const model = typeof sharedCard.buildStandardGameCardModel === 'function'
          ? sharedCard.buildStandardGameCardModel(featuredGame)
          : {
            slug: featuredGame.slug || '',
            name: featuredGame.name || 'Jogo',
            image: getGameCoverSrc ? getGameCoverSrc(featuredGame) : (featuredGame.cover_image || featuredGame.image || ''),
            difficulty: featuredGame.difficulty || '-',
            time: featuredGame.time || 'Tempo não informado',
            trophies: getTotal(featuredGame),
            difficultyTone: getDifficultyTone(featuredGame.difficulty),
            difficultyClass: getDifficultyToneClass(featuredGame.difficulty)
          };
        const reason = getFeaturedReason(featuredGame);
        const slug = escapeAttribute(model.slug || '');
        featuredTarget.innerHTML = `
          <article class="atlas-card atlas-card--game atlas-card--featured atlas-featured-game" data-difficulty-tone="${escapeAttribute(model.difficultyTone)}">
            <div class="atlas-card__media atlas-featured-game__cover atlas-home-image-shell${model.image ? '' : ' atlas-home-image-shell--fallback-visible'}">
              ${renderHomeImage(model, 'atlas-card__image atlas-featured-game__image', { width: 600, height: 900, sizes: '(min-width: 1024px) 180px, 42vw' })}
            </div>
            <div class="atlas-card__body atlas-featured-game__body">
              <div class="atlas-card__badges">${renderHomeEditorialBadge(model)}</div>
              <h3 class="atlas-card__title">${escapeHtml(model.name)}</h3>
              <p class="atlas-card__reason">${escapeHtml(reason)}</p>
              <div class="atlas-card__meta atlas-featured-game__meta" aria-label="Resumo da recomendação">
                <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(model.time)}</span>
                <span class="atlas-meta-signal ${escapeAttribute(model.difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(String(model.difficulty))}/10</span>
                <span class="atlas-meta-signal atlas-meta-signal--trophy"><i class="fas fa-trophy"></i>${escapeHtml(String(model.trophies))} troféus</span>
              </div>
              <div class="atlas-card__actions">
                <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-featured-game__cta" data-home-game="${escapeAttribute(model.name)}" data-open-guide-card="${slug}"><i class="fas fa-book-open"></i>Abrir guia</a>
              </div>
            </div>
          </article>`;
      }
    }

    if (intentTarget) {
      const intentConfigs = typeof sharedCatalog.buildHomeIntentCardsModel === 'function'
        ? sharedCatalog.buildHomeIntentCardsModel(games)
        : [];

      const visibleIntentConfigs = intentConfigs.filter(item => Number(item.count || 0) > 0);
      if (!visibleIntentConfigs.length) {
        intentTarget.innerHTML = '<div class="atlas-inline-empty atlas-intent-empty">As faixas aparecem aqui quando houver jogos suficientes no catálogo.</div>';
      } else {
        intentTarget.innerHTML = visibleIntentConfigs.map(item => `
        <button type="button" class="atlas-intent-card atlas-intent-card--${escapeAttribute(item.tone)}" data-home-facet="${escapeAttribute(item.facet)}">
          <div class="atlas-intent-card__head">
            <span class="atlas-intent-card__label">${escapeHtml(item.tag)}</span>
            <i class="fas ${escapeAttribute(item.icon)}"></i>
          </div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.description)}</p>
          <span class="atlas-intent-card__meta">${escapeHtml(item.metric)}</span>
        </button>`).join('');
      }
    }

    renderDiscoveryList(recentTarget, byRecent, 'Nenhum guia recente disponível.');
    renderEditorialHistory(updatedTarget, byUpdated, 'Nenhuma revisão recente disponível.');
    maybeShowHomeUpdatePopup(games);
  }

  return { renderHomeOverview };
})();
