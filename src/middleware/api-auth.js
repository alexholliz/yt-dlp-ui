const basicAuth = require('express-basic-auth');
const logger = require('../logger');

const username = process.env.BASIC_AUTH_USERNAME;
const password = process.env.BASIC_AUTH_PASSWORD;

/**
 * Returns the appropriate auth middleware for the application.
 *
 * Two modes:
 *
 *  1. Credentials configured (BASIC_AUTH_USERNAME + BASIC_AUTH_PASSWORD set):
 *     Standard HTTP Basic Auth applied to ALL routes — UI and API alike.
 *     Accessing anything without credentials returns a 401 + WWW-Authenticate
 *     challenge (browser shows a native login dialog).
 *
 *  2. No credentials configured:
 *     Returns null — the caller must apply a separate /api-only guard via
 *     createApiOnlyGuard() to block API requests while still serving the UI.
 *
 * @returns {Function|null} Express middleware, or null if no credentials set.
 */
function createFullAuthMiddleware() {
  if (username && password) {
    logger.info('Authentication enabled: Basic Auth protecting all routes');
    return basicAuth({
      users: { [username]: password },
      challenge: true,
      realm: 'yt-dlp-ui'
    });
  }
  return null;
}

/**
 * Returns a middleware that blocks ALL requests with 401 and a setup message.
 * Used exclusively on /api/* when no credentials are configured, so the
 * static UI can still load while the API remains locked.
 */
function createApiOnlyGuard() {
  logger.warn(
    'No credentials configured (BASIC_AUTH_USERNAME / BASIC_AUTH_PASSWORD not set). ' +
    'All /api/* requests will return 401 until credentials are configured.'
  );

  return (req, res, _next) => {
    res.set('WWW-Authenticate', 'Basic realm="yt-dlp-ui"');
    res.status(401).json({
      error: 'Authentication required',
      message:
        'No credentials are configured. ' +
        'Set BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD environment variables and restart the server.'
    });
  };
}

module.exports = { createFullAuthMiddleware, createApiOnlyGuard };
