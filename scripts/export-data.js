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
  normalizeGuideFileName
} = require('./data-sync-utils');

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

async function main() {
  const args = parseArgs();
  const dataDir = normalizeDataDir(args.dataDir);
  const databasePath = path.resolve(env.databasePath);

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

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
