'use strict';

const {
  escapeHtml,
  safeId,
  safeLinkUrl,
  renderMarkdownSafe,
  formatDatePtBr,
  formatIntegerPtBr,
  yesNoPt
} = require('./guideHtmlUtils');
const { renderGuideV2Head } = require('./guideSeoRenderer');

const EXPECTED_PACKAGE_COUNTS = Object.freeze({
  base: 51,
  versus: 10,
  'lost-in-nightmares': 5,
  'desperate-escape': 5
});

class GuideV2RenderError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'GuideV2RenderError';
    this.code = code;
    this.details = details;
  }
}

function assertCount(value, expected, code, label) {
  if (!Array.isArray(value) || value.length !== expected) {
    throw new GuideV2RenderError(code, `${label} must contain ${expected} entries`, {
      expected,
      actual: Array.isArray(value) ? value.length : null
    });
  }
}

function assertGuideV2Renderable(viewModel) {
  if (!viewModel || viewModel.sourceMode !== 'v2') {
    throw new GuideV2RenderError('INVALID_SOURCE_MODE', 'Guide V2 renderer requires sourceMode v2');
  }
  if (viewModel.game?.slug !== 'resident-evil-5') {
    throw new GuideV2RenderError('INVALID_GAME_SLUG', 'Guide V2 renderer received an unexpected slug');
  }

  assertCount(viewModel.versions, 2, 'INVALID_VERSION_COUNT', 'versions');
  assertCount(viewModel.packages, 4, 'INVALID_PACKAGE_COUNT', 'packages');
  assertCount(viewModel.trophies?.all, 71, 'INVALID_TROPHY_COUNT', 'trophies');
  assertCount(viewModel.sections, 31, 'INVALID_SECTION_COUNT', 'sections');
  assertCount(viewModel.roadmap, 9, 'INVALID_ROADMAP_COUNT', 'roadmap');
  assertCount(viewModel.collectibles?.bsaaEmblems, 30, 'INVALID_BSAA_COUNT', 'BSAA Emblems');
  assertCount(viewModel.collectibles?.treasures, 50, 'INVALID_TREASURE_COUNT', 'treasures');
  assertCount(viewModel.collectibles?.scoreStars, 18, 'INVALID_SCORE_STAR_COUNT', 'Score Stars');
  assertCount(viewModel.collectibles?.agitators, 3, 'INVALID_AGITATOR_COUNT', 'Agitators');
  assertCount(viewModel.inventoryRequirements, 27, 'INVALID_STOCKPILE_COUNT', 'Stockpile');
  assertCount(viewModel.upgradeRequirements, 18, 'INVALID_UPGRADE_COUNT', 'upgrades');
  assertCount(viewModel.sources, 17, 'INVALID_SOURCE_COUNT', 'sources');

  const packageCodes = new Set();
  viewModel.packages.forEach((pkg, index) => {
    const expected = EXPECTED_PACKAGE_COUNTS[pkg.packageCode];
    const actual = Array.isArray(pkg.trophies) ? pkg.trophies.length : -1;
    if (
      expected === undefined
      || pkg.displayOrder !== index + 1
      || pkg.expectedTrophyCount !== expected
      || pkg.actualTrophyCount !== expected
      || actual !== expected
      || packageCodes.has(pkg.packageCode)
    ) {
      throw new GuideV2RenderError(
        'INVALID_PACKAGE_CONTRACT',
        `Package ${pkg.packageCode || index} is not renderable`
      );
    }
    packageCodes.add(pkg.packageCode);
  });

  const nativeLists = viewModel.versions.filter(version => version.nativeTrophyList === true);
  if (
    nativeLists.length !== 1
    || nativeLists[0].platform !== 'PS4'
    || viewModel.versions.some(version => (
      version.platform === 'PS5'
      && (version.isNative || version.nativeTrophyList || version.upgradeSupported || version.autopopSupported)
    ))
  ) {
    throw new GuideV2RenderError(
      'INVALID_VERSION_CONTRACT',
      'Only the native PS4 trophy list may be rendered'
    );
  }

  const domIds = viewModel.trophies.all.map(trophy => trophy.domId);
  const trophyCodes = viewModel.trophies.all.map(trophy => trophy.trophyCode);
  if (
    new Set(domIds).size !== domIds.length
    || domIds.some(id => !/^[a-z][a-z0-9_-]*$/i.test(String(id || '')))
    || new Set(trophyCodes).size !== trophyCodes.length
    || trophyCodes.some(code => (
      !/^[a-z0-9][a-z0-9_-]*$/i.test(String(code || ''))
      || ['__proto__', 'prototype', 'constructor'].includes(code)
    ))
  ) {
    throw new GuideV2RenderError(
      'INVALID_TROPHY_DOM_IDS',
      'Trophy codes and DOM ids must be safe and unique'
    );
  }

  const anchors = viewModel.sections.map(section => section.anchor);
  const sectionCodes = viewModel.sections.map(section => section.sectionCode);
  if (
    new Set(anchors).size !== anchors.length
    || new Set(sectionCodes).size !== sectionCodes.length
    || viewModel.sections.filter(section => section.headingLevel === 1).length !== 1
    || viewModel.sections.some((section, index) => (
      section.order !== index + 1 || !section.content || !section.title
    ))
  ) {
    throw new GuideV2RenderError(
      'INVALID_SECTION_CONTRACT',
      'Editorial sections must be complete, ordered and unique'
    );
  }

  const knownTrophies = new Set(viewModel.trophies.all.map(trophy => trophy.trophyCode));
  for (const section of viewModel.sections) {
    if ((section.relatedTrophyCodes || []).some(code => !knownTrophies.has(code))) {
      throw new GuideV2RenderError(
        'INVALID_SECTION_TROPHY_LINK',
        `Section ${section.sectionCode} references an unknown trophy`
      );
    }
  }

  return viewModel;
}

