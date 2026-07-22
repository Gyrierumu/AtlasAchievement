'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const {
  validateSourceRegistry, validateClaims, validateFreshness,
  detectSurfaceDivergences, detectObsolescence
} = require('../src/shared/re5GovernanceValidators');
const {
  ROOT, hash, assertRe5Slug, startAuditServer, stopAuditServer, writeJsonAndMarkdown
} = require('./re5-audit-utils');

const EXPECTED_COUNTS = {
  baseTrophies: 51, dlcTrophies: 20, uniqueTotal: 71, faq: 36, attention: 12,
  bosses: 22, bsaa: 30, treasures: 50, scoreStars: 18, agitators: 3,
  chapters: 16, roadmapStages: 7, instructionalFigures: 5, tabs: 6
};

function categoryCount(guide, id) {
  return guide.platinumBaseChecklist?.categories?.find(category => category.id === id)?.items?.length || 0;
}

function normalizeName(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function collectibleCount(guide, packageId, pattern) {
  const pack = guide.dlcCompletionGuide?.packages?.find(item => item.id === packageId);
  const list = pack?.collectibleChecklists?.find(item => pattern.test(item.title || ''));
  return (list?.groups || []).reduce((sum, group) => sum + (group.items?.length || 0), 0);
}

function metaContent(html, key, value) {
  const patterns = [
    new RegExp(`<meta[^>]+${key}=["']${value}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${key}=["']${value}["']`, 'i')
  ];
  return patterns.map(pattern => html.match(pattern)?.[1]).find(Boolean) || '';
}

function parseGraph(html) {
  const match = html.match(/<script[^>]*id=["']gameStructuredData["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return [];
  return JSON.parse(match[1])['@graph'] || [];
}

function findBrowser() {
  return [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].find(candidate => fs.existsSync(candidate));
}

function hydratedDom(url) {
  const executable = findBrowser();
  if (!executable) return { error: 'Edge/Chrome indisponível para DOM hidratado.', html: '' };
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-re5-audit-dom-'));
  try {
    const result = spawnSync(executable, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-component-update', '--dump-dom',
      '--virtual-time-budget=5000', `--user-data-dir=${profile}`, url
    ], { encoding: 'utf8', timeout: 30000, windowsHide: true, maxBuffer: 24 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
      return { error: result.error?.message || result.stderr || `browser exit ${result.status}`, html: result.stdout || '' };
    }
    return { error: null, html: result.stdout || '' };
  } finally {
    const resolved = path.resolve(profile);
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function openReadOnlyDatabase(file) {
  const db = new sqlite3.Database(file, sqlite3.OPEN_READONLY);
  return {
    get(sql, params = []) { return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row))); },
    all(sql, params = []) { return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows))); },
    close() { return new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve())); }
  };
}

function normalizeRoadmaps(items = []) {
  return items.map(item => ({
    title: item.title || '', focus: item.focus || '', objective: item.objective || item.description || '',
    actions: item.actions || [], warning: item.warning || item.risk || '', result: item.result || ''
  }));
}

function reportMarkdown(report) {
  const rows = report.checks.map(check => `| ${check.ok ? 'PASS' : 'FAIL'} | ${check.id} | ${check.detail.replace(/\|/g, '\\|')} |`).join('\n');
  return `# Audit estrutural RE5 — Fase 9

- Resultado: **${report.status}**
- Verificação técnica: ${report.lastChecked}
- Revisão editorial preservada: ${report.editorialDates.reviewedAt}
- Snapshot: \`${report.snapshot.sha256}\`
- Erros determinísticos: ${report.summary.failed}
- Alertas de obsolescência: ${report.obsolescence.length}

| Status | Regra | Evidência |
|---|---|---|
${rows}

O campo \`lastChecked\` pertence somente a este artefato técnico. O audit não altera \`reviewedAt\`, \`dateModified\`, sitemap ou changelog.
`;
}

