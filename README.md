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
- **Cookie Support**: Upload a Netscape-format cookie file for authenticated/age-restricted downloads
- **Advanced Options**: Full yt-dlp command line parameter support
- **Real-time Status**: Live download progress and queue monitoring
- **Modern UI**: Tabbed interface with dark theme
- **Optional Auth**: Session-based login — leave credentials unset to run open on a trusted network

## Quick Start

1. **Add a Channel**: Paste any YouTube channel, playlist, or video URL
2. **Select Playlists**: Click "View" on a channel to enable specific playlists
3. **Download**: Click "Download" on a channel or individual playlist
4. **Monitor**: Check the "Downloads" tab for queue status and progress
5. **Schedule**: Open Settings to enable automatic periodic downloads

---

## Installation

### Option 1 — Local development (Node.js)

**Prerequisites**: Node.js 20+, `yt-dlp`, `ffmpeg` all on your PATH.

```bash
git clone https://github.com/yourusername/yt-dlp-ui.git
cd yt-dlp-ui
npm install

# Optional: enable login
export BASIC_AUTH_USERNAME=admin
export BASIC_AUTH_PASSWORD=yourpassword
export SESSION_SECRET=$(openssl rand -hex 32)

npm start
# Visit http://localhost:8189
```

Config, database, and logs land in `./config/` by default. Downloads go to `./downloads/`.

---

### Option 2 — Docker (single container)

```bash
docker run -d \
  --name yt-dlp-ui \
  -p 8189:8189 \
  -v /path/to/appdata:/config \
  -v /path/to/downloads:/downloads \
  -e TZ=America/New_York \
  -e BASIC_AUTH_USERNAME=admin \
  -e BASIC_AUTH_PASSWORD=yourpassword \
  -e SESSION_SECRET=change-me-to-a-long-random-string \
  ghcr.io/yourusername/yt-dlp-ui:latest
```

The `/config` volume holds the database (`yt-dlp-ui.sqlite`), `cookies.txt`, and log files.  
Omit the `BASIC_AUTH_*` and `SESSION_SECRET` vars to run without a login screen (safe on a trusted home network).

---

### Option 3 — Docker Compose

Clone or copy `docker-compose.yml`, then edit the volume paths and credentials:

```yaml
version: '3.8'
services:
  yt-dlp-ui:
    image: ghcr.io/yourusername/yt-dlp-ui:latest
    container_name: yt-dlp-ui
    ports:
      - "8189:8189"
    volumes:
      - /path/to/appdata:/config
      - /path/to/downloads:/downloads
    environment:
      - TZ=America/New_York
      - CONFIG_PATH=/config
      - DOWNLOADS_PATH=/downloads
      # Remove the three lines below to run without a login screen
      - BASIC_AUTH_USERNAME=admin
      - BASIC_AUTH_PASSWORD=yourpassword
      - SESSION_SECRET=change-me-to-a-long-random-string
    restart: unless-stopped
```

```bash
docker-compose up -d
# Visit http://localhost:8189
```

To build from source instead of pulling the image, replace the `image:` line with `build: .`.

---

### Option 4 — Unraid

1. In the Unraid web UI go to **Apps** and search for **yt-dlp-ui**, or install manually:
   - Go to **Docker** → **Add Container**
   - Set **Repository** to `ghcr.io/yourusername/yt-dlp-ui:latest`
   - Alternatively, paste the raw template URL into the **Template URL** field

2. Configure the paths:

   | Field | Suggested value |
   |-------|----------------|
   | Config Directory | `/mnt/user/appdata/yt-dlp-ui` |
   | Downloads Directory | `/mnt/user/downloads/youtube` |

3. Configure optional auth (leave blank to disable):

   | Variable | Description |
   |----------|-------------|
   | `BASIC_AUTH_USERNAME` | Login username |
   | `BASIC_AUTH_PASSWORD` | Login password |
   | `SESSION_SECRET` | Long random string — protects sessions and encrypts the YouTube API key at rest |

4. Click **Apply**. The UI is available at `http://YOUR-UNRAID-IP:8189`.

> **Tip**: Generate a strong session secret on any Linux/Mac machine with `openssl rand -hex 32`.

---

## Authentication

Authentication is **opt-in**. The app behaves differently depending on whether credentials are configured:

| Scenario | Behaviour |
|----------|-----------|
| No `BASIC_AUTH_USERNAME` / `PASSWORD` set | App is fully open — no login required |
| Credentials set, no `SESSION_SECRET` | Login works, sessions reset on restart, YouTube API key stored unencrypted |
| All three vars set | Full auth + persistent sessions + API key encrypted at rest (AES-256-GCM) |

When auth is enabled, all API endpoints return `401` to unauthenticated requests. The login page (`/login`) and static assets are always accessible.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8189` | Web UI port |
| `TZ` | `UTC` | Container timezone (IANA format, e.g. `America/New_York`) |
| `CONFIG_PATH` | `/config` | Appdata root — database, cookies.txt, and logs all live here |
| `DOWNLOADS_PATH` | `/downloads` | Where downloaded videos are saved |
| `BASIC_AUTH_USERNAME` | *(unset)* | Login username — omit to disable auth |
| `BASIC_AUTH_PASSWORD` | *(unset)* | Login password |
| `SESSION_SECRET` | *(unset)* | Session signing key + YouTube API key encryption key |
| `LOG_LEVEL` | `info` | `error` / `warn` / `info` / `debug` |
| `YT_DL_WORKER_CONCURRENCY` | `2` | Parallel yt-dlp workers — lower if getting rate-limited |

> **Note**: `DB_PATH` and `COOKIES_PATH` are derived from `CONFIG_PATH` automatically
> (`$CONFIG_PATH/yt-dlp-ui.sqlite` and `$CONFIG_PATH/cookies.txt`). They can be
> overridden individually if you need them in different locations.

---

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

---

## Documentation

- [📖 Documentation Wiki](https://github.com/alexholliz/yt-dlp-ui/wiki) - Complete documentation
- [🚀 Quick Start Guide](https://github.com/alexholliz/yt-dlp-ui/wiki/Quickstart) - Get started in 5 minutes
- [🛠️ Development Guide](https://github.com/alexholliz/yt-dlp-ui/wiki/Development) - Architecture and API docs
- [🔄 CI/CD Guide](https://github.com/alexholliz/yt-dlp-ui/wiki/CI-CD-Guide) - Pipeline setup and deployment
- [🧪 Testing Strategy](TESTING_CHECKLIST.md) - Test architecture and best practices
- [📊 Project State](PROJECT_STATE.md) - Current status, history, and roadmap

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and test thoroughly
4. Push to your fork and submit a pull request
5. Wait for review and approval

**Note**: Pull requests require passing CI (audit + unit tests + integration sweep) and at least one approving review.

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
