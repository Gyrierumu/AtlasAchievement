window.AppUserAuth = (() => {

  function escapeHtml(value = '') {
    return window.UIShared?.escapeHtml ? window.UIShared.escapeHtml(value) : String(value || '');
  }

  function formatDate(value) {
    if (!value) return 'Conta nova';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Conta nova';
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: '2-digit' });
  }

  function getInitials(user = {}) {
    const source = String(user.display_name || user.username || 'U').trim();
    return source.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'U';
  }

  function getDisplayName(user = {}) {
    return String(user.display_name || user.username || 'Conta').trim();
  }

  function setFeedback(selector, message = '', tone = 'default') {
    const target = document.querySelector(selector);
    if (!target) return;
    target.textContent = message;
    target.className = `atlas-auth-feedback atlas-auth-feedback--${tone === 'error' ? 'error' : tone === 'success' ? 'success' : 'default'}`;
    target.hidden = !message;
  }

  function setBusy(form, busy) {
    form?.querySelectorAll('button, input, textarea').forEach(element => {
      element.disabled = Boolean(busy);
    });
  }

  function avatarMarkup(user = {}, className = 'atlas-user-avatar') {
    const avatarUrl = String(user.avatar_url || '').trim();
    const initials = escapeHtml(getInitials(user));
    return `<span class="${className}">${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" decoding="async" onerror="this.remove();this.parentElement.classList.add('is-fallback');">` : ''}<span>${initials}</span></span>`;
  }

  function fillProfileForm(user = {}) {
    const displayName = document.querySelector('#profileDisplayName');
    const avatarUrl = document.querySelector('#profileAvatarUrl');
    const bio = document.querySelector('#profileBio');
    if (displayName) displayName.value = user.display_name || '';
    if (avatarUrl) avatarUrl.value = user.avatar_url || '';
    if (bio) bio.value = user.bio || '';
  }

  function renderHeader(state) {
    const session = state.userSession || { authenticated: false, user: null };
    const guest = document.querySelector('#publicAuthGuest');
    const menu = document.querySelector('#publicUserMenu');
    const label = document.querySelector('#publicUserName');
    const avatar = document.querySelector('#publicUserAvatar');

    if (guest) guest.classList.toggle('hidden', Boolean(session.authenticated));
    if (menu) menu.classList.toggle('hidden', !session.authenticated);

    if (session.authenticated && session.user) {
      if (label) label.textContent = getDisplayName(session.user);
      if (avatar) avatar.innerHTML = avatarMarkup(session.user, 'atlas-user-avatar atlas-user-avatar--small');
    }
  }

  function renderProfile(state) {
    const shell = document.querySelector('#profileContent');
    if (!shell) return;

    const session = state.userSession || { authenticated: false, user: null };
    if (!session.authenticated || !session.user) {
      shell.innerHTML = `
        <section class="atlas-profile-empty atlas-panel atlas-panel--support">
          <span class="atlas-section-kicker">Conta Atlas</span>
          <h2>Entre para ver seu perfil</h2>
          <p>Sua biblioteca e progresso locais continuam funcionando neste navegador. Ao entrar, você pode importar esse progresso para a conta.</p>
          <div class="atlas-auth-inline-actions">
            <button type="button" class="atlas-btn atlas-btn-primary auth-modal__submit" data-auth-open="login"><i class="fas fa-right-to-bracket"></i> Entrar</button>
            <button type="button" class="atlas-btn atlas-btn-secondary auth-modal__secondary" data-auth-open="register"><i class="fas fa-user-plus"></i> Criar conta</button>
          </div>
        </section>
      `;
      return;
    }

    const user = session.user;
    const stats = state.accountStats || {};
    const statItems = [
      { label: 'Jogos salvos', value: Number(stats.saved_games || 0) },
      { label: 'Em andamento', value: Number(stats.in_progress_games || 0) },
      { label: 'Concluídos', value: Number(stats.completed_games || 0) },
      { label: 'Troféus concluídos', value: Number(stats.completed_trophies || 0) },
      { label: 'Média de progresso', value: `${Number(stats.average_progress || 0)}%` }
    ];
    shell.innerHTML = `
      <section class="atlas-profile-hero atlas-panel atlas-panel--primary">
        <div class="atlas-profile-identity">
            ${avatarMarkup(user, 'atlas-user-avatar atlas-user-avatar--large')}
            <div>
              <span class="atlas-section-kicker">Meu perfil</span>
            <h2>${escapeHtml(getDisplayName(user))}</h2>
            <p>@${escapeHtml(user.username)} · criada em ${escapeHtml(formatDate(user.created_at))}</p>
          </div>
        </div>
        <p class="atlas-profile-bio">${escapeHtml(user.bio || 'Sem bio por enquanto.')}</p>
      </section>

      <section class="atlas-profile-grid">
        <form id="profileEditForm" class="atlas-profile-card atlas-panel atlas-panel--support">
          <div>
            <span class="atlas-section-kicker">Dados públicos</span>
            <h2>Editar perfil</h2>
          </div>
          <label>Nome exibido<input id="profileDisplayName" class="atlas-input" maxlength="60" autocomplete="name"></label>
          <label>Avatar URL<input id="profileAvatarUrl" class="atlas-input" maxlength="500" inputmode="url" autocomplete="url"></label>
          <label>Bio<textarea id="profileBio" class="atlas-input atlas-auth-textarea" maxlength="280"></textarea></label>
          <p id="profileEditFeedback" class="atlas-auth-feedback" hidden></p>
          <button class="atlas-btn atlas-btn-primary" type="submit"><i class="fas fa-floppy-disk"></i> Salvar perfil</button>
        </form>

        <form id="profilePasswordForm" class="atlas-profile-card atlas-panel atlas-panel--support">
          <div>
            <span class="atlas-section-kicker">Segurança</span>
            <h2>Trocar senha</h2>
          </div>
          <label>Senha atual<input id="profileCurrentPassword" class="atlas-input" type="password" autocomplete="current-password"></label>
          <label>Nova senha<input id="profileNextPassword" class="atlas-input" type="password" minlength="8" autocomplete="new-password"></label>
          <p id="profilePasswordFeedback" class="atlas-auth-feedback" hidden></p>
          <button class="atlas-btn atlas-btn-secondary" type="submit"><i class="fas fa-key"></i> Atualizar senha</button>
        </form>

        <section class="atlas-profile-card atlas-panel atlas-panel--support">
          <div>
            <span class="atlas-section-kicker">Progresso</span>
            <h2>Estatisticas da conta</h2>
          </div>
          <div class="atlas-profile-stats">
            ${statItems.map(item => `<span><strong>${escapeHtml(String(item.value))}</strong>${escapeHtml(item.label)}</span>`).join('')}
          </div>
          <p>Quando você estiver logado, biblioteca e checklist usam a conta como fonte principal. O localStorage continua disponível para uso anônimo neste navegador.</p>
          <p class="atlas-profile-note">Use a biblioteca para salvar jogos, retomar guias e manter o checklist sincronizado com sua conta.</p>
        </section>
      </section>
    `;

    fillProfileForm(user);
  }

  function openAuthModal(mode = 'login') {
    const modal = window.AtlasModalFactories?.ensureUserAuthModal?.()
      || document.querySelector('#userAuthModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.removeAttribute('inert');
    setAuthMode(mode);
  }

  function closeAuthModal() {
    const modal = document.querySelector('#userAuthModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('inert', '');
    setFeedback('#userAuthFeedback');
  }

  function setAuthMode(mode = 'login') {
    const normalized = mode === 'register' ? 'register' : 'login';
    document.querySelectorAll('[data-auth-panel]').forEach(panel => {
      panel.classList.toggle('hidden', panel.dataset.authPanel !== normalized);
    });
    document.querySelectorAll('[data-auth-mode]').forEach(button => {
      const active = button.dataset.authMode === normalized;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    setFeedback('#userAuthFeedback');
    const focusTarget = normalized === 'register'
      ? document.querySelector('#registerUsername')
      : document.querySelector('#loginIdentifier');
    window.setTimeout(() => focusTarget?.focus(), 50);
  }

  function createUserAuthController({
    UI,
    ApiService,
    state,
    navigate,
    refreshAccountLibrary,
    restoreLocalLibrary,
    importLocalLibraryToAccount,
    keepLocalLibraryForLater,
    ignoreLocalImport,
    renderLibraryView
  }) {
    function bindAuthModalElements() {
      const modal = document.querySelector('#userAuthModal');
      if (!modal || modal.dataset.authBound === 'true') return;
      modal.dataset.authBound = 'true';
      modal.addEventListener('click', event => {
        if (event.target.id === 'userAuthModal') closeAuthModal();
      });
      document.querySelector('#userLoginForm')?.addEventListener('submit', handleLogin);
      document.querySelector('#userRegisterForm')?.addEventListener('submit', handleRegister);
    }

    function openBoundAuthModal(mode = 'login') {
      openAuthModal(mode);
      bindAuthModalElements();
    }

    async function syncUserSession() {
      try {
        state.userSession = await ApiService.getCurrentUser();
      } catch (_error) {
        state.userSession = { authenticated: false, user: null };
      }
      if (state.userSession?.authenticated) {
        await refreshAccountLibrary?.({ promptImport: true, silent: true });
      } else {
        restoreLocalLibrary?.();
      }
      renderHeader(state);
      renderProfile(state);
      return state.userSession;
    }

    async function handleLogin(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const identifier = document.querySelector('#loginIdentifier')?.value || '';
      const password = document.querySelector('#loginPassword')?.value || '';
      setBusy(form, true);
      setFeedback('#userAuthFeedback', 'Entrando...');
      try {
        state.userSession = await ApiService.loginUser({ identifier, password });
        await refreshAccountLibrary?.({ promptImport: true, silent: true });
        renderHeader(state);
        renderProfile(state);
        window.AppGuideComments?.refreshCurrent?.({ resetSession: true });
        closeAuthModal();
        UI.showToast('Login realizado com sucesso.', 'success');
      } catch (error) {
        setFeedback('#userAuthFeedback', error.message || 'Não foi possível entrar.', 'error');
      } finally {
        setBusy(form, false);
      }
    }

    async function handleRegister(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = {
        username: document.querySelector('#registerUsername')?.value || '',
        email: document.querySelector('#registerEmail')?.value || '',
        password: document.querySelector('#registerPassword')?.value || '',
        display_name: document.querySelector('#registerDisplayName')?.value || ''
      };
      setBusy(form, true);
      setFeedback('#userAuthFeedback', 'Criando conta...');
      try {
        state.userSession = await ApiService.registerUser(payload);
        await refreshAccountLibrary?.({ promptImport: true, silent: true });
        renderHeader(state);
        renderProfile(state);
        window.AppGuideComments?.refreshCurrent?.({ resetSession: true });
        closeAuthModal();
        UI.showToast('Conta criada com sucesso.', 'success');
      } catch (error) {
        const details = Array.isArray(error.details) ? error.details.join(' ') : '';
        setFeedback('#userAuthFeedback', details || error.message || 'Não foi possível criar a conta.', 'error');
      } finally {
        setBusy(form, false);
      }
    }

    async function handleLogout() {
      try {
        state.userSession = await ApiService.logoutUser();
        restoreLocalLibrary?.();
        renderHeader(state);
        renderProfile(state);
        window.AppGuideComments?.refreshCurrent?.({ resetSession: true });
        UI.showToast('Você saiu da conta.', 'success');
      } catch (error) {
        UI.showToast(error.message || 'Não foi possível sair.', 'error');
      }
    }

    async function handleProfileUpdate(event) {
      event.preventDefault();
      const form = event.target?.closest?.('form') || event.currentTarget;
      setBusy(form, true);
      setFeedback('#profileEditFeedback', 'Salvando...');
      try {
        const response = await ApiService.updateUserProfile({
          display_name: document.querySelector('#profileDisplayName')?.value || '',
          avatar_url: document.querySelector('#profileAvatarUrl')?.value || '',
          bio: document.querySelector('#profileBio')?.value || ''
        });
        state.userSession = { authenticated: true, user: response.user };
        renderHeader(state);
        renderProfile(state);
        UI.showToast('Perfil atualizado.', 'success');
      } catch (error) {
        const details = Array.isArray(error.details) ? error.details.join(' ') : '';
        setFeedback('#profileEditFeedback', details || error.message || 'Não foi possível salvar.', 'error');
      } finally {
        setBusy(form, false);
      }
    }

    async function handlePasswordChange(event) {
      event.preventDefault();
      const form = event.target?.closest?.('form') || event.currentTarget;
      setBusy(form, true);
      setFeedback('#profilePasswordFeedback', 'Atualizando...');
      try {
        await ApiService.changeUserPassword({
          currentPassword: document.querySelector('#profileCurrentPassword')?.value || '',
          nextPassword: document.querySelector('#profileNextPassword')?.value || ''
        });
        form.reset?.();
        setFeedback('#profilePasswordFeedback', 'Senha atualizada com sucesso.', 'success');
      } catch (error) {
        setFeedback('#profilePasswordFeedback', error.message || 'Não foi possível trocar a senha.', 'error');
      } finally {
        setBusy(form, false);
      }
    }

    function openProfile() {
      navigate('profile');
      renderProfile(state);
    }

    function bindUserAuthEvents() {
      document.addEventListener('click', event => {
        const importButton = event.target.closest('[data-import-local]');
        if (importButton) {
          event.preventDefault();
          importButton.disabled = true;
          Promise.resolve(importLocalLibraryToAccount?.())
            .catch(error => UI.showToast(error.message || 'Não foi possível importar o progresso local.', 'error'))
            .finally(() => {
              importButton.disabled = false;
              renderProfile(state);
            });
          return;
        }

        if (event.target.closest('[data-import-keep-local]')) {
          event.preventDefault();
          keepLocalLibraryForLater?.();
          renderLibraryView?.();
          return;
        }

        if (event.target.closest('[data-import-ignore]')) {
          event.preventDefault();
          ignoreLocalImport?.();
          return;
        }

        const openButton = event.target.closest('[data-auth-open]');
        if (openButton) {
          event.preventDefault();
          openBoundAuthModal(openButton.dataset.authOpen || 'login');
          return;
        }

        const modeButton = event.target.closest('[data-auth-mode]');
        if (modeButton) {
          event.preventDefault();
          setAuthMode(modeButton.dataset.authMode || 'login');
          return;
        }

        if (event.target.closest('[data-auth-close]')) {
          event.preventDefault();
          closeAuthModal();
          return;
        }

        if (event.target.closest('[data-user-profile]')) {
          event.preventDefault();
          openProfile();
          return;
        }

        if (event.target.closest('[data-user-logout]')) {
          event.preventDefault();
          handleLogout();
        }
      });

      bindAuthModalElements();
      document.querySelector('#profileContent')?.addEventListener('submit', event => {
        if (event.target.id === 'profileEditForm') return handleProfileUpdate(event);
        if (event.target.id === 'profilePasswordForm') return handlePasswordChange(event);
      });
    }

    return {
      bindUserAuthEvents,
      syncUserSession,
      renderProfileView: () => renderProfile(state),
      openAuthModal: openBoundAuthModal,
      closeAuthModal
    };
  }

  return {
    createUserAuthController
  };
})();
