'use strict';

const {
  RE5_GAME_ID,
  RE5_SLUG,
  RE5_SCHEMA_VERSION,
  RE5_EXPECTED_COUNTS,
  RE5_EXPECTED_TYPE_COUNTS,
  RE5_EXPECTED_STRUCTURED_COUNTS,
  RE5_STAGE_CODES,
  RE5_GUIDE_SECTION_CODES,
  RE5_VERSION_SPECS,
  RE5_PACKAGE_SPECS
} = require('../shared/re5V2Constants');

const ROOT_FIELDS = [
  'schemaVersion',
  'game',
  'versions',
  'trophyPackages',
  'trophies',
  'roadmap',
  'guideContent',
  'collectibles',
  'inventoryRequirements',
  'upgradeRequirements',
  'economy',
  'online',
  'sources',
  'claims',
  'seo',
  'review',
  'redirects'
];
const TROPHY_TYPES = new Set(['Platina', 'Ouro', 'Prata', 'Bronze']);
const TECHNICAL_CODE = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class GuideSnapshotV2ValidationError extends Error {
  constructor(errors, warnings = []) {
    super('Invalid Guide Snapshot V2');
    this.name = 'GuideSnapshotV2ValidationError';
    this.code = 'INVALID_GUIDE_SNAPSHOT_V2';
    this.errors = errors;
    this.warnings = warnings;
  }
}

function addError(errors, path, code, message) {
  errors.push({ path, code, message });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, path, errors) {
  if (!isPlainObject(value)) {
    addError(errors, path, 'EXPECTED_OBJECT', `${path} must be an object`);
    return false;
  }
  return true;
}

function requireArray(value, path, errors) {
  if (!Array.isArray(value)) {
    addError(errors, path, 'EXPECTED_ARRAY', `${path} must be an array`);
    return false;
  }
  return true;
}

function rejectUnknownFields(value, allowedFields, path, errors) {
  if (!isPlainObject(value)) return;
  const allowed = new Set(allowedFields);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      addError(
        errors,
        path ? `${path}.${field}` : field,
        'UNKNOWN_FIELD',
        `Unknown field: ${field}`
      );
    }
  }
}

function requireString(value, path, errors, options = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    addError(errors, path, 'EXPECTED_NON_EMPTY_STRING', `${path} must be a non-empty string`);
    return false;
  }
  if (value !== value.trim()) {
    addError(errors, path, 'STRING_NOT_NORMALIZED', `${path} must not have surrounding whitespace`);
  }
  if (options.technical && !TECHNICAL_CODE.test(value)) {
    addError(errors, path, 'INVALID_TECHNICAL_CODE', `${path} must be a stable technical code`);
  }
  return true;
}

function requireBoolean(value, path, errors) {
  if (typeof value !== 'boolean') {
    addError(errors, path, 'EXPECTED_BOOLEAN', `${path} must be a boolean`);
    return false;
  }
  return true;
}

function requireInteger(value, path, errors, minimum = null) {
  if (!Number.isInteger(value) || (minimum !== null && value < minimum)) {
    addError(
      errors,
      path,
      'EXPECTED_INTEGER',
      `${path} must be an integer${minimum === null ? '' : ` >= ${minimum}`}`
    );
    return false;
  }
  return true;
}

function requireDate(value, path, errors) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    addError(errors, path, 'INVALID_DATE', `${path} must use YYYY-MM-DD`);
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    addError(errors, path, 'INVALID_DATE', `${path} must be a real calendar date`);
    return false;
  }
  return true;
}

function requireNullableString(value, path, errors) {
  if (value === null) return true;
  return requireString(value, path, errors);
}

function requireStringArray(value, path, errors, options = {}) {
  if (!requireArray(value, path, errors)) return false;
  value.forEach((item, index) => {
    requireString(item, `${path}[${index}]`, errors, options);
  });
  return true;
}

function requireDeterministicOrder(items, path, errors, selector = item => item?.displayOrder) {
  for (let index = 0; index < items.length; index += 1) {
    if (selector(items[index], index) !== index + 1) {
      addError(
        errors,
        `${path}[${index}].displayOrder`,
        'NON_DETERMINISTIC_ORDER',
        `${path} must be sorted with contiguous displayOrder values`
      );
      return;
    }
  }
}

function validateGame(game, mode, errors) {
  if (!requireObject(game, 'game', errors)) return;
  const allowedFields = mode === 'complete'
    ? ['id', 'slug', 'name', 'url', 'scope', 'baseTrophyCount', 'totalTrophyCount']
    : ['id', 'slug', 'name', 'url'];
  rejectUnknownFields(game, allowedFields, 'game', errors);
  if (game.id !== RE5_GAME_ID) {
    addError(errors, 'game.id', 'INVALID_GAME_ID', `game.id must be ${RE5_GAME_ID}`);
  }
  if (game.slug !== RE5_SLUG) {
    addError(errors, 'game.slug', 'INVALID_GAME_SLUG', `game.slug must be ${RE5_SLUG}`);
  }
  if (game.name !== 'Resident Evil 5') {
    addError(errors, 'game.name', 'INVALID_GAME_NAME', 'game.name must be Resident Evil 5');
  }
  if (game.url !== '/jogo/resident-evil-5') {
    addError(errors, 'game.url', 'INVALID_GAME_URL', 'game.url must be /jogo/resident-evil-5');
  }
  if (mode === 'complete') {
    if (game.scope !== 'platinum-and-100-percent') {
      addError(errors, 'game.scope', 'INVALID_GAME_SCOPE', 'game.scope must be platinum-and-100-percent');
    }
    if (game.baseTrophyCount !== 51) {
      addError(errors, 'game.baseTrophyCount', 'INVALID_BASE_COUNT', 'game.baseTrophyCount must be 51');
    }
    if (game.totalTrophyCount !== 71) {
      addError(errors, 'game.totalTrophyCount', 'INVALID_TOTAL_COUNT', 'game.totalTrophyCount must be 71');
    }
  }
}

