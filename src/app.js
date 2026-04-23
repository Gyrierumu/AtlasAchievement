const fs = require('fs');
const express = require('express');
const session = require('express-session');
const path = require('path');
const requestContext = require('./middleware/requestContext');
const securityHeaders = require('./middleware/securityHeaders');
const { issueCsrfToken, requireCsrf } = require('./middleware/csrfProtection');
const { escapeXml } = require('./utils/xml');
const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const gamesRoutes = require('./routes/games.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const errorHandler = require('./middleware/errorHandler');
const gamesService = require('./services/games.service');
const { loginRateLimit, registerFailedLoginAttempt, clearLoginRateLimit } = require('./middleware/loginRateLimit');
const SqliteSessionStore = require('./services/sqliteSessionStore');
const AppError = require('./utils/AppError');

const app = express();
const publicIndexPath = path.join(__dirname, '../public/index.html');
const publicIndexTemplate = fs.readFileSync(publicIndexPath, 'utf8');
const catalogFacetPageMap = {
  all: {
    serviceFacet: 'all',
    path: '/catalogo',
    title: 'Catálogo de jogos | AtlasAchievement',
    description: 'Navegue pelo catálogo de jogos com dificuldade, tempo estimado, troféus e atalhos por faixa de desafio e duração.',
    name: 'Catálogo de jogos',
    heroTitle: 'Navegue sem depender da busca',
    heroDescription: 'Veja todos os jogos em uma lista filtrável com dificuldade, tempo estimado, troféus e acesso direto à página de guia.',
    collectionTitle: 'Catálogo completo',
    collectionDescription: 'Use a visão geral para comparar jogos por dificuldade, tempo e densidade de checklist antes de decidir onde investir seu tempo.',
    reason: 'Boa para quem ainda não sabe o que jogar e quer sentir o tamanho real do catálogo.',
    checklist: 'Ordene por recomendação, abra um destaque e valide roadmap, perdíveis e esforço total.',
    introTitle: 'Pontos de entrada para escolher melhor',
    introBody: 'Este catálogo foi pensado para reduzir a dúvida antes de abrir um guia. Em vez de depender só da busca, você pode comparar esforço, duração e densidade da lista ainda na página de coleção, o que ajuda o Google a entender melhor o acervo e ajuda o jogador a decidir com menos fricção.',
    related: ['dificuldade-baixa', 'ate-15-horas', 'mais-de-60-trofeus']
  },
  'dificuldade-baixa': {
    serviceFacet: 'difficulty-low',
    path: '/catalogo/dificuldade-baixa',
    title: 'Jogos de dificuldade baixa | AtlasAchievement',
    description: 'Veja jogos com dificuldade de 1 a 3 para começar listas de troféus e concluir mais rápido.',
    name: 'Jogos de dificuldade baixa',
    heroTitle: 'Coleção para começar com menos atrito',
    heroDescription: 'Abra jogos de dificuldade baixa quando quiser uma platina mais viável, com menos risco de travar logo no começo.',
    collectionTitle: 'Jogos de dificuldade baixa',
    collectionDescription: 'Esta faixa funciona bem para primeiras platinas, descansos entre projetos maiores e sessões em que você quer avançar sem pressão excessiva.',
    reason: 'Filtra jogos que tendem a exigir menos execução avançada e deixam a leitura do guia mais direta.',
    checklist: 'Confira se o jogo também é curto e se já possui roadmap suficiente para virar uma entrada segura.',
    introTitle: 'Quando esta coleção faz sentido',
    introBody: 'Jogos de dificuldade baixa costumam funcionar melhor como porta de entrada para primeiras platinas ou como respiro entre projetos mais pesados. A página precisa mostrar isso com clareza para ranquear melhor e para converter visitas em cliques úteis.',
    related: ['ate-15-horas', 'dificuldade-media', 'ate-30-trofeus']
  },
  'dificuldade-media': {
    serviceFacet: 'difficulty-mid',
    path: '/catalogo/dificuldade-media',
    title: 'Jogos de dificuldade média | AtlasAchievement',
    description: 'Explore jogos com dificuldade de 4 a 6 e escolha projetos intermediários para continuar.',
    name: 'Jogos de dificuldade média',
    heroTitle: 'Projetos intermediários para continuar em bom ritmo',
    heroDescription: 'Use esta coleção quando quiser algo mais substancial do que uma platina fácil, mas sem cair direto em maratonas brutais.',
    collectionTitle: 'Jogos de dificuldade média',
    collectionDescription: 'Boa faixa para quem já está confortável com checklists, mas ainda quer equilíbrio entre progresso consistente e desafio moderado.',
    reason: 'Ajuda a separar jogos que já pedem mais atenção sem virar projetos excessivamente punitivos.',
    checklist: 'Abra a página e valide se o tempo total e o roadmap combinam com a sua disponibilidade atual.',
    introTitle: 'O que caracteriza uma dificuldade média',
    introBody: 'Aqui entram projetos que já pedem mais atenção, mas ainda mantêm um custo de entrada administrável. Isso ajuda a responder buscas de intenção intermediária e melhora a leitura editorial da coleção.',
    related: ['dificuldade-baixa', '16-a-40-horas', '31-a-60-trofeus']
  },
  'dificuldade-alta': {
    serviceFacet: 'difficulty-high',
    path: '/catalogo/dificuldade-alta',
    title: 'Jogos de dificuldade alta | AtlasAchievement',
    description: 'Encontre jogos com dificuldade de 7 a 10 para quem busca listas mais exigentes.',
    name: 'Jogos de dificuldade alta',
    heroTitle: 'Listas exigentes para quem quer desafio real',
    heroDescription: 'Entre nesta faixa quando quiser projetos mais duros, que pedem leitura cuidadosa e mais comprometimento de execução.',
    collectionTitle: 'Jogos de dificuldade alta',
    collectionDescription: 'Ideal para usuários que já sabem onde estão entrando e querem separar jogos realmente exigentes do restante do catálogo.',
    reason: 'Concentra projetos que costumam exigir mais habilidade, persistência e leitura disciplinada do guia.',
    checklist: 'Antes de começar, confirme tempo total, troféus sensíveis e se há roadmap suficiente para não desperdiçar horas.',
    introTitle: 'Antes de abrir uma lista exigente',
    introBody: 'Coleções de dificuldade alta precisam explicar risco, compromisso e densidade do guia. Isso melhora a utilidade para o leitor e dá mais contexto semântico para buscas ligadas a desafios e platinas difíceis.',
    related: ['mais-de-40-horas', 'mais-de-60-trofeus', 'dificuldade-media']
  },
  'ate-15-horas': {
    serviceFacet: 'time-short',
    path: '/catalogo/ate-15-horas',
    title: 'Jogos até 15 horas | AtlasAchievement',
    description: 'Veja jogos com tempo estimado mais curto para concluir troféus em até 15 horas.',
    name: 'Jogos até 15 horas',
    heroTitle: 'Coleção de entrada rápida',
    heroDescription: 'Veja projetos mais curtos para fechar uma platina sem transformar o jogo em compromisso de várias semanas.',
    collectionTitle: 'Jogos até 15 horas',
    collectionDescription: 'Ótima faixa para fins de semana, descanso entre listas grandes e usuários que querem retorno rápido por hora investida.',
    reason: 'Reduz o risco de escolher algo que parece simples, mas vira uma maratona maior do que o esperado.',
    checklist: 'Cheque a dificuldade real e se existe algum perdível escondido antes de assumir que o jogo é só rápido.',
    introTitle: 'Para quem quer retorno rápido',
    introBody: 'Páginas focadas em jogos curtos respondem bem a buscas de alta intenção, especialmente quando a lista já nasce com texto explicativo e cards em HTML no servidor.',
    related: ['dificuldade-baixa', '16-a-40-horas', 'ate-30-trofeus']
  },
  '16-a-40-horas': {
    serviceFacet: 'time-medium',
    path: '/catalogo/16-a-40-horas',
    title: 'Jogos de 16 a 40 horas | AtlasAchievement',
    description: 'Encontre jogos com tempo estimado de 16 a 40 horas para projetos de médio prazo.',
    name: 'Jogos de 16 a 40 horas',
    heroTitle: 'Projetos médios para manter tração',
    heroDescription: 'Abra esta faixa quando quiser algo mais completo, mas ainda compatível com uma rotina normal de sessões.',
    collectionTitle: 'Jogos de 16 a 40 horas',
    collectionDescription: 'Aqui ficam projetos equilibrados para quem quer uma trilha mais longa, sem cair nos extremos do catálogo.',
    reason: 'Ajuda a encontrar jogos que rendem progresso contínuo e ainda cabem melhor no calendário.',
    checklist: 'Compare dificuldade, roadmap e tamanho da lista para decidir qual deles encaixa melhor no seu momento.',
    introTitle: 'Faixa intermediária de tempo',
    introBody: 'Coleções de médio prazo ajudam a capturar usuários que querem profundidade sem assumir uma maratona longa. Esse texto reforça intenção de busca e melhora contexto da página.',
    related: ['dificuldade-media', 'ate-15-horas', 'mais-de-40-horas']
  },
  'mais-de-40-horas': {
    serviceFacet: 'time-long',
    path: '/catalogo/mais-de-40-horas',
    title: 'Jogos com mais de 40 horas | AtlasAchievement',
    description: 'Navegue por jogos longos e maratonas com listas de troféus acima de 40 horas.',
    name: 'Jogos com mais de 40 horas',
    heroTitle: 'Maratonas para abrir com plena consciência',
    heroDescription: 'Veja projetos longos quando estiver procurando uma trilha mais extensa e quiser validar melhor o custo total de tempo.',
    collectionTitle: 'Jogos com mais de 40 horas',
    collectionDescription: 'Esta coleção serve para separar maratonas que pedem planejamento real, disciplina de checklist e expectativa ajustada desde o começo.',
    reason: 'Evita entrar em jogos longos sem antes comparar esforço, densidade da lista e necessidade de revisão contínua.',
    checklist: 'Abra a página e confirme quantas etapas existem no roadmap e quais troféus podem gerar retrabalho tardio.',
    introTitle: 'Quando vale abrir uma maratona',
    introBody: 'Projetos longos precisam de explicação editorial ainda mais forte, porque a intenção do usuário costuma ser comparar custo de tempo, não só clicar no primeiro resultado.',
    related: ['dificuldade-alta', '16-a-40-horas', 'mais-de-60-trofeus']
  },
  'ate-30-trofeus': {
    serviceFacet: 'trophies-small',
    path: '/catalogo/ate-30-trofeus',
    title: 'Jogos com até 30 troféus | AtlasAchievement',
    description: 'Abra listas menores, com até 30 troféus, para organizar checklists mais curtos.',
    name: 'Jogos com até 30 troféus',
    heroTitle: 'Checklists menores para seguir com leveza',
    heroDescription: 'Explore listas curtas quando quiser menos itens para controlar e uma leitura mais rápida da página do jogo.',
    collectionTitle: 'Jogos com até 30 troféus',
    collectionDescription: 'Boa faixa para quem gosta de checklists enxutos e quer sentir progresso sem navegar por listas muito extensas.',
    reason: 'Ajuda a filtrar jogos com menos volume estrutural de troféus, úteis para sessões mais leves.',
    checklist: 'Mesmo com lista pequena, confirme se há roadmap e troféus sensíveis antes de começar despreocupado.',
    introTitle: 'Menos itens para acompanhar',
    introBody: 'Listas menores costumam ter apelo forte para jogadores que querem gestão simples de progresso. A coleção ganha força quando essa promessa fica clara já no HTML.',
    related: ['ate-15-horas', 'dificuldade-baixa', '31-a-60-trofeus']
  },
  '31-a-60-trofeus': {
    serviceFacet: 'trophies-medium',
    path: '/catalogo/31-a-60-trofeus',
    title: 'Jogos com 31 a 60 troféus | AtlasAchievement',
    description: 'Explore jogos com listas intermediárias de 31 a 60 troféus.',
    name: 'Jogos com 31 a 60 troféus',
    heroTitle: 'Volume intermediário de checklist',
    heroDescription: 'Use esta coleção quando quiser listas mais completas, mas ainda legíveis em um fluxo normal de acompanhamento.',
    collectionTitle: 'Jogos com 31 a 60 troféus',
    collectionDescription: 'Aqui ficam jogos com densidade intermediária de troféus, bons para usuários que gostam de progresso granular sem excesso.',
    reason: 'Separa projetos com mais profundidade de checklist, mas ainda sem o peso de listas muito grandes.',
    checklist: 'Compare o número de etapas do roadmap e o tempo estimado para evitar escolher só pelo tamanho da lista.',
    introTitle: 'Equilíbrio entre densidade e leitura',
    introBody: 'Coleções de volume intermediário ajudam a explicar a diferença entre listas leves e maratonas densas. Isso fortalece intenção de busca e arquitetura de informação.',
    related: ['dificuldade-media', '16-a-40-horas', 'mais-de-60-trofeus']
  },
  'mais-de-60-trofeus': {
    serviceFacet: 'trophies-large',
    path: '/catalogo/mais-de-60-trofeus',
    title: 'Jogos com mais de 60 troféus | AtlasAchievement',
    description: 'Veja jogos com listas longas, acima de 60 troféus, para acompanhar por etapas.',
    name: 'Jogos com mais de 60 troféus',
    heroTitle: 'Listas densas para quem gosta de profundidade',
    heroDescription: 'Abra esta faixa quando quiser jogos com muitos troféus e sensação forte de progresso ao longo de várias sessões.',
    collectionTitle: 'Jogos com mais de 60 troféus',
    collectionDescription: 'Essa coleção funciona como vitrine das listas mais densas do catálogo, boas para quem valoriza acompanhamento detalhado.',
    reason: 'Ajuda a encontrar jogos em que o checklist é parte central da experiência, não só um complemento.',
    checklist: 'Antes de entrar, valide tempo total, risco de retrabalho e se o roadmap já está forte o suficiente para sustentar a maratona.',
    introTitle: 'Quando a densidade da lista importa',
    introBody: 'Listas muito grandes exigem páginas de coleção com mais contexto e mais sinais de qualidade. Isso melhora SEO e prepara melhor o clique para a página do jogo.',
    related: ['mais-de-40-horas', 'dificuldade-alta', '31-a-60-trofeus']
  }
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function safeJsonForHtml(value) {
  return JSON.stringify(value).replace(/<\/script/gi, '<\\/script');
}

function resolveMetaImage(origin, imagePath) {
  if (!imagePath) return `${origin}/og-default.svg`;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${origin}${imagePath}`;
}


function buildInitialStateScript(payload = null) {
  if (!payload) return '<script>window.__INITIAL_STATE__ = null;</script>';
  return `<script>window.__INITIAL_STATE__ = ${safeJsonForHtml(payload)};</script>`;
}

function renderTrophyCardHtml(trophy, completedIds = new Set()) {
  const done = completedIds.has(trophy.id);
  const description = trophy.description || '';
  const tip = trophy.tip || '';
  const search = `${trophy.name || ''} ${description} ${tip}`.trim().toLowerCase();
  const spoilerClasses = trophy.is_spoiler ? 'spoiler-blur' : '';
  const spoilerText = trophy.is_spoiler ? '<span class="spoiler-hint">Conteúdo oculto até você revelar.</span>' : '';

  return `
    <article class="trophy-card atlas-panel rounded-[24px] p-5 bg-white/[0.03] border border-white/10 ${done ? 'completed' : ''}" data-trophy-id="${escapeHtml(trophy.id || '')}" data-type="${escapeHtml(trophy.type || 'Bronze')}" data-status="${done ? 'completed' : 'pending'}" data-search="${escapeHtml(search)}">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <span class="atlas-tag">${escapeHtml(trophy.type || 'Bronze')}</span>
            ${trophy.is_spoiler ? '<span class="atlas-tag">Spoiler</span>' : ''}
            ${done ? '<span class="atlas-tag">Concluído</span>' : '<span class="atlas-tag">Pendente</span>'}
          </div>
          <h4 class="text-xl font-bold text-white">${escapeHtml(trophy.name || 'Troféu')}</h4>
          ${trophy.is_spoiler ? '<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact mt-3" data-spoiler-toggle="true" aria-expanded="false">Revelar spoiler</button>' : ''}
          <p class="text-sm text-white/80 mt-2 ${spoilerClasses}" ${trophy.is_spoiler ? 'data-spoiler="true" aria-hidden="true"' : ''}>${spoilerText}${escapeHtml(description || 'Sem descrição.')}</p>
          ${tip ? `<div class="atlas-tip-box mt-4"><div class="text-xs uppercase tracking-wide text-cyan-200/85">Dica</div><p class="text-sm text-cyan-50/92 mt-2 ${spoilerClasses}" ${trophy.is_spoiler ? 'data-spoiler="true" aria-hidden="true"' : ''}>${trophy.is_spoiler ? '<span class="spoiler-hint">Dica oculta até você revelar.</span>' : ''}${escapeHtml(tip)}</p></div>` : ''}
        </div>
        <div class="md:w-auto shrink-0 self-start">
          <button type="button" class="atlas-btn ${done ? 'atlas-btn-secondary' : 'atlas-btn-primary'}" data-trophy-toggle="${escapeHtml(trophy.id || '')}" aria-pressed="${done ? 'true' : 'false'}">${done ? 'Desmarcar' : 'Marcar como concluído'}</button>
        </div>
      </div>
    </article>`;
}

function getDifficultyProfileLabel(difficulty) {
  const value = Number(difficulty || 0);
  if (value >= 9) return 'Brutal';
  if (value >= 7) return 'Exigente';
  if (value >= 4) return 'Intermediária';
  if (value >= 1) return 'Acessível';
  return 'Não avaliada';
}

function getTrophyBreakdown(trophies = []) {
  return ['Platina', 'Ouro', 'Prata', 'Bronze'].map(type => ({
    type,
    count: trophies.filter(trophy => String(trophy?.type || '').toLowerCase() === type.toLowerCase()).length
  }));
}


function buildGuideDecisionModel(game, trophies = [], roadmap = []) {
  const difficulty = Number(game?.difficulty || 0);
  const total = Array.isArray(trophies) ? trophies.length : 0;
  const missables = trophies.filter(trophy => trophy && (trophy.is_missable || trophy.is_spoiler)).length;
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

function formatDisplayDate(value) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return date.toLocaleDateString('pt-BR');
}


function buildEditorialSignals(game, viewModel) {
  const total = Number(viewModel?.total || 0);
  const roadmapCount = Number(viewModel?.roadmap?.length || 0);
  const missables = Number(viewModel?.missables || 0);
  const difficulty = Number(game?.difficulty || 0);
  const reviewedAt = formatDisplayDate(game?.updated_at || game?.created_at);

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

  const scopeItems = [
    `${total} troféu(s) visíveis no guia`,
    roadmapCount ? `${roadmapCount} etapa(s) no roadmap` : 'roadmap ainda enxuto',
    missables ? `${missables} alerta(s) de atenção` : 'sem alerta crítico marcado'
  ];

  const methodItems = [
    'Dificuldade, tempo e perdíveis apresentados no topo para decisão rápida.',
    roadmapCount ? 'O roadmap já organiza a ordem de progressão antes da checklist completa.' : 'A checklist existe, mas o roadmap ainda precisa de mais detalhamento.',
    missables ? 'Os alertas marcados sugerem começar com leitura cuidadosa do guia.' : 'Sem muitos alertas críticos, a entrada tende a ser mais simples.'
  ];

  return {
    reviewer: 'Equipe editorial AtlasAchievement',
    reviewedAt,
    coverageLabel,
    coverageDetail,
    readinessLabel,
    readinessDetail,
    scopeSummary: scopeItems.join(' • '),
    methodSummary: 'Dificuldade, tempo, roadmap e alertas são consolidados na própria página para reduzir retrabalho.',
    scopeItems,
    methodItems
  };
}

function buildGuideViewModel(game, completedSource = [], options = {}) {
  const trophies = Array.isArray(game?.trophies) ? game.trophies : [];
  const roadmap = Array.isArray(game?.roadmap) ? game.roadmap : [];
  const completedIds = new Set(Array.isArray(completedSource) ? completedSource : []);
  const total = trophies.length;
  const completed = trophies.filter(trophy => completedIds.has(trophy.id)).length;
  const pending = Math.max(total - completed, 0);
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const spoilerCount = trophies.filter(trophy => trophy?.is_spoiler).length;
  const missables = trophies.filter(trophy => trophy && (trophy.is_missable || trophy.is_spoiler)).length;
  const breakdown = getTrophyBreakdown(trophies);
  const breakdownText = breakdown.filter(item => item.count > 0).map(item => `${item.count} ${item.type}`).join(' • ') || 'Sem troféus detalhados';
  const quickNotes = [
    game?.missable ? game.missable : 'Revise os alertas editoriais antes de iniciar a campanha.',
    roadmap.length ? `Siga ${roadmap.length} etapa(s) do roadmap para evitar retrabalho e organizar a platina.` : 'Monte uma ordem de execução antes de sair marcando troféus soltos.',
    spoilerCount ? `${spoilerCount} troféu(s) têm spoiler e pedem leitura com cautela.` : 'Os troféus visíveis podem ser revisados sem grandes spoilers.'
  ].filter(Boolean);
  const prepChecklist = [
    missables ? `Leia com atenção o bloco de perdíveis: há ${missables} alerta(s) que pedem atenção antes de avançar.` : 'Não há alerta forte de perdível marcado neste guia, então você pode seguir com mais liberdade.',
    total ? `A lista tem ${total} troféu(s), com distribuição ${breakdownText}.` : 'Ainda não há troféus cadastrados para este jogo.',
    roadmap.length ? `O roadmap já está quebrado em ${roadmap.length} etapa(s), útil para sessões curtas.` : 'O guia ainda precisa de um roadmap mais detalhado para orientar melhor a ordem da platina.'
  ];
  const spotlightTrophies = trophies
    .filter(trophy => trophy?.is_spoiler || /perd|miss|colet|online|grind|dific/i.test(`${trophy?.name || ''} ${trophy?.description || ''} ${trophy?.tip || ''}`))
    .slice(0, 3)
    .map(trophy => ({
      name: trophy?.name || 'Troféu',
      label: trophy?.is_spoiler ? 'Spoiler / atenção' : (trophy?.type || 'Troféu'),
      text: trophy?.tip || trophy?.description || 'Revise este troféu antes de começar.'
    }));

  return {
    trophies,
    roadmap,
    completedIds,
    total,
    completed,
    pending,
    progress,
    spoilerCount,
    missables,
    breakdown,
    breakdownText,
    difficultyLabel: getDifficultyProfileLabel(game?.difficulty),
    quickNotes,
    prepChecklist,
    spotlightTrophies,
    decisionModel: buildGuideDecisionModel(game, trophies, roadmap),
    image: game?.image || '/og-default.svg',
    editorial: buildEditorialSignals(game, { trophies, roadmap, total, missables }),
    isSaved: Boolean(options?.isSaved),
    libraryEntry: options?.libraryEntry || null
  };
}

function renderGuideHeaderHtml(game, viewModel, options = {}) {
  return `
    <section class="atlas-panel p-5 md:p-6 bg-white/[0.03] border border-white/10">
      <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
        <div class="flex gap-4 items-start min-w-0">
          <div class="atlas-guide-cover shrink-0">
            <img src="${escapeHtml(viewModel.image)}" alt="${escapeHtml(game?.name || 'Jogo')}" class="w-full h-full object-cover" loading="eager" decoding="sync" fetchpriority="high" width="900" height="520" sizes="(min-width: 1280px) 240px, 160px">
          </div>
          <div class="min-w-0">
            <div class="atlas-eyebrow">Guia do jogo</div>
            <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight mt-2 break-words">${escapeHtml(game?.name || 'Guia')}</h1>
            <p class="text-white/58 mt-3 max-w-3xl">Dificuldade ${escapeHtml(String(game?.difficulty || '-'))}/10 • ${escapeHtml(game?.time || 'Tempo não informado')} • ${viewModel.total} troféu(s)</p>
            <div class="flex flex-wrap gap-2 mt-4">
              <span class="atlas-tag">Perfil ${escapeHtml(viewModel.difficultyLabel)}</span>
              <span class="atlas-tag">${escapeHtml(game?.time || 'Tempo não informado')}</span>
              <span class="atlas-tag ${getDecisionToneClass(viewModel.decisionModel.fitLabel)}">${escapeHtml(viewModel.decisionModel.fitLabel)}</span>
              <span class="atlas-tag ${getDecisionToneClass(viewModel.decisionModel.riskLabel)}">${escapeHtml(viewModel.decisionModel.riskLabel)}</span>
              <span class="atlas-tag">${escapeHtml(viewModel.breakdownText)}</span>
            </div>
            <section class="atlas-decision-panel mt-5">
              <div class="atlas-decision-panel__header">
                <div>
                  <div class="atlas-eyebrow">Decisão rápida</div>
                  <h2 class="text-2xl md:text-3xl font-extrabold mt-2">${escapeHtml(viewModel.decisionModel.verdict)}</h2>
                </div>
                <span class="atlas-tag ${getDecisionToneClass(viewModel.decisionModel.paceLabel)}">${escapeHtml(viewModel.decisionModel.paceLabel)}</span>
              </div>
              <p class="text-white/74 mt-3 max-w-3xl">${escapeHtml(viewModel.decisionModel.verdictDetail)}</p>
              <div class="atlas-decision-grid mt-4">
                <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Esforço</div><strong class="block mt-2 text-white">${escapeHtml(viewModel.decisionModel.fitLabel)}</strong><p class="text-sm text-white/72 mt-2">${escapeHtml(viewModel.decisionModel.fitDetail)}</p></article>
                <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Risco</div><strong class="block mt-2 text-white">${escapeHtml(viewModel.decisionModel.riskLabel)}</strong><p class="text-sm text-white/72 mt-2">${escapeHtml(viewModel.decisionModel.riskDetail)}</p></article>
                <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Quando vale abrir</div><strong class="block mt-2 text-white">${escapeHtml(viewModel.decisionModel.paceLabel)}</strong><p class="text-sm text-white/72 mt-2">${escapeHtml(viewModel.decisionModel.paceDetail)}</p></article>
              </div>
            </section>
            <div class="grid sm:grid-cols-3 gap-3 mt-4 max-w-4xl">
              <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Revisão editorial</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.reviewedAt)} • ${escapeHtml(viewModel.editorial.reviewer)}</p></article>
              <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Cobertura do guia</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.coverageLabel)} • ${escapeHtml(viewModel.editorial.scopeSummary)}</p></article>
              <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Entrada recomendada</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.readinessLabel)} • ${escapeHtml(viewModel.editorial.readinessDetail)}</p></article>
            </div>
            <div class="atlas-decision-panel mt-4">
              <div class="atlas-decision-panel__header">
                <div>
                  <div class="atlas-eyebrow">Escopo editorial</div>
                  <h2 class="text-xl md:text-2xl font-extrabold mt-2">O que este guia já cobre antes do clique completo</h2>
                </div>
                <span class="atlas-tag atlas-tag--soft">${escapeHtml(viewModel.editorial.coverageLabel)}</span>
              </div>
              <p class="text-white/74 mt-3 max-w-3xl">${escapeHtml(viewModel.editorial.coverageDetail)}</p>
              <div class="grid lg:grid-cols-3 gap-3 mt-4">
                <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Assinatura editorial</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.reviewer)} revisou este material em ${escapeHtml(viewModel.editorial.reviewedAt)}.</p></article>
                <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Escopo coberto</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.scopeSummary)}</p></article>
                <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Como ler esta página</div><p class="text-sm text-white/78 mt-2">${escapeHtml(viewModel.editorial.methodSummary)}</p></article>
              </div>
            </div>
            <p class="text-white/50 mt-4 max-w-3xl">${escapeHtml(game?.missable || 'Sem alerta editorial de perdíveis informado.')}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-3 xl:justify-end">
          ${options.showSaveButton ? `<button type="button" class="atlas-btn ${options.isSaved ? 'atlas-btn-secondary' : 'atlas-btn-primary'}" data-toggle-save-game="true">${options.isSaved ? 'Remover da biblioteca' : 'Salvar na biblioteca'}</button>` : ''}
          <button type="button" class="atlas-btn atlas-btn-secondary" data-copy-game-link="${escapeHtml(game?.slug || '')}">Copiar link</button>
        </div>
      </div>
      <div class="grid lg:grid-cols-3 gap-3 mt-5">
        ${viewModel.quickNotes.map((note, index) => `<article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Leitura ${index + 1}</div><p class="text-sm text-white/78 mt-2">${escapeHtml(note)}</p></article>`).join('')}
      </div>
    </section>`;
}

function renderGuideSidebarHtml(game, viewModel) {
  return `
    <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
      <div class="atlas-eyebrow">Resumo</div>
      <div class="atlas-guide-summary-grid">
        <article class="glass-morphism atlas-stat-mini p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Progresso</div><div class="text-3xl font-extrabold mt-2">${viewModel.progress}%</div></article>
        <article class="glass-morphism atlas-stat-mini p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Concluídos</div><div class="text-3xl font-extrabold mt-2">${viewModel.completed}/${viewModel.total}</div></article>
        <article class="glass-morphism atlas-stat-mini p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Pendentes</div><div class="text-3xl font-extrabold mt-2">${viewModel.pending}</div></article>
        <article class="glass-morphism atlas-stat-mini p-4 rounded-[18px]"><div class="text-xs uppercase tracking-wide text-white/45">Spoilers</div><div class="text-3xl font-extrabold mt-2">${viewModel.spoilerCount}</div></article>
      </div>
    </section>
    <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
      <div class="atlas-eyebrow">Leitura de decisão</div>
      <article class="glass-morphism rounded-[18px] p-4 border border-white/10 atlas-next-action-box">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Vale meu tempo?</div>
            <strong class="block text-white mt-2">${escapeHtml(viewModel.decisionModel.verdict)}</strong>
          </div>
          <span class="atlas-tag ${getDecisionToneClass(viewModel.decisionModel.fitLabel)}">${escapeHtml(viewModel.decisionModel.fitLabel)}</span>
        </div>
        <p class="text-sm text-white/72 mt-3">${escapeHtml(viewModel.decisionModel.verdictDetail)}</p>
        <div class="flex flex-wrap gap-2 mt-4">${viewModel.decisionModel.chips.map(chip => `<span class="atlas-tag atlas-tag--soft">${escapeHtml(chip)}</span>`).join('')}</div>
      </article>
    </section>
    <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
      <div class="atlas-eyebrow">Confiança editorial</div>
      <div class="space-y-3 text-sm text-white/72">
        <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Revisado por</div><p class="mt-2">${escapeHtml(viewModel.editorial.reviewer)} em ${escapeHtml(viewModel.editorial.reviewedAt)}.</p></article>
        <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Cobertura</div><p class="mt-2">${escapeHtml(viewModel.editorial.coverageLabel)}. ${escapeHtml(viewModel.editorial.coverageDetail)}</p></article>
        <article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Leitura recomendada</div><p class="mt-2">${escapeHtml(viewModel.editorial.readinessLabel)}. ${escapeHtml(viewModel.editorial.readinessDetail)}</p></article>
      </div>
    </section>
    <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
      <div class="atlas-eyebrow">Escopo e método</div>
      <ul class="space-y-3 text-sm text-white/72">
        ${viewModel.editorial.scopeItems.map(item => `<li class="flex items-start gap-3"><span class="atlas-tag mt-0.5">•</span><span>${escapeHtml(item)}</span></li>`).join('')}
      </ul>
      <div class="space-y-3">
        ${viewModel.editorial.methodItems.map((item, index) => `<article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">Método ${index + 1}</div><p class="mt-2 text-sm text-white/72">${escapeHtml(item)}</p></article>`).join('')}
      </div>
    </section>
    <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
      <div class="atlas-eyebrow">Antes de começar</div>
      <ul class="space-y-3 text-sm text-white/72">
        ${viewModel.prepChecklist.map(item => `<li class="flex items-start gap-3"><span class="atlas-tag mt-0.5">•</span><span>${escapeHtml(item)}</span></li>`).join('')}
      </ul>
    </section>
    <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
      <div class="atlas-eyebrow">Roadmap</div>
      ${viewModel.roadmap.length ? `<ol class="space-y-3 text-white/72">${viewModel.roadmap.map((step, index) => `<li class="flex items-start gap-3"><span class="atlas-tag mt-0.5">${index + 1}</span><span>${escapeHtml(typeof step === 'string' ? step : (step?.title || step?.description || 'Etapa'))}</span></li>`).join('')}</ol>` : '<div class="text-white/45">Sem roadmap cadastrado.</div>'}
    </section>
    <section class="atlas-panel p-5 rounded-[24px] bg-white/[0.03] border border-white/10 space-y-4">
      <div class="atlas-eyebrow">Destaques da lista</div>
      ${viewModel.spotlightTrophies.length ? `<div class="space-y-3">${viewModel.spotlightTrophies.map(item => `<article class="glass-morphism rounded-[18px] p-4 border border-white/10"><div class="text-[11px] uppercase tracking-[0.18em] text-white/40">${escapeHtml(item.label)}</div><h3 class="text-sm font-semibold text-white mt-2">${escapeHtml(item.name)}</h3><p class="text-sm text-white/68 mt-2">${escapeHtml(item.text)}</p></article>`).join('')}</div>` : '<div class="text-white/45">Nenhum troféu de atenção especial detectado automaticamente.</div>'}
    </section>`;
}

function buildSsrGuideMarkup(game) {
  const viewModel = buildGuideViewModel(game, []);
  const header = renderGuideHeaderHtml(game, viewModel);
  const sidebar = renderGuideSidebarHtml(game, viewModel);
  const trophyList = viewModel.trophies.length
    ? viewModel.trophies.map(trophy => renderTrophyCardHtml(trophy, viewModel.completedIds)).join('')
    : '<div class="text-white/60">Nenhum troféu cadastrado.</div>';

  return { header, sidebar, trophyList };
}

function applyTemplateDefaults(template) {
  return template
    .replace(/__HOME_VIEW_CLASS__/g, '')
    .replace(/__CATALOG_VIEW_CLASS__/g, 'hidden')
    .replace(/__GUIDE_VIEW_CLASS__/g, 'hidden')
    .replace(/__GUIDE_CONTENT_CLASS__/g, 'hidden')
    .replace(/__HAS_SSR_GAME__/g, 'false')
    .replace(/__SSR_GUIDE_HEADER__/g, '')
    .replace(/__SSR_GUIDE_SIDEBAR__/g, '')
    .replace(/__SSR_TROPHY_LIST__/g, '')
    .replace(/__CATALOG_TITLE__/g, 'Todos os jogos')
    .replace(/__CATALOG_SUMMARY__/g, '')
    .replace(/__CATALOG_HERO_TITLE__/g, 'Navegue sem depender da busca')
    .replace(/__CATALOG_HERO_DESCRIPTION__/g, 'Veja todos os jogos em uma lista filtrável com dificuldade, tempo estimado, troféus e acesso direto à página de guia.')
    .replace(/__CATALOG_COLLECTION_TITLE__/g, 'Coleção aberta')
    .replace(/__CATALOG_COLLECTION_DESCRIPTION__/g, 'Escolha uma faixa para entender melhor em que tipo de projeto você está entrando e clicar com mais segurança.')
    .replace(/__CATALOG_COLLECTION_REASON__/g, 'Use esta visão para comparar esforço, tempo e densidade do guia antes de escolher um jogo.')
    .replace(/__CATALOG_COLLECTION_CHECKLIST__/g, 'Abra a página do jogo para confirmar perdíveis, roadmap e se a lista combina com o seu momento.')
    .replace(/__CATALOG_SEO_INTRO_TITLE__/g, 'Pontos de entrada para escolher melhor')
    .replace(/__CATALOG_SEO_INTRO_BODY__/g, 'Esta coleção ajuda a comparar jogos de forma mais útil antes do clique, com contexto editorial e links internos claros.')
    .replace(/__CATALOG_RELATED_LINKS__/g, '')
    .replace(/__CATALOG_SSR_LIST__/g, '')
    .replace(/__INITIAL_STATE_SCRIPT__/g, '<script>window.__INITIAL_STATE__ = null;</script>');
}

function buildGamePageHtml(game, req) {
  const origin = `${req.protocol}://${req.get('host')}`;
  const canonicalUrl = `${origin}/jogo/${game.slug}`;
  const title = `${game.name} | Troféus, roadmap e guia | AtlasAchievement`;
  const description = `${game.name}: dificuldade ${game.difficulty}/10, tempo ${game.time}, ${game.trophies.length} troféus e guia com roadmap e alertas de perdíveis.`;
  const image = resolveMetaImage(origin, game.image);
  const structuredData = safeJsonForHtml({
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.name,
    image,
    description,
    genre: 'Achievement tracking',
    url: canonicalUrl
  });
  const ssrMarkup = buildSsrGuideMarkup(game);

  return applyTemplateDefaults(publicIndexTemplate)
    .replace(/__PAGE_TITLE__/g, escapeHtml(title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(description))
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, escapeHtml(image))
    .replace(/__PAGE_JSON_LD__/g, structuredData)
    .replace(/__HOME_VIEW_CLASS__/g, 'hidden')
    .replace(/__GUIDE_VIEW_CLASS__/g, '')
    .replace(/__GUIDE_CONTENT_CLASS__/g, '')
    .replace(/__HAS_SSR_GAME__/g, 'true')
    .replace(/__SSR_GUIDE_HEADER__/g, ssrMarkup.header)
    .replace(/__SSR_GUIDE_SIDEBAR__/g, ssrMarkup.sidebar)
    .replace(/__SSR_TROPHY_LIST__/g, ssrMarkup.trophyList)
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({ page: 'guide', game }));
}

