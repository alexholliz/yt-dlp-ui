# yt-dlp-ui

A self-hosted web UI for managing yt-dlp downloads with intelligent playlist handling.

## Features

- **Smart URL Handling**: Channels, playlists, single videos, and `/playlists` URLs
- **Intelligent Playlist Management**: Enumerate and selectively download playlists from channels
- **Flexible Organization**: Flat or playlist-organized directory structures  
- **Download Manager**: Queue system with progress tracking
- **Automatic Scheduling**: Periodic checking for new content
- **Cookie Support**: Manage cookies through UI for authenticated downloads
- **Advanced Options**: Full yt-dlp command line parameter support
- **Real-time Status**: Live download progress and queue monitoring
- **Modern UI**: Tabbed interface with dark theme

## Installation

### Docker Compose (Recommended)

```bash
git clone https://github.com/yourusername/yt-dlp-ui.git
cd yt-dlp-ui
docker-compose up -d
```

### Docker CLI

```bash
docker run -d \
  --name yt-dlp-ui \
  -p 8189:8189 \
  -v /path/to/config:/config \
  -v /path/to/downloads:/downloads \
  -e TZ=America/New_York \
  yt-dlp-ui:latest
```

### Local Development

```bash
# Prerequisites: Node.js 20+, yt-dlp, ffmpeg
npm install
npm run dev
# Visit http://localhost:8189
```

## Quick Start

1. **Add a Channel**: Paste any YouTube channel, playlist, or video URL
2. **Select Playlists**: Click "View" on a channel to enable specific playlists
3. **Download**: Click "Download" on a channel or individual playlist
4. **Monitor**: Check the "Downloads" tab for queue status and progress
5. **Schedule**: Open Settings to enable automatic periodic downloads

See [QUICKSTART.md](QUICKSTART.md) for detailed walkthrough.

## Key Features

### URL Type Detection

- **`@channelname`** → Enumerate all playlists, select which to download
- **`@channelname/playlists`** → Playlists-only mode (excludes non-playlist videos)
- **`/playlist?list=...`** → Direct playlist download
- **`/watch?v=...`** → Single video immediate download

### Download Organization

**Organized Mode** (default):
```
Uploader [Channel_ID]/
  Playlist Title [Playlist_ID]/
    001 - Video Title [Video_ID].mp4
    002 - Video Title [Video_ID].mp4
```

**Flat Mode**:
```
Uploader [Channel_ID]/
  Video Title [Video_ID].mp4
```

### Scheduler

Configure automatic downloads to check for new content periodically:
- Set global interval (days)
- Per-channel rescrape intervals
- Manual trigger anytime
- Runs in background

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8189` | Web UI port |
| `TZ` | `UTC` | Timezone (IANA format) |
| `DB_PATH` | `/config/yt-dlp-ui.sqlite` | Database file path |
| `DOWNLOADS_PATH` | `/downloads` | Download directory |
| `COOKIES_PATH` | `/config/cookies.txt` | Cookie file path |

## Documentation

- [Quick Start Guide](QUICKSTART.md) - Get started in 5 minutes
- [Development Guide](DEVELOPMENT.md) - Architecture and API docs
- [Features Complete](FEATURES_COMPLETE.md) - Full feature list
- [MVP Complete](MVP_COMPLETE.md) - Initial release notes

## Technology Stack

- **Backend**: Node.js, Express, SQLite (sql.js)
- **Frontend**: Vanilla JavaScript, CSS3
- **Downloads**: yt-dlp, ffmpeg
- **Deployment**: Docker, docker-compose

## License

MIT

## Credits

- Inspired by [Pinchflat](https://github.com/kieraneglin/pinchflat)
- Powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp)
