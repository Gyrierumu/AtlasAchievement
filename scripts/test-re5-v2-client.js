'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const V2_PATH = path.join(__dirname, 'fixtures', 're5', 'v2-minimal.json');
const PROGRESS_PATH = path.join(__dirname, 'fixtures', 're5', 'progress-library-v2.json');
const LEGACY_PATH = path.join(__dirname, 'fixtures', 're5', 'progress-phase6-empty-id.json');
const CLIENT_PATH = path.join(ROOT, 'public', 'js', 're5-guide-progress-v2.js');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadFixture(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildTrophies(minimal) {
  const specs = minimal.trophyPackages.map(item => [
    item.packageCode,
    item.expectedTrophyCount
  ]);
  const trophies = [];
  let displayOrder = 1;
  for (const [packageCode, count] of specs) {
    for (let index = 1; index <= count; index += 1) {
      const trophyCode = packageCode === 'base' && index === 1
        ? 're5_platinum'
        : `re5_contract_${packageCode.replaceAll('-', '_')}_${String(index).padStart(2, '0')}`;
      trophies.push({ trophyCode, packageCode, displayOrder });
      displayOrder += 1;
    }
  }
  return trophies;
}

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] || null;
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
    clear() {
      values.clear();
    },
    entries() {
      return [...values.entries()];
    }
  };
}

function buildControlRoot(trophies, overrides = {}) {
  const controls = trophies.map((trophy, index) => ({
    id: `progress-${index + 1}`,
    dataset: {
      trophyCode: trophy.trophyCode,
      packageCode: trophy.packageCode
    },
    closest() {
      return { dataset: { globalOrder: String(index + 1) } };
    }
  }));
  Object.entries(overrides).forEach(([index, value]) => {
    Object.assign(controls[Number(index)], value);
    if (value.dataset) {
      controls[Number(index)].dataset = {
        trophyCode: trophies[Number(index)]?.trophyCode,
        packageCode: trophies[Number(index)]?.packageCode,
        ...value.dataset
      };
    }
  });
  return {
    controls,
    querySelectorAll(selector) {
      return selector === '[data-guide-progress-checkbox]' ? controls : [];
    }
  };
}

function characterizeFixtures(minimal, progress, legacy, trophies) {
  assert.strictEqual(progress.storageKey, 'atlas:guide-progress:v2:resident-evil-5');
  assert.strictEqual(progress.value.version, 2);
  assert.strictEqual(progress.value.slug, 'resident-evil-5');
  assert(Object.values(progress.value.trophies).some(item => item.completed));
  assert(Object.values(progress.value.trophies).some(item => !item.completed));
  assert.strictEqual(progress.timestampConflict.expectedWinner, 'server');
  assert.strictEqual(legacy.storageKey, 'atlas_re5_phase6_state_v1');
  assert.strictEqual(legacy.ambiguity.emptyKey, '');
  assert.strictEqual(legacy.ambiguity.resolvableDlcTrophyCodes.length, 0);
  assert.strictEqual(legacy.expectedMigration.migratedDlcCodes.length, 0);
  assert.strictEqual(minimal.trophyPackages.length, 4);
  assert.strictEqual(trophies.length, 71);
  assert.strictEqual(new Set(trophies.map(item => item.trophyCode)).size, 71);
  assert(trophies.every(item => item.trophyCode.trim()));
}

function assertSummary(summary) {
  assert.deepStrictEqual(summary.packages, {
    base: { completed: 0, total: 51, percent: 0 },
    versus: { completed: 0, total: 10, percent: 0 },
    'lost-in-nightmares': { completed: 0, total: 5, percent: 0 },
    'desperate-escape': { completed: 0, total: 5, percent: 0 }
  });
  assert.deepStrictEqual(summary.total, { completed: 0, total: 71, percent: 0 });
}

