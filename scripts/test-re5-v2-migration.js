'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 're5', 'database-51.json');
const MIGRATION_PATH = path.join(ROOT, 'src', 'db', 'migrate.js');
const APPROVED_BASE_CODES = [
  're5_platinum', 're5_ch1_1', 're5_ch1_2', 're5_ch2_1', 're5_ch2_2', 're5_ch2_3',
  're5_ch3_1', 're5_ch3_2', 're5_ch3_3', 're5_ch4_1', 're5_ch4_2', 're5_ch5_1',
  're5_ch5_2', 're5_ch5_3', 're5_ch6_1', 're5_ch6_2', 're5_ch6_3', 're5_recruit',
  're5_soldier', 're5_veteran', 're5_war_hero', 're5_egg_hunt', 're5_all_dressed_up',
  're5_stockpile', 're5_take_it_to_the_max', 're5_museum', 're5_badge_of_honor',
  're5_action_figures', 're5_friend_in_need', 're5_lifeguard', 're5_exploding_heads',
  're5_cut_above', 're5_cattle_prod', 're5_crowd_control', 're5_bulls_eye',
  're5_get_physical', 're5_the_works', 're5_lead_aspirin', 're5_fireworks',
  're5_be_the_knife', 're5_meat_shower', 're5_go_into_the_light',
  're5_ride_the_lightning', 're5_stop_drop_roll', 're5_baptism_by_fire',
  're5_masters_of_removing', 're5_bad_blood', 're5_drive_by',
  're5_egg_on_your_face', 're5_heart_stopper', 're5_who_do_you_trust'
];

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function characterizeFixture(fixture) {
  const trophies = fixture.tables.trophies;
  const progress = fixture.tables.user_trophy_progress;
  assert.strictEqual(fixture.tables.games.length, 1);
  assert.strictEqual(fixture.tables.games[0].id, 16);
  assert.strictEqual(fixture.tables.games[0].slug, 'resident-evil-5');
  assert.strictEqual(trophies.length, 51);
  assert.deepStrictEqual(trophies.map(item => item.trophy_code), APPROVED_BASE_CODES);
  assert.strictEqual(new Set(trophies.map(item => item.id)).size, 51);
  assert.strictEqual(new Set(trophies.map(item => item.trophy_code)).size, 51);
  assert(progress.length > 0);
  assert(progress.every(item => trophies.some(trophy => trophy.id === item.trophy_id)));
  assert.deepStrictEqual(fixture.absentTables, [
    'game_versions',
    'trophy_packages',
    'game_guide_payloads'
  ]);
  assert(trophies.every(item => (
    item.created_at
    && item.updated_at
    && !fixture.absentTrophyCodePrefixes.some(prefix => item.trophy_code.startsWith(prefix))
  )));
}