function renderBreadcrumbs(viewModel) {
  return `<nav class="guide-v2-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Início</a></li>
      <li><a href="/catalogo">Jogos</a></li>
      <li aria-current="page">${escapeHtml(viewModel.game.name)}</li>
    </ol>
  </nav>`;
}

function renderHeader(viewModel) {
  const reviewedAt = formatDatePtBr(viewModel.review?.reviewedAt);
  return `<header class="guide-v2-hero">
    <p class="guide-v2-eyebrow">Guia completo de troféus</p>
    <h1>${escapeHtml(viewModel.seo?.h1 || `${viewModel.game.name} — Guia de Platina e 100%`)}</h1>
    <p class="guide-v2-lead">Versão nativa de PS4, jogável no PS5 por retrocompatibilidade. A platina usa 51 troféus; o 100% completo usa 71.</p>
    <ul class="guide-v2-hero-facts" aria-label="Resumo do guia">
      <li><strong>Plataforma nativa</strong><span>PS4</span></li>
      <li><strong>Execução no PS5</strong><span>Retrocompatibilidade da versão PS4</span></li>
      <li><strong>Escopo</strong><span>Platina + 100%</span></li>
      <li><strong>Revisão factual</strong><span>${escapeHtml(reviewedAt)}</span></li>
    </ul>
  </header>`;
}

function renderVersionContext(viewModel) {
  const native = viewModel.nativeTrophyList;
  const backcompat = viewModel.versions.find(version => version.platform === 'PS5');
  const sourceVersion = viewModel.versions.find(
    version => version.versionCode === backcompat?.sourceVersionCode
  );
  const hasNativePs5List = viewModel.versions.some(
    version => version.platform === 'PS5' && version.nativeTrophyList
  );
  return `<div class="guide-v2-definition-grid" data-v2-version-context>
    <dl>
      <div><dt>Versão nativa</dt><dd>${escapeHtml(native?.platform || '')}</dd></div>
      <div><dt>Execução no PS5</dt><dd>Versão ${escapeHtml(sourceVersion?.platform || native?.platform || '')} por retrocompatibilidade</dd></div>
      <div><dt>Lista nativa PS5</dt><dd>${hasNativePs5List ? 'Existe' : 'Não existe'}</dd></div>
      <div><dt>Lista separada PS5</dt><dd>${hasNativePs5List ? 'Existe' : 'Não existe'}</dd></div>
      <div><dt>Upgrade PS4→PS5</dt><dd>${backcompat?.upgradeSupported ? 'Existe' : 'Não existe'}</dd></div>
      <div><dt>Autopop entre listas</dt><dd>${hasNativePs5List && backcompat?.autopopSupported ? 'Disponível' : 'Não se aplica'}</dd></div>
      <div><dt>Transferência de save</dt><dd>${backcompat?.saveTransferSupported ? `Continuidade do save ${escapeHtml(sourceVersion?.platform || 'PS4')}` : 'Não disponível'}</dd></div>
    </dl>
  </div>
  <div class="guide-v2-version-records" aria-label="Versões analisadas">
    ${viewModel.versions.map(version => `<div data-v2-version="${escapeHtml(version.versionCode)}"><strong>${escapeHtml(version.platform)}</strong><span>${version.isNative ? 'Versão nativa' : 'Retrocompatibilidade'}</span></div>`).join('')}
  </div>`;
}

