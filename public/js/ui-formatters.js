window.UIFormatters = (() => {
  const { escapeHtml, escapeAttribute } = window.UIShared;

  function buildBreadcrumbsHtml(items = []) {
    return `
      <nav class="atlas-breadcrumbs" aria-label="Breadcrumb">
        ${items.map((item, index) => {
          const isLast = index === items.length - 1;
          const label = escapeHtml(item?.label || 'Item');
          if (isLast || !item?.href) return `<span class="atlas-breadcrumbs__item" aria-current="page">${label}</span>`;
          return `<a href="${escapeAttribute(item.href)}" class="atlas-breadcrumbs__item">${label}</a>`;
        }).join('<span class="atlas-breadcrumbs__sep" aria-hidden="true">/</span>')}
      </nav>`;
  }

  function buildGameSeoTitle(game = {}) {
    const name = String(game?.name || 'Jogo').trim() || 'Jogo';
    return `${name} – Guia de platina e troféus`;
  }

  function normalizeSeoSignalText(value = '') {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function hasUncertainEditorialText(value = '') {
    return /precisa (?:revisao|validar|validacao)|aguarda(?:ndo)? validacao|aguarda(?:ndo)? revisao|em revisao|informacao em revisao|nao confirmado|nao confirmad|incert|sujeit[oa] a revisao|dados atuais|validar manualmente/.test(value);
  }

  function buildGameSeoDescription(game = {}) {
    const name = String(game?.name || 'este jogo').trim() || 'este jogo';
    const parts = [];
    const time = String(game?.time || '').trim();
    const difficulty = Number(game?.difficulty || 0);
    const onlineText = normalizeSeoSignalText(firstGuideText(game?.online_summary, game?.guide_online, game?.online));
    const missableText = normalizeSeoSignalText(firstGuideText(game?.missable_summary, game?.missable));
    const dlcText = normalizeSeoSignalText(firstGuideText(game?.dlc_scope, game?.guide_dlc, game?.dlc));
    const hasOnline = /online\/multiplayer|trofeus? online confirmad|red dead online|sport mode|sos flare|guild cards?|daily challenge|servidor|server|ps\+/.test(onlineText)
      && !/nao ha|sem online|nao exige online|online opcional|nao.*online obrigatorio|ps\+ nao/.test(onlineText);
    const noOnline = /nao ha (?:trofeus )?(?:online|exigencia online)|sem online obrigatorio|nao exige online|sem trofeus online|nao ha multiplayer obrigatorio/.test(onlineText)
      && !hasUncertainEditorialText(onlineText);
    const hasCoop = /exige 2 jogadores|2 jogadores obrigatorios|dois jogadores obrigatorios|nao pode ser platinado solo|coop obrigatorio|co-op obrigatorio/.test(onlineText);
    const missableCount = Number(game?.missable_count || 0);
    const hasMissables = missableCount > 0 || (!/nao ha|sem perdiveis|nada .*perdivel|0 perdiveis/.test(missableText) && /perdivel|perdiveis|ponto sem retorno|bloque/.test(missableText));

    parts.push('troféus');
    parts.push('roadmap');
    parts.push('checklist');
    if (time) parts.push(`tempo ${time}`);
    if (difficulty > 0) parts.push(`dificuldade ${difficulty}/10`);
    if (hasMissables) parts.push('perdíveis');
    if (hasCoop) parts.push('coop obrigatório');
    else if (hasOnline) parts.push('requisitos online');
    else if (noOnline) parts.push('sem online obrigatório');
    if (/lista base|jogo base|base game|sem dlc|dlc nao necessaria|nao e necessaria|fora do escopo|nao inclui/.test(dlcText) && !hasUncertainEditorialText(dlcText)) {
      parts.push('DLC fora da platina base');
    }
    return truncateSeoDescription(`Guia de platina de ${name}: ${parts.join(', ')}.`);
  }

  function truncateSeoDescription(value = '', maxLength = 155) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    const slice = text.slice(0, maxLength + 1);
    const lastBreak = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf(' e '), slice.lastIndexOf(' '));
    return `${slice.slice(0, lastBreak > 90 ? lastBreak : maxLength).trim().replace(/[,.]$/, '')}.`;
  }

  function buildGameGuideH1(game = {}) {
    const name = String(game?.name || 'Guia').trim() || 'Guia';
    const hasPlatinum = Array.isArray(game?.trophies)
      ? game.trophies.some(trophy => String(trophy?.type || '').trim().toLowerCase() === 'platina' || String(trophy?.type || '').trim().toLowerCase() === 'platinum')
      : Boolean(game?.platinumType || game?.platinum_type);
    if (hasPlatinum) return `${name} — Guia de platina e troféus`;
    return name;
  }

  function formatDisplayDate(value) {
    if (!value) return 'Sem data';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sem data';
    return date.toLocaleDateString('pt-BR');
  }

  function formatRelativeDate(value) {
    if (!value) return 'Agora';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Agora';
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.max(Math.round(diffMs / 36e5), 0);
    if (diffHours < 1) return 'Agora';
    if (diffHours < 24) return `${diffHours}h atrás`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString('pt-BR');
  }

  function getLibraryStatusLabel(status, progress) {
    const normalized = String(status || '').replace(/_/g, '-');
    if (normalized === 'completed' || progress >= 100) return '100% concluído';
    if (normalized === 'paused') return 'Pausado';
    if (normalized === 'in-progress' || progress > 0) return 'Em andamento';
    return 'Salvo para depois';
  }

  function formatCatalogCount(count) {
    const value = Number(count || 0);
    return `${value} ${value === 1 ? 'jogo' : 'jogos'}`;
  }

  function firstGuideText(...values) {
    return values.map(value => String(value || '').trim()).find(Boolean) || '';
  }

  function getCoverageDisplayLabel(level = '') {
    const value = String(level || '').trim().toLowerCase();
    if (value === 'complete') return 'completa';
    if (value === 'strong') return 'forte';
    if (value === 'partial') return 'parcial';
    return value || 'parcial';
  }

  return {
    buildBreadcrumbsHtml,
    buildGameSeoTitle,
    buildGameSeoDescription,
    buildGameGuideH1,
    formatDisplayDate,
    formatRelativeDate,
    getLibraryStatusLabel,
    formatCatalogCount,
    firstGuideText,
    getCoverageDisplayLabel
  };
})();
