'use strict';

const LAST_EDITORIAL_REVIEW = '2026-07-18';
const NEXT_VOLATILE_REVIEW = '2026-08-17';
const EDITORIAL_OWNER = 'Equipe Editorial AtlasAchievement';

const SOURCE_REGISTRY = [
  {
    id: 'capcom-manual-ps4',
    title: 'Capcom — manual oficial de Resident Evil 5 para PS4',
    url: 'https://static.capcom.com/manuals/re5/RE5_PS4_DMNL_EN.pdf',
    publisher: 'Capcom', type: 'official_manual', platform: 'PS4', version: 'PS4/Remaster',
    purpose: 'Controles, modos e referência oficial da versão PS4/Remaster.',
    accessedAt: '2026-07-18', lastVerifiedAt: '2026-07-18', status: 'OK', reliability: 'A',
    notes: 'Fonte oficial de versão e controles; não substitui uma lista específica de troféus.',
    claims: ['re5-infinite-ammo', 're5-infinite-rocket-launcher'], public: true,
    expectedTitleTerms: ['resident evil 5']
  },
  {
    id: 'pst-list-ps4',
    title: 'PlayStationTrophies — lista de troféus de Resident Evil 5',
    url: 'https://www.playstationtrophies.org/game/resident-evil-5-ps4/trophies/',
    publisher: 'PlayStationTrophies', type: 'trophy_list', platform: 'PS4', version: 'PS4/Remaster',
    purpose: 'Conferência da lista base, grupos de DLC e separação entre platina e 100%.',
    accessedAt: '2026-07-18', lastVerifiedAt: '2026-07-18', status: 'BLOCKED', reliability: 'B',
    notes: 'Conteúdo conferido editorialmente; auditor HTTP recebe proteção antibot e não tenta contorná-la.',
    claims: ['re5-base-dlc-counts', 're5-all-dressed-up', 're5-versus-requirements', 're5-versus-wins-15', 're5-versus-melee-50', 're5-score-stars-18', 're5-dlc-s-ranks', 're5-dlc-professional', 're5-desperate-150-kills'], public: true,
    expectedTitleTerms: ['resident evil 5', 'trophies']
  },
  {
    id: 'pst-guide-ps4',
    title: 'PlayStationTrophies — guia de troféus de Resident Evil 5',
    url: 'https://www.playstationtrophies.org/game/resident-evil-5-ps4/guide/',
    publisher: 'PlayStationTrophies', type: 'editorial_guide', platform: 'PS4', version: 'PS4/Remaster',
    purpose: 'Contraprova de requisitos, dificuldade, roadmap e observações práticas.',
    accessedAt: '2026-07-18', lastVerifiedAt: '2026-07-18', status: 'BLOCKED', reliability: 'B',
    notes: 'Estimativas e rotas desta fonte continuam editoriais, não requisitos oficiais.',
    claims: ['re5-all-dressed-up', 're5-infinite-ammo', 're5-infinite-rocket-launcher', 're5-score-stars-18', 're5-crests-shards', 're5-dlc-s-ranks', 're5-dlc-professional', 're5-agitators-3', 're5-practical-score-80000', 're5-time-estimate', 're5-difficulty-estimate'], public: true,
    expectedTitleTerms: ['resident evil 5', 'trophy guide']
  },
  {
    id: 'gamefaqs-list-ps4',
    title: 'GameFAQs — trophies da versão PlayStation 4',
    url: 'https://gamefaqs.gamespot.com/ps4/187184-resident-evil-5/trophies',
    publisher: 'GameFAQs', type: 'trophy_list', platform: 'PS4', version: 'PS4/Remaster',
    purpose: 'Conferência independente dos 51 troféus base e dos pacotes adicionais.',
    accessedAt: '2026-07-18', lastVerifiedAt: '2026-07-18', status: 'BLOCKED', reliability: 'B',
    notes: 'Proteção antibot observada no auditor HTTP; 403 não é tratado como link quebrado.',
    claims: ['re5-base-dlc-counts', 're5-all-dressed-up', 're5-versus-wins-15', 're5-versus-melee-50'], public: true,
    expectedTitleTerms: ['resident evil 5', 'trophies']
  },
  {
    id: 'gamefaqs-lost-in-nightmares',
    title: 'GameFAQs — Lost in Nightmares FAQ (PS3)',
    url: 'https://gamefaqs.gamespot.com/ps3/989571-resident-evil-5-lost-in-nightmares/faqs/59192',
    publisher: 'GameFAQs', type: 'community_guide', platform: 'PS3', version: 'DLC original; reconferida no PS4/Remaster',
    purpose: 'Referência da DLC original para Score Stars, Guardians e Night Terrors.',
    accessedAt: '2026-07-18', lastVerifiedAt: '2026-07-18', status: 'BLOCKED', reliability: 'C',
    notes: 'Nunca usada sozinha para converter comportamento histórico em requisito da versão PS4.',
    claims: ['re5-score-stars-18', 're5-crests-shards', 're5-dlc-s-ranks', 're5-dlc-professional'], public: true,
    expectedTitleTerms: ['lost in nightmares', 'resident evil 5']
  },
  {
    id: 'gamefaqs-desperate-escape',
    title: 'GameFAQs — Desperate Escape FAQ (PS3)',
    url: 'https://gamefaqs.gamespot.com/ps3/991006-resident-evil-5-desperate-escape/faqs/59292',
    publisher: 'GameFAQs', type: 'community_guide', platform: 'PS3', version: 'DLC original; reconferida no PS4/Remaster',
    purpose: 'Referência da DLC original para Agitator Majini e The Great Escape.',
    accessedAt: '2026-07-18', lastVerifiedAt: '2026-07-18', status: 'BLOCKED', reliability: 'C',
    notes: 'Gatilhos práticos são corroborados e permanecem linguagem editorial.',
    claims: ['re5-agitators-3', 're5-desperate-150-kills', 're5-dlc-s-ranks', 're5-dlc-professional'], public: true,
    expectedTitleTerms: ['desperate escape', 'resident evil 5']
  },
  {
    id: 'youtube-bsaa-30',
    title: 'Resident Evil 5 — All 30 BSAA Emblems Guide',
    url: 'https://www.youtube.com/watch?v=qG94-12Nznk',
    publisher: 'BossCollection', type: 'video', platform: 'Multiplataforma', version: 'Compatível com PS4/Remaster',
    purpose: 'Confirmação visual das 30 posições e timestamps dos BSAA Emblems.',
    accessedAt: '2026-07-18', lastVerifiedAt: '2026-07-18', status: 'OK', reliability: 'C',
    notes: 'Vídeo de apoio; o texto do guia permanece autossuficiente.', claims: [], public: false,
    expectedTitleTerms: ['resident evil 5', '30 bsaa emblems'], youtubeId: 'qG94-12Nznk', durationSeconds: 559
  },
  {
    id: 'youtube-heart-of-africa',
    title: 'Resident Evil 5 Treasure Guide — Heart of Africa',
    url: 'https://www.youtube.com/watch?v=XKfQyYb_hBY',
    publisher: 'Scotty Dogg', type: 'video', platform: 'Multiplataforma', version: 'Compatível com PS4/Remaster',
    purpose: 'Confirmação visual do gatilho e da posição do Heart of Africa.',
    accessedAt: '2026-07-18', lastVerifiedAt: '2026-07-18', status: 'OK', reliability: 'C',
    notes: 'Apoio visual, não fonte única de requisito.', claims: [], public: false,
    expectedTitleTerms: ['resident evil 5', 'heart of africa'], youtubeId: 'XKfQyYb_hBY', durationSeconds: 71
  },
  {
    id: 'youtube-score-stars-18',
    title: 'Resident Evil 5 — All 18 Score Star Locations',
    url: 'https://www.youtube.com/watch?v=4KAJ6zfUNxc',
    publisher: 'BossCollection', type: 'video', platform: 'Multiplataforma', version: 'Compatível com PS4/Remaster',
    purpose: 'Confirmação visual e de timestamps das 18 Score Stars.',
    accessedAt: '2026-07-18', lastVerifiedAt: '2026-07-18', status: 'OK', reliability: 'C',
    notes: 'Corrobora a rota; não substitui a lista de troféus da plataforma.', claims: ['re5-score-stars-18', 're5-crests-shards'], public: false,
    expectedTitleTerms: ['resident evil 5', '18 score star'], youtubeId: '4KAJ6zfUNxc', durationSeconds: 271
  },
  {
    id: 'youtube-agitators-3',
    title: 'Resident Evil 5 PS4 — Shoot the Messenger Trophy Guide',
    url: 'https://www.youtube.com/watch?v=Zxx5PkPYeuU',
    publisher: 'factor747', type: 'video', platform: 'PS4', version: 'PS4/Remaster',
    purpose: 'Corroboração visual dos três gatilhos de Agitator Majini.',
    accessedAt: '2026-07-18', lastVerifiedAt: '2026-07-18', status: 'OK', reliability: 'C',
    notes: 'Os tempos são referências práticas e não garantias oficiais.', claims: ['re5-agitators-3'], public: false,
    expectedTitleTerms: ['resident evil 5', '3 agitator'], youtubeId: 'Zxx5PkPYeuU', durationSeconds: 370
  },
  {
    id: 'psnprofiles-sessions-re5',
    title: 'PSNProfiles — sessões de boosting',
    url: 'https://psnprofiles.com/sessions',
    publisher: 'PSNProfiles', type: 'temporary_status', platform: 'PlayStation Network', version: 'Estado temporal',
    purpose: 'Sinal comunitário temporário para atividade de sessões; não comprova disponibilidade oficial nem matchmaking.',
    accessedAt: '2026-07-18', lastVerifiedAt: '2026-07-18', status: 'INCONCLUSIVE', reliability: 'D',
    notes: 'Exige revisão humana mensal e nunca pode sustentar mudança automática para CONFIRMED_AVAILABLE ou OFFLINE.',
    claims: ['re5-online-status'], public: false, expectedTitleTerms: ['gaming sessions']
  }
];