function renderSummary(viewModel) {
  const packageByCode = Object.fromEntries(viewModel.packages.map(pkg => [pkg.packageCode, pkg]));
  const maximumDifficulty = viewModel.roadmap.find(stage => stage.difficulty === 'Professional')?.difficulty || '';
  const reviewedAt = formatDatePtBr(viewModel.review?.reviewedAt);
  const rows = [
    ['Troféus da platina', viewModel.progress.platinum.total],
    ['Troféus do 100%', viewModel.progress.completion.total],
    ['Jogo-base', packageByCode.base.actualTrophyCount],
    ['Versus', packageByCode.versus.actualTrophyCount],
    ['Lost in Nightmares', packageByCode['lost-in-nightmares'].actualTrophyCount],
    ['Desperate Escape', packageByCode['desperate-escape'].actualTrophyCount],
    ['Online necessário para platina', yesNoPt(viewModel.online.requiredForPlatinum)],
    ['Online necessário para 100%', yesNoPt(viewModel.online.requiredFor100Percent)],
    ['Dificuldade máxima', maximumDifficulty],
    ['Campanhas recomendadas', `${viewModel.roadmap.length} etapas conforme o roadmap aprovado`],
    ['Coletáveis', `${viewModel.collectibles.bsaaEmblems.length} emblemas, ${viewModel.collectibles.treasures.length} tesouros`],
    ['Revisão factual', reviewedAt]
  ];
  return `<div class="guide-v2-table-wrap"><table data-v2-summary>
    <caption>Resumo da platina e do 100%</caption>
    <thead><tr><th scope="col">Item</th><th scope="col">Valor</th></tr></thead>
    <tbody>${rows.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

function renderStaticProgress(viewModel) {
  const items = [
    ['platinum', 'Platina', viewModel.progress.platinum.total, 'Progresso da platina'],
    ...viewModel.packages
      .filter(pkg => pkg.packageCode !== 'base')
      .map(pkg => [
        pkg.packageCode,
        pkg.name,
        pkg.actualTrophyCount,
        `Progresso de ${pkg.name}`
      ]),
    ['completion', '100%', viewModel.progress.completion.total, 'Progresso de 100%']
  ];
  return `<section id="progresso-estatico" class="guide-v2-panel guide-v2-static-progress" aria-labelledby="progresso-estatico-titulo">
    <div class="guide-v2-progress-heading">
      <div><h2 id="progresso-estatico-titulo">Seu progresso</h2><p>Os valores começam em zero e, com JavaScript, ficam salvos neste navegador.</p></div>
      <button type="button" class="guide-v2-reset-button guide-v2-reset-all" data-guide-progress-reset-all>Limpar todo o progresso</button>
    </div>
    <ul>${items.map(([scope, label, total, ariaLabel]) => `<li data-progress-scope="${escapeHtml(scope)}" role="progressbar" aria-label="${escapeHtml(ariaLabel)}: 0 de ${escapeHtml(total)}" aria-valuemin="0" aria-valuemax="${escapeHtml(total)}" aria-valuenow="0">
      <span>${escapeHtml(label)}</span>
      <span class="guide-v2-progress-value"><strong data-progress-count>0/${escapeHtml(total)}</strong><span data-progress-percent>0%</span></span>
      <span class="guide-v2-progress-track" aria-hidden="true"><span data-progress-bar style="width:0%"></span></span>
    </li>`).join('')}</ul>
    <div class="guide-v2-progress-notice" data-guide-progress-notice hidden></div>
    <p class="guide-v2-offline-status" data-guide-progress-connectivity role="status" hidden>Você está offline. As alterações continuarão salvas neste navegador.</p>
    <div data-guide-progress-live class="sr-only" aria-live="polite" aria-atomic="true"></div>
  </section>`;
}

function renderSectionIndex(viewModel) {
  const indexedSections = viewModel.sections
    .filter(section => section.headingLevel !== 1)
    .sort((left, right) => left.order - right.order);
  return `<nav class="guide-v2-index guide-v2-panel" aria-label="Índice do guia">
    <h2>Índice do guia</h2>
    <ol>${indexedSections.map(section => `<li><a href="#${escapeHtml(section.anchor)}">${escapeHtml(section.title.replace(/`/g, ''))}</a></li>`).join('')}</ol>
  </nav>`;
}

function renderTrophyLinks(codes, trophyByCode, limit = 8) {
  const available = (codes || []).map(code => trophyByCode[code]).filter(Boolean);
  if (!available.length) return '';
  const visible = available.slice(0, limit);
  const remaining = available.length - visible.length;
  return `<ul class="guide-v2-related-links">${visible.map(trophy => `<li><a href="#${escapeHtml(trophy.domId)}">${escapeHtml(trophy.name)}</a></li>`).join('')}${remaining > 0 ? `<li><span>+${remaining} troféus relacionados</span></li>` : ''}</ul>`;
}

