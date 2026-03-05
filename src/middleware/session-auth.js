const session = require('express-session');
const crypto = require('crypto');
const logger = require('../logger');

// Paths that are always accessible without authentication
const PUBLIC_PATHS = new Set(['/login', '/auth/login', '/auth/logout']);
const PUBLIC_PREFIXES = ['/css/', '/js/', '/favicon'];

function isPublic(reqPath) {
  if (PUBLIC_PATHS.has(reqPath)) return true;
  return PUBLIC_PREFIXES.some(p => reqPath.startsWith(p));
}

/**
 * Returns an express-session middleware instance.
 * Uses SESSION_SECRET env var if set; otherwise generates a random secret
 * (sessions are invalidated on restart when no secret is configured).
 */
function createSessionMiddleware() {
  const secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  if (!process.env.SESSION_SECRET) {
    logger.warn('SESSION_SECRET not set — sessions will be invalidated on server restart.');
  }
  return session({
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 } // 24 h
  });
}

/**
 * Returns an auth-guard middleware when credentials are configured, or null
 * when they are not (auth is disabled and everything is open).
 *
 * The guard:
 *  - Lets through all public paths (login page, auth routes, static assets).
 *  - Lets through requests with a valid session.
 *  - Returns 401 JSON for API / JSON clients.
 *  - Redirects browser clients to /login.
 *
 * @returns {Function|null}
 */
function createAuthGuard() {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    logger.warn(
      'No credentials configured (BASIC_AUTH_USERNAME / BASIC_AUTH_PASSWORD). ' +
      'Running without authentication — set both variables to enable the login page.'
    );
    return null;
  }

  logger.info('Authentication enabled (session-based login)');

  return function authGuard(req, res, next) {
    if (isPublic(req.path)) return next();
    if (req.session && req.session.authenticated) return next();

    // API / JSON clients get a 401; browsers get redirected to /login
    if (req.path.startsWith('/api/') || (req.headers.accept || '').includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const suffix = req.path !== '/' ? `?next=${encodeURIComponent(req.path)}` : '';
    res.redirect(`/login${suffix}`);
  };
}

/** POST /auth/login handler */
/** POST /auth/login handler */
function loginHandler(req, res) {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (req.body.username === username && req.body.password === password) {
    req.session.authenticated = true;
    req.session.save((err) => {
      if (err) { logger.error('Session save error on login:', err); return res.redirect('/login?error=1'); }
      const redirect = req.body.next || '/';
      // Prevent open redirect: only allow same-origin relative paths
      const safe = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
      res.redirect(safe);
    });
    return;
  }

  res.redirect('/login?error=1');
}

/** POST /auth/logout handler */
function logoutHandler(req, res) {
  req.session.destroy((err) => {
    if (err) logger.error('Session destroy error on logout:', err);
    res.redirect('/login');
  });
}

module.exports = { createSessionMiddleware, createAuthGuard, loginHandler, logoutHandler };
