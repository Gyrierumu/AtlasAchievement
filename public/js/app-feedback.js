window.AppFeedback = (() => {
  const FEEDBACK_TYPES = ['Erro em guia', 'Bug do site', 'Sugestão', 'Pedido de novo guia'];
  const MESSAGE_LIMIT = 2000;
  const MESSAGE_MIN = 10;

  function qs(selector) {
    return document.querySelector(selector);
  }

  function setOpen(open) {
    const modal = qs('#feedbackModal');
    if (!modal) return;
    modal.classList.toggle('hidden', !open);
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body?.classList.toggle('atlas-feedback-open', open);
    if (open) {
      prepareForm();
      window.setTimeout(() => qs('#feedbackMessage')?.focus(), 0);
    }
  }

  function inferRelatedGame() {
    const title = qs('#guideHeader h1')?.textContent?.trim();
    return title || '';
  }

  function syncTypeButtons(type) {
    const value = FEEDBACK_TYPES.includes(type) ? type : 'Bug do site';
    const input = qs('#feedbackType');
    if (input) input.value = value;
    document.querySelectorAll('[data-feedback-type]').forEach(button => {
      const active = button.dataset.feedbackType === value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function prepareForm() {
    const form = qs('#feedbackForm');
    if (!form) return;
    const pageUrl = qs('#feedbackPageUrl');
    const relatedGame = qs('#feedbackRelatedGame');
    const startedAt = qs('#feedbackFormStartedAt');
    if (pageUrl) pageUrl.value = window.location.href;
    if (relatedGame && !relatedGame.value.trim()) relatedGame.value = inferRelatedGame();
    if (startedAt) startedAt.value = String(Date.now());
    syncTypeButtons(qs('#feedbackType')?.value || 'Bug do site');
    updateCounter();
    setFeedbackMessage('');
    setSuccessActions(false);
    setSubmitting(false);
  }

  function updateCounter() {
    const message = qs('#feedbackMessage');
    const counter = qs('#feedbackMessageCounter');
    if (!message || !counter) return;
    const trimmedLength = message.value.trim().length;
    counter.textContent = `${message.value.length}/${MESSAGE_LIMIT}`;
    counter.dataset.tone = trimmedLength >= MESSAGE_MIN || message.value.length === 0 ? 'neutral' : 'warn';
  }

  function setFeedbackMessage(message = '', tone = 'info') {
    const target = qs('#feedbackFormStatus');
    if (!target) return;
    target.textContent = message;
    target.dataset.tone = tone;
    target.hidden = !message;
  }

  function setSuccessActions(visible) {
    const actions = qs('#feedbackSuccessActions');
    if (actions) actions.hidden = !visible;
  }

  function setSubmitting(submitting) {
    const submitButton = qs('#feedbackSubmitBtn');
    if (!submitButton) return;
    submitButton.disabled = submitting;
    submitButton.textContent = submitting ? 'Enviando...' : 'Enviar feedback';
  }

  function collectPayload() {
    return {
      type: qs('#feedbackType')?.value || 'Bug do site',
      relatedGame: qs('#feedbackRelatedGame')?.value?.trim() || '',
      pageUrl: qs('#feedbackPageUrl')?.value?.trim() || window.location.href,
      message: qs('#feedbackMessage')?.value?.trim() || '',
      nickname: qs('#feedbackNickname')?.value?.trim() || '',
      email: qs('#feedbackEmail')?.value?.trim() || '',
      website: qs('#feedbackWebsite')?.value?.trim() || '',
      formStartedAt: qs('#feedbackFormStartedAt')?.value || ''
    };
  }

  function getFeedbackGameSlug(pageUrl = '') {
    try {
      const url = new URL(pageUrl || window.location.href, window.location.origin);
      const match = url.pathname.match(/^\/jogo\/([^/]+)/);
      return match ? decodeURIComponent(match[1]) : '';
    } catch (error) {
      return '';
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = collectPayload();

    if (!payload.message) {
      setFeedbackMessage('Escreva uma mensagem antes de enviar.', 'error');
      qs('#feedbackMessage')?.focus();
      return;
    }
    if (payload.message.length < MESSAGE_MIN) {
      setFeedbackMessage(`Escreva pelo menos ${MESSAGE_MIN} caracteres para o feedback ficar útil.`, 'error');
      qs('#feedbackMessage')?.focus();
      return;
    }
    if (payload.message.length > MESSAGE_LIMIT) {
      setFeedbackMessage(`Mensagem muito longa. Use até ${MESSAGE_LIMIT} caracteres.`, 'error');
      qs('#feedbackMessage')?.focus();
      return;
    }

    try {
      setSubmitting(true);
      setSuccessActions(false);
      setFeedbackMessage('Enviando feedback...', 'info');
      await window.ApiService.submitFeedback(payload);
      window.AtlasAnalytics?.trackFeedbackSubmit?.({
        feedbackType: payload.type,
        gameSlug: getFeedbackGameSlug(payload.pageUrl),
        pageContext: (() => {
          try {
            return new URL(payload.pageUrl || window.location.href, window.location.origin).pathname;
          } catch (_error) {
            return window.location.pathname;
          }
        })()
      });
      form.reset();
      syncTypeButtons('Bug do site');
      prepareForm();
      setFeedbackMessage('Feedback enviado com sucesso. Obrigado por ajudar a melhorar o AtlasAchievement.', 'success');
      setSuccessActions(true);
      window.UI?.showToast?.('Feedback enviado. Obrigado!', 'success');
    } catch (error) {
      const message = error.message || 'Não foi possível enviar seu feedback agora. Tente novamente em instantes.';
      setFeedbackMessage(message, 'error');
      window.UI?.showToast?.(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function bind() {
    document.addEventListener('click', event => {
      const typeButton = event.target.closest('[data-feedback-type]');
      if (typeButton) {
        syncTypeButtons(typeButton.dataset.feedbackType);
        return;
      }
      if (event.target.closest('[data-feedback-open]')) {
        setOpen(true);
        return;
      }
      if (event.target.closest('[data-feedback-close]')) {
        setOpen(false);
        return;
      }
      if (event.target.closest('[data-feedback-reset]')) {
        qs('#feedbackForm')?.reset();
        syncTypeButtons('Bug do site');
        prepareForm();
        qs('#feedbackMessage')?.focus();
        return;
      }
      if (event.target.id === 'feedbackModal') setOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !qs('#feedbackModal')?.classList.contains('hidden')) {
        setOpen(false);
      }
    });
    qs('#feedbackForm')?.addEventListener('submit', handleSubmit);
    qs('#feedbackMessage')?.addEventListener('input', updateCounter);
  }

  return { bind, setOpen, collectPayload, syncTypeButtons };
})();

document.addEventListener('DOMContentLoaded', () => {
  window.AppFeedback?.bind?.();
});
