const path = require('path');
const AppError = require('../utils/AppError');
const guideModel = require('../shared/guideViewModel');

const ALLOWED_TROPHY_TYPES = ['Platina', 'Ouro', 'Prata', 'Bronze'];
const ALLOWED_EDITORIAL_STATUSES = ['draft', 'review', 'published'];
const ALLOWED_EDITORIAL_REVIEW_STATUSES = [
  'verified',
  'in_review',
  'needs_missables_check',
  'needs_online_check',
  'dlc_pending',
  'outdated',
  'draft'
];
const ALLOWED_COVERAGE_LEVELS = ['partial', 'strong', 'complete'];
const ALLOWED_VERIFICATION_STATUSES = ['unverified', 'review', 'verified'];
const TROPHY_TYPE_ALIASES = {
  platinum: 'Platina',
  platina: 'Platina',
  gold: 'Ouro',
  ouro: 'Ouro',
  silver: 'Prata',
  prata: 'Prata',
  bronze: 'Bronze'
};
const ALLOWED_SORTS = [
  'recommended-desc',
  'updated-desc',
  'created-desc',
  'difficulty-asc',
  'difficulty-desc',
  'time-asc',
  'time-desc',
  'trophies-asc',
  'trophies-desc',
  'name-asc'
];
const ALLOWED_FACETS = [
  'all',
  'difficulty-low',
  'difficulty-mid',
  'difficulty-high',
  'time-short',
  'time-medium',
  'time-long',
  'trophies-small',
  'trophies-medium',
  'trophies-large',
  'online-none',
  'online-required',
  'coop-required',
  'missable-present',
  'missable-none',
  'grind-present',
  'dlc-base',
  'chapter-select',
  'editorial-verified',
  'editorial-review'
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeString(value, maxLength = null) {
  const sanitized = typeof value === 'string' ? value.trim() : '';
  if (maxLength && sanitized.length > maxLength) {
    return sanitized.slice(0, maxLength);
  }
  return sanitized;
}

function normalizeEditorialReviewStatus(value) {
  const status = sanitizeString(value, 80).toLowerCase().replace(/-/g, '_');
  return ALLOWED_EDITORIAL_REVIEW_STATUSES.includes(status) ? status : '';
}

function normalizeQualityWarnings(value) {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeString(item, 220)).filter(Boolean).slice(0, 12);
  }
  return sanitizeString(value, 2000)
    .split(/\r?\n|;/)
    .map(item => sanitizeString(item, 220))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeRoadmapStepPayload(step) {
  if (typeof step === 'string') return sanitizeString(step, 2000);
  if (step && typeof step === 'object' && !Array.isArray(step)) {
    return step;
  }
  return sanitizeString(step, 2000);
}

function normalizeStringArray(value, maxLength = 240, limit = 20) {
  return (Array.isArray(value) ? value : [])
    .map(item => sanitizeString(item, maxLength))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeTextItemArray(value, maxLength = 240, limit = 20) {
  return (Array.isArray(value) ? value : [])
    .map(item => {
      if (typeof item === 'string') return sanitizeString(item, maxLength);
      if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
      return sanitizeString(item.text ?? item.label ?? item.title ?? item.name, maxLength);
    })
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeWalkthroughChecklist(value, stepId = '') {
  return (Array.isArray(value) ? value : [])
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: sanitizeString(`${stepId || 'walkthrough'}-${index + 1}`, 80),
          texto: sanitizeString(item, 260),
          status: false
        };
      }
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      return {
        id: sanitizeString(item.id ?? `${stepId || 'walkthrough'}-${index + 1}`, 80),
        texto: sanitizeString(item.texto ?? item.text ?? item.label ?? item.title, 260),
        status: item.status === true
      };
    })
    .filter(item => item && item.id && item.texto)
    .slice(0, 24);
}

