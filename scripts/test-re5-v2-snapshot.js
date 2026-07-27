'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 're5', 'v2-minimal.json');
const CANONICAL_PATH = path.join(ROOT, 'data', 'guides', 'resident-evil-5.json');
const VALIDATOR_PATH = path.join(ROOT, 'src', 'validators', 'guideSnapshotV2.validator.js');
const REQUIRED_BLOCKS = [
  'game',
  'versions',
  'trophyPackages',
  'trophies',
  'roadmap',
  'guideContent',
  'collectibles',
  'inventoryRequirements',
  'upgradeRequirements',
  'economy',
  'online',
  'sources',
  'claims',
  'seo',
  'review',
  'redirects'
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function assertNoEmptyIdentity(value, trail = 'snapshot') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoEmptyIdentity(item, `${trail}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    const isIdentity = key === 'id' || key === 'code' || key.endsWith('Code');
    if (isIdentity && typeof child === 'string') {
      assert.notStrictEqual(child.trim(), '', `${trail}.${key} must not be empty`);
    }
    assertNoEmptyIdentity(child, `${trail}.${key}`);
  }
}

function characterizeFixture(snapshot) {
  assert.strictEqual(snapshot.schemaVersion, 2);
  assert.strictEqual(snapshot.game.id, 16);
  assert.strictEqual(snapshot.game.slug, 'resident-evil-5');
  for (const block of REQUIRED_BLOCKS) {
    assert(Object.prototype.hasOwnProperty.call(snapshot, block), `fixture is missing ${block}`);
  }

  assert.deepStrictEqual(
    snapshot.versions.map(item => item.versionCode),
    ['ps4-native', 'ps5-backcompat-ps4']
  );
  assert.deepStrictEqual(
    snapshot.trophyPackages.map(item => item.packageCode),
    ['base', 'versus', 'lost-in-nightmares', 'desperate-escape']
  );
  assert.strictEqual(snapshot.trophies.length, 2);
  assert(snapshot.trophies.some(item => item.packageCode === 'base'));
  assert(snapshot.trophies.some(item => item.packageCode === 'versus'));
  assert.strictEqual(snapshot.online.slayersWins, 15);
  assert.strictEqual(snapshot.online.survivorsWins, 15);
  assert.strictEqual(snapshot.online.teamSlayersWins, 15);
  assert.strictEqual(snapshot.online.teamSurvivorsWins, 15);
  assert.strictEqual(snapshot.online.physicalEliminations, 50);
  assertNoEmptyIdentity(snapshot);
}

function buildCompleteSnapshot(minimal) {
  assert(minimal, 'minimal fixture is required');
  assert(fs.existsSync(CANONICAL_PATH), 'canonical complete snapshot must exist');
  return JSON.parse(fs.readFileSync(CANONICAL_PATH, 'utf8'));
}

function expectValid(validate, snapshot, options) {
  const result = validate(snapshot, options);
  assert(result && typeof result === 'object', 'validator must return a result object');
  assert.strictEqual(result.valid, true, JSON.stringify(result.errors || []));
  assert.deepStrictEqual(result.errors || [], []);
  return result;
}

function expectInvalid(validate, snapshot, message) {
  const options = snapshot?.trophies?.length === 71
    ? undefined
    : { profile: 'minimal-contract' };
  const result = validate(snapshot, options);
  assert(result && typeof result === 'object', 'validator must return a result object');
  assert.strictEqual(result.valid, false, message);
  assert(Array.isArray(result.errors) && result.errors.length > 0, `${message}: explicit errors required`);
}

function mutation(snapshot, update) {
  const changed = clone(snapshot);
  update(changed);
  return changed;
}

function runContract(validate, minimal) {
  expectValid(validate, minimal, { profile: 'minimal-contract' });

  expectInvalid(validate, mutation(minimal, item => { item.schemaVersion = 1; }), 'schemaVersion must be 2');
  for (const block of REQUIRED_BLOCKS) {
    expectInvalid(validate, mutation(minimal, item => { delete item[block]; }), `${block} is required`);
  }
  for (const block of [
    'versions',
    'trophyPackages',
    'trophies',
    'roadmap',
    'guideContent',
    'collectibles',
    'inventoryRequirements',
    'upgradeRequirements',
    'sources',
    'claims',
    'redirects'
  ]) {
    expectInvalid(
      validate,
      mutation(minimal, item => { item[block] = {}; }),
      `${block} must reject non-array values`
    );
  }
  expectInvalid(validate, mutation(minimal, item => {
    item.versions[0] = null;
  }), 'malformed version entries must be reported');

  expectInvalid(validate, mutation(minimal, item => {
    item.versions[1].releaseKind = 'native';
    item.versions[1].isNative = true;
    item.versions[1].sourceVersionCode = null;
  }), 'native PS5 must be rejected');
  expectInvalid(validate, mutation(minimal, item => {
    item.versions[1].nativeTrophyList = true;
  }), 'separate PS5 list must be rejected');
  expectInvalid(validate, mutation(minimal, item => {
    item.versions[1].autopopSupported = true;
  }), 'autopop must be rejected');
  expectInvalid(validate, mutation(minimal, item => {
    item.versions[1].upgradeSupported = true;
  }), 'upgrade must be rejected');
  expectInvalid(validate, mutation(minimal, item => {
    item.versions[1].sourceVersionCode = 'unknown-version';
  }), 'PS5 must point to ps4-native');
  expectInvalid(validate, mutation(minimal, item => {
    item.trophyPackages.pop();
  }), 'four packages are required');

  const complete = buildCompleteSnapshot(minimal);
  expectValid(validate, complete);
  assert.strictEqual(complete.trophies.length, 71);

  const packageCounts = Object.fromEntries(
    complete.trophyPackages.map(pkg => [
      pkg.packageCode,
      complete.trophies.filter(trophy => trophy.packageCode === pkg.packageCode).length
    ])
  );
  assert.deepStrictEqual(packageCounts, {
    base: 51,
    versus: 10,
    'lost-in-nightmares': 5,
    'desperate-escape': 5
  });

  const typeCounts = complete.trophies.reduce((counts, trophy) => {
    counts[trophy.type] = (counts[trophy.type] || 0) + 1;
    return counts;
  }, {});
  assert.deepStrictEqual(typeCounts, { Platina: 1, Ouro: 1, Prata: 16, Bronze: 53 });

  expectInvalid(validate, mutation(complete, item => {
    item.trophies[1].trophyCode = item.trophies[0].trophyCode;
  }), 'duplicate trophyCode must be rejected');
  expectInvalid(validate, mutation(complete, item => {
    item.trophies[1].displayOrder = item.trophies[0].displayOrder;
  }), 'duplicate trophy displayOrder must be rejected');
  expectInvalid(validate, mutation(complete, item => {
    item.trophies[1].packageCode = 'unknown-package';
  }), 'unknown packageCode must be rejected');
  expectInvalid(validate, mutation(complete, item => {
    item.trophyPackages[1].isOnline = false;
  }), 'Versus must be online');
  expectInvalid(validate, mutation(complete, item => {
    item.online.slayersWins = 14;
  }), 'Versus thresholds 15/15/15/15 and 50 are immutable');
  expectInvalid(validate, mutation(complete, item => {
    item.trophies[0].trophyCode = '';
  }), 'empty identities must be rejected');
  expectInvalid(validate, mutation(complete, item => {
    item.unknownContractField = true;
  }), 'unknown fields must be explicitly rejected');
  expectInvalid(validate, mutation(complete, item => {
    item.trophies.reverse();
  }), 'array order must be deterministic');
}

const fixture = loadFixture();
characterizeFixture(fixture);

if (!fs.existsSync(VALIDATOR_PATH)) {
  console.error('RE5 V2 snapshot validator is not implemented');
  process.exit(1);
}

const validatorModule = require(VALIDATOR_PATH);
if (typeof validatorModule.validateGuideSnapshotV2 !== 'function') {
  console.error('RE5 V2 snapshot validator is not implemented');
  process.exit(1);
}
assert.strictEqual(typeof validatorModule.assertGuideSnapshotV2, 'function');

runContract(validatorModule.validateGuideSnapshotV2, fixture);
assert.throws(
  () => validatorModule.assertGuideSnapshotV2(
    mutation(fixture, item => { item.schemaVersion = 1; }),
    { mode: 'minimal' }
  ),
  error => (
    error?.code === 'INVALID_GUIDE_SNAPSHOT_V2'
    && Array.isArray(error.errors)
    && error.errors.some(item => item.path === 'schemaVersion')
  )
);
console.log('RE5 V2 snapshot contract passed');
