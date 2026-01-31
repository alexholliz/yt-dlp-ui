const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class YouTubeApiService {
  constructor(configPath = '/config') {
    this.configPath = configPath;
    this.apiKeyFile = path.join(configPath, 'youtube-api-key.txt');
    this.quotaFile = path.join(configPath, 'youtube-api-quota.json');
    this.apiKey = this.loadApiKey();
    this.quotaData = this.loadQuotaData();
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }

  loadApiKey() {
    try {
      if (fs.existsSync(this.apiKeyFile)) {
        return fs.readFileSync(this.apiKeyFile, 'utf8').trim();
      }
    } catch (err) {
      logger.error('Failed to load YouTube API key:', err);
    }
    return null;
  }

  saveApiKey(apiKey) {
    try {
      fs.writeFileSync(this.apiKeyFile, apiKey.trim());
      this.apiKey = apiKey.trim();
      logger.info('YouTube API key saved');
      return true;
    } catch (err) {
      logger.error('Failed to save YouTube API key:', err);
      throw err;
    }
  }

  deleteApiKey() {
    try {
      if (fs.existsSync(this.apiKeyFile)) {
        fs.unlinkSync(this.apiKeyFile);
      }
      this.apiKey = null;
      logger.info('YouTube API key deleted');
      return true;
    } catch (err) {
      logger.error('Failed to delete YouTube API key:', err);
      throw err;
    }
  }

  loadQuotaData() {
    try {
      if (fs.existsSync(this.quotaFile)) {
        const data = JSON.parse(fs.readFileSync(this.quotaFile, 'utf8'));
        // Check if we need to reset (new day)
        const now = new Date();
        const resetTime = new Date(data.resetTime);
        if (now > resetTime) {
          return this.initQuotaData();
        }
        return data;
      }
    } catch (err) {
      logger.error('Failed to load quota data:', err);
    }
    return this.initQuotaData();
  }

  initQuotaData() {
    const data = {
      used: 0,
      limit: 10000,
      resetTime: this.getNextMidnightPacific()
    };
    this.saveQuotaData(data);
    return data;
  }

  saveQuotaData(data) {
    try {
      fs.writeFileSync(this.quotaFile, JSON.stringify(data, null, 2));
    } catch (err) {
      logger.error('Failed to save quota data:', err);
    }
  }

  getNextMidnightPacific() {
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
    this.saveQuotaData(this.quotaData);
    
    logger.debug(`YouTube API quota used: ${cost} units (operation: ${operation})`);
    
    if (this.quotaData.used >= this.quotaData.limit) {
      throw new Error('YouTube API daily quota exceeded. Will reset at midnight Pacific Time.');
    }
  }

  getQuotaStatus() {
    // Reload to get fresh data
    this.quotaData = this.loadQuotaData();
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
    // YouTube API doesn't have a direct handle->channel endpoint
    // We need to use search or fall back to yt-dlp
    throw new Error('Handle resolution not yet implemented, will use yt-dlp fallback');
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

  async enumeratePlaylists(channelUrl) {
    try {
      const channelId = await this.getChannelIdFromUrl(channelUrl);
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
          video_count: item.contentDetails.itemCount,
          playlist_url: `https://www.youtube.com/playlist?list=${item.id}`
        })));

        pageToken = data.nextPageToken;
        pageCount++;
      } while (pageToken);

      logger.info(`YouTube API: Enumerated ${playlists.length} playlists from ${channelId}`);
      return playlists;
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
