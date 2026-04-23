const adminService = require('../services/admin.service');
const AppError = require('../utils/AppError');
const { clearLoginRateLimit } = require('../middleware/loginRateLimit');
const { ensureCsrfToken } = require('../middleware/csrfProtection');

function getSessionStatus(req, res) {
  res.json({
    authenticated: Boolean(req.session?.admin),
    username: req.session?.admin?.username || null,
    csrfToken: ensureCsrfToken(req)
  });
}

async function login(req, res, next) {
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

function logout(req, res, next) {
  if (!req.session) {
    res.json({ message: 'Sessão encerrada.', authenticated: false });
    return;
  }

  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('mtg.sid', { httpOnly: true, sameSite: 'lax', secure: req.secure });
    res.json({ message: 'Logout realizado com sucesso.', authenticated: false });
  });
}

async function changePassword(req, res) {
  const adminId = req.session?.admin?.id;
  if (!adminId) {
    throw new AppError('Acesso restrito ao administrador.', 401);
  }

  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const nextPassword = typeof req.body?.nextPassword === 'string' ? req.body.nextPassword : '';

  await adminService.updateAdminPassword(adminId, currentPassword, nextPassword);

  res.json({ message: 'Senha atualizada com sucesso.' });
}

module.exports = {
  getSessionStatus,
  login,
  logout,
  changePassword
};
