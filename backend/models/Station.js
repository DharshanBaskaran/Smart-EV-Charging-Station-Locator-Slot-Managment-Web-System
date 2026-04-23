const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  stationId: { type: String, required: true, unique: true },
  name:      { type: String, required: true, trim: true },
  address:   { type: String, required: true, trim: true },
  lat:       { type: Number, required: true },
  lng:       { type: Number, required: true },
  operator:  { type: String, default: 'Unknown', trim: true },
  city:      { type: String, default: '' },
  state:     { type: String, default: '' },
  addedBy:   { type: String, default: 'system' },
}, { timestamps: true });

// 2dsphere index for geospatial queries (optional future use)
stationSchema.index({ lat: 1, lng: 1 });

module.exports = mongoose.model('Station', stationSchema);