function validateVersions(versions, errors) {
  if (!requireArray(versions, 'versions', errors)) return;
  if (versions.length !== RE5_VERSION_SPECS.length) {
    addError(errors, 'versions', 'INVALID_VERSION_COUNT', 'Exactly two version records are required');
  }

  const allowedFields = [
    'versionCode',
    'platform',
    'region',
    'releaseKind',
    'displayOrder',
    'isNative',
    'nativeTrophyList',
    'saveTransferSupported',
    'autopopSupported',
    'upgradeSupported',
    'sourceVersionCode'
  ];
  const codes = new Set();
  const platforms = new Set();

  versions.forEach((version, index) => {
    const path = `versions[${index}]`;
    if (!requireObject(version, path, errors)) return;
    rejectUnknownFields(version, allowedFields, path, errors);
    requireString(version.versionCode, `${path}.versionCode`, errors, { technical: true });
    requireString(version.platform, `${path}.platform`, errors);
    requireString(version.region, `${path}.region`, errors, { technical: true });
    requireString(version.releaseKind, `${path}.releaseKind`, errors, { technical: true });
    requireInteger(version.displayOrder, `${path}.displayOrder`, errors, 1);
    for (const field of [
      'isNative',
      'nativeTrophyList',
      'saveTransferSupported',
      'autopopSupported',
      'upgradeSupported'
    ]) {
      requireBoolean(version[field], `${path}.${field}`, errors);
    }
    if (
      version.sourceVersionCode !== null
      && !requireString(version.sourceVersionCode, `${path}.sourceVersionCode`, errors, { technical: true })
    ) {
      addError(errors, `${path}.sourceVersionCode`, 'INVALID_VERSION_SOURCE', 'Invalid source version');
    }
    if (codes.has(version.versionCode)) {
      addError(errors, `${path}.versionCode`, 'DUPLICATE_VERSION_CODE', 'Version code must be unique');
    }
    if (platforms.has(version.platform)) {
      addError(errors, `${path}.platform`, 'DUPLICATE_VERSION_PLATFORM', 'Platform must be unique');
    }
    codes.add(version.versionCode);
    platforms.add(version.platform);
  });
  requireDeterministicOrder(versions, 'versions', errors);

  for (const spec of RE5_VERSION_SPECS) {
    const version = versions.find(item => item?.versionCode === spec.versionCode);
    if (!version) {
      addError(errors, 'versions', 'MISSING_REQUIRED_VERSION', `Missing ${spec.versionCode}`);
      continue;
    }
    for (const [field, expected] of Object.entries(spec)) {
      if (version[field] !== expected) {
        addError(
          errors,
          `versions[${versions.indexOf(version)}].${field}`,
          field === 'sourceVersionCode'
            ? 'INVALID_BACKWARD_COMPATIBILITY'
            : 'INVALID_VERSION_CONTRACT',
          `${spec.versionCode}.${field} must equal ${String(expected)}`
        );
      }
    }
  }

  if (versions.filter(item => item?.nativeTrophyList === true).length !== 1) {
    addError(errors, 'versions', 'INVALID_NATIVE_LIST_COUNT', 'Exactly one native trophy list is required');
  }
  if (versions.some(item => item?.sourceVersionCode === item?.versionCode)) {
    addError(errors, 'versions', 'VERSION_SOURCE_CYCLE', 'A version cannot source itself');
  }
}

function validatePackages(packages, errors) {
  if (!requireArray(packages, 'trophyPackages', errors)) return;
  if (packages.length !== RE5_PACKAGE_SPECS.length) {
    addError(errors, 'trophyPackages', 'INVALID_PACKAGE_COUNT', 'Exactly four trophy packages are required');
  }

  const allowedFields = [
    'packageCode',
    'name',
    'packageType',
    'displayOrder',
    'expectedTrophyCount',
    'countsForPlatinum',
    'countsFor100Percent',
    'isOnline',
    'isCoop'
  ];
  const codes = new Set();
  const orders = new Set();
  packages.forEach((pkg, index) => {
    const path = `trophyPackages[${index}]`;
    if (!requireObject(pkg, path, errors)) return;
    rejectUnknownFields(pkg, allowedFields, path, errors);
    requireString(pkg.packageCode, `${path}.packageCode`, errors, { technical: true });
    requireString(pkg.name, `${path}.name`, errors);
    requireString(pkg.packageType, `${path}.packageType`, errors, { technical: true });
    requireInteger(pkg.displayOrder, `${path}.displayOrder`, errors, 1);
    requireInteger(pkg.expectedTrophyCount, `${path}.expectedTrophyCount`, errors, 1);
    for (const field of ['countsForPlatinum', 'countsFor100Percent', 'isOnline', 'isCoop']) {
      requireBoolean(pkg[field], `${path}.${field}`, errors);
    }
    if (codes.has(pkg.packageCode)) {
      addError(errors, `${path}.packageCode`, 'DUPLICATE_PACKAGE_CODE', 'Package code must be unique');
    }
    if (orders.has(pkg.displayOrder)) {
      addError(errors, `${path}.displayOrder`, 'DUPLICATE_PACKAGE_ORDER', 'Package order must be unique');
    }
    codes.add(pkg.packageCode);
    orders.add(pkg.displayOrder);
  });
  requireDeterministicOrder(packages, 'trophyPackages', errors);

  for (const spec of RE5_PACKAGE_SPECS) {
    const pkg = packages.find(item => item?.packageCode === spec.packageCode);
    if (!pkg) {
      addError(errors, 'trophyPackages', 'MISSING_REQUIRED_PACKAGE', `Missing ${spec.packageCode}`);
      continue;
    }
    for (const [field, expected] of Object.entries(spec)) {
      if (pkg[field] !== expected) {
        addError(
          errors,
          `trophyPackages[${packages.indexOf(pkg)}].${field}`,
          'INVALID_PACKAGE_CONTRACT',
          `${spec.packageCode}.${field} must equal ${String(expected)}`
        );
      }
    }
  }

  if (packages.filter(item => item?.packageType === 'base').length !== 1) {
    addError(errors, 'trophyPackages', 'INVALID_BASE_PACKAGE_COUNT', 'Exactly one base package is required');
  }
  if (packages.filter(item => item?.countsForPlatinum === true).length !== 1) {
    addError(errors, 'trophyPackages', 'INVALID_PLATINUM_PACKAGE_COUNT', 'Only base counts for platinum');
  }
}

