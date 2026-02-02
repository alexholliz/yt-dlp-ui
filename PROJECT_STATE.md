# yt-dlp-ui Project State & History

**Last Updated:** 2026-02-01  
**Version:** 1.4.0  
**Status:** Production-Ready with Advanced Options System

> **⚠️ IMPORTANT FOR AI ASSISTANTS:**  
> 
> **Read These Files at Session Start:**
> 1. **PROJECT_STATE.md** (this file) - Project history, architecture, current status
> 2. **TESTING_CHECKLIST.md** - Testing strategy, how to add tests
> 3. **CI_CD_CHECKLIST.md** - Pipeline status, deployment checklist
> 4. **README.md** - Project overview and quick start
> 
> **Keep These Files Updated During Your Session:**
> 
> | File | What to Update | When to Update |
> |------|---------------|----------------|
> | **PROJECT_STATE.md** | Features, architecture, technical decisions, project history | After implementing features, fixing bugs, or making architectural changes |
> | **TESTING_CHECKLIST.md** | Test coverage, new test patterns, testing decisions | When adding/modifying tests, changing test strategy |
> | **CI_CD_CHECKLIST.md** | Pipeline changes, deployment steps, CI/CD configuration | When modifying workflows, Docker builds, or deployment process |
> | **README.md** | Installation steps, feature list, quick start | When adding major features or changing setup |
> 
> **At End of Session:**
> - Update "Last Updated" date at top of this file
> - Add session summary to "Latest Session Changes"
> - Update version number if appropriate (major/minor/patch)
> - Commit all documentation updates with code changes
> - **If UI/backend code changed: Rebuild and restart Docker container**
>   ```bash
>   docker-compose down && docker-compose build && docker-compose up -d
>   ```
> 
> **Git Configuration for this Repository:**
> - Git user name: `alexholliz`
> - Git user email: `alex.holliz@gmail.com`
> - GitHub repository: `alexholliz/yt-dlp-ui`
> - These credentials MUST be used for all git operations in this project
> 
> This ensures continuity for future AI sessions and human developers.

---

## Current State of the Project

### 🎯 Project Overview

**yt-dlp-ui** is a self-hosted web application for managing YouTube downloads via yt-dlp with intelligent playlist handling. It runs as a Docker container and provides a web interface for managing channels, playlists, profiles, and downloads with comprehensive metadata tracking.

### ✅ Implemented Features

#### Core Functionality
- **Smart URL Detection**: Automatically detects and handles channels, playlists, single videos, and `/playlists` URLs
- **Playlist Enumeration**: Enumerates all playlists from a YouTube channel with real video counts
- **Individual Playlist Refresh**: Refresh video counts per playlist or all at once
- **Selective Downloading**: Enable/disable individual playlists for download
- **Download Queue System**: Manages multiple concurrent downloads with progress tracking
- **Automatic Scheduling**: Periodic checking for new content with configurable intervals
- **Download Archive**: Tracks downloaded videos to avoid duplicates, syncs with deletions
- **Graceful Shutdown**: Waits up to 3 minutes for downloads to complete, cleans up partial files

#### yt-dlp Profiles System
- **Profile Management**: Create reusable download profiles with custom settings
- **Presets**: "Plex - YouTube-Agent" preset for quick setup
- **Profile Assignment**: Assign profiles to channels (add/edit)
- **Profile Toggles**: 
  - Output template with `-o` flag
  - Format selection (video+audio format specification)
  - Merge output format (container: mp4, mkv, etc.)
  - Verbose flag (shows detailed download progress)
  - Filename format (4 options: normal, restricted, windows, no-restrict)
- **Profile Additional Args**: Custom yt-dlp arguments for advanced use cases
- **4-Level Option Hierarchy**: Channel Toggles > Channel Custom > Profile Toggles > Profile Additional
- **Smart Conflict Detection**: Shows when higher-priority options override lower ones
- **Complete Preview**: Frontend shows exact command that will execute

#### URL Types Supported
1. **Channel URLs**: `@channelname`, `/channel/ID`, `/c/name`, `/user/name`
2. **Playlists-Only URLs**: `@channelname/playlists` (only downloads videos in playlists)
3. **Direct Playlist URLs**: `/playlist?list=...`
4. **Single Video URLs**: `/watch?v=...` or `youtu.be/...` (immediate download)

#### User Interface
- **Sidebar Navigation**: Home, Channels, yt-dlp Profiles, Config pages
- **Home Page (Dashboard)**:
  - Stats boxes: Total Channels, Total Downloads, Library Size (live calculated)
  - Media History table (paginated, "Page X of Y" format)
  - Current Queue table with Start Downloads and Retry Failed buttons
  - Clickable videos to view detailed metadata
- **Channels Page**: 
  - Table with all channels, download counts, total size per channel
  - Click channel to view playlists and settings
  - Add Channel modal with profile selection
- **yt-dlp Profiles Page** (NEW):
  - Manage reusable download profiles
  - Preset system (currently: Plex - YouTube-Agent)
  - Create/Edit/Delete profiles
- **Modals**:
  - Channel details with playlists (clickable) and editable settings
  - Playlist viewer with video list and bulk delete
  - Video metadata viewer with delete/redownload buttons
  - Add Channel modal with profile dropdown
  - Add Profile modal with preset system
- **Auto-refresh**: Live updates every 5 seconds for stats and progress

