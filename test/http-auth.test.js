const { describe, it, before, after } = require('node:test');
const assert = require('assert');
const { execSync } = require('child_process');

/**
 * Session Auth Security Tests
 *
 * Tests that ALL API endpoints are properly protected by session-based authentication
 * when BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD are set.
 *
 * Strategy:
 * 1. Start Docker container with auth environment variables
 * 2. Test every API endpoint without a session (expect 401)
 * 3. Verify /login, /css/, /js/ remain public (needed to render the login page)
 * 4. Log in via POST /auth/login, capture session cookie
 * 5. Verify every API endpoint returns non-401 with the session cookie
 * 6. Verify no application data leaks in 401 response bodies
 *
 * This test suite runs locally only (skipped in CI — Docker integration tests
 * are covered by the shell-based checks in build-and-test.yml).
 */

const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

describe('Session Auth Security', { skip: isCI }, () => {
  const TEST_USERNAME = 'testuser';
  const TEST_PASSWORD = 'testpass123';
  const BASE_URL = 'http://localhost:18190';
  const CONTAINER = 'yt-dlp-ui-auth-test';

  before(async () => {
    try {
      execSync(`docker stop ${CONTAINER} 2>/dev/null`, { stdio: 'ignore' });
      execSync(`docker rm   ${CONTAINER} 2>/dev/null`, { stdio: 'ignore' });
    } catch (_) {}

    execSync('docker-compose build', {
      cwd: require('path').join(__dirname, '..'),
      stdio: 'inherit',
    });

    execSync(
      `docker run -d --name ${CONTAINER} -p 18190:8189 ` +
        `-e BASIC_AUTH_USERNAME=${TEST_USERNAME} ` +
        `-e BASIC_AUTH_PASSWORD=${TEST_PASSWORD} ` +
        `-e SESSION_SECRET=local-test-secret-not-for-production ` +
        `yt-dlp-ui-yt-dlp-ui`,
      { stdio: 'inherit' }
    );

    await waitForServer(BASE_URL, 30_000);
  });

  after(() => {
    try {
      execSync(`docker stop ${CONTAINER}`, { stdio: 'ignore' });
      execSync(`docker rm   ${CONTAINER}`, { stdio: 'ignore' });
    } catch (_) {}
  });

  async function waitForServer(url, timeout = 30_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${url}/login`);
        if (res.status === 200) return;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Server failed to start within timeout');
  }

  /** Log in and return the Set-Cookie header value. */
  async function login() {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
      redirect: 'manual',
    });
    // Expect a redirect (302) after successful login
    assert.ok(
      res.status === 302 || res.status === 200,
      `Login should succeed, got ${res.status}`
    );
    const cookie = res.headers.get('set-cookie');
    assert.ok(cookie && cookie.includes('connect.sid'), 'Login should return a session cookie');
    return cookie.split(';')[0]; // just the name=value portion
  }

  // Endpoints that must be blocked without a session
  const protectedEndpoints = [
    { method: 'GET',    path: '/api/profiles' },
    { method: 'POST',   path: '/api/profiles' },
    { method: 'GET',    path: '/api/channels' },
    { method: 'POST',   path: '/api/channels' },
    { method: 'GET',    path: '/api/downloads/recent' },
    { method: 'GET',    path: '/api/stats' },
    { method: 'GET',    path: '/api/stats/channels' },
    { method: 'GET',    path: '/api/scheduler/status' },
    { method: 'POST',   path: '/api/scheduler/run' },
    { method: 'GET',    path: '/api/cookies' },
    { method: 'POST',   path: '/api/cookies' },
    { method: 'DELETE', path: '/api/cookies' },
    { method: 'POST',   path: '/api/cookies/validate' },
    { method: 'GET',    path: '/api/youtube-api/key' },
    { method: 'PUT',    path: '/api/youtube-api/key' },
    { method: 'DELETE', path: '/api/youtube-api/key' },
    { method: 'GET',    path: '/api/youtube-api/quota' },
    { method: 'POST',   path: '/api/youtube-api/quota/reset' },
    { method: 'GET',    path: '/api/config' },
    { method: 'PUT',    path: '/api/config' },
  ];

  // Paths that must stay public so the login page can render
  const publicPaths = ['/login', '/css/styles.css', '/js/app.js'];

  describe('Unauthenticated access — API endpoints blocked', () => {
    for (const ep of protectedEndpoints) {
      it(`${ep.method} ${ep.path} returns 401 without session`, async () => {
        const res = await fetch(`${BASE_URL}${ep.path}`, { method: ep.method });
        assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);

        // No application data should leak in the body
        const body = await res.text();
        assert.ok(
          !body.includes('youtube.com') &&
          !body.includes('totalChannels') &&
          !body.includes('connect.sid'),
          'Should not leak application data in 401 body'
        );
      });
    }
  });

  describe('Unauthenticated access — login page and assets remain public', () => {
    for (const path of publicPaths) {
      it(`GET ${path} returns 200 without session`, async () => {
        const res = await fetch(`${BASE_URL}${path}`);
        assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      });
    }
  });

  describe('Authenticated access — session grants access', () => {
    let sessionCookie;

    before(async () => {
      sessionCookie = await login();
    });

    for (const ep of protectedEndpoints.filter(e => e.method === 'GET')) {
      it(`GET ${ep.path} returns non-401 with valid session`, async () => {
        const res = await fetch(`${BASE_URL}${ep.path}`, {
          headers: { Cookie: sessionCookie },
        });
        assert.notStrictEqual(res.status, 401, `Should not return 401 with a valid session`);
      });
    }

    it('invalid credentials are rejected', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'wrong', password: 'wrong' }),
        redirect: 'manual',
      });
      // Expect redirect back to /login?error=1, not a 200 or a new session
      assert.ok(res.status === 302 || res.status === 401, `Got ${res.status}`);
      const location = res.headers.get('location') || '';
      if (res.status === 302) {
        assert.ok(location.includes('error'), 'Should redirect to login with error param');
      }
    });

    it('logout destroys session', async () => {
      const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Cookie: sessionCookie },
        redirect: 'manual',
      });
      assert.ok(logoutRes.status === 302 || logoutRes.status === 200);

      // Cookie should no longer grant access
      const afterLogout = await fetch(`${BASE_URL}/api/stats`, {
        headers: { Cookie: sessionCookie },
      });
      assert.strictEqual(afterLogout.status, 401, 'Session should be invalid after logout');
    });
  });
});
