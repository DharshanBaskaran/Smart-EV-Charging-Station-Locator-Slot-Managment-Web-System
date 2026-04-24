const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrerId: { type: String, required: true },           // user who shared the code
  referrerUsername: { type: String, required: true },
  referralCode: { type: String, required: true, unique: true },
  referredUsers: [{
    userId: String,
    username: String,
    joinedAt: { type: Date, default: Date.now },
    creditAwarded: { type: Boolean, default: false },
  }],
  totalEarned: { type: Number, default: 0 },              // total credits earned from referrals
}, { timestamps: true });

referralSchema.index({ referralCode: 1 });
referralSchema.index({ referrerId: 1 });

module.exports = mongoose.model('Referral', referralSchema);
