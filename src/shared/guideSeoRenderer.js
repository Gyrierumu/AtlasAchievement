'use strict';

const { escapeHtml, safeJsonForHtml } = require('./guideHtmlUtils');
const { buildGuideStructuredData } = require('./guideStructuredData');

function normalizeOrigin(value = '') {
  try {
    return new URL(String(value || '')).origin;
  } catch (error) {
    return 'https://atlasachievement.com.br';
  }
}

function buildGuideSeoModel(viewModel, options = {}) {
  const siteOrigin = normalizeOrigin(options.canonicalOrigin);
  const canonicalPath = viewModel.seo?.canonical || `/jogo/${viewModel.game.slug}`;
  const canonicalUrl = new URL(canonicalPath, `${siteOrigin}/`).href;
  const title = `${viewModel.game.name} — Guia de Platina, Troféus e 100%`;
  const description = `Guia de ${viewModel.game.name} no PS4 e PS5 com rota da platina, ${viewModel.collectibles.bsaaEmblems.length} emblemas, ${viewModel.collectibles.treasures.length} tesouros, Professional, Versus, Lost in Nightmares e Desperate Escape.`;
  const imagePath = options.socialImagePath || '/assets/brand/atlasachievement-og.png';
  const imageUrl = new URL(imagePath, `${siteOrigin}/`).href;
  const imageAlt = `${viewModel.game.name} — guia de platina e 100% no AtlasAchievement`;
  const structuredData = buildGuideStructuredData(viewModel, {
    canonicalUrl,
    siteOrigin,
    imageUrl,
    imageWidth: 1200,
    imageHeight: 630,
    title,
    description
  });

  return {
    siteOrigin,
    canonicalUrl,
    title,
    description,
    imageUrl,
    imageAlt,
    structuredData
  };
}

function renderGuideV2Head(viewModel, options = {}) {
  const seo = buildGuideSeoModel(viewModel, options);
  return {
    ...seo,
    html: `<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(seo.title)}</title>
  <meta name="description" content="${escapeHtml(seo.description)}">
  <link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(seo.title)}">
  <meta property="og:description" content="${escapeHtml(seo.description)}">
  <meta property="og:url" content="${escapeHtml(seo.canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(seo.imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(seo.imageAlt)}">
  <meta property="og:site_name" content="AtlasAchievement">
  <meta property="og:locale" content="pt_BR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(seo.title)}">
  <meta name="twitter:description" content="${escapeHtml(seo.description)}">
  <meta name="twitter:image" content="${escapeHtml(seo.imageUrl)}">
  <meta name="twitter:image:alt" content="${escapeHtml(seo.imageAlt)}">
  <script type="application/ld+json" id="gameStructuredData">${safeJsonForHtml(seo.structuredData)}</script>`
  };
}

module.exports = {
  buildGuideSeoModel,
  renderGuideV2Head
};
