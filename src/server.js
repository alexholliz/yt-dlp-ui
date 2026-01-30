const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const basicAuth = require('express-basic-auth');
const path = require('path');
const fs = require('fs');
const DB = require('./database');
const YtDlpService = require('./ytdlp-service');
const DownloadManager = require('./download-manager');
const Scheduler = require('./scheduler');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 8189;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/yt-dlp-ui.sqlite');
const DOWNLOADS_PATH = process.env.DOWNLOADS_PATH || path.join(__dirname, '../downloads');
const COOKIES_PATH = process.env.COOKIES_PATH || path.join(__dirname, '../config/cookies.txt');
const BASIC_AUTH_USERNAME = process.env.BASIC_AUTH_USERNAME;
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD;

// Ensure directories exist
[path.dirname(DB_PATH), DOWNLOADS_PATH, path.dirname(COOKIES_PATH)].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize services
const db = new DB(DB_PATH);
const ytdlp = new YtDlpService(COOKIES_PATH);
const downloadManager = new DownloadManager(db, ytdlp, DOWNLOADS_PATH);
const scheduler = new Scheduler(db, downloadManager);

// Wait for DB to initialize
db.ready.then(() => {
  logger.info('Database ready');
  
  // Middleware
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Basic Auth (if configured)
  if (BASIC_AUTH_USERNAME && BASIC_AUTH_PASSWORD) {
    logger.info('Basic authentication enabled');
    app.use(basicAuth({
      users: { [BASIC_AUTH_USERNAME]: BASIC_AUTH_PASSWORD },
      challenge: true,
      realm: 'yt-dlp-ui'
    }));
  } else {
    logger.warn('Basic authentication is disabled - anyone can access the UI');
  }

  app.use(express.static(path.join(__dirname, '../public')));

  // Routes

  // Home page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  // Get all channels
  app.get('/api/channels', (req, res) => {
    try {
      const channels = db.getAllChannels();
      res.json(channels);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get channel by ID
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

  // Add new channel
  app.post('/api/channels', async (req, res) => {
    try {
      const { url, playlist_mode, flat_mode, auto_add_new_playlists, yt_dlp_options, rescrape_interval_days } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      // Detect URL type
      const urlType = ytdlp.detectUrlType(url);
      
      let finalPlaylistMode = playlist_mode || 'enumerate';
      let playlistsOnly = false;

      // Handle different URL types
      if (urlType === 'video') {
        // Single video - add and download immediately
        const result = await downloadManager.downloadSingleVideo(url, null);
        return res.json({ type: 'video', video_id: result.video_id });
      }

      if (urlType === 'playlist') {
        // Direct playlist URL - treat as a channel with one playlist
        finalPlaylistMode = 'enumerate';
      }

      if (urlType === 'channel_playlists_only') {
        // Channel /playlists URL - only download from playlists
        finalPlaylistMode = 'enumerate';
        playlistsOnly = true;
      }

      // Add channel to database
      const channelId = db.addChannel(url, {
        playlist_mode: finalPlaylistMode,
        flat_mode,
        auto_add_new_playlists,
        yt_dlp_options,
        rescrape_interval_days
      });

      // Start enumeration in background
      if (finalPlaylistMode === 'enumerate') {
        ytdlp.enumeratePlaylists(url)
          .then(result => {
            db.updateChannel(channelId, {
              channel_id: result.channel_id,
              channel_name: result.channel_name,
              last_scraped_at: Math.floor(Date.now() / 1000)
            });

            // Add playlists to database
            result.playlists.forEach(playlist => {
              db.addPlaylist(channelId, {
                ...playlist,
                enabled: auto_add_new_playlists || false
              });
            });

            logger.info(`Enumerated ${result.playlists.length} playlists for channel ${channelId}`);
          })
          .catch(err => {
            logger.error(`Failed to enumerate playlists for channel ${channelId}:`, err);
          });
      }

      res.json({ id: channelId, url, type: urlType, playlistsOnly });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update channel
  app.put('/api/channels/:id', (req, res) => {
    try {
      const { playlist_mode, flat_mode, auto_add_new_playlists, yt_dlp_options } = req.body;
      db.updateChannel(req.params.id, {
        playlist_mode,
        flat_mode,
        auto_add_new_playlists,
        yt_dlp_options
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete channel
  app.delete('/api/channels/:id', (req, res) => {
    try {
      db.deleteChannel(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Re-enumerate playlists for a channel
  app.post('/api/channels/:id/enumerate', async (req, res) => {
    try {
      const channel = db.getChannel(req.params.id);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      const result = await ytdlp.enumeratePlaylists(channel.url);

      db.updateChannel(req.params.id, {
        channel_id: result.channel_id,
        channel_name: result.channel_name,
        last_scraped_at: Math.floor(Date.now() / 1000)
      });

      // Add/update playlists
      result.playlists.forEach(playlist => {
        db.addPlaylist(req.params.id, {
          ...playlist,
          enabled: channel.auto_add_new_playlists || false
        });
      });

      res.json({ playlists: result.playlists });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get playlists for a channel
  app.get('/api/channels/:id/playlists', (req, res) => {
    try {
      const playlists = db.getPlaylistsByChannel(req.params.id);
      res.json(playlists);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update playlist enabled status
  app.put('/api/playlists/:id', (req, res) => {
    try {
      const { enabled } = req.body;
      db.updatePlaylistEnabled(req.params.id, enabled);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get videos for a channel
  app.get('/api/channels/:id/videos', (req, res) => {
    try {
      const videos = db.getVideosByChannel(req.params.id);
      res.json(videos);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Download endpoints
  
  // Start downloading a playlist
  app.post('/api/playlists/:id/download', async (req, res) => {
    try {
      const result = await downloadManager.downloadPlaylist(parseInt(req.params.id));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Start downloading all enabled playlists for a channel
  app.post('/api/channels/:id/download', async (req, res) => {
    try {
      const result = await downloadManager.downloadChannel(parseInt(req.params.id));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Download a single video
  app.post('/api/download/video', async (req, res) => {
    try {
      const { url, channelId } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }
      const result = await downloadManager.downloadSingleVideo(url, channelId || null);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get download queue status
  app.get('/api/download/status', (req, res) => {
    try {
      const status = downloadManager.getQueueStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Scheduler endpoints
  
  // Start scheduler
  app.post('/api/scheduler/start', (req, res) => {
    try {
      const { intervalDays } = req.body;
      scheduler.start(intervalDays || 7);
      res.json({ success: true, message: 'Scheduler started' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stop scheduler
  app.post('/api/scheduler/stop', (req, res) => {
    try {
      scheduler.stop();
      res.json({ success: true, message: 'Scheduler stopped' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get scheduler status
  app.get('/api/scheduler/status', (req, res) => {
    try {
      const status = scheduler.getStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manually trigger a channel download
  app.post('/api/scheduler/trigger/:channelId', async (req, res) => {
    try {
      await scheduler.triggerChannel(parseInt(req.params.channelId));
      res.json({ success: true, message: 'Channel download triggered' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cookie management
  
  // Get cookie file content
  app.get('/api/cookies', (req, res) => {
    try {
      if (fs.existsSync(COOKIES_PATH)) {
        const content = fs.readFileSync(COOKIES_PATH, 'utf8');
        res.json({ exists: true, content });
      } else {
        res.json({ exists: false, content: '' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update cookie file
  app.post('/api/cookies', (req, res) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      fs.writeFileSync(COOKIES_PATH, content, 'utf8');
      res.json({ success: true, message: 'Cookies saved successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete cookie file
  app.delete('/api/cookies', (req, res) => {
    try {
      if (fs.existsSync(COOKIES_PATH)) {
        fs.unlinkSync(COOKIES_PATH);
      }
      res.json({ success: true, message: 'Cookies deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`yt-dlp-ui server running on port ${PORT}`);
    logger.info(`Database: ${DB_PATH}`);
    logger.info(`Cookies: ${COOKIES_PATH}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    scheduler.stop();
    db.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    scheduler.stop();
    db.close();
    process.exit(0);
  });
});
