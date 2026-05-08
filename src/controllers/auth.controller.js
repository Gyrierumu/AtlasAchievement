const adminService = require('../services/admin.service');
const userService = require('../services/user.service');
const AppError = require('../utils/AppError');
const { clearLoginRateLimit } = require('../middleware/loginRateLimit');
const { ensureCsrfToken } = require('../middleware/csrfProtection');
const env = require('../config/env');

function getSessionStatus(req, res) {
  res.json({
    authenticated: Boolean(req.session?.admin),
    username: req.session?.admin?.username || null,
    csrfToken: ensureCsrfToken(req)
  });
}

async function getCurrentUser(req) {
  const userId = Number(req.session?.userId || 0);
  if (!userId) return null;
  return userService.getUserById(userId);
}

function getUserScope(req) {
  return String(req.get('x-atlas-auth-scope') || req.body?.scope || '').toLowerCase() === 'user';
}

function isUserLoginRequest(req) {
  return getUserScope(req)
    || typeof req.body?.identifier === 'string'
    || typeof req.body?.email === 'string';
}

function attachUserSession(req, user, next, callback) {
  const adminSession = req.session?.admin || null;
  const csrfToken = req.session?.csrfToken || null;

  req.session.regenerate(error => {
    if (error) return next(error);

    if (adminSession) req.session.admin = adminSession;
    if (csrfToken) req.session.csrfToken = csrfToken;
    req.session.userId = user.id;
    req.session.user = { id: user.id, username: user.username };
    clearLoginRateLimit(req);

    return callback(ensureCsrfToken(req));
  });
}

function clearUserSession(req, res, next) {
  if (!req.session) {
    res.json({ message: 'Sessão encerrada.', authenticated: false, user: null });
    return;
  }

  delete req.session.userId;
  delete req.session.user;

  req.session.save(error => {
    if (error) return next(error);
    return res.json({
      message: 'Logout realizado com sucesso.',
      authenticated: false,
      user: null,
      csrfToken: ensureCsrfToken(req)
    });
  });
}

async function getMe(req, res) {
  const user = await getCurrentUser(req);
  if (!user && req.session?.userId) {
    delete req.session.userId;
    delete req.session.user;
  }

  res.json({
    authenticated: Boolean(user),
    user,
    csrfToken: ensureCsrfToken(req)
  });
}

async function register(req, res, next) {
  if (req.session?.userId) {
    const user = await getCurrentUser(req);
    if (user) {
      res.status(409).json({
        message: 'Você já está logado.',
        authenticated: true,
        user,
        csrfToken: ensureCsrfToken(req)
      });
      return;
    }
  }

  const user = await userService.registerUser(req.body || {});
  attachUserSession(req, user, next, csrfToken => {
    res.status(201).json({
      message: 'Conta criada com sucesso.',
      authenticated: true,
      user,
      csrfToken
    });
  });
}

async function loginUser(req, res, next) {
  const user = await userService.verifyUserCredentials(req.body || {});
  attachUserSession(req, user, next, csrfToken => {
    res.json({
      message: 'Login realizado com sucesso.',
      authenticated: true,
      user,
      csrfToken
    });
  });
}

async function loginAdmin(req, res, next) {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password) {
    throw new AppError('Usuário e senha são obrigatórios.', 400);
  }

  const admin = await adminService.verifyAdminCredentials(username, password);
  if (!admin) {
    throw new AppError('Credenciais inválidas.', 401);
  }

  req.session.regenerate(error => {
    if (error) return next(error);

    req.session.admin = { id: admin.id, username: admin.username };
    clearLoginRateLimit(req);

    const csrfToken = ensureCsrfToken(req);

    res.json({
      message: 'Login realizado com sucesso.',
      authenticated: true,
      username: admin.username,
      csrfToken
    });
  });
}

async function login(req, res, next) {
  if (isUserLoginRequest(req)) {
    await loginUser(req, res, next);
    return;
  }
  await loginAdmin(req, res, next);
}

function logoutUser(req, res, next) {
  clearUserSession(req, res, next);
}

function logoutAdmin(req, res, next) {
  if (!req.session) {
    res.json({ message: 'Sessão encerrada.', authenticated: false });
    return;
  }

  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('mtg.sid', { httpOnly: true, sameSite: 'lax', secure: env.isProduction });
    res.json({ message: 'Logout realizado com sucesso.', authenticated: false });
  });
}

function logout(req, res, next) {
  if (getUserScope(req) || (req.session?.userId && !req.session?.admin)) {
    logoutUser(req, res, next);
    return;
  }

  logoutAdmin(req, res, next);
}

async function updateProfile(req, res) {
  const userId = Number(req.session?.userId || 0);
  if (!userId) {
    throw new AppError('Acesso restrito ao usuário autenticado.', 401, null, 'USER_AUTH_REQUIRED');
  }

  const user = await userService.updateProfile(userId, req.body || {});
  req.session.user = { id: user.id, username: user.username };
  res.json({ message: 'Perfil atualizado com sucesso.', authenticated: true, user });
}

async function changeUserPassword(req, res) {
  const userId = Number(req.session?.userId || 0);
  if (!userId) {
    throw new AppError('Acesso restrito ao usuário autenticado.', 401, null, 'USER_AUTH_REQUIRED');
  }

  await userService.changePassword(userId, req.body || {});
  res.json({ message: 'Senha atualizada com sucesso.' });
}

async function changeAdminPassword(req, res) {
  const adminId = req.session?.admin?.id;
  if (!adminId) {
    throw new AppError('Acesso restrito ao administrador.', 401);
  }

  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const nextPassword = typeof req.body?.nextPassword === 'string' ? req.body.nextPassword : '';

  await adminService.updateAdminPassword(adminId, currentPassword, nextPassword);

  res.json({ message: 'Senha atualizada com sucesso.' });
}

async function changePassword(req, res) {
  if (getUserScope(req) || (req.session?.userId && !req.session?.admin)) {
    await changeUserPassword(req, res);
    return;
  }

  await changeAdminPassword(req, res);
}

module.exports = {
  getSessionStatus,
  getMe,
  register,
  login,
  loginUser,
  loginAdmin,
  logout,
  logoutUser,
  logoutAdmin,
  updateProfile,
  changePassword,
  changeUserPassword,
  changeAdminPassword
};
