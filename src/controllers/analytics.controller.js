const analyticsService = require('../services/analytics.service');

async function createEvent(req, res) {
  await analyticsService.createPublicEvent(req.body || {});
  res.status(202).json({ ok: true });
}

async function getBetaMetrics(_req, res) {
  const metrics = await analyticsService.getBetaMetrics();
  res.json(metrics);
}

module.exports = {
  createEvent,
  getBetaMetrics
};
