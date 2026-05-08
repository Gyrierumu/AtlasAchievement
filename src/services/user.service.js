const { hashPassword, comparePassword } = require('./passwordHasher');
const { get, run } = require('../db/db');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 10;
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 8;
const DISPLAY_NAME_MAX = 60;
const BIO_MAX = 280;
const AVATAR_URL_MAX = 500;
const GENERIC_AUTH_ERROR = 'Credenciais inválidas.';
const GENERIC_REGISTER_CONFLICT = 'Não foi possível criar a conta com esses dados.';

function cleanText(value = '') {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEmail(value = '') {
  return cleanText(value).toLowerCase();
}

function normalizeUsername(value = '') {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function validateUsername(username) {
  return username.length >= USERNAME_MIN
    && username.length <= USERNAME_MAX
    && /^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(username);
}

function normalizeProfilePayload(payload = {}) {
  const displayName = cleanText(payload.display_name || payload.displayName || '');
  const bio = cleanText(payload.bio || '');
  const avatarUrl = cleanText(payload.avatar_url || payload.avatarUrl || '');

  const errors = [];
  if (displayName && displayName.length > DISPLAY_NAME_MAX) {
    errors.push(`display_name deve ter no máximo ${DISPLAY_NAME_MAX} caracteres.`);
  }

  if (bio.length > BIO_MAX) {
    errors.push(`bio deve ter no máximo ${BIO_MAX} caracteres.`);
  }

  if (avatarUrl) {
    if (avatarUrl.length > AVATAR_URL_MAX) {
      errors.push(`avatar_url deve ter no máximo ${AVATAR_URL_MAX} caracteres.`);
    } else {
      try {
        const parsed = new URL(avatarUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          errors.push('avatar_url deve usar http ou https.');
        }
      } catch (_error) {
        errors.push('avatar_url deve ser uma URL válida.');
      }
    }
  }

  return {
    values: {
      display_name: displayName,
      bio,
      avatar_url: avatarUrl
    },
    errors
  };
}

function normalizeRegisterPayload(payload = {}) {
  const username = normalizeUsername(payload.username || '');
  const email = normalizeEmail(payload.email || '');
  const password = typeof payload.password === 'string' ? payload.password : '';
  const profile = normalizeProfilePayload({
    display_name: payload.display_name || payload.displayName || username,
    bio: payload.bio || '',
    avatar_url: payload.avatar_url || payload.avatarUrl || ''
  });
  const displayName = profile.values.display_name || username;

  const errors = [];
  if (!validateUsername(username)) {
    errors.push(`username deve ter entre ${USERNAME_MIN} e ${USERNAME_MAX} caracteres e usar apenas letras, números, _ ou -.`);
  }

  if (!validateEmail(email)) {
    errors.push('email deve ser válido.');
  }

  if (password.length < PASSWORD_MIN) {
    errors.push(`password deve ter pelo menos ${PASSWORD_MIN} caracteres.`);
  }

  errors.push(...profile.errors);

  return {
    values: {
      username,
      email,
      password,
      display_name: displayName,
      bio: profile.values.bio,
      avatar_url: profile.values.avatar_url
    },
    errors
  };
}

function normalizeLoginPayload(payload = {}) {
  const identifier = cleanText(payload.identifier || payload.email || payload.username || '').toLowerCase();
  const password = typeof payload.password === 'string' ? payload.password : '';
  return { identifier, password };
}

function toPublicUser(row = null) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url || '',
    bio: row.bio || '',
    created_at: row.created_at
  };
}

function toPrivateUser(row = null) {
  if (!row) return null;
  return {
    ...toPublicUser(row),
    email: row.email,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at,
    is_active: Boolean(row.is_active)
  };
}

function throwValidation(errors) {
  if (errors.length) {
    throw new AppError('Revise os dados informados.', 400, errors, 'VALIDATION_ERROR');
  }
}

function isUniqueConstraintError(error) {
  return /SQLITE_CONSTRAINT/i.test(String(error?.code || error?.message || ''));
}

async function getUserById(id) {
  const row = await get(
    'SELECT id, username, email, display_name, avatar_url, bio, created_at, updated_at, last_login_at, is_active FROM users WHERE id = ?',
    [id]
  );
  return toPrivateUser(row);
}

