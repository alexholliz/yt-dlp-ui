const { Router } = require('express');
const asyncHandler = require('../middleware/async-handler');

/**
 * @param {{ scheduler }} services
 */
module.exports = function schedulerRouter({ scheduler }) {
  const router = Router();

  router.post('/start', asyncHandler(async (req, res) => {
    const { intervalDays } = req.body;
    scheduler.start(intervalDays || 7);
    res.json({ success: true, message: 'Scheduler started' });
  }));

  router.post('/stop', asyncHandler(async (req, res) => {
    scheduler.stop();
    res.json({ success: true, message: 'Scheduler stopped' });
  }));

  router.get('/status', asyncHandler(async (req, res) => {
    res.json(scheduler.getStatus());
  }));

  router.post('/trigger/:channelId', asyncHandler(async (req, res) => {
    await scheduler.triggerChannel(parseInt(req.params.channelId));
    res.json({ success: true, message: 'Channel download triggered' });
  }));

  return router;
};
