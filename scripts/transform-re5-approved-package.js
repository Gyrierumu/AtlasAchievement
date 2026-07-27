'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');

const {
  ROOT,
  parseArgs,
  normalizeGuideSnapshotV2,
  hashGuideSnapshotV2
} = require('./data-sync-utils');
const {
  RE5_GAME_ID,
  RE5_SLUG,
  RE5_SCHEMA_VERSION,
  RE5_BASE_TROPHY_CODES,
  RE5_ADDITIONAL_TROPHIES,
  RE5_VERSION_SPECS,
  RE5_PACKAGE_SPECS,
  RE5_EXPECTED_COUNTS,
  RE5_EXPECTED_TYPE_COUNTS,
  RE5_STAGE_CODES,
  RE5_GUIDE_SECTION_CODES
} = require('../src/shared/re5V2Constants');
const {
  assertGuideSnapshotV2
} = require('../src/validators/guideSnapshotV2.validator');

const DEFAULT_IMPORT_DIR = path.join(ROOT, 'docs', 'imports', RE5_SLUG);
const DEFAULT_OUTPUT_PATH = path.join(ROOT, 'data', 'guides', `${RE5_SLUG}.json`);
const VERIFIED_AT = '2026-07-26';

const APPROVED_FILES = Object.freeze({
  guide: 'Resident_Evil_5_Guia_Publico_Final.md',
  workbook: 'Resident_Evil_5_Matriz_Final_71.xlsx',
  sources: 'Resident_Evil_5_Relatorio_Fontes.md',
  uncertainties: 'Resident_Evil_5_Incertezas.md',
  audit: 'Resident_Evil_5_Auditoria_Portao_C.md',
  checklist: 'Resident_Evil_5_Checklist_Implementacao.md',
  manifest: 'Resident_Evil_5_Manifesto_Entrega.md'
});

const APPROVED_HASHES = Object.freeze({
  [APPROVED_FILES.guide]: 'a8d9de746391d6e7701670890f72bc79231e1f88826921794567c441d744ed0e',
  [APPROVED_FILES.workbook]: 'a678358d8953975e797f3beb091de43cf5cc8e75512f063c209d15f672570434',
  [APPROVED_FILES.sources]: 'c87e53b8b59f70f333fec508f1935420f5465e77e324e49ed2c8f95a61663fdb',
  [APPROVED_FILES.uncertainties]: 'bdcd17e3266d8309a910b595a7d01e156d32dede129966f847cd56f1cfd0dcec',
  [APPROVED_FILES.audit]: '9b1b47ee81c46e557ec6c6eed3b1efee6975c2245fc2f94a85f4d0b1fdb9664c',
  [APPROVED_FILES.checklist]: '0e4ea9e5f3610020d6a4f60794d5451e6dacbdd8100ccd6c14c61b1571179dfd',
  [APPROVED_FILES.manifest]: '39500cd26d40185d5c3a8c8aea57c4168d600e82e8348b844e9c655ad559a777'
});

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function requireApprovedMaterials(importDir = DEFAULT_IMPORT_DIR) {
  const files = {};
  for (const [role, fileName] of Object.entries(APPROVED_FILES)) {
    const filePath = path.join(importDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`RE5_V2_APPROVED_MATERIAL_MISSING: ${fileName}`);
    }
    const hash = sha256File(filePath);
    if (hash !== APPROVED_HASHES[fileName]) {
      throw new Error(`RE5_V2_APPROVED_MATERIAL_HASH_MISMATCH: ${fileName}`);
    }
    files[role] = filePath;
  }
  return files;
}

function cellValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  if (Object.prototype.hasOwnProperty.call(value, 'result')) return value.result;
  if (typeof value.text === 'string') return value.text;
  if (Array.isArray(value.richText)) return value.richText.map(item => item.text || '').join('');
  if (typeof value.hyperlink === 'string') return value.text || value.hyperlink;
  return String(value);
}

