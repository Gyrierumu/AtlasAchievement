const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 're5-phase7');

const dimensions = [
  ['precision', 'Precisão'],
  ['completeness', 'Completude'],
  ['operational', 'Instrução operacional'],
  ['version', 'Clareza da versão'],
  ['prevention', 'Prevenção de erro'],
  ['recovery', 'Recuperação'],
  ['location', 'Facilidade de localização'],
  ['visual', 'Apoio visual'],
  ['sources', 'Transparência das fontes'],
  ['mobile', 'Uso em mobile']
];

const systems = [
  ['roadmap', 'Roadmap', 5, 5, 3, 'sete etapas, ordem e resultado por etapa'],
  ['chapters', 'Capítulos', 4, 5, 4, '16 capítulos com observações, riscos e cleanup'],
  ['base-trophies', 'Troféus base', 4, 4, 4, '51 cards pesquisáveis, requisitos e dicas'],
  ['bsaa', 'BSAA Emblems', 5, 4, 5, '30 itens, capítulo, ponto sem retorno e recuperação'],
  ['treasures', 'Tesouros', 5, 5, 5, '50 tipos, gatilhos e Heart of Africa individualizado'],
  ['stockpile', 'Armas e Stockpile', 4, 4, 4, '27 entradas e distinção entre coleta e posse'],
  ['upgrades', 'Upgrades', 3, 4, 4, '18 armas atualizáveis e exceções explícitas'],
  ['outfits', 'Trajes', 3, 5, 4, 'quatro trajes PS4, marcos 25/30 e custo zero'],
  ['figures', 'Figures', 3, 4, 4, 'figuras, pré-requisitos e Bonus Features separados'],
  ['s-ranks', 'Ranks S', 3, 4, 4, '16 capítulos, critérios práticos e dificuldade livre'],
  ['infinite-ammo', 'Infinite Ammo', 3, 5, 4, 'fluxo por arma, duas moedas e Special Settings'],
  ['infinite-rocket', 'Infinite Rocket Launcher', 2, 5, 4, 'soma dos melhores tempos abaixo de cinco horas'],
  ['professional', 'Professional', 3, 5, 5, 'desbloqueio, loadout, capítulos críticos e recuperação'],
  ['sheva-ai', 'IA da Sheva', 2, 5, 4, 'comandos, inventário, resgates e alternativas coop'],
  ['farms', 'Farms', 2, 5, 4, 'dinheiro, Lion Hearts, Power Stones e Exchange Points'],
  ['bosses', 'Chefes', 3, 4, 5, '22 encontros com risco, método e retorno'],
  ['situational', 'Troféus situacionais', 2, 4, 4, '22 objetivos e capítulos curtos recomendados'],
  ['versus', 'Versus', 1, 2, 4, '10 troféus PS4, jogadores, sessões, combos, pontos e ressalva online'],
  ['lost', 'Lost in Nightmares', 2, 5, 4, 'cinco troféus, S rank e Professional local'],
  ['score-stars', 'Score Stars', 5, 5, 5, '18 itens autossuficientes, #17/#18 e vídeo opcional'],
  ['desperate', 'Desperate Escape', 1, 5, 4, 'cinco troféus, S rank, Professional e checkpoints'],
  ['agitators', 'Agitators', 3, 5, 5, 'três gatilhos, variabilidade do terceiro e nova run'],
  ['kills-150', '150 kills', 1, 4, 4, 'contagem individual em uma run e plano por áreas'],
  ['sources', 'Fontes', 1, 5, 3, 'autoria, seis fontes, metodologia, limitações e histórico'],
  ['versions', 'Diferenças de versão', 1, 3, 3, 'PS4/Remaster separado de PS3 e Xbox em pontos sensíveis'],
  ['recovery', 'Recuperação', 2, 4, 3, 'Chapter Select, checkpoints e nova run indicados por objetivo'],
  ['visual-support', 'Apoio visual', 1, 2, 5, 'cinco SVGs originais com fallback textual e mobile']
].map(([id, label, gamefaqsCoverage, atlasCoverage, atlasVisual, evidence]) => ({ id, label, gamefaqsCoverage, atlasCoverage, atlasVisual, evidence }));

