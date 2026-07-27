const { all, get, run } = require('../db/db');
const gamesService = require('./games.service');
const userService = require('./user.service');
const AppError = require('../utils/AppError');

const DB_STATUS_VALUES = new Set(['want_to_play', 'in_progress', 'paused', 'completed']);
const STATUS_RANK = {
  want_to_play: 1,
  saved: 1,
  paused: 2,
  in_progress: 3,
  'in-progress': 3,
  completed: 4
};
const GUIDE_PROGRESS_V2_VERSION = 2;
const GUIDE_PROGRESS_V2_MAX_ITEMS = 71;
const GUIDE_PROGRESS_V2_SLUG = 'resident-evil-5';
const DANGEROUS_PROGRESS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function normalizePositiveInteger(value, fieldName = 'id') {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new AppError(`${fieldName} inválido.`, 400, null, 'VALIDATION_ERROR');
  }
  return number;
}

function normalizeStatus(value = 'want_to_play') {
  const normalized = String(value || 'want_to_play').trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'saved') return 'want_to_play';
  if (normalized === 'in_progress') return 'in_progress';
  if (DB_STATUS_VALUES.has(normalized)) return normalized;
  throw new AppError('Status de biblioteca inválido.', 400, null, 'VALIDATION_ERROR');
}

function toClientStatus(value = 'want_to_play') {
  if (value === 'want_to_play') return 'saved';
  if (value === 'in_progress') return 'in-progress';
  return value;
}

function pickAdvancedStatus(...values) {
  return values
    .map(value => {
      try {
        return normalizeStatus(value);
      } catch (_error) {
        return 'want_to_play';
      }
    })
    .sort((a, b) => (STATUS_RANK[b] || 0) - (STATUS_RANK[a] || 0))[0] || 'want_to_play';
}

function cleanTimestamp(value = null) {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function requireIsoTimestamp(value, fieldName = 'updatedAt') {
  const text = String(value || '').trim();
  const normalized = cleanTimestamp(text);
  if (
    !normalized
    || normalized !== text
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text)
  ) {
    throw new AppError(`${fieldName} inválido.`, 400, null, 'VALIDATION_ERROR');
  }
  return normalized;
}

function normalizeTrophyCode(value = '') {
  const code = String(value || '').trim();
  if (!code || code.length > 120) {
    throw new AppError('Código de troféu inválido.', 400, null, 'VALIDATION_ERROR');
  }
  return code;
}

