const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://localhost:4443',
      changeOrigin: true,
      secure: false, // Accept self-signed certificates
      logLevel: 'debug'
    })
  );
};
