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
const meRoutes = require('./routes/me.routes');
const gamesRoutes = require('./routes/games.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const errorHandler = require('./middleware/errorHandler');
const gamesService = require('./services/games.service');
const sharedEditorialModel = require('./shared/editorialModel');
const sharedGuideViewModel = require('./shared/guideViewModel');
const sharedCardModel = require('./shared/cardModel');
const sharedCatalogModel = require('./shared/catalogModel');
const { loginRateLimit, registerRateLimit, registerFailedLoginAttempt } = require('./middleware/loginRateLimit');
const SqliteSessionStore = require('./services/sqliteSessionStore');
const AppError = require('./utils/AppError');

const app = express();
app.set('trust proxy', 1);

const publicIndexPath = path.join(__dirname, '../public/index.html');
const publicIndexTemplate = fs.readFileSync(publicIndexPath, 'utf8');
const catalogFacetPageMap = sharedCatalogModel.catalogFacetPageMap;
const PUBLIC_CATALOG_PAGE_SIZE = 24;

const editorialCollectionPageMap = {
  'primeira-platina': {
    path: '/colecoes/primeira-platina',
    title: 'Melhores jogos para primeira platina | AtlasAchievement',
    description: 'Veja uma seleção editorial de jogos mais acessíveis para começar sua primeira platina com menos atrito.',
    name: 'Primeira platina',
    heroTitle: 'Jogos para começar bem a primeira platina',
    heroDescription: 'Esta coleção prioriza jogos mais acessíveis, com risco mais baixo e boa relação entre tempo, dificuldade e clareza do guia.',
    collectionTitle: 'Seleção editorial para primeira platina',
    collectionDescription: 'A ideia aqui não é só mostrar jogos fáceis, mas destacar boas portas de entrada para criar consistência, entender o fluxo do site e terminar a primeira lista sem desgaste desnecessário.',
    reason: 'Boa para quem quer começar com mais confiança e sem cair em jogos que parecem simples, mas escondem retrabalho cedo.',
    checklist: 'Prefira abrir primeiro jogos curtos, de dificuldade baixa e com menos alertas de perdível ou necessidade de múltiplas runs.',
    introTitle: 'Como escolher sua primeira platina',
    introBody: 'Uma primeira platina boa precisa reduzir atrito, não só dificuldade. Por isso esta página cruza tempo, risco e clareza do roadmap antes de recomendar um clique.',
    faq: [
      { question: 'O que faz um jogo ser bom para primeira platina?', answer: 'Tempo controlado, dificuldade acessível, poucos pontos de retrabalho e um guia claro logo na primeira leitura.' },
      { question: 'Preciso escolher o jogo mais curto?', answer: 'Não necessariamente. O ideal é equilíbrio entre duração viável e baixo risco, não só o menor número de horas.' },
      { question: 'Vale começar por uma lista média?', answer: 'Só se o roadmap estiver claro e a execução parecer estável para o seu momento atual.' }
    ]
  },
  'platinas-rapidas': {
    path: '/colecoes/platinas-rapidas',
    title: 'Platinas rápidas para concluir em pouco tempo | AtlasAchievement',
    description: 'Seleção editorial de jogos curtos para quem quer uma platina rápida sem abrir uma maratona longa.',
    name: 'Platinas rápidas',
    heroTitle: 'Platinas rápidas para encaixar sem virar maratona',
    heroDescription: 'Use esta coleção quando quiser retorno rápido, projetos de fim de semana ou um descanso entre listas mais pesadas.',
    collectionTitle: 'Jogos curtos com boa chance de fechamento rápido',
    collectionDescription: 'Aqui entram jogos que tendem a caber melhor em uma janela curta, desde que o risco de perdível e a clareza do guia acompanhem a promessa de rapidez.',
    reason: 'Ajuda a evitar clicar em projetos que parecem curtos no papel, mas pedem cleanup torto, grind ou revisão tardia demais.',
    checklist: 'Antes de começar, confirme se o jogo curto também é realmente controlável em execução, e não só em tempo bruto.',
    introTitle: 'Quando uma platina rápida vale a pena',
    introBody: 'Jogos curtos respondem muito bem a buscas de alta intenção, mas só convertem de verdade quando a página deixa claro o risco escondido por trás da promessa de rapidez.',
    faq: [
      { question: 'Platina rápida significa platina fácil?', answer: 'Não sempre. Alguns jogos são curtos, mas podem ter execução exigente, troféus sensíveis ou cleanup desconfortável.' },
      { question: 'Quanto tempo conta como platina rápida?', answer: 'Nesta coleção, priorizamos jogos que parecem viáveis em até cerca de 15 horas.' },
      { question: 'Vale usar como intervalo entre jogos longos?', answer: 'Sim. Essa é uma das melhores funções desta coleção: manter ritmo sem abrir outro compromisso pesado.' }
    ]
  },
  'baixo-risco-de-perdiveis': {
    path: '/colecoes/baixo-risco-de-perdiveis',
    title: 'Jogos com baixo risco de perdíveis | AtlasAchievement',
    description: 'Encontre jogos em que o risco de perder troféus parece menor, ótimos para runs mais tranquilas.',
    name: 'Baixo risco de perdíveis',
    heroTitle: 'Coleção para quem quer uma run mais tranquila',
    heroDescription: 'Esta seleção prioriza jogos que, pelo cadastro atual, não mostram alertas fortes de troféus perdíveis logo no começo.',
    collectionTitle: 'Jogos mais tranquilos para jogar sem medo de travar a lista cedo',
    collectionDescription: 'Boa para quem quer aproveitar melhor a campanha sem a sensação de que uma escolha errada logo nas primeiras horas já estraga o 100%.',
    reason: 'Reduz a ansiedade de abrir um projeto novo quando você quer mais liberdade e menos leitura defensiva antes de cada passo.',
    checklist: 'Mesmo sem perdíveis fortes, vale revisar roadmap, troféus únicos e sinais de cleanup para não confundir liberdade com improviso total.',
    introTitle: 'O que significa baixo risco de perdível',
    introBody: 'Baixo risco não é ausência absoluta de atenção. A proposta desta coleção é destacar jogos em que o risco principal parece ser organização, e não bloqueio estrutural da run.',
    faq: [
      { question: 'Sem perdível quer dizer zero risco?', answer: 'Não. Ainda pode existir cleanup ruim, troféu técnico ou etapa que mereça atenção, mesmo sem perdível clássico.' },
      { question: 'Esses jogos são melhores para jogar sem guia?', answer: 'Em geral, eles toleram melhor uma leitura parcial no começo, mas continuar usando o guia ainda reduz retrabalho.' },
      { question: 'Posso usar esta coleção como filtro principal?', answer: 'Sim, principalmente se você valoriza runs mais soltas e quer evitar pressão logo nas primeiras horas.' }
    ]
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
  return JSON.stringify(value)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/</g, '\u003c')
    .replace(/>/g, '\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function normalizeOrigin(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.origin.replace(/\/+$/, '');
  } catch (error) {
    return raw.replace(/\/+$/, '');
  }
}

function getPublicOrigin(req) {
  const configuredOrigin = normalizeOrigin(env.appUrl);
  if (configuredOrigin) return configuredOrigin;
  return normalizeOrigin(`${req.protocol}://${req.get('host')}`);
}

function buildPublicUrl(req, pathname = '/') {
  const pathPart = String(pathname || '/').startsWith('/') ? String(pathname || '/') : `/${pathname}`;
  return `${getPublicOrigin(req)}${pathPart}`;
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

function buildGameSeoTitle(game = {}) {
  const name = String(game?.name || 'Jogo').trim() || 'Jogo';
  return `${name}: guia de trof\u00e9us, roadmap e tempo para platinar | AtlasAchievement`;
}

function buildGameSeoDescription(game = {}) {
  const name = String(game?.name || 'este jogo').trim() || 'este jogo';
  return `Veja dificuldade, tempo estimado, runs, trof\u00e9us perd\u00edveis, roadmap e checklist para platinar ${name} com menos retrabalho.`;
}

function buildGameGuideH1(game = {}) {
  const name = String(game?.name || 'Guia').trim() || 'Guia';
  return name;
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
  return Boolean(trophy?.is_spoiler || String(tip || '').trim() || hasLongTrophyDescription(description));
}

function getTrophyEditorialName(trophy = {}) {
  const officialName = String(trophy?.name || '').trim();
  const editorialName = String(trophy?.name_pt || '').trim();
  if (!editorialName || editorialName.toLowerCase() === officialName.toLowerCase()) return '';
  return editorialName;
}

function renderTrophyCardHtml(trophy, completedIds = new Set(), index = 0, game = {}) {
  const done = completedIds.has(trophy.id);
  const description = trophy.description || '';
  const tip = trophy.tip || '';
  const officialName = trophy.name || 'Troféu';
  const editorialName = getTrophyEditorialName(trophy);
  const riskTags = getGuideTrophyTags(trophy, game);
  const displayRiskTags = typeof sharedGuideViewModel.getGuideTrophyDisplayTags === 'function'
    ? sharedGuideViewModel.getGuideTrophyDisplayTags(trophy, game, 4)
    : riskTags.slice(0, 4);
  const riskTokens = riskTags.map(tag => tag.id).join(' ');
  const search = typeof sharedGuideViewModel.getGuideTrophySearchText === 'function'
    ? sharedGuideViewModel.getGuideTrophySearchText(trophy, riskTags)
    : `${trophy.name || ''} ${trophy.name_pt || ''} ${description} ${tip} ${trophy.type || ''} ${riskTags.map(tag => `${tag.id} ${tag.label}`).join(' ')}`.trim().toLowerCase();
  const spoilerClasses = trophy.is_spoiler ? 'spoiler-blur' : '';
  const detailsId = buildTrophyDetailsId(trophy, index);
  const spoilerText = trophy.is_spoiler ? '<span class="spoiler-hint">Conteúdo oculto até você revelar.</span>' : '';
  const hasDetailsToggle = shouldShowTrophyDetailsToggle(trophy, description, tip);
  const detailsToggleHtml = hasDetailsToggle
    ? `<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact atlas-trophy-details-toggle" data-trophy-details-toggle="true" aria-expanded="false" aria-controls="${escapeHtml(detailsId)}"><span data-details-label>Ver detalhes</span><i class="fas fa-chevron-down" aria-hidden="true"></i></button>`
    : '';
  const toggleLabel = done ? 'Desmarcar' : 'Concluir';
  const toggleAria = `${toggleLabel} ${officialName}`;

  return `
    <article class="trophy-card atlas-trophy-card atlas-panel atlas-panel--quiet ${done ? 'completed' : ''} ${hasDetailsToggle ? 'has-details-toggle' : ''}" data-trophy-id="${escapeHtml(trophy.id || '')}" data-type="${escapeHtml(trophy.type || 'Bronze')}" data-risks="${escapeHtml(riskTokens)}" data-status="${done ? 'completed' : 'pending'}" data-search="${escapeHtml(search)}">
      <div class="atlas-trophy-card__layout">
        <div class="atlas-trophy-card__main">
          <div class="atlas-trophy-card__headline">
            <div class="atlas-trophy-card__title">
              <h4>${escapeHtml(officialName)}</h4>
              ${editorialName ? `<p class="atlas-trophy-card__title-translation">${escapeHtml(editorialName)}</p>` : ''}
            </div>
            <div class="atlas-trophy-card__meta">
              <span class="atlas-trophy-type">${escapeHtml(trophy.type || 'Bronze')}</span>
              <span class="atlas-trophy-state ${done ? 'atlas-trophy-state--done' : ''}">${done ? 'Concluído' : 'Pendente'}</span>
            </div>
          </div>
          ${displayRiskTags.length ? `<div class="atlas-trophy-risk-list">${displayRiskTags.map(tag => `<span class="atlas-risk-chip atlas-risk-chip--${escapeHtml(tag.tone)}">${escapeHtml(tag.label)}</span>`).join('')}</div>` : ''}
          ${trophy.is_spoiler ? '<button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact atlas-spoiler-btn" data-spoiler-toggle="true" aria-expanded="false">Revelar spoiler</button>' : ''}
          <div id="${escapeHtml(detailsId)}" class="atlas-trophy-details" data-trophy-details>
            <p class="atlas-trophy-description ${spoilerClasses}" ${trophy.is_spoiler ? 'data-spoiler="true" aria-hidden="true"' : ''}>${spoilerText}${escapeHtml(description || 'Sem descrição.')}</p>
            ${tip ? `<div class="atlas-tip-box atlas-trophy-tip"><div class="atlas-tip-label">Dica</div><p class="text-sm mt-2 ${spoilerClasses}" ${trophy.is_spoiler ? 'data-spoiler="true" aria-hidden="true"' : ''}>${trophy.is_spoiler ? '<span class="spoiler-hint">Dica oculta até você revelar.</span>' : ''}${escapeHtml(tip)}</p></div>` : ''}
          </div>
          ${detailsToggleHtml}
        </div>
        <div class="atlas-trophy-card__actions">
          <button type="button" class="atlas-btn ${done ? 'atlas-btn-secondary' : 'atlas-btn-primary'} atlas-trophy-toggle" data-trophy-toggle="${escapeHtml(trophy.id || '')}" aria-pressed="${done ? 'true' : 'false'}" aria-label="${escapeHtml(toggleAria)}"><i class="fas ${done ? 'fa-rotate-left' : 'fa-check'}"></i><span>${escapeHtml(toggleLabel)}</span></button>
        </div>
      </div>
    </article>`;
}

function getDifficultyTone(difficulty) {
  return sharedEditorialModel.getDifficultyTone(difficulty);
}

function getDifficultyToneClass(difficulty) {
  return sharedEditorialModel.getDifficultyToneClass(difficulty);
}

function hasMissableRiskText(value = '') {
  return sharedEditorialModel.hasMissableRiskText(value);
}

function getTrophyRiskTags(trophy = {}) {
  return sharedEditorialModel.getTrophyRiskTags(trophy);
}

function getGuideTrophyTags(trophy = {}, game = {}) {
  return typeof sharedGuideViewModel.getGuideTrophyTags === 'function'
    ? sharedGuideViewModel.getGuideTrophyTags(trophy, game)
    : getTrophyRiskTags(trophy);
}

function buildThirtySecondVerdict(game = {}, viewModel = {}) {
  return sharedGuideViewModel.buildThirtySecondVerdict(game, viewModel);
}

function buildGuideNextActionModel(game = {}, viewModel = {}) {
  const completedIds = viewModel.completedIds instanceof Set ? Array.from(viewModel.completedIds) : [];
  return sharedGuideViewModel.deriveNextAction({ ...game, trophies: viewModel.trophies || [], roadmap: viewModel.roadmap || [] }, completedIds);
}

function formatDisplayDate(value) {
  return sharedGuideViewModel.formatDisplayDate(value);
}

function getEditorialBadge(game = {}) {
  return sharedEditorialModel.getEditorialBadge(game);
}

function getHomeTotal(game = {}) {
  return sharedCatalogModel.getGameTotal(game);
}

function getHomeRoadmapCount(game = {}) {
  return sharedCatalogModel.getRoadmapCount(game);
}

function formatHomeCatalogProof(gamesCount = 0, totalTrophies = 0, totalRoadmaps = 0) {
  return sharedCatalogModel.formatHomeCatalogProof(gamesCount, totalTrophies, totalRoadmaps);
}

function getHomeRecommendationScore(game = {}) {
  return sharedCatalogModel.getHomeRecommendationScore(game);
}

function getHomeFeaturedReason(game = {}) {
  return sharedCatalogModel.getHomeFeaturedReason(game);
}

function renderHomeImageHtml(model = {}, imageClass = 'atlas-card__image', options = {}) {
  const name = model.name || 'Jogo';
  const source = model.image || '';
  const width = options.width || 520;
  const height = options.height || 320;
  const sizes = options.sizes || '100vw';
  return `
    <span class="atlas-home-image-fallback" aria-hidden="true">${escapeHtml(name)}</span>
    ${source ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(name)}" class="${escapeHtml(imageClass)}" loading="${escapeHtml(options.loading || 'lazy')}" decoding="${escapeHtml(options.decoding || 'async')}" width="${escapeHtml(String(width))}" height="${escapeHtml(String(height))}" sizes="${escapeHtml(sizes)}" onerror="this.hidden=true;this.parentElement.classList.add('atlas-home-image-shell--fallback-visible');">` : ''}
  `;
}

function renderHomeIntentCardsHtml(games = []) {
  const items = sharedCatalogModel.buildHomeIntentCardsModel(games).filter(item => Number(item.count || 0) > 0);
  if (!items.length) {
    return '<div class="atlas-inline-empty atlas-intent-empty">As faixas aparecem aqui quando houver jogos suficientes no catálogo.</div>';
  }

  return items.map(item => `
    <button type="button" class="atlas-intent-card atlas-intent-card--${escapeHtml(item.tone)}" data-home-facet="${escapeHtml(item.facet)}">
      <div class="atlas-intent-card__head">
        <span class="atlas-intent-card__label">${escapeHtml(item.tag)}</span>
        <i class="fas ${escapeHtml(item.icon)}"></i>
      </div>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.description)}</p>
      <span class="atlas-intent-card__meta">${escapeHtml(item.metric)}</span>
    </button>`).join('');
}

function renderHomeFeaturedGameHtml(games = []) {
  const showcase = typeof sharedCatalogModel.selectHomeShowcaseGames === 'function'
    ? sharedCatalogModel.selectHomeShowcaseGames(games, 1)
    : [];
  const game = showcase[0] || [...games].sort((a, b) => getHomeRecommendationScore(b) - getHomeRecommendationScore(a))[0] || null;
  if (!game) return '';
  const model = sharedCardModel.buildStandardGameCardModel(game);
  const slug = escapeHtml(model.slug);
  const image = model.image;
  const time = model.time;
  const difficulty = model.difficulty;
  const total = model.trophies;
  const difficultyTone = model.difficultyTone;
  const difficultyClass = model.difficultyClass;
  const reason = getHomeFeaturedReason(game);

  return `
    <article class="atlas-card atlas-card--game atlas-card--featured atlas-featured-game" data-difficulty-tone="${escapeHtml(difficultyTone)}">
      <div class="atlas-card__media atlas-featured-game__cover atlas-home-image-shell${image ? '' : ' atlas-home-image-shell--fallback-visible'}">
        ${renderHomeImageHtml(model, 'atlas-card__image atlas-featured-game__image', { width: 600, height: 900, sizes: '(min-width: 1024px) 180px, 42vw' })}
      </div>
      <div class="atlas-card__body atlas-featured-game__body">
        <h3 class="atlas-card__title">${escapeHtml(model.name)}</h3>
        <p class="atlas-card__reason">${escapeHtml(reason)}</p>
        <div class="atlas-card__meta atlas-featured-game__meta" aria-label="Resumo da recomendação">
          <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(time)}</span>
          <span class="atlas-meta-signal ${escapeHtml(difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(String(difficulty))}/10</span>
          <span class="atlas-meta-signal atlas-meta-signal--trophy"><i class="fas fa-trophy"></i>${escapeHtml(String(total))} troféus</span>
        </div>
        <div class="atlas-card__actions">
          <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-featured-game__cta" data-home-game="${escapeHtml(model.name)}" data-open-guide-card="${slug}"><i class="fas fa-book-open"></i>Abrir guia</a>
        </div>
      </div>
    </article>`;
}

function renderHomeDiscoveryGuidesHtml(games = []) {
  const showcaseGames = typeof sharedCatalogModel.selectHomeShowcaseGames === 'function'
    ? sharedCatalogModel.selectHomeShowcaseGames(games, 6)
    : games.slice(0, 6);
  if (!showcaseGames.length) {
    return '<div class="atlas-inline-empty">Nenhum guia recente disponível.</div>';
  }

  return showcaseGames.map(game => {
    const model = sharedCardModel.buildStandardGameCardModel(game);
    const slug = escapeHtml(model.slug);
    return `
      <article class="atlas-card atlas-card--game atlas-card--standard atlas-discovery-card" data-difficulty-tone="${escapeHtml(model.difficultyTone)}" data-risk="${model.hasRisk ? 'missable' : 'none'}">
        <div class="atlas-card__media atlas-discovery-card__media atlas-home-image-shell${model.image ? '' : ' atlas-home-image-shell--fallback-visible'}">
          ${renderHomeImageHtml(model, 'atlas-card__image', { width: 600, height: 900, sizes: '(min-width: 1024px) 20vw, (min-width: 640px) 28vw, 42vw' })}
        </div>
        <div class="atlas-card__body">
          <div class="atlas-card__badges"><span class="atlas-card__status atlas-badge atlas-badge--partial">Novo guia</span></div>
          <h3 class="atlas-card__title">${escapeHtml(model.name)}</h3>
          <div class="atlas-card__meta">
            <span class="atlas-meta-signal ${escapeHtml(model.difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(String(model.difficulty))}/10</span>
            <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(model.time)}</span>
            <span class="atlas-meta-signal atlas-meta-signal--trophy"><i class="fas fa-trophy"></i>${escapeHtml(String(model.trophies))} troféus</span>
          </div>
          <div class="atlas-card__actions">
            <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-home-game="${escapeHtml(model.name)}" data-open-guide-card="${slug}">Abrir guia</a>
          </div>
        </div>
      </article>`;
  }).join('');
}

function getHomeRevisionNote(game = {}) {
  return sharedCatalogModel.getHomeRevisionNote(game);
}

function renderHomeEditorialHistoryHtml(games = []) {
  if (!games.length) {
    return '<div class="atlas-inline-empty">Nenhuma revisão recente disponível.</div>';
  }

  return games.slice(0, 5).map(game => {
    const updatedLabel = formatDisplayDate(game.updated_at || game.created_at);
    const slug = escapeHtml(game.slug || '');
    return `
      <article class="atlas-editorial-update">
        <time datetime="${escapeHtml(game.updated_at || game.created_at || '')}">${escapeHtml(updatedLabel)}</time>
        <div class="atlas-editorial-update__body">
          <h3>${escapeHtml(game.name)}</h3>
          <p>${escapeHtml(getHomeRevisionNote(game))}</p>
        </div>
        <a href="/jogo/${slug}" class="atlas-editorial-update__link" data-home-game="${escapeHtml(game.name)}" data-open-guide-card="${slug}" aria-label="Abrir guia de ${escapeHtml(game.name)}">
          <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
          <span>Abrir</span>
        </a>
      </article>`;
  }).join('');
}

async function listAllHomeGames() {
  const items = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await gamesService.listGames({ page, limit: 100, sort: 'updated-desc' });
    items.push(...(response.items || []));
    totalPages = Number(response.pagination?.totalPages || 1);
    page += 1;
  } while (page <= totalPages);

  return items;
}


function buildEditorialSignals(game, viewModel) {
  return sharedGuideViewModel.buildEditorialSignals(game, viewModel);
}


function buildContextualFaq(game = {}, viewModel = {}) {
  return sharedGuideViewModel.buildContextualFaq(game, viewModel);
}

function buildGuidePlayerFit(game = {}, viewModel = {}) {
  return sharedGuideViewModel.buildGuidePlayerFit(game, viewModel);
}

function buildGuideFaqStructuredData(canonicalUrl, viewModel) {
  const faqItems = Array.isArray(viewModel?.contextualFaq) ? viewModel.contextualFaq : [];
  if (!faqItems.length) return [];
  return [{
    '@type': 'FAQPage',
    url: canonicalUrl,
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  }];
}

function renderGuideEditorialNotesHtml(game = {}, viewModel = {}) {
  const routeTrophies = Array.isArray(viewModel.routeChangingTrophies) ? viewModel.routeChangingTrophies.slice(0, 4) : [];
  const faqItems = Array.isArray(viewModel.contextualFaq) ? viewModel.contextualFaq.slice(0, 3) : [];
  const playerFit = viewModel.playerFit || buildGuidePlayerFit(game, viewModel);
  const methodItems = Array.isArray(viewModel.editorial?.methodItems) ? viewModel.editorial.methodItems : [];
  const statusBadge = viewModel.editorial?.statusBadge || getEditorialBadge(game);
  return `
    <section id="guideEditorialNotesPanel" class="atlas-panel atlas-panel--editorial atlas-editorial-notes p-5 md:p-6">
      <div class="atlas-section-head atlas-section-head--compact">
        <div>
          <span class="atlas-section-kicker">Notas editoriais</span>
          <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Pontos críticos, confiança e FAQ</h2>
          <p class="text-white/58 mt-2 max-w-4xl">Depois de consultar o checklist, use este bloco para tirar dúvidas e revisar riscos sem repetir o roadmap.</p>
        </div>
        <span class="atlas-tag atlas-tag--soft">${escapeHtml(statusBadge.label || 'Notas de apoio')}</span>
      </div>
        <div class="atlas-editorial-notes__grid">
          <details class="atlas-editorial-note" open>
            <summary><span>Pontos críticos</span><small>${escapeHtml(String(routeTrophies.length || 0))}</small></summary>
            <div class="atlas-editorial-notes__column">
            ${routeTrophies.length ? routeTrophies.map(item => {
              const badge = Array.isArray(item.tags) && item.tags.length ? item.tags[0] : null;
              return `<article class="atlas-critical-row"><div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.text)}</p></div><span class="atlas-badge atlas-badge--${escapeHtml(badge?.tone || 'neutral')}">${escapeHtml(badge?.label || item.type)}</span></article>`;
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

function buildRelatedGamesServer(currentGame, pool = [], limit = 4) {
  return sharedCardModel.buildRelatedGames(currentGame, pool, limit);
}

function buildGuideComparisonModelServer(currentGame, relatedGames = []) {
  return sharedCardModel.buildGuideComparisonModel(currentGame, relatedGames);
}

function getRelatedGuideImageValue(value = '') {
  const image = String(value || '').trim();
  return image && !sharedCardModel.isPlaceholderGameImage(image) ? image : '';
}

function getRelatedGuideImageModel(game = {}) {
  const cover = getRelatedGuideImageValue(game?.cover_image);
  const banner = getRelatedGuideImageValue(game?.image);
  const derivedCover = cover ? '' : getRelatedGuideImageValue(sharedCardModel.deriveSteamLibraryCover(banner));
  const primary = cover || derivedCover || banner;
  const fallback = primary && banner && primary !== banner ? banner : '';
  const mode = cover || derivedCover ? 'poster' : banner ? 'banner' : 'fallback';
  return { primary, fallback, mode };
}

function renderRelatedGuideThumbHtml(game = {}) {
  const imageModel = getRelatedGuideImageModel(game);
  const fallbackAttr = imageModel.fallback ? ` data-fallback-src="${escapeHtml(imageModel.fallback)}"` : '';
  const image = imageModel.primary
    ? `<img src="${escapeHtml(imageModel.primary)}"${fallbackAttr} alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="if(this.dataset.fallbackSrc&&!this.dataset.fallbackUsed){this.dataset.fallbackUsed='true';this.src=this.dataset.fallbackSrc;this.parentElement.classList.remove('atlas-related-guide-card__thumb--poster');this.parentElement.classList.add('atlas-related-guide-card__thumb--banner');return;}this.hidden=true;this.parentElement.classList.add('atlas-related-guide-card__thumb--fallback-visible');">`
    : '';
  return `
        <div class="atlas-related-guide-card__thumb atlas-related-guide-card__thumb--${escapeHtml(imageModel.mode)}${imageModel.primary ? '' : ' atlas-related-guide-card__thumb--fallback-visible'}">
          <span aria-hidden="true"></span>
          ${image}
        </div>`;
}

function renderGuideRelatedCardsServer(relatedGames = []) {
  if (!Array.isArray(relatedGames) || !relatedGames.length) {
    return '<div class="atlas-inline-empty md:col-span-2">Conforme o catálogo crescer, os jogos parecidos e a próxima trilha aparecem aqui.</div>';
  }

  return relatedGames.map(item => {
    const card = sharedCardModel.buildCompactGuideCardModel(item);
      const game = card.game || item?.game || item;
      const slug = escapeHtml(card.slug || '');
      const hasImage = true;
      return `
      <article class="atlas-card atlas-card--game atlas-card--compact atlas-related-guide-card${hasImage ? ' atlas-related-guide-card--with-thumb' : ''}" data-difficulty-tone="${escapeHtml(card.difficultyTone)}" data-risk="${card.hasRisk ? 'missable' : 'none'}">
        ${renderRelatedGuideThumbHtml(game)}
        <div class="atlas-card__body">
          <h3 class="atlas-card__title">${escapeHtml(card.name)}</h3>
          <p class="atlas-card__reason">${escapeHtml(card.shortReason)}</p>
          <div class="atlas-card__meta">
            <span class="atlas-meta-signal ${escapeHtml(card.difficultyClass)}"><i class="fas fa-gauge-high"></i>${escapeHtml(card.difficulty)}/10</span>
            <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(card.time)}</span>
          </div>
          <div class="atlas-card__actions">
            <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-home-game="${escapeHtml(game?.name || '')}" data-open-guide-card="${slug}">Abrir guia</a>
          </div>
        </div>
      </article>`;
    }).join('');
}

function renderGuideRelatedOverviewServer(game, relatedGames = []) {
  const comparisonModel = buildGuideComparisonModelServer(game, relatedGames);
  const lead = comparisonModel.lead;
  const compareHtml = comparisonModel.rows.length ? `
    <section class="atlas-panel atlas-panel--support p-5 rounded-[24px] space-y-4 md:col-span-2">
      <div class="atlas-decision-panel__header">
        <div>
          <span class="atlas-section-kicker">Próximo passo depois deste guia</span>
          <h2 class="text-lg md:text-xl font-extrabold mt-2">Se você curtir esta platina, qual jogo deve abrir depois?</h2>
        </div>
        <span class="atlas-tag atlas-tag--accent">Continuidade</span>
      </div>
      ${lead ? `<article class="atlas-card atlas-card--game atlas-card--compact" data-difficulty-tone="${escapeHtml(getDifficultyTone(lead.difficulty))}"><div class="atlas-card__body"><h3 class="atlas-card__title">${escapeHtml(lead.name)}</h3><p class="atlas-card__reason">${escapeHtml(lead.reason.length > 96 ? `${lead.reason.slice(0, 93)}...` : lead.reason)}</p><div class="atlas-card__meta"><span class="atlas-meta-signal ${escapeHtml(getDifficultyToneClass(lead.difficulty))}"><i class="fas fa-gauge-high"></i>${escapeHtml(lead.difficulty)}/10</span><span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(lead.time)}</span></div><div class="atlas-card__actions"><a href="/jogo/${escapeHtml(lead.slug)}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-home-game="${escapeHtml(lead.name)}" data-open-guide-card="${escapeHtml(lead.slug)}">Abrir guia</a></div></div></article>` : ''}
      <div class="grid lg:grid-cols-4 gap-3">
        <a href="/jogo/${escapeHtml(game?.slug || '')}" class="atlas-card atlas-card--minimal"><div class="atlas-card__body"><h3 class="atlas-card__title">${escapeHtml(comparisonModel.baseline.name)}</h3><p class="atlas-card__reason">Base atual para comparar ritmo.</p><span class="atlas-card__link">Guia atual</span></div></a>
        ${comparisonModel.rows.map(item => `<article class="atlas-card atlas-card--game atlas-card--compact" data-difficulty-tone="${escapeHtml(getDifficultyTone(item.difficulty))}"><div class="atlas-card__body"><h3 class="atlas-card__title">${escapeHtml(item.name)}</h3><p class="atlas-card__reason">${escapeHtml(item.trackDetail)}</p><div class="atlas-card__meta"><span class="atlas-meta-signal ${escapeHtml(getDifficultyToneClass(item.difficulty))}"><i class="fas fa-gauge-high"></i>${escapeHtml(item.difficulty)}/10</span><span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${escapeHtml(item.time)}</span></div><div class="atlas-card__actions"><a href="/jogo/${escapeHtml(item.slug)}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-home-game="${escapeHtml(item.name)}" data-open-guide-card="${escapeHtml(item.slug)}">Abrir guia</a></div></div></article>`).join('')}
      </div>
    </section>` : '';

  return `${compareHtml}<section class="md:col-span-2 space-y-4"><div class="atlas-decision-panel__header"><div><span class="atlas-section-kicker">Se você gostou desta platina, tente estas 3</span><h2 class="text-lg md:text-xl font-extrabold mt-2">Jogos parecidos para manter o ritmo</h2></div><span class="atlas-tag atlas-tag--soft">Descoberta</span></div><div class="grid md:grid-cols-2 gap-4">${renderGuideRelatedCardsServer(relatedGames)}</div></section>`;
}

function buildGuideViewModel(game, completedSource = [], options = {}) {
  return sharedGuideViewModel.buildGuideViewModel(game, completedSource, {
    ...options,
    classifyGameCollections
  });
}

function getGuideRoadmapCount(game = {}, viewModel = {}) {
  return sharedEditorialModel.getGuideRoadmapCount(game, viewModel);
}

function buildGuideHeroStats(game = {}, viewModel = {}) {
  if (typeof sharedGuideViewModel.buildGuideSummaryCards === 'function') {
    const essentials = new Set(['Tempo estimado', 'Dificuldade', 'Trofeus', 'TrofÃ©us', 'Platina/100%']);
    return sharedGuideViewModel.buildGuideSummaryCards(game, viewModel).filter(item => essentials.has(item.label)).slice(0, 4);
  }
  return sharedEditorialModel.buildGuideHeroStats(game, viewModel);
}

function getGuideCoverModel(game = {}, viewModel = {}) {
  const fallbackImage = sharedCardModel.getGameCoverImage(game) || viewModel.image || '';
  return viewModel.guideCover || {
    image: fallbackImage,
    backdropImage: game?.image || '',
    mode: fallbackImage ? 'poster' : 'fallback',
    className: fallbackImage ? 'atlas-guide-cover--poster' : 'atlas-guide-cover--fallback',
    alt: `Capa de ${game?.name || 'Jogo'}`
  };
}

function renderGuideHeroCoverHtml(game = {}, viewModel = {}) {
  const cover = getGuideCoverModel(game, viewModel);
  const title = game?.name || 'Jogo';
  const image = cover.image || '';
  const backdrop = cover.backdropImage && cover.mode === 'banner'
    ? `<img class="atlas-guide-cover__backdrop" src="${escapeHtml(cover.backdropImage)}" alt="" aria-hidden="true" loading="eager" decoding="async">`
    : '';
  const fallbackVisible = image ? '' : ' atlas-guide-cover--fallback-visible';
  return `
    <div class="atlas-guide-cover atlas-guide-cover--hero ${escapeHtml(cover.className || '')}${fallbackVisible}">
      <span class="atlas-guide-cover__fallback" aria-hidden="true">${escapeHtml(title)}</span>
      ${backdrop}
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(cover.alt || `Capa de ${title}`)}" class="atlas-guide-cover__image" loading="eager" decoding="sync" fetchpriority="high" width="900" height="1200" sizes="(min-width: 1280px) 220px, (min-width: 768px) 180px, 120px" onerror="this.hidden=true;this.parentElement.classList.add('atlas-guide-cover--fallback-visible');var backdrop=this.parentElement.querySelector('.atlas-guide-cover__backdrop');if(backdrop)backdrop.setAttribute('hidden','hidden');">` : ''}
    </div>
  `;
}

function renderGuideHeaderHtml(game, viewModel) {
  const guideEyebrow = 'Resumo rápido do guia';
  const verdict = buildThirtySecondVerdict(game, viewModel);
  const heroStats = buildGuideHeroStats(game, viewModel);
  const nextAction = viewModel.nextActionModel || {};
  const scopeModel = viewModel.scopeModel || {};
  const isSaved = Boolean(viewModel?.isSaved);
  const libraryActionLabel = isSaved ? 'Remover da biblioteca' : 'Adicionar a biblioteca';
  const libraryActionClass = isSaved ? 'atlas-btn-secondary atlas-btn-muted-action' : 'atlas-btn-primary';
  const libraryActionIcon = isSaved ? 'fa-bookmark' : 'fa-plus';
  const shouldReadPlan = ['risks', 'roadmap'].includes(nextAction.focus || '');
  const primaryAction = shouldReadPlan ? (nextAction.focus || 'roadmap') : 'trophies';
  const primaryLabel = shouldReadPlan ? 'Ler plano da platina' : 'Ir para checklist';
  const secondaryHtml = shouldReadPlan
    ? '<button type="button" class="atlas-btn atlas-btn-secondary" data-guide-action="trophies"><i class="fas fa-list-check"></i> Ir para checklist</button>'
    : `<button type="button" class="atlas-btn ${escapeHtml(libraryActionClass)}" data-toggle-save-game="true" aria-label="${escapeHtml(libraryActionLabel)} ${escapeHtml(game?.name || 'jogo')}"><i class="fas ${escapeHtml(libraryActionIcon)}"></i> ${escapeHtml(isSaved ? 'Salvo' : 'Salvar guia')}</button>`;
  return `
    <section class="atlas-panel atlas-panel--primary atlas-guide-hero p-5 md:p-6">
      <div class="atlas-guide-hero__layout">
        ${renderGuideHeroCoverHtml(game, viewModel)}
        <div class="atlas-guide-hero__body">
          <div class="atlas-guide-hero__kicker">
            <span>${escapeHtml(guideEyebrow)}</span>
          </div>
          <h1>${escapeHtml(buildGameGuideH1(game))}</h1>
          <p class="atlas-guide-hero__subtitle">${escapeHtml(scopeModel.subtitle || 'Guia de troféus e roadmap da platina')}</p>
          <p class="atlas-guide-hero__summary">${escapeHtml(verdict.summary || viewModel.decisionModel.verdictDetail)}</p>
          <div class="atlas-guide-start-card">
            <div>
              <span>Comece por aqui</span>
              <strong>${escapeHtml(nextAction.title || 'Abrir roadmap')}</strong>
              <p>${escapeHtml(nextAction.detail || 'Use o roadmap para entender a ordem antes de marcar troféus soltos.')}</p>
            </div>
          </div>
          <div class="atlas-guide-hero__facts">
            ${heroStats.map(item => `<span class="atlas-meta-signal ${escapeHtml(item.tone || 'atlas-meta-signal--partial')}" title="${escapeHtml(item.detail || '')}"><i class="fas ${escapeHtml(item.icon)}"></i><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></span>`).join('')}
          </div>
          <div class="atlas-guide-hero__actions">
            <button type="button" class="atlas-btn atlas-btn-primary" data-guide-action="${escapeHtml(primaryAction)}"><i class="fas ${shouldReadPlan ? 'fa-route' : 'fa-list-check'}"></i> ${escapeHtml(primaryLabel)}</button>
            ${secondaryHtml}
          </div>
        </div>
      </div>
    </section>`;
}

function renderGuideSidebarHtml(game, viewModel, options = {}) {
  const isSaved = Boolean(options?.isSaved || viewModel?.isSaved);
  const nextAction = viewModel.nextActionModel || buildGuideNextActionModel(game, viewModel);
  const libraryEntry = options?.libraryEntry || viewModel?.libraryEntry || null;
  const libraryLabel = isSaved ? `Na biblioteca • ${escapeHtml(libraryEntry?.status || 'salvo')}` : 'Ainda não salvo';
  const progressAccent = viewModel.progress >= 100 ? 'done' : (viewModel.progress >= 35 ? 'neutral' : 'partial');
  const momentumLabel = viewModel.progress ? `${viewModel.progress}% concluído` : 'Novo projeto';
  return `
    <section class="atlas-panel atlas-panel--section atlas-guide-sidebar-card p-5">
      <div class="atlas-guide-sidebar-card__top">
        <div>
          <div class="atlas-eyebrow">Progresso</div>
          <strong id="guideProgressLabel" data-guide-progress-label>${viewModel.progress}%</strong>
        </div>
        <span class="atlas-badge atlas-badge--${escapeHtml(progressAccent)}">${escapeHtml(momentumLabel)}</span>
      </div>
      <div class="atlas-sidebar-progress" aria-hidden="true">
        <span id="guideProgressBar" data-guide-progress-bar style="width: ${escapeHtml(String(viewModel.progress))}%"></span>
      </div>
      <div class="atlas-sidebar-counts">
        <span class="atlas-sidebar-counts__complete"><strong id="guideCompletedCount" data-guide-completed-count>${escapeHtml(String(viewModel.completed))}</strong> concluídos</span>
        <span class="atlas-sidebar-counts__pending"><strong id="guideRemainingCount" data-guide-remaining-count>${escapeHtml(String(viewModel.pending))}</strong> pendentes</span>
        <span class="atlas-sidebar-counts__risk">${escapeHtml(String(viewModel.riskCounts?.alertCount || 0))} alertas</span>
      </div>
      <div class="atlas-sidebar-next">
        <div class="atlas-eyebrow">Próximo passo</div>
        <strong>${escapeHtml(nextAction.title || 'Abrir checklist')}</strong>
        <p>${escapeHtml(nextAction.detail || 'Use a lista principal para continuar sem perder contexto.')}</p>
        <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-guide-action="${escapeHtml(nextAction.focus || 'trophies')}">${escapeHtml(nextAction.cta || 'Continuar')}</button>
      </div>
      <div class="atlas-sidebar-actions">
        <div class="text-xs text-white/45">${libraryLabel}</div>
        <button type="button" class="atlas-btn ${isSaved ? 'atlas-btn-secondary atlas-btn-muted-action' : 'atlas-btn-primary'} atlas-btn-compact" data-toggle-save-game="true">${isSaved ? 'Remover da biblioteca' : 'Salvar na biblioteca'}</button>
        <button type="button" class="atlas-btn atlas-btn-secondary atlas-btn-compact" data-copy-game-link="${escapeHtml(game?.slug || '')}">Copiar link</button>
      </div>
    </section>`;
}

function renderGuideRoadmapTimelineHtml(roadmapStages = []) {
  if (!roadmapStages.length) return '<div class="atlas-inline-empty">Sem roadmap cadastrado.</div>';
  return `
    <ol class="atlas-roadmap-timeline">
      ${roadmapStages.map(stage => {
        const category = stage.category || { id: 'plan', label: 'Plano', icon: 'fa-route' };
        const actions = splitGuideRoadmapActions(stage.description || stage.objective).slice(0, 3);
        return `
        <li class="atlas-roadmap-step atlas-roadmap-step--${escapeHtml(category.id || 'plan')}${Number(stage.number) === 1 ? ' atlas-roadmap-step--first' : ''}">
          <div class="atlas-roadmap-step__marker">${escapeHtml(String(stage.number))}</div>
          <article class="atlas-roadmap-step__body">
            <div class="atlas-roadmap-step__head">
              <div>
                <span>${Number(stage.number) === 1 ? 'Comece aqui' : `Passo ${escapeHtml(String(stage.number))}`}</span>
                <h3>${escapeHtml(stage.title)}</h3>
              </div>
              <span class="atlas-roadmap-step__category atlas-roadmap-step__category--${escapeHtml(category.id || 'plan')}"><i class="fas ${escapeHtml(category.icon || 'fa-route')}" aria-hidden="true"></i>${escapeHtml(category.label || 'Plano')}</span>
            </div>
            <p>${escapeHtml(stage.objective || stage.description)}</p>
            ${actions.length ? `<ul class="atlas-roadmap-step__actions">${actions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}</ul>` : ''}
            <div class="atlas-roadmap-step__meta">
              <span><strong>Objetivo</strong>${escapeHtml(stage.objective)}</span>
              ${stage.risk ? `<span><strong>Risco</strong>${escapeHtml(stage.risk)}</span>` : ''}
              ${stage.relatedTrophies?.length ? `<span><strong>Troféus relacionados</strong>${stage.relatedTrophies.map(escapeHtml).join(' / ')}</span>` : ''}
            </div>
          </article>
        </li>
      `;
      }).join('')}
    </ol>`;
}

function splitGuideRoadmapActions(value = '') {
  return String(value || '')
    .split(/(?:[.;]\s+|\n+|,\s+(?=e |depois|entao|então|antes|sem |com |use |faça |faca ))/i)
    .map(item => item.trim().replace(/^[-•]\s*/, ''))
    .filter(item => item.length > 18)
    .map(item => item.length > 120 ? `${item.slice(0, 117).trim()}...` : item);
}

function renderGuideInternalNavHtml() {
  const items = [
    { action: 'header', href: '#guideHeader', icon: 'fa-compass', label: 'Resumo' },
    { action: 'roadmap', href: '#guideRoadmapPanel', icon: 'fa-route', label: 'Roadmap' },
    { action: 'trophies', href: '#guideChecklistPanel', icon: 'fa-list-check', label: 'Checklist' },
    { action: 'risks', href: '#guideRiskSummaryPanel', icon: 'fa-triangle-exclamation', label: 'Alertas' },
    { action: 'related', href: '#guideRelatedPanel', icon: 'fa-layer-group', label: 'Relacionados' }
  ];
  return `
    <nav id="guideInternalNav" class="atlas-guide-nav" aria-label="Navegação interna do guia">
      ${items.map(item => `<a class="atlas-guide-nav__link" href="${escapeHtml(item.href)}" data-guide-action="${escapeHtml(item.action)}"><i class="fas ${escapeHtml(item.icon)}" aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></a>`).join('')}
    </nav>`;
}

function renderGuideRoadmapPanelHtml(viewModel = {}) {
  const roadmapStages = Array.isArray(viewModel.roadmapStages) ? viewModel.roadmapStages : [];
  return `
    <section id="guideRoadmapPanel" class="atlas-panel atlas-panel--section atlas-roadmap-panel p-5 md:p-6">
      <div class="atlas-section-head atlas-section-head--compact">
        <div>
          <div class="atlas-eyebrow">Roadmap da platina</div>
          <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">Ordem recomendada para jogar</h2>
          <p class="text-white/58 mt-2 max-w-4xl">Comece por estas etapas antes de mergulhar na lista completa. A ordem ajuda a reduzir retrabalho, evitar perdas e deixar o cleanup para o momento certo.</p>
        </div>
        <span class="atlas-tag atlas-tag--soft">${escapeHtml(String(roadmapStages.length))} etapa(s)</span>
      </div>
      ${renderGuideRoadmapTimelineHtml(roadmapStages)}
    </section>`;
}

function renderGuideRiskAlertsPanelHtml(game = {}, viewModel = {}) {
  const alerts = typeof sharedGuideViewModel.buildGuideRiskAlerts === 'function'
    ? sharedGuideViewModel.buildGuideRiskAlerts(game, viewModel)
    : [];
  const beforeItems = Array.isArray(viewModel.beforeStartItems) && viewModel.beforeStartItems.length
    ? viewModel.beforeStartItems
    : (typeof sharedGuideViewModel.buildGuideBeforeStartItems === 'function' ? sharedGuideViewModel.buildGuideBeforeStartItems(game, viewModel) : []);
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
          <article class="atlas-guide-before-card atlas-guide-before-card--${escapeHtml(item.tone || 'neutral')}">
            <i class="fas ${escapeHtml(item.icon || 'fa-circle-info')}" aria-hidden="true"></i>
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
          <article class="atlas-guide-risk-card atlas-guide-risk-card--${escapeHtml(alert.tone || 'neutral')}">
            <i class="fas ${escapeHtml(alert.icon || 'fa-circle-info')}" aria-hidden="true"></i>
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

function renderGuideDecisionStackHtml(game, viewModel) {
  const verdict = buildThirtySecondVerdict(game, viewModel);
  return `
    <section id="guideVerdictPanel" class="atlas-panel atlas-panel--primary atlas-editorial-band p-5 md:p-6">
      <div class="atlas-editorial-band__intro">
        <div>
          <div class="atlas-eyebrow">Veredito de 30 segundos</div>
          <h2>O custo da platina em leitura rápida</h2>
          <p>${escapeHtml(verdict.summary)}</p>
        </div>
        <button type="button" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-guide-action="${escapeHtml(viewModel.nextActionModel?.focus === 'risks' ? 'risks' : 'trophies')}"><i class="fas ${escapeHtml(viewModel.nextActionModel?.focus === 'risks' ? 'fa-triangle-exclamation' : 'fa-list-check')}"></i> ${escapeHtml(viewModel.nextActionModel?.focus === 'risks' ? 'Ler alertas e roadmap' : 'Ir para checklist')}</button>
      </div>
      <div class="atlas-verdict-strip" aria-label="Resumo rápido da platina">
        ${verdict.cards.map(card => `<article class="atlas-verdict-strip__item ${escapeHtml(card.tone || '')}" title="${escapeHtml(card.detail || '')}"><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><p>${escapeHtml(card.detail)}</p></article>`).join('')}
      </div>
    </section>
    ${renderGuideRiskAlertsPanelHtml(game, viewModel)}
    ${renderGuideInternalNavHtml()}`;
}

function renderGuidePlatinumSummaryPanelHtml(game = {}, viewModel = {}) {
  const cards = typeof sharedGuideViewModel.buildGuideSummaryCards === 'function'
    ? sharedGuideViewModel.buildGuideSummaryCards(game, viewModel)
    : buildGuideHeroStats(game, viewModel);
  return `
    <section id="guidePlatinumSummaryPanel" class="atlas-panel atlas-panel--section atlas-platinum-summary p-5 md:p-6">
      <div class="atlas-section-head atlas-section-head--compact">
        <div>
          <div class="atlas-eyebrow">Resumo rápido da platina</div>
          <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">O que você precisa saber antes de jogar</h2>
          <p class="text-white/58 mt-2 max-w-4xl">Tempo, dificuldade, escopo, online, coop e riscos ficam aqui para decisão rápida antes do plano completo.</p>
        </div>
      </div>
      <div class="atlas-platinum-summary__grid" aria-label="Resumo essencial da platina">
        ${cards.map(card => `<article class="atlas-platinum-summary__card ${escapeHtml(card.tone || '')}" title="${escapeHtml(card.detail || '')}"><i class="fas ${escapeHtml(card.icon || 'fa-circle-info')}" aria-hidden="true"></i><div><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><p>${escapeHtml(card.detail || '')}</p></div></article>`).join('')}
      </div>
    </section>`;
}

function renderGuideRiskAlertsPanelHtmlV2(game = {}, viewModel = {}) {
  const beforeItems = Array.isArray(viewModel.beforeStartItems) && viewModel.beforeStartItems.length
    ? viewModel.beforeStartItems
    : (typeof sharedGuideViewModel.buildGuideBeforeStartItems === 'function' ? sharedGuideViewModel.buildGuideBeforeStartItems(game, viewModel) : []);
  const items = beforeItems.slice(0, 5);
  if (!items.length) return '';
  return `
    <section id="guideRiskSummaryPanel" class="atlas-panel atlas-panel--section atlas-guide-risk-summary p-5 md:p-6">
      <div class="atlas-section-head atlas-section-head--compact">
        <div>
          <div class="atlas-eyebrow">Leia antes de começar</div>
          <h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Alertas que mudam a rota da platina</h2>
          <p class="text-white/58 mt-2 max-w-4xl">No máximo cinco pontos críticos antes do roadmap. Leia isso para evitar erro de ordem, DLC fora do escopo, coop esquecido ou cleanup mal planejado.</p>
        </div>
        <span class="atlas-tag atlas-tag--soft">${escapeHtml(String(items.length))} alerta(s)</span>
      </div>
      <div class="atlas-guide-before-grid">
        ${items.map(item => `
          <article class="atlas-guide-before-card atlas-guide-before-card--${escapeHtml(item.tone || 'neutral')}">
            <i class="fas ${escapeHtml(item.icon || 'fa-circle-info')}" aria-hidden="true"></i>
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

function renderGuideDecisionStackHtmlV2(game, viewModel) {
  return `
    ${renderGuidePlatinumSummaryPanelHtml(game, viewModel)}
    ${renderGuideRiskAlertsPanelHtmlV2(game, viewModel)}
    ${renderGuideInternalNavHtml()}`;
}

function buildSsrGuideMarkup(game, relatedGames = []) {
  const viewModel = buildGuideViewModel(game, []);
  const header = renderGuideHeaderHtml(game, viewModel);
  const decisionStack = renderGuideDecisionStackHtmlV2(game, viewModel);
  const roadmap = renderGuideRoadmapPanelHtml(viewModel);
  const sidebar = renderGuideSidebarHtml(game, viewModel);
  const trophyList = viewModel.trophies.length
    ? viewModel.trophies.map((trophy, index) => renderTrophyCardHtml(trophy, viewModel.completedIds, index, game)).join('')
    : '<div class="text-white/60">Nenhum troféu cadastrado.</div>';
  const editorialNotes = renderGuideEditorialNotesHtml(game, viewModel);
  const relatedOverview = renderGuideRelatedOverviewServer(game, relatedGames);

  return { header, decisionStack, roadmap, sidebar, trophyList, editorialNotes, relatedOverview, viewModel };
}

function applyTemplateDefaults(template) {
  return template
    .replace(/__HOME_VIEW_CLASS__/g, '')
    .replace(/__CATALOG_VIEW_CLASS__/g, 'hidden')
    .replace(/__GUIDE_VIEW_CLASS__/g, 'hidden')
    .replace(/__GUIDE_CONTENT_CLASS__/g, 'hidden')
    .replace(/__HOME_HERO_HEADING_TAG__/g, 'h1')
    .replace(/__CATALOG_HEADING_TAG__/g, 'h2')
    .replace(/__LIBRARY_HEADING_TAG__/g, 'h2')
    .replace(/__PROFILE_HEADING_TAG__/g, 'h2')
    .replace(/__CATALOG_BREADCRUMBS__/g, '')
    .replace(/__GUIDE_BREADCRUMBS__/g, '')
    .replace(/__GUIDE_COLLECTION_LINKS__/g, '')
    .replace(/__ROBOTS_META__/g, '')
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__HAS_SSR_GAME__/g, 'false')
    .replace(/__SSR_GUIDE_HEADER__/g, '')
    .replace(/__SSR_GUIDE_DECISION_STACK__/g, '')
    .replace(/__SSR_GUIDE_SIDEBAR__/g, '')
    .replace(/__SSR_TROPHY_LIST__/g, '')
    .replace(/__SSR_GUIDE_ROADMAP__/g, '')
    .replace(/__SSR_GUIDE_EDITORIAL_NOTES__/g, '')
    .replace(/__GUIDE_RELATED_OVERVIEW__/g, '')
    .replace(/__CATALOG_TITLE__/g, 'Todos os jogos')
    .replace(/__CATALOG_SUMMARY__/g, '')
    .replace(/__CATALOG_HERO_TITLE__/g, 'Navegue sem depender da busca')
    .replace(/__CATALOG_HERO_DESCRIPTION__/g, 'Veja todos os jogos em uma lista filtrável com dificuldade, tempo estimado, troféus e acesso direto à página de guia.')
    .replace(/__CATALOG_COLLECTION_TITLE__/g, 'Coleção aberta')
    .replace(/__CATALOG_COLLECTION_DESCRIPTION__/g, 'Escolha uma faixa para entender melhor em que tipo de projeto você está entrando e clicar com mais segurança.')
    .replace(/__CATALOG_COLLECTION_REASON__/g, 'Use esta visão para comparar esforço, tempo e densidade do guia antes de escolher um jogo.')
    .replace(/__CATALOG_COLLECTION_CHECKLIST__/g, 'Abra a página do jogo para confirmar perdíveis, roadmap e se a lista combina com o seu momento.')
    .replace(/__CATALOG_SEO_INTRO_TITLE__/g, 'Pontos de entrada para escolher melhor')
    .replace(/__CATALOG_SEO_INTRO_BODY__/g, 'Esta coleção ajuda a comparar jogos antes do clique, com tempo, dificuldade, roadmap e riscos em primeiro plano.')
    .replace(/__CATALOG_RELATED_LINKS__/g, '')
    .replace(/__CATALOG_VERIFICATION_NOTICE__/g, '')
    .replace(/__CATALOG_SSR_LIST__/g, '')
    .replace(/__CATALOG_SSR_PAGINATION__/g, '')
    .replace(/__HOME_CATALOG_PROOF__/g, formatHomeCatalogProof(0, 0, 0))
    .replace(/__HOME_INTENT_CARDS__/g, '')
    .replace(/__HOME_FEATURED_NOW__/g, '')
    .replace(/__HOME_RECENT_GUIDES__/g, '')
    .replace(/__HOME_UPDATED_GUIDES__/g, '')
    .replace(/__INITIAL_STATE_SCRIPT__/g, '<script>window.__INITIAL_STATE__ = null;</script>');
}

async function buildGamePageHtml(game, req) {
  const origin = getPublicOrigin(req);
  const canonicalUrl = buildPublicUrl(req, `/jogo/${game.slug}`);
  const relatedResponse = await gamesService.listGames({ page: 1, limit: 80, sort: 'recommended-desc' });
  const relatedPool = Array.isArray(relatedResponse?.items) ? relatedResponse.items : [];
  const relatedGames = buildRelatedGamesServer(game, relatedPool, 4);
  const ssrMarkup = buildSsrGuideMarkup(game, relatedGames);
  const viewModel = ssrMarkup.viewModel;
  const statusBadge = viewModel.editorial?.statusBadge || getEditorialBadge(game);
  const title = buildGameSeoTitle(game);
  const description = buildGameSeoDescription(game);
  const image = resolveMetaImage(origin, game.image);
  const guideCollections = classifyGameCollections(game, game.trophies || []);
  const structuredData = safeJsonForHtml({
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'VideoGame',
      name: game.name,
      image,
      description,
      genre: 'Achievement tracking',
      url: canonicalUrl,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Status editorial', value: statusBadge.label },
        { '@type': 'PropertyValue', name: 'Cobertura', value: game.coverage_level || 'partial' },
        { '@type': 'PropertyValue', name: 'Verificado manualmente', value: game.is_verified ? 'sim' : 'não' }
      ]
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${origin}/catalogo` },
        { '@type': 'ListItem', position: 3, name: game.name, item: canonicalUrl }
      ]
    }, ...buildGuideFaqStructuredData(canonicalUrl, viewModel)]
  });

  return applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, escapeHtml(title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(description))
    .replace(/__ROBOTS_META__/g, '')
    .replace(/__PAGE_OG_TYPE__/g, 'article')
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, escapeHtml(image))
    .replace(/__PAGE_JSON_LD__/g, structuredData)
    .replace(/__HOME_VIEW_CLASS__/g, 'hidden')
    .replace(/__HOME_HERO_HEADING_TAG__/g, 'h2')
    .replace(/__CATALOG_HEADING_TAG__/g, 'h2')
    .replace(/__GUIDE_VIEW_CLASS__/g, '')
    .replace(/__GUIDE_BREADCRUMBS__/g, buildBreadcrumbsHtml([{ label: 'Início', href: '/' }, { label: 'Catálogo', href: '/catalogo' }, { label: game.name }]))
    .replace(/__GUIDE_COLLECTION_LINKS__/g, guideCollections.collectionLinks.map(item => `<a href="${escapeHtml(item.path)}" class="atlas-card atlas-card--minimal atlas-related-collection"><div class="atlas-card__body"><strong class="atlas-card__title">${escapeHtml(item.label)}</strong><span class="atlas-card__reason">${escapeHtml(item.reason)}</span><span class="atlas-card__link">Abrir coleção</span></div></a>`).join(''))
    .replace(/__GUIDE_CONTENT_CLASS__/g, '')
    .replace(/__HAS_SSR_GAME__/g, 'true')
    .replace(/__SSR_GUIDE_HEADER__/g, ssrMarkup.header)
    .replace(/__SSR_GUIDE_DECISION_STACK__/g, ssrMarkup.decisionStack)
    .replace(/__SSR_GUIDE_SIDEBAR__/g, ssrMarkup.sidebar)
    .replace(/__SSR_TROPHY_LIST__/g, ssrMarkup.trophyList)
    .replace(/__SSR_GUIDE_ROADMAP__/g, ssrMarkup.roadmap)
    .replace(/__SSR_GUIDE_EDITORIAL_NOTES__/g, ssrMarkup.editorialNotes)
    .replace(/__GUIDE_RELATED_OVERVIEW__/g, ssrMarkup.relatedOverview)
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({ page: 'guide', game })));
}

