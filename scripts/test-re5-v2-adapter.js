'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const V1_PATH = path.join(__dirname, 'fixtures', 're5', 'v1-legacy.json');
const V2_PATH = path.join(ROOT, 'data', 'guides', 'resident-evil-5.json');
const MANIFEST_PATH = path.join(ROOT, 'data', 'guides', 'manifest.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function characterizeFeatureFlag(env) {
  assert.deepStrictEqual(env.getEnabledGuideV2Slugs(''), []);
  assert.deepStrictEqual(
    env.getEnabledGuideV2Slugs(' Resident-Evil-5, ,RESIDENT-EVIL-5, outro-jogo '),
    ['resident-evil-5', 'outro-jogo']
  );
  assert.strictEqual(env.isGuideV2EnabledForSlug('Resident Evil 5', '*'), false);
  assert.strictEqual(
    env.isGuideV2EnabledForSlug('resident-evil-5', 'outro-jogo,resident-evil-5'),
    true
  );
  assert.strictEqual(env.isGuideV2EnabledForSlug('resident-evil-6', 'resident-evil-5'), false);
}

function assertV2ViewModel(result) {
  assert.strictEqual(result.sourceMode, 'v2');
  assert.strictEqual(result.game.id, 16);
  assert.strictEqual(result.game.slug, 'resident-evil-5');
  assert.strictEqual(result.game.scope, 'platinum-and-100-percent');
  assert.strictEqual(result.versions.length, 2);
  assert.strictEqual(result.versions.filter(item => item.nativeTrophyList).length, 1);
  assert.strictEqual(result.nativeTrophyList.platform, 'PS4');
  assert.strictEqual(result.versions.some(item => (
    item.platform === 'PS5' && item.nativeTrophyList === true
  )), false);
  assert.strictEqual(result.versions.some(item => (
    item.autopopSupported === true || item.upgradeSupported === true
  )), false);

  assert.strictEqual(result.packages.length, 4);
  assert(result.packages.every(pkg => pkg.actualTrophyCount === pkg.expectedTrophyCount));
  assert.strictEqual(result.baseTrophies.length, 51);
  assert.strictEqual(result.additionalTrophies.length, 20);
  assert.strictEqual(result.trophies.all.length, 71);
  assert.strictEqual(result.trophies.base.length, 51);
  assert.deepStrictEqual(
    Object.fromEntries(result.packages.map(pkg => [pkg.packageCode, pkg.trophies.length])),
    {
      base: 51,
      versus: 10,
      'lost-in-nightmares': 5,
      'desperate-escape': 5
    }
  );
  assert.strictEqual(result.progress.platinum.completed, 0);
  assert.strictEqual(result.progress.platinum.total, 51);
  assert.strictEqual(result.progress.platinum.target, 51);
  assert.strictEqual(result.progress.completion.completed, 0);
  assert.strictEqual(result.progress.completion.total, 71);
  assert.strictEqual(result.progress.completion.target, 71);
  assert.strictEqual(result.progress.byPackage.versus.target, 10);

  const domIds = result.trophies.all.map(item => item.domId);
  assert.strictEqual(new Set(domIds).size, 71);
  assert(domIds.every(id => /^[a-z][a-z0-9_-]*$/i.test(id)));
  assert(result.trophies.all.every(item => (
    item.trophyCode
    && item.packageCode
    && Number.isInteger(item.displayOrder)
    && Number.isInteger(item.globalOrder)
    && item.name
    && item.type
    && item.description
    && typeof item.isOnline === 'boolean'
    && typeof item.isCoop === 'boolean'
    && typeof item.isCumulative === 'boolean'
    && typeof item.isMissable === 'boolean'
    && item.category
    && Object.prototype.hasOwnProperty.call(item, 'sourceTrophyCode')
  )));

  assert.strictEqual(result.roadmap.length, 9);
  assert.strictEqual(result.sections.length, 31);
  assert.strictEqual(result.sections.filter(item => item.headingLevel === 1).length, 1);
  assert.strictEqual(new Set(result.sections.map(item => item.sectionCode)).size, 31);
  assert.strictEqual(new Set(result.sections.map(item => item.anchor)).size, 31);
  assert.strictEqual(result.collectibles.bsaaEmblems.length, 30);
  assert.strictEqual(result.collectibles.treasures.length, 50);
  assert.strictEqual(result.collectibles.scoreStars.length, 18);
  assert.strictEqual(result.collectibles.agitators.length, 3);
  assert.strictEqual(result.inventoryRequirements.length, 27);
  assert.strictEqual(result.upgradeRequirements.length, 18);
  assert.strictEqual(result.sources.length, 17);
  assert.strictEqual(result.claims.length, 29);

  assert(result.seo.title);
  assert(result.seo.metaDescription);
  assert.strictEqual(result.seo.canonical, '/jogo/resident-evil-5');
  assert(result.seo.h1);
  assert.strictEqual(result.seo.openGraph.type, 'article');
  assert.strictEqual(result.seo.twitter.card, 'summary');
  assert.strictEqual(result.seo.structuredData['@type'], 'Article');
  assert.strictEqual(result.review.reviewedAt, '2026-07-26');
  assert.strictEqual(result.review.editorialStatus, 'approved');
  assert.strictEqual(result.review.author, null);
  assert.strictEqual(result.review.reviewer, 'atlas-portao-c');
  assert(!result.legacyDlc, 'V2 must not expose legacy DLC checkboxes');
}