const CLAIMS = [
  ['re5-base-dlc-counts', '51 troféus base e 20 de DLC formam 71 troféus únicos.', 'stable', 'PS4/Remaster', 'pst-list-ps4', ['gamefaqs-list-ps4'], 'HIGH', null, ['seed', 'snapshot', 'roadmap', 'meta_description', 'json_ld']],
  ['re5-all-dressed-up', 'All Dressed Up exige os quatro trajes originais; os quatro trajes adicionais do relançamento PS4 não entram e os requisitos não são compra por pontos.', 'version_dependent', 'PS4/Remaster', 'pst-list-ps4', ['gamefaqs-list-ps4', 'pst-guide-ps4'], 'HIGH', null, ['seed', 'snapshot', 'faq', 'roadmap', 'checklist']],
  ['re5-versus-requirements', 'Versus é o bloco online do 100% e não altera a platina base.', 'version_dependent', 'PS4/Remaster', 'pst-list-ps4', ['gamefaqs-list-ps4'], 'HIGH', '2026-08-17', ['seed', 'snapshot', 'faq', 'roadmap', 'checklist', 'alertas']],
  ['re5-versus-wins-15', 'A versão PS4/Remaster pede 15 vitórias em cada modo de Versus aplicável.', 'version_dependent', 'PS4/Remaster', 'pst-list-ps4', ['gamefaqs-list-ps4'], 'HIGH', null, ['seed', 'snapshot', 'faq', 'roadmap', 'checklist']],
  ['re5-versus-melee-50', 'Bringing the Pain usa 50 eliminações físicas no PS4/Remaster, não 100.', 'version_dependent', 'PS4/Remaster', 'pst-list-ps4', ['gamefaqs-list-ps4'], 'HIGH', null, ['seed', 'snapshot', 'faq', 'roadmap', 'checklist', 'alertas']],
  ['re5-infinite-ammo', 'Infinite Ammo comum exige campanha concluída, arma maximizada, compra individual e ativação nas configurações/partida.', 'version_dependent', 'PS4/Remaster', 'pst-guide-ps4', ['capcom-manual-ps4'], 'MEDIUM', null, ['seed', 'snapshot', 'faq', 'roadmap', 'checklist']],
  ['re5-infinite-rocket-launcher', 'Infinite Rocket Launcher é separada: soma dos melhores tempos abaixo de cinco horas numa mesma dificuldade.', 'version_dependent', 'PS4/Remaster', 'pst-guide-ps4', ['capcom-manual-ps4'], 'MEDIUM', null, ['seed', 'snapshot', 'faq', 'roadmap', 'checklist']],
  ['re5-score-stars-18', 'Wish Upon a Star exige destruir as 18 Score Stars de Lost in Nightmares; a rota recomenda uma única jogada.', 'version_dependent', 'PS4/Remaster', 'pst-list-ps4', ['gamefaqs-lost-in-nightmares', 'youtube-score-stars-18'], 'HIGH', null, ['seed', 'snapshot', 'faq', 'roadmap', 'checklist', 'visual', 'alt', 'fallback']],
  ['re5-crests-shards', 'Silver/Gold Crests abrem o portão e não são os shards posteriores; shards exigidos: 1/3/4/4 por dificuldade.', 'version_dependent', 'PS4/Remaster', 'gamefaqs-lost-in-nightmares', ['pst-guide-ps4', 'youtube-score-stars-18'], 'MEDIUM', null, ['seed', 'snapshot', 'roadmap', 'checklist', 'visual', 'alt', 'fallback']],
  ['re5-dlc-s-ranks', 'S ranks das DLCs são objetivos separados e não exigem Professional.', 'version_dependent', 'PS4/Remaster', 'pst-list-ps4', ['pst-guide-ps4', 'gamefaqs-lost-in-nightmares', 'gamefaqs-desperate-escape'], 'HIGH', null, ['seed', 'snapshot', 'faq', 'roadmap', 'checklist']],
  ['re5-dlc-professional', 'Night Terrors e Run the Gauntlet exigem Professional apenas nas respectivas DLCs e não mudam a platina base.', 'version_dependent', 'PS4/Remaster', 'pst-list-ps4', ['pst-guide-ps4', 'gamefaqs-lost-in-nightmares', 'gamefaqs-desperate-escape'], 'HIGH', null, ['seed', 'snapshot', 'faq', 'roadmap', 'checklist']],
  ['re5-agitators-3', 'Shoot the Messenger exige os três Agitator Majini na mesma jogada, com gatilhos de ondas específicos.', 'version_dependent', 'PS4/Remaster', 'gamefaqs-desperate-escape', ['pst-guide-ps4', 'youtube-agitators-3'], 'MEDIUM', null, ['seed', 'snapshot', 'faq', 'roadmap', 'checklist', 'visual', 'alt', 'fallback']],
  ['re5-desperate-150-kills', 'Way of the Warrior exige 150 inimigos em uma única jogada de Desperate Escape.', 'version_dependent', 'PS4/Remaster', 'pst-list-ps4', ['gamefaqs-desperate-escape'], 'HIGH', null, ['seed', 'snapshot', 'faq', 'roadmap', 'checklist']],
  ['re5-practical-score-80000', '80.000 pontos é alvo prático editorial para tentativas de S rank, não limiar oficial da Capcom.', 'editorial', 'Rota editorial PS4/Remaster', 'pst-guide-ps4', ['gamefaqs-lost-in-nightmares', 'gamefaqs-desperate-escape'], 'MEDIUM', '2026-10-18', ['seed', 'snapshot', 'roadmap', 'checklist', 'alertas']],
  ['re5-online-status', 'Versus está aparentemente disponível segundo sinais comunitários temporários; atividade e matchmaking não são garantidos.', 'volatile', 'PS4/PSN — estado temporal', 'psnprofiles-sessions-re5', [], 'LOW', '2026-08-17', ['seed', 'snapshot', 'faq', 'roadmap', 'alertas']],
  ['re5-time-estimate', 'A duração publicada é uma estimativa editorial e varia com coop, habilidade e busca pelo 100%.', 'editorial', 'Estimativa Atlas PS4/Remaster', 'pst-guide-ps4', [], 'MEDIUM', '2026-10-18', ['seed', 'snapshot', 'meta_description']],
  ['re5-difficulty-estimate', 'A dificuldade 6/10 é avaliação editorial, não requisito oficial.', 'editorial', 'Estimativa Atlas PS4/Remaster', 'pst-guide-ps4', [], 'MEDIUM', '2026-10-18', ['seed', 'snapshot', 'meta_description']]
].map(([id, summary, classification, version, primarySource, supportingSources, confidence, nextReviewAt, surfaces]) => ({
  id, summary, classification, version, primarySource, supportingSources, confidence,
  lastVerifiedAt: LAST_EDITORIAL_REVIEW, nextReviewAt, owner: EDITORIAL_OWNER, surfaces
}));

