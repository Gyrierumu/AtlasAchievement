const commentsService = require('../services/comments.service');
const AppError = require('../utils/AppError');

function getActor(req) {
  return {
    userId: Number(req.session?.userId || 0),
    isAdmin: Boolean(req.session?.admin)
  };
}

async function listPublicComments(req, res) {
  const response = await commentsService.getPublicComments(req.params.slug, getActor(req));
  res.json(response);
}

async function createComment(req, res) {
  const result = await commentsService.createComment(req.params.slug, req.userId || req.session?.userId, req.body || {}, req);
  res.status(201).json(result);
}

async function deleteComment(req, res) {
  const actor = getActor(req);
  if (!actor.userId && !actor.isAdmin) {
    throw new AppError('Acesso restrito ao usuário autenticado.', 401, null, 'USER_AUTH_REQUIRED');
  }
  const result = await commentsService.softDeleteComment(req.params.id, actor);
  res.json(result);
}

async function listAdminComments(req, res) {
  const response = await commentsService.listAdminComments(req.query || {});
  res.json(response);
}

async function approveComment(req, res) {
  const result = await commentsService.moderateComment(req.params.id, 'approve', req.body || {});
  res.json(result);
}

async function hideComment(req, res) {
  const result = await commentsService.moderateComment(req.params.id, 'hide', req.body || {});
  res.json(result);
}

async function adminDeleteComment(req, res) {
  const result = await commentsService.moderateComment(req.params.id, 'delete', req.body || {});
  res.json(result);
}

module.exports = {
  listPublicComments,
  createComment,
  deleteComment,
  listAdminComments,
  approveComment,
  hideComment,
  adminDeleteComment
};
