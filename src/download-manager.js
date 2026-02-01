const path = require('path');
const logger = require('./logger');

class DownloadManager {
  constructor(db, ytdlp, downloadsPath) {
    this.db = db;
    this.ytdlp = ytdlp;
    this.downloadsPath = downloadsPath;
    this.activeDownloads = new Map(); // video_id -> download info
    this.queue = [];
    this.isProcessing = false;
    this.isShuttingDown = false;
    this.concurrency = parseInt(process.env.YT_DL_WORKER_CONCURRENCY || '2');
  }

  async gracefulShutdown(timeoutMs = 180000) { // 3 minutes default
    if (this.activeDownloads.size === 0) {
      logger.info('No active downloads, shutting down immediately');
      return;
    }

    logger.warn(`Graceful shutdown initiated with ${this.activeDownloads.size} active downloads`);
    logger.warn(`Waiting up to ${timeoutMs / 1000} seconds for downloads to complete...`);
    
    this.isShuttingDown = true;
    const startTime = Date.now();
    
    // Wait for downloads to complete or timeout
    while (this.activeDownloads.size > 0 && (Date.now() - startTime) < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (this.activeDownloads.size > 0) {
        logger.info(`Waiting for ${this.activeDownloads.size} downloads to complete...`);
      }
    }

    if (this.activeDownloads.size > 0) {
      logger.error(`Timeout reached with ${this.activeDownloads.size} downloads still active`);
      logger.error('Cancelling remaining downloads and cleaning up partial files...');
      
      // Clean up partial downloads
      for (const [videoId, info] of this.activeDownloads.entries()) {
        // Find and remove .part files for this video
        if (info.downloadPath) {
          this.cleanupPartialFiles(info.downloadPath, videoId);
        }
        
        // Mark as failed in database
        this.db.updateVideoStatus(videoId, 'failed', null, null, 0, 'Download cancelled due to shutdown timeout');
      }
      
      this.activeDownloads.clear();
    } else {
      logger.info('All downloads completed successfully before shutdown');
    }
  }

  async startDownloads() {
    if (this.isProcessing) return;
    
    // Load pending videos from database if queue is empty
    if (this.queue.length === 0) {
      logger.info('Queue is empty, loading pending videos from database...');
      const pendingVideos = this.db.getRecentDownloads(100, 0, 'pending');
      
      for (const video of pendingVideos) {
        const playlist = this.db.getPlaylist(video.playlist_id);
        const channel = this.db.getChannel(video.channel_id);
        
        if (playlist && channel) {
          this.queue.push({
            videoId: video.video_id,
            playlistId: video.playlist_id,
            channelId: video.channel_id,
            url: playlist.playlist_url,
            playlistItemIndex: video.playlist_index,
            options: this.buildDownloadOptions(channel, playlist)
          });
        }
      }
      
      logger.info(`Loaded ${this.queue.length} pending videos into queue`);
    }
    
    if (this.queue.length === 0) {
      logger.info('No pending downloads in queue');
      return;
    }
    
    this.isProcessing = true;
    
    // Start multiple workers based on concurrency
    const workers = [];
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(this.worker());
    }
    
