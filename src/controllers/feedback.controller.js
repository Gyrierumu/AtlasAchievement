const feedbackService = require('../services/feedback.service');

async function createFeedback(req, res) {
  await feedbackService.createFeedback(req.body || {}, req);
  res.status(201).json({ message: 'Obrigado! Seu feedback foi enviado.' });
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
