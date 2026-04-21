const fs = require('fs');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const requestContext = require('./middleware/requestContext');
const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const gamesRoutes = require('./routes/games.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const errorHandler = require('./middleware/errorHandler');
const gamesService = require('./services/games.service');
const { loginRateLimit, registerFailedLoginAttempt, clearLoginRateLimit } = require('./middleware/loginRateLimit');

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

  return publicIndexTemplate
    .replace(/__PAGE_TITLE__/g, escapeHtml(title))
    .replace(/__PAGE_DESCRIPTION__/g, escapeHtml(description))
    .replace(/__PAGE_CANONICAL__/g, escapeHtml(canonicalUrl))
    .replace(/__PAGE_OG_IMAGE__/g, escapeHtml(image))
.replace(/__PAGE_JSON_LD__/g, structuredData);
}

function buildDefaultPageHtml(req) {
  const origin = `${req.protocol}://${req.get('host')}`;
  return publicIndexTemplate
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

  return publicIndexTemplate
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

app.use(requestContext);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'mtg.sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: env.isProduction ? 'none' : 'lax',
    secure: env.isProduction,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use('/uploads', express.static(env.uploadDir));
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: env.nodeEnv
  });
});

app.use('/api/auth/login', loginRateLimit);
app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/games', gamesRoutes);

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
