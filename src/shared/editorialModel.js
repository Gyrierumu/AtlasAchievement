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
    run: { label: 'Run específica', tone: 'warning' }
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
      || /chapter select resolve|free roam|cleanup completo|nada e perdivel|nada e missable/.test(text);
    if (!hasLowRiskStatement) return true;

    const contrastMatch = text.match(/(?:mas|porem|exceto|apesar|salvo|fora disso)(.*)$/);
    return Boolean(contrastMatch && riskPattern.test(contrastMatch[1]));
  }

  function hasNegatedMissableRiskTagText(value = '') {
    const text = normalizeRiskText(value);
    return /nao (?:fica|e|eh|sao|são|ha|existe|existem).*perdivel|nao .*perdiveis|sem .*perdivel|sem .*perdiveis|nada .*perdivel|nada .*missable|free roam|cleanup completo/.test(text);
  }

  function pushRiskTag(tags, id) {
    if (!TROPHY_RISK_DEFINITIONS[id] || tags.some(tag => tag.id === id)) return;
    tags.push({ id, ...TROPHY_RISK_DEFINITIONS[id] });
  }

  function getTrophyRiskTags(trophy = {}) {
    const text = normalizeRiskText(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`);
    const tags = [];
    const isPlatinum = normalizeRiskText(trophy?.type || '') === 'platina';
    if (isPlatinum) return tags;
    if (!isPlatinum && (trophy?.is_missable || (!hasNegatedMissableRiskTagText(text) && /perdivel|missable|perder|ficar indisponivel|bloqueia|sem chapter|no chapter|janela/.test(text)))) pushRiskTag(tags, 'missable');
    if (trophy?.is_spoiler) pushRiskTag(tags, 'spoiler');
    if (/colet|colecion|collect|todos os|todas as|all |arquivo|files|memoriam|raccoon|lendari|legendary|mapa|cofre|tesouro|modelo|concept art/.test(text)) pushRiskTag(tags, 'collectible');
    if (/historia|story|campanha principal|progresso|automatico|ato |chapter|capitulo|final verdadeiro|finais|ending|conclua a historia|finish the game/.test(text)) pushRiskTag(tags, 'story');
    if (/dificuldade|difficulty|\bhard\b|madhouse|insanity|professional|nightmare|inferno|survival|rank s|s\+|sem cura|sem save|only your knife|faca/.test(text)) pushRiskTag(tags, 'difficulty');
    if (/cleanup|limpeza|pos-jogo|post-game|deixe para o final|volte depois|fast travel|recarregue|reload/.test(text)) pushRiskTag(tags, 'cleanup');
    if (/grind|farm|\brank\b|\bxp\b|\bnivel\b|\blevel\b|acumule|dinheiro|creditos|pontos|300|500|200\.000|mercenaries/.test(text)) pushRiskTag(tags, 'grind');
    if (/run|campanha dedicada|multiplas campanhas|nova campanha|new game|ng\+|speedrun|sem usar|without|only|finais|final alternativo|backup/.test(text)) pushRiskTag(tags, 'run');
    return tags;
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
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    const raw = String(value || '').trim();
    if (!raw) return [];
    if (/^\s*\[/.test(raw)) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean);
      } catch (error) {
        // Legacy free-text values are parsed line by line below.
      }
    }
    return raw.split(/\r?\n|;/).map(item => item.trim()).filter(Boolean);
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
    if (explicit) return explicit;
    if (game?.is_verified || game?.verification_status === 'verified') return 'verified';
    if (String(game?.editorial_status || '').toLowerCase() === 'draft') return 'draft';
    return inferEditorialTrustStatusFromNotes(game) || 'in_review';
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
    getEditorialTrustBadge,
    getEditorialBadge,
    getGuideRoadmapCount,
    buildGuideHeroStats
  };
});