function normalizeCompletedList(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

async function ensureGame(gameId) {
  const id = normalizePositiveInteger(gameId, 'game_id');
  return gamesService.getGameById(id);
}

async function getTrophyCodesForGame(gameId) {
  const rows = await all('SELECT trophy_code FROM trophies WHERE game_id = ?', [gameId]);
  return new Set(rows.map(row => row.trophy_code));
}

async function ensureTrophyCode(gameId, trophyCode) {
  const code = normalizeTrophyCode(trophyCode);
  const row = await get('SELECT trophy_code FROM trophies WHERE game_id = ? AND trophy_code = ?', [gameId, code]);
  if (!row) {
    throw new AppError('Troféu não encontrado para este jogo.', 404, null, 'TROPHY_NOT_FOUND');
  }
  return code;
}

async function getLibraryRow(userId, gameId) {
  return get(
    'SELECT id, user_id, game_id, status, created_at, updated_at, last_opened_at FROM user_library WHERE user_id = ? AND game_id = ?',
    [userId, gameId]
  );
}

async function ensureLibraryEntry(userId, gameId, payload = {}) {
  const status = payload.status ? normalizeStatus(payload.status) : 'want_to_play';
  const lastOpenedAt = cleanTimestamp(payload.last_opened_at || payload.lastOpenedAt) || new Date().toISOString();
  const existing = await getLibraryRow(userId, gameId);
  const nextStatus = existing ? pickAdvancedStatus(existing.status, status) : status;

  await run(
    `INSERT INTO user_library (user_id, game_id, status, last_opened_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, game_id) DO UPDATE SET
       status = excluded.status,
       last_opened_at = COALESCE(excluded.last_opened_at, user_library.last_opened_at)`,
    [userId, gameId, nextStatus, lastOpenedAt]
  );

  return getLibraryRow(userId, gameId);
}

async function inferAndApplyStatusFromProgress(userId, gameId, options = {}) {
  const trophyCount = await get('SELECT COUNT(*) AS total FROM trophies WHERE game_id = ?', [gameId]);
  const completedCount = await get(
    'SELECT COUNT(*) AS total FROM user_trophy_progress WHERE user_id = ? AND game_id = ? AND completed = 1',
    [userId, gameId]
  );
  const total = Number(trophyCount?.total || 0);
  const completed = Number(completedCount?.total || 0);
  if (!total) return null;

  const nextStatus = completed >= total ? 'completed' : completed > 0 ? 'in_progress' : 'want_to_play';
  const row = await getLibraryRow(userId, gameId);
  if (!row) {
    await ensureLibraryEntry(userId, gameId, { status: nextStatus });
    return nextStatus;
  }

  const statusToApply = options.preserveAdvancedStatus ? pickAdvancedStatus(row.status, nextStatus) : nextStatus;
  if (statusToApply !== row.status) {
    await run('UPDATE user_library SET status = ? WHERE user_id = ? AND game_id = ?', [statusToApply, userId, gameId]);
  }
  return statusToApply;
}

async function getCompletedMap(userId, gameIds = []) {
  const ids = [...new Set(gameIds.map(Number).filter(Number.isInteger))];
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await all(
    `SELECT game_id, trophy_code
       FROM user_trophy_progress
      WHERE user_id = ? AND completed = 1 AND game_id IN (${placeholders})
      ORDER BY trophy_code ASC`,
    [userId, ...ids]
  );
  const map = new Map(ids.map(id => [id, []]));
  rows.forEach(row => {
    const list = map.get(row.game_id) || [];
    list.push(row.trophy_code);
    map.set(row.game_id, list);
  });
  return map;
}

function buildStats(items = []) {
  const savedGames = items.length;
  const inProgressGames = items.filter(item => item.status === 'in-progress').length;
  const completedGames = items.filter(item => item.status === 'completed').length;
  const completedTrophies = items.reduce((total, item) => total + (Array.isArray(item.completed) ? item.completed.length : 0), 0);
  const gamesWithTrophies = items.filter(item => Array.isArray(item.trophies) && item.trophies.length > 0);
  const averageProgress = gamesWithTrophies.length
    ? Math.round(gamesWithTrophies.reduce((total, item) => {
      const trophyTotal = item.trophies.length;
      const done = Array.isArray(item.completed) ? item.completed.length : 0;
      return total + Math.round((done / trophyTotal) * 100);
    }, 0) / gamesWithTrophies.length)
    : 0;

  return {
    saved_games: savedGames,
    in_progress_games: inProgressGames,
    completed_games: completedGames,
    completed_trophies: completedTrophies,
    average_progress: averageProgress
  };
}

async function buildLibraryPayload(userId) {
  const rows = await all(
    `SELECT id, user_id, game_id, status, created_at, updated_at, last_opened_at
       FROM user_library
      WHERE user_id = ?
      ORDER BY COALESCE(last_opened_at, updated_at, created_at) DESC`,
    [userId]
  );
  const completedMap = await getCompletedMap(userId, rows.map(row => row.game_id));
  const games = await gamesService.getGamesByIds(rows.map(row => row.game_id));
  const gamesById = new Map(games.map(game => [Number(game.id), game]));
  const entries = rows.map(row => {
    const game = gamesById.get(Number(row.game_id));
    if (!game) return null;
    const completed = completedMap.get(row.game_id) || [];
    return {
      ...game,
      completed,
      accountStatus: row.status,
      status: toClientStatus(row.status),
      savedAt: row.created_at,
      lastOpenedAt: row.last_opened_at || row.updated_at || row.created_at,
      lastActivityAt: row.updated_at || row.last_opened_at || row.created_at
    };
  }).filter(Boolean);
  const library = {};
  entries.forEach(entry => {
    const key = entry.slug || String(entry.id);
    library[key] = entry;
  });

  return {
    source: 'account',
    library,
    items: entries,
    stats: buildStats(entries)
  };
}

async function getLibrary(userId) {
  return buildLibraryPayload(userId);
}

async function exportAccountData(userId) {
  const user = await userService.getUserById(userId);
  if (!user) {
    throw new AppError('Usuário não encontrado.', 404, null, 'USER_NOT_FOUND');
  }
  const libraryPayload = await buildLibraryPayload(userId);
  return {
    exported_at: new Date().toISOString(),
    format_version: 1,
    user,
    library: libraryPayload.library,
    stats: libraryPayload.stats
  };
}

async function clearAccountProgress(userId) {
  await run('DELETE FROM user_trophy_progress WHERE user_id = ?', [userId]);
  await run("UPDATE user_library SET status = 'want_to_play' WHERE user_id = ?", [userId]);
  return buildLibraryPayload(userId);
}

async function addLibraryGame(userId, payload = {}) {
  const game = await ensureGame(payload.game_id || payload.gameId || payload.id);
  const row = await ensureLibraryEntry(userId, game.id, payload);
  return {
    ...game,
    accountStatus: row.status,
    status: toClientStatus(row.status),
    completed: [],
    savedAt: row.created_at,
    lastOpenedAt: row.last_opened_at || row.updated_at || row.created_at,
    lastActivityAt: row.updated_at || row.last_opened_at || row.created_at
  };
}

async function updateLibraryGame(userId, gameId, payload = {}) {
  const game = await ensureGame(gameId);
  const existing = await getLibraryRow(userId, game.id);
  if (!existing) {
    throw new AppError('Jogo não encontrado na biblioteca da conta.', 404, null, 'USER_LIBRARY_NOT_FOUND');
  }

  const values = [];
  const assignments = [];
  if (payload.status) {
    assignments.push('status = ?');
    values.push(normalizeStatus(payload.status));
  }
  const lastOpenedAt = cleanTimestamp(payload.last_opened_at || payload.lastOpenedAt);
  if (lastOpenedAt) {
    assignments.push('last_opened_at = ?');
    values.push(lastOpenedAt);
  }
  if (!assignments.length) {
    assignments.push('last_opened_at = ?');
    values.push(new Date().toISOString());
  }

  await run(`UPDATE user_library SET ${assignments.join(', ')} WHERE user_id = ? AND game_id = ?`, [...values, userId, game.id]);
  const row = await getLibraryRow(userId, game.id);
  const progress = await getProgress(userId, game.id);
  return {
    ...game,
    accountStatus: row.status,
    status: toClientStatus(row.status),
    completed: progress.completed,
    savedAt: row.created_at,
    lastOpenedAt: row.last_opened_at || row.updated_at || row.created_at,
    lastActivityAt: row.updated_at || row.last_opened_at || row.created_at
  };
}

async function removeLibraryGame(userId, gameId, options = {}) {
  const id = normalizePositiveInteger(gameId, 'game_id');
  const keepProgress = Boolean(options.keepProgress || options.keep_progress);
  const result = await run('DELETE FROM user_library WHERE user_id = ? AND game_id = ?', [userId, id]);
  if (!keepProgress) {
    await run('DELETE FROM user_trophy_progress WHERE user_id = ? AND game_id = ?', [userId, id]);
  }
  return { removed: result.changes > 0, keepProgress };
}

async function getProgress(userId, gameId) {
  const game = await ensureGame(gameId);
  const rows = await all(
    `SELECT trophy_code, completed, completed_at, created_at, updated_at
       FROM user_trophy_progress
      WHERE user_id = ? AND game_id = ?
      ORDER BY trophy_code ASC`,
    [userId, game.id]
  );
  const completed = rows.filter(row => Number(row.completed) === 1).map(row => row.trophy_code);
  return {
    gameId: game.id,
    completed,
    items: rows.map(row => ({
      trophy_code: row.trophy_code,
      trophyCode: row.trophy_code,
      completed: Boolean(row.completed),
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    }))
  };
}

async function updateProgress(userId, gameId, trophyCode, payload = {}) {
  const game = await ensureGame(gameId);
  const code = await ensureTrophyCode(game.id, trophyCode);
  const completed = payload.completed !== false;
  const completedAt = completed ? (cleanTimestamp(payload.completed_at || payload.completedAt) || new Date().toISOString()) : null;

  await ensureLibraryEntry(userId, game.id, { status: completed ? 'in_progress' : 'want_to_play' });
  await run(
    `INSERT INTO user_trophy_progress (user_id, game_id, trophy_code, completed, completed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, game_id, trophy_code) DO UPDATE SET
       completed = excluded.completed,
       completed_at = excluded.completed_at`,
    [userId, game.id, code, completed ? 1 : 0, completedAt]
  );
  await inferAndApplyStatusFromProgress(userId, game.id);
  return getProgress(userId, game.id);
}

async function bulkProgress(userId, gameId, payload = {}) {
  const game = await ensureGame(gameId);
  const validCodes = await getTrophyCodesForGame(game.id);
  const items = Array.isArray(payload.items) ? payload.items : null;
  const completedFromList = normalizeCompletedList(payload.completed || payload.completedTrophies || payload.completed_trophies);

  if (!items && !completedFromList.length) {
    return getProgress(userId, game.id);
  }

  await ensureLibraryEntry(userId, game.id, { status: completedFromList.length ? 'in_progress' : 'want_to_play' });

  if (items) {
    for (const item of items) {
      const code = normalizeTrophyCode(item?.trophy_code || item?.trophyCode || item?.id);
      if (!validCodes.has(code)) continue;
      const completed = item?.completed !== false;
      const completedAt = completed ? (cleanTimestamp(item?.completed_at || item?.completedAt) || new Date().toISOString()) : null;
      await run(
        `INSERT INTO user_trophy_progress (user_id, game_id, trophy_code, completed, completed_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, game_id, trophy_code) DO UPDATE SET
           completed = CASE WHEN user_trophy_progress.completed = 1 OR excluded.completed = 1 THEN 1 ELSE excluded.completed END,
           completed_at = CASE WHEN user_trophy_progress.completed = 1 THEN user_trophy_progress.completed_at ELSE excluded.completed_at END`,
        [userId, game.id, code, completed ? 1 : 0, completedAt]
      );
    }
  } else {
    for (const code of completedFromList) {
      if (!validCodes.has(code)) continue;
      await run(
        `INSERT INTO user_trophy_progress (user_id, game_id, trophy_code, completed, completed_at)
         VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(user_id, game_id, trophy_code) DO UPDATE SET
           completed = 1,
           completed_at = COALESCE(user_trophy_progress.completed_at, excluded.completed_at)`,
        [userId, game.id, code, new Date().toISOString()]
      );
    }
  }

  await inferAndApplyStatusFromProgress(userId, game.id, { preserveAdvancedStatus: true });
  return getProgress(userId, game.id);
}

async function getGuideProgressContext(slug) {
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  if (normalizedSlug !== GUIDE_PROGRESS_V2_SLUG) {
    throw new AppError('Guia não disponível para progresso V2.', 404, null, 'GUIDE_PROGRESS_NOT_FOUND');
  }
  const guide = await gamesService.getGuideViewModelBySlug(normalizedSlug, {
    featureFlagEnabled: true,
    logger: null
  });
  const trophies = Array.isArray(guide?.trophies?.all) ? guide.trophies.all : [];
  if (guide?.sourceMode !== 'v2' || trophies.length !== GUIDE_PROGRESS_V2_MAX_ITEMS) {
    throw new AppError('Contrato de progresso do guia indisponível.', 503, null, 'GUIDE_PROGRESS_UNAVAILABLE');
  }
  const trophyCodes = new Set(trophies.map(item => String(item.trophyCode || '').trim()));
  if (
    trophyCodes.size !== GUIDE_PROGRESS_V2_MAX_ITEMS
    || trophyCodes.has('')
    || [...trophyCodes].some(code => DANGEROUS_PROGRESS_KEYS.has(code))
  ) {
    throw new AppError('Contrato de troféus do guia inválido.', 503, null, 'GUIDE_PROGRESS_UNAVAILABLE');
  }
  const game = await gamesService.getGameBySlug(normalizedSlug);
  return { guide, game, trophyCodes };
}

function normalizeGuideProgressV2Items(payload = {}, context = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError('Documento de progresso inválido.', 400, null, 'VALIDATION_ERROR');
  }
  if (
    Object.keys(payload).some(key => DANGEROUS_PROGRESS_KEYS.has(key))
    || payload.version !== GUIDE_PROGRESS_V2_VERSION
    || payload.slug !== GUIDE_PROGRESS_V2_SLUG
  ) {
    throw new AppError('Versão ou slug de progresso inválido.', 400, null, 'VALIDATION_ERROR');
  }

  let rawItems;
  if (Array.isArray(payload.items)) {
    rawItems = payload.items;
  } else if (payload.trophies && typeof payload.trophies === 'object' && !Array.isArray(payload.trophies)) {
    if (Object.keys(payload.trophies).some(key => DANGEROUS_PROGRESS_KEYS.has(key))) {
      throw new AppError('Chave de progresso inválida.', 400, null, 'VALIDATION_ERROR');
    }
    rawItems = Object.entries(payload.trophies).map(([trophyCode, value]) => ({
      trophyCode,
      ...(value && typeof value === 'object' ? value : {})
    }));
  } else {
    throw new AppError('Itens de progresso ausentes.', 400, null, 'VALIDATION_ERROR');
  }

  if (rawItems.length > GUIDE_PROGRESS_V2_MAX_ITEMS) {
    throw new AppError('Limite de troféus excedido.', 400, null, 'VALIDATION_ERROR');
  }
  const seen = new Set();
  return rawItems.map((item, index) => {
    if (
      !item
      || typeof item !== 'object'
      || Array.isArray(item)
      || Object.keys(item).some(key => DANGEROUS_PROGRESS_KEYS.has(key))
    ) {
      throw new AppError(`Item de progresso ${index + 1} inválido.`, 400, null, 'VALIDATION_ERROR');
    }
    const trophyCode = normalizeTrophyCode(item.trophyCode || item.trophy_code);
    if (DANGEROUS_PROGRESS_KEYS.has(trophyCode) || !context.trophyCodes?.has(trophyCode)) {
      throw new AppError('Troféu não pertence a este guia.', 400, null, 'TROPHY_NOT_FOUND');
    }
    if (seen.has(trophyCode)) {
      throw new AppError('Código de troféu duplicado.', 400, null, 'DUPLICATE_TROPHY_CODE');
    }
    if (typeof item.completed !== 'boolean') {
      throw new AppError('Estado de conclusão inválido.', 400, null, 'VALIDATION_ERROR');
    }
    seen.add(trophyCode);
    return {
      trophyCode,
      completed: item.completed,
      updatedAt: requireIsoTimestamp(item.updatedAt || item.updated_at, `items[${index}].updatedAt`)
    };
  });
}

