'use strict';

function buildGuideStructuredData(viewModel, options = {}) {
  const canonicalUrl = options.canonicalUrl;
  const siteOrigin = options.siteOrigin;
  const imageUrl = options.imageUrl;
  const title = options.title;
  const description = options.description;
  const dateModified = viewModel.review?.reviewedAt || undefined;
  const organizationId = `${siteOrigin}/#organization`;
  const breadcrumbId = `${canonicalUrl}#breadcrumbs`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl,
        url: canonicalUrl,
        name: title,
        description,
        image: imageUrl,
        inLanguage: 'pt-BR',
        mainEntity: { '@id': `${canonicalUrl}#article` },
        breadcrumb: { '@id': breadcrumbId },
        isPartOf: {
          '@type': 'WebSite',
          name: 'AtlasAchievement',
          url: `${siteOrigin}/`
        },
        publisher: { '@id': organizationId }
      },
      {
        '@type': 'Article',
        '@id': `${canonicalUrl}#article`,
        headline: viewModel.seo?.h1 || title,
        description,
        dateModified,
        inLanguage: 'pt-BR',
        mainEntityOfPage: { '@id': canonicalUrl },
        author: { '@id': organizationId },
        publisher: { '@id': organizationId },
        image: {
          '@type': 'ImageObject',
          url: imageUrl,
          width: Number(options.imageWidth || 1200),
          height: Number(options.imageHeight || 630)
        },
        about: { '@id': `${canonicalUrl}#game` },
        isAccessibleForFree: true
      },
      {
        '@type': 'VideoGame',
        '@id': `${canonicalUrl}#game`,
        name: viewModel.game.name,
        description,
        url: canonicalUrl,
        image: imageUrl,
        gamePlatform: 'PlayStation 4'
      },
      {
        '@type': 'BreadcrumbList',
        '@id': breadcrumbId,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Início',
            item: `${siteOrigin}/`
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Jogos',
            item: `${siteOrigin}/catalogo`
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: viewModel.game.name,
            item: canonicalUrl
          }
        ]
      },
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'AtlasAchievement',
        url: `${siteOrigin}/`,
        logo: {
          '@type': 'ImageObject',
          url: `${siteOrigin}/assets/brand/atlasachievement-logo.png`
        }
      }
    ]
  };
}

module.exports = {
  buildGuideStructuredData
};