function validateTrophies(trophies, packages, mode, errors) {
  if (!requireArray(trophies, 'trophies', errors)) return;
  if (trophies.length === 0) {
    addError(errors, 'trophies', 'EMPTY_TROPHY_LIST', 'At least one trophy is required');
  }

  const minimalFields = [
    'trophyCode',
    'packageCode',
    'displayOrder',
    'name',
    'type',
    'description',
    'isOnline',
    'isCoop',
    'isCumulative',
    'isMissable',
    'category',
    'sourceTrophyCode'
  ];
  const completeFields = [
    'trophyCode',
    'sourceTrophyCode',
    'packageCode',
    'displayOrder',
    'globalOrder',
    'name',
    'type',
    'description',
    'category',
    'isAutomatic',
    'isOnline',
    'isCoop',
    'isCumulative',
    'isMissable',
    'campaign',
    'stageCode',
    'moment',
    'prerequisites',
    'method',
    'risk',
    'prevention',
    'recovery',
    'cleanup',
    'save',
    'dependencies',
    'sourceCodes',
    'confidence',
    'status'
  ];
  const allowedFields = mode === 'complete' ? completeFields : minimalFields;
  const packageCodes = new Set(Array.isArray(packages) ? packages.map(item => item?.packageCode) : []);
  const packageOrder = new Map(RE5_PACKAGE_SPECS.map(item => [item.packageCode, item.displayOrder]));
  const codes = new Set();
  const sourceCodes = new Set();
  const ordersByPackage = new Map();

  trophies.forEach((trophy, index) => {
    const path = `trophies[${index}]`;
    if (!requireObject(trophy, path, errors)) return;
    rejectUnknownFields(trophy, allowedFields, path, errors);
    requireString(trophy.trophyCode, `${path}.trophyCode`, errors, { technical: true });
    requireString(trophy.packageCode, `${path}.packageCode`, errors, { technical: true });
    requireInteger(trophy.displayOrder, `${path}.displayOrder`, errors, 1);
    if (mode === 'complete') {
      requireInteger(trophy.globalOrder, `${path}.globalOrder`, errors, 1);
    }
    requireString(trophy.name, `${path}.name`, errors);
    requireString(trophy.description, `${path}.description`, errors);
    requireString(trophy.category, `${path}.category`, errors, { technical: true });
    const booleanFields = ['isOnline', 'isCoop', 'isCumulative', 'isMissable'];
    if (mode === 'complete') booleanFields.unshift('isAutomatic');
    for (const field of booleanFields) {
      requireBoolean(trophy[field], `${path}.${field}`, errors);
    }
    if (!TROPHY_TYPES.has(trophy.type)) {
      addError(errors, `${path}.type`, 'INVALID_TROPHY_TYPE', 'Unsupported trophy type');
    }
    if (codes.has(trophy.trophyCode)) {
      addError(errors, `${path}.trophyCode`, 'DUPLICATE_TROPHY_CODE', 'Trophy code must be globally unique');
    }
    codes.add(trophy.trophyCode);
    if (!packageCodes.has(trophy.packageCode)) {
      addError(errors, `${path}.packageCode`, 'UNKNOWN_PACKAGE_CODE', 'Trophy package does not exist');
    }
    const packageOrders = ordersByPackage.get(trophy.packageCode) || new Set();
    if (packageOrders.has(trophy.displayOrder)) {
      addError(
        errors,
        `${path}.displayOrder`,
        'DUPLICATE_TROPHY_ORDER',
        'Trophy order must be unique inside its package'
      );
    }
    packageOrders.add(trophy.displayOrder);
    ordersByPackage.set(trophy.packageCode, packageOrders);

    if (trophy.packageCode === 'versus' && trophy.isOnline !== true) {
      addError(errors, `${path}.isOnline`, 'VERSUS_MUST_BE_ONLINE', 'Versus trophies must be online');
    }
    if (trophy.packageCode !== 'versus' && trophy.isOnline !== false) {
      addError(errors, `${path}.isOnline`, 'UNEXPECTED_ONLINE_TROPHY', 'Only Versus trophies are online');
    }
    if (trophy.sourceTrophyCode !== null) {
      if (requireString(
        trophy.sourceTrophyCode,
        `${path}.sourceTrophyCode`,
        errors,
        { technical: true }
      )) {
        if (
          trophy.sourceTrophyCode === trophy.trophyCode
          || sourceCodes.has(trophy.sourceTrophyCode)
        ) {
          addError(
            errors,
            `${path}.sourceTrophyCode`,
            'SOURCE_TROPHY_COLLISION',
            'sourceTrophyCode must not create an identity collision'
          );
        }
        sourceCodes.add(trophy.sourceTrophyCode);
      }
    }
    if (mode === 'complete') {
      for (const field of [
        'campaign',
        'moment',
        'prerequisites',
        'risk',
        'prevention',
        'recovery',
        'cleanup',
        'save'
      ]) {
        requireNullableString(trophy[field], `${path}.${field}`, errors);
      }
      requireString(trophy.stageCode, `${path}.stageCode`, errors, { technical: true });
      requireString(trophy.method, `${path}.method`, errors);
      requireString(trophy.confidence, `${path}.confidence`, errors);
      requireString(trophy.status, `${path}.status`, errors);
      requireStringArray(trophy.dependencies, `${path}.dependencies`, errors);
      requireStringArray(trophy.sourceCodes, `${path}.sourceCodes`, errors);
      if (!RE5_STAGE_CODES.includes(trophy.stageCode)) {
        addError(errors, `${path}.stageCode`, 'UNKNOWN_STAGE_CODE', 'Trophy stageCode must reference one of nine stages');
      }
    }
  });
  for (const sourceCode of sourceCodes) {
    if (codes.has(sourceCode)) {
      addError(
        errors,
        'trophies',
        'SOURCE_TROPHY_COLLISION',
        `sourceTrophyCode collides with trophyCode: ${sourceCode}`
      );
    }
  }

  const sorted = [...trophies].sort((left, right) => (
    (packageOrder.get(left?.packageCode) || 999) - (packageOrder.get(right?.packageCode) || 999)
    || (left?.displayOrder || 999) - (right?.displayOrder || 999)
  ));
  if (sorted.some((item, index) => item !== trophies[index])) {
    addError(errors, 'trophies', 'NON_DETERMINISTIC_ORDER', 'Trophies must follow package and display order');
  }

  if (mode !== 'complete') return;
  if (trophies.length !== RE5_EXPECTED_COUNTS.total) {
    addError(errors, 'trophies', 'INVALID_TOTAL_COUNT', 'A complete snapshot must contain 71 trophies');
  }

  for (const spec of RE5_PACKAGE_SPECS) {
    const count = trophies.filter(item => item?.packageCode === spec.packageCode).length;
    if (count !== RE5_EXPECTED_COUNTS[spec.packageCode]) {
      addError(
        errors,
        'trophies',
        'INVALID_PACKAGE_TROPHY_COUNT',
        `${spec.packageCode} must contain ${RE5_EXPECTED_COUNTS[spec.packageCode]} trophies`
      );
    }
    const ordered = trophies
      .filter(item => item?.packageCode === spec.packageCode)
      .map(item => item.displayOrder);
    if (ordered.some((value, index) => value !== index + 1)) {
      addError(
        errors,
        'trophies',
        'NON_CONTIGUOUS_PACKAGE_ORDER',
        `${spec.packageCode} trophy order must be contiguous`
      );
    }
  }

  for (const [type, expected] of Object.entries(RE5_EXPECTED_TYPE_COUNTS)) {
    const count = trophies.filter(item => item?.type === type).length;
    if (count !== expected) {
      addError(errors, 'trophies', 'INVALID_TROPHY_TYPE_COUNT', `${type} must total ${expected}`);
    }
  }
  const platinum = trophies.find(item => item?.type === 'Platina');
  if (platinum?.packageCode !== 'base') {
    addError(errors, 'trophies', 'PLATINUM_OUTSIDE_BASE', 'Platinum must belong to base');
  }
  const globalOrders = trophies.map(item => item?.globalOrder);
  if (
    new Set(globalOrders).size !== trophies.length
    || globalOrders.some((value, index) => value !== index + 1)
  ) {
    addError(errors, 'trophies', 'NON_CONTIGUOUS_GLOBAL_ORDER', 'globalOrder must be unique and contiguous from 1 to 71');
  }
}

