const express = require('express');
const router = express.Router();

/**
 * Dynamic Pricing Engine for Valence
 *
 * Pricing tiers based on time of day (IST):
 * - Peak:     6-10 AM, 5-9 PM  → 1.5x multiplier
 * - Standard: 10 AM-5 PM       → 1.0x multiplier
 * - Off-Peak: 9 PM-6 AM        → 0.7x multiplier
 *
 * Weekend discount: 10% off all tiers
 */

function getPricingTier(date) {
  // Convert to IST
  const istOffset = 5.5 * 60; // IST is UTC+5:30
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const istMinutes = (utcMinutes + istOffset) % (24 * 60);
  const hour = Math.floor(istMinutes / 60);

  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  let tier, multiplier, label, color;

  if ((hour >= 6 && hour < 10) || (hour >= 17 && hour < 21)) {
    tier = 'peak';
    multiplier = 1.5;
    label = '🔴 Peak Hours';
    color = '#ff5252';
  } else if (hour >= 10 && hour < 17) {
    tier = 'standard';
    multiplier = 1.0;
    label = '🟡 Standard';
    color = '#ffab00';
  } else {
    tier = 'off-peak';
    multiplier = 0.7;
    label = '🟢 Off-Peak';
    color = '#00e676';
  }

  // Weekend discount
  if (isWeekend) {
    multiplier *= 0.9;
    label += ' (Weekend -10%)';
  }

  return { tier, multiplier: Math.round(multiplier * 100) / 100, label, color, hour, isWeekend };
}

// GET /api/pricing/current — Get current pricing tier
router.get('/current', (req, res) => {
  const now = new Date();
  const pricing = getPricingTier(now);

  // Base rate example
  const baseRate = 15; // ₹15/kWh
  const effectiveRate = Math.round(baseRate * pricing.multiplier * 100) / 100;

  res.json({
    ...pricing,
    baseRate,
    effectiveRate,
    currency: 'INR',
    unit: 'kWh',
    message: `Current rate: ₹${effectiveRate}/kWh (${pricing.label})`,
    schedule: [
      { period: '6 AM - 10 AM', tier: 'Peak', multiplier: 1.5, rate: baseRate * 1.5 },
      { period: '10 AM - 5 PM', tier: 'Standard', multiplier: 1.0, rate: baseRate },
      { period: '5 PM - 9 PM', tier: 'Peak', multiplier: 1.5, rate: baseRate * 1.5 },
      { period: '9 PM - 6 AM', tier: 'Off-Peak', multiplier: 0.7, rate: baseRate * 0.7 },
    ],
  });
});

// GET /api/pricing/calculate — Calculate price for a specific time and energy
router.get('/calculate', (req, res) => {
  const { kWh, time } = req.query;
  const energy = parseFloat(kWh) || 0;
  const date = time ? new Date(time) : new Date();

  const pricing = getPricingTier(date);
  const baseRate = 15;
  const effectiveRate = baseRate * pricing.multiplier;
  const totalCost = Math.round(energy * effectiveRate * 100) / 100;

  res.json({
    energy,
    pricing,
    baseRate,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    totalCost,
  });
});

module.exports = router;
