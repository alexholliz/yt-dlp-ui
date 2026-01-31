const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class YtDlpService {
  constructor(cookiesPath, youtubeApiService = null) {
    this.cookiesPath = cookiesPath;
    this.youtubeApi = youtubeApiService;
  }

  // Parse command line arguments respecting quotes
  parseArgs(argsString) {
    if (!argsString) return [];
    
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;
    
    for (let i = 0; i < argsString.length; i++) {
      const char = argsString[i];
      
      if ((char === '"' || char === "'") && (i === 0 || argsString[i-1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        } else {
          current += char;
        }
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      args.push(current);
    }
    
    return args;
  }

  detectUrlType(url) {
    // Single video
    if (url.includes('/watch?v=') || url.includes('youtu.be/')) {
      return 'video';
    }
    // Playlist
    if (url.includes('/playlist?list=')) {
      return 'playlist';
    }
    // Channel with /playlists endpoint
    if (url.includes('/playlists')) {
      return 'channel_playlists_only';
    }
    // Regular channel
    if (url.includes('/@') || url.includes('/channel/') || url.includes('/c/') || url.includes('/user/')) {
      return 'channel';
    }
    return 'unknown';
  }

  async enumeratePlaylists(channelUrl) {
    // Try YouTube API first if available
    if (this.youtubeApi && this.youtubeApi.hasValidApiKey()) {
      try {
        logger.info('Attempting enumeration with YouTube Data API');
        const playlists = await this.youtubeApi.enumeratePlaylists(channelUrl);
        
        // Extract channel info from URL as best we can
        const channelIdMatch = channelUrl.match(/\/channel\/(UC[\w-]+)/);
        const handleMatch = channelUrl.match(/@([\w-]+)/);
        
        return {
          channel_id: channelIdMatch ? channelIdMatch[1] : null,
          channel_name: handleMatch ? handleMatch[1] : null,
          playlists,
          method: 'youtube-api'
        };
      } catch (err) {
        logger.warn('YouTube API enumeration failed, falling back to yt-dlp:', err.message);
        // Fall through to yt-dlp method
      }
    }

    // Fallback to yt-dlp web scraping
    logger.info('Using yt-dlp for enumeration (no API key or API failed)');
    
    return new Promise((resolve, reject) => {
      // Remove /playlists suffix if present, and also remove trailing slash
      const cleanUrl = channelUrl.replace(/\/playlists\/?$/, '').replace(/\/$/, '');
      
      const args = [
        '--dump-json',
        '--flat-playlist',
        '--skip-download',
        '--extractor-args', 'youtubetab:approximate_date'
      ];

      if (fs.existsSync(this.cookiesPath)) {
        args.push('--cookies', this.cookiesPath);
      }

      // For channels, we need to get the /playlists tab
      args.push(cleanUrl + '/playlists');

      const ytdlp = spawn('yt-dlp', args);
      let stdout = '';
      let stderr = '';

      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`yt-dlp failed: ${stderr}`));
        }

        try {
          const lines = stdout.trim().split('\n').filter(line => line);
          if (lines.length === 0) {
            return resolve({ channel_id: null, channel_name: null, playlists: [], method: 'yt-dlp' });
          }

          const entries = lines.map(line => JSON.parse(line));
          
          // Extract channel info and playlists
          const playlistMap = new Map();
          let channelInfo = {
            channel_id: null,
            channel_name: null
          };

          entries.forEach(entry => {
            // Get channel info from first entry
            if (!channelInfo.channel_id) {
              channelInfo.channel_id = entry.channel_id || entry.playlist_channel_id;
              channelInfo.channel_name = entry.channel || entry.uploader || entry.playlist_uploader || entry.uploader_id;
            }

            // Each entry in /playlists is itself a playlist
            if (entry.id && entry._type === 'url') {
              const playlistId = entry.url ? entry.url.split('list=')[1] : entry.id;
              if (playlistId && !playlistMap.has(playlistId)) {
                playlistMap.set(playlistId, {
                  playlist_id: playlistId,
                  playlist_title: entry.title || 'Untitled Playlist',
                  playlist_url: `https://www.youtube.com/playlist?list=${playlistId}`,
                  video_count: entry.playlist_count || 0
                });
              }
            }
          });

          // Fallback: extract channel name from URL if not found
          if (!channelInfo.channel_name && cleanUrl.includes('/@')) {
            const match = cleanUrl.match(/@([^\/]+)/);
            if (match) {
              channelInfo.channel_name = match[1];
            }
          }

          resolve({
            ...channelInfo,
            playlists: Array.from(playlistMap.values()),
            method: 'yt-dlp'
          });
        } catch (err) {
          reject(new Error(`Failed to parse yt-dlp output: ${err.message}`));
        }
      });
    });
  }

  async getVideoInfo(url) {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--skip-download'
      ];

      if (fs.existsSync(this.cookiesPath)) {
        args.push('--cookies', this.cookiesPath);
      }

      args.push(url);

      const ytdlp = spawn('yt-dlp', args);
      let stdout = '';
      let stderr = '';

      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`yt-dlp failed: ${stderr}`));
        }

        try {
          const info = JSON.parse(stdout);
          resolve(info);
        } catch (err) {
          reject(new Error(`Failed to parse video info: ${err.message}`));
        }
      });
    });
  }

  async enumeratePlaylistVideos(playlistUrl) {
    // Try YouTube API first if available
    if (this.youtubeApi && this.youtubeApi.hasValidApiKey()) {
      try {
        // Extract playlist ID from URL
        const playlistIdMatch = playlistUrl.match(/[?&]list=([^&]+)/);
        if (playlistIdMatch) {
          logger.info('Attempting playlist enumeration with YouTube Data API');
          const videos = await this.youtubeApi.enumeratePlaylistVideos(playlistIdMatch[1]);
          return videos;
        }
      } catch (err) {
        logger.warn('YouTube API playlist enumeration failed, falling back to yt-dlp:', err.message);
        // Fall through to yt-dlp method
      }
    }

    // Fallback to yt-dlp web scraping
    logger.info('Using yt-dlp for playlist enumeration (no API key or API failed)');
    
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--flat-playlist',
        '--skip-download'
      ];

      if (fs.existsSync(this.cookiesPath)) {
        args.push('--cookies', this.cookiesPath);
      }

      args.push(playlistUrl);

      const ytdlp = spawn('yt-dlp', args);
      let stdout = '';
      let stderr = '';

      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`yt-dlp failed: ${stderr}`));
        }

        try {
          const lines = stdout.trim().split('\n').filter(line => line);
          const videos = lines.map(line => {
            const entry = JSON.parse(line);
            return {
              video_id: entry.id,
              video_title: entry.title,
              video_url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
              uploader: entry.uploader || entry.channel,
              upload_date: entry.upload_date,
              duration: entry.duration,
              playlist_index: entry.playlist_index
            };
          });

          resolve(videos);
        } catch (err) {
          reject(new Error(`Failed to parse playlist videos: ${err.message}`));
        }
      });
    });
  }

  async download(url, options = {}, onProgress = null) {
    return new Promise((resolve, reject) => {
      const args = [];

      if (fs.existsSync(this.cookiesPath)) {
        args.push('--cookies', this.cookiesPath);
      }
      
      // Enable Node.js runtime for YouTube's JavaScript challenges
      args.push('--js-runtimes', 'node');
      
      // Download remote challenge solver components
      args.push('--remote-components', 'ejs:github');

      if (options.verbose) {
        args.push('-v');
      }

      if (options.dateAfter) {
        args.push('--dateafter', options.dateAfter);
      }

      if (options.downloadArchive) {
        args.push('--download-archive', options.downloadArchive);
      }

      if (options.outputPath) {
        args.push('-P', options.outputPath);
      }

      if (options.outputTemplate) {
        args.push('-o', options.outputTemplate);
      }

      if (options.format) {
        args.push('-f', options.format);
      }

      if (options.mergeOutputFormat) {
        args.push('--merge-output-format', options.mergeOutputFormat);
      }

      if (options.writeInfoJson) {
        args.push('--write-info-json');
      }

      if (options.noRestrictFilenames) {
        args.push('--no-restrict-filenames');
      }

      if (options.writeThumbnail) {
        args.push('--write-thumbnail');
      }

      // If playlist item index is specified, only download that specific item
      if (options.playlistItemIndex) {
        args.push('--playlist-items', options.playlistItemIndex.toString());
      }

      // Print file path after download for capturing
      args.push('--print', 'after_move:filepath');
      
      // Add progress output for parsing
      args.push('--newline', '--progress');

      // Add custom options if provided
      if (options.customArgs) {
        const parsedArgs = this.parseArgs(options.customArgs);
        args.push(...parsedArgs);
      }

      args.push(url);

      const ytdlp = spawn('yt-dlp', args);
      let lastProgress = {};
      let capturedFilePath = null;
      
      ytdlp.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);

        // Capture file path (looks for absolute path lines)
        const lines = output.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          // File paths will be absolute paths, not progress or other output
          if (trimmed.startsWith('/') || (trimmed.match(/^[A-Z]:\\/))) {
            capturedFilePath = trimmed;
          }
        }

        // Parse progress
        if (onProgress && output.includes('%')) {
          const match = output.match(/(\d+\.?\d*)%/);
          if (match) {
            const percent = parseFloat(match[1]);
            if (lastProgress.percent !== percent) {
              lastProgress = { percent, time: Date.now() };
              onProgress(lastProgress);
            }
          }
        }
      });

      ytdlp.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      ytdlp.on('close', (code) => {
        if (code === 0) {
          resolve(capturedFilePath);
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });
    });
  }

  async testCookies(testVideoUrl) {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--skip-download',
        '--js-runtimes', 'node',
        '--remote-components', 'ejs:github',
        '--no-warnings'
      ];

      if (fs.existsSync(this.cookiesPath)) {
        args.push('--cookies', this.cookiesPath);
      } else {
        return resolve({ 
          valid: false, 
          error: 'No cookies file found' 
        });
      }

      args.push(testVideoUrl);

      logger.info(`Testing cookies with: ${testVideoUrl}`);
      
      const ytdlp = spawn('yt-dlp', args, {
        env: { ...process.env, PATH: process.env.PATH }  // Ensure Node.js is in PATH
      });
      let stdout = '';
      let stderr = '';

      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', (code) => {
        // Try to parse video info - if we get valid metadata, cookies work
        try {
          const videoInfo = JSON.parse(stdout);
          if (videoInfo.id || videoInfo.title || videoInfo.uploader) {
            // We got valid video metadata, cookies are working
            const accountDetected = stderr.includes('Found YouTube account cookies') || 
                                   stderr.includes('Detected YouTube Premium');
            resolve({ 
              valid: true, 
              message: accountDetected ? 
                'Cookies are valid - YouTube account detected!' : 
                'Cookies are valid and working with YouTube' 
            });
            return;
          }
        } catch (err) {
          // Could not parse JSON, check error messages
        }

        // Log the actual error for debugging
        logger.error(`Cookie test failed. Exit code: ${code}`);
        logger.error(`stderr: ${stderr.substring(0, 500)}`);

        // If we couldn't get video info, check what went wrong
        if (code === 0) {
          resolve({ 
            valid: false, 
            error: 'Could not parse video information (but no error occurred)' 
          });
        } else {
          // Check for specific error messages
          const errorMsg = stderr.toLowerCase();
          let error = 'Cookie validation failed';
          
          if (errorMsg.includes('sign in to confirm your age') || 
              errorMsg.includes('login_required')) {
            error = 'Cookies are invalid or expired. Please export fresh cookies from your browser while logged into YouTube.';
          } else if (errorMsg.includes('private') || 
                     errorMsg.includes('members-only')) {
            error = 'Test video requires membership. Cookies may be valid but cannot access this content.';
          } else if (errorMsg.includes('video unavailable')) {
            error = 'Test video unavailable. Cookies may still be valid.';
          }
          
          resolve({ 
            valid: false, 
            error,
            details: stderr 
          });
        }
      });
    });
  }
}

module.exports = YtDlpService;
