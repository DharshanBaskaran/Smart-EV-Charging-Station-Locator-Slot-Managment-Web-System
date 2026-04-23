/**
 * Charging Session Routes — /api/sessions
 * Start, monitor, stop, and view charging sessions.
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const ChargingSession = require('../models/ChargingSession');
const Port = require('../models/Port');
const Reservation = require('../models/Reservation');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');
const { startChargingSimulation, stopChargingSimulation, emitToUser } = require('../utils/socketManager');
const logger = require('../utils/logger');

// ── POST /api/sessions/start — Begin a charging session ──────────────────────
router.post('/start', requireAuth, [
  body('portId').notEmpty().withMessage('portId is required'),
  body('durationMin').optional().isInt({ min: 5, max: 180 }).withMessage('Duration must be 5-180 minutes'),
  body('batteryStartPct').optional().isInt({ min: 0, max: 100 }),
  body('batteryTargetPct').optional().isInt({ min: 1, max: 100 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { portId, durationMin = 30, batteryStartPct = 20, batteryTargetPct = 80, reservationId } = req.body;

    // Check for existing active session for this user
    const existingSession = await ChargingSession.findOne({
      userId: req.userId,
      status: { $in: ['pending', 'charging'] },
    });
    if (existingSession) {
      return res.status(409).json({
        error: 'You already have an active charging session.',
        activeSession: existingSession,
      });
    }

    // Get port details
    const port = await Port.findOne({ portId });
    if (!port) return res.status(404).json({ error: 'Port not found' });

    const sessionId = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const session = await ChargingSession.create({
      sessionId,
      userId: req.userId,
      portId,
      stationId: port.stationId,
      reservationId: reservationId || '',
      status: 'charging',
      startedAt: new Date(),
      durationMin: Number(durationMin),
      powerKw: port.powerKw,
      pricePerKwh: port.pricePerKwh || 12,
      connectorType: port.connectorType,
      batteryStartPct: Number(batteryStartPct),
      batteryEndPct: Number(batteryStartPct),
      batteryTargetPct: Number(batteryTargetPct),
      progressPct: 0,
    });

    // Start the simulation
    startChargingSimulation(session.toObject());

    await createNotification(req.userId, 'system', 'Charging Started ⚡',
      `Your ${port.powerKw}kW charging session has started. Estimated duration: ${durationMin} minutes.`);

    logger.info('Charging session started', { sessionId, userId: req.userId, portId });
    res.status(201).json({ ...session.toObject(), id: session.sessionId });
  } catch (e) {
    logger.error('Session start error', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/sessions/:id/stop — Stop a charging session early ──────────────
router.post('/:id/stop', requireAuth, async (req, res) => {
  try {
    const session = await ChargingSession.findOne({ sessionId: req.params.id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.userId !== req.userId) return res.status(403).json({ error: 'Not your session' });
    if (session.status !== 'charging') {
      return res.status(400).json({ error: 'Session is not actively charging' });
    }

    // Stop simulation
    stopChargingSimulation(session.sessionId);

    // Calculate final values
    const elapsed = Date.now() - new Date(session.startedAt).getTime();
    const elapsedMin = elapsed / 60000;
    const energyKwh = parseFloat((session.powerKw * (elapsedMin / 60)).toFixed(2));
    const totalCost = parseFloat((energyKwh * session.pricePerKwh).toFixed(2));

    session.status = 'completed';
    session.completedAt = new Date();
    session.durationMin = Math.round(elapsedMin);
    session.energyKwh = energyKwh;
    session.totalCostINR = totalCost;
    session.progressPct = 100;
    await session.save();

    emitToUser(req.userId, 'charging-complete', {
      sessionId: session.sessionId,
      energyKwh, totalCostINR: totalCost,
      stoppedEarly: true,
    });

    await createNotification(req.userId, 'system', 'Charging Complete ✅',
      `Session finished. ${energyKwh} kWh consumed. Total: ₹${totalCost}`);

    logger.info('Charging session stopped', { sessionId: req.params.id, energyKwh, totalCost });
    res.json({ ...session.toObject(), id: session.sessionId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/sessions/active — Get current active session ────────────────────
router.get('/active', requireAuth, async (req, res) => {
  try {
    const session = await ChargingSession.findOne({
      userId: req.userId,
      status: { $in: ['pending', 'charging'] },
    });
    res.json(session ? { ...session.toObject(), id: session.sessionId } : null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/sessions/history — Get past sessions ────────────────────────────
router.get('/history', requireAuth, async (req, res) => {
  try {
    const sessions = await ChargingSession.find({ userId: req.userId })
      .sort({ createdAt: -1 }).limit(50);
    res.json(sessions.map(s => ({ ...s.toObject(), id: s.sessionId })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/sessions/:id — Get session details ──────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const session = await ChargingSession.findOne({ sessionId: req.params.id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.userId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ ...session.toObject(), id: session.sessionId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
