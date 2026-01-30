# Development Guide

## Local Development Setup

### Prerequisites
- Node.js 20+
- yt-dlp installed locally
- ffmpeg installed locally

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/yt-dlp-ui.git
cd yt-dlp-ui

# Install dependencies
npm install

# Create necessary directories
mkdir -p data config downloads

# Start development server
npm run dev
```

The app will be available at `http://localhost:8189`.

### Project Structure

```
yt-dlp-ui/
├── src/
│   ├── server.js          # Main Express server
│   ├── database.js        # SQLite database wrapper
│   └── ytdlp-service.js   # yt-dlp integration
├── public/
│   ├── index.html         # Main UI
│   ├── css/
│   │   └── styles.css     # Pinchflat-inspired styling
│   └── js/
│       └── app.js         # Frontend JavaScript
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Building Docker Image

```bash
docker build -t yt-dlp-ui:latest .
```

## Testing

```bash
# Test locally with docker-compose
docker-compose up

# Test the API
curl http://localhost:8189/api/channels
```

## Database Schema

### Channels Table
- `id`: Primary key
- `url`: Channel URL
- `channel_id`: YouTube channel ID
- `channel_name`: Channel name
- `playlist_mode`: 'enumerate' or 'flat'
- `flat_mode`: Boolean
- `auto_add_new_playlists`: Boolean
- `yt_dlp_options`: Custom options string
- `rescrape_interval_days`: Integer
- `last_scraped_at`: Unix timestamp
- `created_at`: Unix timestamp
- `updated_at`: Unix timestamp

### Playlists Table
- `id`: Primary key
- `channel_id`: Foreign key to channels
- `playlist_id`: YouTube playlist ID
- `playlist_title`: Playlist name
- `playlist_url`: Playlist URL
- `enabled`: Boolean (whether to download)
- `last_scraped_at`: Unix timestamp
- `created_at`: Unix timestamp
- `updated_at`: Unix timestamp

### Videos Table
- `id`: Primary key
- `channel_id`: Foreign key to channels
- `playlist_id`: Foreign key to playlists
- `video_id`: YouTube video ID
- `video_title`: Video title
- `video_url`: Video URL
- `uploader`: Channel name
- `upload_date`: Date uploaded to YouTube
- `duration`: Video duration in seconds
- `playlist_index`: Index within playlist
- `download_status`: 'pending', 'downloading', 'completed', 'failed'
- `downloaded_at`: Unix timestamp
- `file_path`: Local file path
- `created_at`: Unix timestamp
- `updated_at`: Unix timestamp

## API Endpoints

### Channels
- `GET /api/channels` - List all channels
- `GET /api/channels/:id` - Get channel details
- `POST /api/channels` - Add new channel
- `PUT /api/channels/:id` - Update channel
- `DELETE /api/channels/:id` - Delete channel
- `POST /api/channels/:id/enumerate` - Re-enumerate playlists

### Playlists
- `GET /api/channels/:id/playlists` - Get playlists for channel
- `PUT /api/playlists/:id` - Update playlist (enable/disable)

### Videos
- `GET /api/channels/:id/videos` - Get videos for channel

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

### Development Workflow

1. Create a feature branch
2. Make your changes
3. Test locally
4. Build and test Docker image
5. Submit pull request

## Roadmap

See README.md for planned features.
