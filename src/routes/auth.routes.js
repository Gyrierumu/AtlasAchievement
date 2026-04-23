const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authController = require('../controllers/auth.controller');
const requireAdmin = require('../middleware/requireAdmin');
const { requireCsrf } = require('../middleware/csrfProtection');

const router = express.Router();

router.get('/session', asyncHandler(authController.getSessionStatus));
router.post('/login', asyncHandler(authController.login));
router.post('/logout', requireCsrf, asyncHandler(authController.logout));
router.post('/change-password', requireAdmin, requireCsrf, asyncHandler(authController.changePassword));

module.exports = router;
