const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const asyncHandler = require('../middleware/async-handler');
const logger = require('../logger');

/**
 * @param {{ db, ytdlp, downloadManager, DOWNLOADS_PATH: string }} services
 */
module.exports = function channelsRouter({ db, ytdlp, downloadManager, DOWNLOADS_PATH }) {
  const router = Router();

  // List all channels (with total_size per channel)
  router.get('/', asyncHandler(async (req, res) => {
    const channels = db.getAllChannels();
    const channelsWithSize = channels.map(channel => {
      const videos = db.getVideosByChannel(channel.id).filter(v => v.download_status === 'completed');
      const total_size = videos.reduce((sum, v) => sum + (v.file_size || 0), 0);
      return { ...channel, total_size };
    });
    res.json(channelsWithSize);
  }));

  // Get single channel
  router.get('/:id', asyncHandler(async (req, res) => {
    const channel = db.getChannel(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    res.json(channel);
  }));

  // Add channel / single video
  router.post('/', asyncHandler(async (req, res) => {
    const {
      url, playlist_mode, flat_mode, auto_add_new_playlists, yt_dlp_options,
      rescrape_interval_days, profile_id,
      download_metadata, embed_metadata, download_thumbnail, embed_thumbnail,
      download_subtitles, embed_subtitles, subtitle_languages, auto_subtitles,
      sponsorblock_enabled, sponsorblock_mode, sponsorblock_categories
    } = req.body;

    if (!url) return res.status(400).json({ error: 'URL is required' });

    const urlType = ytdlp.detectUrlType(url);
    let finalPlaylistMode = playlist_mode || 'enumerate';
    let playlistsOnly = false;

    if (urlType === 'video') {
      const result = await downloadManager.downloadSingleVideo(url, null);
      return res.json({ type: 'video', video_id: result.video_id });
    }

    if (urlType === 'playlist') {
      finalPlaylistMode = 'enumerate';
    }

    if (urlType === 'channel_playlists_only') {
      finalPlaylistMode = 'enumerate';
      playlistsOnly = true;
    }

    const channelId = db.addChannel(url, {
      playlist_mode: finalPlaylistMode, flat_mode, auto_add_new_playlists,
      yt_dlp_options, rescrape_interval_days, profile_id,
      download_metadata, embed_metadata, download_thumbnail, embed_thumbnail,
      download_subtitles, embed_subtitles, subtitle_languages, auto_subtitles,
      sponsorblock_enabled, sponsorblock_mode, sponsorblock_categories
    });

    if (finalPlaylistMode === 'enumerate') {
      ytdlp.enumeratePlaylists(url)
        .then(result => {
          db.updateChannel(channelId, {
            channel_id: result.channel_id,
            channel_name: result.channel_name,
            last_scraped_at: Math.floor(Date.now() / 1000)
          });
          result.playlists.forEach(playlist => {
            db.addPlaylist(channelId, { ...playlist, enabled: auto_add_new_playlists || false });
          });
          logger.info(`Enumerated ${result.playlists.length} playlists for channel ${channelId}`);
        })
        .catch(err => logger.error(`Failed to enumerate playlists for channel ${channelId}: ${err.message}`));
    }

    res.json({ id: channelId, url, type: urlType, playlistsOnly });
  }));

  // Update channel
  router.put('/:id', asyncHandler(async (req, res) => {
    logger.debug(`PUT /api/channels/${req.params.id} - Body:`, JSON.stringify(req.body));
    const {
      playlist_mode, flat_mode, auto_add_new_playlists, yt_dlp_options, profile_id, enabled,
      download_metadata, embed_metadata, download_thumbnail, embed_thumbnail,
      download_subtitles, embed_subtitles, subtitle_languages, auto_subtitles,
      sponsorblock_enabled, sponsorblock_mode, sponsorblock_categories
    } = req.body;

    db.updateChannel(req.params.id, {
      playlist_mode, flat_mode, auto_add_new_playlists, yt_dlp_options, profile_id, enabled,
      download_metadata, embed_metadata, download_thumbnail, embed_thumbnail,
      download_subtitles, embed_subtitles, subtitle_languages, auto_subtitles,
      sponsorblock_enabled, sponsorblock_mode, sponsorblock_categories
    });
    res.json({ success: true });
  }));

  // Delete channel (optionally delete files)
  router.delete('/:id', asyncHandler(async (req, res) => {
    const channelId = req.params.id;
    const deleteFiles = req.query.deleteFiles === 'true';

    if (deleteFiles) {
      const channel = db.getChannel(channelId);
      if (channel && channel.channel_name) {
        const channelPath = path.join(DOWNLOADS_PATH, `${channel.channel_name} [${channel.channel_id}]`);
        if (fs.existsSync(channelPath)) {
          fs.rmSync(channelPath, { recursive: true, force: true });
          logger.info(`Deleted channel folder: ${channelPath}`);
        }
      }
    }

    db.deleteChannel(channelId);
    res.json({ success: true, deletedFiles: deleteFiles });
  }));

  // Re-enumerate playlists for a channel
  router.post('/:id/enumerate', asyncHandler(async (req, res) => {
    const channel = db.getChannel(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    const result = await ytdlp.enumeratePlaylists(channel.url, channel.channel_id);
    db.updateChannel(req.params.id, {
      channel_id: result.channel_id,
      channel_name: result.channel_name,
      last_scraped_at: Math.floor(Date.now() / 1000)
    });

    const playlistsWithCounts = [];
    for (const playlist of result.playlists) {
      db.addPlaylist(req.params.id, { ...playlist, enabled: channel.auto_add_new_playlists || false });

      try {
        const videos = await ytdlp.enumeratePlaylistVideos(playlist.playlist_url);
        db.db.run(
          'UPDATE playlists SET video_count = ?, updated_at = strftime("%s", "now") WHERE channel_id = ? AND playlist_id = ?',
          [videos.length, req.params.id, playlist.playlist_id]
        );
        db.save();
        playlistsWithCounts.push({ ...playlist, video_count: videos.length });
      } catch (err) {
        logger.error(`Failed to get video count for ${playlist.playlist_title}:`, err.message);
        playlistsWithCounts.push(playlist);
      }
    }

    res.json({ playlists: playlistsWithCounts });
  }));

  // Get playlists for a channel (with total_size)
  router.get('/:id/playlists', asyncHandler(async (req, res) => {
    const playlists = db.getPlaylistsByChannel(req.params.id);
    const playlistsWithSize = playlists.map(p => {
      const videos = db.getVideosByPlaylist(p.id).filter(v => v.download_status === 'completed');
      const total_size = videos.reduce((sum, v) => sum + (v.file_size || 0), 0);
      return { ...p, total_size };
    });
    res.json(playlistsWithSize);
  }));

  // Get videos for a channel
  router.get('/:id/videos', asyncHandler(async (req, res) => {
    res.json(db.getVideosByChannel(req.params.id));
  }));

  // Start downloading all enabled playlists for a channel
  router.post('/:id/download', asyncHandler(async (req, res) => {
    const result = await downloadManager.downloadChannel(parseInt(req.params.id));
    res.json(result);
  }));

  return router;
};