const DATA_CLASSIFICATION = [
  { id: 'stable', label: 'A — estáveis', examples: ['51 troféus base', '20 DLCs', 'capítulos', 'BSAA Emblems', 'tesouros', 'nomes e desbloqueios'], cadence: 'por evento ou revisão ampla' },
  { id: 'version_dependent', label: 'B — dependentes de versão', examples: ['PS3/PS4', '50 versus 100 eliminações', 'trajes', 'Bonus Features', 'Remaster'], cadence: 'trimestral e por mudança de plataforma' },
  { id: 'editorial', label: 'C — práticas/editoriais', examples: ['6/10', 'horas', '80.000', 'loadouts', 'farms', 'rotas'], cadence: 'trimestral' },
  { id: 'volatile', label: 'D — voláteis', examples: ['online', 'matchmaking', 'boost', 'links', 'vídeos', 'políticas e integrações'], cadence: 'mensal e por evento' }
];

const GOVERNANCE = {
  schemaVersion: 1,
  lastEditorialReview: LAST_EDITORIAL_REVIEW,
  dateModified: LAST_EDITORIAL_REVIEW,
  nextVolatileReview: NEXT_VOLATILE_REVIEW,
  technicalAuditUpdatesEditorialDates: false,
  dataClassification: DATA_CLASSIFICATION,
  onlineStatus: {
    state: 'APPARENTLY_AVAILABLE',
    lastVerifiedAt: LAST_EDITORIAL_REVIEW,
    nextReviewAt: NEXT_VOLATILE_REVIEW,
    basis: 'Sinais comunitários temporários; sem teste oficial conclusivo de matchmaking.',
    allowedStates: ['CONFIRMED_AVAILABLE', 'APPARENTLY_AVAILABLE', 'DEGRADED', 'UNCONFIRMED', 'OFFLINE', 'UNKNOWN']
  },
  workflowStates: ['NEW', 'TRIAGED', 'NEEDS_EVIDENCE', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED', 'VERIFIED', 'PUBLISHED'],
  cadence: {
    weekly: ['build', 'test:guide', 'counts', 'parity', 'assets', 'links', 'schemas', 'smoke'],
    monthly: ['online status', 'Versus', 'boost', 'blocked/inconclusive links', 'videos', 'feedback', 'volatile claims'],
    quarterly: ['71-trophy matrix', 'version differences', 'estimates', 'routes', 'DLCs', 'selective source comparison'],
    byEvent: ['Capcom notice', 'PSN change', 'server closure', 'source removal', 'report spike', 'production regression']
  },
  publicHistoryLimit: 3,
  feedbackPolicy: 'Feedback é pista não confiável até triagem, evidência e verificação humana.',
  rollbackPolicy: 'Snapshot editorial é revertido sem tocar progresso local ou tabelas de usuário.'
};

function publicSourcesFromRegistry(registry = SOURCE_REGISTRY) {
  return registry.filter(source => source.public !== false).map(source => ({
    id: source.id,
    name: source.title,
    purpose: source.purpose,
    url: source.url
  }));
}

function buildResidentEvil5EditorialAuthority() {
  return {
    authorName: EDITORIAL_OWNER,
    authorUrl: '/sobre',
    platformScope: 'PS4/Remaster',
    reviewedAt: LAST_EDITORIAL_REVIEW,
    verificationSummary: 'Conteúdo pesquisado e revisado pela Equipe Editorial AtlasAchievement para a versão PS4/Remaster.',
    methodology: [
      'Os requisitos da lista de PS4 foram cruzados entre fontes independentes e o manual oficial, separando os 51 troféus base dos 20 troféus de DLC.',
      'Diferenças de versões anteriores foram tratadas como contexto histórico e não substituem os requisitos da versão PS4/Remaster.',
      'Seed, snapshot, API, SSR, DOM hidratado e JSON-LD são validados em conjunto para impedir divergências entre as superfícies públicas.'
    ],
    sourceRegistry: SOURCE_REGISTRY,
    sources: publicSourcesFromRegistry(),
    claims: CLAIMS,
    governance: GOVERNANCE,
    limitations: [
      'A meta de 80.000 pontos nas rotas de rank S é uma referência prática, não um limiar oficial publicado pela Capcom.',
      'O modo Versus é tratado como aparentemente disponível; atividade recente não equivale a matchmaking público garantido.',
      'Disponibilidade de servidores, matchmaking e recursos online pode mudar após esta revisão.',
      'Diferenças documentadas em versões anteriores não substituem os requisitos da versão PS4/Remaster.'
    ],
    history: [
      { date: '2026-07-18', change: 'Revisão factual dos 71 troféus, com reconciliação da lista base de PS4 e dos quatro pacotes de DLC.' },
      { date: '2026-07-18', change: 'Paridade pública revisada entre compêndio, Score Stars, Guardians, Agitators, SVGs responsivos, seed e snapshot.' },
      { date: '2026-07-18', change: 'Autoria, metodologia, fontes, limitações, metadados sociais e dados estruturados publicados.' }
    ],
    socialImage: {
      src: '/assets/guides/resident-evil-5/resident-evil-5-social.png', width: 1200, height: 630,
      alt: 'Resident Evil 5 — Guia de platina PS4 + DLCs | AtlasAchievement'
    }
  };
}

module.exports = {
  LAST_EDITORIAL_REVIEW,
  NEXT_VOLATILE_REVIEW,
  EDITORIAL_OWNER,
  SOURCE_REGISTRY,
  CLAIMS,
  DATA_CLASSIFICATION,
  GOVERNANCE,
  publicSourcesFromRegistry,
  buildResidentEvil5EditorialAuthority
};
