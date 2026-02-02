const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Default log level, can be overridden by database config
let LOG_LEVEL = process.env.LOG_LEVEL || 'error';
const LOG_DIR = path.join(process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(__dirname, '../data'));

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Get log rotation settings from environment or defaults
const LOG_MAX_SIZE = parseInt(process.env.LOG_MAX_SIZE_KB || '10240') * 1024; // Convert KB to bytes
const LOG_MAX_FILES = parseInt(process.env.LOG_MAX_FILES || '5');

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level.toUpperCase()}] ${stack || message}`;
    })
  ),
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} ${level}: ${message}`;
        })
      )
    }),
    // File output
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES
    })
  ]
});

logger.info(`Logger initialized with level: ${LOG_LEVEL}`);
logger.info(`Logs directory: ${LOG_DIR}`);
logger.info(`Log max size: ${LOG_MAX_SIZE / 1024}KB, max files: ${LOG_MAX_FILES}`);

module.exports = logger;
