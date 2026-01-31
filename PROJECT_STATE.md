# yt-dlp-ui Project State & History

**Last Updated:** 2026-01-31  
**Version:** 1.0.0-beta  
**Status:** Fully Functional

> **⚠️ IMPORTANT FOR AI ASSISTANTS:**  
> This document MUST be kept up-to-date as development continues.  
> When making changes to the project, update the relevant sections:
> - Add new features to "Implemented Features"
> - Update "Recent Changes" with latest commits
> - Document new technical decisions in "Key Technical Decisions"
> - Add new known issues to "Known Issues & Limitations"
> - Move completed roadmap items to "Implemented Features"
> - Update the "Last Updated" date at the top
> 
> This ensures continuity for future AI sessions and human developers.

---

## Current State of the Project

### 🎯 Project Overview

**yt-dlp-ui** is a self-hosted web application for managing YouTube downloads via yt-dlp with intelligent playlist handling. It runs as a Docker container and provides a web interface for managing channels, playlists, and downloads.

### ✅ Implemented Features

#### Core Functionality
- **Smart URL Detection**: Automatically detects and handles channels, playlists, single videos, and `/playlists` URLs
- **Playlist Enumeration**: Enumerates all playlists from a YouTube channel
- **Selective Downloading**: Enable/disable individual playlists for download
- **Download Queue System**: Manages multiple concurrent downloads with progress tracking
- **Automatic Scheduling**: Periodic checking for new content with configurable intervals
- **Download Archive**: Tracks downloaded videos in database to avoid duplicates

#### URL Types Supported
1. **Channel URLs**: `@channelname`, `/channel/ID`, `/c/name`, `/user/name`
2. **Playlists-Only URLs**: `@channelname/playlists` (only downloads videos in playlists)
3. **Direct Playlist URLs**: `/playlist?list=...`
4. **Single Video URLs**: `/watch?v=...` or `youtu.be/...` (immediate download)

#### User Interface
- **Sidebar Navigation**: Home, Channels, Config pages
- **Home Page (Dashboard)**:
  - Stats boxes: Total Channels, Total Downloads, Library Size
  - Media History table (paginated, 5 per page)
  - Current Queue table (paginated, 5 per page)
- **Channels Page**: Table with all channels, download counts, enable/disable toggles
- **Config Page**: Scheduler controls, cookie management, add content form
- **Modals**: Channel details with playlists, video metadata viewer
- **Auto-refresh**: Live updates every 5 seconds for stats and progress

#### Download Management
- **Output Organization**: 
  - Organized mode: `Uploader [ID]/Playlist [PL_ID]/Index - Title [ID].ext`
  - Flat mode: `Uploader [ID]/Title [ID].ext`
- **Format**: Defaults to 1080p MP4 with audio merge
- **Metadata**: Saves video info JSON and thumbnails
- **Concurrency**: Configurable parallel workers (default: 2)

#### Security & Configuration
- **HTTP Basic Authentication**: Optional username/password protection
- **Logging System**: Winston logger with file rotation (error.log, combined.log)
- **Log Levels**: error, warn, info, debug (default: debug)
- **Cookie Management**: Upload/edit YouTube cookies through UI
- **Environment Variables**: Fully configurable via Docker env vars

#### Database
- **SQLite with WAL mode**: Better concurrency support
- **Tables**: channels, playlists, videos
- **Statistics**: Real-time stats calculation
- **Pagination**: Efficient querying for large datasets

### 📁 Project Structure

