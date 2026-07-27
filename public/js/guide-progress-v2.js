(function (globalScope, factory) {
  'use strict';

  const api = factory(globalScope);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (globalScope && globalScope.document) {
    globalScope.AtlasGuideProgressV2 = api;
    api.startWhenReady();
  }
})(typeof window !== 'undefined' ? window : globalThis, function (globalScope) {
  'use strict';

  const VERSION = 2;
  const DEFAULT_SLUG = 'resident-evil-5';
  const STORAGE_KEY_PREFIX = 'atlas:guide-progress:v2:';
  const STORAGE_KEY = `${STORAGE_KEY_PREFIX}${DEFAULT_SLUG}`;
  const ARCHIVE_KEY_PREFIX = 'atlas:guide-progress:archive:';
  const MAX_DOCUMENT_SIZE = 256 * 1024;
  const EXPECTED_TROPHY_COUNT = 71;
  const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
  const VALID_SOURCES = new Set(['local', 'server', 'merged']);
  const VALID_MIGRATION_STATUSES = new Set([
    'not-needed',
    'completed',
    'completed-with-ambiguous-dlc',
    'failed'
  ]);
  const VALID_PACKAGE_CODES = new Set([
    'base',
    'versus',
    'lost-in-nightmares',
    'desperate-escape'
  ]);
  const EVENT_NAMES = new Set([
    'guide_progress_initialized',
    'guide_progress_changed',
    'guide_progress_reset_package',
    'guide_progress_reset_all',
    'guide_progress_legacy_migrated',
    'guide_progress_legacy_ambiguous_dlc',
    'guide_progress_sync_success',
    'guide_progress_sync_failed',
    'guide_progress_invalid_local_state'
  ]);
  const PROGRESS_LABELS = Object.freeze({
    platinum: 'Progresso da platina',
    base: 'Progresso do jogo-base',
    versus: 'Progresso de Versus',
    'lost-in-nightmares': 'Progresso de Lost in Nightmares',
    'desperate-escape': 'Progresso de Desperate Escape',
    completion: 'Progresso de 100%'
  });

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function containsDangerousKey(value, visited = new Set()) {
    if (!value || typeof value !== 'object' || visited.has(value)) return false;
    visited.add(value);
    if (!Array.isArray(value) && Object.keys(value).some(key => DANGEROUS_KEYS.has(key))) {
      return true;
    }
    return Object.keys(value).some(key => containsDangerousKey(value[key], visited));
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function safeNow(now) {
    const candidate = typeof now === 'function' ? now() : new Date().toISOString();
    const date = new Date(candidate);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  function isIsoTimestamp(value) {
    if (typeof value !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString() === value;
  }

  function compareTimestamps(left, right) {
    const leftTime = isIsoTimestamp(left) ? Date.parse(left) : -1;
    const rightTime = isIsoTimestamp(right) ? Date.parse(right) : -1;
    return leftTime === rightTime ? 0 : leftTime > rightTime ? 1 : -1;
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!isPlainObject(value)) return value;
    const output = {};
    Object.keys(value).sort().forEach(key => {
      if (!DANGEROUS_KEYS.has(key)) output[key] = stableValue(value[key]);
    });
    return output;
  }

  function stableStringify(value) {
    return JSON.stringify(stableValue(value));
  }

  function normalizeDescriptor(item) {
    const trophyCode = String(item?.trophyCode || item?.trophy_code || '').trim();
    const packageCode = String(item?.packageCode || item?.package_code || '').trim();
    const globalOrder = Number(item?.globalOrder || item?.displayOrder || item?.display_order || 0);
    return { trophyCode, packageCode, globalOrder };
  }

  function normalizeDescriptors(trophies) {
    return Array.isArray(trophies) ? trophies.map(normalizeDescriptor) : [];
  }

  function defaultMigration() {
    return {
      status: 'not-needed',
      completedAt: null,
      ambiguousDlcDetected: false,
      warningAcknowledged: false
    };
  }

  function createEmptyDocument(options = {}) {
    const timestamp = safeNow(options.now);
    return {
      version: VERSION,
      slug: String(options.slug || DEFAULT_SLUG),
      updatedAt: timestamp,
      source: String(options.source || 'local'),
      dirty: Boolean(options.dirty),
      trophies: {},
      checklists: {},
      migrations: {
        phase6Legacy: defaultMigration()
      }
    };
  }

  function normalizeMigration(value) {
    if (!isPlainObject(value)) return defaultMigration();
    const status = VALID_MIGRATION_STATUSES.has(value.status)
      ? value.status
      : 'not-needed';
    const completedAt = value.completedAt === null || value.completedAt === undefined
      ? null
      : isIsoTimestamp(value.completedAt) ? value.completedAt : null;
    return {
      status,
      completedAt,
      ambiguousDlcDetected: Boolean(value.ambiguousDlcDetected),
      warningAcknowledged: Boolean(value.warningAcknowledged),
      ...(typeof value.archiveKey === 'string' && value.archiveKey
        ? { archiveKey: value.archiveKey.slice(0, 400) }
        : {})
    };
  }

  function validateProgressDocument(documentValue, options = {}) {
    const slug = String(options.slug || DEFAULT_SLUG);
    const descriptors = normalizeDescriptors(options.trophies);
    const knownCodes = options.knownCodes instanceof Set
      ? options.knownCodes
      : new Set(descriptors.map(item => item.trophyCode).filter(Boolean));
    let serializedLength = Number(options.serializedLength || 0);
    const ignoredCodes = [];

    if (serializedLength > MAX_DOCUMENT_SIZE) {
      return { valid: false, reason: 'document-too-large', ignoredCodes };
    }
    if (!isPlainObject(documentValue)) {
      return { valid: false, reason: 'invalid-object', ignoredCodes };
    }
    if (!serializedLength) {
      try {
        serializedLength = JSON.stringify(documentValue).length;
      } catch (_error) {
        return { valid: false, reason: 'invalid-object', ignoredCodes };
      }
      if (serializedLength > MAX_DOCUMENT_SIZE) {
        return { valid: false, reason: 'document-too-large', ignoredCodes };
      }
    }
    if (containsDangerousKey(documentValue)) {
      return { valid: false, reason: 'dangerous-key', ignoredCodes };
    }
    if (
      documentValue.version !== VERSION
      || documentValue.slug !== slug
      || !isIsoTimestamp(documentValue.updatedAt)
      || !VALID_SOURCES.has(documentValue.source)
      || typeof documentValue.dirty !== 'boolean'
      || !isPlainObject(documentValue.trophies)
      || Object.keys(documentValue.trophies).length > EXPECTED_TROPHY_COUNT
    ) {
      return { valid: false, reason: 'invalid-schema', ignoredCodes };
    }

    const trophies = {};
    for (const trophyCode of Object.keys(documentValue.trophies).sort()) {
      if (DANGEROUS_KEYS.has(trophyCode)) {
        return { valid: false, reason: 'dangerous-key', ignoredCodes };
      }
      const entry = documentValue.trophies[trophyCode];
      if (!knownCodes.has(trophyCode)) {
        ignoredCodes.push(trophyCode);
        continue;
      }
      if (
        !isPlainObject(entry)
        || Object.keys(entry).some(key => DANGEROUS_KEYS.has(key))
        || typeof entry.completed !== 'boolean'
        || !isIsoTimestamp(entry.updatedAt)
        || (entry.source !== undefined && !VALID_SOURCES.has(entry.source))
      ) {
        return { valid: false, reason: 'invalid-trophy-entry', ignoredCodes };
      }
      trophies[trophyCode] = {
        completed: entry.completed,
        updatedAt: entry.updatedAt,
        source: VALID_SOURCES.has(entry.source) ? entry.source : documentValue.source
      };
    }

    const migrations = isPlainObject(documentValue.migrations)
      ? documentValue.migrations
      : {};
    if (Object.keys(migrations).some(key => DANGEROUS_KEYS.has(key))) {
      return { valid: false, reason: 'dangerous-key', ignoredCodes };
    }
    const legacyMigration = migrations.phase6Legacy || migrations.phase6;
    const normalized = {
      version: VERSION,
      slug,
      updatedAt: documentValue.updatedAt,
      source: documentValue.source,
      dirty: documentValue.dirty,
      trophies,
      checklists: {},
      migrations: {
        phase6Legacy: normalizeMigration(legacyMigration)
      }
    };
    return { valid: true, value: normalized, ignoredCodes };
  }

  function archiveInvalidLocalValue(storage, options = {}) {
    if (!storage || typeof storage.setItem !== 'function') return null;
    const timestamp = safeNow(options.now);
    const archiveKey = `${ARCHIVE_KEY_PREFIX}${options.slug || DEFAULT_SLUG}:${timestamp}`;
    const wrapper = {
      reason: String(options.reason || 'invalid-local-schema'),
      archivedAt: timestamp,
      originalValue: String(options.originalValue || '')
    };
    try {
      storage.setItem(archiveKey, stableStringify(wrapper));
      return archiveKey;
    } catch (_error) {
      return null;
    }
  }

  function archiveLegacyValue(storage, legacyKey, originalValue, timestamp) {
    const archiveKey = `${legacyKey}:archived:${timestamp}`;
    storage.setItem(archiveKey, originalValue);
    return archiveKey;
  }

  function scanLegacyState(value, options = {}) {
    const allowedBaseCodes = options.allowedBaseCodes instanceof Set
      ? options.allowedBaseCodes
      : new Set(options.allowedBaseCodes || []);
    const found = new Map();
    let ambiguousDlcDetected = false;
    let unknownCodeCount = 0;
    const visited = new Set();

    function visit(node) {
      if (!node || typeof node !== 'object' || visited.has(node)) return;
      visited.add(node);
      if (Array.isArray(node)) {
        node.forEach(item => {
          if (typeof item === 'string') {
            const code = item.trim();
            if (allowedBaseCodes.has(code)) found.set(code, true);
            else if (code) unknownCodeCount += 1;
          } else {
            visit(item);
          }
        });
        return;
      }
      Object.keys(node).forEach(key => {
        if (DANGEROUS_KEYS.has(key)) return;
        const child = node[key];
        const code = String(key).trim();
        if (!code && child === true) ambiguousDlcDetected = true;
        if (allowedBaseCodes.has(code) && typeof child === 'boolean') {
          found.set(code, child);
          return;
        }
        if (
          code
          && typeof child === 'boolean'
          && !['completed', 'dirty'].includes(code)
        ) {
          unknownCodeCount += 1;
        }
        visit(child);
      });
    }

    visit(value);
    return { found, ambiguousDlcDetected, unknownCodeCount };
  }

  function migrateLegacyProgress(options = {}) {
    const storage = options.storage;
    const targetKey = String(options.targetKey || `${STORAGE_KEY_PREFIX}${options.slug || DEFAULT_SLUG}`);
    const legacyKey = String(options.legacyKey || '');
    const slug = String(options.slug || DEFAULT_SLUG);
    const now = () => safeNow(options.now);
    const allCodes = new Set([
      ...(options.baseCodeAllowlist || []),
      ...(options.dlcCodes || [])
    ]);
    const descriptors = [...allCodes].map(trophyCode => ({ trophyCode, packageCode: '' }));

    if (!storage || !legacyKey) {
      return { status: 'not-needed', warningShown: false, migratedBaseCodes: [] };
    }

    let existingRaw = null;
    try {
      existingRaw = storage.getItem(targetKey);
    } catch (_error) {
      return { status: 'failed', warningShown: false, migratedBaseCodes: [] };
    }
    if (existingRaw !== null) {
      try {
        const existing = JSON.parse(existingRaw);
        const validation = validateProgressDocument(existing, {
          slug,
          trophies: descriptors,
          serializedLength: existingRaw.length
        });
        if (validation.valid) {
          return { status: 'already-migrated', warningShown: false, migratedBaseCodes: [] };
        }
        archiveInvalidLocalValue(storage, {
          slug,
          reason: validation.reason,
          originalValue: existingRaw,
          now: options.now
        });
      } catch (_error) {
        archiveInvalidLocalValue(storage, {
          slug,
          reason: 'invalid-json',
          originalValue: existingRaw,
          now: options.now
        });
      }
    }

    let legacyRaw = null;
    try {
      legacyRaw = storage.getItem(legacyKey);
    } catch (_error) {
      return { status: 'failed', warningShown: false, migratedBaseCodes: [] };
    }
    if (legacyRaw === null) {
      return { status: 'not-needed', warningShown: false, migratedBaseCodes: [] };
    }

    const timestamp = now();
    let archiveKey = null;
    try {
      archiveKey = archiveLegacyValue(storage, legacyKey, legacyRaw, timestamp);
    } catch (_error) {
      return { status: 'failed', warningShown: false, migratedBaseCodes: [] };
    }

    let legacyValue;
    try {
      legacyValue = JSON.parse(legacyRaw);
    } catch (_error) {
      const failed = createEmptyDocument({ slug, now: () => timestamp });
      failed.migrations.phase6Legacy = {
        status: 'failed',
        completedAt: timestamp,
        ambiguousDlcDetected: false,
        warningAcknowledged: false,
        archiveKey
      };
      try {
        storage.setItem(targetKey, stableStringify(failed));
        storage.removeItem?.(legacyKey);
      } catch (_writeError) {}
      return {
        status: 'failed',
        warningShown: false,
        migratedBaseCodes: [],
        archiveKey,
        reason: 'invalid-json'
      };
    }

    const scan = scanLegacyState(legacyValue, {
      allowedBaseCodes: new Set(options.baseCodeAllowlist || [])
    });
    const status = scan.ambiguousDlcDetected
      ? 'completed-with-ambiguous-dlc'
      : 'completed';
    const documentValue = createEmptyDocument({ slug, now: () => timestamp });
    scan.found.forEach((completed, trophyCode) => {
      documentValue.trophies[trophyCode] = {
        completed,
        updatedAt: timestamp,
        source: 'local'
      };
    });
    documentValue.dirty = scan.found.size > 0;
    documentValue.migrations.phase6Legacy = {
      status,
      completedAt: timestamp,
      ambiguousDlcDetected: scan.ambiguousDlcDetected,
      warningAcknowledged: false,
      archiveKey
    };
    storage.setItem(targetKey, stableStringify(documentValue));
    try {
      storage.removeItem?.(legacyKey);
    } catch (_error) {}
    return {
      status,
      warningShown: scan.ambiguousDlcDetected,
      migratedBaseCodes: [...scan.found.keys()].sort(),
      migratedDlcCodes: [],
      unknownCodeCount: scan.unknownCodeCount,
      ambiguousDlcDetected: scan.ambiguousDlcDetected,
      archiveKey
    };
  }

  function mergeProgressEntry(localEntry, serverEntry) {
    if (!localEntry) return clone(serverEntry);
    if (!serverEntry) return clone(localEntry);
    const comparison = compareTimestamps(localEntry.updatedAt, serverEntry.updatedAt);
    if (comparison > 0) return clone({ ...localEntry, source: localEntry.source || 'local' });
    return clone({ ...serverEntry, source: 'server' });
  }

  function mergeProgressDocuments(localDocument, serverDocument, trophies, options = {}) {
    const descriptors = normalizeDescriptors(trophies);
    const timestamp = safeNow(options.now);
    const output = createEmptyDocument({
      slug: options.slug || localDocument?.slug || serverDocument?.slug || DEFAULT_SLUG,
      now: () => timestamp,
      source: 'merged'
    });
    let localWinnerCount = 0;
    descriptors.forEach(({ trophyCode }) => {
      const localEntry = localDocument?.trophies?.[trophyCode];
      const serverEntry = serverDocument?.trophies?.[trophyCode];
      const winner = mergeProgressEntry(localEntry, serverEntry);
      if (!winner) return;
      if (localEntry && (!serverEntry || compareTimestamps(localEntry.updatedAt, serverEntry.updatedAt) > 0)) {
        localWinnerCount += 1;
      }
      output.trophies[trophyCode] = winner;
    });
    output.updatedAt = [localDocument?.updatedAt, serverDocument?.updatedAt, timestamp]
      .filter(isIsoTimestamp)
      .sort()
      .at(-1);
    output.dirty = localWinnerCount > 0;
    output.migrations.phase6Legacy = normalizeMigration(
      localDocument?.migrations?.phase6Legacy || serverDocument?.migrations?.phase6Legacy
    );
    return { document: output, localWinnerCount };
  }

  function summarizeProgress(documentValue, trophies) {
    const descriptors = normalizeDescriptors(trophies);
    const packages = {};
    descriptors.forEach(item => {
      if (!packages[item.packageCode]) {
        packages[item.packageCode] = { completed: 0, total: 0, percent: 0 };
      }
      packages[item.packageCode].total += 1;
      if (documentValue?.trophies?.[item.trophyCode]?.completed === true) {
        packages[item.packageCode].completed += 1;
      }
    });
    Object.values(packages).forEach(summary => {
      summary.percent = summary.total
        ? Math.round((summary.completed / summary.total) * 100)
        : 0;
    });
    const completed = descriptors.reduce((total, item) => (
      total + (documentValue?.trophies?.[item.trophyCode]?.completed === true ? 1 : 0)
    ), 0);
    const basePackageCode = own(packages, 'base') ? 'base' : 'base-game';
    const base = packages[basePackageCode] || { completed: 0, total: 0, percent: 0 };
    const total = {
      completed,
      total: descriptors.length,
      percent: descriptors.length ? Math.round((completed / descriptors.length) * 100) : 0
    };
    return {
      packages,
      base: { ...base },
      platinum: { ...base },
      completion: { ...total },
      total: { ...total }
    };
  }

  function buildProgressAria(progress, label = 'Progresso') {
    const completed = Math.max(0, Number(progress?.completed || 0));
    const total = Math.max(0, Number(progress?.total || 0));
    return {
      role: 'progressbar',
      'aria-label': `${label}: ${completed} de ${total}`,
      'aria-valuemin': '0',
      'aria-valuemax': String(total),
      'aria-valuenow': String(Math.min(completed, total))
    };
  }

  function createProgressStore(options = {}) {
    const slug = String(options.slug || DEFAULT_SLUG);
    const storageKey = String(options.storageKey || `${STORAGE_KEY_PREFIX}${slug}`);
    const descriptors = normalizeDescriptors(options.trophies);
    const knownCodes = new Set(descriptors.map(item => item.trophyCode));
    const storage = options.storage || null;
    const diagnostics = [];
    let persistentStorage = Boolean(storage);
    let syncRemote = typeof options.syncRemote === 'function' ? options.syncRemote : null;
    let syncPromise = null;
    let state;

    function diagnose(reasonCode, details = {}) {
      const diagnostic = { reasonCode, slug, ...details };
      diagnostics.push(diagnostic);
      options.onDiagnostic?.(diagnostic);
    }

    function write() {
      if (!persistentStorage || !storage) return false;
      try {
        storage.setItem(storageKey, stableStringify(state));
        return true;
      } catch (_error) {
        persistentStorage = false;
        diagnose('local-storage-unavailable');
        return false;
      }
    }

    function load() {
      let raw = null;
      if (storage) {
        try {
          raw = storage.getItem(storageKey);
        } catch (_error) {
          persistentStorage = false;
          diagnose('local-storage-unavailable');
        }
      }
      if (raw !== null) {
        if (raw.length > MAX_DOCUMENT_SIZE) {
          archiveInvalidLocalValue(storage, {
            slug,
            reason: 'document-too-large',
            originalValue: raw,
            now: options.now
          });
          try {
            storage?.removeItem?.(storageKey);
          } catch (_error) {}
          diagnose('invalid-local-schema', { reason: 'document-too-large' });
        } else {
          try {
            const parsed = JSON.parse(raw);
            const validation = validateProgressDocument(parsed, {
              slug,
              trophies: descriptors,
              serializedLength: raw.length
            });
            if (validation.valid) {
              if (validation.ignoredCodes.length) {
                diagnose('unknown-local-codes-ignored', {
                  ignoredCount: validation.ignoredCodes.length
                });
              }
              return validation.value;
            }
            archiveInvalidLocalValue(storage, {
              slug,
              reason: validation.reason,
              originalValue: raw,
              now: options.now
            });
            try {
              storage?.removeItem?.(storageKey);
            } catch (_error) {}
            diagnose('invalid-local-schema', { reason: validation.reason });
          } catch (_error) {
            archiveInvalidLocalValue(storage, {
              slug,
              reason: 'invalid-json',
              originalValue: raw,
              now: options.now
            });
            try {
              storage?.removeItem?.(storageKey);
            } catch (_removeError) {}
            diagnose('invalid-local-json');
          }
        }
      }

      if (typeof options.migrateProgress === 'function') {
        const migration = options.migrateProgress({
          storage,
          targetKey: storageKey,
          slug,
          baseCodeAllowlist: descriptors
            .filter(item => item.packageCode === 'base' || item.packageCode === 'base-game')
            .map(item => item.trophyCode),
          dlcCodes: descriptors
            .filter(item => item.packageCode !== 'base' && item.packageCode !== 'base-game')
            .map(item => item.trophyCode),
          now: options.now
        });
        if (migration?.status && !['not-needed', 'already-migrated'].includes(migration.status)) {
          options.onMigration?.(migration);
          try {
            const migratedRaw = storage?.getItem(storageKey);
            const migratedParsed = migratedRaw ? JSON.parse(migratedRaw) : null;
            const validation = validateProgressDocument(migratedParsed, {
              slug,
              trophies: descriptors,
              serializedLength: migratedRaw?.length || 0
            });
            if (validation.valid) return validation.value;
          } catch (_error) {
            diagnose('legacy-migration-failed');
          }
        }
      }

      return createEmptyDocument({ slug, now: options.now });
    }

    state = load();
    write();

    function changeEntries(targets, completed) {
      const timestamp = safeNow(options.now);
      let changed = false;
      targets.forEach(trophyCode => {
        if (!knownCodes.has(trophyCode)) return;
        const current = state.trophies[trophyCode];
        if (current?.completed === completed) return;
        state.trophies[trophyCode] = {
          completed,
          updatedAt: timestamp,
          source: 'local'
        };
        changed = true;
      });
      if (changed) {
        state.updatedAt = timestamp;
        state.source = 'local';
        state.dirty = true;
        write();
        options.onChange?.(clone(state));
      }
      return changed;
    }

    return {
      getState() {
        return clone(state);
      },
      getDiagnostics() {
        return clone(diagnostics);
      },
      isPersistent() {
        return persistentStorage;
      },
      setCompleted(trophyCode, completed) {
        if (!knownCodes.has(trophyCode) || typeof completed !== 'boolean') return false;
        return changeEntries([trophyCode], completed);
      },
      resetPackage(packageCode) {
        const targets = descriptors
          .filter(item => item.packageCode === packageCode)
          .map(item => item.trophyCode);
        return changeEntries(targets, false);
      },
      resetAll() {
        return changeEntries(descriptors.map(item => item.trophyCode), false);
      },
      acknowledgeLegacyWarning() {
        const migration = state.migrations.phase6Legacy;
        if (!migration || migration.warningAcknowledged) return false;
        migration.warningAcknowledged = true;
        state.updatedAt = safeNow(options.now);
        write();
        return true;
      },
      replaceState(nextState, replaceOptions = {}) {
        const validation = validateProgressDocument(nextState, {
          slug,
          trophies: descriptors
        });
        if (!validation.valid) return false;
        state = validation.value;
        if (replaceOptions.dirty !== undefined) state.dirty = Boolean(replaceOptions.dirty);
        if (replaceOptions.source && VALID_SOURCES.has(replaceOptions.source)) {
          state.source = replaceOptions.source;
        }
        write();
        options.onChange?.(clone(state), { silent: true });
        return true;
      },
      setSyncRemote(callback) {
        syncRemote = typeof callback === 'function' ? callback : null;
      },
      async sync() {
        if (!syncRemote) return clone(state);
        if (syncPromise) return syncPromise;
        syncPromise = (async () => {
          try {
            const result = await syncRemote(clone(state));
            if (result) {
              const validation = validateProgressDocument(result, {
                slug,
                trophies: descriptors
              });
              if (!validation.valid) throw new Error('invalid-server-payload');
              state = validation.value;
            }
            state.dirty = false;
            state.source = 'server';
            write();
            return clone(state);
          } catch (error) {
            state.dirty = true;
            write();
            throw error;
          } finally {
            syncPromise = null;
          }
        })();
        return syncPromise;
      }
    };
  }

  function applyAttributes(node, attributes) {
    if (!node || typeof node.setAttribute !== 'function') return;
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  }

  function enhanceGuideProgress(root, progress) {
    if (!root || typeof root.querySelector !== 'function') return false;
    const node = root.querySelector('[data-re5-v2-progress]')
      || root.querySelector('[data-guide-progress-summary]');
    if (!node) return false;
    applyAttributes(node, buildProgressAria(progress, 'Progresso do guia'));
    return true;
  }

  function collectGuideControls(root) {
    if (!root || typeof root.querySelectorAll !== 'function') {
      return { valid: false, reason: 'missing-root', controls: [], trophies: [] };
    }
    const controls = Array.from(root.querySelectorAll('[data-guide-progress-checkbox]'));
    if (controls.length === 0) {
      return { valid: false, reason: 'zero-controls', controls, trophies: [] };
    }
    if (controls.length !== EXPECTED_TROPHY_COUNT) {
      return { valid: false, reason: 'unexpected-trophy-count', controls, trophies: [] };
    }
    const codes = new Set();
    const ids = new Set();
    const trophies = [];
    for (const control of controls) {
      const trophyCode = String(control.dataset?.trophyCode || '').trim();
      const packageCode = String(control.dataset?.packageCode || '').trim();
      const id = String(control.id || '').trim();
      if (!trophyCode || DANGEROUS_KEYS.has(trophyCode)) {
        return { valid: false, reason: 'empty-trophy-code', controls, trophies: [] };
      }
      if (codes.has(trophyCode)) {
        return { valid: false, reason: 'duplicate-dom-code', controls, trophies: [] };
      }
      if (!id || ids.has(id)) {
        return { valid: false, reason: 'invalid-dom-id', controls, trophies: [] };
      }
      if (!VALID_PACKAGE_CODES.has(packageCode)) {
        return { valid: false, reason: 'unknown-package-code', controls, trophies: [] };
      }
      codes.add(trophyCode);
      ids.add(id);
      trophies.push({
        trophyCode,
        packageCode,
        globalOrder: Number(control.closest?.('[data-v2-trophy]')?.dataset?.globalOrder || 0)
      });
    }
    const packageCounts = trophies.reduce((counts, item) => {
      counts[item.packageCode] = (counts[item.packageCode] || 0) + 1;
      return counts;
    }, {});
    if (
      packageCounts.base !== 51
      || packageCounts.versus !== 10
      || packageCounts['lost-in-nightmares'] !== 5
      || packageCounts['desperate-escape'] !== 5
    ) {
      return { valid: false, reason: 'unexpected-package-count', controls, trophies: [] };
    }
    return { valid: true, controls, trophies, reason: null };
  }

  function emitDiagnostic(reasonCode, details = {}) {
    const payload = {
      event: 'guide_progress_diagnostic',
      reasonCode: String(reasonCode || 'unknown').slice(0, 80),
      slug: DEFAULT_SLUG,
      sourceMode: 'local',
      ...(details.packageCode
        ? { packageCode: String(details.packageCode).slice(0, 80) }
        : {}),
      ...(Number.isFinite(details.completedCount)
        ? { completedCount: Number(details.completedCount) }
        : {}),
      ...(Number.isFinite(details.totalCount)
        ? { totalCount: Number(details.totalCount) }
        : {})
    };
    if (globalScope?.console?.warn) globalScope.console.warn(payload);
  }

  function emitEvent(eventName, payload = {}) {
    if (!EVENT_NAMES.has(eventName)) return false;
    const clean = {
      slug: String(payload.slug || DEFAULT_SLUG).slice(0, 120),
      ...(payload.packageCode ? { packageCode: String(payload.packageCode).slice(0, 80) } : {}),
      ...(Number.isFinite(payload.completedCount)
        ? { completedCount: Number(payload.completedCount) }
        : {}),
      ...(Number.isFinite(payload.totalCount) ? { totalCount: Number(payload.totalCount) } : {}),
      ...(payload.sourceMode ? { sourceMode: String(payload.sourceMode).slice(0, 40) } : {}),
      ...(payload.reasonCode ? { reasonCode: String(payload.reasonCode).slice(0, 80) } : {})
    };
    try {
      globalScope?.AtlasAnalytics?.trackEvent?.(eventName, clean);
      if (typeof globalScope?.CustomEvent === 'function') {
        globalScope.dispatchEvent(new globalScope.CustomEvent('atlas:guide-progress', {
          detail: { eventName, ...clean }
        }));
      }
    } catch (_error) {}
    return true;
  }

  function getScopeSummary(summary, scope) {
    if (scope === 'platinum' || scope === 'base') return summary.platinum;
    if (scope === 'completion') return summary.completion;
    return summary.packages[scope] || { completed: 0, total: 0, percent: 0 };
  }

  function updateProgressDom(root, summary) {
    Array.from(root.querySelectorAll('[data-progress-scope]')).forEach(node => {
      const scope = String(node.dataset?.progressScope || '');
      const value = getScopeSummary(summary, scope);
      const aria = buildProgressAria(value, PROGRESS_LABELS[scope] || 'Progresso');
      applyAttributes(node, aria);
      const count = node.querySelector?.('[data-progress-count]');
      const percent = node.querySelector?.('[data-progress-percent]');
      const bar = node.querySelector?.('[data-progress-bar]');
      if (count) count.textContent = `${value.completed}/${value.total}`;
      if (percent) percent.textContent = `${value.percent}%`;
      if (bar?.style) bar.style.width = `${value.percent}%`;
    });
  }

  function applyStateToDom(root, controls, state, trophies) {
    controls.forEach(control => {
      const trophyCode = control.dataset.trophyCode;
      const completed = state.trophies?.[trophyCode]?.completed === true;
      control.checked = completed;
      control.disabled = false;
      const card = control.closest?.('[data-v2-trophy]');
      card?.classList?.toggle('is-completed', completed);
      const status = card?.querySelector?.('[data-trophy-progress-status]');
      if (status) status.textContent = completed ? 'Concluído' : 'Pendente';
    });
    const summary = summarizeProgress(state, trophies);
    updateProgressDom(root, summary);
    return summary;
  }

  function showNotice(root, message, options = {}) {
    const notice = root.querySelector?.('[data-guide-progress-notice]');
    if (!notice) return;
    notice.hidden = false;
    notice.setAttribute('role', 'status');
    notice.classList.toggle('is-warning', options.warning === true);
    notice.textContent = '';
    const text = globalScope.document.createElement('p');
    text.textContent = message;
    notice.appendChild(text);
    if (options.dismiss) {
      const button = globalScope.document.createElement('button');
      button.type = 'button';
      button.className = 'guide-v2-notice-dismiss';
      button.textContent = 'Fechar aviso';
      button.addEventListener('click', () => {
        options.onDismiss?.();
        notice.hidden = true;
        button.remove();
      }, { once: true });
      notice.appendChild(button);
    }
  }

  function createRemoteSync(options = {}) {
    const fetchImpl = options.fetchImpl || globalScope?.fetch?.bind(globalScope);
    const slug = String(options.slug || DEFAULT_SLUG);
    const trophies = normalizeDescriptors(options.trophies);
    const csrfToken = String(options.csrfToken || '');
    if (!fetchImpl) return null;

    async function readJson(response) {
      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {}
      if (!response.ok) {
        const error = new Error(payload?.error?.message || payload?.message || 'server-sync-failed');
        error.status = response.status;
        error.code = payload?.error?.code || payload?.code || null;
        throw error;
      }
      return payload;
    }

    return async localDocument => {
      const endpoint = `/api/library/guides/${encodeURIComponent(slug)}/progress`;
      const serverResponse = await fetchImpl(endpoint, {
        method: 'GET',
        credentials: 'include',
        headers: { 'X-Atlas-Auth-Scope': 'user' }
      });
      const serverDocument = await readJson(serverResponse);
      const serverValidation = validateProgressDocument(serverDocument, {
        slug,
        trophies
      });
      if (!serverValidation.valid) throw new Error('invalid-server-payload');
      const merged = mergeProgressDocuments(
        localDocument,
        serverValidation.value,
        trophies,
        { slug }
      );
      const shouldSave = localDocument.dirty || merged.localWinnerCount > 0;
      if (!shouldSave) {
        return { ...merged.document, dirty: false, source: 'server' };
      }
      const items = Object.keys(merged.document.trophies).sort().map(trophyCode => ({
        trophyCode,
        completed: merged.document.trophies[trophyCode].completed,
        updatedAt: merged.document.trophies[trophyCode].updatedAt
      }));
      const saveResponse = await fetchImpl(endpoint, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Atlas-Auth-Scope': 'user',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        },
        body: JSON.stringify({ version: VERSION, slug, items })
      });
      const savedDocument = await readJson(saveResponse);
      if (isPlainObject(savedDocument)) {
        savedDocument.migrations = {
          phase6Legacy: normalizeMigration(localDocument?.migrations?.phase6Legacy)
        };
      }
      return savedDocument;
    };
  }

  function initializeGuideProgress(root, options = {}) {
    if (!root?.matches?.('[data-guide-v2]') && !root?.dataset?.guideV2) {
      return { initialized: false, reason: 'missing-v2-root' };
    }
    const collected = collectGuideControls(root);
    if (!collected.valid) {
      if (!['zero-controls', 'missing-root'].includes(collected.reason)) {
        emitDiagnostic(collected.reason, { actualCount: collected.controls.length });
      }
      return { initialized: false, reason: collected.reason };
    }
    const { controls, trophies } = collected;
    let storage = null;
    try {
      storage = own(options, 'storage') ? options.storage : globalScope?.localStorage;
    } catch (_error) {
      emitDiagnostic('local-storage-unavailable');
    }
    let migrationResult = null;
    const store = createProgressStore({
      storage,
      storageKey: options.storageKey || `${STORAGE_KEY_PREFIX}${root.dataset.guideSlug || DEFAULT_SLUG}`,
      slug: root.dataset.guideSlug || DEFAULT_SLUG,
      trophies,
      now: options.now,
      migrateProgress: options.migrateProgress,
      onMigration(result) {
        migrationResult = result;
        emitEvent('guide_progress_legacy_migrated', {
          completedCount: result.migratedBaseCodes?.length || 0,
          totalCount: 51,
          sourceMode: 'local'
        });
        if (result.ambiguousDlcDetected) {
          emitEvent('guide_progress_legacy_ambiguous_dlc', {
            completedCount: 0,
            totalCount: 20,
            sourceMode: 'local'
          });
        }
      },
      onDiagnostic(diagnostic) {
        emitDiagnostic(diagnostic.reasonCode, diagnostic);
        if (/invalid-local/.test(diagnostic.reasonCode)) {
          emitEvent('guide_progress_invalid_local_state', {
            reasonCode: diagnostic.reasonCode,
            sourceMode: 'local'
          });
        }
      }
    });
    let summary = applyStateToDom(root, controls, store.getState(), trophies);
    root.dataset.guideProgressInitialized = 'true';

    const live = root.querySelector('[data-guide-progress-live]');
    const connectivity = root.querySelector('[data-guide-progress-connectivity]');
    let syncTimer = 0;
    let syncEnabled = false;
    let syncFailureShown = false;

    function announce(message) {
      if (!live) return;
      live.textContent = '';
      globalScope.setTimeout(() => {
        live.textContent = message;
      }, 20);
    }

    function render() {
      summary = applyStateToDom(root, controls, store.getState(), trophies);
      return summary;
    }

    async function synchronize() {
      if (!syncEnabled || globalScope.navigator?.onLine === false) return;
      try {
        await store.sync();
        render();
        syncFailureShown = false;
        emitEvent('guide_progress_sync_success', {
          completedCount: summary.completion.completed,
          totalCount: summary.completion.total,
          sourceMode: 'server'
        });
      } catch (error) {
        const reasonCode = error?.status === 401
          ? 'unauthorized'
          : error?.status === 403 ? 'csrf-failed' : 'server-save-failed';
        emitDiagnostic(reasonCode);
        emitEvent('guide_progress_sync_failed', {
          completedCount: summary.completion.completed,
          totalCount: summary.completion.total,
          sourceMode: 'local',
          reasonCode
        });
        if (!syncFailureShown && reasonCode !== 'unauthorized') {
          showNotice(
            root,
            'O progresso continua salvo neste navegador, mas a sincronização da conta está temporariamente indisponível.',
            { warning: true }
          );
          syncFailureShown = true;
        }
      }
    }

    function scheduleSync(delay = 450) {
      if (!syncEnabled) return;
      globalScope.clearTimeout(syncTimer);
      syncTimer = globalScope.setTimeout(synchronize, delay);
    }

    controls.forEach(control => {
      control.addEventListener('change', () => {
        const completed = Boolean(control.checked);
        if (!store.setCompleted(control.dataset.trophyCode, completed)) return;
        render();
        emitEvent('guide_progress_changed', {
          packageCode: control.dataset.packageCode,
          completedCount: summary.completion.completed,
          totalCount: summary.completion.total,
          sourceMode: 'local'
        });
        announce(
          `${completed ? 'Troféu concluído' : 'Troféu marcado como pendente'}. `
          + `Platina: ${summary.platinum.completed} de ${summary.platinum.total}. `
          + `Total: ${summary.completion.completed} de ${summary.completion.total}.`
        );
        scheduleSync();
      });
    });

    Array.from(root.querySelectorAll('[data-guide-progress-reset-package]')).forEach(button => {
      button.addEventListener('click', () => {
        const packageCode = String(button.dataset.guideProgressResetPackage || '');
        if (!VALID_PACKAGE_CODES.has(packageCode)) return;
        const confirmed = globalScope.confirm(
          'Limpar todo o progresso deste pacote? Esta ação desmarcará os troféus do pacote.'
        );
        if (!confirmed) return;
        store.resetPackage(packageCode);
        render();
        emitEvent('guide_progress_reset_package', {
          packageCode,
          completedCount: getScopeSummary(summary, packageCode).completed,
          totalCount: getScopeSummary(summary, packageCode).total,
          sourceMode: 'local'
        });
        announce(
          `Progresso do pacote limpo. Total: ${summary.completion.completed} de ${summary.completion.total}.`
        );
        scheduleSync();
      });
    });

    const resetAll = root.querySelector('[data-guide-progress-reset-all]');
    resetAll?.addEventListener('click', () => {
      const confirmed = globalScope.confirm(
        'Limpar todo o progresso do guia? Esta ação desmarcará os 71 troféus.'
      );
      if (!confirmed) return;
      store.resetAll();
      render();
      emitEvent('guide_progress_reset_all', {
        completedCount: 0,
        totalCount: summary.completion.total,
        sourceMode: 'local'
      });
      announce('Todo o progresso foi limpo. Total: 0 de 71.');
      scheduleSync();
    });

    const migration = store.getState().migrations.phase6Legacy;
    if (
      (migrationResult?.warningShown || migration?.ambiguousDlcDetected)
      && !migration?.warningAcknowledged
    ) {
      showNotice(
        root,
        'O progresso antigo dos troféus-base foi recuperado. Os troféus adicionais não puderam ser identificados com segurança e permanecem desmarcados.',
        {
          warning: true,
          dismiss: true,
          onDismiss: () => store.acknowledgeLegacyWarning()
        }
      );
    } else if (store.getDiagnostics().some(item => /invalid-local/.test(item.reasonCode))) {
      showNotice(
        root,
        'Um progresso local incompatível foi arquivado e o guia começou com um estado seguro.',
        { warning: true }
      );
    } else if (!store.isPersistent()) {
      showNotice(
        root,
        'O progresso funciona nesta sessão, mas não pôde ser salvo neste navegador.',
        { warning: true }
      );
    }

    function updateConnectivity() {
      const offline = globalScope.navigator?.onLine === false;
      if (connectivity) connectivity.hidden = !offline;
      root.classList.toggle('is-offline', offline);
      if (!offline) scheduleSync(50);
    }
    globalScope.addEventListener?.('offline', updateConnectivity);
    globalScope.addEventListener?.('online', updateConnectivity);
    updateConnectivity();

    async function initializeAuthenticatedSync() {
      if (options.disableRemoteSync || !globalScope.fetch) return;
      try {
        const response = await globalScope.fetch('/api/auth/me', {
          credentials: 'include',
          headers: { 'X-Atlas-Auth-Scope': 'user' }
        });
        if (!response.ok) return;
        const session = await response.json();
        if (!session?.authenticated) return;
        const remoteSync = createRemoteSync({
          slug: root.dataset.guideSlug || DEFAULT_SLUG,
          trophies,
          csrfToken: session.csrfToken || response.headers.get('x-csrf-token') || ''
        });
        if (!remoteSync) return;
        store.setSyncRemote(remoteSync);
        syncEnabled = true;
        scheduleSync(0);
      } catch (_error) {
        emitDiagnostic('server-fetch-failed');
      }
    }

    initializeAuthenticatedSync();
    emitEvent('guide_progress_initialized', {
      completedCount: summary.completion.completed,
      totalCount: summary.completion.total,
      sourceMode: 'local'
    });
    return {
      initialized: true,
      root,
      store,
      trophies,
      getSummary: () => clone(summary),
      synchronize,
      destroy() {
        globalScope.clearTimeout(syncTimer);
        globalScope.removeEventListener?.('offline', updateConnectivity);
        globalScope.removeEventListener?.('online', updateConnectivity);
      }
    };
  }

  function autoInitialize() {
    const documentValue = globalScope?.document;
    if (!documentValue) return { initialized: false, reason: 'missing-document' };
    const root = documentValue.querySelector('[data-guide-v2]');
    if (!root) return { initialized: false, reason: 'missing-v2-root' };
    const config = globalScope.AtlasGuideProgressV2Config || {};
    const result = initializeGuideProgress(root, config);
    globalScope.AtlasGuideProgressV2Instance = result;
    return result;
  }

  let readyScheduled = false;
  function startWhenReady() {
    if (readyScheduled || !globalScope?.document) return;
    readyScheduled = true;
    if (globalScope.document.readyState === 'loading') {
      globalScope.document.addEventListener('DOMContentLoaded', autoInitialize, { once: true });
    } else {
      globalScope.setTimeout(autoInitialize, 0);
    }
  }

  return {
    VERSION,
    STORAGE_KEY_PREFIX,
    STORAGE_KEY,
    ARCHIVE_KEY_PREFIX,
    MAX_DOCUMENT_SIZE,
    EXPECTED_TROPHY_COUNT,
    EVENT_NAMES: Object.freeze([...EVENT_NAMES]),
    createEmptyDocument,
    validateProgressDocument,
    archiveInvalidLocalValue,
    migrateLegacyProgress,
    mergeProgressEntry,
    mergeProgressDocuments,
    summarizeProgress,
    buildProgressAria,
    createProgressStore,
    enhanceGuideProgress,
    collectGuideControls,
    createRemoteSync,
    initializeGuideProgress,
    autoInitialize,
    startWhenReady,
    stableStringify
  };
});
