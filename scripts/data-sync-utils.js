const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

function findPackageRoot(startDir = __dirname) {
  let currentDir = path.resolve(startDir);

  while (true) {
    const packagePath = path.join(currentDir, 'package.json');
    const scriptsPath = path.join(currentDir, 'scripts');
    const serverPath = path.join(currentDir, 'server.js');
    if (fs.existsSync(packagePath) && fs.existsSync(scriptsPath) && fs.existsSync(serverPath)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(`Nao foi possivel encontrar a raiz do projeto a partir de ${startDir}.`);
    }
    currentDir = parentDir;
  }
}

const ROOT = findPackageRoot(__dirname);
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

function createContentHash(value) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(value), 'utf8')
    .digest('hex');
}

const V2_OPERATIONAL_FIELDS = new Set([
  'generatedAt',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at'
]);

const V2_ORDERED_ARRAYS = Object.freeze({
  versions: 'displayOrder',
  trophyPackages: 'displayOrder',
  trophies: 'globalOrder',
  roadmap: 'order',
  guideContent: 'order',
  collectibles: 'order',
  inventoryRequirements: 'order',
  upgradeRequirements: 'order',
  sources: 'sourceCode',
  claims: 'claimCode',
  redirects: 'from'
});

const V2_CODE_ARRAY_FIELDS = new Set([
  'packageCodes',
  'trophyCodes',
  'collectibleGroups',
  'saveCodes',
  'relatedTrophyCodes',
  'sourceCodes'
]);

function normalizeSnapshotString(value) {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim();
}

function compareOrderedValues(left, right, field) {
  const leftValue = left?.[field];
  const rightValue = right?.[field];
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return leftValue - rightValue;
  }
  return String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'en');
}

function normalizeGuideSnapshotV2(snapshot, options = {}) {
  const omitOperationalTimestamps = options.omitOperationalTimestamps !== false;
  const omitGeneratedNumericIds = options.omitGeneratedNumericIds !== false;

  function visit(value, pathSegments = [], parentKey = '') {
    if (typeof value === 'string') return normalizeSnapshotString(value);
    if (typeof value === 'number') {
      return Number.isFinite(value) && Number.isInteger(value) ? value : value;
    }
    if (typeof value === 'boolean' || value === null) return value;
    if (Array.isArray(value)) {
      const normalized = value.map(item => visit(item, pathSegments, parentKey));
      if (V2_CODE_ARRAY_FIELDS.has(parentKey)) {
        return [...normalized].sort((left, right) => (
          String(left ?? '').localeCompare(String(right ?? ''), 'en')
        ));
      }
      const rootField = pathSegments.length === 1 ? pathSegments[0] : null;
      const orderField = rootField ? V2_ORDERED_ARRAYS[rootField] : null;
      return orderField
        ? [...normalized].sort((left, right) => compareOrderedValues(left, right, orderField))
        : normalized;
    }
    if (!value || typeof value !== 'object') return value;

    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (omitOperationalTimestamps && V2_OPERATIONAL_FIELDS.has(key)) return result;
        if (
          omitGeneratedNumericIds
          && key === 'id'
          && typeof value[key] === 'number'
          && pathSegments[0] !== 'game'
        ) {
          return result;
        }
        if (value[key] === undefined) return result;
        result[key] = visit(value[key], [...pathSegments, key], key);
        return result;
      }, {});
  }

  return visit(snapshot);
}

function hashGuideSnapshotV2(snapshot, options = {}) {
  const normalized = normalizeGuideSnapshotV2(snapshot, options);
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized), 'utf8')
    .digest('hex');
}

function compareGuideSnapshotsV2(left, right, options = {}) {
  const normalizedLeft = normalizeGuideSnapshotV2(left, options);
  const normalizedRight = normalizeGuideSnapshotV2(right, options);
  const differences = [];

  function compare(leftValue, rightValue, currentPath) {
    if (Object.is(leftValue, rightValue)) return;
    if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
      if (!Array.isArray(leftValue) || !Array.isArray(rightValue)) {
        differences.push({ path: currentPath, left: leftValue, right: rightValue });
        return;
      }
      if (leftValue.length !== rightValue.length) {
        differences.push({
          path: `${currentPath}.length`,
          left: leftValue.length,
          right: rightValue.length
        });
      }
      const length = Math.max(leftValue.length, rightValue.length);
      for (let index = 0; index < length; index += 1) {
        compare(leftValue[index], rightValue[index], `${currentPath}[${index}]`);
      }
      return;
    }
    const leftIsObject = leftValue && typeof leftValue === 'object';
    const rightIsObject = rightValue && typeof rightValue === 'object';
    if (leftIsObject || rightIsObject) {
      if (!leftIsObject || !rightIsObject) {
        differences.push({ path: currentPath, left: leftValue, right: rightValue });
        return;
      }
      const keys = new Set([...Object.keys(leftValue), ...Object.keys(rightValue)]);
      for (const key of [...keys].sort()) {
        compare(leftValue[key], rightValue[key], currentPath ? `${currentPath}.${key}` : key);
      }
      return;
    }
    differences.push({ path: currentPath, left: leftValue, right: rightValue });
  }

  compare(normalizedLeft, normalizedRight, '');
  return {
    equal: differences.length === 0,
    differences,
    left: normalizedLeft,
    right: normalizedRight
  };
}

module.exports = {
  ROOT,
  DEFAULT_DATA_DIR,
  findPackageRoot,
  parseArgs,
  stableStringify,
  createContentHash,
  normalizeDataDir,
  ensureDirectory,
  createDatabaseBackup,
  openDatabase,
  normalizeGuideFileName,
  normalizeGuideSnapshotV2,
  hashGuideSnapshotV2,
  compareGuideSnapshotsV2
};
