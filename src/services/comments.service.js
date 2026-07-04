const crypto = require('crypto');
const { all, get, run } = require('../db/db');
const AppError = require('../utils/AppError');

const COMMENT_MIN_LENGTH = 2;
const COMMENT_MAX_LENGTH = 1000;
const COMMENT_RAW_MAX_LENGTH = 4000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 5;
const VALID_STATUSES = new Set(['pending', 'approved', 'hidden', 'deleted']);
const recentSubmissions = new Map();

function normalizeGuideSlug(value = '') {
  return String(value || '').trim().toLowerCase();
}

function hashValue(value = '') {
  const text = String(value || '').trim();
  if (!text) return null;
  return crypto.createHash('sha256').update(text).digest('hex');
}

function getClientIp(req) {
  return String(req?.ip || req?.get?.('x-forwarded-for') || 'unknown').split(',')[0].trim() || 'unknown';
}

function normalizeCommentBody(value = '') {
  const raw = String(value ?? '');
  if (raw.length > COMMENT_RAW_MAX_LENGTH) {
    throw new AppError(`Comentário muito longo. Use até ${COMMENT_MAX_LENGTH} caracteres.`, 400, null, 'COMMENT_TOO_LONG');
  }

  const normalized = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (/<\/?[a-z][\s\S]*>|javascript:|onerror\s*=|onclick\s*=|<script|<iframe|<style/i.test(normalized)) {
    throw new AppError('Envie apenas texto simples, sem HTML ou script.', 400, null, 'COMMENT_HTML_NOT_ALLOWED');
  }

  if (normalized.length < COMMENT_MIN_LENGTH) {
    throw new AppError(`Comentário deve ter pelo menos ${COMMENT_MIN_LENGTH} caracteres.`, 400, null, 'COMMENT_TOO_SHORT');
  }

  if (normalized.length > COMMENT_MAX_LENGTH) {
    throw new AppError(`Comentário muito longo. Use até ${COMMENT_MAX_LENGTH} caracteres.`, 400, null, 'COMMENT_TOO_LONG');
  }

  const compact = normalized.replace(/\s+/g, '');
  if (compact.length < COMMENT_MIN_LENGTH) {
    throw new AppError('Comentário não pode ficar vazio.', 400, null, 'COMMENT_EMPTY');
  }

  if (/^(.)\1{19,}$/u.test(compact)) {
    throw new AppError('Comentário parece repetitivo demais. Escreva uma dúvida ou dica mais clara.', 400, null, 'COMMENT_REPETITIVE');
  }

  return normalized;
}

function pruneRateLimit(now = Date.now()) {
  for (const [key, entries] of recentSubmissions.entries()) {
    const fresh = entries.filter(timestamp => now - timestamp < RATE_WINDOW_MS);
    if (fresh.length) recentSubmissions.set(key, fresh);
    else recentSubmissions.delete(key);
  }
}

function enforceCreateRateLimit({ userId, guideSlug, ip }) {
  const now = Date.now();
  pruneRateLimit(now);
  const keys = [
    `user:${userId}:guide:${guideSlug}`,
    `ip:${ip}:guide:${guideSlug}`
  ];

  for (const key of keys) {
    const entries = recentSubmissions.get(key) || [];
    if (entries.length >= RATE_MAX_PER_WINDOW) {
      throw new AppError('Muitos comentários enviados neste guia. Tente novamente em alguns minutos.', 429, null, 'COMMENT_RATE_LIMITED');
    }
  }

  keys.forEach(key => {
    const entries = recentSubmissions.get(key) || [];
    entries.push(now);
    recentSubmissions.set(key, entries);
  });
}

function toPublicComment(row = {}, actor = {}) {
  const userId = Number(row.user_id || 0);
  const isAdmin = Boolean(actor.isAdmin);
  const currentUserId = Number(actor.userId || 0);
  const displayName = String(row.display_name || row.username || 'Usuário Atlas').trim() || 'Usuário Atlas';
  return {
    id: Number(row.id),
    guide_slug: row.guide_slug,
    body: row.body,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: {
      display_name: displayName,
      username: row.username || ''
    },
    can_delete: Boolean(isAdmin || (currentUserId && currentUserId === userId))
  };
}

