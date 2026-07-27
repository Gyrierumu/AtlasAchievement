'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = path.join(ROOT, 'data', 'guides', 'resident-evil-5.json');
const MANIFEST_PATH = path.join(ROOT, 'data', 'guides', 'manifest.json');
const DATABASE_PATH = path.join(ROOT, 'database.sqlite');
const EXPECTED_HASH = 'ee4207786ae29cc4667de602a1a9dc0381c4dd1473d6202d3d6dace9f9ce5598';
const EXPECTED_PACKAGES = Object.freeze({
  base: 51,
  versus: 10,
  'lost-in-nightmares': 5,
  'desperate-escape': 5
});
const EXPECTED_TYPES = Object.freeze({
  Platina: 1,
  Ouro: 1,
  Prata: 16,
  Bronze: 53
});
const PRODUCTION_ORIGIN = 'https://atlasachievement.com.br';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function countMatches(value, pattern) {
  return (String(value || '').match(pattern) || []).length;
}

function countBy(values, key) {
  return values.reduce((counts, item) => {
    const value = item[key];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function parseArgs(argv) {
  return Object.fromEntries(argv.map(argument => {
    const match = String(argument).match(/^--([a-z0-9-]+)=(.*)$/i);
    return match ? [match[1], match[2]] : [String(argument), true];
  }));
}

function assertExactCounts(actual, expected, label) {
  assert.deepStrictEqual(
    Object.fromEntries(Object.keys(expected).map(key => [key, actual[key] || 0])),
    expected,
    `${label} counts must match the approved release contract`
  );
}

function assertNoPublicationLeaks(label, value) {
  const text = String(value || '');
  const checks = [
    [/[A-Za-z]:\\(?:Users|Downloads)\\/i, 'Windows local path'],
    [/(?:^|[/"'])\/(?:Users|home)\//i, 'local home path'],
    [/\bfile:\/\//i, 'file URL'],
    [/\b(?:localhost|127\.0\.0\.1)\b/i, 'local host'],
    [/\b(?:TODO|TBD|FIXME)\b/, 'placeholder']
  ];
  checks.forEach(([pattern, name]) => {
    assert(!pattern.test(text), `${label} contains ${name}`);
  });
}

function inspectDatabase(args) {
  if (!fs.existsSync(DATABASE_PATH)) {
    return { present: false };
  }
  const stat = fs.statSync(DATABASE_PATH);
  const digest = sha256(fs.readFileSync(DATABASE_PATH));
  const result = {
    present: true,
    sha256: digest,
    bytes: stat.size,
    mtimeUtc: stat.mtime.toISOString(),
    wal: fs.existsSync(`${DATABASE_PATH}-wal`),
    journal: fs.existsSync(`${DATABASE_PATH}-journal`),
    shm: fs.existsSync(`${DATABASE_PATH}-shm`)
  };
  if (args['database-sha256']) {
    assert.strictEqual(digest, String(args['database-sha256']).toLowerCase(), 'real database SHA-256 changed');
  }
  if (args['database-size']) {
    assert.strictEqual(stat.size, Number(args['database-size']), 'real database size changed');
  }
  if (args['database-mtime']) {
    assert.strictEqual(result.mtimeUtc, args['database-mtime'], 'real database mtime changed');
  }
  assert.strictEqual(result.wal, false, 'real database WAL must be absent');
  assert.strictEqual(result.journal, false, 'real database journal must be absent');
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshotRaw = fs.readFileSync(SNAPSHOT_PATH);
  const manifestRaw = fs.readFileSync(MANIFEST_PATH);
  const snapshot = JSON.parse(snapshotRaw.toString('utf8'));
  const manifest = JSON.parse(manifestRaw.toString('utf8'));
  const {
    findManifestEntry,
    hashSnapshotPayload,
    validateGuideManifest
  } = require('../src/shared/guideSourceResolver');
  const { adaptGuideSnapshotV2 } = require('../src/shared/guideDataAdapter');
  const { renderGuideV2Page } = require('../src/shared/guideRendererV2');
  const { buildGuideSeoModel } = require('../src/shared/guideSeoRenderer');
  const env = require('../src/config/env');
  const progressClient = require('../public/js/guide-progress-v2');

  const semanticHash = hashSnapshotPayload(snapshot);
  assert.strictEqual(semanticHash, EXPECTED_HASH, 'Snapshot semantic hash changed');
  const manifestValidation = validateGuideManifest(snapshot, manifest, {
    slug: 'resident-evil-5',
    sourcePath: 'data/guides/resident-evil-5.json'
  });
  assert.strictEqual(manifestValidation.valid, true, JSON.stringify(manifestValidation.errors));
  const manifestEntry = findManifestEntry(manifest, 'resident-evil-5');
  assert(manifestEntry, 'RE5 manifest entry is missing');
  assert.strictEqual(manifestEntry.schemaVersion, 2);
  assert.strictEqual(manifestEntry.payloadHash, EXPECTED_HASH);
  assert.strictEqual(manifestEntry.reviewedAt, '2026-07-26');
  assert.strictEqual(manifestEntry.trophyCount, 71);
  assertExactCounts(manifestEntry.packageCounts, EXPECTED_PACKAGES, 'Manifest');

  assert.strictEqual(snapshot.schemaVersion, 2);
  assert.strictEqual(snapshot.game.slug, 'resident-evil-5');
  assert.strictEqual(snapshot.review.reviewedAt, '2026-07-26');
  assert.strictEqual(snapshot.trophies.length, 71);
  assert.strictEqual(snapshot.trophyPackages.length, 4);
  assert.strictEqual(snapshot.roadmap.length, 9);
  assert.strictEqual(snapshot.guideContent.length, 31);
  assert.strictEqual(snapshot.sources.length, 17);
  assert.strictEqual(snapshot.claims.length, 29);
  assertExactCounts(countBy(snapshot.trophies, 'packageCode'), EXPECTED_PACKAGES, 'Snapshot');
  assertExactCounts(countBy(snapshot.trophies, 'type'), EXPECTED_TYPES, 'Snapshot trophy type');

  const snapshotCodes = snapshot.trophies.map(item => String(item.trophyCode || '').trim());
  assert.strictEqual(new Set(snapshotCodes).size, 71, 'Snapshot trophy codes must be unique');
  assert(snapshotCodes.every(Boolean), 'Snapshot trophy codes must not be empty');
  assert(snapshot.trophies.every(item => String(item.method || '').trim()), 'Every trophy needs an actionable method');
  assert(snapshot.trophies.every(item => String(item.stageCode || '').trim()), 'Every trophy needs a roadmap stage');
  const stageCodes = new Set(snapshot.roadmap.map(item => item.stageCode));
  assert(snapshot.trophies.every(item => stageCodes.has(item.stageCode)), 'Every trophy stage must exist');
  assert(snapshot.guideContent.every(item => String(item.content || '').trim()), 'Public sections cannot be empty');
  assert(snapshot.trophyPackages.filter(item => item.countsForPlatinum).every(item => item.packageCode === 'base'));
  assert(snapshot.trophyPackages.filter(item => item.packageCode !== 'base').every(item => !item.countsForPlatinum));
  assert.strictEqual(snapshot.versions.length, 2);
  assert.strictEqual(snapshot.versions.filter(item => item.nativeTrophyList).length, 1);
  assert.strictEqual(snapshot.versions.find(item => item.nativeTrophyList).platform, 'PS4');
  assert(snapshot.versions.some(item => (
    item.platform === 'PS5'
    && item.isNative === false
    && item.nativeTrophyList === false
    && item.releaseKind === 'backward_compatibility'
  )));

  const viewModel = adaptGuideSnapshotV2(snapshot, {
    diagnostics: { snapshotHash: semanticHash }
  });
  assert.strictEqual(viewModel.sourceMode, 'v2');
  assert.strictEqual(viewModel.trophies.all.length, 71);
  assertExactCounts(countBy(viewModel.trophies.all, 'packageCode'), EXPECTED_PACKAGES, 'View model');
  assertExactCounts(countBy(viewModel.trophies.all, 'type'), EXPECTED_TYPES, 'View model trophy type');

  const html = renderGuideV2Page(viewModel, {
    canonicalOrigin: PRODUCTION_ORIGIN,
    socialImagePath: '/assets/guides/resident-evil-5/resident-evil-5-social.png',
    stylesheetHref: '/css/guide-v2.css'
  });
  assert.strictEqual(countMatches(html, /data-v2-trophy(?:\s|>)/g), 71);
  assert.strictEqual(countMatches(html, /data-guide-progress-checkbox/g), 71);
  assert.strictEqual(countMatches(html, /type="checkbox"/g), 71);
  assert.strictEqual(countMatches(html, /role="progressbar"/g), 5);
  assert.strictEqual(countMatches(html, /data-v2-package(?:\s|>)/g), 4);
  assert.strictEqual(countMatches(html, /data-guide-progress-reset-package=/g), 4);
  assert.strictEqual(countMatches(html, /data-guide-progress-reset-all/g), 1);
  assert.strictEqual(countMatches(html, /data-guide-progress-live/g), 1);
  assert.strictEqual(countMatches(html, /<h1\b/g), 1);

  const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.strictEqual(new Set(htmlIds).size, htmlIds.length, 'All DOM ids must be unique');
  const trophyIds = [...html.matchAll(/<li id="(trophy-[^"]+)"[^>]*data-v2-trophy/g)]
    .map(match => match[1]);
  const checkboxIds = [...html.matchAll(/<input id="(guide-progress-[^"]+)"[^>]*data-guide-progress-checkbox/g)]
    .map(match => match[1]);
  const checkboxCodes = [...html.matchAll(/data-guide-progress-checkbox[^>]*data-trophy-code="([^"]+)"/g)]
    .map(match => match[1]);
  const progressLabels = [...html.matchAll(/<label for="(guide-progress-[^"]+)"/g)]
    .map(match => match[1]);
  assert.strictEqual(trophyIds.length, 71);
  assert.strictEqual(new Set(trophyIds).size, 71);
  assert.strictEqual(checkboxIds.length, 71);
  assert.strictEqual(new Set(checkboxIds).size, 71);
  assert.strictEqual(progressLabels.length, 71);
  assert(progressLabels.every(id => checkboxIds.includes(id)), 'Every progress label must target a checkbox');
  assert.deepStrictEqual([...checkboxCodes].sort(), [...snapshotCodes].sort());

  const trophyLinks = [...html.matchAll(/href="#(trophy-[^"]+)"/g)].map(match => match[1]);
  assert(trophyLinks.every(id => trophyIds.includes(id)), 'Every trophy link must resolve to an SSR id');
  assert(!/href="javascript:/i.test(html), 'Rendered links must not use javascript:');
  assert.strictEqual(countMatches(html, /<script\b[^>]*\bsrc="/g), 2);
  assert(html.includes('<script src="/js/guide-progress-v2.js" defer></script>'));
  assert(html.includes('<script src="/js/re5-guide-progress-v2.js" defer></script>'));
  assert(!html.includes('re5-guide-enhance.b84f913c.js'));
  assert.strictEqual(progressClient.EXPECTED_TROPHY_COUNT, 71);
  assert.strictEqual(progressClient.EVENT_NAMES.length, 9);
  assert.strictEqual(new Set(progressClient.EVENT_NAMES).size, 9);

  const seo = buildGuideSeoModel(viewModel, { canonicalOrigin: PRODUCTION_ORIGIN });
  assert.strictEqual(seo.canonicalUrl, `${PRODUCTION_ORIGIN}/jogo/resident-evil-5`);
  assert(!seo.canonicalUrl.includes('localhost'));
  assert.strictEqual(seo.structuredData['@graph'].find(item => item['@type'] === 'VideoGame').gamePlatform, 'PlayStation 4');
  assert.strictEqual(seo.structuredData['@graph'].find(item => item['@type'] === 'Article').dateModified, '2026-07-26');
  assert(seo.structuredData['@graph'].some(item => item['@type'] === 'BreadcrumbList'));
  assert(!/<meta[^>]+noindex/i.test(html));
  assert.strictEqual(env.getEnabledGuideV2Slugs('').length, 0);
  assert.strictEqual(env.isGuideV2EnabledForSlug('resident-evil-5', ''), false);

  const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert(/^GUIDE_V2_ENABLED_SLUGS=\s*$/m.test(envExample), 'Feature flag must remain disabled by default');
  const clientSource = fs.readFileSync(path.join(ROOT, 'public', 'js', 'guide-progress-v2.js'), 'utf8');
  assert(!/\beval\s*\(/.test(clientSource), 'Client must not use eval');
  assert(!/\.innerHTML\s*=/.test(clientSource), 'Client must not assign innerHTML');
  assertNoPublicationLeaks('Snapshot', snapshotRaw.toString('utf8'));
  assertNoPublicationLeaks('Rendered HTML', html);

  const database = inspectDatabase(args);
  const report = {
    semanticHash,
    fileHashes: {
      snapshot: sha256(snapshotRaw),
      manifest: sha256(manifestRaw)
    },
    counts: {
      snapshot: { total: 71, ...countBy(snapshot.trophies, 'packageCode') },
      manifest: { total: manifestEntry.trophyCount, ...manifestEntry.packageCounts },
      viewModel: { total: viewModel.trophies.all.length, ...countBy(viewModel.trophies.all, 'packageCode') },
      ssr: {
        total: trophyIds.length,
        ...countBy(viewModel.trophies.all, 'packageCode')
      },
      clientAllowlist: checkboxCodes.length
    },
    trophyTypes: countBy(snapshot.trophies, 'type'),
    versions: snapshot.versions.map(item => ({
      platform: item.platform,
      native: item.isNative,
      nativeTrophyList: item.nativeTrophyList,
      releaseKind: item.releaseKind
    })),
    html: {
      bytes: Buffer.byteLength(html),
      ids: htmlIds.length,
      checkboxes: checkboxIds.length,
      labels: progressLabels.length,
      trophyLinks: trophyLinks.length,
      scripts: 2,
      progressbars: 5
    },
    featureFlagDefault: false,
    database
  };
  console.log(JSON.stringify(report, null, 2));
  console.log('RE5 V2 read-only release audit passed');
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
}
