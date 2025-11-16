require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const knexConfig = require('../config/knexfile')[process.env.NODE_ENV || 'development'];
const Knex = require('knex');
const bodyParser = require('body-parser');

const knex = Knex(knexConfig);

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
const { startRetentionJob } = require('./jobs/retentionCleanup');

const app = express();

// Security headers middleware
app.use((req, res, next) => {
  // HSTS - Force HTTPS for 1 year
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
  next();
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(bodyParser.json());
app.use((req, res, next) => { req.knex = knex; next(); });

app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/documents', docRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/retention', retentionRoutes);
app.use('/api/privacy', privacyRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use((req, res, next) => {
  res.status(404).json({ error: 'API not found' });
});

app.use((err, req, res, next) => {
  console.error('API error:', err.stack || err);
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
  console.log('✅ SSL certificates loaded successfully');
} catch (err) {
  console.warn('⚠️  SSL certificates not found, HTTPS will not be available');
  console.warn('   Generate certificates with: openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes');
}

// Start HTTPS server if certificates are available
if (httpsOptions) {
  const httpsServer = https.createServer(httpsOptions, app);
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`🔒 eDiscovery API (HTTPS) listening on port ${HTTPS_PORT}`);
    startRetentionJob(knex);
  });
  
  // HTTP server that redirects to HTTPS
  const httpApp = express();
  httpApp.use((req, res) => {
    res.redirect(301, `https://${req.headers.host.replace(`:${PORT}`, `:${HTTPS_PORT}`)}${req.url}`);
  });
  
  http.createServer(httpApp).listen(PORT, () => {
    console.log(`⚡ HTTP server on port ${PORT} redirecting to HTTPS`);
  });
} else {
  // Fallback to HTTP only if no certificates
  app.listen(PORT, () => {
    console.log(`⚠️  eDiscovery API (HTTP only) listening on port ${PORT}`);
    console.log(`   WARNING: Running without HTTPS - not secure for production!`);
    startRetentionJob(knex);
  });
}