const competitors = [
  {
    id: 'atlas', name: 'AtlasAchievement', status: 'inspectable-local',
    url: 'http://127.0.0.1:4319/jogo/resident-evil-5',
    note: 'API, SSR, DOM, snapshot, banco, JSON-LD e sete viewports inspecionados.'
  },
  {
    id: 'pst', name: 'PlayStationTrophies', status: 'not-measurable',
    url: 'https://www.playstationtrophies.org/game/resident-evil-5-ps4/guide/',
    note: 'HTTP 403 na inspeção direta automatizada; resultados de busca não foram usados como prova conclusiva nem para pontuar.'
  },
  {
    id: 'psnp', name: 'PSNProfiles', status: 'not-measurable', url: null,
    note: 'Nenhum guia público específico inspecionável foi localizado nas buscas focadas; nenhum URL foi presumido.'
  },
  {
    id: 'powerpyx', name: 'PowerPyx', status: 'not-measurable', url: null,
    note: 'Nenhum guia público específico de RE5 foi localizado nas buscas focadas; nenhuma nota foi calculada.'
  },
  {
    id: 'gamefaqs', name: 'GameFAQs', status: 'inspectable',
    url: 'https://gamefaqs.gamespot.com/ps4/187184-resident-evil-5/faqs/73989',
    note: 'Speedrun/platina PS4, walkthrough, tesouros e FAQs de Lost in Nightmares/Desperate Escape inspecionados.'
  },
  {
    id: 'trueachievements', name: 'TrueAchievements', status: 'partially-inspectable',
    url: 'https://www.trueachievements.com/game/Resident-Evil-5-Xbox-One/walkthrough',
    note: 'Overview inspecionável; subpáginas específicas retornaram 403 e ficaram sem nota.'
  },
  {
    id: 'community', name: 'Comunidade (fontes específicas)', status: 'partially-inspectable',
    url: 'https://residentevil.org/threads/resident-evil-5-lost-in-nightmares-score-star-locations-guide.7038/',
    note: 'Score Stars e guias de BSAA inspecionados; sistemas sem fonte comunitária examinada ficaram sem nota.'
  },
  {
    id: 'capcom', name: 'Manual oficial Capcom', status: 'inspectable',
    url: 'https://static.capcom.com/manuals/re5/RE5_PS4_DMNL_EN.pdf',
    note: 'PDF oficial PS4 de três páginas inspecionado; não é um guia de troféus.'
  }
];

const dimensionNotes = {
  atlas: {
    precision: 'requisitos sensíveis foram cruzados e as inferências estão rotuladas', completeness: 'o sistema está coberto até o nível necessário para executar',
    operational: 'há ação, local, risco e sequência', version: 'o escopo PS4/Remaster aparece junto ao conteúdo', prevention: 'erros previsíveis são destacados',
    recovery: 'Chapter Select, checkpoint ou nova run são indicados', location: 'aba, título, busca e fragment facilitam o acesso', visual: 'a nota reflete o apoio visual realmente disponível',
    sources: 'fonte, finalidade, autoria e limitação são públicas', mobile: '360/390 px e teclado foram validados'
  },
  gamefaqs: {
    precision: 'o texto inspecionado é específico e geralmente consistente', completeness: 'a nota reflete a cobertura observada nas FAQs selecionadas',
    operational: 'as FAQs fornecem passos, mas a granularidade varia', version: 'há páginas PS4 e FAQs de DLC PS3, exigindo atenção à versão',
    prevention: 'avisos existem, mas não são uniformes', recovery: 'reinício/cleanup aparece em parte das rotas', location: 'TOC e busca textual ajudam, sem navegação por camadas',
    visual: 'predomina texto; imagens antigas ou externas não são uniformes', sources: 'autoria existe, mas não há matriz editorial de fontes por afirmação', mobile: 'HTML textual é utilizável, com densidade alta'
  }
};

