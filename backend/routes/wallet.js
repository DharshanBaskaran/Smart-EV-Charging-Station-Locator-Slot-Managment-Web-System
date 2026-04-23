/**
 * Wallet & Payment Routes — /api/wallet
 * Top-up, balance, transactions, promo codes, auto-debit on charging.
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const PromoCode = require('../models/PromoCode');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');
const logger = require('../utils/logger');

// ── Helper: Get or create wallet ─────────────────────────────────────────────
async function getOrCreateWallet(userId) {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId, balance: 0 });
  }
  return wallet;
}

// ── Helper: Create transaction record ────────────────────────────────────────
async function createTransaction(userId, type, amount, direction, description, referenceId, paymentMethod, balanceAfter, metadata = {}) {
  const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return Transaction.create({
    transactionId: txnId,
    userId, type, amount, direction, balanceAfter,
    description, referenceId,
    paymentMethod: paymentMethod || 'wallet',
    status: 'completed',
    metadata,
  });
}

// ── GET /api/wallet/balance — Get wallet balance ─────────────────────────────
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.userId);
    res.json({
      balance: wallet.balance,
      currency: wallet.currency,
      isActive: wallet.isActive,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/wallet/topup — Add money to wallet ─────────────────────────────
router.post('/topup', requireAuth, [
  body('amount').isFloat({ min: 10, max: 10000 }).withMessage('Amount must be ₹10-₹10,000'),
  body('paymentMethod').optional().isIn(['upi', 'card', 'netbanking']).withMessage('Invalid payment method'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { amount, paymentMethod = 'upi' } = req.body;
    const wallet = await getOrCreateWallet(req.userId);

    // Simulate payment processing (in production: Razorpay/Stripe webhook)
    wallet.balance = parseFloat((wallet.balance + Number(amount)).toFixed(2));
    await wallet.save();

    const txn = await createTransaction(
      req.userId, 'topup', Number(amount), 'credit',
      `Wallet top-up via ${paymentMethod.toUpperCase()}`,
      '', paymentMethod, wallet.balance,
      { paymentMethod }
    );

    await createNotification(req.userId, 'system', 'Wallet Topped Up 💰',
      `₹${amount} added to your wallet. New balance: ₹${wallet.balance}`);

    logger.info('Wallet top-up', { userId: req.userId, amount, newBalance: wallet.balance });
    res.json({
      balance: wallet.balance,
      transaction: { ...txn.toObject(), id: txn.transactionId },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/wallet/debit — Debit from wallet (for charging sessions) ───────
router.post('/debit', requireAuth, async (req, res) => {
  try {
    const { amount, description, referenceId } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const wallet = await getOrCreateWallet(req.userId);
    if (wallet.balance < amount) {
      return res.status(402).json({
        error: 'Insufficient balance',
        balance: wallet.balance,
        required: amount,
        shortfall: parseFloat((amount - wallet.balance).toFixed(2)),
      });
    }

    wallet.balance = parseFloat((wallet.balance - amount).toFixed(2));
    await wallet.save();

    const txn = await createTransaction(
      req.userId, 'charging_debit', amount, 'debit',
      description || 'Charging session payment',
      referenceId || '', 'wallet', wallet.balance
    );

    logger.info('Wallet debit', { userId: req.userId, amount, newBalance: wallet.balance });
    res.json({
      balance: wallet.balance,
      transaction: { ...txn.toObject(), id: txn.transactionId },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/wallet/transactions — Transaction history ───────────────────────
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const total = await Transaction.countDocuments({ userId: req.userId });
    const transactions = await Transaction.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      transactions: transactions.map(t => ({ ...t.toObject(), id: t.transactionId })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/wallet/summary — Monthly spending summary ───────────────────────
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthTxns = await Transaction.find({
      userId: req.userId,
      createdAt: { $gte: startOfMonth },
    });

    const wallet = await getOrCreateWallet(req.userId);

    const totalTopups = monthTxns.filter(t => t.type === 'topup').reduce((sum, t) => sum + t.amount, 0);
    const totalCharging = monthTxns.filter(t => t.type === 'charging_debit').reduce((sum, t) => sum + t.amount, 0);
    const totalRefunds = monthTxns.filter(t => t.type === 'refund').reduce((sum, t) => sum + t.amount, 0);
    const totalPromo = monthTxns.filter(t => t.type === 'promo_credit').reduce((sum, t) => sum + t.amount, 0);

    res.json({
      balance: wallet.balance,
      monthlyStats: {
        month: `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
        topups: parseFloat(totalTopups.toFixed(2)),
        chargingSpent: parseFloat(totalCharging.toFixed(2)),
        refunds: parseFloat(totalRefunds.toFixed(2)),
        promoCredits: parseFloat(totalPromo.toFixed(2)),
        netSpent: parseFloat((totalCharging - totalRefunds - totalPromo).toFixed(2)),
        transactionCount: monthTxns.length,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/wallet/apply-promo — Apply promo code ──────────────────────────
router.post('/apply-promo', requireAuth, [
  body('code').trim().notEmpty().withMessage('Promo code is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { code } = req.body;
    const promo = await PromoCode.findOne({ code: code.toUpperCase(), isActive: true });

    if (!promo) return res.status(404).json({ error: 'Invalid or expired promo code' });
    if (new Date() > promo.validUntil) return res.status(400).json({ error: 'Promo code has expired' });
    if (promo.usedCount >= promo.usageLimit) return res.status(400).json({ error: 'Promo code usage limit reached' });

    // Check per-user limit
    const userUses = promo.usedBy.filter(id => id === req.userId).length;
    if (userUses >= promo.perUserLimit) {
      return res.status(400).json({ error: 'You have already used this promo code' });
    }

    // Calculate credit
    let creditAmount = 0;
    if (promo.type === 'flat') {
      creditAmount = promo.value;
    } else if (promo.type === 'percentage' || promo.type === 'cashback') {
      creditAmount = Math.min(promo.value, promo.maxDiscount);
    }

    // Apply credit to wallet
    const wallet = await getOrCreateWallet(req.userId);
    wallet.balance = parseFloat((wallet.balance + creditAmount).toFixed(2));
    await wallet.save();

    // Update promo usage
    promo.usedCount += 1;
    promo.usedBy.push(req.userId);
    await promo.save();

    // Create transaction
    await createTransaction(
      req.userId, 'promo_credit', creditAmount, 'credit',
      `Promo code: ${code.toUpperCase()} — ${promo.description || ''}`,
      code.toUpperCase(), 'promo', wallet.balance
    );

    await createNotification(req.userId, 'system', 'Promo Applied! 🎉',
      `₹${creditAmount} credited to your wallet using code ${code.toUpperCase()}`);

    logger.info('Promo applied', { userId: req.userId, code: code.toUpperCase(), creditAmount });
    res.json({
      success: true,
      creditAmount,
      balance: wallet.balance,
      message: `₹${creditAmount} credited to your wallet!`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Create promo code ─────────────────────────────────────────────────
router.post('/promo', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { code, type, value, maxDiscount, minAmount, usageLimit, perUserLimit, validUntil, description } = req.body;
    if (!code || !value || !validUntil) {
      return res.status(400).json({ error: 'code, value, validUntil required' });
    }

    const promo = await PromoCode.create({
      code: code.toUpperCase().trim(),
      type: type || 'flat',
      value: Number(value),
      maxDiscount: Number(maxDiscount) || 500,
      minAmount: Number(minAmount) || 0,
      usageLimit: Number(usageLimit) || 100,
      perUserLimit: Number(perUserLimit) || 1,
      validUntil: new Date(validUntil),
      description: description || '',
    });

    logger.info('Promo code created', { code: promo.code, by: req.userId });
    res.status(201).json(promo);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/wallet/invoice/:sessionId — Generate invoice data ───────────────
router.get('/invoice/:sessionId', requireAuth, async (req, res) => {
  try {
    const ChargingSession = require('../models/ChargingSession');
    const Station = require('../models/Station');

    const session = await ChargingSession.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.userId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const station = await Station.findOne({ stationId: session.stationId });

    // Find related transaction
    const txn = await Transaction.findOne({ referenceId: session.sessionId });

    const invoice = {
      invoiceId: `INV-${session.sessionId.replace('cs_', '').toUpperCase()}`,
      date: session.completedAt || session.createdAt,
      customer: {
        userId: req.userId,
        name: req.user.name || req.user.username,
        email: req.user.email || '',
      },
      station: {
        name: station ? station.name : 'Unknown Station',
        address: station ? station.address : '',
        stationId: session.stationId,
      },
      session: {
        sessionId: session.sessionId,
        portId: session.portId,
        connectorType: session.connectorType,
        powerKw: session.powerKw,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        durationMin: session.durationMin,
      },
      billing: {
        energyKwh: session.energyKwh,
        pricePerKwh: session.pricePerKwh,
        subtotal: parseFloat((session.energyKwh * session.pricePerKwh).toFixed(2)),
        tax: parseFloat((session.energyKwh * session.pricePerKwh * 0.18).toFixed(2)), // 18% GST
        total: session.totalCostINR,
        paymentMethod: txn ? txn.paymentMethod : 'wallet',
        transactionId: txn ? txn.transactionId : '',
      },
      status: session.status,
    };

    res.json(invoice);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
module.exports.getOrCreateWallet = getOrCreateWallet;
module.exports.createTransaction = createTransaction;
