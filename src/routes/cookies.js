const { Router } = require('express');
const fs = require('fs');
const asyncHandler = require('../middleware/async-handler');
const { validateCookieFormat } = require('../utils/cookie-validator');
const logger = require('../logger');

/**
 * @param {{ ytdlp, COOKIES_PATH: string }} services
 */
module.exports = function cookiesRouter({ ytdlp, COOKIES_PATH }) {
  const router = Router();

  // Get cookie file content
  router.get('/', asyncHandler(async (req, res) => {
    if (fs.existsSync(COOKIES_PATH)) {
      const content = fs.readFileSync(COOKIES_PATH, 'utf8');
      return res.json({ exists: true, content });
    }
    res.json({ exists: false, content: '' });
  }));

  // Save / update cookie file
  router.post('/', asyncHandler(async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const validation = validateCookieFormat(content);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid cookie format', details: validation.errors });
    }

    fs.writeFileSync(COOKIES_PATH, content, { encoding: 'utf8', mode: 0o600 });
    res.json({ success: true, message: 'Cookies saved successfully', warnings: validation.warnings });
  }));

  // Test cookies against YouTube
  router.post('/test', asyncHandler(async (req, res) => {
    if (!fs.existsSync(COOKIES_PATH)) {
      return res.status(400).json({ valid: false, error: 'No cookies file found. Please save cookies first.' });
    }
    const result = await ytdlp.testCookies('https://www.youtube.com/watch?v=X30kr6v6ibM');
    res.json(result);
  }));

  // Delete cookie file
  router.delete('/', asyncHandler(async (req, res) => {
    if (fs.existsSync(COOKIES_PATH)) fs.unlinkSync(COOKIES_PATH);
    res.json({ success: true, message: 'Cookies deleted' });
  }));

  return router;
};
