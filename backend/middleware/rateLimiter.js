/**
 * Rate Limiting Middleware
 * Protects against brute-force attacks on auth endpoints.
 */
const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * General API rate limiter — 100 requests per 15 minutes per IP.
 */
const generalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

/**
 * Strict auth rate limiter — 10 attempts per 15 minutes per IP.
 * Applied to login and register endpoints.
 */
const authLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login/register attempts. Please try again later.' },
});

module.exports = { generalLimiter, authLimiter };