function text(value) {
  const resolved = cellValue(value);
  if (resolved === null || resolved === undefined) return null;
  const normalized = String(resolved).replace(/\r\n?/g, '\n').trim();
  return normalized || null;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function booleanFromPortuguese(value) {
  return /^(sim|yes|true|1)$/i.test(text(value) || '');
}

function stringList(value) {
  const normalized = text(value);
  if (!normalized || normalized === '—' || normalized === '-') return [];
  return normalized.split(/\s*;\s*/).map(item => item.trim()).filter(Boolean);
}

function readMarkdown(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
}

async function normalizeWorkbookForExcelJs(sourceBuffer) {
  const zip = await JSZip.loadAsync(sourceBuffer);
  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue;
    let xml = await zip.files[name].async('string');
    if (xml.includes('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')) {
      xml = xml
        .replace(
          'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
          'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
        )
        .replace(/<x:/g, '<')
        .replace(/<\/x:/g, '</');
    }
    if (name.startsWith('xl/worksheets/_rels/')) {
      xml = xml
        .replace(/Target="\/xl\/tables\//g, 'Target="../tables/')
        .replace(/Target="\/xl\/drawings\//g, 'Target="../drawings/');
    }
    zip.file(name, xml);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function loadApprovedWorkbook(workbookPath) {
  const workbook = new ExcelJS.Workbook();
  const normalizedBuffer = await normalizeWorkbookForExcelJs(fs.readFileSync(workbookPath));
  await workbook.xlsx.load(normalizedBuffer);
  return workbook;
}

function sheetRecords(workbook, sheetName, headerRow = 3, startRow = headerRow + 1) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`RE5_V2_REQUIRED_SHEET_MISSING: ${sheetName}`);
  const headers = sheet.getRow(headerRow).values.slice(1).map(value => text(value));
  const records = [];
  for (let rowNumber = startRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const values = sheet.getRow(rowNumber).values.slice(1);
    if (!values.some(value => text(value) !== null)) continue;
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = cellValue(values[index]);
    });
    records.push(record);
  }
  return records;
}

function packageCodeFromLabel(label) {
  const normalized = slugify(label);
  const mapping = {
    'jogo-base': 'base',
    versus: 'versus',
    'lost-in-nightmares': 'lost-in-nightmares',
    'desperate-escape': 'desperate-escape'
  };
  const packageCode = mapping[normalized];
  if (!packageCode) throw new Error(`RE5_V2_UNKNOWN_PACKAGE: ${label}`);
  return packageCode;
}

function trophyCodeFor(globalOrder, packageCode) {
  if (globalOrder <= RE5_BASE_TROPHY_CODES.length) {
    return RE5_BASE_TROPHY_CODES[globalOrder - 1];
  }
  const additional = RE5_ADDITIONAL_TROPHIES.find(item => (
    item.packageCode === packageCode
    && item.displayOrder === (
      globalOrder
      - RE5_BASE_TROPHY_CODES.length
      - (packageCode === 'lost-in-nightmares' ? 10 : 0)
      - (packageCode === 'desperate-escape' ? 15 : 0)
    )
  ));
  if (additional) return additional.trophyCode;

  const byGlobalOrder = RE5_ADDITIONAL_TROPHIES[globalOrder - RE5_BASE_TROPHY_CODES.length - 1];
  if (!byGlobalOrder || byGlobalOrder.packageCode !== packageCode) {
    throw new Error(`RE5_V2_TROPHY_CODE_MAPPING_FAILED: ${globalOrder}/${packageCode}`);
  }
  return byGlobalOrder.trophyCode;
}

function stageCodeFromLabel(label) {
  const match = (text(label) || '').match(/(?:etapa\s*)?([1-9])/i);
  if (!match) throw new Error(`RE5_V2_TROPHY_WITHOUT_STAGE: ${label || '(empty)'}`);
  return RE5_STAGE_CODES[Number(match[1]) - 1];
}

