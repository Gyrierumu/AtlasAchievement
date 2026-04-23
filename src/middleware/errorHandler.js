function buildHtmlErrorPage({ statusCode = 500, title = 'Erro interno', message = 'Ocorreu um erro ao carregar esta página.', requestId = null }) {
  const safeTitle = String(title)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const safeMessage = String(message)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const safeRequestId = requestId
    ? String(requestId)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusCode} | ${safeTitle} | AtlasAchievement</title>
  <meta name="description" content="${safeMessage}">
  <meta name="robots" content="noindex, nofollow">
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body class="atlas-body min-h-screen flex items-center justify-center px-4 py-10" data-page="error">
  <div class="atlas-bg-orb atlas-bg-orb--one"></div>
  <div class="atlas-bg-orb atlas-bg-orb--two"></div>
  <main class="w-full max-w-3xl atlas-panel rounded-[32px] p-8 md:p-12 text-center relative z-10">
    <div class="atlas-eyebrow mb-4">AtlasAchievement</div>
    <div class="text-atlas-300 text-sm font-semibold tracking-[0.28em] uppercase">Erro ${statusCode}</div>
    <h1 class="text-4xl md:text-6xl font-black tracking-tight mt-4">${safeTitle}</h1>
    <p class="text-white/70 text-lg leading-relaxed mt-5 max-w-2xl mx-auto">${safeMessage}</p>
    <div class="mt-8 flex flex-wrap gap-3 justify-center">
      <a href="/" class="atlas-btn atlas-btn-primary">Voltar para a home</a>
      <a href="/catalogo" class="atlas-btn atlas-btn-secondary">Abrir catálogo</a>
    </div>
    ${safeRequestId ? `<p class="text-xs text-white/40 mt-8">Request ID: ${safeRequestId}</p>` : ''}
  </main>
</body>
</html>`;
}

function shouldRenderHtml(req) {
  if (req.path.startsWith('/api/')) return false;
  const accept = req.get('accept') || '';
  return accept.includes('text/html') || accept.includes('*/*') || !accept;
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const message = err.message || 'Erro interno do servidor';

  const payload = {
    error: {
      code,
      message,
      requestId: req.requestId || null
    },
    message,
    requestId: req.requestId || null
  };

  if (err.details) {
    payload.error.details = err.details;
    payload.details = err.details;
  }

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.error.stack = err.stack;
    payload.stack = err.stack;
  }

  if (shouldRenderHtml(req)) {
    const title = statusCode === 404 ? 'Página não encontrada' : 'Erro ao carregar a página';
    res.status(statusCode);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.send(buildHtmlErrorPage({
      statusCode,
      title,
      message,
      requestId: req.requestId || null
    }));
  }

  return res.status(statusCode).json(payload);
}

module.exports = errorHandler;
