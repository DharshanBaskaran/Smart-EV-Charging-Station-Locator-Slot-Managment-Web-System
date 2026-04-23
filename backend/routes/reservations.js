/**
 * Reservation Routes — /api/reservations
 * Now properly authenticated — no more guest bookings.
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const Reservation = require('../models/Reservation');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');
const logger = require('../utils/logger');

// ── POST /api/reservations ───────────────────────────────────────────────────
router.post('/', requireAuth, [
  body('portId').notEmpty().withMessage('portId is required'),
  body('startTime').isISO8601().withMessage('Valid startTime required'),
  body('endTime').isISO8601().withMessage('Valid endTime required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { portId, startTime, endTime } = req.body;
    const reqStart = new Date(startTime);
    const reqEnd   = new Date(endTime);

    // Validate duration (max 3 hours)
    const durationMs = reqEnd - reqStart;
    if (durationMs <= 0 || durationMs > 3 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Duration must be between 1 minute and 3 hours.' });
    }

    // Overlap conflict check
    const conflict = await Reservation.findOne({
      portId,
      status: 'confirmed',
      startTime: { $lt: reqEnd },
      endTime:   { $gt: reqStart },
    });
    if (conflict) {
      return res.status(409).json({ error: 'This time slot overlaps with an existing reservation.' });
    }

    const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const reservation = await Reservation.create({
      reservationId,
      userId: req.userId,
      portId,
      startTime: reqStart,
      endTime:   reqEnd,
      status:    'confirmed',
    });

    const durationMin = Math.round(durationMs / 60000);
    await createNotification(req.userId, 'reservation_confirmed', 'Booking Confirmed ✅',
      `Your ${durationMin}-minute charging slot has been reserved (${reqStart.toLocaleString()}).`);

    logger.info('Reservation created', { reservationId, userId: req.userId, portId });
    res.status(201).json({ ...reservation.toObject(), id: reservation.reservationId });
  } catch (e) {
    logger.error('Reservation creation error', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/reservations ────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const now = new Date();

    // Auto-expire: mark confirmed reservations whose endTime has passed as 'completed'
    const expired = await Reservation.find({
      userId: req.userId,
      status: 'confirmed',
      endTime: { $lte: now },
    });

    if (expired.length > 0) {
      await Reservation.updateMany(
        { userId: req.userId, status: 'confirmed', endTime: { $lte: now } },
        { $set: { status: 'completed' } }
      );
      // Send notification for each expired one
      for (const r of expired) {
        await createNotification(req.userId, 'session_complete', 'Charging Session Complete ⚡',
          `Your session on Port ${r.portId} has ended. Hope you had a great charge! Book again anytime.`);
      }
      logger.info('Auto-expired reservations', { userId: req.userId, count: expired.length });
    }

    // Return only active (future) confirmed reservations
    const active = await Reservation.find({ userId: req.userId, status: 'confirmed' })
      .sort({ startTime: 1 });

    res.json({
      reservations: active.map(r => ({ ...r.toObject(), id: r.reservationId })),
      expiredCount: expired.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/reservations/history ────────────────────────────────────────────
router.get('/history', requireAuth, async (req, res) => {
  try {
    const list = await Reservation.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(list.map(r => ({ ...r.toObject(), id: r.reservationId })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/reservations/:id ─────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const r = await Reservation.findOne({ reservationId: req.params.id });
    if (!r) return res.status(404).json({ error: 'Reservation not found' });

    // Only the owner or admin can cancel
    if (r.userId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'You can only cancel your own reservations.' });
    }

    r.status = 'cancelled';
    await r.save();

    await createNotification(r.userId, 'reservation_cancelled', 'Reservation Cancelled ❌',
      'Your charging slot reservation has been cancelled.');

    logger.info('Reservation cancelled', { reservationId: req.params.id, by: req.userId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