async function buildDefaultPageHtml(req) {
  const origin = getPublicOrigin(req);
  const games = await listAllHomeGames();
  const byRecent = [...games].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const byUpdated = [...games].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  const totalTrophies = games.reduce((sum, game) => sum + getHomeTotal(game), 0);
  const totalRoadmaps = games.reduce((sum, game) => sum + getHomeRoadmapCount(game), 0);

  return applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, 'AtlasAchievement - Guias de Platina com Roadmap e Checklist')
    .replace(/__PAGE_DESCRIPTION__/g, 'Compare tempo, dificuldade, perdíveis, online e roadmaps de platina em guias de troféus com checklist e progresso salvo.')
    .replace(/__ROBOTS_META__/g, '')
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__PAGE_CANONICAL__/g, buildPublicUrl(req, '/'))
    .replace(/__PAGE_OG_IMAGE__/g, `${origin}/og-default.svg`)
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'AtlasAchievement',
      url: buildPublicUrl(req, '/'),
      description: 'Compare tempo, dificuldade, perdíveis, online e roadmaps de platina em guias de troféus com checklist e progresso salvo.'
    }))
    .replace(/__HOME_CATALOG_PROOF__/g, formatHomeCatalogProof(games.length, totalTrophies, totalRoadmaps))
    .replace(/__HOME_INTENT_CARDS__/g, renderHomeIntentCardsHtml(games))
    .replace(/__HOME_FEATURED_NOW__/g, renderHomeFeaturedGameHtml(games))
    .replace(/__HOME_RECENT_GUIDES__/g, renderHomeDiscoveryGuidesHtml(byRecent))
    .replace(/__HOME_UPDATED_GUIDES__/g, renderHomeEditorialHistoryHtml(byUpdated))
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({ page: 'home' })));
}

