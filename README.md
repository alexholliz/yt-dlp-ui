# yt-dlp-ui

A self-hosted web UI for managing yt-dlp downloads with intelligent playlist handling.

## Features

- **Smart Playlist Management**: Automatically enumerate and organize playlists from YouTube channels
- **Flexible Organization**: Choose between flat structure or organized by playlist subdirectories
- **Cookie Support**: Mount cookie files or manage through UI for authenticated downloads
- **Advanced yt-dlp Options**: Full control over download parameters
- **Channel/Playlist/Video Support**: Handle channels, playlists, and individual videos
- **Download Archive**: Track downloaded videos to avoid duplicates
- **Scheduling**: Automatic periodic checking for new content

## Installation

### Docker Compose (Recommended)

```bash
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

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8189` | Web UI port |
| `TZ` | `UTC` | Timezone (IANA format) |
| `DB_PATH` | `/config/yt-dlp-ui.sqlite` | Database file path |
| `DOWNLOADS_PATH` | `/downloads` | Download directory |
| `COOKIES_PATH` | `/config/cookies.txt` | Cookie file path |

## Usage

1. Access the web UI at `http://localhost:8189`
2. Add a channel URL
3. Select playlists to download
4. Configure download options
5. Start downloading!

## MVP Features (Current)

- ✅ Add YouTube channels
- ✅ Enumerate channel playlists
- ✅ Select playlists to download
- ✅ Basic web UI
- ✅ SQLite database
- ✅ Docker container

## Roadmap

- [ ] Cookie file management through UI
- [ ] Advanced yt-dlp options configuration
- [ ] Single video downloads
- [ ] Playlist-only downloads
- [ ] Download scheduling
- [ ] Video metadata display
- [ ] Download history and status
- [ ] Archive file management

## License

MIT
