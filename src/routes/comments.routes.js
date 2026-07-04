const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const commentsController = require('../controllers/comments.controller');
const requireUser = require('../middleware/requireUser');
const requireAdmin = require('../middleware/requireAdmin');

const publicRouter = express.Router({ mergeParams: true });
const commentRouter = express.Router();
const adminRouter = express.Router();

publicRouter.get('/', asyncHandler(commentsController.listPublicComments));
publicRouter.post('/', requireUser, asyncHandler(commentsController.createComment));

commentRouter.delete('/:id', asyncHandler(commentsController.deleteComment));

adminRouter.get('/', requireAdmin, asyncHandler(commentsController.listAdminComments));
adminRouter.post('/:id/approve', requireAdmin, asyncHandler(commentsController.approveComment));
adminRouter.post('/:id/hide', requireAdmin, asyncHandler(commentsController.hideComment));
adminRouter.post('/:id/delete', requireAdmin, asyncHandler(commentsController.adminDeleteComment));

module.exports = {
  publicRouter,
  commentRouter,
  adminRouter
};
