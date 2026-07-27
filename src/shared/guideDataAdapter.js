'use strict';

const guideViewModel = require('./guideViewModel');
const {
  RE5_EXPECTED_STRUCTURED_COUNTS,
  RE5_PACKAGE_CODES
} = require('./re5V2Constants');
const { assertGuideSnapshotV2 } = require('../validators/guideSnapshotV2.validator');

class GuideDataAdapterError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'GuideDataAdapterError';
    this.code = code;
    this.details = details;
  }
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(cloneValue);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneValue(item)])
  );
}

function createSafeDomId(value, index, usedIds) {
  const suffix = String(value || `item-${index + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || `item-${index + 1}`;
  const base = `trophy-${suffix}`;
  let domId = base;
  let collision = 2;
  while (usedIds.has(domId)) {
    domId = `${base}-${collision}`;
    collision += 1;
  }
  usedIds.add(domId);
  return domId;
}

function adaptTrophies(trophies) {
  const usedIds = new Set();
  return trophies.map((trophy, index) => {
    const copy = cloneValue(trophy);
    const identity = copy.trophyCode || copy.trophy_code || copy.id;
    return {
      ...copy,
      domId: createSafeDomId(identity, index, usedIds)
    };
  });
}

function extractNumberedSequence(content, expectedCount, options) {
  const entries = [...String(content || '').matchAll(/^(\d+)\.\s+(.+)$/gm)]
    .map(match => ({ order: Number(match[1]), instruction: match[2].trim() }));
  let sequence = [];

  for (const entry of entries) {
    if (entry.order === 1) {
      sequence = [entry];
      continue;
    }
    if (sequence.length && entry.order === sequence.length + 1) {
      sequence.push(entry);
      if (sequence.length === expectedCount) break;
      continue;
    }
    if (sequence.length) sequence = [];
  }

  if (sequence.length !== expectedCount) {
    throw new GuideDataAdapterError(
      'INVALID_DERIVED_COLLECTIBLE_COUNT',
      `${options.kind} must expose exactly ${expectedCount} ordered entries`,
      { kind: options.kind, expected: expectedCount, actual: sequence.length }
    );
  }

  return sequence.map(entry => ({
    id: `${options.idPrefix}-${String(entry.order).padStart(3, '0')}`,
    kind: options.kind,
    order: entry.order,
    instruction: entry.instruction,
    packageCode: options.packageCode,
    sameRunRequired: true,
    relatedTrophyCodes: [options.trophyCode]
  }));
}

function extractAgitators(content) {
  const text = String(content || '');
  const headings = [...text.matchAll(/^###\s+Agitator\s+(\d+)\s+[—-]\s+(.+)$/gm)];
  const agitators = headings.map((match, index) => {
    const nextStart = headings[index + 1]?.index ?? text.length;
    const block = text.slice(match.index + match[0].length, nextStart).trim();
    return {
      id: `re5-agitator-${String(Number(match[1])).padStart(3, '0')}`,
      kind: 'agitator',
      order: Number(match[1]),
      name: `Agitator ${match[1]} — ${match[2].trim()}`,
      instruction: block,
      packageCode: RE5_PACKAGE_CODES.DESPERATE_ESCAPE,
      sameRunRequired: true,
      relatedTrophyCodes: ['re5_desperate_005']
    };
  });

  if (
    agitators.length !== 3
    || agitators.some((item, index) => item.order !== index + 1 || !item.instruction)
  ) {
    throw new GuideDataAdapterError(
      'INVALID_DERIVED_COLLECTIBLE_COUNT',
      'agitator must expose exactly three ordered entries',
      { kind: 'agitator', expected: 3, actual: agitators.length }
    );
  }
  return agitators;
}

function buildSeo(seo = {}, game = {}, review = {}) {
  const title = seo.title || null;
  const metaDescription = seo.metaDescription || seo.description || null;
  const canonical = seo.canonical || seo.canonicalPath || game.url || null;
  const h1 = seo.h1 || null;
  return {
    title,
    metaDescription,
    canonical,
    h1,
    openGraph: {
      type: 'article',
      title,
      description: metaDescription,
      url: canonical
    },
    twitter: {
      card: 'summary',
      title,
      description: metaDescription
    },
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: h1 || title,
      description: metaDescription,
      mainEntityOfPage: canonical,
      about: game.name || null,
      dateModified: review.reviewedAt || null
    }
  };
}

function buildReview(review = {}) {
  return {
    reviewedAt: review.reviewedAt || null,
    factualReviewAt: review.factualReviewAt || null,
    editorialStatus: review.editorialStatus || review.status || null,
    author: review.author || null,
    reviewer: review.reviewer || review.reviewerCode || null
  };
}

function buildProgress(packages, platinumTarget, completionTarget) {
  return {
    platinum: {
      completed: 0,
      total: platinumTarget,
      target: platinumTarget,
      remaining: platinumTarget
    },
    completion: {
      completed: 0,
      total: completionTarget,
      target: completionTarget,
      remaining: completionTarget
    },
    byPackage: Object.fromEntries(packages.map(pkg => [
      pkg.packageCode,
      {
        completed: 0,
        total: pkg.actualTrophyCount,
        target: pkg.expectedTrophyCount,
        remaining: pkg.actualTrophyCount
      }
    ]))
  };
}

function validateAdaptedV2(snapshot, trophies, packages, sections, collectibles) {
  const trophyCodes = new Set(trophies.map(item => item.trophyCode));
  const domIds = trophies.map(item => item.domId);
  if (
    new Set(domIds).size !== domIds.length
    || domIds.some(domId => !/^[a-z][a-z0-9_-]*$/i.test(domId))
  ) {
    throw new GuideDataAdapterError(
      'INVALID_TROPHY_DOM_ID',
      'Every trophy must expose a safe and unique DOM id'
    );
  }

  for (const section of sections) {
    for (const trophyCode of section.relatedTrophyCodes || []) {
      if (!trophyCodes.has(trophyCode)) {
        throw new GuideDataAdapterError(
          'UNKNOWN_SECTION_TROPHY_REFERENCE',
          `Section ${section.sectionCode} references an unknown trophy`,
          { sectionCode: section.sectionCode, trophyCode }
        );
      }
    }
  }

  if (sections.length !== RE5_EXPECTED_STRUCTURED_COUNTS.guideContent) {
    throw new GuideDataAdapterError(
      'INVALID_SECTION_COUNT',
      `Guide V2 must expose ${RE5_EXPECTED_STRUCTURED_COUNTS.guideContent} sections`
    );
  }
  if (sections.filter(item => item.headingLevel === 1).length !== 1) {
    throw new GuideDataAdapterError('INVALID_H1_COUNT', 'Guide V2 must expose exactly one H1');
  }

  for (const pkg of packages) {
    const actual = trophies.filter(item => item.packageCode === pkg.packageCode).length;
    if (actual !== pkg.expectedTrophyCount) {
      throw new GuideDataAdapterError(
        'INVALID_PACKAGE_TROPHY_COUNT',
        `Package ${pkg.packageCode} does not match its declared trophy count`,
        { packageCode: pkg.packageCode, expected: pkg.expectedTrophyCount, actual }
      );
    }
  }

  const expectedCollectibles = {
    bsaaEmblems: 30,
    treasures: 50,
    scoreStars: 18,
    agitators: 3
  };
  for (const [key, expected] of Object.entries(expectedCollectibles)) {
    if (collectibles[key].length !== expected) {
      throw new GuideDataAdapterError(
        'INVALID_ADAPTED_COLLECTIBLE_COUNT',
        `${key} must expose ${expected} entries`,
        { key, expected, actual: collectibles[key].length }
      );
    }
  }

  if (snapshot.sources.length !== 17 || snapshot.claims.length !== 29) {
    throw new GuideDataAdapterError(
      'INVALID_EDITORIAL_EVIDENCE_COUNT',
      'Guide V2 must preserve 17 sources and 29 claims'
    );
  }
}

function adaptGuideSnapshotV2(snapshot, context = {}) {
  assertGuideSnapshotV2(snapshot, { mode: 'complete' });

  const trophies = adaptTrophies(snapshot.trophies);
  const baseTrophies = trophies.filter(item => item.packageCode === RE5_PACKAGE_CODES.BASE);
  const additionalTrophies = trophies.filter(item => item.packageCode !== RE5_PACKAGE_CODES.BASE);
  const trophiesByPackage = Object.fromEntries(snapshot.trophyPackages.map(pkg => [
    pkg.packageCode,
    trophies.filter(item => item.packageCode === pkg.packageCode)
  ]));
  const packages = snapshot.trophyPackages.map(pkg => ({
    ...cloneValue(pkg),
    actualTrophyCount: trophiesByPackage[pkg.packageCode].length,
    trophies: trophiesByPackage[pkg.packageCode]
  }));
  const versions = cloneValue(snapshot.versions);
  const sections = cloneValue(snapshot.guideContent);
  const scoreSection = sections.find(item => item.sectionCode === 'score-stars');
  const agitatorSection = sections.find(item => item.sectionCode === 'agitators');
  const collectibles = {
    bsaaEmblems: cloneValue(snapshot.collectibles.filter(item => item.kind === 'bsaa-emblem')),
    treasures: cloneValue(snapshot.collectibles.filter(item => item.kind === 'treasure')),
    scoreStars: extractNumberedSequence(scoreSection?.content, 18, {
      idPrefix: 're5-score-star',
      kind: 'score-star',
      packageCode: RE5_PACKAGE_CODES.LOST_IN_NIGHTMARES,
      trophyCode: 're5_lost_005'
    }),
    agitators: extractAgitators(agitatorSection?.content)
  };

  validateAdaptedV2(snapshot, trophies, packages, sections, collectibles);

  const platinumTarget = packages
    .filter(pkg => pkg.countsForPlatinum)
    .reduce((total, pkg) => total + pkg.actualTrophyCount, 0);
  const completionTarget = packages
    .filter(pkg => pkg.countsFor100Percent)
    .reduce((total, pkg) => total + pkg.actualTrophyCount, 0);
  const progress = buildProgress(packages, platinumTarget, completionTarget);
  return guideViewModel.buildUnifiedGuideViewModel({
    sourceMode: 'v2',
    game: cloneValue(snapshot.game),
    versions,
    nativeTrophyList: versions.find(item => item.nativeTrophyList === true) || null,
    packages,
    trophyPackages: packages,
    baseTrophies,
    additionalTrophies,
    trophies: {
      all: trophies,
      base: baseTrophies,
      byPackage: trophiesByPackage
    },
    platinumTarget,
    completionTarget,
    progress,
    roadmap: cloneValue(snapshot.roadmap),
    sections,
    collectibles,
    inventoryRequirements: cloneValue(snapshot.inventoryRequirements),
    upgradeRequirements: cloneValue(snapshot.upgradeRequirements),
    economy: cloneValue(snapshot.economy),
    online: cloneValue(snapshot.online),
    sources: cloneValue(snapshot.sources),
    claims: cloneValue(snapshot.claims),
    seo: buildSeo(snapshot.seo, snapshot.game, snapshot.review),
    review: buildReview(snapshot.review),
    redirects: cloneValue(snapshot.redirects),
    diagnostics: cloneValue(context.diagnostics || {})
  });
}

function adaptLegacyGuide(legacyData, context = {}) {
  if (!legacyData || typeof legacyData !== 'object') {
    return adaptUnavailableGuide(context);
  }

  const legacy = cloneValue(legacyData);
  const sourceMode = context.sourceMode === 'sample-legacy'
    ? 'sample-legacy'
    : 'relational-legacy';
  const trophies = adaptTrophies(Array.isArray(legacy.trophies) ? legacy.trophies : []);
  const legacyTarget = Number(
    legacy.legacyMetadata?.platinumTarget
    || legacy.legacyMetadata?.trophyTotal
    || trophies.length
  );
  const platinumTarget = Number.isFinite(legacyTarget) ? legacyTarget : trophies.length;
  const game = cloneValue(legacy.game || {
    id: legacy.id ?? null,
    slug: legacy.slug || null,
    name: legacy.name || null,
    scope: legacy.scope || null,
    url: legacy.url || null
  });
  const reviewInput = legacy.review || {
    reviewedAt: legacy.last_reviewed_at || legacy.lastReviewedAt || null,
    status: legacy.editorial_review_status || legacy.editorial_status || null,
    reviewerCode: null
  };

  return guideViewModel.buildUnifiedGuideViewModel({
    sourceMode,
    game,
    versions: [],
    nativeTrophyList: null,
    packages: [],
    trophyPackages: [],
    baseTrophies: trophies,
    additionalTrophies: [],
    trophies: {
      all: trophies,
      base: trophies,
      byPackage: {}
    },
    platinumTarget,
    completionTarget: platinumTarget,
    progress: buildProgress([], platinumTarget, platinumTarget),
    roadmap: cloneValue(Array.isArray(legacy.roadmap) ? legacy.roadmap : []),
    sections: cloneValue(Array.isArray(legacy.sections) ? legacy.sections : []),
    collectibles: {
      bsaaEmblems: [],
      treasures: [],
      scoreStars: [],
      agitators: []
    },
    inventoryRequirements: [],
    upgradeRequirements: [],
    economy: null,
    online: cloneValue(legacy.online || null),
    sources: cloneValue(Array.isArray(legacy.sources) ? legacy.sources : []),
    claims: cloneValue(Array.isArray(legacy.claims) ? legacy.claims : []),
    seo: buildSeo(legacy.seo || {}, game, reviewInput),
    review: buildReview(reviewInput),
    redirects: cloneValue(Array.isArray(legacy.redirects) ? legacy.redirects : []),
    legacyDlc: cloneValue(legacy.legacyDlc || null),
    legacyData: legacy,
    diagnostics: cloneValue(context.diagnostics || {})
  });
}

function adaptUnavailableGuide(context = {}) {
  return guideViewModel.buildUnifiedGuideViewModel({
    sourceMode: 'error',
    game: context.game || null,
    versions: [],
    nativeTrophyList: null,
    packages: [],
    baseTrophies: [],
    additionalTrophies: [],
    trophies: { all: [], base: [], byPackage: {} },
    progress: buildProgress([], 0, 0),
    roadmap: [],
    sections: [],
    collectibles: {
      bsaaEmblems: [],
      treasures: [],
      scoreStars: [],
      agitators: []
    },
    inventoryRequirements: [],
    upgradeRequirements: [],
    economy: null,
    online: null,
    sources: [],
    claims: [],
    seo: null,
    review: null,
    redirects: [],
    diagnostics: cloneValue(context.diagnostics || {})
  });
}

module.exports = {
  GuideDataAdapterError,
  adaptGuideSnapshotV2,
  adaptLegacyGuide,
  adaptUnavailableGuide
};