async function buildStaticPublicPageHtml(req, pageConfig = {}) {
  const origin = getPublicOrigin(req);
  const pathName = pageConfig.path || '/';
  const canonicalUrl = buildPublicUrl(req, pathName);
  const title = pageConfig.title || 'AtlasAchievement';
  const description = pageConfig.description || 'AtlasAchievement';
  const activeView = pageConfig.view || 'home';
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url: canonicalUrl,
    description
  };

  let html = applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, escapeHtml(title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(description))
    .replace(/__ROBOTS_META__/g, pageConfig.robotsMeta || '<meta name="robots" content="noindex,follow">')
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, `${origin}/og-default.svg`)
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml(structuredData))
    .replace(/__HOME_VIEW_CLASS__/g, activeView === 'home' ? '' : 'hidden')
    .replace(/__HOME_HERO_HEADING_TAG__/g, activeView === 'home' ? 'h1' : 'h2')
    .replace(/__LIBRARY_HEADING_TAG__/g, activeView === 'library' ? 'h1' : 'h2')
    .replace(/__PROFILE_HEADING_TAG__/g, activeView === 'profile' ? 'h1' : 'h2')
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({ page: activeView })));

  if (activeView === 'library') {
    html = html.replace(
      'id="view-library" class="atlas-view-shell hidden space-y-4 pt-2"',
      'id="view-library" class="atlas-view-shell space-y-4 pt-2"'
    );
  }

  if (activeView === 'profile') {
    html = html.replace(
      'id="view-profile" class="atlas-view-shell hidden space-y-5 pt-2"',
      'id="view-profile" class="atlas-view-shell space-y-5 pt-2"'
    );
  }

  return html;
}

