/**
 * Utilities for deleting video files and their associated sidecar files
 * (thumbnails, .info.json). Centralises repeated deletion logic from server.js.
 */
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const THUMB_EXTENSIONS = ['.jpg', '.png', '.webp'];

/**
 * Delete a video file plus its .info.json and thumbnail sidecars.
 * @param {string} filePath - Absolute path to the video file.
 * @returns {boolean} True if the main file was deleted.
 */
function deleteVideoFiles(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;

  const base = filePath.replace(/\.[^.]+$/, '');

  // Main video file
  try {
    fs.unlinkSync(filePath);
    logger.info(`Deleted file: ${filePath}`);
  } catch (err) {
    logger.error(`Failed to delete file ${filePath}:`, err.message);
    return false;
  }

  // .info.json
  const infoJson = `${base}.info.json`;
  if (fs.existsSync(infoJson)) {
    try { fs.unlinkSync(infoJson); } catch (_) { /* best-effort */ }
  }

  // Thumbnails
  for (const ext of THUMB_EXTENSIONS) {
    const thumb = `${base}${ext}`;
    if (fs.existsSync(thumb)) {
      try { fs.unlinkSync(thumb); } catch (_) { /* best-effort */ }
    }
  }

  return true;
}

/**
 * Delete a directory if it contains no non-metadata files.
 * @param {string} dir - Absolute path to the directory.
 */
function pruneEmptyDirectory(dir) {
  if (!dir || !fs.existsSync(dir)) return;

  try {
    const entries = fs.readdirSync(dir);
    const nonMeta = entries.filter(f =>
      !f.endsWith('.info.json') && !f.endsWith('.jpg') && !f.endsWith('.png') && !f.endsWith('.webp')
    );

    if (nonMeta.length === 0) {
      entries.forEach(f => {
        try { fs.unlinkSync(path.join(dir, f)); } catch (_) { /* best-effort */ }
      });
      fs.rmdirSync(dir);
      logger.info(`Deleted empty directory: ${dir}`);
    }
  } catch (err) {
    logger.error(`Failed to prune directory ${dir}:`, err.message);
  }
}

module.exports = { deleteVideoFiles, pruneEmptyDirectory };
