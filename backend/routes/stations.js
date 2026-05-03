/**
 * Station Routes — /api/stations
 */
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const router = express.Router();

const Station = require('../models/Station');
const Port = require('../models/Port');
const Review = require('../models/Review');
const User = require('../models/User');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');
const { haversineKm, getPortStatus } = require('../utils/helpers');
const { createNotification } = require('../utils/notifications');
const logger = require('../utils/logger');

// ── GET /api/stations ────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    // Admins see all stations; regular users only see approved
    const filter = (req.userRole === 'admin') ? {} : { status: { $ne: 'rejected' } };
    // Show pending only to the user who added them + admins
    let stations = await Station.find(filter);
    if (req.userRole !== 'admin') {
      stations = stations.filter(s =>
        s.status === 'approved' || (s.status === 'pending' && s.addedBy === req.userId)
      );
    }
    const lat    = parseFloat(req.query.lat);
    const lng    = parseFloat(req.query.lng);
    const rangeKm = parseFloat(req.query.rangeKm);
    const connectorType = req.query.connectorType;
    const minPowerKw = parseFloat(req.query.minPowerKw);

    let result = stations.map(s => ({ ...s.toObject(), id: s.stationId }));

    if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(rangeKm) && rangeKm > 0) {
      result = result.filter(s => haversineKm(lat, lng, s.lat, s.lng) <= rangeKm);
      result.sort((a, b) => haversineKm(lat, lng, a.lat, a.lng) - haversineKm(lat, lng, b.lat, b.lng));
    }

    // Connector type filtering
    if (connectorType) {
      const stationIdsWithConnector = (await Port.find({ connectorType: { $regex: connectorType, $options: 'i' } }))
        .map(p => p.stationId);
      const connectorSet = new Set(stationIdsWithConnector);
      result = result.filter(s => connectorSet.has(s.stationId));
    }

    // Min power filtering
    if (Number.isFinite(minPowerKw) && minPowerKw > 0) {
      const stationIdsWithPower = (await Port.find({ powerKw: { $gte: minPowerKw } }))
        .map(p => p.stationId);
      const powerSet = new Set(stationIdsWithPower);
      result = result.filter(s => powerSet.has(s.stationId));
    }

    res.json(result);
  } catch (e) {
    logger.error('Station list error', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/stations ───────────────────────────────────────────────────────
router.post('/', requireAuth, [
  body('name').trim().notEmpty().withMessage('Station name is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, address, lat, lng, operator, city, state } = req.body;
    const stationId = `st_community_${Date.now()}`;
    const isAdmin = req.userRole === 'admin';
    const station = await Station.create({
      stationId,
      name: name.trim(),
      address: address.trim(),
      lat: Number(lat),
      lng: Number(lng),
      operator: (operator || 'Community').trim(),
      city: city || '',
      state: state || '',
      addedBy: req.userId,
      status: isAdmin ? 'approved' : 'pending',
    });

    // Create a default port
    await Port.create({
      portId: `p_${stationId}_1`,
      stationId,
      connectorType: 'Type 2',
      powerKw: 22,
      pricePerKwh: 12,
    });

    if (isAdmin) {
      await createNotification(req.userId, 'station_added', 'Station Added ⚡',
        `Your station "${name}" has been added to the Valence network.`);
    } else {
      await createNotification(req.userId, 'station_pending', 'Station Pending Approval ⏳',
        `Your station "${name}" has been submitted and is pending admin approval.`);
      // Notify all admins
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await createNotification(admin.userId, 'admin_review', 'New Station Needs Approval 🔔',
          `User submitted station "${name}" at ${address}. Review it in the Admin Panel.`);
      }
    }

    logger.info('Station created', { stationId, by: req.userId, status: station.status });
    res.status(201).json({ ...station.toObject(), id: station.stationId });
  } catch (e) {
    logger.error('Station creation error', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/stations/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const station = await Station.findOne({ stationId: req.params.id });
    if (!station) return res.status(404).json({ error: 'Station not found' });

    const ports = await Port.find({ stationId: req.params.id });
    const stationPorts = ports.map(p => ({
      ...p.toObject(),
      id: p.portId,
      ...getPortStatus(p.portId),
    }));

    // Get average rating
    const reviews = await Review.find({ stationId: req.params.id });
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    res.json({
      ...station.toObject(),
      id: station.stationId,
      ports: stationPorts,
      avgRating: avgRating ? parseFloat(avgRating) : null,
      reviewCount: reviews.length,
    });
  } catch (e) {
    logger.error('Station detail error', { error: e.message, stationId: req.params.id });
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/stations/:id (admin only) ───────────────────────────────────────
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const station = await Station.findOne({ stationId: req.params.id });
    if (!station) return res.status(404).json({ error: 'Station not found' });

    const { name, address, operator, city, state, lat, lng } = req.body;
    if (name !== undefined) station.name = name.trim();
    if (address !== undefined) station.address = address.trim();
    if (operator !== undefined) station.operator = operator.trim();
    if (city !== undefined) station.city = city;
    if (state !== undefined) station.state = state;
    if (lat !== undefined) station.lat = Number(lat);
    if (lng !== undefined) station.lng = Number(lng);
    await station.save();

    logger.info('Station updated', { stationId: req.params.id, by: req.userId });
    res.json({ ...station.toObject(), id: station.stationId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/stations/:id (admin only) ────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await Station.deleteOne({ stationId: req.params.id });
    await Port.deleteMany({ stationId: req.params.id });
    await Review.deleteMany({ stationId: req.params.id });

    logger.info('Station deleted', { stationId: req.params.id, by: req.userId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
