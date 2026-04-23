const { all, get, run, exec } = require('../db/db');
const AppError = require('../utils/AppError');
const { removeManagedUpload, isManagedUpload } = require('./file.service');
const { slugifyGameName, buildSlugVariant } = require('../utils/slug');
const { parseTimeValue, formatTimeMetadata } = require('../utils/time');

function normalizeGame(row, roadmapRows, trophyRows) {
  return {
    id: row.id,
    name: row.name,
    difficulty: row.difficulty,
    time: row.time,
    missable: row.missable,
    image: row.image,
    slug: row.slug || slugifyGameName(row.name),
    roadmap: roadmapRows.map(item => item.content),
    trophies: trophyRows.map(item => ({
      id: item.trophy_code,
      name: item.name,
      type: item.type,
      description: item.description,
      tip: item.tip,
      is_missable: Boolean(item.is_missable),
      is_spoiler: Boolean(item.is_spoiler)
    })),
    created_at: row.created_at,
    updated_at: row.updated_at,
    time_min_hours: row.time_min_hours,
    time_max_hours: row.time_max_hours,
    time_sort_hours: row.time_sort_hours,
    time_bucket: row.time_bucket || null
  };
}


function buildListFilters({ search = '', facet = 'all' } = {}) {
  const where = [];
  const params = [];

  if (search) {
    where.push('(lower(name) LIKE ? OR lower(slug) LIKE ?)');
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }

  switch (facet) {
    case 'difficulty-low':
      where.push('difficulty BETWEEN 1 AND 3');
      break;
    case 'difficulty-mid':
      where.push('difficulty BETWEEN 4 AND 6');
      break;
    case 'difficulty-high':
      where.push('difficulty BETWEEN 7 AND 10');
      break;
    case 'time-short':
      where.push("time_bucket = 'short'");
      break;
    case 'time-medium':
      where.push("time_bucket = 'medium'");
      break;
    case 'time-long':
      where.push("time_bucket = 'long'");
      break;
    case 'trophies-small':
      where.push('trophy_count > 0 AND trophy_count <= 30');
      break;
    case 'trophies-medium':
      where.push('trophy_count > 30 AND trophy_count <= 60');
      break;
    case 'trophies-large':
      where.push('trophy_count > 60');
      break;
    default:
      break;
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

function normalizeListRow(row) {
  return {
    ...row,
    trophy_count: row.trophy_count || 0,
    roadmap_count: row.roadmap_count || 0,
    slug: row.slug || slugifyGameName(row.name),
    time_bucket: row.time_bucket || null
  };
}

function matchesFacet(game, facet = 'all') {
  const difficulty = Number(game.difficulty || 0);
  const trophyCount = Number(game.trophy_count || 0);
  const timeValue = Number.isFinite(Number(game.time_sort_hours)) ? Number(game.time_sort_hours) : parseTimeValue(game.time || '');

  switch (facet) {
    case 'difficulty-low':
      return difficulty >= 1 && difficulty <= 3;
    case 'difficulty-mid':
      return difficulty >= 4 && difficulty <= 6;
    case 'difficulty-high':
      return difficulty >= 7 && difficulty <= 10;
    case 'time-short':
      return timeValue <= 15;
    case 'time-medium':
      return timeValue > 15 && timeValue <= 40;
    case 'time-long':
      return timeValue > 40 && timeValue < Number.MAX_SAFE_INTEGER;
    case 'trophies-small':
      return trophyCount > 0 && trophyCount <= 30;
    case 'trophies-medium':
      return trophyCount > 30 && trophyCount <= 60;
    case 'trophies-large':
      return trophyCount > 60;
    default:
      return true;
  }
}

function getListOrderBy(sort = 'name-asc') {
  const sorts = {
    'recommended-desc': `
      CASE WHEN roadmap_count > 0 THEN 0 ELSE 1 END ASC,
      CASE
        WHEN difficulty IS NULL THEN 2
        WHEN difficulty <= 3 THEN 0
        WHEN difficulty <= 6 THEN 1
        ELSE 2
      END ASC,
      CASE
        WHEN time_sort_hours IS NULL THEN 2
        WHEN time_sort_hours <= 15 THEN 0
        WHEN time_sort_hours <= 40 THEN 1
        ELSE 2
      END ASC,
      trophy_count DESC,
      updated_at DESC,
      name COLLATE NOCASE ASC
    `,
    'updated-desc': 'updated_at DESC, name COLLATE NOCASE ASC',
    'created-desc': 'created_at DESC, name COLLATE NOCASE ASC',
    'difficulty-desc': 'difficulty DESC, name COLLATE NOCASE ASC',
    'time-asc': 'CASE WHEN time_sort_hours IS NULL THEN 1 ELSE 0 END ASC, time_sort_hours ASC, name COLLATE NOCASE ASC',
    'trophies-desc': 'trophy_count DESC, name COLLATE NOCASE ASC',
    'name-asc': 'name COLLATE NOCASE ASC'
  };

  return sorts[sort] || sorts['name-asc'];
}
async function reserveUniqueSlug(baseName, excludeGameId = null) {
  const normalizedBase = slugifyGameName(baseName) || 'jogo';
  let sequence = 0;

  while (sequence < 1000) {
    const candidate = buildSlugVariant(normalizedBase, sequence);
    const existing = excludeGameId
      ? await get('SELECT id FROM games WHERE slug = ? AND id != ?', [candidate, excludeGameId])
      : await get('SELECT id FROM games WHERE slug = ?', [candidate]);

    if (!existing) {
      return candidate;
    }

    sequence += 1;
  }

  throw new AppError('Não foi possível gerar um slug único para o jogo.', 500, null, 'SLUG_GENERATION_FAILED');
}

async function listGames(options = {}) {
  const { search = '', facet = 'all', sort = 'name-asc', page = 1, limit = 500 } = options;
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 100);
  const requestedPage = Math.max(Number(page) || 1, 1);
  const { whereSql, params } = buildListFilters({ search, facet });
  const orderBy = getListOrderBy(sort);

  const baseCte = `WITH game_stats AS (
    SELECT g.id,
           g.name,
           g.slug,
           g.difficulty,
           g.time,
           g.time_min_hours,
           g.time_max_hours,
           g.time_sort_hours,
           g.time_bucket,
           g.missable,
           g.image,
           g.created_at,
           g.updated_at,
           COUNT(DISTINCT t.id) AS trophy_count,
           COUNT(DISTINCT r.id) AS roadmap_count
    FROM games g
    LEFT JOIN trophies t ON t.game_id = g.id
    LEFT JOIN roadmaps r ON r.game_id = g.id
    GROUP BY g.id, g.name, g.slug, g.difficulty, g.time, g.time_min_hours, g.time_max_hours, g.time_sort_hours, g.time_bucket, g.missable, g.image, g.created_at, g.updated_at
  )`;

  const totalRow = await get(
    `${baseCte}
     SELECT COUNT(*) AS total
     FROM game_stats
     ${whereSql}`,
    params
  );

  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
  const safePage = total > 0 ? Math.min(requestedPage, totalPages) : 1;
  const offset = (safePage - 1) * safeLimit;

  const rows = await all(
    `${baseCte}
     SELECT *
     FROM game_stats
     ${whereSql}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  const items = rows.map(normalizeListRow);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1
    }
  };
}

async function getGameRowById(id) {
  return get(
    'SELECT id, name, slug, difficulty, time, time_min_hours, time_max_hours, time_sort_hours, time_bucket, missable, image, created_at, updated_at FROM games WHERE id = ?',
    [id]
  );
}

async function getGameById(id) {
  const row = await getGameRowById(id);
  if (!row) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  const roadmapRows = await all(
    'SELECT content FROM roadmaps WHERE game_id = ? ORDER BY step_order ASC',
    [row.id]
  );

  const trophyRows = await all(
    `SELECT trophy_code, name, type, description, tip, is_missable, is_spoiler
     FROM trophies
     WHERE game_id = ?
     ORDER BY CASE type
       WHEN 'Platina' THEN 1
       WHEN 'Ouro' THEN 2
       WHEN 'Prata' THEN 3
       ELSE 4
     END, name ASC`,
    [row.id]
  );

  return normalizeGame(row, roadmapRows, trophyRows);
}

async function getGameByName(name) {
  const row = await get(
    'SELECT id FROM games WHERE lower(name) = lower(?)',
    [name]
  );

  if (!row) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  return getGameById(row.id);
}

async function getGameBySlug(slug) {
  const normalizedSlug = slugifyGameName(slug);
  const directRow = await get('SELECT id, slug FROM games WHERE slug = ?', [normalizedSlug]);

  if (directRow) {
    const game = await getGameById(directRow.id);
    return {
      ...game,
      requested_slug: normalizedSlug,
      canonical_slug: game.slug,
      redirect_required: false
    };
  }

  const redirectRow = await get(
    'SELECT g.id, g.slug FROM game_slug_redirects r JOIN games g ON g.id = r.game_id WHERE r.slug = ?',
    [normalizedSlug]
  );

  if (!redirectRow) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  const game = await getGameById(redirectRow.id);
  return {
    ...game,
    requested_slug: normalizedSlug,
    canonical_slug: game.slug,
    redirect_required: redirectRow.slug !== normalizedSlug
  };
}

async function insertGameData(gameId, payload) {
  for (let index = 0; index < payload.roadmap.length; index += 1) {
    await run(
      'INSERT INTO roadmaps (game_id, step_order, content) VALUES (?, ?, ?)',
      [gameId, index + 1, payload.roadmap[index].trim()]
    );
  }

  for (const trophy of payload.trophies) {
    await run(
      `INSERT INTO trophies (game_id, trophy_code, name, type, description, tip, is_missable, is_spoiler)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gameId,
        trophy.id.trim(),
        trophy.name.trim(),
        trophy.type,
        trophy.description.trim(),
        trophy.tip.trim(),
        trophy.is_missable ? 1 : 0,
        trophy.is_spoiler ? 1 : 0
      ]
    );
  }
}


