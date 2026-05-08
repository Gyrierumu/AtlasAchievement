const feedbackService = require('../services/feedback.service');

async function createFeedback(req, res) {
  await feedbackService.createFeedback(req.body || {}, req);
  res.status(201).json({ message: '✅ Feedback enviado! Obrigado por ajudar a melhorar o AtlasAchievement.' });
}

async function listFeedbacks(req, res) {
  const response = await feedbackService.listFeedbacks({
    page: req.query?.page,
    limit: req.query?.limit
  });
  res.json(response);
}

module.exports = {
  createFeedback,
  listFeedbacks
};