    await Promise.all(workers);
    this.isProcessing = false;
  }

  async worker() {
    while (this.queue.length > 0 && !this.isShuttingDown) {
      const task = this.queue.shift();
      if (task) {
        await this.processDownload(task);
      }
    }
  }

  async processDownload(task) {
    const { videoId, playlistId, channelId, url, playlistItemIndex, options } = task;
    const fs = require('fs');
    const path = require('path');

    try {
      // Update status to downloading
      this.db.updateVideoStatus(videoId, 'downloading');
      
      // Track download with potential partial file pattern
      this.activeDownloads.set(videoId, { 
        progress: 0, 
        startTime: Date.now(),
        downloadPath: options.outputPath
      });

      // Add playlist item index to options if specified
      if (playlistItemIndex) {
        options.playlistItemIndex = playlistItemIndex;
      }

      // Download the video
      const filePath = await this.ytdlp.download(url, options, (progress) => {
        const info = this.activeDownloads.get(videoId);
        if (info) {
          info.progress = progress.percent;
          this.activeDownloads.set(videoId, info);
        }
      });

      // Calculate file size and get metadata
      let fileSize = 0;
      let metadata = {};
      
      logger.info(`Download completed, file path: ${filePath}`);
      
      if (filePath && fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        fileSize = stats.size;
        logger.info(`File size: ${fileSize} bytes`);
        
        // Try to read metadata from .info.json file
        const infoJsonPath = filePath.replace(/\.[^.]+$/, '.info.json');
        if (fs.existsSync(infoJsonPath)) {
          try {
            const infoContent = fs.readFileSync(infoJsonPath, 'utf8');
            const info = JSON.parse(infoContent);
            metadata = {
              upload_date: info.upload_date,
              resolution: info.resolution || `${info.width}x${info.height}`,
              fps: info.fps,
              vcodec: info.vcodec,
              acodec: info.acodec
            };
            logger.info(`Metadata extracted: ${JSON.stringify(metadata)}`);
          } catch (err) {
            logger.error(`Failed to read metadata for ${videoId}:`, err.message);
          }
        } else {
          logger.warn(`No info.json found at: ${infoJsonPath}`);
        }
      } else {
        logger.warn(`File path is ${filePath ? 'invalid' : 'null'} or file does not exist`);
      }

      // Update video with file info and metadata
      this.db.updateVideoStatus(videoId, 'completed', filePath, Math.floor(Date.now() / 1000), fileSize);
      
      // Update metadata fields if we have them
      if (metadata.upload_date || metadata.resolution) {
        this.db.updateVideoMetadata(videoId, metadata);
      }
      
      this.activeDownloads.delete(videoId);

      logger.info(`✓ Downloaded: ${videoId} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    } catch (err) {
      logger.error(`✗ Failed to download ${videoId}:`, err.message);
      this.db.updateVideoStatus(videoId, 'failed', null, null, 0, err.message);
      this.activeDownloads.delete(videoId);
      
      // Clean up any partial files on error
      if (options.outputPath) {
        this.cleanupPartialFiles(options.outputPath, videoId);
      }
    }
  }

  cleanupPartialFiles(directory, videoId) {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const findPartFiles = (dir) => {
        const files = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...findPartFiles(fullPath));
          } else if (entry.isFile() && entry.name.includes(videoId) && entry.name.endsWith('.part')) {
            files.push(fullPath);
          }
        }
        return files;
      };
      
      const partFiles = findPartFiles(directory);
      partFiles.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          logger.info(`Cleaned up partial file: ${file}`);
        }
      });
    } catch (cleanupErr) {
      logger.error(`Failed to clean up partial files: ${cleanupErr.message}`);
    }
  }

  buildDownloadOptions(channel, playlist) {
    const path = require('path');
    const outputTemplate = channel.flat_mode
      ? '%(uploader)s [%(channel_id)s]/%(title)s [%(id)s].%(ext)s'
      : '%(uploader)s [%(channel_id)s]/%(playlist_title)s [%(playlist_id)s]/%(playlist_index)s - %(title)s [%(id)s].%(ext)s';

    // Build list of flags to filter from custom options (only if corresponding toggle is ON)
    const flagsToFilter = [];
    
    // Only filter metadata flags if toggles are ON
    if (channel.download_metadata) flagsToFilter.push('--write-info-json');
    if (channel.embed_metadata) flagsToFilter.push('--embed-metadata');
    
    // Only filter thumbnail flags if toggles are ON
    if (channel.download_thumbnail) flagsToFilter.push('--write-thumbnail');
    if (channel.embed_thumbnail) flagsToFilter.push('--embed-thumbnail');
    
    // Only filter subtitle flags if toggles are ON
    if (channel.download_subtitles) {
      flagsToFilter.push('--write-subs', '--write-subtitles');
    }
    if (channel.embed_subtitles) {
      flagsToFilter.push('--embed-subs', '--embed-subtitles');
    }
    if (channel.auto_subtitles) {
      flagsToFilter.push('--write-auto-subs', '--write-automatic-subs');
    }
    if (channel.download_subtitles || channel.embed_subtitles) {
      flagsToFilter.push('--sub-lang', '--sub-langs');
    }

    // Parse and filter custom yt-dlp options to remove conflicts
    let filteredCustomArgs = '';
    if (channel.yt_dlp_options) {
      const customArgsParsed = channel.yt_dlp_options.split(/\s+/);
      const filtered = customArgsParsed.filter(arg => {
        // Keep arguments that aren't in our filter list
        const argWithoutValue = arg.split('=')[0]; // Handle --arg=value format
        return !flagsToFilter.includes(argWithoutValue);
      });
      filteredCustomArgs = filtered.join(' ');
    }

    // Build enhanced yt-dlp options (only non-boolean flags that need customArgs)
    const enhancedArgs = [];
    
    // Subtitle options (need special formatting)
    if (channel.download_subtitles || channel.embed_subtitles) {
      const languages = channel.subtitle_languages || 'en';
      enhancedArgs.push(`--sub-langs ${languages}`);
      
      if (channel.download_subtitles) {
        enhancedArgs.push('--write-subs');
      }
      if (channel.embed_subtitles) {
        enhancedArgs.push('--embed-subs');
      }
      if (channel.auto_subtitles) {
        enhancedArgs.push('--write-auto-subs');
      }
    }

    // Build SponsorBlock arguments if enabled
    let sponsorblockArgs = '';
    if (channel.sponsorblock_enabled && channel.sponsorblock_categories) {
      const mode = channel.sponsorblock_mode || 'mark';
      const categories = channel.sponsorblock_categories;
      
      if (mode === 'mark') {
        sponsorblockArgs = `--sponsorblock-mark ${categories}`;
      } else if (mode === 'remove') {
        sponsorblockArgs = `--sponsorblock-remove ${categories}`;
      }
    }

    // Combine all args: enhanced options + SponsorBlock + filtered custom args
    const customArgs = [enhancedArgs.join(' '), sponsorblockArgs, filteredCustomArgs]
      .filter(Boolean)
      .join(' ')
      .trim() || null;

    return {
      outputPath: this.downloadsPath,
      outputTemplate,
      format: 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080] / best',
      mergeOutputFormat: 'mp4',
      // Metadata options (handled by ytdlp-service)
      writeInfoJson: channel.download_metadata,
      embedMetadata: channel.embed_metadata,
      // Thumbnail options (handled by ytdlp-service)
      writeThumbnail: channel.download_thumbnail,
      embedThumbnail: channel.embed_thumbnail,
      noRestrictFilenames: true,
      downloadArchive: path.join(this.downloadsPath, '.downloaded'),
      customArgs,
      playlistMetadata: {
        playlist_title: playlist.playlist_title,
        playlist_id: playlist.playlist_id
      }
    };
  }

  async downloadPlaylist(playlistId) {
    try {
      const playlist = this.db.getPlaylist(playlistId);
      if (!playlist || !playlist.enabled) {
        throw new Error('Playlist not found or not enabled');
      }

      const channel = this.db.getChannel(playlist.channel_id);
      if (!channel) {
        throw new Error('Channel not found');
      }

      // Enumerate videos in playlist
      logger.info(`Enumerating videos in playlist: ${playlist.playlist_title}`);
      const videos = await this.ytdlp.enumeratePlaylistVideos(playlist.playlist_url);
      logger.info(`Found ${videos.length} videos in playlist`);

      // Update playlist video count with actual count
      this.db.db.run('UPDATE playlists SET video_count = ?, updated_at = strftime("%s", "now") WHERE id = ?', [videos.length, playlistId]);
      this.db.save();

      // Add videos to database
      for (const video of videos) {
        this.db.addVideo({
          channel_id: playlist.channel_id,
          playlist_id: playlistId,
          video_id: video.video_id,
          video_title: video.video_title,
          video_url: video.video_url,
          uploader: video.uploader,
          upload_date: video.upload_date,
          duration: video.duration,
          playlist_index: video.playlist_index,
          download_status: 'pending'
        });
      }

      // Get pending videos
      const pendingVideos = this.db.getVideosByPlaylist(playlistId)
        .filter(v => v.download_status === 'pending');
      
      logger.info(`${pendingVideos.length} videos pending download`);

      // Build download options
      const outputTemplate = channel.flat_mode
        ? '%(uploader)s [%(channel_id)s]/%(title)s [%(id)s].%(ext)s'
        : '%(uploader)s [%(channel_id)s]/%(playlist_title)s [%(playlist_id)s]/%(playlist_index)s - %(title)s [%(id)s].%(ext)s';

      // Queue videos for download with playlist metadata
      for (const video of pendingVideos) {
        const downloadOptions = {
          outputPath: this.downloadsPath,
          outputTemplate,
          format: 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080] / best',
          mergeOutputFormat: 'mp4',
          writeInfoJson: true,
          noRestrictFilenames: true,
          writeThumbnail: true,
          downloadArchive: path.join(this.downloadsPath, '.downloaded'),
          customArgs: channel.yt_dlp_options,
          // Pass playlist metadata to yt-dlp
          playlistMetadata: {
            playlist_title: playlist.playlist_title,
            playlist_id: playlist.playlist_id,
            playlist_index: video.playlist_index
          }
        };
        
        this.queue.push({
          videoId: video.video_id,
          playlistId: playlistId,
          channelId: channel.id,
          // Use playlist URL with specific item index for proper metadata
          url: `${playlist.playlist_url}`,
          playlistItemIndex: video.playlist_index,
          options: downloadOptions
        });
      }
      
      logger.info(`Queued ${pendingVideos.length} videos for download`);

      // Start processing if not already running
      if (!this.isProcessing) {
        logger.info('Starting download workers...');
        this.startDownloads();
      } else {
        logger.info('Download workers already running');
      }

      return { queued: pendingVideos.length };
    } catch (err) {
      logger.error(`Failed to download playlist ${playlistId}:`, err.message || err.toString());
      if (err.stack) logger.error('Stack trace:', err.stack);
      throw err;
    }
  }

  async downloadChannel(channelId) {
    const channel = this.db.getChannel(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Get enabled playlists
    const playlists = this.db.getPlaylistsByChannel(channelId)
      .filter(p => p.enabled);

    if (playlists.length === 0) {
      throw new Error('No enabled playlists found');
    }

    let totalQueued = 0;
    for (const playlist of playlists) {
      const result = await this.downloadPlaylist(playlist.id);
      totalQueued += result.queued;
    }

    return { queued: totalQueued, playlists: playlists.length };
  }

  async downloadSingleVideo(url, channelId = null) {
    const videoInfo = await this.ytdlp.getVideoInfo(url);
    
    // Add to database
    const videoData = {
      channel_id: channelId,
      playlist_id: null,
      video_id: videoInfo.id,
      video_title: videoInfo.title,
      video_url: url,
      uploader: videoInfo.uploader,
      upload_date: videoInfo.upload_date,
      duration: videoInfo.duration,
      download_status: 'pending'
    };

    this.db.addVideo(videoData);

    const channel = channelId ? this.db.getChannel(channelId) : null;
    const outputTemplate = channel && !channel.flat_mode
      ? '%(uploader)s [%(channel_id)s]/%(title)s [%(id)s].%(ext)s'
      : '%(uploader)s [%(channel_id)s]/%(title)s [%(id)s].%(ext)s';

    const downloadOptions = {
      outputPath: this.downloadsPath,
      outputTemplate,
      format: 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080] / best',
      mergeOutputFormat: 'mp4',
      writeInfoJson: true,
      noRestrictFilenames: true,
      writeThumbnail: true,
      customArgs: channel?.yt_dlp_options
    };

    this.queue.push({
      videoId: videoInfo.id,
      playlistId: null,
      channelId: channelId,
      url: url,
      options: downloadOptions
    });

    if (!this.isProcessing) {
      this.startDownloads();
    }

    return { video_id: videoInfo.id };
  }

  getQueueStatus() {
    return {
      queue: this.queue.length,
      active: this.activeDownloads.size,
      downloads: Array.from(this.activeDownloads.entries()).map(([id, info]) => ({
        video_id: id,
        progress: info.progress,
        elapsed: Math.floor((Date.now() - info.startTime) / 1000)
      }))
    };
  }
}

module.exports = DownloadManager;
