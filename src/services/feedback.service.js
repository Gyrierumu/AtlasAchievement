const { all, run, get } = require('../db/db');
const AppError = require('../utils/AppError');

const FEEDBACK_TYPES = new Set([
  'Erro em guia',
  'Bug do site',
  'Sugestão',
  'Pedido de novo guia'
]);

const LIMITS = {
  message: 2000,
  game: 120,
  pageUrl: 500,
  name: 80,
  email: 120
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

function validateFeedbackPayload(payload = {}) {
  const type = compactText(payload.type, 40);
  const message = compactText(payload.message, LIMITS.message);
  const relatedGame = compactText(payload.relatedGame, LIMITS.game);
  const pageUrl = validatePageUrl(payload.pageUrl);
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

  return { type, message, relatedGame, pageUrl, nickname, email };
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
    `INSERT INTO feedbacks (type, related_game, page_url, message, nickname, email)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.type, data.relatedGame || null, data.pageUrl || null, data.message, data.nickname || null, data.email || null]
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
    `SELECT id, type, related_game, page_url, message, nickname, email, status, created_at
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
  FEEDBACK_TYPES: Array.from(FEEDBACK_TYPES)
};
