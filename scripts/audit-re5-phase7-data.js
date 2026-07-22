const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'artifacts', 're5-phase7', 'data-layer-audit.json');
const ORIGIN = process.env.RE5_QA_ORIGIN || 'http://127.0.0.1:4319';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((result, key) => { result[key] = stable(value[key]); return result; }, {});
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function openReadOnlyDatabase(file) {
  const db = new sqlite3.Database(file, sqlite3.OPEN_READONLY);
  const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
  const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
  const close = () => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
  return { get, all, close };
}

function categoryCount(guide, id) {
  return guide.platinumBaseChecklist?.categories?.find(category => category.id === id)?.items?.length || 0;
}

function collectibleCount(guide, packageId, titlePattern) {
  const pack = guide.dlcCompletionGuide?.packages?.find(item => item.id === packageId);
  const list = pack?.collectibleChecklists?.find(item => titlePattern.test(item.title || ''));
  return (list?.groups || []).reduce((sum, group) => sum + (group.items?.length || 0), 0);
}

function normalizeRoadmaps(items = []) {
  return items.map(item => ({
    title: item.title || '',
    focus: item.focus || '',
    objective: item.objective || item.description || '',
    actions: item.actions || [],
    warning: item.warning || item.risk || '',
    result: item.result || ''
  }));
}

