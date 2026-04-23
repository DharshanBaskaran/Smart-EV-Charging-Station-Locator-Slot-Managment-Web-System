/**
 * Wallet Model
 * Stores user balance and wallet metadata.
 */
const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId:    { type: String, required: true, unique: true },
  balance:   { type: Number, default: 0, min: 0 },  // INR balance
  currency:  { type: String, default: 'INR' },
  isActive:  { type: Boolean, default: true },
}, { timestamps: true });

walletSchema.index({ userId: 1 });

module.exports = mongoose.model('Wallet', walletSchema);
