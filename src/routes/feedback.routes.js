const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const feedbackController = require('../controllers/feedback.controller');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  const host = req.get('host');
  if (!origin || !host) return next();
  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      return res.status(403).json({ message: 'Origem inválida para esta operação.' });
    }
  } catch (_error) {
    return res.status(403).json({ message: 'Origem inválida para esta operação.' });
  }
  return next();
}

router.post('/', requireSameOrigin, asyncHandler(feedbackController.createFeedback));
router.get('/admin', requireAdmin, asyncHandler(feedbackController.listFeedbacks));

module.exports = router;
