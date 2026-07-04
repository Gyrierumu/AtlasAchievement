window.AppGuideComments = (() => {
  const MAX_LENGTH = 1000;
  let lastSession = null;

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function formatDate(value = '') {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '');
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
  }

  function getPanel() {
    return qs('[data-guide-comments]');
  }

  function getSlug(panel = getPanel()) {
    return String(panel?.dataset?.guideCommentsSlug || '').trim();
  }

  async function getSession() {
    if (lastSession) return lastSession;
    try {
      lastSession = await window.ApiService.getCurrentUser();
    } catch (_error) {
      lastSession = { authenticated: false, user: null };
    }
    return lastSession;
  }

  function setFeedback(panel, message = '', tone = 'default') {
    const target = qs('[data-guide-comment-feedback]', panel);
    if (!target) return;
    target.textContent = message;
    target.classList.toggle('is-error', tone === 'error');
    target.classList.toggle('is-success', tone === 'success');
  }

  function renderComposer(panel, session) {
    const composer = qs('.atlas-guide-comments__composer', panel);
    if (!composer) return;
    while (composer.firstChild) composer.removeChild(composer.firstChild);

    if (!session?.authenticated) {
      const cta = document.createElement('div');
      cta.className = 'atlas-guide-comments__login-cta';
      const copy = document.createElement('p');
      copy.textContent = 'Entre na sua conta para comentar.';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'atlas-btn atlas-btn-secondary atlas-btn-compact';
      button.dataset.authOpen = 'login';
      button.innerHTML = '<i class="fas fa-right-to-bracket" aria-hidden="true"></i><span>Entrar</span>';
      cta.append(copy, button);
      composer.appendChild(cta);
      return;
    }

    const form = document.createElement('form');
    form.className = 'atlas-guide-comment-form';
    form.dataset.guideCommentForm = 'true';
    form.innerHTML = `
      <label for="guideCommentBody" class="sr-only">Escrever comentário</label>
      <textarea id="guideCommentBody" class="atlas-input atlas-guide-comment-input" name="body" maxlength="1000" minlength="2" rows="4" placeholder="Compartilhe uma dúvida ou dica sobre este guia." data-guide-comment-input></textarea>
      <div class="atlas-guide-comment-form__meta">
        <p>Comentários ofensivos, spam, spoilers sem aviso ou links suspeitos podem ser removidos.</p>
        <span data-guide-comment-counter>0/1000</span>
      </div>
      <div class="atlas-guide-comment-form__actions">
        <button type="submit" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-guide-comment-submit><i class="fas fa-paper-plane" aria-hidden="true"></i><span>Enviar comentário</span></button>
        <p class="atlas-guide-comment-feedback" role="status" aria-live="polite" data-guide-comment-feedback></p>
      </div>
    `;
    composer.appendChild(form);
  }

  function renderComment(list, comment = {}) {
    const article = document.createElement('article');
    article.className = 'atlas-guide-comment';
    if (comment.id) article.dataset.commentId = String(comment.id);

    const meta = document.createElement('div');
    meta.className = 'atlas-guide-comment__meta';
    const author = document.createElement('strong');
    author.textContent = comment.author?.display_name || comment.author?.username || 'Usuário Atlas';
    const time = document.createElement('time');
    if (comment.created_at) time.dateTime = comment.created_at;
    time.textContent = formatDate(comment.created_at);
    meta.append(author, time);

    const body = document.createElement('p');
    body.textContent = comment.body || '';
    article.append(meta, body);

    if (comment.can_delete && comment.id) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'atlas-text-action atlas-guide-comment__delete';
      button.dataset.guideCommentDelete = String(comment.id);
      button.textContent = 'Apagar';
      article.appendChild(button);
    }

    list.appendChild(article);
  }

  function renderList(panel, comments = []) {
    const list = qs('[data-guide-comments-list]', panel);
    const count = qs('[data-guide-comments-count]', panel);
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    if (count) count.textContent = String(comments.length);

    if (!comments.length) {
      const empty = document.createElement('div');
      empty.className = 'atlas-inline-empty atlas-guide-comments__empty';
      empty.dataset.guideCommentsEmpty = 'true';
      empty.textContent = 'Ainda não há comentários neste guia. Seja o primeiro a comentar.';
      list.appendChild(empty);
      return;
    }

    comments.forEach(comment => renderComment(list, comment));
  }

  function updateCounter(input) {
    const panel = input?.closest?.('[data-guide-comments]');
    const counter = panel ? qs('[data-guide-comment-counter]', panel) : null;
    if (counter) counter.textContent = `${String(input.value || '').length}/${MAX_LENGTH}`;
  }

  async function refreshCurrent(options = {}) {
    const panel = getPanel();
    const slug = getSlug(panel);
    if (!panel || !slug || !window.ApiService) return;
    if (options.resetSession) lastSession = null;
    const session = await getSession();
    renderComposer(panel, session);
    try {
      const response = await window.ApiService.getGuideComments(slug);
      renderList(panel, Array.isArray(response?.items) ? response.items : []);
    } catch (_error) {
      renderList(panel, []);
    }
  }

  async function renderForGuide(game = {}, session = null) {
    const slot = qs('#guideCommentsSlot');
    if (!slot || !game?.slug) return;
    if (session) lastSession = session;
    slot.innerHTML = `
      <section id="guideCommentsPanel" class="atlas-guide-comments atlas-panel atlas-panel--support p-5 md:p-6" data-guide-comments data-guide-comments-slug="${String(game.slug).replace(/"/g, '&quot;')}" aria-labelledby="guideCommentsTitle">
        <div class="atlas-guide-comments__head">
          <div>
            <span class="atlas-section-kicker">Comunidade</span>
            <h2 id="guideCommentsTitle" class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Comentários</h2>
            <p class="text-white/58 mt-2 max-w-3xl">Use os comentários para tirar dúvidas, sugerir correções ou complementar dicas do guia.</p>
          </div>
          <span class="atlas-tag atlas-tag--soft" data-guide-comments-count>0</span>
        </div>
        <div class="atlas-guide-comments__composer"></div>
        <div class="atlas-guide-comments__list" data-guide-comments-list></div>
      </section>
    `;
    await refreshCurrent();
  }

  async function handleSubmit(event) {
    const form = event.target.closest('[data-guide-comment-form]');
    if (!form) return;
    event.preventDefault();
    const panel = form.closest('[data-guide-comments]');
    const slug = getSlug(panel);
    const input = qs('[data-guide-comment-input]', form);
    const submit = qs('[data-guide-comment-submit]', form);
    const body = String(input?.value || '');
    if (!body.trim()) {
      setFeedback(panel, 'Escreva um comentário antes de enviar.', 'error');
      return;
    }
    if (submit) submit.disabled = true;
    setFeedback(panel, 'Enviando...');
    try {
      const response = await window.ApiService.createGuideComment(slug, { body });
      input.value = '';
      updateCounter(input);
      setFeedback(panel, response?.message || 'Comentário enviado e aguardando moderação.', 'success');
      await refreshCurrent();
    } catch (error) {
      setFeedback(panel, error.message || 'Não foi possível enviar o comentário.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  async function handleDelete(event) {
    const button = event.target.closest('[data-guide-comment-delete]');
    if (!button) return;
    event.preventDefault();
    const panel = button.closest('[data-guide-comments]');
    const commentId = button.dataset.guideCommentDelete;
    if (!commentId || !window.confirm('Apagar este comentário?')) return;
    button.disabled = true;
    try {
      await window.ApiService.deleteGuideComment(commentId);
      await refreshCurrent();
      window.UI?.showToast?.('Comentário apagado.', 'success');
    } catch (error) {
      button.disabled = false;
      setFeedback(panel, error.message || 'Não foi possível apagar o comentário.', 'error');
    }
  }

  function bindGuideComments() {
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('click', handleDelete);
    document.addEventListener('input', event => {
      const input = event.target.closest('[data-guide-comment-input]');
      if (input) updateCounter(input);
    });
  }

  return {
    bindGuideComments,
    renderForGuide,
    refreshCurrent
  };
})();
