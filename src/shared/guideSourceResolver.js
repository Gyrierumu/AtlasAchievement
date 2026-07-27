'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { validateGuideSnapshotV2 } = require('../validators/guideSnapshotV2.validator');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_GUIDE_PATH = path.join(PROJECT_ROOT, 'data', 'guides', 'resident-evil-5.json');
const DEFAULT_MANIFEST_PATH = path.join(PROJECT_ROOT, 'data', 'guides', 'manifest.json');
const DEFAULT_SOURCE_PATH = 'data/guides/resident-evil-5.json';
const SOURCE_MODES = Object.freeze([
  'v2',
  'relational-legacy',
  'sample-legacy',
  'error'
]);
const OPERATIONAL_FIELDS = new Set([
  'generatedAt',
  'createdAt',
  'updatedAt',
  'created_at',
  'updated_at'
]);
const ORDERED_ARRAY_FIELDS = Object.freeze({
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
const CODE_ARRAY_FIELDS = new Set([
  'packageCodes',
  'trophyCodes',
  'collectibleGroups',
  'saveCodes',
  'relatedTrophyCodes',
  'sourceCodes'
]);

class GuideSourceResolutionError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'GuideSourceResolutionError';
    this.code = code;
    this.details = details;
  }
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeSnapshotPayload(snapshot) {
  function visit(value, pathSegments = [], parentKey = '') {
    if (typeof value === 'string') {
      return value
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.replace(/[ \t]+$/g, ''))
        .join('\n')
        .trim();
    }
    if (typeof value === 'boolean' || typeof value === 'number' || value === null) return value;
    if (Array.isArray(value)) {
      const normalized = value.map(item => visit(item, pathSegments, parentKey));
      if (CODE_ARRAY_FIELDS.has(parentKey)) {
        return [...normalized].sort((left, right) => (
          String(left ?? '').localeCompare(String(right ?? ''), 'en')
        ));
      }
      const rootField = pathSegments.length === 1 ? pathSegments[0] : null;
      const orderField = rootField ? ORDERED_ARRAY_FIELDS[rootField] : null;
      if (!orderField) return normalized;
      return [...normalized].sort((left, right) => {
        const leftValue = left?.[orderField];
        const rightValue = right?.[orderField];
        if (typeof leftValue === 'number' && typeof rightValue === 'number') {
          return leftValue - rightValue;
        }
        return String(leftValue ?? '').localeCompare(String(rightValue ?? ''), 'en');
      });
    }
    if (!value || typeof value !== 'object') return value;

    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (OPERATIONAL_FIELDS.has(key) || value[key] === undefined) return result;
        if (
          key === 'id'
          && typeof value[key] === 'number'
          && pathSegments[0] !== 'game'
        ) {
          return result;
        }
        result[key] = visit(value[key], [...pathSegments, key], key);
        return result;
      }, {});
  }

  return visit(snapshot);
}

function hashSnapshotPayload(snapshot) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalizeSnapshotPayload(snapshot)))
    .digest('hex');
}

function findManifestEntry(manifest, slug) {
  if (!manifest || typeof manifest !== 'object') return null;
  if (manifest.slug === slug) return manifest;
  if (!Array.isArray(manifest.games)) return null;
  return manifest.games.find(item => item?.slug === slug) || null;
}

function validateGuideManifest(snapshot, manifest, options = {}) {
  const slug = env.normalizeGuideV2Slug(options.slug || snapshot?.game?.slug);
  const sourcePath = String(options.sourcePath || DEFAULT_SOURCE_PATH).replaceAll('\\', '/');
  const entry = findManifestEntry(manifest, slug);
  const errors = [];

  function expect(condition, code, field, message) {
    if (!condition) errors.push({ code, field, message });
  }

  expect(Boolean(entry), 'MANIFEST_ENTRY_MISSING', 'manifest', `Manifest entry is missing for ${slug}`);
  if (!entry) return { valid: false, errors, entry: null, payloadHash: null };

  const payloadHash = hashSnapshotPayload(snapshot);
  const packageCounts = Object.fromEntries(
    (snapshot.trophyPackages || []).map(pkg => [
      pkg.packageCode,
      (snapshot.trophies || []).filter(trophy => trophy.packageCode === pkg.packageCode).length
    ])
  );
  expect(entry.slug === slug, 'MANIFEST_SLUG_MISMATCH', 'slug', 'Manifest slug does not match');
  expect(
    entry.schemaVersion === snapshot.schemaVersion,
    'MANIFEST_SCHEMA_MISMATCH',
    'schemaVersion',
    'Manifest schemaVersion does not match'
  );
  expect(
    String(entry.sourcePath || '').replaceAll('\\', '/') === sourcePath,
    'MANIFEST_SOURCE_PATH_MISMATCH',
    'sourcePath',
    'Manifest sourcePath does not match'
  );
  expect(
    entry.payloadHash === payloadHash,
    'MANIFEST_HASH_MISMATCH',
    'payloadHash',
    'Manifest payload hash does not match'
  );
  expect(
    (entry.trophyCount ?? entry.trophies) === snapshot.trophies.length,
    'MANIFEST_TROPHY_COUNT_MISMATCH',
    'trophyCount',
    'Manifest trophy count does not match'
  );
  expect(
    Object.keys(packageCounts).length === Object.keys(entry.packageCounts || {}).length
      && Object.entries(packageCounts).every(
        ([packageCode, count]) => entry.packageCounts?.[packageCode] === count
      ),
    'MANIFEST_PACKAGE_COUNTS_MISMATCH',
    'packageCounts',
    'Manifest package counts do not match'
  );
  expect(
    entry.reviewedAt === snapshot.review?.reviewedAt,
    'MANIFEST_REVIEW_DATE_MISMATCH',
    'reviewedAt',
    'Manifest review date does not match'
  );
  return {
    valid: errors.length === 0,
    errors,
    entry,
    payloadHash
  };
}

