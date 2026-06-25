window.AtlasModalFactories = (() => {
  function mount(id, html) {
    const existing = document.getElementById(id);
    if (existing) return existing;
    document.body.insertAdjacentHTML('beforeend', html.trim());
    return document.getElementById(id);
  }

  function ensureFeedbackModal() {
    return mount('feedbackModal', `
      <div id="feedbackModal" class="hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[100] p-4 atlas-feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedbackModalTitle" aria-hidden="true" inert hidden>
        <div class="atlas-feedback-dialog atlas-panel">
          <div class="atlas-feedback-dialog__head">
            <div>
              <span class="atlas-section-kicker">Feedback</span>
              <h3 id="feedbackModalTitle">Encontrou um problema ou quer sugerir algo?</h3>
              <p>Leva menos de 1 minuto. Você pode reportar bugs, erros em guias, sugerir melhorias ou pedir novos jogos.</p>
            </div>
            <button type="button" class="atlas-text-action" data-feedback-close>Fechar</button>
          </div>
          <form id="feedbackForm" class="atlas-feedback-form" novalidate>
            <input id="feedbackFormStartedAt" type="hidden">
            <input id="feedbackWebsite" class="atlas-feedback-honeypot" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
            <input id="feedbackType" type="hidden" value="Bug do site">
            <section class="atlas-feedback-block atlas-feedback-block--primary" aria-labelledby="feedbackMainBlockTitle">
              <div class="atlas-feedback-block__head">
                <h4 id="feedbackMainBlockTitle">Sobre o feedback</h4>
                <p>Escolha o tipo e conte o essencial. Essa é a parte mais importante.</p>
              </div>
              <fieldset class="atlas-feedback-type-group">
                <legend>Tipo de feedback</legend>
                <div class="atlas-feedback-type-options" role="group" aria-label="Tipo de feedback">
                  <button type="button" class="atlas-feedback-type is-active" data-feedback-type="Bug do site" aria-pressed="true"><strong>Bug do site</strong><small>Algo quebrou ou não funciona</small></button>
                  <button type="button" class="atlas-feedback-type" data-feedback-type="Erro em guia" aria-pressed="false"><strong>Erro no guia</strong><small>Informação errada ou faltando</small></button>
                  <button type="button" class="atlas-feedback-type" data-feedback-type="Sugestão" aria-pressed="false"><strong>Sugestão</strong><small>Ideia para melhorar o Atlas</small></button>
                  <button type="button" class="atlas-feedback-type" data-feedback-type="Pedido de novo guia" aria-pressed="false"><strong>Pedido de novo guia</strong><small>Um jogo para entrar no catálogo</small></button>
                </div>
              </fieldset>
              <label class="atlas-feedback-field atlas-feedback-field--message">Mensagem <span class="atlas-field-tag">obrigatório</span>
                <textarea id="feedbackMessage" class="atlas-input atlas-feedback-textarea" minlength="10" maxlength="2000" required placeholder="Descreva o problema ou sugestão com clareza. Se puder, diga o que aconteceu e onde aconteceu."></textarea>
              </label>
              <div class="atlas-feedback-counter" id="feedbackMessageCounter">0/2000</div>
            </section>
            <section class="atlas-feedback-block" aria-labelledby="feedbackContextBlockTitle">
              <div class="atlas-feedback-block__head">
                <h4 id="feedbackContextBlockTitle">Mais contexto</h4>
                <p>Opcional, mas ajuda a encontrar o ponto exato mais rápido.</p>
              </div>
              <div class="atlas-feedback-grid">
                <label class="atlas-feedback-field">Jogo relacionado <span class="atlas-field-tag atlas-field-tag--optional">opcional</span>
                  <input id="feedbackRelatedGame" type="text" class="atlas-input" maxlength="120" autocomplete="off" placeholder="Ex: Hades, Elden Ring">
                  <small>Informe o jogo se o feedback for sobre um guia específico.</small>
                </label>
                <label class="atlas-feedback-field">Página onde aconteceu <span class="atlas-field-tag atlas-field-tag--optional">opcional</span>
                  <input id="feedbackPageUrl" type="url" class="atlas-input" maxlength="500" autocomplete="off">
                  <small>Preenchida automaticamente quando possível.</small>
                </label>
              </div>
            </section>
            <section class="atlas-feedback-block" aria-labelledby="feedbackContactBlockTitle">
              <div class="atlas-feedback-block__head">
                <h4 id="feedbackContactBlockTitle">Contato <span>opcional</span></h4>
                <p>Preencha apenas se quiser retorno da equipe.</p>
              </div>
              <div class="atlas-feedback-grid">
                <label class="atlas-feedback-field">Nome ou apelido <span class="atlas-field-tag atlas-field-tag--optional">opcional</span>
                  <input id="feedbackNickname" type="text" class="atlas-input" maxlength="80" autocomplete="name" placeholder="Como podemos te chamar?">
                </label>
                <label class="atlas-feedback-field">E-mail <span class="atlas-field-tag atlas-field-tag--optional">opcional</span>
                  <input id="feedbackEmail" type="email" class="atlas-input" maxlength="120" autocomplete="email" placeholder="seu@email.com">
                  <small>Opcional. Preencha apenas se quiser que a equipe entre em contato.</small>
                </label>
              </div>
            </section>
            <p id="feedbackFormStatus" class="atlas-feedback-status" hidden></p>
            <div class="atlas-feedback-success-actions" id="feedbackSuccessActions" hidden>
              <button type="button" class="atlas-btn atlas-btn-secondary" data-feedback-reset>Enviar outro feedback</button>
              <button type="button" class="atlas-btn atlas-btn-secondary" data-feedback-close data-view-link="catalog">Voltar ao catálogo</button>
            </div>
            <div class="atlas-feedback-actions">
              <p>Os campos opcionais ajudam a entender e corrigir o problema mais rápido.</p>
              <button id="feedbackSubmitBtn" type="submit" class="atlas-btn atlas-btn-primary">Enviar feedback</button>
            </div>
          </form>
        </div>
      </div>`);
  }

  function ensureUserAuthModal() {
    return mount('userAuthModal', `
      <div id="userAuthModal" class="hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[100] p-4" role="dialog" aria-modal="true" aria-labelledby="userAuthModalTitle" aria-hidden="true" inert hidden>
        <div class="max-w-md mx-auto mt-16 atlas-panel p-6 rounded-[28px] atlas-auth-modal auth-modal">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 id="userAuthModalTitle" class="text-xl font-bold">Conta Atlas</h3>
              <p class="text-sm text-white/45 mt-1">Entre para salvar biblioteca e checklist na sua conta.</p>
            </div>
            <button type="button" class="atlas-text-action auth-modal__close" data-auth-close>Fechar</button>
          </div>
          <div class="atlas-auth-tabs auth-modal__tabs" role="tablist" aria-label="Acesso de usuário">
            <button type="button" class="auth-modal__tab is-active" data-auth-mode="login" role="tab" aria-selected="true">Entrar</button>
            <button type="button" class="auth-modal__tab" data-auth-mode="register" role="tab" aria-selected="false">Criar conta</button>
          </div>
          <p id="userAuthFeedback" class="atlas-auth-feedback" hidden></p>
          <form id="userLoginForm" class="space-y-4" data-auth-panel="login">
            <label class="atlas-auth-field">Email ou username<input id="loginIdentifier" type="text" class="atlas-input" autocomplete="username" required></label>
            <label class="atlas-auth-field">Senha<input id="loginPassword" type="password" class="atlas-input" autocomplete="current-password" required></label>
            <button class="w-full atlas-btn atlas-btn-primary auth-modal__submit h-[54px]" type="submit">Entrar</button>
          </form>
          <form id="userRegisterForm" class="space-y-4 hidden" data-auth-panel="register">
            <label class="atlas-auth-field">Username<input id="registerUsername" type="text" class="atlas-input" autocomplete="username" minlength="3" maxlength="30" required></label>
            <label class="atlas-auth-field">Email<input id="registerEmail" type="email" class="atlas-input" autocomplete="email" required></label>
            <label class="atlas-auth-field">Nome exibido<input id="registerDisplayName" type="text" class="atlas-input" autocomplete="name" maxlength="60"></label>
            <label class="atlas-auth-field">Senha<input id="registerPassword" type="password" class="atlas-input" autocomplete="new-password" minlength="8" required></label>
            <button class="w-full atlas-btn atlas-btn-primary auth-modal__submit h-[54px]" type="submit">Criar conta</button>
          </form>
        </div>
      </div>`);
  }

  function ensureLibraryImportModal() {
    return mount('libraryImportModal', `
      <div id="libraryImportModal" class="hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[100] p-4" role="dialog" aria-modal="true" aria-labelledby="libraryImportTitle" aria-hidden="true" inert hidden>
        <div class="max-w-md mx-auto mt-20 atlas-panel p-6 rounded-[28px] atlas-auth-modal atlas-import-modal auth-modal">
          <div class="mb-5">
            <span class="atlas-section-kicker">Sincronização</span>
            <h3 id="libraryImportTitle" class="text-xl font-bold mt-2">Encontramos progresso salvo neste navegador</h3>
            <p class="text-sm text-white/55 mt-2">Você pode importar sua biblioteca local para a conta. Troféus concluídos em qualquer lado serão mantidos, e o status mais avançado vence.</p>
            <p id="libraryImportCount" class="atlas-sync-status mt-3">Jogos salvos neste navegador</p>
          </div>
          <div class="atlas-auth-inline-actions atlas-import-actions">
            <button type="button" class="atlas-btn atlas-btn-primary auth-modal__submit" data-import-local><i class="fas fa-cloud-arrow-up"></i> Importar</button>
            <button type="button" class="atlas-btn atlas-btn-secondary auth-modal__secondary" data-import-keep-local>Manter local</button>
            <button type="button" class="atlas-text-action auth-modal__text" data-import-ignore>Ignorar</button>
          </div>
        </div>
      </div>`);
  }

  function ensureAdminModal() {
    return mount('adminModal', `
      <div id="adminModal" class="hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[100] p-4" role="dialog" aria-modal="true" aria-labelledby="adminModalTitle" aria-describedby="adminModalDescription" aria-hidden="true" inert hidden>
        <div class="max-w-md mx-auto mt-24 atlas-panel p-6 rounded-[28px]">
          <div class="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 id="adminModalTitle" class="text-xl font-bold">Entrar no painel</h3>
              <p id="adminModalDescription" class="text-sm text-white/45 mt-1">Faça login para gerenciar jogos, troféus e guias.</p>
            </div>
            <button id="closeAdminModalBtn" class="text-white/45 hover:text-white">Fechar</button>
          </div>
          <form id="adminLoginForm" class="space-y-4" autocomplete="on">
            <input id="adminUsername" type="text" placeholder="Usuário" class="atlas-input" autocomplete="username" required>
            <input id="adminPassword" type="password" placeholder="Senha" class="atlas-input" autocomplete="current-password" required>
            <button class="w-full atlas-btn atlas-btn-primary h-[54px]">Entrar</button>
          </form>
        </div>
      </div>`);
  }

  return {
    ensureFeedbackModal,
    ensureUserAuthModal,
    ensureLibraryImportModal,
    ensureAdminModal
  };
})();
