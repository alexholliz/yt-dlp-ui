const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class YtDlpService {
  constructor(cookiesPath) {
    this.cookiesPath = cookiesPath;
  }

  async enumeratePlaylists(channelUrl) {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '--flat-playlist',
        '--skip-download'
      ];

      if (fs.existsSync(this.cookiesPath)) {
        args.push('--cookies', this.cookiesPath);
      }

      args.push(channelUrl);

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
          const entries = lines.map(line => JSON.parse(line));
          
          // Group by playlist
          const playlistMap = new Map();
          const channelInfo = {
            channel_id: null,
            channel_name: null
          };

          entries.forEach(entry => {
            if (entry.channel_id && !channelInfo.channel_id) {
              channelInfo.channel_id = entry.channel_id;
              channelInfo.channel_name = entry.channel || entry.uploader;
            }

            if (entry.playlist_id && entry.playlist_title) {
              if (!playlistMap.has(entry.playlist_id)) {
                playlistMap.set(entry.playlist_id, {
                  playlist_id: entry.playlist_id,
                  playlist_title: entry.playlist_title,
                  playlist_url: `https://www.youtube.com/playlist?list=${entry.playlist_id}`,
                  video_count: 0
                });
              }
              playlistMap.get(entry.playlist_id).video_count++;
            }
          });

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

  async download(url, options = {}) {
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

      // Add custom options if provided
      if (options.customArgs) {
        args.push(...options.customArgs.split(' '));
      }

      args.push(url);

      const ytdlp = spawn('yt-dlp', args);
      
      ytdlp.stdout.on('data', (data) => {
        console.log(data.toString());
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
