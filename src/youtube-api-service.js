const logger = require('./logger');
const { encrypt, decrypt } = require('./utils/encryption');

const DB_KEY_API_KEY = 'youtube_api_key';
const DB_KEY_QUOTA   = 'youtube_api_quota';

class YouTubeApiService {
  constructor() {
    this.db = null;
    this.apiKey = null;     // loaded from DB in setDb()
    this.quotaData = null;  // loaded from DB in setDb()
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
    this.ytdlpService = null;
  }

  setYtDlpService(ytdlpService) {
    this.ytdlpService = ytdlpService;
  }

  /** Binds the database, loads API key and quota. Called once inside db.ready.then(). */
  setDb(db) {
    this.db = db;

    // Load API key
    const storedKey = db.getConfig(DB_KEY_API_KEY);
    if (storedKey) {
      try {
        this.apiKey = decrypt(storedKey);
        logger.debug('YouTube API key loaded from database');
      } catch (err) {
        logger.error('Failed to decrypt YouTube API key:', err);
      }
    }

    // Load quota (reset if the day has rolled over, init if missing)
    const storedQuota = db.getConfig(DB_KEY_QUOTA);
    if (storedQuota) {
      try {
        const data = JSON.parse(storedQuota);
        this.quotaData = new Date() > new Date(data.resetTime)
          ? this._initQuota()
          : data;
      } catch (err) {
        logger.error('Failed to parse quota data:', err);
        this.quotaData = this._initQuota();
      }
    } else {
      this.quotaData = this._initQuota();
    }
  }

  saveApiKey(apiKey) {
    const trimmed = apiKey.trim();
    this.db.setConfig(DB_KEY_API_KEY, encrypt(trimmed));
    this.apiKey = trimmed;
    logger.info('YouTube API key saved');
    return true;
  }

  deleteApiKey() {
    this.db.setConfig(DB_KEY_API_KEY, null);
    this.apiKey = null;
    logger.info('YouTube API key deleted');
    return true;
  }

  _initQuota() {
    const data = { used: 0, limit: 10000, resetTime: this._nextMidnightPacific() };
    this._saveQuota(data);
    return data;
  }

  _saveQuota(data) {
    this.db.setConfig(DB_KEY_QUOTA, JSON.stringify(data));
  }

  _nextMidnightPacific() {
    const now = new Date();
    const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const tomorrow = new Date(pacificTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  trackQuotaCost(operation, count = 1) {
    const costs = {
      'channels.list': 1,
      'playlists.list': 1,
      'playlistItems.list': 1
    };
    
    const cost = (costs[operation] || 0) * count;
    this.quotaData.used += cost;
    this._saveQuota(this.quotaData);
    
    logger.debug(`YouTube API quota used: ${cost} units (operation: ${operation})`);
    
    if (this.quotaData.used >= this.quotaData.limit) {
      throw new Error('YouTube API daily quota exceeded. Will reset at midnight Pacific Time.');
    }
  }

  getQuotaStatus() {
    // Re-read from DB to pick up any reset that happened since last load
    const stored = this.db.getConfig(DB_KEY_QUOTA);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.quotaData = new Date() > new Date(data.resetTime) ? this._initQuota() : data;
      } catch { /* leave existing in-memory data */ }
    }
    return {
      used: this.quotaData.used,
      limit: this.quotaData.limit,
      remaining: this.quotaData.limit - this.quotaData.used,
      resetTime: this.quotaData.resetTime
    };
  }

  hasValidApiKey() {
    return this.apiKey && this.apiKey.length > 30; // YouTube API keys are ~39 chars
  }

