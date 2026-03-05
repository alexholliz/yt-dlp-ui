const { Router } = require('express');
const asyncHandler = require('../middleware/async-handler');
const logger = require('../logger');

/**
 * @param {{ db }} services
 */
module.exports = function configRouter({ db }) {
  const router = Router();

  router.get('/', asyncHandler(async (req, res) => {
    res.json(db.getAllConfig());
  }));

  router.put('/', asyncHandler(async (req, res) => {
    const { log_level, log_max_size_kb, log_max_files } = req.body;

    if (log_level) {
      db.setConfig('log_level', log_level);
      logger.level = log_level;
      logger.info(`Log level changed to: ${log_level}`);
    }
    if (log_max_size_kb) db.setConfig('log_max_size_kb', log_max_size_kb);
    if (log_max_files) db.setConfig('log_max_files', log_max_files);

    res.json({ success: true, message: 'Config updated. Log rotation settings will apply on next restart.' });
  }));

  return router;
};
