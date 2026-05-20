const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PLACEHOLDER_RE = /\[object Object\]|\bundefined\b|>\s*null\s<|Descrição em revisão editorial\./i;
const ROADMAP_FORBIDDEN_RE = /\[object Object\]|\btitle:|\bfocus:|\bobjective:|\bactions:|Comece pela rota segura|Etapa\s+\d+\s+gen[eé]rica|Etapa gen[eé]rica/i;

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function loadSampleGames() {
  return require(path.join(ROOT, 'src/data/sampleGames'));
}

function loadGuideModel() {
  return require(path.join(ROOT, 'src/shared/guideViewModel'));
}

function getSlugArg() {
  return String(process.argv[3] || '').trim().toLowerCase();
}

function isValidImage(value = '') {
  const text = String(value || '').trim();
  return /^https:\/\//i.test(text) || /^\/(?:assets|uploads)\//i.test(text);
}

function assertNoVisiblePlaceholders(label, value = '') {
  assert(!PLACEHOLDER_RE.test(String(value || '')), `${label} nao deve conter placeholder visivel`);
}

function visibleGameText(game = {}) {
  const trophyText = (game.trophies || [])
    .map(item => [item.id, item.name, item.name_pt, item.description, item.descriptionPtBr, item.tip, item.guideTip].join(' '))
    .join(' ');
  const roadmapText = (game.roadmap || [])
    .map(step => typeof step === 'string' ? step : JSON.stringify(step))
    .join(' ');
  return [
    game.name,
    game.slug,
    game.missable,
    game.runs_summary,
    game.missable_summary,
    game.online_summary,
    game.grind_summary,
    game.dlc_scope,
    game.difficulty_reason,
    game.time_reason,
    game.first_run_advice,
    game.cleanup_advice,
    game.before_you_start,
    game.best_for,
    game.avoid_if,
    roadmapText,
    trophyText
  ].join(' ');
}

function getGameBySlug(slug) {
  const sampleGames = loadSampleGames();
  const game = sampleGames.find(item => String(item.slug || '').toLowerCase() === slug);
  assert(game, `Jogo nao encontrado nos dados seed: ${slug}`);
  return game;
}

