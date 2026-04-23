const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId:         { type: String, required: true, unique: true },
  username:       { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash:   { type: String, required: true },
  role:           { type: String, enum: ['admin', 'user'], default: 'user' },
  name:           { type: String, default: '' },
  email:          { type: String, default: '' },
  vehicleType:    { type: String, default: 'car' },
  vehicleModel:   { type: String, default: '' },
  batteryRangeKm: { type: Number, default: 0 },
  batteryHealthPct: { type: Number, default: 100, min: 0, max: 100 },
  favorites:      [{ type: String }],  // array of stationId strings
  securityQuestion: { type: String, default: '' },
  securityAnswer:   { type: String, default: '' },  // stored as bcrypt hash
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
