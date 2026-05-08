const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authController = require('../controllers/auth.controller');
const { requireCsrf } = require('../middleware/csrfProtection');

const router = express.Router();

router.get('/session', asyncHandler(authController.getSessionStatus));
router.get('/me', asyncHandler(authController.getMe));
router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.post('/logout', requireCsrf, asyncHandler(authController.logout));
router.patch('/profile', requireCsrf, asyncHandler(authController.updateProfile));
router.post('/change-password', requireCsrf, asyncHandler(authController.changePassword));

module.exports = router;
