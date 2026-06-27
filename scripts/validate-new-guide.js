const fs = require('fs');
const os = require('os');
const path = require('path');

const slug = process.argv[2];

if (!slug) {
  console.error('Uso: node scripts/validate-new-guide.js <slug>');
  process.exit(1);
}

const tempDbPath = path.join(os.tmpdir(), `atlas-guide-${slug}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = process.env.VALIDATE_NEW_GUIDE_DATABASE_PATH || tempDbPath;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const sampleGames = require('../src/data/sampleGames');
const migrate = require('../src/db/migrate');
const seed = require('../src/db/seed');
const gamesService = require('../src/services/games.service');
const { all, get, db } = require('../src/db/db');
const { getCanonicalGameSlug } = require('../src/utils/slug');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close(error => (error ? reject(error) : resolve()));
  });
}

function countTypes(trophies = []) {
  return trophies.reduce((counts, trophy) => {
    counts[trophy.type] = (counts[trophy.type] || 0) + 1;
    return counts;
  }, {});
}

function hasText(value) {
  return String(value || '').trim().length > 0;
}

async function main() {
  const canonicalSlug = getCanonicalGameSlug(slug);
  const seedGame = sampleGames.find(game => getCanonicalGameSlug(game.slug || game.name) === canonicalSlug);
  assert(seedGame, `sampleGames nao inclui ${canonicalSlug}`);
  assert(seedGame.slug === canonicalSlug, `slug canonico divergente: esperado ${canonicalSlug}, recebeu ${seedGame.slug}`);
  assert(hasText(seedGame.name), 'guia sem nome');
  assert(hasText(seedGame.before_you_start) || (Array.isArray(seedGame.editorial_summary) && seedGame.editorial_summary.length > 0), 'guia sem resumo da platina');
  assert(Array.isArray(seedGame.roadmap) && seedGame.roadmap.length > 0, 'guia sem roadmap');
  assert(Array.isArray(seedGame.faq) && seedGame.faq.length > 0, 'guia sem FAQ');
  assert(Array.isArray(seedGame.trophies) && seedGame.trophies.length > 0, 'guia sem trofeus');

  const missingTranslation = seedGame.trophies.filter(trophy => !hasText(trophy.name) || !hasText(trophy.name_pt || trophy.trophyNamePtBr));
  assert(missingTranslation.length === 0, `trofeus sem EN/PT-BR: ${missingTranslation.map(trophy => trophy.id || trophy.name).join(', ')}`);

  const sourceText = JSON.stringify(seedGame);
  ['[object Object]', 'NOME ORIGINAL', 'Objetivo registrado no checklist da platina', 'DLC no escopo'].forEach(term => {
    assert(!sourceText.includes(term), `placeholder proibido encontrado: ${term}`);
  });

  await migrate({ syncSeedData: false });
  await seed();

  const row = await get('SELECT id, slug, name, editorial_status, verification_status FROM games WHERE slug = ?', [canonicalSlug]);
  assert(row, `seed nao inseriu ${canonicalSlug} no banco temporario`);

  const trophyRows = await all('SELECT trophy_code, name, name_pt, type FROM trophies WHERE game_id = ? ORDER BY id', [row.id]);
  assert(trophyRows.length === seedGame.trophies.length, `contagem de trofeus divergente: seed=${seedGame.trophies.length}, db=${trophyRows.length}`);
  assert(trophyRows.every(trophy => hasText(trophy.name) && hasText(trophy.name_pt)), 'banco temporario tem trofeus sem EN/PT-BR');

  const roadmapRows = await all('SELECT id FROM roadmaps WHERE game_id = ?', [row.id]);
  assert(roadmapRows.length === seedGame.roadmap.length, `contagem de roadmap divergente: seed=${seedGame.roadmap.length}, db=${roadmapRows.length}`);

  const detail = await gamesService.getGameBySlug(canonicalSlug, { includeDrafts: false });
  assert(detail.slug === canonicalSlug, `rota /jogo/:slug nao resolveu ${canonicalSlug}`);
  assert(detail.trophies.length === seedGame.trophies.length, 'detalhe publico retornou contagem de trofeus divergente');

  const catalog = await gamesService.listGames({ includeDrafts: false, limit: 500, sort: 'name-asc' });
  const catalogItems = Array.isArray(catalog) ? catalog : catalog.items || [];
  assert(catalogItems.some(game => game.slug === canonicalSlug), `catalogo publico nao inclui ${canonicalSlug}`);

  const aliases = Array.isArray(seedGame.aliases || seedGame.slug_aliases) ? (seedGame.aliases || seedGame.slug_aliases) : [];
  for (const alias of aliases) {
    const aliasSlug = getCanonicalGameSlug(alias);
    if (!aliasSlug || aliasSlug === canonicalSlug) continue;
    const aliasDetail = await gamesService.getGameBySlug(aliasSlug, { includeDrafts: false });
    assert(aliasDetail.slug === canonicalSlug, `alias ${aliasSlug} nao resolveu para ${canonicalSlug}`);
  }

  console.log(JSON.stringify({
    ok: true,
    slug: canonicalSlug,
    source: 'src/data/sampleGames.js',
    database: process.env.DATABASE_PATH,
    catalog: true,
    route: `/jogo/${canonicalSlug}`,
    trophies: trophyRows.length,
    roadmap: roadmapRows.length,
    distribution: countTypes(seedGame.trophies),
    status: row.verification_status || row.editorial_status
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await closeDatabase();
    } catch (error) {
      console.error(error.message || error);
      process.exitCode = 1;
    }

    if (!process.env.VALIDATE_NEW_GUIDE_DATABASE_PATH && fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });
