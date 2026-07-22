const { all, run, get } = require('../db/db');
const AppError = require('../utils/AppError');

const FEEDBACK_TYPES = new Set([
  'Erro em guia',
  'Bug do site',
  'Sugestão',
  'Pedido de novo guia'
]);

const RE5_FEEDBACK_CATEGORIES = new Set([
  'Informação incorreta',
  'Instrução incompleta',
  'Link quebrado',
  'Problema visual',
  'Acessibilidade',
  'Checklist/progresso',
  'Problema mobile',
  'Outro'
]);
const RE5_TABS = new Set(['summary', 'roadmap', 'checklist', 'extras', 'dlc', 'attention']);
const VIEWPORT_BUCKETS = new Set(['small', 'medium', 'large', 'unknown']);

const LIMITS = {
  message: 2000,
  game: 120,
  pageUrl: 500,
  name: 80,
  email: 120,
  category: 60,
  anchor: 160,
  platform: 100,
  sourceUrl: 500,
  frontendVersion: 40
};

const recentSubmissions = new Map();
const SPAM_WINDOW_MS = 60 * 60 * 1000;
const SPAM_MAX_PER_WINDOW = 5;
const SPAM_MIN_FORM_AGE_MS = 2500;

function compactText(value = '', maxLength = 2000) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function hasHtmlLikeContent(value = '') {
  return /<[^>]*>|javascript:/i.test(String(value || ''));
}

function normalizeEmail(value = '') {
  return compactText(value, LIMITS.email).toLowerCase();
}

function validatePageUrl(value = '') {
  const pageUrl = compactText(value, LIMITS.pageUrl);
  if (!pageUrl) return '';
  if (hasHtmlLikeContent(pageUrl)) {
    throw new AppError('URL da página contém conteúdo inválido.', 400, null, 'FEEDBACK_INVALID_URL');
  }
  try {
    const parsed = new URL(pageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol');
    }
    return parsed.toString().slice(0, LIMITS.pageUrl);
  } catch (_error) {
    throw new AppError('URL da página inválida.', 400, null, 'FEEDBACK_INVALID_URL');
  }
}

function validateOptionalHttpUrl(value = '', label = 'URL') {
  const normalized = compactText(value, LIMITS.sourceUrl);
  if (!normalized) return '';
  if (hasHtmlLikeContent(normalized)) throw new AppError(`${label} contém conteúdo inválido.`, 400, null, 'FEEDBACK_INVALID_URL');
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('invalid URL');
    return parsed.toString().slice(0, LIMITS.sourceUrl);
  } catch (_error) {
    throw new AppError(`${label} inválida. Use uma URL http(s) completa.`, 400, null, 'FEEDBACK_INVALID_URL');
  }
}

