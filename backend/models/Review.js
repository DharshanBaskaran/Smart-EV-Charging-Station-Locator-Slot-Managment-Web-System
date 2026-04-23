const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewId:  { type: String, required: true, unique: true },
  userId:    { type: String, required: true },
  username:  { type: String, default: '' },
  stationId: { type: String, required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  comment:   { type: String, default: '', maxlength: 500 },
}, { timestamps: true });

reviewSchema.index({ stationId: 1 });
reviewSchema.index({ userId: 1 });

module.exports = mongoose.model('Review', reviewSchema);