async function countGamesUsingImage(imageUrl, excludeGameId = null) {
  if (!imageUrl) return 0;

  const row = excludeGameId
    ? await get('SELECT COUNT(*) AS total FROM games WHERE image = ? AND id != ?', [imageUrl, excludeGameId])
    : await get('SELECT COUNT(*) AS total FROM games WHERE image = ?', [imageUrl]);

  return Number(row?.total || 0);
}

async function removeManagedUploadIfUnused(imageUrl, excludeGameId = null) {
  if (!isManagedUpload(imageUrl)) return;

  const usageCount = await countGamesUsingImage(imageUrl, excludeGameId);
  if (usageCount === 0) {
    removeManagedUpload(imageUrl);
  }
}

async function createGame(payload) {
  const duplicate = await get('SELECT id FROM games WHERE lower(name) = lower(?)', [payload.name]);
  if (duplicate) {
    throw new AppError('Já existe um jogo com esse nome.', 409, null, 'GAME_NAME_CONFLICT');
  }

  const slug = await reserveUniqueSlug(payload.name);
  const timeMeta = formatTimeMetadata(payload.time);

  await exec('BEGIN TRANSACTION');

  let result;
  try {
    result = await run(
      'INSERT INTO games (name, slug, difficulty, time, time_min_hours, time_max_hours, time_sort_hours, time_bucket, missable, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [payload.name.trim(), slug, payload.difficulty, payload.time.trim(), timeMeta.time_min_hours, timeMeta.time_max_hours, timeMeta.time_sort_hours, timeMeta.time_bucket, payload.missable.trim(), payload.image?.trim() || null]
    );

    await insertGameData(result.lastID, payload);
    await exec('COMMIT');
  } catch (error) {
    await exec('ROLLBACK').catch(() => {});
    await removeManagedUploadIfUnused(payload.image);
    throw error;
  }

  return getGameById(result.lastID);
}

