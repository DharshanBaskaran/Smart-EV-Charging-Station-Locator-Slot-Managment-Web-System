const express = require('express');
const router = express.Router();
const Station = require('../models/Station');
const { verifyToken } = require('../middleware/auth');

// GET /api/owner/stations — Get stations owned by this user
router.get('/stations', verifyToken, async (req, res) => {
  try {
    const stations = await Station.find({ ownerId: req.userId });

    const enriched = stations.map(s => {
      const ports = s.ports || [];
      const totalPorts = ports.length;
      const freePorts = ports.filter(p => p.functional && p.occupancy === 'free').length;
      const occupiedPorts = ports.filter(p => p.functional && p.occupancy !== 'free').length;
      const defectivePorts = ports.filter(p => !p.functional).length;
      const avgRating = s.avgRating || 0;
      const totalReviews = s.reviewCount || 0;

      // Estimated revenue (sessions × avg cost)
      const estimatedRevenue = (s.totalSessions || 0) * 85; // ~₹85 avg session

      return {
        id: s._id || s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        operator: s.operator,
        totalPorts,
        freePorts,
        occupiedPorts,
        defectivePorts,
        utilization: totalPorts > 0 ? Math.round((occupiedPorts / totalPorts) * 100) : 0,
        avgRating,
        totalReviews,
        estimatedRevenue,
        totalSessions: s.totalSessions || 0,
        createdAt: s.createdAt,
      };
    });

    // Aggregate stats
    const stats = {
      totalStations: enriched.length,
      totalPorts: enriched.reduce((s, st) => s + st.totalPorts, 0),
      avgUtilization: enriched.length > 0
        ? Math.round(enriched.reduce((s, st) => s + st.utilization, 0) / enriched.length)
        : 0,
      totalRevenue: enriched.reduce((s, st) => s + st.estimatedRevenue, 0),
      avgRating: enriched.length > 0
        ? (enriched.reduce((s, st) => s + st.avgRating, 0) / enriched.length).toFixed(1)
        : 0,
    };

    res.json({ stations: enriched, stats });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch owner stations' });
  }
});

// PUT /api/owner/stations/:id/port/:portId — Toggle port functional status
router.put('/stations/:id/port/:portId', verifyToken, async (req, res) => {
  try {
    const station = await Station.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!station) return res.status(404).json({ error: 'Station not found or not owned by you' });

    const port = (station.ports || []).find(p =>
      (p._id && p._id.toString() === req.params.portId) || p.id === req.params.portId
    );
    if (!port) return res.status(404).json({ error: 'Port not found' });

    if (req.body.functional !== undefined) port.functional = req.body.functional;
    if (req.body.occupancy) port.occupancy = req.body.occupancy;

    await station.save();
    res.json({ message: 'Port updated', port });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update port' });
  }
});

module.exports = router;
