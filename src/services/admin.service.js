const bcrypt = require('bcrypt');
const env = require('../config/env');
const { get, run } = require('../db/db');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 10;

async function countAdminUsers() {
  const row = await get('SELECT COUNT(*) AS total FROM admin_users');
  return Number(row?.total || 0);
}

async function ensureDefaultAdmin() {
  const totalAdmins = await countAdminUsers();

  if (!env.allowDefaultAdminBootstrap && totalAdmins === 0) {
    throw new Error(
      'Nenhum administrador encontrado. Defina ADMIN_USERNAME e ADMIN_PASSWORD ou habilite ALLOW_DEFAULT_ADMIN_BOOTSTRAP=true temporariamente.'
    );
  }

  if (!env.allowDefaultAdminBootstrap) {
    return { created: false, skipped: true, username: null };
  }

  const existing = await get('SELECT id, username FROM admin_users WHERE username = ?', [env.adminUsername]);

  if (!existing) {
    const passwordHash = await bcrypt.hash(env.adminPassword, SALT_ROUNDS);
    await run(
      'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
      [env.adminUsername, passwordHash]
    );
    return { created: true, skipped: false, username: env.adminUsername };
  }

  return { created: false, skipped: false, username: existing.username };
}

async function verifyAdminCredentials(username, password) {
  const admin = await get(
    'SELECT id, username, password_hash FROM admin_users WHERE lower(username) = lower(?)',
    [username]
  );

  if (!admin) return null;

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) return null;

  return { id: admin.id, username: admin.username };
}

async function updateAdminPassword(adminId, currentPassword, nextPassword) {
  if (!currentPassword || !nextPassword) {
    throw new AppError('Senha atual e nova senha são obrigatórias.', 400);
  }

  if (nextPassword.length < 8) {
    throw new AppError('A nova senha deve ter pelo menos 8 caracteres.', 400);
  }

  const admin = await get('SELECT id, password_hash FROM admin_users WHERE id = ?', [adminId]);
  if (!admin) {
    throw new AppError('Administrador não encontrado.', 404);
  }

  const valid = await bcrypt.compare(currentPassword, admin.password_hash);
  if (!valid) {
    throw new AppError('Senha atual inválida.', 401);
  }

  const passwordHash = await bcrypt.hash(nextPassword, SALT_ROUNDS);
  await run('UPDATE admin_users SET password_hash = ? WHERE id = ?', [passwordHash, adminId]);

  return { updated: true };
}

module.exports = {
  ensureDefaultAdmin,
  verifyAdminCredentials,
  updateAdminPassword
};
