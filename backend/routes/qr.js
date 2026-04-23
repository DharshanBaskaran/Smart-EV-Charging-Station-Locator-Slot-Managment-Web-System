/**
 * QR Code Routes — /api/qr
 * Generate QR codes for stations (for physical signage).
 */
const express = require('express');
const router = express.Router();
const Station = require('../models/Station');
const { requireAuth } = require('../middleware/auth');

// ── GET /api/qr/station/:id — Generate QR data URL ──────────────────────────
router.get('/station/:id', async (req, res) => {
  try {
    const station = await Station.findOne({ stationId: req.params.id });
    if (!station) return res.status(404).json({ error: 'Station not found' });

    // Generate the URL the QR should redirect to
    const appUrl = `${req.protocol}://${req.get('host')}/?station=${station.stationId}`;

    // Return QR code data as a Google Charts API URL (no extra dependency needed)
    const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(appUrl)}&choe=UTF-8`;

    res.json({
      stationId: station.stationId,
      stationName: station.name,
      appUrl,
      qrImageUrl: qrUrl,
      // Alternative: use the open-source QR API
      qrImageUrlAlt: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appUrl)}`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/qr/session/:id — QR for a charging session receipt ──────────────
router.get('/session/:id', requireAuth, async (req, res) => {
  try {
    const ChargingSession = require('../models/ChargingSession');
    const session = await ChargingSession.findOne({ sessionId: req.params.id });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const receiptUrl = `${req.protocol}://${req.get('host')}/dashboard.html?receipt=${session.sessionId}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(receiptUrl)}`;

    res.json({
      sessionId: session.sessionId,
      receiptUrl,
      qrImageUrl: qrUrl,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
