const mongoose = require('mongoose');

const portSchema = new mongoose.Schema({
  portId:        { type: String, required: true, unique: true },
  stationId:     { type: String, required: true, ref: 'Station' },
  connectorType: { type: String, required: true },
  powerKw:       { type: Number, required: true },
  pricePerKwh:   { type: Number, default: 12 },  // INR per kWh
}, { timestamps: true });

portSchema.index({ stationId: 1 });

module.exports = mongoose.model('Port', portSchema);
