const DEFAULT_PORT = 3000;

function parsePort(value) {
  const port = Number(value || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT deve ser um número inteiro entre 0 e 65535.');
  }
  return port;
}

function normalizeOrigin(value, fallback) {
  try {
    return new URL(value || fallback).origin;
  } catch {
    return fallback;
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const port = parsePort(process.env.PORT);
const fallbackOrigin = `http://localhost:${port}`;
const canonicalOrigin = normalizeOrigin(
  process.env.CANONICAL_ORIGIN || process.env.APP_URL,
  fallbackOrigin
);

function assertRuntimeConfig() {
  parsePort(port);
  if (nodeEnv === 'production' && !canonicalOrigin.startsWith('https://')) {
    throw new Error('CANONICAL_ORIGIN deve usar HTTPS em produção.');
  }
}

module.exports = {
  assertRuntimeConfig,
  canonicalOrigin,
  isProduction: nodeEnv === 'production',
  nodeEnv,
  port
};