function renderRoadmap(viewModel, trophyByCode) {
  return `<ol class="guide-v2-roadmap" data-v2-roadmap>
    ${viewModel.roadmap.map(stage => `<li data-v2-roadmap-stage="${escapeHtml(stage.stageCode)}">
      <div class="guide-v2-roadmap-number" aria-hidden="true">${escapeHtml(stage.order)}</div>
      <div>
        <h3>${escapeHtml(stage.title)}</h3>
        <dl class="guide-v2-compact-details">
          <div><dt>Objetivo</dt><dd>${escapeHtml(stage.objective)}</dd></div>
          <div><dt>Dificuldade</dt><dd>${escapeHtml(stage.difficulty)}</dd></div>
          <div><dt>Pacotes</dt><dd>${escapeHtml(stage.packageCodes.join(', '))}</dd></div>
          <div><dt>Coletáveis</dt><dd>${escapeHtml(stage.collectibleGroups.length ? stage.collectibleGroups.join(', ') : 'Nenhum grupo específico')}</dd></div>
          <div><dt>Conclusão</dt><dd>${escapeHtml(stage.completionCondition)}</dd></div>
        </dl>
        ${stage.warnings.length ? `<div class="guide-v2-warning"><strong>Atenção</strong><ul>${stage.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}</ul></div>` : ''}
        ${stage.trophyCodes.length ? `<div><strong>Troféus relacionados</strong>${renderTrophyLinks(stage.trophyCodes, trophyByCode)}</div>` : ''}
      </div>
    </li>`).join('')}
  </ol>`;
}

function renderTrophyField(label, value, trophyByCode) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) {
    return '';
  }
  let renderedValue;
  if (Array.isArray(value)) {
    renderedValue = value.map(item => {
      const related = trophyByCode[item];
      return related
        ? `<a href="#${escapeHtml(related.domId)}">${escapeHtml(related.name)}</a>`
        : escapeHtml(item);
    }).join(', ');
  } else {
    renderedValue = escapeHtml(value);
  }
  return `<div><dt>${escapeHtml(label)}</dt><dd>${renderedValue}</dd></div>`;
}

function renderTrophyCard(trophy, pkg, stageByCode, trophyByCode) {
  const normalizedDescription = String(trophy.description || '').trim().toLowerCase();
  const normalizedMethod = String(trophy.method || '').trim().toLowerCase();
  const details = [
    renderTrophyField('Categoria', trophy.category, trophyByCode),
    renderTrophyField('Campanha', trophy.campaign, trophyByCode),
    renderTrophyField('Etapa', stageByCode[trophy.stageCode]?.title || trophy.stageCode, trophyByCode),
    renderTrophyField('Momento', trophy.moment, trophyByCode),
    renderTrophyField('Pré-requisitos', trophy.prerequisites, trophyByCode),
    normalizedMethod && normalizedMethod !== normalizedDescription
      ? renderTrophyField('Método', trophy.method, trophyByCode)
      : '',
    renderTrophyField('Risco', trophy.risk, trophyByCode),
    renderTrophyField('Prevenção', trophy.prevention, trophyByCode),
    renderTrophyField('Recuperação', trophy.recovery, trophyByCode),
    renderTrophyField('Limpeza', trophy.cleanup, trophyByCode),
    renderTrophyField('Save', trophy.save, trophyByCode),
    renderTrophyField('Dependências', trophy.dependencies, trophyByCode),
    renderTrophyField('Confiança', trophy.confidence, trophyByCode),
    renderTrophyField('Status', trophy.status, trophyByCode)
  ].filter(Boolean).join('');
  const badges = [
    trophy.type,
    `Pacote: ${pkg.name}`,
    `Online: ${yesNoPt(trophy.isOnline)}`,
    `Coop: ${yesNoPt(trophy.isCoop)}`,
    `Perdível: ${yesNoPt(trophy.isMissable)}`,
    `Cumulativo: ${yesNoPt(trophy.isCumulative)}`,
    trophy.isAutomatic ? 'Automático' : ''
  ].filter(Boolean);
  const checkboxId = `guide-progress-${safeId(trophy.trophyCode)}`;
  const progressStatusId = `${trophy.domId}-status`;

  return `<li id="${escapeHtml(trophy.domId)}" class="guide-v2-trophy-card" data-v2-trophy data-trophy-code="${escapeHtml(trophy.trophyCode)}" data-package-code="${escapeHtml(pkg.packageCode)}" data-global-order="${escapeHtml(trophy.globalOrder)}">
    <div class="guide-v2-trophy-heading">
      <span class="guide-v2-trophy-order">${escapeHtml(trophy.globalOrder)}</span>
      <div><h4>${escapeHtml(trophy.name)}</h4><p>${escapeHtml(trophy.description)}</p></div>
    </div>
    <div class="guide-v2-trophy-progress">
      <label for="${escapeHtml(checkboxId)}">
        <input id="${escapeHtml(checkboxId)}" type="checkbox" data-guide-progress-checkbox data-trophy-code="${escapeHtml(trophy.trophyCode)}" data-package-code="${escapeHtml(pkg.packageCode)}" aria-describedby="${escapeHtml(progressStatusId)}" disabled>
        <span>Marcar como concluído</span>
      </label>
      <span id="${escapeHtml(progressStatusId)}" class="guide-v2-trophy-status" data-trophy-progress-status>Pendente</span>
    </div>
    <ul class="guide-v2-badges" aria-label="Classificações do troféu">${badges.map(badge => `<li>${escapeHtml(badge)}</li>`).join('')}</ul>
    ${details ? `<dl class="guide-v2-trophy-details">${details}</dl>` : ''}
  </li>`;
}

