window.AppAdmin = (() => {
  function slugify(value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || `trofeu-${Date.now()}`;
  }

  function normalizeType(rawValue, fallback = 'Bronze') {
    const text = String(rawValue || '').toLowerCase();
    if (text.includes('platina')) return 'Platina';
    if (text.includes('ouro')) return 'Ouro';
    if (text.includes('prata')) return 'Prata';
    if (text.includes('bronze')) return 'Bronze';
    return fallback;
  }

  function inferTypeFromLine(line, currentType) {
    const explicitMatch = line.match(/\[(Platina|Ouro|Prata|Bronze)\]|\((Platina|Ouro|Prata|Bronze)\)/i);
    if (explicitMatch) return normalizeType(explicitMatch[1] || explicitMatch[2], currentType || 'Bronze');
    return currentType || 'Bronze';
  }

  function parseTrophiesFromRawText(rawText) {
    const lines = rawText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const trophies = [];
    let currentType = null;
    let sectionName = '';

    for (const line of lines) {
      if (!line.includes(':')) {
        sectionName = line;
        const headingType = normalizeType(line, '');
        currentType = headingType || currentType;
        continue;
      }

      const [rawName, ...rest] = line.split(':');
      const name = rawName.trim().replace(/^[-•*]\s*/, '');
      const description = rest.join(':').trim();
      if (!name || !description) continue;

      const type = inferTypeFromLine(line, currentType || 'Bronze');
      const generatedIdBase = slugify(name);
      const uniqueId = trophies.some(item => item.id === generatedIdBase)
        ? `${generatedIdBase}-${trophies.length + 1}`
        : generatedIdBase;

      const spoiler = /hist[oó]ria|ep[ií]logo|chefe final|final verdadeiro|miss[aã]o principal/i.test(sectionName) || /ep[ií]logo|chefe final|final verdadeiro|miss[aã]o principal/i.test(description);
      const missable = /perd[ií]vel|missable|n[aã]o perca|sem voltar|irrevers[ií]vel/i.test(sectionName) || /perd[ií]vel|missable|n[aã]o perca|sem voltar|irrevers[ií]vel/i.test(description);

      trophies.push({
        id: uniqueId,
        name,
        type,
        description,
        tip: `Objetivo: ${description}`,
        is_missable: missable,
        is_spoiler: spoiler
      });
    }

    return trophies;
  }

  function collectGameFormPayload(UI) {
    const trophies = UI.qsa('#trophiesContainer .trophy-input').map(block => {
      const fields = block.querySelectorAll('input, textarea, select');
      return {
        id: fields[0].value.trim(),
        name: fields[1].value.trim(),
        type: fields[2].value,
        description: fields[3].value.trim(),
        tip: fields[4].value.trim(),
        is_missable: fields[5].checked,
        is_spoiler: fields[6].checked
      };
    });
    const readField = selector => UI.qs(selector)?.value?.trim() || '';
    const firstText = (...values) => values.map(value => String(value || '').trim()).find(Boolean) || '';
    const runsSummary = firstText(readField('#gameRunsSummary'), readField('#gameRuns'));
    const missableSummary = firstText(readField('#gameMissableSummary'), readField('#gameMissable'));
    const onlineSummary = firstText(readField('#gameOnlineSummary'), readField('#gameOnline'));
    const grindSummary = firstText(readField('#gameGrindSummary'), readField('#gameGrind'));
    const dlcScope = firstText(readField('#gameDlcScope'), readField('#gameDlc'));
    const firstRunAdvice = readField('#gameFirstRunAdvice');
    const bestFor = firstText(readField('#gameBestFor'), readField('#gameIdealFor'));
    const avoidIf = firstText(readField('#gameAvoidIf'), readField('#gameAvoidFor'));
    const legacyVerified = Boolean(UI.qs('#gameIsVerified')?.checked);
    const editorialReviewStatus = UI.qs('#gameEditorialReviewStatus')?.value || '';
    const selectedVerificationStatus = UI.qs('#gameVerificationStatus')?.value || '';
    const verificationStatus = legacyVerified || editorialReviewStatus === 'verified' ? 'verified' : (selectedVerificationStatus || 'unverified');
    const roadmapField = UI.qs('#gameRoadmap');
    const roadmapValue = roadmapField?.value || '';
    const originalRoadmapValue = roadmapField?.dataset?.originalRoadmap || '';
    const isEditingExistingGame = Boolean(UI.qs('#gameId')?.value?.trim());
    const roadmapChanged = !isEditingExistingGame || roadmapValue !== originalRoadmapValue;
    const roadmapLines = roadmapValue.split('\n').map(item => item.trim()).filter(Boolean);
    const payload = {
      name: readField('#gameName'),
      difficulty: Number(UI.qs('#gameDifficulty').value),
      time: readField('#gameTime'),
      image: readField('#gameImage'),
      cover_image: readField('#gameCoverImage'),
      missable: missableSummary,
      runs: runsSummary,
      online: onlineSummary,
      grind: grindSummary,
      dlc: dlcScope,
      ideal_for: bestFor,
      avoid_for: avoidIf,
      best_for_when: firstText(readField('#gameBestForWhen'), firstRunAdvice),
      runs_summary: runsSummary,
      missable_summary: missableSummary,
      online_summary: onlineSummary,
      grind_summary: grindSummary,
      dlc_scope: dlcScope,
      difficulty_reason: readField('#gameDifficultyReason'),
      time_reason: readField('#gameTimeReason'),
      first_run_advice: firstRunAdvice,
      cleanup_advice: readField('#gameCleanupAdvice'),
      before_you_start: readField('#gameBeforeYouStart'),
      best_for: bestFor,
      avoid_if: avoidIf,
      verification_status: verificationStatus,
      editorial_status: UI.qs('#gameEditorialStatus')?.value || 'published',
      editorial_review_status: editorialReviewStatus,
      last_reviewed_at: readField('#gameLastReviewedAt'),
      editorial_notes: readField('#gameEditorialNotes'),
      quality_warnings: readField('#gameQualityWarnings').split(/\r?\n|;/).map(item => item.trim()).filter(Boolean),
      reviewed_by: readField('#gameReviewedBy'),
      coverage_level: UI.qs('#gameCoverageLevel')?.value || 'partial',
      is_verified: legacyVerified || editorialReviewStatus === 'verified' || verificationStatus === 'verified',
      verification_note: readField('#gameVerificationNote'),
      trophies
    };
    if (roadmapChanged && roadmapLines.length) {
      payload.roadmap = roadmapLines;
    } else if (!isEditingExistingGame) {
      payload.roadmap = roadmapLines;
    }
    return payload;
  }

  function buildPreviewPayload({ UI, state, collectGameFormPayload }) {
    const payload = collectGameFormPayload(UI);
    const currentId = UI.qs('#gameId')?.value?.trim();
    if (currentId) {
      const existing = state.availableGames.find(item => String(item.id) === String(currentId));
      if (existing?.slug) payload.slug = existing.slug;
    }
    return payload;
  }

  function getWordsCount(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function firstEditorialText(...values) {
    return values.map(value => String(value || '').trim()).find(Boolean) || '';
  }

  function hasReadableTime(value) {
    return /\d+\s*(h|hora|min)/i.test(String(value || ''));
  }

  function normalizeEditorialText(value = '') {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function hasLowRiskMissableStatement(text) {
    return /(?:nao ha|sem|nenhum|nenhuma|baixo risco de)\s+(?:trofeus?\s+)?(?:perdiveis?|missables?)/.test(text)
      || /chapter select resolve|free roam|cleanup completo|nada e perdivel|nada e missable/.test(text);
  }

  function hasMissableRiskSignal(value = '') {
    const text = normalizeEditorialText(value);
    const riskPattern = /perdivel|missable|ponto sem retorno|pontos sem retorno|sem voltar|nova run|multiplas runs|multiplas campanhas|sem chapter select|nao ha chapter select|ficar indisponivel|bloqueia|janela/;
    const hasRiskPhrase = riskPattern.test(text);
    if (!hasRiskPhrase) return false;

    if (!hasLowRiskMissableStatement(text)) return true;

    const contrastMatch = text.match(/(?:mas|porem|exceto|apesar|salvo|fora disso)(.*)$/);
    return Boolean(contrastMatch && riskPattern.test(contrastMatch[1]));
  }

  function createEditorialQualityModel(payload = {}) {
    const name = String(payload.name || '').trim();
    const difficulty = Number(payload.difficulty || 0);
    const time = String(payload.time || '').trim();
    const image = String(payload.image || '').trim();
    const missable = firstEditorialText(payload.missable_summary, payload.missable);
    const roadmap = Array.isArray(payload.roadmap) ? payload.roadmap.filter(Boolean) : [];
    const trophies = Array.isArray(payload.trophies) ? payload.trophies.filter(Boolean) : [];
    const runs = firstEditorialText(payload.runs_summary, payload.runs);
    const online = firstEditorialText(payload.online_summary, payload.online);
    const grind = firstEditorialText(payload.grind_summary, payload.grind);
    const dlc = firstEditorialText(payload.dlc_scope, payload.dlc);
    const difficultyReason = firstEditorialText(payload.difficulty_reason);
    const timeReason = firstEditorialText(payload.time_reason);
    const firstRunAdvice = firstEditorialText(payload.first_run_advice, payload.best_for_when);
    const cleanupAdvice = firstEditorialText(payload.cleanup_advice);
    const beforeYouStart = firstEditorialText(payload.before_you_start);
    const idealFor = firstEditorialText(payload.best_for, payload.ideal_for);
    const avoidFor = firstEditorialText(payload.avoid_if, payload.avoid_for);
    const bestForWhen = firstEditorialText(payload.best_for_when, payload.first_run_advice);
    const editorialStatus = String(payload.editorial_status || 'published');
    const coverageLevel = String(payload.coverage_level || 'partial');
    const verificationStatus = String(payload.verification_status || (payload.is_verified ? 'verified' : 'unverified'));
    const isVerified = Boolean(payload.is_verified) || verificationStatus === 'verified';
    const describedTrophies = trophies.filter(item => getWordsCount(item.description) >= 5).length;
    const tippedTrophies = trophies.filter(item => getWordsCount(item.tip) >= 4).length;
    const missableFlags = trophies.filter(item => item.is_missable).length;
    const spoilerFlags = trophies.filter(item => item.is_spoiler).length;

    let score = 0;
    const items = [];
    const addItem = (title, status, message, points = 0) => {
      items.push({ title, status, message });
      score += points;
    };

    if (name.length >= 4) addItem('Título do jogo', 'ok', 'Nome suficiente para contexto editorial e SEO básico.', 10);
    else if (name.length) addItem('Título do jogo', 'warn', 'O nome está muito curto; isso enfraquece contexto e revisão.', 4);
    else addItem('Título do jogo', 'error', 'Informe o nome do jogo antes de publicar.', 0);

    if (difficulty >= 1 && difficulty <= 10) addItem('Dificuldade', 'ok', 'Faixa de dificuldade informada.', 8);
    else addItem('Dificuldade', 'error', 'Defina uma dificuldade entre 1 e 10.', 0);

    if (hasReadableTime(time)) addItem('Tempo estimado', 'ok', 'A estimativa de tempo parece legível para o usuário.', 10);
    else if (time) addItem('Tempo estimado', 'warn', 'Descreva o tempo em horas/minutos para ficar mais claro.', 4);
    else addItem('Tempo estimado', 'error', 'Falta a estimativa de tempo da platina.', 0);

    if (image) addItem('Capa / imagem social', 'ok', 'Há imagem para melhorar acabamento e compartilhamento.', 6);
    else addItem('Capa / imagem social', 'warn', 'Adicionar uma capa melhora o acabamento e o compartilhamento social.', 2);

    if (getWordsCount(runs) >= 3) addItem('Número de runs', 'ok', 'A página já informa o tipo de estrutura esperado para a platina.', 6);
    else addItem('Número de runs', 'warn', 'Descreva se a platina tende a ser 1 run, cleanup ou multi-run.', 2);

    if (getWordsCount(online) >= 2) addItem('Contexto de online', 'ok', 'O guia já informa o peso do online.', 4);
    else addItem('Contexto de online', 'warn', 'Vale indicar se existe online obrigatório, opcional ou inexistente.', 1);

    if (getWordsCount(grind) >= 2) addItem('Contexto de grind', 'ok', 'O nível de repetição já fica claro antes da publicação.', 4);
    else addItem('Contexto de grind', 'warn', 'Vale indicar se o grind é leve, moderado ou pesado.', 1);

    if (getWordsCount(dlc) >= 2) addItem('Escopo de DLC', 'ok', 'O escopo base/DLC está explícito.', 4);
    else addItem('Escopo de DLC', 'warn', 'Indique se a análise considera só a lista base ou também DLC.', 1);

    const missableWords = getWordsCount(missable);
    if (missableWords >= 10) addItem('Alerta de perdíveis', 'ok', 'O aviso de risco já tem contexto mínimo para orientar a run.', 14);
    else if (missableWords >= 4) addItem('Alerta de perdíveis', 'warn', 'O alerta existe, mas ainda está curto para transmitir risco real.', 8);
    else addItem('Alerta de perdíveis', 'error', 'Explique melhor o risco de perdíveis, ponto sem retorno ou cleanup.', 2);

    const criticalEditorialFields = [
      { label: 'Resumo de runs', value: runs, minWords: 3 },
      { label: 'Resumo de perdíveis', value: missable, minWords: 8 },
      { label: 'Razão da dificuldade', value: difficultyReason, minWords: 7 },
      { label: 'Razão do tempo', value: timeReason, minWords: 7 },
      { label: 'Antes de começar', value: beforeYouStart, minWords: 7 },
      { label: 'Primeira run', value: firstRunAdvice, minWords: 7 },
      { label: 'Cleanup', value: cleanupAdvice, minWords: 7 },
      { label: 'Melhor para', value: idealFor, minWords: 6 },
      { label: 'Evite se', value: avoidFor, minWords: 6 }
    ];
    const criticalMissing = criticalEditorialFields
      .filter(field => getWordsCount(field.value) < field.minWords)
      .map(field => field.label);
    if (!criticalMissing.length) {
      addItem('Decisão editorial crítica', 'ok', 'Os campos que explicam decisão, risco e encaixe estão preenchidos.', 12);
    } else if (criticalMissing.length <= 3) {
      addItem('Decisão editorial crítica', 'warn', `Campos críticos ainda fracos: ${criticalMissing.join(', ')}.`, 5);
    } else {
      addItem('Decisão editorial crítica', 'error', `Preencha os campos críticos antes de tratar o guia como completo: ${criticalMissing.slice(0, 5).join(', ')}.`, 0);
    }

    if (getWordsCount(difficultyReason) >= 7) addItem('Motivo da dificuldade', 'ok', 'A nota de dificuldade tem explicação editorial, não só número.', 4);
    else addItem('Motivo da dificuldade', 'warn', 'Explique o que torna a platina fácil, média ou difícil.', 0);

    if (getWordsCount(timeReason) >= 7) addItem('Motivo do tempo', 'ok', 'A estimativa de tempo já tem contexto de campanha, cleanup ou grind.', 4);
    else addItem('Motivo do tempo', 'warn', 'Explique de onde vem a estimativa de horas.', 0);

    if (getWordsCount(beforeYouStart) >= 7) addItem('Antes de começar', 'ok', 'O guia já prepara a decisão antes da primeira sessão.', 4);
    else addItem('Antes de começar', 'warn', 'Registre o aviso principal antes da primeira run.', 0);

    if (getWordsCount(firstRunAdvice) >= 7) addItem('Primeira run', 'ok', 'Há orientação específica para entrar sem criar retrabalho.', 4);
    else addItem('Primeira run', 'warn', 'Adicione uma recomendação clara para a primeira campanha/run.', 0);

    if (getWordsCount(cleanupAdvice) >= 7) addItem('Cleanup', 'ok', 'O fechamento pós-campanha tem orientação própria.', 4);
    else addItem('Cleanup', 'warn', 'Explique como o jogador deve lidar com pendências e pós-game.', 0);

    const mentionsMissableRisk = hasMissableRiskSignal(missable);
    if (mentionsMissableRisk && missableFlags === 0) {
      addItem('Consistência de perdíveis', 'error', 'O texto fala de perdível, ponto sem retorno ou nova run, mas nenhum troféu está marcado como perdível.', 0);
    } else if (mentionsMissableRisk) {
      addItem('Consistência de perdíveis', 'ok', 'Os troféus perdíveis estão marcados de forma coerente com o alerta editorial.', 4);
    } else if (trophies.length >= 30 && missableFlags === 0 && spoilerFlags === 0) {
      addItem('Revisão de risco da lista', 'warn', 'Lista grande sem perdíveis nem spoilers marcados; revise se o cadastro não está simplificando demais o risco.', 1);
    }

    if (roadmap.length >= 4) addItem('Roadmap editorial', 'ok', 'A run já parece estruturada em etapas claras.', 16);
    else if (roadmap.length >= 2) addItem('Roadmap editorial', 'warn', 'O roadmap existe, mas ainda parece curto para um guia completo.', 10);
    else addItem('Roadmap editorial', 'error', 'Faltam etapas claras para o roadmap.', 2);

    if (trophies.length >= 12) addItem('Cobertura de troféus', 'ok', 'A lista parece ter densidade suficiente para um guia útil.', 16);
    else if (trophies.length >= 4) addItem('Cobertura de troféus', 'warn', 'Há troféus cadastrados, mas a cobertura ainda parece parcial.', 10);
    else addItem('Cobertura de troféus', 'error', 'Poucos troféus cadastrados; o guia ainda parece raso.', 2);

    const describedRatio = trophies.length ? describedTrophies / trophies.length : 0;
    if (describedRatio >= 0.8) addItem('Descrição dos troféus', 'ok', 'A maior parte dos troféus já tem descrição útil.', 10);
    else if (describedRatio >= 0.45) addItem('Descrição dos troféus', 'warn', 'Parte dos troféus ainda precisa de descrição melhor.', 6);
    else addItem('Descrição dos troféus', 'error', 'As descrições ainda estão rasas para um guia confiável.', 1);

    const tipRatio = trophies.length ? tippedTrophies / trophies.length : 0;
    if (tipRatio >= 0.7) addItem('Dicas / execução', 'ok', 'Boa parte dos troféus já traz orientação de execução.', 10);
    else if (tipRatio >= 0.35) addItem('Dicas / execução', 'warn', 'As dicas existem, mas ainda não cobrem bem a lista.', 6);
    else addItem('Dicas / execução', 'error', 'Faltam dicas práticas para a maioria dos troféus.', 1);

    if (getWordsCount(idealFor) >= 6) addItem('Perfil ideal', 'ok', 'O guia já diz para quem ele faz sentido.', 4);
    else addItem('Perfil ideal', 'warn', 'Explique melhor para quem essa platina encaixa.', 1);

    if (getWordsCount(avoidFor) >= 6) addItem('Quando evitar', 'ok', 'Há contexto claro de quando esta não é a melhor escolha.', 4);
    else addItem('Quando evitar', 'warn', 'Vale registrar quando o projeto tende a frustrar mais.', 1);

    if (getWordsCount(bestForWhen) >= 5) addItem('Melhor momento', 'ok', 'O guia já orienta quando vale começar.', 4);
    else addItem('Melhor momento', 'warn', 'Descreva melhor em que momento esta platina encaixa.', 1);

    if (editorialStatus === 'draft') addItem('Status público', 'warn', 'Este jogo está como rascunho e ficará fora do catálogo público.', 0);
    else if (editorialStatus === 'review') addItem('Status público', 'warn', 'Este guia aparecerá com selo claro de revisão.', 2);
    else addItem('Status público', 'ok', 'Este guia está marcado como publicado.', 3);

    if (coverageLevel === 'complete') addItem('Nível de cobertura', 'ok', 'O guia está marcado como completo.', 4);
    else if (coverageLevel === 'strong') addItem('Nível de cobertura', 'ok', 'A cobertura está forte, mas ainda não se apresenta como completa.', 3);
    else addItem('Nível de cobertura', 'warn', 'Base inicial: o guia deve evitar parecer definitivo.', 1);

    if (isVerified) addItem('Verificação manual', 'ok', 'Os dados foram marcados como verificados manualmente.', 3);
    else addItem('Verificação manual', 'warn', 'Sem verificação manual: a página pública deve usar linguagem cautelosa.', 0);

    if (criticalMissing.length >= 4) score = Math.min(score, 82);
    else if (criticalMissing.length > 0) score = Math.min(score, 92);

    score = Math.max(0, Math.min(100, score));

    let badge = 'Rascunho fraco';
    let tone = 'draft';
    let summary = 'O guia ainda precisa de profundidade editorial antes de publicar.';
    if (score >= 85) {
      badge = 'Quase pronto para publicar';
      tone = 'strong';
      summary = 'Bom nível de completude. Faça só uma revisão final de consistência antes de publicar.';
    } else if (score >= 70) {
      badge = 'Base boa, falta lapidar';
      tone = 'solid';
      summary = 'A estrutura já está boa, mas ainda há pontos para fortalecer confiança e contexto.';
    } else if (score >= 50) {
      badge = 'Publicável com cautela';
      tone = 'fragile';
      summary = 'O guia já tem base, mas ainda passa sensação de conteúdo parcial em alguns pontos.';
    }

    const meta = [
      {
        label: 'Cobertura editorial',
        value: trophies.length ? `${describedTrophies}/${trophies.length} descrições úteis` : 'Sem troféus',
        help: 'Quanto da lista já explica o que fazer.'
      },
      {
        label: 'Sinais de risco',
        value: `${missableFlags} perdível(is) • ${spoilerFlags} spoiler(s)`,
        help: 'Ajuda a revisar se o guia está rotulando o risco certo.'
      },
      {
        label: 'Prontidão SEO',
        value: image && hasReadableTime(time) && name ? 'Boa base' : 'Precisa reforço',
        help: 'Título, tempo legível e capa ajudam a página a parecer completa.'
      }
    ];

    return { score, badge, tone, summary, items, meta };
  }

  function refreshEditorialQuality(UI, state, collectGameFormPayload) {
    if (!UI?.renderAdminQuality) return null;
    const payload = buildPreviewPayload({ UI, state, collectGameFormPayload });
    const model = createEditorialQualityModel(payload);
    UI.renderAdminQuality(model);
    return model;
  }

  function createAdminController(deps) {
    const {
      UI, ApiService, state, page,
      loadGames, syncSession, navigate,
      collectGameFormPayload,
      removeEntriesByIdentity, persistLibrary
    } = deps;

    async function loadAdminGames() {
      if (!state.session.authenticated) return;
      state.adminGamesResponse = await ApiService.getGames({
        q: state.adminSearch,
        sort: state.adminSort,
        page: state.adminPage,
        limit: 10
      });
      state.adminPage = state.adminGamesResponse.pagination?.page || 1;
      UI.renderAdminGames(state.adminGamesResponse);
    }

    async function loadAdminSummary() {
      if (!state.session.authenticated) return;
      state.adminSummary = await ApiService.getAdminSummary();
      UI.renderAdminSummary(state.adminSummary);
    }

    async function loadAdminFeedback() {
      if (!state.session.authenticated) return;
      state.adminFeedbackResponse = await ApiService.getAdminFeedback({
        page: state.adminFeedbackPage || 1,
        limit: 10
      });
      state.adminFeedbackPage = state.adminFeedbackResponse.pagination?.page || 1;
      UI.renderAdminFeedback?.(state.adminFeedbackResponse);
    }

    async function loadAdminBetaMetrics() {
      if (!state.session.authenticated) return;
      state.adminBetaMetrics = await ApiService.getAdminBetaMetrics();
      UI.renderAdminBetaMetrics?.(state.adminBetaMetrics);
    }

    function openFormPreview() {
      const payload = buildPreviewPayload({ UI, state, collectGameFormPayload });
      UI.renderAdminQuality(createEditorialQualityModel(payload));
      if (!payload.name) {
        UI.setAdminFormFeedback('Preencha pelo menos o nome do jogo antes de gerar a prévia.', 'error');
        return UI.showToast('Preencha pelo menos o nome do jogo antes de gerar a prévia.', 'error');
      }
      UI.renderAdminPreview(payload);
      UI.setAdminFormFeedback('Prévia atualizada com os dados do formulário.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function openAdminPanel() {
      if (!state.session.authenticated) {
        if (page === 'admin') {
          window.location.replace('/admin');
          return;
        }
        UI.openAdminModal();
        return;
      }
      await Promise.all([loadGames(), loadAdminSummary(), loadAdminGames(), loadAdminFeedback(), loadAdminBetaMetrics()]);
      UI.showView('admin');
      refreshEditorialQuality(UI, state, collectGameFormPayload);
      UI.updateAdminFieldMetrics?.();
    }

    async function handleUploadCover() {
      const file = UI.qs('#gameImageFile')?.files?.[0];
      if (!file) return UI.showToast('Selecione uma imagem para enviar.', 'error');
      try {
        UI.setUploadState(true, `Enviando ${file.name}...`);
        const response = await ApiService.uploadCover(file);
        UI.setImagePreview(response.imageUrl);
        UI.setUploadState(false, 'Upload concluído.');
        refreshEditorialQuality(UI, state, collectGameFormPayload);
        UI.showToast(response.message, 'success');
      } catch (error) {
        UI.setUploadState(false, error.message);
        UI.showToast(error.message, 'error');
      }
    }

    function handleParseTrophies() {
      const rawText = UI.qs('#rawTrophiesInput')?.value?.trim() || '';
      if (!rawText) return UI.showToast('Cole o texto dos troféus antes de converter.', 'error');

      const trophies = parseTrophiesFromRawText(rawText);
      if (!trophies.length) {
        return UI.showToast('Não consegui identificar troféus nesse texto. Use o formato "Nome: descrição".', 'error');
      }

      UI.replaceTrophyInputs(trophies);
      UI.updateAdminFieldMetrics?.();
      refreshEditorialQuality(UI, state, collectGameFormPayload);
      UI.showToast(`${trophies.length} troféu(s) convertidos com sucesso.`, 'success');
    }

    async function handleGameSubmit(event) {
      event.preventDefault();
      try {
        const payload = collectGameFormPayload(UI);
        const quality = createEditorialQualityModel(payload);
        UI.renderAdminQuality(quality);
        if (quality.score < 55 && !window.confirm(`Este guia está com score editorial ${quality.score}/100 e ainda parece raso. Deseja salvar mesmo assim?`)) return;
        const gameId = UI.qs('#gameId').value.trim();
        const response = gameId ? await ApiService.updateGame(gameId, payload) : await ApiService.createGame(payload);
        await Promise.all([loadGames({ force: true }), loadAdminSummary(), loadAdminGames()]);
        UI.renderAdminSummary(state.adminSummary);
        UI.resetGameForm();
        UI.toggleGameForm(false);
        UI.togglePreviewPanel(false);
        UI.setAdminFormFeedback('', 'info');
        UI.showToast(response.message, 'success');
      } catch (error) {
        if (error.status === 401) {
          await syncSession();
          if (page === 'admin') {
            window.location.replace('/admin');
            return;
          }
          UI.openAdminModal();
        }
        UI.showToast(error.details?.join(' | ') || error.message, 'error');
      }
    }

    async function handleEditGame(id) {
      try {
        const game = await ApiService.getGameById(id);
        UI.fillGameForm(game);
        refreshEditorialQuality(UI, state, collectGameFormPayload);
        UI.setAdminFormFeedback('Editando jogo existente. Gere uma prévia se quiser revisar o resultado antes de salvar.', 'info');
        UI.toggleGameForm(true);
        UI.showView('admin');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        UI.showToast(error.message, 'error');
      }
    }

    function removeLibraryEntriesByGameIdentity({ id, name } = {}) {
      const result = removeEntriesByIdentity(state.library, { id, name });
      if (!result.removed) return;
      state.library = result.library;
      persistLibrary();
    }

    async function handleDeleteGame(id, name) {
      if (!window.confirm(`Excluir o jogo "${name}"? Essa ação não pode ser desfeita.`)) return;
      try {
        const response = await ApiService.deleteGame(id);
        removeLibraryEntriesByGameIdentity({ id, name });
        await Promise.all([loadGames({ force: true }), loadAdminSummary(), loadAdminGames()]);
        UI.renderAdminSummary(state.adminSummary);
        UI.showToast(response.message, 'success');
      } catch (error) {
        UI.showToast(error.message, 'error');
      }
    }

    async function handleDuplicateGame(id) {
      try {
        const response = await ApiService.duplicateGame(id);
        await Promise.all([loadGames({ force: true }), loadAdminSummary(), loadAdminGames()]);
        UI.renderAdminSummary(state.adminSummary);
        UI.showToast(response.message, 'success');
        UI.setAdminFormFeedback(`Cópia criada: ${response.game?.name || 'novo jogo'}.`, 'success');
      } catch (error) {
        UI.showToast(error.message, 'error');
        UI.setAdminFormFeedback(error.details?.join(' | ') || error.message, 'error');
      }
    }

    async function handlePreviewExistingGame(id) {
      try {
        const game = await ApiService.getGameById(id);
        UI.renderAdminPreview(game);
        UI.setAdminFormFeedback('Prévia aberta a partir do catálogo salvo.', 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        UI.showToast(error.message, 'error');
      }
    }

    async function handlePasswordChange(event) {
      event.preventDefault();
      try {
        const currentPassword = UI.qs('#currentPassword')?.value || '';
        const nextPassword = UI.qs('#nextPassword')?.value || '';
        const response = await ApiService.changePassword({ currentPassword, nextPassword });
        if (UI.qs('#passwordForm')) UI.qs('#passwordForm').reset();
        UI.togglePasswordPanel(false);
        UI.showToast(response.message, 'success');
        UI.setAdminFormFeedback('Senha atualizada com sucesso.', 'success');
      } catch (error) {
        UI.showToast(error.message, 'error');
        UI.setAdminFormFeedback(error.details?.join(' | ') || error.message, 'error');
      }
    }

    async function handleAdminLogin(event) {
      event.preventDefault();
      try {
        const username = UI.qs('#adminUsername').value.trim();
        const password = UI.qs('#adminPassword').value;
        const session = await ApiService.login({ username, password });
        state.session = session;
        UI.setAdminState(session);
        UI.closeAdminModal();
        UI.showToast(session.message, 'success');
        if (page === 'public') window.location.href = '/admin';
        else await openAdminPanel();
      } catch (error) {
        UI.showToast(error.message, 'error');
      }
    }

    async function handleAdminLogout() {
      try {
        const response = await ApiService.logout();
        state.session = response;
        UI.setAdminState(response);
        UI.showToast(response.message, 'success');
        if (page === 'admin') {
          window.location.replace('/admin');
          return;
        } else {
          navigate('home');
        }
      } catch (error) {
        UI.showToast(error.message, 'error');
      }
    }

    function bindAdminEvents() {
      const openBoundAdminModal = () => {
        UI.openAdminModal();
        bindAdminModalEvents();
      };
      UI.qs('#adminAccessBtn')?.addEventListener('click', () => page === 'public' ? openBoundAdminModal() : openAdminPanel());
      UI.qs('#adminAccessBtnFooter')?.addEventListener('click', openBoundAdminModal);
      UI.qs('#adminLogoutBtn')?.addEventListener('click', handleAdminLogout);
      bindAdminModalEvents();

      UI.qs('#newGameBtn')?.addEventListener('click', () => {
        UI.resetGameForm();
        UI.setAdminFormFeedback('Preencha os campos e use pré-visualizar para revisar antes de salvar.', 'info');
        UI.toggleGameForm(true);
        refreshEditorialQuality(UI, state, collectGameFormPayload);
      });
      UI.qs('#previewGameBtn')?.addEventListener('click', openFormPreview);
      UI.qs('#closePreviewPanelBtn')?.addEventListener('click', () => UI.togglePreviewPanel(false));
      UI.qs('#previewOpenPublicBtn')?.addEventListener('click', event => {
        const slug = event.currentTarget.dataset.previewSlug;
        if (slug) window.open(`/jogo/${slug}`, '_blank', 'noopener');
      });
      UI.qs('#togglePasswordPanelBtn')?.addEventListener('click', () => UI.togglePasswordPanel());
      UI.qs('#closePasswordPanelBtn')?.addEventListener('click', () => UI.togglePasswordPanel(false));
      UI.qs('#passwordForm')?.addEventListener('submit', handlePasswordChange);
      UI.qs('#adminRefreshBtn')?.addEventListener('click', async () => {
        await Promise.all([loadGames({ force: true }), loadAdminSummary(), loadAdminGames(), loadAdminFeedback(), loadAdminBetaMetrics()]);
        UI.showToast('Catálogo administrativo atualizado.', 'success');
      });
      UI.qs('#adminBetaMetricsRefreshBtn')?.addEventListener('click', async () => {
        await loadAdminBetaMetrics();
        UI.showToast('Métricas do beta atualizadas.', 'success');
      });
      UI.qs('#adminFeedbackRefreshBtn')?.addEventListener('click', async () => {
        state.adminFeedbackPage = 1;
        await Promise.all([loadAdminFeedback(), loadAdminBetaMetrics()]);
        UI.showToast('Feedbacks atualizados.', 'success');
      });
      UI.qs('#adminFeedbackPanel')?.addEventListener('click', async event => {
        const pageButton = event.target.closest('[data-feedback-page]');
        if (!pageButton) return;
        state.adminFeedbackPage = Number(pageButton.dataset.feedbackPage || 1);
        await loadAdminFeedback();
      });
      UI.qs('#cancelGameFormBtn')?.addEventListener('click', () => {
        UI.toggleGameForm(false);
        UI.setAdminFormFeedback('', 'info');
      });
      UI.qs('#addTrophyBtn')?.addEventListener('click', () => { UI.appendTrophyInput(); refreshEditorialQuality(UI, state, collectGameFormPayload); });
      UI.qs('#parseTrophiesBtn')?.addEventListener('click', handleParseTrophies);
      UI.qs('#clearParsedTextBtn')?.addEventListener('click', () => {
        const field = UI.qs('#rawTrophiesInput');
        if (field) field.value = '';
        UI.updateAdminFieldMetrics?.();
        refreshEditorialQuality(UI, state, collectGameFormPayload);
        UI.showToast('Texto bruto limpo.', 'success');
      });
      UI.qs('#gameForm')?.addEventListener('submit', handleGameSubmit);
      UI.qs('#gameForm')?.addEventListener('input', () => {
        UI.updateAdminFieldMetrics?.();
        refreshEditorialQuality(UI, state, collectGameFormPayload);
      });
      UI.qs('#gameForm')?.addEventListener('change', () => {
        UI.updateAdminFieldMetrics?.();
        refreshEditorialQuality(UI, state, collectGameFormPayload);
      });
      UI.qs('#uploadCoverBtn')?.addEventListener('click', handleUploadCover);
      UI.qs('#clearImageBtn')?.addEventListener('click', () => {
        if (UI.qs('#gameImageFile')) UI.qs('#gameImageFile').value = '';
        if (UI.qs('#gameImage')) UI.qs('#gameImage').value = '';
        UI.setImagePreview('');
        UI.setUploadState(false, 'Capa removida do formulário.');
        refreshEditorialQuality(UI, state, collectGameFormPayload);
      });
      UI.qs('#gameImage')?.addEventListener('input', event => { UI.setImagePreview(event.target.value.trim()); refreshEditorialQuality(UI, state, collectGameFormPayload); });
      UI.qs('#gameImageFile')?.addEventListener('change', event => {
        const file = event.target.files?.[0];
        UI.setUploadState(false, file ? `Arquivo selecionado: ${file.name}` : '');
        refreshEditorialQuality(UI, state, collectGameFormPayload);
      });

      UI.qs('#trophiesContainer')?.addEventListener('click', event => {
        const removeButton = event.target.closest('[data-remove-trophy]');
        if (!removeButton) return;
        const items = UI.qsa('#trophiesContainer .trophy-input');
        if (items.length <= 1) return UI.showToast('O jogo precisa ter pelo menos um troféu.', 'error');
        removeButton.closest('.trophy-input').remove();
        refreshEditorialQuality(UI, state, collectGameFormPayload);
      });

      UI.qs('#adminSearch')?.addEventListener('input', async event => {
        state.adminSearch = event.target.value || '';
        state.adminPage = 1;
        await loadAdminGames();
      });

      UI.qs('#adminSort')?.addEventListener('change', async event => {
        state.adminSort = event.target.value || 'updated-desc';
        state.adminPage = 1;
        await loadAdminGames();
      });

      UI.qs('#adminGamesList')?.addEventListener('click', event => {
        const editButton = event.target.closest('[data-admin-edit]');
        if (editButton) return handleEditGame(editButton.dataset.adminEdit);
        const previewButton = event.target.closest('[data-admin-preview]');
        if (previewButton) return handlePreviewExistingGame(previewButton.dataset.adminPreview);
        const duplicateButton = event.target.closest('[data-admin-duplicate]');
        if (duplicateButton) return handleDuplicateGame(duplicateButton.dataset.adminDuplicate);
        const deleteButton = event.target.closest('[data-admin-delete]');
        if (deleteButton) handleDeleteGame(deleteButton.dataset.adminDelete, deleteButton.dataset.adminName);
      });
    }

    function bindAdminModalEvents() {
      const modal = UI.qs('#adminModal');
      if (!modal || modal.dataset.adminBound === 'true') return;
      modal.dataset.adminBound = 'true';
      UI.qs('#closeAdminModalBtn')?.addEventListener('click', UI.closeAdminModal);
      modal.addEventListener('click', event => { if (event.target.id === 'adminModal') UI.closeAdminModal(); });
      UI.qs('#adminLoginForm')?.addEventListener('submit', handleAdminLogin);
    }

    return {
      loadAdminGames,
      loadAdminSummary,
      loadAdminFeedback,
      loadAdminBetaMetrics,
      openFormPreview,
      openAdminPanel,
      bindAdminEvents,
      bindAdminModalEvents
    };
  }

  return {
    collectGameFormPayload,
    createEditorialQualityModel,
    refreshEditorialQuality,
    createAdminController
  };
})();
