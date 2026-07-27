const path = require('path');
const compression = require('compression');
const express = require('express');
const env = require('./config/env');
const securityHeaders = require('./middleware/securityHeaders');
const { renderStatusPage } = require('./views/statusPage');

const publicDirectory = path.join(__dirname, '../public');
const assetDirectory = path.join(publicDirectory, 'assets');
const staticFiles = new Set([
  'apple-touch-icon.png',
  'favicon.png',
  'favicon.svg',
  'icon-192.png',
  'icon-512.png',
  'site.webmanifest'
]);

function sendStatusPage(res, {
  statusCode,
  eyebrow,
  title,
  message,
  actionLabel,
  actionHref
}) {
  res.status(statusCode);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.send(renderStatusPage({
    statusCode,
    eyebrow,
    title,
    message,
    actionLabel,
    actionHref
  }));
}

function buildRobotsText() {
  return [
    'User-agent: *',
    'Allow: /$',
    'Allow: /assets/',
    'Allow: /favicon.svg',
    'Disallow: /',
    `Sitemap: ${env.canonicalOrigin}/sitemap.xml`,
    ''
  ].join('\n');
}

function buildSitemapXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${env.canonicalOrigin}/</loc></url>`,
    '</urlset>',
    ''
  ].join('\n');
}

function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(compression());

  app.use('/assets', express.static(assetDirectory, {
    dotfiles: 'deny',
    etag: true,
    fallthrough: true,
    immutable: true,
    maxAge: '7d'
  }));

  app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(publicDirectory, 'index.html'));
  });

  app.get('/api/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      service: 'atlasachievement',
      database: 'preserved-not-required'
    });
  });

  app.get('/health', (req, res) => {
    res.redirect(308, '/api/health');
  });

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(buildRobotsText());
  });

  app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml').send(buildSitemapXml());
  });

  app.get('/indisponivel', (req, res) => {
    res.setHeader('Retry-After', '3600');
    return sendStatusPage(res, {
      statusCode: 503,
      eyebrow: 'Indisponibilidade temporária',
      title: 'Voltaremos assim que o serviço estiver estável.',
      message: 'O AtlasAchievement está temporariamente indisponível. Tente novamente mais tarde.'
    });
  });

  app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(publicDirectory, 'favicon.png'));
  });

  app.get('/:staticFile', (req, res, next) => {
    if (!staticFiles.has(req.params.staticFile)) return next();
    return res.sendFile(path.join(publicDirectory, req.params.staticFile));
  });

  if (typeof options.beforeNotFound === 'function') {
    options.beforeNotFound(app);
  }

  app.use('/api', (req, res) => {
    res.status(404).json({
      error: {
        code: 'API_NOT_FOUND',
        message: 'Endpoint não disponível.'
      }
    });
  });

  app.use((req, res) => sendStatusPage(res, {
    statusCode: 404,
    eyebrow: 'Página não encontrada',
    title: 'Este caminho não faz parte da nova base.',
    message: 'A página pode ter sido removida durante a reconstrução do AtlasAchievement.'
  }));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Erro interno não tratado:', error);

    if (req.path.startsWith('/api/')) {
      return res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível concluir a solicitação.'
        }
      });
    }

    return sendStatusPage(res, {
      statusCode: 500,
      eyebrow: 'Erro interno',
      title: 'Não foi possível carregar esta página.',
      message: 'Ocorreu um erro inesperado. Tente novamente em alguns instantes.'
    });
  });

  return app;
}

module.exports = {
  app: createApp(),
  buildRobotsText,
  buildSitemapXml,
  createApp
};