function getCatalogFacetCount(facetConfigOrId, facetCounts = {}) {
  return sharedCatalogModel.getCatalogFacetCount(facetConfigOrId, facetCounts);
}

function formatCatalogCount(count) {
  return sharedCatalogModel.formatCatalogCount(count);
}

function isCatalogUnverifiedBadge(statusBadge = {}) {
  return (statusBadge.badge || statusBadge.tone) === 'unverified'
    || /verifica/i.test(String(statusBadge.label || ''));
}

function getCatalogStatusBadge(statusBadge = {}) {
  if (isCatalogUnverifiedBadge(statusBadge)) {
    return { ...statusBadge, label: 'Em verificação', badge: 'unverified', tone: 'unverified' };
  }
  return statusBadge;
}

function renderCatalogVerificationNotice(items = []) {
  const count = (Array.isArray(items) ? items : []).reduce((total, game) => {
    const statusBadge = sharedCardModel.buildStandardGameCardModel(game).statusBadge;
    return total + (isCatalogUnverifiedBadge(statusBadge) ? 1 : 0);
  }, 0);
  return count > 1
    ? `<i class="fas fa-circle-info" aria-hidden="true"></i><span>${escapeHtml(`${count} guias com dados em verificação`)}</span>`
    : '';
}

function getCatalogRelatedFacets(facetConfig, facetCounts = {}, options = {}) {
  return sharedCatalogModel.getRelatedCatalogFacets(facetConfig, facetCounts, options);
}