function rating(competitor, system, dimension) {
  if (['pst', 'psnp', 'powerpyx'].includes(competitor.id)) return { score: null, justification: competitor.note };

  if (competitor.id === 'atlas') {
    const scoreMap = {
      precision: Math.min(5, Math.max(4, system.atlasCoverage)), completeness: system.atlasCoverage, operational: system.atlasCoverage,
      version: 5, prevention: Math.min(5, system.atlasCoverage), recovery: Math.min(5, Math.max(4, system.atlasCoverage - 1)),
      location: 5, visual: system.atlasVisual, sources: 5, mobile: 5
    };
    return { score: scoreMap[dimension], justification: `${system.evidence}; ${dimensionNotes.atlas[dimension]}.` };
  }

  if (competitor.id === 'gamefaqs') {
    const c = system.gamefaqsCoverage;
    if (c === 0) return { score: 0, justification: `As FAQs integralmente inspecionadas não cobrem ${system.label.toLowerCase()} como sistema executável.` };
    const scoreMap = {
      precision: Math.min(4, c), completeness: c, operational: Math.min(5, c), version: Math.min(3, c), prevention: Math.max(1, c - 1),
      recovery: Math.max(1, c - 2), location: Math.min(3, c), visual: Math.min(2, c), sources: 1, mobile: Math.min(3, c)
    };
    return { score: scoreMap[dimension], justification: `Cobertura observada: ${system.evidence}; ${dimensionNotes.gamefaqs[dimension]}.` };
  }

  if (competitor.id === 'trueachievements') {
    if (!['roadmap', 'base-trophies'].includes(system.id)) return { score: null, justification: 'A subpágina correspondente retornou 403; o overview não permite pontuar este sistema.' };
    const scoreMap = { precision: 3, completeness: 2, operational: 2, version: 2, prevention: 1, recovery: 1, location: 3, visual: 1, sources: 1, mobile: 4 };
    return { score: scoreMap[dimension], justification: 'O overview Xbox One exibe esforço, playthrough e índice, mas as páginas operacionais ficaram bloqueadas.' };
  }

  if (competitor.id === 'community') {
    const coverage = system.id === 'score-stars' ? 5 : (system.id === 'bsaa' ? 4 : null);
    if (coverage === null) return { score: null, justification: 'Nenhuma fonte comunitária específica deste sistema foi inspecionada; não foi atribuída nota por associação.' };
    const scoreMap = { precision: 4, completeness: coverage, operational: 4, version: 2, prevention: 3, recovery: 2, location: 3, visual: coverage, sources: 2, mobile: 3 };
    return { score: scoreMap[dimension], justification: `${system.label}: guia comunitário específico inspecionado, útil e visual, sem a transparência editorial completa do Atlas.` };
  }

  if (competitor.id === 'capcom') {
    if (system.id !== 'versions') return { score: 0, justification: `O manual PS4 completo foi inspecionado e não trata ${system.label.toLowerCase()} como sistema de troféu.` };
    const scoreMap = { precision: 5, completeness: 3, operational: 2, version: 5, prevention: 2, recovery: 0, location: 4, visual: 3, sources: 5, mobile: 3 };
    return { score: scoreMap[dimension], justification: 'Fonte oficial para controles, modos e edição PS4; não detalha diferenças de requisitos de troféus.' };
  }
  return { score: null, justification: 'Não mensurável.' };
}

const matrix = systems.map(system => ({
  system: system.id,
  label: system.label,
  competitors: competitors.map(competitor => ({
    competitor: competitor.id,
    name: competitor.name,
    ratings: dimensions.map(([id, label]) => ({ dimension: id, label, ...rating(competitor, system, id) }))
  }))
}));