async function registerUser(payload = {}) {
  const { values, errors } = normalizeRegisterPayload(payload);
  throwValidation(errors);

  const passwordHash = await hashPassword(values.password, SALT_ROUNDS);

  try {
    const result = await run(
      'INSERT INTO users (username, email, password_hash, display_name, avatar_url, bio) VALUES (?, ?, ?, ?, ?, ?)',
      [values.username, values.email, passwordHash, values.display_name, values.avatar_url || null, values.bio || null]
    );
    return getUserById(result.lastID);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(GENERIC_REGISTER_CONFLICT, 409, null, 'USER_REGISTER_CONFLICT');
    }
    throw error;
  }
}

async function verifyUserCredentials(payload = {}) {
  const { identifier, password } = normalizeLoginPayload(payload);
  if (!identifier || !password) {
    throw new AppError('Identificador e senha são obrigatórios.', 400, null, 'VALIDATION_ERROR');
  }

  const username = normalizeUsername(identifier);
  const row = await get(
    `SELECT id, username, email, password_hash, display_name, avatar_url, bio, created_at, updated_at, last_login_at, is_active
       FROM users
      WHERE is_active = 1 AND (lower(email) = lower(?) OR lower(username) = lower(?))
      LIMIT 1`,
    [identifier, username || identifier]
  );

  if (!row) {
    throw new AppError(GENERIC_AUTH_ERROR, 401, null, 'INVALID_CREDENTIALS');
  }

  const valid = await comparePassword(password, row.password_hash);
  if (!valid) {
    throw new AppError(GENERIC_AUTH_ERROR, 401, null, 'INVALID_CREDENTIALS');
  }

  await run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);
  return getUserById(row.id);
}

async function updateProfile(userId, payload = {}) {
  const existing = await getUserById(userId);
  if (!existing) {
    throw new AppError('Usuário não encontrado.', 404, null, 'USER_NOT_FOUND');
  }

  const { values, errors } = normalizeProfilePayload(payload);
  throwValidation(errors);

  const displayName = values.display_name || existing.display_name || existing.username;
  await run(
    'UPDATE users SET display_name = ?, avatar_url = ?, bio = ? WHERE id = ?',
    [displayName, values.avatar_url || null, values.bio || null, userId]
  );

  return getUserById(userId);
}

async function changePassword(userId, payload = {}) {
  const currentPassword = typeof payload.currentPassword === 'string' ? payload.currentPassword : '';
  const nextPassword = typeof payload.nextPassword === 'string' ? payload.nextPassword : '';

  if (!currentPassword || !nextPassword) {
    throw new AppError('Senha atual e nova senha são obrigatórias.', 400, null, 'VALIDATION_ERROR');
  }

  if (nextPassword.length < PASSWORD_MIN) {
    throw new AppError(`A nova senha deve ter pelo menos ${PASSWORD_MIN} caracteres.`, 400, null, 'VALIDATION_ERROR');
  }

  const row = await get('SELECT id, password_hash FROM users WHERE id = ? AND is_active = 1', [userId]);
  if (!row) {
    throw new AppError('Usuário não encontrado.', 404, null, 'USER_NOT_FOUND');
  }

  const valid = await comparePassword(currentPassword, row.password_hash);
  if (!valid) {
    throw new AppError('Senha atual inválida.', 401, null, 'INVALID_CURRENT_PASSWORD');
  }

  const passwordHash = await hashPassword(nextPassword, SALT_ROUNDS);
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

  return { updated: true };
}

async function deleteAccount(userId, payload = {}) {
  const currentPassword = typeof payload.currentPassword === 'string' ? payload.currentPassword : '';
  if (!currentPassword) {
    throw new AppError('Senha atual é obrigatória para excluir a conta.', 400, null, 'VALIDATION_ERROR');
  }

  const row = await get('SELECT id, password_hash FROM users WHERE id = ? AND is_active = 1', [userId]);
  if (!row) {
    throw new AppError('Usuário não encontrado.', 404, null, 'USER_NOT_FOUND');
  }

  const valid = await comparePassword(currentPassword, row.password_hash);
  if (!valid) {
    throw new AppError('Senha atual inválida.', 401, null, 'INVALID_CURRENT_PASSWORD');
  }

  await run('DELETE FROM user_trophy_progress WHERE user_id = ?', [userId]);
  await run('DELETE FROM user_library WHERE user_id = ?', [userId]);
  await run('DELETE FROM users WHERE id = ?', [userId]);

  return { deleted: true };
}

module.exports = {
  normalizeUsername,
  normalizeEmail,
  normalizeRegisterPayload,
  normalizeLoginPayload,
  toPublicUser,
  toPrivateUser,
  getUserById,
  registerUser,
  verifyUserCredentials,
  updateProfile,
  changePassword,
  deleteAccount,
  GENERIC_AUTH_ERROR
};
