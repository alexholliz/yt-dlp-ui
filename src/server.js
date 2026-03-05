const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { createSessionMiddleware, createAuthGuard, loginHandler, logoutHandler } = require('./middleware/session-auth');
const path = require('path');
const fs = require('fs');
const DB = require('./database');
const YtDlpService = require('./ytdlp-service');
const YouTubeApiService = require('./youtube-api-service');
const DownloadManager = require('./download-manager');
const Scheduler = require('./scheduler');
const logger = require('./logger');

// Route modules
const profilesRouter = require('./routes/profiles');
const channelsRouter = require('./routes/channels');
const playlistsRouter = require('./routes/playlists');
const videosRouter = require('./routes/videos');
const downloadsRouter = require('./routes/downloads');
const statsRouter = require('./routes/stats');
const schedulerRouter = require('./routes/scheduler');
const cookiesRouter = require('./routes/cookies');
const youtubeApiRouter = require('./routes/youtube-api');
const configRouter = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 8189;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/yt-dlp-ui.sqlite');
const DOWNLOADS_PATH = process.env.DOWNLOADS_PATH || path.join(__dirname, '../downloads');
const COOKIES_PATH = process.env.COOKIES_PATH || path.join(__dirname, '../config/cookies.txt');

// Ensure directories exist
[path.dirname(DB_PATH), DOWNLOADS_PATH, path.dirname(COOKIES_PATH)].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize services
const db = new DB(DB_PATH);
const youtubeApi = new YouTubeApiService();
const ytdlp = new YtDlpService(COOKIES_PATH, youtubeApi);
youtubeApi.setYtDlpService(ytdlp); // Enable handle resolution via yt-dlp
const downloadManager = new DownloadManager(db, ytdlp, DOWNLOADS_PATH);
const scheduler = new Scheduler(db, downloadManager);

// Shared services object injected into every route module
const services = { db, ytdlp, youtubeApi, downloadManager, scheduler, DOWNLOADS_PATH, COOKIES_PATH };

// Wait for DB to initialize
db.ready.then(() => {
  logger.info('Database ready');
  youtubeApi.setDb(db); // load encrypted API key from DB

  // Load log level from database
  const configLogLevel = db.getConfig('log_level');
  if (configLogLevel) {
    logger.level = configLogLevel;
    logger.info(`Log level set from database: ${configLogLevel}`);
  }

  // Middleware
  app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for large cookie files
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use(createSessionMiddleware());

  // Login / logout routes — always accessible (no auth required)
  app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
  app.post('/auth/login', loginHandler);
  app.post('/auth/logout', logoutHandler);

  // Auth guard: when credentials are configured, unauthenticated browsers are
  // redirected to /login and API clients receive 401.
  // When no credentials are configured the guard is null and auth is disabled.
  const authGuard = createAuthGuard();
  if (authGuard) {
    app.use(authGuard);
  }

  // Static files (CSS/JS/favicon exempt from auth guard via prefix check in session-auth.js)
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

  app.use('/api/profiles', profilesRouter(services));
  app.use('/api/channels', channelsRouter(services));
  app.use('/api/playlists', playlistsRouter(services));
  app.use('/api/videos', videosRouter(services));
  app.use('/api/download', downloadsRouter(services));
  app.use('/api/downloads', downloadsRouter(services));  // /api/downloads/recent alias
  app.use('/api/stats', statsRouter(services));
  app.use('/api/scheduler', schedulerRouter(services));
  app.use('/api/cookies', cookiesRouter(services));
  app.use('/api/youtube-api', youtubeApiRouter(services));
  app.use('/api/config', configRouter(services));

  // Global error handler (catches errors forwarded by asyncHandler)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error(`Unhandled error on ${req.method} ${req.path}:`, err);
    res.status(500).json({ error: err.message });
  });

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`yt-dlp-ui server running on port ${PORT}`);
    logger.info(`Database: ${DB_PATH}`);
    logger.info(`Cookies: ${COOKIES_PATH}`);
  });

  // Graceful shutdown
  let isShuttingDown = false;

  async function handleShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`${signal} received, initiating graceful shutdown...`);
    scheduler.stop();
    await downloadManager.gracefulShutdown(180000);
    db.close();
    logger.info('Shutdown complete');
    process.exit(0);
  }

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
});
