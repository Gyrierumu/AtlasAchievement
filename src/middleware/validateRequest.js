const AppError = require('../utils/AppError');

function validatePositiveIntegerParam(paramName, label = 'ID') {
  return function validateParam(req, res, next) {
    const value = Number(req.params?.[paramName]);
    if (!Number.isInteger(value) || value <= 0) {
      return next(new AppError(`${label} inválido.`, 400, null, 'INVALID_ID'));
    }

    req.params[paramName] = String(value);
    return next();
  };
}

module.exports = {
  validatePositiveIntegerParam
};