function renderTrophyPackages(viewModel) {
  const trophyByCode = Object.fromEntries(viewModel.trophies.all.map(trophy => [trophy.trophyCode, trophy]));
  const stageByCode = Object.fromEntries(viewModel.roadmap.map(stage => [stage.stageCode, stage]));
  return `<section id="trofeus" class="guide-v2-panel guide-v2-packages" aria-labelledby="trofeus-titulo">
    <div class="guide-v2-section-heading"><p class="guide-v2-eyebrow">Lista completa</p><h2 id="trofeus-titulo">71 troféus em quatro pacotes</h2></div>
    ${viewModel.packages.map(pkg => `<section id="pacote-${escapeHtml(safeId(pkg.packageCode))}" class="guide-v2-package" data-v2-package data-package-code="${escapeHtml(pkg.packageCode)}">
      <header>
        <div><p class="guide-v2-eyebrow">Pacote ${escapeHtml(pkg.displayOrder)} de 4</p><h3>${escapeHtml(pkg.name)}</h3></div>
        <div class="guide-v2-package-actions">
          <strong>${escapeHtml(pkg.actualTrophyCount)} troféus</strong>
          <button type="button" class="guide-v2-reset-button" data-guide-progress-reset-package="${escapeHtml(pkg.packageCode)}">Limpar progresso deste pacote</button>
        </div>
      </header>
      <dl class="guide-v2-package-meta">
        <div><dt>Conta para platina</dt><dd>${yesNoPt(pkg.countsForPlatinum)}</dd></div>
        <div><dt>Conta para 100%</dt><dd>${yesNoPt(pkg.countsFor100Percent)}</dd></div>
        <div><dt>Online</dt><dd>${yesNoPt(pkg.isOnline)}</dd></div>
        <div><dt>Coop</dt><dd>${yesNoPt(pkg.isCoop)}</dd></div>
      </dl>
      <ol class="guide-v2-trophy-list">${[...pkg.trophies].sort((left, right) => left.globalOrder - right.globalOrder).map(trophy => renderTrophyCard(trophy, pkg, stageByCode, trophyByCode)).join('')}</ol>
    </section>`).join('')}
  </section>`;
}

function renderBsaaEmblems(viewModel, trophyByCode) {
  return `<ol class="guide-v2-structured-list guide-v2-collectibles">${viewModel.collectibles.bsaaEmblems.map((item, index) => `<li data-v2-bsaa-emblem>
    <h3>BSAA Emblem ${index + 1}/30</h3>
    <dl class="guide-v2-compact-details">
      <div><dt>Capítulo</dt><dd>${escapeHtml(item.chapter)}</dd></div>
      <div><dt>Área</dt><dd>${escapeHtml(item.area)}</dd></div>
      <div><dt>Instrução</dt><dd>${escapeHtml(item.instruction)}</dd></div>
      <div><dt>Retorno possível</dt><dd>${yesNoPt(item.returnPossible)}</dd></div>
    </dl>
    ${renderTrophyLinks(item.relatedTrophyCodes, trophyByCode, 2)}
  </li>`).join('')}</ol>`;
}

function renderTreasures(viewModel, trophyByCode) {
  return `<ol class="guide-v2-structured-list guide-v2-collectibles">${viewModel.collectibles.treasures.map((item, index) => `<li data-v2-treasure>
    <h3>${index + 1}/50 — ${escapeHtml(item.name)}</h3>
    <dl class="guide-v2-compact-details">
      <div><dt>Primeira ocorrência segura</dt><dd>${escapeHtml(item.firstSafeOccurrence)}</dd></div>
      <div><dt>Capítulo</dt><dd>${escapeHtml(item.chapter)}</dd></div>
      ${item.area ? `<div><dt>Área</dt><dd>${escapeHtml(item.area)}</dd></div>` : ''}
      <div><dt>Instrução</dt><dd>${escapeHtml(item.instruction)}</dd></div>
      <div><dt>Venda após registro</dt><dd>${yesNoPt(item.canSellAfterRegistration)}</dd></div>
    </dl>
    ${renderTrophyLinks(item.relatedTrophyCodes, trophyByCode, 2)}
  </li>`).join('')}</ol>`;
}

