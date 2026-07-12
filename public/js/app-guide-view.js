window.AppGuideView = (() => {
  function setGuideSectionExpanded(button, expanded) {
    if (!button) return;
    const contentId = button.dataset.guideSectionToggle || button.getAttribute('aria-controls');
    const content = contentId ? document.getElementById(contentId) : null;
    if (!content) return;

    const isExpanded = Boolean(expanded);
    content.classList.toggle('is-collapsed', !isExpanded);
    content.hidden = !isExpanded;
    content.setAttribute('aria-hidden', isExpanded ? 'false' : 'true');
    button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');

    const label = button.querySelector('[data-toggle-label]');
    if (label) {
      label.textContent = isExpanded
        ? (button.dataset.expandedLabel || 'Ocultar detalhes')
        : (button.dataset.collapsedLabel || 'Mostrar detalhes');
    }

    const icon = button.querySelector('i');
    if (icon) {
      icon.classList.toggle('fa-chevron-up', isExpanded);
      icon.classList.toggle('fa-chevron-down', !isExpanded);
    }
  }

  function toggleGuideSection(button) {
    const expanded = button?.getAttribute('aria-expanded') !== 'true';
    setGuideSectionExpanded(button, expanded);
  }

  function getGuideTabFromHashLink(hash = '') {
    const id = String(hash || '').replace(/^#/, '').trim().toLowerCase();
    const tabByHash = {
      roadmap: 'roadmap',
      guideroadmappanel: 'roadmap',
      guidechapterroutepanel: 'roadmap',
      guideprofessionalaipanel: 'roadmap',
      guidefarmroutespanel: 'roadmap',
      guidecommonmythspanel: 'roadmap',
      guidequickplan: 'summary',
      guidesummaryactions: 'summary',
      guidechecklistpanel: 'checklist',
      guideplatinumextraspanel: 'extras',
      guidedlccompletionpanel: 'dlcs',
      guideattentionpointspanel: 'details',
      guidefaqpanel: 'details',
      guideeditorialnotespanel: 'details',
      guidecommentspanel: 'details',
      're5-versus-dlc': 'dlcs',
      're5-lost-in-nightmares-score-stars': 'dlcs',
      're5-desperate-escape-agitator-majini': 'dlcs'
    };
    return tabByHash[id] || '';
  }

  function scrollGuideHashTarget(hash = '') {
    const rawId = String(hash || '').replace(/^#/, '').trim();
    if (!rawId) return;
    let targetId = rawId;
    try {
      targetId = decodeURIComponent(rawId);
    } catch (_error) {}
    const element = document.getElementById(targetId);
    if (!element) return;
    const sectionBody = element.matches?.('[data-guide-section-content]')
      ? element
      : element.querySelector?.('[data-guide-section-content]') || element.closest?.('[data-guide-section-content]');
    if (sectionBody?.classList.contains('is-collapsed')) {
      const toggle = document.querySelector(`[data-guide-section-toggle="${sectionBody.id}"]`);
      if (toggle) setGuideSectionExpanded(toggle, true);
      else {
        sectionBody.classList.remove('is-collapsed');
        sectionBody.hidden = false;
        sectionBody.setAttribute('aria-hidden', 'false');
      }
    }
    const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    const sectionLinks = Array.from(document.querySelectorAll('[data-guide-section-link]'));
    const activeSectionLink = sectionLinks.find(link => link.getAttribute('href') === `#${targetId}`)
      || sectionLinks.find(link => link.dataset.guideSectionLink === element.id)
      || sectionLinks.find(link => element.closest?.(`#${link.dataset.guideSectionLink}`));
    const activeSectionId = activeSectionLink?.dataset.guideSectionLink || element.id;
    if (typeof window.UI?.lockGuideSectionActive === 'function') window.UI.lockGuideSectionActive(activeSectionId);
    else window.UI?.setGuideSectionActive?.(activeSectionId);
  }

  function bindGuideInteractions({ UI, state, toggleTrophy, focusGuideAction, handleGuideQuickDockClick }) {
    const getVisibleFilterButtons = () => UI.qsa('.filter-btn').filter(item => item.offsetParent !== null);
    state.checklistDensity = UI.applyChecklistDensity?.(state.checklistDensity || UI.getChecklistDensityPreference?.()) || 'comfortable';

    UI.qsa('[data-checklist-density]').forEach(button => {
      button.addEventListener('click', () => {
        state.checklistDensity = UI.setChecklistDensity?.(button.dataset.checklistDensity) || button.dataset.checklistDensity;
      });
    });

    UI.qsa('.filter-btn').forEach(button => {
      button.addEventListener('click', () => {
        state.activeFilter = button.dataset.filter;
        UI.applyTrophyFilter(state.activeFilter, state.guideSearch);
      });

      button.addEventListener('keydown', event => {
        if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
        event.preventDefault();
        const buttons = getVisibleFilterButtons();
        const index = buttons.indexOf(button);
        if (index === -1) return;
        const nextIndex = event.key === 'ArrowRight'
          ? (index + 1) % buttons.length
          : (index - 1 + buttons.length) % buttons.length;
        buttons[nextIndex].focus();
      });
    });

    UI.bindGuideSearch(event => {
      state.guideSearch = event.target.value || '';
      UI.applyTrophyFilter(state.activeFilter, state.guideSearch);
    });

    UI.qs('#trophyList')?.addEventListener('click', event => {
      const toggleButton = event.target.closest('[data-trophy-toggle]');
      if (toggleButton) return toggleTrophy(toggleButton.dataset.trophyToggle);

      const clearFiltersButton = event.target.closest('[data-guide-clear-filters]');
      if (clearFiltersButton) {
        state.activeFilter = 'all';
        state.guideSearch = '';
        UI.clearGuideChecklistFilters?.() || UI.applyTrophyFilter(state.activeFilter, state.guideSearch);
        return;
      }

      const detailsToggle = event.target.closest('[data-trophy-details-toggle]');
      if (detailsToggle) {
        const card = detailsToggle.closest('.trophy-card');
        if (!card) return;
        const expanded = !card.classList.contains('is-details-open');
        card.classList.toggle('is-details-open', expanded);
        detailsToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        const label = detailsToggle.querySelector('[data-details-label]');
        if (label) label.textContent = expanded ? 'Ocultar detalhes' : 'Ver detalhes';
        return;
      }

      const spoilerToggle = event.target.closest('[data-spoiler-toggle]');
      if (spoilerToggle) {
        const card = spoilerToggle.closest('.trophy-card');
        if (!card) return;
        const hiddenParts = card.querySelectorAll('[data-spoiler]');
        hiddenParts.forEach(spoiler => {
          spoiler.classList.remove('spoiler-blur');
          spoiler.classList.add('spoiler-unveiled');
          spoiler.setAttribute('aria-hidden', 'false');
        });
        spoilerToggle.setAttribute('aria-expanded', 'true');
        spoilerToggle.textContent = 'Spoiler revelado';
        spoilerToggle.disabled = true;
        return;
      }
    });

    UI.qs('#view-guide')?.addEventListener('click', async event => {
      const tabButton = event.target.closest('[data-guide-tab-target]');
      if (tabButton) {
        event.preventDefault();
        state.activeGuideTab = tabButton.dataset.guideTabButton || tabButton.dataset.guideTabTarget || 'summary';
        UI.activateGuideTab?.(state.activeGuideTab, { scroll: true });
        window.AtlasAnalytics?.trackGuideTabChange?.({
          gameSlug: state.currentGame?.slug || '',
          tabName: state.activeGuideTab
        });
        if (state.activeGuideTab === 'trophies') {
          state.activeFilter = 'all';
          UI.applyTrophyFilter(state.activeFilter, state.guideSearch);
        }
        return;
      }

      const sectionToggle = event.target.closest('[data-guide-section-toggle]');
      if (sectionToggle) {
        event.preventDefault();
        toggleGuideSection(sectionToggle);
        return;
      }

      const guideHashLink = event.target.closest('a[href^="#"]');
      const guideHash = guideHashLink?.getAttribute('href') || '';
      const guideHashTab = getGuideTabFromHashLink(guideHash);
      if (guideHashTab) {
        event.preventDefault();
        state.activeGuideTab = guideHashTab;
        UI.activateGuideTab?.(guideHashTab, { scroll: false });
        if (window.history?.pushState) {
          window.history.pushState(null, '', guideHash);
        } else {
          window.location.hash = guideHash;
        }
        window.requestAnimationFrame?.(() => scrollGuideHashTarget(guideHash)) || window.setTimeout(() => scrollGuideHashTarget(guideHash), 0);
        window.setTimeout(() => scrollGuideHashTarget(guideHash), 120);
        return;
      }

      const clearFiltersButton = event.target.closest('[data-guide-clear-filters]');
      if (clearFiltersButton) {
        event.preventDefault();
        state.activeFilter = 'all';
        state.guideSearch = '';
        UI.clearGuideChecklistFilters?.() || UI.applyTrophyFilter(state.activeFilter, state.guideSearch);
        return;
      }

      const guideFeedbackButton = event.target.closest('[data-guide-feedback-open]');
      if (guideFeedbackButton) {
        event.preventDefault();
        const section = document.body?.dataset?.guideActiveTab || state.activeGuideTab || 'summary';
        window.AppFeedback?.openGuideFeedback?.({
          gameName: state.currentGame?.name || guideFeedbackButton.dataset.guideFeedbackGame || '',
          slug: state.currentGame?.slug || guideFeedbackButton.dataset.guideFeedbackSlug || '',
          pageUrl: window.location.href,
          section
        });
        return;
      }

      const topButton = event.target.closest('[data-scroll-top]');
      if (topButton) {
        event.preventDefault();
        const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        return;
      }

      const actionButton = event.target.closest('[data-guide-action]');
      if (actionButton) {
        event.preventDefault();
        focusGuideAction(actionButton.dataset.guideAction || 'trophies');
        return;
      }

      const copyButton = event.target.closest('[data-copy-game-link]');
      if (copyButton) {
        const url = `${window.location.origin}/jogo/${copyButton.dataset.copyGameLink}`;
        try {
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
          else window.prompt('Copie este link:', url);
          UI.showToast('Link da página copiado.', 'success');
        } catch (_error) {
          window.prompt('Copie este link:', url);
        }
      }
    });

    UI.qs('#view-guide')?.addEventListener('change', event => {
      const walkthroughCheck = event.target.closest('[data-walkthrough-check]');
      if (!walkthroughCheck) return;
      walkthroughCheck.closest('.atlas-walkthrough-checklist__item')?.classList.toggle('is-checked', walkthroughCheck.checked);
    });

    UI.qs('#guideQuickDock')?.addEventListener('click', handleGuideQuickDockClick);

    let mobileDockFallbackTimer = 0;
    const syncMobileDockFallback = () => {
      mobileDockFallbackTimer = 0;
      const dock = UI.qs('#guideQuickDock');
      const viewGuide = UI.qs('#view-guide');
      if (!dock || !viewGuide || viewGuide.classList.contains('hidden')) return;
      const isMobile = typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 767px)').matches
        : window.innerWidth <= 767;
      if (!isMobile) return;
      const footerTop = document.querySelector('footer')?.getBoundingClientRect?.().top ?? Number.POSITIVE_INFINITY;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const visible = document.body?.dataset?.guideActiveTab !== 'details'
        && (window.scrollY || document.documentElement.scrollTop || 0) > 160
        && footerTop > viewportHeight + 18;
      dock.classList.toggle('hidden', !visible);
      dock.classList.toggle('is-enabled', true);
      dock.setAttribute('aria-hidden', visible ? 'false' : 'true');
      document.body?.classList.toggle('atlas-guide-dock-enabled', true);
      document.body?.classList.toggle('atlas-guide-dock-active', visible);
    };
    const requestMobileDockFallback = () => {
      if (mobileDockFallbackTimer) return;
      mobileDockFallbackTimer = window.setTimeout(syncMobileDockFallback, 60);
    };
    window.addEventListener('scroll', requestMobileDockFallback, { passive: true });
    window.addEventListener('resize', requestMobileDockFallback);
    window.setTimeout(syncMobileDockFallback, 120);

    const setGuideSectionsPanelOpen = (open, options = {}) => {
      const panel = UI.qs('#guideSectionsPanel');
      const toggle = UI.qs('[data-guide-sections-toggle]');
      const isOpen = Boolean(open && panel);
      if (panel) {
        panel.hidden = !isOpen;
        panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        panel.classList.toggle('is-open', isOpen);
      }
      if (toggle) {
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        toggle.classList.toggle('is-active', isOpen);
        if (!isOpen && options.restoreFocus) {
          try {
            toggle.focus({ preventScroll: true });
          } catch (_error) {
            toggle.focus();
          }
          if (document.activeElement !== toggle) window.setTimeout(() => toggle.focus(), 0);
        }
      }
      document.body?.classList.toggle('atlas-guide-sections-open', isOpen);
    };

    UI.qs('#guideQuickDock')?.addEventListener('click', event => {
      const sectionsToggle = event.target.closest('[data-guide-sections-toggle]');
      if (!sectionsToggle) return;
      event.preventDefault();
      const panel = UI.qs('#guideSectionsPanel');
      setGuideSectionsPanelOpen(!(panel && !panel.hidden));
    });

    document.addEventListener('click', event => {
      const link = event.target.closest('[data-guide-section-link]');
      if (!link) return;
      const action = link.dataset.guideAction || '';
      const href = link.getAttribute('href') || '';
      if (action) {
        event.preventDefault();
        focusGuideAction(action);
        if (typeof UI.lockGuideSectionActive === 'function') UI.lockGuideSectionActive(link.dataset.guideSectionLink || '');
        else UI.setGuideSectionActive?.(link.dataset.guideSectionLink || '');
        if (href && window.history?.pushState) window.history.pushState(null, '', href);
        else if (href) window.location.hash = href;
      }
      if (link.closest('#guideSectionsPanel')) {
        setGuideSectionsPanelOpen(false);
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !UI.qs('#guideSectionsPanel')?.hidden) {
        event.preventDefault();
        setGuideSectionsPanelOpen(false, { restoreFocus: true });
      }
    });

    const syncHashTarget = () => {
      const hash = window.location.hash || '';
      const tab = getGuideTabFromHashLink(hash);
      if (!tab) return;
      state.activeGuideTab = tab;
      UI.activateGuideTab?.(tab, { scroll: false });
      window.requestAnimationFrame?.(() => scrollGuideHashTarget(hash)) || window.setTimeout(() => scrollGuideHashTarget(hash), 0);
      window.setTimeout(() => scrollGuideHashTarget(hash), 120);
    };
    window.addEventListener('hashchange', syncHashTarget);
    window.setTimeout(syncHashTarget, 0);

    UI.qs('#view-guide')?.addEventListener('click', async event => {
      const relatedLink = event.target.closest('[data-home-game]');
      if (relatedLink) {
        event.preventDefault();
        window.AtlasAnalytics?.trackGameCardClick?.({
          element: relatedLink,
          gameSlug: relatedLink.dataset.openGuideCard || '',
          gameTitle: relatedLink.dataset.homeGame || '',
          origin: 'related_games'
        });
        const handler = state.loadGuideByName;
        if (typeof handler === 'function') await handler(relatedLink.dataset.homeGame, { analyticsSource: 'related_games' });
      }
    });
  }

  return {
    bindGuideInteractions
  };
})();
