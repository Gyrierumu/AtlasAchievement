const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const vm = require('vm');

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

function readProjectFile(relPath = '') {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
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

function validateCacheStrategyStatic() {
  const appCode = readProjectFile('src/app.js');
  const indexHtml = readProjectFile('public/index.html');
  const versionCode = readProjectFile('public/js/app-version.js');

  assert(appCode.includes("NO_STORE_CACHE_CONTROL = 'no-cache, no-store, must-revalidate'"), 'HTML deve ter politica no-store declarada');
  assert(appCode.includes('setHtmlRouteCacheHeaders'), 'rotas HTML devem aplicar headers de cache fraco');
  assert(appCode.includes("app.get('/version'"), 'app deve expor endpoint publico de versao');
  assert(appCode.includes('setPublicStaticCacheHeaders'), 'assets estaticos devem passar por estrategia de cache dedicada');
  assert(appCode.includes('IMMUTABLE_CACHE_CONTROL'), 'assets com hash devem poder usar cache immutable');
  assert(appCode.includes("app.get(['/service-worker.js', '/sw.js']"), 'service workers antigos devem receber resposta neutralizadora sem cache');
  assert(indexHtml.includes('window.__APP_VERSION__=__ATLAS_APP_VERSION__;'), 'HTML deve expor versao publica do app');
  assert(indexHtml.includes('/js/app-version.js'), 'frontend deve carregar rotina de versao/cache tecnico');
  assert(versionCode.includes("atlasachievement_app_version"), 'rotina de versao deve usar chave tecnica propria');
  assert(versionCode.includes('unregisterServiceWorkers'), 'rotina de versao deve desregistrar service workers antigos');
  assert(versionCode.includes('clearTechnicalCaches'), 'rotina de versao deve limpar CacheStorage tecnico');
  assert(!/trophy_library_v2|user_trophy_progress|checklist/i.test(versionCode), 'rotina de versao nao deve apagar biblioteca, progresso ou checklist');

  const localStorageState = {
    atlasachievement_app_version: 'old',
    trophy_library_v2: JSON.stringify({ 'resident-evil-4-remake': { completed: ['re4r_promising_agent'] } }),
    checklist_density: 'comfortable'
  };
  const sessionStorageState = {};
  const deletedCaches = [];
  const context = {
    window: {
      __APP_VERSION__: 'new',
      location: { reload() {} },
      navigator: { serviceWorker: { controller: null, getRegistrations: async () => [] } },
      caches: {
        keys: async () => ['atlasachievement-runtime-v1'],
        delete: async cacheName => {
          deletedCaches.push(cacheName);
          return true;
        }
      },
      localStorage: {
        getItem(key) { return Object.prototype.hasOwnProperty.call(localStorageState, key) ? localStorageState[key] : null; },
        setItem(key, value) { localStorageState[key] = String(value); }
      },
      sessionStorage: {
        getItem(key) { return Object.prototype.hasOwnProperty.call(sessionStorageState, key) ? sessionStorageState[key] : null; },
        setItem(key, value) { sessionStorageState[key] = String(value); }
      }
    },
    console
  };
  context.window.window = context.window;
  context.globalThis = context.window;
  vm.createContext(context);
  vm.runInContext(versionCode, context, { filename: 'public/js/app-version.js' });

  assert.strictEqual(localStorageState.atlasachievement_app_version, 'new', 'versao salva deve ser atualizada');
  assert(localStorageState.trophy_library_v2.includes('re4r_promising_agent'), 'biblioteca/progresso local devem ser preservados');
  assert.strictEqual(localStorageState.checklist_density, 'comfortable', 'preferencia de checklist deve ser preservada');
  assert(deletedCaches.length <= 1, 'limpeza tecnica deve ser limitada a caches do app');

  console.log('test:cache passed (headers + app version static)');
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
    return await callback({ baseUrl, app, get, run, migrate });
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
  if (slug === 'astro-bot') {
    const astroText = visibleGameText(seedGame);
    const tagCount = tagId => seedGame.trophies.filter(trophy => guideModel.getGuideTrophyTags(trophy, seedGame).some(tag => tag.id === tagId)).length;
    assert.strictEqual(seedGame.is_verified, true, 'Astro Bot deve continuar verified no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'Astro Bot deve continuar com verification_status verified');
    assert.strictEqual(viewModel.trophies.length, 44, 'Astro Bot deve manter 44 trofeus');
    assert.strictEqual(viewModel.missableCount, 0, 'Astro Bot deve manter missableCount 0');
    assert.strictEqual(seedGame.trophies.filter(item => item.is_missable).length, 0, 'Astro Bot nao deve marcar trofeus como Perdiveis');
    assert.strictEqual(tagCount('grind'), 0, 'Astro Bot deve manter Grind 0');
    assert.strictEqual(tagCount('collectible'), 19, 'Astro Bot deve manter Coletaveis 19');
    assert.strictEqual(tagCount('difficulty'), 2, 'Astro Bot deve manter Dificuldade 2');
    assert.strictEqual(tagCount('cleanup'), 0, 'Astro Bot deve manter Cleanup 0');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Astro Bot deve manter roadmap com 6 etapas');
    assert.strictEqual(seedGame.dlcRequired || seedGame.dlc_required || false, false, 'Astro Bot deve manter DLC nao obrigatoria');
    ['dados atuais do guia', 'segundo os dados atuais do guia', 'o guia não aponta', 'Base game sem DLCs'].forEach(text => {
      assert(!astroText.includes(text), `Astro Bot nao deve conter texto publico incorreto: ${text}`);
    });
  }
  if (slug === 'pragmata') {
    const pragmataText = visibleGameText(seedGame);
    const realMissables = seedGame.trophies.filter(item => item.is_missable || item.isMissable);
    const itsOver6000 = seedGame.trophies.find(item => item.id === 'pragmata_its_over_6000');
    const youreNotGettingAway = seedGame.trophies.find(item => item.id === 'pragmata_youre_not_getting_away');
    const routeItems = viewModel.routeChangingTrophies || [];
    assert.strictEqual(seedGame.is_verified, true, 'PRAGMATA deve continuar verified no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'PRAGMATA deve continuar com verification_status verified');
    assert.strictEqual(viewModel.editorial.statusBadge.label, 'Verificado', 'PRAGMATA deve exibir selo Verificado');
    assert.strictEqual(viewModel.editorial.statusBadge.detail, 'Guia revisado editorialmente.', 'PRAGMATA deve exibir mensagem publica revisada');
    assert.strictEqual(viewModel.trophies.length, 36, 'PRAGMATA deve manter 36 trofeus');
    assert.strictEqual(viewModel.missableCount, realMissables.length, 'PRAGMATA deve alinhar missableCount com trofeus marcados');
    assert.strictEqual(viewModel.missableCount, 1, 'PRAGMATA deve manter 1 perdivel real no guia');
    assert.deepStrictEqual(realMissables.map(item => item.name), ["You're Not Getting Away That Easy"], 'PRAGMATA deve marcar apenas Youre Not Getting Away That Easy como perdivel');
    assert(itsOver6000 && !itsOver6000.is_missable && !itsOver6000.isMissable, "IT'S OVER 6000! nao deve ser perdivel definitivo");
    assert(youreNotGettingAway && (youreNotGettingAway.is_missable || youreNotGettingAway.isMissable), "You're Not Getting Away That Easy deve permanecer perdivel");
    assert.strictEqual(viewModel.guidanceCounts.criticalAlertsCount, viewModel.missableCount, 'PRAGMATA deve alinhar alertas criticos e perdiveis');
    assert(routeItems.some(item => item.id === 'pragmata_youre_not_getting_away' && /Perd/i.test(item.type)), 'Pontos de atencao de PRAGMATA devem incluir o perdivel confirmado');
    assert(routeItems.some(item => item.id === 'pragmata_its_over_6000' && /Situacional/i.test(item.type)), "IT'S OVER 6000! deve aparecer como situacional");
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'PRAGMATA deve manter roadmap com 6 etapas');
    assert.strictEqual(seedGame.dlcRequired || seedGame.dlc_required || false, false, 'PRAGMATA deve manter DLC nao obrigatoria');
    assert(pragmataText.includes('DLC fora da platina base'), 'PRAGMATA deve padronizar DLC fora da platina base');
    [
      'em revisão editorial',
      'sem confirmar',
      'confirmar que',
      'validação editorial',
      'segue em validação',
      'em validação',
      'potencialmente perdível',
      'se estiver validado',
      'se essa validação',
      'se essa informação',
      'mantendo PRAGMATA em revisão editorial',
      'dados atuais do guia',
      'lista atual',
      'o guia não aponta',
      'needs_patch_check',
      'needs_missables_validation',
      'needs_trophy_localization_check',
      'manual_editorial_verification',
      'pt_br_localization_check',
      'bugged_unlock',
      'Base game sem DLCs',
      'Descrição em revisão editorial.'
    ].forEach(text => {
      assert(!pragmataText.includes(text), `PRAGMATA nao deve conter texto publico/internal incorreto: ${text}`);
    });
  }
  if (slug === 'resident-evil-4-remake') {
    const re4Text = visibleGameText(seedGame);
    const realMissables = seedGame.trophies.filter(item => item.is_missable || item.isMissable);
    const removedMissableIds = [
      're4r_mission_accomplished',
      're4r_splus_investigator',
      're4r_sprinter',
      're4r_frugalist',
      're4r_minimalist',
      're4r_silent_stranger',
      're4r_real_deadeye',
      're4r_gun_fanatic',
      're4r_trick_shot'
    ];
    assert.strictEqual(seedGame.is_verified, true, 'Resident Evil 4 Remake deve continuar verified no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'Resident Evil 4 Remake deve continuar com verification_status verified');
    assert.strictEqual(viewModel.trophies.length, 40, 'Resident Evil 4 Remake deve manter 40 trofeus');
    assert.strictEqual(viewModel.missableCount, realMissables.length, 'Resident Evil 4 Remake deve alinhar missableCount com is_missable');
    assert.strictEqual(viewModel.missableCount, 16, 'Resident Evil 4 Remake deve reduzir perdiveis inflados para 16');
    assert(!realMissables.some(trophy => trophy.type === 'Platina'), 'Resident Evil 4 Remake nao deve contar platina como perdivel');
    removedMissableIds.forEach(id => {
      const trophy = seedGame.trophies.find(item => item.id === id);
      const tags = guideModel.getGuideTrophyTags(trophy, seedGame).map(tag => tag.label);
      assert(trophy && !trophy.is_missable && !trophy.isMissable && !tags.includes('Perdível'), `${id} nao deve ficar como Perdivel`);
    });
    assert.strictEqual(seedGame.onlineRequired || seedGame.online_required || false, false, 'Resident Evil 4 Remake deve manter online 0');
    assert.strictEqual(seedGame.coopRequired || seedGame.coop_required || false, false, 'Resident Evil 4 Remake deve manter coop 0');
    assert.strictEqual(seedGame.dlcRequired || seedGame.dlc_required || false, false, 'Resident Evil 4 Remake deve manter DLC nao obrigatoria');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Resident Evil 4 Remake deve manter roadmap com 6 etapas');
    assert(re4Text.includes('DLC fora da platina base'), 'Resident Evil 4 Remake deve padronizar DLC fora da platina base');
    ['dados atuais do guia', 'segundo os dados atuais do guia', 'o guia não aponta', 'Base game sem DLCs', 'Descrição em revisão editorial.', 'Resgaté', 'Maté', 'faças', 'estrategicos', 'Amatéur Shooter', '[object Object]', 'undefined'].forEach(text => {
      assert(!re4Text.includes(text), `Resident Evil 4 Remake nao deve conter texto incorreto: ${text}`);
    });
  }
  if (slug === 'nioh-2') {
    const nioh2Text = [
      visibleGameText(seedGame),
      JSON.stringify(seedGame.faq || []),
      JSON.stringify(viewModel.contextualFaq || []),
      JSON.stringify(viewModel.routeChangingTrophies || [])
    ].join(' ');
    const tagCount = tagId => seedGame.trophies.filter(trophy => guideModel.getGuideTrophyTags(trophy, seedGame).some(tag => tag.id === tagId)).length;
    const teamwork = seedGame.trophies.find(trophy => trophy.name === 'Teamwork' || trophy.name_pt === 'Trabalho em Equipe');
    const teamworkTags = guideModel.getGuideTrophyTags(teamwork, seedGame).map(tag => tag.id);
    assert.strictEqual(seedGame.is_verified, false, 'Nioh 2 nao deve ser promovido automaticamente para verified');
    assert.strictEqual(seedGame.verification_status, 'review', 'Nioh 2 deve preservar status editorial atual');
    assert.strictEqual(viewModel.trophies.length, 56, 'Nioh 2 deve manter 56 trofeus');
    assert.strictEqual(viewModel.missableCount, 0, 'Nioh 2 deve manter missableCount 0');
    assert.strictEqual(seedGame.trophies.filter(item => item.is_missable || item.isMissable).length, 0, 'Nioh 2 deve manter Perdiveis 0 na checklist');
    assert.strictEqual(Boolean(seedGame.onlineRequired || seedGame.online_required), false, 'Nioh 2 deve manter online 0');
    assert.strictEqual(Boolean(seedGame.coopRequired || seedGame.coop_required), false, 'Nioh 2 deve manter coop 0');
    assert.strictEqual(Boolean(seedGame.dlcRequired || seedGame.dlc_required), false, 'Nioh 2 deve manter DLC nao obrigatoria');
    assert.strictEqual(tagCount('grind'), 5, 'Nioh 2 deve manter Grind 5');
    assert.strictEqual(tagCount('collectible'), 17, 'Nioh 2 deve manter Coletaveis 17');
    assert.strictEqual(tagCount('difficulty'), 1, 'Nioh 2 deve manter Dificuldade 1');
    assert.strictEqual(tagCount('cleanup'), 2, 'Nioh 2 deve manter Cleanup 2');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Nioh 2 deve manter roadmap com 6 etapas');
    assert(seedGame.dlc_scope.includes('DLC fora da platina base'), 'Nioh 2 deve padronizar DLC fora da platina base no seed');
    assert(viewModel.contextualFaq.length >= 6, 'Nioh 2 deve manter FAQ com perguntas essenciais');
    assert(viewModel.routeChangingTrophies.length <= 5, 'Nioh 2 deve renderizar no maximo 5 pontos de atencao');
    ['nioh2_kodama_leader', 'nioh2_spa_lover', 'nioh2_soul_searcher', 'nioh2_sword_master', 'nioh2_dream_within_dream'].forEach(id => {
      assert(viewModel.routeChangingTrophies.some(item => item.id === id), `Nioh 2 deve incluir ponto de atencao ${id}`);
    });
    assert(teamwork && !teamworkTags.includes('online') && !teamworkTags.includes('coop'), 'Teamwork nao deve gerar online/coop obrigatorio');
    ['dados atuais do guia', 'segundo os dados atuais do guia', 'o guia não aponta', 'Este troféu está marcado como spoiler', 'Revele os detalhes na lista completa', 'Base game sem DLCs', 'Descrição em revisão editorial.', '[object Object]', 'undefined'].forEach(text => {
      assert(!nioh2Text.includes(text), `Nioh 2 nao deve conter texto publico/internal incorreto: ${text}`);
    });
  }
  if (slug === 'nioh-3') {
    const nioh3Text = [
      visibleGameText(seedGame),
      JSON.stringify(seedGame.faq || []),
      JSON.stringify(viewModel.contextualFaq || []),
      JSON.stringify(viewModel.routeChangingTrophies || [])
    ].join(' ');
    const tagCount = tagId => seedGame.trophies.filter(trophy => guideModel.getGuideTrophyTags(trophy, seedGame).some(tag => tag.id === tagId)).length;
    const trophyById = Object.fromEntries(seedGame.trophies.map(trophy => [trophy.id, trophy]));
    const teamwork = trophyById.nioh3_teamwork;
    const teamworkTags = guideModel.getGuideTrophyTags(teamwork, seedGame).map(tag => tag.id);
    assert.strictEqual(seedGame.is_verified, true, 'Nioh 3 deve continuar verified no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'Nioh 3 deve continuar com verification_status verified');
    assert.strictEqual(viewModel.editorial.statusBadge.label, 'Verificado', 'Nioh 3 deve exibir selo Verificado');
    assert.strictEqual(viewModel.editorial.statusBadge.detail, 'Guia revisado editorialmente.', 'Nioh 3 deve exibir mensagem revisada');
    assert.strictEqual(viewModel.trophies.length, 51, 'Nioh 3 deve manter 51 trofeus');
    assert.strictEqual(viewModel.missableCount, 0, 'Nioh 3 deve manter missableCount 0');
    assert.strictEqual(seedGame.trophies.filter(item => item.is_missable || item.isMissable).length, 0, 'Nioh 3 deve manter Perdiveis 0 na checklist');
    assert.strictEqual(Boolean(seedGame.onlineRequired || seedGame.online_required), false, 'Nioh 3 deve manter online 0');
    assert.strictEqual(Boolean(seedGame.coopRequired || seedGame.coop_required), false, 'Nioh 3 deve manter coop 0');
    assert.strictEqual(Boolean(seedGame.dlcRequired || seedGame.dlc_required), false, 'Nioh 3 deve manter DLC nao obrigatoria');
    assert.strictEqual(tagCount('grind'), 4, 'Nioh 3 deve manter Grind 4');
    assert.strictEqual(tagCount('collectible'), 21, 'Nioh 3 deve manter Coletaveis 21');
    assert.strictEqual(tagCount('difficulty'), 4, 'Nioh 3 deve manter Dificuldade 4');
    assert.strictEqual(tagCount('cleanup'), 4, 'Nioh 3 deve manter Cleanup 4');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Nioh 3 deve manter roadmap com 6 etapas');
    assert(seedGame.dlc_scope.includes('DLC fora da platina base'), 'Nioh 3 deve padronizar DLC fora da platina base no seed');
    assert(viewModel.routeChangingTrophies.length <= 5, 'Nioh 3 deve renderizar no maximo 5 pontos de atencao');
    ['nioh3_kodama_leader', 'nioh3_spa_lover', 'nioh3_answering_people', 'nioh3_arts_proficiency', 'nioh3_yokai_manipulator'].forEach(id => {
      assert(viewModel.routeChangingTrophies.some(item => item.id === id), `Nioh 3 deve incluir ponto de atencao ${id}`);
    });
    assert(teamwork && !teamworkTags.includes('online') && !teamworkTags.includes('coop'), 'Teamwork nao deve gerar online/coop obrigatorio');
    assert.strictEqual(trophyById.nioh3_wanderer_time?.name_pt, 'Errante do Tempo', 'Wanderer in Time deve continuar correto');
    assert.strictEqual(trophyById.nioh3_spa_healer?.descriptionPtBr, 'Você se banhou na fonte termal pela primeira vez.', 'Spa Healer deve continuar correto');
    assert.strictEqual(trophyById.nioh3_latest_masterpiece?.name, 'Latest Masterpiece', 'Latest Masterpiece deve continuar correto');
    [
      'dados atuais do guia',
      'segundo os dados atuais do guia',
      'o guia não aponta',
      'não deve exigir',
      'não deve ser marcado',
      'quando validado',
      'permanece em revisão editorial',
      'não está verificado',
      'aguardando revisão',
      'em revisão editorial',
      'antes de marcar o guia como verificado',
      'Finalize o checklist antes de marcar o guia como verificado',
      'Este troféu está marcado como spoiler',
      'Revele os detalhes na lista completa',
      'Base game sem DLCs',
      'Descrição em revisão editorial.',
      '[object Object]',
      'undefined'
    ].forEach(text => {
      assert(!nioh3Text.includes(text), `Nioh 3 nao deve conter texto publico/internal incorreto: ${text}`);
    });
  }
  if (slug === 'the-last-of-us-part-i') {
    const checklistText = seedGame.trophies
      .map(trophy => `${trophy.description || ''} ${trophy.descriptionPtBr || ''} ${trophy.ptDescription || ''} ${trophy.tip || ''}`)
      .join(' ');
    const faqText = JSON.stringify(viewModel.contextualFaq || []);
    const attentionText = JSON.stringify(viewModel.routeChangingTrophies || []);
    const tagCount = tagId => seedGame.trophies.filter(trophy => guideModel.getGuideTrophyTags(trophy, seedGame).some(tag => tag.id === tagId)).length;
    assert.strictEqual(seedGame.is_verified, true, 'The Last of Us Part I deve continuar Verificado');
    assert.strictEqual(seedGame.verification_status, 'verified', 'The Last of Us Part I deve preservar verification_status verified');
    assert.strictEqual(viewModel.editorial.statusBadge.label, 'Verificado', 'The Last of Us Part I deve exibir selo Verificado');
    assert.strictEqual(viewModel.editorial.statusBadge.detail, 'Guia revisado editorialmente.', 'The Last of Us Part I deve exibir mensagem revisada');
    assert.strictEqual(viewModel.trophies.length, 29, 'The Last of Us Part I deve manter 29 trofeus');
    assert.strictEqual(viewModel.missableCount, 0, 'The Last of Us Part I deve manter missableCount 0');
    assert.strictEqual(seedGame.trophies.filter(item => item.is_missable || item.isMissable).length, 0, 'The Last of Us Part I deve manter Perdiveis 0 na checklist');
    assert.strictEqual(Boolean(seedGame.onlineRequired || seedGame.online_required), false, 'The Last of Us Part I deve manter online 0');
    assert.strictEqual(Boolean(seedGame.coopRequired || seedGame.coop_required), false, 'The Last of Us Part I deve manter coop 0');
    assert.strictEqual(Boolean(seedGame.dlcRequired || seedGame.dlc_required), false, 'The Last of Us Part I deve manter DLC separada nao obrigatoria');
    assert.strictEqual(tagCount('grind'), 0, 'The Last of Us Part I deve manter Grind 0');
    assert.strictEqual(tagCount('collectible'), 14, 'The Last of Us Part I deve manter Coletaveis 14');
    assert.strictEqual(tagCount('difficulty'), 2, 'The Last of Us Part I deve manter Dificuldade 2');
    assert.strictEqual(tagCount('cleanup'), 1, 'The Last of Us Part I deve manter Cleanup 1');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'The Last of Us Part I deve manter roadmap com 6 etapas');
    assert(seedGame.dlc_scope.includes('Left Behind incluso na lista base'), 'The Last of Us Part I deve explicar Left Behind no escopo da lista base');
    assert(guideModel.buildGuideQuickDecisionModel(seedGame, viewModel).cards.some(card => card.value === 'Left Behind incluso na lista base'), 'The Last of Us Part I deve exibir Left Behind incluso na decisao rapida');
    assert(viewModel.contextualFaq.length >= 6, 'The Last of Us Part I deve manter FAQ com perguntas essenciais');
    assert(viewModel.routeChangingTrophies.length <= 5, 'The Last of Us Part I deve renderizar no maximo 5 pontos de atencao');
    ['tlou1_no_matter_what', 'tlou1_getting_to_know_you', 'tlou1_thats_all_i_got', 'tlou1_dont_go', 'tlou1_in_memorium'].forEach(id => {
      assert(viewModel.routeChangingTrophies.some(item => item.id === id), `The Last of Us Part I deve incluir ponto de atencao ${id}`);
    });
    [
      'dados atuais do guia',
      'segundo os dados atuais do guia',
      'o guia não aponta',
      'quando validado',
      'em revisão',
      'Este troféu está marcado como spoiler',
      'Revele os detalhes na lista completa',
      'Descrição em revisão editorial.',
      '[object Object]',
      'undefined'
    ].forEach(text => {
      assert(!faqText.includes(text), `FAQ de The Last of Us Part I nao deve conter texto fraco: ${text}`);
      assert(!attentionText.includes(text), `Pontos de atencao de The Last of Us Part I nao devem conter texto generico: ${text}`);
    });
    assert(!/\bdeve\b/i.test(faqText), 'FAQ de The Last of Us Part I nao deve usar linguagem insegura com "deve"');
    [
      'Collect all trophies',
      'Find all notes and artifacts',
      'Complete Left Behind',
      'Collect all comics',
      'Engage in all optional conversations',
      'Find all Firefly pendants',
      'Complete Part 1',
      'Survive all of Ellie',
      'Upgrade and then break one of every melee weapon',
      'Fully upgrade a weapon',
      'Break into every locked door using shivs',
      'Find all workbenches',
      'Find all workbench tools',
      'Find all training manuals',
      'Open All Safes',
      'Defeat Black Fang without getting hit',
      'Win the brick throwing contest',
      'Craft every item',
      'Pick up Frank',
      'Leave Ellie hanging after a job well done',
      'While in stealth, turn off the spotlight generator in Pittsburgh',
      'Use bricks or bottles to lure an infected into attacking a human',
      'Played the Jak X game in Left Behind',
      'Find a comic',
      'Find one training manual',
      'Win the water gun fight',
      'Ride the sewer contraption with Henry and Sam',
      'Pet Buckley the dog'
    ].forEach(text => {
      assert(!checklistText.includes(text), `Checklist de The Last of Us Part I nao deve exibir descricao em ingles: ${text}`);
    });
  }
  if (slug === 'the-last-of-us-part-ii') {
    const guideText = visibleGameText(seedGame);
    const faqText = JSON.stringify(viewModel.contextualFaq || []);
    const attentionText = JSON.stringify(viewModel.routeChangingTrophies || []);
    const tagCount = tagId => seedGame.trophies.filter(trophy => guideModel.getGuideTrophyTags(trophy, seedGame).some(tag => tag.id === tagId)).length;
    const quickDlc = guideModel.buildGuideQuickDecisionModel(seedGame, viewModel).cards.find(card => card.id === 'dlc');
    assert.strictEqual(seedGame.is_verified, true, 'The Last of Us Part II deve continuar Verificado');
    assert.strictEqual(seedGame.verification_status, 'verified', 'The Last of Us Part II deve preservar verification_status verified');
    assert.strictEqual(seedGame.verification_note, 'Guia revisado editorialmente.', 'The Last of Us Part II deve preservar mensagem revisada');
    assert.strictEqual(viewModel.editorial.statusBadge.label, 'Verificado', 'The Last of Us Part II deve exibir selo Verificado');
    assert.strictEqual(viewModel.editorial.statusBadge.detail, 'Guia revisado editorialmente.', 'The Last of Us Part II deve exibir mensagem revisada');
    assert.strictEqual(viewModel.trophies.length, 26, 'The Last of Us Part II deve manter 26 trofeus');
    assert.strictEqual(viewModel.missableCount, 0, 'The Last of Us Part II deve manter missableCount 0');
    assert.strictEqual(seedGame.trophies.filter(item => item.is_missable || item.isMissable).length, 0, 'The Last of Us Part II deve manter Perdiveis 0 na checklist');
    assert.strictEqual(Boolean(seedGame.onlineRequired || seedGame.online_required), false, 'The Last of Us Part II deve manter online 0');
    assert.strictEqual(Boolean(seedGame.coopRequired || seedGame.coop_required), false, 'The Last of Us Part II deve manter coop 0');
    assert.strictEqual(Boolean(seedGame.dlcRequired || seedGame.dlc_required), false, 'The Last of Us Part II deve manter DLC/extras nao obrigatorios');
    assert.strictEqual(tagCount('grind'), 1, 'The Last of Us Part II deve manter Grind 1');
    assert.strictEqual(tagCount('collectible'), 16, 'The Last of Us Part II deve manter Coletaveis 16');
    assert.strictEqual(tagCount('difficulty'), 6, 'The Last of Us Part II deve manter Dificuldade 6');
    assert.strictEqual(tagCount('cleanup'), 1, 'The Last of Us Part II deve manter Cleanup 1');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'The Last of Us Part II deve manter roadmap com 6 etapas');
    assert.strictEqual(quickDlc?.value, 'Extras fora da platina base', 'The Last of Us Part II deve exibir extras fora da platina base');
    assert(viewModel.contextualFaq.length >= 10, 'The Last of Us Part II deve manter FAQ completa');
    ['Grounded', 'Permadeath', 'No Return', 'Remastered'].forEach(text => {
      assert(guideText.includes(text), `The Last of Us Part II deve manter separacao de escopo para ${text}`);
    });
    ['tlou2_survival_expert', 'tlou2_arms_master', 'tlou2_sightseer', 'tlou2_high_caliber', 'tlou2_put_my_name_up'].forEach(id => {
      assert(viewModel.routeChangingTrophies.some(item => item.id === id), `The Last of Us Part II deve incluir ponto de atencao ${id}`);
    });
    [
      'dados atuais do guia',
      'segundo os dados atuais do guia',
      'o guia aponta',
      'o guia não aponta',
      'quando validado',
      'em revisão',
      'Este troféu está marcado como spoiler',
      'Revele os detalhes na lista completa',
      'Base game sem DLCs',
      'Descrição em revisão editorial.',
      '[object Object]',
      'undefined'
    ].forEach(text => {
      assert(!faqText.includes(text), `FAQ de The Last of Us Part II nao deve conter texto fraco: ${text}`);
      assert(!attentionText.includes(text), `Pontos de atencao de The Last of Us Part II nao devem conter texto generico: ${text}`);
      assert(!guideText.includes(text), `Seed de The Last of Us Part II nao deve conter texto publico/internal incorreto: ${text}`);
    });
  }

  await withTempApp(async ({ baseUrl, run, migrate }) => {
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
    if (slug === 'astro-bot') {
      assert.strictEqual(apiGame.is_verified, true, 'API de Astro Bot deve continuar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Astro Bot deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 44, 'API de Astro Bot deve manter 44 trofeus');
      assert.strictEqual(apiGame.missable_count, 0, 'API de Astro Bot deve manter missable_count 0');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.is_missable).length, 0, 'API de Astro Bot nao deve marcar trofeus como Perdiveis');
      assert.strictEqual(apiGame.dlcRequired || apiGame.dlc_required || false, false, 'API de Astro Bot deve manter DLC nao obrigatoria');
      assert(html.includes('Astro Bot — Guia de platina e troféus'), 'Astro Bot deve renderizar H1 esperado');
      assert(html.includes('Verificado'), 'Astro Bot deve renderizar status Verificado');
      assert(html.includes('DLC fora da platina base'), 'Astro Bot deve exibir DLC fora da platina base');
      assert(html.includes('Astro Bot é uma platina curta, acessível'), 'Astro Bot deve exibir resumo editorial novo');
      const astroSummaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      assert((astroSummaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de Astro Bot deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('A lista base de Astro Bot não tem troféus perdíveis') && html.includes('A platina base não exige online'), 'FAQ de Astro Bot deve ter respostas diretas');
      ['dados atuais do guia', 'o guia não aponta', 'segundo os dados atuais do guia', 'Base game sem DLCs', 'Descrição em revisão editorial.', '[object Object]', 'undefined'].forEach(text => {
        assert(!html.includes(text), `Astro Bot SSR nao deve exibir: ${text}`);
      });
      ['Deep-Pocket Dragon', 'Lost And Found', 'Monumental Achievement', 'SingStars', 'The Golden Bot'].forEach(name => {
        assert(html.includes(name), `Astro Bot deve manter ponto de atencao ${name}`);
      });
      assert(html.includes('Relacionado a uma interação específica no Crash Site'), 'Deep-Pocket Dragon deve ter orientacao especifica');
      assert(html.includes('Depende de encontrar e concluir fases da Lost Galaxy'), 'Lost And Found deve ter orientacao especifica');
      assert(!/>\s*null\s*</i.test(html), 'Astro Bot SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/astro-bot', 'canonical de Astro Bot deve usar dominio de producao');
    }
    if (slug === 'nioh-2') {
      const summaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable);
      const apiTeamwork = apiGame.trophies.find(trophy => trophy.name === 'Teamwork' || trophy.name_pt === 'Trabalho em Equipe');
      const normalizedHtml = normalizeText(html);
      assert.strictEqual(apiGame.is_verified, false, 'API de Nioh 2 deve preservar status sem verified automatico');
      assert.strictEqual(apiGame.verification_status, 'review', 'API de Nioh 2 deve preservar verification_status review');
      assert.strictEqual(apiGame.trophies.length, 56, 'API de Nioh 2 deve manter 56 trofeus');
      assert.strictEqual(apiGame.missable_count, 0, 'API de Nioh 2 deve manter missable_count 0');
      assert.strictEqual(apiMissables.length, 0, 'API de Nioh 2 deve manter Perdiveis 0 na checklist');
      assert.strictEqual(Boolean(apiGame.onlineRequired || apiGame.online_required), false, 'API de Nioh 2 deve manter online 0');
      assert.strictEqual(Boolean(apiGame.coopRequired || apiGame.coop_required), false, 'API de Nioh 2 deve manter coop 0');
      assert.strictEqual(Boolean(apiGame.dlcRequired || apiGame.dlc_required), false, 'API de Nioh 2 deve manter DLC nao obrigatoria');
      assert(apiTeamwork && !apiTeamwork.is_online && !apiTeamwork.isOnline && !apiTeamwork.is_coop && !apiTeamwork.isCoop, 'Teamwork nao deve virar trofeu online/coop obrigatorio na API');
      assert(html.includes('Nioh 2'), 'Nioh 2 deve renderizar nome no SSR');
      assert(html.includes('DLC fora da platina base'), 'Nioh 2 deve exibir DLC fora da platina base');
      assert(normalizedHtml.includes('nioh 2 e uma platina de progressao longa'), 'Nioh 2 deve exibir resumo editorial forte');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de Nioh 2 deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('A platina base não tem perdíveis definitivos') || html.includes('A platina base nÃ£o tem perdÃ­veis definitivos'), 'FAQ de Nioh 2 deve ter resposta direta sobre perdiveis');
      assert(html.includes('A platina base pode ser feita offline') || html.includes('A platina base pode ser feita offline'), 'FAQ de Nioh 2 deve ter resposta direta sobre online');
      assert(html.includes('Hot Springs ficam espalhadas pelas missões') || html.includes('Hot Springs ficam espalhadas pelas missÃµes'), 'Pontos de atencao de Nioh 2 devem substituir texto generico por alerta util');
      assert(html.includes('Kodama Leader') && html.includes('Spa Lover') && html.includes('Soul Searcher') && html.includes('Sword Master') && html.includes('Dream Within a Dream'), 'Nioh 2 deve renderizar pontos de atencao editoriais esperados');
      ['dados atuais do guia', 'segundo os dados atuais do guia', 'o guia não aponta', 'Este troféu está marcado como spoiler', 'Revele os detalhes na lista completa', 'Base game sem DLCs', 'Descrição em revisão editorial.', '[object Object]', 'undefined'].forEach(text => {
        assert(!html.includes(text), `Nioh 2 SSR nao deve exibir: ${text}`);
      });
      assert(!/>\s*null\s*</i.test(html), 'Nioh 2 SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/nioh-2', 'canonical de Nioh 2 deve usar dominio de producao');
    }
    if (slug === 'nioh-3') {
      const summaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable);
      const apiTeamwork = apiGame.trophies.find(trophy => trophy.name === 'Teamwork' || trophy.name_pt === 'Trabalho em Equipe');
      const apiTrophyById = Object.fromEntries(apiGame.trophies.map(trophy => [trophy.id, trophy]));
      const normalizedHtml = normalizeText(html);
      assert.strictEqual(apiGame.is_verified, true, 'API de Nioh 3 deve continuar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Nioh 3 deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 51, 'API de Nioh 3 deve manter 51 trofeus');
      assert.strictEqual(apiGame.missable_count, 0, 'API de Nioh 3 deve manter missable_count 0');
      assert.strictEqual(apiMissables.length, 0, 'API de Nioh 3 deve manter Perdiveis 0 na checklist');
      assert.strictEqual(Boolean(apiGame.onlineRequired || apiGame.online_required), false, 'API de Nioh 3 deve manter online 0');
      assert.strictEqual(Boolean(apiGame.coopRequired || apiGame.coop_required), false, 'API de Nioh 3 deve manter coop 0');
      assert.strictEqual(Boolean(apiGame.dlcRequired || apiGame.dlc_required), false, 'API de Nioh 3 deve manter DLC nao obrigatoria');
      assert(apiTeamwork && !apiTeamwork.is_online && !apiTeamwork.isOnline && !apiTeamwork.is_coop && !apiTeamwork.isCoop, 'Teamwork nao deve virar trofeu online/coop obrigatorio na API');
      assert.strictEqual(apiTrophyById.nioh3_wanderer_time?.name_pt, 'Errante do Tempo', 'Wanderer in Time deve continuar correto na API');
      assert.strictEqual(apiTrophyById.nioh3_spa_healer?.description, 'Você se banhou na fonte termal pela primeira vez.', 'Spa Healer deve continuar correto na API');
      assert.strictEqual(apiTrophyById.nioh3_latest_masterpiece?.name, 'Latest Masterpiece', 'Latest Masterpiece deve continuar correto na API');
      assert(html.includes('Nioh 3'), 'Nioh 3 deve renderizar nome no SSR');
      assert(html.includes('Verificado'), 'Nioh 3 deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'Nioh 3 deve renderizar mensagem revisada');
      assert(html.includes('DLC fora da platina base'), 'Nioh 3 deve exibir DLC fora da platina base');
      assert(normalizedHtml.includes('nioh 3 e uma platina longa e tecnica'), 'Nioh 3 deve exibir resumo editorial forte');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de Nioh 3 deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('A platina base pode ser feita sem troféus online obrigatórios') || html.includes('A platina base pode ser feita sem trofÃ©us online obrigatÃ³rios'), 'FAQ de Nioh 3 deve ter resposta direta sobre online');
      assert(html.includes('Sim. Este guia está Verificado') || html.includes('Sim. Este guia estÃ¡ Verificado'), 'FAQ de Nioh 3 deve concordar com status Verificado');
      assert(html.includes('Kodama Leader') && html.includes('Spa Lover') && html.includes('Answering to the People') && html.includes('Arts Proficiency') && html.includes('Yokai Manipulator'), 'Nioh 3 deve renderizar pontos de atencao editoriais esperados');
      [
        'dados atuais do guia',
        'segundo os dados atuais do guia',
        'o guia não aponta',
        'não deve exigir',
        'não deve ser marcado',
        'quando validado',
        'permanece em revisão editorial',
        'não está verificado',
        'aguardando revisão',
        'em revisão editorial',
        'antes de marcar o guia como verificado',
        'Finalize o checklist antes de marcar o guia como verificado',
        'Este troféu está marcado como spoiler',
        'Revele os detalhes na lista completa',
        'Base game sem DLCs',
        'Descrição em revisão editorial.',
        '[object Object]',
        'undefined'
      ].forEach(text => {
        assert(!html.includes(text), `Nioh 3 SSR nao deve exibir: ${text}`);
      });
      assert(!/>\s*null\s*</i.test(html), 'Nioh 3 SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/nioh-3', 'canonical de Nioh 3 deve usar dominio de producao');
    }
    if (slug === 'the-last-of-us-part-i') {
      const summaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable);
      const normalizedHtml = normalizeText(html);
      assert.strictEqual(apiGame.is_verified, true, 'API de The Last of Us Part I deve continuar Verificado');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de The Last of Us Part I deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 29, 'API de The Last of Us Part I deve manter 29 trofeus');
      assert.strictEqual(apiGame.missable_count, 0, 'API de The Last of Us Part I deve manter missable_count 0');
      assert.strictEqual(apiMissables.length, 0, 'API de The Last of Us Part I deve manter Perdiveis 0 na checklist');
      assert.strictEqual(Boolean(apiGame.onlineRequired || apiGame.online_required), false, 'API de The Last of Us Part I deve manter online 0');
      assert.strictEqual(Boolean(apiGame.coopRequired || apiGame.coop_required), false, 'API de The Last of Us Part I deve manter coop 0');
      assert.strictEqual(Boolean(apiGame.dlcRequired || apiGame.dlc_required), false, 'API de The Last of Us Part I deve manter DLC separada nao obrigatoria');
      assert(html.includes('The Last of Us Part I'), 'The Last of Us Part I deve renderizar nome no SSR');
      assert(html.includes('The Last of Us Part I — Guia de platina e troféus') || html.includes('The Last of Us Part I â€” Guia de platina e trofÃ©us'), 'The Last of Us Part I deve preservar H1 esperado');
      assert(html.includes('Verificado'), 'The Last of Us Part I deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'The Last of Us Part I deve renderizar mensagem revisada');
      assert(html.includes('Left Behind incluso na lista base'), 'The Last of Us Part I deve exibir Left Behind incluso na lista base');
      assert(normalizedHtml.includes('the last of us part i tem uma platina concentrada'), 'The Last of Us Part I deve exibir resumo editorial forte');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de The Last of Us Part I deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('A lista permite cleanup por Chapter Select'), 'FAQ de The Last of Us Part I deve ter resposta direta sobre perdiveis');
      assert(html.includes('não exige multiplayer') || html.includes('nÃ£o exige multiplayer'), 'FAQ de The Last of Us Part I deve deixar multiplayer/Factions fora da obrigacao');
      assert(html.includes('No Matter What') && html.includes('Getting to Know You') && html.includes("That's All I Got") && html.includes("Don't Go") && html.includes('In Memoriam'), 'The Last of Us Part I deve renderizar pontos de atencao editoriais esperados');
      [
        'dados atuais do guia',
        'segundo os dados atuais do guia',
        'o guia não aponta',
        'Este troféu está marcado como spoiler',
        'Revele os detalhes na lista completa',
        'Collect all trophies',
        'Find all notes and artifacts',
        'Complete Left Behind',
        'Collect all comics',
        'Engage in all optional conversations',
        'Find all Firefly pendants',
        'Complete Part 1',
        'Survive all of Ellie',
        'Upgrade and then break one of every melee weapon',
        'Fully upgrade a weapon',
        'Break into every locked door using shivs',
        'Find all workbenches',
        'Find all workbench tools',
        'Find all training manuals',
        'Open All Safes',
        'Defeat Black Fang without getting hit',
        'Win the brick throwing contest',
        'Craft every item',
        'Pick up Frank',
        'Leave Ellie hanging after a job well done',
        'While in stealth, turn off the spotlight generator in Pittsburgh',
        'Use bricks or bottles to lure an infected into attacking a human',
        'Played the Jak X game in Left Behind',
        'Find a comic',
        'Find one training manual',
        'Win the water gun fight',
        'Ride the sewer contraption with Henry and Sam',
        'Pet Buckley the dog',
        'Descrição em revisão editorial.',
        '[object Object]',
        'undefined'
      ].forEach(text => {
        assert(!html.includes(text), `The Last of Us Part I SSR nao deve exibir: ${text}`);
      });
      assert(!/>\s*null\s*</i.test(html), 'The Last of Us Part I SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/the-last-of-us-part-i', 'canonical de The Last of Us Part I deve usar dominio de producao');
    }
    if (slug === 'the-last-of-us-part-ii') {
      const summaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable);
      const normalizedHtml = normalizeText(html);
      const apiTrophyText = apiGame.trophies.map(trophy => `${trophy.name} ${trophy.trophyNamePtBr || ''} ${trophy.description || ''} ${trophy.descriptionPtBr || ''} ${trophy.tip || ''}`).join(' ');
      assert.strictEqual(apiGame.is_verified, true, 'API de The Last of Us Part II deve continuar Verificado');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de The Last of Us Part II deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 26, 'API de The Last of Us Part II deve manter 26 trofeus');
      assert.strictEqual(apiGame.missable_count, 0, 'API de The Last of Us Part II deve manter missable_count 0');
      assert.strictEqual(apiMissables.length, 0, 'API de The Last of Us Part II deve manter Perdiveis 0 na checklist');
      assert.strictEqual(Boolean(apiGame.onlineRequired || apiGame.online_required), false, 'API de The Last of Us Part II deve manter online 0');
      assert.strictEqual(Boolean(apiGame.coopRequired || apiGame.coop_required), false, 'API de The Last of Us Part II deve manter coop 0');
      assert.strictEqual(Boolean(apiGame.dlcRequired || apiGame.dlc_required), false, 'API de The Last of Us Part II deve manter extras nao obrigatorios');
      assert(html.includes('The Last of Us Part II'), 'The Last of Us Part II deve renderizar nome no SSR');
      assert(normalizedHtml.includes('the last of us part ii') && normalizedHtml.includes('guia de platina e trofeus'), 'The Last of Us Part II deve preservar H1 esperado');
      assert(html.includes('Verificado'), 'The Last of Us Part II deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'The Last of Us Part II deve renderizar mensagem revisada');
      assert(html.includes('Extras fora da platina base'), 'The Last of Us Part II deve exibir extras fora da platina base');
      assert(normalizedHtml.includes('the last of us part ii tem uma platina concentrada'), 'The Last of Us Part II deve exibir resumo editorial forte');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de The Last of Us Part II deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('Grounded') && html.includes('Permadeath') && html.includes('No Return') && html.includes('Remastered'), 'The Last of Us Part II deve separar extras do escopo base');
      assert(html.includes('Survival Expert') && html.includes('Arms Master') && html.includes('Sightseer') && html.includes('High Caliber') && html.includes('Put My Name Up'), 'The Last of Us Part II deve renderizar pontos de atencao editoriais esperados');
      [
        'dados atuais do guia',
        'segundo os dados atuais do guia',
        'o guia aponta',
        'o guia não aponta',
        'Este troféu está marcado como spoiler',
        'Revele os detalhes na lista completa',
        'Base game sem DLCs',
        'Descrição em revisão editorial.',
        '[object Object]',
        'undefined'
      ].forEach(text => {
        assert(!html.includes(text), `The Last of Us Part II SSR nao deve exibir: ${text}`);
      });
      assert(!/Complete the story|Find all|Unlock every|Craft every item|Upgrade a weapon|Learn a player upgrade|Earn the high score/i.test(apiTrophyText), 'The Last of Us Part II deve manter descricoes publicas em portugues');
      assert(normalizedHtml.includes('nao exige online') || normalizedHtml.includes('nao exige servidores, multiplayer, factions'), 'The Last of Us Part II deve deixar Factions/multiplayer fora da obrigacao');
      assert(!/>\s*null\s*</i.test(html), 'The Last of Us Part II SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/the-last-of-us-part-ii', 'canonical de The Last of Us Part II deve usar dominio de producao');
    }
    if (slug === 'pragmata') {
      const normalizedHtml = normalizeText(html);
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable);
      assert.strictEqual(apiGame.is_verified, true, 'API de PRAGMATA deve continuar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de PRAGMATA deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 36, 'API de PRAGMATA deve manter 36 trofeus');
      assert.strictEqual(apiGame.missable_count, apiMissables.length, 'API de PRAGMATA deve alinhar missable_count com checklist');
      assert.strictEqual(apiGame.missable_count, 1, 'API de PRAGMATA deve manter 1 perdivel');
      assert.deepStrictEqual(apiMissables.map(trophy => trophy.name), ["You're Not Getting Away That Easy"], 'API de PRAGMATA deve marcar o perdivel esperado');
      assert.strictEqual(apiGame.onlineRequired || apiGame.online_required || false, false, 'API de PRAGMATA deve manter online 0');
      assert.strictEqual(apiGame.coopRequired || apiGame.coop_required || false, false, 'API de PRAGMATA deve manter coop 0');
      assert.strictEqual(apiGame.dlcRequired || apiGame.dlc_required || false, false, 'API de PRAGMATA deve manter DLC nao obrigatoria');
      assert(html.includes('PRAGMATA'), 'PRAGMATA deve renderizar nome no SSR');
      assert(html.includes('Verificado'), 'PRAGMATA deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'PRAGMATA deve renderizar mensagem publica revisada');
      assert(html.includes('Tem perd'), 'PRAGMATA deve renderizar topo com perdivel');
      assert(html.includes('DLC fora da platina base'), 'PRAGMATA deve exibir DLC fora da platina base');
      assert(normalizedHtml.includes('pragmata e uma platina sci-fi single-player'), 'PRAGMATA deve exibir resumo editorial novo');
      const summaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      assert((summaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de PRAGMATA deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes("You're Not Getting Away That Easy") && html.includes('IT&#39;S OVER 6000!'), 'PRAGMATA deve renderizar pontos/trofeus principais');
      assert(html.includes('O guia trata 1 trof') && html.includes("You're Not Getting Away That Easy"), 'FAQ de PRAGMATA deve concordar com 1 perdivel');
      assert(html.includes('Combate / Situacional'), "IT'S OVER 6000! deve aparecer como ponto situacional, nao como perdivel");
      [
        'em revisão editorial',
        'sem confirmar',
        'confirmar que',
        'validação editorial',
        'segue em validação',
        'em validação',
        'potencialmente perdível',
        'se estiver validado',
        'se essa validação',
        'se essa informação',
        'mantendo PRAGMATA em revisão editorial',
        'dados atuais do guia',
        'lista atual',
        'o guia não aponta',
        'needs_patch_check',
        'needs_missables_validation',
        'needs_trophy_localization_check',
        'manual_editorial_verification',
        'pt_br_localization_check',
        'bugged_unlock',
        'Base game sem DLCs',
        'Descrição em revisão editorial.',
        '[object Object]',
        'undefined'
      ].forEach(text => {
        assert(!html.includes(text), `PRAGMATA SSR nao deve exibir: ${text}`);
      });
      assert(!/>\s*null\s*</i.test(html), 'PRAGMATA SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/pragmata', 'canonical de PRAGMATA deve usar dominio de producao');
    }
    if (slug === 'resident-evil-4-remake') {
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable);
      const summaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      assert.strictEqual(apiGame.is_verified, true, 'API de Resident Evil 4 Remake deve continuar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Resident Evil 4 Remake deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 40, 'API de Resident Evil 4 Remake deve manter 40 trofeus');
      assert.strictEqual(apiGame.missable_count, apiMissables.length, 'API de Resident Evil 4 Remake deve alinhar missable_count com checklist');
      assert.strictEqual(apiGame.missable_count, 16, 'API de Resident Evil 4 Remake deve reduzir perdiveis inflados para 16');
      assert(!apiMissables.some(trophy => trophy.type === 'Platina'), 'API de Resident Evil 4 Remake nao deve contar platina como perdivel');
      ['re4r_mission_accomplished', 're4r_splus_investigator', 're4r_frugalist', 're4r_minimalist', 're4r_silent_stranger', 're4r_sprinter', 're4r_real_deadeye', 're4r_gun_fanatic', 're4r_trick_shot'].forEach(id => {
        const trophy = apiGame.trophies.find(item => item.id === id);
        assert(trophy && !trophy.is_missable, `${id} nao deve ficar como Perdivel na API`);
      });
      const smoothEscape = apiGame.trophies.find(item => item.id === 're4r_smooth_escape');
      assert.strictEqual(smoothEscape?.description, 'Fuja na moto aqu\u00e1tica sem sofrer dano.', 'Smooth Escape deve ter descricao corrigida na checklist da API');
      assert.strictEqual(smoothEscape?.tip, 'Fa\u00e7a save antes da sequ\u00eancia final e repita o trecho se bater em obst\u00e1culos ou sofrer dano.', 'Smooth Escape deve ter dica corrigida na checklist da API');
      const re4ApiText = apiGame.trophies.map(trophy => `${trophy.name} ${trophy.name_pt} ${trophy.description} ${trophy.tip}`).join(' ');
      ['Descri\u00e7\u00e3o em revis\u00e3o editorial.', 'Resgat\u00e9', 'Mat\u00e9', 'fa\u00e7as', 'estrategia', 'estrategicos', 'Amat\u00e9ur Shooter', 'Apare um inimigo com a fa\u00e7a.'].forEach(text => {
        assert(!re4ApiText.includes(text), `Checklist da API de Resident Evil 4 Remake nao deve conter: ${text}`);
      });
      assert.strictEqual(Boolean(apiGame.onlineRequired || apiGame.online_required), false, 'API de Resident Evil 4 Remake deve manter online 0');
      assert.strictEqual(Boolean(apiGame.coopRequired || apiGame.coop_required), false, 'API de Resident Evil 4 Remake deve manter coop 0');
      assert.strictEqual(Boolean(apiGame.dlcRequired || apiGame.dlc_required), false, 'API de Resident Evil 4 Remake deve manter DLC nao obrigatoria');
      assert(html.includes('Resident Evil 4 Remake — Guia de platina e troféus'), 'Resident Evil 4 Remake deve renderizar H1 esperado');
      assert(html.includes('Verificado'), 'Resident Evil 4 Remake deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'Resident Evil 4 Remake deve renderizar mensagem revisada');
      assert(html.includes('DLC fora da platina base'), 'Resident Evil 4 Remake deve exibir DLC fora da platina base');
      assert(html.includes('Resident Evil 4 Remake é uma platina baseada em múltiplas campanhas'), 'Resident Evil 4 Remake deve exibir resumo editorial forte');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de Resident Evil 4 Remake deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('A platina base é totalmente offline') && html.includes('Separate Ways, VR Mode, The Mercenaries, tickets pagos'), 'FAQ de Resident Evil 4 Remake deve ter respostas diretas');
      assert(html.includes('Dificuldade / Rank / Risco de run') && html.includes('Coletável / Risco de run / Cleanup'), 'Pontos de atencao de Resident Evil 4 Remake devem reclassificar rank e Gun Fanatic');
      ['dados atuais do guia', 'segundo os dados atuais do guia', 'o guia não aponta', 'Base game sem DLCs', 'Descrição em revisão editorial.', 'Resgaté', 'Maté', 'faças', 'Amatéur Shooter', '[object Object]', 'undefined'].forEach(text => {
        assert(!html.includes(text), `Resident Evil 4 Remake SSR nao deve exibir: ${text}`);
      });
      assert(!/>\s*null\s*</i.test(html), 'Resident Evil 4 Remake SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/resident-evil-4-remake', 'canonical de Resident Evil 4 Remake deve usar dominio de producao');

      const staleMissableIds = [
        're4r_mission_accomplished',
        're4r_splus_investigator',
        're4r_frugalist',
        're4r_minimalist',
        're4r_silent_stranger',
        're4r_sprinter',
        're4r_real_deadeye',
        're4r_gun_fanatic',
        're4r_trick_shot'
      ];
      const stalePlaceholders = staleMissableIds.map(() => '?').join(', ');
      await run(
        `UPDATE trophies
            SET is_missable = 1
          WHERE game_id = (SELECT id FROM games WHERE slug = 'resident-evil-4-remake')
            AND trophy_code IN (${stalePlaceholders})`,
        staleMissableIds
      );
      await run(
        `UPDATE trophies
            SET description = 'Descri\u00e7\u00e3o em revis\u00e3o editorial.',
                tip = 'Memorize a rota final e reduza erros nas curvas apertadas.'
          WHERE game_id = (SELECT id FROM games WHERE slug = 'resident-evil-4-remake')
            AND trophy_code = 're4r_smooth_escape'`
      );
      await run(
        `UPDATE trophies
            SET description = 'Apare um inimigo com a fa\u00e7a.'
          WHERE game_id = (SELECT id FROM games WHERE slug = 'resident-evil-4-remake')
            AND trophy_code = 're4r_knife_basics'`
      );
      await run(
        `UPDATE trophies
            SET description = 'Resgat\u00e9 Ashley enquanto ela est\u00e1 sendo carregada por um inimigo.'
          WHERE game_id = (SELECT id FROM games WHERE slug = 'resident-evil-4-remake')
            AND trophy_code = 're4r_near_death'`
      );
      await run(
        `UPDATE trophies
            SET description = 'Mat\u00e9 2 parasitas dentro de um Regenerador com uma \u00fanica bala.'
          WHERE game_id = (SELECT id FROM games WHERE slug = 'resident-evil-4-remake')
            AND trophy_code = 're4r_two_bugs'`
      );

      await migrate();
      const repairedGame = await fetchJson(`${baseUrl}/api/games/slug/${slug}`);
      const repairedMissables = repairedGame.trophies.filter(trophy => trophy.is_missable);
      assert.strictEqual(repairedGame.trophies.length, 40, 'Migracao deve manter 40 trofeus de Resident Evil 4 Remake');
      assert.strictEqual(repairedGame.missable_count, 16, 'Migracao deve reparar Perdiveis 25 para 16');
      assert.strictEqual(repairedGame.missable_count, repairedMissables.length, 'Migracao deve alinhar contagem com flags reais');
      staleMissableIds.forEach(id => {
        const trophy = repairedGame.trophies.find(item => item.id === id);
        assert(trophy && !trophy.is_missable, `${id} deve ser reparado pela migracao da checklist`);
      });
      const repairedSmoothEscape = repairedGame.trophies.find(item => item.id === 're4r_smooth_escape');
      assert.strictEqual(repairedSmoothEscape?.description, 'Fuja na moto aqu\u00e1tica sem sofrer dano.', 'Migracao deve reparar descricao de Smooth Escape');
      assert.strictEqual(repairedSmoothEscape?.tip, 'Fa\u00e7a save antes da sequ\u00eancia final e repita o trecho se bater em obst\u00e1culos ou sofrer dano.', 'Migracao deve reparar dica de Smooth Escape');
      const repairedText = repairedGame.trophies.map(trophy => `${trophy.name} ${trophy.name_pt} ${trophy.description} ${trophy.tip}`).join(' ');
      ['Descri\u00e7\u00e3o em revis\u00e3o editorial.', 'Resgat\u00e9', 'Mat\u00e9', 'fa\u00e7as', 'estrategia', 'estrategicos', 'Amat\u00e9ur Shooter', 'Apare um inimigo com a fa\u00e7a.'].forEach(text => {
        assert(!repairedText.includes(text), `Migracao da checklist nao deve deixar texto antigo: ${text}`);
      });
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
    validateCacheStrategyStatic();
    console.log('test:quick passed (data + roadmap + cache)');
    return;
  }
  throw new Error(`Modo desconhecido: ${mode}`);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