function diagnosticError(error) {
  if (!error) return { code: 'UNKNOWN_ERROR', message: 'Unknown guide source error' };
  const details = Array.isArray(error.errors)
    ? error.errors.map(item => ({ code: item.code, path: item.path || item.field || null }))
    : error.details && typeof error.details === 'object'
      ? error.details
      : null;
  return {
    code: error.code || error.name || 'GUIDE_SOURCE_ERROR',
    message: String(error.message || 'Guide source error'),
    details
  };
}

function emitStructuredLog(logger, level, payload) {
  if (!logger) return;
  if (typeof logger === 'function') {
    logger(payload);
    return;
  }
  if (typeof logger[level] === 'function') logger[level](payload);
}

async function resolveInput(explicitValue, loader) {
  if (explicitValue !== undefined) return explicitValue;
  if (typeof loader !== 'function') return null;
  return loader();
}

async function resolveLegacyGuideSource(options, diagnostics, warnings = []) {
  const attempts = [];
  try {
    const relational = await resolveInput(
      options.relationalLegacy,
      options.loadRelationalLegacy
    );
    if (relational) {
      return {
        sourceMode: 'relational-legacy',
        slug: diagnostics.slug,
        data: relational,
        warnings,
        diagnostics: {
          ...diagnostics,
          warnings,
          legacyAttempts: attempts,
          selectionReason: 'relational-legacy-available'
        }
      };
    }
    attempts.push({ sourceMode: 'relational-legacy', outcome: 'not-found' });
  } catch (error) {
    attempts.push({
      sourceMode: 'relational-legacy',
      outcome: 'error',
      error: diagnosticError(error)
    });
  }

  try {
    const sample = await resolveInput(options.sampleLegacy, options.loadSampleLegacy);
    if (sample) {
      return {
        sourceMode: 'sample-legacy',
        slug: diagnostics.slug,
        data: sample,
        warnings,
        diagnostics: {
          ...diagnostics,
          warnings,
          legacyAttempts: attempts,
          selectionReason: 'sample-legacy-available'
        }
      };
    }
    attempts.push({ sourceMode: 'sample-legacy', outcome: 'not-found' });
  } catch (error) {
    attempts.push({
      sourceMode: 'sample-legacy',
      outcome: 'error',
      error: diagnosticError(error)
    });
  }

  const result = {
    sourceMode: 'error',
    slug: diagnostics.slug,
    data: null,
    warnings,
    diagnostics: {
      ...diagnostics,
      warnings,
      legacyAttempts: attempts,
      selectionReason: 'no-guide-source-available'
    }
  };
  emitStructuredLog(options.logger, 'error', {
    event: 'guide_source_unavailable',
    slug: diagnostics.slug,
    sourceMode: result.sourceMode,
    reasonCode: 'NO_GUIDE_SOURCE_AVAILABLE',
    featureFlagEnabled: diagnostics.featureFlagEnabled,
    snapshotHash: diagnostics.snapshotHash || null,
    attempts
  });
  return result;
}

