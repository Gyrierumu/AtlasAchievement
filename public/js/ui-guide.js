window.UIGuide = (() => {
  const { qs, qsa, escapeHtml, escapeAttribute, getGameCoverSrc, getGameImageSrc, deriveSteamLibraryCover, isPlaceholderGameImage } = window.UIShared;
  const { buildGameGuideH1, getLibraryStatusLabel } = window.UIFormatters;
  const {
    TROPHY_TYPE_FILTERS,
    buildGuidePlayerFit,
    buildGuideViewModel,
    buildThirtySecondVerdict,
    getEditorialBadge,
    getDifficultyTone,
    getDifficultyToneClass,
    compactGuideText,
    getLibraryMeta,
    hasMissableRiskText,
    getTrophyRiskTags,
    getGuideTrophyTags,
    getGuideTrophyDisplayTags,
    getGuideTrophySearchText,
    buildTrophyYoutubeSearchUrl,
    buildTrophyYoutubeSearchAriaLabel,
    buildGuideQuickDecisionModel,
    buildGuideShortcutModel,
    buildGuideStartContextModel,
    buildGuideSummaryCards,
    buildGuideRiskAlerts,
    buildGuideBeforeStartItems,
    buildGuideEditorialSummary,
    buildGuideQuickPlan
  } = window.UIDecisionModels;
  const sharedEditorial = window.AtlasEditorialModel || {};
  const featureFlags = window.AtlasFeatureFlags || {};
  const sharedCard = window.AtlasCardModel || {};

  const CHECKLIST_DENSITY_KEY = 'atlas_checklist_density';
  function compactGuideHeaderText(value = '', fallback = '', maxLength = 150) {
    if (typeof compactGuideText === 'function') return compactGuideText(value, fallback, maxLength);
    const text = String(value || fallback || '').trim().replace(/\s+/g, ' ');
    const max = Number(maxLength || 0);
    if (!max || text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
  }

  const REQUIEM_EDITORIAL_SUMMARY = [
    'Resident Evil Requiem combina campanha, coletáveis, objetivos situacionais e runs condicionais. A platina gira em torno de acompanhar saves manuais, controlar arquivos e colecionáveis, separar troféus de personagem e planejar restrições como speedrun, cura e uso do Blood Collector.',
    'O ponto mais importante é não tratar toda tarefa situacional como perdível definitivo. Alguns objetivos exigem atenção em janelas específicas, mas muitos podem ser organizados com saves, nova run ou cleanup. Use a checklist para separar riscos reais, spoilers, coletáveis, dificuldade e objetivos acumuláveis.',
    'A melhor rota é começar com uma campanha exploratória, mantendo saves manuais e marcando arquivos, Mr. Raccoons, cofres, containers da BSAA, armas, upgrades e eventos situacionais. Depois, use o roadmap para separar runs condicionais, limpeza de bônus, dificuldade e pendências da lista base.'
  ];
  const HADES_EDITORIAL_SUMMARY = [
    'Hades é uma platina baseada em progresso acumulado entre runs. O foco não está em troféus perdíveis, mas em transformar cada tentativa em avanço real: evoluir a Mirror of Night, liberar armas, distribuir Nectar, trabalhar relacionamentos, completar profecias da Fated List e avançar a história até o epílogo.',
    'A melhor estratégia é não tentar limpar tudo nas primeiras fugas. Use as runs iniciais para aprender armas, boons, chefes e padrões de combate. Depois que a primeira fuga estiver consistente, comece a organizar Keepsakes, Companions, Pact of Punishment, Heat e objetivos longos sem desperdiçar runs aleatórias.',
    'God Mode não bloqueia troféus e pode ser usado como recurso opcional. A platina base é totalmente offline, sem coop obrigatório e sem DLC necessária. O cleanup final gira em torno de relacionamentos, Fated List, Keepsakes no rank máximo, Companions, Heat e pendências de armas ou recursos.'
  ];
  const GHOST_EDITORIAL_SUMMARY = [
    'Ghost of Tsushima é uma platina de mundo aberto acessível, baseada em campanha, exploração, Tales of Tsushima, Mythic Tales, liberação de regiões e limpeza de atividades pelo mapa. A lista base não exige online, coop, Legends, Iki Island ou New Game+, então dá para jogar a campanha com calma e deixar o cleanup para o free roam.',
    'A melhor rota é avançar a história enquanto desbloqueia ferramentas, posturas, viagem rápida e acesso às regiões. Ao mesmo tempo, vale completar atividades próximas ao caminho, como fontes termais, bambus, haiku, santuários, faróis, acampamentos e contos secundários, para reduzir a limpeza final.',
    'Depois da campanha, use o free roam para finalizar coletáveis, Tales pendentes, Mythic Tales, atividades regionais, cosméticos e troféus situacionais. Como não há perdíveis obrigatórios na lista base, o foco do guia é organizar o checklist para evitar retrabalho e separar claramente o que pertence à platina base do conteúdo extra.'
  ];
  const GOD_OF_WAR_2018_EDITORIAL_SUMMARY = [
    'God of War (2018) tem uma platina focada em campanha, exploração dos reinos e cleanup pós-história. A lista base não exige online, coop ou dificuldade específica, então o maior desafio não está em perder troféus, mas em organizar coletáveis, favores, melhorias, Valkyries, Muspelheim, Niflheim e atividades opcionais sem deixar tudo acumulado para o final.',
    'A melhor estratégia é jogar a história em uma dificuldade confortável, explorando naturalmente e abrindo o máximo possível de atalhos, baús, favores e áreas secundárias. Não é necessário limpar tudo logo de início, porque o jogo permite voltar depois da campanha para resolver pendências com mais recursos, equipamentos e habilidades.',
    'Depois da história, foque no cleanup dos reinos, mapas do tesouro, artefatos, corvos, baús, favores, Valkyries e objetivos ligados a Muspelheim e Niflheim. Separar história, exploração e limpeza final deixa a platina mais controlada e evita retrabalho.'
  ];
  const GOD_OF_WAR_RAGNAROK_EDITORIAL_SUMMARY = [
    'God of War Ragnarök tem uma platina focada em campanha, exploração dos reinos e cleanup pós-história. A lista base não exige online, coop ou dificuldade específica, então o desafio principal está em organizar favores, coletáveis, equipamentos, upgrades, Berserkers, Gná, Muspelheim, Cratera/Vanaheim e atividades opcionais sem transformar o final em uma limpeza enorme.',
    'A melhor estratégia é jogar a história em uma dificuldade confortável, explorando naturalmente e abrindo caminhos, baús, favores e atividades quando estiverem no caminho. Não é necessário limpar tudo logo de início, porque o jogo permite voltar depois da campanha para resolver pendências com mais recursos, equipamentos e acesso aos reinos.',
    'Depois da história, foque no cleanup por região: artefatos, lore, corvos de Odin, baús Nornir, fendas, favores, relíquias, punhos de espada, lápides Berserker, desafios de Muspelheim, Cratera/Vanaheim e chefes opcionais. Valhalla e outros extras ficam fora da rota da platina base.'
  ];
  const HADES2_EDITORIAL_SUMMARY = [
    'Hades II é uma platina longa de roguelite, baseada em progresso acumulado entre runs. O foco está em evoluir Melinoë, liberar armas, ferramentas, Arcana, Incantations, Familiars, Keepsakes, rotas do Submundo e da Superfície, além de avançar diálogos e objetivos da Fated List.',
    'A melhor rota é usar as primeiras runs para estabilizar a Crossroads, entender os Guardians e abrir sistemas permanentes antes de tentar limpar tudo. Depois que as rotas estiverem mais consistentes, organize armas, aspectos, recursos raros, relacionamentos, Chaos Trials, Oath of the Unseen e objetivos longos sem desperdiçar runs aleatórias.',
    'A platina base não exige online, coop ou DLC. God Mode pode ser usado como recurso opcional sem bloquear troféus. O cleanup final gira em torno de Fated List, Arcana, Incantations, Familiars, Keepsakes, relacionamentos, rotas avançadas, Chronos, Surface e pendências situacionais.'
  ];
  const ASTRO_BOT_EDITORIAL_SUMMARY = [
    'Astro Bot é uma platina curta, acessível e focada em exploração de fases, resgate de bots, coleta de puzzle pieces, fases secretas da Lost Galaxy e objetivos situacionais no Crash Site. Nada é perdível na lista base, então dá para jogar a campanha com calma e voltar depois para limpar o que ficou pendente.',
    'A melhor rota é avançar pelos mundos principais explorando bem cada fase, mas sem tentar fazer 100% perfeito logo na primeira passagem. Depois que a seleção de fases estiver mais aberta, revise bots, puzzle pieces, saídas secretas, desafios especiais e atividades do Crash Site com o checklist ao lado.',
    'O cleanup final gira em torno de completar bots, puzzle pieces, Lost Galaxy, Gatcha Lab, interações no hub e troféus situacionais. A platina base não exige coop obrigatório, não exige online obrigatório e não depende de DLC.'
  ];
  const PRAGMATA_EDITORIAL_SUMMARY = [
    'PRAGMATA é uma platina sci-fi single-player baseada em campanha, exploração, hacking com Diana, progressão no Abrigo, LMTs, Mini Cabins, escotilhas, Red Zones, Training Sims, Unknown Signal e uma jogada separada em Lunatic. A rota exige atenção ao perdível e aos objetivos situacionais, mas não depende de online, coop ou DLC.',
    'A melhor estratégia é fazer a primeira campanha aprendendo o ciclo Hugh + Diana, conversando com Diana no Abrigo e acompanhando coletáveis desde cedo. Durante essa run, mantenha atenção ao alerta de You\'re Not Getting Away That Easy, além de registrar LMTs, Mini Cabins, escotilhas, Red Zones e objetivos que podem exigir setup específico.',
    'Depois da campanha, use o pós-jogo e Unknown Signal para limpar setores, Training Sims, upgrades, coletáveis e troféus situacionais. A etapa de Lunatic deve ser tratada como jogada separada, deixando a run de dificuldade para quando você já conhecer bem combate, hacking, chefes e rotas.'
  ];
  const SAROS_EDITORIAL_SUMMARY = [
    'Saros é uma platina baseada em progressão por runs, domínio de combate e evolução gradual dos sistemas permanentes. A rota deve ser tratada como guia próprio: use as primeiras tentativas para aprender movimentação, padrões de chefes, armas, upgrades, salas especiais e como o jogo estrutura objetivos acumulativos.',
    'A melhor estratégia é avançar a campanha sem tentar limpar tudo de uma vez. Priorize sobrevivência, desbloqueios permanentes, familiaridade com biomas, Nightmare Gates, melhorias e objetivos que se acumulam naturalmente entre runs. Como não há online ou coop obrigatório, a platina depende principalmente de consistência, leitura de risco e organização da checklist.',
    'Depois de estabilizar a base, foque em chefes restantes, coletáveis, desafios, troféus situacionais, epílogo e cleanup final. Objetivos de run sem dano ou execução perfeita devem ser tratados como risco de run/dificuldade, não como perdíveis definitivos, quando puderem ser repetidos.'
  ];
  const RE4_REMAKE_EDITORIAL_SUMMARY = [
    'Resident Evil 4 Remake é uma platina baseada em múltiplas campanhas, domínio dos capítulos, saves manuais, coletáveis, pedidos do Mercador, Clockwork Castellans, tesouros, Shooting Range, armas, troféus situacionais e runs de restrição. A lista base não exige online, coop, Separate Ways, VR Mode, The Mercenaries ou tickets pagos.',
    'A melhor estratégia é usar a primeira campanha para aprender rotas, chefes, economia de recursos e pontos sem volta, enquanto já adianta tesouros, pedidos do Mercador, castelões e armas importantes. Não tente combinar todas as restrições logo de início; separar objetivos reduz o risco de quebrar uma run e evita retrabalho.',
    'Depois da primeira campanha, organize runs específicas para NG+, Professional, S+, Minimalist, Frugalist, Silent Stranger, Sprinter, Shooting Range e cleanup de troféus situacionais. Como o jogo não tem chapter select tradicional nem free roam final, saves manuais por capítulo e checklist atualizado fazem diferença para evitar repetir campanhas desnecessárias.'
  ];
  const NIOH2_EDITORIAL_SUMMARY = [
    'Nioh 2 é uma platina de progressão longa, focada em dominar o combate, concluir missões da lista base, explorar regiões e fechar objetivos acumulativos como Kodama, Hot Springs, Soul Cores, proficiência de armas e registros de yokai. A lista base não tem perdíveis definitivos, então o risco principal não é perder troféus, e sim deixar muita limpeza acumulada para o final.',
    'A melhor rota é avançar a campanha aprendendo sistemas como Ki Pulse, Burst Counter, Yokai Shift, Guardian Spirits e Soul Cores, enquanto limpa missões secundárias e acompanha coletáveis por região. O jogo permite retornar a missões, então a platina favorece organização, paciência e evolução consistente do personagem.',
    'Depois da história, concentre o cleanup em missões pendentes, proficiência, ferreiro, títulos, yokai, Kodama, Hot Springs e troféus situacionais. Coop e recursos online podem ajudar, mas não são obrigatórios para a platina base.'
  ];
  const NIOH3_EDITORIAL_SUMMARY = [
    'Nioh 3 é uma platina longa e técnica, focada em avançar a campanha, dominar o combate e limpar missões, coletáveis e sistemas acumulativos da lista base. Online e coop não entram como requisitos obrigatórios: a rota principal pode ser organizada solo, com retorno a missões e cleanup por região.',
    'A melhor estratégia é usar a campanha para aprender a alternância entre Samurai e Ninja, fortalecer equipamentos, explorar Guardian Spirits, Battle Scroll, Yokai, ferreiro e trackers regionais. Como não há perdíveis definitivos na lista base, o risco principal não é perder troféus, mas acumular Kodama, Hot Springs, missões, Soul Cores, proficiência e objetivos situacionais para o fim.',
    'Depois da história, concentre o cleanup em missões pendentes, coletáveis por região, proficiência, armas, habilidades, Yokai, Battle Scroll e troféus situacionais. Separar campanha, sistemas e limpeza final deixa a platina mais controlada e reduz retrabalho.'
  ];
  const TLOU_PART_I_EDITORIAL_SUMMARY = [
    'The Last of Us Part I tem uma platina concentrada na campanha principal, em Left Behind e na limpeza de coletáveis e interações opcionais. A lista não exige multiplayer/Factions, online ou coop, e também não depende de troféus perdíveis definitivos, já que o Chapter Select permite voltar para capítulos e corrigir pendências.',
    'A melhor estratégia é jogar a campanha com um checklist de coletáveis aberto desde o início, acompanhando artefatos, pingentes dos Vagalumes, quadrinhos, manuais, cofres, portas abertas com shiv, bancadas, suplementos e peças. Conversas opcionais e piadas da Ellie merecem atenção especial porque são fáceis de deixar passar durante a exploração.',
    'Depois da campanha, use o Chapter Select para fechar capítulos incompletos, completar Left Behind, revisar coletáveis restantes e finalizar troféus situacionais. O guia separa a platina da lista base do Part I de qualquer expectativa de multiplayer antigo, então o foco fica em exploração cuidadosa e cleanup organizado.'
  ];
  const TLOU_PART_II_EDITORIAL_SUMMARY = [
    'The Last of Us Part II tem uma platina concentrada na campanha principal, exploração cuidadosa e cleanup de coletáveis. A lista base não exige online, coop, Factions, Grounded, Permadeath, No Return ou a versão Remastered; o foco está em artefatos, cartas colecionáveis, moedas, entradas de diário, cofres, bancadas, manuais de treinamento, armas e troféus situacionais.',
    'A melhor estratégia é jogar a campanha em uma dificuldade confortável, explorando todos os ambientes e mantendo um checklist de coletáveis aberto desde o início. Não há perdíveis definitivos, porque o Chapter Select permite voltar a capítulos, mas deixar cartas, moedas, cofres, bancadas e interações para o final aumenta bastante o cleanup.',
    'Depois da história, use Chapter Select para limpar capítulos incompletos e faça NG+ parcial para concluir upgrades de armas e personagens que exigem mais suplementos e peças do que uma campanha normalmente oferece. Mantenha Grounded, Permadeath, Remastered e No Return fora da rota da platina base.'
  ];
  const CHECKLIST_DENSITIES = new Set(['comfortable', 'compact']);
  const GUIDE_FILTER_LABELS = {
    all: 'Todos',
    pending: 'Pendentes',
    completed: 'Concluídos',
    missable: 'Perdíveis',
    online: 'Online',
    coop: 'Coop',
    spoiler: 'Spoiler',
    grind: 'Grind',
    cleanup: 'Cleanup',
    collectible: 'Coletáveis',
    story: 'História',
    difficulty: 'Dificuldade',
    Platina: 'Platina',
    Ouro: 'Ouro',
    Prata: 'Prata',
    Bronze: 'Bronze'
  };

  function formatGuideReviewDate(value = '') {
    const text = String(value || '').trim();
    if (!text) return '';
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
  }

  function getGuideEditorialTrustCopy(badge = {}, fallback = '') {
    const status = String(badge.status || badge.badge || badge.tone || '').trim().toLowerCase();
    if (status === 'verified') return 'Guia verificado editorialmente.';
    if (status === 'in_review' || status === 'review') {
      return 'Guia em revisão editorial. Use com atenção aos pontos sinalizados.';
    }
    return fallback || badge.detail || 'Este guia ainda está passando por revisão editorial.';
  }

  function renderEditorialTrustRow(game = {}, viewModel = {}) {
    const badge = viewModel.editorial?.statusBadge || getEditorialBadge(game);
    const reviewedAt = badge.lastReviewedAt || viewModel.editorial?.lastReviewedAt || game.last_reviewed_at || game.lastReviewedAt || '';
    const reviewedLabel = formatGuideReviewDate(reviewedAt);
    const isRequiem = String(game?.slug || '').trim().toLowerCase() === 'resident-evil-requiem';
    const detail = isRequiem && sharedEditorial.getEditorialStatusMessage
      ? sharedEditorial.getEditorialStatusMessage(game, badge)
      : (badge.detail || 'Este guia ainda está passando por revisão editorial.');
    const trustCopy = getGuideEditorialTrustCopy(badge, detail);
    const warningItems = isRequiem ? [] : (Array.isArray(viewModel.editorial?.qualityWarnings) ? viewModel.editorial.qualityWarnings : (badge.qualityWarnings || []));
    return `
      <div class="atlas-editorial-trust">
        <div class="atlas-editorial-trust__row">
          <span class="atlas-editorial-badge atlas-editorial-badge--${escapeAttribute(badge.status || badge.badge || badge.tone || 'in_review')}" title="${escapeAttribute(detail)}"><i class="fas fa-clipboard-check" aria-hidden="true"></i>${escapeHtml(badge.label || 'Em revisão')}</span>
          ${reviewedLabel ? `<span class="atlas-editorial-trust__date">Revisado em ${escapeHtml(reviewedLabel)}</span>` : ''}
        </div>
        <p class="${badge.critical ? 'atlas-editorial-alert' : 'atlas-editorial-trust__copy'}">${escapeHtml(trustCopy)}</p>
        ${warningItems.length ? `<ul class="atlas-editorial-warning-list">${warningItems.slice(0, 3).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      </div>`;
  }

  function normalizeChecklistDensity(value = 'compact') {
    return CHECKLIST_DENSITIES.has(value) ? value : 'compact';
  }

  function getChecklistDensityPreference() {
    try {
      if (typeof localStorage === 'undefined') return 'compact';
      return normalizeChecklistDensity(localStorage.getItem(CHECKLIST_DENSITY_KEY) || 'compact');
    } catch (_error) {
      return 'compact';
    }
  }

  function saveChecklistDensityPreference(density) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CHECKLIST_DENSITY_KEY, normalizeChecklistDensity(density));
      }
    } catch (_error) {}
  }

  function applyChecklistDensity(density = getChecklistDensityPreference()) {
    const nextDensity = normalizeChecklistDensity(density);
    const isCompact = nextDensity === 'compact';
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return nextDensity;
    const body = typeof document !== 'undefined' ? document.body : null;
    if (body) {
      body.dataset.checklistDensity = nextDensity;
      body.classList.toggle('atlas-checklist-density-compact', isCompact);
    }

    [qs('#guideChecklistPanel'), qs('#trophyList')].filter(Boolean).forEach(element => {
      element.dataset.checklistDensity = nextDensity;
      element.classList.toggle('is-compact', isCompact);
    });

    qsa('[data-checklist-density]').forEach(button => {
      const active = button.dataset.checklistDensity === nextDensity;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    return nextDensity;
  }

  function setChecklistDensity(density) {
    const nextDensity = applyChecklistDensity(density);
    saveChecklistDensityPreference(nextDensity);
    return nextDensity;
  }

  function setGuideEmptyState(...args) {
    return window.UI?.setGuideEmptyState?.(...args);
  }

  function getGuideFilterLabel(filter = 'all') {
    return GUIDE_FILTER_LABELS[filter] || filter || 'filtro atual';
  }

  function normalizeGuideSearchValue(value = '') {
    if (typeof getGuideTrophySearchText === 'function') {
      return getGuideTrophySearchText({ name: value }, []);
    }
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function getTrophyCards() {
    return qsa('#trophyList .trophy-card, #trophyList .atlas-trophy-card');
  }

  function cardMatchesGuideFilter(card, filter = 'all') {
    const riskTokens = String(card.dataset.risks || '').split(/\s+/).filter(Boolean);
    const matchesType = TROPHY_TYPE_FILTERS.has(filter) ? card.dataset.type === filter : false;
    const matchesStatus = filter === 'completed' ? card.dataset.status === 'completed' : filter === 'pending' ? card.dataset.status === 'pending' : false;
    const matchesRisk = riskTokens.includes(filter);
    return filter === 'all' || matchesStatus || matchesType || matchesRisk;
  }

  function getGuideFilterEmptyMessage(filter = 'all', query = '') {
    const label = getGuideFilterLabel(filter);
    const hasQuery = Boolean(String(query || '').trim());
    if (hasQuery && filter !== 'all') {
      return {
        title: `Nenhum troféu em ${label} para essa busca.`,
        detail: 'Tente limpar filtros ou buscar por outro termo.'
      };
    }
    if (hasQuery) {
      return {
        title: 'Nenhum resultado para essa busca.',
        detail: 'Tente limpar filtros ou buscar por outro termo.'
      };
    }
    if (filter === 'completed') return { title: 'Nenhum troféu concluído ainda.', detail: 'Marque um troféu para ele aparecer aqui.' };
    if (filter === 'pending') return { title: 'Nenhum troféu pendente neste guia.', detail: 'A checklist pode estar completa.' };
    if (filter === 'online') return { title: 'Nenhum troféu online neste guia.', detail: 'Este filtro só mostra troféus com sinal online claro no conteúdo ou nas tags derivadas.' };
    if (filter === 'coop') return { title: 'Nenhum troféu coop neste guia.', detail: 'Este filtro só mostra troféus com sinal claro de co-op ou 2 jogadores obrigatórios.' };
    if (filter === 'missable') return { title: 'Nenhum troféu perdível encontrado.', detail: 'O cadastro atual não aponta perdíveis para este filtro.' };
    return { title: `Nenhum troféu marcado como ${label}.`, detail: 'Tente limpar filtros ou buscar por outro termo.' };
  }

  function updateGuideFilterButtons(query = '') {
    const normalizedQuery = normalizeGuideSearchValue(query).trim();
    const cards = getTrophyCards();
    qsa('.filter-btn').forEach(button => {
      const filter = button.dataset.filter || 'all';
      const visibleMatchCount = cards.filter(card => {
        const matchesSearch = !normalizedQuery || (card.dataset.search || '').includes(normalizedQuery);
        return cardMatchesGuideFilter(card, filter) && matchesSearch;
      }).length;
      button.dataset.count = String(visibleMatchCount);
      button.setAttribute('aria-label', `${getGuideFilterLabel(filter)}: ${visibleMatchCount} troféu(s)`);
    });
  }

  function applyTrophyFilter(filter, query = '') {
    const normalizedQuery = normalizeGuideSearchValue(query).trim();
    let activeFilter = filter || 'all';
    let visibleCount = 0;
    const cards = getTrophyCards();
    if (!cards.length) {
      const results = qs('#guideResults');
      if (results) results.textContent = 'Checklist ainda não disponível para este guia.';
      setGuideEmptyState(true, {
        title: 'Checklist ainda não disponível para este guia.',
        detail: 'Este guia ainda não possui troféus cadastrados.',
        action: false
      });
      return { activeFilter: 'all', visibleCount: 0 };
    }
    updateGuideFilterButtons(normalizedQuery);
    const activeButton = qsa('.filter-btn').find(button => button.dataset.filter === activeFilter);
    if (activeButton?.hidden) activeFilter = 'all';
    cards.forEach(card => {
      const passesFilter = cardMatchesGuideFilter(card, activeFilter);
      const matchesSearch = !normalizedQuery || (card.dataset.search || '').includes(normalizedQuery);
      const visible = passesFilter && matchesSearch;
      card.classList.toggle('hidden', !visible);
      if (visible) visibleCount += 1;
    });
    qsa('.filter-btn').forEach(button => {
      const active = button.dataset.filter === activeFilter;
      button.classList.toggle('atlas-pill-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const results = qs('#guideResults');
    const resultLabel = activeFilter === 'all' ? '' : ` em ${getGuideFilterLabel(activeFilter)}`;
    if (results) results.textContent = `${visibleCount} de ${cards.length} troféu(s)${resultLabel}`;
    setGuideEmptyState(visibleCount === 0, getGuideFilterEmptyMessage(activeFilter, query));
    return { activeFilter, visibleCount };
  }

  function clearTrophySearch() {
    const field = qs('#trophySearch');
    if (field) field.value = '';
  }

  function bindGuideSearch(onInput) {
    const field = qs('#trophySearch');
    if (!field) return;
    field.addEventListener('input', onInput);
  }

  function getTrophySearchValue() {
    return qs('#trophySearch')?.value || '';
  }

  function clearGuideChecklistFilters() {
    clearTrophySearch();
    return applyTrophyFilter('all', '');
  }

  function getGuideRoadmapCount(game = {}, viewModel = {}) {
    if (typeof sharedEditorial.getGuideRoadmapCount === 'function') {
      return sharedEditorial.getGuideRoadmapCount(game, viewModel);
    }
    return Number(game?.roadmap_count || viewModel?.roadmap?.length || viewModel?.roadmapStages?.length || 0);
  }

  function buildTrophyDetailsId(trophy = {}, index = 0) {
    const base = String(trophy?.id || trophy?.name || `trophy-${index}`)
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `trophy-${index}`;
    return `trophy-details-${base}-${index}`;
  }

  function hasLongTrophyDescription(description = '') {
    const text = String(description || '').trim();
    return text.length > 130 || text.includes('\n');
  }

  function shouldShowTrophyDetailsToggle(trophy = {}, description = '', tip = '') {
    return Boolean(trophy?.criticalGuide || String(tip || '').trim() || hasLongTrophyDescription(description));
  }

  function getEldenRingCriticalGuide(trophy = {}, game = {}) {
    if (String(game?.slug || '').trim().toLowerCase() !== 'elden-ring') return null;
    const guides = {
      er_elden_lord: {
        trophyType: 'Final do jogo',
        when: 'Prepare antes da escolha final, depois de derrotar o chefe final e antes de iniciar NG+.',
        how: 'Escolha uma rota de Elden Lord na Fractured Marika. Se quiser economizar runs, faça backup do save antes da decisão final.',
        risk: 'Os finais com troféu são mutuamente exclusivos no mesmo save sem backup; escolher outro final bloqueia este troféu nesta conclusão.',
        quickTip: 'Deixe este como final padrão se não quiser seguir uma questline longa.',
        links: [{ label: 'Ver vídeo-guia', url: 'https://www.youtube.com/results?search_query=Elden+Ring+Elden+Lord+ending+trophy' }]
      },
      er_age_of_stars: {
        trophyType: 'Final do jogo',
        when: 'Avance a quest da Ranni antes da decisão final e confirme se o sinal azul dela aparece após o chefe final.',
        how: "Complete a linha de Ranni, incluindo Nokron, o item de Renna's Rise, Lake of Rot e Cathedral of Manus Celes; no fim, escolha o sinal de Ranni.",
        risk: 'Se a quest não estiver completa, o sinal do final não aparece. Sem backup, escolher outro final exige nova run ou NG+.',
        quickTip: 'Antes de tocar em qualquer opção final, procure o sinal azul no chão e confirme se este final ainda falta.',
        links: [{ label: 'Ver vídeo-guia', url: 'https://www.youtube.com/results?search_query=Elden+Ring+Age+of+the+Stars+Ranni+trophy' }]
      },
      er_frenzied_flame: {
        trophyType: 'Final do jogo',
        when: 'Deixe para preparar perto do fim, quando já souber se vai usar backup ou uma run separada.',
        how: 'Acesse a área subterrânea de Leyndell, passe pela porta dos Three Fingers sem armadura e aceite a Frenzied Flame antes da escolha final.',
        risk: "Ao aceitar a Frenzied Flame, os outros finais ficam bloqueados neste save até usar Miquella's Needle, que exige uma rota opcional avançada.",
        quickTip: 'Faça backup antes de abrir a porta dos Three Fingers se pretende combinar finais no mesmo save.',
        links: [{ label: 'Ver vídeo-guia', url: 'https://www.youtube.com/results?search_query=Elden+Ring+Lord+of+Frenzied+Flame+trophy' }]
      },
      er_legendary_armaments: {
        trophyType: 'Coletável lendário',
        when: 'Revise antes de avançar para a transformação de Leyndell em Ashen Capital.',
        how: 'Colete os 9 armamentos lendários da lista base. Dê prioridade ao Bolt of Gransax em Leyndell enquanto a capital ainda está normal.',
        risk: 'Bolt of Gransax pode ficar indisponível após Leyndell virar Ashen Capital; se perder, será necessário pegar em NG+ ou outra run.',
        quickTip: 'Marque Bolt of Gransax assim que chegar a Leyndell; ele é o ponto mais sensível deste troféu.',
        links: [
          { label: 'Ver localização', url: 'https://www.youtube.com/results?search_query=Elden+Ring+Bolt+of+Gransax+location' },
          { label: 'Ver vídeo-guia', url: 'https://www.youtube.com/results?search_query=Elden+Ring+Legendary+Armaments+trophy' }
        ]
      },
      er_legendary_ashes: {
        trophyType: 'Coletável lendário',
        when: 'Pode ser feito no cleanup, mas algumas cinzas exigem áreas opcionais avançadas e chefes específicos.',
        how: 'Use uma checklist para Lhutel, Mimic Tear, Cleanrot Knight Finlay, Redmane Knight Ogha, Ancient Dragon Knight Kristoff e Black Knife Tiche.',
        risk: 'Não é o principal perdível da lista, mas deixar para o fim sem controle por região aumenta muito o retrabalho.',
        quickTip: 'Separe por região e faça Black Knife Tiche quando sua build já estiver forte.',
        links: [{ label: 'Ver vídeo-guia', url: 'https://www.youtube.com/results?search_query=Elden+Ring+Legendary+Ashen+Remains+trophy' }]
      },
      er_legendary_sorceries: {
        trophyType: 'Coletável lendário',
        when: 'Faça durante exploração avançada e finalize no cleanup antes de encerrar a platina.',
        how: 'Colete todos os feitiços e encantamentos lendários, conferindo requisitos de áreas opcionais, torres, chefes e progressão de NPCs quando necessário.',
        risk: 'O risco principal é perder rastreio e deixar uma magia isolada para trás; não depende de dificuldade, mas pede controle por lista.',
        quickTip: 'Depois de abrir áreas de fim de jogo, confira a lista completa de lendários antes de partir para o final.',
        links: [{ label: 'Ver vídeo-guia', url: 'https://www.youtube.com/results?search_query=Elden+Ring+Legendary+Sorceries+and+Incantations+trophy' }]
      },
      er_legendary_talismans: {
        trophyType: 'Coletável lendário',
        when: 'Deixe a revisão final para depois de liberar áreas avançadas como Haligtree, Farum Azula e Ashen Capital.',
        how: 'Colete os talismãs lendários por região e confirme os que dependem de áreas tardias antes de considerar a lista completa.',
        risk: 'Não costuma bloquear a run, mas pode virar caça longa se você não souber quais regiões já limpou.',
        quickTip: 'Use o checklist por nome do talismã e feche este troféu junto do cleanup final.',
        links: [{ label: 'Ver vídeo-guia', url: 'https://www.youtube.com/results?search_query=Elden+Ring+Legendary+Talismans+trophy' }]
      },
      er_fortissax: {
        trophyType: 'Chefe opcional / questline',
        when: 'Resolva antes de encerrar a run, acompanhando a quest da Fia até Deeproot Depths.',
        how: 'Avance a linha da Fia, chegue a Deeproot Depths, entregue o item necessário da quest e interaja com Fia para acessar a luta contra Fortissax.',
        risk: 'Pode ser perdido ou exigir retrabalho se você tratar a quest da Fia de forma hostil ou avançar sem acompanhar os passos dela.',
        quickTip: 'Não ataque Fia e não ignore Deeproot Depths se este troféu ainda estiver pendente.',
        links: [{ label: 'Ver vídeo-guia', url: 'https://www.youtube.com/results?search_query=Elden+Ring+Lichdragon+Fortissax+Fia+quest+trophy' }]
      }
    };
    return guides[trophy?.id] || null;
  }

  function renderTrophyCriticalGuide(trophy = {}, game = {}) {
    const guide = trophy?.criticalGuide || getEldenRingCriticalGuide(trophy, game);
    if (!guide || typeof guide !== 'object') return '';
    const items = [
      ['Tipo do troféu', guide.trophyType || trophy.type],
      ['Quando fazer', guide.when],
      ['Como obter', guide.how],
      ['Risco de perder ou bloquear', guide.risk],
      ['Dica rápida', guide.quickTip || guide.tip]
    ].filter(([, value]) => String(value || '').trim());
    const links = Array.isArray(guide.links)
      ? guide.links.filter(link => link?.url && link?.label).slice(0, 3)
      : [];
    if (!items.length && !links.length) return '';
    return `
      <div class="atlas-trophy-critical-guide">
        <div class="atlas-tip-label">Guia crítico</div>
        <dl>
          ${items.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
        </dl>
        ${links.length ? `<div class="atlas-trophy-critical-guide__links">${links.map(link => `<a href="${escapeAttribute(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join('')}</div>` : ''}
      </div>
    `;
  }

  function cleanTrophyNameCandidate(value = '') {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!text || /^(undefined|null|\[object Object\])$/i.test(text)) return '';
    return text;
  }

  function getTrophyOriginalName(trophy = {}) {
    return cleanTrophyNameCandidate(trophy?.trophyNameOriginal || trophy?.originalName || trophy?.officialName || trophy?.name) || 'Troféu';
  }

  function getTrophyEditorialName(trophy = {}) {
    const officialName = getTrophyOriginalName(trophy);
    const candidates = [
      trophy?.trophyNamePtBr,
      trophy?.localizedNamePt,
      trophy?.localizedNamePtBr,
      trophy?.name_pt,
      trophy?.namePt,
      trophy?.ptName,
      trophy?.translatedName
    ].map(cleanTrophyNameCandidate).filter(Boolean);
    const editorialName = candidates[0] || '';
    if (!editorialName) return '';
    return editorialName.includes(' / ') ? editorialName.split(' / ').map(cleanTrophyNameCandidate).find(Boolean) || '' : editorialName;
  }

  function getTrophyDisplayName(trophy = {}) {
    return getTrophyEditorialName(trophy) || getTrophyOriginalName(trophy);
  }

  function shouldUseOfficialTrophyNameFirst(game = {}) {
    return true;
  }

  function looksLikeEnglishTrophyDescription(value = '') {
    return /\b(Obtained|Reached|Achieved|Defeated|Acquired|Upgraded|Arrived|Restored|Used|Clear|Earn|Complete|Unlock|Max-rank|Equip|Choose|Purge|Forge|Trade|Pay|Fulfill|Catch|Compel|Have|Buy|Get|Beat|Slay|Pet)\b/i.test(String(value || ''));
  }

  function looksLikePortugueseTrophyDescription(value = '') {
    const text = String(value || '').trim();
    return /[áàâãéêíóôõúç]/i.test(text)
      || /\b(os|as|um|uma|todos|todas|com|em|de|do|da|dos|das|ao|aos|seu|sua|trofeus|troféus|conquistas|inimigos|areas|áreas|santuarios|santuários|farois|faróis|colete|obtenha|liberte|derrote|mate|conclua|aprenda|equipe|descubra|compre|personalize|reacenda|honre|enfrente|destrua|compareça|devolva|busque|faça|repare|lembre|melhore|complete|recupere)\b/i.test(text);
  }

  function cleanTrophyDescriptionCandidate(value) {
    if (value && typeof value === 'object') return '';
    const text = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (!text) return '';
    if (/^(undefined|null|\[object Object\])$/i.test(text)) return '';
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/^descricao em revisao editorial\.\s*[.;]*\s*(?:undefined|null)?$/.test(normalized)) return '';
    return text.replace(/\s+([.;,!?])/g, '$1');
  }

  function getTrophyDisplayDescription(trophy = {}, game = {}) {
    const localizedDescription = [
      trophy.descriptionPtBr,
      trophy.ptDescription,
      trophy.localizedDescription?.ptBr,
      trophy.localizedDescription?.['pt-BR']
    ].map(cleanTrophyDescriptionCandidate).find(Boolean) || '';
    if (localizedDescription) return localizedDescription;

    const description = cleanTrophyDescriptionCandidate(trophy.description);
    if (description && looksLikePortugueseTrophyDescription(description) && !looksLikeEnglishTrophyDescription(description)) return description;
    if (description && looksLikePortugueseTrophyDescription(description)) return description;
    const tip = cleanTrophyDescriptionCandidate(trophy.tip || trophy.guideTip || '');
    if (tip && looksLikePortugueseTrophyDescription(tip)) return tip;
    return 'Objetivo registrado no checklist da platina; acompanhe este troféu pelo roadmap e pelos pontos de atenção do guia.';
  }

  function buildGuideHeroStats(game = {}, viewModel = {}) {
    const quickDecision = typeof buildGuideQuickDecisionModel === 'function' ? buildGuideQuickDecisionModel(game, viewModel) : null;
    if (quickDecision?.cards?.length) {
      const labels = {
        time: 'Tempo',
        difficulty: 'Dificuldade',
        missables: 'Perdíveis',
        online: 'Online',
        coop: 'Coop',
        dlc: 'DLC',
        editorial: 'Status'
      };
      return ['time', 'difficulty', 'missables', 'online', 'coop', 'dlc', 'editorial']
        .map(id => quickDecision.cards.find(card => card?.id === id))
        .filter(Boolean)
        .map(card => ({
          ...card,
          label: labels[card.id] || card.label,
          value: card.id === 'dlc' && String(game?.slug || '').trim().toLowerCase() === 'god-of-war-ragnarok'
            ? 'Valhalla fora da platina base'
            : card.id === 'dlc' && String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-ii'
            ? 'Extras fora da platina base'
            : card.id === 'dlc' && ['resident-evil-requiem', 'resident-evil-4-remake', 'resident-evil-6', 'hades', 'ghost-of-tsushima', 'god-of-war', 'god-of-war-2018', 'hades-ii', 'astro-bot', 'pragmata', 'saros', 'nioh-2', 'nioh-3'].includes(String(game?.slug || '').trim().toLowerCase())
            ? 'DLC fora da platina base'
            : card.id === 'coop' && /2 jogadores/i.test(String(card.detail || ''))
            ? '2 jogadores obrigatórios'
            : card.id === 'dlc' && /iceborne/i.test(`${card.value || ''} ${card.detail || ''}`)
              ? 'Base game sem Iceborne'
              : card.id === 'dlc' && /shadow of the erdtree|fora da platina base|out_of_base_scope/i.test(`${card.value || ''} ${card.detail || ''} ${game?.dlc_status || ''}`)
                ? 'DLC fora da platina base'
                : card.id === 'dlc' && /sem dlcs?|base game|não necessária|nao necessaria/i.test(`${card.value || ''} ${card.detail || ''}`)
                ? 'Base game sem DLCs'
                : card.value
        }));
    }
    if (typeof buildGuideSummaryCards === 'function') {
      const cards = buildGuideSummaryCards(game, viewModel);
      const compactLabels = new Set(['Tempo estimado', 'Tempo', 'Dificuldade', 'Perdíveis', 'Online', 'Coop', 'DLC']);
      const compactCards = cards.filter(item => compactLabels.has(item.label));
      const statusCard = cards.find(item => ['Status', 'Status editorial'].includes(item.label));
      if (compactCards.length) {
        const heroCards = compactCards.slice(0, 6);
        if (statusCard && !heroCards.some(item => ['Status', 'Status editorial'].includes(item.label))) {
          heroCards.push({ ...statusCard, label: 'Status' });
        }
        return heroCards.slice(0, 7);
      }
      const essentials = new Set(['Tempo estimado', 'Tempo', 'Dificuldade', 'Perdíveis', 'Online', 'Coop', 'DLC']);
      const fallbackCards = buildGuideSummaryCards(game, viewModel).filter(item => essentials.has(item.label)).slice(0, 6);
      if (statusCard && !fallbackCards.some(item => ['Status', 'Status editorial'].includes(item.label))) {
        fallbackCards.push({ ...statusCard, label: 'Status' });
      }
      return fallbackCards.slice(0, 7);
    }
    if (typeof sharedEditorial.buildGuideHeroStats === 'function') {
      return sharedEditorial.buildGuideHeroStats(game, viewModel);
    }
    return [
      { icon: 'fa-gauge-high', label: 'Dificuldade', value: `${String(game?.difficulty || '-')}/10`, tone: getDifficultyToneClass(game?.difficulty) },
      { icon: 'fa-clock', label: 'Tempo', value: game?.time || 'Tempo não informado', tone: 'atlas-meta-signal--time' },
      { icon: 'fa-trophy', label: 'Troféus', value: `${String(viewModel.total || 0)} troféu(s)`, tone: 'atlas-meta-signal--trophy' },
      { icon: 'fa-route', label: 'Roadmap', value: `${String(getGuideRoadmapCount(game, viewModel))} etapa(s)`, tone: 'atlas-meta-signal--partial' }
    ];
  }

  function getGuideHeroRouteTextFromContent(game = {}, viewModel = {}) {
    const editorialParagraphs = Array.isArray(game?.editorial_summary) ? game.editorial_summary : [];
    const candidates = [
      game?.first_run_advice,
      game?.firstRunAdvice,
      game?.quickDecision?.firstAction,
      viewModel?.firstRunAdvice,
      ...editorialParagraphs
    ]
      .map(value => String(value || '').trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    const routePattern = /melhor rota|melhor estrat|rota mais eficiente|primeir|comece|começar|campanha|roadmap|checklist|cleanup|perd/i;
    const sentence = candidates
      .flatMap(text => text.split(/(?<=[.!?])\s+/).map(item => item.trim()).filter(Boolean))
      .find(item => routePattern.test(item));
    return compactGuideHeaderText(sentence || candidates[0], '', 150);
  }

  function buildGuideHeroRouteModel(game = {}, viewModel = {}) {
    const quickDecision = typeof buildGuideQuickDecisionModel === 'function' ? buildGuideQuickDecisionModel(game, viewModel) : null;
    const firstAction = quickDecision?.firstAction || {};
    const nextAction = viewModel.nextActionModel || {};
    const routeText = getGuideHeroRouteTextFromContent(game, viewModel);
    const title = compactGuideHeaderText(firstAction.title || nextAction.title, 'Abra o roadmap antes da checklist', 86)
      || 'Abra o roadmap antes da checklist';
    const detail = compactGuideHeaderText(
      routeText || firstAction.detail || nextAction.detail,
      'Use o roadmap para entender a ordem da platina antes de marcar troféus soltos.',
      150
    ) || 'Use o roadmap para entender a ordem da platina antes de marcar troféus soltos.';
    return {
      title,
      detail,
      focus: firstAction.focus || nextAction.focus || 'roadmap',
      icon: firstAction.icon || nextAction.icon || 'fa-route'
    };
  }

  function buildGuideHeroPrimaryAction(viewModel = {}) {
    const isSaved = Boolean(viewModel.isSaved);
    const hasChecklistProgress = Number(viewModel.completed || 0) > 0;
    const nextAction = viewModel.nextActionModel || {};
    if (!isSaved) {
      return { label: 'Salvar na biblioteca', icon: 'fa-bookmark', save: true };
    }
    return hasChecklistProgress
      ? { label: 'Continuar de onde parei', icon: 'fa-play', action: 'first-pending' }
      : { label: 'Continuar guia', icon: 'fa-play', action: nextAction.focus || 'roadmap' };
  }

  function renderGuideHeroPrimaryAction(action = {}) {
    if (action.save) {
      return `<button type="button" class="atlas-btn atlas-btn-primary" data-toggle-save-game="true"><i class="fas ${escapeAttribute(action.icon || 'fa-bookmark')}" aria-hidden="true"></i>${escapeHtml(action.label || 'Salvar na biblioteca')}</button>`;
    }
    return `<button type="button" class="atlas-btn atlas-btn-primary" data-guide-action="${escapeAttribute(action.action || 'roadmap')}"><i class="fas ${escapeAttribute(action.icon || 'fa-play')}" aria-hidden="true"></i>${escapeHtml(action.label || 'Continuar guia')}</button>`;
  }

  function renderGuideQuickActions(primaryAction = {}) {
    return `
      <div class="atlas-guide-hero__actions" aria-label="Ações rápidas do guia">
        ${renderGuideHeroPrimaryAction(primaryAction)}
        <button type="button" class="atlas-btn atlas-btn-secondary" data-guide-action="roadmap"><i class="fas fa-route" aria-hidden="true"></i> Ver roadmap</button>
        <button type="button" class="atlas-btn atlas-btn-secondary" data-guide-action="trophies"><i class="fas fa-list-check" aria-hidden="true"></i> Abrir checklist</button>
        <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-soft-danger" data-guide-action="feedback"><i class="fas fa-flag" aria-hidden="true"></i> Reportar problema</button>
      </div>`;
  }

  function renderGuideRoadmapTimeline(roadmapStages = []) {
    if (!roadmapStages.length) return '<div class="atlas-inline-empty">Sem roadmap cadastrado.</div>';
    return `
      <ol class="atlas-roadmap-timeline">
        ${roadmapStages.map(stage => {
          const category = stage.category || { id: 'plan', label: 'Plano', icon: 'fa-route' };
          const actions = Array.isArray(stage.actions) && stage.actions.length
            ? stage.actions.slice(0, 5)
            : splitGuideRoadmapActions(stage.description || stage.objective).slice(0, 3);
          const focusLabel = stage.focus || (!stage.isStructured ? category.label : '');
          const primaryText = stage.objective || stage.description;
          const showObjectiveMeta = !stage.isStructured && stage.objective && String(stage.objective).trim() !== String(primaryText || '').trim();
          const metaItems = stage.isStructured
            ? [
                stage.warning ? `<span class="atlas-roadmap-step__meta-item atlas-roadmap-step__meta-item--warning"><strong>Alerta</strong>${escapeHtml(stage.warning)}</span>` : '',
                stage.note ? `<span class="atlas-roadmap-step__meta-item"><strong>Observação</strong>${escapeHtml(stage.note)}</span>` : '',
                stage.result ? `<span class="atlas-roadmap-step__meta-item atlas-roadmap-step__meta-item--result"><strong>Resultado</strong>${escapeHtml(stage.result)}</span>` : ''
              ].filter(Boolean)
            : [
                showObjectiveMeta ? `<span class="atlas-roadmap-step__meta-item atlas-roadmap-step__meta-item--objective"><strong>Objetivo</strong>${escapeHtml(stage.objective)}</span>` : '',
                stage.risk ? `<span class="atlas-roadmap-step__meta-item atlas-roadmap-step__meta-item--warning"><strong>Risco</strong>${escapeHtml(stage.risk)}</span>` : '',
                stage.relatedTrophies?.length ? `<span class="atlas-roadmap-step__meta-item"><strong>TrofÃ©us relacionados</strong>${stage.relatedTrophies.map(escapeHtml).join(' / ')}</span>` : ''
              ].filter(Boolean);
          const hasWarning = Boolean(stage.warning || stage.risk);
          const hasResult = Boolean(stage.result);
          return `
          <li class="atlas-roadmap-step atlas-roadmap-step--${escapeAttribute(category.id || 'plan')}${Number(stage.number) === 1 ? ' atlas-roadmap-step--first' : ''}${hasWarning ? ' atlas-roadmap-step--has-warning' : ''}${hasResult ? ' atlas-roadmap-step--has-result' : ''}">
            <div class="atlas-roadmap-step__marker" aria-hidden="true" data-roadmap-number="${escapeAttribute(String(stage.number))}"></div>
            <article class="atlas-roadmap-step__body">
              <div class="atlas-roadmap-step__head">
                <div>
                  <h3>${escapeHtml(stage.title)}</h3>
                </div>
                ${focusLabel ? `<span class="atlas-roadmap-step__category atlas-roadmap-step__category--${escapeAttribute(category.id || 'plan')}"><i class="fas ${escapeAttribute(category.icon || 'fa-route')}" aria-hidden="true"></i>${escapeHtml(focusLabel)}</span>` : ''}
              </div>
              <p class="atlas-roadmap-step__objective"><span>Objetivo</span>${escapeHtml(primaryText)}</p>
              ${actions.length ? `<ul class="atlas-roadmap-step__actions">${actions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}</ul>` : ''}
              ${stage.isStructured && metaItems.length ? `<div class="atlas-roadmap-step__meta">${metaItems.join('')}</div>` : ''}
              ${!stage.isStructured && metaItems.length ? `<div class="atlas-roadmap-step__meta">${metaItems.join('')}</div>` : ''}
            </article>
          </li>
        `;
        }).join('')}
      </ol>`;
  }

  function renderWalkthroughList(items = []) {
    if (!Array.isArray(items) || !items.length) return '';
    return `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function isSafeWalkthroughVideoUrl(value = '') {
    return /^https?:\/\//i.test(String(value || '').trim());
  }

  function renderWalkthroughInstructionSteps(steps = []) {
    if (!Array.isArray(steps) || !steps.length) return '';
    return `
      <ol class="atlas-walkthrough-substeps">
        ${steps.map((step, index) => {
          const meta = [
            Array.isArray(step.importantItems) && step.importantItems.length
              ? `<div><strong>Itens</strong>${renderWalkthroughList(step.importantItems)}</div>`
              : '',
            Array.isArray(step.relatedTrophies) && step.relatedTrophies.length
              ? `<div><strong>Troféus</strong>${renderWalkthroughList(step.relatedTrophies)}</div>`
              : ''
          ].filter(Boolean).join('');
          return `
          <li class="atlas-walkthrough-substep">
            <span class="atlas-walkthrough-substep__number">${escapeHtml(String(index + 1))}</span>
            <div class="atlas-walkthrough-substep__body">
              ${step.title ? `<h5>${escapeHtml(step.title)}</h5>` : ''}
              ${step.text ? `<p>${escapeHtml(step.text)}</p>` : ''}
              ${step.warning ? `<div class="atlas-walkthrough-substep__warning"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i><span>${escapeHtml(step.warning)}</span></div>` : ''}
              ${meta ? `<div class="atlas-walkthrough-substep__meta">${meta}</div>` : ''}
            </div>
          </li>`;
        }).join('')}
      </ol>`;
  }

  function renderWalkthroughEntityGrid(items = [], label = '') {
    if (!Array.isArray(items) || !items.length) return '';
    return `
      <div class="atlas-walkthrough-entity-group">
        <strong>${escapeHtml(label)}</strong>
        <div class="atlas-walkthrough-entity-grid">
          ${items.map(item => `
            <div class="atlas-walkthrough-entity">
              <div>
                <h5>${escapeHtml(item.name || item.title || 'Item')}</h5>
                ${item.type ? `<span>${escapeHtml(item.type)}</span>` : ''}
                ${item.missable ? `<span class="atlas-walkthrough-entity__risk">Perdível</span>` : ''}
              </div>
              ${item.trophy ? `<p><b>Troféu:</b> ${escapeHtml(item.trophy)}</p>` : ''}
              ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  function renderWalkthroughSummary(items = []) {
    if (!Array.isArray(items) || !items.length) return '';
    return `
      <div class="atlas-walkthrough-list atlas-walkthrough-list--summary">
        <strong>Nesta parte você vai</strong>
        ${renderWalkthroughList(items)}
      </div>`;
  }

  function renderWalkthroughRecommendedImages(items = []) {
    if (!Array.isArray(items) || !items.length) return '';
    return `
      <div class="atlas-walkthrough-entity-group atlas-walkthrough-entity-group--images">
        <strong>Imagens recomendadas</strong>
        <div class="atlas-walkthrough-entity-grid">
          ${items.map(item => `
            <div class="atlas-walkthrough-entity">
              <div><h5>${escapeHtml(item.description || 'Print recomendado')}</h5></div>
              ${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  function renderWalkthroughTrophyCoverage(items = []) {
    if (!Array.isArray(items) || !items.length) return '';
    return `
      <div class="atlas-walkthrough-coverage">
        <strong>Cobertura dos troféus</strong>
        <div class="atlas-walkthrough-coverage__grid">
          ${items.map(item => `
            <div class="atlas-walkthrough-coverage__item">
              <span>${escapeHtml(item.trophy || 'Troféu')}</span>
              ${item.trophyPt ? `<p>${escapeHtml(item.trophyPt)}</p>` : ''}
              ${item.chapter ? `<small>${escapeHtml(item.chapter)}</small>` : ''}
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  function renderWalkthroughImages(images = []) {
    if (!Array.isArray(images) || !images.length) return '';
    return `
      <div class="atlas-walkthrough-images">
        ${images.map(image => {
          const meta = [
            image.type ? `<span>${escapeHtml(image.type)}</span>` : '',
            image.relatedItem ? `<span>${escapeHtml(image.relatedItem)}</span>` : '',
            image.relatedTrophy ? `<span>${escapeHtml(image.relatedTrophy)}</span>` : ''
          ].filter(Boolean).join('');
          return `
          <figure class="atlas-walkthrough-image">
            <img src="${escapeAttribute(image.src)}" alt="${escapeAttribute(image.alt)}" loading="lazy" decoding="async">
            ${(image.caption || meta) ? `<figcaption>${image.caption ? `<p>${escapeHtml(image.caption)}</p>` : ''}${meta ? `<div>${meta}</div>` : ''}</figcaption>` : ''}
          </figure>`;
        }).join('')}
      </div>`;
  }

  function renderGuideWalkthrough(viewModel = {}) {
    if (featureFlags.isWalkthroughEnabled?.() !== true) return '';
    const stages = Array.isArray(viewModel.walkthroughStages) ? viewModel.walkthroughStages : [];
    if (!stages.length) return '';
    const navItems = stages
      .map((stage, index) => ({
        id: String(stage.id || `walkthrough-${index + 1}`),
        label: stage.navigationLabel || stage.titulo_etapa || `Etapa ${index + 1}`
      }))
      .filter(item => item.id && item.label);
    return `
      <section id="guideWalkthroughPanel" class="atlas-walkthrough-panel" aria-labelledby="guideWalkthroughTitle">
        <div class="atlas-walkthrough-panel__head">
          <div>
            <div class="atlas-eyebrow">Detonado passo a passo</div>
            <h3 id="guideWalkthroughTitle">Detonado passo a passo</h3>
            <p>Use estas etapas como rota operacional quando o guia tiver um detonado editorial cadastrado.</p>
          </div>
          <span class="atlas-tag atlas-tag--soft">${escapeHtml(String(stages.length))} etapa(s)</span>
        </div>
        ${navItems.length > 1 ? `<nav class="atlas-walkthrough-nav" aria-label="Capítulos do detonado">${navItems.map(item => `<a href="#${escapeAttribute(item.id)}">${escapeHtml(item.label)}</a>`).join('')}</nav>` : ''}
        <div class="atlas-walkthrough-steps">
          ${stages.map((stage, index) => {
            const checklist = Array.isArray(stage.checklist) ? stage.checklist : [];
            const alerts = Array.isArray(stage.alertas_perdiveis) ? stage.alertas_perdiveis : [];
            const images = Array.isArray(stage.images) ? stage.images : [];
            const actionLists = [
              stage.acoes_obrigatorias?.length ? `<div class="atlas-walkthrough-list"><strong>Ações obrigatórias</strong>${renderWalkthroughList(stage.acoes_obrigatorias)}</div>` : '',
              stage.trofeus_relacionados?.length ? `<div class="atlas-walkthrough-list"><strong>Troféus relacionados</strong>${renderWalkthroughList(stage.trofeus_relacionados)}</div>` : '',
              stage.itens_coletaveis?.length ? `<div class="atlas-walkthrough-list"><strong>Itens importantes</strong>${renderWalkthroughList(stage.itens_coletaveis)}</div>` : ''
            ].filter(Boolean).join('');
            const metaItems = [
              stage.area_local ? `<div><dt>Área/local</dt><dd>${escapeHtml(stage.area_local)}</dd></div>` : '',
              stage.quando_fazer ? `<div><dt>Quando fazer</dt><dd>${escapeHtml(stage.quando_fazer)}</dd></div>` : '',
              stage.recommendedLevel ? `<div><dt>Nível sugerido</dt><dd>${escapeHtml(stage.recommendedLevel)}</dd></div>` : '',
              isSafeWalkthroughVideoUrl(stage.videoUrl) ? `<div><dt>Vídeo</dt><dd><a href="${escapeAttribute(stage.videoUrl)}" target="_blank" rel="noopener noreferrer">Abrir vídeo de apoio</a></dd></div>` : ''
            ].filter(Boolean).join('');
            const stageId = String(stage.id || `walkthrough-${index + 1}`);
            return `
            <article id="${escapeAttribute(stageId)}" class="atlas-walkthrough-step">
              <div class="atlas-walkthrough-step__number" aria-hidden="true">${escapeHtml(String(index + 1))}</div>
              <div class="atlas-walkthrough-step__body">
                <div class="atlas-walkthrough-step__head">
                  <div>
                    <h4>${escapeHtml(stage.titulo_etapa)}</h4>
                    ${stage.objetivo_principal ? `<p>${escapeHtml(stage.objetivo_principal)}</p>` : ''}
                  </div>
                </div>
                ${stage.intro ? `<p class="atlas-walkthrough-intro">${escapeHtml(stage.intro)}</p>` : ''}
                ${renderWalkthroughSummary(stage.summary)}
                ${metaItems ? `<dl class="atlas-walkthrough-meta">${metaItems}</dl>` : ''}
                ${alerts.length ? `<div class="atlas-walkthrough-alerts" role="note" aria-label="Alertas perdíveis">${alerts.map(alert => `<p><i class="fas fa-triangle-exclamation" aria-hidden="true"></i><span>${escapeHtml(alert)}</span></p>`).join('')}</div>` : ''}
                ${actionLists ? `<div class="atlas-walkthrough-grid">${actionLists}</div>` : ''}
                ${renderWalkthroughInstructionSteps(stage.steps)}
                ${renderWalkthroughEntityGrid(stage.bosses, 'Chefes')}
                ${renderWalkthroughEntityGrid(stage.collectibles, 'Itens e coletáveis')}
                ${renderWalkthroughTrophyCoverage(stage.trophyCoverage)}
                ${renderWalkthroughRecommendedImages(stage.recommendedImages)}
                ${renderWalkthroughImages(images)}
                ${checklist.length ? `<div class="atlas-walkthrough-checklist" aria-label="Checklist da etapa">${checklist.map(item => `
                  <label class="atlas-walkthrough-checklist__item${item.status ? ' is-checked' : ''}">
                    <input type="checkbox" data-walkthrough-check="${escapeAttribute(String(item.id))}" ${item.status ? 'checked' : ''}>
                    <span>${escapeHtml(item.texto)}</span>
                  </label>
                `).join('')}</div>` : ''}
              </div>
            </article>`;
          }).join('')}
        </div>
      </section>`;
  }

  function splitGuideRoadmapActions(value = '') {
    return String(value || '')
      .split(/(?:[.;]\s+|\n+|,\s+(?=e |depois|entao|então|antes|sem |com |use |faça |faca ))/i)
      .map(item => item.trim().replace(/^[-•]\s*/, ''))
      .filter(item => item.length > 18)
      .map(item => item.length > 120 ? `${item.slice(0, 117).trim()}...` : item);
  }

  function renderGuideInternalNav() {
    const items = [
      { action: 'header', href: '#guideHeader', icon: 'fa-compass', label: 'Resumo' },
      { action: 'roadmap', href: '#guideRoadmapPanel', icon: 'fa-route', label: 'Roadmap' },
      { action: 'trophies', href: '#guideChecklistPanel', icon: 'fa-list-check', label: 'Checklist' },
      { action: 'risks', href: '#guideRiskSummaryPanel', icon: 'fa-triangle-exclamation', label: 'Alertas' },
      { action: 'related', href: '#guideRelatedPanel', icon: 'fa-layer-group', label: 'Relacionados' }
    ];
    return `
      <nav id="guideInternalNav" class="atlas-guide-nav" aria-label="Navegação interna do guia">
        ${items.map(item => `<a class="atlas-guide-nav__link" href="${escapeAttribute(item.href)}" data-guide-action="${escapeAttribute(item.action)}"><i class="fas ${escapeAttribute(item.icon)}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></a>`).join('')}
      </nav>`;
  }

  function renderGuideRoadmapPanel(viewModel = {}) {
    const roadmapStages = Array.isArray(viewModel.roadmapStages) ? viewModel.roadmapStages : [];
    return `
      <section id="guideRoadmapPanel" class="atlas-panel atlas-panel--section atlas-roadmap-panel p-5 md:p-6">
        <div class="atlas-section-head atlas-section-head--compact">
          <div>
            <div class="atlas-eyebrow">Roadmap da platina</div>
            <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">Roadmap</h2>
            <p class="text-white/58 mt-2 max-w-4xl">Comece por estas etapas antes de mergulhar na lista completa. A ordem ajuda a reduzir retrabalho, evitar perdas e deixar o cleanup para o momento certo.</p>
          </div>
          <button type="button" class="atlas-section-toggle" data-guide-section-toggle="guideRoadmapBody" data-expanded-label="Ocultar roadmap" data-collapsed-label="Mostrar roadmap" aria-expanded="true" aria-controls="guideRoadmapBody"><span data-toggle-label>Ocultar roadmap</span><i class="fas fa-chevron-up" aria-hidden="true"></i></button>
        </div>
        <div id="guideRoadmapBody" data-guide-section-content>
          ${renderGuideRoadmapTimeline(roadmapStages)}
          ${renderGuideWalkthrough(viewModel)}
          ${roadmapStages.length >= 4 ? '<div class="atlas-guide-return-row"><button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-scroll-top="true"><i class="fas fa-arrow-up" aria-hidden="true"></i>Voltar ao topo</button></div>' : ''}
        </div>
      </section>`;
  }

  function renderGuidePlatinumSummaryPanel(game = {}, viewModel = {}) {
    const quickDecision = typeof buildGuideQuickDecisionModel === 'function' ? buildGuideQuickDecisionModel(game, viewModel) : null;
    const cards = quickDecision?.cards?.length
      ? quickDecision.cards
      : (typeof buildGuideSummaryCards === 'function' ? buildGuideSummaryCards(game, viewModel) : buildGuideHeroStats(game, viewModel));
    const decisionCards = cards.filter(card => ['missables', 'online', 'coop', 'dlc'].includes(card?.id)).slice(0, 4);
    const visibleCards = decisionCards.length ? decisionCards : cards.slice(0, 4);
    const firstAction = quickDecision?.firstAction || {
      label: 'Primeiro passo recomendado',
      title: viewModel.nextActionModel?.title || 'Abra o roadmap antes da checklist',
      detail: viewModel.nextActionModel?.detail || 'Abra o roadmap antes da checklist para entender a ordem da platina.',
      icon: 'fa-route',
      focus: 'roadmap'
    };
    return `
      <section id="guidePlatinumSummaryPanel" class="atlas-panel atlas-panel--section atlas-platinum-summary atlas-quick-decision p-5 md:p-6">
        <div class="atlas-section-head atlas-section-head--compact">
          <div>
            <div class="atlas-eyebrow">Decisão rápida</div>
            <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">O que você precisa saber antes de começar essa platina</h2>
            <p class="text-white/58 mt-2 max-w-4xl">Tempo, dificuldade, perdíveis, online, coop, DLC e confiança editorial em uma leitura rápida.</p>
          </div>
        </div>
        <div class="atlas-platinum-summary__grid" aria-label="Resumo essencial da platina">
          ${visibleCards.map(card => `<article id="guideQuickCard-${escapeAttribute(card.id || '')}" class="atlas-platinum-summary__card ${escapeAttribute(card.tone || '')}" title="${escapeAttribute(card.detail || '')}"><i class="fas ${escapeAttribute(card.icon || 'fa-circle-info')}" aria-hidden="true"></i><div><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><p>${escapeHtml(card.detail || '')}</p></div></article>`).join('')}
        </div>
        <div class="atlas-quick-decision__actions">
          <article class="atlas-quick-decision-callout atlas-quick-decision-callout--action">
            <i class="fas ${escapeAttribute(firstAction.icon || 'fa-route')}" aria-hidden="true"></i>
            <div>
              <span>${escapeHtml(firstAction.label || 'Primeiro passo recomendado')}</span>
              <strong>${escapeHtml(firstAction.title || 'Abra o roadmap antes da checklist')}</strong>
              <p>${escapeHtml(firstAction.detail || '')}</p>
              <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-guide-action="${escapeAttribute(firstAction.focus || 'roadmap')}">Ir para este ponto</button>
            </div>
          </article>
        </div>
      </section>`;
  }

  function renderGuideShortcuts(game = {}, viewModel = {}) {
    const items = typeof buildGuideShortcutModel === 'function' ? buildGuideShortcutModel(game, viewModel) : [];
    if (!items.length) return '';
    return `
      <nav id="guideShortcutPanel" class="atlas-guide-shortcuts atlas-panel atlas-panel--section" aria-label="Atalhos do guia">
        <div class="atlas-guide-shortcuts__head">
          <span class="atlas-eyebrow">Atalhos do guia</span>
          <p>Vá direto ao ponto sem reler a página inteira.</p>
        </div>
        <div class="atlas-guide-shortcuts__chips">
          ${items.map(item => `<a class="atlas-guide-shortcut" href="${escapeAttribute(item.href)}" data-guide-action="${escapeAttribute(item.action)}"><i class="fas ${escapeAttribute(item.icon || 'fa-circle-info')}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></a>`).join('')}
        </div>
      </nav>`;
  }

  function renderGuideStartContextPanel(game = {}, viewModel = {}) {
    const model = typeof buildGuideStartContextModel === 'function' ? buildGuideStartContextModel(game, viewModel) : null;
    if (!model) return '';
    return `
      <section id="guideStartContextPanel" class="atlas-panel atlas-panel--section atlas-guide-start-context p-5 md:p-6">
        <div class="atlas-section-head atlas-section-head--compact">
          <div>
            <div class="atlas-eyebrow">${escapeHtml(model.title || 'Antes de começar')}</div>
            <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Plano geral antes do roadmap</h2>
            <p class="text-white/58 mt-2 max-w-4xl">${escapeHtml(model.detail || 'Use esta seção para entender o plano geral antes de seguir o roadmap.')}</p>
          </div>
        </div>
        <div class="atlas-guide-start-context__grid">
          ${(model.items || []).map(item => `
            <article class="atlas-guide-context-chip atlas-guide-context-chip--${escapeAttribute(item.tone || 'neutral')}">
              <i class="fas ${escapeAttribute(item.icon || 'fa-circle-info')}" aria-hidden="true"></i>
              <div>
                <span>${escapeHtml(item.label || 'Contexto')}</span>
                <p>${escapeHtml(item.text || '')}</p>
              </div>
            </article>
          `).join('')}
        </div>
      </section>`;
  }

  function renderGuideRiskAlertsPanel(game = {}, viewModel = {}) {
    const alerts = typeof buildGuideRiskAlerts === 'function' ? buildGuideRiskAlerts(game, viewModel) : [];
    const beforeItems = Array.isArray(viewModel.beforeStartItems) && viewModel.beforeStartItems.length
      ? viewModel.beforeStartItems
      : (typeof buildGuideBeforeStartItems === 'function' ? buildGuideBeforeStartItems(game, viewModel) : []);
    if (!alerts.length && !beforeItems.length) return '';
    return `
      <section id="guideRiskSummaryPanel" class="atlas-panel atlas-panel--section atlas-guide-risk-summary p-5 md:p-6">
        <div class="atlas-section-head atlas-section-head--compact">
          <div>
            <div class="atlas-eyebrow">Leia antes de começar</div>
            <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Alertas que mudam a rota da platina</h2>
            <p class="text-white/58 mt-2 max-w-4xl">Confirme estes sinais antes da primeira sessão. Eles dizem se você deve priorizar roadmap, online, grind, NG+ ou cleanup antes de abrir a lista completa.</p>
          </div>
          <span class="atlas-tag atlas-tag--soft">${escapeHtml(String(beforeItems.length || alerts.length))} sinal(is)</span>
        </div>
        ${beforeItems.length ? `<div class="atlas-guide-before-grid">
          ${beforeItems.map(item => `
            <article class="atlas-guide-before-card atlas-guide-before-card--${escapeAttribute(item.tone || 'neutral')}">
              <i class="fas ${escapeAttribute(item.icon || 'fa-circle-info')}" aria-hidden="true"></i>
              <div>
                <span>${escapeHtml(item.label || 'Sinal')}</span>
                <strong>${escapeHtml(item.title || 'Revise antes de começar')}</strong>
                <p>${escapeHtml(item.detail || '')}</p>
              </div>
            </article>
          `).join('')}
        </div>` : ''}
        ${alerts.length ? `
        <div class="atlas-guide-risk-subhead">
          <span>Alertas detalhados</span>
        </div>
        <div class="atlas-guide-risk-grid">
          ${alerts.map(alert => `
            <article class="atlas-guide-risk-card atlas-guide-risk-card--${escapeAttribute(alert.tone || 'neutral')}">
              <i class="fas ${escapeAttribute(alert.icon || 'fa-circle-info')}" aria-hidden="true"></i>
              <div>
                <span>${escapeHtml(alert.label || 'Alerta')}</span>
                <strong>${escapeHtml(alert.title || 'Revise este ponto.')}</strong>
                <p>${escapeHtml(alert.detail || '')}</p>
              </div>
            </article>
          `).join('')}
        </div>
        ` : ''}
      </section>`;
  }

  function renderGuideDecisionStack(game = {}, viewModel = {}) {
    const verdict = buildThirtySecondVerdict(game, viewModel);
    return `
      <section id="guideVerdictPanel" class="atlas-panel atlas-panel--primary atlas-editorial-band p-5 md:p-6">
        <div class="atlas-editorial-band__intro">
          <div>
            <div class="atlas-eyebrow">Veredito de 30 segundos</div>
            <h2>O custo da platina em leitura rápida</h2>
            <p>${escapeHtml(verdict.summary)}</p>
          </div>
          <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-guide-action="${escapeAttribute(viewModel.nextActionModel?.focus === 'risks' ? 'risks' : 'trophies')}"><i class="fas ${escapeAttribute(viewModel.nextActionModel?.focus === 'risks' ? 'fa-triangle-exclamation' : 'fa-list-check')}"></i> ${escapeHtml(viewModel.nextActionModel?.focus === 'risks' ? 'Ler alertas e roadmap' : 'Ir para checklist')}</button>
        </div>
        <div class="atlas-verdict-strip" aria-label="Resumo rápido da platina">
          ${verdict.cards.map(card => `<article class="atlas-verdict-strip__item ${escapeAttribute(card.tone || '')}" title="${escapeAttribute(card.detail || '')}"><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><p>${escapeHtml(card.detail)}</p></article>`).join('')}
        </div>
      </section>
      ${renderGuideRiskAlertsPanel(game, viewModel)}
      ${renderGuideInternalNav()}`;
  }

  function renderGuideRiskAlertsPanelV2(game = {}, viewModel = {}) {
    const beforeItems = Array.isArray(viewModel.beforeStartItems) && viewModel.beforeStartItems.length
      ? viewModel.beforeStartItems
      : (typeof buildGuideBeforeStartItems === 'function' ? buildGuideBeforeStartItems(game, viewModel) : []);
    const items = beforeItems
      .filter(item => ['missable', 'online', 'coop', 'dlc'].includes(item?.id) && ['risk', 'warning'].includes(item?.tone))
      .slice(0, 4);
    if (!items.length) return '';
    return `
      <section id="guideRiskSummaryPanel" class="atlas-panel atlas-panel--section atlas-guide-risk-summary p-5 md:p-6">
        <div class="atlas-section-head atlas-section-head--compact">
          <div>
            <div class="atlas-eyebrow">Leia antes de começar</div>
            <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Alertas que mudam a rota da platina</h2>
            <p class="text-white/58 mt-2 max-w-4xl">No máximo cinco pontos de atenção antes do roadmap. Leia isso para evitar erro de ordem, DLC fora do escopo, coop esquecido ou cleanup mal planejado.</p>
          </div>
          <span class="atlas-tag atlas-tag--soft">${escapeHtml(String(items.length))} alerta(s)</span>
        </div>
        <div class="atlas-guide-before-grid">
          ${items.map(item => `
            <article class="atlas-guide-before-card atlas-guide-before-card--${escapeAttribute(item.tone || 'neutral')}">
              <i class="fas ${escapeAttribute(item.icon || 'fa-circle-info')}" aria-hidden="true"></i>
              <div>
                <span>${escapeHtml(item.label || 'Sinal')}</span>
                <strong>${escapeHtml(item.title || 'Revise antes de começar')}</strong>
                <p>${escapeHtml(item.detail || '')}</p>
              </div>
            </article>
          `).join('')}
        </div>
      </section>`;
  }

  function renderGuideLayerNav() {
    const items = [
      { id: 'summary', icon: 'fa-bolt', label: 'Resumo', action: 'summary', href: '#guideSummaryActions' },
      { id: 'roadmap', icon: 'fa-route', label: 'Roadmap', action: 'roadmap', href: '#guideRoadmapPanel' },
      { id: 'checklist', icon: 'fa-list-check', label: 'Checklist', action: 'trophies', href: '#guideChecklistPanel' },
      { id: 'attention', icon: 'fa-triangle-exclamation', label: 'Pontos de atenção', action: 'attention', href: '#guideEditorialNotesPanel' },
      { id: 'faq', icon: 'fa-circle-question', label: 'FAQ', action: 'faq', href: '#guideEditorialNotesPanel' },
      { id: 'feedback', icon: 'fa-flag', label: 'Feedback', action: 'feedback', href: '#guideFeedbackSlot' }
    ];
    return `
      <nav id="guideLayerNav" class="atlas-guide-layer-nav" aria-label="Seções do guia">
        ${items.map((item, index) => `
          <a class="atlas-guide-layer-nav__button${index === 0 ? ' is-active' : ''}" href="${escapeAttribute(item.href)}" data-guide-action="${escapeAttribute(item.action)}" data-guide-tab-button="${escapeAttribute(item.id)}" aria-current="${index === 0 ? 'true' : 'false'}">
            <i class="fas ${escapeAttribute(item.icon)}" aria-hidden="true"></i>
            <span>${escapeHtml(item.label)}</span>
          </a>
        `).join('')}
      </nav>`;
  }

  function renderGuideSummaryPanel(game = {}, viewModel = {}) {
    const nextAction = viewModel.nextActionModel || {};
    const normalizedSlug = String(game?.slug || '').trim().toLowerCase();
    const explicitEditorialParagraphs = Array.isArray(game?.editorial_summary)
      ? game.editorial_summary.map(paragraph => String(paragraph || '').trim()).filter(Boolean)
      : [];
    const sharedEditorialParagraphs = typeof buildGuideEditorialSummary === 'function'
      ? buildGuideEditorialSummary(game)
      : [];
    const quickPlanItems = typeof buildGuideQuickPlan === 'function'
      ? buildGuideQuickPlan(game, viewModel)
      : [];
    const editorialParagraphs = explicitEditorialParagraphs.length
      ? explicitEditorialParagraphs
      : sharedEditorialParagraphs.length
      ? sharedEditorialParagraphs
      : normalizedSlug === 'resident-evil-requiem'
      ? REQUIEM_EDITORIAL_SUMMARY
      : normalizedSlug === 'hades'
      ? HADES_EDITORIAL_SUMMARY
      : normalizedSlug === 'ghost-of-tsushima'
      ? GHOST_EDITORIAL_SUMMARY
      : ['god-of-war', 'god-of-war-2018'].includes(normalizedSlug)
      ? GOD_OF_WAR_2018_EDITORIAL_SUMMARY
      : normalizedSlug === 'god-of-war-ragnarok'
      ? GOD_OF_WAR_RAGNAROK_EDITORIAL_SUMMARY
      : normalizedSlug === 'hades-ii'
      ? HADES2_EDITORIAL_SUMMARY
      : normalizedSlug === 'astro-bot'
      ? ASTRO_BOT_EDITORIAL_SUMMARY
      : normalizedSlug === 'pragmata'
      ? PRAGMATA_EDITORIAL_SUMMARY
      : normalizedSlug === 'saros'
      ? SAROS_EDITORIAL_SUMMARY
      : normalizedSlug === 'resident-evil-4-remake'
      ? RE4_REMAKE_EDITORIAL_SUMMARY
      : normalizedSlug === 'nioh-2'
      ? NIOH2_EDITORIAL_SUMMARY
      : normalizedSlug === 'nioh-3'
      ? NIOH3_EDITORIAL_SUMMARY
      : normalizedSlug === 'the-last-of-us-part-i'
      ? TLOU_PART_I_EDITORIAL_SUMMARY
      : normalizedSlug === 'the-last-of-us-part-ii'
      ? TLOU_PART_II_EDITORIAL_SUMMARY
      : normalizedSlug === 'elden-ring'
      ? [
          'Este guia de platina de Elden Ring foi pensado para quem quer completar a lista base sem depender apenas da lista crua de troféus. A rota prioriza finais, chefes com troféu, itens lendários e pontos que podem gerar retrabalho se você avançar sem planejamento.',
          'O maior cuidado está em Bolt of Gransax, que pode ficar indisponível após a mudança de Leyndell, nos finais mutuamente exclusivos por save e na quest da Fia para Lichdragon Fortissax. Com backup de save antes da decisão final, é possível reduzir bastante o número de runs; sem backup, será necessário planejar NG+ ou novas jogadas.',
          'Shadow of the Erdtree fica fora da platina base. Use primeiro o roadmap para organizar a rota e depois a checklist para acompanhar chefes, finais, lendários e cleanup.'
        ]
      : [];
    return `
      <section id="guideSummaryActions" class="atlas-panel atlas-panel--section atlas-guide-summary-actions p-5 md:p-6">
        <div>
          ${quickPlanItems.length ? `<div class="atlas-guide-quick-plan" aria-label="Plano rápido da platina"><div class="atlas-eyebrow">Plano rápido</div><ol>${quickPlanItems.map(item => `<li><span>${escapeHtml(String(item.number || ''))}</span><div><strong>${escapeHtml(item.title || '')}</strong>${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ''}</div></li>`).join('')}</ol></div>` : '<div class="atlas-eyebrow">Plano rápido</div>'}
          <p class="text-white/62 mt-2 max-w-3xl">${escapeHtml(nextAction.detail || 'Leia o resumo, abra o roadmap quando precisar da ordem completa e use a checklist para acompanhar progresso.')}</p>
          <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-5">Resumo da platina</h2>
          ${editorialParagraphs.length ? `<div class="atlas-guide-summary-editorial mt-3 space-y-3">${editorialParagraphs.map(paragraph => `<p class="text-white/72 max-w-4xl">${escapeHtml(paragraph)}</p>`).join('')}</div>` : ''}
        </div>
        <div class="atlas-guide-summary-actions__buttons">
          <button type="button" class="atlas-btn atlas-btn-primary" data-guide-action="roadmap"><i class="fas fa-route" aria-hidden="true"></i> Abrir roadmap</button>
          <button type="button" class="atlas-btn atlas-btn-secondary" data-guide-action="trophies"><i class="fas fa-list-check" aria-hidden="true"></i> Abrir checklist</button>
          <button type="button" class="atlas-btn atlas-btn-secondary" data-guide-action="feedback"><i class="fas fa-flag" aria-hidden="true"></i> Reportar problema</button>
        </div>
      </section>`;
  }

  function renderGuideDecisionStackV2(game = {}, viewModel = {}) {
    return `
      ${renderGuideLayerNav()}`;
  }

  function renderGuideSidebarCompact(game = {}, viewModel = {}, context = {}) {
    const guideMeta = context.guideMeta || getLibraryMeta({ ...game, trophies: viewModel.trophies || [] });
    const isSaved = Boolean(context.isSaved);
    const libraryEntry = context.libraryEntry || null;
    const storageLabel = context.storageLabel || 'Salvo neste navegador';
    const libraryLabel = isSaved ? `${storageLabel} • ${getLibraryStatusLabel(libraryEntry?.status, viewModel.progress)}` : 'Ainda não salvo';
    const nextAction = viewModel.nextActionModel || {};
    const hasChecklistProgress = Number(viewModel.completed || 0) > 0;
    const progressTitle = isSaved ? 'Seu progresso' : 'Salve este guia na sua biblioteca';
    const progressText = isSaved
      ? (hasChecklistProgress
        ? 'Continue pelo checklist salvo e use o roadmap quando precisar retomar a ordem.'
        : 'Guia salvo. Abra roadmap ou checklist para começar a acompanhar sua platina.')
      : 'Acompanhe progresso, checklist e próxima etapa sem procurar tudo de novo.';
    const primaryAction = isSaved
      ? (hasChecklistProgress
        ? { label: 'Continuar de onde parei', action: 'first-pending', icon: 'fa-play' }
        : { label: 'Continuar guia', action: nextAction.focus || 'roadmap', icon: 'fa-play' })
      : { label: 'Salvar na biblioteca', action: 'save', icon: 'fa-bookmark' };
    const guidanceCounts = viewModel.guidanceCounts || {};
    const criticalAlertsCount = Number(guidanceCounts.criticalAlertsCount ?? viewModel.criticalAlertsCount ?? 0);
    const checklistTipsCount = Number(guidanceCounts.checklistTipsCount ?? viewModel.checklistTipsCount ?? 0);
    const totalGuidanceCount = Number(guidanceCounts.totalGuidanceCount ?? viewModel.totalGuidanceCount ?? viewModel.riskCounts?.alertCount ?? 0);
    const guidanceCounterHtml = criticalAlertsCount > 0 && checklistTipsCount > 0
      ? `<span class="atlas-sidebar-counts__risk">${escapeHtml(String(criticalAlertsCount))} alertas críticos</span><span class="atlas-sidebar-counts__pending">${escapeHtml(String(checklistTipsCount))} dicas</span>`
      : `<span class="atlas-sidebar-counts__risk">${escapeHtml(String(totalGuidanceCount))} dicas e alertas</span>`;
    return `
      <section class="atlas-panel atlas-panel--section atlas-guide-sidebar-card p-5" data-progress-state="${escapeAttribute(guideMeta.progressState.accent || 'partial')}">
        <div class="atlas-guide-sidebar-card__top">
          <div>
            <div class="atlas-eyebrow">${escapeHtml(progressTitle)}</div>
            <strong id="guideProgressLabel" data-guide-progress-label>${viewModel.progress}%</strong>
            <p class="atlas-sidebar-library-copy">${escapeHtml(progressText)}</p>
          </div>
          <span class="atlas-badge atlas-badge--${escapeAttribute(guideMeta.progressState.accent || 'partial')}">${escapeHtml(guideMeta.momentumLabel)}</span>
        </div>
        <div class="atlas-sidebar-progress" aria-hidden="true">
          <span id="guideProgressBar" data-guide-progress-bar style="width: ${escapeAttribute(String(viewModel.progress))}%"></span>
        </div>
        <div class="atlas-sidebar-counts">
          <span class="atlas-sidebar-counts__complete"><strong id="guideCompletedCount" data-guide-completed-count>${escapeHtml(String(viewModel.completed))}</strong> de ${escapeHtml(String(viewModel.total || viewModel.trophies?.length || 0))} marcados</span>
          <span class="atlas-sidebar-counts__pending"><strong id="guideRemainingCount" data-guide-remaining-count>${escapeHtml(String(viewModel.pending))}</strong> pendentes</span>
          ${guidanceCounterHtml}
        </div>
        <div class="atlas-sidebar-next">
          <div class="atlas-eyebrow">Próximo passo</div>
          <strong>${escapeHtml(nextAction.title || 'Abrir checklist')}</strong>
          <p>${escapeHtml(nextAction.detail || 'Use a lista principal para continuar sem perder contexto.')}</p>
          <div class="atlas-sidebar-next__actions">
            ${primaryAction.action === 'save'
              ? `<button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-toggle-save-game="true"><i class="fas ${escapeAttribute(primaryAction.icon)}" aria-hidden="true"></i>${escapeHtml(primaryAction.label)}</button>`
              : `<button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-guide-action="${escapeAttribute(primaryAction.action)}"><i class="fas ${escapeAttribute(primaryAction.icon)}" aria-hidden="true"></i>${escapeHtml(primaryAction.label)}</button>`}
            <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-guide-action="roadmap"><i class="fas fa-route" aria-hidden="true"></i>Ver roadmap</button>
            <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-guide-action="trophies"><i class="fas fa-list-check" aria-hidden="true"></i>Abrir checklist</button>
          </div>
        </div>
        <div class="atlas-sidebar-actions">
          <div class="text-xs text-white/45">${escapeHtml(libraryLabel)}</div>
          ${isSaved ? '<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-muted-action atlas-btn-compact" data-toggle-save-game="true">Remover da biblioteca</button>' : ''}
          <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-copy-game-link="${escapeAttribute(game?.slug || '')}">Copiar link</button>
        </div>
      </section>`;
  }

  function renderGuideEditorialNotes(game = {}, viewModel = {}) {
    const normalizedSlug = String(game?.slug || '').trim().toLowerCase();
    const routeTrophyLimit = ['little-nightmares-ii', 'metaphor-refantazio', 'monster-hunter-world', 'reanimal'].includes(normalizedSlug) ? 12 : (normalizedSlug === 'red-dead-redemption-2' ? 11 : (normalizedSlug === 'death-stranding-2-on-the-beach' ? 11 : (['clair-obscur-expedition-33', 'detroit-become-human'].includes(normalizedSlug) ? 10 : (normalizedSlug === 'death-stranding' ? 9 : (normalizedSlug === 'marvels-spider-man-2' ? 8 : 5)))));
    const explicitAttentionPoints = ['a-way-out', 'armored-core-vi-fires-of-rubicon', 'assassins-creed-mirage', 'assassins-creed-origins', 'assassins-creed-odyssey', 'assassins-creed-shadows', 'assassins-creed-valhalla', 'avatar-frontiers-of-pandora', 'baldurs-gate-3', 'beyond-two-souls', 'cyberpunk-2077', 'dark-souls-ii-scholar-of-the-first-sin', 'dark-souls-remastered', 'hollow-knight-silksong', 'days-gone', 'disney-epic-mickey-rebrushed', 'hades', 'hogwarts-legacy', 'horizon-forbidden-west', 'horizon-zero-dawn', 'lies-of-p', 'life-is-strange-double-exposure', 'life-is-strange-remastered', 'lords-of-the-fallen', 'resident-evil-5', 'resident-evil-6', 'resident-evil-7-biohazard', 'resident-evil-village', 'sekiro-shadows-die-twice', 'star-wars-jedi-survivor', 'until-dawn'].includes(normalizedSlug) && Array.isArray(game?.attentionPoints)
      ? game.attentionPoints.map(item => {
        const tags = Array.isArray(item?.tags)
          ? item.tags.map(tag => {
            if (typeof tag === 'string') return { label: tag, tone: 'neutral' };
            return tag?.label ? tag : null;
          }).filter(Boolean)
          : [];
        return {
          name: item?.title || item?.name || '',
          text: item?.detail || item?.tip || item?.text || item?.description || '',
          type: item?.type || tags[0]?.label || '',
          tags
        };
      }).filter(item => item.name && item.text)
      : [];
    const routeTrophies = explicitAttentionPoints.length
      ? explicitAttentionPoints
      : (Array.isArray(viewModel.routeChangingTrophies) ? viewModel.routeChangingTrophies.slice(0, routeTrophyLimit) : []);
    const faqLimit = normalizedSlug === 'marvels-spider-man-miles-morales' ? 12 : (['armored-core-vi-fires-of-rubicon', 'assassins-creed-mirage', 'assassins-creed-shadows', 'assassins-creed-valhalla', 'avatar-frontiers-of-pandora', 'baldurs-gate-3', 'beyond-two-souls', 'cyberpunk-2077', 'dark-souls-ii-scholar-of-the-first-sin', 'hades', 'lies-of-p', 'life-is-strange-double-exposure', 'little-nightmares-ii', 'lords-of-the-fallen', 'metaphor-refantazio', 'monster-hunter-world', 'nioh-3', 'reanimal', 'resident-evil-6', 'saros', 'sekiro-shadows-die-twice', 'star-wars-jedi-survivor', 'the-last-of-us-part-ii'].includes(normalizedSlug) ? 12 : (['assassins-creed-origins', 'days-gone', 'disney-epic-mickey-rebrushed', 'hogwarts-legacy', 'hollow-knight-silksong', 'horizon-forbidden-west', 'horizon-zero-dawn', 'the-last-of-us-part-i', 'subnautica', 'resident-evil-5', 'resident-evil-7-biohazard', 'resident-evil-village', 'until-dawn'].includes(normalizedSlug) ? 10 : (normalizedSlug === 'dark-souls-remastered' ? 9 : (['god-of-war-ragnarok', 'resident-evil-2-remake', 'resident-evil-3-remake', 'hollow-knight', 'marvels-spider-man'].includes(normalizedSlug) ? 8 : (normalizedSlug === 'red-dead-redemption-2' ? 7 : 6)))));
    const faqItems = Array.isArray(viewModel.contextualFaq) ? viewModel.contextualFaq.slice(0, faqLimit) : [];
    const playerFit = viewModel.playerFit || buildGuidePlayerFit(game, viewModel);
    const methodItems = Array.isArray(viewModel.editorial?.methodItems) ? viewModel.editorial.methodItems : [];
    const statusBadge = viewModel.editorial?.statusBadge || getEditorialBadge(game);
    const sectionCopy = normalizedSlug === 'the-last-of-us-part-ii'
      ? 'Respostas rápidas sobre perdíveis, online, coop, tempo, dificuldade, NG+, Chapter Select e extras fora da platina base.'
      : ['resident-evil-requiem', 'resident-evil-4-remake', 'resident-evil-5', 'resident-evil-6', 'hades', 'ghost-of-tsushima', 'god-of-war', 'god-of-war-2018', 'hades-ii', 'astro-bot', 'pragmata', 'saros', 'nioh-2', 'nioh-3', 'the-last-of-us-part-i'].includes(normalizedSlug)
      ? 'Respostas rápidas sobre perdíveis, online, coop, tempo, dificuldade e DLC da lista base.'
      : 'Respostas rápidas sobre perdíveis, online, coop, tempo, dificuldade e DLC da platina base.';
    return `
      <section id="guideEditorialNotesPanel" class="atlas-panel atlas-panel--editorial atlas-editorial-notes p-5 md:p-6">
        <div class="atlas-section-head atlas-section-head--compact">
          <div>
            <span class="atlas-section-kicker">Notas editoriais</span>
            <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Perguntas frequentes</h2>
            <p class="text-white/58 mt-2 max-w-4xl">${escapeHtml(sectionCopy)}</p>
          </div>
          <span class="atlas-tag atlas-tag--soft">${escapeHtml(statusBadge.label || 'Notas de apoio')}</span>
        </div>
        <div class="atlas-editorial-notes__grid">
          <details class="atlas-editorial-note" open>
            <summary><span>Pontos de atenção</span><small>${escapeHtml(String(routeTrophies.length || 0))}</small></summary>
            <div class="atlas-editorial-notes__column">
            <p class="atlas-muted-copy">${normalizedSlug === 'monster-hunter-world' ? 'Online, multiplayer, Guild Cards, gold crowns, RNG, endemic life e Iceborne separado que merecem acompanhamento durante a platina.' : (normalizedSlug === 'metaphor-refantazio' ? 'Calendário, Followers, quests, debates, livros, receitas, Archetypes e New Game+ que merecem acompanhamento durante a platina.' : (normalizedSlug === 'little-nightmares-ii' ? 'Glitching Remains, chapéus, Chapter Select, misc por capítulo e DLC extra que merecem acompanhamento durante a platina.' : (normalizedSlug === 'reanimal' ? 'Coffins, Hidden Statues, Sheep Mask, Chapter Replay, coop opcional e DLC extra que merecem acompanhamento durante a platina.' : (normalizedSlug === 'avatar-frontiers-of-pandora' ? 'Alertas de exploração, DLCs separadas e objetivos de mapa que merecem acompanhamento durante a platina.' : 'Riscos, spoilers, runs condicionais e objetivos que merecem acompanhamento durante a platina.'))))}</p>
            ${routeTrophies.length ? routeTrophies.map(item => {
              const badge = Array.isArray(item.tags) && item.tags.length ? item.tags[0] : null;
              return `<article class="atlas-critical-row"><div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.text)}</p></div><span class="atlas-badge atlas-badge--${escapeAttribute(badge?.tone || 'neutral')}">${escapeHtml(item.type || badge?.label || '')}</span></article>`;
            }).join('') : '<p class="atlas-muted-copy">Nenhum troféu com risco editorial alto foi detectado nos dados atuais.</p>'}
            </div>
          </details>
          <details class="atlas-editorial-note atlas-editorial-note--quiet">
            <summary><span>Confiança editorial</span><small>Metodologia</small></summary>
            <div class="atlas-editorial-notes__column atlas-editorial-notes__column--quiet">
            <strong>${escapeHtml(viewModel.snapshot.confidence.label)}</strong>
            <p>${escapeHtml(viewModel.snapshot.confidence.detail)}</p>
            <p>${escapeHtml(playerFit.fit[0] || 'Para quem quer validar custo, risco e ordem antes de começar.')}</p>
            <p>${escapeHtml(methodItems[0] || viewModel.editorial.methodSummary)}</p>
            </div>
          </details>
          <details class="atlas-editorial-note">
            <summary><span>FAQ</span><small>${escapeHtml(String(faqItems.length || 0))}</small></summary>
            <div class="atlas-editorial-notes__column">
            <div class="atlas-faq-list">
              ${faqItems.map(item => `<article class="atlas-faq-item atlas-faq-row"><strong>${escapeHtml(item.question)}</strong><p>${escapeHtml(item.answer)}</p></article>`).join('')}
            </div>
            </div>
          </details>
        </div>
      </section>`;
  }

  function getGuideCoverModel(game = {}, viewModel = {}) {
    const fallbackImage = (getGameCoverSrc ? getGameCoverSrc(game) : '') || viewModel.image || '';
    return viewModel.guideCover || {
      image: fallbackImage,
      backdropImage: game?.image || '',
      mode: fallbackImage ? 'poster' : 'fallback',
      className: fallbackImage ? 'atlas-guide-cover--poster' : 'atlas-guide-cover--fallback',
      alt: `Capa de ${game?.name || 'Jogo'}`
    };
  }

  function renderGuideHeroCover(game = {}, viewModel = {}) {
    const cover = getGuideCoverModel(game, viewModel);
    const title = game?.name || 'Jogo';
    const image = cover.image || '';
    const backdrop = cover.backdropImage && cover.mode === 'banner'
      ? `<img class="atlas-guide-cover__backdrop" src="${escapeAttribute(cover.backdropImage)}" alt="" aria-hidden="true" loading="eager" decoding="async">`
      : '';
    const fallbackVisible = image ? '' : ' atlas-guide-cover--fallback-visible';
    return `
      <div class="atlas-guide-cover atlas-guide-cover--hero ${escapeAttribute(cover.className || '')}${fallbackVisible}">
        <span class="atlas-guide-cover__fallback" aria-hidden="true">${escapeHtml(title)}</span>
        ${backdrop}
        ${image ? `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(cover.alt || `Capa de ${title}`)}" class="atlas-guide-cover__image" loading="eager" decoding="sync" fetchpriority="high" width="600" height="900" sizes="(min-width: 1280px) 180px, (min-width: 768px) 104px, 88px" onerror="this.hidden=true;this.parentElement.classList.add('atlas-guide-cover--fallback-visible');var backdrop=this.parentElement.querySelector('.atlas-guide-cover__backdrop');if(backdrop)backdrop.setAttribute('hidden','hidden');">` : ''}
      </div>
    `;
  }

  function renderGuideHeaderShell(game = {}, viewModel = {}) {
    const guideEyebrow = 'Resumo rápido do guia';
    const verdict = buildThirtySecondVerdict(game, viewModel);
    const heroStats = buildGuideHeroStats(game, viewModel);
    const routeModel = buildGuideHeroRouteModel(game, viewModel);
    const primaryAction = buildGuideHeroPrimaryAction(viewModel);
    const scopeModel = viewModel.scopeModel || {};
    return `
      <section class="atlas-panel atlas-panel--primary atlas-guide-hero p-5 md:p-6">
        <div class="atlas-guide-hero__layout">
          ${renderGuideHeroCover(game, viewModel)}
          <div class="atlas-guide-hero__body">
            <div class="atlas-guide-hero__kicker">
              <span>${escapeHtml(guideEyebrow)}</span>
            </div>
            <h1>${escapeHtml(buildGameGuideH1(game))}</h1>
            ${renderEditorialTrustRow(game, viewModel)}
            <p class="atlas-guide-hero__subtitle">${escapeHtml(scopeModel.subtitle || 'Guia de troféus e roadmap da platina')}</p>
            <p class="atlas-guide-hero__summary" hidden>${escapeHtml(verdict.summary || viewModel.decisionModel.verdictDetail)}</p>
            <div class="atlas-guide-start-card">
              <div>
                <span>Melhor rota</span>
                <strong>${escapeHtml(routeModel.title)}</strong>
                <p>${escapeHtml(routeModel.detail)}</p>
              </div>
            </div>
            <div class="atlas-guide-hero__facts">
              ${heroStats.map(item => `<span class="atlas-meta-signal ${escapeAttribute(item.tone || 'atlas-meta-signal--partial')}" title="${escapeAttribute(item.detail || '')}"><i class="fas ${escapeAttribute(item.icon)}"></i><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></span>`).join('')}
            </div>
            ${renderGuideQuickActions(primaryAction)}
          </div>
        </div>
      </section>`;
  }

  function getRelatedGuideImageValue(value = '') {
    const image = String(value || '').trim();
    return image && !(isPlaceholderGameImage ? isPlaceholderGameImage(image) : false) ? image : '';
  }

  function getRelatedGuideImageModel(game = {}) {
    const cover = getRelatedGuideImageValue(game?.cover_image);
    const banner = getRelatedGuideImageValue(game?.image);
    const derivedCover = cover ? '' : getRelatedGuideImageValue(typeof deriveSteamLibraryCover === 'function' ? deriveSteamLibraryCover(banner) : '');
    const primary = cover || derivedCover || banner;
    const fallback = primary && banner && primary !== banner ? banner : '';
    const mode = cover || derivedCover ? 'poster' : banner ? 'banner' : 'fallback';
    return {
      primary: primary ? getGameImageSrc(primary) : '',
      fallback: fallback ? getGameImageSrc(fallback) : '',
      mode
    };
  }

  function renderRelatedGuideThumb(game = {}) {
    const imageModel = getRelatedGuideImageModel(game);
    const fallbackAttr = imageModel.fallback ? ` data-fallback-src="${escapeAttribute(imageModel.fallback)}"` : '';
    const image = imageModel.primary
      ? `<img src="${escapeAttribute(imageModel.primary)}"${fallbackAttr} alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="if(this.dataset.fallbackSrc&&!this.dataset.fallbackUsed){this.dataset.fallbackUsed='true';this.src=this.dataset.fallbackSrc;this.parentElement.classList.remove('atlas-related-guide-card__thumb--poster');this.parentElement.classList.add('atlas-related-guide-card__thumb--banner');return;}this.hidden=true;this.parentElement.classList.add('atlas-related-guide-card__thumb--fallback-visible');">`
      : '';
    return `
          <div class="atlas-related-guide-card__thumb atlas-related-guide-card__thumb--${escapeAttribute(imageModel.mode)}${imageModel.primary ? '' : ' atlas-related-guide-card__thumb--fallback-visible'}">
            <span aria-hidden="true"></span>
            ${image}
          </div>`;
  }

  function renderGuideRelatedCards(relatedGames = []) {
    if (!Array.isArray(relatedGames) || !relatedGames.length) {
      return '';
    }

    return relatedGames.map(item => {
      const model = typeof sharedCard.buildCompactGuideCardModel === 'function'
        ? sharedCard.buildCompactGuideCardModel(item)
        : null;
      const game = model?.game || item?.game || item;
      const hasRisk = model ? model.hasRisk : Number(game?.missable_count || 0) > 0 || hasMissableRiskText(game?.missable || game?.missable_summary || '');
      const shortReason = model?.shortReason || ((item?.reason || 'Boa continuação para manter o ritmo de platina.').length > 96 ? `${(item?.reason || 'Boa continuação para manter o ritmo de platina.').slice(0, 93)}...` : (item?.reason || 'Boa continuação para manter o ritmo de platina.'));
      const difficultyTone = model?.difficultyTone || getDifficultyTone(game?.difficulty);
      const difficultyClass = model?.difficultyClass || getDifficultyToneClass(game?.difficulty);
      const slug = escapeAttribute(model?.slug || game?.slug || '');
      const hasImage = true;
      return `
        <article class="atlas-card atlas-card--game atlas-card--compact atlas-related-guide-card${hasImage ? ' atlas-related-guide-card--with-thumb' : ''}" data-difficulty-tone="${escapeAttribute(difficultyTone)}" data-risk="${hasRisk ? 'missable' : 'none'}">
          ${renderRelatedGuideThumb(game)}
          <div class="atlas-card__body">
            <h3 class="atlas-card__title">${escapeHtml(model?.name || game?.name || 'Jogo')}</h3>
            <p class="atlas-card__reason">${escapeHtml(shortReason)}</p>
            <div class="atlas-card__meta">
              <span class="atlas-meta-signal ${escapeAttribute(difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(model?.difficulty || String(game?.difficulty || '-'))}/10</span>
              <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(model?.time || game?.time || 'Tempo não informado')}</span>
            </div>
            <div class="atlas-card__actions">
              <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-home-game="${escapeAttribute(game?.name || '')}" data-open-guide-card="${slug}">Abrir guia</a>
            </div>
          </div>
        </article>`;
    }).join('');
  }

  function renderGuideRelatedOverview(game, relatedGames = [], comparisonModel = null) {
    if (!Array.isArray(relatedGames) || !relatedGames.length) return '';
    return `<section class="atlas-related-suggestions md:col-span-2 space-y-4"><div class="atlas-decision-panel__header"><div><span class="atlas-section-kicker">Jogos relacionados</span><h2 class="text-lg md:text-xl font-extrabold mt-2">Guias parecidos para manter o ritmo</h2></div><span class="atlas-tag atlas-tag--soft">Descoberta</span></div><div class="atlas-related-suggestions__grid">${renderGuideRelatedCards(relatedGames)}</div></section>`;
  }

  function renderGuideFeedbackCta(game = {}) {
    const gameName = game?.name || '';
    const slug = game?.slug || '';
    return `
      <section class="atlas-guide-feedback-cta atlas-panel atlas-panel--support" aria-labelledby="guideFeedbackCtaTitle">
        <div class="atlas-guide-feedback-cta__copy">
          <span class="atlas-section-kicker">Correção colaborativa</span>
          <h2 id="guideFeedbackCtaTitle">Encontrou erro neste guia?</h2>
          <p>Avise a equipe para revisarmos informações de troféus, roadmap, filtros ou pontos de atenção.</p>
        </div>
        <button type="button" class="atlas-btn atlas-btn-secondary atlas-guide-feedback-cta__button" data-guide-feedback-open="true" data-guide-feedback-game="${escapeAttribute(gameName)}" data-guide-feedback-slug="${escapeAttribute(slug)}">
          <i class="fas fa-flag" aria-hidden="true"></i> Reportar problema
        </button>
      </section>`;
  }

  function activateGuideTab(target = 'summary', options = {}) {
    const requested = target || 'summary';
    const panelTarget = requested === 'trophies' ? 'checklist' : requested;
    const panels = qsa('[data-guide-tab-panel]');
    if (!panels.length) return panelTarget;
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.guideActiveTab = panelTarget;
    }
    panels.forEach(panel => {
      const active = panel.dataset.guideTabPanel === panelTarget;
      panel.hidden = !active;
      panel.classList.toggle('hidden', !active);
      panel.classList.toggle('is-active', active);
    });
    qsa('[data-guide-tab-button]').forEach(button => {
      const selected = button.dataset.guideTabButton === requested
        || (requested === panelTarget && button.dataset.guideTabTarget === panelTarget);
      button.classList.toggle('is-active', selected);
      if (button.tagName === 'A') {
        button.setAttribute('aria-current', selected ? 'true' : 'false');
      } else {
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      }
    });
    if (options.scroll) {
      const element = qs(`#guideTab-${panelTarget}`) || qs('#guideContent');
      const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
    if (panelTarget === 'details') {
      setGuideQuickDockState({ enabled: false, visible: false });
    }
    return panelTarget;
  }

  function renderGuide(game, state = {}) {
    const guideViewEl = qs('#view-guide');
    if (guideViewEl) {
      const normalizedSlug = String(game?.slug || '').trim().toLowerCase();
      guideViewEl.classList.toggle('atlas-guide--resident-evil-6', normalizedSlug === 'resident-evil-6');
      guideViewEl.classList.toggle('atlas-guide--lego-batman-legacy-of-the-dark-knight', normalizedSlug === 'lego-batman-legacy-of-the-dark-knight');
      guideViewEl.classList.toggle('atlas-guide--lies-of-p', normalizedSlug === 'lies-of-p');
    }
    const headerEl = qs('#guideHeader');
    const decisionEl = qs('#guideDecisionStack');
    const sidebarEl = qs('#sidebarInfo');
    const trophiesEl = qs('#trophyList') || qs('#trophiesList') || qs('#guideTrophies');
    const summaryEl = qs('#guideSummarySlot');
    const roadmapEl = qs('#guideRoadmapSlot');
    const relatedEl = qs('#guideRelatedOverview');
    const editorialNotesEl = qs('#guideEditorialNotes');
    const guideFeedbackEl = qs('#guideFeedbackSlot');
    const isSaved = Boolean(state?.isSaved);
    const libraryEntry = state?.libraryEntry || null;
    const storageLabel = state?.storageLabel || 'Salvo neste navegador';
    const relatedGames = Array.isArray(state?.relatedGames) ? state.relatedGames : [];
    const comparisonModel = state?.comparisonModel || (window.GuidePresenter?.buildGuideComparisonModel ? window.GuidePresenter.buildGuideComparisonModel(game, relatedGames) : null);
    const completedSource = Array.isArray(state)
      ? state
      : Array.isArray(state?.completedTrophies)
        ? state.completedTrophies
        : (Array.isArray(game?.completed) ? game.completed : []);
    const viewModel = buildGuideViewModel(game, completedSource, { isSaved, libraryEntry });
    const guideMeta = getLibraryMeta({ ...game, completed: completedSource, trophies: viewModel.trophies });
    const collectionLinksEl = qs('#guideCollectionLinks');
    if (collectionLinksEl) {
      collectionLinksEl.innerHTML = viewModel.collectionModel.collectionLinks.map(item => `<a href="${escapeAttribute(item.path)}" class="atlas-card atlas-card--minimal atlas-related-collection"><div class="atlas-card__body"><strong class="atlas-card__title">${escapeHtml(item.label)}</strong><span class="atlas-card__reason">${escapeHtml(item.reason)}</span><span class="atlas-card__link">Abrir coleção</span></div></a>`).join('');
    }

    if (decisionEl) {
      decisionEl.innerHTML = renderGuideDecisionStackV2(game, viewModel);
    }

    if (headerEl) {
      headerEl.innerHTML = renderGuideHeaderShell(game, viewModel);
    }
    if (sidebarEl) {
      sidebarEl.innerHTML = renderGuideSidebarCompact(game, viewModel, { guideMeta, isSaved, libraryEntry, storageLabel });
    }
    if (summaryEl) {
      summaryEl.innerHTML = renderGuideSummaryPanel(game, viewModel);
    }
    if (trophiesEl) {
      trophiesEl.innerHTML = viewModel.trophies.length
        ? viewModel.trophies.map((trophy, index) => {
            const done = viewModel.completedIds.has(trophy.id);
            const description = getTrophyDisplayDescription(trophy, game);
            const tip = trophy.tip || '';
            const criticalGuideHtml = renderTrophyCriticalGuide(trophy, game);
            const officialName = getTrophyOriginalName(trophy);
            const editorialName = getTrophyEditorialName(trophy);
            const officialNameFirst = shouldUseOfficialTrophyNameFirst(game);
            const primaryName = officialNameFirst ? officialName : getTrophyDisplayName(trophy);
            const translationLabel = 'PT-BR';
            const secondaryName = officialNameFirst ? editorialName : officialName;
            const riskTags = typeof getGuideTrophyTags === 'function' ? getGuideTrophyTags(trophy, game) : getTrophyRiskTags(trophy);
            const displayRiskTags = typeof getGuideTrophyDisplayTags === 'function' ? getGuideTrophyDisplayTags(trophy, game, 4) : riskTags.slice(0, 4);
            const riskTokens = riskTags.map(tag => tag.id).join(' ');
            const search = typeof getGuideTrophySearchText === 'function'
              ? getGuideTrophySearchText(trophy, riskTags)
              : normalizeGuideSearchValue(`${trophy.trophyNameOriginal || trophy.name || ''} ${trophy.trophyNamePtBr || trophy.name_pt || ''} ${description} ${tip} ${trophy.type || ''} ${riskTags.map(tag => `${tag.id} ${tag.label}`).join(' ')}`);
            const detailsId = buildTrophyDetailsId(trophy, index);
            const hasDetailsToggle = shouldShowTrophyDetailsToggle(trophy, description, tip);
            const detailsToggleHtml = hasDetailsToggle
              ? `<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact atlas-trophy-details-toggle" data-trophy-details-toggle="true" aria-expanded="false" aria-controls="${escapeAttribute(detailsId)}"><span data-details-label>Ver detalhes</span><i class="fas fa-chevron-down" aria-hidden="true"></i></button>`
              : '';
            const toggleLabel = done ? 'Desmarcar' : 'Concluir';
            const toggleAria = `${toggleLabel} ${primaryName}`;
            const youtubeSearchUrl = typeof buildTrophyYoutubeSearchUrl === 'function'
              ? buildTrophyYoutubeSearchUrl(game?.name || game?.title || '', trophy)
              : '';
            const youtubeAriaLabel = typeof buildTrophyYoutubeSearchAriaLabel === 'function'
              ? buildTrophyYoutubeSearchAriaLabel(game?.name || game?.title || '', trophy)
              : `Buscar vídeo no YouTube para o troféu ${primaryName}`;
            return `
              <article class="trophy-card atlas-trophy-card atlas-panel atlas-panel--quiet ${done ? 'completed' : ''} ${hasDetailsToggle ? 'has-details-toggle' : ''}" data-trophy-id="${escapeAttribute(trophy.id || '')}" data-type="${escapeAttribute(trophy.type || 'Bronze')}" data-risks="${escapeAttribute(riskTokens)}" data-status="${done ? 'completed' : 'pending'}" data-search="${escapeAttribute(search)}" ${!done && trophy.id === viewModel.nextActionModel.trophyId ? 'data-next-focus="true"' : ''}>
                <div class="atlas-trophy-card__layout">
                  <div class="atlas-trophy-card__main">
                    <div class="atlas-trophy-card__headline">
                      <div class="atlas-trophy-card__title">
                        <h4>${escapeHtml(primaryName)}</h4>
                        ${editorialName ? `<p class="atlas-trophy-card__title-translation"><span>${escapeHtml(translationLabel)}</span>${escapeHtml(secondaryName)}</p>` : ''}
                      </div>
                      <div class="atlas-trophy-card__meta">
                        <span class="atlas-trophy-type">${escapeHtml(trophy.type || 'Bronze')}</span>
                        <span class="atlas-trophy-state ${done ? 'atlas-trophy-state--done' : ''}">${done ? 'Concluído' : 'Pendente'}</span>
                      </div>
                    </div>
                    ${displayRiskTags.length ? `<div class="atlas-trophy-risk-list">${displayRiskTags.map(tag => `<span class="atlas-risk-chip atlas-risk-chip--${escapeAttribute(tag.tone)}">${escapeHtml(tag.label)}</span>`).join('')}</div>` : ''}
                    <div id="${escapeAttribute(detailsId)}" class="atlas-trophy-details" data-trophy-details>
                      <p class="atlas-trophy-description">${escapeHtml(description || 'Sem descrição.')}</p>
                      ${tip ? `<div class="atlas-tip-box atlas-trophy-tip"><div class="atlas-tip-label">${trophy.is_spoiler ? 'Dica com spoiler' : 'Dica'}</div><p class="text-sm mt-2">${escapeHtml(tip)}</p></div>` : ''}
                      ${criticalGuideHtml}
                    </div>
                    ${detailsToggleHtml}
                  </div>
                  <div class="atlas-trophy-card__actions">
                    <button type="button" class="atlas-btn ${done ? 'atlas-btn-secondary' : 'atlas-btn-primary'} atlas-trophy-toggle" data-trophy-toggle="${escapeAttribute(trophy.id || '')}" aria-pressed="${done ? 'true' : 'false'}" aria-label="${escapeAttribute(toggleAria)}"><i class="fas ${done ? 'fa-rotate-left' : 'fa-check'}"></i><span>${escapeHtml(toggleLabel)}</span></button>
                    ${youtubeSearchUrl ? `<a class="atlas-btn atlas-btn-secondary atlas-btn-compact atlas-trophy-youtube-link" href="${escapeAttribute(youtubeSearchUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttribute(youtubeAriaLabel)}"><i class="fas fa-video" aria-hidden="true"></i><span>YouTube</span></a>` : ''}
                  </div>
                </div>
              </article>
            `;
          }).join('')
        : '<div class="text-white/60">Nenhum troféu cadastrado.</div>';
    }

    if (roadmapEl) {
      roadmapEl.innerHTML = renderGuideRoadmapPanel(viewModel);
    }

    if (editorialNotesEl) {
      editorialNotesEl.innerHTML = renderGuideEditorialNotes(game, viewModel);
    }

    if (relatedEl) {
      relatedEl.innerHTML = renderGuideRelatedOverview(game, relatedGames, comparisonModel);
    }
    if (guideFeedbackEl) {
      guideFeedbackEl.innerHTML = renderGuideFeedbackCta(game);
    }

    const progressLabel = qs('#progressPercent');
    const counterLabel = qs('#guideCounter');
    const quickDockProgressNodes = qsa('[data-quick-dock-progress]');
    if (progressLabel) progressLabel.textContent = `${viewModel.progress}%`;
    if (counterLabel) {
      counterLabel.textContent = viewModel.total > 0
        ? `${viewModel.completed}/${viewModel.total} concluídos`
        : 'Checklist ainda não disponível';
    }
    quickDockProgressNodes.forEach(node => {
      node.textContent = `${viewModel.progress}%`;
      node.setAttribute('aria-label', `Progresso atual ${viewModel.progress}%`);
    });
    applyChecklistDensity();
    activateGuideTab(state?.activeGuideTab || 'summary');
  }



  function updateProgress(game, completedIds = []) {
    const trophies = Array.isArray(game?.trophies) ? game.trophies : [];
    const doneSet = new Set(Array.isArray(completedIds) ? completedIds : []);
    const total = trophies.length;
    const completed = trophies.filter(t => doneSet.has(t.id)).length;
    const progress = total ? Math.round((completed / total) * 100) : 0;

    const progressBar =
      qs('#guideProgressBar') ||
      qs('#progressBar') ||
      qs('[data-guide-progress-bar]');

    const progressLabel =
      qs('#guideProgressLabel') ||
      qs('#progressLabel') ||
      qs('[data-guide-progress-label]');

    const completedLabel =
      qs('#guideCompletedCount') ||
      qs('#completedCount') ||
      qs('[data-guide-completed-count]');

    const remainingLabel =
      qs('#guideRemainingCount') ||
      qs('#remainingCount') ||
      qs('[data-guide-remaining-count]');

    const quickDockProgressNodes = qsa('[data-quick-dock-progress]');

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressLabel) progressLabel.textContent = `${progress}%`;
    if (completedLabel) completedLabel.textContent = String(completed);
    if (remainingLabel) remainingLabel.textContent = String(Math.max(total - completed, 0));
    quickDockProgressNodes.forEach(node => {
      node.textContent = `${progress}%`;
      node.setAttribute('aria-label', `Progresso atual ${progress}%`);
    });

    return { total, completed, progress };
  }

  function setGuideQuickDockState({ enabled = visible, visible = false, collapsed = false } = {}) {
    const dock = qs('#guideQuickDock');
    const body = typeof document !== 'undefined' ? document.body : null;
    const forceHiddenForDetails = body?.dataset.guideActiveTab === 'details';
    const nextVisible = forceHiddenForDetails ? false : Boolean(visible);
    const nextEnabled = forceHiddenForDetails ? false : Boolean(enabled);
    const isCollapsed = Boolean(nextVisible && collapsed);
    if (!dock) {
      body?.classList.toggle('atlas-guide-dock-active', nextVisible);
      body?.classList.toggle('atlas-guide-dock-enabled', nextEnabled);
      body?.classList.toggle('atlas-guide-dock-collapsed', isCollapsed);
      return;
    }
    dock.setAttribute('aria-hidden', nextVisible ? 'false' : 'true');
    dock.classList.toggle('hidden', !nextVisible);
    dock.classList.toggle('is-enabled', nextEnabled);
    dock.classList.toggle('is-collapsed', isCollapsed);
    const toggleButton = dock.querySelector('[data-quick-dock-toggle]');
    if (toggleButton) {
      toggleButton.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    }
    body?.classList.toggle('atlas-guide-dock-active', nextVisible);
    body?.classList.toggle('atlas-guide-dock-enabled', nextEnabled);
    body?.classList.toggle('atlas-guide-dock-collapsed', isCollapsed);
  }

  return {
    applyTrophyFilter,
    getChecklistDensityPreference,
    applyChecklistDensity,
    setChecklistDensity,
    clearTrophySearch,
    clearGuideChecklistFilters,
    bindGuideSearch,
    getTrophySearchValue,
    renderGuideDecisionStack: renderGuideDecisionStackV2,
    renderGuideRoadmapPanel,
    renderGuideSidebarCompact,
    renderGuideEditorialNotes,
    renderGuideHeaderShell,
    renderGuideRelatedCards,
    renderGuideRelatedOverview,
    renderGuideFeedbackCta,
    activateGuideTab,
    renderGuide,
    updateProgress,
    setGuideQuickDockState
  };
})();