function renderScoreStars(viewModel, trophyByCode) {
  return `<div class="guide-v2-warning"><strong>Mesma passagem</strong><p>As 18 Score Stars precisam ser obtidas na mesma tentativa. Confirme os pontos sem retorno indicados na rota.</p></div>
  <ol class="guide-v2-structured-list">${viewModel.collectibles.scoreStars.map(item => `<li data-v2-score-star>
    <h3>Score Star ${item.order}/18</h3>
    <p>${escapeHtml(item.instruction)}</p>
    <p><strong>Mesma passagem:</strong> ${yesNoPt(item.sameRunRequired)}</p>
    ${renderTrophyLinks(item.relatedTrophyCodes, trophyByCode, 2)}
  </li>`).join('')}</ol>`;
}

function renderAgitators(viewModel, trophyByCode) {
  return `<div class="guide-v2-warning"><strong>Mesma passagem</strong><p>Os três Agitator Majini devem ser eliminados na mesma tentativa.</p></div>
  <ol class="guide-v2-structured-list">${viewModel.collectibles.agitators.map(item => `<li data-v2-agitator>
    <h3>${escapeHtml(item.name)}</h3>
    <div class="guide-v2-markdown">${renderMarkdownSafe(item.instruction, { stripFirstHeading: false, minimumHeadingLevel: 4 })}</div>
    <p><strong>Mesma passagem:</strong> ${yesNoPt(item.sameRunRequired)}</p>
    ${renderTrophyLinks(item.relatedTrophyCodes, trophyByCode, 2)}
  </li>`).join('')}</ol>`;
}

function renderStockpile(viewModel, trophyByCode) {
  const groups = new Map();
  viewModel.inventoryRequirements.forEach(item => {
    const items = groups.get(item.group) || [];
    items.push(item);
    groups.set(item.group, items);
  });
  return [...groups.entries()].map(([group, items]) => `<div class="guide-v2-requirement-group">
    <h3>${escapeHtml(group)}</h3>
    <ul>${items.map(item => `<li data-v2-stockpile-item>
      <strong>${escapeHtml(item.name)}</strong>
      <dl class="guide-v2-compact-details">
        <div><dt>Desbloqueio</dt><dd>${escapeHtml(item.unlockRequirement)}</dd></div>
        <div><dt>Coexistência necessária</dt><dd>${yesNoPt(item.mustExistSimultaneously)}</dd></div>
      </dl>
      ${renderTrophyLinks(item.relatedTrophyCodes, trophyByCode, 2)}
    </li>`).join('')}</ul>
  </div>`).join('');
}

function renderUpgrades(viewModel, trophyByCode) {
  return `<ul class="guide-v2-structured-list">${viewModel.upgradeRequirements.map(item => `<li data-v2-upgrade>
    <h3>${escapeHtml(item.name)}</h3>
    <dl class="guide-v2-compact-details">
      <div><dt>Classe</dt><dd>${escapeHtml(item.weaponClass)}</dd></div>
      <div><dt>Cadeia de desbloqueio</dt><dd>${escapeHtml(item.unlockChain)}</dd></div>
      <div><dt>Melhoria total disponível</dt><dd>${yesNoPt(item.fullyUpgradable)}</dd></div>
    </dl>
    ${renderTrophyLinks(item.relatedTrophyCodes, trophyByCode, 2)}
  </li>`).join('')}</ul>`;
}

function renderEconomyFigures(viewModel) {
  const figures = viewModel.economy.figures;
  return `<dl class="guide-v2-definition-list" data-v2-economy-figures>
    <div><dt>Total</dt><dd>${escapeHtml(figures.total)}</dd></div>
    <div><dt>Gratuitas</dt><dd>${escapeHtml(figures.free)}</dd></div>
    <div><dt>Pagas</dt><dd>${escapeHtml(figures.paid)}</dd></div>
    <div><dt>Custo unitário</dt><dd>${formatIntegerPtBr(figures.unitCost)} ${escapeHtml(viewModel.economy.currency)}</dd></div>
    <div><dt>Custo total</dt><dd>${formatIntegerPtBr(figures.totalCost)} ${escapeHtml(viewModel.economy.currency)}</dd></div>
  </dl>`;
}

function renderVersusEconomy(viewModel) {
  const characters = viewModel.economy.versusCharacters;
  return `<dl class="guide-v2-definition-list" data-v2-economy-versus>
    <div><dt>Personagens adicionais</dt><dd>${escapeHtml(characters.total)}</dd></div>
    <div><dt>Custo total</dt><dd>${formatIntegerPtBr(characters.totalCost)} ${escapeHtml(viewModel.economy.currency)}</dd></div>
  </dl>
  <ul class="guide-v2-structured-list">${characters.entries.map(item => `<li><strong>${escapeHtml(item.name)}</strong><span>${formatIntegerPtBr(item.cost)} ${escapeHtml(viewModel.economy.currency)}</span></li>`).join('')}</ul>`;
}

