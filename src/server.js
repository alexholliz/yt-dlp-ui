const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const basicAuth = require('express-basic-auth');
const path = require('path');
const fs = require('fs');
const DB = require('./database');
const YtDlpService = require('./ytdlp-service');
const YouTubeApiService = require('./youtube-api-service');
const DownloadManager = require('./download-manager');
const Scheduler = require('./scheduler');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 8189;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/yt-dlp-ui.sqlite');
const DOWNLOADS_PATH = process.env.DOWNLOADS_PATH || path.join(__dirname, '../downloads');
const COOKIES_PATH = process.env.COOKIES_PATH || path.join(__dirname, '../config/cookies.txt');
const CONFIG_PATH = process.env.CONFIG_PATH || path.dirname(COOKIES_PATH);
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
const youtubeApi = new YouTubeApiService(CONFIG_PATH);
const ytdlp = new YtDlpService(COOKIES_PATH, youtubeApi);
const downloadManager = new DownloadManager(db, ytdlp, DOWNLOADS_PATH);
const scheduler = new Scheduler(db, downloadManager);

// Wait for DB to initialize
db.ready.then(() => {
  logger.info('Database ready');
  
  // Middleware
  app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for large cookie files
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
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

  // Get all channels
  app.get('/api/channels', (req, res) => {
    try {
      const channels = db.getAllChannels();
      
      // Add total_size to each channel
      const channelsWithSize = channels.map(channel => {
        const videos = db.getVideosByChannel(channel.id).filter(v => v.download_status === 'completed');
        const totalSize = videos.reduce((sum, v) => sum + (v.file_size || 0), 0);
        return { ...channel, total_size: totalSize };
      });
      
      res.json(channelsWithSize);
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
      const { url, playlist_mode, flat_mode, auto_add_new_playlists, yt_dlp_options, rescrape_interval_days, profile_id } = req.body;

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
        rescrape_interval_days,
        profile_id
      });

      // Start enumeration in background and wait for it to complete
      if (finalPlaylistMode === 'enumerate') {
        // Don't await - let it run in background but respond immediately
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

            logger.info(`Enumerated ${result.playlists.length} playlists for channel ${channelId} - ${result.channel_name || url}`);
          })
          .catch(err => {
            logger.error(`Failed to enumerate playlists for channel ${channelId}: ${err.message}`);
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
      const { playlist_mode, flat_mode, auto_add_new_playlists, yt_dlp_options, profile_id } = req.body;
      db.updateChannel(req.params.id, {
        playlist_mode,
        flat_mode,
        auto_add_new_playlists,
        yt_dlp_options,
        profile_id
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

      // Add/update playlists and fetch real video counts
      const playlistsWithCounts = [];
      for (const playlist of result.playlists) {
        // Add/update playlist first
        db.addPlaylist(req.params.id, {
          ...playlist,
          enabled: channel.auto_add_new_playlists || false
        });
        
        // Get real video count by enumerating playlist videos
        try {
          const videos = await ytdlp.enumeratePlaylistVideos(playlist.playlist_url);
          const realCount = videos.length;
          
          // Update with real count
          db.db.run('UPDATE playlists SET video_count = ?, updated_at = strftime("%s", "now") WHERE channel_id = ? AND playlist_id = ?', 
            [realCount, req.params.id, playlist.playlist_id]);
          db.save();
          
          playlistsWithCounts.push({ ...playlist, video_count: realCount });
          logger.info(`Updated ${playlist.playlist_title}: ${realCount} videos`);
        } catch (err) {
          logger.error(`Failed to get video count for ${playlist.playlist_title}:`, err.message);
          playlistsWithCounts.push(playlist); // Use preview count as fallback
        }
      }

      res.json({ playlists: playlistsWithCounts });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Enumerate/refresh a single playlist
  app.post('/api/playlists/:id/enumerate', async (req, res) => {
    try {
      const playlist = db.getPlaylist(req.params.id);
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }

      // Get real video count by enumerating playlist videos
      const videos = await ytdlp.enumeratePlaylistVideos(playlist.playlist_url);
      const realCount = videos.length;
      
      // Update with real count
      db.db.run('UPDATE playlists SET video_count = ?, updated_at = strftime("%s", "now") WHERE id = ?', 
        [realCount, req.params.id]);
      db.save();
      
      logger.info(`Refreshed ${playlist.playlist_title}: ${realCount} videos`);
      
      res.json({ 
        id: playlist.id,
        playlist_title: playlist.playlist_title,
        video_count: realCount 
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get playlists for a channel
  app.get('/api/channels/:id/playlists', (req, res) => {
    try {
      const playlists = db.getPlaylistsByChannel(req.params.id);
      
      // Add total_size to each playlist
      const playlistsWithSize = playlists.map(p => {
        const videos = db.getVideosByPlaylist(p.id).filter(v => v.download_status === 'completed');
        const total_size = videos.reduce((sum, v) => sum + (v.file_size || 0), 0);
        return { ...p, total_size };
      });
      
      res.json(playlistsWithSize);
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

  // Get videos for a playlist with status and size
  app.get('/api/playlists/:id/videos', (req, res) => {
    try {
      const playlist = db.getPlaylist(req.params.id);
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }
      
      const videos = db.getVideosByPlaylist(req.params.id);
      const total_size = videos
        .filter(v => v.download_status === 'completed')
        .reduce((sum, v) => sum + (v.file_size || 0), 0);
      
      res.json({
        playlist: { ...playlist, total_size },
        videos
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete all videos in a playlist
  app.delete('/api/playlists/:id/videos', (req, res) => {
    try {
      const playlist = db.getPlaylist(req.params.id);
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }

      const videos = db.getVideosByPlaylist(req.params.id);
      const archivePath = path.join(DOWNLOADS_PATH, '.downloaded');
      let deletedFiles = 0;
      let playlistDir = null;

      // Delete each video file and collect the playlist directory
      videos.forEach(video => {
        if (video.file_path && fs.existsSync(video.file_path)) {
          try {
            // Track the playlist directory (parent of the video file)
            if (!playlistDir && video.file_path) {
              playlistDir = path.dirname(video.file_path);
            }

            // Delete video file
            fs.unlinkSync(video.file_path);
            deletedFiles++;

            // Delete .info.json
            const infoJsonPath = video.file_path.replace(/\.[^.]+$/, '.info.json');
            if (fs.existsSync(infoJsonPath)) {
              fs.unlinkSync(infoJsonPath);
            }

            // Delete thumbnails
            const thumbExtensions = ['.jpg', '.png', '.webp'];
            const baseFilePath = video.file_path.replace(/\.[^.]+$/, '');
            thumbExtensions.forEach(ext => {
              const thumbPath = baseFilePath + ext;
              if (fs.existsSync(thumbPath)) {
                fs.unlinkSync(thumbPath);
              }
            });
          } catch (fileErr) {
            logger.error(`Failed to delete file ${video.file_path}:`, fileErr.message);
          }
        }

        // Remove from download archive
        if (fs.existsSync(archivePath)) {
          try {
            const archiveContent = fs.readFileSync(archivePath, 'utf8');
            const lines = archiveContent.split('\n');
            const filteredLines = lines.filter(line => !line.includes(video.video_id));
            fs.writeFileSync(archivePath, filteredLines.join('\n'));
          } catch (archiveErr) {
            logger.error(`Failed to update download archive:`, archiveErr.message);
          }
        }
      });

      // Delete the playlist directory if it exists and is empty (or only has metadata files)
      if (playlistDir && fs.existsSync(playlistDir)) {
        try {
          const remainingFiles = fs.readdirSync(playlistDir);
          // Only delete if empty or only contains .info.json files
          const nonMetadataFiles = remainingFiles.filter(f => !f.endsWith('.info.json') && !f.endsWith('.jpg') && !f.endsWith('.png'));
          if (nonMetadataFiles.length === 0) {
            // Delete any remaining metadata files
            remainingFiles.forEach(file => {
              const filePath = path.join(playlistDir, file);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            });
            // Remove the directory
            fs.rmdirSync(playlistDir);
            logger.info(`Deleted playlist directory: ${playlistDir}`);
          }
        } catch (dirErr) {
          logger.error(`Failed to delete playlist directory:`, dirErr.message);
        }
      }

      // Delete from database
      db.db.run('DELETE FROM videos WHERE playlist_id = ?', [req.params.id]);
      db.save();

      logger.info(`Deleted ${videos.length} videos from playlist ${playlist.playlist_title}`);
      res.json({ 
        success: true, 
        message: `Deleted ${videos.length} videos and ${deletedFiles} files`,
        channel_id: playlist.channel_id
      });
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

  // Delete a single video
  app.delete('/api/videos/:id', (req, res) => {
    try {
      // Get video info first to find file path
      const videoResult = db.db.exec('SELECT * FROM videos WHERE video_id = ?', [req.params.id]);
      
      if (videoResult.length === 0 || videoResult[0].values.length === 0) {
        return res.status(404).json({ error: 'Video not found' });
      }
      
      const video = db.rowToObject(videoResult[0].columns, videoResult[0].values[0]);
      
      // Delete file from disk if it exists
      if (video.file_path && fs.existsSync(video.file_path)) {
        try {
          fs.unlinkSync(video.file_path);
          logger.info(`Deleted file: ${video.file_path}`);
          
          // Also delete .info.json if it exists
          const infoJsonPath = video.file_path.replace(/\.[^.]+$/, '.info.json');
          if (fs.existsSync(infoJsonPath)) {
            fs.unlinkSync(infoJsonPath);
            logger.info(`Deleted info.json: ${infoJsonPath}`);
          }
          
          // Delete thumbnail if it exists
          const thumbExtensions = ['.jpg', '.png', '.webp'];
          const baseFilePath = video.file_path.replace(/\.[^.]+$/, '');
          thumbExtensions.forEach(ext => {
            const thumbPath = baseFilePath + ext;
            if (fs.existsSync(thumbPath)) {
              fs.unlinkSync(thumbPath);
              logger.info(`Deleted thumbnail: ${thumbPath}`);
            }
          });
        } catch (fileErr) {
          logger.error(`Failed to delete file ${video.file_path}:`, fileErr.message);
          // Continue anyway to delete from database
        }
      }
      
      // Remove from download archive
      const archivePath = path.join(DOWNLOADS_PATH, '.downloaded');
      if (fs.existsSync(archivePath)) {
        try {
          const archiveContent = fs.readFileSync(archivePath, 'utf8');
          const lines = archiveContent.split('\n');
          const filteredLines = lines.filter(line => !line.includes(video.video_id));
          fs.writeFileSync(archivePath, filteredLines.join('\n'));
          logger.info(`Removed ${video.video_id} from download archive`);
        } catch (archiveErr) {
          logger.error(`Failed to update download archive:`, archiveErr.message);
        }
      }
      
      // Delete from database
      db.db.run('DELETE FROM videos WHERE video_id = ?', [req.params.id]);
      db.save();
      
      res.json({ success: true, message: 'Video and files deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Force redownload a video
  app.post('/api/videos/:id/redownload', (req, res) => {
    try {
      // Remove from download archive so it will actually download
      const archivePath = path.join(DOWNLOADS_PATH, '.downloaded');
      if (fs.existsSync(archivePath)) {
        try {
          const archiveContent = fs.readFileSync(archivePath, 'utf8');
          const lines = archiveContent.split('\n');
          const filteredLines = lines.filter(line => !line.includes(req.params.id));
          fs.writeFileSync(archivePath, filteredLines.join('\n'));
          logger.info(`Removed ${req.params.id} from download archive for redownload`);
        } catch (archiveErr) {
          logger.error(`Failed to update download archive:`, archiveErr.message);
        }
      }
      
      db.updateVideoStatus(req.params.id, 'pending', null, null, 0, null);
      res.json({ success: true, message: 'Video queued for redownload' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete all videos (for testing/cleanup)
  app.delete('/api/videos', (req, res) => {
    try {
      // Clear download archive completely
      const archivePath = path.join(DOWNLOADS_PATH, '.downloaded');
      if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
        logger.info('Cleared download archive');
      }
      
      db.db.run('DELETE FROM videos');
      db.save();
      res.json({ success: true, message: 'All videos deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stats endpoints
  
  // Get overall statistics
  app.get('/api/stats', (req, res) => {
    try {
      const stats = db.getStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get recent downloads with pagination and optional status filter
  app.get('/api/downloads/recent', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 5;
      const offset = parseInt(req.query.offset) || 0;
      const status = req.query.status; // optional: 'failed', 'completed', etc.
      const downloads = db.getRecentDownloads(limit, offset, status);
      res.json(downloads);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manually start downloads (if queue is stuck)
  app.post('/api/download/start', (req, res) => {
    try {
      if (!downloadManager.isProcessing) {
        downloadManager.startDownloads();
        res.json({ success: true, message: 'Downloads started' });
      } else {
        res.json({ success: true, message: 'Downloads already running' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Retry all failed downloads
  app.post('/api/download/retry-failed', (req, res) => {
    try {
      const failedVideos = db.getRecentDownloads(1000, 0, 'failed');
      
      // Remove all failed videos from download archive
      const archivePath = path.join(DOWNLOADS_PATH, '.downloaded');
      if (fs.existsSync(archivePath)) {
        try {
          const archiveContent = fs.readFileSync(archivePath, 'utf8');
          let lines = archiveContent.split('\n');
          
          failedVideos.forEach(v => {
            lines = lines.filter(line => !line.includes(v.video_id));
          });
          
          fs.writeFileSync(archivePath, lines.join('\n'));
          logger.info(`Removed ${failedVideos.length} failed videos from download archive`);
        } catch (archiveErr) {
          logger.error(`Failed to update download archive:`, archiveErr.message);
        }
      }
      
      failedVideos.forEach(v => {
        db.updateVideoStatus(v.video_id, 'pending', null, null, 0, null);
      });
      
      if (!downloadManager.isProcessing) {
        downloadManager.startDownloads();
      }
      
      res.json({ success: true, count: failedVideos.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get channel statistics
  app.get('/api/stats/channels', (req, res) => {
    try {
      const channelStats = db.getChannelStats();
      res.json(channelStats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get video by ID (for metadata page)
  app.get('/api/videos/:videoId', (req, res) => {
    try {
      const video = db.getVideo(req.params.videoId);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }
      res.json(video);
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
      // Get video details for active downloads
      status.downloads = status.downloads.map(d => {
        const video = db.getVideo(d.video_id);
        return {
          ...d,
          video_title: video?.video_title || d.video_id,
          channel_name: video?.channel_name || 'Unknown',
          error_message: video?.error_message
        };
      });
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Get pending videos in queue
  app.get('/api/download/queue', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;
      const pendingVideos = db.getPendingVideos(limit, offset);
      res.json(pendingVideos);
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

      // Validate cookie format (but don't clean - save as-is)
      const validation = validateCookieFormat(content);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'Invalid cookie format', 
          details: validation.errors 
        });
      }

      fs.writeFileSync(COOKIES_PATH, content, 'utf8');
      
      res.json({ 
        success: true, 
        message: 'Cookies saved successfully',
        warnings: validation.warnings 
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Test cookies against YouTube
  app.post('/api/cookies/test', async (req, res) => {
    try {
      if (!fs.existsSync(COOKIES_PATH)) {
        return res.status(400).json({ 
          valid: false, 
          error: 'No cookies file found. Please save cookies first.' 
        });
      }

      // Test against age-restricted video to verify cookies work
      const testVideoUrl = 'https://www.youtube.com/watch?v=X30kr6v6ibM';
      const result = await ytdlp.testCookies(testVideoUrl);
      
      res.json(result);
    } catch (err) {
      res.status(500).json({ 
        valid: false, 
        error: err.message 
      });
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

  // Helper function to validate cookie format
  function validateCookieFormat(content) {
    const errors = [];
    const warnings = [];
    
    // Check for Netscape format header
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      errors.push('Cookie file is empty');
      return { valid: false, errors, warnings };
    }

    // Look for Netscape header (usually commented)
    const hasNetscapeHeader = lines.some(line => 
      line.includes('Netscape HTTP Cookie File')
    );
    if (!hasNetscapeHeader) {
      warnings.push('Missing Netscape HTTP Cookie File header (may still work)');
    }

    // Check for YouTube domain cookies
    const hasYouTubeCookies = lines.some(line => 
      line.includes('.youtube.com') && !line.startsWith('#')
    );
    if (!hasYouTubeCookies) {
      errors.push('No .youtube.com cookies found');
    }

    // Check for authentication cookies
    const authCookies = ['LOGIN_INFO', 'SSID', 'SID', 'HSID', 'APISID', 'SAPISID'];
    const foundAuthCookies = authCookies.filter(cookieName =>
      lines.some(line => 
        line.includes(cookieName) && !line.startsWith('#')
      )
    );

    if (foundAuthCookies.length === 0) {
      warnings.push('No authentication cookies found (LOGIN_INFO, SSID, SID, etc.)');
    }

    // Check for valid cookie format (tab-separated values)
    const dataLines = lines.filter(line => !line.startsWith('#') && line.trim());
    const invalidLines = dataLines.filter(line => {
      const parts = line.split('\t');
      return parts.length < 6; // Netscape format has 7 fields
    });

    if (invalidLines.length > 0) {
      warnings.push(`${invalidLines.length} line(s) may have invalid format`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // YouTube API Key Management
  app.post('/api/youtube-api/key', (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey || apiKey.trim().length === 0) {
        return res.status(400).json({ error: 'API key is required' });
      }
      
      youtubeApi.saveApiKey(apiKey);
      res.json({ success: true, message: 'API key saved successfully' });
    } catch (err) {
      logger.error('Failed to save YouTube API key:', err);
      res.status(500).json({ error: 'Failed to save API key: ' + err.message });
    }
  });

  app.get('/api/youtube-api/key', (req, res) => {
    try {
      const hasKey = youtubeApi.hasValidApiKey();
      // Don't send the actual key, just whether one exists
      res.json({ 
        hasKey,
        keyLength: hasKey ? youtubeApi.apiKey.length : 0
      });
    } catch (err) {
      logger.error('Failed to check YouTube API key:', err);
      res.status(500).json({ error: 'Failed to check API key: ' + err.message });
    }
  });

  app.delete('/api/youtube-api/key', (req, res) => {
    try {
      youtubeApi.deleteApiKey();
      res.json({ success: true, message: 'API key deleted successfully' });
    } catch (err) {
      logger.error('Failed to delete YouTube API key:', err);
      res.status(500).json({ error: 'Failed to delete API key: ' + err.message });
    }
  });

  app.post('/api/youtube-api/test', async (req, res) => {
    try {
      const { apiKey } = req.body;
      const result = await youtubeApi.testApiKey(apiKey);
      res.json(result);
    } catch (err) {
      logger.error('Failed to test YouTube API key:', err);
      res.status(500).json({ valid: false, error: err.message });
    }
  });

  app.get('/api/youtube-api/quota', (req, res) => {
    try {
      const quota = youtubeApi.getQuotaStatus();
      res.json(quota);
    } catch (err) {
      logger.error('Failed to get YouTube API quota:', err);
      res.status(500).json({ error: 'Failed to get quota: ' + err.message });
    }
  });

  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`yt-dlp-ui server running on port ${PORT}`);
    logger.info(`Database: ${DB_PATH}`);
    logger.info(`Cookies: ${COOKIES_PATH}`);
  });

  // Graceful shutdown
  let isShuttingDown = false;
  
  async function handleShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    logger.info(`${signal} received, initiating graceful shutdown...`);
    
    // Stop scheduler from starting new downloads
    scheduler.stop();
    
    // Wait for active downloads to complete (3 minute timeout)
    await downloadManager.gracefulShutdown(180000);
    
    // Close database
    db.close();
    
    logger.info('Shutdown complete');
    process.exit(0);
  }
  
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
});
