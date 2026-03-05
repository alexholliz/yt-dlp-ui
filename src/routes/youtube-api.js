const { Router } = require('express');
const asyncHandler = require('../middleware/async-handler');
const logger = require('../logger');

/**
 * @param {{ youtubeApi }} services
 */
module.exports = function youtubeApiRouter({ youtubeApi }) {
  const router = Router();

  // Save API key
  router.post('/key', asyncHandler(async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey || apiKey.trim().length === 0) {
      return res.status(400).json({ error: 'API key is required' });
    }
    youtubeApi.saveApiKey(apiKey);
    res.json({ success: true, message: 'API key saved successfully' });
  }));

  // Check whether an API key exists (never returns the actual key)
  router.get('/key', asyncHandler(async (req, res) => {
    const hasKey = youtubeApi.hasValidApiKey();
    res.json({ hasKey, keyLength: hasKey ? youtubeApi.apiKey.length : 0 });
  }));

  // Delete API key
  router.delete('/key', asyncHandler(async (req, res) => {
    youtubeApi.deleteApiKey();
    res.json({ success: true, message: 'API key deleted successfully' });
  }));

  // Test an API key (uses saved key if none provided)
  router.post('/test', asyncHandler(async (req, res) => {
    const { apiKey } = req.body;
    const keyToTest = apiKey || youtubeApi.apiKey;
    if (!keyToTest) {
      return res.status(400).json({ valid: false, error: 'No API key provided or saved' });
    }
    const result = await youtubeApi.testApiKey(keyToTest);
    res.json(result);
  }));

  // Quota status
  router.get('/quota', asyncHandler(async (req, res) => {
    res.json(youtubeApi.getQuotaStatus());
  }));

  return router;
};
