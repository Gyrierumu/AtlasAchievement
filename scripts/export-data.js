const fs = require('fs');
const path = require('path');

const env = require('../src/config/env');
const sampleGames = require('../src/data/sampleGames');
const guideViewModel = require('../src/shared/guideViewModel');
const { getProtectedVerifiedGuide } = require('../src/data/protectedVerifiedGuides');
const { CANONICAL_GAME_SLUG_ALIASES, getCanonicalGameSlug } = require('../src/utils/slug');
const {
  parseArgs,
  stableStringify,
  normalizeDataDir,
  ensureDirectory,
  createDatabaseBackup,
  openDatabase,
  normalizeGuideFileName,
  normalizeGuideSnapshotV2,
  hashGuideSnapshotV2
} = require('./data-sync-utils');
const {
  assertGuideSnapshotV2
} = require('../src/validators/guideSnapshotV2.validator');
const {
  RE5_GAME_ID,
  RE5_SLUG
} = require('../src/shared/re5V2Constants');

const GAME_COLUMNS = [
  'name',
  'slug',
  'difficulty',
  'time',
  'time_min_hours',
  'time_max_hours',
  'time_sort_hours',
  'time_bucket',
  'missable',
  'guide_runs',
  'guide_online',
  'guide_grind',
  'guide_dlc',
  'guide_ideal',
  'guide_avoid',
  'guide_best_moment',
  'runs_summary',
  'missable_summary',
  'online_summary',
  'grind_summary',
  'dlc_scope',
  'difficulty_reason',
  'time_reason',
  'first_run_advice',
  'cleanup_advice',
  'before_you_start',
  'best_for',
  'avoid_if',
  'verification_status',
  'editorial_status',
  'coverage_level',
  'is_verified',
  'verification_note',
  'image',
  'cover_image',
  'created_at',
  'updated_at',
  'editorial_review_status',
  'last_reviewed_at',
  'editorial_notes',
  'quality_warnings',
  'reviewed_by',
  'walkthrough'
];

function pickColumns(row, columns) {
  return columns.reduce((result, column) => {
    result[column] = row[column] ?? null;
    return result;
  }, {});
}

function getSeedExtrasBySlug() {
  const extras = new Map();
  for (const game of sampleGames) {
    const slug = getCanonicalGameSlug(game.slug || game.name);
    extras.set(slug, {
      aliases: game.aliases || game.slug_aliases || [],
      attentionPoints: game.attentionPoints || [],
      checklist: game.checklist || [],
      editorial_summary: typeof guideViewModel.buildGuideEditorialSummary === 'function'
        ? guideViewModel.buildGuideEditorialSummary(game)
        : (game.editorial_summary || []),
      faq: Array.isArray(game.faq) && game.faq.length
        ? game.faq
        : (typeof guideViewModel.buildContextualFaq === 'function'
          ? guideViewModel.buildContextualFaq(game, { trophies: game.trophies || [], roadmap: game.roadmap || [] })
          : []),
      quick_plan: typeof guideViewModel.buildGuideQuickPlan === 'function'
        ? guideViewModel.buildGuideQuickPlan(game, { roadmap: game.roadmap || [] })
        : [],
      quickDecision: game.quickDecision || null,
      ...(game.editorialDisplay && typeof game.editorialDisplay === 'object' ? {
        editorialDisplay: game.editorialDisplay,
        lastReviewedAt: game.lastReviewedAt || null,
        editorialAuthority: game.editorialAuthority || null,
        platinumBaseChecklist: game.platinumBaseChecklist || null,
        videoAudit: game.videoAudit || null,
        instructionalVisuals: game.instructionalVisuals || null
      } : {}),
      chapterRouteGuide: game.chapterRouteGuide || null,
      professionalAiGuide: game.professionalAiGuide || null,
      farmRoutesGuide: game.farmRoutesGuide || null,
      commonMythsGuide: game.commonMythsGuide || null,
      dlcCompletionGuide: game.dlcCompletionGuide || null,
      ...(game.disableGeneratedVideoSearch === true ? { disableGeneratedVideoSearch: true } : {}),
      ...(Array.isArray(game.usefulVideos) && game.usefulVideos.length ? { usefulVideos: game.usefulVideos } : {}),
      seo: game.seo || {},
      tags: game.tags || [],
      note: 'Campos exportados para auditoria. O SQLite atual nao possui colunas nativas para todos esses extras; a importacao preserva o que o banco suporta.'
    });
  }
  return extras;
}

function addRedirectAlias(redirectsBySlug, slug, alias) {
  const canonicalSlug = getCanonicalGameSlug(slug);
  const aliasSlug = String(alias || '').trim().toLowerCase();
  if (!aliasSlug || aliasSlug === canonicalSlug) return;
  if (!redirectsBySlug.has(canonicalSlug)) redirectsBySlug.set(canonicalSlug, []);
  const aliases = redirectsBySlug.get(canonicalSlug);
  if (!aliases.includes(aliasSlug)) aliases.push(aliasSlug);
}