function createMemoryDatabase() {
  const raw = new sqlite3.Database(':memory:');
  const statements = [];
  return {
    raw,
    statements,
    run(sql, params = []) {
      statements.push(sql);
      return new Promise((resolve, reject) => {
        raw.run(sql, params, function onRun(error) {
          if (error) reject(error);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        raw.get(sql, params, (error, row) => {
          if (error) reject(error);
          else resolve(row);
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        raw.all(sql, params, (error, rows) => {
          if (error) reject(error);
          else resolve(rows);
        });
      });
    },
    exec(sql) {
      statements.push(sql);
      return new Promise((resolve, reject) => {
        raw.exec(sql, error => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        raw.close(error => {
          if (error) reject(error);
          else resolve();
        });
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

async function tableExists(database, tableName) {
  const row = await database.get(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName]
  );
  return Boolean(row);
}

async function assertSuccessfulMigration(migrateV2, fixture) {
  const database = createMemoryDatabase();
  try {
    await seedLegacyDatabase(database, fixture);
    const originalTrophies = await database.all(
      'SELECT id, trophy_code, created_at, updated_at FROM trophies ORDER BY id'
    );
    const originalProgress = await database.all(
      'SELECT * FROM user_trophy_progress ORDER BY id'
    );

    const firstRun = await migrateV2(database);
    const secondRun = await migrateV2(database);
    assert.strictEqual(firstRun.baseFound, 51);
    assert.strictEqual(firstRun.baseUpdated, 51);
    assert.strictEqual(firstRun.additionalInserted, 20);
    assert.strictEqual(secondRun.additionalInserted, 0);
    assert.strictEqual(secondRun.trophies, 71);
    assert.strictEqual(
      database.statements.some(sql => /\bDELETE\s+FROM\s+trophies\b/i.test(sql)),
      false,
      'migration must not delete legacy trophies'
    );

    for (const table of fixture.absentTables) {
      assert.strictEqual(await tableExists(database, table), true, `${table} must exist`);
    }
    const versionForeignKeys = await database.all('PRAGMA foreign_key_list(game_versions)');
    assert(versionForeignKeys.some(item => item.from === 'game_id' && item.on_delete === 'CASCADE'));
    assert(versionForeignKeys.some(item => (
      item.from === 'source_version_id' && item.on_delete === 'RESTRICT'
    )));
    const versionIndexes = await database.all('PRAGMA index_list(game_versions)');
    assert(versionIndexes.some(item => item.name === 'idx_game_versions_one_native_list' && item.unique));
    const packageIndexes = await database.all('PRAGMA index_list(trophy_packages)');
    assert(packageIndexes.some(item => item.name === 'idx_trophy_packages_one_base' && item.unique));
    const payloadColumns = await database.all('PRAGMA table_info(game_guide_payloads)');
    assert.deepStrictEqual(
      payloadColumns.map(item => item.name),
      [
        'id',
        'game_id',
        'schema_version',
        'payload_json',
        'payload_hash',
        'validation_status',
        'created_at',
        'updated_at'
      ]
    );

    const trophyColumns = await database.all('PRAGMA table_info(trophies)');
    const trophyColumnNames = trophyColumns.map(item => item.name);
    for (const column of ['version_id', 'package_id', 'display_order']) {
      assert(trophyColumnNames.includes(column), `trophies.${column} must exist`);
    }

    const versions = await database.all(`
      SELECT id, version_code, platform, release_kind, source_version_id,
             is_native, native_trophy_list, save_transfer_supported,
             autopop_supported, upgrade_supported, display_order
      FROM game_versions
      WHERE game_id = 16
      ORDER BY display_order
    `);
    assert.strictEqual(versions.length, 2);
    assert.deepStrictEqual(
      versions.map(item => item.version_code),
      ['ps4-native', 'ps5-backcompat-ps4']
    );
    assert.strictEqual(versions[0].platform, 'PS4');
    assert.strictEqual(versions[0].release_kind, 'native');
    assert.strictEqual(versions[0].is_native, 1);
    assert.strictEqual(versions[0].native_trophy_list, 1);
    assert.strictEqual(versions[1].platform, 'PS5');
    assert.strictEqual(versions[1].release_kind, 'backward_compatibility');
    assert.strictEqual(versions[1].is_native, 0);
    assert.strictEqual(versions[1].source_version_id, versions[0].id);
    assert.strictEqual(versions[1].native_trophy_list, 0);
    assert.strictEqual(versions[1].save_transfer_supported, 1);
    assert.strictEqual(versions[1].autopop_supported, 0);
    assert.strictEqual(versions[1].upgrade_supported, 0);

    const packages = await database.all(`
      SELECT id, package_code, expected_trophy_count, is_online, display_order
      FROM trophy_packages
      WHERE game_id = 16
      ORDER BY display_order
    `);
    assert.deepStrictEqual(
      packages.map(item => item.package_code),
      ['base', 'versus', 'lost-in-nightmares', 'desperate-escape']
    );
    assert.deepStrictEqual(packages.map(item => item.expected_trophy_count), [51, 10, 5, 5]);
    assert.strictEqual(packages.find(item => item.package_code === 'versus').is_online, 1);

    const trophies = await database.all(`
      SELECT t.id, t.trophy_code, t.type, t.version_id, t.package_id, t.display_order,
             t.is_online,
             p.package_code
      FROM trophies t
      JOIN trophy_packages p ON p.id = t.package_id
      WHERE t.game_id = 16
      ORDER BY p.display_order, t.display_order
    `);
    assert.strictEqual(trophies.length, 71);
    assert.deepStrictEqual(
      trophies.slice(0, 51).map(item => item.trophy_code),
      APPROVED_BASE_CODES
    );
    assert.deepStrictEqual(
      trophies.slice(0, 51).map(item => item.id),
      fixture.tables.trophies.map(item => item.id)
    );
    assert(trophies.every(item => item.version_id && item.package_id && item.display_order));
    assert.strictEqual(new Set(trophies.map(item => item.trophy_code)).size, 71);
    assert.strictEqual(
      new Set(trophies.map(item => `${item.package_code}:${item.display_order}`)).size,
      71
    );
    assert.strictEqual(trophies.filter(item => item.id > 16051).length, 20);
    assert.strictEqual(trophies.filter(item => item.package_code === 'versus' && item.is_online === 1).length, 10);

    const packageCounts = Object.fromEntries(
      (await database.all(`
        SELECT p.package_code, COUNT(*) AS total
        FROM trophies t
        JOIN trophy_packages p ON p.id = t.package_id
        WHERE t.game_id = 16
        GROUP BY p.package_code
      `)).map(item => [item.package_code, item.total])
    );
    assert.deepStrictEqual(packageCounts, {
      base: 51,
      'desperate-escape': 5,
      'lost-in-nightmares': 5,
      versus: 10
    });

    const typeCounts = Object.fromEntries(
      (await database.all(`
        SELECT type, COUNT(*) AS total
        FROM trophies
        WHERE game_id = 16
        GROUP BY type
      `)).map(item => [item.type, item.total])
    );
    assert.deepStrictEqual(typeCounts, { Bronze: 53, Ouro: 1, Platina: 1, Prata: 16 });

    const preservedTrophies = await database.all(
      'SELECT id, trophy_code, created_at, updated_at FROM trophies WHERE id <= 16051 ORDER BY id'
    );
    assert.deepStrictEqual(preservedTrophies, originalTrophies);
    assert.deepStrictEqual(
      await database.all('SELECT * FROM user_trophy_progress ORDER BY id'),
      originalProgress
    );
  } finally {
    await database.close();
  }
}

async function assertIntegralRollback(migrateV2, fixture) {
  const database = createMemoryDatabase();
  try {
    await seedLegacyDatabase(database, fixture);
    await database.exec(`
      CREATE TRIGGER reject_re5_v2_trophy
      BEFORE INSERT ON trophies
      WHEN NEW.id > 16051 OR NEW.trophy_code NOT IN (
        ${APPROVED_BASE_CODES.map(code => `'${code}'`).join(',')}
      )
      BEGIN
        SELECT RAISE(ABORT, 'forced V2 insertion failure');
      END;
    `);

    await assert.rejects(() => migrateV2(database), /forced V2 insertion failure/);
    assert.strictEqual(
      (await database.get('SELECT COUNT(*) AS total FROM trophies')).total,
      51
    );
    for (const table of fixture.absentTables) {
      assert.strictEqual(await tableExists(database, table), false, `${table} must roll back`);
    }
    const trophyColumns = await database.all('PRAGMA table_info(trophies)');
    assert.deepStrictEqual(
      trophyColumns.map(item => item.name),
      ['id', 'game_id', 'trophy_code', 'name', 'type', 'created_at', 'updated_at']
    );
  } finally {
    await database.close();
  }
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
  const fixture = loadFixture();
  characterizeFixture(fixture);

  const migrationSource = fs.readFileSync(MIGRATION_PATH, 'utf8');
  if (!migrationSource.includes('migrateGuideSchemaV2PackagesAndVersions')) {
    console.error('RE5 V2 migration is not implemented');
    process.exit(1);
  }

  process.env.DATABASE_PATH = ':memory:';
  const migrationModule = require(MIGRATION_PATH);
  const migrateV2 = migrationModule.migrateGuideSchemaV2PackagesAndVersions;
  if (typeof migrateV2 !== 'function') {
    console.error('RE5 V2 migration is not implemented');
    process.exit(1);
  }

  try {
    await assertSuccessfulMigration(migrateV2, fixture);
    await assertIntegralRollback(migrateV2, fixture);
    console.log('RE5 V2 migration contract passed');
  } finally {
    await closeDefaultMemoryDatabase();
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