#### Video Management
- **Detailed Metadata Tracking**:
  - Upload date, duration, file size, file path
  - Resolution (e.g., 1920x1080), frame rate (e.g., 60 FPS)
  - Video codec (e.g., H.264), audio codec (e.g., AAC)
  - Formatted codec display: "H.264 (avc1.64002a)"
- **Video Actions**:
  - Delete video (removes file, metadata, thumbnail, archive entry)
  - Force redownload (resets status, removes from archive)
  - View detailed metadata modal
- **Playlist Actions**:
  - View all videos in playlist with status and size
  - Individual refresh button per playlist
  - Bulk delete all videos in playlist (includes folder cleanup)
- **Queue Management**:
  - View pending, active, and failed downloads
  - Start downloads manually if queue is stuck
  - Retry all failed downloads with one click
  - Clickable queue items to view details
  - Failed downloads show error messages

#### Download Management
- **Output Organization**: 
  - Organized mode: `Uploader [ID]/Playlist [PL_ID]/Index - Title [ID].ext`
  - Flat mode: `Uploader [ID]/Title [ID].ext`
  - Uses playlist URL with index selection for proper metadata
- **Format**: Defaults to 1080p MP4 with audio merge (configurable via profiles)
- **Metadata**: Saves video info JSON and thumbnails
- **Concurrency**: Configurable parallel workers (default: 2)
- **File Path Capture**: Tracks actual file paths using `--print after_move:filepath`
- **Smart Archive Sync**: Removes deleted videos from .downloaded archive
- **SponsorBlock Integration** (NEW):
  - Enable/disable per channel
  - Mark sponsored segments as chapters OR remove them from video
  - 7 category types: Sponsor, Intro, Outro, Self-promotion, Interaction, Preview, Non-music
  - Automatic integration with yt-dlp's `--sponsorblock-mark` and `--sponsorblock-remove` flags

#### Cookie Management
- **Upload via UI**: Paste Netscape-format cookies
- **Format Validation**: Checks cookie format before saving
- **Live Testing**: Test cookies against YouTube age-restricted content
- **Help System**: Tooltips explain cookie workflow
- **Renamed Button**: "Load from cookies.txt" (was "Load Current")
- **Cookie Cleaning Required**: If exporting from browser extensions, ensure ONLY YouTube cookies (not Unraid, Reddit, etc.)
- **JavaScript Runtime**: Requires Node.js runtime (`--js-runtimes node`) and challenge solver (`--remote-components ejs:github`) for age-restricted videos

#### Security & Configuration
- **HTTP Basic Authentication**: Optional username/password protection
- **Logging System**: Winston logger with file rotation and configurable levels
- **Log Levels**: error, warn, info, http, verbose, debug, silly (default: error, configurable via UI)
- **Log Configuration**: UI controls for log level, max size (KB), and rotation count
- **Dynamic Log Level**: Changes apply immediately without restart
- **Cookie Management**: Upload/edit YouTube cookies through UI
- **YouTube Data API v3**: Optional API key for faster enumeration
- **Handle Resolution Caching**: One-time yt-dlp extraction, then API speed forever
- **Environment Variables**: Fully configurable via Docker env vars

#### Database
- **SQLite with WAL mode**: Better concurrency support
- **Tables**: channels, playlists, videos, profiles (NEW)
- **Statistics**: Real-time stats calculation from file_size column
- **Pagination**: Efficient querying for large datasets
- **Migrations**: Automatic schema updates on startup
- **Video Metadata Columns**: resolution, fps, vcodec, acodec, file_path, file_size, error_message

### 📁 Project Structure

```
yt-dlp-ui/
├── src/
│   ├── server.js           # Express API server (~600 lines)
│   ├── database.js         # SQLite operations with profiles (~480 lines)
│   ├── ytdlp-service.js    # yt-dlp wrapper with metadata capture (~340 lines)
│   ├── download-manager.js # Queue & graceful shutdown (~280 lines)
│   ├── scheduler.js        # Automatic periodic downloads (72 lines)
│   └── logger.js           # Winston logger configuration (51 lines)
├── public/
│   ├── index.html          # Sidebar UI with 4 pages & modals
│   ├── css/styles.css      # Pinchflat-inspired dark theme
│   └── js/app.js           # Frontend with video management (~900 lines)
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
profile_id, last_scraped_at, created_at, updated_at
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
downloaded_at, file_path, file_size, error_message, 
resolution, fps, vcodec, acodec, created_at, updated_at
```

**Profiles Table (NEW):**
```sql
id, name, output_template, format_selection, merge_output_format,
verbose, filename_format, additional_args, created_at, updated_at
```