function renderCatalogEmptyState(facetConfig, facetCounts = {}) {
  const nearby = getCatalogRelatedFacets(facetConfig, facetCounts, { includeEmpty: false }).slice(0, 4);
  const fallbackLinks = nearby.length
    ? nearby
    : [{ path: '/catalogo', name: 'Catálogo completo', count: getCatalogFacetCount('all', facetCounts) }];

  return `
    <article class="atlas-panel atlas-panel--plain p-5 md:p-6 md:col-span-2 xl:col-span-3">
      <span class="atlas-section-kicker">Coleção em expansão</span>
      <h3 class="text-xl font-extrabold tracking-tight mt-2">Ainda não há jogos nesta faixa</h3>
      <p class="text-white/65 mt-3">Nenhum guia publicado cumpre exatamente este filtro hoje.</p>
      <div class="mt-5">
        <div class="text-[11px] uppercase tracking-[0.18em] text-white/40 mb-3">Coleções próximas com jogos disponíveis</div>
        <div class="flex flex-wrap gap-3">
          ${fallbackLinks.map(item => `<a href="${escapeHtml(item.path)}" class="atlas-chip">${escapeHtml(item.name)} • ${escapeHtml(formatCatalogCount(item.count))}</a>`).join('')}
        </div>
      </div>
    </article>`;
}

