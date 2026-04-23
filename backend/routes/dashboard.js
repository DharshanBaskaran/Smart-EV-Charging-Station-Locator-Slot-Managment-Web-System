/**
 * Dashboard & Analytics Routes — /api/dashboard, /api/admin/stats, /api/cost-estimate
 */
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Station = require('../models/Station');
const Port = require('../models/Port');
const Reservation = require('../models/Reservation');
const Review = require('../models/Review');
const ChargingSession = require('../models/ChargingSession');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { haversineKm } = require('../utils/helpers');

// ── GET /api/dashboard — user dashboard stats ────────────────────────────────
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const totalReservations = await Reservation.countDocuments({ userId });
    const activeReservations = await Reservation.countDocuments({ userId, status: 'confirmed' });
    const cancelledReservations = await Reservation.countDocuments({ userId, status: 'cancelled' });
    const recentReservations = await Reservation.find({ userId }).sort({ createdAt: -1 }).limit(5);
    const totalReviews = await Review.countDocuments({ userId });
    const favCount = req.user.favorites ? req.user.favorites.length : 0;

    // Nearby stations count
    const lat = 12.9716, lng = 77.5946;
    const allStations = await Station.find({});
    const nearbyCount = allStations.filter(s =>
      haversineKm(lat, lng, s.lat, s.lng) <= (req.user.batteryRangeKm || 50)
    ).length;

    // Charging session stats
    const completedSessions = await ChargingSession.find({ userId, status: 'completed' });
    const totalSessions = completedSessions.length;
    const totalEnergyKwh = parseFloat(completedSessions.reduce((sum, s) => sum + (s.energyKwh || 0), 0).toFixed(2));
    const totalSpentINR = parseFloat(completedSessions.reduce((sum, s) => sum + (s.totalCostINR || 0), 0).toFixed(2));

    res.json({
      totalReservations,
      activeReservations,
      cancelledReservations,
      totalReviews,
      favoriteStations: favCount,
      nearbyStations: nearbyCount,
      batteryRange: req.user.batteryRangeKm || 0,
      batteryHealth: req.user.batteryHealthPct || 100,
      vehicleType: req.user.vehicleType || 'car',
      vehicleModel: req.user.vehicleModel || '',
      recentReservations: recentReservations.map(r => ({ ...r.toObject(), id: r.reservationId })),
      // Month 2 additions
      totalSessions,
      totalEnergyKwh,
      totalSpentINR,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/admin/stats — admin analytics ───────────────────────────────────
router.get('/admin/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({});
    const totalStations = await Station.countDocuments({});
    const totalPorts = await Port.countDocuments({});
    const totalReservations = await Reservation.countDocuments({});
    const activeReservations = await Reservation.countDocuments({ status: 'confirmed' });
    const cancelledReservations = await Reservation.countDocuments({ status: 'cancelled' });
    const totalReviews = await Review.countDocuments({});
    const communityStations = await Station.countDocuments({ stationId: { $regex: /^st_community/ } });

    // Reservations per day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRes = await Reservation.find({ createdAt: { $gte: sevenDaysAgo } });
    const perDay = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      perDay[key] = 0;
    }
    recentRes.forEach(r => {
      const key = new Date(r.createdAt).toISOString().split('T')[0];
      if (perDay[key] !== undefined) perDay[key]++;
    });

    // Top 5 stations by reservations
    const allRes = await Reservation.find({});
    const stationResCount = {};
    for (const r of allRes) {
      const port = await Port.findOne({ portId: r.portId });
      if (port) {
        stationResCount[port.stationId] = (stationResCount[port.stationId] || 0) + 1;
      }
    }
    const topStationIds = Object.entries(stationResCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topStations = [];
    for (const [sid, count] of topStationIds) {
      const s = await Station.findOne({ stationId: sid });
      if (s) topStations.push({ name: s.name, city: s.city, count });
    }

    // Connector type distribution
    const ports = await Port.find({});
    const connectorDist = {};
    ports.forEach(p => {
      connectorDist[p.connectorType] = (connectorDist[p.connectorType] || 0) + 1;
    });

    res.json({
      totalUsers, totalStations, totalPorts, totalReservations,
      activeReservations, cancelledReservations, totalReviews,
      communityStations, reservationsPerDay: perDay,
      topStations, connectorDistribution: connectorDist,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/cost-estimate ───────────────────────────────────────────────────
router.get('/cost-estimate', async (req, res) => {
  try {
    const portId = req.query.portId;
    const durationMin = parseFloat(req.query.durationMin) || 60;
    if (!portId) return res.status(400).json({ error: 'portId required' });

    const port = await Port.findOne({ portId });
    if (!port) return res.status(404).json({ error: 'Port not found' });

    const durationHours = durationMin / 60;
    const energyKwh = port.powerKw * durationHours;
    const costINR = energyKwh * (port.pricePerKwh || 12);

    res.json({
      portId,
      connectorType: port.connectorType,
      powerKw: port.powerKw,
      pricePerKwh: port.pricePerKwh || 12,
      durationMin,
      energyKwh: parseFloat(energyKwh.toFixed(2)),
      estimatedCostINR: parseFloat(costINR.toFixed(2)),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