function toServerProgressDocument(rows, slug = GUIDE_PROGRESS_V2_SLUG) {
  const trophies = {};
  let updatedAt = '1970-01-01T00:00:00.000Z';
  rows.forEach(row => {
    const rowUpdatedAt = cleanTimestamp(row.updated_at || row.created_at) || updatedAt;
    if (rowUpdatedAt > updatedAt) updatedAt = rowUpdatedAt;
    trophies[row.trophy_code] = {
      completed: Boolean(row.completed),
      updatedAt: rowUpdatedAt,
      source: 'server'
    };
  });
  return {
    version: GUIDE_PROGRESS_V2_VERSION,
    slug,
    updatedAt,
    source: 'server',
    dirty: false,
    trophies,
    checklists: {},
    migrations: {
      phase6Legacy: {
        status: 'not-needed',
        completedAt: null,
        ambiguousDlcDetected: false,
        warningAcknowledged: false
      }
    }
  };
}

async function getGuideProgressV2(userId, slug) {
  const normalizedUserId = normalizePositiveInteger(userId, 'user_id');
  const context = await getGuideProgressContext(slug);
  const rows = await all(
    `SELECT trophy_code, completed, completed_at, created_at, updated_at
       FROM user_trophy_progress
      WHERE user_id = ? AND game_id = ?
      ORDER BY trophy_code ASC`,
    [normalizedUserId, context.game.id]
  );
  const safeRows = rows.filter(row => context.trophyCodes.has(row.trophy_code));
  return toServerProgressDocument(safeRows, context.game.slug);
}

