'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ROOT,
  RE5_SLUG,
  countMatches,
  fetchPage,
  withTempApp
} = require('./test-re5-v2-ssr');

function stripTags(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  await withTempApp(async ({ baseUrl }) => {
    const page = await fetchPage(baseUrl, `/jogo/${RE5_SLUG}`);
    const html = page.html;

    assert.strictEqual(page.response.status, 200);
    assert.strictEqual(countMatches(html, /<h1\b/g), 1);
    assert.strictEqual(countMatches(html, /<main\b/g), 1);
    assert.strictEqual(countMatches(html, /<article\b/g), 1);

    const headingLevels = [...html.matchAll(/<h([1-6])\b[^>]*>/g)]
      .map(match => Number(match[1]));
    assert.strictEqual(headingLevels[0], 1);
    headingLevels.slice(1).forEach((level, index) => {
      assert(
        level <= headingLevels[index] + 1,
        `Heading jump from H${headingLevels[index]} to H${level}`
      );
    });

    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.strictEqual(new Set(ids).size, ids.length, 'Every id must be unique');
    assert(ids.every(Boolean), 'No id may be empty');
    const trophyIds = ids.filter(id => id.startsWith('trophy-') && !id.endsWith('-status'));
    assert.strictEqual(trophyIds.length, 71);

    const internalTargets = [...html.matchAll(/<a\b[^>]*href="#([^"]+)"/g)]
      .map(match => match[1]);
    assert(internalTargets.length > 30);
    internalTargets.forEach(target => {
      assert(ids.includes(target), `Internal link #${target} must resolve`);
    });

    assert(/<nav class="guide-v2-index[^"]*" aria-label="Índice do guia">/.test(html));
    assert(/<a class="guide-v2-skip-link" href="#conteudo-principal">/.test(html));
    assert.strictEqual(countMatches(html, /data-v2-section=/g), 31);

    const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/g)].map(match => match[0]);
    assert(tables.length > 0);
    tables.forEach(table => {
      assert(/<caption>[\s\S]+?<\/caption>/.test(table), 'Tables must have captions');
      assert(/<th\b[^>]*scope="(?:col|row)"/.test(table), 'Tables must have scoped headers');
    });

    const images = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
    assert(images.length > 0);
    images.forEach(image => {
      const alt = image.match(/\balt="([^"]*)"/)?.[1];
      assert(alt && alt.trim(), 'Every image must have non-empty alt text');
    });

    const anchors = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)]
      .map(match => stripTags(match[1]));
    assert(anchors.every(Boolean), 'No link may have an empty accessible label');
    assert.strictEqual(countMatches(html, /<button\b/g), 5);
    assert(!/href="javascript:/i.test(html));
    assert.strictEqual(countMatches(html, /type="checkbox"/g), 71);
    assert.strictEqual(countMatches(html, /data-guide-progress-checkbox/g), 71);
    assert.strictEqual(countMatches(html, /role="progressbar"/g), 5);
    assert.strictEqual(countMatches(html, /aria-valuemin="0"/g), 5);
    assert.strictEqual(countMatches(html, /data-guide-progress-live/g), 1);
    assert.strictEqual(countMatches(html, /aria-live="polite"/g), 1);
    assert.strictEqual(countMatches(html, /<script\b[^>]*\bsrc=/g), 2);

    const checkboxIds = [...html.matchAll(/<input id="([^"]+)" type="checkbox"/g)]
      .map(match => match[1]);
    const labelFors = [...html.matchAll(/<label for="([^"]+)"/g)]
      .map(match => match[1]);
    assert.strictEqual(checkboxIds.length, 71);
    assert.strictEqual(new Set(checkboxIds).size, 71);
    assert.deepStrictEqual(new Set(labelFors), new Set(checkboxIds));

    [
      'Resident Evil 5',
      'Roadmap',
      'Jogo-base',
      'Versus',
      'Lost in Nightmares',
      'Desperate Escape',
      'BSAA Emblem 30/30',
      '50/50 — Heart of Africa',
      'Score Star 18/18',
      'Agitator 3',
      'Fontes',
      'Revisão editorial'
    ].forEach(text => assert(html.includes(text), `Initial HTML must include ${text}`));

    const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'guide-v2.css'), 'utf8');
    assert(css.includes('.guide-v2-page'));
    assert(css.includes('.guide-v2-table-wrap'));
    assert(css.includes('max-width: 100%'));
    assert(css.includes('overflow-x: auto'));
    assert(css.includes('overflow-wrap: anywhere'));

    const responsiveProfiles = [
      { width: 360, mediaQueries: ['max-width: 30rem'] },
      { width: 768, mediaQueries: ['min-width: 48rem'] },
      { width: 1024, mediaQueries: ['min-width: 48rem', 'min-width: 64rem'] },
      {
        width: 1440,
        mediaQueries: ['min-width: 48rem', 'min-width: 64rem', 'min-width: 90rem']
      }
    ];
    responsiveProfiles.forEach(({ width, mediaQueries }) => {
      mediaQueries.forEach(mediaQuery => {
        assert(
          css.includes(`@media (${mediaQuery})`),
          `CSS must cover the ${width}px viewport with ${mediaQuery}`
        );
      });
    });
    assert(css.includes('prefers-reduced-motion'));
  }, { guideV2EnabledSlugs: RE5_SLUG });

  console.log('RE5 V2 structural accessibility contract passed');
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
