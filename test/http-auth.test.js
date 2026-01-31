const { describe, it, before, after } = require('node:test');
const assert = require('assert');
const { execSync, spawn } = require('child_process');

/**
 * HTTP Basic Auth Security Tests
 * 
 * Tests that ALL API endpoints are properly protected by HTTP basic authentication
 * when BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD are set.
 * 
 * Strategy:
 * 1. Start Docker container with auth environment variables
 * 2. Test every endpoint without credentials (expect 401)
 * 3. Test every endpoint with valid credentials (expect success)
 * 4. Verify no content leakage in 401 responses
 * 
 * This test suite runs locally only (skipped in CI due to Docker overhead).
 */

const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

describe('HTTP Basic Auth Security', { skip: isCI }, () => {
  const TEST_USERNAME = 'testuser';
  const TEST_PASSWORD = 'testpass123';
  const BASE_URL = 'http://localhost:18190'; // Different port to avoid conflicts
  
  let containerProcess;
  
  before(async () => {
    console.log('Starting Docker container with basic auth enabled...');
    
    // Stop any existing container on this port
    try {
      execSync('docker stop yt-dlp-ui-auth-test 2>nul', { stdio: 'ignore' });
      execSync('docker rm yt-dlp-ui-auth-test 2>nul', { stdio: 'ignore' });
    } catch (e) {
      // Ignore errors if container doesn't exist
    }
    
    // Build the image first
    console.log('Building Docker image...');
    execSync('docker-compose build', { 
      cwd: require('path').join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    // Start container with auth credentials
    const dockerCmd = `docker run -d --name yt-dlp-ui-auth-test ` +
      `-p 18190:8189 ` +
      `-e BASIC_AUTH_USERNAME=${TEST_USERNAME} ` +
      `-e BASIC_AUTH_PASSWORD=${TEST_PASSWORD} ` +
      `-e NODE_ENV=test ` +
      `yt-dlp-ui-yt-dlp-ui`;
    
    console.log('Starting container with auth...');
    execSync(dockerCmd, { stdio: 'inherit' });
    
    // Wait for container to be ready
    console.log('Waiting for container to be ready...');
    await waitForServer(BASE_URL, 30000);
    console.log('Container ready!');
  });
  
  after(() => {
    console.log('Cleaning up test container...');
    try {
      execSync('docker stop yt-dlp-ui-auth-test', { stdio: 'ignore' });
      execSync('docker rm yt-dlp-ui-auth-test', { stdio: 'ignore' });
    } catch (e) {
      // Ignore cleanup errors
    }
  });
  
  // Helper to wait for server to be ready
  async function waitForServer(url, timeout = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url);
        if (response.status === 401 || response.status === 200) {
          return; // Server is ready (auth challenge or success)
        }
      } catch (e) {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Server failed to start within timeout');
  }
  
  // Helper to make authenticated request
  async function authFetch(url, options = {}) {
    const auth = Buffer.from(`${TEST_USERNAME}:${TEST_PASSWORD}`).toString('base64');
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Basic ${auth}`
      }
    });
  }
  
  // List of all endpoints to test
  const endpoints = [
    // Static files
    { method: 'GET', path: '/', description: 'Home page' },
    { method: 'GET', path: '/css/styles.css', description: 'CSS file' },
    { method: 'GET', path: '/js/app.js', description: 'JS file' },
    
    // Profiles API
    { method: 'GET', path: '/api/profiles', description: 'Get all profiles' },
    { method: 'POST', path: '/api/profiles', description: 'Create profile', body: { name: 'Test' } },
    
    // Channels API
    { method: 'GET', path: '/api/channels', description: 'Get all channels' },
    { method: 'POST', path: '/api/channels', description: 'Create channel', body: { url: 'https://youtube.com/@test' } },
    
    // Stats API
    { method: 'GET', path: '/api/stats', description: 'Get stats' },
    { method: 'GET', path: '/api/stats/channels', description: 'Get channel stats' },
    { method: 'GET', path: '/api/downloads/recent', description: 'Get recent downloads' },
    
    // Download control API
    { method: 'GET', path: '/api/download/status', description: 'Get download status' },
    { method: 'GET', path: '/api/download/queue', description: 'Get download queue' },
    { method: 'POST', path: '/api/download/start', description: 'Start downloads' },
    { method: 'POST', path: '/api/download/retry-failed', description: 'Retry failed downloads' },
    
    // Scheduler API
    { method: 'GET', path: '/api/scheduler/status', description: 'Get scheduler status' },
    { method: 'POST', path: '/api/scheduler/start', description: 'Start scheduler' },
    { method: 'POST', path: '/api/scheduler/stop', description: 'Stop scheduler' },
    
    // Cookies API
    { method: 'GET', path: '/api/cookies', description: 'Get cookies status' },
    
    // YouTube API
    { method: 'GET', path: '/api/youtube-api/key', description: 'Get API key status' },
    { method: 'GET', path: '/api/youtube-api/quota', description: 'Get API quota' },
  ];
  
  describe('Unauthenticated Access (Security)', () => {
    endpoints.forEach(endpoint => {
      it(`should return 401 for ${endpoint.method} ${endpoint.path} without credentials`, async () => {
        const url = `${BASE_URL}${endpoint.path}`;
        const options = {
          method: endpoint.method,
          headers: endpoint.body ? { 'Content-Type': 'application/json' } : {},
        };
        
        if (endpoint.body) {
          options.body = JSON.stringify(endpoint.body);
        }
        
        const response = await fetch(url, options);
        
        // Must return 401 Unauthorized
        assert.strictEqual(
          response.status, 
          401, 
          `${endpoint.method} ${endpoint.path} should return 401 without credentials`
        );
        
        // Should have WWW-Authenticate header
        const authHeader = response.headers.get('www-authenticate');
        assert.ok(
          authHeader && authHeader.includes('Basic'),
          'Should have WWW-Authenticate: Basic header'
        );
        
        // Should NOT leak content (only auth challenge)
        const text = await response.text();
        assert.ok(
          text.includes('Unauthorized') || text.length < 100,
          'Should not leak application content in 401 response'
        );
      });
    });
  });
  
  describe('Authenticated Access (Functionality)', () => {
    it('should allow access to home page with valid credentials', async () => {
      const response = await authFetch(`${BASE_URL}/`);
      assert.strictEqual(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes('<!DOCTYPE html>'), 'Should return HTML');
    });
    
    it('should allow access to API endpoints with valid credentials', async () => {
      const response = await authFetch(`${BASE_URL}/api/stats`);
      assert.ok(
        response.status === 200 || response.status === 500,
        'Should not return 401 with valid credentials'
      );
    });
    
    it('should reject invalid credentials', async () => {
      const auth = Buffer.from('wronguser:wrongpass').toString('base64');
      const response = await fetch(`${BASE_URL}/api/stats`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });
      assert.strictEqual(response.status, 401, 'Should reject invalid credentials');
    });
  });
  
  describe('Content Security', () => {
    it('should not leak channel data without auth', async () => {
      const response = await fetch(`${BASE_URL}/api/channels`);
      assert.strictEqual(response.status, 401);
      const text = await response.text();
      assert.ok(
        !text.includes('youtube.com') && !text.includes('channel'),
        'Should not leak channel URLs or data'
      );
    });
    
    it('should not leak profile data without auth', async () => {
      const response = await fetch(`${BASE_URL}/api/profiles`);
      assert.strictEqual(response.status, 401);
      const text = await response.text();
      assert.ok(
        !text.includes('template') && !text.includes('format'),
        'Should not leak profile configuration'
      );
    });
    
    it('should not leak statistics without auth', async () => {
      const response = await fetch(`${BASE_URL}/api/stats`);
      assert.strictEqual(response.status, 401);
      const text = await response.text();
      assert.ok(
        !text.includes('totalChannels') && !text.includes('totalDownloads'),
        'Should not leak statistics'
      );
    });
  });
  
  describe('Static Files Protection', () => {
    it('should protect HTML files', async () => {
      const response = await fetch(`${BASE_URL}/`);
      assert.strictEqual(response.status, 401);
    });
    
    it('should protect CSS files', async () => {
      const response = await fetch(`${BASE_URL}/css/styles.css`);
      assert.strictEqual(response.status, 401);
    });
    
    it('should protect JavaScript files', async () => {
      const response = await fetch(`${BASE_URL}/js/app.js`);
      assert.strictEqual(response.status, 401);
    });
    
    it('should allow static files with valid credentials', async () => {
      const response = await authFetch(`${BASE_URL}/css/styles.css`);
      assert.strictEqual(response.status, 200);
      const css = await response.text();
      assert.ok(css.length > 0, 'Should return CSS content');
    });
  });
});
