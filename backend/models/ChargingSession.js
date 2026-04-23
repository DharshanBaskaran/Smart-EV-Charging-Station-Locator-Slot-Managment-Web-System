/**
 * ChargingSession Model
 * Tracks active and completed charging sessions with real-time kWh/cost data.
 */
const mongoose = require('mongoose');

const chargingSessionSchema = new mongoose.Schema({
  sessionId:    { type: String, required: true, unique: true },
  userId:       { type: String, required: true },
  portId:       { type: String, required: true },
  stationId:    { type: String, required: true },
  reservationId:{ type: String, default: '' },

  // Session state
  status: {
    type: String,
    enum: ['pending', 'charging', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },

  // Timing
  startedAt:    { type: Date, default: null },
  completedAt:  { type: Date, default: null },
  durationMin:  { type: Number, default: 0 },

  // Energy & cost
  energyKwh:      { type: Number, default: 0 },
  powerKw:        { type: Number, default: 0 },
  pricePerKwh:    { type: Number, default: 12 },
  totalCostINR:   { type: Number, default: 0 },
  connectorType:  { type: String, default: '' },

  // Battery tracking
  batteryStartPct:  { type: Number, default: 0 },
  batteryEndPct:    { type: Number, default: 0 },
  batteryTargetPct: { type: Number, default: 80 },

  // Progress (updated in real-time during simulation)
  progressPct:    { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true });

chargingSessionSchema.index({ userId: 1, status: 1 });
chargingSessionSchema.index({ portId: 1, status: 1 });

module.exports = mongoose.model('ChargingSession', chargingSessionSchema);