function validateOrderedContentArray(value, path, codeField, allowedFields, errors) {
  if (!requireArray(value, path, errors)) return;
  if (value.length === 0) {
    addError(errors, path, 'EMPTY_REQUIRED_ARRAY', `${path} must not be empty`);
    return;
  }
  const codes = new Set();
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!requireObject(item, itemPath, errors)) return;
    rejectUnknownFields(item, allowedFields, itemPath, errors);
    requireString(item[codeField], `${itemPath}.${codeField}`, errors, { technical: true });
    requireInteger(item.displayOrder, `${itemPath}.displayOrder`, errors, 1);
    if (codes.has(item[codeField])) {
      addError(errors, `${itemPath}.${codeField}`, 'DUPLICATE_TECHNICAL_ID', `${codeField} must be unique`);
    }
    codes.add(item[codeField]);
  });
  requireDeterministicOrder(value, path, errors);
}

function validateUniqueCodes(items, field, path, errors) {
  const seen = new Set();
  items.forEach((item, index) => {
    const value = item?.[field];
    if (seen.has(value)) {
      addError(errors, `${path}[${index}].${field}`, 'DUPLICATE_TECHNICAL_ID', `${field} must be unique`);
    }
    seen.add(value);
  });
}

function validateCompleteRoadmap(snapshot, errors) {
  if (!requireArray(snapshot.roadmap, 'roadmap', errors)) return;
  if (snapshot.roadmap.length !== RE5_EXPECTED_STRUCTURED_COUNTS.roadmap) {
    addError(errors, 'roadmap', 'INVALID_ROADMAP_COUNT', 'Complete snapshot must contain nine roadmap stages');
  }
  const trophyCodes = new Set(Array.isArray(snapshot.trophies)
    ? snapshot.trophies.map(item => item.trophyCode)
    : []);
  const assignedTrophies = new Map();
  const allowedFields = [
    'stageCode',
    'order',
    'title',
    'objective',
    'difficulty',
    'packageCodes',
    'trophyCodes',
    'collectibleGroups',
    'saveCodes',
    'warnings',
    'completionCondition'
  ];
  snapshot.roadmap.forEach((stage, index) => {
    const path = `roadmap[${index}]`;
    if (!requireObject(stage, path, errors)) return;
    rejectUnknownFields(stage, allowedFields, path, errors);
    requireString(stage.stageCode, `${path}.stageCode`, errors, { technical: true });
    requireInteger(stage.order, `${path}.order`, errors, 1);
    for (const field of ['title', 'objective', 'difficulty', 'completionCondition']) {
      requireString(stage[field], `${path}.${field}`, errors);
    }
    for (const field of [
      'packageCodes',
      'trophyCodes',
      'collectibleGroups',
      'saveCodes',
      'warnings'
    ]) {
      requireStringArray(stage[field], `${path}.${field}`, errors);
    }
    if (stage.stageCode !== RE5_STAGE_CODES[index] || stage.order !== index + 1) {
      addError(errors, path, 'NON_DETERMINISTIC_ORDER', 'Roadmap stages must follow the approved order');
    }
    for (const trophyCode of stage.trophyCodes || []) {
      if (!trophyCodes.has(trophyCode)) {
        addError(errors, `${path}.trophyCodes`, 'UNKNOWN_TROPHY_CODE', `Unknown trophyCode: ${trophyCode}`);
      }
      assignedTrophies.set(trophyCode, (assignedTrophies.get(trophyCode) || 0) + 1);
    }
  });
  validateUniqueCodes(snapshot.roadmap, 'stageCode', 'roadmap', errors);

  if (Array.isArray(snapshot.trophies)) {
    for (const trophy of snapshot.trophies) {
      const containingStage = snapshot.roadmap.find(stage => stage?.stageCode === trophy.stageCode);
      if (!containingStage || !containingStage.trophyCodes.includes(trophy.trophyCode)) {
        addError(
          errors,
          'roadmap',
          'TROPHY_STAGE_MISMATCH',
          `${trophy.trophyCode} must appear in ${trophy.stageCode}`
        );
      }
      if (assignedTrophies.get(trophy.trophyCode) !== 1) {
        addError(errors, 'roadmap', 'INVALID_TROPHY_STAGE_COVERAGE', `${trophy.trophyCode} must appear exactly once`);
      }
    }
  }
}

function validateCompleteGuideContent(snapshot, errors) {
  if (!requireArray(snapshot.guideContent, 'guideContent', errors)) return;
  if (snapshot.guideContent.length !== RE5_GUIDE_SECTION_CODES.length) {
    addError(errors, 'guideContent', 'INVALID_SECTION_COUNT', 'Complete snapshot must contain every approved section');
  }
  const allowedFields = [
    'sectionCode',
    'order',
    'title',
    'headingLevel',
    'anchor',
    'contentFormat',
    'content',
    'relatedTrophyCodes'
  ];
  snapshot.guideContent.forEach((section, index) => {
    const path = `guideContent[${index}]`;
    if (!requireObject(section, path, errors)) return;
    rejectUnknownFields(section, allowedFields, path, errors);
    requireString(section.sectionCode, `${path}.sectionCode`, errors, { technical: true });
    requireInteger(section.order, `${path}.order`, errors, 1);
    requireString(section.title, `${path}.title`, errors);
    requireInteger(section.headingLevel, `${path}.headingLevel`, errors, 1);
    requireString(section.anchor, `${path}.anchor`, errors, { technical: true });
    requireString(section.contentFormat, `${path}.contentFormat`, errors, { technical: true });
    requireString(section.content, `${path}.content`, errors);
    requireStringArray(section.relatedTrophyCodes, `${path}.relatedTrophyCodes`, errors, { technical: true });
    if (section.order !== index + 1 || section.sectionCode !== RE5_GUIDE_SECTION_CODES[index]) {
      addError(errors, path, 'NON_DETERMINISTIC_ORDER', 'Guide sections must follow the approved order');
    }
    if (section.contentFormat !== 'markdown') {
      addError(errors, `${path}.contentFormat`, 'INVALID_CONTENT_FORMAT', 'Guide content must remain Markdown');
    }
  });
  validateUniqueCodes(snapshot.guideContent, 'sectionCode', 'guideContent', errors);
  if (snapshot.guideContent.filter(section => section?.headingLevel === 1).length !== 1) {
    addError(errors, 'guideContent', 'INVALID_LOGICAL_H1_COUNT', 'Exactly one logical H1 is required');
  }
}