function getCatalogCardImageSource(game = {}, model = {}) {
  const candidates = [
    game?.image,
    model?.bannerImage,
    game?.cover_image,
    model?.coverImage,
    model?.image
  ];
  return candidates
    .map(value => String(value || '').trim())
    .find(value => value && !sharedCardModel.isPlaceholderGameImage(value)) || '';
}

function renderCatalogCardImageHtml(game = {}, model = {}, source = '') {
  const name = model.name || game?.name || 'Jogo';
  const fallbackClass = source ? '' : ' catalog-card__media--fallback-visible';
  const image = source
    ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(name)}" class="catalog-card__image" loading="lazy" decoding="async" width="600" height="338" sizes="(min-width: 1180px) 31vw, (min-width: 720px) 46vw, 100vw" onerror="this.hidden=true;this.parentElement.classList.add('catalog-card__media--fallback-visible');var card=this.closest('.catalog-card');if(card)card.classList.add('catalog-card--image-fallback');">`
    : '';
  return `
        <div class="catalog-card__media${fallbackClass}">
          <span class="catalog-card__fallback" aria-hidden="true">${escapeHtml(name)}</span>
          ${image}
        </div>`;
}

function renderCatalogSeoCards(items = [], facetConfig = catalogFacetPageMap.all, facetCounts = {}) {
  if (!items.length) return renderCatalogEmptyState(facetConfig, facetCounts);

  return `${items.map(game => {
    const model = sharedCardModel.buildStandardGameCardModel(game);
    const name = escapeHtml(model.name);
    const slug = escapeHtml(model.slug);
    const difficulty = escapeHtml(String(model.difficulty ?? '—'));
    const time = escapeHtml(model.time);
    const trophyCount = model.trophies;
    const statusBadge = getCatalogStatusBadge(model.statusBadge);
    const imageSource = getCatalogCardImageSource(game, model);
    const decision = typeof sharedCatalogModel.getCatalogDecisionSignals === 'function'
      ? sharedCatalogModel.getCatalogDecisionSignals(game)
      : { signals: [] };
    const signalHtml = (decision.signals || []).slice(0, 5).map(signal => `
            <span class="catalog-card__signal catalog-card__signal--${escapeHtml(signal.tone || 'neutral')}" title="${escapeHtml(signal.label)}"><i class="fas ${escapeHtml(signal.icon || 'fa-circle-info')}" aria-hidden="true"></i>${escapeHtml(signal.label)}</span>`).join('');
    return `
      <article class="catalog-card${imageSource ? '' : ' catalog-card--image-fallback'}" data-game-slug="${slug}" data-difficulty-tone="${escapeHtml(model.difficultyTone)}" data-risk="${model.hasRisk ? 'missable' : 'none'}" itemscope itemtype="https://schema.org/VideoGame">
        ${renderCatalogCardImageHtml(game, model, imageSource)}
        <div class="catalog-card__body">
          <div class="catalog-card__badges">
            <span class="catalog-card__status atlas-badge atlas-badge--${escapeHtml(statusBadge.badge || statusBadge.tone || 'partial')}">${escapeHtml(statusBadge.label)}</span>
            ${model.hasRisk ? '<span class="atlas-badge atlas-badge--risk">Perdíveis</span>' : ''}
          </div>
          <h3 class="catalog-card__title" itemprop="name">${name}</h3>
          <meta itemprop="url" content="/jogo/${slug}">
          <div class="catalog-card__meta">
            <span class="atlas-meta-signal ${escapeHtml(model.difficultyClass)}"><i class="fas fa-gauge-high"></i>${difficulty}/10</span>
            <span class="atlas-meta-signal atlas-meta-signal--time"><i class="fas fa-clock"></i>${time}</span>
            <span class="atlas-meta-signal atlas-meta-signal--trophy"><i class="fas fa-trophy"></i>${escapeHtml(String(trophyCount))} troféus</span>
          </div>
          <div class="catalog-card__signals" aria-label="Sinais para decidir a platina">
            ${signalHtml}
          </div>
          <div class="catalog-card__actions">
            <a href="/jogo/${slug}" class="atlas-btn atlas-btn-primary atlas-btn-compact" data-open-guide-card="${slug}">Abrir guia</a>
          </div>
        </div>
      </article>`;
  }).join('')}`;
}

