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
    assert(html.includes('Encontrar minha próxima platina'), 'Home deve manter CTA principal para encontrar platina');
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
    assert.strictEqual(viewModel.missableCount, 16, 'Resident Evil 2 Remake deve manter 16 perdiveis por run na checklist');
    assert.strictEqual(tagCount('online'), 0, 'Resident Evil 2 Remake nao deve ter tag Online');
    assert.strictEqual(tagCount('coop'), 0, 'Resident Evil 2 Remake nao deve ter tag Coop');
    assert.strictEqual(tagCount('grind'), 0, 'Resident Evil 2 Remake nao deve inflar Grind por rankings');
    assert(tagCount('collectible') >= 8, 'Resident Evil 2 Remake deve marcar coletaveis reais');
    assert(tagCount('difficulty') >= 8, 'Resident Evil 2 Remake deve marcar dificuldade/ranking/restricoes');
    assert(tagCount('run') >= 8, 'Resident Evil 2 Remake deve marcar risco de run');
    assert.strictEqual(viewModel.roadmapStages.length, 6, 'Resident Evil 2 Remake deve ter roadmap com 6 etapas');
    assert(viewModel.roadmapStages.every(step => step.isStructured && step.actions.length >= 4), 'Resident Evil 2 Remake deve ter acoes estruturadas no roadmap');
    ['Faça uma primeira campanha segura aprendendo o R.P.D.', 'Complete Leon, Claire e a rota complementar', 'Limpe coletáveis, arquivos, Mr. Raccoons e upgrades', 'Trabalhe Hardcore, rankings e runs rápidas', 'Faça runs condicionais sem cura, sem baú e limite de passos', 'Finalize a checklist da platina base'].forEach(title => {
      assert(roadmapTitles.includes(title), `Resident Evil 2 Remake deve conter etapa: ${title}`);
    });
    assert(seedGame.dlc_scope.includes('DLC fora da platina base') && seedGame.dlc_scope.includes('The Ghost Survivors'), 'Resident Evil 2 Remake deve separar DLC/extras da platina base');
    assert(Array.isArray(seedGame.editorial_summary) && seedGame.editorial_summary.length >= 4, 'Resident Evil 2 Remake deve ter resumo editorial completo da platina');
    assert(seedGame.editorial_summary.join(' ').includes('múltiplas campanhas com Leon e Claire') && seedGame.editorial_summary.join(' ').includes('Conteúdo extra e modos fora da lista base'), 'Resumo editorial de Resident Evil 2 Remake deve explicar rota e extras');
    assert.strictEqual(viewModel.contextualFaq.length, 8, 'Resident Evil 2 Remake deve ter FAQ objetiva com limite visual');
    assert(viewModel.contextualFaq.some(item => item.question.includes('2nd Run') && item.answer.includes('2ª jornada')), 'FAQ de Resident Evil 2 Remake deve explicar 2nd Run');
    assert(viewModel.contextualFaq.some(item => item.question.includes('DLCs ou modos extras') && item.answer.includes('lista base da platina')), 'FAQ de Resident Evil 2 Remake deve separar DLC/extras');
    assert(viewModel.contextualFaq.some(item => item.question.includes('Hardcore, rank S e speedrun') && item.answer.includes('rank depende principalmente de tempo')), 'FAQ de Resident Evil 2 Remake deve explicar Hardcore/rank');
    assert(viewModel.contextualFaq.some(item => item.question.includes('sem cura, sem baú ou limite de passos') && item.answer.includes('Frugalist')), 'FAQ de Resident Evil 2 Remake deve explicar runs condicionais');
    assert.strictEqual(viewModel.nextActionModel.title, 'Faça uma primeira campanha segura aprendendo o R.P.D.', 'Resident Evil 2 Remake deve ter primeiro passo recomendado especifico');
    assert(viewModel.nextActionModel.detail.includes('Comece com uma campanha segura'), 'Resident Evil 2 Remake deve preservar descricao do primeiro passo recomendado');
    assert.deepStrictEqual(viewModel.routeChangingTrophies.slice(0, 5).map(item => item.name), ['Peguei Você!', 'Num Piscar de Olhos', 'Leon "S." Kennedy', 'Uma Superespiã Eficiente', 'Heroína Escarlate Flamejante'], 'Pontos de atencao de Resident Evil 2 Remake devem usar titulos PT-BR');
    assert(viewModel.routeChangingTrophies.every(item => !/Este troféu está marcado como spoiler|Revele os detalhes/i.test(item.text)), 'Pontos de atencao de Resident Evil 2 Remake nao devem usar texto generico de spoiler');
    assert.strictEqual(seedGame.trophies.find(trophy => trophy.id === 're2r_eat_this')?.tip, 'Use faca, granada ou flash ao ser agarrado.', 'Resident Evil 2 Remake deve corrigir dica de Eat This');
    assert.strictEqual(seedGame.trophies.filter(trophy => trophy.name_pt && trophy.name_pt.trim()).length, 42, 'Resident Evil 2 Remake deve ter titulo PT-BR nos 42 trofeus');
    assert(!/Obtain all trophies|Reach the police station|Complete Leon|Complete Claire|Complete the game without|Open all of the safes|Destroy all Mr\. Raccoons/i.test(trophyText), 'Resident Evil 2 Remake nao deve manter descricoes em ingles na checklist');
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
    const placeholderMatch = html.match(PLACEHOLDER_RE);
    assert(!placeholderMatch, `${slug} SSR nao deve renderizar placeholders: ${placeholderMatch?.[0] || ''} ${placeholderMatch ? html.slice(Math.max(0, placeholderMatch.index - 120), placeholderMatch.index + 160) : ''}`);
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
      assert.strictEqual(apiGame.slug, 'resident-evil-2-remake', 'API de Resident Evil 2 Remake deve usar slug real');
      assert.strictEqual(apiGame.is_verified, true, 'API de Resident Evil 2 Remake deve ficar verified');
      assert.strictEqual(apiGame.verification_status, 'verified', 'API de Resident Evil 2 Remake deve expor verification_status verified');
      assert.strictEqual(apiGame.trophies.length, 42, 'API de Resident Evil 2 Remake deve manter 42 trofeus');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Platina').length, 1, 'API de Resident Evil 2 Remake deve manter 1 platina');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Ouro').length, 4, 'API de Resident Evil 2 Remake deve manter 4 ouros');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Prata').length, 9, 'API de Resident Evil 2 Remake deve manter 9 pratas');
      assert.strictEqual(apiGame.trophies.filter(trophy => trophy.type === 'Bronze').length, 28, 'API de Resident Evil 2 Remake deve manter 28 bronzes');
      assert.strictEqual(apiGame.missable_count, apiMissables.length, 'API de Resident Evil 2 Remake deve alinhar missable_count com checklist');
      assert.strictEqual(apiGame.missable_count, 16, 'API de Resident Evil 2 Remake deve manter 16 perdiveis por run');
      assert.strictEqual(apiGame.onlineRequired, false, 'API de Resident Evil 2 Remake deve manter online 0 explicito');
      assert.strictEqual(apiGame.coopRequired, false, 'API de Resident Evil 2 Remake deve manter coop 0 explicito');
      assert.strictEqual(apiGame.dlcRequired, false, 'API de Resident Evil 2 Remake deve manter DLC nao obrigatoria explicita');
      assert.strictEqual(apiGame.newGamePlusRequired, false, 'Resident Evil 2 Remake nao deve exigir NG+');
      assert.strictEqual(apiGame.difficultyTrophiesRequired, true, 'API de Resident Evil 2 Remake deve marcar dificuldade obrigatoria');
      assert(apiGame.dlc_scope.includes('DLC fora da platina base') && apiGame.dlc_scope.includes('The Ghost Survivors'), 'Resident Evil 2 Remake deve padronizar DLC/extras fora da platina base');
      assert.strictEqual(apiGame.roadmap.length, 6, 'API de Resident Evil 2 Remake deve retornar roadmap de 6 etapas');
      assert(apiGame.roadmap.every(step => Array.isArray(step.actions) && step.actions.length >= 4), 'API de Resident Evil 2 Remake deve retornar actions reais no roadmap');
      ['Faça uma primeira campanha segura aprendendo o R.P.D.', 'Complete Leon, Claire e a rota complementar', 'Limpe coletáveis, arquivos, Mr. Raccoons e upgrades', 'Trabalhe Hardcore, rankings e runs rápidas', 'Faça runs condicionais sem cura, sem baú e limite de passos', 'Finalize a checklist da platina base'].forEach(text => {
        assert(apiRoadmapText.includes(text), `API roadmap de Resident Evil 2 Remake deve conter etapa nova: ${text}`);
        assert(roadmapPanelHtml.includes(text), `Roadmap SSR de Resident Evil 2 Remake deve conter etapa nova: ${text}`);
      });
      assert(html.includes('Resident Evil 2 Remake'), 'Resident Evil 2 Remake deve renderizar nome no SSR');
      assert(html.includes('Verificado'), 'Resident Evil 2 Remake deve renderizar status Verificado');
      assert(html.includes('Guia revisado editorialmente.'), 'Resident Evil 2 Remake deve renderizar mensagem publica revisada');
      assert(html.includes('DLC fora da platina base'), 'Resident Evil 2 Remake deve exibir DLC fora da platina base');
      assert((summaryHtml.match(/<p\b/g) || []).length >= 5, 'Resumo da platina de Resident Evil 2 Remake deve ter mais de um paragrafo');
      assert(summaryHtml.includes('múltiplas campanhas com Leon e Claire') && summaryHtml.includes('Conteúdo extra e modos fora da lista base'), 'Resumo da platina de Resident Evil 2 Remake deve renderizar texto editorial completo');
      assert(summaryHtml.includes('Comece com uma campanha segura para aprender o Departamento de Polícia'), 'Resumo da platina de Resident Evil 2 Remake deve preservar primeiro passo recomendado');
      assert(html.includes('Faça uma primeira campanha segura aprendendo o R.P.D.'), 'Resident Evil 2 Remake deve renderizar primeiro passo recomendado especifico');
      assert(html.includes('Peguei Você!') && html.includes('Exige derrotar a forma 2 do G usando o guindaste apenas uma vez'), 'Pontos de atencao de Resident Evil 2 Remake devem explicar Peguei Voce');
      assert(html.includes('Num Piscar de Olhos') && html.includes('Guarde munição pesada para o final do Leon'), 'Pontos de atencao de Resident Evil 2 Remake devem explicar Num Piscar de Olhos');
      assert(html.includes('Uma Superespiã Eficiente') && html.includes('Não dispare a pistola'), 'Pontos de atencao de Resident Evil 2 Remake devem explicar Ada');
      assert(html.includes('Heroína Escarlate Flamejante') && html.includes('Não misture essa tentativa com coleta completa'), 'Pontos de atencao de Resident Evil 2 Remake devem explicar Claire rank S');
      assert(html.includes('<h4>Nativo de Raccoon City</h4>') && html.includes('NOME ORIGINAL:</span>Raccoon City Native'), 'Checklist de Resident Evil 2 Remake deve renderizar titulo PT-BR com nome original');
      assert(html.includes('Use faca, granada ou flash ao ser agarrado.'), 'Checklist de Resident Evil 2 Remake deve renderizar dica corrigida de Eat This');
      assert((html.match(/NOME ORIGINAL:<\/span>/g) || []).length >= 42, 'Checklist de Resident Evil 2 Remake deve exibir NOME ORIGINAL nos 42 trofeus');
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
      assert.strictEqual(getMeta(html, 'description'), 'Guia de platina de Hades em português, com tempo estimado, dificuldade, roadmap, checklist, Fated List, Keepsakes, Companions, Pact of Punishment, Heat e dicas para a platina.', 'meta description de Hades deve seguir SEO esperado');
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
