window.UI = (() => {
  const toastTimer = { id: null };
  const { qs, qsa, has, setClass, getGameImageSrc, getGameCoverSrc, escapeHtml, escapeAttribute } = window.UIShared;
  const { buildBreadcrumbsHtml, buildGameSeoTitle, buildGameSeoDescription } = window.UIFormatters;
  const { buildContextualFaq, getEditorialBadge } = window.UIDecisionModels;

  function showToast(message, type = 'success') {
    const toast = qs('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'} show`;
    if (toastTimer.id) clearTimeout(toastTimer.id);
    toastTimer.id = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function setLoading(loading) {
    setClass('#loading', 'hidden', !loading);
    if (loading) {
      setClass('#guideDecisionStack', 'hidden', true);
      setClass('#guideContent', 'hidden', true);
    }
  }

  function updateLibraryBadge(library) {
    const count = Object.keys(library).length;
    [qs('#libraryBadge'), ...qsa('[data-mobile-library-badge]')].filter(Boolean).forEach(badge => {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    });
  }

  function showView(viewId) {
    qsa('main > section').forEach(section => section.classList.add('hidden'));
    const target = qs(`#view-${viewId}`);
    if (target) target.classList.remove('hidden');
    setSinglePublicHeading(viewId);
    qsa('[data-view-link]').forEach(button => {
      const isActive = button.dataset.viewLink === viewId;
      button.classList.toggle('is-active', isActive);
    });
  }

  function setSearchFeedback(message = '', type = 'default') {
    const feedback = qs('#searchFeedback');
    if (!feedback) return;
    if (type === 'success' && message) {
      showToast(message, 'success');
      type = 'default';
      message = 'Compare antes de começar: tempo, dificuldade, perdíveis e roadmap.';
    }
    feedback.textContent = message || '';
    feedback.className = `atlas-search-feedback atlas-search-feedback--${type === 'error' ? 'error' : 'default'}`;
  }

  function renderSuggestions(games, options = {}) {
    const suggestionsDiv = qs('#suggestions');
    if (!suggestionsDiv) return;
    const activeIndex = Number.isInteger(options.activeIndex) ? options.activeIndex : -1;

    if (!games.length) {
      suggestionsDiv.innerHTML = '';
      suggestionsDiv.classList.add('hidden');
      suggestionsDiv.setAttribute('aria-expanded', 'false');
      qs('#gameInput')?.setAttribute('aria-expanded', 'false');
      setSearchFeedback('Nenhum jogo encontrado com esse nome. Tente outro termo.', 'error');
      return;
    }

    setSearchFeedback(`Abrindo o resultado mais próximo ao pressionar Enter. ${games.length} sugestão(ões) encontrada(s).`, 'default');
    suggestionsDiv.innerHTML = games.map((game, index) => {
      const isActive = index === activeIndex;
      const coverImage = getGameCoverSrc ? getGameCoverSrc(game) : getGameImageSrc(game.cover_image || game.image || '');
      const imageMarkup = coverImage
        ? `<span class="atlas-suggestion-thumb"><span>${escapeHtml(game.name || 'Jogo')}</span><img src="${escapeAttribute(coverImage)}" alt="" loading="lazy" decoding="async" width="40" height="56" sizes="40px" onerror="this.hidden=true;this.parentElement.classList.add('is-fallback');"></span>`
        : `<span class="atlas-suggestion-thumb is-fallback"><span>${escapeHtml(game.name || 'Jogo')}</span></span>`;
      const meta = [`Dificuldade ${escapeHtml(game.difficulty || '?')}/10`, escapeHtml(game.time || 'Tempo não informado')].join(' • ');
      return `
        <button
          type="button"
          class="atlas-suggestion-item ${isActive ? 'is-active' : ''}"
          data-suggestion="${escapeAttribute(game.name)}"
          data-suggestion-index="${index}"
          data-suggestion-slug="${escapeAttribute(game.slug || '')}"
          role="option"
          aria-selected="${isActive ? 'true' : 'false'}"
        >
          <span class="flex items-center gap-3">
            ${imageMarkup}
            <span class="min-w-0">
              <span class="block font-semibold text-white truncate">${escapeHtml(game.name)}</span>
              <span class="mt-1 block text-xs text-slate-400 truncate">${meta}</span>
            </span>
          </span>
          <span class="text-[11px] uppercase tracking-[0.18em] text-sky-200/80">Abrir</span>
        </button>
      `;
    }).join('');
    suggestionsDiv.classList.remove('hidden');
    suggestionsDiv.setAttribute('aria-expanded', 'true');
    qs('#gameInput')?.setAttribute('aria-expanded', 'true');
  }

  function hideSuggestions() {
    const suggestions = qs('#suggestions');
    if (suggestions) {
      suggestions.classList.add('hidden');
      suggestions.setAttribute('aria-expanded', 'false');
      qs('#gameInput')?.setAttribute('aria-expanded', 'false');
    }
  }

  function setGuideEmptyState(visible, message = 'Nenhum troféu corresponde ao filtro atual. Limpe a busca ou troque o filtro.') {
    const empty = qs('#guideEmptyState');
    if (!empty) return;
    if (message && typeof message === 'object') {
      const title = escapeHtml(message.title || 'Nenhum troféu corresponde ao filtro atual.');
      const detail = escapeHtml(message.detail || 'Tente limpar filtros ou buscar por outro termo.');
      empty.innerHTML = `
        <div class="atlas-guide-empty__copy">
          <strong>${title}</strong>
          <span>${detail}</span>
        </div>
        <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-guide-clear-filters="true">Limpar filtros</button>
      `;
    } else {
      empty.innerHTML = `
        <div class="atlas-guide-empty__copy">
          <strong>${escapeHtml(String(message || 'Nenhum troféu corresponde ao filtro atual.'))}</strong>
          <span>Tente limpar filtros ou buscar por outro termo.</span>
        </div>
        <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-guide-clear-filters="true">Limpar filtros</button>
      `;
    }
    empty.classList.toggle('hidden', !visible);
  }

  function replaceElementTag(element, tagName) {
    if (!element || !tagName || element.tagName?.toLowerCase() === tagName) return element;
    const next = document.createElement(tagName);
    Array.from(element.attributes || []).forEach(attr => next.setAttribute(attr.name, attr.value));
    next.innerHTML = element.innerHTML;
    element.replaceWith(next);
    return next;
  }

  function setSinglePublicHeading(viewId = 'home') {
    if (typeof document === 'undefined') return;
    replaceElementTag(qs('#homeHeroHeading'), viewId === 'home' ? 'h1' : 'h2');
    replaceElementTag(qs('#catalogTitle'), viewId === 'catalog' ? 'h1' : 'h2');
    if (viewId !== 'guide') qsa('#guideHeader h1').forEach(heading => replaceElementTag(heading, 'h2'));
  }

  function renderPagination(targetSelector, pagination = {}, options = {}) {
    const target = qs(targetSelector);
    if (!target) return;

    const page = Number(pagination.page || 1);
    const totalPages = Number(pagination.totalPages || 1);
    const total = Number(pagination.total || 0);
    const itemLabel = options.itemLabel || 'itens';

    if (!total || totalPages <= 1) {
      target.innerHTML = total
        ? `<div class="${options.compact ? 'atlas-pagination-summary' : 'text-sm text-white/45'}">${total} ${itemLabel}${options.compact ? '' : ' no total.'}</div>`
        : '';
      return;
    }

    const windowStart = Math.max(1, page - 2);
    const windowEnd = Math.min(totalPages, page + 2);
    const pages = [];
    for (let value = windowStart; value <= windowEnd; value += 1) pages.push(value);

    const summaryClass = options.compact ? 'atlas-pagination-summary' : 'text-sm text-white/45 mr-2';
    const summaryText = options.compact
      ? `${total} ${itemLabel} · página ${page} de ${totalPages}`
      : `Página ${page} de ${totalPages} • ${total} ${itemLabel}`;

    target.innerHTML = `
      <div class="${summaryClass}">${escapeHtml(summaryText)}</div>
      <button type="button" class="atlas-btn atlas-btn-secondary" data-page-target="${escapeAttribute(options.mode || 'catalog')}" data-page-value="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
      ${pages.map(value => `<button type="button" class="atlas-pill ${value === page ? 'atlas-pill-active' : ''}" data-page-target="${escapeAttribute(options.mode || 'catalog')}" data-page-value="${value}">${value}</button>`).join('')}
      <button type="button" class="atlas-btn atlas-btn-secondary" data-page-target="${escapeAttribute(options.mode || 'catalog')}" data-page-value="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Próxima</button>
    `;
  }

  function setPageMeta(game = null) {
    const statusBadge = game ? getEditorialBadge(game) : null;
    const title = game
      ? buildGameSeoTitle(game)
      : 'AtlasAchievement - Guias de Platina com Roadmap e Checklist';
    const description = game
      ? buildGameSeoDescription(game)
      : 'Compare tempo, dificuldade, perdíveis, online e roadmaps de platina em guias de troféus com checklist e progresso salvo.';
    const canonical = game?.slug ? `${window.location.origin}/jogo/${game.slug}` : `${window.location.origin}/`;
    const image = !game?.image
      ? `${window.location.origin}/og-default.svg`
      : /^https?:\/\//i.test(game.image)
        ? game.image
        : `${window.location.origin}${game.image}`;
    const faqItems = game ? buildContextualFaq(game, { trophies: game.trophies || [], roadmap: game.roadmap || [] }) : [];
    const structuredData = game
      ? { '@context': 'https://schema.org', '@graph': [{ '@type': 'VideoGame', name: game.name, image, description, url: canonical, additionalProperty: [{ '@type': 'PropertyValue', name: 'Status editorial', value: statusBadge?.label || 'Publicado' }, { '@type': 'PropertyValue', name: 'Cobertura', value: game.coverage_level || 'partial' }, { '@type': 'PropertyValue', name: 'Verificado manualmente', value: game.is_verified ? 'sim' : 'não' }] }, { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Início', item: `${window.location.origin}/` }, { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${window.location.origin}/catalogo` }, { '@type': 'ListItem', position: 3, name: game.name, item: canonical }] }, ...(faqItems.length ? [{ '@type': 'FAQPage', url: canonical, mainEntity: faqItems.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }] : [])] }
      : { '@context': 'https://schema.org', '@type': 'WebSite', name: 'AtlasAchievement', description, url: canonical };

    document.title = title;

    const ensureMeta = (selector, attr, value) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const [key, keyValue] = selector.includes('property=') ? ['property', selector.match(/property="([^"]+)"/)?.[1]] : ['name', selector.match(/name="([^"]+)"/)?.[1]];
        if (keyValue) el.setAttribute(key, keyValue);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonical);

    const robotsMeta = document.head.querySelector('meta[name="robots"]');
    if (robotsMeta && /noindex/i.test(robotsMeta.getAttribute('content') || '')) {
      robotsMeta.remove();
    }

    ensureMeta('meta[name="description"]', 'content', description);
    ensureMeta('meta[property="og:title"]', 'content', title);
    ensureMeta('meta[property="og:description"]', 'content', description);
    ensureMeta('meta[property="og:type"]', 'content', game ? 'article' : 'website');
    ensureMeta('meta[property="og:url"]', 'content', canonical);
    ensureMeta('meta[property="og:image"]', 'content', image);
    ensureMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    ensureMeta('meta[name="twitter:title"]', 'content', title);
    ensureMeta('meta[name="twitter:description"]', 'content', description);
    ensureMeta('meta[name="twitter:image"]', 'content', image);

    const guideBreadcrumbs = qs('#guideBreadcrumbs');
    if (guideBreadcrumbs) guideBreadcrumbs.innerHTML = game ? buildBreadcrumbsHtml([{ label: 'Início', href: '/' }, { label: 'Catálogo', href: '/catalogo' }, { label: game.name }]) : '';
    let jsonLd = document.getElementById('gameStructuredData');
    if (!jsonLd) {
      jsonLd = document.createElement('script');
      jsonLd.type = 'application/ld+json';
      jsonLd.id = 'gameStructuredData';
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = JSON.stringify(structuredData);
  }

  const common = {
    qs,
    qsa,
    has,
    showToast,
    setLoading,
    updateLibraryBadge,
    showView,
    setSearchFeedback,
    renderSuggestions,
    hideSuggestions,
    setGuideEmptyState,
    renderPagination,
    setPageMeta
  };

  return {
    ...common,
    ...(window.UIHome || {}),
    ...(window.UICatalog || {}),
    ...(window.UILibrary || {}),
    ...(window.UIGuide || {}),
    ...(window.UIAdminRender || {})
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.UI = window.UI;
}
