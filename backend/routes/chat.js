const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const { verifyToken } = require('../middleware/auth');

// Smart bot responses for common queries
const botResponses = [
  { keywords: ['charge', 'charging', 'how to charge'], reply: '⚡ To charge your EV: 1) Find a station on the map, 2) Select a free port, 3) Click "Reserve" or "⚡ Charge", 4) Plug in your vehicle. The session will track automatically!' },
  { keywords: ['payment', 'pay', 'wallet', 'money'], reply: '💰 Payments are handled through your Valence Wallet. Go to Dashboard → Wallet to add funds. Charging costs are deducted automatically at ₹12-22.5/kWh based on dynamic pricing.' },
  { keywords: ['cancel', 'reservation'], reply: '🔄 To cancel a reservation, go to "My Reservations" section in the sidebar, find your booking, and click the ✕ button. Cancellations must be done before the slot starts.' },
  { keywords: ['referral', 'refer', 'invite'], reply: '🎁 Share your unique referral code from the Tools → "Refer & Earn" section. When a friend signs up and applies your code, you BOTH get ₹50 wallet credits!' },
  { keywords: ['trip', 'route', 'plan'], reply: '🗺️ Use the Trip Planner in the sidebar to plan long-distance trips. Enter start, destination, and battery range. We\'ll find optimal charging stops along your route!' },
  { keywords: ['price', 'cost', 'rate', 'pricing'], reply: '⚡ Valence uses dynamic pricing: 🔴 Peak (6-10AM, 5-9PM) = 1.5x, 🟡 Standard (10AM-5PM) = 1x, 🟢 Off-Peak (9PM-6AM) = 0.7x. Weekend discount: 10% off!' },
  { keywords: ['help', 'support', 'issue', 'problem'], reply: '🤝 I\'m here to help! Describe your issue and I\'ll do my best. For complex problems, our support team will respond within 24 hours.' },
  { keywords: ['hello', 'hi', 'hey'], reply: '👋 Hello! Welcome to Valence Support. How can I help you today? Ask about charging, payments, reservations, or anything else!' },
];

function getBotReply(text) {
  const lower = text.toLowerCase();
  for (const r of botResponses) {
    if (r.keywords.some(k => lower.includes(k))) return r.reply;
  }
  return '🤖 Thanks for reaching out! Our support team has been notified and will respond shortly. In the meantime, try asking about: charging, payments, reservations, pricing, or referrals.';
}

// GET /api/chat/history — Get user's chat history
router.get('/history', verifyToken, async (req, res) => {
  try {
    let chat = await Chat.findOne({ userId: req.userId, status: 'open' });
    if (!chat) {
      return res.json({ messages: [], roomId: null });
    }
    res.json({ messages: chat.messages.slice(-50), roomId: chat.roomId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load chat' });
  }
});

// POST /api/chat/send — Send a message
router.post('/send', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Message required' });

    let chat = await Chat.findOne({ userId: req.userId, status: 'open' });
    if (!chat) {
      chat = await Chat.create({
        roomId: 'room_' + req.userId + '_' + Date.now(),
        userId: req.userId,
        username: req.username,
        messages: [],
      });
    }

    // Add user message
    chat.messages.push({
      sender: 'user',
      senderName: req.username,
      text: text.trim(),
    });

    // Auto bot reply
    const botReply = getBotReply(text.trim());
    chat.messages.push({
      sender: 'bot',
      senderName: 'Valence Bot',
      text: botReply,
    });

    await chat.save();

    res.json({
      userMessage: chat.messages[chat.messages.length - 2],
      botReply: chat.messages[chat.messages.length - 1],
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/chat/close — Close chat session
router.post('/close', verifyToken, async (req, res) => {
  try {
    await Chat.updateMany({ userId: req.userId, status: 'open' }, { status: 'closed' });
    res.json({ message: 'Chat closed' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to close chat' });
  }
});

module.exports = router;