  async testApiKey(apiKey = null) {
    const keyToTest = apiKey || this.apiKey;
    if (!keyToTest) {
      return { valid: false, error: 'No API key provided' };
    }

    try {
      // Test with a simple channels.list call
      const url = `${this.baseUrl}/channels?part=snippet&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${keyToTest}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        return { valid: false, error: data.error.message };
      }

      return { valid: true, quota: this.getQuotaStatus() };
    } catch (err) {
      logger.error('YouTube API key test failed:', err);
      return { valid: false, error: err.message };
    }
  }

  async getChannelIdFromUrl(channelUrl) {
    // Extract channel identifier from various YouTube URL formats
    const url = channelUrl.trim();
    
    // Direct channel ID: /channel/UC...
    let match = url.match(/\/channel\/(UC[\w-]+)/);
    if (match) return match[1];
    
    // @handle format
    match = url.match(/@([\w-]+)/);
    if (match) {
      const handle = match[1];
      return await this.resolveHandleToChannelId(handle);
    }
    
    // /c/ or /user/ format - need to resolve via API
    match = url.match(/\/(c|user)\/([\w-]+)/);
    if (match) {
      const username = match[2];
      return await this.resolveUsernameToChannelId(username);
    }
    
    throw new Error('Could not extract channel ID from URL');
  }

  async resolveHandleToChannelId(handle) {
    // Use yt-dlp to extract channel ID from handle
    if (!this.ytdlpService) {
      throw new Error('YtDlpService not initialized');
    }
    
    logger.info(`Resolving handle ${handle} to channel ID using yt-dlp`);
    const handleUrl = `https://www.youtube.com/@${handle}`;
    
    try {
      const result = await this.ytdlpService.extractChannelId(handleUrl);
      logger.info(`Resolved @${handle} -> ${result.channel_id}`);
      return result.channel_id;
    } catch (err) {
      logger.error(`Failed to resolve handle @${handle}:`, err);
      throw new Error('Handle resolution failed, will use yt-dlp fallback');
    }
  }

  async resolveUsernameToChannelId(username) {
    try {
      const url = `${this.baseUrl}/channels?part=id&forUsername=${username}&key=${this.apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      this.trackQuotaCost('channels.list');

      if (data.error) {
        throw new Error(data.error.message);
      }

      if (data.items && data.items.length > 0) {
        return data.items[0].id;
      }

      throw new Error('Channel not found');
    } catch (err) {
      logger.error('Failed to resolve username to channel ID:', err);
      throw err;
    }
  }

  async enumeratePlaylistsByChannelId(channelId) {
    try {
      const playlists = [];
      let pageToken = null;
      let pageCount = 0;

      do {
        const url = `${this.baseUrl}/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=50&key=${this.apiKey}${pageToken ? '&pageToken=' + pageToken : ''}`;
        
        logger.debug(`Fetching playlists from YouTube API (page ${pageCount + 1})`);
        const response = await fetch(url);
        const data = await response.json();

        this.trackQuotaCost('playlists.list');

        if (data.error) {
          throw new Error(data.error.message);
        }

        playlists.push(...data.items.map(item => ({
          playlist_id: item.id,
          playlist_title: item.snippet.title,
          playlist_url: `https://www.youtube.com/playlist?list=${item.id}`,
          video_count: item.contentDetails.itemCount || 0
        })));

        pageToken = data.nextPageToken;
        pageCount++;
        
        if (pageCount >= 10) {
          logger.warn('Stopped at 10 pages to prevent infinite loop');
          break;
        }
      } while (pageToken);

      logger.info(`YouTube API: Found ${playlists.length} playlists`);
      return playlists;
    } catch (err) {
      logger.error('YouTube API enumeratePlaylists error:', err);
      throw err;
    }
  }

  async enumeratePlaylists(channelUrl) {
    try {
      const channelId = await this.getChannelIdFromUrl(channelUrl);
      return await this.enumeratePlaylistsByChannelId(channelId);
    } catch (err) {
      logger.error('YouTube API enumeration failed:', err);
      throw err;
    }
  }

  async enumeratePlaylistVideos(playlistId) {
    try {
      const videos = [];
      let pageToken = null;
      let pageCount = 0;

      do {
        const url = `${this.baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${this.apiKey}${pageToken ? '&pageToken=' + pageToken : ''}`;
        
        logger.debug(`Fetching playlist items from YouTube API (page ${pageCount + 1})`);
        const response = await fetch(url);
        const data = await response.json();

        this.trackQuotaCost('playlistItems.list');

        if (data.error) {
          throw new Error(data.error.message);
        }

        videos.push(...data.items.map((item, index) => ({
          video_id: item.contentDetails.videoId,
          video_title: item.snippet.title,
          video_url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`,
          playlist_index: videos.length + index + 1,
          uploader: item.snippet.channelTitle,
          upload_date: item.contentDetails.videoPublishedAt ? new Date(item.contentDetails.videoPublishedAt).toISOString().split('T')[0].replace(/-/g, '') : null
        })));

        pageToken = data.nextPageToken;
        pageCount++;
      } while (pageToken);

      logger.info(`YouTube API: Enumerated ${videos.length} videos from playlist ${playlistId}`);
      return videos;
    } catch (err) {
      logger.error('YouTube API playlist enumeration failed:', err);
      throw err;
    }
  }
}

module.exports = YouTubeApiService;
