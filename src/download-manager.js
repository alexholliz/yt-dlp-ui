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
    this.concurrency = parseInt(process.env.YT_DL_WORKER_CONCURRENCY || '2');
  }

  async startDownloads() {
    if (this.isProcessing) return;
    
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
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await this.processDownload(task);
      }
    }
  }

  async processDownload(task) {
    const { videoId, playlistId, channelId, url, options } = task;
    const fs = require('fs');

    try {
      // Update status to downloading
      this.db.updateVideoStatus(videoId, 'downloading');
      this.activeDownloads.set(videoId, { progress: 0, startTime: Date.now() });

      // Download the video
      await this.ytdlp.download(url, options, (progress) => {
        const info = this.activeDownloads.get(videoId);
        if (info) {
          info.progress = progress.percent;
          this.activeDownloads.set(videoId, info);
        }
      });

      // Calculate file size
      let fileSize = 0;
      const video = this.db.getVideo(videoId);
      if (video && video.file_path && fs.existsSync(video.file_path)) {
        const stats = fs.statSync(video.file_path);
        fileSize = stats.size;
      }

      // Update status to completed
      const downloadedAt = Math.floor(Date.now() / 1000);
      this.db.updateVideoStatus(videoId, 'completed', null, downloadedAt, fileSize);
      this.activeDownloads.delete(videoId);

      logger.info(`✓ Downloaded: ${videoId}`);
    } catch (err) {
      logger.error(`✗ Failed to download ${videoId}:`, err.message);
      this.db.updateVideoStatus(videoId, 'failed', null, null, 0, err.message);
      this.activeDownloads.delete(videoId);
    }
  }

  async downloadPlaylist(playlistId) {
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

    // Build download options
    const outputTemplate = channel.flat_mode
      ? '%(uploader)s [%(channel_id)s]/%(title)s [%(id)s].%(ext)s'
      : '%(uploader)s [%(channel_id)s]/%(playlist_title)s [%(playlist_id)s]/%(playlist_index)s - %(title)s [%(id)s].%(ext)s';

    const downloadOptions = {
      outputPath: this.downloadsPath,
      outputTemplate,
      format: 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080] / best',
      mergeOutputFormat: 'mp4',
      writeInfoJson: true,
      noRestrictFilenames: true,
      writeThumbnail: true,
      downloadArchive: path.join(this.downloadsPath, '.downloaded'),
      customArgs: channel.yt_dlp_options
    };

    // Queue videos for download
    for (const video of pendingVideos) {
      this.queue.push({
        videoId: video.video_id,
        playlistId: playlistId,
        channelId: channel.id,
        url: video.video_url,
        options: downloadOptions
      });
    }

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startDownloads();
    }

    return { queued: pendingVideos.length };
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