function assertLegacyViewModel(result, sourceMode, original) {
  assert.strictEqual(result.sourceMode, sourceMode);
  assert.strictEqual(result.trophies.all.length, 51);
  assert.strictEqual(result.baseTrophies.length, 51);
  assert.strictEqual(result.additionalTrophies.length, 0);
  assert.strictEqual(result.versions.length, 0);
  assert.strictEqual(result.nativeTrophyList, null);
  assert.strictEqual(result.packages.length, 0);
  assert.strictEqual(result.sections.length, 0);
  assert.deepStrictEqual(result.trophies.byPackage, {});
  assert(result.trophies.all.every(item => !item.packageCode));
  assert.strictEqual(result.progress.platinum.target, 51);
  assert.strictEqual(result.progress.completion.target, 51);
  assert.deepStrictEqual(result.legacyDlc, original.legacyDlc);
  assert.deepStrictEqual(result.legacyData.trophies, original.trophies);
}

async function closeDefaultMemoryDatabase() {
  const defaultDatabase = require(path.join(ROOT, 'src', 'db', 'db.js')).db;
  await new Promise((resolve, reject) => {
    defaultDatabase.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function main() {
  const v1 = loadJson(V1_PATH);
  const snapshot = loadJson(V2_PATH);
  const manifest = loadJson(MANIFEST_PATH);

  process.env.DATABASE_PATH = ':memory:';
  delete process.env.GUIDE_V2_ENABLED_SLUGS;

  const env = require(path.join(ROOT, 'src', 'config', 'env.js'));
  const {
    adaptGuideSnapshotV2,
    adaptLegacyGuide
  } = require(path.join(ROOT, 'src', 'shared', 'guideDataAdapter.js'));
  const {
    hashSnapshotPayload,
    validateGuideManifest,
    SOURCE_MODES
  } = require(path.join(ROOT, 'src', 'shared', 'guideSourceResolver.js'));
  const {
    getGuideViewModelBySlug,
    resolveResidentEvil5GuideSource
  } = require(path.join(ROOT, 'src', 'services', 'games.service.js'));

  try {
    characterizeFeatureFlag(env);
    assert.deepStrictEqual(
      SOURCE_MODES,
      ['v2', 'relational-legacy', 'sample-legacy', 'error']
    );
    const manifestEntry = manifest.games.find(item => item.slug === 'resident-evil-5');
    assert.strictEqual(hashSnapshotPayload(snapshot), manifestEntry.payloadHash);
    assert.strictEqual(
      validateGuideManifest(snapshot, manifest, { slug: 'resident-evil-5' }).valid,
      true
    );

    const directV2 = adaptGuideSnapshotV2(snapshot);
    assertV2ViewModel(directV2);
    directV2.trophies.all[0].name = 'mutated view model';
    assert.notStrictEqual(snapshot.trophies[0].name, 'mutated view model');
    const secondV2 = adaptGuideSnapshotV2(snapshot);
    assert.notStrictEqual(secondV2.trophies.all[0].name, 'mutated view model');

    const directLegacy = adaptLegacyGuide(v1, { sourceMode: 'relational-legacy' });
    assertLegacyViewModel(directLegacy, 'relational-legacy', v1);
    directLegacy.trophies.all[0].trophyCode = 'mutated';
    assert.strictEqual(v1.trophies[0].trophyCode, 're5_platinum');
    const secondLegacy = adaptLegacyGuide(v1, { sourceMode: 'relational-legacy' });
    assert.strictEqual(secondLegacy.trophies.all[0].trophyCode, 're5_platinum');

    let legacyReadCount = 0;
    const validV2 = await getGuideViewModelBySlug('resident-evil-5', {
      featureFlagEnabled: true,
      snapshot,
      manifest,
      logger: null,
      loadRelationalLegacy: () => {
        legacyReadCount += 1;
        throw new Error('valid V2 must not load relational legacy data');
      },
      loadSampleLegacy: () => {
        legacyReadCount += 1;
        throw new Error('valid V2 must not load sampleGames RE5 arrays');
      }
    });
    assertV2ViewModel(validV2);
    assert.strictEqual(legacyReadCount, 0);
    assert.strictEqual(validV2.diagnostics.selectionReason, 'valid-v2-snapshot-and-manifest');

    const flagOff = await resolveResidentEvil5GuideSource({
      featureFlagEnabled: false,
      snapshot,
      manifest,
      relationalLegacy: clone(v1),
      sampleLegacy: null,
      logger: null
    });
    assertLegacyViewModel(flagOff, 'relational-legacy', v1);
    assert.strictEqual(flagOff.diagnostics.attemptedV2, false);
    assert.strictEqual(flagOff.diagnostics.featureFlagEnabled, false);

    const missingSnapshotFallback = await resolveResidentEvil5GuideSource({
      featureFlagEnabled: true,
      snapshot: null,
      manifest,
      relationalLegacy: clone(v1),
      sampleLegacy: null,
      logger: null
    });
    assertLegacyViewModel(missingSnapshotFallback, 'relational-legacy', v1);
    assert.strictEqual(
      missingSnapshotFallback.diagnostics.fallback.code,
      'GUIDE_V2_SNAPSHOT_MISSING'
    );
    assert.strictEqual(missingSnapshotFallback.diagnostics.snapshotFound, false);
    assert.strictEqual(missingSnapshotFallback.diagnostics.fallbackUsed, true);
    assert.deepStrictEqual(missingSnapshotFallback.diagnostics.warnings, [{
      code: 'GUIDE_V2_FALLBACK',
      reason: 'GUIDE_V2_SNAPSHOT_MISSING'
    }]);

    const invalidSnapshot = clone(snapshot);
    invalidSnapshot.trophyPackages[1].expectedTrophyCount = 9;
    const structuredLogs = [];
    const invalidSnapshotFallback = await resolveResidentEvil5GuideSource({
      featureFlagEnabled: true,
      snapshot: invalidSnapshot,
      manifest,
      relationalLegacy: clone(v1),
      sampleLegacy: null,
      logger: {
        warn(event) {
          structuredLogs.push(event);
        }
      }
    });
    assertLegacyViewModel(invalidSnapshotFallback, 'relational-legacy', v1);
    assert.strictEqual(
      invalidSnapshotFallback.diagnostics.fallback.code,
      'GUIDE_V2_SNAPSHOT_INVALID'
    );
    assert(structuredLogs.some(event => event.event === 'guide_v2_invalid_snapshot'));
    assert(structuredLogs.some(event => event.event === 'guide_v2_fallback'));
    assert(structuredLogs.every(event => (
      event.slug === 'resident-evil-5'
      && event.reasonCode
      && event.featureFlagEnabled === true
      && Object.prototype.hasOwnProperty.call(event, 'snapshotHash')
    )));

    const invalidManifest = clone(manifest);
    invalidManifest.games.find(item => item.slug === 'resident-evil-5').payloadHash = '0'.repeat(64);
    const manifestFallback = await resolveResidentEvil5GuideSource({
      featureFlagEnabled: true,
      snapshot,
      manifest: invalidManifest,
      relationalLegacy: null,
      sampleLegacy: clone(v1),
      logger: null
    });
    assertLegacyViewModel(manifestFallback, 'sample-legacy', v1);
    assert.strictEqual(manifestFallback.diagnostics.fallback.code, 'GUIDE_V2_MANIFEST_INVALID');

    const adapterFailureFallback = await resolveResidentEvil5GuideSource({
      featureFlagEnabled: true,
      snapshot,
      manifest,
      relationalLegacy: clone(v1),
      sampleLegacy: null,
      logger: null,
      validateV2Candidate: () => {
        const error = new Error('forced adapter failure');
        error.code = 'FORCED_ADAPTER_FAILURE';
        throw error;
      }
    });
    assertLegacyViewModel(adapterFailureFallback, 'relational-legacy', v1);
    assert.strictEqual(adapterFailureFallback.diagnostics.fallback.code, 'FORCED_ADAPTER_FAILURE');

    const errorResult = await resolveResidentEvil5GuideSource({
      featureFlagEnabled: true,
      snapshot: null,
      manifest: null,
      relationalLegacy: null,
      sampleLegacy: null,
      logger: null
    });
    assert.strictEqual(errorResult.sourceMode, 'error');
    assert.strictEqual(errorResult.trophies.all.length, 0);
    assert.strictEqual(errorResult.diagnostics.selectionReason, 'no-guide-source-available');

    process.env.GUIDE_V2_ENABLED_SLUGS = 'resident-evil-5';
    const envEnabledResult = await resolveResidentEvil5GuideSource({
      relationalLegacy: null,
      sampleLegacy: null,
      logger: null
    });
    assert.strictEqual(envEnabledResult.sourceMode, 'v2');

    process.env.GUIDE_V2_ENABLED_SLUGS = 'resident-evil-6';
    const envDisabledResult = await resolveResidentEvil5GuideSource({
      snapshot,
      manifest,
      relationalLegacy: clone(v1),
      sampleLegacy: null,
      logger: null
    });
    assert.strictEqual(envDisabledResult.sourceMode, 'relational-legacy');
    console.log('RE5 V2 adapter contract passed');
  } finally {
    delete process.env.GUIDE_V2_ENABLED_SLUGS;
    await closeDefaultMemoryDatabase();
  }
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
