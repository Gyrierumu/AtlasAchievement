(function attachCardModel(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./editorialModel'));
    return;
  }
  if (root) root.AtlasCardModel = factory(root.AtlasEditorialModel);
})(typeof globalThis !== 'undefined' ? globalThis : this, function cardModelFactory(editorial = {}) {
  const FALLBACK_TIME_VALUE = editorial.FALLBACK_TIME_VALUE || Number.MAX_SAFE_INTEGER;
  const getTimeValue = editorial.getTimeValue || (() => FALLBACK_TIME_VALUE);
  const getDifficultyTone = editorial.getDifficultyTone || (() => 'unknown');
  const getDifficultyToneClass = editorial.getDifficultyToneClass || (() => 'atlas-meta-signal--difficulty-unknown');
  const hasMissableRiskText = editorial.hasMissableRiskText || (() => false);

  function truncateText(value = '', maxLength = 96) {
    const text = String(value || '').trim();
    if (!text || text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  }

  function isPlaceholderGameImage(value = '') {
    const text = String(value || '').trim();
    return !text || /(^|\/)og-default\.svg(?:[?#].*)?$/i.test(text);
  }

  function deriveSteamLibraryCover(value = '') {
    const source = String(value || '').trim();
    if (!source || !/\/steam\/apps\/\d+\//i.test(source)) return '';
    const derived = source.replace(/\/(?:header|capsule_616x353)\.jpg([?#].*)?$/i, '/library_600x900.jpg$1');
    return derived !== source ? derived : '';
  }

  function getGameCoverImage(game = {}, options = {}) {
    const explicitCover = String(game?.cover_image || '').trim();
    if (!isPlaceholderGameImage(explicitCover)) return explicitCover;

    const fallbackImage = String(options.fallbackImage || '').trim();
    const bannerImage = String(game?.image || '').trim();
    const derivedCover = deriveSteamLibraryCover(bannerImage);
    if (derivedCover && derivedCover !== bannerImage) return derivedCover;
    if (options.allowBannerFallback === false || isPlaceholderGameImage(bannerImage)) return fallbackImage;
    return bannerImage || fallbackImage;
  }

  function getTrophyTotal(game = {}) {
    return Number(game?.trophy_count || game?.trophies?.length || 0);
  }

  function hasGuideRisk(game = {}) {
    return Number(game?.missable_count || 0) > 0 || hasMissableRiskText(game?.missable || game?.missable_summary || '');
  }

  function hasKnownTimeValue(value) {
    return Number.isFinite(value) && value !== FALLBACK_TIME_VALUE;
  }

  const FRANCHISE_GUIDE_CONFIGS = {
    'resident-evil': {
      key: 'resident-evil',
      name: 'Resident Evil',
      minRelatedGuides: 2,
      slugs: [
        'resident-evil',
        'resident-evil-2-remake',
        'resident-evil-3-remake',
        'resident-evil-4-remake',
        'resident-evil-5',
        'resident-evil-6',
        'resident-evil-7-biohazard',
        'resident-evil-village',
        'resident-evil-requiem'
      ]
    }
  };

  const FRANCHISE_BY_SLUG = Object.values(FRANCHISE_GUIDE_CONFIGS).reduce((map, config) => {
    config.slugs.forEach((slug, index) => {
      map[String(slug || '').trim().toLowerCase()] = { config, rank: index + 1 };
    });
    return map;
  }, {});

  function normalizeFranchiseKey(value = '') {
    const key = String(value || '').trim().toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!key) return '';
    const directConfig = FRANCHISE_GUIDE_CONFIGS[key];
    if (directConfig) return directConfig.key;
    const namedConfig = Object.values(FRANCHISE_GUIDE_CONFIGS)
      .find(config => normalizeFranchiseKey(config.name) === key);
    return namedConfig?.key || key;
  }

  function getGuideFranchiseConfig(game = {}) {
    const explicitKey = normalizeFranchiseKey(game?.franchise || game?.series || game?.franchiseKey);
    if (explicitKey && FRANCHISE_GUIDE_CONFIGS[explicitKey]) return FRANCHISE_GUIDE_CONFIGS[explicitKey];
    return FRANCHISE_BY_SLUG[String(game?.slug || '').trim().toLowerCase()]?.config || null;
  }

  function getGuideFranchiseRank(game = {}) {
    const slug = String(game?.slug || '').trim().toLowerCase();
    const configured = FRANCHISE_BY_SLUG[slug];
    if (configured) return configured.rank;
    const config = getGuideFranchiseConfig(game);
    const index = config?.slugs?.indexOf(slug) ?? -1;
    return index >= 0 ? index + 1 : 999;
  }

  function isPublicFranchiseGuide(game = {}) {
    const verificationStatus = String(game?.verification_status || game?.verificationStatus || '').trim().toLowerCase();
    const editorialReviewStatus = String(game?.editorial_review_status || game?.editorialReviewStatus || game?.editorialStatus || '').trim().toLowerCase();
    const editorialStatus = String(game?.editorial_status || game?.editorialStatus || '').trim().toLowerCase();
    const coverage = String(game?.coverage_level || game?.coverageLevel || '').trim().toLowerCase();
    const verified = game?.is_verified === true || game?.is_verified === 1 || verificationStatus === 'verified';
    const published = !editorialStatus || editorialStatus === 'published' || editorialStatus === 'verified';
    const reviewed = !editorialReviewStatus || editorialReviewStatus === 'verified';
    const completeEnough = !coverage || coverage === 'strong' || coverage === 'complete';
    return Boolean(game?.slug) && verified && published && reviewed && completeEnough;
  }

  function getFranchiseRelatedReason(candidate = {}, currentGame = {}) {
    const config = getGuideFranchiseConfig(candidate) || getGuideFranchiseConfig(currentGame);
    if (!config) return 'Guia da mesma franquia para continuar em uma lista próxima sem sair do mesmo universo.';
    const candidateSlug = String(candidate?.slug || '').trim().toLowerCase();
    const currentSlug = String(currentGame?.slug || '').trim().toLowerCase();
    if (config.key === 'resident-evil' && candidateSlug === 'resident-evil-5') {
      return 'Resident Evil 5 — guia de troféus PS4 com platina base, DLCs separadas e 100% da lista completa.';
    }
    if (config.key === 'resident-evil' && currentSlug === 'resident-evil-5') {
      return 'Outro guia da franquia Resident Evil para comparar roadmap, escopo da platina e ritmo de cleanup.';
    }
    return `Guia relacionado da franquia ${config.name} para continuar por uma lista próxima sem sair do mesmo universo.`;
  }

  function buildRelatedFranchiseGuides(currentGame, pool = [], options = {}) {
    const config = getGuideFranchiseConfig({ ...currentGame, franchise: options.franchise || currentGame?.franchise });
    if (!config || !currentGame?.slug) return [];
    const currentSlug = String(currentGame.slug || '').trim().toLowerCase();
    const minRelatedGuides = Number(options.minRelatedGuides || config.minRelatedGuides || 2);
    const limit = Number(options.limit || 4);
    const related = (Array.isArray(pool) ? pool : [])
      .filter(game => game && String(game.slug || '').trim().toLowerCase() !== currentSlug)
      .filter(game => getGuideFranchiseConfig(game)?.key === config.key)
      .filter(isPublicFranchiseGuide)
      .sort((a, b) => getGuideFranchiseRank(a) - getGuideFranchiseRank(b) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
    if (related.length < minRelatedGuides) return [];
    return related.slice(0, Math.max(0, limit)).map(game => ({
      game,
      badge: `Franquia ${config.name}`,
      reason: getFranchiseRelatedReason(game, currentGame)
    }));
  }

  function buildStandardGameCardModel(game = {}, options = {}) {
    const fallbackImage = options.fallbackImage || '';
    const difficulty = game?.difficulty || '-';
    const time = game?.time || 'Tempo não informado';
    const trophies = getTrophyTotal(game);
    const statusBadge = typeof editorial.getEditorialTrustBadge === 'function'
      ? editorial.getEditorialTrustBadge(game)
      : typeof editorial.getEditorialBadge === 'function'
        ? editorial.getEditorialBadge(game)
      : { label: 'Guia parcial', tone: 'partial', badge: 'partial', detail: 'Cobertura parcial, use como ponto de partida.' };

    return {
      game,
      slug: game?.slug || '',
      name: game?.name || 'Jogo',
      image: getGameCoverImage(game, { fallbackImage }),
      coverImage: getGameCoverImage(game, { fallbackImage }),
      bannerImage: game?.image || '',
      difficulty,
      time,
      trophies,
      statusBadge,
      hasRisk: hasGuideRisk(game),
      difficultyTone: getDifficultyTone(difficulty),
      difficultyClass: getDifficultyToneClass(difficulty)
    };
  }

  function buildCompactGuideCardModel(item = {}, options = {}) {
    const game = item?.game || item || {};
    const reason = item?.reason || options.reason || 'Boa continuação para manter o ritmo de platina.';
    const difficulty = String(game?.difficulty || '-');
    const time = game?.time || 'Tempo não informado';
    return {
      game,
      slug: game?.slug || '',
      name: game?.name || 'Jogo',
      reason,
      shortReason: truncateText(reason, options.reasonLength || 96),
      difficulty,
      time,
      trophies: getTrophyTotal(game),
      hasRisk: hasGuideRisk(game),
      difficultyTone: getDifficultyTone(game?.difficulty),
      difficultyClass: getDifficultyToneClass(game?.difficulty)
    };
  }

  function buildRelatedGames(currentGame, pool = [], limit = 4) {
    if (!currentGame) return [];
    const currentSlug = currentGame.slug || '';
    const currentTrophies = getTrophyTotal(currentGame);
    const currentDifficulty = Number(currentGame.difficulty || 0);
    const currentTime = getTimeValue(currentGame);
    const currentHasTime = hasKnownTimeValue(currentTime);

    return (Array.isArray(pool) ? pool : [])
      .filter(game => game && (game.slug || '') !== currentSlug)
      .map(game => {
        const trophyCount = getTrophyTotal(game);
        const difficulty = Number(game.difficulty || 0);
        const timeValue = getTimeValue(game);
        const hasTime = hasKnownTimeValue(timeValue);
        const roadmapCount = Number(game.roadmap_count || game.roadmap?.length || 0);
        const diffGap = Math.abs(difficulty - currentDifficulty);
        const timeGap = currentHasTime && hasTime ? Math.abs(timeValue - currentTime) : 999;
        const trophyGap = Math.abs(trophyCount - currentTrophies);
        let score = 100;
        score -= diffGap * 12;
        score -= Math.min(timeGap, 120) * 0.8;
        score -= Math.min(trophyGap, 80) * 0.45;
        if (roadmapCount > 0) score += 12;
        if (difficulty <= currentDifficulty + 1) score += 6;
        const currentFranchise = getGuideFranchiseConfig(currentGame);
        const candidateFranchise = getGuideFranchiseConfig(game);
        const sameFranchise = Boolean(currentFranchise?.key && currentFranchise.key === candidateFranchise?.key);
        if (sameFranchise) {
          const rankGap = Math.abs(getGuideFranchiseRank(currentGame) - getGuideFranchiseRank(game));
          score += 160 - Math.min(rankGap, 8) * 4;
          if (String(game.slug || '').trim().toLowerCase() === 'resident-evil-5') score += 18;
        }

        let badge = 'Ritmo parecido';
        let reason = 'Mantém dificuldade, checklist e tempo em uma faixa parecida para continuar sem mudar demais o ritmo.';
        if (sameFranchise) {
          badge = `Franquia ${candidateFranchise.name}`;
          reason = getFranchiseRelatedReason(game, currentGame);
        } else if (diffGap <= 1 && currentHasTime && hasTime && timeGap <= 10) {
          badge = 'Próximo jogo ideal';
          reason = 'Muito próximo em dificuldade e duração. Boa sequência para manter o mesmo tipo de projeto.';
        } else if (difficulty < currentDifficulty && currentHasTime && hasTime && timeValue <= currentTime) {
          badge = 'Descanso entre projetos';
          reason = 'Mais leve para alternar depois de um guia exigente sem perder o hábito de fechar troféus.';
        } else if (trophyCount > currentTrophies) {
          badge = 'Próximo passo mais denso';
          reason = 'Boa escolha para subir um pouco a densidade do checklist depois deste jogo.';
        }

        return { game, score, badge, reason };
      })
      .sort((a, b) => b.score - a.score || String(a.game?.name || '').localeCompare(String(b.game?.name || ''), 'pt-BR'))
      .slice(0, limit);
  }

  function buildGuideComparisonModel(currentGame, relatedGames = []) {
    const currentTrophyCount = getTrophyTotal(currentGame);
    const currentRoadmapCount = Number(currentGame?.roadmap_count || currentGame?.roadmap?.length || 0);
    const currentDifficulty = Number(currentGame?.difficulty || 0);
    const currentTime = getTimeValue(currentGame);
    const currentHasTime = hasKnownTimeValue(currentTime);

    const rows = (Array.isArray(relatedGames) ? relatedGames : []).slice(0, 3).map((entry, index) => {
      const game = entry?.game || entry || {};
      const trophyCount = getTrophyTotal(game);
      const roadmapCount = Number(game?.roadmap_count || game?.roadmap?.length || 0);
      const difficulty = Number(game?.difficulty || 0);
      const timeValue = getTimeValue(game);
      const hasTime = hasKnownTimeValue(timeValue);
      const diffGap = difficulty - currentDifficulty;
      const timeGap = currentHasTime && hasTime ? timeValue - currentTime : 0;
      const trophyGap = trophyCount - currentTrophyCount;

      let trackLabel = 'Ritmo parecido';
      let trackDetail = 'Mantém uma faixa próxima de esforço e duração.';
      if (diffGap <= -1 && timeGap <= 0) {
        trackLabel = 'Mais leve que o atual';
        trackDetail = 'Bom para descansar entre projetos sem sair do ritmo.';
      } else if (diffGap >= 1 || trophyGap >= 12 || timeGap >= 12) {
        trackLabel = 'Passo acima';
        trackDetail = 'Sobe densidade, duração ou exigência para quem quer evoluir o desafio.';
      }

      return {
        slug: game?.slug || '',
        name: game?.name || 'Jogo',
        difficulty: String(game?.difficulty || '-'),
        time: game?.time || 'Tempo não informado',
        trophies: trophyCount,
        roadmap: roadmapCount,
        badge: entry?.badge || `Sugestão ${index + 1}`,
        reason: entry?.reason || 'Boa continuação para manter a consistência.',
        trackLabel,
        trackDetail
      };
    });

    return {
      baseline: {
        name: currentGame?.name || 'Jogo atual',
        difficulty: String(currentGame?.difficulty || '-'),
        time: currentGame?.time || 'Tempo não informado',
        trophies: currentTrophyCount,
        roadmap: currentRoadmapCount
      },
      lead: rows[0] || null,
      rows
    };
  }

  return {
    truncateText,
    getTrophyTotal,
    hasGuideRisk,
    buildStandardGameCardModel,
    buildCompactGuideCardModel,
    buildRelatedGames,
    buildRelatedFranchiseGuides,
    getGuideFranchiseConfig,
    buildGuideComparisonModel,
    deriveSteamLibraryCover,
    getGameCoverImage,
    isPlaceholderGameImage
  };
});
