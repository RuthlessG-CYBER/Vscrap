const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('../config');

const isProduction = config.nodeEnv === 'production';

// Redirects any plain-HTTP request to HTTPS. Put behind a trusted proxy
// (e.g. a load balancer) that sets x-forwarded-proto, or terminate TLS here directly.
function enforceHttps(req, res, next) {
  if (!isProduction) return next();
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (!isSecure) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
}

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function isAllowedOrigin(origin) {
  if (!origin) return true; // native apps and curl do not send an Origin header
  if (config.allowedOrigins.includes('*')) return true;
  if (config.allowedOrigins.includes(origin)) return true;
  // Expo's web dev server runs on localhost with a random port.
  return !isProduction && LOCAL_ORIGIN.test(origin);
}

const corsMiddleware = cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'],
  maxAge: 86400,
});

const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

function applySecurity(app) {
  app.use(enforceHttps);
  app.use(helmet());
  app.use(corsMiddleware);
  app.use(apiRateLimiter);
}

module.exports = { applySecurity };
