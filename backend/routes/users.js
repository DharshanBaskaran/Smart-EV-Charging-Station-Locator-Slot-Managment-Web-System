/**
 * User Profile & Favorites Routes — /api/me, /api/users, /api/favorites
 */
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Station = require('../models/Station');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

// ── GET /api/me ──────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const { passwordHash, ...safe } = req.user.toObject();
  res.json({ ...safe, id: safe.userId });
});

// ── PUT /api/me ──────────────────────────────────────────────────────────────
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { name, email, vehicleType, vehicleModel, batteryRangeKm, batteryHealthPct } = req.body || {};
    const u = req.user;
    if (name !== undefined)           u.name           = name;
    if (email !== undefined)          u.email          = email;
    if (vehicleType !== undefined)    u.vehicleType    = vehicleType;
    if (vehicleModel !== undefined)   u.vehicleModel   = vehicleModel;
    if (batteryRangeKm !== undefined) u.batteryRangeKm = Math.max(0, Number(batteryRangeKm) || 0);
    if (batteryHealthPct !== undefined) u.batteryHealthPct = Math.max(0, Math.min(100, Number(batteryHealthPct) || 100));
    await u.save();
    const { passwordHash, ...safe } = u.toObject();
    res.json({ ...safe, id: safe.userId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/users (admin only) ──────────────────────────────────────────────
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, { passwordHash: 0 });
    res.json(users.map(u => ({ ...u.toObject(), id: u.userId })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/favorites/:stationId (toggle) ──────────────────────────────────
router.post('/favorites/:stationId', requireAuth, async (req, res) => {
  try {
    const { stationId } = req.params;
    const u = req.user;
    const idx = u.favorites.indexOf(stationId);
    if (idx === -1) {
      u.favorites.push(stationId);
    } else {
      u.favorites.splice(idx, 1);
    }
    await u.save();
    res.json({ favorites: u.favorites, isFavorite: idx === -1 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/favorites ───────────────────────────────────────────────────────
router.get('/favorites', requireAuth, async (req, res) => {
  try {
    const u = req.user;
    if (!u.favorites || u.favorites.length === 0) return res.json([]);
    const stations = await Station.find({ stationId: { $in: u.favorites } });
    res.json(stations.map(s => ({ ...s.toObject(), id: s.stationId })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
