const gamesService = require('../services/games.service');
const { validateGamePayload, normalizeGamePayload, normalizeListQuery, validateListQuery } = require('../validators/game.validator');

async function listGames(req, res) {
  const query = validateListQuery(normalizeListQuery(req.query));
  const games = await gamesService.listGames(query);
  res.json(games);
}

async function getGameByName(req, res) {
  const game = await gamesService.getGameByName(req.params.name);
  res.json(game);
}

async function getGameBySlug(req, res) {
  const game = await gamesService.getGameBySlug(req.params.slug);
  res.json(game);
}

async function getGameById(req, res) {
  const game = await gamesService.getGameById(Number(req.params.id));
  res.json(game);
}

async function createGame(req, res) {
  const payload = normalizeGamePayload(req.body);
  const validation = validateGamePayload(payload);
  if (!validation.isValid) {
    const error = new Error('Payload inválido.');
    error.statusCode = 400;
    error.code = 'INVALID_GAME_PAYLOAD';
    error.details = validation.errors;
    throw error;
  }

  const game = await gamesService.createGame(payload);
  res.status(201).json({ message: 'Jogo criado com sucesso.', game });
}

async function updateGame(req, res) {
  const payload = normalizeGamePayload(req.body);
  const validation = validateGamePayload(payload);
  if (!validation.isValid) {
    const error = new Error('Payload inválido.');
    error.statusCode = 400;
    error.code = 'INVALID_GAME_PAYLOAD';
    error.details = validation.errors;
    throw error;
  }

  const game = await gamesService.updateGame(Number(req.params.id), payload);
  res.json({ message: 'Jogo atualizado com sucesso.', game });
}

async function deleteGame(req, res) {
  const result = await gamesService.deleteGame(Number(req.params.id));
  res.json(result);
}

async function duplicateGame(req, res) {
  const game = await gamesService.duplicateGame(Number(req.params.id));
  res.status(201).json({ message: 'Jogo duplicado com sucesso.', game });
}

async function getAdminSummary(req, res) {
  const summary = await gamesService.getAdminDashboardSummary();
  res.json(summary);
}

module.exports = {
  listGames,
  getGameByName,
  getGameBySlug,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  duplicateGame,
  getAdminSummary
};
