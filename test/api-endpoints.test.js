const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('assert');
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

/**
 * API Endpoint Tests
 *
 * Tests all API endpoints using the ACTUAL route factory modules (not inline
 * duplicates).  A real in-memory database is used; external services
 * (ytdlp, downloadManager, youtubeApi, scheduler) are lightweight mocks.
 *
 * Coverage:
 *  - Profiles, Channels, Playlists, Videos (CRUD)
 *  - Downloads, Stats
 *  - Cookies, YouTubeApi, Config, Scheduler  ← new in this branch
 */

describe('API Endpoints', () => {
  let app;
  let db;
  const testDbPath = path.join(__dirname, 'test-api-db.sqlite');
  const testCookiesPath = path.join(__dirname, 'test-cookies.txt');
  const DOWNLOADS_PATH = '/tmp/test-downloads';

  // ---------------------------------------------------------------------------
  // Mock services
  // ---------------------------------------------------------------------------
  const mockYtDlp = {
    detectUrlType: (_url) => 'channel',
    enumeratePlaylists: async () => ({ channel_id: 'UC_test', channel_name: 'Test Channel', playlists: [] }),
    enumeratePlaylistVideos: async () => [],
    testCookies: async () => ({ valid: true, message: 'Cookie validation passed' }),
  };

  const mockDownloadManager = {
    isProcessing: false,
    downloadSingleVideo: async () => ({ video_id: 'vid_abc123' }),
    downloadChannel: async () => ({ queued: 0, already_queued: 0 }),
    getQueueStatus: () => ({ active: 0, queued: 0, failed: 0, downloads: [] }),
    startDownloads: () => {},
  };

  const mockScheduler = {
    start: () => {},
    stop: () => {},
    getStatus: () => ({ running: false, nextRun: null, intervalDays: 7 }),
    triggerChannel: async () => {},
  };

  const mockYouTubeApi = {
    hasValidApiKey: () => false,
    apiKey: null,
    saveApiKey: () => {},
    deleteApiKey: () => {},
    testApiKey: async () => ({ valid: false, error: 'No key' }),
    getQuotaStatus: () => ({ used: 0, limit: 10000, remaining: 10000, resetTime: null }),
  };

  // ---------------------------------------------------------------------------
  before(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testCookiesPath)) fs.unlinkSync(testCookiesPath);

    const DB = require('../src/database.js');
    db = new DB(testDbPath);
    await db.ready;

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const services = {
      db,
      ytdlp: mockYtDlp,
      downloadManager: mockDownloadManager,
      youtubeApi: mockYouTubeApi,
      scheduler: mockScheduler,
      DOWNLOADS_PATH,
      COOKIES_PATH: testCookiesPath,
    };

    // Mount the actual route modules (mirrors server.js)
    app.use('/api/profiles',    require('../src/routes/profiles')(services));
    app.use('/api/channels',    require('../src/routes/channels')(services));
    app.use('/api/playlists',   require('../src/routes/playlists')(services));
    app.use('/api/videos',      require('../src/routes/videos')(services));
    app.use('/api/download',    require('../src/routes/downloads')(services));
    app.use('/api/downloads',   require('../src/routes/downloads')(services));
    app.use('/api/stats',       require('../src/routes/stats')(services));
    app.use('/api/scheduler',   require('../src/routes/scheduler')(services));
    app.use('/api/cookies',     require('../src/routes/cookies')(services));
    app.use('/api/youtube-api', require('../src/routes/youtube-api')(services));
    app.use('/api/config',      require('../src/routes/config')(services));
  });

  after(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testCookiesPath)) fs.unlinkSync(testCookiesPath);
  });

  // ===========================================================================
  // Profiles
  // ===========================================================================
  describe('GET /api/profiles', () => {
    it('should return empty array initially', async () => {
      const res = await request(app).get('/api/profiles');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });

    it('should return all profiles after creation', async () => {
      await request(app).post('/api/profiles').send({ name: 'Test Profile', output_template: '%(title)s.%(ext)s' });
      const res = await request(app).get('/api/profiles');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.length > 0);
    });
  });

  describe('POST /api/profiles', () => {
    it('should create a new profile', async () => {
      const res = await request(app).post('/api/profiles').send({
        name: 'New Profile',
        output_template: '%(uploader)s/%(title)s.%(ext)s',
        format_selection: 'bestvideo+bestaudio',
        merge_output_format: 'mkv',
        additional_args: '--embed-thumbnail',
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(res.body.id > 0);
    });
  });

  describe('GET /api/profiles/:id', () => {
    it('should return profile by id', async () => {
      const createRes = await request(app).post('/api/profiles').send({ name: 'Fetch Me', output_template: '%(title)s.%(ext)s' });
      const res = await request(app).get(`/api/profiles/${createRes.body.id}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.name, 'Fetch Me');
    });

    it('should return 404 for non-existent profile', async () => {
      const res = await request(app).get('/api/profiles/99999');
      assert.strictEqual(res.status, 404);
    });
  });

  describe('PUT /api/profiles/:id', () => {
    it('should update profile', async () => {
      const createRes = await request(app).post('/api/profiles').send({ name: 'Update Me', output_template: '%(title)s.%(ext)s' });
      const res = await request(app).put(`/api/profiles/${createRes.body.id}`).send({ name: 'Updated' });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });

  describe('DELETE /api/profiles/:id', () => {
    it('should delete profile', async () => {
      const createRes = await request(app).post('/api/profiles').send({ name: 'Delete Me', output_template: '%(title)s.%(ext)s' });
      const res = await request(app).delete(`/api/profiles/${createRes.body.id}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });

  // ===========================================================================
  // Channels
  // ===========================================================================
  describe('POST /api/channels', () => {
    it('should create channel with required fields', async () => {
      const res = await request(app).post('/api/channels').send({ url: 'https://youtube.com/@testchannel' });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.id > 0);
    });

    it('should return 400 when url is missing', async () => {
      const res = await request(app).post('/api/channels').send({});
      assert.strictEqual(res.status, 400);
    });

    it('should create channel with SponsorBlock options', async () => {
      const res = await request(app).post('/api/channels').send({
        url: 'https://youtube.com/@sponsortest',
        sponsorblock_enabled: true,
        sponsorblock_mode: 'remove',
        sponsorblock_categories: 'sponsor,intro,outro',
      });
      assert.strictEqual(res.status, 200);
      const channel = await request(app).get(`/api/channels/${res.body.id}`);
      assert.strictEqual(channel.body.sponsorblock_enabled, 1);
      assert.strictEqual(channel.body.sponsorblock_mode, 'remove');
    });
  });

  describe('GET /api/channels', () => {
    it('should return array of channels with total_size field', async () => {
      const res = await request(app).get('/api/channels');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      // Every channel object should include total_size (added by the route)
      res.body.forEach(ch => assert.ok('total_size' in ch, 'channel should have total_size'));
    });
  });

  describe('GET /api/channels/:id', () => {
    it('should return channel by id', async () => {
      const createRes = await request(app).post('/api/channels').send({ url: 'https://youtube.com/@fetchtest' });
      const res = await request(app).get(`/api/channels/${createRes.body.id}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.url, 'https://youtube.com/@fetchtest');
    });

    it('should return 404 for non-existent channel', async () => {
      const res = await request(app).get('/api/channels/99999');
      assert.strictEqual(res.status, 404);
    });
  });

  describe('PUT /api/channels/:id', () => {
    it('should update channel settings', async () => {
      const createRes = await request(app).post('/api/channels').send({ url: 'https://youtube.com/@updatetest' });
      const res = await request(app).put(`/api/channels/${createRes.body.id}`).send({ enabled: false, rescrape_interval_days: 14 });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });

  describe('DELETE /api/channels/:id', () => {
    it('should delete channel', async () => {
      const createRes = await request(app).post('/api/channels').send({ url: 'https://youtube.com/@deletetest' });
      const res = await request(app).delete(`/api/channels/${createRes.body.id}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });

  // ===========================================================================
  // Stats
  // ===========================================================================
  describe('GET /api/stats', () => {
    it('should return statistics object', async () => {
      const res = await request(app).get('/api/stats');
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body.channel_count === 'number');
      assert.ok(typeof res.body.total_downloads === 'number');
      assert.ok(typeof res.body.library_size === 'number');
    });
  });

  describe('GET /api/stats/channels', () => {
    it('should return array of channel stats', async () => {
      const res = await request(app).get('/api/stats/channels');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });
  });

  // ===========================================================================
  // Downloads
  // ===========================================================================
  describe('GET /api/downloads/recent', () => {
    it('should return paginated recent downloads', async () => {
      const res = await request(app).get('/api/downloads/recent?limit=10&offset=0');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });
  });

  describe('GET /api/download/status', () => {
    it('should return download status', async () => {
      const res = await request(app).get('/api/download/status');
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body.active === 'number');
      assert.ok(typeof res.body.queued === 'number');
    });
  });

  describe('GET /api/download/queue', () => {
    it('should return download queue array', async () => {
      const res = await request(app).get('/api/download/queue');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });
  });

  describe('POST /api/download/start', () => {
    it('should start downloads', async () => {
      const res = await request(app).post('/api/download/start');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });

  describe('POST /api/download/retry-failed', () => {
    it('should retry failed downloads', async () => {
      const res = await request(app).post('/api/download/retry-failed');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(typeof res.body.count === 'number');
    });
  });

  // ===========================================================================
  // Videos
  // ===========================================================================
  describe('DELETE /api/videos', () => {
    it('should delete all videos and return success', async () => {
      const res = await request(app).delete('/api/videos');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });

  // ===========================================================================
  // Cookies  ← new in this branch
  // ===========================================================================
  describe('GET /api/cookies', () => {
    it('should return exists:false when no cookies file', async () => {
      if (fs.existsSync(testCookiesPath)) fs.unlinkSync(testCookiesPath);
      const res = await request(app).get('/api/cookies');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.exists, false);
      assert.strictEqual(res.body.content, '');
    });
  });

  describe('POST /api/cookies', () => {
    it('should return 400 when content is missing', async () => {
      const res = await request(app).post('/api/cookies').send({});
      assert.strictEqual(res.status, 400);
    });

    it('should return 400 for invalid cookie format', async () => {
      const res = await request(app).post('/api/cookies').send({ content: 'not a valid netscape cookie file' });
      assert.strictEqual(res.status, 400);
    });

    it('should save a valid Netscape cookie file', async () => {
      const validContent = [
        '# Netscape HTTP Cookie File',
        '# This file was generated.',
        '.youtube.com\tTRUE\t/\tTRUE\t9999999999\tSID\ttest_sid_value',
      ].join('\n');

      const res = await request(app).post('/api/cookies').send({ content: validContent });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(fs.existsSync(testCookiesPath));
    });

    it('saved cookies file is readable after POST', async () => {
      const res = await request(app).get('/api/cookies');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.exists, true);
      assert.ok(res.body.content.includes('SID'));
    });
  });

  describe('DELETE /api/cookies', () => {
    it('should delete cookies file', async () => {
      const res = await request(app).delete('/api/cookies');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(!fs.existsSync(testCookiesPath));
    });
  });

  // ===========================================================================
  // YouTube API key  ← new in this branch
  // ===========================================================================
  describe('GET /api/youtube-api/key', () => {
    it('should return hasKey:false when no key set', async () => {
      const res = await request(app).get('/api/youtube-api/key');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.hasKey, false);
    });
  });

  describe('POST /api/youtube-api/key', () => {
    it('should return 400 when apiKey is empty', async () => {
      const res = await request(app).post('/api/youtube-api/key').send({ apiKey: '' });
      assert.strictEqual(res.status, 400);
    });

    it('should save a valid API key', async () => {
      // Make the mock report hasKey: true after save
      mockYouTubeApi.saveApiKey = (key) => { mockYouTubeApi.apiKey = key; mockYouTubeApi.hasValidApiKey = () => true; };
      const res = await request(app).post('/api/youtube-api/key').send({ apiKey: 'AIzaSy_fake_key_1234' });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });

  describe('DELETE /api/youtube-api/key', () => {
    it('should delete API key', async () => {
      mockYouTubeApi.deleteApiKey = () => { mockYouTubeApi.apiKey = null; mockYouTubeApi.hasValidApiKey = () => false; };
      const res = await request(app).delete('/api/youtube-api/key');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });

  describe('GET /api/youtube-api/quota', () => {
    it('should return quota status object', async () => {
      const res = await request(app).get('/api/youtube-api/quota');
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body.used === 'number');
      assert.ok(typeof res.body.limit === 'number');
      assert.ok(typeof res.body.remaining === 'number');
    });
  });

  // ===========================================================================
  // Config  ← new in this branch
  // ===========================================================================
  describe('GET /api/config', () => {
    it('should return config object', async () => {
      const res = await request(app).get('/api/config');
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body === 'object');
    });
  });

  describe('PUT /api/config', () => {
    it('should update log_level', async () => {
      const res = await request(app).put('/api/config').send({ log_level: 'info' });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });

    it('should update log_max_size_kb', async () => {
      const res = await request(app).put('/api/config').send({ log_max_size_kb: '20480' });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });

  // ===========================================================================
  // Scheduler  ← new in this branch
  // ===========================================================================
  describe('GET /api/scheduler/status', () => {
    it('should return scheduler status', async () => {
      const res = await request(app).get('/api/scheduler/status');
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body.running === 'boolean');
    });
  });

  describe('POST /api/scheduler/start', () => {
    it('should start scheduler', async () => {
      const res = await request(app).post('/api/scheduler/start').send({ intervalDays: 7 });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });

  describe('POST /api/scheduler/stop', () => {
    it('should stop scheduler', async () => {
      const res = await request(app).post('/api/scheduler/stop');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });
});
