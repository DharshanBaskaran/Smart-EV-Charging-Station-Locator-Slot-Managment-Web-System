/**
 * Auth Routes — /api/auth
 * Login, Register, Logout
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const User = require('../models/User');
const config = require('../config');
const logger = require('../utils/logger');
const { generateToken } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');
const { authLimiter } = require('../middleware/rateLimiter');

// ── Security Questions ───────────────────────────────────────────────────────
const SECURITY_QUESTIONS = [
  "What is the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite movie?",
  "What is the name of the street you grew up on?",
  "What was your childhood nickname?",
  "What is the name of your best friend from childhood?",
  "What is your favorite book?",
  "What was the make of your first car?",
];

// ── GET /api/auth/security-questions — Return the list ───────────────────────
router.get('/security-questions', (req, res) => {
  res.json({ questions: SECURITY_QUESTIONS });
});

// ── Validation rules ─────────────────────────────────────────────────────────
const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const registerValidation = [
  body('username').trim().notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('password').notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').optional().trim().isLength({ max: 100 }),
  body('email').optional().trim().isEmail().withMessage('Invalid email format'),
  body('securityQuestion').notEmpty().withMessage('Security question is required'),
  body('securityAnswer').notEmpty().withMessage('Security answer is required')
    .isLength({ min: 2 }).withMessage('Security answer must be at least 2 characters'),
];

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, details: errors.array() });
  }
  return null;
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', authLimiter, loginValidation, async (req, res) => {
  try {
    const valError = handleValidation(req, res);
    if (valError) return;

    const { username, password } = req.body;
    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Support both bcrypt and legacy SHA-256 hashes for migration
    let passwordValid = false;
    if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
      // Bcrypt hash
      passwordValid = await bcrypt.compare(password, user.passwordHash);
    } else {
      // Legacy SHA-256 hash — verify and upgrade to bcrypt
      const crypto = require('crypto');
      const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
      if (legacyHash === user.passwordHash) {
        passwordValid = true;
        // Auto-upgrade to bcrypt
        user.passwordHash = await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS);
        await user.save();
        logger.info('Upgraded password hash to bcrypt', { userId: user.userId });
      }
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken(user);
    const { passwordHash, ...safe } = user.toObject();

    logger.info('User logged in', { userId: user.userId });
    res.json({ token, user: { ...safe, id: safe.userId } });
  } catch (e) {
    logger.error('Login error', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', authLimiter, registerValidation, async (req, res) => {
  try {
    const valError = handleValidation(req, res);
    if (valError) return;

    const { username, password, name, email, vehicleType, vehicleModel, batteryRangeKm, securityQuestion, securityAnswer } = req.body;

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Username already taken' });

    // Hash password and security answer with bcrypt
    const hashedPassword = await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS);
    const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), config.BCRYPT_SALT_ROUNDS);

    const userId = `u_${Date.now()}`;
    const user = await User.create({
      userId,
      username: username.toLowerCase(),
      passwordHash: hashedPassword,
      role: 'user',
      name: name || username,
      email: email || '',
      vehicleType: vehicleType || 'car',
      vehicleModel: vehicleModel || '',
      batteryRangeKm: Number(batteryRangeKm) || 0,
      securityQuestion: securityQuestion,
      securityAnswer: hashedAnswer,
    });

    const token = generateToken(user);
    const { passwordHash, securityAnswer: sa, ...safe } = user.toObject();

    // Welcome notification
    await createNotification(userId, 'system', 'Welcome to VoltPath! 🎉',
      'Your account has been created. Start exploring charging stations near you.');

    logger.info('User registered', { userId });
    res.status(201).json({ token, user: { ...safe, id: safe.userId } });
  } catch (e) {
    logger.error('Registration error', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth/forgot-password/verify-email ─────────────────────────────
router.post('/forgot-password/verify-email', authLimiter, [
  body('email').trim().notEmpty().isEmail().withMessage('Valid email is required'),
], async (req, res) => {
  try {
    const valError = handleValidation(req, res);
    if (valError) return;

    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }

    if (!user.securityQuestion) {
      return res.status(400).json({ error: 'No security question set for this account. Please contact support.' });
    }

    res.json({
      message: 'Email verified. Please answer your security question.',
      securityQuestion: user.securityQuestion,
      email: email.toLowerCase().trim(),
    });
  } catch (e) {
    logger.error('Forgot password verify-email error', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth/forgot-password/verify-answer ────────────────────────────
router.post('/forgot-password/verify-answer', authLimiter, [
  body('email').trim().notEmpty().isEmail(),
  body('securityAnswer').notEmpty().withMessage('Security answer is required'),
], async (req, res) => {
  try {
    const valError = handleValidation(req, res);
    if (valError) return;

    const { email, securityAnswer } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email' });
    }

    // Compare hashed security answer
    const answerValid = await bcrypt.compare(securityAnswer.toLowerCase().trim(), user.securityAnswer);
    if (!answerValid) {
      logger.warn('Wrong security answer attempt', { email });
      return res.status(401).json({ error: 'Incorrect security answer. Please try again.' });
    }

    // Generate a short-lived reset token (15 min)
    const jwt = require('jsonwebtoken');
    const resetToken = jwt.sign(
      { userId: user.userId, purpose: 'password-reset' },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );

    logger.info('Security answer verified, reset token issued', { userId: user.userId });
    res.json({
      message: 'Security answer verified! You can now reset your password.',
      resetToken,
      username: user.username,
    });
  } catch (e) {
    logger.error('Forgot password verify-answer error', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth/forgot-password/reset ────────────────────────────────────
router.post('/forgot-password/reset', [
  body('resetToken').notEmpty().withMessage('Reset token is required'),
  body('newPassword').notEmpty().isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], async (req, res) => {
  try {
    const valError = handleValidation(req, res);
    if (valError) return;

    const { resetToken, newPassword } = req.body;

    // Verify reset token
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(resetToken, config.JWT_SECRET);
    } catch (tokenErr) {
      return res.status(401).json({ error: 'Reset link has expired. Please start the process again.' });
    }

    if (decoded.purpose !== 'password-reset') {
      return res.status(401).json({ error: 'Invalid reset token' });
    }

    const user = await User.findOne({ userId: decoded.userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update password
    user.passwordHash = await bcrypt.hash(newPassword, config.BCRYPT_SALT_ROUNDS);
    await user.save();

    // Send notification
    await createNotification(user.userId, 'system', 'Password Changed 🔒',
      'Your password has been successfully reset. If you did not make this change, please contact support immediately.');

    logger.info('Password reset successful', { userId: user.userId });
    res.json({ message: 'Password has been reset successfully! You can now login with your new password.' });
  } catch (e) {
    logger.error('Password reset error', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
// With JWT, logout is handled client-side by deleting the token.
// This endpoint exists for API completeness.
router.post('/logout', (req, res) => {
  res.json({ ok: true, message: 'Logged out. Please discard your token.' });
});

module.exports = router;