async function updateGame(id, payload) {
  const existing = await getGameRowById(id);
  if (!existing) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  const duplicate = await get(
    'SELECT id FROM games WHERE lower(name) = lower(?) AND id != ?',
    [payload.name, id]
  );

  if (duplicate) {
    throw new AppError('Já existe outro jogo com esse nome.', 409, null, 'GAME_NAME_CONFLICT');
  }

  const slug = await reserveUniqueSlug(payload.name, id);
  const timeMeta = formatTimeMetadata(payload.time);

  await exec('BEGIN TRANSACTION');

  try {
    if (existing.slug && existing.slug !== slug) {
      await run('INSERT OR IGNORE INTO game_slug_redirects (game_id, slug) VALUES (?, ?)', [id, existing.slug]);
      await run('DELETE FROM game_slug_redirects WHERE game_id = ? AND slug = ?', [id, slug]);
    }

    await run(
      'UPDATE games SET name = ?, slug = ?, difficulty = ?, time = ?, time_min_hours = ?, time_max_hours = ?, time_sort_hours = ?, time_bucket = ?, missable = ?, image = ? WHERE id = ?',
      [payload.name.trim(), slug, payload.difficulty, payload.time.trim(), timeMeta.time_min_hours, timeMeta.time_max_hours, timeMeta.time_sort_hours, timeMeta.time_bucket, payload.missable.trim(), payload.image?.trim() || null, id]
    );

    await run('DELETE FROM roadmaps WHERE game_id = ?', [id]);
    await run('DELETE FROM trophies WHERE game_id = ?', [id]);
    await insertGameData(id, payload);

    await exec('COMMIT');
  } catch (error) {
    await exec('ROLLBACK').catch(() => {});
    if (payload.image && payload.image !== existing.image) {
      await removeManagedUploadIfUnused(payload.image, id);
    }
    throw error;
  }

  if (existing.image && existing.image !== payload.image) {
    await removeManagedUploadIfUnused(existing.image, id);
  }

  return getGameById(id);
}

