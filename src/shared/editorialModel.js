(function attachEditorialModel(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AtlasEditorialModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function editorialModelFactory() {
  const FALLBACK_TIME_VALUE = Number.MAX_SAFE_INTEGER;
  const TROPHY_TYPE_FILTERS = new Set(['Platina', 'Ouro', 'Prata', 'Bronze']);
  const TROPHY_RISK_DEFINITIONS = {
    missable: { label: 'Perdível', tone: 'risk' },
    spoiler: { label: 'Spoiler', tone: 'spoiler' },
    collectible: { label: 'Coletável', tone: 'partial' },
    story: { label: 'História', tone: 'partial' },
    difficulty: { label: 'Dificuldade', tone: 'warning' },
    cleanup: { label: 'Cleanup', tone: 'neutral' },
    grind: { label: 'Grind', tone: 'warning' },
    run: { label: 'Risco de run', tone: 'warning' },
    progress: { label: 'Progresso', tone: 'partial' },
    system: { label: 'Sistema', tone: 'partial' }
  };
  const RESIDENT_EVIL_NON_COLLECTIBLE_IDS = new Set([
    're1r_ghost_chance',
    're1r_cqc_ftw',
    're1r_dont_stop_running',
    're1r_take_that_zombies',
    're1r_that_was_nice',
    're1r_great_guy'
  ]);
  const RESIDENT_EVIL_RUN_RISK_IDS = new Set([
    're1r_ghost_chance',
    're1r_cqc_ftw',
    're1r_dont_stop_running',
    're1r_that_was_nice',
    're1r_great_guy'
  ]);
  const RESIDENT_EVIL_2_TAG_FIXES_BY_ID = {
    re2r_basics_survival: { remove: ['difficulty'] },
    re2r_hip_squares: { add: ['collectible'] },
    re2r_customizer: { remove: ['story'], add: ['collectible'] },
    re2r_no_stinkin_gun: { remove: ['difficulty', 'story'] },
    re2r_eat_this: { remove: ['difficulty'] },
    re2r_hold_em: { remove: ['missable', 'collectible'] },
    re2r_hats_off: { remove: ['collectible'] },
    re2r_gotcha: { add: ['difficulty', 'run'] },
    re2r_treasure_hunter: { add: ['collectible'] },
    re2r_super_spy: { add: ['difficulty', 'run'] },
    re2r_young_escapee: { add: ['difficulty', 'run'] },
    re2r_time_spare: { add: ['difficulty', 'run'] },
    re2r_blink_eye: { add: ['difficulty', 'run'] },
    re2r_lore_explorer: { remove: ['story'], add: ['collectible'] },
    re2r_complete_vermin: { remove: ['story'], add: ['collectible'] },
    re2r_leon_s: { remove: ['grind', 'cleanup'], add: ['difficulty', 'run'] },
    re2r_scarlet_hero: { remove: ['grind'], add: ['difficulty', 'run'] },
    re2r_hardcore_rookie: { add: ['difficulty', 'run'] },
    re2r_hardcore_college: { add: ['difficulty', 'run'] },
    re2r_minimalist: { remove: ['collectible'], add: ['difficulty', 'run'] },
    re2r_small_footprint: { remove: ['collectible', 'story'], add: ['difficulty', 'run'] },
    re2r_grim_reaper: { add: ['difficulty', 'run'] }
  };
  const RESIDENT_EVIL_3_TAG_FIXES_BY_ID = {
    re3r_somebody_to_lean_on: { remove: ['collectible'], add: ['story'] },
    re3r_escape_city: { remove: ['collectible'], add: ['story'] }
  };
  const FINAL_FANTASY_VII_REBIRTH_TAG_FIXES_BY_ID = {
    'ff7-rebirth-professional-handler': { remove: ['difficulty'] }
  };
  const DEAD_SPACE_REMAKE_TAGS_BY_ID = {
    'dead-space-remake-welcome-aboard': ['story'],
    'dead-space-remake-lab-rat': ['story'],
    'dead-space-remake-all-systems-go': ['story'],
    'dead-space-remake-cannon-fodder': ['story'],
    'dead-space-remake-true-believer': ['story'],
    'dead-space-remake-greenhouse-effect': ['story'],
    'dead-space-remake-sos': ['story'],
    'dead-space-remake-strange-transmissions': ['story'],
    'dead-space-remake-wreckage': ['story'],
    'dead-space-remake-keeper-of-the-faith': ['story'],
    'dead-space-remake-betrayed': ['story'],
    'dead-space-remake-exodus': ['story'],
    'dead-space-remake-brute-force': ['story'],
    'dead-space-remake-exterminator': ['story'],
    'dead-space-remake-get-off-my-ship': ['story'],
    'dead-space-remake-mindless-prey': ['story'],
    'dead-space-remake-set-a-benchmark': ['difficulty'],
    'dead-space-remake-untouchable': ['difficulty', 'run'],
    'dead-space-remake-full-arsenal': ['collectible'],
    'dead-space-remake-built-to-order': ['collectible', 'cleanup'],
    'dead-space-remake-story-teller': ['collectible', 'cleanup'],
    'dead-space-remake-legend-teller': ['collectible', 'cleanup'],
    'dead-space-remake-merchant': ['collectible', 'cleanup', 'run'],
    'dead-space-remake-full-clearance': ['collectible', 'cleanup'],
    'dead-space-remake-theres-always-peng': ['collectible', 'run'],
    'dead-space-remake-marked': ['collectible'],
    'dead-space-remake-reunion': ['missable', 'collectible', 'run'],
    'dead-space-remake-front-toward-enemy': ['missable', 'run'],
    'dead-space-remake-one-gun': ['run'],
    'dead-space-remake-maxed-out': ['grind', 'cleanup', 'run'],
    'dead-space-remake-surgeon': ['grind']
  };
  const EDITORIAL_TRUST_STATUSES = {
    verified: {
      label: 'Verificado',
      detail: 'Guia revisado editorialmente.',
      tone: 'verified',
      badge: 'verified',
      critical: false
    },
    in_review: {
      label: 'Em revisão',
      detail: 'Este guia ainda está passando por revisão editorial.',
      tone: 'review',
      badge: 'review',
      critical: false
    },
    needs_missables_check: {
      label: 'Checar perdíveis',
      detail: 'As informações sobre troféus perdíveis ainda precisam de validação.',
      tone: 'warning',
      badge: 'warning',
      critical: true
    },
    needs_online_check: {
      label: 'Checar online',
      detail: 'As informações sobre online/coop ainda precisam de validação.',
      tone: 'warning',
      badge: 'warning',
      critical: true
    },
    dlc_pending: {
      label: 'DLC pendente',
      detail: 'A separação entre base game e DLC ainda está em revisão.',
      tone: 'warning',
      badge: 'warning',
      critical: true
    },
    outdated: {
      label: 'Desatualizado',
      detail: 'Este guia pode estar desatualizado e precisa de nova revisão.',
      tone: 'risk',
      badge: 'risk',
      critical: true
    },
    draft: {
      label: 'Rascunho',
      detail: 'Este guia ainda está em rascunho.',
      tone: 'neutral',
      badge: 'neutral',
      critical: true
    }
  };

  function parseTimeValue(value = '') {
    const normalized = String(value || '').toLowerCase();
    const numbers = normalized.match(/\d+/g);
    if (!numbers) return null;
    const values = numbers.map(Number).filter(Number.isFinite);
    return values.length ? Math.max(...values) : null;
  }

  function getTimeValue(game = {}) {
    const stored = Number(game?.time_sort_hours);
    if (Number.isFinite(stored) && stored > 0) return stored;
    const parsed = parseTimeValue(game?.time || '');
    return Number.isFinite(parsed) ? parsed : FALLBACK_TIME_VALUE;
  }

  function getDifficultyProfileLabel(difficulty) {
    const value = Number(difficulty || 0);
    if (value >= 9) return 'Brutal';
    if (value >= 7) return 'Exigente';
    if (value >= 4) return 'Intermediária';
    if (value >= 1) return 'Acessível';
    return 'Não avaliada';
  }

  function getDifficultyTone(difficulty) {
    const value = Number(difficulty || 0);
    if (value >= 7) return 'high';
    if (value >= 4) return 'medium';
    if (value >= 1) return 'low';
    return 'unknown';
  }

  function getDifficultyToneClass(difficulty) {
    return `atlas-meta-signal--difficulty-${getDifficultyTone(difficulty)}`;
  }

  function getDifficultyTagClass(difficulty) {
    return `atlas-tag--difficulty-${getDifficultyTone(difficulty)}`;
  }

  function getTrophyBreakdown(trophies = []) {
    return ['Platina', 'Ouro', 'Prata', 'Bronze'].map(type => ({
      type,
      count: trophies.filter(trophy => String(trophy?.type || '').toLowerCase() === type.toLowerCase()).length
    }));
  }

  function normalizeRiskText(value = '') {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function hasMissableRiskText(value = '') {
    const text = normalizeRiskText(value);
    const riskPattern = /perdivel|missable|ponto sem retorno|pontos sem retorno|sem voltar|nova run|multiplas runs|multiplas campanhas|sem chapter select|nao ha chapter select|ficar indisponivel|bloqueia|janela/;
    const hasRiskPhrase = riskPattern.test(text);
    if (!hasRiskPhrase) return false;

    const hasLowRiskStatement = /(?:nao ha|sem|nenhum|nenhuma|baixo risco de)\s+(?:trofeus?\s+)?(?:perdiveis?|missables?)/.test(text)
      || /nenhum(?:a)?\s+trofeu.{0,80}(?:marcado|tratado|contado).{0,40}perdivel/.test(text)
      || /nao ha.{0,80}perdiveis? reais|sem.{0,80}perdiveis? reais/.test(text)
      || /chapter select resolve|free roam|cleanup completo|nada e perdivel|nada e missable/.test(text);
    if (!hasLowRiskStatement) return true;

    const contrastMatch = text.match(/(?:mas|porem|exceto|apesar|salvo|fora disso)(.*)$/);
    return Boolean(contrastMatch && riskPattern.test(contrastMatch[1]));
  }

  function hasNegatedMissableRiskTagText(value = '') {
    const text = normalizeRiskText(value);
    return /nao (?:fica|e|eh|sao|são|ha|existe|existem).*perdivel|nao .*perdiveis|sem .*perdivel|sem .*perdiveis|nada .*perdivel|nada .*missable|free roam|cleanup completo/.test(text);
  }

  function isCompletionTrophy(trophy = {}) {
    const type = normalizeRiskText(trophy?.type || '');
    const tier = normalizeRiskText(trophy?.tier || '');
    const name = normalizeRiskText(`${trophy?.trophyNameOriginal || ''} ${trophy?.name || ''}`);
    const description = normalizeRiskText([
      trophy?.descriptionOriginal,
      trophy?.descriptionPtBr,
      trophy?.ptDescription,
      trophy?.localizedDescription?.ptBr,
      trophy?.localizedDescription?.['pt-BR'],
      trophy?.description
    ].filter(Boolean).join(' '));
    return type === 'platina'
      || type === 'platinum'
      || tier === 'platina'
      || tier === 'platinum'
      || /god of blood/.test(name)
      || /earn (?:every|all) other trophies|obtenha todos os trofeus|obtenha todos os outros trofeus/.test(description);
  }

  function pushRiskTag(tags, id) {
    if (!TROPHY_RISK_DEFINITIONS[id] || tags.some(tag => tag.id === id)) return;
    tags.push({ id, ...TROPHY_RISK_DEFINITIONS[id] });
  }

  function applyDeadSpaceRemakeTagOverrides(tags = [], trophyId = '') {
    if (!String(trophyId || '').startsWith('dead-space-remake-')) return tags;
    const fix = DEAD_SPACE_REMAKE_TAGS_BY_ID[trophyId] || [];
    const managedIds = new Set(['missable', 'collectible', 'story', 'difficulty', 'cleanup', 'grind', 'run']);
    const nextTags = tags.filter(tag => !managedIds.has(tag?.id));
    fix.forEach(id => pushRiskTag(nextTags, id));
    return nextTags;
  }

  function getTrophyRiskTags(trophy = {}) {
    const text = normalizeRiskText(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`);
    const tags = [];
    const trophyId = String(trophy?.id || '').trim();
    const isPlatinum = isCompletionTrophy(trophy);
    if (isPlatinum) return tags;
    if (!isPlatinum && (trophy?.is_missable || (!hasNegatedMissableRiskTagText(text) && /perdivel|missable|perder|ficar indisponivel|\bbloqueia|sem chapter|no chapter|janela/.test(text)))) pushRiskTag(tags, 'missable');
    if (trophy?.is_spoiler) pushRiskTag(tags, 'spoiler');
    if (/colet|colecion|collect|todos os|todas as|all |arquivo|files|memoriam|raccoon|lendari|legendary|mapa|cofre|tesouro|modelo|concept art/.test(text)) pushRiskTag(tags, 'collectible');
    if (/historia|story|campanha principal|progresso|automatico|ato |chapter|capitulo|final verdadeiro|finais|ending|conclua a historia|finish the game/.test(text)) pushRiskTag(tags, 'story');
    if (/dificuldade|difficulty|\bhard\b|madhouse|insanity|professional|nightmare|inferno|survival|rank s|s\+|sem cura|sem save|only your knife|faca/.test(text)) pushRiskTag(tags, 'difficulty');
    if (/cleanup|limpeza|pos-jogo|post-game|deixe para o final|volte depois|fast travel|recarregue|reload/.test(text)) pushRiskTag(tags, 'cleanup');
    if (/grind|farm|\brank\b|\bxp\b|\bnivel\b|\blevel\b|acumule|dinheiro|creditos|pontos|300|500|200\.000|mercenaries/.test(text)) pushRiskTag(tags, 'grind');
    if (/\bruns?\b|campanha dedicada|multiplas campanhas|nova campanha|new game|ng\+|speedrun|sem usar|without|only|finais|final alternativo|backup/.test(text)) pushRiskTag(tags, 'run');
    if (RESIDENT_EVIL_RUN_RISK_IDS.has(trophyId)) pushRiskTag(tags, 'run');
    if (RESIDENT_EVIL_NON_COLLECTIBLE_IDS.has(trophyId)) {
      return tags.filter(tag => tag.id !== 'collectible');
    }
    if (RESIDENT_EVIL_2_TAG_FIXES_BY_ID[trophyId]) {
      const fix = RESIDENT_EVIL_2_TAG_FIXES_BY_ID[trophyId];
      const filtered = tags.filter(tag => !(fix.remove || []).includes(tag.id));
      (fix.add || []).forEach(id => pushRiskTag(filtered, id));
      return filtered;
    }
    if (RESIDENT_EVIL_3_TAG_FIXES_BY_ID[trophyId]) {
      const fix = RESIDENT_EVIL_3_TAG_FIXES_BY_ID[trophyId];
      const filtered = tags.filter(tag => !(fix.remove || []).includes(tag.id));
      (fix.add || []).forEach(id => pushRiskTag(filtered, id));
      return filtered;
    }
    if (FINAL_FANTASY_VII_REBIRTH_TAG_FIXES_BY_ID[trophyId]) {
      const fix = FINAL_FANTASY_VII_REBIRTH_TAG_FIXES_BY_ID[trophyId];
      const filtered = tags.filter(tag => !(fix.remove || []).includes(tag.id));
      (fix.add || []).forEach(id => pushRiskTag(filtered, id));
      return filtered;
    }
    return applyDeadSpaceRemakeTagOverrides(tags, trophyId);
  }

  function getTrophyRiskTokenString(trophy = {}) {
    return getTrophyRiskTags(trophy).map(tag => tag.id).join(' ');
  }

  function getRiskCounts(trophies = []) {
    const counts = Object.keys(TROPHY_RISK_DEFINITIONS).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    let alertCount = 0;
    trophies.forEach(trophy => {
      const tags = getTrophyRiskTags(trophy);
      if (tags.length) alertCount += 1;
      tags.forEach(tag => { counts[tag.id] += 1; });
    });
    return { ...counts, alertCount };
  }

  function getCoverageDisplayLabel(level = '') {
    const value = String(level || '').trim().toLowerCase();
    if (value === 'complete') return 'completa';
    if (value === 'strong') return 'forte';
    if (value === 'partial') return 'parcial';
    return value || 'parcial';
  }

  function getVerificationStatusLabel(status = '', isVerified = false) {
    if (status === 'verified' || isVerified) return 'verificado';
    if (status === 'review') return 'em verificação';
    return 'não verificado';
  }

  function normalizeEditorialTrustStatus(value = '') {
    const status = String(value || '').trim().toLowerCase().replace(/-/g, '_');
    return EDITORIAL_TRUST_STATUSES[status] ? status : '';
  }

  function parseQualityWarnings(value = []) {
    const isDeprecatedPublicWarning = item => /Algumas descri[cç][oõ]es secretas usam tradu[cç][aã]o editorial PT-BR|Steam oculta|descri[cç][aã]o localizada/i.test(String(item || ''));
    const cleanWarnings = items => items
      .map(item => String(item || '').trim())
      .filter(Boolean)
      .filter(item => !isDeprecatedPublicWarning(item));
    if (Array.isArray(value)) return cleanWarnings(value);
    const raw = String(value || '').trim();
    if (!raw) return [];
    if (/^\s*\[/.test(raw)) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return cleanWarnings(parsed);
      } catch (error) {
        // Legacy free-text values are parsed line by line below.
      }
    }
    return cleanWarnings(raw.split(/\r?\n|;/));
  }

  function inferEditorialTrustStatusFromNotes(game = {}) {
    const text = normalizeRiskText([
      game.editorial_notes,
      game.editorialNotes,
      game.verification_note,
      game.verificationNote
    ].filter(Boolean).join(' '));
    if (!text) return '';
    if (/needs_missables_check|checar perdiveis|perdiveis.*validacao|perdiveis.*validar|missables.*check/.test(text)) return 'needs_missables_check';
    if (/needs_online_check|checar online|online.*validacao|online.*validar|coop.*validacao|coop.*validar/.test(text)) return 'needs_online_check';
    if (/dlc_pending|dlc pendente|dlc.*revisao|base game.*dlc|separacao.*dlc/.test(text)) return 'dlc_pending';
    if (/outdated|desatualizado|defasado|nova versao|atualizacao.*lista/.test(text)) return 'outdated';
    return '';
  }

  function getEditorialTrustStatus(game = {}) {
    const explicit = normalizeEditorialTrustStatus(
      game.editorial_review_status
      || game.editorialReviewStatus
      || game.editorialStatus
      || ''
    );
    if (game?.is_verified || game?.verification_status === 'verified') return 'verified';
    if (explicit) return explicit;
    if (String(game?.editorial_status || '').toLowerCase() === 'draft') return 'draft';
    return inferEditorialTrustStatusFromNotes(game) || 'in_review';
  }

  function getEditorialStatusMessage(game = {}, badge = null) {
    const status = normalizeEditorialTrustStatus(
      typeof badge === 'string' ? badge : (badge?.status || getEditorialTrustStatus(game))
    ) || 'in_review';
    if (status === 'verified') return 'Guia revisado editorialmente para a lista base.';
    if (status === 'draft') return EDITORIAL_TRUST_STATUSES.draft.detail;
    return 'Este guia está em revisão editorial. A lista de troféus, perdíveis e localização em português ainda precisam de validação final.';
  }

  function getEditorialTrustBadge(game = {}) {
    const status = getEditorialTrustStatus(game);
    const meta = EDITORIAL_TRUST_STATUSES[status] || EDITORIAL_TRUST_STATUSES.in_review;
    const warnings = parseQualityWarnings(game.quality_warnings ?? game.qualityWarnings ?? []);
    return {
      status,
      label: meta.label,
      detail: meta.detail,
      tone: meta.tone,
      badge: meta.badge,
      critical: Boolean(meta.critical),
      lastReviewedAt: game.last_reviewed_at || game.lastReviewedAt || '',
      reviewedBy: game.reviewed_by || game.reviewedBy || '',
      notes: game.editorial_notes || game.editorialNotes || '',
      qualityWarnings: warnings
    };
  }

  function getEditorialBadge(game = {}) {
    const trustBadge = getEditorialTrustBadge(game);
    if (trustBadge.status === 'verified' || trustBadge.status === 'in_review' || trustBadge.critical) {
      return trustBadge;
    }

    const status = game.editorial_status || 'published';
    const coverage = game.coverage_level || 'partial';

    if (status === 'review') {
      return {
        label: 'Guia em revisão',
        tone: 'partial',
        badge: 'partial',
        detail: game.is_verified ? 'Guia publicado com revisão editorial pendente.' : 'Guia em revisão e ainda sem confirmação manual.'
      };
    }

    if (!game.is_verified) {
      return {
        label: 'Dados em verificação',
        tone: 'unverified',
        badge: 'unverified',
        detail: game.verification_note || 'Dados ainda sem confirmação manual.'
      };
    }

    if (coverage === 'complete') {
      return {
        label: 'Guia completo',
        tone: 'complete',
        badge: 'complete',
        detail: 'Cobertura completa marcada pelo editor.'
      };
    }

    if (coverage === 'strong') {
      return {
        label: 'Guia parcial',
        tone: 'partial',
        badge: 'partial',
        detail: 'Cobertura forte, ainda sem selo completo.'
      };
    }

    return {
      label: 'Guia parcial',
      tone: 'partial',
      badge: 'partial',
      detail: 'Cobertura parcial, use como ponto de partida.'
    };
  }

  function getGuideRoadmapCount(game = {}, viewModel = {}) {
    return Number(game?.roadmap_count || viewModel?.roadmap?.length || viewModel?.roadmapStages?.length || 0);
  }

  function buildGuideHeroStats(game = {}, viewModel = {}) {
    return [
      { icon: 'fa-gauge-high', label: 'Dificuldade', value: `${String(game?.difficulty || '-')}/10`, tone: getDifficultyToneClass(game?.difficulty) },
      { icon: 'fa-clock', label: 'Tempo', value: game?.time || 'Tempo não informado', tone: 'atlas-meta-signal--time' },
      { icon: 'fa-trophy', label: 'Troféus', value: `${String(viewModel.total || 0)} troféu(s)`, tone: 'atlas-meta-signal--trophy' },
      { icon: 'fa-route', label: 'Roadmap', value: `${String(getGuideRoadmapCount(game, viewModel))} etapa(s)`, tone: 'atlas-meta-signal--partial' }
    ];
  }

  return {
    FALLBACK_TIME_VALUE,
    TROPHY_TYPE_FILTERS,
    TROPHY_RISK_DEFINITIONS,
    parseTimeValue,
    getTimeValue,
    getDifficultyProfileLabel,
    getDifficultyTone,
    getDifficultyToneClass,
    getDifficultyTagClass,
    getTrophyBreakdown,
    normalizeRiskText,
    hasMissableRiskText,
    getTrophyRiskTags,
    getTrophyRiskTokenString,
    getRiskCounts,
    getCoverageDisplayLabel,
    getVerificationStatusLabel,
    EDITORIAL_TRUST_STATUSES,
    normalizeEditorialTrustStatus,
    parseQualityWarnings,
    getEditorialTrustStatus,
    getEditorialStatusMessage,
    getEditorialTrustBadge,
    getEditorialBadge,
    getGuideRoadmapCount,
    buildGuideHeroStats
  };
});
