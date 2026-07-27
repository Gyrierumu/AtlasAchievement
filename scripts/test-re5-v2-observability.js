'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_SERVER_EVENTS = [
  'guide_v2_selected',
  'guide_v2_fallback',
  'guide_v2_invalid_snapshot',
  'guide_v2_manifest_mismatch',
  'guide_v2_source_missing',
  'guide_v2_adapter_error'
];
const EXPECTED_CLIENT_EVENTS = [
  'guide_progress_initialized',
  'guide_progress_changed',
  'guide_progress_reset_package',
  'guide_progress_reset_all',
  'guide_progress_legacy_migrated',
  'guide_progress_legacy_ambiguous_dlc',
  'guide_progress_sync_success',
  'guide_progress_sync_failed',
  'guide_progress_invalid_local_state'
];
const ALLOWED_FIELDS = new Set([
  'event',
  'slug',
  'sourceMode',
  'packageCode',
  'completedCount',
  'totalCount',
  'reasonCode',
  'snapshotHash',
  'featureFlagEnabled'
]);
const FORBIDDEN_FIELDS = [
  'name',
  'email',
  'ip',
  'token',
  'trophies',
  'content',
  'psnId',
  'userId'
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createLogger(events) {
  const capture = payload => events.push(payload);
  return { info: capture, warn: capture, error: capture };
}

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'guides', 'resident-evil-5.json'),
    'utf8'
  ));
  const manifest = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'guides', 'manifest.json'),
    'utf8'
  ));
  const { resolveGuideSource } = require('../src/shared/guideSourceResolver');
  const progressClient = require('../public/js/guide-progress-v2');
  const serverEvents = [];
  const common = {
    slug: 'resident-evil-5',
    featureFlagEnabled: true,
    relationalLegacy: { slug: 'resident-evil-5', trophies: [] },
    logger: createLogger(serverEvents)
  };

  const selected = await resolveGuideSource({ ...common, snapshot, manifest });
  assert.strictEqual(selected.sourceMode, 'v2');

  const invalidSnapshot = clone(snapshot);
  invalidSnapshot.trophyPackages[1].expectedTrophyCount = 9;
  const invalid = await resolveGuideSource({ ...common, snapshot: invalidSnapshot, manifest });
  assert.strictEqual(invalid.sourceMode, 'relational-legacy');

  const invalidManifest = clone(manifest);
  invalidManifest.games.find(item => item.slug === 'resident-evil-5').payloadHash = '0'.repeat(64);
  const mismatch = await resolveGuideSource({ ...common, snapshot, manifest: invalidManifest });
  assert.strictEqual(mismatch.sourceMode, 'relational-legacy');

  const missing = await resolveGuideSource({ ...common, snapshot: null, manifest });
  assert.strictEqual(missing.sourceMode, 'relational-legacy');

  const adapterFailure = await resolveGuideSource({
    ...common,
    snapshot,
    manifest,
    validateV2Candidate() {
      const error = new Error('synthetic adapter failure');
      error.code = 'GUIDE_V2_ADAPTER_FAILURE';
      throw error;
    }
  });
  assert.strictEqual(adapterFailure.sourceMode, 'relational-legacy');

  EXPECTED_SERVER_EVENTS.forEach(eventName => {
    assert(serverEvents.some(event => event.event === eventName), `Missing server event ${eventName}`);
  });
  serverEvents
    .filter(event => String(event.event || '').startsWith('guide_v2_'))
    .forEach(event => {
      Object.keys(event).forEach(field => {
        assert(ALLOWED_FIELDS.has(field), `${event.event} includes forbidden field ${field}`);
      });
      FORBIDDEN_FIELDS.forEach(field => {
        assert(!(field in event), `${event.event} exposes ${field}`);
      });
    });

  assert.deepStrictEqual([...progressClient.EVENT_NAMES].sort(), [...EXPECTED_CLIENT_EVENTS].sort());
  const clientSource = fs.readFileSync(path.join(ROOT, 'public', 'js', 'guide-progress-v2.js'), 'utf8');
  const emittedEvents = [...clientSource.matchAll(/emitEvent\('([^']+)'/g)].map(match => match[1]);
  EXPECTED_CLIENT_EVENTS.forEach(eventName => {
    assert(emittedEvents.includes(eventName), `Missing client emitter ${eventName}`);
  });
  assert(emittedEvents.every(eventName => EXPECTED_CLIENT_EVENTS.includes(eventName)));

  const diagnosticBlock = clientSource.match(
    /function emitDiagnostic\([^)]*\) \{([\s\S]*?)\n  \}\n\n  function emitEvent/
  )?.[1] || '';
  assert(diagnosticBlock, 'Diagnostic emitter must exist');
  assert(!diagnosticBlock.includes('...details'), 'Diagnostic payload must not spread arbitrary details');
  FORBIDDEN_FIELDS.forEach(field => {
    assert(!new RegExp(`\\b${field}\\b`, 'i').test(diagnosticBlock), `Diagnostic payload references ${field}`);
  });

  const eventSummary = {
    server: [...new Set(serverEvents.map(item => item.event).filter(Boolean))].sort(),
    client: [...progressClient.EVENT_NAMES].sort(),
    allowedFields: [...ALLOWED_FIELDS].sort(),
    excludedPrivacyData: ['name', 'email', 'application IP', 'token', 'full progress list', 'editorial content', 'PSN IDs']
  };
  console.log(JSON.stringify(eventSummary, null, 2));
  console.log('RE5 V2 observability contract passed');
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
