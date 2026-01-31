const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class YtDlpService {
  constructor(cookiesPath) {
    this.cookiesPath = cookiesPath;
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
    return new Promise((resolve, reject) => {
      // Remove /playlists suffix if present
      const cleanUrl = channelUrl.replace(/\/playlists\/?$/, '');
      
      const args = [
        '--dump-json',
        '--flat-playlist',
        '--skip-download',
        '--extractor-args', 'youtubetab:approximate_date'
      ];

      if (fs.existsSync(this.cookiesPath)) {
        args.push('--cookies', this.cookiesPath);
      }

      // For channels, we need to get the /videos tab and extract playlists from there
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
            return resolve({ channel_id: null, channel_name: null, playlists: [] });
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
            if (entry.channel_id && !channelInfo.channel_id) {
              channelInfo.channel_id = entry.channel_id;
              channelInfo.channel_name = entry.channel || entry.uploader || entry.uploader_id;
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
            playlists: Array.from(playlistMap.values())
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

      // Add progress output for parsing
      args.push('--newline', '--progress');

      // Add custom options if provided
      if (options.customArgs) {
        args.push(...options.customArgs.split(' ').filter(a => a));
      }

      args.push(url);

      const ytdlp = spawn('yt-dlp', args);
      let lastProgress = {};
      
      ytdlp.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);

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
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });
    });
  }
}

module.exports = YtDlpService;