function normalizeRe5PageUrl(value = '') {
  const pageUrl = validatePageUrl(value);
  try {
    const parsed = new URL(pageUrl);
    if (parsed.pathname !== '/jogo/resident-evil-5') throw new Error('wrong guide path');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (_error) {
    throw new AppError('A página informada não corresponde ao guia de Resident Evil 5.', 400, null, 'FEEDBACK_GUIDE_URL_MISMATCH');
  }
}

function validateRe5Context(payload = {}) {
  const guideSlug = compactText(payload.guideSlug, 80).toLowerCase();
  if (guideSlug !== 'resident-evil-5') return {
    guideSlug: '', category: '', sectionAnchor: '', platformVersion: '', sourceUrl: '',
    frontendVersion: '', reportDate: '', viewportBucket: '', activeTab: '', workflowState: ''
  };
  const category = compactText(payload.category, LIMITS.category);
  const sectionAnchor = compactText(payload.sectionAnchor, LIMITS.anchor);
  const platformVersion = compactText(payload.platformVersion, LIMITS.platform);
  const frontendVersion = compactText(payload.frontendVersion, LIMITS.frontendVersion);
  const viewportBucket = compactText(payload.viewportBucket, 20).toLowerCase();
  const activeTab = compactText(payload.activeTab, 30).toLowerCase();
  const sourceUrl = validateOptionalHttpUrl(payload.sourceUrl, 'URL da fonte');
  const plainFields = [category, sectionAnchor, platformVersion, frontendVersion, viewportBucket, activeTab];
  if (plainFields.some(hasHtmlLikeContent)) throw new AppError('O contexto do feedback deve conter apenas texto simples.', 400, null, 'FEEDBACK_HTML_NOT_ALLOWED');
  if (!RE5_FEEDBACK_CATEGORIES.has(category)) throw new AppError('Categoria editorial inválida.', 400, null, 'FEEDBACK_INVALID_CATEGORY');
  if (!sectionAnchor || !/^#?[a-z0-9][a-z0-9:_-]*$/i.test(sectionAnchor)) throw new AppError('Seção/âncora inválida.', 400, null, 'FEEDBACK_INVALID_ANCHOR');
  if (!platformVersion) throw new AppError('Informe a plataforma/versão observada.', 400, null, 'FEEDBACK_PLATFORM_REQUIRED');
  if (viewportBucket && !VIEWPORT_BUCKETS.has(viewportBucket)) throw new AppError('Faixa de viewport inválida.', 400, null, 'FEEDBACK_VIEWPORT_INVALID');
  if (activeTab && !RE5_TABS.has(activeTab)) throw new AppError('Aba ativa inválida.', 400, null, 'FEEDBACK_TAB_INVALID');
  if (frontendVersion && !/^[a-z0-9._-]+$/i.test(frontendVersion)) throw new AppError('Versão do frontend inválida.', 400, null, 'FEEDBACK_VERSION_INVALID');
  return {
    guideSlug,
    category,
    sectionAnchor: sectionAnchor.startsWith('#') ? sectionAnchor : `#${sectionAnchor}`,
    platformVersion,
    sourceUrl,
    frontendVersion,
    reportDate: new Date().toISOString().slice(0, 10),
    viewportBucket: viewportBucket || 'unknown',
    activeTab: activeTab || 'summary',
    workflowState: 'NEW'
  };
}

function validateFeedbackPayload(payload = {}) {
  const type = compactText(payload.type, 40);
  const message = compactText(payload.message, LIMITS.message);
  const relatedGame = compactText(payload.relatedGame, LIMITS.game);
  const re5Context = validateRe5Context(payload);
  const pageUrl = re5Context.guideSlug ? normalizeRe5PageUrl(payload.pageUrl) : validatePageUrl(payload.pageUrl);
  const nickname = compactText(payload.nickname, LIMITS.name);
  const email = normalizeEmail(payload.email);
  const website = compactText(payload.website, 120);
  const formStartedAt = Number(payload.formStartedAt || 0);

  const fieldsToCheck = [type, message, relatedGame, nickname, email, website];
  if (fieldsToCheck.some(hasHtmlLikeContent)) {
    throw new AppError('Envie apenas texto simples, sem HTML ou script.', 400, null, 'FEEDBACK_HTML_NOT_ALLOWED');
  }

  if (!FEEDBACK_TYPES.has(type)) {
    throw new AppError('Tipo de feedback inválido.', 400, null, 'FEEDBACK_INVALID_TYPE');
  }
  if (message.length < 10) {
    throw new AppError('Mensagem obrigatória. Descreva o feedback com pelo menos 10 caracteres.', 400, null, 'FEEDBACK_MESSAGE_REQUIRED');
  }
  if (String(payload.message || '').length > LIMITS.message) {
    throw new AppError(`Mensagem muito longa. Use até ${LIMITS.message} caracteres.`, 400, null, 'FEEDBACK_MESSAGE_TOO_LONG');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('E-mail inválido.', 400, null, 'FEEDBACK_INVALID_EMAIL');
  }
  if (website) {
    throw new AppError('Feedback rejeitado por proteção antispam.', 400, null, 'FEEDBACK_SPAM_DETECTED');
  }
  if (formStartedAt && Date.now() - formStartedAt < SPAM_MIN_FORM_AGE_MS) {
    throw new AppError('Aguarde alguns segundos antes de enviar.', 429, null, 'FEEDBACK_TOO_FAST');
  }

  return { type, message, relatedGame, pageUrl, nickname, email, ...re5Context };
}

function getClientKey(req) {
  return String(req.ip || req.get('x-forwarded-for') || 'unknown').split(',')[0].trim() || 'unknown';
}

function pruneRateLimit(now = Date.now()) {
  for (const [key, entries] of recentSubmissions.entries()) {
    const fresh = entries.filter(timestamp => now - timestamp < SPAM_WINDOW_MS);
    if (fresh.length) recentSubmissions.set(key, fresh);
    else recentSubmissions.delete(key);
  }
}

function enforceRateLimit(req) {
  const now = Date.now();
  pruneRateLimit(now);
  const key = getClientKey(req);
  const entries = recentSubmissions.get(key) || [];
  if (entries.length >= SPAM_MAX_PER_WINDOW) {
    throw new AppError('Muitos feedbacks enviados. Tente novamente mais tarde.', 429, null, 'FEEDBACK_RATE_LIMITED');
  }
  entries.push(now);
  recentSubmissions.set(key, entries);
}

async function createFeedback(payload = {}, req) {
  const data = validateFeedbackPayload(payload);
  enforceRateLimit(req);

  const result = await run(
    `INSERT INTO feedbacks (
       type, related_game, page_url, message, nickname, email, guide_slug, category,
       section_anchor, platform_version, source_url, frontend_version, report_date,
       viewport_bucket, active_tab, workflow_state
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.type, data.relatedGame || null, data.pageUrl || null, data.message,
      data.nickname || null, data.email || null, data.guideSlug || null, data.category || null,
      data.sectionAnchor || null, data.platformVersion || null, data.sourceUrl || null,
      data.frontendVersion || null, data.reportDate || null, data.viewportBucket || null,
      data.activeTab || null, data.workflowState || null
    ]
  );

  return { id: result.lastID };
}

async function listFeedbacks({ page = 1, limit = 20 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const offset = (safePage - 1) * safeLimit;
  const totalRow = await get('SELECT COUNT(*) AS total FROM feedbacks');
  const total = Number(totalRow?.total || 0);
  const items = await all(
    `SELECT id, type, related_game, page_url, message, nickname, email, status, created_at,
            guide_slug, category, section_anchor, platform_version, source_url,
            frontend_version, report_date, viewport_bucket, active_tab, workflow_state
       FROM feedbacks
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT ? OFFSET ?`,
    [safeLimit, offset]
  );

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1)
    }
  };
}

module.exports = {
  createFeedback,
  listFeedbacks,
  validateFeedbackPayload,
  FEEDBACK_TYPES: Array.from(FEEDBACK_TYPES),
  RE5_FEEDBACK_CATEGORIES: Array.from(RE5_FEEDBACK_CATEGORIES)
};