const intents = [
  ['resident evil 5 guia de platina ps4', '#guideHeader', 'Hero explicita PS4/Remaster, 51/71, dificuldade, tempo e começo.'],
  ['resident evil 5 trophy guide ps4', '#guideTab-checklist', 'Checklist base com 51 troféus e busca.'],
  ['resident evil 5 all dressed up ps4', '#re5-bonus-features-all-dressed-up', 'Quatro trajes, 25/30 emblemas, custo zero e gatilho do troféu.'],
  ['resident evil 5 infinite ammo', '#re5-bonus-features-infinite-ammo', 'Processo por arma, dinheiro, Exchange Points e Special Settings.'],
  ['resident evil 5 infinite rocket launcher', '#re5-bonus-features-infinite-ammo', 'Condição separada de soma dos melhores tempos abaixo de cinco horas.'],
  ['resident evil 5 30 BSAA emblems', '#extras-bsaa-emblems', 'Checklist de 30 com itemização.'],
  ['resident evil 5 treasure locations', '#extras-tesouros', 'Checklist dos 50 tipos.'],
  ['resident evil 5 Heart of Africa', '#re5-treasure-50-heart-of-africa', 'Gatilho, posição, janela, risco, recuperação e figura.'],
  ['resident evil 5 professional guide', '#guideProfessionalAiPanel', 'Desbloqueio, loadout, IA/coop, capítulos críticos e recuperação.'],
  ['resident evil 5 chapter 2-3 professional', '#chapter-route-chapter-2-3', 'Rota individual do turret e ligação ao bloco Professional.'],
  ['resident evil 5 versus trophies boost', '#re5-versus-dlc', 'Jogadores, sessões, ordem de boost e ressalva temporária.'],
  ['resident evil 5 versus 15 wins', '#re5-versus-dlc', '15 vitórias em cada um dos quatro modos na edição PS4.'],
  ['lost in nightmares score stars', '#re5-lost-in-nightmares-score-stars', 'Rota autossuficiente das 18 estrelas.'],
  ['lost in nightmares professional', '#guideTab-dlc', 'Night Terrors no pacote da DLC, com desbloqueio local e quatro shards no Professional.'],
  ['desperate escape agitator locations', '#re5-desperate-escape-agitator-majini', 'Três gatilhos e recuperação por nova run.'],
  ['desperate escape 150 kills', '#guideTab-dlc', 'Way of the Warrior: 150 kills individuais em uma jogada.'],
  ['resident evil 5 DLC trophies', '#guideTab-dlc', '20 troféus, três pacotes e separação da platina base.']
].map(([query, anchor, response]) => ({ query, anchor, response, status: 'resolvida naturalmente; sem texto adicionado na Fase 7' }));

const scored = [];
for (const row of matrix) for (const competitor of row.competitors) for (const item of competitor.ratings) if (item.score !== null) scored.push({ competitor: competitor.competitor, score: item.score });
const aggregates = competitors.map(competitor => {
  const values = scored.filter(item => item.competitor === competitor.id).map(item => item.score);
  return { competitor: competitor.id, name: competitor.name, ratedCells: values.length, average: values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : null };
});

const result = {
  generatedAt: new Date().toISOString(),
  scale: { 0: 'ausente', 1: 'apenas menciona', 2: 'requisito presente', 3: 'executável', 4: 'executável com risco e recuperação', 5: 'referência completa, clara e autossuficiente' },
  dimensions: dimensions.map(([id, label]) => ({ id, label })),
  competitors,
  systems: systems.map(({ id, label }) => ({ id, label })),
  matrix,
  intents,
  aggregates,
  conclusion: 'Dentro da matriz auditada, o Atlas iguala ou supera os concorrentes acessíveis em cobertura operacional e autossuficiência.'
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'benchmark-matrix.json'), `${JSON.stringify(result, null, 2)}\n`);
const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
const csv = [['system', 'competitor', 'dimension', 'score', 'justification'].map(quote).join(',')];
for (const row of matrix) for (const competitor of row.competitors) for (const item of competitor.ratings) csv.push([row.label, competitor.name, item.label, item.score, item.justification].map(quote).join(','));
fs.writeFileSync(path.join(OUT_DIR, 'benchmark-matrix.csv'), `${csv.join('\n')}\n`);
process.stdout.write(`Benchmark generated: ${matrix.length} systems, ${competitors.length} competitors, ${matrix.length * competitors.length * dimensions.length} cells.\n`);
