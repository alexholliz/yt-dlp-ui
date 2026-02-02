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
    
    // Enable WAL mode for better concurrency
    try {
      this.db.run('PRAGMA journal_mode=WAL;');
      console.log('SQLite WAL mode enabled');
    } catch (err) {
      console.warn('Could not enable WAL mode:', err.message);
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
        video_count INTEGER DEFAULT 0,
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
        file_size INTEGER DEFAULT 0,
        error_message TEXT,
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

      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        output_template TEXT NOT NULL,
        format_selection TEXT,
        merge_output_format TEXT,
        additional_args TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);
    
    // Create config table for app settings
    this.db.run(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);
    
    // Initialize default config values if not exists
    this.db.run(`
      INSERT OR IGNORE INTO config (key, value) VALUES 
        ('log_level', 'error'),
        ('log_max_size_kb', '10240'),
        ('log_max_files', '5');
    `);
    
    // Migration: Add verbose and filename_format columns to profiles if they don't exist
    try {
      const result = this.db.exec("PRAGMA table_info(profiles)");
      const columns = result[0]?.values.map(row => row[1]) || [];
      if (!columns.includes('verbose')) {
        this.db.run("ALTER TABLE profiles ADD COLUMN verbose INTEGER DEFAULT 0");
        this.save();
        console.log('Migration: Added verbose column to profiles table');
      }
      if (!columns.includes('filename_format')) {
        this.db.run("ALTER TABLE profiles ADD COLUMN filename_format TEXT DEFAULT '--no-restrict-filenames'");
        this.save();
        console.log('Migration: Added filename_format column to profiles table');
      }
    } catch (err) {
      console.log('Migration check for profiles columns skipped or already applied');
    }
    
    // Migration: Add video_count column if it doesn't exist
    try {
      const result = this.db.exec("PRAGMA table_info(playlists)");
      const columns = result[0]?.values.map(row => row[1]) || [];
      if (!columns.includes('video_count')) {
        this.db.run("ALTER TABLE playlists ADD COLUMN video_count INTEGER DEFAULT 0");
        this.save();
        console.log('Migration: Added video_count column to playlists table');
      }
    } catch (err) {
      console.warn('Migration check failed:', err.message);
    }
    
    // Migration: Add file_size and error_message columns to videos if they don't exist
    try {
      const result = this.db.exec("PRAGMA table_info(videos)");
      const columns = result[0]?.values.map(row => row[1]) || [];
      if (!columns.includes('file_size')) {
        this.db.run("ALTER TABLE videos ADD COLUMN file_size INTEGER DEFAULT 0");
        this.save();
        console.log('Migration: Added file_size column to videos table');
      }
      if (!columns.includes('error_message')) {
        this.db.run("ALTER TABLE videos ADD COLUMN error_message TEXT");
        this.save();
        console.log('Migration: Added error_message column to videos table');
      }
      if (!columns.includes('resolution')) {
        this.db.run("ALTER TABLE videos ADD COLUMN resolution TEXT");
        this.save();
        console.log('Migration: Added resolution column to videos table');
      }
      if (!columns.includes('fps')) {
        this.db.run("ALTER TABLE videos ADD COLUMN fps INTEGER");
        this.save();
        console.log('Migration: Added fps column to videos table');
      }
      if (!columns.includes('vcodec')) {
        this.db.run("ALTER TABLE videos ADD COLUMN vcodec TEXT");
        this.save();
        console.log('Migration: Added vcodec column to videos table');
      }
      if (!columns.includes('acodec')) {
        this.db.run("ALTER TABLE videos ADD COLUMN acodec TEXT");
        this.save();
        console.log('Migration: Added acodec column to videos table');
      }
    } catch (err) {
      console.warn('Migration check for videos failed:', err.message);
    }

    // Migration: Add profile_id to channels
    try {
      const result = this.db.exec("PRAGMA table_info(channels)");
      const columns = result[0]?.values.map(row => row[1]) || [];
      if (!columns.includes('profile_id')) {
        this.db.run("ALTER TABLE channels ADD COLUMN profile_id INTEGER REFERENCES profiles(id)");
        this.save();
        console.log('Migration: Added profile_id column to channels table');
      }
    } catch (err) {
      console.warn('Migration check for channels failed:', err.message);
    }

    // Migration: Add SponsorBlock options to channels
    try {
      const result = this.db.exec("PRAGMA table_info(channels)");
      const columns = result[0]?.values.map(row => row[1]) || [];
      if (!columns.includes('sponsorblock_enabled')) {
        this.db.run("ALTER TABLE channels ADD COLUMN sponsorblock_enabled BOOLEAN DEFAULT 0");
        this.save();
        console.log('Migration: Added sponsorblock_enabled column to channels table');
      }
      if (!columns.includes('sponsorblock_mode')) {
        this.db.run("ALTER TABLE channels ADD COLUMN sponsorblock_mode TEXT DEFAULT 'mark'");
        this.save();
        console.log('Migration: Added sponsorblock_mode column to channels table');
      }
      if (!columns.includes('sponsorblock_categories')) {
        this.db.run("ALTER TABLE channels ADD COLUMN sponsorblock_categories TEXT");
        this.save();
        console.log('Migration: Added sponsorblock_categories column to channels table');
      }
      if (!columns.includes('enabled')) {
        this.db.run("ALTER TABLE channels ADD COLUMN enabled BOOLEAN DEFAULT 1");
        this.save();
        console.log('Migration: Added enabled column to channels table');
      }
      
      // Enhanced yt-dlp options
      if (!columns.includes('download_metadata')) {
        this.db.run("ALTER TABLE channels ADD COLUMN download_metadata BOOLEAN DEFAULT 0");
        this.save();
        console.log('Migration: Added download_metadata column to channels table');
      }
      if (!columns.includes('embed_metadata')) {
        this.db.run("ALTER TABLE channels ADD COLUMN embed_metadata BOOLEAN DEFAULT 1");
        this.save();
        console.log('Migration: Added embed_metadata column to channels table');
      }
      if (!columns.includes('download_thumbnail')) {
        this.db.run("ALTER TABLE channels ADD COLUMN download_thumbnail BOOLEAN DEFAULT 0");
        this.save();
        console.log('Migration: Added download_thumbnail column to channels table');
      }
      if (!columns.includes('embed_thumbnail')) {
        this.db.run("ALTER TABLE channels ADD COLUMN embed_thumbnail BOOLEAN DEFAULT 0");
        this.save();
        console.log('Migration: Added embed_thumbnail column to channels table');
      }
      if (!columns.includes('download_subtitles')) {
        this.db.run("ALTER TABLE channels ADD COLUMN download_subtitles BOOLEAN DEFAULT 0");
        this.save();
        console.log('Migration: Added download_subtitles column to channels table');
      }
      if (!columns.includes('embed_subtitles')) {
        this.db.run("ALTER TABLE channels ADD COLUMN embed_subtitles BOOLEAN DEFAULT 0");
        this.save();
        console.log('Migration: Added embed_subtitles column to channels table');
      }
      if (!columns.includes('subtitle_languages')) {
        this.db.run("ALTER TABLE channels ADD COLUMN subtitle_languages TEXT DEFAULT 'en'");
        this.save();
        console.log('Migration: Added subtitle_languages column to channels table');
      }
      if (!columns.includes('auto_subtitles')) {
        this.db.run("ALTER TABLE channels ADD COLUMN auto_subtitles BOOLEAN DEFAULT 0");
        this.save();
        console.log('Migration: Added auto_subtitles column to channels table');
      }
    } catch (err) {
      console.warn('Migration check failed:', err.message);
    }
  }

  // Profiles
  addProfile(profileData) {
    this.db.run(`
      INSERT INTO profiles (name, output_template, format_selection, merge_output_format, additional_args, verbose, filename_format)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      profileData.name,
      profileData.output_template,
      profileData.format_selection || null,
      profileData.merge_output_format || null,
      profileData.additional_args || null,
      profileData.verbose ? 1 : 0,
      profileData.filename_format || '--no-restrict-filenames'
    ]);
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    this.save();
    return result[0].values[0][0];
  }

  getAllProfiles() {
    const result = this.db.exec('SELECT * FROM profiles ORDER BY name');
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  getProfile(id) {
    const result = this.db.exec('SELECT * FROM profiles WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.rowToObject(result[0].columns, result[0].values[0]);
  }

  updateProfile(id, profileData) {
    const fields = [];
    const values = [];
    
    ['name', 'output_template', 'format_selection', 'merge_output_format', 'additional_args'].forEach(field => {
      if (profileData[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(profileData[field]);
      }
    });
    
    if (profileData.verbose !== undefined) {
      fields.push('verbose = ?');
      values.push(profileData.verbose ? 1 : 0);
    }
    
    if (profileData.filename_format !== undefined) {
      fields.push('filename_format = ?');
      values.push(profileData.filename_format);
    }
    
    if (fields.length === 0) return;
    
    fields.push('updated_at = strftime("%s", "now")');
    values.push(id);
    
    this.db.run(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`, values);
    this.save();
  }

  deleteProfile(id) {
    this.db.run('DELETE FROM profiles WHERE id = ?', [id]);
    this.save();
  }

  // Channels
  addChannel(url, options = {}) {
    const stmt = this.db.prepare(`
      INSERT INTO channels (
        url, playlist_mode, flat_mode, auto_add_new_playlists, yt_dlp_options, 
        rescrape_interval_days, profile_id, sponsorblock_enabled, sponsorblock_mode, sponsorblock_categories,
        download_metadata, embed_metadata, download_thumbnail, embed_thumbnail,
        download_subtitles, embed_subtitles, subtitle_languages, auto_subtitles
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      url,
      options.playlist_mode || 'enumerate',
      options.flat_mode ? 1 : 0,
      options.auto_add_new_playlists ? 1 : 0,
      options.yt_dlp_options || null,
      options.rescrape_interval_days || 7,
      options.profile_id || null,
      options.sponsorblock_enabled ? 1 : 0,
      options.sponsorblock_mode || 'mark',
      options.sponsorblock_categories || null,
      options.download_metadata ? 1 : 0,
      options.embed_metadata ? 1 : 0,
      options.download_thumbnail ? 1 : 0,
      options.embed_thumbnail ? 1 : 0,
      options.download_subtitles ? 1 : 0,
      options.embed_subtitles ? 1 : 0,
      options.subtitle_languages || 'en',
      options.auto_subtitles ? 1 : 0
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
    if (data.profile_id !== undefined) {
      fields.push('profile_id = ?');
      values.push(data.profile_id);
    }
    if (data.sponsorblock_enabled !== undefined) {
      fields.push('sponsorblock_enabled = ?');
      values.push(data.sponsorblock_enabled ? 1 : 0);
    }
    if (data.sponsorblock_mode !== undefined) {
      fields.push('sponsorblock_mode = ?');
      values.push(data.sponsorblock_mode);
    }
    if (data.sponsorblock_categories !== undefined) {
      fields.push('sponsorblock_categories = ?');
      values.push(data.sponsorblock_categories);
    }
    if (data.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(data.enabled ? 1 : 0);
    }
    
    // Enhanced yt-dlp options
    if (data.download_metadata !== undefined) {
      fields.push('download_metadata = ?');
      values.push(data.download_metadata ? 1 : 0);
    }
    if (data.embed_metadata !== undefined) {
      fields.push('embed_metadata = ?');
      values.push(data.embed_metadata ? 1 : 0);
    }
    if (data.download_thumbnail !== undefined) {
      fields.push('download_thumbnail = ?');
      values.push(data.download_thumbnail ? 1 : 0);
    }
    if (data.embed_thumbnail !== undefined) {
      fields.push('embed_thumbnail = ?');
      values.push(data.embed_thumbnail ? 1 : 0);
    }
    if (data.download_subtitles !== undefined) {
      fields.push('download_subtitles = ?');
      values.push(data.download_subtitles ? 1 : 0);
    }
    if (data.embed_subtitles !== undefined) {
      fields.push('embed_subtitles = ?');
      values.push(data.embed_subtitles ? 1 : 0);
    }
    if (data.subtitle_languages !== undefined) {
      fields.push('subtitle_languages = ?');
      values.push(data.subtitle_languages);
    }
    if (data.auto_subtitles !== undefined) {
      fields.push('auto_subtitles = ?');
      values.push(data.auto_subtitles ? 1 : 0);
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
      INSERT INTO playlists (channel_id, playlist_id, playlist_title, playlist_url, video_count, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(channel_id, playlist_id) DO UPDATE SET
        playlist_title = excluded.playlist_title,
        playlist_url = excluded.playlist_url,
        updated_at = strftime('%s', 'now')
    `, [
      channelId,
      playlistData.playlist_id,
      playlistData.playlist_title,
      playlistData.playlist_url,
      playlistData.video_count || 0,
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
    try {
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
        videoData.uploader || null,
        videoData.upload_date || null,
        videoData.duration || null,
        videoData.playlist_index || null,
        videoData.download_status || 'pending'
      ]);
      this.save();
    } catch (err) {
      console.error('addVideo failed for', videoData.video_id, ':', err);
      throw new Error(`Failed to add video to database: ${err.message || err.toString()}`);
    }
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

  getVideo(videoId) {
    const result = this.db.exec(`
      SELECT v.*, c.channel_name, p.playlist_title
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      LEFT JOIN playlists p ON v.playlist_id = p.id
      WHERE v.video_id = ?
    `, [videoId]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return this.rowToObject(result[0].columns, result[0].values[0]);
  }

  updateVideoStatus(videoId, status, filePath = null, downloadedAt = null, fileSize = 0, errorMessage = null) {
    this.db.run(`
      UPDATE videos 
      SET download_status = ?, file_path = ?, downloaded_at = ?, file_size = ?, error_message = ?, updated_at = strftime('%s', 'now')
      WHERE video_id = ?
    `, [status, filePath, downloadedAt, fileSize, errorMessage, videoId]);
    this.save();
  }

  updateVideoMetadata(videoId, metadata) {
    const { upload_date, resolution, fps, vcodec, acodec } = metadata;
    this.db.run(`
      UPDATE videos 
      SET upload_date = ?, resolution = ?, fps = ?, vcodec = ?, acodec = ?, updated_at = strftime('%s', 'now')
      WHERE video_id = ?
    `, [upload_date || null, resolution || null, fps || null, vcodec || null, acodec || null, videoId]);
    this.save();
  }
  
  getPendingVideos(limit = 10, offset = 0) {
    const result = this.db.exec(`
      SELECT v.*, c.channel_name, p.playlist_title
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      LEFT JOIN playlists p ON v.playlist_id = p.id
      WHERE v.download_status = 'pending'
      ORDER BY v.created_at ASC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  // Statistics
  getStats() {
    const channelCount = this.db.exec('SELECT COUNT(*) as count FROM channels');
    const totalDownloads = this.db.exec("SELECT COUNT(*) as count FROM videos WHERE download_status = 'completed'");
    const pendingDownloads = this.db.exec("SELECT COUNT(*) as count FROM videos WHERE download_status = 'pending'");
    const librarySizeResult = this.db.exec("SELECT SUM(file_size) as total FROM videos WHERE download_status = 'completed'");
    
    const librarySize = librarySizeResult[0]?.values[0]?.[0] || 0;
    
    return {
      channel_count: channelCount[0]?.values[0]?.[0] || 0,
      total_downloads: totalDownloads[0]?.values[0]?.[0] || 0,
      pending_downloads: pendingDownloads[0]?.values[0]?.[0] || 0,
      library_size: librarySize
    };
  }

  getRecentDownloads(limit = 5, offset = 0, status = null) {
    let query = `
      SELECT v.*, c.channel_name, p.playlist_title
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      LEFT JOIN playlists p ON v.playlist_id = p.id
    `;
    
    const params = [];
    if (status) {
      query += ` WHERE v.download_status = ?`;
      params.push(status);
    } else {
      query += ` WHERE v.download_status IN ('completed', 'failed')`;
    }
    
    query += ` ORDER BY v.updated_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const result = this.db.exec(query, params);
    
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  getChannelStats() {
    const result = this.db.exec(`
      SELECT 
        c.id,
        c.channel_name,
        c.url,
        c.playlist_mode,
        c.last_scraped_at,
        c.enabled,
        COUNT(CASE WHEN v.download_status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN v.download_status = 'completed' THEN 1 END) as completed_count,
        SUM(CASE WHEN v.download_status = 'completed' THEN v.file_size ELSE 0 END) as total_size,
        (SELECT COUNT(*) FROM playlists WHERE channel_id = c.id) as playlist_count
      FROM channels c
      LEFT JOIN videos v ON c.id = v.channel_id
      GROUP BY c.id
      ORDER BY c.channel_name
    `);
    
    if (result.length === 0) return [];
    return result[0].values.map(row => this.rowToObject(result[0].columns, row));
  }

  rowToObject(columns, values) {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = values[i];
    });
    return obj;
  }

  // Config methods
  getConfig(key) {
    const result = this.db.exec('SELECT value FROM config WHERE key = ?', [key]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    return result[0].values[0][0];
  }

  getAllConfig() {
    const result = this.db.exec('SELECT key, value FROM config');
    if (result.length === 0) return {};
    const config = {};
    result[0].values.forEach(row => {
      config[row[0]] = row[1];
    });
    return config;
  }

  setConfig(key, value) {
    this.db.run(`
      INSERT INTO config (key, value, updated_at) 
      VALUES (?, ?, strftime('%s', 'now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = strftime('%s', 'now')
    `, [key, value, value]);
    this.save();
  }

  close() {
    this.save();
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DB;