function buildDefaultPageHtml(req) {
  const origin = `${req.protocol}://${req.get('host')}`;
  return applyTemplateDefaults(publicIndexTemplate)
    .replace(/__PAGE_TITLE__/g, 'AtlasAchievement - Troféus, conquistas e guias de jogos')
    .replace(/__PAGE_DESCRIPTION__/g, 'Busque jogos, abra guias, veja troféus, roadmap, perdíveis e acompanhe seu progresso.')
    .replace(/__PAGE_CANONICAL__/g, `${origin}/`)
    .replace(/__PAGE_OG_IMAGE__/g, `${origin}/og-default.svg`)
.replace(/__PAGE_JSON_LD__/g, safeJsonForHtml({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'AtlasAchievement',
      url: `${origin}/`,
      description: 'Busque jogos, abra guias, veja troféus, roadmap, perdíveis e acompanhe seu progresso.'
    }));
}

function renderCatalogSeoCards(items = []) {
  if (!items.length) {
    return `
      <article class="atlas-panel atlas-panel-soft p-5 md:p-6 border border-white/10">
        <h3 class="text-xl font-extrabold tracking-tight">Nenhum jogo nesta faixa ainda</h3>
        <p class="text-white/65 mt-3">Quando novos guias forem adicionados, esta coleção vai mostrar cards com dificuldade, tempo estimado, troféus e acesso direto para a página do jogo.</p>
      </article>`;
  }

  return items.map(game => {
    const name = escapeHtml(game.name || 'Jogo');
    const slug = escapeHtml(game.slug || '');
    const difficulty = escapeHtml(String(game.difficulty ?? '—'));
    const time = escapeHtml(game.time || 'Tempo não informado');
    const trophyCount = Number(game.trophy_count || 0);
    const roadmapCount = Number(game.roadmap_count || 0);
    const missableText = game.missable ? escapeHtml(game.missable) : 'Abra o guia para validar perdíveis, roadmap e pontos de atenção.';
    return `
      <article class="atlas-panel atlas-panel-soft p-5 md:p-6 space-y-4 border border-white/10" itemscope itemtype="https://schema.org/VideoGame">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="atlas-eyebrow">Guia do catálogo</div>
            <h3 class="text-2xl font-extrabold tracking-tight mt-2" itemprop="name">${name}</h3>
          </div>
          <span class="atlas-tag">${difficulty}/10</span>
        </div>
        <p class="text-white/65" itemprop="description">${missableText}</p>
        <div class="flex flex-wrap gap-2 text-sm text-white/72">
          <span class="atlas-chip">Tempo: ${time}</span>
          <span class="atlas-chip">Troféus: ${trophyCount}</span>
          <span class="atlas-chip">Roadmap: ${roadmapCount}</span>
        </div>
        <a href="/jogo/${slug}" class="atlas-btn atlas-btn-secondary inline-flex" itemprop="url">Abrir página do jogo</a>
      </article>`;
  }).join('');
}

