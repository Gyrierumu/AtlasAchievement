window.UIDecisionModels = (() => {
  const { getGameImageSrc, getGameCoverSrc } = window.UIShared || {};
  const sharedEditorial = window.AtlasEditorialModel || {};
  const sharedGuide = window.AtlasGuideViewModel || {};
  const sharedCatalog = window.AtlasCatalogModel || {};

  function parseTimeValueFallback(value = '') {
    const numbers = String(value || '').toLowerCase().match(/\d+/g);
    if (!numbers) return null;
    const values = numbers.map(Number).filter(Number.isFinite);
    return values.length ? Math.max(...values) : null;
  }

  const parseTimeValue = sharedEditorial.parseTimeValue || parseTimeValueFallback;
  const getTimeValue = sharedEditorial.getTimeValue || (game => {
    const stored = Number(game?.time_sort_hours);
    if (Number.isFinite(stored) && stored > 0) return stored;
    const parsed = parseTimeValue(game?.time || '');
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  });
  const deriveNextAction = sharedGuide.deriveNextAction || (() => ({
    kind: 'overview',
    title: 'Abrir checklist',
    detail: 'Use a lista principal para continuar sem perder contexto.',
    cta: 'Continuar',
    focus: 'trophies',
    trophyId: '',
    trophyName: ''
  }));

  function getNextIdealTrophy(game = {}, completedIds = []) {
    const trophies = Array.isArray(game.trophies) ? game.trophies : [];
    const completedSet = new Set(Array.isArray(completedIds) ? completedIds : []);
    const pending = trophies.filter(trophy => trophy && !completedSet.has(trophy.id));
    if (!pending.length) return null;

    const scored = pending.map((trophy, index) => {
      const text = `${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`.toLowerCase();
      let score = 20 - index;
      if (trophy?.is_missable) score += 45;
      if (trophy?.tip) score += 14;
      if (!trophy?.is_spoiler) score += 10;
      if (/(primeir|in[ií]cio|cedo|antes|logo)/.test(text)) score += 18;
      if (/(colet|roadmap|campanha|cleanup|online|grind)/.test(text)) score += 9;
      if ((trophy?.type || '').toLowerCase() === 'bronze') score += 7;
      if ((trophy?.type || '').toLowerCase() === 'platina') score -= 15;
      return { trophy, score };
    }).sort((a, b) => b.score - a.score);

    const ideal = scored[0]?.trophy;
    if (!ideal) return null;

    return {
      id: ideal.id || '',
      name: ideal.name || 'Próximo troféu',
      label: ideal.is_missable ? 'Prioridade alta' : ideal.is_spoiler ? 'Atenção' : 'Bom próximo passo',
      detail: ideal.tip || ideal.description || 'Abra este troféu para manter o progresso andando sem perder contexto.'
    };
  }

  function buildLibraryRecommendations(libraryItems = [], availableGames = []) {
    const savedKeys = new Set(libraryItems.map(item => String(item.slug || item.name || '').trim()).filter(Boolean));
    const pool = (Array.isArray(availableGames) ? availableGames : []).filter(game => {
      const key = String(game?.slug || game?.name || '').trim();
      return key && !savedKeys.has(key);
    });
    if (!libraryItems.length || !pool.length) return [];

    const weighted = libraryItems.filter(item => item.progress < 100);
    const source = weighted.length ? weighted : libraryItems;
    const avgDifficulty = source.reduce((sum, item) => sum + Number(item.difficulty || 0), 0) / Math.max(source.length, 1);
    const avgTime = source.reduce((sum, item) => sum + Number(item.timeValue || parseTimeValue(item.time) || 0), 0) / Math.max(source.length, 1);
    const openProjects = libraryItems.filter(item => item.progress > 0 && item.progress < 100).length;
    const hardProjects = libraryItems.filter(item => Number(item.difficulty || 0) >= 7).length;
    const longProjects = libraryItems.filter(item => Number(item.timeValue || parseTimeValue(item.time) || 0) > 35).length;
    const wantsQuickWin = openProjects >= 2 && (hardProjects >= 1 || longProjects >= 2);
    const anchor = source.slice().sort((a, b) => b.momentumScore - a.momentumScore)[0] || source[0];

    return pool.map(game => {
      const difficulty = Number(game?.difficulty || 0);
      const timeValue = Number(parseTimeValue(game?.time) || 0);
      const roadmapCount = Array.isArray(game?.roadmap) ? game.roadmap.length : Number(game?.roadmap_count || 0);
      const trophyCount = Number(game?.trophy_count || game?.trophies?.length || 0);
      let score = 40;
      if (difficulty > 0 && avgDifficulty > 0) score += Math.max(0, 24 - Math.abs(difficulty - avgDifficulty) * 5);
      if (timeValue > 0 && avgTime > 0) score += Math.max(0, 22 - Math.abs(timeValue - avgTime) * 0.5);
      if (roadmapCount > 0) score += Math.min(roadmapCount * 4, 14);
      if (trophyCount >= 20 && trophyCount <= 60) score += 8;
      if (anchor) {
        const anchorDifficulty = Number(anchor.difficulty || 0);
        const anchorTime = Number(anchor.timeValue || parseTimeValue(anchor.time) || 0);
        score += Math.max(0, 16 - Math.abs(difficulty - anchorDifficulty) * 4);
        score += Math.max(0, 14 - Math.abs(timeValue - anchorTime) * 0.35);
      }
      if (wantsQuickWin) {
        if (timeValue > 0 && timeValue <= 15) score += 18;
        if (difficulty > 0 && difficulty <= 4) score += 14;
      }

      const badge = wantsQuickWin && timeValue > 0 && timeValue <= 15
        ? 'Boa pausa curta'
        : difficulty > 0 && avgDifficulty > 0 && Math.abs(difficulty - avgDifficulty) <= 1.5
          ? 'Combina com seu ritmo'
          : roadmapCount >= 3
            ? 'Guia mais guiado'
            : 'Boa próxima aposta';

      const reason = wantsQuickWin && timeValue > 0 && timeValue <= 15
        ? 'Você já tem projetos suficientes abertos. Esta opção parece uma vitória rápida para recuperar tração.'
        : anchor
          ? `Fica perto do perfil de ${anchor.name} em dificuldade/tempo, então tende a combinar com o que você já está priorizando.`
          : 'Combina com o tipo de jogo que você costuma salvar na biblioteca.';

      return { game, score, badge, reason };
    }).sort((a, b) => b.score - a.score).slice(0, 3);
  }

  function summarizeLibraryProfile(libraryItems = []) {
    if (!libraryItems.length) return null;
    const avgDifficulty = libraryItems.reduce((sum, item) => sum + Number(item.difficulty || 0), 0) / libraryItems.length;
    const avgTime = libraryItems.reduce((sum, item) => sum + Number(item.timeValue || parseTimeValue(item.time) || 0), 0) / libraryItems.length;
    const openProjects = libraryItems.filter(item => item.progress > 0 && item.progress < 100).length;
    const nearFinish = libraryItems.filter(item => item.remaining > 0 && item.remaining <= 3).length;
    const style = avgDifficulty <= 3.5
      ? 'Você tende a salvar jogos de entrada mais suave.'
      : avgDifficulty <= 6.5
        ? 'Seu perfil atual puxa para projetos médios e consistentes.'
        : 'Sua biblioteca já está pendendo para projetos exigentes.';
    const pace = avgTime && avgTime <= 15
      ? 'A maior parte cabe em sessões curtas ou em um fim de semana.'
      : avgTime && avgTime <= 40
        ? 'Seu ritmo atual mistura projetos médios com espaço para continuidade.'
        : 'Seu ritmo atual está mais carregado de projetos longos.';
    return { avgDifficulty, avgTime, openProjects, nearFinish, style, pace };
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
        accent: 'done'
      };
    }

    if (total && remaining <= 3 && progress >= 80) {
      return {
        title: 'Falta muito pouco',
        detail: `${remaining} troféu(s) restante(s). Este é o candidato mais forte para fechar hoje.`,
        accent: 'neutral'
      };
    }

    if (progress >= 45) {
      return {
        title: 'Projeto bem encaminhado',
        detail: 'Você já passou da metade útil do guia. Bom momento para continuar sem perder contexto.',
        accent: 'neutral'
      };
    }

    if (progress > 0) {
      return {
        title: 'Já saiu do zero',
        detail: 'Retomar agora custa menos do que começar outro jogo do zero.',
        accent: 'partial'
      };
    }

    return {
      title: 'Pronto para começar',
      detail: 'Abra o roadmap antes da primeira sessão para entrar com direção.',
      accent: 'partial'
    };
  }

  function getLibraryMeta(game = {}) {
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

  function buildFallbackGuideViewModel(game = {}, completedSource = [], options = {}) {
    const trophies = Array.isArray(game?.trophies) ? game.trophies : [];
    const roadmap = Array.isArray(game?.roadmap) ? game.roadmap : [];
    const completedIds = new Set(Array.isArray(completedSource) ? completedSource : []);
    const completed = trophies.filter(trophy => completedIds.has(trophy.id)).length;
    const total = trophies.length;
    const progress = total ? Math.round((completed / total) * 100) : 0;
    return {
      trophies,
      roadmap,
      completedIds,
      completed,
      total,
      progress,
      pending: Math.max(total - completed, 0),
      missables: trophies.filter(trophy => trophy?.is_missable || trophy?.is_spoiler).length,
      missableCount: trophies.filter(trophy => trophy?.is_missable).length,
      spoilerCount: trophies.filter(trophy => trophy?.is_spoiler).length,
      riskCounts: sharedEditorial.getRiskCounts ? sharedEditorial.getRiskCounts(trophies) : { alertCount: 0 },
      roadmapStages: [],
      contextualFaq: [],
      nextActionModel: deriveNextAction(game, completedSource),
      editorial: { statusBadge: (sharedEditorial.getEditorialBadge || (() => ({ label: 'Guia parcial', tone: 'partial', badge: 'partial' })))(game) },
      snapshot: { confidence: { label: 'Confiança em construção', detail: 'Dados em construção.', tone: 'soft' } },
      image: typeof getGameCoverSrc === 'function' ? getGameCoverSrc(game) : (typeof getGameImageSrc === 'function' ? getGameImageSrc(game?.cover_image || game?.image) : (game?.cover_image || game?.image || '')),
      guideCover: sharedGuide.buildGuideCoverModel
        ? sharedGuide.buildGuideCoverModel(game, typeof getGameImageSrc === 'function' ? getGameImageSrc : undefined)
        : { image: typeof getGameCoverSrc === 'function' ? getGameCoverSrc(game) : (typeof getGameImageSrc === 'function' ? getGameImageSrc(game?.cover_image || game?.image) : (game?.cover_image || game?.image || '')), mode: 'poster', className: 'atlas-guide-cover--poster' },
      isSaved: Boolean(options?.isSaved),
      libraryEntry: options?.libraryEntry || null,
      collectionModel: sharedCatalog.classifyGameCollections ? sharedCatalog.classifyGameCollections(game, trophies) : { collectionLinks: [], badges: [] }
    };
  }

  function buildSharedGuideViewModel(game, completedSource = [], options = {}) {
    const classifyGameCollections = sharedCatalog.classifyGameCollections || (() => ({ collectionLinks: [], badges: [] }));
    if (typeof sharedGuide.buildGuideViewModel !== 'function') {
      return buildFallbackGuideViewModel(game, completedSource, options);
    }
    return sharedGuide.buildGuideViewModel(game, completedSource, {
      ...options,
      resolveImage: typeof getGameImageSrc === 'function' ? getGameImageSrc : undefined,
      classifyGameCollections
    });
  }

  return {
    catalogFacetMeta: sharedCatalog.catalogFacetMeta || { all: { id: 'all', path: '/catalogo', name: 'Catálogo de jogos', related: [] } },
    getEditorialBadge: sharedEditorial.getEditorialBadge || (() => ({ label: 'Guia parcial', tone: 'partial', badge: 'partial', detail: 'Cobertura parcial, use como ponto de partida.' })),
    classifyGameCollections: sharedCatalog.classifyGameCollections || (() => ({ collectionLinks: [], badges: [] })),
    parseTimeValue,
    getTimeValue,
    getDifficultyTone: sharedEditorial.getDifficultyTone || (() => 'unknown'),
    getDifficultyToneClass: sharedEditorial.getDifficultyToneClass || (() => 'atlas-meta-signal--difficulty-unknown'),
    getDifficultyTagClass: sharedEditorial.getDifficultyTagClass || (() => 'atlas-tag--difficulty-unknown'),
    deriveNextAction,
    getNextIdealTrophy,
    buildLibraryRecommendations,
    summarizeLibraryProfile,
    getMomentumLabel,
    getMomentumTone,
    computeMomentumScore,
    getProgressState,
    getLibraryMeta,
    getDifficultyProfileLabel: sharedEditorial.getDifficultyProfileLabel || (() => 'Não avaliada'),
    getTrophyBreakdown: sharedEditorial.getTrophyBreakdown || (() => []),
    TROPHY_TYPE_FILTERS: sharedEditorial.TROPHY_TYPE_FILTERS || new Set(['Platina', 'Ouro', 'Prata', 'Bronze']),
    TROPHY_RISK_DEFINITIONS: sharedEditorial.TROPHY_RISK_DEFINITIONS || {},
    normalizeRiskText: sharedEditorial.normalizeRiskText || (value => String(value || '').toLowerCase()),
    hasMissableRiskText: sharedEditorial.hasMissableRiskText || (() => false),
    getTrophyRiskTags: sharedEditorial.getTrophyRiskTags || (() => []),
    getTrophyRiskTokenString: sharedEditorial.getTrophyRiskTokenString || (() => ''),
    getRiskCounts: sharedEditorial.getRiskCounts || (() => ({ alertCount: 0 })),
    buildPlatinumSummary: sharedGuide.buildPlatinumSummary,
    buildGuideSummaryCards: sharedGuide.buildGuideSummaryCards,
    buildGuideRiskAlerts: sharedGuide.buildGuideRiskAlerts,
    getGuideTrophyTags: sharedGuide.getGuideTrophyTags,
    getGuideTrophyDisplayTags: sharedGuide.getGuideTrophyDisplayTags,
    getGuideTrophySearchText: sharedGuide.getGuideTrophySearchText,
    buildBeforeStartCards: sharedGuide.buildBeforeStartCards,
    buildRouteChangingTrophies: sharedGuide.buildRouteChangingTrophies,
    buildEditorialSignals: sharedGuide.buildEditorialSignals,
    buildPrepCards: sharedGuide.buildPrepCards,
    buildRoadmapStages: sharedGuide.buildRoadmapStages,
    buildDecisionRoadmapStages: sharedGuide.buildDecisionRoadmapStages,
    buildContextualFaq: sharedGuide.buildContextualFaq,
    buildGuidePlayerFit: sharedGuide.buildGuidePlayerFit,
    buildCatalogIntentConfigs: sharedCatalog.buildCatalogIntentConfigs || (() => []),
    buildCriticalTrophyAlerts: sharedGuide.buildCriticalTrophyAlerts,
    buildExecutionProfile: sharedGuide.buildExecutionProfile,
    getGuideRunEstimate: sharedGuide.getGuideRunEstimate,
    getGuideConfidenceModel: sharedGuide.getGuideConfidenceModel,
    buildGuideSnapshot: sharedGuide.buildGuideSnapshot,
    buildCatalogDiscoveryCards: sharedCatalog.buildCatalogDiscoveryCards || (() => []),
    buildCatalogCompareLabel: sharedCatalog.buildCatalogCompareLabel || (() => 'Boa opção para comparar'),
    buildGuideDecisionModel: sharedGuide.buildGuideDecisionModel,
    getDecisionToneClass: sharedGuide.getDecisionToneClass,
    getGuideVerdictInputs: sharedGuide.getGuideVerdictInputs,
    buildThirtySecondVerdict: sharedGuide.buildThirtySecondVerdict,
    buildGuideViewModel: buildSharedGuideViewModel
  };
})();