function validateCompleteCollectibles(snapshot, errors) {
  if (!requireArray(snapshot.collectibles, 'collectibles', errors)) return;
  const bsaa = snapshot.collectibles.filter(item => item?.kind === 'bsaa-emblem');
  const treasures = snapshot.collectibles.filter(item => item?.kind === 'treasure');
  if (bsaa.length !== 30 || treasures.length !== 50 || snapshot.collectibles.length !== 80) {
    addError(errors, 'collectibles', 'INVALID_COLLECTIBLE_COUNTS', 'Exactly 30 emblems and 50 treasures are required');
  }
  snapshot.collectibles.forEach((item, index) => {
    const path = `collectibles[${index}]`;
    if (!requireObject(item, path, errors)) return;
    const commonFields = ['id', 'kind', 'order', 'chapter', 'area', 'instruction', 'relatedTrophyCodes'];
    const allowedFields = item.kind === 'bsaa-emblem'
      ? [...commonFields, 'returnPossible', 'sameRunRequired']
      : [...commonFields, 'name', 'firstSafeOccurrence', 'canSellAfterRegistration'];
    rejectUnknownFields(item, allowedFields, path, errors);
    requireString(item.id, `${path}.id`, errors, { technical: true });
    requireString(item.kind, `${path}.kind`, errors, { technical: true });
    requireInteger(item.order, `${path}.order`, errors, 1);
    requireString(item.chapter, `${path}.chapter`, errors);
    requireNullableString(item.area, `${path}.area`, errors);
    requireString(item.instruction, `${path}.instruction`, errors);
    requireStringArray(item.relatedTrophyCodes, `${path}.relatedTrophyCodes`, errors, { technical: true });
    if (item.order !== index + 1) {
      addError(errors, `${path}.order`, 'NON_DETERMINISTIC_ORDER', 'Collectible order must be contiguous');
    }
    if (item.kind === 'bsaa-emblem') {
      const expectedId = `re5-bsaa-${String(index + 1).padStart(3, '0')}`;
      if (item.id !== expectedId) addError(errors, `${path}.id`, 'INVALID_BSAA_ID', `Expected ${expectedId}`);
      requireBoolean(item.returnPossible, `${path}.returnPossible`, errors);
      requireBoolean(item.sameRunRequired, `${path}.sameRunRequired`, errors);
    } else if (item.kind === 'treasure') {
      const treasureIndex = index - 30 + 1;
      const expectedId = `re5-treasure-${String(treasureIndex).padStart(3, '0')}`;
      if (item.id !== expectedId) addError(errors, `${path}.id`, 'INVALID_TREASURE_ID', `Expected ${expectedId}`);
      requireString(item.name, `${path}.name`, errors);
      requireString(item.firstSafeOccurrence, `${path}.firstSafeOccurrence`, errors);
      requireBoolean(item.canSellAfterRegistration, `${path}.canSellAfterRegistration`, errors);
    } else {
      addError(errors, `${path}.kind`, 'INVALID_COLLECTIBLE_KIND', 'Unsupported collectible kind');
    }
  });
  validateUniqueCodes(snapshot.collectibles, 'id', 'collectibles', errors);
}

function validateCompleteRequirements(snapshot, errors) {
  if (requireArray(snapshot.inventoryRequirements, 'inventoryRequirements', errors)) {
    if (snapshot.inventoryRequirements.length !== 27) {
      addError(errors, 'inventoryRequirements', 'INVALID_STOCKPILE_COUNT', 'Exactly 27 Stockpile items are required');
    }
    snapshot.inventoryRequirements.forEach((item, index) => {
      const path = `inventoryRequirements[${index}]`;
      if (!requireObject(item, path, errors)) return;
      rejectUnknownFields(
        item,
        ['id', 'order', 'name', 'group', 'unlockRequirement', 'mustExistSimultaneously', 'relatedTrophyCodes'],
        path,
        errors
      );
      const expectedId = `re5-stockpile-${String(index + 1).padStart(3, '0')}`;
      if (item.id !== expectedId) addError(errors, `${path}.id`, 'INVALID_STOCKPILE_ID', `Expected ${expectedId}`);
      requireInteger(item.order, `${path}.order`, errors, 1);
      requireString(item.name, `${path}.name`, errors);
      requireString(item.group, `${path}.group`, errors);
      requireString(item.unlockRequirement, `${path}.unlockRequirement`, errors);
      requireBoolean(item.mustExistSimultaneously, `${path}.mustExistSimultaneously`, errors);
      requireStringArray(item.relatedTrophyCodes, `${path}.relatedTrophyCodes`, errors, { technical: true });
    });
    validateUniqueCodes(snapshot.inventoryRequirements, 'id', 'inventoryRequirements', errors);
  }

  if (requireArray(snapshot.upgradeRequirements, 'upgradeRequirements', errors)) {
    if (snapshot.upgradeRequirements.length !== 18) {
      addError(errors, 'upgradeRequirements', 'INVALID_UPGRADE_COUNT', 'Exactly 18 upgradeable weapons are required');
    }
    snapshot.upgradeRequirements.forEach((item, index) => {
      const path = `upgradeRequirements[${index}]`;
      if (!requireObject(item, path, errors)) return;
      rejectUnknownFields(
        item,
        ['id', 'order', 'name', 'weaponClass', 'unlockChain', 'fullyUpgradable', 'relatedTrophyCodes'],
        path,
        errors
      );
      const expectedId = `re5-upgrade-${String(index + 1).padStart(3, '0')}`;
      if (item.id !== expectedId) addError(errors, `${path}.id`, 'INVALID_UPGRADE_ID', `Expected ${expectedId}`);
      requireInteger(item.order, `${path}.order`, errors, 1);
      requireString(item.name, `${path}.name`, errors);
      requireString(item.weaponClass, `${path}.weaponClass`, errors);
      requireString(item.unlockChain, `${path}.unlockChain`, errors);
      requireBoolean(item.fullyUpgradable, `${path}.fullyUpgradable`, errors);
      requireStringArray(item.relatedTrophyCodes, `${path}.relatedTrophyCodes`, errors, { technical: true });
    });
    validateUniqueCodes(snapshot.upgradeRequirements, 'id', 'upgradeRequirements', errors);
  }
}

