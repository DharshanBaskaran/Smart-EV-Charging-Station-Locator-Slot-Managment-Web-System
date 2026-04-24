const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Referral = require('../models/Referral');
const Wallet = require('../models/Wallet');
const { verifyToken } = require('../middleware/auth');

const REFERRAL_REWARD = 50; // ₹50 for both referrer and referee

// Generate unique 8-char referral code
function generateCode(username) {
  const hash = crypto.createHash('sha256').update(username + Date.now()).digest('hex');
  return 'VAL' + hash.substring(0, 5).toUpperCase();
}

// GET /api/referrals/my-code — Get or create user's referral code
router.get('/my-code', verifyToken, async (req, res) => {
  try {
    let referral = await Referral.findOne({ referrerId: req.userId });

    if (!referral) {
      referral = await Referral.create({
        referrerId: req.userId,
        referrerUsername: req.username,
        referralCode: generateCode(req.username),
      });
    }

    res.json({
      referralCode: referral.referralCode,
      referredCount: referral.referredUsers.length,
      totalEarned: referral.totalEarned,
      referredUsers: referral.referredUsers.map(u => ({
        username: u.username,
        joinedAt: u.joinedAt,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get referral code' });
  }
});

// POST /api/referrals/apply — Apply a referral code (called during/after signup)
router.post('/apply', verifyToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Referral code required' });

    const referral = await Referral.findOne({ referralCode: code.toUpperCase().trim() });
    if (!referral) return res.status(404).json({ error: 'Invalid referral code' });

    // Can't refer yourself
    if (referral.referrerId === req.userId) {
      return res.status(400).json({ error: 'Cannot use your own referral code' });
    }

    // Check if already referred
    const alreadyReferred = referral.referredUsers.some(u => u.userId === req.userId);
    if (alreadyReferred) {
      return res.status(400).json({ error: 'You have already used a referral code' });
    }

    // Add to referred users
    referral.referredUsers.push({
      userId: req.userId,
      username: req.username,
      creditAwarded: true,
    });
    referral.totalEarned += REFERRAL_REWARD;
    await referral.save();

    // Credit referrer's wallet
    let referrerWallet = await Wallet.findOne({ userId: referral.referrerId });
    if (!referrerWallet) {
      referrerWallet = await Wallet.create({ userId: referral.referrerId, balance: 0 });
    }
    referrerWallet.balance += REFERRAL_REWARD;
    await referrerWallet.save();

    // Credit referee's (current user's) wallet
    let myWallet = await Wallet.findOne({ userId: req.userId });
    if (!myWallet) {
      myWallet = await Wallet.create({ userId: req.userId, balance: 0 });
    }
    myWallet.balance += REFERRAL_REWARD;
    await myWallet.save();

    res.json({
      message: `Referral applied! Both you and ${referral.referrerUsername} received ₹${REFERRAL_REWARD}`,
      credited: REFERRAL_REWARD,
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to apply referral' });
  }
});

module.exports = router;
