const userLibraryService = require('../services/userLibrary.service');
const userService = require('../services/user.service');

async function getLibrary(req, res) {
  const payload = await userLibraryService.getLibrary(req.userId);
  res.json(payload);
}

async function exportAccountData(req, res) {
  const payload = await userLibraryService.exportAccountData(req.userId);
  res.json(payload);
}

async function clearAccountProgress(req, res) {
  const payload = await userLibraryService.clearAccountProgress(req.userId);
  res.json({
    message: 'Progresso da conta limpo com sucesso.',
    ...payload
  });
}

async function addLibraryGame(req, res) {
  const entry = await userLibraryService.addLibraryGame(req.userId, req.body || {});
  const payload = await userLibraryService.getLibrary(req.userId);
  res.status(201).json({
    message: 'Jogo salvo na conta.',
    entry,
    ...payload
  });
}

async function updateLibraryGame(req, res) {
  const entry = await userLibraryService.updateLibraryGame(req.userId, req.params.gameId, req.body || {});
  const payload = await userLibraryService.getLibrary(req.userId);
  res.json({
    message: 'Biblioteca da conta atualizada.',
    entry,
    ...payload
  });
}

async function removeLibraryGame(req, res) {
  const result = await userLibraryService.removeLibraryGame(req.userId, req.params.gameId, req.body || {});
  const payload = await userLibraryService.getLibrary(req.userId);
  res.json({
    message: result.removed ? 'Jogo removido da conta.' : 'Jogo já estava fora da conta.',
    removed: result.removed,
    keep_progress: result.keepProgress,
    ...payload
  });
}

async function getProgress(req, res) {
  const progress = await userLibraryService.getProgress(req.userId, req.params.gameId);
  res.json(progress);
}

async function updateProgress(req, res) {
  const progress = await userLibraryService.updateProgress(
    req.userId,
    req.params.gameId,
    req.params.trophyCode,
    req.body || {}
  );
  res.json({
    message: 'Progresso salvo na conta.',
    ...progress
  });
}

async function bulkProgress(req, res) {
  const progress = await userLibraryService.bulkProgress(req.userId, req.params.gameId, req.body || {});
  const payload = await userLibraryService.getLibrary(req.userId);
  res.json({
    message: 'Progresso importado para a conta.',
    progress,
    ...payload
  });
}

async function deleteAccount(req, res, next) {
  await userService.deleteAccount(req.userId, req.body || {});

  if (!req.session) {
    res.json({ message: 'Conta excluída com sucesso.', authenticated: false });
    return;
  }

  delete req.session.userId;
  delete req.session.user;

  req.session.save(error => {
    if (error) return next(error);
    return res.json({
      message: 'Conta excluída com sucesso.',
      authenticated: false,
      user: null
    });
  });
}

module.exports = {
  getLibrary,
  exportAccountData,
  clearAccountProgress,
  addLibraryGame,
  updateLibraryGame,
  removeLibraryGame,
  getProgress,
  updateProgress,
  bulkProgress,
  deleteAccount
};