function normalizeWalkthroughInstructionSteps(value, parentId = '') {
  return (Array.isArray(value) ? value : [])
    .map((item, index) => {
      if (typeof item === 'string') {
        const text = sanitizeString(item, 900);
        return text ? {
          id: sanitizeString(`${parentId || 'walkthrough'}-passo-${index + 1}`, 80),
          title: '',
          text,
          importantItems: [],
          relatedTrophies: [],
          warning: ''
        } : null;
      }
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const id = sanitizeString(item.id ?? `${parentId || 'walkthrough'}-passo-${index + 1}`, 80);
      const title = sanitizeString(item.title ?? item.titulo ?? item.label, 160);
      const text = sanitizeString(item.text ?? item.description ?? item.descricao ?? item.detail ?? item.body, 900);
      if (!title && !text) return null;
      return {
        id,
        title,
        text,
        importantItems: normalizeTextItemArray(item.importantItems ?? item.itens_importantes ?? item.items, 180, 12),
        relatedTrophies: normalizeTextItemArray(item.relatedTrophies ?? item.trofeus_relacionados ?? item.trophies, 140, 12),
        warning: sanitizeString(item.warning ?? item.alerta ?? item.missableAlert, 320)
      };
    })
    .filter(Boolean)
    .slice(0, 40);
}

function normalizeWalkthroughBosses(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const name = sanitizeString(item.name ?? item.nome ?? item.title, 160);
      if (!name) return null;
      return {
        name,
        type: sanitizeString(item.type ?? item.tipo, 60),
        trophy: sanitizeString(item.trophy ?? item.trofeu ?? item.relatedTrophy, 160),
        notes: sanitizeString(item.notes ?? item.note ?? item.observacao ?? item.description, 500)
      };
    })
    .filter(Boolean)
    .slice(0, 16);
}

function normalizeWalkthroughCollectibles(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const name = sanitizeString(item.name ?? item.nome ?? item.title, 180);
      if (!name) return null;
      return {
        name,
        type: sanitizeString(item.type ?? item.tipo, 80),
        trophy: sanitizeString(item.trophy ?? item.trofeu ?? item.relatedTrophy, 160),
        missable: item.missable === true || item.isMissable === true || item.is_missable === true,
        notes: sanitizeString(item.notes ?? item.note ?? item.observacao ?? item.description, 500)
      };
    })
    .filter(Boolean)
    .slice(0, 24);
}

function normalizeWalkthroughRecommendedImages(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => {
      if (typeof item === 'string') {
        const description = sanitizeString(item, 220);
        return description ? { description, reason: '' } : null;
      }
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const description = sanitizeString(item.description ?? item.image ?? item.imagem ?? item.title ?? item.label, 220);
      if (!description) return null;
      return {
        description,
        reason: sanitizeString(item.reason ?? item.motivo ?? item.notes ?? item.note, 260)
      };
    })
    .filter(Boolean)
    .slice(0, 16);
}

function normalizeWalkthroughTrophyCoverage(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const trophy = sanitizeString(item.trophy ?? item.trophyEn ?? item.en ?? item.name, 160);
      if (!trophy) return null;
      return {
        trophy,
        trophyPt: sanitizeString(item.trophyPt ?? item.ptBr ?? item.pt ?? item.namePt, 160),
        chapter: sanitizeString(item.chapter ?? item.capitulo ?? item.where, 120)
      };
    })
    .filter(Boolean)
    .slice(0, 60);
}

const WALKTHROUGH_IMAGE_TYPES = new Set(['location', 'item', 'boss', 'route', 'warning']);

