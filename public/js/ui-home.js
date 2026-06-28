window.UIHome = (() => {
  const { qs, escapeHtml, escapeAttribute, getGameImageSrc, getGameCoverSrc } = window.UIShared;
  const { formatDisplayDate } = window.UIFormatters;
  const { hasMissableRiskText, getDifficultyTone, getDifficultyToneClass } = window.UIDecisionModels;
  const sharedCatalog = window.AtlasCatalogModel || {};
  const sharedCard = window.AtlasCardModel || {};
  const siteUpdates = window.AtlasSiteUpdates || {};
  let homePulseTimer = null;

  function renderHomeEditorialBadge(model = {}) {
    const badge = model.statusBadge || {};
    if (!badge.label) return '';
    return `<span class="atlas-editorial-badge atlas-editorial-badge--small atlas-editorial-badge--${escapeAttribute(badge.status || badge.badge || badge.tone || 'in_review')}" title="${escapeAttribute(badge.detail || '')}">${escapeHtml(badge.label)}</span>`;
  }

  function renderHomeImage(model = {}, imageClass = 'atlas-card__image', options = {}) {
    const name = model.name || 'Jogo';
    const source = model.image ? getGameImageSrc(model.image) : '';
    const alt = options.alt || `Capa de ${name}`;
    const width = options.width || 520;
    const height = options.height || 320;
    const sizes = options.sizes || '100vw';
    return `
      <span class="atlas-home-image-fallback" aria-hidden="true">${escapeHtml(name)}</span>
      ${source ? `<img src="${escapeAttribute(source)}" alt="${escapeAttribute(alt)}" class="${escapeAttribute(imageClass)}" loading="${escapeAttribute(options.loading || 'lazy')}" decoding="${escapeAttribute(options.decoding || 'async')}" width="${escapeAttribute(String(width))}" height="${escapeAttribute(String(height))}" sizes="${escapeAttribute(sizes)}" onerror="this.hidden=true;this.parentElement.classList.add('atlas-home-image-shell--fallback-visible');">` : ''}
    `;
  }

  function normalizeSlug(value = '') {
    return String(value || '').trim().toLowerCase();
  }

  function stripMarkdownHeadingPrefix(value = '') {
    return String(value || '').replace(/^\s{0,3}#{1,6}\s+/, '').trim();
  }

  function sanitizeHomeHeadings() {
    document.querySelectorAll('#view-home h1, #view-home h2, #view-home h3, #view-home h4').forEach(heading => {
      const cleanText = stripMarkdownHeadingPrefix(heading.textContent);
      if (cleanText !== heading.textContent.trim()) heading.textContent = cleanText;
    });
  }

  function isHomeRoute() {
    if (typeof window === 'undefined') return false;
    const path = window.location?.pathname || '/';
    return path === '/' || path === '/index.html';
  }

  function isGuideVerified(game = {}) {
    const reviewStatus = normalizeSlug(game.editorial_review_status || game.editorialReviewStatus || game.editorialStatus);
    const verificationStatus = normalizeSlug(game.verification_status || game.verificationStatus || game.qualityStatus);
    const coverage = normalizeSlug(game.coverage_level || game.coverageLevel);
    return (game.is_verified === true || verificationStatus === 'verified')
      && reviewStatus === 'verified'
      && (coverage === 'strong' || coverage === 'complete');
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getGameTotal(game = {}) {
    const total = typeof sharedCatalog.getGameTotal === 'function'
      ? sharedCatalog.getGameTotal(game)
      : (game.trophy_count || game.trophies?.length || 0);
    return toNumber(total, 0);
  }

  function getRoadmapTotal(game = {}) {
    const total = typeof sharedCatalog.getRoadmapCount === 'function'
      ? sharedCatalog.getRoadmapCount(game)
      : (game.roadmap_count || game.roadmap?.length || 0);
    return toNumber(total, 0);
  }

  function isShortPlatinum(game = {}) {
    const bucket = normalizeSlug(game.time_bucket || game.timeBucket);
    const hours = toNumber(game.time_sort_hours || game.timeMinHours || game.time_min_hours, 0);
    return bucket === 'short' || (hours > 0 && hours <= 30);
  }

  function hasNoOnlineRequirement(game = {}) {
    const onlineFlags = [
      game.onlineRequired,
      game.online_required,
      game.requiresOnline,
      game.requires_online,
      game.is_online
    ];
    const hasExplicitOfflineFlag = onlineFlags.some(value => value === false);
    return hasExplicitOfflineFlag
      && onlineFlags.every(value => value !== true)
      && toNumber(game.online_trophy_count || game.onlineTrophies, 0) === 0;
  }

  function getHomeGuideSignal(game = {}) {
    if (isGuideVerified(game)) return 'Verificado recentemente';
    if (hasNoOnlineRequirement(game)) return 'Sem online';
    if (isShortPlatinum(game)) return 'Platina curta';
    return 'Boa escolha para começar';
  }

  function renderHomeCatalogProof(target, gamesCount = 0, totalTrophies = 0, totalRoadmaps = 0, fallbackText = '') {
    if (!target) return;
    if (!Number(gamesCount || 0) && !Number(totalTrophies || 0) && !Number(totalRoadmaps || 0)) {
      target.textContent = fallbackText || 'Guias de platina com roadmap, checklist e progresso para acompanhar sua próxima run.';
      return;
    }
    const stats = [
      { icon: 'fa-gamepad', value: gamesCount, label: gamesCount === 1 ? 'guia no catálogo' : 'guias no catálogo' },
      { icon: 'fa-trophy', value: totalTrophies, label: 'troféus mapeados' },
      { icon: 'fa-route', value: totalRoadmaps, label: 'etapas de roadmap' }
    ];
    target.setAttribute('aria-label', fallbackText || `${gamesCount} jogos mapeados, ${totalTrophies} troféus e ${totalRoadmaps} etapas de roadmap`);
    target.innerHTML = stats.map(stat => `
      <span class="atlas-home-proof__item">
        <i class="fas ${escapeAttribute(stat.icon)}" aria-hidden="true"></i>
        <strong>${escapeHtml(String(stat.value))}</strong>
        <span>${escapeHtml(stat.label)}</span>
      </span>`).join('');
  }

  function renderHomeSearchChips(games = []) {
    const target = qs('#homeSearchChips');
    if (!target) return;
    const gamesBySlug = new Map((Array.isArray(games) ? games : []).map(game => [normalizeSlug(game.slug), game]));
    const preferredSlugs = [
      'astro-bot',
      'hades',
      'elden-ring',
      'resident-evil-4-remake',
      'resident-evil-2-remake',
      'star-wars-jedi-survivor'
    ];
    const preferredGames = preferredSlugs.map(slug => gamesBySlug.get(slug)).filter(Boolean);
    const fallbackGames = (Array.isArray(games) ? games : []).filter(game => game?.slug && !preferredSlugs.includes(normalizeSlug(game.slug)));
    const chipGames = [...preferredGames, ...fallbackGames].slice(0, 4);
    if (!chipGames.length) {
      target.innerHTML = '';
      return;
    }
    target.innerHTML = chipGames.map(game => {
      const slug = escapeAttribute(game.slug || '');
      const name = stripMarkdownHeadingPrefix(game.name || 'Jogo');
      return `
        <a href="/jogo/${slug}" class="atlas-home-search-chip" data-home-game="${escapeAttribute(name)}" data-open-guide-card="${slug}" aria-label="Abrir guia de ${escapeAttribute(name)}">
          <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
          <span>${escapeHtml(name)}</span>
        </a>`;
    }).join('');
  }

  function hydrateHomePulse(games = []) {
    const pulse = qs('[data-home-pulse]');
    const message = pulse?.querySelector('[data-home-pulse-message]');
    if (!pulse || !message) return;
    if (homePulseTimer) {
      window.clearInterval(homePulseTimer);
      homePulseTimer = null;
    }

    const verifiedCount = games.filter(isGuideVerified).length;
    const shortCount = games.filter(isShortPlatinum).length;
    const noOnlineCount = games.filter(hasNoOnlineRequirement).length;
    const messages = [
      verifiedCount ? `${verifiedCount} guias verificados para escolher com mais confiança.` : '',
      noOnlineCount ? `${noOnlineCount} platinas sem online obrigatório no catálogo.` : '',
      shortCount ? `${shortCount} opções curtas para encaixar na próxima sessão.` : '',
      'Roadmap, checklist e alertas de risco ficam juntos no mesmo fluxo.'
    ].filter(Boolean);
    const uniqueMessages = [...new Set(messages)];
    message.textContent = uniqueMessages[0] || message.textContent;

    const prefersReducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || uniqueMessages.length < 2) return;

    let index = 0;
    homePulseTimer = window.setInterval(() => {
      index = (index + 1) % uniqueMessages.length;
      pulse.classList.add('is-switching');
      window.setTimeout(() => {
        message.textContent = uniqueMessages[index];
        pulse.classList.remove('is-switching');
      }, 180);
    }, 6500);
  }

  function selectEditorialSpotlight(games = []) {
    return [...(Array.isArray(games) ? games : [])]
      .filter(game => game?.slug && game?.name)
      .sort((a, b) => {
        const score = game => (isGuideVerified(game) ? 40 : 0)
          + (hasNoOnlineRequirement(game) ? 20 : 0)
          + (isShortPlatinum(game) ? 15 : 0)
          + Math.min(getRoadmapTotal(game), 10);
        const scoreDelta = score(b) - score(a);
        if (scoreDelta) return scoreDelta;
        return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''));
      })[0] || null;
  }

  function renderHomeEditorialSpotlight(games = []) {
    const target = qs('#homeEditorialSpotlight');
    if (!target) return;
    const game = selectEditorialSpotlight(games);
    if (!game) {
      target.innerHTML = '<div class="atlas-inline-empty">O destaque aparece aqui quando houver guias suficientes no catálogo.</div>';
      return;
    }
    const model = typeof sharedCard.buildStandardGameCardModel === 'function'
      ? sharedCard.buildStandardGameCardModel(game)
      : {
        slug: game.slug || '',
        name: game.name || 'Jogo',
        image: getGameCoverSrc ? getGameCoverSrc(game) : (game.cover_image || game.image || ''),
        difficulty: game.difficulty || '-',
        time: game.time || 'Tempo não informado',
        trophies: getGameTotal(game)
      };
    const slug = escapeAttribute(model.slug || '');
    const signal = getHomeGuideSignal(game);
    const metaItems = [
      model.time ? `<span><i class="fas fa-clock" aria-hidden="true"></i>${escapeHtml(model.time)}</span>` : '',
      model.difficulty ? `<span><i class="fas fa-gauge-high" aria-hidden="true"></i>${escapeHtml(String(model.difficulty))}/10</span>` : '',
      `<span><i class="fas fa-trophy" aria-hidden="true"></i>${escapeHtml(String(model.trophies || getGameTotal(game)))} troféus</span>`
    ].filter(Boolean).join('');
    const reason = isGuideVerified(game)
      ? 'Status editorial verificado no catálogo, com rota e checklist prontos para consulta.'
      : hasNoOnlineRequirement(game)
        ? 'Platina marcada sem online obrigatório nos dados do guia.'
        : 'Boa opção para comparar tempo, dificuldade e riscos antes de começar.';
    target.innerHTML = `
      <article class="atlas-home-spotlight-card">
        <div class="atlas-home-spotlight-card__media atlas-home-image-shell${model.image ? '' : ' atlas-home-image-shell--fallback-visible'}">
          ${renderHomeImage(model, 'atlas-home-spotlight-card__image', { width: 260, height: 360, sizes: '(min-width: 768px) 120px, 88px' })}
        </div>
        <div class="atlas-home-spotlight-card__body">
          <span class="atlas-home-spotlight-card__badge">${escapeHtml(signal)}</span>
          <h3>${escapeHtml(stripMarkdownHeadingPrefix(model.name))}</h3>
          <p>${escapeHtml(reason)}</p>
          <div class="atlas-home-spotlight-card__meta">${metaItems}</div>
        </div>
        <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-home-spotlight-card__cta" data-home-game="${escapeAttribute(model.name)}" data-open-guide-card="${slug}">
          <span>Abrir guia</span>
          <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
        </a>
      </article>`;
  }

  function resolveUpdateItems(items = [], gamesBySlug = new Map()) {
    return items.map(item => {
      const slug = normalizeSlug(item.slug);
      const game = gamesBySlug.get(slug);
      if (!slug || !item.href) return null;
      return {
        ...item,
        slug,
        label: item.label || game?.name || slug,
        verified: typeof item.verified === 'boolean' ? item.verified : (game ? isGuideVerified(game) : false)
      };
    }).filter(Boolean);
  }

  function trackUpdateBanner(eventName, params = {}) {
    if (!eventName || typeof window === 'undefined') return;
    window.AtlasAnalytics?.trackEvent?.(eventName, {
      campaign_id: siteUpdates.activeHomeUpdate?.id || '',
      ...params
    });
  }

  function renderHomeUpdateBanner(games = []) {
    const update = siteUpdates.activeHomeUpdate;
    const homeView = qs('#view-home');
    const existing = document.querySelector('[data-home-update-banner]');
    if (!update?.active || !isHomeRoute() || !homeView || homeView.classList.contains('hidden')) {
      existing?.remove();
      return;
    }

    const gamesBySlug = new Map((Array.isArray(games) ? games : []).map(game => [normalizeSlug(game.slug), game]));
    const requiredCatalogSlug = normalizeSlug(update.requiredCatalogSlug || update.sections?.[0]?.items?.[0]?.slug || '');
    if (requiredCatalogSlug && !gamesBySlug.has(requiredCatalogSlug)) {
      existing?.remove();
      return;
    }

    const sections = (Array.isArray(update.sections) ? update.sections : []).map(section => {
      const items = resolveUpdateItems(section.items || [], gamesBySlug);
      if (!items.length) return null;
      const displayItems = section.requiresVerifiedStatus ? items.filter(item => item.verified) : items;
      if (!displayItems.length) return null;
      const allVerified = !section.requiresVerifiedStatus || displayItems.every(item => item.verified);
      return {
        ...section,
        title: section.requiresVerifiedStatus && !allVerified ? (section.fallbackTitle || 'Guias revisados recentemente') : section.title,
        allVerified,
        items: displayItems
      };
    }).filter(Boolean);

    const firstSection = sections[0];
    const featuredItem = firstSection?.items?.[0];
    if (!featuredItem || (requiredCatalogSlug && !sections.some(section => section.items.some(item => item.slug === requiredCatalogSlug)))) {
      existing?.remove();
      return;
    }

    const isNewGuide = /novo/i.test(firstSection.title || '');
    const bannerText = isNewGuide
      ? `Novidade da semana: ${featuredItem.label} foi adicionado ao catálogo.`
      : `Novidade da semana: o guia de ${featuredItem.label} recebeu revisão editorial.`;
    const banner = existing || document.createElement('aside');
    banner.className = 'atlas-update-banner';
    banner.dataset.homeUpdateBanner = update.id || 'home-update';
    banner.setAttribute('aria-label', 'Novidade da semana');
    banner.innerHTML = `
      <div class="atlas-update-banner__icon" aria-hidden="true"><i class="fas fa-star"></i></div>
      <div class="atlas-update-banner__copy">
        <span class="atlas-update-banner__badge">Novidade</span>
        <p>${escapeHtml(bannerText)}</p>
      </div>
      <div class="atlas-update-banner__actions">
        <a href="${escapeAttribute(featuredItem.href)}" class="atlas-update-banner__link" data-update-banner-game="${escapeAttribute(featuredItem.slug)}" data-home-game="${escapeAttribute(featuredItem.label)}" data-open-guide-card="${escapeAttribute(featuredItem.slug)}">Ver guia</a>
        <a href="${escapeAttribute(update.primaryCta?.href || '/catalogo')}" class="atlas-update-banner__link atlas-update-banner__link--muted" data-update-banner-catalog data-view-link="catalog">Ver catálogo</a>
      </div>`;

    if (!existing) {
      const hero = homeView.querySelector('.atlas-home-hero');
      hero?.insertAdjacentElement('afterend', banner);
      banner.addEventListener('click', event => {
        const gameLink = event.target.closest('[data-update-banner-game]');
        if (gameLink) {
          trackUpdateBanner('update_popup_game_click', {
            game_slug: gameLink.dataset.updateBannerGame || '',
            href: gameLink.getAttribute('href') || ''
          });
          return;
        }
        const catalogLink = event.target.closest('[data-update-banner-catalog]');
        if (catalogLink) {
          trackUpdateBanner('update_popup_primary_cta_click', { href: catalogLink.getAttribute('href') || '' });
        }
      });
      trackUpdateBanner('update_popup_view', { presentation: 'inline_banner' });
    }
  }

  function renderHomeOverview(games = []) {
    sanitizeHomeHeadings();
    const recentTarget = qs('#recentGamesOverview');
    const updatedTarget = qs('#updatedGamesOverview');
    const intentTarget = qs('#intentOverview');
    const catalogProofTarget = qs('#homeCatalogProofText');

    const getTotal = sharedCatalog.getGameTotal || (game => Number(game.trophy_count || game.trophies?.length || 0));
    const getRoadmapCount = sharedCatalog.getRoadmapCount || (game => Number(game.roadmap_count || game.roadmap?.length || 0));
    const hasRisk = sharedCatalog.hasGuideRisk || (game => Number(game.missable_count || 0) > 0 || hasMissableRiskText(game.missable || game.missable_summary || ''));
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
    const totalTrophies = games.reduce((sum, game) => sum + getTotal(game), 0);
    const totalRoadmaps = games.reduce((sum, game) => sum + getRoadmapCount(game), 0);

    renderHomeCatalogProof(catalogProofTarget, games.length, totalTrophies, totalRoadmaps, formatHomeCatalogProof(games.length, totalTrophies, totalRoadmaps));
    renderHomeSearchChips(games);
    hydrateHomePulse(games);
    renderHomeEditorialSpotlight(games);

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
            <div class="atlas-card__badges">${renderHomeEditorialBadge(model)}<span class="atlas-card__status atlas-badge atlas-badge--partial">${escapeHtml(getHomeGuideSignal(game))}</span></div>
            <h3 class="atlas-card__title">${escapeHtml(stripMarkdownHeadingPrefix(model.name))}</h3>
            <p class="atlas-card__reason">${escapeHtml(getFeaturedReason(game))}</p>
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
        const revisionBadges = [
          '<span class="atlas-editorial-update__badge">Revisão recente</span>',
          isGuideVerified(game) ? '<span class="atlas-editorial-update__badge atlas-editorial-update__badge--verified">Verificado</span>' : '',
          hasNoOnlineRequirement(game) ? '<span class="atlas-editorial-update__badge atlas-editorial-update__badge--soft">Sem online</span>' : ''
        ].filter(Boolean).join('');
        return `
        <article class="atlas-editorial-update">
          <time datetime="${escapeAttribute(game.updated_at || game.created_at || '')}">${escapeHtml(updatedLabel)}</time>
          <div class="atlas-editorial-update__body">
            <h3>${escapeHtml(stripMarkdownHeadingPrefix(game.name))}</h3>
            <div class="atlas-editorial-update__badges">${revisionBadges}</div>
            <p>${escapeHtml(getRevisionNote(game))}</p>
          </div>
          <a href="/jogo/${slug}" class="atlas-editorial-update__link" data-home-game="${escapeAttribute(game.name)}" data-open-guide-card="${slug}" aria-label="Abrir guia de ${escapeAttribute(game.name)}">
            <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
            <span>Abrir</span>
          </a>
        </article>`;
      }).join('');
    };

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
          <strong>${escapeHtml(stripMarkdownHeadingPrefix(item.title))}</strong>
          <p>${escapeHtml(item.description)}</p>
          <span class="atlas-intent-card__meta">${escapeHtml(item.metric)}</span>
        </button>`).join('');
      }
    }

    renderDiscoveryList(recentTarget, byRecent, 'Nenhum guia recente disponível.');
    renderEditorialHistory(updatedTarget, byUpdated, 'Nenhuma revisão recente disponível.');
    sanitizeHomeHeadings();
    renderHomeUpdateBanner(games);
  }

  return { renderHomeOverview };
})();