function renderCatalogRelatedLinks(facetConfig) {
  const related = Array.isArray(facetConfig?.related) ? facetConfig.related : [];
  if (!related.length) return '';
  return related
    .map(slug => catalogFacetPageMap[slug])
    .filter(Boolean)
    .map(item => `<a href="${escapeHtml(item.path)}" class="atlas-chip">${escapeHtml(item.name)}</a>`)
    .join('');
}

function buildCatalogStructuredData(origin, canonicalUrl, facetConfig, items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: facetConfig?.name || 'Catálogo de jogos',
    url: canonicalUrl,
    description: facetConfig?.description || 'Coleção de jogos com guias, troféus, tempo estimado e filtros por intenção.',
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: items.length,
      itemListElement: items.map((game, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${origin}/jogo/${game.slug || ''}`,
        name: game.name || 'Jogo'
      }))
    }
  };
}

async function buildCatalogPageHtml(req, facetSlug = null) {
  const origin = `${req.protocol}://${req.get('host')}`;
  const facetConfig = facetSlug ? catalogFacetPageMap[facetSlug] : catalogFacetPageMap.all;
  const canonicalPath = facetConfig?.path || '/catalogo';
  const canonicalUrl = `${origin}${canonicalPath}`;
  const title = facetConfig?.title || 'Catálogo de jogos | Troféus e guias | AtlasAchievement';
  const description = facetConfig?.description || 'Navegue pelo catálogo de jogos com troféus, dificuldade, tempo estimado e acesso direto às páginas de guia.';
  const catalogResponse = await gamesService.listGames({ facet: facetConfig?.serviceFacet || 'all', sort: 'recommended-desc', page: 1, limit: 24 });
  const items = Array.isArray(catalogResponse?.items) ? catalogResponse.items : [];
  const total = Number(catalogResponse?.pagination?.total || items.length || 0);
  const structuredData = buildCatalogStructuredData(origin, canonicalUrl, facetConfig, items);

  return applyTemplateDefaults(publicIndexTemplate)
    .replace(/__PAGE_TITLE__/g, escapeHtml(title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(description))
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, `${origin}/og-default.svg`)
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml(structuredData))
    .replace(/__HOME_VIEW_CLASS__/g, 'hidden')
    .replace(/__CATALOG_VIEW_CLASS__/g, '')
    .replace(/__CATALOG_TITLE__/g, escapeHtml(facetConfig?.name || 'Catálogo de jogos'))
    .replace(/__CATALOG_SUMMARY__/g, escapeHtml(`${total} jogo(s) encontrados nesta visão editorial do catálogo.`))
    .replace(/__CATALOG_HERO_TITLE__/g, escapeHtml(facetConfig?.heroTitle || 'Navegue sem depender da busca'))
    .replace(/__CATALOG_HERO_DESCRIPTION__/g, escapeHtml(facetConfig?.heroDescription || 'Veja todos os jogos em uma lista filtrável com dificuldade, tempo estimado, troféus e acesso direto à página de guia.'))
    .replace(/__CATALOG_COLLECTION_TITLE__/g, escapeHtml(facetConfig?.collectionTitle || 'Coleção aberta'))
    .replace(/__CATALOG_COLLECTION_DESCRIPTION__/g, escapeHtml(facetConfig?.collectionDescription || 'Escolha uma faixa para entender melhor em que tipo de projeto você está entrando e clicar com mais segurança.'))
    .replace(/__CATALOG_COLLECTION_REASON__/g, escapeHtml(facetConfig?.reason || 'Use esta visão para comparar esforço, tempo e densidade do guia antes de escolher um jogo.'))
    .replace(/__CATALOG_COLLECTION_CHECKLIST__/g, escapeHtml(facetConfig?.checklist || 'Abra a página do jogo para confirmar perdíveis, roadmap e se a lista combina com o seu momento.'))
    .replace(/__CATALOG_SEO_INTRO_TITLE__/g, escapeHtml(facetConfig?.introTitle || 'Pontos de entrada para escolher melhor'))
    .replace(/__CATALOG_SEO_INTRO_BODY__/g, escapeHtml(facetConfig?.introBody || 'Esta coleção ajuda a comparar jogos de forma mais útil antes do clique, com contexto editorial e links internos claros.'))
    .replace(/__CATALOG_RELATED_LINKS__/g, renderCatalogRelatedLinks(facetConfig))
    .replace(/__CATALOG_SSR_LIST__/g, renderCatalogSeoCards(items))
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({ page: 'catalog', facet: facetConfig?.serviceFacet || 'all', catalog: catalogResponse }));
}

