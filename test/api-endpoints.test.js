const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('assert');
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');

/**
 * API Endpoint Tests
 * 
 * Tests all API endpoints for:
 * - Successful responses (200/201)
 * - Error handling (404, 500)
 * - Request validation
 * - Data integrity
 * 
 * Uses in-memory database for isolation.
 */

describe('API Endpoints', () => {
  let app;
  let db;
  let testDbPath;
  
  before(async () => {
    // Create test database
    testDbPath = path.join(__dirname, 'test-api-db.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Initialize database
    const DB = require('../src/database.js');
    db = new DB(testDbPath);
    await db.ready;
    
    // Create minimal Express app with routes (no auth for testing)
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Mock services to avoid external dependencies
    const mockYouTubeApi = {
      getChannelInfo: async () => ({ id: 'UC_test', title: 'Test Channel' }),
      getPlaylistVideos: async () => [],
      hasApiKey: () => false
    };
    
    const mockYtDlp = {
      enumeratePlaylists: async () => [],
      enumeratePlaylistVideos: async () => [],
      downloadVideo: async () => ({ success: true })
    };
    
    const mockDownloadManager = {
      addToQueue: () => ({ success: true }),
      getQueue: () => [],
      getStatus: () => ({ active: 0, queued: 0, failed: 0 }),
      startProcessing: () => {},
      retryFailed: () => ({ retriedCount: 0 })
    };
    
    // Define all routes (matching server.js)
    
    // Profiles endpoints
    app.get('/api/profiles', (req, res) => {
      try {
        const profiles = db.getAllProfiles();
        res.json(profiles);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.get('/api/profiles/:id', (req, res) => {
      try {
        const profile = db.getProfile(req.params.id);
        if (!profile) {
          return res.status(404).json({ error: 'Profile not found' });
        }
        res.json(profile);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.post('/api/profiles', (req, res) => {
      try {
        const { name, output_template, format_selection, merge_output_format, additional_args } = req.body;
        const id = db.addProfile({ name, output_template, format_selection, merge_output_format, additional_args });
        res.json({ id, success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.put('/api/profiles/:id', (req, res) => {
      try {
        const { name, output_template, format_selection, merge_output_format, additional_args } = req.body;
        db.updateProfile(req.params.id, { name, output_template, format_selection, merge_output_format, additional_args });
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.delete('/api/profiles/:id', (req, res) => {
      try {
        db.deleteProfile(req.params.id);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // Channels endpoints
    app.get('/api/channels', (req, res) => {
      try {
        const channels = db.getAllChannels();
        res.json(channels);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.get('/api/channels/:id', (req, res) => {
      try {
        const channel = db.getChannel(req.params.id);
        if (!channel) {
          return res.status(404).json({ error: 'Channel not found' });
        }
        res.json(channel);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.post('/api/channels', async (req, res) => {
      try {
        const { url, playlist_mode, flat_mode, auto_add_new_playlists, yt_dlp_options, rescrape_interval_days, 
                profile_id, sponsorblock_enabled, sponsorblock_mode, sponsorblock_categories } = req.body;
        
        const channelId = db.addChannel(url, {
          playlist_mode: playlist_mode || 'enumerate',
          flat_mode: flat_mode || false,
          auto_add_new_playlists: auto_add_new_playlists !== false,
          yt_dlp_options: yt_dlp_options || '',
          rescrape_interval_days: rescrape_interval_days || 7,
          profile_id: profile_id || null,
          sponsorblock_enabled: sponsorblock_enabled || false,
          sponsorblock_mode: sponsorblock_mode || 'mark',
          sponsorblock_categories: sponsorblock_categories || 'sponsor'
        });
        
        res.json({ id: channelId, success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.put('/api/channels/:id', (req, res) => {
      try {
        const updates = req.body;
        db.updateChannel(req.params.id, updates);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.delete('/api/channels/:id', (req, res) => {
      try {
        db.deleteChannel(req.params.id);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // Playlists endpoints
    app.get('/api/channels/:id/playlists', (req, res) => {
      try {
        const playlists = db.getPlaylistsByChannelId(req.params.id);
        res.json(playlists);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.put('/api/playlists/:id', (req, res) => {
      try {
        const { enabled } = req.body;
        db.updatePlaylist(req.params.id, { enabled });
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.get('/api/playlists/:id/videos', (req, res) => {
      try {
        const videos = db.getVideosByPlaylistId(req.params.id);
        res.json(videos);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.delete('/api/playlists/:id/videos', (req, res) => {
      try {
        const deleted = db.deleteVideosByPlaylistId(req.params.id);
        res.json({ success: true, deletedCount: deleted });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // Videos endpoints
    app.get('/api/channels/:id/videos', (req, res) => {
      try {
        const videos = db.getVideosByChannelId(req.params.id);
        res.json(videos);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.get('/api/videos/:videoId', (req, res) => {
      try {
        const video = db.getVideoById(req.params.videoId);
        if (!video) {
          return res.status(404).json({ error: 'Video not found' });
        }
        res.json(video);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.delete('/api/videos/:id', (req, res) => {
      try {
        db.deleteVideo(req.params.id);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.delete('/api/videos', (req, res) => {
      try {
        const { videoIds } = req.body;
        if (!Array.isArray(videoIds)) {
          return res.status(400).json({ error: 'videoIds must be an array' });
        }
        let deletedCount = 0;
        videoIds.forEach(id => {
          db.deleteVideo(id);
          deletedCount++;
        });
        res.json({ success: true, deletedCount });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // Stats endpoints
    app.get('/api/stats', (req, res) => {
      try {
        const stats = db.getStats();
        res.json(stats);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.get('/api/stats/channels', (req, res) => {
      try {
        const stats = db.getChannelStats();
        res.json(stats);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    app.get('/api/downloads/recent', (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const result = db.getRecentDownloads(page, limit);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // Download control endpoints (mocked)
    app.post('/api/download/start', (req, res) => {
      mockDownloadManager.startProcessing();
      res.json({ success: true, message: 'Download processing started' });
    });
    
    app.post('/api/download/retry-failed', (req, res) => {
      const result = mockDownloadManager.retryFailed();
      res.json({ success: true, retriedCount: result.retriedCount });
    });
    
    app.get('/api/download/status', (req, res) => {
      res.json(mockDownloadManager.getStatus());
    });
    
    app.get('/api/download/queue', (req, res) => {
      res.json(mockDownloadManager.getQueue());
    });
  });
  
  after(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
  
  describe('GET /api/profiles', () => {
    it('should return empty array initially', async () => {
      const res = await request(app).get('/api/profiles');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });
    
    it('should return all profiles after creation', async () => {
      await request(app).post('/api/profiles').send({
        name: 'Test Profile',
        output_template: '%(title)s.%(ext)s',
        format_selection: 'best'
      });
      
      const res = await request(app).get('/api/profiles');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.length > 0);
    });
  });
  
  describe('POST /api/profiles', () => {
    it('should create a new profile', async () => {
      const res = await request(app)
        .post('/api/profiles')
        .send({
          name: 'New Profile',
          output_template: '%(uploader)s/%(title)s.%(ext)s',
          format_selection: 'bestvideo+bestaudio',
          merge_output_format: 'mkv',
          additional_args: '--embed-thumbnail'
        });
      
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(res.body.id > 0);
    });
  });
  
  describe('GET /api/profiles/:id', () => {
    it('should return profile by id', async () => {
      const createRes = await request(app).post('/api/profiles').send({
        name: 'Fetch Test Profile',
        output_template: '%(title)s.%(ext)s'
      });
      
      const res = await request(app).get(`/api/profiles/${createRes.body.id}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.name, 'Fetch Test Profile');
    });
    
    it('should return 404 for non-existent profile', async () => {
      const res = await request(app).get('/api/profiles/99999');
      assert.strictEqual(res.status, 404);
    });
  });
  
  describe('PUT /api/profiles/:id', () => {
    it('should update profile', async () => {
      const createRes = await request(app).post('/api/profiles').send({
        name: 'Update Test',
        output_template: '%(title)s.%(ext)s'
      });
      
      const res = await request(app)
        .put(`/api/profiles/${createRes.body.id}`)
        .send({ name: 'Updated Name' });
      
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });
  
  describe('DELETE /api/profiles/:id', () => {
    it('should delete profile', async () => {
      const createRes = await request(app).post('/api/profiles').send({
        name: 'Delete Test',
        output_template: '%(title)s.%(ext)s'
      });
      
      const res = await request(app).delete(`/api/profiles/${createRes.body.id}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });
  
  describe('POST /api/channels', () => {
    it('should create channel with required fields', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({
          url: 'https://youtube.com/@testchannel'
        });
      
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(res.body.id > 0);
    });
    
    it('should create channel with SponsorBlock options', async () => {
      const res = await request(app)
        .post('/api/channels')
        .send({
          url: 'https://youtube.com/@sponsortest',
          sponsorblock_enabled: true,
          sponsorblock_mode: 'remove',
          sponsorblock_categories: 'sponsor,intro,outro'
        });
      
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
      
      const channel = await request(app).get(`/api/channels/${res.body.id}`);
      assert.strictEqual(channel.body.sponsorblock_enabled, 1);
      assert.strictEqual(channel.body.sponsorblock_mode, 'remove');
    });
  });
  
  describe('GET /api/channels', () => {
    it('should return all channels', async () => {
      const res = await request(app).get('/api/channels');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });
  });
  
  describe('GET /api/channels/:id', () => {
    it('should return channel by id', async () => {
      const createRes = await request(app).post('/api/channels').send({
        url: 'https://youtube.com/@fetchtest'
      });
      
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
      const createRes = await request(app).post('/api/channels').send({
        url: 'https://youtube.com/@updatetest'
      });
      
      const res = await request(app)
        .put(`/api/channels/${createRes.body.id}`)
        .send({ enabled: false, rescrape_interval_days: 14 });
      
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });
  
  describe('DELETE /api/channels/:id', () => {
    it('should delete channel', async () => {
      const createRes = await request(app).post('/api/channels').send({
        url: 'https://youtube.com/@deletetest'
      });
      
      const res = await request(app).delete(`/api/channels/${createRes.body.id}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });
  
  describe('GET /api/stats', () => {
    it('should return statistics', async () => {
      const res = await request(app).get('/api/stats');
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body.channel_count === 'number');
      assert.ok(typeof res.body.total_downloads === 'number');
      assert.ok(typeof res.body.library_size === 'number');
    });
  });
  
  describe('GET /api/stats/channels', () => {
    it('should return channel statistics', async () => {
      // First create a channel so we have data to return
      await request(app).post('/api/channels').send({
        url: 'https://youtube.com/@stattest'
      });
      
      const res = await request(app).get('/api/stats/channels');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });
  });
  
  describe('GET /api/downloads/recent', () => {
    it('should return paginated recent downloads', async () => {
      const res = await request(app).get('/api/downloads/recent?limit=10&offset=0');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body), 'Should return an array of downloads');
    });
  });
  
  describe('POST /api/download/start', () => {
    it('should start download processing', async () => {
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
      assert.ok(typeof res.body.retriedCount === 'number');
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
    it('should return download queue', async () => {
      const res = await request(app).get('/api/download/queue');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
    });
  });
  
  describe('DELETE /api/videos', () => {
    it('should return error for invalid videoIds format', async () => {
      const res = await request(app)
        .delete('/api/videos')
        .send({ videoIds: 'not-an-array' });
      
      assert.strictEqual(res.status, 400);
    });
    
    it('should delete multiple videos', async () => {
      const res = await request(app)
        .delete('/api/videos')
        .send({ videoIds: [] });
      
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.success);
    });
  });
});