function renderOnline(viewModel) {
  const online = viewModel.online;
  const rows = [
    ['Platina exige online', yesNoPt(online.requiredForPlatinum)],
    ['100% exige online', yesNoPt(online.requiredFor100Percent)],
    ['Modos individuais', `Mínimo ${online.minimumPlayersSoloModes} jogadores`],
    ['Modos em equipe', `Mínimo ${online.minimumPlayersTeamModes} jogadores`],
    ['Mapa recomendado', online.recommendedBoostMap],
    ['Slayers', `${online.slayersWins} vitórias`],
    ['Survivors', `${online.survivorsWins} vitórias`],
    ['Team Slayers', `${online.teamSlayersWins} vitórias`],
    ['Team Survivors', `${online.teamSurvivorsWins} vitórias`],
    ['Eliminações físicas', online.physicalEliminations],
    ['Última verificação', formatDatePtBr(online.statusLastVerifiedAt)],
    ['Confiança', online.statusConfidence]
  ];
  return `<div class="guide-v2-table-wrap" data-v2-online><table>
    <caption>Requisitos online de Versus</caption>
    <thead><tr><th scope="col">Requisito</th><th scope="col">Valor verificado</th></tr></thead>
    <tbody>${rows.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</tbody>
  </table></div>
  <div class="guide-v2-warning"><strong>Dependência de servidor</strong><p>A atividade foi verificada na data indicada, mas não há garantia de disponibilidade futura.</p></div>`;
}

function renderSources(viewModel) {
  return `<ol class="guide-v2-sources">${viewModel.sources.map(source => {
    const externalUrl = safeLinkUrl(source.url);
    return `<li data-v2-source>
      <h3>${escapeHtml(source.title)}</h3>
      <dl class="guide-v2-compact-details">
        <div><dt>Tipo</dt><dd>${escapeHtml(source.sourceType)}</dd></div>
        <div><dt>Escopo</dt><dd>${escapeHtml(source.scope)}</dd></div>
        <div><dt>Confiança</dt><dd>${escapeHtml(source.confidence)}</dd></div>
        <div><dt>Última verificação</dt><dd>${escapeHtml(formatDatePtBr(source.lastVerifiedAt))}</dd></div>
      </dl>
      ${externalUrl && /^https?:\/\//i.test(externalUrl)
        ? `<a href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer">Abrir fonte externa<span class="sr-only"> (abre em nova aba)</span></a>`
        : '<p class="guide-v2-source-internal">Fonte editorial interna auditada; caminho de trabalho não publicado.</p>'}
    </li>`;
  }).join('')}</ol>`;
}

function renderReview(viewModel) {
  const status = viewModel.review.editorialStatus === 'approved'
    ? 'Aprovado'
    : viewModel.review.editorialStatus;
  return `<dl class="guide-v2-definition-list" data-v2-review>
    <div><dt>Revisão factual</dt><dd>${escapeHtml(formatDatePtBr(viewModel.review.reviewedAt))}</dd></div>
    <div><dt>Revisão editorial</dt><dd>Controle editorial ${escapeHtml(String(status || '').toLowerCase())}</dd></div>
    <div><dt>Data</dt><dd>${escapeHtml(formatDatePtBr(viewModel.review.reviewedAt))}</dd></div>
    <div><dt>Status</dt><dd>${escapeHtml(status)}</dd></div>
    <div><dt>Escopo analisado</dt><dd>Platina e 100% da lista de troféus da versão PS4</dd></div>
  </dl>`;
}

