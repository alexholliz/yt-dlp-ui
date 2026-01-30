# Security and Configuration Features

## ✅ All Requested Features Implemented

### 🔐 HTTP Basic Authentication

**Environment Variables:**
- `BASIC_AUTH_USERNAME` - Username for login
- `BASIC_AUTH_PASSWORD` - Password for login

**Behavior:**
- Both must be set to enable authentication
- If either is empty, authentication is disabled (with warning in logs)
- Uses standard HTTP Basic Auth (browser shows login popup)
- Protects entire UI and API

**Example:**
```bash
docker run -e BASIC_AUTH_USERNAME=admin -e BASIC_AUTH_PASSWORD=mysecretpass ...
```

### 📝 Logging System

**Environment Variable:**
- `LOG_LEVEL` - Set to `error`, `warn`, `info`, or `debug` (default: `debug`)

**Log Files:**
- `/config/error.log` - Errors only
- `/config/combined.log` - All log levels
- Max 10MB per file, keeps 5 rotated backups

**Features:**
- Colorized console output
- Timestamped entries
- Stack traces for errors
- File rotation to prevent disk fill

**Example Logs:**
```
2026-01-30 14:38:21 info: Logger initialized with level: debug
2026-01-30 14:38:21 info: Logs directory: /config
2026-01-30 14:38:21 info: Database ready
2026-01-30 14:38:21 warn: Basic authentication is disabled
```

### 💾 SQLite WAL Mode

**What it does:**
- Write-Ahead Logging for better concurrency
- Multiple readers can access database while writing
- Better performance under concurrent load
- Automatic in all deployments

**Files Created:**
- `yt-dlp-ui.sqlite` - Main database
- `yt-dlp-ui.sqlite-wal` - Write-ahead log
- `yt-dlp-ui.sqlite-shm` - Shared memory file

### ⚡ Worker Concurrency

**Environment Variable:**
- `YT_DL_WORKER_CONCURRENCY` - Number of parallel downloads (default: `2`)

**How it Works:**
- Controls how many videos download simultaneously
- Set to `1` if getting IP rate-limited by YouTube
- Higher numbers = faster batch downloads (but more resource usage)
- Applies per queue (downloads are processed in parallel)

**Examples:**
```bash
# Conservative (avoid rate limits)
YT_DL_WORKER_CONCURRENCY=1

# Default (balanced)
YT_DL_WORKER_CONCURRENCY=2

# Aggressive (fast, but may trigger rate limits)
YT_DL_WORKER_CONCURRENCY=4
```

### 🌍 Timezone Configuration

**Environment Variable:**
- `TZ` - IANA timezone (default: `UTC`)

**Examples:**
- `America/New_York`
- `Europe/London`
- `Asia/Tokyo`

**Affects:**
- Log timestamps
- Scheduled task times
- Database timestamps

## Unraid Template Updates

All new features are exposed in the Unraid template:

| Field | Type | Default | Required | Display |
|-------|------|---------|----------|---------|
| Basic Auth Username | Variable | (empty) | No | Always |
| Basic Auth Password | Variable | (empty) | No | Always (masked) |
| Timezone | Variable | UTC | No | Always |
| Log Level | Variable | debug | No | Advanced |
| Worker Concurrency | Variable | 2 | No | Advanced |

## Docker Compose Example

```yaml
version: '3.8'

services:
  yt-dlp-ui:
    image: yt-dlp-ui:latest
    container_name: yt-dlp-ui
    ports:
      - "8189:8189"
    volumes:
      - ./config:/config
      - ./downloads:/downloads
    environment:
      - TZ=America/New_York
      - PORT=8189
      - DB_PATH=/config/yt-dlp-ui.sqlite
      - DOWNLOADS_PATH=/downloads
      - COOKIES_PATH=/config/cookies.txt
      - LOG_LEVEL=debug
      - YT_DL_WORKER_CONCURRENCY=2
      - BASIC_AUTH_USERNAME=admin
      - BASIC_AUTH_PASSWORD=changeme
    restart: unless-stopped
```

## Security Best Practices

1. **Always enable Basic Auth** when exposing to internet
2. **Use strong passwords** (20+ characters, random)
3. **Change default credentials** immediately
4. **Use HTTPS** with reverse proxy (Nginx, Caddy, Traefik)
5. **Restrict network access** with firewall rules
6. **Regular updates** to keep yt-dlp current

## Testing

### Test Basic Auth
```bash
# Should prompt for login
curl http://localhost:8189

# Should work with credentials
curl -u admin:changeme http://localhost:8189/api/channels
```

### Test Logging
```bash
# Check log files
docker exec yt-dlp-ui ls -lh /config/*.log

# Tail logs
docker exec yt-dlp-ui tail -f /config/combined.log
```

### Test Worker Concurrency
```bash
# Set to 1 worker
docker run -e YT_DL_WORKER_CONCURRENCY=1 ...

# Watch downloads (should process sequentially)
curl http://localhost:8189/api/download/status
```

## Migration Notes

**Existing Users:**
- No breaking changes
- Auth is opt-in (disabled by default)
- Logs auto-create in /config
- WAL mode enabled automatically
- Worker concurrency defaults to 2 (same as before)

## Performance Impact

- **WAL Mode**: Negligible overhead, better concurrency
- **Logging**: Minimal (async writes)
- **Auth**: Negligible (simple header check)
- **Worker Concurrency**: Linear scaling with setting

All features are production-ready! 🚀
