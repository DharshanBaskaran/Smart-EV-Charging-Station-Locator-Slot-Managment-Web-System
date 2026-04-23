/**
 * Port Routes — /api/ports
 */
const express = require('express');
const router = express.Router();

const Port = require('../models/Port');
const Reservation = require('../models/Reservation');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getPortStatus, getSlotsForPort } = require('../utils/helpers');
const logger = require('../utils/logger');

// ── GET /api/ports/status ────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const ports = await Port.find({});
    const status = ports.map(p => ({
      ...p.toObject(),
      id: p.portId,
      ...getPortStatus(p.portId),
    }));
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/ports/:portId/slots ─────────────────────────────────────────────
router.get('/:portId/slots', async (req, res) => {
  try {
    const { portId } = req.params;
    const reservations = await Reservation.find({ portId, status: 'confirmed' });
    const reservedKeys = new Set(
      reservations.map(r => `${r.portId}_${new Date(r.startTime).toISOString()}`)
    );
    res.json(getSlotsForPort(portId, reservedKeys));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/ports (admin — add port to station) ────────────────────────────
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { stationId, connectorType, powerKw, pricePerKwh } = req.body;
    if (!stationId || !connectorType || !powerKw) {
      return res.status(400).json({ error: 'stationId, connectorType, powerKw required' });
    }

    const count = await Port.countDocuments({ stationId });
    const portId = `p_${stationId}_${count + 1}`;
    const port = await Port.create({
      portId, stationId,
      connectorType,
      powerKw: Number(powerKw),
      pricePerKwh: Number(pricePerKwh) || 12,
    });

    logger.info('Port created', { portId, stationId, by: req.userId });
    res.status(201).json({ ...port.toObject(), id: port.portId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/ports/:id (admin) ────────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await Port.deleteOne({ portId: req.params.id });
    logger.info('Port deleted', { portId: req.params.id, by: req.userId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
