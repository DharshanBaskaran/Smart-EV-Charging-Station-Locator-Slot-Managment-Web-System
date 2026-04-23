/**
 * Transaction Model
 * Full ledger: top-ups, charging debits, refunds, promo credits.
 */
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  userId:        { type: String, required: true },
  type: {
    type: String,
    enum: ['topup', 'charging_debit', 'refund', 'promo_credit', 'penalty'],
    required: true,
  },
  amount:       { type: Number, required: true },         // Always positive
  direction:    { type: String, enum: ['credit', 'debit'], required: true },
  balanceAfter: { type: Number, default: 0 },             // Balance after this transaction
  description:  { type: String, default: '' },
  referenceId:  { type: String, default: '' },             // sessionId, promoCode, etc.
  paymentMethod:{ type: String, default: '' },             // 'wallet', 'upi', 'card', 'promo'
  status:       { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' },
  metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ referenceId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