function renderCatalogPaginationHtml(pagination = {}) {
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.totalPages || 1);
  const total = Number(pagination.total || 0);
  if (!total || totalPages <= 1) {
    return total ? `<div class="atlas-pagination-summary">${escapeHtml(String(total))} jogos</div>` : '';
  }

  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, page + 2);
  const pages = [];
  for (let value = windowStart; value <= windowEnd; value += 1) pages.push(value);

  return `
      <div class="atlas-pagination-summary">${escapeHtml(`${total} jogos · página ${page} de ${totalPages}`)}</div>
      <button type="button" class="atlas-btn atlas-btn-secondary" data-page-target="catalog" data-page-value="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
      ${pages.map(value => `<button type="button" class="atlas-pill ${value === page ? 'atlas-pill-active' : ''}" data-page-target="catalog" data-page-value="${value}">${value}</button>`).join('')}
      <button type="button" class="atlas-btn atlas-btn-secondary" data-page-target="catalog" data-page-value="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Próxima</button>`;
}

function renderCatalogRelatedLinks(facetConfig, facetCounts = {}) {
  const related = getCatalogRelatedFacets(facetConfig, facetCounts, { includeEmpty: true });
  if (!related.length) return '';
  return related
    .map(item => `<a href="${escapeHtml(item.path)}" class="atlas-related-pill"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.count ? formatCatalogCount(item.count) : 'em expansão')}</small></a>`)
    .join('');
}

