'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ROOT,
  RE5_SLUG,
  CANONICAL_ORIGIN,
  countMatches,
  fetchPage,
  withTempApp
} = require('./test-re5-v2-ssr');

function getMeta(html, attribute, value) {
  const pattern = new RegExp(`<meta\\s+${attribute}="${value}"\\s+content="([^"]*)"`, 'i');
  return html.match(pattern)?.[1] || '';
}

async function main() {
  await withTempApp(async ({ baseUrl }) => {
    const page = await fetchPage(baseUrl, `/jogo/${RE5_SLUG}`);
    const html = page.html;
    const expectedTitle = 'Resident Evil 5 — Guia de Platina, Troféus e 100%';
    const expectedDescription = 'Guia de Resident Evil 5 no PS4 e PS5 com rota da platina, 30 emblemas, 50 tesouros, Professional, Versus, Lost in Nightmares e Desperate Escape.';
    const canonical = `${CANONICAL_ORIGIN}/jogo/${RE5_SLUG}`;

    assert.strictEqual(page.response.status, 200);
    assert.strictEqual(countMatches(html, /<title>/g), 1);
    assert.strictEqual(html.match(/<title>([^<]+)<\/title>/)?.[1], expectedTitle);
    assert.strictEqual(countMatches(html, /<meta name="description"/g), 1);
    assert.strictEqual(getMeta(html, 'name', 'description'), expectedDescription);
    assert.strictEqual(countMatches(html, /<link rel="canonical"/g), 1);
    assert.strictEqual(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1], canonical);
    assert(/^https:\/\//.test(canonical));
    assert(!/noindex/i.test(html));

    const ogProperties = [
      'og:type',
      'og:title',
      'og:description',
      'og:url',
      'og:image',
      'og:site_name',
      'og:locale'
    ];
    ogProperties.forEach(property => {
      assert.strictEqual(
        countMatches(html, new RegExp(`<meta property="${property}"`, 'g')),
        1,
        `${property} must be unique`
      );
      assert(getMeta(html, 'property', property), `${property} must have content`);
    });
    assert.strictEqual(getMeta(html, 'property', 'og:type'), 'article');
    assert.strictEqual(getMeta(html, 'property', 'og:locale'), 'pt_BR');
    assert.strictEqual(getMeta(html, 'property', 'og:url'), canonical);

    const twitterNames = [
      'twitter:card',
      'twitter:title',
      'twitter:description',
      'twitter:image',
      'twitter:image:alt'
    ];
    twitterNames.forEach(name => {
      assert.strictEqual(
        countMatches(html, new RegExp(`<meta name="${name}"`, 'g')),
        1,
        `${name} must be unique`
      );
      assert(getMeta(html, 'name', name), `${name} must have content`);
    });
    assert.strictEqual(getMeta(html, 'name', 'twitter:card'), 'summary_large_image');

    const socialImage = getMeta(html, 'property', 'og:image');
    assert(/^https:\/\//.test(socialImage));
    assert.strictEqual(socialImage, getMeta(html, 'name', 'twitter:image'));
    const publicImagePath = path.join(ROOT, 'public', new URL(socialImage).pathname);
    assert(fs.existsSync(publicImagePath), 'Social image must exist in public assets');

    assert.strictEqual(countMatches(html, /<script type="application\/ld\+json"/g), 1);
    const jsonLd = JSON.parse(
      html.match(/<script type="application\/ld\+json" id="gameStructuredData">([\s\S]*?)<\/script>/)?.[1]
    );
    const graph = jsonLd['@graph'];
    const breadcrumbs = graph.find(item => item['@type'] === 'BreadcrumbList');
    const article = graph.find(item => item['@type'] === 'Article');
    const videoGame = graph.find(item => item['@type'] === 'VideoGame');
    assert.deepStrictEqual(
      breadcrumbs.itemListElement.map(item => item.name),
      ['Início', 'Jogos', 'Resident Evil 5']
    );
    assert.strictEqual(breadcrumbs.itemListElement.length, 3);
    assert.strictEqual(article.dateModified, '2026-07-26');
    assert.strictEqual(article.mainEntityOfPage['@id'], canonical);
    assert.strictEqual(article.author['@id'], `${CANONICAL_ORIGIN}/#organization`);
    assert.strictEqual(videoGame.gamePlatform, 'PlayStation 4');
    assert.notStrictEqual(videoGame.gamePlatform, 'PlayStation 5');
    assert(!JSON.stringify(videoGame).includes('"gamePlatform":"PlayStation 5"'));

    assert.strictEqual(
      html.match(/<h1>([^<]+)<\/h1>/)?.[1],
      'Resident Evil 5 — Guia de Platina e 100%'
    );
    assert(!/docs\/imports|file:\/\/|localhost|127\.0\.0\.1|[A-Z]:\\/i.test(html));
    assert(!/\b(?:TODO|TBD)\b|\bundefined\b|>\s*null\s*</.test(html));
  }, { guideV2EnabledSlugs: RE5_SLUG });

  console.log('RE5 V2 SEO contract passed');
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