function validateCompleteEconomyAndOnline(snapshot, errors) {
  if (requireObject(snapshot.economy, 'economy', errors)) {
    rejectUnknownFields(snapshot.economy, ['currency', 'figures', 'versusCharacters'], 'economy', errors);
    if (snapshot.economy.currency !== 'Exchange Points') {
      addError(errors, 'economy.currency', 'INVALID_CURRENCY', 'Economy must preserve Exchange Points');
    }
    if (requireObject(snapshot.economy.figures, 'economy.figures', errors)) {
      rejectUnknownFields(
        snapshot.economy.figures,
        ['total', 'free', 'paid', 'unitCost', 'totalCost'],
        'economy.figures',
        errors
      );
      const expected = { total: 46, free: 2, paid: 44, unitCost: 500, totalCost: 22000 };
      for (const [field, value] of Object.entries(expected)) {
        if (snapshot.economy.figures[field] !== value) {
          addError(errors, `economy.figures.${field}`, 'INVALID_FIGURE_ECONOMY', `${field} must equal ${value}`);
        }
      }
    }
    if (requireObject(snapshot.economy.versusCharacters, 'economy.versusCharacters', errors)) {
      rejectUnknownFields(
        snapshot.economy.versusCharacters,
        ['total', 'totalCost', 'entries'],
        'economy.versusCharacters',
        errors
      );
      if (
        snapshot.economy.versusCharacters.total !== 8
        || snapshot.economy.versusCharacters.totalCost !== 134000
      ) {
        addError(errors, 'economy.versusCharacters', 'INVALID_VERSUS_ECONOMY', 'Eight entries must cost 134000 EP');
      }
      if (requireArray(snapshot.economy.versusCharacters.entries, 'economy.versusCharacters.entries', errors)) {
        if (snapshot.economy.versusCharacters.entries.length !== 8) {
          addError(errors, 'economy.versusCharacters.entries', 'INVALID_VERSUS_ENTRY_COUNT', 'Exactly eight characters are required');
        }
        let total = 0;
        snapshot.economy.versusCharacters.entries.forEach((entry, index) => {
          const path = `economy.versusCharacters.entries[${index}]`;
          if (!requireObject(entry, path, errors)) return;
          rejectUnknownFields(entry, ['order', 'name', 'cost', 'note'], path, errors);
          requireInteger(entry.order, `${path}.order`, errors, 1);
          requireString(entry.name, `${path}.name`, errors);
          requireInteger(entry.cost, `${path}.cost`, errors, 0);
          requireString(entry.note, `${path}.note`, errors);
          total += Number(entry.cost || 0);
        });
        if (total !== 134000) {
          addError(errors, 'economy.versusCharacters.entries', 'INVALID_VERSUS_COST_SUM', 'Character costs must sum to 134000');
        }
      }
    }
  }

  if (requireObject(snapshot.online, 'online', errors)) {
    const allowedFields = [
      'requiredForPlatinum',
      'requiredFor100Percent',
      'minimumPlayersSoloModes',
      'minimumPlayersTeamModes',
      'recommendedBoostMap',
      'slayersWins',
      'survivorsWins',
      'teamSlayersWins',
      'teamSurvivorsWins',
      'physicalEliminations',
      'statusLastVerifiedAt',
      'statusConfidence'
    ];
    rejectUnknownFields(snapshot.online, allowedFields, 'online', errors);
    if (snapshot.online.requiredForPlatinum !== false || snapshot.online.requiredFor100Percent !== true) {
      addError(errors, 'online', 'INVALID_ONLINE_SCOPE', 'Online is required only for 100 percent');
    }
    const thresholds = {
      minimumPlayersSoloModes: 2,
      minimumPlayersTeamModes: 4,
      slayersWins: 15,
      survivorsWins: 15,
      teamSlayersWins: 15,
      teamSurvivorsWins: 15,
      physicalEliminations: 50
    };
    for (const [field, expected] of Object.entries(thresholds)) {
      if (snapshot.online[field] !== expected) {
        addError(errors, `online.${field}`, 'INVALID_PS4_VERSUS_THRESHOLD', `${field} must equal ${expected}`);
      }
    }
    if (snapshot.online.recommendedBoostMap !== 'Public Assembly') {
      addError(errors, 'online.recommendedBoostMap', 'INVALID_BOOST_MAP', 'Recommended boost map must be Public Assembly');
    }
    requireDate(snapshot.online.statusLastVerifiedAt, 'online.statusLastVerifiedAt', errors);
    requireString(snapshot.online.statusConfidence, 'online.statusConfidence', errors);
  }
}

function validateCompleteSupportingBlocks(snapshot, errors) {
  validateCompleteRoadmap(snapshot, errors);
  validateCompleteGuideContent(snapshot, errors);
  validateCompleteCollectibles(snapshot, errors);
  validateCompleteRequirements(snapshot, errors);
  validateCompleteEconomyAndOnline(snapshot, errors);
}

function validateSupportingBlocks(snapshot, mode, errors) {
  if (mode === 'complete') {
    validateCompleteSupportingBlocks(snapshot, errors);
    return;
  }
  validateOrderedContentArray(
    snapshot.roadmap,
    'roadmap',
    'stepCode',
    ['stepCode', 'title', 'displayOrder'],
    errors
  );
  if (Array.isArray(snapshot.roadmap)) {
    snapshot.roadmap.forEach((item, index) => {
      if (isPlainObject(item)) requireString(item.title, `roadmap[${index}].title`, errors);
    });
  }

  validateOrderedContentArray(
    snapshot.guideContent,
    'guideContent',
    'sectionCode',
    ['sectionCode', 'heading', 'body', 'displayOrder'],
    errors
  );
  if (Array.isArray(snapshot.guideContent)) {
    snapshot.guideContent.forEach((item, index) => {
      if (!isPlainObject(item)) return;
      requireString(item.heading, `guideContent[${index}].heading`, errors);
      requireString(item.body, `guideContent[${index}].body`, errors);
    });
  }

  validateOrderedContentArray(
    snapshot.collectibles,
    'collectibles',
    'collectibleCode',
    ['collectibleCode', 'kind', 'displayOrder'],
    errors
  );
  if (Array.isArray(snapshot.collectibles)) {
    snapshot.collectibles.forEach((item, index) => {
      if (isPlainObject(item)) {
        requireString(item.kind, `collectibles[${index}].kind`, errors, { technical: true });
      }
    });
  }

  validateOrderedContentArray(
    snapshot.inventoryRequirements,
    'inventoryRequirements',
    'itemCode',
    ['itemCode', 'requirementCode', 'displayOrder'],
    errors
  );
  if (Array.isArray(snapshot.inventoryRequirements)) {
    snapshot.inventoryRequirements.forEach((item, index) => {
      if (!isPlainObject(item)) return;
      requireString(
        item.requirementCode,
        `inventoryRequirements[${index}].requirementCode`,
        errors,
        { technical: true }
      );
    });
  }

  validateOrderedContentArray(
    snapshot.upgradeRequirements,
    'upgradeRequirements',
    'weaponCode',
    ['weaponCode', 'fullyUpgradeable', 'displayOrder'],
    errors
  );
  if (Array.isArray(snapshot.upgradeRequirements)) {
    snapshot.upgradeRequirements.forEach((item, index) => {
      if (isPlainObject(item)) {
        requireBoolean(
          item.fullyUpgradeable,
          `upgradeRequirements[${index}].fullyUpgradeable`,
          errors
        );
      }
    });
  }

  if (requireObject(snapshot.economy, 'economy', errors)) {
    rejectUnknownFields(
      snapshot.economy,
      ['currencyCode', 'stockpileCost', 'upgradeCost', 'aggregateCost'],
      'economy',
      errors
    );
    requireString(snapshot.economy.currencyCode, 'economy.currencyCode', errors, { technical: true });
    for (const field of ['stockpileCost', 'upgradeCost', 'aggregateCost']) {
      requireInteger(snapshot.economy[field], `economy.${field}`, errors, 0);
    }
    if (
      Number.isInteger(snapshot.economy.aggregateCost)
      && snapshot.economy.aggregateCost
        !== snapshot.economy.stockpileCost + snapshot.economy.upgradeCost
    ) {
      addError(errors, 'economy.aggregateCost', 'INVALID_AGGREGATE_COST', 'aggregateCost must equal its parts');
    }
  }

  if (requireObject(snapshot.online, 'online', errors)) {
    rejectUnknownFields(
      snapshot.online,
      [
        'platform',
        'packageCode',
        'slayersWins',
        'survivorsWins',
        'teamSlayersWins',
        'teamSurvivorsWins',
        'physicalEliminations'
      ],
      'online',
      errors
    );
    if (snapshot.online.platform !== 'PS4') {
      addError(errors, 'online.platform', 'INVALID_ONLINE_PLATFORM', 'Versus requirements apply to PS4');
    }
    if (snapshot.online.packageCode !== 'versus') {
      addError(errors, 'online.packageCode', 'INVALID_ONLINE_PACKAGE', 'Online requirements belong to Versus');
    }
    const thresholds = {
      slayersWins: 15,
      survivorsWins: 15,
      teamSlayersWins: 15,
      teamSurvivorsWins: 15,
      physicalEliminations: 50
    };
    for (const [field, expected] of Object.entries(thresholds)) {
      requireInteger(snapshot.online[field], `online.${field}`, errors, 0);
      if (snapshot.online[field] !== expected) {
        addError(
          errors,
          `online.${field}`,
          'INVALID_PS4_VERSUS_THRESHOLD',
          `${field} must equal ${expected}`
        );
      }
    }
  }
}

