window.AppGuideView = (() => {
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
      const clearFiltersButton = event.target.closest('[data-guide-clear-filters]');
      if (clearFiltersButton) {
        event.preventDefault();
        state.activeFilter = 'all';
        state.guideSearch = '';
        UI.clearGuideChecklistFilters?.() || UI.applyTrophyFilter(state.activeFilter, state.guideSearch);
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

    UI.qs('#guideQuickDock')?.addEventListener('click', handleGuideQuickDockClick);

    UI.qs('#view-guide')?.addEventListener('click', async event => {
      const relatedLink = event.target.closest('[data-home-game]');
      if (relatedLink) {
        event.preventDefault();
        const handler = state.loadGuideByName;
        if (typeof handler === 'function') await handler(relatedLink.dataset.homeGame);
      }
    });
  }

  return {
    bindGuideInteractions
  };
})();
