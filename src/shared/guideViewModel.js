(function attachGuideViewModel(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./editorialModel'));
    return;
  }
  if (root) root.AtlasGuideViewModel = factory(root.AtlasEditorialModel);
})(typeof globalThis !== 'undefined' ? globalThis : this, function guideViewModelFactory(editorial = {}) {
  const {
    FALLBACK_TIME_VALUE = Number.MAX_SAFE_INTEGER,
    getTimeValue,
    getDifficultyProfileLabel,
    getDifficultyToneClass = () => 'atlas-meta-signal--difficulty-unknown',
    getTrophyBreakdown,
    getRiskCounts,
    getTrophyRiskTags,
    hasMissableRiskText,
    getEditorialBadge,
    getEditorialTrustBadge = getEditorialBadge,
    getEditorialTrustStatus = () => 'in_review',
    getCoverageDisplayLabel,
    getVerificationStatusLabel
  } = editorial;

  function firstGuideText(...values) {
    return values.map(value => String(value || '').trim()).find(Boolean) || '';
  }

  function hasKnownTimeValue(value) {
    return Number.isFinite(value) && value !== FALLBACK_TIME_VALUE;
  }

  function isPlaceholderGuideImage(value = '') {
    const text = String(value || '').trim();
    return !text || /(^|\/)og-default\.svg(?:[?#].*)?$/i.test(text);
  }

  function deriveSteamLibraryCover(value = '') {
    const source = String(value || '').trim();
    if (!source || !/\/steam\/apps\/\d+\//i.test(source)) return '';
    const derived = source.replace(/\/(?:header|capsule_616x353)\.jpg([?#].*)?$/i, '/library_600x900.jpg$1');
    return derived !== source ? derived : '';
  }

  function compactGuideText(value, fallback = '', maxLength = 150) {
    const text = firstGuideText(value, fallback);
    if (!text || text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }

  function normalizeGuideSignalText(value = '') {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function hasGuideChapterSelectSignal(value = '', game = {}) {
    if (game?.hasChapterSelect === false || game?.chapterSelect === false) return false;
    const text = normalizeGuideSignalText(value);
    if (!text) return false;
    const negated = /nao ha chapter select|nao tem chapter select|sem chapter select|nao existe chapter select|nao ha selecao de capitulo|nao ha selecao de capitulos|sem selecao de capitulo|sem selecao de capitulos/.test(text);
    return !negated && /chapter select|selecao de capitulo|selecao de capitulos|selecionar capitulo|selecionar capitulos|collectible mode/.test(text);
  }

  const GUIDE_TROPHY_TAG_PRIORITY = ['missable', 'final', 'boss', 'legendary', 'online', 'coop', 'difficulty', 'grind', 'collectible', 'spoiler', 'cleanup', 'story', 'progress', 'system', 'run'];

  function getGuideTrophySignalText(trophy = {}) {
    return `${trophy?.trophyNameOriginal || trophy?.name || ''} ${trophy?.trophyNamePtBr || trophy?.name_pt || ''} ${trophy?.descriptionPtBr || trophy?.ptDescription || trophy?.localizedDescription?.ptBr || trophy?.description || ''} ${trophy?.tip || ''}`;
  }

  function getGuideTrophyGameSignalText(game = {}) {
    return [
      game?.online_summary,
      game?.guide_online,
      game?.online,
      game?.before_you_start,
      game?.first_run_advice,
      game?.cleanup_advice
    ].filter(Boolean).join(' ');
  }

  function sortGuideTrophyTags(tags = []) {
    return (Array.isArray(tags) ? tags : []).slice().sort((a, b) => {
      const aIndex = GUIDE_TROPHY_TAG_PRIORITY.indexOf(a?.id);
      const bIndex = GUIDE_TROPHY_TAG_PRIORITY.indexOf(b?.id);
      return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
    });
  }

  function getGuideRoadmapStepText(step = {}) {
    const normalized = normalizeRoadmapStep(step);
    if (normalized?.isStructured) {
      return [
        normalized.title,
        normalized.focus,
        normalized.objective,
        ...(Array.isArray(normalized.actions) ? normalized.actions : []),
        normalized.warning,
        normalized.note,
        normalized.result
      ].filter(Boolean).join(' ');
    }
    if (typeof step === 'string') return step;
    return firstGuideText(step?.description, step?.detail, step?.objective, step?.goal, step?.title, step?.name);
  }

  function getGuideRoadmapText(roadmap = []) {
    return (Array.isArray(roadmap) ? roadmap : []).map(getGuideRoadmapStepText).filter(Boolean).join(' ');
  }

  function isCompletionTrophy(trophy = {}) {
    const type = normalizeGuideSignalText(trophy?.type || '');
    const tier = normalizeGuideSignalText(trophy?.tier || '');
    const name = normalizeGuideSignalText(`${trophy?.trophyNameOriginal || ''} ${trophy?.name || ''}`);
    const description = normalizeGuideSignalText([
      trophy?.descriptionOriginal,
      trophy?.descriptionPtBr,
      trophy?.ptDescription,
      trophy?.localizedDescription?.ptBr,
      trophy?.localizedDescription?.['pt-BR'],
      trophy?.description
    ].filter(Boolean).join(' '));
    return type === 'platina'
      || type === 'platinum'
      || tier === 'platina'
      || tier === 'platinum'
      || /god of blood/.test(name)
      || /earn (?:every|all) other trophies|obtenha todos os trofeus|obtenha todos os outros trofeus/.test(description);
  }

  function isRealMissableTrophy(trophy = {}) {
    if (!trophy || isCompletionTrophy(trophy)) return false;
    const tags = Array.isArray(trophy.tags) ? trophy.tags : [];
    return trophy.is_missable === true
      || trophy.isMissable === true
      || trophy.missable === true
      || String(trophy.risk || '').toLowerCase() === 'missable'
      || String(trophy.riskType || '').toLowerCase() === 'missable'
      || tags.some(tag => normalizeGuideSignalText(typeof tag === 'string' ? tag : `${tag?.id || ''} ${tag?.label || ''}`).includes('perdivel'));
  }

  function countRealMissableTrophies(trophies = []) {
    return (Array.isArray(trophies) ? trophies : []).filter(isRealMissableTrophy).length;
  }

  function getGuideCombinedPlanningText(game = {}, viewModel = {}) {
    const roadmapText = getGuideRoadmapText(viewModel.roadmap || game?.roadmap || []);
    const trophyText = (Array.isArray(viewModel.trophies || game?.trophies) ? (viewModel.trophies || game.trophies) : [])
      .map(getGuideTrophySignalText)
      .join(' ');
    return [
      game?.missable_summary,
      game?.missable,
      game?.online_summary,
      game?.guide_online,
      game?.online,
      game?.dlc_scope,
      game?.guide_dlc,
      game?.dlc,
      game?.grind_summary,
      game?.guide_grind,
      game?.grind,
      game?.cleanup_advice,
      game?.before_you_start,
      roadmapText,
      trophyText
    ].filter(Boolean).join(' ');
  }

  function findGuidePlanningSnippet(sources = [], pattern, fallback = '', maxLength = 150) {
    const values = (Array.isArray(sources) ? sources : [sources]).map(value => String(value || '').trim()).filter(Boolean);
    const match = values.find(value => pattern.test(normalizeGuideSignalText(value)));
    return compactGuideText(match, fallback, maxLength);
  }

  function hasGuideOnlineSignal(value = '') {
    const text = normalizeGuideSignalText(value);
    if (!/\bonline\b|multiplayer|multi player|pvp|server|servidor|psn|ps\+|playstation plus|sos flare|guild cards?|sessao publica|internet|sport mode|red dead online/.test(text)) {
      return false;
    }
    if (/atencao tecnica/.test(text) && /nao.*multiplayer|nao.*online obrigatorio|ps\+ nao|nao.*ps\+/.test(text)) {
      return false;
    }
    const explicitOnlineRequirement = /red dead online|sport mode|sos flare|guild cards?|pvp|invasao|invadir|daily challenge|simulation mode|servidor(?:es)?|server(?:s)?/.test(text)
      && !/nao (?:exige|e|eh|precisa)|sem (?:online|multiplayer|ps\+)|nao ha (?:exigencia|trofeus?) online|nao e online|nao trate como multiplayer|offline/.test(text);
    if (explicitOnlineRequirement) return true;
    if (!/nao ha trofeus? online.*confirmad/.test(text) && /trofeus? online.*confirmad|exige .*psn|conectad[oa] a psn|ligad[oa]s? aos servidores/.test(text)) {
      return true;
    }
    if (hasNegatedGuideRequirement(text) || /local ou online|online opcional|online ajud|online pode facilitar|offline.*online|sem depender de online|nao.*online|nao.*multiplayer/.test(text)) {
      return false;
    }
    return /\bonline\b|multiplayer|multi player|pvp|psn|ps\+|playstation plus|sos flare|guild cards?|sessao publica|internet|sport mode|red dead online/.test(text);
  }

  function hasGuideCoopSignal(value = '') {
    const text = normalizeGuideSignalText(value);
    if (!/\bco-?op\b|\bcoop\b|2 jogadores|dois jogadores|segundo jogador|segundo controle|duo mode/.test(text)) {
      return false;
    }
    if (/duo mode/.test(text) && /local|app compativel|controle/.test(text) && !/obrigatorio|nao pode ser platinado solo|2 jogadores|dois jogadores/.test(text)) {
      return false;
    }
    if (!/2 jogadores|dois jogadores|segundo jogador|segundo controle|obrigatorio|nao pode ser platinado solo|nao pode ser feito solo/.test(text)
      && /solo|npc|npcs|ia|acolytes|acolitos|opcional|ajuda|facilita|nao (?:exige|e|eh|precisa)|sem coop/.test(text)) {
      return false;
    }
    return /\bco-?op\b|\bcoop\b|2 jogadores|dois jogadores|segundo jogador|segundo controle|duo mode/.test(text);
  }

  function getGuideTrophyTags(trophy = {}, game = {}) {
    if (isCompletionTrophy(trophy)) return [];
    const tags = Array.isArray(getTrophyRiskTags(trophy)) ? getTrophyRiskTags(trophy).slice() : [];
    const ids = new Set(tags.map(tag => tag?.id).filter(Boolean));
    const signalText = getGuideTrophySignalText(trophy);
    const gameSignalText = getGuideTrophyGameSignalText(game);
    const normalized = normalizeGuideSignalText(signalText);
    if (!ids.has('online') && hasGuideOnlineSignal(signalText)) {
      tags.push({ id: 'online', label: 'Online', tone: 'warning' });
      ids.add('online');
    }
    if (!ids.has('coop') && (hasGuideCoopSignal(signalText) || hasAffirmativeCoopRequirement(gameSignalText, 0))) {
      tags.push({ id: 'coop', label: 'Coop', tone: 'warning' });
      ids.add('coop');
    }
    if (!ids.has('collectible') && /colet|colecion|collect|glitching remains|remains|hats?|chapeu|chapeus|journal|journals|discos?|lost gestral|rune|runes|blueprints?|vida endemica|guild cards?/.test(normalized)) {
      tags.push({ id: 'collectible', label: 'Coletável', tone: 'partial' });
      ids.add('collectible');
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'elden-ring') {
      const eldenEndingText = normalizeGuideSignalText(`${trophy?.id || ''} ${trophy?.name || ''} ${trophy?.description || ''}`);
      if (!ids.has('final') && /ending|er_elden_lord|er_age_of_stars|er_frenzied_flame/.test(eldenEndingText)) {
        tags.push({ id: 'final', label: 'Final', tone: 'spoiler' });
        ids.add('final');
      }
      if (!ids.has('boss') && /chefe|boss|shardbearer|defeat|defeated|derrote/.test(normalized)) {
        tags.push({ id: 'boss', label: 'Chefe', tone: 'warning' });
        ids.add('boss');
      }
      if (!ids.has('legendary') && /lendari|legendary|talismans?|ashen remains|sorceries|incantations/.test(normalized)) {
        tags.push({ id: 'legendary', label: 'Lendário', tone: 'partial' });
        ids.add('legendary');
      }
      if (!ids.has('progress') && /er_roundtable|er_great_rune|er_rennala|historia|progresso|progressao|great rune|grande runa/.test(`${eldenEndingText} ${normalized}`)) {
        tags.push({ id: 'progress', label: 'Progresso', tone: 'partial' });
        ids.add('progress');
      }
      if (!ids.has('system') && /er_great_rune|great rune|grande runa|respec|restaurou o poder/.test(`${eldenEndingText} ${normalized}`)) {
        tags.push({ id: 'system', label: 'Sistema', tone: 'partial' });
        ids.add('system');
      }
    }
    if (!ids.has('story') && /historia|story|campanha|prologo|ato |chapter|capitulo|finish the game|complete a historia|conclua a historia|reach the|defeat the|derrote/.test(normalized)) {
      tags.push({ id: 'story', label: 'História', tone: 'partial' });
      ids.add('story');
    }
    if (!ids.has('difficulty') && /dificuldade|difficulty|\bhard\b|boss stem cell|stem cells|bsc|sem dano|no damage|flawless|professional|challenge rift|cursed sword|equipamento inicial|starter sword|sem usar|without|valquir|valkyr/.test(normalized)) {
      tags.push({ id: 'difficulty', label: 'Dificuldade', tone: 'warning' });
      ids.add('difficulty');
    }
    if (!ids.has('grind') && /grind|farm|rng|\brank\b|hunter rank|boss stem cell|stem cells|bsc|\blevel\b|\bnivel\b|\bxp\b|coroa|coroas|crown|crowns|100 quests|100 elites|500|50 tempered|50 elder|100,000|1,000,000|blueprints?/.test(normalized)) {
      tags.push({ id: 'grind', label: 'Grind', tone: 'warning' });
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'elden-ring') {
      const trophyId = String(trophy?.id || '').trim();
      return sortGuideTrophyTags(tags.filter(tag => {
        if (trophyId === 'er_roundtable') return !['missable', 'run', 'collectible', 'difficulty'].includes(tag?.id);
        if (trophyId === 'er_placidusax') return !['missable', 'run', 'difficulty'].includes(tag?.id);
        if (trophyId === 'er_great_rune' || trophyId === 'er_rennala') return !['missable', 'run', 'difficulty', 'collectible'].includes(tag?.id);
        if (['er_elden_lord', 'er_age_of_stars', 'er_frenzied_flame'].includes(trophyId)) return tag?.id !== 'difficulty';
        return true;
      }));
    }
    return sortGuideTrophyTags(tags);
  }

  function getGuideTrophyDisplayTags(trophy = {}, game = {}, limit = 4) {
    const tags = getGuideTrophyTags(trophy, game);
    const max = Number(limit || 0);
    return max > 0 ? tags.slice(0, max) : tags;
  }

  function getGuideTrophySearchText(trophy = {}, tags = []) {
    const tagText = (Array.isArray(tags) ? tags : [])
      .map(tag => `${tag?.id || ''} ${tag?.label || ''}`)
      .join(' ');
    return normalizeGuideSignalText([
      trophy?.name,
      trophy?.name_pt,
      trophy?.trophyNameOriginal,
      trophy?.trophyNamePtBr,
      trophy?.descriptionPtBr,
      trophy?.ptDescription,
      trophy?.localizedDescription?.ptBr,
      trophy?.description,
      trophy?.tip,
      trophy?.type,
      tagText
    ].filter(Boolean).join(' '));
  }

  function countGuideTrophyTag(trophies = [], tagId = '') {
    if (tagId === 'missable') return countRealMissableTrophies(trophies);
    return (Array.isArray(trophies) ? trophies : []).filter(trophy => getGuideTrophyTags(trophy).some(tag => tag.id === tagId)).length;
  }

  function formatGuideCount(value = 0, singular = '', plural = '') {
    const count = Number(value || 0);
    return `${count} ${count === 1 ? singular : (plural || `${singular}s`)}`;
  }

  function hasNegatedGuideRequirement(value = '') {
    const text = normalizeGuideSignalText(value);
    return /nao ha|nada (?:e|eh)? ?permanentemente perdivel|nada .*perdivel|nenhum(?:a)?\s+trofeu.{0,80}(?:marcado|tratado|contado).{0,40}perdivel|nao ha.{0,80}perdiveis? reais|sem.{0,80}perdiveis? reais|nao exige|nao e obrigatorio|nao precisa|sem exigencia|sem trofeu|sem trofeus|sem online|sem multiplayer|sem coop|dispensa|desnecessar|nao inclui|nao foram adicionados/.test(text);
  }

  function hasAffirmativeOnlineRequirement(value = '', onlineCount = 0) {
    if (onlineCount > 0) return true;
    const text = normalizeGuideSignalText(value);
    if (/nao (?:indica|aponta|lista|tem).{0,80}(?:trofeus? )?(?:online|multiplayer|servidor|servidores)/.test(text)) {
      return false;
    }
    if (/atencao tecnica/.test(text) && /nao.*multiplayer|nao.*online obrigatorio|ps\+ nao|nao.*ps\+/.test(text)) {
      return false;
    }
    if (!/nao ha trofeus? online.*confirmad/.test(text) && /trofeus? online.*confirmad|exige .*psn|conectad[oa] a psn|ligad[oa]s? aos servidores|depend[ea].*servidor|sport mode|red dead online|sos flare|guild cards?/.test(text)) {
      return true;
    }
    if (!text || hasNegatedGuideRequirement(text)) return false;
    return /\bonline\b|multiplayer|multi player|pvp|servidor|server|psn|ps\+|playstation plus|sos flare|guild cards?|sessao publica|internet|sport mode|red dead online/.test(text);
  }

  function hasAffirmativeCoopRequirement(value = '', coopCount = 0) {
    if (coopCount > 0) return true;
    const text = normalizeGuideSignalText(value);
    if (!text) return false;
    if (/nao (?:indica|aponta|lista|tem).{0,80}(?:coop|co-op|segundo jogador|2 jogadores|dois jogadores)/.test(text)) {
      return false;
    }
    if (/pode ser (?:feito|platinado|planejado) solo|solo com|coop opcional|parceiro humano.*(?:ajuda|opcional)|nao trate .*coop.*obrigatorio|sem coop/.test(text)) {
      return false;
    }
    const hasCoopRequirement = /exige 2 jogadores|2 jogadores obrigatorios|dois jogadores obrigatorios|nao pode ser platinado solo|nao pode ser feito solo|campanha em \bco-?op\b|campanha \bcoop\b|segundo jogador obrigatorio/.test(text);
    if (hasCoopRequirement) return true;
    return !hasNegatedGuideRequirement(text) && /\bcoop obrigatorio\b|\bco-op obrigatorio\b/.test(text);
  }

  function countGuideExplicitCoop(trophies = []) {
    return (Array.isArray(trophies) ? trophies : []).filter(trophy => hasGuideCoopSignal(getGuideTrophySignalText(trophy))).length;
  }

  function getGuideNetworkRequirementModel(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : (Array.isArray(game?.trophies) ? game.trophies : []);
    const inputs = getGuideVerdictInputs(game, { ...viewModel, trophies });
    const combinedText = getGuideCombinedPlanningText(game, { ...viewModel, trophies });
    const onlineCount = countGuideTrophyTag(trophies, 'online');
    const explicitCoopCount = countGuideExplicitCoop(trophies);
    const hasOnline = hasAffirmativeOnlineRequirement(inputs.online, onlineCount);
    const hasCoop = hasAffirmativeCoopRequirement(`${inputs.online || ''} ${combinedText}`, explicitCoopCount);
    const normalizedOnline = normalizeGuideSignalText(inputs.online);
    const localCoop = /coop local|co-op local|local/.test(normalizedOnline);
    const onlineCoop = /coop online|co-op online|online/.test(normalizedOnline) && hasCoop;
    const twoPlayers = /2 jogadores|dois jogadores|segundo jogador|dupla/.test(normalizedOnline) || hasCoop;

    return {
      hasOnline,
      hasCoop,
      onlineCount: onlineCount || (hasOnline ? 1 : 0),
      coopCount: explicitCoopCount || (hasCoop ? 1 : 0),
      localCoop,
      onlineCoop,
      twoPlayers,
      onlineLabel: hasOnline ? (onlineCount ? `${onlineCount} online/multiplayer` : 'Online/multiplayer') : 'Sem online obrigatório',
      onlineDetail: compactGuideText(inputs.online, hasOnline ? 'Resolva requisitos online cedo para não deixar dependências para o fim.' : 'O guia não aponta troféu online obrigatório.', 150),
      onlineTone: hasOnline ? 'warning' : 'complete',
      coopLabel: hasCoop ? (twoPlayers ? '2 jogadores obrigatórios' : 'Coop obrigatório') : 'Sem coop obrigatório',
      coopDetail: compactGuideText(inputs.online, hasCoop ? 'A platina exige outro jogador; pode ser local ou online conforme o jogo permitir.' : 'O guia não aponta exigência de segundo jogador.', 150),
      coopTone: hasCoop ? 'warning' : 'complete'
    };
  }

  function buildGuideDlcScopeModel(game = {}, inputs = {}) {
    const dlcText = firstGuideText(inputs.dlc, game?.dlc_scope, game?.guide_dlc, game?.dlc);
    const normalized = normalizeGuideSignalText(dlcText);
    if (!dlcText) {
      return {
        value: 'Escopo não informado',
        detail: 'O guia ainda não informa se DLCs entram no escopo.',
        tone: 'atlas-meta-signal--partial'
      };
    }
    if (game?.dlc_status === 'out_of_base_scope' || /shadow of the erdtree/.test(normalized)) {
      return {
        value: 'DLC fora da platina base',
        detail: dlcText,
        tone: 'atlas-meta-signal--complete'
      };
    }
    if (/fora do escopo|fica fora|ficam fora|entrada separada|validar separadamente|nao tratar como dlc|nao e dlc/.test(normalized)) {
      return {
        value: 'Conteúdo extra fora',
        detail: dlcText,
        tone: 'atlas-meta-signal--complete'
      };
    }
    if (/lista base|jogo base|base game|sem dlc|nao inclui|nao foram adicionados|nao foi misturado|dlc nao necessaria|nao e necessaria|nao ha dlc/.test(normalized)) {
      return {
        value: 'Base game, sem DLCs',
        detail: dlcText,
        tone: 'atlas-meta-signal--complete'
      };
    }
    if (/voidheart edition|lista playstation|conteudos .* fazem parte|conquistas extras|pc\/xbox/.test(normalized)) {
      return {
        value: 'Lista PlayStation integrada',
        detail: dlcText,
        tone: 'atlas-meta-signal--complete'
      };
    }
    if (/inclui|necessaria|obrigatoria|expansao|expansoes|dlc/.test(normalized)) {
      return {
        value: 'DLC no escopo',
        detail: dlcText,
        tone: 'atlas-meta-signal--warning'
      };
    }
    return {
      value: 'Escopo descrito',
      detail: dlcText,
      tone: 'atlas-meta-signal--partial'
    };
  }

  function buildGuideBeforeStartItems(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : (Array.isArray(game?.trophies) ? game.trophies : []);
    const roadmap = Array.isArray(viewModel.roadmap) ? viewModel.roadmap : (Array.isArray(game?.roadmap) ? game.roadmap : []);
    const inputs = getGuideVerdictInputs(game, { ...viewModel, trophies, roadmap });
    const riskCounts = viewModel.riskCounts || getRiskCounts(trophies);
    const roadmapTexts = roadmap.map(getGuideRoadmapStepText).filter(Boolean);
    const combinedText = getGuideCombinedPlanningText(game, { ...viewModel, trophies, roadmap });
    const normalized = normalizeGuideSignalText(combinedText);
    const network = getGuideNetworkRequirementModel(game, { ...viewModel, trophies, roadmap });
    const missableCount = countRealMissableTrophies(trophies);
    const missableText = inputs.missableSummary || '';
    const missableNegated = hasNegatedGuideRequirement(missableText);
    const hasMissable = Boolean(!missableNegated && (missableCount || hasMissableRiskText(missableText)));
    const dlcScope = buildGuideDlcScopeModel(game, inputs);
    const hasChapterSelect = hasGuideChapterSelectSignal(normalized, game);
    const ngPlusNegated = /sem new game\+|sem ng\+|sem ng plus|nao ha new game\+|nao ha ng\+|nao exige.{0,80}(?:new game\+|ng\+|ng plus)|(?:new game\+|ng\+|ng plus).{0,80}nao (?:e necessario|foi tratado como obrigatorio|foram tratados como obrigatorios)/.test(normalized);
    const hasNgPlus = !ngPlusNegated && /new game\+|new game plus|ng\+|ng plus|nova jornada\+|novo jogo\+/.test(normalized);
    const grindText = normalizeGuideSignalText(inputs.grind);
    const hasGrind = !/nao ha grind|sem grind|nao existe grind|nao em grind|nao e grind pesado/.test(normalized)
      && (
        /grind|farm|rng|coroa|coroas|crown|crowns|hunter rank|rank 100|boss stem cell|stem cells|bsc|nivel 99|level 99/.test(normalized)
        || (Number(riskCounts.grind || 0) > 0 && /grind|farm|rng|coroa|coroas|crown|crowns|rank|boss stem cell|bsc|blueprints/.test(grindText))
      );
    const hasCollectibles = /colet|colecion|journal|journals|disco|discos|old key|mime|maelle|lost gestral|glitching remains|chapeu|hunter.?s journal|blueprints|runa|runas/.test(normalized)
      || Number(riskCounts.collectible || 0) > 0;
    const difficultyText = normalizeGuideSignalText(firstGuideText(inputs.difficultyReason, inputs.beforeYouStart, inputs.dlc, ...roadmapTexts));
    const hasDifficultyNegation = /nao exige dificuldade|sem dificuldade alta|dificuldade alta nao|nao ha trofeu de dificuldade|maxima nao|grounded.*fora|grounded.*nao/.test(difficultyText);
    const currentSlug = String(game?.slug || '').trim().toLowerCase();
    const hasDifficultyRisk = currentSlug !== 'subnautica' && (Number(inputs.difficulty || 0) >= 7 || (!hasDifficultyNegation && Number(riskCounts.difficulty || 0) > 0));
    const grindSnippet = findGuidePlanningSnippet(
      [inputs.grind, inputs.missableSummary, ...roadmapTexts],
      /grind|farm|rng|coroa|coroas|crown|crowns|hunter rank|rank 100|boss stem cell|stem cells|bsc|nivel 99|level 99/,
      hasGrind ? 'Ha sinais de farm, endgame ou repeticao que devem entrar no planejamento antes da checklist.' : 'Sem grind forte destacado nos dados atuais.'
    );
    const chapterSnippet = findGuidePlanningSnippet(
      [inputs.missableSummary, inputs.cleanupAdvice, ...roadmapTexts],
      /chapter select|selecao de capitulo|selecao de capitulos|selecionar capitulo|selecionar capitulos|collectible mode/,
      hasChapterSelect ? 'O guia menciona capitulos ou selecao de capitulo; revise antes de avancar.' : 'Sem Chapter Select confirmado nos dados do guia.'
    );
    const ngPlusSnippet = findGuidePlanningSnippet(
      [inputs.missableSummary, inputs.cleanupAdvice, ...roadmapTexts],
      /new game\+|new game plus|ng\+|ng plus|nova jornada\+|novo jogo\+/,
      hasNgPlus ? 'Ha mencao a NG+; conclua pendencias sensiveis antes de iniciar uma nova rota.' : 'Sem exigencia de NG+ destacada no guia.'
    );
    const collectibleSnippet = findGuidePlanningSnippet(
      [inputs.beforeYouStart, inputs.grind, inputs.missableSummary, inputs.cleanupAdvice, ...roadmapTexts],
      /colet|colecion|journal|journals|disco|discos|old key|mime|maelle|lost gestral|glitching remains|chapeu|hunter.?s journal|blueprints|runa|runas/,
      'Marque coletáveis e ações opcionais durante a campanha para não transformar o cleanup em varredura cega.'
    );

    const items = [
      {
        id: 'missable',
        show: hasMissable,
        priority: 100,
        icon: 'fa-triangle-exclamation',
        label: 'Perdíveis',
        title: hasMissable ? (missableCount ? formatGuideCount(missableCount, 'perdível', 'perdíveis') : 'Atenção antes de avançar') : 'Sem perdível permanente',
        detail: compactGuideText(missableText, hasMissable ? 'Revise os alertas antes da primeira sessão.' : 'O guia não marca perda permanente como bloqueio principal.', 150),
        tone: hasMissable ? 'risk' : 'soft'
      },
      {
        id: 'coop',
        show: network.hasCoop,
        priority: 95,
        icon: 'fa-users',
        label: 'Coop',
        title: network.coopLabel,
        detail: network.coopDetail,
        tone: 'warning'
      },
      {
        id: 'online',
        show: network.hasOnline,
        priority: 90,
        icon: 'fa-wifi',
        label: 'Online',
        title: network.onlineLabel,
        detail: network.onlineDetail,
        tone: network.hasOnline ? 'warning' : 'soft'
      },
      {
        id: 'dlc',
        show: Boolean(inputs.dlc),
        priority: /base game|lista base|jogo base|sem dlc|nao inclui|iceborne|expansao|preorder|conteudo extra/.test(normalizeGuideSignalText(inputs.dlc)) ? 80 : 35,
        icon: 'fa-layer-group',
        label: 'DLC',
        title: dlcScope.value,
        detail: compactGuideText(dlcScope.detail, 'Escopo de DLC nao informado no guia.', 150),
        tone: dlcScope.tone?.includes('warning') ? 'warning' : (dlcScope.tone?.includes('complete') ? 'soft' : 'neutral')
      },
      {
        id: 'chapter',
        show: hasChapterSelect,
        priority: hasMissable ? 70 : 75,
        icon: 'fa-book-open',
        label: 'Chapter Select',
        title: hasChapterSelect ? 'Revise capitulos antes da rota' : 'Sem Chapter Select confirmado',
        detail: chapterSnippet,
        tone: hasChapterSelect ? 'warning' : 'neutral'
      },
      {
        id: 'ngplus',
        show: hasNgPlus,
        priority: 65,
        icon: 'fa-rotate',
        label: 'NG+',
        title: hasNgPlus ? 'Nao entre em NG+ cedo' : 'NG+ nao e eixo principal',
        detail: ngPlusSnippet,
        tone: hasNgPlus ? 'risk' : 'neutral'
      },
      {
        id: 'collectibles',
        show: hasCollectibles,
        priority: 60,
        icon: 'fa-map-pin',
        label: 'Coletaveis',
        title: 'Acompanhe itens e ações opcionais',
        detail: collectibleSnippet,
        tone: 'warning'
      },
      {
        id: 'grind',
        show: hasGrind,
        priority: 55,
        icon: 'fa-repeat',
        label: 'Grind',
        title: hasGrind ? 'Planeje farm/endgame cedo' : 'Sem grind forte no topo',
        detail: grindSnippet,
        tone: hasGrind ? 'warning' : 'soft'
      },
      {
        id: 'difficulty',
        show: hasDifficultyRisk,
        priority: 50,
        icon: 'fa-bolt',
        label: 'Execucao',
        title: Number(inputs.difficulty || 0) >= 7 ? `Dificuldade ${inputs.difficulty}/10` : 'Trofeu de execucao',
        detail: compactGuideText(inputs.difficultyReason, 'Separe tempo para treinar chefes, desafios ou condicoes de dificuldade antes do cleanup final.', 150),
        tone: 'warning'
      }
    ];

    const selected = items
      .filter(item => item.show)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5)
      .map(({ show, priority, ...item }) => item);

    if (selected.length) return selected;

    return [{
      id: 'safe-start',
      icon: 'fa-circle-check',
      label: 'Leitura inicial',
      title: 'Sem alerta critico antes da checklist',
      detail: 'Comece pelo roadmap para entender a ordem e depois use a checklist para marcar progresso.',
      tone: 'soft'
    }];
  }

  function buildGuideScopeModel(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : [];
    const total = Number(viewModel.total || trophies.length || game?.trophy_count || 0);
    const hasPlatinum = trophies.some(trophy => String(trophy?.type || '').toLowerCase() === 'platina');
    const dlcScope = buildGuideDlcScopeModel(game, getGuideVerdictInputs(game, viewModel));
    return {
      kind: hasPlatinum ? 'platinum' : 'completion',
      label: hasPlatinum ? 'Platina' : '100%',
      value: hasPlatinum ? 'Platina base' : '100%',
      subtitle: hasPlatinum ? 'Guia de troféus e roadmap da platina' : 'Guia de troféus e roadmap de 100%',
      detail: total ? `${total} troféu(s) no escopo atual. ${dlcScope.detail}` : dlcScope.detail
    };
  }

  function shouldReadRoadmapFirst(game = {}, trophies = [], roadmap = []) {
    const inputs = getGuideVerdictInputs(game, { trophies, roadmap, total: trophies.length });
    const riskCounts = getRiskCounts(trophies);
    const onlineCount = countGuideTrophyTag(trophies, 'online');
    const coopCount = countGuideTrophyTag(trophies, 'coop');
    const hasOnline = hasAffirmativeOnlineRequirement(inputs.online, onlineCount);
    const hasCoop = hasAffirmativeCoopRequirement(inputs.online, coopCount);
    const missableText = firstGuideText(inputs.missableSummary, game?.missable);
    const hasMissable = countRealMissableTrophies(trophies) > 0 || (!hasNegatedGuideRequirement(missableText) && hasMissableRiskText(missableText));
    const timeValue = getTimeValue(game);
    return Boolean(
      hasMissable
      || hasOnline
      || hasCoop
      || Number(inputs.difficulty || 0) >= 7
      || Number(riskCounts.difficulty || 0) > 0
      || Number(riskCounts.grind || 0) > 0
      || Number(inputs.trophyCount || trophies.length || 0) >= 45
      || (hasKnownTimeValue(timeValue) && timeValue > 35)
      || roadmap.length >= 4
    );
  }

  function buildGuideSummaryCards(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : [];
    const inputs = getGuideVerdictInputs(game, viewModel);
    const riskCounts = viewModel.riskCounts || getRiskCounts(trophies);
    const total = Number(inputs.trophyCount || viewModel.total || trophies.length || 0);
    const network = getGuideNetworkRequirementModel(game, { ...viewModel, trophies });
    const missableCount = countRealMissableTrophies(trophies);
    const hasMissableText = hasMissableRiskText(inputs.missableSummary);
    const dlcScope = buildGuideDlcScopeModel(game, inputs);
    const statusBadge = viewModel.editorial?.statusBadge || getGuideEditorialStatusBadge(game, getEditorialBadge(game));
    const scope = viewModel.scopeModel || buildGuideScopeModel(game, { ...viewModel, trophies, total });
    const combinedText = normalizeGuideSignalText(getGuideCombinedPlanningText(game, { ...viewModel, trophies }));
    const hasChapterSelect = hasGuideChapterSelectSignal(combinedText, game);
    const grindCount = Number(riskCounts.grind || countGuideTrophyTag(trophies, 'grind') || 0);
    const normalizedGrindSummary = normalizeGuideSignalText(inputs.grind);
    const hasGrind = grindCount >= 4 || Boolean(normalizedGrindSummary
      && !/sem grind|nao ha grind|nao existe grind|nao ha grind real/.test(normalizedGrindSummary)
      && /grind|farm|rng|coroa|coroas|crown|crowns|boss stem cell|stem cells|bsc|hunter rank|rank 100|level 99|nivel 99|112%|pantheon|endless tower/.test(normalizedGrindSummary));
    const cards = [
      { icon: 'fa-clock', label: 'Tempo estimado', value: inputs.timeLabel || 'Tempo nao informado', detail: compactGuideText(inputs.timeReason, 'Estimativa cadastrada no guia.', 96), tone: 'atlas-meta-signal--time' },
      { icon: 'fa-gauge-high', label: 'Dificuldade', value: `${inputs.difficulty || '-'}/10`, detail: compactGuideText(inputs.difficultyReason, 'Escala editorial do Atlas.', 96), tone: getDifficultyToneClass(inputs.difficulty) },
      { icon: 'fa-trophy', label: 'Troféus', value: `${total}`, detail: 'Total visível no checklist.', tone: 'atlas-meta-signal--trophy' },
      { icon: 'fa-rotate', label: 'Jogadas/runs', value: inputs.runs || viewModel.snapshot?.runEstimate || getGuideRunEstimate(game, viewModel.roadmap || [], trophies), detail: compactGuideText(inputs.firstRunAdvice, 'Use o roadmap para organizar a rota.', 96), tone: 'atlas-meta-signal--partial' },
      { icon: 'fa-triangle-exclamation', label: 'Perdíveis', value: missableCount ? formatGuideCount(missableCount, 'perdível', 'perdíveis') : (hasMissableText ? 'Atenção' : 'Sem perdíveis'), detail: compactGuideText(inputs.missableSummary, hasMissableText ? 'Leia antes de avançar.' : 'Sem bloqueio crítico marcado.', 96), tone: missableCount || hasMissableText ? 'atlas-meta-signal--risk' : 'atlas-meta-signal--complete' },
      { icon: 'fa-wifi', label: 'Online', value: network.onlineLabel, detail: compactGuideText(network.onlineDetail, '', 96), tone: `atlas-meta-signal--${network.onlineTone}` },
      { icon: 'fa-users', label: 'Coop', value: network.coopLabel, detail: compactGuideText(network.coopDetail, '', 96), tone: `atlas-meta-signal--${network.coopTone}` },
      { icon: 'fa-layer-group', label: 'DLC', value: dlcScope.value, detail: compactGuideText(dlcScope.detail, 'Escopo de DLC do guia.', 96), tone: dlcScope.tone }
    ];

    const explicitlyNoChapterSelect = game?.hasChapterSelect === false || game?.chapterSelect === false;
    if (hasChapterSelect || !explicitlyNoChapterSelect) {
      cards.push({
        icon: 'fa-book-open',
        label: 'Chapter Select',
        value: hasChapterSelect ? 'Ajuda no cleanup' : 'Nao confirmado',
        detail: hasChapterSelect ? 'Use selecao de capitulos para limpar pendencias.' : 'Siga o roadmap antes de depender de selecao de capitulos.',
        tone: hasChapterSelect ? 'atlas-meta-signal--complete' : 'atlas-meta-signal--partial'
      });
    }

    if (hasGrind) {
      cards.push({
        icon: 'fa-repeat',
        label: 'Grind',
        value: grindCount ? formatGuideCount(grindCount, 'sinal', 'sinais') : 'Relevante',
        detail: compactGuideText(inputs.grind, 'Planeje farm, repeticao ou endgame.', 96),
        tone: 'atlas-meta-signal--warning'
      });
    }

    cards.push({ icon: 'fa-crown', label: 'Platina/100%', value: scope.label, detail: compactGuideText(scope.detail, 'Escopo atual do guia.', 96), tone: 'atlas-meta-signal--trophy' });
    return cards;

    return [
      { icon: 'fa-crown', label: 'Escopo', value: scope.value, detail: scope.detail, tone: 'atlas-meta-signal--trophy' },
      { icon: 'fa-gauge-high', label: 'Dificuldade', value: `${inputs.difficulty || '-'}/10`, detail: inputs.difficultyReason || 'Escala editorial do Atlas.', tone: getDifficultyToneClass(inputs.difficulty) },
      { icon: 'fa-clock', label: 'Tempo', value: inputs.timeLabel || 'Tempo não informado', detail: inputs.timeReason || 'Estimativa cadastrada no guia.', tone: 'atlas-meta-signal--time' },
      { icon: 'fa-triangle-exclamation', label: 'Perdíveis', value: missableCount ? formatGuideCount(missableCount, 'perdível', 'perdíveis') : (hasMissableText ? 'Atenção' : 'Sem perdíveis'), detail: inputs.missableSummary || 'Sinais de troféus que podem gerar retrabalho.', tone: missableCount || hasMissableText ? 'atlas-meta-signal--risk' : 'atlas-meta-signal--complete' },
      { icon: 'fa-wifi', label: 'Online', value: network.onlineLabel, detail: network.onlineDetail, tone: `atlas-meta-signal--${network.onlineTone}` },
      { icon: 'fa-users', label: 'Coop', value: network.coopLabel, detail: network.coopDetail, tone: `atlas-meta-signal--${network.coopTone}` },
      { icon: 'fa-layer-group', label: 'DLC', value: dlcScope.value, detail: dlcScope.detail, tone: dlcScope.tone },
      { icon: 'fa-trophy', label: 'Troféus', value: `${total}`, detail: 'Total visível no checklist.', tone: 'atlas-meta-signal--trophy' },
      { icon: 'fa-clipboard-check', label: 'Status', value: statusBadge.label, detail: statusBadge.detail || 'Status editorial do guia.', tone: `atlas-meta-signal--${statusBadge.tone || statusBadge.badge || 'partial'}` }
    ];
  }

  function hasGuideReviewSignal(...values) {
    const text = normalizeGuideSignalText(values.filter(Boolean).join(' '));
    return /precisa (?:revisao|validar|validacao)|aguarda(?:ndo)? validacao|aguarda(?:ndo)? revisao|em revisao|informacao em revisao|nao confirmado|nao confirmad|incert|sujeit[oa] a revisao|dados atuais|validar manualmente/.test(text);
  }

  function hasGuideOnlineReviewSignal(value = '') {
    const text = normalizeGuideSignalText(value);
    return /nao ha trofeus? online obrigatorios nos dados atuais|(?:online|servidor|ps\+)[^.]{0,40}precisa (?:validar|revisao)|precisa (?:validar|revisao)[^.]{0,70}online|validar [^.]{0,60}online|online [^.]{0,40}validar/.test(text);
  }

  function buildQuickDecisionFact({ id, icon, label, value, detail, tone = 'atlas-meta-signal--partial' }) {
    return {
      id: id || '',
      icon: icon || 'fa-circle-info',
      label: label || 'Sinal',
      value: value || 'Informação em revisão',
      detail: compactGuideText(detail, '', 120),
      tone
    };
  }

  function buildGuideQuickDecisionModel(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : (Array.isArray(game?.trophies) ? game.trophies : []);
    const roadmap = Array.isArray(viewModel.roadmap) ? viewModel.roadmap : (Array.isArray(game?.roadmap) ? game.roadmap : []);
    const inputs = getGuideVerdictInputs(game, { ...viewModel, trophies, roadmap });
    const riskCounts = viewModel.riskCounts || getRiskCounts(trophies);
    const network = getGuideNetworkRequirementModel(game, { ...viewModel, trophies, roadmap });
    const dlcScope = buildGuideDlcScopeModel(game, inputs);
    const statusBadge = viewModel.editorial?.statusBadge || getGuideEditorialStatusBadge(game, getEditorialBadge(game));
    const nextAction = viewModel.nextActionModel || deriveNextAction({ ...game, trophies, roadmap }, []);
    const beforeItems = Array.isArray(viewModel.beforeStartItems) && viewModel.beforeStartItems.length
      ? viewModel.beforeStartItems
      : buildGuideBeforeStartItems(game, { ...viewModel, trophies, roadmap, riskCounts });

    const missableText = firstGuideText(inputs.missableSummary, game?.missable);
    const missableCount = countRealMissableTrophies(trophies);
    const hasMissable = Boolean(missableCount || (!hasNegatedGuideRequirement(missableText) && hasMissableRiskText(missableText)));
    const missableReview = !missableText || (!hasMissable && hasGuideReviewSignal(missableText));
    const onlineReview = !inputs.online || (!network.hasOnline && hasGuideOnlineReviewSignal(inputs.online));
    const combinedText = getGuideCombinedPlanningText(game, { ...viewModel, trophies, roadmap });
    const normalizedCombinedText = normalizeGuideSignalText(combinedText);
    const coopNegated = /nao (?:indica|aponta|lista|tem).{0,80}(?:coop|co-op|segundo jogador|2 jogadores|dois jogadores)|sem coop|nao exige coop/.test(normalizedCombinedText);
    const explicitlyNoCoop = game?.coopRequired === false || game?.requiresCoop === false || game?.hasMandatoryCoop === false;
    const coopReview = !explicitlyNoCoop && ((!inputs.online && !combinedText) || (!network.hasCoop && !coopNegated && /coop|co-op|2 jogadores|dois jogadores|segundo jogador/.test(normalizedCombinedText) && hasGuideReviewSignal(combinedText)));
    const dlcReview = !inputs.dlc || (!/complete|warning/.test(String(dlcScope.tone || '')) && hasGuideReviewSignal(inputs.dlc));

    let dlcValue = dlcScope.value;
    const normalizedDlc = normalizeGuideSignalText(inputs.dlc);
    if (!inputs.dlc || dlcReview) dlcValue = 'Informação em revisão';
    else if (/lista base|jogo base|base game|sem dlc|nao inclui|nao foram adicionados|nao foi misturado|dlc nao necessaria|nao e necessaria|fora do escopo|ficam fora|entrada separada/.test(normalizedDlc)) {
      dlcValue = 'DLC não necessária para platina base';
    }

    const cards = [
      buildQuickDecisionFact({
        id: 'time',
        icon: 'fa-clock',
        label: 'Tempo estimado',
        value: inputs.timeLabel || 'Informação em revisão',
        detail: inputs.timeReason || 'Estimativa editorial cadastrada no guia.',
        tone: 'atlas-meta-signal--time'
      }),
      buildQuickDecisionFact({
        id: 'difficulty',
        icon: 'fa-gauge-high',
        label: 'Dificuldade',
        value: inputs.difficulty ? `${inputs.difficulty}/10` : 'Informação em revisão',
        detail: inputs.difficultyReason || 'Escala editorial do Atlas.',
        tone: inputs.difficulty ? getDifficultyToneClass(inputs.difficulty) : 'atlas-meta-signal--partial'
      }),
      buildQuickDecisionFact({
        id: 'missables',
        icon: 'fa-triangle-exclamation',
        label: 'Perdíveis',
        value: missableReview ? 'Informação em revisão' : (hasMissable ? 'Tem perdíveis' : 'Sem perdíveis'),
        detail: missableText || 'O guia ainda não informa perdíveis com segurança.',
        tone: missableReview ? 'atlas-meta-signal--partial' : (hasMissable ? 'atlas-meta-signal--risk' : 'atlas-meta-signal--complete')
      }),
      buildQuickDecisionFact({
        id: 'online',
        icon: 'fa-wifi',
        label: 'Online',
        value: onlineReview ? 'Informação em revisão' : (network.hasOnline ? 'Online obrigatório' : 'Sem online obrigatório'),
        detail: network.onlineDetail || inputs.online || 'O guia ainda não informa online com segurança.',
        tone: onlineReview ? 'atlas-meta-signal--partial' : (network.hasOnline ? 'atlas-meta-signal--warning' : 'atlas-meta-signal--complete')
      }),
      buildQuickDecisionFact({
        id: 'coop',
        icon: 'fa-users',
        label: 'Coop',
        value: coopReview ? 'Informação em revisão' : (network.hasCoop ? 'Coop obrigatório' : 'Sem coop obrigatório'),
        detail: network.coopDetail || inputs.online || 'O guia ainda não informa coop com segurança.',
        tone: coopReview ? 'atlas-meta-signal--partial' : (network.hasCoop ? 'atlas-meta-signal--warning' : 'atlas-meta-signal--complete')
      }),
      buildQuickDecisionFact({
        id: 'dlc',
        icon: 'fa-layer-group',
        label: 'DLC',
        value: dlcValue,
        detail: dlcScope.detail || 'Escopo de DLC ainda não informado.',
        tone: dlcReview ? 'atlas-meta-signal--partial' : dlcScope.tone
      }),
      buildQuickDecisionFact({
        id: 'editorial',
        icon: 'fa-clipboard-check',
        label: 'Status editorial',
        value: statusBadge.label || 'Informação em revisão',
        detail: statusBadge.detail || game?.verification_note || 'Status editorial do guia.',
        tone: `atlas-meta-signal--${statusBadge.tone || statusBadge.badge || 'partial'}`
      })
    ];

    const firstRoadmapStep = roadmap.map(getGuideRoadmapStepText).find(Boolean);
    const firstActionDetail = firstGuideText(inputs.firstRunAdvice, nextAction.detail, firstRoadmapStep, 'Abra o roadmap antes da checklist para entender a ordem da platina.');
    const primaryAlert = beforeItems.find(item => ['risk', 'warning'].includes(item?.tone)) || beforeItems[0] || null;
    const reviewAlert = !inputs.isVerified ? {
      title: 'Informação em revisão',
      detail: game?.verification_note || 'Este guia ainda aguarda validação editorial final.',
      tone: 'neutral',
      icon: 'fa-clipboard-check',
      label: 'Status'
    } : null;
    const alert = primaryAlert || reviewAlert || {
      title: 'Sem alerta crítico no topo',
      detail: 'Mesmo assim, leia o roadmap antes de marcar troféus soltos.',
      tone: 'soft',
      icon: 'fa-circle-check',
      label: 'Atenção principal'
    };

    return {
      cards,
      firstAction: {
        label: 'Primeiro passo recomendado',
        title: nextAction.title || 'Comece pelo roadmap',
        detail: compactGuideText(firstActionDetail, 'Abra o roadmap antes da checklist para entender a ordem da platina.', 180),
        icon: nextAction.focus === 'trophies' ? 'fa-list-check' : 'fa-route',
        focus: nextAction.focus || 'roadmap'
      },
      mainAlert: {
        label: 'Atenção principal',
        title: alert.title || 'Revise antes de começar',
        detail: compactGuideText(alert.detail, 'Leia os alertas do guia antes da primeira sessão.', 180),
        icon: alert.icon || 'fa-triangle-exclamation',
        tone: alert.tone || 'neutral'
      }
    };
  }

  function getQuickDecisionCard(cards = [], id = '') {
    return (Array.isArray(cards) ? cards : []).find(card => card?.id === id) || null;
  }

  function buildGuideShortcutModel(game = {}, viewModel = {}) {
    const quickDecision = buildGuideQuickDecisionModel(game, viewModel);
    const cards = quickDecision.cards || [];
    const missables = getQuickDecisionCard(cards, 'missables');
    const online = getQuickDecisionCard(cards, 'online');
    const dlc = getQuickDecisionCard(cards, 'dlc');
    const hasRoadmap = Array.isArray(viewModel.roadmap) ? viewModel.roadmap.length > 0 : Array.isArray(game?.roadmap) && game.roadmap.length > 0;
    const hasTrophies = Array.isArray(viewModel.trophies) ? viewModel.trophies.length > 0 : Array.isArray(game?.trophies) && game.trophies.length > 0;
    const hasRelated = true;
    const hasMissables = /tem perdiv|perdivel|perdive/.test(normalizeGuideSignalText(missables?.value || '')) && !/sem perdiv|informacao em revisao/.test(normalizeGuideSignalText(missables?.value || ''));
    const onlineValue = normalizeGuideSignalText(online?.value || '');
    const hasOnline = /online obrigatorio|online\/multiplayer/.test(onlineValue) && !/sem online obrigatorio|informacao em revisao/.test(onlineValue);
    const hasDlcInfo = Boolean(dlc?.detail || dlc?.value) && !/informacao em revisao|escopo nao informado/.test(normalizeGuideSignalText(dlc?.value || ''));

    return [
      { id: 'decision', label: 'Decisão rápida', action: 'quick', href: '#guidePlatinumSummaryPanel', icon: 'fa-bolt', show: true },
      { id: 'roadmap', label: 'Roadmap', action: 'roadmap', href: '#guideRoadmapPanel', icon: 'fa-route', show: hasRoadmap },
      { id: 'missables', label: 'Troféus perdíveis', action: 'missables', href: '#guideQuickCard-missables', icon: 'fa-triangle-exclamation', show: hasMissables },
      { id: 'checklist', label: 'Checklist', action: 'trophies', href: '#guideChecklistPanel', icon: 'fa-list-check', show: hasTrophies },
      { id: 'online', label: 'Troféus online', action: 'online', href: '#guideQuickCard-online', icon: 'fa-wifi', show: hasOnline },
      { id: 'dlc', label: 'DLC', action: 'dlc', href: '#guideQuickCard-dlc', icon: 'fa-layer-group', show: hasDlcInfo },
      { id: 'related', label: 'Jogos parecidos', action: 'related', href: '#guideRelatedPanel', icon: 'fa-gamepad', show: hasRelated }
    ].filter(item => item.show);
  }

  function buildGuideStartContextModel(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : (Array.isArray(game?.trophies) ? game.trophies : []);
    const roadmap = Array.isArray(viewModel.roadmap) ? viewModel.roadmap : (Array.isArray(game?.roadmap) ? game.roadmap : []);
    const inputs = getGuideVerdictInputs(game, { ...viewModel, trophies, roadmap });
    const quickDecision = buildGuideQuickDecisionModel(game, { ...viewModel, trophies, roadmap });
    const card = id => getQuickDecisionCard(quickDecision.cards, id);
    const missables = card('missables');
    const online = card('online');
    const coop = card('coop');
    const dlc = card('dlc');
    const items = [
      inputs.runs ? { icon: 'fa-rotate', label: 'Jogadas/campanhas', text: inputs.runs } : null,
      inputs.firstRunAdvice ? { icon: 'fa-person-running', label: 'Como começar', text: inputs.firstRunAdvice } : null,
      missables ? { icon: 'fa-triangle-exclamation', label: 'Perdíveis', text: `${missables.value}. ${missables.detail || ''}`.trim(), tone: /tem perdiv|informacao em revisao/.test(normalizeGuideSignalText(missables.value)) ? 'warning' : 'soft' } : null,
      online ? { icon: 'fa-wifi', label: 'Online', text: `${online.value}. ${online.detail || ''}`.trim(), tone: /obrigatorio|informacao em revisao/.test(normalizeGuideSignalText(online.value)) ? 'warning' : 'soft' } : null,
      coop ? { icon: 'fa-users', label: 'Coop', text: `${coop.value}. ${coop.detail || ''}`.trim(), tone: /obrigatorio|informacao em revisao/.test(normalizeGuideSignalText(coop.value)) ? 'warning' : 'soft' } : null,
      dlc ? { icon: 'fa-layer-group', label: 'DLC', text: `${dlc.value}. ${dlc.detail || ''}`.trim(), tone: /necessaria|no escopo|informacao em revisao/.test(normalizeGuideSignalText(dlc.value)) ? 'warning' : 'soft' } : null,
      quickDecision.mainAlert ? { icon: quickDecision.mainAlert.icon, label: 'Cuidado principal', text: `${quickDecision.mainAlert.title}. ${quickDecision.mainAlert.detail || ''}`.trim(), tone: quickDecision.mainAlert.tone || 'neutral' } : null
    ].filter(item => item && item.text).slice(0, 6).map(item => ({
      ...item,
      text: compactGuideText(item.text, '', 180)
    }));

    return {
      title: 'Antes de começar',
      detail: 'Use esta seção para entender o plano geral antes de seguir o roadmap.',
      items: items.length ? items : [{
        icon: 'fa-circle-info',
        label: 'Plano geral',
        text: 'Leia a decisão rápida e confira os alertas antes de iniciar. Depois siga o roadmap em ordem e use o checklist para acompanhar os troféus.',
        tone: 'neutral'
      }]
    };
  }

  function buildGuideRiskAlerts(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : [];
    const inputs = getGuideVerdictInputs(game, viewModel);
    const riskCounts = viewModel.riskCounts || getRiskCounts(trophies);
    const missableCount = countRealMissableTrophies(trophies);
    const network = getGuideNetworkRequirementModel(game, { ...viewModel, trophies });
    const onlineCount = network.onlineCount;
    const coopCount = network.coopCount;
    const hasOnline = network.hasOnline;
    const hasCoop = network.hasCoop;
    const difficultyCount = Number(riskCounts.difficulty || countGuideTrophyTag(trophies, 'difficulty') || 0);
    const grindCount = Number(riskCounts.grind || countGuideTrophyTag(trophies, 'grind') || (inputs.grind ? 1 : 0));
    const cleanupCount = Number(riskCounts.cleanup || countGuideTrophyTag(trophies, 'cleanup') || 0);
    const dlcText = firstGuideText(inputs.dlc);
    const alerts = [];

    const missableText = firstGuideText(inputs.missableSummary, game?.missable);
    const hasMissable = Boolean(missableCount || (!hasNegatedGuideRequirement(missableText) && hasMissableRiskText(missableText)));
    if (hasMissable) {
      alerts.push({
        icon: 'fa-triangle-exclamation',
        tone: 'risk',
        label: 'Perdíveis',
        title: 'Atenção: há troféus perdíveis.',
        detail: compactGuideText(missableText, `${missableCount || 1} ponto(s) precisam ser revisados antes de avançar demais.`, 150)
      });
    } else if (missableText) {
      alerts.push({
        icon: 'fa-shield-halved',
        tone: 'soft',
        label: 'Perdíveis',
        title: 'Sem perdíveis reais confirmados.',
        detail: compactGuideText(missableText, 'A platina não conta como perdível e não há bloqueio crítico marcado.', 150)
      });
    }
    if (onlineCount || coopCount) {
      alerts.push({
        icon: 'fa-wifi',
        tone: 'warning',
        label: hasOnline ? 'Online' : 'Coop',
        title: hasOnline ? 'Online/multiplayer no escopo.' : 'Coop obrigatorio.',
        detail: compactGuideText(inputs.online, hasOnline ? `${onlineCount || 1} objetivo(s) mencionam online ou multiplayer.` : 'A platina exige 2 jogadores; valide local/online antes de comecar.', 150)
      });
    }
    if (difficultyCount) {
      alerts.push({
        icon: 'fa-bolt',
        tone: 'warning',
        label: 'Dificuldade',
        title: 'Exige dificuldade específica.',
        detail: `${difficultyCount} troféu(s) pedem atenção mecânica ou condição de dificuldade.`
      });
    }
    if (grindCount || inputs.grind) {
      alerts.push({
        icon: 'fa-repeat',
        tone: 'warning',
        label: 'Grind',
        title: 'Planeje farm ou repetição.',
        detail: compactGuideText(inputs.grind, `${grindCount || 1} ponto(s) parecem envolver farm, rank, XP ou repetição.`, 150)
      });
    }
    if (cleanupCount || inputs.cleanupAdvice) {
      alerts.push({
        icon: 'fa-broom',
        tone: 'neutral',
        label: 'Cleanup',
        title: 'Deixe cleanup para a etapa certa.',
        detail: compactGuideText(inputs.cleanupAdvice, `${cleanupCount || 1} sinal(is) indicam limpeza planejada depois da campanha.`, 150)
      });
    }
    if (dlcText) {
      const normalizedDlc = normalizeGuideSignalText(dlcText);
      const isDlcOptional = /nao|sem|dispensa|desnecess/.test(normalizedDlc);
      alerts.push({
        icon: 'fa-layer-group',
        tone: isDlcOptional ? 'soft' : 'neutral',
        label: 'DLC',
        title: isDlcOptional ? 'DLC não necessária.' : 'Revise o escopo de DLC.',
        detail: compactGuideText(dlcText, 'O guia tem observação de DLC cadastrada.', 150)
      });
    }

    if (!alerts.length) {
      alerts.push({
        icon: 'fa-circle-check',
        tone: 'soft',
        label: 'Risco',
        title: 'Sem alerta crítico marcado antes da lista.',
        detail: 'Ainda assim, comece pelo roadmap para evitar cleanup fora de ordem.'
      });
    }

    return alerts.slice(0, 5);
  }

  function formatDisplayDate(value) {
    if (!value) return 'Sem data';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sem data';
    return date.toLocaleDateString('pt-BR');
  }

  function buildGuideCoverModel(game = {}, imageResolver = value => value || '/og-default.svg') {
    const posterSource = firstGuideText(game?.cover_image);
    const bannerSource = firstGuideText(game?.image);
    const derivedPosterSource = !posterSource ? deriveSteamLibraryCover(bannerSource) : '';
    const source = posterSource || derivedPosterSource || (isPlaceholderGuideImage(bannerSource) ? '' : bannerSource);
    const hasPoster = Boolean(posterSource || derivedPosterSource);
    const hasBannerFallback = !hasPoster && Boolean(source);

    return {
      source,
      image: source ? imageResolver(source) : '',
      backdropImage: hasBannerFallback ? imageResolver(bannerSource) : '',
      mode: hasPoster ? 'poster' : (hasBannerFallback ? 'banner' : 'fallback'),
      className: hasPoster ? 'atlas-guide-cover--poster' : (hasBannerFallback ? 'atlas-guide-cover--banner-fallback' : 'atlas-guide-cover--fallback'),
      usesCoverImage: hasPoster,
      usesBannerFallback: hasBannerFallback,
      alt: `Capa de ${firstGuideText(game?.name, 'Jogo')}`
    };
  }

  function deriveNextAction(game = {}, completedIds = []) {
    const trophies = Array.isArray(game.trophies) ? game.trophies : [];
    const completedSet = new Set(Array.isArray(completedIds) ? completedIds : []);
    const total = trophies.length;
    const completedCount = completedSet.size;
    const remaining = Math.max(total - completedCount, 0);
    const started = completedCount > 0;
    const pendingTrophies = trophies.filter(trophy => trophy && !completedSet.has(trophy.id));
    const firstPending = pendingTrophies[0] || null;
    const missablePending = pendingTrophies.find(isRealMissableTrophy);
    const spoilerPending = pendingTrophies.find(trophy => trophy && trophy.is_spoiler);
    const roadmapCount = Array.isArray(game.roadmap) ? game.roadmap.length : Number(game.roadmap_count || 0);

    if (!total) {
      return {
        kind: 'overview',
        title: 'Revisar a estrutura do guia',
        detail: 'Este jogo ainda precisa de checklist mais completo antes de virar rotina na biblioteca.',
        cta: 'Ver resumo',
        focus: 'header',
        trophyId: '',
        trophyName: ''
      };
    }

    if (remaining === 0) {
      return {
        kind: 'review',
        title: 'Confirmar o fechamento da platina',
        detail: 'Checklist concluído. Vale revisar a página e garantir que nada importante ficou sem validação final.',
        cta: 'Revisar 100%',
        focus: 'trophies',
        trophyId: '',
        trophyName: ''
      };
    }

    if (!started && roadmapCount > 0) {
      const readRoadmapFirst = shouldReadRoadmapFirst(game, trophies, Array.isArray(game.roadmap) ? game.roadmap : []);
      const hasMissableRoadmapRisk = Boolean(missablePending);
      const firstRunAdvice = firstGuideText(game?.first_run_advice, game?.quickDecision?.firstAction);
      if (String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-i') {
        return {
          kind: 'roadmap',
          title: 'Jogue a campanha coletando o máximo possível',
          detail: firstRunAdvice || 'Salve o cleanup de coletáveis, conversas e situacionais para a seleção de capítulos.',
          cta: 'Abrir roadmap',
          focus: 'roadmap',
          trophyId: firstPending?.id || '',
          trophyName: firstPending?.name || ''
        };
      }
      if (String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-ii') {
        return {
          kind: 'roadmap',
          title: 'Jogue a campanha explorando com calma',
          detail: firstRunAdvice || 'Deixe o cleanup de coletáveis, cofres, upgrades e situacionais para Chapter Select e NG+ parcial.',
          cta: 'Abrir roadmap',
          focus: 'roadmap',
          trophyId: firstPending?.id || '',
          trophyName: firstPending?.name || ''
        };
      }
      if (String(game?.slug || '').trim().toLowerCase() === 'subnautica') {
        return {
          kind: 'roadmap',
          title: 'Explore com calma e estabilize recursos',
          detail: firstRunAdvice || 'Construa uma base funcional, avance a história e faça saves manuais antes de grandes marcos.',
          cta: 'Abrir roadmap',
          focus: 'roadmap',
          trophyId: firstPending?.id || '',
          trophyName: firstPending?.name || ''
        };
      }
      if (String(game?.slug || '').trim().toLowerCase() === 'hades') {
        return {
          kind: 'roadmap',
          title: 'Comece pelas primeiras runs',
          detail: 'Faça as primeiras runs evoluindo a Mirror of Night, testando armas e avançando a história sem se preocupar com limpeza completa no início.',
          cta: 'Abrir roadmap',
          focus: 'roadmap',
          trophyId: firstPending?.id || '',
          trophyName: firstPending?.name || ''
        };
      }
      return {
        kind: readRoadmapFirst ? 'roadmap' : 'checklist',
        title: readRoadmapFirst
          ? (hasMissableRoadmapRisk ? 'Ler alertas antes do checklist' : 'Comece pelo roadmap')
          : 'Ir direto para o checklist',
        detail: readRoadmapFirst
          ? (firstRunAdvice || `Use as ${roadmapCount} etapa(s) do roadmap para iniciar sem retrabalho e evitar ordem errada logo no começo.`)
          : 'Este guia não aponta um bloqueio crítico forte no topo; abra a checklist e avance marcando o progresso.',
        cta: readRoadmapFirst ? (hasMissableRoadmapRisk ? 'Ler alertas e roadmap' : 'Abrir roadmap') : 'Ir para checklist',
        focus: readRoadmapFirst ? (hasMissableRoadmapRisk ? 'risks' : 'roadmap') : 'trophies',
        trophyId: firstPending?.id || '',
        trophyName: firstPending?.name || ''
      };
    }

    if (!started && firstPending) {
      return {
        kind: 'first-trophy',
        title: 'Marcar o primeiro troféu',
        detail: `Abra a lista e use ${firstPending.name} como ponto de partida para tirar o jogo do zero.`,
        cta: 'Ir ao primeiro troféu',
        focus: 'first-pending',
        trophyId: firstPending?.id || '',
        trophyName: firstPending.name || ''
      };
    }

    if (missablePending) {
      return {
        kind: 'missable',
        title: 'Revisar pendências sensíveis',
        detail: `Ainda existe pelo menos um objetivo crítico pendente. Priorize ${missablePending.name} antes de avançar sem checagem.`,
        cta: 'Ver pendência crítica',
        focus: 'first-pending',
        trophyId: missablePending?.id || '',
        trophyName: missablePending.name || ''
      };
    }

    if (spoilerPending) {
      return {
        kind: 'spoiler',
        title: 'Retomar a lista principal',
        detail: `Continue pelo próximo objetivo pendente, começando por ${spoilerPending.name}, com cuidado para não abrir spoiler antes da hora.`,
        cta: 'Continuar checklist',
        focus: 'first-pending',
        trophyId: spoilerPending?.id || '',
        trophyName: spoilerPending.name || ''
      };
    }

    return {
      kind: 'continue',
      title: 'Continuar os troféus pendentes',
      detail: firstPending
        ? `O próximo bom passo é voltar na lista e avançar em ${firstPending.name} para empurrar o progresso.`
        : 'Volte para a lista principal e conclua os troféus restantes em sequência.',
      cta: 'Continuar checklist',
      focus: 'first-pending',
      trophyId: firstPending?.id || '',
      trophyName: firstPending?.name || ''
    };
  }

  function buildPlatinumSummary(game = {}, viewModel = {}) {
    const timeEstimate = game?.time || 'Tempo não informado';
    const difficulty = game?.difficulty ? `${game.difficulty}/10` : 'não informada';
    const roadmapSteps = Number(viewModel?.roadmap?.length || 0);
    const total = Number(viewModel?.total || 0);
    const runs = String(game?.runs || '').trim();
    const riskCounts = viewModel.riskCounts || getRiskCounts(viewModel.trophies || []);
    const guidanceCounts = viewModel.guidanceCounts || buildGuidanceCounts(viewModel.trophies || [], riskCounts);
    const runsPhrase = runs ? `, com ${runs} e ${roadmapSteps} etapa(s) de roadmap` : `, com ${roadmapSteps} etapa(s) de roadmap`;
    const sentence = `Platina de ${timeEstimate}, dificuldade ${difficulty}${runsPhrase}.`;
    const statCards = [
      { label: 'Tempo estimado', value: timeEstimate, detail: 'Dado cadastrado no guia.' },
      { label: 'Dificuldade', value: difficulty, detail: 'Escala editorial do Atlas.' },
      { label: 'Total de troféus', value: `${total}`, detail: 'Calculado pela lista cadastrada.' },
      { label: 'Roadmap', value: `${roadmapSteps}`, detail: 'Etapas disponíveis antes da checklist.' }
    ];
    if (runs) statCards.push({ label: 'Runs recomendadas', value: runs, detail: 'Campo editorial cadastrado.' });
    if (guidanceCounts.criticalAlertsCount) statCards.push({ label: 'Alertas críticos', value: `${guidanceCounts.criticalAlertsCount}`, detail: 'Riscos reais de platina detectados.' });
    if (guidanceCounts.checklistTipsCount) statCards.push({ label: 'Dicas de checklist', value: `${guidanceCounts.checklistTipsCount}`, detail: 'Orientações comuns para progresso e cleanup.' });
    if (riskCounts.missable) statCards.push({ label: 'Perdíveis', value: `${riskCounts.missable}`, detail: 'Marcados ou citados no guia.' });
    if (riskCounts.spoiler) statCards.push({ label: 'Spoilers', value: `${riskCounts.spoiler}`, detail: 'Ocultos até você revelar.' });
    return { sentence, statCards };
  }

  function buildBeforeStartCards(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : [];
    const roadmap = Array.isArray(viewModel.roadmap) ? viewModel.roadmap : [];
    const riskCounts = viewModel.riskCounts || getRiskCounts(trophies);
    const missableCount = countRealMissableTrophies(trophies);
    const difficulty = Number(game?.difficulty || 0);
    const runs = String(game?.runs || '').trim();
    const guideText = String(`${runs} ${game?.missable || ''} ${getGuideRoadmapText(roadmap)}`).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const missableText = firstGuideText(game?.missable, game?.missable_summary);
    const missableNegated = hasNegatedGuideRequirement(missableText);
    const hasMissableRisk = Boolean(missableCount || riskCounts.missable || (!missableNegated && /perdivel|missable|perder|sem chapter|no chapter/.test(guideText)));
    const cards = [];

    if (runs || /multiplas|varias|multi-run|run|campanha dedicada|speedrun/.test(guideText) || riskCounts.run) {
      cards.push({ tag: 'Runs', title: runs || 'O guia menciona runs ou campanhas específicas', text: runs ? 'Use esta estrutura antes de misturar história, cleanup e restrições.' : 'Há sinais no roadmap, alerta ou troféus de que a ordem das runs muda o esforço.' });
    }
    if (hasMissableRisk) {
      cards.push({ tag: 'Perdíveis', title: `${missableCount || riskCounts.missable || 1} ponto(s) com risco de perda`, text: game?.missable || 'Revise os troféus marcados antes de avançar demais na campanha.' });
    }
    if (riskCounts.spoiler) cards.push({ tag: 'Spoiler', title: `${riskCounts.spoiler} troféu(s) escondem informação sensível`, text: 'Revele detalhes só quando fizer sentido para sua run atual.' });
    if (riskCounts.collectible) cards.push({ tag: 'Coletáveis', title: `${riskCounts.collectible} troféu(s) com sinal de coleta ou checklist`, text: 'Marque progresso desde cedo para evitar varrer áreas sem contexto no final.' });
    if (difficulty >= 7 || riskCounts.difficulty) cards.push({ tag: 'Dificuldade', title: difficulty >= 7 ? `Dificuldade ${difficulty}/10` : `${riskCounts.difficulty} troféu(s) exigem atenção mecânica`, text: 'Separe tempo para treino, rotas seguras e leitura dos pontos mais exigentes antes da execução.' });
    if (riskCounts.cleanup || /cleanup|limpeza|pos-jogo|post-game|deixe para o final/.test(guideText)) cards.push({ tag: 'Cleanup', title: `${riskCounts.cleanup || 1} sinal(is) de limpeza planejada`, text: 'Deixe o cleanup para o momento indicado pelo roadmap em vez de caçar pendências cedo demais.' });
    if (String(game?.grind || '').trim() || riskCounts.grind) cards.push({ tag: 'Grind', title: String(game?.grind || '').trim() || `${riskCounts.grind} troféu(s) parecem envolver repetição`, text: 'Planeje farm, rank, recursos ou repetição para não descobrir esse custo só no fim.' });
    if (!cards.length) cards.push({ tag: 'Leitura inicial', title: 'Sem alerta forte cadastrado antes da checklist', text: 'O guia não aponta um grande bloqueio editorial, mas o roadmap ainda deve vir antes da lista completa.' });
    return cards;
  }

  function buildRouteChangingTrophies(trophies = []) {
    const trophyById = new Map((Array.isArray(trophies) ? trophies : []).map(trophy => [trophy?.id, trophy]).filter(([id]) => id));
    const eldenCriticalIds = ['er_elden_lord', 'er_age_of_stars', 'er_frenzied_flame', 'er_legendary_armaments', 'er_fortissax'];
    if (eldenCriticalIds.every(id => trophyById.has(id))) {
      const copyTags = (ids, tone = 'risk') => ids.map(label => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone }));
      return [
        {
          id: 'er_elden_lord',
          name: trophyById.get('er_elden_lord')?.name || 'Elden Lord',
          type: 'Perdível / Final / Risco de run / Spoiler',
          text: 'Final com troféu. Planeje backup de save antes da decisão final se quiser reduzir runs.',
          tags: copyTags(['Perdível / Final / Risco de run / Spoiler']),
          score: 99
        },
        {
          id: 'er_age_of_stars',
          name: trophyById.get('er_age_of_stars')?.name || 'Age of the Stars',
          type: 'Perdível / Final / Spoiler',
          text: 'Final com troféu ligado à quest da Ranni. Avance a questline antes da decisão final.',
          tags: copyTags(['Perdível / Final / Spoiler']),
          score: 98
        },
        {
          id: 'er_frenzied_flame',
          name: trophyById.get('er_frenzied_flame')?.name || 'Lord of Frenzied Flame',
          type: 'Perdível / Final / Spoiler',
          text: 'Final com troféu ligado aos Three Fingers. Pode conflitar com outros finais no mesmo save se você não planejar a rota.',
          tags: copyTags(['Perdível / Final / Spoiler']),
          score: 97
        },
        {
          id: 'er_legendary_armaments',
          name: trophyById.get('er_legendary_armaments')?.name || 'Legendary Armaments',
          type: 'Perdível / Lendário / Coletável',
          text: 'Inclui Bolt of Gransax, que deve ser coletado antes da transformação de Leyndell.',
          tags: copyTags(['Perdível / Lendário / Coletável']),
          score: 96
        },
        {
          id: 'er_fortissax',
          name: trophyById.get('er_fortissax')?.name || 'Lichdragon Fortissax',
          type: 'Perdível / Chefe / Spoiler',
          text: 'Chefe ligado à quest da Fia. Evite encerrar a linha dela de forma hostil antes da luta.',
          tags: copyTags(['Perdível / Chefe / Spoiler']),
          score: 95
        }
      ];
    }

    const requiemAttentionIds = [
      'rerequiem_speed_demon',
      'rerequiem_minimalist',
      'rerequiem_grace_and_goliath',
      'rerequiem_hope_and_requiem',
      'rerequiem_master_craftsman'
    ];
    if (requiemAttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 'rerequiem_speed_demon',
          name: trophyById.get('rerequiem_speed_demon')?.name || 'Speed Demon',
          type: 'Perdível / Risco de run',
          text: 'Speedrun de campanha. Separe uma run dedicada, use saves manuais e não misture com exploração longa.',
          tags: [attentionTag('Perdível / Risco de run', 'risk')],
          score: 99
        },
        {
          id: 'rerequiem_minimalist',
          name: trophyById.get('rerequiem_minimalist')?.name || 'Minimalist',
          type: 'Perdível / Risco de run',
          text: 'Restrição de Blood Collector. Planeje uma campanha dedicada e confirme a regra antes de avançar demais.',
          tags: [attentionTag('Perdível / Risco de run', 'risk')],
          score: 98
        },
        {
          id: 'rerequiem_grace_and_goliath',
          name: trophyById.get('rerequiem_grace_and_goliath')?.name || 'Grace and Goliath',
          type: 'Spoiler / Risco de run',
          text: 'Objetivo situacional com spoiler. Acompanhe por janela ou save, sem tratar automaticamente como perdível definitivo.',
          tags: [attentionTag('Spoiler / Risco de run', 'spoiler')],
          score: 97
        },
        {
          id: 'rerequiem_hope_and_requiem',
          name: trophyById.get('rerequiem_hope_and_requiem')?.name || 'Hope and Requiem',
          type: 'Perdível / Spoiler',
          text: 'Escolha final sensível. Mantenha save manual antes da decisão para reduzir retrabalho e comparar os desfechos com segurança.',
          tags: [attentionTag('Perdível / Spoiler', 'risk')],
          score: 96
        },
        {
          id: 'rerequiem_master_craftsman',
          name: trophyById.get('rerequiem_master_craftsman')?.name || 'Master Craftsman',
          type: 'Coletável / Checklist',
          text: 'Objetivo de crafting/checklist. Use save manual para criar os itens necessários e recarregar se quiser preservar materiais.',
          tags: [attentionTag('Coletável / Checklist', 'partial')],
          score: 95
        }
      ];
    }

    const weights = { missable: 7, spoiler: 5, difficulty: 5, collectible: 4, grind: 4, run: 4, cleanup: 3, story: 1 };
    return trophies
      .filter(Boolean)
      .map(trophy => {
        const tags = getTrophyRiskTags(trophy);
        const score = tags.reduce((total, tag) => total + (weights[tag.id] || 0), 0);
        return {
          id: trophy?.id || '',
          name: trophy?.name || 'Troféu',
          type: trophy?.type || 'Troféu',
          text: trophy?.is_spoiler ? 'Este troféu está marcado como spoiler. Revele os detalhes na lista completa quando isso não atrapalhar a campanha.' : (trophy?.tip || trophy?.description || 'Revise este troféu antes de começar.'),
          tags,
          score
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), 'pt-BR'))
      .slice(0, 8);
  }

  function buildGuidanceCounts(trophies = [], riskCounts = null) {
    const counts = riskCounts || getRiskCounts(trophies);
    const criticalAlertsCount = countRealMissableTrophies(trophies);
    const totalGuidanceCount = Number(counts.alertCount || 0);
    const checklistTipsCount = Math.max(totalGuidanceCount - criticalAlertsCount, 0);
    return {
      criticalAlertsCount,
      checklistTipsCount,
      totalGuidanceCount
    };
  }

  function buildDecisionRoadmapStages(viewModel = {}) {
    const steps = Array.isArray(viewModel.roadmap) ? viewModel.roadmap : [];
    return steps.map((step, index) => normalizeRoadmapStep(step, index, steps.length));
  }

  function isRoadmapPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function stripRoadmapStepPrefix(value = '') {
    return String(value || '')
      .replace(/^\s*(?:Etapa|Passo)\s+\d+\s*(?:[-:.\u2013\u2014\uFFFD]\s*)?/i, '')
      .trim();
  }

  function isGenericRoadmapTitle(value = '') {
    const normalized = normalizeGuideSignalText(String(value || '').trim());
    return !normalized
      || /^etapa\s+\d+$/.test(normalized)
      || /^passo\s+\d+$/.test(normalized)
      || /^(comece aqui|comece pela rota segura|plano|planeje a proxima run)$/.test(normalized);
  }

  function isGenericRoadmapFocus(value = '') {
    const normalized = normalizeGuideSignalText(String(value || '').trim());
    return !normalized
      || /^etapa(?:\s+\d+)?$/.test(normalized)
      || /^passo(?:\s+\d+)?$/.test(normalized)
      || /^(plano|roadmap|comece aqui|comece pela rota segura|planeje a proxima run)$/.test(normalized);
  }

  function safeRoadmapText(value = '', seen = new WeakSet()) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
      const text = value.replace(/\s+/g, ' ').trim();
      return text === '[object Object]' ? '' : text;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    if (Array.isArray(value)) return value.map(item => safeRoadmapText(item, seen)).filter(Boolean).join('; ');
    if (!isRoadmapPlainObject(value) || seen.has(value)) return '';
    seen.add(value);
    const directKeys = ['text', 'label', 'title', 'objective', 'summary', 'description', 'detail', 'goal', 'name', 'value'];
    for (const key of directKeys) {
      const text = safeRoadmapText(value[key], seen);
      if (text) return text;
    }
    return Object.values(value).map(item => safeRoadmapText(item, seen)).filter(Boolean).join('; ');
  }

  function isMeaningfullyDifferentRoadmapText(value = '', compareTo = '') {
    const left = normalizeGuideSignalText(value);
    const right = normalizeGuideSignalText(compareTo);
    return Boolean(left && right && left !== right && !right.includes(left) && !left.includes(right));
  }

  function normalizeRoadmapActions(value = '') {
    if (isRoadmapPlainObject(value)) {
      const nested = [value.actions, value.items, value.steps, value.checklist, value.goals]
        .flatMap(item => normalizeRoadmapActions(item))
        .filter(Boolean);
      if (nested.length) return nested;
      return Object.values(value).flatMap(item => normalizeRoadmapActions(item)).filter(Boolean);
    }
    if (Array.isArray(value)) {
      return value.flatMap(item => normalizeRoadmapActions(item)).filter(Boolean);
    }
    return safeRoadmapText(value)
      .split(/\s*(?:;|\n|â€¢|•)\s*/)
      .map(item => cleanRoadmapFieldText(item).replace(/^[-â€¢•]\s*/, ''))
      .filter(Boolean);
  }

  function parseJsonRoadmapStep(value = '') {
    const text = String(value || '').trim();
    if (!text || !/^\{[\s\S]*\}$/.test(text)) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function cleanRoadmapFieldText(value = '') {
    return safeRoadmapText(value)
      .replace(/\s*\|\s*/g, ' ')
      .replace(/\b(title|focus|objective|actions|warning|note|observation|observacao|result|plan|summary|description|goal|goals|checklist)\s*:\s*/gi, '')
      .replace(/^\s*\[object Object\]\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isSerializedRoadmapText(value = '') {
    const text = safeRoadmapText(value);
    return /\b(title|focus|objective|actions|warning|note|observation|observacao|result)\s*:/i.test(text)
      && (/\s\|\s/.test(text) || /\bobjective\s*:/i.test(text) || /\bactions\s*:/i.test(text));
  }

  function findStructuredRoadmapPayload(source = {}) {
    if (!isRoadmapPlainObject(source)) return null;
    if (source.title || source.focus || source.objective || source.actions || source.warning || source.result) return source;
    const candidates = [
      source.serialized,
      source.plan,
      source.description,
      source.summary,
      source.objective,
      source.detail,
      source.goal,
      source.goals,
      source.checklist
    ];
    for (const candidate of candidates) {
      if (isRoadmapPlainObject(candidate)) {
        const nested = findStructuredRoadmapPayload(candidate);
        if (nested) return nested;
        continue;
      }
      if (typeof candidate !== 'string' || !isSerializedRoadmapText(candidate)) continue;
      const jsonStep = parseJsonRoadmapStep(candidate);
      if (jsonStep) return findStructuredRoadmapPayload(jsonStep) || jsonStep;
      const structured = parseStructuredRoadmapStep(candidate);
      if (structured) return structured;
    }
    return null;
  }

  function pickRoadmapText(...values) {
    const unique = [];
    values
      .map(value => safeRoadmapText(value))
      .filter(value => value && !isSerializedRoadmapText(value))
      .map(cleanRoadmapFieldText)
      .forEach(value => {
        if (value && !unique.some(existing => !isMeaningfullyDifferentRoadmapText(value, existing))) unique.push(value);
      });
    return unique.find(Boolean) || '';
  }

  function normalizeRoadmapStep(step = {}, index = 0, total = 1) {
    const jsonStep = typeof step === 'string' ? parseJsonRoadmapStep(step) : null;
    const source = jsonStep || step;
    const raw = typeof source === 'string'
      ? source
      : safeRoadmapText(source?.description || source?.detail || source?.objective || source?.plan || source?.summary || source?.goal || source?.title || source?.name || '');
    const isObject = isRoadmapPlainObject(source);
    const structured = typeof source === 'string'
      ? parseStructuredRoadmapStep(raw)
      : findStructuredRoadmapPayload(source);
    const relatedTrophies = isObject
      ? (Array.isArray(source?.trophies) ? source.trophies : (Array.isArray(source?.relatedTrophies) ? source.relatedTrophies : []))
      : [];
    const titleCandidates = [
      structured?.title,
      isObject ? source.title : '',
      isObject ? source.name : '',
      isObject ? source.label : '',
      isObject && isRoadmapPlainObject(source.plan) ? source.plan.title : '',
      isObject && isRoadmapPlainObject(source.summary) ? source.summary.title : '',
      isObject && isRoadmapPlainObject(source.description) ? source.description.title : '',
      isObject && isRoadmapPlainObject(source.detail) ? source.detail.title : '',
      isObject && isRoadmapPlainObject(source.goal) ? source.goal.title : ''
    ].map(cleanRoadmapFieldText).filter(Boolean);
    const rawTitleField = titleCandidates.find(candidate => !isGenericRoadmapTitle(candidate)) || titleCandidates[0] || '';
    const titleIsStepLabel = /^Etapa\s+\d+$/i.test(rawTitleField) || /^Passo\s+\d+$/i.test(rawTitleField);
    const title = titleIsStepLabel ? '' : stripRoadmapStepPrefix(rawTitleField);
    const rawFocus = cleanRoadmapFieldText(structured?.focus || (isObject ? (source.focus || source.tag || source.category) : '') || '');
    const rawCategory = cleanRoadmapFieldText(isObject ? (source.category || source.type || source.phase || (titleIsStepLabel ? source.tag : '')) : '');
    const explicitCategory = isGenericRoadmapFocus(rawCategory) ? '' : rawCategory;
    const explicitFocus = isGenericRoadmapFocus(rawFocus) ? '' : rawFocus;
    const focusCandidate = explicitFocus || (titleIsStepLabel ? '' : explicitCategory);
    const displayTitle = titleIsStepLabel && explicitFocus ? explicitFocus : title;
    const focus = isGenericRoadmapFocus(focusCandidate) ? '' : focusCandidate;
    const objective = pickRoadmapText(
      structured?.objective,
      isObject ? source.objective : '',
      isObject ? source.goal : '',
      isObject ? source.description : '',
      isObject ? source.detail : '',
      isObject ? source.summary : '',
      isObject ? source.plan : ''
    );
    const actions = normalizeRoadmapActions(structured?.actions || (isObject ? (source.actions || source.checklist || source.goals) : []))
      .map(cleanRoadmapFieldText)
      .filter(Boolean);
    const warning = cleanRoadmapFieldText(structured?.warning || (isObject ? source.warning : '') || '');
    const note = cleanRoadmapFieldText(structured?.note || (isObject ? (source.note || source.observation || source.observacao) : '') || '');
    const result = cleanRoadmapFieldText(structured?.result || (isObject ? source.result : '') || '');
    const risk = cleanRoadmapFieldText(warning || (isObject ? source.risk : '') || '');
    const clean = stripRoadmapStepPrefix(cleanRoadmapFieldText(objective || (isSerializedRoadmapText(raw) ? structured?.objective : raw) || ''));
    const explicitTitleCandidate = displayTitle || (titleIsStepLabel ? '' : titleCandidates.find(candidate => !isGenericRoadmapTitle(candidate)) || '');
    const explicitTitle = isGenericRoadmapTitle(explicitTitleCandidate) ? '' : explicitTitleCandidate;
    const signalText = [displayTitle, focus, explicitCategory, clean, ...actions, warning, note].filter(Boolean).join(' ');
    const inferredCategory = classifyRoadmapStage(signalText || clean);
    const category = explicitCategory ? { ...inferredCategory, label: explicitCategory } : inferredCategory;
    const inferredTitleCandidate = stripRoadmapStepPrefix(explicitTitle || inferRoadmapStageTitle(clean, index, total, explicitTitle));
    const inferredTitle = isGenericRoadmapTitle(inferredTitleCandidate) ? '' : inferredTitleCandidate;
    const fallbackObjective = clean || actions[0] || inferredTitle || 'Siga esta etapa do roadmap.';
    const isStructured = Boolean(structured || jsonStep || (isObject && (title || focus || objective || actions.length || warning || result)));
    return {
      number: index + 1,
      title: inferredTitle || 'Rota da platina',
      category,
      description: fallbackObjective,
      objective: fallbackObjective,
      focus,
      actions,
      warning,
      note,
      result,
      risk,
      relatedTrophies: relatedTrophies.map(item => cleanRoadmapFieldText(item)).filter(Boolean),
      isStructured
    };
  }

  function hasUnsafeRoadmapPersistenceText(value = '') {
    const text = safeRoadmapText(value);
    if (!text) return true;
    return /\[object Object\]/i.test(text)
      || /\b(title|focus|objective|actions|warning|result)\s*:/i.test(text)
      || /\s\|\s/.test(text);
  }

  function isPureGenericRoadmapText(value = '') {
    const normalized = normalizeGuideSignalText(cleanRoadmapFieldText(value));
    return !normalized
      || /^etapa\s+\d+$/.test(normalized)
      || /^passo\s+\d+$/.test(normalized)
      || /^(etapa|passo|comece aqui|comece pela rota segura|planeje a proxima run|plano|roadmap)$/.test(normalized);
  }

  function isUsefulRoadmapSaveText(value = '') {
    const text = cleanRoadmapFieldText(value);
    return Boolean(text && !hasUnsafeRoadmapPersistenceText(text) && !isPureGenericRoadmapText(text));
  }

  function normalizeRoadmapForSave(roadmap = []) {
    if (!Array.isArray(roadmap)) return [];
    return roadmap
      .map((step, index) => normalizeRoadmapStep(step, index, roadmap.length))
      .map(step => {
        const title = isUsefulRoadmapSaveText(step.title) ? cleanRoadmapFieldText(step.title) : '';
        const focus = isUsefulRoadmapSaveText(step.focus) ? cleanRoadmapFieldText(step.focus) : '';
        const objective = isUsefulRoadmapSaveText(step.objective) ? cleanRoadmapFieldText(step.objective) : '';
        const actions = (Array.isArray(step.actions) ? step.actions : [])
          .map(cleanRoadmapFieldText)
          .filter(isUsefulRoadmapSaveText);
        const warning = isUsefulRoadmapSaveText(step.warning) ? cleanRoadmapFieldText(step.warning) : '';
        const result = isUsefulRoadmapSaveText(step.result) ? cleanRoadmapFieldText(step.result) : '';
        return {
          title,
          focus,
          objective,
          actions,
          warning,
          result
        };
      })
      .filter(step => step.title && (step.objective || step.actions.length));
  }

  function isValidRoadmap(roadmap = []) {
    if (!Array.isArray(roadmap) || roadmap.length === 0 || roadmap.length > 40) return false;
    const hasUnsafeRawValue = roadmap.some(step => {
      if (typeof step === 'string') return hasUnsafeRoadmapPersistenceText(step) || isPureGenericRoadmapText(step);
      if (!isRoadmapPlainObject(step)) return true;
      const values = [
        step.title,
        step.focus,
        step.objective,
        step.summary,
        step.description,
        step.plan,
        step.warning,
        step.result,
        ...(Array.isArray(step.actions) ? step.actions : [])
      ];
      const texts = values
        .filter(value => value !== null && value !== undefined)
        .filter(value => safeRoadmapText(value));
      if (texts.length && texts.every(value => !isRoadmapPlainObject(value) && !Array.isArray(value) && isPureGenericRoadmapText(value))) return true;
      return texts.some(value => {
        if (isRoadmapPlainObject(value) || Array.isArray(value)) return false;
        return hasUnsafeRoadmapPersistenceText(value);
      });
    });
    if (hasUnsafeRawValue) return false;
    const normalized = normalizeRoadmapForSave(roadmap);
    if (normalized.length !== roadmap.length) return false;
    return normalized.every(step => step.title && (step.objective || step.actions.length));
  }

  function parseStructuredRoadmapStep(value = '') {
    const text = safeRoadmapText(value);
    if (!/title\s*:/i.test(text) || !/objective\s*:/i.test(text)) return null;

    const fields = {};
    const matches = [...text.matchAll(/(?:^|\s\|\s)(title|focus|objective|actions|warning|note|observation|observacao|result):\s*([\s\S]*?)(?=\s\|\s(?:title|focus|objective|actions|warning|note|observation|observacao|result):|$)/gi)];
    for (const match of matches) {
      fields[match[1].toLowerCase()] = String(match[2] || '').trim();
    }
    if (!fields.title || !fields.objective) return null;

    return {
      title: fields.title,
      focus: fields.focus || '',
      objective: fields.objective,
      actions: String(fields.actions || '')
        .split(/\s*;\s*/)
        .map(item => item.trim().replace(/^[-•]\s*/, ''))
        .filter(Boolean),
      warning: fields.warning || '',
      note: fields.note || fields.observation || fields.observacao || '',
      result: fields.result || ''
    };
  }

  function classifyRoadmapStage(text = '') {
    const normalized = normalizeGuideSignalText(text);
    const networkNegated = /nao .*online|nao .*coop|nao e online|sem online|sem coop|offline|online opcional|coop opcional|co-op opcional|fora dos requisitos obrigatorios/.test(normalized);
    if (/limpeza final|cleanup|fechamento|desafios especificos/.test(normalized)) {
      return { id: 'cleanup', label: 'Cleanup', icon: 'fa-broom', tone: 'neutral' };
    }
    if (!networkNegated && /coop|co-op|2 jogadores|dois jogadores|dupla|segundo jogador/.test(normalized)) {
      return { id: 'online', label: 'Coop', icon: 'fa-users', tone: 'warning' };
    }
    if (!networkNegated && /online|multiplayer|\bsos\b|guild card|guild cards/.test(normalized)) {
      return { id: 'online', label: 'Online', icon: 'fa-wifi', tone: 'warning' };
    }
    if (/(historia|new game\+|ng\+).*(historia|new game\+|ng\+)|comece pela campanha|campanha principal|primeiras runs|prologo|atos|high rank/.test(normalized) && !/farm principal|limpeza final/.test(normalized)) {
      return { id: 'story', label: 'História', icon: 'fa-book-open', tone: 'soft' };
    }
    if (/colet|colecion|journal|journals|disco|discos|lost gestral|lost gestrals|old key|vida endemica|petricanths|crake|hercudrome|rune|runes|blueprints/.test(normalized)) {
      return { id: 'collectibles', label: 'Coletáveis', icon: 'fa-map-pin', tone: 'neutral' };
    }
    if (/boss stem cell|stem cells|bsc|endgame|hunter rank|rank 100|chefes? sem dano|chefes? opcionais?|simon|clea|serpenphare|sprong|endless tower|hand of the king|throne room|elder dragon|temperad|level 99|nivel 99/.test(normalized)) {
      return { id: 'endgame', label: 'Endgame', icon: 'fa-mountain-sun', tone: 'warning' };
    }
    if (/colet|colecion|journal|journals|disco|discos|lost gestral|lost gestrals|old key|vida endemica|petricanths|crake|hercudrome|rune|runes|blueprints/.test(normalized)) {
      return { id: 'collectibles', label: 'Coletáveis', icon: 'fa-map-pin', tone: 'neutral' };
    }
    if (/coroa|coroas|crown|crowns|grind|farm|rng|100 elites|armas|habilidades/.test(normalized)) {
      return { id: 'grind', label: 'Grind', icon: 'fa-repeat', tone: 'warning' };
    }
    if (/historia|campanha|prologo|ato|atos|run|runs|primeiras runs|spring meadows|monolith|paintress|back to lumiere/.test(normalized)) {
      return { id: 'story', label: 'História', icon: 'fa-book-open', tone: 'soft' };
    }
    return { id: 'plan', label: 'Plano', icon: 'fa-route', tone: 'soft' };
  }

  function inferRoadmapStageTitle(text = '', index = 0, total = 1, explicitTitle = '') {
    const explicit = String(explicitTitle || '').trim();
    if (explicit && !/^Etapa\s+\d+$/i.test(explicit)) return explicit;

    const clean = String(text || '').trim();
    const normalized = clean.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (/void heart/.test(normalized) && /the hollow knight/.test(normalized)) return 'Garanta o final base antes de Void Heart';
    if (/112%|pure completion/.test(normalized)) return 'Feche 112% e Pure Completion';
    if (/pantheon of hallownest|embrace the void/.test(normalized)) return 'Treine Godhome e Pantheon of Hallownest';
    if (/grimm troupe|nightmare king|trial of the fool|colosseum/.test(normalized)) return 'Limpe Trials, chefes opcionais e Grimm';
    if (/glitching remains|chapeu|chapeus|chapter select|selecao de capitulos/.test(normalized)) return /six|twenty-six|palm of my hand|how do i look/.test(normalized) ? 'Feche cumulativos com Six' : 'Limpe coletáveis por seleção de capítulos';
    if (/25 minigames|minigame megalomania/.test(normalized)) return 'Colete os 25 minigames';
    if (/platforming prodigy|meditation maestro|force triangulated/.test(normalized)) return 'Limpe troféus específicos restantes';
    if (/coop|co-op|2 jogadores|dois jogadores|dupla|segundo jogador|cody|may/.test(normalized) && !/sos|guild card/.test(normalized)) return index === 0 ? 'Comece a campanha em coop' : 'Coordene a etapa com a dupla';
    if (/prisao|fazenda|parque de trailers|galpao|hospital|the dip|in sync|all the ways out|piano|banjo|baseball|fliperama|moto|helicoptero|balanco|cata-vento/.test(normalized)) return 'Revise eventos opcionais por capítulo';

    if (/lake of nine|veithurgard|drag|wayward spirits|brok|sindri/.test(normalized)) return 'Limpe regiões e favores';
    if (/checklist/.test(normalized) && /odin|ravens|corvo|corvos|colet|artefatos|shrines|nornir/.test(normalized)) return 'Marque coletáveis no checklist';
    if (/valquir|valkyrie queen|valkyries/.test(normalized)) return 'Feche valquírias no pós-game';
    if (/muspelheim|niflheim|mist echoes|trials/.test(normalized) && /build|equip|upgrade|fortaleca|fortaleça|recursos/.test(normalized)) return 'Prepare Muspelheim e Niflheim';
    if (/limpeza final/.test(normalized)) return 'Feche cleanup e pendências finais';
    if (/comece pela campanha|campanha principal/.test(normalized)) return 'Avance campanha e capture cedo';
    if (/primeiras runs|rune|runes|blueprint|collector/.test(normalized)) return 'Aprenda runs e libere runas';
    if (/historia/.test(normalized) && /new game\+|ng\+/.test(normalized)) return 'Termine história antes do NG+';
    if (/prologo/.test(normalized) && /old key|mime|lumiere|maelle/.test(normalized)) return 'Garanta prólogo, Old Key e Mime';
    if (/maelle|relac/.test(normalized)) return 'Trave relações e Maelle';
    if (/new game\+|ng\+|relacoes/.test(normalized)) return 'Limpe pendências antes do NG+';
    if (/boss stem cell|stem cells|bsc/.test(normalized)) return 'Progrida Boss Stem Cells';
    if (/hand of the king|throne room/.test(normalized)) return 'Derrote Hand of the King';
    if (/hunter rank|rank 100|temperad|elder dragon/.test(normalized)) return 'Entre no endgame e HR 100';
    if (/\bsos\b|guild card/.test(normalized)) return 'Resolva online e Guild Cards cedo';
    if (!/nao exige online|nao ha exigencia online|sem online/.test(normalized) && /online|multiplayer/.test(normalized)) return 'Resolva requisitos online cedo';
    if (/coop|co-op/.test(normalized)) return 'Coordene a etapa em coop';
    if (/vida endemica|petricanths|crake|hercudrome/.test(normalized)) return 'Capture vida endêmica rara';
    if (/journals|journal|discos|lost gestral|nevron|paint cages/.test(normalized)) return 'Complete coletáveis antes do endgame';
    if (/coroa|coroas|crown|crowns/.test(normalized)) return 'Farme coroas miniatura e gigantes';
    if (/desafios especificos|desafio|challenge|cursed sword|equipamento inicial/.test(normalized)) return 'Resolva desafios opcionais';
    if (/cleanup|limpeza final|limpeza|pendente|pendencias/.test(normalized)) return 'Feche cleanup e pendências finais';
    if (/high rank|pesquisas|investigacoes/.test(normalized) && /monster|hunter|monstro|acampamento|armadura/.test(normalized)) return 'Libere High Rank e pesquisas';
    if (/coroa|coroas|crown|crowns/.test(normalized)) return 'Farme coroas miniatura e gigantes';
    if (/vida endemica|petricanths|crake|hercudrome/.test(normalized)) return 'Capture vida endêmica rara';
    if (/hunter rank|rank 100|temperad|elder dragon/.test(normalized)) return 'Entre no endgame e HR 100';
    if (/\bsos\b|guild card/.test(normalized)) return 'Resolva online e Guild Cards cedo';
    if (!/nao exige online|nao ha exigencia online|sem online/.test(normalized) && /online|multiplayer/.test(normalized)) return 'Resolva requisitos online cedo';
    if (/coop|co-op/.test(normalized)) return 'Coordene a etapa em coop';
    if (/journals|journal|discos|lost gestral|nevron|paint cages/.test(normalized)) return 'Complete coletáveis antes do endgame';
    if (/chefes sem dano|sem dano|flawless|boss|chefe/.test(normalized)) return 'Treine chefes sem dano';
    if (/desafio|challenge|cursed sword|equipamento inicial/.test(normalized)) return 'Resolva desafios opcionais';
    if (/farm|grind|rng|\brank\b|\bxp\b|\bnivel\b|\blevel\b/.test(normalized)) return 'Planeje o grind principal';
    if (/run|campanha|historia|new game|ng\+?/.test(normalized)) return index === 0 ? 'Avance a campanha principal' : 'Continue a rota principal';
    if (/final|platina|100%|cem por cento/.test(normalized) || index === total - 1) return 'Fechamento e revisão final';
    if (index === 0) return 'Rota inicial da platina';

    const firstClause = clean.split(/[.;:]/).map(part => part.trim()).find(Boolean) || clean;
    if (firstClause && firstClause.length <= 64) return firstClause;
    if (firstClause) return `${firstClause.slice(0, 61).trimEnd()}...`;
    return 'Rota da platina';
  }

  function buildRoadmapStages(viewModel = {}) {
    const steps = Array.isArray(viewModel.roadmap) ? viewModel.roadmap : [];
    return steps.map((step, index) => {
      const normalized = normalizeRoadmapStep(step, index, steps.length);
      const clean = String(normalized.objective || normalized.description || normalized.title || 'Etapa').trim();
      const titleText = normalized.title || clean;
      const title = titleText.length > 72 ? `${titleText.slice(0, 69).trimEnd()}...` : titleText;
      let cue = 'Use esta etapa como bloco principal antes de avançar para a próxima.';
      if (index === 0) cue = 'Comece por aqui para alinhar rota, risco e ritmo antes de investir várias horas.';
      else if (index === steps.length - 1) cue = 'Feche por aqui com cleanup, revisão final e validação do que ficou pendente.';
      else if (/online|multiplayer|coop/i.test(clean)) cue = 'Planeje essa parte cedo para não depender de fila, parceiro ou janela ruim depois.';
      else if (/cleanup|colet|colecion|farm|grind/i.test(clean)) cue = 'Entre nesta etapa quando a campanha principal já estiver estabilizada e o checklist fizer mais sentido.';
      else if (/run|campanha|hist[oó]ria|new game|ng\+?/i.test(clean)) cue = 'Trate esta etapa como o eixo da run principal e evite desviar sem necessidade.';
      return { number: index + 1, title, detail: clean, cue };
    });
  }

  function buildContextualFaq(game = {}, viewModel = {}) {
    const name = String(game?.name || 'este jogo').trim() || 'este jogo';
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : (Array.isArray(game?.trophies) ? game.trophies : []);
    const roadmap = Array.isArray(viewModel.roadmap) ? viewModel.roadmap : (Array.isArray(game?.roadmap) ? game.roadmap : []);
    const riskCounts = viewModel.riskCounts || getRiskCounts(trophies);
    const inputs = getGuideVerdictInputs(game, { ...viewModel, trophies, roadmap });
    const network = getGuideNetworkRequirementModel(game, { ...viewModel, trophies, roadmap });
    const dlcScope = buildGuideDlcScopeModel(game, inputs);
    const combinedText = getGuideCombinedPlanningText(game, { ...viewModel, trophies, roadmap });
    const missableText = firstGuideText(inputs.missableSummary, game?.missable);
    const missableCount = countRealMissableTrophies(trophies);
    const hasMissable = Boolean(missableCount || (!hasNegatedGuideRequirement(missableText) && hasMissableRiskText(missableText)));
    const missableReview = !missableText || (!hasMissable && hasGuideReviewSignal(missableText));
    const onlineReview = !inputs.online || (!network.hasOnline && hasGuideOnlineReviewSignal(inputs.online));
    const coopReview = (!inputs.online && !combinedText) || (!network.hasCoop && /coop|co-op|2 jogadores|dois jogadores|segundo jogador/.test(normalizeGuideSignalText(combinedText)) && hasGuideReviewSignal(combinedText));
    const dlcReview = !inputs.dlc || (!/complete|warning/.test(String(dlcScope.tone || '')) && hasGuideReviewSignal(inputs.dlc));
    const difficulty = Number(inputs.difficulty || 0);
    const timeLabel = inputs.timeLabel && inputs.timeLabel !== 'Tempo não informado' ? inputs.timeLabel : '';
    const dlcNormalized = normalizeGuideSignalText(firstGuideText(inputs.dlc, dlcScope.detail));
    const dlcNotRequired = /lista base|jogo base|base game|sem dlc|nao inclui|nao foram adicionados|nao foi misturado|dlc nao necessaria|nao e necessaria|nao ha dlc|fora do escopo|fica fora|ficam fora|entrada separada/.test(dlcNormalized);
    const dlcRequired = /necessaria|obrigatoria|dlc no escopo|expansao|expansoes/.test(dlcNormalized) && !dlcNotRequired;
    const reviewAnswer = 'Essa informação ainda está em revisão editorial. Consulte os alertas do guia antes de começar.';

    if (String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-i') {
      return [
        {
          question: 'The Last of Us Part I tem troféus perdíveis?',
          answer: 'Não há perdíveis definitivos no guia. Coletáveis, conversas opcionais, piadas da Ellie, portas com shiv, safes e ações situacionais podem passar batido em uma jogada, mas podem ser limpos por Chapter Select.'
        },
        {
          question: 'Precisa jogar no Survivor/Grounded para platinar?',
          answer: 'Não. A platina de The Last of Us Part I não exige dificuldade alta; você pode jogar em qualquer dificuldade confortável.'
        },
        {
          question: 'The Last of Us Part I tem troféus online?',
          answer: 'Não. A lista de The Last of Us Part I não exige online, multiplayer, Factions, servidores ou PS+ para a platina.'
        },
        {
          question: 'Precisa de coop ou multiplayer?',
          answer: 'Não. O guia trata a platina como totalmente solo, sem coop obrigatório e sem troféus de multiplayer.'
        },
        {
          question: 'Left Behind conta para a platina?',
          answer: 'Sim. Em The Last of Us Part I, Left Behind faz parte do pacote e da lista base de 29 troféus; não foi tratado como DLC paga separada obrigatória.'
        },
        {
          question: 'Quanto tempo leva para platinar?',
          answer: 'A estimativa editorial ficou em 20-30h, considerando campanha principal, Left Behind, coletáveis e cleanup por seleção de capítulos.'
        },
        {
          question: 'Qual a dificuldade da platina?',
          answer: 'A dificuldade ficou em 3/10. O desafio é mais organização de checklist do que execução difícil.'
        },
        {
          question: 'Dá para usar Chapter Select para limpar coletáveis?',
          answer: 'Sim. Use a seleção de capítulos para revisar coletáveis, conversas opcionais, piadas, safes, portas com shiv, ferramentas, bancadas e troféus situacionais.'
        },
        {
          question: 'Precisa de New Game+?',
          answer: 'Não. New Game+ não é obrigatório para a platina; uma campanha, Left Behind e cleanup por Chapter Select bastam para a rota editorial.'
        },
        {
          question: 'O que mais dá trabalho na platina?',
          answer: 'O maior cuidado está em coletáveis, conversas opcionais, piadas da Ellie, portas com shiv, safes, ferramentas, manuais, workbenches e troféus situacionais.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-ii') {
      return [
        {
          question: 'The Last of Us Part II tem troféus perdíveis?',
          answer: 'Não há perdíveis definitivos na platina base. Coletáveis, cartas, moedas, cofres, bancadas, manuais, upgrades e troféus situacionais podem passar batido, mas podem ser limpos com Chapter Select e NG+ parcial.'
        },
        {
          question: 'Precisa jogar no Grounded ou dificuldade alta para platinar?',
          answer: 'Não. A platina base de The Last of Us Part II não exige Grounded nem dificuldade alta; você pode jogar em qualquer dificuldade confortável.'
        },
        {
          question: 'The Last of Us Part II tem troféus online?',
          answer: 'Não. A lista base da platina é offline e não exige servidores, multiplayer, Factions ou PS+.'
        },
        {
          question: 'Precisa de coop ou multiplayer?',
          answer: 'Não. O guia trata a platina base como uma rota solo, sem coop obrigatório e sem troféus de multiplayer.'
        },
        {
          question: 'Grounded e Permadeath contam para a platina?',
          answer: 'Não. Grounded e Permadeath são troféus extras/update e ficam separados da platina base do Part II original.'
        },
        {
          question: 'Quanto tempo leva para platinar?',
          answer: 'A estimativa editorial ficou em 25-35h, considerando campanha completa, coletáveis, Chapter Select, NG+ parcial para upgrades e cleanup final.'
        },
        {
          question: 'Qual a dificuldade da platina?',
          answer: 'A dificuldade ficou em 3/10. O desafio principal é organização de checklist, coletáveis e recursos para upgrades, não execução em dificuldade alta.'
        },
        {
          question: 'Dá para usar Chapter Select para limpar coletáveis?',
          answer: 'Sim. Chapter Select ajuda a revisar artefatos, cartas, moedas, entradas de diário, cofres, bancadas, manuais e troféus situacionais.'
        },
        {
          question: 'Precisa de New Game+?',
          answer: 'Sim, normalmente como NG+ parcial. Uma campanha única costuma não dar suplementos e peças suficientes para todos os upgrades de personagem e armas.'
        },
        {
          question: 'O que mais dá trabalho na platina?',
          answer: 'O maior cuidado está em coletáveis, cartas, moedas, bancadas, cofres, manuais, suplementos, peças, upgrades de armas/personagens e cleanup.'
        },
        {
          question: 'Este guia vale para The Last of Us Part II Remastered?',
          answer: 'Não como escopo completo. Este guia cobre The Last of Us Part II original e sua platina base; Remastered e o modo No Return devem ter tratamento separado.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'subnautica') {
      return [
        {
          question: 'Subnautica tem troféus perdíveis?',
          answer: 'O guia marca um risco conservador em Man’s Best Friend, porque ovos de Cuddlefish são finitos. Faça esse troféu antes do final, mantenha saves manuais e não descarte os ovos.'
        },
        {
          question: 'Subnautica precisa de online para platinar?',
          answer: 'Não. A platina de Subnautica é single-player e não exige online, servidores, multiplayer ou assinatura.'
        },
        {
          question: 'Subnautica tem coop obrigatório?',
          answer: 'Não. Não há coop obrigatório para a platina; a rota do guia é totalmente solo.'
        },
        {
          question: 'Quanto tempo leva para platinar Subnautica?',
          answer: 'A estimativa editorial ficou em 20-30h, considerando sobrevivência, exploração, veículos, história, base e cleanup antes do final.'
        },
        {
          question: 'Qual a dificuldade da platina?',
          answer: 'A dificuldade ficou em 3/10. O maior desafio é orientação, preparação para áreas profundas e gestão de recursos, não execução difícil.'
        },
        {
          question: 'Precisa de DLC para a platina?',
          answer: 'Não. O guia cobre a lista base do Subnautica original e não inclui Below Zero, Subnautica 2, versões mobile ou conteúdo futuro.'
        },
        {
          question: 'Subnautica tem Chapter Select?',
          answer: 'Não há Chapter Select tradicional. O cleanup depende de exploração em mundo aberto, planejamento e saves manuais antes de grandes marcos.'
        },
        {
          question: 'Dá para continuar explorando antes/depois do final?',
          answer: 'O caminho mais seguro é revisar tudo antes do lançamento final e manter um save manual. Se precisar limpar algo, volte ao save anterior quando o jogo permitir.'
        },
        {
          question: 'Quais veículos são importantes para a platina?',
          answer: 'Seamoth, Prawn Suit e Cyclops são importantes para troféus próprios, exploração profunda, segurança e avanço da história.'
        },
        {
          question: 'O que mais dá trabalho na platina?',
          answer: 'Exploração profunda, construção dos veículos, Aurora, instalações alienígenas, recursos para expedições longas, Cuddlefish e preparação antes do final.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'saros') {
      return [
        {
          question: 'Saros tem troféus perdíveis?',
          answer: 'Não há troféus perdíveis reais tratados na lista base. O guia considera bosses, desafios, armas e objetivos cumulativos como cleanup de runs, não como perda permanente.'
        },
        {
          question: 'Saros precisa de online para platinar?',
          answer: 'Não. A página oficial descreve Saros como um jogo single-player, e a lista base não deve ser tratada como dependente de online obrigatório.'
        },
        {
          question: 'Saros tem coop obrigatório?',
          answer: 'Não. O guia não marca coop obrigatório porque não há requisito de coop validado para a platina base.'
        },
        {
          question: 'Quanto tempo leva para platinar Saros?',
          answer: 'A estimativa inicial do guia é 20-30h, considerando campanha, epílogo, Nightmare Gates, 33 expedições com modificadores e cleanup de armas/desafios.'
        },
        {
          question: 'Qual a dificuldade da platina?',
          answer: 'A dificuldade inicial ficou em 4/10. A lista é direta, mas exige consistência em runs, chefes, desafios de armas e um bioma sem dano relevante.'
        },
        {
          question: 'Saros exige DLC para platina?',
          answer: 'Não. Digital Deluxe, cosméticos, acesso antecipado e qualquer conteúdo futuro ficam fora do escopo da platina base.'
        },
        {
          question: 'Dá para limpar pendências depois da campanha?',
          answer: 'O guia trata a platina como campanha/runs principais + cleanup. Pendências de armas, desafios, Nightmare Gates e objetivos cumulativos devem ser resolvidas em runs adicionais.'
        },
        {
          question: 'Saros tem chapter select ou replay de áreas?',
          answer: 'Não há Chapter Select tradicional marcado no guia. Replays, pós-jogo ou seleção de áreas devem continuar em validação editorial antes de virar badge específico.'
        },
        {
          question: 'A platina depende de múltiplas runs?',
          answer: 'Sim. Como roguelite, a platina depende de várias runs para progressão, bosses, recursos, modificadores, armas e desafios situacionais.'
        },
        {
          question: 'O guia está verificado?',
          answer: 'Não. Saros foi adicionado como guia inicial em revisão editorial, com avisos para validação final da lista e localização oficial dos troféus.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'nioh-3') {
      return [
        {
          question: 'Nioh 3 tem troféus perdíveis?',
          answer: 'Não há troféus perdíveis reais confirmados na lista base. O jogo permite limpeza posterior por free roam/replay de missões, então o desafio está em campanha, myths, coletáveis, proficiência, bosses opcionais e cleanup.'
        },
        {
          question: 'Nioh 3 precisa de online para platinar?',
          answer: 'Não. A platina base não deve exigir online obrigatório. Recursos online existem como opção, mas não são tratados como requisito da lista base.'
        },
        {
          question: 'Nioh 3 tem coop obrigatório?',
          answer: 'Não. O jogo possui coop online opcional, mas a platina base não deve exigir coop obrigatório. Se o troféu Teamwork estiver na lista, ele deve ser tratado como possível via NPCs/Acolytes quando validado.'
        },
        {
          question: 'Quanto tempo leva para platinar Nioh 3?',
          answer: 'O resumo editorial mantém 40-60h, considerando campanha, Myths, coletáveis, proficiência, bosses opcionais, sistemas de combate e cleanup/replay.'
        },
        {
          question: 'Qual a dificuldade da platina?',
          answer: 'A dificuldade cadastrada é 5/10. O peso vem do combate, chefes, exploração, builds e volume de checklist, não de modo difícil obrigatório.'
        },
        {
          question: 'É necessário jogar DLC para a platina base?',
          answer: 'Não. Season Pass, Digital Deluxe, bônus, cosméticos, demo e DLCs futuras ficam fora do escopo da platina base.'
        },
        {
          question: 'Dá para repetir missões para limpar coletáveis?',
          answer: 'Sim. O guia trata Battle Scroll e free roam como caminhos de limpeza para missões, coletáveis, diálogos e condições situacionais.'
        },
        {
          question: 'Nioh 3 tem Chapter Select?',
          answer: 'Não deve ser marcado como Chapter Select tradicional. O conceito correto para o guia é replay de missões via Battle Scroll.'
        },
        {
          question: 'Battle Scroll conta como replay de missões?',
          answer: 'Sim. Battle Scroll é o sistema usado no guia para revisar missões e corrigir pendências sem reiniciar a campanha.'
        },
        {
          question: 'Qual é o maior grind da platina?',
          answer: 'O maior volume está em exploração regional, Myths, coletáveis, proficiência, sistemas de ferreiro, Soul Cores/Yokai, bosses opcionais e cleanup final.'
        },
        {
          question: 'O guia está verificado?',
          answer: 'Não. O guia permanece em revisão editorial por ser recente e por exigir validação final de nomes PT-BR oficiais e escopo de DLCs futuras.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'elden-ring') {
      return [
        {
          question: 'Elden Ring tem troféus perdíveis?',
          answer: 'Sim, o guia marca riscos perdíveis/semi-perdíveis: os finais Elden Lord, Age of the Stars e Lord of Frenzied Flame são mutuamente exclusivos por save, Lichdragon Fortissax depende da quest da Fia e Bolt of Gransax deve ser coletado antes de Leyndell virar Ashen Capital.'
        },
        {
          question: 'Elden Ring precisa de online para platinar?',
          answer: 'Não. A platina base não exige troféus online, servidores, invasões, mensagens, invocações ou PS+. Recursos online podem ajudar, mas são opcionais.'
        },
        {
          question: 'Elden Ring tem coop obrigatório?',
          answer: 'Não. Coop pode facilitar bosses e exploração, mas o guia não trata coop como requisito de troféu.'
        },
        {
          question: 'Quanto tempo leva para platinar Elden Ring?',
          answer: timeLabel ? `O tempo estimado do guia é ${timeLabel}, considerando exploração ampla, bosses opcionais, lendários, finais e cleanup.` : reviewAnswer
        },
        {
          question: 'Qual a dificuldade da platina de Elden Ring?',
          answer: difficulty > 0 ? `A dificuldade cadastrada é ${difficulty}/10. O desafio vem de bosses exigentes e conteúdo opcional da lista base, não de modo difícil obrigatório.` : reviewAnswer
        },
        {
          question: 'Dá para fazer a platina de Elden Ring em uma run?',
          answer: 'A recomendação do guia é uma jogada longa com backup de save antes dos finais. Sem backup, planeje 2-3 jogadas, NG+ ou múltiplos saves para cobrir Elden Lord, Age of the Stars e Lord of Frenzied Flame.'
        },
        {
          question: 'Precisa de backup de save em Elden Ring?',
          answer: 'Não é obrigatório, mas é o caminho mais eficiente para obter os três finais com troféu em uma única run planejada.'
        },
        {
          question: 'A DLC Shadow of the Erdtree é necessária para a platina?',
          answer: 'Não. Shadow of the Erdtree não é necessária para a platina base. O guia da DLC fica pendente separadamente.'
        },
        {
          question: 'É possível fazer os finais em uma única jogada?',
          answer: 'Sim, se o jogador preparar as rotas e usar backup de save antes da decisão final. Sem backup, cada final com troféu deve ser tratado como outra jogada, NG+ ou save separado.'
        },
        {
          question: 'O que fazer antes da mudança de Leyndell?',
          answer: 'Pegue Bolt of Gransax e revise os armamentos lendários antes de avançar para a versão Ashen Capital, porque esse é o ponto mais sensível da lista base.'
        },
        {
          question: 'Qual é o maior risco da platina de Elden Ring?',
          answer: 'O maior risco é deixar Bolt of Gransax para depois da mudança de Leyndell; em seguida vêm finais sem backup e a quest da Fia para Lichdragon Fortissax.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil-requiem') {
      return [
        {
          question: 'Resident Evil Requiem tem troféus perdíveis?',
          answer: 'Sim. O guia destaca 4 perdíveis reais ou fortemente prováveis e separa esses riscos de spoilers, coletáveis, dificuldade e objetivos situacionais.'
        },
        {
          question: 'Resident Evil Requiem precisa de online para platinar?',
          answer: 'Não. A platina da lista base não exige troféus online obrigatórios.'
        },
        {
          question: 'Quanto tempo leva para platinar Resident Evil Requiem?',
          answer: 'O tempo estimado para platinar Resident Evil Requiem é 20-25h. Use o roadmap para distribuir campanha, cleanup e checklist.'
        },
        {
          question: 'Qual a dificuldade da platina de Resident Evil Requiem?',
          answer: 'A dificuldade cadastrada para a platina é 4/10. Leia os alertas para entender onde o desafio pode aumentar.'
        },
        {
          question: 'Resident Evil Requiem tem coop obrigatório?',
          answer: 'Não. A rota da platina base é solo e não aponta coop obrigatório.'
        },
        {
          question: 'A DLC é necessária para a platina de Resident Evil Requiem?',
          answer: 'Não. DLCs, Deluxe Kit e modos futuros ficam fora da platina base.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'pragmata') {
      return [
        {
          question: 'PRAGMATA tem troféus perdíveis?',
          answer: 'Até a última revisão editorial, o guia trata 1 troféu como potencialmente perdível: You\'re Not Getting Away That Easy. Esse ponto segue em validação por ser um jogo recente.'
        },
        {
          question: 'PRAGMATA precisa de online para platinar?',
          answer: 'Não. A lista atual não indica troféus online, servidores ou assinatura obrigatória para a platina.'
        },
        {
          question: 'PRAGMATA tem coop obrigatório?',
          answer: 'Não. As fontes oficiais descrevem PRAGMATA como single-player, e a lista de troféus não indica coop obrigatório.'
        },
        {
          question: 'Quanto tempo leva para platinar PRAGMATA?',
          answer: timeLabel ? `O tempo estimado inicial do guia é ${timeLabel}, considerando campanha, coletáveis, Unknown Signal, Training Sims, cleanup e Lunatic.` : reviewAnswer
        },
        {
          question: 'Qual a dificuldade da platina de PRAGMATA?',
          answer: difficulty > 0 ? `A dificuldade cadastrada é ${difficulty}/10. O maior peso inicial está na campanha em Lunatic, no possível perdível e em objetivos situacionais de combate/coleta.` : reviewAnswer
        },
        {
          question: 'Quantas jogadas são necessárias para platinar PRAGMATA?',
          answer: 'O guia recomenda 2 jogadas: uma primeira campanha para aprender sistemas e limpar bastante conteúdo, e uma campanha em Lunatic para o troféu de dificuldade.'
        },
        {
          question: 'DLC ou Deluxe Edition são necessárias para a platina?',
          answer: 'Não. O guia cobre a lista base e não trata DLC, Deluxe Edition, cosméticos ou bônus de pré-venda como requisito da platina.'
        },
        {
          question: 'O modo Lunatic é obrigatório para a platina?',
          answer: 'Sim, a lista atual inclui Lunar Supremacy, que exige concluir o jogo na dificuldade Lunatic. A relação com New Game+ ainda deve ser revalidada após patches e novas fontes.'
        },
        {
          question: 'Dá para limpar coletáveis depois da história?',
          answer: 'Este ponto ainda está em validação. O roadmap orienta usar Unknown Signal e cleanup pós-game para revisar setores, mas recomenda acompanhar coletáveis desde a primeira campanha.'
        },
        {
          question: 'O guia já está verificado?',
          answer: 'Não. PRAGMATA está como guia inicial em revisão editorial, com avisos para checagem de patches, localização de troféus e validação de perdíveis.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'hades') {
      return [
        {
          question: 'Hades tem troféus perdíveis?',
          answer: 'Não há perdíveis reais confirmados para a platina de Hades. O desafio está em repetição de runs, relacionamentos, Fated List, Keepsakes, Companions, Pact of Punishment/Heat e limpeza final.'
        },
        {
          question: 'Hades precisa de online para platinar?',
          answer: 'Não. A platina base é totalmente offline e não exige multiplayer, servidores, PS+ ou troféus online.'
        },
        {
          question: 'Hades tem coop obrigatório?',
          answer: 'Não. Hades é uma platina single-player e o guia não aponta coop obrigatório.'
        },
        {
          question: 'God Mode bloqueia troféus em Hades?',
          answer: 'Não. God Mode é tratado como recurso opcional de acessibilidade/dificuldade e não invalida troféus da lista base.'
        },
        {
          question: 'Dá para fazer tudo no mesmo save?',
          answer: 'Sim. A platina pode ser avançada no mesmo save, acumulando progresso entre runs para relacionamentos, Fated List, Keepsakes, Companions, Heat e cleanup.'
        },
        {
          question: 'Quanto tempo leva para platinar Hades?',
          answer: timeLabel ? `O tempo estimado do guia é ${timeLabel}, considerando primeira clear, 10 clears da história, epílogo, relacionamentos, Fated List, Heat e cleanup.` : reviewAnswer
        },
        {
          question: 'Qual a dificuldade da platina de Hades?',
          answer: difficulty > 0 ? `A dificuldade cadastrada é ${difficulty}/10. O desafio mistura combate, consistência em runs, Heat 8/16 e grind de progressão.` : reviewAnswer
        },
        {
          question: 'Quantas runs são necessárias para platinar Hades?',
          answer: 'Não há número fixo. O guia trabalha com dezenas de tentativas: primeira fuga, 10 clears para a história principal e várias runs extras para relacionamentos, recursos, Fated List, Keepsakes, Companions e Heat.'
        },
        {
          question: 'A DLC é necessária para a platina de Hades?',
          answer: 'Não. O guia cobre a lista base de PlayStation e não trata DLC ou conteúdo extra como requisito da platina.'
        },
        {
          question: 'O maior desafio da platina é dificuldade ou grind?',
          answer: 'É uma mistura, mas o peso maior está em grind/progressão: muitas runs, recursos, afinidade, Fated List, Keepsakes e Companions. A dificuldade aparece mais em Heat, Extreme Measures e salas sem dano.'
        },
        {
          question: 'Pact of Punishment/Heat é obrigatório para a platina?',
          answer: 'Sim. Há troféus ligados a Pact of Punishment/Heat, como prêmios de Skelly, Extreme Measures, Harsh Conditions, Slashed Benefits e Infernal Gate. Suba Heat gradualmente depois de estabilizar clears.'
        },
        {
          question: 'É possível fazer tudo depois da história?',
          answer: 'Quase tudo pode ser continuado no pós-game. O guia recomenda avançar relacionamentos, Fated List e recursos durante a campanha para reduzir grind, mas não marca esses objetivos como perdíveis.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'ghost-of-tsushima') {
      return [
        {
          question: 'Ghost of Tsushima tem troféus perdíveis?',
          answer: 'Não. A lista base não tem troféus perdíveis obrigatórios. A platina pode ser finalizada com cleanup em free roam após a campanha.'
        },
        {
          question: 'Ghost of Tsushima precisa de online para platinar?',
          answer: 'Não. A platina base é totalmente offline e não exige Legends, servidores, PS+ ou troféus online.'
        },
        {
          question: 'Quanto tempo leva para platinar Ghost of Tsushima?',
          answer: timeLabel ? `O tempo estimado do guia é ${timeLabel}, considerando campanha, Tales of Tsushima, Mythic Tales, liberação de regiões, coletáveis e cleanup no free roam.` : reviewAnswer
        },
        {
          question: 'Qual a dificuldade da platina de Ghost of Tsushima?',
          answer: difficulty > 0 ? `A dificuldade cadastrada é ${difficulty}/10. O desafio vem mais do volume de exploração, atividades e limpeza de mapa do que de execução extrema.` : reviewAnswer
        },
        {
          question: 'Ghost of Tsushima tem coop obrigatório?',
          answer: 'Não. A platina base é single-player e não exige coop.'
        },
        {
          question: 'A DLC é necessária para a platina de Ghost of Tsushima?',
          answer: 'Não. Iki Island, Legends e New Game+ ficam fora da platina base.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'hades-ii') {
      return [
        {
          question: 'Hades II tem troféus perdíveis?',
          answer: hasMissable
            ? 'Sim. A lista base tem 1 perdível relevante no guia. Leia os pontos de atenção antes de avançar para evitar repetir progresso desnecessário.'
            : 'Não. A lista base não tem perdíveis obrigatórios confirmados. O risco principal está em spoilers, objetivos situacionais e organização de runs, não em travar a platina.'
        },
        {
          question: 'Hades II precisa de online para platinar?',
          answer: 'Não. A platina base é totalmente offline e não exige servidores, PS+ ou troféus online.'
        },
        {
          question: 'Quanto tempo leva para platinar Hades II?',
          answer: 'O tempo estimado é 65-85 horas, variando conforme domínio das runs, progresso na Fated List, recursos raros, relacionamentos, Chaos Trials, Surface, Chronos e cleanup.'
        },
        {
          question: 'Qual a dificuldade da platina de Hades II?',
          answer: 'A dificuldade cadastrada é 7/10. O desafio vem da consistência em runs, bosses, rotas avançadas, grind de recursos e objetivos longos.'
        },
        {
          question: 'Hades II tem coop obrigatório?',
          answer: 'Não. A platina base é single-player e não exige coop.'
        },
        {
          question: 'A DLC é necessária para a platina de Hades II?',
          answer: 'Não. A platina base não exige DLC.'
        }
      ];
    }

    return [
      {
        question: `${name} tem troféus perdíveis?`,
        answer: missableReview
          ? reviewAnswer
          : hasMissable
            ? 'Sim. O guia possui alertas para troféus perdíveis. É recomendado seguir o roadmap desde o início.'
            : 'O guia não aponta troféus perdíveis obrigatórios nos dados atuais, mas ainda vale revisar os alertas antes de começar.'
      },
      {
        question: `${name} precisa de online para platinar?`,
        answer: onlineReview
          ? reviewAnswer
          : network.hasOnline
            ? 'Sim. O guia indica requisito online ou multiplayer para a platina. Planeje essa etapa antes de deixar para o final.'
            : 'Não. A platina não exige troféus online obrigatórios segundo os dados atuais do guia.'
      },
      {
        question: `Quanto tempo leva para platinar ${name}?`,
        answer: timeLabel
          ? `O tempo estimado para platinar ${name} é ${timeLabel}. Use o roadmap para distribuir campanha, cleanup e checklist.`
          : reviewAnswer
      },
      {
        question: `Qual a dificuldade da platina de ${name}?`,
        answer: difficulty > 0
          ? `A dificuldade cadastrada para a platina é ${difficulty}/10. Leia os alertas para entender onde o desafio pode aumentar.`
          : reviewAnswer
      },
      {
        question: `${name} tem coop obrigatório?`,
        answer: coopReview
          ? reviewAnswer
          : network.hasCoop
            ? 'Sim. O guia indica coop obrigatório ou necessidade de outro jogador para a platina.'
            : 'Não. O guia não aponta coop obrigatório para a platina.'
      },
      {
        question: `A DLC é necessária para a platina de ${name}?`,
        answer: dlcReview
          ? reviewAnswer
          : dlcRequired
            ? 'Sim. O guia indica DLC ou conteúdo extra no escopo da platina. Confira o detalhe antes de começar.'
            : dlcNotRequired
              ? 'Não. A DLC não é necessária para a platina base.'
              : 'O escopo de DLC está descrito no guia. Confira o detalhe antes de decidir quais listas extras seguir.'
      }
    ];
  }

  function buildGuidePlayerFit(game = {}, viewModel = {}) {
    const difficulty = Number(game?.difficulty || 0);
    const timeValue = getTimeValue(game);
    const hasTimeValue = hasKnownTimeValue(timeValue);
    const roadmapCount = Array.isArray(viewModel.roadmap) ? viewModel.roadmap.length : 0;
    const spoilerCount = Number(viewModel.spoilerCount || 0);
    const missableCount = Number(viewModel.missables || 0);
    const fit = [];
    const avoid = [];
    const bestMoment = [];
    const bestForText = firstGuideText(game?.best_for, game?.ideal_for, game?.guide_ideal);
    const avoidIfText = firstGuideText(game?.avoid_if, game?.avoid_for, game?.guide_avoid);
    const firstRunText = firstGuideText(game?.first_run_advice, game?.guide_best_moment, game?.best_for_when);
    const beforeStartText = firstGuideText(game?.before_you_start);

    if (bestForText) fit.push(...bestForText.split(/\n+/).map(item => item.trim()).filter(Boolean).slice(0, 3));
    else if (difficulty <= 3) fit.push('Boa escolha para quem quer uma platina mais acessível ou uma pausa entre projetos mais pesados.');
    else if (difficulty <= 6) fit.push('Funciona melhor para quem já gosta de seguir guia com alguma disciplina, mas sem entrar num projeto extremo.');
    else fit.push('Faz mais sentido para quem já aceita pressão real de execução, tentativa e erro e leitura cuidadosa antes da run.');

    if (beforeStartText) bestMoment.push(...beforeStartText.split(/\n+/).map(item => item.trim()).filter(Boolean).slice(0, 2));
    if (firstRunText) bestMoment.push(...firstRunText.split(/\n+/).map(item => item.trim()).filter(Boolean).slice(0, 2));

    if (hasTimeValue && timeValue <= 15) bestMoment.push('Ótimo para fim de semana, folga curta ou quando você quer sensação rápida de progresso.');
    else if (hasTimeValue && timeValue <= 40) bestMoment.push('Bom para manter constância durante a semana sem virar maratona infinita.');
    else if (hasTimeValue) bestMoment.push('Melhor começar quando você puder sustentar um projeto longo por várias sessões.');
    else bestMoment.push('Valide o tempo estimado antes de assumir compromisso longo.');

    if (roadmapCount >= 3) fit.push('O roadmap já oferece direção suficiente para entrar com menos improviso.');
    else avoid.push('Como o roadmap ainda está enxuto, não é a melhor porta de entrada se você prefere tudo mastigado desde o começo.');

    if (avoidIfText) avoid.unshift(...avoidIfText.split(/\n+/).map(item => item.trim()).filter(Boolean).slice(0, 3));
    else if (missableCount >= 3) avoid.push('Evite começar cansado ou distraído: há alertas suficientes para transformar a run em retrabalho se você entrar no improviso.');
    else if (missableCount === 0) bestMoment.push('O risco aparente de perdível é baixo, então a entrada tende a ser mais tranquila.');

    if (spoilerCount > 0) avoid.push('Não é ideal se você quer ler tudo sem filtrar spoiler durante a primeira campanha.');
    else fit.push('A leitura do guia tende a ser mais direta, com menos chance de estragar surpresas importantes.');

    return {
      fit: fit.slice(0, 3),
      avoid: avoid.slice(0, 3),
      bestMoment: bestMoment.slice(0, 3)
    };
  }

  function buildGuideDecisionModel(game, trophies = [], roadmap = []) {
    const difficulty = Number(game?.difficulty || 0);
    const total = Array.isArray(trophies) ? trophies.length : 0;
    const missables = trophies.filter(trophy => trophy && (isRealMissableTrophy(trophy) || trophy.is_spoiler)).length;
    const roadmapCount = Array.isArray(roadmap) ? roadmap.length : 0;

    let fitLabel = 'Projeto enxuto';
    let fitDetail = 'Boa opção para abrir sem precisar estudar demais antes de começar.';
    if (difficulty >= 8 || total >= 45 || roadmapCount >= 6) {
      fitLabel = 'Compromisso alto';
      fitDetail = 'Pede mais foco, ritmo e sessões mais bem planejadas.';
    } else if (difficulty >= 5 || total >= 28 || roadmapCount >= 4) {
      fitLabel = 'Compromisso médio';
      fitDetail = 'Ainda é amigável, mas vale entrar já com rota definida.';
    }

    let riskLabel = 'Risco controlado';
    let riskDetail = 'Nada indica armadilha grande logo de início.';
    if (missables >= 4) {
      riskLabel = 'Risco alto de retrabalho';
      riskDetail = 'Há alertas suficientes para justificar leitura do guia antes de qualquer sessão.';
    } else if (missables >= 1) {
      riskLabel = 'Algum risco de retrabalho';
      riskDetail = 'Convém revisar perdíveis e ordem de execução antes da primeira run.';
    }

    let paceLabel = 'Vale abrir hoje';
    let paceDetail = 'Você consegue validar rápido se o projeto combina com o seu momento.';
    if (difficulty >= 8 || total >= 45) {
      paceLabel = 'Melhor abrir com tempo';
      paceDetail = 'Ideal para quando você puder jogar com mais continuidade e atenção.';
    } else if (difficulty >= 5 || total >= 28 || roadmapCount >= 4) {
      paceLabel = 'Pede preparação';
      paceDetail = 'Ainda vale abrir hoje, mas com espaço para revisar o roadmap e as pendências.';
    }

    let verdict = 'Vale abrir agora';
    let verdictDetail = 'O custo de entrada parece bom para decidir rápido se esta platina entra na sua rotação.';
    if (difficulty >= 8 && missables >= 3) {
      verdict = 'Abra só se quiser compromisso alto';
      verdictDetail = 'O projeto parece mais exigente e funciona melhor quando você quer investir várias sessões com disciplina.';
    } else if (difficulty >= 6 || missables >= 3 || total >= 38) {
      verdict = 'Vale abrir com o guia do lado';
      verdictDetail = 'Há valor claro aqui, mas a chance de perder tempo sobe bastante se você entrar sem rota definida.';
    }

    return {
      fitLabel,
      fitDetail,
      riskLabel,
      riskDetail,
      paceLabel,
      paceDetail,
      verdict,
      verdictDetail,
      chips: [
        difficulty >= 8 ? 'Exigência alta' : (difficulty >= 5 ? 'Esforço moderado' : 'Entrada amigável'),
        missables ? `${missables} alerta(s) de atenção` : 'Sem alerta crítico forte',
        roadmapCount ? `${roadmapCount} etapa(s) para orientar` : 'Roadmap ainda enxuto'
      ]
    };
  }

  function getDecisionToneClass(label = '') {
    const value = String(label || '').toLowerCase();
    if (value.includes('alto') || value.includes('compromisso alto')) return 'atlas-tag--hot';
    if (value.includes('algum') || value.includes('moderado') || value.includes('preparação')) return 'atlas-tag--warm';
    if (value.includes('controlado') || value.includes('amigável') || value.includes('entrar hoje')) return 'atlas-tag--close';
    return 'atlas-tag--soft';
  }

  function getGuideRunEstimate(game = {}, roadmap = [], trophies = []) {
    const timeValue = getTimeValue(game);
    const hasTimeValue = hasKnownTimeValue(timeValue);
    const difficulty = Number(game?.difficulty || 0);
    const missableCount = countRealMissableTrophies(trophies);
    if (roadmap.length >= 4 || missableCount >= 3 || difficulty >= 8 || (hasTimeValue && timeValue > 40)) return 'Provável multi-run ou cleanup pesado';
    if (roadmap.length >= 2 || difficulty >= 5 || missableCount >= 1 || (hasTimeValue && timeValue > 15)) return '1 run + cleanup provável';
    return 'Boa chance de 1 run bem guiada';
  }

  function getGuideConfidenceModel(game = {}, trophies = [], roadmap = [], total = 0, missables = 0) {
    const timeValue = getTimeValue(game);
    const signals = [
      roadmap.length >= 2,
      total >= 12,
      Number(game?.difficulty || 0) > 0,
      hasKnownTimeValue(timeValue),
      typeof game?.missable === 'string' && game.missable.trim().length > 0,
      missables > 0
    ].filter(Boolean).length;
    const normalizedSlug = String(game?.slug || '').trim().toLowerCase();
    const editorialStatus = getEditorialTrustStatus(game);

    if (normalizedSlug === 'resident-evil-requiem') {
      if (editorialStatus === 'verified') {
        return {
          label: 'Confiança alta',
          detail: 'Guia revisado editorialmente para a lista base. Tempo, roadmap, perdíveis, online, coop e DLC foram organizados para orientar a platina com mais segurança.',
          tone: 'close'
        };
      }
      return {
        label: 'Aguardando revisão final',
        detail: 'Tempo, roadmap e alertas já ajudam na decisão, mas a página ainda não recebeu validação editorial final.',
        tone: 'partial'
      };
    }

    if (!game?.is_verified) {
      if (signals >= 3) {
        return {
          label: 'Aguardando revisão final',
          detail: 'Tempo, roadmap e alertas já ajudam na decisão, mas a página ainda não recebeu validação editorial final.',
          tone: 'partial'
        };
      }
      return {
        label: 'Aguardando revisao final',
        detail: 'Use como triagem e valide com cautela antes de investir muitas horas, porque a revisão final ainda está pendente.',
        tone: 'warm'
      };
    }

    if (signals >= 5) return { label: 'Confiança alta', detail: 'Tempo, risco e ordem geral já têm contexto suficiente para você decidir com mais segurança.', tone: 'close' };
    if (signals >= 3) return { label: 'Confiança moderada', detail: 'A página já orienta bem o começo, mas ainda vale revisar roadmap e troféus sensíveis antes de assumir compromisso longo.', tone: 'soft' };
    return { label: 'Confiança em construção', detail: 'Ainda há pouco contexto consolidado. Use a página como triagem inicial e valide com mais cautela antes de investir muitas horas.', tone: 'warm' };
  }

  function getGuideEditorialStatusBadge(game = {}, fallbackBadge = null) {
    return getEditorialTrustBadge(game || {}) || fallbackBadge;
    const coverage = String(game?.coverage_level || 'partial').toLowerCase();
    const editorialStatus = String(game?.editorial_status || 'published').toLowerCase();

    if (editorialStatus === 'review') {
      return {
        label: 'Guia em revisão',
        tone: 'partial',
        badge: 'partial',
        detail: game?.is_verified
          ? 'Guia publicado com revisão editorial pendente.'
          : 'Guia em revisão, ainda aguardando validação editorial final.'
      };
    }

    if (game?.is_verified && coverage === 'complete') {
      return {
        label: 'Guia completo',
        tone: 'complete',
        badge: 'complete',
        detail: 'Cobertura completa marcada e verificada pela edição.'
      };
    }

    if (game?.is_verified && coverage === 'strong') {
      return {
        label: 'Guia forte',
        tone: 'partial',
        badge: 'partial',
        detail: 'Cobertura forte e já verificada, ainda sem selo de guia completo.'
      };
    }

    if (!game?.is_verified && coverage !== 'partial') {
      return {
        label: 'Aguardando revisão final',
        tone: 'partial',
        badge: 'partial',
        detail: game?.verification_note || 'Boa base editorial, mas ainda sem validação final.'
      };
    }

    if (!game?.is_verified) {
      return {
        label: 'Base inicial',
        tone: 'partial',
        badge: 'partial',
        detail: game?.verification_note || 'Dados úteis para triagem, ainda aguardando revisão final.'
      };
    }

    return fallbackBadge || {
      label: 'Guia forte',
      tone: 'partial',
      badge: 'partial',
      detail: 'Guia publicado com leitura editorial útil para decidir a próxima platina.'
    };
  }

  function buildGuideSnapshot(game = {}, trophies = [], roadmap = [], editorialModel = null) {
    const total = trophies.length;
    const missableCount = countRealMissableTrophies(trophies);
    const onlineCount = trophies.filter(trophy => /online|multiplayer|coop/i.test(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`)).length;
    const grindCount = trophies.filter(trophy => /grind|farm|\brank\b|\bxp\b|\bnível\b|\blevel\b/i.test(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`)).length;
    const spoilerCount = trophies.filter(trophy => trophy?.is_spoiler).length;
    const confidence = getGuideConfidenceModel(game, trophies, roadmap, total, missableCount + spoilerCount);
    return {
      runEstimate: String(game?.runs || '').trim() || getGuideRunEstimate(game, roadmap, trophies),
      riskLabel: missableCount ? `${missableCount} perdível(is) marcado(s)` : 'Sem perdível explícito forte',
      riskDetail: missableCount ? 'Leia os alertas antes de avançar na campanha para não empurrar risco para o fim.' : 'O cadastro atual não aponta bloqueios grandes no começo, então o risco parece mais de organização do que de travamento.',
      grindLabel: String(game?.online || game?.grind || '').trim()
        ? [String(game?.online || '').trim(), String(game?.grind || '').trim()].filter(Boolean).join(' • ')
        : (onlineCount || grindCount ? `${onlineCount ? `${onlineCount} online` : '0 online'} • ${grindCount ? `${grindCount} grind` : '0 grind'}` : 'Sem online/grind evidente'),
      grindDetail: String(game?.online || game?.grind || '').trim()
        ? `Online: ${String(game?.online || 'não informado').trim()} • Grind: ${String(game?.grind || 'não informado').trim()}`
        : (onlineCount || grindCount ? 'Há sinais de objetivos que podem exigir coordenação extra, farm ou repetição.' : 'Nada no cadastro atual sugere obrigação forte de online ou farm pesado.'),
      scopeLabel: total ? `${total} troféu(s) • ${roadmap.length} etapa(s)` : 'Escopo ainda leve',
      scopeDetail: total ? 'O tamanho da lista e o número de etapas ajudam a estimar o quanto o guia já está organizado.' : 'Ainda faltam dados suficientes para medir o peso real da lista.',
      confidence,
      editorial: editorialModel
    };
  }

  function getGuideVerdictInputs(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : [];
    const roadmap = Array.isArray(viewModel.roadmap) ? viewModel.roadmap : [];
    const parsedTimeValue = getTimeValue(game);
    const trophyCount = Number(game?.trophy_count || viewModel.total || trophies.length || 0);
    const roadmapCount = Number(game?.roadmap_count || roadmap.length || 0);
    const missableCount = trophies.length
      ? countRealMissableTrophies(trophies)
      : Number(viewModel.missableCount || game?.missable_count || 0);
    const spoilerCount = Number(game?.spoiler_count || viewModel.spoilerCount || trophies.filter(trophy => trophy?.is_spoiler).length || 0);
    return {
      difficulty: Number(game?.difficulty || 0),
      timeLabel: game?.time || 'Tempo não informado',
      timeValue: Number.isFinite(parsedTimeValue) && parsedTimeValue !== FALLBACK_TIME_VALUE ? parsedTimeValue : 0,
      trophyCount,
      roadmapCount,
      missableCount,
      spoilerCount,
      runs: firstGuideText(game?.runs_summary, game?.guide_runs, game?.runs),
      missableSummary: firstGuideText(game?.missable_summary, game?.missable),
      online: firstGuideText(game?.online_summary, game?.guide_online, game?.online),
      grind: firstGuideText(game?.grind_summary, game?.guide_grind, game?.grind),
      dlc: firstGuideText(game?.dlc_scope, game?.guide_dlc, game?.dlc),
      difficultyReason: firstGuideText(game?.difficulty_reason),
      timeReason: firstGuideText(game?.time_reason),
      firstRunAdvice: firstGuideText(game?.first_run_advice, game?.guide_best_moment, game?.best_for_when),
      cleanupAdvice: firstGuideText(game?.cleanup_advice),
      beforeYouStart: firstGuideText(game?.before_you_start),
      bestFor: firstGuideText(game?.best_for, game?.ideal_for, game?.guide_ideal),
      avoidIf: firstGuideText(game?.avoid_if, game?.avoid_for, game?.guide_avoid),
      verificationStatus: game?.verification_status || (game?.is_verified ? 'verified' : 'unverified'),
      coverageLevel: game?.coverage_level || 'partial',
      isVerified: Boolean(game?.is_verified)
    };
  }

  function buildThirtySecondVerdict(game = {}, viewModel = {}) {
    const inputs = getGuideVerdictInputs(game, viewModel);
    const warningCount = inputs.missableCount + inputs.spoilerCount;
    const confidence = viewModel.snapshot?.confidence || getGuideConfidenceModel(game, viewModel.trophies || [], viewModel.roadmap || [], inputs.trophyCount, warningCount);
    const coverageLabel = getCoverageDisplayLabel(inputs.coverageLevel);

    let openValue = 'Vale abrir agora';
    let openTone = 'atlas-tag--close';
    if (!inputs.isVerified && inputs.coverageLevel !== 'complete') {
      openValue = 'Revise antes de jogar';
      openTone = 'atlas-tag--partial';
    } else if (inputs.difficulty >= 7 || inputs.timeValue > 35 || warningCount >= 4) {
      openValue = 'Só com rota definida';
      openTone = 'atlas-tag--hot';
    } else if (inputs.difficulty >= 5 || inputs.timeValue > 15 || warningCount > 0) {
      openValue = 'Vale abrir com guia do lado';
      openTone = 'atlas-tag--warning';
    }

    const hasMissableRisk = !hasNegatedGuideRequirement(inputs.missableSummary) && hasMissableRiskText(inputs.missableSummary);
    let riskValue = 'Baixo retrabalho aparente';
    if (inputs.missableCount) riskValue = `${inputs.missableCount} perdível(is)`;
    else if (hasMissableRisk) riskValue = 'Risco descrito pelo editor';
    else if (inputs.spoilerCount) riskValue = `${inputs.spoilerCount} spoiler(s) sensível(is)`;
    else if (inputs.difficulty >= 7) riskValue = `Dificuldade ${inputs.difficulty}/10`;
    else if (!inputs.isVerified) riskValue = 'Revisão pendente';

    const defaultSummary = `${inputs.timeLabel}, dificuldade ${inputs.difficulty || '-'}/10, ${inputs.trophyCount} troféu(s) e ${inputs.roadmapCount} etapa(s) de roadmap.`;
    const openDetail = compactGuideText(inputs.beforeYouStart, inputs.difficultyReason || `Cruzando dificuldade ${inputs.difficulty || '-'}/10, ${inputs.timeLabel}, ${inputs.trophyCount} troféu(s), ${inputs.roadmapCount} etapa(s) e ${warningCount} alerta(s).`, 180);
    const runDetail = compactGuideText(inputs.firstRunAdvice, inputs.timeReason || `Baseado em resumo editorial, roadmap (${inputs.roadmapCount}) e lista (${inputs.trophyCount} troféu(s)).`, 180);
    const riskDetail = compactGuideText(inputs.missableSummary || inputs.cleanupAdvice, `${inputs.missableCount} perdível(is), ${inputs.spoilerCount} spoiler(s) e cobertura ${coverageLabel}.`, 180);
    const timeDetail = compactGuideText(inputs.timeReason, `Estimativa cadastrada: ${inputs.timeLabel}.`, 160);
    const beforeYouStartMaxLength = String(game?.slug || '').trim().toLowerCase() === 'resident-evil-requiem' ? 280 : 180;

    return {
      summary: compactGuideText(inputs.beforeYouStart, defaultSummary, beforeYouStartMaxLength),
      cards: [
        { label: 'Vale abrir agora?', value: openValue, detail: compactGuideText(inputs.beforeYouStart, openDetail, beforeYouStartMaxLength), tone: openTone },
        { label: 'Tempo', value: inputs.timeLabel, detail: timeDetail, tone: 'atlas-tag--time' },
        { label: 'Runs', value: inputs.runs || viewModel.snapshot?.runEstimate || getGuideRunEstimate(game, viewModel.roadmap || [], viewModel.trophies || []), detail: runDetail, tone: 'atlas-tag--time' },
        { label: 'Maior risco', value: riskValue, detail: riskDetail, tone: inputs.missableCount ? 'atlas-tag--risk' : (inputs.spoilerCount ? 'atlas-tag--spoiler' : (inputs.difficulty >= 7 ? 'atlas-tag--warning' : 'atlas-tag--soft')) },
        { label: 'Confiança', value: confidence.label, detail: `Cobertura ${coverageLabel}, ${inputs.trophyCount} troféu(s) e ${inputs.roadmapCount} etapa(s). Status editorial consolidado no topo.`, tone: `atlas-tag--${confidence.tone || 'soft'}` }
      ]
    };
  }

  function buildEditorialSignals(game, viewModel) {
    const total = Number(viewModel?.total || 0);
    const roadmapCount = Number(viewModel?.roadmap?.length || 0);
    const missables = Number(viewModel?.missables || 0);
    const difficulty = Number(game?.difficulty || 0);
    const statusBadge = getGuideEditorialStatusBadge(game || {}, getEditorialBadge(game || {}));
    const reviewedAt = game?.last_reviewed_at || game?.lastReviewedAt
      ? formatDisplayDate(game?.last_reviewed_at || game?.lastReviewedAt)
      : '';
    const customRuns = firstGuideText(game?.runs_summary, game?.guide_runs, game?.runs);
    const customMissable = firstGuideText(game?.missable_summary, game?.missable);
    const customOnline = firstGuideText(game?.online_summary, game?.guide_online, game?.online);
    const customGrind = firstGuideText(game?.grind_summary, game?.guide_grind, game?.grind);
    const customDlc = firstGuideText(game?.dlc_scope, game?.guide_dlc, game?.dlc);
    const customDifficultyReason = firstGuideText(game?.difficulty_reason);
    const customTimeReason = firstGuideText(game?.time_reason);
    const customBeforeStart = firstGuideText(game?.before_you_start);
    const customFirstRun = firstGuideText(game?.first_run_advice, game?.guide_best_moment, game?.best_for_when);
    const customCleanup = firstGuideText(game?.cleanup_advice);

    let coverageLabel = 'Base inicial';
    let coverageDetail = 'O guia ainda precisa ganhar mais camadas para transmitir confiança total.';
    let readinessLabel = 'Leia o guia antes de começar';
    let readinessDetail = 'A página já ajuda, mas ainda vale validar cada etapa com atenção antes da primeira run.';

    if (total >= 40 && roadmapCount >= 4) {
      coverageLabel = 'Cobertura forte';
      coverageDetail = 'Há densidade suficiente de troféus e roadmap para passar sensação de guia mais completo.';
    } else if (total >= 20 && roadmapCount >= 2) {
      coverageLabel = 'Cobertura intermediária';
      coverageDetail = 'O guia já oferece direção útil, mas ainda pode ganhar mais profundidade editorial.';
    }

    if (missables === 0 && roadmapCount >= 3) {
      readinessLabel = 'Entrada mais segura';
      readinessDetail = 'A combinação de roadmap e poucos alertas reduz o risco de começar no escuro.';
    } else if (missables >= 3 || difficulty >= 7) {
      readinessLabel = 'Pede preparo real';
      readinessDetail = 'Os alertas e o nível de exigência justificam leitura disciplinada antes de jogar.';
    }

    if (game?.coverage_level === 'complete' && game?.is_verified) {
      coverageLabel = 'Guia completo';
      coverageDetail = 'O editor marcou esta página como cobertura completa e verificada.';
    } else if (game?.coverage_level === 'strong' && game?.is_verified) {
      coverageLabel = 'Guia forte';
      coverageDetail = 'A cobertura está forte, mas ainda não recebeu o selo de guia completo.';
    } else if (!game?.is_verified || (game?.editorial_status === 'review' && statusBadge.status !== 'verified')) {
      coverageLabel = statusBadge.label;
      coverageDetail = statusBadge.detail;
      readinessLabel = statusBadge.status === 'in_review' ? 'Leia como guia em revisão' : 'Valide antes de confiar';
      readinessDetail = statusBadge.detail;
    }

    const scopeItems = [
      `${total} troféu(s) visíveis no guia`,
      roadmapCount ? `${roadmapCount} etapa(s) no roadmap` : 'roadmap ainda enxuto',
      missables ? `${missables} alerta(s) de atenção` : 'sem alerta crítico marcado',
      customRuns ? `runs: ${customRuns}` : '',
      customDlc ? `DLC: ${customDlc}` : ''
    ].filter(Boolean);

    const methodItems = [
      customBeforeStart || 'Dificuldade, tempo e perdíveis apresentados no topo para decisão rápida.',
      customDifficultyReason ? `Dificuldade: ${customDifficultyReason}` : '',
      customTimeReason ? `Tempo: ${customTimeReason}` : '',
      customMissable ? `Perdíveis: ${customMissable}` : '',
      customFirstRun ? `Primeira run: ${customFirstRun}` : '',
      customCleanup ? `Cleanup: ${customCleanup}` : '',
      customOnline ? `Online: ${customOnline}` : '',
      customGrind ? `Grind: ${customGrind}` : '',
      roadmapCount ? 'O roadmap já organiza a ordem de progressão antes da checklist completa.' : 'A checklist existe, mas o roadmap ainda precisa de mais detalhamento.',
      missables ? 'Os alertas marcados sugerem começar com leitura cuidadosa do guia.' : 'Sem muitos alertas críticos, a entrada tende a ser mais simples.'
    ].filter(Boolean);

    return {
      reviewer: 'Equipe editorial AtlasAchievement',
      reviewedAt,
      statusBadge,
      editorialStatus: statusBadge.status || 'in_review',
      lastReviewedAt: statusBadge.lastReviewedAt || game?.last_reviewed_at || game?.lastReviewedAt || '',
      reviewedBy: statusBadge.reviewedBy || game?.reviewed_by || game?.reviewedBy || '',
      editorialNotes: statusBadge.notes || game?.editorial_notes || game?.editorialNotes || '',
      qualityWarnings: Array.isArray(statusBadge.qualityWarnings) ? statusBadge.qualityWarnings : [],
      isVerified: statusBadge.status === 'verified' || Boolean(game?.is_verified),
      verificationNote: game?.verification_note || '',
      coverageLabel,
      coverageDetail,
      readinessLabel,
      readinessDetail,
      scopeSummary: scopeItems.join(' • '),
      methodSummary: customBeforeStart || 'Dificuldade, tempo, roadmap e alertas são consolidados na própria página para reduzir retrabalho.',
      scopeItems,
      methodItems,
      runsLabel: customRuns || null,
      onlineLabel: customOnline || null,
      grindLabel: customGrind || null,
      dlcLabel: customDlc || null
    };
  }

  function buildPrepCards(game = {}, viewModel = {}) {
    const trophies = Array.isArray(viewModel.trophies) ? viewModel.trophies : [];
    const roadmapCount = Array.isArray(viewModel.roadmap) ? viewModel.roadmap.length : 0;
    const missableCount = countRealMissableTrophies(trophies);
    const spoilerCount = trophies.filter(trophy => trophy && trophy.is_spoiler).length;
    const hasLongList = trophies.length >= 45;
    const timeLabel = game?.time || 'Tempo não informado';
    return [
      { tag: 'Leitura inicial', title: 'Valide o custo real antes da primeira sessão', text: `Este guia projeta ${timeLabel} e dificuldade ${String(game?.difficulty || '-')}/10. Abra com expectativa alinhada para não começar um projeto maior do que parece.` },
      { tag: 'Risco de retrabalho', title: missableCount ? `${missableCount} ponto(s) sensível(is) merecem atenção` : 'Sem perdíveis críticos explícitos', text: missableCount ? 'Há objetivos marcados como perdíveis. Leia o alerta editorial e passe pelo roadmap antes de jogar no improviso.' : 'Nada no cadastro atual indica bloqueio crítico, mas ainda vale verificar troféus únicos e escolhas de campanha.' },
      { tag: 'Estratégia', title: roadmapCount ? `Roadmap com ${roadmapCount} etapa(s) para guiar a ordem ideal` : 'Ainda sem roadmap editorial completo', text: roadmapCount ? 'Use a sequência proposta para evitar cleanup torto, runs fora de ordem e perda de contexto entre sessões.' : 'Nesta página, use primeiro os troféus destacados e a leitura de preparação até o roadmap ficar mais forte.' },
      { tag: 'Nível de atenção', title: spoilerCount ? `${spoilerCount} alerta(s) de spoiler ou contexto sensível` : (hasLongList ? 'Lista longa pede disciplina de checklist' : 'Página pronta para leitura rápida'), text: spoilerCount ? 'Revele o conteúdo com cuidado e só quando isso fizer sentido para a sua run atual.' : (hasLongList ? 'Como a lista é mais densa, o ideal é marcar progresso com frequência para não perder tração.' : 'A estrutura atual favorece leitura rápida antes de decidir se vale colocar o jogo na biblioteca.') }
    ];
  }

  function buildCriticalTrophyAlerts(game = {}, trophies = []) {
    const ranked = trophies
      .filter(Boolean)
      .map(trophy => {
        const bag = `${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`.toLowerCase();
        let score = 0;
        if (isRealMissableTrophy(trophy)) score += 5;
        if (trophy?.is_spoiler) score += 2;
        if (/online|multiplayer|coop/.test(bag)) score += 4;
        if (/grind|farm|\brank\b|\bxp\b|\bnível\b|\blevel\b/.test(bag)) score += 3;
        if (/colet|colecion|miss|perd|chapter|cap[ií]tulo/.test(bag)) score += 3;
        if (/difficulty|dificuldade|hard|survival/.test(bag)) score += 2;
        return {
          name: trophy?.name || 'Troféu',
          label: isRealMissableTrophy(trophy) ? 'Perdível' : (trophy?.is_spoiler ? 'Spoiler / atenção' : (trophy?.type || 'Troféu')),
          reason: trophy?.tip || trophy?.description || 'Requer leitura antes da run.',
          score
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (ranked.length) return ranked;

    return [{
      name: 'Sem alerta crítico explícito',
      label: 'Baixo risco aparente',
      reason: game?.missable || 'O cadastro atual não marca troféus realmente bloqueadores, então o risco maior tende a estar na gestão do tempo e do cleanup.'
    }];
  }

  function buildExecutionProfile(game = {}, trophies = [], roadmap = []) {
    const timeValue = getTimeValue(game);
    const hasTimeValue = hasKnownTimeValue(timeValue);
    const difficulty = Number(game?.difficulty || 0);
    const onlineCount = trophies.filter(trophy => /online|multiplayer|coop/i.test(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`)).length;
    const grindCount = trophies.filter(trophy => /grind|farm|\brank\b|\bxp\b|\bnível\b|\blevel\b/i.test(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`)).length;
    const missableCount = countRealMissableTrophies(trophies);

    let timeBand = 'Tempo não informado';
    let timeDetail = 'Valide a estimativa antes de assumir compromisso longo ou planejar sessões apertadas.';
    if (hasTimeValue && timeValue <= 15) {
      timeBand = 'Projeto curto';
      timeDetail = 'Bom para fechar em poucas sessões e manter sensação de avanço rápido.';
    } else if (hasTimeValue && timeValue <= 35) {
      timeBand = 'Projeto médio';
      timeDetail = 'Pede organização mínima para não transformar a reta final em cleanup desordenado.';
    } else if (hasTimeValue) {
      timeBand = 'Projeto longo';
      timeDetail = 'Vale entrar com rota definida, checkpoints claros e expectativa de constância por vários dias.';
    }

    let difficultyBand = 'Entrada tranquila';
    let difficultyDetail = 'A dificuldade declarada sugere execução mais estável e menor chance de travar por mecânica pura.';
    if (difficulty >= 5 && difficulty <= 7) {
      difficultyBand = 'Exigência moderada';
      difficultyDetail = 'Há chance real de trechos que cobram consistência, leitura prévia e alguma disciplina de checklist.';
    } else if (difficulty > 7) {
      difficultyBand = 'Execução exigente';
      difficultyDetail = 'Este é o tipo de guia em que ordem, treino e preparação editorial economizam mais horas.';
    }

    const friction = [];
    if (missableCount) friction.push(`${missableCount} perdível(is) marcado(s)`);
    if (onlineCount) friction.push(`${onlineCount} objetivo(s) com online/co-op`);
    if (grindCount) friction.push(`${grindCount} ponto(s) com cara de grind`);
    if (roadmap.length >= 4) friction.push(`${roadmap.length} etapas no roadmap`);
    if (!friction.length) friction.push('sem gargalo crítico explícito no cadastro atual');

    return { timeBand, timeDetail, difficultyBand, difficultyDetail, frictionLine: friction.join(' • ') };
  }

  function buildGuideViewModel(game, completedSource = [], options = {}) {
    const trophies = Array.isArray(game?.trophies) ? game.trophies : [];
    const roadmap = Array.isArray(game?.roadmap) ? game.roadmap : [];
    const roadmapStagesSource = Array.isArray(game?.roadmapStages) ? game.roadmapStages : roadmap;
    const completedIds = new Set(Array.isArray(completedSource) ? completedSource : []);
    const completed = trophies.filter(trophy => completedIds.has(trophy.id)).length;
    const total = trophies.length;
    const progress = total ? Math.round((completed / total) * 100) : 0;
    const pending = Math.max(total - completed, 0);
    const missableCount = countRealMissableTrophies(trophies);
    const attentionCount = trophies.filter(trophy => trophy && (isRealMissableTrophy(trophy) || trophy.is_spoiler)).length;
    const spoilerCount = trophies.filter(trophy => trophy?.is_spoiler).length;
    const riskCounts = getRiskCounts(trophies);
    const guidanceCounts = buildGuidanceCounts(trophies, riskCounts);
    const breakdown = getTrophyBreakdown(trophies);
    const breakdownText = breakdown.filter(item => item.count > 0).map(item => `${item.count} ${item.type}`).join(' • ') || 'Sem troféus detalhados';
    const quickNotes = [
      game?.missable ? game.missable : 'Revise os alertas editoriais antes de iniciar a campanha.',
      roadmap.length ? `Siga ${roadmap.length} etapa(s) do roadmap para evitar retrabalho e organizar a platina.` : 'Monte uma ordem de execução antes de sair marcando troféus soltos.',
      spoilerCount ? `${spoilerCount} troféu(s) têm spoiler e pedem leitura com cautela.` : 'Os troféus visíveis podem ser revisados sem grandes spoilers.'
    ].filter(Boolean);
    const prepChecklist = [
      missableCount ? `Leia com atenção o bloco de perdíveis: há ${missableCount} alerta(s) que pede(m) atenção antes de avançar.` : 'Não há alerta forte de perdível marcado neste guia; spoilers continuam sinalizados apenas para leitura cuidadosa.',
      total ? `A lista tem ${total} troféu(s), com distribuição ${breakdownText}.` : 'Ainda não há troféus cadastrados para este jogo.',
      roadmap.length ? `O roadmap já está quebrado em ${roadmap.length} etapa(s), útil para sessões curtas.` : 'O guia ainda precisa de um roadmap mais detalhado para orientar melhor a ordem da platina.'
    ];
    const collectionClassifier = typeof options.classifyGameCollections === 'function' ? options.classifyGameCollections : () => ({ collectionLinks: [], badges: [] });
    const imageResolver = typeof options.resolveImage === 'function' ? options.resolveImage : value => value || '/og-default.svg';
    const guideCover = buildGuideCoverModel(game, imageResolver);
    const editorialSignals = buildEditorialSignals(game, { trophies, roadmap, total, missables: missableCount });
    const scopeModel = buildGuideScopeModel(game, { trophies, roadmap, total });
    const viewModel = {
      trophies,
      roadmap,
      completedIds,
      completed,
      total,
      progress,
      pending,
      missables: missableCount,
      missableCount,
      attentionCount,
      spoilerCount,
      riskCounts,
      guidanceCounts,
      criticalAlertsCount: guidanceCounts.criticalAlertsCount,
      checklistTipsCount: guidanceCounts.checklistTipsCount,
      totalGuidanceCount: guidanceCounts.totalGuidanceCount,
      breakdown,
      breakdownText,
      quickNotes,
      prepChecklist,
      beforeStartItems: buildGuideBeforeStartItems(game, { trophies, roadmap, total, riskCounts }),
      prepCards: buildPrepCards(game, { trophies, roadmap }),
      beforeStartCards: buildBeforeStartCards(game, { trophies, roadmap, total, riskCounts }),
      roadmapStages: buildDecisionRoadmapStages({ roadmap: roadmapStagesSource }),
      criticalAlerts: buildCriticalTrophyAlerts(game, trophies),
      executionProfile: buildExecutionProfile(game, trophies, roadmap),
      routeChangingTrophies: buildRouteChangingTrophies(trophies),
      spotlightTrophies: trophies
        .filter(trophy => trophy?.is_spoiler || /perd|miss|colet|online|grind|dific/i.test(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`))
        .slice(0, 3)
        .map(trophy => ({
          name: trophy?.name || 'Troféu',
          label: trophy?.is_spoiler ? 'Spoiler / atenção' : (trophy?.type || 'Troféu'),
          text: trophy?.tip || trophy?.description || 'Revise este troféu antes de começar.'
        })),
      nextActionModel: deriveNextAction(game, completedSource),
      decisionModel: buildGuideDecisionModel(game, trophies, roadmap),
      difficultyLabel: getDifficultyProfileLabel(game?.difficulty),
      image: guideCover.image || imageResolver(game?.image),
      guideCover,
      heroImage: guideCover.image,
      heroImageMode: guideCover.mode,
      scopeModel,
      editorial: editorialSignals,
      snapshot: buildGuideSnapshot(game, trophies, roadmap, editorialSignals),
      isSaved: Boolean(options?.isSaved),
      libraryEntry: options?.libraryEntry || null,
      collectionModel: collectionClassifier(game, trophies)
    };
    viewModel.contextualFaq = buildContextualFaq(game, viewModel);
    viewModel.playerFit = buildGuidePlayerFit(game, viewModel);
    return viewModel;
  }

  return {
    firstGuideText,
    compactGuideText,
    normalizeGuideSignalText,
    isCompletionTrophy,
    isRealMissableTrophy,
    countRealMissableTrophies,
    getGuideTrophyTags,
    getGuideTrophyDisplayTags,
    getGuideTrophySearchText,
    buildGuideQuickDecisionModel,
    buildGuideShortcutModel,
    buildGuideStartContextModel,
    buildGuideSummaryCards,
    buildGuideRiskAlerts,
    buildGuideBeforeStartItems,
    getGuideNetworkRequirementModel,
    formatDisplayDate,
    buildGuideCoverModel,
    deriveNextAction,
    buildPlatinumSummary,
    buildBeforeStartCards,
    buildRouteChangingTrophies,
    safeRoadmapText,
    normalizeRoadmapStep,
    normalizeRoadmapForSave,
    isValidRoadmap,
    buildDecisionRoadmapStages,
    buildRoadmapStages,
    buildContextualFaq,
    buildGuidePlayerFit,
    buildGuideDecisionModel,
    getDecisionToneClass,
    getGuideRunEstimate,
    getGuideConfidenceModel,
    getGuideEditorialStatusBadge,
    buildGuideScopeModel,
    buildGuideDlcScopeModel,
    buildGuideSnapshot,
    getGuideVerdictInputs,
    buildThirtySecondVerdict,
    buildEditorialSignals,
    buildPrepCards,
    buildCriticalTrophyAlerts,
    buildGuidanceCounts,
    buildExecutionProfile,
    buildGuideViewModel
  };
});