async function saveGuideProgressV2(userId, slug, payload = {}) {
  const normalizedUserId = normalizePositiveInteger(userId, 'user_id');
  const context = await getGuideProgressContext(slug);
  const items = normalizeGuideProgressV2Items(payload, context);
  const existingRows = await all(
    `SELECT trophy_code, completed, completed_at, created_at, updated_at
       FROM user_trophy_progress
      WHERE user_id = ? AND game_id = ?`,
    [normalizedUserId, context.game.id]
  );
  const existingByCode = new Map(existingRows.map(row => [row.trophy_code, row]));

  await ensureLibraryEntry(normalizedUserId, context.game.id, {
    status: items.some(item => item.completed) ? 'in_progress' : 'want_to_play'
  });
  for (const item of items) {
    const existing = existingByCode.get(item.trophyCode);
    const serverTimestamp = cleanTimestamp(existing?.updated_at || existing?.created_at);
    if (existing && serverTimestamp && item.updatedAt <= serverTimestamp) {
      continue;
    }
    if (existing) {
      await run(
        `UPDATE user_trophy_progress
            SET completed = ?, completed_at = ?, updated_at = ?
          WHERE user_id = ? AND game_id = ? AND trophy_code = ?`,
        [
          item.completed ? 1 : 0,
          item.completed ? item.updatedAt : null,
          item.updatedAt,
          normalizedUserId,
          context.game.id,
          item.trophyCode
        ]
      );
    } else {
      await run(
        `INSERT INTO user_trophy_progress
          (user_id, game_id, trophy_code, completed, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          normalizedUserId,
          context.game.id,
          item.trophyCode,
          item.completed ? 1 : 0,
          item.completed ? item.updatedAt : null,
          item.updatedAt,
          item.updatedAt
        ]
      );
    }
  }
  await inferAndApplyStatusFromProgress(normalizedUserId, context.game.id);
  return getGuideProgressV2(normalizedUserId, context.game.slug);
}

module.exports = {
  normalizeStatus,
  toClientStatus,
  pickAdvancedStatus,
  getLibrary,
  exportAccountData,
  clearAccountProgress,
  addLibraryGame,
  updateLibraryGame,
  removeLibraryGame,
  getProgress,
  updateProgress,
  bulkProgress,
  normalizeGuideProgressV2Items,
  toServerProgressDocument,
  getGuideProgressV2,
  saveGuideProgressV2
};
