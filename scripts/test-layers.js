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

function loadCatalogModel() {
  return require(path.join(ROOT, 'src/shared/catalogModel'));
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
  const cardModel = require(path.join(ROOT, 'src/shared/cardModel'));
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

    if (game.commonMythsGuide) {
      const myths = Array.isArray(game.commonMythsGuide.myths) ? game.commonMythsGuide.myths : [];
      assert(myths.length > 0, `${game.slug} deve ter mitos cadastrados quando commonMythsGuide existir`);
      myths.forEach((item, index) => {
        assert(item.myth && item.correction && item.where, `${game.slug} mito ${index + 1} deve ter Mito, Correcao e Onde conferir`);
      });
    }

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

  const residentEvilGuide = sampleGames.find(game => game.slug === 'resident-evil');
  const residentEvil2Guide = sampleGames.find(game => game.slug === 'resident-evil-2-remake');
  assert.strictEqual(residentEvil2Guide.commonMythsGuide?.myths?.length, 9, 'Resident Evil 2 Remake deve manter exatamente 9 mitos');
  assert.strictEqual(residentEvil2Guide.commonMythsGuide?.anchorId, 'mitos-e-erros-comuns', 'Resident Evil 2 Remake deve manter anchor local de Mitos e erros comuns');
  assert.deepStrictEqual(
    residentEvil2Guide.commonMythsGuide.myths.map(item => item.category),
    ['Platina x 100%', 'Campanhas', 'Coletáveis', 'Rank', 'Armas infinitas', 'Modos extras', 'Nomes parecidos', 'The Ghost Survivors', 'Another Survivor'],
    'Resident Evil 2 Remake deve manter as nove categorias na ordem editorial'
  );
  const residentEvil2MythsText = residentEvil2Guide.commonMythsGuide.myths.map(item => `${item.myth} ${item.correction}`).join(' ');
  ['42 troféus da lista base', 'final verdadeiro e Broken Umbrella', 'quatro combinações da rota', 'S+, limite de três saves', 'Item Box para pegar uma arma pode invalidar Minimalist', 'Tofu Survivor é opcional', 'Gotcha! pertence à campanha base', 'fora do Training Mode', 'campanha normal de Leon'].forEach(text => {
    assert(residentEvil2MythsText.includes(text), `Resident Evil 2 Remake deve preservar a correcao de mito: ${text}`);
  });
  const residentEvil2MythDestinations = residentEvil2Guide.commonMythsGuide.myths.slice(3, 6).map(item => item.where);
  assert.deepStrictEqual(
    residentEvil2MythDestinations.map(destinations => destinations.map(destination => destination.label)),
    [
      ['Hardcore, S rank e armas infinitas', 'Plano rápido — Runs 3 e 4', 'Checklist — Leon “S.” Kennedy e Sizzling Scarlet Hero'],
      ['Hardcore, S rank e armas infinitas', 'Runs de restrição — Minimalist', 'Plano rápido — Runs 3 a 7'],
      ['The 4th Survivor — Grim Reaper', 'DLCs e 100% da Lista', 'FAQ — The 4th Survivor e Tofu Survivor']
    ],
    'Resident Evil 2 Remake deve usar apenas nomes reais em Onde conferir dos mitos 4, 5 e 6'
  );
  assert(residentEvil2MythDestinations.every(destinations => !destinations[0].href), 'Subsecoes sem anchor confiavel devem permanecer como texto em Onde conferir');
  assert(!residentEvil2MythDestinations[1][1].href, 'Runs de restricao — Minimalist deve permanecer como texto sem inventar anchor');
  const residentEvil2RankChapter = residentEvil2Guide.chapterRouteGuide.chapters.find(chapter => chapter.chapter === 'Hardcore, S rank e armas infinitas');
  assert(!residentEvil2RankChapter.sections.some(section => section.title === 'S rank sem confundir com S+'), 'Resident Evil 2 Remake deve centralizar a duvida conceitual no Mito 4');
  assert.strictEqual(
    residentEvil2RankChapter.sections.find(section => section.title === 'Tempos de S rank')?.items?.at(-1),
    'Para os troféus, basta rank S; S+ é opcional e possui regras próprias. O limite de saves pertence ao S+.',
    'Tempos de S rank deve manter somente a nota curta sobre S e limite de saves do S+'
  );
  assert.strictEqual(sampleGames.find(game => game.slug === 'resident-evil-5')?.commonMythsGuide?.myths?.length, 8, 'Resident Evil 5 deve permanecer com seus 8 mitos');
  const re5Related = cardModel.buildRelatedGames(residentEvilGuide, sampleGames, 4);
  assert(
    re5Related.some(item => item?.game?.slug === 'resident-evil-5' && /Resident Evil 5/i.test(item.reason || '')),
    'Modelo de relacionados deve expor link natural para Resident Evil 5 em guias da franquia Resident Evil'
  );
  assert.strictEqual(
    cardModel.getGuideFranchiseConfig(sampleGames.find(game => game.slug === 'resident-evil-5'))?.name,
    'Resident Evil',
    'Resident Evil 5 deve resolver metadado interno de franquia'
  );
  const residentEvilFranchiseRelated = cardModel.buildRelatedFranchiseGuides(residentEvilGuide, sampleGames, { franchise: 'Resident Evil' });
  assert(
    residentEvilFranchiseRelated.some(item => item?.game?.slug === 'resident-evil-5'),
    'RelatedFranchiseGuides deve encontrar Resident Evil 5 quando houver guias publicados da franquia'
  );
  assert.strictEqual(
    cardModel.buildRelatedFranchiseGuides(sampleGames.find(game => game.slug === 'resident-evil-5'), [sampleGames.find(game => game.slug === 'resident-evil-5')], { franchise: 'Resident Evil' }).length,
    0,
    'RelatedFranchiseGuides nao deve renderizar lista de franquia quando so houver o guia atual'
  );

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

async function validateHome() {
  await withTempApp(async ({ baseUrl }) => {
    const html = await fetchText(`${baseUrl}/`, { headers: { accept: 'text/html' } });
    const featuredSection = html.match(/<section class="atlas-home-section atlas-home-featured-section"[\s\S]*?<section id="homeRecentGuides"/)?.[0] || '';
    const discoverySection = html.match(/<span class="atlas-section-kicker">Destaques reais<\/span>[\s\S]*?<section class="atlas-home-feed atlas-home-feed--history"/)?.[0] || '';
    const historySection = html.match(/<span class="atlas-section-kicker">Histórico editorial<\/span>[\s\S]*?<\/section>\s*<\/div>\s*<\/section>/)?.[0] || '';
    const littleNightmares = await fetchJson(`${baseUrl}/api/games/slug/little-nightmares-ii`);

    assert(html.includes('Melhor primeiro clique agora'), 'Home deve renderizar Melhor primeiro clique agora');
    assert(html.includes('Destaques reais'), 'Home deve renderizar Destaques reais');
    assert(html.includes('Últimas revisões'), 'Home deve renderizar Ultimas revisoes');
    assert(html.includes('Explorar guias'), 'Home deve manter CTA principal para explorar o catalogo');
    assert(html.includes('Ver guias em destaque'), 'Home deve manter CTA Ver guias em destaque');
    assert(html.includes('Abrir guia'), 'Home deve manter links Abrir guia');
    assert(!html.includes('id="view-catalog"'), 'Home nao deve pre-renderizar a tela completa de catalogo');
    assert(!html.includes('id="view-library"'), 'Home nao deve pre-renderizar a tela completa de biblioteca');
    assert(!html.includes('id="view-guide"'), 'Home nao deve pre-renderizar a tela completa de guia');
    assert(!html.includes('id="view-profile"'), 'Home nao deve pre-renderizar a tela completa de perfil');
    assert(!html.includes('id="guideQuickDock"'), 'Home nao deve incluir atalhos ocultos de guia');
    assert(!html.includes('Checklist de troféus'), 'Home nao deve expor checklist bruto de paginas de jogo');
    assert.strictEqual((html.match(/<h1\b/g) || []).length, 1, 'Home deve expor apenas um heading principal');
    assert(featuredSection.includes('Astro Bot'), 'Melhor primeiro clique agora deve usar Astro Bot como guia verificado de entrada');
    assert(featuredSection.includes('Verificado'), 'Melhor primeiro clique agora deve exibir guia Verificado');
    assert(!featuredSection.includes('Em revisão'), 'Melhor primeiro clique agora nao deve exibir guia Em revisao');
    assert(discoverySection.includes('Astro Bot') && discoverySection.includes('Resident Evil 2 Remake'), 'Destaques reais devem usar vitrine de guias verificados');
    assert((discoverySection.match(/Verificado/g) || []).length >= 6, 'Destaques reais devem preencher cards principais com Verificados');
    assert(!discoverySection.includes('Em revisão'), 'Destaques reais nao deve misturar Em revisao quando ha Verificados suficientes');
    assert(historySection.includes('Guia verificado') || historySection.includes('roadmap'), 'Historico editorial deve manter nota contextual sem prometer revisao falsa');
    assert.strictEqual(Boolean(littleNightmares.is_verified), true, 'Home deve preservar Little Nightmares II como verificado');
    assert.strictEqual(littleNightmares.verification_status, 'verified', 'Home deve preservar verification_status de Little Nightmares II');
  });

  console.log('test:home passed (featured + destaques verificados)');
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

function isPublicCatalogGuideFixture(game = {}) {
  return loadCatalogModel().isPublicGuideEligible(game);
}

function isIndexableGuideFixture(game = {}) {
  const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const time = text(game.time);
  const difficulty = Number(game.difficulty);
  const trophies = Array.isArray(game.trophies) ? game.trophies : [];
  const roadmap = Array.isArray(game.roadmap) ? game.roadmap : [];
  const trophyCount = trophies.length || Number(game.trophy_count || game.total_trophies || 0);
  const roadmapCount = roadmap.length || Number(game.roadmap_count || 0);
  const coreText = [
    game.name,
    time,
    game.runs_summary,
    game.missable_summary,
    game.online_summary,
    game.dlc_scope,
    game.before_you_start,
    ...trophies.flatMap(trophy => [trophy?.name, trophy?.description, trophy?.tip])
  ].map(text).filter(Boolean).join(' ');

  return text(game.editorial_status || 'published').toLowerCase() === 'published'
    && Boolean(game.is_verified)
    && text(game.verification_status).toLowerCase() === 'verified'
    && (!text(game.editorial_review_status) || text(game.editorial_review_status).toLowerCase() === 'verified')
    && Number.isFinite(difficulty)
    && difficulty > 0
    && difficulty <= 10
    && Boolean(time)
    && !/em revis[aã]o|a definir|indispon[ií]vel|^[-–—]$|^n\/?a$/i.test(time)
    && trophyCount > 0
    && roadmapCount > 0
    && !/\[object Object\]|\bNOME ORIGINAL\b|\bplaceholder\b|descri[cç][aã]o em revis[aã]o|conte[uú]do em revis[aã]o|\ba definir\b/i.test(coreText);
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
  if (slug === 'resident-evil-5') {
    const re5Text = visibleGameText(seedGame);
    const re5FaqText = JSON.stringify(seedGame.faq || []);
    const quickPlan = guideModel.buildGuideQuickPlan(seedGame, viewModel);
    const quickPlanTitles = quickPlan.map(item => item.title);
    const expectedQuickPlanTitles = [
      'Primeira campanha: Normal ou Veteran',
      'Desbloqueie Professional e prepare o arsenal',
      'Limpeza de emblemas BSAA e tesouros',
      'Ranks S e Bonus Features',
      'Farm de dinheiro e upgrades',
      'Troféus situacionais',
      'Professional e revisão final'
    ];
    const platinumCategories = seedGame.platinumBaseChecklist?.categories || [];
    const dlcGuide = seedGame.dlcCompletionGuide || {};
    const dlcText = JSON.stringify(dlcGuide);
    const dlcPackagesById = Object.fromEntries((dlcGuide.packages || []).map(pack => [pack.id, pack]));
    const chapterRoute = seedGame.chapterRouteGuide || {};
    const routeChapters = Array.isArray(chapterRoute.chapters) ? chapterRoute.chapters : [];
    const routeText = JSON.stringify(chapterRoute);
    const professionalGuide = seedGame.professionalAiGuide || {};
    const professionalBlocks = Array.isArray(professionalGuide.blocks) ? professionalGuide.blocks : [];
    const professionalText = JSON.stringify(professionalGuide);
    const farmGuide = seedGame.farmRoutesGuide || {};
    const farmRoutes = Array.isArray(farmGuide.routes) ? farmGuide.routes : [];
    const farmText = JSON.stringify(farmGuide);
    const mythsGuide = seedGame.commonMythsGuide || {};
    const commonMyths = Array.isArray(mythsGuide.myths) ? mythsGuide.myths : [];
    const mythsText = JSON.stringify(mythsGuide);
    const roadmapText = viewModel.roadmapStages
      .map(step => [step.title, step.focus, step.objective, ...(step.actions || []), step.warning, step.result].join(' '))
      .join(' ');
    assert.strictEqual(viewModel.trophies.length, 51, 'Resident Evil 5 deve manter 51 trofeus da platina base');
    assert.strictEqual(viewModel.roadmapStages.length, 7, 'Resident Evil 5 deve manter roadmap curto com 7 etapas');
    assert.deepStrictEqual(quickPlanTitles, expectedQuickPlanTitles, 'Resident Evil 5 deve manter Plano rapido alinhado ao roadmap');
    assert(quickPlan.every(item => !String(item.detail || '').includes('\n') && String(item.detail || '').length <= 180), 'Plano rapido de Resident Evil 5 deve usar uma frase curta por etapa');
    assert.strictEqual(seedGame.dlcRequired || seedGame.dlc_required || false, false, 'Resident Evil 5 deve manter DLC nao obrigatoria');
    assert.strictEqual(seedGame.onlineRequired || seedGame.online_required || false, false, 'Resident Evil 5 deve manter online nao obrigatorio');
    assert.strictEqual(seedGame.coopRequired || seedGame.coop_required || false, false, 'Resident Evil 5 deve manter coop nao obrigatorio');
    assert.strictEqual(platinumCategories.length, 8, 'Extras da Platina de Resident Evil 5 deve manter 8 categorias');
    assert.deepStrictEqual(platinumCategories.map(category => category.id), [
      'bsaa-emblems',
      'treasures',
      'weapons-stockpile',
      'upgrades-take-it-to-the-max',
      'ranks-s-chapters',
      'bonus-features-outfits-figures',
      'eggs-egg-hunt-egg-on-your-face',
      'situational-trophies'
    ], 'Extras da Platina de Resident Evil 5 deve manter apenas categorias da platina base');
    assert.strictEqual(dlcGuide.baseTrophies, 51, 'DLCs de Resident Evil 5 devem preservar 51 trofeus base');
    assert.strictEqual(dlcGuide.dlcTrophies, 20, 'DLCs de Resident Evil 5 devem preservar 20 trofeus extras');
    assert.strictEqual(dlcGuide.totalTrophies, 71, 'DLCs de Resident Evil 5 devem preservar total completo de 71');
    assert.deepStrictEqual((dlcGuide.packages || []).map(item => item.id), ['versus', 'lost-in-nightmares', 'desperate-escape'], 'DLCs de Resident Evil 5 devem ficar em secao propria');
    assert.strictEqual(dlcGuide.roadmapTitle, 'Ordem recomendada para o 100% completo', 'DLCs de Resident Evil 5 devem ter ordem recomendada para 100% completo');
    assert(dlcGuide.roadmapIntro.includes('platina base limpa') && dlcGuide.roadmapIntro.includes('grind online'), 'Ordem de 100% deve explicar platina base primeiro e online por ultimo');
    assert.deepStrictEqual((dlcGuide.roadmap || []).map(step => step.title), ['Feche a platina base primeiro', 'Fazer Lost in Nightmares', 'Fazer Desperate Escape', 'Deixe Versus por último'], 'Ordem de 100% deve manter 4 passos curtos');
    assert.strictEqual(dlcPackagesById.versus?.trophyCount, 10, 'Versus deve manter 10 trofeus');
    assert.strictEqual(dlcPackagesById['lost-in-nightmares']?.trophyCount, 5, 'Lost in Nightmares deve manter 5 trofeus');
    assert.strictEqual(dlcPackagesById['desperate-escape']?.trophyCount, 5, 'Desperate Escape deve manter 5 trofeus');
    assert.strictEqual(dlcPackagesById.versus?.roadmapTitle, 'Rota de boost recomendada', 'Versus deve ter rota de boost recomendada');
    assert.strictEqual((dlcPackagesById.versus?.roadmap || []).length, 3, 'Rota de boost de Versus deve ter 3 sessoes');
    assert.deepStrictEqual(dlcPackagesById.versus.roadmap.map(step => step.title), ['Sessão 1 — Slayers / Survivors', 'Sessão 2 — Team Slayers / Team Survivors', 'Sessão 3 — limpeza'], 'Rota de boost de Versus deve separar as 3 sessoes');
    assert(dlcText.includes('15 vitórias em Slayers') && dlcText.includes('15 vitórias em Survivors') && dlcText.includes('15 vitórias em Team Slayers') && dlcText.includes('15 vitórias em Team Survivors'), 'Versus deve manter 15 vitorias por modo');
    assert(dlcText.includes('50 eliminações físicas') && !dlcText.includes('100 eliminações'), 'Versus deve manter 50 eliminacoes fisicas e nao usar 100 como regra principal');
    assert.strictEqual(dlcPackagesById['lost-in-nightmares']?.roadmapTitle, 'Rota segura', 'Lost in Nightmares deve ter Rota segura');
    assert.strictEqual((dlcPackagesById['lost-in-nightmares']?.roadmap || []).length, 5, 'Lost in Nightmares deve manter 5 passos compactos');
    assert(dlcText.includes('Faça as 18 Score Stars em uma única jogada') && dlcText.includes('Score Stars não são BSAA Emblems') && dlcText.includes('Não exige Professional para S rank'), 'Lost in Nightmares deve separar Score Stars, BSAA, S rank e Professional');
    assert(dlcText.includes('Parceiro humano pode ajudar em Professional e Kung Fu Fighting') && !dlcText.includes('Coop/parceiro humano pode ajudar'), 'Lost in Nightmares deve usar microcopy publica de parceiro humano');
    assert.strictEqual(dlcPackagesById['desperate-escape']?.roadmapTitle, 'Rota segura', 'Desperate Escape deve ter Rota segura');
    assert.strictEqual((dlcPackagesById['desperate-escape']?.roadmap || []).length, 4, 'Desperate Escape deve manter 4 passos compactos');
    assert(dlcText.includes('Derrotar 150 inimigos em uma única jogada') && dlcText.includes('Derrotar os 3 Agitator Majini na mesma jogada') && dlcText.includes('Jogando em dupla, o jogador que precisa do troféu deve fazer a maior parte das kills'), 'Desperate Escape deve tratar 150 kills e 3 Agitator na mesma run');
    const bsaaCategory = platinumCategories.find(category => category.id === 'bsaa-emblems');
    const treasuresCategory = platinumCategories.find(category => category.id === 'treasures');
    const emblem29 = (bsaaCategory?.items || []).find(item => item.number === 29);
    const heartOfAfrica = (treasuresCategory?.items || []).find(item => item.name === 'Heart of Africa');
    const scoreStarsChecklist = (dlcPackagesById['lost-in-nightmares']?.collectibleChecklists || []).find(item => item.title.includes('Score Stars'));
    const agitatorChecklist = (dlcPackagesById['desperate-escape']?.collectibleChecklists || []).find(item => item.title.includes('Agitator Majini'));
    const editorialVideoLinks = [
      ...(bsaaCategory?.links || []),
      ...(emblem29?.links || []),
      ...(heartOfAfrica?.links || []),
      ...(scoreStarsChecklist?.links || []),
      ...(agitatorChecklist?.links || [])
    ];
    assert.deepStrictEqual(editorialVideoLinks.map(link => link.label), [
      'Vídeo: BSAA Emblems — 30 localizações',
      'Vídeo: BSAA Emblem #29 — Chapter 6-1',
      'Vídeo: Heart of Africa — Chapter 5-3',
      'Vídeo: Lost in Nightmares — 18 Score Stars',
      'Vídeo: Desperate Escape — 3 Agitator Majini'
    ], 'Resident Evil 5 deve manter somente os cinco links visuais prioritarios com rotulos claros');
    assert(editorialVideoLinks.every(link => /^https:\/\/www\.youtube\.com\/watch\?v=/.test(link.url)), 'Links de video de Resident Evil 5 devem apontar para videos diretos');
    assert(emblem29.links[0].url.includes('&t=520s'), 'BSAA Emblem #29 deve usar timestamp direto no emblema 29');
    assert(!JSON.stringify(platinumCategories).includes('Score Stars') && !JSON.stringify(platinumCategories).includes('Agitator Majini'), 'Videos de DLC nao devem entrar em Extras da Platina');
    assert(dlcText.includes('Professional da DLC não muda a dificuldade/flags da platina base'), 'DLCs devem separar Professional da platina base');
    assert(re5FaqText.includes('Qual DLC é online?') && re5FaqText.includes('Qual DLC costuma dar mais trabalho?') && re5FaqText.includes('Professional das DLCs muda a platina?'), 'FAQ de RE5 deve cobrir micro-FAQ de DLC');
    ['30 vitórias', '100 eliminações', 'coop obrigatório', 'online obrigatório', 'Checklist Brutal', 'guia brutal', '100% da base', 'Checklist Completo', 'Não dizer', 'Não colocar', 'Não misturar', 'Não marcar', 'Não tratar', 'Não transformar'].forEach(text => {
      assert(!dlcText.includes(text), `DLCs de Resident Evil 5 nao devem conter requisito antigo ou termo proibido: ${text}`);
    });
    assert.strictEqual(chapterRoute.title, 'Rota por Capítulo — Platina Base', 'Resident Evil 5 deve ter Rota por Capitulo da platina base');
    assert.strictEqual(routeChapters.length, 16, 'Rota por Capitulo de Resident Evil 5 deve manter 16 capitulos');
    assert.deepStrictEqual(routeChapters.map(item => item.chapter), ['Chapter 1-1', 'Chapter 1-2', 'Chapter 2-1', 'Chapter 2-2', 'Chapter 2-3', 'Chapter 3-1', 'Chapter 3-2', 'Chapter 3-3', 'Chapter 4-1', 'Chapter 4-2', 'Chapter 5-1', 'Chapter 5-2', 'Chapter 5-3', 'Chapter 6-1', 'Chapter 6-2', 'Chapter 6-3'], 'Rota por Capitulo de Resident Evil 5 deve cobrir os 16 capitulos base');
    const chapter21Text = JSON.stringify(routeChapters.find(item => item.chapter === 'Chapter 2-1'));
    const chapter22Text = JSON.stringify(routeChapters.find(item => item.chapter === 'Chapter 2-2'));
    assert(chapter21Text.includes('Armas importantes: H&K MP5 e S75.'), 'Chapter 2-1 deve listar H&K MP5 e S75');
    assert(chapter22Text.includes('Arma importante: Dragunov SVD.') && !chapter22Text.includes('S75'), 'Chapter 2-2 deve listar apenas Dragunov SVD como arma importante');
    routeChapters.forEach(chapter => {
      assert(Array.isArray(chapter.sections) && chapter.sections.length > 0 && chapter.sections.length <= 4, `${chapter.chapter} deve ter ate 4 blocos curtos`);
      chapter.sections.forEach(section => {
        assert(Array.isArray(section.items) && section.items.length > 0 && section.items.length <= 5, `${chapter.chapter}/${section.title} deve ter lista curta`);
      });
    });
    ['Versus', 'Lost in Nightmares', 'Desperate Escape', 'Score Star', 'Agitator Majini'].forEach(text => {
      assert(!routeText.includes(text), `Rota por Capitulo de Resident Evil 5 nao deve conter DLC: ${text}`);
    });
    assert(routeText.includes('White Egg') && routeText.includes('Brown Egg') && routeText.includes('Gold Egg'), 'Chapter 3-1 deve mencionar ovos White/Brown/Gold');
    assert(routeText.includes('Soul Gem'), 'Chapter 4-1 deve preservar Soul Gem');
    assert(routeText.includes('Heart of Africa') && routeText.includes('Bad Blood'), 'Chapter 5-3 deve preservar Heart of Africa e Bad Blood');
    assert(routeText.includes('exige explosivo'), 'Chapter 6-1 deve preservar alerta de explosivo');
    assert(routeText.includes('Diamond (Marquise)'), 'Chapter 6-3 deve preservar Diamond (Marquise)');
    assert.strictEqual(professionalGuide.title, 'Professional e IA — Preparação para War Hero', 'Resident Evil 5 deve ter secao compacta de preparacao para War Hero');
    assert.strictEqual(professionalBlocks.length, 6, 'Professional e IA de Resident Evil 5 deve manter no maximo 6 blocos principais');
    assert.deepStrictEqual(professionalBlocks.map(block => block.title), ['Quando fazer', 'Como liberar', 'Loadout recomendado', 'IA / parceiro', 'Capítulos críticos', 'Checklist antes de iniciar War Hero'], 'Professional e IA deve manter os 6 blocos esperados');
    const loadoutBlock = professionalBlocks.find(block => block.title === 'Loadout recomendado');
    const checklistBlock = professionalBlocks.find(block => block.title === 'Checklist antes de iniciar War Hero');
    const preRunGroup = checklistBlock?.groups?.find(group => group.title === 'Antes da run');
    const reworkGroup = checklistBlock?.groups?.find(group => group.title === 'Erros que geram retrabalho');
    assert((loadoutBlock?.items || []).length > 0 && loadoutBlock.items.length <= 6, 'Loadout de Professional deve ser curto');
    assert.strictEqual((preRunGroup?.items || []).length, 8, 'Checklist antes de War Hero deve ter no maximo 8 itens');
    assert.strictEqual((reworkGroup?.items || []).length, 5, 'Erros que geram retrabalho deve ter no maximo 5 itens');
    assert(professionalText.includes('Chapter 2-3 — Ndesu/turret') && professionalText.includes('não depende do arsenal'), 'Professional e IA deve tratar Chapter 2-3 como trecho de turret');
    assert(professionalText.includes('Confundir Rank S com Professional: são objetivos separados.'), 'Professional e IA nao deve confundir Rank S com Professional');
    assert(professionalText.includes('Parceiro humano recomendado') && professionalText.includes('ajuda opcional, não requisito'), 'Professional e IA deve manter parceiro humano opcional');
    ['Night Terrors', 'Run the Gauntlet', 'Lost in Nightmares', 'Desperate Escape', 'Versus', 'coop obrigatório', 'online obrigatório'].forEach(text => {
      assert(!professionalText.includes(text), `Professional e IA nao deve misturar DLC ou requisito indevido: ${text}`);
    });
    assert.strictEqual(farmGuide.title, 'Rotas de Farm — dinheiro, pontos e upgrades', 'Resident Evil 5 deve ter secao compacta de Rotas de Farm');
    assert(farmGuide.introduction.includes('não substitui Extras da Platina'), 'Rotas de Farm deve explicar que nao substitui Extras da Platina');
    assert(farmRoutes.length >= 4 && farmRoutes.length <= 6, 'Rotas de Farm deve manter tabela curta de 4 a 6 rotas');
    assert.deepStrictEqual(farmRoutes.map(route => route.route), [
      'Chapter 4-1 — Caves',
      'Chapter 5-1 — Lickers',
      'Chapter 5-2 ou 5-3 — Reapers / Power Stones',
      'Chapter 5-3 — Heart of Africa',
      'Chapter 6-2 — Bonus Features',
      'Run sub-5h — Infinite Rocket Launcher'
    ], 'Rotas de Farm deve manter as 6 rotas esperadas');
    farmRoutes.forEach(route => {
      assert(Array.isArray(route.bestFor) && route.bestFor.length > 0 && route.bestFor.length <= 3, `${route.route} deve manter Melhor para compacto`);
      assert(route.when && route.caution && route.note, `${route.route} deve preencher Quando usar, Cuidado e nota curta`);
    });
    ['Soul Gem', 'Lion Hearts', 'Power Stones', 'Heart of Africa', 'Exchange Points', 'Infinite Rocket Launcher'].forEach(text => {
      assert(farmText.includes(text), `Rotas de Farm deve cobrir ${text}`);
    });
    assert(farmText.includes('Dinheiro da campanha compra armas e upgrades') && farmText.includes('pontos de Bonus Features/Exchange Points'), 'Rotas de Farm deve separar dinheiro de pontos de Bonus Features');
    assert(farmText.includes('Mercenaries pode render pontos de Bonus Features') && farmText.includes('opcional') && farmText.includes('não é requisito'), 'Rotas de Farm deve tratar Mercenaries como opcional');
    assert(farmText.includes('DLCs não entram nessa tabela de farm da platina base'), 'Rotas de Farm deve separar DLCs da tabela da platina base');
    assert(farmText.includes('Não farme por farminho'), 'Rotas de Farm deve conter o texto curto obrigatorio');
    ['Night Terrors', 'Run the Gauntlet', 'Lost in Nightmares', 'Desperate Escape', 'Versus', 'Checklist BSAA 01/30', 'Checklist tesouro 01/50', 'Checklist upgrade 01/18', 'Não transformar'].forEach(text => {
      assert(!farmText.includes(text), `Rotas de Farm nao deve conter DLC, lista longa ou frase interna: ${text}`);
    });
    assert.strictEqual(mythsGuide.title, 'Mitos e erros comuns', 'Resident Evil 5 deve ter secao Mitos e erros comuns');
    assert.strictEqual(commonMyths.length, 8, 'Mitos e erros comuns de Resident Evil 5 deve manter no maximo 8 mitos');
    commonMyths.forEach((item, index) => {
      assert(item.myth && item.correction && item.where, `Mito ${index + 1} deve ter Mito, Correcao e Onde conferir`);
      assert(String(item.myth).length <= 90, `Mito ${index + 1} deve ser curto`);
      assert(String(item.correction).length <= 240, `Correcao do mito ${index + 1} deve ser curta`);
      assert(String(item.where).length <= 120, `Onde conferir do mito ${index + 1} deve ser curto`);
    });
    [
      'Versus é DLC',
      '51 base + 20 DLC',
      'Hand Grenade',
      'Incendiary Grenade',
      'Flash Grenade',
      'Proximity Bomb',
      'M93R',
      'Hydra',
      'S&W M500',
      'Score Stars são coletáveis da DLC Lost in Nightmares',
      'S ranks podem ser buscados separadamente em dificuldade baixa',
      'Não venda o primeiro Rotten Egg',
      'Night Terrors',
      'Run the Gauntlet'
    ].forEach(text => {
      assert(mythsText.includes(text), `Mitos e erros comuns deve cobrir: ${text}`);
    });
    assert(mythsText.includes('DLCs e 100% da Lista > Versus'), 'Mitos deve apontar Versus para a secao de DLCs');
    assert(mythsText.includes('Extras da Platina > Armas e Stockpile'), 'Mitos deve apontar Stockpile para Extras da Platina');
    assert(mythsText.includes('Extras da Platina > BSAA Emblems'), 'Mitos deve apontar BSAA Emblems para Extras da Platina');
    ['Checklist BSAA 01/30', 'Checklist tesouro 01/50', 'Checklist upgrade 01/18', 'Checklist Brutal', 'guia brutal', '100% da base', 'Checklist Completo', 'NOME ORIGINAL', '[object Object]', 'Não dizer', 'Não colocar', 'Não misturar', 'Não marcar', 'Não tratar', 'Não transformar'].forEach(text => {
      assert(!mythsText.includes(text), `Mitos e erros comuns nao deve conter lista longa ou texto proibido: ${text}`);
    });
    ['BSAA Emblem #01', 'Checklist BSAA 01/30', 'Checklist tesouro 01/50', 'Score Star #01', 'Versus e um pacote DLC'].forEach(text => {
      assert(!roadmapText.includes(text), `Roadmap de Resident Evil 5 nao deve receber lista longa ou DLC: ${text}`);
    });
    assert(roadmapText.includes('Extras da Platina'), 'Roadmap de Resident Evil 5 deve apontar listas longas da platina base para Extras da Platina');
    assert(roadmapText.includes('para o checklist detalhado da platina base, abra Extras da Platina') && !roadmapText.includes('para a lista completa, abra Extras da Platina'), 'Roadmap de Resident Evil 5 deve evitar confundir Extras da Platina com a lista completa de 71 trofeus');
    assert(roadmapText.includes('Use Rotas de Farm para escolher entre dinheiro, Lion Hearts, Power Stones e pontos de Bonus Features sem repetir capítulos aleatórios.'), 'Roadmap de Resident Evil 5 deve apontar para Rotas de Farm na etapa de farm');
    ['Checklist completo', 'Checklist Brutal', 'guia brutal', '100% da base', 'NOME ORIGINAL', '[object Object]', 'Não dizer', 'Não colocar', 'Não misturar', 'Não marcar', 'Não tratar', 'Não transformar'].forEach(text => {
      assert(!re5Text.includes(text), `Resident Evil 5 seed nao deve conter texto publico/internal incorreto: ${text}`);
    });
    assert(!re5Text.includes('Use Extras da Platina para limpar ovos e troféus situacionais por Chapter Select.'), 'Resident Evil 5 nao deve repetir frase antiga em Trofeus situacionais');
  }
  if (slug === 'resident-evil') {
    const residentText = visibleGameText(seedGame);
    const normalizedResidentText = normalizeText(residentText);
    const trophyText = seedGame.trophies.map(trophy => `${trophy.name} ${trophy.name_pt} ${trophy.description} ${trophy.tip}`).join(' ');
    const tagCount = tagId => seedGame.trophies.filter(trophy => guideModel.getGuideTrophyTags(trophy, seedGame).some(tag => tag.id === tagId)).length;
    const roadmapTitles = viewModel.roadmapStages.map(step => step.title);
    assert.strictEqual(seedGame.is_verified, true, 'Resident Evil deve ficar Verificado no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'Resident Evil deve ficar com verification_status verified');
    assert.strictEqual(viewModel.editorial.statusBadge.label, 'Verificado', 'Resident Evil deve exibir selo Verificado');
    assert.strictEqual(viewModel.editorial.statusBadge.detail, 'Guia revisado editorialmente.', 'Resident Evil deve exibir mensagem revisada');
    assert.strictEqual(viewModel.trophies.length, 45, 'Resident Evil deve manter 45 trofeus da lista base');
    assert.strictEqual(viewModel.trophies.filter(trophy => trophy.type === 'Platina').length, 1, 'Resident Evil deve manter 1 platina');
    assert.strictEqual(viewModel.trophies.filter(trophy => trophy.type === 'Ouro').length, 1, 'Resident Evil deve manter 1 ouro');
    assert.strictEqual(viewModel.trophies.filter(trophy => trophy.type === 'Prata').length, 15, 'Resident Evil deve manter 15 pratas');
    assert.strictEqual(viewModel.trophies.filter(trophy => trophy.type === 'Bronze').length, 28, 'Resident Evil deve manter 28 bronzes');
    assert.strictEqual(viewModel.missableCount, 17, 'Resident Evil deve manter 17 perdiveis por run');
    assert.strictEqual(seedGame.onlineRequired, false, 'Resident Evil deve manter online 0 explicito');
    assert.strictEqual(seedGame.coopRequired, false, 'Resident Evil deve manter coop 0 explicito');
    assert.strictEqual(seedGame.dlcRequired, false, 'Resident Evil deve manter DLC fora da platina base');
    assert.strictEqual(seedGame.newGamePlusRequired, false, 'Resident Evil nao deve exigir NG+');
    assert.strictEqual(seedGame.difficultyTrophiesRequired, true, 'Resident Evil deve marcar dificuldade/modos obrigatorios');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Resident Evil deve ter roadmap com 6 etapas');
    assert(viewModel.roadmapStages.every(step => Array.isArray(step.actions) && step.actions.length >= 4), 'Resident Evil deve ter acoes estruturadas no roadmap');
    ['Faça uma primeira run segura aprendendo a mansão', 'Complete as rotas de Jill e Chris', 'Trabalhe Hard, Real Survival e Invisible Enemy', 'Faça runs condicionais: sem salvar, faca-only e speedrun', 'Limpe armas, roupas, mapas e objetivos específicos', 'Finalize a checklist da platina base'].forEach(title => {
      assert(roadmapTitles.includes(title), `Resident Evil deve conter etapa: ${title}`);
    });
    assert(seedGame.dlc_scope.includes('DLC fora da platina base'), 'Resident Evil deve separar DLC da platina base');
    assert(Array.isArray(seedGame.editorial_summary) && seedGame.editorial_summary.length >= 3, 'Resident Evil deve ter resumo editorial completo da platina');
    assert(seedGame.editorial_summary.join(' ').includes('DLCs e extras ficam fora da platina base'), 'Resumo editorial de Resident Evil deve separar DLC da platina base');
    assert(viewModel.contextualFaq.length >= 8, 'Resident Evil deve ter FAQ especifica');
    assert(viewModel.contextualFaq.some(item => `${item.question} ${item.answer}`.includes('Real Survival') && `${item.question} ${item.answer}`.includes('Invisible Enemy')), 'FAQ de Resident Evil deve explicar modos obrigatorios');
    assert(viewModel.nextActionModel.title === 'Faça uma primeira run segura aprendendo a mansão', 'Resident Evil nao deve usar primeiro passo generico');
    assert(tagCount('difficulty') > 0, 'Resident Evil deve manter tags de Dificuldade');
    assert(tagCount('run') > 0, 'Resident Evil deve manter tags de Risco de run');
    assert(tagCount('spoiler') > 0, 'Resident Evil deve manter tags de Spoiler');
    assert.strictEqual(seedGame.trophies.filter(trophy => trophy.name_pt && trophy.name_pt.trim()).length, 45, 'Resident Evil deve ter titulo PT-BR nos 45 trofeus');
    assert(!/Finish the game|Complete the game|Defeat|Save Chris|Save Jill|Get killed|Obtain all|Burn up two zombies/i.test(trophyText), 'Resident Evil nao deve manter descricoes em ingles na checklist');
    [
      'dados atuais do guia',
      'segundo os dados atuais do guia',
      'o guia não aponta',
      'quando validado',
      'em revisão editorial',
      'guia aguardando validação',
      'informação pendente',
      'Comece pelo roadmap',
      'Avance pela campanha',
      'Prossiga pela rota planejada',
      'Base game sem DLCs',
      'Descrição em revisão editorial.',
      '[object Object]',
      'undefined',
      'só faça',
      'resgaté'
    ].forEach(text => {
      assert(!residentText.includes(text), `Resident Evil seed nao deve conter texto fraco: ${text}`);
      if (!['só faça', 'resgaté'].includes(text)) {
        assert(!normalizedResidentText.includes(normalizeText(text)), `Resident Evil seed nao deve conter texto fraco normalizado: ${text}`);
      }
    });
  }
  if (slug === 'dead-cells') {
    const deadCellsText = visibleGameText(seedGame);
    const normalizedDeadCellsText = normalizeText(deadCellsText);
    const trophyText = seedGame.trophies.map(trophy => `${trophy.name} ${trophy.name_pt} ${trophy.description} ${trophy.tip}`).join(' ');
    const tagCount = tagId => seedGame.trophies.filter(trophy => guideModel.getGuideTrophyTags(trophy, seedGame).some(tag => tag.id === tagId)).length;
    const roadmapTitles = viewModel.roadmapStages.map(step => step.title);
    assert.strictEqual(seedGame.is_verified, true, 'Dead Cells deve ficar Verificado no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'Dead Cells deve ficar com verification_status verified');
    assert.strictEqual(viewModel.editorial.statusBadge.label, 'Verificado', 'Dead Cells deve exibir selo Verificado');
    assert.strictEqual(viewModel.editorial.statusBadge.detail, 'Guia revisado editorialmente.', 'Dead Cells deve exibir mensagem revisada');
    assert.strictEqual(viewModel.trophies.length, 54, 'Dead Cells deve manter 54 trofeus da lista base');
    assert.strictEqual(viewModel.missableCount, 0, 'Dead Cells deve manter missableCount 0');
    assert.strictEqual(seedGame.trophies.filter(item => item.is_missable || item.isMissable).length, 0, 'Dead Cells nao deve inflar perdiveis permanentes');
    assert.strictEqual(seedGame.trophies.filter(trophy => guideModel.getGuideTrophyTags(trophy, seedGame).some(tag => tag.id === 'missable')).length, 0, 'Dead Cells nao deve renderizar tag Perdivel em desafios repetiveis');
    assert.strictEqual(seedGame.onlineRequired, false, 'Dead Cells deve manter online 0 explicito');
    assert.strictEqual(seedGame.coopRequired, false, 'Dead Cells deve manter coop 0 explicito');
    assert.strictEqual(seedGame.dlcRequired, false, 'Dead Cells deve manter DLC fora da platina base');
    assert.strictEqual(seedGame.newGamePlusRequired, false, 'Dead Cells nao deve exigir NG+');
    assert.strictEqual(seedGame.difficultyTrophiesRequired, true, 'Dead Cells deve marcar dificuldade obrigatoria por Boss Stem Cells');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Dead Cells deve ter roadmap com 6 etapas');
    assert(viewModel.roadmapStages.every(step => step.actions.length >= 4), 'Dead Cells deve ter acoes estruturadas no roadmap');
    ['Aprenda o ciclo de runs e desbloqueie upgrades permanentes', 'Abra rotas, biomas e chefes principais', 'Trabalhe troféus de chefes e objetivos de execução', 'Avance pelas Boss Stem Cells e dificuldade crescente', 'Limpe blueprints, desafios e objetivos específicos', 'Finalize a checklist da platina base'].forEach(title => {
      assert(roadmapTitles.includes(title), `Dead Cells deve conter etapa: ${title}`);
    });
    assert(seedGame.dlc_scope.includes('DLC fora da platina base') && seedGame.dlc_scope.includes('54 troféus'), 'Dead Cells deve separar DLC da platina base');
    assert(Array.isArray(seedGame.editorial_summary) && seedGame.editorial_summary.length >= 4, 'Dead Cells deve ter resumo editorial completo da platina');
    assert(seedGame.editorial_summary.join(' ').includes('DLCs e expansões ficam fora da platina base'), 'Resumo editorial de Dead Cells deve separar DLC da platina base');
    assert(viewModel.contextualFaq.length >= 8, 'Dead Cells deve ter FAQ especifica');
    assert(viewModel.contextualFaq.some(item => item.question.includes('dificuldade alta') && item.answer.includes('Boss Stem Cells')), 'FAQ de Dead Cells deve explicar dificuldade obrigatoria');
    assert(viewModel.nextActionModel.title === 'Aprenda o ciclo de runs e desbloqueie upgrades permanentes', 'Dead Cells nao deve usar primeiro passo generico');
    assert(tagCount('grind') > 0, 'Dead Cells deve manter tags de Grind');
    assert(tagCount('difficulty') > 0, 'Dead Cells deve manter tags de Dificuldade');
    assert(tagCount('cleanup') > 0, 'Dead Cells deve manter tags de Cleanup');
    assert.strictEqual(seedGame.trophies.filter(trophy => trophy.name_pt && trophy.name_pt.trim()).length, 54, 'Dead Cells deve ter titulo PT-BR nos 54 trofeus');
    assert(!/Unlock all trophies|Beat the|Reach the|Finish the game|Absorb your|Open your|Complete a Daily|Kill an enemy|Suicide by elevator|Cheat Death|Unlock 10|Find your first|Find a secret/i.test(trophyText), 'Dead Cells nao deve manter descricoes em ingles na checklist');
    [
      'dados atuais do guia',
      'segundo os dados atuais do guia',
      'o guia não aponta',
      'quando validado',
      'em revisão editorial',
      'guia aguardando validação',
      'informação pendente',
      'aguarda validação',
      'Comece pelo roadmap',
      'Avance pela campanha',
      'Prossiga pela rota planejada',
      'Base game sem DLCs',
      'Descrição em revisão editorial.',
      '[object Object]',
      'undefined'
    ].forEach(text => {
      assert(!deadCellsText.includes(text), `Dead Cells seed nao deve conter texto fraco: ${text}`);
      assert(!normalizedDeadCellsText.includes(normalizeText(text)), `Dead Cells seed nao deve conter texto fraco normalizado: ${text}`);
    });
  }
  if (slug === 'resident-evil-2-remake') {
    const re2Text = visibleGameText(seedGame);
    const normalizedRe2Text = normalizeText(re2Text);
    const trophyText = seedGame.trophies.map(trophy => `${trophy.name} ${trophy.name_pt} ${trophy.description} ${trophy.tip}`).join(' ');
    const tagCount = tagId => seedGame.trophies.filter(trophy => guideModel.getGuideTrophyTags(trophy, seedGame).some(tag => tag.id === tagId)).length;
    const roadmapTitles = viewModel.roadmapStages.map(step => step.title);
    assert.strictEqual(seedGame.slug, 'resident-evil-2-remake', 'Resident Evil 2 Remake deve manter slug correto');
    assert.strictEqual(seedGame.is_verified, true, 'Resident Evil 2 Remake deve ficar Verificado no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'Resident Evil 2 Remake deve ficar com verification_status verified');
    assert.strictEqual(viewModel.editorial.statusBadge.label, 'Verificado', 'Resident Evil 2 Remake deve exibir selo Verificado');
    assert.strictEqual(viewModel.trophies.length, 42, 'Resident Evil 2 Remake deve manter 42 trofeus da lista base');
    assert.strictEqual(viewModel.trophies.filter(trophy => trophy.type === 'Platina').length, 1, 'Resident Evil 2 Remake deve manter 1 platina');
    assert.strictEqual(viewModel.trophies.filter(trophy => trophy.type === 'Ouro').length, 4, 'Resident Evil 2 Remake deve manter 4 ouros');
    assert.strictEqual(viewModel.trophies.filter(trophy => trophy.type === 'Prata').length, 9, 'Resident Evil 2 Remake deve manter 9 pratas');
    assert.strictEqual(viewModel.trophies.filter(trophy => trophy.type === 'Bronze').length, 28, 'Resident Evil 2 Remake deve manter 28 bronzes');
    assert.strictEqual(seedGame.onlineRequired, false, 'Resident Evil 2 Remake deve manter online 0 explicito');
    assert.strictEqual(seedGame.coopRequired, false, 'Resident Evil 2 Remake deve manter coop 0 explicito');
    assert.strictEqual(seedGame.dlcRequired, false, 'Resident Evil 2 Remake deve manter DLC fora da platina base');
    assert.strictEqual(seedGame.difficultyTrophiesRequired, true, 'Resident Evil 2 Remake deve marcar dificuldade obrigatoria');
    assert.strictEqual(viewModel.missableCount, 28, 'Resident Evil 2 Remake deve manter 28 trofeus situacionais, coletaveis ou condicionais marcados como perdiveis por run');
    assert.strictEqual(tagCount('online'), 0, 'Resident Evil 2 Remake nao deve ter tag Online');
    assert.strictEqual(tagCount('coop'), 0, 'Resident Evil 2 Remake nao deve ter tag Coop');
    assert.strictEqual(tagCount('grind'), 0, 'Resident Evil 2 Remake nao deve inflar Grind por rankings');
    assert(tagCount('collectible') >= 8, 'Resident Evil 2 Remake deve marcar coletaveis reais');
    assert(tagCount('difficulty') >= 8, 'Resident Evil 2 Remake deve marcar dificuldade/ranking/restricoes');
    assert(tagCount('run') >= 8, 'Resident Evil 2 Remake deve marcar risco de run');
    assert.strictEqual(viewModel.roadmapStages.length, 8, 'Resident Evil 2 Remake deve ter roadmap com 8 etapas editoriais');
    assert(viewModel.roadmapStages.every(step => step.isStructured && step.actions.length >= 3), 'Resident Evil 2 Remake deve ter acoes estruturadas no roadmap');
    ['Faça uma primeira campanha segura aprendendo o R.P.D.', 'Complete Leon, Claire e 2nd Run para o final verdadeiro', 'Resolva coletáveis base e limpeza de exploração', 'Faça S rank com Leon e Claire', 'Complete Hardcore com Leon e Claire', 'Faça runs condicionais sem cura, sem baú e com poucos passos', 'Complete The 4th Survivor para Grim Reaper', 'Finalize a checklist da platina base'].forEach(title => {
      assert(roadmapTitles.includes(title), `Resident Evil 2 Remake deve conter etapa: ${title}`);
    });
    assert.strictEqual(seedGame.chapterRouteGuide?.campaignPlan?.runs?.length, 7, 'Resident Evil 2 Remake deve preservar exatamente 7 runs no plano principal');
    assert(seedGame.dlc_scope.includes('DLC fora da platina base') && seedGame.dlc_scope.includes('The Ghost Survivors'), 'Resident Evil 2 Remake deve separar DLC/extras da platina base');
    assert(Array.isArray(seedGame.editorial_summary) && seedGame.editorial_summary.length >= 4, 'Resident Evil 2 Remake deve ter resumo editorial completo da platina');
    assert(seedGame.editorial_summary.join(' ').includes('múltiplas campanhas com Leon e Claire') && seedGame.editorial_summary.join(' ').includes('3 extras de The Ghost Survivors e Another Survivor / Chasing Jill'), 'Resumo editorial de Resident Evil 2 Remake deve explicar rota e extras');
    assert.strictEqual(viewModel.contextualFaq.length, 8, 'Resident Evil 2 Remake deve ter FAQ objetiva com limite visual');
    assert(viewModel.contextualFaq.some(item => item.question.includes('2nd Run') && item.answer.includes('2ª jornada')), 'FAQ de Resident Evil 2 Remake deve explicar 2nd Run');
    assert(viewModel.contextualFaq.some(item => item.question.includes('PSN pode mostrar 45 troféus') && item.answer.includes('42 troféus da lista base da platina')), 'FAQ de Resident Evil 2 Remake deve separar DLC/extras');
    const re2RankFaq = viewModel.contextualFaq.find(item => item.question.includes('Hardcore, rank S e speedrun'));
    assert(re2RankFaq?.answer.includes('S rank com Leon e Claire é obrigatório') && re2RankFaq.answer.includes('S+ é opcional') && re2RankFaq.answer.includes('Hardcore Rookie e Hardcore College Student'), 'FAQ de Resident Evil 2 Remake deve resumir S, S+ e Hardcore');
    assert.strictEqual((re2RankFaq.answer.match(/[.!?](?:\s|$)/g) || []).length, 2, 'FAQ de S rank de Resident Evil 2 Remake deve ter no maximo duas frases');
    assert(viewModel.contextualFaq.some(item => item.question.includes('sem cura, sem baú ou limite de passos') && item.answer.includes('Frugalist')), 'FAQ de Resident Evil 2 Remake deve explicar runs condicionais');
    const re2Myths = seedGame.commonMythsGuide?.myths || [];
    assert.strictEqual(seedGame.commonMythsGuide?.anchorId, 'mitos-e-erros-comuns', 'Resident Evil 2 Remake deve usar anchor local estavel para Mitos e erros comuns');
    assert.strictEqual(re2Myths.length, 9, 'Resident Evil 2 Remake deve manter exatamente 9 mitos');
    re2Myths.forEach((item, index) => {
      assert(item.category && item.myth && item.correction && Array.isArray(item.where) && item.where.length, `Mito ${index + 1} de Resident Evil 2 Remake deve manter categoria, Mito, Correcao e Onde conferir`);
      item.where.forEach(destination => {
        assert(destination.label, `Destino de Onde conferir do mito ${index + 1} deve ter texto descritivo`);
        assert(!destination.href || (/^#[^#]/.test(destination.href) && destination.href !== '#'), `Destino de Onde conferir do mito ${index + 1} nao deve usar link vazio`);
      });
    });
    assert(!/mito\(s\)|troféu\(s\)|NOME ORIGINAL|\[object Object\]/.test(JSON.stringify(seedGame.commonMythsGuide)), 'Mitos de Resident Evil 2 Remake nao devem conter pluralizacao artificial, linguagem interna ou placeholder');
    assert.strictEqual(viewModel.nextActionModel.title, 'Faça uma primeira campanha segura aprendendo o R.P.D.', 'Resident Evil 2 Remake deve ter primeiro passo recomendado especifico');
    assert(viewModel.nextActionModel.detail.includes('siga a primeira campanha sem buscar ranking ou restrições'), 'Resident Evil 2 Remake deve preservar descricao do primeiro passo recomendado');
    assert.deepStrictEqual(viewModel.routeChangingTrophies.slice(0, 5).map(item => item.name), ['Peguei Você!', 'Num Piscar de Olhos', 'Com Tempo de Sobra', 'Uma Superespiã Eficiente', 'Jovem Fugitiva'], 'Pontos de atencao de Resident Evil 2 Remake devem usar titulos PT-BR');
    assert(viewModel.routeChangingTrophies.every(item => !/Este troféu está marcado como spoiler|Revele os detalhes/i.test(item.text)), 'Pontos de atencao de Resident Evil 2 Remake nao devem usar texto generico de spoiler');
    assert.strictEqual(seedGame.trophies.find(trophy => trophy.id === 're2r_eat_this')?.tip, 'Use faca, granada ou flash ao ser agarrado.', 'Resident Evil 2 Remake deve corrigir dica de Eat This');
    assert.strictEqual(seedGame.trophies.find(trophy => trophy.id === 're2r_leon_s')?.tip, 'S rank é obrigatório; S+ não é necessário.', 'Card Leon S Kennedy deve manter uma unica frase pratica sobre S e S+');
    assert.strictEqual(seedGame.trophies.find(trophy => trophy.id === 're2r_scarlet_hero')?.tip, 'S rank é obrigatório; S+ não é necessário.', 'Card Sizzling Scarlet Hero deve manter uma unica frase pratica sobre S e S+');
    assert.strictEqual(seedGame.trophies.filter(trophy => trophy.name_pt && trophy.name_pt.trim()).length, 42, 'Resident Evil 2 Remake deve ter titulo PT-BR nos 42 trofeus');
    assert(!/Obtain all trophies|Reach the police station|Complete Leon['’]s story|Complete Claire['’]s story|Complete the game without|Open all of the safes|Destroy all Mr\. Raccoons/i.test(trophyText), 'Resident Evil 2 Remake nao deve manter descricoes em ingles na checklist');
    [
      'dados atuais do guia',
      'segundo os dados atuais do guia',
      'o guia não aponta',
      'quando validado',
      'em revisão editorial',
      'guia aguardando validação',
      'informação pendente',
      'Comece pelo roadmap',
      'Avance pela campanha',
      'Prossiga pela rota planejada',
      'Base game sem DLCs',
      'Descrição em revisão editorial.',
      '[object Object]',
      'undefined',
      'Maté'
    ].forEach(text => {
      assert(!re2Text.includes(text), `Resident Evil 2 Remake seed nao deve conter texto fraco: ${text}`);
      if (text !== 'Maté') {
        assert(!normalizedRe2Text.includes(normalizeText(text)), `Resident Evil 2 Remake seed nao deve conter texto fraco normalizado: ${text}`);
      }
    });
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
    assert.strictEqual(Boolean(seedGame.onlineRequired || seedGame.online_required), false, 'Ghost of Tsushima deve manter online 0');
    assert.strictEqual(Boolean(seedGame.coopRequired || seedGame.coop_required), false, 'Ghost of Tsushima deve manter coop 0');
    assert.strictEqual(seedGame.dlcRequired || seedGame.dlc_required || false, false, 'Ghost of Tsushima deve manter DLC nao obrigatoria');
    assert.deepStrictEqual(seedGame.quality_warnings || seedGame.qualityWarnings || [], [], 'Ghost of Tsushima nao deve ter quality warning publico no seed');
    ['Maté', 'Watér', 'Resgaté', 'Base game sem DLCs', 'Algumas descrições secretas usam tradução editorial PT-BR', 'Steam oculta', 'descrição localizada'].forEach(text => {
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
  if (slug === 'saros') {
    const sarosText = JSON.stringify(seedGame);
    const realMissables = seedGame.trophies.filter(item => item.is_missable || item.isMissable);
    const untouchable = seedGame.trophies.find(item => item.id === 'saros-untouchable');
    const untouchableTags = guideModel.getGuideTrophyTags(untouchable, seedGame).map(tag => tag.label);
    const routeItems = viewModel.routeChangingTrophies || [];
    const faqText = JSON.stringify(viewModel.contextualFaq || []);
    const roadmapText = JSON.stringify(viewModel.roadmapStages || []);
    assert.strictEqual(seedGame.is_verified, true, 'Saros deve ficar verified no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'Saros deve expor verification_status verified');
    assert.strictEqual(viewModel.editorial.statusBadge.label, 'Verificado', 'Saros deve exibir selo Verificado');
    assert.strictEqual(viewModel.editorial.statusBadge.detail, 'Guia revisado editorialmente.', 'Saros deve exibir mensagem publica revisada');
    assert.strictEqual(viewModel.trophies.length, 45, 'Saros deve manter 45 trofeus');
    assert.strictEqual(Boolean(seedGame.onlineRequired || seedGame.online_required), false, 'Saros deve manter online 0');
    assert.strictEqual(Boolean(seedGame.coopRequired || seedGame.coop_required), false, 'Saros deve manter coop 0');
    assert.strictEqual(seedGame.dlcRequired || seedGame.dlc_required || false, false, 'Saros deve manter DLC nao obrigatoria');
    assert.strictEqual(viewModel.missableCount, realMissables.length, 'Saros deve alinhar missableCount com trofeus marcados');
    assert.strictEqual(viewModel.missableCount, 0, 'Saros deve ficar sem perdiveis definitivos');
    assert(untouchable && !untouchable.is_missable && !untouchable.isMissable && !untouchableTags.includes('Perdível'), 'Untouchable nao deve aparecer como Perdivel');
    assert(untouchableTags.includes('Dificuldade') && untouchableTags.includes('Risco de run'), 'Untouchable deve ser reclassificado como dificuldade/risco de run');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Saros deve manter roadmap com 6 etapas');
    assert(sarosText.includes('DLC fora da platina base'), 'Saros deve padronizar DLC fora da platina base');
    assert(routeItems.length <= 5, 'Saros deve renderizar no maximo 5 pontos de atencao');
    ['saros-untouchable', 'saros-let-go', 'saros-nightmare-strands', 'saros-full-arsenal', 'saros-king'].forEach(id => {
      assert(routeItems.some(item => item.id === id), `Saros deve incluir ponto de atencao ${id}`);
    });
    [
      'em revisão editorial',
      'guia inicial',
      'quando validado',
      'aguardando revisão',
      'validação editorial pendente',
      'mantendo o guia em revisão',
      'dados atuais do guia',
      'segundo os dados atuais do guia',
      'o guia não aponta',
      'não há requisito validado',
      'devem continuar em validação editorial',
      'Este troféu está marcado como spoiler',
      'Revele os detalhes na lista completa',
      'Base game sem DLCs',
      'Descrição em revisão editorial.',
      '[object Object]',
      'undefined'
    ].forEach(text => {
      assert(!sarosText.includes(text), `Saros seed nao deve conter texto publico/internal incorreto: ${text}`);
      assert(!faqText.includes(text), `Saros FAQ nao deve conter texto fraco: ${text}`);
      assert(!roadmapText.includes(text), `Saros roadmap nao deve conter texto fraco: ${text}`);
      assert(!JSON.stringify(routeItems).includes(text), `Saros pontos de atencao nao devem conter texto generico: ${text}`);
    });
  }
  if (slug === 'god-of-war') {
    const gowText = [
      visibleGameText(seedGame),
      JSON.stringify(seedGame.faq || []),
      JSON.stringify(viewModel.contextualFaq || []),
      JSON.stringify(viewModel.routeChangingTrophies || [])
    ].join(' ');
    const normalizedGowText = normalizeText(gowText);
    const realMissables = seedGame.trophies.filter(item => item.is_missable === true || item.isMissable === true);
    const routeItems = viewModel.routeChangingTrophies || [];
    const trophyCount = type => seedGame.trophies.filter(item => item.type === type).length;
    assert.strictEqual(seedGame.slug, 'god-of-war', 'God of War (2018) deve preservar slug god-of-war');
    assert.strictEqual(seedGame.is_verified, true, 'God of War (2018) deve ficar verified no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'God of War (2018) deve expor verification_status verified');
    assert.strictEqual(viewModel.editorial.statusBadge.label, 'Verificado', 'God of War (2018) deve exibir selo Verificado');
    assert.strictEqual(viewModel.editorial.statusBadge.detail, 'Guia revisado editorialmente.', 'God of War (2018) deve exibir mensagem publica revisada');
    assert.strictEqual(viewModel.trophies.length, 37, 'God of War (2018) deve manter 37 trofeus');
    assert.strictEqual(trophyCount('Platina'), 1, 'God of War (2018) deve manter 1 platina');
    assert.strictEqual(trophyCount('Ouro'), 5, 'God of War (2018) deve manter 5 ouros');
    assert.strictEqual(trophyCount('Prata'), 9, 'God of War (2018) deve manter 9 pratas');
    assert.strictEqual(trophyCount('Bronze'), 22, 'God of War (2018) deve manter 22 bronzes');
    assert.strictEqual(viewModel.missableCount, realMissables.length, 'God of War (2018) deve alinhar missableCount com is_missable');
    assert.strictEqual(viewModel.missableCount, 0, 'God of War (2018) deve ficar sem perdiveis definitivos');
    assert(!realMissables.some(trophy => trophy.type === 'Platina'), 'God of War (2018) nao deve contar platina como perdivel');
    assert.strictEqual(Boolean(seedGame.onlineRequired || seedGame.online_required), false, 'God of War (2018) deve manter online 0');
    assert.strictEqual(Boolean(seedGame.coopRequired || seedGame.coop_required), false, 'God of War (2018) deve manter coop 0');
    assert.strictEqual(seedGame.dlcRequired || seedGame.dlc_required || false, false, 'God of War (2018) deve manter DLC nao obrigatoria');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'God of War (2018) deve manter roadmap com 6 etapas');
    assert(viewModel.roadmapStages.every(step => Array.isArray(step.actions)), 'God of War (2018) deve ter actions reais no roadmap');
    assert.strictEqual(viewModel.nextActionModel.title, 'Avance a história em uma dificuldade confortável', 'God of War (2018) deve ter primeiro passo recomendado especifico');
    assert.notStrictEqual(viewModel.nextActionModel.title, 'Comece pelo roadmap', 'God of War (2018) nao deve usar primeiro passo generico');
    assert.strictEqual(viewModel.roadmapStages[0]?.title, 'Avance a história em uma dificuldade confortável', 'God of War (2018) deve iniciar roadmap pela historia em dificuldade confortavel');
    [
      ['Avance a história em uma dificuldade confortável', 'Campanha principal'],
      ['Explore reinos e abra atividades secundárias', 'Exploração'],
      ['Complete favores, coletáveis e mapas por região', 'Coletáveis'],
      ['Trabalhe Muspelheim e Niflheim em etapas próprias', 'Muspelheim / Niflheim'],
      ['Derrote Valkyries e finalize upgrades importantes', 'Valkyries'],
      ['Faça o cleanup final da platina base', 'Checklist final']
    ].forEach(([title, focus], index) => {
      assert.strictEqual(viewModel.roadmapStages[index]?.title, title, `God of War (2018) deve manter titulo editorial da etapa ${index + 1}`);
      assert.strictEqual(viewModel.roadmapStages[index]?.focus, focus, `God of War (2018) deve manter focus curto da etapa ${index + 1}`);
    });
    viewModel.roadmapStages.forEach((step, index) => {
      assert(!step.actions.some(action => normalizeText(action) === normalizeText(step.objective)), `God of War (2018) nao deve repetir objetivo literalmente nas actions da etapa ${index + 1}`);
    });
    const renderedRoadmapText = JSON.stringify(viewModel.roadmapStages);
    [
      'Avance a campanha principal',
      'Limpe regiões e favores',
      'limpe coletáveis por região, incluindo artefatos, Odin’s Rave',
      'limpe coletáveis por região, incluindo artefatos, Odin’s Ravens',
      'Odin’s Rave',
      'Odin’s Ravens',
      'Jötnar shrines',
      'Nornir Chests',
      'wayward spirits',
      'Trials of Muspelheim',
      'Workshop de Niflheim',
      'Prepare Muspelheim e Niflheim',
      'Feche valquírias no pós-game',
      'Feche cleanup e pendências finais',
      'jogue a história naturalmente, aprendendo combate, Atreus, Runic Attacks'
    ].forEach(text => {
      assert(!renderedRoadmapText.includes(text), `Roadmap renderizado de God of War (2018) nao deve conter texto antigo: ${text}`);
      assert(!normalizeText(renderedRoadmapText).includes(normalizeText(text)), `Roadmap renderizado de God of War (2018) nao deve conter texto antigo normalizado: ${text}`);
    });
    ['Avance a história em uma dificuldade confortável', 'Explore reinos e abra atividades secundárias', 'Complete favores, coletáveis e mapas por região', 'Trabalhe Muspelheim e Niflheim em etapas próprias', 'Derrote Valkyries e finalize upgrades importantes', 'Faça o cleanup final da platina base'].forEach(text => {
      assert(renderedRoadmapText.includes(text), `Roadmap renderizado de God of War (2018) deve conter etapa nova: ${text}`);
    });
    seedGame.trophies.forEach(trophy => {
      assert(trophy.name && !/^(undefined|null|\[object Object\])$/i.test(trophy.name), `${trophy.id} deve manter nome original em ingles`);
      assert(trophy.name_pt && !/^(undefined|null|\[object Object\])$/i.test(trophy.name_pt), `${trophy.id} deve ter nome principal em portugues`);
      assert(!String(trophy.name).includes(' / '), `${trophy.id} nao deve concatenar nomes no campo name`);
      const ptNames = [trophy.name_pt, trophy.namePt, trophy.titlePt, trophy.translatedName, trophy.localizedName, trophy.displayName, trophy.ptName, trophy.trophyNamePtBr]
        .filter(value => String(value || '').trim());
      assert(ptNames.length <= 1, `${trophy.id} nao deve ter duas fontes de nome em portugues`);
    });
    assert.strictEqual(seedGame.trophies.filter(trophy => trophy.name_pt && trophy.name_pt.trim()).length, 37, 'God of War (2018) deve ter titulo PT-BR nos 37 trofeus');
    assert(seedGame.trophies.some(trophy => trophy.name === 'Father and Son' && trophy.name_pt === 'Pai e Filho'), 'Father and Son deve exibir Pai e Filho como titulo PT-BR');
    assert(seedGame.trophies.some(trophy => trophy.name === 'Chooser of the Slain' && trophy.name_pt === 'Escolhedor dos Mortos'), 'Chooser of the Slain deve exibir Escolhedor dos Mortos como titulo PT-BR');
    assert(seedGame.trophies.some(trophy => trophy.name === 'Primordial' && trophy.name_pt === 'Primordial'), 'Primordial deve manter titulo PT-BR e nome original Primordial');
    [
      'Odin’s Ravens',
      "Odin's Ravens",
      'Jötnar shrines',
      'wayward spirits',
      'Witch’s Woods',
      "Witch's Woods",
      'Dragon of the Mountain',
      'Runic Attack Gem',
      'Runic Attack',
      'Descrição em revisão editorial.'
    ].forEach(text => {
      assert(!gowText.includes(text), `Checklist de God of War (2018) nao deve conter termo em ingles ou placeholder: ${text}`);
    });
    assert(gowText.includes('DLC fora da platina base'), 'God of War (2018) deve padronizar DLC fora da platina base');
    assert(routeItems.length <= 5, 'God of War (2018) deve renderizar no maximo 5 pontos de atencao');
    ['gow2018_chooser_of_the_slain', 'gow2018_darkness_and_fog', 'gow2018_fire_and_brimstone', 'gow2018_allfather_blinded', 'gow2018_treasure_hunter'].forEach(id => {
      assert(routeItems.some(item => item.id === id), `God of War (2018) deve incluir ponto de atencao ${id}`);
    });
    [
      'dados atuais do guia',
      'segundo os dados atuais do guia',
      'o guia nao aponta',
      'o guia n\u00e3o aponta',
      'lista atual',
      'quando validado',
      'em revisao',
      'em revis\u00e3o',
      'Base game sem DLCs',
      'Este trofeu esta marcado como spoiler',
      'Este trof\u00e9u est\u00e1 marcado como spoiler',
      'Revele os detalhes na lista completa',
      'Descri\u00e7\u00e3o em revis\u00e3o editorial.',
      '[object Object]',
      'Comece pelo roadmap',
      'Comece pela rota segura',
      'Continue a rota principal',
      'Passo 2',
      'title:',
      'focus:',
      'objective:',
      'actions:',
      'undefined'
    ].forEach(text => {
      assert(!gowText.includes(text), `God of War (2018) nao deve conter texto incorreto: ${text}`);
      assert(!normalizedGowText.includes(normalizeText(text)), `God of War (2018) nao deve conter texto incorreto normalizado: ${text}`);
    });
    assert(!/\bOdin[’']s Rave(?!ns)/.test(gowText), 'God of War (2018) nao deve conter Odin’s Rave truncado');
    ['Obtain all other trophies', 'Defend your home', 'Kill all of Odin', 'Defeat the nine Valkyries'].forEach(text => {
      assert(!gowText.includes(text), `God of War (2018) nao deve manter descricao em ingles: ${text}`);
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
    assert.strictEqual(seedGame.is_verified, true, 'Nioh 2 deve ficar Verificado no seed');
    assert.strictEqual(seedGame.verification_status, 'verified', 'Nioh 2 deve expor verification_status verified');
    assert.strictEqual(viewModel.editorial.statusBadge.label, 'Verificado', 'Nioh 2 deve exibir selo Verificado');
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
    const placeholderMatch = html.match(PLACEHOLDER_RE);
    assert(!placeholderMatch, `${slug} SSR nao deve renderizar placeholders: ${placeholderMatch?.[0] || ''} ${placeholderMatch ? html.slice(Math.max(0, placeholderMatch.index - 120), placeholderMatch.index + 160) : ''}`);
    assert(!/needs_trophy_list_validation|needs_missables_validation|needs_trophy_localization_check/.test(html), `${slug} nao deve expor warnings tecnicos publicamente`);
    assert(html.includes(seedGame.name), `${slug} SSR deve renderizar o nome do jogo`);
    if (seedGame.cover_image) assert(html.includes(seedGame.cover_image), `${slug} SSR deve renderizar cover_image`);
    const guideHeaderStart = html.indexOf('<div id="guideHeader"');
    const guideHeaderEnd = guideHeaderStart >= 0 ? html.indexOf('<div id="guideTabsSlot"', guideHeaderStart) : -1;
    const guideHeaderHtml = guideHeaderStart >= 0 && guideHeaderEnd > guideHeaderStart ? html.slice(guideHeaderStart, guideHeaderEnd) : '';
    assert(guideHeaderHtml.includes('atlas-guide-hero__summary') && !/atlas-guide-hero__summary[^>]*hidden/.test(guideHeaderHtml), `${slug} deve exibir um resumo editorial unico no hero`);
    assert.strictEqual((guideHeaderHtml.match(/atlas-guide-hero__summary/g) || []).length, 1, `${slug} deve manter somente um resumo editorial no hero`);
    assert.strictEqual((guideHeaderHtml.match(/class="atlas-editorial-badge /g) || []).length, 1, `${slug} deve renderizar um unico badge editorial no hero`);
    assert(!guideHeaderHtml.includes('atlas-editorial-trust__copy'), `${slug} nao deve repetir o status editorial em uma frase abaixo do badge`);
    assert(!/<small>Status<\/small>/.test(guideHeaderHtml), `${slug} nao deve repetir status como metrica do hero`);
    assert.strictEqual((guideHeaderHtml.match(/<h1\b/gi) || []).length, 1, `${slug} deve manter um unico H1 no cabecalho`);
    const headerDecorativeIcons = [...guideHeaderHtml.matchAll(/<i\b[^>]*class="[^"]*\bfa[srlb]?\b[^"]*"[^>]*>/gi)].map(match => match[0]);
    assert(headerDecorativeIcons.every(icon => /aria-hidden="true"/i.test(icon)), `${slug} deve ocultar icones decorativos do cabecalho da arvore acessivel`);
    assert(/class="atlas-btn atlas-btn-primary" data-guide-action="roadmap"[^>]*>[\s\S]*?Começar roadmap/.test(guideHeaderHtml), `${slug} deve usar Comecar roadmap como acao principal`);
    assert(/class="atlas-btn atlas-btn-secondary" data-guide-action="trophies"[^>]*>[\s\S]*?Abrir checklist/.test(guideHeaderHtml), `${slug} deve manter Abrir checklist como acao secundaria`);
    assert(guideHeaderHtml.includes('atlas-guide-hero__action--tertiary') && guideHeaderHtml.includes('Reportar problema'), `${slug} deve manter biblioteca e feedback como acoes terciarias`);
    const headerSummary = guideHeaderHtml.match(/<p class="atlas-guide-hero__summary">([\s\S]*?)<\/p>/)?.[1] || '';
    const firstEditorialParagraph = Array.isArray(seedGame.editorial_summary) ? String(seedGame.editorial_summary.find(Boolean) || '') : '';
    if (seedGame.runs_summary) {
      assert(headerSummary.includes(seedGame.runs_summary), `${slug} deve usar runs_summary existente como resumo curto do hero`);
    }
    assert(!firstEditorialParagraph || !headerSummary.includes(firstEditorialParagraph), `${slug} nao deve duplicar no hero o primeiro paragrafo do painel Resumo`);
    if (seedGame.last_reviewed_at || seedGame.lastReviewedAt) {
      assert(/atlas-editorial-badge[^>]*>[\s\S]*?Revisado em/.test(guideHeaderHtml), `${slug} deve incorporar a data existente ao badge editorial`);
    } else {
      assert(!guideHeaderHtml.includes('Revisado em'), `${slug} nao deve inventar data de revisao no badge editorial`);
    }
    const globalLayerNavHtml = html.match(/<nav id="guideLayerNav"[\s\S]*?<\/nav>/)?.[0] || '';
    const expectedGuideTabs = [
      ['summary', 'Resumo'],
      ['roadmap', 'Roadmap'],
      ['checklist', 'Checklist'],
      ['extras', 'Extras da Platina'],
      ['dlc', 'DLCs e 100%'],
      ['attention', 'Pontos de atenção']
    ];
    assert(globalLayerNavHtml.includes('role="tablist"'), `${slug} deve expor a navegacao principal como tablist`);
    assert.strictEqual((globalLayerNavHtml.match(/role="tab"/g) || []).length, 6, `${slug} deve manter exatamente seis abas principais`);
    assert(!/>\s*(?:FAQ|Comentários|Feedback)\s*</.test(globalLayerNavHtml), `${slug} nao deve manter FAQ, Comentarios ou Feedback no tablist`);
    const tabDecorativeIcons = [...globalLayerNavHtml.matchAll(/<i\b[^>]*>/gi)].map(match => match[0]);
    assert(tabDecorativeIcons.every(icon => /aria-hidden="true"/i.test(icon)), `${slug} deve ocultar icones decorativos das abas da arvore acessivel`);
    expectedGuideTabs.forEach(([tab, label], index) => {
      assert(globalLayerNavHtml.includes(`id="guideTabButton-${tab}"`), `${slug} deve manter id acessivel para a aba ${label}`);
      assert(globalLayerNavHtml.includes(`href="#guideTab-${tab}"`) && globalLayerNavHtml.includes(`aria-controls="guideTab-${tab}"`), `${slug} deve ligar a aba ${label} ao painel correto`);
      assert(globalLayerNavHtml.includes(`<span>${label}</span>`), `${slug} deve exibir a aba ${label}`);
      assert(globalLayerNavHtml.includes(`aria-selected="${index === 0 ? 'true' : 'false'}"`), `${slug} deve expor estado inicial da aba ${label}`);
      assert(new RegExp(`<section id="guideTab-${tab}"[^>]*data-guide-tab-panel="${tab}"[^>]*role="tabpanel"[^>]*aria-labelledby="guideTabButton-${tab}"`).test(html), `${slug} deve expor o painel acessivel ${label}`);
    });
    assert.strictEqual((html.match(/data-guide-tab-panel="(?:summary|roadmap|checklist|extras|dlc|attention)"/g) || []).length, 6, `${slug} deve manter seis paineis editoriais sem IDs duplicados`);
    const guideScopedStart = html.indexOf('<main');
    const guideScopedEnd = guideScopedStart >= 0 ? html.indexOf('</main>', guideScopedStart) : -1;
    const guidePageHtml = guideScopedStart >= 0 && guideScopedEnd > guideScopedStart ? html.slice(guideScopedStart, guideScopedEnd) : html;
    const guidePageIds = [...guidePageHtml.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    const duplicateGuidePageIds = [...new Set(guidePageIds.filter((id, index) => guidePageIds.indexOf(id) !== index))];
    assert.deepStrictEqual(duplicateGuidePageIds, [], `${slug} nao deve renderizar IDs duplicados no conteudo principal`);
    const allDecorativeIcons = [...html.matchAll(/<i\b[^>]*class="[^"]*\bfa[srlb]?\b[^"]*"[^>]*>/gi)].map(match => match[0]);
    assert(allDecorativeIcons.length > 0 && allDecorativeIcons.every(icon => /aria-hidden="true"/i.test(icon)), `${slug} deve ocultar todos os icones decorativos de font icon da arvore acessivel`);
    assert(!/[\uE000-\uF8FF]/.test(html), `${slug} nao deve conter caracteres privados de icon font no HTML publico`);
    const breadcrumbsIndex = html.indexOf('id="guideBreadcrumbs"');
    const headerIndex = html.indexOf('id="guideHeader"');
    const tabsIndex = html.indexOf('id="guideTabsSlot"');
    const contentIndex = html.indexOf('id="guideContent"');
    const summaryPanelIndex = html.indexOf('id="guideTab-summary"');
    const decisionStackIndex = html.indexOf('id="guideDecisionStack"');
    const summarySlotIndex = html.indexOf('id="guideSummarySlot"');
    assert(breadcrumbsIndex < headerIndex && headerIndex < tabsIndex && tabsIndex < contentIndex, `${slug} deve renderizar breadcrumbs, hero, tablist e conteudo nesta ordem`);
    assert(summaryPanelIndex < decisionStackIndex && decisionStackIndex < summarySlotIndex, `${slug} deve manter Como usar este guia dentro do painel Resumo`);
    assert(!html.includes('id="guideTab-details"'), `${slug} nao deve manter o antigo painel agregado details`);
    assert(html.indexOf('id="guideFaqSlot"') > html.indexOf('id="guideTab-attention"'), `${slug} deve posicionar FAQ depois dos paineis principais`);
    assert(html.indexOf('id="guideCommentsSlot"') > html.indexOf('id="guideFaqSlot"'), `${slug} deve posicionar Comentarios fora do tablist e abaixo do FAQ`);
    if (!seedGame.dlcCompletionGuide) {
      assert(html.includes('Este guia não possui conteúdo adicional de DLC ou 100% da lista cadastrado.'), `${slug} sem DLC deve manter a aba global com estado vazio coerente`);
    }
    if (slug === 'uncharted-legacy-of-thieves-collection') {
      assert(/atlas-editorial-badge[^>]*>[\s\S]*?Em revisão/.test(guideHeaderHtml), `${slug} deve preservar status editorial diferente de Verificado`);
      assert(!/atlas-editorial-badge[^>]*>[\s\S]*?Verificado/.test(guideHeaderHtml), `${slug} nao deve promover status editorial em revisao`);
    }
    if (slug === 'resident-evil-2-remake') {
      assert(!seedGame.last_reviewed_at && !seedGame.lastReviewedAt, 'Resident Evil 2 Remake nao deve possuir data de revisao nos dados atuais');
      assert(!guideHeaderHtml.includes('Revisado em'), 'Resident Evil 2 Remake nao deve inventar data de revisao no badge');
    }
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
    if (slug === 'resident-evil-5') {
      const guideScopedHtml = html.replace(/<aside[^>]*atlas-home-beta-notice[\s\S]*?<\/aside>/i, '');
      const structuredData = JSON.parse(html.match(/<script type="application\/ld\+json" id="gameStructuredData">([\s\S]*?)<\/script>/)?.[1] || '{}');
      const structuredGraph = Array.isArray(structuredData?.['@graph']) ? structuredData['@graph'] : [];
      const techArticle = structuredGraph.find(item => item?.['@type'] === 'TechArticle');
      const breadcrumbSchema = structuredGraph.find(item => item?.['@type'] === 'BreadcrumbList');
      const mainText = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const guideControllerSource = readProjectFile('public/js/app-guide-controller.js');
      const guideNavigationSource = `${guideControllerSource}\n${readProjectFile('public/js/ui-guide.js')}`;
      const layerNavHtml = html.match(/<nav id="guideLayerNav"[\s\S]*?<\/nav>/)?.[0] || '';
      const quickPlanHtml = html.match(/<div id="guideQuickPlan" class="atlas-guide-quick-plan"[\s\S]*?<\/ol><\/div>/)?.[0] || '';
      const usagePanelHtml = html.match(/<section id="guideUsagePanel"[\s\S]*?<\/section>/)?.[0] || '';
      const roadmapSlotStart = html.indexOf('<div id="guideRoadmapSlot">');
      const checklistTabStart = roadmapSlotStart >= 0 ? html.indexOf('<section id="guideTab-checklist"', roadmapSlotStart) : -1;
      const roadmapPanelStart = roadmapSlotStart >= 0 ? html.indexOf('<section id="guideRoadmapPanel"', roadmapSlotStart) : -1;
      const chapterRoutePanelStart = roadmapSlotStart >= 0 ? html.indexOf('<section id="guideChapterRoutePanel"', roadmapSlotStart) : -1;
      const chapterRoutePanelEnd = chapterRoutePanelStart >= 0 ? html.indexOf('</section>', chapterRoutePanelStart) : -1;
      const professionalPanelStart = roadmapSlotStart >= 0 ? html.indexOf('<section id="guideProfessionalAiPanel"', roadmapSlotStart) : -1;
      const professionalPanelEnd = professionalPanelStart >= 0 ? html.indexOf('</section>', professionalPanelStart) : -1;
      const roadmapPanelHtml = roadmapPanelStart >= 0 && checklistTabStart > roadmapPanelStart ? html.slice(roadmapPanelStart, checklistTabStart) : '';
      const chapterRoutePanelHtml = chapterRoutePanelStart >= 0 && chapterRoutePanelEnd > chapterRoutePanelStart ? html.slice(chapterRoutePanelStart, chapterRoutePanelEnd + '</section>'.length) : '';
      const professionalPanelHtml = professionalPanelStart >= 0 && professionalPanelEnd > professionalPanelStart ? html.slice(professionalPanelStart, professionalPanelEnd + '</section>'.length) : '';
      const farmPanelStart = roadmapSlotStart >= 0 ? html.indexOf('<section id="guideFarmRoutesPanel"', roadmapSlotStart) : -1;
      const farmPanelEnd = farmPanelStart >= 0 ? html.indexOf('</section>', farmPanelStart) : -1;
      const farmPanelHtml = farmPanelStart >= 0 && farmPanelEnd > farmPanelStart ? html.slice(farmPanelStart, farmPanelEnd + '</section>'.length) : '';
      const mythsPanelStart = roadmapSlotStart >= 0 ? html.indexOf('<section id="guideCommonMythsPanel"', roadmapSlotStart) : -1;
      const mythsPanelEnd = mythsPanelStart >= 0 ? html.indexOf('</section>', mythsPanelStart) : -1;
      const mythsPanelHtml = mythsPanelStart >= 0 && mythsPanelEnd > mythsPanelStart ? html.slice(mythsPanelStart, mythsPanelEnd + '</section>'.length) : '';
      const extrasPanelHtml = html.match(/<section id="guidePlatinumExtrasPanel"[\s\S]*?<section id="guideDlcCompletionPanel"/)?.[0] || '';
      const dlcPanelHtml = html.match(/<section id="guideDlcCompletionPanel"[\s\S]*?<section id="guideEditorialNotesPanel"/)?.[0] || '';
      const re5DlcAnchorIds = [
        're5-versus-dlc',
        're5-lost-in-nightmares-score-stars',
        're5-desperate-escape-agitator-majini'
      ];
      const guideIds = [...guideScopedHtml.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
      const guideIdSet = new Set(guideIds);
      const guideInternalHrefs = [...guideScopedHtml.matchAll(/<a\b[^>]*\shref="#([^"]+)"/g)].map(match => match[1]);
      assert.strictEqual(apiGame.trophies.length, 51, 'API de Resident Evil 5 deve manter 51 trofeus da platina base');
      assert.strictEqual(apiGame.roadmap.length, 7, 'API de Resident Evil 5 deve manter roadmap com 7 etapas');
      assert.strictEqual(apiGame.dlcRequired, false, 'API de Resident Evil 5 deve manter DLC nao obrigatoria explicita');
      assert.strictEqual(apiGame.onlineRequired, false, 'API de Resident Evil 5 deve manter online 0 explicito');
      assert.strictEqual(apiGame.coopRequired, false, 'API de Resident Evil 5 deve manter coop 0 explicito');
      assert.strictEqual(getTitle(html), 'Resident Evil 5 — Guia de Platina PS4 + DLCs | AtlasAchievement', 'Resident Evil 5 deve usar title SEO especifico');
      assert.strictEqual(getMeta(html, 'description'), 'Guia de Resident Evil 5 no PS4: roadmap, 51 troféus base, emblemas BSAA, tesouros, Professional e DLCs não obrigatórias para o 100% da lista.', 'Resident Evil 5 deve usar meta description especifica');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/resident-evil-5', 'Resident Evil 5 deve usar canonical de producao');
      assert(!getMeta(html, 'robots'), 'Resident Evil 5 verificado nao deve receber noindex');
      assert.strictEqual((html.match(/<h1\b/gi) || []).length, 1, 'Resident Evil 5 deve manter H1 unico');
      [
        'Roadmap',
        'Rota por Capítulo — Platina Base',
        'Professional e IA — Preparação para War Hero',
        'Rotas de Farm — dinheiro, pontos e upgrades',
        'Plano rápido',
        'Checklist da platina base',
        'Mitos e erros comuns',
        'Extras da Platina',
        'DLCs e 100% da Lista',
        'Perguntas frequentes'
      ].forEach(heading => {
        assert(html.includes(`<h2`) && new RegExp(`<h2[^>]*>${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/h2>`).test(html), `Resident Evil 5 deve manter H2 principal: ${heading}`);
      });
      assert(techArticle, 'Resident Evil 5 deve expor TechArticle no JSON-LD');
      assert.strictEqual(techArticle.headline, 'Resident Evil 5 — Guia de platina e troféus', 'TechArticle deve ter headline fiel');
      assert.strictEqual(techArticle.mainEntityOfPage?.['@id'], 'https://atlasachievement.com.br/jogo/resident-evil-5', 'TechArticle deve apontar para canonical');
      assert.strictEqual(techArticle.publisher?.name, 'AtlasAchievement', 'TechArticle deve identificar publisher');
      assert(/^\d{4}-\d{2}-\d{2}$/.test(techArticle.dateModified || ''), 'TechArticle deve expor dateModified valido');
      assert.deepStrictEqual(
        breadcrumbSchema?.itemListElement?.map(item => item.name),
        ['Início', 'Catálogo', 'Resident Evil 5'],
        'BreadcrumbList deve representar Inicio, Catalogo e Resident Evil 5'
      );
      assert(html.includes('property="og:image" content="https://cdn.cloudflare.steamstatic.com/steam/apps/21690/header.jpg"'), 'Open Graph de Resident Evil 5 deve usar imagem horizontal');
      assert(html.includes('property="og:image:width" content="460"') && html.includes('property="og:image:height" content="215"'), 'Open Graph deve declarar dimensoes reais da imagem');
      assert(html.includes('name="twitter:card" content="summary_large_image"'), 'Resident Evil 5 deve manter Twitter Card grande');
      assert(/<img[^>]+alt="Capa de Resident Evil 5"[^>]+width="600"[^>]+height="900"/.test(html), 'Capa de Resident Evil 5 deve ter alt e dimensoes definidos');
      ['resident evil 5', 'guia de platina e troféus', '1 campanha', 'professional', 'seleção de capítulos'].forEach(text => {
        assert(mainText.slice(0, 500).toLowerCase().includes(text), `Primeiros 500 caracteres devem sinalizar: ${text}`);
      });
      assert(html.includes('51 troféus') || html.includes('51 trofÃ©us'), 'Resident Evil 5 deve exibir 51 trofeus no topo');
      assert(html.includes('DLC não obrigatório') || html.includes('DLC nÃ£o obrigatÃ³rio'), 'Resident Evil 5 deve exibir DLC nao obrigatorio');
      assert(html.includes('Sem online obrigatório') || html.includes('Sem online obrigatÃ³rio'), 'Resident Evil 5 deve exibir sem online obrigatorio');
      assert(html.includes('Sem coop obrigatório') || html.includes('Sem coop obrigatÃ³rio'), 'Resident Evil 5 deve exibir sem coop obrigatorio');
      [
        ['Resumo', 'data-guide-tab-target="summary"', 'data-guide-action="summary"', 'href="#guideTab-summary"'],
        ['Roadmap', 'data-guide-tab-target="roadmap"', 'data-guide-action="roadmap"', 'href="#guideTab-roadmap"'],
        ['Checklist', 'data-guide-tab-target="checklist"', 'data-guide-action="trophies"', 'href="#guideTab-checklist"'],
        ['Extras da Platina', 'data-guide-tab-target="extras"', 'data-guide-action="extras"', 'href="#guideTab-extras"'],
        ['DLCs e 100%', 'data-guide-tab-target="dlc"', 'data-guide-action="dlcs"', 'href="#guideTab-dlc"'],
        ['Pontos de atenção', 'data-guide-tab-target="attention"', 'data-guide-action="attention"', 'href="#guideTab-attention"']
      ].forEach(([label, tabTarget, action, href]) => {
        const linkHtml = layerNavHtml.match(new RegExp(`<a[^>]*${tabTarget}[^>]*>[\\s\\S]*?<span>${label}<\\/span>[\\s\\S]*?<\\/a>`))?.[0] || '';
        assert(linkHtml.includes(action) && linkHtml.includes(href), `Navegacao de Resident Evil 5 deve abrir a secao correta: ${label}`);
      });
      ['summary', 'roadmap', 'checklist', 'extras', 'dlc', 'attention'].forEach(tab => {
        assert(guideScopedHtml.includes(`id="guideTab-${tab}"`) && guideScopedHtml.includes(`data-guide-tab-panel="${tab}"`), `Resident Evil 5 deve manter painel unico para a aba ${tab}`);
      });
      assert.strictEqual((guideScopedHtml.match(/id="guideTab-(?:summary|roadmap|checklist|extras|dlc|attention)"/g) || []).length, 6, 'Abas principais de Resident Evil 5 nao devem colidir em IDs');
      assert(usagePanelHtml.includes('Como usar este guia') && usagePanelHtml.includes('Se você quer... abra...'), 'Resident Evil 5 deve renderizar placa curta de navegacao');
      assert.strictEqual((usagePanelHtml.match(/<li>/g) || []).length, 3, 'Como usar este guia deve manter somente tres orientacoes');
      assert.strictEqual((usagePanelHtml.match(/<tr>/g) || []).length, 10, 'Tabela Se voce quer deve manter cabecalho e nove destinos');
      [
        ['Roadmap', 'roadmap', '#guideRoadmapPanel'],
        ['Plano rápido', 'quick', '#guideQuickPlan'],
        ['Checklist da platina base', 'trophies', '#guideChecklistPanel'],
        ['Extras da Platina', 'extras', '#guidePlatinumExtrasPanel'],
        ['Rota por Capítulo', 'chapter-route', '#guideChapterRoutePanel'],
        ['Professional e IA', 'professional', '#guideProfessionalAiPanel'],
        ['Rotas de Farm', 'farm', '#guideFarmRoutesPanel'],
        ['Mitos e erros comuns', 'myths', '#guideCommonMythsPanel'],
        ['DLCs e 100% da Lista', 'dlcs', '#guideDlcCompletionPanel']
      ].forEach(([label, action, href]) => {
        assert(usagePanelHtml.includes(`data-guide-action="${action}"`) && usagePanelHtml.includes(`href="${href}"`) && usagePanelHtml.includes(`>${label}</a>`), `Como usar este guia deve apontar corretamente para ${label}`);
      });
      assert(usagePanelHtml.includes('Depois da platina, abra DLCs e 100% da Lista.'), 'Como usar este guia deve tratar DLCs como pos-platina');
      assert.strictEqual((guideScopedHtml.match(/id="guideQuickPlan"/g) || []).length, 1, 'Plano rapido deve ter ancora unica');
      ['#guideQuickPlan', '#guideChapterRoutePanel', '#guideProfessionalAiPanel', '#guideFarmRoutesPanel', '#guideCommonMythsPanel'].forEach(selector => {
        assert(guideControllerSource.includes(selector), `Controlador de navegacao deve reconhecer o destino ${selector}`);
      });
      assert(!guideScopedHtml.includes('atlas-trophy-youtube-link'), 'Resident Evil 5 nao deve renderizar buscas automaticas de video em todos os trofeus');
      assert(!guideScopedHtml.includes('<span>YouTube</span>'), 'Resident Evil 5 nao deve exibir rotulo generico YouTube');
      assert(!guideScopedHtml.includes('Concluir YouTube'), 'Resident Evil 5 nao deve exibir rotulo generico Concluir YouTube');
      assert(!guideScopedHtml.includes('para a lista completa, abra Extras da Platina'), 'Extras da Platina nao deve ser chamado de lista completa');
      assert(guideScopedHtml.includes('para o checklist detalhado da platina base, abra Extras da Platina'), 'Roadmap deve usar microcopy precisa para Extras da Platina');
      assert(html.includes('/jogo/resident-evil-6'), 'Resident Evil 5 deve manter link interno natural para guia relacionado da franquia');
      const re5Sitemap = await fetchText(`${baseUrl}/sitemap.xml`);
      assert(re5Sitemap.includes('<loc>https://atlasachievement.com.br/jogo/resident-evil-5</loc>') || re5Sitemap.includes(`<loc>${baseUrl}/jogo/resident-evil-5</loc>`), 'Sitemap deve incluir canonical de Resident Evil 5');
      assert(/resident-evil-5<\/loc><lastmod>2026-07-11T/.test(re5Sitemap), 'Sitemap deve usar updated_at de Resident Evil 5 como lastmod');
      re5DlcAnchorIds.forEach(anchorId => {
        assert(guideIdSet.has(anchorId), `Resident Evil 5 deve renderizar anchor ${anchorId}`);
        assert.strictEqual(guideIds.filter(id => id === anchorId).length, 1, `Anchor ${anchorId} deve ser unico no HTML`);
        assert(dlcPanelHtml.includes(`id="${anchorId}"`), `Anchor ${anchorId} deve ficar em DLCs e 100% da Lista`);
        assert(!extrasPanelHtml.includes(`id="${anchorId}"`), `Anchor ${anchorId} nao deve ficar em Extras da Platina`);
        assert(guideInternalHrefs.includes(anchorId), `Resident Evil 5 deve ter link interno para #${anchorId}`);
        assert(guideNavigationSource.includes(anchorId), `Navegacao compartilhada deve reconhecer #${anchorId}`);
        assert(!re5Sitemap.includes(`#${anchorId}`), `Sitemap nao deve incluir fragmento #${anchorId}`);
      });
      const brokenGuideInternalHrefs = guideInternalHrefs.filter(targetId => !guideIdSet.has(targetId));
      assert.deepStrictEqual(brokenGuideInternalHrefs, [], 'Links internos com hash do guia RE5 devem apontar para IDs existentes');
      assert(dlcPanelHtml.includes('href="#re5-versus-dlc"') && /href="#re5-versus-dlc"[^>]*>[^<]*Versus[^<]*10/i.test(dlcPanelHtml), 'Intro de DLCs deve linkar Versus com anchor text descritivo');
      assert(dlcPanelHtml.includes('href="#re5-lost-in-nightmares-score-stars"') && /href="#re5-lost-in-nightmares-score-stars"[^>]*>[^<]*Lost in Nightmares[^<]*Score Stars/i.test(dlcPanelHtml), 'Intro de DLCs deve linkar Score Stars com anchor text descritivo');
      assert(dlcPanelHtml.includes('href="#re5-desperate-escape-agitator-majini"') && /href="#re5-desperate-escape-agitator-majini"[^>]*>[^<]*Desperate Escape[^<]*Agitator Majini/i.test(dlcPanelHtml), 'Intro de DLCs deve linkar Agitator Majini com anchor text descritivo');
      assert.strictEqual((quickPlanHtml.match(/<li>/g) || []).length, 7, 'Plano rapido de Resident Evil 5 deve renderizar 7 etapas');
      assert(quickPlanHtml.includes('Professional e revisão final') || quickPlanHtml.includes('Professional e revisÃ£o final'), 'Plano rapido de Resident Evil 5 deve incluir etapa final Professional');
      assert(quickPlanHtml.includes('Complete todos os capítulos no Professional') || quickPlanHtml.includes('Complete todos os capÃ­tulos no Professional'), 'Plano rapido de Resident Evil 5 deve descrever Professional e revisao final');
      assert((roadmapPanelHtml.match(/atlas-roadmap-step/g) || []).length >= 7 || (roadmapPanelHtml.match(/<article/g) || []).length >= 7, 'Roadmap SSR de Resident Evil 5 deve manter 7 etapas');
      ['BSAA Emblem #01', 'Checklist BSAA 01/30', 'Checklist tesouro 01/50', 'Score Star #01', 'Versus é um pacote DLC', 'Versus Ã© um pacote DLC'].forEach(text => {
        assert(!roadmapPanelHtml.includes(text), `Roadmap SSR de Resident Evil 5 nao deve exibir lista longa ou DLC: ${text}`);
      });
      assert(roadmapPanelHtml.includes('Extras da Platina'), 'Roadmap SSR de Resident Evil 5 deve apontar listas longas para Extras da Platina');
      assert(chapterRoutePanelHtml.includes('Rota por Capítulo — Platina Base') || chapterRoutePanelHtml.includes('Rota por CapÃ­tulo â€” Platina Base'), 'Resident Evil 5 deve renderizar Rota por Capitulo');
      assert.strictEqual((chapterRoutePanelHtml.match(/data-guide-section-toggle="chapter-route-/g) || []).length, 16, 'Rota por Capitulo de Resident Evil 5 deve renderizar 16 cards');
      ['Chapter 1-1', 'Chapter 3-1', 'Chapter 4-1', 'Chapter 5-3', 'Chapter 6-1', 'Chapter 6-3'].forEach(text => {
        assert(chapterRoutePanelHtml.includes(text), `Rota por Capitulo deve renderizar ${text}`);
      });
      ['White Egg', 'Brown Egg', 'Gold Egg', 'Soul Gem', 'Heart of Africa', 'Bad Blood', 'exige explosivo', 'Diamond (Marquise)'].forEach(text => {
        assert(chapterRoutePanelHtml.includes(text), `Rota por Capitulo deve preservar alerta/conteudo: ${text}`);
      });
      ['Versus', 'Lost in Nightmares', 'Desperate Escape', 'Score Star', 'Agitator Majini', 'Checklist BSAA 01/30', 'Checklist tesouro 01/50'].forEach(text => {
        assert(!chapterRoutePanelHtml.includes(text), `Rota por Capitulo nao deve exibir DLC ou lista longa: ${text}`);
      });
      assert.strictEqual(apiGame.professionalAiGuide?.blocks?.length, 6, 'API de Resident Evil 5 deve expor 6 blocos de Professional e IA');
      assert(professionalPanelHtml.includes('Professional e IA') && professionalPanelHtml.includes('War Hero'), 'Resident Evil 5 deve renderizar painel Professional e IA');
      assert.strictEqual((professionalPanelHtml.match(/data-guide-section-toggle="professional-ai-/g) || []).length, 6, 'Professional e IA deve renderizar 6 blocos recolhiveis');
      ['Quando fazer', 'Como liberar', 'Loadout recomendado', 'IA / parceiro', 'Checklist antes de iniciar War Hero', 'Ndesu/turret'].forEach(text => {
        assert(professionalPanelHtml.includes(text), `Professional e IA deve renderizar conteudo essencial: ${text}`);
      });
      assert(professionalPanelHtml.includes('Capítulos críticos') || professionalPanelHtml.includes('CapÃ­tulos crÃ­ticos'), 'Professional e IA deve renderizar Capitulos criticos');
      assert(professionalPanelHtml.includes('Rank S com Professional: são objetivos separados') || professionalPanelHtml.includes('Rank S com Professional: sÃ£o objetivos separados'), 'Professional e IA deve separar Rank S de Professional');
      ['Night Terrors', 'Run the Gauntlet', 'Lost in Nightmares', 'Desperate Escape', 'Versus', 'coop obrigatÃ³rio', 'online obrigatÃ³rio'].forEach(text => {
        assert(!professionalPanelHtml.includes(text), `Professional e IA SSR nao deve misturar DLC ou requisito indevido: ${text}`);
      });
      assert.strictEqual(apiGame.farmRoutesGuide?.routes?.length, 6, 'API de Resident Evil 5 deve expor 6 Rotas de Farm');
      assert(farmPanelHtml.includes('Rotas de Farm') && farmPanelHtml.includes('dinheiro, pontos e upgrades'), 'Resident Evil 5 deve renderizar painel Rotas de Farm');
      assert.strictEqual((farmPanelHtml.match(/<tr class="align-top">/g) || []).length, 6, 'Rotas de Farm SSR deve renderizar 6 linhas de rota');
      ['Rota', 'Melhor para', 'Quando usar', 'Cuidado'].forEach(text => {
        assert(farmPanelHtml.includes(text), `Rotas de Farm SSR deve renderizar coluna ${text}`);
      });
      ['Chapter 4-1', 'Soul Gem', 'Chapter 5-1', 'Lion Hearts', 'Reapers / Power Stones', 'Heart of Africa', 'Chapter 6-2', 'Exchange Points', 'Run sub-5h', 'Infinite Rocket Launcher'].forEach(text => {
        assert(farmPanelHtml.includes(text), `Rotas de Farm SSR deve renderizar ${text}`);
      });
      assert(farmPanelHtml.includes('Dinheiro da campanha compra armas e upgrades'), 'Rotas de Farm SSR deve explicar dinheiro da campanha');
      assert(farmPanelHtml.includes('pontos de Bonus Features/Exchange Points'), 'Rotas de Farm SSR deve explicar pontos de Bonus Features');
      assert(farmPanelHtml.includes('Mercenaries pode render pontos de Bonus Features'), 'Rotas de Farm SSR deve citar Mercenaries como opcional');
      assert(farmPanelHtml.includes('opcional') && (farmPanelHtml.includes('não é requisito') || farmPanelHtml.includes('nÃ£o Ã© requisito')), 'Rotas de Farm SSR deve manter Mercenaries/Infinite Rocket opcionais');
      assert(farmPanelHtml.includes('DLCs não entram nessa tabela de farm da platina base') || farmPanelHtml.includes('DLCs nÃ£o entram nessa tabela de farm da platina base'), 'Rotas de Farm SSR deve separar DLCs');
      assert(farmPanelHtml.includes('Não farme por farminho') || farmPanelHtml.includes('NÃ£o farme por farminho'), 'Rotas de Farm SSR deve renderizar texto curto obrigatorio');
      ['Night Terrors', 'Run the Gauntlet', 'Lost in Nightmares', 'Desperate Escape', 'Versus', 'Checklist BSAA 01/30', 'Checklist tesouro 01/50', 'Checklist upgrade 01/18', 'Não transformar', 'NÃ£o transformar'].forEach(text => {
        assert(!farmPanelHtml.includes(text), `Rotas de Farm SSR nao deve conter DLC, lista longa ou frase interna: ${text}`);
      });
      assert.strictEqual(apiGame.commonMythsGuide?.myths?.length, 8, 'API de Resident Evil 5 deve expor 8 Mitos e erros comuns');
      assert(mythsPanelHtml.includes('Mitos e erros comuns'), 'Resident Evil 5 deve renderizar painel Mitos e erros comuns');
      assert.strictEqual((mythsPanelHtml.match(/<dt class="font-bold text-white">Mito<\/dt>/g) || []).length, 8, 'Mitos e erros comuns SSR deve renderizar 8 campos Mito');
      assert.strictEqual((mythsPanelHtml.match(/<dt class="font-bold text-white">Correção<\/dt>/g) || []).length, 8, 'Mitos e erros comuns SSR deve renderizar 8 campos Correcao');
      assert.strictEqual((mythsPanelHtml.match(/<dt class="font-bold text-white">Onde conferir<\/dt>/g) || []).length, 8, 'Mitos e erros comuns SSR deve renderizar 8 campos Onde conferir');
      ['Versus', '51 base + 20 DLC', 'Hand Grenade', 'Proximity Bomb', 'M93R', 'Hydra', 'S&amp;W M500', 'Score Stars', 'BSAA Emblems', 'Rotten Egg', 'Night Terrors', 'Run the Gauntlet'].forEach(text => {
        assert(mythsPanelHtml.includes(text), `Mitos e erros comuns SSR deve renderizar ${text}`);
      });
      ['Checklist BSAA 01/30', 'Checklist tesouro 01/50', 'Checklist upgrade 01/18', 'Checklist Brutal', 'guia brutal', '100% da base', 'Checklist Completo', 'NOME ORIGINAL', '[object Object]', 'Não dizer', 'Não colocar', 'Não misturar', 'Não marcar', 'Não tratar', 'Não transformar'].forEach(text => {
        assert(!mythsPanelHtml.includes(text), `Mitos e erros comuns SSR nao deve conter lista longa ou termo proibido: ${text}`);
      });
      assert(extrasPanelHtml.includes('Platina base'), 'Extras da Platina de Resident Evil 5 deve ser marcado como platina base');
      assert(extrasPanelHtml.includes('8 categoria(s)'), 'Extras da Platina de Resident Evil 5 deve renderizar 8 categorias');
      assert(extrasPanelHtml.includes('BSAA Emblems') && extrasPanelHtml.includes('Tesouros') && extrasPanelHtml.includes('Troféus situacionais'), 'Extras da Platina de Resident Evil 5 deve manter categorias operacionais da base');
      ['Vídeo: BSAA Emblems — 30 localizações', 'Vídeo: BSAA Emblem #29 — Chapter 6-1', 'Vídeo: Heart of Africa — Chapter 5-3'].forEach(label => {
        assert(extrasPanelHtml.includes(label), `Extras da Platina deve renderizar link claro: ${label}`);
      });
      assert(!extrasPanelHtml.includes('Vídeo: Lost in Nightmares') && !extrasPanelHtml.includes('Vídeo: Desperate Escape'), 'Extras da Platina nao deve receber links de DLC');
      assert(dlcPanelHtml.includes('DLCs e 100% da Lista'), 'Resident Evil 5 deve renderizar secao separada de DLCs e 100% da Lista');
      assert(dlcPanelHtml.includes('Versus') && dlcPanelHtml.includes('Lost in Nightmares') && dlcPanelHtml.includes('Desperate Escape'), 'Resident Evil 5 deve manter os 3 pacotes DLC separados');
      assert(dlcPanelHtml.includes('Parceiro humano pode ajudar em Professional e Kung Fu Fighting') && !dlcPanelHtml.includes('Coop/parceiro humano pode ajudar'), 'DLCs SSR deve usar microcopy publica de parceiro humano em Lost in Nightmares');
      assert(html.includes('Observações finais') || html.includes('ObservaÃ§Ãµes finais'), 'FAQ de Resident Evil 5 deve usar rotulo publico Observacoes finais');
      assert(!guideScopedHtml.includes('Notas editoriais'), 'Resident Evil 5 nao deve exibir rotulo publico Notas editoriais');
      assert(dlcPanelHtml.includes('20 troféus') || dlcPanelHtml.includes('20 trofÃ©us'), 'DLCs de Resident Evil 5 devem manter total DLC de 20 trofeus');
      assert.strictEqual(apiGame.dlcCompletionGuide?.packages?.find(pack => pack.id === 'versus')?.roadmap?.length, 3, 'API de RE5 deve expor 3 sessoes de boost de Versus');
      assert(dlcPanelHtml.includes('Ordem recomendada para o 100% completo'), 'DLCs SSR deve renderizar ordem recomendada para 100% completo');
      assert(dlcPanelHtml.includes('Rota de boost recomendada'), 'DLCs SSR deve renderizar rota de boost de Versus');
      assert(dlcPanelHtml.includes('Sessão 1') || dlcPanelHtml.includes('SessÃ£o 1'), 'DLCs SSR deve renderizar Sessao 1 de Versus');
      assert(dlcPanelHtml.includes('15 vitórias em Slayers') || dlcPanelHtml.includes('15 vitÃ³rias em Slayers'), 'DLCs SSR deve manter 15 vitorias de Slayers');
      assert(dlcPanelHtml.includes('50 eliminações físicas') || dlcPanelHtml.includes('50 eliminaÃ§Ãµes fÃ­sicas'), 'DLCs SSR deve manter 50 eliminacoes fisicas');
      assert.strictEqual((dlcPanelHtml.match(/Rota segura/g) || []).length >= 2, true, 'DLCs SSR deve renderizar Rota segura em Lost e Desperate');
      assert(dlcPanelHtml.includes('18 Score Stars') && dlcPanelHtml.includes('BSAA Emblems'), 'DLCs SSR deve separar Score Stars de BSAA Emblems');
      assert(dlcPanelHtml.includes('150 inimigos em uma') || dlcPanelHtml.includes('150 kills'), 'DLCs SSR deve manter 150 kills em uma jogada');
      assert(dlcPanelHtml.includes('3 Agitator Majini'), 'DLCs SSR deve manter 3 Agitator Majini');
      assert(dlcPanelHtml.includes('Vídeo: Lost in Nightmares — 18 Score Stars'), 'Lost in Nightmares deve renderizar link claro de Score Stars');
      assert(dlcPanelHtml.includes('Vídeo: Desperate Escape — 3 Agitator Majini'), 'Desperate Escape deve renderizar link claro de Agitator Majini');
      assert.strictEqual((guideScopedHtml.match(/<a href="https:\/\/www\.youtube\.com\/watch\?v=/g) || []).length, 5, 'Resident Evil 5 deve manter exatamente cinco links de video editoriais');
      ['>YouTube<', '>Concluir YouTube<', '>Ver vídeo<', '>Vídeo:<'].forEach(label => {
        assert(!guideScopedHtml.includes(label), `Resident Evil 5 nao deve renderizar rotulo generico: ${label}`);
      });
      ['30 vitórias', '30 vitÃ³rias', '100 eliminações', '100 eliminaÃ§Ãµes'].forEach(text => {
        assert(!dlcPanelHtml.includes(text), `DLCs SSR nao deve usar requisito antigo: ${text}`);
      });
      ['Checklist completo', 'Checklist Brutal', 'guia brutal', '100% da base', 'NOME ORIGINAL', '[object Object]', 'Não dizer', 'Não colocar', 'Não misturar', 'Não marcar', 'Não tratar', 'Não transformar'].forEach(text => {
        assert(!guideScopedHtml.includes(text), `Resident Evil 5 SSR nao deve exibir texto interno ou rotulo proibido: ${text}`);
      });
      assert(!guideScopedHtml.includes('Use Extras da Platina para limpar ovos e troféus situacionais por Chapter Select.'), 'Resident Evil 5 SSR nao deve repetir frase antiga em Trofeus situacionais');
      assert(!/>\s*null\s*</i.test(html), 'Resident Evil 5 SSR nao deve exibir null visivel');
    }
    if (slug === 'resident-evil') {
      const guideScopedHtml = html.replace(/<aside[^>]*atlas-home-beta-notice[\s\S]*?<\/aside>/i, '');
      const normalizedScopedHtml = normalizeText(guideScopedHtml);
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable === true);
      const apiRoadmapText = JSON.stringify(apiGame.roadmap);
      const roadmapPanelHtml = html.match(/<section id="guideRoadmapPanel"[\s\S]*?<\/section>/)?.[0] || '';
      const summaryHtml = html.match(/<section id="guideSummaryActions"[\s\S]*?<\/section>/)?.[0] || '';
      assert.strictEqual(apiGame.slug, 'resident-evil', 'API de Resident Evil deve usar slug real');
      assert.strictEqual(apiGame.is_verified, true, 'API de Resident Evil deve ficar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Resident Evil deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 45, 'API de Resident Evil deve manter 45 trofeus');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Platina').length, 1, 'API de Resident Evil deve manter 1 platina');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Ouro').length, 1, 'API de Resident Evil deve manter 1 ouro');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Prata').length, 15, 'API de Resident Evil deve manter 15 pratas');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Bronze').length, 28, 'API de Resident Evil deve manter 28 bronzes');
      assert.strictEqual(apiGame.missable_count, apiMissables.length, 'API de Resident Evil deve alinhar missable_count com checklist');
      assert.strictEqual(apiGame.missable_count, 17, 'API de Resident Evil deve manter 17 perdiveis por run');
      assert(!apiMissables.some(trophy => trophy.type === 'Platina'), 'API de Resident Evil nao deve contar platina como perdivel');
      assert.strictEqual(apiGame.onlineRequired, false, 'API de Resident Evil deve manter online 0 explicito');
      assert.strictEqual(apiGame.coopRequired, false, 'API de Resident Evil deve manter coop 0 explicito');
      assert.strictEqual(apiGame.dlcRequired, false, 'API de Resident Evil deve manter DLC nao obrigatoria explicita');
      assert.strictEqual(apiGame.newGamePlusRequired, false, 'API de Resident Evil nao deve exigir NG+');
      assert.strictEqual(apiGame.difficultyTrophiesRequired, true, 'API de Resident Evil deve marcar dificuldade/modos obrigatorios');
      assert(apiGame.dlc_scope.includes('DLC fora da platina base'), 'Resident Evil deve padronizar DLC fora da platina base');
      assert.strictEqual(apiGame.roadmap.length, 6, 'API de Resident Evil deve retornar roadmap de 6 etapas');
      assert(apiGame.roadmap.every(step => Array.isArray(step.actions) && step.actions.length >= 4), 'API de Resident Evil deve retornar actions reais no roadmap');
      ['Faça uma primeira run segura aprendendo a mansão', 'Complete as rotas de Jill e Chris', 'Trabalhe Hard, Real Survival e Invisible Enemy', 'Faça runs condicionais: sem salvar, faca-only e speedrun', 'Limpe armas, roupas, mapas e objetivos específicos', 'Finalize a checklist da platina base'].forEach(text => {
        assert(apiRoadmapText.includes(text), `API roadmap de Resident Evil deve conter etapa nova: ${text}`);
        assert(roadmapPanelHtml.includes(text), `Roadmap SSR de Resident Evil deve conter etapa nova: ${text}`);
      });
      assert(html.includes('Resident Evil'), 'Resident Evil deve renderizar nome no SSR');
      assert(html.includes('Verificado'), 'Resident Evil deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'Resident Evil deve renderizar mensagem publica revisada');
      assert(html.includes('DLC fora da platina base'), 'Resident Evil deve exibir DLC fora da platina base');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 4, 'Resumo da platina de Resident Evil deve ter mais de um paragrafo');
      assert(summaryHtml.includes('Este guia de platina de Resident Evil foi pensado') && summaryHtml.includes('DLCs e extras ficam fora da platina base'), 'Resumo da platina de Resident Evil deve renderizar texto editorial completo');
      assert(summaryHtml.includes('Faça uma primeira run segura aprendendo a mansão, usando saves e entendendo puzzles, inventário, rotas e resgates antes de otimizar.'), 'Resumo da platina de Resident Evil deve preservar primeiro passo recomendado');
      assert(html.includes('<h4>Platina Ensanguentada!</h4>') && html.includes('NOME ORIGINAL:</span>Platinum'), 'Checklist de Resident Evil deve renderizar titulo PT-BR com nome original');
      assert((html.match(/NOME ORIGINAL:<\/span>/g) || []).length >= 45, 'Checklist de Resident Evil deve exibir NOME ORIGINAL nos 45 trofeus');
      apiGame.trophies.forEach(trophy => {
        assert(trophy.name && trophy.trophyNameOriginal === trophy.name, `${trophy.id} deve expor nome original`);
        assert(trophy.name_pt && trophy.trophyNamePtBr === trophy.name_pt, `${trophy.id} deve expor titulo PT-BR`);
        assert(!String(trophy.name_pt).includes(' / '), `${trophy.id} nao deve concatenar titulo PT-BR`);
        assert(!/Descrição em revisão editorial\.|null|undefined|\[object Object\]/i.test(`${trophy.name_pt} ${trophy.name} ${trophy.description}`), `${trophy.id} nao deve expor placeholder`);
      });
      ['Finish the game', 'Complete the game', 'Defeat a zombie', 'Save Chris', 'Save Jill', 'Get killed', 'Obtain all weapons', 'Burn up two zombies', 'Descrição em revisão editorial.'].forEach(text => {
        assert(!html.includes(text), `HTML publico de Resident Evil nao deve conter descricao em ingles ou placeholder: ${text}`);
      });
      [
        'dados atuais do guia',
        'segundo os dados atuais do guia',
        'o guia não aponta',
        'quando validado',
        'em revisão editorial',
        'guia aguardando validação',
        'informação pendente',
        'Comece pelo roadmap',
        'Avance pela campanha',
        'Prossiga pela rota planejada',
        'Base game sem DLCs',
        '[object Object]',
        'undefined',
        'só faça',
        'resgaté'
      ].forEach(text => {
        assert(!guideScopedHtml.includes(text), `Resident Evil SSR nao deve exibir: ${text}`);
        if (!['só faça', 'resgaté'].includes(text)) {
          assert(!normalizedScopedHtml.includes(normalizeText(text)), `Resident Evil SSR nao deve exibir texto normalizado: ${text}`);
        }
      });
      assert(!/>\s*null\s*</i.test(html), 'Resident Evil SSR nao deve exibir null visivel');
      assert([`${baseUrl}/jogo/resident-evil`, 'https://atlasachievement.com.br/jogo/resident-evil'].includes(getCanonical(html)), 'canonical de Resident Evil deve manter slug publico correto');
    }
    if (slug === 'dead-cells') {
      const guideScopedHtml = html.replace(/<aside[^>]*atlas-home-beta-notice[\s\S]*?<\/aside>/i, '');
      const normalizedScopedHtml = normalizeText(guideScopedHtml);
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable === true);
      const apiRoadmapText = JSON.stringify(apiGame.roadmap);
      const roadmapPanelHtml = html.match(/<section id="guideRoadmapPanel"[\s\S]*?<\/section>/)?.[0] || '';
      const summaryHtml = html.match(/<section id="guideSummaryActions"[\s\S]*?<\/section>/)?.[0] || '';
      const mythsPanelStart = html.indexOf('<section id="mitos-e-erros-comuns"');
      const mythsPanelEnd = mythsPanelStart >= 0 ? html.indexOf('</section>', mythsPanelStart) : -1;
      const checklistTabStart = mythsPanelStart >= 0 ? html.indexOf('<section id="guideTab-checklist"', mythsPanelStart) : -1;
      const mythsPanelHtml = mythsPanelStart >= 0 && mythsPanelEnd > mythsPanelStart ? html.slice(mythsPanelStart, mythsPanelEnd + '</section>'.length) : '';
      const guideIds = [...guideScopedHtml.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
      assert.strictEqual(apiGame.slug, 'dead-cells', 'API de Dead Cells deve usar slug real');
      assert.strictEqual(apiGame.is_verified, true, 'API de Dead Cells deve ficar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Dead Cells deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 54, 'API de Dead Cells deve manter 54 trofeus');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Platina').length, 1, 'API de Dead Cells deve manter 1 platina');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Ouro').length, 1, 'API de Dead Cells deve manter 1 ouro');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Prata').length, 11, 'API de Dead Cells deve manter 11 pratas');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Bronze').length, 41, 'API de Dead Cells deve manter 41 bronzes');
      assert.strictEqual(apiGame.missable_count, apiMissables.length, 'API de Dead Cells deve alinhar missable_count com checklist');
      assert.strictEqual(apiGame.missable_count, 0, 'API de Dead Cells deve manter missable_count 0');
      assert.strictEqual(apiGame.onlineRequired, false, 'API de Dead Cells deve manter online 0 explicito');
      assert.strictEqual(apiGame.coopRequired, false, 'API de Dead Cells deve manter coop 0 explicito');
      assert.strictEqual(apiGame.dlcRequired, false, 'API de Dead Cells deve manter DLC nao obrigatoria explicita');
      assert.strictEqual(apiGame.newGamePlusRequired, false, 'API de Dead Cells nao deve exigir NG+');
      assert.strictEqual(apiGame.difficultyTrophiesRequired, true, 'API de Dead Cells deve marcar dificuldade obrigatoria por BSC');
      assert(apiGame.dlc_scope.includes('DLC fora da platina base'), 'Dead Cells deve padronizar DLC fora da platina base');
      assert.strictEqual(apiGame.roadmap.length, 6, 'API de Dead Cells deve retornar roadmap de 6 etapas');
      assert(apiGame.roadmap.every(step => Array.isArray(step.actions) && step.actions.length >= 4), 'API de Dead Cells deve retornar actions reais no roadmap');
      ['Aprenda o ciclo de runs e desbloqueie upgrades permanentes', 'Abra rotas, biomas e chefes principais', 'Trabalhe troféus de chefes e objetivos de execução', 'Avance pelas Boss Stem Cells e dificuldade crescente', 'Limpe blueprints, desafios e objetivos específicos', 'Finalize a checklist da platina base'].forEach(text => {
        assert(apiRoadmapText.includes(text), `API roadmap de Dead Cells deve conter etapa nova: ${text}`);
        assert(roadmapPanelHtml.includes(text), `Roadmap SSR de Dead Cells deve conter etapa nova: ${text}`);
      });
      assert(html.includes('Dead Cells'), 'Dead Cells deve renderizar nome no SSR');
      assert(html.includes('Verificado'), 'Dead Cells deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'Dead Cells deve renderizar mensagem publica revisada');
      assert(html.includes('DLC fora da platina base'), 'Dead Cells deve exibir DLC fora da platina base');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 5, 'Resumo da platina de Dead Cells deve ter mais de um paragrafo');
      assert(summaryHtml.includes('A platina de Dead Cells é baseada em repetição de runs') && summaryHtml.includes('DLCs e expansões ficam fora da platina base'), 'Resumo da platina de Dead Cells deve renderizar texto editorial completo');
      assert(summaryHtml.includes('Comece com runs exploratórias: aprenda inimigos, libere runas, melhore frascos, entregue blueprints úteis ao Collector e não force chefes sem dano ou Cursed Sword cedo.'), 'Resumo da platina de Dead Cells deve preservar primeiro passo recomendado');
      assert(html.includes('<h4>Precisa de uma Mão?? Bahaha!</h4>') && html.includes('NOME ORIGINAL:</span>Do You Need... A Hand?? Bahaha!'), 'Checklist de Dead Cells deve renderizar titulo PT-BR com nome original');
      assert((html.match(/NOME ORIGINAL:<\/span>/g) || []).length >= 54, 'Checklist de Dead Cells deve exibir NOME ORIGINAL nos 54 trofeus');
      ['Unlock all trophies', 'Beat the Hand of the King', 'Finish the game with', 'Reach the Ramparts', 'Absorb your', 'Complete a Daily Challenge', 'Descrição em revisão editorial.'].forEach(text => {
        assert(!html.includes(text), `HTML publico de Dead Cells nao deve conter descricao em ingles ou placeholder: ${text}`);
      });
      [
        'dados atuais do guia',
        'segundo os dados atuais do guia',
        'o guia não aponta',
        'quando validado',
        'em revisão editorial',
        'guia aguardando validação',
        'informação pendente',
        'Comece pelo roadmap',
        'Avance pela campanha',
        'Prossiga pela rota planejada',
        'Base game sem DLCs',
        '[object Object]',
        'undefined'
      ].forEach(text => {
        assert(!guideScopedHtml.includes(text), `Dead Cells SSR nao deve exibir: ${text}`);
        assert(!normalizedScopedHtml.includes(normalizeText(text)), `Dead Cells SSR nao deve exibir texto normalizado: ${text}`);
      });
      assert(!/>\s*null\s*</i.test(html), 'Dead Cells SSR nao deve exibir null visivel');
      assert([`${baseUrl}/jogo/dead-cells`, 'https://atlasachievement.com.br/jogo/dead-cells'].includes(getCanonical(html)), 'canonical de Dead Cells deve manter slug publico correto');
    }
    if (slug === 'resident-evil-2-remake') {
      const guideScopedHtml = html.replace(/<aside[^>]*atlas-home-beta-notice[\s\S]*?<\/aside>/i, '');
      const normalizedScopedHtml = normalizeText(guideScopedHtml);
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable === true);
      const apiRoadmapText = JSON.stringify(apiGame.roadmap);
      const roadmapPanelHtml = html.match(/<section id="guideRoadmapPanel"[\s\S]*?<\/section>/)?.[0] || '';
      const summaryHtml = html.match(/<section id="guideSummaryActions"[\s\S]*?<\/section>/)?.[0] || '';
      const roadmapSlotStart = html.indexOf('<div id="guideRoadmapSlot">');
      const checklistTabStart = roadmapSlotStart >= 0 ? html.indexOf('<section id="guideTab-checklist"', roadmapSlotStart) : -1;
      const mythsPanelStart = roadmapSlotStart >= 0 ? html.indexOf('<section id="mitos-e-erros-comuns"', roadmapSlotStart) : -1;
      const mythsPanelEnd = mythsPanelStart >= 0 ? html.indexOf('</section>', mythsPanelStart) : -1;
      const mythsPanelHtml = mythsPanelStart >= 0 && mythsPanelEnd > mythsPanelStart ? html.slice(mythsPanelStart, mythsPanelEnd + '</section>'.length) : '';
      const guideIds = [...guideScopedHtml.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
      assert.strictEqual(apiGame.slug, 'resident-evil-2-remake', 'API de Resident Evil 2 Remake deve usar slug real');
      assert.strictEqual(apiGame.is_verified, true, 'API de Resident Evil 2 Remake deve ficar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Resident Evil 2 Remake deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 42, 'API de Resident Evil 2 Remake deve manter 42 trofeus');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Platina').length, 1, 'API de Resident Evil 2 Remake deve manter 1 platina');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Ouro').length, 4, 'API de Resident Evil 2 Remake deve manter 4 ouros');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Prata').length, 9, 'API de Resident Evil 2 Remake deve manter 9 pratas');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Bronze').length, 28, 'API de Resident Evil 2 Remake deve manter 28 bronzes');
      assert.strictEqual(apiGame.missable_count, apiMissables.length, 'API de Resident Evil 2 Remake deve alinhar missable_count com checklist');
      assert.strictEqual(apiGame.missable_count, 28, 'API de Resident Evil 2 Remake deve manter 28 perdiveis por run');
      assert.strictEqual(apiGame.onlineRequired, false, 'API de Resident Evil 2 Remake deve manter online 0 explicito');
      assert.strictEqual(apiGame.coopRequired, false, 'API de Resident Evil 2 Remake deve manter coop 0 explicito');
      assert.strictEqual(apiGame.dlcRequired, false, 'API de Resident Evil 2 Remake deve manter DLC nao obrigatoria explicita');
      assert.strictEqual(apiGame.newGamePlusRequired, false, 'Resident Evil 2 Remake nao deve exigir NG+');
      assert.strictEqual(apiGame.difficultyTrophiesRequired, true, 'API de Resident Evil 2 Remake deve marcar dificuldade obrigatoria');
      assert(apiGame.dlc_scope.includes('DLC fora da platina base') && apiGame.dlc_scope.includes('The Ghost Survivors'), 'Resident Evil 2 Remake deve padronizar DLC/extras fora da platina base');
      assert.strictEqual(apiGame.roadmap.length, 8, 'API de Resident Evil 2 Remake deve retornar roadmap de 8 etapas');
      assert(apiGame.roadmap.every(step => Array.isArray(step.actions) && step.actions.length >= 3), 'API de Resident Evil 2 Remake deve retornar actions reais no roadmap');
      assert.strictEqual(apiGame.chapterRouteGuide?.campaignPlan?.runs?.length, 7, 'API de Resident Evil 2 Remake deve preservar exatamente 7 runs no plano principal');
      assert.strictEqual(apiGame.commonMythsGuide?.myths?.length, 9, 'API de Resident Evil 2 Remake deve expor exatamente 9 mitos');
      ['Faça uma primeira campanha segura aprendendo o R.P.D.', 'Complete Leon, Claire e 2nd Run para o final verdadeiro', 'Resolva coletáveis base e limpeza de exploração', 'Faça S rank com Leon e Claire', 'Complete Hardcore com Leon e Claire', 'Faça runs condicionais sem cura, sem baú e com poucos passos', 'Complete The 4th Survivor para Grim Reaper', 'Finalize a checklist da platina base'].forEach(text => {
        assert(apiRoadmapText.includes(text), `API roadmap de Resident Evil 2 Remake deve conter etapa nova: ${text}`);
        assert(roadmapPanelHtml.includes(text), `Roadmap SSR de Resident Evil 2 Remake deve conter etapa nova: ${text}`);
      });
      assert(html.includes('Resident Evil 2 Remake'), 'Resident Evil 2 Remake deve renderizar nome no SSR');
      assert(html.includes('Verificado'), 'Resident Evil 2 Remake deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'Resident Evil 2 Remake deve renderizar mensagem publica revisada');
      assert(html.includes('DLC fora da platina base'), 'Resident Evil 2 Remake deve exibir DLC fora da platina base');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 1, 'Resumo da platina de Resident Evil 2 Remake deve renderizar conteudo editorial');
      assert(html.includes('múltiplas campanhas com Leon e Claire') && html.includes('3 extras de The Ghost Survivors e Another Survivor / Chasing Jill'), 'Resumo da platina de Resident Evil 2 Remake deve renderizar texto editorial completo');
      assert(summaryHtml.includes('Plano rápido — rota compacta da platina') && summaryHtml.includes('Run 1 — Leon, 1st Run'), 'Resumo da platina de Resident Evil 2 Remake deve preservar o inicio do plano de sete runs');
      assert(html.includes('Faça uma primeira campanha segura aprendendo o R.P.D.'), 'Resident Evil 2 Remake deve renderizar primeiro passo recomendado especifico');
      assert.strictEqual((html.match(/id="mitos-e-erros-comuns"/g) || []).length, 1, 'Resident Evil 2 Remake deve renderizar uma unica secao Mitos e erros comuns');
      assert(mythsPanelHtml.includes('<h2 class="text-xl md:text-2xl font-extrabold tracking-tight mt-2">Mitos e erros comuns</h2>'), 'Mitos de Resident Evil 2 Remake devem usar H2 local');
      assert(mythsPanelHtml.includes('>9 mitos</span>') && !mythsPanelHtml.includes('mito(s)'), 'Contador de Mitos de Resident Evil 2 Remake deve usar pluralizacao natural');
      assert.strictEqual((mythsPanelHtml.match(/<dt class="font-bold text-white">Mito<\/dt>/g) || []).length, 9, 'Mitos de Resident Evil 2 Remake devem renderizar 9 campos Mito');
      assert.strictEqual((mythsPanelHtml.match(/<dt class="font-bold text-white">Correção<\/dt>/g) || []).length, 9, 'Mitos de Resident Evil 2 Remake devem renderizar 9 campos Correcao');
      assert.strictEqual((mythsPanelHtml.match(/<dt class="font-bold text-white">Onde conferir<\/dt>/g) || []).length, 9, 'Mitos de Resident Evil 2 Remake devem renderizar 9 campos Onde conferir');
      ['Hardcore, S rank e armas infinitas', 'Runs de restrição — Minimalist', 'The 4th Survivor — Grim Reaper'].forEach(label => {
        assert(mythsPanelHtml.includes(label), `Onde conferir deve usar heading real: ${label}`);
      });
      assert(!mythsPanelHtml.includes('href="#guideChapterRoutePanel"'), 'Onde conferir nao deve apontar subsecoes do RE2 para o inicio generico do painel');
      assert(!/<a\b[^>]*>Hardcore, S rank e armas infinitas<\/a>|<a\b[^>]*>Runs de restrição — Minimalist<\/a>|<a\b[^>]*>The 4th Survivor — Grim Reaper<\/a>/.test(mythsPanelHtml), 'Subsecoes sem anchor confiavel devem ser renderizadas como texto');
      assert.strictEqual((mythsPanelHtml.match(/>Mito [1-9]<\/div>/g) || []).length, 9, 'Mitos de Resident Evil 2 Remake devem ter uma unica numeracao por card');
      assert(!/>Mito ([1-9])<\/div>[\s\S]{0,80}>\1[.\s]</.test(mythsPanelHtml), 'Mitos de Resident Evil 2 Remake nao devem duplicar numeracao');
      assert(!/<input\b|data-platinum-extra-check|data-dlc-progress|data-progress|<img\b|<video\b|<iframe\b/.test(mythsPanelHtml), 'Mitos de Resident Evil 2 Remake nao devem incluir progresso, checkbox ou midia');
      assert(!/href="#"|https?:\/\/|mito\(s\)|troféu\(s\)|\[object Object\]|NOME ORIGINAL/.test(mythsPanelHtml), 'Mitos de Resident Evil 2 Remake nao devem expor link vazio, fonte externa, pluralizacao artificial ou linguagem interna');
      ['45 troféus', 'S+', 'três saves', 'armas infinitas', '2nd Run', '58 Files', 'The 4th Survivor', 'Tofu Survivor', 'The Ghost Survivors', 'Gotcha!', 'Got ’Em', 'Training Mode', 'Another Survivor', 'Chasing Jill'].forEach(text => {
        assert(mythsPanelHtml.includes(text), `Mitos de Resident Evil 2 Remake devem cobrir ${text}`);
      });
      const mythInternalHrefs = [...mythsPanelHtml.matchAll(/<a\b[^>]*href="#([^"]+)"/g)].map(match => match[1]);
      assert(mythInternalHrefs.length > 0 && mythInternalHrefs.every(targetId => guideIds.includes(targetId)), 'Onde conferir deve apontar somente para secoes reais do guia');
      assert(html.indexOf('id="guideChapterRoutePanel"') < mythsPanelStart && mythsPanelStart < checklistTabStart, 'Mitos devem ficar depois da Rota por Capitulo e antes dos checklists longos');
      const faqPanelHtml = html.match(/<section id="guideFaqPanel"[\s\S]*?<\/section>/)?.[0] || '';
      apiGame.commonMythsGuide.myths.forEach((item, index) => {
        assert(!faqPanelHtml.includes(item.myth) && !faqPanelHtml.includes(item.correction), `FAQ nao deve duplicar integralmente o mito ${index + 1}`);
      });
      assert(!html.includes('Rota por Capítulo'), 'Resident Evil 2 Remake nao deve expor nomenclatura exclusiva do guia de Resident Evil 5');
      ['S rank sem confundir com S+', 'S+ não é requisito direto da platina', 'S+ e armas infinitas são opcionais', 'S rank pode ser feito em Standard'].forEach(text => {
        assert(!html.includes(text), `Resident Evil 2 Remake nao deve repetir explicacao conceitual: ${text}`);
      });
      assert((guideScopedHtml.match(/Para os troféus, basta rank S; S\+ é opcional e possui regras próprias\./g) || []).length >= 1, 'Tempos de S rank deve conter a nota conceitual curta no conteudo renderizado');
      assert(html.includes('O limite de saves pertence ao S+.'), 'Tempos de S rank deve preservar a regra operacional do limite de saves');
      assert(html.includes('S rank é obrigatório; S+ não é necessário.'), 'Card de Leon S Kennedy deve preservar a frase pratica aprovada');
      assert(faqPanelHtml.includes('S rank com Leon e Claire é obrigatório') && faqPanelHtml.includes('S+ é opcional') && faqPanelHtml.includes('Hardcore Rookie e Hardcore College Student'), 'FAQ deve preservar resposta curta sobre S, S+ e Hardcore');
      assert(html.includes('Peguei Você!') && html.includes('Cause dano pesado e chame o guindaste de volta uma única vez'), 'Pontos de atencao de Resident Evil 2 Remake devem explicar Peguei Voce');
      assert(html.includes('Num Piscar de Olhos') && html.includes('conclua a luta com pelo menos 5 minutos restantes'), 'Pontos de atencao de Resident Evil 2 Remake devem explicar Num Piscar de Olhos');
      assert(html.includes('Uma Superespiã Eficiente') && html.includes('não dispare a handgun nem use subweapons'), 'Pontos de atencao de Resident Evil 2 Remake devem explicar Ada');
      assert(html.includes('Jovem Fugitiva') && html.includes('termina ao cortar o papelão e atravessar a abertura na parede do quarto'), 'Pontos de atencao de Resident Evil 2 Remake devem explicar Sherry');
      assert(html.includes('<h4>Raccoon City Native</h4>') && html.includes('<span>PT-BR</span>Nativo de Raccoon City'), 'Checklist de Resident Evil 2 Remake deve renderizar nome original com traducao editorial PT-BR');
      assert(html.includes('Use faca, granada ou flash ao ser agarrado.'), 'Checklist de Resident Evil 2 Remake deve renderizar dica corrigida de Eat This');
      assert((html.match(/atlas-trophy-card__title-translation/g) || []).length >= 42, 'Checklist de Resident Evil 2 Remake deve exibir traducao PT-BR nos 42 trofeus');
      apiGame.trophies.forEach(trophy => {
        assert(trophy.name && trophy.trophyNameOriginal === trophy.name, `${trophy.id} deve expor nome original`);
        assert(trophy.name_pt && trophy.trophyNamePtBr === trophy.name_pt, `${trophy.id} deve expor titulo PT-BR`);
        assert(!String(trophy.name_pt).includes(' / '), `${trophy.id} nao deve concatenar titulo PT-BR`);
        assert(!/Descrição em revisão editorial\.|null|undefined|\[object Object\]/i.test(`${trophy.name_pt} ${trophy.name} ${trophy.description}`), `${trophy.id} nao deve expor placeholder`);
      });
      ['Obtain all trophies', 'Reach the police station', "Complete Leon's story", "Complete Claire's story", 'Complete the game without', 'Open all of the safes', 'Destroy all Mr. Raccoons', 'Descrição em revisão editorial.'].forEach(text => {
        assert(!html.includes(text), `HTML publico de Resident Evil 2 Remake nao deve conter descricao em ingles ou placeholder: ${text}`);
      });
      [
        'dados atuais do guia',
        'segundo os dados atuais do guia',
        'o guia não aponta',
        'quando validado',
        'em revisão editorial',
        'guia aguardando validação',
        'informação pendente',
        'Comece pelo roadmap',
        'Ler alertas antes do checklist',
        'Avance pela campanha',
        'Prossiga pela rota planejada',
        'Base game sem DLCs',
        '[object Object]',
        'undefined',
        'Maté',
        'Use faça',
        'Este troféu está marcado como spoiler',
        'Revele os detalhes na lista completa'
      ].forEach(text => {
        assert(!guideScopedHtml.includes(text), `Resident Evil 2 Remake SSR nao deve exibir: ${text}`);
        if (!['Maté', 'Use faça'].includes(text)) {
          assert(!normalizedScopedHtml.includes(normalizeText(text)), `Resident Evil 2 Remake SSR nao deve exibir texto normalizado: ${text}`);
        }
      });
      assert(!/>\s*null\s*</i.test(html), 'Resident Evil 2 Remake SSR nao deve exibir null visivel');
      assert([`${baseUrl}/jogo/resident-evil-2-remake`, 'https://atlasachievement.com.br/jogo/resident-evil-2-remake'].includes(getCanonical(html)), 'canonical de Resident Evil 2 Remake deve manter slug publico correto');
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
      assert.strictEqual(getMeta(html, 'description'), 'Guia de platina de Hades com roadmap, checklist, tempo estimado de 70 a 100 horas, dificuldade 5/10, sem online obrigatório, progresso salvo.', 'meta description de Hades deve seguir SEO esperado');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/hades', 'canonical de Hades deve usar dominio de producao');
    }
    if (slug === 'ghost-of-tsushima') {
      assert.strictEqual(apiGame.is_verified, true, 'API de Ghost of Tsushima deve continuar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Ghost of Tsushima deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 52, 'API de Ghost of Tsushima deve manter 52 trofeus');
      assert.strictEqual(apiGame.missable_count, 0, 'API de Ghost of Tsushima deve manter missable_count 0');
      assert.strictEqual(Boolean(apiGame.onlineRequired || apiGame.online_required), false, 'API de Ghost of Tsushima deve manter online 0');
      assert.strictEqual(Boolean(apiGame.coopRequired || apiGame.coop_required), false, 'API de Ghost of Tsushima deve manter coop 0');
      assert.strictEqual(apiGame.dlcRequired || apiGame.dlc_required || false, false, 'API de Ghost of Tsushima deve manter DLC nao obrigatoria');
      assert(html.includes('Ghost of Tsushima — Guia de platina e troféus'), 'Ghost of Tsushima deve renderizar H1 esperado');
      assert(html.includes('Verificado'), 'Ghost of Tsushima deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'Ghost of Tsushima deve renderizar mensagem publica revisada');
      assert(html.includes('DLC fora da platina base'), 'Ghost of Tsushima deve exibir DLC fora da platina base');
      assert(html.includes('Ghost of Tsushima é uma platina de mundo aberto acessível'), 'Ghost of Tsushima deve exibir resumo editorial novo');
      const ghostSummaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      assert((ghostSummaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de Ghost of Tsushima deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('A platina base é totalmente offline') && html.includes('Iki Island, Legends e New Game+ ficam fora da platina base.'), 'FAQ de Ghost of Tsushima deve ter respostas diretas');
      ['dados atuais do guia', 'o guia não aponta', 'Maté', 'Watér', 'Resgaté', 'Base game sem DLCs', 'Algumas descrições secretas usam tradução editorial PT-BR', 'Steam oculta', 'descrição localizada', '[object Object]', 'undefined'].forEach(text => {
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
      assert.strictEqual(apiGame.is_verified, true, 'API de Nioh 2 deve expor status Verificado');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Nioh 2 deve expor verification_status verified');
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
    if (slug === 'saros') {
      const normalizedHtml = normalizeText(html);
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable);
      const apiUntouchable = apiGame.trophies.find(trophy => trophy.id === 'saros-untouchable');
      const summaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      assert.strictEqual(apiGame.is_verified, true, 'API de Saros deve continuar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Saros deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 45, 'API de Saros deve manter 45 trofeus');
      assert.strictEqual(apiGame.missable_count, apiMissables.length, 'API de Saros deve alinhar missable_count com checklist');
      assert.strictEqual(apiGame.missable_count, 0, 'API de Saros deve manter missable_count 0');
      assert.strictEqual(Boolean(apiGame.onlineRequired || apiGame.online_required), false, 'API de Saros deve manter online 0');
      assert.strictEqual(Boolean(apiGame.coopRequired || apiGame.coop_required), false, 'API de Saros deve manter coop 0');
      assert.strictEqual(Boolean(apiGame.dlcRequired || apiGame.dlc_required), false, 'API de Saros deve manter DLC nao obrigatoria');
      assert(apiUntouchable && !apiUntouchable.is_missable, 'Untouchable nao deve vir como Perdivel na API');
      assert(html.includes('Saros'), 'Saros deve renderizar nome no SSR');
      assert(html.includes('Verificado'), 'Saros deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'Saros deve renderizar mensagem publica revisada');
      assert(html.includes('Sem perdíveis'), 'Saros deve renderizar topo Sem perdiveis');
      assert(html.includes('DLC fora da platina base'), 'Saros deve exibir DLC fora da platina base');
      assert(normalizedHtml.includes('saros e uma platina baseada em progressao por runs'), 'Saros deve exibir resumo editorial forte');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de Saros deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('Sim. Este guia está Verificado') || html.includes('Sim. Este guia est'), 'FAQ de Saros deve confirmar guia verificado');
      assert(html.includes('Não há perdíveis definitivos') || html.includes('NÃ£o hÃ¡ perdÃ­veis definitivos'), 'FAQ de Saros deve afirmar sem perdiveis definitivos');
      assert(html.includes('Untouchable') && html.includes('Let Go') && html.includes('Nightmare Strands') && html.includes('Full Arsenal') && html.includes('King'), 'Saros deve renderizar pontos de atencao editoriais esperados');
      assert(html.includes('Dificuldade / Risco de run / Desafio'), 'Untouchable deve aparecer como desafio de execucao, nao perdivel');
      assert(!/Untouchable[\s\S]{0,500}Perdível/i.test(html), 'Untouchable nao deve aparecer como Perdivel no HTML');
      [
        'em revisão editorial',
        'guia inicial',
        'quando validado',
        'aguardando revisão',
        'validação editorial pendente',
        'mantendo o guia em revisão',
        'dados atuais do guia',
        'segundo os dados atuais do guia',
        'o guia não aponta',
        'não há requisito validado',
        'devem continuar em validação editorial',
        'Este troféu está marcado como spoiler',
        'Revele os detalhes na lista completa',
        'Base game sem DLCs',
        'Descrição em revisão editorial.',
        '[object Object]',
        'undefined'
      ].forEach(text => {
        assert(!html.includes(text), `Saros SSR nao deve exibir: ${text}`);
      });
      assert(!/>\s*null\s*</i.test(html), 'Saros SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/saros', 'canonical de Saros deve usar dominio de producao');
    }
    if (slug === 'god-of-war') {
      const guideScopedHtml = html.replace(/<aside[^>]*atlas-home-beta-notice[\s\S]*?<\/aside>/i, '');
      const normalizedHtml = normalizeText(html);
      const normalizedScopedHtml = normalizeText(guideScopedHtml);
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable === true);
      const summaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      assert.strictEqual(apiGame.is_verified, true, 'API de God of War (2018) deve continuar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de God of War (2018) deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 37, 'API de God of War (2018) deve manter 37 trofeus');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Platina').length, 1, 'API de God of War (2018) deve manter 1 platina');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Ouro').length, 5, 'API de God of War (2018) deve manter 5 ouros');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Prata').length, 9, 'API de God of War (2018) deve manter 9 pratas');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Bronze').length, 22, 'API de God of War (2018) deve manter 22 bronzes');
      assert.strictEqual(apiGame.missable_count, apiMissables.length, 'API de God of War (2018) deve alinhar missable_count com checklist');
      assert.strictEqual(apiGame.missable_count, 0, 'API de God of War (2018) deve manter missable_count 0');
      assert(!apiMissables.some(trophy => trophy.type === 'Platina'), 'API de God of War (2018) nao deve contar platina como perdivel');
      assert.strictEqual(Boolean(apiGame.onlineRequired || apiGame.online_required), false, 'API de God of War (2018) deve manter online 0');
      assert.strictEqual(Boolean(apiGame.coopRequired || apiGame.coop_required), false, 'API de God of War (2018) deve manter coop 0');
      assert.strictEqual(Boolean(apiGame.dlcRequired || apiGame.dlc_required), false, 'API de God of War (2018) deve manter DLC nao obrigatoria');
      assert.strictEqual(apiGame.roadmap.length, 6, 'API de God of War (2018) deve retornar roadmap de 6 etapas');
      assert(apiGame.roadmap.every(step => Array.isArray(step.actions)), 'API de God of War (2018) deve retornar actions reais no roadmap');
      assert.strictEqual(apiGame.roadmap[0]?.title, 'Avance a história em uma dificuldade confortável', 'API de God of War (2018) deve retornar primeiro passo especifico');
      apiGame.roadmap.forEach((step, index) => {
        assert(!step.actions.some(action => normalizeText(action) === normalizeText(step.objective)), `API de God of War (2018) nao deve repetir objetivo literalmente nas actions da etapa ${index + 1}`);
      });
      const apiRoadmapText = JSON.stringify(apiGame.roadmap);
      const roadmapPanelHtml = html.match(/<section id="guideRoadmapPanel"[\s\S]*?<\/section>/)?.[0] || '';
      [
        'Avance a campanha principal',
        'Limpe regiões e favores',
        'limpe coletáveis por região, incluindo artefatos, Odin’s Rave',
        'limpe coletáveis por região, incluindo artefatos, Odin’s Ravens',
        'Odin’s Rave',
        'Odin’s Ravens',
        'Jötnar shrines',
        'Nornir Chests',
        'wayward spirits',
        'Trials of Muspelheim',
        'Workshop de Niflheim',
        'Prepare Muspelheim e Niflheim',
        'Feche valquírias no pós-game',
        'Feche cleanup e pendências finais',
        'jogue a história naturalmente, aprendendo combate, Atreus, Runic Attacks'
      ].forEach(text => {
        assert(!apiRoadmapText.includes(text), `API roadmap de God of War (2018) nao deve conter texto antigo: ${text}`);
        assert(!normalizeText(apiRoadmapText).includes(normalizeText(text)), `API roadmap de God of War (2018) nao deve conter texto antigo normalizado: ${text}`);
        assert(!roadmapPanelHtml.includes(text), `Roadmap SSR de God of War (2018) nao deve conter texto antigo: ${text}`);
        assert(!normalizeText(roadmapPanelHtml).includes(normalizeText(text)), `Roadmap SSR de God of War (2018) nao deve conter texto antigo normalizado: ${text}`);
      });
      ['Avance a história em uma dificuldade confortável', 'Explore reinos e abra atividades secundárias', 'Complete favores, coletáveis e mapas por região', 'Trabalhe Muspelheim e Niflheim em etapas próprias', 'Derrote Valkyries e finalize upgrades importantes', 'Faça o cleanup final da platina base'].forEach(text => {
        assert(apiRoadmapText.includes(text), `API roadmap de God of War (2018) deve conter etapa nova: ${text}`);
        assert(roadmapPanelHtml.includes(text), `Roadmap SSR de God of War (2018) deve conter etapa nova: ${text}`);
      });
      apiGame.trophies.forEach(trophy => {
        assert(trophy.name && trophy.trophyNameOriginal === trophy.name, `${trophy.id} deve expor nome original em ingles como fonte canonica`);
        assert(trophy.name_pt && trophy.trophyNamePtBr === trophy.name_pt, `${trophy.id} deve expor nome principal em portugues`);
        assert(!/^(undefined|null|\[object Object\])$/i.test(`${trophy.name} ${trophy.trophyNameOriginal}`), `${trophy.id} nao deve expor placeholder no nome`);
        assert(!String(trophy.name).includes(' / '), `${trophy.id} nao deve concatenar nomes no titulo principal`);
        const ptNames = [trophy.name_pt, trophy.trophyNamePtBr, trophy.namePt, trophy.titlePt, trophy.localizedName, trophy.translatedName]
          .filter(value => String(value || '').trim());
        assert.strictEqual(new Set(ptNames).size, 1, `${trophy.id} deve expor uma unica traducao em portugues`);
      });
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.name_pt && trophy.trophyNamePtBr).length, 37, 'API de God of War (2018) deve retornar titulo PT-BR nos 37 trofeus');
      assert(html.includes('<h4>Pai e Filho</h4>') && html.includes('NOME ORIGINAL:</span>Father and Son'), 'Checklist de God of War (2018) deve renderizar Pai e Filho com nome original Father and Son');
      assert(html.includes('<h4>Escolhedor dos Mortos</h4>') && html.includes('NOME ORIGINAL:</span>Chooser of the Slain'), 'Checklist de God of War (2018) deve renderizar Escolhedor dos Mortos com nome original Chooser of the Slain');
      assert(html.includes('<h4>Primordial</h4>') && html.includes('NOME ORIGINAL:</span>Primordial'), 'Checklist de God of War (2018) deve renderizar Primordial com NOME ORIGINAL');
      assert((html.match(/NOME ORIGINAL:<\/span>/g) || []).length >= 2, 'Checklist de God of War (2018) deve exibir NOME ORIGINAL nos trofeus renderizados no SSR');
      assert(!html.includes('<h4>Father and Son</h4>'), 'Checklist de God of War (2018) nao deve usar ingles como titulo principal quando ha PT-BR');
      assert(!html.includes('Pai e Filho / Father and Son'), 'Checklist de God of War (2018) nao deve concatenar traducao e original');
      assert(!html.includes('Pai e Filho / Pai e Filho'), 'Checklist de God of War (2018) nao deve duplicar traducao PT-BR');
      assert(!html.includes('Father and Son / Father and Son'), 'Checklist de God of War (2018) nao deve duplicar nome original');
      ['Odin’s Ravens', "Odin's Ravens", 'Jötnar shrines', 'wayward spirits', 'Witch’s Woods', "Witch's Woods", 'Dragon of the Mountain', 'Runic Attack Gem', 'Runic Attack', 'Descrição em revisão editorial.'].forEach(text => {
        assert(!html.includes(text), `HTML publico de God of War (2018) nao deve conter termo em ingles ou placeholder: ${text}`);
      });
      assert(html.includes('God of War'), 'God of War (2018) deve renderizar nome no SSR');
      assert(html.includes('Verificado'), 'God of War (2018) deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'God of War (2018) deve renderizar mensagem publica revisada');
      assert(normalizedHtml.includes('sem perdiveis'), 'God of War (2018) deve renderizar topo Sem perdiveis');
      assert(html.includes('DLC fora da platina base'), 'God of War (2018) deve exibir DLC fora da platina base');
      assert(normalizedHtml.includes('god of war (2018) tem uma platina focada'), 'God of War (2018) deve exibir resumo editorial forte');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de God of War (2018) deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('Chooser of the Slain') && html.includes('Darkness and Fog') && html.includes('Fire and Brimstone') && html.includes('Allfather Blinded') && html.includes('Treasure Hunter'), 'God of War (2018) deve renderizar pontos de atencao editoriais esperados');
      assert(html.includes('Dificuldade / Valkyries / Cleanup'), 'Chooser of the Slain deve aparecer como dificuldade/Valkyries/cleanup');
      assert(!/Chooser of the Slain[\s\S]{0,500}Perd[ií]vel/i.test(html), 'Chooser of the Slain nao deve aparecer como Perdivel no HTML');
      [
        'dados atuais do guia',
        'segundo os dados atuais do guia',
        'o guia nao aponta',
        'o guia n\u00e3o aponta',
        'lista atual',
        'quando validado',
        'em revisao',
        'em revis\u00e3o',
        'Base game sem DLCs',
        'Este trofeu esta marcado como spoiler',
        'Este trof\u00e9u est\u00e1 marcado como spoiler',
        'Revele os detalhes na lista completa',
        'Descri\u00e7\u00e3o em revis\u00e3o editorial.',
        '[object Object]',
        'Comece pelo roadmap',
        'Comece pela rota segura',
        'Continue a rota principal',
        'Passo 2',
        'title:',
        'focus:',
        'objective:',
        'actions:',
        'undefined'
      ].forEach(text => {
        assert(!guideScopedHtml.includes(text), `God of War (2018) SSR nao deve exibir: ${text}`);
        assert(!normalizedScopedHtml.includes(normalizeText(text)), `God of War (2018) SSR nao deve exibir texto normalizado: ${text}`);
      });
      assert(!/\bOdin[’']s Rave(?!ns)/.test(guideScopedHtml), 'God of War (2018) SSR nao deve exibir Odin’s Rave truncado');
      assert(!/>\s*null\s*</i.test(html), 'God of War (2018) SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/god-of-war', 'canonical de God of War (2018) deve usar dominio de producao');
    }
    if (slug === 'god-of-war-ragnarok') {
      const guideScopedHtml = html.replace(/<aside[^>]*atlas-home-beta-notice[\s\S]*?<\/aside>/i, '');
      const normalizedHtml = normalizeText(html);
      const normalizedScopedHtml = normalizeText(guideScopedHtml);
      const apiMissables = apiGame.trophies.filter(trophy => trophy.is_missable === true);
      const summaryHtml = html.match(/<div class="atlas-guide-summary-editorial[\s\S]*?<\/div>/)?.[0] || '';
      const apiRoadmapText = JSON.stringify(apiGame.roadmap);
      const roadmapPanelHtml = html.match(/<section id="guideRoadmapPanel"[\s\S]*?<\/section>/)?.[0] || '';
      assert.strictEqual(apiGame.slug, 'god-of-war-ragnarok', 'API de God of War Ragnarök deve usar slug real');
      assert.strictEqual(apiGame.is_verified, true, 'API de God of War Ragnarök deve ficar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de God of War Ragnarök deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 36, 'API de God of War Ragnarök deve manter 36 trofeus');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Platina').length, 1, 'API de God of War Ragnarök deve manter 1 platina');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Ouro').length, 4, 'API de God of War Ragnarök deve manter 4 ouros');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Prata').length, 15, 'API de God of War Ragnarök deve manter 15 pratas');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Bronze').length, 16, 'API de God of War Ragnarök deve manter 16 bronzes');
      assert.strictEqual(apiGame.missable_count, apiMissables.length, 'API de God of War Ragnarök deve alinhar missable_count com checklist');
      assert.strictEqual(apiGame.missable_count, 0, 'API de God of War Ragnarök deve manter missable_count 0');
      assert(!apiMissables.some(trophy => trophy.type === 'Platina'), 'API de God of War Ragnarök nao deve contar platina como perdivel');
      assert.strictEqual(apiGame.onlineRequired, false, 'API de God of War Ragnarök deve manter online 0 explícito');
      assert.strictEqual(apiGame.coopRequired, false, 'API de God of War Ragnarök deve manter coop 0 explícito');
      assert.strictEqual(apiGame.dlcRequired, false, 'API de God of War Ragnarök deve manter DLC nao obrigatoria explícita');
      assert.strictEqual(apiGame.newGamePlusRequired, false, 'API de God of War Ragnarök nao deve exigir New Game+');
      assert.strictEqual(apiGame.difficultyTrophiesRequired, false, 'API de God of War Ragnarök nao deve exigir dificuldade obrigatoria');
      assert(apiGame.dlc_scope.includes('Valhalla fora da platina base'), 'God of War Ragnarök deve padronizar Valhalla fora da platina base');
      assert(!/Valhalla[\s\S]{0,80}(obrigat|necess)/i.test(apiGame.dlc_scope), 'Valhalla nao deve aparecer como requisito obrigatorio');
      assert.strictEqual(apiGame.roadmap.length, 6, 'API de God of War Ragnarök deve retornar roadmap de 6 etapas');
      assert(apiGame.roadmap.every(step => Array.isArray(step.actions)), 'API de God of War Ragnarök deve retornar actions reais no roadmap');
      assert.strictEqual(apiGame.roadmap[0]?.title, 'Avance a história em uma dificuldade confortável', 'API de God of War Ragnarök deve retornar primeiro passo especifico');
      assert(html.includes('<strong>Avance a história em uma dificuldade confortável</strong>'), 'SSR de God of War Ragnarök deve corrigir o primeiro passo recomendado');
      assert(!guideScopedHtml.includes('Comece pelo roadmap'), 'SSR de God of War Ragnarök nao deve renderizar primeiro passo generico');
      ['Avance a história em uma dificuldade confortável', 'Explore reinos e abra atividades secundárias', 'Complete favores e coletáveis por reino', 'Trabalhe Muspelheim, Crater e objetivos longos', 'Derrote Berserkers, Gná e finalize upgrades', 'Faça o cleanup final da platina base'].forEach(text => {
        assert(apiRoadmapText.includes(text), `API roadmap de God of War Ragnarök deve conter etapa nova: ${text}`);
        assert(roadmapPanelHtml.includes(text), `Roadmap SSR de God of War Ragnarök deve conter etapa nova: ${text}`);
      });
      ['[object Object]', 'title:', 'focus:', 'objective:', 'actions:', 'Comece pelo roadmap', 'Comece pela rota segura', 'Continue a rota principal', 'Avance pela campanha', 'Prossiga pela rota planejada', 'Passo 2', 'em revisão editorial', 'dados atuais do guia', 'Etapa 1:', 'Artefacts', "Odin's Ravens", 'Odin’s Ravens', 'Nornir Chests', 'Legendary Chests', 'Trials of Muspelheim', 'free-roam', 'free roam'].forEach(text => {
        assert(!apiRoadmapText.includes(text), `API roadmap de God of War Ragnarök nao deve conter texto cru/antigo: ${text}`);
        assert(!roadmapPanelHtml.includes(text), `Roadmap SSR de God of War Ragnarök nao deve conter texto cru/antigo: ${text}`);
      });
      apiGame.trophies.forEach(trophy => {
        assert(trophy.id && /^[A-Za-z0-9_:-]{1,60}$/.test(trophy.id), `${trophy.id} deve ter id interno valido`);
        assert(trophy.name && trophy.trophyNameOriginal === trophy.name, `${trophy.id} deve expor nome original em ingles`);
        assert(trophy.name_pt && trophy.trophyNamePtBr === trophy.name_pt, `${trophy.id} deve expor titulo PT-BR`);
        assert(!String(trophy.name_pt).includes(' / '), `${trophy.id} nao deve concatenar titulo PT-BR`);
        assert(!/Descri[cç][aã]o em revis[aã]o editorial\.|null|undefined|\[object Object\]/i.test(`${trophy.name_pt} ${trophy.name} ${trophy.description}`), `${trophy.id} nao deve expor placeholder`);
      });
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.name_pt && trophy.trophyNamePtBr).length, 36, 'API de God of War Ragnarök deve retornar titulo PT-BR nos 36 trofeus');
      assert(html.includes('<h4>O Urso e o Lobo</h4>') && html.includes('NOME ORIGINAL:</span>The Bear and the Wolf'), 'Checklist de God of War Ragnarök deve renderizar O Urso e o Lobo com nome original');
      assert(html.includes('<h4>A Verdadeira Rainha</h4>') && html.includes('NOME ORIGINAL:</span>The True Queen'), 'Checklist de God of War Ragnarök deve renderizar A Verdadeira Rainha com nome original');
      assert(html.includes('<h4>Erro Grave</h4>') && html.includes('NOME ORIGINAL:</span>Grave Mistake'), 'Checklist de God of War Ragnarök deve renderizar Erro Grave com nome original');
      assert((html.match(/NOME ORIGINAL:<\/span>/g) || []).length >= 36, 'Checklist de God of War Ragnarök deve exibir NOME ORIGINAL nos 36 trofeus renderizados no SSR');
      assert(!html.includes('<h4>The Bear and the Wolf</h4>'), 'Checklist de God of War Ragnarök nao deve usar ingles como titulo principal quando ha PT-BR');
      ['Collect all Trophies', 'Collect one flower', 'Collect all of the Books', 'Collect all of the Artifacts', 'Equip an Enchantment', 'Upgrade one piece of armor', 'Remember the Spartan teachings', 'Purchase a Skill', 'Battle Gná', 'Complete all of the Crater Hunts', 'Complete the Trials of Muspelheim', 'Battle Níðhögg', 'Descrição em revisão editorial.'].forEach(text => {
        assert(!html.includes(text), `HTML publico de God of War Ragnarök nao deve conter descrição em ingles ou placeholder: ${text}`);
      });
      assert(html.includes('God of War Ragnarök'), 'God of War Ragnarök deve renderizar nome no SSR');
      assert(html.includes('Verificado'), 'God of War Ragnarök deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'God of War Ragnarök deve renderizar mensagem publica revisada');
      assert(normalizedHtml.includes('sem perdiveis'), 'God of War Ragnarök deve renderizar topo Sem perdiveis');
      assert(html.includes('Valhalla fora da platina base'), 'God of War Ragnarök deve exibir Valhalla fora da platina base');
      assert(normalizedHtml.includes('god of war ragnarok tem uma platina focada'), 'God of War Ragnarök deve exibir resumo editorial forte');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 2, 'Resumo de God of War Ragnarök deve ter pelo menos 2 paragrafos editoriais');
      assert(html.includes('The True Queen') && html.includes('Grave Mistake') && html.includes('Trials by Fire') && html.includes('Collector') && html.includes('The Florist'), 'God of War Ragnarök deve renderizar pontos de atencao editoriais esperados');
      assert(html.includes('Dificuldade / Boss / Cleanup'), 'The True Queen deve aparecer como dificuldade/boss/cleanup');
      assert(!/The True Queen[\s\S]{0,500}Perd[ií]vel/i.test(html), 'The True Queen nao deve aparecer como Perdivel no HTML');
      [
        'dados atuais do guia',
        'segundo os dados atuais do guia',
        'o guia nao aponta',
        'o guia não aponta',
        'Comece pelo roadmap',
        'Este guia ainda está passando por revisão editorial',
        'lista atual',
        'quando validado',
        'em revisao',
        'em revisão',
        'Base game sem DLCs',
        'Este trofeu esta marcado como spoiler',
        'Este troféu está marcado como spoiler',
        'Revele os detalhes na lista completa',
        'Descrição em revisão editorial.',
        '[object Object]',
        'undefined'
      ].forEach(text => {
        assert(!guideScopedHtml.includes(text), `God of War Ragnarök SSR nao deve exibir: ${text}`);
        assert(!normalizedScopedHtml.includes(normalizeText(text)), `God of War Ragnarök SSR nao deve exibir texto normalizado: ${text}`);
      });
      assert(!/>\s*null\s*</i.test(html), 'God of War Ragnarök SSR nao deve exibir null visivel');
      assert.strictEqual(getCanonical(html), 'https://atlasachievement.com.br/jogo/god-of-war-ragnarok', 'canonical de God of War Ragnarök deve usar dominio de producao');
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
    .filter(isIndexableGuideFixture)
    .slice(0, 12)
    .map(game => game.slug);
  const noindexGame = sampleGames.find(game => game?.slug && !isIndexableGuideFixture(game));
  assert(seoSlugs.length > 0, 'deve haver guias completos e verificados para indexacao');
  assert(noindexGame, 'deve haver ao menos um guia incompleto ou em revisao para validar noindex');

  await withTempApp(async ({ baseUrl }) => {
    const sitemap = await fetchText(`${baseUrl}/sitemap.xml`);
    assert(sitemap.startsWith('<?xml'), 'sitemap deve ser XML');
    assert(sitemap.includes('<urlset'), 'sitemap deve ter urlset');
    assert(sitemap.includes(`<loc>${baseUrl}/</loc>`), 'sitemap deve incluir home');
    assert(sitemap.includes(`<loc>${baseUrl}/catalogo</loc>`), 'sitemap deve incluir catalogo');
    ['/sobre', '/contato', '/privacidade', '/termos', '/comece-aqui'].forEach(pathName => {
      assert(sitemap.includes(`<loc>${baseUrl}${pathName}</loc>`), `sitemap deve incluir ${pathName}`);
    });
    ['/biblioteca', '/perfil', '/admin', '/login', '/feedback'].forEach(pathName => {
      assert(!sitemap.includes(`<loc>${baseUrl}${pathName}</loc>`), `sitemap nao deve incluir ${pathName}`);
    });

    const publicCatalogResponse = await fetchJson(`${baseUrl}/api/games?limit=100&sort=updated-desc`);
    assert(publicCatalogResponse.items.length > 0, 'API publica deve manter guias verificados');
    const publicCatalogTotalPages = Number(publicCatalogResponse.pagination?.totalPages || 1);
    const publicCatalogItems = [...publicCatalogResponse.items];
    for (let page = 2; page <= publicCatalogTotalPages; page += 1) {
      const pageResponse = await fetchJson(`${baseUrl}/api/games?limit=100&sort=updated-desc&page=${page}`);
      publicCatalogItems.push(...(pageResponse.items || []));
    }
    publicCatalogItems.forEach(game => {
      assert(isPublicCatalogGuideFixture(game), `API publica nao deve listar guia em revisao: ${game.slug}`);
    });
    assert.strictEqual(
      Number(publicCatalogResponse.pagination?.total || 0),
      publicCatalogItems.length,
      'total publico deve contar todos os guias verificados elegiveis ao catalogo visual'
    );
    const expectedPublicCatalogTotal = loadSampleGames().filter(isPublicCatalogGuideFixture).length;
    assert.strictEqual(
      Number(publicCatalogResponse.pagination?.total || 0),
      expectedPublicCatalogTotal,
      'catalogo publico deve preservar todos os guias verificados do dataset, sem restringir a coverage complete'
    );
    assert(publicCatalogItems.some(game => game.slug === 'resident-evil-5'), 'API publica deve permitir descobrir Resident Evil 5');
    assert(publicCatalogItems.some(game => game.slug === 'clair-obscur-expedition-33'), 'API publica nao deve esconder guia verificado com coverage strong');

    const firstCatalogHtml = await fetchText(`${baseUrl}/catalogo`, { headers: { accept: 'text/html' } });
    const catalogTotalPages = Number(firstCatalogHtml.match(/página\s+1\s+de\s+(\d+)/i)?.[1] || 1);
    let re5CatalogCardHtml = '';
    for (let page = 1; page <= catalogTotalPages; page += 1) {
      const catalogHtml = page === 1
        ? firstCatalogHtml
        : await fetchText(`${baseUrl}/catalogo?page=${page}`, { headers: { accept: 'text/html' } });
      if (catalogHtml.includes('href="/jogo/resident-evil-5"')) {
        re5CatalogCardHtml = catalogHtml;
        break;
      }
    }
    assert(re5CatalogCardHtml, 'Catalogo SSR deve expor link rastreavel para Resident Evil 5');
    assert(
      /<a\b[^>]*href="\/jogo\/resident-evil-5"[^>]*aria-label="Abrir guia de Resident Evil 5"/.test(re5CatalogCardHtml),
      'Link de catalogo para Resident Evil 5 deve ter href canonico e nome acessivel descritivo'
    );
    assert(re5CatalogCardHtml.includes('>Abrir guia de Resident Evil 5</a>'), 'Anchor de catalogo para Resident Evil 5 deve ter texto visivel descritivo');

    const residentEvilHtml = await fetchText(`${baseUrl}/jogo/resident-evil`, { headers: { accept: 'text/html' } });
    assert(
      /<a\b[^>]*href="\/jogo\/resident-evil-5"[^>]*aria-label="Abrir guia de Resident Evil 5"/.test(residentEvilHtml),
      'Guia Resident Evil deve linkar naturalmente para Resident Evil 5 em guias relacionados'
    );
    assert(residentEvilHtml.includes('>Abrir guia de Resident Evil 5</a>'), 'Anchor relacionado para Resident Evil 5 deve ter texto visivel descritivo');
    assert(residentEvilHtml.includes('Resident Evil 5'), 'Relacionados de Resident Evil devem expor contexto visivel para o link de Resident Evil 5');

    for (const slug of seoSlugs) {
      const game = getGameBySlug(slug);
      assert(sitemap.includes(`<loc>${baseUrl}/jogo/${slug}</loc>`), `sitemap deve incluir ${slug}`);
      const html = await fetchText(`${baseUrl}/jogo/${slug}`, { headers: { accept: 'text/html' } });
      assertSeoHtml(html, { slug, name: game.name, baseUrl });
      assert(!getMeta(html, 'robots'), `${slug} completo e verificado nao deve receber noindex`);
      assert(html.includes('id="view-guide"'), `${slug} deve manter apenas a view do guia`);
      ['view-home', 'view-catalog', 'view-seo-page', 'view-library', 'view-profile', 'feedbackModal', 'userAuthModal'].forEach(id => {
        assert(!html.includes(`id="${id}"`), `${slug} nao deve carregar ${id} no HTML inicial`);
      });
      ['Carregando guia,', 'Carregando checklist', 'Carregando biblioteca'].forEach(text => {
        assert(!html.includes(text), `${slug} indexavel nao deve carregar texto generico: ${text}`);
      });
    }

    const noindexUrl = `${baseUrl}/jogo/${noindexGame.slug}`;
    const noindexResponse = await fetch(noindexUrl, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
    assert(noindexResponse.ok, `${noindexUrl} deveria responder 2xx`);
    const noindexHtml = await noindexResponse.text();
    assert.strictEqual(getMeta(noindexHtml, 'robots'), 'noindex,follow', `${noindexGame.slug} deve receber meta noindex,follow`);
    assert.strictEqual(noindexResponse.headers.get('x-robots-tag'), 'noindex, follow', `${noindexGame.slug} deve receber X-Robots-Tag`);
    assert(!sitemap.includes(`<loc>${baseUrl}/jogo/${noindexGame.slug}</loc>`), `${noindexGame.slug} nao deve entrar no sitemap`);
    assertSeoHtml(noindexHtml, { slug: noindexGame.slug, name: noindexGame.name, baseUrl });

    const institutionalRoutes = {
      '/contato': 'Contato',
      '/privacidade': 'Política de Privacidade',
      '/termos': 'Termos de Uso',
      '/sobre': 'Sobre o AtlasAchievement'
    };
    for (const [pathName, heading] of Object.entries(institutionalRoutes)) {
      const html = await fetchText(`${baseUrl}${pathName}`, { headers: { accept: 'text/html' } });
      assert.strictEqual(getCanonical(html), `${baseUrl}${pathName}`, `${pathName} deve ter canonical proprio`);
      assert(!getMeta(html, 'robots'), `${pathName} deve continuar indexavel`);
      assert(html.includes(`<h1>${heading}</h1>`), `${pathName} deve expor seu conteudo principal`);
      assert(html.includes('id="view-seo-page"'), `${pathName} deve manter a view editorial`);
      ['view-home', 'view-catalog', 'view-library', 'view-guide', 'view-profile', 'feedbackModal', 'userAuthModal'].forEach(id => {
        assert(!html.includes(`id="${id}"`), `${pathName} nao deve carregar ${id}`);
      });
      ['Carregando guia,', 'Carregando checklist', 'Carregando biblioteca'].forEach(text => {
        assert(!html.includes(text), `${pathName} nao deve carregar texto generico: ${text}`);
      });
      assert(!html.includes('id="guideQuickDock"'), `${pathName} nao deve carregar dock funcional de guia`);
    }

    const aboutHtml = await fetchText(`${baseUrl}/sobre`);
    ['Como os guias são produzidos', 'O que significa “Verificado”', 'Platina base, DLCs e 100%', 'Correções e atualização', 'Marcas e independência editorial'].forEach(text => {
      assert(aboutHtml.includes(text), `/sobre deve explicar: ${text}`);
    });

    const libraryResponse = await fetch(`${baseUrl}/biblioteca`, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
    assert(libraryResponse.ok, '/biblioteca deveria responder 2xx');
    const libraryHtml = await libraryResponse.text();
    assert.strictEqual(getCanonical(libraryHtml), `${baseUrl}/biblioteca`, '/biblioteca deve ter canonical proprio');
    assert.strictEqual(getMeta(libraryHtml, 'robots'), 'noindex,follow', '/biblioteca deve receber meta noindex,follow');
    assert.strictEqual(libraryResponse.headers.get('x-robots-tag'), 'noindex, follow', '/biblioteca deve receber X-Robots-Tag');
    assert(libraryHtml.includes('id="view-library"'), '/biblioteca deve manter apenas a view funcional');
    ['view-home', 'view-catalog', 'view-seo-page', 'view-guide', 'view-profile', 'feedbackModal', 'userAuthModal'].forEach(id => {
      assert(!libraryHtml.includes(`id="${id}"`), `/biblioteca nao deve carregar ${id}`);
    });
    assert(!libraryHtml.includes('Carregando biblioteca'), '/biblioteca nao deve expor estado de carregamento no HTML inicial');
    assert(!libraryHtml.includes('id="guideQuickDock"'), '/biblioteca nao deve carregar dock funcional de guia');

    const publicListingRoutes = [
      '/catalogo',
      '/platinas-faceis',
      '/platinas-para-iniciantes',
      '/colecoes/platinas-rapidas'
    ];
    for (const pathName of publicListingRoutes) {
      const html = await fetchText(`${baseUrl}${pathName}`, { headers: { accept: 'text/html' } });
      assert(html.includes('id="view-catalog"'), `${pathName} deve manter somente a view de listagem`);
      assert(!html.includes('id="guideQuickDock"'), `${pathName} nao deve carregar dock funcional de guia`);
      ['guias em revisão editorial', 'Em revisão', 'Informação em revisão', 'Carregando', '-/10'].forEach(text => {
        assert(!html.includes(text), `${pathName} nao deve expor sinal publico de baixo valor: ${text}`);
      });
      assert(/guia(?:s)? verificado(?:s)?/.test(html), `${pathName} deve contar apenas guias verificados`);
    }
  });

  console.log(`test:seo passed (${seoSlugs.length} guias indexaveis + noindex + rotas isoladas + sitemap)`);
}

async function main() {
  const mode = String(process.argv[2] || 'quick').trim().toLowerCase();
  if (mode === 'data') return validateData();
  if (mode === 'roadmap') return validateRoadmaps();
  if (mode === 'guide') return validateGuide(getSlugArg());
  if (mode === 'home') return validateHome();
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
