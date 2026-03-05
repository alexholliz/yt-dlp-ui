const { Router } = require('express');
const path = require('path');
const asyncHandler = require('../middleware/async-handler');
const { removeFromArchive } = require('../utils/archive');
const logger = require('../logger');

/**
 * Handles both /api/download/* and /api/downloads/* routes.
 * Mount at /api/download AND at /api/downloads.
 *
 * @param {{ db, downloadManager, DOWNLOADS_PATH: string }} services
 */
module.exports = function downloadsRouter({ db, downloadManager, DOWNLOADS_PATH }) {
  const router = Router();

  // Recent downloads with pagination and optional status filter (/api/downloads/recent)
  router.get('/recent', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status;
    res.json(db.getRecentDownloads(limit, offset, status));
  }));

  // Download queue - pending videos (/api/download/queue)
  router.get('/queue', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    res.json(db.getPendingVideos(limit, offset));
  }));

  // Active download status (/api/download/status)
  router.get('/status', asyncHandler(async (req, res) => {
    const status = downloadManager.getQueueStatus();
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
  }));

  // Manually start downloads (/api/download/start)
  router.post('/start', asyncHandler(async (req, res) => {
    if (!downloadManager.isProcessing) {
      downloadManager.startDownloads();
      return res.json({ success: true, message: 'Downloads started' });
    }
    res.json({ success: true, message: 'Downloads already running' });
  }));

  // Retry all failed downloads (/api/download/retry-failed)
  router.post('/retry-failed', asyncHandler(async (req, res) => {
    const archivePath = path.join(DOWNLOADS_PATH, '.downloaded');
    const failedVideos = db.getRecentDownloads(1000, 0, 'failed');

    removeFromArchive(archivePath, failedVideos.map(v => v.video_id));
    failedVideos.forEach(v => db.updateVideoStatus(v.video_id, 'pending', null, null, 0, null));

    if (!downloadManager.isProcessing) downloadManager.startDownloads();
    res.json({ success: true, count: failedVideos.length });
  }));

  // Download a single video by URL (/api/download/video)
  router.post('/video', asyncHandler(async (req, res) => {
    const { url, channelId } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const result = await downloadManager.downloadSingleVideo(url, channelId || null);
    res.json(result);
  }));

  return router;
};