function applyProtectedVerificationStatus(game, slug) {
  const protectedGuide = getProtectedVerifiedGuide(slug);
  if (!protectedGuide || protectedGuide.expectedStatus !== 'verified') return game;

  return {
    ...game,
    is_verified: 1,
    verification_status: 'verified',
    editorial_review_status: 'verified'
  };
}

function assertSameRelationalValue(pathLabel, current, expected) {
  if (current !== expected) {
    throw new Error(
      `RE5_V2_RELATIONAL_DIVERGENCE: ${pathLabel} payload=${JSON.stringify(expected)} relation=${JSON.stringify(current)}`
    );
  }
}

async function exportGuideSnapshotV2(database, gameId = RE5_GAME_ID, options = {}) {
  if (gameId && typeof gameId === 'object') {
    options = gameId;
    gameId = options.gameId || RE5_GAME_ID;
  }
  if (
    !database
    || typeof database.all !== 'function'
    || typeof database.get !== 'function'
  ) {
    throw new TypeError('A database adapter with all/get is required');
  }
  const game = options.slug
    ? await database.get('SELECT id, slug FROM games WHERE slug = ?', [options.slug])
    : await database.get('SELECT id, slug FROM games WHERE id = ?', [gameId]);
  if (!game || game.id !== RE5_GAME_ID || game.slug !== RE5_SLUG) {
    throw new Error('RE5_V2_DATABASE_GAME_MISMATCH');
  }

  const payloadRow = await database.get(
    `SELECT payload_json, payload_hash, validation_status
       FROM game_guide_payloads
      WHERE game_id = ? AND schema_version = 2`,
    [game.id]
  );
  if (!payloadRow) throw new Error('RE5_V2_PAYLOAD_MISSING');
  if (payloadRow.validation_status !== 'valid') throw new Error('RE5_V2_PAYLOAD_NOT_VALID');

  let payload;
  try {
    payload = JSON.parse(payloadRow.payload_json);
  } catch (error) {
    throw new Error(`RE5_V2_PAYLOAD_INVALID_JSON: ${error.message}`);
  }
  const normalizedPayload = normalizeGuideSnapshotV2(payload);
  if (hashGuideSnapshotV2(normalizedPayload) !== payloadRow.payload_hash) {
    throw new Error('RE5_V2_PAYLOAD_HASH_MISMATCH');
  }
  if (
    !Array.isArray(payload.sources)
    || !payload.sources.length
    || !Array.isArray(payload.claims)
    || !payload.claims.length
    || !payload.seo
  ) {
    throw new Error('RE5_V2_EDITORIAL_PAYLOAD_INCOMPLETE');
  }

  const versions = await database.all(
    `SELECT v.*, source.version_code AS source_version_code
       FROM game_versions v
       LEFT JOIN game_versions source ON source.id = v.source_version_id
      WHERE v.game_id = ?
      ORDER BY v.display_order`,
    [game.id]
  );
  if (versions.length !== payload.versions.length) {
    throw new Error('RE5_V2_VERSION_COUNT_DIVERGENCE');
  }
  for (const expected of payload.versions) {
    const current = versions.find(row => row.version_code === expected.versionCode);
    if (!current) throw new Error(`RE5_V2_VERSION_MISSING_FROM_RELATION: ${expected.versionCode}`);
    const comparisons = {
      platform: expected.platform,
      region: expected.region,
      release_kind: expected.releaseKind,
      display_order: expected.displayOrder,
      is_native: Number(expected.isNative),
      native_trophy_list: Number(expected.nativeTrophyList),
      save_transfer_supported: Number(expected.saveTransferSupported),
      autopop_supported: Number(expected.autopopSupported),
      upgrade_supported: Number(expected.upgradeSupported),
      source_version_code: expected.sourceVersionCode
    };
    for (const [field, value] of Object.entries(comparisons)) {
      assertSameRelationalValue(`versions.${expected.versionCode}.${field}`, current[field], value);
    }
  }

  const packages = await database.all(
    'SELECT * FROM trophy_packages WHERE game_id = ? ORDER BY display_order',
    [game.id]
  );
  if (packages.length !== payload.trophyPackages.length) {
    throw new Error('RE5_V2_PACKAGE_COUNT_DIVERGENCE');
  }
  for (const expected of payload.trophyPackages) {
    const current = packages.find(row => row.package_code === expected.packageCode);
    if (!current) throw new Error(`RE5_V2_PACKAGE_MISSING_FROM_RELATION: ${expected.packageCode}`);
    const comparisons = {
      name: expected.name,
      package_type: expected.packageType,
      display_order: expected.displayOrder,
      expected_trophy_count: expected.expectedTrophyCount,
      counts_for_platinum: Number(expected.countsForPlatinum),
      counts_for_100_percent: Number(expected.countsFor100Percent),
      is_online: Number(expected.isOnline),
      is_coop: Number(expected.isCoop)
    };
    for (const [field, value] of Object.entries(comparisons)) {
      assertSameRelationalValue(`trophyPackages.${expected.packageCode}.${field}`, current[field], value);
    }
  }

  const trophies = await database.all(
    `SELECT t.*, p.package_code, v.version_code
       FROM trophies t
       LEFT JOIN trophy_packages p ON p.id = t.package_id
       LEFT JOIN game_versions v ON v.id = t.version_id
      WHERE t.game_id = ?
      ORDER BY p.display_order, t.display_order`,
    [game.id]
  );
  if (trophies.length !== 71 || payload.trophies.length !== trophies.length) {
    throw new Error('RE5_V2_TROPHY_COUNT_DIVERGENCE');
  }
  const relationalByCode = new Map(trophies.map(trophy => [trophy.trophy_code, trophy]));
  const payloadCodes = new Set(payload.trophies.map(trophy => trophy.trophyCode));
  if (
    relationalByCode.size !== payloadCodes.size
    || [...relationalByCode.keys()].some(code => !payloadCodes.has(code))
  ) {
    throw new Error('RE5_V2_TROPHY_CODE_DIVERGENCE');
  }

  const exported = {
    ...payload,
    trophies: payload.trophies.map(expected => {
      const current = relationalByCode.get(expected.trophyCode);
      assertSameRelationalValue(
        `trophies.${expected.trophyCode}.packageCode`,
        current.package_code,
        expected.packageCode
      );
      assertSameRelationalValue(
        `trophies.${expected.trophyCode}.displayOrder`,
        current.display_order,
        expected.displayOrder
      );
      assertSameRelationalValue(
        `trophies.${expected.trophyCode}.versionCode`,
        current.version_code,
        'ps4-native'
      );
      return {
        ...expected,
        sourceTrophyCode: current.source_trophy_code,
        name: current.name ?? expected.name,
        type: current.type ?? expected.type,
        description: current.description ?? expected.description,
        category: current.category,
        isOnline: Boolean(current.is_online),
        isCoop: Boolean(current.is_coop),
        isCumulative: Boolean(current.is_cumulative),
        isMissable: Boolean(current.is_missable)
      };
    })
  };

  const normalized = normalizeGuideSnapshotV2(exported);
  assertGuideSnapshotV2(normalized, { mode: 'complete' });
  const exportedHash = hashGuideSnapshotV2(normalized);
  if (exportedHash !== payloadRow.payload_hash) {
    throw new Error(`RE5_V2_EXPORTED_HASH_MISMATCH: stored=${payloadRow.payload_hash} exported=${exportedHash}`);
  }
  return normalized;
}

