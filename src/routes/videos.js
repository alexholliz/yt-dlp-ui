const { Router } = require('express');
const path = require('path');
const asyncHandler = require('../middleware/async-handler');
const { removeFromArchive, clearArchive } = require('../utils/archive');
const { deleteVideoFiles } = require('../utils/file-cleanup');
const logger = require('../logger');

/**
 * @param {{ db, DOWNLOADS_PATH: string }} services
 */
module.exports = function videosRouter({ db, DOWNLOADS_PATH }) {
  const router = Router();

  // Get a single video by ID
  router.get('/:videoId', asyncHandler(async (req, res) => {
    const video = db.getVideo(req.params.videoId);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
  }));

  // Delete a single video
  router.delete('/:id', asyncHandler(async (req, res) => {
    const deleteFiles = req.query.deleteFiles === 'true';
    const archivePath = path.join(DOWNLOADS_PATH, '.downloaded');

    const videoResult = db.db.exec('SELECT * FROM videos WHERE video_id = ?', [req.params.id]);
    if (videoResult.length === 0 || videoResult[0].values.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }
    const video = db.rowToObject(videoResult[0].columns, videoResult[0].values[0]);

    if (deleteFiles) deleteVideoFiles(video.file_path);

    removeFromArchive(archivePath, req.params.id);

    db.db.run('DELETE FROM videos WHERE video_id = ?', [req.params.id]);
    db.save();
    db.invalidateStatsCache();

    const message = deleteFiles ? 'Video and files deleted' : 'Video removed from database (files preserved)';
    res.json({ success: true, message });
  }));

  // Force redownload a video
  router.post('/:id/redownload', asyncHandler(async (req, res) => {
    removeFromArchive(path.join(DOWNLOADS_PATH, '.downloaded'), req.params.id);
    db.updateVideoStatus(req.params.id, 'pending', null, null, 0, null);
    res.json({ success: true, message: 'Video queued for redownload' });
  }));

  // Delete all videos (cleanup/testing)
  router.delete('/', asyncHandler(async (req, res) => {
    clearArchive(path.join(DOWNLOADS_PATH, '.downloaded'));
    db.db.run('DELETE FROM videos');
    db.save();
    res.json({ success: true, message: 'All videos deleted' });
  }));

  return router;
};
