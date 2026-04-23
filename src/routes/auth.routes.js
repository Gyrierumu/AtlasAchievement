const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const authController = require('../controllers/auth.controller');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/session', asyncHandler(authController.getSessionStatus));
router.post('/login', asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.post('/change-password', requireAdmin, asyncHandler(authController.changePassword));

module.exports = router;