async function assertBackendSecurity() {
  const snapshot = loadFixture(path.join(ROOT, 'data', 'guides', 'resident-evil-5.json'));
  const snapshotBefore = JSON.stringify(snapshot.trophies);
  const knownCodes = snapshot.trophies.map(item => item.trophyCode);
  const progressRows = new Map();
  const libraryRows = new Map();
  let progressId = 1;
  const keyFor = (userId, gameId, trophyCode) => `${userId}:${gameId}:${trophyCode}`;
  const libraryKeyFor = (userId, gameId) => `${userId}:${gameId}`;
  const dbPath = require.resolve('../src/db/db');
  const gamesPath = require.resolve('../src/services/games.service');
  const userPath = require.resolve('../src/services/user.service');
  const servicePath = require.resolve('../src/services/userLibrary.service');

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      async all(sql, params) {
        if (/FROM user_trophy_progress/.test(sql)) {
          const [userId, gameId] = params;
          return [...progressRows.values()]
            .filter(row => row.user_id === userId && row.game_id === gameId)
            .sort((left, right) => left.trophy_code.localeCompare(right.trophy_code));
        }
        throw new Error(`Unexpected all query: ${sql}`);
      },
      async get(sql, params) {
        if (/FROM user_library/.test(sql)) {
          return libraryRows.get(libraryKeyFor(params[0], params[1])) || null;
        }
        if (/COUNT\(\*\) AS total FROM trophies/.test(sql)) {
          return { total: knownCodes.length };
        }
        if (/COUNT\(\*\) AS total FROM user_trophy_progress/.test(sql)) {
          const [userId, gameId] = params;
          return {
            total: [...progressRows.values()].filter(row => (
              row.user_id === userId && row.game_id === gameId && row.completed === 1
            )).length
          };
        }
        throw new Error(`Unexpected get query: ${sql}`);
      },
      async run(sql, params) {
        if (/INSERT INTO user_library/.test(sql)) {
          const [userId, gameId, status, lastOpenedAt] = params;
          const key = libraryKeyFor(userId, gameId);
          const existing = libraryRows.get(key);
          libraryRows.set(key, {
            id: existing?.id || libraryRows.size + 1,
            user_id: userId,
            game_id: gameId,
            status,
            created_at: existing?.created_at || lastOpenedAt,
            updated_at: lastOpenedAt,
            last_opened_at: lastOpenedAt
          });
          return { changes: 1 };
        }
        if (/UPDATE user_library SET status/.test(sql)) {
          const [status, userId, gameId] = params;
          libraryRows.get(libraryKeyFor(userId, gameId)).status = status;
          return { changes: 1 };
        }
        if (/UPDATE user_trophy_progress/.test(sql)) {
          const [completed, completedAt, updatedAt, userId, gameId, trophyCode] = params;
          const row = progressRows.get(keyFor(userId, gameId, trophyCode));
          Object.assign(row, {
            completed,
            completed_at: completedAt,
            updated_at: updatedAt
          });
          return { changes: 1 };
        }
        if (/INSERT INTO user_trophy_progress/.test(sql)) {
          const [userId, gameId, trophyCode, completed, completedAt, createdAt, updatedAt] = params;
          progressRows.set(keyFor(userId, gameId, trophyCode), {
            id: progressId++,
            user_id: userId,
            game_id: gameId,
            trophy_code: trophyCode,
            completed,
            completed_at: completedAt,
            created_at: createdAt,
            updated_at: updatedAt
          });
          return { changes: 1 };
        }
        throw new Error(`Unexpected run query: ${sql}`);
      }
    }
  };
  require.cache[gamesPath] = {
    id: gamesPath,
    filename: gamesPath,
    loaded: true,
    exports: {
      async getGuideViewModelBySlug() {
        return {
          sourceMode: 'v2',
          trophies: { all: snapshot.trophies }
        };
      },
      async getGameBySlug(slug) {
        return { id: 16, slug, name: 'Resident Evil 5' };
      }
    }
  };
  require.cache[userPath] = {
    id: userPath,
    filename: userPath,
    loaded: true,
    exports: {}
  };
  delete require.cache[servicePath];
  const service = require(servicePath);
  const validPayload = {
    version: 2,
    slug: 'resident-evil-5',
    items: [{
      trophyCode: knownCodes[0],
      completed: true,
      updatedAt: '2026-07-26T14:00:00.000Z',
      packageCode: 'forged-package',
      name: 'forged-name',
      description: 'forged-description'
    }]
  };
  const first = await service.saveGuideProgressV2(1, 'resident-evil-5', validPayload);
  assert.strictEqual(first.trophies[knownCodes[0]].completed, true);
  assert.strictEqual((await service.getGuideProgressV2(2, 'resident-evil-5')).trophies[knownCodes[0]], undefined);

  await assert.rejects(
    () => service.saveGuideProgressV2(1, 'resident-evil-5', {
      ...validPayload,
      items: [{ ...validPayload.items[0], trophyCode: '' }]
    }),
    /inválido/
  );
  await assert.rejects(
    () => service.saveGuideProgressV2(1, 'resident-evil-5', {
      ...validPayload,
      items: [{ ...validPayload.items[0], trophyCode: 're6_foreign' }]
    }),
    /não pertence/
  );
  await assert.rejects(
    () => service.saveGuideProgressV2(1, 'resident-evil-5', {
      ...validPayload,
      items: Array.from({ length: 72 }, (_, index) => ({
        trophyCode: knownCodes[index % knownCodes.length],
        completed: true,
        updatedAt: '2026-07-26T14:00:00.000Z'
      }))
    }),
    /Limite/
  );
  await assert.rejects(
    () => service.saveGuideProgressV2(1, 'resident-evil-5', {
      ...validPayload,
      items: [validPayload.items[0], validPayload.items[0]]
    }),
    /duplicado/
  );
  await assert.rejects(
    () => service.saveGuideProgressV2(1, 'resident-evil-5', {
      ...validPayload,
      items: [{ ...validPayload.items[0], updatedAt: 'not-a-timestamp' }]
    }),
    /updatedAt inválido/
  );

  const baseBeforeDlc = clone((await service.getGuideProgressV2(1, 'resident-evil-5')).trophies[knownCodes[0]]);
  const dlcCode = snapshot.trophies.find(item => item.packageCode !== 'base').trophyCode;
  await service.saveGuideProgressV2(1, 'resident-evil-5', {
    version: 2,
    slug: 'resident-evil-5',
    items: [{
      trophyCode: dlcCode,
      completed: true,
      updatedAt: '2026-07-26T14:01:00.000Z'
    }]
  });
  assert.deepStrictEqual(
    (await service.getGuideProgressV2(1, 'resident-evil-5')).trophies[knownCodes[0]],
    baseBeforeDlc
  );
  assert.strictEqual(JSON.stringify(snapshot.trophies), snapshotBefore);
}