function isSafeWalkthroughImagePath(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (/^https?:\/\//i.test(trimmed) || isSafeUploadPath(trimmed) || isSafePublicAssetPath(trimmed)) return true;
  if (!trimmed.startsWith('/images/') || trimmed.includes('\\')) return false;
  if (!/\.(?:jpe?g|png|webp|gif|avif)(?:[?#].*)?$/i.test(trimmed)) return false;

  const relativePath = trimmed.slice('/images/'.length).split(/[?#]/)[0];
  if (!relativePath || relativePath.startsWith('/') || path.isAbsolute(relativePath) || /^[a-z]:/i.test(relativePath)) {
    return false;
  }

  const normalizedPath = path.posix.normalize(relativePath);
  if (normalizedPath !== relativePath || normalizedPath === '.' || normalizedPath.startsWith('../')) {
    return false;
  }

  return normalizedPath.split('/').every(segment => segment && segment !== '.' && segment !== '..');
}

function normalizeWalkthroughImages(value) {
  return (Array.isArray(value) ? value : [])
    .map(image => {
      if (!image || typeof image !== 'object' || Array.isArray(image)) return null;
      const type = sanitizeString(image.type, 40).toLowerCase();
      return {
        src: sanitizeString(image.src, 500),
        alt: sanitizeString(image.alt, 240),
        caption: sanitizeString(image.caption, 320),
        type: WALKTHROUGH_IMAGE_TYPES.has(type) ? type : '',
        relatedTrophy: sanitizeString(image.relatedTrophy ?? image.related_trophy, 160),
        relatedItem: sanitizeString(image.relatedItem ?? image.related_item, 160)
      };
    })
    .filter(image => image && image.src && image.alt && isSafeWalkthroughImagePath(image.src))
    .slice(0, 8);
}

function normalizeWalkthroughStepPayload(step, index = 0) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) return null;
  const id = sanitizeString(step.id ?? `etapa-${index + 1}`, 80);
  const collectiblesSource = step.collectibles ?? step.coletaveis_detalhados ?? step.itens_detalhados;
  return {
    id,
    titulo_etapa: sanitizeString(step.titulo_etapa ?? step.title ?? step.titulo, 160),
    navigationLabel: sanitizeString(step.navigationLabel ?? step.navigation_label ?? step.navLabel, 80),
    objetivo_principal: sanitizeString(step.objetivo_principal ?? step.objective ?? step.objetivo, 700),
    area_local: sanitizeString(step.area_local ?? step.area ?? step.local, 180),
    quando_fazer: sanitizeString(step.quando_fazer ?? step.when ?? step.momento, 260),
    intro: sanitizeString(step.intro ?? step.introducao, 900),
    summary: normalizeTextItemArray(step.summary ?? step.nesta_parte ?? step.nestaParte ?? step.overview, 220, 20),
    recommendedLevel: sanitizeString(step.recommendedLevel ?? step.recommended_level ?? step.level, 80),
    videoUrl: sanitizeString(step.videoUrl ?? step.video_url, 500),
    acoes_obrigatorias: normalizeStringArray(step.acoes_obrigatorias ?? step.requiredActions ?? step.actions, 260, 20),
    trofeus_relacionados: normalizeStringArray(step.trofeus_relacionados ?? step.relatedTrophies ?? step.trophies, 140, 20),
    itens_coletaveis: normalizeTextItemArray(step.itens_coletaveis ?? step.importantItems ?? (Array.isArray(collectiblesSource) && collectiblesSource.every(item => typeof item === 'string') ? collectiblesSource : []), 180, 20),
    alertas_perdiveis: normalizeStringArray(step.alertas_perdiveis ?? step.missableAlerts ?? step.alerts, 320, 10),
    steps: normalizeWalkthroughInstructionSteps(step.steps ?? step.passos, id),
    bosses: normalizeWalkthroughBosses(step.bosses ?? step.chefes),
    collectibles: normalizeWalkthroughCollectibles(collectiblesSource),
    recommendedImages: normalizeWalkthroughRecommendedImages(step.recommendedImages ?? step.imagesRecommended ?? step.imagens_recomendadas),
    trophyCoverage: normalizeWalkthroughTrophyCoverage(step.trophyCoverage ?? step.coverage ?? step.cobertura_trofeus),
    images: normalizeWalkthroughImages(step.images),
    checklist: normalizeWalkthroughChecklist(step.checklist, id)
  };
}

function normalizeReviewedDate(value) {
  const text = sanitizeString(value, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeTrophyType(value) {
  const raw = sanitizeString(value, 20);
  const key = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return TROPHY_TYPE_ALIASES[key] || raw;
}

function isSafeUploadPath(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed.startsWith('/uploads/') || trimmed.includes('\\')) return false;

  const relativePath = trimmed.slice('/uploads/'.length);
  if (!relativePath || relativePath.startsWith('/') || path.isAbsolute(relativePath) || /^[a-z]:/i.test(relativePath)) {
    return false;
  }

  const normalizedPath = path.posix.normalize(relativePath);
  if (normalizedPath !== relativePath || normalizedPath === '.' || normalizedPath.startsWith('../')) {
    return false;
  }

  return normalizedPath.split('/').every(segment => segment && segment !== '.' && segment !== '..');
}

function isSafePublicAssetPath(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed.startsWith('/assets/') || trimmed.includes('\\')) return false;
  if (!/\.(?:jpe?g|png|webp|svg)(?:[?#].*)?$/i.test(trimmed)) return false;

  const relativePath = trimmed.slice('/assets/'.length).split(/[?#]/)[0];
  if (!relativePath || relativePath.startsWith('/') || path.isAbsolute(relativePath) || /^[a-z]:/i.test(relativePath)) {
    return false;
  }

  const normalizedPath = path.posix.normalize(relativePath);
  if (normalizedPath !== relativePath || normalizedPath === '.' || normalizedPath.startsWith('../')) {
    return false;
  }

  return normalizedPath.split('/').every(segment => segment && segment !== '.' && segment !== '..');
}

function isSafeImagePath(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return /^https?:\/\//i.test(trimmed) || isSafeUploadPath(trimmed) || isSafePublicAssetPath(trimmed);
}

function normalizeGamePayload(payload = {}) {
  const providedFields = Object.keys(payload || {});
  const hasOwn = field => Object.prototype.hasOwnProperty.call(payload, field);
  const runsSummary = sanitizeString(payload.runs_summary ?? payload.runs ?? payload.guide_runs, 500);
  const missableSummary = sanitizeString(payload.missable_summary ?? payload.missable, 1000);
  const onlineSummary = sanitizeString(payload.online_summary ?? payload.online ?? payload.guide_online, 500);
  const grindSummary = sanitizeString(payload.grind_summary ?? payload.grind ?? payload.guide_grind, 500);
  const dlcScope = sanitizeString(payload.dlc_scope ?? payload.dlc ?? payload.guide_dlc, 500);
  const bestFor = sanitizeString(payload.best_for ?? payload.ideal_for ?? payload.guide_ideal, 800);
  const avoidIf = sanitizeString(payload.avoid_if ?? payload.avoid_for ?? payload.guide_avoid, 800);
  const firstRunAdvice = sanitizeString(payload.first_run_advice ?? payload.guide_best_moment ?? payload.best_for_when, 1000);
  const requestedVerificationStatus = ALLOWED_VERIFICATION_STATUSES.includes(payload.verification_status)
    ? payload.verification_status
    : (payload.is_verified ? 'verified' : 'unverified');
  const editorialReviewStatus = normalizeEditorialReviewStatus(payload.editorial_review_status ?? payload.editorialReviewStatus ?? payload.editorialStatus);
  const isVerified = Boolean(payload.is_verified) || requestedVerificationStatus === 'verified' || editorialReviewStatus === 'verified';
  const verificationStatus = isVerified ? 'verified' : requestedVerificationStatus;
  const normalized = {
    _providedFields: providedFields,
    name: sanitizeString(payload.name, 120),
    difficulty: Number(payload.difficulty),
    time: sanitizeString(payload.time, 40),
    missable: missableSummary,
    runs: runsSummary,
    online: onlineSummary,
    grind: grindSummary,
    dlc: dlcScope,
    ideal_for: bestFor,
    avoid_for: avoidIf,
    best_for_when: sanitizeString(payload.best_for_when ?? payload.guide_best_moment ?? firstRunAdvice, 800),
    runs_summary: runsSummary,
    missable_summary: missableSummary,
    online_summary: onlineSummary,
    grind_summary: grindSummary,
    dlc_scope: dlcScope,
    difficulty_reason: sanitizeString(payload.difficulty_reason, 800),
    time_reason: sanitizeString(payload.time_reason, 800),
    first_run_advice: firstRunAdvice,
    cleanup_advice: sanitizeString(payload.cleanup_advice, 1000),
    before_you_start: sanitizeString(payload.before_you_start, 1000),
    best_for: bestFor,
    avoid_if: avoidIf,
    verification_status: verificationStatus,
    editorial_status: ALLOWED_EDITORIAL_STATUSES.includes(payload.editorial_status) ? payload.editorial_status : 'published',
    editorial_review_status: editorialReviewStatus,
    last_reviewed_at: normalizeReviewedDate(payload.last_reviewed_at ?? payload.lastReviewedAt),
    editorial_notes: sanitizeString(payload.editorial_notes ?? payload.editorialNotes, 2000),
    quality_warnings: normalizeQualityWarnings(payload.quality_warnings ?? payload.qualityWarnings),
    reviewed_by: sanitizeString(payload.reviewed_by ?? payload.reviewedBy, 120),
    coverage_level: ALLOWED_COVERAGE_LEVELS.includes(payload.coverage_level) ? payload.coverage_level : '',
    is_verified: isVerified,
    verification_note: sanitizeString(payload.verification_note, 180),
    image: typeof payload.image === 'string' ? payload.image.trim() || null : null,
    cover_image: typeof payload.cover_image === 'string' ? payload.cover_image.trim() || null : null,
    clearRoadmap: payload.clearRoadmap === true,
    trophies: hasOwn('trophies') && Array.isArray(payload.trophies)
      ? payload.trophies.map(trophy => ({
          id: sanitizeString(trophy?.id, 60),
          name: sanitizeString(trophy?.name, 140),
          name_pt: sanitizeString(trophy?.name_pt, 140),
          type: normalizeTrophyType(trophy?.type),
          description: sanitizeString(trophy?.description, 500),
          tip: sanitizeString(trophy?.tip, 1000),
          is_missable: Boolean(trophy?.is_missable),
          is_spoiler: Boolean(trophy?.is_spoiler)
        }))
      : undefined
  };

  if (hasOwn('roadmap')) {
    normalized.roadmap = Array.isArray(payload.roadmap)
      ? payload.roadmap.map(normalizeRoadmapStepPayload).filter(item => {
          if (typeof item === 'string') return Boolean(item);
          return Boolean(item && typeof item === 'object' && !Array.isArray(item));
        })
      : payload.roadmap;
  } else {
    normalized.roadmap = undefined;
  }

  if (hasOwn('walkthrough')) {
    normalized.walkthrough = Array.isArray(payload.walkthrough)
      ? payload.walkthrough
        .map(normalizeWalkthroughStepPayload)
        .filter(step => step && step.titulo_etapa && (
          step.objetivo_principal
          || step.intro
          || step.acoes_obrigatorias.length
          || step.steps.length
        ))
      : payload.walkthrough;
  } else {
    normalized.walkthrough = undefined;
  }

  return normalized;
}

function validateGamePayload(payload, options = {}) {
  const requireCore = options.requireCore !== false;
  const requireRoadmap = options.requireRoadmap !== false;
  const requireTrophies = options.requireTrophies !== false;
  const hasProvided = field => !Array.isArray(payload._providedFields) || payload._providedFields.includes(field);
  const errors = [];

  if ((requireCore || hasProvided('name')) && !isNonEmptyString(payload.name)) {
    errors.push('name é obrigatório.');
  } else if ((requireCore || hasProvided('name')) && (payload.name.length < 2 || payload.name.length > 120)) {
    errors.push('name deve ter entre 2 e 120 caracteres.');
  }

  if ((requireCore || hasProvided('difficulty')) && (!Number.isInteger(payload.difficulty) || payload.difficulty < 1 || payload.difficulty > 10)) {
    errors.push('difficulty deve ser um número inteiro entre 1 e 10.');
  }

  if ((requireCore || hasProvided('time')) && !isNonEmptyString(payload.time)) {
    errors.push('time é obrigatório.');
  } else if ((requireCore || hasProvided('time')) && !/\d/.test(payload.time)) {
    errors.push('time deve informar pelo menos um valor numérico de horas.');
  }

  if ((requireCore || hasProvided('missable') || hasProvided('missable_summary')) && !isNonEmptyString(payload.missable)) {
    errors.push('missable é obrigatório.');
  }

  if (!ALLOWED_EDITORIAL_STATUSES.includes(payload.editorial_status)) {
    errors.push('editorial_status deve ser draft, review ou published.');
  }

  if (payload.editorial_review_status && !ALLOWED_EDITORIAL_REVIEW_STATUSES.includes(payload.editorial_review_status)) {
    errors.push('editorial_review_status deve ser um status editorial de confiabilidade válido.');
  }

  if (payload.last_reviewed_at && !/^\d{4}-\d{2}-\d{2}$/.test(payload.last_reviewed_at)) {
    errors.push('last_reviewed_at deve usar o formato YYYY-MM-DD.');
  }

  if (payload.coverage_level && !ALLOWED_COVERAGE_LEVELS.includes(payload.coverage_level)) {
    errors.push('coverage_level deve ser partial, strong ou complete.');
  }

  if (payload.coverage_level === 'complete' && payload.verification_status !== 'verified' && !payload.is_verified) {
    errors.push('coverage_level complete exige verification_status verified.');
  }

  if (payload.verification_note && payload.verification_note.length > 180) {
    errors.push('verification_note aceita até 180 caracteres.');
  }

  if (payload.verification_status && !ALLOWED_VERIFICATION_STATUSES.includes(payload.verification_status)) {
    errors.push('verification_status deve ser unverified, review ou verified.');
  }

  if (requireRoadmap && !guideModel.isValidRoadmap(payload.roadmap)) {
    errors.push('roadmap deve ser um array com pelo menos um passo válido.');
  } else if (Array.isArray(payload.roadmap) && payload.roadmap.length > 40) {
    errors.push('roadmap aceita até 40 passos.');
  }

  if (payload.walkthrough !== undefined && !guideModel.isValidWalkthrough(payload.walkthrough)) {
    errors.push('walkthrough deve ser um array opcional de etapas validas.');
  }

  const shouldValidateTrophies = Array.isArray(payload.trophies);
  if (requireTrophies && (!shouldValidateTrophies || payload.trophies.length === 0)) {
    errors.push('trophies deve ser um array com pelo menos um troféu.');
  } else if (shouldValidateTrophies) {
    const ids = new Set();

    payload.trophies.forEach((trophy, index) => {
      if (!isNonEmptyString(trophy.id)) {
        errors.push(`trophies[${index}].id é obrigatório.`);
      } else if (!/^[a-zA-Z0-9._:-]{1,60}$/.test(trophy.id)) {
        errors.push(`trophies[${index}].id deve usar até 60 caracteres alfanuméricos ou . _ : -.`);
      } else if (ids.has(trophy.id.toLowerCase())) {
        errors.push(`trophies[${index}].id está duplicado.`);
      } else {
        ids.add(trophy.id.toLowerCase());
      }

      if (!isNonEmptyString(trophy.name)) {
        errors.push(`trophies[${index}].name é obrigatório.`);
      }

      if (!ALLOWED_TROPHY_TYPES.includes(trophy.type)) {
        errors.push(`trophies[${index}].type deve ser Platina, Ouro, Prata ou Bronze.`);
      }

      if (!isNonEmptyString(trophy.description)) {
        errors.push(`trophies[${index}].description é obrigatório.`);
      }

      if (!isNonEmptyString(trophy.tip)) {
        errors.push(`trophies[${index}].tip é obrigatório.`);
      }
    });
  }

  if (payload.image !== null && typeof payload.image !== 'string') {
    errors.push('image deve ser uma string quando informada.');
  } else if (payload.image && !isSafeImagePath(payload.image)) {
    errors.push('image deve ser uma URL http(s) valida, um caminho interno de upload ou um asset publico interno.');
  }

  if (payload.cover_image !== null && typeof payload.cover_image !== 'string') {
    errors.push('cover_image deve ser uma string quando informada.');
  } else if (payload.cover_image && !isSafeImagePath(payload.cover_image)) {
    errors.push('cover_image deve ser uma URL http(s) valida, um caminho interno de upload ou um asset publico interno.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function normalizeListQuery(query = {}) {
  const searchValue = typeof query.q === 'string'
    ? query.q
    : (typeof query.search === 'string' ? query.search : '');
  return {
    search: searchValue.trim().slice(0, 100),
    facet: typeof query.facet === 'string' ? query.facet.trim() : 'all',
    sort: typeof query.sort === 'string' ? query.sort.trim() : 'name-asc',
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 24
  };
}

function validateListQuery(query) {
  const errors = [];

  if (!ALLOWED_FACETS.includes(query.facet)) {
    errors.push('facet inválido.');
  }

  if (!ALLOWED_SORTS.includes(query.sort)) {
    errors.push('sort inválido.');
  }

  if (!Number.isInteger(query.page) || query.page < 1) {
    errors.push('page deve ser um inteiro maior ou igual a 1.');
  }

  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100) {
    errors.push('limit deve ser um inteiro entre 1 e 100.');
  }

  if (errors.length) {
    throw new AppError('Parâmetros de consulta inválidos.', 400, errors, 'INVALID_QUERY');
  }

  return query;
}

module.exports = {
  validateGamePayload,
  normalizeGamePayload,
  normalizeListQuery,
  validateListQuery
};