function renderEditorialSections(viewModel) {
  const trophyByCode = Object.fromEntries(viewModel.trophies.all.map(trophy => [trophy.trophyCode, trophy]));
  const structuredSections = {
    summary: () => renderSummary(viewModel),
    roadmap: () => renderRoadmap(viewModel, trophyByCode),
    'bsaa-emblems': () => renderBsaaEmblems(viewModel, trophyByCode),
    treasures: () => renderTreasures(viewModel, trophyByCode),
    stockpile: () => renderStockpile(viewModel, trophyByCode),
    upgrades: () => renderUpgrades(viewModel, trophyByCode),
    'score-stars': () => renderScoreStars(viewModel, trophyByCode),
    agitators: () => renderAgitators(viewModel, trophyByCode),
    sources: () => renderSources(viewModel),
    review: () => renderReview(viewModel)
  };

  return [...viewModel.sections]
    .sort((left, right) => left.order - right.order)
    .map(section => {
      const isLogicalH1 = section.headingLevel === 1;
      const title = section.title.replace(/`/g, '');
      let content;
      if (section.sectionCode === 'version-context') {
        content = `${renderVersionContext(viewModel)}<div class="guide-v2-markdown">${renderMarkdownSafe(section.content, {
          stripFirstHeading: true,
          minimumHeadingLevel: 2,
          tableCaption: title
        })}</div>`;
      } else if (structuredSections[section.sectionCode]) {
        content = structuredSections[section.sectionCode]();
      } else {
        content = `<div class="guide-v2-markdown">${renderMarkdownSafe(section.content, {
          stripFirstHeading: true,
          minimumHeadingLevel: 3,
          tableCaption: title
        })}</div>`;
        if (section.sectionCode === 'action-figures') content += renderEconomyFigures(viewModel);
        if (section.sectionCode === 'versus-characters') content += renderVersusEconomy(viewModel);
        if (section.sectionCode === 'versus') content += renderOnline(viewModel);
      }

      return `<section id="${escapeHtml(section.anchor)}" class="guide-v2-editorial-section guide-v2-panel" data-v2-section="${escapeHtml(section.sectionCode)}" data-content-format="${escapeHtml(section.contentFormat)}" data-section-order="${escapeHtml(section.order)}">
        ${isLogicalH1 ? '' : `<h2>${escapeHtml(title)}</h2>`}
        ${content}
        ${section.relatedTrophyCodes.length ? `<footer><strong>Troféus relacionados</strong>${renderTrophyLinks(section.relatedTrophyCodes, trophyByCode)}</footer>` : ''}
      </section>`;
    })
    .join('');
}

function renderGuideV2Content(viewModel) {
  assertGuideV2Renderable(viewModel);
  return `<article class="guide guide-v2" data-guide-source="v2" data-guide-v2 data-guide-slug="${escapeHtml(viewModel.game.slug)}" data-game-id="${escapeHtml(viewModel.game.id)}">
    ${renderBreadcrumbs(viewModel)}
    ${renderHeader(viewModel)}
    ${renderStaticProgress(viewModel)}
    ${renderSectionIndex(viewModel)}
    ${renderTrophyPackages(viewModel)}
    <div class="guide-v2-editorial-sections">${renderEditorialSections(viewModel)}</div>
  </article>`;
}

function renderGuideV2Page(viewModel, options = {}) {
  assertGuideV2Renderable(viewModel);
  const head = renderGuideV2Head(viewModel, options);
  const stylesheetHref = options.stylesheetHref || '/css/guide-v2.css';
  return `<!doctype html>
<html lang="pt-BR" data-guide-source="v2">
<head>
  ${head.html}
  <link rel="icon" href="/favicon.png" type="image/png" sizes="64x64">
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="${escapeHtml(stylesheetHref)}">
</head>
<body class="guide-v2-page" data-page="guide" data-guide-source="v2">
  <a class="guide-v2-skip-link" href="#conteudo-principal">Pular para o conteúdo principal</a>
  <header class="guide-v2-site-header">
    <a class="guide-v2-brand" href="/" aria-label="AtlasAchievement — página inicial">
      <img src="/assets/brand/atlasachievement-logo.png" width="44" height="44" alt="AtlasAchievement">
      <span>AtlasAchievement</span>
    </a>
    <nav aria-label="Navegação principal"><a href="/">Início</a><a href="/catalogo">Jogos</a></nav>
  </header>
  <main id="conteudo-principal" tabindex="-1">
    ${renderGuideV2Content(viewModel)}
  </main>
  <footer class="guide-v2-site-footer"><a href="/">AtlasAchievement</a><span>Guias de troféus em português.</span></footer>
  <script src="/js/guide-progress-v2.js" defer></script>
  <script src="/js/re5-guide-progress-v2.js" defer></script>
</body>
</html>`;
}

function renderGuideV2ErrorPage(options = {}) {
  const title = options.title || 'Guia indisponível — AtlasAchievement';
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="robots" content="noindex,follow">
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/guide-v2.css">
</head>
<body class="guide-v2-page"><a class="guide-v2-skip-link" href="#conteudo-principal">Pular para o conteúdo principal</a>
  <main id="conteudo-principal"><article class="guide guide-v2 guide-v2-error"><h1>Guia temporariamente indisponível</h1><p>Não foi possível carregar uma origem completa e validada para este guia.</p><a href="/catalogo">Voltar para Jogos</a></article></main>
</body>
</html>`;
}

module.exports = {
  EXPECTED_PACKAGE_COUNTS,
  GuideV2RenderError,
  assertGuideV2Renderable,
  renderGuideV2Content,
  renderGuideV2Page,
  renderGuideV2ErrorPage
};
