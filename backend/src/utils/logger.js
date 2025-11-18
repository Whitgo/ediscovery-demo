/**
 * Centralized Logging Utility
 * Uses Winston for structured logging with daily rotation
 * 
 * Log Levels:
 * - error: 0 (critical errors requiring immediate attention)
 * - warn: 1 (warnings that should be reviewed)
 * - info: 2 (general informational messages)
 * - http: 3 (HTTP request/response logging)
 * - debug: 4 (detailed debugging information)
 * 
 * Log Files:
 * - logs/error-%DATE%.log: Error logs (retained 30 days)
 * - logs/combined-%DATE%.log: All logs (retained 14 days)
 * - Console: Development mode only
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logs directory path
const logsDir = path.join(__dirname, '../../logs');

// Transport configuration
const transports = [];

// File transport for errors (always enabled except in tests)
if (!isTest) {
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: logFormat,
      maxFiles: '30d',
      maxSize: '20m',
      zippedArchive: true,
    })
  );

  // File transport for all logs (always enabled except in tests)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
      maxFiles: '14d',
      maxSize: '20m',
      zippedArchive: true,
    })
  );
}

// Console transport (development only, or when DEBUG is set)
if (!isProduction || process.env.DEBUG) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      silent: isTest, // Suppress console logs during tests
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: logFormat,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Helper methods for structured logging
logger.logRequest = (req, message = 'Incoming request') => {
  logger.http(message, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user?.id,
    userRole: req.user?.role,
  });
};

logger.logResponse = (req, res, duration) => {
  logger.http('Response sent', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userId: req.user?.id,
  });
};

logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context,
  });
};

logger.logAudit = (action, userId, details = {}) => {
  logger.info('Audit event', {
    type: 'audit',
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

logger.logSecurity = (event, details = {}) => {
  logger.warn('Security event', {
    type: 'security',
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

logger.logPerformance = (operation, duration, details = {}) => {
  const level = duration > 1000 ? 'warn' : 'debug';
  logger.log(level, 'Performance metric', {
    type: 'performance',
    operation,
    duration: `${duration}ms`,
    ...details,
  });
};

// Log uncaught exceptions and unhandled rejections
if (!isTest) {
  logger.exceptions.handle(
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
    })
  );

  logger.rejections.handle(
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
    })
  );
}

module.exports = logger;