function toAdminComment(row = {}) {
  return {
    id: Number(row.id),
    guide_slug: row.guide_slug,
    guide_name: row.guide_name || '',
    user_id: Number(row.user_id || 0),
    body: row.body,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at || null,
    hidden_reason: row.hidden_reason || '',
    moderation_note: row.moderation_note || '',
    author: {
      display_name: row.display_name || row.username || 'Usuário Atlas',
      username: row.username || ''
    }
  };
}

async function getPublicComments(guideSlug, actor = {}) {
  const slug = normalizeGuideSlug(guideSlug);
  if (!slug) {
    throw new AppError('Guia não informado.', 400, null, 'COMMENT_GUIDE_REQUIRED');
  }

  const items = await all(
    `SELECT c.id, c.guide_slug, c.user_id, c.body, c.status, c.created_at, c.updated_at,
            u.username, u.display_name
       FROM guide_comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.guide_slug = ?
        AND c.status = 'approved'
        AND c.deleted_at IS NULL
      ORDER BY datetime(c.created_at) DESC, c.id DESC`,
    [slug]
  );

  return { items: items.map(item => toPublicComment(item, actor)) };
}

async function createComment(guideSlug, userId, payload = {}, req) {
  const slug = normalizeGuideSlug(guideSlug);
  const normalizedUserId = Number(userId || 0);
  if (!slug) throw new AppError('Guia não informado.', 400, null, 'COMMENT_GUIDE_REQUIRED');
  if (!normalizedUserId) throw new AppError('Acesso restrito ao usuário autenticado.', 401, null, 'USER_AUTH_REQUIRED');

  const game = await get('SELECT id, slug FROM games WHERE slug = ?', [slug]);
  if (!game) {
    throw new AppError('Guia não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  const body = normalizeCommentBody(payload.body);
  const linkCount = (body.match(/https?:\/\/|www\./gi) || []).length;
  if (linkCount > 2) {
    throw new AppError('Comentário com links demais foi bloqueado por proteção antispam.', 400, null, 'COMMENT_TOO_MANY_LINKS');
  }

  const duplicate = await get(
    `SELECT id FROM guide_comments
      WHERE guide_slug = ?
        AND user_id = ?
        AND lower(body) = lower(?)
        AND deleted_at IS NULL
        AND datetime(created_at) >= datetime('now', '-10 minutes')
      LIMIT 1`,
    [slug, normalizedUserId, body]
  );
  if (duplicate) {
    throw new AppError('Comentário repetido detectado. Aguarde antes de enviar de novo.', 429, null, 'COMMENT_DUPLICATE');
  }

  const ip = getClientIp(req);
  enforceCreateRateLimit({ userId: normalizedUserId, guideSlug: slug, ip });

  const result = await run(
    `INSERT INTO guide_comments
      (guide_slug, game_id, user_id, body, status, user_ip_hash, user_agent_hash)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    [
      slug,
      game.id,
      normalizedUserId,
      body,
      hashValue(ip),
      hashValue(req?.get?.('user-agent') || '')
    ]
  );

  return {
    id: result.lastID,
    status: 'pending',
    message: 'Comentário enviado e aguardando moderação.'
  };
}

async function softDeleteComment(id, actor = {}) {
  const commentId = Number(id || 0);
  if (!commentId) throw new AppError('Comentário inválido.', 400, null, 'COMMENT_INVALID_ID');

  const row = await get('SELECT id, user_id, status FROM guide_comments WHERE id = ? AND deleted_at IS NULL', [commentId]);
  if (!row) throw new AppError('Comentário não encontrado.', 404, null, 'COMMENT_NOT_FOUND');

  const isAdmin = Boolean(actor.isAdmin);
  const currentUserId = Number(actor.userId || 0);
  if (!isAdmin && currentUserId !== Number(row.user_id)) {
    throw new AppError('Você só pode apagar seus próprios comentários.', 403, null, 'COMMENT_DELETE_FORBIDDEN');
  }

  await run(
    `UPDATE guide_comments
        SET status = 'deleted',
            deleted_at = CURRENT_TIMESTAMP,
            moderation_note = COALESCE(?, moderation_note)
      WHERE id = ?`,
    [isAdmin ? (actor.note || 'Removido por administrador.') : 'Removido pelo próprio usuário.', commentId]
  );

  return { message: 'Comentário removido.' };
}

function normalizeAdminStatus(value = '') {
  const status = String(value || '').trim().toLowerCase();
  return VALID_STATUSES.has(status) ? status : '';
}

async function listAdminComments(filters = {}) {
  const page = Math.max(Number(filters.page || 1) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit || 20) || 20, 1), 50);
  const offset = (page - 1) * limit;
  const status = normalizeAdminStatus(filters.status);
  const guideSlug = normalizeGuideSlug(filters.guide || filters.guide_slug);
  const userQuery = String(filters.user || '').trim().toLowerCase();
  const fromDate = String(filters.from || '').trim();
  const toDate = String(filters.to || '').trim();
  const where = ['1 = 1'];
  const params = [];

  if (status) {
    where.push('c.status = ?');
    params.push(status);
  } else {
    where.push("c.status IN ('pending', 'approved', 'hidden')");
  }
  if (guideSlug) {
    where.push('c.guide_slug = ?');
    params.push(guideSlug);
  }
  if (userQuery) {
    where.push('(lower(u.username) LIKE ? OR lower(u.display_name) LIKE ?)');
    params.push(`%${userQuery}%`, `%${userQuery}%`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    where.push("datetime(c.created_at) >= datetime(?)");
    params.push(`${fromDate} 00:00:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    where.push("datetime(c.created_at) <= datetime(?)");
    params.push(`${toDate} 23:59:59`);
  }

  const whereSql = where.join(' AND ');
  const totalRow = await get(
    `SELECT COUNT(*) AS total
       FROM guide_comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN games g ON g.id = c.game_id
      WHERE ${whereSql}`,
    params
  );
  const total = Number(totalRow?.total || 0);
  const items = await all(
    `SELECT c.id, c.guide_slug, c.user_id, c.body, c.status, c.created_at, c.updated_at,
            c.deleted_at, c.hidden_reason, c.moderation_note,
            u.username, u.display_name, g.name AS guide_name
       FROM guide_comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN games g ON g.id = c.game_id
      WHERE ${whereSql}
      ORDER BY CASE c.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'hidden' THEN 2 ELSE 3 END,
               datetime(c.created_at) DESC,
               c.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    items: items.map(toAdminComment),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    }
  };
}

async function moderateComment(id, action, payload = {}) {
  const commentId = Number(id || 0);
  if (!commentId) throw new AppError('Comentário inválido.', 400, null, 'COMMENT_INVALID_ID');

  const row = await get('SELECT id, status FROM guide_comments WHERE id = ?', [commentId]);
  if (!row) throw new AppError('Comentário não encontrado.', 404, null, 'COMMENT_NOT_FOUND');

  const note = normalizeCommentBody(payload.moderation_note || payload.note || 'Atualizado pela moderação.').slice(0, 500);
  if (action === 'approve') {
    await run(
      `UPDATE guide_comments
          SET status = 'approved',
              deleted_at = NULL,
              hidden_reason = NULL,
              moderation_note = ?
        WHERE id = ?`,
      [note, commentId]
    );
    return { message: 'Comentário aprovado.' };
  }

  if (action === 'hide') {
    const hiddenReason = String(payload.hidden_reason || payload.reason || 'Ocultado pela moderação.').replace(/\s+/g, ' ').trim().slice(0, 300);
    await run(
      `UPDATE guide_comments
          SET status = 'hidden',
              hidden_reason = ?,
              moderation_note = ?
        WHERE id = ?`,
      [hiddenReason || 'Ocultado pela moderação.', note, commentId]
    );
    return { message: 'Comentário ocultado.' };
  }

  if (action === 'delete') {
    return softDeleteComment(commentId, { isAdmin: true, note });
  }

  throw new AppError('Ação de moderação inválida.', 400, null, 'COMMENT_INVALID_ACTION');
}

function resetCommentRateLimitForTests() {
  recentSubmissions.clear();
}

module.exports = {
  COMMENT_MAX_LENGTH,
  normalizeCommentBody,
  getPublicComments,
  createComment,
  softDeleteComment,
  listAdminComments,
  moderateComment,
  resetCommentRateLimitForTests
};