async function resolveGuideSource(options = {}) {
  const slug = env.normalizeGuideV2Slug(options.slug);
  const featureFlagEnabled = options.featureFlagEnabled === undefined
    ? env.isGuideV2EnabledForSlug(slug)
    : options.featureFlagEnabled === true;
  const diagnostics = {
    slug,
    featureFlagEnabled,
    attemptedV2: false,
    snapshotFound: null,
    snapshotValid: null,
    manifestHashValid: null,
    snapshotHash: null,
    fallbackUsed: false,
    fallback: null,
    warnings: []
  };

  if (!featureFlagEnabled) {
    return resolveLegacyGuideSource(options, {
      ...diagnostics,
      selectionReason: 'feature-flag-disabled'
    });
  }

  diagnostics.attemptedV2 = true;
  try {
    const snapshot = await resolveInput(
      options.snapshot,
      options.loadSnapshot || (() => readJsonFile(options.snapshotPath || DEFAULT_GUIDE_PATH))
    );
    if (!snapshot) {
      diagnostics.snapshotFound = false;
      diagnostics.snapshotValid = false;
      throw new GuideSourceResolutionError(
        'GUIDE_V2_SNAPSHOT_MISSING',
        'Guide Snapshot V2 is missing'
      );
    }
    diagnostics.snapshotFound = true;
    diagnostics.snapshotHash = hashSnapshotPayload(snapshot);

    const snapshotValidation = (options.validateSnapshot || validateGuideSnapshotV2)(
      snapshot,
      { mode: 'complete' }
    );
    if (!snapshotValidation?.valid) {
      diagnostics.snapshotValid = false;
      const validationError = new GuideSourceResolutionError(
        'GUIDE_V2_SNAPSHOT_INVALID',
        'Guide Snapshot V2 failed validation',
        snapshotValidation?.errors || []
      );
      validationError.errors = snapshotValidation?.errors || [];
      throw validationError;
    }
    diagnostics.snapshotValid = true;

    const manifest = await resolveInput(
      options.manifest,
      options.loadManifest || (() => readJsonFile(options.manifestPath || DEFAULT_MANIFEST_PATH))
    );
    const manifestValidation = validateGuideManifest(snapshot, manifest, {
      slug,
      sourcePath: options.sourcePath || DEFAULT_SOURCE_PATH
    });
    if (!manifestValidation.valid) {
      diagnostics.manifestHashValid = false;
      const manifestError = new GuideSourceResolutionError(
        'GUIDE_V2_MANIFEST_INVALID',
        'Guide Snapshot V2 manifest failed validation',
        manifestValidation.errors
      );
      manifestError.errors = manifestValidation.errors;
      throw manifestError;
    }
    diagnostics.manifestHashValid = true;

    if (typeof options.validateV2Candidate === 'function') {
      await options.validateV2Candidate(snapshot);
    }

    const result = {
      sourceMode: 'v2',
      slug,
      data: snapshot,
      warnings: [],
      manifestEntry: manifestValidation.entry,
      diagnostics: {
        ...diagnostics,
        selectionReason: 'valid-v2-snapshot-and-manifest',
        payloadHash: manifestValidation.payloadHash
      }
    };
    emitStructuredLog(options.logger, 'info', {
      event: 'guide_v2_selected',
      slug,
      sourceMode: result.sourceMode,
      reasonCode: 'VALID_V2',
      featureFlagEnabled,
      snapshotHash: manifestValidation.payloadHash
    });
    return result;
  } catch (error) {
    if (diagnostics.snapshotFound === null) {
      diagnostics.snapshotFound = false;
      diagnostics.snapshotValid = false;
    }
    if (
      diagnostics.snapshotFound === true
      && diagnostics.snapshotValid === true
      && diagnostics.manifestHashValid === null
    ) {
      diagnostics.manifestHashValid = false;
    }
    const fallback = diagnosticError(error);
    diagnostics.fallback = fallback;
    const warning = {
      code: 'GUIDE_V2_FALLBACK',
      reason: fallback.code
    };
    diagnostics.warnings = [warning];
    const failureEvent = fallback.code === 'GUIDE_V2_SNAPSHOT_INVALID'
      ? 'guide_v2_invalid_snapshot'
      : (
        fallback.code === 'GUIDE_V2_MANIFEST_INVALID'
        || (
          diagnostics.snapshotFound === true
          && diagnostics.snapshotValid === true
          && diagnostics.manifestHashValid !== true
        )
      )
        ? 'guide_v2_manifest_mismatch'
        : (
          fallback.code === 'GUIDE_V2_SNAPSHOT_MISSING'
          || diagnostics.snapshotFound !== true
        )
          ? 'guide_v2_source_missing'
          : 'guide_v2_adapter_error';
    emitStructuredLog(options.logger, 'warn', {
      event: failureEvent,
      slug,
      sourceMode: 'error',
      reasonCode: fallback.code,
      featureFlagEnabled,
      snapshotHash: diagnostics.snapshotHash
    });
    const legacyResult = await resolveLegacyGuideSource(options, diagnostics, [warning]);
    legacyResult.diagnostics.fallbackUsed = legacyResult.sourceMode !== 'error';
    emitStructuredLog(options.logger, 'warn', {
      event: 'guide_v2_fallback',
      slug,
      sourceMode: legacyResult.sourceMode,
      reasonCode: fallback.code,
      featureFlagEnabled,
      snapshotHash: diagnostics.snapshotHash
    });
    return legacyResult;
  }
}

module.exports = {
  SOURCE_MODES,
  DEFAULT_GUIDE_PATH,
  DEFAULT_MANIFEST_PATH,
  DEFAULT_SOURCE_PATH,
  GuideSourceResolutionError,
  hashSnapshotPayload,
  findManifestEntry,
  validateGuideManifest,
  resolveGuideSource
};