fs.mkdirSync(env.uploadDir, { recursive: true });

if (env.isProduction) {
  app.set('trust proxy', 1);
}

const allowedOrigins = new Set(env.corsAllowedOrigins);
if (env.appUrl) {
  allowedOrigins.add(env.appUrl);
}

app.use(requestContext);
app.use(securityHeaders);
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (!origin) return next();

  if (allowedOrigins.size === 0) {
    return next();
  }

  if (allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  }

  if (req.method === 'OPTIONS') return res.sendStatus(403);
  return next();
});
app.use(express.json({ limit: '1mb' }));
const sessionMaxAgeMs = 1000 * 60 * 60 * env.sessionMaxAgeHours;
const sessionStore = new SqliteSessionStore({
  ttlMs: sessionMaxAgeMs,
  cleanupIntervalMs: 1000 * 60 * env.sessionCleanupIntervalMinutes
});

app.use(session({
  name: 'mtg.sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    maxAge: sessionMaxAgeMs
  }
}));

app.use(issueCsrfToken);
app.use('/uploads', express.static(env.uploadDir, {
  fallthrough: false,
  etag: true,
  maxAge: env.isProduction ? '30d' : 0,
  setHeaders: res => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (env.isProduction) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  }
}));
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: env.nodeEnv,
    sessionStore: 'sqlite',
    sessionMaxAgeHours: env.sessionMaxAgeHours
  });
});