function validateData() {
  const sampleGames = loadSampleGames();
  const slugs = new Set();
  const names = new Set();

  assert(sampleGames.length > 0, 'sampleGames deve conter jogos');

  for (const game of sampleGames) {
    assert(game.name, 'todo jogo deve ter name');
    assert(game.slug, `${game.name || 'jogo'} deve ter slug`);
    assert(!slugs.has(game.slug), `slug duplicado: ${game.slug}`);
    slugs.add(game.slug);

    const normalizedName = normalizeText(game.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    assert(!names.has(normalizedName), `jogo duplicado por nome: ${game.name}`);
    names.add(normalizedName);

    assert(isValidImage(game.image), `${game.slug} deve ter image valida https ou asset interno`);
    if (game.cover_image) assert(isValidImage(game.cover_image), `${game.slug} deve ter cover_image valida`);
    assertNoVisiblePlaceholders(`${game.slug} dados publicos`, visibleGameText(game));

    const trophies = Array.isArray(game.trophies) ? game.trophies : [];
    assert(trophies.length > 0, `${game.slug} deve ter trofeus cadastrados`);
    const trophyIds = new Set();
    for (const trophy of trophies) {
      assert(trophy.id, `${game.slug} tem trofeu sem id`);
      assert(!trophyIds.has(trophy.id), `${game.slug} tem trophy id duplicado: ${trophy.id}`);
      trophyIds.add(trophy.id);
      assert(trophy.name, `${game.slug}/${trophy.id} deve ter name`);
      assert(trophy.type, `${game.slug}/${trophy.id} deve ter type`);
    }
  }

  console.log(`test:data passed (${sampleGames.length} jogos)`);
}

function validateRoadmaps() {
  const sampleGames = loadSampleGames();
  const guideModel = loadGuideModel();

  for (const game of sampleGames) {
    const rawRoadmap = Array.isArray(game.roadmap) ? game.roadmap : [];
    assert(rawRoadmap.length > 0, `${game.slug} deve ter roadmap`);
    const normalized = guideModel.normalizeRoadmapForSave(rawRoadmap);
    assert.strictEqual(normalized.length, rawRoadmap.length, `${game.slug} deve preservar quantidade de etapas no normalizador`);

    normalized.forEach((step, index) => {
      const label = `${game.slug} etapa ${index + 1}`;
      assert(step && typeof step === 'object' && !Array.isArray(step), `${label} deve ser objeto estruturado apos normalizacao`);
      assert(Array.isArray(step.actions), `${label} deve ter actions em array`);
      assert(step.title, `${label} deve ter title`);
      const rawText = typeof rawRoadmap[index] === 'string' ? rawRoadmap[index] : JSON.stringify(rawRoadmap[index]);
      const normalizedText = [step.title, step.focus, step.objective, ...step.actions, step.warning, step.result].join(' ');
      assert(!ROADMAP_FORBIDDEN_RE.test(rawText), `${label} nao deve conter roadmap cru, serializado ou generico`);
      assert(!ROADMAP_FORBIDDEN_RE.test(normalizedText), `${label} nao deve normalizar para roadmap cru, serializado ou generico`);
    });
  }

  console.log(`test:roadmap passed (${sampleGames.length} roadmaps)`);
}

async function withTempApp(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-layer-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = path.join(tempDir, 'database.sqlite');
  process.env.UPLOAD_DIR = path.join(tempDir, 'uploads');
  process.env.SESSION_CLEANUP_INTERVAL_MINUTES = '0';
  process.env.RUN_SEED_SYNC = 'true';

  const migrate = require(path.join(ROOT, 'src/db/migrate'));
  const seed = require(path.join(ROOT, 'src/db/seed'));
  const app = require(path.join(ROOT, 'src/app'));
  const { db, get, run } = require(path.join(ROOT, 'src/db/db'));

  await migrate();
  await seed();

  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    return await callback({ baseUrl, app, get, run });
  } finally {
    server.closeIdleConnections?.();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
  }
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(30000)
  });
  assert(response.ok, `${url} deveria responder 2xx, retornou ${response.status}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30000)
  });
  assert(response.ok, `${url} deveria responder 2xx, retornou ${response.status}`);
  return response.json();
}

function getMeta(html = '', name = '') {
  return html.match(new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, 'i'))?.[1] || '';
}

function getCanonical(html = '') {
  return html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i)?.[1] || '';
}

function getTitle(html = '') {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
}

function assertSeoHtml(html, { slug, name, baseUrl }) {
  const title = getTitle(html);
  const description = getMeta(html, 'description');
  const canonical = getCanonical(html);
  assert(title && title.includes(name), `${slug} deve ter title com nome do jogo`);
  assert(description && description.length >= 30 && description.includes(name), `${slug} deve ter meta description util`);
  assert(canonical === `${baseUrl}/jogo/${slug}` || canonical === `https://atlasachievement.com.br/jogo/${slug}`, `${slug} deve ter canonical correto`);
  assert(html.includes('<script type="application/ld+json" id="gameStructuredData">'), `${slug} deve ter JSON-LD`);
}

