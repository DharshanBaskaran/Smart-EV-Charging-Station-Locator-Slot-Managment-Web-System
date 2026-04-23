/**
 * Review Routes — /api/stations/:id/reviews, /api/reviews/:id
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const Review = require('../models/Review');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');
const logger = require('../utils/logger');

// ── GET /api/reviews/station/:id ─────────────────────────────────────────────
router.get('/station/:id', async (req, res) => {
  try {
    const reviews = await Review.find({ stationId: req.params.id }).sort({ createdAt: -1 });
    res.json(reviews.map(r => ({ ...r.toObject(), id: r.reviewId })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/reviews/station/:id ────────────────────────────────────────────
router.post('/station/:id', requireAuth, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('comment').optional().trim().isLength({ max: 500 }).withMessage('Comment max 500 chars'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { rating, comment } = req.body;

    // Check if user already reviewed
    const existing = await Review.findOne({ userId: req.userId, stationId: req.params.id });
    if (existing) {
      return res.status(409).json({ error: 'You have already reviewed this station. Delete your review first.' });
    }

    const reviewId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const review = await Review.create({
      reviewId,
      userId: req.userId,
      username: req.user.name || req.user.username,
      stationId: req.params.id,
      rating: Number(rating),
      comment: (comment || '').substring(0, 500),
    });

    await createNotification(req.userId, 'review_posted', 'Review Posted ⭐',
      `Your ${rating}-star review has been posted.`);

    logger.info('Review created', { reviewId, stationId: req.params.id, by: req.userId });
    res.status(201).json({ ...review.toObject(), id: review.reviewId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/reviews/:id ──────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const review = await Review.findOne({ reviewId: req.params.id });
    if (!review) return res.status(404).json({ error: 'Review not found' });

    if (review.userId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'You can only delete your own reviews.' });
    }

    await Review.deleteOne({ reviewId: req.params.id });
    logger.info('Review deleted', { reviewId: req.params.id, by: req.userId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