function validateCompleteEditorialBlocks(snapshot, errors) {
  const sourceCodes = new Set();
  if (requireArray(snapshot.sources, 'sources', errors)) {
    if (!snapshot.sources.length) {
      addError(errors, 'sources', 'EMPTY_SOURCES', 'At least one source is required');
    }
    snapshot.sources.forEach((source, index) => {
      const path = `sources[${index}]`;
      if (!requireObject(source, path, errors)) return;
      rejectUnknownFields(
        source,
        ['sourceCode', 'title', 'url', 'sourceType', 'scope', 'confidence', 'lastVerifiedAt'],
        path,
        errors
      );
      for (const field of ['sourceCode', 'title', 'url', 'sourceType', 'scope', 'confidence']) {
        requireString(source[field], `${path}.${field}`, errors);
      }
      requireDate(source.lastVerifiedAt, `${path}.lastVerifiedAt`, errors);
      if (sourceCodes.has(source.sourceCode)) {
        addError(errors, `${path}.sourceCode`, 'DUPLICATE_SOURCE_CODE', 'Source code must be unique');
      }
      sourceCodes.add(source.sourceCode);
    });
  }

  const claimCodes = new Set();
  if (requireArray(snapshot.claims, 'claims', errors)) {
    if (!snapshot.claims.length) {
      addError(errors, 'claims', 'EMPTY_CLAIMS', 'At least one claim is required');
    }
    snapshot.claims.forEach((claim, index) => {
      const path = `claims[${index}]`;
      if (!requireObject(claim, path, errors)) return;
      rejectUnknownFields(
        claim,
        ['claimCode', 'statement', 'versionScope', 'confidence', 'sourceCodes', 'impact'],
        path,
        errors
      );
      requireString(claim.claimCode, `${path}.claimCode`, errors, { technical: true });
      for (const field of ['statement', 'versionScope', 'confidence', 'impact']) {
        requireString(claim[field], `${path}.${field}`, errors);
      }
      if (!requireStringArray(claim.sourceCodes, `${path}.sourceCodes`, errors) || !claim.sourceCodes.length) {
        addError(errors, `${path}.sourceCodes`, 'CLAIM_WITHOUT_SOURCE', 'Critical claim must reference a source');
      } else {
        for (const sourceCode of claim.sourceCodes) {
          if (!sourceCodes.has(sourceCode)) {
            addError(errors, `${path}.sourceCodes`, 'UNKNOWN_CLAIM_SOURCE', `Unknown source: ${sourceCode}`);
          }
        }
      }
      if (claimCodes.has(claim.claimCode)) {
        addError(errors, `${path}.claimCode`, 'DUPLICATE_CLAIM_CODE', 'Claim code must be unique');
      }
      claimCodes.add(claim.claimCode);
    });
  }

  if (Array.isArray(snapshot.trophies)) {
    snapshot.trophies.forEach((trophy, index) => {
      for (const sourceCode of trophy?.sourceCodes || []) {
        if (!sourceCodes.has(sourceCode)) {
          addError(
            errors,
            `trophies[${index}].sourceCodes`,
            'UNKNOWN_TROPHY_SOURCE',
            `${trophy.trophyCode} references unknown source ${sourceCode}`
          );
        }
      }
    });
  }

  if (requireObject(snapshot.seo, 'seo', errors)) {
    rejectUnknownFields(snapshot.seo, ['title', 'description', 'canonicalPath', 'h1'], 'seo', errors);
    for (const field of ['title', 'description', 'h1']) {
      requireString(snapshot.seo[field], `seo.${field}`, errors);
    }
    if (snapshot.seo.canonicalPath !== '/jogo/resident-evil-5') {
      addError(errors, 'seo.canonicalPath', 'INVALID_CANONICAL', 'SEO canonical must be /jogo/resident-evil-5');
    }
  }

  if (requireObject(snapshot.review, 'review', errors)) {
    rejectUnknownFields(snapshot.review, ['status', 'reviewedAt', 'reviewerCode'], 'review', errors);
    if (snapshot.review.status !== 'approved') {
      addError(errors, 'review.status', 'INVALID_REVIEW_STATUS', 'Complete snapshot review must be approved');
    }
    requireDate(snapshot.review.reviewedAt, 'review.reviewedAt', errors);
    requireString(snapshot.review.reviewerCode, 'review.reviewerCode', errors, { technical: true });
  }

  if (requireArray(snapshot.redirects, 'redirects', errors)) {
    if (!snapshot.redirects.length) {
      addError(errors, 'redirects', 'EMPTY_REQUIRED_ARRAY', 'redirects must not be empty');
    }
    const fromPaths = new Set();
    snapshot.redirects.forEach((redirect, index) => {
      const path = `redirects[${index}]`;
      if (!requireObject(redirect, path, errors)) return;
      rejectUnknownFields(redirect, ['from', 'to', 'displayOrder'], path, errors);
      requireString(redirect.from, `${path}.from`, errors);
      requireString(redirect.to, `${path}.to`, errors);
      requireInteger(redirect.displayOrder, `${path}.displayOrder`, errors, 1);
      if (fromPaths.has(redirect.from)) {
        addError(errors, `${path}.from`, 'DUPLICATE_REDIRECT', 'Redirect source must be unique');
      }
      fromPaths.add(redirect.from);
    });
    requireDeterministicOrder(snapshot.redirects, 'redirects', errors);
  }
}