async function main() {
  const sampleGames = require(path.join(ROOT, 'src', 'data', 'sampleGames'));
  const seed = sampleGames.find(game => game.slug === 'resident-evil-5');
  const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'guides', 'resident-evil-5.json'), 'utf8'));
  const [api, html, sitemap] = await Promise.all([
    fetch(`${ORIGIN}/api/games/slug/resident-evil-5`).then(response => response.json()),
    fetch(`${ORIGIN}/jogo/resident-evil-5`).then(response => response.text()),
    fetch(`${ORIGIN}/sitemap.xml`).then(response => response.text())
  ]);

  const database = openReadOnlyDatabase(path.join(ROOT, 'database.sqlite'));
  let dbRoadmaps;
  let dbTrophies;
  let dbGame;
  try {
    dbGame = await database.get('SELECT id, slug, name, last_reviewed_at, verification_status FROM games WHERE slug = ?', ['resident-evil-5']);
    dbRoadmaps = await database.all('SELECT step_order, content FROM roadmaps WHERE game_id = ? ORDER BY step_order', [dbGame.id]);
    dbTrophies = await database.all('SELECT trophy_code, name, name_pt, type, description, tip, is_spoiler, is_missable FROM trophies WHERE game_id = ? ORDER BY id', [dbGame.id]);
  } finally { await database.close(); }

  const seedRoadmaps = normalizeRoadmaps(seed.roadmap);
  const snapshotRoadmaps = normalizeRoadmaps(snapshot.roadmaps.map(item => JSON.parse(item.content)));
  const databaseRoadmaps = normalizeRoadmaps(dbRoadmaps.map(item => JSON.parse(item.content)));
  const apiRoadmaps = normalizeRoadmaps(api.roadmap);
  const dlcChecklist = api.dlcCompletionGuide?.checklist || [];
  const baseIds = api.trophies.map(item => item.id || item.trophy_code || item.code);
  const dlcIds = dlcChecklist.map(item => item.id || item.trophyId || item.code || item.name);
  const graphMatch = html.match(/<script[^>]*id=["']gameStructuredData["'][^>]*>([\s\S]*?)<\/script>/i);
  const graph = JSON.parse(graphMatch[1])['@graph'];
  const faqSchema = graph.find(item => item['@type'] === 'FAQPage');
  const htmlIds = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map(match => match[1]);
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '';

  const editorialFields = ['editorialDisplay', 'editorialAuthority', 'platinumBaseChecklist', 'videoAudit', 'instructionalVisuals', 'chapterRouteGuide', 'professionalAiGuide', 'farmRoutesGuide', 'commonMythsGuide', 'dlcCompletionGuide'];
  const editorialSeed = Object.fromEntries(editorialFields.map(key => [key, seed[key] ?? null]));
  const editorialSnapshot = Object.fromEntries(editorialFields.map(key => [key, snapshot.seedExtras?.[key] ?? null]));
  const editorialApi = Object.fromEntries(editorialFields.map(key => [key, api[key] ?? null]));

  const counts = {
    baseTrophies: api.trophies.length,
    dlcTrophies: dlcChecklist.length,
    uniqueTotal: new Set([...baseIds, ...dlcIds]).size,
    faq: api.faq.length,
    attention: api.attentionPoints.length,
    bosses: categoryCount(api, 'bosses-critical-encounters'),
    bsaa: categoryCount(api, 'bsaa-emblems'),
    treasures: categoryCount(api, 'treasures'),
    ranks: categoryCount(api, 'ranks-s-chapters'),
    scoreStars: collectibleCount(api, 'lost-in-nightmares', /Score Stars/i),
    agitators: collectibleCount(api, 'desperate-escape', /Agitator/i),
    chapters: api.chapterRouteGuide?.chapters?.length || 0,
    roadmapStages: api.roadmap.length,
    instructionalFigures: api.instructionalVisuals.length,
    tabsSsr: (html.match(/id="guideTabButton-/g) || []).length,
    trophyCardsSsr: (html.match(/data-trophy-id=/g) || []).length,
    faqSsr: (html.match(/class="atlas-faq-item/g) || []).length,
    attentionSsr: (html.match(/class="atlas-re5-attention-item/g) || []).length
  };

  const result = {
    generatedAt: new Date().toISOString(),
    counts,
    uniqueness: {
      htmlIds: htmlIds.length,
      duplicateHtmlIds: [...new Set(htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index))],
      baseIds: baseIds.length,
      uniqueBaseIds: new Set(baseIds).size,
      dlcIds: dlcIds.length,
      uniqueDlcIds: new Set(dlcIds).size,
      databaseTrophies: dbTrophies.length,
      uniqueDatabaseTrophyCodes: new Set(dbTrophies.map(item => item.trophy_code)).size
    },
    hashes: {
      roadmap: { seed: hash(seedRoadmaps), snapshot: hash(snapshotRoadmaps), database: hash(databaseRoadmaps), api: hash(apiRoadmaps) },
      editorial: { seed: hash(editorialSeed), snapshot: hash(editorialSnapshot), api: hash(editorialApi) },
      trophies: { snapshot: hash(snapshot.trophies), database: hash(dbTrophies) }
    },
    parity: {
      roadmapSeedSnapshot: hash(seedRoadmaps) === hash(snapshotRoadmaps),
      roadmapSeedDatabase: hash(seedRoadmaps) === hash(databaseRoadmaps),
      roadmapSeedApi: hash(seedRoadmaps) === hash(apiRoadmaps),
      editorialSeedSnapshot: hash(editorialSeed) === hash(editorialSnapshot),
      editorialSeedApi: hash(editorialSeed) === hash(editorialApi),
      trophiesSnapshotDatabase: hash(snapshot.trophies) === hash(dbTrophies),
      reviewDateSeedSnapshotApi: [seed.lastReviewedAt, snapshot.seedExtras?.lastReviewedAt, api.lastReviewedAt].every(value => String(value || '').slice(0, 10) === '2026-07-18')
    },
    seo: {
      canonical,
      hasNoindex: /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html),
      sitemapOccurrences: (sitemap.match(/\/jogo\/resident-evil-5</g) || []).length,
      graphTypes: graph.map(item => item['@type']),
      faqSchemaCount: faqSchema?.mainEntity?.length || 0,
      articleAuthor: graph.find(item => item['@type'] === 'Article')?.author?.name || '',
      articleDateModified: graph.find(item => item['@type'] === 'Article')?.dateModified || ''
    },
    databaseGame: dbGame
  };

  assert.deepStrictEqual(counts, {
    baseTrophies: 51, dlcTrophies: 20, uniqueTotal: 71, faq: 36, attention: 12, bosses: 22, bsaa: 30, treasures: 50, ranks: 16,
    scoreStars: 18, agitators: 3, chapters: 16, roadmapStages: 7, instructionalFigures: 5, tabsSsr: 6, trophyCardsSsr: 51, faqSsr: 36, attentionSsr: 12
  });
  assert.deepStrictEqual(result.uniqueness.duplicateHtmlIds, []);
  assert.strictEqual(result.uniqueness.uniqueBaseIds, 51);
  assert.strictEqual(result.uniqueness.uniqueDlcIds, 20);
  assert.strictEqual(result.uniqueness.uniqueDatabaseTrophyCodes, 51);
  assert(Object.values(result.parity).every(Boolean), `Layer parity failed: ${JSON.stringify(result.parity)}`);
  assert.strictEqual(result.seo.canonical, 'https://atlasachievement.com.br/jogo/resident-evil-5');
  assert.strictEqual(result.seo.hasNoindex, false);
  assert.strictEqual(result.seo.sitemapOccurrences, 1);
  assert.strictEqual(result.seo.faqSchemaCount, 36);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`Phase 7 data/layer audit passed: ${OUTPUT}\n`);
}

main().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