function buildCatalogStructuredData(origin, canonicalUrl, facetConfig, items = [], total = items.length) {
  return {
    '@context': 'https://schema.org',
    '@graph': [{
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
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${origin}/catalogo` },
        { '@type': 'ListItem', position: 3, name: facetConfig?.name || 'Catálogo de jogos', item: canonicalUrl }
      ]
    }]
  };
}


function buildBreadcrumbsHtml(items = []) {
  return `
    <nav class="atlas-breadcrumbs" aria-label="Breadcrumb">
      ${items.map((item, index) => {
        const isLast = index === items.length - 1;
        const label = escapeHtml(item?.label || 'Item');
        if (isLast || !item?.href) {
          return `<span class="atlas-breadcrumbs__item" aria-current="page">${label}</span>`;
        }
        return `<a href="${escapeHtml(item.href)}" class="atlas-breadcrumbs__item">${label}</a>`;
      }).join('<span class="atlas-breadcrumbs__sep" aria-hidden="true">/</span>')}
    </nav>`;
}

function classifyGameCollections(game = {}, trophies = []) {
  return sharedCatalogModel.classifyGameCollections(game, trophies);
}


function buildEditorialCollectionItems(collectionSlug, items = []) {
  return sharedCatalogModel.buildEditorialCollectionItems(collectionSlug, items);
}

function buildEditorialCollectionStructuredData(origin, canonicalUrl, config, items = []) {
  return {
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'CollectionPage',
      name: config?.name || 'Coleção editorial',
      url: canonicalUrl,
      description: config?.description || 'Seleção editorial de jogos e guias.',
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
    }, {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Coleções', item: `${origin}/catalogo` },
        { '@type': 'ListItem', position: 3, name: config?.name || 'Coleção editorial', item: canonicalUrl }
      ]
    }]
  };
}

async function buildEditorialCollectionPageHtml(req, collectionSlug) {
  const config = editorialCollectionPageMap[collectionSlug];
  const origin = getPublicOrigin(req);
  const canonicalUrl = buildPublicUrl(req, config.path);
  const response = await gamesService.listGames({ facet: 'all', sort: 'recommended-desc', page: 1, limit: 100 });
  const allItems = Array.isArray(response?.items) ? response.items : [];
  const items = buildEditorialCollectionItems(collectionSlug, allItems);
  const structuredData = buildEditorialCollectionStructuredData(origin, canonicalUrl, config, items);
  const relatedLinks = Object.entries(editorialCollectionPageMap)
    .filter(([slug]) => slug !== collectionSlug)
    .map(([, item]) => `<a href="${escapeHtml(item.path)}" class="atlas-related-pill"><span>${escapeHtml(item.name)}</span><small>Coleção editorial</small></a>`)
    .join('');
  const introBody = `${config.introBody} Use os cards abaixo para comparar apenas jogos que se encaixam nesta seleção, com tempo, dificuldade, roadmap e risco visíveis antes do clique.`;

  return applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, escapeHtml(config.title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(config.description))
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, `${origin}/og-default.svg`)
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml(structuredData))
    .replace(/__HOME_VIEW_CLASS__/g, 'hidden')
    .replace(/__HOME_HERO_HEADING_TAG__/g, 'h2')
    .replace(/__CATALOG_VIEW_CLASS__/g, '')
    .replace(/__CATALOG_HEADING_TAG__/g, 'h1')
    .replace(/__CATALOG_TITLE__/g, escapeHtml(config.name))
    .replace(/__CATALOG_BREADCRUMBS__/g, buildBreadcrumbsHtml([{ label: 'Início', href: '/' }, { label: 'Catálogo', href: '/catalogo' }, { label: config.name }]))
    .replace(/__CATALOG_SUMMARY__/g, escapeHtml(`${formatCatalogCount(items.length)} nesta coleção editorial · página 1 de 1`))
    .replace(/__CATALOG_HERO_TITLE__/g, escapeHtml(config.heroTitle))
    .replace(/__CATALOG_HERO_DESCRIPTION__/g, escapeHtml(config.heroDescription))
    .replace(/__CATALOG_COLLECTION_TITLE__/g, escapeHtml(config.collectionTitle))
    .replace(/__CATALOG_COLLECTION_DESCRIPTION__/g, escapeHtml(config.collectionDescription))
    .replace(/__CATALOG_COLLECTION_REASON__/g, escapeHtml(config.reason))
    .replace(/__CATALOG_COLLECTION_CHECKLIST__/g, escapeHtml(config.checklist))
    .replace(/__CATALOG_SEO_INTRO_TITLE__/g, escapeHtml(config.introTitle))
    .replace(/__CATALOG_SEO_INTRO_BODY__/g, escapeHtml(introBody))
    .replace(/__CATALOG_RELATED_LINKS__/g, relatedLinks)
    .replace(/__CATALOG_VERIFICATION_NOTICE__/g, renderCatalogVerificationNotice(items))
    .replace(/__CATALOG_SSR_LIST__/g, renderCatalogSeoCards(items))
    .replace(/__CATALOG_SSR_PAGINATION__/g, renderCatalogPaginationHtml({ total: items.length, totalPages: 1, page: 1 }))
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({ page: 'catalog', facet: 'all', catalog: { pagination: { total: items.length, totalPages: 1, page: 1 } } })));
}

async function buildCatalogPageHtml(req, facetSlug = null) {
  const origin = getPublicOrigin(req);
  const facetConfig = facetSlug ? catalogFacetPageMap[facetSlug] : catalogFacetPageMap.all;
  const canonicalPath = facetConfig?.path || '/catalogo';
  const canonicalUrl = buildPublicUrl(req, canonicalPath);
  const title = facetConfig?.title || 'Catálogo de guias de troféus e platinas | AtlasAchievement';
  const description = facetConfig?.description || 'Explore guias de jogos com troféus, dificuldade, tempo estimado, roadmap de platina e checklist.';
  const facetCounts = await gamesService.getCatalogFacetCounts();
  const requestedPage = Math.max(Number(req.query?.page || 1) || 1, 1);
  const catalogResponse = await gamesService.listGames({ facet: facetConfig?.serviceFacet || 'all', sort: 'recommended-desc', page: requestedPage, limit: PUBLIC_CATALOG_PAGE_SIZE });
  const items = Array.isArray(catalogResponse?.items) ? catalogResponse.items : [];
  const total = getCatalogFacetCount(facetConfig, facetCounts) || Number(catalogResponse?.pagination?.total || items.length || 0);
  const isEmptyCollection = facetConfig?.serviceFacet !== 'all' && total === 0;
  const structuredData = buildCatalogStructuredData(origin, canonicalUrl, facetConfig, items, total);
  catalogResponse.facetCounts = facetCounts;
  const page = Number(catalogResponse?.pagination?.page || 1);
  const totalPages = Number(catalogResponse?.pagination?.totalPages || 1);
  const catalogSummary = `${formatCatalogCount(total)} nesta coleção · página ${page} de ${totalPages}`;
  const catalogHeroDescription = `${facetConfig?.heroDescription || 'Veja todos os jogos em uma lista filtrável com dificuldade, tempo estimado, troféus e acesso direto à página de guia.'} ${isEmptyCollection ? 'Ainda não há jogos publicados nesta faixa.' : `${formatCatalogCount(total)} nesta faixa agora.`}`;
  const catalogRelatedLinks = renderCatalogRelatedLinks(facetConfig, facetCounts);
  const catalogSsrList = renderCatalogSeoCards(items, facetConfig, facetCounts);
  const catalogVerificationNotice = renderCatalogVerificationNotice(items);
  const robotsMeta = isEmptyCollection ? '<meta name="robots" content="noindex,follow">' : '';

  return applyTemplateDefaults(publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, escapeHtml(title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(description))
    .replace(/__ROBOTS_META__/g, robotsMeta)
    .replace(/__PAGE_OG_TYPE__/g, 'website')
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, `${origin}/og-default.svg`)
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml(structuredData))
    .replace(/__HOME_VIEW_CLASS__/g, 'hidden')
    .replace(/__HOME_HERO_HEADING_TAG__/g, 'h2')
    .replace(/__CATALOG_VIEW_CLASS__/g, '')
    .replace(/__CATALOG_HEADING_TAG__/g, 'h1')
    .replace(/__CATALOG_SUMMARY__/g, escapeHtml(catalogSummary))
    .replace(/__CATALOG_HERO_DESCRIPTION__/g, escapeHtml(catalogHeroDescription))
    .replace(/__CATALOG_RELATED_LINKS__/g, catalogRelatedLinks)
    .replace(/__CATALOG_VERIFICATION_NOTICE__/g, catalogVerificationNotice)
    .replace(/__CATALOG_SSR_LIST__/g, catalogSsrList)
    .replace(/__CATALOG_SSR_PAGINATION__/g, renderCatalogPaginationHtml(catalogResponse.pagination))
    .replace(/__CATALOG_TITLE__/g, escapeHtml(facetConfig?.name || 'Catálogo de jogos'))
    .replace(/__CATALOG_BREADCRUMBS__/g, buildBreadcrumbsHtml([{ label: 'Início', href: '/' }, { label: 'Catálogo', href: '/catalogo' }, { label: facetConfig?.name || 'Catálogo de jogos' }]))
    .replace(/__CATALOG_HERO_TITLE__/g, escapeHtml(facetConfig?.heroTitle || 'Navegue sem depender da busca'))
    .replace(/__CATALOG_COLLECTION_TITLE__/g, escapeHtml(facetConfig?.collectionTitle || 'Coleção aberta'))
    .replace(/__CATALOG_COLLECTION_DESCRIPTION__/g, escapeHtml(facetConfig?.collectionDescription || 'Escolha uma faixa para entender melhor em que tipo de projeto você está entrando e clicar com mais segurança.'))
    .replace(/__CATALOG_COLLECTION_REASON__/g, escapeHtml(facetConfig?.reason || 'Use esta visão para comparar esforço, tempo e densidade do guia antes de escolher um jogo.'))
    .replace(/__CATALOG_COLLECTION_CHECKLIST__/g, escapeHtml(facetConfig?.checklist || 'Abra a página do jogo para confirmar perdíveis, roadmap e se a lista combina com o seu momento.'))
    .replace(/__CATALOG_SEO_INTRO_TITLE__/g, escapeHtml(facetConfig?.introTitle || 'Pontos de entrada para escolher melhor'))
    .replace(/__CATALOG_SEO_INTRO_BODY__/g, escapeHtml(facetConfig?.introBody || 'Esta coleção ajuda a comparar jogos antes do clique, com tempo, dificuldade, roadmap e riscos em primeiro plano.'))
    .replace(/__INITIAL_STATE_SCRIPT__/g, buildInitialStateScript({
      page: 'catalog',
      facet: facetConfig?.serviceFacet || 'all',
      catalog: { pagination: catalogResponse.pagination, facetCounts }
    })));
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Requested-With, X-Atlas-Auth-Scope');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,PATCH,DELETE');
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
app.locals.sessionStore = sessionStore;

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
app.use('/shared', express.static(path.join(__dirname, 'shared'), {
  index: false,
  etag: true,
  maxAge: env.isProduction ? '7d' : 0,
  setHeaders: (res, filePath) => {
    if (env.isProduction && /\.js$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    }
  }
}));
app.use(express.static(path.join(__dirname, '../public'), {
  index: false,
  etag: true,
  maxAge: env.isProduction ? '7d' : 0,
  setHeaders: (res, filePath) => {
    if (env.isProduction && /\.(?:css|js|svg|png|jpg|jpeg|webp|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    }
  }
}));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: env.nodeEnv,
    sessionStore: 'sqlite',
    sessionMaxAgeHours: env.sessionMaxAgeHours
  });
});

app.get('/favicon.ico', (req, res) => {
  res.setHeader('Cache-Control', env.isProduction ? 'public, max-age=604800, stale-while-revalidate=86400' : 'no-cache');
  res.redirect(302, '/favicon.svg');
});

app.get('/robots.txt', (req, res) => {
  const sitemapUrl = buildPublicUrl(req, '/sitemap.xml');
  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /biblioteca',
    'Disallow: /perfil',
    `Sitemap: ${sitemapUrl}`,
    ''
  ].join('\n'));
});

app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const allGames = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await gamesService.listGames({ page, limit: 100, sort: 'updated-desc' });
      allGames.push(...(response.items || []));
      totalPages = Number(response.pagination?.totalPages || 1);
      page += 1;
    } while (page <= totalPages);

    const facetCounts = await gamesService.getCatalogFacetCounts();
    const facetUrls = Object.entries(catalogFacetPageMap)
      .filter(([facetSlug]) => facetSlug !== 'all')
      .filter(([, facet]) => getCatalogFacetCount(facet, facetCounts) > 0)
      .map(([, facet]) => ({
        loc: buildPublicUrl(req, facet.path),
        lastmod: new Date().toISOString()
      }));
    const editorialUrls = Object.values(editorialCollectionPageMap)
      .map(item => ({ loc: buildPublicUrl(req, item.path), lastmod: new Date().toISOString() }));

    const urls = [
      { loc: buildPublicUrl(req, '/'), lastmod: new Date().toISOString() },
      { loc: buildPublicUrl(req, '/catalogo'), lastmod: new Date().toISOString() },
      ...facetUrls,
      ...editorialUrls,
      ...allGames.map(game => ({
        loc: buildPublicUrl(req, `/jogo/${game.slug}`),
        lastmod: game.updated_at || game.created_at || new Date().toISOString()
      }))
    ];
    const uniqueUrls = Array.from(new Map(urls.map(item => [item.loc, item])).values());

    res.type('application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueUrls.map(item => `  <url><loc>${escapeXml(item.loc)}</loc><lastmod>${escapeXml(new Date(item.lastmod).toISOString())}</lastmod></url>`).join('\n')}\n</urlset>`);
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth/login', loginRateLimit);
app.use('/api/auth/register', registerRateLimit);
app.use('/api/auth', authRoutes);
app.use('/api/me', requireCsrf, meRoutes);
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

app.get('/catalogo/:facetSlug', async (req, res, next) => {
  const { facetSlug } = req.params;
  if (!catalogFacetPageMap[facetSlug]) {
    return next();
  }

  try {
    return res.send(await buildCatalogPageHtml(req, facetSlug));
  } catch (error) {
    return next(error);
  }
});


app.get('/colecoes/:collectionSlug', async (req, res, next) => {
  const { collectionSlug } = req.params;
  if (!editorialCollectionPageMap[collectionSlug]) {
    return next();
  }

  try {
    return res.send(await buildEditorialCollectionPageHtml(req, collectionSlug));
  } catch (error) {
    return next(error);
  }
});

app.get('/jogo/:slug', async (req, res, next) => {
  try {
    const game = await gamesService.getGameBySlug(req.params.slug);

    if (game.redirect_required && game.canonical_slug && game.canonical_slug !== req.params.slug) {
      return res.redirect(301, `/jogo/${game.canonical_slug}`);
    }

    res.send(await buildGamePageHtml(game, req));
  } catch (error) {
    next(error);
  }
});

app.get('/biblioteca', async (req, res, next) => {
  try {
    res.setHeader('X-Robots-Tag', 'noindex, follow');
    res.send(await buildStaticPublicPageHtml(req, {
      view: 'library',
      path: '/biblioteca',
      title: 'Biblioteca - AtlasAchievement',
      description: 'Acompanhe jogos salvos, progresso de troféus e próximos passos na sua biblioteca do AtlasAchievement sem expor dados do usuário.'
    }));
  } catch (error) {
    next(error);
  }
});

app.get('/perfil', async (req, res, next) => {
  try {
    res.setHeader('X-Robots-Tag', 'noindex, follow');
    res.send(await buildStaticPublicPageHtml(req, {
      view: 'profile',
      path: '/perfil',
      title: 'Perfil - AtlasAchievement',
      description: 'Veja e edite seu perfil público no AtlasAchievement sem expor dados sensíveis no HTML inicial.'
    }));
  } catch (error) {
    next(error);
  }
});

app.get('/', async (req, res, next) => {
  try {
    res.send(await buildDefaultPageHtml(req));
  } catch (error) {
    next(error);
  }
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
