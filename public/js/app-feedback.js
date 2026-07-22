window.AppFeedback = (() => {
  const FEEDBACK_TYPES = ['Erro em guia', 'Bug do site', 'Sugestão', 'Pedido de novo guia'];
  const MESSAGE_LIMIT = 2000;
  const MESSAGE_MIN = 10;
  const RE5_SLUG = 'resident-evil-5';

  function qs(selector) {
    return document.querySelector(selector);
  }

  function getGuideSectionLabel(section = '') {
    const labels = {
      summary: 'Resumo',
      roadmap: 'Roadmap',
      checklist: 'Checklist',
      trophies: 'Checklist',
      details: 'Detalhes'
    };
    return labels[String(section || '').trim()] || 'Página de guia';
  }

  function getCurrentPageUrl() {
    try {
      return new URL(window.location.href).href;
    } catch (_error) {
      return `${window.location.origin || ''}${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`;
    }
  }

  function normalizePageUrl(value = '') {
    const candidate = String(value || '').trim();
    try {
      return new URL(candidate || getCurrentPageUrl(), window.location.origin).href;
    } catch (_error) {
      return getCurrentPageUrl();
    }
  }

  function getPageSlug(value = window.location.href) {
    try {
      return decodeURIComponent(new URL(value, window.location.origin).pathname.match(/^\/jogo\/([^/]+)/)?.[1] || '');
    } catch (_error) {
      return '';
    }
  }

  function getActiveGuideTab() {
    return document.querySelector('#guideLayerNav [role="tab"][aria-selected="true"]')?.dataset.guideTabButton || 'summary';
  }

  function getViewportBucket() {
    if (window.innerWidth < 600) return 'small';
    if (window.innerWidth < 1024) return 'medium';
    return 'large';
  }

  function safeAnchor(value = '') {
    const candidate = String(value || '').trim().replace(/^#?/, '#');
    return /^#[a-z0-9][a-z0-9:_-]*$/i.test(candidate) ? candidate : '';
  }

  function ensureRe5GovernanceFields(context = {}, enabled = false) {
    let block = qs('#feedbackRe5Governance');
    if (!block) {
      const contextSection = qs('#feedbackContextBlockTitle')?.closest('section');
      if (!contextSection) return;
      contextSection.insertAdjacentHTML('beforeend', `
        <div id="feedbackRe5Governance" class="atlas-feedback-block" hidden>
          <div class="atlas-feedback-block__head">
            <h4>Contexto editorial do RE5</h4>
            <p>Seu relato é uma pista para triagem humana; uma fonte informada não é tratada automaticamente como prova.</p>
          </div>
          <div class="atlas-feedback-grid">
            <label class="atlas-feedback-field">Categoria <span class="atlas-field-tag">obrigatório</span>
              <select id="feedbackCategory" class="atlas-input" required>
                <option value="Informação incorreta">Informação incorreta</option>
                <option value="Instrução incompleta">Instrução incompleta</option>
                <option value="Link quebrado">Link quebrado</option>
                <option value="Problema visual">Problema visual</option>
                <option value="Acessibilidade">Acessibilidade</option>
                <option value="Checklist/progresso">Checklist/progresso</option>
                <option value="Problema mobile">Problema mobile</option>
                <option value="Outro">Outro</option>
              </select>
            </label>
            <label class="atlas-feedback-field">Seção ou âncora <span class="atlas-field-tag">obrigatório</span>
              <input id="feedbackSectionAnchor" class="atlas-input" maxlength="160" required autocomplete="off">
            </label>
            <label class="atlas-feedback-field">Plataforma/versão <span class="atlas-field-tag">obrigatório</span>
              <input id="feedbackPlatformVersion" class="atlas-input" maxlength="100" required autocomplete="off" value="PS4/Remaster">
            </label>
            <label class="atlas-feedback-field">Fonte de apoio <span class="atlas-field-tag atlas-field-tag--optional">opcional</span>
              <input id="feedbackSourceUrl" type="url" class="atlas-input" maxlength="500" autocomplete="url" placeholder="https://...">
              <small>A equipe não abre URLs automaticamente; toda fonte passa por triagem segura.</small>
            </label>
          </div>
          <input id="feedbackGuideSlug" type="hidden">
          <input id="feedbackFrontendVersion" type="hidden">
          <input id="feedbackReportDate" type="hidden">
          <input id="feedbackViewportBucket" type="hidden">
          <input id="feedbackActiveTab" type="hidden">
        </div>`);
      block = qs('#feedbackRe5Governance');
    }
    block.hidden = !enabled;
    block.querySelectorAll('input,select').forEach(field => { field.disabled = !enabled; });
    if (!enabled) return;
    const activeTab = getActiveGuideTab();
    const anchor = safeAnchor(context.anchor || window.location.hash || context.section) || `#guideTab-${activeTab}`;
    qs('#feedbackGuideSlug').value = RE5_SLUG;
    qs('#feedbackSectionAnchor').value = anchor;
    qs('#feedbackPlatformVersion').value = String(context.platformVersion || 'PS4/Remaster').slice(0, 100);
    qs('#feedbackFrontendVersion').value = document.documentElement.dataset.buildVersion || 'web-4.0.0';
    qs('#feedbackReportDate').value = new Date().toISOString().slice(0, 10);
    qs('#feedbackViewportBucket').value = getViewportBucket();
    qs('#feedbackActiveTab').value = activeTab;
  }

  function normalizeRe5PageUrl(value = '') {
    const url = new URL(value || getCurrentPageUrl(), window.location.origin);
    url.search = '';
    url.hash = '';
    return url.href;
  }

  function resolveFeedbackPageUrl(context = {}, hasGuideContext = false) {
    if (hasGuideContext) return getCurrentPageUrl();
    return normalizePageUrl(context.pageUrl || getCurrentPageUrl());
  }

  function buildGuideFeedbackMessage(context = {}) {
    const gameName = String(context.gameName || context.game || inferRelatedGame() || '').trim();
    const slug = String(context.slug || getPageSlug(context.pageUrl || getCurrentPageUrl()) || '').trim();
    const pageUrl = slug === RE5_SLUG
      ? normalizeRe5PageUrl(context.pageUrl || getCurrentPageUrl())
      : resolveFeedbackPageUrl(context, true);
    const section = getGuideSectionLabel(context.section);
    const lines = [
      `Guia: ${gameName || 'Não identificado'}`,
      `URL: ${pageUrl}`,
      'Contexto: Página de guia',
      `Seção: ${section}`,
      'Tipo: Erro no guia',
      '',
      'Descreva aqui o problema encontrado:'
    ];
    if (slug) lines.splice(1, 0, `Slug: ${slug}`);
    return lines.join('\n');
  }

  function setOpen(open, context = {}) {
    const modal = open
      ? window.AtlasModalFactories?.ensureFeedbackModal?.()
      : qs('#feedbackModal');
    if (!modal) return;
    bindModalElements();
    modal.classList.toggle('hidden', !open);
    modal.hidden = !open;
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    modal.toggleAttribute('inert', !open);
    document.body?.classList.toggle('atlas-feedback-open', open);
    if (open) {
      prepareForm(context);
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

  function prepareForm(context = {}) {
    const form = qs('#feedbackForm');
    if (!form) return;
    const hasGuideContext = Boolean(context && (context.kind === 'guide' || context.gameName || context.slug));
    const contextSlug = String(context.slug || getPageSlug(context.pageUrl || window.location.href)).trim().toLowerCase();
    const isRe5 = contextSlug === RE5_SLUG;
    form.reset();
    ensureRe5GovernanceFields(context, isRe5);
    const pageUrl = qs('#feedbackPageUrl');
    const relatedGame = qs('#feedbackRelatedGame');
    const message = qs('#feedbackMessage');
    const startedAt = qs('#feedbackFormStartedAt');
    const guideGameName = String(context.gameName || context.game || '').trim();
    const resolvedPageUrl = isRe5
      ? normalizeRe5PageUrl(resolveFeedbackPageUrl(context, true))
      : resolveFeedbackPageUrl(context, hasGuideContext);
    if (pageUrl) pageUrl.value = resolvedPageUrl;
    if (relatedGame && (hasGuideContext || !relatedGame.value.trim())) relatedGame.value = guideGameName || inferRelatedGame();
    if (message && hasGuideContext) message.value = buildGuideFeedbackMessage({ ...context, pageUrl: resolvedPageUrl });
    if (startedAt) startedAt.value = String(Date.now());
    syncTypeButtons(hasGuideContext ? 'Erro em guia' : (qs('#feedbackType')?.value || 'Bug do site'));
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
    const guideSlug = qs('#feedbackGuideSlug:not(:disabled)')?.value || '';
    const rawPageUrl = normalizePageUrl(qs('#feedbackPageUrl')?.value?.trim() || getCurrentPageUrl());
    const pageUrl = guideSlug === RE5_SLUG ? normalizeRe5PageUrl(rawPageUrl) : rawPageUrl;
    return {
      type: qs('#feedbackType')?.value || 'Bug do site',
      relatedGame: qs('#feedbackRelatedGame')?.value?.trim() || '',
      pageUrl,
      message: qs('#feedbackMessage')?.value?.trim() || '',
      nickname: qs('#feedbackNickname')?.value?.trim() || '',
      email: qs('#feedbackEmail')?.value?.trim() || '',
      website: qs('#feedbackWebsite')?.value?.trim() || '',
      formStartedAt: qs('#feedbackFormStartedAt')?.value || '',
      guideSlug,
      category: qs('#feedbackCategory:not(:disabled)')?.value || '',
      sectionAnchor: qs('#feedbackSectionAnchor:not(:disabled)')?.value?.trim() || '',
      platformVersion: qs('#feedbackPlatformVersion:not(:disabled)')?.value?.trim() || '',
      sourceUrl: qs('#feedbackSourceUrl:not(:disabled)')?.value?.trim() || '',
      frontendVersion: qs('#feedbackFrontendVersion:not(:disabled)')?.value || '',
      reportDate: qs('#feedbackReportDate:not(:disabled)')?.value || '',
      viewportBucket: qs('#feedbackViewportBucket:not(:disabled)')?.value || '',
      activeTab: qs('#feedbackActiveTab:not(:disabled)')?.value || ''
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
      await window.ApiService.getCurrentUser();
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

  function bindModalElements() {
    const modal = qs('#feedbackModal');
    if (!modal || modal.dataset.feedbackBound === 'true') return;
    modal.dataset.feedbackBound = 'true';
    qs('#feedbackForm')?.addEventListener('submit', handleSubmit);
    qs('#feedbackMessage')?.addEventListener('input', updateCounter);
  }

  function bind() {
    document.addEventListener('click', event => {
      const typeButton = event.target.closest('[data-feedback-type]');
      if (typeButton) {
        syncTypeButtons(typeButton.dataset.feedbackType);
        return;
      }
      const guideButton = event.target.closest('[data-guide-feedback-open]');
      if (guideButton) {
        event.preventDefault();
        openGuideFeedback({
          gameName: guideButton.dataset.guideFeedbackGame || inferRelatedGame(),
          slug: guideButton.dataset.guideFeedbackSlug || getPageSlug(),
          section: getActiveGuideTab()
        });
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
    bindModalElements();
  }

  function openGuideFeedback(context = {}) {
    setOpen(true, { ...context, pageUrl: getCurrentPageUrl(), kind: 'guide' });
  }

  return { bind, setOpen, openGuideFeedback, collectPayload, syncTypeButtons };
})();

document.addEventListener('DOMContentLoaded', () => {
  window.AppFeedback?.bind?.();
});