function validateEditorialBlocks(snapshot, mode, errors) {
  if (mode === 'complete') {
    validateCompleteEditorialBlocks(snapshot, errors);
    return;
  }
  const sourceCodes = new Set();
  if (requireArray(snapshot.sources, 'sources', errors)) {
    if (!snapshot.sources.length) {
      addError(errors, 'sources', 'EMPTY_SOURCES', 'At least one source is required');
    }
    snapshot.sources.forEach((source, index) => {
      const path = `sources[${index}]`;
      if (!requireObject(source, path, errors)) return;
      rejectUnknownFields(source, ['sourceCode', 'title', 'url', 'accessedAt'], path, errors);
      requireString(source.sourceCode, `${path}.sourceCode`, errors, { technical: true });
      requireString(source.title, `${path}.title`, errors);
      requireString(source.url, `${path}.url`, errors);
      requireDate(source.accessedAt, `${path}.accessedAt`, errors);
      if (sourceCodes.has(source.sourceCode)) {
        addError(errors, `${path}.sourceCode`, 'DUPLICATE_SOURCE_CODE', 'Source code must be unique');
      }
      sourceCodes.add(source.sourceCode);
    });
  }

  if (requireArray(snapshot.claims, 'claims', errors)) {
    if (!snapshot.claims.length) {
      addError(errors, 'claims', 'EMPTY_CLAIMS', 'At least one claim is required');
    }
    const claimCodes = new Set();
    snapshot.claims.forEach((claim, index) => {
      const path = `claims[${index}]`;
      if (!requireObject(claim, path, errors)) return;
      rejectUnknownFields(claim, ['claimCode', 'sourceCodes', 'statement', 'reviewedAt'], path, errors);
      requireString(claim.claimCode, `${path}.claimCode`, errors, { technical: true });
      requireString(claim.statement, `${path}.statement`, errors);
      requireDate(claim.reviewedAt, `${path}.reviewedAt`, errors);
      if (!requireArray(claim.sourceCodes, `${path}.sourceCodes`, errors) || !claim.sourceCodes.length) {
        addError(errors, `${path}.sourceCodes`, 'CLAIM_WITHOUT_SOURCE', 'Claim must reference a source');
      } else {
        claim.sourceCodes.forEach((sourceCode, sourceIndex) => {
          requireString(
            sourceCode,
            `${path}.sourceCodes[${sourceIndex}]`,
            errors,
            { technical: true }
          );
          if (!sourceCodes.has(sourceCode)) {
            addError(
              errors,
              `${path}.sourceCodes[${sourceIndex}]`,
              'UNKNOWN_CLAIM_SOURCE',
              'Claim references an unknown source'
            );
          }
        });
      }
      if (claimCodes.has(claim.claimCode)) {
        addError(errors, `${path}.claimCode`, 'DUPLICATE_CLAIM_CODE', 'Claim code must be unique');
      }
      claimCodes.add(claim.claimCode);
    });
  }

  if (requireObject(snapshot.seo, 'seo', errors)) {
    rejectUnknownFields(snapshot.seo, ['title', 'description', 'canonicalPath', 'h1'], 'seo', errors);
    for (const field of ['title', 'description', 'h1']) {
      requireString(snapshot.seo[field], `seo.${field}`, errors);
    }
    if (snapshot.seo.canonicalPath !== '/jogo/resident-evil-5') {
      addError(
        errors,
        'seo.canonicalPath',
        'INVALID_CANONICAL',
        'SEO canonical must be /jogo/resident-evil-5'
      );
    }
  }

  if (requireObject(snapshot.review, 'review', errors)) {
    rejectUnknownFields(snapshot.review, ['status', 'reviewedAt', 'reviewerCode'], 'review', errors);
    requireString(snapshot.review.status, 'review.status', errors, { technical: true });
    requireDate(snapshot.review.reviewedAt, 'review.reviewedAt', errors);
    requireString(snapshot.review.reviewerCode, 'review.reviewerCode', errors, { technical: true });
  }

  if (requireArray(snapshot.redirects, 'redirects', errors)) {
    if (!snapshot.redirects.length) {
      addError(errors, 'redirects', 'EMPTY_REQUIRED_ARRAY', 'redirects must not be empty');
    }
    const fromPaths = new Set();
    snapshot.redirects.forEach((redirect, index) => {
      const path = `redirects[${index}]`;
      if (!requireObject(redirect, path, errors)) return;
      rejectUnknownFields(redirect, ['from', 'to', 'displayOrder'], path, errors);
      requireString(redirect.from, `${path}.from`, errors);
      requireString(redirect.to, `${path}.to`, errors);
      requireInteger(redirect.displayOrder, `${path}.displayOrder`, errors, 1);
      if (fromPaths.has(redirect.from)) {
        addError(errors, `${path}.from`, 'DUPLICATE_REDIRECT', 'Redirect source must be unique');
      }
      fromPaths.add(redirect.from);
    });
    requireDeterministicOrder(snapshot.redirects, 'redirects', errors);
  }
}

function resolveMode(options) {
  if (options?.mode === 'minimal' || options?.profile === 'minimal-contract') return 'minimal';
  return 'complete';
}

function validateGuideSnapshotV2(snapshot, options = {}) {
  const errors = [];
  const warnings = [];
  const mode = resolveMode(options);

  if (!requireObject(snapshot, 'snapshot', errors)) {
    return { valid: false, mode, errors, warnings };
  }
  rejectUnknownFields(snapshot, ROOT_FIELDS, '', errors);
  for (const field of ROOT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, field)) {
      addError(errors, field, 'MISSING_REQUIRED_BLOCK', `Missing required block: ${field}`);
    }
  }
  if (snapshot.schemaVersion !== RE5_SCHEMA_VERSION) {
    addError(
      errors,
      'schemaVersion',
      'INVALID_SCHEMA_VERSION',
      `schemaVersion must equal ${RE5_SCHEMA_VERSION}`
    );
  }

  validateGame(snapshot.game, mode, errors);
  validateVersions(snapshot.versions, errors);
  validatePackages(snapshot.trophyPackages, errors);
  validateTrophies(snapshot.trophies, snapshot.trophyPackages, mode, errors);
  validateSupportingBlocks(snapshot, mode, errors);
  validateEditorialBlocks(snapshot, mode, errors);

  return {
    valid: errors.length === 0,
    mode,
    errors,
    warnings
  };
}

function assertGuideSnapshotV2(snapshot, options = {}) {
  const result = validateGuideSnapshotV2(snapshot, options);
  if (!result.valid) {
    throw new GuideSnapshotV2ValidationError(result.errors, result.warnings);
  }
  return snapshot;
}

module.exports = {
  GuideSnapshotV2ValidationError,
  validateGuideSnapshotV2,
  assertGuideSnapshotV2
};
