const AppError = require('../utils/AppError');

function requireAdmin(req, _res, next) {
  if (!req.session?.admin) {
    return next(new AppError('Acesso restrito ao administrador.', 401));
  }

  next();
}

module.exports = requireAdmin;