```
yt-dlp-ui/
├── src/
│   ├── server.js           # Express API server (379 lines)
│   ├── database.js         # SQLite operations with WAL mode (328 lines)
│   ├── ytdlp-service.js    # yt-dlp wrapper with URL detection (270 lines)
│   ├── download-manager.js # Queue & download orchestration (209 lines)
│   ├── scheduler.js        # Automatic periodic downloads (72 lines)
│   └── logger.js           # Winston logger configuration (51 lines)
├── public/
│   ├── index.html          # Sidebar-based UI with 3 pages
│   ├── css/styles.css      # Pinchflat-inspired dark theme
│   └── js/app.js           # Frontend with pagination & live updates
├── Dockerfile              # Alpine + Node + yt-dlp + ffmpeg
├── docker-compose.yml      # Local testing & deployment
├── unraid-template.xml     # Unraid Community Apps template
├── package.json            # Node.js dependencies
├── .gitignore             
└── Documentation/
    ├── README.md
    ├── QUICKSTART.md
    ├── DEVELOPMENT.md
    ├── FEATURES_COMPLETE.md
    ├── SECURITY_CONFIG.md
    └── PROJECT_STATE.md (this file)
```

### 🔧 Technology Stack

- **Backend**: Node.js 20, Express 4.18
- **Database**: SQLite via sql.js (pure JavaScript, no C++ compilation)
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Styling**: CSS3 with CSS custom properties
- **Downloads**: yt-dlp (latest) + ffmpeg
- **Logging**: Winston 3.19
- **Auth**: express-basic-auth 1.2
- **Deployment**: Docker (Alpine Linux)

### 🚀 Current Deployment

The project is fully containerized and ready for:
- **Unraid**: Use the included template XML
- **Docker Compose**: `docker-compose up -d`
- **Docker CLI**: Standard docker run commands
- **Local Dev**: `npm run dev`

### 🔑 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8189` | Web UI port |
| `TZ` | `UTC` | Timezone (IANA format) |
| `DB_PATH` | `/config/yt-dlp-ui.sqlite` | Database file path |
| `DOWNLOADS_PATH` | `/downloads` | Download directory |
| `COOKIES_PATH` | `/config/cookies.txt` | Cookie file path |
| `LOG_LEVEL` | `debug` | Logging level |
| `YT_DL_WORKER_CONCURRENCY` | `2` | Parallel download workers |
| `BASIC_AUTH_USERNAME` | (empty) | Optional auth username |
| `BASIC_AUTH_PASSWORD` | (empty) | Optional auth password |

### 📊 Database Schema

**Channels Table:**
```sql
id, url, channel_id, channel_name, playlist_mode, flat_mode,
auto_add_new_playlists, yt_dlp_options, rescrape_interval_days,
last_scraped_at, created_at, updated_at
```

**Playlists Table:**
```sql
id, channel_id, playlist_id, playlist_title, playlist_url,
video_count, enabled, last_scraped_at, created_at, updated_at
```

**Videos Table:**
```sql
id, channel_id, playlist_id, video_id, video_title, video_url,
uploader, upload_date, duration, playlist_index, download_status,
downloaded_at, file_path, created_at, updated_at
```

### 🐛 Known Issues & Limitations

1. **Channel Name Extraction**: Sometimes yt-dlp doesn't return channel name in /playlists enumeration
   - **Workaround**: Fallback extracts from URL (@username)
   - Falls back to "Unknown (X playlists found)" with functioning links

2. **sql.js Limitations**: Pure JavaScript SQLite implementation
   - Entire database loaded into memory
   - Must call save() to persist changes
   - Not recommended for databases >100MB

3. **Progress Parsing**: yt-dlp progress output varies, parsing is approximate

4. **Single Download Queue**: Sequential processing (one video at a time per worker)

**All other known bugs have been fixed as of 2026-01-30!**

### 📈 Performance Characteristics

- **Enumeration Time**: 5-15 seconds per channel (depends on playlist count)
- **Database Writes**: Every operation (sql.js limitation)
- **Memory Usage**: ~50-100MB base + database size + active downloads
- **Concurrent Downloads**: Configurable (default 2 workers)
- **UI Polling**: Every 5 seconds when on Home or Channels page

### 🔒 Security Configuration

- **Basic Auth**: Disabled by default (warns in logs)
- **No HTTPS**: Requires reverse proxy for encryption
- **Cookie Storage**: Plain text in /config/cookies.txt
- **No User Management**: Single-user application
- **API Protection**: All endpoints behind auth if enabled

