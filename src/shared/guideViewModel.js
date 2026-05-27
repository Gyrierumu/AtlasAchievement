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

  const GUIDE_TROPHY_TAG_PRIORITY = ['missable', 'final', 'boss', 'legendary', 'online', 'social', 'coop', 'difficulty', 'delivery', 'premium', 'rank-s', 'animals', 'attention', 'delivery-bot', 'likes', 'facilities', 'uca', 'structure', 'construction', 'crafting', 'routes', 'infrastructure', 'mines', 'monorail', 'side-quest', 'grind', 'collectible', 'memory', 'spoiler', 'cleanup', 'story', 'progress', 'progression', 'system', 'run'];

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

  const RESIDENT_EVIL_NON_COLLECTIBLE_IDS = new Set([
    're1r_ghost_chance',
    're1r_cqc_ftw',
    're1r_dont_stop_running',
    're1r_take_that_zombies',
    're1r_that_was_nice',
    're1r_great_guy'
  ]);
  const RESIDENT_EVIL_FORCED_TAGS_BY_ID = {
    re1r_ghost_chance: [
      { id: 'difficulty', label: 'Dificuldade', tone: 'warning' },
      { id: 'run', label: 'Risco de run', tone: 'warning' }
    ],
    re1r_cqc_ftw: [
      { id: 'difficulty', label: 'Dificuldade', tone: 'warning' },
      { id: 'run', label: 'Risco de run', tone: 'warning' }
    ],
    re1r_dont_stop_running: [
      { id: 'difficulty', label: 'Dificuldade', tone: 'warning' },
      { id: 'run', label: 'Risco de run', tone: 'warning' }
    ],
    re1r_take_that_zombies: [
      { id: 'difficulty', label: 'Dificuldade', tone: 'warning' },
      { id: 'story', label: 'História', tone: 'partial' }
    ],
    re1r_that_was_nice: [
      { id: 'run', label: 'Risco de run', tone: 'warning' }
    ],
    re1r_great_guy: [
      { id: 'run', label: 'Risco de run', tone: 'warning' }
    ]
  };
  const RESIDENT_EVIL_2_TAG_FIXES_BY_ID = {
    re2r_basics_survival: { remove: ['difficulty'] },
    re2r_hip_squares: { add: [{ id: 'collectible', label: 'Coletável', tone: 'partial' }] },
    re2r_customizer: { remove: ['story'], add: [{ id: 'collectible', label: 'Coletável', tone: 'partial' }] },
    re2r_no_stinkin_gun: { remove: ['difficulty', 'story'] },
    re2r_eat_this: { remove: ['difficulty'] },
    re2r_hold_em: { remove: ['missable', 'collectible'] },
    re2r_hats_off: { remove: ['collectible'] },
    re2r_gotcha: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re2r_treasure_hunter: { add: [{ id: 'collectible', label: 'Coletável', tone: 'partial' }] },
    re2r_super_spy: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re2r_young_escapee: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re2r_time_spare: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re2r_blink_eye: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re2r_lore_explorer: { remove: ['story'], add: [{ id: 'collectible', label: 'Coletável', tone: 'partial' }] },
    re2r_complete_vermin: { remove: ['story'], add: [{ id: 'collectible', label: 'Coletável', tone: 'partial' }] },
    re2r_leon_s: { remove: ['grind', 'cleanup'], add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re2r_scarlet_hero: { remove: ['grind'], add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re2r_hardcore_rookie: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re2r_hardcore_college: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re2r_minimalist: { remove: ['collectible'], add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re2r_small_footprint: { remove: ['collectible', 'story'], add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re2r_grim_reaper: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] }
  };
  const RESIDENT_EVIL_3_TAG_FIXES_BY_ID = {
    re3r_somebody_to_lean_on: { remove: ['collectible'], add: [{ id: 'spoiler', label: 'Spoiler', tone: 'warning' }, { id: 'story', label: 'História', tone: 'partial' }] },
    re3r_escape_city: { remove: ['collectible'], add: [{ id: 'spoiler', label: 'Spoiler', tone: 'warning' }, { id: 'story', label: 'História', tone: 'partial' }] },
    re3r_dominator: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re3r_nemesis_down: { add: [{ id: 'boss', label: 'Boss', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re3r_nemesis_down_rooftop: { add: [{ id: 'boss', label: 'Boss', tone: 'warning' }, { id: 'spoiler', label: 'Spoiler', tone: 'warning' }] },
    re3r_power_stones: { add: [{ id: 'collectible', label: 'Coletável', tone: 'partial' }] },
    re3r_unfortunaté_end: { add: [{ id: 'spoiler', label: 'Spoiler', tone: 'warning' }] },
    re3r_jill_valentine: { remove: ['grind', 'cleanup'], add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re3r_electric_slide: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re3r_nemesis_stage2: { add: [{ id: 'boss', label: 'Boss', tone: 'warning' }, { id: 'spoiler', label: 'Spoiler', tone: 'warning' }] },
    re3r_nemesis_stage3: { add: [{ id: 'boss', label: 'Boss', tone: 'warning' }, { id: 'spoiler', label: 'Spoiler', tone: 'warning' }] },
    re3r_hello_charlie: { add: [{ id: 'collectible', label: 'Coletável', tone: 'partial' }] },
    re3r_bookworm: { add: [{ id: 'collectible', label: 'Coletável', tone: 'partial' }] },
    re3r_goodbye_charlie: { add: [{ id: 'collectible', label: 'Coletável', tone: 'partial' }] },
    re3r_kendos_armory: { add: [{ id: 'collectible', label: 'Coletável', tone: 'partial' }] },
    re3r_master_unlocking: { add: [{ id: 'collectible', label: 'Coletável', tone: 'partial' }] },
    re3r_veteran: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }] },
    re3r_conqueror: { add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re3r_sensational_work: { remove: ['grind'], add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re3r_minimalist: { remove: ['collectible'], add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re3r_need_these_latér: { remove: ['collectible'], add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] },
    re3r_sprinter: { remove: ['grind'], add: [{ id: 'difficulty', label: 'Dificuldade', tone: 'warning' }, { id: 'run', label: 'Risco de run', tone: 'warning' }] }
  };

  function applyResidentEvilTagOverrides(tags = [], trophy = {}, game = {}) {
    const slug = String(game?.slug || '').trim().toLowerCase();
    const trophyId = String(trophy?.id || '').trim();
    let nextTags = Array.isArray(tags) ? tags.slice() : [];
    if (slug === 'resident-evil' && RESIDENT_EVIL_NON_COLLECTIBLE_IDS.has(trophyId)) {
      nextTags = nextTags.filter(tag => tag?.id !== 'collectible');
    }
    if (slug === 'resident-evil-2-remake' && RESIDENT_EVIL_2_TAG_FIXES_BY_ID[trophyId]) {
      const fix = RESIDENT_EVIL_2_TAG_FIXES_BY_ID[trophyId];
      nextTags = nextTags.filter(tag => !(fix.remove || []).includes(tag?.id));
      (fix.add || []).forEach(tag => {
        if (!nextTags.some(item => item?.id === tag.id)) nextTags.push(tag);
      });
    }
    if (slug === 'resident-evil-3-remake' && RESIDENT_EVIL_3_TAG_FIXES_BY_ID[trophyId]) {
      const fix = RESIDENT_EVIL_3_TAG_FIXES_BY_ID[trophyId];
      nextTags = nextTags.filter(tag => !(fix.remove || []).includes(tag?.id));
      (fix.add || []).forEach(tag => {
        if (!nextTags.some(item => item?.id === tag.id)) nextTags.push(tag);
      });
    }
    if (slug !== 'resident-evil') return nextTags;
    (RESIDENT_EVIL_FORCED_TAGS_BY_ID[trophyId] || []).forEach(tag => {
      if (!nextTags.some(item => item?.id === tag.id)) nextTags.push(tag);
    });
    return nextTags;
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

    if (String(game?.slug || '').trim().toLowerCase() === 'hollow-knight') {
      const trophyId = String(trophy?.id || '').trim();
      const hkTag = (id, label, tone = 'warning') => ({ id, label, tone });
      const fixes = {
        hollow_charmed: { add: [hkTag('collectible', 'Coletável', 'partial')] },
        hollow_enchanted: { add: [hkTag('collectible', 'Coletável', 'partial')] },
        hollow_blessed: { add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_protected: { add: [hkTag('collectible', 'Coletável', 'partial')] },
        hollow_masked: { add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_soulful: { add: [hkTag('collectible', 'Coletável', 'partial')] },
        hollow_worldsoul: { add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_connection: { add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_hope: { add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_grubfriend: { add: [hkTag('collectible', 'Coletável', 'partial')] },
        hollow_metamorphosis: { add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_cartographer: { add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_attunement: { remove: ['run'], add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_awakening: { remove: ['run', 'story'], add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_ascension: { remove: ['run', 'story'], add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_keen_hunter: { remove: ['missable'], add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_true_hunter: { remove: ['missable'], add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('cleanup', 'Cleanup', 'neutral')] },
        hollow_fool: { add: [hkTag('difficulty', 'Dificuldade', 'warning')] },
        hollow_grand_performance: { add: [hkTag('boss', 'Boss', 'warning'), hkTag('difficulty', 'Dificuldade', 'warning')] },
        hollow_nightmares_end: { remove: ['story'], add: [hkTag('boss', 'Boss', 'warning'), hkTag('difficulty', 'Dificuldade', 'warning')] },
        hollow_soul_and_shade: { add: [hkTag('difficulty', 'Dificuldade', 'warning'), hkTag('boss', 'Boss', 'warning')] },
        hollow_embrace_the_void: { remove: ['collectible'], add: [hkTag('difficulty', 'Dificuldade', 'warning'), hkTag('boss', 'Boss', 'warning')] },
        hollow_pure_completion: { add: [hkTag('collectible', 'Coletável', 'partial'), hkTag('difficulty', 'Dificuldade', 'warning'), hkTag('cleanup', 'Cleanup', 'neutral')] }
      };
      const fix = fixes[trophyId];
      if (fix) {
        const nextTags = tags.filter(tag => !(fix.remove || []).includes(tag?.id));
        (fix.add || []).forEach(tag => {
          if (!nextTags.some(item => item?.id === tag.id)) nextTags.push(tag);
        });
        return sortGuideTrophyTags(nextTags);
      }
      return sortGuideTrophyTags(tags);
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'marvels-spider-man') {
      const trophyId = String(trophy?.id || '').trim();
      const msmTag = (id, label, tone = 'warning') => ({ id, label, tone });
      const collectibleIds = new Set([
        'msm_i_heart_manhattan',
        'msm_backpacker',
        'msm_cat_prints',
        'msm_amazing_coverage',
        'msm_r_and_d',
        'msm_pigeon_hunter',
        'msm_sightseeing',
        'msm_lost_and_found',
        'msm_cats_out_of_the_bag'
      ]);
      const cleanupIds = new Set([
        'msm_superior_spider_man',
        'msm_i_heart_manhattan',
        'msm_master_of_masters',
        'msm_backpacker',
        'msm_cat_prints',
        'msm_inner_sanctuary',
        'msm_all_the_kings_men',
        'msm_mercenary_tactics',
        'msm_back_in_the_slammer',
        'msm_neighborhood_watch',
        'msm_a_suit_for_all_seasons',
        'msm_schooled',
        'msm_amazing_coverage',
        'msm_challenge_finder',
        'msm_r_and_d',
        'msm_science_ftw',
        'msm_pigeon_hunter',
        'msm_friendly_neighborhood_spider_man',
        'msm_overdrive',
        'msm_sightseeing',
        'msm_arachnophobia',
        'msm_with_great_power',
        'msm_a_bit_of_a_fixer_upper',
        'msm_ace_the_base'
      ]);
      const difficultyIds = new Set([
        'msm_master_of_masters',
        'msm_inner_sanctuary',
        'msm_all_the_kings_men',
        'msm_mercenary_tactics',
        'msm_back_in_the_slammer',
        'msm_short_fuse',
        'msm_fists_of_fury',
        'msm_ninja',
        'msm_spy_hunter',
        'msm_challenge_finder',
        'msm_ace_the_base'
      ]);
      const storyIds = new Set([
        'msm_demons_emerge',
        'msm_the_six_assemble',
        'msm_end_game',
        'msm_inner_sanctuary',
        'msm_mercenary_tactics',
        'msm_knocking_down_kingpin',
        'msm_staying_positive',
        'msm_grounded',
        'msm_sting_and_smash',
        'msm_tombstone_takedown',
        'msm_shock_and_awe'
      ]);
      const bossIds = new Set([
        'msm_master_of_masters',
        'msm_knocking_down_kingpin',
        'msm_staying_positive',
        'msm_grounded',
        'msm_sting_and_smash',
        'msm_tombstone_takedown',
        'msm_shock_and_awe'
      ]);
      const grindIds = new Set(['msm_superior_spider_man', 'msm_neighborhood_watch', 'msm_science_ftw', 'msm_overdrive', 'msm_arachnophobia']);
      const nextTags = tags.filter(tag => !['missable', 'online', 'coop', 'run', 'collectible', 'story', 'difficulty', 'grind', 'cleanup', 'boss'].includes(tag?.id));
      const add = tag => {
        if (!nextTags.some(item => item?.id === tag.id)) nextTags.push(tag);
      };
      if (collectibleIds.has(trophyId)) add(msmTag('collectible', 'Coletável', 'partial'));
      if (cleanupIds.has(trophyId)) add(msmTag('cleanup', 'Cleanup', 'neutral'));
      if (difficultyIds.has(trophyId)) add(msmTag('difficulty', 'Dificuldade', 'warning'));
      if (storyIds.has(trophyId)) add(msmTag('story', 'História', 'partial'));
      if (bossIds.has(trophyId)) add(msmTag('boss', 'Boss', 'warning'));
      if (grindIds.has(trophyId)) add(msmTag('grind', 'Grind', 'warning'));
      return nextTags;
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'marvels-spider-man-2') {
      const trophyId = String(trophy?.id || '').trim();
      const msm2Tag = (id, label, tone = 'partial') => ({ id, label, tone });
      const customTagsById = {
        msm2_amazing: [
          msm2Tag('progress', 'Progressão', 'partial')
        ],
        msm2_armed_and_dangerous: [
          msm2Tag('combat', 'Combate', 'warning'),
          msm2Tag('peter', 'Peter', 'partial')
        ],
        msm2_evolved: [
          msm2Tag('combat', 'Combate', 'warning'),
          msm2Tag('miles', 'Miles', 'partial')
        ],
        msm2_surge: [
          msm2Tag('combat', 'Combate', 'warning'),
          msm2Tag('peter', 'Peter', 'partial')
        ],
        msm2_kitted_out: [
          msm2Tag('progress', 'Progressão', 'partial'),
          msm2Tag('suits', 'Trajes', 'partial')
        ],
        msm2_to_the_max: [
          msm2Tag('progress', 'Progressão', 'partial'),
          msm2Tag('gadgets', 'Gadgets', 'partial')
        ],
        msm2_fully_loaded: [
          msm2Tag('progress', 'Progressão', 'partial'),
          msm2Tag('suit-tech', 'Suit Tech', 'partial')
        ],
        msm2_superior: [
          msm2Tag('map-completion', 'Coleta de mapa', 'partial'),
          msm2Tag('attention', 'Atenção', 'warning')
        ],
        msm2_funky_wireless_protocols: [
          msm2Tag('collectible', 'Coletável', 'partial'),
          msm2Tag('spider-bots', 'Spider-Bots', 'warning'),
          msm2Tag('attention', 'Atenção', 'warning')
        ],
        msm2_home_run: [
          msm2Tag('specific-location', 'Local específico', 'warning')
        ],
        msm2_soar: [
          msm2Tag('traversal', 'Travessia', 'partial'),
          msm2Tag('attention', 'Atenção', 'warning')
        ],
        msm2_hang_ten: [
          msm2Tag('traversal', 'Travessia', 'partial'),
          msm2Tag('tricks', 'Tricks', 'partial')
        ],
        msm2_splat: [
          msm2Tag('traversal', 'Travessia', 'partial'),
          msm2Tag('attention', 'Atenção', 'warning')
        ],
        msm2_just_let_go: [
          msm2Tag('specific-location', 'Local específico', 'warning'),
          msm2Tag('miles', 'Miles', 'partial')
        ],
        msm2_you_know_what_to_do: [
          msm2Tag('specific-location', 'Local específico', 'warning'),
          msm2Tag('peter', 'Peter', 'partial')
        ]
      };
      const nextTags = tags.filter(tag => !['missable', 'online', 'coop', 'run', 'collectible', 'story', 'difficulty', 'grind', 'cleanup', 'boss', 'spoiler'].includes(tag?.id));
      const add = tag => {
        if (!nextTags.some(item => item?.id === tag.id)) nextTags.push(tag);
      };
      (customTagsById[trophyId] || []).forEach(add);
      return nextTags;
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'marvels-spider-man-miles-morales') {
      const trophyId = String(trophy?.id || '').trim();
      const msmmTag = (id, label, tone = 'warning') => ({ id, label, tone });
      const storyIds = new Set([
        'msmm_rhino_rodeo',
        'msmm_hanging_by_a_thread',
        'msmm_the_core_of_the_problem',
        'msmm_true_deception',
        'msmm_the_harlem_express',
        'msmm_veloci_skates',
        'msmm_shared_history',
        'msmm_exploding_bulldozer',
        'msmm_family_drama',
        'msmm_ultimate_sacrifice',
        'msmm_a_gift_from_pete'
      ]);
      const collectibleIds = new Set([
        'msmm_urban_explorers',
        'msmm_memory_lane',
        'msmm_salvager',
        'msmm_deep_cuts'
      ]);
      const cleanupIds = new Set([
        'msmm_just_the_beginning',
        'msmm_a_new_home',
        'msmm_salvager',
        'msmm_under_their_noses',
        'msmm_underground_undone',
        'msmm_ready_for_anything',
        'msmm_come_at_the_king',
        'msmm_spider_training_complete',
        'msmm_petes_first_villain',
        'msmm_kitbash',
        'msmm_deep_cuts',
        'msmm_best_fries_in_town',
        'msmm_jjj_would_be_proud',
        'msmm_five_star_review',
        'msmm_mod_that_suit',
        'msmm_look_with_better_eyes',
        'msmm_never_give_up',
        'msmm_crime_master',
        'msmm_im_on_a_boat',
        'msmm_socially_acceptable',
        'msmm_plus_plus'
      ]);
      const difficultyIds = new Set([
        'msmm_never_saw_it_coming',
        'msmm_100x_combo',
        'msmm_launch_swing_and_dive',
        'msmm_punching_pixels',
        'msmm_dodging_light',
        'msmm_crime_master'
      ]);
      const grindIds = new Set([
        'msmm_from_the_rafters',
        'msmm_climbing_the_walls',
        'msmm_invisible_spider',
        'msmm_overcharge',
        'msmm_trapped',
        'msmm_crime_master',
        'msmm_nowhere_to_hide'
      ]);
      const bossIds = new Set([
        'msmm_exploding_bulldozer',
        'msmm_family_drama'
      ]);
      const customTagsById = {
        msmm_just_the_beginning: [
          msmmTag('progress', 'Progressão', 'partial'),
          msmmTag('new-game-plus', 'New Game+', 'warning'),
          msmmTag('cleanup', 'Cleanup', 'neutral')
        ],
        msmm_five_star_review: [
          msmmTag('app-fnsm', 'App FNSM', 'partial'),
          msmmTag('activities', 'Atividades', 'partial'),
          msmmTag('cleanup', 'Cleanup', 'neutral')
        ],
        msmm_like_a_rhino_in_a_china_shop: [
          msmmTag('attention', 'Atenção', 'warning'),
          msmmTag('mission-specific', 'Missão específica', 'warning'),
          msmmTag('replay', 'Replay', 'neutral')
        ],
        msmm_rhino_rodeo: [
          msmmTag('story', 'História', 'partial'),
          msmmTag('mission-specific', 'Missão específica', 'warning'),
          msmmTag('spoiler', 'Spoiler', 'warning')
        ],
        msmm_plus_plus: [
          msmmTag('new-game-plus', 'New Game+', 'warning'),
          msmmTag('story', 'História', 'partial')
        ]
      };
      const nextTags = tags.filter(tag => !['missable', 'online', 'coop', 'run', 'collectible', 'story', 'difficulty', 'grind', 'cleanup', 'boss'].includes(tag?.id));
      const add = tag => {
        if (!nextTags.some(item => item?.id === tag.id)) nextTags.push(tag);
      };
      (customTagsById[trophyId] || []).forEach(add);
      if (collectibleIds.has(trophyId)) add(msmmTag('collectible', 'Coletável', 'partial'));
      if (cleanupIds.has(trophyId)) add(msmmTag('cleanup', 'Cleanup', 'neutral'));
      if (difficultyIds.has(trophyId)) add(msmmTag('difficulty', 'Dificuldade', 'warning'));
      if (storyIds.has(trophyId)) add(msmmTag('story', 'História', 'partial'));
      if (bossIds.has(trophyId)) add(msmmTag('boss', 'Boss', 'warning'));
      if (grindIds.has(trophyId)) add(msmmTag('grind', 'Grind', 'warning'));
      return sortGuideTrophyTags(nextTags);
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'red-dead-redemption-2') {
      const nextTags = tags.filter(tag => !['missable', 'online', 'coop', 'run', 'collectible', 'story', 'difficulty', 'grind', 'cleanup', 'boss', 'spoiler'].includes(tag?.id));
      const add = tag => {
        if (!tag?.id || nextTags.some(item => item?.id === tag.id)) return;
        nextTags.push(tag);
      };
      (Array.isArray(trophy?.tags) ? trophy.tags : []).forEach(tag => {
        if (typeof tag === 'string') {
          const normalizedTag = normalizeGuideSignalText(tag).replace(/\s+/g, '-');
          add({ id: normalizedTag, label: tag, tone: /online|posse|pvp|multiplayer|aten/i.test(tag) ? 'warning' : 'partial' });
          return;
        }
        add({
          id: String(tag?.id || '').trim(),
          label: String(tag?.label || tag?.id || '').trim(),
          tone: tag?.tone || (/online|posse|pvp|multiplayer|aten/i.test(`${tag?.id || ''} ${tag?.label || ''}`) ? 'warning' : 'partial')
        });
      });
      return nextTags;
    }
    if (['death-stranding', 'death-stranding-2-on-the-beach'].includes(String(game?.slug || '').trim().toLowerCase())) {
      const nextTags = tags.filter(tag => !['missable', 'online', 'coop', 'run', 'collectible', 'story', 'difficulty', 'grind', 'cleanup', 'boss', 'spoiler'].includes(tag?.id));
      const add = tag => {
        if (!tag?.id || nextTags.some(item => item?.id === tag.id)) return;
        nextTags.push(tag);
      };
      (Array.isArray(trophy?.tags) ? trophy.tags : []).forEach(tag => {
        if (typeof tag === 'string') {
          const normalizedTag = normalizeGuideSignalText(tag).replace(/\s+/g, '-');
          add({ id: normalizedTag, label: tag, tone: /online|social|grind|dificuldade/i.test(tag) ? 'warning' : 'partial' });
          return;
        }
        add({
          id: String(tag?.id || '').trim(),
          label: String(tag?.label || tag?.id || '').trim(),
          tone: tag?.tone || (/online|social|grind|dificuldade/i.test(`${tag?.id || ''} ${tag?.label || ''}`) ? 'warning' : 'partial')
        });
      });
      return sortGuideTrophyTags(nextTags);
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-i') {
      const trophyId = String(trophy?.id || '').trim();
      if (trophyId === 'tlou1_master_of_unlocking' && !ids.has('difficulty')) {
        tags.push({ id: 'difficulty', label: 'Dificuldade', tone: 'warning' });
        ids.add('difficulty');
      }
      return sortGuideTrophyTags(tags.filter(tag => {
        if (['tlou1_no_matter_what', 'tlou1_geared_up'].includes(trophyId)) return tag?.id !== 'collectible';
        return true;
      }));
    }
    return sortGuideTrophyTags(applyResidentEvilTagOverrides(tags, trophy, game));
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

  function getGuideRiskCounts(trophies = [], game = {}) {
    const keys = GUIDE_TROPHY_TAG_PRIORITY.concat(['boss']);
    const counts = keys.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    let alertCount = 0;
    (Array.isArray(trophies) ? trophies : []).forEach(trophy => {
      const tags = getGuideTrophyTags(trophy, game);
      if (tags.length) alertCount += 1;
      tags.forEach(tag => {
        if (!tag?.id) return;
        counts[tag.id] = Number(counts[tag.id] || 0) + 1;
      });
    });
    return { ...counts, missable: countRealMissableTrophies(trophies), alertCount };
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
    const explicitCoopCount = countGuideExplicitCoop(trophies)
      || trophies.filter(trophy => trophy?.is_coop || trophy?.isCoop || (Array.isArray(trophy?.tags) && trophy.tags.some(tag => /coop|posse|multiplayer|pvp/i.test(`${tag?.id || tag} ${tag?.label || ''}`)))).length;
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
    if (/extras fora da platina base/.test(normalized)) {
      return {
        value: 'Extras fora da platina base',
        detail: dlcText,
        tone: 'atlas-meta-signal--complete'
      };
    }
    if (/valhalla fora da platina base/.test(normalized)) {
      return {
        value: 'Valhalla fora da platina base',
        detail: dlcText,
        tone: 'atlas-meta-signal--complete'
      };
    }
    if (game?.dlc_status === 'out_of_base_scope' || /dlc fora da platina base|shadow of the erdtree/.test(normalized)) {
      return {
        value: 'DLC fora da platina base',
        detail: dlcText,
        tone: 'atlas-meta-signal--complete'
      };
    }
    if (/left behind/.test(normalized) && /lista base|part i|29 trofeus|integra o pacote|incluido no part i|incluso na lista base/.test(normalized)) {
      return {
        value: 'Left Behind incluso na lista base',
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
    const network = getGuideNetworkRequirementModel(game, { ...viewModel, trophies });
    return {
      kind: hasPlatinum ? 'platinum' : 'completion',
      label: hasPlatinum ? 'Platina' : '100%',
      value: hasPlatinum ? 'Platina base' : '100%',
      subtitle: hasPlatinum ? 'Guia de troféus e roadmap da platina' : 'Guia de troféus e roadmap de 100%',
      detail: total ? `${total} troféu(s) no escopo atual. ${dlcScope.detail}` : dlcScope.detail,
      network
    };
  }

  function shouldReadRoadmapFirst(game = {}, trophies = [], roadmap = []) {
    const inputs = getGuideVerdictInputs(game, { trophies, roadmap, total: trophies.length });
    const riskCounts = ['marvels-spider-man', 'marvels-spider-man-miles-morales', 'red-dead-redemption-2'].includes(String(game?.slug || '').trim().toLowerCase())
      ? getGuideRiskCounts(trophies, game)
      : getRiskCounts(trophies);
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
    else if (/extras fora da platina base/.test(normalizedDlc)) {
      dlcValue = 'Extras fora da platina base';
    } else if (/valhalla fora da platina base/.test(normalizedDlc)) {
      dlcValue = 'Valhalla fora da platina base';
    } else if (/dlc fora da platina base/.test(normalizedDlc)) {
      dlcValue = 'DLC fora da platina base';
    } else if (/left behind/.test(normalizedDlc) && /lista base|part i|29 trofeus|integra o pacote|incluido no part i|incluso na lista base/.test(normalizedDlc)) {
      dlcValue = 'Left Behind incluso na lista base';
    } else if (/lista base|jogo base|base game|sem dlc|nao inclui|nao foram adicionados|nao foi misturado|dlc nao necessaria|nao e necessaria|fora do escopo|ficam fora|entrada separada/.test(normalizedDlc)) {
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
      if (['god-of-war', 'god-of-war-2018', 'god-of-war-ragnarok'].includes(String(game?.slug || '').trim().toLowerCase())) {
        return {
          kind: 'roadmap',
          title: 'Avance a história em uma dificuldade confortável',
          detail: firstRunAdvice || 'Jogue a campanha naturalmente, explore quando quiser e deixe o cleanup pesado para depois da história.',
          cta: 'Abrir roadmap',
          focus: 'roadmap',
          trophyId: firstPending?.id || '',
          trophyName: firstPending?.name || ''
        };
      }
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
      if (String(game?.slug || '').trim().toLowerCase() === 'dead-cells') {
        return {
          kind: 'roadmap',
          title: 'Aprenda o ciclo de runs e desbloqueie upgrades permanentes',
          detail: firstRunAdvice || 'Faça runs exploratórias para aprender inimigos, liberar runas, melhorar frascos e entregar blueprints úteis ao Collector.',
          cta: 'Abrir roadmap',
          focus: 'roadmap',
          trophyId: firstPending?.id || '',
          trophyName: firstPending?.name || ''
        };
      }
      if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil') {
        return {
          kind: 'roadmap',
          title: 'Faça uma primeira run segura aprendendo a mansão',
          detail: firstRunAdvice || 'Use a primeira campanha para entender rotas, inventário, puzzles, saves e resgates antes de tentar speedrun, sem salvar ou faca-only.',
          cta: 'Abrir roadmap',
          focus: 'roadmap',
          trophyId: firstPending?.id || '',
          trophyName: firstPending?.name || ''
        };
      }
      if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil-2-remake') {
        return {
          kind: 'roadmap',
          title: 'Faça uma primeira campanha segura aprendendo o R.P.D.',
          detail: firstRunAdvice || 'Comece com uma campanha segura para aprender o Departamento de Polícia, puzzles, inventário, rotas, chefes e recursos antes de tentar rankings ou condições especiais.',
          cta: 'Abrir roadmap',
          focus: 'roadmap',
          trophyId: firstPending?.id || '',
          trophyName: firstPending?.name || ''
        };
      }
      if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil-3-remake') {
        return {
          kind: 'roadmap',
          title: 'Faça uma primeira campanha segura aprendendo rotas, Nemesis e coletáveis',
          detail: firstRunAdvice || 'Comece em uma dificuldade confortável para aprender mapas, puzzles, perseguições, chefes, recursos, arquivos, Charlie Dolls, cofres e upgrades antes de tentar rank, Inferno ou runs com restrição.',
          cta: 'Abrir roadmap',
          focus: 'roadmap',
          trophyId: firstPending?.id || '',
          trophyName: firstPending?.name || ''
        };
      }
      if (String(game?.slug || '').trim().toLowerCase() === 'hollow-knight') {
        return {
          kind: 'roadmap',
          title: 'Explore Hallownest antes de mirar Void Heart, 112% e Godhome',
          detail: firstRunAdvice || 'Faça uma primeira run de aprendizado para abrir mapas, atalhos, habilidades, amuletos, melhorias do Ferrão e chefes. Antes de obter Void Heart, conclua o final básico The Hollow Knight no mesmo save.',
          cta: 'Abrir roadmap',
          focus: 'roadmap',
          trophyId: firstPending?.id || '',
          trophyName: firstPending?.name || ''
        };
      }
      if (String(game?.slug || '').trim().toLowerCase() === 'marvels-spider-man') {
        return {
          kind: 'roadmap',
          title: 'Avance a campanha e abra a cidade antes do 100% dos distritos',
          detail: firstRunAdvice || 'Jogue em uma dificuldade confortável, desbloqueie habilidades, gadgets, torres e atividades de distrito, coletando o que estiver no caminho. Deixe crimes, desafios, trajes e 100% dos distritos para a limpeza final quando o mapa estiver mais aberto.',
          cta: 'Abrir roadmap',
          focus: 'roadmap',
          trophyId: firstPending?.id || '',
          trophyName: firstPending?.name || ''
        };
      }
      if (String(game?.slug || '').trim().toLowerCase() === 'marvels-spider-man-miles-morales') {
        return {
          kind: 'roadmap',
          title: 'Avance a campanha e prepare o New Game+',
          detail: firstRunAdvice || 'Na primeira campanha, abra distritos, libere Spider-Treino, use Venom e camuflagem, faça atividades próximas e guarde recursos para trajes, habilidades e aprimoramentos.',
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
    const currentSlug = String(game?.slug || '').trim().toLowerCase();
    const cards = [];

    if (runs || /multiplas|varias|multi-run|run|campanha dedicada|speedrun/.test(guideText) || riskCounts.run) {
      cards.push({
        tag: 'Runs',
        title: runs || 'O guia menciona runs ou campanhas específicas',
        text: runs
          ? (currentSlug === 'marvels-spider-man'
            ? 'Use esta estrutura antes de misturar história, pendências finais e restrições.'
            : 'Use esta estrutura antes de misturar história, cleanup e restrições.')
          : 'Há sinais no roadmap, alerta ou troféus de que a ordem das runs muda o esforço.'
      });
    }
    if (hasMissableRisk) {
      cards.push({ tag: 'Perdíveis', title: `${missableCount || riskCounts.missable || 1} ponto(s) com risco de perda`, text: game?.missable || 'Revise os troféus marcados antes de avançar demais na campanha.' });
    }
    if (riskCounts.spoiler) cards.push({ tag: 'Spoiler', title: `${riskCounts.spoiler} troféu(s) escondem informação sensível`, text: 'Revele detalhes só quando fizer sentido para sua run atual.' });
    if (riskCounts.collectible) cards.push({ tag: 'Coletáveis', title: `${riskCounts.collectible} troféu(s) com sinal de coleta ou checklist`, text: 'Marque progresso desde cedo para evitar varrer áreas sem contexto no final.' });
    if (difficulty >= 7 || riskCounts.difficulty) cards.push({ tag: 'Dificuldade', title: difficulty >= 7 ? `Dificuldade ${difficulty}/10` : `${riskCounts.difficulty} troféu(s) exigem atenção mecânica`, text: 'Separe tempo para treino, rotas seguras e leitura dos pontos mais exigentes antes da execução.' });
    if (riskCounts.cleanup || /cleanup|limpeza|pos-jogo|post-game|deixe para o final/.test(guideText)) {
      cards.push(currentSlug === 'marvels-spider-man'
        ? { tag: 'Limpeza final', title: `${riskCounts.cleanup || 1} sinal(is) de limpeza planejada`, text: 'Deixe a limpeza final para o momento indicado pelo roadmap em vez de caçar pendências cedo demais.' }
        : { tag: 'Cleanup', title: `${riskCounts.cleanup || 1} sinal(is) de limpeza planejada`, text: 'Deixe o cleanup para o momento indicado pelo roadmap em vez de caçar pendências cedo demais.' });
    }
    if (String(game?.grind || '').trim() || riskCounts.grind) cards.push({ tag: 'Grind', title: String(game?.grind || '').trim() || `${riskCounts.grind} troféu(s) parecem envolver repetição`, text: 'Planeje farm, rank, recursos ou repetição para não descobrir esse custo só no fim.' });
    if (!cards.length) cards.push({ tag: 'Leitura inicial', title: 'Sem alerta forte cadastrado antes da checklist', text: 'O guia não aponta um grande bloqueio editorial, mas o roadmap ainda deve vir antes da lista completa.' });
    return cards;
  }

  function buildRouteChangingTrophies(trophies = [], game = {}) {
    const trophyById = new Map((Array.isArray(trophies) ? trophies : []).map(trophy => [trophy?.id, trophy]).filter(([id]) => id));
    if (String(game?.slug || '').trim().toLowerCase() === 'death-stranding') {
      const trophyByName = new Map((Array.isArray(trophies) ? trophies : [])
        .map(trophy => [String(trophy?.trophyNameOriginal || trophy?.originalName || trophy?.officialName || trophy?.name || '').trim().toLowerCase(), trophy])
        .filter(([name]) => name));
      const attentionTag = (id, label, tone = 'warning') => ({ id, label, tone });
      const read = (id, fallbackName) => {
        const trophy = trophyById.get(id) || trophyByName.get(String(fallbackName || '').trim().toLowerCase()) || {};
        return {
          name: trophy.trophyNameOriginal || trophy.originalName || trophy.officialName || trophy.name || fallbackName,
          originalName: trophy.trophyNamePtBr || trophy.name_pt || trophy.localizedNamePtBr || ''
        };
      };
      return [
        {
          id: 'ds_growth_of_a_legend',
          ...read('ds_growth_of_a_legend', 'Growth of a Legend'),
          type: 'Dificuldade / Entregas / Grind',
          text: 'Exige Premium Deliveries com avaliação Legend of Legends na dificuldade Hard. Acompanhe categorias e evite repetir entregas sem progresso.',
          tags: [attentionTag('difficulty', 'Dificuldade'), attentionTag('delivery', 'Entregas'), attentionTag('grind', 'Grind')],
          score: 100
        },
        {
          id: 'ds_best_beloved',
          ...read('ds_best_beloved', 'Best Beloved'),
          type: 'Instalações / Grind',
          text: 'Leve todas as instalações a 5 estrelas. É um dos maiores blocos de trabalho e fica muito melhor com rotas e ziplines no pós-game.',
          tags: [attentionTag('facilities', 'Instalações'), attentionTag('grind', 'Grind')],
          score: 99
        },
        {
          id: 'ds_fount_of_knowledge',
          ...read('ds_fount_of_knowledge', 'Fount of Knowledge'),
          type: 'Coletáveis / Memory Chips',
          text: 'Restaure todos os 56 Memory Chips. Alguns dependem de e-mails e conexões, então use checklist antes da varredura final.',
          tags: [attentionTag('collectible', 'Coletáveis', 'partial'), attentionTag('memory', 'Memory Chips', 'partial')],
          score: 98
        },
        {
          id: 'ds_homo_faber',
          ...read('ds_homo_faber', 'Homo Faber'),
          type: 'Crafting / Grind',
          text: 'Fabrique todos os equipamentos, armas e veículos da lista base. Alguns planos dependem de instalações, história e Memory Chips.',
          tags: [attentionTag('crafting', 'Crafting', 'partial'), attentionTag('grind', 'Grind')],
          score: 97
        },
        {
          id: 'ds_trail_blazer',
          ...read('ds_trail_blazer', 'Trail-Blazer'),
          type: 'Estruturas / Grind',
          text: 'Atualize todos os tipos de estrutura exigidos. Deixe para quando tiver materiais e instalações maximizadas para reduzir viagens extras.',
          tags: [attentionTag('structure', 'Estruturas', 'partial'), attentionTag('grind', 'Grind')],
          score: 96
        },
        {
          id: 'ds_a_helping_hand',
          ...read('ds_a_helping_hand', 'A Helping Hand'),
          type: 'Online / Social',
          text: 'Emita uma supply request conectado aos servidores. É online assíncrono/social, sem coop direto.',
          tags: [attentionTag('online', 'Online'), attentionTag('social', 'Social')],
          score: 95
        },
        {
          id: 'ds_a_shout_in_the_dark',
          ...read('ds_a_shout_in_the_dark', 'A Shout in the Dark'),
          type: 'Online / Social',
          text: 'Use shout e receba resposta assíncrona. Planeje junto do cleanup online/social.',
          tags: [attentionTag('online', 'Online'), attentionTag('social', 'Social')],
          score: 94
        },
        {
          id: 'ds_building_bridges',
          ...read('ds_building_bridges', 'Building Bridges'),
          type: 'Online / Social',
          text: 'Bridge Link depende de estruturas, likes e servidores online assíncronos. Não exige coop tradicional.',
          tags: [attentionTag('online', 'Online'), attentionTag('social', 'Social')],
          score: 93
        },
        {
          id: 'ds_great_deliverer',
          ...read('ds_great_deliverer', 'Great Deliverer'),
          type: 'Online / Social / Grind',
          text: 'A categoria Bridge Link entra no grind das avaliações de entrega e se beneficia de likes e interação assíncrona.',
          tags: [attentionTag('online', 'Online'), attentionTag('social', 'Social'), attentionTag('grind', 'Grind')],
          score: 92
        }
      ].filter(item => trophyById.has(item.id) || trophyByName.has(String(item.name || '').trim().toLowerCase()));
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'death-stranding-2-on-the-beach') {
      const trophyByName = new Map((Array.isArray(trophies) ? trophies : [])
        .map(trophy => [String(trophy?.trophyNameOriginal || trophy?.originalName || trophy?.officialName || trophy?.name || '').trim().toLowerCase(), trophy])
        .filter(([name]) => name));
      const attentionTag = (id, label, tone = 'warning') => ({ id, label, tone });
      const read = (id, fallbackName) => {
        const trophy = trophyById.get(id) || trophyByName.get(String(fallbackName || '').trim().toLowerCase()) || {};
        return {
          name: trophy.trophyNameOriginal || trophy.originalName || trophy.officialName || trophy.name || fallbackName,
          originalName: trophy.trophyNamePtBr || trophy.name_pt || trophy.localizedNamePtBr || ''
        };
      };
      return [
        {
          id: 'ds2_seasoned_porter',
          ...read('ds2_seasoned_porter', 'Seasoned Porter'),
          type: 'Entregas / Rank S / Atenção',
          text: 'Exige 10 entregas, 10 recuperações e 10 pedidos de eliminação/destruição com rank S em Casual ou superior.',
          tags: [attentionTag('delivery', 'Entregas'), attentionTag('rank-s', 'Rank S'), attentionTag('attention', 'Atenção')],
          score: 100
        },
        {
          id: 'ds2_connecting_hearts_and_minds',
          ...read('ds2_connecting_hearts_and_minds', 'Connecting Hearts and Minds'),
          type: 'Instalações / Grind',
          text: 'Maximize o nível de conexão com todas as instalações. É um dos maiores blocos de trabalho da platina.',
          tags: [attentionTag('facilities', 'Instalações'), attentionTag('grind', 'Grind')],
          score: 99
        },
        {
          id: 'ds2_a_porter_at_peak_popularity',
          ...read('ds2_a_porter_at_peak_popularity', 'A Porter at Peak Popularity'),
          type: 'Likes / Grind',
          text: 'Receba 50.000 curtidas por pedidos. Rotas eficientes, conexões altas e infraestrutura reduzem bastante o tempo.',
          tags: [attentionTag('likes', 'Likes'), attentionTag('grind', 'Grind')],
          score: 98
        },
        {
          id: 'ds2_master_builder',
          ...read('ds2_master_builder', 'Master Builder'),
          type: 'Estruturas / Construção',
          text: 'Construa todos os tipos de estrutura e confirme itens especiais liberados pela campanha.',
          tags: [attentionTag('structure', 'Estruturas', 'partial'), attentionTag('construction', 'Construção', 'partial')],
          score: 97
        },
        {
          id: 'ds2_road_restorer',
          ...read('ds2_road_restorer', 'Road Restorer'),
          type: 'Infraestrutura',
          text: 'Restaure uma seção de estrada usando materiais nos Auto-Pavers. Combine com rotas de entregas frequentes.',
          tags: [attentionTag('infrastructure', 'Infraestrutura', 'partial')],
          score: 96
        },
        {
          id: 'ds2_rail_restorer',
          ...read('ds2_rail_restorer', 'Rail Restorer'),
          type: 'Monotrilho / Infraestrutura',
          text: 'Restaure e reabra uma linha completa de monotrilho. Planeje materiais e instalações conectadas antes de fechar.',
          tags: [attentionTag('monorail', 'Monotrilho', 'partial'), attentionTag('infrastructure', 'Infraestrutura', 'partial')],
          score: 95
        },
        {
          id: 'ds2_dig_dig_dig',
          ...read('ds2_dig_dig_dig', 'Dig, Dig, Dig!'),
          type: 'Minas / Infraestrutura',
          text: 'Restaure três minas. Deixe para uma etapa de infraestrutura para aproveitar materiais e rotas já abertas.',
          tags: [attentionTag('mines', 'Minas', 'partial'), attentionTag('infrastructure', 'Infraestrutura', 'partial')],
          score: 94
        },
        {
          id: 'ds2_rare_specimen_rescuer',
          ...read('ds2_rare_specimen_rescuer', 'Rare Specimen Rescuer'),
          type: 'Animais / Atenção',
          text: 'Entregue um animal albino ao abrigo. Marque no checklist quando encontrar oportunidade para evitar busca solta no fim.',
          tags: [attentionTag('animals', 'Animais', 'partial'), attentionTag('attention', 'Atenção')],
          score: 93
        },
        {
          id: 'ds2_promising_signs',
          ...read('ds2_promising_signs', 'Promising Signs'),
          type: 'Online / Social',
          text: 'Construa uma placa online de pedido de ajuda. Exige conexão social/assíncrona, sem coop direto.',
          tags: [attentionTag('online', 'Online'), attentionTag('social', 'Social')],
          score: 92
        },
        {
          id: 'ds2_emergency_worker',
          ...read('ds2_emergency_worker', 'Emergency Worker'),
          type: 'Online / Social',
          text: 'Forneça apoio emergencial conectado aos servidores. Planeje junto dos outros troféus sociais.',
          tags: [attentionTag('online', 'Online'), attentionTag('social', 'Social')],
          score: 91
        },
        {
          id: 'ds2_porters_make_the_world_go_round',
          ...read('ds2_porters_make_the_world_go_round', 'Porters Make the World Go Round'),
          type: 'Online / Social',
          text: 'Faça uma troca com outro portador. É interação social/assíncrona e não transforma o guia em coop.',
          tags: [attentionTag('online', 'Online'), attentionTag('social', 'Social')],
          score: 90
        }
      ].filter(item => trophyById.has(item.id) || trophyByName.has(String(item.name || '').trim().toLowerCase()));
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'red-dead-redemption-2') {
      const trophyByName = new Map((Array.isArray(trophies) ? trophies : [])
        .map(trophy => [String(trophy?.name || trophy?.trophyNameOriginal || trophy?.originalName || trophy?.officialName || '').trim().toLowerCase(), trophy])
        .filter(([name]) => name));
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      const read = (id, fallbackName) => {
        const trophy = trophyById.get(id) || trophyByName.get(String(fallbackName || '').trim().toLowerCase()) || {};
        return {
          name: trophy.name || trophy.trophyNameOriginal || fallbackName,
          originalName: trophy.name_pt || trophy.trophyNamePtBr || ''
        };
      };
      return [
        {
          id: 'rdr2_lending_a_hand',
          ...read('rdr2_lending_a_hand', 'Lending a Hand'),
          type: 'Perdível / Honra',
          text: 'Complete as missões opcionais de honra da campanha antes de avançar demais, especialmente no Capítulo 6.',
          tags: [attentionTag('Perdível', 'risk'), attentionTag('Honra', 'warning')],
          score: 100
        },
        {
          id: 'rdr2_friends_with_benefits',
          ...read('rdr2_friends_with_benefits', 'Friends With Benefits'),
          type: 'Perdível / Acampamento',
          text: 'Faça pelo menos uma atividade com companheiro em cada acampamento relevante enquanto ele ainda estiver ativo.',
          tags: [attentionTag('Perdível', 'risk'), attentionTag('Acampamento', 'warning')],
          score: 99
        },
        {
          id: 'rdr2_give_to_the_poor',
          ...read('rdr2_give_to_the_poor', 'Give to the Poor'),
          type: 'Perdível / Acampamento',
          text: 'Doe US$ 250 à caixa da gangue antes de perder acesso normal ao cofre do acampamento.',
          tags: [attentionTag('Perdível', 'risk'), attentionTag('Acampamento', 'warning')],
          score: 98
        },
        {
          id: 'rdr2_errand_boy',
          ...read('rdr2_errand_boy', 'Errand Boy'),
          type: 'Perdível / Acampamento',
          text: 'Aceite e entregue pedidos de itens de companheiros enquanto os capítulos e personagens ainda permitem.',
          tags: [attentionTag('Perdível', 'risk'), attentionTag('Acampamento', 'warning')],
          score: 97
        },
        {
          id: 'rdr2_gold_rush',
          ...read('rdr2_gold_rush', 'Gold Rush'),
          type: 'Grind / Medalhas',
          text: 'Use replay de missões para buscar 70 medalhas de ouro. Não é perdível, mas é um dos maiores grinds da platina.',
          tags: [attentionTag('Grind', 'warning'), attentionTag('Medalhas', 'warning')],
          score: 96
        },
        {
          id: 'rdr2_skin_deep',
          ...read('rdr2_skin_deep', 'Skin Deep'),
          type: 'Animais / Grind',
          text: 'Organize espécies por checklist e bioma para não repetir áreas. Trate como grind longo, não como perdível principal.',
          tags: [attentionTag('Animais', 'warning'), attentionTag('Grind', 'warning')],
          score: 95
        },
        {
          id: 'rdr2_zoologist',
          ...read('rdr2_zoologist', 'Zoologist'),
          type: 'Animais / Grind',
          text: 'Estude espécies com controle por região e avance em blocos para reduzir retrabalho no pós-game.',
          tags: [attentionTag('Animais', 'warning'), attentionTag('Grind', 'warning')],
          score: 94
        },
        {
          id: 'rdr2_notorious',
          ...read('rdr2_notorious', 'Notorious'),
          type: 'Online / Grind',
          text: 'Rank 50 em Red Dead Online é a maior barreira de progresso online. Separe uma etapa própria para XP, eventos e missões.',
          tags: [attentionTag('Online', 'warning'), attentionTag('Grind', 'warning')],
          score: 93
        },
        {
          id: 'rdr2_the_real_deal',
          ...read('rdr2_the_real_deal', 'The Real Deal'),
          type: 'Online / PvP',
          text: 'Exige MVP 3 vezes em partidas com pelo menos 4 jogadores. Modos objetivos e playlists favoráveis reduzem a fricção.',
          tags: [attentionTag('Online', 'warning'), attentionTag('PvP', 'warning')],
          score: 92
        },
        {
          id: 'rdr2_alls_fair',
          ...read('rdr2_alls_fair', "All's Fair"),
          type: 'Online / Posse',
          text: 'Depende de interferir em missão Free Roam de uma Posse rival. Costuma ser mais simples organizar com outro jogador.',
          tags: [attentionTag('Online', 'warning'), attentionTag('Posse', 'warning')],
          score: 91
        },
        {
          id: 'rdr2_strength_in_numbers',
          ...read('rdr2_strength_in_numbers', 'Strength in Numbers'),
          type: 'Online / Posse',
          text: 'Complete uma Free Roam Mission em Posse com pelo menos 2 membros. Planeje junto dos outros troféus de Posse.',
          tags: [attentionTag('Online', 'warning'), attentionTag('Posse', 'warning')],
          score: 90
        }
      ].filter(item => trophyById.has(item.id) || trophyByName.has(String(item.name || '').trim().toLowerCase()));
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'marvels-spider-man') {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 'msm_attention_districts',
          name: '100% dos distritos',
          type: 'Coletável / Limpeza final',
          text: 'O maior volume da platina está em limpar distritos: crimes, bases, desafios, coletáveis e atividades de mapa. Alterne com a campanha para não deixar tudo repetitivo no final.',
          tags: [attentionTag('Coletável / Limpeza final', 'partial')],
          score: 100
        },
        {
          id: 'msm_attention_crimes',
          name: 'Crimes por distrito',
          type: 'Grind / Pendências finais',
          text: 'Crimes aparecem por região e podem virar grind se acumularem. Resolva parte deles enquanto atravessa a cidade.',
          tags: [attentionTag('Grind / Pendências finais', 'warning')],
          score: 99
        },
        {
          id: 'msm_attention_challenges',
          name: 'Desafios e pontuações',
          type: 'Dificuldade / Pendências finais',
          text: 'Alguns desafios exigem boa mobilidade, gadgets e execução. Deixe pontuações melhores para depois de liberar upgrades.',
          tags: [attentionTag('Dificuldade / Pendências finais', 'warning')],
          score: 98
        },
        {
          id: 'msm_attention_upgrades',
          name: 'Trajes, gadgets e upgrades',
          type: 'Recursos / Pendências finais',
          text: 'Tokens e recursos de atividades alimentam trajes e melhorias. Evite gastar sem olhar o que ainda será necessário para a checklist.',
          tags: [attentionTag('Recursos / Pendências finais', 'partial')],
          score: 97
        },
        {
          id: 'msm_attention_extras',
          name: 'DLC, NG+ e extras',
          type: 'DLC / Checklist',
          text: 'The City That Never Sleeps, New Game+, Ultimate e extras do Remastered ficam separados da platina base. Não misture esses pacotes com a rota principal.',
          tags: [attentionTag('DLC / Checklist', 'neutral')],
          score: 96
        }
      ];
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'marvels-spider-man-2') {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      const read = (id, fallbackName) => {
        const trophy = trophyById.get(id) || {};
        return {
          name: trophy.name || trophy.trophyNameOriginal || fallbackName,
          originalName: trophy.name_pt || trophy.trophyNamePtBr || ''
        };
      };
      return [
        {
          id: 'msm2_superior',
          ...read('msm2_superior', 'Superior'),
          type: 'Coleta de mapa / Atenção',
          text: 'Exige 100% de todos os distritos. Acompanhe contadores do mapa e use saves manuais antes de limpezas grandes se algum contador parecer preso.',
          tags: [attentionTag('Coleta de mapa', 'partial'), attentionTag('Atenção', 'warning')],
          score: 100
        },
        {
          id: 'msm2_funky_wireless_protocols',
          ...read('msm2_funky_wireless_protocols', 'Funky Wireless Protocols'),
          type: 'Coletável / Spider-Bots / Atenção',
          text: 'Spider-Bots não seguem o mesmo padrão de marcação do mapa. Use checklist próprio para não transformar o final em varredura cega.',
          tags: [attentionTag('Coletável', 'partial'), attentionTag('Spider-Bots', 'warning')],
          score: 99
        },
        {
          id: 'msm2_soar',
          ...read('msm2_soar', 'Soar'),
          type: 'Travessia / Atenção',
          text: 'Plane do Financial District até Astoria com Web Wings e túneis de vento. Faça em rota longa e sem pousar antes de cruzar a região.',
          tags: [attentionTag('Travessia', 'partial'), attentionTag('Atenção', 'warning')],
          score: 98
        },
        {
          id: 'msm2_hang_ten',
          ...read('msm2_hang_ten', 'Hang Ten'),
          type: 'Travessia / Tricks',
          text: 'Requer 30 manobras aéreas seguidas sem tocar o chão. Ganhe altura e use uma avenida longa para manter a sequência.',
          tags: [attentionTag('Travessia', 'partial'), attentionTag('Tricks', 'partial')],
          score: 97
        },
        {
          id: 'msm2_splat',
          ...read('msm2_splat', 'Splat'),
          type: 'Travessia / Atenção',
          text: 'Faça uma trick no ar e deixe o personagem cair no chão antes de recuperar o balanço. É simples, mas fácil de esquecer no cleanup.',
          tags: [attentionTag('Travessia', 'partial'), attentionTag('Atenção', 'warning')],
          score: 96
        },
        {
          id: 'msm2_home_run',
          ...read('msm2_home_run', 'Home Run!'),
          type: 'Local específico',
          text: 'Vá ao Big Apple Ballers Stadium em Downtown Brooklyn e percorra as quatro bases no campo.',
          tags: [attentionTag('Local específico', 'warning')],
          score: 95
        },
        {
          id: 'msm2_just_let_go',
          ...read('msm2_just_let_go', 'Just Let Go'),
          type: 'Local específico / Miles',
          text: 'Use Miles e visite a torre da igreja no Financial District para encontrar o troféu de ciências de Miles e Phin.',
          tags: [attentionTag('Local específico', 'warning'), attentionTag('Miles', 'partial')],
          score: 94
        },
        {
          id: 'msm2_you_know_what_to_do',
          ...read('msm2_you_know_what_to_do', 'You Know What to Do'),
          type: 'Local específico / Peter',
          text: 'Use Peter e visite o túmulo da Tia May no cemitério ao norte do mapa.',
          tags: [attentionTag('Local específico', 'warning'), attentionTag('Peter', 'partial')],
          score: 93
        }
      ];
    }
    if (String(game?.slug || '').trim().toLowerCase() === 'marvels-spider-man-miles-morales') {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      const read = (id, fallbackName) => {
        const trophy = trophyById.get(id) || {};
        return {
          name: trophy.name || trophy.trophyNameOriginal || fallbackName,
          originalName: trophy.name_pt || trophy.trophyNamePtBr || ''
        };
      };
      return [
        {
          id: 'msmm_just_the_beginning',
          ...read('msmm_just_the_beginning', 'Just the Beginning'),
          type: 'Progressão / New Game+ / Cleanup',
          text: 'Todas as habilidades exigem progresso da campanha, Spider-Treino e habilidades restantes do New Game+. Combine com Plus Plus antes de fechar o checklist.',
          tags: [attentionTag('Progressão', 'partial'), attentionTag('New Game+', 'warning'), attentionTag('Cleanup', 'neutral')],
          score: 100
        },
        {
          id: 'msmm_five_star_review',
          ...read('msmm_five_star_review', 'Five Star Review'),
          type: 'App FNSM / Atividades / Cleanup',
          text: 'Complete todos os pedidos do app FNSM enquanto limpa os distritos. Eles ajudam com recursos e evitam pendências soltas no fim.',
          tags: [attentionTag('App FNSM', 'partial'), attentionTag('Atividades', 'partial'), attentionTag('Cleanup', 'neutral')],
          score: 99
        },
        {
          id: 'msmm_like_a_rhino_in_a_china_shop',
          ...read('msmm_like_a_rhino_in_a_china_shop', 'Like a Rhino In A China Shop'),
          type: 'Atenção / Missão específica / Replay',
          text: 'Quebre objetos no shopping durante a sequência do Rhino. Se passar sem fazer, repita a missão ou resolva no New Game+; não é perdível real.',
          tags: [attentionTag('Atenção', 'warning'), attentionTag('Missão específica', 'warning'), attentionTag('Replay', 'neutral')],
          score: 98
        },
        {
          id: 'msmm_rhino_rodeo',
          ...read('msmm_rhino_rodeo', 'Rhino Rodeo'),
          type: 'História / Missão específica / Spoiler',
          text: 'Troféu ligado à sequência inicial com Rhino. Não marque como perdível: a história e o replay de missão cobrem essa pendência.',
          tags: [attentionTag('História', 'partial'), attentionTag('Missão específica', 'warning'), attentionTag('Spoiler', 'spoiler')],
          score: 97
        },
        {
          id: 'msmm_plus_plus',
          ...read('msmm_plus_plus', 'Plus Plus'),
          type: 'New Game+ / História',
          text: 'New Game+ é obrigatório para a platina. Planeje uma segunda campanha objetiva depois de limpar o que for conveniente na primeira.',
          tags: [attentionTag('New Game+', 'warning'), attentionTag('História', 'partial')],
          score: 96
        }
      ].filter(item => trophyById.has(item.id));
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'hollow-knight') {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      const read = (id, fallbackName, fallbackOriginal) => {
        const trophy = trophyById.get(id) || {};
        return {
          name: trophy.name_pt || trophy.trophyNamePtBr || fallbackName,
          originalName: trophy.name || trophy.trophyNameOriginal || fallbackOriginal
        };
      };
      const hollowKnightAttention = [
        {
          id: 'hollow_the_hollow_knight',
          ...read('hollow_the_hollow_knight', 'O Cavaleiro Vazio', 'The Hollow Knight'),
          type: 'Perdível / Spoiler / História',
          text: 'Faça o final básico antes de obter Void Heart. Depois disso, esse final pode ficar bloqueado no mesmo save e exigir outra run.',
          tags: [attentionTag('Perdível', 'risk'), attentionTag('Spoiler', 'spoiler'), attentionTag('História', 'partial')],
          score: 100
        },
        {
          id: 'hollow_embrace_the_void',
          ...read('hollow_embrace_the_void', 'Abrace o Vazio', 'Embrace the Void'),
          type: 'Dificuldade / Boss / Spoiler',
          text: 'Pantheon of Hallownest é o maior filtro da platina. Deixe para depois de dominar chefes, amuletos, cura, movimentação e rotas de Godhome.',
          tags: [attentionTag('Dificuldade', 'warning'), attentionTag('Boss', 'warning'), attentionTag('Spoiler', 'spoiler')],
          score: 99
        },
        {
          id: 'hollow_pure_completion',
          ...read('hollow_pure_completion', 'Conclusão Pura', 'Pure Completion'),
          type: 'Coletável / Dificuldade / Cleanup / Spoiler',
          text: '112% exige conteúdo base, Grimm Troupe, Godmaster, chefes, upgrades, amuletos, Essência e limpeza final extensa. Use checklist para não transformar o final em retrabalho.',
          tags: [attentionTag('Coletável', 'partial'), attentionTag('Dificuldade', 'warning'), attentionTag('Cleanup', 'partial'), attentionTag('Spoiler', 'spoiler')],
          score: 98
        },
        {
          id: 'hollow_keen_hunter',
          ...read('hollow_keen_hunter', 'Caçador Atento', 'Keen Hunter'),
          type: 'Coletável / Cleanup',
          text: 'Diário do Caçador exige controle de inimigos e entradas específicas. Use a checklist para validar entradas antes de avançar demais.',
          tags: [attentionTag('Coletável', 'partial'), attentionTag('Cleanup', 'partial')],
          score: 97
        },
        {
          id: 'hollow_nightmares_end',
          ...read('hollow_nightmares_end', 'Fim do Pesadelo', 'Nightmare’s End'),
          type: 'Dificuldade / Boss / Spoiler',
          text: 'Grimm Troupe envolve rota, escolha e combate avançado. Planeje a linha antes do final e pratique Nightmare King Grimm ou a alternativa correspondente.',
          tags: [attentionTag('Dificuldade', 'warning'), attentionTag('Boss', 'warning'), attentionTag('Spoiler', 'spoiler')],
          score: 96
        }
      ];
      return hollowKnightAttention.filter(item => trophyById.has(item.id));
    }
    const residentEvilAttentionIds = [
      're1r_nightmare_ends',
      're1r_cqc_ftw',
      're1r_dont_stop_running',
      're1r_every_man',
      're1r_every_woman'
    ];
    if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil' && residentEvilAttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 're1r_nightmare_ends',
          name: trophyById.get('re1r_nightmare_ends')?.name_pt || 'O Pesadelo Acaba',
          originalName: trophyById.get('re1r_nightmare_ends')?.name || 'The Nightmare Ends',
          type: 'Perdível / Final / Spoiler',
          text: 'Final bom do Chris. Planeje a rota salvando Rebecca e Jill para não transformar a campanha em uma run de final ruim.',
          tags: [attentionTag('Perdível / Final / Spoiler', 'risk')],
          score: 99
        },
        {
          id: 're1r_cqc_ftw',
          name: trophyById.get('re1r_cqc_ftw')?.name_pt || 'CQC Para a Vitória',
          originalName: trophyById.get('re1r_cqc_ftw')?.name || 'CQC FTW',
          type: 'Perdível / Dificuldade / Risco de run',
          text: 'Run usando apenas a faca. Separe uma campanha própria e evite objetivos que possam quebrar a condição.',
          tags: [attentionTag('Perdível / Dificuldade / Risco de run', 'risk')],
          score: 98
        },
        {
          id: 're1r_dont_stop_running',
          name: trophyById.get('re1r_dont_stop_running')?.name_pt || 'Não Pare de Correr',
          originalName: trophyById.get('re1r_dont_stop_running')?.name || "Don't Stop Running",
          type: 'Perdível / Dificuldade / Risco de run',
          text: 'Speedrun abaixo de 3 horas. Tente depois de memorizar rotas, puzzles, chefes e inventário.',
          tags: [attentionTag('Perdível / Dificuldade / Risco de run', 'risk')],
          score: 97
        },
        {
          id: 're1r_every_man',
          name: trophyById.get('re1r_every_man')?.name_pt || 'Cada Homem por Si',
          originalName: trophyById.get('re1r_every_man')?.name || 'Every Man for Himself',
          type: 'Perdível / Final / Spoiler',
          text: 'Final ruim do Chris. Faça uma run planejada sem cumprir os resgates para não conflitar com o final bom.',
          tags: [attentionTag('Perdível / Final / Spoiler', 'risk')],
          score: 96
        },
        {
          id: 're1r_every_woman',
          name: trophyById.get('re1r_every_woman')?.name_pt || 'Cada Mulher por Si',
          originalName: trophyById.get('re1r_every_woman')?.name || 'Every Woman for Herself',
          type: 'Perdível / Final / Spoiler',
          text: 'Final ruim da Jill. Reserve uma campanha sem salvar Barry nem Chris para fechar essa variação.',
          tags: [attentionTag('Perdível / Final / Spoiler', 'risk')],
          score: 95
        }
      ];
    }
    const residentEvil2AttentionIds = [
      're2r_gotcha',
      're2r_blink_eye',
      're2r_leon_s',
      're2r_super_spy',
      're2r_scarlet_hero'
    ];
    if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil-2-remake' && residentEvil2AttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 're2r_gotcha',
          name: trophyById.get('re2r_gotcha')?.name_pt || 'Peguei Você!',
          originalName: trophyById.get('re2r_gotcha')?.name || 'Gotcha!',
          type: 'Perdível / Dificuldade / Boss / Risco de run',
          text: 'Exige derrotar a forma 2 do G usando o guindaste apenas uma vez. Mantenha um save antes da luta, cause bastante dano antes de acionar o guindaste e trate como objetivo perdível por run.',
          tags: [attentionTag('Perdível / Dificuldade / Boss / Risco de run', 'risk')],
          score: 99
        },
        {
          id: 're2r_blink_eye',
          name: trophyById.get('re2r_blink_eye')?.name_pt || 'Num Piscar de Olhos',
          originalName: trophyById.get('re2r_blink_eye')?.name || 'In the Blink of an Eye',
          type: 'Perdível / Dificuldade / Boss / Risco de run',
          text: 'Exige derrotar o Super Tyrant com 5 minutos ou mais restantes. Guarde munição pesada para o final do Leon e evite chegar à luta sem recursos.',
          tags: [attentionTag('Perdível / Dificuldade / Boss / Risco de run', 'risk')],
          score: 98
        },
        {
          id: 're2r_leon_s',
          name: trophyById.get('re2r_leon_s')?.name_pt || 'Leon "S." Kennedy',
          originalName: trophyById.get('re2r_leon_s')?.name || 'Leon "S." Kennedy',
          type: 'Perdível / Dificuldade / Risco de run',
          text: 'Rank S com Leon depende principalmente de tempo. Planeje rota curta, evite desvios, recarregue saves ao morrer e deixe coletáveis para outra campanha.',
          tags: [attentionTag('Perdível / Dificuldade / Risco de run', 'risk')],
          score: 97
        },
        {
          id: 're2r_super_spy',
          name: trophyById.get('re2r_super_spy')?.name_pt || 'Uma Superespiã Eficiente',
          originalName: trophyById.get('re2r_super_spy')?.name || 'One Slick Super-spy',
          type: 'Perdível / Dificuldade / Spoiler / Risco de run',
          text: 'A seção da Ada precisa ser concluída usando apenas o EMF Visualizer. Não dispare a pistola e mantenha um save antes da sequência para repetir se errar.',
          tags: [attentionTag('Perdível / Dificuldade / Spoiler / Risco de run', 'risk')],
          score: 96
        },
        {
          id: 're2r_scarlet_hero',
          name: trophyById.get('re2r_scarlet_hero')?.name_pt || 'Heroína Escarlate Flamejante',
          originalName: trophyById.get('re2r_scarlet_hero')?.name || 'Sizzling Scarlet Hero',
          type: 'Perdível / Dificuldade / Risco de run',
          text: 'Rank S com Claire exige rota rápida e controle de recursos. Não misture essa tentativa com coleta completa, exploração longa ou objetivos que atrasem a campanha.',
          tags: [attentionTag('Perdível / Dificuldade / Risco de run', 'risk')],
          score: 95
        }
      ];
    }
    const residentEvil3AttentionIds = [
      're3r_jill_valentine',
      're3r_sprinter',
      're3r_minimalist',
      're3r_goodbye_charlie',
      're3r_dominator'
    ];
    if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil-3-remake' && residentEvil3AttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 're3r_dominator',
          name: 'Inferno / dificuldade máxima',
          originalName: trophyById.get('re3r_dominator')?.name || 'Dominator',
          type: 'Dificuldade / Risco de run / Boss',
          text: 'Deixe a dificuldade máxima para depois de conhecer a campanha e desbloquear recursos úteis da loja. Nemesis e chefes punem erro de rota e gestão ruim de itens.',
          tags: [attentionTag('Dificuldade / Risco de run / Boss', 'risk')],
          score: 99
        },
        {
          id: 're3r_jill_valentine',
          name: 'Rank alto / run rápida',
          originalName: trophyById.get('re3r_jill_valentine')?.name || 'Jill Valentine',
          type: 'Dificuldade / Risco de run / Cleanup',
          text: 'Runs de rank exigem tempo baixo, rota limpa e pouca coleta. Não misture com coletáveis completos ou exploração longa.',
          tags: [attentionTag('Dificuldade / Risco de run / Cleanup', 'risk')],
          score: 98
        },
        {
          id: 're3r_minimalist',
          name: 'Pouca cura ou sem baú',
          originalName: trophyById.get('re3r_minimalist')?.name || 'Minimalist',
          type: 'Perdível / Risco de run',
          text: 'Objetivos com restrição devem ser feitos em run planejada. Usar cura além do limite ou abrir o baú pode quebrar a tentativa.',
          tags: [attentionTag('Perdível / Risco de run', 'risk')],
          score: 97
        },
        {
          id: 're3r_goodbye_charlie',
          name: 'Charlie Dolls e arquivos',
          originalName: trophyById.get('re3r_goodbye_charlie')?.name || 'Goodbye, Charlie!',
          type: 'Coletável / Perdível / Checklist',
          text: 'Coletáveis podem ser perdidos dentro da campanha. Use checklist por área para evitar repetir uma run inteira por um item esquecido.',
          tags: [attentionTag('Coletável / Perdível / Checklist', 'risk')],
          score: 96
        },
        {
          id: 're3r_sprinter',
          name: 'Nemesis e chefes',
          originalName: trophyById.get('re3r_sprinter')?.name || 'Sprinter',
          type: 'Boss / Dificuldade / Spoiler',
          text: 'Lutas e perseguições podem travar runs de dificuldade alta. Guarde recursos, granadas e munição forte para momentos críticos.',
          tags: [attentionTag('Boss / Dificuldade / Spoiler', 'risk')],
          score: 95
        }
      ];
    }
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

    const re4AttentionIds = [
      're4r_real_deadeye',
      're4r_mission_accomplished',
      're4r_splus_investigator',
      're4r_frugalist',
      're4r_gun_fanatic'
    ];
    if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil-4-remake' && re4AttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 're4r_real_deadeye',
          name: trophyById.get('re4r_real_deadeye')?.name || 'Real Deadeye',
          type: 'Dificuldade / Shooting Range / Skill',
          text: 'Deixe para uma etapa de limpeza do Shooting Range; algumas provas exigem consistência, mira e repetição.',
          tags: [attentionTag('Dificuldade / Shooting Range / Skill', 'warning')],
          score: 99
        },
        {
          id: 're4r_mission_accomplished',
          name: trophyById.get('re4r_mission_accomplished')?.name || 'Mission Accomplished S+',
          type: 'Dificuldade / Rank / Risco de run',
          text: 'Exige New Game e controle de tempo no Standard. Planeje rota, saves e recursos antes de começar.',
          tags: [attentionTag('Dificuldade / Rank / Risco de run', 'risk')],
          score: 98
        },
        {
          id: 're4r_splus_investigator',
          name: trophyById.get('re4r_splus_investigator')?.name || 'S+ Rank Investigator',
          type: 'Dificuldade / Rank / Risco de run',
          text: 'Uma das runs centrais da platina. Faça em New Game no Hardcore com rota otimizada e saves planejados.',
          tags: [attentionTag('Dificuldade / Rank / Risco de run', 'risk')],
          score: 97
        },
        {
          id: 're4r_frugalist',
          name: trophyById.get('re4r_frugalist')?.name || 'Frugalist',
          type: 'Restrição / Risco de run',
          text: 'Faça em uma run própria, de preferência com armas fortes, acessórios defensivos e controle rígido de cura.',
          tags: [attentionTag('Restrição / Risco de run', 'risk')],
          score: 96
        },
        {
          id: 're4r_gun_fanatic',
          name: trophyById.get('re4r_gun_fanatic')?.name || 'Gun Fanatic',
          type: 'Coletável / Risco de run / Cleanup',
          text: 'Exige planejamento de compras, armas vendidas pelo Mercador e possíveis desbloqueios de múltiplas runs.',
          tags: [attentionTag('Coletável / Risco de run / Cleanup', 'partial')],
          score: 95
        }
      ];
    }

    const tlouPartIAttentionIds = [
      'tlou1_no_matter_what',
      'tlou1_getting_to_know_you',
      'tlou1_thats_all_i_got',
      'tlou1_dont_go',
      'tlou1_in_memorium'
    ];
    if (String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-i' && tlouPartIAttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'partial') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 'tlou1_no_matter_what',
          name: trophyById.get('tlou1_no_matter_what')?.name || 'No Matter What',
          type: 'História / Cleanup',
          text: 'Concluir a campanha principal libera parte central da lista, mas não fecha automaticamente coletáveis e interações opcionais. Use o Chapter Select para revisar capítulos incompletos.',
          tags: [attentionTag('História / Cleanup', 'partial')],
          score: 99
        },
        {
          id: 'tlou1_getting_to_know_you',
          name: trophyById.get('tlou1_getting_to_know_you')?.name || 'Getting to Know You',
          type: 'Coletável / Checklist / Cleanup',
          text: 'Conversas opcionais são fáceis de deixar passar durante a exploração. Acompanhe por capítulo e revise pelo Chapter Select se alguma interação ficar pendente.',
          tags: [attentionTag('Coletável / Checklist / Cleanup', 'partial')],
          score: 98
        },
        {
          id: 'tlou1_thats_all_i_got',
          name: trophyById.get('tlou1_thats_all_i_got')?.name || "That's All I Got",
          type: 'Coletável / Checklist / Atenção',
          text: 'As piadas da Ellie exigem momentos específicos de espera e exploração. Não avance rápido demais pelos capítulos com interações opcionais.',
          tags: [attentionTag('Coletável / Checklist / Atenção', 'warning')],
          score: 97
        },
        {
          id: 'tlou1_dont_go',
          name: trophyById.get('tlou1_dont_go')?.name || "Don't Go",
          type: 'Left Behind / História',
          text: 'Left Behind faz parte do escopo da lista do Part I. Separe uma etapa própria para concluir a campanha extra e seus objetivos relacionados.',
          tags: [attentionTag('Left Behind / História', 'partial')],
          score: 96
        },
        {
          id: 'tlou1_in_memorium',
          name: trophyById.get('tlou1_in_memorium')?.name || 'In Memoriam',
          type: 'Coletável / Cleanup',
          text: 'Colecionáveis como artefatos, pingentes, quadrinhos e outros registros são o núcleo do cleanup. Marque tudo no checklist para evitar revisitar capítulos sem necessidade.',
          tags: [attentionTag('Coletável / Cleanup', 'partial')],
          score: 95
        }
      ];
    }

    const tlouPartIIAttentionIds = [
      'tlou2_survival_expert',
      'tlou2_arms_master',
      'tlou2_sightseer',
      'tlou2_high_caliber',
      'tlou2_put_my_name_up'
    ];
    if (String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-ii' && tlouPartIIAttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'partial') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 'tlou2_survival_expert',
          name: trophyById.get('tlou2_survival_expert')?.name || 'Survival Expert',
          type: 'Coletável / Risco de run / NG+',
          text: 'Exige todas as melhorias de jogador e normalmente pede NG+ parcial para suplementos suficientes. Planeje a coleta de recursos e não trate como objetivo de uma única campanha.',
          tags: [attentionTag('Coletável / Risco de run / NG+', 'warning')],
          score: 99
        },
        {
          id: 'tlou2_arms_master',
          name: trophyById.get('tlou2_arms_master')?.name || 'Arms Master',
          type: 'Coletável / Risco de run / NG+',
          text: 'Melhorar todas as armas exige peças em quantidade alta. Use a campanha para explorar bem e finalize o restante em NG+ parcial.',
          tags: [attentionTag('Coletável / Risco de run / NG+', 'warning')],
          score: 98
        },
        {
          id: 'tlou2_sightseer',
          name: trophyById.get('tlou2_sightseer')?.name || 'Sightseer',
          type: 'Coletável / Checklist / Cleanup',
          text: 'Visite todos os locais do centro de Seattle antes de sair da área. O Chapter Select ajuda no cleanup, mas acompanhar a região evita retrabalho.',
          tags: [attentionTag('Coletável / Checklist / Cleanup', 'partial')],
          score: 97
        },
        {
          id: 'tlou2_high_caliber',
          name: trophyById.get('tlou2_high_caliber')?.name || 'High Caliber',
          type: 'Coletável / História / Checklist',
          text: 'As armas ficam espalhadas pela campanha e algumas dependem de exploração cuidadosa. Revise capítulos com calma antes de avançar.',
          tags: [attentionTag('Coletável / História / Checklist', 'partial')],
          score: 96
        },
        {
          id: 'tlou2_put_my_name_up',
          name: trophyById.get('tlou2_put_my_name_up')?.name || 'Put My Name Up',
          type: 'Situacional / Dificuldade / Cleanup',
          text: 'É um troféu situacional de pontuação no arco. Use Chapter Select se não fizer na primeira passagem.',
          tags: [attentionTag('Situacional / Dificuldade / Cleanup', 'warning')],
          score: 95
        }
      ];
    }

    const pragmataAttentionIds = [
      'pragmata_our_promise',
      'pragmata_lunar_supremacy',
      'pragmata_the_right_man_for_the_job',
      'pragmata_its_over_6000',
      'pragmata_youre_not_getting_away'
    ];
    if (String(game?.slug || '').trim().toLowerCase() === 'pragmata' && pragmataAttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 'pragmata_our_promise',
          name: trophyById.get('pragmata_our_promise')?.name || 'Our Promise',
          type: 'Spoiler / História',
          text: 'Relacionado à conclusão da campanha. Mantenha saves, progresso de Diana e checklist organizados antes de avançar para o pós-jogo.',
          tags: [attentionTag('Spoiler / História', 'spoiler')],
          score: 99
        },
        {
          id: 'pragmata_lunar_supremacy',
          name: trophyById.get('pragmata_lunar_supremacy')?.name || 'Lunar Supremacy',
          type: 'Dificuldade / Risco de run',
          text: 'Faça em jogada separada na dificuldade Lunatic. Deixe essa run para depois de conhecer combate, hacking, rotas e chefes.',
          tags: [attentionTag('Dificuldade / Risco de run', 'risk')],
          score: 98
        },
        {
          id: 'pragmata_the_right_man_for_the_job',
          name: trophyById.get('pragmata_the_right_man_for_the_job')?.name || 'The Right Man for the Job',
          type: 'Cleanup / Pós-jogo',
          text: 'Relacionado ao modo Unknown Signal. Deixe para depois da campanha base e use o checklist para fechar pendências.',
          tags: [attentionTag('Cleanup / Pós-jogo', 'partial')],
          score: 97
        },
        {
          id: 'pragmata_its_over_6000',
          name: trophyById.get('pragmata_its_over_6000')?.name || "IT'S OVER 6000!",
          type: 'Combate / Situacional',
          text: 'Objetivo de dano em oportunidade curta. Prepare setup forte e aproveite uma situação favorável antes de avançar demais.',
          tags: [attentionTag('Combate / Situacional', 'warning')],
          score: 96
        },
        {
          id: 'pragmata_youre_not_getting_away',
          name: trophyById.get('pragmata_youre_not_getting_away')?.name || "You're Not Getting Away That Easy",
          type: 'Perdível / Combate',
          text: 'Derrote o Sweeper bot quando a oportunidade aparecer e não deixe esse alerta para o pós-jogo.',
          tags: [attentionTag('Perdível / Combate', 'risk')],
          score: 95
        }
      ];
    }

    const sarosAttentionIds = [
      'saros-untouchable',
      'saros-let-go',
      'saros-nightmare-strands',
      'saros-full-arsenal',
      'saros-king'
    ];
    if (String(game?.slug || '').trim().toLowerCase() === 'saros' && sarosAttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 'saros-untouchable',
          name: trophyById.get('saros-untouchable')?.name || 'Untouchable',
          type: 'Dificuldade / Risco de run / Desafio',
          text: 'Trate como desafio de execução e risco de run. Separe tentativas depois de dominar movimentação, padrões dos inimigos e upgrades que aumentem sua margem de erro.',
          tags: [attentionTag('Dificuldade / Risco de run / Desafio', 'warning')],
          score: 99
        },
        {
          id: 'saros-let-go',
          name: trophyById.get('saros-let-go')?.name || 'Let Go',
          type: 'Spoiler / História / Atenção',
          text: 'Relacionado ao epílogo e aos objetivos finais. Avance a história naturalmente e revele detalhes só quando estiver pronto para fechar a parte final da lista.',
          tags: [attentionTag('Spoiler / História / Atenção', 'spoiler')],
          score: 98
        },
        {
          id: 'saros-nightmare-strands',
          name: trophyById.get('saros-nightmare-strands')?.name || 'Nightmare Strands',
          type: 'Dificuldade / Progressão / Cleanup',
          text: 'Nightmare Gates devem ficar para quando sua build e domínio do combate estiverem mais sólidos. Não force todos os portais nas primeiras runs.',
          tags: [attentionTag('Dificuldade / Progressão / Cleanup', 'warning')],
          score: 97
        },
        {
          id: 'saros-full-arsenal',
          name: trophyById.get('saros-full-arsenal')?.name || 'Full Arsenal',
          type: 'Coletável / Checklist / Cleanup',
          text: 'Acompanhe armas, variantes e eliminações pela checklist. Deixar todo o progresso de arsenal para o final aumenta o retrabalho entre runs.',
          tags: [attentionTag('Coletável / Checklist / Cleanup', 'partial')],
          score: 96
        },
        {
          id: 'saros-king',
          name: trophyById.get('saros-king')?.name || 'King',
          type: 'História / Boss / Cleanup',
          text: 'Use as primeiras runs para aprender padrões e liberar sistemas antes de mirar nos objetivos finais, chefes restantes e cleanup.',
          tags: [attentionTag('História / Boss / Cleanup', 'partial')],
          score: 95
        }
      ];
    }

    const godOfWarRagnarokAttentionIds = [
      'gowr_the_true_queen',
      'gowr_grave_mistake',
      'gowr_trials_by_fire',
      'gowr_collector',
      'gowr_the_florist'
    ];
    if (String(game?.slug || '').trim().toLowerCase() === 'god-of-war-ragnarok' && godOfWarRagnarokAttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 'gowr_the_true_queen',
          name: trophyById.get('gowr_the_true_queen')?.name || 'The True Queen',
          type: 'Dificuldade / Boss / Cleanup',
          text: 'Gná é um dos maiores picos de dificuldade da platina. Deixe esse combate para depois de melhorar equipamentos, runas, vida, fúria e aprender bem padrões de ataque.',
          tags: [attentionTag('Dificuldade / Boss / Cleanup', 'warning')],
          score: 99
        },
        {
          id: 'gowr_grave_mistake',
          name: trophyById.get('gowr_grave_mistake')?.name || 'Grave Mistake',
          type: 'Dificuldade / Berserker / Cleanup',
          text: 'Os Berserkers exigem boa build e leitura de padrões. Trabalhe esse objetivo no pós-jogo, quando Kratos estiver mais forte.',
          tags: [attentionTag('Dificuldade / Berserker / Cleanup', 'warning')],
          score: 98
        },
        {
          id: 'gowr_trials_by_fire',
          name: trophyById.get('gowr_trials_by_fire')?.name || 'Trials by Fire',
          type: 'Dificuldade / Muspelheim / Desafio',
          text: 'Muspelheim depende de desafios de combate e organização de tentativas. Faça quando sua build estiver mais sólida.',
          tags: [attentionTag('Dificuldade / Muspelheim / Desafio', 'warning')],
          score: 97
        },
        {
          id: 'gowr_collector',
          name: trophyById.get('gowr_collector')?.name || 'Collector',
          type: 'Coletável / Relic / Checklist',
          text: 'As relíquias e punhos de espada exigem atenção a chefes, exploração e recompensas específicas. Use checklist para não deixar peças soltas no cleanup.',
          tags: [attentionTag('Coletável / Relic / Checklist', 'partial')],
          score: 96
        },
        {
          id: 'gowr_the_florist',
          name: trophyById.get('gowr_the_florist')?.name || 'The Florist',
          type: 'Coletável / Exploração / Cleanup',
          text: 'Coletáveis são melhor resolvidos por reino. Organize baús, artefatos, livros, flores, lore e corvos de Odin por região para evitar revisitas desnecessárias.',
          tags: [attentionTag('Coletável / Exploração / Cleanup', 'partial')],
          score: 95
        }
      ];
    }

    const godOfWar2018AttentionIds = [
      'gow2018_chooser_of_the_slain',
      'gow2018_darkness_and_fog',
      'gow2018_fire_and_brimstone',
      'gow2018_allfather_blinded',
      'gow2018_treasure_hunter'
    ];
    if (['god-of-war', 'god-of-war-2018'].includes(String(game?.slug || '').trim().toLowerCase()) && godOfWar2018AttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 'gow2018_chooser_of_the_slain',
          name: trophyById.get('gow2018_chooser_of_the_slain')?.name || 'Chooser of the Slain',
          type: 'Dificuldade / Valkyries / Cleanup',
          text: 'As Valkyries são o maior pico de dificuldade da platina. Deixe esse objetivo para depois de melhorar equipamentos, runas, vida, fúria e aprender bem esquivas e padrões de ataque.',
          tags: [attentionTag('Dificuldade / Valkyries / Cleanup', 'warning')],
          score: 99
        },
        {
          id: 'gow2018_darkness_and_fog',
          name: trophyById.get('gow2018_darkness_and_fog')?.name || 'Darkness and Fog',
          type: 'Grind / Niflheim / Cleanup',
          text: 'Niflheim exige grind, rota eficiente e controle de recursos. Trabalhe esse reino em uma etapa própria para evitar transformar o cleanup final em repetição excessiva.',
          tags: [attentionTag('Grind / Niflheim / Cleanup', 'warning')],
          score: 98
        },
        {
          id: 'gow2018_fire_and_brimstone',
          name: trophyById.get('gow2018_fire_and_brimstone')?.name || 'Fire and Brimstone',
          type: 'Dificuldade / Muspelheim / Desafio',
          text: 'Muspelheim depende de desafios de combate. Faça quando sua build estiver mais forte e use a etapa para testar runas, armaduras e controle de grupos.',
          tags: [attentionTag('Dificuldade / Muspelheim / Desafio', 'warning')],
          score: 97
        },
        {
          id: 'gow2018_allfather_blinded',
          name: trophyById.get('gow2018_allfather_blinded')?.name || 'Allfather Blinded',
          type: 'Coletável / Checklist / Cleanup',
          text: 'Os corvos de Odin são numerosos e fáceis de deixar para trás. Use checklist por região para evitar revisitar áreas sem necessidade.',
          tags: [attentionTag('Coletável / Checklist / Cleanup', 'partial')],
          score: 96
        },
        {
          id: 'gow2018_treasure_hunter',
          name: trophyById.get('gow2018_treasure_hunter')?.name || 'Treasure Hunter',
          type: 'Coletável / Exploração / Cleanup',
          text: 'Mapas do tesouro, artefatos e coletáveis são melhor resolvidos por região. Organize o cleanup após liberar viagens e atalhos.',
          tags: [attentionTag('Coletável / Exploração / Cleanup', 'partial')],
          score: 95
        }
      ];
    }

    const astroAttentionCopy = {
      astrobot_deep_pocket_dragon: 'Relacionado a uma interação específica no Crash Site. Deixe para o cleanup, quando já tiver mais bots, recompensas e acesso amplo ao hub.',
      astrobot_lost_and_found: 'Depende de encontrar e concluir fases da Lost Galaxy. Revise saídas secretas e portais escondidos antes de encerrar a platina.',
      astrobot_monumental_achievement: 'Relacionado ao progresso final de coletáveis e desbloqueios no Crash Site. Resolva depois de avançar bem bots, puzzle pieces e Gatcha Lab.',
      astrobot_singstars: 'Exige progresso suficiente nas peças da nave e interação no Crash Site. Volte ao hub no cleanup para conferir se todas as condições foram liberadas.',
      astrobot_the_golden_bot: 'Relacionado ao conteúdo final da lista base. Deixe para depois de limpar bots, puzzle pieces, Lost Galaxy e desafios principais.'
    };
    const astroAttentionIds = Object.keys(astroAttentionCopy);
    if (String(game?.slug || '').trim().toLowerCase() === 'astro-bot' && astroAttentionIds.every(id => trophyById.has(id))) {
      const orderedIds = [
        'astrobot_deep_pocket_dragon',
        'astrobot_lost_and_found',
        'astrobot_monumental_achievement',
        'astrobot_singstars',
        'astrobot_the_golden_bot'
      ];
      return orderedIds.map((id, index) => {
        const trophy = trophyById.get(id);
        const tags = getTrophyRiskTags(trophy).filter(tag => tag.id !== 'missable');
        return {
          id,
          name: trophy?.name || id,
          type: trophy?.type || 'Troféu',
          text: astroAttentionCopy[id],
          tags,
          score: 100 - index
        };
      });
    }

    const nioh2AttentionIds = [
      'nioh2_kodama_leader',
      'nioh2_spa_lover',
      'nioh2_soul_searcher',
      'nioh2_sword_master',
      'nioh2_dream_within_dream'
    ];
    if (String(game?.slug || '').trim().toLowerCase() === 'nioh-2' && nioh2AttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 'nioh2_kodama_leader',
          name: trophyById.get('nioh2_kodama_leader')?.name || 'Kodama Leader',
          type: 'Coletável / Checklist / Cleanup',
          text: 'Acompanhe Kodama por região para não deixar toda a limpeza para o fim. Como é possível retornar a missões, não é perdível, mas exige organização.',
          tags: [attentionTag('Coletável / Checklist / Cleanup', 'partial')],
          score: 100
        },
        {
          id: 'nioh2_spa_lover',
          name: trophyById.get('nioh2_spa_lover')?.name || 'Spa Lover',
          type: 'Coletável / Checklist',
          text: 'Hot Springs ficam espalhadas pelas missões. Marque cada banho no checklist para evitar revisitar missões sem necessidade.',
          tags: [attentionTag('Coletável / Checklist', 'partial')],
          score: 99
        },
        {
          id: 'nioh2_soul_searcher',
          name: trophyById.get('nioh2_soul_searcher')?.name || 'Soul Searcher',
          type: 'Grind / Yokai / Cleanup',
          text: 'Soul Cores dependem de derrotar yokai e administrar drops ao longo da campanha. Trabalhe isso naturalmente antes do cleanup final.',
          tags: [attentionTag('Grind / Yokai / Cleanup', 'warning')],
          score: 98
        },
        {
          id: 'nioh2_sword_master',
          name: trophyById.get('nioh2_sword_master')?.name || 'Sword Master',
          type: 'Grind / Progressão',
          text: 'Proficiência cresce com uso real das armas. Alterne armas durante a campanha ou separe uma etapa de grind depois.',
          tags: [attentionTag('Grind / Progressão', 'warning')],
          score: 97
        },
        {
          id: 'nioh2_dream_within_dream',
          name: trophyById.get('nioh2_dream_within_dream')?.name || 'Dream Within a Dream',
          type: 'História / Cleanup',
          text: 'Complete a campanha e use o pós-jogo para fechar missões, coletáveis e objetivos acumulativos sem pressão de perdíveis.',
          tags: [attentionTag('História / Cleanup', 'neutral')],
          score: 96
        }
      ];
    }

    const nioh3AttentionIds = [
      'nioh3_kodama_leader',
      'nioh3_spa_lover',
      'nioh3_answering_people',
      'nioh3_arts_proficiency',
      'nioh3_yokai_manipulator'
    ];
    if (String(game?.slug || '').trim().toLowerCase() === 'nioh-3' && nioh3AttentionIds.every(id => trophyById.has(id))) {
      const attentionTag = (label, tone = 'warning') => ({ id: normalizeGuideSignalText(label).replace(/\s+/g, '-'), label, tone });
      return [
        {
          id: 'nioh3_kodama_leader',
          name: trophyById.get('nioh3_kodama_leader')?.name || 'Kodama Leader',
          type: 'Coletável / Checklist / Cleanup',
          text: 'Acompanhe coletáveis por região desde a campanha. Como é possível retornar a missões, não é perdível, mas deixar tudo para o final aumenta bastante o cleanup.',
          tags: [attentionTag('Coletável / Checklist / Cleanup', 'partial')],
          score: 100
        },
        {
          id: 'nioh3_spa_lover',
          name: trophyById.get('nioh3_spa_lover')?.name || 'Spa Lover',
          type: 'Coletável / Checklist',
          text: 'Marque cada Hot Spring no checklist para evitar revisitar missões sem necessidade durante o cleanup.',
          tags: [attentionTag('Coletável / Checklist', 'partial')],
          score: 99
        },
        {
          id: 'nioh3_answering_people',
          name: trophyById.get('nioh3_answering_people')?.name || 'Answering to the People',
          type: 'Dificuldade / Progressão / Cleanup',
          text: 'Battle Scroll entra melhor depois que sua build estiver mais sólida. Use essa etapa para fortalecer o personagem antes de fechar pendências mais exigentes.',
          tags: [attentionTag('Dificuldade / Progressão / Cleanup', 'warning')],
          score: 98
        },
        {
          id: 'nioh3_arts_proficiency',
          name: trophyById.get('nioh3_arts_proficiency')?.name || 'Arts Proficiency',
          type: 'Grind / Progressão',
          text: 'Proficiência e habilidades crescem com uso real. Alterne estilos durante a campanha ou separe uma etapa de grind controlado no pós-jogo.',
          tags: [attentionTag('Grind / Progressão', 'warning')],
          score: 97
        },
        {
          id: 'nioh3_yokai_manipulator',
          name: trophyById.get('nioh3_yokai_manipulator')?.name || 'Yokai Manipulator',
          type: 'História / Cleanup / Yokai',
          text: 'Use a campanha para aprender chefes, Yokai e sistemas principais; depois volte às missões para fechar registros e troféus situacionais.',
          tags: [attentionTag('História / Cleanup / Yokai', 'neutral')],
          score: 96
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

    if (/lake of nine|veithurgard|drag|wayward spirits|brok|sindri/.test(normalized)) return 'Organize regiões e favores';
    if (/checklist/.test(normalized) && /odin|ravens|corvo|corvos|colet|artefatos|shrines|nornir/.test(normalized)) return 'Revise coletáveis no checklist';
    if (/valquir|valkyrie queen|valkyries/.test(normalized)) return 'Derrote desafios opcionais finais';
    if (/muspelheim|niflheim|mist echoes|trials/.test(normalized) && /build|equip|upgrade|fortaleca|fortaleça|recursos/.test(normalized)) return 'Organize reinos de desafio';
    if (/limpeza final/.test(normalized)) return 'Revise pendências finais';
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
    if (/cleanup|limpeza final|limpeza|pendente|pendencias/.test(normalized)) return 'Revise pendências finais';
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
    if (/run|campanha|historia|new game|ng\+?/.test(normalized)) return index === 0 ? 'Avance pela campanha' : 'Prossiga pela rota planejada';
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
    if (Array.isArray(game?.faq) && game.faq.length) {
      return game.faq
        .map(item => ({
          question: firstGuideText(item?.question),
          answer: firstGuideText(item?.answer)
        }))
        .filter(item => item.question && item.answer);
    }
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

    if (String(game?.slug || '').trim().toLowerCase() === 'marvels-spider-man-miles-morales') {
      return [
        {
          question: 'Precisa jogar no difícil?',
          answer: 'Não. A dificuldade não afeta a platina; escolha qualquer dificuldade nas duas jogadas.'
        },
        {
          question: 'Tem troféu perdível?',
          answer: 'Não há perdível definitivo, pois missões e atividades podem ser repetidas. Mesmo assim, acompanhe ações específicas para evitar retrabalho.'
        },
        {
          question: 'Precisa de New Game+?',
          answer: 'Sim. New Game+ é obrigatório para concluir Plus Plus e fechar habilidades/trajes ligados à segunda jogada.'
        },
        {
          question: 'Dá para platinar em uma jogada?',
          answer: 'Não. A platina exige pelo menos 2 jogadas por causa do New Game+.'
        },
        {
          question: 'Precisa jogar online ou coop?',
          answer: 'Não. A platina é totalmente offline e solo, sem servidores, multiplayer, coop ou PS+ obrigatório.'
        },
        {
          question: 'O que mais costuma atrasar a platina?',
          answer: 'Objetivos bônus de crimes, 100% dos distritos, habilidades, trajes, aprimoramentos e ações esquecidas como barco, feed social, túmulo, Modo Foto e troféus de combate/furtividade.'
        },
        {
          question: 'Posso deixar os colecionáveis para depois?',
          answer: 'Sim. A maioria pode ser feita na limpeza final, e os cartões-postais aparecem somente após a campanha.'
        },
        {
          question: 'PS4 e PS5 têm lista diferente?',
          answer: 'A lista base usada pelo guia tem os mesmos 50 troféus em PS4 e PS5. Transferência de save/autopop é observação externa, não requisito da platina.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'marvels-spider-man') {
      return [
        {
          question: 'Marvel’s Spider-Man tem troféus perdíveis?',
          answer: 'Não. A platina base permite limpar atividades, crimes, coletáveis e 100% dos distritos no pós-jogo. O maior cuidado é organizar a limpeza final para evitar retrabalho.'
        },
        {
          question: 'Marvel’s Spider-Man precisa de online ou coop para platinar?',
          answer: 'Não. A platina base é single-player e não exige online, coop, servidores, multiplayer ou PS+.'
        },
        {
          question: 'Quantas runs são necessárias?',
          answer: 'A platina base pode ser planejada em uma campanha com limpeza final pós-história. New Game+ só entra como pacote extra separado, fora da rota principal.'
        },
        {
          question: 'Precisa jogar em dificuldade específica?',
          answer: 'Não. A platina base não exige dificuldade específica. Jogue em uma dificuldade confortável e deixe desafios, bases e pontuações para depois de liberar mais recursos.'
        },
        {
          question: 'O que mais toma tempo na platina?',
          answer: '100% dos distritos, crimes, bases, desafios do Taskmaster, mochilas, marcos, pesquisas, Black Cat Stakeouts, pombos, trajes, tokens, upgrades e atividades de mapa concentram a maior parte do tempo.'
        },
        {
          question: 'DLCs, New Game+ ou Ultimate são necessários?',
          answer: 'Não para a platina base. The City That Never Sleeps, New Game+, Ultimate e troféus extras do Remastered ficam separados da lista base acompanhada por este guia.'
        },
        {
          question: 'Qual é o melhor primeiro passo?',
          answer: 'Avance a campanha, abra distritos, desbloqueie habilidades e gadgets, colete o que estiver no caminho e deixe a limpeza completa para quando a cidade estiver mais aberta.'
        },
        {
          question: '100% dos distritos é perdível?',
          answer: 'Não. Trate 100% dos distritos como objetivo de mapa e limpeza final. Ele pode ser resolvido depois da história com a cidade aberta.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil') {
      return [
        {
          question: 'Resident Evil tem troféus perdíveis?',
          answer: 'Sim, há perdíveis por run ligados a personagem, final, resgate, mapa completo, tempo, save e restrição de arma. Não há perda definitiva: se algo escapar, refaça em outra campanha planejada.'
        },
        {
          question: 'Resident Evil precisa de online para platinar?',
          answer: 'Não. A platina é totalmente offline e não exige servidores, multiplayer, ranking online ou PS+.'
        },
        {
          question: 'Resident Evil tem coop obrigatório?',
          answer: 'Não. A lista é single-player e não tem coop obrigatório.'
        },
        {
          question: 'DLC é necessária para a platina?',
          answer: 'Não. A rota considera a lista base de Resident Evil HD Remaster. Não há online, coop ou conteúdo extra obrigatório para a platina.'
        },
        {
          question: 'Quantas runs são necessárias?',
          answer: 'Planeje múltiplas campanhas. O caminho mais limpo separa Jill, Chris, finais bons e ruins, Hard, Real Survival, Invisible Enemy, speedrun, sem salvar e faca-only.'
        },
        {
          question: 'Tem troféu de speedrun, sem salvar e faca-only?',
          answer: 'Sim. A platina exige runs condicionais, incluindo terminar rápido, terminar sem salvar e terminar usando apenas a faca. Deixe esses objetivos para quando já conhecer rotas, puzzles, chefes e inventário.'
        },
        {
          question: 'Real Survival e Invisible Enemy entram na platina?',
          answer: 'Sim. Hard, Real Survival e Invisible Enemy fazem parte da rota de platina e devem ficar para depois que você conhecer bem a mansão.'
        },
        {
          question: 'Qual é o melhor primeiro passo?',
          answer: 'Faça uma primeira run segura aprendendo a mansão, usando saves e entendendo puzzles, inventário, rotas e resgates antes de otimizar.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil-2-remake') {
      return [
        {
          question: 'Resident Evil 2 Remake tem troféus perdíveis?',
          answer: 'Sim. Há perdíveis por run. Arquivos, Mr. Raccoons, cofres, upgrades, bolsas, eventos específicos e condições como rank, sem cura, sem baú e poucos passos podem exigir outra campanha se forem ignorados ou quebrados.'
        },
        {
          question: 'Resident Evil 2 Remake precisa de online ou coop?',
          answer: 'Não. A lista base é single-player, offline e não exige coop, servidores, multiplayer, ranking online ou PS+.'
        },
        {
          question: 'Quantas runs são necessárias?',
          answer: 'Planeje múltiplas campanhas. A rota mais limpa separa aprendizado, Leon, Claire, 2nd Run, Hardcore, rank S, coletáveis e desafios de restrição.'
        },
        {
          question: 'Precisa jogar com Leon e Claire?',
          answer: 'Sim. A platina exige campanhas dos dois personagens e troféus específicos ligados a cada rota.'
        },
        {
          question: 'Precisa fazer 2nd Run?',
          answer: 'Sim. A 2ª jornada entra na rota para cobrir campanha complementar e final verdadeiro quando aplicável.'
        },
        {
          question: 'Existem troféus de Hardcore, rank S e speedrun?',
          answer: 'Sim. A platina exige campanhas planejadas para Hardcore e rank S. O rank depende principalmente de tempo, então deixe essas tentativas para depois de conhecer mapas, puzzles, chefes e rotas.'
        },
        {
          question: 'Existem troféus de sem cura, sem baú ou limite de passos?',
          answer: 'Sim. Frugalist, Minimalist e A Small Carbon Footprint exigem condições específicas. Faça essas runs separadas ou combine apenas quando já tiver uma rota segura.'
        },
        {
          question: 'DLCs ou modos extras são necessários para a platina?',
          answer: 'Não. A rota considera a lista base da platina. DLCs, modos extras ou conteúdos fora da lista base devem ficar separados da platina.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil-3-remake') {
      return [
        {
          question: 'Resident Evil 3 Remake tem troféus perdíveis?',
          answer: 'Sim. Há perdíveis por run, principalmente coletáveis, arquivos, Charlie Dolls, cofres, travas, upgrades, itens importantes e condições especiais. Nada é perdido definitivamente, mas pode ser necessário repetir campanha.'
        },
        {
          question: 'Resident Evil 3 Remake precisa de online ou coop para platinar?',
          answer: 'Não. A platina base de Resident Evil 3 Remake é single-player e não exige online, coop, servidores, multiplayer ou PS+.'
        },
        {
          question: 'Resident Evil Resistance entra na platina?',
          answer: 'Não. Resistance tem lista separada e fica fora da rota da platina base de Resident Evil 3 Remake.'
        },
        {
          question: 'Quantas runs são necessárias?',
          answer: 'Planeje múltiplas runs. A rota mais segura separa aprendizado, coletáveis/records, dificuldades altas, rank e objetivos com restrição.'
        },
        {
          question: 'Precisa terminar em dificuldades altas?',
          answer: 'Sim. Hardcore, Nightmare e Inferno entram na rota da platina. Deixe essas runs para depois de conhecer rotas, inimigos, chefes e recursos.'
        },
        {
          question: 'Existem troféus de rank ou speedrun?',
          answer: 'Sim. Runs de rank e Sprinter exigem tempo baixo, rota limpa e pouca exploração, então não combine com coleta completa.'
        },
        {
          question: 'Existem troféus de pouca cura ou sem baú?',
          answer: 'Sim. Os troféus ligados a usar pouca cura e não abrir o baú exigem condições específicas. Faça esses objetivos em runs dedicadas ou combine apenas quando já tiver uma rota segura.'
        },
        {
          question: 'O que mais dá trabalho na platina?',
          answer: 'Dificuldades altas, Inferno, rank, gerenciamento de recursos, Nemesis, coletáveis perdíveis por run e objetivos condicionais são os principais filtros.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'hollow-knight') {
      return [
        {
          question: 'Hollow Knight tem troféus perdíveis?',
          answer: 'Sim, há objetivos que podem exigir rota ou save específico, especialmente o final básico antes de Void Heart, escolhas de progresso e eventos avançados. Nada deve ser tratado como perda definitiva sem validação, mas alguns erros podem obrigar uma nova run.'
        },
        {
          question: 'Hollow Knight precisa de online ou coop para platinar?',
          answer: 'Não. A platina da lista PlayStation é single-player e não exige online, coop, servidores, multiplayer ou PS+.'
        },
        {
          question: 'Quantas runs são necessárias?',
          answer: 'Planeje mais de uma run. A rota mais segura separa aprendizado, cleanup, finais, Godhome e a conferência final da checklist.'
        },
        {
          question: 'Steel Soul entra na platina base?',
          answer: 'Não na lista base desta entrada. Steel Soul fica fora do escopo da platina PlayStation usada pelo guia.'
        },
        {
          question: 'Existem troféus de speedrun ou 100% em tempo?',
          answer: 'Não na platina base desta entrada. Esses desafios ficam fora do escopo da lista PlayStation e não devem ser misturados com o cleanup da Voidheart Edition.'
        },
        {
          question: 'Godhome e os Panteões entram na platina?',
          answer: 'Sim. Se estiverem na lista do jogo usada pelo guia, eles entram e são um dos maiores filtros de dificuldade, especialmente Pantheon of Hallownest.'
        },
        {
          question: 'O que mais dá trabalho na platina?',
          answer: 'Final básico antes de Void Heart, 112%, Godhome, Pantheon of Hallownest, Trial of the Fool, bosses difíceis e coletáveis extensos são os principais filtros.'
        },
        {
          question: 'DLCs ou extras fazem parte da lista?',
          answer: 'Os conteúdos integrados da Voidheart Edition, como Grimm Troupe e Godmaster, já fazem parte da lista usada pelo guia. Extras de PC/Xbox ficam separados.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'the-last-of-us-part-i') {
      return [
        {
          question: 'The Last of Us Part I tem troféus perdíveis?',
          answer: 'Não. A lista permite cleanup por Chapter Select. Ainda assim, é recomendável acompanhar coletáveis, conversas opcionais e piadas desde a primeira campanha para reduzir retrabalho.'
        },
        {
          question: 'The Last of Us Part I precisa de online para platinar?',
          answer: 'Não. A platina do Part I não exige multiplayer, Factions, servidores ou troféus online.'
        },
        {
          question: 'Quanto tempo leva para platinar The Last of Us Part I?',
          answer: 'O tempo depende do quanto você acompanha coletáveis durante a campanha. Usar checklist desde o início reduz bastante o cleanup por Chapter Select.'
        },
        {
          question: 'Qual a dificuldade da platina de The Last of Us Part I?',
          answer: 'A dificuldade é baixa a moderada. O desafio principal está em organização de coletáveis, conversas opcionais, piadas, cofres, portas com shiv e cleanup, não em online ou dificuldade extrema.'
        },
        {
          question: 'The Last of Us Part I tem coop obrigatório?',
          answer: 'Não. A platina é single-player e não exige coop.'
        },
        {
          question: 'Left Behind é necessário para a platina?',
          answer: 'Sim. No The Last of Us Part I, Left Behind faz parte do escopo da lista de troféus acompanhada pelo guia. Conclua esse conteúdo e seus objetivos relacionados para fechar a platina.'
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
          answer: 'Não há perdíveis definitivos na lista base. Alguns objetivos podem exigir uma run específica, boa execução ou planejamento, mas devem ser tratados como risco de run, dificuldade ou cleanup quando puderem ser tentados novamente.'
        },
        {
          question: 'Saros precisa de online para platinar?',
          answer: 'Não. A platina base não exige troféus online obrigatórios.'
        },
        {
          question: 'Saros tem coop obrigatório?',
          answer: 'Não. A platina base não exige coop obrigatório.'
        },
        {
          question: 'Quanto tempo leva para platinar Saros?',
          answer: 'O tempo depende do domínio das runs, chefes, upgrades permanentes, coletáveis, desafios e cleanup. Use o roadmap para separar campanha, progressão, objetivos acumulativos e limpeza final.'
        },
        {
          question: 'Qual a dificuldade da platina?',
          answer: 'A dificuldade vem de execução, sobrevivência, leitura de padrões, chefes, objetivos de run e domínio dos sistemas. O guia trata desafios repetíveis como risco de run/dificuldade, não como perdíveis definitivos.'
        },
        {
          question: 'Saros exige DLC para platina?',
          answer: 'Não. DLCs ou extras ficam fora da platina base.'
        },
        {
          question: 'Dá para limpar pendências depois da campanha?',
          answer: 'Sim. Pendências de armas, desafios, Nightmare Gates e objetivos cumulativos entram melhor em runs adicionais depois que a base de combate estiver mais estável.'
        },
        {
          question: 'Saros tem chapter select ou replay de áreas?',
          answer: 'Não conte com Chapter Select tradicional para organizar a platina. Planeje por runs, checklist e cleanup final, usando qualquer retorno de área apenas quando o próprio jogo permitir.'
        },
        {
          question: 'A platina depende de múltiplas runs?',
          answer: 'Sim. Como roguelite de ação, a platina depende de várias runs para progressão, bosses, recursos, modificadores, armas e desafios situacionais.'
        },
        {
          question: 'O guia está verificado?',
          answer: 'Sim. Este guia está Verificado e revisado editorialmente para a platina base.'
        },
        {
          question: 'Saros é Returnal 2?',
          answer: 'Não. Mesmo que possa lembrar outros roguelites de ação, o guia trata Saros como jogo próprio, com roadmap, checklist e alertas específicos da sua lista.'
        }
      ];
    }

    if (['god-of-war', 'god-of-war-2018'].includes(String(game?.slug || '').trim().toLowerCase())) {
      return [
        {
          question: 'God of War (2018) tem troféus perdíveis?',
          answer: 'Não. A platina base não tem perdíveis definitivos. Depois da história, é possível voltar aos reinos para limpar coletáveis, favores, Valkyries e atividades pendentes.'
        },
        {
          question: 'God of War (2018) precisa de online para platinar?',
          answer: 'Não. A platina é totalmente single-player e não exige servidores, PS+ ou troféus online.'
        },
        {
          question: 'God of War (2018) tem coop obrigatório?',
          answer: 'Não. A platina base é solo e não exige coop.'
        },
        {
          question: 'Precisa jogar na dificuldade mais alta?',
          answer: 'Não. A platina não exige dificuldade específica. Você pode jogar em uma dificuldade confortável e focar em exploração, coletáveis, upgrades e chefes opcionais.'
        },
        {
          question: 'Quanto tempo leva para platinar God of War (2018)?',
          answer: 'O tempo estimado é 30-40 horas, variando conforme exploração durante a campanha e quanto cleanup ficar para o final.'
        },
        {
          question: 'O que mais dá trabalho na platina?',
          answer: 'Os maiores pontos de atenção são Valkyries, Niflheim, Muspelheim, coletáveis de reinos, mapas do tesouro, corvos de Odin, baús, favores e upgrades.'
        },
        {
          question: 'A DLC é necessária para a platina?',
          answer: 'Não. DLCs ou extras ficam fora da platina base. Este guia não mistura God of War Ragnarök, Valhalla ou conteúdo de outro jogo.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'god-of-war-ragnarok') {
      return [
        {
          question: 'God of War Ragnarök tem troféus perdíveis?',
          answer: 'Não. A platina base não tem perdíveis definitivos. Depois da história, é possível voltar aos reinos para limpar coletáveis, favores, Berserkers, Muspelheim, Crater/Vanaheim e atividades pendentes.'
        },
        {
          question: 'God of War Ragnarök precisa de online para platinar?',
          answer: 'Não. A platina é totalmente single-player e não exige servidores, PS+ ou troféus online.'
        },
        {
          question: 'God of War Ragnarök tem coop obrigatório?',
          answer: 'Não. A platina base é solo e não exige coop.'
        },
        {
          question: 'Precisa jogar na dificuldade mais alta?',
          answer: 'Não. A platina não exige dificuldade específica. Você pode jogar em uma dificuldade confortável e focar em exploração, coletáveis, upgrades e chefes opcionais.'
        },
        {
          question: 'Quanto tempo leva para platinar God of War Ragnarök?',
          answer: 'O tempo depende do quanto você explora durante a campanha e de quanto cleanup fica para o final. A maior parte do tempo vem de favores, coletáveis, Berserkers, Gná, Muspelheim, Crater/Vanaheim, upgrades e atividades opcionais.'
        },
        {
          question: 'O que mais dá trabalho na platina?',
          answer: 'Os maiores pontos de atenção são Berserkers, Gná, desafios de Muspelheim, Crater/Vanaheim, coletáveis dos reinos, corvos de Odin, baús Nornir, relíquias, punhos de espada, favores e upgrades.'
        },
        {
          question: 'Valhalla é necessário para a platina?',
          answer: 'Não. Valhalla é conteúdo separado e fica fora da platina base de God of War Ragnarök.'
        },
        {
          question: 'New Game+ é obrigatório para a platina?',
          answer: 'Não. A rota principal considera campanha, pós-jogo e cleanup da lista base. New Game+ fica fora dos requisitos da platina base.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'dead-cells') {
      return [
        {
          question: 'Dead Cells tem troféus perdíveis?',
          answer: 'Não. A lista base não tem perdíveis definitivos. Como o jogo é estruturado em runs, biomas, chefes, runas e desafios podem ser tentados novamente.'
        },
        {
          question: 'Dead Cells precisa de online para platinar?',
          answer: 'Não. A platina da lista base não exige online, servidores, multiplayer, coop ou PS+.'
        },
        {
          question: 'Dead Cells tem coop obrigatório?',
          answer: 'Não. A rota da platina base é solo e não exige segundo jogador.'
        },
        {
          question: 'Dead Cells exige dificuldade alta?',
          answer: 'Sim. A lista base exige terminar o jogo com Boss Stem Cells ativas, incluindo 4 BSC, então a curva de dificuldade faz parte da platina.'
        },
        {
          question: 'Dead Cells depende de múltiplas runs?',
          answer: 'Sim. A progressão depende de várias runs para liberar runas, upgrades, blueprints, rotas, vitórias com Boss Stem Cells e tentativas de chefes sem dano.'
        },
        {
          question: 'O que mais dá trabalho na platina?',
          answer: 'Os maiores filtros são Boss Stem Cells, chefes sem dano, Cursed Sword, equipamento inicial, Challenge Rift, Daily Challenge, 100 elites e consistência em combate.'
        },
        {
          question: 'DLCs são necessárias para a platina base?',
          answer: 'Não. DLCs e expansões ficam fora da platina base; este guia cobre os 54 troféus do jogo base.'
        },
        {
          question: 'Qual é o melhor primeiro passo?',
          answer: 'Faça runs exploratórias para aprender inimigos, liberar runas, melhorar frascos e entregar blueprints úteis ao Collector antes de forçar objetivos difíceis.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'nioh-3') {
      return [
        {
          question: 'Nioh 3 tem troféus perdíveis?',
          answer: 'Não. A platina base não tem perdíveis definitivos. A maioria dos objetivos pode ser resolvida retornando a missões, limpando regiões e avançando sistemas acumulativos.'
        },
        {
          question: 'Nioh 3 precisa de online para platinar?',
          answer: 'Não. A platina base pode ser feita sem troféus online obrigatórios.'
        },
        {
          question: 'Quanto tempo leva para platinar Nioh 3?',
          answer: 'O tempo depende do domínio do combate, da build, das missões secundárias e do quanto de cleanup ficar para o final. Use o roadmap para distribuir campanha, Battle Scroll, coletáveis, proficiência, Yokai e missões pendentes.'
        },
        {
          question: 'Qual a dificuldade da platina de Nioh 3?',
          answer: 'A dificuldade vem principalmente do combate, chefes, gerenciamento de recursos, alternância Samurai/Ninja, builds, missões opcionais e domínio dos sistemas de Yokai. A platina não depende de perdíveis, mas exige consistência.'
        },
        {
          question: 'Nioh 3 tem coop obrigatório?',
          answer: 'Não. A platina base não exige coop obrigatório.'
        },
        {
          question: 'A DLC é necessária para a platina de Nioh 3?',
          answer: 'Não. DLCs e conteúdos extras ficam fora da platina base.'
        },
        {
          question: 'Dá para repetir missões para limpar coletáveis?',
          answer: 'Sim. Battle Scroll e free roam funcionam como caminhos de limpeza para missões, coletáveis, diálogos e condições situacionais.'
        },
        {
          question: 'Nioh 3 tem Chapter Select?',
          answer: 'Não como seleção tradicional de capítulos. A limpeza funciona principalmente por replay de missões via Battle Scroll.'
        },
        {
          question: 'Battle Scroll conta como replay de missões?',
          answer: 'Sim. Battle Scroll permite revisar missões e corrigir pendências sem reiniciar a campanha.'
        },
        {
          question: 'Qual é o maior grind da platina?',
          answer: 'O maior volume está em exploração regional, Myths, coletáveis, proficiência, sistemas de ferreiro, Soul Cores/Yokai, bosses opcionais e cleanup final.'
        },
        {
          question: 'O guia está verificado?',
          answer: 'Sim. Este guia está Verificado e revisado editorialmente para a platina base.'
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

    if (String(game?.slug || '').trim().toLowerCase() === 'resident-evil-4-remake') {
      return [
        {
          question: 'Resident Evil 4 Remake tem troféus perdíveis?',
          answer: 'Sim. A lista base tem troféus que exigem atenção a capítulos, saves, coletáveis por campanha, pedidos do Mercador, tesouros, castelões e objetivos situacionais. Siga o roadmap desde a primeira campanha para evitar repetir runs desnecessárias.'
        },
        {
          question: 'Resident Evil 4 Remake precisa de online para platinar?',
          answer: 'Não. A platina base é totalmente offline e não exige servidores, PS+ ou troféus online.'
        },
        {
          question: 'Quanto tempo leva para platinar Resident Evil 4 Remake?',
          answer: 'O tempo estimado é 30-40 horas, variando conforme domínio das rotas, número de runs, S+, Professional, restrições, Shooting Range, coletáveis e cleanup.'
        },
        {
          question: 'Qual a dificuldade da platina de Resident Evil 4 Remake?',
          answer: 'A dificuldade cadastrada é 7/10. O desafio vem de múltiplas runs, rank S+, Professional, restrições como Minimalist, Frugalist e Silent Stranger, além de troféus situacionais de capítulo.'
        },
        {
          question: 'Resident Evil 4 Remake tem coop obrigatório?',
          answer: 'Não. A platina base é single-player e não exige coop.'
        },
        {
          question: 'A DLC é necessária para a platina de Resident Evil 4 Remake?',
          answer: 'Não. Separate Ways, VR Mode, The Mercenaries, tickets pagos e outros extras ficam fora da platina base.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'pragmata') {
      return [
        {
          question: 'PRAGMATA tem troféus perdíveis?',
          answer: 'Sim. O guia trata 1 troféu como perdível ou sensível a janela de oportunidade: You\'re Not Getting Away That Easy. Leia os pontos de atenção antes da primeira campanha para evitar repetir progresso.'
        },
        {
          question: 'PRAGMATA precisa de online para platinar?',
          answer: 'Não. A platina base não exige online, servidores ou assinatura obrigatória.'
        },
        {
          question: 'PRAGMATA tem coop obrigatório?',
          answer: 'Não. A platina base é single-player e não exige coop.'
        },
        {
          question: 'Quanto tempo leva para platinar PRAGMATA?',
          answer: 'O tempo estimado é 30-35 horas, considerando campanha, exploração, coletáveis, Unknown Signal, Training Sims, cleanup e uma jogada em Lunatic.'
        },
        {
          question: 'Qual a dificuldade da platina de PRAGMATA?',
          answer: 'A dificuldade cadastrada é 6/10. O peso vem de Lunatic, objetivos situacionais, combate, hacking, exploração e atenção aos perdíveis.'
        },
        {
          question: 'Quantas jogadas são necessárias para platinar PRAGMATA?',
          answer: 'O guia recomenda 2 jogadas: uma primeira campanha para aprender sistemas e limpar bastante conteúdo, e uma campanha em Lunatic para o troféu de dificuldade.'
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

    if (String(game?.slug || '').trim().toLowerCase() === 'astro-bot') {
      return [
        {
          question: 'Astro Bot tem troféus perdíveis?',
          answer: 'Não. A lista base de Astro Bot não tem troféus perdíveis. A platina pode ser finalizada com revisita de fases, seleção de níveis e cleanup.'
        },
        {
          question: 'Astro Bot precisa de online para platinar?',
          answer: 'Não. A platina base não exige online, servidores, PS+ ou rankings.'
        },
        {
          question: 'Quanto tempo leva para platinar Astro Bot?',
          answer: 'O tempo estimado é de cerca de 15 horas, variando conforme exploração, desafios, bots, puzzle pieces, Lost Galaxy e cleanup final.'
        },
        {
          question: 'Qual a dificuldade da platina de Astro Bot?',
          answer: 'A dificuldade cadastrada é 3/10. O desafio vem mais de exploração, fases especiais e alguns objetivos situacionais do que de execução pesada.'
        },
        {
          question: 'Astro Bot tem coop obrigatório?',
          answer: 'Não. A platina base é single-player e não exige coop.'
        },
        {
          question: 'A DLC é necessária para a platina de Astro Bot?',
          answer: 'Não. A platina base não exige DLC.'
        }
      ];
    }

    if (String(game?.slug || '').trim().toLowerCase() === 'nioh-2') {
      return [
        {
          question: 'Nioh 2 tem troféus perdíveis?',
          answer: 'Não. A platina base não tem perdíveis definitivos. A maioria dos objetivos pode ser resolvida retornando a missões, limpando regiões e avançando sistemas acumulativos.'
        },
        {
          question: 'Nioh 2 precisa de online para platinar?',
          answer: 'Não. A platina base pode ser feita offline. Recursos online podem ajudar em alguns momentos, mas não são requisito obrigatório da platina.'
        },
        {
          question: 'Quanto tempo leva para platinar Nioh 2?',
          answer: 'O tempo depende do domínio do combate, da build, do uso de missões secundárias e do quanto de cleanup ficar para o final. Use o roadmap para distribuir campanha, coletáveis, proficiência, Soul Cores e missões pendentes.'
        },
        {
          question: 'Qual a dificuldade da platina de Nioh 2?',
          answer: 'A dificuldade vem principalmente do combate, chefes, gerenciamento de Ki, Burst Counter, builds, missões opcionais e adaptação aos sistemas de yokai. A platina não é baseada em perdíveis, mas exige consistência.'
        },
        {
          question: 'Nioh 2 tem coop obrigatório?',
          answer: 'Não. A platina base não exige coop obrigatório. O jogo pode ter recursos de ajuda/coop, mas eles não devem ser tratados como requisito obrigatório para platinar.'
        },
        {
          question: 'A DLC é necessária para a platina de Nioh 2?',
          answer: 'Não. As DLCs ficam fora da platina base.'
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
    if (String(game?.slug || '').trim().toLowerCase() === 'marvels-spider-man-miles-morales') {
      return {
        fitLabel: 'Platina curta e acessível',
        fitDetail: 'Boa para quem gosta de campanha compacta, limpeza de mapa e checklist objetivo.',
        riskLabel: 'Sem perdíveis reais',
        riskDetail: 'Não exige online, coop ou DLC; free roam e replay de missões cobrem pendências.',
        paceLabel: 'Exige New Game+',
        paceDetail: 'Não é uma platina de uma campanha só: reserve a segunda campanha para Plus Plus e habilidades finais.',
        verdict: 'Vale abrir se você curte cleanup',
        verdictDetail: 'A rota é amigável, mas combina melhor com quem aceita limpar distritos, atividades, colecionáveis e repetir a história em New Game+.',
        chips: [
          '10-20h',
          'New Game+ obrigatório',
          'Sem online/coop/DLC'
        ]
      };
    }

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
    const riskCounts = ['marvels-spider-man', 'marvels-spider-man-miles-morales', 'red-dead-redemption-2'].includes(String(game?.slug || '').trim().toLowerCase())
      ? getGuideRiskCounts(trophies, game)
      : getRiskCounts(trophies);
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
      routeChangingTrophies: buildRouteChangingTrophies(trophies, game),
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
