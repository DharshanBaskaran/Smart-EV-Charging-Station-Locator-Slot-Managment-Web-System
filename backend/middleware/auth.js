/**
 * Authentication Middleware — JWT-based
 * Replaces the old in-memory session store.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Generate a JWT token for a user.
 */
function generateToken(user) {
  return jwt.sign(
    { userId: user.userId, role: user.role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
}

/**
 * Required authentication middleware.
 * Extracts and verifies JWT from Authorization header.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please provide a valid token.' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');

    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired. Please log in again.' });
      }
      return res.status(401).json({ error: 'Invalid token.' });
    }

    const user = await User.findOne({ userId: decoded.userId });
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.user = user;
    next();
  } catch (err) {
    logger.error('Auth middleware error', { error: err.message });
    res.status(500).json({ error: 'Authentication error.' });
  }
}

/**
 * Admin-only middleware. Must be used AFTER requireAuth.
 */
function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

/**
 * Optional authentication — extracts user info if token is present but doesn't fail if absent.
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
      } catch (_) {
        // Token invalid or expired — proceed as unauthenticated
      }
    }
  } catch (_) {
    // Silently fail
  }
  next();
}

module.exports = { generateToken, requireAuth, verifyToken: requireAuth, requireAdmin, optionalAuth };
