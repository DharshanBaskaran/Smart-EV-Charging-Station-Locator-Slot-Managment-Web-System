/**
 * Notification Routes — /api/notifications
 */
const express = require('express');
const router = express.Router();

const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');

// ── GET /api/notifications ───────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const list = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ userId: req.userId, read: false });
    res.json({ notifications: list, unreadCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/notifications/read-all ──────────────────────────────────────────
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.userId, read: false }, { read: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/notifications/:id/read ──────────────────────────────────────────
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await Notification.updateOne(
      { notificationId: req.params.id, userId: req.userId },
      { read: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
