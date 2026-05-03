const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const { verifyToken } = require('../middleware/auth');

// ══════════════════════════════════════════════════════════════════════════════
// LEVENSHTEIN FUZZY MATCHING ENGINE
// ══════════════════════════════════════════════════════════════════════════════
function levenshtein(a, b) {
  const aLen = a.length, bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  const matrix = [];
  for (let i = 0; i <= bLen; i++) matrix[i] = [i];
  for (let j = 0; j <= aLen; j++) matrix[0][j] = j;
  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[bLen][aLen];
}

function fuzzyMatch(words, keyword, threshold = 2) {
  const joined = words.join(' ');
  if (joined.includes(keyword)) return true;
  for (const word of words) {
    if (word.length < 2) continue;
    const maxDist = Math.min(threshold, Math.floor(word.length / 3) + 1);
    if (levenshtein(word, keyword) <= maxDist) return true;
  }
  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE
// Keywords/synonyms include common typos so fuzzy matching catches them.
// ══════════════════════════════════════════════════════════════════════════════
const knowledgeBase = [
  {
    category: 'greeting',
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'howdy', 'yo', 'sup'],
    synonyms: ['helo', 'hii', 'heyy', 'helloo'],
    reply: '👋 Hello! Welcome to Valence Support!\n\nI can help you with:\n• ⚡ Charging — How to charge your EV\n• 💰 Payments & Wallet\n• 🔄 Reservations & Bookings\n• 🗺️ Trip Planning\n• 🎁 Referrals — Earn free credits\n• 📍 Finding nearby stations\n• ⚡ Pricing tiers\n\nJust type your question!',
    priority: 3,
  },
  {
    category: 'charging',
    keywords: ['charge', 'charging', 'charger', 'plug', 'connector', 'how to charge', 'ev charge'],
    synonyms: ['chargng', 'chargeing', 'chrage', 'chrge', 'plugging', 'pluge', 'chargnig'],
    reply: '⚡ How to charge your EV:\n1️⃣ Find a station on the map\n2️⃣ Select a free port (green dot)\n3️⃣ Click "Reserve" or "⚡ Charge"\n4️⃣ Plug in your vehicle\n\nThe session starts automatically and stops when you disconnect!',
    priority: 10,
  },
  {
    category: 'pricing',
    keywords: ['price', 'pricing', 'cost', 'rate', 'tariff', 'per kwh', 'dynamic', 'expensive', 'cheap', 'how much'],
    synonyms: ['prise', 'prce', 'prcing', 'pricng', 'costt', 'cots', 'rte', 'tarrif', 'expensve', 'cheep', 'priice'],
    reply: '⚡ Dynamic Pricing Tiers:\n\n• 🔴 Peak (6–10 AM, 5–9 PM) → ₹22.5/kWh (1.5×)\n• 🟡 Standard (10 AM–5 PM) → ₹15/kWh (1.0×)\n• 🟢 Off-Peak (9 PM–6 AM) → ₹10.5/kWh (0.7×)\n• 🎉 Weekend bonus: 10% off all tiers!\n\nCheck the live pricing badge in your header for the current rate!',
    priority: 9,
  },
  {
    category: 'payment',
    keywords: ['payment', 'pay', 'wallet', 'money', 'balance', 'topup', 'top up', 'fund', 'transaction'],
    synonyms: ['payemnt', 'paymnt', 'paymnet', 'walet', 'mony', 'ballance', 'toup', 'toppup'],
    reply: '💰 Payments via Valence Wallet:\n• Go to Dashboard → Wallet to add funds\n• Charging costs are deducted automatically\n• Rates: ₹10.5 – ₹22.5/kWh (dynamic pricing)\n• View full transaction history anytime\n\nNeed to top up? Click the 💳 icon on your dashboard!',
    priority: 9,
  },
  {
    category: 'reservation',
    keywords: ['cancel', 'reservation', 'reserve', 'booking', 'book', 'slot', 'schedule', 'time slot'],
    synonyms: ['cancle', 'cancell', 'resrve', 'resrvation', 'resevation', 'bokking', 'schedle', 'bookin', 'bking'],
    reply: '🔄 About Reservations:\n• Reserve a port from the station detail panel\n• Choose your preferred time slot & duration\n• Cancel anytime before the slot starts\n• Find all your bookings in "My Reservations" in the sidebar\n\n⏰ You will get a reminder toast 15 minutes before your slot!',
    priority: 8,
  },
  {
    category: 'station',
    keywords: ['station', 'location', 'find', 'near', 'nearby', 'search', 'where', 'closest', 'nearest', 'map'],
    synonyms: ['staion', 'locaton', 'nearr', 'serch', 'cloest', 'neerest', 'mapp'],
    reply: '📍 Finding Charging Stations:\n• Use the map view to see all stations as pins\n• Enter your battery range to filter reachable ones\n• Click any pin for full details (ports, pricing, reviews)\n• Use the Stations tab for a full list view\n• Filter by connector type or power level\n\n⭐ You can also save favorite stations from the detail panel!',
    priority: 7,
  },
  {
    category: 'trip',
    keywords: ['trip', 'route', 'plan', 'journey', 'travel', 'long drive', 'road trip', 'navigate', 'direction'],
    synonyms: ['tripp', 'rout', 'plann', 'jurney', 'travl', 'navigat', 'driive'],
    reply: '🗺️ Trip Planner:\n• Open it from the sidebar → "Plan Long Trip"\n• Enter your start & destination\n• Set your current battery range (minimum 50 km)\n• We will find the best charging stops along your route\n• Save routes for quick reuse later!\n\n💡 Tip: Battery range at 80% is used as the safety margin.',
    priority: 7,
  },
  {
    category: 'referral',
    keywords: ['referral', 'refer', 'invite', 'friend', 'code', 'earn', 'bonus', 'reward', 'credit'],
    synonyms: ['referal', 'refferal', 'refar', 'invit', 'frend', 'earnn', 'crdit', 'rewrd'],
    reply: '🎁 Refer & Earn:\n• Find your unique code in Tools → "Refer & Earn"\n• Share it with friends\n• When they sign up and apply your code:\n  → You get ₹50 wallet credits instantly\n  → They also get ₹50 wallet credits\n• No limit — refer as many friends as you want!',
    priority: 7,
  },
  {
    category: 'account',
    keywords: ['account', 'profile', 'password', 'login', 'signup', 'register', 'settings', 'email', 'name'],
    synonyms: ['acount', 'profle', 'pasword', 'logn', 'singup', 'registr', 'setings', 'emal'],
    reply: '👤 Account Management:\n• Click your name/Profile in the header to edit details\n• Update name, email, vehicle type and model\n• Change password from the profile settings\n• Security questions protect your account\n\nForgot your password? Use the "Forgot Password" link on the login page.',
    priority: 6,
  },
  {
    category: 'fleet',
    keywords: ['fleet', 'vehicles', 'company', 'business', 'multiple cars', 'manage vehicles'],
    synonyms: ['fleett', 'vehicls', 'compny', 'busness', 'vehicels'],
    reply: '🚗 Fleet Management:\n• Go to the Fleet Dashboard from the header button\n• Add vehicles: name, license plate, battery capacity\n• Track charging sessions and costs per vehicle\n• View fleet-wide analytics\n\nPerfect for businesses managing multiple EVs!',
    priority: 6,
  },
  {
    category: 'owner',
    keywords: ['owner', 'my station', 'revenue', 'earnings', 'utilization', 'port management', 'owner portal'],
    synonyms: ['ownr', 'revnue', 'earings', 'utilizaton', 'mgmt'],
    reply: '🏢 Station Owner Portal:\n• Access it from the "🏢 Owner" button in the header\n• See real-time port utilization per station\n• Track estimated revenue and session counts\n• Monitor ratings and customer reviews\n• Toggle individual port functional status\n\nAdd stations from the map to see them appear here!',
    priority: 6,
  },
  {
    category: 'carbon',
    keywords: ['carbon', 'environment', 'green', 'eco', 'emission', 'footprint', 'tree', 'planet', 'climate'],
    synonyms: ['carbn', 'enviroment', 'emisison', 'footprnt', 'climat', 'tress'],
    reply: '🌱 Carbon Footprint Tracker:\n• Find it in Tools → "🌱 Carbon Footprint"\n• See your total CO₂ avoided from EV charging\n• Equivalent metrics shown:\n  → Litres of petrol avoided\n  → Trees planted equivalent\n  → Money saved vs. petrol costs\n\nEvery kWh charged makes the planet a little greener! 🌍',
    priority: 5,
  },
  {
    category: 'thanks',
    keywords: ['thank', 'thanks', 'thankyou', 'thank you', 'thx', 'appreciate', 'helpful', 'great', 'awesome'],
    synonyms: ['thnks', 'thnk', 'thanku', 'apreciate', 'helpfull', 'awsome'],
    reply: '😊 You are welcome! Happy to help.\n\nAnything else I can assist with? I am available 24/7!',
    priority: 2,
  },
  {
    category: 'bye',
    keywords: ['bye', 'goodbye', 'see you', 'later', 'exit', 'close', 'quit'],
    synonyms: ['byee', 'goodby', 'laterr', 'cya'],
    reply: '👋 Goodbye! Happy charging! ⚡🚗\n\nFeel free to come back anytime. Drive safe! 🛣️',
    priority: 2,
  },
];

