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

const app = express();
const publicIndexPath = path.join(__dirname, '../public/index.html');
const publicIndexTemplate = fs.readFileSync(publicIndexPath, 'utf8');
const catalogFacetPageMap = {
  'dificuldade-baixa': {
    title: 'Jogos de dificuldade baixa | AtlasAchievement',
    description: 'Veja jogos com dificuldade de 1 a 3 para começar listas de troféus e concluir mais rápido.',
    name: 'Jogos de dificuldade baixa'
  },
  'dificuldade-media': {
    title: 'Jogos de dificuldade média | AtlasAchievement',
    description: 'Explore jogos com dificuldade de 4 a 6 e escolha projetos intermediários para continuar.',
    name: 'Jogos de dificuldade média'
  },
  'dificuldade-alta': {
    title: 'Jogos de dificuldade alta | AtlasAchievement',
    description: 'Encontre jogos com dificuldade de 7 a 10 para quem busca listas mais exigentes.',
    name: 'Jogos de dificuldade alta'
  },
  'ate-15-horas': {
    title: 'Jogos até 15 horas | AtlasAchievement',
    description: 'Veja jogos com tempo estimado mais curto para concluir troféus em até 15 horas.',
    name: 'Jogos até 15 horas'
  },
  '16-a-40-horas': {
    title: 'Jogos de 16 a 40 horas | AtlasAchievement',
    description: 'Encontre jogos com tempo estimado de 16 a 40 horas para projetos de médio prazo.',
    name: 'Jogos de 16 a 40 horas'
  },
  'mais-de-40-horas': {
    title: 'Jogos com mais de 40 horas | AtlasAchievement',
    description: 'Navegue por jogos longos e maratonas com listas de troféus acima de 40 horas.',
    name: 'Jogos com mais de 40 horas'
  },
  'ate-30-trofeus': {
    title: 'Jogos com até 30 troféus | AtlasAchievement',
    description: 'Abra listas menores, com até 30 troféus, para organizar checklists mais curtos.',
    name: 'Jogos com até 30 troféus'
  },
  '31-a-60-trofeus': {
    title: 'Jogos com 31 a 60 troféus | AtlasAchievement',
    description: 'Explore jogos com listas intermediárias de 31 a 60 troféus.',
    name: 'Jogos com 31 a 60 troféus'
  },
  'mais-de-60-trofeus': {
    title: 'Jogos com mais de 60 troféus | AtlasAchievement',
    description: 'Veja jogos com listas longas, acima de 60 troféus, para acompanhar por etapas.',
    name: 'Jogos com mais de 60 troféus'
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
          <p class="text-sm text-white/65 mt-2 ${spoilerClasses}" ${trophy.is_spoiler ? 'data-spoiler="true"' : ''}>${escapeHtml(description || 'Sem descrição.')}</p>
          ${tip ? `<div class="atlas-tip-box mt-4"><div class="text-xs uppercase tracking-wide text-cyan-200/75">Dica</div><p class="text-sm text-cyan-50/85 mt-2 ${spoilerClasses}" ${trophy.is_spoiler ? 'data-spoiler="true"' : ''}>${escapeHtml(tip)}</p></div>` : ''}
        </div>
        <div class="md:w-auto shrink-0">
          <button type="button" class="atlas-btn ${done ? 'atlas-btn-secondary' : 'atlas-btn-primary'}" data-trophy-toggle="${escapeHtml(trophy.id || '')}">${done ? 'Desmarcar' : 'Marcar como concluído'}</button>
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
    image: game?.image || 'https://via.placeholder.com/900x520?text=Sem+Capa',
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
            <img src="${escapeHtml(viewModel.image)}" alt="${escapeHtml(game?.name || 'Jogo')}" class="w-full h-full object-cover">
          </div>
          <div class="min-w-0">
            <div class="atlas-eyebrow">Guia do jogo</div>
            <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight mt-2 break-words">${escapeHtml(game?.name || 'Guia')}</h1>
            <p class="text-white/58 mt-3 max-w-3xl">Dificuldade ${escapeHtml(String(game?.difficulty || '-'))}/10 • ${escapeHtml(game?.time || 'Tempo não informado')} • ${viewModel.total} troféu(s)</p>
            <div class="flex flex-wrap gap-2 mt-4">
              <span class="atlas-tag">Perfil ${escapeHtml(viewModel.difficultyLabel)}</span>
              <span class="atlas-tag">${escapeHtml(game?.time || 'Tempo não informado')}</span>
              <span class="atlas-tag">${viewModel.missables ? `${viewModel.missables} alerta(s)` : 'Sem alerta crítico marcado'}</span>
              <span class="atlas-tag">${escapeHtml(viewModel.breakdownText)}</span>
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

function buildCatalogPageHtml(req, facetSlug = null) {
  const origin = `${req.protocol}://${req.get('host')}`;
  const facetConfig = facetSlug ? catalogFacetPageMap[facetSlug] : null;
  const canonicalPath = facetConfig ? `/catalogo/${facetSlug}` : '/catalogo';
  const canonicalUrl = `${origin}${canonicalPath}`;
  const title = facetConfig?.title || 'Catálogo de jogos | Troféus e guias | AtlasAchievement';
  const description = facetConfig?.description || 'Navegue pelo catálogo de jogos com troféus, dificuldade, tempo estimado e acesso direto às páginas de guia.';

  return applyTemplateDefaults(publicIndexTemplate)
    .replace(/__PAGE_TITLE__/g, escapeHtml(title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(description))
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, `${origin}/og-default.svg`)
    .replace(/__PAGE_JSON_LD__/g, safeJsonForHtml({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: facetConfig?.name || 'Catálogo de jogos',
      url: canonicalUrl,
      description
    }));
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
    const urls = [
      { loc: `${origin}/`, lastmod: new Date().toISOString() },
      { loc: `${origin}/catalogo`, lastmod: new Date().toISOString() },
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
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/catalogo', (req, res) => {
  res.send(buildCatalogPageHtml(req));
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

app.get('*', (req, res) => {
  res.send(buildDefaultPageHtml(req));
});

app.use((error, req, res, next) => {
  if (req.path === '/api/auth/login' && error?.statusCode === 401) {
    registerFailedLoginAttempt(req);
  }

  next(error);
});

app.use(errorHandler);

module.exports = app;
