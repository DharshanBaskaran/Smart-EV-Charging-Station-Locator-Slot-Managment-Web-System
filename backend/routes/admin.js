/**
 * Admin Routes — /api/admin
 * Centralized admin-only endpoints: user mgmt, station approval, activity, broadcast.
 */
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Station = require('../models/Station');
const Port = require('../models/Port');
const Reservation = require('../models/Reservation');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Chat = require('../models/Chat');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════════════════════
// STATION APPROVAL
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/pending-stations — stations awaiting approval
router.get('/pending-stations', requireAuth, requireAdmin, async (req, res) => {
  try {
    const stations = await Station.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(stations.map(s => ({ ...s.toObject(), id: s.stationId })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/approve-station/:id
router.post('/approve-station/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const station = await Station.findOne({ stationId: req.params.id });
    if (!station) return res.status(404).json({ error: 'Station not found' });
    if (station.status === 'approved') return res.json({ message: 'Already approved' });

    station.status = 'approved';
    await station.save();

    // Notify the user who added it
    if (station.addedBy && station.addedBy !== 'system') {
      await createNotification(station.addedBy, 'station_approved', 'Station Approved ✅',
        `Great news! Your station "${station.name}" has been approved and is now live on the Valence network for all users.`);
    }

    logger.info('Station approved', { stationId: req.params.id, by: req.userId });
    res.json({ message: 'Station approved', station: { ...station.toObject(), id: station.stationId } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/reject-station/:id
router.post('/reject-station/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const station = await Station.findOne({ stationId: req.params.id });
    if (!station) return res.status(404).json({ error: 'Station not found' });

    const stationName = station.name;
    const addedBy = station.addedBy;

    // Delete the station and its ports
    await Port.deleteMany({ stationId: req.params.id });
    await Station.deleteOne({ stationId: req.params.id });

    // Notify the user who added it
    if (addedBy && addedBy !== 'system') {
      await createNotification(addedBy, 'station_rejected', 'Station Rejected ❌',
        `Your station "${stationName}" was reviewed and not approved. It has been removed. Contact support for details.`);
    }

    logger.info('Station rejected & deleted', { stationId: req.params.id, by: req.userId });
    res.json({ message: 'Station rejected and deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

// PUT /api/admin/user/:userId/role — toggle user role
router.put('/user/:userId/role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent admin from demoting themselves
    if (user.userId === req.userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const newRole = user.role === 'admin' ? 'user' : 'admin';
    user.role = newRole;
    await user.save();

    await createNotification(user.userId, 'role_change', 'Role Updated 🛡️',
      `Your account role has been changed to "${newRole}" by an administrator.`);

    logger.info('User role changed', { targetUser: req.params.userId, newRole, by: req.userId });
    res.json({ message: `Role changed to ${newRole}`, userId: user.userId, role: newRole });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/user/:userId — delete user
router.delete('/user/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent admin from deleting themselves
    if (user.userId === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await User.deleteOne({ userId: req.params.userId });
    // Clean up user data
    await Reservation.deleteMany({ userId: req.params.userId });
    await Review.deleteMany({ userId: req.params.userId });
    await Notification.deleteMany({ userId: req.params.userId });
    await Chat.deleteMany({ userId: req.params.userId });

    logger.info('User deleted by admin', { deletedUser: req.params.userId, by: req.userId });
    res.json({ message: 'User deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/activity — recent platform activity
router.get('/activity', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [recentReservations, recentReviews, recentUsers, openChats] = await Promise.all([
      Reservation.find({}).sort({ createdAt: -1 }).limit(20).lean(),
      Review.find({}).sort({ createdAt: -1 }).limit(10).lean(),
      User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).limit(10).lean(),
      Chat.find({ status: 'open' }).sort({ updatedAt: -1 }).limit(10).lean(),
    ]);

    res.json({ recentReservations, recentReviews, recentUsers, openChats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// BROADCAST ANNOUNCEMENT
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/broadcast — send notification to all users
router.post('/broadcast', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message required' });

    const users = await User.find({});
    let sent = 0;
    for (const u of users) {
      await createNotification(u.userId, 'announcement', title, message);
      sent++;
    }

    logger.info('Broadcast sent', { by: req.userId, recipients: sent });
    res.json({ message: `Announcement sent to ${sent} users`, sent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