async function deleteGame(id) {
  const existing = await getGameRowById(id);
  if (!existing) {
    throw new AppError('Jogo não encontrado.', 404, null, 'GAME_NOT_FOUND');
  }

  await run('DELETE FROM games WHERE id = ?', [id]);
  await removeManagedUploadIfUnused(existing.image);

  return { message: 'Jogo removido com sucesso.' };
}


async function reserveDuplicateName(baseName) {
  const trimmed = String(baseName || '').trim() || 'Jogo';
  let sequence = 1;

  while (sequence < 1000) {
    const suffix = sequence === 1 ? ' (Cópia)' : ` (Cópia ${sequence})`;
    const candidate = `${trimmed}${suffix}`;
    const existing = await get('SELECT id FROM games WHERE lower(name) = lower(?)', [candidate]);
    if (!existing) return candidate;
    sequence += 1;
  }

  throw new AppError('Não foi possível gerar um nome único para a cópia.', 500, null, 'DUPLICATE_NAME_GENERATION_FAILED');
}

async function duplicateGame(id) {
  const game = await getGameById(id);
  const duplicateName = await reserveDuplicateName(game.name);
  const payload = {
    ...game,
    name: duplicateName,
    image: game.image || '',
    roadmap: [...(game.roadmap || [])],
    trophies: (game.trophies || []).map(item => ({ ...item }))
  };

  return createGame(payload);
}

async function getAdminDashboardSummary() {
  const [gamesCountRow, trophiesCountRow] = await Promise.all([
    get('SELECT COUNT(*) AS total FROM games'),
    get('SELECT COUNT(*) AS total FROM trophies')
  ]);

  return {
    totalGames: gamesCountRow?.total || 0,
    totalTrophies: trophiesCountRow?.total || 0
  };
}

module.exports = {
  listGames,
  getGameById,
  getGameByName,
  getGameBySlug,
  slugifyGameName,
  createGame,
  updateGame,
  deleteGame,
  getAdminDashboardSummary,
  parseTimeValue,
  matchesFacet,
  reserveUniqueSlug,
  duplicateGame
};