function assertNoRequiemInternalCopy(html = '', options = {}) {
  const forbidden = [
    'Não marcar DLC como obrigatória sem fonte',
    'Corrigir nomes PT-BR quando houver fonte confiável',
    'quando houver fonte confiável',
    'sem fonte',
    'dados atuais do guia',
    'needs_',
    'Pontos críticos',
    'Base game sem DLCs'
  ];
  if (options.verified) {
    forbidden.push('validação final', 'Aguardando revisão final', 'Em revisão');
  }
  forbidden.forEach(text => {
    assert(!html.includes(text), `Resident Evil Requiem nao deve exibir: ${text}`);
  });
  assert(!/Pontos de atenção\s*5\s*-/i.test(html), 'Pontos de atencao nao deve ter hifen solto');
  assert(!/FAQ\s*6\s*-/i.test(html), 'FAQ nao deve ter hifen solto');
  assert(!/Confiança editorial\s*Metodologia\s*-/i.test(html), 'Confianca editorial nao deve ter hifen solto');
}

function assertNoLooseEditorialHyphen(html = '', label = 'guia') {
  assert(!/Pontos de aten(?:ção|Ã§Ã£o)\s*5\s*-/i.test(html), `${label} nao deve ter hifen solto em Pontos de atencao`);
  assert(!/FAQ\s*6\s*-/i.test(html), `${label} nao deve ter hifen solto em FAQ`);
  assert(!/Confian(?:ça|Ã§a) editorial\s*Metodologia\s*-/i.test(html), `${label} nao deve ter hifen solto em Confianca editorial`);
}

