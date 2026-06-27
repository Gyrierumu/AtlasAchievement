const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA_DIR = path.join(ROOT, 'data', 'guides');

function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split('=');
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortDeep(value[key]);
        return sorted;
      }, {});
  }
  return value;
}

function stableStringify(value) {
  return `${JSON.stringify(sortDeep(value), null, 2)}\n`;
}

function normalizeDataDir(input) {
  return path.resolve(ROOT, input || DEFAULT_DATA_DIR);
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function getTimestamp() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('') + '-' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function createDatabaseBackup(databasePath, label) {
  const resolvedDatabasePath = path.resolve(databasePath);
  if (!fs.existsSync(resolvedDatabasePath)) {
    return null;
  }

  const backupDirectory = path.join(path.dirname(resolvedDatabasePath), 'backups', `${label}-${getTimestamp()}`);
  ensureDirectory(backupDirectory);
  const backupPath = path.join(backupDirectory, path.basename(resolvedDatabasePath));
  fs.copyFileSync(resolvedDatabasePath, backupPath);
  return backupPath;
}

function openDatabase(databasePath) {
  const resolvedDatabasePath = path.resolve(databasePath);
  ensureDirectory(path.dirname(resolvedDatabasePath));
  const db = new sqlite3.Database(resolvedDatabasePath);

  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

  const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
  });

  const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)));
  });

  const exec = sql => new Promise((resolve, reject) => {
    db.exec(sql, error => (error ? reject(error) : resolve()));
  });

  const close = () => new Promise((resolve, reject) => {
    db.close(error => (error ? reject(error) : resolve()));
  });

  return { db, run, get, all, exec, close };
}

function normalizeGuideFileName(slug) {
  return `${String(slug || '').trim().toLowerCase()}.json`;
}

module.exports = {
  ROOT,
  DEFAULT_DATA_DIR,
  parseArgs,
  stableStringify,
  normalizeDataDir,
  ensureDirectory,
  createDatabaseBackup,
  openDatabase,
  normalizeGuideFileName
};
