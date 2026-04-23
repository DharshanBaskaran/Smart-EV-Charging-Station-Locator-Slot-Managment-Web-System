/**
 * PromoCode Model
 * Discount codes, first-ride-free, referral bonuses.
 */
const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code:          { type: String, required: true, unique: true, uppercase: true, trim: true },
  type:          { type: String, enum: ['flat', 'percentage', 'cashback'], default: 'flat' },
  value:         { type: Number, required: true },         // flat INR or percentage
  maxDiscount:   { type: Number, default: 500 },           // cap for percentage discounts
  minAmount:     { type: Number, default: 0 },             // minimum order to apply
  usageLimit:    { type: Number, default: 100 },           // total uses allowed
  usedCount:     { type: Number, default: 0 },
  perUserLimit:  { type: Number, default: 1 },
  usedBy:        [{ type: String }],                       // array of userIds
  validFrom:     { type: Date, default: Date.now },
  validUntil:    { type: Date, required: true },
  isActive:      { type: Boolean, default: true },
  description:   { type: String, default: '' },
}, { timestamps: true });

promoCodeSchema.index({ code: 1 });

module.exports = mongoose.model('PromoCode', promoCodeSchema);
