const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DB {
  constructor(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initTables();
  }

  initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        channel_id TEXT,
        channel_name TEXT,
        playlist_mode TEXT DEFAULT 'enumerate',
        flat_mode BOOLEAN DEFAULT 0,
        auto_add_new_playlists BOOLEAN DEFAULT 0,
        yt_dlp_options TEXT,
        rescrape_interval_days INTEGER DEFAULT 7,
        last_scraped_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER,
        playlist_id TEXT NOT NULL,
        playlist_title TEXT,
        playlist_url TEXT,
        enabled BOOLEAN DEFAULT 0,
        last_scraped_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        UNIQUE(channel_id, playlist_id)
      );

      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER,
        playlist_id INTEGER,
        video_id TEXT NOT NULL UNIQUE,
        video_title TEXT,
        video_url TEXT,
        uploader TEXT,
        upload_date TEXT,
        duration INTEGER,
        playlist_index INTEGER,
        download_status TEXT DEFAULT 'pending',
        downloaded_at INTEGER,
        file_path TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_channels_url ON channels(url);
      CREATE INDEX IF NOT EXISTS idx_playlists_channel ON playlists(channel_id);
      CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);
      CREATE INDEX IF NOT EXISTS idx_videos_playlist ON videos(playlist_id);
      CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(download_status);
    `);
  }

  // Channels
  addChannel(url, options = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO channels (url, playlist_mode, flat_mode, auto_add_new_playlists, yt_dlp_options, rescrape_interval_days)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      url,
      options.playlist_mode || 'enumerate',
      options.flat_mode ? 1 : 0,
      options.auto_add_new_playlists ? 1 : 0,
      options.yt_dlp_options || null,
      options.rescrape_interval_days || 7
    );
    return result.lastInsertRowid;
  }

  getChannel(id) {
    return this.db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
  }

  getAllChannels() {
    return this.db.prepare('SELECT * FROM channels ORDER BY created_at DESC').all();
  }

  updateChannel(id, data) {
    const fields = [];
    const values = [];
    
    if (data.channel_id !== undefined) {
      fields.push('channel_id = ?');
      values.push(data.channel_id);
    }
    if (data.channel_name !== undefined) {
      fields.push('channel_name = ?');
      values.push(data.channel_name);
    }
    if (data.last_scraped_at !== undefined) {
      fields.push('last_scraped_at = ?');
      values.push(data.last_scraped_at);
    }
    if (data.playlist_mode !== undefined) {
      fields.push('playlist_mode = ?');
      values.push(data.playlist_mode);
    }
    if (data.flat_mode !== undefined) {
      fields.push('flat_mode = ?');
      values.push(data.flat_mode ? 1 : 0);
    }
    if (data.auto_add_new_playlists !== undefined) {
      fields.push('auto_add_new_playlists = ?');
      values.push(data.auto_add_new_playlists ? 1 : 0);
    }
    if (data.yt_dlp_options !== undefined) {
      fields.push('yt_dlp_options = ?');
      values.push(data.yt_dlp_options);
    }

    fields.push('updated_at = strftime("%s", "now")');
    values.push(id);

    const stmt = this.db.prepare(`UPDATE channels SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  }

  deleteChannel(id) {
    return this.db.prepare('DELETE FROM channels WHERE id = ?').run(id);
  }

  // Playlists
  addPlaylist(channelId, playlistData) {
    const stmt = this.db.prepare(`
      INSERT INTO playlists (channel_id, playlist_id, playlist_title, playlist_url, enabled)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(channel_id, playlist_id) DO UPDATE SET
        playlist_title = excluded.playlist_title,
        playlist_url = excluded.playlist_url,
        updated_at = strftime('%s', 'now')
    `);
    return stmt.run(
      channelId,
      playlistData.playlist_id,
      playlistData.playlist_title,
      playlistData.playlist_url,
      playlistData.enabled ? 1 : 0
    );
  }

  getPlaylistsByChannel(channelId) {
    return this.db.prepare('SELECT * FROM playlists WHERE channel_id = ? ORDER BY playlist_title').all(channelId);
  }

  updatePlaylistEnabled(id, enabled) {
    return this.db.prepare('UPDATE playlists SET enabled = ?, updated_at = strftime("%s", "now") WHERE id = ?').run(enabled ? 1 : 0, id);
  }

  // Videos
  addVideo(videoData) {
    const stmt = this.db.prepare(`
      INSERT INTO videos (
        channel_id, playlist_id, video_id, video_title, video_url,
        uploader, upload_date, duration, playlist_index, download_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(video_id) DO UPDATE SET
        video_title = excluded.video_title,
        updated_at = strftime('%s', 'now')
    `);
    return stmt.run(
      videoData.channel_id,
      videoData.playlist_id || null,
      videoData.video_id,
      videoData.video_title,
      videoData.video_url,
      videoData.uploader,
      videoData.upload_date,
      videoData.duration,
      videoData.playlist_index || null,
      videoData.download_status || 'pending'
    );
  }

  getVideosByChannel(channelId) {
    return this.db.prepare('SELECT * FROM videos WHERE channel_id = ? ORDER BY created_at DESC').all(channelId);
  }

  getVideosByPlaylist(playlistId) {
    return this.db.prepare('SELECT * FROM videos WHERE playlist_id = ? ORDER BY playlist_index, created_at').all(playlistId);
  }

  updateVideoStatus(videoId, status, filePath = null, downloadedAt = null) {
    const stmt = this.db.prepare(`
      UPDATE videos 
      SET download_status = ?, file_path = ?, downloaded_at = ?, updated_at = strftime('%s', 'now')
      WHERE video_id = ?
    `);
    return stmt.run(status, filePath, downloadedAt, videoId);
  }

  close() {
    this.db.close();
  }
}

module.exports = DB;
