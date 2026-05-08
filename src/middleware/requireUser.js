const AppError = require('../utils/AppError');

function requireUser(req, _res, next) {
  const userId = Number(req.session?.userId || 0);
  if (!userId) {
    return next(new AppError('Acesso restrito ao usuario autenticado.', 401, null, 'USER_AUTH_REQUIRED'));
  }

  req.userId = userId;
  return next();
}

module.exports = requireUser;
