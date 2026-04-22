const crypto = require('crypto');
const AppError = require('../utils/AppError');

function ensureCsrfToken(req) {
  if (!req.session) return null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  return req.session.csrfToken;
}

function issueCsrfToken(req, res, next) {
  const token = ensureCsrfToken(req);
  if (token) {
    res.setHeader('x-csrf-token', token);
  }
  next();
}

function requireCsrf(req, _res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  if (!req.session?.admin) {
    return next();
  }

  const origin = req.get('origin');
  const host = req.get('host');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return next(new AppError('Origem inválida para esta operação.', 403, null, 'CSRF_ORIGIN_MISMATCH'));
      }
    } catch (_error) {
      return next(new AppError('Cabeçalho Origin inválido.', 403, null, 'CSRF_INVALID_ORIGIN'));
    }
  }

  const requestToken = req.get('x-csrf-token');
  const sessionToken = ensureCsrfToken(req);
  if (!requestToken || !sessionToken || requestToken !== sessionToken) {
    return next(new AppError('Token de segurança ausente ou inválido.', 403, null, 'CSRF_TOKEN_INVALID'));
  }

  return next();
}

module.exports = {
  ensureCsrfToken,
  issueCsrfToken,
  requireCsrf
};