async function validateGuide(slug = '') {
  assert(slug, 'Informe um slug. Exemplo: npm run test:guide -- resident-evil-requiem');
  const seedGame = getGameBySlug(slug);
  const guideModel = loadGuideModel();
  const viewModel = guideModel.buildGuideViewModel(seedGame, []);

  assert.strictEqual(seedGame.slug, slug, 'slug seed deve bater com argumento');
  assert.strictEqual(viewModel.trophies.length, seedGame.trophies.length, `${slug} deve preservar total de trofeus no view model`);
  assert.strictEqual(new Set(seedGame.trophies.map(item => item.id)).size, seedGame.trophies.length, `${slug} deve ter trophy ids unicos`);
  assert(viewModel.roadmapStages.length > 0, `${slug} deve ter roadmap`);
  assert(viewModel.roadmapStages.every(step => Array.isArray(step.actions)), `${slug} deve ter roadmap estruturado com actions em array`);
  assertNoVisiblePlaceholders(`${slug} checklist`, seedGame.trophies.map(item => `${item.id} ${item.name} ${item.description} ${item.tip}`).join(' '));
  assert(isValidImage(seedGame.image), `${slug} deve ter image valida`);
  if (seedGame.cover_image) assert(isValidImage(seedGame.cover_image), `${slug} deve ter cover_image valida`);

  const missableSeedCount = seedGame.trophies.filter(item => item.is_missable).length;
  assert.strictEqual(viewModel.missableCount, missableSeedCount, `${slug} deve manter missableCount coerente`);
  assert.strictEqual(Boolean(seedGame.onlineRequired || seedGame.online_required), Boolean(viewModel.scopeModel?.network?.hasOnline), `${slug} deve manter online coerente`);
  assert.strictEqual(Boolean(seedGame.coopRequired || seedGame.coop_required), Boolean(viewModel.scopeModel?.network?.hasCoop), `${slug} deve manter coop coerente`);
  if (slug === 'resident-evil-requiem') {
    assert.strictEqual(viewModel.trophies.length, 50, 'Resident Evil Requiem deve manter 50 trofeus');
    assert.strictEqual(viewModel.missableCount, 4, 'Resident Evil Requiem deve manter 4 perdiveis');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Resident Evil Requiem deve manter roadmap com 6 etapas');
    assert.strictEqual(seedGame.dlcRequired || seedGame.dlc_required || false, false, 'Resident Evil Requiem deve manter DLC nao obrigatoria');
    assert(!visibleGameText(seedGame).includes('Não marcar DLC como obrigatória sem fonte'), 'Resident Evil Requiem nao deve manter instrucao interna de DLC no seed');
    assert(!visibleGameText(seedGame).includes('Corrigir nomes PT-BR quando houver fonte confiável'), 'Resident Evil Requiem nao deve manter instrucao interna de localizacao no seed');
    const guideCss = fs.readFileSync(path.join(ROOT, 'public/css/guide.css'), 'utf8');
    assert(!/atlas-editorial-note\[open\]\s+summary::after\s*\{[^}]*content:\s*['"]-['"]/is.test(guideCss), 'acordeao de notas nao deve renderizar hifen textual quando aberto');
  }
  if (slug === 'hades') {
    const hadesText = visibleGameText(seedGame);
    assert.strictEqual(seedGame.is_verified, true, 'Hades deve continuar verified no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'Hades deve continuar com verification_status verified');
    assert.strictEqual(viewModel.trophies.length, 50, 'Hades deve manter 50 trofeus');
    assert.strictEqual(viewModel.missableCount, 0, 'Hades deve manter missableCount 0');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Hades deve manter roadmap com 6 etapas');
    assert.strictEqual(seedGame.dlcRequired || seedGame.dlc_required || false, false, 'Hades deve manter DLC nao obrigatoria');
    ['Fatéd List', 'FatÃ©d List', 'condicao', 'Bençãos', 'BenÃ§Ã£os', 'O Segredo de Familia', 'Descrição em revisão editorial.', 'DescriÃ§Ã£o em revisÃ£o editorial.'].forEach(text => {
      assert(!hadesText.includes(text), `Hades nao deve conter texto incorreto: ${text}`);
    });
    assert(!/\bnao\b/i.test(hadesText), 'Hades nao deve conter "nao" sem acento em texto publico');
    assert(hadesText.includes('Fated List'), 'Hades deve preservar Fated List');
    assert(hadesText.includes('Bênçãos') || hadesText.includes('BÃªnÃ§Ã£os'), 'Hades deve corrigir Bencoes');
    assert(hadesText.includes('O Segredo de Família') || hadesText.includes('O Segredo de FamÃ­lia'), 'Hades deve corrigir Familia');
    const guideCss = fs.readFileSync(path.join(ROOT, 'public/css/guide.css'), 'utf8');
    assert(!/atlas-editorial-note\[open\]\s+summary::after\s*\{[^}]*content:\s*['"]-['"]/is.test(guideCss), 'acordeao de notas nao deve renderizar hifen textual quando aberto');
  }
  if (slug === 'ghost-of-tsushima') {
    const ghostText = visibleGameText(seedGame);
    assert.strictEqual(seedGame.is_verified, true, 'Ghost of Tsushima deve continuar verified no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'Ghost of Tsushima deve continuar com verification_status verified');
    assert.strictEqual(viewModel.trophies.length, 52, 'Ghost of Tsushima deve manter 52 trofeus');
    assert.strictEqual(viewModel.missableCount, 0, 'Ghost of Tsushima deve manter missableCount 0');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Ghost of Tsushima deve manter roadmap com 6 etapas');
    assert.strictEqual(seedGame.dlcRequired || seedGame.dlc_required || false, false, 'Ghost of Tsushima deve manter DLC nao obrigatoria');
    ['Maté', 'Watér', 'Resgaté', 'Base game sem DLCs'].forEach(text => {
      assert(!ghostText.includes(text), `Ghost of Tsushima nao deve conter texto incorreto: ${text}`);
    });
  }
  if (slug === 'hades-ii') {
    const hades2Text = visibleGameText(seedGame);
    const witch = seedGame.trophies.find(item => item.id === 'hades2_witch_of_the_clouds');
    const witchTags = guideModel.getGuideTrophyTags(witch, seedGame).map(tag => tag.label);
    assert.strictEqual(seedGame.is_verified, true, 'Hades II deve continuar verified no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'Hades II deve continuar com verification_status verified');
    assert.strictEqual(viewModel.trophies.length, 50, 'Hades II deve manter 50 trofeus');
    assert.strictEqual(viewModel.missableCount, 0, 'Hades II deve manter missableCount 0');
    assert.strictEqual(seedGame.trophies.filter(item => item.is_missable).length, 0, 'Hades II deve manter checklist com Perdiveis 0');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Hades II deve manter roadmap com 6 etapas');
    assert.strictEqual(seedGame.dlcRequired || seedGame.dlc_required || false, false, 'Hades II deve manter DLC nao obrigatoria');
    assert(witch && !witch.is_missable && !witchTags.includes('Perdível'), 'Witch of the Clouds nao deve aparecer como Perdivel com missableCount 0');
    ['em revisão editorial', 'mantendo o guia em revisão', 'validação final', 'dados atuais do guia', 'segundo os dados atuais do guia', 'o guia não aponta', 'needs_', 'bugged_unlock', 'localization_check', 'manual_editorial_verification', 'Base game sem DLCs'].forEach(text => {
      assert(!hades2Text.includes(text), `Hades II nao deve conter texto publico/internal incorreto: ${text}`);
    });
  }

  await withTempApp(async ({ baseUrl, run }) => {
    const apiGame = await fetchJson(`${baseUrl}/api/games/slug/${slug}`);
    assert.strictEqual(apiGame.slug, slug, 'API deve retornar o slug correto');
    assert.strictEqual(apiGame.trophies.length, seedGame.trophies.length, 'API deve retornar total de trofeus esperado');
    assert.strictEqual(apiGame.roadmap.length, viewModel.roadmapStages.length, 'API deve retornar roadmap esperado');

    const html = await fetchText(`${baseUrl}/jogo/${slug}`, { headers: { accept: 'text/html' } });
    assertSeoHtml(html, { slug, name: seedGame.name, baseUrl });
    assert(!PLACEHOLDER_RE.test(html), `${slug} SSR nao deve renderizar placeholders`);
    assert(!/needs_trophy_list_validation|needs_missables_validation|needs_trophy_localization_check/.test(html), `${slug} nao deve expor warnings tecnicos publicamente`);
    assert(html.includes(seedGame.name), `${slug} SSR deve renderizar o nome do jogo`);
    if (seedGame.cover_image) assert(html.includes(seedGame.cover_image), `${slug} SSR deve renderizar cover_image`);
    if (slug === 'resident-evil-requiem') {
      assertNoRequiemInternalCopy(html);
      assert(html.includes('DLC fora da platina base'), 'Resident Evil Requiem deve exibir DLC fora da platina base');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/resident-evil-requiem', 'canonical de Resident Evil Requiem deve usar dominio de producao');
      await run("UPDATE games SET is_verified = 1, verification_status = 'verified', editorial_review_status = 'verified' WHERE slug = ?", [slug]);
      const verifiedHtml = await fetchText(`${baseUrl}/jogo/${slug}`, { headers: { accept: 'text/html' } });
      assert(verifiedHtml.includes('Verificado'), 'Resident Evil Requiem verified deve exibir Verificado');
      assert(verifiedHtml.includes('Guia revisado editorialmente para a lista base.'), 'Resident Evil Requiem verified deve exibir mensagem revisada');
      assertNoRequiemInternalCopy(verifiedHtml, { verified: true });
    }
    if (slug === 'hades') {
      assert.strictEqual(apiGame.is_verified, true, 'API de Hades deve continuar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Hades deve expor verification_status verified');
      assert.strictEqual(apiGame.missable_count, 0, 'API de Hades deve manter missable_count 0');
      assert.strictEqual(apiGame.dlcRequired || apiGame.dlc_required || false, false, 'API de Hades deve manter DLC nao obrigatoria');
      assert(html.includes('Hades — Guia de platina e troféus') || html.includes('Hades â€” Guia de platina e trofÃ©us'), 'Hades deve renderizar H1 de guia de platina e trofeus');
      assert(html.includes('Verificado'), 'Hades deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente para a lista base.'), 'Hades deve renderizar mensagem de guia revisado');
      assert(html.includes('DLC fora da platina base'), 'Hades deve exibir DLC fora da platina base');
      assert(html.includes('Hades é uma platina baseada em progresso acumulado entre runs') || html.includes('Hades Ã© uma platina baseada em progresso acumulado entre runs'), 'Hades deve exibir resumo editorial novo');
      const hadesSummaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      assert((hadesSummaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de Hades deve ter pelo menos 2 paragrafos editoriais');
      ['Aguardando revisão final', 'validação final', 'needs_', 'Fatéd List', 'Bençãos', 'O Segredo de Familia', '[object Object]', 'undefined'].forEach(text => {
        assert(!html.includes(text), `Hades SSR nao deve exibir: ${text}`);
      });
      assert(!/>\s*null\s*</i.test(html), 'Hades SSR nao deve exibir null visivel');
      assertNoLooseEditorialHyphen(html, 'Hades');
      assert.strictEqual(getTitle(html), 'Hades: guia de platina, troféus e roadmap | AtlasAchievement', 'title de Hades deve seguir SEO esperado');
      assert.strictEqual(getMeta(html, 'description'), 'Guia de platina de Hades em português, com tempo estimado, dificuldade, roadmap, checklist, Fated List, Keepsakes, Companions, Pact of Punishment, Heat e dicas para a platina.', 'meta description de Hades deve seguir SEO esperado');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/hades', 'canonical de Hades deve usar dominio de producao');
    }
    if (slug === 'ghost-of-tsushima') {
      assert.strictEqual(apiGame.is_verified, true, 'API de Ghost of Tsushima deve continuar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Ghost of Tsushima deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 52, 'API de Ghost of Tsushima deve manter 52 trofeus');
      assert.strictEqual(apiGame.missable_count, 0, 'API de Ghost of Tsushima deve manter missable_count 0');
      assert.strictEqual(apiGame.dlcRequired || apiGame.dlc_required || false, false, 'API de Ghost of Tsushima deve manter DLC nao obrigatoria');
      assert(html.includes('Ghost of Tsushima — Guia de platina e troféus'), 'Ghost of Tsushima deve renderizar H1 esperado');
      assert(html.includes('Verificado'), 'Ghost of Tsushima deve renderizar status Verificado');
      assert(html.includes('DLC fora da platina base'), 'Ghost of Tsushima deve exibir DLC fora da platina base');
      assert(html.includes('Ghost of Tsushima é uma platina de mundo aberto acessível'), 'Ghost of Tsushima deve exibir resumo editorial novo');
      const ghostSummaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      assert((ghostSummaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de Ghost of Tsushima deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('A platina base é totalmente offline') && html.includes('Iki Island, Legends e New Game+ ficam fora da platina base.'), 'FAQ de Ghost of Tsushima deve ter respostas diretas');
      ['dados atuais do guia', 'o guia não aponta', 'Maté', 'Watér', 'Resgaté', 'Base game sem DLCs', '[object Object]', 'undefined'].forEach(text => {
        assert(!html.includes(text), `Ghost of Tsushima SSR nao deve exibir: ${text}`);
      });
      assert(!/>\s*null\s*</i.test(html), 'Ghost of Tsushima SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/ghost-of-tsushima', 'canonical de Ghost of Tsushima deve usar dominio de producao');
    }
    if (slug === 'hades-ii') {
      assert.strictEqual(apiGame.is_verified, true, 'API de Hades II deve continuar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Hades II deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 50, 'API de Hades II deve manter 50 trofeus');
      assert.strictEqual(apiGame.missable_count, 0, 'API de Hades II deve manter missable_count 0');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.is_missable).length, 0, 'API de Hades II deve manter Perdiveis 0 na checklist');
      assert.strictEqual(apiGame.dlcRequired || apiGame.dlc_required || false, false, 'API de Hades II deve manter DLC nao obrigatoria');
      const witch = apiGame.trophies.find(trophy => trophy.id === 'hades2_witch_of_the_clouds');
      assert(witch && !witch.is_missable, 'Witch of the Clouds nao deve vir como Perdivel na API');
      assert(html.includes('Hades II — Guia de platina e troféus'), 'Hades II deve renderizar H1 esperado');
      assert(html.includes('Verificado'), 'Hades II deve renderizar status Verificado');
      assert(html.includes('Sem perdíveis'), 'Hades II deve renderizar topo Sem perdiveis');
      assert(html.includes('DLC fora da platina base'), 'Hades II deve exibir DLC fora da platina base');
      assert(html.includes('Hades II é uma platina longa de roguelite'), 'Hades II deve exibir resumo editorial novo');
      const hades2SummaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      assert((hades2SummaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de Hades II deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('A lista base não tem perdíveis obrigatórios confirmados') && html.includes('A platina base é totalmente offline'), 'FAQ de Hades II deve ter respostas diretas');
      ['dados atuais do guia', 'o guia não aponta', 'segundo os dados atuais do guia', 'em revisão editorial', 'mantendo o guia em revisão', 'needs_', 'bugged_unlock', 'localization_check', 'manual_editorial_verification', 'Base game sem DLCs', '[object Object]', 'undefined'].forEach(text => {
        assert(!html.includes(text), `Hades II SSR nao deve exibir: ${text}`);
      });
      assert(!/Witch of the Clouds[\s\S]{0,500}Perdível/i.test(html), 'Witch of the Clouds nao deve aparecer como Perdivel no HTML');
      assert(!/>\s*null\s*</i.test(html), 'Hades II SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/hades-ii', 'canonical de Hades II deve usar dominio de producao');
    }
  });

  console.log(`test:guide passed (${slug})`);
}

async function validateSeo() {
  const sampleGames = loadSampleGames();
  const seoSlugs = sampleGames
    .filter(game => ['published', 'review'].includes(String(game.editorial_status || 'published')))
    .slice(0, 12)
    .map(game => game.slug);
  if (!seoSlugs.includes('resident-evil-requiem')) seoSlugs.push('resident-evil-requiem');

  await withTempApp(async ({ baseUrl }) => {
    const sitemap = await fetchText(`${baseUrl}/sitemap.xml`);
    assert(sitemap.startsWith('<?xml'), 'sitemap deve ser XML');
    assert(sitemap.includes('<urlset'), 'sitemap deve ter urlset');
    assert(sitemap.includes(`<loc>${baseUrl}/</loc>`), 'sitemap deve incluir home');
    assert(sitemap.includes(`<loc>${baseUrl}/catalogo</loc>`), 'sitemap deve incluir catalogo');

    for (const slug of seoSlugs) {
      const game = getGameBySlug(slug);
      assert(sitemap.includes(`<loc>${baseUrl}/jogo/${slug}</loc>`) || ['resident-evil-requiem'].includes(slug), `sitemap deve incluir ${slug}`);
      const html = await fetchText(`${baseUrl}/jogo/${slug}`, { headers: { accept: 'text/html' } });
      assertSeoHtml(html, { slug, name: game.name, baseUrl });
    }
  });

  console.log(`test:seo passed (${seoSlugs.length} paginas de jogo + sitemap)`);
}

async function main() {
  const mode = String(process.argv[2] || 'quick').trim().toLowerCase();
  if (mode === 'data') return validateData();
  if (mode === 'roadmap') return validateRoadmaps();
  if (mode === 'guide') return validateGuide(getSlugArg());
  if (mode === 'seo') return validateSeo();
  if (mode === 'quick') {
    const slug = getSlugArg();
    if (slug) return validateGuide(slug);
    validateData();
    validateRoadmaps();
    console.log('test:quick passed (data + roadmap)');
    return;
  }
  throw new Error(`Modo desconhecido: ${mode}`);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
