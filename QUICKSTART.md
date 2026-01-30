# Quick Start Guide

## Running with Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/yt-dlp-ui.git
   cd yt-dlp-ui
   ```

2. **Start the container:**
   ```bash
   docker-compose up -d
   ```

3. **Access the UI:**
   Open your browser to `http://localhost:8189`

## First Time Setup

### 1. Add Your First Channel

1. Go to the web UI
2. In the "Add Channel" section, paste a YouTube channel URL
   - Example: `https://www.youtube.com/@channelname`
3. Check "Enumerate Playlists" (default)
4. Optionally enable "Auto-enable new playlists"
5. Click "Add Channel"

The app will immediately start enumerating playlists in the background!

### 2. Select Playlists to Download

1. Once the channel appears in the list, click "View Details"
2. You'll see all playlists found on that channel
3. Toggle the switch next to each playlist you want to download
4. Enabled playlists will be downloaded on the next scrape

### 3. Optional: Configure Cookies

To download age-restricted or member-only content:

1. Export your YouTube cookies using a browser extension like:
   - [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) (Chrome/Edge)
   - [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/) (Firefox)

2. Save the cookies.txt file to your config directory:
   ```bash
   # If using docker-compose
   cp cookies.txt ./config/cookies.txt
   ```

3. The app will automatically use the cookies file on the next download

### 4. Advanced yt-dlp Options

For power users, you can add custom yt-dlp options:

1. When adding a channel, expand "Advanced Options"
2. Add your custom options in the text field
   - Example: `--format best --write-thumbnail --write-description`
3. These options will be used for all downloads from this channel

## Common Use Cases

### Download Only Recent Videos

When adding a channel, use advanced options:
```
--dateafter 20240101
```

### Custom Output Format

The default output format is:
```
%(uploader)s [%(channel_id)s]/%(playlist_title)s [%(playlist_id)s]/%(playlist_index)s - %(title)s [%(id)s].%(ext)s
```

To customize, modify the `ytdlp-service.js` file.

### Download Archive

The app automatically tracks downloaded videos in the database to avoid re-downloading. You can also use yt-dlp's download archive:

```
--download-archive /downloads/.downloaded
```

## Troubleshooting

### Playlists Not Showing Up

1. Click "View Details" on the channel
2. Click "Refresh Playlists" to manually trigger enumeration
3. Check the Docker logs: `docker-compose logs -f`

### Permission Errors

Make sure the config and downloads directories are writable:
```bash
chmod -R 777 ./config ./downloads
```

Or set proper ownership:
```bash
chown -R 99:100 ./config ./downloads  # Unraid default
```

### yt-dlp Errors

Check the container logs for detailed yt-dlp output:
```bash
docker-compose logs -f yt-dlp-ui
```

## Next Steps

- [ ] Set up scheduling for automatic downloads
- [ ] Configure custom download paths
- [ ] Monitor download status
- [ ] View downloaded videos

See the full [README](README.md) and [Development Guide](DEVELOPMENT.md) for more information!