function getSmartBotReply(text) {
  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(w => w.length > 1);

  if (words.length === 0) {
    return '🤔 Could you rephrase that? Try asking about charging, pricing, reservations, or any Valence feature!';
  }

  const scores = knowledgeBase.map(entry => {
    let score = 0;

    // 1. Exact keyword/phrase match (highest weight)
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) score += 10 + kw.length;
    }

    // 2. Fuzzy keyword match
    if (score === 0) {
      for (const kw of entry.keywords) {
        if (fuzzyMatch(words, kw, 2)) score += 6;
      }
    }

    // 3. Synonym match (handles known common typos)
    if (score === 0) {
      for (const syn of (entry.synonyms || [])) {
        if (lower.includes(syn)) { score += 8; break; }
        if (fuzzyMatch(words, syn, 1)) { score += 5; break; }
      }
    }

    score += entry.priority * 0.1; // tiebreaker
    return { entry, score };
  });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (best.score >= 4) return best.entry.reply;

  return `🤖 I did not quite understand that.\n\nTry asking:\n• "How do I charge my EV?"\n• "What is the price per kWh?"\n• "How to cancel a booking?"\n• "Plan a long trip"\n• "Tell me about referrals"\n• "Find stations near me"\n\nOr just type "help" for a full guide!`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/chat/history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findOne({ userId: req.userId, status: 'open' });
    if (!chat) return res.json({ messages: [], roomId: null });
    res.json({ messages: chat.messages.slice(-50), roomId: chat.roomId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

// POST /api/chat/send
router.post('/send', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Message required' });

    // Fallback chain for username since JWT token might only have userId
    const username = req.user?.name || req.user?.username || req.userId || 'User';

    let chat = await Chat.findOne({ userId: req.userId, status: 'open' });
    if (!chat) {
      chat = await Chat.create({
        roomId: 'room_' + req.userId + '_' + Date.now(),
        userId: req.userId,
        username,
        messages: [],
      });
    }

    // User message
    chat.messages.push({ sender: 'user', senderName: username, text: text.trim() });

    // Local fuzzy matching bot reply
    const botText = getSmartBotReply(text.trim());
    const botName = 'Valence Bot';

    chat.messages.push({ sender: 'bot', senderName: botName, text: botText });

    await chat.save();

    res.json({
      userMessage: chat.messages[chat.messages.length - 2],
      botReply: chat.messages[chat.messages.length - 1],
    });
  } catch (e) {
    console.error('Chat send error:', e);
    res.status(500).json({ error: 'Failed to send message: ' + e.message });
  }
});

// POST /api/chat/close
router.post('/close', verifyToken, async (req, res) => {
  try {
    await Chat.updateMany({ userId: req.userId, status: 'open' }, { status: 'closed' });
    res.json({ message: 'Chat closed' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to close chat' });
  }
});

// GET /api/chat/status
router.get('/status', (req, res) => {
  res.json({
    engine: 'Local Fuzzy Matching (Levenshtein)',
    knowledgeCategories: knowledgeBase.length,
  });
});

module.exports = router;
