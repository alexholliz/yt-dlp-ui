const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

class DB {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.ready = this.init();
  }

  async init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const SQL = await initSqlJs();
    
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
    
    this.initTables();
    this.save();
  }

  save() {
    if (this.db) {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, data);
    }
  }

  initTables() {
    this.db.run(`
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
    stmt.run([
      url,
      options.playlist_mode || 'enumerate',
      options.flat_mode ? 1 : 0,
      options.auto_add_new_playlists ? 1 : 0,
      options.yt_dlp_options || null,
      options.rescrape_interval_days || 7
    ]);
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    this.save();
    return result[0].values[0][0];
  }

  getChannel(id) {
    const result = this.db.exec('SELECT * FROM channels WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.rowToObject(result[0].columns, result[0].values[0]);
  }

  getAllChannels() {
    const result = this.db.exec('SELECT * FROM channels ORDER BY created_at DESC');
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
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

    this.db.run(`UPDATE channels SET ${fields.join(', ')} WHERE id = ?`, values);
    this.save();
  }

  deleteChannel(id) {
    this.db.run('DELETE FROM channels WHERE id = ?', [id]);
    this.save();
  }

  // Playlists
  addPlaylist(channelId, playlistData) {
    this.db.run(`
      INSERT INTO playlists (channel_id, playlist_id, playlist_title, playlist_url, enabled)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(channel_id, playlist_id) DO UPDATE SET
        playlist_title = excluded.playlist_title,
        playlist_url = excluded.playlist_url,
        updated_at = strftime('%s', 'now')
    `, [
      channelId,
      playlistData.playlist_id,
      playlistData.playlist_title,
      playlistData.playlist_url,
      playlistData.enabled ? 1 : 0
    ]);
    this.save();
  }

  getPlaylistsByChannel(channelId) {
    const result = this.db.exec('SELECT * FROM playlists WHERE channel_id = ? ORDER BY playlist_title', [channelId]);
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  getPlaylist(id) {
    const result = this.db.exec('SELECT * FROM playlists WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.rowToObject(result[0].columns, result[0].values[0]);
  }

  updatePlaylistEnabled(id, enabled) {
    this.db.run('UPDATE playlists SET enabled = ?, updated_at = strftime("%s", "now") WHERE id = ?', [enabled ? 1 : 0, id]);
    this.save();
  }

  // Videos
  addVideo(videoData) {
    this.db.run(`
      INSERT INTO videos (
        channel_id, playlist_id, video_id, video_title, video_url,
        uploader, upload_date, duration, playlist_index, download_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(video_id) DO UPDATE SET
        video_title = excluded.video_title,
        updated_at = strftime('%s', 'now')
    `, [
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
    ]);
    this.save();
  }

  getVideosByChannel(channelId) {
    const result = this.db.exec('SELECT * FROM videos WHERE channel_id = ? ORDER BY created_at DESC', [channelId]);
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  getVideosByPlaylist(playlistId) {
    const result = this.db.exec('SELECT * FROM videos WHERE playlist_id = ? ORDER BY playlist_index, created_at', [playlistId]);
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  updateVideoStatus(videoId, status, filePath = null, downloadedAt = null) {
    this.db.run(`
      UPDATE videos 
      SET download_status = ?, file_path = ?, downloaded_at = ?, updated_at = strftime('%s', 'now')
      WHERE video_id = ?
    `, [status, filePath, downloadedAt, videoId]);
    this.save();
  }

  rowToObject(columns, values) {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = values[i];
    });
    return obj;
  }

  close() {
    this.save();
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DB;
