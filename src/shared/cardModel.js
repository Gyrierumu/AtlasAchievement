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

  function buildStandardGameCardModel(game = {}, options = {}) {
    const fallbackImage = options.fallbackImage || '';
    const difficulty = game?.difficulty || '-';
    const time = game?.time || 'Tempo não informado';
    const trophies = getTrophyTotal(game);
    const statusBadge = typeof editorial.getEditorialBadge === 'function'
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

        let badge = 'Ritmo parecido';
        let reason = 'Mantém dificuldade, checklist e tempo em uma faixa parecida para continuar sem mudar demais o ritmo.';
        if (diffGap <= 1 && currentHasTime && hasTime && timeGap <= 10) {
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
    buildGuideComparisonModel,
    deriveSteamLibraryCover,
    getGameCoverImage,
    isPlaceholderGameImage
  };
});