async function main() {
  const minimal = loadFixture(V2_PATH);
  const progress = loadFixture(PROGRESS_PATH);
  const legacy = loadFixture(LEGACY_PATH);
  const trophies = buildTrophies(minimal);
  characterizeFixtures(minimal, progress, legacy, trophies);

  if (!fs.existsSync(CLIENT_PATH)) {
    console.error('RE5 V2 client progress module is not implemented');
    process.exit(1);
  }

  const client = require(CLIENT_PATH);
  const requiredFunctions = [
    'createProgressStore',
    'migratePhase6Progress',
    'mergeProgressEntry',
    'summarizeProgress',
    'buildProgressAria',
    'enhanceGuideProgress'
  ];
  if (requiredFunctions.some(name => typeof client[name] !== 'function')) {
    console.error('RE5 V2 client progress module is not implemented');
    process.exit(1);
  }
  assert.strictEqual(client.STORAGE_KEY, progress.storageKey);

  assert.strictEqual(client.collectGuideControls({
    querySelectorAll: () => []
  }).reason, 'zero-controls');
  assert.strictEqual(
    client.collectGuideControls(buildControlRoot(trophies.slice(0, 70))).reason,
    'unexpected-trophy-count'
  );
  assert.strictEqual(
    client.collectGuideControls(buildControlRoot([...trophies, {
      trophyCode: 're5_extra',
      packageCode: 'desperate-escape'
    }])).reason,
    'unexpected-trophy-count'
  );
  assert.strictEqual(
    client.collectGuideControls(buildControlRoot(trophies, {
      1: { dataset: { trophyCode: trophies[0].trophyCode } }
    })).reason,
    'duplicate-dom-code'
  );
  assert.strictEqual(
    client.collectGuideControls(buildControlRoot(trophies, {
      1: { dataset: { trophyCode: '' } }
    })).reason,
    'empty-trophy-code'
  );
  assert.strictEqual(
    client.collectGuideControls(buildControlRoot(trophies, {
      1: { dataset: { packageCode: 'unknown' } }
    })).reason,
    'unknown-package-code'
  );
  assert.strictEqual(client.collectGuideControls(buildControlRoot(trophies)).valid, true);

  const legacyStorage = createMemoryStorage({
    [legacy.storageKey]: JSON.stringify(legacy.value)
  });
  const migrationOptions = {
    storage: legacyStorage,
    legacyKey: legacy.storageKey,
    targetKey: progress.storageKey,
    baseCodeAllowlist: legacy.expectedMigration.allowedBaseCodes,
    dlcCodes: trophies.filter(item => item.packageCode !== 'base').map(item => item.trophyCode),
    now: () => '2026-07-26T11:00:00.000Z'
  };
  const firstMigration = client.migratePhase6Progress(migrationOptions);
  const migratedState = JSON.parse(legacyStorage.getItem(progress.storageKey));
  assert.strictEqual(firstMigration.status, 'completed-with-ambiguous-dlc');
  assert.strictEqual(firstMigration.warningShown, true);
  assert.strictEqual(migratedState.trophies.re5_ch1_1.completed, true);
  assert.strictEqual(migratedState.trophies.re5_stockpile.completed, true);
  assert.strictEqual(
    trophies.filter(item => item.packageCode !== 'base')
      .filter(item => migratedState.trophies[item.trophyCode]?.completed).length,
    0
  );
  assert(
    legacyStorage.entries().some(([key]) => key.startsWith(`${legacy.storageKey}:archived:`)),
    'legacy state must be archived'
  );

  const stateAfterFirstMigration = legacyStorage.getItem(progress.storageKey);
  const secondMigration = client.migratePhase6Progress(migrationOptions);
  assert.strictEqual(secondMigration.status, 'already-migrated');
  assert.strictEqual(secondMigration.warningShown, false);
  assert.strictEqual(legacyStorage.getItem(progress.storageKey), stateAfterFirstMigration);

  const allBaseCodes = trophies.filter(item => item.packageCode === 'base')
    .map(item => item.trophyCode);
  const fullLegacyStorage = createMemoryStorage({
    [legacy.storageKey]: JSON.stringify({
      roadmap: Object.fromEntries(allBaseCodes.map(code => [code, true])),
      extras: { '': true, re5_unknown: true }
    })
  });
  const fullMigration = client.migratePhase6Progress({
    ...migrationOptions,
    storage: fullLegacyStorage,
    baseCodeAllowlist: allBaseCodes
  });
  const fullMigratedState = JSON.parse(fullLegacyStorage.getItem(progress.storageKey));
  assert.strictEqual(fullMigration.migratedBaseCodes.length, 51);
  assert.strictEqual(Object.keys(fullMigratedState.trophies).length, 51);
  assert.strictEqual(fullMigratedState.trophies.re5_unknown, undefined);
  assert.strictEqual(
    trophies.filter(item => item.packageCode !== 'base')
      .filter(item => fullMigratedState.trophies[item.trophyCode]?.completed).length,
    0
  );

  const existingStorage = createMemoryStorage({
    [progress.storageKey]: JSON.stringify(migratedState),
    [legacy.storageKey]: JSON.stringify(legacy.value)
  });
  const existingValue = existingStorage.getItem(progress.storageKey);
  assert.strictEqual(client.migratePhase6Progress({
    ...migrationOptions,
    storage: existingStorage
  }).status, 'already-migrated');
  assert.strictEqual(existingStorage.getItem(progress.storageKey), existingValue);

  const invalidStorage = createMemoryStorage({ [legacy.storageKey]: '{invalid-json' });
  assert.doesNotThrow(() => client.migratePhase6Progress({
    ...migrationOptions,
    storage: invalidStorage
  }));
  assert(
    invalidStorage.entries().some(([key, value]) => (
      key.startsWith(`${legacy.storageKey}:archived:`) && value === '{invalid-json'
    )),
    'invalid JSON must be archived verbatim'
  );

  const conflict = progress.timestampConflict;
  assert.deepStrictEqual(
    client.mergeProgressEntry(conflict.local, conflict.server),
    conflict.server,
    'server must win a timestamp tie'
  );
  assert.deepStrictEqual(
    client.mergeProgressEntry(
      { ...conflict.local, updatedAt: '2026-07-26T12:01:00.000Z' },
      conflict.server
    ).source,
    'local'
  );

  const storage = createMemoryStorage();
  let currentTime = Date.parse('2026-07-26T12:00:00.000Z');
  const nextTimestamp = () => {
    currentTime += 1000;
    return new Date(currentTime).toISOString();
  };
  const store = client.createProgressStore({
    storage,
    storageKey: progress.storageKey,
    slug: 'resident-evil-5',
    trophies,
    trophyPackages: minimal.trophyPackages,
    now: nextTimestamp,
    syncRemote: async () => {
      throw new Error('network unavailable');
    }
  });
  assertSummary(client.summarizeProgress(store.getState(), trophies));

  store.setCompleted(trophies[0].trophyCode, true);
  const storedAfterCompletion = JSON.parse(storage.getItem(progress.storageKey));
  assert.strictEqual(storedAfterCompletion.trophies[trophies[0].trophyCode].completed, true);
  assert.strictEqual(storedAfterCompletion.dirty, true);
  assert.strictEqual(storedAfterCompletion.source, 'local');
  store.setCompleted(trophies[51].trophyCode, true);
  store.resetPackage('versus');
  assert.strictEqual(store.getState().trophies[trophies[0].trophyCode].completed, true);
  assert.strictEqual(store.getState().trophies[trophies[51].trophyCode].completed, false);
  store.resetAll();
  assert.strictEqual(
    Object.values(store.getState().trophies).filter(item => item.completed).length,
    0
  );
  await assert.rejects(() => store.sync(), /network unavailable/);
  assert.strictEqual(store.getState().dirty, true);

  const reloadStore = client.createProgressStore({
    storage,
    storageKey: progress.storageKey,
    slug: 'resident-evil-5',
    trophies,
    now: nextTimestamp
  });
  assert.strictEqual(
    Object.values(reloadStore.getState().trophies).filter(item => item.completed).length,
    0
  );

  allBaseCodes.forEach(code => reloadStore.setCompleted(code, true));
  let subtotal = client.summarizeProgress(reloadStore.getState(), trophies);
  assert.deepStrictEqual(subtotal.platinum, { completed: 51, total: 51, percent: 100 });
  assert.deepStrictEqual(subtotal.completion, { completed: 51, total: 71, percent: 72 });
  trophies.filter(item => item.packageCode !== 'base')
    .forEach(item => reloadStore.setCompleted(item.trophyCode, true));
  subtotal = client.summarizeProgress(reloadStore.getState(), trophies);
  assert.deepStrictEqual(subtotal.completion, { completed: 71, total: 71, percent: 100 });
  const migrationBeforeReset = clone(reloadStore.getState().migrations);
  reloadStore.resetAll();
  assert.deepStrictEqual(reloadStore.getState().migrations, migrationBeforeReset);

  const invalidJsonStorage = createMemoryStorage({
    [progress.storageKey]: '{invalid'
  });
  assert.doesNotThrow(() => client.createProgressStore({
    storage: invalidJsonStorage,
    storageKey: progress.storageKey,
    slug: 'resident-evil-5',
    trophies,
    now: () => '2026-07-26T13:00:00.000Z'
  }));
  assert(invalidJsonStorage.entries().some(([key]) => (
    key.startsWith('atlas:guide-progress:archive:resident-evil-5:')
  )));

  const invalidSchemaStorage = createMemoryStorage({
    [progress.storageKey]: JSON.stringify({ version: 1, slug: 'resident-evil-5' })
  });
  const recoveredStore = client.createProgressStore({
    storage: invalidSchemaStorage,
    storageKey: progress.storageKey,
    slug: 'resident-evil-5',
    trophies,
    now: () => '2026-07-26T13:01:00.000Z'
  });
  assert.strictEqual(recoveredStore.getState().version, 2);
  assert(invalidSchemaStorage.entries().some(([key]) => (
    key.startsWith('atlas:guide-progress:archive:resident-evil-5:')
  )));

  const polluted = JSON.parse(
    '{"version":2,"slug":"resident-evil-5","updatedAt":"2026-07-26T13:00:00.000Z",'
    + '"source":"local","dirty":false,"trophies":{"__proto__":{"completed":true,'
    + '"updatedAt":"2026-07-26T13:00:00.000Z"}}}'
  );
  assert.strictEqual(client.validateProgressDocument(polluted, {
    slug: 'resident-evil-5',
    trophies
  }).reason, 'dangerous-key');

  const oversizedStorage = createMemoryStorage({
    [progress.storageKey]: `{"padding":"${'x'.repeat(client.MAX_DOCUMENT_SIZE)}"}`
  });
  const oversizedStore = client.createProgressStore({
    storage: oversizedStorage,
    storageKey: progress.storageKey,
    slug: 'resident-evil-5',
    trophies,
    now: () => '2026-07-26T13:02:00.000Z'
  });
  assert.strictEqual(oversizedStore.getState().version, 2);
  assert(oversizedStore.getDiagnostics().some(item => item.reason === 'document-too-large'));

  const remoteCalls = [];
  const remoteDocument = client.createEmptyDocument({
    slug: 'resident-evil-5',
    source: 'server',
    now: () => '2026-07-26T12:00:00.000Z'
  });
  const remoteSync = client.createRemoteSync({
    slug: 'resident-evil-5',
    trophies,
    csrfToken: 'csrf-test',
    fetchImpl: async (url, options = {}) => {
      remoteCalls.push({ url, options });
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => options.method === 'PUT'
          ? {
              ...JSON.parse(options.body),
              updatedAt: '2026-07-26T13:03:00.000Z',
              source: 'server',
              dirty: false,
              trophies: Object.fromEntries(JSON.parse(options.body).items.map(item => [
                item.trophyCode,
                { completed: item.completed, updatedAt: item.updatedAt, source: 'server' }
              ])),
              checklists: {},
              migrations: remoteDocument.migrations
            }
          : remoteDocument
      };
    }
  });
  const remoteLocal = client.createEmptyDocument({
    slug: 'resident-evil-5',
    now: () => '2026-07-26T13:04:00.000Z',
    dirty: true
  });
  remoteLocal.trophies[trophies[0].trophyCode] = {
    completed: true,
    updatedAt: '2026-07-26T13:04:00.000Z',
    source: 'local'
  };
  const remoteResult = await remoteSync(remoteLocal);
  assert.strictEqual(remoteCalls.filter(call => call.options.method === 'PUT').length, 1);
  assert.strictEqual(JSON.parse(remoteCalls[1].options.body).items.length, 1);
  assert.strictEqual(remoteCalls[0].options.credentials, 'include');
  assert.strictEqual(remoteCalls[1].options.credentials, 'include');
  assert.strictEqual(remoteCalls[1].options.headers['X-CSRF-Token'], 'csrf-test');
  assert(remoteCalls.every(call => call.url === '/api/library/guides/resident-evil-5/progress'));
  assert.strictEqual(remoteResult.trophies[trophies[0].trophyCode].completed, true);

  const aria = client.buildProgressAria({ completed: 17, total: 71 });
  assert.strictEqual(aria['aria-valuenow'], '17');
  assert.strictEqual(aria['aria-valuemax'], '71');
  assert(aria['aria-label'].includes('17'));
  assert(aria['aria-label'].includes('71'));

  const attributes = {};
  const contentNode = { textContent: 'Conteúdo SSR legível sem JavaScript.' };
  const progressNode = {
    setAttribute(name, value) {
      attributes[name] = value;
    }
  };
  const root = {
    querySelector(selector) {
      if (selector === '[data-re5-v2-content]') return contentNode;
      if (selector === '[data-re5-v2-progress]') return progressNode;
      return null;
    }
  };
  client.enhanceGuideProgress(root, { completed: 17, total: 71 });
  assert.strictEqual(contentNode.textContent, 'Conteúdo SSR legível sem JavaScript.');
  assert.strictEqual(attributes['aria-valuenow'], '17');
  await assertBackendSecurity();
  console.log('RE5 V2 client progress contract passed');
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