function transformTrophies(workbook) {
  const records = sheetRecords(workbook, 'Matriz_71');
  if (records.length !== RE5_EXPECTED_COUNTS.total) {
    throw new Error(`RE5_V2_MATRIX_COUNT_MISMATCH: ${records.length}`);
  }
  const packageOrders = new Map();
  return records.map((record, index) => {
    const globalOrder = index + 1;
    const packageCode = packageCodeFromLabel(record.Pacote);
    const displayOrder = (packageOrders.get(packageCode) || 0) + 1;
    packageOrders.set(packageCode, displayOrder);
    const sourceCodes = stringList(record.Fonte);
    if (!text(record['Método executável'])) {
      throw new Error(`RE5_V2_TROPHY_WITHOUT_METHOD: row ${globalOrder}`);
    }
    return {
      trophyCode: trophyCodeFor(globalOrder, packageCode),
      sourceTrophyCode: null,
      packageCode,
      displayOrder,
      globalOrder,
      name: text(record['Troféu']),
      type: text(record.Tipo),
      description: text(record['Descrição oficial']),
      category: slugify(record.Categoria),
      isAutomatic: /automatic/i.test(slugify(record.Categoria)),
      isOnline: booleanFromPortuguese(record.Online),
      isCoop: /opcional|sim|recomendado/i.test(text(record.Coop) || ''),
      isCumulative: booleanFromPortuguese(record.Cumulativo),
      isMissable: booleanFromPortuguese(record['Perdível']),
      campaign: text(record.Campanha),
      stageCode: stageCodeFromLabel(record.Etapa),
      moment: text(record.Momento),
      prerequisites: text(record['Pré-requisitos']),
      method: text(record['Método executável']),
      risk: text(record.Risco),
      prevention: text(record['Prevenção']),
      recovery: text(record['Recuperação']),
      cleanup: text(record['Limpeza']),
      save: text(record.Save),
      dependencies: stringList(record['Dependências']),
      sourceCodes,
      confidence: text(record['Confiança']),
      status: text(record.Status)
    };
  });
}

function transformRoadmap(workbook, trophies) {
  const records = sheetRecords(workbook, 'Rota_Definitiva');
  if (records.length !== 9) throw new Error(`RE5_V2_ROADMAP_COUNT_MISMATCH: ${records.length}`);
  const collectibleGroupsByStage = [
    ['bsaa-emblems', 'treasures'],
    ['figures', 'inventory', 'upgrades'],
    [],
    [],
    [],
    ['score-stars'],
    [],
    [],
    []
  ];
  return records.map((record, index) => {
    const stageCode = RE5_STAGE_CODES[index];
    return {
      stageCode,
      order: index + 1,
      title: text(record.Etapa),
      objective: text(record.Objetivo),
      difficulty: text(record['Dificuldade/modo']),
      packageCodes: [packageCodeFromLabel(record.Pacote)],
      trophyCodes: trophies
        .filter(trophy => trophy.stageCode === stageCode)
        .map(trophy => trophy.trophyCode),
      collectibleGroups: collectibleGroupsByStage[index],
      saveCodes: [],
      warnings: text(record['Risco principal']) ? [text(record['Risco principal'])] : [],
      completionCondition: text(record['Condição de saída'])
    };
  });
}

