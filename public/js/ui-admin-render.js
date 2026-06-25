window.UIAdminRender = (() => {
  const modalState = { lastFocused: null };
  const { qs, qsa, setClass, getFocusableElements, getGameImageSrc, getGameCoverSrc, buildImageAttrs, escapeHtml, escapeAttribute } = window.UIShared;
  const { getEditorialBadge } = window.UIDecisionModels;

  function renderPagination(...args) {
    return window.UI?.renderPagination?.(...args);
  }

  function handleAdminModalKeydown(event) {
    const modal = qs('#adminModal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAdminModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = getFocusableElements(modal);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function setAdminFormFeedback(message = '', type = 'info') {
    const target = qs('#adminFormFeedback');
    if (!target) return;
    target.textContent = message || '';
    target.className = `text-sm ${type === 'error' ? 'text-rose-300' : type === 'success' ? 'text-emerald-300' : 'text-white/55'}`;
  }

  function countWords(value = '') {
    return String(value || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function countLines(value = '') {
    return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).length;
  }

  function getRoadmapStepAdminText(step = '') {
    if (typeof step === 'string') return step.trim();
    if (!step || typeof step !== 'object' || Array.isArray(step)) return '';
    const title = String(step.title || step.name || step.label || '').trim();
    const objective = String(step.objective || step.description || step.summary || step.detail || '').trim();
    const focus = String(step.focus || step.category || '').trim();
    return [title, focus, objective].filter(Boolean).join(' - ');
  }

  function getRoadmapAdminText(roadmap = []) {
    return Array.isArray(roadmap)
      ? roadmap.map(getRoadmapStepAdminText).filter(Boolean).join('\n')
      : '';
  }

  function updateAdminFieldMetrics() {
    qsa('[data-admin-count-for]').forEach(target => {
      const field = qs(`#${target.dataset.adminCountFor}`);
      if (!field) return;
      const mode = target.dataset.adminCountMode || 'words';
      if (mode === 'lines') {
        const lines = countLines(field.value);
        const noun = target.dataset.adminCountFor === 'gameRoadmap'
          ? (lines === 1 ? 'etapa' : 'etapas')
          : (lines === 1 ? 'linha' : 'linhas');
        target.textContent = `${lines} ${noun}`;
        return;
      }
      const words = countWords(field.value);
      target.textContent = `${words} ${words === 1 ? 'palavra' : 'palavras'}`;
    });
  }

  function togglePasswordPanel(force) {
    const panel = qs('#adminPasswordPanel');
    if (!panel) return;
    const shouldOpen = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldOpen);
  }

  function togglePreviewPanel(force) {
    const panel = qs('#adminPreviewPanel');
    if (!panel) return;
    const shouldOpen = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldOpen);
  }

  function renderAdminPreview(game = {}) {
    const target = qs('#adminPreviewContent');
    const openBtn = qs('#previewOpenPublicBtn');
    if (!target) return;
    const roadmap = Array.isArray(game.roadmap) ? game.roadmap.map(getRoadmapStepAdminText).filter(Boolean) : [];
    const trophies = Array.isArray(game.trophies) ? game.trophies : [];
    const spoilerCount = trophies.filter(item => item.is_spoiler).length;
    const statusBadge = getEditorialBadge(game);
    const image = getGameCoverSrc ? getGameCoverSrc(game) : getGameImageSrc(game.cover_image || game.image);
    target.innerHTML = `
      <div class="grid xl:grid-cols-[320px_1fr] gap-6">
        <div class="atlas-panel p-4 rounded-[24px] bg-white/[0.02]">
          ${buildImageAttrs(image, game.name || 'Sem nome', 'w-full max-w-[190px] aspect-[2/3] mx-auto rounded-[18px] object-cover', { width: 600, height: 900, sizes: '(min-width: 1280px) 190px, 45vw' })}
        </div>
        <div class="space-y-4">
          <div class="atlas-panel p-5 rounded-[24px] bg-white/[0.02]">
            <div class="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div class="flex flex-wrap gap-2"><div class="atlas-tag">Prévia editorial</div><div class="atlas-tag atlas-tag--${escapeAttribute(statusBadge.tone)}">${escapeHtml(statusBadge.label)}</div></div>
                <h3 class="text-2xl font-bold mt-3">${escapeHtml(game.name || 'Jogo sem nome')}</h3>
                <p class="text-white/62 mt-2">Dificuldade ${escapeHtml(String(game.difficulty || '-'))}/10 • ${escapeHtml(game.time || 'Tempo não informado')} • ${escapeHtml(statusBadge.detail)}</p>
              </div>
              <div class="grid grid-cols-2 gap-3 min-w-[240px]">
                <div class="glass-morphism p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Troféus</div><div class="text-2xl font-extrabold mt-2">${trophies.length}</div></div>
                <div class="glass-morphism p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Spoilers</div><div class="text-2xl font-extrabold mt-2">${spoilerCount}</div></div>
              </div>
            </div>
            <p class="text-white/62 mt-4">${escapeHtml(game.missable || 'Sem alerta de perdíveis informado.')}</p>
          </div>
          <div class="grid lg:grid-cols-2 gap-4">
            <div class="atlas-panel p-5 rounded-[24px] bg-white/[0.02]">
              <div class="atlas-label mb-3">Roadmap</div>
              ${roadmap.length ? `<ol class="space-y-2 text-white/72">${roadmap.slice(0,6).map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` : '<div class="text-white/45">Nenhuma etapa cadastrada.</div>'}
            </div>
            <div class="atlas-panel p-5 rounded-[24px] bg-white/[0.02]">
              <div class="atlas-label mb-3">Primeiros troféus</div>
              ${trophies.length ? `<ul class="space-y-2 text-white/72">${trophies.slice(0,5).map(item => `<li><strong>${escapeHtml(item.name)}</strong> <span class="text-white/45">• ${escapeHtml(item.type || 'Bronze')}</span></li>`).join('')}</ul>` : '<div class="text-white/45">Nenhum troféu cadastrado.</div>'}
            </div>
          </div>
        </div>
      </div>`;
    if (openBtn) {
      const hasSlug = Boolean(game.slug);
      openBtn.classList.toggle('hidden', !hasSlug);
      openBtn.dataset.previewSlug = hasSlug ? game.slug : '';
    }
    togglePreviewPanel(true);
  }

  function createTrophyInputBlock(values = {}) {
    return `
      <div class="trophy-input">
        <div class="flex items-center justify-between gap-3 mb-3"><h5 class="text-sm font-semibold text-slate-200">Troféu</h5><button type="button" class="text-xs text-rose-300 hover:text-rose-200" data-remove-trophy>Remover</button></div>
        <input type="text" placeholder="ID do troféu" value="${escapeAttribute(values.id || '')}" class="atlas-input" required>
        <input type="text" placeholder="Nome" value="${escapeAttribute(values.name || '')}" class="atlas-input" required>
        <select class="atlas-input" required>
          <option value="">Tipo</option>
          <option value="Platina" ${values.type === 'Platina' ? 'selected' : ''}>Platina</option>
          <option value="Ouro" ${values.type === 'Ouro' ? 'selected' : ''}>Ouro</option>
          <option value="Prata" ${values.type === 'Prata' ? 'selected' : ''}>Prata</option>
          <option value="Bronze" ${values.type === 'Bronze' ? 'selected' : ''}>Bronze</option>
        </select>
        <div class="atlas-label mt-3">Descrição do troféu</div>
        <textarea placeholder="O que desbloqueia este troféu" class="atlas-input admin-textarea" required>${escapeHtml(values.description || '')}</textarea>
        <div class="atlas-label mt-3">Dica de execução</div>
        <textarea placeholder="Como fazer sem retrabalho" class="atlas-input admin-textarea" required>${escapeHtml(values.tip || '')}</textarea>
        <label class="flex items-center text-sm"><input type="checkbox" class="mr-2" ${values.is_missable ? 'checked' : ''}> Troféu perdível</label>
        <label class="flex items-center text-sm"><input type="checkbox" class="mr-2" ${values.is_spoiler ? 'checked' : ''}> Contém spoiler</label>
      </div>`;
  }

  function setImagePreview(imageUrl = '') {
    const preview = qs('#gameImagePreview'); const image = qs('#gameImagePreviewImg'); const empty = qs('#gameImagePreviewEmpty'); const input = qs('#gameImage'); const clearButton = qs('#clearImageBtn');
    if (!input || !preview || !image || !empty || !clearButton) return;
    input.value = imageUrl;
    if (imageUrl) { image.src = imageUrl; image.classList.remove('hidden'); preview.classList.remove('hidden'); empty.classList.add('hidden'); clearButton.classList.remove('hidden'); }
    else { image.removeAttribute('src'); image.classList.add('hidden'); preview.classList.add('hidden'); empty.classList.remove('hidden'); clearButton.classList.add('hidden'); }
  }

  function setUploadState(uploading, message = '') {
    const status = qs('#imageUploadStatus'); const trigger = qs('#uploadCoverBtn'); const fileInput = qs('#gameImageFile');
    if (status) { status.textContent = message; status.classList.toggle('hidden', !message); }
    if (trigger) { trigger.disabled = uploading; trigger.innerHTML = uploading ? '<i class="fas fa-spinner fa-spin"></i><span>Enviando...</span>' : '<i class="fas fa-upload"></i><span>Enviar capa</span>'; }
    if (fileInput) fileInput.disabled = uploading;
  }

  function resetGameForm() {
    const form = qs('#gameForm'); const container = qs('#trophiesContainer');
    if (!form || !container) return;
    form.reset();
    if (qs('#gameId')) qs('#gameId').value = '';
    if (qs('#gameCoverImage')) qs('#gameCoverImage').value = '';
    if (qs('#gameFormTitle')) qs('#gameFormTitle').textContent = 'Adicionar novo jogo';
    if (qs('#gameSubmitBtn')) qs('#gameSubmitBtn').innerHTML = '<i class="fas fa-floppy-disk"></i><span>Salvar jogo</span>';
    if (qs('#rawTrophiesInput')) qs('#rawTrophiesInput').value = '';
    if (qs('#gameImageFile')) qs('#gameImageFile').value = '';
    if (qs('#gameEditorialStatus')) qs('#gameEditorialStatus').value = 'published';
    if (qs('#gameEditorialReviewStatus')) qs('#gameEditorialReviewStatus').value = '';
    if (qs('#gameLastReviewedAt')) qs('#gameLastReviewedAt').value = '';
    if (qs('#gameEditorialNotes')) qs('#gameEditorialNotes').value = '';
    if (qs('#gameQualityWarnings')) qs('#gameQualityWarnings').value = '';
    if (qs('#gameReviewedBy')) qs('#gameReviewedBy').value = '';
    if (qs('#gameCoverageLevel')) qs('#gameCoverageLevel').value = 'partial';
    if (qs('#gameVerificationStatus')) qs('#gameVerificationStatus').value = 'unverified';
    if (qs('#gameIsVerified')) qs('#gameIsVerified').checked = false;
    if (qs('#gameVerificationNote')) qs('#gameVerificationNote').value = '';
    if (qs('#gameRoadmap')) qs('#gameRoadmap').dataset.originalRoadmap = '';
    [
      '#gameMissable',
      '#gameRuns',
      '#gameOnline',
      '#gameGrind',
      '#gameDlc',
      '#gameIdealFor',
      '#gameAvoidFor',
      '#gameBestForWhen',
      '#gameRunsSummary',
      '#gameMissableSummary',
      '#gameOnlineSummary',
      '#gameGrindSummary',
      '#gameDlcScope',
      '#gameDifficultyReason',
      '#gameTimeReason',
      '#gameFirstRunAdvice',
      '#gameCleanupAdvice',
      '#gameBeforeYouStart',
      '#gameBestFor',
      '#gameAvoidIf'
    ].forEach(selector => { if (qs(selector)) qs(selector).value = ''; });
    setImagePreview(''); setUploadState(false, '');
    container.innerHTML = createTrophyInputBlock();
    updateAdminFieldMetrics();
  }

  function appendTrophyInput(values = {}) {
    const container = qs('#trophiesContainer'); if (container) container.insertAdjacentHTML('beforeend', createTrophyInputBlock(values));
  }

  function replaceTrophyInputs(trophies = []) {
    const container = qs('#trophiesContainer');
    if (!container) return;
    container.innerHTML = '';
    trophies.forEach(trophy => appendTrophyInput(trophy));
    if (!trophies.length) appendTrophyInput();
    updateAdminFieldMetrics();
  }

  function fillGameForm(game) {
    if (!qs('#gameForm')) return;
    const firstText = (...values) => values.map(value => String(value || '').trim()).find(Boolean) || '';
    const runsSummary = firstText(game.runs_summary, game.runs, game.guide_runs);
    const missableSummary = firstText(game.missable_summary, game.missable);
    const onlineSummary = firstText(game.online_summary, game.online, game.guide_online);
    const grindSummary = firstText(game.grind_summary, game.grind, game.guide_grind);
    const dlcScope = firstText(game.dlc_scope, game.dlc, game.guide_dlc);
    const firstRunAdvice = firstText(game.first_run_advice, game.best_for_when, game.guide_best_moment);
    const bestFor = firstText(game.best_for, game.ideal_for, game.guide_ideal);
    const avoidIf = firstText(game.avoid_if, game.avoid_for, game.guide_avoid);
    qs('#gameId').value = String(game.id);
    qs('#gameName').value = game.name;
    qs('#gameDifficulty').value = game.difficulty;
    qs('#gameTime').value = game.time;
    if (qs('#gameCoverImage')) qs('#gameCoverImage').value = game.cover_image || '';
    qs('#gameMissable').value = missableSummary;
    const roadmapText = getRoadmapAdminText(game.roadmap);
    qs('#gameRoadmap').value = roadmapText;
    qs('#gameRoadmap').dataset.originalRoadmap = roadmapText;
    if (qs('#gameRuns')) qs('#gameRuns').value = runsSummary;
    if (qs('#gameOnline')) qs('#gameOnline').value = onlineSummary;
    if (qs('#gameGrind')) qs('#gameGrind').value = grindSummary;
    if (qs('#gameDlc')) qs('#gameDlc').value = dlcScope;
    if (qs('#gameIdealFor')) qs('#gameIdealFor').value = bestFor;
    if (qs('#gameAvoidFor')) qs('#gameAvoidFor').value = avoidIf;
    if (qs('#gameBestForWhen')) qs('#gameBestForWhen').value = firstRunAdvice;
    if (qs('#gameRunsSummary')) qs('#gameRunsSummary').value = runsSummary;
    if (qs('#gameMissableSummary')) qs('#gameMissableSummary').value = missableSummary;
    if (qs('#gameOnlineSummary')) qs('#gameOnlineSummary').value = onlineSummary;
    if (qs('#gameGrindSummary')) qs('#gameGrindSummary').value = grindSummary;
    if (qs('#gameDlcScope')) qs('#gameDlcScope').value = dlcScope;
    if (qs('#gameDifficultyReason')) qs('#gameDifficultyReason').value = game.difficulty_reason || '';
    if (qs('#gameTimeReason')) qs('#gameTimeReason').value = game.time_reason || '';
    if (qs('#gameFirstRunAdvice')) qs('#gameFirstRunAdvice').value = firstRunAdvice;
    if (qs('#gameCleanupAdvice')) qs('#gameCleanupAdvice').value = game.cleanup_advice || '';
    if (qs('#gameBeforeYouStart')) qs('#gameBeforeYouStart').value = game.before_you_start || '';
    if (qs('#gameBestFor')) qs('#gameBestFor').value = bestFor;
    if (qs('#gameAvoidIf')) qs('#gameAvoidIf').value = avoidIf;
    if (qs('#gameEditorialStatus')) qs('#gameEditorialStatus').value = game.editorial_status || 'published';
    if (qs('#gameEditorialReviewStatus')) qs('#gameEditorialReviewStatus').value = game.editorial_review_status || game.editorialReviewStatus || '';
    if (qs('#gameLastReviewedAt')) qs('#gameLastReviewedAt').value = game.last_reviewed_at || game.lastReviewedAt || '';
    if (qs('#gameEditorialNotes')) qs('#gameEditorialNotes').value = game.editorial_notes || game.editorialNotes || '';
    if (qs('#gameQualityWarnings')) {
      const warnings = game.quality_warnings || game.qualityWarnings || '';
      qs('#gameQualityWarnings').value = Array.isArray(warnings) ? warnings.join('\n') : String(warnings || '');
    }
    if (qs('#gameReviewedBy')) qs('#gameReviewedBy').value = game.reviewed_by || game.reviewedBy || '';
    if (qs('#gameCoverageLevel')) qs('#gameCoverageLevel').value = game.coverage_level || 'partial';
    if (qs('#gameVerificationStatus')) qs('#gameVerificationStatus').value = game.verification_status || (game.is_verified ? 'verified' : 'unverified');
    if (qs('#gameIsVerified')) qs('#gameIsVerified').checked = Boolean(game.is_verified);
    if (qs('#gameVerificationNote')) qs('#gameVerificationNote').value = game.verification_note || '';
    qs('#gameFormTitle').textContent = `Editar ${game.name}`;
    qs('#gameSubmitBtn').innerHTML = '<i class="fas fa-floppy-disk"></i><span>Atualizar jogo</span>';
    if (qs('#rawTrophiesInput')) qs('#rawTrophiesInput').value = '';
    if (qs('#gameImageFile')) qs('#gameImageFile').value = '';
    setImagePreview(game.image || '');
    setUploadState(false, game.image ? 'Capa pronta para uso.' : '');
    replaceTrophyInputs(game.trophies);
    updateAdminFieldMetrics();
  }

  function toggleGameForm(force) {
    const form = qs('#adminGameFormPanel'); if (!form) return;
    const shouldOpen = typeof force === 'boolean' ? force : form.classList.contains('hidden');
    form.classList.toggle('hidden', !shouldOpen);
  }

  function renderAdminSummary(summary = { totalGames: 0, totalTrophies: 0 }) {
    const cards = qs('#adminSummaryCards'); if (!cards) return;
    cards.innerHTML = `<div class="glass-morphism p-5 rounded-[20px]"><div class="text-xs uppercase tracking-wide text-slate-400 mb-2">Jogos cadastrados</div><div class="text-3xl font-extrabold text-atlas-400">${summary.totalGames}</div></div><div class="glass-morphism p-5 rounded-[20px]"><div class="text-xs uppercase tracking-wide text-slate-400 mb-2">Troféus cadastrados</div><div class="text-3xl font-extrabold text-emerald-400">${summary.totalTrophies}</div></div>`;
  }

  function renderAdminQuality(model = {}) {
    const panel = qs('#adminQualityPanel');
    const scoreTarget = qs('#adminQualityScore');
    const badgeTarget = qs('#adminQualityBadge');
    const summaryTarget = qs('#adminQualitySummary');
    const metaTarget = qs('#adminQualityMeta');
    const listTarget = qs('#adminQualityList');
    if (!panel || !scoreTarget || !badgeTarget || !summaryTarget || !metaTarget || !listTarget) return;

    const score = Number(model.score || 0);
    const tone = model.tone || 'draft';
    const scoreClass = tone === 'strong'
      ? 'text-emerald-300'
      : tone === 'solid'
        ? 'text-sky-300'
        : tone === 'fragile'
          ? 'text-amber-300'
          : 'text-rose-300';

    scoreTarget.className = `text-4xl font-black mt-1 ${scoreClass}`;
    scoreTarget.textContent = String(score);
    badgeTarget.textContent = model.badge || 'Rascunho';
    summaryTarget.textContent = model.summary || 'Preencha o formulário para ver score, alertas e sinais de SEO.';

    const metaCards = Array.isArray(model.meta) ? model.meta : [];
    metaTarget.innerHTML = metaCards.map(item => `
      <div class="glass-morphism p-4 rounded-[18px] bg-white/[0.02]">
        <div class="text-[11px] uppercase tracking-wide text-white/45">${escapeHtml(item.label || '')}</div>
        <div class="text-lg font-bold mt-2">${escapeHtml(item.value || '-')}</div>
        <div class="text-xs text-white/45 mt-1">${escapeHtml(item.help || '')}</div>
      </div>`).join('');

    const items = Array.isArray(model.items) ? model.items : [];
    const toneClass = status => status === 'ok'
      ? 'border-emerald-400/30 bg-emerald-500/10'
      : status === 'warn'
        ? 'border-amber-400/30 bg-amber-500/10'
        : 'border-rose-400/30 bg-rose-500/10';
    const label = status => status === 'ok' ? 'Bom' : status === 'warn' ? 'Atenção' : 'Corrigir';

    listTarget.innerHTML = items.map(item => `
      <div class="rounded-[18px] border p-4 ${toneClass(item.status)}">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-semibold text-white">${escapeHtml(item.title || '')}</div>
            <div class="text-sm text-white/65 mt-1">${escapeHtml(item.message || '')}</div>
          </div>
          <span class="text-[11px] uppercase tracking-wide text-white/55">${label(item.status)}</span>
        </div>
      </div>`).join('');
  }

  function renderAdminGames(response = {}) {
    const target = qs('#adminGamesList'); if (!target) return;
    const summary = qs('#adminResultsSummary');
    const items = Array.isArray(response.items) ? response.items : [];
    const pagination = response.pagination || {};
    if (summary) summary.textContent = `${pagination.total || 0} jogo(s) encontrados nesta página administrativa.`;
    if (!items.length) {
      target.innerHTML = '<div class="glass-morphism p-6 rounded-[20px] text-slate-400">Nenhum jogo encontrado para esse filtro.</div>';
      renderPagination('#adminPagination', pagination, { mode: 'admin', itemLabel: 'jogos' });
      return;
    }
    target.innerHTML = items.map(game => {
      const statusBadge = getEditorialBadge(game);
      return `
      <div class="glass-morphism p-5 rounded-[20px] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="flex gap-4 items-center"><div class="w-16 h-24 rounded-[14px] overflow-hidden bg-slate-900 shrink-0">${buildImageAttrs(getGameCoverSrc ? getGameCoverSrc(game) : (game.cover_image || game.image), game.name, 'w-full h-full object-cover', { width: 128, height: 192, sizes: '64px' })}</div><div><div class="flex items-center gap-3 flex-wrap"><h3 class="text-lg font-bold">${escapeHtml(game.name)}</h3><span class="text-xs px-2 py-1 rounded-full bg-[#111922] text-slate-300">${game.difficulty}/10</span><span class="atlas-tag atlas-tag--${escapeAttribute(statusBadge.tone)}">${escapeHtml(statusBadge.label)}</span></div><div class="text-sm text-slate-400 mt-2">${escapeHtml(game.time)} • ${escapeHtml(statusBadge.detail)}</div></div></div>
        <div class="flex gap-2 flex-wrap"><button type="button" class="px-4 py-2 rounded-xl bg-[#111922] hover:bg-slate-700" data-admin-edit="${game.id}">Editar</button><button type="button" class="px-4 py-2 rounded-xl bg-[#111922] hover:bg-slate-700" data-admin-preview="${game.id}">Prévia</button><button type="button" class="px-4 py-2 rounded-xl bg-atlas-600 hover:bg-atlas-500" data-admin-duplicate="${game.id}">Duplicar</button><button type="button" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500" data-admin-delete="${game.id}" data-admin-name="${escapeHtml(game.name)}">Excluir</button></div>
      </div>`;
    }).join('');
    renderPagination('#adminPagination', pagination, { mode: 'admin', itemLabel: 'jogos' });
  }

  function formatFeedbackDate(value = '') {
    if (!value) return 'Data não informada';
    try {
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
    } catch (_error) {
      return value;
    }
  }

  function renderAdminFeedback(response = {}) {
    const target = qs('#adminFeedbackList');
    const summary = qs('#adminFeedbackSummary');
    const paginationTarget = qs('#adminFeedbackPagination');
    if (!target) return;

    const items = Array.isArray(response.items) ? response.items : [];
    const pagination = response.pagination || {};
    if (summary) summary.textContent = `${pagination.total || 0} feedback(s) recebido(s).`;

    if (!items.length) {
      target.innerHTML = '<div class="glass-morphism p-6 rounded-[20px] text-slate-400">Nenhum feedback enviado ainda.</div>';
      if (paginationTarget) paginationTarget.innerHTML = '';
      return;
    }

    target.innerHTML = items.map(item => `
      <article class="admin-feedback-card">
        <div class="admin-feedback-card__head">
          <div>
            <span class="atlas-tag atlas-tag--soft">${escapeHtml(item.type || 'Feedback')}</span>
            <strong>${escapeHtml(item.related_game || 'Sem jogo relacionado')}</strong>
          </div>
          <time datetime="${escapeAttribute(item.created_at || '')}">${escapeHtml(formatFeedbackDate(item.created_at))}</time>
        </div>
        <p>${escapeHtml(item.message || '')}</p>
        <div class="admin-feedback-card__meta">
          ${item.page_url ? `<a href="${escapeAttribute(item.page_url)}" target="_blank" rel="noopener">Abrir página</a>` : '<span>Sem URL</span>'}
          <span>${escapeHtml(item.nickname || 'Sem nome')}</span>
          <span>${escapeHtml(item.email || 'Sem e-mail')}</span>
        </div>
      </article>
    `).join('');

    if (!paginationTarget) return;
    const currentPage = Number(pagination.page || 1);
    const totalPages = Number(pagination.totalPages || 1);
    paginationTarget.innerHTML = `
      <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-feedback-page="${Math.max(currentPage - 1, 1)}" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
      <span class="text-sm text-white/55">Página ${escapeHtml(String(currentPage))} de ${escapeHtml(String(totalPages))}</span>
      <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-feedback-page="${Math.min(currentPage + 1, totalPages)}" ${currentPage >= totalPages ? 'disabled' : ''}>Próxima</button>
    `;
  }

  function renderMetricEmpty() {
    return '<div class="glass-morphism p-4 rounded-[18px] text-sm text-white/45">Ainda não há dados suficientes para esta métrica.</div>';
  }

  function renderMetricList(items = [], renderItem) {
    if (!Array.isArray(items) || !items.length) return renderMetricEmpty();
    return `<div class="space-y-2">${items.map(renderItem).join('')}</div>`;
  }

  function renderMetricTable(items = [], columns = []) {
    if (!Array.isArray(items) || !items.length) return renderMetricEmpty();
    return `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-white/45">
              ${columns.map(column => `<th class="py-2 pr-3 font-semibold">${escapeHtml(column.label)}</th>`).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-white/10">
            ${items.map(item => `
              <tr>
                ${columns.map(column => `<td class="py-2 pr-3 text-white/75">${escapeHtml(column.value(item))}</td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function statusLabel(value = '') {
    const labels = {
      new: 'Novo',
      reviewed: 'Revisado',
      archived: 'Arquivado',
      verified: 'Verificado',
      in_review: 'Em revisão',
      needs_missables_check: 'Checar perdíveis',
      needs_online_check: 'Checar online',
      dlc_pending: 'DLC pendente',
      outdated: 'Desatualizado',
      draft: 'Rascunho'
    };
    return labels[value] || value || 'Sem status';
  }

  function renderBetaMetricBlock(title, bodyHtml, description = '') {
    return `
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 class="text-lg font-bold">${escapeHtml(title)}</h3>
          ${description ? `<p class="text-xs text-white/45 mt-1">${escapeHtml(description)}</p>` : ''}
        </div>
      </div>
      ${bodyHtml}`;
  }

  function renderAdminBetaMetrics(metrics = {}) {
    const summary = qs('#adminBetaMetricsSummary');
    const cards = qs('#adminBetaMetricCards');
    const feedbackTarget = qs('#adminBetaFeedbackMetrics');
    const guideTarget = qs('#adminBetaGuideMetrics');
    const searchTarget = qs('#adminBetaSearchMetrics');
    const seoTarget = qs('#adminBetaSeoMetrics');
    const checklistTarget = qs('#adminBetaChecklistMetrics');
    const overview = metrics.overview || {};

    if (summary) {
      summary.textContent = metrics.generatedAt
        ? `Atualizado em ${formatFeedbackDate(metrics.generatedAt)}. Eventos internos consideram os últimos 90 dias.`
        : 'Ainda não foi possível carregar as métricas do beta.';
    }

    if (cards) {
      const cardItems = [
        ['Feedbacks', overview.totalFeedbacks || 0, `${overview.newFeedbacks || 0} novo(s)`],
        ['Jogos', overview.totalGames || 0, 'catálogo'],
        ['Guias publicados', overview.publishedGuides || 0, 'fora de rascunho'],
        ['Em revisão', overview.guidesInReview || 0, 'editorial'],
        ['Verificados', overview.verifiedGuides || 0, 'manual'],
        ['Eventos 90d', overview.internalEvents90d || 0, 'internos']
      ];
      cards.innerHTML = cardItems.map(([label, value, help]) => `
        <div class="glass-morphism p-4 rounded-[18px]">
          <div class="text-[11px] uppercase tracking-wide text-white/45">${escapeHtml(label)}</div>
          <div class="text-2xl font-extrabold text-atlas-300 mt-2">${escapeHtml(String(value))}</div>
          <div class="text-xs text-white/45 mt-1">${escapeHtml(help)}</div>
        </div>`).join('');
    }

    if (feedbackTarget) {
      const feedback = metrics.feedback || {};
      feedbackTarget.innerHTML = renderBetaMetricBlock('Feedback', `
        <div class="space-y-4">
          <div>
            <div class="text-xs uppercase tracking-wide text-white/45 mb-2">Por tipo</div>
            ${renderMetricTable(feedback.byType, [
              { label: 'Tipo', value: item => item.type || 'Feedback' },
              { label: 'Total', value: item => String(item.count || 0) }
            ])}
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-white/45 mb-2">Recentes</div>
            ${renderMetricList(feedback.recent, item => `
              <div class="glass-morphism p-3 rounded-[14px]">
                <div class="flex items-center justify-between gap-3">
                  <strong>${escapeHtml(item.type || 'Feedback')}</strong>
                  <span class="text-xs text-white/45">${escapeHtml(statusLabel(item.status))}</span>
                </div>
                <div class="text-xs text-white/50 mt-1">${escapeHtml(item.relatedGame || item.pagePath || 'Sem contexto')} • ${escapeHtml(formatFeedbackDate(item.createdAt))}</div>
              </div>`)}
          </div>
        </div>`);
    }

    if (guideTarget) {
      const guides = metrics.guides || {};
      guideTarget.innerHTML = renderBetaMetricBlock('Guias', `
        <div class="space-y-4">
          <div>
            <div class="text-xs uppercase tracking-wide text-white/45 mb-2">Mais feedback</div>
            ${renderMetricTable(guides.topFeedbackGames, [
              { label: 'Jogo', value: item => item.game || 'Sem jogo relacionado' },
              { label: 'Feedbacks', value: item => String(item.count || 0) }
            ])}
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-white/45 mb-2">Pendências editoriais</div>
            ${renderMetricList(guides.pendingEditorial, item => `
              <div class="glass-morphism p-3 rounded-[14px]">
                <div class="font-semibold">${escapeHtml(item.name || item.slug || 'Guia')}</div>
                <div class="text-xs text-amber-200 mt-1">${escapeHtml(statusLabel(item.status))}</div>
              </div>`)}
          </div>
        </div>`);
    }

    if (searchTarget) {
      const search = metrics.search || {};
      searchTarget.innerHTML = renderBetaMetricBlock('Busca', `
        <div class="space-y-4">
          <div>
            <div class="text-xs uppercase tracking-wide text-white/45 mb-2">Termos mais buscados</div>
            ${renderMetricTable(search.topTerms, [
              { label: 'Termo', value: item => item.term || '' },
              { label: 'Buscas', value: item => String(item.count || 0) }
            ])}
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-white/45 mb-2">Sem resultado</div>
            ${renderMetricTable(search.noResultTerms, [
              { label: 'Termo', value: item => item.term || '' },
              { label: 'Ocorrências', value: item => String(item.count || 0) }
            ])}
          </div>
        </div>`, 'Preenchido por eventos internos de busca.');
    }

    if (seoTarget) {
      const seo = metrics.seo || {};
      seoTarget.innerHTML = renderBetaMetricBlock('Páginas SEO', renderMetricTable(seo.topPages, [
        { label: 'Página', value: item => item.pagePath || '' },
        { label: 'Views', value: item => String(item.count || 0) }
      ]), 'Preenchido por eventos internos de páginas especiais.');
    }

    if (checklistTarget) {
      const checklist = metrics.checklist || {};
      checklistTarget.innerHTML = renderBetaMetricBlock('Checklist', `
        <div class="grid md:grid-cols-3 gap-3 mb-4">
          <div class="glass-morphism p-4 rounded-[16px]"><div class="text-xs text-white/45 uppercase tracking-wide">Marcações</div><div class="text-2xl font-bold mt-1">${escapeHtml(String(checklist.checked || 0))}</div></div>
          <div class="glass-morphism p-4 rounded-[16px]"><div class="text-xs text-white/45 uppercase tracking-wide">Desmarcações</div><div class="text-2xl font-bold mt-1">${escapeHtml(String(checklist.unchecked || 0))}</div></div>
          <div class="glass-morphism p-4 rounded-[16px]"><div class="text-xs text-white/45 uppercase tracking-wide">Total</div><div class="text-2xl font-bold mt-1">${escapeHtml(String(checklist.totalToggles || 0))}</div></div>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <div class="text-xs uppercase tracking-wide text-white/45 mb-2">Guias com mais uso</div>
            ${renderMetricTable(checklist.topGames, [
              { label: 'Slug', value: item => item.gameSlug || '' },
              { label: 'Ações', value: item => String(item.count || 0) }
            ])}
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-white/45 mb-2">Troféus mais marcados/desmarcados</div>
            ${renderMetricTable(checklist.topTrophies, [
              { label: 'Troféu', value: item => item.trophy || '' },
              { label: 'Ações', value: item => String(item.count || 0) }
            ])}
          </div>
        </div>`, 'Não mostra progresso completo de usuários.');
    }
  }

  function setAdminState(session) {
    const authenticated = Boolean(session?.authenticated);
    document.body?.classList.toggle('atlas-admin-shell-locked', !authenticated);
    ['#adminLogoutBtn', '#adminStatus', '#adminPanelLink'].forEach(sel => setClass(sel, 'hidden', !authenticated));
    setClass('#adminAccessBtn', 'hidden', true);
    setClass('#adminAccessBtnFooter', 'hidden', authenticated);
    const status = qs('#adminStatus'); if (status) status.textContent = authenticated ? `Modo editor: ${session.username}` : '';
    if (!authenticated) { toggleGameForm(false); togglePasswordPanel(false); togglePreviewPanel(false); }
  }

  function openAdminModal() {
    const modal = window.AtlasModalFactories?.ensureAdminModal?.() || qs('#adminModal');
    if (!modal) return;
    modalState.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.classList.remove('hidden');
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.removeAttribute('inert');
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleAdminModalKeydown);
    if (qs('#adminUsername')) qs('#adminUsername').focus();
  }
  function closeAdminModal() {
    const modal = qs('#adminModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('inert', '');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', handleAdminModalKeydown);
    if (qs('#adminLoginForm')) qs('#adminLoginForm').reset();
    if (modalState.lastFocused?.focus) modalState.lastFocused.focus();
  }

  return {
    setAdminFormFeedback,
    updateAdminFieldMetrics,
    togglePasswordPanel,
    togglePreviewPanel,
    renderAdminPreview,
    setImagePreview,
    setUploadState,
    resetGameForm,
    appendTrophyInput,
    replaceTrophyInputs,
    fillGameForm,
    toggleGameForm,
    renderAdminSummary,
    renderAdminQuality,
    renderAdminGames,
    renderAdminFeedback,
    renderAdminBetaMetrics,
    setAdminState,
    openAdminModal,
    closeAdminModal
  };
})();