async function main() {
  assertRe5Slug();
  const lastChecked = new Date().toISOString();
  const port = Number(process.env.RE5_PHASE9_AUDIT_PORT || (4390 + (process.pid % 100)));
  const sampleGames = require('../src/data/sampleGames');
  const seed = sampleGames.find(game => game.slug === 'resident-evil-5');
  const snapshotPath = path.join(ROOT, 'data', 'guides', 'resident-evil-5.json');
  const snapshotRaw = fs.readFileSync(snapshotPath, 'utf8');
  const snapshot = JSON.parse(snapshotRaw);
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'guides', 'manifest.json'), 'utf8'));
  const manifestEntry = (manifest.games || []).find(item => item.slug === 'resident-evil-5');
  const checks = [];
  const check = (id, ok, detail) => checks.push({ id, ok: Boolean(ok), detail: String(detail) });
  let server;
  try {
    server = await startAuditServer(port);
    const [apiResponse, htmlResponse, sitemapResponse] = await Promise.all([
      fetch(`${server.origin}/api/games/slug/resident-evil-5`),
      fetch(`${server.origin}/jogo/resident-evil-5`),
      fetch(`${server.origin}/sitemap.xml`)
    ]);
    const api = await apiResponse.json();
    const html = await htmlResponse.text();
    const sitemap = await sitemapResponse.text();
    const dom = hydratedDom(`${server.origin}/jogo/resident-evil-5?phase9_audit=1`);
    const graph = parseGraph(html);
    const article = graph.find(item => item['@type'] === 'Article') || {};
    const faqSchema = graph.find(item => item['@type'] === 'FAQPage') || {};
    const video = graph.find(item => item['@type'] === 'VideoGame') || {};
    const authority = seed.editorialAuthority || {};
    const registryValidation = validateSourceRegistry(authority.sourceRegistry);
    const claimValidation = validateClaims(authority.claims, authority.sourceRegistry);
    const freshnessValidation = validateFreshness(authority);

    const database = openReadOnlyDatabase(path.join(ROOT, 'database.sqlite'));
    let dbGame;
    let dbRoadmaps;
    let dbTrophies;
    try {
      dbGame = await database.get('SELECT id, slug, name, last_reviewed_at FROM games WHERE slug = ?', ['resident-evil-5']);
      dbRoadmaps = await database.all('SELECT content FROM roadmaps WHERE game_id = ? ORDER BY step_order', [dbGame.id]);
      dbTrophies = await database.all('SELECT trophy_code FROM trophies WHERE game_id = ? ORDER BY id', [dbGame.id]);
    } finally { await database.close(); }

    const baseIds = api.trophies.map(item => item.id || item.trophy_code || item.code);
    const dlcChecklist = api.dlcCompletionGuide?.checklist || [];
    const dlcIds = dlcChecklist.map(item => item.id || item.trophyId || item.code || item.name);
    const baseNames = api.trophies.map(item => normalizeName(item.name_pt || item.namePt || item.name));
    const dlcNames = dlcChecklist.map(item => normalizeName(item.name || item.title));
    const counts = {
      baseTrophies: baseIds.length,
      dlcTrophies: dlcIds.length,
      uniqueTotal: new Set([...baseIds, ...dlcIds]).size,
      faq: api.faq?.length || 0,
      attention: api.attentionPoints?.length || 0,
      bosses: categoryCount(api, 'bosses-critical-encounters'),
      bsaa: categoryCount(api, 'bsaa-emblems'),
      treasures: categoryCount(api, 'treasures'),
      scoreStars: collectibleCount(api, 'lost-in-nightmares', /Score Stars/i),
      agitators: collectibleCount(api, 'desperate-escape', /Agitator/i),
      chapters: api.chapterRouteGuide?.chapters?.length || 0,
      roadmapStages: api.roadmap?.length || 0,
      instructionalFigures: api.instructionalVisuals?.length || 0,
      tabs: (html.match(/id="guideTabButton-/g) || []).length
    };
    check('COUNTS_CANONICAL', JSON.stringify(counts) === JSON.stringify(EXPECTED_COUNTS), JSON.stringify(counts));
    check('BASE_IDS_UNIQUE', new Set(baseIds).size === 51, `${new Set(baseIds).size}/51 IDs únicos`);
    check('DLC_IDS_UNIQUE', new Set(dlcIds).size === 20, `${new Set(dlcIds).size}/20 IDs únicos`);
    check('TROPHY_NAMES_UNIQUE', new Set(baseNames).size === 51 && new Set(dlcNames).size === 20 && new Set([...baseNames, ...dlcNames]).size === 71, `base=${new Set(baseNames).size}; DLC=${new Set(dlcNames).size}; total=${new Set([...baseNames, ...dlcNames]).size}`);
    check('DB_TROPHIES_UNIQUE', new Set(dbTrophies.map(item => item.trophy_code)).size === 51, `${dbTrophies.length} linhas`);
    check('MANIFEST_ENTRY', manifestEntry?.file === 'resident-evil-5.json' && manifestEntry?.trophies === 51 && manifestEntry?.roadmaps === 7, JSON.stringify(manifestEntry || null));

    const editorialFields = ['editorialAuthority', 'platinumBaseChecklist', 'dlcCompletionGuide', 'instructionalVisuals', 'videoAudit'];
    const seedEditorial = Object.fromEntries(editorialFields.map(key => [key, seed[key] ?? null]));
    const snapshotEditorial = Object.fromEntries(editorialFields.map(key => [key, snapshot.seedExtras?.[key] ?? null]));
    const apiEditorial = Object.fromEntries(editorialFields.map(key => [key, api[key] ?? null]));
    check('SEED_SNAPSHOT_EDITORIAL_PARITY', hash(seedEditorial) === hash(snapshotEditorial), `${hash(seedEditorial)} / ${hash(snapshotEditorial)}`);
    check('SEED_API_EDITORIAL_PARITY', hash(seedEditorial) === hash(apiEditorial), `${hash(seedEditorial)} / ${hash(apiEditorial)}`);
    const seedRoadmapHash = hash(normalizeRoadmaps(seed.roadmap));
    const snapshotRoadmapHash = hash(normalizeRoadmaps((snapshot.roadmaps || []).map(item => JSON.parse(item.content))));
    const dbRoadmapHash = hash(normalizeRoadmaps(dbRoadmaps.map(item => JSON.parse(item.content))));
    const apiRoadmapHash = hash(normalizeRoadmaps(api.roadmap));
    check('ROADMAP_LAYER_PARITY', [snapshotRoadmapHash, dbRoadmapHash, apiRoadmapHash].every(value => value === seedRoadmapHash), `${seedRoadmapHash} / ${snapshotRoadmapHash} / ${dbRoadmapHash} / ${apiRoadmapHash}`);

    check('SOURCE_REGISTRY_VALID', registryValidation.valid && authority.sourceRegistry.length === 11, `${authority.sourceRegistry.length} fontes; ${registryValidation.errors.length} erros`);
    check('CLAIM_REGISTRY_VALID', claimValidation.valid && authority.claims.length === 17, `${authority.claims.length} claims; ${claimValidation.errors.length} erros`);
    check('FRESHNESS_HONEST', freshnessValidation.valid, freshnessValidation.errors.map(item => item.code).join(', ') || 'datas coerentes');
    check('PUBLIC_SOURCES_DERIVED', authority.sources.length === 6 && authority.sources.every(item => authority.sourceRegistry.some(source => source.id === item.id && source.title === item.name)), `${authority.sources.length} fontes públicas`);

    const allDressedFaq = api.faq.find(item => /All Dressed Up/i.test(item.question || ''))?.answer || '';
    const allDressedItem = api.platinumBaseChecklist?.categories?.flatMap(item => item.items || []).find(item => item.id === 're5-bonus-features-all-dressed-up');
    const allDressedText = JSON.stringify(allDressedItem || {});
    const scoreVisual = api.instructionalVisuals?.find(item => /score-stars/i.test(item.id || item.src || '')) || {};
    const agitatorVisual = api.instructionalVisuals?.find(item => /agitator/i.test(item.id || item.src || '')) || {};
    const scoreSvg = fs.readFileSync(path.join(ROOT, 'public', scoreVisual.src), 'utf8');
    const agitatorSvg = fs.readFileSync(path.join(ROOT, 'public', agitatorVisual.src), 'utf8');
    const heroScopeText = (html.match(/<dl class="atlas-re5-scope"[\s\S]*?<\/dl>/i)?.[0] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const sensitiveSurfaces = {
      're5-all-dressed-up': { faq: /quatro trajes originais/i.test(allDressedFaq) && /0 (?:Exchange )?Points/i.test(allDressedFaq), checklist: /quatro trajes adicionais/i.test(allDressedText) && /0 (?:Exchange )?Points/i.test(allDressedText) },
      're5-score-stars-18': { checklist: counts.scoreStars, alt: /18 Score Stars/i.test(scoreVisual.alt || '') ? 18 : 0, fallback: /#18|18\/18|18 Score Stars/i.test(JSON.stringify(scoreVisual.textFallback || [])) ? 18 : 0, svg: /18 Score Stars|#18/i.test(scoreSvg) ? 18 : 0 },
      're5-agitators-3': { checklist: counts.agitators, alt: /tr[eê]s Agitator|3 Agitator/i.test(agitatorVisual.alt || '') ? 3 : 0, fallback: (agitatorVisual.textFallback || []).length === 3 ? 3 : 0, svg: /Agitator #?3|3 Agitator/i.test(agitatorSvg) ? 3 : 0 },
      're5-counts': {
        seed: `${seed.trophies.length}/20`,
        api: `${api.trophies.length}/${api.dlcCompletionGuide?.dlcTrophies}`,
        hero: /51 troféus base[\s\S]*71 troféus com 20 DLCs/i.test(heroScopeText) ? '51/20' : 'missing',
        html: /51 troféus[^<]{0,160}20 troféus/i.test(html.replace(/<[^>]+>/g, ' ')) ? '51/20' : 'missing',
        jsonLd: /51 troféus/i.test(JSON.stringify(graph)) && /20 troféus/i.test(JSON.stringify(graph)) ? '51/20' : 'missing'
      }
    };
    const divergence = detectSurfaceDivergences(sensitiveSurfaces);
    check('SENSITIVE_SURFACES_CONSISTENT', divergence.valid, divergence.errors.map(item => item.id).join(', ') || 'sem divergências');
    check('SENSITIVE_SURFACES_EXPECTED',
      Object.values(sensitiveSurfaces['re5-all-dressed-up']).every(Boolean)
        && Object.values(sensitiveSurfaces['re5-score-stars-18']).every(value => value === 18)
        && Object.values(sensitiveSurfaces['re5-agitators-3']).every(value => value === 3)
        && Object.values(sensitiveSurfaces['re5-counts']).every(value => value === '51/20'),
      JSON.stringify(sensitiveSurfaces));

    const description = metaContent(html, 'name', 'description');
    const ogDescription = metaContent(html, 'property', 'og:description');
    const twitterDescription = metaContent(html, 'name', 'twitter:description');
    check('DESCRIPTIONS_MATCH', description === seed.seo.description && ogDescription === description && twitterDescription === description, `${description} / ${ogDescription} / ${twitterDescription}`);
    const sitemapEntry = [...sitemap.matchAll(/<url>[\s\S]*?<\/url>/gi)].map(match => match[0]).find(block => /<loc>[^<]*\/jogo\/resident-evil-5<\/loc>/i.test(block)) || '';
    const sitemapLastmod = sitemapEntry.match(/<lastmod>([^<]+)/)?.[1] || '';
    const htmlHasEditorialDate = new RegExp(`datetime=["']${authority.reviewedAt}["']`).test(html) || html.includes(`Revisado em ${authority.reviewedAt}`);
    check('EDITORIAL_DATE_SURFACES', article.dateModified === authority.reviewedAt && sitemapLastmod.slice(0, 10) === authority.reviewedAt && htmlHasEditorialDate, `seed=${authority.reviewedAt}; html=${htmlHasEditorialDate}; schema=${article.dateModified}; sitemap=${sitemapLastmod}`);
    check('JSON_LD_AUTHORSHIP', article.author?.name === authority.authorName && (faqSchema.mainEntity || []).length === 36 && JSON.stringify(video).includes('Resident Evil 5'), `${article.author?.name}; FAQ=${faqSchema.mainEntity?.length || 0}`);
    const onlineText = `${api.dlcCompletionGuide?.packages?.[0]?.availabilityNote || ''} ${authority.limitations?.join(' ') || ''}`;
    check('ONLINE_CAVEAT_PRESENT', /aparentemente dispon[ií]vel|aparentemente acess[ií]vel/i.test(onlineText) && /n[aã]o (?:presuma|garante|equivale|prova)/i.test(onlineText), onlineText.slice(0, 260));

    const ssrIds = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map(match => match[1]);
    check('SSR_IDS_UNIQUE', new Set(ssrIds).size === ssrIds.length, `${ssrIds.length - new Set(ssrIds).size} duplicados`);
    check('SSR_SURFACE', (html.match(/data-trophy-id=/g) || []).length === 51 && (html.match(/class="atlas-faq-item/g) || []).length === 36, `troféus=${(html.match(/data-trophy-id=/g) || []).length}; FAQ=${(html.match(/class="atlas-faq-item/g) || []).length}`);
    check('DOM_BROWSER_COMPLETED', !dom.error, dom.error || `${Buffer.byteLength(dom.html)} bytes`);
    check('DOM_HYDRATED_SURFACE', !dom.error && (dom.html.match(/data-trophy-id=/g) || []).length === 51 && (dom.html.match(/id="guideTabButton-/g) || []).length === 6 && /re5-ready/.test(dom.html), `troféus=${(dom.html.match(/data-trophy-id=/g) || []).length}; tabs=${(dom.html.match(/id="guideTabButton-/g) || []).length}`);
    check('API_AND_HTML_OK', apiResponse.ok && htmlResponse.ok && sitemapResponse.ok, `${apiResponse.status}/${htmlResponse.status}/${sitemapResponse.status}`);

    const obsolescence = detectObsolescence(authority, new Date(lastChecked));
    const failed = checks.filter(item => !item.ok).length + registryValidation.errors.length + claimValidation.errors.length + freshnessValidation.errors.length;
    const report = {
      schemaVersion: 1,
      audit: 'resident-evil-5-structural-governance',
      lastChecked,
      status: failed ? 'FAIL' : 'PASS',
      summary: { total: checks.length, passed: checks.filter(item => item.ok).length, failed },
      counts,
      expectedCounts: EXPECTED_COUNTS,
      editorialDates: { reviewedAt: authority.reviewedAt, dateModified: authority.governance?.dateModified, sitemap: sitemapEntry.match(/<lastmod>([^<]+)/)?.[1] || null },
      snapshot: { file: 'data/guides/resident-evil-5.json', sha256: hash(snapshot), bytes: Buffer.byteLength(snapshotRaw) },
      manifest: manifestEntry,
      registry: { sources: authority.sourceRegistry.length, publicSources: authority.sources.length, claims: authority.claims.length, errors: [...registryValidation.errors, ...claimValidation.errors], warnings: [...registryValidation.warnings, ...claimValidation.warnings] },
      freshness: freshnessValidation,
      obsolescence,
      checks
    };
    const paths = writeJsonAndMarkdown('structural-audit', report, reportMarkdown(report));
    process.stdout.write(`Audit estrutural ${report.status}: ${paths.jsonPath}\n`);
    if (failed) process.exitCode = 1;
  } finally {
    await stopAuditServer(server);
  }
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
