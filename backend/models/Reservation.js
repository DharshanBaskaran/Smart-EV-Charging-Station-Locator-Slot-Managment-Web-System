const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  reservationId: { type: String, required: true, unique: true },
  userId:        { type: String, required: true },
  portId:        { type: String, required: true },
  startTime:     { type: Date, required: true },
  endTime:       { type: Date, required: true },
  status:        { type: String, enum: ['confirmed', 'cancelled', 'completed'], default: 'confirmed' },
}, { timestamps: true });

reservationSchema.index({ userId: 1 });
reservationSchema.index({ portId: 1, startTime: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
