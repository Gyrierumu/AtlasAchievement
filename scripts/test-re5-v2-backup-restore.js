'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = path.join(ROOT, 'data', 'guides', 'resident-evil-5.json');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function openDatabase(filePath) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(filePath, error => {
      if (error) reject(error);
      else resolve(database);
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

function close(database) {
  return new Promise((resolve, reject) => {
    database.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function createSourceDatabase(filePath, snapshot) {
  const database = await openDatabase(filePath);
  try {
    await exec(database, `
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = DELETE;

      CREATE TABLE games (
        id INTEGER PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE trophies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        trophy_code TEXT NOT NULL,
        package_code TEXT NOT NULL,
        type TEXT NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        UNIQUE (game_id, trophy_code)
      );

      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE user_trophy_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        trophy_code TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
        completed_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        UNIQUE (user_id, game_id, trophy_code)
      );

      CREATE INDEX idx_trophies_game_package ON trophies(game_id, package_code);
      CREATE INDEX idx_progress_user_game ON user_trophy_progress(user_id, game_id);
    `);

    await run(
      database,
      'INSERT INTO games (id, slug, name, schema_version, metadata_json) VALUES (?, ?, ?, ?, ?)',
      [
        snapshot.game.id,
        snapshot.game.slug,
        snapshot.game.name,
        snapshot.schemaVersion,
        JSON.stringify({ versions: snapshot.versions, packages: snapshot.trophyPackages })
      ]
    );

    await exec(database, 'BEGIN IMMEDIATE');
    for (const trophy of snapshot.trophies) {
      await run(
        database,
        `INSERT INTO trophies (game_id, trophy_code, package_code, type)
         VALUES (?, ?, ?, ?)`,
        [snapshot.game.id, trophy.trophyCode, trophy.packageCode, trophy.type]
      );
    }
    await exec(database, 'COMMIT');

    await run(
      database,
      'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      [1, 'final-gate-user', 'non-secret-test-hash']
    );

    for (const trophy of snapshot.trophies.slice(0, 3)) {
      await run(
        database,
        `INSERT INTO user_trophy_progress
           (user_id, game_id, trophy_code, completed, completed_at)
         VALUES (?, ?, ?, 1, ?)`,
        [1, snapshot.game.id, trophy.trophyCode, '2026-07-27T12:00:00.000Z']
      );
    }

    assert.strictEqual((await get(database, 'PRAGMA integrity_check')).integrity_check, 'ok');
    assert.strictEqual((await get(database, 'PRAGMA foreign_keys')).foreign_keys, 1);
  } finally {
    await close(database);
  }
}

async function validateRestoredDatabase(filePath) {
  const database = await openDatabase(filePath);
  try {
    await exec(database, 'PRAGMA foreign_keys = ON');
    assert.strictEqual((await get(database, 'PRAGMA integrity_check')).integrity_check, 'ok');
    assert.strictEqual((await get(database, 'PRAGMA foreign_key_check')), undefined);

    const total = await get(database, 'SELECT COUNT(*) AS total FROM trophies WHERE game_id = 16');
    const base = await get(
      database,
      "SELECT COUNT(*) AS total FROM trophies WHERE game_id = 16 AND package_code = 'base'"
    );
    const dlc = await get(
      database,
      "SELECT COUNT(*) AS total FROM trophies WHERE game_id = 16 AND package_code != 'base'"
    );
    const progress = await get(
      database,
      'SELECT COUNT(*) AS total FROM user_trophy_progress WHERE user_id = 1 AND game_id = 16 AND completed = 1'
    );
    const user = await get(database, 'SELECT username FROM users WHERE id = 1');
    const metadata = await get(database, 'SELECT metadata_json FROM games WHERE id = 16');

    assert.strictEqual(total.total, 71, 'restored V2 total must be 71');
    assert.strictEqual(base.total, 51, 'restored V1/base total must be 51');
    assert.strictEqual(dlc.total, 20, 'restored DLC total must be 20');
    assert.strictEqual(progress.total, 3, 'restored user progress must be preserved');
    assert.strictEqual(user.username, 'final-gate-user');
    assert.strictEqual(JSON.parse(metadata.metadata_json).versions.length, 2);

    return {
      integrity: 'ok',
      total: total.total,
      base: base.total,
      dlc: dlc.total,
      progress: progress.total
    };
  } finally {
    await close(database);
  }
}

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-re5-final-backup-'));
  const sourcePath = path.join(temporaryRoot, 'source.sqlite');
  const backupPath = path.join(temporaryRoot, 'backup', 'database.sqlite');
  const restoredPath = path.join(temporaryRoot, 'restore', 'database.sqlite');

  try {
    await createSourceDatabase(sourcePath, snapshot);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(sourcePath, backupPath);

    const sourceHash = sha256(sourcePath);
    const backupHash = sha256(backupPath);
    assert.strictEqual(backupHash, sourceHash, 'backup hash must match the closed source database');
    assert(fs.statSync(backupPath).size > 0, 'backup must not be empty');

    fs.mkdirSync(path.dirname(restoredPath), { recursive: true });
    fs.copyFileSync(backupPath, restoredPath);
    assert.strictEqual(sha256(restoredPath), backupHash, 'restored file hash must match backup');

    const validation = await validateRestoredDatabase(restoredPath);
    console.log(JSON.stringify({
      status: 'PASS',
      scope: 'LOCAL_TEMPORARY_ONLY',
      sourceSha256: sourceHash,
      backupSha256: backupHash,
      restoredSha256: sha256(restoredPath),
      backupBytes: fs.statSync(backupPath).size,
      ...validation
    }, null, 2));
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
