const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const gamesController = require('../controllers/games.controller');
const requireAdmin = require('../middleware/requireAdmin');
const { validatePositiveIntegerParam } = require('../middleware/validateRequest');

const router = express.Router();

router.get('/', asyncHandler(gamesController.listGames));
router.get('/id/:id', validatePositiveIntegerParam('id'), asyncHandler(gamesController.getGameById));
router.get('/slug/:slug', asyncHandler(gamesController.getGameBySlug));
router.get('/name/:name', asyncHandler(gamesController.getGameByName));
router.get('/admin/summary', requireAdmin, asyncHandler(gamesController.getAdminSummary));
router.post('/', requireAdmin, asyncHandler(gamesController.createGame));
router.put('/:id', requireAdmin, validatePositiveIntegerParam('id'), asyncHandler(gamesController.updateGame));
router.post('/:id/duplicate', requireAdmin, validatePositiveIntegerParam('id'), asyncHandler(gamesController.duplicateGame));
router.delete('/:id', requireAdmin, validatePositiveIntegerParam('id'), asyncHandler(gamesController.deleteGame));

module.exports = router;
