const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  notificationId: { type: String, required: true, unique: true },
  userId:         { type: String, required: true },
  type:           { type: String, enum: ['reservation_confirmed', 'reservation_cancelled', 'reservation_reminder', 'review_posted', 'station_added', 'system'], default: 'system' },
  title:          { type: String, required: true },
  message:        { type: String, required: true },
  read:           { type: Boolean, default: false },
  link:           { type: String, default: '' },
}, { timestamps: true });

notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
