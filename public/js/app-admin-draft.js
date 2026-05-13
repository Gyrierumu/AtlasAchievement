window.AppAdminDraft = (() => {
  const KEY = 'admin_game_draft_v2';
  const LEGACY_KEY = 'admin_game_draft_v1';

  function createAdminDraftController({ form, restoreButton, clearButton }) {
    if (!form) return { init() {} };

    function syncAdminDraftUI() {
      const imageInput = document.getElementById('gameImage');
      if (imageInput && window.UI && typeof window.UI.setImagePreview === 'function') {
        window.UI.setImagePreview(imageInput.value || '');
      }
      if (window.UI && typeof window.UI.updateAdminFieldMetrics === 'function') {
        window.UI.updateAdminFieldMetrics();
      }
      if (typeof window.refreshAdminQuality === 'function') {
        try { window.refreshAdminQuality(); } catch (_error) {}
      }
      if (typeof window.openFormPreview === 'function') {
        try { window.openFormPreview(); } catch (_error) {}
      }
    }

    function collectDraftPayload() {
      const trophies = Array.from(form.querySelectorAll('#trophiesContainer .trophy-input')).map(block => {
        const fields = block.querySelectorAll('input,textarea,select');
        return {
          id: fields[0]?.value?.trim() || '',
          name: fields[1]?.value?.trim() || '',
          type: fields[2]?.value || 'Bronze',
          description: fields[3]?.value?.trim() || '',
          tip: fields[4]?.value?.trim() || '',
          is_missable: Boolean(fields[5]?.checked),
          is_spoiler: Boolean(fields[6]?.checked)
        };
      }).filter(item => item.id || item.name || item.description || item.tip);

      return {
        version: 2,
        fields: {
          gameId: document.getElementById('gameId')?.value || '',
          gameName: document.getElementById('gameName')?.value || '',
          gameDifficulty: document.getElementById('gameDifficulty')?.value || '',
          gameTime: document.getElementById('gameTime')?.value || '',
          gameImage: document.getElementById('gameImage')?.value || '',
          gameCoverImage: document.getElementById('gameCoverImage')?.value || '',
          gameMissable: document.getElementById('gameMissable')?.value || '',
          gameRunsSummary: document.getElementById('gameRunsSummary')?.value || '',
          gameMissableSummary: document.getElementById('gameMissableSummary')?.value || '',
          gameOnlineSummary: document.getElementById('gameOnlineSummary')?.value || '',
          gameGrindSummary: document.getElementById('gameGrindSummary')?.value || '',
          gameDlcScope: document.getElementById('gameDlcScope')?.value || '',
          gameDifficultyReason: document.getElementById('gameDifficultyReason')?.value || '',
          gameTimeReason: document.getElementById('gameTimeReason')?.value || '',
          gameFirstRunAdvice: document.getElementById('gameFirstRunAdvice')?.value || '',
          gameCleanupAdvice: document.getElementById('gameCleanupAdvice')?.value || '',
          gameBeforeYouStart: document.getElementById('gameBeforeYouStart')?.value || '',
          gameBestFor: document.getElementById('gameBestFor')?.value || '',
          gameAvoidIf: document.getElementById('gameAvoidIf')?.value || '',
          gameEditorialStatus: document.getElementById('gameEditorialStatus')?.value || '',
          gameEditorialReviewStatus: document.getElementById('gameEditorialReviewStatus')?.value || '',
          gameLastReviewedAt: document.getElementById('gameLastReviewedAt')?.value || '',
          gameEditorialNotes: document.getElementById('gameEditorialNotes')?.value || '',
          gameQualityWarnings: document.getElementById('gameQualityWarnings')?.value || '',
          gameReviewedBy: document.getElementById('gameReviewedBy')?.value || '',
          gameCoverageLevel: document.getElementById('gameCoverageLevel')?.value || '',
          gameVerificationStatus: document.getElementById('gameVerificationStatus')?.value || '',
          gameIsVerified: Boolean(document.getElementById('gameIsVerified')?.checked),
          gameVerificationNote: document.getElementById('gameVerificationNote')?.value || '',
          gameRoadmap: document.getElementById('gameRoadmap')?.value || '',
          rawTrophiesInput: document.getElementById('rawTrophiesInput')?.value || ''
        },
        trophies
      };
    }

    function save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(collectDraftPayload()));
      } catch (error) {
        console.warn('Não foi possível salvar o rascunho automático.', error);
      }
    }

    function applyStructuredDraft(data) {
      const fields = data?.fields || {};
      Object.entries(fields).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (!field || field.type === 'file') return;
        if (field.type === 'checkbox') field.checked = Boolean(value);
        else field.value = value ?? '';
      });

      if (window.UI && typeof window.UI.replaceTrophyInputs === 'function') {
        const trophies = Array.isArray(data?.trophies) && data.trophies.length ? data.trophies : [{}];
        window.UI.replaceTrophyInputs(trophies);
      }
    }

    function applyLegacyDraft(data) {
      form.querySelectorAll('input,textarea,select').forEach(el => {
        if (el.type === 'file') return;
        const k = el.name || el.id;
        if (!(k && data[k] !== undefined)) return;
        if (el.type === 'checkbox') el.checked = Boolean(data[k]);
        else el.value = data[k];
      });
    }

    function restoreDraft() {
      const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (data?.version === 2) applyStructuredDraft(data);
        else applyLegacyDraft(data);
        syncAdminDraftUI();
        alert('Rascunho restaurado');
      } catch (_error) {
        alert('Não foi possível restaurar o rascunho salvo.');
      }
    }

    function clearDraft() {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LEGACY_KEY);
      if (typeof window.refreshAdminQuality === 'function') {
        try { window.refreshAdminQuality(); } catch (_error) {}
      }
      alert('Rascunho removido');
    }

    function init() {
      form.addEventListener('input', save);
      restoreButton?.addEventListener('click', restoreDraft);
      clearButton?.addEventListener('click', clearDraft);
    }

    return { init };
  }

  return { createAdminDraftController };
})();
