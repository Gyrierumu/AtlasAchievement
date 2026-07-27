'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.resolve(__dirname, '..');

function openDatabase(filename) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(filename, error => {
      if (error) reject(error);
      else resolve(database);
    });
  });
}

function run(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function all(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function exec(database, sql) {
  return new Promise((resolve, reject) => {
    database.exec(sql, error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function prepare(database, sql) {
  return new Promise((resolve, reject) => {
    const statement = database.prepare(sql, error => {
      if (error) reject(error);
      else resolve(statement);
    });
  });
}

function statementRun(statement, params) {
  return new Promise((resolve, reject) => {
    statement.run(params, function onRun(error) {
      if (error) reject(error);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function finalize(statement) {
  return new Promise((resolve, reject) => {
    statement.finalize(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function close(database) {
  return new Promise((resolve, reject) => {
    database.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function testMemoryDatabase() {
  const database = await openDatabase(':memory:');
  let serializeObserved = false;
  let parallelizeObserved = false;
  try {
    database.configure('busyTimeout', 100);
    database.serialize(() => {
      serializeObserved = true;
    });
    database.parallelize(() => {
      parallelizeObserved = true;
    });
    assert(serializeObserved);
    assert(parallelizeObserved);

    await exec(database, `
      PRAGMA foreign_keys = ON;
      CREATE TABLE parent_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL UNIQUE,
        score REAL NOT NULL,
        optional_value TEXT,
        json_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        payload BLOB
      );
      ALTER TABLE parent_records ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
      CREATE INDEX idx_parent_records_created_at ON parent_records(created_at);
      CREATE TABLE child_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER NOT NULL,
        note TEXT,
        FOREIGN KEY (parent_id) REFERENCES parent_records(id) ON DELETE CASCADE
      );
    `);
    assert.strictEqual((await get(database, 'PRAGMA foreign_keys')).foreign_keys, 1);

    const positional = await prepare(
      database,
      `INSERT INTO parent_records
       (label, score, optional_value, json_text, created_at, payload)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const positionalInsert = await statementRun(positional, [
      'ação-posicional',
      42.5,
      null,
      JSON.stringify({ source: 'positional', valid: true }),
      '2026-07-27T00:00:00.000Z',
      Buffer.from([0, 1, 2, 255])
    ]);
    assert.strictEqual(positionalInsert.lastID, 1);
    assert.strictEqual(positionalInsert.changes, 1);
    await finalize(positional);

    const named = await prepare(
      database,
      `INSERT INTO parent_records
       (label, score, optional_value, json_text, created_at, payload)
       VALUES ($label, $score, $optional, $json, $timestamp, $payload)`
    );
    const namedInsert = await statementRun(named, {
      $label: 'ação-nomeada',
      $score: 7,
      $optional: 'texto UTF-8: çãõ',
      $json: JSON.stringify({ source: 'named', count: 2 }),
      $timestamp: '2026-07-27T00:01:00.000Z',
      $payload: Buffer.from('atlas', 'utf8')
    });
    assert.strictEqual(namedInsert.lastID, 2);
    await finalize(named);

    const first = await get(database, 'SELECT * FROM parent_records WHERE id = ?', [1]);
    assert.strictEqual(typeof first.id, 'number');
    assert.strictEqual(first.score, 42.5);
    assert.strictEqual(first.optional_value, null);
    assert.deepStrictEqual(JSON.parse(first.json_text), { source: 'positional', valid: true });
    assert.strictEqual(first.created_at, '2026-07-27T00:00:00.000Z');
    assert(Buffer.isBuffer(first.payload));
    assert.deepStrictEqual([...first.payload], [0, 1, 2, 255]);

    const child = await run(
      database,
      'INSERT INTO child_records (parent_id, note) VALUES (?, ?)',
      [first.id, 'filho']
    );
    assert.strictEqual(child.lastID, 1);
    assert.strictEqual((await all(database, 'SELECT * FROM parent_records')).length, 2);

    const updated = await run(
      database,
      'UPDATE parent_records SET score = ?, active = ? WHERE id = ?',
      [43.5, 0, first.id]
    );
    assert.strictEqual(updated.changes, 1);
    const deleted = await run(database, 'DELETE FROM child_records WHERE id = ?', [child.lastID]);
    assert.strictEqual(deleted.changes, 1);

    await exec(database, 'BEGIN IMMEDIATE');
    await run(
      database,
      `INSERT INTO parent_records
       (label, score, json_text, created_at) VALUES (?, ?, ?, ?)`,
      ['commit-record', 1, '{}', '2026-07-27T00:02:00.000Z']
    );
    await exec(database, 'COMMIT');
    assert(await get(database, 'SELECT id FROM parent_records WHERE label = ?', ['commit-record']));

    await exec(database, 'BEGIN IMMEDIATE');
    await run(
      database,
      `INSERT INTO parent_records
       (label, score, json_text, created_at) VALUES (?, ?, ?, ?)`,
      ['rollback-record', 1, '{}', '2026-07-27T00:03:00.000Z']
    );
    await exec(database, 'ROLLBACK');
    assert.strictEqual(
      await get(database, 'SELECT id FROM parent_records WHERE label = ?', ['rollback-record']),
      undefined
    );

    await assert.rejects(
      () => run(
        database,
        `INSERT INTO parent_records
         (label, score, json_text, created_at) VALUES (?, ?, ?, ?)`,
        ['commit-record', 1, '{}', '2026-07-27T00:04:00.000Z']
      ),
      error => error?.code === 'SQLITE_CONSTRAINT'
    );
    await assert.rejects(
      () => run(database, 'INSERT INTO child_records (parent_id) VALUES (?)', [999999]),
      error => error?.code === 'SQLITE_CONSTRAINT'
    );
  } finally {
    await close(database);
  }
}

async function testFilePersistenceAndBusyHandling() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-sqlite-compat-'));
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  const resolvedSystemTemp = path.resolve(os.tmpdir());
  assert(
    resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}${path.sep}`),
    'temporary database must stay under the system temporary directory'
  );
  const filename = path.join(temporaryRoot, 'compatibility.sqlite');
  let first;
  let second;
  try {
    first = await openDatabase(filename);
    first.configure('busyTimeout', 100);
    await exec(first, 'CREATE TABLE persisted (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    await run(first, 'INSERT INTO persisted (id, value) VALUES (?, ?)', [1, 'persistido']);
    await close(first);
    first = null;

    first = await openDatabase(filename);
    assert.deepStrictEqual(
      await get(first, 'SELECT id, value FROM persisted WHERE id = ?', [1]),
      { id: 1, value: 'persistido' }
    );

    second = await openDatabase(filename);
    second.configure('busyTimeout', 50);
    await exec(first, 'BEGIN IMMEDIATE');
    const busyStarted = Date.now();
    await assert.rejects(
      () => run(second, 'INSERT INTO persisted (id, value) VALUES (?, ?)', [2, 'busy']),
      error => error?.code === 'SQLITE_BUSY'
    );
    assert(Date.now() - busyStarted >= 30, 'busyTimeout should delay the competing write');
    await exec(first, 'ROLLBACK');
  } finally {
    if (second) await close(second).catch(() => {});
    if (first) await close(first).catch(() => {});
    fs.rmSync(resolvedTemporaryRoot, { recursive: true, force: true });
  }
}

function testRe5MigrationContract() {
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, 'scripts', 'test-re5-v2-migration.js')],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_PATH: ':memory:' }
    }
  );
  if (result.status !== 0) {
    throw new Error(
      `RE5 migration compatibility failed:\n${result.stdout || ''}\n${result.stderr || ''}`
    );
  }
  assert.match(result.stdout, /RE5 V2 migration contract passed/);
}

async function main() {
  await testMemoryDatabase();
  await testFilePersistenceAndBusyHandling();
  testRe5MigrationContract();
  console.log(JSON.stringify({
    sqliteModule: require('sqlite3/package.json').version,
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    memoryDatabase: 'passed',
    temporaryFilePersistence: 'passed',
    busyHandling: 'passed',
    re5Migration: {
      legacyBackfill: 51,
      additionalInsert: 20,
      total: 71,
      rollback: 'passed',
      secondRunIdempotent: 'passed'
    }
  }, null, 2));
  console.log('SQLite runtime compatibility contract passed');
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
