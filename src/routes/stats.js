const { Router } = require('express');
const asyncHandler = require('../middleware/async-handler');

/**
 * @param {{ db }} services
 */
module.exports = function statsRouter({ db }) {
  const router = Router();

  // Overall statistics
  router.get('/', asyncHandler(async (req, res) => {
    res.json(db.getStats());
  }));

  // Per-channel statistics
  router.get('/channels', asyncHandler(async (req, res) => {
    res.json(db.getChannelStats());
  }));

  return router;
};
