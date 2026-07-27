'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.resolve(__dirname, '..');
const DATABASE_FIXTURE_PATH = path.join(__dirname, 'fixtures', 're5', 'database-51.json');
const SNAPSHOT_PATH = path.join(ROOT, 'data', 'guides', 'resident-evil-5.json');
const MANIFEST_PATH = path.join(ROOT, 'data', 'guides', 'manifest.json');

function createMemoryDatabase() {
  const raw = new sqlite3.Database(':memory:');
  return {
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        raw.run(sql, params, function onRun(error) {
          if (error) reject(error);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        raw.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        raw.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)));
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        raw.exec(sql, error => (error ? reject(error) : resolve()));
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        raw.close(error => (error ? reject(error) : resolve()));
      });
    }
  };
}

async function seedLegacyDatabase(database, fixture) {
  await database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE games (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE trophies (
      id INTEGER PRIMARY KEY,
      game_id INTEGER NOT NULL,
      trophy_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games(id)
    );
    CREATE TABLE user_trophy_progress (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      trophy_id INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (trophy_id) REFERENCES trophies(id)
    );
  `);
  for (const game of fixture.tables.games) {
    await database.run(
      `INSERT INTO games (id, slug, name, platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [game.id, game.slug, game.name, game.platform, game.created_at, game.updated_at]
    );
  }
  for (const trophy of fixture.tables.trophies) {
    await database.run(
      `INSERT INTO trophies
       (id, game_id, trophy_code, name, type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        trophy.id,
        trophy.game_id,
        trophy.trophy_code,
        trophy.trophy_code,
        trophy.type,
        trophy.created_at,
        trophy.updated_at
      ]
    );
  }
  for (const progress of fixture.tables.user_trophy_progress) {
    await database.run(
      `INSERT INTO user_trophy_progress
       (id, user_id, trophy_id, completed, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        progress.id,
        progress.user_id,
        progress.trophy_id,
        progress.completed,
        progress.completed_at,
        progress.created_at,
        progress.updated_at
      ]
    );
  }
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    counts[item[field]] = (counts[item[field]] || 0) + 1;
    return counts;
  }, {});
}

function assertCompletePreservation(snapshot) {
  assert.strictEqual(snapshot.versions.length, 2);
  assert.strictEqual(snapshot.trophyPackages.length, 4);
  assert.strictEqual(snapshot.trophies.length, 71);
  assert.deepStrictEqual(countBy(snapshot.trophies, 'packageCode'), {
    base: 51,
    versus: 10,
    'lost-in-nightmares': 5,
    'desperate-escape': 5
  });
  assert.deepStrictEqual(countBy(snapshot.trophies, 'type'), {
    Platina: 1,
    Ouro: 1,
    Prata: 16,
    Bronze: 53
  });
  assert.strictEqual(snapshot.roadmap.length, 9);
  assert.strictEqual(snapshot.guideContent.length, 31);
  assert.strictEqual(snapshot.collectibles.filter(item => item.kind === 'bsaa-emblem').length, 30);
  assert.strictEqual(snapshot.collectibles.filter(item => item.kind === 'treasure').length, 50);
  assert.strictEqual(snapshot.inventoryRequirements.length, 27);
  assert.strictEqual(snapshot.upgradeRequirements.length, 18);
  assert.strictEqual(snapshot.economy.figures.totalCost, 22000);
  assert.strictEqual(snapshot.economy.versusCharacters.totalCost, 134000);
  assert.strictEqual(snapshot.online.physicalEliminations, 50);
  assert(snapshot.sources.length >= 16);
  assert(snapshot.claims.length >= 20);
  assert(snapshot.seo);
  assert.strictEqual(snapshot.review.status, 'approved');
}

async function closeDefaultMemoryDatabase() {
  const defaultDatabase = require(path.join(ROOT, 'src', 'db', 'db.js')).db;
  await new Promise((resolve, reject) => {
    defaultDatabase.close(error => (error ? reject(error) : resolve()));
  });
}

