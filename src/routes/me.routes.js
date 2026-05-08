const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const requireUser = require('../middleware/requireUser');
const meController = require('../controllers/me.controller');

const router = express.Router();

router.use(requireUser);

router.get('/export', asyncHandler(meController.exportAccountData));
router.delete('/progress', asyncHandler(meController.clearAccountProgress));
router.delete('/account', asyncHandler(meController.deleteAccount));
router.get('/library', asyncHandler(meController.getLibrary));
router.post('/library', asyncHandler(meController.addLibraryGame));
router.patch('/library/:gameId', asyncHandler(meController.updateLibraryGame));
router.delete('/library/:gameId', asyncHandler(meController.removeLibraryGame));
router.get('/progress/:gameId', asyncHandler(meController.getProgress));
router.patch('/progress/:gameId/:trophyCode', asyncHandler(meController.updateProgress));
router.post('/progress/:gameId/bulk', asyncHandler(meController.bulkProgress));

module.exports = router;
