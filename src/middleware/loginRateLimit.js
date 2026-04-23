const env = require('../config/env');
const AppError = require('../utils/AppError');

const attempts = new Map();

function buildKey(req) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  return `${ip}:${username}`;
}

function cleanupEntry(entry, now) {
  entry.timestamps = entry.timestamps.filter(ts => now - ts <= env.loginRateLimitWindowMs);
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    entry.blockedUntil = 0;
  }
}

function loginRateLimit(req, _res, next) {
  const key = buildKey(req);
  const now = Date.now();
  const entry = attempts.get(key) || { timestamps: [], blockedUntil: 0 };

  cleanupEntry(entry, now);

  if (entry.blockedUntil && entry.blockedUntil > now) {
    const waitSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return next(new AppError(`Muitas tentativas de login. Tente novamente em ${waitSeconds}s.`, 429));
  }

  req.loginRateLimitKey = key;
  attempts.set(key, entry);
  next();
}

function registerFailedLoginAttempt(req) {
  const key = req.loginRateLimitKey || buildKey(req);
  const now = Date.now();
  const entry = attempts.get(key) || { timestamps: [], blockedUntil: 0 };

  cleanupEntry(entry, now);
  entry.timestamps.push(now);

  if (entry.timestamps.length >= env.loginRateLimitMaxAttempts) {
    entry.blockedUntil = now + env.loginBlockDurationMs;
    entry.timestamps = [];
  }

  attempts.set(key, entry);
}

function clearLoginRateLimit(req) {
  const key = req.loginRateLimitKey || buildKey(req);
  attempts.delete(key);
}

module.exports = {
  loginRateLimit,
  registerFailedLoginAttempt,
  clearLoginRateLimit
};
