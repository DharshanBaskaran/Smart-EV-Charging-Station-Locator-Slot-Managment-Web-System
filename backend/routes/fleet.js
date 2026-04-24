const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/auth');

// Fleet Vehicle Schema (embedded in-route for simplicity)
const fleetVehicleSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, index: true },
  vehicleName: { type: String, required: true },
  licensePlate: { type: String, required: true },
  vehicleType: { type: String, default: 'car' },
  batteryCapacity: { type: Number, default: 40 },
  totalSessions: { type: Number, default: 0 },
  totalEnergy: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  lastCharged: Date,
  status: { type: String, enum: ['active', 'maintenance', 'retired'], default: 'active' },
}, { timestamps: true });

const FleetVehicle = mongoose.model('FleetVehicle', fleetVehicleSchema);

// GET /api/fleet/vehicles — List fleet vehicles
router.get('/vehicles', verifyToken, async (req, res) => {
  try {
    const vehicles = await FleetVehicle.find({ ownerId: req.userId }).sort({ createdAt: -1 });
    
    // Calculate fleet-wide stats
    const stats = {
      totalVehicles: vehicles.length,
      activeVehicles: vehicles.filter(v => v.status === 'active').length,
      totalEnergy: vehicles.reduce((sum, v) => sum + v.totalEnergy, 0),
      totalCost: vehicles.reduce((sum, v) => sum + v.totalCost, 0),
      totalSessions: vehicles.reduce((sum, v) => sum + v.totalSessions, 0),
    };

    res.json({ vehicles, stats });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch fleet' });
  }
});

// POST /api/fleet/vehicles — Add vehicle to fleet
router.post('/vehicles', verifyToken, async (req, res) => {
  try {
    const { vehicleName, licensePlate, vehicleType, batteryCapacity } = req.body;
    if (!vehicleName || !licensePlate) {
      return res.status(400).json({ error: 'Vehicle name and license plate required' });
    }

    const vehicle = await FleetVehicle.create({
      ownerId: req.userId,
      vehicleName,
      licensePlate: licensePlate.toUpperCase(),
      vehicleType: vehicleType || 'car',
      batteryCapacity: batteryCapacity || 40,
    });

    res.status(201).json(vehicle);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
});

// PUT /api/fleet/vehicles/:id — Update vehicle
router.put('/vehicles/:id', verifyToken, async (req, res) => {
  try {
    const vehicle = await FleetVehicle.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.userId },
      { $set: req.body },
      { new: true }
    );
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

// DELETE /api/fleet/vehicles/:id — Remove vehicle
router.delete('/vehicles/:id', verifyToken, async (req, res) => {
  try {
    const result = await FleetVehicle.findOneAndDelete({ _id: req.params.id, ownerId: req.userId });
    if (!result) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ message: 'Vehicle removed' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// POST /api/fleet/vehicles/:id/log-session — Log a charging session for a fleet vehicle
router.post('/vehicles/:id/log-session', verifyToken, async (req, res) => {
  try {
    const { energyKwh, costINR } = req.body;
    const vehicle = await FleetVehicle.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    vehicle.totalSessions += 1;
    vehicle.totalEnergy += energyKwh || 0;
    vehicle.totalCost += costINR || 0;
    vehicle.lastCharged = new Date();
    await vehicle.save();

    res.json(vehicle);
  } catch (e) {
    res.status(500).json({ error: 'Failed to log session' });
  }
});

module.exports = router;