async function main() {
  const args = parseArgs();
  const dataDir = normalizeDataDir(args.dataDir);
  const databasePath = path.resolve(env.databasePath);
  const previousManifestPath = path.join(dataDir, 'manifest.json');
  const previousManifest = fs.existsSync(previousManifestPath)
    ? JSON.parse(fs.readFileSync(previousManifestPath, 'utf8').replace(/^\uFEFF/, ''))
    : null;
  const previousRe5Entry = previousManifest?.games?.find(entry => entry.slug === RE5_SLUG) || null;
  const previousRe5Path = path.join(dataDir, `${RE5_SLUG}.json`);
  const previousRe5Snapshot = fs.existsSync(previousRe5Path)
    ? JSON.parse(fs.readFileSync(previousRe5Path, 'utf8').replace(/^\uFEFF/, ''))
    : null;
  const preserveRe5V2 = previousRe5Snapshot?.schemaVersion === 2;

  if (!fs.existsSync(databasePath)) {
    throw new Error(`Banco nao encontrado em ${databasePath}. Rode npm run db:setup ou ajuste DATABASE_PATH.`);
  }

  const backupPath = createDatabaseBackup(databasePath, 'export-data');
  ensureDirectory(dataDir);

  const database = openDatabase(databasePath);
  try {
    const games = await database.all('SELECT * FROM games ORDER BY slug ASC');
    const roadmaps = await database.all(`
      SELECT g.slug, r.step_order, r.content
        FROM roadmaps r
        JOIN games g ON g.id = r.game_id
       ORDER BY g.slug ASC, r.step_order ASC
    `);
    const trophies = await database.all(`
      SELECT g.slug,
             t.trophy_code,
             t.name,
             t.name_pt,
             t.type,
             t.description,
             t.tip,
             t.is_spoiler,
             t.is_missable
        FROM trophies t
        JOIN games g ON g.id = t.game_id
       ORDER BY g.slug ASC, t.id ASC
    `);
    const redirects = await database.all(`
      SELECT g.slug AS game_slug, r.slug
        FROM game_slug_redirects r
        JOIN games g ON g.id = r.game_id
       ORDER BY g.slug ASC, r.slug ASC
    `);

    const roadmapsBySlug = new Map();
    const trophiesBySlug = new Map();
    const redirectsBySlug = new Map();
    for (const row of roadmaps) {
      const slug = getCanonicalGameSlug(row.slug);
      if (!roadmapsBySlug.has(slug)) roadmapsBySlug.set(slug, []);
      roadmapsBySlug.get(slug).push({
        step_order: Number(row.step_order),
        content: row.content || ''
      });
    }
    for (const row of trophies) {
      const slug = getCanonicalGameSlug(row.slug);
      if (!trophiesBySlug.has(slug)) trophiesBySlug.set(slug, []);
      trophiesBySlug.get(slug).push({
        trophy_code: row.trophy_code || '',
        name: row.name || '',
        name_pt: row.name_pt || '',
        type: row.type || '',
        description: row.description || '',
        tip: row.tip || '',
        is_spoiler: Number(row.is_spoiler || 0),
        is_missable: Number(row.is_missable || 0)
      });
    }
    for (const row of redirects) {
      const slug = getCanonicalGameSlug(row.game_slug);
      const redirectSlug = String(row.slug || '').trim().toLowerCase();
      if (!redirectSlug || redirectSlug === slug) continue;
      addRedirectAlias(redirectsBySlug, slug, redirectSlug);
    }
    for (const [alias, canonicalSlug] of Object.entries(CANONICAL_GAME_SLUG_ALIASES)) {
      addRedirectAlias(redirectsBySlug, canonicalSlug, alias);
    }

    const seedExtrasBySlug = getSeedExtrasBySlug();
    const manifest = {
      schemaVersion: 1,
      dataKind: 'atlasachievement-guide-export',
      games: [],
      totals: {
        games: games.length,
        roadmaps: roadmaps.length,
        trophies: trophies.length,
        redirects: redirects.length
      }
    };

    for (const row of games) {
      const slug = getCanonicalGameSlug(row.slug || row.name);
      if (slug === RE5_SLUG && preserveRe5V2) {
        assertGuideSnapshotV2(previousRe5Snapshot, { mode: 'complete' });
        manifest.games.push(previousRe5Entry || {
          slug: RE5_SLUG,
          file: `${RE5_SLUG}.json`,
          name: previousRe5Snapshot.game.name,
          status: previousRe5Snapshot.review.status,
          trophies: previousRe5Snapshot.trophies.length,
          roadmaps: previousRe5Snapshot.roadmap.length,
          schemaVersion: 2,
          sourcePath: `data/guides/${RE5_SLUG}.json`,
          payloadHash: hashGuideSnapshotV2(previousRe5Snapshot),
          reviewedAt: previousRe5Snapshot.review.reviewedAt,
          trophyCount: previousRe5Snapshot.trophies.length,
          packageCounts: Object.fromEntries(previousRe5Snapshot.trophyPackages.map(pkg => [
            pkg.packageCode,
            previousRe5Snapshot.trophies.filter(trophy => trophy.packageCode === pkg.packageCode).length
          ])),
          sourceCount: previousRe5Snapshot.sources.length,
          claimCount: previousRe5Snapshot.claims.length,
          generatedAt: new Date().toISOString()
        });
        continue;
      }
      const exportedGame = applyProtectedVerificationStatus({ ...row, slug }, slug);
      const guide = {
        schemaVersion: 1,
        slug,
        game: pickColumns(exportedGame, GAME_COLUMNS),
        roadmaps: roadmapsBySlug.get(slug) || [],
        trophies: trophiesBySlug.get(slug) || [],
        redirects: redirectsBySlug.get(slug) || [],
        seedExtras: seedExtrasBySlug.get(slug) || null
      };

      const fileName = normalizeGuideFileName(slug);
      fs.writeFileSync(path.join(dataDir, fileName), stableStringify(guide));
      manifest.games.push({
        slug,
        file: fileName,
        name: row.name || '',
        trophies: guide.trophies.length,
        roadmaps: guide.roadmaps.length,
        status: exportedGame.verification_status || exportedGame.editorial_status || ''
      });
    }

    fs.writeFileSync(path.join(dataDir, 'manifest.json'), stableStringify(manifest));

    console.log(JSON.stringify({
      ok: true,
      mode: 'export',
      database: databasePath,
      backup: backupPath,
      output: dataDir,
      games: manifest.totals.games,
      trophies: manifest.totals.trophies,
      roadmaps: manifest.totals.roadmaps,
      redirects: manifest.totals.redirects
    }, null, 2));
  } finally {
    await database.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  exportGuideSnapshotV2
};
