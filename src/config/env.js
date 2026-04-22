const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const hasSessionSecret = typeof process.env.SESSION_SECRET === 'string' && process.env.SESSION_SECRET.trim().length >= 16;
const hasAdminUsername = typeof process.env.ADMIN_USERNAME === 'string' && process.env.ADMIN_USERNAME.trim().length >= 3;
const hasAdminPassword = typeof process.env.ADMIN_PASSWORD === 'string' && process.env.ADMIN_PASSWORD.length >= 8;

const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv,
  isProduction,
  sessionSecret: hasSessionSecret ? process.env.SESSION_SECRET.trim() : 'mtg-super-secret-change-me',
  adminUsername: hasAdminUsername ? process.env.ADMIN_USERNAME.trim() : 'admin',
  adminPassword: hasAdminPassword ? process.env.ADMIN_PASSWORD : 'admin123',
  hasSessionSecret,
  hasAdminUsername,
  hasAdminPassword,
  allowDefaultAdminBootstrap: process.env.ALLOW_DEFAULT_ADMIN_BOOTSTRAP === 'true' || !isProduction,
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '../../database.sqlite'),
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../public/uploads'),
  maxUploadSizeBytes: Number(process.env.MAX_UPLOAD_SIZE_BYTES || 5 * 1024 * 1024),
  loginRateLimitWindowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  loginRateLimitMaxAttempts: Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 8),
  loginBlockDurationMs: Number(process.env.LOGIN_BLOCK_DURATION_MS || 15 * 60 * 1000),
  appUrl: (process.env.APP_URL || '').trim(),
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
  sessionMaxAgeHours: Number(process.env.SESSION_MAX_AGE_HOURS || 8),
  sessionCleanupIntervalMinutes: Number(process.env.SESSION_CLEANUP_INTERVAL_MINUTES || 30)
};

function assertRuntimeConfig() {
  if (config.isProduction) {
    if (!config.hasSessionSecret) {
      throw new Error('SESSION_SECRET deve ser definido em produção com pelo menos 16 caracteres.');
    }

    if (!config.hasAdminUsername || !config.hasAdminPassword) {
      throw new Error('ADMIN_USERNAME e ADMIN_PASSWORD devem ser definidos em produção.');
    }
  }
}

function getStartupWarnings() {
  const warnings = [];

  if (!config.hasSessionSecret) {
    warnings.push('SESSION_SECRET não definido. Usando valor padrão apenas para ambiente local.');
  }

  if (!config.hasAdminUsername || !config.hasAdminPassword) {
    warnings.push('ADMIN_USERNAME/ADMIN_PASSWORD não definidos. Bootstrap padrão liberado apenas para ambiente local.');
  }

  if (config.loginRateLimitMaxAttempts < 3) {
    warnings.push('LOGIN_RATE_LIMIT_MAX_ATTEMPTS muito baixo pode bloquear testes locais com facilidade.');
  }

  if (config.sessionMaxAgeHours < 1) {
    warnings.push('SESSION_MAX_AGE_HOURS muito baixo pode gerar expiração rápida demais para o admin.');
  }

  return warnings;
}

module.exports = {
  ...config,
  assertRuntimeConfig,
  getStartupWarnings
};