const PUBLIC_SECTION_STARTS = Object.freeze([
  ['version-context', /^# Resident Evil 5 — Guia de Platina e 100%$/],
  ['summary', /^## Resumo$/],
  ['critical-warnings', /^## Avisos críticos$/],
  ['progress-behavior', /^## Como o progresso funciona$/],
  ['non-shared-conditions', /^### Condições que não compartilham progresso$/],
  ['strategic-saves', /^## Saves estratégicos$/],
  ['roadmap', /^# Roadmap$/],
  ['normal-campaign', /^# Etapa 1 — Campanha Normal$/],
  ['bsaa-emblems', /^## Rota dos 30 BSAA Emblems$/],
  ['treasures', /^## Rota dos 50 tipos de tesouro$/],
  ['chapter-opportunities', /^## Oportunidades por capítulo$/],
  ['amateur-ranks-time', /^# Etapa 2 — Amateur, ranks, tempo e limpeza$/],
  ['infinite-rocket-launcher', /^## Infinite Rocket Launcher$/],
  ['combat-trophies', /^## Troféus cumulativos e de combate$/],
  ['egg-hunt', /^## `Egg Hunt`$/],
  ['all-dressed-up', /^## `All Dressed Up`$/],
  ['stockpile', /^## `Stockpile`/],
  ['upgrades', /^## `Take It to the Max`/],
  ['money-farm', /^### Farm de dinheiro$/],
  ['action-figures', /^## `They're ACTION Figures!`$/],
  ['veteran', /^# Etapa 3 — Veteran$/],
  ['professional', /^# Etapa 4 — Professional$/],
  ['versus', /^# Após a platina — Versus$/],
  ['versus-characters', /^## Personagens adicionais/],
  ['lost-in-nightmares', /^# Após a platina — Lost in Nightmares$/],
  ['score-stars', /^### `Wish Upon a Star`/],
  ['desperate-escape', /^# Após a platina — Desperate Escape$/],
  ['agitators', /^## Passagem 2 — Veteran e três Agitators$/],
  ['final-verification', /^# Verificação final$/]
]);

function headingTitle(markdown) {
  const firstLine = markdown.split('\n').find(line => /^#{1,6}\s+/.test(line));
  return firstLine ? firstLine.replace(/^#{1,6}\s+/, '').trim() : 'Resident Evil 5';
}

function relatedTrophyCodes(content, trophies) {
  const normalizedContent = content.toLocaleLowerCase('pt-BR');
  return trophies
    .filter(trophy => normalizedContent.includes(trophy.name.toLocaleLowerCase('pt-BR')))
    .map(trophy => trophy.trophyCode);
}

function transformGuideContent(files, trophies) {
  const publicGuide = readMarkdown(files.guide);
  const lines = publicGuide.split('\n');
  const sections = PUBLIC_SECTION_STARTS.map(([sectionCode, pattern]) => {
    const start = lines.findIndex(line => pattern.test(line));
    if (start < 0) throw new Error(`RE5_V2_GUIDE_SECTION_MISSING: ${sectionCode}`);
    return { sectionCode, start };
  }).sort((left, right) => left.start - right.start);

  const transformed = sections.map((section, index) => {
    const end = sections[index + 1]?.start ?? lines.length;
    const content = lines.slice(section.start, end).join('\n').trim();
    return {
      sectionCode: section.sectionCode,
      order: index + 1,
      title: headingTitle(content),
      headingLevel: section.sectionCode === 'version-context' ? 1 : 2,
      anchor: section.sectionCode,
      contentFormat: 'markdown',
      content,
      relatedTrophyCodes: relatedTrophyCodes(content, trophies)
    };
  });

  const sourcesContent = readMarkdown(files.sources);
  transformed.push({
    sectionCode: 'sources',
    order: transformed.length + 1,
    title: 'Fontes',
    headingLevel: 2,
    anchor: 'sources',
    contentFormat: 'markdown',
    content: sourcesContent,
    relatedTrophyCodes: []
  });

  const reviewContent = [
    readMarkdown(files.audit),
    readMarkdown(files.uncertainties),
    readMarkdown(files.checklist),
    readMarkdown(files.manifest)
  ].join('\n\n---\n\n');
  transformed.push({
    sectionCode: 'review',
    order: transformed.length + 1,
    title: 'Revisão editorial e controles',
    headingLevel: 2,
    anchor: 'review',
    contentFormat: 'markdown',
    content: reviewContent,
    relatedTrophyCodes: []
  });

  const actualCodes = transformed.map(item => item.sectionCode);
  if (JSON.stringify(actualCodes) !== JSON.stringify(RE5_GUIDE_SECTION_CODES)) {
    throw new Error(`RE5_V2_GUIDE_SECTION_ORDER_MISMATCH: ${actualCodes.join(',')}`);
  }
  return transformed;
}

function transformCollectibles(workbook) {
  const bsaa = sheetRecords(workbook, 'BSAA_30').map((record, index) => ({
    id: `re5-bsaa-${String(index + 1).padStart(3, '0')}`,
    kind: 'bsaa-emblem',
    order: index + 1,
    chapter: text(record['Capítulo']),
    area: text(record['Área']),
    instruction: text(record['Referência executável']),
    returnPossible: /chapter select/i.test(text(record['Recuperação']) || ''),
    sameRunRequired: false,
    relatedTrophyCodes: ['re5_badge_of_honor']
  }));
  const treasures = sheetRecords(workbook, 'Tesouros_Rota_50').map((record, index) => ({
    id: `re5-treasure-${String(index + 1).padStart(3, '0')}`,
    kind: 'treasure',
    order: bsaa.length + index + 1,
    name: text(record.Tesouro),
    chapter: text(record['Capítulo']),
    area: null,
    instruction: text(record['Referência operacional']),
    firstSafeOccurrence: text(record['Capítulo']),
    canSellAfterRegistration: booleanFromPortuguese(record['Pode vender após registrar?']),
    relatedTrophyCodes: ['re5_museum']
  }));
  if (bsaa.length !== 30 || treasures.length !== 50) {
    throw new Error(`RE5_V2_COLLECTIBLE_COUNT_MISMATCH: ${bsaa.length}/${treasures.length}`);
  }
  return [...bsaa, ...treasures];
}

function transformInventoryRequirements(workbook) {
  const records = sheetRecords(workbook, 'Stockpile_27');
  if (records.length !== 27) throw new Error(`RE5_V2_STOCKPILE_COUNT_MISMATCH: ${records.length}`);
  return records.map((record, index) => ({
    id: `re5-stockpile-${String(index + 1).padStart(3, '0')}`,
    order: index + 1,
    name: text(record.Item),
    group: text(record.Categoria),
    unlockRequirement: text(record['Origem/desbloqueio']),
    mustExistSimultaneously: true,
    relatedTrophyCodes: ['re5_stockpile']
  }));
}

function transformUpgradeRequirements(workbook) {
  const records = sheetRecords(workbook, 'Upgrades_18');
  if (records.length !== 18) throw new Error(`RE5_V2_UPGRADE_COUNT_MISMATCH: ${records.length}`);
  return records.map((record, index) => ({
    id: `re5-upgrade-${String(index + 1).padStart(3, '0')}`,
    order: index + 1,
    name: text(record.Arma),
    weaponClass: text(record.Categoria),
    unlockChain: text(record['Dependência/cadeia']),
    fullyUpgradable: true,
    relatedTrophyCodes: ['re5_take_it_to_the_max']
  }));
}

function transformEconomy(workbook) {
  const sheet = workbook.getWorksheet('Versus');
  const entries = [];
  for (let rowNumber = 17; rowNumber <= 24; rowNumber += 1) {
    const row = sheet.getRow(rowNumber).values.slice(1);
    entries.push({
      order: entries.length + 1,
      name: text(row[0]),
      cost: Number(cellValue(row[1])),
      note: text(row[2])
    });
  }
  return {
    currency: 'Exchange Points',
    figures: {
      total: 46,
      free: 2,
      paid: 44,
      unitCost: 500,
      totalCost: 22000
    },
    versusCharacters: {
      total: 8,
      totalCost: 134000,
      entries
    }
  };
}

function transformOnline() {
  return {
    requiredForPlatinum: false,
    requiredFor100Percent: true,
    minimumPlayersSoloModes: 2,
    minimumPlayersTeamModes: 4,
    recommendedBoostMap: 'Public Assembly',
    slayersWins: 15,
    survivorsWins: 15,
    teamSlayersWins: 15,
    teamSurvivorsWins: 15,
    physicalEliminations: 50,
    statusLastVerifiedAt: VERIFIED_AT,
    statusConfidence: 'Média'
  };
}

function transformSources(workbook) {
  const records = sheetRecords(workbook, 'Fontes');
  const sources = records.map(record => ({
    sourceCode: text(record.ID),
    title: text(record.Fonte),
    url: text(record.URL),
    sourceType: text(record.Tipo),
    scope: text(record.Uso),
    confidence: text(record['Confiança']),
    lastVerifiedAt: VERIFIED_AT
  }));
  sources.push({
    sourceCode: 'ATLAS',
    title: 'Análise editorial AtlasAchievement — pacote aprovado de Resident Evil 5',
    url: 'docs/imports/resident-evil-5/Resident_Evil_5_Matriz_Final_71.xlsx',
    sourceType: 'Análise editorial interna',
    scope: 'Decisões de rota derivadas e auditadas no pacote aprovado.',
    confidence: 'Alta',
    lastVerifiedAt: VERIFIED_AT
  });
  return sources;
}

function transformClaims(workbook) {
  return sheetRecords(workbook, 'Dossie').map((record, index) => {
    const sourceCodes = stringList(record.Fonte).flatMap(source => (
      source === 'Análise Atlas' ? ['ATLAS'] : [source]
    ));
    if (!sourceCodes.length) {
      throw new Error(`RE5_V2_CLAIM_WITHOUT_SOURCE: row ${index + 4}`);
    }
    const subject = text(record.Tema);
    return {
      claimCode: `re5-claim-${String(index + 1).padStart(3, '0')}`,
      statement: text(record['Conclusão operacional']),
      versionScope: /ps4|ps5|vers[aã]o|stack|save|autopop|upgrade/i.test(subject || '')
        ? 'ps4-and-ps5-backcompat'
        : 'all',
      confidence: text(record['Confiança']),
      sourceCodes,
      impact: subject
    };
  });
}

function assertWorkbookTotals(snapshot) {
  const packageCounts = Object.fromEntries(
    RE5_PACKAGE_SPECS.map(pkg => [
      pkg.packageCode,
      snapshot.trophies.filter(trophy => trophy.packageCode === pkg.packageCode).length
    ])
  );
  const typeCounts = snapshot.trophies.reduce((counts, trophy) => {
    counts[trophy.type] = (counts[trophy.type] || 0) + 1;
    return counts;
  }, {});
  if (JSON.stringify(packageCounts) !== JSON.stringify(RE5_EXPECTED_COUNTS)) {
    const comparableExpected = { ...RE5_EXPECTED_COUNTS };
    delete comparableExpected.total;
    if (JSON.stringify(packageCounts) !== JSON.stringify(comparableExpected)) {
      throw new Error(`RE5_V2_PACKAGE_TOTALS_MISMATCH: ${JSON.stringify(packageCounts)}`);
    }
  }
  for (const [type, count] of Object.entries(RE5_EXPECTED_TYPE_COUNTS)) {
    if (typeCounts[type] !== count) {
      throw new Error(`RE5_V2_TYPE_TOTAL_MISMATCH: ${type}=${typeCounts[type]}`);
    }
  }
}

async function transformRe5ApprovedPackage(options = {}) {
  const importDir = path.resolve(options.importDir || DEFAULT_IMPORT_DIR);
  const files = requireApprovedMaterials(importDir);
  const workbook = await loadApprovedWorkbook(files.workbook);
  const trophies = transformTrophies(workbook);
  const snapshot = {
    schemaVersion: RE5_SCHEMA_VERSION,
    game: {
      id: RE5_GAME_ID,
      slug: RE5_SLUG,
      name: 'Resident Evil 5',
      url: '/jogo/resident-evil-5',
      scope: 'platinum-and-100-percent',
      baseTrophyCount: 51,
      totalTrophyCount: 71
    },
    versions: RE5_VERSION_SPECS.map(item => ({ ...item })),
    trophyPackages: RE5_PACKAGE_SPECS.map(item => ({ ...item })),
    trophies,
    roadmap: transformRoadmap(workbook, trophies),
    guideContent: transformGuideContent(files, trophies),
    collectibles: transformCollectibles(workbook),
    inventoryRequirements: transformInventoryRequirements(workbook),
    upgradeRequirements: transformUpgradeRequirements(workbook),
    economy: transformEconomy(workbook),
    online: transformOnline(),
    sources: transformSources(workbook),
    claims: transformClaims(workbook),
    seo: {
      title: 'Resident Evil 5 — Guia de Platina e 100%',
      description: 'Rota completa de Resident Evil 5 para os 51 troféus da platina e os 20 troféus adicionais, com coletáveis, DLCs e Versus.',
      canonicalPath: '/jogo/resident-evil-5',
      h1: 'Resident Evil 5 — Guia de Platina e 100%'
    },
    review: {
      status: 'approved',
      reviewedAt: VERIFIED_AT,
      reviewerCode: 'atlas-portao-c'
    },
    redirects: [
      {
        from: '/jogos/resident-evil-5',
        to: '/jogo/resident-evil-5',
        displayOrder: 1
      }
    ]
  };
  assertWorkbookTotals(snapshot);
  assertGuideSnapshotV2(snapshot, { mode: 'complete' });
  return normalizeGuideSnapshotV2(snapshot);
}

async function main() {
  const args = parseArgs();
  const outputPath = path.resolve(args.output || DEFAULT_OUTPUT_PATH);
  const snapshot = await transformRe5ApprovedPackage({ importDir: args.importDir });
  const hash = hashGuideSnapshotV2(snapshot);
  if (!args.dryRun) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify({
    ok: true,
    mode: args.dryRun ? 'dry-run' : 'write',
    output: outputPath,
    hash,
    trophies: snapshot.trophies.length,
    sections: snapshot.guideContent.length
  }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  APPROVED_FILES,
  APPROVED_HASHES,
  DEFAULT_IMPORT_DIR,
  DEFAULT_OUTPUT_PATH,
  requireApprovedMaterials,
  loadApprovedWorkbook,
  transformRe5ApprovedPackage
};