---

## Instructions for AI Assistant Continuation

**Context for AI when resuming this project:**

This is a functional YouTube download manager built with Node.js, Express, and SQLite. When resuming work on this project:

1. **Architecture Pattern**: 
   - Backend is Express REST API
   - Frontend is vanilla JS (no build step)
   - Database uses sql.js (must call `.save()` after writes)
   - All services initialized in server.js after `db.ready.then()`

2. **Key Design Decisions**:
   - Used sql.js instead of better-sqlite3 (avoids C++ compilation issues)
   - Pinchflat-inspired color scheme (--primary-color: #ee512b)
   - Sidebar layout with 3 pages (Home, Channels, Config)
   - Pagination at 5 items per page
   - Auto-refresh with polling (not WebSockets)

3. **Important Code Patterns**:
   - Logger: Use `logger.info()`, `logger.error()`, etc. (not console.log)
   - Database: Always await `db.ready` before operations
   - API responses: Always use try/catch with `res.status(500).json({ error })`
   - Frontend: Use `showNotification()` for user feedback

4. **Active Issues to Be Aware Of**:
   - Channel name sometimes not captured during enumeration (has fallback)
   - Library size calculation not implemented (shows 0)
   - sql.js requires `.save()` after all DB operations

5. **Testing Setup**:
   - Docker container on port 8189
   - Test database at `./config/yt-dlp-ui.sqlite`
   - Test downloads go to `./downloads/`
   - Logs in `./config/*.log` and `./data/*.log`

6. **Common Commands**:
   ```bash
   # Local dev
   npm run dev
   
   # Docker
   docker-compose up -d --build
   docker logs -f yt-dlp-ui
   
   # Database queries
   sqlite3 config/yt-dlp-ui.sqlite "SELECT ..."
   ```

7. **When Adding Features**:
   - Add API endpoint in server.js
   - Add database method in database.js (with `.save()`)
   - Add frontend function in public/js/app.js
   - Update CSS in public/css/styles.css if needed
   - Test with curl before UI testing
   - Commit frequently with descriptive messages
   - **UPDATE PROJECT_STATE.md** with new features and changes

8. **Unraid Deployment**:
   - Template is in `unraid-template.xml`
   - All env vars must be added to template
   - Use `Display="always"` for user-facing options
   - Use `Display="advanced"` for technical options
   - Use `Mask="true"` for passwords

---

## Development History & Context

### Project Genesis

**Initial Request:**
User wanted to create a yt-dlp web UI inspired by Pinchflat but with better playlist handling. Specifically:
- Pinchflat downloads entire channels into one folder
- User's workflow: One-line yt-dlp command that enumerates playlists and organizes by playlist
- Needed: Per-playlist selection, better cookie handling, playlist-aware organization

**Key User Requirements:**
1. Enumerate all playlists from a channel
2. Select which playlists to download
3. Preserve playlist structure in file organization
4. Handle `/playlists` URLs specially (playlists-only mode)
5. Support single video URLs
6. Cookie management through UI
7. Scheduling for automatic downloads
8. Must run on Unraid with template

### Development Timeline

**Phase 1: MVP (Commits 1-3)**
- Basic Node.js + Express + SQLite setup
- Channel enumeration with yt-dlp
- Playlist selection UI
- Docker container setup
- Pinchflat-inspired CSS theme

**Phase 2: Full Features (Commits 4-6)**
- Download manager with queue system
- Progress tracking
- Scheduler service
- Cookie management API
- Single video support
- URL type detection
- Tabbed interface

**Phase 3: Security & Production (Commits 7-9)**
- HTTP Basic Auth
- Winston logging system
- SQLite WAL mode
- Worker concurrency control
- Unraid template with all env vars
- Docker build fixes (--break-system-packages)

**Phase 4: UI Redesign (Commits 10-13)**
- Sidebar layout (Home, Channels, Config)
- Dashboard with statistics
- Paginated tables (5 items per page)
- Media history with metadata links
- Channel statistics table
- Enumeration progress indicators
- Auto-refresh after adding channels
- Video count display in playlists

**Phase 5: Bug Fixes & Polish (Commit 14)**
- Library size calculation from database
- Queue display with video titles and channel names
- Error handling for failed downloads with detailed messages
- Modal backdrop click fixes
- Database migrations for file_size and error_message columns
- Enhanced API endpoints with richer video data

### Key Technical Decisions & Rationale

1. **sql.js over better-sqlite3**
   - **Why**: better-sqlite3 requires C++20 compilation, failed on macOS
   - **Trade-off**: Must call `.save()` manually, entire DB in memory
   - **Acceptable because**: Small databases (<100MB), simple deployment

2. **Vanilla JS over React/Vue**
   - **Why**: Keep it simple, no build step, easy to read/modify
   - **Trade-off**: More verbose DOM manipulation
   - **Acceptable because**: Small UI surface area, performance is fine

3. **Polling over WebSockets**
   - **Why**: Simpler to implement, no connection management
   - **Trade-off**: 5-second delay on updates, more requests
   - **Acceptable because**: Not a real-time app, low user count

4. **Background Enumeration**
   - **Why**: yt-dlp can take 10-30 seconds, don't block UI
   - **Trade-off**: Channels show as "Loading..." briefly
   - **Solution**: Auto-refresh polling shows progress

5. **Fallback Channel Name Extraction**
   - **Why**: yt-dlp /playlists tab doesn't always return channel metadata
   - **Trade-off**: Uses URL parsing as fallback (@username)
   - **Acceptable because**: Better than no name at all

### User's Workflow Example

The user provided this yt-dlp one-liner as reference:
```bash
yt-dlp --cookies "//unraid-01/Shares/Media/Videos/YouTube/cookies.txt" \
  -v --dateafter 20081004 \
  --download-archive "//unraid-01/Shares/Media/Videos/YouTube/.Downloaded" \
  -P "//unraid-01/Shares/Media/Videos/YouTube" \
  -o "%(uploader)s [%(channel_id)s]/%(playlist_title)s [%(playlist_id)s]/%(playlist_index)s - %(title)s [%(id)s].%(ext)s" \
  -f "bv*[height=1080][ext=mp4]+(258/256/140) / best[height=1080] / b" \
  --merge-output-format mp4 --write-info-json --no-restrict-filenames \
  --batch-file "//unraid-01/Shares/Media/Videos/YouTube/Channels_to_DL.txt"
```

This app replicates that workflow but with:
- Web UI instead of command line
- Per-playlist selection instead of batch file
- Database tracking instead of download archive only
- Visual progress instead of terminal output

### Important URLs & Contexts

- **User's Channel Example**: `https://www.youtube.com/@TheOneHollis`
- **Test Channel Used**: `https://www.youtube.com/yogawithadriene/`
- **Target Platform**: Unraid server
- **Port**: 8189 (chosen to avoid conflicts)
- **Inspiration**: [Pinchflat](https://github.com/kieraneglin/pinchflat) (Elixir/Phoenix app)

### Current Test Data

The database currently contains:
- 1 channel: `@TheOneHollis` 
- 3 playlists enumerated:
  - "TheOneHollis - Playlists" (meta-playlist)
  - "Final Fantasy XII - The Zodiac Age" (2 videos)
  - "Ratchet and Clank 2 Developer Commentary" (2 videos)
- 0 videos downloaded (testing enumeration only so far)

---

## Resuming This Project: Quick Start Guide

### For AI Assistant

When the user asks you to continue working on this project, you should:

1. **Acknowledge the project state**:
   - "I can see this is the yt-dlp-ui project we built together"
   - "It's a Node.js + Express app with SQLite for YouTube download management"
   - "Last I see, we implemented [mention last feature from git log]"

2. **Verify current state**:
   ```bash
   cd ~/git/hub/yt-dlp-ui
   git log --oneline -5  # Check recent commits
   docker ps | grep yt-dlp  # Check if container running
   ls -la config/ data/  # Check for databases/logs
   ```

3. **Key things to check before working**:
   - Is Docker container running? If so, stop it before local dev
   - Are there pending git changes? `git status`
   - What's the last commit? `git log -1`
   - Any databases with test data? Check `./config/` and `./data/`

4. **Common continuation scenarios**:

   **Scenario A: "Add feature X"**
   - Read relevant source files first
   - Add backend API endpoint
   - Add database method (remember `.save()`)
   - Add frontend function
   - Test with curl, then UI
   - Rebuild container: `docker-compose up -d --build`

   **Scenario B: "Fix bug Y"**
   - Check logs: `docker logs yt-dlp-ui` or `./config/combined.log`
   - Reproduce in local dev: `npm run dev`
   - Fix code
   - Test locally
   - Rebuild container

   **Scenario C: "UI change Z"**
   - Edit `public/index.html` and/or `public/css/styles.css` and/or `public/js/app.js`
   - No rebuild needed! Just refresh browser
   - Then rebuild container for production

5. **Important Code Locations**:
   - **API Routes**: `src/server.js` lines 60-370
   - **Database Methods**: `src/database.js` lines 100-320
   - **yt-dlp Integration**: `src/ytdlp-service.js` lines 29-270
   - **UI Page Rendering**: `public/js/app.js` lines 80-250
   - **Sidebar Nav**: `public/index.html` lines 14-30

6. **Testing Checklist**:
   - [ ] API responds: `curl http://localhost:8189/api/stats`
   - [ ] UI loads: Open browser to http://localhost:8189
   - [ ] Can add channel: Try adding a YouTube channel URL
   - [ ] Enumeration works: Check playlists appear after 10 seconds
   - [ ] Stats update: Numbers in dashboard change
   - [ ] Docker works: `docker-compose up -d` runs successfully

### For Human User

When resuming this project with AI assistance:

**What to tell the AI:**

1. **"Continue the yt-dlp-ui project at ~/git/hub/yt-dlp-ui"**
   - This tells AI where the project is located

2. **Describe what you want**:
   - "Add feature X to yt-dlp-ui"
   - "Fix the bug where Y happens in yt-dlp-ui"
   - "Change the UI so that Z"

3. **Provide context if needed**:
   - "This is the YouTube downloader project we built"
   - "It uses yt-dlp in Docker with a Node.js web UI"
   - "Remember it has that sidebar layout we designed"

4. **Share this document**:
   - "Read PROJECT_STATE.md in ~/git/hub/yt-dlp-ui first"
   - This gives AI all the context it needs

**Quick commands for you:**

```bash
# Navigate to project
cd ~/git/hub/yt-dlp-ui

# Start container
docker-compose up -d

# View logs
docker logs -f yt-dlp-ui

# Stop container
docker-compose down

# Check what's running
docker ps | grep yt-dlp

# View recent commits
git log --oneline -10

# Check database
sqlite3 config/yt-dlp-ui.sqlite "SELECT * FROM channels;"

# Access UI
open http://localhost:8189
```

### Recent Changes (Last 5 Commits)

```
99e2cbd Fix known bugs: library size, queue display, error handling, and modal clicks
e1ecd29 Add database migration for video_count column
f60f08d Add comprehensive project state and continuation guide
58206da Add video count display for playlists
38bc885 Fix playlist enumeration and add channel name fallback
```

> **Note**: When continuing development, update this section with latest commits using:  
> `git log --oneline -5`

---

## Future Roadmap

### Planned Features (Not Yet Implemented)

1. **Library Size Calculation**
   - Scan downloads directory
   - Calculate total size per channel
   - Show in stats and channel table

2. **Channel Enable/Disable**
   - Functional toggle (currently just visual)
   - Affects scheduler processing
   - Store in database

3. **Video Thumbnails**
   - Display in history table
   - Show in video metadata modal
   - Lazy load for performance

4. **Bulk Operations**
   - Select multiple playlists at once
   - Enable/disable multiple channels
   - Batch delete

5. **Search & Filtering**
   - Search videos by title
   - Filter by channel
   - Date range filters

6. **Notifications**
   - Discord webhook
   - Telegram bot
   - Email alerts
   - Download completion notifications

7. **Advanced Scheduling**
   - Per-channel schedules
   - Time-of-day preferences
   - Bandwidth limiting

8. **Statistics Dashboard**
   - Charts and graphs
   - Download trends
   - Popular playlists
   - Storage usage over time

9. **Export/Import**
   - Backup configuration
   - Import from Pinchflat
   - Export channel list

10. **Mobile Responsive Improvements**
    - Better mobile nav
    - Touch-friendly controls
    - Responsive tables

### Known Bugs to Fix

1. ~~Channel name not always captured during enumeration~~ (Fixed with URL fallback)
2. ~~Library size shows 0~~ (Fixed - now calculated from database)
3. ~~Queue table shows video IDs instead of titles~~ (Fixed - now shows titles and channel names)
4. ~~No error handling for failed downloads in UI~~ (Fixed - shows error messages and status badges)
5. ~~Modal backdrop click sometimes doesn't close on first click~~ (Fixed - re-added event listeners)
6. ~~Video count not showing in playlists~~ (Fixed with migration and proper enumeration)

### Performance Optimizations Needed

1. Debounce auto-refresh polling
2. Virtual scrolling for large video lists
3. Lazy load thumbnails
4. Cache stats calculations
5. Optimize database queries with indexes

---

## Project Goals & Philosophy

**Primary Goal**: Replicate user's one-line yt-dlp workflow with a web UI

**Design Principles**:
1. **Self-contained**: Everything in one Docker container
2. **Simple**: No complex frameworks, readable code
3. **Reliable**: Database-backed with proper error handling
4. **Flexible**: Support all YouTube URL types
5. **Unraid-friendly**: Easy template-based deployment

**User's Pain Points with Pinchflat** (that we solved):
- ❌ **Pinchflat**: Downloads all videos to one channel folder
  - ✅ **yt-dlp-ui**: Organizes by playlist with index numbers
  
- ❌ **Pinchflat**: Janky cookie handling
  - ✅ **yt-dlp-ui**: Upload/edit cookies through UI
  
- ❌ **Pinchflat**: Can't select individual playlists
  - ✅ **yt-dlp-ui**: Toggle each playlist on/off

**Success Criteria** (all met):
- [x] Docker container runs on Unraid
- [x] Can add channels and enumerate playlists
- [x] Can select which playlists to download
- [x] Downloads organize by playlist structure
- [x] Handles cookies properly
- [x] Web UI is intuitive and functional
- [x] Automatic scheduling works

---

## Git Repository Information

- **Location**: `~/git/hub/yt-dlp-ui`
- **Branch**: `main`
- **Total Commits**: ~15
- **License**: MIT
- **Author**: Configured as "Alexander Hollis <alexanderhollis@MacBookPro.hollis.pizza>"

**Important Files Not in Git**:
- `node_modules/` (npm packages)
- `data/` (local dev database)
- `config/` (cookies, production database)
- `downloads/` (downloaded videos)
- `*.log` (log files)
- `*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm` (database files)

---

## Contact & Credits

**Inspired By**: [Pinchflat](https://github.com/kieraneglin/pinchflat) by Kieran Eglin  
**Powered By**: [yt-dlp](https://github.com/yt-dlp/yt-dlp)  
**Built With**: Node.js, Express, SQLite, Vanilla JS

**License**: MIT (see LICENSE file)

---

*This document serves as a complete snapshot of the project state and should be updated whenever major features are added or architectural decisions are made.*