**Config Table (NEW):**
```sql
key, value
-- Stores: log_level, log_max_size_kb, log_max_files
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

4. **Playlist Preview Counts**: YouTube /playlists tab only shows preview (2-3 videos)
   - **Solution**: Individual refresh or download gets real count

5. ~~**Media History View**: Deleted videos remain in history view~~ ✅ **Already Fixed**
   - Videos are properly deleted from database when using DELETE endpoint
   - Media history query only shows videos with status ('completed', 'failed')
   - Deleted videos do not appear in history
   - **Status**: No action needed - working as intended

6. ~~**Failed Download Error Messages**: Shows generic "yt-dlp exited with code 1" instead of actual error~~ ✅ **FIXED v1.4.0**
   - Now captures stderr output from yt-dlp during downloads
   - Error message includes actual yt-dlp error text
   - Examples: "Sign in to confirm you're not a bot", "Video unavailable", "Private video"
   - Stored in database error_message field and displayed in UI
   - Much better for troubleshooting download failures

**All known bugs fixed as of 2026-02-01!**

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
   - sql.js requires `.save()` after all DB operations
   - **SQL.js undefined handling**: Must convert undefined to null explicitly - SQL.js throws "Wrong API use" error on undefined values
   - **Playlist video counts**: YouTube preview shows 2-3 videos, real count requires enumeration

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

### Version 1.3.0 - Comprehensive API Test Coverage (2026-01-31)

**Added comprehensive testing infrastructure:**

**New Test Files:**
- `test/api-endpoints.test.js` (23 tests) - All API endpoint coverage
  - Profile endpoints (GET, POST, PUT, DELETE)
  - Channel endpoints (GET, POST, PUT, DELETE)  
  - Playlist endpoints (GET, PUT, DELETE videos)
  - Video endpoints (GET, DELETE single/bulk)
  - Stats endpoints (global, per-channel, recent)
  - Download control endpoints (start, retry, status, queue)
  - Request validation and error responses (400, 404, 500)
  - Uses supertest for isolated testing with mocked services

- `test/http-auth.test.js` (~30 tests) - Security validation
  - All endpoints protected (return 401 without auth)
  - All endpoints accessible with valid credentials
  - No content leakage in 401 responses
  - Static file protection (HTML, CSS, JS)
  - Requires Docker container with auth env vars
  - Skipped in CI (too slow), runs locally for security validation

**Test Scripts Added:**
- `npm test` - Unit tests only (35 tests, CI-friendly)
- `npm run test:integration` - SponsorBlock integration tests
- `npm run test:auth` - HTTP Basic Auth security tests (Docker required)
- `npm run test:all` - All tests including integration (68+ total)

**Documentation Updates:**
- Updated TESTING_CHECKLIST.md with API testing patterns
- Updated TESTING_CHECKLIST.md with HTTP auth testing patterns
- Updated PROJECT_STATE.md with test coverage details
- Documented technical decisions and alternatives considered

**Test Results:**
- ✅ All 35 unit tests passing in CI (32 seconds)
- ✅ Integration tests skip automatically in CI
- ✅ Follows yt-dlp's 95% unit / 5% integration approach
- ✅ Test job completed successfully on GitHub Actions

**CI/CD Fix - ARM64 Build Issue:**
- **Issue**: ARM64 builds failing with QEMU emulation error
- **Error**: `qemu: uncaught target signal 4 (Illegal instruction) - core dumped`
- **Root Cause**: Node.js Alpine + QEMU incompatibility
- **Solution**: Build AMD64 only (covers 95%+ of users)
- **Workaround**: ARM64 users can build locally
- **Future Options**: Switch to debian-based Node or native ARM64 runners
- **Documentation**: Added to CI_CD_CHECKLIST.md with alternatives

**Technical Decisions:**
1. **supertest for API testing**: Clean integration with Express
2. **Deferred UI JavaScript tests**: API tests provide sufficient coverage
3. **Docker-based auth tests**: Only way to verify real auth middleware
4. **Separate unit/integration tests**: Follows proven yt-dlp pattern
5. **AMD64 only builds**: Pragmatic choice for reliability

**Dependencies Added:**
- `supertest` - HTTP assertion library for Express
- `jsdom` - Installed but not used yet (reserved for future UI tests)

**Final Status:**
- ✅ All tests passing
- ✅ Build pipeline working (AMD64)
- ✅ Docker images published to ghcr.io
- ✅ Documentation complete

### Version 1.2.0 - Production-Ready Documentation (2026-01-31)

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

**Phase 6: Metadata Tracking & Video Management (Current)**
- Fixed download bug: SQL.js undefined values causing crashes
- Fixed playlist video count persistence (don't overwrite on refresh)
- Individual playlist refresh buttons
- File path and metadata extraction from .info.json
- Added video metadata: resolution, fps, vcodec, acodec
- Formatted codec display: "H.264 (avc1.64002a)"
- Fixed output template: Use playlist URL with --playlist-items INDEX
- Graceful shutdown with .part file cleanup
- Delete video: File + metadata + thumbnail + archive entry
- Force redownload: Reset status + remove from archive
- Playlist detail view: Click to see all videos with status/size
- Queue management: Start downloads, retry failed, clickable items
- Download archive sync: Removes deleted videos from .downloaded
- Pagination improvements: "Page X of Y" format
- Playlist bulk delete: Delete all videos + playlist folder
- Fixed cookie notification spam
- **yt-dlp Profiles System**:
  - Create/manage reusable download profiles
  - "Plex - YouTube-Agent" preset
  - Assign profiles to channels
  - Profile database table + full CRUD API
  - Profile UI with presets and form sections

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

6. **Playlist URL with Index Selection** (NEW)
   - **Why**: Individual video URLs lack playlist context (filename becomes "NA [NA]/NA")
   - **Solution**: Download via playlist URL with `--playlist-items INDEX`
   - **Result**: Proper filenames with playlist_title, playlist_id, playlist_index

7. **Download Archive Sync** (NEW)
   - **Why**: yt-dlp skips videos in .downloaded archive
   - **Solution**: Remove from archive when deleting or redownloading
   - **Result**: Deletions and redownloads work correctly

8. **Metadata from .info.json** (NEW)
   - **Why**: yt-dlp saves rich metadata we should display
   - **Solution**: Read .info.json after download completes
   - **Result**: Resolution, FPS, codecs available in UI

9. **Graceful Shutdown** (NEW)
   - **Why**: Docker stop was leaving partial .part files
   - **Solution**: Wait 3 minutes for downloads, clean up on timeout
   - **Result**: Clean shutdowns without artifacts

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
- 2 playlists enumerated:
  - "Final Fantasy XII - The Zodiac Age" (6 videos downloaded)
  - "Ratchet and Clank 2 Developer Commentary" (51 videos total, 0 downloaded)
- 6 videos fully downloaded with complete metadata (resolution, fps, codecs, file paths)
- All features tested and working: delete, redownload, playlist refresh, bulk operations

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
   - **API Routes**: `src/server.js` lines 60-600
   - **Database Methods**: `src/database.js` lines 100-480
   - **yt-dlp Integration**: `src/ytdlp-service.js` lines 29-350
   - **Download Queue**: `src/download-manager.js` lines 15-310
   - **UI Page Rendering**: `public/js/app.js` lines 80-950
   - **Profile Management**: `public/js/app.js` lines 273-925
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

> **Note**: Run `git log --oneline -10` to see latest commits

**Latest Session Changes (2026-02-01):**
- **IMPLEMENTED: Complete Option Hierarchy System** (MAJOR FEATURE)
  - 4-level hierarchy: Channel Toggles > Channel Custom > Profile Toggles > Profile Additional
  - Channel toggles (metadata, thumbnails, subtitles, SponsorBlock) override everything
  - Channel custom options override profile settings
  - Profile toggles (format, merge, output, verbose, filename format) override profile additional args
  - Profile additional args lowest priority
  - Smart conflict detection shows when higher-priority options override lower ones
  - Frontend preview now matches backend download logic exactly
- **IMPLEMENTED: Profile Toggles** (NEW FEATURE)
  - Added verbose toggle to profiles (boolean field)
  - Added filename format dropdown to profiles (4 options: normal, restricted, windows, no-restrict)
  - Added output template to profiles (-o flag)
  - Profile toggles integrated into hierarchy and conflict detection
  - Database migration adds verbose and filename_format columns
- **IMPLEMENTED: Filesystem Flag Exclusivity** (CRITICAL FIX)
  - 4 mutually exclusive flags: --restrict-filenames, --no-restrict-filenames, --windows-filenames, --no-windows-filenames
  - If channel custom has ANY filesystem flag, ALL profile filesystem flags filtered out
  - Prevents conflicts between incompatible filename sanitization options
  - Works across both profile toggles and profile additional args
- **IMPLEMENTED: Complete Argument Display** (CRITICAL FIX)
  - Fixed custom args showing flag without value (e.g., --dateafter with no date)
  - Implemented argument Maps (customArgsMap, profileToggleArgsMap) to store complete arguments
  - Fixed quoted value tokenization (e.g., -o "template with spaces")
  - Advance loop index past ALL consumed tokens when building arguments
  - Conflict detection now shows complete arguments like "--dateafter 20081004"
- **IMPLEMENTED: Logging Configuration System** (NEW FEATURE)
  - Created config table in database with log_level, log_max_size_kb, log_max_files
  - Added UI on Config page: log level dropdown with verbosity descriptions
  - Log level changes apply immediately (no restart needed)
  - Rotation settings apply on restart
  - Default log level changed from 'debug' to 'error' for production
  - At debug/silly level, logs complete yt-dlp command for troubleshooting
  - Supports 6 levels: error, warn, info, http, verbose, debug, silly
- **FIXED: Critical Playlist Download Bug** (CRITICAL FIX)
  - downloadPlaylist() was completely bypassing buildDownloadOptions()
  - Was hardcoding defaults: default format, no toggles, no SponsorBlock, no profiles
  - Only passed raw channel.yt_dlp_options without any hierarchy logic
  - This meant ALL playlist downloads were broken and ignoring user settings
  - Fixed to call buildDownloadOptions() properly and update playlist_index per video
  - Now uses full 4-level hierarchy for every playlist video download
- **IMPLEMENTED: YouTube Handle Resolution Caching** (OPTIMIZATION)
  - @handle URLs now resolved via one-time yt-dlp extraction
  - extractChannelId() method uses yt-dlp --dump-json --playlist-items 0 (fast, no downloads)
  - Channel ID cached in database on first enumeration
  - Subsequent enumerations use fast YouTube API with cached channel_id
  - One-time yt-dlp cost, then API speed forever
  - Graceful fallback if API fails or no key
- **FIXED: Multiple Minor UI/Logic Bugs**
  - Fixed orphaned quoted strings in command preview
  - Fixed duplicate format/merge flags in preview
  - Fixed profile filename dropdown being populated with profile names
  - Fixed playlist_title undefined error in downloadPlaylist()
  - Added smart conflict detection for all profile toggle types
  - Changed final command preview heading to "yt-dlp Command Used for This Channel"

**Files Modified:**
- `src/database.js` - Added profiles verbose/filename_format columns, created config table
- `src/server.js` - Updated profile endpoints, added config API, added ytdlp injection for handle resolution
- `src/download-manager.js` - Implemented 4-level hierarchy, fixed downloadPlaylist(), filesystem exclusivity
- `src/logger.js` - Configurable log level/rotation, default changed to 'error'
- `src/ytdlp-service.js` - Added extractChannelId(), command logging at debug level, accepts cachedChannelId
- `src/youtube-api-service.js` - Added ytdlp injection, resolveHandleToChannelId() uses extraction, enumeratePlaylistsByChannelId()
- `public/index.html` - Added profile toggles UI, added logging config section
- `public/js/app.js` - Complete refactor of updateComputedOptions() for hierarchy, conflict detection, argument maps

**Technical Achievements:**
- Frontend preview logic now 100% matches backend download logic
- Complete visibility into option conflicts and overrides
- Smart filesystem flag handling prevents incompatible combinations
- Logging system provides production defaults with debug capabilities
- Handle resolution provides one-time cost for permanent API speed gain

**Latest Session Changes (2026-01-31):**
- **IMPLEMENTED: Wiki Link Cleanup** (MAINTENANCE)
  - Cloned wiki repository to ~/git/hub/yt-dlp-ui.wiki/
  - Fixed internal wiki links (removed .md extensions, use page names)
  - Updated Home page with organized navigation structure
  - Added references to main repo files (PROJECT_STATE.md, TESTING_CHECKLIST.md, CI_CD_CHECKLIST.md)
  - Fixed CI-CD-Pipeline-Setup.md and Development.md cross-references
  - All wiki pages now use correct linking conventions
- **IMPLEMENTED: Documentation File Responsibilities** (IMPROVEMENT)
  - Updated PROJECT_STATE.md with clear file maintenance matrix
  - Added session startup checklist (read 4 key files)
  - Defined when to update each documentation file
  - Added header notes to CI_CD_CHECKLIST.md and TESTING_CHECKLIST.md
  - Created WIKI_LINK_CLEANUP.md with automated cleanup commands
  - Established documentation maintenance workflow
- **IMPLEMENTED: Comprehensive Testing Documentation** (NEW)
  - Created TESTING_CHECKLIST.md with yt-dlp research findings
  - Documented two-tier testing approach (unit + integration)
  - Added checklist for future test additions
  - Explained CI/CD testing strategy and best practices
  - Included yt-dlp testing strategy analysis
- **IMPLEMENTED: Documentation Wiki Migration** (IMPROVEMENT)
  - Updated README.md to link to GitHub Wiki pages
  - Created wiki structure for all documentation
  - Organized docs: Quickstart, Development, CI/CD, Security, Features
  - Centralized documentation for better discoverability
  - Keep PROJECT_STATE.md, TESTING_CHECKLIST.md, CI_CD_CHECKLIST.md in main repo
- **IMPLEMENTED: UI Footer Links** (IMPROVEMENT)
  - Added GitHub repository link (bottom left sidebar)
  - Added Documentation wiki link (bottom left sidebar)
  - SVG icons for GitHub (octocat) and Docs (book)
  - Hover effects and visual polish
- **IMPLEMENTED: CI/CD Pipeline with GitHub Actions** (NEW FEATURE)
  - Created `.github/workflows/build-and-test.yml` workflow
  - Automated testing and multi-arch Docker builds (amd64, arm64)
  - Publishes to ghcr.io/alexholliz/yt-dlp-ui:latest
  - Branch protection configured (admin can bypass)
  - Tests required to pass before merge
- **IMPLEMENTED: Multi-Stage Docker Builds** (IMPROVEMENT)
  - **Test stage**: Full dependencies + test files for CI testing
  - **Production stage**: Lean image without tests for deployment
  - Tests run in Docker container with full yt-dlp environment
  - Production image excludes test files to minimize size
- **IMPLEMENTED: SponsorBlock Integration** (NEW FEATURE)
  - Added SponsorBlock options to Add Channel and Edit Channel forms
  - Database schema updated with 3 new columns: sponsorblock_enabled, sponsorblock_mode, sponsorblock_categories
  - Automatic database migration for existing installations
  - Two modes: Mark segments as chapters OR Remove segments from video
  - 7 category types supported: sponsor, intro, outro, selfpromo, interaction, preview, music_offtopic
  - Integrated with download-manager to inject `--sponsorblock-mark` or `--sponsorblock-remove` flags
  - UI toggles to show/hide SponsorBlock settings
  - Categories selectable via checkboxes
- **IMPLEMENTED: Comprehensive Test Suite** (MAJOR UPDATE)
  - Using Node.js built-in test runner (`node --test`)
  - **Unit tests** (35 tests - all run in CI):
    - Database operations (test/database.test.js) - 6 tests
    - SponsorBlock flag generation (test/sponsorblock.test.js) - 6 tests
    - **API endpoint coverage** (test/api-endpoints.test.js) - 23 tests
      - All profile endpoints (GET, POST, PUT, DELETE)
      - All channel endpoints (GET, POST, PUT, DELETE)
      - All playlist endpoints (GET, PUT, DELETE videos)
      - All video endpoints (GET, DELETE single/bulk)
      - All stats endpoints (global, per-channel, recent downloads)
      - All download control endpoints (start, retry, status, queue)
      - Request validation and error responses (400, 404, 500)
  - **Integration tests** (~33 tests - skip in CI, run locally):
    - Real yt-dlp execution with SponsorBlock (test/sponsorblock-integration.test.js) - 3 tests
    - **HTTP Basic Auth security** (test/http-auth.test.js) - ~30 tests
      - Tests all endpoints return 401 without authentication
      - Tests all endpoints return success with valid credentials
      - Verifies no content leakage in 401 responses
      - Tests static file protection (HTML, CSS, JS)
      - Starts Docker container with auth env vars for testing
  - **Test Scripts**:
    - `npm test` - Unit tests only (CI-friendly, 35 tests)
    - `npm run test:integration` - SponsorBlock integration tests
    - `npm run test:auth` - HTTP auth security tests (requires Docker)
    - `npm run test:all` - All tests including integration (68+ tests)
  - **Testing Philosophy**: Following yt-dlp's proven 95% unit tests, 5% integration tests approach
  - All unit tests passing in CI
  - Integration tests run locally for manual verification
- **Git Configuration Updated**:
  - Repository configured with alexholliz/alex.holliz@gmail.com
  - All commit history rewritten with correct author info
  - Windows credential cache cleared
  - Created `.github/workflows/build-and-test.yml` for automated builds
  - Builds and publishes multi-arch Docker images (amd64, arm64) to ghcr.io
  - Runs tests on every push and pull request
  - Automatic tagging: `latest`, `main`, and commit SHA tags
  - Uses build cache for faster subsequent builds (2-3 min vs 10 min)
  - Only builds on `main` pushes (PRs only run tests)
  - Created CI_CD_GUIDE.md with full documentation
  - Created PIPELINE_SETUP.md for quick setup reference
  - Updated README.md with CI badge and contributing section
- **FIXED: Cookie test now uses same flags as downloads** (CRITICAL FIX)
  - Added `--js-runtimes node` and `--remote-components ejs:github` to cookie test
  - Removed `-f worst` format specification that was causing failures
  - Test now properly validates cookies for age-restricted videos
  - Added better error logging and account detection in test results
- **FIXED: Large cookie file support** (CRITICAL FIX)
  - Increased Express body parser limit from 100kb to 10mb
  - Supports cookie files with 500+ lines from browser extensions
  - Fixed "PayloadTooLargeError" when pasting large cookie files
- **FIXED: Age-restricted video downloads with cookies** (CRITICAL FIX)
  - Added `--js-runtimes node` to enable Node.js for JavaScript challenge solving
  - Added `--remote-components ejs:github` to download YouTube's challenge solver scripts
  - These flags are required for YouTube's n-parameter challenges since 2026
  - Cookies now properly authenticated: "Found YouTube account cookies", "Detected YouTube Premium subscription"
- **FIXED: Download queue not processing** (CRITICAL FIX)
  - Modified `startDownloads()` to load pending videos from database when queue is empty
  - Created `buildDownloadOptions()` helper to construct download options from channel/playlist
  - "Start Downloads" and "Retry Failed" buttons now work correctly
- **FIXED: Status badge line breaks** (UI FIX)
  - Added `white-space: nowrap` and `display: inline-block` to status badges
  - Set `min-width: 120px` on Status columns to prevent wrapping
  - Status badges now stay on single line when resizing browser window
- **Implemented YouTube Data API v3 support** (optional speed enhancement)
  - Created youtube-api-service.js for API integration
  - Added API key management UI on Config page
  - Added quota tracking (10,000 units/day, resets midnight PT)
  - Automatic fallback to yt-dlp when quota exceeded or no key
  - Speeds up channel/playlist enumeration significantly
  - Backend endpoints for key save/test/delete/quota
- Implemented yt-dlp profiles system (database + API + UI)
- Added edit profile functionality with full modal and preset support
- Fixed profile dropdown selector bug (was selecting non-select elements)
- Added yt-dlp documentation links and tooltips to profile modals
- Enhanced help text with examples for format selection and output templates
- Reorganized channel settings: moved profile selector to top, removed advanced options dropdown
- Added "Last Scraped" column to channels table with relative time formatting
- Created formatDateTime() helper for user-friendly time display
- Fixed formatDateTime() to handle Unix timestamps (seconds → milliseconds conversion)
- Added TZ=America/Los_Angeles to docker-compose for testing
- Added video metadata tracking (resolution, fps, codecs)
- Fixed playlist video count persistence
- Added individual and bulk playlist refresh
- Implemented graceful shutdown with .part cleanup
- Added delete video with file cleanup
- Added force redownload functionality
- Created playlist detail viewer
- Added queue management (start, retry failed)
- Fixed download archive sync on deletions
- Updated pagination to "Page X of Y" format
- Added playlist bulk delete with folder cleanup
- Fixed cookie notification spam
- Fixed SQL.js undefined value handling
- Fixed output template using playlist URL with index
- Improved UI text alignment (added left padding/margins)
- Styled dropdowns to match other inputs
- Removed accidentally committed 'dy' file

---

## Future Roadmap

### Recently Completed (Moved from Roadmap)

- ✅ **Library Size Calculation**: Implemented with file_size column, shows live calculated size on dashboard and per channel
- ✅ **Channel Size Display**: Shows total download size per channel in channels table
- ✅ **Video Management**: Delete videos, force redownload, view detailed metadata
- ✅ **Playlist Management**: View playlist videos, refresh counts, bulk delete operations
- ✅ **Queue Controls**: Start downloads manually, retry failed downloads, view failed items
- ✅ **Metadata Tracking**: Resolution, FPS, video/audio codecs, file paths, file sizes
- ✅ **Graceful Shutdown**: Clean exits with partial file cleanup
- ✅ **Download Archive Sync**: Removes deleted videos from archive file
- ✅ **Pagination Improvements**: "Page X of Y" format throughout UI
- ✅ **Edit Profile Functionality**: Edit existing profiles with full form and preset support
- ✅ **UI Text Alignment**: Added left padding to labels, headings, and help text for better readability
- ✅ **YouTube Data API v3 Support**: Optional API key for 5-10x faster channel enumeration with automatic yt-dlp fallback

### Planned Features (Not Yet Implemented)

#### 🎉 Recently Completed (Moved from Planned → Implemented)

1. ~~**Profile Integration with Downloads**~~ ✅ **COMPLETED v1.4.0**
   - ✅ Use profile settings in download-manager.js
   - ✅ Apply output template from profile
   - ✅ Apply format selection from profile
   - ✅ Complete 4-level hierarchy system
   - ✅ Profile toggles (verbose, filename format, output template)
   - ✅ Smart conflict detection and preview

2. ~~**Enhanced yt-dlp Options**~~ ✅ **COMPLETED v1.2.0-1.4.0**
   - ✅ Subtitle download and embedding options (Channel toggles)
   - ✅ Thumbnail download and embedding options (Channel toggles)
   - ✅ Metadata download and embedding options (Channel toggles)
   - ✅ SponsorBlock integration with 7 categories (v1.2.0)
   - ✅ Per-channel configuration
   - ✅ Modern toggle switch UI design
   - ✅ All options independent: can select both, either, or neither
   - ✅ Maps to yt-dlp flags correctly

3. ~~**Browser Refresh State Preservation**~~ ✅ **COMPLETED v1.3.0**
   - ✅ Save current page/view in localStorage
   - ✅ Restore user to same page after browser refresh
   - ✅ Automatically clicks saved page element to restore state
   - ✅ Improves user experience during active session
   - Commit: b5cf68d (2026-01-31)

4. ~~**YouTube API Quota Tracker Improvements**~~ ✅ **COMPLETED v1.3.0**
   - ✅ Only display quota tracker when API key is configured
   - ✅ Shows helper text when no key: "Add an API key above to see quota information"
   - ✅ Colored progress bar (green/yellow/red) for visual quota tracking
   - ✅ Number formatting with toLocaleString()
   - ✅ Prevents showing 0/10000 when no key configured
   - Commit: 20c68a3 (2026-01-31)

5. ~~**Pipeline Readability in GitHub Actions**~~ ✅ **COMPLETED v1.3.0**
   - ✅ Break out test steps into individual named steps
   - ✅ Clear step names in Actions UI (Install dependencies, Run unit tests, Build production image, Test server startup, Verify server health, Cleanup test server)
   - ✅ Easy to identify which specific test failed
   - ✅ Better progress visibility
   - Commit: f13ef6d (2026-01-31)

6. ~~**AI Agent Instructions File**~~ ✅ **COMPLETED v1.3.0**
   - ✅ Created `.copilot-instructions.md` file
   - ✅ Session start/end checklists
   - ✅ File update rules matrix
   - ✅ Git configuration guidance
   - ✅ Technical constraints documented
   - ✅ Platform-agnostic paths
   - Commit: 13eaebe (2026-01-31)

#### 🚀 High Priority Features

1. **YouTube Authentication & Cookie Management** (Enhanced)
   - Cookie generation with YouTube login or API integration
   - Handles age-restricted and members-only content
   - Automatic cookie refresh/renewal
   - Cookie validation and expiry warnings
   - Solves "Sign in to confirm you're not a bot" issues
   - **NEW**: Cookies only applied to YouTube channels/videos (not other sites)

2. **Plex Media Server Integration**
   - Add Plex connection settings to Config page
   - Configure Plex server URL and authentication token
   - Trigger library refresh after playlist/queue completion
   - Only trigger on full operations (not per-video)
   - Optional: specify which Plex library to refresh

3. **Existing Content Import/Sync**
   - Scan downloads folder for existing content
   - Parse folder structures to identify channels and playlists
   - Auto-create channel and playlist entries in database
   - Match existing files to video IDs
   - Update download archive to prevent re-downloads
   - Handle partial imports gracefully

4. **YouTube Shorts & Livestream Filtering**
   - Add channel options to include/exclude shorts
   - Add channel options to include/exclude livestreams
   - **Default**: Exclude both shorts and livestreams
   - Use yt-dlp filters: `--match-filter "!is_live & duration > 60"`
   - Configurable per-channel

5. **SponsorBlock YouTube-Only Detection**
   - SponsorBlock options only shown for YouTube channels
   - Grey out/disable for non-YouTube content
   - Display message: "SponsorBlock only supported for YouTube content"
   - Detect YouTube URLs vs other sites

#### 🏗️ DevOps & Infrastructure

6. **Stable & Dev Branch Strategy**
    - **Dev branch** (currently main): Latest development work
    - **Stable branch**: Latest release version
    - Container tags: `latest` (dev), `stable`, `v1.x.x`
    - Branch protection: Dev branch requires PRs from contributors
    - Admin can bypass PR requirement on dev branch
    - Releases tagged and pushed to stable branch

7. **Test Pipeline Separation**
    - **Dev pipeline**: Fast unit tests only (35 tests)
    - **Stable pipeline**: Full test suite including integration
    - Full suite includes real SponsorBlock video test
    - Full suite requires YouTube credentials/cookies/API key
    - Pass credentials securely via GitHub Secrets

8. **Documentation File Management**
    - Mark planning .MD files as repo-owner only
    - Use `.git/info/exclude` or `.gitignore` with force-add
    - Files sync to repo but hidden from forks/clones
    - Keeps project state visible to AI across machines
    - **Question**: Best approach for this use case?

#### 🔒 Security & Infrastructure

9. **Reverse Proxy HTTPS Support**
    - Verify basic auth works behind reverse proxy
    - Ensure auth headers preserved through proxy
    - Document nginx/Traefik/Caddy configuration
    - **Question**: Is basic auth password securely stored?
    - **Question**: Any security considerations for HTTPS termination?

#### 📦 Content Management

10. **Channel Non-Playlist Video Downloads**
    - New mode for channels to download videos not in any playlist
    - "All Videos" tab/mode alongside playlists
    - Handles shorts, community posts, live streams
    - Optional: separate enable/disable toggle from playlists

11. **Multi-Site Support (Beyond YouTube)**
    - Support for non-YouTube sites (leveraging yt-dlp's 1000+ extractors)
    - Site-specific configuration profiles
    - URL validation for supported sites
    - Custom metadata extraction per site
    - Examples: Vimeo, Twitch, Twitter/X, Instagram, etc.
    - **YouTube-specific features** only apply to YouTube content

#### 🎯 Nice-to-Have Features

12. **Additional Profile Presets**
    - "720p Space Saver" preset
    - "Max Quality" preset
    - "Audio Only" preset

13. **Video Thumbnails**
    - Display in history table
    - Show in video metadata modal  
    - Lazy load for performance

14. **Advanced Filtering**
    - Filter videos by channel, playlist, or status
    - Search videos by title
    - Date range filtering

15. **Batch Channel Management**
    - Import channels from text file
    - Export channel list
    - Bulk enable/disable channels

16. **Download Statistics**
    - Charts for download history
    - Bandwidth usage tracking
    - Success/failure rates

17. **Mobile Responsive UI**
    - Optimize sidebar for mobile
    - Touch-friendly controls
    - Responsive tables

18. **Notifications**
    - Discord webhook
    - Telegram bot
    - Email alerts
    - Download completion notifications

19. **Advanced Scheduling**
    - Per-channel schedules
    - Time-of-day preferences
    - Bandwidth limiting

20. **Statistics Dashboard**
    - Charts and graphs
    - Download trends
    - Popular playlists
    - Storage usage over time

21. **Export/Import**
    - Backup configuration
    - Import from Pinchflat
    - Export channel list

### Questions to Resolve

These items need research or decisions before implementation:

1. **Documentation File Visibility** (Item 13)
   - **Question**: How to keep .MD planning files in repo but hidden from forks?
   - **Options**: 
     - Use `.git/info/exclude` (local only, doesn't sync)
     - Use `.gitignore` with `git add -f` (still visible in forks)
     - Keep files public (current approach)
     - Use private repo for planning, public for code
   - **Recommendation needed**

2. **AI Agent Instructions File** (Item 14)
   - **Question**: Standard format for AI assistant instructions?
   - **Options**:
     - `.copilot-instructions.md` in repo root
     - Expand PROJECT_STATE.md instructions section
     - Use GitHub Copilot workspace instructions (if available)
   - **Current**: PROJECT_STATE.md has comprehensive AI instructions

3. **Reverse Proxy Security** (Item 15)
   - **Question**: Is basic auth secure behind reverse proxy with HTTPS termination?
   - **Answer needed**: Password storage security
   - **Answer needed**: Headers preserved through nginx/Traefik/Caddy
   - **Action**: Test and document reverse proxy configurations

4. **API Query Tracking** (Item 9)
   - **Question**: Does YouTube API quota tracking actually work?
   - **Action**: Needs testing and verification
   - **Status**: Implemented but unverified

5. **Full Test Suite Authentication** (Item 12)
   - **Question**: Best way to pass YouTube credentials to tests?
   - **Options**:
     - GitHub Secrets for cookies file
     - GitHub Secrets for YouTube credentials
     - YouTube API key only (may not work for all tests)
   - **Security**: Must not expose credentials in logs

### Known Bugs to Fix

1. ~~Channel name not always captured during enumeration~~ (Fixed with URL fallback)
2. ~~Library size shows 0~~ (Fixed - now calculated from database)
3. ~~Queue table shows video IDs instead of titles~~ (Fixed - now shows titles and channel names)
4. ~~No error handling for failed downloads in UI~~ (Fixed - shows error messages and status badges)
5. ~~Modal backdrop click sometimes doesn't close on first click~~ (Fixed - re-added event listeners)
6. ~~Video count not showing in playlists~~ (Fixed with migration and proper enumeration)

### Performance Optimizations Needed

1. ~~Debounce auto-refresh polling~~ ✅ **COMPLETED v1.4.0**
   - Tracks user activity (clicks, keystrokes)
   - Pauses polling for 2 seconds after user interaction
   - Prevents excessive API calls during active navigation
   - Only polls relevant data for current page
2. Virtual scrolling for large video lists
3. Lazy load thumbnails
4. ~~Cache stats calculations~~ ✅ **COMPLETED v1.4.0**
   - 3-second TTL cache for getStats() and getChannelStats()
   - Automatic invalidation on data changes (add/delete/update)
   - Reduces database queries from every 5 seconds to every 3+ seconds
   - Cache hit returns instant results, no database query
5. ~~Optimize database queries with indexes~~ ✅ **Already Implemented**
   - Indexes exist on: channels.url, playlists.channel_id, videos.channel_id, videos.playlist_id, videos.download_status

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


