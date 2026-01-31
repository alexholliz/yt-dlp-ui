# yt-dlp-ui

[![Build and Test](https://github.com/yourusername/yt-dlp-ui/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/yourusername/yt-dlp-ui/actions/workflows/build-and-test.yml)

A self-hosted web UI for managing yt-dlp downloads with intelligent playlist handling.

## Features

- **Smart URL Handling**: Channels, playlists, single videos, and `/playlists` URLs
- **Intelligent Playlist Management**: Enumerate and selectively download playlists from channels
- **SponsorBlock Integration**: Skip or mark sponsored segments, intros, outros, and more
- **yt-dlp Profiles**: Reusable download configurations with presets
- **YouTube Data API v3**: Optional API key for faster channel enumeration
- **Flexible Organization**: Flat or playlist-organized directory structures  
- **Download Manager**: Queue system with progress tracking and retry functionality
- **Automatic Scheduling**: Periodic checking for new content
- **Cookie Support**: Manage cookies through UI for authenticated downloads
- **Advanced Options**: Full yt-dlp command line parameter support
- **Real-time Status**: Live download progress and queue monitoring
- **Modern UI**: Tabbed interface with dark theme

## Installation

### Using Pre-built Image (Recommended)

```bash
docker run -d \
  --name yt-dlp-ui \
  -p 8189:8189 \
  -v /path/to/config:/config \
  -v /path/to/downloads:/downloads \
  -e TZ=America/New_York \
  ghcr.io/yourusername/yt-dlp-ui:latest
```

### Docker Compose

```yaml
version: '3.8'
services:
  yt-dlp-ui:
    image: ghcr.io/yourusername/yt-dlp-ui:latest
    container_name: yt-dlp-ui
    ports:
      - "8189:8189"
    volumes:
      - /path/to/config:/config
      - /path/to/downloads:/downloads
    environment:
      - TZ=America/New_York
    restart: unless-stopped
```

### Build from Source

```bash
git clone https://github.com/yourusername/yt-dlp-ui.git
cd yt-dlp-ui
docker-compose up -d
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

See the [Quick Start Guide](https://github.com/alexholliz/yt-dlp-ui/wiki/Quickstart) for a detailed walkthrough.

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

- [📖 Documentation Wiki](https://github.com/alexholliz/yt-dlp-ui/wiki) - Complete documentation
- [🚀 Quick Start Guide](https://github.com/alexholliz/yt-dlp-ui/wiki/Quickstart) - Get started in 5 minutes
- [🛠️ Development Guide](https://github.com/alexholliz/yt-dlp-ui/wiki/Development) - Architecture and API docs
- [🔄 CI/CD Guide](https://github.com/alexholliz/yt-dlp-ui/wiki/CI-CD-Guide) - Pipeline setup and deployment
- [✨ Features Complete](https://github.com/alexholliz/yt-dlp-ui/wiki/Features-Complete) - Full feature list
- [🧪 Testing Strategy](TESTING_CHECKLIST.md) - Test architecture and best practices
- [📊 Project State](PROJECT_STATE.md) - Current status, history, and roadmap

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and test thoroughly
4. Push to your fork and submit a pull request
5. Wait for review and approval

**Note**: Pull requests require:
- Passing CI tests
- Code review approval from maintainers
- Up-to-date with `main` branch

See the [CI/CD Guide](https://github.com/alexholliz/yt-dlp-ui/wiki/CI-CD-Guide) for pipeline details.

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
