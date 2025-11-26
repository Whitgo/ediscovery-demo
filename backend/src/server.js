require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const knexConfig = require('../config/knexfile')[process.env.NODE_ENV || 'development'];
const Knex = require('knex');
const bodyParser = require('body-parser');

const knex = Knex(knexConfig);

const { sanitizeInput } = require('./middleware/validate');

const authRoutes = require('./api/auth');
const caseRoutes = require('./api/cases');
const docRoutes = require('./api/documents');
const auditRoutes = require('./api/audit');
const tagRoutes = require('./api/tags');
const exportRoutes = require('./api/export');
const userRoutes = require('./api/users');
const notificationRoutes = require('./api/notifications');
const retentionRoutes = require('./api/retention');
const privacyRoutes = require('./api/privacy');
const incidentRoutes = require('./api/incidents');
const backupRoutes = require('./api/backups');
const securityRoutes = require('./api/security');
const outlookRoutes = require('./api/outlook');
const { startRetentionJob } = require('./jobs/retentionCleanup');
const { startBackupScheduler } = require('./jobs/backupScheduler');

const app = express();

// Disable X-Powered-By header to prevent server fingerprinting
app.disable('x-powered-by');

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  }
}));

// CORS Configuration - Tightened for security
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'https://localhost:5173']; // Default for development

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    // In production, you may want to restrict this
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (!origin) {
      return callback(new Error('Not allowed by CORS - missing origin'), false);
    }
    
    // Check if origin is in whitelist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS - origin ${origin} not in whitelist`), false);
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], // Explicit allowed methods
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // Explicit allowed headers
  exposedHeaders: ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'], // Headers exposed to client
  maxAge: 600 // Cache preflight requests for 10 minutes
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Input sanitization middleware - applies to all routes
app.use(sanitizeInput);

app.use((req, res, next) => { req.knex = knex; next(); });

// Rate limiting configurations
// Strict rate limit for authentication endpoints to prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: 'Too many login attempts from this IP, please try again after 15 minutes',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip successful logins from counting (only count failed attempts)
  skipSuccessfulRequests: true
});

// Moderate rate limit for general API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter rate limit for document upload endpoints (resource intensive)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    error: 'Upload limit exceeded, please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Very strict rate limit for data export endpoints (resource intensive)
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 exports per hour
  message: {
    error: 'Export limit exceeded, please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiters to routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/cases', apiLimiter, caseRoutes);
app.use('/api/documents', apiLimiter, docRoutes);
app.use('/api/audit', apiLimiter, auditRoutes);
app.use('/api/tags', apiLimiter, tagRoutes);
app.use('/api/export', exportLimiter, exportRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/notifications', apiLimiter, notificationRoutes);
app.use('/api/retention', apiLimiter, retentionRoutes);
app.use('/api/privacy', apiLimiter, privacyRoutes);
app.use('/api/incidents', apiLimiter, incidentRoutes);
app.use('/api/backups', apiLimiter, backupRoutes);
app.use('/api/security', apiLimiter, securityRoutes);
app.use('/api/outlook', apiLimiter, outlookRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use((req, res, next) => {
  res.status(404).json({ error: 'API not found' });
});

app.use((err, req, res, next) => {
  logger.logError(err, { url: req.url, method: req.method, userId: req.user?.id });
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

const PORT = process.env.PORT || 4000;
const HTTPS_PORT = process.env.HTTPS_PORT || 4443;

// Load SSL certificates
const sslPath = path.join(__dirname, '../ssl');
let httpsOptions = null;

try {
  httpsOptions = {
    key: fs.readFileSync(path.join(sslPath, 'key.pem')),
    cert: fs.readFileSync(path.join(sslPath, 'cert.pem'))
  };
  logger.info('SSL certificates loaded successfully');
} catch (err) {
  logger.warn('SSL certificates not found, HTTPS will not be available');
  logger.warn('Generate certificates with: openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes');
}

// Start HTTPS server if certificates are available
if (httpsOptions) {
  const httpsServer = https.createServer(httpsOptions, app);
  httpsServer.listen(HTTPS_PORT, () => {
    logger.info(`eDiscovery API (HTTPS) listening on port ${HTTPS_PORT}`);
    startRetentionJob(knex);
    logger.info('Data retention cleanup job started');
    startBackupScheduler();
    logger.info('Automated backup scheduler started');
  });
  
  // HTTP server that redirects to HTTPS
  const httpApp = express();
  httpApp.use((req, res) => {
    res.redirect(301, `https://${req.headers.host.replace(`:${PORT}`, `:${HTTPS_PORT}`)}${req.url}`);
  });
  
  http.createServer(httpApp).listen(PORT, () => {
    logger.info(`HTTP server on port ${PORT} redirecting to HTTPS`);
  });
} else {
  // Fallback to HTTP only if no certificates
  app.listen(PORT, () => {
    logger.warn(`eDiscovery API (HTTP only) listening on port ${PORT}`);
    logger.warn('WARNING: Running without HTTPS - not secure for production!');
    startRetentionJob(knex);
    logger.info('Data retention cleanup job started');
    startBackupScheduler();
    logger.info('Automated backup scheduler started');
  });
}