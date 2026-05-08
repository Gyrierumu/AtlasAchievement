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
    return `${name}: guia de trof\u00e9us, roadmap e tempo para platinar | AtlasAchievement`;
  }

  function buildGameSeoDescription(game = {}) {
    const name = String(game?.name || 'este jogo').trim() || 'este jogo';
    return `Veja dificuldade, tempo estimado, runs, trof\u00e9us perd\u00edveis, roadmap e checklist para platinar ${name} com menos retrabalho.`;
  }

  function buildGameGuideH1(game = {}) {
    const name = String(game?.name || 'Guia').trim() || 'Guia';
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
