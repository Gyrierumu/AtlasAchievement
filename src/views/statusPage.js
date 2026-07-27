function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderStatusPage({
  statusCode,
  eyebrow,
  title,
  message,
  actionLabel = 'Voltar ao início',
  actionHref = '/'
}) {
  const safeStatusCode = Number(statusCode);
  const safeTitle = escapeHtml(title);

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeStatusCode} — ${safeTitle} | AtlasAchievement</title>
  <meta name="description" content="${escapeHtml(message)}">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#07111f">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/site.css">
</head>
<body>
  <main class="status-page">
    <section class="surface status-surface" aria-labelledby="status-title">
      <a class="brand brand--centered" href="/" aria-label="AtlasAchievement — início">
        <img src="/assets/brand/atlasachievement-logo.png" alt="" width="56" height="56">
        <span>AtlasAchievement</span>
      </a>
      <p class="eyebrow">${escapeHtml(eyebrow)} · ${safeStatusCode}</p>
      <h1 id="status-title">${safeTitle}</h1>
      <p class="lede">${escapeHtml(message)}</p>
      <a class="button" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a>
    </section>
  </main>
</body>
</html>`;
}

module.exports = {
  escapeHtml,
  renderStatusPage
};
