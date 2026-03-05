const { Router } = require('express');
const path = require('path');
const asyncHandler = require('../middleware/async-handler');
const { removeFromArchive } = require('../utils/archive');
const { deleteVideoFiles, pruneEmptyDirectory } = require('../utils/file-cleanup');
const logger = require('../logger');

/**
 * @param {{ db, ytdlp, downloadManager, DOWNLOADS_PATH: string }} services
 */
module.exports = function playlistsRouter({ db, ytdlp, downloadManager, DOWNLOADS_PATH }) {
  const router = Router();

  // Update playlist enabled status
  router.put('/:id', asyncHandler(async (req, res) => {
    const { enabled } = req.body;
    db.updatePlaylistEnabled(req.params.id, enabled);
    res.json({ success: true });
  }));

  // Get videos for a playlist
  router.get('/:id/videos', asyncHandler(async (req, res) => {
    const playlist = db.getPlaylist(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    const videos = db.getVideosByPlaylist(req.params.id);
    const total_size = videos
      .filter(v => v.download_status === 'completed')
      .reduce((sum, v) => sum + (v.file_size || 0), 0);

    res.json({ playlist: { ...playlist, total_size }, videos });
  }));

  // Delete all videos in a playlist
  router.delete('/:id/videos', asyncHandler(async (req, res) => {
    const deleteFiles = req.query.deleteFiles === 'true';
    const playlist = db.getPlaylist(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    const videos = db.getVideosByPlaylist(req.params.id);
    const archivePath = path.join(DOWNLOADS_PATH, '.downloaded');
    let deletedFiles = 0;
    let playlistDir = null;

    if (deleteFiles) {
      videos.forEach(video => {
        if (!playlistDir && video.file_path) {
          playlistDir = require('path').dirname(video.file_path);
        }
        if (deleteVideoFiles(video.file_path)) deletedFiles++;
      });

      if (playlistDir) pruneEmptyDirectory(playlistDir);
    }

    removeFromArchive(archivePath, videos.map(v => v.video_id));

    db.db.run('DELETE FROM videos WHERE playlist_id = ?', [req.params.id]);
    db.save();
    db.invalidateStatsCache();

    const message = deleteFiles
      ? `Deleted ${videos.length} videos and ${deletedFiles} files`
      : `Removed ${videos.length} videos from database (files preserved)`;

    logger.info(message);
    res.json({ success: true, message, deleted_count: videos.length, channel_id: playlist.channel_id });
  }));

  // Enumerate / refresh a single playlist
  router.post('/:id/enumerate', asyncHandler(async (req, res) => {
    const playlist = db.getPlaylist(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

    const videos = await ytdlp.enumeratePlaylistVideos(playlist.playlist_url);
    db.db.run(
      'UPDATE playlists SET video_count = ?, updated_at = strftime("%s", "now") WHERE id = ?',
      [videos.length, req.params.id]
    );
    db.save();

    logger.info(`Refreshed ${playlist.playlist_title}: ${videos.length} videos`);
    res.json({ id: playlist.id, playlist_title: playlist.playlist_title, video_count: videos.length });
  }));

  // Start downloading a playlist
  router.post('/:id/download', asyncHandler(async (req, res) => {
    const result = await downloadManager.downloadPlaylist(parseInt(req.params.id));
    res.json(result);
  }));

  return router;
};