app.get('/robots.txt', (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const response = await gamesService.listGames({ page: 1, limit: 100, sort: 'updated-desc' });
    const facetUrls = Object.entries(catalogFacetPageMap)
      .filter(([facetSlug]) => facetSlug !== 'all')
      .map(([, facet]) => ({
        loc: `${origin}${facet.path}`,
        lastmod: new Date().toISOString()
      }));

    const urls = [
      { loc: `${origin}/`, lastmod: new Date().toISOString() },
      { loc: `${origin}/catalogo`, lastmod: new Date().toISOString() },
      ...facetUrls,
      ...response.items.map(game => ({
        loc: `${origin}/jogo/${game.slug}`,
        lastmod: game.updated_at || game.created_at || new Date().toISOString()
      }))
    ];

    res.type('application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(item => `  <url><loc>${escapeXml(item.loc)}</loc><lastmod>${escapeXml(new Date(item.lastmod).toISOString())}</lastmod></url>`).join('\n')}\n</urlset>`);
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth/login', loginRateLimit);
app.use('/api/auth', authRoutes);
app.use('/api/uploads', requireCsrf, uploadsRoutes);
app.use('/api/games', requireCsrf, gamesRoutes);

app.get('/admin', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/catalogo', async (req, res, next) => {
  try {
    res.send(await buildCatalogPageHtml(req));
  } catch (error) {
    next(error);
  }
});

app.get('/catalogo/:facetSlug', (req, res, next) => {
  const { facetSlug } = req.params;
  if (!catalogFacetPageMap[facetSlug]) {
    return next();
  }
  return res.send(buildCatalogPageHtml(req, facetSlug));
});

app.get('/jogo/:slug', async (req, res, next) => {
  try {
    const game = await gamesService.getGameBySlug(req.params.slug);

    if (game.redirect_required && game.canonical_slug && game.canonical_slug !== req.params.slug) {
      return res.redirect(301, `/jogo/${game.canonical_slug}`);
    }

    res.send(buildGamePageHtml(game, req));
  } catch (error) {
    next(error);
  }
});

app.get('/', (req, res) => {
  res.send(buildDefaultPageHtml(req));
});

app.get('*', (req, res, next) => {
  next(new AppError('A página que você tentou abrir não existe ou foi movida.', 404, null, 'PAGE_NOT_FOUND'));
});

app.use((error, req, res, next) => {
  if (req.path === '/api/auth/login' && error?.statusCode === 401) {
    registerFailedLoginAttempt(req);
  }

  next(error);
});

app.use(errorHandler);

module.exports = app;
