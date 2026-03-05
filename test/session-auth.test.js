const { describe, it, before, after } = require('node:test');
const assert = require('assert');

/**
 * Unit tests for src/middleware/session-auth.js
 *
 * Tests createAuthGuard(), loginHandler(), and logoutHandler()
 * using lightweight mock req/res objects (no HTTP server needed).
 */

const MODULE_PATH = require('path').resolve(__dirname, '../src/middleware/session-auth');

function freshLoad() {
  delete require.cache[MODULE_PATH];
  return require(MODULE_PATH);
}

function setCredentials(username, password) {
  if (username) process.env.BASIC_AUTH_USERNAME = username;
  else delete process.env.BASIC_AUTH_USERNAME;
  if (password) process.env.BASIC_AUTH_PASSWORD = password;
  else delete process.env.BASIC_AUTH_PASSWORD;
}

describe('Session Auth middleware', () => {
  const ORIG_USER = process.env.BASIC_AUTH_USERNAME;
  const ORIG_PASS = process.env.BASIC_AUTH_PASSWORD;

  after(() => {
    if (ORIG_USER !== undefined) process.env.BASIC_AUTH_USERNAME = ORIG_USER;
    else delete process.env.BASIC_AUTH_USERNAME;
    if (ORIG_PASS !== undefined) process.env.BASIC_AUTH_PASSWORD = ORIG_PASS;
    else delete process.env.BASIC_AUTH_PASSWORD;
    delete require.cache[MODULE_PATH];
  });

  // ---------------------------------------------------------------------------
  describe('createAuthGuard()', () => {
    it('returns null when neither credential is configured', () => {
      setCredentials(null, null);
      assert.strictEqual(freshLoad().createAuthGuard(), null);
    });

    it('returns null when only username is configured', () => {
      setCredentials('user', null);
      assert.strictEqual(freshLoad().createAuthGuard(), null);
    });

    it('returns null when only password is configured', () => {
      setCredentials(null, 'pass');
      assert.strictEqual(freshLoad().createAuthGuard(), null);
    });

    it('returns a function when both credentials are configured', () => {
      setCredentials('user', 'pass');
      assert.strictEqual(typeof freshLoad().createAuthGuard(), 'function');
    });

    describe('guard middleware behaviour', () => {
      let guard;
      before(() => {
        setCredentials('guarduser', 'guardpass');
        guard = freshLoad().createAuthGuard();
      });

      function makeReq(reqPath, sessionObj = {}, accept = 'text/html') {
        return { path: reqPath, session: sessionObj, headers: { accept } };
      }

      function makeRes() {
        const res = { _redirect: null, _status: null };
        res.redirect = (url) => { res._redirect = url; };
        res.status = (code) => { res._status = code; return { json: () => {} }; };
        return res;
      }

      // Public paths must always pass through without session
      for (const publicPath of ['/login', '/auth/login', '/auth/logout', '/css/main.css', '/js/app.js', '/favicon.ico']) {
        it(`passes ${publicPath} without session`, () => {
          let nextCalled = false;
          guard(makeReq(publicPath), makeRes(), () => { nextCalled = true; });
          assert.ok(nextCalled, `${publicPath} should call next()`);
        });
      }

      it('passes requests that have an authenticated session', () => {
        let nextCalled = false;
        guard(makeReq('/api/channels', { authenticated: true }), makeRes(), () => { nextCalled = true; });
        assert.ok(nextCalled);
      });

      it('returns 401 JSON for /api/ paths without session', () => {
        const res = makeRes();
        guard(makeReq('/api/channels', {}, 'application/json'), res, () => { assert.fail('next should not be called'); });
        assert.strictEqual(res._status, 401);
      });

      it('returns 401 for /api/ even with HTML accept header', () => {
        const res = makeRes();
        guard(makeReq('/api/channels', {}), res, () => { assert.fail('next should not be called'); });
        assert.strictEqual(res._status, 401);
      });

      it('redirects browser requests (non-API) to /login', () => {
        const res = makeRes();
        guard(makeReq('/', {}), res, () => {});
        assert.strictEqual(res._redirect, '/login');
      });

      it('includes ?next= param when redirecting non-root paths', () => {
        const res = makeRes();
        guard(makeReq('/settings', {}), res, () => {});
        assert.ok(res._redirect && res._redirect.includes('next='), `redirect was: ${res._redirect}`);
      });

      it('does NOT add ?next= for the root path', () => {
        const res = makeRes();
        guard(makeReq('/', {}), res, () => {});
        assert.strictEqual(res._redirect, '/login');
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe('loginHandler()', () => {
    before(() => { setCredentials('loginuser', 'loginpass'); });

    it('sets session.authenticated = true and redirects to / on valid credentials', (_, done) => {
      const { loginHandler } = freshLoad();
      const session = { authenticated: false, save(cb) { cb(null); } };
      const req = { body: { username: 'loginuser', password: 'loginpass' }, session };
      const res = {
        redirect(url) {
          assert.strictEqual(session.authenticated, true);
          assert.strictEqual(url, '/');
          done();
        }
      };
      loginHandler(req, res);
    });

    it('honours the next param from the form body', (_, done) => {
      const { loginHandler } = freshLoad();
      const session = { save(cb) { cb(null); } };
      const req = { body: { username: 'loginuser', password: 'loginpass', next: '/settings' }, session };
      const res = {
        redirect(url) {
          assert.strictEqual(url, '/settings');
          done();
        }
      };
      loginHandler(req, res);
    });

    it('redirects to /login?error=1 on wrong password', () => {
      const { loginHandler } = freshLoad();
      let redirectTarget;
      const req = { body: { username: 'loginuser', password: 'WRONG' }, session: {} };
      const res = { redirect(url) { redirectTarget = url; } };
      loginHandler(req, res);
      assert.strictEqual(redirectTarget, '/login?error=1');
    });

    it('redirects to /login?error=1 on wrong username', () => {
      const { loginHandler } = freshLoad();
      let redirectTarget;
      const req = { body: { username: 'WRONG', password: 'loginpass' }, session: {} };
      const res = { redirect(url) { redirectTarget = url; } };
      loginHandler(req, res);
      assert.strictEqual(redirectTarget, '/login?error=1');
    });

    it('redirects to /login?error=1 when session.save fails', (_, done) => {
      const { loginHandler } = freshLoad();
      const session = { save(cb) { cb(new Error('Store error')); } };
      const req = { body: { username: 'loginuser', password: 'loginpass' }, session };
      const res = {
        redirect(url) {
          assert.strictEqual(url, '/login?error=1');
          done();
        }
      };
      loginHandler(req, res);
    });

    it('prevents open redirect: ignores external next values', (_, done) => {
      const { loginHandler } = freshLoad();
      const session = { save(cb) { cb(null); } };
      const req = { body: { username: 'loginuser', password: 'loginpass', next: '//evil.com' }, session };
      const res = {
        redirect(url) {
          assert.strictEqual(url, '/', `Open redirect not prevented: ${url}`);
          done();
        }
      };
      loginHandler(req, res);
    });

    it('prevents open redirect: protocol-relative variations', (_, done) => {
      const { loginHandler } = freshLoad();
      const session = { save(cb) { cb(null); } };
      const req = { body: { username: 'loginuser', password: 'loginpass', next: 'https://evil.com' }, session };
      const res = {
        redirect(url) {
          assert.strictEqual(url, '/');
          done();
        }
      };
      loginHandler(req, res);
    });
  });

  // ---------------------------------------------------------------------------
  describe('logoutHandler()', () => {
    it('destroys session and redirects to /login', (_, done) => {
      const { logoutHandler } = freshLoad();
      const req = { session: { destroy(cb) { cb(null); } } };
      const res = {
        redirect(url) {
          assert.strictEqual(url, '/login');
          done();
        }
      };
      logoutHandler(req, res);
    });

    it('still redirects to /login even if session.destroy fails', (_, done) => {
      const { logoutHandler } = freshLoad();
      const req = { session: { destroy(cb) { cb(new Error('Store error')); } } };
      const res = {
        redirect(url) {
          assert.strictEqual(url, '/login');
          done();
        }
      };
      logoutHandler(req, res);
    });
  });
});
