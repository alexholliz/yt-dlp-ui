const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const DB = require('./database');
const YtDlpService = require('./ytdlp-service');

const app = express();
const PORT = process.env.PORT || 8189;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/yt-dlp-ui.sqlite');
const COOKIES_PATH = process.env.COOKIES_PATH || path.join(__dirname, '../config/cookies.txt');

// Initialize database and yt-dlp service
const db = new DB(DB_PATH);
const ytdlp = new YtDlpService(COOKIES_PATH);

// Wait for DB to initialize
db.ready.then(() => {
  console.log('Database ready');
  
  // Middleware
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());
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

      // Add channel to database
      const channelId = db.addChannel(url, {
        playlist_mode,
        flat_mode,
        auto_add_new_playlists,
        yt_dlp_options,
        rescrape_interval_days
      });

      // Start enumeration in background (don't wait)
      if (playlist_mode === 'enumerate') {
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

            console.log(`Enumerated ${result.playlists.length} playlists for channel ${channelId}`);
          })
          .catch(err => {
            console.error(`Failed to enumerate playlists for channel ${channelId}:`, err);
          });
      }

      res.json({ id: channelId, url });
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

  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`yt-dlp-ui server running on port ${PORT}`);
    console.log(`Database: ${DB_PATH}`);
    console.log(`Cookies: ${COOKIES_PATH}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing database...');
    db.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, closing database...');
    db.close();
    process.exit(0);
  });
});
