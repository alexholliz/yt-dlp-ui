/**
 * Utilities for reading and writing the yt-dlp download archive file.
 * Centralises the repeated read-filter-write pattern from server.js.
 */
const fs = require('fs');
const logger = require('../logger');

/**
 * Remove one or more video IDs from the download archive.
 * @param {string} archivePath - Absolute path to the .downloaded archive file.
 * @param {string|string[]} videoIds - A single video ID or an array of video IDs to remove.
 */
function removeFromArchive(archivePath, videoIds) {
  if (!fs.existsSync(archivePath)) return;

  const ids = Array.isArray(videoIds) ? videoIds : [videoIds];

  try {
    const lines = fs.readFileSync(archivePath, 'utf8').split('\n');
    const filtered = lines.filter(line => !ids.some(id => line.includes(id)));
    fs.writeFileSync(archivePath, filtered.join('\n'));
    logger.info(`Removed ${ids.length} entry/entries from download archive`);
  } catch (err) {
    logger.error('Failed to update download archive:', err.message);
  }
}

/**
 * Clear the entire download archive file.
 * @param {string} archivePath
 */
function clearArchive(archivePath) {
  if (!fs.existsSync(archivePath)) return;
  try {
    fs.unlinkSync(archivePath);
    logger.info('Cleared download archive');
  } catch (err) {
    logger.error('Failed to clear download archive:', err.message);
  }
}

module.exports = { removeFromArchive, clearArchive };