async function main() {
  assert(fs.existsSync(SNAPSHOT_PATH), 'canonical RE5 V2 snapshot must exist');
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const fixture = JSON.parse(fs.readFileSync(DATABASE_FIXTURE_PATH, 'utf8'));
  const { transformRe5ApprovedPackage } = require('./transform-re5-approved-package');
  const {
    normalizeGuideSnapshotV2,
    hashGuideSnapshotV2,
    compareGuideSnapshotsV2
  } = require('./data-sync-utils');
  const {
    validateGuideSnapshotV2
  } = require('../src/validators/guideSnapshotV2.validator');
  const {
    importGuideSnapshotV2
  } = require('./import-data');
  const {
    exportGuideSnapshotV2
  } = require('./export-data');

  process.env.DATABASE_PATH = ':memory:';
  const {
    migrateGuideSchemaV2PackagesAndVersions
  } = require('../src/db/migrate');

  const transformed = await transformRe5ApprovedPackage();
  const sourceComparison = compareGuideSnapshotsV2(snapshot, transformed);
  assert.strictEqual(sourceComparison.equal, true, JSON.stringify(sourceComparison.differences.slice(0, 5)));
  const validation = validateGuideSnapshotV2(snapshot, { mode: 'complete' });
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors || []));
  const manifestEntry = manifest.games.find(entry => entry.slug === 'resident-evil-5');
  assert(manifestEntry, 'manifest must include resident-evil-5');
  assert.strictEqual(manifestEntry.schemaVersion, 2);
  assert.strictEqual(manifestEntry.payloadHash, hashGuideSnapshotV2(snapshot));
  assert.strictEqual(manifestEntry.trophyCount, 71);
  assertCompletePreservation(snapshot);

  const database = createMemoryDatabase();
  try {
    await seedLegacyDatabase(database, fixture);
    await migrateGuideSchemaV2PackagesAndVersions(database);
    const progressBefore = await database.all('SELECT * FROM user_trophy_progress ORDER BY id');
    const payloadBeforeDryRun = await database.get(
      'SELECT COUNT(*) AS total FROM game_guide_payloads'
    );
    const dryRun = await importGuideSnapshotV2(database, snapshot, { dryRun: true });
    assert.strictEqual(dryRun.valid, true);
    assert.strictEqual(dryRun.hash, hashGuideSnapshotV2(snapshot));
    assert.deepStrictEqual(
      { inserts: dryRun.inserts, updates: dryRun.updates, unchanged: dryRun.unchanged },
      { inserts: 1, updates: 71, unchanged: 6 }
    );
    assert.strictEqual(
      (await database.get('SELECT COUNT(*) AS total FROM game_guide_payloads')).total,
      payloadBeforeDryRun.total,
      'dry-run must not write payload'
    );

    const imported = await importGuideSnapshotV2(database, snapshot);
    assert.strictEqual(imported.valid, true);
    assert.strictEqual(imported.hash, hashGuideSnapshotV2(snapshot));
    assert.deepStrictEqual(
      await database.all('SELECT * FROM user_trophy_progress ORDER BY id'),
      progressBefore,
      'import must preserve progress'
    );

    const exported = await exportGuideSnapshotV2(database, 16);
    const comparison = compareGuideSnapshotsV2(snapshot, exported);
    assert.strictEqual(comparison.equal, true, JSON.stringify(comparison.differences.slice(0, 5)));
    assert.deepStrictEqual(normalizeGuideSnapshotV2(exported), normalizeGuideSnapshotV2(snapshot));
    assertCompletePreservation(exported);

    const secondImport = await importGuideSnapshotV2(database, exported);
    assert.strictEqual(secondImport.valid, true);
    assert.deepStrictEqual(
      {
        inserts: secondImport.inserts,
        updates: secondImport.updates,
        unchanged: secondImport.unchanged
      },
      { inserts: 0, updates: 0, unchanged: 78 }
    );
    const secondExport = await exportGuideSnapshotV2(database, 16);
    assert.strictEqual(compareGuideSnapshotsV2(exported, secondExport).equal, true);

    for (const mutate of [
      value => { value.sources.pop(); },
      value => { value.seo.title = 'Loss induced'; },
      value => { value.economy.figures.totalCost = 1; },
      value => { value.trophies[0].globalOrder = 2; }
    ]) {
      const changed = JSON.parse(JSON.stringify(snapshot));
      mutate(changed);
      assert.strictEqual(compareGuideSnapshotsV2(snapshot, changed).equal, false);
    }
    const operationalOnly = JSON.parse(JSON.stringify(snapshot));
    operationalOnly.generatedAt = '2099-01-01T00:00:00.000Z';
    operationalOnly.review.createdAt = '2099-01-01T00:00:00.000Z';
    operationalOnly.review.id = 999;
    assert.strictEqual(compareGuideSnapshotsV2(snapshot, operationalOnly).equal, true);
    const editorialDateChanged = JSON.parse(JSON.stringify(snapshot));
    editorialDateChanged.review.reviewedAt = '2026-07-25';
    assert.strictEqual(compareGuideSnapshotsV2(snapshot, editorialDateChanged).equal, false);

    await database.run(
      "UPDATE game_versions SET autopop_supported = 1 WHERE game_id = 16 AND version_code = 'ps5-backcompat-ps4'"
    );
    await assert.rejects(
      () => exportGuideSnapshotV2(database, 16),
      /RE5_V2_RELATIONAL_DIVERGENCE/
    );
    console.log('RE5 V2 semantic round-trip passed');
  } finally {
    await database.close();
    await closeDefaultMemoryDatabase();
  }
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
