window.GuidePresenter = (() => {
  const sharedEditorial = window.AtlasEditorialModel || {};
  const sharedCard = window.AtlasCardModel || {};
  const FALLBACK_TIME_VALUE = sharedEditorial.FALLBACK_TIME_VALUE || Number.MAX_SAFE_INTEGER;

  function getGameTimeValue(game = {}) {
    if (typeof sharedEditorial.getTimeValue === 'function') {
      return sharedEditorial.getTimeValue(game);
    }
    const value = String(game?.time || '').toLowerCase();
    const numbers = value.match(/\d+/g);
    if (!numbers?.length) return FALLBACK_TIME_VALUE;
    const numeric = numbers.map(Number).filter(Number.isFinite);
    return numeric.length ? Math.max(...numeric) : FALLBACK_TIME_VALUE;
  }

  function hasKnownTimeValue(value) {
    return Number.isFinite(value) && value !== FALLBACK_TIME_VALUE;
  }

  function buildRelatedGames(currentGame, pool = [], options = {}) {
    const limit = Number(options.limit || 4);
    const getSlug = typeof options.getSlug === 'function'
      ? options.getSlug
      : (game => game?.slug || '');

    if (!currentGame) return [];
    if (typeof sharedCard.buildRelatedGames === 'function') {
      const normalize = game => ({ ...game, slug: getSlug(game) || game?.slug || '' });
      return sharedCard.buildRelatedGames(normalize(currentGame), (Array.isArray(pool) ? pool : []).map(normalize), limit);
    }
    const currentSlug = getSlug(currentGame);
    const currentTrophies = Number(currentGame.trophy_count || currentGame.trophies?.length || 0);
    const currentDifficulty = Number(currentGame.difficulty || 0);
    const currentTime = getGameTimeValue(currentGame);
    const currentHasTime = hasKnownTimeValue(currentTime);

    const candidates = (Array.isArray(pool) ? pool : [])
      .filter(game => game && getSlug(game) !== currentSlug)
      .map(game => {
        const trophyCount = Number(game.trophy_count || game.trophies?.length || 0);
        const difficulty = Number(game.difficulty || 0);
        const timeValue = getGameTimeValue(game);
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
      .sort((a, b) => b.score - a.score || String(a.game.name || '').localeCompare(String(b.game.name || ''), 'pt-BR'));

    return candidates.slice(0, limit);
  }


  function buildGuideComparisonModel(currentGame, relatedGames = []) {
    if (typeof sharedCard.buildGuideComparisonModel === 'function') {
      return sharedCard.buildGuideComparisonModel(currentGame, relatedGames);
    }
    const currentTrophyCount = Number(currentGame?.trophy_count || currentGame?.trophies?.length || 0);
    const currentRoadmapCount = Number(currentGame?.roadmap_count || currentGame?.roadmap?.length || 0);
    const currentDifficulty = Number(currentGame?.difficulty || 0);
    const currentTime = getGameTimeValue(currentGame);
    const currentHasTime = hasKnownTimeValue(currentTime);

    const rows = (Array.isArray(relatedGames) ? relatedGames : []).slice(0, 3).map((entry, index) => {
      const game = entry?.game || entry || {};
      const trophyCount = Number(game?.trophy_count || game?.trophies?.length || 0);
      const roadmapCount = Number(game?.roadmap_count || game?.roadmap?.length || 0);
      const difficulty = Number(game?.difficulty || 0);
      const timeValue = getGameTimeValue(game);
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

    const lead = rows[0] || null;
    const baseline = {
      name: currentGame?.name || 'Jogo atual',
      difficulty: String(currentGame?.difficulty || '-'),
      time: currentGame?.time || 'Tempo não informado',
      trophies: currentTrophyCount,
      roadmap: currentRoadmapCount
    };

    return {
      baseline,
      lead,
      rows
    };
  }

  function buildGuideRenderModel(currentGame, library = {}, availableGames = [], options = {}) {
    const getSlug = typeof options.getSlug === 'function'
      ? options.getSlug
      : (game => game?.slug || '');
    const normalizeLibraryEntry = typeof options.normalizeLibraryEntry === 'function'
      ? options.normalizeLibraryEntry
      : (game => game);

    if (!currentGame) return null;
    const libraryKey = getSlug(currentGame);
    const fallbackEntry = normalizeLibraryEntry(currentGame, { completed: [] });
    const libraryEntry = library?.[libraryKey] || fallbackEntry;
    const relatedGames = buildRelatedGames(currentGame, availableGames, { getSlug, limit: options.limit || 4 });
    const comparisonModel = buildGuideComparisonModel(currentGame, relatedGames);

    return {
      libraryKey,
      libraryEntry,
      relatedGames,
      comparisonModel,
      completedTrophies: Array.isArray(libraryEntry.completed) ? libraryEntry.completed : [],
      isSaved: Boolean(library?.[libraryKey])
    };
  }

  return {
    getGameTimeValue,
    buildRelatedGames,
    buildGuideComparisonModel,
    buildGuideRenderModel
  };
})();
